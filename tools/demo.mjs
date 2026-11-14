/**
 * Record a demo video of the game actually being played.
 *
 * A fighting game recorded in real time off a headless browser is a bad
 * advert for itself: the renderer here runs on software GL, so wall-clock
 * capture drops frames exactly where the action is -- the impacts, which are
 * the expensive frames. Instead the simulation is stepped by hand, one tick
 * per captured frame, and encoded at a true 60. Nothing is dropped and the
 * motion is the motion the game intends, not the motion this machine managed.
 *
 * Stepping by hand breaks everything that reads a clock, though, because the
 * wall clock keeps running while the simulation waits on a screenshot. At
 * ~42ms a frame the page lives two and a half times faster than the video
 * does, which showed up as the ROUND title flashing past in a third of its
 * time. Two clocks have to be dragged back:
 *
 *   - setTimeout, which is what hides the ROUND, FIGHT and K.O. titles. The
 *     page's timers are replaced with a queue this tool advances by exactly
 *     one frame per captured frame, so a 1100ms title lasts 66 frames of
 *     video whatever the capture took.
 *   - CSS transitions on the health and guard bars, which run on the
 *     compositor and cannot be stepped. Their global playback rate is set
 *     from the measured capture rate instead, and re-measured as it goes.
 *
 * Chromium's virtual time would do both at once and is the obvious answer,
 * but it cannot be used here: with the clock paused the compositor never
 * produces a frame, so every screenshot hangs. Measured, not assumed -- a
 * capture under paused virtual time times out at 30s.
 *
 * Sound is synthesised at runtime from the simulation, so there is no audio
 * device to record and nothing to capture. Every call into the mixer is
 * logged with the frame it happened on instead, and replayed afterwards into
 * an OfflineAudioContext whose clock is driven from those frame numbers. The
 * soundtrack is therefore the one the game would have played, sample for
 * sample, rather than a re-creation of it.
 *
 *   node tools/demo.mjs [--out demo.mp4] [--fps 60] [--quick] [--silent]
 *                       [--width 1280] [--height 720] [--keep-frames]
 *                       [--gain <x>] [--pair a:b] [--seconds 30] [--arena id]
 *
 * `--quick` cuts every scene short, for checking the thing runs before
 * spending the full render on it.
 */

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (f, d) => (process.argv.includes(f) ? process.argv[process.argv.indexOf(f) + 1] : d);
const flag = (f) => process.argv.includes(f);
const OUT = path.resolve(ROOT, arg('--out', 'demo.mp4'));
const FPS = Number(arg('--fps', 60));
const W = Number(arg('--width', 1280));
const H = Number(arg('--height', 720));
const QUICK = flag('--quick');
const SILENT = flag('--silent');
const KEEP = flag('--keep-frames');
const GAIN = arg('--gain', null) === null ? null : Number(arg('--gain'));
/** `--pair kin06s:kin09s` records that one matchup and nothing else. */
const PAIR = arg('--pair', null) ? arg('--pair').split(':') : null;
const SR = 48000;

/**
 * What the video shows. Each fight is the game playing itself -- both corners
 * on the shipped opponent AI, P1's intent pushed back through real key events
 * so it goes in through the same buffer a player's would.
 *
 * The side-view pair leads, because they are the point: a profile camera is
 * what lets a limb read as a strike, and the two of them throw the widest
 * swings in the cast. The front-facing pairs follow so the video is the game
 * as it stands rather than only its best corner.
 */
const SCENES = PAIR ? [
  // One matchup, no select screen: a clip for a post opens on the fight or it
  // loses the viewer before anything happens.
  { kind: 'fight', a: PAIR[0], b: PAIR[1], arena: arg('--arena', 'towers'),
    frames: Math.round(Number(arg('--seconds', 30)) * FPS), finish: 320 },
] : [
  { kind: 'select', frames: 96 },
  { kind: 'fight', a: 'kin06s', b: 'kin09s', arena: 'towers', frames: 620 },
  { kind: 'fight', a: 'kin09s', b: 'kin06s', arena: 'cut', frames: 580 },
  { kind: 'fight', a: 'kin06s', b: 'kin09s', arena: 'bloom', frames: 660, finish: 300 },
];

const { chromium } = await load();
async function load() {
  for (const c of ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs']) {
    try { return await import(c); } catch { /* next */ }
  }
  throw new Error('playwright not found');
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (p.endsWith('/')) p += 'index.html';
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
const port = await new Promise((resolve, reject) => {
  let p = 8700;
  const attempt = () => {
    server.once('error', (e) => (e.code === 'EADDRINUSE' && p < 8730 ? (p++, attempt()) : reject(e)));
    server.listen(p, () => resolve(p));
  };
  attempt();
});

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'rebelkin-demo-'));
const framesDir = path.join(work, 'frames');
fs.mkdirSync(framesDir);

const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader'] });
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const page = await context.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.error('page:', m.text()); });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
// Against the roster, not a literal: a count of 10 here hung for thirty
// seconds the first time a character was added.
const { IDS } = await import('./spar.mjs');
await page.waitForFunction((n) => window.__REBELKIN__ && Object.keys(window.__REBELKIN__.rigs).length === n,
  IDS.length, { timeout: 30000 });

// A gesture, so the mixer opens. Nothing is heard -- there is no device --
// but the calls into it are what gets logged, and they only happen on a
// mixer that believes it is live.
await page.mouse.click(W / 2, H - 40);
await page.waitForTimeout(250);

await page.evaluate(async () => {
  const g = window.__REBELKIN__;
  const { AI } = await import('/src/fight/ai.js');
  const d = { p1: new AI('mean'), held: new Set(), sound: [], frame: 0 };
  window.__DEMO__ = d;

  // What actually landed, and when. A reel is made to show particular moves
  // off; without this there is no way to know whether the one you cut the
  // clip for was ever thrown.
  d.landed = [];
  // Attached per match, not once here: each scene builds a new Match and the
  // old object's handler goes with it.
  d.hookMatch = () => {
    const m = g.match;
    if (!m || m.__logged) return;
    m.__logged = true;
    const prev = m.onEvent;
    m.onEvent = (kind, data) => {
      prev(kind, data);
      if ((kind === 'hit' || kind === 'block') && data && data.move) {
        d.landed.push({ kind, move: data.move.label, by: data.attacker.pad, frame: d.frame });
      }
    };
  };

  // Every way the game makes a noise, wrapped where it is called rather than
  // where it is decided, so the log is what the mixer was actually asked for.
  for (const m of ['hit', 'block', 'guardBreak', 'whiff', 'step', 'jump', 'land',
    'koStinger', 'announce', 'ui', 'swell']) {
    const real = g.sfx[m].bind(g.sfx);
    g.sfx[m] = (...args) => { d.sound.push({ m, args, frame: d.frame }); return real(...args); };
  }

  const KEYS = { left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS',
    light: 'KeyJ', heavy: 'KeyK', special: 'KeyL', guard: 'Space' };
  const set = (code, want) => {
    if (want === d.held.has(code)) return;
    if (want) d.held.add(code); else d.held.delete(code);
    dispatchEvent(new KeyboardEvent(want ? 'keydown' : 'keyup', { code, bubbles: true }));
  };
  const tap = (code) => {
    dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
    setTimeout(() => dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true })), 34);
  };
  d.release = () => { for (const c of d.held) set(c, false); };

  // The page's own clock, advanced a frame at a time. Everything the game
  // schedules -- the announcement titles, the guard-break flash, the keyup
  // that ends a tapped button -- goes through here, so it is counted in
  // frames of video rather than in however long a screenshot took.
  d.now = 0;
  d.timers = [];
  d.seq = 1;
  const realSetTimeout = window.setTimeout.bind(window);
  window.setTimeout = (fn, ms = 0, ...args) => {
    const id = d.seq++;
    d.timers.push({ id, at: d.now + Math.max(0, ms), fn, args });
    return id;
  };
  window.clearTimeout = (id) => {
    const i = d.timers.findIndex((t) => t.id === id);
    if (i >= 0) d.timers.splice(i, 1);
  };
  d.realSetTimeout = realSetTimeout;
  d.pumpTimers = () => {
    d.now += 1000 / 60;
    // Spliced out before firing, so a callback that schedules another timer
    // does not have it run inside this same frame.
    const due = d.timers.filter((t) => t.at <= d.now).sort((a, b) => a.at - b.at);
    for (const t of due) {
      const i = d.timers.indexOf(t);
      if (i >= 0) d.timers.splice(i, 1);
      try { t.fn(...t.args); } catch { /* a demo is not the place to throw */ }
    }
  };

  // One simulation tick, then one render. The loop is stopped: this is the
  // only thing advancing the game.
  window.__STEP__ = () => {
    d.pumpTimers();
    const m = g.match;
    if (m && m.phase === 'fight') {
      const it = d.p1.think(m.a, m.b, g.loop.frame);
      set(KEYS.left, it.move < 0);
      set(KEYS.right, it.move > 0);
      set(KEYS.guard, !!it.guard);
      set(KEYS.down, !!it.crouch);
      if (it.jump) tap(KEYS.up);
      // The low has no key of its own: it is crouch plus light, and the
      // crouch arrives through `it.crouch` above like any other. Without the
      // mapping the AI driving P1 asked for a move the keyboard could not
      // express, and only P2 ever swept.
      if (it.attack) tap(KEYS[it.attack === 'low' ? 'light' : it.attack]);
    }
    g.loop.update(g.loop.frame++);
    g.loop.render(0, 1 / 60);
    d.frame++;
  };
  g.loop.stop();
});

const cdp = await context.newCDPSession(page);
await cdp.send('Animation.enable');
// Starts at the ratio a 42ms capture implies and is corrected from the real
// rate once there is one to measure.
let cssRate = (1000 / FPS) / 42;
await cdp.send('Animation.setPlaybackRate', { playbackRate: cssRate });

let n = 0;
const started = Date.now();
for (const scene of SCENES) {
  const frames = QUICK ? Math.min(scene.frames, 90) : scene.frames;
  if (scene.kind === 'fight') {
    // The arena is chosen before the match so the opening frame is already in
    // it; starting first and switching after shows one frame of the old one.
    await page.evaluate(({ a, b, arena }) => {
      const g = window.__REBELKIN__;
      window.__DEMO__.release();
      g.setArena(arena);
      g.start(a, 'ai', b);
      window.__DEMO__.hookMatch();
    }, scene);
  }
  for (let i = 0; i < frames; i++) {
    // A reel that cuts away from every fight mid-round never shows the one
    // thing a round is for. `finish` puts the loser on their last sliver with
    // time left to take the hit that ends it, so the K.O., the slow motion
    // and the round board all happen for real rather than being staged frame
    // by frame -- the only thing arranged is the health it starts from.
    if (scene.finish && i === frames - scene.finish) {
      await page.evaluate(() => {
        const m = window.__REBELKIN__.match;
        if (m && m.phase === 'fight') m.b.health = Math.min(m.b.health, m.b.def.health * 0.08);
      });
    }
    if (scene.kind === 'fight') await page.evaluate(() => window.__STEP__());
    else await page.evaluate(() => { window.__DEMO__.pumpTimers(); window.__DEMO__.frame++; });
    // CDP rather than page.screenshot: Playwright's wrapper waits for fonts
    // and for the page to go quiet, and under paused virtual time that wait
    // never ends -- the compositor frame it is waiting on cannot arrive while
    // the clock is stopped. This asks the renderer for what it has.
    const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 94 });
    fs.writeFileSync(path.join(framesDir, `${String(n).padStart(6, '0')}.jpg`),
      Buffer.from(shot.data, 'base64'));
    n++;
    if (n % 120 === 0) {
      const perFrame = (Date.now() - started) / n;
      const want = (1000 / FPS) / perFrame;
      if (Math.abs(want - cssRate) / cssRate > 0.08) {
        cssRate = want;
        await cdp.send('Animation.setPlaybackRate', { playbackRate: cssRate });
      }
      process.stdout.write(`\r  ${n} frames  ${(1000 / perFrame).toFixed(1)}/s captured`
        + `  css x${cssRate.toFixed(2)}`);
    }
  }
}
process.stdout.write(`\r  ${n} frames captured in ${((Date.now() - started) / 1000).toFixed(0)}s\n`);
const landed = await page.evaluate(() => window.__DEMO__.landed);
const tally = {};
for (const e of landed) tally[e.move] = (tally[e.move] || 0) + 1;
console.log(`  ${landed.length} contacts: ${Object.entries(tally)
  .map(([m, c]) => `${m} x${c}`).join(', ') || 'none'}`);
for (const e of landed) {
  if (/stomp|lunge/i.test(e.move)) {
    console.log(`  ${e.move} at ${(e.frame / FPS).toFixed(1)}s (${e.kind})`);
  }
}

// ---- the soundtrack, rendered offline from the log
let wav = null;
if (!SILENT) {
  const seconds = n / FPS + 1.5;          // tail, so the last impact can ring out
  const pcm = await page.evaluate(async ({ seconds, sr, fps }) => {
    const { Sfx } = await import('/src/audio/sfx.js');
    const log = window.__DEMO__.sound;
    const oac = new OfflineAudioContext(2, Math.ceil(sr * seconds), sr);
    // Sfx schedules everything against `ctx.currentTime`, which an offline
    // context pins at 0 until it renders. A proxy hands it a clock we move
    // instead, so a call logged on frame 900 is scheduled at 15 seconds.
    //
    // `state` is faked too, and that is not cosmetic: every voice is behind
    // `get on()`, which asks whether the context is running. An offline one
    // reads 'suspended' right up until it renders, so without this the whole
    // log plays into silence and the only thing in the file is the ambient
    // bed, which does not ask. That is exactly what the first render did --
    // 134 mixer calls and a peak of 0.08.
    let clock = 0;
    const shim = new Proxy(oac, {
      get(o, k) {
        if (k === 'currentTime') return clock;
        if (k === 'state') return 'running';
        const v = o[k];
        return typeof v === 'function' ? v.bind(o) : v;
      },
    });
    const sfx = new Sfx();
    const RealAC = window.AudioContext;
    window.AudioContext = function Shim() { return shim; };
    try { sfx.unlock(); } finally { window.AudioContext = RealAC; }
    for (const e of log) {
      clock = e.frame / fps;
      try { sfx[e.m](...e.args); } catch { /* a voice that cannot build is silence */ }
    }
    const buf = await oac.startRendering();
    return { L: Array.from(buf.getChannelData(0)), R: Array.from(buf.getChannelData(1)) };
  }, { seconds, sr: SR, fps: FPS });

  const frames = pcm.L.length;
  const data = Buffer.alloc(frames * 4);
  let peak = 0;
  for (let i = 0; i < frames; i++) peak = Math.max(peak, Math.abs(pcm.L[i]), Math.abs(pcm.R[i]));
  // Normalise only if it would clip. The mix is compressed already, so the
  // levels the game chose are the levels it wants.
  // The mix is compressed already, so its own balance is kept; this only
  // moves the whole thing to a sensible level. Capped, because a reel that
  // happened to be quiet is not an invitation to amplify the room tone.
  const k = GAIN !== null ? GAIN : Math.min(6, 0.89 / Math.max(0.02, peak));
  for (let i = 0; i < frames; i++) {
    data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(pcm.L[i] * k * 32767))), i * 4);
    data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(pcm.R[i] * k * 32767))), i * 4 + 2);
  }
  const head = Buffer.alloc(44);
  head.write('RIFF', 0); head.writeUInt32LE(36 + data.length, 4); head.write('WAVE', 8);
  head.write('fmt ', 12); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20);
  head.writeUInt16LE(2, 22); head.writeUInt32LE(SR, 24); head.writeUInt32LE(SR * 4, 28);
  head.writeUInt16LE(4, 32); head.writeUInt16LE(16, 34);
  head.write('data', 36); head.writeUInt32LE(data.length, 40);
  wav = path.join(work, 'track.wav');
  fs.writeFileSync(wav, Buffer.concat([head, data]));
  console.log(`  ${(frames / SR).toFixed(1)}s of audio from ${
    (await page.evaluate(() => window.__DEMO__.sound.length))} mixer calls, `
    + `peak ${peak.toFixed(2)} x${k.toFixed(2)} -> ${(peak * k).toFixed(2)}`);
}

await browser.close();
server.close();

const ff = ['-y', '-framerate', String(FPS), '-i', path.join(framesDir, '%06d.jpg')];
if (wav) ff.push('-i', wav);
ff.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p');
if (wav) ff.push('-c:a', 'aac', '-b:a', '192k', '-shortest');
ff.push('-movflags', '+faststart', OUT);
execFileSync('ffmpeg', ff, { stdio: ['ignore', 'ignore', 'pipe'] });
if (!KEEP) fs.rmSync(work, { recursive: true, force: true });
const size = fs.statSync(OUT).size;
console.log(`wrote ${path.relative(ROOT, OUT)}  ${n} frames at ${FPS}fps, ${
  (n / FPS).toFixed(1)}s, ${(size / 1e6).toFixed(1)}MB${KEEP ? `\nframes kept in ${framesDir}` : ''}`);

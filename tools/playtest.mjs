/**
 * Drives the game in a real browser with real key events.
 *
 * A fighter has a lot of state that only goes wrong in combination -- a move
 * that never leaves recovery, a hitbox that never reaches, an AI that never
 * commits. This presses buttons and asserts the simulation actually moved.
 *
 *   node tools/playtest.mjs [--shots <dir>] [--headed]
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8420;
const args = process.argv.slice(2);
const SHOTS = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
const HEADED = args.includes('--headed');

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
await new Promise((r) => server.listen(PORT, r));

const browser = await chromium.launch({
  headless: !HEADED,
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
// Count audio nodes as they are created. Headless has no speakers, so the only
// honest check is that the graph gets built when the simulation says it should.
await page.addInitScript(() => {
  window.__AUDIO__ = { osc: 0, buf: 0, ctxs: 0 };
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  const wrap = (name, key) => {
    const orig = AC.prototype[name];
    AC.prototype[name] = function patched(...a) { window.__AUDIO__[key]++; return orig.apply(this, a); };
  };
  wrap('createOscillator', 'osc');
  wrap('createBufferSource', 'buf');
  const Orig = AC;
  const Patched = function (...a) { window.__AUDIO__.ctxs++; return new Orig(...a); };
  Patched.prototype = Orig.prototype;
  window.AudioContext = Patched;
});
const problems = [];
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });

let failed = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? `  ${detail}` : ''}`);
  if (!ok) failed++;
};
const shot = async (n) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `fight-${n}.png`) }); };
const state = () => page.evaluate(() => {
  const g = window.__REBELKIN__;
  const m = g?.match;
  if (!m) return { match: false };
  const f = (x) => ({ x: Math.round(x.x), y: Math.round(x.y), hp: Math.round(x.health),
    state: x.state, facing: x.facing, move: x.move?.name ?? null, frame: x.moveFrame });
  return { match: true, phase: m.phase, timer: Math.round(m.timer), wins: m.wins,
    hitstop: m.hitstop, a: f(m.a), b: f(m.b), fps: g.loop.fps, sparks: g.fx.sparks.length };
});

try {
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__REBELKIN__, { timeout: 15000 });
  console.log('\nboot');
  check('rigs loaded', await page.evaluate(() => Object.keys(window.__REBELKIN__.rigs).length) === 2);
  await shot('0-select');

  await page.click('#startBtn');
  await page.waitForTimeout(1600);               // intro
  let s = await state();
  check('match started', s.match && s.phase === 'fight', s.phase);
  check('both fighters at full health', s.a.hp === 1000 && s.b.hp === 1120, `${s.a.hp} / ${s.b.hp}`);
  await shot('1-start');

  console.log('\nmovement');
  const x0 = (await state()).a.x;
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(500);
  await page.keyboard.up('KeyD');
  await page.waitForTimeout(80);
  s = await state();
  check('walking moves the fighter', Math.abs(s.a.x - x0) > 30, `${x0} -> ${s.a.x}`);

  await page.keyboard.press('KeyW');
  await page.waitForTimeout(140);
  s = await state();
  check('jump leaves the floor', s.a.y < -20, `y ${s.a.y}`);
  await shot('2-jump');
  await page.waitForTimeout(700);
  s = await state();
  check('jump lands', s.a.y === 0, `y ${s.a.y}`);

  console.log('\nattacks connect');
  // Stop the CPU guarding for this check: blocked chip damage is clamped so it
  // can never finish anyone, so a guarded trade proves nothing about hitting.
  await page.evaluate(() => { window.__REBELKIN__.ai.cfg.block = 0; });
  const hpBefore = (await state()).b.hp;
  let landed = false;
  for (let i = 0; i < 26 && !landed; i++) {
    const cur = await state();
    const gap = Math.abs(cur.b.x - cur.a.x);
    if (gap > 130) {
      const key = cur.b.x > cur.a.x ? 'KeyD' : 'KeyA';
      await page.keyboard.down(key);
      await page.waitForTimeout(150);
      await page.keyboard.up(key);
    } else {
      await page.keyboard.press(i % 3 === 2 ? 'KeyK' : 'KeyJ');
      await page.waitForTimeout(320);
    }
    landed = (await state()).b.hp < hpBefore;
  }
  s = await state();
  check('a clean hit reduces health', landed, `${hpBefore} -> ${s.b.hp}`);
  check('damage is a real hit, not chip', hpBefore - s.b.hp > 25, `-${hpBefore - s.b.hp}`);
  await shot('3-trading');

  console.log('\nframe data is respected');
  const probe = await page.evaluate(async () => {
    const g = window.__REBELKIN__;
    const a = g.match.a;
    a.x = g.match.b.x - 110;                       // put them in range
    a.health = a.def.health;
    const seen = [];
    a.startMove('heavy');
    for (let i = 0; i < 60; i++) {
      seen.push({ f: a.moveFrame, state: a.state });
      await new Promise((r) => requestAnimationFrame(r));
      if (a.state !== 'attack') break;
    }
    const m = a.def.moves.heavy;
    return { total: m.startup + m.active + m.recovery, ended: a.state !== 'attack', peak: Math.max(...seen.map((x) => x.f)) };
  });
  check('a heavy runs its full length then ends', probe.ended && probe.peak >= probe.total - 2,
    `peak frame ${probe.peak} of ${probe.total}`);

  console.log('\nhitstop and effects fire');
  const fxProbe = await page.evaluate(() => {
    const g = window.__REBELKIN__;
    const before = g.fx.sparks.length;
    g.match.onEvent('hit', { contact: { x: g.match.a.x, y: -120 },
      move: g.match.a.def.moves.heavy, attacker: g.match.a, defender: g.match.b, ko: false });
    return { before, after: g.fx.sparks.length, shake: g.cam.shake };
  });
  check('impact spawns sparks', fxProbe.after > fxProbe.before, `${fxProbe.before} -> ${fxProbe.after}`);
  check('impact shakes the camera', fxProbe.shake > 0, fxProbe.shake.toFixed(1));

  console.log('\nKO ends the round');
  await page.evaluate(() => {
    const m = window.__REBELKIN__.match;
    m.b.health = 1;
    m.a.x = m.b.x - 100;
  });
  let koed = false;
  for (let i = 0; i < 30 && !koed; i++) {
    await page.keyboard.press('KeyK');
    await page.waitForTimeout(260);
    const cur = await state();
    koed = cur.b.hp === 0 || cur.phase === 'roundEnd' || cur.wins[0] > 0;
  }
  s = await state();
  check('round ends on a KO', koed, `phase ${s.phase} wins ${s.wins}`);
  await shot('4-ko');

  console.log('\naudio');
  const au = await page.evaluate(() => {
    const g = window.__REBELKIN__;
    return { ready: g.sfx.ready, state: g.sfx.ctx ? g.sfx.ctx.state : 'none', ...window.__AUDIO__ };
  });
  check('audio context opened on the first gesture', au.ctxs >= 1 && au.ready, `state ${au.state}`);
  check('ambient bed is running', au.osc >= 3, `${au.osc} oscillators`);
  check('impacts build voices', au.buf >= 3, `${au.buf} buffer sources`);

  const before = await page.evaluate(() => window.__AUDIO__.osc + window.__AUDIO__.buf);
  await page.evaluate(() => { window.__REBELKIN__.sfx.hit(98, false); window.__REBELKIN__.sfx.block(); });
  const after = await page.evaluate(() => window.__AUDIO__.osc + window.__AUDIO__.buf);
  check('a hit and a block each spawn voices', after > before, `${before} -> ${after}`);

  const muteCheck = await page.evaluate(() => {
    const g = window.__REBELKIN__.sfx;
    g.setMuted(true);
    const muted = g.muted;
    g.setMuted(false);
    return { muted, restored: !g.muted };
  });
  check('mute silences and restores', muteCheck.muted && muteCheck.restored);

  console.log('\nperformance');
  await page.waitForTimeout(1200);
  s = await state();
  check('runs at 50fps or better', s.fps >= 50, `${s.fps} fps`);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check('no horizontal overflow', !overflow);
} catch (err) {
  console.error(`\nFAILED: ${err.message}`);
  await shot('fail');
  failed++;
} finally {
  if (problems.length) {
    console.error(`\n${problems.length} runtime problem(s):`);
    for (const p of problems.slice(0, 8)) console.error(`  ${p}`);
    failed += problems.length;
  } else {
    console.log('\nno runtime errors');
  }
  await browser.close();
  server.close();
  console.log(failed ? `\n${failed} FAILED` : '\nPLAYTEST PASSED');
  process.exit(failed ? 1 : 0);
}

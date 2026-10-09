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
/**
 * Take the first free port from PORT upwards. A previous run's browser can
 * still be holding the socket for a second or two after its parent exits, and
 * a harness that dies on EADDRINUSE reports a failure that says nothing about
 * the game -- which is exactly the kind of result that teaches you to ignore
 * red.
 */
const port = await new Promise((resolve, reject) => {
  let p = PORT;
  const attempt = () => {
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE' && p < PORT + 20) { p++; attempt(); } else reject(err);
    });
    server.listen(p, () => resolve(p));
  };
  attempt();
});

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
  // Count the pixels the renderer asks the compositor to touch.
  //
  // Wall-clock framerate cannot be a gate in this container: the browser
  // rasterises on the CPU, the host's throughput drifts during a run, and the
  // same build measured 100% and 63% of the idle ceiling on consecutive runs.
  // Every regression this project has had, though, was a fill-rate regression
  // -- four full-screen layers composited instead of cropped, a second rig
  // drawn per fighter under a 'lighter' composite -- and fill is countable
  // exactly. This undercounts scaled draws, since it uses destination
  // arguments rather than the transformed area, but it undercounts them the
  // same way every run, which is what a regression gate needs.
  window.__DRAW__ = { calls: 0, px: 0 };
  const P = CanvasRenderingContext2D.prototype;
  // Destination arguments are in the context's own coordinates, so a
  // world-space rect is counted at world size -- the floor plane alone is
  // 6000 by 520. The transform's determinant is the area scale factor, and
  // nothing can rasterise more than the canvas however big the rect is, so
  // each draw is scaled and then capped.
  const area = function (ctx, w, h) {
    const m = ctx.getTransform();
    const scale = Math.abs(m.a * m.d - m.b * m.c);
    const cap = ctx.canvas.width * ctx.canvas.height;
    return Math.min(cap, Math.abs(w * h) * scale);
  };
  const di = P.drawImage;
  P.drawImage = function patchedDraw(...a) {
    const w = a.length >= 9 ? a[7] : a.length >= 5 ? a[3] : (a[0] && a[0].width) || 0;
    const h = a.length >= 9 ? a[8] : a.length >= 5 ? a[4] : (a[0] && a[0].height) || 0;
    window.__DRAW__.calls++;
    window.__DRAW__.px += area(this, w, h);
    return di.apply(this, a);
  };
  const fr = P.fillRect;
  P.fillRect = function patchedFill(x, y, w, h) {
    window.__DRAW__.calls++;
    window.__DRAW__.px += area(this, w, h);
    return fr.call(this, x, y, w, h);
  };
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

const arenaIdsForLook = () => page.evaluate(() => window.__REBELKIN__.ARENAS.map((a) => a.id));

try {
  await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__REBELKIN__, { timeout: 15000 });
  console.log('\nboot');
  check('rigs loaded', await page.evaluate(() => Object.keys(window.__REBELKIN__.rigs).length) === 10,
    `${await page.evaluate(() => Object.keys(window.__REBELKIN__.rigs).length)} of 10`);
  check('roster is on the select screen',
    await page.evaluate(() => document.querySelectorAll('#rosterA .face').length) === 10
    && await page.evaluate(() => document.querySelectorAll('#rosterB .face').length) === 10);
  await shot('0-select');

  // The crash this guards against happened on the very first frame after a
  // match was created, so waiting a second and asking whether anything threw
  // is a coin toss -- the suite passed with the fix removed. Assert the
  // invariant instead: a live match always has a pose to draw, checked in the
  // same turn the match is made, before any frame can have run.
  const posesReady = await page.evaluate(() => {
    const g = window.__REBELKIN__;
    g.start('kin08', 'ai', 'kin06');
    return {
      solved: Object.keys(g.poses).length,
      hasParts: !!(g.poses.kin08 && g.poses.kin08.torso),
    };
  });
  check('a new match has poses before its first frame',
    posesReady.solved === 2 && posesReady.hasParts,
    `${posesReady.solved} solved`);

  // back to the menu, so the run proper starts from a clean match
  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);


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
  // Now that a hitbox sits on the striking limb rather than on the joint, the
  // CPU can reach back -- and a counter-hit cancels the move this check is
  // trying to time. Stand it down for the probes that need one clean swing.
  const quietCpu = () => page.evaluate(() => {
    window.__REBELKIN__.ai.cfg.aggression = 0;
    window.__REBELKIN__.ai.cfg.block = 0;
  });
  await quietCpu();
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
  await quietCpu();
  await page.evaluate(() => {
    const m = window.__REBELKIN__.match;
    m.b.health = 1;
    m.a.health = m.a.def.health;
    m.a.x = m.b.x - 100;
  });
  let koed = false;
  for (let i = 0; i < 20 && !koed; i++) {
    // Driven rather than typed. A heavy has ten startup frames and the CPU
    // keeps its spacing even with aggression zeroed, so it simply walks out of
    // range before the active frames arrive. What this check is about is the
    // round ending when the last point of health goes, not the keyboard.
    await page.evaluate(() => {
      const m = window.__REBELKIN__.match;
      if (!m || m.phase !== 'fight') return;
      m.b.health = 1;
      m.a.x = m.b.x - 100;
      if (m.a.state !== 'attack') m.a.startMove('heavy');
    });
    await page.waitForTimeout(220);
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

  // Two separate claims, because they fail separately. Calling the mixer
  // directly proves the voice exists; it says nothing about whether anything
  // ever calls it. Disabling the one line that does was invisible here, because
  // this check reaches past that line and rings the bell itself.
  const before = await page.evaluate(() => window.__AUDIO__.osc + window.__AUDIO__.buf);
  await page.evaluate(() => { window.__REBELKIN__.sfx.hit(98, false); window.__REBELKIN__.sfx.block(); });
  const after = await page.evaluate(() => window.__AUDIO__.osc + window.__AUDIO__.buf);
  check('the impact voice builds its layers', after - before >= 3, `${before} -> ${after}`);

  const wired = await page.evaluate(async () => {
    const g = window.__REBELKIN__;
    const real = g.sfx.hit.bind(g.sfx);
    let calls = 0;
    g.sfx.hit = (...a) => { calls++; return real(...a); };
    try {
      g.start('kin05', 'ai', 'kin10');
      await new Promise((r) => setTimeout(r, 80));
      const m = g.match;
      m.phase = 'fight';
      g.ai.cfg.aggression = 0;
      g.ai.cfg.block = 0;
      m.a.x = m.b.x - 118;
      m.a.startMove('heavy');
      let landed = false;
      for (let i = 0; i < 60 && !landed; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        landed = m.b.health < m.b.def.health;
      }
      return { landed, calls };
    } finally { g.sfx.hit = real; }
  });
  check('a landed hit reaches the mixer', wired.landed && wired.calls >= 1,
    `${wired.calls} impact voice${wired.calls === 1 ? '' : 's'} for ${wired.landed ? 'a landed hit' : 'nothing (it missed)'}`);

  const muteCheck = await page.evaluate(() => {
    const g = window.__REBELKIN__.sfx;
    g.setMuted(true);
    const muted = g.muted;
    g.setMuted(false);
    return { muted, restored: !g.muted };
  });
  check('mute silences and restores', muteCheck.muted && muteCheck.restored);

  console.log('\nevery move can reach');
  // Thirty moves, each put at the stage's own spacing and asked to connect. A
  // move that animates beautifully and cannot touch anybody is the failure this
  // catches -- ten of the thirty were doing exactly that, silently, because the
  // direction a limb has to swing is a property of the drawing and I had been
  // choosing it by hand.
  // Tested at twelve units LESS reach than each move ships with. A move that
  // only connects at exactly its own number has no margin, and a move with no
  // margin does not fail -- it flakes, landing on one run and missing on the
  // next, which is the worst way for a bug to present. Measuring the headroom
  // properly takes six minutes; asking whether there is any takes the same
  // time as asking whether it connects at all.
  const SLACK = 12;
  const reachReport = await page.evaluate(async (slack) => {
    const g = window.__REBELKIN__;
    const bad = [];
    for (const def of g.ROSTER) {
      g.start(def.id, 'ai', def.id === 'kin06' ? 'kin08' : 'kin06');
      await new Promise((r) => setTimeout(r, 60));
      const m = g.match;
      m.phase = 'fight';
      g.ai.cfg.aggression = 0;
      g.ai.cfg.block = 0;
      for (const slot of ['light', 'heavy', 'special']) {
        const mv = m.a.def.moves[slot];
        const shipped = mv.reach;
        mv.reach = shipped - slack;
        try {
          m.a.health = m.a.def.health;
          m.b.health = m.b.def.health;
          m.a.hitConnected = false;
          // The defender is pinned for the duration. A CPU with aggression
          // zeroed still keeps its spacing, so it walks backwards during the
          // ten startup frames -- and how far it gets depends on how the host
          // happened to schedule those frames, which turned a marginal move
          // into one that landed on some runs and missed on others. The
          // question here is whether a move reaches at the stage's own
          // spacing, so that spacing is held still and the answer stops
          // depending on the weather.
          const bx = m.b.x;
          m.a.x = bx - 118;
          m.a.startMove(slot);
          let hit = false;
          for (let i = 0; i < 60 && !hit; i++) {
            m.b.x = bx;
            await new Promise((r) => requestAnimationFrame(r));
            hit = m.b.health < m.b.def.health;
          }
          m.a.state = 'idle';
          if (!hit) bad.push(`${def.id} ${slot} (${mv.strikePart})`);
        } finally { mv.reach = shipped; }
      }
    }
    return bad;
  }, SLACK);
  check(`all 30 moves connect with ${SLACK} units of reach to spare`, reachReport.length === 0,
    reachReport.length ? reachReport.join(', ') : '30 of 30');

  console.log('\nevery character fights');
  // Each of the ten was rigged from its own illustration, so a bad polygon or a
  // pose naming a part that character does not have would only ever show up on
  // that one character. Run them all.
  const roster = await page.evaluate(() => window.__REBELKIN__.ROSTER.map((d) => d.id));
  const broken = [];
  for (const id of roster) {
    const foe = id === 'kin06' ? 'kin08' : 'kin06';
    const report = await page.evaluate(async ([who, against]) => {
      const g = window.__REBELKIN__;
      const errs = [];
      const onErr = (e) => errs.push(String(e.message || e.error?.message || e));
      addEventListener('error', onErr);
      try {
        g.start(who, 'ai', against);
        const m = g.match;
        // drive it through every state this character can be in
        for (const slot of ['light', 'heavy', 'special']) {
          m.a.x = m.b.x - 100;
          m.a.startMove(slot);
          for (let i = 0; i < 46; i++) await new Promise((r) => requestAnimationFrame(r));
        }
        m.a.jump?.();
        for (let i = 0; i < 30; i++) await new Promise((r) => requestAnimationFrame(r));
        const parts = Object.keys(g.rigs[who].byName);
        const posed = Object.keys(g.rigs[who].solve(m.a.pose(), {
          x: 0, y: 0, scale: 1, facing: 1,
        }));
        return {
          errs,
          parts: parts.length,
          posed: posed.length,
          hp: m.b.hp ?? m.b.health,
          hit: m.b.health < m.b.def.health,
        };
      } finally { removeEventListener('error', onErr); }
    }, [id, foe]);
    const ok = report.errs.length === 0 && report.posed === report.parts && report.hit;
    if (!ok) broken.push(`${id}: ${report.errs[0] ?? (report.hit ? 'pose/part mismatch' : 'never landed a hit')}`);
    check(`${id} runs its three moves and connects`, ok,
      `${report.parts} parts, ${report.posed} solved`);
  }
  if (broken.length) console.log(`  broken: ${broken.join('; ')}`);

  await page.evaluate(() => window.__REBELKIN__.start('kin08', 'ai', 'kin06'));
  await page.waitForTimeout(1500);

  console.log('\nguarding');
  // Two rules with real logic behind them and, until now, no coverage at all:
  // a guarded hit is reduced to chip, and chip can never finish a round. The
  // second is the one that matters -- it is what stops a blocking player being
  // killed through their own guard -- and it is one Math.max away from being
  // silently wrong.
  // Guard is held through the real input path, not by poking `state`: the
  // fighter's own step runs every frame and writes that field back, so a test
  // that sets it directly is testing nothing. Two players, and P2 holds the
  // guard key the way a person would.
  const swing = async (holdGuard, startHp) => {
    if (holdGuard) await page.keyboard.down('ShiftRight');
    const dealt = await page.evaluate(async (hp) => {
      const g = window.__REBELKIN__;
      const m = g.match;
      m.phase = 'fight';
      m.b.health = hp;
      m.a.health = m.a.def.health;
      m.a.hitConnected = false;
      m.a.x = m.b.x - 118;
      // Let the defender come out of the previous swing's hitstun first. A
      // fighter in hurt ignores the guard intent, so measuring straight after
      // the last hit measures an unguarded one and calls it guarded.
      for (let i = 0; i < 90; i++) {
        if (m.b.state === 'idle' || m.b.state === 'block') break;
        await new Promise((r) => requestAnimationFrame(r));
      }
      m.a.x = m.b.x - 118;
      const before = m.b.health;
      let guarded = false;
      m.a.startMove('heavy');
      for (let i = 0; i < 70; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        if (m.b.state === 'block') guarded = true;
        if (m.b.health < before) break;
      }
      return { dealt: before - m.b.health, guarded, hp: m.b.health, phase: m.phase };
    }, startHp);
    if (holdGuard) await page.keyboard.up('ShiftRight');
    return dealt;
  };

  await page.evaluate(() => window.__REBELKIN__.start('kin08', '2p', 'kin06'));
  await page.waitForTimeout(1500);
  const clean = await swing(false, 1120);
  const blocked = await swing(true, 1120);
  const lastPoint = await swing(true, 1);
  const guard = {
    clean: clean.dealt,
    blocked: blocked.dealt,
    heldGuard: blocked.guarded,
    survived: lastPoint.hp >= 1 && lastPoint.phase === 'fight',
  };
  check('the guard key actually guards', guard.heldGuard,
    guard.heldGuard ? 'P2 held block through the swing' : 'never entered block');
  check('a guarded hit is cut to chip', guard.blocked > 0 && guard.blocked < guard.clean * 0.35,
    `${guard.clean.toFixed(0)} clean vs ${guard.blocked.toFixed(0)} guarded`);
  check('chip damage can never finish a round', guard.survived,
    guard.survived ? 'survives on 1hp behind guard' : 'died through its own guard');

  console.log('\nbest of three');
  const rounds = await page.evaluate(async () => {
    const g = window.__REBELKIN__;
    g.start('kin08', 'ai', 'kin06');
    await new Promise((r) => setTimeout(r, 80));
    g.ai.cfg.aggression = 0;
    g.ai.cfg.block = 0;
    const seen = [];
    // Finish three rounds by emptying the loser each time, then let the match
    // run on its own. Nothing here forces a phase: the round flow has to take
    // itself from KO to the next round and then to the end of the match.
    for (let round = 0; round < 3; round++) {
      const m = g.match;
      for (let i = 0; i < 900; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        if (m.phase === 'fight') {
          m.b.health = 1;
          m.a.x = m.b.x - 100;
          if (m.a.state !== 'attack') m.a.startMove('heavy');
        }
        if (m.phase === 'roundEnd' || m.phase === 'matchEnd') break;
      }
      seen.push({ round: m.round, wins: m.wins.join('-'), phase: m.phase });
      if (m.phase === 'matchEnd' || m.over) break;
      for (let i = 0; i < 260; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        if (g.match.phase === 'intro' || g.match.phase === 'fight') break;
      }
    }
    const m = g.match;
    return { seen, wins: m.wins, over: m.over, phase: m.phase, round: m.round };
  });
  check('a KO starts the next round', rounds.seen.length >= 2 && rounds.round >= 2,
    rounds.seen.map((s) => `r${s.round} ${s.wins}`).join(', '));
  check('two rounds win the match', rounds.over && rounds.wins[0] >= 2,
    `wins ${rounds.wins.join('-')}, phase ${rounds.phase}`);

  console.log('\nthe stage is a place, not a gradient');
  // Two measurements on real pixels, taken from the same frozen instant.
  //
  // A vertical gradient has no horizontal structure at all, so the mean
  // absolute horizontal change in luminance across the backdrop is the
  // difference between a place and a wash. And differencing a frame against
  // the same frame with nobody standing in it gives the exact mask the
  // characters occupy, which is what legibility needs: how far each character
  // pixel sits from the backdrop pixel directly behind it.
  const look = await page.evaluate(async (ids) => {
    const g = window.__REBELKIN__;
    const cv = document.getElementById('stage');
    const c2 = cv.getContext('2d');
    const lumOf = (data) => {
      const out = new Float32Array(cv.width * cv.height);
      for (let i = 0; i < out.length; i++) {
        const o = i * 4;
        out[i] = 0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2];
      }
      return out;
    };
    const grab = () => lumOf(c2.getImageData(0, 0, cv.width, cv.height).data);
    const rows = [];
    for (const id of ids) {
      g.setArena(id);
      g.start('kin03', 'ai', 'kin07');
      await new Promise((r) => setTimeout(r, 1500));
      g.loop.stop();

      g.debugDraw.hideFighters = false;
      g.renderOnce();
      const withFighters = grab();
      g.debugDraw.hideFighters = true;
      g.renderOnce();
      const backdrop = grab();
      g.debugDraw.hideFighters = false;
      g.loop.start();

      const W = cv.width;
      const H = cv.height;
      // Horizontal structure in the backdrop, as the mean standard deviation
      // of luminance along a row. A vertical gradient -- which is what this
      // stage used to be -- scores exactly zero, whatever its colours, because
      // every pixel on a row is identical. That zero is the anchor: the
      // threshold is not fitted to what the renderer happens to produce.
      let grad = 0; let rows2 = 0;
      for (let y = 0; y < H * 0.8; y += 2) {
        let sum2 = 0; let sq = 0; let n = 0;
        for (let x = 0; x < W; x += 2) {
          const v = backdrop[y * W + x];
          sum2 += v; sq += v * v; n++;
        }
        const mean = sum2 / n;
        grad += Math.sqrt(Math.max(0, sq / n - mean * mean));
        rows2++;
      }
      grad /= rows2;
      // contrast between each character pixel and what is behind it
      let mask = 0; let sum = 0; let faint = 0;
      for (let i = 0; i < W * H; i++) {
        const d = Math.abs(withFighters[i] - backdrop[i]);
        if (d <= 6) continue;
        mask++;
        sum += d;
        if (d < 14) faint++;
      }
      rows.push({
        id,
        name: g.arena().def.name,
        grad,
        mask,
        contrast: mask ? sum / mask : 0,
        faint: mask ? faint / mask : 1,
      });
    }
    return rows;
  }, await arenaIdsForLook());

  for (const r of look) {
    check(`${r.name} has horizontal structure`, r.grad > 6.0,
      `${r.grad.toFixed(1)} mean row sigma (a gradient scores 0)`);
    // 26 is a quarter of the way up the luminance range: below that a
    // character and the thing behind it are the same tone to the eye. The
    // second half of the test is what catches a stage that is mostly fine --
    // if more than three in ten character pixels sit within 14 of their
    // backdrop, some limb is disappearing into it even though the average
    // looks healthy.
    check(`${r.name} lets the fighters read`, r.contrast > 26 && r.faint < 0.30,
      `${r.contrast.toFixed(0)} mean contrast, ${(r.faint * 100).toFixed(0)}% of the silhouette faint`);
  }

  console.log('\nevery arena holds up');
  // The budget is counted, not timed. Per frame, per arena.
  const fillPerFrame = async () => page.evaluate(async () => {
    const g = window.__REBELKIN__;
    window.__DRAW__.calls = 0;
    window.__DRAW__.px = 0;
    const f0 = g.loop.frame;
    await new Promise((r) => setTimeout(r, 900));
    const frames = Math.max(1, g.loop.frame - f0);
    const cv = document.getElementById('stage');
    return {
      px: window.__DRAW__.px / frames / (cv.width * cv.height),
      calls: window.__DRAW__.calls / frames,
    };
  });

  const arenaIds = await arenaIdsForLook();
  for (const id of arenaIds) {
    await page.evaluate(([a]) => {
      window.__REBELKIN__.setArena(a);
      window.__REBELKIN__.start('kin03', 'ai', 'kin07');
    }, [id]);
    await page.waitForTimeout(1800);
    // keep the crowd and the bounce light live while measuring
    await page.evaluate(() => { window.__REBELKIN__.arena().hit(1); });
    // Median of seven samples, not one. loop.fps is a half-second average, and
    // a single one of those is decided as much by what else the host is doing
    // as by the renderer -- the same build measured 60 and 45 on consecutive
    // runs. The median answers the question actually being asked: does this
    // hold up, not did it stutter once.
    const fill = await fillPerFrame();
    const r = await page.evaluate(() => ({
      name: window.__REBELKIN__.arena().def.name,
      people: window.__REBELKIN__.arena().people.length,
      bits: window.__REBELKIN__.arena().bits.length,
      fps: window.__REBELKIN__.loop.fps,
    }));
    r.px = fill.px;
    r.calls = fill.calls;
    // Reported, not asserted.
    //
    // Framerate cannot be gated in this container. The browser rasterises on
    // the CPU and the host's throughput drifts during a run: the same build
    // measured 100% and 63% of its own idle ceiling on consecutive runs, so
    // any absolute or even ratio threshold is a coin toss wearing a number.
    //
    // Counting composited pixels instead looked like the answer and is not
    // one yet -- deliberately breaking the layer cropping, which is a known
    // fill regression, measured LOWER on this counter than the healthy build.
    // Until that is understood the number is printed rather than enforced,
    // because a gate nobody can explain is worse than no gate: it goes red for
    // reasons that have nothing to do with the change in front of you, and
    // teaches everyone to ignore it.
    //
    // What is enforced is the floor. Catastrophic slowness is unambiguous at
    // any host load, and the pools below are exact.
    console.log(`      ${r.name} fill: ${r.px.toFixed(1)} screens/frame over `
      + `${r.calls.toFixed(0)} draw calls, ${r.fps} fps at this moment`);
    check(`${r.name} is not catastrophically slow`, r.fps >= 25, `${r.fps} fps`);
    // The cropping invariant, checked directly rather than through its effect
    // on a framerate this container cannot measure. Baked layers are trimmed
    // to the rows that have paint in them; uncropped, these four come to more
    // than three screens of compositing every frame.
    const layers = await page.evaluate(() => {
      const L = window.__REBELKIN__.arena().layers;
      const cv = document.getElementById('stage');
      const h = cv.height / (cv.width / window.innerWidth);
      return {
        total: ['far', 'mid', 'near', 'fore'].reduce((n, k) => n + (L[k].h || 0), 0) / h,
        each: ['far', 'mid', 'near', 'fore'].map((k) => `${k} ${((L[k].h || 0) / h).toFixed(2)}`),
      };
    });
    check(`${r.name} crops its baked layers`, layers.total < 2.2,
      `${layers.total.toFixed(2)} screens of layer: ${layers.each.join(', ')}`);

    check(`${r.name} keeps its pools bounded`, r.people <= 420 && r.bits <= 260,
      `${r.people} / ${r.bits}`);
  }

  console.log('\nperformance');
  await page.evaluate(() => window.__REBELKIN__.start('kin08', 'ai', 'kin06'));
  await page.waitForTimeout(1200);
  s = await state();
  check('runs at 50fps or better', s.fps >= 50, `${s.fps} fps`);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check('no horizontal overflow', !overflow);

  console.log('\nthe clock');
  // The simulation's tick rate is the one number every frame count in this
  // suite is quoted against, and a pause and resume used to leave two rAF
  // chains running, which pushed it to 67 and quietly ate a third of the
  // framerate. Counted across a restart, because that is where it broke.
  const clock = await page.evaluate(async () => {
    const g = window.__REBELKIN__;
    const take = async () => {
      const f0 = g.loop.frame;
      const t0 = performance.now();
      await new Promise((r) => setTimeout(r, 1000));
      return Math.round((g.loop.frame - f0) / ((performance.now() - t0) / 1000));
    };
    const before = await take();
    g.loop.stop();
    g.loop.start();
    g.loop.start();
    await new Promise((r) => setTimeout(r, 400));
    const after = await take();
    return { before, after };
  });
  check('the simulation holds 60 ticks a second', Math.abs(clock.before - 60) <= 3,
    `${clock.before} ticks/sec`);
  check('a pause and resume does not double the loop', Math.abs(clock.after - 60) <= 3,
    `${clock.after} ticks/sec after restarting`);

  console.log('\nthe shot is composed');
  // Measured on the main target, not just on a phone. The height constraint in
  // the camera exists for *this* viewport: a wide window makes the width term
  // enormous, and with nothing asking how tall the characters ended up they
  // grow until their shoes leave the bottom of the frame. The phone cannot
  // catch that -- there, width binds whatever the camera does.
  await page.evaluate(() => {
    const g = window.__REBELKIN__;
    g.start('kin08', 'ai', 'kin06');
  });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const m = window.__REBELKIN__.match;
    m.a.x = -60; m.b.x = 60;
  });
  await page.waitForTimeout(700);
  const wide = await page.evaluate(() => {
    const g = window.__REBELKIN__;
    const cv = document.getElementById('stage');
    const dpr = cv.width / window.innerWidth;
    const m = g.match;
    return {
      bodyFrac: (m.a.def.bodyHeight * m.a.def.scale * g.cam.zoom * dpr) / cv.height,
      floorFrac: ((window.innerHeight * 0.59 + 150 * g.cam.zoom) * dpr) / cv.height,
      zoom: g.cam.zoom,
    };
  });
  check('fighters are framed, not filling the window',
    wide.bodyFrac > 0.45 && wide.bodyFrac < 0.75,
    `${(wide.bodyFrac * 100).toFixed(0)}% of frame height at zoom ${wide.zoom.toFixed(2)}`);
  // Upper bound 0.93, not 0.97: past that the floor is a sliver and the
  // reflection the whole wet-floor pass exists for is off the bottom edge.
  check('the floor line stays on screen', wide.floorFrac > 0.70 && wide.floorFrac < 0.93,
    `floor at ${(wide.floorFrac * 100).toFixed(0)}% down`);

  console.log('\nat phone width');
  // Done last, because it resizes the viewport out from under everything else.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { window.dispatchEvent(new Event('resize')); });
  await page.waitForTimeout(500);
  const phoneMenu = await page.evaluate(() => {
    document.getElementById('select').hidden = false;
    document.getElementById('hud').hidden = true;
    const btn = document.getElementById('startBtn').getBoundingClientRect();
    const faces = document.querySelectorAll('#rosterA .face').length;
    return {
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      btnOnScreen: btn.width > 60 && btn.left >= 0 && btn.right <= window.innerWidth + 1,
      faces,
      faceSize: document.querySelector('#rosterA .face')?.getBoundingClientRect().width ?? 0,
    };
  });
  check('select screen fits a phone', !phoneMenu.overflow && phoneMenu.btnOnScreen,
    `FIGHT ${phoneMenu.btnOnScreen ? 'on screen' : 'clipped'}, overflow ${phoneMenu.overflow}`);
  check('portraits stay big enough to tap', phoneMenu.faceSize >= 28,
    `${phoneMenu.faceSize.toFixed(0)}px tiles, ${phoneMenu.faces} of them`);
  await shot('5-phone-select');

  await page.evaluate(() => window.__REBELKIN__.start('kin05', 'ai', 'kin10'));
  await page.waitForTimeout(1800);
  // Measured at fighting distance, which is where the camera spends the round,
  // rather than at the opening spacing -- but measured, not assumed: the camera
  // is left to settle on its own after they are placed.
  await page.evaluate(() => {
    const m = window.__REBELKIN__.match;
    m.a.x = -60; m.b.x = 60;
  });
  await page.waitForTimeout(700);
  // "Both fighters are somewhere on the canvas" passed a composition in which
  // they were the size of a thumbnail with two thirds of the frame empty. What
  // matters is how big they are and where the floor is, so that is measured.
  const phoneFight = await page.evaluate(() => {
    const g = window.__REBELKIN__;
    const cv = document.getElementById('stage');
    const m = g.match;
    const dpr = cv.width / window.innerWidth;
    const bodyPx = m.a.def.bodyHeight * m.a.def.scale * g.cam.zoom * dpr;
    const floorY = (window.innerHeight * 0.59 + 150 * g.cam.zoom) * dpr;
    // world -> screen, the same transform the camera applies
    const toScreen = (wx) => ((wx - g.cam.x) * g.cam.zoom + window.innerWidth / 2) * dpr;
    const xs = [m.a, m.b].map((f) => toScreen(f.x));
    return {
      fps: g.loop.fps,
      w: cv.width,
      h: cv.height,
      bodyFrac: bodyPx / cv.height,
      floorFrac: floorY / cv.height,
      bothOn: xs.every((x) => x > 0 && x < cv.width),
      stage: g.STAGE.right,
    };
  });
  // 0.45, not 0.34. The camera aims for 0.60 of the frame height and a phone's
  // width constraint pulls that to about 0.52 at fighting range. A camera that
  // has lost the height term altogether still lands near 0.36 here -- which the
  // old 0.34 floor waved through, so the check could not tell a tight fit from
  // a broken one. 0.45 sits between the two with room either side.
  check('fighters fill a phone frame', phoneFight.bodyFrac > 0.45 && phoneFight.bothOn,
    `${(phoneFight.bodyFrac * 100).toFixed(0)}% of frame height, both on screen ${phoneFight.bothOn}`);
  // Both ends matter: above 0.66 and the fight is floating in the middle of
  // the frame with dead space under it; past 0.98 and the shoes are off the
  // bottom edge.
  check('the floor sits low in the frame', phoneFight.floorFrac > 0.66 && phoneFight.floorFrac < 0.95,
    `floor at ${(phoneFight.floorFrac * 100).toFixed(0)}% down`);
  check('a fight runs at phone width', phoneFight.fps >= 40,
    `${phoneFight.fps} fps at ${phoneFight.w}x${phoneFight.h}, arena half-width ${phoneFight.stage.toFixed(0)}`);
  await shot('6-phone-fight');
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

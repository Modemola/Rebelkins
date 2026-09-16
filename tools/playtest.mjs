/**
 * Automated playthrough. Drives a real browser through a real contract with
 * real keyboard input -- no teleporting, no state injection. If the mission is
 * unwinnable, or a door's maths is wrong, this fails instead of a human.
 *
 *   node tools/playtest.mjs [--headed] [--shots <dir>]
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8123;
const args = process.argv.slice(2);
const HEADED = args.includes('--headed');
const SHOTS = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;

const { chromium } = await loadPlaywright();

/** Playwright may be a local dep or the globally installed one. Try both. */
async function loadPlaywright() {
  const candidates = ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs'];
  const errs = [];
  for (const c of candidates) {
    try {
      return await import(c);
    } catch (e) {
      errs.push(`${c}: ${e.code || e.message}`);
    }
  }
  throw new Error(`playwright not found\n  ${errs.join('\n  ')}`);
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (p.endsWith('/')) p += 'index.html';
  if (!p.startsWith(ROOT) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(PORT, r));

const browser = await chromium.launch({
  headless: !HEADED,
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 820 } });

const problems = [];
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });

await page.goto(`http://localhost:${PORT}/index.html`);
await page.waitForFunction(() => window.__THREADWAR__);
await page.evaluate(() => { try { localStorage.clear(); } catch {} });

const state = () => page.evaluate(() => {
  const g = window.__THREADWAR__;
  const s = g.scene;
  const name = s?.constructor?.name;
  if (name !== 'MissionScene') return { scene: name };
  return {
    scene: name,
    x: Math.round(s.me.x), y: Math.round(s.me.y),
    thread: s.me.thread.name,
    borrowed: s.me.borrowed ? Math.round(s.me.borrowed.duration - s.me.borrowed.t) : null,
    access: s.accessPacket(s.me).access,
    desire: s.accessPacket(s.me).desirability,
    zone: s.zoneAt(s.me.x, s.me.y)?.id ?? null,
    heat: Math.round(s.heat), heatCap: Math.round(s.heatCap),
    style: Math.round(s.style), flags: s.flags, alerts: s.alerts,
    done: { ...s.done }, armed: !!s.armed, prompt: s.prompt || null,
    failure: s.failure?.code ?? null,
  };
});

const setScene = (name) => page.evaluate((n) => window.__THREADWAR__.scene?.constructor?.name === n, name);

/** Enter the game and deploy Spark on the Ghost Fit contract. */
async function deploy() {
  const box = await page.locator('#stage').boundingBox();
  const click = async (dx, dy) => {
    const X = box.x + (dx / 1280) * box.width;
    const Y = box.y + (dy / 720) * box.height;
    await page.mouse.move(X, Y);
    await page.waitForTimeout(60);
    await page.mouse.click(X, Y);
    await page.waitForTimeout(220);
  };
  await click(640, 371);  // ENTER VESTA
  await click(242, 544);  // DEPLOY (Ghost Fit is selected by default)
  await page.waitForTimeout(400);
}

const KEYS = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' };
let held = new Set();
async function hold(next) {
  for (const k of held) if (!next.has(k)) { await page.keyboard.up(k); }
  for (const k of next) if (!held.has(k)) { await page.keyboard.down(k); }
  held = next;
}
async function release() { await hold(new Set()); }

/** Walk to a point with a simple hold-the-right-keys controller. */
async function walkTo(tx, ty, opts = {}) {
  const { tol = 26, timeout = 22000, label = '' } = opts;
  const t0 = Date.now();
  let last = null;
  let stuck = 0;
  while (Date.now() - t0 < timeout) {
    const s = await state();
    if (s.scene !== 'MissionScene') { await release(); return s; }
    if (s.failure) { await release(); return s; }
    const dx = tx - s.x;
    const dy = ty - s.y;
    if (Math.hypot(dx, dy) < tol) { await release(); return s; }
    if (last && Math.hypot(s.x - last.x, s.y - last.y) < 2) stuck++; else stuck = 0;
    last = s;
    if (stuck > 24) {
      await release();
      throw new Error(`stuck walking to ${label || `${tx},${ty}`} at ${s.x},${s.y}`);
    }
    // A 12 px deadzone cannot thread a 1.5 m stall aisle -- it stops correcting
    // sideways while still pushing forward, and wedges on the rack.
    const dead = opts.dead ?? 5;
    const keys = new Set();
    if (dx > dead) keys.add(KEYS.right); else if (dx < -dead) keys.add(KEYS.left);
    if (dy > dead) keys.add(KEYS.down); else if (dy < -dead) keys.add(KEYS.up);
    await hold(keys);
    await page.waitForTimeout(55);
  }
  await release();
  throw new Error(`timed out walking to ${label || `${tx},${ty}`}`);
}

async function press(key, settle = 140) {
  await page.keyboard.press(key);
  await page.waitForTimeout(settle);
}

async function compile(key, name) {
  await press(key, 100);
  const t0 = Date.now();
  while (Date.now() - t0 < 8000) {
    const s = await state();
    if (s.thread === name) return s;
    await page.waitForTimeout(120);
  }
  throw new Error(`compile to ${name} never finished`);
}

const shot = async (n) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `play-${n}.png`) }); };
const log = (...a) => console.log(...a);

let failed = false;
try {
  await deploy();
  let s = await state();
  if (s.scene !== 'MissionScene') throw new Error(`deploy failed, scene is ${s.scene}`);
  log(`deployed  ${s.thread}  heatCap=${s.heatCap}`);

  // The Lowline terrace: arcade wall down to the river lip, west along the
  // stall band to the shoe altar, then the arched bridge.
  const M = 26;
  const at = (xm, ym) => [xm * M, ym * M];

  // 1. down the terrace, east of the stalls, to the river lip
  await walkTo(...at(46, 45), { label: 'stall band' });
  await walkTo(...at(46, 29), { label: 'river lip' });
  s = await state();
  if (!s.done.lip) throw new Error('river lip objective did not fire');
  log(`\u2713 objective: river lip   heat=${s.heat}/${s.heatCap}`);
  await shot('1-river-lip');

  // 2. west along the south face of the stall band to the shoe altar
  await walkTo(...at(46, 38.6), { label: 'band south face' });
  await walkTo(...at(25.7, 38.4), { tol: 30, label: 'shoe altar' });
  await shot('2-shoe-altar');
  await press('KeyE');
  s = await state();
  if (!s.done.sneaker) throw new Error(`sample sneaker not taken (prompt=${s.prompt})`);
  log(`\u2713 objective: sample sneaker  heat=${s.heat}/${s.heatCap}`);

  // 3. the hoodie tunnel must actually blind the cameras. It is a corridor, so
  //    you enter at an end, not through the racks.
  await walkTo(...at(22.1, 44), { label: 'south of the tunnel' });
  await walkTo(...at(22.1, 43), { tol: 14, dead: 3, label: 'lined up on the throat' });
  await walkTo(...at(22.1, 41), { tol: 18, dead: 3, label: 'tunnel mouth' });
  await walkTo(...at(22.1, 38.5), { tol: 18, dead: 3, label: 'inside the tunnel' });
  const blind = await page.evaluate(() => {
    const sc = window.__THREADWAR__.scene;
    return { inBlind: !!sc.inBlind(sc.me), rate: sc.scanRateFor(sc.me, sc.active) };
  });
  if (!blind.inBlind) throw new Error('hoodie tunnel did not register as a blind volume');
  if (blind.rate !== 0) throw new Error(`cameras still hold lock inside the tunnel (rate ${blind.rate})`);
  log('\u2713 hoodie tunnel: cameras lose lock inside');

  // 4. out and across the Hem
  await walkTo(...at(22.1, 44), { tol: 24, dead: 3, label: 'tunnel exit' });
  await walkTo(...at(50, 39.5), { label: 'band east' });
  await walkTo(...at(62, 30), { label: 'bridge approach' });
  s = await state();
  if (!s.armed) throw new Error('extraction never armed');
  await shot('3-bridge');
  await walkTo(...at(62, 12), { tol: 30, label: 'the Hem' });
  await walkTo(...at(62, 2.2), { tol: 40, timeout: 12000, label: 'far bank' });
  await shot('4-runway-approach');

  // 7. the extraction walk
  const t0 = Date.now();
  let onRunway = false;
  while (Date.now() - t0 < 12000) {
    if (await setScene('RunwayScene')) { onRunway = true; break; }
    const cur = await state();
    if (cur.failure) throw new Error(`failed before the runway: ${cur.failure}`);
    await page.waitForTimeout(150);
  }
  if (!onRunway) throw new Error('never reached the extraction walk');
  log('✓ objective: extraction — on the runway');
  await page.waitForTimeout(1500);
  await shot('5-runway');

  // Actually walk it. Read the beat chart out of the scene and hit each pose on
  // time -- a runway the harness can only flail at proves nothing about scoring.
  const ARROW = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
  const r0 = Date.now();
  while (Date.now() - r0 < 40000) {
    if (await setScene('ResultsScene')) break;
    const beat = await page.evaluate(() => {
      const s = window.__THREADWAR__.scene;
      if (s?.constructor?.name !== 'RunwayScene') return null;
      const next = s.beats.find((b) => !b.judged && b.time > s.t - 0.2);
      return next ? { key: next.pose.key, due: next.time - s.t } : { key: null, due: 99 };
    });
    if (!beat) break;
    if (beat.key && beat.due < 0.045) {
      await page.keyboard.press(ARROW[beat.key]);
    } else {
      await page.waitForTimeout(12);
    }
  }
  if (!(await setScene('ResultsScene'))) throw new Error('runway never resolved to results');
  const out = await page.evaluate(() => {
    const s = window.__THREADWAR__.scene;
    return { ...s.outcome, cred: s.credEarned, traits: s.traitsEarned, unlocked: s.newKin };
  });
  await shot('6-results');
  log(`runway: ${out.perfects} perfect, ${out.misses} missed, fit \u00d7${out.fitMul.toFixed(2)}`);
  log(`\u2713 results: ${out.success ? 'EXTRACTED' : out.code} style=${Math.round(out.style)} `
    + `+${out.cred} cred, +${out.traits} traits, unlocked=${out.unlocked}`);
  if (!out.success) throw new Error(`extraction failed: ${out.code} \u2014 ${out.reason}`);
  if (!out.unlocked) throw new Error('a clean first contract should unlock the next Kin in build order');

  log('\nPLAYTHROUGH PASSED');
} catch (err) {
  failed = true;
  console.error(`\nPLAYTHROUGH FAILED: ${err.message}`);
  try { console.error('state:', JSON.stringify(await state())); } catch { /* gone */ }
  await shot('fail');
} finally {
  if (problems.length) {
    console.error(`\n${problems.length} runtime problem(s):`);
    for (const p of problems.slice(0, 10)) console.error('  ' + p);
    failed = true;
  } else {
    log('no runtime errors');
  }
  await browser.close();
  server.close();
  process.exit(failed ? 1 : 0);
}

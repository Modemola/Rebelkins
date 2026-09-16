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
async function walkTo(tx, ty, { tol = 26, timeout = 22000, label = '' } = {}) {
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
    const keys = new Set();
    if (dx > 12) keys.add(KEYS.right); else if (dx < -12) keys.add(KEYS.left);
    if (dy > 12) keys.add(KEYS.down); else if (dy < -12) keys.add(KEYS.up);
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
  log(`deployed  thread=${s.thread} heatCap=${s.heatCap}`);

  // 1. cross the market to the members door
  await walkTo(300, 110, { label: 'market north' });
  await walkTo(800, 110, { label: 'market east' });
  await walkTo(800, 500, { label: 'door approach' });
  await shot('1-door-approach');

  // 2. the loud thread is the key: be too interesting to refuse
  s = await compile('KeyC', 'Too Much');
  log(`compiled Too Much  access=${s.access} desire=${s.desire}`);
  await walkTo(1000, 500, { label: 'members floor' });
  s = await state();
  if (!s.done.lounge) throw new Error(`members floor did not open (access ${s.access}, desire ${s.desire})`);
  log(`✓ objective: members floor   heat=${s.heat}/${s.heatCap}`);
  await shot('2-lounge');

  // 3. the rack is the second key
  await walkTo(1120, 330, { label: 'lounge rack' });
  await press('KeyE');
  s = await state();
  if (!s.borrowed) throw new Error('rack did not lend a piece');
  log(`✓ borrowed the floor's stock (${s.borrowed}s)  access=${s.access}`);

  // 4. drop the loud thread now the door is behind us
  s = await compile('KeyZ', 'Matchhead');
  log(`back to Matchhead  access=${s.access} desire=${s.desire} heat=${s.heat}`);

  // 5. down to the vault
  await walkTo(1060, 560, { label: 'stairs' });
  await walkTo(1060, 760, { label: 'corridor' });
  await walkTo(1300, 960, { label: 'vault door' });
  await walkTo(1500, 960, { label: 'vault' });
  await walkTo(1730, 960, { tol: 40, label: 'prototype' });
  await shot('3-vault');
  await press('KeyE');
  s = await state();
  if (!s.done.jacket) throw new Error(`prototype not taken (prompt=${s.prompt}, access=${s.access})`);
  log(`✓ objective: prototype jacket  heat=${s.heat}/${s.heatCap}`);

  // 6. the long walk back out
  await walkTo(1300, 960, { label: 'vault exit' });
  await walkTo(1060, 760, { label: 'corridor back' });
  await walkTo(1060, 560, { label: 'stairs back' });
  await walkTo(960, 500, { label: 'lounge back' });
  await walkTo(830, 500, { label: 'market back' });
  await walkTo(820, 1000, { label: 'market south' });
  await walkTo(400, 1060, { label: 'runway approach' });
  s = await state();
  if (!s.armed) throw new Error('extraction never armed');
  await walkTo(160, 1085, { tol: 40, timeout: 12000, label: 'runway' });
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

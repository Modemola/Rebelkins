/**
 * Capture a real fight, at the moments that matter.
 *
 * A screenshot taken on a timer almost always catches a fighter standing in
 * neutral -- which is how "do the characters even swing?" went unanswered for
 * so long. This hooks the match's own event stream instead and grabs the
 * canvas on the frames where something actually connects, so every tile in the
 * strip is an impact, a guard or a break rather than a pose.
 *
 *   node tools/fightshots.mjs [--a kin05] [--b kin10] [--shots 6] [--out f.png]
 *   node tools/fightshots.mjs --pairs kin01:kin02,kin03:kin04 [--shots 2]
 *
 * `--pairs` runs several matchups in one browser and tiles them together,
 * which is how the whole roster gets looked at in one picture rather than ten.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (f, d) => (process.argv.includes(f) ? process.argv[process.argv.indexOf(f) + 1] : d);
const A = arg('--a', 'kin05');
const B = arg('--b', 'kin10');
const SHOTS = Number(arg('--shots', 6));
const OUT = arg('--out', 'fight.png');

const { chromium } = await load();
async function load() {
  for (const c of ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs']) {
    try { return await import(c); } catch { /* next */ }
  }
  throw new Error('playwright not found');
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (p.endsWith('/')) p += 'index.html';
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
const port = await new Promise((resolve, reject) => {
  let p = 8560;
  const attempt = () => {
    server.once('error', (e) => (e.code === 'EADDRINUSE' && p < 8590 ? (p++, attempt()) : reject(e)));
    server.listen(p, () => resolve(p));
  };
  attempt();
});

const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1 });
page.on('console', (m) => { if (m.type() === 'error') console.error('page:', m.text()); });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__REBELKIN__ && Object.keys(window.__REBELKIN__.rigs).length === 10, { timeout: 30000 });

// Both corners driven by the AI, so it is the game playing itself rather than
// a scripted set-piece: P2 by the opponent AI the game ships with, P1 by a
// second instance of it wired into the same intent the keyboard would produce.
const PAIRS = process.argv.includes('--pairs')
  ? arg('--pairs', '').split(',').map((p) => p.split(':'))
  : [[A, B]];

const frames = [];
for (const [a, b] of PAIRS) {
  await page.evaluate(({ a: x, b: y }) => { window.__REBELKIN__.start(x, 'ai', y); }, { a, b });
  await page.waitForTimeout(1800);
  const got = await page.evaluate(async ({ shots }) => {
    const g = window.__REBELKIN__;
    const { AI } = await import('/src/fight/ai.js');
    const p1 = new AI('mean');
    const cv = document.getElementById('stage');
    const out = [];
    let grab = 0;
    let label = '';
    // Taking the first N contacts gets N jabs: a fight opens with pokes, and
    // the committal moves only come out once somebody has a reason to throw
    // one. So each kind of contact is taken once before any is taken twice,
    // which is what makes the sheet show the moveset rather than the opener.
    // `patience` is how long to hold out for something new before settling.
    const seen = new Set();
    let patience = 0;

    g.match.onEvent = ((prev) => (kind, data) => {
      prev(kind, data);
      if (out.length + (grab > 0 ? 1 : 0) >= shots) return;
      if (kind !== 'hit' && kind !== 'guardBreak') return;
      const key = kind === 'guardBreak' ? 'guardBreak' : `${data.move.name}:${data.attacker.pad}`;
      if (seen.has(key) && patience > 0) return;
      seen.add(key);
      // two frames after contact: past the hitstop freeze, with the sparks out
      grab = 2;
      label = kind === 'guardBreak' ? 'guard break'
        : `${data.move.label} — ${data.move.damage}${data.counter === 'recovery' ? ' (punish)' : ''}`;
    })(g.match.onEvent);

    // P1 is normally the keyboard, and readIntent is module-local, so rather
    // than reach past it the AI's intent is turned back into real key events.
    // That drives the fight through the same input layer a player uses --
    // buffer, held state and all -- instead of around it.
    const KEYS = { left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS',
      light: 'KeyJ', heavy: 'KeyK', special: 'KeyL', guard: 'Space' };
    const held = new Set();
    const set = (code, want) => {
      if (want === held.has(code)) return;
      if (want) held.add(code); else held.delete(code);
      dispatchEvent(new KeyboardEvent(want ? 'keydown' : 'keyup', { code, bubbles: true }));
    };
    const tap = (code) => {
      dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
      setTimeout(() => dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true })), 34);
    };

    for (let i = 0; i < 3600 && out.length < shots; i++) {
      patience = i < 2600 ? 1 : 0;   // past this, any contact will do
      const m = g.match;
      if (m && m.phase === 'fight') {
        const it = p1.think(m.a, m.b, i);
        set(KEYS.left, it.move < 0);
        set(KEYS.right, it.move > 0);
        set(KEYS.guard, !!it.guard);
        set(KEYS.down, !!it.crouch);
        if (it.jump) tap(KEYS.up);
        if (it.attack) tap(KEYS[it.attack]);
      }
      await new Promise((r) => requestAnimationFrame(r));
      if (grab > 0 && --grab === 0) out.push({ png: cv.toDataURL('image/png'), label });
    }
    for (const c of held) dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }));
    return out;
  }, { shots: SHOTS });
  for (const f of got) frames.push({ ...f, pair: `${a.toUpperCase()} vs ${b.toUpperCase()}` });
  console.log(`  ${a} vs ${b}: ${got.length} frames`);
}

console.log(`captured ${frames.length} impact frames`);
if (!frames.length) { await browser.close(); server.close(); process.exit(1); }

const sheet = await page.evaluate(async ({ frames }) => {
  const imgs = await Promise.all(frames.map(async (f) => {
    const im = new Image(); im.src = f.png; await im.decode(); return im;
  }));
  const cols = Math.min(2, imgs.length);
  const rows = Math.ceil(imgs.length / cols);
  const W = 640, H = 380, pad = 26;
  const cv = document.createElement('canvas');
  cv.width = cols * W;
  cv.height = rows * (H + pad) + 34;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#15121c';
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.font = '700 15px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = '#efeaf7';
  ctx.fillText('REBELKIN', 16, 24);
  imgs.forEach((im, i) => {
    const x = (i % cols) * W;
    const y = 34 + Math.floor(i / cols) * (H + pad);
    ctx.drawImage(im, x, y, W, H);
    ctx.font = '600 13px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = '#8d87a0';
    ctx.fillText(frames[i].pair || '', x + 12, y + H + 17);
    ctx.fillStyle = '#f5c518';
    ctx.fillText(frames[i].label, x + 150, y + H + 17);
  });
  return cv.toDataURL('image/png');
}, { frames });

fs.writeFileSync(path.resolve(ROOT, OUT), Buffer.from(sheet.split(',')[1], 'base64'));
console.log(`wrote ${OUT}`);
await browser.close();
server.close();

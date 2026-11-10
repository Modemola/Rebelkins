/**
 * Where is the body, and where is the box it gets hit in?
 *
 * `Fighter.hurtbox` centres an ellipse on the root pivot. That is an
 * assumption about the artwork, not a fact about it: nothing makes a drawing
 * sit centred over the point its rig hangs from, and the root is placed by
 * hand when a character is rigged. This renders each fighter through the same
 * Rig.draw the game uses, over idle, walk and guard, and weighs the alpha
 * inside the ellipse's own vertical band -- so the answer is in pixels rather
 * than in the part rects, whose transparent corners make a figure look half
 * again as wide as it is drawn.
 *
 * It prints an offset per character and nothing else. There is no pass mark,
 * because the honest threshold is not known: the whole signal is about 12px,
 * and nothing says what fraction of a 33px radius is too much. Read it beside
 * the note on `hurtbox`, which records what it said when the cast was ten
 * front-facing characters and two side-on ones, and re-run it as the side-view
 * pass lands -- a bladed stance puts the lead foot forward of the torso, which
 * is the one thing seen to move the body off its root.
 *
 * Only non-attacking poses count. An attacking arm crosses the band and
 * belongs to the hitbox, not to the body, and the hurtbox matters most for the
 * fighter who is standing, walking or holding guard.
 *
 * Measured through the cut-out stack, not the mesh: where WebGL is software
 * the skinner switches itself off, which is what the game does on such a
 * machine too. The mesh closes the seams between parts, it does not move the
 * silhouette, so the body's centre is the same either way.
 *
 *   node tools/hurtfit.mjs
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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
  let p = 8610;
  const attempt = () => {
    server.once('error', (e) => (e.code === 'EADDRINUSE' && p < 8630 ? (p++, attempt()) : reject(e)));
    server.listen(p, () => resolve(p));
  };
  attempt();
});

const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
page.on('console', (m) => { if (m.type() === 'error') console.error('page:', m.text()); });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
// Against the roster, not a literal: a count of 10 here hung for thirty
// seconds the first time a character was added.
const { IDS, SIDE_IDS } = await import('./spar.mjs');
await page.waitForFunction((n) => window.__REBELKIN__ && Object.keys(window.__REBELKIN__.rigs).length === n,
  IDS.length, { timeout: 30000 });

const rows = await page.evaluate(({ ids }) => {
  const g = window.__REBELKIN__;
  const W = 1000; const H = 760; const BASE = 700;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const out = [];
  for (const id of ids) {
    const def = g.ROSTER.find((d) => d.id === id);
    const rig = g.rigs[id];
    const s = def.stance;
    const poses = [];
    for (let f = 0; f < 48; f += 6) poses.push(s.idle(f), s.walk(f, 1), s.block(f));

    // the ellipse Fighter.hurtbox would build, in these same units
    const h = def.bodyHeight * def.scale;
    const top = BASE - h;
    const ry = h * 0.46;
    const rx = def.hurtRadius * def.scale;
    const y0 = Math.max(0, Math.round(top + h * 0.52 - ry));
    const y1 = Math.min(H - 1, Math.round(top + h * 0.52 + ry));

    const samples = [];
    for (const pose of poses) {
      ctx.clearRect(0, 0, W, H);
      rig.draw(ctx, rig.solve(pose, { x: W / 2, y: BASE, scale: def.scale, facing: 1 }));
      const px = ctx.getImageData(0, y0, W, y1 - y0 + 1).data;
      let sum = 0; let n = 0; let lo = Infinity; let hi = -Infinity;
      for (let y = 0; y <= y1 - y0; y++) {
        for (let x = 0; x < W; x++) {
          // 40, not 0: the cut-outs carry a soft edge, and counting every
          // faintly-tinted pixel pulls the centre toward whichever side has
          // the longer feathered hem.
          if (px[(y * W + x) * 4 + 3] > 40) {
            const dx = x - W / 2;
            sum += dx; n++;
            if (dx < lo) lo = dx;
            if (dx > hi) hi = dx;
          }
        }
      }
      if (n) samples.push({ mid: sum / n, lo, hi });
    }
    const avg = (f) => samples.reduce((a, b) => a + f(b), 0) / samples.length;
    out.push({ id, rx, mid: avg((v) => v.mid), lo: avg((v) => v.lo), hi: avg((v) => v.hi) });
  }
  return out;
}, { ids: IDS });

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
console.log('        ink in the band, from the root      ellipse    body centre,');
console.log('        behind     ahead     centre         radius     as % of radius');
for (const r of rows) {
  console.log(`${SIDE_IDS.includes(r.id) ? '*' : ' '}${r.id.padEnd(7)}`
    + `${(-r.lo).toFixed(0).padStart(6)}${r.hi.toFixed(0).padStart(10)}`
    + `${r.mid.toFixed(0).padStart(11)}${r.rx.toFixed(0).padStart(15)}`
    + `${(Math.abs(r.mid) / r.rx * 100).toFixed(0).padStart(13)}%`);
}
const front = rows.filter((r) => !SIDE_IDS.includes(r.id));
const side = rows.filter((r) => SIDE_IDS.includes(r.id));
console.log(`\nthe ellipse sits on the root. the body's centre of mass sits`);
console.log(`  ${Math.max(...rows.map((r) => r.mid)).toFixed(0)}px ahead of it to `
  + `${(-Math.min(...rows.map((r) => r.mid))).toFixed(0)}px behind, against radii of `
  + `${Math.min(...rows.map((r) => r.rx)).toFixed(0)}-${Math.max(...rows.map((r) => r.rx)).toFixed(0)}px`);
console.log(`  front-facing ${mean(front.map((r) => Math.abs(r.mid))).toFixed(0)}px on average, `
  + `side-on ${mean(side.map((r) => Math.abs(r.mid))).toFixed(0)}px (${side.length} character${side.length === 1 ? '' : 's'})`);
console.log(`  furthest off: ${rows.reduce((a, b) => (Math.abs(b.mid) > Math.abs(a.mid) ? b : a)).id}`);

await browser.close();
server.close();

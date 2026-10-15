/**
 * Swing a single part and look at it.
 *
 * Cutting a limb out of a drawing is a guess until you see it move: a forearm
 * that looks clean in the atlas can read as a broken doll the moment it leaves
 * the pose it was drawn in. This renders one built rig at a series of
 * rotations for one part, side by side, through the same Rig.solve and
 * Rig.draw the game uses -- so the question "does this read as a punch?" gets
 * answered by looking rather than by argument.
 *
 *   node tools/armtry.mjs <builtDir> <part> [--rots "0,-0.4,-0.8,-1.2"]
 *                         [--out f.png] [--cell 240x340] [--facing 1]
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [builtDir, partName] = process.argv.slice(2);
const arg = (f, d) => (process.argv.includes(f) ? process.argv[process.argv.indexOf(f) + 1] : d);
if (!builtDir || !partName) {
  console.error('usage: node tools/armtry.mjs <builtDir> <part> [--rots "..."] [--out f.png]');
  process.exit(1);
}
const ROTS = arg('--rots', '0,-0.35,-0.7,-1.05,-1.4').split(',').map(Number);
const OUT = arg('--out', 'armtry.png');
const [CW, CH] = arg('--cell', '240x340').split('x').map(Number);
const FACING = Number(arg('--facing', '1'));
const BUILT = path.resolve(builtDir);

const { chromium } = await load();
async function load() {
  for (const c of ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs']) {
    try { return await import(c); } catch { /* next */ }
  }
  throw new Error('playwright not found');
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
const serve = (base, rel, res) => {
  const p = path.join(base, rel);
  if (!p.startsWith(base) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
};
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url.startsWith('/built/')) return serve(BUILT, url.slice(7), res);
  if (url === '/') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end('<!doctype html><meta charset=utf-8><body style="margin:0;background:#15121c">'); }
  return serve(ROOT, url, res);
});
const port = await new Promise((resolve, reject) => {
  let p = 8490;
  const attempt = () => {
    server.once('error', (e) => (e.code === 'EADDRINUSE' && p < 8510 ? (p++, attempt()) : reject(e)));
    server.listen(p, () => resolve(p));
  };
  attempt();
});

const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
page.on('console', (m) => { if (m.type() === 'error') console.error('page:', m.text()); });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });

const png = await page.evaluate(async ({ rots, partName, CW, CH, FACING }) => {
  const { Rig } = await import('/src/render/rig.js');
  const manifest = await (await fetch('/built/rig.json')).json();
  const img = new Image();
  img.src = '/built/atlas.png';
  await img.decode();
  const rig = new Rig(manifest, img);

  const cv = document.createElement('canvas');
  cv.width = rots.length * CW;
  cv.height = CH + 30;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#15121c';
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.font = '600 12px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'center';

  // Fit the whole character in a cell. The height is measured off the parts
  // themselves -- the topmost part's top edge up from the ground line -- rather
  // than guessed from the ground value, which assumed every cutout carried the
  // same margin above the head and silently beheaded any that did not.
  const top = Math.min(...manifest.parts.map((p) => p.origin[1] - p.pivot[1]));
  const scale = (CH - 40) / Math.max(1, manifest.ground[1] - top);
  rots.forEach((rot, i) => {
    const pose = { [partName]: { rot } };
    const M = rig.solve(pose, {
      x: i * CW + CW / 2, y: CH - 12, scale, facing: FACING,
    });
    rig.draw(ctx, M);
    ctx.fillStyle = Math.abs(rot) < 1e-6 ? '#8d87a0' : '#f5c518';
    ctx.fillText(`${partName} rot ${rot}`, i * CW + CW / 2, CH + 20);
  });
  return cv.toDataURL('image/png');
}, { rots: ROTS, partName, CW, CH, FACING });

fs.writeFileSync(path.resolve(ROOT, OUT), Buffer.from(png.split(',')[1], 'base64'));
console.log(`wrote ${OUT}  (${partName} at ${ROTS.join(', ')})`);
await browser.close();
server.close();

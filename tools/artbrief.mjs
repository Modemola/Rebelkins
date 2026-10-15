/**
 * The art brief, drawn rather than written.
 *
 * Five of the ten illustrations have no separable arms: the hands are inside a
 * coat or folded across the chest, so there is nothing to cut and no animation
 * can give those characters a punch. A cut forearm can be made to move -- it
 * was tried -- but these are drawn front-on, and a flat cut-out arm can only
 * sweep in the screen plane, so it reads as a raised forearm rather than a
 * strike.
 *
 * This lays each character beside what is missing, so the ask is one picture
 * per character rather than a paragraph per character.
 *
 *   node tools/artbrief.mjs [--out artbrief.png]
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (f, d) => (process.argv.includes(f) ? process.argv[process.argv.indexOf(f) + 1] : d);
const OUT = arg('--out', 'artbrief.png');

const ROWS = [
  { file: '4.png', name: 'KIN 04', sub: 'ghost', need: 'needed',
    now: 'Hands fully inside the coat. No arm pixels at all.',
    ask: 'Same coat, one arm punched straight out to the side, sleeve and fist clear of the body.' },
  { file: '5.png', name: 'KIN 05', sub: 'kickboxer', need: 'needed',
    now: 'Forearms crossed. Cuttable, but only sweeps up and down.',
    ask: 'One bare arm extended sideways, fist closed, daylight between arm and torso.' },
  { file: '6.png', name: 'KIN 06', sub: '', need: 'needed',
    now: 'Arms folded, gloved hands tucked under the elbows.',
    ask: 'One gloved fist thrown out sideways, jacket sleeve following it.' },
  { file: '7.png', name: 'KIN 07', sub: '', need: 'needed',
    now: 'Arms folded across the chest, rings on the fingers.',
    ask: 'One purple sleeve extended sideways, hand open or closed, clear of the locs.' },
  { file: '10.png', name: 'KIN 10', sub: '', need: 'needed',
    now: 'Arms folded inside the puffer. Sleeves visible, hands mostly not.',
    ask: 'One puffer sleeve punched out sideways with the hand past the cuff.' },
  { file: '2.png', name: 'KIN 02', sub: '', need: 'nice to have',
    now: 'Has a right arm already. The left is merged into the body.',
    ask: 'Only if easy: the left arm clear of the torso, so both sides can throw.' },
  { file: '9.png', name: 'KIN 09', sub: '', need: 'nice to have',
    now: 'Has a right arm already. The left is merged into the body.',
    ask: 'Only if easy: the left arm clear of the torso.' },
];

const { chromium } = await load();
async function load() {
  for (const c of ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs']) {
    try { return await import(c); } catch { /* next */ }
  }
  throw new Error('playwright not found');
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end('<!doctype html><meta charset=utf-8><body style=margin:0>'); }
  const p = path.join(ROOT, url);
  if (!p.startsWith(ROOT) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
const port = await new Promise((resolve, reject) => {
  let p = 8520;
  const attempt = () => {
    server.once('error', (e) => (e.code === 'EADDRINUSE' && p < 8540 ? (p++, attempt()) : reject(e)));
    server.listen(p, () => resolve(p));
  };
  attempt();
});

const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });

const png = await page.evaluate(async (rows) => {
  const RH = 190, PAD = 24, IW = 170, W = 1180;
  const head = 108;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = head + rows.length * RH + 20;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#15121c';
  ctx.fillRect(0, 0, cv.width, cv.height);

  ctx.fillStyle = '#efeaf7';
  ctx.font = '700 25px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText('REBELKIN — one picture per character', PAD, 46);
  ctx.font = '13px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = '#9b94ab';
  ctx.fillText('Same character, same outfit, same lighting. One arm punched straight out SIDEWAYS (not toward camera), fist past the body outline,', PAD, 72);
  ctx.fillText('a visible gap between arm and torso. Transparent background. Any size. I mirror it, so either side is fine.', PAD, 92);

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const y = head + i * RH;
    if (i % 2 === 0) { ctx.fillStyle = 'rgba(255,255,255,.028)'; ctx.fillRect(0, y, W, RH); }

    const img = new Image();
    img.src = `/assets/cutouts/${r.file}`;
    await img.decode();
    const s = Math.min(IW / img.width, (RH - 16) / img.height);
    ctx.drawImage(img, PAD + (IW - img.width * s) / 2, y + 8, img.width * s, img.height * s);

    const tx = PAD + IW + 26;
    ctx.font = '700 17px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = '#efeaf7';
    ctx.fillText(r.name, tx, y + 36);
    const badge = r.need === 'needed' ? ['#ff4d6d', 'NEEDED'] : ['#6f6a7d', 'NICE TO HAVE'];
    ctx.font = '700 10px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = badge[0];
    ctx.fillText(badge[1], tx + 86, y + 36);

    ctx.font = '13px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = '#8d87a0';
    ctx.fillText(`now:  ${r.now}`, tx, y + 68);
    ctx.fillStyle = '#f5c518';
    ctx.fillText(`send: ${r.ask}`, tx, y + 94);

    ctx.strokeStyle = 'rgba(255,255,255,.07)';
    ctx.beginPath();
    ctx.moveTo(PAD, y + RH - 1);
    ctx.lineTo(W - PAD, y + RH - 1);
    ctx.stroke();
  }
  return cv.toDataURL('image/png');
}, ROWS);

fs.writeFileSync(path.resolve(ROOT, OUT), Buffer.from(png.split(',')[1], 'base64'));
console.log(`wrote ${OUT}`);
await browser.close();
server.close();

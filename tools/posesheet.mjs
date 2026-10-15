/**
 * A contact sheet of every pose in the game.
 *
 * "Are the characters actually swinging?" is a question about pixels, and the
 * fight screenshots are a bad way to answer it: they are captured at scripted
 * moments and most of them catch a fighter standing in neutral. This renders
 * the thing being asked about directly -- every character, every move, at the
 * wind-up, at the frame the hitbox is live, and on the way back -- with no
 * camera, no arena and no timing involved, straight through the same
 * Rig.solve and Rig.draw the game uses.
 *
 * It also makes the limitation visible: a character whose illustration has no
 * separable arms has no arms in its rig, and no animation can give it a
 * punch. Five of the ten are in that position, and they are easy to spot here.
 *
 *   node tools/posesheet.mjs [--out <file.png>] [--cell 220x300]
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const OUT = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'posesheet.png';
const CELL = args.includes('--cell') ? args[args.indexOf('--cell') + 1] : '230x320';
const [CW, CH] = CELL.split('x').map(Number);

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
  let p = 8460;
  const attempt = () => {
    server.once('error', (e) => (e.code === 'EADDRINUSE' && p < 8480 ? (p++, attempt()) : reject(e)));
    server.listen(p, () => resolve(p));
  };
  attempt();
});

const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
page.on('console', (m) => { if (m.type() === 'error') console.error('page:', m.text()); });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__REBELKIN__ && Object.keys(window.__REBELKIN__.rigs).length === 10, { timeout: 30000 });

const sheet = await page.evaluate(async ({ CW, CH }) => {
  const g = window.__REBELKIN__;
  const roster = g.ROSTER;
  const slots = ['light', 'heavy', 'special'];
  // stance, then three phases of each move: the wind-up, the frame the hitbox
  // is live, and partway back through the recovery.
  const cols = 1 + slots.length * 3;
  const pad = 46;
  const cv = document.createElement('canvas');
  cv.width = cols * CW;
  cv.height = roster.length * CH + pad;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#15121c';
  ctx.fillRect(0, 0, cv.width, cv.height);

  // column headings
  ctx.font = '600 13px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'center';
  const heads = ['stance'];
  for (const s of slots) heads.push(`${s} wind`, `${s} CONTACT`, `${s} back`);
  heads.forEach((h, i) => {
    ctx.fillStyle = h.includes('CONTACT') ? '#f5c518' : '#8d87a0';
    ctx.fillText(h, i * CW + CW / 2, 28);
  });

  const labels = [];
  for (let r = 0; r < roster.length; r++) {
    const def = roster[r];
    const rig = g.rigs[def.id];
    const y0 = pad + r * CH;
    if (r % 2) { ctx.fillStyle = 'rgba(255,255,255,.025)'; ctx.fillRect(0, y0, cv.width, CH); }

    const cell = (col, pose) => {
      const M = rig.solve(pose, {
        x: col * CW + CW / 2,
        y: y0 + CH - 26,
        scale: def.scale * 0.52,
        facing: 1,
      });
      ctx.save();
      // a guide line for the floor, so a kick that lifts a leg is obvious
      ctx.strokeStyle = 'rgba(255,255,255,.10)';
      ctx.beginPath();
      ctx.moveTo(col * CW + 16, y0 + CH - 26);
      ctx.lineTo(col * CW + CW - 16, y0 + CH - 26);
      ctx.stroke();
      rig.draw(ctx, M);
      ctx.restore();
    };

    cell(0, def.stance.idle(0));
    slots.forEach((slot, i) => {
      const m = def.moves[slot];
      if (!m) return;
      const total = m.startup + m.active + m.recovery;
      const frames = [
        Math.max(0, Math.round(m.startup * 0.6)),      // wound up
        m.startup + Math.max(0, m.active - 1),          // hitbox live
        Math.min(total - 1, m.startup + m.active + Math.round(m.recovery * 0.35)),
      ];
      frames.forEach((f, k) => cell(1 + i * 3 + k, m.pose(f, m)));
    });

    const arms = def.rig.parts.filter((p) => p.name === 'armL' || p.name === 'armR').map((p) => p.name);
    labels.push({
      y: y0 + 18,
      name: def.name,
      note: arms.length ? `${arms.length} arm${arms.length > 1 ? 's' : ''} in the rig` : 'no arms in the rig',
      strikes: slots.map((s) => def.moves[s] && def.moves[s].strikePart).join(' / '),
      warn: arms.length === 0,
    });
  }

  // names last, so they sit over the art
  ctx.textAlign = 'left';
  for (const l of labels) {
    ctx.fillStyle = 'rgba(21,18,28,.72)';
    ctx.fillRect(4, l.y - 13, 206, 36);
    ctx.font = '700 13px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = '#efeaf7';
    ctx.fillText(l.name, 10, l.y);
    ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = l.warn ? '#ff8da1' : '#8d87a0';
    ctx.fillText(`${l.note} - strikes ${l.strikes}`, 10, l.y + 16);
  }
  return cv.toDataURL('image/png');
}, { CW, CH });

fs.writeFileSync(path.resolve(ROOT, OUT), Buffer.from(sheet.split(',')[1], 'base64'));
console.log(`wrote ${OUT}`);
await browser.close();
server.close();

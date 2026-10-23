/**
 * Watch a move actually move.
 *
 * Every judgement in this project up to now was made from still frames: the
 * pose sheet samples three moments of a move and the fight capture grabs the
 * frame a hit lands on. Stills tell you whether a pose is right. They tell you
 * nothing about whether the motion is any good, because that lives entirely in
 * the timing and spacing between frames -- and "stiff" is a complaint about
 * exactly the thing stills cannot show. This renders every frame, in order,
 * through the same Rig.solve and Rig.draw the game uses, and hands it to
 * ffmpeg as a GIF.
 *
 *   node tools/anim.mjs <id> <slot|idle|walk|block> [--out f.gif] [--fps 30]
 *                       [--pad 16] [--cell 320x420] [--onion]
 *
 * `--fps` is the playback rate; the simulation is always 60, so the default 30
 * is half speed, which is how you look at timing. `--onion` draws the previous
 * frames behind the current one, so the spacing between them is visible in a
 * single picture -- wide gaps are fast, bunched ones are slow, and evenly
 * spaced ones are the machine-like motion that reads as stiff.
 */

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [ID, WHAT] = process.argv.slice(2);
const arg = (f, d) => (process.argv.includes(f) ? process.argv[process.argv.indexOf(f) + 1] : d);
const OUT = arg('--out', `${ID}-${WHAT}.gif`);
const FPS = Number(arg('--fps', 30));
const PAD = Number(arg('--pad', 16));
const ONION = process.argv.includes('--onion');
const SKIN = process.argv.includes('--skin');
const [CW, CH] = arg('--cell', '320x420').split('x').map(Number);

if (!ID || !WHAT) {
  console.error('usage: node tools/anim.mjs <id> <slot|idle|walk|block> [--out f.gif] [--fps 30] [--onion]');
  process.exit(1);
}

const { chromium } = await load();
async function load() {
  for (const c of ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs']) {
    try { return await import(c); } catch { /* next */ }
  }
  throw new Error('playwright not found');
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (req.url === '/') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end('<!doctype html><meta charset=utf-8><body style="margin:0">'); }
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
const port = await new Promise((resolve, reject) => {
  let p = 8640;
  const attempt = () => {
    server.once('error', (e) => (e.code === 'EADDRINUSE' && p < 8680 ? (p++, attempt()) : reject(e)));
    server.listen(p, () => resolve(p));
  };
  attempt();
});

const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader'] });
const page = await browser.newPage({ viewport: { width: CW, height: CH }, deviceScaleFactor: 1 });
page.on('console', (m) => { if (m.type() === 'error') console.error('page:', m.text()); });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });

const frames = await page.evaluate(async ({ id, what, pad, CW, CH, onion, skin }) => {
  const { Rig } = await import('/src/render/rig.js');
  const def = (await import(`/src/data/${id}.js`))[id.toUpperCase()];
  const img = await new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = `/${def.atlas}`; });
  const rig = new Rig(def.rig, img);

  // With --skin the same solved bones drive a skinned mesh over the whole
  // illustration instead of the cut-out stack, which is the only way to see
  // whether a joint actually bends rather than coming apart.
  let skinner = null;
  let mesh = null;
  let sheet = null;
  if (skin) {
    const { Skinner } = await import('/src/render/skin.js');
    mesh = await (await fetch(`/meshes/v2/${id}.json`)).json();
    sheet = await new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = `/${mesh.texture}`; });
    skinner = new Skinner();
    if (!skinner.ok) throw new Error('no webgl');
  }

  // Idle either side of the move, so the entry and the settle are visible --
  // a move that snaps back to a dead neutral is most of what reads as stiff.
  const m = def.moves[what];
  const total = m ? m.startup + m.active + m.recovery : 120;
  const poses = [];
  if (m) {
    for (let f = 0; f < pad; f++) poses.push({ pose: def.stance.idle(f / 60), tag: 'idle' });
    for (let f = 0; f < total; f++) {
      poses.push({ pose: m.pose(f, m), tag: f < m.startup ? 'wind' : f < m.startup + m.active ? 'ACTIVE' : 'rec' });
    }
    for (let f = 0; f < pad + 10; f++) poses.push({ pose: def.stance.idle((pad + total + f) / 60), tag: 'idle' });
  } else {
    for (let f = 0; f < total; f++) {
      const t = f / 60;
      poses.push({ pose: what === 'walk' ? def.stance.walk(t, 1) : what === 'block' ? def.stance.block(t) : def.stance.idle(t), tag: what });
    }
  }

  const cv = document.createElement('canvas');
  cv.width = CW; cv.height = CH;
  const ctx = cv.getContext('2d');
  const place = { x: CW * 0.42, y: CH - 28, scale: def.scale * (CH / 520), facing: 1 };
  const out = [];
  for (let i = 0; i < poses.length; i++) {
    ctx.fillStyle = '#15121c';
    ctx.fillRect(0, 0, CW, CH);
    ctx.strokeStyle = '#2e2a36';
    ctx.beginPath(); ctx.moveTo(0, place.y); ctx.lineTo(CW, place.y); ctx.stroke();
    if (onion) {
      for (let k = Math.max(0, i - 7); k < i; k++) {
        if (skinner) skinner.draw(ctx, [{ id, mesh, image: sheet, matrices: rig.solve(poses[k].pose, place), alpha: 0.13 }]);
        else rig.draw(ctx, rig.solve(poses[k].pose, place), { alpha: 0.13 });
      }
    }
    if (skinner) skinner.draw(ctx, [{ id, mesh, image: sheet, matrices: rig.solve(poses[i].pose, place) }]);
    else rig.draw(ctx, rig.solve(poses[i].pose, place), {});
    ctx.font = '600 13px ui-monospace, monospace';
    ctx.fillStyle = poses[i].tag === 'ACTIVE' ? '#f5c518' : '#8d87a0';
    ctx.fillText(`${String(i).padStart(3)}  ${poses[i].tag}`, 12, 22);
    out.push(cv.toDataURL('image/png'));
  }
  return out;
}, { id: ID, what: WHAT, pad: PAD, CW, CH, onion: ONION, skin: SKIN });

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rebelkin-anim-'));
frames.forEach((d, i) => {
  fs.writeFileSync(path.join(dir, `f${String(i).padStart(4, '0')}.png`), Buffer.from(d.split(',')[1], 'base64'));
});

// A .png output is the contact sheet rather than the animation: every frame
// tiled in order. A GIF is the thing to send someone; this is the thing to
// read, because spacing on the page is speed in the playback.
if (OUT.endsWith('.png')) {
  const cols = Number(arg('--cols', 10));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(dir, 'f%04d.png'),
    '-vf', `scale=iw/2:ih/2,tile=${cols}x${Math.ceil(frames.length / cols)}`, path.resolve(ROOT, OUT)]);
  console.log(`${frames.length} frames tiled ${cols} wide -> ${OUT}`);
  await browser.close();
  server.close();
  fs.rmSync(dir, { recursive: true, force: true });
  process.exit(0);
}

// palettegen/paletteuse rather than ffmpeg's default quantiser: flat cel-shaded
// art banded badly without it, which hides exactly the smoothness being judged.
const pal = path.join(dir, 'pal.png');
const q = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args]);
q(['-i', path.join(dir, 'f%04d.png'), '-vf', 'palettegen=stats_mode=diff', pal]);
q(['-framerate', String(FPS), '-i', path.join(dir, 'f%04d.png'), '-i', pal,
  '-lavfi', 'paletteuse=dither=bayer:bayer_scale=3', path.resolve(ROOT, OUT)]);

console.log(`${frames.length} frames at ${FPS}fps -> ${OUT}`);
await browser.close();
server.close();
fs.rmSync(dir, { recursive: true, force: true });

/**
 * Turn one cutout illustration into an animatable puppet.
 *
 * A fighter needs a character in fifteen poses; the source art has one. The way
 * out is to stop treating the image as a picture and start treating it as a set
 * of parts: cut it along polygons, give each part a pivot and a parent, and idle,
 * walk, crouch, block and most attacks all come out of that single drawing.
 *
 * The hard part is occlusion. Where a sleeve lies over the coat there are no
 * coat pixels underneath, so lifting the arm would tear a hole in the body. Each
 * part therefore declares what it occludes, and the layer beneath is inpainted
 * outward from its own surviving pixels before the atlas is packed.
 *
 *   node tools/rig.mjs <cutout.png> <rig.json> <outdir> [--debug]
 */

import fs from 'node:fs';
import path from 'node:path';
import { readPng } from './lib/png.mjs';
import { encodeRgba } from './lib/png-write.mjs';

const [srcPath, rigPath, outDir] = process.argv.slice(2);
const DEBUG = process.argv.includes('--debug');
if (!srcPath || !rigPath || !outDir) {
  console.error('usage: node tools/rig.mjs <cutout.png> <rig.json> <outdir> [--debug]');
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

const png = readPng(fs.readFileSync(srcPath));
const rgba = png.toRgba();
const { width: W, height: H } = png;
const rig = JSON.parse(fs.readFileSync(rigPath, 'utf8'));

/** Even-odd fill rule, evaluated per pixel inside the polygon's own bbox. */
function rasterize(poly) {
  const mask = new Uint8Array(W * H);
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  const x0 = Math.max(0, Math.floor(Math.min(...xs)));
  const x1 = Math.min(W - 1, Math.ceil(Math.max(...xs)));
  const y0 = Math.max(0, Math.floor(Math.min(...ys)));
  const y1 = Math.min(H - 1, Math.ceil(Math.max(...ys)));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i];
        const [xj, yj] = poly[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) mask[y * W + x] = 1;
    }
  }
  return mask;
}

const masks = {};
for (const part of rig.parts) masks[part.name] = rasterize(part.poly);

/**
 * Fill a part's occluded region by growing its own surviving pixels inward.
 * Flat garment panels heal convincingly; heavy pattern would not, which is why
 * `occludedBy` is declared per part rather than inferred.
 */
function heal(pixels, mask, hole) {
  const known = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) known[i] = mask[i] && !hole[i] ? 1 : 0;
  let remaining = 0;
  for (let i = 0; i < W * H; i++) if (mask[i] && hole[i]) remaining++;
  const total = remaining;

  let guard = 0;
  while (remaining > 0 && guard++ < 400) {
    const added = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (!mask[i] || known[i]) continue;
        let r = 0; let g = 0; let b = 0; let a = 0; let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            const ni = ny * W + nx;
            if (!known[ni]) continue;
            const o = ni * 4;
            r += pixels[o]; g += pixels[o + 1]; b += pixels[o + 2]; a += pixels[o + 3]; n++;
          }
        }
        if (!n) continue;
        const o = i * 4;
        added.push([i, Math.round(r / n), Math.round(g / n), Math.round(b / n), Math.round(a / n)]);
      }
    }
    if (!added.length) break;
    for (const [i, r, g, b, a] of added) {
      const o = i * 4;
      pixels[o] = r; pixels[o + 1] = g; pixels[o + 2] = b; pixels[o + 3] = a;
      known[i] = 1;
      remaining--;
    }
  }
  return { healed: total - remaining, total };
}

/* ---- build each part's own pixel buffer */
const built = [];
for (const part of rig.parts) {
  const mask = masks[part.name];
  const pixels = new Uint8Array(W * H * 4);
  let count = 0;
  for (let i = 0; i < W * H; i++) {
    if (!mask[i]) continue;
    const o = i * 4;
    if (rgba[o + 3] < 12) { mask[i] = 0; continue; }
    pixels[o] = rgba[o]; pixels[o + 1] = rgba[o + 1];
    pixels[o + 2] = rgba[o + 2]; pixels[o + 3] = rgba[o + 3];
    count++;
  }

  let healReport = null;
  if (part.occludedBy && part.occludedBy.length) {
    const hole = new Uint8Array(W * H);
    for (const other of part.occludedBy) {
      const om = masks[other];
      if (!om) throw new Error(`${part.name} occludedBy unknown part "${other}"`);
      for (let i = 0; i < W * H; i++) if (om[i]) hole[i] = 1;
    }
    healReport = heal(pixels, mask, hole);
  }

  // trim to the part's own bounds
  let x0 = W; let y0 = H; let x1 = -1; let y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!mask[y * W + x]) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) throw new Error(`part "${part.name}" is empty - check its polygon`);
  built.push({ part, pixels, mask, x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1, count, healReport });
}

/* ---- shelf-pack into one atlas */
const PAD = 2;
built.sort((a, b) => b.h - a.h);
let shelfY = 0;
let shelfX = 0;
let shelfH = 0;
const AW = 2048;
for (const b of built) {
  if (shelfX + b.w + PAD > AW) { shelfX = 0; shelfY += shelfH + PAD; shelfH = 0; }
  b.ax = shelfX; b.ay = shelfY;
  shelfX += b.w + PAD;
  shelfH = Math.max(shelfH, b.h);
}
const AH = shelfY + shelfH + PAD;
const atlas = new Uint8Array(AW * AH * 4);
for (const b of built) {
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const si = (b.y0 + y) * W + (b.x0 + x);
      if (!b.mask[si]) continue;
      const so = si * 4;
      const dO = ((b.ay + y) * AW + b.ax + x) * 4;
      atlas[dO] = b.pixels[so]; atlas[dO + 1] = b.pixels[so + 1];
      atlas[dO + 2] = b.pixels[so + 2]; atlas[dO + 3] = b.pixels[so + 3];
    }
  }
}

const manifest = {
  name: rig.name,
  source: path.basename(srcPath),
  atlas: 'atlas.png',
  atlasSize: [AW, AH],
  root: rig.root,
  /** Where the character's feet meet the ground, in source pixels. */
  ground: rig.ground,
  parts: built
    .slice()
    .sort((a, b) => (a.part.z ?? 0) - (b.part.z ?? 0))
    .map((b) => ({
      name: b.part.name,
      parent: b.part.parent ?? null,
      z: b.part.z ?? 0,
      rect: [b.ax, b.ay, b.w, b.h],
      // pivot expressed relative to the part's own top-left in the atlas
      pivot: [b.part.pivot[0] - b.x0, b.part.pivot[1] - b.y0],
      // and in source space, so parents can position children
      origin: [b.part.pivot[0], b.part.pivot[1]],
      limits: b.part.limits ?? null,
    })),
};

fs.writeFileSync(path.join(outDir, 'atlas.png'), Buffer.from(encodeRgba(AW, AH, atlas)));
fs.writeFileSync(path.join(outDir, 'rig.json'), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`atlas ${AW}x${AH}`);
for (const b of built.sort((a, b2) => (a.part.z ?? 0) - (b2.part.z ?? 0))) {
  const h = b.healReport;
  console.log(`  ${b.part.name.padEnd(9)} ${String(b.w).padStart(3)}x${String(b.h).padStart(3)}  `
    + `${String(b.count).padStart(6)} px  pivot ${b.part.pivot}  `
    + (h ? `healed ${h.healed}/${h.total} occluded px` : ''));
}
console.log(`wrote ${outDir}/atlas.png and rig.json`);

if (DEBUG) {
  const dbg = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const o = i * 4;
    const c = (((i % W) >> 4) + ((i / W | 0) >> 4)) % 2 ? 40 : 58;
    dbg[o] = c; dbg[o + 1] = c; dbg[o + 2] = c; dbg[o + 3] = 255;
  }
  for (let i = 0; i < W * H; i++) {
    const o = i * 4;
    const a = rgba[o + 3] / 255;
    if (a <= 0) continue;
    for (let c = 0; c < 3; c++) dbg[o + c] = Math.round(dbg[o + c] * (1 - a) + rgba[o + c] * a * 0.45);
  }
  const hues = [[255, 70, 140], [90, 220, 255], [255, 210, 60], [120, 255, 140],
    [190, 130, 255], [255, 150, 60], [100, 180, 255], [255, 255, 255]];
  built.forEach((b, i) => {
    const col = hues[i % hues.length];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const mi = y * W + x;
        if (!b.mask[mi]) continue;
        const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]]
          .some(([dx, dy]) => {
            const nx = x + dx; const ny = y + dy;
            return nx < 0 || ny < 0 || nx >= W || ny >= H || !b.mask[ny * W + nx];
          });
        const o = mi * 4;
        if (edge) { dbg[o] = col[0]; dbg[o + 1] = col[1]; dbg[o + 2] = col[2]; }
        else for (let c = 0; c < 3; c++) dbg[o + c] = Math.round(dbg[o + c] * 0.72 + col[c] * 0.28);
      }
    }
    // pivot crosshair
    const [px, py] = b.part.pivot;
    for (let d = -6; d <= 6; d++) {
      for (const [x, y] of [[px + d, py], [px, py + d]]) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const o = (y * W + x) * 4;
        dbg[o] = 255; dbg[o + 1] = 255; dbg[o + 2] = 255;
      }
    }
  });
  const p = path.join(outDir, 'debug.png');
  fs.writeFileSync(p, Buffer.from(encodeRgba(W, H, dbg)));
  console.log(`debug overlay: ${p}`);
}

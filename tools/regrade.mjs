/**
 * Repair the two cutouts that came through a clipping filter.
 *
 * #1 and #4 reached this repo already damaged: channels driven to their limits,
 * so shading that should be a gradient became flat slabs of pure green and pure
 * blue meeting at a razor edge, with the fringe bleeding into neighbouring
 * hair. Every other illustration in the set is clean, so this is not the house
 * style -- but the original files are gone, and clipped channels do not store
 * what they clipped. This cannot recover the colour.
 *
 * What it can do is stop it reading as a glitch. Two passes, both of which
 * preserve luminance exactly, so the drawing's form is untouched:
 *
 *   1. Compress saturation above a knee. Clipping piles a wide range of real
 *      colours onto the same maximum; pulling that maximum back down restores
 *      the sense of a painted surface without inventing a hue.
 *   2. Blur chroma only, within the damaged region. The hard slab boundaries
 *      are an artefact of the clip, not draughtsmanship; softening hue and
 *      saturation while leaving lightness sharp removes the banding and keeps
 *      every edge the artist drew.
 *
 *   node tools/regrade.mjs [--dry]
 */

import fs from 'node:fs';
import { readPng } from './lib/png.mjs';
import { encodeRgba } from './lib/png-write.mjs';

const WORK = {
  1: { knee: 0.42, squeeze: 0.34, blur: 2, note: 'whole figure came through the filter' },
  4: { knee: 0.46, squeeze: 0.30, blur: 3, box: [150, 20, 400, 240], note: 'face and ear only' },
};
const DRY = process.argv.includes('--dry');

function toHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b); const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h;
  if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (mx === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function toRgb(h, s, l) {
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const ch = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [ch(h + 1 / 3), ch(h), ch(h - 1 / 3)].map((v) => Math.round(v * 255));
}

for (const [n, cfg] of Object.entries(WORK)) {
  const file = `assets/cutouts/${n}.png`;
  const png = readPng(fs.readFileSync(file));
  const p = png.toRgba();
  const { width: w, height: h } = png;
  const [bx0, by0, bx1, by1] = cfg.box ?? [0, 0, w - 1, h - 1];

  // decompose once; hue is stored as a vector so it can be averaged across the
  // 0/1 wrap without the red end of the wheel tearing
  const hx = new Float32Array(w * h);
  const hy = new Float32Array(w * h);
  const sa = new Float32Array(w * h);
  const li = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const [hh, ss, ll] = toHsl(p[i * 4], p[i * 4 + 1], p[i * 4 + 2]);
    hx[i] = Math.cos(hh * Math.PI * 2);
    hy[i] = Math.sin(hh * Math.PI * 2);
    sa[i] = ss;
    li[i] = ll;
  }

  const inBox = (x, y) => x >= bx0 && x <= bx1 && y >= by0 && y <= by1;
  let touched = 0;
  const R = cfg.blur;
  const outS = Float32Array.from(sa);
  const outX = Float32Array.from(hx);
  const outY = Float32Array.from(hy);

  for (let y = by0; y <= by1; y++) {
    for (let x = bx0; x <= bx1; x++) {
      const i = y * w + x;
      if (p[i * 4 + 3] < 24) continue;
      if (sa[i] <= cfg.knee) continue;          // only the clipped end
      let ax = 0; let ay = 0; let as = 0; let n2 = 0;
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          const nx = x + dx; const ny = y + dy;
          if (!inBox(nx, ny)) continue;
          const k = ny * w + nx;
          if (p[k * 4 + 3] < 24) continue;
          ax += hx[k]; ay += hy[k]; as += sa[k]; n2++;
        }
      }
      if (!n2) continue;
      outX[i] = ax / n2;
      outY[i] = ay / n2;
      // knee + squeeze: everything above the knee is compressed toward it
      outS[i] = cfg.knee + (as / n2 - cfg.knee) * cfg.squeeze;
      touched++;
    }
  }

  for (let i = 0; i < w * h; i++) {
    if (p[i * 4 + 3] < 24) continue;
    if (outS[i] === sa[i] && outX[i] === hx[i]) continue;
    let hh = Math.atan2(outY[i], outX[i]) / (Math.PI * 2);
    if (hh < 0) hh += 1;
    const [r, g, b] = toRgb(hh, Math.max(0, Math.min(1, outS[i])), li[i]);
    p[i * 4] = r; p[i * 4 + 1] = g; p[i * 4 + 2] = b;   // lightness untouched
  }

  console.log(`${n}.png  regraded ${touched} px  (${cfg.note})`);
  if (!DRY) fs.writeFileSync(file, Buffer.from(encodeRgba(w, h, p)));
}
if (DRY) console.log('(dry run -- nothing written)');

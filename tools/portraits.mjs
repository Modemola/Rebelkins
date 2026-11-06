/**
 * Crop a select-screen portrait for every rigged character.
 *
 * The rigs already say where each head is, so the portraits come from that
 * rather than from ten hand-picked rectangles that would drift the moment a
 * polygon moved.
 *
 *   node tools/portraits.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { readPng } from './lib/png.mjs';
import { encodeRgba } from './lib/png-write.mjs';

const OUT = 'assets/portraits';
const SIZE = 192;
fs.mkdirSync(OUT, { recursive: true });

/**
 * Character id -> the rig that says where the head is, and the cutout to crop.
 *
 * Spelled out rather than derived, because the side-view characters do not
 * follow the original set's numbering: their rigs live under rigs/side and
 * their cutouts are named after the character rather than the order the
 * illustrations arrived in.
 */
const SOURCE = {
  kin01: ['rigs/kin01.json', 'assets/cutouts/1.png'],
  kin02: ['rigs/kin02.json', 'assets/cutouts/2.png'],
  kin03: ['rigs/kin03.json', 'assets/cutouts/3.png'],
  kin04: ['rigs/kin04.json', 'assets/cutouts/4.png'],
  kin05: ['rigs/kin05.json', 'assets/cutouts/5.png'],
  kin06: ['rigs/kin06.json', 'assets/cutouts/6.png'],
  kin07: ['rigs/kin07.json', 'assets/cutouts/7.png'],
  kin08: ['rigs/kin08.json', 'assets/cutouts/8.png'],
  kin09: ['rigs/kin09.json', 'assets/cutouts/9.png'],
  kin10: ['rigs/kin10.json', 'assets/cutouts/10.png'],
  kin06s: ['rigs/side/kin06.json', 'assets/cutouts/side/kin06.png'],
  kin09s: ['rigs/side/kin09.json', 'assets/cutouts/side/kin09.png'],
};

for (const [id, [rigPath, cutPath]] of Object.entries(SOURCE)) {
  const rig = JSON.parse(fs.readFileSync(rigPath, 'utf8'));
  const head = rig.parts.find((p) => p.name === 'head');
  if (!head) { console.log(`${id}: no head part, skipped`); continue; }

  const png = readPng(fs.readFileSync(cutPath));
  const src = png.toRgba();
  const { width: w, height: h } = png;

  const xs = head.poly.map((p) => p[0]);
  const ys = head.poly.map((p) => p[1]);
  let x0 = Math.min(...xs); let x1 = Math.max(...xs);
  let y0 = Math.min(...ys); let y1 = Math.max(...ys);

  /**
   * Tighten onto pixels that are actually the head.
   *
   * Inside the polygon, not inside its bounding rectangle. A head part is
   * rarely a rectangle -- it is a U around the hair, or an L down one side of
   * a face -- and its bounding box takes in whatever else is drawn in the
   * corners. On KIN 09's side view that is her near arm and half her torso,
   * so the "head" measured 678 pixels wide on a 628-pixel-wide figure and the
   * portrait framed her whole body.
   */
  const inHead = (px, py) => {
    let hit = false;
    for (let i = 0, j = head.poly.length - 1; i < head.poly.length; j = i++) {
      const [xi, yi] = head.poly[i];
      const [xj, yj] = head.poly[j];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
  };
  let tx0 = x1; let tx1 = x0; let ty0 = y1; let ty1 = y0;
  for (let y = Math.max(0, y0 | 0); y <= Math.min(h - 1, y1 | 0); y++) {
    for (let x = Math.max(0, x0 | 0); x <= Math.min(w - 1, x1 | 0); x++) {
      if (src[(y * w + x) * 4 + 3] < 24 || !inHead(x + 0.5, y + 0.5)) continue;
      if (x < tx0) tx0 = x; if (x > tx1) tx1 = x;
      if (y < ty0) ty0 = y; if (y > ty1) ty1 = y;
    }
  }
  [x0, x1, y0, y1] = [tx0, tx1, ty0, ty1];

  /**
   * Square it off around the face, with a little air.
   *
   * Anchored at the crown rather than centred on the head part, because hair
   * is not symmetrical about the face: it hangs below it. Centring on the
   * whole part is fine while the hair frames the head -- KIN 07's braids make
   * her box 76% of her own height and she still reads, because they are as
   * wide as they are long. It fails the moment the hair is long and narrow:
   * KIN 09's side-view portrait came out at 63% and showed her whole body
   * down to the skirt, with her face a sixth of the tile, because the box was
   * centred halfway down a column of hair.
   *
   * The crown is a reliable landmark on all twelve and the face always sits
   * just under it, so the box starts there and the width decides the size.
   * `heightCap` still lets a tall head grow the box, so a character who is
   * mostly hat or horns is not cropped -- it just cannot drag the frame down
   * past the shoulders.
   */
  const heightCap = Math.min(y1 - y0, (x1 - x0) * 1.35);
  const side = Math.max(x1 - x0, heightCap) * 1.12;
  const cx = (x0 + x1) / 2;
  x0 = Math.round(cx - side / 2);
  y0 = Math.round(y0 - side * 0.06);

  const dst = new Uint8Array(SIZE * SIZE * 4);
  const step = side / SIZE;
  for (let dy = 0; dy < SIZE; dy++) {
    for (let dx = 0; dx < SIZE; dx++) {
      // box filter over the source footprint of this destination pixel
      const sx0 = Math.round(x0 + dx * step);
      const sy0 = Math.round(y0 + dy * step);
      const sx1 = Math.max(sx0 + 1, Math.round(x0 + (dx + 1) * step));
      const sy1 = Math.max(sy0 + 1, Math.round(y0 + (dy + 1) * step));
      let r = 0; let g = 0; let b = 0; let a = 0; let n2 = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          if (sx < 0 || sy < 0 || sx >= w || sy >= h) { n2++; continue; }
          const o = (sy * w + sx) * 4;
          const al = src[o + 3] / 255;
          r += src[o] * al; g += src[o + 1] * al; b += src[o + 2] * al; a += src[o + 3];
          n2++;
        }
      }
      if (!n2) continue;
      const o = (dy * SIZE + dx) * 4;
      const av = a / n2;
      if (av < 1) continue;
      // un-premultiply so edges stay the right colour against any backdrop
      const k = 255 / av;
      dst[o] = Math.min(255, Math.round((r / n2) * k));
      dst[o + 1] = Math.min(255, Math.round((g / n2) * k));
      dst[o + 2] = Math.min(255, Math.round((b / n2) * k));
      dst[o + 3] = Math.round(av);
    }
  }

  const file = path.join(OUT, `${id}.png`);
  fs.writeFileSync(file, Buffer.from(encodeRgba(SIZE, SIZE, dst)));
  console.log(`${file}  from ${cutPath}  head box ${x0},${y0} ${Math.round(side)}px`);
}

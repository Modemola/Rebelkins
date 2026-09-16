/**
 * Minimal PNG reader. Decodes enough to get the alpha channel, which is all the
 * asset scanner needs: the tight bounding box of the visible pixels and where
 * the feet are.
 *
 * Deliberately dependency-free. An art pipeline that needs `npm install` before
 * anyone can see their own artwork in the game does not get used.
 */

import zlib from 'node:zlib';

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

export function readPng(buf) {
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error('not a PNG');

  let pos = 8;
  let ihdr = null;
  const idat = [];
  let trns = null;

  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    pos += 12 + len;

    if (type === 'IHDR') {
      ihdr = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        interlace: data[12],
      };
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'tRNS') trns = data;
    else if (type === 'IEND') break;
  }

  if (!ihdr) throw new Error('no IHDR');
  if (ihdr.interlace !== 0) {
    throw new Error('interlaced PNG — re-export without Adam7 interlacing');
  }
  if (ihdr.bitDepth !== 8 && ihdr.bitDepth !== 16) {
    throw new Error(`unsupported bit depth ${ihdr.bitDepth} — export 8-bit`);
  }

  const channels = CHANNELS[ihdr.colorType];
  if (!channels) throw new Error(`unsupported colour type ${ihdr.colorType}`);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bytesPerSample = ihdr.bitDepth / 8;
  const bpp = channels * bytesPerSample;
  const stride = ihdr.width * bpp;
  const out = Buffer.alloc(stride * ihdr.height);

  // Undo the per-scanline filters. Each row is prefixed with its filter type.
  let rp = 0;
  for (let y = 0; y < ihdr.height; y++) {
    const filter = raw[rp++];
    const row = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const rawByte = raw[rp + x];
      const a = x >= bpp ? row[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= bpp ? prev[x - bpp] : 0;
      let v;
      switch (filter) {
        case 0: v = rawByte; break;
        case 1: v = rawByte + a; break;
        case 2: v = rawByte + b; break;
        case 3: v = rawByte + ((a + b) >> 1); break;
        case 4: v = rawByte + paeth(a, b, c); break;
        default: throw new Error(`bad filter ${filter} on row ${y}`);
      }
      row[x] = v & 0xff;
    }
    rp += stride;
  }

  return {
    width: ihdr.width,
    height: ihdr.height,
    colorType: ihdr.colorType,
    hasAlpha: ihdr.colorType === 4 || ihdr.colorType === 6
      || (ihdr.colorType === 3 && !!trns),
    alphaAt: alphaReader(ihdr, channels, bytesPerSample, stride, out, trns),
  };
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

function alphaReader(ihdr, channels, bytesPerSample, stride, out, trns) {
  const { colorType } = ihdr;
  return (x, y) => {
    const o = y * stride + x * channels * bytesPerSample;
    if (colorType === 6) return out[o + 3 * bytesPerSample];
    if (colorType === 4) return out[o + bytesPerSample];
    if (colorType === 3 && trns) {
      const idx = out[o];
      return idx < trns.length ? trns[idx] : 255;
    }
    return 255;
  };
}

/**
 * Tight bounding box of pixels above an alpha threshold.
 *
 * `opaque` means the visible pixels fill the whole canvas -- i.e. there is
 * nothing to trim. That is the case worth reporting, and it is not the same as
 * "has no alpha channel": an RGBA export with a background baked in has a
 * perfectly good alpha channel and is still unusable as a cutout.
 */
export function alphaBounds(png, threshold = 10) {
  if (!png.hasAlpha) {
    return { x: 0, y: 0, w: png.width, h: png.height, opaque: true };
  }
  let minX = png.width;
  let minY = png.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      if (png.alphaAt(x, y) < threshold) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null; // fully transparent
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  return {
    x: minX, y: minY, w, h,
    opaque: w === png.width && h === png.height,
  };
}

/**
 * Where the feet are, as a fraction of the trimmed box width.
 *
 * Bottom-centre is wrong for a Kin caught mid-stride or leaning, so this reads
 * the horizontal centre of mass of the bottom few rows instead: whatever is
 * actually touching the ground is what should sit on the ground line.
 */
export function footAnchorX(png, box, rows = 6) {
  if (box.opaque) return 0.5;
  const y0 = Math.max(box.y, box.y + box.h - rows);
  let sum = 0;
  let weight = 0;
  for (let y = y0; y < box.y + box.h; y++) {
    for (let x = box.x; x < box.x + box.w; x++) {
      const a = png.alphaAt(x, y);
      if (a < 10) continue;
      sum += (x - box.x) * a;
      weight += a;
    }
  }
  if (!weight) return 0.5;
  return clamp(sum / weight / box.w, 0.15, 0.85);
}

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

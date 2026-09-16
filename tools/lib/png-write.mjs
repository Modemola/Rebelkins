/**
 * Minimal PNG writer (8-bit RGBA, no interlacing).
 *
 * Exists so the asset pipeline can be tested without anyone's real artwork:
 * tools/test-assets.mjs generates cutouts with known bounds and asserts the
 * scanner measures them correctly.
 */

import zlib from 'node:zlib';

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** @param rgba Uint8Array of width*height*4 */
export function encodeRgba(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // colour type: RGBA
  ihdr[10] = 0;  // deflate
  ihdr[11] = 0;  // adaptive filtering
  ihdr[12] = 0;  // no interlace

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: None
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride)
      .copy(raw, y * (stride + 1) + 1);
  }

  return Buffer.concat([
    SIG,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * A test cutout: a solid blob inside a transparent canvas, with the visible
 * pixels confined to a known rectangle so the scanner's trim can be asserted.
 */
export function testCutout({ width, height, box, color = [255, 63, 164], footX = null }) {
  const rgba = new Uint8Array(width * height * 4);
  const fx = footX ?? box.x + box.w / 2;
  for (let y = box.y; y < box.y + box.h; y++) {
    // taper toward the feet so the foot anchor is a real measurement, not the
    // midpoint of a rectangle
    const t = (y - box.y) / box.h;
    const halfW = t > 0.8 ? box.w * 0.12 : box.w / 2;
    const cx = t > 0.8 ? fx : box.x + box.w / 2;
    const x0 = Math.max(box.x, Math.round(cx - halfW));
    const x1 = Math.min(box.x + box.w - 1, Math.round(cx + halfW));
    for (let x = x0; x <= x1; x++) {
      const o = (y * width + x) * 4;
      rgba[o] = color[0];
      rgba[o + 1] = color[1];
      rgba[o + 2] = color[2];
      rgba[o + 3] = 255;
    }
  }
  // guarantee the declared box corners are actually occupied
  for (const [px, py] of [[box.x, box.y], [box.x + box.w - 1, box.y]]) {
    const o = (py * width + px) * 4;
    rgba[o] = color[0]; rgba[o + 1] = color[1]; rgba[o + 2] = color[2]; rgba[o + 3] = 255;
  }
  return encodeRgba(width, height, rgba);
}

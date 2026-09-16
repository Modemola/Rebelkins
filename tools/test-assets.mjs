/**
 * Asset pipeline test.
 *
 * Generates cutouts with known geometry, runs them through the same reader the
 * scanner uses, and asserts the measurements. This is the check that matters for
 * dropped-in artwork: if the trim box or the foot anchor is wrong, every Kin
 * stands at the wrong height or floats off the ground, and it will look like a
 * rendering bug rather than a maths one.
 *
 *   node tools/test-assets.mjs
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readPng, alphaBounds, footAnchorX } from './lib/png.mjs';
import { testCutout, encodeRgba } from './lib/png-write.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;

function check(label, actual, expected, tolerance = 0) {
  const ok = typeof expected === 'number'
    ? Math.abs(actual - expected) <= tolerance
    : actual === expected;
  console.log(`  ${ok ? '✓' : '✗'} ${label}: ${actual}${ok ? '' : ` (expected ${expected})`}`);
  if (!ok) failures++;
}

console.log('round-trip: encode → decode');
{
  const box = { x: 130, y: 44, w: 220, h: 500 };
  const png = readPng(testCutout({ width: 512, height: 640, box }));
  check('width', png.width, 512);
  check('height', png.height, 640);
  check('has alpha', png.hasAlpha, true);

  const b = alphaBounds(png);
  check('trim x', b.x, box.x);
  check('trim y', b.y, box.y);
  check('trim w', b.w, box.w, 2);
  check('trim h', b.h, box.h, 2);
}

console.log('\nfoot anchor follows the feet, not the bounding box');
{
  // Feet deliberately off to one side, as in a mid-stride or leaning pose.
  const box = { x: 100, y: 50, w: 400, h: 600 };
  const png = readPng(testCutout({ width: 600, height: 700, box, footX: 180 }));
  const b = alphaBounds(png);
  const ax = footAnchorX(png, b);
  // 180 sits 80px into a 400px box => 0.2
  check('anchor x', Math.round(ax * 100) / 100, 0.2, 0.06);
  check('anchor is not just the midpoint', Math.abs(ax - 0.5) > 0.15, true);
}

console.log('\nan opaque export is reported, not silently mangled');
{
  const rgba = new Uint8Array(64 * 64 * 4).fill(255);
  const png = readPng(encodeRgba(64, 64, rgba));
  const b = alphaBounds(png);
  check('full bleed detected', b.opaque, true);
  check('anchor falls back to centre', footAnchorX(png, b), 0.5);
}

console.log('\nscanner writes a manifest the renderer can use');
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-assets-'));
  const kinDir = path.join(ROOT, 'assets', 'kin', 'spark');
  const backup = fs.readdirSync(kinDir);
  const written = [];
  try {
    // two walk frames + a front plate, at deliberately different resolutions
    const plates = {
      'front.png': testCutout({ width: 900, height: 1200, box: { x: 300, y: 120, w: 300, h: 1000 } }),
      'walk-1.png': testCutout({ width: 400, height: 520, box: { x: 120, y: 30, w: 160, h: 460 } }),
      'walk-2.png': testCutout({ width: 400, height: 520, box: { x: 118, y: 34, w: 164, h: 456 } }),
    };
    for (const [name, buf] of Object.entries(plates)) {
      const dest = path.join(kinDir, name);
      fs.writeFileSync(dest, buf);
      written.push(dest);
    }

    const manifestPath = path.join(ROOT, 'assets', 'manifest.json');
    const before = fs.existsSync(manifestPath) ? fs.readFileSync(manifestPath) : null;
    execFileSync('node', [path.join(ROOT, 'tools', 'scan-assets.mjs')], { cwd: ROOT, stdio: 'pipe' });
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    const spark = manifest.kin.spark;
    check('spark present', !!spark, true);
    check('front plate found', !!spark.plates.front, true);
    check('walk frames grouped', Array.isArray(spark.plates.walk) && spark.plates.walk.length, 2);
    check('front trimmed', spark.plates.front.sh, 1000, 2);
    check('front source offset kept', spark.plates.front.sy, 120);
    check('relative height carried through', spark.height, 0.96);
    check('baseline height recorded', spark.baselineHeight, 1000, 2);
    check('path is web-relative', spark.plates.front.file, 'kin/spark/front.png');

    if (before) fs.writeFileSync(manifestPath, before);
    else fs.rmSync(manifestPath, { force: true });
  } finally {
    for (const f of written) fs.rmSync(f, { force: true });
    fs.rmSync(tmp, { recursive: true, force: true });
    const after = fs.readdirSync(kinDir);
    if (after.length !== backup.length) {
      console.error('  ! fixture cleanup left files behind in assets/kin/spark');
      failures++;
    }
  }
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nASSET PIPELINE OK');
process.exit(failures ? 1 : 0);

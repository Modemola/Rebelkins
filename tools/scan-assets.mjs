/**
 * Asset scanner. Turns `assets/kin/<id>/*.png` into `assets/manifest.json`.
 *
 * The workflow this exists to protect: drop PNGs in a folder, run one command,
 * see your art in the game. No JSON to hand-edit, no canvas size to match, no
 * anchor to measure. Cutouts can arrive at any resolution with any amount of
 * empty space around them -- the scanner measures the alpha, trims it, finds the
 * ground line and records all of it.
 *
 *   node tools/scan-assets.mjs [--check] [--verbose]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPng, alphaBounds, footAnchorX } from './lib/png.mjs';
import { KIN } from '../src/data/kin.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KIN_DIR = path.join(ROOT, 'assets', 'kin');
const OUT = path.join(ROOT, 'assets', 'manifest.json');
const VERBOSE = process.argv.includes('--verbose');
const CHECK = process.argv.includes('--check');

/**
 * Plate names the renderer understands, mapped to what they are for. Anything
 * else in the folder is kept in the manifest but never auto-selected, so extra
 * reference plates can live beside the gameplay ones without breaking anything.
 */
const PLATES = {
  front: 'standing, facing the camera — the one plate everything falls back to',
  back: 'walking away',
  side: 'profile; mirrored automatically for the other direction',
  walk: 'walk cycle; name them walk-1, walk-2, … for frames',
  runway: 'hero pose for the extraction walk',
  portrait: 'chest-up, for menus and the bible',
};

const FRAME_RE = /^([a-z]+)-(\d+)$/;

function listKinDirs() {
  if (!fs.existsSync(KIN_DIR)) return [];
  return fs.readdirSync(KIN_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

const manifest = { version: 1, generated: null, kin: {} };
const report = [];
let totalPlates = 0;
const problems = [];

for (const kinId of listKinDirs()) {
  const known = KIN.find((k) => k.id === kinId);
  if (!known) {
    problems.push(`assets/kin/${kinId}/ does not match any Kin id in src/data/kin.js`);
    continue;
  }
  const dir = path.join(KIN_DIR, kinId);
  const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.png')).sort();
  if (!files.length) continue;

  const plates = {};
  const frames = {};

  for (const file of files) {
    const name = path.basename(file, path.extname(file)).toLowerCase();
    let png;
    try {
      png = readPng(fs.readFileSync(path.join(dir, file)));
    } catch (e) {
      problems.push(`${kinId}/${file}: ${e.message}`);
      continue;
    }
    const box = alphaBounds(png);
    if (!box) {
      problems.push(`${kinId}/${file}: every pixel is transparent`);
      continue;
    }
    if (box.opaque) {
      problems.push(`${kinId}/${file}: no alpha channel — export a cutout with transparency, `
        + 'or the character will render inside a rectangle');
    }

    const entry = {
      file: `kin/${kinId}/${file}`,
      // Source rect: the tight box inside the original image.
      sx: box.x, sy: box.y, sw: box.w, sh: box.h,
      // Anchor inside that box. y=1 is the ground line.
      ax: round3(footAnchorX(png, box)),
      ay: 1,
    };

    const frameMatch = FRAME_RE.exec(name);
    if (frameMatch && PLATES[frameMatch[1]]) {
      const [, base, n] = frameMatch;
      (frames[base] ||= []).push({ n: Number(n), entry });
    } else {
      plates[name] = entry;
    }
    totalPlates++;
    if (VERBOSE) {
      console.log(`  ${kinId}/${file}  ${png.width}×${png.height} `
        + `→ trim ${box.w}×${box.h} @ ${box.x},${box.y}  anchor ${entry.ax}`);
    }
  }

  for (const [base, list] of Object.entries(frames)) {
    list.sort((a, b) => a.n - b.n);
    plates[base] = list.map((f) => f.entry);
  }

  // Portraits anchor at the head, not the feet.
  if (plates.portrait && !Array.isArray(plates.portrait)) plates.portrait.ay = 1;

  if (!Object.keys(plates).length) continue;

  // Everything scales off `front` (or whatever stands in for it), so one Kin
  // exported at 4000px and another at 500px still stand the same height.
  const baseline = firstEntry(plates.front) || firstEntry(plates.walk)
    || firstEntry(plates.side) || firstEntry(plates.back);

  manifest.kin[kinId] = {
    plates,
    // Relative height from the bible, so Driver stays short and Mirror stays tall.
    height: known.look.height ?? 1,
    baselineHeight: baseline ? baseline.sh : null,
  };

  const have = Object.keys(plates);
  const missing = Object.keys(PLATES).filter((p) => !have.includes(p));
  report.push({ kinId, have, missing });
}

manifest.generated = new Date().toISOString();

if (CHECK) {
  const current = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
  const same = current && JSON.stringify(stripTime(current)) === JSON.stringify(stripTime(manifest));
  if (!same) {
    console.error('assets/manifest.json is stale. Run: node tools/scan-assets.mjs');
    process.exit(1);
  }
  console.log('assets/manifest.json is up to date');
  process.exit(0);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`\nscanned ${totalPlates} plate(s) across ${report.length} Kin`);
if (!report.length) {
  console.log('\nNo art found yet. Drop cutouts in assets/kin/<id>/ and run this again.');
  console.log('Recognised plate names:');
  for (const [name, why] of Object.entries(PLATES)) {
    console.log(`  ${name.padEnd(9)} ${why}`);
  }
} else {
  for (const r of report) {
    const framed = r.have.map((h) => {
      const p = manifest.kin[r.kinId].plates[h];
      return Array.isArray(p) ? `${h}×${p.length}` : h;
    });
    console.log(`  ${r.kinId.padEnd(11)} ${framed.join(', ')}`);
    if (r.missing.length) {
      console.log(`  ${''.padEnd(11)} missing: ${r.missing.join(', ')} (falls back to front, then to placeholder art)`);
    }
  }
}
if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems) console.log(`  ! ${p}`);
}
console.log(`\nwrote ${path.relative(ROOT, OUT)}`);

function firstEntry(p) {
  if (!p) return null;
  return Array.isArray(p) ? p[0] : p;
}
function round3(v) { return Math.round(v * 1000) / 1000; }
function stripTime(m) { return { ...m, generated: null }; }

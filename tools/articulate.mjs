/**
 * Give a rig elbows and knees.
 *
 * Every character came out of the cutting stage with seven parts: torso, hips,
 * head, two arms, two legs. Each one is a rigid polygon that rotates about a
 * single point, and that is the whole reason the fighting looked wrong. An arm
 * with no elbow cannot throw a punch -- the hand can only sweep an arc from the
 * shoulder, like a clock hand. A leg with no knee cannot kick; it swings like a
 * pendulum. No amount of tuning the rotation amounts fixes either, because the
 * motion being asked for is not in the skeleton.
 *
 * So each arm is cut at the elbow and each leg at the knee, and the lower half
 * is re-parented to the upper: seven parts become eleven, and the hand can
 * chamber and extend instead of sweeping.
 *
 * The cut is overlapped. Two halves that meet exactly along a line open into a
 * gap the moment the joint bends, so each half keeps a band of the other's side
 * -- about a limb-width in total -- and the lower half draws over the upper, so
 * at rest you see the lower half's copy and the seam is invisible.
 *
 *   node tools/articulate.mjs <rig.json> --elbow <y> --knee <y> [--out <file>]
 *                             [--arm-overlap 18] [--leg-overlap 22]
 *
 * The joint heights are read off the drawing, per character: the elbow is where
 * the sleeve bends, the knee is the crease in the trouser leg.
 */

import fs from 'node:fs';

const args = process.argv.slice(2);
const src = args[0];
const num = (flag, dflt) => (args.includes(flag) ? Number(args[args.indexOf(flag) + 1]) : dflt);
const str = (flag, dflt) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : dflt);
const ELBOW = num('--elbow', null);
const KNEE = num('--knee', null);
const ARM_OVER = num('--arm-overlap', 18);
const LEG_OVER = num('--leg-overlap', 22);
const OUT = str('--out', src);

if (!src || ELBOW === null || KNEE === null) {
  console.error('usage: node tools/articulate.mjs <rig.json> --elbow <y> --knee <y> [--out <file>]');
  process.exit(1);
}

/** Sutherland-Hodgman against a horizontal half-plane. */
function clip(poly, y, keepAbove) {
  const inside = (p) => (keepAbove ? p[1] <= y : p[1] >= y);
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if (inside(a)) out.push(a);
    if (inside(a) !== inside(b)) {
      const t = (y - a[1]) / (b[1] - a[1]);
      out.push([Math.round(a[0] + t * (b[0] - a[0])), Math.round(y)]);
    }
  }
  return out;
}

/** The limb's horizontal extent at one height, which is where the joint goes. */
function spanAt(poly, y) {
  const xs = [];
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    if ((y1 <= y && y < y2) || (y2 <= y && y < y1)) {
      xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
    }
  }
  if (xs.length < 2) throw new Error(`the limb does not cross y=${y}`);
  return [Math.min(...xs), Math.max(...xs)];
}

const rig = JSON.parse(fs.readFileSync(src, 'utf8'));
const by = Object.fromEntries(rig.parts.map((p) => [p.name, p]));
if (by.foreL) { console.error(`${src} already has elbows`); process.exit(1); }

/**
 * z is reassigned wholesale rather than patched, because the new parts have to
 * interleave with the old: each lower half draws directly over its own upper
 * half, and the head stays on top of everything as it was.
 */
const Z = {
  legL: 0, legR: 0, shinL: 1, shinR: 1, hips: 2, torso: 3,
  armR: 4, foreR: 5, armL: 6, foreL: 7, head: 8,
};

const joints = [
  { upper: 'armR', lower: 'foreR', y: ELBOW, over: ARM_OVER, limits: { rot: [-160, 20] } },
  { upper: 'armL', lower: 'foreL', y: ELBOW, over: ARM_OVER, limits: { rot: [-160, 20] } },
  { upper: 'legL', lower: 'shinL', y: KNEE, over: LEG_OVER, limits: { rot: [-20, 140] } },
  { upper: 'legR', lower: 'shinR', y: KNEE, over: LEG_OVER, limits: { rot: [-20, 140] } },
];

const parts = [];
for (const p of rig.parts) {
  const j = joints.find((q) => q.upper === p.name);
  if (!j) { parts.push({ ...p, z: Z[p.name] ?? p.z }); continue; }

  const [lo, hi] = spanAt(p.poly, j.y);
  const pivot = [Math.round((lo + hi) / 2), j.y];
  parts.push({
    ...p,
    z: Z[j.upper],
    poly: clip(p.poly, j.y + j.over, true),
  });
  parts.push({
    name: j.lower,
    parent: j.upper,
    z: Z[j.lower],
    poly: clip(p.poly, j.y - j.over, false),
    pivot,
    limits: j.limits,
  });
  console.log(`${j.upper} cut at y=${j.y}: ${j.lower} pivots at [${pivot}], `
    + `${hi - lo | 0}px wide, overlapping ${j.over * 2}px`);
}

parts.sort((a, b) => (Z[a.name] ?? 0) - (Z[b.name] ?? 0));
// The torso is inpainted where the arms cover it; the forearms cover their own
// stretch of the same side, so they belong in that list too.
const torso = parts.find((p) => p.name === 'torso');
if (torso?.occludedBy) torso.occludedBy = ['armR', 'foreR', 'armL', 'foreL'];

const out = { ...rig, parts };
out._source = `${rig._source || ''}\nElbows at y=${ELBOW} and knees at y=${KNEE}, `
  + `cut by tools/articulate.mjs with ${ARM_OVER * 2}px of overlap at the elbow `
  + `and ${LEG_OVER * 2}px at the knee.`;
fs.writeFileSync(OUT, `${JSON.stringify(out, null, 1)}\n`);
console.log(`\n${rig.parts.length} parts -> ${parts.length}, written to ${OUT}`);

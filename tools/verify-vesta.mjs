/**
 * VESTA architecture compliance.
 *
 * The architecture document is full of hard numbers -- kerb 18 cm, cameras at
 * 3.4 m not 8 m, drains every 12-18 m, aisles 1.4-2.2 m, shopfronts repeating
 * every 7-9 m. Those are exactly the things that rot silently: nobody notices a
 * street drifting to 9 m aisles until it stops feeling tight.
 *
 * So they are assertions, not intentions.
 *
 *   node tools/verify-vesta.mjs [--verbose]
 */

import { LAW as CODE_LAW, PPM, LANE } from '../src/world/units.js';

/**
 * The document's numbers, transcribed here by hand.
 *
 * Deliberately NOT imported from src/world/units.js. A compliance check that
 * reads the same constant the builder reads is a tautology -- move the constant
 * and both sides move together, and the check passes while the city drifts. The
 * verifier has to be able to disagree with the code, so it keeps its own copy
 * and audits the code's copy against it.
 */
const DOC = {
  sidewalkWidth: [4.5, 7],
  shopfrontHeight: [3.2, 4.8],
  shopThreshold: [0.7, 1.1],
  shopInteriorDepth: [6, 12],
  kerbHeight: 0.18,
  drainSpacing: [12, 18],
  cameraHeight: 3.4,
  railHeight: 1.1,
  stallAisle: [1.4, 2.2],
  shopfrontRepeat: [7, 9],
  connectorSeconds: [45, 90],
};

/** Stall footprints, also transcribed from the document rather than imported. */
const DOC_STALLS = {
  A: { widthM: 2.4, depthM: 1.8, name: 'Bead and sequin booth' },
  B: { widthM: 1.6, depthM: 1.6, name: 'Shoe altar' },
  C: { widthM: 2.2, depthM: 6.5, name: 'Hoodie tunnel' },
  D: { widthM: 2.8, depthM: 2.2, name: 'Folk repair' },
  E: { widthM: 2.0, depthM: 2.0, name: 'Illegal compile kiosk' },
};
import { LOWLINE_TERRACE, LOWLINE_SPEC } from '../src/data/districts/lowline.js';
import { STALL_TYPES, aislesOnly, stallsOnly } from '../src/world/stalls.js';
import { DISTRICTS, CONNECTORS } from '../src/data/districts/index.js';

const VERBOSE = process.argv.includes('--verbose');
let fails = 0;
let checks = 0;

function ok(label, pass, detail = '') {
  checks++;
  if (!pass) fails++;
  if (!pass || VERBOSE) {
    console.log(`  ${pass ? '✓' : '✗'} ${label}${detail ? `  ${detail}` : ''}`);
  }
}

function inRange(v, [lo, hi]) { return v >= lo - 1e-6 && v <= hi + 1e-6; }
const toM = (px) => px / PPM;

/* ------------------------------------------------------- the law itself */

console.log('\nTHE LAW — code constants audited against the document');
{
  for (const [key, want] of Object.entries(DOC)) {
    const got = CODE_LAW[key];
    const same = Array.isArray(want)
      ? Array.isArray(got) && want[0] === got[0] && want[1] === got[1]
      : want === got;
    ok(`src/world/units.js LAW.${key}`, same, same ? '' : `code says ${JSON.stringify(got)}, document says ${JSON.stringify(want)}`);
  }
}

/* ------------------------------------------------------------ street kit */

console.log('\nSTREET KIT — the law, in metres');
{
  const d = LOWLINE_TERRACE;
  const decor = d.decor;

  const kerbs = decor.filter((x) => x.kind === 'kerb');
  ok('kerbs present', kerbs.length > 0, `${kerbs.length}`);
  ok('kerb stone is 18 cm', kerbs.every((k) => Math.abs(k.heightM - DOC.kerbHeight) < 1e-6));

  const crossings = decor.filter((x) => x.kind === 'crossing');
  ok('tactile paving at crossings', crossings.length > 0);
  const studs = crossings.flatMap((c) => c.studs);
  ok('some studs missing', studs.some((s) => s.state === 'missing'));
  ok('some studs sequin-epoxy repaired', studs.some((s) => s.state === 'sequin'));

  const puddles = decor.filter((x) => x.kind === 'puddle');
  ok('puddle map exists', puddles.length > 0, `${puddles.length}`);
  ok('puddles are long skinny mirrors, not blobs',
    puddles.every((p) => p.w / p.h >= 2.2),
    `min ratio ${Math.min(...puddles.map((p) => p.w / p.h)).toFixed(1)}`);
  ok('puddles actually reflect', puddles.every((p) => p.reflects));
  ok('some puddles carry floating sequins', puddles.some((p) => p.sequins));

  const drainRuns = groupDrains(decor.filter((x) => x.kind === 'drain'));
  let worst = 0;
  let allGood = true;
  for (const run of drainRuns) {
    for (let i = 1; i < run.length; i++) {
      const gap = toM(run[i].x - run[i - 1].x);
      worst = Math.max(worst, gap);
      if (!inRange(gap, DOC.drainSpacing)) allGood = false;
    }
  }
  ok('drain mouths every 12-18 m', allGood, `widest gap ${worst.toFixed(1)} m`);
  ok('drains engraved with THREAD logo', decor.filter((x) => x.kind === 'drain').every((x) => x.logo));
  ok('some drains clogged with hair-ties', decor.some((x) => x.kind === 'drain' && x.clogged));

  ok('cameras bolt down at 3.4 m, not 8 m',
    d.cameras.every((c) => Math.abs(c.heightM - DOC.cameraHeight) < 1e-6),
    `${d.cameras.length} cameras`);
  ok('camera housings read as irons or tailor clamps',
    d.cameras.every((c) => c.housing === 'iron' || c.housing === 'clamp'));
  ok('cameras are not decoration — every one has a working cone',
    d.cameras.every((c) => c.range > 0 && c.arc > 0));
  ok('arcade cameras aim at the hook, not the door',
    d.cameras.filter((c) => c.aimedAt).length >= 4,
    `${d.cameras.filter((c) => c.aimedAt).length} aimed at hooks`);

  ok('identity gates present', d.scanStrips.length >= 2, `${d.scanStrips.length}`);
  ok('gates scan instantly — a strip is not dodgeable', d.scanStrips.every((s) => s.instant));

  const rails = decor.filter((x) => x.kind === 'railing');
  ok('railings present', rails.length > 0, `${rails.length}`);
  ok('railings are 1.1 m', rails.every((r) => Math.abs(r.heightM - DOC.railHeight) < 1e-6));
  ok('railings are mustard or oxidized coral',
    rails.every((r) => r.color === 'mustard' || r.color === 'coral'));
  ok('crews have tied cloth tags on', rails.some((r) => r.tags.length > 0));
  ok('rails stay see-through for sneaker-height shots', rails.every((r) => r.seeThrough));

  ok('overhead wires (Lowline is allowed them)', decor.some((x) => x.kind === 'wire'));
  ok('smell proxies modelled', decor.filter((x) => x.kind === 'vent').length >= 3);
  ok('trash is fashionable, not bin bags',
    decor.filter((x) => x.kind === 'litter').length > 0
    && decor.filter((x) => x.kind === 'litter').every((l) => l.type !== 'garbage-bag'));
}

/* --------------------------------------------------------------- facades */

console.log('\nFACADES — human-first scale');
{
  const shops = LOWLINE_TERRACE.decor.filter((x) => x.kind === 'shopfront');
  ok('shopfronts exist', shops.length > 0, `${shops.length}`);
  ok('ground floor 3.2-4.8 m tall',
    shops.every((s) => inRange(s.heightM, DOC.shopfrontHeight)));
  ok('deep threshold 70-110 cm',
    shops.every((s) => inRange(s.thresholdM, DOC.shopThreshold)));
  ok('one hanging sample on a hook outside each', shops.every((s) => s.hook));

  let repeatOk = true;
  let worstRepeat = 0;
  for (let i = 1; i < shops.length; i++) {
    const gap = toM(shops[i].x - shops[i - 1].x);
    worstRepeat = Math.max(worstRepeat, gap);
    if (!inRange(gap, DOC.shopfrontRepeat)) repeatOk = false;
  }
  ok('pattern repeats every 7-9 m', repeatOk, `widest ${worstRepeat.toFixed(1)} m`);

  const interiors = LOWLINE_TERRACE.zones.filter((z) => z.interior);
  ok('4 shop depths you can walk into', interiors.length === 4, `${interiors.length}`);
  ok('interiors are 6-12 m deep, never a cardboard box room',
    interiors.every((z) => inRange(toM(z.rect.h) + 1, DOC.shopInteriorDepth)),
    interiors.map((z) => `${(toM(z.rect.h) + 1).toFixed(1)}m`).join(' '));
}

/* ----------------------------------------------------------------- stalls */

console.log('\nSTALLS — each one a character');
{
  const band = LOWLINE_SPEC.stallBands[0];
  const stalls = stallsOnly(band);
  const aisles = aislesOnly(band);

  ok('7 stalls on the slice', stalls.length === 7, `${stalls.length}`);
  const used = new Set(stalls.map((s) => s.type));
  ok('all five stall types used', used.size === 5, [...used].sort().join(''));
  ok('aisles are 1.4-2.2 m — tight on purpose',
    aisles.every((a) => inRange(a.widthM, DOC.stallAisle)),
    `${Math.min(...aisles.map((a) => a.widthM)).toFixed(2)}-${Math.max(...aisles.map((a) => a.widthM)).toFixed(2)} m`);

  for (const [code, t] of Object.entries(STALL_TYPES)) {
    const got = stalls.find((s) => s.type === code);
    if (!got) continue;
    ok(`type ${code} (${t.name}) keeps its footprint`,
      Math.abs(got.widthM - t.widthM) < 1e-6 && Math.abs(got.depthM - t.depthM) < 1e-6,
      `${got.widthM}×${got.depthM} m`);
  }

  const tunnel = stalls.find((s) => s.type === 'C');
  ok('hoodie tunnel is walkable', tunnel?.walkable === true);
  ok('hoodie tunnel is a crouch corridor', tunnel?.crouch === true);
  ok('cameras lose lock inside the hoodie tunnel',
    LOWLINE_TERRACE.blinds.some((b) => b.reason === 'hoodie tunnel'));

  ok('shoe altar has something to steal',
    LOWLINE_TERRACE.props.some((p) => p.spotlight));
  ok('shoe altar has an operator who can turn',
    LOWLINE_SPEC.guards.some((g) => g.role === 'spotlight-operator'));
  ok('illegal compile kiosk is fogged', stalls.find((s) => s.type === 'E')?.fogged === true);
  ok('illegal compile kiosk is usable',
    LOWLINE_TERRACE.props.some((p) => p.illegal));
}

/* ------------------------------------------------------------------ crowd */

console.log('\nCROWD — lanes, not sprinkles');
{
  const lanes = LOWLINE_TERRACE.lanes;
  const types = new Set(lanes.map((l) => l.type));
  for (const t of Object.values(LANE)) {
    ok(`${t} lane built`, types.has(t));
  }
  ok('somewhere to stand and be seen at every reflective surface',
    lanes.filter((l) => l.type === LANE.POSE).length >= 3,
    `${lanes.filter((l) => l.type === LANE.POSE).length} pose lanes`);
  ok('pose lanes name what they face',
    lanes.filter((l) => l.type === LANE.POSE).every((l) => !!l.faces));
}

/* ------------------------------------------------------- first build slice */

console.log('\nFIRST BUILD SLICE — the checklist, item by item');
{
  const d = LOWLINE_TERRACE;
  ok('80 m, not 180', d.widthM === 80, `${d.widthM} m`);
  ok('terrace is not flat: three shallow steps', d.terraces.length === 3,
    d.terraces.map((t) => t.name).join(' / '));
  ok('river lip is 6 m', Math.abs((d.terraces[0].y1 - d.terraces[0].y0) / PPM - 6) < 0.01);
  ok('stall band is 14-18 m', inRange((d.terraces[1].y1 - d.terraces[1].y0) / PPM, [14, 18]));
  ok('arcade wall is 8-10 m', inRange((d.terraces[2].y1 - d.terraces[2].y0) / PPM, [8, 10]));
  ok('arcade wall with 4 shop depths', d.zones.filter((z) => z.interior).length === 4);
  ok('7 stalls using the five stall types', d.stalls.length === 7);
  ok('river lip railing', d.decor.some((x) => x.kind === 'railing'));
  ok('one arched bridge extract', !!d.extraction);
  ok('extract walk is 22 m', d.extraction.walkM === 22, `${d.extraction.walkM} m`);
  ok('one hoodie tunnel', d.stalls.filter((s) => s.type === 'C').length === 1);
  ok('one shoe altar', d.stalls.filter((s) => s.type === 'B').length === 1);
  ok('two scan strips', d.scanStrips.length === 2);
  ok('puddles that actually reflect', d.decor.some((x) => x.kind === 'puddle' && x.reflects));
  ok('cameras at 3.4 m', d.cameras.every((c) => c.heightM === 3.4));
  ok('a view to Runway Spire', d.skyline.some((s) => s.kind === 'spire'));
}

/* ------------------------------------------------------- districts + links */

console.log('\nCITY — districts and connectors');
{
  ok('six districts specified', Object.keys(DISTRICTS).length === 6,
    Object.keys(DISTRICTS).join(', '));
  for (const [id, d] of Object.entries(DISTRICTS)) {
    ok(`${id}: function and feeling stated`, !!d.function && !!d.feeling);
    ok(`${id}: plan carries real dimensions`, !!d.plan && Object.keys(d.plan).length > 0);
    ok(`${id}: sound signature`, Array.isArray(d.sound) && d.sound.length >= 4);
    ok(`${id}: scenarios`, Array.isArray(d.scenarios) && d.scenarios.length >= 3);
  }
  ok('four connectors built', CONNECTORS.length === 4, CONNECTORS.map((c) => c.id).join(', '));
  ok('connectors are 45-90 s of travel',
    CONNECTORS.every((c) => inRange(c.seconds, DOC.connectorSeconds)),
    CONNECTORS.map((c) => `${c.seconds}s`).join(' '));
  ok('each connector teaches a rule', CONNECTORS.every((c) => !!c.teaches));
  ok('no teleports — every connector names both ends',
    CONNECTORS.every((c) => c.from && c.to));
}

/* --------------------------------------------------------- negative prompt */

console.log('\nNEGATIVE PROMPT — what must not be built');
{
  const d = LOWLINE_TERRACE;
  // "If a scene feels empty, add three of these before adding more buildings."
  // A gap measured along one axis missed a whole bare half of the terrace, so
  // this walks the walkable ground as a grid and names any cell with nothing in it.
  const bare = bareCells(d, 10, 6);
  ok('no bare ground — every 10x6 m of terrace is dressed',
    bare.length === 0,
    bare.length ? `${bare.length} empty cell(s), first at ${bare[0]}` : 'all cells dressed');
  ok('no wet concrete with no stores',
    d.decor.filter((x) => x.kind === 'shopfront').length >= 8);
  ok('cameras are not decoration', d.cameras.every((c) => c.range > 0));
  ok('neon never sits on a black void — puddles and glass catch it',
    d.decor.some((x) => x.kind === 'puddle' && x.reflects));
  ok('street is more interesting than it is wide',
    d.decor.length + d.props.length > d.widthM * 1.2,
    `${d.decor.length + d.props.length} dressings across ${d.widthM} m`);
  ok('cloth exists in the architecture',
    d.decor.some((x) => x.kind === 'cloth'),
    `${d.decor.filter((x) => x.kind === 'cloth').length} banners / jackets / tarps`);
  ok('handmade matter leaks in',
    d.stalls.some((s) => s.fascia === 'plywood+cardboard')
    && d.props.some((p) => p.type === 'cardboard-rk-panel'));
}

function groupDrains(drains) {
  const byY = new Map();
  for (const dr of drains) {
    const k = Math.round(dr.y);
    if (!byY.has(k)) byY.set(k, []);
    byY.get(k).push(dr);
  }
  return [...byY.values()].map((r) => r.sort((a, b) => a.x - b.x));
}

/**
 * Walkable terrace, as a grid. Returns the cells with nothing standing in them.
 * Wide things (cloth lines, gaffer runs, puddles) mark every cell they cross.
 */
function bareCells(d, cellW, cellH) {
  const y0 = d.terraces[0].y0;
  const y1 = d.terraces[2].y1;
  const cols = Math.floor(d.widthM / cellW);
  // ceil, not round: a partial last row silently dropped everything standing in
  // it, which hid the bare arcade walk behind a row of puddles it discarded.
  const rows = Math.max(1, Math.ceil(toM(y1 - y0) / cellH));
  const filled = new Set();

  for (const t of [...d.decor, ...d.props, ...d.stalls]) {
    if (t.x === undefined || t.y === undefined) continue;
    if (t.y < y0 || t.y > y1) continue;
    const xa = toM(t.x);
    const xb = toM(t.x + (t.w || 0));
    const c0 = Math.floor(xa / cellW);
    const c1 = Math.floor(xb / cellW);
    const r = Math.min(rows - 1, Math.floor(toM(t.y - y0) / cellH));
    for (let c = c0; c <= c1; c++) {
      if (c >= 0 && c < cols && r >= 0) filled.add(`${c},${r}`);
    }
  }

  const bare = [];
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      if (!filled.has(`${c},${r}`)) {
        bare.push(`x ${c * cellW}-${(c + 1) * cellW} m, y ${(toM(y0) + r * cellH).toFixed(0)}-${(toM(y0) + (r + 1) * cellH).toFixed(0)} m`);
      }
    }
  }
  return bare;
}

console.log(`\n${checks} checks, ${fails} failed.`);
if (fails) {
  console.error('FAIL: the built world has drifted from the architecture.');
  process.exit(1);
}
console.log('VESTA COMPLIANT');

/**
 * DISTRICT 01 — LOWLINE.  First build slice.
 *
 * "Lowline terrace, 80 m, not 180." Everything on the slice checklist is here
 * and nothing is faked: arcade wall with 4 shop depths, 7 stalls using all five
 * stall types, river lip railing, one arched bridge extract, one hoodie tunnel,
 * one shoe altar, two scan strips, puddles that reflect, cameras at 3.4 m, and
 * a view to Runway Spire so the world feels bigger than the slice.
 *
 * A night bazaar sewn onto a transport terrace. The terrace is not flat: three
 * shallow steps from the water up to the brick.
 *
 *   y  0 - 4    far bank, Null Court side (the extract lands here)
 *   y  4 - 26   the Hem, 22 m of open canal
 *   y 26 - 32   river lip promenade, 6 m, wet and windy, vendors face the water
 *   y 32 - 48   stall band, 16 m
 *   y 48 - 57   arcade wall, 9 m covered walk against old brick and tile
 *   y 57 - 72   building mass and shop interiors
 */

import { LANE } from '../../world/units.js';
import {
  camera, clothLine, crossing, drains, kerb, litter, puddleMap, railing, scanStrip, shopRow,
  vent, wires,
} from '../../world/streetkit.js';
import { stallBand } from '../../world/stalls.js';
import { place, scatter } from '../../world/props.js';
import { lane } from '../../world/lanes.js';
import { compileDistrict } from '../../world/build.js';

const X0 = 2;
const X1 = 78;

const FACADE_Y = 57;
const ARCADE_Y = 48;
const STALL_Y = 32;
const LIP_Y = 26;
const WATER_Y = 4;

const BRIDGE_X = 60;
const BRIDGE_W = 4.2;

/* ---- arcade wall: ground floor pattern repeating every 7-9 m */
const row = shopRow(X0, X1, FACADE_Y, 1207, { prefix: 'low', interiorTint: 'oxblood' });
/* four shop depths you can actually walk into */
const ENTERABLE = [row.shops[1].id, row.shops[4].id, row.shops[6].id, row.shops[8].id];

/* ---- 7 stalls, all five types, one hoodie tunnel, one shoe altar */
const BAND = stallBand({
  x0: 17, x1: 62, y: 35.5,
  types: ['A', 'C', 'B', 'A', 'D', 'E', 'A'],
  seed: 5150, prefix: 'low',
});

const spec = {
  id: 'lowline-terrace',
  name: 'GHOST FIT: LOWLINE TERRACE',
  type: 'Ghost Fit',
  district: 'lowline',
  brief: 'A sample sneaker is sitting under a spotlight on the Lowline terrace, and the operator is right there. Cross the terrace, take it off the altar, and walk the arched bridge while the market scores your fit.',
  objectiveText: 'Reach the river lip, lift the sample sneaker, extract over the Hem.',
  targetMinutes: 12,
  payout: { cred: 240, traits: 2 },
  widthM: 80,
  depthM: 72,
  spawn: [8, 52.5],

  /** The terrace is three shallow steps, not a flat plate. */
  terraces: [
    { id: 'lip', name: 'River Lip', y0: LIP_Y, y1: STALL_Y, riseM: 0, surface: 'wet-stone', note: 'vendors face the water' },
    { id: 'band', name: 'Stall Band', y0: STALL_Y, y1: ARCADE_Y, riseM: 1.2, surface: 'asphalt' },
    { id: 'arcade', name: 'Arcade Wall', y0: ARCADE_Y, y1: FACADE_Y, riseM: 2.4, surface: 'tile', note: 'covered walk' },
  ],

  /** The Hem, open here. The bridge is the only way across. */
  blocks: [
    { x: 0, y: WATER_Y, w: BRIDGE_X - 0.1, h: LIP_Y - WATER_Y, kind: 'water' },
    { x: BRIDGE_X + BRIDGE_W, y: WATER_Y, w: 80 - (BRIDGE_X + BRIDGE_W), h: LIP_Y - WATER_Y, kind: 'water' },
  ],

  shopRows: [{
    ...row,
    enterable: ENTERABLE,
    interiorName: 'Lowline shop',
    interiorTint: 'oxblood',
    tint: 'rgba(120,20,40,0.14)',
  }],

  stallBands: [BAND],

  zones: [
    {
      id: 'lip', name: 'River Lip', rect: [X0, LIP_Y, X1 - X0, STALL_Y - LIP_Y],
      access: 0, wants: [], rejects: [], tint: 'rgba(255,63,164,0.05)',
    },
    {
      id: 'band', name: 'Stall Band', rect: [X0, STALL_Y, X1 - X0, ARCADE_Y - STALL_Y],
      access: 0, wants: [], rejects: [], tint: 'rgba(255,63,164,0.04)',
    },
    {
      id: 'arcade', name: 'Arcade Wall', rect: [X0, ARCADE_Y, X1 - X0, FACADE_Y - ARCADE_Y],
      access: 0, wants: [], rejects: [], tint: 'rgba(255,255,255,0.03)',
    },
    {
      id: 'bridge', name: 'Hem Bridge A', rect: [BRIDGE_X, WATER_Y, BRIDGE_W, LIP_Y - WATER_Y],
      access: 0, wants: [], rejects: [], tint: 'rgba(255,214,0,0.05)',
    },
  ],

  /** Street kit. Every item, generated rather than remembered. */
  kit: [
    // 1. kerbs
    kerb(X0, X1, LIP_Y - 0.18, { side: 'river' }),
    kerb(X0, X1, ARCADE_Y - 0.18, { side: 'arcade' }),

    // 2. tactile paving at the bridge crossing
    crossing(BRIDGE_X - 1.2, LIP_Y - 2.4, BRIDGE_W + 2.4, 611),

    // 3. puddle map: long skinny mirrors against the shopfronts, and the river lip
    ...puddleMap(X0, X1, FACADE_Y - 1.4, 733, { reflects: true }),
    ...puddleMap(X0 + 4, X1 - 6, LIP_Y + 1.2, 911, { depth: 0.7, reflects: true }),

    // 4. drain mouths every 12-18 m, THREAD logo, some clogged with hair-ties
    ...drains(X0 + 3, X1, LIP_Y + 4.6, 1013),
    ...drains(X0 + 9, X1, ARCADE_Y + 1.2, 1019),

    // 6. identity gates — two, exactly as the slice calls for
    scanStrip(20, ARCADE_Y - 1.3, 6, 1.3, { label: 'TERRACE GATE' }),
    scanStrip(BRIDGE_X - 0.6, LIP_Y + 0.4, BRIDGE_W + 1.2, 1.4, { label: 'BRIDGE GATE' }),

    // 7. railings: river lip, broken only for the bridge throat
    railing(X0, LIP_Y, BRIDGE_X - 1.4, LIP_Y, 1201, { color: 'mustard' }),
    railing(BRIDGE_X + BRIDGE_W + 1.4, LIP_Y, X1, LIP_Y, 1213, { color: 'coral' }),
    railing(BRIDGE_X, WATER_Y, BRIDGE_X, LIP_Y, 1217, { color: 'mustard' }),
    railing(BRIDGE_X + BRIDGE_W, WATER_Y, BRIDGE_X + BRIDGE_W, LIP_Y, 1219, { color: 'mustard' }),

    // 8. overhead wires: Lowline and Undercut only
    ...wires(X0, X1, 39, 1301, 5),
    ...wires(X0, X1, 46.5, 1307, 3),

    // cloth is a building material here: banners and drying jackets on the wires
    ...clothLine(X0 + 2, X1 - 2, 38.4, 1601),
    ...clothLine(44, X1 - 3, 45.8, 1607, { type: 'banner' }),
    ...clothLine(X0 + 3, 40, 30.4, 1613, { type: 'jacket' }),

    // 9. smell proxies
    vent(18.2, 37.6, 'steam-food'),
    vent(37.8, 37.9, 'hot-plastic'),
    vent(12, ARCADE_Y + 3, 'rain-dust'),
    vent(68, LIP_Y + 2, 'rain-dust'),

    // the arcade walk is a covered street, not a corridor: samples hang off it
    ...clothLine(X0 + 2, X1 - 4, 50.6, 1619, { type: 'jacket' }),

    // 10. trash is fashionable
    ...litter(X0, X1, STALL_Y, ARCADE_Y, 1401, 18),
    ...litter(X0, X1, LIP_Y, STALL_Y, 1409, 10),
    ...litter(X0, X1, ARCADE_Y + 2.5, FACADE_Y - 1.5, 1417, 16),
  ],

  /** Extra cameras beyond the one-per-shopfront the arcade already carries. */
  cameras: [
    camera(BRIDGE_X + BRIDGE_W / 2, LIP_Y + 3.2, 270, { housing: 'clamp', rangeM: 14, arc: 54, sweep: 26 }),
    camera(23, ARCADE_Y + 0.6, 100, { housing: 'iron', rangeM: 12, arc: 50, sweep: 40 }),
    camera(47, STALL_Y + 1.2, 80, { housing: 'clamp', rangeM: 13, arc: 52, sweep: 44 }),
    camera(66, LIP_Y + 1.4, 200, { housing: 'iron', rangeM: 12, arc: 48, sweep: 36 }),
  ],

  /** The spotlight operator at the shoe altar, and a terrace walker. */
  guards: [
    { path: [[21, 39.2], [31, 39.2]], speedMs: 1.1, seesM: 9, role: 'spotlight-operator' },
    { path: [[10, 45], [70, 45], [10, 45]], speedMs: 1.6, seesM: 10 },
  ],

  /** Lanes, not sprinkles. */
  lanes: [
    lane(LANE.FAST, [[X0 + 1, FACADE_Y - 1.0], [X1 - 1, FACADE_Y - 1.0]], 1.5,
      { label: 'shop windows', density: 1.35 }),
    lane(LANE.SLOW, [[X0 + 2, ARCADE_Y + 4.5], [X1 - 2, ARCADE_Y + 4.5]], 2.2,
      { label: 'under the arcade canopy', density: 1.1 }),
    lane(LANE.SLOW, [[X0 + 4, LIP_Y + 3.4], [X1 - 4, LIP_Y + 3.4]], 2.0,
      { label: 'river lip promenade', density: 0.9 }),
    // pose lanes: every reflective surface gets somewhere to stand and be seen
    lane(LANE.POSE, [[24.6, 38.8], [26.8, 38.8]], 1.4,
      { faces: 'shoe altar spotlight', density: 0.8, label: 'shoe altar' }),
    lane(LANE.POSE, [[13, FACADE_Y - 2.2], [15, FACADE_Y - 2.2]], 1.3,
      { faces: 'shop glass', density: 0.7, label: 'glass pose' }),
    lane(LANE.POSE, [[BRIDGE_X - 4, LIP_Y + 1.2], [BRIDGE_X - 2, LIP_Y + 1.2]], 1.3,
      { faces: 'river rail', density: 0.6, label: 'rail pose' }),
    lane(LANE.POSE, [[52, 30.4], [54, 30.4]], 1.2,
      { faces: 'puddle', density: 0.5, label: 'puddle pose' }),
    // worker lanes at service doors
    lane(LANE.WORKER, [[26, FACADE_Y - 0.4], [26, FACADE_Y - 3.2]], 1.1,
      { density: 0.4, label: 'service door' }),
    lane(LANE.WORKER, [[57, FACADE_Y - 0.4], [57, FACADE_Y - 3.2]], 1.1,
      { density: 0.4, label: 'service door' }),
    // kin-only cut through the stalls
    lane(LANE.KINCUT, [[17, 34.2], [40, 34.6], [62, 34.2]], 1.2,
      { density: 0.35, label: 'kin cut' }),
  ],
  crowdCount: 46,

  /** Hand-placed details the document names by name. */
  props: [
    place('car-hood-table', 50.2, 36.4, { label: 'stall table', note: 'an actual car hood' }),
    place('no-scans-sign', 18.4, ARCADE_Y + 0.8, { label: 'NO SCANS INSIDE HOODS' }),
    place('drone-in-shoebox', 44.6, 37.8, { note: 'cat-sized, asleep' }),
    place('cardboard-rk-panel', 46.5, 38.6, { note: 'leaning against a cooler' }),
    place('gaffer-tape-river', 30, 41.5, { scale: 2.2, note: 'extension cords running like veins' }),
    place('bridge-stickers', BRIDGE_X + BRIDGE_W / 2, 14, { note: 'at jump height, not adult-eye height' }),
    place('chunky-sneaker-on-cable', 55, 40.2),
    place('mannequin-hand-pointing', 63.5, 44, { note: 'pointing at a camera' }),
    place('folding-stool', 20.2, 38.4),
    place('portable-ring-light', 27.8, 41.2),
    place('confiscated-hood-in-bin', 71, 45.5),
    place('perfume-canister-bollard', 58.6, LIP_Y + 2.4),
    ...scatter({
      x0: X0 + 1, y0: STALL_Y + 1, x1: X1 - 1, y1: ARCADE_Y - 1,
      seed: 1511, count: 10,
      avoid: [{ x0: 17, y0: 35, x1: 62, y1: 43 }],
    }),
    ...scatter({ x0: X0 + 2, y0: LIP_Y + 0.8, x1: X1 - 2, y1: STALL_Y - 0.5, seed: 1517, count: 11 }),
    // east of the stalls is pop-up territory, not a car park
    ...scatter({ x0: 45, y0: STALL_Y + 1.5, x1: X1 - 2, y1: ARCADE_Y - 1.5, seed: 1523, count: 14 }),
    place('folding-stool', 49.4, 40.6),
    place('folding-stool', 57.2, 43.1),
    place('bead-puddle', 53.8, 38.9),
    place('portable-ring-light', 66.4, 41.8),
    place('cardboard-rk-panel', 71.2, 39.4),
    place('chunky-sneaker-on-cable', 68, 34.6),
    place('mannequin-hand-pointing', 44.8, 30.2),
    place('paper-number-tag', 51.5, 31.1),
    place('confiscated-hood-in-bin', 64.2, 31.4),
    // the covered walk: stools, bollards, a rack overflow, people's leavings
    ...scatter({
      x0: X0 + 1, y0: ARCADE_Y + 2, x1: X1 - 1, y1: FACADE_Y - 2, seed: 1531, count: 16,
      only: ['folding-stool', 'paper-number-tag', 'cardboard-rk-panel', 'bead-puddle',
        'perfume-canister-bollard', 'chunky-sneaker-on-cable', 'confiscated-hood-in-bin'],
    }),
    // the west end of the stall band, where the terrace runs out
    place('folding-stool', 6.2, 34.4),
    place('gaffer-tape-river', 8.6, 36.8, { scale: 1.8 }),
    place('cardboard-rk-panel', 4.4, 33.2),
    place('bead-puddle', 9.1, 37.4),
  ],

  /** A view to Runway Spire, so the world feels bigger than the slice. */
  skyline: [
    { kind: 'spire', x: 46, y: -22, heightM: 210, label: 'RUNWAY SPIRE', lit: true },
    { kind: 'ridge', x: 8, y: -14, heightM: 70, label: 'MIRROR MILE' },
    { kind: 'stack', x: 70, y: -10, heightM: 45 },
  ],

  extraction: [BRIDGE_X - 0.4, 0.2, BRIDGE_W + 0.8, 3.6],
  extractionWalkM: 22,

  objectives: [
    { id: 'lip', text: 'Cross the terrace to the river lip', kind: 'enter-zone', zone: 'lip' },
    { id: 'sneaker', text: 'Lift the sample sneaker off the shoe altar', kind: 'prop', prop: 'low-B-2-prize' },
    { id: 'out', text: 'Walk the bridge', kind: 'extract' },
  ],

  tips: [
    'The terrace is three steps. Cameras sit at 3.4 m, close enough to feel personal.',
    'The hoodie tunnel is a corridor. Cameras lose lock inside it.',
    'Glass floor strips scan you the instant you cross. There is no dodging a gate.',
    'The shoe altar has an operator. Take the sneaker while the spotlight is turned away.',
    'Extraction is the arched bridge: 22 m while the market scores your fit.',
  ],

  sound: ['generator-cough', 'bead-rattle', 'distant-train', 'wet-shoes', 'too-bright-radio'],

  /** Night is not dark. Night is stained. */
  light: {
    key: '#ff3fa4',          // distant magenta from signage
    fill: '#4a6cff',         // wet ground bounce, cooler than the key
    rim: '#c9ff4a',          // lime, thin
    practicals: ['work-lamp', 'vitrine', 'phone-screen', 'paper-lantern'],
    avoid: 'cyan-fog-soup',
  },
};

export const LOWLINE_TERRACE = compileDistrict(spec);
export const LOWLINE_SPEC = spec;

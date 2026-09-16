/**
 * VESTA — districts and contracts.
 *
 * Maps are plain data: walls, zones, cameras, patrols, props. The mission scene
 * is a reader, not an author, so a designer can retune a contract without
 * touching a system.
 */

import { LOWLINE_TERRACE } from './districts/lowline.js';

export const DISTRICTS = {
  lowline: {
    id: 'lowline',
    name: 'LOWLINE',
    blurb: 'Markets. Handmade cardboard-and-bead stalls leaking into digital space. Safest zone in VESTA, which is not the same as safe.',
    wants: ['street', 'craft', 'folk'],
    rejects: ['luxury'],
    sky: ['#2a1140', '#120a24'],
    ground: '#221533',
    neon: '#ff3fa4',
  },
  mirrormile: {
    id: 'mirrormile',
    name: 'MIRROR MILE',
    blurb: 'Boutiques, glass, cameras everywhere. Looks are weapons and everyone is armed.',
    wants: ['luxury', 'holo', 'new'],
    rejects: ['craft'],
    sky: ['#0c1f3d', '#050b18'],
    ground: '#121d33',
    neon: '#6df3ff',
  },
};

const border = (w, h) => [
  { x: 0, y: 0, w, h: 24 },
  { x: 0, y: h - 24, w, h: 24 },
  { x: 0, y: 0, w: 24, h },
  { x: w - 24, y: 0, w: 24, h },
];

/* ---------------------------------------------------------------- TRENDBOMB */

const LOWLINE_TRENDBOMB = {
  id: 'trendbomb',
  type: 'Trendbomb',
  name: 'TRENDBOMB: LOWLINE NIGHT MARKET',
  district: 'lowline',
  brief: 'A stall owner paid us to make one accessory unavoidable. Start a micro-trend in the market and get out before the taste police log the source.',
  objectiveText: 'Get 18 civilians copying your accessory, then leave.',
  targetMinutes: 8,
  world: { w: 1500, h: 1100 },
  spawn: { x: 140, y: 140 },
  payout: { cred: 190, traits: 1 },
  timeLimit: 150,
  mimicTarget: 18,
  walls: [
    ...border(1500, 1100),
    { x: 300, y: 220, w: 220, h: 90, kind: 'stall' },
    { x: 760, y: 180, w: 180, h: 110, kind: 'stall' },
    { x: 1140, y: 300, w: 140, h: 200, kind: 'stall' },
    { x: 220, y: 600, w: 160, h: 150, kind: 'stall' },
    { x: 620, y: 520, w: 240, h: 100, kind: 'stall' },
    { x: 980, y: 760, w: 200, h: 120, kind: 'stall' },
    { x: 480, y: 830, w: 150, h: 110, kind: 'stall' },
  ],
  zones: [
    { id: 'market', name: 'Night Market', rect: { x: 24, y: 24, w: 1452, h: 1052 }, access: 0, wants: [], rejects: [], tint: 'rgba(255,63,164,0.05)' },
  ],
  cameras: [
    { x: 560, y: 120, facing: 90, arc: 56, range: 360, sweep: 50, speed: 0.3 },
    { x: 1360, y: 620, facing: 180, arc: 52, range: 380, sweep: 40, speed: 0.34 },
    { x: 380, y: 1000, facing: 320, arc: 54, range: 350, sweep: 44, speed: 0.27 },
  ],
  guards: [
    { path: [{ x: 700, y: 340 }, { x: 1150, y: 640 }, { x: 700, y: 900 }], speed: 66, sees: 270 },
    { path: [{ x: 240, y: 420 }, { x: 240, y: 900 }], speed: 60, sees: 240 },
  ],
  crowd: { count: 46, areas: [{ x: 60, y: 60, w: 1380, h: 980 }] },
  props: [{ id: 'rack-1', kind: 'rack', x: 900, y: 420, label: 'MARKET RACK' }],
  extraction: { x: 1260, y: 940, w: 200, h: 130 },
  objectives: [
    { id: 'trend', text: 'Make the accessory unavoidable', kind: 'mimic', count: 18 },
    { id: 'out', text: 'Leave on the runway', kind: 'extract' },
  ],
  tips: [
    'Desirability is the fuse. A fit the district wants spreads. A fit it rejects dies.',
    'Folk Glitch converts a crowd faster than anyone. Spark lights it faster but burns Heat.',
    'Copied is a failure state. Spread the trend, then stop being the source.',
  ],
};

/* ----------------------------------------------------------------- FACEJACK */

const MIRROR_FACEJACK = {
  id: 'facejack',
  type: 'Facejack',
  name: 'FACEJACK: MIRROR MILE',
  district: 'mirrormile',
  brief: 'A buyer wants a public identity packet that belongs to somebody with a standing invitation. Take the face. Walk it out before it expires.',
  objectiveText: 'Lift a VIP packet, hold it out of the building, extract.',
  targetMinutes: 10,
  world: { w: 1700, h: 1100 },
  spawn: { x: 150, y: 950 },
  payout: { cred: 320, traits: 3 },
  walls: [
    ...border(1700, 1100),
    { x: 420, y: 24, w: 28, h: 420, kind: 'glass' },
    { x: 420, y: 640, w: 28, h: 436, kind: 'glass' },
    { x: 448, y: 640, w: 500, h: 28, kind: 'glass' },
    { x: 1080, y: 300, w: 28, h: 500, kind: 'glass' },
    { x: 1108, y: 300, w: 440, h: 28, kind: 'glass' },
    { x: 700, y: 180, w: 220, h: 90, kind: 'stall' },
    { x: 1250, y: 820, w: 200, h: 100, kind: 'stall' },
  ],
  zones: [
    { id: 'street', name: 'Mile Street', rect: { x: 24, y: 24, w: 396, h: 1052 }, access: 0, wants: [], rejects: [], tint: 'rgba(109,243,255,0.04)' },
    {
      id: 'boutique', name: 'Boutique Floor', rect: { x: 448, y: 24, w: 632, h: 612 },
      access: 1, wants: ['luxury', 'holo', 'new'], rejects: ['craft'], minDesire: 4,
      tint: 'rgba(109,243,255,0.07)',
      door: { x: 420, y: 444, w: 28, h: 196, facing: 'v' },
    },
    {
      id: 'salon', name: 'Private Salon', rect: { x: 1108, y: 328, w: 440, h: 472 },
      access: 3, wants: ['luxury', 'holo'], rejects: ['street', 'craft'], minDesire: 9,
      tint: 'rgba(255,255,255,0.06)',
      door: { x: 1080, y: 520, w: 28, h: 140, facing: 'v' },
    },
  ],
  cameras: [
    { x: 300, y: 300, facing: 30, arc: 50, range: 340, sweep: 40, speed: 0.3 },
    { x: 620, y: 120, facing: 80, arc: 54, range: 380, sweep: 36, speed: 0.36 },
    { x: 1000, y: 560, facing: 200, arc: 50, range: 400, sweep: 30, speed: 0.4 },
    { x: 1500, y: 380, facing: 200, arc: 56, range: 420, sweep: 34, speed: 0.32 },
    { x: 760, y: 900, facing: 300, arc: 52, range: 380, sweep: 46, speed: 0.28 },
  ],
  guards: [
    { path: [{ x: 560, y: 200 }, { x: 980, y: 520 }, { x: 560, y: 560 }], speed: 72, sees: 300 },
    { path: [{ x: 1200, y: 420 }, { x: 1460, y: 720 }], speed: 68, sees: 320 },
    { path: [{ x: 200, y: 300 }, { x: 200, y: 900 }], speed: 60, sees: 250 },
  ],
  crowd: {
    count: 30,
    areas: [{ x: 60, y: 60, w: 340, h: 980 }, { x: 470, y: 60, w: 580, h: 540 }],
  },
  vip: { x: 1380, y: 520, label: 'HOUSE BUYER' },
  props: [{
    id: 'rack-1', kind: 'rack', x: 620, y: 420, label: 'BOUTIQUE RACK',
    grants: { tags: ['luxury', 'new'], access: 1, duration: 75 },
  }],
  extraction: { x: 60, y: 60, w: 200, h: 170 },
  objectives: [
    { id: 'salon', text: 'Reach the private salon', kind: 'enter-zone', zone: 'salon' },
    { id: 'packet', text: 'Lift the buyer’s identity packet', kind: 'vip' },
    { id: 'out', text: 'Walk the face out on the runway', kind: 'extract' },
  ],
  tips: [
    'Mirror’s Glass Coat borrows a packet. The salon does not check whose it was.',
    'Glass is a camera. Reflections scan too.',
    'Craft reads wrong on the Mile. Leave the beads at home or wear them on purpose.',
  ],
};

/**
 * The built city. Lowline is authored in metres against the VESTA architecture
 * (src/data/districts/lowline.js) and checked by tools/verify-vesta.mjs.
 * Trendbomb and Facejack are still on the pre-VESTA layouts and are queued for
 * rebuild against the same street kit -- see docs/VESTA.md.
 */
export const MISSIONS = [LOWLINE_TERRACE, LOWLINE_TRENDBOMB, MIRROR_FACEJACK];
export const MISSION_BY_ID = Object.fromEntries(MISSIONS.map((m) => [m.id, m]));

/** A night is three contracts. */
export const NIGHT = ['lowline-terrace', 'trendbomb', 'facejack'];

export function getMission(id) {
  const m = MISSION_BY_ID[id];
  if (!m) throw new Error(`Unknown contract: ${id}`);
  return m;
}

export function getDistrict(id) {
  return DISTRICTS[id];
}

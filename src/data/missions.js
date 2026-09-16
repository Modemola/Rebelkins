/**
 * VESTA — districts and contracts.
 *
 * Maps are plain data: walls, zones, cameras, patrols, props. The mission scene
 * is a reader, not an author, so a designer can retune a contract without
 * touching a system.
 */

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

/* ---------------------------------------------------------------- GHOST FIT */

const LOWLINE_GHOST = {
  id: 'ghost-fit',
  type: 'Ghost Fit',
  name: 'GHOST FIT: THE BACK FLOOR',
  district: 'lowline',
  brief: 'A prototype jacket is sitting in a Lowline sample vault behind a members-only floor. Enter using only clothes. Take the jacket. Walk out looking like you were invited.',
  objectiveText: 'Enter the members floor, extract the prototype, leave on the runway.',
  targetMinutes: 12,
  world: { w: 1900, h: 1200 },
  spawn: { x: 130, y: 130 },
  payout: { cred: 240, traits: 2 },
  walls: [
    ...border(1900, 1200),
    // market stalls
    { x: 140, y: 190, w: 180, h: 90, kind: 'stall' },
    { x: 420, y: 140, w: 160, h: 100, kind: 'stall' },
    { x: 180, y: 520, w: 140, h: 140, kind: 'stall' },
    { x: 460, y: 610, w: 200, h: 90, kind: 'stall' },
    { x: 250, y: 860, w: 180, h: 100, kind: 'stall' },
    { x: 600, y: 300, w: 90, h: 220, kind: 'stall' },
    { x: 620, y: 880, w: 160, h: 90, kind: 'stall' },
    // the divider. gap at y 420-580 is the members door
    { x: 890, y: 24, w: 30, h: 396 },
    { x: 890, y: 580, w: 30, h: 596 },
    // lounge floor / service corridor split. gap at x 1000-1130
    { x: 920, y: 596, w: 80, h: 28 },
    { x: 1130, y: 596, w: 746, h: 28 },
    // vault wall. gap at y 900-1020 is the vault door
    { x: 1370, y: 624, w: 28, h: 276 },
    { x: 1370, y: 1020, w: 28, h: 156 },
  ],
  zones: [
    {
      id: 'market', name: 'Lowline Market', rect: { x: 24, y: 24, w: 866, h: 1152 },
      access: 0, wants: [], rejects: [], tint: 'rgba(255,63,164,0.05)',
    },
    {
      id: 'lounge', name: 'Members Floor', rect: { x: 920, y: 24, w: 956, h: 572 },
      access: 1, wants: ['luxury', 'holo', 'quiet', 'new'], rejects: [], minDesire: 4,
      tint: 'rgba(120,180,255,0.07)',
      door: { x: 890, y: 420, w: 30, h: 160, facing: 'v' },
    },
    {
      id: 'corridor', name: 'Service Corridor', rect: { x: 920, y: 624, w: 450, h: 552 },
      access: 1, wants: [], rejects: [], tint: 'rgba(255,255,255,0.03)',
    },
    {
      id: 'vault', name: 'Sample Vault', rect: { x: 1398, y: 624, w: 478, h: 552 },
      access: 2, wants: ['luxury', 'holo'], rejects: [], minDesire: 6,
      tint: 'rgba(255,214,0,0.06)',
      door: { x: 1370, y: 900, w: 28, h: 120, facing: 'v' },
    },
  ],
  cameras: [
    { x: 700, y: 210, facing: 200, arc: 52, range: 330, sweep: 34, speed: 0.35 },
    { x: 700, y: 760, facing: 160, arc: 52, range: 320, sweep: 40, speed: 0.28 },
    { x: 1010, y: 500, facing: 180, arc: 46, range: 350, sweep: 22, speed: 0.4 },
    { x: 1790, y: 110, facing: 145, arc: 58, range: 430, sweep: 30, speed: 0.25 },
    { x: 1120, y: 940, facing: 10, arc: 50, range: 380, sweep: 46, speed: 0.33 },
    { x: 1820, y: 1120, facing: 200, arc: 60, range: 440, sweep: 28, speed: 0.3 },
  ],
  guards: [
    { path: [{ x: 780, y: 320 }, { x: 780, y: 940 }], speed: 62, sees: 260 },
    { path: [{ x: 1080, y: 150 }, { x: 1760, y: 400 }, { x: 1080, y: 470 }], speed: 70, sees: 300 },
    { path: [{ x: 1010, y: 1100 }, { x: 1320, y: 720 }], speed: 58, sees: 250 },
  ],
  crowd: { count: 34, areas: [{ x: 60, y: 60, w: 800, h: 1080 }] },
  props: [
    { id: 'jacket', kind: 'objective', x: 1740, y: 960, label: 'PROTOTYPE JACKET' },
    { id: 'rack-1', kind: 'rack', x: 300, y: 400, label: 'STREET RACK' },
    {
      id: 'rack-2', kind: 'rack', x: 1120, y: 300, label: 'LOUNGE RACK',
      grants: { tags: ['luxury', 'holo'], access: 1, duration: 75 },
    },
  ],
  extraction: { x: 60, y: 1010, w: 200, h: 150 },
  objectives: [
    { id: 'lounge', text: 'Get onto the members floor', kind: 'enter-zone', zone: 'lounge' },
    { id: 'jacket', text: 'Extract the prototype jacket', kind: 'prop', prop: 'jacket' },
    { id: 'out', text: 'Leave on the runway', kind: 'extract' },
  ],
  tips: [
    'Doors read the packet, not the person. Compile something the floor wants.',
    'A rack is a key. Pull a piece off one and you read as the people who shop there.',
    'A camera that fills its bar flags you. Heat is the clock, not a timer.',
    'Crowds are cover. Three civilians close by and you scan slower.',
  ],
};

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

export const MISSIONS = [LOWLINE_GHOST, LOWLINE_TRENDBOMB, MIRROR_FACEJACK];
export const MISSION_BY_ID = Object.fromEntries(MISSIONS.map((m) => [m.id, m]));

/** A night is three contracts. */
export const NIGHT = ['ghost-fit', 'trendbomb', 'facejack'];

export function getMission(id) {
  const m = MISSION_BY_ID[id];
  if (!m) throw new Error(`Unknown contract: ${id}`);
  return m;
}

export function getDistrict(id) {
  return DISTRICTS[id];
}

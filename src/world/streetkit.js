/**
 * THE STREET KIT.
 *
 * Every walkable street contains this exact kit unless a note cancels it. It is
 * generated, not hand-placed, so a new street cannot quietly forget its drains
 * or float its cameras up to eight metres.
 *
 *  1. Kerb stone 18 cm, rounded, stained purple-black
 *  2. Tactile paving at crossings, brass-yellow, studs missing, sequin-epoxy repairs
 *  3. Puddle map: long skinny mirrors against shopfronts, not random blobs
 *  4. Drain mouths every 12-18 m, engraved with a tiny THREAD logo
 *  5. Bolt-down cameras at 3.4 m. Housings look like steam irons or tailor clamps
 *  6. Identity gates: frosted glass floor strips that bloom a scan-line
 *  7. Railings 1.1 m, mustard or oxidized coral, cloth tags tied on by crews
 *  8. Overhead wires only in Lowline and Undercut
 *  9. Smell proxies: steam food, hot plastic, rain on dust, perfume exhaust
 * 10. Trash is fashionable. Lost sleeves, cracked heels, mannequin hands
 */

import { m, cm, LAW } from './units.js';

/** Deterministic noise, so a street looks scattered but rebuilds identically. */
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];
const between = (r, [lo, hi]) => lo + r() * (hi - lo);

/* ---------------------------------------------------------------- 1. kerb */

export function kerb(x0, x1, y, opts = {}) {
  return {
    kind: 'kerb',
    x: m(x0), y: m(y), w: m(x1 - x0), h: cm(LAW.kerbHeight * 100),
    heightM: LAW.kerbHeight,
    side: opts.side || 'north',
  };
}

/* ------------------------------------------------------- 2. tactile paving */

export function crossing(x, y, widthM, seed = 7) {
  const r = rng(seed);
  const studs = [];
  const cols = Math.round(widthM / 0.4);
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < 5; j++) {
      const roll = r();
      studs.push({
        x: m(x + i * 0.4 + 0.2),
        y: m(y + j * 0.4 + 0.2),
        // some studs missing, some replaced with sequin-epoxy repairs
        state: roll < 0.12 ? 'missing' : roll < 0.2 ? 'sequin' : 'brass',
      });
    }
  }
  return { kind: 'crossing', x: m(x), y: m(y), w: m(widthM), h: m(2), studs };
}

/* ----------------------------------------------------------- 3. puddle map */

/**
 * Long skinny mirrors against shopfronts, not random blobs. A puddle exists to
 * catch a sign and throw it back at a sneaker, so it runs parallel to the
 * facade it is reflecting.
 */
export function puddleMap(facadeX0, facadeX1, facadeY, seed = 11, opts = {}) {
  const r = rng(seed);
  const out = [];
  const depth = opts.depth ?? 0.9;
  let x = facadeX0 + r() * 3;
  while (x < facadeX1 - 2) {
    const len = 2.5 + r() * 6.5;
    out.push({
      kind: 'puddle',
      x: m(x), y: m(facadeY + 0.25 + r() * 0.5),
      w: m(Math.min(len, facadeX1 - x)), h: m(depth * (0.6 + r() * 0.6)),
      sequins: r() < 0.35,
      reflects: opts.reflects ?? true,
    });
    x += len + 1.5 + r() * 5;
  }
  return out;
}

/* ----------------------------------------------------------- 4. drain mouths */

export function drains(x0, x1, y, seed = 13) {
  const r = rng(seed);
  const out = [];
  let x = x0 + between(r, LAW.drainSpacing) * 0.5;
  while (x < x1) {
    out.push({
      kind: 'drain',
      x: m(x), y: m(y),
      // sometimes clogged with hair-ties and snap buttons
      clogged: r() < 0.3,
      logo: true, // engraved with a tiny THREAD logo
    });
    x += between(r, LAW.drainSpacing);
  }
  return out;
}

/* --------------------------------------------------------------- 5. cameras */

/**
 * Bolt-down cameras at 3.4 m, not 8 m. Close enough to feel personal.
 * Housings look like steam irons or tailor clamps.
 */
export function camera(x, y, facingDeg, opts = {}) {
  return {
    kind: 'camera',
    x: m(x), y: m(y),
    heightM: LAW.cameraHeight,
    housing: opts.housing || 'iron',   // 'iron' | 'clamp'
    facing: facingDeg,
    arc: opts.arc ?? 50,
    range: m(opts.rangeM ?? 12),
    sweep: opts.sweep ?? 34,
    speed: opts.speed ?? 0.32,
    // A Lowline camera is aimed at the hanging sample on its hook, not the door.
    aimedAt: opts.aimedAt || null,
    layer: opts.layer ?? 0,
  };
}

/* -------------------------------------------------------- 6. identity gates */

/** Floor strips of frosted glass that bloom a faint scan-line when a Kin walks over. */
export function scanStrip(x, y, widthM, depthM = 1.2, opts = {}) {
  return {
    kind: 'scanStrip',
    x: m(x), y: m(y), w: m(widthM), h: m(depthM),
    // A strip reads your packet the instant you cross it: no cone, no dodging.
    instant: true,
    label: opts.label || 'IDENTITY GATE',
  };
}

/* ------------------------------------------------------------- 7. railings */

export function railing(x0, y0, x1, y1, seed = 17, opts = {}) {
  const r = rng(seed);
  const tags = [];
  const len = Math.hypot(x1 - x0, y1 - y0);
  const count = Math.floor(len / 3.5);
  for (let i = 0; i < count; i++) {
    if (r() > 0.55) continue;
    const t = (i + 0.5) / count;
    // cloth tags tied on by crews
    tags.push({ x: m(x0 + (x1 - x0) * t), y: m(y0 + (y1 - y0) * t), hue: Math.floor(r() * 360) });
  }
  return {
    kind: 'railing',
    x0: m(x0), y0: m(y0), x1: m(x1), y1: m(y1),
    heightM: LAW.railHeight,
    color: opts.color || (r() < 0.5 ? 'mustard' : 'coral'),
    tags,
    // Sneaker-height shots must work, so a rail never becomes a solid wall.
    seeThrough: true,
  };
}

/* --------------------------------------------------------- 8. overhead wires */

/** Only in Lowline and Undercut. Mirror Mile hides them. */
export function wires(x0, x1, y, seed = 19, count = 4) {
  const r = rng(seed);
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push({
      kind: 'wire',
      x0: m(x0), x1: m(x1),
      y: m(y + (r() - 0.5) * 2.5),
      sag: 0.6 + r() * 1.4,
      taped: r() < 0.4, // extension cords taped in silver gaffer, running like veins
    });
  }
  return out;
}

/* ------------------------------------------- cloth in the architecture */

/**
 * Banners, drying jackets and tarps strung between poles and wires. Cloth is a
 * building material in VESTA, not set dressing, so it hangs across the street
 * rather than sitting against a wall.
 */
export function clothLine(x0, x1, y, seed = 21, opts = {}) {
  const r = rng(seed);
  const out = [];
  let x = x0;
  while (x < x1 - 1.5) {
    const span = 1.6 + r() * 2.6;
    out.push({
      kind: 'cloth',
      x: m(x), y: m(y + (r() - 0.5) * 0.8),
      w: m(Math.min(span, x1 - x)),
      dropM: 0.9 + r() * 1.4,
      hue: Math.floor(r() * 360),
      type: opts.type || (r() < 0.4 ? 'banner' : r() < 0.7 ? 'jacket' : 'tarp'),
      sag: 0.3 + r() * 0.5,
    });
    x += span + 0.6 + r() * 2.4;
  }
  return out;
}

/* ------------------------------------------------------- 9. smell proxies */

/**
 * Smell has no channel, so it is modelled as something you can see and hear:
 * steam plumes, heat shimmer, vent exhaust. Each one is a light source and a
 * sound emitter as well as a smell.
 */
export function vent(x, y, type) {
  return {
    kind: 'vent',
    x: m(x), y: m(y),
    type, // 'steam-food' | 'hot-plastic' | 'rain-dust' | 'perfume'
    warm: type === 'perfume' || type === 'steam-food',
  };
}

/* ------------------------------------------------------ 10. fashionable trash */

const TRASH = [
  'lost-sleeve', 'cracked-heel', 'mannequin-hand', 'thermal-receipt',
  'hologram-comb', 'paper-tag', 'snap-button', 'hair-tie',
];

/** Not bags of garbage. The city sheds clothes. */
export function litter(x0, x1, y0, y1, seed = 23, count = 14) {
  const r = rng(seed);
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push({
      kind: 'litter',
      type: pick(r, TRASH),
      x: m(x0 + r() * (x1 - x0)),
      y: m(y0 + r() * (y1 - y0)),
      rot: r() * Math.PI * 2,
    });
  }
  return out;
}

/* ----------------------------------------------------------------- facades */

/**
 * Ground floor pattern, repeating every 7-9 m:
 *   roll-up shutter / deep threshold 70-110 cm / one hanging sample on a hook
 *   outside / a camera aimed at the hook, not the door / interior depth 6-12 m.
 */
export function shopRow(x0, x1, y, seed = 29, opts = {}) {
  const r = rng(seed);
  const shops = [];
  const cams = [];
  let x = x0;
  let i = 0;
  while (x < x1 - 4) {
    const width = between(r, LAW.shopfrontRepeat);
    if (x + width > x1) break;
    const threshold = between(r, LAW.shopThreshold);
    const depth = between(r, LAW.shopInteriorDepth);
    const shop = {
      kind: 'shop',
      id: `${opts.prefix || 'shop'}-${i}`,
      x: m(x), y: m(y), w: m(width),
      thresholdM: threshold,
      depthM: depth,
      heightM: between(r, LAW.shopfrontHeight),
      shutter: r() < 0.45,
      // one hanging sample on a hook outside
      hook: { x: m(x + width * (0.25 + r() * 0.5)), y: m(y - threshold * 0.6) },
      interior: opts.interiorTint || 'oxblood',
    };
    shops.push(shop);
    // a camera aimed at the hook, not the door
    cams.push(camera(
      x + width * 0.5, y - 1.2, 90,
      { housing: r() < 0.5 ? 'iron' : 'clamp', aimedAt: shop.hook, rangeM: 9 + r() * 4, arc: 46 },
    ));
    x += width;
    i++;
  }
  return { shops, cams };
}

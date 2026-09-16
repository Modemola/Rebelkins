/**
 * MICRO-PROP LIBRARY. Modelled once, scattered everywhere.
 *
 * "If a scene feels empty, add three of these before adding more buildings."
 * scatter() enforces exactly that instinct.
 */

import { m } from './units.js';
import { rng } from './streetkit.js';

export const MICRO_PROPS = [
  'chunky-sneaker-on-cable',
  'chain-belt-door-closer',
  'mannequin-hand-pointing',
  'cardboard-rk-panel',
  'cracked-hologram-comb',
  'perfume-canister-bollard',
  'floor-scan-strip',
  'tailor-clamp-camera',
  'bead-puddle',
  'paper-number-tag',
  'seatbelt-from-architecture',
  'folding-stool',
  'gaffer-tape-river',
  'portable-ring-light',
  'confiscated-hood-in-bin',
];

/** Props that throw light, and therefore belong to the lighting recipe. */
export const PRACTICAL_PROPS = new Set([
  'portable-ring-light', 'tailor-clamp-camera', 'cracked-hologram-comb',
]);

/**
 * Scatter micro-props through a region. Deterministic, so a district looks
 * lived-in without being different every load.
 */
export function scatter({ x0, y0, x1, y1, seed = 37, count = 12, only = null, avoid = [] }) {
  const r = rng(seed);
  const pool = only || MICRO_PROPS;
  const out = [];
  let guard = 0;
  while (out.length < count && guard++ < count * 12) {
    const x = x0 + r() * (x1 - x0);
    const y = y0 + r() * (y1 - y0);
    if (avoid.some((a) => x > a.x0 && x < a.x1 && y > a.y0 && y < a.y1)) continue;
    out.push({
      kind: 'prop',
      type: pool[Math.floor(r() * pool.length) % pool.length],
      x: m(x), y: m(y),
      rot: r() * Math.PI * 2,
      scale: 0.85 + r() * 0.4,
    });
  }
  return out;
}

/** A named, hand-placed prop, for the details the document calls out by name. */
export function place(type, xM, yM, opts = {}) {
  return {
    kind: 'prop', type, x: m(xM), y: m(yM),
    rot: opts.rot ?? 0, scale: opts.scale ?? 1,
    label: opts.label || null, note: opts.note || null,
  };
}

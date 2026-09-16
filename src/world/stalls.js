/**
 * STALL ANATOMY. Each stall is a character, so each type carries its own
 * dimensions, its own dressing and its own rule. The rules are the point:
 * a hoodie tunnel where cameras do not lose lock is just scenery.
 *
 * Aisle width between stalls: 1.4-2.2 m. Tight on purpose. Shoulders clip cloth.
 */

import { m, LAW } from './units.js';
import { rng } from './streetkit.js';

export const STALL_TYPES = {
  /** Type A — Bead and sequin booth. */
  A: {
    id: 'A', name: 'Bead and sequin booth',
    widthM: 2.4, depthM: 1.8,
    fascia: 'plywood+cardboard',
    dressing: ['hot-glue-glitter', 'work-lamp-spring-arm', 'patched-vinyl-stool', 'cut-billboard-mat'],
    lamp: true,
    rule: null,
  },
  /** Type B — Shoe altar. One pair, one spotlight, one operator who can turn. */
  B: {
    id: 'B', name: 'Shoe altar',
    widthM: 1.6, depthM: 1.6,
    fascia: 'pedestal',
    dressing: ['rotating-plate', 'cheap-spotlight', 'bikelock-velvet-rope'],
    lamp: true,
    rule: 'spotlight',
  },
  /**
   * Type C — Hoodie tunnel. Rack so dense it becomes a corridor. Players can
   * crouch-walk through hanging garments. Cameras lose lock inside.
   */
  C: {
    id: 'C', name: 'Hoodie tunnel',
    widthM: 2.2, depthM: 6.5,
    fascia: 'rack',
    dressing: ['dense-hanging-garments', 'paper-number-tags'],
    lamp: false,
    rule: 'losesLock',
    walkable: true,
    crouch: true,
  },
  /** Type D — Folk repair. Opens a side mission later. */
  D: {
    id: 'D', name: 'Folk repair',
    widthM: 2.8, depthM: 2.2,
    fascia: 'timber',
    dressing: ['embroidery-frames', 'bead-jars', 'paper-lantern', 'seated-kin'],
    lamp: 'lantern',
    rule: 'sideMission',
  },
  /** Type E — Illegal compile kiosk. Looks like a phone-repair booth. */
  E: {
    id: 'E', name: 'Illegal compile kiosk',
    widthM: 2.0, depthM: 2.0,
    fascia: 'booth',
    dressing: ['black-curtain', 'floor-scanner', 'kettle-steam'],
    lamp: false,
    rule: 'illegalCompile',
    fogged: true, // steam from a kettle, so the interior is always slightly fogged
  },
};

/**
 * Lay a band of stalls along a run, keeping every aisle inside 1.4-2.2 m.
 *
 * @param spec {x0, x1, y, types:string[], seed}
 */
export function stallBand({ x0, x1, y, types, seed = 31, prefix = 'stall' }) {
  const r = rng(seed);
  const out = [];
  let x = x0;
  let i = 0;
  for (const code of types) {
    const t = STALL_TYPES[code];
    if (!t) throw new Error(`unknown stall type ${code}`);
    if (x + t.widthM > x1) break;
    out.push({
      kind: 'stall',
      id: `${prefix}-${code}-${i}`,
      type: code,
      name: t.name,
      x: m(x), y: m(y),
      w: m(t.widthM), h: m(t.depthM),
      widthM: t.widthM, depthM: t.depthM,
      rule: t.rule,
      walkable: !!t.walkable,
      crouch: !!t.crouch,
      fogged: !!t.fogged,
      lamp: t.lamp,
      dressing: t.dressing,
      fascia: t.fascia,
    });
    // Tight on purpose. Shoulders clip cloth.
    const aisle = LAW.stallAisle[0] + r() * (LAW.stallAisle[1] - LAW.stallAisle[0]);
    out.push({ kind: 'aisle', x: m(x + t.widthM), y: m(y), w: m(aisle), widthM: aisle });
    x += t.widthM + aisle;
    i++;
  }
  return out;
}

/** The stalls only, without the aisle markers the verifier reads. */
export const stallsOnly = (band) => band.filter((s) => s.kind === 'stall');
export const aislesOnly = (band) => band.filter((s) => s.kind === 'aisle');

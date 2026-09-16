/**
 * CROWD ARCHITECTURE.
 *
 * Do not sprinkle NPCs. Build lanes.
 *
 *   Fast lane   against the shop windows
 *   Slow lane   under canopies
 *   Pose lane   at every reflective surface
 *   Worker lane at service doors
 *   Kin-only    cuts through stalls
 *
 * "If a space has no obvious place to stand and be seen, it is unfinished."
 * A district with no POSE lane fails tools/verify-vesta.mjs for that reason.
 */

import { m, LANE, LANE_SPEED, PPM } from './units.js';
import { rng } from './streetkit.js';

/**
 * @param type   one of LANE
 * @param pts    polyline in metres [[x,y], ...]
 * @param widthM lateral spread the lane occupies
 */
export function lane(type, pts, widthM = 1.6, opts = {}) {
  const points = pts.map(([x, y]) => ({ x: m(x), y: m(y) }));
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return {
    kind: 'lane',
    type,
    points,
    width: m(widthM),
    widthM,
    length,
    lengthM: length / PPM,
    // Pose lanes hold still; everything else circulates.
    loop: opts.loop ?? (type !== LANE.POSE),
    /** Reflective surface this pose lane exists to face. */
    faces: opts.faces || null,
    density: opts.density ?? 1,
    label: opts.label || null,
  };
}

/** Position and heading at a distance along a lane. */
export function samplePath(ln, dist) {
  const pts = ln.points;
  let d = ((dist % ln.length) + ln.length) % ln.length;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (d <= seg) {
      const t = seg === 0 ? 0 : d / seg;
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        angle: Math.atan2(b.y - a.y, b.x - a.x),
      };
    }
    d -= seg;
  }
  const last = pts[pts.length - 1];
  return { x: last.x, y: last.y, angle: 0 };
}

/**
 * Populate lanes with civilians, weighted by each lane's length and density so
 * a long shopfront run actually carries more people than a short service door.
 */
export function populate(lanes, total, seed = 41) {
  const r = rng(seed);
  const weights = lanes.map((l) => l.lengthM * l.density);
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const out = [];

  lanes.forEach((ln, i) => {
    const share = Math.max(ln.type === LANE.POSE ? 2 : 1, Math.round((weights[i] / sum) * total));
    for (let k = 0; k < share; k++) {
      const [lo, hi] = LANE_SPEED[ln.type];
      out.push({
        laneIndex: i,
        dist: r() * ln.length,
        offset: (r() - 0.5) * ln.width,
        speed: m(lo + r() * (hi - lo)),
        dir: ln.type === LANE.FAST && r() < 0.45 ? -1 : 1,
        // Pose-lane civilians stop, check themselves, and move a step.
        poseT: r() * 4,
        seedR: r(),
      });
    }
  });
  return out;
}

/**
 * Build the standard lane set for a street with shopfronts on one side and
 * something to look at on the other. Most districts want exactly this.
 */
export function standardStreetLanes({
  x0, x1, facadeY, canopyY, poseAnchors = [], serviceDoors = [], kinCut = null,
}) {
  const out = [
    lane(LANE.FAST, [[x0, facadeY + 0.9], [x1, facadeY + 0.9]], 1.5, { label: 'shop windows', density: 1.3 }),
    lane(LANE.SLOW, [[x0, canopyY], [x1, canopyY]], 2.2, { label: 'under canopies', density: 1 }),
  ];
  poseAnchors.forEach((p, i) => {
    out.push(lane(LANE.POSE, [[p.x - 0.8, p.y], [p.x + 0.8, p.y]], 1.4, {
      faces: p.faces || 'glass', density: 0.6, label: p.label || `pose ${i + 1}`,
    }));
  });
  serviceDoors.forEach((d, i) => {
    out.push(lane(LANE.WORKER, [[d.x, d.y], [d.x, d.y + (d.runM ?? 3)]], 1.1, {
      density: 0.4, label: d.label || `service ${i + 1}`,
    }));
  });
  if (kinCut) {
    out.push(lane(LANE.KINCUT, kinCut, 1.2, { density: 0.3, label: 'kin cut' }));
  }
  return out;
}

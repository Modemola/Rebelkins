/** Shared easing and phase helpers for authoring frame data. */

export const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
export const seg = (u, a, b) => clamp01((u - a) / (b - a));
export const easeOut = (t) => 1 - (1 - t) ** 3;
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const anticipate = (t) => { const c = 2.2; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };

/**
 * Split a move's elapsed frames into the three phases a fighter is built on.
 * `strike` runs 0..1 across startup+active and back to 0 through recovery, so a
 * pose can be written as one number instead of three cases.
 */
export function phases(frame, m) {
  const total = m.startup + m.active + m.recovery;
  const wind = seg(frame, 0, m.startup);
  const hit = seg(frame, m.startup, m.startup + m.active);
  const rec = seg(frame, m.startup + m.active, total);
  return { wind, hit, rec, strike: easeOut(hit) - easeInOut(rec), total };
}

export const totalFrames = (m) => m.startup + m.active + m.recovery;

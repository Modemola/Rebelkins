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
  /**
   * `strike` runs 0..1 and back, and is what every pose was written against.
   * It has two faults that read as stiffness, and both are about time rather
   * than about any pose.
   *
   * It stops dead. A limb arrives at full extension and holds there for a
   * frame -- measured on KIN 01's jab, per-frame travel went 51, 18, 3, 0 --
   * where a real one whips slightly past and settles back. `thrown` overshoots
   * through `anticipate` and then rings down.
   *
   * And it comes back the way it went. Recovery is twice the length of the
   * active window, so a symmetric curve rewinds the punch in slow motion.
   * `thrown` pulls the limb back over the first third of the recovery, which
   * also puts the limb ahead of the body on the way home -- the overlap that
   * stops every part of a character arriving on the same frame.
   */
  const thrown = anticipate(hit) * (1 - easeOut(Math.min(1, rec / 0.34)));
  /**
   * The wind-up, which has to come back out again.
   *
   * Poses used `anticipate(wind)` for this, and `wind` saturates at 1 the
   * moment the startup ends -- so the coil stayed fully applied for the whole
   * active window and the whole recovery, and the move's last frame sat 40
   * pixels away from the idle it returned to. Every attack ended with a snap.
   * `(1 - easeOut(hit))` takes it back out as the strike goes, and the pow
   * spreads the coil over the startup frames instead of jumping 77% of the way
   * into it on the first one.
   */
  const coil = Math.pow(wind, 1.7) * (1 - easeOut(hit));
  /** A decaying wobble through the recovery, so nothing arrives at a dead stop. */
  const settle = Math.sin(rec * Math.PI * 3.4) * Math.max(0, 1 - rec / 0.8) ** 2;
  return { wind, hit, rec, strike: easeOut(hit) - easeInOut(rec), thrown, coil, settle, total };
}

export const totalFrames = (m) => m.startup + m.active + m.recovery;

/**
 * Clamp a move's stun so that it always leaves the other fighter a turn.
 *
 * Weight alone cannot set stun values, because what makes a move fair is its
 * own length, and both of these were set from damage only. Two separate ways
 * for a move to leave no turn at all, both found by measurement:
 *
 * `hitstun` longer than `recovery + startup` is a move that loops into
 * itself. That sum is how long it is before the same move can be active
 * again, so a longer stun means the defender leaves hitstun after the next
 * swing is already out, and never acts again. kin02's cross -- 4/3/8 frames,
 * 18 frames of hitstun against a 12-frame gap -- was exactly that, and so was
 * every other light in the cast.
 *
 * `blockstun` has to leave the fighter who blocked enough of a head start to
 * answer with something. Worst case the hitbox connects on the first active
 * frame, so the attacker sits through `active - 1 + recovery`; subtracting
 * the blockstun from that is the defender's advantage, and it has to cover
 * the startup of the quickest move in the cast, which is six frames. The
 * cross again: 11 frames of blockstun against 10 of recovery put the fighter
 * who blocked at *-1*, so pressing buttons was strictly better than
 * defending and a jab had no answer at all.
 *
 * Together these are why an opponent that walked forward mashing its fastest
 * button beat every policy tried against it, the AI included, in 89 of 90
 * rounds. Both clamps bind only on the fast lights; a heavy already recovers
 * for far longer than it stuns, and stays punishable on block.
 */
/** Startup of the quickest move in the cast, which blockstun has to leave room for. */
export const FASTEST_STARTUP = 6;

export function capStun(m) {
  const hitstun = Math.min(m.hitstun, m.recovery + m.startup - 2);
  const blockstun = Math.min(m.blockstun, m.active - 1 + m.recovery - FASTEST_STARTUP);
  return hitstun === m.hitstun && blockstun === m.blockstun ? m : { ...m, hitstun, blockstun };
}

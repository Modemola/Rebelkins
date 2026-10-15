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

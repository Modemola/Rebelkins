/**
 * Shared stance and move construction.
 *
 * Eight characters came out of eight one-off illustrations, and five of them
 * have their arms folded or pocketed so tightly that no arm could be cut free.
 * That split -- armed or welded -- is the only structural difference between
 * them, so it is the only thing the poses here branch on. Everything that gives
 * a character its feel (reach, frame data, damage, how far a move carries) stays
 * in the character's own file as numbers.
 *
 * A pose may name parts a rig does not have: solve() reads `pose[part.name]`
 * per part, so an armL key on an armless rig is simply never looked up. That is
 * what lets one set of curves drive both kinds.
 */

import { phases, seg, easeOut, easeInOut, anticipate } from './common.js';

/**
 * @param armed  true when the rig has armL/armR to swing.
 * @param weight 0 light and quick, 1 heavy and planted. Scales how far the
 *               body travels on every idle breath and every recoil.
 */
export function stance({ armed = true, weight = 0.5 } = {}) {
  const w = 0.7 + weight * 0.6; // heavier characters move through more distance
  const q = 1.25 - weight * 0.5; // ...and lighter ones move through it faster

  return {
    idle(t) {
      const b = Math.sin(t * 2.0 * q);
      const s = Math.sin(t * 0.9 * q);
      return {
        torso: { rot: s * 0.015, y: b * 2.2 * w },
        hips: { rot: -s * 0.012 },
        head: { rot: -s * 0.028 + Math.sin(t * 0.6) * 0.02 },
        armL: { rot: s * 0.05 + 0.02 }, armR: { rot: -s * 0.055 },
        legL: { rot: s * 0.01 }, legR: { rot: -s * 0.01 },
      };
    },

    walk(t, dir) {
      const p = t * 7.2 * q;
      const lean = dir > 0 ? 0.05 : -0.03;
      const swing = armed ? 0.32 : 0.14; // folded arms barely swing
      return {
        torso: { rot: lean + Math.sin(p * 2) * 0.02, y: -Math.abs(Math.sin(p)) * 5 * w },
        hips: { rot: Math.sin(p) * 0.05 },
        head: { rot: -lean - Math.sin(p * 2) * 0.03 },
        legL: { rot: Math.sin(p) * 0.42 }, legR: { rot: Math.sin(p + Math.PI) * 0.42 },
        armL: { rot: Math.sin(p + Math.PI) * swing }, armR: { rot: Math.sin(p) * swing },
      };
    },

    crouch() {
      return {
        torso: { rot: 0.12, y: 30 * w }, hips: { rot: -0.08, y: 4 }, head: { rot: 0.16 },
        armL: { rot: -0.35 }, armR: { rot: 0.30 },
        legL: { rot: 0.46 }, legR: { rot: -0.50 },
      };
    },

    air(vy) {
      const rise = Math.max(-1, Math.min(1, -vy / 600));
      return {
        torso: { rot: -0.06 * rise }, hips: { rot: 0.10 * rise }, head: { rot: -0.10 * rise },
        armL: { rot: -0.55 * rise - 0.2 }, armR: { rot: 0.45 * rise + 0.2 },
        legL: { rot: -0.34 - 0.3 * rise }, legR: { rot: 0.42 + 0.2 * rise },
      };
    },

    block(t) {
      const j = Math.sin(t * 3.1) * 0.012;
      // With no arms to raise, the guard has to read off the whole body: a
      // deeper turn away from the opponent and a harder crouch.
      return armed
        ? {
          torso: { rot: 0.14 + j, y: 6 }, hips: { rot: -0.06 }, head: { rot: 0.15 },
          armL: { rot: -1.05 + j * 2 }, armR: { rot: 0.95 - j * 2 },
          legL: { rot: 0.14 }, legR: { rot: -0.16 },
        }
        : {
          torso: { rot: 0.24 + j, y: 14 }, hips: { rot: -0.14, y: 4 }, head: { rot: 0.22 },
          legL: { rot: 0.30 }, legR: { rot: -0.32 },
        };
    },

    hurt(f) {
      const k = easeOut(seg(f, 0, 3)) - easeInOut(seg(f, 5, 16));
      const shiver = Math.sin(f * 1.6) * Math.max(0, 1 - f / 14) * 0.035;
      return {
        torso: { rot: 0.32 * k + shiver, x: 22 * k * w, y: -4 * k },
        hips: { rot: -0.14 * k }, head: { rot: 0.48 * k + shiver * 2 },
        armL: { rot: 0.55 * k }, armR: { rot: -0.70 * k },
        legL: { rot: 0.26 * k }, legR: { rot: -0.20 * k },
      };
    },

    ko(f) {
      const k = easeOut(seg(f, 0, 26));
      return {
        torso: { rot: 1.32 * k, x: 56 * k, y: 96 * k },
        hips: { rot: -0.30 * k }, head: { rot: 0.70 * k },
        armL: { rot: 1.0 * k }, armR: { rot: -0.9 * k },
        legL: { rot: -0.6 * k }, legR: { rot: 0.5 * k },
      };
    },
  };
}

/* ------------------------------------------------------------------ moves */

/**
 * The rotation that brings a part's artwork round to point at the opponent.
 *
 * Which way a limb has to turn to reach is a property of the drawing, not of
 * the move: one character's arm is already extended, another's is folded
 * across her chest, a third's is raised over his head. Choosing the sign by
 * hand got ten of thirty moves pointing backwards -- they played the full
 * animation and could never touch anybody. So it is measured instead, from the
 * corner of the part's own art furthest from its joint.
 */
export function swingOf(rig, partName) {
  const p = rig.parts.find((q) => q.name === partName);
  if (!p) return 0;
  const [, , w, h] = p.rect;
  const [px, py] = p.pivot;
  let fx = 0; let fy = 0; let best = -1;
  for (const [cx, cy] of [[-px, -py], [w - px, -py], [-px, h - py], [w - px, h - py]]) {
    const d = cx * cx + cy * cy;
    if (d > best) { best = d; fx = cx; fy = cy; }
  }
  // Poses live in the artwork's own space, which the mirror in solve() turns
  // to face the opponent; `art` says which way that space points.
  const forward = (rig.art ?? 1) > 0 ? 0 : Math.PI;
  let turn = forward - Math.atan2(fy, fx);
  while (turn > Math.PI) turn -= Math.PI * 2;
  while (turn < -Math.PI) turn += Math.PI * 2;
  return turn;
}

/** A punch: the named arm cocks back, then whips through to full extension. */
function punchPose(arm, power, swing) {
  const other = arm === 'armL' ? 'armR' : 'armL';
  return (f, m) => {
    const { wind, strike } = phases(f, m);
    const a = anticipate(wind);
    return {
      torso: { rot: 0.10 * a - 0.34 * power * strike, x: -10 * strike, y: 2 * strike },
      hips: { rot: -0.08 * strike },
      head: { rot: 0.07 * wind - 0.11 * strike },
      [arm]: { rot: -0.26 * swing * a + swing * (1 + power * 0.08) * strike },
      [other]: { rot: 0.3 * swing * wind - 0.4 * swing * strike },
      legL: { rot: -0.16 * strike }, legR: { rot: 0.20 * strike },
    };
  };
}

/** A kick: the named leg loads under the body, then extends. */
function kickPose(leg, power, swing) {
  const other = leg === 'legL' ? 'legR' : 'legL';
  return (f, m) => {
    const { wind, strike } = phases(f, m);
    const a = anticipate(wind);
    return {
      torso: { rot: -0.14 * a + 0.24 * power * strike, x: -8 * strike, y: -6 * strike },
      hips: { rot: 0.14 * a - 0.30 * strike, y: 6 * strike },
      head: { rot: -0.08 * wind + 0.13 * strike },
      [leg]: { rot: -0.22 * swing * a + swing * (0.92 + power * 0.08) * strike },
      [other]: { rot: 0.16 * swing * strike },
      armL: { rot: 0.35 * strike }, armR: { rot: -0.45 * strike },
    };
  };
}

/** A body charge: the whole character folds back, then drives forward. */
function chargePose(power) {
  return (f, m) => {
    const { wind, strike } = phases(f, m);
    return {
      torso: { rot: 0.34 * wind - (0.48 + power * 0.2) * strike, x: 12 * wind - 38 * strike, y: 6 * strike },
      hips: { rot: 0.12 * strike },
      head: { rot: 0.16 * wind - 0.24 * strike },
      armL: { rot: 0.6 * wind - 1.4 * strike }, armR: { rot: -0.5 * wind + 0.9 * strike },
      legL: { rot: -0.5 * wind + 0.8 * strike }, legR: { rot: 0.4 * wind - 0.6 * strike },
    };
  };
}

/**
 * Build one move. `strikePart` decides which curve drives it, so a character
 * whose arms are welded into the torso gets kicks and charges without any
 * special-casing at the call site.
 */
export function move(rig, spec) {
  const power = Math.min(1, spec.damage / 120);
  const part = spec.strikePart;
  const swing = swingOf(rig, part);
  const pose = part === 'armL' || part === 'armR' ? punchPose(part, power, swing)
    : part === 'legL' || part === 'legR' ? kickPose(part, power, swing)
      : chargePose(power);
  return { hitstun: 14 + Math.round(power * 12), blockstun: 8 + Math.round(power * 7), lift: 0, drive: 120, ...spec, pose };
}

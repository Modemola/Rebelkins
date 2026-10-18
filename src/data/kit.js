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

import { phases, seg, easeOut, easeInOut, anticipate, capStun } from './common.js';
import { leadingCorner } from '../render/rig.js';

/**
 * @param armed  true when the rig has armL/armR to swing.
 * @param weight 0 light and quick, 1 heavy and planted. Scales how far the
 *               body travels on every idle breath and every recoil.
 */
export function stance(rig, { armed = true, weight = 0.5 } = {}) {
  const w = 0.7 + weight * 0.6; // heavier characters move through more distance
  const q = 1.25 - weight * 0.5; // ...and lighter ones move through it faster

  /**
   * A fighting stance, rather than the pose the character was drawn in.
   *
   * The A-pose renders stand with both arms out at forty degrees, which is
   * what makes a limb cuttable -- but two of them standing a body's width
   * apart read as scarecrows, and their silhouettes overlap long before their
   * hurtboxes do, so a jab lands somewhere inside the other fighter and cannot
   * be seen at all.
   *
   * `swingOf` already measures the rotation that points each arm at the
   * opponent, which is exactly the direction a guard wants to travel. A
   * fraction of it brings the hands up and in without beginning a punch: more
   * for the lead arm, which carries the guard, less for the rear one, which
   * stays cocked. Characters with no arms in their rig get zero from swingOf
   * and are unaffected.
   *
   * `guardOf` is shared with the move poses below, and it has to be: a pose is
   * absolute, not a delta, so a move that names an arm overwrites whatever the
   * stance had it doing. Every move used to set its off arm from a small fixed
   * number, which on these illustrations means the forty-degree A-pose they
   * were drawn in -- so both fighters' spare arms sprang back out to the sides
   * the instant anybody threw anything, which is most of why the fights read
   * as scarecrows rather than boxers.
   */
  const GUARD = guardOf(rig);
  /**
   * Where an articulated rig's elbows and knees sit in each stance.
   *
   * A guard is mostly elbow. With the arms as single planks the best the
   * stance could do was rotate them inward a little, which is why these two
   * stood there like scarecrows between exchanges -- and the stance is what
   * you are looking at for most of a round. Returns nothing on a rig that has
   * no elbows, so the un-articulated characters are unaffected.
   */
  const joints = (armFold, kneeBend) => {
    const out = {};
    for (const [upper, f] of [['armL', armFold[0]], ['armR', armFold[1]]]) {
      const lower = lowerOf(rig, upper);
      if (lower) out[lower] = { rot: FOLD * f };
    }
    for (const [upper, b] of [['legL', kneeBend[0]], ['legR', kneeBend[1]]]) {
      const lower = lowerOf(rig, upper);
      if (lower) out[lower] = { rot: KNEE_FOLD * b };
    }
    return out;
  };

  return {
    idle(t) {
      const b = Math.sin(t * 2.0 * q);
      const s = Math.sin(t * 0.9 * q);
      return {
        torso: { rot: s * 0.015, y: b * 2.2 * w },
        hips: { rot: -s * 0.012 },
        head: { rot: -s * 0.028 + Math.sin(t * 0.6) * 0.02 },
        armL: { rot: GUARD.armL + s * 0.05 + 0.02 }, armR: { rot: GUARD.armR - s * 0.055 },
        legL: { rot: s * 0.01 }, legR: { rot: -s * 0.01 },
        ...joints([0.74 + s * 0.03, 0.80 - s * 0.03], [0.17 + b * 0.02, 0.15 - b * 0.02]),
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
        armL: { rot: GUARD.armL + Math.sin(p + Math.PI) * swing },
        armR: { rot: GUARD.armR + Math.sin(p) * swing },
        ...joints([0.70, 0.76], [0.26 + Math.sin(p) * 0.22, 0.26 + Math.sin(p + Math.PI) * 0.22]),
      };
    },

    crouch() {
      return {
        torso: { rot: 0.12, y: 30 * w }, hips: { rot: -0.08, y: 4 }, head: { rot: 0.16 },
        armL: { rot: -0.35 }, armR: { rot: 0.30 },
        legL: { rot: 0.46 }, legR: { rot: -0.50 },
        ...joints([0.86, 0.90], [0.62, 0.66]),
      };
    },

    air(vy) {
      const rise = Math.max(-1, Math.min(1, -vy / 600));
      return {
        torso: { rot: -0.06 * rise }, hips: { rot: 0.10 * rise }, head: { rot: -0.10 * rise },
        armL: { rot: -0.55 * rise - 0.2 }, armR: { rot: 0.45 * rise + 0.2 },
        legL: { rot: -0.34 - 0.3 * rise }, legR: { rot: 0.42 + 0.2 * rise },
        ...joints([0.42, 0.46], [0.30 + 0.34 * rise, 0.22 + 0.20 * rise]),
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
          ...joints([1.06 + j, 1.02 - j], [0.34, 0.30]),
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
        ...joints([0.74 - 0.40 * k, 0.80 - 0.46 * k], [0.17 + 0.30 * k, 0.15 + 0.22 * k]),
      };
    },

    ko(f) {
      const k = easeOut(seg(f, 0, 26));
      return {
        torso: { rot: 1.32 * k, x: 56 * k, y: 96 * k },
        hips: { rot: -0.30 * k }, head: { rot: 0.70 * k },
        armL: { rot: 1.0 * k }, armR: { rot: -0.9 * k },
        legL: { rot: -0.6 * k }, legR: { rot: 0.5 * k },
        ...joints([0.74 - 0.62 * k, 0.80 - 0.68 * k], [0.17 + 0.52 * k, 0.15 + 0.44 * k]),
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
  // On an articulated rig the far point of an arm is the hand, which hangs off
  // the forearm, which hangs off this. Measuring to this part's own corner
  // instead points the upper arm at the opponent and leaves the hand pointing
  // somewhere above it -- which is exactly what the first articulated build
  // did, and it read as the arm aiming over the other fighter's head.
  const lower = lowerOf(rig, partName);
  const tip = lower ? rig.parts.find((q) => q.name === lower) : null;
  const [cx, cy] = leadingCorner(tip || p);
  const fx = tip ? tip.origin[0] + cx - p.origin[0] : cx;
  const fy = tip ? tip.origin[1] + cy - p.origin[1] : cy;
  // Poses live in the artwork's own space, which the mirror in solve() turns
  // to face the opponent; `art` says which way that space points.
  const forward = (rig.art ?? 1) > 0 ? 0 : Math.PI;
  let turn = forward - Math.atan2(fy, fx);
  while (turn > Math.PI) turn -= Math.PI * 2;
  while (turn < -Math.PI) turn += Math.PI * 2;
  return turn;
}

/**
 * The guard both the stance and every move pose hold the spare arm in.
 *
 * A fraction of the swing that would point the arm at the opponent, which is
 * the direction a guard travels in. Shared so that starting a move cannot
 * undo it.
 */
export function guardOf(rig) {
  return { armL: swingOf(rig, 'armL') * 0.42, armR: swingOf(rig, 'armR') * 0.26 };
}

/**
 * Which leg is the near one.
 *
 * A punch is thrown off the back foot and landed over the front one, so the
 * poses need to know which is which. The A-pose renders put one foot nearer
 * the camera-right edge than the other and the cast does not agree on which,
 * so it is read off the rig: the leg whose hip sits further toward the side
 * the character faces is the lead.
 */
export function leadLeg(rig) {
  const gx = rig.ground[0];
  const dir = (rig.art ?? 1) > 0 ? 1 : -1;
  const legs = ['legL', 'legR'].map((n) => rig.parts.find((q) => q.name === n)).filter(Boolean);
  if (legs.length < 2) return legs.length ? legs[0].name : 'legL';
  const [u, v] = legs;
  return (u.origin[0] - gx) * dir >= (v.origin[0] - gx) * dir ? u.name : v.name;
}

/**
 * The lower half of a limb, where a rig has been cut at the elbow or the knee.
 *
 * Returns null for the seven-part rigs that have not been articulated yet, and
 * every pose below falls back to swinging the whole limb from one joint when
 * it does -- which is what those characters have always done.
 *
 * A rotation of zero on the lower half leaves the limb in the shape it was
 * drawn in, which is near enough straight on an A-pose render. That is the
 * reference every bend below works from, so there is no separate "straighten"
 * angle to carry around.
 */
export function lowerOf(rig, part) {
  const name = { armL: 'foreL', armR: 'foreR', legL: 'shinL', legR: 'shinR' }[part];
  return name && rig.parts.some((q) => q.name === name) ? name : null;
}

/**
 * The limb a strike part belongs to.
 *
 * A punch lands with the hand and a kick with the shin, so `strikePart` names
 * those -- but the pose is a property of the limb, not of the end of it. Until
 * this existed, `move` branched on `strikePart` directly, and the first
 * articulated character, whose moves strike with `foreL` and `foreR`, matched
 * neither the arm branch nor the leg branch and fell through to the body
 * charge. All three of his attacks played a shoulder barge with the arms
 * tucked, which is why nothing he did looked remotely like a punch.
 */
export function limbOf(part) {
  return { foreL: 'armL', foreR: 'armR', shinL: 'legL', shinR: 'legR' }[part] || part;
}

/**
 * How far an elbow folds, and which way a knee does.
 *
 * Signs here are the one thing not measured off the drawing, because what is
 * being chosen is not an angle but a direction: an elbow folds the hand toward
 * the shoulder and a knee folds the heel toward the seat, and in a mirrored
 * rig those are opposite turns. Both were settled by rendering the pose sheet
 * and looking at it, which is also how they stay honest.
 */
const FOLD = -1.75;       // elbow: hand up to the chin
const KNEE_FOLD = 0.95;   // knee: heel back under the body

/**
 * Bend both knees by the given amounts, where the rig has knees.
 *
 * A step with locked legs reads as a mannequin sliding. The front knee takes
 * the landing and the back one stays nearer straight to drive.
 */
function kneesFor(rig, front, rear, frontBend, rearBend) {
  const out = {};
  const f = lowerOf(rig, front);
  const r = lowerOf(rig, rear);
  if (f) out[f] = { rot: KNEE_FOLD * frontBend };
  if (r) out[r] = { rot: KNEE_FOLD * rearBend };
  return out;
}

/** A punch: the named arm cocks back, then whips through to full extension. */
function punchPose(rig, arm, power, swing) {
  const other = arm === 'armL' ? 'armR' : 'armL';
  const guard = guardOf(rig)[other];
  const elbow = lowerOf(rig, arm);
  const otherElbow = lowerOf(rig, other);
  const front = leadLeg(rig);
  const rear = front === 'legL' ? 'legR' : 'legL';
  return (f, m) => {
    const { wind, strike } = phases(f, m);
    const a = anticipate(wind);
    const lead = Math.pow(strike, 0.55);
    const snap = Math.pow(strike, 1.9);
    return {
      // Pose x is measured toward the opponent -- the same direction `facing`
      // points -- so a punch that travels has to be positive here. All three
      // of these generators were negative, which is a lean away from the
      // person being hit, on the frame the hit lands.
      // A rigid cut-out leg swings its foot up in an arc, so a lunge this wide
      // takes the back foot off the floor unless the body comes down with it:
      // L*(1-cos t) at these angles is 14 to 20 source pixels, which is the
      // drop in `y`. A real lunge sits down into the stance anyway.
      //
      // It belongs on the torso, which is the root and carries everything with
      // it. It was on the hips, and the hips hang off the torso: translating
      // them does not lower the fighter, it slides the pelvis out from under
      // the ribcage. The art overlaps by 16 to 28 pixels at the waist and this
      // was pulling it 16 to 23, so on every punch, kick and charge in the
      // game the body came apart at the waist -- completely, on the character
      // whose overlap is smallest.
      torso: { rot: 0.14 * a - 0.40 * power * strike, x: -7 * a + (15 + 13 * power) * strike, y: (13 + 9 * power) * strike },
      hips: { rot: 0.09 * a - 0.28 * strike },
      head: { rot: 0.09 * wind - 0.14 * strike },
      // A punch is a chain, not a rotation. The shoulder goes first and the
      // elbow finishes the shot: `lead` is ahead of `strike` early, `snap` is
      // behind it and then catches up, so the upper arm is already round when
      // the forearm whips out. That ordering is the whole difference between a
      // punch and a limb sweeping an arc, and it needs an elbow to exist --
      // the fallback below is what every un-articulated rig still does.
      [arm]: { rot: -0.30 * swing * a + swing * (1 + power * 0.08) * (elbow ? lead : strike) },
      // Folded at the chin through the wind-up, straight at full extension.
      ...(elbow ? { [elbow]: { rot: FOLD * (1 - snap) * (1 + 0.3 * a) } } : {}),
      // Back to the chin, not back to the A-pose: the off arm stays at its
      // guard through the wind-up and tucks a little further as the shoulder
      // comes round, and its own elbow stays folded throughout -- that is what
      // a guard is.
      [other]: { rot: guard * (1 + 0.34 * a + 0.52 * strike) },
      ...(otherElbow ? { [otherElbow]: { rot: FOLD * 0.78 } } : {}),
      // Off the back foot, over the front one. Negative swings a hanging limb
      // toward the opponent, so the lead leg steps in and the rear one drives.
      [front]: { rot: 0.20 * a - (0.26 + 0.10 * power) * strike },
      [rear]: { rot: -0.15 * a + (0.30 + 0.12 * power) * strike },
      // Knees take the step rather than staying locked straight.
      ...kneesFor(rig, front, rear, 0.30 * strike, 0.16 * a + 0.10 * strike),
    };
  };
}

/** A kick: the named leg loads under the body, then extends. */
function kickPose(rig, leg, power, swing) {
  const other = leg === 'legL' ? 'legR' : 'legL';
  const guard = guardOf(rig);
  return (f, m) => {
    const { wind, strike } = phases(f, m);
    const a = anticipate(wind);
    return {
      torso: { rot: -0.16 * a + 0.30 * power * strike, x: -6 * a + (12 + 10 * power) * strike, y: 5 * strike },
      hips: { rot: 0.18 * a - 0.34 * strike },
      head: { rot: -0.09 * wind + 0.15 * strike },
      [leg]: { rot: -0.22 * swing * a + swing * (0.92 + power * 0.08) * strike },
      // The standing leg takes the weight. It used to be driven off the kicking
      // leg's own swing, which turned it the same way the kick was going and
      // lifted both feet clear of the floor -- every roundhouse read as a
      // flying kick. It braces back instead, by a fixed small amount.
      [other]: { rot: 0.12 * strike },
      // Both hands stay in the guard a kicker would actually keep them in, the
      // lead one dropping a touch as the hip turns over.
      armL: { rot: guard.armL * (1 + 0.20 * a - 0.30 * strike) },
      armR: { rot: guard.armR * (1 + 0.25 * a + 0.55 * strike) },
    };
  };
}

/** A body charge: the whole character folds back, then drives forward. */
function chargePose(rig, power) {
  const guard = guardOf(rig);
  const lead = leadLeg(rig);
  const rear = lead === 'legL' ? 'legR' : 'legL';
  return (f, m) => {
    const { wind, strike } = phases(f, m);
    return {
      // The strike part of a charge IS the torso, so this translation is the
      // hitbox as well as the drawing. It used to coil forward 12 and then
      // withdraw 38 on contact: a shoulder barge delivered by backing away.
      torso: { rot: 0.34 * wind - (0.52 + power * 0.22) * strike, x: -12 * wind + (34 + 18 * power) * strike, y: 24 * strike },
      hips: { rot: 0.14 * wind - 0.22 * strike },
      head: { rot: 0.18 * wind - 0.28 * strike },
      // Tucked in behind the shoulder, from the guard rather than from nothing.
      armL: { rot: guard.armL * (1 + 0.5 * wind + 1.1 * strike) },
      armR: { rot: guard.armR * (1 + 0.4 * wind + 0.8 * strike) },
      // Coil onto the back foot, then run through it.
      [lead]: { rot: 0.42 * wind - 0.54 * strike },
      [rear]: { rot: -0.34 * wind + 0.60 * strike },
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
  const limb = limbOf(spec.strikePart);
  const swing = swingOf(rig, limb);
  const pose = limb === 'armL' || limb === 'armR' ? punchPose(rig, limb, power, swing)
    : limb === 'legL' || limb === 'legR' ? kickPose(rig, limb, power, swing)
      : chargePose(rig, power);
  // capStun last, so a hitstun written by hand in a character file is capped
  // along with the one derived from weight here.
  return capStun({
    hitstun: 14 + Math.round(power * 12),
    blockstun: 8 + Math.round(power * 7),
    lift: 0, drive: 120, ...spec, pose,
  });
}

/**
 * KIN 09 -- fencer, side view. A test of the redrawn art, not a shipped
 * character.
 *
 * This is the first drawing in the project made for a side-on fighting game
 * rather than adapted to one. The body is turned toward the opponent, both
 * elbows are already bent, and the legs are bladed rather than splayed -- so
 * the rig does not have to manufacture a fighting stance out of a figure
 * standing to attention, which is what every pose in `kit.js` has been doing.
 *
 * Its reason for existing is to answer one question before nine more drawings
 * are commissioned: does a kick on side-view art stop reading as a noodle? On
 * front-facing art it cannot, because extending a front view of a leg shows
 * you the front of a leg lying horizontally, and that shape is narrow.
 *
 * The joints are hand-placed. `tools/articulate.mjs` splits a limb along a
 * horizontal line, which works on an arm hanging in an A-pose and cannot work
 * on one already bent at the elbow with the forearm coming back up past it.
 */

import { move } from './kit.js';
import { anim } from './anim.js';
import { seg, easeOut } from './common.js';

const RIG = {
  root: 'torso',
  ground: [482, 1455],
  parts: [
    { name: 'legL', parent: 'hips', z: 0, rect: [823, 0, 129, 310], pivot: [67, 25], origin: [470, 800], limits: { rot: [-95, 45] } },
    { name: 'shinL', parent: 'legL', z: 1, rect: [591, 0, 230, 430], pivot: [167, 32], origin: [455, 1060], limits: { rot: [-10, 145] } },
    { name: 'legR', parent: 'hips', z: 2, rect: [1350, 0, 220, 292], pivot: [59, 25], origin: [575, 800], limits: { rot: [-95, 45] } },
    { name: 'shinR', parent: 'legR', z: 3, rect: [397, 0, 192, 434], pivot: [130, 32], origin: [680, 1040], limits: { rot: [-10, 145] } },
    { name: 'hips', parent: 'torso', z: 4, rect: [1572, 0, 368, 237], pivot: [204, 135], origin: [500, 790] },
    { name: 'torso', parent: null, z: 5, rect: [954, 0, 394, 308], pivot: [137, 54], origin: [545, 450] },
    { name: 'head', parent: 'torso', z: 6, rect: [0, 0, 395, 727], pivot: [285, 291], origin: [548, 432] },
    { name: 'armR', parent: 'torso', z: 7, rect: [289, 729, 224, 153], pivot: [187, 31], origin: [425, 440], limits: { rot: [-150, 90] } },
    { name: 'foreR', parent: 'armR', z: 8, rect: [0, 729, 198, 208], pivot: [44, 146], origin: [280, 500], limits: { rot: [-70, 130] } },
    { name: 'armL', parent: 'torso', z: 9, rect: [515, 729, 159, 132], pivot: [27, -2], origin: [675, 430], limits: { rot: [-150, 90] } },
    { name: 'foreL', parent: 'armL', z: 10, rect: [200, 729, 87, 179], pivot: [54, 141], origin: [780, 510], limits: { rot: [-70, 130] } },
  ],
};

export const KIN09S = {
  id: 'kin09s',
  name: 'KIN 09',
  subtitle: 'fencer (side)',
  atlas: 'assets/atlas/kin09s.png',
  rig: RIG,
  // 1325 source pixels tall; 0.2294 puts her at the same 304 world units as
  // the rest of the cast, so she stands beside them at one scale.
  scale: 0.2294,
  health: 980,
  walkSpeed: 172,
  backSpeed: 134,
  jumpVel: 640,
  bodyHeight: 1325,
  hurtRadius: 145,

  /**
   * Her own drawing is the stance.
   *
   * Everything in `kit.js` builds a fighting stance out of a figure standing
   * to attention: it rotates the arms up into a guard, folds the elbows past
   * a right angle, bends the knees. Run that on a drawing that is already in
   * a guard and it all happens twice -- the elbow starts at ninety degrees
   * and gets another hundred, and she folds up. So the rest pose here is
   * zero, and the idle only breathes on top of it.
   */
  stance: {
    idle(t) {
      const bob = Math.sin(t * 5.1);
      const sway = Math.sin(t * 2.2);
      const drift = Math.sin(t * 1.05 + 0.7);
      return {
        torso: { rot: sway * 0.035 + drift * 0.015, y: bob * 22 },
        hips: { rot: -sway * 0.05 - bob * 0.02 },
        head: { rot: -sway * 0.05 + drift * 0.035 - bob * 0.022 },
        armL: { rot: bob * 0.07 + sway * 0.03 }, foreL: { rot: -bob * 0.09 },
        armR: { rot: -bob * 0.06 - sway * 0.035 }, foreR: { rot: bob * 0.08 },
        legL: { rot: sway * 0.03 }, legR: { rot: -sway * 0.03 },
        shinL: { rot: bob * 0.05 }, shinR: { rot: -bob * 0.045 },
      };
    },
    walk(t, dir) {
      const p = t * 7.2;
      return {
        torso: { rot: (dir > 0 ? 0.05 : -0.03) + Math.sin(p * 2) * 0.02, y: -Math.abs(Math.sin(p)) * 15 },
        hips: { rot: Math.sin(p) * 0.05 }, head: { rot: -Math.sin(p * 2) * 0.03 },
        legR: { rot: Math.sin(p) * 0.30 }, legL: { rot: Math.sin(p + Math.PI) * 0.30 },
        shinR: { rot: Math.max(0, Math.sin(p + Math.PI)) * 0.5 },
        shinL: { rot: Math.max(0, Math.sin(p)) * 0.5 },
        armL: { rot: Math.sin(p + Math.PI) * 0.12 }, armR: { rot: Math.sin(p) * 0.12 },
      };
    },
    crouch() {
      // See the note on KIN 06's crouch: a drop written on the hips pulls the
      // pelvis off the torso instead of lowering the fighter.
      return { torso: { rot: 0.1, y: 89 }, hips: { rot: -0.06 }, head: { rot: 0.12 },
        legL: { rot: 0.3 }, legR: { rot: -0.34 }, shinL: { rot: 0.5 }, shinR: { rot: 0.46 } };
    },
    air(vy) {
      const rise = Math.max(-1, Math.min(1, -vy / 600));
      return { torso: { rot: -0.06 * rise }, hips: { rot: 0.1 * rise }, head: { rot: -0.1 * rise },
        legL: { rot: -0.3 * rise }, legR: { rot: 0.2 * rise },
        shinL: { rot: 0.5 + 0.3 * rise }, shinR: { rot: 0.3 } };
    },
    block(t) {
      const j = Math.sin(t * 6.4) * 0.04;
      return { torso: { rot: 0.12 + j, y: 15 }, hips: { rot: -0.05 }, head: { rot: 0.12 },
        armL: { rot: -0.3 }, foreL: { rot: -0.5 }, armR: { rot: -0.2 }, foreR: { rot: -0.45 },
        legL: { rot: 0.12 }, legR: { rot: -0.14 }, shinL: { rot: 0.24 }, shinR: { rot: 0.2 } };
    },
    /**
     * The crouching guard. Without one, a low attack would be unblockable
     * rather than a mix-up, which is a worse game than having no low at all.
     */
    blockLow(t) {
      const j = Math.sin(t * 6.4) * 0.03;
      return { torso: { rot: 0.14 + j, y: 88 }, hips: { rot: -0.07 }, head: { rot: 0.12 },
        armR: { rot: -0.22 }, foreR: { rot: -0.38 }, armL: { rot: -0.30 }, foreL: { rot: -0.46 },
        legL: { rot: 0.3 }, legR: { rot: -0.34 }, shinL: { rot: 0.5 }, shinR: { rot: 0.46 } };
    },
    hurt(f) {
      const k = easeOut(seg(f, 0, 3)) - easeOut(seg(f, 5, 16));
      return { torso: { rot: 0.3 * k, x: 62 * k }, hips: { rot: -0.12 * k }, head: { rot: 0.44 * k },
        armL: { rot: 0.5 * k }, foreL: { rot: 0.7 * k }, armR: { rot: -0.6 * k }, foreR: { rot: 0.5 * k },
        legL: { rot: 0.22 * k }, legR: { rot: -0.18 * k }, shinL: { rot: 0.3 * k } };
    },
    ko(f) {
      const k = easeOut(seg(f, 0, 26));
      return { torso: { rot: 1.3 * k, x: 160 * k, y: 283 * k }, hips: { rot: -0.28 * k }, head: { rot: 0.66 * k },
        armL: { rot: 0.9 * k }, foreL: { rot: 1.1 * k }, armR: { rot: -0.8 * k }, foreR: { rot: 0.9 * k },
        legL: { rot: -0.55 * k }, legR: { rot: 0.45 * k }, shinL: { rot: 0.8 * k }, shinR: { rot: 0.6 * k } };
    },
  },

  /**
   * All three moves are hand-animated, and they have to be.
   *
   * These two were generated by `move()` for most of this character's life
   * and were wrong the whole time, which nothing caught because she is a
   * test character nothing imports and because I only ever looked at her
   * kick. `move()` builds motion out of a figure standing to attention: it
   * folds each non-striking elbow by FOLD, -1.75 radians, to manufacture a
   * guard. Her drawing already has one, so it happened twice. At the heavy's
   * contact frame the generated pose asked for `armR` 2.30 (a third of a
   * full turn of the upper arm), `foreL` -1.78 (the far forearm folded a
   * hundred degrees through her own chest) and `torso` -0.51, which is her
   * leaning twenty-nine degrees *backwards* while the strike lands. The
   * stance had the same problem and was overridden above; the moves were
   * not, and the same bug then reappeared on KIN 06.
   *
   * The playtest's "every move swings the limb it strikes with" passed on
   * both of these throughout. It measures how far the limb travels, and a
   * limb being flung through the torso travels a long way.
   *
   * Rotation sign: screen-plane rotations with y pointing down, so for a
   * limb hanging downward a negative angle swings it forward, and for a
   * forearm folded upright a positive angle unfolds it forward. The contact
   * angles below were solved against the rig rather than guessed -- hers are
   * nothing like KIN 06's, because her forearms are drawn near-vertical and
   * her rear elbow is cocked a long way behind her.
   */
  moves: {
    /**
     * A fencer's point: almost no wind-up, a straight thrust off the lead
     * hand that is already extended, and back behind the guard immediately.
     * It only travels 117 source pixels, which is short -- that is what the
     * drawing affords, and what a 40-damage poke should look like.
     */
    light: move(RIG, {
      name: 'point', label: 'Point',
      startup: 4, active: 3, recovery: 9,
      damage: 40, knockback: 200, lift: 0, drive: 150,
      strikePart: 'foreL', reach: 105, range: 149,
      pose: anim({}, [
        { at: 2, ease: 'out',
          torso: { rot: 0.02, x: -8 }, hips: { rot: 0.03 },
          armL: { rot: 0.10 }, foreL: { rot: -0.16 }, armR: { rot: 0.05 } },

        { at: 6, ease: 'whip',
          torso: { rot: 0.12, x: 26, y: 4 }, hips: { rot: -0.10 }, head: { rot: -0.06 },
          armL: { rot: -0.40 }, foreL: { rot: 1.48 },
          armR: { rot: 0.10 }, foreR: { rot: -0.08 },
          legR: { rot: -0.08 }, legL: { rot: 0.08 } },

        { at: 8, ease: 'back',
          torso: { rot: 0.14, x: 32, y: 5 },
          armL: { rot: -0.50 }, foreL: { rot: 1.62 } },

        { at: 11, ease: 'snap',
          torso: { rot: 0.04, x: 7, y: 1 }, hips: { rot: -0.03 },
          armL: { rot: -0.12 }, foreL: { rot: 0.30 }, armR: { rot: 0.03 } },

        { at: 16, rest: true, ease: 'inout' },
      ]),
    }),

    /**
     * An overhand lash, which is what her drawing is posed for.
     *
     * A body hook, not a straight, because her drawing cannot throw a
     * straight and it took three wrong measurements to establish that.
     *
     * Her rear elbow is drawn 265 source pixels *behind* the root, hand high
     * beside her cheek, and her head bitmap is 727 pixels tall because of the
     * hair. Getting that fist past her own face needs 155 degrees of shoulder
     * rotation -- a windmill, not a punch, on a flat cutout. Within a hundred
     * and twenty degrees the best available puts the fist 45 pixels in front
     * of her chest and 71 short of her face, which is a hook into the body:
     * close range, which is what her heavy's range of 120 already said.
     *
     * The three measurements, because each was wrong in a way worth not
     * repeating. `strikePoint` was the first: it returns the leading *corner*
     * of a part's bitmap, so a part that merely rotates far enough swaps
     * which corner leads and the number leaps -- it scored 305 pixels of
     * travel on a version of this move that did not move her arm. Measuring
     * the drawn glove instead fixed that and left the second error: the fist
     * was compared against a fixed face position while the move lunges, and a
     * lunge carries her head forward with her hand, so the gap never changed
     * while the score climbed by the whole length of the lunge. The third was
     * reading the onion skin off the recovery frames and concluding the arm
     * was frozen when it was not. What was actually wrong, once all three
     * were out of the way, was that the rear fist arrived exactly where the
     * lead fist already sat, so the strike was invisible behind it -- hence
     * the lead hand pulling right back here, 0.65 and -0.70 rather than the
     * 0.26 and -0.28 it had.
     */
    heavy: move(RIG, {
      name: 'lash', label: 'Lash',
      startup: 10, active: 4, recovery: 18,
      damage: 94, knockback: 450, lift: -110, drive: 230,
      strikePart: 'foreR', reach: 160, range: 106,
      pose: anim({}, [
        // Cock it further back and sit onto the rear foot.
        { at: 5, ease: 'out',
          torso: { rot: -0.08, x: -26, y: 8 }, hips: { rot: 0.10 }, head: { rot: 0.02 },
          armR: { rot: 0.22 }, foreR: { rot: -0.18 },
          armL: { rot: -0.08 }, foreL: { rot: 0.10 },
          legL: { rot: 0.10 }, shinL: { rot: 0.14 }, legR: { rot: 0.05 } },

        // The lunge and the lead hand go first: she opens the line before
        // the rear hand comes through it.
        { at: 9, ease: 'in',
          torso: { rot: 0.08, x: 24, y: 4 }, hips: { rot: -0.12 }, head: { rot: -0.04 },
          armR: { rot: -0.45 }, foreR: { rot: 0.70 },
          armL: { rot: 0.34 }, foreL: { rot: -0.38 },
          legL: { rot: 0.04 }, legR: { rot: -0.10 } },

        // Into the body. The head holds level -- she is looking at what she
        // is hitting, not at the floor -- and the lead hand is right back out
        // of the way, or the two fists land on top of each other.
        { at: 13, ease: 'whip',
          torso: { rot: 0.16, x: 76, y: 10 }, hips: { rot: -0.30 }, head: { rot: -0.10 },
          armR: { rot: -1.32 }, foreR: { rot: 2.00 },
          armL: { rot: 0.65 }, foreL: { rot: -0.70 },
          legR: { rot: -0.26 }, legL: { rot: 0.26 }, shinR: { rot: 0.16 } },

        { at: 16, ease: 'back',
          torso: { rot: 0.18, x: 86, y: 12 }, hips: { rot: -0.34 }, head: { rot: -0.12 },
          armR: { rot: -1.42 }, foreR: { rot: 2.12 }, armL: { rot: 0.72 }, foreL: { rot: -0.78 } },

        // The arm comes back up faster than the lunge recovers.
        { at: 22, ease: 'snap',
          torso: { rot: 0.08, x: 28, y: 4 }, hips: { rot: -0.10 }, head: { rot: -0.04 },
          armR: { rot: -0.38 }, foreR: { rot: 0.46 },
          armL: { rot: 0.18 }, foreL: { rot: -0.20 } },

        { at: 32, rest: true, ease: 'inout' },
      ]),
    }),
    /**
     * The question this whole character exists to answer, animated by hand
     * from her own stance rather than generated from an A-pose.
     *
     * A front-facing drawing cannot do this: extending the leg shows you the
     * front of a leg lying horizontally, and that is a narrow shape. Here the
     * leg is drawn from the side to begin with, so extending it shows a leg.
     */
    special: move(RIG, {
      name: 'lunge', label: 'Lunge',
      startup: 9, active: 6, recovery: 20,
      damage: 88, knockback: 500, lift: -80, drive: 420,
      strikePart: 'shinR', reach: 148, range: 232,
      pose: anim({}, [
        // Load onto the back foot and gather the knee. The only forward lean
        // in the move is here; from the chamber on she leans away from it.
        { at: 4, ease: 'out',
          torso: { rot: 0.07, x: -26, y: 11 }, hips: { rot: -0.07 }, head: { rot: 0.09 },
          legR: { rot: -0.36 }, shinR: { rot: 0.78 },
          legL: { rot: 0.03 }, shinL: { rot: 0.12 },
          armL: { rot: 0.12 }, armR: { rot: -0.10 } },

        // Knee up to the chest, heel tucked under: the chamber. It has to get
        // genuinely high, or the extension has nowhere to come from and the
        // kick reads as a step taken forward.
        { at: 9, ease: 'whip',
          torso: { rot: -0.12, x: -12, y: 5 }, hips: { rot: -0.16 }, head: { rot: 0.06 },
          legR: { rot: -1.16 }, shinR: { rot: 1.54 },
          legL: { rot: 0.02 }, shinL: { rot: 0.12 },
          armL: { rot: 0.26 }, foreL: { rot: 0.20 }, armR: { rot: -0.24 } },

        // The shin snaps out of the chamber. The thigh barely moves between
        // here and the chamber -- it is the knee that throws the kick. The
        // torso leans back over the standing foot, which is what a body does
        // to hold a leg out at this height.
        { at: 12, ease: 'back',
          torso: { rot: -0.32, x: 18, y: 8 }, hips: { rot: -0.28 }, head: { rot: 0.04 },
          legR: { rot: -1.44 }, shinR: { rot: 0.00 },
          legL: { rot: -0.02 }, shinL: { rot: 0.10 },
          armL: { rot: 0.38 }, foreL: { rot: 0.32 }, armR: { rot: -0.38 } },

        { at: 14, ease: 'back',
          torso: { rot: -0.36, x: 28, y: 10 },
          legR: { rot: -1.50 }, shinR: { rot: -0.10 } },

        // Back to the chamber before the foot comes down, which is what stops
        // a kick looking like a leg being lowered.
        { at: 19, ease: 'snap',
          torso: { rot: -0.12, x: 15, y: 8 }, hips: { rot: -0.15 },
          legR: { rot: -1.06 }, shinR: { rot: 1.16 },
          armL: { rot: 0.18 }, foreL: { rot: 0.12 }, armR: { rot: -0.18 } },

        { at: 26, ease: 'out',
          torso: { rot: 0.03, x: 3, y: 3 }, hips: { rot: -0.03 },
          legR: { rot: -0.14 }, shinR: { rot: 0.24 }, legL: { rot: 0.03 } },

        { at: 34, rest: true, ease: 'inout' },
      ]),
    }),

    /**
     * A crouching sweep, and the only move in the game that has to be
     * blocked low.
     *
     * Everything else can be guarded standing, so guard was a button you
     * held and never thought about again. This is the thing that makes the
     * guard a guess: hold it high and the sweep goes under it, crouch for
     * the sweep and the Cross lands on your head.
     *
     * It stays low on purpose. The thigh only comes to -0.52, which keeps
     * the boot near the floor instead of lifting it into the Stomp's
     * territory -- a low that arrives at chest height is just a worse kick.
     */
    low: move(RIG, {
      name: 'scythe', label: 'Scythe',
      startup: 5, active: 4, recovery: 12,
      damage: 34, knockback: 180, lift: 0, drive: 130,
      strikePart: 'shinR', reach: 128, range: 135, low: true,
      pose: anim({}, [
        { at: 3, ease: 'out',
          torso: { rot: 0.14, y: 86 }, hips: { rot: -0.08 }, head: { rot: 0.14 },
          legL: { rot: 0.32 }, shinL: { rot: 0.54 },
          legR: { rot: -0.20 }, shinR: { rot: 1.12 },
          armR: { rot: -0.18 }, foreR: { rot: -0.30 }, armL: { rot: -0.24 } },

        { at: 8, ease: 'whip',
          torso: { rot: 0.18, x: 18, y: 90 }, hips: { rot: -0.14 }, head: { rot: 0.16 },
          legL: { rot: 0.34 }, shinL: { rot: 0.56 },
          legR: { rot: -0.52 }, shinR: { rot: 0.06 },
          armR: { rot: -0.14 }, foreR: { rot: -0.26 }, armL: { rot: -0.20 } },

        { at: 10, ease: 'back',
          torso: { rot: 0.19, x: 24, y: 91 },
          legR: { rot: -0.56 }, shinR: { rot: -0.02 } },

        { at: 16, ease: 'snap',
          torso: { rot: 0.14, x: 8, y: 87 }, hips: { rot: -0.08 },
          legR: { rot: -0.22 }, shinR: { rot: 0.86 } },

        { at: 23, rest: true, ease: 'inout' },
      ]),
    }),
  },
};

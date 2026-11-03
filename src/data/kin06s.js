/**
 * KIN 06 -- bruiser, side view. The second drawing made for a side-on game
 * rather than adapted to one, and the one that proved the brief.
 *
 * He took three attempts. The first two came back with the head in profile
 * and the body square to the camera, feet 33.0% and 36.5% of his height apart
 * and dead level -- wider and flatter than the front-facing art being
 * replaced. The cause was not the generator; it was the brief asking for a
 * turned body and, in the same prompt, for a guard with both arms held wide
 * clear of the ribs and a band of background between the legs. No turned
 * figure looks like that. This sheet, against the corrected prompt, measures
 * 17.4% -- narrower than KIN 09, who was the reference.
 *
 * Two things here are his and not general:
 *
 * His platform soles abut around x=500, so `shinR` is occluded by `shinL` and
 * the leg polygons are drawn down that seam. The rear boot is nearer the
 * camera -- its sole sits 35 source pixels lower -- so it draws on top and the
 * front boot's hidden sliver, 5,415 pixels, is inpainted.
 *
 * The joints are hand-placed. `tools/articulate.mjs` splits a limb along a
 * horizontal line, which works on an arm hanging in an A-pose and cannot work
 * on one bent at the elbow with the forearm coming back up past it -- which
 * both of his are.
 */

import { move } from './kit.js';
import { anim } from './anim.js';
import { seg, easeOut } from './common.js';

const RIG = {
  root: 'torso',
  ground: [496, 1461],
  parts: [
    { name: 'legR', parent: 'hips', z: 0, rect: [1501, 0, 198, 275], pivot: [43, 27], origin: [580, 870], limits: { rot: [-95, 45] } },
    { name: 'shinR', parent: 'legR', z: 1, rect: [0, 0, 243, 398], pivot: [153, 36], origin: [648, 1072], limits: { rot: [-10, 145] } },
    { name: 'legL', parent: 'hips', z: 2, rect: [1299, 0, 200, 308], pivot: [116, 28], origin: [440, 870], limits: { rot: [-95, 45] } },
    { name: 'shinL', parent: 'legL', z: 3, rect: [245, 0, 307, 390], pivot: [139, 36], origin: [370, 1108], limits: { rot: [-10, 145] } },
    { name: 'hips', parent: 'torso', z: 4, rect: [160, 400, 289, 215], pivot: [120, 27], origin: [500, 800] },
    { name: 'torso', parent: null, z: 5, rect: [951, 0, 346, 363], pivot: [180, 63], origin: [520, 520] },
    { name: 'head', parent: 'torso', z: 6, rect: [554, 0, 395, 369], pivot: [199, 367], origin: [535, 478] },
    { name: 'armL', parent: 'torso', z: 7, rect: [0, 400, 158, 237], pivot: [68, 48], origin: [612, 545], limits: { rot: [-150, 90] } },
    { name: 'foreL', parent: 'armL', z: 8, rect: [1701, 0, 241, 240], pivot: [40, 188], origin: [596, 692], limits: { rot: [-70, 130] } },
    { name: 'armR', parent: 'torso', z: 9, rect: [451, 400, 200, 215], pivot: [126, 28], origin: [400, 505], limits: { rot: [-150, 90] } },
    { name: 'foreR', parent: 'armR', z: 10, rect: [653, 400, 323, 205], pivot: [47, 149], origin: [322, 648], limits: { rot: [-70, 130] } },
  ],
};

export const KIN06S = {
  id: 'kin06s',
  name: 'KIN 06',
  subtitle: 'bruiser (side)',
  atlas: 'assets/atlas/kin06s.png',
  rig: RIG,
  // 1359 source pixels tall; 0.2237 puts him at the same 304 world units as
  // the rest of the cast, so he stands beside them at one scale.
  scale: 0.2237,
  health: 1120,
  walkSpeed: 142,
  backSpeed: 108,
  jumpVel: 600,
  bodyHeight: 1359,
  hurtRadius: 158,

  /**
   * His own drawing is the stance, as with KIN 09.
   *
   * Everything in `kit.js` builds a fighting stance out of a figure standing
   * to attention: it rotates the arms up into a guard, folds the elbows past
   * a right angle, bends the knees. Run that on a drawing already in a guard
   * and it happens twice, and he folds up. So the rest pose is zero and the
   * idle only breathes on top of it.
   *
   * He breathes slower and heavier than KIN 09 -- a lower frequency and a
   * deeper bob, with the weight rocking between the feet rather than bouncing
   * on them. That is the whole of "bruiser" at rest.
   */
  stance: {
    idle(t) {
      const bob = Math.sin(t * 3.9);
      const sway = Math.sin(t * 1.7);
      const drift = Math.sin(t * 0.85 + 0.4);
      return {
        torso: { rot: sway * 0.030 + drift * 0.014, y: bob * 26 },
        hips: { rot: -sway * 0.045 - bob * 0.026 },
        head: { rot: -sway * 0.04 + drift * 0.03 - bob * 0.02 },
        armR: { rot: bob * 0.06 + sway * 0.026 }, foreR: { rot: -bob * 0.075 },
        armL: { rot: -bob * 0.055 - sway * 0.03 }, foreL: { rot: bob * 0.07 },
        legL: { rot: sway * 0.026 }, legR: { rot: -sway * 0.026 },
        shinL: { rot: bob * 0.04 }, shinR: { rot: -bob * 0.038 },
      };
    },
    walk(t, dir) {
      const p = t * 6.4;
      return {
        torso: { rot: (dir > 0 ? 0.06 : -0.035) + Math.sin(p * 2) * 0.022, y: -Math.abs(Math.sin(p)) * 17 },
        hips: { rot: Math.sin(p) * 0.055 }, head: { rot: -Math.sin(p * 2) * 0.028 },
        legR: { rot: Math.sin(p) * 0.28 }, legL: { rot: Math.sin(p + Math.PI) * 0.28 },
        shinR: { rot: Math.max(0, Math.sin(p + Math.PI)) * 0.46 },
        shinL: { rot: Math.max(0, Math.sin(p)) * 0.46 },
        armR: { rot: Math.sin(p + Math.PI) * 0.10 }, armL: { rot: Math.sin(p) * 0.10 },
      };
    },
    crouch() {
      return { torso: { rot: 0.12, y: 86 }, hips: { rot: -0.07, y: 10 }, head: { rot: 0.13 },
        legL: { rot: 0.32 }, legR: { rot: -0.36 }, shinL: { rot: 0.54 }, shinR: { rot: 0.5 } };
    },
    air(vy) {
      const rise = Math.max(-1, Math.min(1, -vy / 600));
      return { torso: { rot: -0.07 * rise }, hips: { rot: 0.11 * rise }, head: { rot: -0.1 * rise },
        legL: { rot: -0.32 * rise }, legR: { rot: 0.22 * rise },
        shinL: { rot: 0.52 + 0.3 * rise }, shinR: { rot: 0.32 } };
    },
    block(t) {
      const j = Math.sin(t * 5.8) * 0.04;
      return { torso: { rot: 0.14 + j, y: 18 }, hips: { rot: -0.06 }, head: { rot: 0.13 },
        armR: { rot: -0.26 }, foreR: { rot: -0.42 }, armL: { rot: -0.34 }, foreL: { rot: -0.52 },
        legL: { rot: 0.13 }, legR: { rot: -0.15 }, shinL: { rot: 0.26 }, shinR: { rot: 0.22 } };
    },
    hurt(f) {
      const k = easeOut(seg(f, 0, 3)) - easeOut(seg(f, 5, 16));
      return { torso: { rot: 0.28 * k, x: 58 * k }, hips: { rot: -0.11 * k }, head: { rot: 0.42 * k },
        armR: { rot: 0.46 * k }, foreR: { rot: 0.66 * k }, armL: { rot: -0.56 * k }, foreL: { rot: 0.46 * k },
        legL: { rot: 0.2 * k }, legR: { rot: -0.17 * k }, shinL: { rot: 0.28 * k } };
    },
    ko(f) {
      const k = easeOut(seg(f, 0, 26));
      return { torso: { rot: 1.28 * k, x: 155 * k, y: 290 * k }, hips: { rot: -0.26 * k }, head: { rot: 0.64 * k },
        armR: { rot: 0.86 * k }, foreR: { rot: 1.05 * k }, armL: { rot: -0.78 * k }, foreL: { rot: 0.86 * k },
        legL: { rot: -0.52 * k }, legR: { rot: 0.42 * k }, shinL: { rot: 0.76 * k }, shinR: { rot: 0.58 * k } };
    },
  },

  /**
   * He faces right, so the far arm -- `armL`/`foreL`, the one already held out
   * at the end of the drawing -- is his lead, and the near one tucked at the
   * chin is the rear hand. The jab comes off the lead and the heavy off the
   * rear, which is the order a boxer throws them in and also the order the
   * drawing is already in: the lead has less distance to travel, so it is
   * fast and short, and the rear has to come all the way across, so it is
   * slow and long.
   *
   * All three are hand-animated, and they have to be.
   *
   * `move()` in kit.js generates a pose by building the motion out of a
   * figure standing to attention: it folds each non-striking elbow by FOLD,
   * -1.75 radians, to make a guard that is not in the drawing. Run that on a
   * drawing already in a guard and the elbow starts at ninety degrees and
   * gets another hundred, so the forearms collapse through the chest and the
   * punch comes out as the torso rotating thirty degrees backwards with the
   * arm barely moving -- which is exactly what the first render of his cross
   * did. The generated stance had the same problem and is already overridden
   * above; the generated moves need the same treatment and did not get it on
   * KIN 09 either, whose light and heavy have been wrong since she was built
   * and were never looked at.
   *
   * Rotation sign, since it is not guessable: these are screen-plane
   * rotations with y pointing down, so for a limb hanging downward a negative
   * angle swings it forward (to the viewer's right) and for a forearm already
   * pointing up-and-forward a positive angle extends it further forward. That
   * is why the jab is foreL positive and the cross is armR negative into
   * foreR positive.
   */
  moves: {
    /**
     * The lead jab. Short, and its job is to be fast: eight frames from the
     * decision to the fist landing, with the retraction quicker than the
     * throw so it does not hang in the air.
     */
    light: move(RIG, {
      name: 'jab', label: 'Jab',
      startup: 4, active: 3, recovery: 10,
      damage: 44, knockback: 210, lift: 0, drive: 140,
      strikePart: 'foreL', reach: 112, range: 160,
      pose: anim({}, [
        // Barely any wind-up -- a jab that telegraphs is not a jab.
        { at: 2, ease: 'out',
          torso: { rot: 0.02, x: -9 }, hips: { rot: 0.03 },
          armL: { rot: 0.10 }, foreL: { rot: -0.14 }, armR: { rot: 0.06 } },

        { at: 6, ease: 'whip',
          torso: { rot: 0.15, x: 24, y: 5 }, hips: { rot: -0.12 }, head: { rot: 0.04 },
          armL: { rot: -0.92 }, foreL: { rot: 1.26 },
          armR: { rot: 0.12 }, foreR: { rot: -0.10 },
          legR: { rot: -0.08 }, legL: { rot: 0.08 } },

        { at: 8, ease: 'back',
          torso: { rot: 0.17, x: 30, y: 6 },
          armL: { rot: -1.00 }, foreL: { rot: 1.36 } },

        // Back behind the guard faster than it went out.
        { at: 12, ease: 'snap',
          torso: { rot: 0.05, x: 8, y: 2 }, hips: { rot: -0.04 },
          armL: { rot: -0.18 }, foreL: { rot: 0.26 }, armR: { rot: 0.04 } },

        { at: 17, rest: true, ease: 'inout' },
      ]),
    }),

    /**
     * The rear cross. It has to travel across the whole body, so it loads
     * first -- weight back, shoulder coiled away -- and the hips arrive
     * before the hand does.
     *
     * It lands at chin height rather than past the nose, and that is where
     * it stays. Pushing `armR` from -1.12 to -1.88 does get the fist 31
     * pixels past the face on paper, and what it looks like is the forearm
     * lying flat across his head: the measurement tracks the glove and says
     * nothing about the sleeve behind it. Four different numbers argued for
     * a longer punch here and the render disagreed with all of them. The
     * render is the judge.
     */
    heavy: move(RIG, {
      name: 'cross', label: 'Cross',
      startup: 11, active: 4, recovery: 19,
      damage: 102, knockback: 470, lift: -90, drive: 200,
      strikePart: 'foreR', reach: 168, range: 130,
      pose: anim({}, [
        // Coil. He sits back onto the rear foot and turns away from the shot.
        { at: 5, ease: 'out',
          torso: { rot: -0.07, x: -22, y: 10 }, hips: { rot: 0.10 }, head: { rot: -0.04 },
          armR: { rot: 0.18 }, foreR: { rot: -0.20 },
          armL: { rot: -0.08 }, foreL: { rot: 0.10 },
          legL: { rot: 0.10 }, shinL: { rot: 0.16 }, legR: { rot: 0.06 } },

        // The hips go first and the hand is still behind them.
        { at: 10, ease: 'in',
          torso: { rot: 0.12, x: -4, y: 4 }, hips: { rot: -0.14 }, head: { rot: 0.02 },
          armR: { rot: -0.12 }, foreR: { rot: 0.12 },
          armL: { rot: 0.08 }, foreL: { rot: -0.06 },
          legL: { rot: 0.04 }, legR: { rot: -0.04 } },

        // Contact.
        { at: 14, ease: 'whip',
          torso: { rot: 0.32, x: 42, y: 8 }, hips: { rot: -0.36 }, head: { rot: 0.07 },
          armR: { rot: -1.12 }, foreR: { rot: 1.28 },
          armL: { rot: 0.30 }, foreL: { rot: -0.32 },
          legR: { rot: -0.18 }, legL: { rot: 0.20 }, shinR: { rot: 0.14 } },

        { at: 17, ease: 'back',
          torso: { rot: 0.36, x: 52, y: 10 }, hips: { rot: -0.40 },
          armR: { rot: -1.22 }, foreR: { rot: 1.40 } },

        // The hand comes back before the feet do, so he is behind the guard
        // again while the stance is still unwinding.
        { at: 24, ease: 'snap',
          torso: { rot: 0.13, x: 16, y: 4 }, hips: { rot: -0.13 },
          armR: { rot: -0.28 }, foreR: { rot: 0.34 },
          armL: { rot: 0.09 }, foreL: { rot: -0.09 } },

        { at: 34, rest: true, ease: 'inout' },
      ]),
    }),

    /**
     * A stomping push kick off the lead leg, animated by hand from his own
     * stance.
     *
     * This is the move the side-view pass exists for. On the front-facing art
     * extending a leg shows you the front of a leg lying horizontally, which
     * is a narrow shape and reads as a noodle; here the leg is drawn from the
     * side to begin with, so extending it shows a leg. His boots make it worth
     * doing twice over -- there is a lot of sole to put through someone.
     *
     * The shape is chamber, extend, chamber again, place down. The second
     * chamber is the part that matters: a kick that goes straight from
     * extended to standing reads as a leg being lowered, not as a kick being
     * pulled back.
     */
    special: move(RIG, {
      name: 'stomp', label: 'Stomp',
      startup: 10, active: 6, recovery: 22,
      damage: 96, knockback: 540, lift: -70, drive: 380,
      strikePart: 'shinR', reach: 156, range: 190,
      pose: anim({}, [
        // Sit down into the back leg. He is heavy, so he loads visibly.
        { at: 5, ease: 'out',
          torso: { rot: 0.13, x: -26, y: 20 }, hips: { rot: -0.09 }, head: { rot: 0.09 },
          legR: { rot: -0.22 }, shinR: { rot: 0.58 },
          legL: { rot: 0.10 }, shinL: { rot: 0.30 },
          armR: { rot: 0.14 }, armL: { rot: -0.12 } },

        // Knee to the chest, heel tucked under: the chamber.
        { at: 10, ease: 'whip',
          torso: { rot: 0.24, x: -10, y: 10 }, hips: { rot: -0.24 }, head: { rot: 0.07 },
          legR: { rot: -0.86 }, shinR: { rot: 1.34 },
          legL: { rot: 0.14 }, shinL: { rot: 0.26 },
          armR: { rot: 0.28 }, foreR: { rot: 0.20 }, armL: { rot: -0.26 } },

        // The sole goes through. The thigh barely moves between here and the
        // chamber -- it is the knee that throws the kick, and the hips that
        // drive it.
        { at: 13, ease: 'back',
          torso: { rot: 0.34, x: 46, y: 22 }, hips: { rot: -0.34 }, head: { rot: 0.02 },
          legR: { rot: -1.04 }, shinR: { rot: 0.08 },
          legL: { rot: 0.22 }, shinL: { rot: 0.18 },
          armR: { rot: 0.38 }, foreR: { rot: 0.32 }, armL: { rot: -0.38 } },

        { at: 16, ease: 'back',
          torso: { rot: 0.37, x: 64, y: 26 },
          legR: { rot: -1.10 }, shinR: { rot: -0.08 } },

        // Back to the chamber before the foot comes down.
        { at: 22, ease: 'snap',
          torso: { rot: 0.24, x: 30, y: 18 }, hips: { rot: -0.20 },
          legR: { rot: -0.70 }, shinR: { rot: 1.00 },
          armR: { rot: 0.20 }, foreR: { rot: 0.14 }, armL: { rot: -0.20 } },

        // Plant it. He is 1120 health of platform boot; it lands hard and the
        // settle is in `phases`, not here.
        { at: 30, ease: 'out',
          torso: { rot: 0.05, x: 4, y: 6 }, hips: { rot: -0.05 },
          legR: { rot: -0.14 }, shinR: { rot: 0.26 }, legL: { rot: 0.04 } },

        { at: 38, rest: true, ease: 'inout' },
      ]),
    }),
  },
};

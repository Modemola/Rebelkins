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
  ground: [150, 460],
  parts: [
    { name: 'legL', parent: 'hips', z: 0, rect: [251, 0, 59, 132], pivot: [30, 12], origin: [137, 222], limits: { rot: [-55, 55] } },
    { name: 'shinL', parent: 'legL', z: 1, rect: [178, 0, 71, 144], pivot: [41, 12], origin: [124, 332], limits: { rot: [-20, 140] } },
    { name: 'legR', parent: 'hips', z: 2, rect: [312, 0, 60, 128], pivot: [26, 10], origin: [190, 220], limits: { rot: [-55, 55] } },
    { name: 'shinR', parent: 'legR', z: 3, rect: [118, 0, 58, 146], pivot: [26, 12], origin: [196, 330], limits: { rot: [-20, 140] } },
    { name: 'hips', parent: 'torso', z: 4, rect: [542, 0, 125, 85], pivot: [72, 9], origin: [165, 212] },
    { name: 'torso', parent: null, z: 5, rect: [374, 0, 166, 94], pivot: [73, 16], origin: [165, 138] },
    { name: 'head', parent: 'torso', z: 6, rect: [0, 0, 116, 245], pivot: [73, 93], origin: [165, 132] },
    { name: 'armR', parent: 'torso', z: 7, rect: [752, 0, 74, 49], pivot: [57, 11], origin: [125, 136], limits: { rot: [-170, 170] } },
    { name: 'foreR', parent: 'armR', z: 8, rect: [669, 0, 48, 68], pivot: [18, 52], origin: [84, 158], limits: { rot: [-160, 20] } },
    { name: 'armL', parent: 'torso', z: 9, rect: [828, 0, 56, 46], pivot: [9, 5], origin: [217, 138], limits: { rot: [-170, 170] } },
    { name: 'foreL', parent: 'armL', z: 10, rect: [719, 0, 31, 60], pivot: [17, 48], origin: [252, 162], limits: { rot: [-160, 20] } },
  ],
};

export const KIN09S = {
  id: 'kin09s',
  name: 'KIN 09',
  subtitle: 'fencer (side)',
  atlas: 'assets/atlas/kin09s.png',
  rig: RIG,
  // The drawing stands 430 source pixels tall, and 0.707 puts it at the same
  // 304 world units as the front-facing version, so the two are comparable.
  scale: 0.707,
  health: 980,
  walkSpeed: 172,
  backSpeed: 134,
  jumpVel: 640,
  bodyHeight: 430,
  hurtRadius: 47,

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
        torso: { rot: sway * 0.035 + drift * 0.015, y: bob * 7 },
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
        torso: { rot: (dir > 0 ? 0.05 : -0.03) + Math.sin(p * 2) * 0.02, y: -Math.abs(Math.sin(p)) * 5 },
        hips: { rot: Math.sin(p) * 0.05 }, head: { rot: -Math.sin(p * 2) * 0.03 },
        legR: { rot: Math.sin(p) * 0.30 }, legL: { rot: Math.sin(p + Math.PI) * 0.30 },
        shinR: { rot: Math.max(0, Math.sin(p + Math.PI)) * 0.5 },
        shinL: { rot: Math.max(0, Math.sin(p)) * 0.5 },
        armL: { rot: Math.sin(p + Math.PI) * 0.12 }, armR: { rot: Math.sin(p) * 0.12 },
      };
    },
    crouch() {
      return { torso: { rot: 0.1, y: 26 }, hips: { rot: -0.06, y: 3 }, head: { rot: 0.12 },
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
      return { torso: { rot: 0.12 + j, y: 5 }, hips: { rot: -0.05 }, head: { rot: 0.12 },
        armL: { rot: -0.3 }, foreL: { rot: -0.5 }, armR: { rot: -0.2 }, foreR: { rot: -0.45 },
        legL: { rot: 0.12 }, legR: { rot: -0.14 }, shinL: { rot: 0.24 }, shinR: { rot: 0.2 } };
    },
    hurt(f) {
      const k = easeOut(seg(f, 0, 3)) - easeOut(seg(f, 5, 16));
      return { torso: { rot: 0.3 * k, x: 20 * k }, hips: { rot: -0.12 * k }, head: { rot: 0.44 * k },
        armL: { rot: 0.5 * k }, foreL: { rot: 0.7 * k }, armR: { rot: -0.6 * k }, foreR: { rot: 0.5 * k },
        legL: { rot: 0.22 * k }, legR: { rot: -0.18 * k }, shinL: { rot: 0.3 * k } };
    },
    ko(f) {
      const k = easeOut(seg(f, 0, 26));
      return { torso: { rot: 1.3 * k, x: 52 * k, y: 92 * k }, hips: { rot: -0.28 * k }, head: { rot: 0.66 * k },
        armL: { rot: 0.9 * k }, foreL: { rot: 1.1 * k }, armR: { rot: -0.8 * k }, foreR: { rot: 0.9 * k },
        legL: { rot: -0.55 * k }, legR: { rot: 0.45 * k }, shinL: { rot: 0.8 * k }, shinR: { rot: 0.6 * k } };
    },
  },

  moves: {
    light: move(RIG, {
      name: 'point', label: 'Point',
      startup: 4, active: 3, recovery: 9,
      damage: 40, knockback: 200, lift: 0, drive: 150,
      strikePart: 'foreL', reach: 34, range: 170,
    }),
    heavy: move(RIG, {
      name: 'lash', label: 'Lash',
      startup: 10, active: 4, recovery: 18,
      damage: 94, knockback: 450, lift: -110, drive: 230,
      strikePart: 'foreR', reach: 52, range: 120,
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
      strikePart: 'shinR', reach: 48, range: 180,
      pose: anim({}, [
        // Load onto the back foot and gather the knee.
        { at: 4, ease: 'out',
          torso: { rot: 0.10, x: -7, y: 4 }, hips: { rot: -0.08 }, head: { rot: 0.08 },
          legR: { rot: -0.26 }, shinR: { rot: 0.62 },
          legL: { rot: 0.07 }, shinL: { rot: 0.16 },
          armL: { rot: 0.12 }, armR: { rot: -0.10 } },

        // Knee up to the chest, heel tucked under: the chamber.
        { at: 9, ease: 'whip',
          torso: { rot: 0.20, x: -3, y: 2 }, hips: { rot: -0.20 }, head: { rot: 0.06 },
          legR: { rot: -0.78 }, shinR: { rot: 1.28 },
          legL: { rot: 0.12 }, shinL: { rot: 0.22 },
          armL: { rot: 0.24 }, foreL: { rot: 0.18 }, armR: { rot: -0.22 } },

        // The shin snaps out of the chamber. The thigh barely moves between
        // here and the chamber -- it is the knee that throws the kick.
        { at: 12, ease: 'back',
          torso: { rot: 0.30, x: 14, y: 6 }, hips: { rot: -0.30 }, head: { rot: 0.02 },
          legR: { rot: -0.96 }, shinR: { rot: 0.10 },
          legL: { rot: 0.20 }, shinL: { rot: 0.14 },
          armL: { rot: 0.34 }, foreL: { rot: 0.30 }, armR: { rot: -0.34 } },

        { at: 14, ease: 'back',
          torso: { rot: 0.33, x: 19, y: 7 },
          legR: { rot: -1.02 }, shinR: { rot: -0.06 } },

        // Back to the chamber before the foot comes down, which is what stops
        // a kick looking like a leg being lowered.
        { at: 19, ease: 'snap',
          torso: { rot: 0.22, x: 9, y: 5 }, hips: { rot: -0.18 },
          legR: { rot: -0.66 }, shinR: { rot: 0.96 },
          armL: { rot: 0.18 }, foreL: { rot: 0.12 }, armR: { rot: -0.18 } },

        { at: 26, ease: 'out',
          torso: { rot: 0.04, x: 1, y: 1 }, hips: { rot: -0.04 },
          legR: { rot: -0.12 }, shinR: { rot: 0.22 }, legL: { rot: 0.03 } },

        { at: 34, rest: true, ease: 'inout' },
      ]),
    }),
  },
};

/**
 * KIN 01 -- brawler.
 *
 * Both arms came away clean above the shoulder line, so this one hits from overhead.
 *
 * The first character cut at the elbow and the knee. Every rig in this cast
 * started as seven rigid parts, which meant an arm that could only sweep from
 * the shoulder like a clock hand and a leg that could only swing like a
 * pendulum -- no amount of tuning makes that look like a punch, because the
 * motion is not in the skeleton. Eleven parts now: the forearms and shins hang
 * off their own halves, so the hand can chamber at the chin and extend on a
 * line, and the knee can fold and snap out.
 *
 * The hitboxes move with them: a punch strikes with `foreL`/`foreR`, not with
 * the upper arm, and `reach` drops accordingly -- it is a fist now rather than
 * the whole limb.
 */

import { stance, move } from './kit.js';
import { anim } from './anim.js';

/**
 * The pose every animation starts and ends in, read off the stance rather
 * than written out again, so the two can never drift apart.
 */
const RIG = {
  root: 'torso',
  ground: [164, 472],
  parts: [
    { name: 'legL', parent: 'hips', z: 0, rect: [191, 0, 74, 133], pivot: [47, 14], origin: [140, 228], limits: { rot: [-55, 55] } },
    { name: 'legR', parent: 'hips', z: 0, rect: [267, 0, 64, 133], pivot: [28, 14], origin: [194, 228], limits: { rot: [-55, 55] } },
    { name: 'shinL', parent: 'legL', z: 1, rect: [0, 0, 99, 169], pivot: [65, 22], origin: [127, 325], limits: { rot: [-20, 140] } },
    { name: 'shinR', parent: 'legR', z: 1, rect: [101, 0, 88, 168], pivot: [29, 22], origin: [206, 325], limits: { rot: [-20, 140] } },
    { name: 'hips', parent: 'torso', z: 2, rect: [738, 0, 105, 48], pivot: [47, 14], origin: [168, 218] },
    { name: 'torso', parent: null, z: 3, rect: [333, 0, 142, 128], pivot: [72, 24], origin: [166, 128] },
    { name: 'armR', parent: 'torso', z: 4, rect: [676, 0, 60, 71], pivot: [40, 1], origin: [104, 124], limits: { rot: [-170, 170] } },
    { name: 'foreR', parent: 'armR', z: 5, rect: [542, 0, 63, 107], pivot: [34, 18], origin: [86, 176], limits: { rot: [-160, 20] } },
    { name: 'armL', parent: 'torso', z: 6, rect: [845, 0, 40, 45], pivot: [13, -25], origin: [226, 124], limits: { rot: [-170, 170] } },
    { name: 'foreL', parent: 'armL', z: 7, rect: [477, 0, 63, 110], pivot: [27, 18], origin: [241, 176], limits: { rot: [-160, 20] } },
    { name: 'head', parent: 'torso', z: 8, rect: [607, 0, 67, 103], pivot: [37, 99], origin: [164, 110] },
  ],
};

const STANCE = stance(RIG, { armed: true, weight: 0.7 });
const REST = STANCE.idle(0);

export const KIN01 = {
  id: 'kin01',
  name: 'KIN 01',
  subtitle: 'brawler',
  atlas: 'assets/atlas/kin01.png',
  rig: RIG,
  scale: 0.6594,
  health: 1060,
  walkSpeed: 160,
  backSpeed: 120,
  jumpVel: 630,
  bodyHeight: 461,
  hurtRadius: 74,

  stance: STANCE,

  moves: {
    /**
     * The first move in this game that is animated rather than computed.
     *
     * It is a lead jab, so it is thrown off the front hand and the body does
     * almost nothing -- that restraint is the point of a jab, and it is also
     * the thing a shared formula cannot express, because the formula has to
     * work for the haymaker too. Eighteen frames: three to load onto the back
     * foot, four to throw, and the rest getting the hand home.
     *
     * Read down the `at` column and it is a sequence of drawings. That is the
     * whole difference.
     */
    light: move(RIG, {
      name: 'rake', label: 'Rake',
      startup: 5, active: 3, recovery: 10,
      damage: 46, knockback: 220, lift: 0, drive: 150,
      strikePart: 'foreL', reach: 34, range: 181,
      pose: anim(REST, [
        // Load. Weight back, chin down, lead elbow tightens -- the hand draws
        // a little closer to the body before it goes anywhere.
        { at: 2,
          ease: 'out',
          torso: { rot: 0.11, x: -6, y: 4 },
          hips: { rot: -0.08 },
          head: { rot: 0.12 },
          armL: { rot: -0.40 }, foreL: { rot: -1.64 },
          armR: { rot: -0.54 }, foreR: { rot: -1.56 },
          legR: { rot: 0.10 }, shinR: { rot: 0.34 },
          legL: { rot: -0.06 }, shinL: { rot: 0.22 } },

        // Out. The shoulder goes before the hand does, so the elbow is still
        // folded here while the upper arm is already round.
        { at: 5,
          ease: 'whip',
          torso: { rot: -0.30, x: 13, y: 7 },
          hips: { rot: 0.16 },
          head: { rot: -0.07 },
          armL: { rot: -1.04 }, foreL: { rot: -0.66 },
          armR: { rot: -0.20 }, foreR: { rot: -1.74 },
          legR: { rot: -0.22 }, shinR: { rot: 0.44 },
          legL: { rot: 0.26 }, shinL: { rot: 0.05 } },

        // Contact. Arm straight and a touch past it, hips turned under a
        // chest that has turned further, rear hand hard back at the chin.
        { at: 7,
          ease: 'back',
          torso: { rot: -0.46, x: 23, y: 9 },
          hips: { rot: 0.24 },
          head: { rot: -0.17 },
          armL: { rot: -1.34 }, foreL: { rot: 0.07 },
          armR: { rot: -0.14 }, foreR: { rot: -1.82 },
          legR: { rot: -0.29 }, shinR: { rot: 0.51 },
          legL: { rot: 0.35 }, shinL: { rot: -0.02 } },

        // Home, fast. The hand is the first thing back and the body is still
        // unwinding behind it.
        { at: 10,
          ease: 'snap',
          torso: { rot: -0.18, x: 11, y: 6 },
          head: { rot: -0.04 },
          armL: { rot: -0.74 }, foreL: { rot: -1.10 },
          armR: { rot: -0.34 }, foreR: { rot: -1.62 } },

        // Past the guard and back to it, so nothing arrives at a dead stop.
        { at: 13,
          ease: 'out',
          torso: { rot: 0.05, x: 1, y: 2 },
          hips: { rot: -0.05 },
          head: { rot: 0.07 },
          armL: { rot: -0.57 }, foreL: { rot: -1.40 } },

        { at: 17, rest: true, ease: 'inout' },
      ]),
    }),
    heavy: move(RIG, {
      // The Slam lunges. His rear fist reaches 105 units measured, against a
      // standing separation of 118 -- which is simply what a rear hand on a
      // two-bone arm does once the hitbox is a fist rather than the whole
      // limb. A power shot off the back hand has to close that gap itself, so
      // this one steps in rather than reaching from where it stands.
      name: 'slam', label: 'Slam',
      startup: 11, active: 4, recovery: 19,
      damage: 104, knockback: 480, lift: -130, drive: 230,
      strikePart: 'foreR', reach: 48, range: 107,
    }),
    special: move(RIG, {
      name: 'pounce', label: 'Pounce',
      startup: 10, active: 7, recovery: 23,
      damage: 92, knockback: 540, lift: -90, drive: 520,
      strikePart: 'foreL', reach: 34, range: 195,
    }),
  },
};

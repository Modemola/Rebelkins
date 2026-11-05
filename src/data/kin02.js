/**
 * KIN 02 -- counterpuncher.
 *
 * Only her near arm stood clear of the vest; the far one is welded in, so everything comes off one hand.
 */

import { stance, move } from './kit.js';

const RIG = {
  root: 'torso',
  ground: [168, 466],
  parts: [
    // armR's limit is wider than the rest of the cast's on purpose:
    // this character's heavy carries the shoulder past 180 degrees because
    // stopping it where the opponent is leaves the forearm across the face.
    // That is the limit being fitted to the animation rather than to a joint,
    // and it is only defensible because a front-facing arm is a flat sweep
    // around a head, not a shoulder. See punchPose in kit.js and armSwing below.

    { name: 'legL', parent: 'hips', z: 0, rect: [265, 0, 67, 135], pivot: [36, 12], origin: [138, 240], limits: { rot: [-110, 55] } },
    { name: 'legR', parent: 'hips', z: 0, rect: [334, 0, 60, 135], pivot: [28, 12], origin: [196, 240], limits: { rot: [-110, 55] } },
    { name: 'shinR', parent: 'legR', z: 1, rect: [0, 0, 81, 151], pivot: [34, 22], origin: [208, 341], limits: { rot: [-20, 140] } },
    { name: 'shinL', parent: 'legL', z: 1, rect: [83, 0, 75, 149], pivot: [54, 22], origin: [127, 341], limits: { rot: [-20, 140] } },
    { name: 'hips', parent: 'torso', z: 2, rect: [762, 0, 89, 44], pivot: [58, 12], origin: [168, 232] },
    { name: 'torso', parent: null, z: 3, rect: [160, 0, 103, 140], pivot: [55, 24], origin: [164, 126] },
    { name: 'armR', parent: 'torso', z: 4, rect: [623, 0, 56, 84], pivot: [45, 0], origin: [120, 116], limits: { rot: [-215, 170] } },
    { name: 'foreR', parent: 'armR', z: 5, rect: [396, 0, 84, 109], pivot: [49, 18], origin: [88, 182], limits: { rot: [-160, 20] } },
    { name: 'armL', parent: 'torso', z: 6, rect: [567, 0, 54, 94], pivot: [12, 10], origin: [202, 116], limits: { rot: [-170, 170] } },
    { name: 'foreL', parent: 'armL', z: 7, rect: [482, 0, 83, 109], pivot: [20, 18], origin: [222, 182], limits: { rot: [-160, 20] } },
    { name: 'head', parent: 'torso', z: 8, rect: [681, 0, 79, 78], pivot: [41, 74], origin: [162, 106] },
  ],
};

export const KIN02 = {
  id: 'kin02',
  name: 'KIN 02',
  subtitle: 'counterpuncher',
  atlas: 'assets/atlas/kin02.png',
  rig: RIG,
  scale: 0.7,
  health: 1040,
  walkSpeed: 176,
  backSpeed: 134,
  jumpVel: 660,
  bodyHeight: 434,
  hurtRadius: 47,

  stance: stance(RIG, { armed: true, weight: 0.4 }),

  moves: {
    light: move(RIG, {
      name: 'jab', label: 'Jab',
      startup: 4, active: 3, recovery: 8,
      damage: 44, knockback: 210, lift: 0, drive: 160,
      strikePart: 'foreL', reach: 34, range: 175,
    }),
    heavy: move(RIG, {
      name: 'overhand', label: 'Overhand',
      startup: 10, active: 5, recovery: 18,
      damage: 100, knockback: 470, lift: -120, drive: 230,
      strikePart: 'foreR',
      // Stopping the shoulder where swingOf says the opponent is leaves this
      // character's forearm lying across their own face; the old additive
      // sweep is what carries it past the head. See punchPose in kit.js.
      armSweep: 'past', reach: 44, range: 107,
    }),
    special: move(RIG, {
      name: 'shoulder', label: 'Shoulder',
      startup: 9, active: 6, recovery: 22,
      damage: 88, knockback: 520, lift: -70, drive: 540,
      strikePart: 'torso', reach: 46, range: 176,
    }),
  },
};

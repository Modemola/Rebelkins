/**
 * KIN 09 -- fencer.
 *
 * Her lead arm was already extended, which made it the easiest limb in the set to free.
 */

import { stance, move } from './kit.js';

const RIG = {
  root: 'torso',
  ground: [166, 462],
  parts: [
    // armR's limit is wider than the rest of the cast's on purpose:
    // this character's heavy carries the shoulder past 180 degrees because
    // stopping it where the opponent is leaves the forearm across the face.
    // That is the limit being fitted to the animation rather than to a joint,
    // and it is only defensible because a front-facing arm is a flat sweep
    // around a head, not a shoulder. See punchPose in kit.js and armSwing below.

    { name: 'legL', parent: 'hips', z: 0, rect: [208, 0, 57, 123], pivot: [28, 12], origin: [142, 264], limits: { rot: [-110, 55] } },
    { name: 'legR', parent: 'hips', z: 0, rect: [267, 0, 39, 123], pivot: [24, 12], origin: [194, 264], limits: { rot: [-110, 55] } },
    { name: 'shinL', parent: 'legL', z: 1, rect: [97, 0, 50, 135], pivot: [19, 22], origin: [141, 353], limits: { rot: [-20, 140] } },
    { name: 'shinR', parent: 'legR', z: 1, rect: [149, 0, 57, 135], pivot: [29, 22], origin: [200, 353], limits: { rot: [-20, 140] } },
    { name: 'hips', parent: 'torso', z: 2, rect: [584, 0, 110, 76], pivot: [68, 12], origin: [168, 202] },
    { name: 'torso', parent: null, z: 3, rect: [308, 0, 84, 98], pivot: [42, 20], origin: [172, 128] },
    { name: 'armR', parent: 'torso', z: 4, rect: [696, 0, 95, 76], pivot: [85, 11], origin: [136, 124], limits: { rot: [-215, 170] } },
    { name: 'foreR', parent: 'armR', z: 5, rect: [486, 0, 96, 87], pivot: [58, 18], origin: [98, 171], limits: { rot: [-160, 20] } },
    { name: 'armL', parent: 'torso', z: 6, rect: [793, 0, 69, 69], pivot: [6, 4], origin: [204, 124], limits: { rot: [-170, 170] } },
    { name: 'foreL', parent: 'armL', z: 7, rect: [394, 0, 90, 89], pivot: [33, 18], origin: [237, 171], limits: { rot: [-160, 20] } },
    { name: 'head', parent: 'torso', z: 8, rect: [0, 0, 95, 200], pivot: [49, 80], origin: [164, 112] },
  ],
};

export const KIN09 = {
  id: 'kin09',
  name: 'KIN 09',
  subtitle: 'fencer',
  atlas: 'assets/atlas/kin09.png',
  rig: RIG,
  scale: 0.7065,
  health: 940,
  walkSpeed: 186,
  backSpeed: 144,
  jumpVel: 700,
  bodyHeight: 430,
  hurtRadius: 45,

  stance: stance(RIG, { armed: true, weight: 0.3 }),

  moves: {
    light: move(RIG, {
      name: 'point', label: 'Point',
      startup: 4, active: 3, recovery: 8,
      damage: 40, knockback: 190, lift: 0, drive: 160,
      strikePart: 'foreL', reach: 30, range: 180,
    }),
    heavy: move(RIG, {
      name: 'lash', label: 'Lash',
      startup: 10, active: 4, recovery: 17,
      damage: 94, knockback: 450, lift: -110, drive: 230,
      // Stopping the shoulder where swingOf says the opponent is leaves this
      // character's forearm lying across their own face; the old additive
      // sweep is what carries it past the head. See punchPose in kit.js.
      armSweep: 'past',
      strikePart: 'foreR', reach: 44, range: 120,
    }),
    special: move(RIG, {
      name: 'lunge', label: 'Lunge',
      startup: 9, active: 7, recovery: 22,
      damage: 88, knockback: 500, lift: -50, drive: 560,
      strikePart: 'foreR', reach: 45, range: 140,
    }),
  },
};

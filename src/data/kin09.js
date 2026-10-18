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
    { name: 'legL', parent: 'hips', z: 0, rect: [0, 0, 57, 214], pivot: [28, 12], origin: [142, 264], limits: { rot: [-55, 55] } },
    { name: 'legR', parent: 'hips', z: 0, rect: [59, 0, 58, 214], pivot: [24, 12], origin: [194, 264], limits: { rot: [-55, 55] } },
    { name: 'hips', parent: 'torso', z: 1, rect: [508, 0, 110, 76], pivot: [68, 12], origin: [168, 202] },
    { name: 'torso', parent: null, z: 2, rect: [422, 0, 84, 98], pivot: [42, 20], origin: [172, 128] },
    { name: 'armR', parent: 'torso', z: 3, rect: [216, 0, 106, 127], pivot: [96, 11], origin: [136, 124], limits: { rot: [-170, 170] } },
    { name: 'armL', parent: 'torso', z: 3, rect: [324, 0, 96, 122], pivot: [6, 4], origin: [204, 124], limits: { rot: [-170, 170] } },
    { name: 'head', parent: 'torso', z: 4, rect: [119, 0, 95, 200], pivot: [49, 80], origin: [164, 112] },
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
      strikePart: 'armL', reach: 47, range: 187,
    }),
    heavy: move(RIG, {
      name: 'lash', label: 'Lash',
      startup: 10, active: 4, recovery: 17,
      damage: 94, knockback: 450, lift: -110, drive: 90,
      strikePart: 'armR', reach: 52, range: 145,
    }),
    special: move(RIG, {
      name: 'lunge', label: 'Lunge',
      startup: 9, active: 7, recovery: 22,
      damage: 88, knockback: 500, lift: -50, drive: 560,
      strikePart: 'armR', reach: 56, range: 155,
    }),
  },
};

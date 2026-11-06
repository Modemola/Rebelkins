/**
 * KIN 04 -- ghost.
 *
 * Hands buried in the coat. Nothing to cut free, so the coat itself is the weapon.
 */

import { stance, move } from './kit.js';

const RIG = {
  root: 'torso',
  ground: [165, 473],
  parts: [
    { name: 'legL', parent: 'hips', z: 0, rect: [289, 0, 63, 129], pivot: [34, 12], origin: [142, 262], limits: { rot: [-110, 55] } },
    { name: 'legR', parent: 'hips', z: 0, rect: [354, 0, 53, 129], pivot: [26, 12], origin: [196, 262], limits: { rot: [-110, 55] } },
    { name: 'shinR', parent: 'legR', z: 1, rect: [143, 0, 71, 139], pivot: [31, 22], origin: [204, 357], limits: { rot: [-20, 140] } },
    { name: 'shinL', parent: 'legL', z: 1, rect: [216, 0, 71, 134], pivot: [50, 22], origin: [134, 357], limits: { rot: [-20, 140] } },
    { name: 'hips', parent: 'torso', z: 2, rect: [760, 0, 118, 48], pivot: [54, 14], origin: [172, 256] },
    { name: 'torso', parent: null, z: 3, rect: [0, 0, 141, 140], pivot: [62, 24], origin: [168, 150] },
    { name: 'armR', parent: 'torso', z: 4, rect: [654, 0, 64, 83], pivot: [48, 4], origin: [122, 150], limits: { rot: [-170, 170] } },
    { name: 'foreR', parent: 'armR', z: 5, rect: [584, 0, 68, 96], pivot: [39, 18], origin: [96, 211], limits: { rot: [-160, 20] } },
    { name: 'armL', parent: 'torso', z: 6, rect: [720, 0, 38, 63], pivot: [16, -16], origin: [236, 150], limits: { rot: [-170, 170] } },
    { name: 'foreL', parent: 'armL', z: 7, rect: [530, 0, 52, 97], pivot: [23, 18], origin: [243, 211], limits: { rot: [-160, 20] } },
    { name: 'head', parent: 'torso', z: 8, rect: [409, 0, 119, 112], pivot: [65, 108], origin: [163, 132] },
  ],
};

export const KIN04 = {
  id: 'kin04',
  name: 'KIN 04',
  subtitle: 'ghost',
  atlas: 'assets/atlas/kin04.png',
  rig: RIG,
  scale: 0.682,
  health: 1080,
  walkSpeed: 168,
  backSpeed: 126,
  jumpVel: 620,
  bodyHeight: 449,
  hurtRadius: 54,

  stance: stance(RIG, { armed: true, weight: 0.65 }),

  moves: {
    light: move(RIG, {
      name: 'jab', label: 'Jab',
      startup: 5, active: 3, recovery: 9,
      damage: 48, knockback: 215, lift: 0, drive: 150,
      strikePart: 'foreL', reach: 33, range: 201,
    }),
    heavy: move(RIG, {
      name: 'hook', label: 'Hook',
      startup: 12, active: 4, recovery: 20,
      damage: 110, knockback: 500, lift: -140, drive: 230,
      strikePart: 'foreR', reach: 52, range: 130,
    }),
    special: move(RIG, {
      name: 'blackout', label: 'Blackout',
      startup: 11, active: 8, recovery: 24,
      damage: 98, knockback: 540, lift: -80, drive: 500,
      strikePart: 'torso', reach: 49, range: 190,
    }),
  },
};

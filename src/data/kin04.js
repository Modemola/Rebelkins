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
    { name: 'legR', parent: 'hips', z: 0, rect: [0, 0, 74, 224], pivot: [26, 12], origin: [196, 262], limits: { rot: [-55, 55] } },
    { name: 'legL', parent: 'hips', z: 0, rect: [76, 0, 87, 219], pivot: [58, 12], origin: [142, 262], limits: { rot: [-55, 55] } },
    { name: 'hips', parent: 'torso', z: 1, rect: [566, 0, 118, 48], pivot: [54, 14], origin: [172, 256] },
    { name: 'torso', parent: null, z: 2, rect: [248, 0, 141, 140], pivot: [62, 24], origin: [168, 150] },
    { name: 'armR', parent: 'torso', z: 3, rect: [165, 0, 81, 143], pivot: [65, 4], origin: [122, 150], limits: { rot: [-170, 170] } },
    { name: 'armL', parent: 'torso', z: 3, rect: [391, 0, 52, 124], pivot: [16, -16], origin: [236, 150], limits: { rot: [-170, 170] } },
    { name: 'head', parent: 'torso', z: 4, rect: [445, 0, 119, 112], pivot: [65, 108], origin: [163, 132] },
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
      strikePart: 'armL', reach: 60, range: 214,
    }),
    heavy: move(RIG, {
      name: 'hook', label: 'Hook',
      startup: 12, active: 4, recovery: 20,
      damage: 110, knockback: 500, lift: -140, drive: 80,
      strikePart: 'armR', reach: 66, range: 148,
    }),
    special: move(RIG, {
      name: 'blackout', label: 'Blackout',
      startup: 11, active: 8, recovery: 24,
      damage: 98, knockback: 540, lift: -80, drive: 500,
      strikePart: 'torso', reach: 49, range: 190,
    }),
  },
};

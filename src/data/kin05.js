/**
 * KIN 05 -- kickboxer.
 *
 * Arms folded for good. Everything she throws comes off the floor.
 */

import { stance, move } from './kit.js';

const RIG = {
  root: 'torso',
  ground: [295, 566],
  parts: [
    { name: 'legL', parent: 'hips', z: 0, rect: [0, 0, 96, 216], pivot: [72, 12], origin: [278, 360], limits: { rot: [-55, 55] } },
    { name: 'legR', parent: 'hips', z: 0, rect: [98, 0, 85, 215], pivot: [20, 12], origin: [322, 360], limits: { rot: [-55, 55] } },
    { name: 'hips', parent: 'torso', z: 1, rect: [483, 0, 107, 64], pivot: [52, 16], origin: [300, 318] },
    { name: 'torso', parent: null, z: 2, rect: [367, 0, 114, 134], pivot: [58, 66], origin: [298, 254] },
    { name: 'head', parent: 'torso', z: 4, rect: [185, 0, 180, 143], pivot: [95, 139], origin: [296, 188] },
  ],
};

export const KIN05 = {
  id: 'kin05',
  name: 'KIN 05',
  subtitle: 'kickboxer',
  atlas: 'assets/atlas/kin05.png',
  rig: RIG,
  scale: 0.59,
  health: 1020,
  walkSpeed: 178,
  backSpeed: 136,
  jumpVel: 670,
  bodyHeight: 517,
  hurtRadius: 54,

  stance: stance({ armed: false, weight: 0.45 }),

  moves: {
    light: move(RIG, {
      name: 'snap', label: 'Snap',
      startup: 5, active: 3, recovery: 9,
      damage: 48, knockback: 220, lift: 0, drive: 150,
      strikePart: 'legR', reach: 54,
    }),
    heavy: move(RIG, {
      name: 'roundhouse', label: 'Roundhouse',
      startup: 11, active: 5, recovery: 19,
      damage: 106, knockback: 490, lift: -130, drive: 90,
      strikePart: 'legL', reach: 62,
    }),
    special: move(RIG, {
      name: 'spiral', label: 'Spiral',
      startup: 10, active: 7, recovery: 23,
      damage: 94, knockback: 520, lift: -100, drive: 460,
      strikePart: 'legR', reach: 64,
    }),
  },
};

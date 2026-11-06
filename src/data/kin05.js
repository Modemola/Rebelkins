/**
 * KIN 05 -- kickboxer.
 *
 * Arms folded for good. Everything she throws comes off the floor.
 */

import { stance, move } from './kit.js';

const RIG = {
  root: 'torso',
  ground: [160, 476],
  parts: [
    { name: 'legL', parent: 'hips', z: 0, rect: [142, 0, 66, 143], pivot: [36, 10], origin: [131, 227], limits: { rot: [-110, 55] } },
    { name: 'legR', parent: 'hips', z: 0, rect: [210, 0, 72, 143], pivot: [30, 10], origin: [191, 227], limits: { rot: [-110, 55] } },
    { name: 'shinR', parent: 'legR', z: 1, rect: [0, 0, 71, 161], pivot: [23, 22], origin: [200, 338], limits: { rot: [-20, 140] } },
    { name: 'shinL', parent: 'legL', z: 1, rect: [73, 0, 67, 160], pivot: [49, 22], origin: [123, 338], limits: { rot: [-20, 140] } },
    { name: 'hips', parent: 'torso', z: 2, rect: [765, 0, 104, 38], pivot: [50, 10], origin: [163, 215] },
    { name: 'torso', parent: null, z: 3, rect: [414, 0, 127, 98], pivot: [60, 22], origin: [161, 149] },
    { name: 'armR', parent: 'torso', z: 4, rect: [707, 0, 56, 79], pivot: [44, 9], origin: [117, 147], limits: { rot: [-170, 170] } },
    { name: 'foreR', parent: 'armR', z: 5, rect: [597, 0, 56, 93], pivot: [30, 18], origin: [96, 199], limits: { rot: [-160, 20] } },
    { name: 'armL', parent: 'torso', z: 6, rect: [655, 0, 50, 81], pivot: [12, 9], origin: [209, 145], limits: { rot: [-170, 170] } },
    { name: 'foreL', parent: 'armL', z: 7, rect: [543, 0, 52, 94], pivot: [23, 18], origin: [225, 199], limits: { rot: [-160, 20] } },
    { name: 'head', parent: 'torso', z: 8, rect: [284, 0, 128, 119], pivot: [65, 115], origin: [159, 129] },
  ],
};

export const KIN05 = {
  id: 'kin05',
  name: 'KIN 05',
  subtitle: 'kickboxer',
  atlas: 'assets/atlas/kin05.png',
  rig: RIG,
  scale: 0.6602,
  health: 1020,
  walkSpeed: 178,
  backSpeed: 136,
  jumpVel: 670,
  bodyHeight: 462,
  hurtRadius: 48,

  stance: stance(RIG, { armed: true, weight: 0.45 }),

  moves: {
    light: move(RIG, {
      name: 'jab', label: 'Jab',
      startup: 4, active: 3, recovery: 9,
      damage: 44, knockback: 210, lift: 0, drive: 150,
      strikePart: 'foreL', reach: 34, range: 180,
    }),
    heavy: move(RIG, {
      name: 'roundhouse', label: 'Roundhouse',
      startup: 11, active: 5, recovery: 19,
      damage: 106, knockback: 490, lift: -130, drive: 90,
      strikePart: 'shinL', reach: 43, range: 205,
    }),
    special: move(RIG, {
      name: 'spiral', label: 'Spiral',
      startup: 10, active: 7, recovery: 23,
      damage: 94, knockback: 520, lift: -100, drive: 460,
      strikePart: 'shinR', reach: 44, range: 253,
    }),
  },
};

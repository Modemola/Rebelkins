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
    { name: 'legR', parent: 'hips', z: 0, rect: [0, 0, 87, 260], pivot: [30, 10], origin: [191, 227], limits: { rot: [-55, 55] } },
    { name: 'legL', parent: 'hips', z: 0, rect: [89, 0, 87, 259], pivot: [57, 10], origin: [131, 227], limits: { rot: [-55, 55] } },
    { name: 'hips', parent: 'torso', z: 1, rect: [561, 0, 104, 38], pivot: [50, 10], origin: [163, 215] },
    { name: 'torso', parent: null, z: 2, rect: [432, 0, 127, 98], pivot: [60, 22], origin: [161, 149] },
    { name: 'armL', parent: 'torso', z: 3, rect: [178, 0, 57, 139], pivot: [12, 9], origin: [209, 145], limits: { rot: [-170, 170] } },
    { name: 'armR', parent: 'torso', z: 3, rect: [237, 0, 63, 136], pivot: [51, 9], origin: [117, 147], limits: { rot: [-170, 170] } },
    { name: 'head', parent: 'torso', z: 4, rect: [302, 0, 128, 119], pivot: [65, 115], origin: [159, 129] },
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
      strikePart: 'armL', reach: 62, range: 178,
    }),
    heavy: move(RIG, {
      name: 'roundhouse', label: 'Roundhouse',
      startup: 11, active: 5, recovery: 19,
      damage: 106, knockback: 490, lift: -130, drive: 90,
      strikePart: 'legL', reach: 55, range: 191,
    }),
    special: move(RIG, {
      name: 'spiral', label: 'Spiral',
      startup: 10, active: 7, recovery: 23,
      damage: 94, knockback: 520, lift: -100, drive: 460,
      strikePart: 'legR', reach: 57, range: 239,
    }),
  },
};

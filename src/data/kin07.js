/**
 * KIN 07 -- rusher.
 *
 * Already mid-stride in the source drawing, and she never really stops.
 */

import { stance, move } from './kit.js';

const RIG = {
  root: 'torso',
  ground: [165, 466],
  parts: [
    { name: 'legL', parent: 'hips', z: 0, rect: [332, 0, 83, 148], pivot: [56, 12], origin: [142, 210], limits: { rot: [-110, 55] } },
    { name: 'legR', parent: 'hips', z: 0, rect: [417, 0, 74, 148], pivot: [26, 12], origin: [194, 210], limits: { rot: [-110, 55] } },
    { name: 'shinR', parent: 'legR', z: 1, rect: [134, 0, 90, 165], pivot: [40, 22], origin: [209, 324], limits: { rot: [-20, 140] } },
    { name: 'shinL', parent: 'legL', z: 1, rect: [226, 0, 104, 162], pivot: [60, 22], origin: [126, 324], limits: { rot: [-20, 140] } },
    { name: 'hips', parent: 'torso', z: 2, rect: [912, 0, 98, 44], pivot: [50, 12], origin: [168, 200] },
    { name: 'torso', parent: null, z: 3, rect: [665, 0, 94, 80], pivot: [48, 22], origin: [166, 152] },
    { name: 'armR', parent: 'torso', z: 4, rect: [820, 0, 90, 53], pivot: [64, 11], origin: [130, 190], limits: { rot: [-170, 170] } },
    { name: 'foreR', parent: 'armR', z: 5, rect: [561, 0, 102, 84], pivot: [62, 18], origin: [114, 214], limits: { rot: [-160, 20] } },
    { name: 'armL', parent: 'torso', z: 6, rect: [493, 0, 66, 93], pivot: [11, 11], origin: [200, 150], limits: { rot: [-170, 170] } },
    { name: 'foreL', parent: 'armL', z: 7, rect: [761, 0, 57, 74], pivot: [22, 18], origin: [226, 214], limits: { rot: [-160, 20] } },
    { name: 'head', parent: 'torso', z: 8, rect: [0, 0, 132, 183], pivot: [77, 103], origin: [164, 130] },
  ],
};

export const KIN07 = {
  id: 'kin07',
  name: 'KIN 07',
  subtitle: 'rusher',
  atlas: 'assets/atlas/kin07.png',
  rig: RIG,
  scale: 0.6922,
  health: 1000,
  walkSpeed: 190,
  backSpeed: 148,
  jumpVel: 690,
  bodyHeight: 439,
  hurtRadius: 59,

  stance: stance(RIG, { armed: true, weight: 0.3 }),

  moves: {
    light: move(RIG, {
      name: 'jab', label: 'Jab',
      startup: 4, active: 3, recovery: 8,
      damage: 44, knockback: 200, lift: 0, drive: 170,
      strikePart: 'foreL', reach: 34, range: 178,
    }),
    heavy: move(RIG, {
      name: 'hammer', label: 'Hammer',
      startup: 11, active: 4, recovery: 18,
      damage: 100, knockback: 470, lift: -120, drive: 230,
      strikePart: 'foreR', reach: 52, range: 144,
    }),
    special: move(RIG, {
      name: 'dash', label: 'Dash',
      startup: 9, active: 7, recovery: 21,
      damage: 90, knockback: 500, lift: -60, drive: 600,
      strikePart: 'torso', reach: 57, range: 160,
    }),
  },
};

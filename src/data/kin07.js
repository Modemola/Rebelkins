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
    { name: 'legR', parent: 'hips', z: 0, rect: [0, 0, 91, 269], pivot: [26, 12], origin: [194, 210], limits: { rot: [-55, 55] } },
    { name: 'legL', parent: 'hips', z: 0, rect: [93, 0, 103, 266], pivot: [76, 12], origin: [142, 210], limits: { rot: [-55, 55] } },
    { name: 'hips', parent: 'torso', z: 1, rect: [608, 0, 98, 44], pivot: [50, 12], origin: [168, 200] },
    { name: 'torso', parent: null, z: 2, rect: [512, 0, 94, 80], pivot: [48, 22], origin: [166, 152] },
    { name: 'armL', parent: 'torso', z: 3, rect: [332, 0, 72, 131], pivot: [11, 11], origin: [200, 150], limits: { rot: [-170, 170] } },
    { name: 'armR', parent: 'torso', z: 3, rect: [406, 0, 104, 101], pivot: [78, 11], origin: [130, 190], limits: { rot: [-170, 170] } },
    { name: 'head', parent: 'torso', z: 4, rect: [198, 0, 132, 183], pivot: [77, 103], origin: [164, 130] },
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

  stance: stance({ armed: false, weight: 0.3 }),

  moves: {
    light: move(RIG, {
      name: 'jab', label: 'Jab',
      startup: 4, active: 3, recovery: 8,
      damage: 44, knockback: 200, lift: 0, drive: 170,
      strikePart: 'armL', reach: 62, range: 172,
    }),
    heavy: move(RIG, {
      name: 'hammer', label: 'Hammer',
      startup: 11, active: 4, recovery: 18,
      damage: 100, knockback: 470, lift: -120, drive: 90,
      strikePart: 'armR', reach: 66, range: 123,
    }),
    special: move(RIG, {
      name: 'dash', label: 'Dash',
      startup: 9, active: 7, recovery: 21,
      damage: 90, knockback: 500, lift: -60, drive: 600,
      strikePart: 'torso', reach: 57, range: 115,
    }),
  },
};

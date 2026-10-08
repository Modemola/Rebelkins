/**
 * KIN 03 -- duelist.
 *
 * Bell sleeves carry a long way past the fist, which is most of her reach.
 */

import { stance, move } from './kit.js';

const RIG = {
  root: 'torso',
  // the illustration faces screen-left, so the rig mirrors to face right
  art: -1,
  ground: [292, 560],
  parts: [
    { name: 'legL', parent: 'hips', z: 0, rect: [259, 0, 97, 165], pivot: [80, 10], origin: [280, 404], limits: { rot: [-55, 55] } },
    { name: 'legR', parent: 'hips', z: 0, rect: [358, 0, 65, 162], pivot: [15, 10], origin: [336, 404], limits: { rot: [-55, 55] } },
    { name: 'hips', parent: 'torso', z: 1, rect: [659, 0, 100, 56], pivot: [52, 18], origin: [300, 364] },
    { name: 'torso', parent: null, z: 2, rect: [149, 0, 108, 168], pivot: [52, 80], origin: [290, 278] },
    { name: 'armL', parent: 'torso', z: 3, rect: [425, 0, 121, 158], pivot: [81, 18], origin: [258, 228], limits: { rot: [-130, 130] } },
    { name: 'armR', parent: 'torso', z: 3, rect: [548, 0, 109, 143], pivot: [18, 15], origin: [330, 246], limits: { rot: [-130, 130] } },
    { name: 'head', parent: 'torso', z: 4, rect: [0, 0, 147, 169], pivot: [72, 161], origin: [290, 204] },
  ],
};

export const KIN03 = {
  id: 'kin03',
  name: 'KIN 03',
  subtitle: 'duelist',
  atlas: 'assets/atlas/kin03.png',
  rig: RIG,
  scale: 0.59,
  health: 980,
  walkSpeed: 182,
  backSpeed: 140,
  jumpVel: 680,
  bodyHeight: 517,
  hurtRadius: 62,

  stance: stance({ armed: true, weight: 0.35 }),

  moves: {
    light: move(RIG, {
      name: 'sleeve', label: 'Sleeve',
      startup: 5, active: 4, recovery: 9,
      damage: 40, knockback: 200, lift: 0, drive: 150,
      strikePart: 'armL', reach: 60,
    }),
    heavy: move(RIG, {
      name: 'crescent', label: 'Crescent',
      startup: 11, active: 4, recovery: 18,
      damage: 96, knockback: 460, lift: -120, drive: 85,
      strikePart: 'armR', reach: 76,
    }),
    special: move(RIG, {
      name: 'whirl', label: 'Whirl',
      startup: 10, active: 8, recovery: 24,
      damage: 90, knockback: 500, lift: -60, drive: 480,
      strikePart: 'armL', reach: 68,
    }),
  },
};

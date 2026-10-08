/**
 * KIN 09 -- fencer.
 *
 * Her lead arm was already extended, which made it the easiest limb in the set to free.
 */

import { stance, move } from './kit.js';

const RIG = {
  root: 'torso',
  // the illustration faces screen-left, so the rig mirrors to face right
  art: -1,
  ground: [312, 580],
  parts: [
    { name: 'legL', parent: 'hips', z: 0, rect: [0, 0, 116, 243], pivot: [24, 14], origin: [250, 350], limits: { rot: [-55, 55] } },
    { name: 'legR', parent: 'hips', z: 0, rect: [118, 0, 129, 241], pivot: [24, 14], origin: [292, 350], limits: { rot: [-55, 55] } },
    { name: 'hips', parent: 'torso', z: 1, rect: [627, 0, 141, 56], pivot: [65, 18], origin: [272, 314] },
    { name: 'torso', parent: null, z: 2, rect: [389, 0, 150, 130], pivot: [73, 64], origin: [292, 246] },
    { name: 'armR', parent: 'torso', z: 3, rect: [541, 0, 84, 115], pivot: [70, 84], origin: [262, 204], limits: { rot: [-130, 130] } },
    { name: 'head', parent: 'torso', z: 4, rect: [249, 0, 138, 191], pivot: [68, 149], origin: [300, 196] },
  ],
};

export const KIN09 = {
  id: 'kin09',
  name: 'KIN 09',
  subtitle: 'fencer',
  atlas: 'assets/atlas/kin09.png',
  rig: RIG,
  scale: 0.57,
  health: 940,
  walkSpeed: 186,
  backSpeed: 144,
  jumpVel: 700,
  bodyHeight: 533,
  hurtRadius: 56,

  stance: stance({ armed: true, weight: 0.3 }),

  moves: {
    light: move(RIG, {
      name: 'point', label: 'Point',
      startup: 4, active: 3, recovery: 8,
      damage: 40, knockback: 190, lift: 0, drive: 160,
      strikePart: 'armR', reach: 58,
    }),
    heavy: move(RIG, {
      name: 'lash', label: 'Lash',
      startup: 10, active: 4, recovery: 17,
      damage: 94, knockback: 450, lift: -110, drive: 90,
      strikePart: 'armR', reach: 64,
    }),
    special: move(RIG, {
      name: 'lunge', label: 'Lunge',
      startup: 9, active: 7, recovery: 22,
      damage: 88, knockback: 500, lift: -50, drive: 560,
      strikePart: 'armR', reach: 70,
    }),
  },
};

/**
 * KIN 07 -- rusher.
 *
 * Already mid-stride in the source drawing, and she never really stops.
 */

import { stance, move } from './kit.js';

const RIG = {
  root: 'torso',
  // the illustration faces screen-left, so the rig mirrors to face right
  art: -1,
  ground: [300, 492],
  parts: [
    { name: 'legR', parent: 'hips', z: 0, rect: [216, 0, 108, 139], pivot: [21, 14], origin: [324, 370], limits: { rot: [-55, 55] } },
    { name: 'legL', parent: 'hips', z: 0, rect: [326, 0, 104, 138], pivot: [73, 14], origin: [272, 370], limits: { rot: [-55, 55] } },
    { name: 'hips', parent: 'torso', z: 1, rect: [558, 0, 124, 60], pivot: [60, 16], origin: [288, 328] },
    { name: 'torso', parent: null, z: 2, rect: [432, 0, 124, 122], pivot: [54, 48], origin: [286, 250] },
    { name: 'head', parent: 'torso', z: 4, rect: [0, 0, 214, 290], pivot: [100, 140], origin: [286, 204] },
  ],
};

export const KIN07 = {
  id: 'kin07',
  name: 'KIN 07',
  subtitle: 'rusher',
  atlas: 'assets/atlas/kin07.png',
  rig: RIG,
  scale: 0.71,
  health: 1000,
  walkSpeed: 190,
  backSpeed: 148,
  jumpVel: 690,
  bodyHeight: 428,
  hurtRadius: 58,

  stance: stance({ armed: false, weight: 0.3 }),

  moves: {
    light: move(RIG, {
      name: 'scuff', label: 'Scuff',
      startup: 5, active: 3, recovery: 8,
      damage: 44, knockback: 200, lift: 0, drive: 170,
      strikePart: 'legL', reach: 50,
    }),
    heavy: move(RIG, {
      name: 'hammer', label: 'Hammer',
      startup: 11, active: 4, recovery: 18,
      damage: 100, knockback: 470, lift: -120, drive: 90,
      strikePart: 'legR', reach: 58,
    }),
    special: move(RIG, {
      name: 'dash', label: 'Dash',
      startup: 9, active: 7, recovery: 21,
      damage: 90, knockback: 500, lift: -60, drive: 600,
      strikePart: 'torso', reach: 56,
    }),
  },
};

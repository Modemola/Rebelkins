/**
 * KIN 02 -- counterpuncher.
 *
 * Only her near arm stood clear of the vest; the far one is welded in, so everything comes off one hand.
 */

import { stance, move } from './kit.js';

const RIG = {
  root: 'torso',
  // the illustration faces screen-left, so the rig mirrors to face right
  art: -1,
  ground: [300, 576],
  parts: [
    { name: 'legR', parent: 'hips', z: 0, rect: [145, 0, 82, 190], pivot: [27, 12], origin: [328, 398], limits: { rot: [-55, 55] } },
    { name: 'legL', parent: 'hips', z: 0, rect: [229, 0, 87, 188], pivot: [54, 12], origin: [268, 398], limits: { rot: [-55, 55] } },
    { name: 'hips', parent: 'torso', z: 1, rect: [537, 0, 121, 62], pivot: [71, 16], origin: [288, 348] },
    { name: 'torso', parent: null, z: 2, rect: [0, 0, 143, 216], pivot: [76, 70], origin: [290, 248] },
    { name: 'armR', parent: 'torso', z: 3, rect: [318, 0, 80, 156], pivot: [15, 13], origin: [336, 198], limits: { rot: [-120, 120] } },
    { name: 'head', parent: 'torso', z: 4, rect: [400, 0, 135, 141], pivot: [74, 135], origin: [308, 178] },
  ],
};

export const KIN02 = {
  id: 'kin02',
  name: 'KIN 02',
  subtitle: 'counterpuncher',
  atlas: 'assets/atlas/kin02.png',
  rig: RIG,
  scale: 0.57,
  health: 1040,
  walkSpeed: 176,
  backSpeed: 134,
  jumpVel: 660,
  bodyHeight: 533,
  hurtRadius: 58,

  stance: stance({ armed: true, weight: 0.4 }),

  moves: {
    light: move(RIG, {
      name: 'cross', label: 'Cross',
      startup: 4, active: 3, recovery: 8,
      damage: 44, knockback: 210, lift: 0, drive: 160,
      strikePart: 'armR', reach: 76,
    }),
    heavy: move(RIG, {
      name: 'overhand', label: 'Overhand',
      startup: 10, active: 5, recovery: 18,
      damage: 100, knockback: 470, lift: -120, drive: 95,
      strikePart: 'armR', reach: 68,
    }),
    special: move(RIG, {
      name: 'shoulder', label: 'Shoulder',
      startup: 9, active: 6, recovery: 22,
      damage: 88, knockback: 520, lift: -70, drive: 540,
      strikePart: 'torso', reach: 56,
    }),
  },
};

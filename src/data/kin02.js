/**
 * KIN 02 -- counterpuncher.
 *
 * Only her near arm stood clear of the vest; the far one is welded in, so everything comes off one hand.
 */

import { stance, move } from './kit.js';

const RIG = {
  root: 'torso',
  ground: [168, 466],
  parts: [
    { name: 'legR', parent: 'hips', z: 0, rect: [0, 0, 87, 242], pivot: [28, 12], origin: [196, 240], limits: { rot: [-55, 55] } },
    { name: 'legL', parent: 'hips', z: 0, rect: [89, 0, 96, 240], pivot: [65, 12], origin: [138, 240], limits: { rot: [-55, 55] } },
    { name: 'hips', parent: 'torso', z: 1, rect: [564, 0, 89, 44], pivot: [58, 12], origin: [168, 232] },
    { name: 'torso', parent: null, z: 2, rect: [378, 0, 103, 140], pivot: [55, 24], origin: [164, 126] },
    { name: 'armL', parent: 'torso', z: 3, rect: [187, 0, 95, 167], pivot: [12, 10], origin: [202, 116], limits: { rot: [-170, 170] } },
    { name: 'armR', parent: 'torso', z: 3, rect: [284, 0, 92, 157], pivot: [81, 0], origin: [120, 116], limits: { rot: [-170, 170] } },
    { name: 'head', parent: 'torso', z: 4, rect: [483, 0, 79, 78], pivot: [41, 74], origin: [162, 106] },
  ],
};

export const KIN02 = {
  id: 'kin02',
  name: 'KIN 02',
  subtitle: 'counterpuncher',
  atlas: 'assets/atlas/kin02.png',
  rig: RIG,
  scale: 0.7,
  health: 1040,
  walkSpeed: 176,
  backSpeed: 134,
  jumpVel: 660,
  bodyHeight: 434,
  hurtRadius: 47,

  stance: stance(RIG, { armed: true, weight: 0.4 }),

  moves: {
    light: move(RIG, {
      name: 'jab', label: 'Jab',
      startup: 4, active: 3, recovery: 8,
      damage: 44, knockback: 210, lift: 0, drive: 160,
      strikePart: 'armL', reach: 62, range: 201,
    }),
    heavy: move(RIG, {
      name: 'overhand', label: 'Overhand',
      startup: 10, active: 5, recovery: 18,
      damage: 100, knockback: 470, lift: -120, drive: 95,
      strikePart: 'armR', reach: 55, range: 138,
    }),
    special: move(RIG, {
      name: 'shoulder', label: 'Shoulder',
      startup: 9, active: 6, recovery: 22,
      damage: 88, knockback: 520, lift: -70, drive: 540,
      strikePart: 'torso', reach: 46, range: 106,
    }),
  },
};

/**
 * KIN 10 -- ember.
 *
 * The heaviest of them, and the slowest. Arms folded inside the puffer.
 */

import { stance, move } from './kit.js';

const RIG = {
  root: 'torso',
  ground: [288, 548],
  parts: [
    { name: 'legR', parent: 'hips', z: 0, rect: [279, 0, 68, 128], pivot: [25, 12], origin: [318, 430], limits: { rot: [-55, 55] } },
    { name: 'legL', parent: 'hips', z: 0, rect: [349, 0, 85, 127], pivot: [54, 12], origin: [262, 430], limits: { rot: [-55, 55] } },
    { name: 'hips', parent: 'torso', z: 1, rect: [436, 0, 130, 56], pivot: [66, 16], origin: [290, 394] },
    { name: 'torso', parent: null, z: 2, rect: [0, 0, 150, 220], pivot: [74, 90], origin: [292, 268] },
    { name: 'head', parent: 'torso', z: 4, rect: [152, 0, 125, 135], pivot: [69, 129], origin: [288, 188] },
  ],
};

export const KIN10 = {
  id: 'kin10',
  name: 'KIN 10',
  subtitle: 'ember',
  atlas: 'assets/atlas/kin10.png',
  rig: RIG,
  scale: 0.62,
  health: 1140,
  walkSpeed: 148,
  backSpeed: 112,
  jumpVel: 580,
  bodyHeight: 489,
  hurtRadius: 60,

  stance: stance({ armed: false, weight: 0.85 }),

  moves: {
    light: move(RIG, {
      name: 'stomp', label: 'Stomp',
      startup: 6, active: 4, recovery: 11,
      damage: 56, knockback: 250, lift: 0, drive: 130,
      strikePart: 'legL', reach: 54,
    }),
    heavy: move(RIG, {
      name: 'flare', label: 'Flare',
      startup: 12, active: 5, recovery: 21,
      damage: 118, knockback: 530, lift: -150, drive: 80,
      strikePart: 'torso', reach: 70,
    }),
    special: move(RIG, {
      name: 'burnout', label: 'Burnout',
      startup: 11, active: 8, recovery: 25,
      damage: 104, knockback: 560, lift: -90, drive: 470,
      strikePart: 'legR', reach: 62,
    }),
  },
};

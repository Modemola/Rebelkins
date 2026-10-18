/**
 * KIN 10 -- ember.
 *
 * The heaviest of them, and the slowest. Arms folded inside the puffer.
 */

import { stance, move } from './kit.js';

const RIG = {
  root: 'torso',
  ground: [165, 466],
  parts: [
    { name: 'legL', parent: 'hips', z: 0, rect: [0, 0, 94, 214], pivot: [61, 12], origin: [140, 268], limits: { rot: [-55, 55] } },
    { name: 'legR', parent: 'hips', z: 0, rect: [96, 0, 78, 214], pivot: [26, 12], origin: [196, 268], limits: { rot: [-55, 55] } },
    { name: 'hips', parent: 'torso', z: 1, rect: [651, 0, 136, 44], pivot: [68, 12], origin: [168, 260] },
    { name: 'torso', parent: null, z: 2, rect: [500, 0, 149, 126], pivot: [68, 30], origin: [166, 176] },
    { name: 'armR', parent: 'torso', z: 3, rect: [176, 0, 99, 150], pivot: [77, 11], origin: [112, 168], limits: { rot: [-170, 170] } },
    { name: 'armL', parent: 'torso', z: 3, rect: [424, 0, 74, 147], pivot: [16, 7], origin: [230, 166], limits: { rot: [-170, 170] } },
    { name: 'head', parent: 'torso', z: 4, rect: [277, 0, 145, 150], pivot: [73, 144], origin: [162, 152] },
  ],
};

export const KIN10 = {
  id: 'kin10',
  name: 'KIN 10',
  subtitle: 'ember',
  atlas: 'assets/atlas/kin10.png',
  rig: RIG,
  scale: 0.662,
  health: 1140,
  walkSpeed: 148,
  backSpeed: 112,
  jumpVel: 580,
  bodyHeight: 458,
  hurtRadius: 56,

  stance: stance(RIG, { armed: true, weight: 0.85 }),

  moves: {
    light: move(RIG, {
      name: 'jab', label: 'Jab',
      startup: 5, active: 3, recovery: 10,
      damage: 50, knockback: 225, lift: 0, drive: 145,
      strikePart: 'armL', reach: 62, range: 212,
    }),
    heavy: move(RIG, {
      name: 'flare', label: 'Flare',
      startup: 12, active: 5, recovery: 21,
      damage: 118, knockback: 530, lift: -150, drive: 80,
      strikePart: 'torso', reach: 66, range: 172,
    }),
    special: move(RIG, {
      name: 'burnout', label: 'Burnout',
      startup: 11, active: 8, recovery: 25,
      damage: 104, knockback: 560, lift: -90, drive: 470,
      strikePart: 'legR', reach: 58, range: 227,
    }),
  },
};

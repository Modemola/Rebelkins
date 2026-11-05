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
    { name: 'legL', parent: 'hips', z: 0, rect: [472, 0, 83, 123], pivot: [51, 12], origin: [140, 268], limits: { rot: [-110, 55] } },
    { name: 'legR', parent: 'hips', z: 0, rect: [557, 0, 71, 123], pivot: [26, 12], origin: [196, 268], limits: { rot: [-110, 55] } },
    { name: 'shinL', parent: 'legL', z: 1, rect: [147, 0, 93, 135], pivot: [51, 22], origin: [130, 357], limits: { rot: [-20, 140] } },
    { name: 'shinR', parent: 'legR', z: 1, rect: [242, 0, 77, 135], pivot: [38, 22], origin: [209, 357], limits: { rot: [-20, 140] } },
    { name: 'hips', parent: 'torso', z: 2, rect: [921, 0, 136, 44], pivot: [68, 12], origin: [168, 260] },
    { name: 'torso', parent: null, z: 3, rect: [321, 0, 149, 126], pivot: [68, 30], origin: [166, 176] },
    { name: 'armR', parent: 'torso', z: 4, rect: [790, 0, 75, 88], pivot: [53, 11], origin: [112, 168], limits: { rot: [-170, 170] } },
    { name: 'foreR', parent: 'armR', z: 5, rect: [630, 0, 86, 98], pivot: [47, 18], origin: [82, 227], limits: { rot: [-160, 20] } },
    { name: 'armL', parent: 'torso', z: 6, rect: [867, 0, 52, 86], pivot: [16, 7], origin: [230, 166], limits: { rot: [-170, 170] } },
    { name: 'foreL', parent: 'armL', z: 7, rect: [718, 0, 70, 97], pivot: [33, 18], origin: [251, 227], limits: { rot: [-160, 20] } },
    { name: 'head', parent: 'torso', z: 8, rect: [0, 0, 145, 150], pivot: [73, 144], origin: [162, 152] },
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
      strikePart: 'foreL', reach: 34, range: 192,
    }),
    heavy: move(RIG, {
      name: 'flare', label: 'Flare',
      startup: 12, active: 5, recovery: 21,
      damage: 118, knockback: 530, lift: -150, drive: 80,
      strikePart: 'torso', reach: 66, range: 187,
    }),
    special: move(RIG, {
      name: 'burnout', label: 'Burnout',
      startup: 11, active: 8, recovery: 25,
      damage: 104, knockback: 560, lift: -90, drive: 470,
      strikePart: 'shinR', reach: 45, range: 221,
    }),
  },
};

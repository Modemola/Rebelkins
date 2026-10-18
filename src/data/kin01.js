/**
 * KIN 01 -- brawler.
 *
 * Both arms came away clean above the shoulder line, so this one hits from overhead.
 */

import { stance, move } from './kit.js';

const RIG = {
  root: 'torso',
  ground: [164, 472],
  parts: [
    { name: 'legL', parent: 'hips', z: 0, rect: [0, 0, 105, 258], pivot: [78, 14], origin: [140, 228], limits: { rot: [-55, 55] } },
    { name: 'legR', parent: 'hips', z: 0, rect: [107, 0, 99, 257], pivot: [28, 14], origin: [194, 228], limits: { rot: [-55, 55] } },
    { name: 'hips', parent: 'torso', z: 1, rect: [561, 0, 105, 48], pivot: [47, 14], origin: [168, 218] },
    { name: 'torso', parent: null, z: 2, rect: [282, 0, 142, 128], pivot: [72, 24], origin: [166, 128] },
    { name: 'armR', parent: 'torso', z: 3, rect: [208, 0, 72, 142], pivot: [52, 1], origin: [104, 124], limits: { rot: [-170, 170] } },
    { name: 'armL', parent: 'torso', z: 3, rect: [426, 0, 64, 119], pivot: [13, -25], origin: [226, 124], limits: { rot: [-170, 170] } },
    { name: 'head', parent: 'torso', z: 4, rect: [492, 0, 67, 103], pivot: [37, 99], origin: [164, 110] },
  ],
};

export const KIN01 = {
  id: 'kin01',
  name: 'KIN 01',
  subtitle: 'brawler',
  atlas: 'assets/atlas/kin01.png',
  rig: RIG,
  scale: 0.6594,
  health: 1060,
  walkSpeed: 160,
  backSpeed: 120,
  jumpVel: 630,
  bodyHeight: 461,
  hurtRadius: 74,

  stance: stance(RIG, { armed: true, weight: 0.7 }),

  moves: {
    light: move(RIG, {
      name: 'rake', label: 'Rake',
      startup: 5, active: 3, recovery: 10,
      damage: 46, knockback: 220, lift: 0, drive: 150,
      strikePart: 'armL', reach: 116, range: 243,
    }),
    heavy: move(RIG, {
      name: 'slam', label: 'Slam',
      startup: 11, active: 4, recovery: 19,
      damage: 104, knockback: 480, lift: -130, drive: 90,
      strikePart: 'armR', reach: 74, range: 140,
    }),
    special: move(RIG, {
      name: 'pounce', label: 'Pounce',
      startup: 10, active: 7, recovery: 23,
      damage: 92, knockback: 540, lift: -90, drive: 520,
      strikePart: 'armL', reach: 89, range: 236,
    }),
  },
};

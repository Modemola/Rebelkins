/**
 * KIN 01 -- brawler.
 *
 * Both arms came away clean above the shoulder line, so this one hits from overhead.
 */

import { stance, move } from './kit.js';

const RIG = {
  root: 'torso',
  ground: [300, 536],
  parts: [
    { name: 'legL', parent: 'hips', z: 0, rect: [85, 0, 114, 135], pivot: [81, 12], origin: [268, 412], limits: { rot: [-55, 55] } },
    { name: 'legR', parent: 'hips', z: 0, rect: [201, 0, 118, 135], pivot: [29, 12], origin: [330, 412], limits: { rot: [-55, 55] } },
    { name: 'hips', parent: 'torso', z: 1, rect: [651, 0, 112, 72], pivot: [54, 18], origin: [300, 366] },
    { name: 'torso', parent: null, z: 2, rect: [411, 0, 134, 124], pivot: [66, 54], origin: [300, 298] },
    { name: 'armL', parent: 'torso', z: 3, rect: [0, 0, 83, 137], pivot: [59, 119], origin: [240, 248], limits: { rot: [-130, 130] } },
    { name: 'armR', parent: 'torso', z: 3, rect: [321, 0, 88, 135], pivot: [27, 121], origin: [362, 248], limits: { rot: [-130, 130] } },
    { name: 'head', parent: 'torso', z: 4, rect: [547, 0, 102, 114], pivot: [48, 96], origin: [300, 258] },
  ],
};

export const KIN01 = {
  id: 'kin01',
  name: 'KIN 01',
  subtitle: 'brawler',
  atlas: 'assets/atlas/kin01.png',
  rig: RIG,
  scale: 0.75,
  health: 1060,
  walkSpeed: 160,
  backSpeed: 120,
  jumpVel: 630,
  bodyHeight: 374,
  hurtRadius: 60,

  stance: stance({ armed: true, weight: 0.7 }),

  moves: {
    light: move(RIG, {
      name: 'rake', label: 'Rake',
      startup: 5, active: 3, recovery: 10,
      damage: 46, knockback: 220, lift: 0, drive: 150,
      strikePart: 'armL', reach: 94,
    }),
    heavy: move(RIG, {
      name: 'slam', label: 'Slam',
      startup: 11, active: 4, recovery: 19,
      damage: 104, knockback: 480, lift: -130, drive: 90,
      strikePart: 'armR', reach: 60,
    }),
    special: move(RIG, {
      name: 'pounce', label: 'Pounce',
      startup: 10, active: 7, recovery: 23,
      damage: 92, knockback: 540, lift: -90, drive: 520,
      strikePart: 'armL', reach: 72,
    }),
  },
};

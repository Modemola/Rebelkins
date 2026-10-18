/**
 * KIN 03 -- duelist.
 *
 * Bell sleeves carry a long way past the fist, which is most of her reach.
 */

import { stance, move } from './kit.js';

const RIG = {
  root: 'torso',
  ground: [157, 476],
  parts: [
    { name: 'legL', parent: 'hips', z: 0, rect: [0, 0, 87, 282], pivot: [65, 14], origin: [136, 208], limits: { rot: [-55, 55] } },
    { name: 'legR', parent: 'hips', z: 0, rect: [89, 0, 68, 278], pivot: [22, 14], origin: [180, 208], limits: { rot: [-55, 55] } },
    { name: 'hips', parent: 'torso', z: 1, rect: [520, 0, 86, 52], pivot: [42, 14], origin: [158, 200] },
    { name: 'torso', parent: null, z: 2, rect: [410, 0, 108, 94], pivot: [53, 22], origin: [154, 132] },
    { name: 'armL', parent: 'torso', z: 3, rect: [159, 0, 81, 154], pivot: [20, -1], origin: [198, 126], limits: { rot: [-170, 170] } },
    { name: 'armR', parent: 'torso', z: 3, rect: [242, 0, 76, 151], pivot: [56, 1], origin: [112, 126], limits: { rot: [-170, 170] } },
    { name: 'head', parent: 'torso', z: 4, rect: [320, 0, 88, 105], pivot: [48, 101], origin: [150, 116] },
  ],
};

export const KIN03 = {
  id: 'kin03',
  name: 'KIN 03',
  subtitle: 'duelist',
  atlas: 'assets/atlas/kin03.png',
  rig: RIG,
  scale: 0.6617,
  health: 980,
  walkSpeed: 182,
  backSpeed: 140,
  jumpVel: 680,
  bodyHeight: 461,
  hurtRadius: 55,

  stance: stance(RIG, { armed: true, weight: 0.35 }),

  moves: {
    light: move(RIG, {
      name: 'sleeve', label: 'Sleeve',
      startup: 5, active: 4, recovery: 9,
      damage: 40, knockback: 200, lift: 0, drive: 150,
      strikePart: 'armL', reach: 53, range: 199,
    }),
    heavy: move(RIG, {
      name: 'crescent', label: 'Crescent',
      startup: 11, active: 4, recovery: 18,
      damage: 96, knockback: 460, lift: -120, drive: 85,
      strikePart: 'armR', reach: 68, range: 153,
    }),
    special: move(RIG, {
      name: 'whirl', label: 'Whirl',
      startup: 10, active: 8, recovery: 24,
      damage: 90, knockback: 500, lift: -60, drive: 480,
      strikePart: 'armL', reach: 61, range: 215,
    }),
  },
};

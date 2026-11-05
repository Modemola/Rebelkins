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
    { name: 'legL', parent: 'hips', z: 0, rect: [126, 0, 59, 156], pivot: [37, 14], origin: [136, 208], limits: { rot: [-110, 55] } },
    { name: 'legR', parent: 'hips', z: 0, rect: [187, 0, 56, 156], pivot: [22, 14], origin: [180, 208], limits: { rot: [-110, 55] } },
    { name: 'shinL', parent: 'legL', z: 1, rect: [0, 0, 73, 170], pivot: [53, 22], origin: [124, 328], limits: { rot: [-20, 140] } },
    { name: 'shinR', parent: 'legR', z: 1, rect: [75, 0, 49, 166], pivot: [11, 22], origin: [188, 328], limits: { rot: [-20, 140] } },
    { name: 'hips', parent: 'torso', z: 2, rect: [705, 0, 86, 52], pivot: [42, 14], origin: [158, 200] },
    { name: 'torso', parent: null, z: 3, rect: [469, 0, 108, 94], pivot: [53, 22], origin: [154, 132] },
    { name: 'armR', parent: 'torso', z: 4, rect: [579, 0, 62, 84], pivot: [42, 1], origin: [112, 126], limits: { rot: [-170, 170] } },
    { name: 'foreR', parent: 'armR', z: 5, rect: [405, 0, 62, 103], pivot: [32, 18], origin: [88, 191], limits: { rot: [-160, 20] } },
    { name: 'armL', parent: 'torso', z: 6, rect: [643, 0, 60, 82], pivot: [20, -1], origin: [198, 126], limits: { rot: [-170, 170] } },
    { name: 'foreL', parent: 'armL', z: 7, rect: [245, 0, 68, 108], pivot: [31, 18], origin: [222, 191], limits: { rot: [-160, 20] } },
    { name: 'head', parent: 'torso', z: 8, rect: [315, 0, 88, 105], pivot: [48, 101], origin: [150, 116] },
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
      strikePart: 'foreL', reach: 30, range: 184,
    }),
    heavy: move(RIG, {
      name: 'crescent', label: 'Crescent',
      startup: 11, active: 4, recovery: 18,
      damage: 96, knockback: 460, lift: -120, drive: 230,
      strikePart: 'foreR', reach: 54, range: 108,
    }),
    special: move(RIG, {
      name: 'whirl', label: 'Whirl',
      startup: 10, active: 8, recovery: 24,
      damage: 90, knockback: 500, lift: -60, drive: 480,
      strikePart: 'foreL', reach: 34, range: 189,
    }),
  },
};

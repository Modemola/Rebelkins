/**
 * KIN 04 -- ghost.
 *
 * Hands buried in the coat. Nothing to cut free, so the coat itself is the weapon.
 */

import { stance, move } from './kit.js';

const RIG = {
  root: 'torso',
  // the illustration faces screen-left, so the rig mirrors to face right
  art: -1,
  ground: [294, 560],
  parts: [
    { name: 'legL', parent: 'hips', z: 0, rect: [377, 0, 70, 163], pivot: [35, 12], origin: [268, 408], limits: { rot: [-55, 55] } },
    { name: 'legR', parent: 'hips', z: 0, rect: [449, 0, 76, 163], pivot: [26, 12], origin: [316, 408], limits: { rot: [-55, 55] } },
    { name: 'hips', parent: 'torso', z: 1, rect: [527, 0, 129, 48], pivot: [64, 16], origin: [302, 392] },
    { name: 'torso', parent: null, z: 2, rect: [0, 0, 153, 194], pivot: [69, 90], origin: [300, 296] },
    { name: 'head', parent: 'torso', z: 4, rect: [155, 0, 220, 190], pivot: [136, 180], origin: [300, 212] },
  ],
};

export const KIN04 = {
  id: 'kin04',
  name: 'KIN 04',
  subtitle: 'ghost',
  atlas: 'assets/atlas/kin04.png',
  rig: RIG,
  scale: 0.58,
  health: 1080,
  walkSpeed: 168,
  backSpeed: 126,
  jumpVel: 620,
  bodyHeight: 528,
  hurtRadius: 64,

  stance: stance({ armed: false, weight: 0.65 }),

  moves: {
    light: move(RIG, {
      name: 'shin', label: 'Shin',
      startup: 6, active: 3, recovery: 10,
      damage: 50, knockback: 230, lift: 0, drive: 140,
      strikePart: 'legL', reach: 52,
    }),
    heavy: move(RIG, {
      name: 'axe', label: 'Axe',
      startup: 12, active: 4, recovery: 20,
      damage: 110, knockback: 500, lift: -140, drive: 80,
      strikePart: 'legR', reach: 58,
    }),
    special: move(RIG, {
      name: 'blackout', label: 'Blackout',
      startup: 11, active: 8, recovery: 24,
      damage: 98, knockback: 540, lift: -80, drive: 500,
      strikePart: 'torso', reach: 58,
    }),
  },
};

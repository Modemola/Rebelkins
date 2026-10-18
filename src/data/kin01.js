/**
 * KIN 01 -- brawler.
 *
 * Both arms came away clean above the shoulder line, so this one hits from overhead.
 *
 * The first character cut at the elbow and the knee. Every rig in this cast
 * started as seven rigid parts, which meant an arm that could only sweep from
 * the shoulder like a clock hand and a leg that could only swing like a
 * pendulum -- no amount of tuning makes that look like a punch, because the
 * motion is not in the skeleton. Eleven parts now: the forearms and shins hang
 * off their own halves, so the hand can chamber at the chin and extend on a
 * line, and the knee can fold and snap out.
 *
 * The hitboxes move with them: a punch strikes with `foreL`/`foreR`, not with
 * the upper arm, and `reach` drops accordingly -- it is a fist now rather than
 * the whole limb.
 */

import { stance, move } from './kit.js';

const RIG = {
  root: 'torso',
  ground: [164, 472],
  parts: [
    { name: 'legL', parent: 'hips', z: 0, rect: [191, 0, 74, 133], pivot: [47, 14], origin: [140, 228], limits: { rot: [-55, 55] } },
    { name: 'legR', parent: 'hips', z: 0, rect: [267, 0, 64, 133], pivot: [28, 14], origin: [194, 228], limits: { rot: [-55, 55] } },
    { name: 'shinL', parent: 'legL', z: 1, rect: [0, 0, 99, 169], pivot: [65, 22], origin: [127, 325], limits: { rot: [-20, 140] } },
    { name: 'shinR', parent: 'legR', z: 1, rect: [101, 0, 88, 168], pivot: [29, 22], origin: [206, 325], limits: { rot: [-20, 140] } },
    { name: 'hips', parent: 'torso', z: 2, rect: [738, 0, 105, 48], pivot: [47, 14], origin: [168, 218] },
    { name: 'torso', parent: null, z: 3, rect: [333, 0, 142, 128], pivot: [72, 24], origin: [166, 128] },
    { name: 'armR', parent: 'torso', z: 4, rect: [676, 0, 60, 71], pivot: [40, 1], origin: [104, 124], limits: { rot: [-170, 170] } },
    { name: 'foreR', parent: 'armR', z: 5, rect: [542, 0, 63, 107], pivot: [34, 18], origin: [86, 176], limits: { rot: [-160, 20] } },
    { name: 'armL', parent: 'torso', z: 6, rect: [845, 0, 40, 45], pivot: [13, -25], origin: [226, 124], limits: { rot: [-170, 170] } },
    { name: 'foreL', parent: 'armL', z: 7, rect: [477, 0, 63, 110], pivot: [27, 18], origin: [241, 176], limits: { rot: [-160, 20] } },
    { name: 'head', parent: 'torso', z: 8, rect: [607, 0, 67, 103], pivot: [37, 99], origin: [164, 110] },
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
      strikePart: 'foreL', reach: 34, range: 181,
    }),
    heavy: move(RIG, {
      // The Slam lunges. His rear fist reaches 105 units measured, against a
      // standing separation of 118 -- which is simply what a rear hand on a
      // two-bone arm does once the hitbox is a fist rather than the whole
      // limb. A power shot off the back hand has to close that gap itself, so
      // this one steps in rather than reaching from where it stands.
      name: 'slam', label: 'Slam',
      startup: 11, active: 4, recovery: 19,
      damage: 104, knockback: 480, lift: -130, drive: 230,
      strikePart: 'foreR', reach: 48, range: 107,
    }),
    special: move(RIG, {
      name: 'pounce', label: 'Pounce',
      startup: 10, active: 7, recovery: 23,
      damage: 92, knockback: 540, lift: -90, drive: 520,
      strikePart: 'foreL', reach: 34, range: 195,
    }),
  },
};

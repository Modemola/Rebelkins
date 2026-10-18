/**
 * KIN 08 — yellow coat, white bob.
 *
 * Her sleeves sit clear of her body in the A-pose render, so both arms come
 * away as separate parts. She is the striker: fast jab, committal hook off the
 * rear arm, and a running elbow that crosses space.
 *
 * Her moves were hand-posed against an earlier illustration whose arms sat
 * quite differently. Those poses did not survive the new art: tuned against
 * the old geometry they barely moved the limb at all. They are generated from
 * the frame data now, which reads the swing off whichever drawing is actually
 * in the atlas.
 *
 * Nothing of hers strikes with the rear arm, and that is the drawing's doing.
 * She stands the widest-shouldered in the cast with the joint-shortest arms:
 * her rear shoulder sits 64 source pixels behind her centre line against 30 to
 * 60 for everyone else, and the arm hung on it is 141 long against 120 to 182.
 * Rotated to point at the opponent, her rear hand therefore arrives 77 source
 * pixels past her centre -- last in the cast, where the next worst is 85 and
 * the best 134. A hook thrown with it measured a range of 96 against a closing
 * distance of 84: it could only land inside a twelve-pixel window, which in
 * practice meant never. So the hook moved to the lead arm, which is one of the
 * longest leads in the cast, and the running elbow became what a running elbow
 * is anyway -- a charge driven by the body rather than a limb.
 */

import { phases, seg, easeOut, easeInOut } from './common.js';
import { move } from './kit.js';

const RIG = {
  root: 'torso',
  ground: [232, 479],
  parts: [
    { name: 'legL', parent: 'hips', z: 0, rect: [0, 0, 67, 183], pivot: [43, 14], origin: [190, 310], limits: { rot: [-55, 55] } },
    { name: 'legR', parent: 'hips', z: 0, rect: [69, 0, 73, 181], pivot: [29, 14], origin: [274, 310], limits: { rot: [-55, 55] } },
    { name: 'hips', parent: 'torso', z: 1, rect: [530, 0, 150, 94], pivot: [76, 16], origin: [236, 248] },
    { name: 'torso', parent: null, z: 2, rect: [144, 0, 181, 172], pivot: [89, 40], origin: [234, 120] },
    { name: 'armR', parent: 'torso', z: 3, rect: [327, 0, 104, 102], pivot: [84, 1], origin: [168, 126], limits: { rot: [-170, 170] } },
    { name: 'armL', parent: 'torso', z: 3, rect: [433, 0, 95, 95], pivot: [14, -3], origin: [300, 126], limits: { rot: [-170, 170] } },
    { name: 'head', parent: 'torso', z: 4, rect: [682, 0, 91, 83], pivot: [43, 79], origin: [238, 88] },
  ],
};

/** Measured, not guessed: how far each limb must turn to point at the opponent. */

export const KIN08 = {
  id: 'kin08',
  name: 'KIN 08',
  subtitle: 'striker',
  atlas: 'assets/atlas/kin08.png',
  rig: RIG,
  scale: 0.6485,
  health: 1000,
  walkSpeed: 170,
  backSpeed: 128,
  jumpVel: 660,
  bodyHeight: 470,
  hurtRadius: 50,

  stance: {
    idle(t) {
      const b = Math.sin(t * 2.0);
      const s = Math.sin(t * 0.9);
      return {
        torso: { rot: s * 0.015, y: b * 2.2 }, hips: { rot: -s * 0.012 },
        head: { rot: -s * 0.028 + Math.sin(t * 0.6) * 0.02 },
        armL: { rot: s * 0.05 + 0.02 }, armR: { rot: -s * 0.055 },
        legL: { rot: s * 0.01 }, legR: { rot: -s * 0.01 },
      };
    },
    walk(t, dir) {
      const p = t * 7.2;
      const lean = dir > 0 ? 0.05 : -0.03;
      return {
        torso: { rot: lean + Math.sin(p * 2) * 0.02, y: -Math.abs(Math.sin(p)) * 5 },
        hips: { rot: Math.sin(p) * 0.05 }, head: { rot: -lean - Math.sin(p * 2) * 0.03 },
        legL: { rot: Math.sin(p) * 0.42 }, legR: { rot: Math.sin(p + Math.PI) * 0.42 },
        armL: { rot: Math.sin(p + Math.PI) * 0.30 }, armR: { rot: Math.sin(p) * 0.34 },
      };
    },
    crouch() {
      return {
        torso: { rot: 0.12, y: 30 }, hips: { rot: -0.08, y: 4 }, head: { rot: 0.16 },
        armL: { rot: -0.35 }, armR: { rot: 0.30 },
        legL: { rot: 0.46 }, legR: { rot: -0.50 },
      };
    },
    air(vy) {
      const rise = Math.max(-1, Math.min(1, -vy / 600));
      return {
        torso: { rot: -0.06 * rise }, hips: { rot: 0.10 * rise },
        head: { rot: -0.10 * rise },
        armL: { rot: -0.55 * rise - 0.2 }, armR: { rot: 0.45 * rise + 0.2 },
        legL: { rot: -0.34 - 0.3 * rise }, legR: { rot: 0.42 + 0.2 * rise },
      };
    },
    block(t) {
      const j = Math.sin(t * 3.1) * 0.012;
      return {
        torso: { rot: 0.14 + j, y: 6 }, hips: { rot: -0.06 }, head: { rot: 0.15 },
        armL: { rot: -1.05 + j * 2 }, armR: { rot: 0.95 - j * 2 },
        legL: { rot: 0.14 }, legR: { rot: -0.16 },
      };
    },
    hurt(f) {
      const k = easeOut(seg(f, 0, 3)) - easeInOut(seg(f, 5, 16));
      const shiver = Math.sin(f * 1.6) * Math.max(0, 1 - f / 14) * 0.035;
      return {
        torso: { rot: 0.32 * k + shiver, x: 22 * k, y: -4 * k },
        hips: { rot: -0.14 * k }, head: { rot: 0.48 * k + shiver * 2 },
        armL: { rot: 0.55 * k }, armR: { rot: -0.70 * k },
        legL: { rot: 0.26 * k }, legR: { rot: -0.20 * k },
      };
    },
    ko(f) {
      const k = easeOut(seg(f, 0, 26));
      return {
        torso: { rot: 1.32 * k, x: 56 * k, y: 96 * k },
        hips: { rot: -0.30 * k }, head: { rot: 0.70 * k },
        armL: { rot: 1.0 * k }, armR: { rot: -0.9 * k },
        legL: { rot: -0.6 * k }, legR: { rot: 0.5 * k },
      };
    },
  },

  moves: {
    light: move(RIG, {
      name: 'jab', label: 'Jab',
      startup: 4, active: 3, recovery: 9,
      damage: 42, hitstun: 14, blockstun: 8,
      knockback: 210, lift: 0, drive: 150,
      strikePart: 'armL', reach: 46, range: 170,
    }),
    heavy: move(RIG, {
      name: 'teep', label: 'Teep',
      startup: 10, active: 4, recovery: 18,
      damage: 98, hitstun: 22, blockstun: 13,
      knockback: 460, lift: -120, drive: 90,
      strikePart: 'legR', reach: 55, range: 186,
    }),
    special: move(RIG, {
      name: 'runner', label: 'Runner',
      startup: 9, active: 7, recovery: 22,
      damage: 86, hitstun: 24, blockstun: 15,
      knockback: 540, lift: -80, drive: 560,
      strikePart: 'torso', reach: 56, range: 135,
    }),
  },
};

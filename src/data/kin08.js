/**
 * KIN 08 — yellow coat, white bob.
 *
 * Her sleeves sat clear of her body in the source illustration, so both arms
 * came away as separate parts. She is the striker: fast jab, committal hook,
 * and a running elbow that crosses space.
 */

import { phases, seg, easeOut, easeInOut, anticipate } from './common.js';
import { swingOf } from './kit.js';

const RIG = {
  root: 'torso',
  // the illustration faces screen-left, so the rig mirrors to face right
  art: -1,
  ground: [300, 542],
  parts: [
    { name: 'legL', parent: 'hips', z: 0, rect: [384, 0, 77, 132], pivot: [59, 12], origin: [252, 418] },
    { name: 'legR', parent: 'hips', z: 0, rect: [463, 0, 69, 129], pivot: [24, 12], origin: [314, 418] },
    { name: 'hips', parent: 'torso', z: 1, rect: [796, 0, 105, 76], pivot: [52, 14], origin: [306, 380] },
    { name: 'torso', parent: null, z: 2, rect: [0, 0, 220, 282], pivot: [114, 110], origin: [300, 250] },
    { name: 'armL', parent: 'torso', z: 3, rect: [534, 0, 175, 99], pivot: [157, 3], origin: [282, 206] },
    { name: 'armR', parent: 'torso', z: 3, rect: [711, 0, 83, 87], pivot: [-1, -3], origin: [344, 204] },
    { name: 'head', parent: 'torso', z: 4, rect: [222, 0, 160, 160], pivot: [76, 144], origin: [306, 178] },
  ],
};

/** Measured, not guessed: how far each limb must turn to point at the opponent. */
const SWING = { armL: swingOf(RIG, 'armL'), armR: swingOf(RIG, 'armR') };

export const KIN08 = {
  id: 'kin08',
  name: 'KIN 08',
  subtitle: 'striker',
  atlas: 'assets/atlas/kin08.png',
  rig: RIG,
  scale: 0.60,
  health: 1000,
  walkSpeed: 170,
  backSpeed: 128,
  jumpVel: 660,
  bodyHeight: 508,
  hurtRadius: 54,

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
    light: {
      name: 'jab', label: 'Jab',
      startup: 4, active: 3, recovery: 9,
      damage: 42, hitstun: 14, blockstun: 8,
      knockback: 210, lift: 0, drive: 150,
      strikePart: 'armL', reach: 50,
      pose(f, m) {
        const { wind, strike } = phases(f, m);
        return {
          torso: { rot: 0.05 * wind - 0.10 * strike, x: -12 * strike },
          hips: { rot: 0.04 * strike }, head: { rot: 0.06 * wind - 0.05 * strike },
          armL: { rot: 0.45 * wind - 1.25 * strike }, armR: { rot: -0.25 * wind + 0.35 * strike },
          legL: { rot: -0.10 * strike }, legR: { rot: 0.16 * strike },
        };
      },
    },
    heavy: {
      name: 'hook', label: 'Hook',
      startup: 10, active: 4, recovery: 18,
      damage: 98, hitstun: 22, blockstun: 13,
      knockback: 460, lift: -120, drive: 90,
      strikePart: 'armL', reach: 64,
      pose(f, m) {
        const { wind, strike } = phases(f, m);
        return {
          torso: { rot: 0.22 * anticipate(wind) - 0.52 * strike, x: -6 * strike, y: 3 * strike },
          hips: { rot: -0.10 * strike }, head: { rot: 0.12 * wind - 0.22 * strike },
          // Thrown with the lead arm. Her back arm is short, folded, and its
          // joint sits 26px behind her centre -- swung flat out it still falls
          // short of an opponent at the stage's own spacing.
          armL: { rot: -0.26 * SWING.armL * anticipate(wind) + SWING.armL * 1.05 * strike },
          armR: { rot: 0.3 * SWING.armR * wind - 0.4 * SWING.armR * strike },
          legL: { rot: -0.2 * strike }, legR: { rot: 0.26 * strike },
        };
      },
    },
    special: {
      name: 'runner', label: 'Runner',
      startup: 9, active: 7, recovery: 22,
      damage: 86, hitstun: 24, blockstun: 15,
      knockback: 540, lift: -80, drive: 560,
      strikePart: 'armL', reach: 60,
      pose(f, m) {
        const { wind, strike } = phases(f, m);
        return {
          torso: { rot: 0.30 * wind - 0.46 * strike, x: 10 * wind - 34 * strike, y: 6 * strike },
          hips: { rot: 0.12 * strike }, head: { rot: 0.24 * wind - 0.34 * strike },
          armL: { rot: 0.6 * wind - 1.5 * strike }, armR: { rot: -0.5 * wind + 0.9 * strike },
          legL: { rot: -0.5 * wind + 0.8 * strike }, legR: { rot: 0.4 * wind - 0.6 * strike },
        };
      },
    },
  },
};

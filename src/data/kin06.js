/**
 * KIN 06 — navy jacket, cyan spikes.
 *
 * His arms are folded across his chest in the source illustration and stay
 * welded to the torso, because separating them meant inventing two thirds of
 * his jacket and that came back a smear. So he fights with legs and body: a
 * kick, a stomp, and a shoulder charge. His guard is free -- those folded arms
 * already read as one.
 */

import { phases, seg, easeOut, easeInOut, anticipate } from './common.js';
import { swingOf } from './kit.js';

const RIG = {
  root: 'torso',
  ground: [300, 545],
  parts: [
    { name: 'legL', parent: 'hips', z: 0, rect: [389, 0, 105, 122], pivot: [71, 10], origin: [268, 434] },
    { name: 'legR', parent: 'hips', z: 0, rect: [496, 0, 96, 122], pivot: [22, 10], origin: [320, 434] },
    { name: 'hips', parent: 'torso', z: 1, rect: [594, 0, 104, 76], pivot: [50, 16], origin: [296, 386] },
    { name: 'torso', parent: null, z: 2, rect: [217, 0, 170, 182], pivot: [84, 62], origin: [304, 300] },
    { name: 'head', parent: 'torso', z: 4, rect: [0, 0, 215, 190], pivot: [127, 182], origin: [300, 240] },
  ],
};

/** Measured, not guessed: how far each limb must turn to point at the opponent. */
const SWING = { legL: swingOf(RIG, 'legL'), legR: swingOf(RIG, 'legR') };

export const KIN06 = {
  id: 'kin06',
  name: 'KIN 06',
  subtitle: 'bruiser',
  atlas: 'assets/atlas/kin06.png',
  rig: RIG,
  scale: 0.60,
  health: 1120,
  walkSpeed: 142,
  backSpeed: 108,
  jumpVel: 600,
  bodyHeight: 487,
  hurtRadius: 58,

  stance: {
    idle(t) {
      const b = Math.sin(t * 1.8);
      const s = Math.sin(t * 0.8);
      return {
        torso: { rot: s * 0.014, y: b * 2.6 }, hips: { rot: -s * 0.010 },
        head: { rot: -s * 0.030 + Math.sin(t * 0.5) * 0.022 },
        legL: { rot: s * 0.012 }, legR: { rot: -s * 0.012 },
      };
    },
    walk(t, dir) {
      const p = t * 6.4;
      const lean = dir > 0 ? 0.06 : -0.035;
      return {
        torso: { rot: lean + Math.sin(p * 2) * 0.022, y: -Math.abs(Math.sin(p)) * 6 },
        hips: { rot: Math.sin(p) * 0.055 }, head: { rot: -lean - Math.sin(p * 2) * 0.034 },
        legL: { rot: Math.sin(p) * 0.40 }, legR: { rot: Math.sin(p + Math.PI) * 0.40 },
      };
    },
    crouch() {
      return {
        torso: { rot: 0.14, y: 34 }, hips: { rot: -0.09, y: 4 }, head: { rot: 0.18 },
        legL: { rot: 0.48 }, legR: { rot: -0.52 },
      };
    },
    air(vy) {
      const rise = Math.max(-1, Math.min(1, -vy / 600));
      return {
        torso: { rot: -0.07 * rise }, hips: { rot: 0.11 * rise }, head: { rot: -0.11 * rise },
        legL: { rot: -0.38 - 0.3 * rise }, legR: { rot: 0.46 + 0.2 * rise },
      };
    },
    block(t) {
      // the folded arms are the guard; he just hunches behind them
      const j = Math.sin(t * 2.8) * 0.010;
      return {
        torso: { rot: 0.20 + j, y: 12 }, hips: { rot: -0.08 }, head: { rot: 0.20 },
        legL: { rot: 0.18 }, legR: { rot: -0.20 },
      };
    },
    hurt(f) {
      const k = easeOut(seg(f, 0, 3)) - easeInOut(seg(f, 5, 17));
      const shiver = Math.sin(f * 1.5) * Math.max(0, 1 - f / 15) * 0.03;
      return {
        torso: { rot: 0.28 * k + shiver, x: 18 * k, y: -3 * k },
        hips: { rot: -0.12 * k }, head: { rot: 0.42 * k + shiver * 2 },
        legL: { rot: 0.24 * k }, legR: { rot: -0.18 * k },
      };
    },
    ko(f) {
      const k = easeOut(seg(f, 0, 28));
      return {
        torso: { rot: 1.26 * k, x: 48 * k, y: 104 * k },
        hips: { rot: -0.26 * k }, head: { rot: 0.62 * k },
        legL: { rot: -0.56 * k }, legR: { rot: 0.46 * k },
      };
    },
  },

  moves: {
    light: {
      name: 'kick', label: 'Low Kick',
      startup: 6, active: 4, recovery: 11,
      damage: 54, hitstun: 15, blockstun: 9,
      knockback: 250, lift: 0, drive: 130,
      strikePart: 'legL', reach: 92,
      pose(f, m) {
        const { wind, strike } = phases(f, m);
        return {
          torso: { rot: -0.08 * wind + 0.16 * strike, x: -8 * strike },
          hips: { rot: 0.06 * wind - 0.22 * strike }, head: { rot: -0.10 * strike },
          legL: { rot: -0.22 * SWING.legL * wind + SWING.legL * strike },
          legR: { rot: 0.08 * wind - 0.10 * strike },
        };
      },
    },
    heavy: {
      name: 'stomp', label: 'Stomp',
      startup: 12, active: 4, recovery: 20,
      damage: 115, hitstun: 24, blockstun: 14,
      knockback: 300, lift: -260, drive: 40,
      strikePart: 'legR', reach: 66,
      pose(f, m) {
        const { wind, strike } = phases(f, m);
        return {
          torso: { rot: -0.06 * anticipate(wind) + 0.12 * strike, y: -16 * anticipate(wind) + 28 * strike },
          hips: { rot: 0.05 * strike }, head: { rot: -0.10 * wind + 0.18 * strike },
          legR: { rot: -0.60 * anticipate(wind) + 0.78 * strike }, legL: { rot: 0.12 * strike },
        };
      },
    },
    special: {
      name: 'charge', label: 'Charge',
      startup: 11, active: 8, recovery: 24,
      damage: 102, hitstun: 26, blockstun: 16,
      knockback: 620, lift: -140, drive: 640,
      strikePart: 'torso', reach: 64,
      pose(f, m) {
        const { wind, strike } = phases(f, m);
        return {
          torso: { rot: 0.16 * wind - 0.36 * strike, x: 14 * wind - 40 * strike, y: 5 * strike },
          hips: { rot: 0.10 * strike }, head: { rot: 0.24 * wind - 0.32 * strike },
          legL: { rot: -0.32 * wind + 0.58 * strike }, legR: { rot: 0.28 * wind - 0.42 * strike },
        };
      },
    },
  },
};

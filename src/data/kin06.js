/**
 * KIN 06 — navy jacket, cyan spikes.
 *
 * His arms were folded across his chest in the original illustration and
 * stayed welded to the torso, so he fought with legs and body: a kick, a
 * stomp and a shoulder charge. A new A-pose render gave him two arms that
 * separate, and he now leads with a jab and commits with a haymaker. The
 * charge is kept -- it was always the best thing he did.
 */

import { phases, seg, easeOut, easeInOut, anticipate, capStun } from './common.js';
import { swingOf, move } from './kit.js';

const RIG = {
  root: 'torso',
  ground: [159, 463],
  parts: [
    { name: 'legR', parent: 'hips', z: 0, rect: [0, 0, 83, 205], pivot: [19, 10], origin: [185, 269], limits: { rot: [-55, 55] } },
    { name: 'legL', parent: 'hips', z: 0, rect: [85, 0, 92, 204], pivot: [66, 10], origin: [141, 269], limits: { rot: [-55, 55] } },
    { name: 'hips', parent: 'torso', z: 1, rect: [593, 0, 93, 44], pivot: [37, 12], origin: [163, 257] },
    { name: 'torso', parent: null, z: 2, rect: [179, 0, 141, 122], pivot: [56, 30], origin: [159, 181] },
    { name: 'armR', parent: 'torso', z: 3, rect: [322, 0, 80, 119], pivot: [66, 11], origin: [117, 185], limits: { rot: [-170, 170] } },
    { name: 'armL', parent: 'torso', z: 3, rect: [534, 0, 57, 109], pivot: [22, -4], origin: [233, 185], limits: { rot: [-170, 170] } },
    { name: 'head', parent: 'torso', z: 4, rect: [404, 0, 128, 115], pivot: [66, 109], origin: [151, 151] },
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
  scale: 0.7221,
  health: 1120,
  walkSpeed: 142,
  backSpeed: 108,
  jumpVel: 600,
  bodyHeight: 421,
  hurtRadius: 50,

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
    light: move(RIG, {
      name: 'jab', label: 'Jab',
      startup: 5, active: 3, recovery: 10,
      damage: 50, hitstun: 15, blockstun: 9,
      knockback: 250, lift: 0, drive: 130,
      strikePart: 'armL', reach: 60, range: 198,
    }),
    heavy: move(RIG, {
      name: 'haymaker', label: 'Haymaker',
      startup: 12, active: 4, recovery: 20,
      damage: 115, hitstun: 24, blockstun: 14,
      knockback: 480, lift: -130, drive: 90,
      strikePart: 'armR', reach: 66, range: 127,
    }),
    special: capStun({
      name: 'charge', label: 'Charge',
      startup: 11, active: 8, recovery: 24,
      damage: 102, hitstun: 26, blockstun: 16,
      knockback: 620, lift: -140, drive: 640,
      strikePart: 'torso', reach: 55, range: 146,
      pose(f, m) {
        const { wind, strike } = phases(f, m);
        return {
          torso: { rot: 0.16 * wind - 0.36 * strike, x: 14 * wind - 40 * strike, y: 5 * strike },
          hips: { rot: 0.10 * strike }, head: { rot: 0.24 * wind - 0.32 * strike },
          legL: { rot: -0.32 * wind + 0.58 * strike }, legR: { rot: 0.28 * wind - 0.42 * strike },
        };
      },
    }),
  },
};

/**
 * Opponent AI.
 *
 * Not trying to be good -- trying to be a sparring partner that makes the
 * mechanics legible. It approaches, respects spacing, throws something when it
 * is in range, blocks sometimes, and backs off when hurt, so a player can see
 * blocking, whiffing and punishing actually happen.
 */

import { STATE } from './fighter.js';
import { totalFrames } from '../data/common.js';

const DIFFICULTY = {
  calm: { react: 26, aggression: 0.35, block: 0.45 },
  brisk: { react: 15, aggression: 0.6, block: 0.6 },
  mean: { react: 8, aggression: 0.8, block: 0.78 },
};

export class AI {
  constructor(level = 'brisk') {
    this.set(level);
    this.cool = 0;
    this.decision = null;
    this.holdGuard = 0;
  }

  set(level) { this.level = level; this.cfg = DIFFICULTY[level] || DIFFICULTY.brisk; }

  think(me, foe, frame) {
    const intent = { move: 0, crouch: false, jump: false, guard: false, attack: null };
    if (me.state === STATE.KO || me.state === STATE.HURT) return intent;

    const dx = foe.x - me.x;
    const dist = Math.abs(dx);
    const dir = Math.sign(dx) || 1;

    // block while the opponent's active frames are coming at us
    const incoming = foe.state === STATE.ATTACK
      && foe.moveFrame >= foe.move.startup - this.cfg.react
      && foe.moveFrame < totalFrames(foe.move)
      && dist < 230;
    if (incoming && Math.random() < this.cfg.block) this.holdGuard = 10;
    if (this.holdGuard > 0) { this.holdGuard--; intent.guard = true; return intent; }

    if (me.state === STATE.ATTACK) return intent;
    if (this.cool > 0) this.cool--;

    const reach = 150;
    if (dist > reach + 40) {
      intent.move = dir;                      // close the gap
    } else if (dist < 70) {
      intent.move = -dir;                     // too close, reset spacing
    } else if (this.cool <= 0 && Math.random() < this.cfg.aggression * 0.12) {
      const roll = Math.random();
      intent.attack = roll < 0.55 ? 'light' : roll < 0.85 ? 'heavy' : 'special';
      this.cool = 34 + Math.floor(Math.random() * 40);
    } else if (Math.random() < 0.02) {
      intent.move = Math.random() < 0.5 ? dir : -dir;
    }

    // back off and guard when badly hurt
    if (me.health < me.def.health * 0.25 && Math.random() < 0.03) {
      intent.move = -dir;
      intent.guard = true;
    }
    return intent;
  }
}

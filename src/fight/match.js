/**
 * The match: hit resolution, hitstop, rounds.
 *
 * Hitstop is the single biggest contributor to how a strike feels. On contact
 * both fighters freeze for a few frames while effects keep running, which is
 * what makes a hook read as heavy and a jab as quick. Without it everything
 * lands like a slap.
 */

import { TICK } from '../engine/loop.js';
import { Fighter, STATE, GROUND } from './fighter.js';

export const STAGE = { left: -760, right: 760, floor: GROUND };
const ROUND_SECONDS = 60;
const ROUNDS_TO_WIN = 2;
// Two 300px-tall figures at 76px apart read as one silhouette. Spacing is
// information in a fighter -- you have to be able to see the gap you are
// trying to close.
const MIN_GAP = 118;

export const PHASE = { INTRO: 'intro', FIGHT: 'fight', ROUND_END: 'roundEnd', MATCH_END: 'matchEnd' };

export class Match {
  constructor(defA, defB, rigs) {
    this.defs = [defA, defB];
    this.rigs = rigs;
    this.wins = [0, 0];
    this.round = 1;
    this.fx = null;
    this.onEvent = () => {};
    this.reset(PHASE.INTRO);
  }

  reset(phase = PHASE.INTRO) {
    this.a = new Fighter(this.defs[0], { x: -210, facing: 1, pad: 'p1' });
    this.b = new Fighter(this.defs[1], { x: 210, facing: -1, pad: 'p2' });
    this.fighters = [this.a, this.b];
    this.timer = ROUND_SECONDS;
    this.hitstop = 0;
    this.phase = phase;
    this.phaseFrames = 0;
    this.slowmo = 0;
  }

  get over() { return this.wins[0] >= ROUNDS_TO_WIN || this.wins[1] >= ROUNDS_TO_WIN; }

  step(frame, intents, solve) {
    this.phaseFrames++;

    if (this.phase === PHASE.INTRO) {
      if (this.phaseFrames > 72) { this.phase = PHASE.FIGHT; this.phaseFrames = 0; this.onEvent('fight'); }
      return;
    }

    if (this.phase === PHASE.ROUND_END) {
      // let the knockdown play out, then reset or finish
      for (const f of this.fighters) f.step(IDLE_INTENT, this.other(f));
      if (this.phaseFrames > 150) {
        if (this.over) { this.phase = PHASE.MATCH_END; this.phaseFrames = 0; }
        else { this.round++; this.reset(PHASE.INTRO); }
      }
      return;
    }

    if (this.phase === PHASE.MATCH_END) {
      for (const f of this.fighters) f.step(IDLE_INTENT, this.other(f));
      return;
    }

    // ---- hitstop freezes the simulation but not the effects
    if (this.hitstop > 0) { this.hitstop--; return; }

    this.timer = Math.max(0, this.timer - TICK);

    this.a.step(intents.a, this.b);
    this.b.step(intents.b, this.a);

    this.separate();
    this.bound();
    // Poses are solved AFTER the fighters move, so a hitbox rides the frame of
    // animation that is actually on screen rather than the one before it.
    this.resolveHits(solve());

    if (this.timer <= 0) this.endRound(this.a.health === this.b.health ? -1 : (this.a.health > this.b.health ? 0 : 1));
    else if (!this.a.alive) this.endRound(1);
    else if (!this.b.alive) this.endRound(0);
  }

  other(f) { return f === this.a ? this.b : this.a; }

  separate() {
    const d = this.b.x - this.a.x;
    const gap = Math.abs(d);
    if (gap >= MIN_GAP) return;
    const push = (MIN_GAP - gap) / 2 * Math.sign(d || 1);
    this.a.x -= push;
    this.b.x += push;
  }

  bound() {
    for (const f of this.fighters) {
      f.x = Math.max(STAGE.left, Math.min(STAGE.right, f.x));
    }
  }

  resolveHits(poses) {
    for (const [attacker, defender] of [[this.a, this.b], [this.b, this.a]]) {
      const rig = this.rigs[attacker.def.id];
      const box = attacker.hitbox(poses[attacker.def.id], rig);
      if (!box) continue;
      const hurt = defender.hurtbox();
      const nx = (box.x - hurt.x) / (hurt.rx + box.r);
      const ny = (box.y - hurt.y) / (hurt.ry + box.r);
      if (nx * nx + ny * ny > 1) continue;

      attacker.hitConnected = true;
      const m = box.move;
      const guarding = defender.state === STATE.BLOCK
        && Math.sign(attacker.x - defender.x) === defender.facing;

      const contact = { x: (box.x + hurt.x) / 2, y: (box.y + hurt.y) / 2 };

      if (guarding) {
        defender.blocked(m.blockstun, m.knockback);
        defender.health = Math.max(1, defender.health - m.damage * 0.12);
        this.hitstop = 5;
        this.onEvent('block', { contact, move: m, attacker, defender });
      } else {
        defender.hurt(m.damage, m.hitstun, m.knockback, m.lift);
        attacker.comboCount++;
        this.hitstop = Math.min(16, 6 + Math.round(m.damage / 12));
        if (!defender.alive) this.slowmo = 110;
        this.onEvent('hit', { contact, move: m, attacker, defender, ko: !defender.alive });
      }
    }
  }

  endRound(winner) {
    if (this.phase !== PHASE.FIGHT) return;
    if (winner >= 0) this.wins[winner]++;
    this.phase = PHASE.ROUND_END;
    this.phaseFrames = 0;
    this.onEvent('roundEnd', { winner });
  }
}

const IDLE_INTENT = { move: 0, crouch: false, jump: false, guard: false, attack: null };
export { IDLE_INTENT };

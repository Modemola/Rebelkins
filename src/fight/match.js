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

/**
 * How far apart they can get. Mutable, because it depends on the window: a
 * portrait phone cannot hold a 1520-unit arena and two readable fighters at the
 * same time, and zooming out far enough to show both at the extremes makes them
 * thumbnails. A narrow screen gets a narrower arena instead.
 */
export const STAGE = { left: -760, right: 760, floor: GROUND };

export function fitStage(view) {
  // 430 is read off the 16:9 case: 1.78 x 430 lands on the 760 this stage was
  // designed at, so a normal landscape window is unchanged. The 300 floor is
  // the narrowest arena that still gives ground to retreat to -- below it,
  // backing off stops being an option and the fight becomes a shoving match.
  const half = Math.max(300, Math.min(760, (view.w / Math.max(1, view.h)) * 430));
  STAGE.left = -half;
  STAGE.right = half;
  return half;
}
const ROUND_SECONDS = 60;
const ROUNDS_TO_WIN = 2;
// Two 300px-tall figures at 76px apart read as one silhouette. Spacing is
// information in a fighter -- you have to be able to see the gap you are
// trying to close.
const MIN_GAP = 118;
// ...but a swing has to be able to crowd in, or spacing becomes a wall. At
// this art scale a limb reaches 60-110px past its joint, so holding every
// fighter 118px apart means half the cast's moves can never touch anyone. An
// attacker may close to this instead, and is pushed back out on recovery.
const ATTACK_GAP = 84;

export const PHASE = { INTRO: 'intro', FIGHT: 'fight', ROUND_END: 'roundEnd', MATCH_END: 'matchEnd' };

export class Match {
  constructor(defA, defB, rigs, weapons = [null, null]) {
    this.defs = [defA, defB];
    this.weapons = weapons;
    this.rigs = rigs;
    this.wins = [0, 0];
    this.round = 1;
    this.fx = null;
    this.onEvent = () => {};
    this.reset(PHASE.INTRO);
  }

  reset(phase = PHASE.INTRO) {
    // Opening distance is a fraction of the arena, not a constant: 210 either
    // side was set against a 1280-wide window, and on a phone it opened the
    // round with the camera pulled right back.
    const apart = Math.min(210, STAGE.right * 0.52);
    this.a = new Fighter(this.defs[0], { x: -apart, facing: 1, pad: 'p1', weapon: this.weapons[0] });
    this.b = new Fighter(this.defs[1], { x: apart, facing: -1, pad: 'p2', weapon: this.weapons[1] });
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
    const swinging = this.a.state === STATE.ATTACK || this.b.state === STATE.ATTACK;
    const floor = swinging ? ATTACK_GAP : MIN_GAP;
    if (gap >= floor) return;
    const push = (floor - gap) / 2 * Math.sign(d || 1);
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

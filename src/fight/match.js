/**
 * The match: hit resolution, hitstop, rounds.
 *
 * Hitstop is the single biggest contributor to how a strike feels. On contact
 * both fighters freeze for a few frames while effects keep running, which is
 * what makes a hook read as heavy and a jab as quick. Without it everything
 * lands like a slap.
 */

import { TICK } from '../engine/loop.js';
import { Fighter, STATE, GROUND, RANK } from './fighter.js';

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
/**
 * How close the two of them may get, walking and swinging.
 *
 * Both numbers are derived from the bodies rather than chosen. Measured off
 * the rendered alpha of the torso, hips and head over idle, walk and guard:
 * KIN 06's mass reaches 64 units ahead of his root and KIN 09's 59, so their
 * chests meet at 123 and a mirror match of the wider one at 128. The old
 * attacking floor of 84 put them 44 units inside each other, which is why a
 * close exchange turned into one silhouette with sparks coming out of it --
 * you could not see what had connected.
 *
 * The attacking floor is the widest touch distance plus a little air, so the
 * strike lands in a gap you can see rather than inside the other fighter.
 * Nothing is lost by it: their strikes reach 192 and 195 units measured to
 * the tip, against a floor of 140, and all four pairings keep every move.
 *
 * The walking floor sits above it so closing the distance still costs
 * something, and close to where the opponent AI already chooses to stand, so
 * it rarely binds and the spacing stays the AI's decision rather than the
 * physics'.
 *
 * One floor cannot serve every move, though, and trying it broke all six
 * chains. The six moves reach 106, 132, 149, 170, 232 and 232. A floor of 140
 * is further than KIN 09's Lash can reach, so her heavy could never connect
 * again -- and a move that cannot touch anyone is worse than one that lands
 * too close. So an attacker may close to what its own move needs, no further
 * than ATTACK_GAP and never inside CLINCH_GAP:
 *
 *   both kicks, the Jab, the Point   stop at 128, where the chests just meet
 *   the Cross                        112
 *   the Lash                          96, a body hook thrown from inside
 *
 * Both are set for a cast of two side-on characters of almost the same build.
 * The ten front-facing ones are narrower and were the reason this used to be
 * a compromise; if they come back, measure again rather than assuming these
 * carry over.
 */
const MIN_GAP = 150;
const ATTACK_GAP = 128;
/** No move closes past this, however short its reach. */
const CLINCH_GAP = 96;
/**
 * How far inside its own measured range a move must arrive.
 *
 * `range` is the furthest gap a move still connects from, so stopping an
 * attacker exactly there leaves it nothing: the playtest asks every move to
 * connect with twelve units of reach to spare, and at a margin of 8 the Cross
 * stopped at 124 against a range of 132 and failed that by four.
 */
const RANGE_MARGIN = 20;

/**
 * What each successive hit of a chain is worth.
 *
 * Unscaled, light into heavy into special is 242 damage on a 980-health
 * fighter -- a quarter of the bar for one confirm, which turns the game into
 * whoever lands first. Scaling it to 188 keeps the chain worth doing and
 * keeps a round longer than two openings. The first hit is always full price,
 * so a single clean heavy is never worse for having been one.
 */
const COMBO_SCALE = [1, 0.8, 0.65];

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
    let floor = MIN_GAP;
    for (const f of this.fighters) {
      if (f.state !== STATE.ATTACK || !f.move) continue;
      const needs = Math.max(CLINCH_GAP, Math.min(ATTACK_GAP, f.move.range - RANGE_MARGIN));
      floor = Math.min(floor, needs);
    }
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
      const box = attacker.hitbox(poses[attacker.pad], rig);
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

      // Read before the counter goes up, so the opening hit is full price.
      const scale = COMBO_SCALE[Math.min(COMBO_SCALE.length - 1, attacker.comboCount)];
      const dealt = Math.round(m.damage * scale);

      if (guarding) {
        defender.blocked(m.blockstun, m.knockback, dealt);
        defender.health = Math.max(1, defender.health - dealt * 0.12);
        this.hitstop = 5;
        if (defender.guard <= 0) {
          defender.breakGuard();
          this.hitstop = 12;
          this.onEvent('guardBreak', { contact, move: m, attacker, defender, damage: dealt });
        } else {
          this.onEvent('block', { contact, move: m, attacker, defender, damage: dealt });
        }
      } else {
        // Read before the hit lands: hurt() clears their move, so anything
        // asked about what they were doing afterwards gets a null and a
        // counter-hit looks like an ordinary one.
        const counter = defender.state === STATE.ATTACK && defender.move
          ? (defender.moveFrame >= defender.move.startup + defender.move.active
            ? 'recovery' : 'startup')
          : null;
        // Pushback is cut on anything that can still be chained. KIN 09's
        // Point sends them 200 units back and her Lash only reaches 106, so
        // at full knockback her light-into-heavy was a chain that existed on
        // paper and dropped every time it was tried. The special keeps its
        // full knockback, so a chain still ends with someone sent across the
        // floor -- and a special thrown on its own is unchanged.
        const chainable = RANK[attacker.moveSlot] < RANK.special;
        defender.hurt(dealt, m.hitstun, chainable ? m.knockback * 0.45 : m.knockback, m.lift);
        attacker.comboCount++;
        this.hitstop = Math.min(16, 6 + Math.round(m.damage / 12));
        if (!defender.alive) this.slowmo = 110;
        // `damage` is what was actually taken and `move.damage` is what the
        // move is worth; the floating number has to be the first or a scaled
        // hit in a chain lies about itself.
        this.onEvent('hit', { contact, move: m, attacker, defender, counter,
          damage: dealt, combo: attacker.comboCount, ko: !defender.alive });
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

const IDLE_INTENT = { move: 0, dash: 0, crouch: false, jump: false, guard: false, attack: null };
export { IDLE_INTENT };

/**
 * One fighter: state machine, movement, and the frame data that drives both.
 *
 * Everything is counted in frames rather than seconds. A move owns the
 * character for startup + active + recovery, and a whiffed one owns it to the
 * last frame -- that is what makes a heavy a commitment instead of a button.
 *
 * A move that CONNECTS is different. It can be cancelled into a heavier one,
 * which is the chain every fighting game is built on and the reason pressing
 * buttons in order is worth anything. Without it each swing is an isolated
 * event: throw, wait out the recovery, throw again. There are no combos, no
 * blockstrings and no pressure, and the game reads as a toy to anyone who has
 * played the real thing.
 *
 * The rules are the standard magic series, and each one is load-bearing:
 *
 *   - Only upward. light -> heavy -> special, never sideways or back, so the
 *     longest chain is three and loops are impossible by construction.
 *   - Only once it has connected. `hitConnected` covers a block as well as a
 *     hit, so a blocked light still buys the pressure -- that is a
 *     blockstring, and it is why holding guard has to cost something.
 *   - Only from the active frames on. Cancelling during startup would let a
 *     player skip the wind-up that makes a heavy readable.
 */

import { TICK } from '../engine/loop.js';
import { applyWeapon } from '../data/weapons.js';
import { totalFrames } from '../data/common.js';

export const GRAVITY = 2000;
export const GROUND = 0;

export const STATE = {
  IDLE: 'idle', WALK: 'walk', CROUCH: 'crouch', AIR: 'air',
  ATTACK: 'attack', BLOCK: 'block', HURT: 'hurt', KO: 'ko',
};

/** The chain. A move cancels only into a strictly higher rank. */
export const RANK = { light: 0, heavy: 1, special: 2 };

export class Fighter {
  constructor(def, { x, facing, pad, weapon = null }) {
    this.def = def;
    this.pad = pad;
    /** What they are carrying. Null is bare hands, which is a valid weapon. */
    this.weapon = weapon;
    this.x = x;
    this.y = GROUND;
    this.vx = 0;
    this.vy = 0;
    this.facing = facing;
    this.health = def.health;
    this.state = STATE.IDLE;
    this.stateFrame = 0;
    this.move = null;
    this.moveFrame = 0;
    this.hitConnected = false;
    this.clock = 0;          // free-running, for idle breathing
    this.walkDir = 0;
    this.comboCount = 0;
    /**
     * Guard, 0..1. A block here reduces a hit to chip and chip is clamped so
     * it can never finish a round -- which, measured over 180 rounds of AI
     * against AI, made a fighter that simply holds guard almost unbeatable:
     * it wins on the clock on health it never lost. The meter is what costs
     * something. It drains while the guard is up and drops hard on each
     * blocked hit; empty, the guard breaks and they are wide open.
     */
    this.guard = 1;
    this.guardBroken = 0;
    this.lastHitFrame = -999;
    /** Drained by the host each frame. The simulation decides what is audible. */
    this.sounds = [];
    this.stepAccum = 0;
    this.wasAirborne = false;
  }

  get grounded() { return this.y >= GROUND - 0.001 && this.state !== STATE.AIR; }
  get busy() {
    return this.state === STATE.ATTACK || this.state === STATE.HURT || this.state === STATE.KO;
  }
  get alive() { return this.health > 0; }

  setState(s) {
    if (this.state === s) return;
    this.state = s;
    this.stateFrame = 0;
  }

  /**
   * Can what is on screen right now be cancelled into `key`?
   *
   * Startup is excluded on purpose, and not only for readability: a move
   * cannot have connected during its own startup anyway, so the frame test is
   * really about the recovery -- a chain continues out of the tail of the
   * move that landed, which is where the window lives in every game that has
   * one.
   */
  canCancelInto(key) {
    if (this.state !== STATE.ATTACK || !this.move) return false;
    if (!this.hitConnected) return false;
    if (this.moveFrame < this.move.startup) return false;
    const from = RANK[this.moveSlot];
    const to = RANK[key];
    return from !== undefined && to !== undefined && to > from;
  }

  startMove(key) {
    const base = this.def.moves[key];
    if (!base) return false;
    // Mid-move, this is a cancel and has to earn it. Otherwise a fighter
    // already swinging cannot start anything.
    if (this.state === STATE.ATTACK && !this.canCancelInto(key)) return false;
    // The weapon rewrites the numbers, not the animation: reach, damage,
    // knockback and startup, and only on the moves that strike with the limb
    // it is held in.
    const m = applyWeapon(this.weapon, base, this.def);
    // A cancel keeps the combo count -- that is what the damage scaling in
    // resolveHits reads -- and a fresh swing starts one.
    if (this.state !== STATE.ATTACK) this.comboCount = 0;
    this.move = m;
    this.moveSlot = key;
    this.moveFrame = 0;
    this.hitConnected = false;
    this.setState(STATE.ATTACK);
    // the swing is audible before it is dangerous, which is what lets a player
    // react to a heavy they cannot yet see landing
    this.sounds.push({ t: 'whiff', weight: Math.min(1, m.damage / 120) });
    return true;
  }

  hurt(damage, hitstun, knockback, lift) {
    this.health = Math.max(0, this.health - damage);
    this.vx = -this.facing * knockback;
    if (lift) { this.vy = lift; this.y = Math.min(this.y, GROUND - 0.01); }
    this.move = null;
    if (!this.alive) {
      this.setState(STATE.KO);
      this.vx = -this.facing * (knockback * 0.9 + 180);
      this.vy = -420;
    } else {
      this.setState(STATE.HURT);
      this.hurtFrames = hitstun;
    }
  }

  blocked(blockstun, knockback, damage = 0) {
    this.vx = -this.facing * knockback * 0.35;
    this.blockFrames = blockstun;
    this.setState(STATE.BLOCK);
    // A heavy costs far more guard than a jab, so chipping someone open with
    // light pokes takes a while and one committed swing hurts to hold.
    //
    // These numbers were an order of magnitude too harsh. At 0.06 + dmg/620 a
    // blocked jab cost 0.13 of the meter, so eight of them broke any guard in
    // under two seconds -- and a break is a free heavy. Measured, that made
    // sustained pressure unanswerable: an opponent walking forward mashing
    // its fastest button beat every policy tried against it, including a
    // hand-written guard-and-punish one, in 78 of 90 rounds. Defence has to
    // survive a string for the frame advantage a block earns to mean
    // anything.
    this.guard = Math.max(0, this.guard - 0.018 - damage / 1500);
  }

  /**
   * Empty guard: a long, damage-free opening. Being punished is the cost --
   * so they are left standing where they are. An early version shoved them
   * ninety units away on the break, and the opening was unusable: the AI that
   * earned it swung at the space they had just left, and its whiff rate
   * tracked its guard breaks almost one for one.
   */
  breakGuard() {
    this.guard = 0;
    this.guardBroken = 1;
    this.vx = -this.facing * 12;
    this.blockFrames = 0;
    this.setState(STATE.HURT);
    this.hurtFrames = 46;
  }

  /**
   * @param intent { move: -1|0|1, crouch, jump, guard, attack: 'light'|'heavy'|'special'|null }
   */
  step(intent, opponent) {
    this.clock += TICK;
    this.stateFrame++;

    // Holding guard bleeds it; letting go recovers it, slowly enough that
    // turtling through a whole round is not a strategy.
    // The hold drain, not the blocked hits, is what makes turtling a losing
    // plan: at 0.002 a frame a guard held and nothing else empties in about
    // eight seconds, so a fighter that only blocks is opened seven times in a
    // round, while one that blocks a string and answers it keeps its meter.
    if (this.state === STATE.BLOCK) this.guard = Math.max(0, this.guard - 0.002);
    else if (this.state !== STATE.HURT) this.guard = Math.min(1, this.guard + 0.005);
    if (this.guardBroken > 0) this.guardBroken = Math.max(0, this.guardBroken - 0.02);

    // face the opponent whenever not committed to something
    if (!this.busy && this.state !== STATE.BLOCK) {
      this.facing = opponent.x >= this.x ? 1 : -1;
    }

    switch (this.state) {
      case STATE.KO:
        this.physics();
        return;

      case STATE.HURT:
        if (--this.hurtFrames <= 0 && this.grounded) {
          this.setState(STATE.IDLE);
          // Surviving a break gives the guard back. Without this the meter
          // stayed at zero: regen is skipped while blocking, so a fighter who
          // kept their guard up was broken again by the very next blocked
          // hit, and again by the one after that -- measured, twenty breaks
          // in a single round. The break is the punishment, not the start of
          // a permanent one.
          if (this.guardBroken > 0) { this.guard = 1; this.guardBroken = 0; }
        }
        this.physics(0.86);
        return;

      case STATE.BLOCK:
        // Blockstun locks you in place; once it has run out a block is just a
        // stance being held, and coming out of it has to be as immediate as
        // taking it. Returning unconditionally here threw the attack intent
        // away: you could not swing out of a guard at all. For the AI that
        // meant the recovery window it had just earned by blocking was
        // unreachable, and for the player it meant the attack button did
        // nothing until they let go of guard first.
        if (this.blockFrames > 0) { this.blockFrames--; this.physics(0.80); return; }
        if (intent.guard && !intent.attack) { this.physics(0.80); return; }
        this.setState(STATE.IDLE);
        break;

      case STATE.ATTACK: {
        // The cancel is read before the frame advances, so a press buffered
        // on the frame the hit landed comes out on the next one rather than
        // a frame late.
        if (intent.attack && this.canCancelInto(intent.attack)
          && this.startMove(intent.attack)) {
          this.physics(this.grounded ? 0.82 : 0.995);
          return;
        }
        this.moveFrame++;
        const m = this.move;
        const total = totalFrames(m);
        /**
         * Drive carries the character forward, starting in the last third of
         * the wind-up rather than on the frame the hitbox appears.
         *
         * A move that only travels once it is already active arrives too late
         * to help itself: KIN 01's rear hook put its fist out 34 to 53 units
         * short, then closed the gap over the recovery, by which point there
         * was no hitbox left. A lunge is a step and then a punch, so the step
         * has to start first. It also reads better -- a committed move that
         * visibly crosses ground before it lands.
         */
        const driveFrom = m.startup - Math.ceil(m.startup / 3);
        if (m.drive && this.moveFrame >= driveFrom && this.moveFrame < m.startup + m.active) {
          this.vx = this.facing * m.drive;
        }
        this.physics(this.grounded ? 0.82 : 0.995);
        if (this.moveFrame >= total) {
          this.move = null;
          this.comboCount = 0;        // the chain ended with this move
          this.setState(STATE.IDLE);
        }
        return;
      }

      case STATE.AIR:
        this.physics(0.999);
        if (this.y >= GROUND) {
          this.y = GROUND;
          this.vy = 0;
          this.setState(STATE.IDLE);
        } else if (intent.attack) {
          this.startMove(intent.attack);
        }
        return;

      default: break;
    }

    // ---- grounded and free
    if (intent.attack && this.startMove(intent.attack)) return;

    if (intent.guard) { this.setState(STATE.BLOCK); this.blockFrames = 0; this.physics(0.7); return; }

    if (intent.jump) {
      this.vy = -this.def.jumpVel;
      this.y -= 0.01;
      this.setState(STATE.AIR);
      this.sounds.push({ t: 'jump' });
      this.physics(1);
      return;
    }

    if (intent.crouch) { this.setState(STATE.CROUCH); this.vx = 0; this.physics(0.5); return; }

    if (intent.move) {
      const toward = Math.sign(intent.move) === this.facing;
      this.vx = intent.move * (toward ? this.def.walkSpeed : this.def.backSpeed);
      this.walkDir = toward ? 1 : -1;
      this.setState(STATE.WALK);
      // Footsteps keyed to distance covered, not to the animation clock: both
      // characters walk at different speeds and the step has to land with the foot.
      this.stepAccum += Math.abs(this.vx) * TICK;
      if (this.stepAccum > 58) { this.stepAccum = 0; this.sounds.push({ t: 'step' }); }
    } else {
      this.vx = 0;
      this.setState(STATE.IDLE);
    }
    this.physics(0.8);
  }

  physics(friction = 1) {
    if (this.y < GROUND || this.vy !== 0) {
      this.wasAirborne = true;
      this.vy += GRAVITY * TICK;
      this.y += this.vy * TICK;
      if (this.y >= GROUND) {
        this.y = GROUND;
        this.vy = 0;
        if (this.wasAirborne) { this.wasAirborne = false; this.sounds.push({ t: 'land' }); }
        if (this.state === STATE.AIR) this.setState(STATE.IDLE);
      }
    }
    this.x += this.vx * TICK;
    this.vx *= friction;
    if (Math.abs(this.vx) < 2) this.vx = 0;
  }

  /** The active hitbox this frame, or null. */
  hitbox(M, rig) {
    if (this.state !== STATE.ATTACK || !this.move || this.hitConnected) return null;
    const m = this.move;
    if (this.moveFrame < m.startup || this.moveFrame >= m.startup + m.active) return null;
    const p = rig.strikePoint(M, m.strikePart, this.facing, m.lead);
    if (!p) return null;
    return { x: p.x, y: p.y, r: m.reach * this.def.scale, move: m };
  }

  /**
   * The body, as an upright ellipse. A circle at one radius cannot cover a
   * figure three times taller than it is wide: the first version sat at the
   * ankles while every hitbox arrived at chest height, so nothing ever
   * connected.
   *
   * `x: this.x` puts the ellipse on the root pivot, which is an assumption
   * about the artwork and not a fact about it -- nothing makes a drawing sit
   * centred over the point its rig hangs from. So it was measured: the figure
   * rendered through the same Rig.draw the game uses, over idle, walk and
   * guard, and the alpha weighed inside the ellipse's own vertical band. The
   * body's centre of mass lands within 12px of the root for all twelve (3px
   * in front to 12px behind) against radii of 32 to 49px, so the assumption
   * holds with room to spare and there is nothing to fix here.
   *
   * The extreme is KIN 09 side-on, 12px behind of a 33px radius, and the
   * camera is why: a bladed stance puts the lead foot forward of the torso,
   * so the mass sits behind a root placed at the feet. One character carries
   * that, though: the other side-on one sits at 7px, which is mid-pack among
   * the front-facing ten, and one of those reaches 8px. So this is a
   * mechanism to watch rather than a trend already in the numbers -- worth
   * re-measuring with tools/hurtfit.mjs as the side-view pass lands rather
   * than assumed to keep holding.
   *
   * No check guards it, deliberately. Reading the alpha needs a canvas, and
   * the cheap stand-in -- an area-weighted centroid of the part rects, which
   * runs in Node -- disagrees with the pixels by up to 7px. Against a signal
   * whose largest value is 12px that instrument cannot carry a threshold,
   * and inventing one anyway is how a check ends up measuring its own error.
   *
   * One scanline is not a body, either. Read at chest height alone these same
   * figures look wildly off-centre: KIN 09 shows 52px of ink behind the root
   * against 15px in front, because at that height her arms are tucked. Over
   * the whole band she is 79 behind and 91 in front.
   */
  hurtbox() {
    const h = this.def.bodyHeight * this.def.scale;
    const crouched = this.state === STATE.CROUCH ? 0.62 : 1;
    const top = this.y - h * crouched;
    return {
      x: this.x,
      y: top + h * crouched * 0.52,
      rx: this.def.hurtRadius * this.def.scale,
      ry: h * crouched * 0.46,
    };
  }

  /** The pose to draw this frame. */
  pose() {
    const s = this.def.stance;
    switch (this.state) {
      case STATE.ATTACK: return this.move.pose(this.moveFrame, this.move);
      case STATE.HURT: return s.hurt(this.stateFrame);
      case STATE.KO: return s.ko(this.stateFrame);
      case STATE.BLOCK: return s.block(this.clock);
      case STATE.CROUCH: return s.crouch();
      case STATE.AIR: return s.air(this.vy);
      case STATE.WALK: return s.walk(this.clock, this.walkDir);
      default: return s.idle(this.clock);
    }
  }
}

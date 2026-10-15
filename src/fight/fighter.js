/**
 * One fighter: state machine, movement, and the frame data that drives both.
 *
 * Everything is counted in frames rather than seconds. A move owns the
 * character for startup + active + recovery and cannot be cancelled, which is
 * what makes a heavy feel like a commitment instead of a button.
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

  startMove(key) {
    const base = this.def.moves[key];
    if (!base) return false;
    // The weapon rewrites the numbers, not the animation: reach, damage,
    // knockback and startup, and only on the moves that strike with the limb
    // it is held in.
    const m = applyWeapon(this.weapon, base, this.def);
    this.move = m;
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
        this.moveFrame++;
        const m = this.move;
        const total = totalFrames(m);
        // drive carries the character forward through the active window
        if (m.drive && this.moveFrame >= m.startup && this.moveFrame < m.startup + m.active) {
          this.vx = this.facing * m.drive;
        }
        this.physics(this.grounded ? 0.82 : 0.995);
        if (this.moveFrame >= total) {
          this.move = null;
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

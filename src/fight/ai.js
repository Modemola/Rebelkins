/**
 * Opponent AI.
 *
 * The first version was a sparring partner: approach, respect spacing, throw
 * something when in range, block sometimes. Put against itself for 180 rounds
 * it turned out to guard 92% of every swing thrown at it, land 2.3%, and
 * never once punish a recovery -- two fighters blocking everything and
 * deciding rounds on the clock. The cause was a probability rolled every
 * frame of a ten-frame window: 0.6 per frame compounds to a near certainty
 * over the window, so "blocks 60% of the time" meant "blocks".
 *
 * This one decides once per attack, knows how far its own moves actually
 * reach, and watches for the frames when the other fighter cannot defend
 * itself. `tools/spar.mjs` is what any claim about it has to survive.
 */

import { STATE } from './fighter.js';
import { totalFrames } from '../data/common.js';
import { leadingCorner } from '../render/rig.js';
import { applyWeapon } from '../data/weapons.js';

const DIFFICULTY = {
  // sight:  how far out a swing is noticed, in frames before it would land.
  //         Bigger is sharper -- this was called `react` and read as a delay,
  //         so the hardest tier was given the smallest number and ended up
  //         the one that spotted heavies last. It cost `mean` its place in
  //         the ladder: of the five dials it was the only one that made the
  //         AI worse, 46.7% against an otherwise identical opponent.
  // block:  chance of guarding a given attack -- per attack now, not per frame.
  // punish: chance of taking a recovery window that has been spotted.
  // poise:  how strictly it holds the spacing its own reach wants.
  // calm needed easing once every character gained a jab, because punishing
  // got much stronger across the board. Against an opponent that walks in
  // mashing, the old dials won 84% of rounds -- too good for the tier a player
  // picks before they have learned to block.
  //
  // `punish` alone is no way to do it: it sits on a cliff here, 0.25 winning
  // 84% and 0.12 winning 28% with almost nothing between. Easing `sight` as
  // well, so it spots swings late, lands at 62% and holds its shape, leaving a
  // masher winning around two rounds in five.
  //
  // Worth recording that the gap to the harder tiers widened to about 97%
  // whichever dials are used, the old ones included. That is the jab, not the
  // tuning: a tier that punishes well now beats one that does not, decisively.
  // chain:  chance of continuing a connected move into the next rank up.
  //         A tier that never chains cannot convert the openings it earns,
  //         and a player who learns to combo would be fighting an opponent
  //         playing a different game. It is the clearest single difference
  //         between the tiers to watch, which is why calm barely does it.
  // Eased again when the roster was cut to the two side-view characters.
  // The dials were set against a cast of twelve, most of which could barely
  // throw a punch; the two that remain are the best-armed in it and have
  // chains, so the same numbers beat a masher in 78 of 90 rounds. Measured
  // back down to 49 of 90 -- a masher winning a little under half, which is
  // what the easiest tier is for.
  calm: { sight: 4, aggression: 0.42, block: 0.32, punish: 0.10, poise: 0.35, chain: 0.15 },
  // Eased with calm, and for the same reason. Against a cast of two side-on
  // characters with chains, brisk sat so close to mean that the ladder
  // stopped being one: mean beat it in 51, 54 and 54 per cent of rounds
  // across three seeds, which is a coin flip dressed as a difficulty. These
  // dials put mean over brisk at 80% and brisk over calm at 97%.
  //
  // `sight` stayed at 13 after a detour: easing it to 8 along with everything
  // else took the share of swings that touch anything from 85% to 78%, which
  // is a tier that mostly swings at air. Of the five dials it is the one that
  // decides whether a swing was worth throwing, so it is the one to leave
  // alone when making a tier worse at winning.
  brisk: { sight: 13, aggression: 0.55, block: 0.50, punish: 0.28, poise: 0.72, chain: 0.30 },
  mean: { sight: 24, aggression: 0.9, block: 0.93, punish: 0.9, poise: 0.95, chain: 0.92 },
  // An opponent that does nothing, for measuring against. Zeroing the dials by
  // hand no longer produces one: a punish, an interrupt and a stun conversion
  // are deliberately not gated by `aggression`, so the playtest's old trick of
  // setting aggression and block to zero left an AI that still swung back and
  // quietly broke the measurement it was holding still for.
  still: { sight: 0, aggression: 0, block: 0, punish: 0, poise: 0 },
};

/**
 * How far a move threatens, in world units.
 *
 * `range` on the move is the real thing, binary-searched in the simulation by
 * tools/ranges.mjs. The fallback below -- hitbox radius plus how far the limb's
 * artwork extends -- is what this used before measuring, and it runs about
 * 1.39x short and anywhere from 1.08x to 1.66x depending on the character,
 * because how much of a limb points at the opponent depends on the pose it was
 * drawn in. An AI spaced on that estimate stands where it cannot hit.
 *
 * A weapon extends the hitbox radius, so it extends the range with it.
 */
function rangeOf(def, weapon, slot) {
  const move = applyWeapon(weapon, def.moves[slot], def);
  if (move.range) return move.range + (weapon ? weapon.reach : 0) * def.scale;
  const part = def.rig.parts.find((p) => p.name === move.strikePart);
  const limb = part ? Math.hypot(...leadingCorner(part)) * 0.88 : 0;
  return (move.reach + limb) * def.scale * 1.39;
}

/**
 * How far a move reaches against someone who is allowed to move.
 *
 * `range` is measured against a pinned defender, so it is the distance a move
 * covers if nobody retreats. They can retreat, at a known speed, for exactly
 * as long as the startup lasts -- so that distance comes off, and a little
 * more for the frame the decision was made on. Throwing at the measured range
 * instead had this whiffing 56% of its swings.
 */
function reachNow(move, foe) {
  return move.range - (foe.def.backSpeed * move.startup) / 60 - 12;
}

/** Cached per fighter: the ranges only change when the loadout does. */
function profile(f) {
  if (f._aiProfile && f._aiProfile.weapon === f.weapon) return f._aiProfile;
  // From the character, not a literal: a move the profile cannot see is a
  // move the AI will never throw, and the low sweep was invisible to it.
  const slots = Object.keys(f.def.moves);
  const moves = slots
    .filter((s) => f.def.moves[s])
    .map((s) => {
      const m = applyWeapon(f.weapon, f.def.moves[s], f.def);
      return { slot: s, range: rangeOf(f.def, f.weapon, s), startup: m.startup,
        total: totalFrames(m), damage: m.damage, low: !!m.low };
    })
    .sort((x, y) => x.range - y.range);
  const p = { weapon: f.weapon, moves, longest: moves[moves.length - 1], fastest: moves.slice().sort((x, y) => x.startup - y.startup)[0] };
  f._aiProfile = p;
  return p;
}

export class AI {
  constructor(level = 'brisk') {
    this.set(level);
    this.cool = 0;
    this.holdGuard = 0;
    this.seenAttack = null;   // identity of the foe swing currently being judged
    this.blocking = false;    // the decision taken about that swing
    this.drift = 0;           // slow spacing wander, so it is not a metronome
  }

  set(level) { this.level = level; this.cfg = DIFFICULTY[level] || DIFFICULTY.brisk; }

  /**
   * Guard high or crouch, when something is already coming.
   *
   * A guess, not a lookup, and `block` is how often it guesses right -- the
   * same dial that decides whether it guards at all, used for the same kind
   * of question. A tier that always read the low would make the sweep
   * pointless and one that never did would make it unanswerable; the mix-up
   * only exists in the space between.
   *
   * Held for the length of the swing rather than rerolled every frame, or it
   * would land on the right height at some point during every attack.
   */
  guardLow(foe) {
    if (foe.state !== STATE.ATTACK || !foe.move) return false;
    const swing = foe.move.name;
    if (swing !== this._heightFor) {
      this._heightFor = swing;
      this._crouching = foe.move.low
        ? Math.random() < this.cfg.block
        : Math.random() > this.cfg.block;
    }
    return this._crouching;
  }

  think(me, foe, frame) {
    const intent = { move: 0, dash: 0, crouch: false, jump: false, guard: false, attack: null };
    if (this.level === 'still') return intent;

    // Bookkeeping first, because every branch below can return early and this
    // has to tick on every frame regardless. It used to sit further down, and
    // the chain branch added underneath it stopped the poke cooldown counting
    // down for the whole of any move that had connected -- so the AI came out
    // of a combo still on cooldown and stood there. Measured against a fixture
    // that hands out free recovery windows, it took 37% of them instead of
    // 67%, which is most of an AI.
    if (this.cool > 0) this.cool--;

    if (me.state === STATE.KO || me.state === STATE.HURT) { this.holdGuard = 0; return intent; }

    /* ---- the chain, before anything else: a move that has connected is a
       decision about what comes next, and nothing else in here applies while
       one is on screen. Blocked counts as connected, which is what turns a
       blocked light into pressure instead of a wasted swing. */
    if (me.state === STATE.ATTACK && me.hitConnected) {
      const up = me.moveSlot === 'light' ? 'heavy' : me.moveSlot === 'heavy' ? 'special' : null;
      if (up && me.def.moves[up] && me.canCancelInto(up)
        && Math.random() < (this.cfg.chain ?? 0)) {
        intent.attack = up;
        me._aiReason = 'chain';
      }
      return intent;
    }

    const dx = foe.x - me.x;
    const dist = Math.abs(dx);
    const dir = Math.sign(dx) || 1;
    const mine = profile(me);
    const theirs = profile(foe);

    /* ---- movement: a dash is for the distances walking is bad at. Closing
       from well outside everything it owns, or giving ground the moment a
       committed swing is spotted and it has already decided not to block.
       Gated behind the same cooldown as attacking, so it cannot be held
       down, and behind `poise` so the careless tiers do it less. */
    if (me.state !== STATE.ATTACK && me.state !== STATE.DASH && this.cool <= 0) {
      const far = dist > mine.longest.range * 1.45;
      if (far && Math.random() < this.cfg.aggression * 0.22) {
        intent.dash = dir;
        this.cool = 16;
        me._aiReason = 'close in';
        return intent;
      }
      const crowded = dist < mine.fastest.range * 0.62;
      if (crowded && Math.random() < this.cfg.poise * 0.12) {
        intent.dash = -dir;
        this.cool = 18;
        me._aiReason = 'make room';
        return intent;
      }
    }

    /* ---- defence: one decision per swing, held until the swing stops being
       one. Not to the end of the animation: once the active frames are over
       there is nothing left to block, and holding the decision through the
       recovery meant guarding through the punish window it had just created.
       That one word of difference is most of the gap between this AI taking
       5.7% of the openings it was handed and taking them. */
    const swinging = foe.state === STATE.ATTACK && foe.move
      && foe.moveFrame < foe.move.startup + foe.move.active;
    if (swinging) {
      const id = `${frame - foe.moveFrame}:${foe.move.name}`;
      if (id !== this.seenAttack) {
        this.seenAttack = id;
        // Only a swing that can actually arrive is worth respecting, and only
        // once there is enough of it left to see. Guarding a whiff from
        // across the stage is what made the old one look like a wall.
        const threat = theirs.moves.find((m) => m.slot === foe.move.name)
          || { range: theirs.longest.range };
        const reachable = dist < threat.range + foe.def.hurtRadius * foe.def.scale + 40;
        const visible = foe.move.startup - foe.moveFrame <= this.cfg.sight;
        // Holding a guard that is about to break is worse than taking the
        // hit: a break is a free heavy, a hit is one hit.
        const canAfford = me.guard > 0.22 + (foe.move.damage / 620);
        this.blocking = reachable && visible && canAfford
          && Math.random() < this.cfg.block;
      }
      // Beat the swing to the punch.
      //
      // The answer a human finds in about four rounds and this did not have at
      // all: if their startup is longer than mine, I do not have to respect
      // the move, I have to hit them during it. Without this branch an
      // opponent that simply walked forward mashing its fastest button beat
      // this AI in 36 of 36 rounds across the cast, 37,736 damage to 1,888 --
      // because every swing was answered with a step backwards, and stepping
      // backwards from someone advancing ends at the wall.
      //
      // They cannot retreat during their own startup, so the full measured
      // range applies rather than the discounted one.
      if (me.state !== STATE.ATTACK && this.cool <= 0) {
        const left = foe.move.startup - foe.moveFrame;
        const pick = mine.moves
          .filter((m) => dist < m.range && m.startup + 2 < left)
          .sort((x, y) => y.damage - x.damage)[0];
        if (pick && Math.random() < this.cfg.punish) {
          intent.attack = pick.slot;
          me._aiReason = 'interrupt';
          this.cool = 10;
          return intent;
        }
      }

      if (this.blocking) {
        // Blocking costs chip and guard. Walking out of the swing costs
        // nothing and leaves them in recovery -- so if the startup frames
        // left are enough to carry me past their reach, take the step
        // instead. This is the whole difference between a fighter that eats
        // a guarded hit and one that makes you miss.
        const left = Math.max(0, foe.move.startup - foe.moveFrame);
        const escape = (me.def.backSpeed * left) / 60;
        const threatAt = (theirs.moves.find((m) => m.slot === foe.move.name)
          || theirs.longest).range;
        const roomBehind = Math.abs(me.x - (dir > 0 ? -760 : 760));
        // And only if the step leaves me close enough to answer the recovery
        // it creates. Walking out of reach of my own fastest move turns a
        // dodge into a free reset for them, which is how a retreat becomes a
        // retreat to the wall.
        const answerable = dist + escape < mine.fastest.range;
        if (dist + escape > threatAt + 14 && roomBehind > escape + 30 && answerable
          && Math.random() < this.cfg.poise) {
          intent.move = -dir;
          return intent;
        }
        intent.guard = true;
        return intent;
      }
    } else {
      this.seenAttack = null;
      this.blocking = false;
    }

    if (me.state === STATE.ATTACK) return intent;

    /* ---- a broken guard, or any stun: the biggest thing that reaches.
       Not subject to the cooldown. The swing that breaks a guard sets one,
       so waiting it out meant 1236 guard breaks produced seven attacks. */
    if (foe.state === STATE.HURT) {
      // They are stunned, not pinned: hitstun still carries them backwards,
      // so this wants to be comfortably inside the range rather than at it.
      const pick = mine.moves.filter((m) => dist < m.range * 0.7)
        .sort((x, y) => y.damage - x.damage)[0];
      if (pick) {
        intent.attack = pick.slot;
        me._aiReason = 'stun';
        this.cool = 8;
        return intent;
      }
      intent.move = dir;        // out of reach: close, this is free time
      return intent;
    }

    /* ---- punish: the frames after a swing when they cannot answer */
    const recovering = foe.state === STATE.ATTACK && foe.move
      && foe.moveFrame >= foe.move.startup + foe.move.active;
    const framesLeft = recovering ? totalFrames(foe.move) - foe.moveFrame : 0;
    if (recovering) {
      // take the biggest move that both reaches and lands before they recover
      // In recovery they cannot retreat, so the full measured range applies.
      const pick = mine.moves
        .filter((m) => dist < m.range && m.startup <= framesLeft)
        .sort((x, y) => y.damage - x.damage)[0];
      // Not subject to the cooldown, for the same reason the stun branch is
      // not: the cooldown exists to stop it mashing pokes into a guard, and a
      // recovery window is precisely the moment when swinging is correct.
      // Measured against an opponent that walked forward mashing its fastest
      // button, the gated version took 203 of the 3,556 windows it was handed
      // -- 5.7% -- and dealt 141 hits to 1,965 taken. A twelve-line policy
      // that guards and punishes every window took 66% of them and traded
      // 1,134 hits for 1,106.
      if (pick && Math.random() < this.cfg.punish) {
        intent.attack = pick.slot;
        me._aiReason = 'punish';
        this.cool = 6;
        return intent;
      }
      // Nothing thrown -- out of reach, on cooldown, or the dice said no.
      // Closing is still right while the window lasts, because these are
      // frames they cannot answer in, and falling through to spacing here
      // meant backing away during the one free window in the round. But only
      // while it lasts: walking in on the last frames of a recovery arrives
      // exactly as the next swing starts, which is how this kept feeding
      // itself into jabs.
      if (framesLeft > mine.fastest.startup) { intent.move = dir; return intent; }
      intent.guard = dist < theirs.longest.range + 30;
      if (!intent.guard) intent.move = dir;
      return intent;
    }

    /* ---- anti-air: they are committed to an arc and cannot change it */
    if (foe.state === STATE.AIR && foe.vy > 0 && dist < mine.longest.range && this.cool <= 0) {
      const pick = mine.moves.filter((m) => dist < m.range).sort((x, y) => x.startup - y.startup)[0];
      if (pick && Math.random() < this.cfg.punish) {
        intent.attack = pick.slot;
        me._aiReason = 'antiair';
        this.cool = 14;
        return intent;
      }
    }

    /* ---- spacing: sit just outside what they can reach, inside what I can */
    this.drift += (Math.random() - 0.5) * 2;
    this.drift = Math.max(-30, Math.min(30, this.drift * 0.98));
    // Stand at the edge of my own reach, not outside theirs.
    //
    // Holding just beyond the opponent's longest move sounds like the textbook
    // answer and is a losing one here: for most of this cast their reach is
    // the same as mine, so that distance is one I cannot attack from either.
    // Measured, it produced a fighter that threw half as many swings as the
    // one it replaced and won 4% of rounds. The edge of my own range is a
    // place I can hit from, and the punish window only exists from there too.
    // Inside the attack threshold, not outside it. Held at 0.92 of its reach
    // while only attacking inside 0.86 of it, this hovered permanently just
    // beyond its own trigger: against an opponent that never advanced it
    // threw literally zero swings in 180 rounds.
    /**
     * The range it is trying to hold, and it is not always the longest.
     *
     * Anchoring on the longest move permanently parks it at kick distance,
     * where the only thing in range is the kick: measured over twelve rounds
     * it threw 405 specials against 98 heavies, 79 lights and no sweeps at
     * all, which is one move with decoration. A fighter that only ever plays
     * one range is not reading as a fighter.
     *
     * So it picks a move to build around and holds that move's distance for
     * a couple of seconds before choosing again. Coming inside kick range is
     * a real decision with a real cost, which is the point, and it is the
     * only way the short moves and the low ever become reachable.
     */
    if (this._planUntil === undefined || frame >= this._planUntil) {
      this._planUntil = frame + 90 + Math.floor(Math.random() * 90);
      this._plan = mine.moves[Math.floor(Math.random() * mine.moves.length)];
    }
    const anchor = this._plan || mine.longest;
    const want = reachNow(anchor, foe) * (0.92 - this.cfg.poise * 0.06) + this.drift;
    const hurt = me.health < me.def.health * 0.3;

    // Feeding a guard is cheap but not free -- chip is real and blockstun keeps
    // the initiative -- so it throttles rather than freezes. Standing off a
    // blocking opponent entirely meant never attacking at all against an
    // opponent that blocks often, which is every opponent.
    // Pressure rather than politeness. A guard that is being leaned on is the
    // only thing in this game that opens on its own, and the opening converts
    // at better than three in four, so a blocking opponent is an opportunity
    // and not a wall to wait behind.
    const guardTax = foe.state === STATE.BLOCK ? 1.7 : 1;

    // Low health throttles the offence rather than ending it. Refusing to
    // attack at all below 30% meant the last third of every losing round was
    // spent not fighting.
    const desperate = hurt ? 0.5 : 1;

    const inRange = mine.moves.filter((m) => dist < reachNow(m, foe));
    if (inRange.length && this.cool <= 0
      && Math.random() < this.cfg.aggression * 0.28 * guardTax * desperate) {
      // Against a guard, the heaviest thing that reaches: guard drain scales
      // with damage, so a heavy is how a blocker gets opened, and the chip
      // is not nothing either. Otherwise the FASTEST thing that reaches.
      //
      // Leading with the heaviest move in range looks aggressive and measures
      // terribly: a heavy's ten to twelve startup frames are long enough for
      // the other fighter to walk out of it or hit you first, and pokes
      // chosen that way landed 2.3% of the time against 23.9% for an
      // opponent throwing mostly jabs. Big moves are for punishes and broken
      // guards, where the opening is already paid for.
      // The low is mixed in before either sort, not after.
      //
      // It is the weakest move in the list, so it loses the damage sort and
      // the startup sort both, and gating it behind "only when they are
      // already blocking" was not enough either: over twelve rounds it was
      // thrown exactly zero times. A mix-up the opponent never uses is not
      // in the game. It goes in as its own branch, which is also honest
      // about what a low is -- a fast poke that happens to beat a high
      // guard, not a punish.
      const lows = inRange.filter((x) => x.low);
      const mixLow = lows.length && Math.random() < 0.25 + this.cfg.chain * 0.45;
      const pick = mixLow ? lows[0]
        : foe.state === STATE.BLOCK
          ? inRange.slice().sort((x, y) => y.damage - x.damage)[0]
          : inRange.slice().sort((x, y) => x.startup - y.startup)[0];
      intent.attack = pick.slot;
      me._aiReason = 'poke';
      // Blockstun leaves the attacker ahead, so a swing that was guarded is
      // the cheapest moment to throw the next one. A swing that touched
      // nothing is the most expensive.
      const blockedLast = foe.state === STATE.BLOCK;
      this.cool = Math.round((blockedLast ? 8 : 24 + Math.random() * 30) + pick.total * 0.4);
    } else if (hurt && dist < theirs.longest.range + 30) {
      // Low on health and inside their reach: the guard goes up, and stays
      // up. This line is the single biggest hole measured in this AI. What
      // was here before -- walk backwards, guard 8% of the time -- meant that
      // below 30% health it stopped attacking, stopped guarding and gave
      // ground, so an opponent that just advanced mashing its fastest button
      // killed it from there every time: 0 rounds won out of 9 for eight of
      // the ten characters, 37,736 damage to 1,888 across the cast.
      intent.guard = true;
    } else if (dist > want + 18) {
      intent.move = dir;
    } else if (dist < want - 18) {
      intent.move = -dir;
    } else if (dist < theirs.longest.range && me.guard > 0.45) {
      // At the spacing it has chosen to hold, standing with the hands down is
      // free damage: whatever they throw next arrives before a reaction can.
      // So the default at neutral is a guard, re-decided every 24 frames
      // rather than every frame -- a per-frame roll compounds to a certainty,
      // which is the mistake that made the first version of this a wall. The
      // duty cycle lands near cfg.block, so the tiers still differ. It stops
      // above a nearly empty meter, so idling never breaks its own guard.
      if (this.holdGuard > 0) { this.holdGuard--; intent.guard = true; }
      else if (frame % 24 === 0) this.holdGuard = Math.random() < this.cfg.block ? 22 : 0;
    }

    return intent;
  }
}

/**
 * Prove the playtest can fail.
 *
 * A check that has never gone red is not a check, it is a decoration. Worse,
 * when a check and the code it guards share an assumption, the check *cannot*
 * fail -- that has happened twice in this project, and both times the suite
 * reported success over visibly broken output.
 *
 * So each claim the suite makes gets a mutant: a single deliberate breakage of
 * the thing that claim depends on, applied to the real source. The suite is
 * then expected to go red *on the specific line* that covers it. A mutant that
 * survives means the check it was aimed at is not testing what it says.
 *
 *   node tools/mutate.mjs [--only <substring>] [--list] [--check] [--here]
 *
 * It breaks real source files, so by default it does that to a detached
 * worktree of HEAD rather than to the checkout you are working in -- an hour
 * of mutants used to mean an hour of a dirty tree holding a deliberate bug,
 * which is both alarming to look at and one slip away from being committed.
 * `--here` keeps the old in-place behaviour.
 *
 * Because the worktree is HEAD, it tests committed code: a dirty tree means
 * the thing being mutated is not the thing you are about to ship, so it stops
 * and says so instead of quietly measuring the wrong code.
 *
 * Files are restored in a finally block, including on crash or interrupt.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const MUTANTS = [
  {
    name: 'hitbox back on the joint',
    why: 'the hitbox must ride the striking end of the limb, not its pivot',
    file: 'src/render/rig.js',
    find: '  strikePoint(M, partName, facing = 1, lead = 0.88) {',
    with: '  strikePoint(M, partName, facing = 1, lead = 0) {',
    expect: 'every move connects',
  },
  {
    name: 'swing direction not measured',
    why: 'which way a limb turns to reach is read off the artwork',
    file: 'src/data/kit.js',
    find: '  return turn;',
    with: '  return turn * 0 + 1.2;',
    expect: 'every move connects',
  },
  {
    name: 'artwork facing ignored',
    why: 'a left-facing illustration has to be mirrored to face the opponent',
    file: 'src/render/rig.js',
    find: '    const flip = place.facing * (this.def.art ?? 1) < 0 ? -1 : 1;',
    with: '    const flip = place.facing < 0 ? -1 : 1;',
    // This used to be caught by the reach check, because six of the cast were
    // drawn facing screen-left and stopped connecting the moment the flag was
    // ignored. All ten have been redrawn facing the same way, so that check
    // cannot see this any more and the mutant would have survived on a healthy
    // game. The synthetic mirror check in the playtest is what catches it now.
    expect: 'a left-facing illustration is mirrored',
  },
  {
    name: 'attacker cannot crowd in',
    why: 'a swing has to be able to close inside the walking separation',
    file: 'src/fight/match.js',
    find: 'const ATTACK_GAP = 128;',
    with: 'const ATTACK_GAP = 150;',
    // Was 'all 30 moves connect', which covered this only while half the cast
    // could not reach from the walking distance. Since the poses were given
    // bodies they all can, so that check went green with the attacking floor
    // raised to the walking one and the mutant survived.
    expect: 'crowd inside the walking separation',
  },
  {
    name: 'hurtbox back to a circle at the ankles',
    why: 'a body three times taller than it is wide needs an ellipse',
    file: 'src/fight/fighter.js',
    find: '      y: top + h * crouched * 0.52,',
    with: '      y: top + h * crouched * 1.0,',
    expect: 'every move connects',
  },
  {
    name: 'chip damage is lethal',
    why: 'a block must never be the thing that finishes you',
    file: 'src/fight/match.js',
    find: '        defender.health = Math.max(1, defender.health - dealt * 0.12);',
    with: '        defender.health = defender.health - dealt * 0.12;',
    expect: 'chip damage can never finish a round',
  },
  {
    name: 'guarding stops reducing damage',
    why: 'a guarded hit is cut to chip, not taken in full',
    file: 'src/fight/match.js',
    find: '        defender.health = Math.max(1, defender.health - dealt * 0.12);',
    with: '        defender.health = Math.max(1, defender.health - m.damage * 1.0);',
    expect: 'a guarded hit is cut to chip',
  },
  {
    name: 'a KO does not advance the round',
    why: 'the round flow has to carry itself from a KO into the next round',
    file: 'src/fight/match.js',
    find: '        else { this.round++; this.reset(PHASE.INTRO); }',
    with: '        else { this.reset(PHASE.INTRO); }',
    expect: 'a KO starts the next round',
  },
  {
    name: 'the match never ends',
    why: 'two rounds take it',
    file: 'src/fight/match.js',
    find: 'const ROUNDS_TO_WIN = 2;',
    with: 'const ROUNDS_TO_WIN = 99;',
    expect: 'two rounds win the match',
  },
  {
    name: 'a weapon arms every limb',
    why: 'a bat must not lengthen a kick, or one weapon is correct on everyone',
    file: 'src/data/weapons.js',
    find: '  if (!heldParts(def, weapon).includes(limbOf(move.strikePart))) return move;',
    with: '  if (!GRIP_PARTS[weapon.grip].concat([\'torso\']).includes(limbOf(move.strikePart))) return move;',
    expect: 'changes only the limb holding it',
  },
  {
    name: 'hand weapons offered to folded arms',
    why: 'five of the ten have no arm to hold one with',
    file: 'src/data/weapons.js',
    find: '  return GRIP_PARTS[weapon.grip].some((p) => parts.has(p));',
    with: '  return true;',
    expect: 'not offered to folded arms',
  },
  {
    name: 'every weapon unlocked from the start',
    why: 'rank has to open the ladder up, or it is decoration',
    file: 'src/game/progress.js',
    find: 'const LADDER = [0, 1, 3, 6, 10];',
    with: 'const LADDER = [0, 0, 0, 0, 0];',
    expect: 'ladder opens up with rank',
  },
  {
    name: 'a win is not remembered',
    why: 'rank is the only thing this game persists',
    file: 'src/game/progress.js',
    find: '  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private window */ }',
    with: '  try { void state; } catch { /* private window */ }',
    expect: 'earned and remembered',
  },
  {
    name: 'the weapon does not reach the simulation',
    why: 'the arithmetic being right is not the same as a fighter swinging it',
    file: 'src/fight/fighter.js',
    find: '    const m = applyWeapon(this.weapon, base, this.def);',
    with: '    const m = base;',
    expect: 'hits harder in the simulation',
  },
  {
    name: 'the loop can be started twice',
    why: 'two rAF chains render every frame twice, for a third of the framerate',
    file: 'src/engine/loop.js',
    find: '      if (!this.running || gen !== this.generation) return;',
    with: '      if (!this.running) return;',
    expect: 'does not double the loop',
  },
  {
    name: 'baked layers no longer cropped',
    why: 'compositing four full-screen layers a frame is what cost the framerate',
    file: 'src/render/arena.js',
    find: '  if (y1 < 0) return { img: c, y: 0, h: 0 };',
    with: '  if (y1 < 0) return { img: c, y: 0, h: 0 };\n  return { img: c, y: 0, h };',
    expect: 'crops its baked layers',
  },
  {
    // The same breakage as above, aimed at the other check that should see it.
    // One mutant can only prove one check, and these two are independent: the
    // cropping invariant is exact and narrow, the fill budget is approximate
    // and catches anything that composites more than it should.
    name: 'baked layers no longer cropped (fill budget)',
    why: 'the fill gate exists to catch compositing regressions in general',
    file: 'src/render/arena.js',
    find: '  if (y1 < 0) return { img: c, y: 0, h: 0 };',
    with: '  if (y1 < 0) return { img: c, y: 0, h: 0 };\n  return { img: c, y: 0, h };',
    expect: 'stays inside its fill budget',
  },
  {
    name: 'the stage is a gradient again',
    why: 'the whole point of the arenas',
    file: 'src/render/arena.js',
    find: '    this.blit(ctx, L.far, cam, 0.6);',
    with: '    if (ctx) return;\n    this.blit(ctx, L.far, cam, 0.6);',
    expect: 'has horizontal structure',
  },
  {
    name: 'camera frames by width only',
    why: 'without the height term a wide window grows them until their shoes leave the frame',
    file: 'src/render/stage.js',
    find: '    const want = Math.max(0.55, Math.min(2.2, Math.min(byHeight, byWidth)));',
    with: '    const want = Math.max(0.55, Math.min(2.2, byWidth));',
    expect: 'framed, not filling the window',
  },
  {
    name: 'poses not solved before the first render',
    why: 'the loop renders on frames it does not simulate',
    file: 'src/main.js',
    find: '  solvePoses();\n  announce(`ROUND ${match.round}`, 1100, \'round\');',
    with: '  announce(`ROUND ${match.round}`, 1100, \'round\');',
    expect: 'poses before its first frame',
  },
  {
    name: 'impacts make no sound',
    why: 'the mixer is driven by the simulation, not by the renderer',
    file: 'src/main.js',
    find: '    sfx.hit(data.move.damage, data.ko);',
    with: '    if (false) sfx.hit(data.move.damage, data.ko);',
    expect: 'reaches the mixer',
  },
  {
    name: 'a low that can be blocked standing',
    why: 'the sweep is the only reason the guard is a decision; blockable '
      + 'high it is a slower light and the guard goes back to a held button',
    file: 'src/fight/match.js',
    find: "        && (!m.low || defender.blockLow);",
    with: "        && (!m.low || true);",
    expect: 'a low beats a standing guard',
  },
  {
    name: 'a crouching guard that does not crouch',
    why: 'a low nobody can block is not a mix-up, it is an unblockable',
    file: 'src/fight/fighter.js',
    find: '      this.blockLow = !!intent.crouch;\n'
      + '      this.setState(STATE.BLOCK);',
    with: '      this.blockLow = false;\n'
      + '      this.setState(STATE.BLOCK);',
    expect: 'a crouching guard stops a low',
  },
  {
    name: 'a dash that covers no more ground than a walk',
    why: 'a dash exists to do the distance walking is bad at; at walking '
      + 'speed it is a walk with a different name and a recovery attached',
    file: 'src/fight/fighter.js',
    find: '  forward: { frames: 11, recover: 5, speed: 2.35 },',
    with: '  forward: { frames: 11, recover: 5, speed: 1.0 },',
    expect: 'a double tap dashes',
  },
  {
    name: 'a second tap that does not register',
    why: 'the double tap is the only way to dash, so a window that never '
      + 'matches removes the input entirely while the state still exists',
    file: 'src/engine/input.js',
    find: 'const DOUBLE_TAP_FRAMES = 12;',
    with: 'const DOUBLE_TAP_FRAMES = 0;',
    expect: 'a double tap dashes',
  },
  {
    name: 'moves that cannot be cancelled into each other',
    why: 'the chain is the whole reason pressing buttons in order is worth '
      + 'anything; without it every swing is an isolated event',
    file: 'src/fight/fighter.js',
    find: '    return from !== undefined && to !== undefined && to > from;',
    with: '    return false;',
    expect: 'chains into heavy into special',
  },
  {
    name: 'a whiff that can be cancelled like a hit',
    why: 'cancelling a move that touched nothing turns a committed heavy into '
      + 'a button with no risk, which is the thing frame data exists to price',
    file: 'src/fight/fighter.js',
    find: '    if (!this.hitConnected) return false;',
    with: '    if (false) return false;',
    expect: 'whiffed move cannot be cancelled',
  },
  {
    name: 'fighters drawn by position instead of by who is swinging',
    why: 'a strike thrown left to right is drawn behind the defender, so the '
      + 'limb doing the work is the one thing covered up',
    file: 'src/main.js',
    find: '      return pa === qa ? byX(p, q) : (pa ? 1 : -1);',
    with: '      return byX(p, q);',
    expect: 'swinging is drawn in front',
  },
  {
    name: 'impacts throw no sparks',
    why: 'the burst at the contact point is how a player sees where a hit landed',
    file: 'src/render/fx.js',
    find: '    const n = ko ? 54 : 18 + Math.round(move.damage / 5);',
    with: '    const n = 0;',
    expect: 'impact spawns sparks',
  },
  {
    name: 'camera shake never reaches the transform',
    why: 'the shake number going up is not the screen moving, and the screen '
      + 'moving is the whole effect',
    file: 'src/render/stage.js',
    // Aimed at a check that read `cam.shake > 0` and nothing else, so it could
    // not tell a camera that shakes from a counter that increments. This
    // mutant survived it. It reads Stage.apply's own transform now.
    find: '    const sx = (Math.random() - 0.5) * this.shake + this.kick.x;\n'
      + '    const sy = (Math.random() - 0.5) * this.shake + this.kick.y;',
    with: '    const sx = this.kick.x;\n    const sy = this.kick.y;',
    expect: 'impact shakes the camera',
  },
  {
    name: 'a mute button that does not mute',
    why: 'the flag is not the sound: what silences the game is the master gain, '
      + 'and a player who hits mute and still hears it has no second recourse',
    file: 'src/audio/sfx.js',
    // The check this is aimed at read `sfx.muted` either side of setMuted and
    // nothing else, so it asserted that an assignment assigns. This mutant
    // survived it. It reads the master gain now, after the ramp settles.
    find: '      this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.02);',
    with: '      this.master.gain.setTargetAtTime(0.9, this.ctx.currentTime, 0.02);',
    expect: 'mute silences and restores',
  },
  {
    name: 'hitstun uncapped',
    why: 'a move that stuns for longer than it takes to come round again loops forever',
    file: 'src/data/common.js',
    find: '  const hitstun = Math.min(m.hitstun, m.recovery + m.startup - 2);',
    with: '  const hitstun = m.hitstun;',
    expect: 'no move stuns for longer than it leaves',
  },
  {
    name: 'blockstun uncapped',
    why: 'blocking has to leave the fighter who blocked a turn, or defending is never right',
    file: 'src/data/common.js',
    find: '  const blockstun = Math.min(m.blockstun, m.active - 1 + m.recovery - FASTEST_STARTUP);',
    with: '  const blockstun = m.blockstun;',
    expect: 'blocking a light earns a turn',
  },
  {
    name: 'no swinging out of a block',
    why: 'the attack intent has to be read while guarding, or a block is a trap',
    file: 'src/fight/fighter.js',
    find: '        if (this.blockFrames > 0) { this.blockFrames--; this.physics(0.80); return; }',
    with: '        if (this.blockFrames > 0) this.blockFrames--;\n        this.physics(0.80);\n        return;',
    expect: 'swing out of a block',
  },
  {
    name: 'a broken guard never comes back',
    why: 'the break is the punishment, not the start of a permanent one',
    file: 'src/fight/fighter.js',
    find: '          if (this.guardBroken > 0) { this.guard = 1; this.guardBroken = 0; }',
    with: '          if (false) { this.guard = 1; this.guardBroken = 0; }',
    expect: 'gives the guard back',
  },
  {
    name: 'the guard meter never drains',
    why: 'a guard held and nothing else has to run out, or turtling wins',
    file: 'src/fight/fighter.js',
    find: '    if (this.state === STATE.BLOCK) this.guard = Math.max(0, this.guard - 0.002);',
    with: '    if (this.state === STATE.BLOCK) this.guard = Math.max(0, this.guard - 0);',
    expect: 'drains the meter',
  },
  {
    name: 'a guard never breaks',
    why: 'an empty meter has to open the guard it belongs to',
    file: 'src/fight/match.js',
    find: '          defender.breakGuard();',
    with: '          defender.guard = 1;',
    expect: 'leaned-on guard breaks',
  },
  {
    name: 'the guard bar is not painted',
    why: 'the meter decides fights, so it has to be on screen',
    file: 'src/main.js',
    find: '  el(`gd${side}`).style.width = `${Math.max(0, f.guard) * 100}%`;',
    with: '  el(`gd${side}`).style.width = \'100%\';',
    expect: 'HUD shows the guard meter',
  },
  {
    name: 'poses keyed by character again',
    why: 'everything downstream reads a pose by pad, so keying by character '
      + 'leaves both fighters with nothing to draw',
    file: 'src/main.js',
    find: '    poses[f.pad] = rig.solve(f.pose(), {',
    with: '    poses[f.def.id] = rig.solve(f.pose(), {',
    // Aimed at the mirror check until the suite was run against it: keying by
    // character breaks EVERY match, not only a mirror one, so the page throws
    // on the first frame it draws and the run never reaches the mirror check
    // at all. The invariant check at the top catches it in the same turn the
    // match is made, which is the earliest anything can. The mirror claim gets
    // its own mutant below, one that an ordinary match cannot feel.
    expect: 'poses before its first frame',
  },
  {
    name: 'one solve shared between two of the same character',
    why: 'a pose cache keyed by character collides in a mirror match, and both '
      + 'corners are then drawn in whichever pose was solved first',
    file: 'src/main.js',
    find: `function solvePoses() {
  for (const f of match.fighters) {
    const rig = rigs[f.def.id];
    poses[f.pad] = rig.solve(f.pose(), {`,
    with: `function solvePoses() {
  const seen = {};
  for (const f of match.fighters) {
    const rig = rigs[f.def.id];
    poses[f.pad] = seen[f.def.id] ||= rig.solve(f.pose(), {`,
    // Still keyed by pad, so nothing is undefined and a kin08-vs-kin06 match
    // is untouched -- the two ids never collide. Only a mirror match notices,
    // which is what makes this the mutant for that check rather than for the
    // six others the destructive version trips.
    expect: 'mirror match pose apart',
  },
  {
    name: 'punishing gated by the poke cooldown',
    why: 'a recovery window is exactly when swinging is right',
    file: 'src/fight/ai.js',
    find: `      if (pick && Math.random() < this.cfg.punish) {
        intent.attack = pick.slot;
        me._aiReason = 'punish';`,
    with: `      if (pick && this.cool <= 0 && Math.random() < this.cfg.punish) {
        intent.attack = pick.slot;
        me._aiReason = 'punish';`,
    expect: 'punishes a recovery',
  },
  {
    name: 'defence held through the recovery',
    why: 'once the active frames are over there is nothing left to block',
    file: 'src/fight/ai.js',
    find: '      && foe.moveFrame < foe.move.startup + foe.move.active;',
    with: '      && true;',
    expect: 'punishes a recovery',
  },
  {
    name: 'the hardest tier sees swings last',
    why: 'the difficulty dials have to point the same way as the difficulty',
    file: 'src/fight/ai.js',
    find: '  mean: { sight: 24, aggression: 0.9, block: 0.93, punish: 0.9, poise: 0.95, chain: 0.92 },',
    with: '  mean: { sight: 2, aggression: 0.9, block: 0.93, punish: 0.9, poise: 0.95, chain: 0.92 },',
    expect: 'difficulty tiers are in order',
  },
  {
    name: 'punches that do not move the arm',
    why: 'the hitbox rides the limb, so a frozen limb is a move that only pretends to swing',
    file: 'src/data/kit.js',
    // This used to zero the shoulder's rotation instead, which looked like the
    // same thing and is not: the elbow is a separate channel two lines down
    // and still whips, so the fist travels 44 to 83 and the limb genuinely
    // does swing -- from a shoulder that never turns. That mutant was caught,
    // correctly, by the reach and frame-advantage checks rather than by this
    // one, and it left the frozen-limb check with nothing aimed at it at all.
    // Leaving the striking limb out of the pose is the bug this check is
    // about: KIN 06's jab, whose pose was still the leg pose he had before he
    // was given arms.
    find: `      [arm]: { rot: (() => {
        const start = mix(self, -0.30 * swing, a);
        const target = swing * (1 + power * 0.08);
        const t = elbow ? reach : strike;
        return (sweepPast ? start + target * t : mix(start, target, t)) + settle * 0.07;
      })() },
      // Folded at the chin through the wind-up, straight at full extension.
      ...(elbow ? { [elbow]: { rot: mix(restElbow, FOLD * 1.3, a) * (1 - snap) } } : {}),`,
    with: '      // MUTANT: the striking limb is left out of the pose entirely.',
    expect: 'swings the limb it strikes with',
  },
  {
    name: 'a hitbox that goes live before the swing arrives',
    why: 'the active frame is the one the hit freeze holds up for the player, '
      + 'so a strike caught on its wind-up reads as a miss that hurt',
    file: 'src/data/kin06s.js',
    // Aimed at a hand-animated character on purpose, and the first attempt at
    // this mutant is why. It moved the same window to the front of kin02's
    // overhand, which is built by `move()` from the shared curve -- and there
    // the pose is a function of the phase, so dragging the window drags the
    // whole swing along with it and the fist arrives exactly on time at its
    // new time. The check stayed green and it was right to.
    //
    // A hand-animated pose keys on absolute frame numbers, so the window can
    // slide out from under the swing while the swing stays where it was. The
    // jab's full extension is keyed at frame 8; with no startup the hitbox is
    // live on frames 0 to 2, when the arm has barely left the guard. Total
    // length stays at 17 so nothing length-dependent moves.
    find: '      startup: 4, active: 4, recovery: 11,',
    with: '      startup: 0, active: 4, recovery: 15,',
    expect: 'at full stretch when its hitbox is live',
  },
  {
    name: 'a shoulder turned past the joint it has',
    why: 'limits were data nothing read; every rear hand in the cast finished '
      + 'its heavy more than half a turn over, pointing down and behind',
    file: 'src/data/kit.js',
    find: '        return (sweepPast ? start + target * t : mix(start, target, t)) + settle * 0.07;',
    with: '        return start + target * t * 1.6 + settle * 0.07;',
    expect: 'turns a joint past the rig',
  },
  {
    name: 'a stored range that no longer matches the move',
    why: 'range is generated and the AI holds its distance by it, so a stale '
      + 'number parks the opponent where it cannot hit; it went stale twice '
      + 'with nothing to say so',
    // Was aimed at kin03, which left the roster with the other nine
    // front-facing characters. A mutant in a file nothing loads cannot be
    // caught by anything, and would have sat here reading as coverage.
    file: 'src/data/kin09s.js',
    find: "      strikePart: 'foreL', reach: 105, range: 149,",
    with: "      strikePart: 'foreL', reach: 105, range: 210,",
    expect: 'stored range matches what the move reaches',
  },
  {
    name: 'a direction that does not move you',
    why: 'the walk animation and the walk are two different things, and only '
      + 'one of them closes the distance',
    file: 'src/fight/fighter.js',
    find: '      this.vx = intent.move * (toward ? this.def.walkSpeed : this.def.backSpeed);',
    with: '      this.vx = 0;',
    expect: 'walking moves the fighter',
  },
  {
    name: 'a jump that barely leaves the floor',
    why: 'a jump has to clear a sweep, or the button is decoration',
    file: 'src/fight/fighter.js',
    find: '      this.vy = -this.def.jumpVel;',
    with: '      this.vy = -20;',
    expect: 'jump leaves the floor',
  },
  {
    name: 'nothing brings a jump down',
    why: 'a fighter who goes up and stays there cannot be hit or hit back',
    file: 'src/fight/fighter.js',
    find: '      this.vy += GRAVITY * TICK;',
    with: '      this.vy += 0;',
    expect: 'jump lands',
  },
  {
    name: 'hits that take no health',
    why: 'the whole simulation can look right with the one number that ends a '
      + 'round never moving',
    file: 'src/fight/fighter.js',
    find: '    this.health = Math.max(0, this.health - damage);',
    with: '    this.health = Math.max(0, this.health - damage * 0);',
    expect: 'a clean hit reduces health',
  },
  {
    name: 'every hit scaled down to chip',
    why: 'a hit that takes a point or two reads as a hit to everything that '
      + 'asks whether health went down, and to nobody playing',
    file: 'src/fight/fighter.js',
    find: '    this.health = Math.max(0, this.health - damage);',
    with: '    this.health = Math.max(0, this.health - damage * 0.08);',
    expect: 'a real hit, not chip',
  },
  {
    name: 'a KO that does not end the round',
    why: 'the round ending on the last point of health is the end of the game '
      + 'loop; without it a fighter stands at zero and the fight continues',
    file: 'src/fight/match.js',
    find: `    else if (!this.a.alive) this.endRound(1);
    else if (!this.b.alive) this.endRound(0);`,
    with: '    // MUTANT: a KO no longer ends the round.',
    // This mutant is why the KO check was rewritten: it used to pass on
    // `hp === 0` alone, so the health emptying counted as the round ending
    // and nothing here could redden it.
    expect: 'round ends on a KO',
  },
  {
    name: 'a pose that slides the pelvis out from under the ribs',
    why: 'this is the bug that happened: the lunge was translating the hips, '
      + 'which hang off the torso, so the art came apart at the waist on '
      + 'every punch, kick and charge in the game',
    file: 'src/data/kit.js',
    find: '      hips: { rot: 0.09 * a - 0.28 * strike + settle * 0.04 },',
    with: '      hips: { rot: 0.09 * a - 0.28 * strike + settle * 0.04, x: -20 },',
    expect: 'pulls a part off the one it hangs from',
  },
  {
    name: 'a weapon that shortens the move it is held in',
    why: 'picking something up must never make a swing worse than a fist, or '
      + 'the pickup is a trap',
    file: 'src/data/weapons.js',
    find: '    reach: move.reach + weapon.reach,',
    with: '    reach: move.reach - weapon.reach,',
    expect: 'no weapon shortens a move',
  },
  {
    name: 'a light that recovers as slowly as a heavy',
    why: 'a big slow punch has to be the risky one, or there is no reason to '
      + 'ever throw the small one',
    file: 'src/data/kin09s.js',
    // Was aimed at kin01, which left the roster; re-aimed at KIN 09's Point.
    //
    // Shortening the HEAVY was the obvious mutation and it survived. capStun
    // clamps blockstun to `active - 1 + recovery - 6`, which makes every
    // move's advantage-on-block exactly max(raw, 6) -- so a heavy cannot go
    // below 6 however short you make it, and every light sits on that floor
    // at exactly 6. Nothing strictly below 6 exists to find. Raising a LIGHT
    // above its own heavy is the breakable direction.
    find: '      startup: 4, active: 3, recovery: 9,',
    with: '      startup: 4, active: 3, recovery: 24,',
    expect: 'a heavy is never safer on block',
  },
];

const args = process.argv.slice(2);
if (args.includes('--list')) {
  for (const m of MUTANTS) console.log(`${m.name.padEnd(42)} -> ${m.expect}`);
  process.exit(0);
}
// A mutant anchored on a line that has since been edited is skipped, and a
// skip is counted against the score so it cannot pass quietly -- but the whole
// suite is an hour of playtest runs, so finding out that way is an hour spent
// to learn that a string moved. This reads every anchor and nothing else.
if (args.includes('--check')) {
  let broken = 0;
  for (const m of MUTANTS) {
    const n = fs.readFileSync(m.file, 'utf8').split(m.find).length - 1;
    if (n === 1) continue;
    broken++;
    console.log(`${n === 0 ? 'MISSING ' : `${n} MATCHES`}  ${m.name}`);
    console.log(`          ${m.file}: ${m.find.trim()}`);
  }
  console.log(`\n${MUTANTS.length - broken}/${MUTANTS.length} anchors land exactly once.`);
  process.exit(broken ? 1 : 0);
}
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const run = MUTANTS.filter((m) => !only || m.name.includes(only));

if (!args.includes('--here')) {
  const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
  if (git('status', '--porcelain')) {
    console.error('working tree is dirty, so a worktree of HEAD would not be the code you are about to ship.');
    console.error('commit first, or pass --here to mutate this checkout in place.');
    process.exit(1);
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rebelkin-mutate-'));
  git('worktree', 'add', '--detach', dir, 'HEAD');
  try {
    const r = spawnSync('node', ['tools/mutate.mjs', ...args, '--here'], { cwd: dir, stdio: 'inherit' });
    process.exitCode = r.status ?? 1;
  } finally {
    try { git('worktree', 'remove', '--force', dir); } catch { /* leave it rather than fail the run */ }
  }
  process.exit(process.exitCode ?? 0);
}

/**
 * The labels of the checks a playtest run printed, red or green.
 *
 * `check` prints "  <mark> <label>  <detail>", so the label is everything up
 * to the first double space. Nothing in the suite has a label containing one;
 * if something ever does, it will show up here as a check nothing covers.
 */
const labelsOf = (out) => out.split('\n')
  .filter((l) => /^\s*[\u2713\u2717] /.test(l))
  .map((l) => l.trim().slice(2).split('  ')[0]);

/**
 * Which claims has nothing in this suite ever been seen to break?
 *
 * `--check` proves each mutant still has a line to break. This is the other
 * half: each mutant names ONE check it expects to go red, but breaking the
 * shoulder's rotation reddens the reach checks too, and a mutant's other reds
 * were being read and discarded. Counting only the named check undercounts
 * coverage badly -- a hand audit that way called 52 of 84 checks uncovered,
 * most of which some mutant does in fact redden.
 *
 * A check nothing reddens is not automatically a decoration: much of the suite
 * is smoke ("rigs loaded", "match started"), whose failure mode is the game
 * not starting at all, and those go red often enough in real work. It is a
 * list of claims this suite has never watched fail, which is worth knowing
 * before trusting one of them.
 */
const everRed = new Set();
let baseline = null;
{
  // Run even for a single mutant: a red HEAD makes a mutant's report
  // meaningless either way. Only the coverage summary needs the whole suite.
  process.stdout.write('baseline ... ');
  try {
    baseline = labelsOf(execFileSync('node', ['tools/playtest.mjs'], { encoding: 'utf8', timeout: 300000 }));
    console.log(`${baseline.length} checks, all green`);
  } catch (err) {
    // A red baseline makes every mutant below report something, so the whole
    // run would be an hour of measuring the wrong code.
    console.error('\nthe playtest does not pass on HEAD, so no mutant below would mean anything:');
    console.error(`${err.stdout ?? ''}`.split('\n').filter((l) => l.includes('\u2717')).join('\n'));
    process.exit(1);
  }
}

let survived = 0;
for (const m of run) {
  const original = fs.readFileSync(m.file, 'utf8');
  if (original.split(m.find).length - 1 !== 1) {
    console.log(`SKIP  ${m.name}\n      anchor not found exactly once in ${m.file}`);
    survived++;
    continue;
  }
  let out = '';
  try {
    fs.writeFileSync(m.file, original.replace(m.find, m.with));
    try {
      out = execFileSync('node', ['tools/playtest.mjs'], { encoding: 'utf8', timeout: 300000 });
    } catch (err) {
      out = `${err.stdout ?? ''}${err.stderr ?? ''}`;
    }
  } finally {
    fs.writeFileSync(m.file, original);
  }

  const lines = out.split('\n');
  const red = lines.filter((l) => l.includes('✗') || l.includes('runtime problem'));
  for (const l of labelsOf(out.split('\n').filter((x) => x.includes('✗')).join('\n'))) everRed.add(l);
  const caught = red.some((l) => l.includes(m.expect));
  const anyRed = red.length > 0 || out.includes('FAILED');
  if (caught) {
    console.log(`CAUGHT  ${m.name}`);
    console.log(`        ${red.find((l) => l.includes(m.expect)).trim()}`);
  } else if (anyRed) {
    // still a failure, but not the one that claims to cover this
    survived++;
    console.log(`WRONG CHECK  ${m.name}`);
    console.log(`        expected "${m.expect}" to go red; what went red was:`);
    for (const l of red.slice(0, 3)) console.log(`        ${l.trim()}`);
  } else {
    survived++;
    console.log(`SURVIVED  ${m.name}`);
    console.log(`        ${m.why}`);
    console.log('        the suite passed with this broken. That check is not testing what it says.');
  }
}

console.log(`\n${run.length - survived}/${run.length} mutants caught by the right check.`);
if (baseline && !only) {
  const bare = baseline.filter((l) => !everRed.has(l));
  console.log(`\n${baseline.length - bare.length}/${baseline.length} checks were seen to go red by some mutant.`);
  if (bare.length) {
    console.log('nothing in this suite broke these:');
    for (const l of bare) console.log(`  ${l}`);
  }
}
if (survived) process.exitCode = 1;

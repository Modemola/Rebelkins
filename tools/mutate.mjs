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
    expect: 'all 30 moves connect',
  },
  {
    name: 'swing direction not measured',
    why: 'which way a limb turns to reach is read off the artwork',
    file: 'src/data/kit.js',
    find: '  return turn;',
    with: '  return turn * 0 + 1.2;',
    expect: 'all 30 moves connect',
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
    find: 'const ATTACK_GAP = 84;',
    with: 'const ATTACK_GAP = 118;',
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
    expect: 'all 30 moves connect',
  },
  {
    name: 'chip damage is lethal',
    why: 'a block must never be the thing that finishes you',
    file: 'src/fight/match.js',
    find: '        defender.health = Math.max(1, defender.health - m.damage * 0.12);',
    with: '        defender.health = defender.health - m.damage * 0.12;',
    expect: 'chip damage can never finish a round',
  },
  {
    name: 'guarding stops reducing damage',
    why: 'a guarded hit is cut to chip, not taken in full',
    file: 'src/fight/match.js',
    find: '        defender.health = Math.max(1, defender.health - m.damage * 0.12);',
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
    find: '  if (!heldParts(def, weapon).includes(move.strikePart)) return move;',
    with: '  if (!GRIP_PARTS[weapon.grip].concat([\'torso\']).includes(move.strikePart)) return move;',
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
    why: 'two of the same character need a pose each, not one between them',
    file: 'src/main.js',
    find: '    poses[f.pad] = rig.solve(f.pose(), {',
    with: '    poses[f.def.id] = rig.solve(f.pose(), {',
    expect: 'mirror match',
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
    find: '  mean: { sight: 24, aggression: 0.9, block: 0.93, punish: 0.9, poise: 0.95 },',
    with: '  mean: { sight: 2, aggression: 0.9, block: 0.93, punish: 0.9, poise: 0.95 },',
    expect: 'difficulty tiers are in order',
  },
  {
    name: 'punches that do not move the arm',
    why: 'the hitbox rides the limb, so a frozen limb is a move that only pretends to swing',
    file: 'src/data/kit.js',
    find: '      [arm]: { rot: -0.30 * swing * a + swing * (1 + power * 0.08) * (elbow ? reach : strike) + settle * 0.07 },',
    with: '      [arm]: { rot: 0 },',
    expect: 'swings the limb it strikes with',
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
if (survived) process.exitCode = 1;

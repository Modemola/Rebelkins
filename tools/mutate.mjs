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
 *   node tools/mutate.mjs [--only <substring>] [--list]
 *
 * Files are restored in a finally block, including on crash or interrupt.
 */

import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

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
    why: 'six of the ten illustrations face screen-left and must be mirrored',
    file: 'src/render/rig.js',
    find: '    const flip = place.facing * (this.def.art ?? 1) < 0 ? -1 : 1;',
    with: '    const flip = place.facing < 0 ? -1 : 1;',
    expect: 'all 30 moves connect',
  },
  {
    name: 'attacker cannot crowd in',
    why: 'a swing has to be able to close inside the walking separation',
    file: 'src/fight/match.js',
    find: 'const ATTACK_GAP = 84;',
    with: 'const ATTACK_GAP = 118;',
    expect: 'all 30 moves connect',
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
    name: 'the loop can be started twice',
    why: 'two rAF chains run the simulation at double rate and render every frame twice',
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
];

const args = process.argv.slice(2);
if (args.includes('--list')) {
  for (const m of MUTANTS) console.log(`${m.name.padEnd(42)} -> ${m.expect}`);
  process.exit(0);
}
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const run = MUTANTS.filter((m) => !only || m.name.includes(only));

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

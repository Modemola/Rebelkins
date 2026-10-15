/**
 * Put two opponent AIs in a room and count.
 *
 * "Smarter" is not a thing you can assert about an AI, and it is not a thing
 * you can see by watching one fight either -- a few rounds look like whatever
 * the dice did. But the whole simulation is pure JavaScript: the rig only
 * needs its definition to solve poses and place hitboxes, not its artwork, so
 * a match runs in Node with no browser and no canvas at all. Thousands of
 * rounds take seconds.
 *
 * So the claim gets measured. Two AI modules fight across every character
 * pairing, and this reports the win rate and, more usefully, the behaviour
 * behind it: what fraction of swings land, how often each one is punished
 * during its own recovery, how much of the damage taken was taken on a guard.
 * A build that wins more while whiffing more has got luckier, not better.
 *
 *   node tools/spar.mjs [--rounds 6] [--a <module>] [--b <module>]
 *                       [--levelA brisk] [--levelB brisk] [--seed 1]
 *                       [--weapon bare] [--pairs 90] [--quiet]
 *
 * `spar()` is exported so the playtest can make the same measurements its own
 * checks depend on without a second copy of the fight loop.
 */

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Rig } from '../src/render/rig.js';
import { Match, PHASE } from '../src/fight/match.js';
import { STATE } from '../src/fight/fighter.js';
import { totalFrames } from '../src/data/common.js';
import { byId as weaponById } from '../src/data/weapons.js';

export const IDS = ['kin01', 'kin02', 'kin03', 'kin04', 'kin05', 'kin06', 'kin07', 'kin08', 'kin09', 'kin10'];

let cast = null;

/** The ten definitions and their image-less rigs, loaded once per process. */
export async function loadCast() {
  if (cast) return cast;
  const DEFS = {};
  const rigs = {};
  for (const id of IDS) {
    const mod = await import(`../src/data/${id}.js`);
    const def = mod[id.toUpperCase()];
    DEFS[id] = def;
    rigs[id] = new Rig(def.rig, null);   // no image: solve and strikePoint never touch it
  }
  cast = { DEFS, rigs };
  return cast;
}

/**
 * Deterministic Math.random, so a difference between two runs is a difference
 * between two AIs. Both sides draw from the same stream in the same order.
 * Returns a restore function: the caller's own randomness is not ours to keep.
 */
function seedRandom(seed) {
  const real = Math.random;
  let s = seed >>> 0 || 1;
  Math.random = () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
  return () => { Math.random = real; };
}

export const blankStats = () => ({
  swings: 0, hits: 0, blocked: 0, punished: 0, punishes: 0, counters: 0,
  breaks: 0, broken: 0, dealt: 0, chip: 0, by: {},
});

/** One round, to a knockout or the clock. Returns 0 if A won, 1 if B did. */
function round(defA, defB, rigs, aiA, aiB, stats, weapon) {
  const m = new Match(defA, defB, rigs, [weapon, weapon]);
  const side = (f) => (f === m.a ? 0 : 1);
  m.onEvent = (kind, data) => {
    if (kind === 'guardBreak') {
      stats[side(data.attacker)].breaks++;
      stats[side(data.defender)].broken++;
      // A break is a third outcome, not a miss. Counting only hits and blocks
      // as contact made the heavies that open a guard read as 91% whiffs --
      // the swings doing the most work looked like the worst decisions.
      if (data.attacker._aiPending) data.attacker._aiPending.broke++;
      return;
    }
    if (kind !== 'hit' && kind !== 'block') return;
    const s = stats[side(data.attacker)];
    const d = stats[side(data.defender)];
    if (kind === 'block') {
      s.blocked++; d.chip += 1;
      if (data.attacker._aiPending) data.attacker._aiPending.blocked++;
      return;
    }
    s.hits++;
    if (data.attacker._aiPending) data.attacker._aiPending.hit++;
    s.dealt += data.move.damage;
    // A hit landing while the other is still in their own recovery is the
    // thing a sparring partner never does and a real opponent always does.
    // The match reports it, because by the time the event arrives the
    // defender's move has already been cleared.
    if (data.counter === 'recovery') { s.punishes++; d.punished++; }
    if (data.counter === 'startup') { s.counters++; }
  };

  const solve = () => {
    const out = {};
    for (const f of m.fighters) {
      out[f.pad] = rigs[f.def.id].solve(f.pose(), {
        x: f.x, y: f.y, scale: f.def.scale, facing: f.facing,
      });
    }
    return out;
  };

  const wasAttacking = [false, false];
  for (let frame = 0; frame < 20000; frame++) {
    for (const f of m.fighters) {
      const i = side(f);
      const now = f.state === STATE.ATTACK;
      if (now && !wasAttacking[i]) {
        stats[i].swings++;
        const why = f._aiReason || 'other';
        const b = (stats[i].by[why] ||= { n: 0, hit: 0, blocked: 0, broke: 0 });
        b.n++;
        f._aiPending = b;
      }
      wasAttacking[i] = now;
    }
    if (m.phase === PHASE.ROUND_END || m.phase === PHASE.MATCH_END) break;
    m.step(frame, { a: aiA.think(m.a, m.b, frame), b: aiB.think(m.b, m.a, frame) }, solve);
  }
  if (!m.a.alive) return 1;
  if (!m.b.alive) return 0;
  return m.a.health >= m.b.health ? 0 : 1;   // the clock; ties go to the player side
}

/**
 * Run a sweep. `pairs` caps how many of the 90 orderings are used, taken in a
 * fixed order so a smaller sweep is a subset of the big one and not a
 * different experiment. Returns { stats: [A, B], winsA, total }.
 */
export function spar({
  AiA, AiB, rigs, DEFS, rounds = 6, seed = 1,
  levelA = 'brisk', levelB = 'brisk', weapon = 'bare', pairs = Infinity,
}) {
  const restore = seedRandom(seed);
  const w = weaponById(weapon);
  const stats = [blankStats(), blankStats()];
  let winsA = 0;
  let total = 0;
  try {
    const orderings = [];
    for (const x of IDS) for (const y of IDS) if (x !== y) orderings.push([x, y]);
    for (const [x, y] of orderings.slice(0, pairs)) {
      for (let r = 0; r < rounds; r++) {
        // Both AIs fight from both corners across the round repeats, so a
        // difference cannot be an artefact of who started on the left.
        const flip = r % 2 === 1;
        const ai1 = new AiA(levelA);
        const ai2 = new AiB(levelB);
        const won = flip
          ? 1 - round(DEFS[y], DEFS[x], rigs, ai2, ai1, [stats[1], stats[0]], w)
          : round(DEFS[x], DEFS[y], rigs, ai1, ai2, stats, w);
        if (won === 0) winsA++;
        total++;
      }
    }
  } finally {
    restore();
  }
  return { stats, winsA, total };
}

export const pct = (n, d) => (d ? `${((n / d) * 100).toFixed(1)}%` : '-');

export const line = (name, s) => `  ${name.padEnd(5)} `
  + `swings ${String(s.swings).padStart(5)}  `
  + `land ${pct(s.hits, s.swings).padStart(6)}  `
  + `guarded ${pct(s.blocked, s.swings).padStart(6)}  `
  + `broke ${pct(s.breaks, s.swings).padStart(6)}  `
  + `whiff ${pct(s.swings - s.hits - s.blocked - s.breaks, s.swings).padStart(6)}  `
  + `punishes ${String(s.punishes).padStart(4)}  `
  + `counters ${String(s.counters).padStart(4)}  `
  + `punished ${String(s.punished).padStart(4)}  `
  + `broken ${String(s.broken).padStart(3)}  `
  + `damage ${s.dealt}`;

export const breakdown = (s) => Object.entries(s.by)
  .sort((x, y) => y[1].n - x[1].n)
  .map(([k, v]) => `${k} ${v.n} (land ${pct(v.hit, v.n)}, guarded ${pct(v.blocked, v.n)}, broke ${pct(v.broke, v.n)})`)
  .join('  ');

/* ------------------------------------------------------------------- cli */

const invokedDirectly = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (invokedDirectly) {
  const arg = (f, d) => (process.argv.includes(f) ? process.argv[process.argv.indexOf(f) + 1] : d);
  const here = path.dirname(new URL(import.meta.url).pathname);
  const load = async (p) => (await import(pathToFileURL(path.resolve(here, p)).href)).AI;
  const pathA = arg('--a', '../src/fight/ai.js');
  const pathB = arg('--b', '../src/fight/ai.js');
  const levelA = arg('--levelA', 'brisk');
  const levelB = arg('--levelB', 'brisk');
  const weapon = arg('--weapon', 'bare');
  const quiet = process.argv.includes('--quiet');
  const { DEFS, rigs } = await loadCast();
  const out = spar({
    AiA: await load(pathA), AiB: await load(pathB), DEFS, rigs,
    rounds: Number(arg('--rounds', 6)), seed: Number(arg('--seed', 1)),
    levelA, levelB, weapon, pairs: Number(arg('--pairs', Infinity)),
  });
  if (!quiet) {
    console.log(`${out.total} rounds, ${pathA}(${levelA}) vs ${pathB}(${levelB}), weapon ${weapon}`);
    console.log(line('A', out.stats[0]));
    console.log(`        why: ${breakdown(out.stats[0])}`);
    console.log(line('B', out.stats[1]));
    console.log(`        why: ${breakdown(out.stats[1])}`);
  }
  console.log(`A wins ${out.winsA}/${out.total} = ${pct(out.winsA, out.total)}`);
}

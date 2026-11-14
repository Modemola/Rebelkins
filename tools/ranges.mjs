/**
 * Measure how far every move actually reaches, and write it into the data.
 *
 * The opponent AI needs to know when it can hit you. Estimating that from the
 * hitbox radius plus how far the limb's artwork extends gets the ordering
 * roughly right and the distance badly wrong -- against the measured values
 * it runs about 1.39x short, and anywhere between 1.08x and 1.66x depending
 * on the character, because how much of a limb's length ends up pointing at
 * the opponent depends on the pose the artist drew. An AI holding a distance
 * computed that way either stands where it cannot hit or walks into range of
 * everything.
 *
 * So the number is measured, by binary-searching the furthest starting gap
 * from which each move still connects in the real simulation, and written
 * into the character files as `range`. Generated data with its generator
 * committed beside it, the same arrangement as the atlases: re-run this
 * whenever a reach, a scale or a pose changes.
 *
 *   node tools/ranges.mjs [--dry] [--check]
 *
 * `--check` measures without writing and exits non-zero if what is stored
 * disagrees with what the moves reach. The playtest calls `measure()` for the
 * same reason: this is generated data, and the only thing that had ever
 * noticed it going stale was someone happening to re-run the generator. A
 * change to a pose or a reach silently invalidates every number here, and a
 * move whose stored range is too long makes the AI stand where it cannot hit.
 */

import fs from 'node:fs';
import { Rig } from '../src/render/rig.js';
import { Match } from '../src/fight/match.js';
import { byId } from '../src/data/weapons.js';

// The roster, not a copy of it: this list went stale the moment the two
// side-view characters joined, and a move whose range is never measured
// keeps whatever number was guessed when it was written.
import { IDS as ids } from './spar.mjs';

const DEFS = {};
const rigs = {};
for (const id of ids) {
  const def = (await import(`../src/data/${id}.js`))[id.toUpperCase()];
  DEFS[id] = def;
  rigs[id] = new Rig(def.rig, null);
}
const IDLE = { move: 0, crouch: false, jump: false, guard: false, attack: null };
const bare = byId('bare');

/**
 * Does this move connect when the two start exactly `gap` apart?
 *
 * The defender is pinned and idle, and the attacker is held at the gap for
 * the duration: what is being measured is the move's reach, not whether the
 * other fighter happened to walk into it.
 */
function connects(attacker, slot, gap) {
  // The dummy is whoever is not the attacker, taken from the roster rather
  // than named: this said DEFS.kin06, which stopped existing the moment the
  // roster was cut to the two side-view characters.
  const dummy = ids.find((x) => x !== attacker) || attacker;
  const m = new Match(DEFS[attacker], DEFS[dummy], rigs, [bare, bare]);
  m.onEvent = () => {};
  m.phase = 'fight';
  const solve = () => {
    const out = {};
    for (const f of m.fighters) {
      out[f.pad] = rigs[f.def.id].solve(f.pose(), {
        x: f.x, y: f.y, scale: f.def.scale, facing: f.facing,
      });
    }
    return out;
  };
  const bx = m.b.x;
  m.a.x = bx - gap;
  const hp = m.b.health;
  m.a.startMove(slot);
  for (let i = 0; i < 70; i++) {
    m.b.x = bx;
    m.a.x = Math.min(m.a.x, bx - gap);     // drive may carry it in, never out
    m.step(i, { a: IDLE, b: IDLE }, solve);
    if (m.b.health < hp) return true;
  }
  return false;
}

/** The furthest gap each move still connects from, measured not estimated. */
export function measure(onRow = () => {}) {
  const found = {};
  for (const id of ids) {
    found[id] = {};
    for (const slot of ['light', 'heavy', 'special']) {
      if (!DEFS[id].moves[slot]) continue;
      // Find a gap that works before searching for the furthest one.
      //
      // This used to test the closest gap and give up if it missed, which
      // assumes every move is a simple maximum reach. A punch aimed high has
      // a hole at point-blank -- the hurtbox is an ellipse, so it is narrow
      // up where the head is, and a fist can arrive past the edge of it. KIN
      // 01's jab connected anywhere from 100 to 150 and was reported as 0.
      let lo = 0;
      for (let g = 60; g <= 340; g += 8) if (connects(id, slot, g)) { lo = g; break; }
      let hi = 340;
      if (!lo) { found[id][slot] = 0; continue; }
      while (hi - lo > 2) {
        const mid = (lo + hi) / 2;
        if (connects(id, slot, mid)) lo = mid; else hi = mid;
      }
      found[id][slot] = Math.round(lo);
    }
    onRow(id, found[id]);
  }
  return found;
}

/**
 * Where a stored range disagrees with the measured one.
 *
 * The tolerance is the binary search's own resolution plus a little: it stops
 * at a 2-unit bracket and rounds, so a re-measure of unchanged data can move
 * by a unit or two without anything having changed.
 */
export function drift(found, tol = 4) {
  const out = [];
  for (const id of ids) {
    for (const [slot, range] of Object.entries(found[id])) {
      const stored = DEFS[id].moves[slot].range;
      if (Math.abs(stored - range) > tol) out.push({ id, slot, stored, measured: range });
    }
  }
  return out;
}

// Imported for measure() and drift(); everything below is the command line.
if (!process.argv[1]?.endsWith('ranges.mjs')) { /* imported */ } else {
const DRY = process.argv.includes('--dry');
const CHECK = process.argv.includes('--check');
const found = measure((id, row) => {
  console.log(`${id}  ` + Object.entries(row).map(([s, v]) => `${s} ${v}`).join('  '));
});

if (CHECK) {
  const bad = drift(found);
  for (const d of bad) console.log(`  ! ${d.id} ${d.slot}: stored ${d.stored}, reaches ${d.measured}`);
  console.log(`\n${bad.length ? `${bad.length} stored range(s) out of date` : 'every stored range matches'}`);
  process.exit(bad.length ? 1 : 0);
}

let written = 0;
for (const id of ids) {
  const file = `src/data/${id}.js`;
  let src = fs.readFileSync(file, 'utf8');
  for (const [slot, range] of Object.entries(found[id])) {
    const at = src.indexOf(`${slot}: `);
    const end = src.indexOf('}),', at);
    const block = src.slice(at, end);
    const next = /\n(\s*)strikePart: '([a-zA-Z]+)', reach: (\d+),(\s*range: \d+,)?/.exec(block);
    if (!next) { console.log(`  ! ${id} ${slot}: no reach line to anchor on`); continue; }
    const replaced = block.replace(next[0],
      `\n${next[1]}strikePart: '${next[2]}', reach: ${next[3]}, range: ${range},`);
    src = src.slice(0, at) + replaced + src.slice(end);
    written++;
  }
  if (!DRY) fs.writeFileSync(file, src);
}
console.log(`\n${written} move ranges ${DRY ? 'measured (dry run)' : 'written'}`);
}

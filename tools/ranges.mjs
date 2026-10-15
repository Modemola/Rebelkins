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
 *   node tools/ranges.mjs [--dry]
 */

import fs from 'node:fs';
import { Rig } from '../src/render/rig.js';
import { Match } from '../src/fight/match.js';
import { byId } from '../src/data/weapons.js';

const DRY = process.argv.includes('--dry');
const ids = ['kin01', 'kin02', 'kin03', 'kin04', 'kin05', 'kin06', 'kin07', 'kin08', 'kin09', 'kin10'];
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
  const m = new Match(DEFS[attacker], DEFS.kin06, rigs, [bare, bare]);
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

const found = {};
for (const id of ids) {
  found[id] = {};
  for (const slot of ['light', 'heavy', 'special']) {
    if (!DEFS[id].moves[slot]) continue;
    let lo = 60;
    let hi = 340;
    if (!connects(id, slot, lo)) { found[id][slot] = 0; continue; }
    while (hi - lo > 2) {
      const mid = (lo + hi) / 2;
      if (connects(id, slot, mid)) lo = mid; else hi = mid;
    }
    found[id][slot] = Math.round(lo);
  }
  console.log(`${id}  ` + Object.entries(found[id]).map(([s, v]) => `${s} ${v}`).join('  '));
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

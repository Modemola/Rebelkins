/**
 * Door solvability check.
 *
 * Every gated zone in every contract must be openable by a Kin the player
 * actually has when that contract comes up in the build order. A door nobody
 * can open is not difficulty, it is a dead run, and the maths that produces one
 * is invisible until someone plays for ten minutes and gets stuck.
 *
 *   node tools/verify-doors.mjs [--verbose]
 */

import { KIN, BUILD_ORDER, getKin } from '../src/data/kin.js';
import { MISSIONS, NIGHT, getDistrict } from '../src/data/missions.js';
import { compilePacket, readDoor } from '../src/systems/thread.js';

const VERBOSE = process.argv.includes('--verbose');

/** Access/tag bonuses a Thread's own ability can add mid-run. */
const ABILITY_BOOST = {
  glasscoat: { access: 2, tags: ['luxury', 'holo'] },
  olddoor: { access: 2, tags: ['folk'] },
};

/** Who is on the roster by the time each contract in the night comes up. */
function rosterFor(missionIndex) {
  // Start with two, and each cleared contract unlocks the next in build order.
  return BUILD_ORDER.slice(0, Math.min(BUILD_ORDER.length, 2 + missionIndex));
}

function inside(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

/**
 * @param zone the zone being tested. A rack standing inside that zone cannot be
 *   part of getting into it -- that is a circular solution, and the checker
 *   exists precisely to catch the ones a person would miss.
 */
function optionsFor(kin, thread, mission, zone) {
  const opts = [{ label: 'as compiled', access: 0, tags: [], desire: 0 }];

  const boost = ABILITY_BOOST[thread.ability.id];
  if (boost) {
    opts.push({ label: `+ ${thread.ability.name}`, access: boost.access, tags: boost.tags, desire: 0 });
  }
  for (const p of mission.props || []) {
    if (!p.grants) continue;
    if (inside(p.x, p.y, zone.rect)) continue;
    opts.push({
      label: `+ ${p.label.toLowerCase()}`,
      access: p.grants.access, tags: p.grants.tags, desire: 2,
    });
    if (boost) {
      opts.push({
        label: `+ ${p.label.toLowerCase()} + ${thread.ability.name}`,
        access: p.grants.access + boost.access,
        tags: [...p.grants.tags, ...boost.tags],
        desire: 2,
      });
    }
  }
  // Too Much's burst is the only desirability ability in the roster.
  if (thread.ability.id === 'toomuch') {
    for (const o of [...opts]) opts.push({ ...o, label: `${o.label} + Too Much`, desire: o.desire + 6 });
  }
  return opts;
}

let failures = 0;
let checked = 0;

for (const missionId of NIGHT) {
  const idx = NIGHT.indexOf(missionId);
  const mission = MISSIONS.find((m) => m.id === missionId);
  const district = getDistrict(mission.district);
  const roster = rosterFor(idx);

  console.log(`\n${mission.name}`);
  console.log(`  roster by now: ${roster.join(', ')}`);

  const gated = mission.zones.filter((z) => z.access > 0 || (z.wants && z.wants.length) || z.minDesire);
  for (const zone of gated) {
    checked++;
    const solutions = [];
    for (const kinId of roster) {
      const kin = getKin(kinId);
      for (const thread of kin.threads) {
        const base = compilePacket(kin, thread, { district, licenses: new Set(), overlays: new Set() });
        for (const opt of optionsFor(kin, thread, mission, zone)) {
          const packet = {
            ...base,
            access: Math.min(4, base.access + opt.access),
            tags: [...base.tags, ...opt.tags],
            desirability: base.desirability + opt.desire,
          };
          if (readDoor(packet, zone).open) {
            solutions.push(`${kin.codename} / ${thread.name} ${opt.label}`);
          }
        }
      }
    }
    if (!solutions.length) {
      failures++;
      console.log(`  ✗ ${zone.name} — NO ROSTER SOLUTION `
        + `(access ${zone.access}, wants ${(zone.wants || []).join('/') || 'any'}, `
        + `minDesire ${zone.minDesire ?? 0})`);
    } else {
      console.log(`  ✓ ${zone.name} — ${solutions.length} way(s) in`);
      if (VERBOSE) for (const s of solutions.slice(0, 6)) console.log(`      ${s}`);
      else console.log(`      e.g. ${solutions[0]}`);
    }
  }
}

console.log(`\n${checked} gated zone(s) checked, ${failures} unsolvable.`);
if (failures) {
  console.error('FAIL: a contract cannot be completed with the roster available at that point.');
  process.exit(1);
}
console.log('PASS');

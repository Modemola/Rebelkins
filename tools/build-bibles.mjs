/**
 * Writes docs/CHARACTER_BIBLES.md from the game's own data.
 *
 * The bible and the build must not drift, so the prose is generated from the
 * same modules the game loads. If a stat changes in src/data/kin.js, this
 * regenerates the document rather than asking anyone to remember.
 *
 *   node tools/build-bibles.mjs [--check]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KIN, STAT_KEYS, BUILD_ORDER } from '../src/data/kin.js';
import {
  SHOT_LISTS, PRODUCTION_RULE, FOLDER_TREE, DRIP_LIBRARY, CITY_PLATES, PLATE_SPINE,
} from '../src/data/shotlists.js';

const STAT_BLURB = {
  presence: 'how hard cameras lock on',
  ignore: 'how easy it is to be socially unseen',
  compile: 'how fast they rewrite a Thread mid-run',
  mobility: 'movement kit',
  brk: 'fight / style-break power',
  crowd: 'how fast civilians copy or protect them',
  heatCap: 'how much fame they can hold before the district slams the door',
  bond: 'how well they sync with crew and vehicles',
};

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs', 'CHARACTER_BIBLES.md');

const L = [];
const w = (s = '') => L.push(s);

w('# REBELKIN: THREAD WAR — Character Bibles');
w();
w('> Generated from `src/data/kin.js` and `src/data/shotlists.js` by');
w('> `node tools/build-bibles.mjs`. Edit the data, not this file.');
w();
w('The visual law: **3D from far away, drawn when you lean in. Attitude first.**');
w('Clothes are the kit.');
w();

w('## Shared stat sheet');
w();
w('Every Kin uses the same 8 stats, 1–10.');
w();
w('| Stat | What it decides |');
w('| --- | --- |');
for (const [key, label] of STAT_KEYS) {
  w(`| ${label} | ${STAT_BLURB[key]} |`);
}
w();
w('A **Thread** is a loadout: clothes + item + shoes + hair effect. Swapping a');
w('Thread takes about 3 seconds, scaled by Compile.');
w();

w('## Build order');
w();
w('Do not build twenty characters. Build these six, in this order — it teaches');
w('the game: noise, silence, split attention, stolen identity, escape, crowd magic.');
w();
BUILD_ORDER.forEach((id, i) => {
  const k = KIN.find((x) => x.id === id);
  w(`${i + 1}. **${k.codename}** — ${k.role}`);
});
w();

w('---');
w();

for (const kin of KIN) {
  w(`## ${kin.codename}`);
  w();
  w(`**True name:** ${kin.trueName}  `);
  w(`**Role:** ${kin.role}  `);
  w(`**Species:** ${kin.species}  `);
  w(`**Subject count:** ${kin.subjects}`);
  w();
  w('### Why they exist');
  w();
  w(kin.why);
  w();
  w('### Stats');
  w();
  w('| ' + STAT_KEYS.map(([, l]) => l).join(' | ') + ' |');
  w('| ' + STAT_KEYS.map(() => '---').join(' | ') + ' |');
  w('| ' + STAT_KEYS.map(([k]) => kin.stats[k]).join(' | ') + ' |');
  if (kin.split) {
    w();
    w(`Treat them as one unit with a split — Presence ${kin.split.presence.join(' / ')}, `
      + `Ignore ${kin.split.ignore.join(' / ')}.`);
  }
  w();
  w('### Voice');
  w();
  w(kin.voice);
  w();
  for (const line of kin.lines) w(`> “${line}”`);
  w();
  w('### Personality / stance');
  w();
  w(`**${kin.personality}** — ${kin.stance}`);
  w();
  w('### Starter Threads');
  w();
  kin.threads.forEach((t, i) => {
    w(`**Thread ${'ABC'[i]} — ${t.name}**  `);
    w(`${t.fit}  `);
    w(`*Tags:* ${t.tags.join(', ')} · *Access:* ${t.access}  `);
    w(`*Effect:* ${t.ability.desc}`);
    w();
  });
  w('### How they play');
  w();
  w(kin.play);
  w();
  w('### Shot-by-shot image brief');
  w();
  SHOT_LISTS[kin.id].forEach((shot, i) => w(`${i + 1}. ${shot}`));
  w();
  w('---');
  w();
}

w('## The reference wall');
w();
w('### Production rule for all images');
w();
for (const r of PRODUCTION_RULE) w(`- ${r}`);
w();
w('### The 15-plate spine');
w();
w('Every hero Kin gets the same fifteen plates, so a missing plate is visible');
w('instead of forgotten. No character is done until the shoe plate and the');
w('attitude plate both work at thumbnail size.');
w();
PLATE_SPINE.forEach((p, i) => w(`${i + 1}. ${p}`));
w();
w('### Folder tree');
w();
w('```');
for (const f of FOLDER_TREE) w(f);
w('```');
w();
w('### Material and drip library');
w();
w('More important than the body:');
w();
for (const d of DRIP_LIBRARY) w(`- ${d}`);
w();
w('### City and lighting plates');
w();
w('Match the characters, not generic cyberpunk:');
w();
for (const c of CITY_PLATES) w(`- ${c}`);
w();

const md = L.join('\n');

if (process.argv.includes('--check')) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (current !== md) {
    console.error('docs/CHARACTER_BIBLES.md is stale. Run: node tools/build-bibles.mjs');
    process.exit(1);
  }
  console.log('docs/CHARACTER_BIBLES.md is up to date');
} else {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, md);
  console.log(`wrote ${path.relative(ROOT, OUT)} (${KIN.length} Kin, ${md.split('\n').length} lines)`);
}


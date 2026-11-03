/**
 * Copy a freshly built rig's atlas coordinates into its character file.
 *
 * `tools/rig.mjs` shelf-packs the parts, so changing any one polygon can move
 * every other part in the atlas -- tighten the head and the shins, the torso
 * and both forearms all slide. The character file holds those coordinates as
 * literals, and nothing checks them: a stale rect does not throw, it draws the
 * wrong rectangle of the sheet, which looks like a rigging mistake and is not
 * one. Transcribing them by hand after each rebuild is how that happens.
 *
 *   node tools/rigsync.mjs <built/rig.json> <src/data/x.js> [--check]
 *
 * `--check` reports a difference and exits non-zero without writing, so a
 * build can fail on a character file that drifted from its atlas.
 */

import fs from 'node:fs';

const [rigPath, jsPath] = process.argv.slice(2);
const CHECK = process.argv.includes('--check');
if (!rigPath || !jsPath) {
  console.error('usage: node tools/rigsync.mjs <built/rig.json> <src/data/x.js> [--check]');
  process.exit(2);
}

const rig = JSON.parse(fs.readFileSync(rigPath, 'utf8'));
const js = fs.readFileSync(jsPath, 'utf8');

const line = (p) => `    { name: '${p.name}', parent: ${p.parent ? `'${p.parent}'` : 'null'}, `
  + `z: ${p.z}, rect: [${p.rect.join(', ')}], pivot: [${p.pivot.join(', ')}], `
  + `origin: [${p.origin.join(', ')}]`
  + (p.limits ? `, limits: { rot: [${p.limits.rot.join(', ')}] }` : '')
  + ' },';

const body = rig.parts.map(line).join('\n');

/**
 * The parts array is found by its delimiters rather than parsed, because the
 * character file is hand-written code with comments in it that are worth more
 * than the convenience of generating the whole thing.
 */
const open = js.indexOf('  parts: [');
if (open < 0) throw new Error(`${jsPath} has no "  parts: [" to replace`);
const close = js.indexOf('\n  ],', open);
if (close < 0) throw new Error(`${jsPath}'s parts array is not closed by "\\n  ],"`);
const next = `${js.slice(0, open)}  parts: [\n${body}${js.slice(close)}`;

if (next === js) { console.log(`${jsPath} already matches ${rigPath}`); process.exit(0); }
if (CHECK) {
  const was = js.slice(open, close).split('\n');
  const now = next.slice(open, next.indexOf('\n  ],', open)).split('\n');
  console.error(`${jsPath} is out of date with ${rigPath}:`);
  for (let i = 0; i < Math.max(was.length, now.length); i++) {
    if (was[i] !== now[i]) console.error(`  was ${was[i]?.trim() ?? '(nothing)'}\n  now ${now[i]?.trim() ?? '(nothing)'}`);
  }
  process.exit(1);
}
fs.writeFileSync(jsPath, next);
console.log(`${jsPath}: ${rig.parts.length} parts synced from ${rigPath}`);

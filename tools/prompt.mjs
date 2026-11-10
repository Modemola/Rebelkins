/**
 * Print one character's art prompt, assembled from the brief rather than
 * copied out of it.
 *
 * ART-BRIEF-SIDE.md runs to several hundred lines and most of it is
 * reasoning -- why a rule exists, which earlier version of it was wrong,
 * what the numbers were on the sheets that failed. That reasoning is the
 * point of the file and it is also what makes it a bad thing to hand someone
 * who just needs to generate an image. The alternative, pasting the prompt
 * into a second file by hand, is how the two drift apart: a rule gets
 * corrected in the brief and the copy keeps asking for the thing that was
 * wrong.
 *
 * So this reads §3, §5 and the §7 table out of the brief itself, substitutes
 * the named character, and writes the paste-ready version. The brief stays
 * the only place a rule is written down.
 *
 *   node tools/prompt.mjs kin06 [--out NEXT.md]
 *   node tools/prompt.mjs kin01 kin02 kin03 --out NEXT.md
 *   node tools/prompt.mjs --rest --out NEXT.md     (every one not yet built)
 *   node tools/prompt.mjs --list
 *   node tools/prompt.mjs --rest --check NEXT.md  (has it drifted?)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BRIEF = path.join(ROOT, 'ART-BRIEF-SIDE.md');
const arg = (f, d) => (process.argv.includes(f) ? process.argv[process.argv.indexOf(f) + 1] : d);
const OUT = arg('--out', null);
const CHECK = arg('--check', null);
const flagArgs = new Set(['--out', '--check']);
const named = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && !flagArgs.has(all[i - 1]));
const REST = process.argv.includes('--rest');

const brief = fs.readFileSync(BRIEF, 'utf8');
const lines = brief.split('\n');

/** The body of a numbered section, by its heading number. */
function section(n) {
  const start = lines.findIndex((l) => l.startsWith(`## ${n}.`));
  if (start < 0) throw new Error(`the brief has no section ${n} -- was it renumbered?`);
  let end = lines.findIndex((l, i) => i > start && /^## \d+\./.test(l));
  if (end < 0) end = lines.length;
  return lines.slice(start + 1, end);
}

/** The block quote inside a section, with its '> ' markers stripped. */
function quoted(n) {
  const body = section(n).filter((l) => l.startsWith('>'));
  if (!body.length) throw new Error(`section ${n} has no block quote`);
  return body.map((l) => l.replace(/^> ?/, '')).join('\n').trim();
}

/** The §7 table, as { kin06: { character, style, stance } }. */
function roster() {
  const out = {};
  for (const l of section(7)) {
    const m = l.match(/^\|\s*\*\*(KIN \d+)\*\*\s*\|(.+?)\|(.+?)\|(.+?)\|\s*$/);
    if (!m) continue;
    out[m[1].toLowerCase().replace(' ', '')] = {
      name: m[1], character: m[2].trim(), style: m[3].trim(), stance: m[4].trim(),
    };
  }
  if (!Object.keys(out).length) throw new Error('found no characters in section 7');
  return out;
}

const cast = roster();
/** A character is done when its side-view rig is in the repo. */
const built = (k) => fs.existsSync(path.join(ROOT, 'rigs/side', `${k.replace(/^kin/, 'kin')}.json`));

if (process.argv.includes('--list') || (!named.length && !REST)) {
  for (const [k, v] of Object.entries(cast)) {
    console.log(`  ${k}  ${v.name} -- ${v.style}${built(k) ? '   (built)' : ''}`);
  }
  // Naming nothing at all is a usage error; asking for the list is not.
  process.exit(process.argv.includes('--list') ? 0 : 1);
}

const ids = REST ? Object.keys(cast).filter((k) => !built(k)) : named.map((n) => n.toLowerCase());
for (const id of ids) if (!cast[id]) { console.error(`no such character "${id}"; try --list`); process.exit(1); }
if (!ids.length) { console.log('every character in the table already has a side-view rig'); process.exit(0); }

/**
 * The style word ("bruiser", "ghost") is deliberately left out of the subject
 * line, and the character's stance flavour is placed *inside* the stance
 * paragraph rather than near it.
 *
 * Both for the same reason. KIN 06's first sheet came back with the feet
 * planted square because his note said "wide and planted" and a note standing
 * on its own is read as the more specific instruction, so it beat the stance
 * paragraph it contradicted. Subordinating it to that paragraph -- same
 * sentence, after the rules, introduced as a variation on them -- is what
 * stops it being read as an override. Dropping the style word costs nothing:
 * it never described anything the drawing shows.
 */
function promptFor(c) {
  return quoted(3)
    .replace(/\{CHARACTER\}/g, c.character)
    .replace(/\n\n\*\*Arms:\*\*/, `\n>\n> Within that stance, this character is ${c.stance}.\n\n**Arms:**`)
    .replace(/^>\n> /m, '\n');
}
const refFor = (id) => ['assets/cutouts/v2', 'assets/cutouts']
  .map((d) => path.join(d, `${id}.png`))
  .find((f) => fs.existsSync(path.join(ROOT, f)));

const many = ids.length > 1;
const title = many
  ? `# Generate the remaining ${ids.length} — side view`
  : `# Generate ${cast[ids[0]].name} — side view`;

const head = `${title}

${many
  ? `${ids.length} images, same prompt each time with one paragraph changed. Send
them as they come or all together — I measure each before doing anything
with it.`
  : 'One image.'}

1. Attach the character's existing art as the reference image (named under
   each one below).
2. Paste that character's prompt, and the negative prompt at the end, which
   is the same for all of them.
3. Send me whatever comes back — I check it before doing anything else.

**Take only the character from the reference — the clothes, the hair, the
face, the shoes. Not the pose, and not the camera.** Every reference is a
front-on figure with its feet planted wide and level, which is the exact
thing this pass exists to replace. Three of the first four sheets came back
copying that stance.
`;

const sections = ids.map((id) => {
  const c = cast[id];
  return `\n---\n\n## ${c.name}\n\nReference image: \`${refFor(id) ?? `the existing ${c.name} art`}\`\n\n${promptFor(c)}\n`;
}).join('');

const doc = `${head}${sections}
---

## Negative prompt — the same for every one

${quoted(5)}

---

## What happens when you send one

I run \`node tools/sidecheck.mjs\` on it first — the file as delivered, WebP or
PNG, about a second. It measures how far apart the feet are across the
picture as a percentage of the figure's height, which is the one number that
separates a side view from a front view dressed up as one:

| | gap | verdict |
|---|---|---|
| KIN 06, third try | 17.4% | accepted, built and animated |
| KIN 09 | 21.0% | accepted, reads side-on |
| KIN 06, first try | 33.0% | rejected |
| KIN 06, second try | 36.5% | rejected |

Under 26% passes. If one fails I will say so in a line and you regenerate
that character — nothing else about the image matters until that number is
right, and I would rather you throw away four generations than I spend an
hour rigging a figure that cannot kick. No need to look closely yourself
first; send the first thing it gives you.

Each one that passes is about an hour on my side: key the background out,
hand-place the joints, build the mesh, wire up the three moves. You get it
back as a GIF of them actually moving.

*Generated from ART-BRIEF-SIDE.md §3, §5 and §7 by
\`node tools/prompt.mjs ${REST ? '--rest' : ids.join(' ')}\`. Edit the brief, not this file.*
`;

/**
 * The handout is derived, and derived files in this project have gone stale
 * twice with nothing to say so -- the atlas rects a repack moved, the move
 * ranges a formula change invalidated. Both were found by accident.
 *
 * This one has two ways to drift. A rule gets corrected in the brief and the
 * handout keeps asking for the thing that was wrong; or a character gets
 * built and `--rest` is one shorter than the file still listing them. The
 * second is the likely one, because building a character is exactly when
 * nobody is thinking about the handout.
 */
if (CHECK) {
  const have = fs.existsSync(path.join(ROOT, CHECK)) ? fs.readFileSync(path.join(ROOT, CHECK), 'utf8') : null;
  if (have === doc) {
    console.log(`${CHECK} matches the brief (${ids.length}: ${ids.map((i) => cast[i].name).join(', ')}).`);
    process.exit(0);
  }
  if (have === null) console.error(`${CHECK} does not exist.`);
  else {
    const a = have.split('\n'); const b = doc.split('\n');
    const at = a.findIndex((l, i) => l !== b[i]);
    console.error(`${CHECK} has drifted from the brief, from line ${at + 1}:`);
    console.error(`  file:  ${JSON.stringify(a[at] ?? '(end of file)')}`);
    console.error(`  brief: ${JSON.stringify(b[at] ?? '(end of file)')}`);
  }
  console.error(`regenerate it: node tools/prompt.mjs ${REST ? '--rest' : ids.join(' ')} --out ${CHECK}`);
  process.exit(1);
}
if (OUT) {
  fs.writeFileSync(path.join(ROOT, OUT), doc);
  console.log(`wrote ${OUT} for ${ids.map((i) => cast[i].name).join(', ')}`);
} else {
  process.stdout.write(doc);
}

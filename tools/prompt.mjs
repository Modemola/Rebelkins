/**
 * Print one character's art prompt, assembled from the brief rather than
 * copied out of it.
 *
 * ART-BRIEF-SIDE.md is 430 lines and most of it is reasoning -- why a rule
 * exists, which earlier version of it was wrong, what the numbers were on the
 * sheets that failed. That reasoning is the point of the file and it is also
 * what makes it a bad thing to hand someone who just needs to generate an
 * image. The alternative, pasting the prompt into a second file by hand, is
 * how the two drift apart: a rule gets corrected in the brief and the copy
 * keeps asking for the thing that was wrong.
 *
 * So this reads §3, §5 and the §7 table out of the brief itself, substitutes
 * the named character, and writes the paste-ready version. The brief stays
 * the only place a rule is written down.
 *
 *   node tools/prompt.mjs kin06 [--out NEXT.md]
 *   node tools/prompt.mjs --list
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BRIEF = path.join(ROOT, 'ART-BRIEF-SIDE.md');
const arg = (f, d) => (process.argv.includes(f) ? process.argv[process.argv.indexOf(f) + 1] : d);
const OUT = arg('--out', null);
const who = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2].toLowerCase() : null;

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
if (!who || process.argv.includes('--list')) {
  console.log(Object.entries(cast).map(([k, v]) => `  ${k}  ${v.name} -- ${v.style}`).join('\n'));
  process.exit(who ? 0 : 1);
}
const c = cast[who];
if (!c) { console.error(`no such character "${who}"; try --list`); process.exit(1); }

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
const prompt = quoted(3)
  .replace(/\{CHARACTER\}/g, c.character)
  .replace(/\n\n\*\*Arms:\*\*/, `\n>\n> Within that stance, this character is ${c.stance}.\n\n**Arms:**`)
  .replace(/^>\n> /m, '\n');
const negative = quoted(5);

const ref = ['assets/cutouts/v2', 'assets/cutouts']
  .map((d) => path.join(d, `${who}.png`))
  .find((p) => fs.existsSync(path.join(ROOT, p)));

const doc = `# Generate ${c.name} — side view

**One image, then stop.** Not the whole set.

1. Attach \`${ref ?? `the existing ${c.name} art`}\` as the reference image.
2. Paste the prompt below, and the negative prompt below that.
3. Send me whatever comes back — I check it before doing anything else.

**Take only the character from the reference — the jacket, the hair, the
face, the boots. Not the pose, and not the camera.** The reference is a
front-on figure with its feet planted wide and level, which is the exact
thing this pass exists to replace. Three sheets so far have come back
copying that stance.

---

## Prompt

${prompt}

---

## Negative prompt

${negative}

---

## What happens when you send it

I run \`node tools/sidecheck.mjs\` on it first — the file as delivered, WebP or
PNG, about a second. It measures how far apart the feet are across the
picture as a percentage of the figure's height, which is the one number that
separates a side view from a front view dressed up as one:

| | gap | verdict |
|---|---|---|
| KIN 09 | 21.3% | accepted, reads side-on |
| KIN 06, first try | 33.0% | rejected |
| KIN 06, second try | 37.5% | rejected |

Under 26% passes. If it fails I will tell you in one line and you regenerate
— nothing else about the image matters until that number is right, and I would
rather you throw away four generations than I spend an hour rigging a figure
that cannot kick. No need to look closely at it yourself first; send the first
one it gives you.

If it passes, that is about an hour of work on my side: key the background
out, hand-place the joints, build the mesh, wire up his three moves. You get
it back as a GIF of him actually moving, and only then do we generate the
other eight.

*Generated from ART-BRIEF-SIDE.md §3, §5 and §7 by \`node tools/prompt.mjs ${who}\`.
Edit the brief, not this file.*
`;

if (OUT) {
  fs.writeFileSync(path.join(ROOT, OUT), doc);
  console.log(`wrote ${OUT} for ${c.name}`);
} else {
  process.stdout.write(doc);
}

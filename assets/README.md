# Dropping in artwork

The game renders real art the moment it finds it. Nothing to wire up, no JSON to
edit, no canvas size to match.

## The whole workflow

1. Put transparent PNG cutouts in `assets/kin/<id>/`.
2. Run `node tools/scan-assets.mjs`.
3. Reload the page.

Kin ids are `spark`, `softlock`, `driver`, `mirror`, `folkglitch`, `pair`.

Any Kin without art keeps rendering the procedural placeholder, so you can add
one character at a time and the game stays playable throughout.

## Plate names

Name the files after what the plate *is*. Only `front.png` is really needed —
everything else improves on it.

| File | What it is | Used for |
| --- | --- | --- |
| `front.png` | standing, facing camera | everything, and the fallback for every other plate |
| `walk-1.png`, `walk-2.png`, … | walk cycle frames | played back while moving; any number of frames |
| `side.png` | profile | walking left or right (mirrored automatically — only export one side) |
| `back.png` | from behind | walking away from camera |
| `runway.png` | hero pose | the extraction walk |
| `portrait.png` | chest-up | menus, crew select, the bible screen |

Extra files are recorded but never auto-selected, so reference plates can sit in
the same folder without breaking anything.

## What the scanner does for you

Cutouts arrive at whatever size they were exported at, with whatever empty space
happens to be around them. You should not have to care, so the scanner:

- **Trims the transparent margin.** It records the tight bounding box and the
  renderer crops to it, so padding in the export costs nothing.
- **Normalises height.** A plate exported at 4000px and one at 500px stand the
  same height in game. Relative stature comes from `look.height` in
  `src/data/kin.js` — Driver is short, Mirror is a long vertical line.
- **Finds the ground line.** It reads the centre of mass of the bottom few rows
  rather than assuming bottom-centre, so a Kin caught mid-stride or leaning still
  plants correctly instead of sliding or floating.

## Requirements, and what goes wrong without them

- **Real transparency.** A background baked into the image means the character
  renders inside a visible rectangle. The scanner detects this and says so
  rather than letting you find out on screen.
- **8-bit PNG, not interlaced.** The scanner reports both clearly if not.
- **Feet at the bottom of the visible pixels.** Cropping the feet off makes the
  anchor land in the wrong place.
- **Consistent framing within a Kin.** Plates for the same character should be
  shot at the same relative scale, or they will pop between frames.

Resolution is up to you — it is downscaled to the size the camera needs. Around
1000px tall is plenty; more costs load time and nothing else.

## Checking it worked

`node tools/scan-assets.mjs --verbose` prints every plate it found, what it
trimmed to and where it put the anchor, plus what is still missing per Kin.

The browser console also logs which plates loaded, and warns per file if one
fails.

`node tools/test-assets.mjs` proves the measurement maths against generated
fixtures — run it if anchoring or scaling ever looks wrong.

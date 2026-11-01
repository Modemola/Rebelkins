# REBELKIN — what resolution the character sheets need

Short answer: **1536 pixels tall**, PNG, with the figure filling about 88% of
that. The rest of this is why, so the number is checkable rather than taken on
trust.

---

## The number

| | |
|---|---|
| **Canvas height** | **1536 px** (minimum 1280, no benefit above 2048) |
| **Canvas width** | whatever the figure needs — about 1024 for these proportions. Do not pad with empty background to hit a square. |
| **Figure height within it** | about 88% of canvas height, so roughly **1350 px** from the top of the hair to the soles of the boots |
| **Format** | PNG. Not JPEG. |

Everything delivered so far has been **488 px tall**, with the figure about
431 of that.

---

## Why 1536

The drawing is not a reference image. It is loaded directly as the character's
texture and drawn to the screen, so its resolution *is* the character's
resolution in the game. Anything smaller than the on-screen size is being
magnified, and magnified art looks soft.

Measured on the actual renderer, with the real camera, this is how tall a
fighter stands in **device pixels**:

| display | device pixel ratio | fighter height on screen |
|---|---|---|
| phone, 390×844 | 3 | 749 px |
| laptop, 1280×800 | 2 | 957 px |
| tablet, 834×1112 | 2 | 1010 px |
| desktop, 1920×1080 | 2 | 1296 px |
| large desktop, 2560×1440 | 2 | 1337 px |

So the figure needs to be about **1350 pixels tall in the drawing** for the
worst case to be drawn at 1:1 with no magnification at all. At 88% of the
canvas, that is a canvas 1536 tall.

**What we have now is 431.** On a desktop that is being blown up 3.1×, which
is exactly why the characters look soft, and it is not something the renderer
can improve — the detail was never in the file.

### Why not larger

Above about 2048 the extra pixels are never seen on any display anyone will
use, and texture memory is real: ten characters at 1024×1536 is around 63 MB
of decoded image. 2048-tall sheets would double that for nothing. If a
generator only offers 1024 or 2048, **take 2048** and I will downscale — too
much detail is a problem I can solve, too little is not.

### Why PNG and not JPEG

The background is removed by flood-filling inward from the edges. JPEG puts
ringing artefacts along every high-contrast edge, which is precisely where the
character meets the background, and the keyer either eats into the figure or
leaves a halo of background welded to it. PNG has no such artefacts. The
current files are PNG; keep them that way.

### One thing that gets worse at higher resolution

Generators sometimes add faint texture, grain or a soft gradient to a
background at larger sizes, where at small sizes they leave it flat. The keyer
needs the backdrop genuinely flat and even. If a 1536 render comes back with a
mottled or vignetted background, that is worth a regeneration even if the
character on it is perfect — a flat 1024 beats a noisy 1536.

---

## How to check it

Open the file and read its pixel dimensions. If the height starts with a 4,
it is the old size. It should start with a 1 and have four digits.

That is the whole check. It has been asked for five times and missed five
times, which suggests it is an output-size setting in the generator rather
than anything the prompt can fix — so it is worth finding that setting once,
before the other nine are made, rather than regenerating them all later.

# Art direction

Derived from the collection's own artwork, not from a description of it. This is
the spec the placeholder renderer implements and the target that dropped-in
plates should match.

## The correction this document exists to record

The first pass read *"3D from far away, drawn up close"* as **smooth gradient
volumes**, and produced characters that looked like vinyl toys. That was wrong at
the root. The reference is **cel-shaded anime with heavy black linework**:

- Form is described by a **hard-edged shadow shape**, never by a blend.
- The **line is structural**, not a detail that fades in at high zoom.

Those two together are what make the rule true at both distances. The shadow
gives the volume you read from across the room; the line keeps it *drawn* when
you lean in. A gradient gives you the first and destroys the second.

## Rules

### Shading

Two tones per mass. Base fill, one hard shadow, no midtones, no soft falloff.

Light sits upper-left, so shadow falls down-right. In code the shadow is the
same silhouette offset toward the shadow corner and clipped to the original —
cheap, and it cannot disagree with the form it is shading.

Shadows shift **toward violet, not toward grey**. Desaturated shadow is what
makes cel shading look muddy; this art keeps its chroma in the dark.

Hair takes an additional **hard highlight band** on the light side. It is the
strongest value contrast on the character and it is what makes hair read as hair
rather than as a coloured helmet.

### Line

Near-black (`#17101f`), not pure black. Heavy and confident. Every separable
mass is outlined: hair, skull, torso, each limb, each shoe, each accessory.

Line weight thins with distance but **never disappears**. A Kin at 20px is still
an outlined shape.

### Colour

Saturated and loud. Not tasteful, not muted, no pastel-washing. Magenta, cyan,
lime, hot yellow, orange, violet — several of them on the same character at
once, fighting.

Skin is warm and light enough that the linework reads against it.

### Proportion

Not chibi. Roughly **five heads tall** — stylised anime, with legs long enough
to carry a pose and a torso long enough to hang clothes on. That last part
matters more here than in most games, because clothes are the mechanic.

Build changes the *skeleton*, not just the palette: Driver is short and round,
Mirror is a long vertical line, Folk Glitch is a wide grounded triangle. A
roster where every body is the same shape has already failed.

### The face

The face is the character, and it carries more of the read than the outfit does.

Anime construction: large sclera, dark iris, one hard white highlight, and a
**thick upper lash line** heavier than the rest of the eye.

Every expression moves **eyes, brows and mouth together**. Moving one alone
reads as a glitch rather than a feeling.

Mouths open. A shout is a filled dark shape with a white teeth band and a
tongue — not a curved line. This single thing does more for "attitude first"
than any amount of costume detail.

Nobody stands there blank. Each Kin has a resting attitude:

| Kin | Resting face |
| --- | --- |
| Spark | shouting — mid-yell, eyes squeezed |
| Soft Lock | averted — lids low, looking away |
| Driver | rage — flat-topped angry eyes, scowl in the lid |
| Mirror | cold — open, level, unimpressed |
| Folk Glitch | smug |
| The Pair | Juno loud, Moss quiet, in one frame |

### Accessory density

A clean character is the wrong read. Hair clips, bows, chains, beads, face
paint, striped sleeves, laces, seatbelts worn as costume.

But density has a floor: at gameplay size (~150px tall, ~40px head), five tiny
clips are five grey smudges. **Fewer and larger** survives; more and smaller does
not. The same applies to fishnets and fine patterning — they are authored, but
gated to close-up detail levels only.

### Silhouette

Readable at 64px, before any colour. Each Kin is a different *shape*:

| Kin | Silhouette |
| --- | --- |
| Spark | twin buns with bows, wide at the top |
| Soft Lock | one big round hood, no neck |
| Driver | low and round, crest, shoes too big for it |
| Mirror | tall vertical line, coat flare |
| Folk Glitch | wide grounded triangle |
| The Pair | two bodies, one composition |

## Layer order

Getting this wrong is invisible in code and obvious on screen — hair drawn after
the face buries the eyes, which is exactly what a blank-looking Kin is.

```
contact shadow
legs → shoes
skirt / overlayer
torso → torso graphics (holo seams, seatbelt)
arms → hands
belt / beads
neck
BACK HAIR          ← behind the skull, gives the head its outline
SKULL
FACE PAINT → FACE → face marks
FRONT HAIR         ← fringe, buns, spikes. stays above the brow line.
```

## Where the placeholder stops

The procedural renderer in `src/art/kinart.js` implements every rule above, and
it still will not look like the reference. Hand-drawn confidence, line quality
and rendering are not reachable from vector code, and chasing them is not a good
use of anyone's time.

What the placeholder is *for* is that a half-arted roster does not look broken:
a Kin without plates should read as the same world as the Kin beside it that has
them. That is achievable, and it is the bar this code is held to.

Real plates replace it per character the moment they exist — see
[`assets/README.md`](../assets/README.md).

## A note on the group shot

A composed group illustration is direction, not assets. Characters overlap, sit
in perspective, and are cropped at the waist, so cutting sprites out of one
produces worse results than the placeholder it would replace.

What it *is* good for is exactly what this document did with it: fixing the
shading model, the proportions, the face construction and the palettes. Those
were all wrong before it arrived.

The pipeline still needs per-character cutouts on transparent backgrounds,
framed consistently per Kin.

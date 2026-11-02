# REBELKIN — side-view character sheet brief

**This replaces every earlier brief, ART-RESOLUTION.md included. Use only
this file.**

Ten characters, one image each. Everything here is load-bearing for the
rigger; where a rule looks arbitrary, the reason it exists is given beside it.

---

## 1. Why we are redrawing

The existing set is drawn front-on, and that is the ceiling on the whole game.

A fighting game is seen from the side: the opponent is to the left or the
right, never behind the camera. These are flat drawings, posed by rotating
them in the plane of the screen. So a limb drawn pointing at the viewer can
never be made to point at the opponent — extend a front-facing leg into a
kick and you are looking at the *front* of a leg lying horizontally, which is
a narrow shape seen end-on. It reads as a noodle. No renderer fixes that. It
is what the drawing is *of*.

**The turn is the entire purpose of this pass.** If a drawing comes back with
the body square to the camera, it is worth nothing to us no matter how good
it looks, and it should be regenerated rather than accepted.

### What went wrong on the attempts so far

The previous brief asked for a three-quarter turn and got front-on figures.
The second attempt (KIN 09) turned **the head only** — proper profile, looking
right — while the chest, hips and both feet stayed square to the camera, with
the legs splayed in a symmetric V.

The third attempt turned the chest and the shoulders properly and drew a
real guard with both elbows bent — but the legs stayed square and simply
spread: the feet measured 33% of the figure's height apart and exactly level,
which is wider and flatter than the front-on characters being replaced. And
both forearms were drawn across the chest.

The fourth attempt (KIN 06 again, after his style note was corrected) came
back **wider still**: feet 37.5% of the figure's height apart and 0.7% of
depth between the soles. Head in profile, chest square, legs splayed.

### Why, and what this file got wrong

Correcting the style note did not help, because the style note was not the
cause. This brief was.

It asked for a turned body *and*, in the same prompt, for a guard with both
arms "held wide, elbows flared out away from the ribs, hands out to the sides
of the head", with "a band of empty background between each forearm and the
body", and for "a clear band of empty background between the two legs".

**There is no camera angle at which a turned figure looks like that.** A body
seen from the side hides its far arm behind its near arm and its far leg
behind its near leg; separation between them is in *depth*, which a flat
drawing shows as overlap and a value change, not as background. The only way
to satisfy the arms-and-legs paragraphs is to face the camera. Given a prompt
that contradicts itself, a generator keeps whichever half is described in the
more concrete spatial terms — and the arms paragraph was the most concrete
thing in the file. Each rejected sheet obeyed it exactly.

Those paragraphs existed to serve a renderer rule that is itself out of date;
see §2. They have been rewritten.

So there are three failure modes to design against. *A generator will turn the
head and leave the body*; once the body turns it will *still* plant the feet
square and read "bladed stance" as "wide stance"; and *anything in the prompt
that only makes sense from the front will pull the whole figure back to the
front*. The stance paragraph describes the feet in terms of how far apart they
are **on the canvas**, which is the thing that can be checked — by
`node tools/sidecheck.mjs <sheet.png>`, which needs no keying and takes a
second.

---

## 2. What the game does with each drawing

One illustration becomes a skinned mesh: a grid of points over the whole
picture, each bound to the bones nearest it. Idle, walk, crouch, block, jumps
and every attack come from moving those bones. There is no second drawing and
no frame-by-frame animation.

Three consequences:

**A limb may overlap the body. It may not overlap another limb.**

The drawing is one flat texture, so two things drawn over each other are the
same pixels and cannot move apart. But the body is not one of those things:
every part declares what covers it, and the rigger grows its surviving pixels
inward to fill the gap before the atlas is packed, so the chest exists
underneath the arm lying across it. On the one side-view sheet accepted so
far, both arms cross the torso and **15,824 covered pixels were filled, all
of them** — the arms lift off a complete jacket. It works because a jacket
panel is flat colour with a soft gradient; it would not work across a face or
a printed graphic, which is why each part declares its own occluders rather
than the tool guessing.

What cannot be recovered is two parts that *both move* sharing pixels: one
fist drawn behind the other, a hand over the face, a forearm over the far
thigh. There is nothing to fill those from — whichever part loses the pixels
is simply missing them.

*(An earlier version of this section said limbs must not overlap the body
either, left over from when parts were physically cut out and an overlap tore
a hole. That rule is what pushed §3 into asking for a wide symmetric guard,
and that is what kept turning the figures back to face the camera. Overlap
with the torso is fine. Ask for the turn instead.)*

**Joints must be findable.** A pivot gets placed at every elbow and knee. On
the first set the limbs were nearly straight and the elbow had to be guessed
at 40% down the arm. A visible bend is worth more than an elegant line.

**The image is the in-game texture.** Its resolution is the character's
resolution. The first set arrived about 490px tall, which is why the
characters are soft on a large screen.

---

## 3. The prompt

Use this for every character. Substitute `{CHARACTER}` from the table in §7,
and attach that character's existing image as a reference.

> Full-body character sheet of **{CHARACTER}**. Same character, same design,
> same clothing, hair and face as the reference image — a new pose and a new
> camera angle, not a redesign.
>
> **The character is turned to face the viewer's right, and the direction of
> the body is set by the feet.** Both feet point to the viewer's right. One
> foot is placed well in front of the other along a line running away to the
> right — they are not side by side, and they do not form a symmetric V. The
> near hip is closer to the camera than the far hip. Any skirt, coat or belt
> at the waist is seen edge-on, with its front facing right rather than facing
> the camera. The chest follows the hips: one shoulder is clearly nearer the
> camera than the other, the far side of the chest is partly hidden behind the
> near side, and the chest reads as a narrow plane rather than a broad front.
> The head is in three-quarter profile, the bridge of the nose and the line of
> the jaw breaking the silhouette against the background, one ear visible and
> the far ear hidden.
>
> **Stance:** a boxer's fighting stance, bladed, weight slightly on the rear
> foot. **The two feet are close together as they appear on the canvas** — the
> gap between them, measured left to right across the picture, is no more than
> about a quarter of the character's height. They are far apart in *depth*,
> not across the image: the rear foot is set back behind the front one and
> only slightly higher on the canvas — a small offset, a few percent of the
> figure's height, because both feet are standing on the same flat floor.
> This is a narrow stance seen from the side, not a wide stance seen from the
> front. **Both knees visibly bent, the rear knee bent more than the front.**
> The two legs nearly meet at the hips and draw apart toward the feet; the
> rear leg is told apart from the near one by being darker and partly behind
> it, not by a band of background between them.
>
> **Arms:** a boxer's high guard, both fists up at head height, **both elbows
> bent well past a right angle** so that each elbow's position is obvious.
> Seen from this angle the near arm is between the camera and the chest and
> the far arm is on the far side of the body — **they are not a symmetric
> pair and they are not held out level with each other.** The near fist is
> lower and further forward, the far fist higher and further back, so the two
> hands read as two separate shapes with clear space between them and neither
> one hidden behind the other. The far arm is drawn complete, shoulder to
> elbow to hand; where it passes across the chest it stays readable as a
> separate limb, darker than the jacket behind it and outlined against it.
> Hands closed into fists, wrists straight, both hands clear of the face.
>
> *(The arms may cross the body freely — the renderer paints the chest in
> underneath them. What it cannot do is separate one hand from the other, or
> a hand from the face: those are two independently moving parts sharing the
> same pixels. So the one thing the guard must do is keep the two fists
> apart.)*
>
> **Framing:** the whole figure from the top of the hair to the soles of the
> shoes, centred, occupying about 88% of the image height, with an even margin
> and nothing cropped or touching the edge.
>
> **Resolution: 1536 pixels tall.** This image is used directly as the in-game
> texture, so its resolution is the character's resolution in the game.
>
> **Background:** flat, even, neutral mid-grey. The figure floats free — no
> floor, no ground plane, no contact shadow, no shadow of any kind beneath or
> behind the figure.
>
> **Lighting:** strong key light from the upper left, cool cyan-and-lavender
> rim light down the right-hand edge of the figure, soft ambient fill. No
> shadow thrown by one limb across another.
>
> **Rendering:** polished stylised 3D character render, smooth gradients,
> crisp specular highlights, bold saturated colour, clean dark outline, high
> detail, sharp focus throughout.
>
> The body is turned to the viewer's right. Both feet point right, one in
> front of the other.

*(The last line is a deliberate repeat. The turn drifts away during
generation; restating it at the end holds it.)*

---

## 4. Resolution, in detail

**1536 pixels tall, PNG or high-quality WebP, figure filling about 88% of it.**

| | |
|---|---|
| **Canvas height** | **1536 px** (minimum 1280, no benefit above 2048) |
| **Canvas width** | whatever the figure needs — about 1024 for these proportions. Do not pad with empty background to reach a square. |
| **Figure within it** | about 88% of canvas height, so roughly **1350 px** from the top of the hair to the soles of the boots |

### Why that number

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
worst case to be drawn at 1:1 with no magnification. At 88% of the canvas,
that is a canvas 1536 tall.

The first round of art arrived at 431 pixels of figure. On a desktop that was
being blown up 3.1×, which is exactly why those characters look soft, and it
is not something the renderer can improve — the detail was never in the file.

### Why not larger

Above about 2048 the extra pixels are never seen on any display anyone will
use, and texture memory is real: ten characters at 1024×1536 is around 63 MB
of decoded image. 2048-tall sheets would double that for nothing. If a
generator only offers 1024 or 2048, **take 2048** and it will be downscaled —
too much detail is a problem that can be solved, too little is not.

### Format

PNG is safest. The background is removed by flood-filling inward from the
edges, and a lossy encoder puts ringing artefacts along every high-contrast
edge — which is precisely where the character meets the background, so the
keyer either eats into the figure or leaves a halo welded to it.

**In practice WebP at quality 92 was tested and did no harm**: KIN 09's sheet
came through as a single clean island of 383,547 pixels with clean edges. So
high-quality WebP is fine. Avoid JPEG, and avoid anything below about quality
85.

*(If the keying tool reports a high island count, that counts regions during
processing, not in the finished cutout. It is not by itself a reason to reject
a sheet.)*

### One thing that gets worse at higher resolution

Generators sometimes add faint texture, grain or a soft gradient to a
background at larger sizes where at small sizes they leave it flat. The keyer
needs the backdrop genuinely flat and even. If a 1536 render comes back
mottled or vignetted, that is worth a regeneration even if the character on it
is perfect — a flat 1024 beats a noisy 1536.

### How to check

Open the file and read its pixel dimensions. If the height starts with a 4, it
is the old size. It should start with a 1 and have four digits. That is the
whole check.

---

## 5. Negative prompt

> facing the viewer, front view, front-facing body, shoulders square to
> camera, hips square to camera, symmetric pose, symmetric wide stance, legs
> splayed in a V, feet side by side, both feet pointing at the camera, skirt
> facing the camera, both ears visible, head turned but body facing forward,
> symmetric guard, both arms held out level with each other, mirrored arms,
> arms spread wide to both sides, A-pose, T-pose, straight legs, locked knees,
> arms straight, arms hanging down, arms crossed, hands in pockets, hands
> behind back, arm flat against the body, one fist hidden behind the other,
> hand overlapping the face, one leg crossing the other, legs together, floor,
> ground plane, cast shadow, contact shadow, drop shadow, reflection, motion
> blur, speed lines, energy effects, glow, particles, weapons, props, cropped,
> cut off at the edge, multiple views, turnaround sheet, text, labels,
> watermark, white background, busy background, gradient background, vignette,
> low resolution

*(`forearm crossing the chest` used to be on this list. It is deliberately
gone: see §2. Banning it is what produced front-on sheets, because a figure
whose forearms clear its own chest is a figure facing you.)*

---

## 6. Accept or reject

Run these in order. The first three are where both previous attempts failed.

1. **Cover the head with your thumb. Can you still tell which way they are
   facing?** If not, reject. The head turning is not the body turning, and the
   head is the part that turns most easily.
2. **Look at the two feet** — or rather, measure them. Run

   ```
   node tools/sidecheck.mjs <sheet.png>
   ```

   on the file exactly as it arrives; it needs no keying and takes a second.
   It prints the gap between the feet across the picture, and the depth
   offset between the soles, both as a percentage of the figure's height:

   | sheet | gap | depth |
   |---|---|---|
   | KIN 09 — accepted, reads side-on | **21.3%** | 1.9% |
   | KIN 06 first attempt — rejected | 33.0% | 0.0% |
   | KIN 06 second attempt — rejected | 37.5% | 0.7% |

   The gap must be **under 26%**, which is where the tool draws the line:
   between the sheet that works and the ones that do not. The depth offset
   should be small but not zero — a couple of percent. *An earlier draft of
   this file demanded under 20% and a depth offset of a tenth of the figure's
   height. Both were made up rather than measured: the one sheet that works
   fails the first, and the second would be a character standing on a
   hillside when the rig stands both feet on one ground line.*
3. **Look at the waist.** Is a skirt, coat hem or belt seen edge-on, or is its
   front facing you? Facing you means the hips never turned.
4. **Both elbows and both knees visibly bent**, with the rear knee bent more
   than the front.
5. **The far arm is complete** — shoulder, elbow, hand — and readable along
   its whole length, whether it lies across the torso or against background.
   Crossing the torso is fine; vanishing behind it is not.
6. **The two fists are separate shapes, and neither is over the face.** This
   is the one overlap that cannot be undone: the chest can be painted in
   under an arm, but one hand cannot be reconstructed from behind another.
   The same goes for the two legs — they may overlap near the hips, but not
   so far down that the rear foot disappears behind the near one.
7. **1536px tall**, PNG, with the figure about 88% of that. Open the file and
   read its dimensions — if the height starts with a 4, it is the old size.
   Section 4 has the measurements: a fighter is drawn 1296 device pixels tall
   on a 1920 desktop, and the first round of art was 431, so it was being
   magnified threefold.
8. **No floor and no contact shadow.** A shadow keys as part of the character
   and leaves a grey smear welded to the feet.
9. **Mid-grey background, not white.** White destroyed KIN 04's hair and
   KIN 06's trainers last time — pale edges dissolve into a pale background
   and the keyer eats them.
10. **Nothing touches the edge of the frame.**
11. **Same framing and figure height across all ten**, so they stand together
    at one scale.

---

## 7. The ten

Keep each character's existing design exactly — clothing, colours, hair, face.
The style note is there because it should read in the stance.

**The style note never overrides the stance.** A generator reading "wide and
planted" against "bladed stance" will take the more specific word and plant
the feet square — KIN 06's first attempt came back at 33% of height apart
with the feet dead level, because his line said "wide". Every one of these
characters stands with one foot in front of the other; what differs between
them is how low, how far forward the weight is, and how tight the hands are.
If a style note and the stance paragraph ever disagree, the stance wins and
the note is wrong.

| | {CHARACTER} — paste this into the prompt | style | what the stance should say |
|---|---|---|---|
| **KIN 01** | a fighter in a green and white varsity jacket, baggy blue jeans, a dark cat-eared mask and a topknot | brawler | square-ish and heavy, hands a little low, chin tucked |
| **KIN 02** | a fighter in an orange puffer gilet, black trousers, shaved head, orange and black trainers | counterpuncher | patient, upright, weight back on the rear foot |
| **KIN 03** | a fighter in a red cropped jacket, dark trousers, hair in a high bun | duelist | narrow and bladed, lead hand reaching further than the rear |
| **KIN 04** | a fighter in a black tracksuit with white hair and teal gloves | ghost | loose and low, shoulders relaxed, almost casual |
| **KIN 05** | a fighter in a yellow jacket, dark cargo trousers, hair in afro puffs | kickboxer | tall and light, weight forward on the balls of the feet |
| **KIN 06** | a fighter in a dark jacket and white platform boots, with spiked cyan hair | bruiser | heavy and low — knees bent deepest of the ten, weight dropped, elbows out. Low, **not** wide: still one foot in front of the other |
| **KIN 07** | a fighter in a purple crop top and green cargo trousers, with long blue braids | rusher | leaning in, rear heel lifted, ready to close |
| **KIN 08** | a fighter in a long yellow coat with a white bob | striker | long and upright, lead shoulder well forward |
| **KIN 09** | a fighter in a blue jacket, black pleated skirt and tall black boots, with long straight dark hair | fencer | side-on, almost in profile, lead arm out long |
| **KIN 10** | a fighter in a lime puffer jacket and dark trousers, with bright orange hair | ember | bouncing, hands high, elbows tight |

---

## 8. If it still will not turn

It will drift back to front-on. In rough order of what works:

- **Lead with the feet, not the head.** The head turns on its own and takes
  nothing with it. The feet drag the hips, and the hips drag the chest.
- **Describe what is hidden.** "The far ear is hidden behind the cheek" and
  "the far side of the chest is behind the near side" do more work than any
  phrase naming an angle.
- **Name the camera's position**: "as seen by someone standing to the
  character's left".
- **Over-ask.** Request a strict side profile — "the character seen from
  directly beside them" — and accept the drift back toward three-quarters.
  Asking for more than you want is more reliable than asking for exactly it.
- **Repeat the turn at the end of the prompt**, after all the rendering
  instructions. It is the first thing to get lost.
- **Check the rest of the prompt for anything that is secretly a front view.**
  This is what went wrong three times here, and it beat every lever above,
  because it was not fighting the turn with a weaker instruction — it was
  asking for the front in concrete, drawable terms while asking for the side
  in abstract ones. A symmetric guard, both arms clear of the body, a band of
  background between the legs: each is invisible as a camera instruction and
  each one is one. If a sheet comes back front-on and the prompt *says* side,
  suspect the prompt before blaming the generator.

---

## 9. Order to generate in

**KIN 06 next, alone**, then the rest.

KIN 09 is done and accepted; she is the reference every other sheet is
measured against. KIN 06 has now failed twice, which makes him the right test
of the rewritten prompt rather than the wrong one to retry: he is the hardest
of the ten — a low heavy stance pulls toward planting the feet square, and
white platform boots against a mid-grey backdrop are where the keyer
struggles. A prompt that turns him will turn anyone.

**Generate him on his own and stop.** The arms and stance paragraphs in §3
have just been rewritten and have never produced a sheet; until one comes
back and measures under 26%, there is no evidence the new wording is any
better than the wording it replaced. Eight sheets generated against an
unproven prompt is eight regenerations.

Once he passes, send the remaining eight one at a time or in a batch, as
suits. Run `node tools/sidecheck.mjs` on each as it arrives, before anything
else — a sheet that fails there is not worth looking at closely.

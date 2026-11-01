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

So there are two failure modes to design against. *A generator will turn the
head and leave the body*, and once the body turns it will *still* plant the
feet square and read "bladed stance" as "wide stance". The stance paragraph
now describes the feet in terms of how far apart they are **on the canvas**,
which is the thing that can be checked.

---

## 2. What the game does with each drawing

One illustration becomes a skinned mesh: a grid of points over the whole
picture, each bound to the bones nearest it. Idle, walk, crouch, block, jumps
and every attack come from moving those bones. There is no second drawing and
no frame-by-frame animation.

Three consequences:

**Limbs must not overlap each other or the body.** The drawing is one flat
texture, so where a forearm is drawn across a thigh those are the same pixels,
and rotating the arm drags the thigh with it. A band of clear background
between two things that need to move apart is what lets them move apart.
*(This used to be even stricter — parts were physically cut out, so an overlap
tore a hole in whatever was beneath. The mesh removed that, so a short overlap
now survives. A long one still does not.)*

**Joints must be findable.** A pivot gets placed at every elbow and knee. On
the first set the limbs were nearly straight and the elbow had to be guessed
at 40% down the arm. A visible bend is worth more than an elegant line.

**The image is the in-game texture.** Its resolution is the character's
resolution. The first set arrived about 490px tall, which is why the
characters are soft on a large screen.

---

## 3. The prompt

Use this for every character. Substitute `{CHARACTER}` from the table in §6,
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
> about a fifth of the character's height. They are far apart in *depth*, not
> across the image: the rear foot is set back behind the front one, drawn
> higher up the canvas because it is further from the camera, by roughly a
> tenth of the character's height. This is a narrow stance seen from the side,
> not a wide stance seen from the front. **Both knees visibly bent, the rear
> knee bent more than the front.** A clear band of empty background between
> the two legs.
>
> **Arms:** a high guard held **wide**, with the elbows flared out away from
> the ribs. Both hands are up at head height but **out to the sides of the
> head, not in front of the face or in front of the chest** — a band of empty
> background is visible between each forearm and the body, and neither forearm
> crosses the torso. **Both elbows clearly bent** — even where an arm is held
> out long, keep enough bend that the elbow's position is obvious. The far arm
> is drawn complete, shoulder to hand, held out and slightly back so that its
> whole length is silhouetted against the background rather than disappearing
> behind the torso. Hands closed into fists, wrists straight, each hand clear
> of the face and of the other hand.
>
> *(A real boxing guard tucks the forearms across the chest. Do not draw that
> here. The forearms must stay clear of the body even though it makes the
> guard look wider than a real one — the drawing is cut into moving parts, and
> a forearm drawn over the chest cannot be moved without taking the chest
> with it.)*
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
> A-pose, T-pose, straight legs, locked knees, arms straight, arms hanging
> down, arms crossed, hands in pockets, hands behind back, arm flat against
> the body, forearm crossing the chest, hand overlapping the face, one leg
> crossing the other, legs together, floor, ground plane, cast shadow, contact
> shadow, drop shadow, reflection, motion blur, speed lines, energy effects,
> glow, particles, weapons, props, cropped, cut off at the edge, multiple
> views, turnaround sheet, text, labels, watermark, white background, busy
> background, gradient background, vignette, low resolution

---

## 6. Accept or reject

Run these in order. The first three are where both previous attempts failed.

1. **Cover the head with your thumb. Can you still tell which way they are
   facing?** If not, reject. The head turning is not the body turning, and the
   head is the part that turns most easily.
2. **Look at the two feet.** Do both point to the right, one set back behind
   the other? If either points at the camera, or they splay symmetrically
   outward, reject. Measurable, and this one is reliable: the horizontal gap
   between the feet should be **under a fifth of the figure's height**, and
   the rear foot should sit **higher up the canvas** than the front one. A
   front-on splay measures 29–33% apart and dead level; the attempt that was
   rejected for this measured 33% and 0%.
3. **Look at the waist.** Is a skirt, coat hem or belt seen edge-on, or is its
   front facing you? Facing you means the hips never turned.
4. **Both elbows and both knees visibly bent**, with the rear knee bent more
   than the front.
5. **The far arm is complete** — shoulder, elbow, hand — and sits against
   background, not against the torso.
6. **Daylight between things that move apart**: between each forearm and the
   chest, and between the two legs. A forearm crossing the chest is a reject
   however good the guard looks — those are the same pixels, and the arm
   cannot move without the chest coming with it.
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

---

## 9. Order to generate in

**KIN 09 first**, then **KIN 06**, then the rest.

KIN 09's style wants the strongest turn anyway, so she is the cheapest test of
whether the generator will turn a body at all. KIN 06 is the hardest: a wide
planted stance fights the bladed pose, and white platform boots against a
mid-grey background are exactly where the keyer struggles. If those two come
back clean, the other eight will follow.

Send them one at a time. The first one gets keyed, meshed, rigged and sent
back as a moving test before the other nine are generated — better to find out
the brief is wrong on character one than on character ten.

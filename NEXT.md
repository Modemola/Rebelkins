# Generate KIN 06 — side view

**One image, then stop.** Not the whole set.

1. Attach `assets/cutouts/v2/kin06.png` as the reference image.
2. Paste the prompt below, and the negative prompt below that.
3. Send me whatever comes back — I check it before doing anything else.

**Take only the character from the reference — the jacket, the hair, the
face, the boots. Not the pose, and not the camera.** The reference is a
front-on figure with its feet planted wide and level, which is the exact
thing this pass exists to replace. Three sheets so far have come back
copying that stance.

---

## Prompt

Full-body character sheet of **a fighter in a dark jacket and white platform boots, with spiked cyan hair**. Same character, same design,
same clothing, hair and face as the reference image — a new pose and a new
camera angle, not a redesign.

**The character is turned to face the viewer's right, and the direction of
the body is set by the feet.** Both feet point to the viewer's right. One
foot is placed well in front of the other along a line running away to the
right — they are not side by side, and they do not form a symmetric V. The
near hip is closer to the camera than the far hip. Any skirt, coat or belt
at the waist is seen edge-on, with its front facing right rather than facing
the camera. The chest follows the hips: one shoulder is clearly nearer the
camera than the other, the far side of the chest is partly hidden behind the
near side, and the chest reads as a narrow plane rather than a broad front.
The head is in three-quarter profile, the bridge of the nose and the line of
the jaw breaking the silhouette against the background, one ear visible and
the far ear hidden.

**Stance:** a boxer's fighting stance, bladed, weight slightly on the rear
foot. **The two feet are close together as they appear on the canvas** — the
gap between them, measured left to right across the picture, is no more than
about a quarter of the character's height. They are far apart in *depth*,
not across the image: the rear foot is set back behind the front one and
only slightly higher on the canvas — a small offset, a few percent of the
figure's height, because both feet are standing on the same flat floor.
This is a narrow stance seen from the side, not a wide stance seen from the
front. **Both knees visibly bent, the rear knee bent more than the front.**
The two legs nearly meet at the hips and draw apart toward the feet; the
rear leg is told apart from the near one by being darker and partly behind
it, not by a band of background between them.

Within that stance, this character is heavy and low — knees bent deepest of the ten, weight dropped, elbows out. Low, **not** wide: still one foot in front of the other.

**Arms:** a boxer's high guard, both fists up at head height, **both elbows
bent well past a right angle** so that each elbow's position is obvious.
Seen from this angle the near arm is between the camera and the chest and
the far arm is on the far side of the body — **they are not a symmetric
pair and they are not held out level with each other.** The near fist is
lower and further forward, the far fist higher and further back, so the two
hands read as two separate shapes with clear space between them and neither
one hidden behind the other. The far arm is drawn complete, shoulder to
elbow to hand; where it passes across the chest it stays readable as a
separate limb, darker than the jacket behind it and outlined against it.
Hands closed into fists, wrists straight, both hands clear of the face.

*(The arms may cross the body freely — the renderer paints the chest in
underneath them. What it cannot do is separate one hand from the other, or
a hand from the face: those are two independently moving parts sharing the
same pixels. So the one thing the guard must do is keep the two fists
apart.)*

**Framing:** the whole figure from the top of the hair to the soles of the
shoes, centred, occupying about 88% of the image height, with an even margin
and nothing cropped or touching the edge.

**Resolution: 1536 pixels tall.** This image is used directly as the in-game
texture, so its resolution is the character's resolution in the game.

**Background:** flat, even, neutral mid-grey. The figure floats free — no
floor, no ground plane, no contact shadow, no shadow of any kind beneath or
behind the figure.

**Lighting:** strong key light from the upper left, cool cyan-and-lavender
rim light down the right-hand edge of the figure, soft ambient fill. No
shadow thrown by one limb across another.

**Rendering:** polished stylised 3D character render, smooth gradients,
crisp specular highlights, bold saturated colour, clean dark outline, high
detail, sharp focus throughout.

The body is turned to the viewer's right. Both feet point right, one in
front of the other.

---

## Negative prompt

facing the viewer, front view, front-facing body, shoulders square to
camera, hips square to camera, symmetric pose, symmetric wide stance, legs
splayed in a V, feet side by side, both feet pointing at the camera, skirt
facing the camera, both ears visible, head turned but body facing forward,
symmetric guard, both arms held out level with each other, mirrored arms,
arms spread wide to both sides, A-pose, T-pose, straight legs, locked knees,
arms straight, arms hanging down, arms crossed, hands in pockets, hands
behind back, arm flat against the body, one fist hidden behind the other,
hand overlapping the face, one leg crossing the other, legs together, floor,
ground plane, cast shadow, contact shadow, drop shadow, reflection, motion
blur, speed lines, energy effects, glow, particles, weapons, props, cropped,
cut off at the edge, multiple views, turnaround sheet, text, labels,
watermark, white background, busy background, gradient background, vignette,
low resolution

---

## What happens when you send it

I run `node tools/sidecheck.mjs` on it first — the file as delivered, WebP or
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

*Generated from ART-BRIEF-SIDE.md §3, §5 and §7 by `node tools/prompt.mjs kin06`.
Edit the brief, not this file.*

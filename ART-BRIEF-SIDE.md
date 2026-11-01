# REBELKIN — side-view character sheet brief

Replaces the A-pose brief for a second pass at all ten characters. Every line
here is load-bearing for the rigger; where a constraint looks arbitrary, the
reason it exists is given next to it.

## Why we are redrawing

The first set was drawn front-on. That is the single fact limiting the game.

A fighting game is seen from the side: the opponent is to the left or the
right, never behind the camera. These are flat drawings posed by rotating
them in the plane of the screen, so a limb drawn pointing at the viewer can
never be made to point at the opponent. Extend a front-facing leg into a kick
and you are looking at the *front* of a leg lying horizontally — which is a
narrow shape seen end-on, and it reads as a noodle. Nothing in the renderer
fixes that; it is what the drawing is of.

The old brief did ask for a three-quarter turn and did not get one. Measured
across the cast, the distance between the two shoulder joints averages **22%
of figure height**. A front-on figure is about 25%. A 45-degree turn is about
17%; a true profile about 9%. So the turn was asked for and essentially not
delivered, and nobody noticed because nothing measured it.

**This time the turn is the whole point, so it is specified by what must be
visible rather than by an angle, and there is a number to check it against.**

## What the game does with each drawing

One illustration per character becomes a skinned mesh: a grid of points laid
over the whole picture, each bound to the bones near it. Idle, walk, crouch,
block, jumps and every attack come out of moving those bones.

Two consequences, and they are different from last time.

**Limbs must not overlap each other or the body.** This is now the only hard
rule about the pose. The drawing is a single flat texture, so where a forearm
is drawn across a thigh, those are the same pixels — and rotating the arm
drags the thigh with it. A clear band of background between a limb and
whatever is behind it is what lets the two move independently.

*(Previously this rule was even stricter: parts were physically cut out, so
an overlap tore a hole in whatever was underneath. The mesh removed that —
nothing is cut any more, so a small overlap is survivable. A long one is
not.)*

**The joints have to be findable.** Elbows and knees need to be visibly bent,
because the rigger places a pivot at each one. On the first set the arms were
nearly straight and the elbow had to be guessed at 40% of the way down. A
readable bend is worth more than a graceful line.

## The master prompt

One image per character. If nothing else is produced, produce this.

> Full-body character sheet of {CHARACTER}, standing in a boxer's fighting
> stance, **turned to face the viewer's right**.
>
> The turn is the most important thing in this image. The body is rotated
> roughly fifty degrees away from the camera, so that: the chest reads as a
> narrow plane rather than a broad front; the near shoulder is clearly closer
> to the camera than the far one, which sits well behind it; the head is in
> three-quarter profile with the bridge of the nose and the line of the jaw
> breaking the silhouette against the background, one ear visible and the far
> ear hidden; the lead foot points to the right, the rear foot is turned
> outward, and the hips are turned the same way as the chest. A line drawn
> between the two shoulder joints should be a little over half as wide as the
> character's own shoulders would look from the front.
>
> Arms: a loose high guard, both fists up at chin height, **both elbows bent
> to a clear right angle**. The near arm is held out from the ribs with a
> visible band of empty background between the forearm and the chest. The far
> arm is drawn complete, from shoulder to fist, held out and slightly back so
> that its whole length is silhouetted against the background instead of
> disappearing behind the torso. Both fists closed, wrists straight, each hand
> clear of the face and of the other hand.
>
> Legs: a bladed stance, lead leg forward and rear leg back, with a clear band
> of empty background visible between the two legs along their whole length.
> **Both knees visibly bent**, weight slightly on the rear foot. Both feet
> fully drawn and both resting on the same horizontal line.
>
> Framing: the entire figure from the top of the hair to the soles of the
> shoes, centred, occupying about 88% of the image height, with an even margin
> and nothing cropped or touching the edge. At least 1024 pixels tall.
>
> Background: flat, even, neutral mid-grey. The figure floats free — no floor,
> no ground plane, no contact shadow, no shadow of any kind beneath or behind
> the figure.
>
> Lighting: strong key light from the upper left, cool cyan-and-lavender rim
> light down the right-hand edge of the figure, soft ambient fill. No shadow
> thrown by one limb across another.
>
> Rendering: polished stylised 3D character render, smooth gradients, crisp
> specular highlights, bold saturated colour, clean dark outline, high detail,
> sharp focus throughout.

## Negative prompt

> facing the viewer, front view, symmetrical pose, shoulders square to camera,
> both ears visible, A-pose, T-pose, arms straight, arms hanging down, arms
> crossed, hands in pockets, hands behind back, arm flat against the body,
> forearm crossing the chest, hand overlapping the face, one leg crossing the
> other, legs together, knees straight, floor, ground plane, cast shadow,
> contact shadow, drop shadow, reflection, motion blur, speed lines, energy
> effects, glow effects, particles, weapons, props, cropped, cut off at the
> edge, multiple views, turnaround sheet, text, labels, watermark, white
> background, busy background, gradient background, vignette

## Accept or reject

Check these before the drawing goes anywhere near the rigger. The first four
are the ones that were missed last time.

1. **The turn.** Cover the head and ask: is this person facing right, or
   facing me? If there is any doubt, reject it. Measurable version: the
   horizontal distance between the two shoulder joints should be **12–17% of
   the figure's total height**. Over 20% is a front-on drawing and no amount
   of rigging will save it.
2. **The far arm is all there** — shoulder, elbow, fist — and sits against
   background, not against the torso.
3. **Both elbows and both knees are bent enough to see where the joint is.**
4. **Daylight between things that move apart**: between each forearm and the
   chest, and between the two legs.
5. Both feet on one horizontal line, both fully drawn.
6. No floor, no contact shadow. A shadow keys as part of the character and
   leaves a grey smear welded to the feet.
7. Nothing touches the edge of the frame.
8. Mid-grey background, not white. White destroyed KIN 04's hair and KIN 06's
   trainers last time — pale edges dissolve into a pale background and the
   keyer eats them.
9. Same framing and figure height across all ten, so they stand together at
   one scale.

## The ten

Keep each character's existing design — clothing, colours, hair, face. This is
the same person in a different pose and from a different angle, not a
redesign. Their fighting style is given because it should read in the stance.

| | character | style | what the stance should say |
|---|---|---|---|
| **KIN 01** | green varsity jacket, baggy jeans, dark mask, topknot | brawler | square-ish and heavy, hands a little low, chin tucked |
| **KIN 02** | orange puffer gilet, black trousers, shaved head | counterpuncher | patient, upright, weight back on the rear foot |
| **KIN 03** | red cropped jacket, dark trousers, hair in a bun | duelist | narrow and bladed, lead hand extended further than the rear |
| **KIN 04** | black tracksuit, white hair, teal gloves | ghost | loose and low, shoulders relaxed, almost casual |
| **KIN 05** | yellow jacket, dark cargo trousers, afro puffs | kickboxer | tall and light, weight forward on the balls of the feet |
| **KIN 06** | dark jacket, white platform boots, cyan hair | bruiser | wide and planted, elbows out, lowest stance of the ten |
| **KIN 07** | purple crop top, green cargo trousers, blue braids | rusher | leaning in, rear heel lifted, ready to close |
| **KIN 08** | yellow coat, white bob | striker | long and upright, lead shoulder well forward |
| **KIN 09** | blue jacket, black skirt, long dark hair | fencer | side-on, almost in profile, lead arm out straight and long |
| **KIN 10** | lime puffer, orange hair, dark trousers | ember | bouncing, hands high, elbows tight |

## If the generator refuses to turn the body

It will try to drift back to front-on; it did last time. Things that work,
roughly in order:

- Lead with the turn. Put it in the first sentence, before the character
  description, and say it again at the end.
- Describe what is **hidden**, not just what is visible. "The far ear is
  hidden behind the cheek" does more work than "three-quarter view".
- Name a real reference frame: "as seen by someone standing to the
  character's left".
- Ask for the nose and jaw to break the silhouette. A profile face is the
  single strongest cue that the body is turned, and the body usually follows
  the head.
- If it still comes back square, generate at a stronger turn than wanted
  (ask for near-profile) and accept the drift back toward three-quarters.

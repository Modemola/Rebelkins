# REBELKIN — character sheet brief

What to generate, and why each line is in there. The *why* matters: if a
constraint looks arbitrary, it is probably load-bearing for the rigger, and
dropping it costs a character its punch.

## What the game actually does with the art

Each character is one illustration cut into polygons — torso, hips, head, two
arms, two legs — each with a pivot and a parent. Idle, walk, crouch, block,
jumps and every attack come out of rotating those pieces. There is no second
drawing and no frame-by-frame animation.

Two consequences drive everything below.

**Limbs must be separable.** The cutter works on polygons over the source
pixels. Where a sleeve lies flat against a coat there is no coat underneath, so
lifting the arm tears a hole in the body. The rigger can inpaint a small hole,
but it cannot invent an arm that was never drawn. An arm touching the torso
along its length is an arm the character does not have.

**A punch travels sideways.** This is a side-view fighter: the opponent is to
the left or the right, never behind the camera. A flat cut-out can only rotate
in the plane of the screen, so an arm drawn pointing at the viewer can never be
made to point at the opponent. Five of the ten characters were drawn front-on
with their arms folded, and that single fact is why half the cast fights with
kicks and shoulder charges.

## The master pose

One image. If nothing else is produced, produce this.

> Full-body character sheet of {CHARACTER}, standing in a relaxed neutral
> A-pose, body turned three-quarters toward the viewer's right. Both arms held
> away from the torso at roughly forty degrees, elbows very slightly bent, with
> a clear band of empty background visible between each arm and the body along
> the whole length of the arm. Hands open and relaxed, fingers slightly spread
> and separated from each other. Legs shoulder-width apart with clear empty
> background visible between the thighs. Feet flat, parallel, both on the same
> horizontal ground line. Head upright and level, facing the same direction as
> the body.
>
> Framing: entire figure from the top of the hair to the soles of the shoes,
> centred, with a small even margin. Nothing cropped.
>
> Lighting: strong key light from the upper left, cool cyan-and-lavender rim
> light down the right-hand edge of the figure, soft ambient fill, no cast
> shadow on the ground, no shadow thrown by one limb across another.
>
> Rendering: polished stylised 3D character render, smooth gradients, crisp
> specular highlights, bold saturated colour, clean dark outline, high detail,
> sharp focus throughout.
>
> Background: flat mid-grey, or fully transparent.

**Not white.** KIN 04 has white hair and the first sheet came back on white;
the key walked straight through the hair, because there is no edge between a
white strand and a white backdrop for the flood fill to stop at. It dissolved
entirely on one of the two poses at every tolerance that did not also leave
backdrop behind. Mid-grey, magenta, or real alpha all avoid it, and the same
trap waits for anything pale — KIN 06's white trainers, KIN 05's highlights.

**Negative prompt**

> arms crossed, arms folded, hands in pockets, hands behind back, hands on
> hips, arms touching the torso, arms overlapping the body, legs together,
> thighs touching, holding a prop across the body, foreshortening, arm pointing
> toward the camera, motion blur, depth of field, cropped limbs, cut off at the
> edge, multiple characters, duplicate limbs, extra fingers, text, watermark,
> signature, logo, cast shadow, ground plane, floor, background scenery,
> busy background

## Why those words

| Line | What breaks without it |
|---|---|
| three-quarters toward the viewer's right | the punch has somewhere to travel; front-on art cannot throw one |
| clear band of empty background between arm and body | the cut; a touching arm cannot be separated from the torso |
| along the whole length of the arm | a gap at the elbow but not the shoulder still welds the arm on |
| elbows very slightly bent | a locked-straight arm reads stiff once it rotates |
| fingers slightly spread and separated | fused mitten hands look wrong the moment the arm moves |
| empty background between the thighs | the legs are separate parts and animate independently |
| both feet on the same horizontal ground line | the rig measures a ground line; a raised foot skews the stance |
| no cast shadow, no ground plane | the floor is drawn by the engine, with a live reflection |
| no shadow thrown by one limb across another | the shadow stays put when the limb moves and the fake shows |
| no motion blur, no depth of field | every pixel is reused in dozens of poses and must stay sharp |
| transparent background | the cutter keys on alpha |
| background not white | a white-haired character dissolves into a white backdrop |
| no cast shadow (again) | a soft floor shadow lands in the gap between arm and body, which is the one region that has to be clean |

## Worth adding, in order of value

Each is one more image of the **same** character, same outfit, same lighting.

1. **Straight punch.** Same three-quarter view, the near arm extended straight
   out sideways at shoulder height, fist closed, the arm clear of the body for
   its whole length. This gives a drawn fist instead of a rotated open hand,
   which is the difference between a punch and a palm.
2. **High kick.** Near leg raised and extended sideways at hip height or above,
   the leg clear of the other leg along its length.
3. **Guard.** Both forearms raised in front of the chest, still with daylight
   between the forearms and the body.
4. **Hurt.** Head back, torso recoiled, arms loose and away from the body.

The master A-pose alone produces a complete fighter. Everything after it buys
fidelity, not capability.

## Keeping it the same character

Feed the existing illustration in as a character or style reference and hold
the seed steady across poses. The ten have a strong shared look — rendered
finish, heavy speculars, that cyan rim — and a pose that misses it will read as
pasted on, which is worse than a missing arm.

Framing consistency matters across the roster, not just within a character: the
same zoom, feet near the bottom edge, head near the top. The rigger can rescale
a character, but a roster rendered at ten different zooms will look it.

**Size.** The existing ten are around 500 pixels tall within a 600 pixel
cutout. Anything much smaller is visibly softer beside them, and a fist is the
first thing to turn to mush. Aim for a thousand pixels of figure or better.

**One pose per file** beats a sheet with several figures on it. Each pose needs
its own key tolerance — a backdrop brighter behind one figure than another
costs whichever one the single pass is wrong for, which is exactly what
happened to KIN 04's punch pose. `tools/crop.mjs <src> <x> <y> <w> <h> --raw`
splits a sheet after the fact, but it is better not to need it.

## Accepting an output

Before it goes in, check:

- [ ] Background transparent or mid-grey — never white
- [ ] No soft shadow on the floor behind the figure
- [ ] Daylight visible between each arm and the torso for the arm's full length
- [ ] Daylight visible between the thighs
- [ ] Hands intact — five fingers, nothing fused, nothing melted
- [ ] Nothing cropped, including hair and shoes
- [ ] Both feet on one ground line
- [ ] No shadow on the ground or across the body
- [ ] Reads as the same character as the original

`node tools/crop.mjs <file> <x> <y> <w> <h> --zoom 8` magnifies any region with
a pixel grid, which is the quickest way to check a gap is real rather than a
dark edge pretending to be one.

## The five that need it

Same prompt, with `{CHARACTER}` replaced. Descriptions taken from the existing
art so the identity holds.

**KIN 04 — ghost**
> a slim youth with a chin-length choppy silvery-white bob and a spiky
> fringe, a bright green face graduating to cyan across one side, narrow
> angular dark eyes, a small cyan earpiece, wearing an oversized matte black
> hooded parka falling to mid-thigh with thin white and cyan piping along its
> seams, black tapered trousers with a pale side stripe, and chunky white
> trainers, **sleeves hanging free and clear of the coat body, both hands
> fully visible past the cuffs**

The coat is the reason he has no arms at all today: it is oversized, falls to
mid-thigh and swallows the hands. A generator told "oversized parka" will
drape the sleeves back against the body and land exactly where the original
did, so the sleeve clause is part of his description rather than an
afterthought, and his negative prompt carries the extra entries below. If it
still fights, ask for a *fitted* black hooded jacket: a slightly less baggy
coat that can throw a punch beats a perfect coat that cannot.

> **extra negatives for KIN 04:** sleeves draped against the body, hands
> hidden inside sleeves, hands inside the coat, oversized sleeves covering the
> hands, sleeve swallowing the hand, coat sleeves merged with the coat body

**KIN 05 — kickboxer**
> a dark-skinned young woman with two large braided afro puffs, gold bar
> earrings, sharp yellow eyeliner, wearing a cropped bright yellow jacket with
> a glossy finish, a black crop top, black leather trousers and black boots

**KIN 06 — bruiser**
> a stocky figure with deep navy-black skin and bright cyan spiked hair,
> glowing yellow-green eyes, wearing a dark navy bomber jacket with red zip
> detailing, white gloves, black trousers and oversized white-and-lavender
> trainers

**KIN 07 — rusher**
> a young woman with orange-red skin and long blue locs fading to teal at the
> ends, wearing a cropped purple long-sleeved top, gold rings, and loose dark
> teal cargo trousers with pointed boots

**KIN 10 — ember**
> a youth with a green face and hair made of orange and yellow flame, glowing
> yellow eyes, wearing an oversized lime green puffer jacket over a red shirt,
> black shorts and lime green high-top trainers

**KIN 02** and **KIN 09** already have a working right arm; a free left arm
would let them throw from both sides, but neither is blocking.

# RebelKin — fighter

A one-on-one fighting game. You play the Kin.

Two characters are playable, each rigged from a single illustration. Run it:

```sh
npx http-server . -p 8080 -c-1   # then open localhost:8080
node tools/playtest.mjs          # drives a real browser and asserts the fight works
```

**P1** A/D move · W jump · S crouch · J light · K heavy · L special · Space guard
**P2** arrows · `,` `.` `/` attacks · RShift guard

## The constraint everything else follows from

The characters arrive as **one finished illustration each** — rendered on a flat
backdrop, no alpha, no 3D model behind them, no turnarounds, each in a different
hero pose. A fighter needs each character in roughly fifteen poses.

The way out is to stop treating an illustration as a picture and treat it as a
set of parts. Cut it along polygons, give each part a pivot and a parent, and
idle, walk, crouch, block, hit and most attacks all come out of that one drawing.

## The fight

The simulation runs at a **fixed 60Hz**, decoupled from rendering. Startup,
active and recovery are counted in frames, so the same inputs give the same
result whatever the display is doing.

| | Kin 08 — striker | Kin 06 — bruiser |
| --- | --- | --- |
| light | Jab 4/3/9, 42 dmg | Low Kick 6/4/11, 54 dmg |
| heavy | Hook 10/4/18, 98 dmg | Stomp 12/4/20, 115 dmg |
| special | Runner 9/7/22, 86 dmg | Charge 11/8/24, 102 dmg |

*(startup / active / recovery, in frames)*

Kin 06 hits harder and moves slower, and has no independent arms — see below.

**Hitboxes ride the rig.** A move names a part and a reach; the hitbox is placed
at wherever that part actually is this frame, so what hits is what you can see.
Hurtboxes are body-sized ellipses, which matters more than it sounds: the first
version used a circle sitting near the ankles and *nothing ever connected*.

**Hitstop** scales with damage, 6 frames up to 16. It is the single biggest
contributor to whether a strike lands heavy or feels like a slap.

The CPU blocks on reaction, respects spacing, and backs off when hurt. Blocked
damage is chipped and clamped so a block can never finish a round.

## Pipeline

One illustration in, one playable fighter out. The whole chain, in order:

```sh
# 0. judge the sheet before spending an hour on it     (side-view sheets only)
node tools/sidecheck.mjs assets/sheets/side/<id>.webp

# 1. separate the subject from its backdrop
node tools/cutout.mjs <indir> <outdir> --auto --sheet

# 2. read joint positions in source pixels
node tools/rig-grid.mjs <cutout.png> grid.png --scale 2

#    then author rigs/side/<id>.json by hand: one polygon per part, with its
#    pivot, z order, occludedBy and joint limits. articulate.mjs splits a limb
#    on a horizontal line and cannot do an arm already bent at the elbow, which
#    is every side-view guard, so these are drawn by hand.

# 3. cut into parts, heal what the limbs occlude, pack an atlas
node tools/rig.mjs <cutout.png> rigs/side/<id>.json <outdir> --debug
#    -> <outdir>/atlas.png and <outdir>/rig.json

# 4. bind a vertex grid to those polygons
node tools/meshgen.mjs <cutout.png> rigs/side/<id>.json meshes/v2/<id>s.json
#    reads the hand-authored polygons in SOURCE pixels, not the packed rig

# 5. write src/data/<id>s.js, then copy the packed rects into it
node tools/rigsync.mjs <outdir>/rig.json src/data/<id>s.js
#    add --check to report drift and exit non-zero without writing

# 6. hand-animate light, heavy and special, and add the id to IDS in
#    tools/spar.mjs and ROSTER in src/main.js so every check sees it
```

`tools/rig-preview.html` plays the result — seven moves, skeleton and part
overlays, so a rig can be judged before anything is built on it. Step 6 is the
hour; everything above it is minutes.

Two things that are easy to get backwards. `meshgen` wants the **hand-authored**
rig, because it reads polygons in source pixels; `rigsync` wants the **built**
one, because it reads atlas rects. And shelf-packing means changing any one
polygon moves every other part in the atlas, so step 5 is not optional after a
re-rig — a stale rect draws the wrong rectangle of the sheet and looks like a
rigging mistake.

One thing to re-measure rather than assume, once a side-view character is in:
`node tools/hurtfit.mjs`. The hurtbox is an ellipse centred on the root pivot,
and the root is placed by hand at rigging time, so whether the drawn body sits
over it is a property of the art. Across the current twelve it does — the centre
of mass lands within 12px of the root against radii of 32–49px. The furthest
off is KIN 09 side-on at 12px; the front-facing ten reach 8px at worst. That is
one character, not a pattern — the other side-on one sits at 7px, mid-pack among
the ten — but a bladed stance does put the lead foot forward of the torso, which
is the only mechanism yet seen that moves a body off its root, and eight more
bladed stances are coming. The tool prints offsets and no pass mark on purpose:
the whole signal is about 12px and nothing yet says what fraction of a radius is
too much.

### cutout.mjs

Flood fills inward from the frame edge with a local tolerance, so it follows a
backdrop gradient, plus a leash to the sampled backdrop palette so it cannot
follow that gradient into the character. No single tolerance works on all ten
source images, so it searches a small grid per image and scores the result.

The score is geometric and therefore blind to one failure: a key that has bitten
a hole in the character looks numerically like a clean one. The accepted removal
band is capped near where these renders actually sit, which catches it. Look at
the contact sheet anyway.

### rig.mjs

Parts declare what occludes them. Where a sleeve lies over a coat there are no
coat pixels underneath, so the layer beneath is grown back from its own
surviving pixels before packing. On the first character that was 12,622 pixels
of coat invented behind two sleeves.

**That limit has since been lifted, and the cut survives as a hint.** A
hard-edged 2D cut does not deform: the seam where a sleeve meets a body shows
under large rotations, and a part whose pivot sits outside its own bitmap
swings away and leaves a hole at the shoulder. `meshgen.mjs` lays a vertex grid
over the whole drawing instead and binds each vertex to the bones nearest it,
using these polygons to decide which bone owns which pixels — so the geometry at
a joint is shared and bends across it, because nothing was ever cut. The rigid
path is still what draws a fighter whose mesh is missing, seam and all.

## Rigs

| Rig | Character | Parts | Case |
| --- | --- | --- | --- |
| `rigs/kin08.json` | yellow coat, white bob | 7 | front-on, arms clear of the body — the easy case |
| `rigs/kin06.json` | navy jacket, cyan spikes | 5 | front-on, arms folded — arms stay welded on |
| `rigs/side/kin06.json` | the same character, redrawn side-on | 11 | the fix |

The part counts are the argument. The ten front-facing rigs carry five to seven
parts; the two side-view rigs carry eleven each — upper arm, forearm, thigh and
shin on both sides, all separable, because a bladed stance shows them. A
folded-arm front-on character gets five and can never punch.

### What these cases established

Separating a limb means inventing what was behind it. That is affordable when
the hidden region is a narrow band at the edge of a large flat panel, which is
why the coat healed: 12,622 pixels, and the arm sits back over most of them
anyway.

It is not affordable when the hidden region is wide and central. Folded arms
hide two thirds of a jacket, the fill has to travel far from any real pixel,
and what comes back is a horizontal smear rather than a garment.

So the rule is: **heal only what a limb will stay near.** For folded-arm
characters the arms stay welded to the torso, which costs the independent punch
set and keeps everything else — idle, walk, kicks, stomps, body charges, hit
reactions, and a guard pose their folded arms already read as.

The first answer was one extra generation per folded-arm character, in an open
pose with the limbs clear of the body — five of the ten needed it. That is not
what shipped. An open pose fixes the occlusion and leaves the camera, and a
front-facing limb extended toward the opponent is the front of a limb seen
end-on however cleanly it was cut. So all ten are being redrawn side-on
instead, which fixes the occlusion and the camera in the same image: eleven
separable parts against five, and strikes that sweep twice as far relative to
the body throwing them. Two are done; see `ART-BRIEF-SIDE.md`.

## Art direction

Cinematic rendering of stylised characters: real-time lighting, contact shadows,
rim light, reflections, motion trails. Not photoreal — the characters are
roughly four to five heads tall with flat painterly shading, and realism would
throw them away.

## History

This repository previously held THREAD WAR, a stealth game about fashion as
municipal infrastructure. It was removed when the core idea changed to a
fighter. It is in the git history on this branch if any of it is ever wanted.

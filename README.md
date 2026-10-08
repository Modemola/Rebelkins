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

```sh
# 1. separate the subject from its backdrop
node tools/cutout.mjs <indir> <outdir> --auto --sheet

# 2. read joint positions in source pixels
node tools/rig-grid.mjs <cutout.png> grid.png --scale 2

# 3. cut into parts, heal what the limbs occlude, pack an atlas
node tools/rig.mjs <cutout.png> rigs/<name>.json <outdir> --debug
```

`tools/rig-preview.html` plays the result — seven moves, skeleton and part
overlays, so a rig can be judged before anything is built on it.

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

**Known limit:** a hard-edged 2D cut does not deform like a mesh, so the seam
where a sleeve meets a body shows under large rotations. Acceptable at fight
distance, not in a slow close-up.

## Rigs

| Rig | Character | Parts | Case |
| --- | --- | --- | --- |
| `rigs/kin08.json` | yellow coat, white bob | 7 | arms clear of the body — the easy case |
| `rigs/kin06.json` | navy jacket, cyan spikes | 5 | arms folded — arms stay welded on |

### What the two cases established

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

The lasting fix is one extra generation per folded-arm character, in an open
pose with the limbs clear of the body. Five of the ten need it.

## Art direction

Cinematic rendering of stylised characters: real-time lighting, contact shadows,
rim light, reflections, motion trails. Not photoreal — the characters are
roughly four to five heads tall with flat painterly shading, and realism would
throw them away.

## History

This repository previously held THREAD WAR, a stealth game about fashion as
municipal infrastructure. It was removed when the core idea changed to a
fighter. It is in the git history on this branch if any of it is ever wanted.

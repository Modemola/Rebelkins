# RebelKin — fighter

A one-on-one fighting game. You play the Kin; weapons unlock as you rank up.

Nothing of the game itself is built yet. What exists is the art pipeline, which
had to come first because it decides whether the game is possible at all.

## The constraint everything else follows from

The characters arrive as **one finished illustration each** — rendered on a flat
backdrop, no alpha, no 3D model behind them, no turnarounds, each in a different
hero pose. A fighter needs each character in roughly fifteen poses.

The way out is to stop treating an illustration as a picture and treat it as a
set of parts. Cut it along polygons, give each part a pivot and a parent, and
idle, walk, crouch, block, hit and most attacks all come out of that one drawing.

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

| Rig | Character | Case |
| --- | --- | --- |
| `rigs/kin08.json` | yellow coat, white bob | arms clear of the body — the easy case |

## Art direction

Cinematic rendering of stylised characters: real-time lighting, contact shadows,
rim light, reflections, motion trails. Not photoreal — the characters are
roughly four to five heads tall with flat painterly shading, and realism would
throw them away.

## History

This repository previously held THREAD WAR, a stealth game about fashion as
municipal infrastructure. It was removed when the core idea changed to a
fighter. It is in the git history on this branch if any of it is ever wanted.

# VESTA — the city, as built

How the master architecture is implemented, what is playable geometry, what is
data waiting to be built, and where a 2D game honestly cannot carry a 3D spec.

> VESTA is a walkable wardrobe after rain. Every street has a seam, a hook, a
> camera, a puddle, and a place to be seen. If I cannot photograph a RebelKin
> sneaker against the architecture and immediately know the district, the layout
> is wrong.

## Authored in metres, never in pixels

The architecture is human-first — sidewalks 4.5–7 m, shopfronts 3.2–4.8 m, no
400 m empty roads. None of that survives being typed as arbitrary pixel
coordinates, so nothing in `src/world/` is allowed to be.

`src/world/units.js` fixes the scale (26 px/m, a Kin's footprint being ~0.5 m)
and holds `LAW`: the document's hard numbers, in one place.

`src/world/build.js` compiles a metre-authored district into runtime walls,
zones and cameras. A district file therefore reads like the architecture
document rather than like a collision mesh.

## The street kit

`src/world/streetkit.js` generates all ten items, so a new street cannot quietly
forget its drains or float its cameras to eight metres:

| # | Item | Implementation note |
| --- | --- | --- |
| 1 | Kerb stone 18 cm | rounded, stained purple-black |
| 2 | Tactile paving | brass-yellow, ~12% studs missing, ~8% sequin-epoxy repairs |
| 3 | Puddle map | long skinny mirrors **parallel to the facade they reflect**, never blobs |
| 4 | Drain mouths | every 12–18 m, THREAD logo, ~30% clogged with hair-ties |
| 5 | Cameras at 3.4 m | housings read as steam irons or tailor clamps |
| 6 | Identity gates | frosted floor strips; they read your packet **instantly**, no cone to dodge |
| 7 | Railings 1.1 m | mustard or oxidized coral, chipped paint, crew cloth tags, see-through |
| 8 | Overhead wires | Lowline and Undercut only; Mirror Mile hides them |
| 9 | Smell proxies | modelled as steam plumes and vent exhaust — visible and audible |
| 10 | Fashionable trash | lost sleeves, cracked heels, mannequin hands, thermal receipts |

Plus cloth as a building material: banners, drying jackets and tarps strung
across the street rather than laid against a wall.

## Stalls are rules, not scenery

`src/world/stalls.js` — each of the five types carries its footprint *and* its
gameplay. Aisles stay 1.4–2.2 m. Tight on purpose; shoulders clip cloth.

| Type | Footprint | Rule |
| --- | --- | --- |
| A Bead and sequin booth | 2.4 × 1.8 m | — |
| B Shoe altar | 1.6 × 1.6 m | spotlight operator patrols; take the sneaker while turned away |
| C Hoodie tunnel | 2.2 × 6.5 m | **walkable corridor; cameras lose lock inside** |
| D Folk repair | 2.8 × 2.2 m | side-mission hook |
| E Illegal compile kiosk | 2.0 × 2.0 m | fogged interior; grants a compile |

A hoodie tunnel where cameras do not lose lock is just scenery, so type C
compiles into a real camera-blind volume that `MissionScene.scanRateFor` returns
zero for.

## Crowds are lanes

"Do not sprinkle NPCs. Build lanes." `src/world/lanes.js` builds fast (against
the shop windows), slow (under canopies), pose (at every reflective surface),
worker (at service doors) and Kin-only cuts. Civilians are placed on a lane and
travel it at that lane's speed band; pose-lane civilians hold still and check
themselves.

A district with no pose lane **fails the verifier**, on the document's own
grounds: if a space has no obvious place to stand and be seen, it is unfinished.

## The first build slice

`src/data/districts/lowline.js` — 80 m, not 180, exactly as instructed. The
terrace is three shallow steps, not a flat plate:

```
y  0 – 4    far bank, Null Court side (the extract lands here)
y  4 – 26   the Hem, 22 m of open canal
y 26 – 32   river lip promenade, 6 m
y 32 – 48   stall band, 16 m
y 48 – 57   arcade wall, 9 m covered walk
y 57 – 72   building mass and shop interiors
```

Every checklist item is present and checked: arcade wall with 4 shop depths,
7 stalls using all five types, river lip railing, one arched bridge extract
(22 m), one hoodie tunnel, one shoe altar, two scan strips, puddles that
reflect, cameras at 3.4 m, and a view to Runway Spire.

## Compliance is checked, not claimed

```sh
node tools/verify-vesta.mjs --verbose
```

118 assertions over the street kit, facades, stalls, crowd lanes, the slice
checklist, the six districts, the four connectors and the negative prompt.

Two things make it worth having rather than decorative:

**It keeps its own copy of the document's numbers.** A compliance check that
imports the same constant the builder imports is a tautology — move the constant
and both sides move together while the city drifts. The verifier transcribes the
numbers by hand and *audits `src/world/units.js` against them*, so editing the
code's law fails three checks and names the file.

**It caught things during this build.** The emptiness check originally measured
gaps along one axis and passed while a whole half of the terrace was bare; it is
now a grid occupancy test over the walkable ground. That rewrite immediately
exposed a second bug — a partial last row was silently dropping everything
standing in it, which had been hiding the undressed arcade walk behind a row of
puddles it discarded.

## Built vs. specified

**Built and playable:** Lowline terrace, with the full street kit, all five
stall types, lane-driven crowds, camera-blind volumes, instant scan gates, the
three-step terrace, the arched bridge extract, and a parallaxed view to Runway
Spire and Mirror Mile.

**Specified in data, not yet geometry** (`src/data/districts/index.js`): Mirror
Mile, Runway Spire, Undercut, Null Court and the Flood carry their dimensions,
materials, facade systems, tiny details, sound signatures and scenarios so they
are built to the same language rather than reinvented. The four connectors carry
their travel times and the rule each one teaches.

**Still on pre-VESTA layouts:** the Trendbomb and Facejack contracts use the
older arbitrary-pixel maps. They are queued for rebuild against the street kit;
the verifier currently only holds Lowline to the law.

## What a 2D game cannot carry

Stated plainly rather than quietly skipped:

- **Ceiling heights, storey counts and 18 mm structural glass** are recorded as
  data and expressed through footprint, colour and light, not geometry.
- **The four vertical layers** (soles / cut / shoulder / collar) exist in the
  data model. Lowline plays on soles and cut (street plus enterable interiors);
  shoulder and collar are authored but not yet traversable, so "sole to shoulder
  without a loading screen" is **not yet true** and is the next real piece of
  work.
- **Light temperature in kelvin** becomes a palette, not a physical model.
- **Smell** becomes steam, shimmer and sound.
- **Sound as architecture** is specified per district but not implemented — the
  game has no audio at all yet.

## Negative prompt

Kept in code (`NEGATIVE` in `src/data/districts/index.js`) so it can be checked
rather than merely felt. The verifier asserts against the ones that are
measurable: no eight-lane empty highway, no wet concrete with no stores, no
cameras as decoration, no neon on a black void, no bare ground, and streets more
interesting than they are wide.

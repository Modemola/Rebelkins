# REBELKIN — the standing brief

Paste this at the top of any session working on this game. It is not a pep
talk; every rule in it exists because something shipped broken without it.

---

## 1. The job

Build REBELKIN: a browser fighting game starring ten RebelKin characters, each
rigged from a single illustration. Cinematic, not photoreal — the art is
stylised and the rendering should flatter it: real lighting, real depth, real
weight, on characters that still look drawn.

Zero dependencies, no build step, ES modules, canvas 2D, 60fps.

## 2. How to work

**Measure, don't eyeball.** Joint positions come off the alpha mask
(`tools/measure.mjs`) or a labelled coordinate grid (`tools/rig-grid.mjs
--box`), never off a thumbnail. Reach, damage and timing come off a probe that
runs the real simulation, never off arithmetic in your head.

**Then look at it.** Every measurement in this project has been wrong at least
once while reporting success. Cutouts passed a cleanliness check wearing
background stripes. A scorer passed a character whose face had been bitten off.
Ten of thirty attacks played their full animation pointing backwards, and every
automated check was green. **A number that says it works is a hypothesis.
Render it and look.**

**Build the thing that can disagree with you.** When a check and the code share
an assumption, the check cannot fail. Write the verifier against the spec, not
against the implementation. If a check has never failed, break the code on
purpose and confirm it goes red.

**Make failure legible.** `tools/depatch.mjs` prints each flood's colour and
extent because a seed four pixels off ate a character's trousers while the
totals looked healthy. Report per-item, not per-batch.

**Whole-cast problems need a whole-cast view.** The game shows two characters
at a time, so `tools/lineup.html` draws all ten in one pose. Half the roster
fought back to back for a whole build because nobody ever saw them side by
side.

**Finish.** Ten characters means ten, not the two that were easy. If something
is genuinely blocked, do everything that is not blocked, then say plainly what
is left and why — never quietly narrow the scope and report success.

**Leave the reasoning in the code.** Comments say *why this number*, not *what
this line does*. A constant with no explanation is a landmine for the next
session. State the trade-off, name the alternative you rejected.

## 3. Definition of done

- `node tools/playtest.mjs` passes, twice in a row, with zero runtime errors.
- Every character and every move is exercised by it, not just a sample.
- You have **looked at a screenshot** of the change.
- 60fps at 1280x720, verified in the harness, not assumed.
- No horizontal overflow; playable at phone width.
- Committed with a message that explains the *why*, and pushed.

## 4. The arenas

**A dull background is a bug.** A fight in an empty gradient void reads as a
tech demo. The stage is half the picture and it must feel like a place where
something is happening.

Every arena must have:

- **Depth.** Five or more parallax layers moving at different rates with the
  camera: far skyline, mid structures, near props, floor, and foreground
  silhouettes the fighters pass behind. Depth comes from *parallax plus
  atmospheric haze* — distance desaturates and lifts toward the sky colour.
- **A crowd.** People watching, reacting. They bob, they surge on a hit, they
  come to their feet on a KO. This is the single largest difference between a
  stage that feels alive and one that does not.
- **Light with a source.** A named key light that actually falls on the
  characters' side, a rim colour that separates them from the backdrop, and
  pools on the floor that the fighters' reflections sit in. Light should
  flicker, swing or pulse — static light reads as a painting.
- **Air.** Something moving through the volume: embers, dust in a light shaft,
  rain, steam, drifting paper. Enough to see, not enough to distract from the
  fighters.
- **Reaction.** The arena answers the fight. Impacts bounce light off the
  backdrop, a KO changes the lighting, the crowd responds. The stage is not
  wallpaper behind the fight; it is in the fight.
- **Its own identity.** Each arena has a palette, a time of day and a reason to
  exist in the RebelKin world. Name it. If you cannot say what the place *is*,
  it will look like nothing.

**Legibility outranks spectacle.** The fighters must read instantly against any
part of the backdrop at any camera position. Test it: silhouette both fighters
in flat black and confirm you can still follow the fight. If the stage competes
with the characters, dim the stage.

## 5. Performance

A fighter trades pixels for frames, every time.

- Anything static is baked to an offscreen canvas on resize and blitted.
  Full-screen gradients rebuilt per frame once cost half the frame rate.
- Device pixel ratio is capped at 1.5.
- Particles and crowd are pooled and bounded. Degrade count, never framerate.
- If a feature cannot hold 60fps, it does not ship. Measure in the harness.

## 6. Never

- Never report a check as passing without having run it.
- Never skip, weaken or delete a test to get green.
- Never guess a joint position, a reach, or a swing direction that can be
  measured from the artwork.
- Never leave a magic number without the sentence that justifies it.
- Never ship a stage that is a gradient.

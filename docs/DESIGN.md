# THREAD WAR — design notes

What the slice implements, why it is shaped this way, and what the full game
still needs. The pitch and the roster live in `README.md` and
`CHARACTER_BIBLES.md`; this is the systems document.

## 1. The one rule everything hangs off

VESTA runs on THREAD. It scans silhouette, colour, accessory, stance, species and
hair, then assigns a **public identity packet**. Cameras, doors, guards and
civilians all read the packet. None of them read the person.

That is the exploit, and it is the reason the game is not a stealth game with a
fashion skin. In a normal stealth game, being seen is the failure. Here being
seen is the job — a runway model is seen constantly and never in trouble. The
failure is being seen *reading wrong for the room*.

So the core rule, implemented in `MissionScene.resolveScan`:

> A completed camera scan is not automatically a problem. THREAD checks your
> packet against the zone it caught you in. If the zone accepts the packet you
> are filed as *invited* and pay a small amount of Heat for being memorable. If
> it does not, you are **flagged**.

Everything else follows. Presence is not a liability, it is a resource you spend
in rooms that want it. Ignore is not strictly better than Presence. And "walk in
looking like you belong" stops being flavour text.

## 2. The packet

`src/systems/thread.js` compiles `(Kin, Thread, district, licences, overlays)`
into:

| Field | Meaning |
| --- | --- |
| `access` | integer 0–4, what doors check |
| `desirability` | how much the city wants to look at you |
| `threat` | how a guard reads you if it comes to that |
| `ignore` | how easy you are to socially miss |
| `mimic` | how fast civilians copy your accessory |
| `tasteMatch` | how well your tags match what the district wants |
| `clash` | the illegal tag pair you are wearing, if any |
| `scanRate` | multiplier on how fast a camera fills its bar on you |

Tags are the interface between clothes and the world: `street loud quiet luxury
holo folk craft kinetic new`. Districts want some and reject others; zones want
some and reject others; the same jacket therefore reads differently three blocks
apart, which is the entire fiction working as arithmetic.

**Clash** is the `illegal compile` failure state. `loud`+`quiet` and
`folk`+`holo` are pairs THREAD cannot file, and wearing one trips an alarm — until
you buy the Illegal Compiles overlay, at which point choking the protocol becomes
a tool instead of a mistake.

## 3. Doors, and why racks are keys

`readDoor(packet, zone)` returns a verdict *and a reason*, because the reason is
the interesting part and the HUD prints it. A zone can gate on access level,
wanted tags, rejected tags and a minimum desirability.

Two things open a door you are not dressed for:

- **Abilities.** Mirror's Glass Coat borrows a nearby packet (+access, +luxury
  +holo). Folk Glitch's Old Door opens ceremonial spaces.
- **Racks.** A rack with stock lends you the floor's own read for 75 seconds.
  This is the literal version of the premise: pull a piece off the lounge rack
  and you scan as the people who shop there.

Racks exist because the first contract has to be solvable by the starting roster
(Spark and Soft Lock), and neither of them can reach the vault's access level by
compiling alone. The intended Ghost Fit solution is a three-step chain that
teaches the whole game in twelve minutes:

1. Compile **Too Much**. You cannot rank your way onto the members floor, so be
   too interesting to refuse — the floor gates on desirability, not status.
2. Pull a piece off the **lounge rack**. Now you read luxury, which the vault wants.
3. Compile back to **Matchhead** before the Heat from wearing Too Much kills you.

Step 3 is the lesson: wear the loud thing exactly as long as the door needs it.

## 4. Heat is the clock

There is no mission timer except on Trendbomb. Heat is the pressure.

- Cap: `30 + average(crew heatCap) × 12`. Spark alone runs on 66. Soft Lock alone
  runs on 126. The fragile loud one is *mechanically* fragile.
- A scan that reads legitimate costs `2 + desirability × 0.2`.
- A flag costs 12 and raises district Alert. A guard challenge costs 18.
- Too Much doubles all Heat gain through its thread mod.
- Heat decays at 2.4/s while nothing is watching you. The city forgets, slowly.

Alert (0–3) speeds up camera sweeps and guard patrols, so a bad minute
compounds without ever needing a scripted alarm state.

## 5. Combat is the backup plan

There is no gun and no health bar. The whole kit is:

Dash · Blend · Mark · Compile/decompile · Style break · Extract walk

**Style break** (`R`) is the only "combat" verb, and it is a perfect dodge
against attention rather than against a bullet: pressed while a camera is
actively filling its bar on you, it breaks the lock, stuns the camera, pays out
Style and costs a little Heat. Pressed at nothing, it costs you Style — that is
just posing.

The design document's rule holds: if a fight lasts more than 25 seconds the
loadout is wrong. Here that is enforced by there being nothing to fight with.

## 6. The extraction walk

Every contract ends on a runway. Eighteen beats, four poses, arrows or WASD.
Perfect windows are ±0.11s, good ±0.24s. The district's taste is the multiplier:
tags it wants score ×1.25 or better, tags it rejects score ×0.75 or worse.

This is where the failure states resolve, and all four are stylish rather than
punitive:

| Code | Cause |
| --- | --- |
| `overexposed` | Heat hit the cap — too famous to walk out clean |
| `unread` | more than nine missed beats — the runway stopped looking |
| `copied` | the crowd took your drip; you are not unique any more |
| `clash` | an illegal compile tripped THREAD mid-run |

## 7. The crowd

The hardest tech in the real game, faked correctly here: civilians are taste
buckets (`copy`, `loyal`, `neutral`), not brains. They wander, they path to a
Letterbomb rally point, they gather around Beadwork, and they copy your accessory
at a rate driven by your packet's `mimic` and `desirability`.

Three civilians within 90px halves your scan rate — crowds are cover. Beadwork
makes it a quarter. That single number is why Folk Glitch is godlike in a market
and useless in a corridor, without any special-casing.

## 8. Progression

You do not level a gun, you level an Atelier: crew slots, a faster bench
compiler, illegal compiles, forged provenance, species licences, district taste
maps, a camera registry, tribute relics.

Four reputation tracks move independently — **Heat** with the city, **Taste** with
the fashion houses, **Kinship** with the non-human blocks, **Myth** with the
street. There is deliberately no single score to maximise, because the city is
four audiences that do not agree.

The endgame is not a boss. It is owning a look so specific the city has to
rewrite a district around you.

## 9. The art rule as code

> They should look 3D from far away and drawn up close.

`src/art/kinart.js` implements this literally. Every body part is a filled volume
with a vertical gradient (reads round) plus an outline whose opacity and weight
are driven by `detailFor(scale)` — a dial from on-screen size. The same call
renders a 20px crowd dot and a 400px bible portrait; nothing is authored per
zoom level. Faces, laces, hair clips, bead strings and holo seams only resolve
past their own detail thresholds.

Silhouette is the second law, enforced by making each Kin a different *shape*
rather than a different texture:

| Kin | Silhouette at 64px |
| --- | --- |
| Spark | spikes blowing off the skull |
| Soft Lock | one big round hood, no neck |
| Driver | low round body, crest, shoes too big for it |
| Mirror | tall vertical line, coat flare |
| Folk Glitch | wide grounded triangle |
| The Pair | two bodies, one composition |

## 10. What the full game still needs

**Districts.** Runway Spire (vertical, theatrical), Undercut (species traits
matter more than clothes), Null Court (buy an illegal face for 90 seconds), The
Flood (live trait rain, best loot). Lowline and Mirror Mile are built.

**Mission types.** Sample Run, Soft Riot and Pair Split are specified but not
built; Ghost Fit, Trendbomb and Facejack are.

**Vehicles.** Driver's Hotwired Fit currently grants speed and reads as flavour.
The car should be an entity that bonds to Driver, with a real getaway phase.

**Multiplayer.** 2–4 player crews plus rival crews: strip a rival's accessory
mid-run, wear their drip for their personality buff, contest the extraction
runway, let spectators tip style points. The IP lives on public building and
tribute art; the game should too.

**Crowd at scale.** Taste buckets hold to about fifty civilians. A real district
needs spatial hashing and LOD'd mimicry before it holds a thousand.

**Audio.** Sneakers, chains, crowd murmur, runway pulses, car interiors.

## 11. First playable test

The design document's own acceptance test, which the slice supports: run the same
Ghost Fit three times —

- Spark + Soft Lock
- Mirror + Soft Lock
- The Pair alone

If those three runs feel like different sports in the same city, the roster is
working. (Two- and three-Kin crews need the crew-slot upgrades, so this test
starts one contract in.)

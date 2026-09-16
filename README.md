# REBELKIN: THREAD WAR

A crew of RebelKin pull social heists in a city where fashion is executable code.
Change your fit, change who the world thinks you are.

This repository is a **playable vertical slice**: six Kin, eighteen Threads,
three contracts, and the full loop from contract select through infiltration to
the extraction walk and cash-out.

## Run it

No build step, no dependencies. It is ES modules and a canvas, so it needs to be
served over HTTP rather than opened as a `file://` URL:

```sh
npx http-server . -p 8080 -c-1
# or: python3 -m http.server 8080
```

Then open <http://localhost:8080>.

## Controls

| Key | Verb |
| --- | --- |
| `WASD` / arrows | Move |
| `Shift` (hold) | Blend — slower, half the scan rate |
| `Space` | Dash (breaks Hood Protocol, cancels a compile) |
| `Q` | Thread ability |
| `R` | Style break — perfect dodge out of a camera lock |
| `F` | Mark a target socially |
| `Z` / `X` / `C` | Compile Thread A / B / C (3s cast) |
| `E` | Interact — props, racks, VIPs |
| `1`–`4` | Swap active Kin (and switch hub tabs) |
| `Esc` | Abort the run |

On the extraction walk, arrows or WASD on the beat.

## The loop

1. Pick a contract.
2. Build a crew of 1–4 Kin (crew slots are an Atelier upgrade; you start with one).
3. Compile a Thread for each.
4. Infiltrate. Doors read your packet, not your face.
5. Complete the social objective.
6. Extract on a short runway walk while the district scores your fit.
7. Cash out traits, reputation and heat.
8. Upgrade the Atelier.

## What is actually implemented

- **THREAD protocol** (`src/systems/thread.js`) — compiles a Kin + Thread into a
  public identity packet: access, threat, desirability, ignore, crowd-mimic
  chance, and clash detection for illegal tag pairs.
- **Doors that read clothes** — zones check access, wanted tags, rejected tags
  and minimum desirability, and the HUD prints the *reason* a door refused you.
- **Cameras that flag you for reading wrong, not for being visible.** A completed
  scan checks your packet against the room it caught you in. A packet the room
  accepts gets filed as "invited" and only costs a little fame. This is the
  premise as a rule: walk in looking like you belong and cameras are a formality.
- **Guards** who read packets against the zone rather than hunting intruders.
- **Crowd** with taste buckets — cover when dense, mimicry when you are
  desirable, and a `copied` failure state when they take your drip.
- **Six Kin, three Threads each**, with distinct abilities (Hood Protocol, Glass
  Coat, Matchhead, Beadwork, Two Doors, Afterimage…).
- **Three contracts** — Ghost Fit, Trendbomb, Facejack — across two districts.
- **Extraction walk** — an 18-beat runway scored by the district's own taste.
- **Stylish failure states** — overexposed, unread, clash, copied.
- **Atelier progression** — crew slots, illegal compiles, species licences,
  taste maps, relics; four reputation tracks; localStorage save.
- **Procedural 2.5D character art** (`src/art/kinart.js`) — smooth gradient
  volumes with linework whose weight is keyed to on-screen scale, so characters
  read as 3D from far away and drawn up close. Nothing is a stolen asset; every
  Kin is drawn from the trait stack in the bible.

## What is deliberately not here

- No models, textures or sampled art of any kind. The reference-wall workflow and
  the 15-plate shot list live in `docs/CHARACTER_BIBLES.md` as a production
  document; the shipped art is procedural stand-in that respects the same rules.
- No audio.
- Districts 3–6 (Runway Spire, Undercut, Null Court, The Flood), vehicles,
  multiplayer and rival crews are specified in `docs/DESIGN.md`, not built.
- The Trendbomb target is 18 copies rather than the design document's 40, tuned
  to the slice's crowd size.

## Verify it

The playthrough test drives a real browser through Ghost Fit with real keyboard
input — no state injection — and asserts every objective, the door maths, the
runway scoring and the unlock:

```sh
node tools/playtest.mjs            # headless
node tools/playtest.mjs --headed   # watch it play
```

A second check proves every gated zone in every contract is openable by the
roster the player actually has at that point — a door nobody can open is a dead
run, and that maths is invisible until someone gets stuck:

```sh
node tools/verify-doors.mjs --verbose
```

Regenerate the character bibles after changing roster data:

```sh
node tools/build-bibles.mjs        # write
node tools/build-bibles.mjs --check # fail if stale
```

## Layout

```
index.html
src/
  main.js            boot + title
  core/              loop, input, save, canvas UI primitives
  data/              kin (the six bibles), missions, atelier, shot lists
  systems/thread.js  the THREAD protocol
  art/               procedural Kin rendering, VESTA rendering
  scenes/            hub, mission, runway, results
docs/
  CHARACTER_BIBLES.md  generated from src/data
  DESIGN.md            systems, and what the full game still needs
tools/
  playtest.mjs         automated browser playthrough
  verify-doors.mjs     proves every contract is completable
  build-bibles.mjs     doc generator
```

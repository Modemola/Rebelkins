/**
 * The arena, and the camera that frames it.
 *
 * The camera is doing real work: it tracks the midpoint between the fighters
 * and zooms to keep both in frame, so distance between them is readable at a
 * glance. That is most of why a fight looks shot rather than just drawn.
 */

export class Camera {
  constructor() { this.x = 0; this.y = 0; this.zoom = 1; this.shake = 0; this.kick = { x: 0, y: 0 }; }

  follow(a, b, view, dt) {
    const mid = (a.x + b.x) / 2;
    const spread = Math.abs(a.x - b.x);
    // Framing, not just following, under two constraints -- the tighter wins.
    //
    // By height: a fighter stands 0.60 of the frame. That leaves room for the
    // floor and its reflection below and a jump's worth of headroom above
    // (jumpVel 660 against gravity 2000 is 109 world units of rise), given the
    // horizon sits at 0.59 of the frame and the camera rides 150 units above
    // the floor line. 0.59 rather than 0.63: at the zoom a KO pushes in to,
    // the extra four percent is the difference between a visible wet floor and
    // the reflection falling off the bottom edge. Those three numbers are solved together: raise the zoom
    // on its own and the shoes leave the bottom of the screen.
    //
    // By width: both fighters, their own girth, and a margin have to fit
    // across. 0.92 leaves a 4% gutter each side so nobody's hair is clipped
    // while they are still on the stage. The girth term is the pair's hurtbox
    // radii -- the only width the simulation actually knows about -- with 1.1
    // for the art that overhangs it, and 50 units of air between the outer
    // fighter and the frame edge.
    //
    // Framing by width alone was tuned on a 1280-wide window. On a portrait
    // phone the width term dominates by a factor of three, and nothing in the
    // calculation was asking how tall the characters ended up: it put them on
    // screen at a quarter of the frame height and the check passed, because the
    // check was only asking whether they were on screen at all.
    const bodies = (a.def.bodyHeight * a.def.scale + b.def.bodyHeight * b.def.scale) / 2;
    const girth = (a.def.hurtRadius * a.def.scale + b.def.hurtRadius * b.def.scale) * 1.1;
    const byHeight = (view.h * 0.60) / bodies;
    const byWidth = (view.w * 0.92) / (spread + girth + 50);
    // 2.2 is where a 300-unit figure fills a 720px frame top to bottom; 0.55 is
    // where two of them at opposite ends of the widest arena still both fit.
    const want = Math.max(0.55, Math.min(2.2, Math.min(byHeight, byWidth)));
    this.zoom += (want - this.zoom) * Math.min(1, dt * 4);
    this.x += (mid - this.x) * Math.min(1, dt * 6);
    const lift = -150 - Math.max(0, -Math.min(a.y, b.y)) * 0.42;
    this.y += (lift - this.y) * Math.min(1, dt * 4);
    this.shake *= 0.86;
    this.kick.x *= 0.80;
    this.kick.y *= 0.80;
  }

  apply(ctx, view, dpr) {
    const sx = (Math.random() - 0.5) * this.shake + this.kick.x;
    const sy = (Math.random() - 0.5) * this.shake + this.kick.y;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(view.w / 2 + sx, view.h * 0.59 + sy);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x, -this.y - 0);
  }

  bump(power) { this.shake = Math.min(26, this.shake + power); }
}

import { ARENAS, Arena } from './arena.js';

/**
 * The stage is whichever arena this match is being fought in. This module
 * keeps the camera and hands every actual pixel to `arena.js`, so adding a
 * place to fight never touches the renderer.
 */
let active = new Arena(ARENAS[0]);

export function setArena(id) {
  const def = ARENAS.find((a) => a.id === id)
    ?? ARENAS[(Math.random() * ARENAS.length) | 0];
  if (active.def.id !== def.id) active = new Arena(def);
  return active.def;
}

export function arena() { return active; }

export function drawStage(ctx, view, cam, t, dpr) {
  active.drawBack(ctx, view, cam, dpr);
}

/** Floor plane, drawn in world space under the fighters. */
export function drawFloor(ctx, cam) {
  active.drawFloor(ctx, cam);
}

/** Weather and the foreground silhouettes, drawn over the fighters. */
export function drawFore(ctx, view, cam, dpr) {
  active.drawFore(ctx, view, cam, dpr);
}

export function drawVignette() { /* folded into drawFore, kept for the old call site */ }

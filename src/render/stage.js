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
    // Framing, not just following. The three numbers here, this clamp and the
    // 0.63 and 150 below, are solved together: at the stage's minimum spacing a
    // ~305-unit figure should stand about 62% of the frame tall with its feet
    // near the bottom edge and enough headroom left over for a jump. Raise the
    // zoom alone and the shoes go off the bottom of the screen.
    const want = Math.max(0.60, Math.min(1.46, (view.w * 0.60) / (spread + 380)));
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
    ctx.translate(view.w / 2 + sx, view.h * 0.63 + sy);
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

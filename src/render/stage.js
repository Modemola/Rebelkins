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
    const want = Math.max(0.62, Math.min(1.18, (view.w * 0.52) / (spread + 440)));
    this.zoom += (want - this.zoom) * Math.min(1, dt * 4);
    this.x += (mid - this.x) * Math.min(1, dt * 6);
    const lift = -140 - Math.max(0, -Math.min(a.y, b.y)) * 0.35;
    this.y += (lift - this.y) * Math.min(1, dt * 4);
    this.shake *= 0.86;
    this.kick.x *= 0.80;
    this.kick.y *= 0.80;
  }

  apply(ctx, view, dpr) {
    const sx = (Math.random() - 0.5) * this.shake + this.kick.x;
    const sy = (Math.random() - 0.5) * this.shake + this.kick.y;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(view.w / 2 + sx, view.h * 0.74 + sy);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x, -this.y - 0);
  }

  bump(power) { this.shake = Math.min(26, this.shake + power); }
}

const SKY = ['#1a1322', '#120d1a', '#0a070e'];

/**
 * Full-screen gradients are the expensive part of this renderer, and none of
 * them change between frames. They are baked into offscreen layers on resize
 * and blitted; rebuilding them every frame cost roughly half the frame rate.
 */
const cache = { w: 0, h: 0, sky: null, vignette: null, floorGrad: null };

function bake(view) {
  if (cache.w === view.w && cache.h === view.h) return;
  cache.w = view.w;
  cache.h = view.h;

  const sky = document.createElement('canvas');
  sky.width = Math.max(1, view.w);
  sky.height = Math.max(1, view.h);
  const sx = sky.getContext('2d');
  const g = sx.createLinearGradient(0, 0, 0, view.h);
  g.addColorStop(0, SKY[0]);
  g.addColorStop(0.58, SKY[1]);
  g.addColorStop(1, SKY[2]);
  sx.fillStyle = g;
  sx.fillRect(0, 0, view.w, view.h);
  for (let i = 0; i < 3; i++) {
    const hx = view.w * (0.22 + i * 0.3);
    const r = sx.createRadialGradient(hx, view.h * 0.42, 20, hx, view.h * 0.42, view.w * 0.4);
    r.addColorStop(0, ['rgba(245,197,24,.06)', 'rgba(82,216,239,.055)', 'rgba(255,77,109,.05)'][i]);
    r.addColorStop(1, 'rgba(0,0,0,0)');
    sx.fillStyle = r;
    sx.fillRect(0, 0, view.w, view.h);
  }
  cache.sky = sky;

  const vig = document.createElement('canvas');
  vig.width = Math.max(1, view.w);
  vig.height = Math.max(1, view.h);
  const vx = vig.getContext('2d');
  const v = vx.createRadialGradient(
    view.w / 2, view.h * 0.5, Math.min(view.w, view.h) * 0.3,
    view.w / 2, view.h * 0.52, Math.max(view.w, view.h) * 0.78,
  );
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,.62)');
  vx.fillStyle = v;
  vx.fillRect(0, 0, view.w, view.h);
  cache.vignette = vig;
}

export function drawStage(ctx, view, cam, t, dpr) {
  bake(view);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.drawImage(cache.sky, 0, 0, view.w, view.h);
  const px = -cam.x * 0.08;

  // the crowd line: a band of little screen-lights behind the action
  ctx.save();
  ctx.globalAlpha = 0.55;
  for (let i = 0; i < 52; i++) {
    const seed = i * 97.13;
    const x = ((seed * 7.3 + px * 0.5) % (view.w + 80)) - 40;
    const y = view.h * 0.46 + ((seed * 3.1) % 46);
    const tw = (Math.sin(t * 2 + seed) + 1) / 2;
    ctx.fillStyle = `rgba(${180 + (seed % 60)},${200 - (seed % 40)},255,${0.05 + tw * 0.16})`;
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.restore();
}

/** Floor plane, drawn in world space under the fighters. */
export function drawFloor(ctx, cam, view) {
  const halfW = 3000;
  if (!cache.floorGrad) {
    const g = ctx.createLinearGradient(0, 0, 0, 520);
    g.addColorStop(0, 'rgba(22,18,28,.95)');
    g.addColorStop(1, 'rgba(8,6,12,1)');
    cache.floorGrad = g;
  }
  ctx.fillStyle = cache.floorGrad;
  ctx.fillRect(-halfW, 0, halfW * 2, 520);

  ctx.strokeStyle = 'rgba(82,216,239,.22)';
  ctx.lineWidth = 2 / cam.zoom;
  ctx.beginPath();
  ctx.moveTo(-halfW, 0.5);
  ctx.lineTo(halfW, 0.5);
  ctx.stroke();

  // receding guides, so motion along the floor has something to read against
  ctx.strokeStyle = 'rgba(255,255,255,.035)';
  ctx.lineWidth = 1.5 / cam.zoom;
  for (let x = -2400; x <= 2400; x += 160) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x * 1.45, 460);
    ctx.stroke();
  }
}

export function drawVignette(ctx, view, dpr) {
  if (!cache.vignette) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.drawImage(cache.vignette, 0, 0, view.w, view.h);
}

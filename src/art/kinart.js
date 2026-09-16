/**
 * KIN ART — procedural placeholder rendering.
 *
 * Style model, taken from the collection's own artwork rather than guessed:
 *
 *   CEL, NOT GRADIENT. Form is described by a hard-edged shadow shape, never by
 *   a blend. The shadow is the same silhouette offset toward the light's
 *   opposite corner and clipped, which is cheap and always follows the form.
 *
 *   LINEWORK IS STRUCTURAL. Heavy near-black outlines on every mass, not a
 *   detail that fades in at high zoom. This is what makes "3D from far away,
 *   drawn up close" true at both distances -- the shadow gives the volume, the
 *   line keeps it drawn.
 *
 *   THE FACE IS THE CHARACTER. Anime construction: large sclera, dark iris, a
 *   hard white highlight, a thick upper lash line, and a mouth that actually
 *   opens. Attitude first -- a Kin standing there blank is a bug.
 *
 *   SATURATED AND LOUD. Colour is not tasteful. Accessory density is the point.
 *
 * This is a stand-in. Real plates from assets/ replace it per Kin the moment
 * they exist (see sprites.js); what matters is that the placeholder reads as
 * the same world, so a half-arted roster does not look broken.
 */

import { pickPlate, drawPlate, UNIT_HEIGHT } from './sprites.js';

const TAU = Math.PI * 2;
const INK = '#17101f';

/** Light sits upper-left, so every shadow is offset down-right by this. */
const LIGHT = { x: 1.3, y: 1.5 };

/** How drawn should this be? Linework never disappears, it only thins. */
function detailFor(scale) {
  return clamp((scale - 0.4) / 1.1, 0, 1);
}

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  if (amt >= 0) {
    // toward warm white
    const t = amt * 1.6;
    return `rgb(${mix(r, 255, t)},${mix(g, 252, t)},${mix(b, 240, t)})`;
  }
  // Toward a violet dark, never toward grey: desaturated shadows are exactly
  // what makes cel shading look muddy, and this art keeps its chroma in the dark.
  const t = -amt * 1.7;
  return `rgb(${mix(r, 58, t)},${mix(g, 34, t)},${mix(b, 78, t)})`;
}

function mix(a, b, t) {
  return Math.round(a + (b - a) * clamp(t, 0, 1));
}

/**
 * A cel-shaded mass: flat fill, one hard shadow, one outline.
 *
 * The shadow is the same path offset toward the shadow side and clipped to the
 * original, which leaves a lit crescent on the light side. It costs one extra
 * fill and it cannot produce a shadow that disagrees with the silhouette.
 */
function cel(ctx, path, color, detail, opts = {}) {
  const lw = opts.lw ?? 1.5;
  const shadowAmt = opts.shadow ?? -0.2;
  const push = opts.push ?? 1;

  ctx.fillStyle = color;
  ctx.beginPath();
  path(ctx);
  ctx.fill();

  if (shadowAmt !== 0) {
    ctx.save();
    ctx.beginPath();
    path(ctx);
    ctx.clip();
    ctx.fillStyle = shade(color, shadowAmt);
    ctx.translate(LIGHT.x * push, LIGHT.y * push);
    ctx.beginPath();
    path(ctx);
    ctx.fill();
    ctx.restore();
  }

  if (opts.highlight) {
    ctx.save();
    ctx.beginPath();
    path(ctx);
    ctx.clip();
    ctx.fillStyle = shade(color, opts.highlight);
    ctx.translate(-LIGHT.x * 1.5, -LIGHT.y * 1.6);
    ctx.beginPath();
    path(ctx);
    ctx.fill();
    ctx.restore();
  }

  if (lw > 0) {
    ctx.strokeStyle = opts.ink || INK;
    ctx.lineWidth = lw * (0.45 + 0.55 * detail);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    path(ctx);
    ctx.stroke();
  }
}

const ellipsePath = (cx, cy, rx, ry, rot = 0) => (ctx) => ctx.ellipse(cx, cy, rx, ry, rot, 0, TAU);

function roundRectPath(x, y, w, h, r) {
  return (ctx) => {
    const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  };
}

function polyPath(pts) {
  return (ctx) => {
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  };
}

/* ------------------------------------------------------------------- rig */

/**
 * Roughly five heads tall. The reference art is not chibi: these are stylised
 * anime proportions with legs long enough to carry a pose and a torso long
 * enough to hang clothes on, which is the whole point when clothes are the
 * mechanic.
 */
const RIG = {
  groundY: 4,
  shoeH: 5.4,
  legH: 20.5,
  torsoH: 17,
  neckH: 2.4,
  headR: 6.6,
};
export const RIG_HEIGHT = 58;

export function drawKin(ctx, o) {
  const { kin, x, y } = o;
  const scale = o.scale ?? 1;
  const facing = o.facing ?? Math.PI / 2;
  const phase = o.phase ?? 0;
  const moving = o.moving ?? 0;
  const detail = detailFor(scale);
  const look = kin.look;

  // Real artwork wins whenever it exists.
  const plate = pickPlate(kin.id, { facing, moving, phase, mode: o.mode });
  if (plate) {
    contactShadow(ctx, x, y, scale, plate.heightMul);
    const bob = moving > 0.12 ? Math.sin(phase * 2) * 1.6 * scale : Math.sin(phase) * 0.5 * scale;
    drawPlate(ctx, plate, x, y - bob, scale, {
      alpha: (o.alpha ?? 1) * (o.ghost ? 0.42 : 1),
      glow: o.glow,
    });
    if (o.flagged || o.marked) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      if (o.flagged) drawFlagRing(ctx);
      if (o.marked) drawMarkChevron(ctx);
      ctx.restore();
    }
    return;
  }

  ctx.save();
  ctx.globalAlpha = (o.alpha ?? 1) * (o.ghost ? 0.42 : 1);
  ctx.translate(x, y);
  contactShadowLocal(ctx, scale);
  ctx.scale(scale, scale);

  const lean = Math.cos(facing) * 2.6;
  const depth = Math.sin(facing);
  const bob = Math.sin(phase * 2) * (0.5 + moving * 1.2);
  const swing = Math.sin(phase) * moving;

  if (look.build === 'duo') {
    drawBody(ctx, { kin, look, detail, lean: lean - 6.5, bob, swing, depth, variant: 'quiet', squash: 0.94 });
    ctx.save();
    ctx.translate(9.5, -1);
    drawBody(ctx, { kin, look, detail, lean: lean + 2, bob: -bob, swing: -swing, depth, variant: 'loud' });
    ctx.restore();
  } else {
    drawBody(ctx, { kin, look, detail, lean, bob, swing, depth, expression: o.expression });
  }

  if (o.flagged) drawFlagRing(ctx);
  if (o.marked) drawMarkChevron(ctx);
  ctx.restore();
}

function contactShadow(ctx, x, y, scale, heightMul = 1) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(x, y + 2 * scale, 14 * scale * heightMul, 5 * scale, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function contactShadowLocal(ctx, scale) {
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(0, 2 * scale, 14 * scale, 5 * scale, 0, 0, TAU);
  ctx.fill();
}

/* ------------------------------------------------------------------ body */

function drawBody(ctx, s) {
  const { kin, look, detail, lean, bob, swing, depth } = s;
  const pal = kin.palette;
  ctx.save();
  if (s.squash) ctx.scale(1, s.squash);

  const build = look.build;
  const legH = RIG.legH * (build === 'stub' ? 0.42 : build === 'tall' ? 1.12 : build === 'small' ? 0.94 : 1);
  const torsoH = RIG.torsoH * (build === 'stub' ? 0.9 : build === 'tall' ? 1.06 : 1);
  const headScale = build === 'stub' ? 1.3 : build === 'tall' ? 0.94 : build === 'small' ? 1.04 : 1;

  const shoeTop = RIG.groundY - RIG.shoeH;
  const hipY = shoeTop - legH;
  const torsoTop = hipY - torsoH;
  const headY = torsoTop - RIG.neckH - RIG.headR * headScale + bob;
  const torsoW = build === 'small' ? 15 : build === 'stub' ? 18 : build === 'tall' ? 13 : 14.2;

  drawLegs(ctx, { pal, look, detail, lean, swing, hipY, shoeTop, legH, build });

  // folk skirt reads before the torso: it is the silhouette THREAD cannot file
  if (look.folk) {
    cel(ctx, polyPath([
      [-7, torsoTop + torsoH * 0.5], [7, torsoTop + torsoH * 0.5],
      [15, hipY + 9], [-15, hipY + 9],
    ]), pal.cloth, detail, { lw: 1.6, shadow: -0.16 });
    if (detail > 0.4) {
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-13.6, hipY + 6.5);
      ctx.lineTo(13.6, hipY + 6.5);
      ctx.stroke();
    }
  }

  drawTorso(ctx, { pal, look, detail, lean, torsoTop, hipY, torsoW, build, variant: s.variant });
  drawArms(ctx, { pal, look, detail, lean, swing, torsoTop, torsoH, torsoW });

  if (look.belt) drawChainBelt(ctx, hipY - 1.5, lean, pal, detail);
  if (look.folk) drawBeads(ctx, torsoTop, lean, pal, detail);

  // neck, so the head belongs to a person rather than balancing on a box
  if (look.head === 'human') {
    cel(ctx, roundRectPath(-2.3 + lean * 0.5, torsoTop - RIG.neckH - 2, 4.6, RIG.neckH + 4, 1.6),
      shade(pal.skin, -0.14), detail, { lw: 1.2, shadow: -0.12 });
  }

  ctx.save();
  ctx.translate(lean, headY);
  ctx.scale(headScale, headScale);
  drawHead(ctx, { pal, look, detail, depth, expression: s.expression, variant: s.variant });
  ctx.restore();

  ctx.restore();
}

function drawLegs(ctx, { pal, look, detail, lean, swing, hipY, shoeTop, legH, build }) {
  const spread = build === 'grounded' ? 5.2 : build === 'stub' ? 4.6 : 4.0;
  for (const side of [-1, 1]) {
    const sw = swing * side * 3.4;
    const lx = side * spread + lean * 0.3;

    // leg: tapers toward the ankle so it is not a pipe
    cel(ctx, polyPath([
      [lx - 3.5, hipY], [lx + 3.5, hipY],
      [lx + 2.7, shoeTop + sw * 0.4], [lx - 2.7, shoeTop + sw * 0.4],
    ]), look.legwear || shade(pal.cloth, -0.16), detail, { lw: 1.3, shadow: -0.14 });

    if (look.fishnet && detail > 0.85) {
      ctx.save();
      ctx.beginPath();
      polyPath([
        [lx - 3.5, hipY], [lx + 3.5, hipY],
        [lx + 2.7, shoeTop + sw * 0.4], [lx - 2.7, shoeTop + sw * 0.4],
      ])(ctx);
      ctx.clip();
      ctx.strokeStyle = `rgba(255,255,255,${0.32 * detail})`;
      ctx.lineWidth = 0.5;
      for (let i = -4; i < 8; i++) {
        ctx.beginPath();
        ctx.moveTo(lx - 4, hipY + i * 3);
        ctx.lineTo(lx + 4, hipY + i * 3 + 4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(lx - 4, hipY + i * 3 + 4);
        ctx.lineTo(lx + 4, hipY + i * 3);
        ctx.stroke();
      }
      ctx.restore();
    }

    // chunky sneaker. the loudest thing on the ground plane.
    const shoeY = shoeTop + sw * 0.4;
    cel(ctx, (c) => {
      c.moveTo(lx - 4.6, shoeY);
      c.lineTo(lx + 3.4, shoeY);
      c.quadraticCurveTo(lx + 5.6, shoeY + 1.4, lx + 5.6, shoeY + 3.2);
      c.lineTo(lx + 5.6, shoeY + RIG.shoeH);
      c.lineTo(lx - 4.6, shoeY + RIG.shoeH);
      c.closePath();
    }, pal.shoe, detail, { lw: 1.5, shadow: -0.16, highlight: 0.12 });

    // sole slab, always visible: it is most of the shoe's read
    cel(ctx, roundRectPath(lx - 5, shoeY + RIG.shoeH - 2.2, 10.8, 2.6, 1.1),
      '#f2f0ea', detail, { lw: 1.2, shadow: -0.12 });

    if (detail > 0.45) {
      ctx.strokeStyle = `rgba(255,255,255,${0.85 * detail})`;
      ctx.lineWidth = 0.75;
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.moveTo(lx - 2.6, shoeY + 1.2 + i * 1.5);
        ctx.lineTo(lx + 2.4, shoeY + 1.7 + i * 1.5);
        ctx.stroke();
      }
    }
  }
}

function drawTorso(ctx, { pal, look, detail, lean, torsoTop, hipY, torsoW, build, variant }) {
  const x0 = -torsoW / 2 + lean * 0.4;
  const x1 = torsoW / 2 + lean * 0.4;
  const waist = torsoW * 0.40;
  const r = build === 'stub' ? 7.5 : 4;
  const cx = lean * 0.4;
  const color = variant === 'quiet' ? shade(pal.cloth, -0.18) : pal.cloth;

  cel(ctx, (c) => {
    c.moveTo(x0 + r, torsoTop);
    c.lineTo(x1 - r, torsoTop);
    c.quadraticCurveTo(x1, torsoTop, x1, torsoTop + r);
    c.lineTo(cx + waist, hipY - 1);
    c.quadraticCurveTo(cx + waist, hipY + 1.6, cx + waist - 2, hipY + 1.6);
    c.lineTo(cx - waist + 2, hipY + 1.6);
    c.quadraticCurveTo(cx - waist, hipY + 1.6, cx - waist, hipY - 1);
    c.lineTo(x0, torsoTop + r);
    c.quadraticCurveTo(x0, torsoTop, x0 + r, torsoTop);
    c.closePath();
  }, color, detail, { lw: 1.7, shadow: -0.24, push: 1.8 });

  if (look.holo) drawHoloSeams(ctx, torsoTop, hipY, torsoW, lean, detail);

  // seatbelt: part of the costume, not the car
  if (look.seatbelt) {
    cel(ctx, polyPath([
      [x0 + 1, torsoTop + 1.5], [x0 + 4.4, torsoTop + 1],
      [x1 - 0.5, hipY - 2], [x1 - 3.8, hipY - 1.2],
    ]), '#20212b', detail, { lw: 1.1, shadow: -0.1 });
  }

  if (detail > 0.35 && look.head === 'human') {
    // collar line, so the garment has a construction
    ctx.strokeStyle = `rgba(23,16,31,${0.55 * detail})`;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(cx - 3.2, torsoTop + 0.6);
    ctx.quadraticCurveTo(cx, torsoTop + 3.2, cx + 3.2, torsoTop + 0.6);
    ctx.stroke();
  }
}

function drawArms(ctx, { pal, look, detail, lean, swing, torsoTop, torsoH, torsoW }) {
  const armH = torsoH * 0.82;
  for (const side of [-1, 1]) {
    const ax = side * (torsoW / 2 - 0.4) + lean * 0.4;
    const ay = torsoTop + 2.2 - swing * side * 2.4;
    cel(ctx, polyPath([
      [ax - 2.9, ay], [ax + 2.9, ay],
      [ax + 2.2, ay + armH], [ax - 2.2, ay + armH],
    ]), shade(pal.cloth, 0.05), detail, { lw: 1.3, shadow: -0.18 });

    if (look.stripedSleeve && detail > 0.45) {
      ctx.save();
      ctx.beginPath();
      polyPath([[ax - 2.9, ay], [ax + 2.9, ay], [ax + 2.2, ay + armH], [ax - 2.2, ay + armH]])(ctx);
      ctx.clip();
      ctx.fillStyle = pal.accent;
      for (let i = 0; i < 5; i++) ctx.fillRect(ax - 3, ay + 2 + i * 3.2, 6, 1.5);
      ctx.restore();
    }

    cel(ctx, ellipsePath(ax, ay + armH + 1, 2.7, 2.9), pal.skin, detail, { lw: 1.2, shadow: -0.14 });
  }
}

/* ------------------------------------------------------------------ head */

function drawHead(ctx, { pal, look, detail, depth, expression, variant }) {
  const facingAway = depth < -0.45;

  if (look.head === 'hood') {
    // one big round hood, no neck, no face unless you lean in
    cel(ctx, ellipsePath(0, 0, 9.4, 9), pal.cloth, detail, { lw: 1.8, shadow: -0.2 });
    for (const side of [-1, 1]) {
      cel(ctx, ellipsePath(side * 6.4, -6.8, 3.1, 2.9), shade(pal.cloth, -0.32), detail,
        { lw: 1.4, shadow: -0.12 });
    }
    if (facingAway) {
      if (detail > 0.4) {
        // the hood graphic is the back view's whole read
        cel(ctx, ellipsePath(0, 1, 5, 4.4), '#f3f1ea', detail, { lw: 1.2, shadow: -0.1 });
        ctx.fillStyle = INK;
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.ellipse(side * 2, 0.2, 1.3, 1.5, 0, 0, TAU);
          ctx.fill();
        }
      }
      return;
    }
    // face sits back in shadow
    ctx.fillStyle = 'rgba(26,18,36,0.6)';
    ctx.beginPath();
    ctx.ellipse(0, 1.4, 6.4, 5.8, 0, 0, TAU);
    ctx.fill();
    cel(ctx, ellipsePath(0, 2.2, 4.8, 4.2), pal.skin, detail, { lw: 1.1, shadow: -0.1 });
    drawFace(ctx, 1.8, pal, detail, expression || 'avert', 0.82);
    return;
  }

  if (look.head === 'bird') {
    cel(ctx, ellipsePath(0, 0, 8.4, 8), pal.skin, detail, { lw: 1.9, shadow: -0.16, highlight: 0.1 });
    // crest
    cel(ctx, polyPath([[-3, -6.4], [-0.6, -13.6], [1, -8], [2.6, -12], [3.4, -6]]),
      pal.hair2, detail, { lw: 1.4, shadow: -0.14 });
    if (facingAway) return;

    if (detail > 0.3) drawBirdEyes(ctx, -1.2, detail, expression || 'rage');

    // small furious beak
    cel(ctx, polyPath([[-3, 1.6], [3, 1.6], [0, 6.2]]), pal.accent, detail,
      { lw: 1.4, shadow: -0.18 });
    if (detail > 0.5) {
      ctx.strokeStyle = `rgba(23,16,31,${0.7 * detail})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-3, 1.6);
      ctx.lineTo(3, 1.6);
      ctx.stroke();
    }
    if (look.scar && detail > 0.5) {
      // the stitched mark over the brow
      ctx.strokeStyle = shade(pal.skin, -0.45);
      ctx.lineWidth = 0.7;
      for (const [x1, y1, x2, y2] of [[-5.4, -5, -2.6, -2.8], [-5, -3.2, -3, -4.6]]) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }
    return;
  }

  // ---- human head. Layer order is the whole game here: hair drawn after the
  // face buries the eyes, which is exactly what a blank-looking Kin is.
  drawHairBack(ctx, { pal, look, detail, variant });

  cel(ctx, (c) => {
    c.moveTo(-6.6, -1.6);
    c.quadraticCurveTo(-6.8, -8.4, 0, -8.4);
    c.quadraticCurveTo(6.8, -8.4, 6.6, -1.6);
    c.quadraticCurveTo(6.1, 4.8, 0, 7.2);
    c.quadraticCurveTo(-6.1, 4.8, -6.6, -1.6);
    c.closePath();
  }, pal.skin, detail, { lw: 1.7, shadow: -0.17, push: 1.5 });

  if (!facingAway) {
    if (look.mark === 'stripes' && detail > 0.45) drawFacePaint(ctx, pal, detail);
    drawFace(ctx, 0, pal, detail, expression || defaultFace(look), 1);
    if (look.mark === 'star' && detail > 0.5) drawStarMark(ctx, -4.8, 1.8, 2, pal.accent);
  }

  drawHairFront(ctx, { pal, look, detail, variant, facingAway });
}

/** Hair mass behind the skull. Gives the head its outline at 64px. */
function drawHairBack(ctx, { pal, look, detail, variant }) {
  const style = look.hair;
  if (style === 'spikes') return;
  const color = style === 'double' && variant !== 'loud' ? pal.hair2 : pal.hair;
  const ry = style === 'sleek' ? 8.2 : 7.6;
  cel(ctx, ellipsePath(0, -1.6, 7.9, ry), shade(color, -0.1), detail,
    { lw: 1.6, shadow: -0.16 });
}

/**
 * Hair in front of the face. Everything here stays above BROW_LINE so it frames
 * the eyes instead of covering them.
 */
const BROW_LINE = -3.4;

function drawHairFront(ctx, { pal, look, detail, variant, facingAway }) {
  const style = look.hair;

  if (style === 'buns') {
    // chunky cut fringe, not a smooth cap
    cel(ctx, polyPath([
      [-7.1, -2.6], [-7.4, -7.2], [-3.6, -9.2], [-0.4, -6.6],
      [2.2, -9.4], [6.6, -7.4], [7.1, -2.2],
      [4.8, -6.0], [2.0, BROW_LINE], [-0.8, -6.2], [-3.6, BROW_LINE], [-5.2, -6.4],
    ]), pal.hair, detail, { lw: 1.5, shadow: -0.14, highlight: 0.2 });

    for (const side of [-1, 1]) {
      const bx = side * 8.0;
      cel(ctx, ellipsePath(bx, -7.0, 4.4, 4.2), pal.hair, detail,
        { lw: 1.6, shadow: -0.16, highlight: 0.22 });
      if (detail > 0.35) {
        cel(ctx, polyPath([[bx - 3.4, -10.6], [bx - 0.6, -11.8], [bx - 0.6, -9.0]]),
          pal.hair2, detail, { lw: 1, shadow: -0.14 });
        cel(ctx, polyPath([[bx + 3.4, -10.6], [bx + 0.6, -11.8], [bx + 0.6, -9.0]]),
          pal.hair2, detail, { lw: 1, shadow: -0.14 });
        cel(ctx, ellipsePath(bx, -10.4, 1.0, 1.0), pal.accent, detail, { lw: 0.8, shadow: 0 });
      }
    }
    if (detail > 0.5 && !facingAway) drawHairClips(ctx);
    return;
  }

  if (style === 'spikes') {
    // upper hemisphere only, so nothing rakes across the face
    for (let i = -3; i <= 3; i++) {
      const a = (i / 3) * 1.0 - Math.PI / 2;
      const len = 11 + Math.abs(i) * 1.2;
      cel(ctx, polyPath([
        [Math.cos(a - 0.3) * 6.2, Math.sin(a - 0.3) * 7.2 - 1],
        [Math.cos(a) * len, Math.sin(a) * len - 2.5],
        [Math.cos(a + 0.3) * 6.2, Math.sin(a + 0.3) * 7.2 - 1],
      ]), i % 2 ? pal.hair : pal.hair2, detail, { lw: 1.3, shadow: -0.14, highlight: 0.18 });
    }
    if (detail > 0.5 && !facingAway) drawHairClips(ctx);
    return;
  }

  if (style === 'dressed') {
    cel(ctx, polyPath([
      [-7.4, -3.0], [-7.8, -7.6], [-4, -9.6], [0, -10.2], [4, -9.6], [7.8, -7.6], [7.4, -3.0],
      [4.6, -6.6], [0, -7.4], [-4.6, -6.6],
    ]), pal.hair, detail, { lw: 1.6, shadow: -0.16, highlight: 0.16 });
    if (detail > 0.4) {
      ctx.strokeStyle = pal.hair2;
      ctx.lineWidth = 1.3;
      ctx.lineCap = 'round';
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.arc(i * 3.0, -6.6, 2.0, Math.PI, TAU);
        ctx.stroke();
      }
    }
    return;
  }

  if (style === 'double') {
    const c = variant === 'loud' ? pal.hair : pal.hair2;
    cel(ctx, polyPath([
      [-7.4, -3.2], [-7.6, -7.8], [-3, -9.8], [1, -8.2], [5, -9.6], [7.6, -7.0], [7.4, -3.2],
      [4.4, -6.4], [1.2, BROW_LINE], [-2.4, -6.6], [-5.2, BROW_LINE],
    ]), c, detail, { lw: 1.5, shadow: -0.16, highlight: 0.2 });
    if (variant === 'loud') {
      for (const side of [-1, 1]) {
        cel(ctx, ellipsePath(side * 7.4, -2.2, 3.2, 4.4), c, detail, { lw: 1.3, shadow: -0.16 });
      }
    }
    return;
  }

  if (style === 'sleek') {
    cel(ctx, (c) => {
      c.moveTo(-7.6, -2.2);
      c.quadraticCurveTo(-7.2, -11.5, 0, -11.5);
      c.quadraticCurveTo(7.2, -11.5, 7.6, -2.2);
      c.quadraticCurveTo(6.2, -5.6, 3.2, BROW_LINE - 0.4);
      c.quadraticCurveTo(0, -7.4, -3.2, BROW_LINE - 0.4);
      c.quadraticCurveTo(-6.2, -5.6, -7.6, -2.2);
      c.closePath();
    }, pal.hair, detail, { lw: 1.6, shadow: -0.18, highlight: 0.26 });
    return;
  }

  cel(ctx, polyPath([
    [-7.3, -3.0], [-7.6, -7.4], [-3.6, -9.4], [0, -8.6], [3.6, -9.4], [7.6, -7.4], [7.3, -3.0],
    [3.6, -6.4], [0, -6.0], [-3.6, -6.4],
  ]), pal.hair, detail, { lw: 1.5, shadow: -0.16, highlight: 0.16 });
}

/**
 * Accessory density is the character -- a clean head of hair is the wrong read.
 * Few and large, though: five tiny clips at 40px is five grey smudges.
 */
function drawHairClips(ctx) {
  const clips = [[-4.6, -7.4, '#35c6f0'], [0.2, -8.8, '#ffd633'], [4.4, -7.6, '#8ef04a']];
  for (const [cx, cy, col] of clips) {
    ctx.fillStyle = col;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    ctx.roundRect(cx - 1.8, cy - 0.9, 3.6, 1.8, 0.8);
    ctx.fill();
    ctx.stroke();
  }
}

function drawFacePaint(ctx, pal, detail) {
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = pal.hair;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 2; i++) {
      ctx.save();
      ctx.translate(side * (3.6 + i * 1.5), 1.4);
      ctx.rotate(side * 0.34);
      ctx.fillRect(-0.45, -1.7, 0.9, 3.4);
      ctx.restore();
    }
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ face */

/**
 * Expression table. Every attitude moves eyes, brows and mouth together --
 * changing one alone reads as a glitch, not a feeling.
 *
 * eye:   open | wide | squeeze | lid | closed
 * mouth: line | open | grin | shout | small | frown
 */
const FACE = {
  neutral:   { eye: 'open',    bi: 0,    bo: 0,    mouth: 'line',  mw: 2.4 },
  irritated: { eye: 'lid',     bi: -1.5, bo: 0.8,  mouth: 'frown', mw: 2.8 },
  rage:      { eye: 'open',    bi: -2.1, bo: 1.3,  mouth: 'shout', mw: 4.2, pupil: 0.62 },
  shout:     { eye: 'squeeze', bi: -1.8, bo: 1.0,  mouth: 'shout', mw: 5.0 },
  smug:      { eye: 'lid',     bi: -1.0, bo: 0.4,  mouth: 'grin',  mw: 3.4, skew: 0.7 },
  delighted: { eye: 'squeeze', bi: -0.4, bo: -0.8, mouth: 'grin',  mw: 4.4 },
  manic:     { eye: 'wide',    bi: -0.8, bo: 0.9,  mouth: 'grin',  mw: 4.6, pupil: 0.5 },
  avert:     { eye: 'lid',     bi: 0.7,  bo: 0.3,  mouth: 'small', mw: 1.8, look: -0.9 },
  shy:       { eye: 'lid',     bi: 1.0,  bo: 0.4,  mouth: 'small', mw: 1.6, look: -0.6 },
  cold:      { eye: 'open',    bi: -0.5, bo: -0.2, mouth: 'line',  mw: 2.0 },
  scared:    { eye: 'wide',    bi: 1.3,  bo: -0.5, mouth: 'open',  mw: 2.6, pupil: 0.45 },
};

function defaultFace(look) {
  if (look.mark === 'stripes') return 'shout';   // Spark
  if (look.head === 'hood') return 'avert';      // Soft Lock
  if (look.head === 'bird') return 'rage';       // Driver
  if (look.holo) return 'cold';                  // Mirror
  if (look.folk) return 'smug';                  // Folk Glitch
  return 'neutral';
}

function drawFace(ctx, y, pal, detail, expression, spread) {
  const f = FACE[expression] || FACE.neutral;
  const dx = 3.1 * spread;
  const ey = y - 0.4;

  for (const side of [-1, 1]) {
    drawEye(ctx, side * dx, ey, side, f, detail, spread);
  }

  if (detail > 0.3) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.15 * spread;
    ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * (dx - 1.7), ey - 3.4 + f.bi);
      ctx.lineTo(side * (dx + 1.8), ey - 3.4 + f.bo);
      ctx.stroke();
    }
  }

  if (detail > 0.35) drawMouth(ctx, (f.skew || 0), y + 3.4, f, spread, detail);
}

function drawEye(ctx, x, y, side, f, detail, spread) {
  const rx = 2.35 * spread;
  const ry = (f.eye === 'wide' ? 2.9 : 2.5) * spread;

  if (f.eye === 'squeeze' || f.eye === 'closed') {
    // ^ ^ — the shape a face makes at full volume
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.3 * spread;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const up = f.eye === 'squeeze' ? -1.7 : 1.4;
    ctx.moveTo(x - rx, y + 0.7);
    ctx.quadraticCurveTo(x, y + 0.7 + up, x + rx, y + 0.7);
    ctx.stroke();
    return;
  }

  // sclera
  ctx.fillStyle = '#fdfbff';
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fill();

  // iris, offset if the expression is looking away
  const lookX = (f.look || 0) * spread;
  const pr = (f.pupil ?? 0.66) * ry;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.clip();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(x + lookX, y + 0.2, pr * 0.82, pr, 0, 0, TAU);
  ctx.fill();
  if (detail > 0.55) {
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.ellipse(x + lookX - pr * 0.3, y - pr * 0.35, pr * 0.3, pr * 0.28, 0, 0, TAU);
    ctx.fill();
  }
  // lid drops over the top for half-lidded reads
  if (f.eye === 'lid') {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(x, y - ry * 0.95, rx * 1.25, ry * 0.85, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  // upper lash line, heavier than the rest of the eye
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.1 * spread;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, Math.PI * 1.08, Math.PI * 1.92);
  ctx.stroke();
}

function drawBirdEyes(ctx, y, detail, expression) {
  const f = FACE[expression] || FACE.rage;
  for (const side of [-1, 1]) {
    // flat-topped angry eye: the scowl is in the lid, not the brow
    cel(ctx, (c) => {
      c.moveTo(side * 1.4, y - 1.6);
      c.lineTo(side * 5.2, y - 0.2);
      c.quadraticCurveTo(side * 5.4, y + 2.6, side * 2.8, y + 2.6);
      c.quadraticCurveTo(side * 1.2, y + 2.4, side * 1.4, y - 1.6);
      c.closePath();
    }, '#fdfbff', detail, { lw: 1.2, shadow: 0 });
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(side * 3.3, y + 1, 1.15, 1.5, 0, 0, TAU);
    ctx.fill();
    // heavy angled lid
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(side * 1.3, y - 1.8);
    ctx.lineTo(side * 5.3, y - 0.2);
    ctx.stroke();
  }
}

function drawMouth(ctx, x, y, f, spread, detail) {
  const w = f.mw * spread;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (f.mouth === 'shout' || f.mouth === 'open') {
    const h = (f.mouth === 'shout' ? 4.6 : 2.8) * spread;
    const path = (c) => {
      c.moveTo(x - w / 2, y - h * 0.25);
      c.quadraticCurveTo(x, y - h * 0.6, x + w / 2, y - h * 0.25);
      c.quadraticCurveTo(x + w * 0.42, y + h * 0.75, x, y + h * 0.75);
      c.quadraticCurveTo(x - w * 0.42, y + h * 0.75, x - w / 2, y - h * 0.25);
      c.closePath();
    };
    ctx.fillStyle = '#6d1030';
    ctx.beginPath();
    path(ctx);
    ctx.fill();
    if (detail > 0.5) {
      // teeth band and tongue: what makes a shout read as a shout
      ctx.save();
      ctx.beginPath();
      path(ctx);
      ctx.clip();
      ctx.fillStyle = '#fdfbff';
      ctx.fillRect(x - w, y - h * 0.5, w * 2, h * 0.32);
      ctx.fillStyle = '#e4567c';
      ctx.beginPath();
      ctx.ellipse(x, y + h * 0.7, w * 0.3, h * 0.34, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2 * spread;
    ctx.beginPath();
    path(ctx);
    ctx.stroke();
    return;
  }

  if (f.mouth === 'grin') {
    const h = 2.0 * spread;
    const path = (c) => {
      c.moveTo(x - w / 2, y - h * 0.4);
      c.quadraticCurveTo(x, y + h * 1.1, x + w / 2, y - h * 0.4);
      c.closePath();
    };
    ctx.fillStyle = '#6d1030';
    ctx.beginPath();
    path(ctx);
    ctx.fill();
    if (detail > 0.5) {
      ctx.save();
      ctx.beginPath();
      path(ctx);
      ctx.clip();
      ctx.fillStyle = '#fdfbff';
      ctx.fillRect(x - w, y - h * 0.5, w * 2, h * 0.5);
      ctx.restore();
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.1 * spread;
    ctx.beginPath();
    path(ctx);
    ctx.stroke();
    return;
  }

  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.0 * spread;
  const curve = f.mouth === 'frown' ? 1.1 : 0;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.quadraticCurveTo(x, y + curve, x + w / 2, y);
  ctx.stroke();
}

/* ------------------------------------------------------------ accessories */

function drawStarMark(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU - Math.PI / 2;
    const rr = i % 2 ? r * 0.42 : r;
    ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawChainBelt(ctx, y, lean, pal, detail) {
  const x = lean * 0.4;
  ctx.strokeStyle = pal.accent;
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 6.4, y);
  ctx.lineTo(x + 6.4, y);
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.4;
  ctx.stroke();
  if (detail > 0.4) {
    for (let i = 0; i < 4; i++) {
      const cx = x - 3.6 + i * 2.4;
      const cy = y + 2.4 + (i % 2) * 1.1;
      ctx.fillStyle = pal.accent;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 0.95, 1.35, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
  }
}

function drawBeads(ctx, top, lean, pal, detail) {
  if (detail < 0.25) return;
  const cols = [pal.accent, '#f6c453', '#2f6f4f', '#fdfbff'];
  for (let i = 0; i < 9; i++) {
    const a = (i / 8) * Math.PI;
    ctx.fillStyle = cols[i % cols.length];
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    ctx.ellipse(lean * 0.4 + Math.cos(a) * -6.6, top + 6.4 + Math.sin(a) * 3.8, 1.15, 1.15, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
}

function drawHoloSeams(ctx, top, hipY, w, lean, detail) {
  const h = hipY - top;
  const g = ctx.createLinearGradient(-w / 2, top, w / 2, top + h);
  g.addColorStop(0, 'rgba(142,247,255,0.6)');
  g.addColorStop(0.5, 'rgba(180,140,255,0.25)');
  g.addColorStop(1, 'rgba(255,140,220,0.55)');
  ctx.save();
  ctx.fillStyle = g;
  ctx.beginPath();
  roundRectPath(-w / 2 + lean * 0.4, top, w, h, 4)(ctx);
  ctx.fill();
  if (detail > 0.4) {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 0.6;
    for (let i = 1; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(-w / 2 + lean * 0.4, top + (i * h) / 5);
      ctx.lineTo(w / 2 + lean * 0.4, top + (i * h) / 5 - 1.4);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawFlagRing(ctx) {
  ctx.strokeStyle = 'rgba(255,60,60,0.9)';
  ctx.lineWidth = 1.6;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.ellipse(0, 0, 20, 7, 0, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawMarkChevron(ctx) {
  ctx.fillStyle = '#ffd400';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(0, -52);
  ctx.lineTo(-5, -60);
  ctx.lineTo(5, -60);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/* --------------------------------------------------------------- exports */

export function drawPortrait(ctx, kin, x, y, size, expression = 'neutral') {
  const plate = pickPlate(kin.id, { mode: 'portrait' });
  if (plate) {
    drawPlate(ctx, plate, x, y + size * 0.5, size / UNIT_HEIGHT, {});
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  const s = size / RIG_HEIGHT;
  ctx.scale(s, s);
  ctx.translate(0, RIG_HEIGHT / 2 - 4);
  drawBody(ctx, {
    kin, look: kin.look, detail: 1,
    lean: 0, bob: 0, swing: 0, depth: 1,
    expression: expression === 'neutral' ? undefined : expression,
  });
  ctx.restore();
}

/** A civilian: same cel rules, cheaper body. The crowd is the tech. */
export function drawCivilian(ctx, civ, scale) {
  const detail = detailFor(scale) * 0.7;
  ctx.save();
  ctx.translate(civ.x, civ.y);
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath();
  ctx.ellipse(0, 2 * scale, 9.5 * scale, 3.4 * scale, 0, 0, TAU);
  ctx.fill();
  ctx.scale(scale, scale);
  const bob = Math.sin(civ.phase * 2) * 0.7;

  cel(ctx, polyPath([[-3.2, -12], [3.2, -12], [2.6, 0], [-2.6, 0]]),
    shade(civ.color, -0.3), detail, { lw: 1, shadow: -0.15 });
  cel(ctx, roundRectPath(-5.2, -24, 10.4, 13, 3.4), civ.color, detail, { lw: 1.2, shadow: -0.2 });
  cel(ctx, ellipsePath(0, -28 + bob, 5, 5.4), civ.skin, detail, { lw: 1.2, shadow: -0.16 });
  cel(ctx, ellipsePath(0, -30.4 + bob, 5.2, 3.6), civ.hair, detail, { lw: 1.1, shadow: -0.18 });
  if (detail > 0.35) {
    ctx.fillStyle = INK;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(side * 1.8, -28 + bob, 0.7, 0.9, 0, 0, TAU);
      ctx.fill();
    }
  }
  if (civ.copying) {
    // they are wearing your accessory now. that is the Trendbomb read.
    ctx.strokeStyle = civ.copyColor;
    ctx.lineWidth = 1.9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-4.6, -13.5);
    ctx.lineTo(4.6, -13.5);
    ctx.stroke();
  }
  ctx.restore();
}

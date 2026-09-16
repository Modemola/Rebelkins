/**
 * KIN ART — procedural 2.5D character rendering.
 *
 * The project's production rule is the whole spec: they should look 3D from far
 * away and drawn up close. So every body part is a smooth filled volume with a
 * gradient, and the linework only resolves once the character is big enough on
 * screen to deserve it. `detail` below is that dial, and nothing is hand-placed
 * per zoom level -- the same call renders a 20px crowd dot and a 400px portrait.
 *
 * Silhouette is the other law. At 64px you should still know who this is:
 *   spark     spikes blowing off the skull
 *   softlock  one big round hood, no neck
 *   driver    low round body, crest, shoes too big for it
 *   mirror    tall vertical line, coat flare
 *   folkglitch  wide grounded triangle
 *   pair      two bodies, one composition
 */

const TAU = Math.PI * 2;

/** How drawn should this be? 0 = plastic volume only, 1 = full linework. */
function detailFor(scale) {
  return clamp((scale - 0.55) / 0.85, 0, 1);
}

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = clamp(Math.round(r + amt * 255), 0, 255);
  g = clamp(Math.round(g + amt * 255), 0, 255);
  b = clamp(Math.round(b + amt * 255), 0, 255);
  return `rgb(${r},${g},${b})`;
}

/** A filled volume: vertical gradient so it reads round, outline so it reads drawn. */
function volume(ctx, path, color, detail, opts = {}) {
  const { y0 = -10, y1 = 10, lift = 0.22, drop = -0.26, lw = 1.6 } = opts;
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, shade(color, lift));
  g.addColorStop(0.55, color);
  g.addColorStop(1, shade(color, drop));
  ctx.fillStyle = g;
  ctx.beginPath();
  path(ctx);
  ctx.fill();
  if (detail > 0.02) {
    ctx.strokeStyle = `rgba(14,10,22,${0.78 * detail})`;
    ctx.lineWidth = lw;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}

function ellipsePath(cx, cy, rx, ry, rot = 0) {
  return (ctx) => ctx.ellipse(cx, cy, rx, ry, rot, 0, TAU);
}

function roundRectPath(x, y, w, h, r) {
  return (ctx) => {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  };
}

/**
 * Draw one Kin.
 * @param {object} o {kin, thread, x, y, scale, facing, phase, moving, expression,
 *                    alpha, ghost, flagged, marked}
 */
export function drawKin(ctx, o) {
  const { kin, x, y } = o;
  const scale = o.scale ?? 1;
  const facing = o.facing ?? Math.PI / 2;
  const phase = o.phase ?? 0;
  const moving = o.moving ?? 0;
  const detail = detailFor(scale);
  const pal = kin.palette;
  const look = kin.look;

  ctx.save();
  ctx.globalAlpha = (o.alpha ?? 1);
  ctx.translate(x, y);

  // contact shadow keeps them planted; without it everyone floats
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.beginPath();
  ctx.ellipse(0, 2 * scale, 15 * scale, 5.5 * scale, 0, 0, TAU);
  ctx.fill();

  ctx.scale(scale, scale);

  // facing is a lean, not a rotation: top-down rotation kills the silhouette
  const lean = Math.cos(facing) * 3.2;
  const depth = Math.sin(facing); // +1 walking toward camera, -1 away
  const bob = Math.sin(phase * 2) * (0.6 + moving * 1.1);
  const swing = Math.sin(phase) * moving;

  if (o.ghost) ctx.globalAlpha *= 0.42;

  if (look.build === 'duo') {
    drawBody(ctx, { kin, pal, look, detail, lean: lean - 6, bob, swing, depth, variant: 'quiet', scaleY: 0.94 });
    ctx.save();
    ctx.translate(9, -1);
    drawBody(ctx, { kin, pal, look, detail, lean: lean + 2, bob: -bob, swing: -swing, depth, variant: 'loud' });
    ctx.restore();
  } else {
    drawBody(ctx, { kin, pal, look, detail, lean, bob, swing, depth, expression: o.expression });
  }

  if (o.flagged) drawFlagRing(ctx, detail);
  if (o.marked) drawMarkChevron(ctx);

  ctx.restore();
}

function drawBody(ctx, s) {
  const { pal, look, detail, lean, bob, swing, depth } = s;
  const scaleY = s.scaleY ?? 1;
  ctx.save();
  ctx.scale(1, scaleY);

  const tall = look.build === 'tall' ? 4 : look.build === 'stub' ? -7 : look.build === 'small' ? -2 : 0;
  const hipY = -8 + tall * 0.2;
  const headY = -30 - tall + bob;

  // ---- legs + shoes. chunky sneakers are the whole read on the ground plane
  const legSpread = look.build === 'grounded' ? 6 : 4.5;
  for (const side of [-1, 1]) {
    const sw = swing * side * 4;
    const lx = side * legSpread + lean * 0.3;
    volume(ctx, roundRectPath(lx - 2.4, hipY, 4.8, 9 + tall * 0.1, 2), shade(pal.cloth, -0.22), detail,
      { y0: hipY, y1: hipY + 10, lw: 1.2 });
    // shoe
    const shoeY = hipY + 9 + sw * 0.5;
    volume(ctx, roundRectPath(lx - 4.6, shoeY, 9.2, 5.4, 2.6), pal.shoe, detail,
      { y0: shoeY, y1: shoeY + 6, lift: 0.3, lw: 1.3 });
    if (detail > 0.45) {
      ctx.strokeStyle = `rgba(20,14,28,${0.5 * detail})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(lx - 4.2, shoeY + 3.4);
      ctx.lineTo(lx + 4.2, shoeY + 3.4);
      ctx.stroke();
      // laces, loud on purpose
      ctx.strokeStyle = `rgba(255,255,255,${0.7 * detail})`;
      ctx.lineWidth = 0.7;
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.moveTo(lx - 2.6, shoeY + 1 + i * 1.4);
        ctx.lineTo(lx + 2.6, shoeY + 1.6 + i * 1.4);
        ctx.stroke();
      }
    }
  }

  // ---- torso
  const torsoTop = hipY - 17;
  if (look.folk) {
    // wide grounded skirt: the silhouette that THREAD cannot file
    volume(ctx, (c) => {
      c.moveTo(-6, torsoTop + 6);
      c.lineTo(6, torsoTop + 6);
      c.lineTo(13, hipY + 4);
      c.lineTo(-13, hipY + 4);
      c.closePath();
    }, pal.cloth, detail, { y0: torsoTop, y1: hipY + 4 });
  }
  const torsoW = look.build === 'small' ? 15 : look.build === 'stub' ? 17 : 14;
  volume(ctx, roundRectPath(-torsoW / 2 + lean * 0.4, torsoTop, torsoW, 19, look.build === 'stub' ? 8 : 5),
    pal.cloth, detail, { y0: torsoTop, y1: torsoTop + 19 });

  // ---- arms
  for (const side of [-1, 1]) {
    const ax = side * (torsoW / 2 + 0.5) + lean * 0.4;
    const ay = torsoTop + 3 - swing * side * 2.4;
    volume(ctx, roundRectPath(ax - 2.2, ay, 4.4, 13, 2.2), shade(pal.cloth, 0.06), detail,
      { y0: ay, y1: ay + 13, lw: 1.1 });
    if (detail > 0.3) {
      ctx.fillStyle = pal.skin;
      ctx.beginPath();
      ctx.ellipse(ax, ay + 13, 2.3, 2.3, 0, 0, TAU);
      ctx.fill();
    }
  }

  // ---- accessories that are actually the kit
  if (look.hair === 'spikes') drawChainBelt(ctx, hipY - 1, lean, pal, detail);
  if (look.folk) drawBeads(ctx, torsoTop, lean, pal, detail);
  if (look.holo) drawHoloSeams(ctx, torsoTop, torsoW, lean, detail);

  // ---- head
  ctx.save();
  ctx.translate(lean, headY - hipY + hipY);
  drawHead(ctx, { pal, look, detail, depth, expression: s.expression, variant: s.variant });
  ctx.restore();

  ctx.restore();
}

function drawHead(ctx, { pal, look, detail, depth, expression, variant }) {
  const y = 0;
  if (look.head === 'hood') {
    // one big round hood. no neck, no face unless you lean in.
    volume(ctx, ellipsePath(0, y, 11, 10.5), pal.cloth, detail, { y0: y - 11, y1: y + 10 });
    // animal ears on the hood
    for (const side of [-1, 1]) {
      volume(ctx, ellipsePath(side * 7.2, y - 8, 3.4, 3.2), shade(pal.cloth, -0.35), detail,
        { y0: y - 12, y1: y - 4, lw: 1.1 });
    }
    // the face sits back in shadow
    ctx.fillStyle = `rgba(28,22,38,${0.55 + 0.25 * detail})`;
    ctx.beginPath();
    ctx.ellipse(0, y + 1.5, 7, 6.4, 0, 0, TAU);
    ctx.fill();
    if (detail > 0.35 && depth > -0.4) {
      ctx.fillStyle = pal.skin;
      ctx.beginPath();
      ctx.ellipse(0, y + 2.6, 5.4, 4.6, 0, 0, TAU);
      ctx.fill();
      drawEyes(ctx, y + 2.2, pal, detail, expression || 'avert');
    }
    return;
  }

  if (look.head === 'bird') {
    volume(ctx, ellipsePath(0, y, 9.5, 9), pal.skin, detail, { y0: y - 10, y1: y + 9 });
    // crest
    volume(ctx, (c) => {
      c.moveTo(-3, y - 8);
      c.lineTo(0, y - 15);
      c.lineTo(3.4, y - 7.4);
      c.closePath();
    }, pal.hair2, detail, { y0: y - 15, y1: y - 6, lw: 1.1 });
    if (depth > -0.4) {
      // beak, small and furious
      volume(ctx, (c) => {
        c.moveTo(-3, y + 2);
        c.lineTo(3, y + 2);
        c.lineTo(0, y + 6.5);
        c.closePath();
      }, pal.accent, detail, { y0: y, y1: y + 7, lw: 1 });
      if (detail > 0.3) drawEyes(ctx, y - 1, { ...pal, skin: pal.skin }, detail, expression || 'rage', 0.8);
    }
    return;
  }

  // human head
  volume(ctx, ellipsePath(0, y, 7.6, 8.4), pal.skin, detail, { y0: y - 9, y1: y + 8 });

  if (look.hair === 'spikes') {
    for (let i = -3; i <= 3; i++) {
      const a = (i / 3) * 1.1 - Math.PI / 2;
      const len = 9 + Math.abs(i) * 1.6;
      volume(ctx, (c) => {
        c.moveTo(Math.cos(a - 0.22) * 6.6, Math.sin(a - 0.22) * 7.4);
        c.lineTo(Math.cos(a) * len, Math.sin(a) * len - 2);
        c.lineTo(Math.cos(a + 0.22) * 6.6, Math.sin(a + 0.22) * 7.4);
        c.closePath();
      }, i % 2 ? pal.hair : pal.hair2, detail, { y0: y - 16, y1: y, lw: 1 });
    }
    if (detail > 0.5) {
      // clips and letters in the hair
      ctx.fillStyle = pal.accent;
      for (const [cx, cy] of [[-4.5, -6], [3.8, -7.5], [0.6, -9]]) {
        ctx.fillRect(cx, cy, 2, 1.4);
      }
    }
  } else if (look.hair === 'dressed') {
    volume(ctx, ellipsePath(0, y - 4.5, 9.5, 6.2), pal.hair, detail, { y0: y - 11, y1: y - 1 });
    if (detail > 0.4) {
      ctx.strokeStyle = pal.hair2;
      ctx.lineWidth = 1.1;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.arc(i * 3, y - 5, 2.4, Math.PI, TAU);
        ctx.stroke();
      }
    }
  } else if (look.hair === 'double') {
    volume(ctx, ellipsePath(0, y - 4, 8.6, 6), variant === 'loud' ? pal.hair : pal.hair2, detail,
      { y0: y - 10, y1: y - 1 });
    if (variant === 'loud') {
      volume(ctx, ellipsePath(-7, y - 2, 3.4, 4.6), pal.hair, detail, { y0: y - 7, y1: y + 2, lw: 1 });
      volume(ctx, ellipsePath(7, y - 2, 3.4, 4.6), pal.hair, detail, { y0: y - 7, y1: y + 2, lw: 1 });
    }
  } else if (look.hair === 'sleek') {
    volume(ctx, (c) => {
      c.moveTo(-8, y - 2);
      c.quadraticCurveTo(0, y - 13, 8, y - 2);
      c.quadraticCurveTo(6, y + 7, 4, y + 3);
      c.quadraticCurveTo(0, y - 3, -4, y + 3);
      c.quadraticCurveTo(-6, y + 7, -8, y - 2);
      c.closePath();
    }, pal.hair, detail, { y0: y - 13, y1: y + 6 });
  } else {
    volume(ctx, ellipsePath(0, y - 3.4, 8.2, 6.4), pal.hair, detail, { y0: y - 10, y1: y + 2 });
  }

  if (depth > -0.4 && detail > 0.25) {
    drawEyes(ctx, y, pal, detail, expression || 'neutral');
    if (look.mark === 'star' && detail > 0.5) drawStarMark(ctx, -4.6, y + 2.4, 2.2, pal.accent);
  }
}

function drawEyes(ctx, y, pal, detail, expression, spread = 1) {
  const dx = 2.9 * spread;
  const brow = {
    neutral: 0, rage: -1.1, avert: 0.5, smug: -0.5, shy: 0.6, delighted: -0.3, cold: -0.2,
  }[expression] ?? 0;
  ctx.fillStyle = '#17121f';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    if (expression === 'avert' || expression === 'shy') {
      ctx.ellipse(side * dx, y + 0.4, 1.3, 0.45, 0, 0, TAU);
    } else {
      ctx.ellipse(side * dx, y, 1.15, 1.45, 0, 0, TAU);
    }
    ctx.fill();
  }
  if (detail > 0.55 && brow !== 0) {
    ctx.strokeStyle = '#17121f';
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * dx - 1.8, y - 2.6 + brow * side * 0.2);
      ctx.lineTo(side * dx + 1.8, y - 2.6 - brow * 0.6);
      ctx.stroke();
    }
  }
  if (detail > 0.6) {
    // one catchlight. on Mirror it is deliberately in the wrong place.
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.ellipse(-dx + 0.4, y - 0.5, 0.4, 0.4, 0, 0, TAU);
    ctx.fill();
  }
}

function drawStarMark(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU - Math.PI / 2;
    const rr = i % 2 ? r * 0.42 : r;
    ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

function drawChainBelt(ctx, y, lean, pal, detail) {
  ctx.strokeStyle = pal.accent;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-7 + lean * 0.4, y);
  ctx.lineTo(7 + lean * 0.4, y);
  ctx.stroke();
  if (detail > 0.4) {
    ctx.fillStyle = shade(pal.accent, -0.1);
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse(-4 + i * 2.6 + lean * 0.4, y + 2.4 + (i % 2), 0.9, 1.3, 0, 0, TAU);
      ctx.fill();
    }
  }
}

function drawBeads(ctx, top, lean, pal, detail) {
  if (detail < 0.2) return;
  const cols = [pal.accent, '#f6c453', '#2f6f4f', '#ffffff'];
  for (let i = 0; i < 9; i++) {
    const a = (i / 8) * Math.PI;
    ctx.fillStyle = cols[i % cols.length];
    ctx.beginPath();
    ctx.ellipse(lean * 0.4 + Math.cos(a) * -6.4, top + 6 + Math.sin(a) * 3.6, 1.1, 1.1, 0, 0, TAU);
    ctx.fill();
  }
}

function drawHoloSeams(ctx, top, w, lean, detail) {
  const g = ctx.createLinearGradient(-w / 2, top, w / 2, top + 19);
  g.addColorStop(0, 'rgba(142,247,255,0.55)');
  g.addColorStop(0.5, 'rgba(180,140,255,0.2)');
  g.addColorStop(1, 'rgba(255,140,220,0.5)');
  ctx.fillStyle = g;
  ctx.beginPath();
  roundRectPath(-w / 2 + lean * 0.4, top, w, 19, 5)(ctx);
  ctx.fill();
  if (detail > 0.4) {
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 0.6;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-w / 2 + lean * 0.4, top + i * 4.6);
      ctx.lineTo(w / 2 + lean * 0.4, top + i * 4.6 - 1.4);
      ctx.stroke();
    }
  }
}

function drawFlagRing(ctx, detail) {
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
  ctx.beginPath();
  ctx.moveTo(0, -48);
  ctx.lineTo(-5, -56);
  ctx.lineTo(5, -56);
  ctx.closePath();
  ctx.fill();
}

/** Bust portrait for menus. Same rules, more detail, front-on. */
export function drawPortrait(ctx, kin, x, y, size, expression = 'neutral') {
  ctx.save();
  ctx.translate(x, y);
  const s = size / 34;
  ctx.scale(s, s);
  ctx.translate(0, 16);
  drawBody(ctx, {
    kin, pal: kin.palette, look: kin.look, detail: 1,
    lean: 0, bob: 0, swing: 0, depth: 1, expression,
  });
  ctx.restore();
}

/** A civilian: same engine, cheap palette, low detail. The crowd is the tech. */
export function drawCivilian(ctx, civ, scale) {
  const detail = detailFor(scale) * 0.6;
  ctx.save();
  ctx.translate(civ.x, civ.y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 2 * scale, 10 * scale, 3.6 * scale, 0, 0, TAU);
  ctx.fill();
  ctx.scale(scale, scale);
  const bob = Math.sin(civ.phase * 2) * 0.7;
  volume(ctx, roundRectPath(-5.5, -22, 11, 15, 4), civ.color, detail, { y0: -22, y1: -7, lw: 1.1 });
  volume(ctx, ellipsePath(0, -27 + bob, 5.6, 6), civ.skin, detail, { y0: -33, y1: -21, lw: 1.1 });
  volume(ctx, ellipsePath(0, -29.5 + bob, 5.8, 3.8), civ.hair, detail, { y0: -33, y1: -26, lw: 1 });
  if (civ.copying) {
    // they are wearing your accessory now. that is the whole Trendbomb read.
    ctx.strokeStyle = civ.copyColor;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-5, -12);
    ctx.lineTo(5, -12);
    ctx.stroke();
  }
  ctx.restore();
}

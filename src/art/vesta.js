/**
 * VESTA RENDERING — the material law.
 *
 *   Asphalt has illustration grain and oil-colour blooms.
 *   Concrete is poured, then overdrawn with ink joints.
 *   Glass is thick, green-violet, full of late reflections.
 *   Metal rails have chipped paint and hand-polished corners.
 *   Cloth exists in the architecture: banners, drying jackets, tarps as walls.
 *   Handmade matter leaks in: cardboard, hot glue, sequins, paper, taped seams.
 *   Nothing is perfectly CAD. Even expensive buildings have a drawn outline.
 *
 * Lighting: key is distant magenta signage, fill is wet-ground bounce cooler
 * than the key, rims are thin lime or gold, practicals are work lamps, vitrines,
 * phone screens and lanterns. No cyan fog soup.
 *
 *   Night is not dark. Night is stained.
 */

import { PPM } from '../world/units.js';

const TAU = Math.PI * 2;
const INK = 'rgba(18,10,26,0.85)';

const LIGHT = {
  key: '#ff3fa4',
  fill: '#4a6cff',
  rim: '#c9ff4a',
  gold: '#f2c14e',
};

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/* ------------------------------------------------------------------ ground */

/**
 * The terrace floor. Three shallow steps, each a different surface, each with
 * illustration grain rather than a flat fill.
 */
export function drawGround(ctx, d, t) {
  const { w, h } = d.world;
  ctx.fillStyle = '#1c1128';
  ctx.fillRect(0, 0, w, h);

  for (const terr of d.terraces) {
    const band = terr.y1 - terr.y0;
    const base = SURFACE[terr.surface] || SURFACE.asphalt;
    ctx.fillStyle = base.fill;
    ctx.fillRect(0, terr.y0, w, band);

    // oil-colour blooms: slow, wide, never a tiling pattern
    for (let i = 0; i < 5; i++) {
      const bx = ((i * 331) % 97) / 97 * w;
      const by = terr.y0 + ((i * 577) % 53) / 53 * band;
      const r = 90 + ((i * 131) % 140);
      const g = ctx.createRadialGradient(bx, by, 4, bx, by, r);
      g.addColorStop(0, base.bloom);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(bx, by, r, r * 0.55, 0, 0, TAU);
      ctx.fill();
    }

    // illustration grain: short drawn strokes, not noise
    ctx.strokeStyle = base.grain;
    ctx.lineWidth = 1;
    for (let i = 0; i < 90; i++) {
      const gx = ((i * 8887) % 1009) / 1009 * w;
      const gy = terr.y0 + ((i * 7717) % 733) / 733 * band;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx + 9 + (i % 7), gy + 2);
      ctx.stroke();
    }

    // the step itself: a lift edge, drawn, so the terrace reads as not flat
    if (terr.lift > 0) {
      const g = ctx.createLinearGradient(0, terr.y0 - terr.lift, 0, terr.y0 + 4);
      g.addColorStop(0, 'rgba(0,0,0,0.45)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, terr.y0 - terr.lift, w, terr.lift + 4);
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, terr.y0);
      ctx.lineTo(w, terr.y0);
      ctx.stroke();
    }
  }

  // the key light: distant magenta signage washing the whole terrace
  const key = ctx.createLinearGradient(0, 0, w * 0.6, h);
  key.addColorStop(0, hexA(LIGHT.key, 0.1));
  key.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = key;
  ctx.fillRect(0, 0, w, h);
}

const SURFACE = {
  asphalt: { fill: '#2a1b33', bloom: 'rgba(255,63,164,0.10)', grain: 'rgba(255,255,255,0.045)' },
  'wet-stone': { fill: '#241a30', bloom: 'rgba(120,150,255,0.13)', grain: 'rgba(200,220,255,0.06)' },
  tile: { fill: '#32223c', bloom: 'rgba(242,193,78,0.09)', grain: 'rgba(255,255,255,0.05)' },
  concrete: { fill: '#2e2836', bloom: 'rgba(200,200,220,0.07)', grain: 'rgba(255,255,255,0.05)' },
};

/** The Hem. Open canal, catching everything above it. */
export function drawWater(ctx, block, t) {
  const g = ctx.createLinearGradient(0, block.y, 0, block.y + block.h);
  g.addColorStop(0, '#120b1e');
  g.addColorStop(0.5, '#1b1030');
  g.addColorStop(1, '#241640');
  ctx.fillStyle = g;
  ctx.fillRect(block.x, block.y, block.w, block.h);

  // late reflections, dragged and broken
  for (let i = 0; i < 16; i++) {
    const rx = block.x + ((i * 733) % 419) / 419 * block.w;
    const wob = Math.sin(t * 0.8 + i) * 6;
    ctx.strokeStyle = i % 3 === 0 ? hexA(LIGHT.key, 0.16) : hexA(LIGHT.rim, 0.07);
    ctx.lineWidth = 2 + (i % 3);
    ctx.beginPath();
    ctx.moveTo(rx + wob, block.y);
    ctx.bezierCurveTo(
      rx - 12 + wob, block.y + block.h * 0.4,
      rx + 14 + wob, block.y + block.h * 0.7,
      rx + wob * 0.4, block.y + block.h,
    );
    ctx.stroke();
  }
}

/* --------------------------------------------------------------- the kit */

export function drawDecor(ctx, d, t, pass) {
  for (const x of d.decor) {
    const fn = DECOR[x.kind];
    if (fn && fn.pass === pass) fn(ctx, x, t, d);
  }
}

const DECOR = {};
const decorator = (kind, pass, fn) => { fn.pass = pass; DECOR[kind] = fn; };

/* 1. kerb stone 18 cm, rounded, stained purple-black */
decorator('kerb', 'ground', (ctx, k) => {
  ctx.fillStyle = '#1a1024';
  ctx.beginPath();
  ctx.roundRect(k.x, k.y, k.w, Math.max(3, k.h), 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(k.x, k.y);
  ctx.lineTo(k.x + k.w, k.y);
  ctx.stroke();
});

/* 2. tactile paving, brass-yellow, studs missing, sequin-epoxy repairs */
decorator('crossing', 'ground', (ctx, c) => {
  ctx.fillStyle = 'rgba(242,193,78,0.07)';
  ctx.fillRect(c.x, c.y, c.w, c.h);
  for (const s of c.studs) {
    if (s.state === 'missing') {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, 2.6, 2.6, 0, 0, TAU);
      ctx.fill();
      continue;
    }
    ctx.fillStyle = s.state === 'sequin' ? '#ff6fd0' : '#f2c14e';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, 3, 3, 0, 0, TAU);
    ctx.fill();
    if (s.state === 'sequin') {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath();
      ctx.ellipse(s.x - 0.8, s.y - 0.8, 1, 1, 0, 0, TAU);
      ctx.fill();
    }
  }
});

/* 3. puddles: long skinny mirrors against shopfronts */
decorator('puddle', 'ground', (ctx, p, t) => {
  const g = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
  g.addColorStop(0, 'rgba(255,63,164,0.30)');
  g.addColorStop(0.45, 'rgba(120,90,255,0.22)');
  g.addColorStop(1, 'rgba(201,255,74,0.14)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(p.x, p.y, p.w, p.h, p.h / 2);
  ctx.fill();
  // the sign it is reflecting, dragged along its length
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(p.x + 4, p.y + p.h * 0.55 + Math.sin(t + p.x) * 1.2);
  ctx.lineTo(p.x + p.w - 4, p.y + p.h * 0.45 + Math.sin(t + p.x) * 1.2);
  ctx.stroke();
  if (p.sequins) {
    for (let i = 0; i < 5; i++) {
      const sx = p.x + ((i * 97) % 31) / 31 * p.w;
      ctx.fillStyle = ['#ffd633', '#8ef7ff', '#ff6fd0'][i % 3];
      ctx.beginPath();
      ctx.ellipse(sx, p.y + p.h * (0.3 + (i % 3) * 0.2), 1.6, 1.6, 0, 0, TAU);
      ctx.fill();
    }
  }
});

/* 4. drain mouths, THREAD logo, sometimes clogged */
decorator('drain', 'ground', (ctx, dr) => {
  ctx.fillStyle = '#140c1e';
  ctx.beginPath();
  ctx.roundRect(dr.x - 11, dr.y - 5, 22, 10, 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.13)';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(dr.x - 8 + i * 5, dr.y - 3.5);
    ctx.lineTo(dr.x - 8 + i * 5, dr.y + 3.5);
    ctx.stroke();
  }
  if (dr.clogged) {
    ctx.strokeStyle = 'rgba(255,111,208,0.7)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(dr.x + 3, dr.y + 1, 2.6, 0, TAU * 0.75);
    ctx.stroke();
  }
  if (dr.logo) {
    ctx.fillStyle = 'rgba(201,255,74,0.35)';
    ctx.fillRect(dr.x + 6, dr.y - 1.2, 3.4, 2.4);
  }
});

/* 6. identity gates: frosted glass that blooms a scan-line */
decorator('scanStrip', 'ground', (ctx, s, t) => {
  const pulse = 0.35 + Math.sin(t * 2.4) * 0.15;
  ctx.fillStyle = `rgba(200,235,255,${0.1 + pulse * 0.12})`;
  ctx.fillRect(s.x, s.y, s.w, s.h);
  ctx.strokeStyle = `rgba(200,245,255,${0.4 + pulse * 0.3})`;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(s.x, s.y, s.w, s.h);
  const ly = s.y + ((t * 30) % s.h);
  ctx.strokeStyle = `rgba(255,255,255,${0.5 * pulse + 0.2})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(s.x, ly);
  ctx.lineTo(s.x + s.w, ly);
  ctx.stroke();
});

/* 10. fashionable trash */
decorator('litter', 'ground', (ctx, l) => {
  ctx.save();
  ctx.translate(l.x, l.y);
  ctx.rotate(l.rot);
  const c = LITTER_COLOR[l.type] || 'rgba(220,210,230,0.5)';
  ctx.fillStyle = c;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.8;
  if (l.type === 'mannequin-hand') {
    ctx.beginPath();
    ctx.roundRect(-5, -2, 10, 4, 2);
    ctx.fill();
    ctx.stroke();
    for (let i = 0; i < 3; i++) ctx.fillRect(3, -2 + i * 1.6, 4, 1.1);
  } else if (l.type === 'cracked-heel') {
    ctx.beginPath();
    ctx.moveTo(-5, 0);
    ctx.lineTo(4, -2);
    ctx.lineTo(5, 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (l.type === 'thermal-receipt') {
    ctx.fillRect(-3, -6, 6, 12);
    ctx.strokeRect(-3, -6, 6, 12);
  } else {
    ctx.beginPath();
    ctx.roundRect(-4, -1.6, 8, 3.2, 1.4);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
});

const LITTER_COLOR = {
  'lost-sleeve': 'rgba(255,111,208,0.55)',
  'cracked-heel': 'rgba(240,235,225,0.6)',
  'mannequin-hand': 'rgba(235,225,215,0.7)',
  'thermal-receipt': 'rgba(250,250,245,0.55)',
  'hologram-comb': 'rgba(142,247,255,0.6)',
  'paper-tag': 'rgba(255,240,200,0.6)',
  'snap-button': 'rgba(216,207,196,0.7)',
  'hair-tie': 'rgba(201,255,74,0.5)',
};

/* 7. railings: 1.1 m, mustard or coral, chipped paint, cloth tags */
decorator('railing', 'upright', (ctx, r) => {
  const col = r.color === 'mustard' ? '#f2c14e' : '#e2674a';
  ctx.strokeStyle = col;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(r.x0, r.y0);
  ctx.lineTo(r.x1, r.y1);
  ctx.stroke();
  // chipped paint
  ctx.strokeStyle = 'rgba(40,30,50,0.55)';
  ctx.lineWidth = 1.4;
  ctx.setLineDash([3, 14]);
  ctx.stroke();
  ctx.setLineDash([]);
  // posts
  const len = Math.hypot(r.x1 - r.x0, r.y1 - r.y0);
  const n = Math.max(2, Math.floor(len / PPM / 2.2));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const px = r.x0 + (r.x1 - r.x0) * t;
    const py = r.y0 + (r.y1 - r.y0) * t;
    ctx.strokeStyle = 'rgba(30,22,40,0.8)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px, py + 9);
    ctx.stroke();
  }
  // cloth tags tied on by crews
  for (const tag of r.tags) {
    ctx.fillStyle = `hsl(${tag.hue} 80% 62%)`;
    ctx.beginPath();
    ctx.moveTo(tag.x, tag.y);
    ctx.lineTo(tag.x + 5, tag.y + 3);
    ctx.lineTo(tag.x + 1.5, tag.y + 9);
    ctx.closePath();
    ctx.fill();
  }
});

/* 8. overhead wires, Lowline and Undercut only */
decorator('wire', 'over', (ctx, w) => {
  ctx.strokeStyle = w.taped ? 'rgba(200,200,210,0.45)' : 'rgba(20,14,28,0.65)';
  ctx.lineWidth = w.taped ? 2.2 : 1.6;
  ctx.beginPath();
  ctx.moveTo(w.x0, w.y);
  ctx.quadraticCurveTo((w.x0 + w.x1) / 2, w.y + w.sag * PPM, w.x1, w.y);
  ctx.stroke();
});

/* cloth in the architecture: banners, drying jackets, tarps used as walls */
decorator('cloth', 'over', (ctx, c, t) => {
  // Seen from above. A 2 m drop is almost entirely foreshortened, so drawing it
  // at full height puts a billboard in the middle of the street -- the cloth
  // should read as a strip hanging off a line, catching the signage.
  const drop = c.dropM * PPM * 0.28;
  const sway = Math.sin(t * 0.55 + c.x * 0.006) * 2.5;
  const light = c.type === 'tarp' ? 30 : 48;

  // the line it hangs from
  ctx.strokeStyle = 'rgba(20,14,28,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(c.x - 4, c.y);
  ctx.lineTo(c.x + c.w + 4, c.y);
  ctx.stroke();

  ctx.save();
  ctx.globalAlpha = c.type === 'tarp' ? 0.55 : 0.8;
  ctx.fillStyle = `hsl(${c.hue} 55% ${light}%)`;
  ctx.beginPath();
  ctx.moveTo(c.x, c.y);
  ctx.quadraticCurveTo(c.x + c.w / 2, c.y + c.sag * 4, c.x + c.w, c.y);
  ctx.lineTo(c.x + c.w + sway * 0.3, c.y + drop);
  ctx.quadraticCurveTo(c.x + c.w / 2 + sway, c.y + drop + c.sag * 6, c.x + sway * 0.3, c.y + drop);
  ctx.closePath();
  ctx.fill();
  // hard shadow fold, so it reads as cloth rather than a coloured pane
  ctx.fillStyle = `hsl(${c.hue} 55% ${Math.max(12, light - 20)}%)`;
  ctx.beginPath();
  ctx.moveTo(c.x + c.w * 0.55, c.y + 1);
  ctx.lineTo(c.x + c.w + sway * 0.3, c.y + 1);
  ctx.lineTo(c.x + c.w + sway * 0.3, c.y + drop);
  ctx.lineTo(c.x + c.w * 0.55 + sway * 0.6, c.y + drop);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(c.x + sway * 0.3, c.y + drop);
  ctx.quadraticCurveTo(c.x + c.w / 2 + sway, c.y + drop + c.sag * 6, c.x + c.w + sway * 0.3, c.y + drop);
  ctx.stroke();
  ctx.restore();
});

/* 9. smell proxies: steam, heat shimmer, perfume exhaust */
decorator('vent', 'over', (ctx, v, t) => {
  const c = {
    'steam-food': 'rgba(255,240,220,0.13)',
    'hot-plastic': 'rgba(201,255,74,0.10)',
    'rain-dust': 'rgba(180,190,255,0.09)',
    perfume: 'rgba(255,180,230,0.12)',
  }[v.type] || 'rgba(255,255,255,0.08)';
  for (let i = 0; i < 3; i++) {
    const ph = t * 0.6 + i * 1.7;
    const rise = ((ph % 3) / 3);
    const g = ctx.createRadialGradient(v.x, v.y - rise * 40, 2, v.x, v.y - rise * 40, 22 + rise * 26);
    g.addColorStop(0, c);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(v.x + Math.sin(ph) * 7, v.y - rise * 40, 22 + rise * 26, 16 + rise * 20, 0, 0, TAU);
    ctx.fill();
  }
});

/* shopfronts: roll-up shutter, deep threshold, one hanging sample on a hook */
decorator('shopfront', 'upright', (ctx, s) => {
  const th = s.thresholdM * PPM;
  // threshold shadow, 70-110 cm deep, so the door reads as recessed
  ctx.fillStyle = 'rgba(10,6,16,0.55)';
  ctx.fillRect(s.x, s.y - th, s.w, th);

  // interior spill: oxblood, warm, always lit
  if (s.enterable) {
    const g = ctx.createLinearGradient(0, s.y - th, 0, s.y + 40);
    g.addColorStop(0, 'rgba(160,40,55,0.5)');
    g.addColorStop(1, 'rgba(160,40,55,0)');
    ctx.fillStyle = g;
    ctx.fillRect(s.x + 6, s.y - th, s.w - 12, 50);
  }

  ctx.fillStyle = s.enterable ? '#3a2436' : '#2c1c30';
  ctx.fillRect(s.x, s.y, s.w, 26);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.strokeRect(s.x, s.y, s.w, 26);

  if (s.shutter) {
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(s.x + 2, s.y + 3 + i * 3.6);
      ctx.lineTo(s.x + s.w - 2, s.y + 3 + i * 3.6);
      ctx.stroke();
    }
  }
  // milk-plastic vitrine light on the pavement
  ctx.fillStyle = 'rgba(244,241,232,0.06)';
  ctx.fillRect(s.x + 3, s.y - th - 14, s.w - 6, 14);
});

/* one hanging sample on a hook outside — and the camera is pointed at it */
decorator('hook', 'upright', (ctx, hk, t) => {
  ctx.strokeStyle = 'rgba(216,207,196,0.8)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(hk.x, hk.y - 12);
  ctx.lineTo(hk.x, hk.y - 2);
  ctx.stroke();
  const sway = Math.sin(t * 0.9 + hk.x * 0.01) * 1.6;
  ctx.fillStyle = '#c94b8c';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(hk.x + sway, hk.y - 2);
  ctx.lineTo(hk.x + sway - 4.5, hk.y + 8);
  ctx.lineTo(hk.x + sway + 4.5, hk.y + 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
});

/* ---------------------------------------------------------------- stalls */

export function drawStall(ctx, st, t) {
  const handmade = st.fascia === 'plywood+cardboard';
  if (st.walkable) {
    // hoodie tunnel: a corridor of hanging garments you disappear into
    ctx.fillStyle = 'rgba(26,16,34,0.85)';
    ctx.fillRect(st.x, st.y, st.w, st.h);
    for (let i = 0; i < 22; i++) {
      const gx = st.x + 4 + ((i * 53) % 17) / 17 * (st.w - 8);
      const gy = st.y + (i / 22) * st.h;
      ctx.fillStyle = `hsl(${(i * 47) % 360} 45% ${26 + (i % 4) * 5}%)`;
      ctx.beginPath();
      ctx.roundRect(gx - 5, gy, 10, 22, 4);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.9;
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(201,255,74,0.5)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(st.x, st.y, st.w, st.h);
    ctx.setLineDash([]);
    return;
  }

  ctx.fillStyle = handmade ? '#6b4a33' : st.fascia === 'booth' ? '#241a2e' : '#54392a';
  ctx.fillRect(st.x, st.y, st.w, st.h);
  ctx.fillStyle = handmade ? '#7d5a3d' : st.fascia === 'booth' ? '#2e2138' : '#63452f';
  ctx.fillRect(st.x + 3, st.y + 3, st.w - 6, st.h - 9);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.strokeRect(st.x, st.y, st.w, st.h);

  // handmade matter: hot glue glitter, sequins, taped seams
  if (handmade) {
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = ['#ffd633', '#8ef7ff', '#ff6fd0', '#c9ff4a'][i % 4];
      ctx.beginPath();
      ctx.ellipse(st.x + 7 + i * 6, st.y + 9 + (i % 2) * 4, 2, 2, 0, 0, TAU);
      ctx.fill();
    }
  }

  if (st.type === 'B') {
    // shoe altar: one pedestal, one cheap spotlight, one rotating plate
    const cx = st.x + st.w / 2;
    const cy = st.y + st.h / 2;
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 46);
    g.addColorStop(0, 'rgba(255,255,230,0.45)');
    g.addColorStop(1, 'rgba(255,255,230,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 46, 34, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#d8cfc4';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 13, 7, t * 0.6, 0, TAU);
    ctx.fill();
    // velvet rope that is actually a bike lock wrapped in ribbon
    ctx.strokeStyle = '#c94b8c';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0.2, Math.PI * 1.7);
    ctx.stroke();
  }

  if (st.type === 'D') {
    // folk repair under a paper lantern
    const cx = st.x + st.w / 2;
    const g = ctx.createRadialGradient(cx, st.y + 6, 2, cx, st.y + 6, 40);
    g.addColorStop(0, 'rgba(255,196,120,0.4)');
    g.addColorStop(1, 'rgba(255,196,120,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, st.y + 6, 40, 30, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffd7a0';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(cx, st.y + 4, 7, 9, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }

  if (st.type === 'E') {
    // black curtain, and a kettle keeping the interior fogged
    ctx.fillStyle = 'rgba(8,5,12,0.88)';
    ctx.fillRect(st.x + 3, st.y + 3, st.w - 6, st.h - 9);
    const g = ctx.createRadialGradient(st.x + st.w / 2, st.y + st.h / 2, 2,
      st.x + st.w / 2, st.y + st.h / 2, 34);
    g.addColorStop(0, `rgba(210,220,255,${0.18 + Math.sin(t * 1.4) * 0.05})`);
    g.addColorStop(1, 'rgba(210,220,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(st.x + st.w / 2, st.y + st.h / 2, 34, 26, 0, 0, TAU);
    ctx.fill();
  }

  if (st.lamp === true) {
    // work lamp on a spring arm
    ctx.strokeStyle = 'rgba(216,207,196,0.7)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(st.x + st.w - 6, st.y + st.h - 4);
    ctx.lineTo(st.x + st.w - 12, st.y + 2);
    ctx.stroke();
    const g = ctx.createRadialGradient(st.x + st.w - 12, st.y + 2, 2, st.x + st.w - 12, st.y + 2, 30);
    g.addColorStop(0, 'rgba(255,240,190,0.5)');
    g.addColorStop(1, 'rgba(255,240,190,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(st.x + st.w - 12, st.y + 2, 30, 22, 0, 0, TAU);
    ctx.fill();
  }

  // stall label, hand-lettered on medical tape
  ctx.fillStyle = 'rgba(250,248,240,0.85)';
  ctx.fillRect(st.x + 4, st.y + st.h - 8, st.w - 8, 6);
  ctx.fillStyle = 'rgba(30,20,40,0.85)';
  ctx.font = '600 6px ui-monospace, monospace';
  ctx.fillText(st.type, st.x + 6, st.y + st.h - 3);
}

/* ----------------------------------------------------------- micro-props */

export function drawProp(ctx, p, t) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot || 0);
  ctx.scale(p.scale || 1, p.scale || 1);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  const fn = PROP[p.type] || PROP.default;
  fn(ctx, t, p);
  ctx.restore();
}

const PROP = {
  default(ctx) {
    ctx.fillStyle = 'rgba(200,190,210,0.5)';
    ctx.beginPath();
    ctx.roundRect(-4, -3, 8, 6, 2);
    ctx.fill();
    ctx.stroke();
  },
  'chunky-sneaker-on-cable'(ctx, t) {
    ctx.strokeStyle = 'rgba(30,22,40,0.7)';
    ctx.beginPath();
    ctx.moveTo(0, -26);
    ctx.lineTo(Math.sin(t * 0.7) * 3, -6);
    ctx.stroke();
    ctx.fillStyle = '#f2f0ea';
    ctx.strokeStyle = INK;
    ctx.beginPath();
    ctx.roundRect(-6 + Math.sin(t * 0.7) * 3, -6, 12, 6, 2.5);
    ctx.fill();
    ctx.stroke();
  },
  'cardboard-rk-panel'(ctx) {
    ctx.fillStyle = '#9a7048';
    ctx.beginPath();
    ctx.roundRect(-9, -12, 18, 24, 1.5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ff3fa4';
    ctx.font = '700 9px ui-monospace, monospace';
    ctx.fillText('RK', -6, 3);
  },
  'no-scans-sign'(ctx) {
    ctx.fillStyle = '#2a2036';
    ctx.beginPath();
    ctx.roundRect(-16, -13, 32, 26, 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#c9ff4a';
    ctx.font = '700 5px ui-monospace, monospace';
    ctx.fillText('NO SCANS', -13, -2);
    ctx.fillText('IN HOODS', -13, 6);
  },
  'car-hood-table'(ctx) {
    ctx.fillStyle = '#7b2f4a';
    ctx.beginPath();
    ctx.moveTo(-22, -9);
    ctx.quadraticCurveTo(0, -15, 22, -9);
    ctx.lineTo(19, 10);
    ctx.lineTo(-19, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.moveTo(-14, -6);
    ctx.quadraticCurveTo(0, -10, 14, -6);
    ctx.stroke();
  },
  'drone-in-shoebox'(ctx, t) {
    ctx.fillStyle = '#c98f5a';
    ctx.beginPath();
    ctx.roundRect(-10, -7, 20, 14, 1.5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#2a3050';
    ctx.beginPath();
    ctx.ellipse(0, 0, 5.5, 4, 0, 0, TAU);
    ctx.fill();
    const blink = (Math.sin(t * 1.3) + 1) / 2;
    ctx.fillStyle = `rgba(142,247,255,${0.25 + blink * 0.65})`;
    ctx.beginPath();
    ctx.ellipse(2, -1, 1.4, 1.4, 0, 0, TAU);
    ctx.fill();
  },
  'gaffer-tape-river'(ctx) {
    ctx.strokeStyle = 'rgba(196,196,205,0.65)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-26, 0);
    ctx.quadraticCurveTo(-8, -7, 6, 1);
    ctx.quadraticCurveTo(18, 8, 28, -1);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(30,22,40,0.55)';
    ctx.lineWidth = 1;
    ctx.stroke();
  },
  'bridge-stickers'(ctx) {
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = ['#ff3fa4', '#c9ff4a', '#8ef7ff', '#ffd633'][i % 4];
      ctx.save();
      ctx.rotate(i * 0.8);
      ctx.beginPath();
      ctx.roundRect(6 + (i % 3) * 5, -3, 7, 5, 1);
      ctx.fill();
      ctx.restore();
    }
  },
  'mannequin-hand-pointing'(ctx) {
    ctx.fillStyle = '#ece0d4';
    ctx.beginPath();
    ctx.roundRect(-7, -3, 14, 6, 2.5);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(6, -1.4, 7, 2.8, 1.4);
    ctx.fill();
    ctx.stroke();
  },
  'portable-ring-light'(ctx, t) {
    const g = ctx.createRadialGradient(0, 0, 3, 0, 0, 30);
    g.addColorStop(0, 'rgba(255,255,240,0.4)');
    g.addColorStop(1, 'rgba(255,255,240,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, 30, 22, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,240,0.85)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 9, 0, 0, TAU);
    ctx.stroke();
  },
  'folding-stool'(ctx) {
    ctx.fillStyle = '#3a4a6a';
    ctx.beginPath();
    ctx.roundRect(-7, -4, 14, 4, 1);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(30,22,40,0.8)';
    ctx.beginPath();
    ctx.moveTo(-6, 0); ctx.lineTo(-3, 7);
    ctx.moveTo(6, 0); ctx.lineTo(3, 7);
    ctx.stroke();
  },
  'confiscated-hood-in-bin'(ctx) {
    ctx.fillStyle = 'rgba(190,210,225,0.28)';
    ctx.beginPath();
    ctx.roundRect(-8, -9, 16, 18, 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#414553';
    ctx.beginPath();
    ctx.ellipse(0, 2, 5.5, 5, 0, 0, TAU);
    ctx.fill();
  },
  'perfume-canister-bollard'(ctx) {
    ctx.fillStyle = '#d8cfc4';
    ctx.beginPath();
    ctx.roundRect(-4, -12, 8, 24, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,180,230,0.5)';
    ctx.fillRect(-4, -12, 8, 4);
  },
  'paper-number-tag'(ctx) {
    ctx.fillStyle = '#fff6e0';
    ctx.beginPath();
    ctx.roundRect(-4, -5, 8, 10, 1);
    ctx.fill();
    ctx.stroke();
  },
  'bead-puddle'(ctx) {
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = ['#ffd633', '#c9ff4a', '#ff6fd0', '#8ef7ff'][i % 4];
      ctx.beginPath();
      ctx.ellipse(-8 + (i * 2.6), Math.sin(i) * 3, 1.6, 1.6, 0, 0, TAU);
      ctx.fill();
    }
  },
};

/* ------------------------------------------------------------- the skyline */

/** Almost every district can see another district. A bridge reveals an economy. */
export function drawSkyline(ctx, d, t) {
  for (const s of d.skyline) {
    const x = s.x * PPM;
    const baseY = s.y * PPM;
    const h = s.heightM * PPM * 0.28;
    ctx.save();
    ctx.globalAlpha = 0.85;
    if (s.kind === 'spire') {
      const g = ctx.createLinearGradient(0, baseY - h, 0, baseY);
      g.addColorStop(0, 'rgba(90,60,130,0.95)');
      g.addColorStop(1, 'rgba(40,24,66,0.95)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - 46, baseY);
      ctx.lineTo(x - 30, baseY - h);
      ctx.lineTo(x + 30, baseY - h);
      ctx.lineTo(x + 46, baseY);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(18,10,26,0.9)';
      ctx.lineWidth = 2;
      ctx.stroke();
      // the collar ring light at L12, visible from the whole basin
      const ring = ctx.createRadialGradient(x, baseY - h + 20, 4, x, baseY - h + 20, 90);
      ring.addColorStop(0, `rgba(255,240,200,${0.5 + Math.sin(t * 0.7) * 0.12})`);
      ring.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = ring;
      ctx.beginPath();
      ctx.ellipse(x, baseY - h + 20, 90, 34, 0, 0, TAU);
      ctx.fill();
      for (let i = 0; i < 9; i++) {
        ctx.fillStyle = i % 3 ? 'rgba(255,200,120,0.35)' : 'rgba(201,255,74,0.3)';
        ctx.fillRect(x - 26 + (i % 5) * 12, baseY - h + 44 + Math.floor(i / 5) * 40, 7, 16);
      }
      if (s.label) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.font = '700 13px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(s.label, x, baseY - h - 14);
        ctx.textAlign = 'left';
      }
    } else {
      ctx.fillStyle = s.kind === 'ridge' ? 'rgba(60,70,120,0.8)' : 'rgba(46,32,62,0.85)';
      ctx.beginPath();
      ctx.roundRect(x - 70, baseY - h, 140, h, 6);
      ctx.fill();
      ctx.strokeStyle = 'rgba(18,10,26,0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();
      for (let i = 0; i < 14; i++) {
        ctx.fillStyle = i % 4 ? 'rgba(200,220,255,0.18)' : 'rgba(255,63,164,0.25)';
        ctx.fillRect(x - 60 + (i % 7) * 17, baseY - h + 14 + Math.floor(i / 7) * 26, 9, 12);
      }
      if (s.label) {
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.font = '700 11px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(s.label, x, baseY - h - 10);
        ctx.textAlign = 'left';
      }
    }
    ctx.restore();
  }
}

/**
 * The fill pass: wet-ground bounce, cooler than the key. Drawn last over the
 * ground so neon never sits on a black void.
 */
export function drawBounce(ctx, d, t) {
  const { w, h } = d.world;
  const g = ctx.createLinearGradient(0, h, 0, h * 0.4);
  g.addColorStop(0, hexA(LIGHT.fill, 0.10));
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

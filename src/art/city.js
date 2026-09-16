/**
 * VESTA rendering. Not generic cyberpunk: wet purple pavement, low sneaker-level
 * light, cardboard market stalls that leak into digital space, signage that
 * looks half-illustrated. The city is always watching, but it is vain.
 */

const TAU = Math.PI * 2;

export function drawGround(ctx, mission, district, view, time) {
  const { w, h } = mission.world;
  ctx.fillStyle = district.ground;
  ctx.fillRect(0, 0, w, h);

  // wet pavement: long soft smears of neon, never a hard grid
  const g = ctx.createRadialGradient(w * 0.3, h * 0.2, 40, w * 0.3, h * 0.2, w * 0.7);
  g.addColorStop(0, hexA(district.neon, 0.11));
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(255,255,255,0.028)';
  ctx.lineWidth = 2;
  for (let x = 0; x < w; x += 120) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 40, h);
    ctx.stroke();
  }

  // puddles catching the signage
  for (const p of puddlesFor(mission)) {
    const pg = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, p.r);
    pg.addColorStop(0, hexA(district.neon, 0.16 + Math.sin(time * 1.4 + p.x) * 0.03));
    pg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.r, p.r * 0.45, 0, 0, TAU);
    ctx.fill();
  }
}

const _puddleCache = new WeakMap();
function puddlesFor(mission) {
  let p = _puddleCache.get(mission);
  if (p) return p;
  p = [];
  let seed = mission.world.w * 7 + mission.world.h;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < 18; i++) {
    p.push({ x: rnd() * mission.world.w, y: rnd() * mission.world.h, r: 40 + rnd() * 90 });
  }
  _puddleCache.set(mission, p);
  return p;
}

export function drawZones(ctx, mission, packet, time) {
  for (const z of mission.zones) {
    const r = z.rect;
    ctx.fillStyle = z.tint || 'rgba(255,255,255,0.03)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    if (z.access > 0) {
      const open = packet && packet.access >= z.access;
      ctx.strokeStyle = open ? 'rgba(90,255,180,0.5)' : 'rgba(255,80,120,0.45)';
      ctx.lineWidth = 3;
      ctx.setLineDash([14, 10]);
      ctx.lineDashOffset = -time * 24;
      ctx.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
      ctx.setLineDash([]);
      ctx.fillStyle = open ? 'rgba(90,255,180,0.75)' : 'rgba(255,110,150,0.75)';
      ctx.font = '600 15px ui-monospace, monospace';
      ctx.fillText(`${z.name.toUpperCase()}  ·  ACCESS ${z.access}`, r.x + 14, r.y + 26);
      if (z.wants && z.wants.length) {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '500 12px ui-monospace, monospace';
        ctx.fillText(`wants ${z.wants.join(' / ')}`, r.x + 14, r.y + 44);
      }
    }
    if (z.door) {
      const d = z.door;
      const open = packet && packet.access >= z.access;
      ctx.fillStyle = open ? 'rgba(90,255,180,0.35)' : 'rgba(255,80,120,0.3)';
      ctx.fillRect(d.x, d.y, d.w, d.h);
      ctx.strokeStyle = open ? '#5affb4' : '#ff5078';
      ctx.lineWidth = 2;
      ctx.strokeRect(d.x, d.y, d.w, d.h);
    }
  }
}

export function drawWalls(ctx, mission, district) {
  for (const w of mission.walls) {
    if (w.kind === 'stall') {
      // cardboard and bead stalls: warm, handmade, visibly glued together
      ctx.fillStyle = '#5a3b2a';
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.fillStyle = '#6f4a33';
      ctx.fillRect(w.x + 3, w.y + 3, w.w - 6, w.h - 10);
      ctx.strokeStyle = 'rgba(20,12,24,0.8)';
      ctx.lineWidth = 2;
      ctx.strokeRect(w.x, w.y, w.w, w.h);
      ctx.fillStyle = hexA(district.neon, 0.5);
      ctx.fillRect(w.x + 8, w.y + w.h - 7, w.w - 16, 3);
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = ['#ffd400', '#3ddc97', '#ff3fa4', '#8ef7ff'][i];
        ctx.beginPath();
        ctx.ellipse(w.x + 14 + i * 16, w.y + 12, 3, 3, 0, 0, TAU);
        ctx.fill();
      }
    } else if (w.kind === 'glass') {
      ctx.fillStyle = 'rgba(160,220,255,0.16)';
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.strokeStyle = 'rgba(200,245,255,0.6)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(w.x, w.y, w.w, w.h);
    } else {
      ctx.fillStyle = '#191226';
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.fillStyle = '#241a35';
      ctx.fillRect(w.x, w.y, w.w, Math.min(8, w.h));
      ctx.strokeStyle = hexA(district.neon, 0.35);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(w.x + 0.5, w.y + 0.5, w.w - 1, w.h - 1);
    }
  }
}

export function drawCameraCone(ctx, cam, alertColor, seeing) {
  const a = cam.angle;
  const half = (cam.arc * Math.PI) / 180 / 2;
  const g = ctx.createRadialGradient(cam.x, cam.y, 10, cam.x, cam.y, cam.range);
  const base = seeing ? 'rgba(255,70,110,' : 'rgba(255,255,255,';
  g.addColorStop(0, base + (seeing ? '0.3)' : '0.16)'));
  g.addColorStop(1, base + '0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(cam.x, cam.y);
  ctx.arc(cam.x, cam.y, cam.range, a - half, a + half);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = seeing ? 'rgba(255,90,130,0.7)' : 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // the housing itself
  ctx.fillStyle = '#0e0a16';
  ctx.beginPath();
  ctx.ellipse(cam.x, cam.y, 9, 9, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = seeing ? '#ff4a72' : alertColor;
  ctx.beginPath();
  ctx.ellipse(cam.x + Math.cos(a) * 4, cam.y + Math.sin(a) * 4, 3.4, 3.4, 0, 0, TAU);
  ctx.fill();
}

export function drawGuard(ctx, g, time) {
  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 2, 12, 4.5, 0, 0, TAU);
  ctx.fill();

  // vision wedge, soft. guards read packets, they do not really look
  const half = 0.5;
  const gr = ctx.createRadialGradient(0, 0, 8, 0, 0, g.sees);
  const hot = g.suspicion > 4;
  gr.addColorStop(0, hot ? 'rgba(255,190,60,0.2)' : 'rgba(255,255,255,0.08)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, g.sees, g.angle - half, g.angle + half);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#11213a';
  ctx.beginPath();
  ctx.roundRect(-8, -22, 16, 18, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(10,8,16,0.8)';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.fillStyle = '#e8c9a8';
  ctx.beginPath();
  ctx.ellipse(0, -27, 6.4, 6.8, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#0d1a2e';
  ctx.beginPath();
  ctx.ellipse(0, -30, 7, 4.4, 0, 0, TAU);
  ctx.fill();

  if (g.suspicion > 0) {
    const t = Math.min(1, g.suspicion / 100);
    ctx.fillStyle = `rgba(255,${200 - t * 150},60,0.95)`;
    ctx.font = '700 20px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(t >= 1 ? '!' : '?', 0, -40 - Math.sin(time * 6) * 2);
    ctx.textAlign = 'left';
  }
  ctx.restore();
}

export function drawExtraction(ctx, rect, time, armed) {
  const pulse = 0.4 + Math.sin(time * 3) * 0.18;
  ctx.fillStyle = armed ? `rgba(90,255,180,${pulse * 0.5})` : `rgba(255,255,255,${pulse * 0.16})`;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.strokeStyle = armed ? '#5affb4' : 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 8]);
  ctx.lineDashOffset = -time * 40;
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  ctx.setLineDash([]);
  ctx.fillStyle = armed ? '#5affb4' : 'rgba(255,255,255,0.5)';
  ctx.font = '700 16px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(armed ? 'RUNWAY — WALK OUT' : 'RUNWAY (LOCKED)', rect.x + rect.w / 2, rect.y + rect.h / 2);
  ctx.textAlign = 'left';
}

export function drawProp(ctx, prop, time, taken) {
  ctx.save();
  ctx.translate(prop.x, prop.y);
  if (prop.kind === 'objective' && !taken) {
    const s = 1 + Math.sin(time * 2.5) * 0.06;
    ctx.scale(s, s);
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 46);
    g.addColorStop(0, 'rgba(255,212,0,0.5)');
    g.addColorStop(1, 'rgba(255,212,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, 46, 46, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffd400';
    ctx.beginPath();
    ctx.roundRect(-13, -16, 26, 30, 5);
    ctx.fill();
    ctx.strokeStyle = '#3a2c00';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#3a2c00';
    ctx.fillRect(-4, -16, 8, 30);
  } else if (prop.kind === 'rack') {
    ctx.fillStyle = '#2a2038';
    ctx.beginPath();
    ctx.roundRect(-26, -10, 52, 20, 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = ['#ff3fa4', '#8ef7ff', '#ffd400', '#3ddc97'][i];
      ctx.fillRect(-20 + i * 11, -6, 7, 12);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '600 11px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('RACK · E', 0, 26);
    ctx.textAlign = 'left';
  }
  ctx.restore();
}

/** Floating signage that looks half-illustrated, never fully rendered. */
export function drawSignage(ctx, mission, district, time) {
  const signs = signsFor(mission, district);
  for (const s of signs) {
    const y = s.y + Math.sin(time * 0.6 + s.x) * 5;
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = hexA(s.color, 0.18);
    ctx.beginPath();
    ctx.roundRect(s.x, y, s.w, 30, 6);
    ctx.fill();
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = s.color;
    ctx.font = '700 15px ui-monospace, monospace';
    ctx.fillText(s.text, s.x + 10, y + 21);
    ctx.restore();
  }
}

const _signCache = new WeakMap();
function signsFor(mission, district) {
  let s = _signCache.get(mission);
  if (s) return s;
  const words = ['FIT?', 'SCANNED', 'NEW DROP', 'NO FAKES', 'LOOK UP', 'THREAD ✓', '1/1'];
  const cols = ['#ff3fa4', '#8ef7ff', '#ffd400', '#3ddc97'];
  s = [];
  let seed = 991;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < 9; i++) {
    const text = words[i % words.length];
    s.push({
      x: 80 + rnd() * (mission.world.w - 260),
      y: 60 + rnd() * (mission.world.h - 160),
      w: text.length * 10 + 24,
      text,
      color: cols[Math.floor(rnd() * cols.length)],
    });
  }
  _signCache.set(mission, s);
  return s;
}

export function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Canvas UI primitives. Loud, monospaced, readable at a glance mid-run. */

export const FONT = {
  display: (px) => `800 ${px}px "Arial Black", Impact, ui-sans-serif, sans-serif`,
  mono: (px, w = 600) => `${w} ${px}px ui-monospace, "SF Mono", Menlo, monospace`,
};

export function panel(ctx, x, y, w, h, opts = {}) {
  const { fill = 'rgba(14,10,22,0.86)', stroke = 'rgba(255,255,255,0.14)', r = 10, glow = null } = opts;
  ctx.save();
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = 24;
  }
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

export function text(ctx, str, x, y, opts = {}) {
  const { font = FONT.mono(14), color = '#e9e6f2', align = 'left', baseline = 'alphabetic' } = opts;
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(str, x, y);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

/** Word-wrapped body copy. Returns the y it finished at. */
export function paragraph(ctx, str, x, y, maxW, opts = {}) {
  const { font = FONT.mono(13, 400), color = 'rgba(233,230,242,0.75)', lh = 19 } = opts;
  ctx.font = font;
  ctx.fillStyle = color;
  const words = str.split(' ');
  let line = '';
  let cy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, cy);
      cy += lh;
      line = word;
    } else {
      line = test;
    }
  }
  if (line) { ctx.fillText(line, x, cy); cy += lh; }
  return cy;
}

export function meter(ctx, x, y, w, h, value, opts = {}) {
  const { color = '#ff3fa4', bg = 'rgba(255,255,255,0.1)', label = '', warn = 0.75 } = opts;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  const v = Math.max(0, Math.min(1, value));
  if (v > 0) {
    ctx.fillStyle = v > warn ? '#ff4a72' : color;
    ctx.beginPath();
    ctx.roundRect(x, y, Math.max(h, w * v), h, h / 2);
    ctx.fill();
  }
  if (label) {
    text(ctx, label, x, y - 6, { font: FONT.mono(11, 700), color: 'rgba(255,255,255,0.6)' });
  }
}

/** Returns true if clicked this frame. Hover state is derived, not stored. */
export function button(ctx, input, rect, label, opts = {}) {
  const { enabled = true, accent = '#ff3fa4', sub = '' } = opts;
  const { x, y, w, h } = rect;
  const p = input.pointer;
  const hover = enabled && p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
  ctx.save();
  ctx.globalAlpha = enabled ? 1 : 0.4;
  ctx.fillStyle = hover ? accent : 'rgba(22,16,34,0.9)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = hover ? '#ffffff' : accent;
  ctx.lineWidth = hover ? 2 : 1.4;
  ctx.stroke();
  text(ctx, label, x + w / 2, y + h / 2 + (sub ? -5 : 0), {
    font: FONT.mono(14, 700),
    color: hover ? '#0e0a16' : '#e9e6f2',
    align: 'center',
    baseline: 'middle',
  });
  if (sub) {
    text(ctx, sub, x + w / 2, y + h / 2 + 12, {
      font: FONT.mono(11, 500),
      color: hover ? 'rgba(14,10,22,0.8)' : 'rgba(233,230,242,0.55)',
      align: 'center',
      baseline: 'middle',
    });
  }
  ctx.restore();
  return hover && p.clicked;
}

export function tagChip(ctx, tag, x, y, active = true) {
  const w = tag.length * 8 + 16;
  ctx.fillStyle = active ? 'rgba(255,63,164,0.22)' : 'rgba(255,255,255,0.06)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, 20, 10);
  ctx.fill();
  ctx.strokeStyle = active ? 'rgba(255,63,164,0.8)' : 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.stroke();
  text(ctx, tag, x + w / 2, y + 14, {
    font: FONT.mono(11, 700),
    color: active ? '#ffb3da' : 'rgba(255,255,255,0.45)',
    align: 'center',
  });
  return w + 6;
}

export function statBar(ctx, name, value, x, y, w) {
  text(ctx, name, x, y + 9, { font: FONT.mono(11, 600), color: 'rgba(255,255,255,0.55)' });
  const bx = x + 74;
  const bw = w - 92;
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(bx, y + 2, bw, 8);
  const v = value / 10;
  ctx.fillStyle = value >= 8 ? '#3ddc97' : value <= 3 ? '#ff4a72' : '#ffd400';
  ctx.fillRect(bx, y + 2, bw * v, 8);
  text(ctx, String(value), x + w - 12, y + 9, {
    font: FONT.mono(11, 700), color: '#e9e6f2', align: 'right',
  });
}

/** Rolling mission log. Old lines fade rather than disappearing. */
export class Log {
  constructor(max = 6) { this.lines = []; this.max = max; }
  push(str, color = '#e9e6f2') {
    this.lines.push({ str, color, t: 0 });
    while (this.lines.length > this.max) this.lines.shift();
  }
  update(dt) { for (const l of this.lines) l.t += dt; }
  draw(ctx, x, y) {
    let cy = y;
    for (let i = this.lines.length - 1; i >= 0; i--) {
      const l = this.lines[i];
      const a = Math.max(0, 1 - (l.t - 4) / 2.5);
      if (a <= 0) continue;
      ctx.globalAlpha = a;
      text(ctx, l.str, x, cy, { font: FONT.mono(13, 600), color: l.color });
      ctx.globalAlpha = 1;
      cy -= 19;
    }
  }
}

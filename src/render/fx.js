/**
 * Impact effects.
 *
 * Everything here is triggered by the match's own events, so what you see is
 * what the simulation decided -- a spark burst sits exactly where the hitbox
 * overlapped the hurtbox, not where it looked about right.
 */

export class FX {
  constructor() {
    this.sparks = [];
    this.rings = [];
    this.flash = 0;
    this.floats = [];
  }

  hit(contact, move, ko) {
    const n = ko ? 54 : 18 + Math.round(move.damage / 5);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 120 + Math.random() * (ko ? 980 : 540);
      this.sparks.push({
        x: contact.x, y: contact.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 180,
        life: 0.45 + Math.random() * 0.55, max: 1,
        size: 1.5 + Math.random() * 3.6,
        c: ko ? ['#fff6d8', '#ff4d6d', '#f5c518'][i % 3] : ['#f5c518', '#fff6d8', '#52d8ef'][i % 3],
      });
    }
    this.rings.push({ x: contact.x, y: contact.y, r: 8, max: ko ? 190 : 96, life: 1 });
    this.flash = Math.min(1, this.flash + (ko ? 1 : 0.55));
    this.floats.push({ x: contact.x, y: contact.y - 40, text: String(move.damage), life: 1, vy: -70 });
  }

  block(contact) {
    for (let i = 0; i < 12; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.8;
      const sp = 90 + Math.random() * 260;
      this.sparks.push({
        x: contact.x, y: contact.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.3 + Math.random() * 0.3, max: 1,
        size: 1.2 + Math.random() * 2, c: '#9fe8ff',
      });
    }
    this.rings.push({ x: contact.x, y: contact.y, r: 6, max: 54, life: 1 });
  }

  step(dt) {
    this.flash *= 0.80;
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const p = this.sparks[i];
      p.life -= dt * 1.7;
      if (p.life <= 0) { this.sparks.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 1500 * dt;
      p.vx *= 0.97;
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt * 2.6;
      r.r += (r.max - r.r) * Math.min(1, dt * 12);
      if (r.life <= 0) this.rings.splice(i, 1);
    }
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.life -= dt * 1.1;
      f.y += f.vy * dt;
      f.vy *= 0.94;
      if (f.life <= 0) this.floats.splice(i, 1);
    }
  }

  drawWorld(ctx, zoom) {
    for (const r of this.rings) {
      ctx.strokeStyle = `rgba(255,246,216,${Math.max(0, r.life) * 0.7})`;
      ctx.lineWidth = Math.max(1, 5 * r.life) / zoom;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, r.r, r.r * 0.72, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const p of this.sparks) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.max));
      ctx.fillStyle = p.c;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    for (const f of this.floats) {
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.fillStyle = '#fff6d8';
      ctx.font = `700 ${26}px ui-monospace, monospace`;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  drawScreen(ctx, view, dpr) {
    if (this.flash <= 0.01) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = `rgba(255,248,222,${this.flash * 0.28})`;
    ctx.fillRect(0, 0, view.w, view.h);
  }
}

/**
 * THE EXTRACTION WALK.
 *
 * Every contract ends the same way: a short walk where the district scores your
 * fit. You do not shoot your way out of VESTA, you get looked at on the way out
 * and the look either holds or it does not. Eighteen beats, four poses, and a
 * crowd that is only on your side while you are interesting.
 */

import { drawKin } from '../art/kinart.js';
import { FONT, panel, text, meter } from '../core/ui.js';
import { ResultsScene } from './results.js';
import { hexA } from '../art/city.js';

const TAU = Math.PI * 2;
const POSES = [
  { key: 'up', label: 'CHIN UP', arrow: '↑' },
  { key: 'down', label: 'DROP', arrow: '↓' },
  { key: 'left', label: 'TURN OUT', arrow: '←' },
  { key: 'right', label: 'TURN IN', arrow: '→' },
];

const BEAT = 1.05;
const LEAD = 2.4; // seconds a marker is visible before its beat
const PERFECT = 0.11;
const GOOD = 0.24;

export class RunwayScene {
  constructor(opts) {
    Object.assign(this, opts);
  }

  enter(game) {
    this.game = game;
    this.t = 0;
    this.walker = this.crew[0];
    this.beats = [];
    const count = 18;
    for (let i = 0; i < count; i++) {
      this.beats.push({
        time: 2 + i * BEAT,
        pose: POSES[Math.floor(Math.random() * POSES.length)],
        judged: null,
      });
    }
    this.duration = 2 + count * BEAT + 1.6;
    this.walkStyle = 0;
    this.perfects = 0;
    this.misses = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.flash = 0;
    this.judgement = null;
    this.judgeT = 0;
    this.pose = null;
    this.poseT = 0;

    // The district is the judge, and it has taste. A fit it wants scores more.
    const tags = this.walker.packet.tags;
    let match = 0;
    for (const tag of tags) {
      if (this.district.wants.includes(tag)) match += 1;
      if (this.district.rejects.includes(tag)) match -= 1;
    }
    this.fitMul = Math.max(0.5, 1 + match * 0.25);
    this.fitNote = match > 0 ? `${this.district.name} wants this` : match < 0 ? `${this.district.name} is not asking for this` : `${this.district.name} is undecided`;

    this.crowdRows = [];
    for (let i = 0; i < 26; i++) {
      this.crowdRows.push({
        side: i % 2 ? 1 : -1,
        y: -i * 74 - 40,
        off: Math.random() * 40,
        hue: Math.floor(Math.random() * 360),
        phase: Math.random() * TAU,
      });
    }
  }

  update(dt, game) {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt * 3);
    this.judgeT += dt;
    this.poseT += dt;

    const input = game.input;
    for (const pose of POSES) {
      if (!input.justPressed(pose.key)) continue;
      this.tryHit(pose);
    }

    // beats that walked past their window without an input are misses
    for (const b of this.beats) {
      if (!b.judged && this.t > b.time + GOOD) {
        b.judged = 'miss';
        this.misses++;
        this.combo = 0;
        this.walkStyle -= 40;
        this.judge('UNREAD', '#ff4a72');
      }
    }

    if (this.t > this.duration) this.finish();
  }

  tryHit(pose) {
    // nearest unjudged beat inside the window
    let best = null;
    for (const b of this.beats) {
      if (b.judged) continue;
      const d = Math.abs(this.t - b.time);
      if (d > GOOD) continue;
      if (!best || d < Math.abs(this.t - best.time)) best = b;
    }
    if (!best) {
      this.walkStyle -= 12;
      this.combo = 0;
      this.judge('TOO MUCH', 'rgba(255,255,255,0.5)');
      return;
    }
    const d = Math.abs(this.t - best.time);
    if (best.pose.key !== pose.key) {
      best.judged = 'wrong';
      this.misses++;
      this.combo = 0;
      this.walkStyle -= 25;
      this.judge('CLASH', '#ff9a3c');
      return;
    }
    this.pose = pose;
    this.poseT = 0;
    this.combo++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    if (d <= PERFECT) {
      best.judged = 'perfect';
      this.perfects++;
      this.walkStyle += 100 + this.combo * 6;
      this.flash = 1;
      this.judge('1/1', '#3ddc97');
    } else {
      best.judged = 'good';
      this.walkStyle += 55 + this.combo * 3;
      this.judge('READ', '#ffd400');
    }
  }

  judge(label, color) {
    this.judgement = { label, color };
    this.judgeT = 0;
  }

  finish() {
    const base = Math.max(0, Math.round(this.walkStyle * this.fitMul));
    const total = Math.round(this.run.style + base);
    const r = this.run;

    // Failure states are stylish. You can win the room and still lose the walk.
    let code = null;
    let reason = '';
    if (r.heat >= r.heatCap) {
      code = 'overexposed';
      reason = 'OVEREXPOSED — too famous to walk out clean';
    } else if (this.misses > 9) {
      code = 'unread';
      reason = 'UNREAD — the runway stopped looking. Doors ignore you now.';
    } else if (r.copies > 26 && this.mission.id !== 'trendbomb') {
      code = 'copied';
      reason = 'COPIED — the crowd took your drip. You are not unique any more.';
    }

    this.game.setScene(new ResultsScene({
      mission: this.mission,
      district: this.district,
      crew: this.crew,
      outcome: {
        success: !code,
        code,
        reason: reason || 'Extracted. The city is still arguing about the fit.',
        style: total,
        walkStyle: base,
        perfects: this.perfects,
        misses: this.misses,
        bestCombo: this.bestCombo,
        fitMul: this.fitMul,
        heat: r.heat,
        flags: r.flags,
        alerts: r.alerts,
        copies: r.copies,
        time: r.time,
      },
      save: this.save,
      upgrades: this.upgrades,
      onExit: this.onExit,
    }));
  }

  draw(ctx, game) {
    const { w, h } = game;
    const d = this.district;

    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, d.sky[0]);
    sky.addColorStop(1, d.sky[1]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;
    const scroll = this.t * 118;
    const hitY = h - 190;

    // ---- the runway itself, drawn in perspective toward a vanishing point
    const vy = h * 0.18;
    ctx.beginPath();
    ctx.moveTo(cx - 30, vy);
    ctx.lineTo(cx + 30, vy);
    ctx.lineTo(cx + 300, h);
    ctx.lineTo(cx - 300, h);
    ctx.closePath();
    const rg = ctx.createLinearGradient(0, vy, 0, h);
    rg.addColorStop(0, hexA(d.neon, 0.05));
    rg.addColorStop(1, hexA(d.neon, 0.24));
    ctx.fillStyle = rg;
    ctx.fill();
    ctx.strokeStyle = hexA(d.neon, 0.6);
    ctx.lineWidth = 2;
    ctx.stroke();

    // slats rushing under the walk
    for (let i = 0; i < 24; i++) {
      const p = ((i * 70 + scroll) % (h - vy)) / (h - vy);
      const y = vy + p * (h - vy);
      const halfW = 30 + p * 270;
      ctx.strokeStyle = `rgba(255,255,255,${0.04 + p * 0.1})`;
      ctx.lineWidth = 1 + p * 2;
      ctx.beginPath();
      ctx.moveTo(cx - halfW, y);
      ctx.lineTo(cx + halfW, y);
      ctx.stroke();
    }

    // ---- spectators. they tip style points and they are fickle
    for (const row of this.crowdRows) {
      // JS % keeps the sign of the dividend, and every row starts negative, so
      // a plain modulo silently deletes the entire crowd.
      const span = h + 200;
      const y = (((row.y + scroll) % span) + span) % span - 60;
      if (y < vy) continue;
      const p = (y - vy) / (h - vy);
      const halfW = 30 + p * 270;
      const x = cx + row.side * (halfW + 40 + row.off * p);
      const s = 0.35 + p * 1.3;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(s, s);
      ctx.fillStyle = `hsl(${row.hue} 55% ${32 + Math.sin(this.t * 3 + row.phase) * 6}%)`;
      ctx.beginPath();
      ctx.roundRect(-9, -26, 18, 26, 6);
      ctx.fill();
      ctx.fillStyle = '#e8b98f';
      ctx.beginPath();
      ctx.ellipse(0, -32, 7, 7.4, 0, 0, TAU);
      ctx.fill();
      // phone flash. the city is vain, and it records.
      if (Math.sin(this.t * 5 + row.phase) > 0.93) {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(-3, -22, 6, 8);
      }
      ctx.restore();
    }

    // ---- beat markers travelling down to the hit line
    for (const b of this.beats) {
      const dt = b.time - this.t;
      if (dt > LEAD || dt < -0.6) continue;
      const p = 1 - dt / LEAD;
      const y = vy + p * (hitY - vy);
      const s = 0.4 + p * 0.9;
      const judged = b.judged;
      const color = judged === 'perfect' ? '#3ddc97'
        : judged === 'good' ? '#ffd400'
          : judged ? '#ff4a72' : '#ffffff';
      ctx.save();
      ctx.globalAlpha = judged ? 0.3 : 1;
      ctx.translate(cx + posX(b.pose.key) * (70 + p * 120), y);
      ctx.scale(s, s);
      ctx.fillStyle = 'rgba(14,10,22,0.7)';
      ctx.beginPath();
      ctx.roundRect(-26, -26, 52, 52, 14);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.stroke();
      text(ctx, b.pose.arrow, 0, 2, { font: FONT.display(28), color, align: 'center', baseline: 'middle' });
      ctx.restore();
    }

    // ---- hit line
    ctx.strokeStyle = `rgba(255,255,255,${0.35 + this.flash * 0.5})`;
    ctx.lineWidth = 2 + this.flash * 3;
    ctx.beginPath();
    ctx.moveTo(cx - 300, hitY);
    ctx.lineTo(cx + 300, hitY);
    ctx.stroke();

    // ---- the walker
    const bob = Math.sin(this.t * 6) * 3;
    const poseLean = this.pose && this.poseT < 0.45
      ? { up: 0, down: 0.6, left: -1, right: 1 }[this.pose.key] : 0;
    ctx.save();
    ctx.translate(cx + poseLean * 14, hitY + 46 + bob);
    if (this.flash > 0) {
      ctx.shadowColor = '#3ddc97';
      ctx.shadowBlur = 40 * this.flash;
    }
    drawKin(ctx, {
      kin: this.walker.kin,
      thread: this.walker.thread,
      x: 0, y: 0, scale: 3.6,
      facing: Math.PI / 2 + poseLean * 0.5,
      phase: this.t * 7,
      moving: 1,
      expression: this.combo > 5 ? 'smug' : undefined,
    });
    ctx.restore();

    // ---- judgement pop
    if (this.judgement && this.judgeT < 0.7) {
      const a = 1 - this.judgeT / 0.7;
      ctx.globalAlpha = a;
      text(ctx, this.judgement.label, cx, hitY - 70 - (1 - a) * 30, {
        font: FONT.display(38), color: this.judgement.color, align: 'center',
      });
      ctx.globalAlpha = 1;
    }

    // ---- HUD
    panel(ctx, 16, 16, 300, 96, { glow: hexA(d.neon, 0.25) });
    text(ctx, 'EXTRACTION WALK', 32, 42, { font: FONT.display(18), color: '#fff' });
    text(ctx, this.fitNote, 32, 62, { font: FONT.mono(12, 600), color: this.fitMul > 1 ? '#3ddc97' : this.fitMul < 1 ? '#ff4a72' : 'rgba(255,255,255,0.6)' });
    text(ctx, `FIT MULTIPLIER  ×${this.fitMul.toFixed(2)}`, 32, 82, { font: FONT.mono(12, 700), color: '#ffd400' });
    text(ctx, `${this.walker.kin.codename} · ${this.walker.thread.name}`, 32, 100, {
      font: FONT.mono(11, 600), color: '#ff8ec8',
    });

    panel(ctx, w - 256, 16, 240, 96);
    text(ctx, 'WALK STYLE', w - 240, 42, { font: FONT.mono(11, 700), color: 'rgba(255,255,255,0.5)' });
    text(ctx, String(Math.max(0, Math.round(this.walkStyle))), w - 32, 42, {
      font: FONT.display(20), color: '#3ddc97', align: 'right',
    });
    text(ctx, `COMBO ×${this.combo}`, w - 240, 68, { font: FONT.mono(12, 700), color: '#ffd400' });
    text(ctx, `1/1 ${this.perfects}  ·  MISS ${this.misses}`, w - 240, 90, {
      font: FONT.mono(11, 600), color: 'rgba(255,255,255,0.6)',
    });

    const left = Math.max(0, this.duration - this.t);
    meter(ctx, w / 2 - 150, h - 44, 300, 8, 1 - left / this.duration, { color: d.neon });
    text(ctx, 'ARROWS / WASD on the beat. Nine misses and the runway stops looking.',
      w / 2, h - 18, { font: FONT.mono(11, 500), color: 'rgba(255,255,255,0.35)', align: 'center' });
  }
}

function posX(key) {
  // The walker owns the centre of the runway, so no lane sits on top of them.
  return { left: -1.6, up: -0.58, down: 0.58, right: 1.6 }[key];
}

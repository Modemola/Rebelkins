/**
 * CASH OUT. Traits, reputation, heat. Four reputation tracks move in different
 * directions on purpose -- there is no single score to maximise, because the
 * city is four separate audiences and they do not agree.
 */

import { FONT, panel, text, paragraph, button } from '../core/ui.js';
import { drawPortrait } from '../art/kinart.js';
import { BUILD_ORDER } from '../data/kin.js';
import { save as persist } from '../core/save.js';

const GRADES = [
  [1200, 'S', '#3ddc97', 'The city has to rewrite a district around you.'],
  [850, 'A', '#8ef7ff', 'That look is going to be everywhere by Thursday.'],
  [520, 'B', '#ffd400', 'Read. Filed. Respected.'],
  [260, 'C', '#ff9a3c', 'You got out. Nobody is going to talk about it.'],
  [0, 'D', '#ff4a72', 'Unread. The doors will remember that.'],
];

export class ResultsScene {
  constructor(opts) {
    Object.assign(this, opts);
  }

  enter(game) {
    this.game = game;
    this.t = 0;
    const o = this.outcome;
    const s = this.save;

    this.grade = GRADES.find((g) => o.style >= g[0]) || GRADES[GRADES.length - 1];

    // payout scales with style, never with kills
    const mul = o.success ? 0.6 + Math.min(2.2, o.style / 700) : 0.18;
    this.credEarned = Math.round(this.mission.payout.cred * mul);
    this.traitsEarned = o.success ? this.mission.payout.traits + (o.style > 900 ? 1 : 0) : 0;

    this.repDelta = {
      heat: Math.round((o.flags || 0) * 2 + (o.alerts || 0) * 4 - (o.success ? 2 : 0)),
      taste: o.success ? Math.round(o.style / 120) : -2,
      kinship: this.crew.some((c) => c.kin.species.includes('non-human') || c.kin.subjects > 1) && o.success ? 3 : 0,
      myth: Math.round((o.perfects || 0) * 1.2 + (o.success ? 2 : -1)),
    };

    s.cred += this.credEarned;
    s.traits += this.traitsEarned;
    for (const k of Object.keys(this.repDelta)) {
      s.rep[k] = Math.max(0, (s.rep[k] || 0) + this.repDelta[k]);
    }

    this.newKin = null;
    if (o.success) {
      s.completed[this.mission.id] = Math.max(s.completed[this.mission.id] || 0, o.style);
      const next = BUILD_ORDER.find((id) => !s.unlockedKin.includes(id));
      if (next) {
        s.unlockedKin.push(next);
        this.newKin = next;
      }
      s.bestStyle[this.mission.id] = Math.max(s.bestStyle[this.mission.id] || 0, o.style);
    }
    persist(s);
  }

  update(dt) { this.t += dt; }

  draw(ctx, game) {
    const { w, h } = game;
    const o = this.outcome;
    const [, letter, color, blurb] = this.grade;

    ctx.fillStyle = '#07040d';
    ctx.fillRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w / 2, h * 0.3, 40, w / 2, h * 0.3, w * 0.7);
    g.addColorStop(0, o.success ? 'rgba(61,220,151,0.13)' : 'rgba(255,74,114,0.13)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;
    text(ctx, o.success ? 'EXTRACTED' : 'RUN BURNED', cx, 78, {
      font: FONT.display(44), color: o.success ? '#fff' : '#ff4a72', align: 'center',
    });
    text(ctx, this.mission.name, cx, 106, {
      font: FONT.mono(13, 700), color: 'rgba(255,255,255,0.5)', align: 'center',
    });
    text(ctx, o.reason, cx, 134, {
      font: FONT.mono(14, 600), color: o.success ? '#8ef7ff' : '#ff9a3c', align: 'center',
    });

    // ---- grade
    panel(ctx, cx - 430, 166, 300, 200, { glow: `${color}33` });
    text(ctx, letter, cx - 280, 288, { font: FONT.display(104), color, align: 'center' });
    text(ctx, `${Math.round(o.style)} STYLE`, cx - 280, 322, {
      font: FONT.mono(14, 700), color: '#fff', align: 'center',
    });
    paragraph(ctx, blurb, cx - 412, 346, 264, { font: FONT.mono(11, 500), lh: 15 });

    // ---- run stats
    panel(ctx, cx - 110, 166, 300, 200);
    text(ctx, 'THE RUN', cx - 92, 194, { font: FONT.mono(11, 700), color: 'rgba(255,255,255,0.45)' });
    const rows = [
      ['time on site', fmtTime(o.time)],
      ['flagged by cameras', String(o.flags ?? 0)],
      ['guards challenged', String(o.alerts ?? 0)],
      ['crowd copies', String(o.copies ?? 0)],
      ['runway 1/1s', String(o.perfects ?? 0)],
      ['runway misses', String(o.misses ?? 0)],
      ['fit multiplier', o.fitMul ? `×${o.fitMul.toFixed(2)}` : '—'],
    ];
    rows.forEach(([k, v], i) => {
      const y = 222 + i * 21;
      text(ctx, k, cx - 92, y, { font: FONT.mono(12, 500), color: 'rgba(233,230,242,0.65)' });
      text(ctx, v, cx + 172, y, { font: FONT.mono(12, 700), color: '#fff', align: 'right' });
    });

    // ---- payout + rep
    panel(ctx, cx + 210, 166, 300, 200);
    text(ctx, 'CASH OUT', cx + 228, 194, { font: FONT.mono(11, 700), color: 'rgba(255,255,255,0.45)' });
    text(ctx, `+${this.credEarned} CRED`, cx + 228, 226, { font: FONT.display(22), color: '#ffd400' });
    text(ctx, `+${this.traitsEarned} TRAITS`, cx + 228, 252, { font: FONT.display(16), color: '#8ef7ff' });
    const reps = [
      ['Heat', this.repDelta.heat, '#ff9a3c'],
      ['Taste', this.repDelta.taste, '#8ef7ff'],
      ['Kinship', this.repDelta.kinship, '#3ddc97'],
      ['Myth', this.repDelta.myth, '#ff3fa4'],
    ];
    reps.forEach(([k, v, c], i) => {
      const y = 288 + i * 20;
      text(ctx, k, cx + 228, y, { font: FONT.mono(12, 500), color: 'rgba(233,230,242,0.65)' });
      text(ctx, `${v >= 0 ? '+' : ''}${v}`, cx + 482, y, {
        font: FONT.mono(12, 700), color: v === 0 ? 'rgba(255,255,255,0.35)' : c, align: 'right',
      });
    });

    // ---- crew line-up, drawn not listed
    panel(ctx, cx - 430, 390, 940, 150);
    text(ctx, 'THE CREW', cx - 412, 418, { font: FONT.mono(11, 700), color: 'rgba(255,255,255,0.45)' });
    this.crew.forEach((c, i) => {
      const x = cx - 340 + i * 230;
      drawPortrait(ctx, c.kin, x, 512, 76, o.success ? 'smug' : 'neutral');
      text(ctx, c.kin.codename, x + 56, 476, { font: FONT.mono(13, 800), color: '#fff' });
      text(ctx, c.thread.name, x + 56, 494, { font: FONT.mono(11, 600), color: '#ff8ec8' });
      text(ctx, c.kin.trueName, x + 56, 512, { font: FONT.mono(11, 500), color: 'rgba(255,255,255,0.45)' });
    });

    if (this.newKin) {
      const pulse = 0.7 + Math.sin(this.t * 4) * 0.3;
      panel(ctx, cx - 240, 560, 480, 52, { glow: `rgba(255,212,0,${pulse * 0.4})` });
      text(ctx, `ATELIER UNLOCK — ${this.newKin.toUpperCase()} JOINED THE ROSTER`, cx, 592, {
        font: FONT.mono(14, 800), color: '#ffd400', align: 'center',
      });
    }

    const by = this.newKin ? 630 : 578;
    if (button(ctx, game.input, { x: cx - 110, y: by, w: 220, h: 48 }, 'BACK TO THE ATELIER')) {
      this.onExit(this.save);
    }
  }
}

function fmtTime(s) {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${String(ss).padStart(2, '0')}`;
}

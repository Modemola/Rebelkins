/**
 * THE ATELIER — between-run hub.
 *
 * Four tabs because the loop has four decisions: which contract, which crew,
 * which Thread, and what the workshop learns next. The bible tab is here too:
 * a roster you cannot read is a roster you cannot cast.
 */

import { KIN, STAT_KEYS, getKin } from '../data/kin.js';
import { MISSIONS, getDistrict } from '../data/missions.js';
import { UPGRADES, REP_TRACKS, canBuy, resolveUpgrades } from '../data/atelier.js';
import { SHOT_LISTS, PRODUCTION_RULE, DRIP_LIBRARY, CITY_PLATES } from '../data/shotlists.js';
import { compilePacket } from '../systems/thread.js';
import { drawPortrait, drawKin } from '../art/kinart.js';
import { FONT, panel, text, paragraph, button, statBar, tagChip } from '../core/ui.js';
import { save as persist, wipe } from '../core/save.js';
import { MissionScene } from './mission.js';

const TABS = ['CONTRACTS', 'CREW', 'ATELIER', 'BIBLE'];

export class HubScene {
  constructor(saveState) {
    this.save = saveState;
    this.tab = 0;
    this.selectedMission = MISSIONS[0].id;
    this.crew = [{ kinId: 'spark', threadId: 'matchhead' }];
    this.bibleKin = 'spark';
    this.scroll = 0;
    this.toast = null;
    this.toastT = 0;
  }

  enter(game) {
    this.game = game;
    this.t = 0;
    this.upgrades = resolveUpgrades(this.save.owned);
    // trim a crew that no longer fits (a slot could have been spent elsewhere)
    this.crew = this.crew
      .filter((c) => this.save.unlockedKin.includes(c.kinId))
      .slice(0, this.upgrades.crewSlots);
    if (!this.crew.length) this.crew = [{ kinId: this.save.unlockedKin[0], threadId: getKin(this.save.unlockedKin[0]).threads[0].id }];
  }

  say(msg) { this.toast = msg; this.toastT = 0; }

  update(dt, game) {
    this.t += dt;
    this.toastT += dt;
    const input = game.input;
    this.scroll = Math.max(0, this.scroll + input.pointer.wheel * 0.6);
    for (let i = 0; i < 4; i++) {
      if (input.justPressed(`kin${i + 1}`)) { this.tab = i; this.scroll = 0; }
    }
  }

  draw(ctx, game) {
    const { w, h } = game;
    const input = game.input;

    ctx.fillStyle = '#07040d';
    ctx.fillRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w * 0.2, 0, 40, w * 0.2, 0, w);
    g.addColorStop(0, 'rgba(255,63,164,0.12)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // ---- masthead
    text(ctx, 'REBELKIN', 32, 56, { font: FONT.display(34), color: '#fff' });
    text(ctx, 'THREAD WAR', 32, 82, { font: FONT.mono(16, 800), color: '#ff3fa4' });
    text(ctx, 'VESTA · fashion is executable code', 32, 102, {
      font: FONT.mono(11, 500), color: 'rgba(255,255,255,0.4)',
    });

    // ---- wallet
    text(ctx, `${this.save.cred} CRED`, w - 32, 50, { font: FONT.display(20), color: '#ffd400', align: 'right' });
    text(ctx, `${this.save.traits} TRAITS`, w - 32, 72, { font: FONT.mono(13, 700), color: '#8ef7ff', align: 'right' });
    let rx = w - 32;
    for (let i = REP_TRACKS.length - 1; i >= 0; i--) {
      const r = REP_TRACKS[i];
      const label = `${r.name} ${this.save.rep[r.id] || 0}`;
      ctx.font = FONT.mono(11, 600);
      rx -= ctx.measureText(label).width + 16;
      text(ctx, label, rx, 94, {
        font: FONT.mono(11, 600),
        color: r.good ? 'rgba(141,247,255,0.8)' : 'rgba(255,154,60,0.9)',
      });
    }

    // ---- tabs
    TABS.forEach((label, i) => {
      const bx = 32 + i * 148;
      if (button(ctx, input, { x: bx, y: 122, w: 138, h: 38 }, label, {
        accent: i === this.tab ? '#ff3fa4' : 'rgba(255,255,255,0.25)',
      }) && this.tab !== i) {
        this.tab = i;
        this.scroll = 0;
      }
      if (i === this.tab) {
        ctx.fillStyle = '#ff3fa4';
        ctx.fillRect(bx, 158, 138, 3);
      }
    });

    const top = 184;
    if (this.tab === 0) this.drawContracts(ctx, game, top);
    else if (this.tab === 1) this.drawCrew(ctx, game, top);
    else if (this.tab === 2) this.drawAtelier(ctx, game, top);
    else this.drawBible(ctx, game, top);

    if (this.toast && this.toastT < 3) {
      ctx.globalAlpha = Math.min(1, (3 - this.toastT) / 0.6);
      panel(ctx, w / 2 - 210, h - 72, 420, 40, { glow: 'rgba(255,212,0,0.3)' });
      text(ctx, this.toast, w / 2, h - 47, { font: FONT.mono(13, 700), color: '#ffd400', align: 'center' });
      ctx.globalAlpha = 1;
    }
  }

  /* ----------------------------------------------------------- CONTRACTS */

  drawContracts(ctx, game, top) {
    const { w, h } = game;
    const input = game.input;
    const m = MISSIONS.find((x) => x.id === this.selectedMission);
    const d = getDistrict(m.district);

    // list
    MISSIONS.forEach((mm, i) => {
      const y = top + i * 104;
      const sel = mm.id === this.selectedMission;
      const done = this.save.completed[mm.id];
      panel(ctx, 32, y, 420, 92, {
        stroke: sel ? '#ff3fa4' : 'rgba(255,255,255,0.12)',
        fill: sel ? 'rgba(255,63,164,0.12)' : 'rgba(14,10,22,0.85)',
      });
      text(ctx, mm.type.toUpperCase(), 52, y + 26, { font: FONT.mono(10, 700), color: '#8ef7ff' });
      text(ctx, mm.name, 52, y + 50, { font: FONT.mono(15, 800), color: '#fff' });
      text(ctx, `${getDistrict(mm.district).name} · ~${mm.targetMinutes} min · ${mm.payout.cred} cred`, 52, y + 72, {
        font: FONT.mono(11, 500), color: 'rgba(255,255,255,0.5)',
      });
      if (done) {
        text(ctx, `BEST ${Math.round(done)}`, 432, y + 26, {
          font: FONT.mono(10, 700), color: '#3ddc97', align: 'right',
        });
      }
      const p = input.pointer;
      if (p.clicked && p.x > 32 && p.x < 452 && p.y > y && p.y < y + 92) {
        this.selectedMission = mm.id;
      }
    });

    // detail
    panel(ctx, 480, top, w - 512, 330);
    text(ctx, d.name, 504, top + 32, { font: FONT.display(22), color: d.neon });
    paragraph(ctx, d.blurb, 504, top + 56, w - 580, { lh: 18 });

    text(ctx, 'BRIEF', 504, top + 110, { font: FONT.mono(11, 700), color: 'rgba(255,255,255,0.45)' });
    paragraph(ctx, m.brief, 504, top + 132, w - 580, { lh: 19, color: '#e9e6f2' });

    text(ctx, 'THE DISTRICT WANTS', 504, top + 202, {
      font: FONT.mono(11, 700), color: 'rgba(255,255,255,0.45)',
    });
    if (this.upgrades.tasteMaps) {
      let tx = 504;
      for (const tag of d.wants) tx += tagChip(ctx, tag, tx, top + 212, true);
      tx += 10;
      for (const tag of d.rejects) tx += tagChip(ctx, `no ${tag}`, tx, top + 212, false);
    } else {
      text(ctx, 'buy District Taste Maps in the Atelier to read this before you compile',
        504, top + 226, { font: FONT.mono(11, 500), color: 'rgba(255,255,255,0.35)' });
    }

    text(ctx, 'INTEL', 504, top + 256, { font: FONT.mono(11, 700), color: 'rgba(255,255,255,0.45)' });
    m.tips.forEach((tip, i) => {
      text(ctx, `\u2022 ${tip}`, 504, top + 276 + i * 18, {
        font: FONT.mono(11, 500), color: 'rgba(233,230,242,0.6)',
      });
    });

    // crew readout + deploy
    const dy = top + 346;
    panel(ctx, 480, dy, w - 512, 158);
    text(ctx, 'DEPLOYING', 504, dy + 28, { font: FONT.mono(11, 700), color: 'rgba(255,255,255,0.45)' });
    this.crew.forEach((c, i) => {
      const kin = getKin(c.kinId);
      const thread = kin.threads.find((t) => t.id === c.threadId);
      const x = 504 + i * 208;
      drawPortrait(ctx, kin, x + 22, dy + 122, 54);
      text(ctx, kin.codename, x + 54, dy + 58, { font: FONT.mono(13, 800), color: '#fff' });
      text(ctx, thread.name, x + 54, dy + 76, { font: FONT.mono(11, 600), color: '#ff8ec8' });
      const packet = compilePacket(kin, thread, {
        district: d, licenses: this.upgrades.licenses, overlays: this.upgrades.overlays,
      });
      text(ctx, `access ${packet.access} \u00b7 desire ${packet.desirability}`, x + 54, dy + 94, {
        font: FONT.mono(10, 600), color: packet.tasteMatch > 0 ? '#3ddc97' : 'rgba(255,255,255,0.5)',
      });
      text(ctx, `scan \u00d7${packet.scanRate}`, x + 54, dy + 110, {
        font: FONT.mono(10, 600), color: 'rgba(142,247,255,0.8)',
      });
      if (packet.clash) {
        text(ctx, `CLASH ${packet.clash}`, x + 54, dy + 126, {
          font: FONT.mono(10, 700), color: '#ff4a72',
        });
      }
    });

    if (button(ctx, input, { x: 32, y: top + 332, w: 420, h: 56 }, 'DEPLOY', {
      accent: '#3ddc97', sub: `${this.crew.length} Kin \u00b7 ${m.type} \u00b7 ${d.name}`,
    })) {
      this.deploy(m);
    }
  }

  deploy(m) {
    this.game.setScene(new MissionScene({
      mission: m,
      crew: this.crew.map((c) => ({ ...c })),
      save: this.save,
      upgrades: this.upgrades,
      onExit: (s) => {
        this.save = s;
        this.game.setScene(this);
      },
    }));
  }

  /* ---------------------------------------------------------------- CREW */

  drawCrew(ctx, game, top) {
    const { w, h } = game;
    const input = game.input;
    const district = getDistrict(MISSIONS.find((x) => x.id === this.selectedMission).district);

    text(ctx, `ROSTER — ${this.crew.length}/${this.upgrades.crewSlots} slots`, 32, top + 4, {
      font: FONT.mono(12, 700), color: 'rgba(255,255,255,0.5)',
    });

    KIN.forEach((kin, i) => {
      const unlocked = this.save.unlockedKin.includes(kin.id);
      const x = 32 + (i % 3) * 188;
      const y = top + 20 + Math.floor(i / 3) * 210;
      const inCrew = this.crew.findIndex((c) => c.kinId === kin.id);
      panel(ctx, x, y, 176, 196, {
        stroke: inCrew >= 0 ? '#ff3fa4' : 'rgba(255,255,255,0.12)',
        fill: inCrew >= 0 ? 'rgba(255,63,164,0.12)' : 'rgba(14,10,22,0.85)',
      });
      ctx.save();
      ctx.globalAlpha = unlocked ? 1 : 0.22;
      drawPortrait(ctx, kin, x + 88, y + 118, 96);
      ctx.restore();
      text(ctx, kin.codename, x + 88, y + 152, {
        font: FONT.mono(13, 800), color: unlocked ? '#fff' : 'rgba(255,255,255,0.4)', align: 'center',
      });
      text(ctx, unlocked ? kin.role.split(',')[0] : 'LOCKED', x + 88, y + 170, {
        font: FONT.mono(10, 600), color: 'rgba(255,255,255,0.45)', align: 'center',
      });
      if (inCrew >= 0) {
        text(ctx, `SLOT ${inCrew + 1}`, x + 88, y + 186, {
          font: FONT.mono(10, 800), color: '#ff8ec8', align: 'center',
        });
      }
      const p = input.pointer;
      if (p.clicked && p.x > x && p.x < x + 176 && p.y > y && p.y < y + 196) {
        if (!unlocked) this.say('Locked. Finish contracts to unlock the next Kin in build order.');
        else if (inCrew >= 0) {
          if (this.crew.length > 1) this.crew.splice(inCrew, 1);
          else this.say('Somebody has to walk in.');
        } else if (this.crew.length >= this.upgrades.crewSlots) {
          this.say('No slot. Buy a crew slot in the Atelier.');
        } else {
          this.crew.push({ kinId: kin.id, threadId: kin.threads[0].id });
        }
      }
    });

    // ---- thread compiler for each crew member
    const px = 620;
    panel(ctx, px, top, w - px - 32, h - top - 32);
    text(ctx, 'COMPILE THREADS', px + 24, top + 30, {
      font: FONT.mono(12, 800), color: 'rgba(255,255,255,0.5)',
    });
    text(ctx, `reading against ${district.name}`, px + 24, top + 50, {
      font: FONT.mono(11, 500), color: 'rgba(255,255,255,0.35)',
    });

    this.crew.forEach((c, ci) => {
      const kin = getKin(c.kinId);
      const y = top + 74 + ci * 148;
      if (y > h - 120) return;
      text(ctx, kin.codename, px + 24, y + 4, { font: FONT.mono(14, 800), color: '#fff' });
      text(ctx, kin.trueName, px + 24 + ctx.measureText(kin.codename).width + 12, y + 4, {
        font: FONT.mono(11, 500), color: 'rgba(255,255,255,0.4)',
      });

      kin.threads.forEach((th, ti) => {
        const bx = px + 24 + ti * 210;
        const sel = c.threadId === th.id;
        const packet = compilePacket(kin, th, {
          district, licenses: this.upgrades.licenses, overlays: this.upgrades.overlays,
        });
        panel(ctx, bx, y + 16, 198, 108, {
          stroke: sel ? '#3ddc97' : 'rgba(255,255,255,0.12)',
          fill: sel ? 'rgba(61,220,151,0.1)' : 'rgba(255,255,255,0.03)',
        });
        text(ctx, `${'ABC'[ti]} · ${th.name}`, bx + 12, y + 38, {
          font: FONT.mono(12, 800), color: sel ? '#3ddc97' : '#e9e6f2',
        });
        let tx = bx + 12;
        for (const tag of th.tags) tx += tagChip(ctx, tag, tx, y + 46, packet.tasteMatch > 0);
        text(ctx, `access ${packet.access}  desire ${packet.desirability}  scan ×${packet.scanRate}`,
          bx + 12, y + 84, { font: FONT.mono(10, 600), color: 'rgba(255,255,255,0.6)' });
        text(ctx, `compile ${(packet.compileTime * this.upgrades.compileMul).toFixed(1)}s`,
          bx + 12, y + 100, { font: FONT.mono(10, 600), color: '#8ef7ff' });
        if (packet.clash) {
          text(ctx, `CLASH ${packet.clash}`, bx + 12, y + 116, {
            font: FONT.mono(10, 700), color: '#ff4a72',
          });
        }
        const p = input.pointer;
        if (p.clicked && p.x > bx && p.x < bx + 198 && p.y > y + 16 && p.y < y + 124) {
          c.threadId = th.id;
        }
      });
    });
  }

  /* ------------------------------------------------------------- ATELIER */

  drawAtelier(ctx, game, top) {
    const { w, h } = game;
    const input = game.input;

    panel(ctx, 32, top, 420, 200);
    text(ctx, 'REPUTATION', 52, top + 28, { font: FONT.mono(12, 800), color: 'rgba(255,255,255,0.5)' });
    REP_TRACKS.forEach((r, i) => {
      const y = top + 52 + i * 36;
      text(ctx, r.name, 52, y + 12, { font: FONT.mono(13, 700), color: r.good ? '#8ef7ff' : '#ff9a3c' });
      text(ctx, String(this.save.rep[r.id] || 0), 432, y + 12, {
        font: FONT.display(16), color: '#fff', align: 'right',
      });
      text(ctx, r.blurb, 52, y + 28, { font: FONT.mono(10, 500), color: 'rgba(255,255,255,0.4)' });
    });

    panel(ctx, 32, top + 216, 420, 150);
    text(ctx, 'ENDGAME', 52, top + 244, { font: FONT.mono(12, 800), color: 'rgba(255,255,255,0.5)' });
    paragraph(ctx, 'There is no final boss. The endgame is owning a look so specific the city has to rewrite a district around you.',
      52, top + 268, 380, { lh: 18 });
    if (button(ctx, input, { x: 52, y: top + 322, w: 160, h: 32 }, 'WIPE SAVE', { accent: '#ff4a72' })) {
      this.save = wipe();
      this.upgrades = resolveUpgrades(this.save.owned);
      this.crew = [{ kinId: 'spark', threadId: 'matchhead' }];
      this.say('Atelier stripped. Start again.');
    }

    // ---- upgrade list, scrollable
    const lx = 480;
    const lw = w - lx - 32;
    panel(ctx, lx, top, lw, h - top - 32);
    ctx.save();
    ctx.beginPath();
    ctx.rect(lx + 2, top + 2, lw - 4, h - top - 36);
    ctx.clip();

    const maxScroll = Math.max(0, UPGRADES.length * 86 + 40 - (h - top - 32));
    this.scroll = Math.min(this.scroll, maxScroll);

    UPGRADES.forEach((u, i) => {
      const y = top + 20 + i * 86 - this.scroll;
      if (y < top - 90 || y > h) return;
      const owned = this.save.owned.includes(u.id);
      const verdict = canBuy(u, this.save);
      panel(ctx, lx + 16, y, lw - 32, 76, {
        stroke: owned ? '#3ddc97' : verdict.ok ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)',
        fill: owned ? 'rgba(61,220,151,0.08)' : 'rgba(255,255,255,0.03)',
      });
      text(ctx, u.name, lx + 36, y + 26, {
        font: FONT.mono(13, 800), color: owned ? '#3ddc97' : '#fff',
      });
      text(ctx, u.branch.toUpperCase(), lx + 36, y + 44, {
        font: FONT.mono(9, 700), color: 'rgba(255,255,255,0.35)',
      });
      paragraph(ctx, u.desc, lx + 130, y + 26, lw - 340, { font: FONT.mono(11, 500), lh: 15 });

      const bx = lx + lw - 150;
      if (owned) {
        text(ctx, 'OWNED', bx + 60, y + 42, {
          font: FONT.mono(12, 800), color: '#3ddc97', align: 'center',
        });
      } else if (button(ctx, input, { x: bx, y: y + 20, w: 120, h: 38 },
        `${u.cost.cred}c${u.cost.traits ? ` / ${u.cost.traits}t` : ''}`, {
        enabled: verdict.ok, accent: '#ffd400', sub: verdict.ok ? 'buy' : verdict.why,
      })) {
        this.save.cred -= u.cost.cred;
        this.save.traits -= u.cost.traits || 0;
        this.save.owned.push(u.id);
        this.upgrades = resolveUpgrades(this.save.owned);
        persist(this.save);
        this.say(`${u.name} installed.`);
      }
    });
    ctx.restore();
    text(ctx, 'scroll', lx + lw - 56, h - 44, { font: FONT.mono(10, 600), color: 'rgba(255,255,255,0.3)' });
  }

  /* --------------------------------------------------------------- BIBLE */

  drawBible(ctx, game, top) {
    const { w, h } = game;
    const input = game.input;
    const kin = getKin(this.bibleKin);

    // roster rail
    KIN.forEach((k, i) => {
      const y = top + i * 62;
      const sel = k.id === this.bibleKin;
      panel(ctx, 32, y, 220, 54, {
        stroke: sel ? '#ff3fa4' : 'rgba(255,255,255,0.1)',
        fill: sel ? 'rgba(255,63,164,0.12)' : 'rgba(14,10,22,0.8)',
      });
      text(ctx, `${i + 1}. ${k.codename}`, 52, y + 24, {
        font: FONT.mono(12, 800), color: sel ? '#fff' : 'rgba(255,255,255,0.7)',
      });
      text(ctx, k.trueName, 52, y + 42, { font: FONT.mono(10, 500), color: 'rgba(255,255,255,0.4)' });
      const p = input.pointer;
      if (p.clicked && p.x > 32 && p.x < 252 && p.y > y && p.y < y + 54) {
        this.bibleKin = k.id;
        this.scroll = 0;
      }
    });

    // hero card
    panel(ctx, 276, top, 300, 320, { glow: `${kin.palette.hair}33` });
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(278, top + 4, 296, 196, 10);
    ctx.clip();
    const bg = ctx.createLinearGradient(0, top, 0, top + 200);
    bg.addColorStop(0, `${kin.palette.hair}22`);
    bg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bg;
    ctx.fillRect(278, top + 4, 296, 196);
    drawKin(ctx, {
      kin, thread: kin.threads[0], x: 426, y: top + 176, scale: 3.5,
      facing: Math.PI / 2, phase: this.t * 2.2, moving: 0.15,
    });
    ctx.restore();
    text(ctx, kin.codename, 426, top + 228, { font: FONT.display(24), color: '#fff', align: 'center' });
    text(ctx, `${kin.trueName} \u00b7 ${kin.species}`, 426, top + 246, {
      font: FONT.mono(11, 500), color: 'rgba(255,255,255,0.5)', align: 'center',
    });
    text(ctx, `${kin.subjects} subject${kin.subjects > 1 ? 's' : ''} \u00b7 ${kin.personality}`, 426, top + 264, {
      font: FONT.mono(11, 700), color: '#ff8ec8', align: 'center',
    });
    paragraph(ctx, kin.role, 296, top + 286, 260, {
      font: FONT.mono(11, 500), lh: 15, color: 'rgba(255,255,255,0.65)',
    });

    // stats
    panel(ctx, 276, top + 332, 300, 204);
    text(ctx, 'STATS', 296, top + 360, { font: FONT.mono(11, 800), color: 'rgba(255,255,255,0.45)' });
    STAT_KEYS.forEach(([key, label], i) => {
      statBar(ctx, label, kin.stats[key], 296, top + 374 + i * 19, 260);
    });

    // ---- scrolling body
    const bx = 600;
    const bw = w - bx - 32;
    panel(ctx, bx, top, bw, h - top - 32);
    ctx.save();
    ctx.beginPath();
    ctx.rect(bx + 2, top + 2, bw - 4, h - top - 36);
    ctx.clip();

    let y = top + 36 - this.scroll;
    const pad = bx + 28;
    const tw = bw - 56;

    y = section(ctx, 'WHY THEY EXIST', y, pad);
    y = paragraph(ctx, kin.why, pad, y, tw, { lh: 18 }) + 14;

    y = section(ctx, 'VOICE', y, pad);
    y = paragraph(ctx, kin.voice, pad, y, tw, { lh: 18 }) + 6;
    for (const line of kin.lines) {
      text(ctx, `“${line}”`, pad + 12, y + 12, {
        font: FONT.mono(12, 600), color: '#8ef7ff',
      });
      y += 22;
    }
    y += 10;

    y = section(ctx, 'PERSONALITY / STANCE', y, pad);
    y = paragraph(ctx, `${kin.personality} — ${kin.stance}`, pad, y, tw, { lh: 18 }) + 14;

    y = section(ctx, 'STARTER THREADS', y, pad);
    for (const th of kin.threads) {
      text(ctx, `${th.name}`, pad, y + 12, { font: FONT.mono(13, 800), color: '#ff8ec8' });
      text(ctx, th.fit, pad + ctx.measureText(th.name).width + 16, y + 12, {
        font: FONT.mono(11, 500), color: 'rgba(255,255,255,0.5)',
      });
      y += 22;
      y = paragraph(ctx, `Effect: ${th.ability.desc}`, pad + 12, y + 4, tw - 24, {
        lh: 16, font: FONT.mono(11, 500), color: 'rgba(233,230,242,0.75)',
      }) + 10;
    }

    y = section(ctx, 'HOW THEY PLAY', y, pad);
    y = paragraph(ctx, kin.play, pad, y, tw, { lh: 18 }) + 14;

    y = section(ctx, 'SHOT-BY-SHOT IMAGE BRIEF — 15 PLATES', y, pad);
    SHOT_LISTS[kin.id].forEach((shot, i) => {
      text(ctx, String(i + 1).padStart(2, '0'), pad, y + 12, {
        font: FONT.mono(11, 800), color: 'rgba(255,63,164,0.8)',
      });
      y = paragraph(ctx, shot, pad + 28, y + 12, tw - 28, {
        lh: 16, font: FONT.mono(11, 500), color: 'rgba(233,230,242,0.8)',
      }) + 4;
    });
    y += 10;

    y = section(ctx, 'PRODUCTION RULE', y, pad);
    for (const r of PRODUCTION_RULE) {
      text(ctx, `• ${r}`, pad, y + 12, { font: FONT.mono(11, 500), color: 'rgba(233,230,242,0.7)' });
      y += 18;
    }
    y += 12;
    y = section(ctx, 'DRIP LIBRARY', y, pad);
    y = paragraph(ctx, DRIP_LIBRARY.join(' · '), pad, y, tw, { lh: 16, font: FONT.mono(11, 500) }) + 12;
    y = section(ctx, 'CITY AND LIGHTING PLATES', y, pad);
    y = paragraph(ctx, CITY_PLATES.join(' · '), pad, y, tw, { lh: 16, font: FONT.mono(11, 500) }) + 20;

    this.bibleHeight = y + this.scroll - top;
    ctx.restore();

    const maxScroll = Math.max(0, this.bibleHeight - (h - top - 60));
    this.scroll = Math.min(this.scroll, maxScroll);
    if (maxScroll > 0) {
      const barH = Math.max(30, ((h - top - 40) * (h - top - 40)) / this.bibleHeight);
      const barY = top + 8 + (this.scroll / maxScroll) * (h - top - 56 - barH);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.roundRect(bx + bw - 10, barY, 4, barH, 2);
      ctx.fill();
    }
  }
}

function section(ctx, label, y, x) {
  text(ctx, label, x, y, { font: FONT.mono(11, 800), color: 'rgba(255,63,164,0.85)' });
  ctx.fillStyle = 'rgba(255,63,164,0.25)';
  ctx.fillRect(x, y + 6, 520, 1);
  return y + 22;
}

/**
 * INFILTRATION. The main verbs live here:
 *   walk in looking like you belong, rewrite the room's social physics,
 *   start or kill a micro-trend, swap drip mid-mission, extract before the
 *   city's taste police lock your identity.
 *
 * Combat is deliberately absent as a win condition. Heat is the clock.
 */

import { compilePacket, readDoor, mimicChance } from '../systems/thread.js';
import { getDistrict } from '../data/missions.js';
import { getKin } from '../data/kin.js';
import { drawKin, drawCivilian } from '../art/kinart.js';
import * as City from '../art/city.js';
import * as Vesta from '../art/vesta.js';
import { populate, samplePath } from '../world/lanes.js';
import { LANE } from '../world/units.js';
import { FONT, panel, text, meter, Log, tagChip } from '../core/ui.js';
import { RunwayScene } from './runway.js';
import { ResultsScene } from './results.js';

const TAU = Math.PI * 2;
const CIV_COLORS = ['#7b5ea7', '#3a6ea5', '#a0522d', '#4f7942', '#8b3a62', '#5f6caf'];
const CIV_HAIR = ['#2b2b33', '#4a2c1a', '#d9c7a1', '#1a1a20', '#6b3fa0'];
const CIV_SKIN = ['#f0c8a0', '#c9825c', '#8d5a3c', '#6b4230', '#e8b98f'];

export class MissionScene {
  constructor(opts) {
    this.mission = opts.mission;
    this.district = getDistrict(this.mission.district);
    this.crewSpec = opts.crew;
    this.saveState = opts.save;
    this.upgrades = opts.upgrades;
    this.onExit = opts.onExit;
  }

  enter(game) {
    const m = this.mission;
    this.game = game;
    this.t = 0;
    this.log = new Log(6);
    this.effects = [];
    this.heat = 0;
    this.style = 0;
    this.flags = 0;
    this.alerts = 0;
    this.alert = 0;
    this.copies = 0;
    this.taken = {};
    this.done = {};
    this.stolenPacket = null;
    this.compiling = null;
    this.failure = null;
    this.hint = m.tips[0];
    this.hintT = 0;
    this.timeLeft = m.timeLimit || null;
    this.shake = 0;

    // ---- crew
    this.crew = this.crewSpec.map((spec, i) => {
      const kin = getKin(spec.kinId);
      const thread = kin.threads.find((t) => t.id === spec.threadId) || kin.threads[0];
      return {
        kin,
        thread,
        packet: this.compile(kin, thread),
        x: m.spawn.x + i * 34,
        y: m.spawn.y + i * 10,
        vx: 0, vy: 0,
        facing: Math.PI / 2,
        phase: Math.random() * TAU,
        moving: 0,
        cooldown: 0,
        flagged: 0,
      };
    });
    this.active = 0;
    this.heatCap = 30 + (this.crew.reduce((s, c) => s + c.kin.stats.heatCap, 0) / this.crew.length) * 12;

    // ---- cameras
    this.cameras = m.cameras.map((c) => ({
      ...c,
      angle: (c.facing * Math.PI) / 180,
      base: (c.facing * Math.PI) / 180,
      scan: 0,
      seeing: null,
      phase: Math.random() * TAU,
    }));

    // ---- guards
    this.guards = m.guards.map((g) => ({
      ...g,
      x: g.path[0].x, y: g.path[0].y,
      node: 1, angle: 0, suspicion: 0, challenge: null,
    }));

    // ---- crowd. Lanes where the district has them, taste buckets either way.
    this.civs = [];
    this.laneDriven = Array.isArray(m.lanes) && m.lanes.length > 0;
    let seed = 1337;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    if (this.laneDriven) {
      // "Do not sprinkle NPCs. Build lanes." Everyone is on one.
      for (const slot of populate(m.lanes, m.crowdCount ?? 40, 4242)) {
        const ln = m.lanes[slot.laneIndex];
        const civ = {
          ...slot,
          lane: ln,
          x: 0, y: 0, hx: 0, hy: 0,
          phase: slot.seedR * TAU,
          color: CIV_COLORS[Math.floor(slot.seedR * 997) % CIV_COLORS.length],
          hair: CIV_HAIR[Math.floor(slot.seedR * 331) % CIV_HAIR.length],
          skin: CIV_SKIN[Math.floor(slot.seedR * 577) % CIV_SKIN.length],
          taste: ln.type === LANE.POSE ? 'copy' : slot.seedR < 0.35 ? 'copy' : slot.seedR < 0.55 ? 'loyal' : 'neutral',
          exposure: 0, copying: false, copyColor: '#ffd400',
        };
        const p0 = samplePath(ln, civ.dist);
        civ.x = p0.x; civ.y = p0.y;
        this.civs.push(civ);
      }
    }
    for (let i = 0; this.laneDriven ? false : i < m.crowd.count; i++) {
      const area = m.crowd.areas[i % m.crowd.areas.length];
      const civ = {
        x: area.x + rnd() * area.w,
        y: area.y + rnd() * area.h,
        hx: 0, hy: 0,
        phase: rnd() * TAU,
        speed: 18 + rnd() * 26,
        color: CIV_COLORS[Math.floor(rnd() * CIV_COLORS.length)],
        hair: CIV_HAIR[Math.floor(rnd() * CIV_HAIR.length)],
        skin: CIV_SKIN[Math.floor(rnd() * CIV_SKIN.length)],
        taste: rnd() < 0.35 ? 'copy' : rnd() < 0.55 ? 'loyal' : 'neutral',
        exposure: 0,
        copying: false,
        copyColor: '#ffd400',
        wanderT: rnd() * 3,
      };
      civ.hx = civ.x; civ.hy = civ.y;
      if (this.solid(civ.x, civ.y, 10)) { civ.x += 40; civ.hx = civ.x; }
      this.civs.push(civ);
    }

    this.vip = m.vip ? { ...m.vip, phase: 0, lifted: false } : null;
    this.decoys = [];
    this.rally = null;

    this.log.push(`> CONTRACT: ${m.name}`, '#ffd400');
    this.log.push(`> ${m.objectiveText}`, '#8ef7ff');
  }

  compile(kin, thread) {
    const p = compilePacket(kin, thread, {
      district: this.district,
      licenses: this.upgrades.licenses,
      overlays: this.upgrades.overlays,
    });
    p.compileTime *= this.upgrades.compileMul;
    return p;
  }

  get me() { return this.crew[this.active]; }

  /* ------------------------------------------------------------ geometry */

  solid(x, y, r) {
    for (const w of this.mission.walls) {
      if (x + r > w.x && x - r < w.x + w.w && y + r > w.y && y - r < w.y + w.h) return w;
    }
    return null;
  }

  resolve(a, r) {
    for (let pass = 0; pass < 2; pass++) {
      const w = this.solid(a.x, a.y, r);
      if (!w) break;
      const dx = a.x - (w.x + w.w / 2);
      const dy = a.y - (w.y + w.h / 2);
      const ox = w.w / 2 + r - Math.abs(dx);
      const oy = w.h / 2 + r - Math.abs(dy);
      if (ox < oy) { a.x += Math.sign(dx || 1) * ox; a.vx = 0; }
      else { a.y += Math.sign(dy || 1) * oy; a.vy = 0; }
    }
  }

  clearLine(x0, y0, x1, y1) {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(2, Math.ceil(dist / 22));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.solid(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 1)) return false;
    }
    return true;
  }

  zoneAt(x, y) {
    // later zones win: the specific room sits on top of the district floor
    let found = null;
    for (const z of this.mission.zones) {
      const r = z.rect;
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) found = z;
    }
    return found;
  }

  /* ------------------------------------------------------------- effects */

  fire(id, data = {}, dur = 0) {
    this.effects.push({ id, t: 0, dur, data });
  }

  has(id) { return this.effects.some((e) => e.id === id); }

  /* -------------------------------------------------------------- update */

  update(dt, game) {
    if (this.failure || this.finished) return;
    this.t += dt;
    this.hintT += dt;
    this.log.update(dt);
    this.shake = Math.max(0, this.shake - dt * 3);

    const input = game.input;
    if (input.justPressed('pause')) {
      this.abort('aborted the run');
      return;
    }

    // rotate the tip line so the tutorial teaches without a wall of text
    if (this.hintT > 9) {
      this.hintT = 0;
      const tips = this.mission.tips;
      this.hint = tips[(tips.indexOf(this.hint) + 1) % tips.length];
    }

    this.updateEffects(dt);
    this.updateCrew(dt, input);
    this.updateScanStrips(dt);
    this.updateCameras(dt);
    this.updateGuards(dt);
    this.updateCrowd(dt);
    this.updateObjectives(dt, input);

    // Heat decays when nobody is filling a bar on you. The city forgets, slowly.
    const watched = this.cameras.some((c) => c.seeing) || this.guards.some((g) => g.suspicion > 2);
    if (!watched) this.heat = Math.max(0, this.heat - dt * 2.4);

    if (this.timeLeft !== null) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) this.fail('the window closed', 'timeout');
    }
    if (this.heat >= this.heatCap) this.fail('OVEREXPOSED — the district locked your identity', 'overexposed');
  }

  /**
   * Identity gates. Floor strips of frosted glass that bloom a scan-line: they
   * read the packet outright, with no cone to slip and no angle to dodge. Spark
   * gets scanned the second they step onto the glass.
   */
  updateScanStrips(dt) {
    this.stripCooldown = Math.max(0, (this.stripCooldown || 0) - dt);
    const strips = this.mission.scanStrips || [];
    if (!strips.length) return;
    for (const c of this.crew) {
      const on = strips.find((s) => c.x > s.x && c.x < s.x + s.w && c.y > s.y && c.y < s.y + s.h);
      if (!on) { c.onStrip = null; continue; }
      if (c.onStrip === on) continue;
      c.onStrip = on;
      if (this.stripCooldown > 0) continue;
      this.stripCooldown = 1.2;

      const zone = this.zoneAt(c.x, c.y);
      const verdict = zone ? readDoor(this.accessPacket(c), zone) : { open: true };
      if (verdict.open) {
        const fame = 1.5 + this.accessPacket(c).desirability * 0.15;
        this.raiseHeat(fame);
        this.log.push(`> ${on.label}: ${c.kin.codename} reads clean`, 'rgba(142,247,255,0.85)');
      } else {
        this.flags += 1;
        this.raiseHeat(10);
        this.alert = Math.min(3, this.alert + 1);
        this.shake = 1;
        this.log.push(`> ${on.label} FLAGGED \u2014 ${verdict.reason}`, '#ff4a72');
      }
    }
  }

  updateEffects(dt) {
    for (const e of this.effects) e.t += dt;
    this.effects = this.effects.filter((e) => e.t < e.dur);
    this.decoys = this.decoys.filter((d) => (d.t += dt) < d.dur);
    if (this.rally && (this.rally.t += dt) > this.rally.dur) this.rally = null;
  }

  updateCrew(dt, input) {
    // swap active Kin
    for (let i = 0; i < 4; i++) {
      if (input.justPressed(`kin${i + 1}`) && this.crew[i]) {
        this.active = i;
        this.log.push(`> switched to ${this.crew[i].kin.codename}`, '#8ef7ff');
      }
    }

    const me = this.me;
    const ax = input.axis();
    const blending = input.isDown('blend');
    const baseSpeed = 92 + me.kin.stats.mobility * 7;
    let speed = baseSpeed * me.packet.moveMul * (blending ? 0.5 : 1);
    if (this.has('hotwired') || this.has('belted')) speed *= 1.25;

    // dash
    me.cooldown = Math.max(0, me.cooldown - dt);
    if (input.justPressed('dash') && me.dash === undefined && ax.len > 0 && me.cooldown <= 0) {
      me.dash = 0.22;
      me.cooldown = 0.9;
      me.dashDir = { x: ax.x, y: ax.y };
      if (this.has('hoodprotocol')) {
        this.effects = this.effects.filter((e) => e.id !== 'hoodprotocol');
        this.log.push('> hood protocol broke — you sprinted', '#ff4a72');
      }
      if (this.compiling) this.cancelCompile('you moved too fast');
    }
    if (me.dash !== undefined) {
      me.dash -= dt;
      speed = baseSpeed * 3.4;
      if (me.dash <= 0) me.dash = undefined;
    }

    const dir = me.dash !== undefined ? me.dashDir : ax;
    me.vx = dir.x * speed;
    me.vy = dir.y * speed;
    me.x += me.vx * dt;
    me.y += me.vy * dt;
    this.resolve(me, 13);
    me.x = Math.max(28, Math.min(this.mission.world.w - 28, me.x));
    me.y = Math.max(28, Math.min(this.mission.world.h - 28, me.y));

    const spd = Math.hypot(me.vx, me.vy);
    me.moving = Math.min(1, spd / 140);
    me.phase += dt * (4 + me.moving * 9);
    if (spd > 4) me.facing = Math.atan2(me.vy, me.vx);
    me.blending = blending;
    me.dashing = me.dash !== undefined;

    // crew follows in a loose file. Bond decides how tight.
    this.crew.forEach((c, i) => {
      if (i === this.active) return;
      const slot = i < this.active ? i : i - 1;
      const tx = me.x - Math.cos(me.facing) * (46 + slot * 34);
      const ty = me.y - Math.sin(me.facing) * (46 + slot * 34);
      const d = Math.hypot(tx - c.x, ty - c.y);
      const follow = Math.min(1, d / 60) * (60 + c.kin.stats.bond * 9);
      if (d > 6) {
        c.vx = ((tx - c.x) / d) * follow;
        c.vy = ((ty - c.y) / d) * follow;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        this.resolve(c, 12);
        c.facing = Math.atan2(c.vy, c.vx);
      }
      c.moving = Math.min(1, Math.hypot(c.vx, c.vy) / 140);
      c.phase += dt * (4 + c.moving * 9);
      c.vx *= 0.9; c.vy *= 0.9;
    });

    // ---- compile a new Thread
    ['threadA', 'threadB', 'threadC'].forEach((key, idx) => {
      if (!input.justPressed(key)) return;
      const next = me.kin.threads[idx];
      if (!next || next.id === me.thread.id) return;
      this.compiling = { idx, t: 0, dur: me.packet.compileTime, kinIdx: this.active };
      this.log.push(`> compiling ${next.name}…`, '#8ef7ff');
    });
    if (this.compiling) {
      if (this.compiling.kinIdx !== this.active) this.cancelCompile('you swapped Kin');
      else {
        this.compiling.t += dt;
        if (this.compiling.t >= this.compiling.dur) {
          const next = me.kin.threads[this.compiling.idx];
          me.thread = next;
          me.packet = this.compile(me.kin, next);
          this.compiling = null;
          this.log.push(`> ${me.kin.codename} is wearing ${next.name}`, '#3ddc97');
          if (this.has('afterimage')) this.spawnDecoy(me);
          if (me.packet.clash) {
            this.log.push(`> CLASH: ${me.packet.clash} — THREAD tripped`, '#ff4a72');
            this.raiseHeat(18);
            this.alert = Math.min(3, this.alert + 1);
          }
        }
      }
    }

    // ---- ability
    if (input.justPressed('ability') && me.cooldown <= 0) this.useAbility(me);

    // ---- style break: a perfect dodge against a camera mid-lock
    if (input.justPressed('styleBreak')) this.styleBreak(me);

    // ---- mark
    if (input.justPressed('mark')) {
      const g = this.nearest(this.guards, me.x, me.y, 340);
      if (g) {
        g.marked = 6;
        this.log.push('> marked. crew reads their patrol now', '#ffd400');
      }
    }
    for (const g of this.guards) if (g.marked) g.marked -= dt;
  }

  cancelCompile(why) {
    if (!this.compiling) return;
    this.compiling = null;
    this.log.push(`> compile cancelled — ${why}`, '#ff4a72');
  }

  spawnDecoy(me) {
    this.decoys.push({
      kin: me.kin, thread: me.thread, x: me.x, y: me.y,
      vx: Math.cos(me.facing) * 70, vy: Math.sin(me.facing) * 70,
      facing: me.facing, phase: 0, t: 0, dur: 5,
    });
    this.log.push('> afterimage walking. presence 10, no brain.', '#b98cff');
  }

  useAbility(me) {
    const ab = me.thread.ability;
    me.cooldown = ab.cooldown;
    this.fire(ab.id, { owner: this.active }, ab.duration);
    this.log.push(`> ${me.kin.codename}: ${ab.name}`, '#ff3fa4');

    switch (ab.id) {
      case 'matchhead': {
        for (const c of this.cameras) {
          if (Math.hypot(c.x - me.x, c.y - me.y) < 420) c.lockedTo = this.active;
        }
        this.raiseHeat(6);
        this.style += 12;
        break;
      }
      case 'letterbomb':
        this.rally = { x: me.x, y: me.y, t: 0, dur: ab.duration };
        break;
      case 'toomuch':
        this.raiseHeat(8);
        this.style += 18;
        break;
      case 'pleasedont': {
        const cam = this.nearest(this.cameras, me.x, me.y, 420);
        if (cam) { cam.scan = Math.max(0, cam.scan - 70); cam.seeing = null; }
        break;
      }
      case 'glasscoat': {
        const target = this.nearest(this.guards, me.x, me.y, 380)
          || this.nearest(this.civs, me.x, me.y, 260);
        if (target) {
          this.log.push('> packet copied. the door knows the jacket.', '#8ef7ff');
        } else {
          this.log.push('> nobody close enough to copy', '#ff4a72');
        }
        break;
      }
      case 'afterimage':
        this.spawnDecoy(me);
        break;
      case 'sequinedfault':
        this.log.push('> THREAD filed you as an event, not a person', '#ffd400');
        break;
      case 'olddoor': {
        const z = this.zoneAt(me.x, me.y);
        this.log.push(z ? '> old door listening' : '> nothing old here', '#ffd400');
        break;
      }
      case 'hotwired':
        this.log.push('> that car is crew now', '#ffd400');
        break;
      default:
        break;
    }
  }

  styleBreak(me) {
    const cam = this.cameras.find((c) => c.seeing === this.active && c.scan > 12);
    if (cam) {
      cam.scan = 0;
      cam.seeing = null;
      cam.stunned = 2.5;
      this.style += 25;
      this.raiseHeat(4);
      this.shake = 1;
      this.log.push('> STYLE BREAK — you walked out of the lock', '#3ddc97');
    } else {
      this.style = Math.max(0, this.style - 3);
      this.log.push('> style break on nothing. that is just posing.', 'rgba(255,255,255,0.45)');
    }
  }

  nearest(list, x, y, max) {
    let best = null;
    let bd = max;
    for (const o of list) {
      const d = Math.hypot(o.x - x, o.y - y);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  raiseHeat(n) {
    // Too Much doubles Heat through its thread mod, so the burst must not stack.
    this.heat = Math.min(this.heatCap + 1, this.heat + n * this.me.packet.heatMul);
  }

  /* ------------------------------------------------------------- cameras */

  updateCameras(dt) {
    const speedUp = 1 + this.alert * 0.35;
    for (const cam of this.cameras) {
      if (cam.stunned > 0) {
        cam.stunned -= dt;
        cam.scan = Math.max(0, cam.scan - dt * 60);
        continue;
      }
      cam.phase += dt * cam.speed * speedUp;
      cam.angle = cam.base + (Math.sin(cam.phase) * cam.sweep * Math.PI) / 180;

      const targets = [];
      this.crew.forEach((c, i) => targets.push({ actor: c, idx: i, decoy: false }));
      for (const d of this.decoys) targets.push({ actor: d, idx: -1, decoy: true });

      let best = null;
      for (const t of targets) {
        const a = t.actor;
        const dist = Math.hypot(a.x - cam.x, a.y - cam.y);
        if (dist > cam.range) continue;
        let ang = Math.atan2(a.y - cam.y, a.x - cam.x) - cam.angle;
        while (ang > Math.PI) ang -= TAU;
        while (ang < -Math.PI) ang += TAU;
        const half = ((cam.arc * (this.has('fisheye') ? 0.55 : 1)) * Math.PI) / 180 / 2;
        if (Math.abs(ang) > half) continue;
        if (!this.clearLine(cam.x, cam.y, a.x, a.y)) continue;

        const rate = t.decoy ? 2.4 : this.scanRateFor(t.actor, t.idx);
        if (rate <= 0) continue;
        if (cam.lockedTo !== undefined && cam.lockedTo !== t.idx && !t.decoy) continue;
        if (!best || rate > best.rate) best = { ...t, rate };
      }

      if (best) {
        cam.seeing = best.decoy ? 'decoy' : best.idx;
        cam.scan += best.rate * 26 * dt;
        if (cam.scan >= 100) {
          cam.scan = 35;
          this.resolveScan(best);
        }
      } else {
        cam.seeing = null;
        cam.scan = Math.max(0, cam.scan - dt * 22);
        if (cam.lockedTo !== undefined && !this.has('matchhead')) cam.lockedTo = undefined;
      }
    }
  }

  /**
   * A completed scan is not automatically a problem. THREAD reads the packet
   * against the room it caught you in: a packet the room accepts gets filed as
   * "invited" and only costs you a little fame. A packet it does not gets you
   * flagged. This is the whole premise as a rule -- walk in looking like you
   * belong and the cameras are a formality.
   */
  resolveScan(hit) {
    if (hit.decoy) {
      this.log.push('> a camera locked the clone. it has no packet to read.', '#b98cff');
      return;
    }
    const actor = this.crew[hit.idx];
    const zone = this.zoneAt(actor.x, actor.y);
    const verdict = zone ? readDoor(this.accessPacket(actor), zone) : { open: true };

    if (verdict.open) {
      // Being looked at is the job. Being memorable is the cost.
      const fame = 2 + this.accessPacket(actor).desirability * 0.2;
      this.raiseHeat(fame);
      this.log.push(`> scanned \u2014 THREAD filed ${actor.kin.codename} as invited`, 'rgba(142,247,255,0.8)');
      return;
    }

    this.flags += 1;
    this.raiseHeat(this.has('sequinedfault') ? 4 : 12);
    this.alert = Math.min(3, this.alert + (this.has('sequinedfault') ? 0 : 1));
    this.shake = 1;
    this.log.push(`> FLAGGED: ${actor.kin.codename} \u2014 ${verdict.reason}`, '#ff4a72');
  }

  /** A volume where THREAD cannot hold a lock -- a hoodie tunnel, so far. */
  inBlind(actor) {
    for (const b of this.mission.blinds || []) {
      if (actor.x > b.x && actor.x < b.x + b.w && actor.y > b.y && actor.y < b.y + b.h) return b;
    }
    return null;
  }

  /** How fast this actor fills a scan bar right now. The whole stealth game. */
  scanRateFor(actor, idx) {
    if (idx < 0) return 2.4;
    // Rack so dense it becomes a corridor. Cameras lose lock inside.
    if (this.inBlind(actor)) return 0;
    let rate = actor.packet.scanRate;

    if (idx === this.active) {
      if (actor.dashing) rate *= 1.7;
      else if (actor.blending) rate *= 0.5;
      else if (actor.moving < 0.05) rate *= 0.7;
    } else {
      rate *= 0.8; // followers keep their heads down without being told
    }

    if (this.has('hoodprotocol') && this.effects.find((e) => e.id === 'hoodprotocol').data.owner === idx) return 0;
    if (this.has('onename') && idx !== this.active) return 0;
    if (this.has('badtwin') && idx !== this.active) rate *= 0.3;
    if (this.has('matchhead') && idx !== this.active) rate *= 0.35;
    if (this.has('pleasedont') && actor.moving < 0.05) rate *= 0.2;

    // crowd cover: three civilians close by and the city loses the thread
    let near = 0;
    for (const c of this.civs) {
      if (Math.abs(c.x - actor.x) < 90 && Math.abs(c.y - actor.y) < 90) near++;
      if (near >= 3) break;
    }
    if (near >= 3) rate *= this.has('beadwork') ? 0.25 : 0.55;

    return rate;
  }

  /* -------------------------------------------------------------- guards */

  updateGuards(dt) {
    const alertSpeed = 1 + this.alert * 0.2;
    for (const g of this.guards) {
      const target = g.path[g.node];
      const d = Math.hypot(target.x - g.x, target.y - g.y);
      if (d < 8) {
        g.node = (g.node + 1) % g.path.length;
      } else {
        g.x += ((target.x - g.x) / d) * g.speed * alertSpeed * dt;
        g.y += ((target.y - g.y) / d) * g.speed * alertSpeed * dt;
        g.angle = Math.atan2(target.y - g.y, target.x - g.x);
      }

      // Guards do not look for intruders. They read packets against the room.
      let offending = null;
      this.crew.forEach((c, i) => {
        const dist = Math.hypot(c.x - g.x, c.y - g.y);
        if (dist > g.sees) return;
        let ang = Math.atan2(c.y - g.y, c.x - g.x) - g.angle;
        while (ang > Math.PI) ang -= TAU;
        while (ang < -Math.PI) ang += TAU;
        if (Math.abs(ang) > 0.85) return;
        if (!this.clearLine(g.x, g.y, c.x, c.y)) return;
        if (this.has('hoodprotocol') && this.effects.find((e) => e.id === 'hoodprotocol').data.owner === i) return;

        const zone = this.zoneAt(c.x, c.y);
        if (!zone) return;
        const verdict = readDoor(this.accessPacket(c), zone);
        if (!verdict.open) offending = { c, zone, verdict, dist };
      });

      if (offending && !this.has('sequinedfault')) {
        const slow = (this.has('angrycute') ? 0.35 : 1) * (offending.c === this.me ? 1 : 0.5);
        g.suspicion += dt * 34 * slow * (1 - offending.c.packet.ignore / 16);
        g.challenge = `${offending.c.kin.codename}: ${offending.verdict.reason}`;
        if (g.suspicion >= 100) {
          g.suspicion = 45;
          this.alerts += 1;
          this.alert = Math.min(3, this.alert + 1);
          this.raiseHeat(18);
          this.shake = 1.4;
          this.log.push(`> CHALLENGED — ${offending.verdict.reason}`, '#ff4a72');
        }
      } else {
        g.suspicion = Math.max(0, g.suspicion - dt * 26);
        if (g.suspicion <= 0) g.challenge = null;
      }
    }
  }

  /** The packet a door actually reads, after live effects rewrite it. */
  accessPacket(actor) {
    const p = actor.packet;
    let access = p.access;
    if (actor.borrowed) {
      access += actor.borrowed.access;
    }
    if (this.has('glasscoat')) access += 2;
    if (this.has('olddoor')) access += 2;
    if (this.stolenPacket) access = Math.max(access, 3);
    let desirability = p.desirability;
    if (this.has('toomuch')) desirability += 6;
    let tags = p.tags;
    if (this.has('glasscoat')) tags = [...tags, 'luxury', 'holo'];
    if (this.has('olddoor')) tags = [...tags, 'folk'];
    if (this.stolenPacket) tags = [...tags, ...this.stolenPacket.tags];
    if (actor.borrowed) {
      tags = [...tags, ...actor.borrowed.tags];
      desirability += 2;
    }
    return { ...p, access, desirability, tags };
  }

  /* --------------------------------------------------------------- crowd */

  updateCrowd(dt) {
    const me = this.me;
    const packet = me.packet;
    for (const c of this.civs) {
      c.phase += dt * 3;

      if (c.lane) {
        // Pose lanes hold still and check themselves. Everything else circulates.
        if (c.lane.type === LANE.POSE) {
          c.poseT += dt;
          c.dist += Math.sin(c.poseT * 0.7) * 6 * dt;
        } else {
          c.dist += c.speed * c.dir * dt;
        }
        const p = samplePath(c.lane, c.dist);
        const nx = -Math.sin(p.angle);
        const ny = Math.cos(p.angle);
        c.x = p.x + nx * c.offset;
        c.y = p.y + ny * c.offset;
        this.mimicPass(c, me, packet, dt);
        continue;
      }

      c.wanderT -= dt;

      let tx = c.hx;
      let ty = c.hy;
      if (this.rally) { tx = this.rally.x; ty = this.rally.y; }
      else if (this.has('beadwork') && Math.hypot(me.x - c.x, me.y - c.y) < 240) { tx = me.x; ty = me.y; }
      else if (c.wanderT <= 0) {
        c.wanderT = 2 + Math.random() * 3;
        c.hx += (Math.random() - 0.5) * 120;
        c.hy += (Math.random() - 0.5) * 120;
      }

      const d = Math.hypot(tx - c.x, ty - c.y);
      if (d > 14) {
        const nx = c.x + ((tx - c.x) / d) * c.speed * dt;
        const ny = c.y + ((ty - c.y) / d) * c.speed * dt;
        if (!this.solid(nx, ny, 10)) { c.x = nx; c.y = ny; }
        else { c.hx = c.x; c.hy = c.y; c.wanderT = 0.4; }
      }

      this.mimicPass(c, me, packet, dt);
    }

    if (this.vip) {
      this.vip.phase += dt;
      this.vip.x = this.mission.vip.x + Math.sin(this.vip.phase * 0.4) * 60;
    }

    for (const d of this.decoys) {
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.phase += dt * 8;
      this.resolve(d, 12);
    }
  }

  /** They copy the accessory, never the face. */
  mimicPass(c, me, packet, dt) {
    const dist = Math.hypot(me.x - c.x, me.y - c.y);
    if (c.copying || dist >= 190) return;
    if (!this.clearLine(me.x, me.y, c.x, c.y)) return;
    c.exposure += dt * (1 - dist / 190);
    if (c.exposure > 1.2 && Math.random() < mimicChance(packet, c) * dt * 1.2) {
      c.copying = true;
      c.copyColor = me.kin.palette.accent;
      this.copies += 1;
      this.style += 3;
    }
  }

  /* ---------------------------------------------------------- objectives */

  updateObjectives(dt, input) {
    const m = this.mission;
    const me = this.me;
    this.prompt = null;

    for (const o of m.objectives) {
      if (this.done[o.id]) continue;
      if (o.kind === 'enter-zone') {
        const z = this.zoneAt(me.x, me.y);
        if (z && z.id === o.zone) {
          const verdict = readDoor(this.accessPacket(me), z);
          if (verdict.open) this.complete(o, `you are on the ${z.name.toLowerCase()}`);
        }
      } else if (o.kind === 'prop') {
        const p = m.props.find((pp) => pp.id === o.prop);
        if (p && Math.hypot(p.x - me.x, p.y - me.y) < 60) {
          this.prompt = `E — take ${p.label}`;
          if (input.justPressed('interact')) {
            this.taken[p.id] = true;
            this.complete(o, `${p.label} is yours`);
            this.raiseHeat(10);
            this.alert = Math.min(3, this.alert + 1);
          }
        }
      } else if (o.kind === 'vip' && this.vip) {
        const d = Math.hypot(this.vip.x - me.x, this.vip.y - me.y);
        if (d < 70) {
          this.prompt = `E — lift ${this.vip.label}’s packet`;
          if (input.justPressed('interact')) {
            this.vip.lifted = true;
            this.stolenPacket = { tags: ['luxury', 'holo'], t: 0 };
            this.complete(o, 'packet lifted. ninety seconds, maybe.');
            this.raiseHeat(12);
          }
        }
      } else if (o.kind === 'mimic') {
        if (this.copies >= o.count) this.complete(o, `${this.copies} civilians are wearing it`);
      }
    }

    // stolen packets are loud while you hold them
    if (this.stolenPacket) {
      this.stolenPacket.t += dt;
      this.heat = Math.min(this.heatCap + 1, this.heat + dt * 1.6);
    }

    // Racks are keys. A rack with stock lends you the floor's own read; a plain
    // rack is just somewhere safe to change.
    for (const p of m.props) {
      if (p.kind !== 'rack') continue;
      if (Math.hypot(p.x - me.x, p.y - me.y) >= 58) continue;
      this.prompt = this.prompt
        || (p.grants ? `E \u2014 pull a piece off the ${p.label.toLowerCase()}` : 'E \u2014 restyle (free compile)');
      if (!input.justPressed('interact')) continue;
      if (p.grants) {
        me.borrowed = { ...p.grants, t: 0 };
        this.log.push(`> wearing the floor's own stock: ${p.grants.tags.join(' + ')}`, '#3ddc97');
        this.style += 15;
      } else {
        const idx = (me.kin.threads.indexOf(me.thread) + 1) % me.kin.threads.length;
        me.thread = me.kin.threads[idx];
        me.packet = this.compile(me.kin, me.thread);
        this.log.push(`> restyled: ${me.thread.name}`, '#3ddc97');
      }
    }

    // borrowed pieces are on loan, and the loan runs out
    for (const c of this.crew) {
      if (!c.borrowed) continue;
      c.borrowed.t += dt;
      if (c.borrowed.t >= c.borrowed.duration) {
        c.borrowed = null;
        if (c === me) this.log.push('> the borrowed piece stopped reading', '#ff9a3c');
      }
    }

    const outstanding = m.objectives.filter((o) => o.kind !== 'extract' && !this.done[o.id]);
    this.armed = outstanding.length === 0;
    const r = m.extraction;
    if (this.armed && me.x > r.x && me.x < r.x + r.w && me.y > r.y && me.y < r.y + r.h) {
      this.finishToRunway();
    }
  }

  complete(o, why) {
    this.done[o.id] = true;
    this.log.push(`✓ ${o.text} — ${why}`, '#3ddc97');
    this.style += 20;
  }

  finishToRunway() {
    this.finished = true;
    this.game.setScene(new RunwayScene({
      mission: this.mission,
      district: this.district,
      crew: this.crew,
      run: {
        heat: this.heat,
        heatCap: this.heatCap,
        style: this.style,
        flags: this.flags,
        alerts: this.alerts,
        copies: this.copies,
        time: this.t,
      },
      save: this.saveState,
      upgrades: this.upgrades,
      onExit: this.onExit,
    }));
  }

  fail(reason, code) {
    if (this.failure) return;
    this.failure = { reason, code };
    this.game.setScene(new ResultsScene({
      mission: this.mission,
      district: this.district,
      crew: this.crew,
      outcome: { success: false, reason, code, style: this.style, heat: this.heat, flags: this.flags, copies: this.copies, time: this.t },
      save: this.saveState,
      onExit: this.onExit,
    }));
  }

  abort(reason) { this.fail(reason, 'abort'); }

  /* ---------------------------------------------------------------- draw */

  draw(ctx, game) {
    const { w, h } = game;
    const m = this.mission;
    const me = this.me;
    ctx.fillStyle = '#07040d';
    ctx.fillRect(0, 0, w, h);

    const zoom = 1.85;
    const camX = Math.max(0, Math.min(m.world.w - w / zoom, me.x - w / zoom / 2));
    const camY = Math.max(0, Math.min(m.world.h - h / zoom, me.y - h / zoom / 2));

    const vesta = Array.isArray(m.terraces) && m.terraces.length > 0;

    // The skyline is a backdrop, not world geometry: the camera clamps to the
    // world box, so a district on the far side of the basin has to be drawn in
    // screen space with parallax or it is never visible at all.
    if (vesta) this.drawBackdrop(ctx, game, camX, camY);

    ctx.save();
    if (this.shake > 0) {
      ctx.translate((Math.random() - 0.5) * this.shake * 9, (Math.random() - 0.5) * this.shake * 9);
    }
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);

    if (vesta) {
      Vesta.drawGround(ctx, m, this.t);
      for (const wl of m.walls) if (wl.kind === 'water') Vesta.drawWater(ctx, wl, this.t);
      Vesta.drawDecor(ctx, m, this.t, 'ground');
      Vesta.drawBounce(ctx, m, this.t);
    } else {
      City.drawGround(ctx, m, this.district, null, this.t);
    }
    City.drawZones(ctx, m, this.accessPacket(me), this.t);
    if (!vesta) City.drawSignage(ctx, m, this.district, this.t);

    if (this.rally) {
      const a = 1 - this.rally.t / this.rally.dur;
      ctx.strokeStyle = `rgba(255,212,0,${a})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(this.rally.x, this.rally.y, 40 + (1 - a) * 60, 16 + (1 - a) * 24, 0, 0, TAU);
      ctx.stroke();
    }

    for (const st of m.stalls || []) Vesta.drawStall(ctx, st, this.t);
    for (const p of m.props) {
      if (p.kind === 'prop') Vesta.drawProp(ctx, p, this.t);
      else City.drawProp(ctx, p, this.t, this.taken[p.id]);
    }
    City.drawExtraction(ctx, m.extraction, this.t, this.armed);

    for (const c of this.civs) drawCivilian(ctx, c, 1);

    if (this.vip && !this.vip.lifted) {
      ctx.save();
      ctx.translate(this.vip.x, this.vip.y);
      ctx.fillStyle = 'rgba(255,212,0,0.18)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 42, 42, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
      drawCivilian(ctx, { x: this.vip.x, y: this.vip.y, phase: this.t * 2, color: '#d4af37', hair: '#1a1a20', skin: '#e8b98f' }, 1.25);
      text(ctx, this.vip.label, this.vip.x, this.vip.y - 52, {
        font: FONT.mono(12, 700), color: '#ffd400', align: 'center',
      });
    }

    City.drawWalls(ctx, m, this.district);
    if (vesta) Vesta.drawDecor(ctx, m, this.t, 'upright');

    for (const g of this.guards) City.drawGuard(ctx, g, this.t);
    for (const cam of this.cameras) {
      City.drawCameraCone(ctx, cam, this.alert > 1 ? '#ff9a3c' : '#8ef7ff', cam.seeing !== null && cam.seeing !== undefined);
      if (cam.scan > 1) {
        const bw = 44;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(cam.x - bw / 2, cam.y - 22, bw, 5);
        ctx.fillStyle = cam.scan > 70 ? '#ff4a72' : '#ffd400';
        ctx.fillRect(cam.x - bw / 2, cam.y - 22, (bw * cam.scan) / 100, 5);
      }
    }

    for (const d of this.decoys) {
      drawKin(ctx, { kin: d.kin, thread: d.thread, x: d.x, y: d.y, scale: 1.7, facing: d.facing, phase: d.phase, moving: 1, ghost: true });
    }

    // crew drawn back-to-front so the active Kin is never hidden
    const order = this.crew.map((c, i) => ({ c, i })).sort((a, b) => a.c.y - b.c.y);
    for (const { c, i } of order) {
      const hidden = this.inBlind(c);
      drawKin(ctx, {
        kin: c.kin, thread: c.thread, x: c.x, y: c.y, scale: 1.75,
        facing: c.facing, phase: c.phase, moving: c.moving,
        alpha: hidden ? 0.55 : 1,
        expression: i === this.active ? undefined : 'neutral',
        flagged: this.cameras.some((cam) => cam.seeing === i),
      });
      if (i === this.active) {
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(c.x, c.y + 4, 19, 6.5, 0, 0, TAU);
        ctx.stroke();
      }
    }

    // wires and steam sit over everyone
    if (vesta) Vesta.drawDecor(ctx, m, this.t, 'over');

    ctx.restore();
    this.drawHUD(ctx, game);
  }

  /**
   * Minimap. The camera is tight so the silhouettes read, which means the
   * player needs somewhere to hold the floor plan. Zones first, then the
   * things you are steering toward.
   */
  drawMinimap(ctx, game) {
    const { w } = game;
    const m = this.mission;
    const mw = 214;
    const mh = (mw * m.world.h) / m.world.w;
    const mx = w - mw - 16;
    const my = 120;
    const sx = mw / m.world.w;
    const sy = mh / m.world.h;

    panel(ctx, mx - 6, my - 6, mw + 12, mh + 12, { fill: 'rgba(7,4,13,0.9)' });
    ctx.save();
    ctx.beginPath();
    ctx.rect(mx, my, mw, mh);
    ctx.clip();
    ctx.translate(mx, my);

    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(0, 0, mw, mh);
    for (const z of m.zones) {
      const open = this.accessPacket(this.me).access >= z.access;
      ctx.fillStyle = z.access === 0 ? 'rgba(255,255,255,0.05)'
        : open ? 'rgba(61,220,151,0.22)' : 'rgba(255,80,120,0.2)';
      ctx.fillRect(z.rect.x * sx, z.rect.y * sy, z.rect.w * sx, z.rect.h * sy);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    for (const wl of m.walls) ctx.fillRect(wl.x * sx, wl.y * sy, Math.max(1, wl.w * sx), Math.max(1, wl.h * sy));

    const r = m.extraction;
    ctx.fillStyle = this.armed ? '#3ddc97' : 'rgba(255,255,255,0.3)';
    ctx.fillRect(r.x * sx, r.y * sy, r.w * sx, r.h * sy);

    for (const p of m.props) {
      if (p.kind !== 'objective' || this.taken[p.id]) continue;
      ctx.fillStyle = '#ffd400';
      ctx.beginPath();
      ctx.ellipse(p.x * sx, p.y * sy, 3.5, 3.5, 0, 0, TAU);
      ctx.fill();
    }
    if (this.vip && !this.vip.lifted) {
      ctx.fillStyle = '#ffd400';
      ctx.beginPath();
      ctx.ellipse(this.vip.x * sx, this.vip.y * sy, 3.5, 3.5, 0, 0, TAU);
      ctx.fill();
    }
    for (const g of this.guards) {
      ctx.fillStyle = g.suspicion > 4 ? '#ff9a3c' : 'rgba(120,180,255,0.8)';
      ctx.beginPath();
      ctx.ellipse(g.x * sx, g.y * sy, 2.6, 2.6, 0, 0, TAU);
      ctx.fill();
    }
    for (const cam of this.cameras) {
      ctx.fillStyle = cam.seeing !== null && cam.seeing !== undefined ? '#ff4a72' : 'rgba(142,247,255,0.7)';
      ctx.fillRect(cam.x * sx - 1.5, cam.y * sy - 1.5, 3, 3);
    }
    this.crew.forEach((c, i) => {
      ctx.fillStyle = i === this.active ? '#fff' : 'rgba(255,63,164,0.8)';
      ctx.beginPath();
      ctx.ellipse(c.x * sx, c.y * sy, i === this.active ? 3.4 : 2.4, i === this.active ? 3.4 : 2.4, 0, 0, TAU);
      ctx.fill();
    });
    ctx.restore();
  }

  /**
   * Sky and distant districts. Bruised violet, no stars, low wet cloud.
   * Parallaxed so the Spire drifts against the terrace as you walk.
   */
  drawBackdrop(ctx, game, camX, camY) {
    const { w, h } = game;
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.7);
    sky.addColorStop(0, '#2a1140');
    sky.addColorStop(0.55, '#1d0f33');
    sky.addColorStop(1, '#150b26');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // holographic weather, like spilled highlighter
    for (let i = 0; i < 3; i++) {
      const hx = ((this.t * (6 + i * 4)) % (w + 400)) - 200;
      const g = ctx.createRadialGradient(hx, 60 + i * 34, 10, hx, 60 + i * 34, 220);
      g.addColorStop(0, ['rgba(201,255,74,0.07)', 'rgba(255,63,164,0.07)', 'rgba(142,247,255,0.06)'][i]);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(hx - 220, 0, 440, h * 0.6);
    }

    ctx.save();
    ctx.translate(-camX * 0.22, -camY * 0.06 + h * 0.30);
    Vesta.drawSkyline(ctx, this.mission, this.t);
    ctx.restore();
  }

  drawHUD(ctx, game) {
    const { w, h } = game;
    const me = this.me;
    const p = this.accessPacket(me);

    // ---- top strip: who the city thinks you are
    panel(ctx, 16, 16, 430, 122, { glow: 'rgba(255,63,164,0.25)' });
    text(ctx, me.kin.codename, 32, 44, { font: FONT.display(22), color: '#fff' });
    text(ctx, me.thread.name, 32, 64, { font: FONT.mono(13, 700), color: '#ff8ec8' });
    let tx = 32;
    for (const tag of p.tags.slice(0, 5)) tx += tagChip(ctx, tag, tx, 74);
    if (me.borrowed) {
      const left = Math.ceil(me.borrowed.duration - me.borrowed.t);
      text(ctx, `borrowed ${left}s`, 400, 88, {
        font: FONT.mono(10, 700), color: '#3ddc97', align: 'right',
      });
    }

    const cols = [
      ['ACCESS', p.access, '#8ef7ff'],
      ['DESIRE', p.desirability, '#ffd400'],
      ['THREAT', p.threat, '#ff4a72'],
      ['IGNORE', p.ignore, '#3ddc97'],
    ];
    cols.forEach(([label, val, color], i) => {
      const cx = 32 + i * 100;
      text(ctx, label, cx, 112, { font: FONT.mono(10, 700), color: 'rgba(255,255,255,0.45)' });
      text(ctx, String(val), cx, 130, { font: FONT.display(18), color });
    });

    // ---- heat
    panel(ctx, w - 306, 16, 290, 92);
    text(ctx, 'HEAT', w - 290, 40, { font: FONT.mono(12, 700), color: 'rgba(255,255,255,0.6)' });
    text(ctx, `${Math.round(this.heat)} / ${Math.round(this.heatCap)}`, w - 32, 40, {
      font: FONT.mono(12, 700), color: this.heat > this.heatCap * 0.7 ? '#ff4a72' : '#e9e6f2', align: 'right',
    });
    meter(ctx, w - 290, 48, 258, 10, this.heat / this.heatCap, { color: '#ff9a3c' });
    text(ctx, `ALERT ${'■'.repeat(this.alert)}${'□'.repeat(3 - this.alert)}`, w - 290, 84, {
      font: FONT.mono(12, 700), color: this.alert ? '#ff9a3c' : 'rgba(255,255,255,0.4)',
    });
    text(ctx, `STYLE ${Math.round(this.style)}`, w - 32, 84, {
      font: FONT.mono(12, 700), color: '#3ddc97', align: 'right',
    });
    this.drawMinimap(ctx, game);

    // ---- objectives
    const oy = 156;
    panel(ctx, 16, oy, 320, 26 + this.mission.objectives.length * 22);
    text(ctx, 'CONTRACT', 32, oy + 22, { font: FONT.mono(11, 700), color: 'rgba(255,255,255,0.45)' });
    this.mission.objectives.forEach((o, i) => {
      const done = this.done[o.id];
      const label = o.kind === 'mimic' ? `${o.text} (${this.copies}/${o.count})` : o.text;
      text(ctx, `${done ? '✓' : '○'} ${label}`, 32, oy + 44 + i * 22, {
        font: FONT.mono(12, done ? 700 : 500),
        color: done ? '#3ddc97' : 'rgba(233,230,242,0.8)',
      });
    });

    // ---- crew switcher
    this.crew.forEach((c, i) => {
      const bx = 16 + i * 92;
      const by = h - 92;
      panel(ctx, bx, by, 84, 74, {
        stroke: i === this.active ? '#ff3fa4' : 'rgba(255,255,255,0.12)',
        fill: i === this.active ? 'rgba(255,63,164,0.16)' : 'rgba(14,10,22,0.8)',
      });
      text(ctx, `${i + 1}`, bx + 8, by + 18, { font: FONT.mono(11, 700), color: 'rgba(255,255,255,0.5)' });
      text(ctx, c.kin.codename.split(' ')[0], bx + 42, by + 34, {
        font: FONT.mono(12, 800), color: '#fff', align: 'center',
      });
      text(ctx, c.thread.name, bx + 42, by + 50, {
        font: FONT.mono(9, 600), color: '#ff8ec8', align: 'center',
      });
      const cd = c.cooldown > 0 ? `${c.cooldown.toFixed(1)}s` : 'Q READY';
      text(ctx, cd, bx + 42, by + 64, {
        font: FONT.mono(9, 700), color: c.cooldown > 0 ? 'rgba(255,255,255,0.35)' : '#3ddc97', align: 'center',
      });
    });

    // ---- compile bar
    if (this.compiling) {
      const bw = 280;
      const bx = (w - bw) / 2;
      panel(ctx, bx - 12, h - 176, bw + 24, 54);
      const next = me.kin.threads[this.compiling.idx];
      text(ctx, `COMPILING — ${next.name}`, w / 2, h - 152, {
        font: FONT.mono(12, 700), color: '#8ef7ff', align: 'center',
      });
      meter(ctx, bx, h - 142, bw, 10, this.compiling.t / this.compiling.dur, { color: '#8ef7ff' });
    }

    // ---- active effects
    let ex = w - 16;
    for (const e of this.effects) {
      const label = e.id.toUpperCase();
      const tw = label.length * 8 + 22;
      ex -= tw + 8;
      ctx.fillStyle = 'rgba(255,63,164,0.22)';
      ctx.beginPath();
      ctx.roundRect(ex, h - 92, tw, 24, 12);
      ctx.fill();
      ctx.strokeStyle = '#ff3fa4';
      ctx.lineWidth = 1;
      ctx.stroke();
      text(ctx, label, ex + tw / 2, h - 76, { font: FONT.mono(10, 700), color: '#ffb3da', align: 'center' });
      const left = 1 - e.t / e.dur;
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(ex, h - 70, tw * left, 2);
    }

    // ---- log + prompt + tip
    this.log.draw(ctx, 16, h - 116);
    if (this.prompt) {
      panel(ctx, w / 2 - 170, h - 132, 340, 36, { glow: 'rgba(255,212,0,0.3)' });
      text(ctx, this.prompt, w / 2, h - 109, { font: FONT.mono(14, 700), color: '#ffd400', align: 'center' });
    }
    text(ctx, this.hint, w / 2, 34, {
      font: FONT.mono(12, 500), color: 'rgba(255,255,255,0.4)', align: 'center',
    });
    if (this.timeLeft !== null) {
      text(ctx, `${Math.ceil(this.timeLeft)}s`, w / 2, 64, {
        font: FONT.display(26), color: this.timeLeft < 30 ? '#ff4a72' : '#fff', align: 'center',
      });
    }
    text(ctx, 'WASD move · SHIFT blend · SPACE dash · Q ability · R style break · Z/X/C compile · E interact · 1-4 swap · ESC abort',
      w / 2, h - 16, { font: FONT.mono(11, 500), color: 'rgba(255,255,255,0.3)', align: 'center' });
  }
}

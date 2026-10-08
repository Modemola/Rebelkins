/**
 * All sound is synthesised at runtime. No samples ship with the game.
 *
 * That is not a compromise here -- it is what lets an impact be *played* rather
 * than triggered. A hook and a jab are the same sound with different pitch,
 * body and decay, driven straight off the damage number the simulation already
 * computed, so the audio tracks the balance sheet instead of drifting from it.
 *
 * Everything routes dry + a send to a generated room, through a compressor, so
 * overlapping impacts duck each other instead of clipping.
 */

export class Sfx {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.muted = false;
    this.noise = null;
    this.master = null;
  }

  /** Browsers hold audio until a gesture, so this runs off the first click. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 24;
    comp.ratio.value = 7;
    comp.attack.value = 0.003;
    comp.release.value = 0.22;

    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(comp);
    comp.connect(ctx.destination);
    this.master = master;

    // the arena: a short bright room, generated rather than loaded
    const verb = ctx.createConvolver();
    verb.buffer = this.impulse(1.5, 2.6);
    const send = ctx.createGain();
    send.gain.value = 0.26;
    send.connect(verb);
    verb.connect(master);
    this.send = send;

    this.noise = this.noiseBuffer(2);
    this.ready = true;
    this.startBed();
  }

  impulse(seconds, decay) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay;
      }
    }
    return buf;
  }

  noiseBuffer(seconds) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(1, len, rate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  /* ------------------------------------------------------------- helpers */

  get t() { return this.ctx.currentTime; }

  /** A pitched body: oscillator with a falling sweep and an exponential tail. */
  tone({ type = 'sine', from, to, dur, gain, delay = 0, send = 0.3, curve = 'exp' }) {
    const t0 = this.t + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(from, t0);
    if (curve === 'exp') o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
    else o.frequency.linearRampToValueAtTime(Math.max(1, to), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(this.master);
    if (send > 0) {
      const s = this.ctx.createGain();
      s.gain.value = send;
      g.connect(s);
      s.connect(this.send);
    }
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  /** A transient: filtered noise. This is what reads as impact rather than tone. */
  burst({ freq, q = 1, dur, gain, type = 'bandpass', delay = 0, send = 0.3, sweepTo = null }) {
    const t0 = this.t + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t0);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), t0 + dur);
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    if (send > 0) {
      const s = this.ctx.createGain();
      s.gain.value = send;
      g.connect(s);
      s.connect(this.send);
    }
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  /* --------------------------------------------------------------- voices */

  /**
   * An impact, scaled by damage. A jab at 42 and a hook at 98 are the same
   * three layers -- thump, crack, body -- pitched and weighted differently.
   */
  hit(damage = 60, ko = false) {
    if (!this.on) return;
    const w = Math.min(1, damage / 120);           // weight, 0..1
    const pitch = 1 - w * 0.45;
    this.tone({ type: 'sine', from: 210 * pitch, to: 38, dur: 0.10 + w * 0.14, gain: 0.55 + w * 0.3, send: 0.2 });
    this.burst({ freq: 2600 - w * 1100, q: 0.9, dur: 0.045 + w * 0.03, gain: 0.34 + w * 0.2 });
    this.burst({ freq: 420 - w * 120, q: 1.4, dur: 0.14 + w * 0.12, gain: 0.26 + w * 0.2, type: 'lowpass' });
    if (w > 0.6) this.tone({ type: 'triangle', from: 120, to: 54, dur: 0.22, gain: 0.3, delay: 0.012, send: 0.5 });
    if (ko) this.koStinger();
  }

  block() {
    if (!this.on) return;
    this.burst({ freq: 4200, q: 3.5, dur: 0.07, gain: 0.3, send: 0.4 });
    this.tone({ type: 'square', from: 900, to: 520, dur: 0.06, gain: 0.12, send: 0.3 });
    this.burst({ freq: 700, q: 1.2, dur: 0.08, gain: 0.14, type: 'lowpass' });
  }

  /** Swing through air. Heavier moves cut lower and longer. */
  whiff(weight = 0.5) {
    if (!this.on) return;
    const dur = 0.13 + weight * 0.12;
    this.burst({
      freq: 700 + weight * 400, q: 1.1, dur, gain: 0.12 + weight * 0.08,
      sweepTo: 2200 + weight * 900, send: 0.18,
    });
  }

  step() {
    if (!this.on) return;
    this.burst({ freq: 260, q: 0.8, dur: 0.07, gain: 0.10, type: 'lowpass', send: 0.12 });
  }

  jump() {
    if (!this.on) return;
    this.burst({ freq: 300, q: 1, dur: 0.09, gain: 0.14, type: 'lowpass', send: 0.15 });
    this.tone({ type: 'sine', from: 160, to: 320, dur: 0.12, gain: 0.10, curve: 'lin', send: 0.1 });
  }

  land() {
    if (!this.on) return;
    this.tone({ type: 'sine', from: 140, to: 48, dur: 0.12, gain: 0.3, send: 0.2 });
    this.burst({ freq: 380, q: 0.9, dur: 0.1, gain: 0.16, type: 'lowpass' });
  }

  koStinger() {
    if (!this.on) return;
    this.tone({ type: 'sine', from: 90, to: 28, dur: 0.9, gain: 0.7, send: 0.8 });
    this.burst({ freq: 1800, q: 0.7, dur: 0.6, gain: 0.3, sweepTo: 120, send: 0.9 });
    this.swell(1.0, 2.2);
  }

  /** Announcement stinger: a short detuned chord with a filter opening. */
  announce(kind = 'round') {
    if (!this.on) return;
    const root = kind === 'ko' ? 110 : kind === 'win' ? 196 : 147;
    const t0 = this.t;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(400, t0);
    f.frequency.exponentialRampToValueAtTime(5200, t0 + 0.26);
    f.Q.value = 6;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.22, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.75);
    f.connect(g);
    g.connect(this.master);
    const s = this.ctx.createGain();
    s.gain.value = 0.5;
    g.connect(s);
    s.connect(this.send);
    for (const [mult, detune] of [[1, -6], [1, 7], [1.5, 0], [2, 4]]) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = root * mult;
      o.detune.value = detune;
      o.connect(f);
      o.start(t0);
      o.stop(t0 + 0.8);
    }
  }

  ui() {
    if (!this.on) return;
    this.tone({ type: 'triangle', from: 880, to: 1320, dur: 0.07, gain: 0.10, curve: 'lin', send: 0.1 });
  }

  /* ------------------------------------------------------------ ambience */

  /** A low room tone plus crowd, so silence between hits is not dead air. */
  startBed() {
    const ctx = this.ctx;
    const bed = ctx.createGain();
    bed.gain.value = 0.0;
    bed.connect(this.master);
    this.bed = bed;

    for (const [freq, detune, gain] of [[55, -5, 0.06], [55, 6, 0.05], [82.5, 0, 0.03]]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 180;
      o.type = 'sawtooth';
      o.frequency.value = freq;
      o.detune.value = detune;
      g.gain.value = gain;
      o.connect(lp); lp.connect(g); g.connect(bed);
      o.start();
    }

    // crowd: wide filtered noise, kept well under the music of the hits
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 0.5;
    const cg = ctx.createGain();
    cg.gain.value = 0.045;
    src.connect(bp); bp.connect(cg); cg.connect(bed);
    src.start();
    this.crowd = cg;

    bed.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 2.5);
  }

  /** Crowd reaction. Called on big moments, decays on its own. */
  swell(power = 0.5, seconds = 1.2) {
    if (!this.on || !this.crowd) return;
    const t0 = this.t;
    const g = this.crowd.gain;
    g.cancelScheduledValues(t0);
    g.setValueAtTime(g.value, t0);
    g.linearRampToValueAtTime(0.045 + 0.2 * power, t0 + 0.08);
    g.exponentialRampToValueAtTime(0.045, t0 + seconds);
  }

  get on() { return this.ready && !this.muted && this.ctx.state === 'running'; }

  setMuted(m) {
    this.muted = m;
    if (this.master) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.02);
    }
  }
}

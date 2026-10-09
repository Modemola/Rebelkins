/**
 * REBELKIN — boot and the render pass.
 *
 * The simulation runs at a fixed 60Hz and knows nothing about the screen; this
 * file reads the state it produced and photographs it.
 */

import { Loop, TICK } from './engine/loop.js';
import { Input } from './engine/input.js';
import { Rig } from './render/rig.js';
import { Camera, drawStage, drawFloor, drawFore, setArena, arena } from './render/stage.js';
import { ARENAS } from './render/arena.js';
import { FX } from './render/fx.js';
import { Match, PHASE, STAGE, fitStage } from './fight/match.js';
import { AI } from './fight/ai.js';
import { STATE } from './fight/fighter.js';
import { KIN01 } from './data/kin01.js';
import { KIN02 } from './data/kin02.js';
import { KIN03 } from './data/kin03.js';
import { KIN04 } from './data/kin04.js';
import { KIN05 } from './data/kin05.js';
import { KIN06 } from './data/kin06.js';
import { KIN07 } from './data/kin07.js';
import { KIN08 } from './data/kin08.js';
import { KIN09 } from './data/kin09.js';
import { KIN10 } from './data/kin10.js';
import { Sfx } from './audio/sfx.js';

/** Roster order is the order they were drawn in, not a power ranking. */
const ROSTER = [KIN01, KIN02, KIN03, KIN04, KIN05, KIN06, KIN07, KIN08, KIN09, KIN10];
const DEFS = Object.fromEntries(ROSTER.map((d) => [d.id, d]));
const cv = document.getElementById('stage');
const ctx = cv.getContext('2d');
const input = new Input();
const fx = new FX();
const cam = new Camera();
const sfx = new Sfx();

const el = (id) => document.getElementById(id);
const view = { w: 1280, h: 720 };
let dpr = 1;

function resize() {
  // A fighter wants frames more than it wants pixels; 2x on a large display
  // quadruples every full-screen pass for no visible gain at this art scale.
  dpr = Math.min(1.5, window.devicePixelRatio || 1);
  view.w = cv.clientWidth || window.innerWidth;
  view.h = cv.clientHeight || window.innerHeight;
  cv.width = Math.round(view.w * dpr);
  cv.height = Math.round(view.h * dpr);
  fitStage(view);
}
addEventListener('resize', resize);

/* ---------------------------------------------------------------- assets */

function loadImage(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error(`could not load ${src}`));
    im.src = src;
  });
}

const rigs = {};
async function loadRigs() {
  await Promise.all(Object.values(DEFS).map(async (d) => {
    rigs[d.id] = new Rig(d.rig, await loadImage(d.atlas));
  }));
}

/* ----------------------------------------------------------------- match */

let match = null;
let ai = new AI('brisk');
let mode = 'ai';
let p1Kin = 'kin08';
let p2Kin = 'kin06';
let arenaId = 'towers';
let slowCounter = 0;

function startMatch() {
  setArena(arenaId);
  match = new Match(DEFS[p1Kin], DEFS[p2Kin], rigs);
  match.onEvent = onMatchEvent;
  el('select').hidden = true;
  el('hud').hidden = false;
  input.clear('p1');
  input.clear('p2');
  paintNames();
  // The loop renders on every animation frame but only simulates on whole
  // ticks, so the first render after this call can land before any update.
  // Solve once here so `poses` is never empty while `match` is live.
  solvePoses();
  announce(`ROUND ${match.round}`, 1100, 'round');
}

function onMatchEvent(kind, data) {
  if (kind === 'hit') {
    fx.hit(data.contact, data.move, data.ko);
    arena().hit(Math.min(1, data.move.damage / 110));
    if (data.ko) arena().ko();
    sfx.hit(data.move.damage, data.ko);
    sfx.swell(Math.min(1, data.move.damage / 110), data.ko ? 2.4 : 0.9);
    cam.bump(data.ko ? 24 : 7 + data.move.damage / 14);
    cam.kick.x = -data.attacker.facing * Math.min(16, data.move.damage / 7);
    if (data.ko) announce('K.O.', 1600, 'ko');
  } else if (kind === 'block') {
    fx.block(data.contact);
    sfx.block();
    cam.bump(3);
  } else if (kind === 'fight') {
    announce('FIGHT', 700, 'round');
  } else if (kind === 'roundEnd') {
    setTimeout(() => {
      if (match.over) {
        const who = match.wins[0] > match.wins[1] ? match.a : match.b;
        announce(`${who.def.name} WINS`, 2600, 'win');
        sfx.swell(1, 3);
      }
    }, 900);
  }
}

let announceTimer = 0;
function announce(text, ms, voice) {
  const node = el('announce');
  el('announceText').textContent = text;
  node.hidden = false;
  if (voice) sfx.announce(voice);
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => { node.hidden = true; }, ms);
}

/* --------------------------------------------------------------- intents */

function readIntent(pad) {
  return {
    move: input.axis(pad),
    crouch: input.held(pad, 'down'),
    jump: input.take(pad, 'up'),
    guard: input.held(pad, 'guard'),
    attack: input.take(pad, 'light') ? 'light'
      : input.take(pad, 'heavy') ? 'heavy'
        : input.take(pad, 'special') ? 'special' : null,
  };
}

/* ------------------------------------------------------------------ step */

const poses = {};

function update(frame) {
  input.tick(frame);
  if (!match) return;

  // KO slow motion: the simulation runs at a third speed while the fall plays
  if (match.slowmo > 0) {
    match.slowmo--;
    slowCounter = (slowCounter + 1) % 3;
    if (slowCounter !== 0) return;
  }

  const a = readIntent('p1');
  const b = mode === '2p' ? readIntent('p2') : ai.think(match.b, match.a, frame);

  match.step(frame, { a, b }, solvePoses);
  for (const f of match.fighters) {
    for (const ev of f.sounds) {
      if (ev.t === 'whiff') sfx.whiff(ev.weight);
      else if (ev.t === 'step') sfx.step();
      else if (ev.t === 'jump') sfx.jump();
      else if (ev.t === 'land') sfx.land();
    }
    f.sounds.length = 0;
  }
  // step() only solves inside the fight phase, and returns early during the
  // intro, hitstop and round-end. Render needs a current pose every frame
  // regardless, and a solve is a handful of matrix multiplies.
  solvePoses();
}

function solvePoses() {
  for (const f of match.fighters) {
    const rig = rigs[f.def.id];
    poses[f.def.id] = rig.solve(f.pose(), {
      x: f.x, y: f.y, scale: f.def.scale, facing: f.facing,
    });
  }
  return poses;
}

/**
 * Render switches, for measurement only.
 *
 * `hideFighters` draws the stage with nobody standing in it. Differencing that
 * frame against a normal one gives the exact mask the characters occupy, which
 * is what the legibility check needs: the brief says to silhouette the
 * fighters in flat black and confirm you can still follow them, and a
 * difference mask does that better than flat black would, because it measures
 * the contrast of the colours actually on screen rather than a stand-in.
 */
const debugDraw = { hideFighters: false };

/* ---------------------------------------------------------------- render */

function render(alpha, dt) {
  if (!match) { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, view.w, view.h); return; }

  fx.step(dt);
  arena().update(dt);
  cam.follow(match.a, match.b, view, dt);

  drawStage(ctx, view, cam, performance.now() / 1000, dpr);

  cam.apply(ctx, view, dpr);
  drawFloor(ctx, cam, view);

  // Reflections reuse the matrices the simulation already solved, mirrored about
  // the floor line -- a second solve per fighter per frame bought nothing.
  if (!debugDraw.hideFighters) {
    ctx.save();
    ctx.scale(1, -1);
    for (const f of match.fighters) {
      ctx.globalAlpha = 0.22;
      rigs[f.def.id].draw(ctx, poses[f.def.id]);
    }
    ctx.restore();
  }
  // fade the reflection out with distance from the floor line
  ctx.fillStyle = arena().reflectionFade(ctx);
  ctx.fillRect(-3000, 0, 6000, 420);

  // contact shadows
  for (const f of match.fighters) {
    const lift = Math.max(0, -f.y);
    const squash = 1 - Math.min(0.6, lift / 420);
    const g = ctx.createRadialGradient(f.x, 0, 3, f.x, 0, 120 * squash);
    g.addColorStop(0, `rgba(0,0,0,${0.55 * squash})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(f.x, 0, 120 * squash, 20 * squash, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // fighters, far one first so the near one overlaps correctly
  const order = debugDraw.hideFighters ? [] : match.fighters.slice().sort((p, q) => p.x - q.x);
  for (const f of order) {
    const rig = rigs[f.def.id];
    const M = poses[f.def.id];
    // No rim light. It was a second full rig draw per fighter per frame under
    // a 'lighter' composite -- about six frames a second of the budget -- and
    // measuring it showed it was not even doing its job: character-to-backdrop
    // contrast went UP when it came out (50.8 to 54.9), because the halo it
    // laid down is a band of intermediate luminance across the exact edge it
    // was supposed to sharpen. These illustrations already carry their own
    // white outline; it was drawing a soft glow over a hard line.

    if (f.state === STATE.BLOCK) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#52d8ef';
      ctx.lineWidth = 3 / cam.zoom;
      ctx.beginPath();
      ctx.ellipse(f.x + f.facing * 26, f.y - 86, 56, 86, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    rig.draw(ctx, M);
  }

  fx.drawWorld(ctx, cam.zoom);

  // Weather and the out-of-focus crowd at the very front go over the fighters;
  // passing behind something is most of what sells the depth.
  drawFore(ctx, view, cam, dpr);
  fx.drawScreen(ctx, view, dpr);
  paintHud();
}

/* ------------------------------------------------------------------- hud */

function paintNames() {
  el('nameA').textContent = match.a.def.name;
  el('subA').textContent = match.a.def.subtitle;
  el('nameB').textContent = match.b.def.name;
  el('subB').textContent = match.b.def.subtitle;
  for (const [side, idx] of [['pipsA', 0], ['pipsB', 1]]) {
    const host = el(side);
    host.textContent = '';
    for (let i = 0; i < 2; i++) {
      const d = document.createElement('div');
      d.className = `pip${match.wins[idx] > i ? ' on' : ''}`;
      host.appendChild(d);
    }
  }
}

let lastWins = '';
function paintHud() {
  const pa = Math.max(0, match.a.health / match.a.def.health) * 100;
  const pb = Math.max(0, match.b.health / match.b.def.health) * 100;
  el('hpA').style.width = `${pa}%`;
  el('hpB').style.width = `${pb}%`;
  el('hpAghost').style.width = `${pa}%`;
  el('hpBghost').style.width = `${pb}%`;
  el('timer').textContent = String(Math.ceil(match.timer));
  el('roundLabel').textContent = match.over ? 'MATCH' : `ROUND ${match.round}`;
  const w = match.wins.join('-');
  if (w !== lastWins) { lastWins = w; paintNames(); }
}

/* ---------------------------------------------------------------- roster */

/**
 * Two grids of the same ten portraits, one per corner. Both sides are pickable
 * because with ten characters the old "you get whoever you didn't choose" rule
 * stops being a choice at all.
 */
function buildRoster() {
  for (const side of ['A', 'B']) {
    const host = el(`roster${side}`);
    const read = el(`read${side}`);
    const paint = () => {
      const chosen = side === 'A' ? p1Kin : p2Kin;
      const d = DEFS[chosen];
      read.innerHTML = `<b>${d.name}</b> &middot; ${d.subtitle}<br>`
        + Object.values(d.moves).map((m) => m.label).join(' &middot; ');
      [...host.children].forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.kin === chosen)));
    };
    for (const d of ROSTER) {
      const b = document.createElement('button');
      b.className = 'face';
      b.dataset.kin = d.id;
      b.type = 'button';
      b.title = `${d.name} - ${d.subtitle}`;
      b.setAttribute('aria-label', `${d.name}, ${d.subtitle}`);
      b.style.backgroundImage = `url(assets/portraits/${d.id}.png)`;
      b.addEventListener('click', () => {
        if (side === 'A') p1Kin = d.id; else p2Kin = d.id;
        paint();
      });
      host.appendChild(b);
    }
    paint();
  }
}

/** Where the fight happens. 'any' rolls a different place each match. */
function buildArenaPicker() {
  const host = el('arenaRow');
  const read = el('arenaRead');
  const options = [...ARENAS.map((a) => ({ id: a.id, label: a.name, blurb: a.blurb })),
    { id: 'any', label: 'SURPRISE', blurb: 'A different place every match' }];
  const paint = () => {
    const o = options.find((x) => x.id === arenaId);
    read.textContent = o ? o.blurb : '';
    [...host.children].forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.arena === arenaId)));
  };
  for (const o of options) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'arena';
    b.dataset.arena = o.id;
    b.textContent = o.label;
    b.addEventListener('click', () => { arenaId = o.id; sfx.unlock(); sfx.ui(); paint(); });
    host.appendChild(b);
  }
  paint();
}

/* ------------------------------------------------------------------ menu */

function wireMenu() {
  const group = (sel, onPick) => {
    const nodes = [...document.querySelectorAll(sel)];
    nodes.forEach((b) => b.addEventListener('click', () => {
      nodes.forEach((n) => n.setAttribute('aria-pressed', String(n === b)));
      onPick(b);
    }));
  };
  buildRoster();
  buildArenaPicker();
  group('.mode', (b) => {
    mode = b.dataset.mode;
    el('diffRow').hidden = mode === '2p';
    el('p2keys').hidden = mode !== '2p';
    el('whoB').textContent = mode === '2p' ? 'PLAYER 2' : 'CPU';
  });
  group('.diff', (b) => ai.set(b.dataset.diff));
  el('startBtn').addEventListener('click', () => { sfx.unlock(); sfx.ui(); startMatch(); });
  document.querySelectorAll('.face, .mode, .diff').forEach((b) => {
    b.addEventListener('click', () => { sfx.unlock(); sfx.ui(); });
  });

  let muted = false;
  try { muted = localStorage.getItem('rebelkin.muted') === '1'; } catch { /* private window */ }
  const muteBtn = el('muteBtn');
  const paintMute = () => {
    sfx.setMuted(muted);
    muteBtn.setAttribute('aria-pressed', String(muted));
    muteBtn.textContent = muted ? 'SOUND OFF' : 'SOUND ON';
  };
  muteBtn.addEventListener('click', () => {
    muted = !muted;
    try { localStorage.setItem('rebelkin.muted', muted ? '1' : '0'); } catch { /* ignore */ }
    paintMute();
  });
  paintMute();
  addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && match) {
      match = null;
      el('select').hidden = false;
      el('hud').hidden = true;
      el('announce').hidden = true;
    }
  });
}

/* ------------------------------------------------------------------ boot */

resize();
wireMenu();
loadRigs().then(() => {
  const loop = new Loop({ update, render });
  loop.start();
  window.__REBELKIN__ = { get match() { return match; }, rigs, fx, cam, loop, DEFS, ai, sfx,
    ROSTER, ARENAS, arena, debugDraw, STAGE,
    poses,
    // One frame, on demand. The legibility and gradient checks need two frames
    // of the same instant -- with the loop running, the crowd and the weather
    // move between captures and the difference mask fills with their noise.
    renderOnce: () => render(0, 0),
    setArena: (id) => { arenaId = id; },
    start: (kin, m, foe) => {
      p1Kin = kin || p1Kin;
      p2Kin = foe || p2Kin;
      mode = m || mode;
      startMatch();
    } };
}).catch((err) => {
  el('select').innerHTML = `<div class="selWrap"><h1>REBELKIN</h1>
    <p class="tag">${err.message}</p></div>`;
});

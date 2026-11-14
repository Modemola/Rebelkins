/**
 * REBELKIN — boot and the render pass.
 *
 * The simulation runs at a fixed 60Hz and knows nothing about the screen; this
 * file reads the state it produced and photographs it.
 */

import { Loop, TICK } from './engine/loop.js';
import { Input } from './engine/input.js';
import { Rig } from './render/rig.js';
import { Skinner } from './render/skin.js';
import { Camera, drawStage, drawFloor, drawFore, setArena, arena } from './render/stage.js';
import { ARENAS } from './render/arena.js';
import { WEAPONS, byId as weaponById, canHold, drawWeaponOn } from './data/weapons.js';
import * as progress from './game/progress.js';
import { FX } from './render/fx.js';
import { Match, PHASE, STAGE, fitStage } from './fight/match.js';
import { AI } from './fight/ai.js';
import { STATE } from './fight/fighter.js';
import { KIN06 } from './data/kin06.js';
import { KIN09 } from './data/kin09.js';
import { KIN06S } from './data/kin06s.js';
import { KIN09S } from './data/kin09s.js';
import { Sfx } from './audio/sfx.js';

/** Roster order is the order they were drawn in, not a power ranking. */
/**
 * The ten front-facing originals, then the side-view pair.
 *
 * The side two are drawn for a camera the other ten are not: the whole point
 * of the redraw is that a limb pointing at the opponent is a limb seen from
 * the side, so their kicks read where the others' cannot. They stand at the
 * same 304 world units and are picked the same way; what differs is that
 * their moves are written out frame by frame rather than generated, because
 * the generator builds motion out of a figure standing to attention and both
 * of them are already drawn in a guard.
 *
 * They are at the end rather than beside their front-facing namesakes so the
 * first two rows of the select grid stay the set people already know.
 */
// The two characters drawn for a side-on camera, and only those.
//
// The other ten are still in src/data and still build; they are out of the
// roster, not deleted, so this is one line to undo. They were drawn
// front-facing, and a front-facing limb pointing at the opponent cannot read
// as a strike -- five of them have no separable arms at all and can never
// throw a punch. Shipping them beside two that work makes the whole cast look
// like the worst of it.
const ROSTER = [KIN06S, KIN09S];
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
/**
 * The skinned mesh for each character, drawn instead of the cut-out stack.
 *
 * The rig is unchanged and still solves the bones -- the hitboxes ride on
 * those same matrices -- but the drawing is a single mesh over the whole
 * illustration rather than a pile of separate quads. Two quads meeting at a
 * joint come apart when it bends, which is why the punching arm rendered as a
 * floating sleeve with a gap at the shoulder. A mesh has nothing to come
 * apart. The cut-out path stays as the fallback for anything without WebGL.
 */
const meshes = {};
const skinner = new Skinner();

async function loadRigs() {
  await Promise.all(Object.values(DEFS).map(async (d) => {
    rigs[d.id] = new Rig(d.rig, await loadImage(d.atlas));
  }));
  if (!skinner.ok) return;
  await Promise.all(Object.values(DEFS).map(async (d) => {
    try {
      const mesh = await (await fetch(`meshes/v2/${d.id}.json`)).json();
      meshes[d.id] = { mesh, image: await loadImage(mesh.texture) };
    } catch { /* this character keeps the cut-out path */ }
  }));
}

/** Both fighters in one pass, so the composite happens once rather than twice. */
function drawFighters(ctx, list, alpha) {
  const skinned = list.filter((f) => meshes[f.def.id]);
  if (skinner.ok && skinned.length === list.length) {
    skinner.draw(ctx, list.map((f) => ({
      id: f.def.id, ...meshes[f.def.id], matrices: poses[f.pad], alpha,
    })));
    return;
  }
  for (const f of list) {
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    rigs[f.def.id].draw(ctx, poses[f.pad]);
  }
}

/* ----------------------------------------------------------------- match */

let match = null;
let ai = new AI('brisk');
let mode = 'ai';
let p1Kin = 'kin06s';
let p2Kin = 'kin09s';
let arenaId = 'towers';
let awarded = false;   // one rank-up per match, however many times roundEnd fires
let drawOrder = [];    // back to front, as the last render decided it
let p1Weapon = 'bare';
let p2Weapon = 'bare';
let slowCounter = 0;

function startMatch() {
  awarded = false;
  setArena(arenaId);
  match = new Match(DEFS[p1Kin], DEFS[p2Kin], rigs,
    [weaponById(p1Weapon), weaponById(p2Weapon)]);
  match.onEvent = onMatchEvent;
  el('select').hidden = true;
  el('hud').hidden = false;
  if (padWanted) el('pad').hidden = false;
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
    fx.hit(data.contact, { ...data.move, damage: data.damage ?? data.move.damage }, data.ko);
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
  } else if (kind === 'guardBreak') {
    // Loud on purpose. A break is the one opening in the game you create
    // rather than catch, and the player needs to know the instant it lands.
    fx.guardBreak(data.contact);
    sfx.guardBreak();
    arena().hit(0.8);
    cam.bump(16);
    cam.kick.x = -data.attacker.facing * 10;
    flashGuard(data.defender === match.a ? 'A' : 'B');
    announce('GUARD BREAK', 900, 'break');
  } else if (kind === 'fight') {
    announce('FIGHT', 700, 'round');
  } else if (kind === 'roundEnd') {
    setTimeout(() => {
      if (!match || !match.over) return;
      const playerWon = match.wins[0] > match.wins[1];
      const who = playerWon ? match.a : match.b;
      // Rank is the player's, not the match's: only P1 taking it counts, and
      // only once, which is why it is awarded here and not per round.
      const earned = playerWon && !awarded ? progress.winMatch() : null;
      awarded = true;
      announce(earned && earned.promoted
        ? `RANK ${earned.rank}`
        : `${who.def.name} WINS`, 2600, 'win');
      sfx.swell(1, 3);
      repaintLoadout();
    }, 900);
  }
}

const breakTimers = { A: 0, B: 0 };
function flashGuard(side) {
  const wrap = el(`gd${side}wrap`);
  wrap.classList.remove('broke');
  // Reading offsetWidth restarts the animation; without it a second break
  // inside half a second would not flash at all.
  void wrap.offsetWidth;
  wrap.classList.add('broke');
  clearTimeout(breakTimers[side]);
  breakTimers[side] = setTimeout(() => wrap.classList.remove('broke'), 500);
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

/**
 * Solved poses, keyed by which corner the fighter is in -- not by which
 * character they are. Keyed by character id, a mirror match had both
 * fighters writing to one entry: they were drawn, and hit-tested, with each
 * other's pose. Every move in a KIN 06 mirror read as connecting from any
 * distance at all.
 */
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
    poses[f.pad] = rig.solve(f.pose(), {
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
    drawFighters(ctx, match.fighters, 0.22);
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

  // Fighters, attacker last.
  //
  // This sorted on x, which is a depth cue borrowed from a plane that does not
  // exist here: both fighters stand on the same line, so "nearer" is meaningless
  // and all the sort did was put whoever stood on the right permanently in
  // front. Every strike thrown left-to-right then had its arm drawn behind the
  // defender -- the hit registered, the sparks came out, and the limb that
  // threw it disappeared into the other body. It reads as the two of them
  // occupying the same space.
  //
  // Whoever is swinging goes on top instead, for the whole move, so the limb
  // doing the work is never the thing that gets covered. With both swinging or
  // neither, the old x order stands: it is arbitrary either way, but it is
  // stable, and a draw order that flickers between frames is worse than one
  // that is merely arbitrary.
  const byX = (p, q) => p.x - q.x;
  const order = debugDraw.hideFighters ? []
    : match.fighters.slice().sort((p, q) => {
      const pa = p.state === STATE.ATTACK;
      const qa = q.state === STATE.ATTACK;
      return pa === qa ? byX(p, q) : (pa ? 1 : -1);
    });
  // Published for the suite: the order is decided here and spent immediately,
  // so without this there is nothing for a check to read but pixels.
  drawOrder = order.map((f) => f.pad);
  // Block glows first, then both bodies in one pass, then weapons. Compositing
  // the skinned canvas is the expensive part of that renderer, so it happens
  // once for the pair rather than once each.
  for (const f of order) {
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

  }
  drawFighters(ctx, order);
  for (const f of order) drawWeaponOn(ctx, rigs[f.def.id], poses[f.pad], f.def, f.weapon, f.facing);

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

/**
 * The guard meter, drawn as its own thin bar under the health bar. It goes hot
 * under a third because that is the point where one more blocked heavy opens
 * you; the break flash is added by the event handler, not here, so it fires
 * once per break instead of every frame the meter reads zero.
 */
function paintGuard(side, f) {
  const wrap = el(`gd${side}wrap`);
  el(`gd${side}`).style.width = `${Math.max(0, f.guard) * 100}%`;
  wrap.classList.toggle('low', f.guard < 0.34);
}

let lastWins = '';
function paintHud() {
  const pa = Math.max(0, match.a.health / match.a.def.health) * 100;
  const pb = Math.max(0, match.b.health / match.b.def.health) * 100;
  el('hpA').style.width = `${pa}%`;
  el('hpB').style.width = `${pb}%`;
  el('hpAghost').style.width = `${pa}%`;
  el('hpBghost').style.width = `${pb}%`;
  paintGuard('A', match.a);
  paintGuard('B', match.b);
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
        repaintLoadout();
      });
      host.appendChild(b);
    }
    paint();
  }
}

/**
 * The loadout. Weapons a character cannot physically hold are not offered,
 * and weapons above the player's rank are shown locked rather than hidden --
 * a ladder you cannot see is not a ladder.
 */
function buildWeaponPicker() {
  const host = el('weaponRow');
  const read = el('weaponRead');
  const paint = () => {
    const p = progress.current();
    el('rankLabel').textContent = `RANK ${p.rank}`
      + (p.toNext ? ` - ${p.toNext} win${p.toNext === 1 ? '' : 's'} to go` : ' - top');
    const def = DEFS[p1Kin];
    let chosen = weaponById(p1Weapon);
    if (!canHold(def, chosen) || chosen.rank > p.rank) {
      chosen = WEAPONS[0];
      p1Weapon = chosen.id;
      p2Weapon = chosen.id;
    }
    read.textContent = chosen.blurb;
    for (const b of host.children) {
      const w = weaponById(b.dataset.weapon);
      const holdable = canHold(def, w);
      const unlocked = w.rank <= p.rank;
      b.hidden = !holdable;
      b.classList.toggle('locked', !unlocked);
      b.textContent = unlocked ? w.name : `${w.name} - RANK ${w.rank}`;
      b.setAttribute('aria-pressed', String(w.id === chosen.id));
      b.disabled = !unlocked;
    }
  };
  for (const w of WEAPONS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'weapon';
    b.dataset.weapon = w.id;
    b.addEventListener('click', () => {
      if (b.disabled) return;
      p1Weapon = w.id;
      p2Weapon = w.id;
      sfx.unlock();
      sfx.ui();
      paint();
    });
    host.appendChild(b);
  }
  paint();
  repaintLoadout = paint;
}

let repaintLoadout = () => {};

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
  buildWeaponPicker();
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
  addEventListener('keydown', (e) => { if (e.code === 'Escape') leaveMatch(); });
  wirePad();
}

function leaveMatch() {
  if (!match) return;
  match = null;
  el('select').hidden = false;
  el('hud').hidden = true;
  el('announce').hidden = true;
  el('pad').hidden = true;
}

/**
 * The on-screen pad, for a device with no keyboard.
 *
 * Shown on a coarse pointer rather than on a narrow window: a small desktop
 * window is still a keyboard, and a tablet is still a thumb. `?pad=1` forces
 * it on, which is how it gets looked at on a machine that has a mouse.
 *
 * Every button goes through `input.bind`, so a thumb produces the same
 * buffered press a key does and nothing downstream knows the difference.
 */
function wirePad() {
  const forced = new URLSearchParams(location.search).get('pad');
  const touch = forced === '1'
    || (forced !== '0' && matchMedia('(pointer: coarse)').matches);
  if (!touch) return;
  document.body.classList.add('touch');
  for (const b of document.querySelectorAll('#pad .pb')) {
    input.bind(b, 'p1', b.dataset.act);
  }
  el('padExit').addEventListener('pointerdown', (e) => { e.preventDefault(); leaveMatch(); });
  padWanted = true;
}
let padWanted = false;

/* ------------------------------------------------------------------ boot */

resize();
wireMenu();
loadRigs().then(() => {
  const loop = new Loop({ update, render });
  loop.start();
  window.__REBELKIN__ = { get match() { return match; }, rigs, fx, cam, loop, DEFS, ai, sfx,
    ROSTER, ARENAS, arena, debugDraw, STAGE, WEAPONS, progress, skinner, meshes,
    get drawOrder() { return drawOrder; },
    setWeapon: (id) => { p1Weapon = id; p2Weapon = id; repaintLoadout(); },
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

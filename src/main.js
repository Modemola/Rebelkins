/**
 * REBELKIN: THREAD WAR — boot.
 *
 * A crew of RebelKin pull social heists in a city where fashion is executable
 * code. Change your fit, change who the world thinks you are.
 */

import { Game } from './core/loop.js';
import { Input } from './core/input.js';
import { load } from './core/save.js';
import { HubScene } from './scenes/hub.js';
import { KIN } from './data/kin.js';
import { drawKin } from './art/kinart.js';
import { FONT, text, button, paragraph } from './core/ui.js';
import { loadSprites, artSummary } from './art/sprites.js';

const canvas = document.getElementById('stage');
const input = new Input();
input.attachPointer(canvas);
const game = new Game(canvas, input);

/** Keep the backing store at design resolution and let CSS letterbox it. */
function fit() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const targetW = 1280;
  const targetH = 720;
  canvas.width = targetW * dpr;
  canvas.height = targetH * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // Game.w/h read canvas.width, so expose the design size instead
  Object.defineProperty(game, 'w', { get: () => targetW, configurable: true });
  Object.defineProperty(game, 'h', { get: () => targetH, configurable: true });
}
fit();
window.addEventListener('resize', fit);

class TitleScene {
  enter(g) { this.t = 0; this.g = g; }
  update(dt) { this.t += dt; }
  draw(ctx, g) {
    const { w, h } = g;
    ctx.fillStyle = '#07040d';
    ctx.fillRect(0, 0, w, h);

    // signage haze
    for (let i = 0; i < 5; i++) {
      const gr = ctx.createRadialGradient(
        w * (0.15 + i * 0.18), h * (0.2 + Math.sin(this.t * 0.3 + i) * 0.12), 20,
        w * (0.15 + i * 0.18), h * 0.3, 380,
      );
      gr.addColorStop(0, ['rgba(255,63,164,0.16)', 'rgba(142,247,255,0.14)', 'rgba(255,212,0,0.12)', 'rgba(61,220,151,0.12)', 'rgba(185,140,255,0.14)'][i]);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, w, h);
    }

    // the crew, walking
    KIN.forEach((kin, i) => {
      const x = 150 + i * 165;
      const y = 574 + Math.sin(this.t * 1.6 + i * 0.7) * 5;
      drawKin(ctx, {
        kin, thread: kin.threads[0], x, y, scale: 2.7,
        facing: Math.PI / 2, phase: this.t * 4 + i, moving: 0.5,
      });
      text(ctx, kin.codename, x, 600, {
        font: FONT.mono(10, 800), color: 'rgba(255,255,255,0.45)', align: 'center',
      });
    });

    text(ctx, 'REBELKIN', w / 2, 168, { font: FONT.display(76), color: '#fff', align: 'center' });
    text(ctx, 'THREAD WAR', w / 2, 212, { font: FONT.display(38), color: '#ff3fa4', align: 'center' });
    paragraph(ctx,
      'A crew of RebelKin pull social heists in a city where fashion is executable code. Change your fit, change who the world thinks you are.',
      w / 2 - 300, 252, 600, { lh: 20, color: 'rgba(255,255,255,0.6)', font: FONT.mono(13, 500) });
    text(ctx, 'Combat exists. It is the backup plan.', w / 2, 316, {
      font: FONT.mono(12, 700), color: '#8ef7ff', align: 'center',
    });

    if (button(ctx, this.g.input, { x: w / 2 - 110, y: 344, w: 220, h: 54 }, 'ENTER VESTA', {
      accent: '#ff3fa4', sub: 'Lowline is open',
    })) {
      this.g.setScene(new HubScene(load()));
    }
    text(ctx, 'vertical slice · 3 contracts · 6 Kin · 18 Threads',
      w / 2, h - 22, { font: FONT.mono(11, 500), color: 'rgba(255,255,255,0.3)', align: 'center' });
  }
}

// Artwork loads in the background. The title screen renders immediately with
// whatever is ready, and dropped-in plates simply start appearing.
loadSprites().then(() => {
  const summary = artSummary();
  if (summary.length) {
    for (const k of summary) {
      console.info(`[art] ${k.id}: ${k.plates.join(', ')}${k.ready ? '' : ' (failed to load)'}`);
    }
  } else {
    console.info('[art] no plates yet \u2014 running on placeholder art. '
      + 'Drop cutouts in assets/kin/<id>/ and run: node tools/scan-assets.mjs');
  }
});

// Handle for the automated playtest in tools/. Harmless in a browser, and the
// alternative is a test that can only click pixels and hope.
window.__THREADWAR__ = game;

game.start(new TitleScene());

/**
 * Input with a buffer.
 *
 * Pressing attack one frame before recovery ends should still come out; a
 * fighter that drops those inputs feels broken even when it is behaving exactly
 * as written. Every press is stamped with the frame it arrived on and stays
 * claimable for a short window.
 */

const BUFFER_FRAMES = 6;

export const ACTIONS = ['left', 'right', 'up', 'down', 'light', 'heavy', 'special', 'guard'];

const LAYOUTS = {
  p1: {
    KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down',
    KeyJ: 'light', KeyK: 'heavy', KeyL: 'special', Space: 'guard',
  },
  p2: {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
    Numpad1: 'light', Numpad2: 'heavy', Numpad3: 'special', Numpad0: 'guard',
    Comma: 'light', Period: 'heavy', Slash: 'special', ShiftRight: 'guard',
  },
};

export class Input {
  constructor() {
    this.down = { p1: new Set(), p2: new Set() };
    this.buffer = { p1: [], p2: [] };
    this.frame = 0;
    this.enabled = true;

    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      for (const pad of ['p1', 'p2']) {
        const a = LAYOUTS[pad][e.code];
        if (!a) continue;
        e.preventDefault();
        if (!this.enabled) return;
        this.down[pad].add(a);
        this.buffer[pad].push({ action: a, frame: this.frame });
      }
    });
    addEventListener('keyup', (e) => {
      for (const pad of ['p1', 'p2']) {
        const a = LAYOUTS[pad][e.code];
        if (a) this.down[pad].delete(a);
      }
    });
    addEventListener('blur', () => {
      this.down.p1.clear();
      this.down.p2.clear();
    });
  }

  tick(frame) {
    this.frame = frame;
    for (const pad of ['p1', 'p2']) {
      this.buffer[pad] = this.buffer[pad].filter((e) => frame - e.frame <= BUFFER_FRAMES);
    }
  }

  held(pad, action) { return this.down[pad].has(action); }

  /** Claim a buffered press. Claiming removes it so it cannot fire twice. */
  take(pad, action) {
    const i = this.buffer[pad].findIndex((e) => e.action === action);
    if (i < 0) return false;
    this.buffer[pad].splice(i, 1);
    return true;
  }

  axis(pad) {
    return (this.held(pad, 'right') ? 1 : 0) - (this.held(pad, 'left') ? 1 : 0);
  }

  clear(pad) { this.buffer[pad].length = 0; }
}

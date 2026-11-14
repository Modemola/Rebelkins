/**
 * Input with a buffer.
 *
 * Pressing attack one frame before recovery ends should still come out; a
 * fighter that drops those inputs feels broken even when it is behaving exactly
 * as written. Every press is stamped with the frame it arrived on and stays
 * claimable for a short window.
 *
 * A key and a thumb arrive by the same door. `press` and `release` are the
 * whole input surface and the keyboard is one caller of them, so the on-screen
 * pad gets the buffer, the held state and the blur handling for free rather
 * than growing a second, subtly different copy of them. A touch that drops a
 * buffered special is the same bug as a key that does, and there is only one
 * place for it to be.
 */

const BUFFER_FRAMES = 6;
/**
 * How close two taps of the same direction must be to count as a dash.
 *
 * Twelve frames is a fifth of a second. Shorter and it will not fire for
 * anyone using a phone, where a tap is a finger landing and lifting rather
 * than a key going down; longer and walking back and forth turns into
 * dashing you did not ask for.
 */
const DOUBLE_TAP_FRAMES = 12;

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
    this.lastPress = { p1: {}, p2: {} };
    this.doubled = { p1: {}, p2: {} };
    this.frame = 0;
    this.enabled = true;

    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      for (const pad of ['p1', 'p2']) {
        const a = LAYOUTS[pad][e.code];
        if (!a) continue;
        e.preventDefault();
        this.press(pad, a);
      }
    });
    addEventListener('keyup', (e) => {
      for (const pad of ['p1', 'p2']) {
        const a = LAYOUTS[pad][e.code];
        if (a) this.release(pad, a);
      }
    });
    addEventListener('blur', () => {
      this.down.p1.clear();
      this.down.p2.clear();
    });
  }

  /** A button went down, from whatever pressed it. */
  press(pad, action) {
    if (!this.enabled) return;
    // A second press of the same direction inside the window is a dash. Held
    // separately from the buffer, which expires in six frames and is emptied
    // by whoever claims it first -- a dash has to survive both.
    const last = this.lastPress[pad][action];
    if (last !== undefined && this.frame - last <= DOUBLE_TAP_FRAMES) {
      this.doubled[pad][action] = this.frame;
    }
    this.lastPress[pad][action] = this.frame;
    this.down[pad].add(action);
    this.buffer[pad].push({ action, frame: this.frame });
  }

  /**
   * Claim a double tap. Claiming removes it, so one flick of the stick
   * cannot start two dashes.
   */
  takeDouble(pad, action) {
    const at = this.doubled[pad][action];
    if (at === undefined || this.frame - at > BUFFER_FRAMES) return false;
    delete this.doubled[pad][action];
    return true;
  }

  /**
   * A button came up. Not guarded by `enabled`: a release has to land even
   * when input is off, or a button held across the moment the match takes
   * input away stays down forever and the fighter walks into the wall.
   */
  release(pad, action) { this.down[pad].delete(action); }

  /**
   * Wire an element to an action for as long as a finger is on it.
   *
   * Pointer events rather than touch events, so the same pad works under a
   * mouse for anyone testing on a desktop. The capture is what makes two
   * thumbs work: without it a finger that slides a few pixels off the button
   * mid-combo fires a leave on the element and the button sticks down.
   */
  bind(el, pad, action) {
    const down = (e) => {
      e.preventDefault();
      el.setPointerCapture?.(e.pointerId);
      el.classList.add('on');
      this.press(pad, action);
    };
    const up = (e) => {
      e.preventDefault();
      el.classList.remove('on');
      this.release(pad, action);
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
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

  clear(pad) {
    this.buffer[pad].length = 0;
    this.lastPress[pad] = {};
    this.doubled[pad] = {};
  }
}

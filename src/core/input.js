/** Keyboard + pointer. One place, so rebinding is a data change. */

export const BINDINGS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  blend: ['ShiftLeft', 'ShiftRight'],
  dash: ['Space'],
  interact: ['KeyE'],
  ability: ['KeyQ'],
  mark: ['KeyF'],
  styleBreak: ['KeyR'],
  threadA: ['KeyZ'],
  threadB: ['KeyX'],
  threadC: ['KeyC'],
  kin1: ['Digit1'],
  kin2: ['Digit2'],
  kin3: ['Digit3'],
  kin4: ['Digit4'],
  pause: ['Escape'],
};

const ACTION_BY_CODE = new Map();
for (const [action, codes] of Object.entries(BINDINGS)) {
  for (const c of codes) ACTION_BY_CODE.set(c, action);
}

export class Input {
  constructor(target = window) {
    this.down = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.pointer = { x: 0, y: 0, down: false, clicked: false, wheel: 0 };
    this._onKeyDown = (e) => {
      const action = ACTION_BY_CODE.get(e.code);
      if (action) {
        e.preventDefault();
        if (!this.down.has(action)) this.pressed.add(action);
        this.down.add(action);
      }
      this.lastKey = e.code;
    };
    this._onKeyUp = (e) => {
      const action = ACTION_BY_CODE.get(e.code);
      if (action) {
        this.down.delete(action);
        this.released.add(action);
      }
    };
    this._onBlur = () => { this.down.clear(); };
    target.addEventListener('keydown', this._onKeyDown);
    target.addEventListener('keyup', this._onKeyUp);
    target.addEventListener('blur', this._onBlur);
  }

  attachPointer(canvas) {
    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      this.pointer.x = (e.clientX - r.left) * (canvas.width / r.width);
      this.pointer.y = (e.clientY - r.top) * (canvas.height / r.height);
    };
    canvas.addEventListener('mousemove', pos);
    canvas.addEventListener('mousedown', (e) => { pos(e); this.pointer.down = true; });
    window.addEventListener('mouseup', () => { this.pointer.down = false; });
    canvas.addEventListener('click', (e) => { pos(e); this.pointer.clicked = true; });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.pointer.wheel += e.deltaY;
    }, { passive: false });
  }

  isDown(action) { return this.down.has(action); }
  justPressed(action) { return this.pressed.has(action); }
  justReleased(action) { return this.released.has(action); }

  /** Normalised movement vector, analogue-shaped so diagonals are not faster. */
  axis() {
    let x = (this.isDown('right') ? 1 : 0) - (this.isDown('left') ? 1 : 0);
    let y = (this.isDown('down') ? 1 : 0) - (this.isDown('up') ? 1 : 0);
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y, len: Math.min(len, 1) };
  }

  endFrame() {
    this.pressed.clear();
    this.released.clear();
    this.pointer.clicked = false;
    this.pointer.wheel = 0;
  }
}

/** Fixed-ish game loop with a capped delta, plus a tiny scene stack. */

export class Game {
  constructor(canvas, input) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = input;
    this.scene = null;
    this.next = null;
    this.time = 0;
    this.shared = {};
    this._last = 0;
    this._raf = null;
  }

  setScene(scene) {
    this.next = scene;
  }

  start(scene) {
    this.next = scene;
    this._last = performance.now();
    const step = (now) => {
      this._raf = requestAnimationFrame(step);
      let dt = (now - this._last) / 1000;
      this._last = now;
      if (dt > 0.05) dt = 0.05; // a tabbed-out second must not teleport anyone
      this.time += dt;

      if (this.next) {
        if (this.scene && this.scene.exit) this.scene.exit();
        this.scene = this.next;
        this.next = null;
        if (this.scene.enter) this.scene.enter(this);
      }
      if (this.scene) {
        this.scene.update(dt, this);
        this.scene.draw(this.ctx, this);
      }
      this.input.endFrame();
    };
    this._raf = requestAnimationFrame(step);
  }

  get w() { return this.canvas.width; }
  get h() { return this.canvas.height; }
}

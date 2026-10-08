/**
 * Fixed-timestep simulation, decoupled from rendering.
 *
 * A fighter cannot run on variable delta. Startup, active and recovery are
 * counted in frames, and two players must get the same result from the same
 * inputs regardless of what the display is doing. So the simulation always
 * advances in whole 1/60s ticks and the renderer draws whatever the latest
 * tick produced.
 */

export const TICK = 1 / 60;
const MAX_CATCHUP = 5; // a backgrounded tab must not simulate a lost minute

export class Loop {
  constructor({ update, render }) {
    this.update = update;
    this.render = render;
    this.acc = 0;
    this.frame = 0;
    this.running = false;
    this.fps = 60;
    this._fpsAcc = 0;
    this._fpsCount = 0;
  }

  start() {
    this.running = true;
    this.last = performance.now();
    const step = (now) => {
      if (!this.running) return;
      requestAnimationFrame(step);
      const dt = Math.min(0.25, (now - this.last) / 1000);
      this.last = now;

      this._fpsAcc += dt;
      this._fpsCount++;
      if (this._fpsAcc >= 0.5) {
        this.fps = Math.round(this._fpsCount / this._fpsAcc);
        this._fpsAcc = 0;
        this._fpsCount = 0;
      }

      this.acc += dt;
      let ticks = 0;
      while (this.acc >= TICK && ticks < MAX_CATCHUP) {
        this.update(this.frame++);
        this.acc -= TICK;
        ticks++;
      }
      if (ticks === MAX_CATCHUP) this.acc = 0;
      this.render(this.acc / TICK, dt);
    };
    requestAnimationFrame(step);
  }

  stop() { this.running = false; }
}

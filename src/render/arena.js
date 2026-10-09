/**
 * The places the fights happen.
 *
 * A gradient behind two characters reads as a tech demo, however good the
 * characters are. What makes a stage feel like somewhere is not detail, it is
 * *depth and reaction*: layers that move against each other as the camera
 * tracks, air with something in it, light that comes from a place you can
 * point at, and a crowd that answers what just happened.
 *
 * Everything static is painted once into offscreen layers on resize and
 * blitted thereafter -- the whole backdrop costs three drawImage calls a frame.
 * Only the crowd, the weather and the lights are live, and all three are
 * bounded pools.
 *
 * Layer order, back to front:
 *   sky        baked, fixed
 *   far        baked, parallax 0.06   skyline / structure, hazed toward the sky
 *   mid        baked, parallax 0.18   the built environment the crowd sits on
 *   crowd      live,  parallax 0.34   silhouettes, bobbing, reacting
 *   near       baked, parallax 0.50   barriers, rails, the lip of the arena
 *   [floor, reflections, fighters, fx -- drawn by main.js in world space]
 *   weather    live,  full parallax   rain / embers / dust
 *   fore       baked, parallax 0.92   out-of-focus silhouettes at the edges
 */

/** Deterministic noise, so a layer paints the same on every resize. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const lerp = (a, b, t) => a + (b - a) * t;

/** #rrggbb -> rgba(), so palette colours can be used at an alpha. */
function rgba(hex, a) {
  const p = [1, 3, 5].map((i) => parseInt(hex.substr(i, 2), 16));
  return `rgba(${p[0]},${p[1]},${p[2]},${a})`;
}

/** Mix two #rrggbb colours. Used for atmospheric haze: distance fades to sky. */
function mix(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.substr(i, 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.substr(i, 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(lerp(v, pb[i], t))).join(',')})`;
}

/* ------------------------------------------------------------------ arenas */

export const ARENAS = [
  {
    id: 'towers',
    name: 'NINE TOWERS',
    blurb: 'Rain on a rooftop, above the stacks',
    sky: ['#070c17', '#0d1627', '#1b2c45'],
    haze: '#1b2c45',
    key: '#cfe6ff',
    rim: '#52d8ef',
    accent: '#ff4d6d',
    floor: ['#141b28', '#070a11'],
    glow: 'rgba(82,216,239,.30)',
    weather: 'rain',
    beams: { count: 2, colour: '#8fd8ff', rate: 0.17 },
    crowd: { rows: 3, tint: '#060a12', lit: '#2a4a68', density: 1 },
    far: 'skyline',
    mid: 'rooftops',
    near: 'railing',
  },
  {
    id: 'cut',
    name: 'THE CUT',
    blurb: 'Sodium light under the overpass',
    sky: ['#140d08', '#1d1309', '#2b1d0d'],
    haze: '#2b1d0d',
    key: '#ffc46b',
    rim: '#ff9a3c',
    accent: '#8ef06a',
    floor: ['#241a11', '#0d0906'],
    glow: 'rgba(255,170,70,.34)',
    weather: 'dust',
    crowd: { rows: 4, tint: '#0a0705', lit: '#6b4a1f', density: 1.25 },
    far: 'pillars',
    mid: 'fence',
    near: 'barrier',
  },
  {
    id: 'bloom',
    name: 'BLOOM HALL',
    blurb: 'A packed room and too many screens',
    sky: ['#0d0518', '#150722', '#1f0c30'],
    haze: '#2a1040',
    key: '#ffd9f2',
    rim: '#c060ff',
    accent: '#f5c518',
    floor: ['#241433', '#0b0612'],
    glow: 'rgba(192,96,255,.34)',
    weather: 'confetti',
    // Two beams and the same crowd as the others. This room reads as the
    // fullest of the three from its six-step seating bank, not from carrying
    // thirty more silhouettes and a third sweeping light -- and it was the
    // only arena sitting on the frame budget.
    beams: { count: 2, colour: '#e0a0ff', rate: 0.34 },
    crowd: { rows: 5, tint: '#0b0613', lit: '#5a2a7a', density: 1.0 },
    far: 'screens',
    mid: 'tiers',
    near: 'rail',
  },
];

/* ------------------------------------------------- static layer painters */

/**
 * Trim a baked layer to the rows that actually have paint in them.
 *
 * A skyline occupies the middle of the frame and a railing a tenth of it, but
 * both were being blitted at full screen height every frame. Compositing is
 * the whole cost of this backdrop -- the JavaScript measures at half a
 * millisecond -- so what matters is how many pixels get touched, not how many
 * draw calls make it happen.
 */
function crop(c) {
  const g = c.getContext('2d');
  const { width: w, height: h } = c;
  const d = g.getImageData(0, 0, w, h).data;
  let y0 = h; let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x += 3) {
      if (d[(y * w + x) * 4 + 3] > 2) { if (y < y0) y0 = y; y1 = y; break; }
    }
  }
  if (y1 < 0) return { img: c, y: 0, h: 0 };
  const out = layer(w, y1 - y0 + 1);
  out.getContext('2d').drawImage(c, 0, -y0);
  return { img: out, y: y0, h: y1 - y0 + 1 };
}

function layer(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** Far: a city at distance. Haze is what sells the distance, not detail. */
function paintSkyline(cx, w, h, def, rand) {
  const base = h * 0.78;

  // Light pollution on the horizon. Without it the upper half of the frame is
  // flat black and the city looks pasted onto nothing.
  const glow = cx.createLinearGradient(0, base - h * 0.42, 0, base);
  glow.addColorStop(0, 'rgba(0,0,0,0)');
  glow.addColorStop(1, mix(def.sky[2], '#4a6fa5', 0.45).replace('rgb', 'rgba').replace(')', ',.5)'));
  cx.fillStyle = glow;
  cx.fillRect(0, base - h * 0.42, w, h * 0.42);

  // A few towers that break the skyline, so the top of the shot has something
  // in it at the camera's jumping height.
  for (let i = 0; i < 7; i++) {
    const x = rand() * w;
    const tw = 30 + rand() * 46;
    const th = h * (0.34 + rand() * 0.26);
    cx.fillStyle = mix(def.sky[1], def.haze, 0.5);
    cx.fillRect(x, base - th, tw, th);
    cx.fillStyle = 'rgba(255,80,90,.55)';            // aircraft warning light
    cx.fillRect(x + tw / 2 - 1.5, base - th - 4, 3, 3);
  }

  for (let band = 0; band < 3; band++) {
    const depth = 1 - band * 0.36;            // 1 = furthest
    const tint = mix(def.sky[2], '#000000', 0.18 + band * 0.2);
    const top = base - h * (0.16 + band * 0.10);
    let x = -40;
    while (x < w + 40) {
      const bw = 26 + rand() * 78;
      const bh = (0.4 + rand() * 0.75) * (base - top);
      cx.fillStyle = mix(tint, def.haze, depth * 0.55);
      cx.fillRect(x, base - bh, bw, bh + 10);
      // windows: a few lit cells, brighter on the nearer bands
      const cols = Math.max(1, Math.floor(bw / 9));
      const rows = Math.max(1, Math.floor(bh / 13));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (rand() > 0.16 + band * 0.07) continue;
          cx.fillStyle = `rgba(${200 + rand() * 55 | 0},${190 + rand() * 50 | 0},150,${(0.10 + rand() * 0.3) * (1 - depth * 0.5)})`;
          cx.fillRect(x + 3 + c * 9, base - bh + 5 + r * 13, 4, 6);
        }
      }
      x += bw + 4 + rand() * 16;
    }
  }
}

/** Far: the concrete legs of an overpass, receding. */
function paintPillars(cx, w, h, def, rand) {
  const base = h * 0.84;
  for (let band = 0; band < 2; band++) {
    const depth = 1 - band * 0.5;
    const top = h * (0.08 + band * 0.1);
    const gap = 180 - band * 54;
    for (let x = -60 + band * 40; x < w + 60; x += gap) {
      const pw = 46 - band * 12;
      cx.fillStyle = mix('#3a2a18', def.haze, depth * 0.6);
      cx.fillRect(x, top, pw, base - top);
      cx.fillStyle = mix('#5a4228', def.haze, depth * 0.62);
      cx.fillRect(x, top, pw * 0.3, base - top);          // lit edge
    }
    // the deck they carry
    cx.fillStyle = mix('#2e2114', def.haze, depth * 0.5);
    cx.fillRect(0, top - 26, w, 30);
    cx.fillStyle = `rgba(0,0,0,${0.3 - band * 0.12})`;
    cx.fillRect(0, top + 4, w, 10);
  }
  // sodium lamps slung under the deck
  for (let x = 90; x < w; x += 260) {
    const g = cx.createRadialGradient(x, h * 0.2, 4, x, h * 0.2, 170);
    g.addColorStop(0, 'rgba(255,196,107,.5)');
    g.addColorStop(1, 'rgba(255,196,107,0)');
    cx.fillStyle = g;
    cx.fillRect(x - 180, 0, 360, 360);
  }
}

/** Far: a wall of screens, the brightest thing in the room. */
function paintScreens(cx, w, h, def, rand) {
  // No full wall fill here: an opaque rectangle over most of the frame makes
  // the layer uncroppable and costs a whole extra screen of compositing every
  // frame. The sky gradient is already this room's wall; only the ribs and the
  // screens are painted, and they crop to the top half.
  for (let x = 0; x < w; x += 118) {
    cx.fillStyle = 'rgba(0,0,0,.34)';
    cx.fillRect(x, 0, 26, h * 0.56);
  }
  const hues = ['#c060ff', '#f5c518', '#52d8ef', '#ff4d6d'];
  // Kept in the upper third and kept small: at head height and screen-sized
  // they fight the fighters for the eye, and the fighters have to win.
  for (let i = 0; i < 26; i++) {
    const sw = 48 + rand() * 96;
    const sh = sw * (0.4 + rand() * 0.35);
    const x = rand() * (w - sw);
    const y = h * 0.02 + rand() * h * 0.30;
    cx.fillStyle = 'rgba(0,0,0,.55)';
    cx.fillRect(x - 3, y - 3, sw + 6, sh + 6);
    const hue = hues[(rand() * hues.length) | 0];
    const g = cx.createLinearGradient(x, y, x + sw, y + sh);
    g.addColorStop(0, mix(hue, '#000000', 0.48));
    g.addColorStop(1, mix(hue, '#000000', 0.82));
    cx.fillStyle = g;
    cx.fillRect(x, y, sw, sh);
    // scanlines, so a flat rectangle reads as a screen
    cx.fillStyle = 'rgba(0,0,0,.20)';
    for (let yy = y; yy < y + sh; yy += 4) cx.fillRect(x, yy, sw, 2);
    const bloom = cx.createRadialGradient(x + sw / 2, y + sh / 2, 10, x + sw / 2, y + sh / 2, sw);
    bloom.addColorStop(0, `${hue}18`);
    bloom.addColorStop(1, 'rgba(0,0,0,0)');
    cx.fillStyle = bloom;
    cx.fillRect(x - sw, y - sh, sw * 3, sh * 3);
  }
}

/** Mid: the structure the crowd stands on. */
function paintMid(kind, cx, w, h, def, rand) {
  // The camera puts the floor line near 0.88h, so anything the crowd stands on
  // has to finish above that or it draws over the fighters' feet.
  const base = h * 0.86;
  if (kind === 'rooftops') {
    for (let x = -30; x < w + 30; x += 70 + rand() * 60) {
      const bw = 60 + rand() * 90;
      const bh = 50 + rand() * 120;
      cx.fillStyle = mix('#131c2b', def.haze, 0.22);
      cx.fillRect(x, base - bh, bw, bh);
      cx.fillStyle = mix('#1d2a3f', def.haze, 0.18);
      cx.fillRect(x, base - bh, bw, 7);                 // parapet catching light
      if (rand() < 0.4) {                                // water tank
        cx.fillStyle = mix('#0f1724', def.haze, 0.2);
        cx.fillRect(x + bw * 0.3, base - bh - 34, 30, 34);
      }
      if (rand() < 0.5) {                                // a neon sign
        cx.fillStyle = rand() < 0.5 ? def.rim : def.accent;
        cx.globalAlpha = 0.5;
        cx.fillRect(x + 8, base - bh + 16, 4, 30 + rand() * 40);
        cx.globalAlpha = 1;
      }
    }
  } else if (kind === 'fence') {
    cx.fillStyle = mix('#241a11', def.haze, 0.25);
    cx.fillRect(0, base - 150, w, 150);
    cx.strokeStyle = 'rgba(190,170,140,.17)';           // chain-link
    cx.lineWidth = 1;
    for (let x = -150; x < w + 150; x += 13) {
      cx.beginPath(); cx.moveTo(x, base - 150); cx.lineTo(x + 150, base); cx.stroke();
      cx.beginPath(); cx.moveTo(x, base); cx.lineTo(x + 150, base - 150); cx.stroke();
    }
    cx.fillStyle = 'rgba(0,0,0,.35)';
    for (let x = 0; x < w; x += 120) cx.fillRect(x, base - 158, 7, 158);
  } else {
    // tiers: a stepped seating bank, each step lit along its nose
    for (let r = 0; r < 6; r++) {
      const y = base - 26 - r * 26;
      cx.fillStyle = mix('#241437', def.haze, 0.06 + r * 0.09);
      cx.fillRect(0, y, w, 26);
      cx.fillStyle = 'rgba(0,0,0,.42)';
      cx.fillRect(0, y + 22, w, 5);
      cx.fillStyle = 'rgba(192,96,255,.13)';
      cx.fillRect(0, y, w, 2);
    }
  }
}

/** Near: whatever the crowd is leaning on. Drawn in front of them. */
function paintNear(kind, cx, w, h, def, rand) {
  const base = h * 0.885;
  if (kind === 'railing') {
    cx.strokeStyle = 'rgba(10,14,22,.95)';
    cx.lineWidth = 7;
    cx.beginPath(); cx.moveTo(0, base - 54); cx.lineTo(w, base - 60); cx.stroke();
    cx.lineWidth = 5;
    for (let x = 10; x < w; x += 46) {
      cx.beginPath(); cx.moveTo(x, base - 56); cx.lineTo(x + 1, base + 20); cx.stroke();
    }
    cx.strokeStyle = 'rgba(82,216,239,.26)';            // rim light on the top rail
    cx.lineWidth = 2;
    cx.beginPath(); cx.moveTo(0, base - 57); cx.lineTo(w, base - 63); cx.stroke();
  } else if (kind === 'barrier') {
    for (let x = -20; x < w + 40; x += 132) {
      cx.fillStyle = 'rgba(14,10,6,.95)';
      cx.fillRect(x, base - 62, 120, 70);
      cx.fillStyle = 'rgba(255,196,107,.16)';
      cx.fillRect(x, base - 62, 120, 4);
      cx.fillStyle = 'rgba(142,240,106,.14)';           // tag paint
      cx.fillRect(x + 14, base - 46, 42, 10);
    }
  } else {
    cx.fillStyle = 'rgba(11,6,18,.92)';
    cx.fillRect(0, base - 40, w, 60);
    cx.fillStyle = 'rgba(192,96,255,.22)';
    cx.fillRect(0, base - 42, w, 3);
  }
}

/** Foreground: heads and shoulders at the very front, out of focus. */
const FORE_H = 300;   // the strip of screen the foreground can occupy

function paintFore(cx, w, h, def, rand) {
  // Deliberately cropped: only the tops of these heads belong on screen. Any
  // more and they cover the floor the fight is standing on. Baked as a short
  // strip rather than a full screen -- a full-height blit of mostly empty
  // pixels is pure fill cost, four times a frame.
  const base = FORE_H + 120;
  cx.fillStyle = 'rgba(4,3,8,.92)';
  for (let i = 0; i < 6; i++) {
    const x = (i + 0.5) * (w / 6) + (rand() - 0.5) * 120;
    const s = 52 + rand() * 40;
    cx.beginPath();
    cx.arc(x, base - s * 2.1, s * 0.62, 0, Math.PI * 2);
    cx.fill();
    cx.beginPath();
    cx.ellipse(x, base - s * 0.5, s * 1.25, s * 1.5, 0, 0, Math.PI * 2);
    cx.fill();
  }
}

/* ------------------------------------------------------------- the arena */

export class Arena {
  constructor(def) {
    this.def = def;
    this.t = 0;
    this.surge = 0;      // crowd excitement, 0..1, decays
    this.flash = 0;      // backdrop bounce light from an impact
    this.layers = null;
    this.w = 0;
    this.h = 0;
    this.bits = [];      // weather particles
    this.people = [];
  }

  /** Bake every static layer. Called on resize, never per frame. */
  resize(view) {
    if (this.w === view.w && this.h === view.h && this.layers) return;
    this.w = view.w;
    this.h = view.h;
    const d = this.def;
    // Layers are baked wider than the screen so parallax has somewhere to go.
    const W = view.w + 800;
    const H = Math.max(1, view.h);

    const sky = layer(view.w, H);
    const sc = sky.getContext('2d');
    const g = sc.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, d.sky[0]);
    g.addColorStop(0.55, d.sky[1]);
    g.addColorStop(1, d.sky[2]);
    sc.fillStyle = g;
    sc.fillRect(0, 0, view.w, H);

    const farC = layer(W, H);
    const fc = farC.getContext('2d');
    const r1 = rng(11);
    if (d.far === 'skyline') paintSkyline(fc, W, H, d, r1);
    else if (d.far === 'pillars') paintPillars(fc, W, H, d, r1);
    else paintScreens(fc, W, H, d, r1);
    const far = crop(farC);

    const midC = layer(W, H);
    paintMid(d.mid, midC.getContext('2d'), W, H, d, rng(23));
    const mid = crop(midC);

    const nearC = layer(W, H);
    paintNear(d.near, nearC.getContext('2d'), W, H, d, rng(37));
    const near = crop(nearC);

    const foreC = layer(W, FORE_H);
    paintFore(foreC.getContext('2d'), W, FORE_H, d, rng(53));
    const fore = crop(foreC);
    fore.y += H - FORE_H;

    const vig = layer(view.w, H);
    const vc = vig.getContext('2d');
    const v = vc.createRadialGradient(
      view.w / 2, H * 0.5, Math.min(view.w, H) * 0.30,
      view.w / 2, H * 0.52, Math.max(view.w, H) * 0.78,
    );
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,.66)');
    vc.fillStyle = v;
    vc.fillRect(0, 0, view.w, H);
    // The middle of a vignette is transparent, and compositing transparent
    // pixels still costs. Punch the clear centre out so the blit only touches
    // the edges it actually darkens.
    vc.globalCompositeOperation = 'destination-out';
    const hole = vc.createRadialGradient(
      view.w / 2, H * 0.5, 0,
      view.w / 2, H * 0.5, Math.min(view.w, H) * 0.34,
    );
    hole.addColorStop(0, 'rgba(0,0,0,1)');
    hole.addColorStop(1, 'rgba(0,0,0,0)');
    vc.fillStyle = hole;
    vc.fillRect(0, 0, view.w, H);

    this.layers = { sky, far, mid, near, fore, vig, W, H };
    this.seedCrowd();
    this.seedWeather();
  }

  /**
   * The crowd. Rows of silhouettes with their own bob phase and height, so the
   * band never pulses as one animal. They stand up when the fight does.
   */
  seedCrowd() {
    const { rows, density } = this.def.crowd;
    const rand = rng(67);
    this.people = [];
    // Bounded on purpose. Five hundred silhouettes do not read as five hundred
    // people, they read as a texture, and they cost the frame.
    const total = Math.min(190, Math.round(130 * density));
    const perRow = Math.ceil(total / rows);
    for (let r = 0; r < rows; r++) {
      for (let i = 0; i < perRow; i++) {
        this.people.push({
          x: (i + rand() * 0.9) * (this.w + 700) / perRow - 350,
          row: r,
          s: 0.72 + rand() * 0.5,
          phase: rand() * Math.PI * 2,
          rate: 0.7 + rand() * 0.9,
          lift: rand(),           // how readily this one comes to their feet
        });
      }
    }
    this.bakeCrowdSprites();
  }

  /**
   * One sprite per row per posture. A person is five path fills; a hundred and
   * ninety of them, twice over for arms-up, was most of a frame on its own.
   * Drawn once here, blitted thereafter.
   */
  bakeCrowdSprites() {
    const d = this.def.crowd;
    const S = 64;                       // sprite box; people are drawn at ~0.5x
    this.sprites = [];
    for (let r = 0; r < d.rows; r++) {
      const depth = r / Math.max(1, d.rows - 1);
      const tint = mix(d.tint, this.def.haze, depth * 0.45);
      const row = [];
      for (const cheering of [false, true]) {
        const c = layer(S, S);
        const g = c.getContext('2d');
        const cx = S / 2;
        const cy = S - 6;
        g.fillStyle = tint;
        g.beginPath();
        g.ellipse(cx, cy - 6, 18, 26, 0, 0, Math.PI * 2);      // shoulders
        g.fill();
        g.beginPath();
        g.arc(cx, cy - 30, 11, 0, Math.PI * 2);                 // head
        g.fill();
        if (cheering) {
          g.strokeStyle = tint;
          g.lineWidth = 6.4;
          g.beginPath();
          g.moveTo(cx - 12, cy - 12);
          g.lineTo(cx - 20, cy - 48);
          g.moveTo(cx + 12, cy - 12);
          g.lineTo(cx + 20, cy - 48);
          g.stroke();
        }
        g.globalAlpha = 0.30 * (1 - depth * 0.5);
        g.fillStyle = d.lit;
        g.beginPath();
        g.arc(cx - 3, cy - 34, 4.8, 0, Math.PI * 2);            // key light
        g.fill();
        row.push(c);
      }
      this.sprites.push(row);
    }
  }

  seedWeather() {
    const rand = rng(89);
    // Rain is the dearest weather: every drop is a thin diagonal stroke across
    // the full height of the frame, and thin lines are expensive to rasterise.
    // A hundred reads the same as two hundred once it is moving.
    const n = this.def.weather === 'rain' ? 100 : this.def.weather === 'dust' ? 90 : 70;
    this.bits = [];
    for (let i = 0; i < n; i++) {
      this.bits.push({
        x: rand() * (this.w + 200) - 100,
        y: rand() * this.h,
        v: 0.4 + rand() * 0.9,
        s: 0.4 + rand() * 0.9,
        p: rand() * Math.PI * 2,
        hue: rand(),
      });
    }
  }

  /** The arena answers the fight. */
  hit(power) {
    this.surge = Math.min(1, this.surge + 0.25 + power * 0.5);
    this.flash = Math.min(1, this.flash + 0.3 + power * 0.6);
  }

  ko() { this.surge = 1; this.flash = 1; }

  update(dt) {
    this.t += dt;
    this.surge *= 1 - Math.min(1, dt * 1.1);
    this.flash *= 1 - Math.min(1, dt * 5.5);
    const fall = this.def.weather === 'rain' ? 1700 : this.def.weather === 'dust' ? 90 : 220;
    const drift = this.def.weather === 'rain' ? 180 : 60;
    for (const b of this.bits) {
      b.y += fall * b.v * dt;
      b.x += Math.sin(this.t * 0.6 + b.p) * drift * dt * (this.def.weather === 'rain' ? 1 : 2);
      if (b.y > this.h + 20) { b.y = -20; b.x = Math.random() * (this.w + 200) - 100; }
      if (b.x < -120) b.x += this.w + 220;
      if (b.x > this.w + 120) b.x -= this.w + 220;
    }
  }

  /** Blit one baked layer at its parallax offset. */
  /** Blit a cropped layer at its parallax offset, touching only its own rows. */
  blit(ctx, L, cam, factor) {
    if (!L.h) return;
    ctx.drawImage(L.img, -400 - cam.x * factor * 0.1, L.y);
  }

  drawBack(ctx, view, cam, dpr) {
    this.resize(view);
    const L = this.layers;
    const d = this.def;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(L.sky, 0, 0);

    this.blit(ctx, L.far, cam, 0.6);
    this.drawBeams(ctx, view);
    this.blit(ctx, L.mid, cam, 1.8);
    this.drawCrowd(ctx, view, cam);
    this.blit(ctx, L.near, cam, 5.0);

    // Impact bounce: the backdrop catches light from the hit, which is what
    // makes the stage feel like it is in the same room as the fight.
    if (this.flash > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = this.flash * 0.34;
      ctx.fillStyle = d.glow;
      // Only the backdrop catches it. The floor is covered by the world-space
      // pass a moment later anyway, so lighting it is a quarter of a screen of
      // compositing thrown away.
      ctx.fillRect(0, 0, view.w, view.h * 0.74);
      ctx.restore();
    }
  }

  /**
   * Searchlights. A static night sky reads as a painted backdrop however much
   * detail is in it; two slow beams are the cheapest motion that fixes that,
   * and they sweep faster when the crowd is up.
   */
  drawBeams(ctx, view) {
    const b = this.def.beams;
    if (!b) return;
    const origin = this.h * 0.88;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < b.count; i++) {
      const sweep = Math.sin(this.t * b.rate * (1 + this.surge) + i * 2.2);
      const a = -Math.PI / 2 + sweep * 0.62;
      const ox = view.w * (0.5 + (i - (b.count - 1) / 2) * 0.33);
      const len = this.h * 1.35;
      const spread = 0.035 + this.surge * 0.01;
      // Built once pointing straight up, then the canvas is rotated under it.
      if (!this._beamGrad) {
        const g = ctx.createLinearGradient(0, 0, 0, -len);
        g.addColorStop(0, rgba(b.colour, 1));
        g.addColorStop(1, rgba(b.colour, 0));
        this._beamGrad = g;
      }
      ctx.save();
      ctx.globalAlpha = 0.16 + this.surge * 0.10;
      ctx.translate(ox, origin);
      ctx.rotate(a + Math.PI / 2);
      ctx.fillStyle = this._beamGrad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-Math.sin(-spread) * len, -Math.cos(-spread) * len);
      ctx.lineTo(-Math.sin(spread) * len, -Math.cos(spread) * len);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  /** The gradient that sinks the wet-floor reflection, in this arena's colour. */
  reflectionFade(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, 420);
    g.addColorStop(0, rgba(this.def.floor[1], 0));
    g.addColorStop(1, rgba(this.def.floor[1], 1));
    return g;
  }

  drawCrowd(ctx, view, cam) {
    const d = this.def.crowd;
    const base = this.h * 0.862;
    const off = -350 - cam.x * 0.34 * 0.1;
    const surge = this.surge;
    const cheering = surge > 0.35;
    for (const p of this.people) {
      const x = p.x + off;
      if (x < -50 || x > view.w + 50) continue;
      const depth = p.row / Math.max(1, this.def.crowd.rows - 1);
      const bob = Math.sin(this.t * p.rate * 2 + p.phase) * 3
        + surge * p.lift * (10 + Math.sin(this.t * 9 + p.phase) * 7);
      const s = p.s * (1 - depth * 0.16) * 0.52;
      const sprite = this.sprites[p.row][cheering && p.lift > 0.45 ? 1 : 0];
      const w = sprite.width * s;
      const hh = sprite.height * s;
      ctx.drawImage(sprite, x - w / 2, base - p.row * 19 - bob - hh + 6 * s, w, hh);
    }
  }

  /** World-space floor, drawn under the fighters. */
  drawFloor(ctx, cam) {
    const d = this.def;
    const halfW = 3000;
    if (!this._floorGrad) {
      const g = ctx.createLinearGradient(0, 0, 0, 520);
      g.addColorStop(0, d.floor[0]);
      g.addColorStop(1, d.floor[1]);
      this._floorGrad = g;
    }
    ctx.fillStyle = this._floorGrad;
    ctx.fillRect(-halfW, 0, halfW * 2, 520);

    // Pools of light the fighters stand in, swinging very slowly. The gradient
    // is built once at the origin and the canvas is moved under it -- five
    // createRadialGradient calls a frame is a measurable slice of 16ms.
    if (!this._poolGrad) {
      const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 460);
      g.addColorStop(0, d.glow);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      this._poolGrad = g;
    }
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = this._poolGrad;
    for (let i = -2; i <= 2; i++) {
      const cx = i * 520 + Math.sin(this.t * 0.25 + i) * 40;
      ctx.save();
      ctx.translate(cx, 0);
      ctx.beginPath();
      ctx.ellipse(0, 60, 420, 150, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    ctx.strokeStyle = d.glow;
    ctx.lineWidth = 2 / cam.zoom;
    ctx.beginPath();
    ctx.moveTo(-halfW, 0.5);
    ctx.lineTo(halfW, 0.5);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,.035)';
    ctx.lineWidth = 1.5 / cam.zoom;
    for (let x = -2400; x <= 2400; x += 160) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x * 1.45, 460);
      ctx.stroke();
    }
  }

  /** Weather and the out-of-focus foreground, over the fighters. */
  drawFore(ctx, view, cam, dpr) {
    if (!this.layers) return;
    const d = this.def;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.save();
    if (d.weather === 'rain') {
      ctx.strokeStyle = 'rgba(190,220,255,.30)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      for (const b of this.bits) {
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - 5 * b.s, b.y + 20 * b.s);
      }
      ctx.stroke();
    } else if (d.weather === 'dust') {
      ctx.globalCompositeOperation = 'lighter';
      for (const b of this.bits) {
        ctx.fillStyle = `rgba(255,205,140,${0.05 + b.s * 0.12})`;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.s * 1.9, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Flutter without rotation. A save/translate/rotate/restore per piece is
      // four canvas state operations seventy times a frame, and this arena was
      // the only one near the frame budget. Squashing the height by the cosine
      // of the same angle reads as a tumbling square of paper and costs one
      // fillRect.
      for (const b of this.bits) {
        const hue = b.hue < 0.33 ? '192,96,255' : b.hue < 0.66 ? '245,197,24' : '82,216,239';
        ctx.fillStyle = `rgba(${hue},${0.25 + b.s * 0.3})`;
        const spin = Math.abs(Math.cos(this.t * 2.6 + b.p));
        const w = 4.8 * b.s;
        const h = 4.8 * b.s * (0.18 + spin * 0.82);
        ctx.fillRect(b.x - w / 2, b.y - h / 2, w, h);
      }
    }
    ctx.restore();

    this.blit(ctx, this.layers.fore, cam, 9.2);
    ctx.drawImage(this.layers.vig, 0, 0);
  }
}

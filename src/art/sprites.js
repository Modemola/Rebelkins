/**
 * Sprite registry. Loads assets/manifest.json and the plates it points at, then
 * hands the renderer a draw descriptor for whichever plate suits the moment.
 *
 * Everything here is optional and non-blocking. If there is no manifest, or a
 * Kin has no art yet, or an image is still loading, the caller gets null and
 * falls back to the procedural placeholder. The game must never wait on, or
 * break because of, artwork that has not arrived.
 */

const STATE = {
  loaded: false,
  manifest: null,
  images: new Map(),
  /** Kin ids that have at least one usable plate right now. */
  ready: new Set(),
};

const BASE = 'assets/';

/** Local height of the procedural rig, ground to crown. Dropped-in art matches it. */
export const UNIT_HEIGHT = 57.6;

export async function loadSprites() {
  let manifest;
  try {
    const res = await fetch(`${BASE}manifest.json`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(String(res.status));
    manifest = await res.json();
  } catch {
    STATE.loaded = true; // no art yet is a normal state, not a failure
    return STATE;
  }
  STATE.manifest = manifest;

  const jobs = [];
  for (const [kinId, entry] of Object.entries(manifest.kin || {})) {
    for (const plate of Object.values(entry.plates)) {
      for (const p of Array.isArray(plate) ? plate : [plate]) {
        if (STATE.images.has(p.file)) continue;
        STATE.images.set(p.file, null);
        jobs.push(loadImage(p.file).then((img) => {
          if (img) {
            STATE.images.set(p.file, img);
            STATE.ready.add(kinId);
          }
        }));
      }
    }
  }
  await Promise.all(jobs);
  STATE.loaded = true;
  return STATE;
}

function loadImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      console.warn(`[sprites] missing ${file} — using placeholder art`);
      resolve(null);
    };
    img.src = BASE + file;
  });
}

export function hasArt(kinId) {
  return STATE.ready.has(kinId);
}

export function artSummary() {
  if (!STATE.manifest) return [];
  return Object.entries(STATE.manifest.kin).map(([id, e]) => ({
    id, plates: Object.keys(e.plates), ready: STATE.ready.has(id),
  }));
}

function resolve(file) {
  const img = STATE.images.get(file);
  return img && img.complete && img.naturalWidth ? img : null;
}

/**
 * Choose a plate for the current moment and return everything needed to draw it.
 *
 * @param kinId  roster id
 * @param o      { facing, moving, phase, mode }
 *               mode: 'world' (default) | 'runway' | 'portrait'
 * @returns {null|{img, sx, sy, sw, sh, ax, ay, flip, heightMul}}
 */
export function pickPlate(kinId, o = {}) {
  const entry = STATE.manifest?.kin?.[kinId];
  if (!entry) return null;
  const P = entry.plates;
  const mode = o.mode || 'world';

  let chosen = null;
  let flip = false;

  if (mode === 'portrait') {
    chosen = pick(P.portrait) || pick(P.front) || anyPlate(P);
  } else if (mode === 'runway') {
    chosen = pick(P.runway) || pick(P.front) || anyPlate(P);
  } else {
    const facing = o.facing ?? Math.PI / 2;
    const toward = Math.sin(facing);   // +1 walking at the camera, -1 away
    const lateral = Math.cos(facing);

    // A side plate only earns the frame when the Kin is actually side-on.
    if (Math.abs(toward) < 0.4 && P.side) {
      chosen = pick(P.side);
      flip = lateral < 0;
    } else if (toward < -0.4 && P.back) {
      chosen = pick(P.back);
    }

    if (!chosen && (o.moving ?? 0) > 0.12 && Array.isArray(P.walk) && P.walk.length) {
      const f = Math.floor(((o.phase ?? 0) / Math.PI) % P.walk.length);
      chosen = resolveEntry(P.walk[(f + P.walk.length) % P.walk.length]);
      flip = lateral < 0 && Math.abs(toward) < 0.4;
    }
    if (!chosen) chosen = pick(P.front) || anyPlate(P);
  }

  if (!chosen) return null;
  return { ...chosen, flip, heightMul: entry.height ?? 1 };
}

function pick(plate) {
  if (!plate) return null;
  return resolveEntry(Array.isArray(plate) ? plate[0] : plate);
}

function resolveEntry(p) {
  if (!p) return null;
  const img = resolve(p.file);
  return img ? { img, sx: p.sx, sy: p.sy, sw: p.sw, sh: p.sh, ax: p.ax, ay: p.ay } : null;
}

function anyPlate(P) {
  for (const plate of Object.values(P)) {
    const got = pick(plate);
    if (got) return got;
  }
  return null;
}

/**
 * Draw a chosen plate so its ground line lands on (x, y) and its height matches
 * what the procedural renderer would have produced at the same `scale`.
 */
export function drawPlate(ctx, plate, x, y, scale, opts = {}) {
  const targetH = UNIT_HEIGHT * scale * plate.heightMul;
  const k = targetH / plate.sh;
  const dw = plate.sw * k;
  const dh = targetH;
  const dx = -plate.ax * dw;
  const dy = -plate.ay * dh;

  ctx.save();
  ctx.translate(x, y);
  if (opts.lean) ctx.rotate(opts.lean);
  if (plate.flip) ctx.scale(-1, 1);
  if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;
  if (opts.glow) {
    ctx.shadowColor = opts.glow;
    ctx.shadowBlur = opts.glowBlur ?? 24;
  }
  ctx.drawImage(plate.img, plate.sx, plate.sy, plate.sw, plate.sh, dx, dy, dw, dh);
  ctx.restore();
}

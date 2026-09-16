/**
 * DISTRICT COMPILER.
 *
 * Authoring happens in metres with the street kit; the runtime wants pixels,
 * walls and zones. This is the one place that translation lives, so a district
 * file reads like the architecture document rather than like a collision mesh.
 *
 * It also enforces the parts of the law that are structural rather than
 * decorative: stalls become collision unless they are walkable, hoodie tunnels
 * become camera-blind volumes, shop interiors become zones, and every district
 * gets a lane set or fails the verifier.
 */

import { m, PPM, LAYER } from './units.js';
import { stallsOnly } from './stalls.js';

const border = (w, h, t = 24) => [
  { x: 0, y: 0, w, h: t, kind: 'edge' },
  { x: 0, y: h - t, w, h: t, kind: 'edge' },
  { x: 0, y: 0, w: t, h, kind: 'edge' },
  { x: w - t, y: 0, w: t, h, kind: 'edge' },
];

export function compileDistrict(spec) {
  const world = { w: m(spec.widthM), h: m(spec.depthM) };
  const decor = [];
  const walls = spec.edges === false ? [] : border(world.w, world.h);
  const zones = [];
  const cameras = [];
  const props = [];
  const blinds = [];   // volumes where cameras lose lock
  const stalls = [];

  /* ---- terraces: the ground is not flat, and the steps must be visible */
  const terraces = (spec.terraces || []).map((t) => ({
    id: t.id,
    name: t.name,
    y0: m(t.y0), y1: m(t.y1),
    riseM: t.riseM ?? 0,
    // Each step reads as a shallow lift, drawn as an edge rather than a cliff.
    lift: (t.riseM ?? 0) * 6,
    surface: t.surface || 'asphalt',
    note: t.note || null,
  }));

  /* ---- water, voids and other non-walkable ground */
  for (const b of spec.blocks || []) {
    walls.push({ x: m(b.x), y: m(b.y), w: m(b.w), h: m(b.h), kind: b.kind || 'block' });
  }

  /* ---- buildings: facade line becomes collision, interiors become zones */
  for (const row of spec.shopRows || []) {
    for (const shop of row.shops) {
      const enterable = row.enterable?.includes(shop.id);
      // The facade is solid except across the threshold of an enterable shop.
      if (enterable) {
        const doorW = m(2.2);
        const doorX = shop.x + shop.w / 2 - doorW / 2;
        walls.push({ x: shop.x, y: shop.y, w: doorX - shop.x, h: m(0.6), kind: 'facade' });
        walls.push({
          x: doorX + doorW, y: shop.y,
          w: shop.x + shop.w - (doorX + doorW), h: m(0.6), kind: 'facade',
        });
        const depth = m(shop.depthM);
        // Interior depth 6-12 m, never a cardboard box room.
        walls.push({ x: shop.x, y: shop.y, w: m(0.3), h: depth, kind: 'facade' });
        walls.push({ x: shop.x + shop.w - m(0.3), y: shop.y, w: m(0.3), h: depth, kind: 'facade' });
        walls.push({ x: shop.x, y: shop.y + depth, w: shop.w, h: m(0.4), kind: 'facade' });
        zones.push({
          id: shop.id, name: row.interiorName || 'Shop interior',
          rect: { x: shop.x + m(0.3), y: shop.y + m(0.6), w: shop.w - m(0.6), h: depth - m(1) },
          access: row.access ?? 0,
          wants: row.wants || [], rejects: row.rejects || [],
          minDesire: row.minDesire,
          tint: row.tint || 'rgba(120,20,40,0.12)',
          layer: LAYER.CUT,
          interior: row.interiorTint || 'oxblood',
        });
      } else {
        walls.push({ x: shop.x, y: shop.y, w: shop.w, h: m(1.2), kind: 'facade' });
      }
      decor.push({
        kind: 'shopfront', x: shop.x, y: shop.y, w: shop.w,
        heightM: shop.heightM, thresholdM: shop.thresholdM,
        shutter: shop.shutter, hook: shop.hook, enterable: !!enterable,
      });
      // one hanging sample on a hook outside
      decor.push({ kind: 'hook', x: shop.hook.x, y: shop.hook.y });
    }
    cameras.push(...row.cams);
  }

  /* ---- stalls */
  for (const band of spec.stallBands || []) {
    for (const st of stallsOnly(band)) {
      stalls.push(st);
      if (st.walkable) {
        // A hoodie tunnel is a corridor, not a block: you walk in and vanish.
        blinds.push({
          id: st.id, x: st.x, y: st.y, w: st.w, h: st.h,
          reason: 'hoodie tunnel', crouch: st.crouch,
        });
        // its rack walls are solid, its throat is not
        walls.push({ x: st.x, y: st.y, w: m(0.35), h: st.h, kind: 'rack' });
        walls.push({ x: st.x + st.w - m(0.35), y: st.y, w: m(0.35), h: st.h, kind: 'rack' });
      } else {
        walls.push({ x: st.x, y: st.y, w: st.w, h: st.h, kind: 'stall' });
      }
      if (st.rule === 'illegalCompile') {
        props.push({
          id: st.id, kind: 'rack', x: st.x + st.w / 2, y: st.y + st.h + m(0.9),
          label: 'ILLEGAL COMPILE', illegal: true,
          grants: { tags: ['new'], access: 1, duration: 60 },
        });
      }
      if (st.rule === 'spotlight') {
        props.push({
          // In front of the pedestal, not inside it: a prize you cannot walk to
          // is not a prize, and the stall itself is collision.
          id: `${st.id}-prize`, kind: 'objective',
          x: st.x + st.w / 2, y: st.y + st.h + m(1.1), label: 'SAMPLE SNEAKER',
          spotlight: true,
        });
      }
    }
  }

  /* ---- street kit decor passes straight through */
  for (const piece of spec.kit || []) decor.push(piece);
  for (const p of spec.props || []) props.push(p);

  /* ---- scan strips are gameplay, not dressing */
  const scanStrips = (spec.kit || []).filter((k) => k.kind === 'scanStrip');

  cameras.push(...(spec.cameras || []));

  return {
    id: spec.id,
    name: spec.name,
    district: spec.district,
    // Contract metadata rides along so a compiled district is directly
    // offerable in the hub without a second wrapper object.
    type: spec.type || 'Ghost Fit',
    brief: spec.brief || '',
    objectiveText: spec.objectiveText || '',
    targetMinutes: spec.targetMinutes ?? 12,
    payout: spec.payout || { cred: 200, traits: 1 },
    timeLimit: spec.timeLimit ?? null,
    world,
    widthM: spec.widthM,
    depthM: spec.depthM,
    spawn: { x: m(spec.spawn[0]), y: m(spec.spawn[1]) },
    terraces,
    walls,
    zones: [...(spec.zones || []).map(normalizeZone), ...zones],
    cameras: cameras.map(normalizeCamera),
    guards: (spec.guards || []).map((g) => ({
      ...g,
      path: g.path.map(([x, y]) => ({ x: m(x), y: m(y) })),
      speed: m(g.speedMs ?? 2.4),
      sees: m(g.seesM ?? 10),
    })),
    lanes: spec.lanes || [],
    crowdCount: spec.crowdCount ?? 40,
    stalls,
    blinds,
    scanStrips,
    decor,
    props,
    skyline: spec.skyline || [],
    extraction: spec.extraction
      ? {
        x: m(spec.extraction[0]), y: m(spec.extraction[1]),
        w: m(spec.extraction[2]), h: m(spec.extraction[3]),
        walkM: spec.extractionWalkM ?? null,
      }
      : null,
    objectives: spec.objectives || [],
    tips: spec.tips || [],
    sound: spec.sound || [],
    light: spec.light || {},
  };
}

function normalizeZone(z) {
  return {
    ...z,
    rect: { x: m(z.rect[0]), y: m(z.rect[1]), w: m(z.rect[2]), h: m(z.rect[3]) },
    door: z.door
      ? { x: m(z.door[0]), y: m(z.door[1]), w: m(z.door[2]), h: m(z.door[3]), facing: z.door[4] || 'v' }
      : undefined,
  };
}

function normalizeCamera(c) {
  // Street-kit cameras already carry pixel coords; hand-placed ones may not.
  return {
    ...c,
    x: c.x, y: c.y,
    facing: c.facing, arc: c.arc, range: c.range,
    sweep: c.sweep, speed: c.speed,
    heightM: c.heightM ?? 3.4,
    housing: c.housing || 'iron',
  };
}

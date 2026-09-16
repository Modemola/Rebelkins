/**
 * VESTA is authored in metres, never in pixels.
 *
 * The architecture law is human-first: sidewalks 4.5-7 m, shopfronts 3.2-4.8 m
 * at ground floor, no 400 m empty roads. You should always be able to touch a
 * wall, a rail, a sleeve, or a camera. None of that survives being typed as
 * arbitrary pixel coordinates, so nothing in the world layer is allowed to.
 */

/** Pixels per metre. A Kin's footprint is ~0.5 m, which is 13 px of collision. */
export const PPM = 26;

export const m = (metres) => metres * PPM;
export const cm = (centimetres) => (centimetres / 100) * PPM;
export const toM = (px) => px / PPM;

/** A rectangle authored in metres. */
export const rect = (x, y, w, h) => ({ x: m(x), y: m(y), w: m(w), h: m(h) });

/**
 * The hard numbers from the architecture document. These are not suggestions --
 * tools/verify-vesta.mjs asserts every one of them against the built world, so
 * a street that drifts out of spec fails a check instead of quietly shipping.
 */
export const LAW = {
  sidewalkWidth: [4.5, 7],
  shopfrontHeight: [3.2, 4.8],
  shopThreshold: [0.7, 1.1],
  shopInteriorDepth: [6, 12],
  kerbHeight: 0.18,
  drainSpacing: [12, 18],
  cameraHeight: 3.4,
  railHeight: 1.1,
  stallAisle: [1.4, 2.2],
  shopfrontRepeat: [7, 9],
  connectorSeconds: [45, 90],
};

/** Vertical layering. Every block has four usable layers. */
export const LAYER = {
  SOLES: 0,    // street, gutters, under-kiosk gaps, sewer lips
  CUT: 1,      // shop interiors, arcades, 1st-floor workshops
  SHOULDER: 2, // balconies, outdoor fitting rooms, hanging sample racks
  COLLAR: 3,   // roof runways, billboard catwalks, drone-laundry lines
};

export const LAYER_NAME = ['Soles', 'Cut', 'Shoulder', 'Collar'];

/**
 * Crowd lanes. Do not sprinkle NPCs -- build lanes. If a space has no obvious
 * place to stand and be seen, it is unfinished.
 */
export const LANE = {
  FAST: 'fast',       // against the shop windows
  SLOW: 'slow',       // under canopies
  POSE: 'pose',       // at every reflective surface
  WORKER: 'worker',   // at service doors
  KINCUT: 'kincut',   // Kin-only cuts through stalls
};

export const LANE_SPEED = {
  fast: [1.5, 1.9],   // m/s
  slow: [0.6, 0.95],
  pose: [0, 0.2],
  worker: [0.8, 1.2],
  kincut: [1.1, 1.5],
};

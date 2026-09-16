/**
 * THREAD — the protocol the whole city runs on.
 *
 * THREAD scans silhouette, color, accessory, stance, species and hair, then
 * assigns you a public identity packet. Everything in VESTA -- cameras, doors,
 * guards, civilians -- reads the packet, never the person. That is the exploit.
 */

/** Tag families a district can want. Matching them is how clothes become access. */
export const TAGS = ['street', 'loud', 'quiet', 'luxury', 'holo', 'folk', 'craft', 'kinetic', 'new'];

/** Illegal compiles: tag pairs THREAD cannot file without tripping an alarm. */
const CLASH_PAIRS = [
  ['loud', 'quiet'],
  ['folk', 'holo'],
];

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Compile a Kin + Thread (+ live run modifiers) into a public identity packet.
 *
 * @param {object} kin    a roster entry
 * @param {object} thread one of that Kin's threads
 * @param {object} ctx    { district, licenses:Set<string>, overlays:Set<string> }
 */
export function compilePacket(kin, thread, ctx = {}) {
  const s = kin.stats;
  const m = thread.mods || {};
  const district = ctx.district || null;
  const licenses = ctx.licenses || new Set();
  const overlays = ctx.overlays || new Set();

  const presence = clamp(s.presence + (m.presence || 0), 0, 12);
  const ignore = clamp(s.ignore + (m.ignore || 0), 0, 12);

  // Desirability: how much the city wants to look at this. Loud colour and
  // accessory count, plus raw presence, minus anything that reads as "safe".
  let desirability = presence * 0.7 + (thread.tags.includes('luxury') ? 2.5 : 0)
    + (thread.tags.includes('holo') ? 2 : 0) + (thread.tags.includes('new') ? 1.5 : 0)
    - (thread.tags.includes('quiet') ? 2 : 0);

  // Taste match: does the district currently want what you are wearing?
  let tasteMatch = 0;
  if (district) {
    for (const tag of thread.tags) {
      if (district.wants.includes(tag)) tasteMatch += 1;
      if (district.rejects.includes(tag)) tasteMatch -= 1;
    }
    desirability += tasteMatch * 1.5;
  }

  // Access is what doors actually check.
  let access = thread.access + (tasteMatch > 0 ? 1 : 0);
  if (licenses.has(`${kin.species}`)) access += 1;
  if (overlays.has('forged-provenance') && thread.tags.includes('luxury')) access += 1;

  const threat = clamp(presence * 0.6 + s.brk * 0.5 - ignore * 0.3, 0, 12);
  const mimic = clamp(s.crowd * 0.8 + (thread.tags.includes('new') ? 2 : 0), 0, 12);

  const clash = findClash(thread.tags, overlays);

  return {
    kinId: kin.id,
    threadId: thread.id,
    tags: [...thread.tags],
    presence,
    ignore,
    access: clamp(access, 0, 4),
    threat: round1(threat),
    desirability: round1(clamp(desirability, 0, 20)),
    mimic: round1(mimic),
    tasteMatch,
    clash,
    /** Multiplier on how fast a camera fills its scan bar on you. */
    scanRate: round2(
      clamp(
        (presence / 5) * (1 - ignore / 14) * (m.scanMul ?? 1),
        0.05,
        4,
      ),
    ),
    moveMul: m.moveMul ?? 1,
    heatMul: m.heatMul ?? 1,
    /** Seconds to recompile out of this Thread. Compile stat pays for itself. */
    compileTime: round2(clamp(4.2 - s.compile * 0.22, 1.2, 4)),
  };
}

function findClash(tags, overlays) {
  if (overlays.has('illegal-compiles')) return null; // you paid for the exemption
  for (const [a, b] of CLASH_PAIRS) {
    if (tags.includes(a) && tags.includes(b)) return `${a}/${b}`;
  }
  return null;
}

/**
 * Does this packet open that door? Returns a verdict object, never a bare bool:
 * the reason is the interesting part, and the HUD prints it.
 */
export function readDoor(packet, zone) {
  if (packet.access < zone.access) {
    return { open: false, reason: `access ${packet.access} / ${zone.access} needed` };
  }
  if (zone.wants && zone.wants.length) {
    const hit = zone.wants.some((t) => packet.tags.includes(t));
    if (!hit) return { open: false, reason: `reads wrong for ${zone.wants.join('/')}` };
  }
  if (zone.rejects && zone.rejects.some((t) => packet.tags.includes(t))) {
    return { open: false, reason: `${zone.rejects.join('/')} does not walk in here` };
  }
  if (zone.minDesire && packet.desirability < zone.minDesire) {
    return { open: false, reason: `unread — desirability ${packet.desirability}/${zone.minDesire}` };
  }
  return { open: true, reason: 'the door believes the jacket' };
}

/** Crowd copy chance per second, per civilian in range. Trendbombs live here. */
export function mimicChance(packet, civ) {
  const appetite = civ.taste === 'copy' ? 1.4 : civ.taste === 'loyal' ? 0.5 : 1;
  return clamp((packet.mimic / 10) * appetite * (packet.desirability / 12), 0, 0.9);
}

const round1 = (v) => Math.round(v * 10) / 10;
const round2 = (v) => Math.round(v * 100) / 100;

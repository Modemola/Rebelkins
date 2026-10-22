/**
 * Keyframe animation.
 *
 * Until this existed, every attack in the game was produced by one of three
 * formulas -- twenty punches shared a single `punchPose`, four kicks a single
 * `kickPose`, six charges a single `chargePose` -- with per-move numbers fed
 * in. Thirty moves, three animations. A formula can be tuned until the frame
 * data is right and the hitbox is in the right place, and it will still read
 * as a mechanism rotating its parts, because what it cannot do is be *drawn*:
 * it has no way to say "on this frame the weight is here, the shoulder is
 * over the front foot and the head has not caught up yet".
 *
 * So a move is a list of poses at frame numbers, and this interpolates
 * between them. That is all. It is the same thing a 2D fighting game has
 * always done, and it is the only thing that lets two punches differ in the
 * way two punches actually differ.
 *
 * Authoring rules, which exist because the alternative is a kind of bug that
 * the eye catches and no check does:
 *
 *   - Keys are sparse. A channel keeps its last value until a later key names
 *     it, and anything never named stays at rest. You write what moves.
 *   - Frame 0 is the rest pose unless you say otherwise, so a move begins in
 *     the stance the fighter is already standing in rather than snapping to a
 *     different neutral.
 *   - The last key must land on the move's last frame at rest, or the move
 *     ends with a snap back to the idle.
 *   - `ease` belongs to the key being moved *to*. A limb leaving the chamber
 *     and a limb arriving at full extension want different curves, and that is
 *     a property of the arrival.
 */

export const EASES = {
  linear: (t) => t,
  in: (t) => t * t,
  out: (t) => 1 - (1 - t) ** 3,
  inout: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  /** Overshoots and comes back: a limb arriving at full extension. */
  back: (t) => 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2,
  /** Leaves slowly and arrives fast: a limb being thrown. */
  whip: (t) => t ** 2.4,
  /** Leaves fast and arrives slowly: a limb being pulled back under control. */
  snap: (t) => 1 - (1 - t) ** 4,
};

const CHANNELS = ['rot', 'x', 'y'];

/**
 * @param rest  the pose a character stands in -- normally `stance.idle(0)`.
 * @param keys  [{ at, ease, <part>: { rot, x, y } }], ascending by `at`.
 */
export function anim(rest, keys) {
  // Flatten to per-channel tracks so each one can be interpolated on its own.
  // A shared clock across every joint is exactly what made the old poses read
  // as a mechanism: everything left and arrived together.
  const tracks = {};
  const at0 = {};
  for (const [part, v] of Object.entries(rest || {})) {
    for (const c of CHANNELS) if (v && v[c] !== undefined) at0[`${part}.${c}`] = v[c];
  }
  for (const k of keys) {
    for (const [part, v] of Object.entries(k)) {
      if (part === 'at' || part === 'ease' || !v || typeof v !== 'object') continue;
      for (const c of CHANNELS) {
        if (v[c] === undefined) continue;
        const id = `${part}.${c}`;
        (tracks[id] ??= []).push({ at: k.at, to: v[c], ease: v.ease || k.ease || 'inout' });
      }
    }
  }

  // `{ at, rest: true }` returns every channel the animation touched to the
  // pose the fighter stands in. Every move needs that key and most of them
  // need nothing else in it, and writing the rest values out by hand is how
  // they drift from the stance and the move ends with a snap.
  for (const k of keys) {
    if (!k.rest) continue;
    for (const id of Object.keys(tracks)) {
      tracks[id].push({ at: k.at, to: at0[id] ?? 0, ease: k.ease || 'inout' });
    }
  }
  for (const t of Object.values(tracks)) t.sort((a, b) => a.at - b.at);

  return (f) => {
    const pose = {};
    const put = (id, value) => {
      const [part, c] = id.split('.');
      (pose[part] ??= {})[c] = value;
    };
    for (const [id, track] of Object.entries(tracks)) {
      let from = at0[id] ?? 0;
      let fromAt = 0;
      let value = from;
      for (const k of track) {
        if (f >= k.at) { from = k.to; fromAt = k.at; value = k.to; continue; }
        const span = k.at - fromAt;
        const t = span <= 0 ? 1 : (f - fromAt) / span;
        value = from + (k.to - from) * (EASES[k.ease] || EASES.inout)(Math.max(0, Math.min(1, t)));
        break;
      }
      put(id, value);
    }
    // Channels the animation never touches still have to be emitted, or the
    // part falls back to the drawn A-pose instead of holding its guard.
    for (const [id, v] of Object.entries(at0)) if (!tracks[id]) put(id, v);
    return pose;
  };
}

/**
 * The frame the author meant by "the hit lands": the last active frame.
 * Keeping it in one place stops an animation and its frame data drifting
 * apart, which is how a move ends up extending during its own recovery.
 */
export const contactFrame = (m) => m.startup + m.active - 1;

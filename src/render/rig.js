/**
 * Skeletal renderer for characters cut from a single illustration.
 *
 * Parts are packed in an atlas; each carries a pivot, a parent and a z. Draw
 * order crosses the hierarchy -- legs sit behind the coat but hang off the hips
 * -- so world transforms are resolved first and the draw runs in z order after.
 */

export const I = () => [1, 0, 0, 1, 0, 0];
export const mul = (m, n) => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
export const T = (x, y) => [1, 0, 0, 1, x, y];
export const R = (a) => [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0];
export const S = (x, y) => [x, 0, 0, y, 0, 0];

export class Rig {
  constructor(def, image) {
    this.def = def;
    this.image = image;
    this.byName = {};
    this.kids = {};
    for (const p of def.parts) {
      this.byName[p.name] = p;
      (this.kids[p.parent] ||= []).push(p);
    }
    this.byZ = def.parts.slice().sort((a, b) => a.z - b.z);
    this.root = this.byName[def.root];
    /** Source-space distance from the root's pivot down to the ground line. */
    this.rootLift = def.ground[1] - this.root.origin[1];
  }

  /**
   * Resolve every part's world matrix.
   * @param pose   { partName: { rot, x, y } }
   * @param place  { x, y, scale, facing, flipY } -- y is the ground line.
   *   flipY mirrors the character under the floor for the wet-floor reflection,
   *   which has to go through the same solve or the reflection desyncs by a frame.
   */
  solve(pose, place) {
    // Each illustration was drawn facing whichever way its artist chose, and
    // most of this cast happens to face screen-left. `art` records that, so
    // `facing` can stay a plain "which way is the opponent" everywhere else.
    const flip = place.facing * (this.def.art ?? 1) < 0 ? -1 : 1;
    const vy = place.flipY ? -1 : 1;
    const base = mul(
      T(place.x, place.y - this.rootLift * place.scale * vy),
      S(place.scale * flip, place.scale * vy),
    );
    const out = {};
    const visit = (part, m) => {
      const p = pose[part.name] || EMPTY;
      let k = m;
      if (part.parent) {
        const par = this.byName[part.parent];
        k = mul(k, T(part.origin[0] - par.origin[0], part.origin[1] - par.origin[1]));
      }
      if (p.x || p.y) k = mul(k, T(p.x || 0, p.y || 0));
      if (p.rot) k = mul(k, R(p.rot));
      out[part.name] = k;
      for (const c of (this.kids[part.name] || [])) visit(c, k);
    };
    visit(this.root, base);
    return out;
  }

  /**
   * Composes with whatever transform is already on the context, so the same
   * draw works under a camera. Resetting the transform per part -- which is
   * what the standalone preview did -- silently drew every fighter at raw world
   * coordinates in the corner of the screen.
   */
  draw(ctx, M, opts = {}) {
    const { alpha = 1, only = null } = opts;
    ctx.save();
    ctx.globalAlpha *= alpha;
    for (const part of this.byZ) {
      if (only && !only.includes(part.name)) continue;
      const m = M[part.name];
      if (!m) continue;
      const [sx, sy, sw, sh] = part.rect;
      const [px, py] = part.pivot;
      ctx.save();
      ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
      ctx.drawImage(this.image, sx, sy, sw, sh, -px, -py, sw, sh);
      ctx.restore();
    }
    ctx.restore();
  }

  /** Where a named part currently sits in world space. Hitboxes ride on this. */
  point(M, partName) {
    const m = M[partName];
    return m ? { x: m[4], y: m[5] } : null;
  }

  /**
   * Where a part actually strikes from, in world space.
   *
   * `point` returns the part's joint, which is where it hangs from, not where
   * it hits: a jab measured at the shoulder is a jab with no reach, and with
   * the stage holding fighters 118px apart almost nothing could land. The
   * striking end is the corner of the part's own artwork that the swing has
   * carried furthest in the direction the character faces -- the fist on an
   * extended arm, the foot on a kick, the leading shoulder on a body charge --
   * so it follows the pose for free and needs nothing declared per move.
   *
   * @param lead 1 sits on the silhouette's edge; a little under pulls the box
   *   back inside the limb so a graze does not read as a connect.
   */
  strikePoint(M, partName, facing = 1, lead = 0.88) {
    const m = M[partName];
    const p = this.byName[partName];
    if (!m || !p) return null;
    const [bx, by] = leadingCorner(p, m, facing);
    return {
      x: m[0] * bx * lead + m[2] * by * lead + m[4],
      y: m[1] * bx * lead + m[3] * by * lead + m[5],
    };
  }

  /**
   * Where a weapon sits in a part's own coordinates: the same corner the
   * strike point uses, so the blade is wherever the hitbox is rather than
   * somewhere that merely looks close.
   */
  gripLocal(M, partName, facing = 1) {
    const m = M[partName];
    const p = this.byName[partName];
    if (!m || !p) return null;
    return leadingCorner(p, m, facing);
  }
}

const EMPTY = {};

/**
 * The corner of a part's artwork that the current pose has carried furthest
 * toward the opponent -- the fist on an extended arm, the foot on a kick.
 *
 * `m` is the part's solved world matrix; when it is omitted the corners are
 * ranked in the part's own space instead, which is what a rig definition can
 * answer before anything has been posed.
 */
export function leadingCorner(part, m = null, facing = 1) {
  const [, , w, h] = part.rect;
  const [px, py] = part.pivot;
  let bx = 0; let by = 0; let best = -Infinity;
  for (const [cx, cy] of [[-px, -py], [w - px, -py], [-px, h - py], [w - px, h - py]]) {
    const score = m ? (m[0] * cx + m[2] * cy + m[4]) * facing : Math.hypot(cx, cy);
    if (score > best) { best = score; bx = cx; by = cy; }
  }
  return [bx, by];
}

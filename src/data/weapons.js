/**
 * What a RebelKin brings to the fight, and what it changes.
 *
 * A weapon is not a new moveset. It is a modifier on the moves a character
 * already has, plus something drawn in the hand or on the boot -- which keeps
 * ten characters times six weapons at sixty combinations without sixty sets of
 * frame data to balance or verify.
 *
 * Grip is the load-bearing idea. Five of the ten were drawn with their arms
 * folded, pocketed or crossed, and no arm could be cut free of the
 * illustration; those characters fight with legs and body. A weapon therefore
 * declares the limb it needs. A hand weapon is simply not offered to a
 * character with no hand, and it only modifies the moves that strike with that
 * limb: a bat lengthens a hook and does nothing at all to a stomp.
 *
 * The art is drawn in code rather than cut from a sheet. There is no weapon
 * artwork for this cast, and a procedural shape in the character's own palette
 * sits better beside a cel-shaded illustration than a borrowed sprite would.
 */

export const GRIP_PARTS = { hand: ['armL', 'armR'], boot: ['legL', 'legR'] };

/** Flat, bold, outlined -- the same language as the illustrations. */
function stroke(ctx, w, colour, line = '#120d18') {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = line;
  ctx.lineWidth = w;
  ctx.stroke();
  ctx.fillStyle = colour;
  ctx.fill();
}

export const WEAPONS = [
  {
    id: 'bare',
    name: 'BARE',
    blurb: 'Nothing but the hands you were drawn with',
    grip: null,
    rank: 0,
    reach: 0,
    damage: 1,
    startup: 0,
    knockback: 1,
    draw: null,
  },
  {
    id: 'toes',
    name: 'STEEL TOES',
    blurb: 'Capped boots. Every kick lands heavier',
    grip: 'boot',
    rank: 1,
    reach: 6,
    damage: 1.18,
    startup: 0,
    knockback: 1.1,
    draw(ctx) {
      ctx.beginPath();
      ctx.moveTo(-12, -4);
      ctx.lineTo(16, -8);
      ctx.lineTo(21, 4);
      ctx.lineTo(-10, 9);
      ctx.closePath();
      stroke(ctx, 3, '#b9c4cf');
      ctx.beginPath();
      ctx.moveTo(10, -7);
      ctx.lineTo(13, 3);
      stroke(ctx, 2, 'transparent', 'rgba(20,16,26,.55)');
    },
  },
  {
    id: 'bat',
    name: 'SCRAP BAT',
    blurb: 'Rebar and tape. Slow, and it carries',
    grip: 'hand',
    rank: 1,
    reach: 26,
    damage: 1.26,
    startup: 2,
    knockback: 1.25,
    draw(ctx) {
      ctx.beginPath();
      ctx.moveTo(-6, -5);
      ctx.lineTo(44, -11);
      ctx.lineTo(52, 0);
      ctx.lineTo(44, 11);
      ctx.lineTo(-6, 5);
      ctx.closePath();
      stroke(ctx, 3, '#8a7f72');
      ctx.beginPath();
      ctx.rect(-14, -6, 16, 12);
      stroke(ctx, 3, '#2b2430');
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(20 + i * 10, -2 + (i % 2) * 5, 2.2, 0, Math.PI * 2);
        stroke(ctx, 1.5, '#d8cec0');
      }
    },
  },
  {
    id: 'cutter',
    name: 'BOXCUTTER',
    blurb: 'Short, quick, and it does not forgive',
    grip: 'hand',
    rank: 2,
    reach: 10,
    damage: 1.1,
    startup: -1,
    knockback: 0.85,
    draw(ctx) {
      ctx.beginPath();
      ctx.rect(-12, -5, 20, 10);
      stroke(ctx, 2.6, '#f5c518');
      ctx.beginPath();
      ctx.moveTo(8, -3);
      ctx.lineTo(26, -1);
      ctx.lineTo(26, 3);
      ctx.lineTo(8, 4);
      ctx.closePath();
      stroke(ctx, 2, '#e8eef5');
    },
  },
  {
    id: 'plates',
    name: 'SHIN PLATES',
    blurb: 'Strapped steel. Longer legs, slower legs',
    grip: 'boot',
    rank: 3,
    reach: 20,
    damage: 1.12,
    startup: 2,
    knockback: 1.2,
    draw(ctx) {
      ctx.beginPath();
      ctx.moveTo(-26, -7);
      ctx.lineTo(16, -10);
      ctx.lineTo(22, 2);
      ctx.lineTo(-24, 8);
      ctx.closePath();
      stroke(ctx, 3, '#6f7b88');
      for (const x of [-16, -4, 8]) {
        ctx.beginPath();
        ctx.moveTo(x, -8);
        ctx.lineTo(x - 2, 6);
        stroke(ctx, 2, 'transparent', 'rgba(18,14,24,.5)');
      }
    },
  },
  {
    id: 'chain',
    name: 'CHAIN',
    blurb: 'Reaches further than anything else here',
    grip: 'hand',
    rank: 4,
    reach: 46,
    damage: 1.04,
    startup: 3,
    knockback: 1.35,
    draw(ctx) {
      ctx.beginPath();
      ctx.rect(-12, -5, 14, 10);
      stroke(ctx, 2.6, '#3a3340');
      for (let i = 0; i < 7; i++) {
        ctx.beginPath();
        ctx.ellipse(6 + i * 9, Math.sin(i * 1.3) * 4, 5.2, 3.4, i * 0.5, 0, Math.PI * 2);
        stroke(ctx, 2, '#9aa4ad');
      }
    },
  },
];

export const byId = (id) => WEAPONS.find((w) => w.id === id) ?? WEAPONS[0];

/** Can this character hold it? A hand weapon needs an arm that came free. */
export function canHold(def, weapon) {
  if (!weapon.grip) return true;
  const parts = new Set(def.rig.parts.map((p) => p.name));
  return GRIP_PARTS[weapon.grip].some((p) => parts.has(p));
}

/**
 * Which of a character's limbs the weapon actually occupies.
 *
 * Boots come in pairs, so a boot weapon takes both legs. A hand weapon takes
 * one hand -- drawing it in both fists gave KIN 01, who has two free arms,
 * a bat in each and the look of a drummer. It goes in the hand that throws the
 * committed swing, because that is where a weapon changes the fight, and that
 * is then the only hand whose moves it modifies.
 */
export function heldParts(def, weapon) {
  if (!weapon || !weapon.grip) return [];
  const have = new Set(def.rig.parts.map((p) => p.name));
  const candidates = GRIP_PARTS[weapon.grip].filter((p) => have.has(p));
  if (weapon.grip === 'boot') return candidates;
  const heavy = def.moves.heavy && def.moves.heavy.strikePart;
  return candidates.includes(heavy) ? [heavy] : candidates.slice(0, 1);
}

/**
 * Draw a character's weapon, in the limb that holds it.
 *
 * It rides the part's own matrix at the same corner the hitbox is placed on,
 * so the blade is where the damage is rather than somewhere that merely looks
 * close, and it swings with the limb for free.
 *
 * Size is relative to the character, not absolute: these ten were drawn at
 * different sizes and a bat that reads right on KIN 08 is a twig on KIN 07
 * otherwise. 508 is KIN 08's body height, the one the art was eyeballed
 * against, and 2.4 is what makes the bat about a third of a fighter.
 */
export function drawWeaponOn(ctx, rig, M, def, weapon, facing) {
  if (!weapon || !weapon.draw) return;
  const k = 2.4 * (def.bodyHeight / 508);
  for (const part of heldParts(def, weapon)) {
    const m = M[part];
    const local = rig.gripLocal(M, part, facing);
    if (!m || !local) continue;
    ctx.save();
    ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
    ctx.translate(local[0], local[1]);
    // the rig mirrors for facing; undo it so the weapon is never inside-out
    const flip = def.rig.art ?? 1;
    ctx.scale((facing * flip < 0 ? -1 : 1) * k, k);
    weapon.draw(ctx);
    ctx.restore();
  }
}

/**
 * A move as this weapon makes it. Cached per weapon per move: the object is
 * read every frame of a swing and rebuilt objects would churn for nothing.
 *
 * Only moves that strike with the limb actually holding it change. A bat does
 * nothing to a stomp, and nothing to the off hand either, which is what stops
 * one weapon from being correct on every character and every move.
 */
const cache = new WeakMap();
export function applyWeapon(weapon, move, def) {
  if (!weapon || !weapon.grip) return move;
  if (!heldParts(def, weapon).includes(move.strikePart)) return move;
  let byMove = cache.get(weapon);
  if (!byMove) { byMove = new WeakMap(); cache.set(weapon, byMove); }
  const hit = byMove.get(move);
  if (hit) return hit;
  const out = {
    ...move,
    reach: move.reach + weapon.reach,
    damage: Math.round(move.damage * weapon.damage),
    knockback: Math.round(move.knockback * weapon.knockback),
    // never below one frame of startup, however quick the weapon
    startup: Math.max(1, move.startup + weapon.startup),
    weapon,
  };
  byMove.set(move, out);
  return out;
}

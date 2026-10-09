/**
 * Rank, and what it unlocks.
 *
 * One number, kept in localStorage: matches won. Rank is derived from it
 * rather than stored, so the two can never disagree, and weapons unlock at a
 * rank rather than being granted individually -- a player who clears the
 * table gets the whole tier, not a bag of flags to keep in sync.
 *
 * Storage is best-effort throughout. A private window throws on the first
 * read, and a fighting game that will not start because it cannot remember
 * your rank is worse than one that forgets it.
 */

const KEY = 'rebelkin.progress';

/** Wins needed to reach each rank. Index is the rank. */
const LADDER = [0, 1, 3, 6, 10];

export const MAX_RANK = LADDER.length - 1;

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { wins: 0 };
    const v = JSON.parse(raw);
    return { wins: Math.max(0, Math.floor(Number(v.wins) || 0)) };
  } catch { return { wins: 0 }; }
}

function save(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private window */ }
}

export function rankOf(wins) {
  let r = 0;
  for (let i = 0; i < LADDER.length; i++) if (wins >= LADDER[i]) r = i;
  return r;
}

/** Wins still needed for the next rank, or 0 at the top. */
export function toNext(wins) {
  const r = rankOf(wins);
  return r >= MAX_RANK ? 0 : LADDER[r + 1] - wins;
}

export function winMatch() {
  const state = load();
  const before = rankOf(state.wins);
  state.wins += 1;
  save(state);
  const after = rankOf(state.wins);
  return { ...state, rank: after, promoted: after > before };
}

export function current() {
  const state = load();
  return { ...state, rank: rankOf(state.wins), toNext: toNext(state.wins) };
}

/** Test seam: the suite needs a known rank without winning ten matches. */
export function setWins(n) {
  save({ wins: Math.max(0, Math.floor(n)) });
  return current();
}

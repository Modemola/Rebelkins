/** Persistence. One slot, localStorage, forgiving about being absent. */

const KEY = 'rebelkin.threadwar.save.v1';

export function freshSave() {
  return {
    cred: 300,
    traits: 1,
    owned: [],
    rep: { heat: 0, taste: 0, kinship: 0, myth: 0 },
    unlockedKin: ['spark', 'softlock'],
    completed: {},
    nightIndex: 0,
    bestStyle: {},
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshSave();
    const parsed = JSON.parse(raw);
    return { ...freshSave(), ...parsed, rep: { ...freshSave().rep, ...(parsed.rep || {}) } };
  } catch {
    return freshSave();
  }
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private window, quota, whatever. The run still plays. */
  }
}

export function wipe() {
  try {
    localStorage.removeItem(KEY);
  } catch { /* ignore */ }
  return freshSave();
}

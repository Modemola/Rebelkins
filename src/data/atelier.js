/**
 * THE ATELIER — you do not level a gun, you level a workshop.
 *
 * Reputation is four separate tracks because the city is four separate
 * audiences. Pleasing all of them at once is not the goal; the endgame is
 * owning a look so specific the city has to rewrite a district around you.
 */

export const REP_TRACKS = [
  { id: 'heat', name: 'Heat', blurb: 'What the city remembers about you.', good: false },
  { id: 'taste', name: 'Taste', blurb: 'What the fashion houses will sell you.', good: true },
  { id: 'kinship', name: 'Kinship', blurb: 'What the non-human blocks will open for you.', good: true },
  { id: 'myth', name: 'Myth', blurb: 'What the street says when you are not there.', good: true },
];

export const UPGRADES = [
  {
    id: 'crew-slot-2', name: 'Second Crew Slot', cost: { cred: 200, traits: 0 },
    branch: 'crew', desc: 'Run two Kin on a contract. Attention becomes something you can aim.',
    effect: { crewSlots: 2 },
  },
  {
    id: 'crew-slot-3', name: 'Third Crew Slot', cost: { cred: 520, traits: 2 },
    branch: 'crew', requires: ['crew-slot-2'],
    desc: 'Three bodies, three packets, one plan.', effect: { crewSlots: 3 },
  },
  {
    id: 'crew-slot-4', name: 'Fourth Crew Slot', cost: { cred: 1100, traits: 5 },
    branch: 'crew', requires: ['crew-slot-3'],
    desc: 'A full crew. The district stops treating you as an incident and starts treating you as weather.',
    effect: { crewSlots: 4 },
  },
  {
    id: 'fast-compile', name: 'Bench Compiler', cost: { cred: 260, traits: 1 },
    branch: 'atelier', desc: 'Every Kin compiles 25% faster. Three seconds is a long time in a lobby.',
    effect: { compileMul: 0.75 },
  },
  {
    id: 'illegal-compiles', name: 'Illegal Compiles', cost: { cred: 480, traits: 3 },
    branch: 'atelier', requires: ['fast-compile'],
    desc: 'Clashing tag pairs stop tripping alarms. Wear loud and quiet at once and let THREAD choke on it.',
    effect: { overlay: 'illegal-compiles' },
  },
  {
    id: 'forged-provenance', name: 'Forged Provenance', cost: { cred: 400, traits: 2 },
    branch: 'atelier', desc: 'Luxury threads carry a false history. +1 access on anything that reads as money.',
    effect: { overlay: 'forged-provenance' },
  },
  {
    id: 'license-nonhuman', name: 'Species License: Non-Human', cost: { cred: 340, traits: 2 },
    branch: 'licenses', desc: 'Undercut paperwork. Non-human Kin stop being an exception at every door.',
    effect: { license: 'non-human bird / chick Kin' },
  },
  {
    id: 'license-multi', name: 'Species License: Multi-Subject', cost: { cred: 620, traits: 3 },
    branch: 'licenses', requires: ['license-nonhuman'],
    desc: 'The city agrees, grudgingly, that two people can be one citizen.',
    effect: { license: 'mixed; one human-loud, one quiet' },
  },
  {
    id: 'taste-map', name: 'District Taste Maps', cost: { cred: 300, traits: 1 },
    branch: 'intel', desc: 'See what a district wants before you compile, not after a door closes on you.',
    effect: { tasteMaps: true },
  },
  {
    id: 'camera-intel', name: 'Camera Registry', cost: { cred: 380, traits: 2 },
    branch: 'intel', requires: ['taste-map'],
    desc: 'Camera cones render before they see you. Knowing is most of stealth.',
    effect: { cameraIntel: true },
  },
  {
    id: 'tribute-relics', name: 'Tribute Relics', cost: { cred: 900, traits: 6 },
    branch: 'intel', requires: ['camera-intel'],
    desc: 'Fan-content flagged pieces. The crowd treats them as sacred and copies them instantly.',
    effect: { relics: true },
  },
];

export const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

/** Fold owned upgrades into a flat modifier bag the rest of the game reads. */
export function resolveUpgrades(owned) {
  const state = {
    crewSlots: 1,
    compileMul: 1,
    overlays: new Set(),
    licenses: new Set(),
    tasteMaps: false,
    cameraIntel: false,
    relics: false,
  };
  for (const id of owned) {
    const u = UPGRADE_BY_ID[id];
    if (!u) continue;
    const e = u.effect;
    if (e.crewSlots) state.crewSlots = Math.max(state.crewSlots, e.crewSlots);
    if (e.compileMul) state.compileMul *= e.compileMul;
    if (e.overlay) state.overlays.add(e.overlay);
    if (e.license) state.licenses.add(e.license);
    if (e.tasteMaps) state.tasteMaps = true;
    if (e.cameraIntel) state.cameraIntel = true;
    if (e.relics) state.relics = true;
  }
  return state;
}

export function canBuy(upgrade, save) {
  if (save.owned.includes(upgrade.id)) return { ok: false, why: 'owned' };
  for (const req of upgrade.requires || []) {
    if (!save.owned.includes(req)) {
      return { ok: false, why: `needs ${UPGRADE_BY_ID[req].name}` };
    }
  }
  if (save.cred < upgrade.cost.cred) return { ok: false, why: 'not enough cred' };
  if (save.traits < (upgrade.cost.traits || 0)) return { ok: false, why: 'not enough traits' };
  return { ok: true, why: '' };
}

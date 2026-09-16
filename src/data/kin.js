/**
 * THE ROSTER — six starter Kin, encoded from the character bibles.
 *
 * Every Kin uses the same 8 stats, 1-10:
 *   presence  how hard cameras lock on
 *   ignore    how easy it is to be socially unseen
 *   compile   how fast they rewrite a Thread mid-run
 *   mobility  movement kit
 *   brk       fight / style-break power  ("break" is reserved)
 *   crowd     how fast civilians copy or protect them
 *   heatCap   how much fame they can hold before the district slams the door
 *   bond      how well they sync with crew and vehicles
 *
 * A Thread is a loadout: clothes + item + shoes + hair effect.
 * Compiling one takes 3s (scaled by `compile`) unless the Thread says otherwise.
 *
 * Thread tags feed the THREAD protocol's read of you. Districts want tags.
 *   street loud quiet luxury holo folk craft kinetic new
 */

export const STAT_KEYS = [
  ['presence', 'Presence'],
  ['ignore', 'Ignore'],
  ['compile', 'Compile'],
  ['mobility', 'Mobility'],
  ['brk', 'Break'],
  ['crowd', 'Crowd'],
  ['heatCap', 'Heat Cap'],
  ['bond', 'Bond'],
];

export const KIN = [
  {
    id: 'spark',
    codename: 'SPARK',
    trueName: 'Vex',
    role: 'Room-breaker, trend detonator, loud face',
    species: 'human',
    subjects: 1,
    personality: 'Ignite',
    stance: 'Forward lean, chin up, weight on the front foot',
    why: 'The city needs someone who can become the only thing a camera wants to look at. Spark is that problem on purpose.',
    stats: { presence: 9, ignore: 2, compile: 6, mobility: 7, brk: 9, crowd: 8, heatCap: 3, bond: 5 },
    voice: 'Fast, rude, funny, a little too honest. Talks like every sentence could start a fight or a party.',
    lines: [
      'Don’t scan me. Watch me.',
      'If the room is quiet, I did it wrong.',
      'Copy the belt. Not the face. The face is mine.',
    ],
    palette: { skin: '#c9825c', hair: '#ff2e88', hair2: '#31e0ff', cloth: '#e5372f', accent: '#ffd400', shoe: '#ffe14d' },
    look: {
      hair: 'spikes',
      head: 'human',
      mark: 'star',
      build: 'wiry',
      height: 0.96,
    },
    threads: [
      {
        id: 'matchhead', name: 'Matchhead',
        fit: 'Rune vest, chain belt, yellow kicks.',
        tags: ['street', 'loud'], access: 0,
        mods: { presence: +1, ignore: 0, scanMul: 1.15, moveMul: 1.05 },
        ability: {
          id: 'matchhead', name: 'Matchhead', cooldown: 16, duration: 8,
          desc: 'First style-break in a room tags every nearby camera onto Spark for 8s. Crew becomes harder to scan.',
        },
      },
      {
        id: 'letterbomb', name: 'Letterbomb',
        fit: 'Hair clips that spell fragments of a word.',
        tags: ['street', 'new'], access: 0,
        mods: { presence: 0, ignore: +1, scanMul: 1.0, moveMul: 1.0 },
        ability: {
          id: 'letterbomb', name: 'Letterbomb', cooldown: 20, duration: 12,
          desc: 'Tag a wall. That tag becomes a 12s rally point. Civilians path toward it.',
        },
      },
      {
        id: 'toomuch', name: 'Too Much',
        fit: 'Maximum color, maximum accessory.',
        tags: ['loud', 'new'], access: 1,
        mods: { presence: +3, ignore: -1, scanMul: 1.5, moveMul: 1.0, heatMul: 2.0 },
        ability: {
          id: 'toomuch', name: 'Too Much', cooldown: 24, duration: 10,
          desc: 'Heat builds twice as fast. Presence becomes a weapon. Doors that hate loud slam. Doors that love new open.',
        },
      },
    ],
    play: 'Lead with Spark when the mission needs a decoy, a riot, or a bad idea that works. Never leave Spark alone on extraction unless the runway wants chaos.',
  },

  {
    id: 'softlock',
    codename: 'SOFT LOCK',
    trueName: 'Nori',
    role: 'Social stealth, door ghost, anti-camera',
    species: 'human / panda-hoodie Kin',
    subjects: 1,
    personality: 'Avert',
    stance: 'Shoulders in, head down, weight on the back foot',
    why: 'Spark makes the room look. Soft Lock walks through the part of the room that stopped looking.',
    stats: { presence: 2, ignore: 10, compile: 7, mobility: 6, brk: 3, crowd: 4, heatCap: 8, bond: 7 },
    voice: 'Quiet, dry, short. Not shy in a cute way. Shy like a person who already ran the math.',
    lines: [
      'Don’t introduce me.',
      'If they remember my shoes, we failed.',
      'I’ll be at the door. Don’t look for me.',
    ],
    palette: { skin: '#e0ae86', hair: '#2b2b33', hair2: '#4a4a57', cloth: '#3a3d47', accent: '#f3f1ea', shoe: '#cfcabb' },
    look: { hair: 'flat', head: 'hood', mark: 'none', build: 'small', height: 0.92 },
    threads: [
      {
        id: 'hoodprotocol', name: 'Hood Protocol',
        fit: 'Hood up.',
        tags: ['quiet', 'street'], access: 0,
        mods: { presence: -1, ignore: +2, scanMul: 0.55, moveMul: 0.95 },
        ability: {
          id: 'hoodprotocol', name: 'Hood Protocol', cooldown: 14, duration: 6,
          desc: '6 seconds of "not interesting enough to scan." Breaks if they sprint or attack.',
        },
      },
      {
        id: 'pleasedont', name: 'Please Don’t',
        fit: 'Hands buried, no eye contact.',
        tags: ['quiet'], access: 0,
        mods: { presence: -1, ignore: +1, scanMul: 0.7, moveMul: 0.9 },
        ability: {
          id: 'pleasedont', name: 'Please Don’t', cooldown: 12, duration: 5,
          desc: 'Walking through a crowd does not raise Heat. Standing still near a camera drains that camera’s attention.',
        },
      },
      {
        id: 'softknife', name: 'Soft Knife',
        fit: 'Same hoodie, one sharp accessory visible only at close range.',
        tags: ['quiet', 'luxury'], access: 1,
        mods: { presence: 0, ignore: +1, scanMul: 0.75, moveMul: 1.0 },
        ability: {
          id: 'softknife', name: 'Soft Knife', cooldown: 18, duration: 8,
          desc: 'First takedown from unseen does not trigger alarms. Second one does.',
        },
      },
    ],
    play: 'Soft Lock is the win condition on Ghost Fit and Pair Split missions. They are bad at winning a room and excellent at leaving it.',
  },

  {
    id: 'driver',
    codename: 'DRIVER',
    trueName: 'Peck',
    role: 'Getaway, vehicle bond, living car',
    species: 'non-human bird / chick Kin',
    subjects: 1,
    personality: 'Grip',
    stance: 'Locked to a seat or crouched like a spring',
    why: 'The collection already said RebelKin are not always human. The game should make that matter. Driver turns the extract into a character.',
    stats: { presence: 6, ignore: 4, compile: 4, mobility: 10, brk: 6, crowd: 5, heatCap: 5, bond: 10 },
    voice: 'Blunt, territorial, funny because they are too serious about the car.',
    lines: [
      'Seatbelt. I’m not asking.',
      'The car likes me. It tolerates you.',
      'If they chase, I want the ugly route.',
    ],
    palette: { skin: '#ffd21f', hair: '#ffb300', hair2: '#ff7a1a', cloth: '#1f2f6e', accent: '#ff4f2a', shoe: '#f4f4f4' },
    look: { hair: 'crest', head: 'bird', mark: 'none', build: 'stub', height: 0.72 },
    threads: [
      {
        id: 'belted', name: 'Belted',
        fit: 'Seatbelt worn even on foot.',
        tags: ['street', 'kinetic'], access: 0,
        mods: { presence: 0, ignore: 0, scanMul: 0.95, moveMul: 1.15 },
        ability: {
          id: 'belted', name: 'Belted', cooldown: 10, duration: 6,
          desc: 'Mount time is instant. First crash does not stagger the crew.',
        },
      },
      {
        id: 'angrycute', name: 'Angry Cute',
        fit: 'No extra drip, just the face.',
        tags: ['street'], access: 0,
        mods: { presence: -1, ignore: +2, scanMul: 0.8, moveMul: 1.1 },
        ability: {
          id: 'angrycute', name: 'Angry Cute', cooldown: 12, duration: 6,
          desc: 'Civilians hesitate for half a second before reporting. Cute is camouflage.',
        },
      },
      {
        id: 'hotwired', name: 'Hotwired Fit',
        fit: 'Jacket plus wheel gloves.',
        tags: ['kinetic', 'street'], access: 1,
        mods: { presence: +1, ignore: 0, scanMul: 1.0, moveMul: 1.25 },
        ability: {
          id: 'hotwired', name: 'Hotwired Fit', cooldown: 30, duration: 45,
          desc: 'Compile a civilian car into a crew asset for 45 seconds.',
        },
      },
    ],
    play: 'Put Driver on any mission with a messy extract. Indoors they are the wildcard: low compile, high escape value, weird melee.',
  },

  {
    id: 'mirror',
    codename: 'MIRROR',
    trueName: 'Asha',
    role: 'Identity thief, packet thief, high-fashion exploit',
    species: 'human',
    subjects: 1,
    personality: 'Copy',
    stance: 'Long line, weight centered, one hand half-raised as if checking glass',
    why: 'VESTA runs on public identity packets. Somebody has to steal the face the door believes in.',
    stats: { presence: 7, ignore: 5, compile: 10, mobility: 6, brk: 5, crowd: 6, heatCap: 6, bond: 4 },
    voice: 'Precise, amused, a little cruel. Speaks like they are already wearing your name.',
    lines: [
      'Hold still. I only need the outline.',
      'The door doesn’t know you. It knows the jacket.',
      'Give it back in ninety seconds. Maybe.',
    ],
    palette: { skin: '#8d5a3c', hair: '#141019', hair2: '#6d4bff', cloth: '#b9c6ff', accent: '#8ef7ff', shoe: '#e8e8f2' },
    look: { hair: 'sleek', head: 'human', mark: 'none', build: 'tall', holo: true, height: 1.1 },
    threads: [
      {
        id: 'glasscoat', name: 'Glass Coat',
        fit: 'Holo jacket.',
        tags: ['holo', 'luxury'], access: 1,
        mods: { presence: +1, ignore: 0, scanMul: 1.0, moveMul: 1.0 },
        ability: {
          id: 'glasscoat', name: 'Glass Coat', cooldown: 20, duration: 9,
          desc: 'Copy a nearby civilian or guard packet for 9s. Movement stays yours. Access becomes theirs.',
        },
      },
      {
        id: 'fisheye', name: 'Fisheye',
        fit: 'Lens-warped silhouette.',
        tags: ['holo', 'new'], access: 1,
        mods: { presence: 0, ignore: +1, scanMul: 0.85, moveMul: 1.0 },
        ability: {
          id: 'fisheye', name: 'Fisheye', cooldown: 18, duration: 8,
          desc: 'Enemy aim cones bend. First shot at Mirror misses unless they are standing still.',
        },
      },
      {
        id: 'afterimage', name: '1/1 Afterimage',
        fit: 'Special effect on.',
        tags: ['holo', 'luxury', 'new'], access: 2,
        mods: { presence: +2, ignore: 0, scanMul: 1.2, moveMul: 1.0 },
        ability: {
          id: 'afterimage', name: '1/1 Afterimage', cooldown: 22, duration: 5,
          desc: 'Leave a walking clone for 5s when you compile. Clone has Presence 10 and no brain.',
        },
      },
    ],
    play: 'Mirror wins Facejack and members-only floors. Fragile in a brawl. Keep Soft Lock near them or use Spark as the camera magnet.',
  },

  {
    id: 'folkglitch',
    codename: 'FOLK GLITCH',
    trueName: 'Ilya',
    role: 'Crowd conversion, ritual buff, classification error',
    species: 'human, folk-costume layer',
    subjects: 1,
    personality: 'Hold',
    stance: 'Planted feet, open chest, hands ready to clap, lift, or mark a rhythm',
    why: 'The project already put folk costumes on RebelKin. In a THREAD city that is a weapon. The system cannot file them cleanly.',
    stats: { presence: 6, ignore: 3, compile: 5, mobility: 4, brk: 6, crowd: 10, heatCap: 7, bond: 8 },
    voice: 'Warm, rhythmic, stubborn. Talks like the city is a guest in an older room.',
    lines: [
      'They can scan the shoes. Not the rest.',
      'Stand closer. The pattern works better in a circle.',
      'This is not a costume. The city just forgot the word.',
    ],
    palette: { skin: '#a9694a', hair: '#3b1f14', hair2: '#d4373c', cloth: '#f2ead5', accent: '#c5122b', shoe: '#2f6f4f' },
    look: { hair: 'dressed', head: 'human', mark: 'none', build: 'grounded', folk: true, height: 1 },
    threads: [
      {
        id: 'beadwork', name: 'Beadwork',
        fit: 'Heavy embroidery and beads.',
        tags: ['folk', 'craft'], access: 0,
        mods: { presence: 0, ignore: 0, scanMul: 0.9, moveMul: 0.9 },
        ability: {
          id: 'beadwork', name: 'Beadwork', cooldown: 16, duration: 10,
          desc: 'Nearby civilians become moving cover. They want to stand with Ilya.',
        },
      },
      {
        id: 'sequinedfault', name: 'Sequined Fault',
        fit: 'Handmade shine.',
        tags: ['craft', 'new'], access: 1,
        mods: { presence: +1, ignore: +1, scanMul: 0.85, moveMul: 0.9 },
        ability: {
          id: 'sequinedfault', name: 'Sequined Fault', cooldown: 20, duration: 10,
          desc: 'THREAD mislabels Ilya as an event, not a person. Alarms route to the wrong protocol for 10s.',
        },
      },
      {
        id: 'olddoor', name: 'Old Door',
        fit: 'Folk layer plus modern sneakers.',
        tags: ['folk', 'street'], access: 2,
        mods: { presence: 0, ignore: 0, scanMul: 0.95, moveMul: 1.0 },
        ability: {
          id: 'olddoor', name: 'Old Door', cooldown: 26, duration: 8,
          desc: 'Locked cultural or ceremonial spaces open. Street doors stay normal.',
        },
      },
    ],
    play: 'Use Folk Glitch when you need the street itself to help. Bad in empty corridors. Godlike in markets, galleries, and extracts with spectators.',
  },

  {
    id: 'pair',
    codename: 'THE PAIR',
    trueName: 'Juno and Moss',
    role: 'Decoy + operator, two social roles at once',
    species: 'mixed; one human-loud, one quiet',
    subjects: 2,
    personality: 'Split',
    stance: 'Juno forward, Moss half-behind or already turning away',
    why: 'The trait list already allows multiple subjects. That should not be a cosmetic. It should be a mission tool.',
    stats: { presence: 8, ignore: 3, compile: 8, mobility: 7, brk: 7, crowd: 7, heatCap: 4, bond: 9 },
    split: { presence: [8, 3], ignore: [3, 9] },
    voice: 'They interrupt each other. Juno talks at the room. Moss talks at the plan.',
    lines: [
      'Juno: "Look at me."  Moss: "Don’t."',
      'Juno: "If they follow me, you already have the bag."',
      'Moss: "If they follow me, you did too much again."',
    ],
    palette: { skin: '#cf8b63', hair: '#ff9f1c', hair2: '#1b3b6f', cloth: '#7b2cbf', accent: '#3ddc97', shoe: '#ffffff' },
    look: { hair: 'double', head: 'human', mark: 'none', build: 'duo', height: 1 },
    threads: [
      {
        id: 'onename', name: 'One Name',
        fit: 'Shared color, shared shoes.',
        tags: ['street', 'new'], access: 1,
        mods: { presence: 0, ignore: +1, scanMul: 0.8, moveMul: 1.0 },
        ability: {
          id: 'onename', name: 'One Name', cooldown: 14, duration: 8,
          desc: 'Cameras can only lock one body at a time. You choose which.',
        },
      },
      {
        id: 'badtwin', name: 'Bad Twin',
        fit: 'Juno max drip, Moss stripped down.',
        tags: ['loud', 'quiet'], access: 0,
        mods: { presence: +2, ignore: +1, scanMul: 1.1, moveMul: 1.0 },
        ability: {
          id: 'badtwin', name: 'Bad Twin', cooldown: 16, duration: 5,
          desc: 'Juno becomes Spark-like bait. Moss inherits Hood Protocol for 5s.',
        },
      },
      {
        id: 'twodoors', name: 'Two Doors',
        fit: 'Both visible, standing apart.',
        tags: ['street', 'quiet'], access: 1,
        mods: { presence: 0, ignore: 0, scanMul: 1.0, moveMul: 0.95 },
        ability: {
          id: 'twodoors', name: 'Two Doors', cooldown: 24, duration: 8,
          desc: 'For 8s they occupy two checkpoints at once. If one takes damage, the window snaps shut.',
        },
      },
    ],
    play: 'The Pair is the tutorial for crew logic inside one character. Best on Pair Split, Sample Run, and any mission with two rooms.',
  },
];

/** Build order teaches the game: noise, silence, split attention, stolen identity, escape, crowd magic. */
export const BUILD_ORDER = ['spark', 'softlock', 'pair', 'mirror', 'driver', 'folkglitch'];

export const KIN_BY_ID = Object.fromEntries(KIN.map((k) => [k.id, k]));

export function getKin(id) {
  const k = KIN_BY_ID[id];
  if (!k) throw new Error(`Unknown Kin: ${id}`);
  return k;
}

export function getThread(kinId, threadId) {
  const k = getKin(kinId);
  return k.threads.find((t) => t.id === threadId) || k.threads[0];
}

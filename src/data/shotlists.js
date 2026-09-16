/**
 * THE REFERENCE WALL.
 *
 * No character is "done" until the shoe plate and the attitude plate both work
 * at thumbnail size. Every hero Kin gets the same 15 plates so the roster stays
 * comparable, and so a missing plate is visible instead of forgotten.
 *
 * This is the single source of truth: the in-game bible screen reads it, and
 * tools/build-bibles.mjs writes docs/CHARACTER_BIBLES.md from it.
 */

/** Production rule for every image on the wall. The shader target, in words. */
export const PRODUCTION_RULE = [
  'Saturated, but not muddy.',
  'Outlines visible on inspection.',
  'Plastic-smooth volumes from far away.',
  'Imperfect drawn marks up close.',
  'Personality readable at 64px silhouette.',
  'No generic anime-pretty faces. Attitude first.',
];

/** Shared folder tree. Every folder gets the 15-shot list. */
export const FOLDER_TREE = [
  '/kin/_style', '/kin/_shoes', '/kin/_hair', '/kin/_accessories',
  '/kin/_species', '/kin/_groups',
  '/kin/spark', '/kin/softlock', '/kin/driver',
  '/kin/mirror', '/kin/folkglitch', '/kin/pair',
];

/** Material and drip library. More important than the body. */
export const DRIP_LIBRARY = [
  'oversized hoodies', 'chain belts', 'rune vests', 'plaid / tennis skirts',
  'fishnets', 'chunky sneakers with loud laces', 'folk embroidery and beads',
  'holographic jackets', 'animal hoods', 'backpacks and handheld items',
  'star face marks / face paint', 'wild multicolor hair with clips and letters',
];

/** City and lighting plates. Match the characters, not generic cyberpunk. */
export const CITY_PLATES = [
  'wet purple pavement', 'low-angle sneaker shots on bridges',
  'packed night walkways', 'boutique glass',
  'cardboard/sequin market stalls', 'cars with red leather interiors',
  'floating signage that looks half-illustrated',
];

export const SHOT_LISTS = {
  spark: [
    'Chest-up, hair exploding out of frame, irritated eyes, star mark.',
    '3/4 smirk, chain belt in focus.',
    'Full body, forward lean, one fist half-raised.',
    'Walking shot, chain swinging, crowd turning.',
    'Back view, vest runes readable.',
    'Shoe hero: yellow or clashing pair, dirty glow.',
    'Hair hero: clips and letters isolated on black.',
    'Accessory hero: chain belt only.',
    'Faces: smug, pissed, delighted, "say it again," mid-shout.',
    'Outfit A vest. Outfit B cropped jacket. Outfit C maximal.',
    'Neon alley, wet ground, magenta bounce light.',
    'Handmade version: cardboard vest, glued sequin runes.',
    'Back seat of a car, yelling, window down.',
    'Crowd version: 12 civilians already wearing a cheaper copy of the belt.',
    'Turnaround on a white void, then the same turnaround in VESTA night.',
  ],
  softlock: [
    'Hood up, eyes just visible, looking past camera.',
    '3/4, one hand pulling the sleeve over the knuckles.',
    'Full body, smaller than Spark in the same frame.',
    'Walking behind a crowd, almost cropped out.',
    'Back view, huge hood graphic, no face.',
    'Shoe hero: clean but not loud.',
    'Hood graphic hero: panda face half-shadowed.',
    'Pocket / sleeve detail.',
    'Faces: avoid, flinch, tiny smile, blank, "don’t."',
    'Outfit A grey-black hoodie. Outfit B pastel. Outfit C hoodie plus one dangerous chain.',
    'Night bridge, they are the only figure not catching neon.',
    'Handmade version: stitched felt hoodie, visible imperfections.',
    'Passenger seat, seatbelt on, staring at the floor.',
    'Crowd version: nobody facing them.',
    'Side-by-side with Spark. Spark occupies the frame. Soft Lock is a leftover shape.',
  ],
  driver: [
    'Head-on, tiny furious eyes, no cute sparkle.',
    '3/4 in a red leather interior.',
    'Full body standing on a seat, not a floor.',
    'Walking on sneakers that look wrong and perfect on bird legs.',
    'Back view, jacket too human.',
    'Shoe / foot hero. This will sell the character.',
    'Face hero, no background.',
    'Wheel and seatbelt as accessories.',
    'Faces: rage, focus, smug after a turn, panic, "get in."',
    'Outfit A naked-of-drip body. Outfit B street jacket. Outfit C full driver kit.',
    'Night freeway, purple car interior.',
    'Handmade version: felt bird, plastic wheel, cardboard dash.',
    'Driving shot from the back seat, crew screaming.',
    'Crowd version: street parting around a car that should not fit.',
    'Turnaround with and without the jacket so anatomy stays consistent.',
  ],
  mirror: [
    'Beauty portrait with a wrong reflection in the pupil.',
    '3/4, jacket throwing a second rim light that does not match the scene.',
    'Full body, runway line, one foot pointed.',
    'Walking through glass shopfronts, three reflections, one of them late.',
    'Back view, hologram seams.',
    'Shoe hero: luxury street, sharp.',
    'Hair hero: controlled but unreal.',
    'Jacket hero: iridescent, almost UI.',
    'Faces: blank model, tiny smile, cold, glitch-smile, packet-stolen stare.',
    'Outfit A glass coat. Outfit B black-tie street. Outfit C fisheye distorted fit.',
    'Mirror Mile night, infinite reflections.',
    'Handmade version: foil jacket, beads as pixels.',
    'Elevator shot, they look like the person next to them for one frame.',
    'Crowd version: six people wearing the same face lighting.',
    'Turnaround plus a "false packet" overlay sheet.',
  ],
  folkglitch: [
    'Portrait, beads catching light, modern eye makeup.',
    '3/4, sash + sneaker in the same frame.',
    'Full body, planted stance, arms slightly out.',
    'Walking through a market, people stepping with them.',
    'Back view, embroidery map.',
    'Shoe hero: ceremonial sock into a chunky sneaker.',
    'Hair hero: dressed hair, pins, thread.',
    'Accessory hero: bead necklace or handmade RK mark.',
    'Faces: proud, amused, singing, warning, blessing-like calm.',
    'Outfit A full folk. Outfit B folk + hoodie. Outfit C folk + hologram sash.',
    'Lowline night market, cardboard stalls.',
    'Physical craft version: real sequins, glue, cardboard logo.',
    'Back seat, careful with the beads, Driver annoyed.',
    'Crowd version: a ring of people, same rhythm.',
    'Turnaround plus close-ups of every textile.',
  ],
  pair: [
    'Dual portrait, Juno in focus, Moss almost cropped.',
    'Reverse: Moss in focus, Juno mouth open in the background.',
    'Full body, shared stance line.',
    'Walking: Juno first, Moss a beat behind.',
    'Back view with a linking chain between them.',
    'Two shoe heroes on one plate, same model, different dirt.',
    'Hair plate, loud vs quiet.',
    'Shared accessory plate.',
    'Faces: Juno five expressions, Moss five, then three together.',
    'Outfit A matched. Outfit B contrast. Outfit C split jacket.',
    'Neon crosswalk, one in light, one in shadow.',
    'Handmade version: two paper dolls on one card.',
    'Car shot: Juno leaning at the window, Moss belted in, Driver done with both.',
    'Crowd version: people watching Juno, a gap opening for Moss.',
    'Turnaround of both, plus a "camera lock" overlay showing only one highlighted.',
  ],
};

/** The generic 15-plate spine, for any Kin added later. */
export const PLATE_SPINE = [
  'Front portrait, chest-up, neutral light',
  '3/4 portrait, attitude face',
  'Full body, standing stance',
  'Full body, walking',
  'Back view',
  'Shoes hero shot',
  'Hair hero shot',
  'Accessory hero shot',
  'Expression sheet',
  'Outfit A / B / C',
  'Night neon version',
  'Handmade / physical-material version',
  'In-vehicle version',
  'Crowd version',
  'Turnaround (front, side, back)',
];

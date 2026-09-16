/**
 * VESTA — the city, as a Y-shaped river basin turned into a fashion machine.
 *
 *   Spine       the old canal, covered in places, open in others. The Hem.
 *   Left arm    Mirror Mile, climbing a ridge of glass.
 *   Right arm   Lowline market terraces, falling toward the water.
 *   Crotch      Null Court, the black-market knot.
 *   Above       Runway Spire, stabbed through the old civic roof.
 *   Below       Undercut, non-human levels in the former service tunnels.
 *   East        the Flood, an open drop-basin that used to be a rail yard.
 *
 * Almost every district can see another district. You are never in a closed
 * video-game box; a bridge always reveals a second economy.
 *
 * This file is the city's plan. Only Lowline is built as playable geometry
 * (src/data/districts/lowline.js); the rest carry their dimensions, materials,
 * rules and scenarios so they are built to the same language rather than
 * reinvented per district.
 */

/** The city is a stacked garment. Streets are seams, buildings are hangers. */
export const CITY = {
  name: 'VESTA',
  time: '11:47 PM, after rain, before the next Drop',
  sky: 'bruised violet, no stars, low wet cloud, holographic weather like spilled highlighter',
  shape: 'Y-shaped river basin',
  spine: 'the Hem — the old canal',
  palette: {
    asphalt: '#2a1b33',        // eggplant
    puddle: '#ff3fa4',         // magenta
    signage: '#c9ff4a',        // sour lime
    rail: '#f2c14e',           // taxi-yellow
    interior: '#6d1a24',       // oxblood shop interiors
    boutique: '#f4f1e8',       // milk-plastic
    market: '#c9a227',         // dirty gold beads
    chrome: '#d8cfc4',         // slightly too warm
  },
  /** Material law. Nothing is perfectly CAD. */
  materials: {
    asphalt: 'illustration grain, oil-colour blooms',
    concrete: 'poured, then overdrawn with ink joints',
    glass: 'thick, green-violet, full of late reflections',
    metal: 'chipped paint, hand-polished corners',
    cloth: 'banners, drying jackets, hanging samples, tarps used as walls',
    handmade: 'cardboard, hot glue, sequins, beads, paper logos, taped seams',
  },
  /** Camera grammar for every space. */
  camera: [
    'Low sneaker-height shots must work.',
    'Silhouettes must read at 30 m.',
    'There is always a rail, curb, canopy or sign to frame the character.',
    'Neon never sits on a black void. It hits wet ground, socks, glass and steam.',
  ],
  /** Night is not dark. Night is stained. */
  light: {
    key: 'distant magenta from signage',
    fill: 'wet ground bounce, cooler than the key',
    practicals: 'work lamps, vitrines, phone screens, shrine candles',
    rims: 'lime or gold, thin',
    avoid: 'cyan fog soup',
    note: 'Faces pick up colour from clothes. The city is a fitting room.',
  },
};

export const DISTRICTS = {
  lowline: {
    id: 'lowline',
    index: 1,
    name: 'LOWLINE',
    function: 'tutorial, market, handmade leakage, safe chaos',
    feeling: 'a night bazaar sewn onto a transport terrace',
    built: 'lowline-terrace',
    plan: {
      lengthM: 180, widthM: [28, 40],
      terraces: [
        { name: 'River lip', widthM: 6, note: 'wet, windy, vendors facing the water' },
        { name: 'Stall band', widthM: [14, 18], note: 'stalls, kiosks, pop-up ateliers' },
        { name: 'Arcade wall', widthM: [8, 10], note: 'covered walk against old brick-and-tile' },
      ],
      bridges: [{ atM: 60, arched: true }, { atM: 150, arched: true }],
      buildings: '4-6 storey, tile, painted brick, patched with boutique inserts',
      upperFloors: [
        'laundry and sample garments on poles',
        'balconies too small for parties, perfect for one person and a jacket',
        'window mannequins facing down at the terrace',
      ],
    },
    wants: ['street', 'craft', 'folk'],
    rejects: ['luxury'],
    wires: true,
    details: [
      'Price tags written on medical tape.',
      'A cardboard RK logo leaning against a cooler.',
      'Extension cords taped in silver gaffer, running like veins.',
      'A cat-sized drone sleeping in a shoe box.',
      'Puddles with floating sequins.',
      'Hand-painted "NO SCANS INSIDE HOODS" on a column.',
      'One stall uses an actual car hood as a table.',
      'Bridge underside has stickers at jump-height, not adult-eye-height.',
    ],
    sound: ['generators', 'beads', 'chatter', 'slapping sandals', 'distant train'],
    scenarios: [
      'Tutorial walk from arcade wall to river lip. Soft Lock can vanish in the hoodie tunnel. Spark gets scanned the second they step onto the glass strip.',
      'Steal a sample sneaker from the shoe altar without the spotlight operator turning.',
      'Extraction is the first arched bridge: 22 m while market people score the fit.',
    ],
  },

  mirrormile: {
    id: 'mirrormile',
    index: 2,
    name: 'MIRROR MILE',
    function: 'luxury infiltration, glass, cameras, false belonging',
    feeling: 'a beautiful throat. Everything reflects. Nothing forgives.',
    plan: {
      lengthM: 220, widthM: 16,
      medianM: 2,
      median: 'black polished stone with orchid-like sculptural racks holding rotating coats',
      climbM: 6,
      climbNote: 'the slope matters — characters always look like they are arriving',
      north: { name: 'House glass', facadeM: [12, 20], note: 'flagship stores, no graffiti' },
      south: { name: 'Service glass', note: 'steam rooms, alterations, staff corridors if you look past the display' },
      facade: {
        glassMm: 18, glassNote: 'structural, with a drawn edge when close',
        lightK: [4200, 4500], lightNote: 'milkier than the street',
        plinthM: 0.4,
        hero: 'one hero garment per window, never a cluttered rack',
        mannequins: 'RebelKin proportions, not fashion-doll blanks',
        floor: 'pale brass THREAD lines forming a tailor’s pattern grid',
      },
      doors: {
        heightM: 3, handles: false,
        rule: 'They smell who you are. Presence too low and the door waits. Too high and it opens too eagerly and alerts the floor.',
      },
      sideCuts: [
        { name: 'Fitting alley', widthM: 3.1, note: 'black tile, perfume exhaust, staff only until Mirror copies a packet' },
        { name: 'Alterations mezzanine', note: 'visible through glass, people pinned with light instead of needles' },
        { name: 'Coat library', note: 'two-storey interior of hanging garments on motorized rails. Gameplay jungle gym.' },
      ],
    },
    wants: ['luxury', 'holo', 'new'],
    rejects: ['craft'],
    wires: false,
    details: [
      'Rain does not bead normally on the black median. It forms perfect disks.',
      'Shoe-cleaning robots the size of handbags.',
      'A public posture rail where people practice standing.',
      'Security not in armour. Security in perfect plain clothes that are too perfect.',
      'Reflections are late by 2-3 frames in expensive glass. That is a Mirror clue.',
      'Floor vents exhale warm vanilla and ozone.',
      'One cracked tile, repaired with a gold seam. Everybody photographs it. Cameras cluster there.',
    ],
    sound: ['hush', 'heel points', 'HVAC perfume', 'glass flex'],
    scenarios: [
      'Ghost Fit: walk 80 m of flagship frontage without dropping Ignore.',
      'Facejack: copy a doorman packet under the orchid racks.',
      'Extract through the coat library while rails rearrange into a maze.',
    ],
  },

  runwayspire: {
    id: 'runwayspire',
    index: 3,
    name: 'RUNWAY SPIRE',
    function: 'vertical set-piece, spectacle missions, public judgment',
    feeling: 'a mall that became a cathedral that became a live broadcast',
    plan: {
      coreM: [48, 48],
      sleeves: 4,
      sleeveNote: 'circulating ramps wide enough for a crew of four',
      floors: [
        { id: 'L0', name: 'Arrival pit', heightM: 16, note: 'hanging banners of current Drops, crowd on all balconies looking down' },
        { id: 'L3', name: 'Sample Courts', note: 'four glass runways crossing a void' },
        { id: 'L7', name: 'Private houses', note: 'quiet, carpeted, vicious' },
        { id: 'L12', name: 'Broadcast Collar', note: 'outdoor wind, city view, extraction catwalk' },
      ],
      void: [
        'suspended garments',
        'slow-moving drone racks',
        'a monumental staircase that is actually a runway',
        'LED rain switchable from weather to applause',
      ],
      circulation: ['switchback ramps', 'glass elevators that scan on entry and again on exit',
        'service dumbwaiters Soft Lock can use', 'an exterior maintenance spine Driver can treat like a road'],
    },
    wants: ['luxury', 'new', 'holo'],
    rejects: [],
    wires: false,
    details: [
      'Each floor has a different carpet grain so you know altitude without UI.',
      'Handrails are stitched leather over steel.',
      'The void updraft moves hair and light jackets.',
      'Spectator phones are architecturally important: little galaxies of screen-light along every rail.',
      'Emergency doors are uglier and therefore honest. Concrete still has pencil marks from installers.',
      'A giant ring light is built into L12’s floor. Extraction happens inside it.',
    ],
    sound: ['atrium bloom', 'applause samples', 'wind in void', 'drone racks'],
    scenarios: [
      'Cross the L3 glass runways during a live showing. Stepping off-beat raises Heat.',
      'Soft riot: Spark on the monumental stair, Soft Lock in a dumbwaiter.',
      'Final walk on L12 with wind, rain, and the whole city as audience.',
    ],
  },

  undercut: {
    id: 'undercut',
    index: 4,
    name: 'UNDERCUT',
    function: 'non-human quarter, species rules, weird scale, refuge',
    feeling: 'a service world that grew its own downtown',
    plan: {
      street: { name: 'the Culvert', lengthM: 120, widthM: [9, 14], ceilingM: [4.2, 6.8] },
      cornice: 'pipes are the cornice line. Lights are caged and warm.',
      burrows: ['sleeping niches', 'vehicle wombs for Driver', 'communal hood rooms', 'kitchens around steam leaks'],
      scale: 'Some doors are 1.4 m. Some halls are comfortable only if you crouch or are not human-proportioned.',
      surfaces: ['tile never meant to be seen, now polished by traffic', 'condensation maps',
        'murals on insulation foam', 'nests of jackets instead of furniture',
        'floor lane markings for mixed species: biped, long-body, rolling, hovering'],
    },
    wants: ['street', 'craft'],
    rejects: ['luxury', 'holo'],
    wires: true,
    details: [
      'Nameplates at knee height and at 2.4 m.',
      'Water tastes metallic. Show it with mineral crust.',
      'Soft Lock is popular here. Spark’s Presence wakes ceiling cameras in chains.',
      'A shrine made from lost shoes.',
      'Vehicle bays with seatbelts hanging like vines.',
      'Folk Glitch textiles used as privacy curtains.',
    ],
    sound: ['drip', 'fans', 'low voices', 'vehicle ticks'],
    scenarios: [
      'Driver wakes a sleeping service car in a vehicle womb.',
      'The Pair split across two height-gated doors.',
      'Hide from a Mirror Mile pursuit because THREAD classification gets confused underground.',
    ],
  },

  nullcourt: {
    id: 'nullcourt',
    index: 5,
    name: 'NULL COURT',
    function: 'hub, black market, mission board, atelier home',
    feeling: 'a knot of alleys around an old covered crossing',
    plan: {
      plazaM: [55, 40],
      canopy: 'patched glass and tin',
      alleys: 5, alleyNote: 'none are straight',
      centre: { name: 'the Block', storeys: 3, note: 'shipping interiors, staircases, fitting rooms. This is the player atelier.' },
      around: ['identity dentists', 'packet forgers', 'dye pits',
        'a bar that only serves people currently wearing a contradiction',
        'a wall of confiscated cameras'],
      ground: 'sticky in places',
      light: 'mixed and wrong: one sodium bath, one boutique white, one red work lamp',
      atelier: {
        ground: 'dirty studio, sewing machines, floor scanner, mannequins of the six Kin',
        mezzanine: 'thread archives, hanging successful compiles',
        roof: 'roof slit with a view up to Runway Spire, so ambition is always visible',
        details: ['pins in walls', 'takeout', 'a stolen Mirror Mile orchid in a bucket',
          'Driver’s seat ripped out and used as a couch'],
      },
    },
    wants: ['new', 'craft'],
    rejects: [],
    wires: true,
    details: [
      'A wall of confiscated cameras, all still faintly powered.',
      'The bar checks your compile at the door, not your age.',
    ],
    sound: ['mixed radios', 'sewing', 'argument', 'kettle'],
    scenarios: [
      'Contract pickup.',
      'Illegal compile with a risk of public exposure in the plaza.',
      'Rival crew walks through while you are mid-change.',
    ],
  },

  flood: {
    id: 'flood',
    index: 6,
    name: 'THE FLOOD',
    function: 'endgame drop zone, extraction chaos, weather as loot',
    feeling: 'a rail yard that became an arena',
    plan: {
      basinM: [300, 140],
      sunken: true,
      tracks: 'old tracks still visible as ribs in the concrete',
      towerLights: 4,
      fence: 'chain-link repaired with fashion banners',
      drop: ['trait canisters fall on parachute-racks', 'crowds surge on the berms',
        'water pools in track beds',
        'holographic rain writes item names in the air for two seconds'],
      perimeter: ['commentary booths', 'ambulance fashion: medics in reflective couture',
        'betting kiosks', 'a long extract tunnel that dumps you back toward Null Court'],
    },
    wants: ['new', 'kinetic'],
    rejects: ['quiet'],
    wires: false,
    details: [
      'Painted circles where previous 1/1s landed.',
      'Shoes stuck in tar.',
      'A ruined boutique facade standing alone like a stage flat.',
      'Wind is stronger here. Hair and banners work hard.',
      'Ground numbering is still rail-yard white paint: 18, 19, 21, 21A.',
    ],
    sound: ['open air', 'banners', 'PA', 'gravel', 'drones'],
    scenarios: [
      'Night Drop: survive a public trait rain and leave with a compiled 1/1.',
      'Contest an extraction runway against a rival crew.',
      'Hold a landing circle while the berms surge.',
    ],
  },
};

/**
 * CONNECTORS. Do not teleport. Each is 45-90 seconds of travel and each one
 * teaches a rule before you arrive needing it.
 */
export const CONNECTORS = [
  {
    id: 'hem-bridge-a',
    name: 'Hem Bridge A',
    from: 'lowline', to: 'nullcourt',
    seconds: 50,
    lengthM: 22,
    teaches: 'Extraction is a walk, and being looked at is the win condition.',
    note: 'Tutorial extract. Slightly arched, sneaker-height rails, stickers on the underside at jump height.',
  },
  {
    id: 'service-gut',
    name: 'Service Gut',
    from: 'nullcourt', to: 'undercut',
    seconds: 70,
    teaches: 'THREAD reads you differently underground. Classification is local, not absolute.',
    note: 'Down-ramp. Pipes, heat, graffiti at two heights — knee and 2.4 m — because two kinds of body wrote it.',
  },
  {
    id: 'glass-escalade',
    name: 'Glass Escalade',
    from: 'nullcourt', to: 'mirrormile',
    seconds: 60,
    teaches: 'Access is a costume check. The lift scans on entry and again on exit.',
    note: 'Elevator bank. Silent, scented, hostile. Your reflection arrives before you do.',
  },
  {
    id: 'needle-lift',
    name: 'Needle Lift',
    from: 'mirrormile', to: 'runwayspire',
    seconds: 85,
    teaches: 'Height is exposure. Up here the whole city is an audience.',
    note: 'Exterior cage lift from the Mirror Mile shoulder to Spire L3. Wind, city, terrifying beauty.',
  },
];

/** What must never be built. Kept in code so it can be checked, not just felt. */
export const NEGATIVE = [
  'empty eight-lane night highways',
  'identical neon towers to the horizon',
  'wet concrete with no stores',
  'floating UI cities',
  'sci-fi monorails as the only identity',
  'yellow-on-black cyber rain',
  'warehouses with one couch and a gun crate',
  'streets wider than they are interesting',
  'cameras only as decoration',
  'clean CAD with no hand-drawn close-up marks',
];

export const LAW_OF_VESTA =
  'VESTA is a walkable wardrobe after rain. Every street has a seam, a hook, a '
  + 'camera, a puddle, and a place to be seen. If I cannot photograph a RebelKin '
  + 'sneaker against the architecture and immediately know the district, the '
  + 'layout is wrong.';

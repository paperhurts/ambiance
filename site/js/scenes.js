// The places. Each layer names the recordings it uses by pool (see audio/manifest.json); a layer
// whose recordings aren't installed quietly drops out, so the app never offers a dead slider.
//
// Levels are slider positions (0–1, the fader is squared). `gain` calibrates a layer against the
// others: beds are all normalised to the same loudness, shots to a slightly louder one.

// How each species sings: phrases per bout, seconds between phrases, rest between bouts,
// and where it tends to sit (elevation in degrees, distance in metres).
const HABITS = {
  blackbird: { bout: [3, 7], gap: [2.5, 5], rest: [18, 55], el: [8, 40], dist: [12, 35] },
  robin: { bout: [3, 8], gap: [2, 4.5], rest: [15, 45], el: [5, 30], dist: [8, 25] },
  'song-thrush': { bout: [4, 10], gap: [0.8, 2.2], rest: [20, 60], el: [10, 45], dist: [15, 40] },
  wren: { bout: [2, 4], gap: [3, 7], rest: [20, 70], el: [0, 15], dist: [6, 25], gain: 0.75 },
  'wood-pigeon': { bout: [1, 3], gap: [5, 10], rest: [40, 120], el: [15, 45], dist: [20, 50] },
  'collared-dove': { bout: [2, 4], gap: [2, 4], rest: [40, 120], el: [15, 40], dist: [15, 40] },
  chaffinch: { bout: [3, 7], gap: [5, 10], rest: [30, 90], el: [10, 40], dist: [12, 35] },
  'great-tit': { bout: [2, 5], gap: [2, 5], rest: [30, 90], el: [5, 35], dist: [8, 30] },
  'blue-tit': { bout: [2, 4], gap: [2, 5], rest: [30, 90], el: [5, 35], dist: [8, 30] },
  dunnock: { bout: [2, 5], gap: [3, 8], rest: [30, 90], el: [0, 15], dist: [6, 20] },
  'american-robin': { bout: [4, 10], gap: [1, 3], rest: [20, 60], el: [10, 40], dist: [12, 35] },
  'northern-cardinal': { bout: [3, 6], gap: [3, 7], rest: [20, 80], el: [10, 35], dist: [10, 30] },
  'mourning-dove': { bout: [1, 2], gap: [8, 15], rest: [40, 120], el: [10, 40], dist: [15, 45] },
  'carolina-wren': { bout: [3, 6], gap: [4, 8], rest: [30, 90], el: [0, 20], dist: [8, 25], gain: 0.8 },
  'song-sparrow': { bout: [3, 6], gap: [5, 10], rest: [30, 90], el: [0, 20], dist: [8, 25] },
  'house-finch': { bout: [2, 5], gap: [3, 8], rest: [30, 90], el: [10, 35], dist: [10, 30] },
  // each mockingbird recording is already a run of several phrases
  mockingbird: { bout: [2, 5], gap: [0.6, 1.8], rest: [30, 90], el: [10, 40], dist: [10, 30] },
  'hermit-thrush': { bout: [4, 8], gap: [3, 6], rest: [30, 90], el: [5, 30], dist: [20, 50] },
  'wood-thrush': { bout: [4, 8], gap: [3, 6], rest: [30, 90], el: [5, 30], dist: [20, 50] },
  'winter-wren': { bout: [1, 3], gap: [4, 9], rest: [30, 90], el: [0, 10], dist: [10, 30], gain: 0.8 },
  'red-eyed-vireo': { bout: [6, 14], gap: [1, 2.5], rest: [30, 90], el: [20, 50], dist: [20, 45] },
  'black-capped-chickadee': { bout: [1, 3], gap: [3, 8], rest: [40, 120], el: [5, 30], dist: [8, 30] },
  chickadee: { bout: [1, 3], gap: [3, 8], rest: [40, 120], el: [5, 30], dist: [8, 30] },
  nuthatch: { bout: [2, 5], gap: [2, 5], rest: [40, 120], el: [10, 35], dist: [10, 30] },
  nutcracker: { bout: [1, 3], gap: [2, 5], rest: [50, 150], el: [15, 45], dist: [25, 70] },
  cuckoo: { bout: [3, 8], gap: [1.2, 2.2], rest: [60, 180], el: [10, 30], dist: [60, 120] },
  raven: { bout: [1, 3], gap: [2, 5], rest: [60, 200], el: [20, 60], dist: [40, 120] },
  crow: { bout: [1, 3], gap: [2, 5], rest: [60, 200], el: [15, 45], dist: [40, 100] },
  // Florida
  cardinal: { bout: [3, 6], gap: [3, 7], rest: [20, 80], el: [10, 35], dist: [10, 30] },
  // a pair that keeps together, answering each other
  'tufted-titmouse': { bout: [2, 5], gap: [1.4, 3.5], rest: [25, 75], el: [10, 35], dist: [10, 30], n: 2, together: true },
  'blue-jay': { bout: [1, 3], gap: [1.5, 4], rest: [45, 150], el: [10, 40], dist: [15, 45] },
  'red-bellied-woodpecker': { bout: [1, 3], gap: [3, 8], rest: [45, 150], el: [15, 45], dist: [15, 45] },
  'northern-parula': { bout: [3, 8], gap: [6, 12], rest: [30, 90], el: [20, 50], dist: [15, 40] },
  'red-shouldered-hawk': { bout: [1, 2], gap: [3, 6], rest: [90, 300], el: [30, 70], dist: [60, 150] },
  'ground-dove': { bout: [1, 2], gap: [6, 12], rest: [40, 120], el: [0, 10], dist: [8, 25] },
  // Everglades
  'red-winged-blackbird': { bout: [3, 8], gap: [3, 8], rest: [20, 60], el: [0, 15], dist: [10, 40], n: 2 },
  'boat-tailed-grackle': { bout: [2, 5], gap: [2, 6], rest: [30, 90], el: [0, 20], dist: [15, 50] },
  limpkin: { bout: [1, 3], gap: [2, 6], rest: [60, 200], el: [0, 10], dist: [40, 120] },
  'sandhill-crane': { bout: [1, 2], gap: [5, 10], rest: [90, 300], el: [0, 10], dist: [80, 250] },
  'great-egret': { bout: [1, 2], gap: [3, 8], rest: [60, 200], el: [0, 30], dist: [20, 80] },
  osprey: { bout: [1, 3], gap: [3, 8], rest: [60, 180], el: [30, 70], dist: [40, 120] },
  // frogs, at the water's edge all round the pond, several of each calling
  'green-treefrog': { bout: [1, 3], gap: [1, 4], rest: [15, 50], el: [-5, 10], dist: [4, 25], n: [2, 3], gain: 0.7 },
  'squirrel-treefrog': { bout: [1, 3], gap: [1, 4], rest: [20, 60], el: [-5, 15], dist: [4, 25], n: [2, 3], gain: 1.3 },
  'barking-treefrog': { bout: [1, 3], gap: [1, 3], rest: [20, 60], el: [-10, 0], dist: [6, 30], n: 2 },
  'pig-frog': { bout: [2, 5], gap: [1, 4], rest: [20, 60], el: [-10, 0], dist: [8, 40], n: 2, gain: 1.3 },
  'leopard-frog': { bout: [1, 3], gap: [2, 6], rest: [30, 90], el: [-10, 0], dist: [5, 25], n: 2 },
  'southern-toad': { bout: [1, 2], gap: [3, 8], rest: [30, 90], el: [-10, 0], dist: [6, 30], n: 2 },
  'oak-toad': { bout: [1, 3], gap: [1, 3], rest: [20, 60], el: [-10, 0], dist: [4, 20], n: 2 },
  'cricket-frog': { bout: [1, 2], gap: [1, 3], rest: [20, 60], el: [-10, 0], dist: [3, 20], n: [2, 3] },
  // night birds
  'barred-owl': { bout: [1, 2], gap: [5, 15], rest: [90, 300], el: [10, 40], dist: [40, 120] },
  'chuck-wills-widow': { bout: [2, 5], gap: [0.3, 1], rest: [40, 150], el: [5, 25], dist: [30, 80] },
  'screech-owl': { bout: [1, 3], gap: [4, 10], rest: [60, 200], el: [5, 30], dist: [20, 60] },
};

// What each species is called on its slider.
const NAMES = {
  blackbird: 'Blackbird', robin: 'Robin', 'song-thrush': 'Song thrush', wren: 'Wren', 'great-tit': 'Great tit',
  'wood-pigeon': 'Wood pigeon', chaffinch: 'Chaffinch', raven: 'Raven', nuthatch: 'Red-breasted nuthatch',
  nutcracker: "Clark's nutcracker", chickadee: 'Chickadee', mockingbird: 'Mockingbird', cardinal: 'Cardinal',
  'carolina-wren': 'Carolina wren', 'mourning-dove': 'Mourning dove', 'tufted-titmouse': 'Tufted titmouse',
  'blue-jay': 'Blue jay', 'red-bellied-woodpecker': 'Red-bellied woodpecker', 'northern-parula': 'Northern parula',
  'red-shouldered-hawk': 'Red-shouldered hawk', 'ground-dove': 'Ground dove',
  'red-winged-blackbird': 'Red-winged blackbird', 'boat-tailed-grackle': 'Boat-tailed grackle', limpkin: 'Limpkin',
  'sandhill-crane': 'Sandhill crane', 'great-egret': 'Great egret', osprey: 'Osprey',
  'green-treefrog': 'Green treefrog', 'squirrel-treefrog': 'Squirrel treefrog', 'barking-treefrog': 'Barking treefrog',
  'pig-frog': 'Pig frog', 'leopard-frog': 'Leopard frog', 'southern-toad': 'Southern toad', 'oak-toad': 'Oak toad',
  'cricket-frog': 'Cricket frog', 'barred-owl': 'Barred owl', 'chuck-wills-widow': "Chuck-will's-widow",
  'screech-owl': 'Screech owl',
};
const FROGS = ['green-treefrog', 'squirrel-treefrog', 'barking-treefrog', 'pig-frog', 'leopard-frog', 'southern-toad', 'oak-toad', 'cricket-frog'];
const NIGHT_BIRDS = ['barred-owl', 'chuck-wills-widow', 'screech-owl'];
const nameOf = (id) => NAMES[id] || id.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
const DEFAULT_HABIT = { bout: [2, 6], gap: [2, 6], rest: [20, 80], el: [5, 35], dist: [12, 40] };

export function buildScenes(pools) {
  const list = (key) => pools[key] || [];
  const files = (...keys) => keys.flatMap((k) => list(k).map((i) => i.file));
  const items = (...keys) => keys.flatMap((k) => list(k).map(({ file, tag, weight }) => ({ file, tag, weight })));
  // Every remaining pool in the scene is a species. `count` birds of each; `quiet` stretches
  // their rests (a midday wood or a winter one is sparser than the dawn chorus).
  const flock = (scene, exclude, { count = [1, 2], quiet = 1, only } = {}) =>
    Object.keys(pools)
      .filter((k) => k.startsWith(scene + '/') && !exclude.includes(k.slice(scene.length + 1)) && (!only || only.includes(k.slice(scene.length + 1))))
      .map((k) => {
        const id = k.slice(scene.length + 1);
        const h = HABITS[id] || DEFAULT_HABIT;
        const solo = id.includes('pigeon') || id.includes('dove') || id === 'raven' || id === 'crow';
        return { id, files: items(k), count: h.n ?? (solo ? 1 : count), together: h.together, bout: h.bout, gap: h.gap, rest: [h.rest[0] * quiet, h.rest[1] * quiet], gain: h.gain ?? 1, space: { el: h.el, dist: h.dist } };
      });

  // One slider per species, gathered under a "Birds" heading in the mix.
  const birds = (scene, exclude, { count, quiet, only, level = 0.6, gain = 0.9, reverb = 0.3, drive, relocate = [90, 300], prefix = '', group = 'Birds', icon = 'bird' } = {}) =>
    flock(scene, exclude, { count, quiet, only }).map((sp) => ({
      id: prefix + sp.id,
      type: 'flock',
      label: nameOf(sp.id),
      icon,
      group,
      level,
      gain,
      reverb,
      relocate,
      drive,
      species: [sp],
    }));

  const storm = {
    id: 'storm',
    name: 'Storm at Sea',
    kicker: 'Night, on the shore',
    what: 'Breakers, rain and gale, thunder rolling in off the water.',
    gain: 1.2,
    reverb: { type: 'open', level: 0.35 },
    drivers: { storm: { range: [0.35, 1], every: [70, 200], tau: 30 } },
    layers: [
      { id: 'surf', type: 'bed', label: 'Breakers', icon: 'wave', files: files('storm/surf'), level: 0.82, hold: [30, 70], xfade: [6, 10], drive: { by: 'storm', gain: [0.7, 1] } },
      { id: 'rain', type: 'bed', label: 'Rain', icon: 'rain', files: files('storm/rain'), level: 0.8, gain: 1.2, drive: { by: 'storm', gain: [0.45, 1] }, wander: [0.75, 1] },
      { id: 'wind', type: 'bed', label: 'Gale', icon: 'wind', files: files('storm/wind'), level: 0.55, gain: 0.8, drive: { by: 'storm', gain: [0.4, 1] }, wander: [0.5, 1], wanderEvery: [3, 10], wanderTau: [1.5, 5] },
      { id: 'thunder', type: 'storm', label: 'Thunder', icon: 'bolt', pool: items('storm/thunder'), lazy: true, keep: 3, every: [40, 150], first: [3, 12], level: 0.75, gain: 1.8, reverb: 0.2, drive: { by: 'storm', rate: [0.35, 1.7] } },
      { id: 'buoy', type: 'shots', label: 'Bell buoy', icon: 'bell', pool: items('storm/buoy'), every: [9, 30], level: 0.25, gain: 0.7, reverb: 0.4, space: { az: [-70, -30], el: [0, 2], dist: [140, 220], air: 260 } },
    ],
  };

  const waterfall = {
    id: 'waterfall',
    name: 'Forest Waterfall',
    kicker: 'Midday, deep in the woods',
    what: 'A waterfall through the trees, a creek at your feet, birds above.',
    gain: 2.25,
    reverb: { type: 'forest', level: 0.45 },
    layers: [
      { id: 'falls', type: 'bed', label: 'Waterfall', icon: 'falls', files: files('waterfall/falls'), level: 0.78 },
      { id: 'creek', type: 'bed', label: 'Creek', icon: 'water', files: files('waterfall/creek'), level: 0.55, gain: 0.9 },
      { id: 'forest', type: 'bed', label: 'Forest air', icon: 'leaf', files: files('waterfall/forest'), level: 0.5, gain: 0.8 },
      { id: 'leaves', type: 'bed', label: 'Leaves', icon: 'wind', files: files('waterfall/leaves'), level: 0.35, gain: 0.8, wander: [0.3, 1], wanderEvery: [4, 12], wanderTau: [2, 5] },
      ...birds('waterfall', ['falls', 'creek', 'forest', 'leaves', 'woodpecker'], { count: 1, quiet: 2.2, level: 0.62, reverb: 0.35 }),
      { id: 'woodpecker', type: 'shots', label: 'Woodpecker', icon: 'bird', group: 'Birds', pool: items('waterfall/woodpecker'), every: [50, 180], level: 0.4, gain: 0.8, reverb: 0.4, space: { dist: [30, 80], el: [5, 25] } },
    ],
  };

  const garden = {
    id: 'garden',
    name: 'Sunrise Garden',
    kicker: 'First light',
    what: 'The dawn chorus building as the sun comes up over the garden.',
    gain: 3.2,
    reverb: { type: 'forest', level: 0.3 },
    // the light (and the birds) build over the first 25 minutes, then hold
    drivers: { dawn: { ramp: 1500, start: 0.12 } },
    layers: [
      { id: 'chorus', type: 'bed', label: 'Dawn chorus', icon: 'bird', files: files('garden/chorus'), level: 0.6, drive: { by: 'dawn', gain: [0.55, 1] } },
      { id: 'breeze', type: 'bed', label: 'Breeze', icon: 'leaf', files: files('garden/breeze'), level: 0.3, gain: 0.8, wander: [0.35, 1], wanderEvery: [4, 12] },
      { id: 'fountain', type: 'bed', label: 'Fountain', icon: 'water', files: files('garden/fountain'), level: 0, gain: 0.8, pan: 0.35 },
      { id: 'bee', type: 'shots', label: 'Bumblebees', icon: 'bee', pool: items('garden/bee'), every: [60, 220], level: 0.3, gain: 0.7, space: { az: [-120, 120], el: [-5, 15], dist: [1.5, 4], move: { az: [90, 200], dist: [4, 9] } } },
      ...birds('garden', ['chorus', 'breeze', 'fountain', 'bee', 'rooster'], { level: 0.68, gain: 0.85, relocate: [80, 240], drive: { by: 'dawn', rate: [0.55, 1.35] } }),
      { id: 'rooster', type: 'shots', label: 'Far-off rooster', icon: 'rooster', group: 'Birds', pool: items('garden/rooster'), every: [240, 720], level: 0, gain: 0.6, reverb: 0.4, space: { dist: [120, 260], el: [0, 3], air: 300 } },
    ],
  };

  // A native-plant pollinator garden in Florida. Every bird has its own slider.
  const beesAreBed = list('florida/bees').some((i) => i.dur > 20);
  const butterfly = {
    id: 'butterfly',
    name: 'Butterfly Garden',
    kicker: 'A Florida yard, mid-morning',
    what: 'Hibiscus, milkweed and wildflowers, butterflies and hummingbirds, a yard full of Florida birds.',
    gain: 3.6,
    reverb: { type: 'open', level: 0.25 },
    drivers: { breeze: { range: [0.15, 0.85], every: [30, 110], tau: 12 } },
    layers: [
      { id: 'morning', type: 'bed', label: 'Florida air', icon: 'leaf', files: files('florida/morning'), level: 0.55 },
      { id: 'palms', type: 'bed', label: 'Breeze in the palms', icon: 'palm', files: files('florida/palms'), level: 0.5, gain: 0.85, drive: { by: 'breeze', gain: [0.35, 1] }, wander: [0.6, 1] },
      { id: 'cicadas', type: 'bed', label: 'Cicadas', icon: 'cicada', files: files('florida/cicadas'), level: 0.42, gain: 0.8, wander: [0.45, 1], wanderEvery: [10, 30], wanderTau: [4, 10] },
      beesAreBed
        ? { id: 'bees', type: 'bed', label: 'Bees in the flowers', icon: 'bee', files: files('florida/bees'), level: 0.45, gain: 0.8, wander: [0.4, 1] }
        : { id: 'bees', type: 'shots', label: 'Bees', icon: 'bee', pool: items('florida/bees'), every: [40, 140], level: 0.35, gain: 0.75, space: { az: [-120, 120], el: [-10, 10], dist: [1.2, 3], move: { az: [80, 180], dist: [3, 7] } } },
      { id: 'chimes', type: 'bed', label: 'Wind chimes', icon: 'bell', files: files('florida/chimes'), level: 0, gain: 0.6, pan: 0.4 },
      { id: 'hummingbird', type: 'shots', label: 'Hummingbirds', icon: 'hummingbird', group: 'Birds', pool: items('florida/hummingbird'), every: [40, 140], first: [8, 30], level: 0.55, gain: 0.1, reverb: 0.1, space: { az: [-100, 100], el: [-5, 15], dist: [1.2, 3.5], move: { az: [60, 160], dist: [2, 5] } } },
      ...birds('florida', ['morning', 'palms', 'cicadas', 'bees', 'chimes', 'hummingbird'], { count: 1, quiet: 1.4, level: 0.6, gain: 0.85, reverb: 0.25 }),
    ],
  };

  // A summer thunderstorm over the Everglades, start to finish: the hot, still afternoon, the gust
  // front, the downpour with thunder overhead, then the storm drifting off and the frogs coming out.
  const gladesBeds = ['afternoon', 'gust', 'rain', 'downpour', 'drip', 'thunder'];
  const glades = {
    id: 'glades',
    name: 'Everglades Storm',
    kicker: 'Summer, four in the afternoon',
    what: 'Sawgrass to the horizon and a thunderhead building over it. The storm comes, pours and passes.',
    note: 'The storm comes and goes on its own: it rains most of the time, with a short, steamy break between storms. Each slider sets how loud that part is while it’s here.',
    requires: ['glades/afternoon', 'glades/downpour'],
    gain: 1.45,
    reverb: { type: 'open', level: 0.3 },
    drivers: {
      // the storm's life, repeating; the scene opens as the gust front hits, and it's raining most
      // of the time, with a short break between one storm and the next
      storm: {
        cycle: [
          { to: 1, dur: [360, 660] }, // the downpour, thunder overhead
          { to: 0.55, dur: [240, 420] }, // moving off: steady rain, the thunder rolling away
          { to: 0.18, dur: [150, 240] }, // the rain thinning to drips; frogs, a rainbow
          { to: 0.06, dur: [90, 180] }, // a short, steamy lull
          { to: 0.5, dur: [120, 200] }, // the next one building: far thunder, the light going
          { to: 0.85, dur: [40, 80] }, // the gust front
        ],
        begin: 5,
        start: 0.45,
        wobble: 0.08,
      },
      // what the storm leaves behind: drips, and the frogs
      after: { wake: 'storm', fall: 240 },
    },
    layers: [
      { id: 'afternoon', type: 'bed', label: 'Hot afternoon', icon: 'sun', files: files('glades/afternoon'), level: 0.6, gain: 1.8, drive: { by: 'storm', gain: [1, 0.12], range: [0.1, 0.6] } },
      { id: 'gust', type: 'bed', label: 'Wind in the sawgrass', icon: 'wind', files: files('glades/gust'), level: 0.55, gain: 1.6, drive: { by: 'storm', gain: [0, 1], range: [0.3, 0.85] }, wander: [0.5, 1], wanderEvery: [3, 9], wanderTau: [1.5, 4] },
      { id: 'rain', type: 'bed', label: 'Rain', icon: 'rain', files: files('glades/rain'), level: 0.7, drive: { by: 'storm', gain: [0, 1], range: [0.35, 0.7] } },
      { id: 'downpour', type: 'bed', label: 'Downpour', icon: 'rain', files: files('glades/downpour'), level: 0.8, gain: 1.25, drive: { by: 'storm', gain: [0, 1], range: [0.7, 0.98] } },
      { id: 'drip', type: 'bed', label: 'Dripping', icon: 'water', files: files('glades/drip'), level: 0.5, gain: 2.5, drive: { by: 'after', gain: [0, 1], range: [0.05, 0.6] } },
      { id: 'thunder', type: 'storm', label: 'Thunder', icon: 'bolt', pool: items('glades/thunder').length ? items('glades/thunder') : items('storm/thunder'), lazy: true, keep: 3, every: [30, 120], first: [8, 30], level: 0.75, gain: 0.9, reverb: 0.25, km: [13, 1.1], drive: { by: 'storm', rate: [0.06, 1.5] } },
      // birds go quiet as the storm comes and come back as it clears
      ...birds('glades', gladesBeds, { count: 1, quiet: 1.2, level: 0.55, gain: 0.85, drive: { by: 'storm', rate: [1.3, 0.04], range: [0.15, 0.75] } }),
      // and after the rain, the frogs start up
      ...birds('pond', [], { only: ['squirrel-treefrog', 'pig-frog', 'green-treefrog'], prefix: 'after-', group: 'After the rain', icon: 'frog', level: 0.5, gain: 0.85, drive: { by: 'after', rate: [0.02, 1.5], range: [0.08, 0.6] } }),
    ],
  };

  // The same night: a cypress pond after the rain, frogs calling all round it.
  const pondBeds = ['chorus', 'insects', 'water', 'alligator'];
  const pond = {
    id: 'pond',
    name: 'Cypress Pond',
    kicker: 'After the rain, after dark',
    what: 'Frogs calling all round a cypress pond, owls in the trees, fireflies over the water.',
    requires: ['pond/chorus', 'pond/insects'],
    gain: 2,
    reverb: { type: 'forest', level: 0.4 },
    // the chorus swells and settles
    drivers: { chorus: { range: [0.45, 1], every: [60, 180], tau: 30 } },
    layers: [
      { id: 'chorus', type: 'bed', label: 'Frog chorus', icon: 'frog', files: files('pond/chorus'), level: 0.5, gain: 1.6, drive: { by: 'chorus', gain: [0.55, 1] } },
      { id: 'insects', type: 'bed', label: 'Crickets and katydids', icon: 'cricket', files: files('pond/insects'), level: 0.5, gain: 1.2 },
      { id: 'water', type: 'bed', label: 'Lapping water', icon: 'water', files: files('pond/water'), level: 0, gain: 0.7 },
      ...birds('pond', pondBeds, { only: FROGS, group: 'Frogs', icon: 'frog', level: 0.6, gain: 0.9, reverb: 0.3, relocate: [200, 600], drive: { by: 'chorus', rate: [0.5, 1.4] } }),
      ...birds('pond', pondBeds, { only: NIGHT_BIRDS, group: 'In the trees', icon: 'owl', count: 1, level: 0.5, gain: 1.6, reverb: 0.4 }),
      { id: 'alligator', type: 'shots', label: 'Alligator', icon: 'gator', group: 'In the water', pool: items('pond/alligator'), every: [200, 700], first: [60, 240], level: 0.35, gain: 0.9, reverb: 0.4, space: { dist: [25, 90], el: [-5, 0], air: 200 } },
      { id: 'thunder', type: 'storm', label: 'The storm, far off', icon: 'bolt', group: 'Far away', pool: items('glades/thunder', 'storm/thunder').filter((i) => i.tag !== 'near'), lazy: true, keep: 2, every: [120, 420], first: [60, 200], level: 0, gain: 1.2, muffle: 1100, km: [14, 9] },
    ],
  };

  const thunderFar = items('storm/thunder').filter((i) => i.tag !== 'near');
  const mansion = {
    id: 'mansion',
    name: 'Haunted Mansion',
    kicker: 'After midnight',
    what: 'Wind in the eaves, a clock in the hall, something walking upstairs.',
    gain: 2.7,
    reverb: { type: 'hall', level: 0.6 },
    drivers: { storm: { range: [0.15, 0.6], every: [120, 300], tau: 40 } },
    layers: [
      { id: 'wind', type: 'bed', label: 'Wind at the windows', icon: 'wind', files: files('mansion/wind'), level: 0.62, gain: 0.85, wander: [0.45, 1], wanderEvery: [4, 14], wanderTau: [2, 6] },
      { id: 'gale', type: 'bed', label: 'Gale outside', icon: 'wind', files: files('mansion/gale'), level: 0, gain: 0.7, muffle: 2500, wander: [0.5, 1] },
      { id: 'draft', type: 'synth', synth: 'wind', label: 'Draught under the door', icon: 'ghost', bands: [240, 620], q: 1.4, whistle: 940, gust: [0.15, 1], gustEvery: [2.5, 7], level: 0.28, gain: 0.5 },
      { id: 'fire', type: 'bed', label: 'Fire in the grate', icon: 'fire', files: files('mansion/fire').length ? files('mansion/fire') : files('snow/fire'), level: 0.38, gain: 0.8, pan: -0.25 },
      { id: 'rain', type: 'bed', label: 'Rain on the glass', icon: 'rain', files: files('mansion/rain'), level: 0, gain: 0.8 },
      // a real grandfather clock: 24 beats looped exactly, never hopped, so tick and tock never skip
      { id: 'clock', type: 'bed', label: 'Grandfather clock', icon: 'clock', files: files('mansion/clock'), hold: [1e9, 1e9], fadeIn: 1, level: 0.42, gain: 0.75, pan: -0.35 },
      { id: 'chime', type: 'shots', label: 'The clock striking', icon: 'bell', pool: items('mansion/chime'), every: [420, 1200], first: [90, 300], level: 0.4, gain: 0.8, reverb: 0.45, space: { az: -35, el: 0, dist: 6 } },
      { id: 'house', type: 'shots', label: 'The house settling', icon: 'creak', pool: items('mansion/creak', 'mansion/rattle'), every: [15, 60], level: 0.55, gain: 0.9, reverb: 0.55, space: { dist: [3, 14], el: [-10, 50] } },
      { id: 'steps', type: 'shots', label: 'Footsteps upstairs', icon: 'steps', pool: items('mansion/steps'), every: [70, 240], level: 0.45, gain: 0.95, reverb: 0.5, muffle: 1800, space: { el: [50, 70], dist: [4, 8], move: { az: [50, 130] } } },
      { id: 'doors', type: 'shots', label: 'Doors', icon: 'door', pool: items('mansion/door', 'mansion/slam', 'mansion/knock'), every: [90, 320], level: 0.4, gain: 0.85, reverb: 0.65, space: { dist: [6, 22], el: [-5, 30] } },
      { id: 'outside', type: 'shots', label: 'Out in the dark', icon: 'owl', pool: items('mansion/owl', 'mansion/wolf', 'mansion/crow'), every: [35, 140], level: 0.45, gain: 0.9, reverb: 0.3, muffle: 5000, space: { dist: [25, 90], el: [0, 30] } },
      { id: 'thunder', type: 'storm', label: 'Distant thunder', icon: 'bolt', pool: thunderFar.length ? thunderFar : items('storm/thunder'), lazy: true, keep: 2, every: [70, 260], first: [20, 60], level: 0.35, gain: 1.4, muffle: 900, drive: { by: 'storm', rate: [0.4, 1.2] } },
      { id: 'musicbox', type: 'shots', label: 'A music box, somewhere', icon: 'piano', pool: items('mansion/musicbox', 'mansion/piano'), every: [300, 900], first: [120, 400], level: 0.3, gain: 0.55, reverb: 0.85, muffle: 3200, space: { dist: [14, 26], el: [20, 45] } },
      { id: 'dread', type: 'synth', synth: 'drone', label: 'Dread', icon: 'drone', freqs: [36.7, 37.15, 55.2], level: 0.3, gain: 0.35 },
    ],
  };

  const snow = {
    id: 'snow',
    name: 'Snowy Woods',
    kicker: 'Dusk, snow falling',
    what: 'Wind in the pines, snow slumping from branches, the lake ice singing.',
    gain: 2.2,
    reverb: { type: 'snow', level: 0.35 },
    drivers: { wind: { range: [0.25, 0.9], every: [60, 160], tau: 25 } },
    layers: [
      { id: 'wind', type: 'bed', label: 'Wind in the pines', icon: 'wind', files: files('snow/wind'), level: 0.82, drive: { by: 'wind', gain: [0.5, 1] }, wander: [0.6, 1] },
      { id: 'blizzard', type: 'bed', label: 'Blizzard', icon: 'snow', files: files('snow/blizzard'), level: 0, gain: 0.8 },
      { id: 'hush', type: 'bed', label: 'Hush', icon: 'moonlight', files: files('snow/hush'), level: 0.3, gain: 0.8 },
      { id: 'fire', type: 'bed', label: 'Cabin fire', icon: 'fire', files: files('snow/fire', 'mansion/fire'), level: 0, gain: 0.75, pan: 0.2 },
      { id: 'steps', type: 'shots', label: 'Footsteps in snow', icon: 'crunch', pool: items('snow/snowsteps'), every: [90, 280], level: 0.35, gain: 0.85, reverb: 0.2, space: { dist: [5, 18], el: [-10, 0], move: { az: [50, 120] } } },
      { id: 'branches', type: 'shots', label: 'Snow off the branches', icon: 'snow', pool: items('snow/snowfall', 'snow/treecreak'), every: [20, 80], level: 0.42, gain: 0.85, reverb: 0.25, space: { dist: [6, 35], el: [0, 30] } },
      { id: 'ice', type: 'shots', label: 'Lake ice', icon: 'ice', pool: items('snow/ice'), every: [40, 150], level: 0.4, gain: 0.85, reverb: 0.45, space: { dist: [40, 180], el: [-5, 0], air: 260 } },
      ...birds('snow', ['wind', 'blizzard', 'hush', 'fire', 'snowsteps', 'snowfall', 'treecreak', 'ice', 'owl'], { count: 1, quiet: 3.5, level: 0.32, gain: 0.8, reverb: 0.25 }),
      { id: 'owl', type: 'shots', label: 'Owl', icon: 'owl', group: 'Birds', pool: items('snow/owl', 'mansion/owl'), every: [90, 300], level: 0, gain: 0.8, reverb: 0.3, space: { dist: [30, 90], el: [10, 30] } },
    ],
  };

  // The blank canvas: every sound, nothing on until you choose.
  // a sound keeps its home scene's calibration (layer gain × scene gain) in the blank canvas
  const pick = (scene, id) => {
    const l = scene.layers.find((x) => x.id === id);
    return l ? { ...l, level: 0, gain: (l.gain ?? 1) * (scene.gain ?? 1) } : {};
  };
  // every bird layer of a scene, renamed for the canvas (skipping species another region already has)
  const birdsFrom = (scene, prefix, group, { drive, skip, from = 'Birds' } = {}) => {
    const taken = new Set((skip?.layers || []).filter((l) => l.group === 'Birds').map((l) => l.label));
    return scene.layers
      .filter((l) => l.group === from && !taken.has(l.label))
      .map((l) => ({ ...pick(scene, l.id), id: prefix + l.id, group, ...(drive !== undefined ? { drive } : {}) }));
  };
  const mixer = {
    id: 'mixer',
    name: 'Blank Canvas',
    kicker: 'Your own mix',
    what: 'A dark screen and every sound in the app. Build your own place.',
    reverb: { type: 'open', level: 0.3 },
    drivers: { storm: { range: [0.35, 0.95], every: [80, 220], tau: 30 }, wind: { range: [0.3, 0.9], every: [60, 160] } },
    layers: [
      { ...pick(storm, 'rain'), id: 'rain', group: 'Water' },
      { ...pick(storm, 'surf'), id: 'surf', label: 'Ocean waves' },
      { ...pick(waterfall, 'falls'), id: 'falls' },
      { ...pick(waterfall, 'creek'), id: 'creek' },
      { ...pick(garden, 'fountain'), id: 'fountain', pan: 0 },
      { ...pick(mansion, 'rain'), id: 'rain-glass', label: 'Rain on glass' },
      { ...pick(storm, 'thunder'), id: 'thunder', group: 'Weather' },
      { ...pick(storm, 'wind'), id: 'gale' },
      { ...pick(snow, 'wind'), id: 'pines', drive: { by: 'wind', gain: [0.5, 1] } },
      { ...pick(snow, 'blizzard'), id: 'blizzard' },
      { ...pick(waterfall, 'leaves'), id: 'leaves' },
      { ...pick(mansion, 'fire'), id: 'fire', label: 'Crackling fire', pan: 0, group: 'Warmth' },
      { ...pick(mansion, 'clock'), id: 'clock', label: 'Grandfather clock', pan: 0 },
      { ...pick(butterfly, 'morning'), id: 'fl-morning', group: 'Outdoors' },
      { ...pick(butterfly, 'palms'), id: 'palms' },
      { ...pick(butterfly, 'cicadas'), id: 'cicadas' },
      { ...pick(butterfly, 'bees'), id: 'bees' },
      { ...pick(butterfly, 'chimes'), id: 'chimes', pan: 0 },
      { ...pick(garden, 'chorus'), id: 'chorus', label: 'English dawn chorus' },
      { ...pick(waterfall, 'forest'), id: 'forest' },
      { ...pick(mansion, 'outside'), id: 'night', label: 'Owls & wolves', muffle: null },
      { ...pick(snow, 'ice'), id: 'ice', label: 'Singing lake ice' },
      { ...pick(glades, 'afternoon'), id: 'glades-afternoon', label: 'Everglades afternoon', drive: null },
      { ...pick(glades, 'gust'), id: 'sawgrass', drive: { by: 'wind', gain: [0.4, 1] } },
      { ...pick(glades, 'downpour'), id: 'downpour', label: 'Summer downpour', drive: null },
      { ...pick(glades, 'drip'), id: 'drip', label: 'Dripping trees', drive: null },
      { ...pick(pond, 'chorus'), id: 'frog-chorus', drive: null },
      { ...pick(pond, 'insects'), id: 'night-insects', label: 'Night insects' },
      ...birdsFrom(butterfly, 'fl-', 'Florida birds'),
      ...birdsFrom(garden, 'uk-', 'English garden birds', { drive: null }),
      ...birdsFrom(waterfall, 'wd-', 'Woodland birds', { skip: garden }),
      ...birdsFrom(snow, 'wn-', 'Winter birds', { skip: waterfall }),
      ...birdsFrom(glades, 'gl-', 'Everglades birds', { drive: null }),
      ...birdsFrom(pond, 'fr-', 'Florida frogs', { from: 'Frogs', drive: null }),
      ...birdsFrom(pond, 'nt-', 'Night', { from: 'In the trees', drive: null }),
      { ...pick(pond, 'alligator'), id: 'alligator' },
      { id: 'brown', type: 'synth', synth: 'noise', color: 'brown', label: 'Brown noise', icon: 'noise', level: 0, gain: 0.5, group: 'Noise' },
      { id: 'pink', type: 'synth', synth: 'noise', color: 'pink', label: 'Pink noise', icon: 'noise', level: 0, gain: 0.35 },
      { id: 'white', type: 'synth', synth: 'noise', color: 'white', label: 'White noise', icon: 'noise', level: 0, gain: 0.18 },
      { ...pick(mansion, 'draft'), id: 'draft', label: 'Whistling draught' },
      { ...pick(mansion, 'dread'), id: 'dread', label: 'Low drone' },
    ],
  };

  const usable = (l) =>
    l.type === 'synth' ||
    (l.type === 'bed' && l.files?.length) ||
    ((l.type === 'shots' || l.type === 'storm') && l.pool?.length) ||
    (l.type === 'flock' && l.species?.some((s) => s.files.length)) ||
    (l.type === 'pulse' && l.tick);

  // a scene whose recordings aren't installed drops out entirely, rather than showing up silent
  return [storm, waterfall, garden, butterfly, glades, pond, mansion, snow, mixer]
    .map((s) => ({ ...s, layers: s.layers.filter((l) => l && l.id && usable(l)) }))
    .filter((s) => s.layers.some((l) => l.type !== 'synth') && (s.requires || []).every((k) => list(k).length));
}

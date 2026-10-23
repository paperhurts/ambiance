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
  // eastern US woods: a hardwood and hemlock ravine in Connecticut
  'wood-thrush': { bout: [4, 8], gap: [3, 6], rest: [30, 90], el: [5, 30], dist: [20, 50] },
  veery: { bout: [3, 6], gap: [4, 9], rest: [30, 100], el: [2, 20], dist: [15, 45] },
  // the creek's own warbler, singing low over the water
  'louisiana-waterthrush': { bout: [2, 5], gap: [6, 14], rest: [40, 120], el: [-5, 8], dist: [10, 35] },
  'winter-wren': { bout: [1, 3], gap: [4, 9], rest: [30, 90], el: [0, 10], dist: [10, 30], gain: 0.8 },
  'red-eyed-vireo': { bout: [6, 14], gap: [1, 2.5], rest: [30, 90], el: [20, 50], dist: [20, 45] },
  'eastern-wood-pewee': { bout: [3, 8], gap: [5, 12], rest: [30, 100], el: [20, 50], dist: [15, 40] },
  'black-capped-chickadee': { bout: [1, 3], gap: [3, 8], rest: [40, 120], el: [5, 30], dist: [8, 30] },
  'white-breasted-nuthatch': { bout: [1, 3], gap: [3, 8], rest: [40, 120], el: [5, 35], dist: [10, 35] },
  'american-crow': { bout: [1, 2], gap: [3, 8], rest: [90, 300], el: [15, 45], dist: [50, 120], n: 1 },
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
  'great-blue-heron': { bout: [1, 2], gap: [4, 12], rest: [90, 300], el: [5, 40], dist: [18, 55], gain: 1.4 },
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
  // seabirds going over, out at sea
  'laughing-gull': { bout: [1, 3], gap: [1.5, 4], rest: [40, 120], el: [20, 60], dist: [10, 35] },
  'royal-tern': { bout: [1, 3], gap: [1.5, 4], rest: [50, 150], el: [25, 65], dist: [10, 35] },
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
  'sandhill-crane': 'Sandhill crane', 'great-egret': 'Great egret', 'great-blue-heron': 'Great blue heron', osprey: 'Osprey',
  'green-treefrog': 'Green treefrog', 'squirrel-treefrog': 'Squirrel treefrog', 'barking-treefrog': 'Barking treefrog',
  'pig-frog': 'Pig frog', 'leopard-frog': 'Leopard frog', 'southern-toad': 'Southern toad', 'oak-toad': 'Oak toad',
  'cricket-frog': 'Cricket frog', 'barred-owl': 'Barred owl', 'chuck-wills-widow': "Chuck-will's-widow",
  'screech-owl': 'Screech owl', 'wood-thrush': 'Wood thrush', veery: 'Veery', 'louisiana-waterthrush': 'Louisiana waterthrush',
  'winter-wren': 'Winter wren', 'red-eyed-vireo': 'Red-eyed vireo', 'eastern-wood-pewee': 'Eastern wood-pewee',
  'black-capped-chickadee': 'Black-capped chickadee', 'white-breasted-nuthatch': 'White-breasted nuthatch',
  'american-crow': 'American crow', 'laughing-gull': 'Laughing gull', 'royal-tern': 'Terns',
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
      // the East Hampton waterfall, recorded for this app; the French falls are there too, off to begin with
      { id: 'east-hampton', type: 'bed', label: 'East Hampton Waterfall', icon: 'falls', files: files('waterfall/east-hampton'), level: 0.78 },
      { id: 'french-falls', type: 'bed', label: 'Waterfall in France', icon: 'falls', files: files('waterfall/falls'), level: 0 },
      { id: 'creek', type: 'bed', label: 'Creek', icon: 'water', files: files('waterfall/creek'), level: 0.55, gain: 0.9 },
      { id: 'forest', type: 'bed', label: 'Forest air', icon: 'leaf', files: files('waterfall/forest'), level: 0.5, gain: 0.8 },
      { id: 'leaves', type: 'bed', label: 'Leaves', icon: 'wind', files: files('waterfall/leaves'), level: 0.35, gain: 0.8, wander: [0.3, 1], wanderEvery: [4, 12], wanderTau: [2, 5] },
      ...birds('waterfall', ['falls', 'east-hampton', 'creek', 'forest', 'leaves', 'woodpecker'], { count: 1, quiet: 2.2, level: 0.62, gain: 1.25, reverb: 0.35 }),
      { id: 'woodpecker', type: 'shots', label: 'Woodpeckers', icon: 'bird', group: 'Birds', pool: items('waterfall/woodpecker'), every: [50, 180], level: 0.4, gain: 0.8, reverb: 0.4, space: { dist: [30, 80], el: [5, 25] } },
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
      // birds call less as the storm comes over, but carry on through the rain (herons and egrets
      // stand it out in the marsh, blackbirds hang on to the cattails) and pick up as it clears
      ...birds('glades', gladesBeds, { count: 1, quiet: 1.2, level: 0.55, gain: 0.85, drive: { by: 'storm', rate: [1.3, 0.3], range: [0.15, 0.75] } }),
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
  // The great hall of a castle in the Highlands, in two seasons. The castle's own sounds (the hall,
  // the feast, its bells and its owls) are shared; the weather, the music and the dressing change.
  const hallBits = (feast) => [
    { id: 'hall', type: 'bed', label: 'The hall', icon: 'castle', files: files('castle/hall'), level: 0.5, gain: 0.8 },
    { id: 'feast', type: 'bed', label: 'The feast', icon: 'goblet', files: files('castle/feast'), level: feast, gain: 1.2, muffle: 6000 },
    { id: 'cutlery', type: 'shots', label: 'Plates and goblets', icon: 'goblet', pool: items('castle/cutlery'), every: [3, 12], level: feast ? 0.3 : 0, gain: 0.45, reverb: 0.5, space: { dist: [5, 18], el: [-15, 0] } },
    { id: 'fire', type: 'bed', label: 'Fires in the hearths', icon: 'fire', files: files('mansion/fire', 'snow/fire'), level: 0.45, gain: 0.75, pan: 0.3 },
    { id: 'castle', type: 'shots', label: 'The old castle', icon: 'creak', pool: items('mansion/creak', 'mansion/door', 'mansion/steps'), every: [45, 160], level: 0.25, gain: 0.7, reverb: 0.7, muffle: 3500, space: { dist: [12, 35], el: [-5, 30] } },
    { id: 'toll', type: 'shots', label: 'The clock tower', icon: 'bell', pool: items('castle/toll'), burst: [3, 12], burstGap: [2.5, 2.9], every: [600, 1500], first: [60, 240], level: 0.35, gain: 1.1, reverb: 0.4, muffle: 4000, space: { dist: [60, 120], el: [20, 50] } },
  ];
  // last in the list, so the mix sheet's Birds heading comes last too
  const castleOwls = { id: 'owls', type: 'shots', label: 'Owls in the grounds', icon: 'owl', group: 'Birds', pool: items('castle/tawny-owl'), every: [40, 160], level: 0.4, gain: 1.4, reverb: 0.3, muffle: 4500, space: { dist: [30, 90], el: [0, 30] } };
  const halloween = {
    id: 'halloween',
    name: 'Halloween Feast',
    kicker: 'The Great Hall',
    what: 'A storm on the enchanted ceiling, candles and jack-o’-lanterns floating, the feast in full swing.',
    requires: ['castle/hall'],
    gain: 2.95,
    reverb: { type: 'great', level: 0.5 },
    drivers: { storm: { range: [0.35, 1], every: [90, 240], tau: 30 } },
    layers: [
      ...hallBits(0.4),
      // the castle stands in a storm off the Isle of Mull: the real one, heard from indoors
      { id: 'wind', type: 'bed', label: 'Storm round the towers', icon: 'wind', files: files('mansion/wind'), level: 0.5, gain: 1.0, drive: { by: 'storm', gain: [0.55, 1] }, wander: [0.5, 1], wanderEvery: [4, 14], wanderTau: [2, 6] },
      { id: 'rain', type: 'bed', label: 'Rain on the windows', icon: 'rain', files: files('mansion/rain'), level: 0.5, gain: 0.9, drive: { by: 'storm', gain: [0.4, 1] } },
      { id: 'thunder', type: 'storm', label: 'Thunder', icon: 'bolt', pool: items('storm/thunder'), lazy: true, keep: 2, every: [50, 180], first: [15, 45], level: 0.45, gain: 1.4, muffle: 1800, drive: { by: 'storm', rate: [0.4, 1.4] } },
      { id: 'music', type: 'shots', label: 'Music, far off', icon: 'piano', pool: items('castle/halloween-music'), stream: true, keep: 1, every: [300, 900], first: [90, 300], level: 0.3, gain: 0.45, reverb: 0.8, muffle: 3500, space: { dist: [20, 35], el: [10, 30] } },
      { id: 'forest', type: 'shots', label: 'The Forbidden Forest', icon: 'ghost', pool: items('mansion/wolf'), every: [120, 420], level: 0, gain: 0.7, reverb: 0.3, muffle: 3000, space: { dist: [150, 300], el: [0, 5] } },
      castleOwls,
    ],
  };
  const christmas = {
    id: 'christmas',
    name: 'Christmas',
    kicker: 'The Great Hall',
    what: 'Snow falling from the enchanted ceiling, twelve trees, roaring fires, and carols somewhere in the castle.',
    requires: ['castle/hall'],
    gain: 2.8,
    reverb: { type: 'great', level: 0.5 },
    layers: [
      ...hallBits(0),
      { id: 'snowstorm', type: 'bed', label: 'Snow on the wind outside', icon: 'snow', files: files('snow/blizzard'), level: 0.4, gain: 0.85, muffle: 1600, wander: [0.5, 1], wanderEvery: [5, 16], wanderTau: [3, 8] },
      { id: 'peal', type: 'bed', label: 'Bells from the village', icon: 'bell', files: files('castle/peal'), level: 0.35, gain: 1.0, muffle: 5000, wander: [0.3, 1], wanderEvery: [20, 60], wanderTau: [6, 15] },
      { id: 'carols', type: 'shots', label: 'Carols, somewhere in the castle', icon: 'note', pool: items('castle/carols'), stream: true, keep: 1, every: [240, 720], first: [40, 180], level: 0.35, gain: 0.5, reverb: 0.8, muffle: 4500, space: { dist: [18, 30], el: [5, 25] } },
      { id: 'music', type: 'shots', label: 'Music, far off', icon: 'piano', pool: items('castle/christmas-music'), stream: true, keep: 1, every: [300, 900], first: [200, 500], level: 0.3, gain: 0.45, reverb: 0.8, muffle: 3500, space: { dist: [20, 35], el: [10, 30] } },
      castleOwls,
    ],
  };
  // Christmas in the fire's glow: a bigger, cosier hearth, louder than at Halloween
  christmas.layers.find((l) => l.id === 'fire').level = 0.55;

  // Two common rooms in the same castle, made to read in: steady and warm, nothing sudden. Pages
  // turn and a quill scratches now and then in both, as if someone else were reading nearby.
  const reading = (pages, quill) => [
    { id: 'pages', type: 'shots', label: 'Pages turning', icon: 'book', pool: items('common/pages'), every: [35, 120], first: [10, 40], level: pages, gain: 0.7, reverb: 0.25, space: { az: [-70, 70], el: [-20, 0], dist: [1.5, 3] } },
    { id: 'quill', type: 'shots', label: 'A quill writing', icon: 'quill', pool: items('common/quill'), every: [50, 160], first: [30, 90], level: quill, gain: 0.5, reverb: 0.25, space: { az: [-70, 70], el: [-20, 0], dist: [1.5, 3] } },
  ];
  // Under the lake: a stone room with the water at its windows, a fire, a cat purring on the rug.
  // Something sings far out in the deep, if you let it (off to start with).
  const lake = {
    id: 'lake',
    name: 'Under the Lake',
    kicker: 'A common room',
    what: 'Green lamps, a fire, the lake at the windows, and a little snake asleep by the hearth, pointedly ignoring the cat.',
    requires: ['common/underwater'],
    gain: 2.9,
    reverb: { type: 'vault', level: 0.4 },
    layers: [
      { id: 'lake', type: 'bed', label: 'The lake at the glass', icon: 'water', files: files('common/underwater'), level: 0.45, gain: 1.7, muffle: 1400 },
      { id: 'fire', type: 'bed', label: 'The fire', icon: 'fire', files: files('mansion/fire', 'snow/fire'), level: 0.5, gain: 0.8, pan: 0.35 },
      { id: 'purr', type: 'bed', label: 'The cat, purring', icon: 'cat', files: files('common/purr'), level: 0.45, gain: 1.3, pan: 0.15 },
      { id: 'bubbles', type: 'shots', label: 'Bubbles past the glass', icon: 'bubbles', pool: items('common/bubbles'), every: [30, 110], first: [8, 30], level: 0.3, gain: 0.75, reverb: 0.3, muffle: 2200, space: { az: [-50, 50], el: [0, 20], dist: [4, 9] } },
      ...reading(0.3, 0),
      { id: 'castle', type: 'shots', label: 'The old castle', icon: 'creak', pool: items('mansion/creak'), every: [60, 200], level: 0.15, gain: 0.6, reverb: 0.7, muffle: 3000, space: { dist: [8, 25], el: [10, 40] } },
      { id: 'deep', type: 'shots', label: 'A song from the deep', icon: 'whale', pool: items('common/whale'), stream: true, keep: 1, every: [150, 480], first: [30, 120], level: 0, gain: 0.45, reverb: 0.5, muffle: 1600, space: { az: [-60, 60], el: [0, 15], dist: [6, 12] } },
    ],
  };
  // By the kitchens: a round room half under the grass, the kettle on, rain or sun at the windows,
  // garden birds outside and the kitchens busy through the wall.
  const kitchens = {
    id: 'kitchens',
    name: 'By the Kitchens',
    kicker: 'A common room',
    what: 'A round room of honey-coloured wood, plants in copper pots, the kettle on, a pile of cats by the fire, and a soft thunderstorm (or sun and dandelions) outside.',
    requires: ['common/kettle'],
    gain: 2.85,
    reverb: { type: 'room', level: 0.3 },
    layers: [
      { id: 'fire', type: 'bed', label: 'The fire', icon: 'fire', files: files('mansion/fire', 'snow/fire'), level: 0.45, gain: 0.8, pan: -0.35 },
      { id: 'purr', type: 'bed', label: 'Purring by the fire', icon: 'cat', files: files('common/purr'), level: 0.4, gain: 1.3, pan: -0.2 },
      { id: 'rain', type: 'bed', label: 'Rain on the windows', icon: 'rain', files: files('mansion/rain'), level: 0.3, gain: 1.0 },
      // a thunderstorm to read through: a smooth, steady downpour on the hill over the room, and
      // thunder that only ever rolls in from far off
      { id: 'storm', type: 'bed', label: 'Rain on the hill above', icon: 'rain', files: files('glades/downpour', 'storm/rain'), level: 0.5, gain: 1.0, muffle: 2600 },
      { id: 'thunder', type: 'storm', label: 'Thunder, rolling far off', icon: 'bolt', pool: items('glades/thunder', 'storm/thunder').filter((i) => i.tag !== 'near'), lazy: true, keep: 2, every: [50, 160], first: [15, 50], level: 0.45, gain: 1.2, muffle: 1500, km: [11, 6] },
      { id: 'kettle', type: 'bed', label: 'The kettle on the hob', icon: 'kettle', files: files('common/kettle'), level: 0.3, gain: 1.0, pan: -0.2 },
      { id: 'kitchens', type: 'bed', label: 'The kitchens, through the wall', icon: 'pot', files: files('common/kitchen'), level: 0.3, gain: 1.8, muffle: 1300 },
      { id: 'tea', type: 'shots', label: 'Tea', icon: 'cup', pool: items('common/teacup'), every: [90, 300], first: [20, 90], level: 0.3, gain: 0.6, reverb: 0.2, space: { az: [20, 60], el: [-25, -10], dist: [1, 2] } },
      ...reading(0.3, 0.2),
      ...birds('garden', [], { only: ['robin', 'blackbird', 'wren', 'song-thrush'], level: 0.35, gain: 1.1, relocate: [80, 240] }).map((l) => ({ ...l, muffle: 3500 })),
    ],
  };

  // Three rooms at the tops of towers in the same castle, made to read or sleep in like the two
  // below: steady and warm, nothing sudden. The cats are asleep by the fire in all three.
  const hearth = files('tower/hearth').length ? files('tower/hearth') : files('mansion/fire', 'snow/fire');
  const towerBell = { id: 'toll', type: 'shots', label: 'The clock tower', icon: 'bell', pool: items('castle/toll'), burst: [3, 12], burstGap: [2.5, 2.9], every: [600, 1500], first: [90, 300], level: 0.3, gain: 1.1, reverb: 0.4, muffle: 3500, space: { dist: [50, 100], el: [-10, 20] } };
  const towerOwls = { id: 'owls', type: 'shots', label: 'Owls in the grounds', icon: 'owl', group: 'Birds', pool: items('castle/tawny-owl'), every: [60, 200], level: 0.35, gain: 2.4, reverb: 0.3, muffle: 4000, space: { dist: [40, 100], el: [-15, 10] } };
  const purr = (label) => ({ id: 'purr', type: 'bed', label, icon: 'cat', files: files('common/purr'), level: 0.4, gain: 1.3, pan: -0.2 });
  const towerWind = (label, level) => ({ id: 'wind', type: 'bed', label, icon: 'wind', files: files('mansion/wind'), level, gain: 0.8, muffle: 2400, wander: [0.5, 1], wanderEvery: [4, 14], wanderTau: [2, 6] });
  // Behind the portrait: scarlet and gold, a roaring fire, the grounds under the moon
  const den = {
    id: 'den',
    name: 'Behind the Portrait',
    kicker: 'A common room',
    what: 'A round tower room in scarlet and gold: a roaring fire, squashy armchairs, the grounds under the moon, a game of chess that plays itself, and the cats asleep on the hearthrug.',
    requires: ['common/purr'],
    gain: 2.7,
    reverb: { type: 'room', level: 0.3 },
    layers: [
      { id: 'fire', type: 'bed', label: 'The fire, roaring', icon: 'fire', files: hearth, level: 0.7, gain: 0.85, pan: -0.35 },
      purr('Purring on the hearthrug'),
      towerWind('Wind round the tower', 0.3),
      { id: 'rain', type: 'bed', label: 'Rain on the windows', icon: 'rain', files: files('mansion/rain'), level: 0, gain: 0.9 },
      ...reading(0.3, 0.2),
      { id: 'castle', type: 'shots', label: 'The old castle', icon: 'creak', pool: items('mansion/creak'), every: [60, 200], level: 0.15, gain: 0.6, reverb: 0.6, muffle: 3000, space: { dist: [8, 25], el: [-10, 30] } },
      towerBell,
      towerOwls,
    ],
  };
  // Beyond the riddle: blue and bronze under a painted dome, the mountains at the windows
  const eyrie = {
    id: 'eyrie',
    name: 'Beyond the Riddle',
    kicker: 'A common room',
    what: 'An airy round room in blue and bronze under a dome painted with stars: tall windows onto the mountains, silk stirring at them, books everywhere, a fire, and the cats asleep on the rug.',
    requires: ['common/purr'],
    gain: 3.0,
    reverb: { type: 'room', level: 0.35 },
    layers: [
      towerWind('Night air at the windows', 0.45),
      { id: 'mountains', type: 'bed', label: 'Wind off the mountains', icon: 'wind', files: files('snow/wind'), level: 0.35, gain: 0.7, muffle: 1600, wander: [0.4, 1], wanderEvery: [6, 18], wanderTau: [3, 8] },
      { id: 'fire', type: 'bed', label: 'The fire', icon: 'fire', files: files('mansion/fire', 'snow/fire'), level: 0.55, gain: 0.8, pan: -0.35 },
      purr('Purring by the fire'),
      ...reading(0.4, 0.3),
      { id: 'rain', type: 'bed', label: 'Rain on the windows', icon: 'rain', files: files('mansion/rain'), level: 0, gain: 0.9 },
      towerBell,
      { ...towerOwls, level: 0.4 },
    ],
  };
  // The headmaster's study: instruments, dozing portraits, the phoenix on its perch
  const phoenixSong = items('tower/phoenix');
  const study = {
    id: 'study',
    name: 'Up the Moving Stair',
    kicker: "The headmaster's study",
    what: 'Silver instruments whirring and puffing on spindly tables, old portraits dozing in their frames, a tattered hat on the mantelpiece, a phoenix on its golden perch, and the cats asleep by the fire.',
    requires: ['tower/clockwork'],
    gain: 3.5,
    reverb: { type: 'room', level: 0.35 },
    layers: [
      { id: 'fire', type: 'bed', label: 'The fire', icon: 'fire', files: files('mansion/fire', 'snow/fire'), level: 0.55, gain: 0.8, pan: -0.35 },
      purr('Purring by the fire'),
      { id: 'instruments', type: 'bed', label: 'Silver instruments, ticking', icon: 'cog', files: files('tower/clockwork'), hold: [1e9, 1e9], fadeIn: 1, level: 0.3, gain: 0.8, pan: 0.1 },
      { id: 'whirr', type: 'shots', label: 'Instruments whirring', icon: 'cog', pool: items('tower/whirr'), every: [30, 100], first: [8, 30], level: 0.45, gain: 0.6, reverb: 0.3, space: { az: [-40, 40], el: [-10, 0], dist: [2, 5] } },
      { id: 'snore', type: 'shots', label: 'Portraits snoring', icon: 'zzz', pool: items('tower/snore'), every: [40, 150], first: [20, 60], level: 0.3, gain: 0.55, reverb: 0.4, space: { az: [-80, 80], el: [10, 35], dist: [3, 6] } },
      { id: 'phoenix', type: 'shots', label: 'The phoenix, singing', icon: 'phoenix', pool: phoenixSong.length ? phoenixSong : items('waterfall/wood-thrush'), every: [150, 420], first: [40, 120], level: 0.4, gain: 0.45, reverb: 0.6, space: { az: [25, 45], el: [5, 15], dist: [3, 4] } },
      { id: 'feathers', type: 'shots', label: 'The phoenix, stirring', icon: 'feather', pool: items('tower/feathers'), every: [60, 200], first: [30, 90], level: 0.3, gain: 0.6, reverb: 0.3, space: { az: [25, 45], el: [5, 15], dist: [3, 4] } },
      ...reading(0.25, 0.3),
      towerWind('Wind round the tower', 0.2),
      towerBell,
      { ...towerOwls, level: 0.25 },
    ],
  };

  // The floating bed: a four-poster with a thatched roof adrift on a warm sea, the cats and the dog
  // aboard watching dolphins, seabirds and turtles, on a sunny day or a stormy one
  const seaLife = (stormy) => [
    { id: 'whistles', type: 'shots', label: 'Dolphins under the water', icon: 'dolphin', pool: items('sea/whistle'), every: [60, 200], first: [20, 60], level: stormy ? 0 : 0.25, gain: 1.2, reverb: 0.3, space: { az: [-80, 80], el: [-30, -10], dist: [5, 15] } },
    { id: 'creak', type: 'shots', label: 'The bed creaking', icon: 'creak', pool: items('sea/creak'), every: stormy ? [10, 35] : [25, 75], first: [10, 30], level: stormy ? 0.35 : 0.22, gain: 0.7, reverb: 0.1, space: { az: [-40, 40], el: [-20, 10], dist: [1.5, 3] } },
    { id: 'purr', type: 'bed', label: stormy ? 'Purring anyway' : 'Purring on the quilt', icon: 'cat', files: files('common/purr'), level: 0.3, gain: 1.3, pan: -0.1 },
  ];
  const seabirds = (quiet, level) => birds('sea', [], { only: ['laughing-gull', 'royal-tern'], count: 1, quiet, level, gain: 1.4, reverb: 0.2, relocate: [60, 200] });
  const afloat = {
    id: 'afloat',
    name: 'Sunny Day',
    kicker: 'The floating bed',
    what: 'A four-poster with a thatched roof, adrift on a warm sea, with the cats and the dog aboard watching dolphins leap, gulls go over and turtles come up for air.',
    requires: ['sea/swell'],
    gain: 2.8,
    reverb: { type: 'open', level: 0.25 },
    layers: [
      { id: 'swell', type: 'bed', label: 'The open sea', icon: 'wave', files: files('sea/swell'), level: 0.55, gain: 1.0 },
      { id: 'lapping', type: 'bed', label: 'Water lapping at the bed', icon: 'water', files: files('sea/lapping'), level: 0.4, gain: 0.9 },
      { id: 'breeze', type: 'bed', label: 'A breeze in the thatch', icon: 'wind', files: files('florida/palms'), level: 0.25, gain: 0.8, wander: [0.4, 1], wanderEvery: [4, 12], wanderTau: [2, 5] },
      ...seaLife(false),
      ...seabirds(1, 0.4),
    ],
  };
  const afloatStorm = {
    id: 'afloat-storm',
    name: 'Stormy Day',
    kicker: 'The floating bed',
    what: 'The same bed in a storm: rain drumming on the thatch, the sea heaving, thunder out at sea and a lantern lit under the roof, with the cats and the dog snug aboard and still watching.',
    requires: ['sea/thatch'],
    gain: 2.7,
    reverb: { type: 'open', level: 0.25 },
    drivers: { storm: { range: [0.45, 1], every: [60, 180], tau: 25 } },
    layers: [
      { id: 'thatch', type: 'bed', label: 'Rain on the thatch', icon: 'rain', files: files('sea/thatch'), level: 0.55, gain: 1.0, drive: { by: 'storm', gain: [0.6, 1] } },
      { id: 'roughsea', type: 'bed', label: 'The sea heaving', icon: 'wave', files: files('sea/roughsea').length ? files('sea/roughsea') : files('sea/swell'), level: 0.42, gain: 1.0, drive: { by: 'storm', gain: [0.6, 1] } },
      { id: 'rain', type: 'bed', label: 'Rain on the sea', icon: 'rain', files: files('glades/downpour', 'storm/rain'), level: 0.3, gain: 0.9, muffle: 4000, drive: { by: 'storm', gain: [0.4, 1] } },
      { id: 'wind', type: 'bed', label: 'Wind', icon: 'wind', files: files('storm/wind'), level: 0.4, gain: 0.8, drive: { by: 'storm', gain: [0.4, 1] }, wander: [0.5, 1], wanderEvery: [3, 10], wanderTau: [1.5, 5] },
      { id: 'thunder', type: 'storm', label: 'Thunder out at sea', icon: 'bolt', pool: items('storm/thunder', 'glades/thunder'), lazy: true, keep: 2, every: [40, 150], first: [10, 40], level: 0.45, gain: 1.0, muffle: 2500, km: [11, 5], drive: { by: 'storm', rate: [0.5, 1.3] } },
      { id: 'lapping', type: 'bed', label: 'Water slapping at the bed', icon: 'water', files: files('sea/lapping'), level: 0.3, gain: 0.9 },
      ...seaLife(true),
      ...seabirds(3, 0.25),
    ],
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
      { ...pick(waterfall, 'east-hampton'), id: 'east-hampton' },
      { ...pick(waterfall, 'french-falls'), id: 'falls', label: 'Waterfall in France' },
      { ...pick(waterfall, 'creek'), id: 'creek' },
      { ...pick(garden, 'fountain'), id: 'fountain', pan: 0 },
      { ...pick(mansion, 'rain'), id: 'rain-glass', label: 'Rain on glass' },
      { ...pick(lake, 'lake'), id: 'underwater', label: 'Under the water' },
      { ...pick(lake, 'bubbles'), id: 'bubbles', label: 'Bubbles' },
      { ...pick(lake, 'deep'), id: 'whales', label: 'Whale song, far off' },
      { ...pick(storm, 'thunder'), id: 'thunder', group: 'Weather' },
      { ...pick(storm, 'wind'), id: 'gale' },
      { ...pick(snow, 'wind'), id: 'pines', drive: { by: 'wind', gain: [0.5, 1] } },
      { ...pick(snow, 'blizzard'), id: 'blizzard' },
      { ...pick(waterfall, 'leaves'), id: 'leaves' },
      { ...pick(mansion, 'fire'), id: 'fire', label: 'Crackling fire', pan: 0, group: 'Warmth' },
      { ...pick(mansion, 'clock'), id: 'clock', label: 'Grandfather clock', pan: 0 },
      { ...pick(lake, 'purr'), id: 'purr', label: 'A cat purring', pan: 0 },
      { ...pick(kitchens, 'kettle'), id: 'kettle', label: 'A kettle simmering', pan: 0 },
      { ...pick(study, 'instruments'), id: 'clockwork', label: 'Clockwork ticking', pan: 0 },
      { ...pick(lake, 'pages'), id: 'pages' },
      { ...pick(kitchens, 'quill'), id: 'quill' },
      { ...pick(halloween, 'hall'), id: 'great-hall', label: 'A great stone hall', group: 'The castle' },
      { ...pick(halloween, 'feast'), id: 'feast', label: 'A feast in the hall' },
      { ...pick(christmas, 'peal'), id: 'peal', label: 'Church bells, far off' },
      { ...pick(christmas, 'carols'), id: 'carols', label: 'Carols, somewhere' },
      { ...pick(kitchens, 'kitchens'), id: 'kitchens', label: 'Kitchens through a wall' },
      { ...pick(afloat, 'swell'), id: 'open-sea', label: 'The open sea', group: 'Water' },
      { ...pick(afloat, 'lapping'), id: 'lapping', label: 'Water lapping at a boat' },
      { ...pick(afloatStorm, 'thatch'), id: 'thatch', label: 'Rain on a thatched roof', drive: null },
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
      ...birdsFrom(waterfall, 'wd-', 'Eastern woodland birds', { skip: butterfly }),
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
  return [storm, waterfall, garden, butterfly, glades, pond, mansion, snow, halloween, christmas, lake, kitchens, den, eyrie, study, afloat, afloatStorm, mixer]
    .map((s) => ({ ...s, layers: s.layers.filter((l) => l && l.id && usable(l)) }))
    .filter((s) => s.layers.some((l) => l.type !== 'synth') && (s.requires || []).every((k) => list(k).length));
}

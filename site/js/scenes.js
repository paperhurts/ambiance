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
  mockingbird: { bout: [6, 14], gap: [0.5, 1.5], rest: [30, 90], el: [10, 40], dist: [10, 30] },
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
};
const DEFAULT_HABIT = { bout: [2, 6], gap: [2, 6], rest: [20, 80], el: [5, 35], dist: [12, 40] };

export function buildScenes(pools) {
  const list = (key) => pools[key] || [];
  const files = (...keys) => keys.flatMap((k) => list(k).map((i) => i.file));
  const items = (...keys) => keys.flatMap((k) => list(k).map(({ file, tag, weight }) => ({ file, tag, weight })));
  // Every remaining pool in the scene is a species. `count` birds of each; `quiet` stretches
  // their rests (a midday wood or a winter one is sparser than the dawn chorus).
  const flock = (scene, exclude, { count = [1, 2], quiet = 1 } = {}) =>
    Object.keys(pools)
      .filter((k) => k.startsWith(scene + '/') && !exclude.includes(k.slice(scene.length + 1)))
      .map((k) => {
        const id = k.slice(scene.length + 1);
        const h = HABITS[id] || DEFAULT_HABIT;
        const solo = id.includes('pigeon') || id.includes('dove') || id === 'raven' || id === 'crow';
        return { id, files: files(k), count: solo ? 1 : count, bout: h.bout, gap: h.gap, rest: [h.rest[0] * quiet, h.rest[1] * quiet], gain: h.gain ?? 1, space: { el: h.el, dist: h.dist } };
      });

  const storm = {
    id: 'storm',
    name: 'Storm at Sea',
    kicker: 'Night, on the shore',
    what: 'Breakers, rain and gale, thunder rolling in off the water.',
    reverb: { type: 'open', level: 0.35 },
    drivers: { storm: { range: [0.35, 1], every: [70, 200], tau: 30 } },
    layers: [
      { id: 'surf', type: 'bed', label: 'Breakers', icon: 'wave', files: files('storm/surf'), level: 0.82, hold: [30, 70], xfade: [6, 10], drive: { by: 'storm', gain: [0.7, 1] } },
      { id: 'rain', type: 'bed', label: 'Rain', icon: 'rain', files: files('storm/rain'), level: 0.7, gain: 0.9, drive: { by: 'storm', gain: [0.45, 1] }, wander: [0.75, 1] },
      { id: 'wind', type: 'bed', label: 'Gale', icon: 'wind', files: files('storm/wind'), level: 0.55, gain: 0.8, drive: { by: 'storm', gain: [0.4, 1] }, wander: [0.5, 1], wanderEvery: [3, 10], wanderTau: [1.5, 5] },
      { id: 'thunder', type: 'storm', label: 'Thunder', icon: 'bolt', pool: items('storm/thunder'), lazy: true, keep: 3, every: [22, 100], first: [3, 12], level: 0.75, gain: 1.8, reverb: 0.2, drive: { by: 'storm', rate: [0.35, 1.7] } },
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
      { id: 'birds', type: 'flock', label: 'Birdsong', icon: 'bird', level: 0.62, gain: 0.9, reverb: 0.35, relocate: [90, 300], species: flock('waterfall', ['falls', 'creek', 'forest', 'leaves', 'woodpecker'], { count: 1, quiet: 2.2 }) },
      { id: 'woodpecker', type: 'shots', label: 'Woodpecker', icon: 'bird', pool: items('waterfall/woodpecker'), every: [50, 180], level: 0.4, gain: 0.8, reverb: 0.4, space: { dist: [30, 80], el: [5, 25] } },
    ],
  };

  const garden = {
    id: 'garden',
    name: 'Sunrise Garden',
    kicker: 'First light',
    what: 'The dawn chorus building as the sun comes up over the garden.',
    reverb: { type: 'forest', level: 0.3 },
    // the light (and the birds) build over the first 25 minutes, then hold
    drivers: { dawn: { ramp: 1500, start: 0.12 } },
    layers: [
      { id: 'chorus', type: 'bed', label: 'Dawn chorus', icon: 'bird', files: files('garden/chorus'), level: 0.6, drive: { by: 'dawn', gain: [0.55, 1] } },
      { id: 'birds', type: 'flock', label: 'Nearby birds', icon: 'bird', level: 0.68, gain: 0.85, reverb: 0.3, relocate: [80, 240], drive: { by: 'dawn', rate: [0.55, 1.35] }, species: flock('garden', ['chorus', 'breeze', 'fountain', 'bee', 'rooster']) },
      { id: 'breeze', type: 'bed', label: 'Breeze', icon: 'leaf', files: files('garden/breeze'), level: 0.3, gain: 0.8, wander: [0.35, 1], wanderEvery: [4, 12] },
      { id: 'fountain', type: 'bed', label: 'Fountain', icon: 'water', files: files('garden/fountain'), level: 0, gain: 0.8, pan: 0.35 },
      { id: 'bee', type: 'shots', label: 'Bumblebees', icon: 'bee', pool: items('garden/bee'), every: [60, 220], level: 0.3, gain: 0.7, space: { az: [-120, 120], el: [-5, 15], dist: [1.5, 4], move: { az: [90, 200], dist: [4, 9] } } },
      { id: 'rooster', type: 'shots', label: 'Far-off rooster', icon: 'rooster', pool: items('garden/rooster'), every: [240, 720], level: 0, gain: 0.6, reverb: 0.4, space: { dist: [120, 260], el: [0, 3], air: 300 } },
    ],
  };

  const thunderFar = items('storm/thunder').filter((i) => i.tag !== 'near');
  const mansion = {
    id: 'mansion',
    name: 'Haunted Mansion',
    kicker: 'After midnight',
    what: 'Wind in the eaves, a clock in the hall, something walking upstairs.',
    reverb: { type: 'hall', level: 0.6 },
    drivers: { storm: { range: [0.15, 0.6], every: [120, 300], tau: 40 } },
    layers: [
      { id: 'wind', type: 'bed', label: 'Wind outside', icon: 'wind', files: files('mansion/wind'), level: 0.62, gain: 0.85, wander: [0.45, 1], wanderEvery: [4, 14], wanderTau: [2, 6] },
      { id: 'draft', type: 'synth', synth: 'wind', label: 'Draught under the door', icon: 'ghost', bands: [240, 620], q: 1.4, whistle: 940, gust: [0.15, 1], gustEvery: [2.5, 7], level: 0.28, gain: 0.5 },
      { id: 'fire', type: 'bed', label: 'Fire in the grate', icon: 'fire', files: files('mansion/fire', 'snow/fire'), level: 0.38, gain: 0.8, pan: -0.25 },
      { id: 'rain', type: 'bed', label: 'Rain on the glass', icon: 'rain', files: files('mansion/rain'), level: 0, gain: 0.8 },
      { id: 'clock', type: 'pulse', label: 'Hall clock', icon: 'clock', tick: files('mansion/tick')[0], tock: files('mansion/tock')[0], chime: files('mansion/chime').length ? { file: files('mansion/chime')[0], every: [480, 1100], count: [1, 12], spacing: 2.6, gain: 0.7 } : null, period: 1.0, level: 0.42, gain: 0.8, reverb: 0.5, space: { az: -35, el: 0, dist: 6 } },
      { id: 'house', type: 'shots', label: 'The house settling', icon: 'creak', pool: items('mansion/creak', 'mansion/rattle'), every: [10, 45], level: 0.55, gain: 0.9, reverb: 0.55, space: { dist: [3, 14], el: [-10, 50] } },
      { id: 'steps', type: 'shots', label: 'Footsteps upstairs', icon: 'steps', pool: items('mansion/steps'), every: [70, 240], level: 0.45, gain: 0.95, reverb: 0.5, muffle: 1800, space: { el: [50, 70], dist: [4, 8], move: { az: [50, 130] } } },
      { id: 'doors', type: 'shots', label: 'Doors', icon: 'door', pool: items('mansion/door', 'mansion/slam', 'mansion/knock'), every: [90, 320], level: 0.4, gain: 0.85, reverb: 0.65, space: { dist: [6, 22], el: [-5, 30] } },
      { id: 'outside', type: 'shots', label: 'Out in the dark', icon: 'owl', pool: items('mansion/owl', 'mansion/wolf', 'mansion/crow'), every: [35, 140], level: 0.45, gain: 0.9, reverb: 0.3, muffle: 5000, space: { dist: [25, 90], el: [0, 30] } },
      { id: 'thunder', type: 'storm', label: 'Distant thunder', icon: 'bolt', pool: thunderFar.length ? thunderFar : items('storm/thunder'), lazy: true, keep: 2, every: [70, 260], first: [20, 60], level: 0.35, gain: 1.4, muffle: 900, drive: { by: 'storm', rate: [0.4, 1.2] } },
      { id: 'piano', type: 'shots', label: 'The piano', icon: 'piano', pool: items('mansion/piano', 'mansion/musicbox'), every: [240, 720], level: 0, gain: 0.6, reverb: 0.8, muffle: 3500, space: { dist: [12, 25], el: [-5, 5] } },
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
      { id: 'birds', type: 'flock', label: 'Winter birds', icon: 'bird', level: 0.32, gain: 0.8, reverb: 0.25, relocate: [90, 300], species: flock('snow', ['wind', 'blizzard', 'hush', 'fire', 'snowsteps', 'snowfall', 'treecreak', 'ice', 'owl'], { count: 1, quiet: 3.5 }) },
      { id: 'owl', type: 'shots', label: 'Owl', icon: 'owl', pool: items('snow/owl', 'mansion/owl'), every: [90, 300], level: 0, gain: 0.8, reverb: 0.3, space: { dist: [30, 90], el: [10, 30] } },
    ],
  };

  // The blank canvas: every sound, nothing on until you choose.
  // a sound keeps its home scene's calibration (layer gain × scene gain) in the blank canvas
  const pick = (scene, id) => {
    const l = scene.layers.find((x) => x.id === id);
    return l ? { ...l, level: 0, gain: (l.gain ?? 1) * (scene.gain ?? 1) } : {};
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
      { ...pick(mansion, 'clock'), id: 'clock', label: 'Pendulum clock' },
      { ...pick(garden, 'chorus'), id: 'chorus', group: 'Creatures' },
      { ...pick(garden, 'birds'), id: 'garden-birds', label: 'Garden birds', drive: null },
      { ...pick(waterfall, 'birds'), id: 'forest-birds', label: 'Forest birds' },
      { ...pick(waterfall, 'forest'), id: 'forest' },
      { ...pick(mansion, 'outside'), id: 'night', label: 'Owls & wolves', muffle: null },
      { ...pick(snow, 'ice'), id: 'ice', label: 'Singing lake ice' },
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

  return [storm, waterfall, garden, mansion, snow, mixer].map((s) => ({ ...s, layers: s.layers.filter((l) => l && l.id && usable(l)) }));
}

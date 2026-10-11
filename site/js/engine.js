// Ambiance audio engine.
//
// A scene is a stack of layers:
//   bed    – a long recording that never audibly loops: it plays from a random point and every
//            half-minute or so crossfades (equal-power) to another random point.
//   shots  – one-off events (a creak, a gust, a gull) at natural, irregular intervals, each placed
//            somewhere around the listener with distance cues (level, air absorption, reverb).
//   flock  – birds as little agents: each one keeps a perch, sings in bouts, rests, moves on.
//   storm  – thunder that arrives after its lightning, delayed and dulled by distance.
//   pulse  – a pendulum clock: tick, tock, and the odd strike of the hour.
//   synth  – generated sound: coloured noise, gusting wind, a low drone.
// Scenes can declare slow "drivers" (storm strength, dawn progress) that layers follow.

import { store } from './store.js';

const LOOKAHEAD = 4; // seconds of events scheduled ahead of the audio clock
const TICK_MS = 200;

const rand = (a, b) => a + Math.random() * (b - a);
const val = (r, d = 0) => (Array.isArray(r) ? rand(r[0], r[1]) : r ?? d);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const db = (x) => Math.pow(10, x / 20);
// Fader law: slider 0..1 → gain. Squared feels even across the travel.
export const faderGain = (v) => (v <= 0 ? 0 : v * v);

// Natural spacing between events: exponential (Poisson) around the mean, clipped to the range.
function gap([min, max], speed = 1) {
  const mean = (min + max) / 2;
  const x = min + -Math.log(1 - Math.random()) * (mean - min);
  return clamp(x, min, max * 1.6) / Math.max(0.05, speed);
}

function pickFrom(list, last) {
  if (list.length === 1) return list[0];
  let item;
  let guard = 0;
  do {
    const total = list.reduce((s, x) => s + (x.weight ?? 1), 0);
    let r = Math.random() * total;
    item = list.find((x) => (r -= x.weight ?? 1) <= 0) || list[list.length - 1];
  } while (item === last && ++guard < 8);
  return item;
}

const CURVE_N = 64;
const FADE_IN = new Float32Array(CURVE_N);
const FADE_OUT = new Float32Array(CURVE_N);
for (let i = 0; i < CURVE_N; i++) {
  const t = i / (CURVE_N - 1);
  FADE_IN[i] = Math.sin((t * Math.PI) / 2);
  FADE_OUT[i] = Math.cos((t * Math.PI) / 2);
}

function curve(param, shape, at, dur) {
  try {
    param.cancelScheduledValues(at);
    param.setValueCurveAtTime(shape, at, dur);
  } catch {
    param.cancelScheduledValues(at);
    param.setValueAtTime(shape[0], at);
    param.linearRampToValueAtTime(shape[shape.length - 1], at + dur);
  }
}

// MP3 carries a few milliseconds of encoder padding at each end. In a continuous texture that
// would be a click every time a bed wraps around, so beds get it trimmed off after decoding.
function trimPadding(ctx, buf) {
  const n = buf.length;
  const chans = Array.from({ length: buf.numberOfChannels }, (_, c) => buf.getChannelData(c));
  const scan = Math.min(n >> 2, 6000);
  const loud = (i) => chans.some((d) => Math.abs(d[i]) > 1e-3);
  let a = 0;
  while (a < scan && !loud(a)) a++;
  let b = n;
  while (b > n - scan && !loud(b - 1)) b--;
  if (a === 0 && b === n) return buf;
  const out = ctx.createBuffer(chans.length, b - a, buf.sampleRate);
  chans.forEach((d, c) => out.copyToChannel(d.subarray(a, b), c));
  return out;
}

function decode(ctx, data) {
  return new Promise((resolve, reject) => {
    const p = ctx.decodeAudioData(data, resolve, reject);
    if (p && p.then) p.then(resolve, reject);
  });
}

// --- generated impulse responses -------------------------------------------------------------
// Exponentially decaying stereo noise whose high end dies away faster than its low end, with a
// few early reflections for rooms. Cheap, smooth and convincing at low send levels.
const REVERBS = {
  hall: { seconds: 3.6, decay: 3.2, damp: 0.86, early: 9, pre: 0.018 },
  room: { seconds: 1.1, decay: 3.5, damp: 0.8, early: 6, pre: 0.006 },
  forest: { seconds: 1.8, decay: 4.5, damp: 0.93, early: 3, pre: 0.012 },
  open: { seconds: 2.6, decay: 5, damp: 0.95, early: 0, pre: 0.02 },
  snow: { seconds: 0.9, decay: 6, damp: 0.97, early: 0, pre: 0.01 },
};

function makeImpulse(ctx, name) {
  const o = REVERBS[name] || REVERBS.open;
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * o.seconds);
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    const pre = Math.floor(o.pre * rate);
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / (len - pre);
      const env = Math.pow(1 - t, o.decay);
      // the one-pole low-pass closes over time: highs fade first
      const k = 1 - Math.pow(o.damp, 1 + t * 6);
      lp += k * (Math.random() * 2 - 1 - lp);
      d[i] = lp * env;
    }
    for (let e = 0; e < o.early; e++) {
      const at = pre + Math.floor(rate * rand(0.004, 0.09));
      if (at < len) d[at] += rand(-0.6, 0.6) * (1 - e / (o.early + 2));
    }
  }
  return buf;
}

// --- generated noise -----------------------------------------------------------------------------
function makeNoise(ctx, color, seconds = 12) {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (color === 'pink') {
        // Paul Kellet's refined pink filter
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      } else if (color === 'brown') {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else {
        d[i] = w * 0.5;
      }
    }
    // make the loop seamless: crossfade the last 200 ms into the first
    const x = Math.floor(rate * 0.2);
    for (let i = 0; i < x; i++) {
      const t = i / x;
      d[i] = d[i] * Math.sin((t * Math.PI) / 2) + d[len - x + i] * Math.cos((t * Math.PI) / 2);
    }
  }
  return buf;
}

// --- placement ---------------------------------------------------------------------------------
// Builds src → [filter] → gain → [panner] → layer out, plus a reverb send that grows with distance.
function place(layer, at, dur, spec, pos) {
  const { ctx } = layer;
  const nodes = {};
  const input = ctx.createGain();
  let head = input;
  let distance = 0;
  let posUsed = null;

  if (spec.space || pos) {
    const s = spec.space || {};
    const p = pos || {
      az: val(s.az, rand(-180, 180)),
      el: val(s.el, 0),
      dist: val(s.dist, 10),
    };
    posUsed = p;
    distance = p.dist;
    // air absorption: far sounds lose their top end
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = clamp(20000 * Math.exp(-p.dist / (s.air ?? 90)), 900, 20000);
    lp.Q.value = 0.5;
    const near = s.near ?? 4;
    const level = ctx.createGain();
    level.gain.value = near / Math.max(near, p.dist);
    head.connect(lp).connect(level);
    head = level;
    const pan = ctx.createPanner();
    pan.panningModel = layer.engine.hrtf ? 'HRTF' : 'equalpower';
    pan.distanceModel = 'linear';
    pan.rolloffFactor = 0; // distance handled above, so levels stay predictable
    setPosition(pan, p.az, p.el, p.dist, at);
    if (s.move || p.move) {
      const m = p.move || { az: p.az + val(s.move.az, 60), el: p.el, dist: val(s.move.dist, p.dist) };
      rampPosition(pan, m.az, m.el ?? p.el, m.dist ?? p.dist, at, at + dur);
    }
    head.connect(pan);
    head = pan;
    nodes.pan = pan;
  } else if (spec.pan != null) {
    const sp = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (sp) {
      sp.pan.value = clamp(val(spec.pan), -1, 1);
      head.connect(sp);
      head = sp;
    }
  }

  head.connect(layer.out);
  const send = (spec.reverb ?? 0) * (1 + distance / 25);
  if (send > 0 && layer.scene.reverbIn) {
    const g = ctx.createGain();
    g.gain.value = send;
    head.connect(g).connect(layer.scene.reverbIn);
    nodes.send = g;
  }
  nodes.input = input;
  nodes.head = head;
  nodes.pos = posUsed && { az: posUsed.az, dist: posUsed.dist };
  return nodes;
}

function xyz(az, el, dist) {
  const a = (az * Math.PI) / 180;
  const e = (el * Math.PI) / 180;
  return [dist * Math.cos(e) * Math.sin(a), dist * Math.sin(e), -dist * Math.cos(e) * Math.cos(a)];
}

function setPosition(p, az, el, dist, at) {
  const [x, y, z] = xyz(az, el, dist);
  if (p.positionX) {
    p.positionX.setValueAtTime(x, at);
    p.positionY.setValueAtTime(y, at);
    p.positionZ.setValueAtTime(z, at);
  } else {
    p.setPosition(x, y, z);
  }
}

function rampPosition(p, az, el, dist, from, to) {
  if (!p.positionX) return;
  const [x, y, z] = xyz(az, el, dist);
  p.positionX.linearRampToValueAtTime(x, to);
  p.positionY.linearRampToValueAtTime(y, to);
  p.positionZ.linearRampToValueAtTime(z, to);
}

function playBuffer(layer, buffer, at, spec, opts = {}) {
  const { ctx } = layer;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const rate = opts.rate ?? val(spec.rate, 1);
  src.playbackRate.value = rate;
  const dur = buffer.duration / rate;
  const nodes = place(layer, at, dur, spec, opts.pos);
  const g = ctx.createGain();
  g.gain.value = (opts.gain ?? 1) * db(val(spec.gainDb, 0));
  let tail = g;
  if (opts.lowpass) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = opts.lowpass;
    g.connect(f);
    tail = f;
  }
  src.connect(g);
  tail.connect(nodes.input);
  src.start(at);
  src.onended = () => {
    try {
      src.disconnect();
      g.disconnect();
      nodes.input.disconnect();
      nodes.head.disconnect();
      nodes.send?.disconnect();
    } catch {
      /* already gone */
    }
  };
  layer.sources.add(src);
  src.addEventListener('ended', () => layer.sources.delete(src));
  return { src, dur, pos: nodes.pos };
}

// --- layers -------------------------------------------------------------------------------------
class Layer {
  constructor(scene, def) {
    this.scene = scene;
    this.engine = scene.engine;
    this.ctx = scene.ctx;
    this.def = def;
    this.id = def.id;
    this.level = 0;
    this.out = this.ctx.createGain();
    this.out.gain.value = 0;
    this.trim = this.ctx.createGain(); // calibration × driver modulation
    this.trim.gain.value = def.gain ?? 1;
    this.out.connect(this.trim).connect(scene.bus);
    this.sources = new Set();
    this.ready = false;
    this.state = 'idle';
    if (def.muffle) {
      // heard through walls or from far away: take the top off the whole layer
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = def.muffle;
      this.out.disconnect();
      this.out.connect(f).connect(this.trim);
    }
  }

  async load() {
    this.ready = true;
  }

  setLevel(v, when = this.ctx.currentTime) {
    this.level = v;
    this.out.gain.cancelScheduledValues(when);
    this.out.gain.setTargetAtTime(faderGain(v), when, 0.25);
  }

  drive() {
    const d = this.def.drive;
    if (!d) return 1;
    const v = this.scene.drivers[d.by] ?? 1;
    return d.gain ? lerp(d.gain[0], d.gain[1], v) : 1;
  }

  speed() {
    const d = this.def.drive;
    if (!d || !d.rate) return 1;
    return lerp(d.rate[0], d.rate[1], this.scene.drivers[d.by] ?? 1);
  }

  tick() {}

  stop(at) {
    for (const s of this.sources) {
      try {
        s.stop(at);
      } catch {
        /* not started or already stopped */
      }
    }
  }
}

class BedLayer extends Layer {
  constructor(scene, def) {
    super(scene, def);
    this.mod = this.ctx.createGain();
    let head = this.mod;
    if (def.filter) {
      const f = this.ctx.createBiquadFilter();
      f.type = def.filter.type || 'lowpass';
      f.frequency.value = def.filter.freq;
      f.Q.value = def.filter.q ?? 0.7;
      f.connect(this.mod);
      head = f;
      this.filter = f;
    }
    this.mod.connect(this.out);
    if (def.pan != null && this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = def.pan;
      this.mod.disconnect();
      this.mod.connect(p).connect(this.out);
    }
    this.input = head;
    this.voice = null;
    this.nextSwitch = 0;
    this.nextWander = 0;
    this.buffers = [];
  }

  async load() {
    const files = this.def.files;
    // start with whichever file arrives first; the rest join the rotation as they land
    await new Promise((resolve, reject) => {
      let done = 0;
      let resolved = false;
      files.forEach((f) =>
        this.engine.load(f, { trim: true }).then(
          (b) => {
            this.buffers.push(b);
            if (!resolved) {
              resolved = true;
              resolve();
            }
          },
          (e) => {
            if (++done === files.length && !resolved) reject(e);
          },
        ),
      );
    });
    this.ready = true;
  }

  startVoice(at, fade) {
    const buf = pickFrom(this.buffers, this.voice?.buf);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true; // if the scheduler ever stalls, the bed simply keeps going
    const g = this.ctx.createGain();
    src.connect(g).connect(this.input);
    const offset = Math.random() * buf.duration * 0.9;
    if (fade > 0) {
      g.gain.setValueAtTime(0, at);
      curve(g.gain, FADE_IN, at, fade);
    }
    src.start(at, offset);
    this.sources.add(src);
    src.addEventListener('ended', () => {
      this.sources.delete(src);
      try {
        src.disconnect();
        g.disconnect();
      } catch {
        /* gone */
      }
    });
    return { src, g, buf };
  }

  tick(now) {
    if (!this.buffers.length) return;
    const d = this.def;
    if (!this.voice) {
      this.voice = this.startVoice(now + 0.05, d.fadeIn ?? 3);
      this.nextSwitch = now + val(d.hold ?? [28, 75]);
      return;
    }
    // a short file is just looped; long ones hop around
    if (this.voice.buf.duration > 20 && now >= this.nextSwitch - 0.5) {
      const x = Math.min(val(d.xfade ?? [5, 9]), this.voice.buf.duration / 4);
      const at = Math.max(now + 0.1, this.nextSwitch);
      const old = this.voice;
      curve(old.g.gain, FADE_OUT, at, x);
      old.src.stop(at + x + 0.05);
      this.voice = this.startVoice(at, x);
      this.nextSwitch = at + x + val(d.hold ?? [28, 75]);
    }
    if (now >= this.nextWander) {
      const w = d.wander || [0.8, 1];
      const target = rand(w[0], w[1]) * this.drive();
      this.mod.gain.setTargetAtTime(target, now, val(d.wanderTau ?? [3, 9]));
      this.nextWander = now + val(d.wanderEvery ?? [6, 18]);
    }
  }
}

class ShotLayer extends Layer {
  constructor(scene, def) {
    super(scene, def);
    this.items = [];
    this.next = null;
    this.last = null;
  }

  // Long recordings (thunder rolls) stay compressed in memory and only a few are decoded at a
  // time — decoded audio is ~23 MB a stereo minute, which phones run out of quickly.
  async load() {
    const d = this.def;
    const items = d.pool.map((p) => (typeof p === 'string' ? { file: p } : { ...p }));
    if (d.lazy) {
      await Promise.allSettled(items.map(async (it) => (it.bytes = await this.engine.bytes(it.file))));
      this.items = items.filter((it) => it.bytes);
      if (!this.items.length) throw new Error('no recordings for ' + this.id);
      await this.prepare(d.keep ?? 3);
    } else {
      const loaded = await Promise.allSettled(
        items.map(async (it) => {
          it.buf = await this.engine.load(it.file);
          this.items.push(it);
        }),
      );
      if (!this.items.length) throw loaded.find((r) => r.status === 'rejected')?.reason;
    }
    this.ready = true;
  }

  async prepare(n) {
    const waiting = this.items.filter((i) => !i.buf && !i.decoding);
    for (let k = 0; k < n && waiting.length; k++) {
      const it = waiting.splice(Math.floor(Math.random() * waiting.length), 1)[0];
      it.decoding = decode(this.ctx, it.bytes.slice(0))
        .then((b) => (it.buf = b))
        .catch(() => {})
        .finally(() => (it.decoding = null));
    }
    await Promise.allSettled(this.items.map((i) => i.decoding).filter(Boolean));
    const keep = this.def.keep ?? 3;
    const decoded = this.items.filter((i) => i.buf && i !== this.last);
    while (decoded.length > keep) decoded.splice(Math.floor(Math.random() * decoded.length), 1)[0].buf = null;
  }

  available() {
    return this.items.filter((i) => i.buf);
  }

  // after playing one, swap a different recording into memory for next time
  rotate() {
    if (this.def.lazy) this.prepare(1);
  }

  tick(now) {
    if (!this.items.length || this.level <= 0.001) {
      this.next = null;
      return;
    }
    const d = this.def;
    if (this.next == null) this.next = now + val(d.first ?? [d.every[0] * 0.3, d.every[1] * 0.6]);
    // after the page was frozen (screen locked), pick up the rhythm instead of firing a backlog
    if (this.next < now - 2) this.next = now + rand(1, d.every[0]);
    while (this.next < now + LOOKAHEAD) {
      if (!this.available().length) break;
      this.fire(Math.max(this.next, now + 0.05));
      this.next += gap(d.every, this.speed());
    }
  }

  fire(at) {
    const item = pickFrom(this.available(), this.last);
    this.last = item;
    const { dur, pos } = playBuffer(this, item.buf, at, this.def, { gain: item.gain ?? 1 });
    this.scene.emit({ type: 'shot', layer: this.id, at, dur, tag: item.tag, az: pos?.az, dist: pos?.dist });
    this.rotate();
  }
}

// Thunder: lightning first, the sound later — 2.9 s per km — quieter and duller with distance.
class StormLayer extends ShotLayer {
  fire(at) {
    const strength = this.scene.drivers[this.def.drive?.by] ?? 0.7;
    // a strong storm is overhead; a weak one grumbles in the distance
    const km = clamp(rand(0.4, 9) * lerp(1.4, 0.35, strength) + rand(0, 1.5), 0.3, 12);
    const near = km < 2.2;
    const ready = this.available();
    const pool = ready.filter((i) => (near ? i.tag !== 'far' : i.tag !== 'near'));
    const item = pickFrom(pool.length ? pool : ready, this.last);
    this.last = item;
    const flash = at;
    const boom = flash + km * 2.9 + rand(-0.2, 0.4);
    const gain = (item.gain ?? 1) * clamp(1.6 / (0.6 + km * 0.5), 0.12, 1);
    const lowpass = clamp(14000 * Math.exp(-km / 2.6), 380, 14000);
    const { dur } = playBuffer(this, item.buf, boom, { ...this.def, pan: [-0.8, 0.8] }, {
      gain,
      lowpass,
      rate: rand(0.94, 1.04),
    });
    this.scene.emit({ type: 'lightning', layer: this.id, at: flash, km, strength: clamp(1.2 - km / 9, 0.15, 1) });
    this.scene.emit({ type: 'thunder', layer: this.id, at: boom, dur, km });
    this.rotate();
  }
}

// Birds: each one keeps a perch, sings a bout of phrases with short gaps, rests, sometimes moves.
class FlockLayer extends Layer {
  constructor(scene, def) {
    super(scene, def);
    this.birds = [];
    this.species = [];
  }

  async load() {
    await Promise.allSettled(
      this.def.species.map(async (sp) => {
        const phrases = [];
        await Promise.allSettled(
          sp.files.map(async (f) => {
            const item = typeof f === 'string' ? { file: f } : { ...f };
            item.buf = await this.engine.load(item.file);
            phrases.push(item);
          }),
        );
        if (phrases.length) this.species.push({ ...sp, phrases });
      }),
    );
    if (!this.species.length) throw new Error('no birds loaded for ' + this.id);
    const now = this.ctx.currentTime;
    for (const sp of this.species) {
      const n = Math.round(val(sp.count ?? 1));
      for (let i = 0; i < n; i++) this.birds.push(this.newBird(sp, now, true));
    }
    this.ready = true;
  }

  newBird(sp, now, initial) {
    const s = { ...this.def.space, ...sp.space };
    return {
      sp,
      pos: { az: val(s.az, rand(-170, 170)), el: val(s.el, rand(0, 30)), dist: val(s.dist, rand(8, 40)) },
      // stagger the start so the scene fades in naturally rather than all at once
      next: now + (initial ? rand(0.5, val(sp.rest ?? [10, 40]) * 0.8) : val(sp.rest ?? [10, 40])),
      left: 0,
      moveAt: now + val(this.def.relocate ?? [90, 300]),
      last: null,
    };
  }

  tick(now) {
    if (!this.ready) return;
    if (this.level <= 0.001) {
      this.muted = true;
      return;
    }
    const activity = this.speed();
    for (let i = 0; i < this.birds.length; i++) {
      const b = this.birds[i];
      // coming back from silence or a frozen page: birds start afresh, not all at once
      if (this.muted || b.next < now - 2) {
        b.next = now + rand(0.5, 10);
        b.left = 0;
      }
      while (b.next < now + LOOKAHEAD) {
        if (b.left <= 0) b.left = Math.round(val(b.sp.bout ?? [3, 8]) * clamp(activity, 0.4, 1.6));
        const item = pickFrom(b.sp.phrases, b.last);
        b.last = item;
        const at = Math.max(b.next, now + 0.05);
        const { dur } = playBuffer(this, item.buf, at, { ...this.def, ...b.sp }, {
          pos: b.pos,
          gain: (item.gain ?? 1) * (b.sp.gain ?? 1),
          rate: rand(0.985, 1.015),
        });
        this.scene.emit({ type: 'bird', layer: this.id, species: b.sp.id, at, dur, az: b.pos.az, dist: b.pos.dist });
        b.left -= 1;
        b.next = at + dur + (b.left > 0 ? val(b.sp.gap ?? [1.5, 5]) : gap(b.sp.rest ?? [10, 40], activity));
        if (b.left <= 0 && b.next > b.moveAt) {
          this.birds[i] = this.newBird(b.sp, b.next, false);
          this.birds[i].next = b.next;
          break;
        }
      }
    }
    this.muted = false;
  }
}

// A pendulum clock: tick, tock, and now and then the hour.
class PulseLayer extends Layer {
  async load() {
    const d = this.def;
    this.tickBuf = await this.engine.load(d.tick);
    this.tockBuf = d.tock ? await this.engine.load(d.tock) : this.tickBuf;
    this.chimeBuf = d.chime ? await this.engine.load(d.chime.file).catch(() => null) : null;
    this.pos = { az: val(d.space?.az, -35), el: val(d.space?.el, 5), dist: val(d.space?.dist, 4) };
    this.beat = 0;
    this.nextBeat = null;
    this.ready = true;
  }

  tick(now) {
    if (!this.ready) return;
    const d = this.def;
    if (this.nextBeat == null) {
      this.nextBeat = now + 0.3;
      this.nextChime = now + val(d.chime?.every ?? [400, 900]);
    }
    if (this.nextBeat < now - 0.5) this.nextBeat = now + 0.1;
    while (this.nextBeat < now + LOOKAHEAD) {
      const buf = this.beat % 2 ? this.tockBuf : this.tickBuf;
      playBuffer(this, buf, this.nextBeat, d, { pos: this.pos, gain: rand(0.85, 1), rate: rand(0.995, 1.005) });
      this.nextBeat += d.period * (1 + rand(-0.002, 0.002));
      this.beat++;
    }
    if (this.chimeBuf && this.nextChime < now + LOOKAHEAD) {
      const count = Math.round(val(d.chime.count ?? [1, 12]));
      // strike between beats, like a real movement releasing the hammer
      let t = Math.max(this.nextChime, now + 0.1);
      for (let i = 0; i < count; i++) {
        playBuffer(this, this.chimeBuf, t, d, { pos: this.pos, gain: d.chime.gain ?? 0.8 });
        t += d.chime.spacing ?? 2.4;
      }
      this.scene.emit({ type: 'chime', layer: this.id, at: this.nextChime, count });
      this.nextChime = t + val(d.chime.every ?? [400, 900]);
    }
  }
}

// Generated layers.
class SynthLayer extends Layer {
  async load() {
    const { ctx } = this;
    const d = this.def;
    this.mod = ctx.createGain();
    this.mod.connect(this.out);
    if (d.synth === 'noise') {
      const src = ctx.createBufferSource();
      src.buffer = this.engine.noise(d.color);
      src.loop = true;
      let head = src;
      if (d.filter) {
        const f = ctx.createBiquadFilter();
        f.type = d.filter.type || 'lowpass';
        f.frequency.value = d.filter.freq;
        src.connect(f);
        head = f;
      }
      head.connect(this.mod);
      src.start(ctx.currentTime + 0.05, Math.random() * 10);
      this.sources.add(src);
    } else if (d.synth === 'wind') {
      // Two resonant bands of pink noise whose pitch and level follow a gust process,
      // plus an optional whistle: a narrow band that sings when the gusts peak.
      const src = ctx.createBufferSource();
      src.buffer = this.engine.noise('pink');
      src.loop = true;
      this.bands = [];
      const centres = d.bands ?? [320, 900];
      for (const c of centres) {
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = c;
        f.Q.value = d.q ?? 1.2;
        const g = ctx.createGain();
        g.gain.value = 0.5;
        src.connect(f).connect(g).connect(this.mod);
        this.bands.push({ f, g, c });
      }
      if (d.whistle) {
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = d.whistle;
        f.Q.value = 28;
        const g = ctx.createGain();
        g.gain.value = 0;
        src.connect(f).connect(g).connect(this.mod);
        this.whistle = { f, g };
      }
      src.start(ctx.currentTime + 0.05, Math.random() * 10);
      this.sources.add(src);
      this.nextGust = 0;
    } else if (d.synth === 'drone') {
      // a barely-there low hum that slowly beats against itself
      const freqs = d.freqs ?? [36.7, 37.1, 55.1];
      for (const fr of freqs) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = fr;
        const g = ctx.createGain();
        g.gain.value = 0.25;
        o.connect(g).connect(this.mod);
        o.start();
        this.sources.add(o);
      }
      const n = ctx.createBufferSource();
      n.buffer = this.engine.noise('brown');
      n.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 140;
      const ng = ctx.createGain();
      ng.gain.value = 0.35;
      n.connect(lp).connect(ng).connect(this.mod);
      n.start();
      this.sources.add(n);
      this.nextGust = 0;
    }
    this.ready = true;
  }

  tick(now) {
    if (!this.ready) return;
    const d = this.def;
    if (d.synth === 'wind' && now >= this.nextGust) {
      const strength = clamp(val(d.gust ?? [0.2, 1]) * this.drive(), 0, 1.2);
      const tau = val([1.2, 3.5]);
      for (const b of this.bands) {
        b.f.frequency.setTargetAtTime(b.c * lerp(0.75, 1.5, strength), now, tau);
        b.g.gain.setTargetAtTime(lerp(0.15, 0.8, strength), now, tau);
      }
      if (this.whistle) {
        this.whistle.f.frequency.setTargetAtTime(d.whistle * lerp(0.85, 1.35, strength), now, tau);
        this.whistle.g.gain.setTargetAtTime(strength > 0.7 ? (strength - 0.7) * 1.4 : 0, now, tau * 0.8);
      }
      this.nextGust = now + val(d.gustEvery ?? [2, 6]);
    } else if (d.synth === 'drone' && now >= this.nextGust) {
      this.mod.gain.setTargetAtTime(rand(0.6, 1), now, 6);
      this.nextGust = now + rand(8, 20);
    } else if (d.synth === 'noise' && this.def.drive) {
      this.mod.gain.setTargetAtTime(this.drive(), now, 2);
    }
  }
}

const LAYERS = { bed: BedLayer, shots: ShotLayer, storm: StormLayer, flock: FlockLayer, pulse: PulseLayer, synth: SynthLayer };

// --- scene ----------------------------------------------------------------------------------------
export class Scene {
  constructor(engine, def, levels) {
    this.engine = engine;
    this.ctx = engine.ctx;
    this.def = def;
    this.bus = this.ctx.createGain();
    this.bus.gain.value = 0;
    this.bus.connect(engine.master);
    this.reverbIn = null;
    if (def.reverb) {
      this.reverbIn = this.ctx.createGain();
      const conv = this.ctx.createConvolver();
      conv.buffer = engine.impulse(def.reverb.type);
      const wet = this.ctx.createGain();
      wet.gain.value = def.reverb.level ?? 0.5;
      this.reverbIn.connect(conv).connect(wet).connect(this.bus);
    }
    this.drivers = {};
    this.driverState = {};
    this.started = this.ctx.currentTime;
    for (const [name, spec] of Object.entries(def.drivers || {})) {
      this.drivers[name] = spec.start ?? (spec.ramp ? 0 : rand(spec.range?.[0] ?? 0.4, spec.range?.[1] ?? 1));
      this.driverState[name] = { target: this.drivers[name], next: 0 };
    }
    this.layers = new Map();
    for (const l of def.layers) {
      const L = LAYERS[l.type];
      if (!L) continue;
      const layer = new L(this, l);
      layer.level = levels[l.id] ?? l.level ?? 0;
      this.layers.set(l.id, layer);
    }
    this.stopped = false;
  }

  emit(detail) {
    this.engine.dispatchEvent(new CustomEvent('scene-event', { detail: { ...detail, scene: this.def.id } }));
  }

  // Only layers that are turned up get fetched; the rest load the moment you raise them.
  loadLayer(l) {
    if (!l.loading) {
      l.state = 'loading';
      l.loading = l.load().then(
        () => {
          l.state = 'ready';
          if (this.stopped) return;
          l.setLevel(l.level);
          this.engine.dispatchEvent(new CustomEvent('layer-state', { detail: { scene: this.def.id, layer: l.id, state: 'ready' } }));
        },
        (err) => {
          l.state = 'error';
          console.warn('layer failed', l.id, err);
          this.engine.dispatchEvent(new CustomEvent('layer-state', { detail: { scene: this.def.id, layer: l.id, state: 'error' } }));
        },
      );
      this.engine.dispatchEvent(new CustomEvent('layer-state', { detail: { scene: this.def.id, layer: l.id, state: 'loading' } }));
    }
    return l.loading;
  }

  async start(fade = 2.5) {
    // Beds first, so there's sound as soon as possible.
    const order = [...this.layers.values()]
      .filter((l) => l.level > 0)
      .sort((a, b) => (a.def.type === 'bed' ? 0 : 1) - (b.def.type === 'bed' ? 0 : 1));
    const loads = order.map((l) => this.loadLayer(l));
    const now = this.ctx.currentTime;
    this.bus.gain.cancelScheduledValues(now);
    this.bus.gain.setValueAtTime(0, now);
    this.bus.gain.linearRampToValueAtTime(this.def.gain ?? 1, now + fade);
    const firstBed = order.findIndex((l) => l.def.type === 'bed');
    await (firstBed >= 0 ? loads[firstBed] : Promise.allSettled(loads));
  }

  tick(now) {
    for (const [name, spec] of Object.entries(this.def.drivers || {})) {
      const st = this.driverState[name];
      if (spec.ramp) {
        // a slow, one-way journey (dawn): 0 → 1 over `ramp` seconds, then holds
        this.drivers[name] = clamp((now - this.started) / spec.ramp + (spec.start ?? 0), 0, 1);
      } else {
        if (now >= st.next) {
          st.target = rand(spec.range?.[0] ?? 0.3, spec.range?.[1] ?? 1);
          st.next = now + val(spec.every ?? [60, 180]);
        }
        const k = 1 - Math.exp(-(TICK_MS / 1000) / (spec.tau ?? 25));
        this.drivers[name] += (st.target - this.drivers[name]) * k;
      }
    }
    for (const l of this.layers.values()) {
      if (!l.ready) continue;
      try {
        l.tick(now);
      } catch (e) {
        console.warn('tick', l.id, e);
      }
    }
  }

  setLevel(id, v) {
    const l = this.layers.get(id);
    if (!l) return;
    l.setLevel(v);
    if (v > 0) this.loadLayer(l);
  }

  stop(fade = 2) {
    this.stopped = true;
    const now = this.ctx.currentTime;
    this.bus.gain.cancelScheduledValues(now);
    this.bus.gain.setValueAtTime(this.bus.gain.value, now);
    this.bus.gain.linearRampToValueAtTime(0, now + fade);
    for (const l of this.layers.values()) l.stop(now + fade + 0.05);
    setTimeout(() => {
      try {
        this.bus.disconnect();
      } catch {
        /* gone */
      }
    }, (fade + 0.3) * 1000);
  }
}

// --- engine ---------------------------------------------------------------------------------------
export class Engine extends EventTarget {
  constructor() {
    super();
    this.ctx = null;
    this.cache = new Map();
    this.byteCache = new Map();
    this.scene = null;
    this.volume = store.get('volume', 0.85);
    this.hrtf = store.get('headphones', false);
    this.paused = true;
    this._noise = {};
    this._impulses = {};
  }

  // Must run inside a user gesture the first time (iOS/Safari autoplay rules).
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      let ctx;
      try {
        ctx = new AC({ latencyHint: 'playback' });
      } catch {
        ctx = new AC();
      }
      this.attach(ctx);
      this._startClock();
      ctx.addEventListener?.('statechange', () => this.dispatchEvent(new Event('state')));
    }
    this._unlockIOS();
    return this.ctx;
  }

  // Build the output chain on a context (a live one, or an OfflineAudioContext for test renders).
  attach(ctx) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 4;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.004;
    limiter.release.value = 0.3;
    this.master.connect(limiter).connect(ctx.destination);
    return ctx;
  }

  // iOS routes Web Audio through the "ambient" session, which the silent switch mutes.
  // Asking for the playback session (Safari 17+), and keeping a silent media element
  // playing (older iOS), puts us on the same footing as a music app.
  _unlockIOS() {
    try {
      if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback';
    } catch {
      /* not supported */
    }
    if (!this._silent) {
      const a = document.createElement('audio');
      a.setAttribute('x-webkit-airplay', 'deny');
      a.preload = 'auto';
      a.loop = true;
      a.src = 'audio/silence.mp3';
      a.volume = 1;
      this._silent = a;
    }
    this._silent.play().catch(() => {});
  }

  _startClock() {
    // Timers in a Worker keep their pace better than main-thread timers when the screen is off.
    const tick = () => {
      if (!this.ctx || !this.scene) return;
      const now = this.ctx.currentTime;
      this.scene.tick(now);
      if (this.sleepAt && Date.now() >= this.sleepAt) {
        this.sleepAt = null;
        this.pause(90);
        this.dispatchEvent(new Event('slept'));
      }
    };
    try {
      const code = `setInterval(() => postMessage(0), ${TICK_MS});`;
      const w = new Worker(URL.createObjectURL(new Blob([code], { type: 'text/javascript' })));
      w.onmessage = tick;
      this._worker = w;
    } catch {
      setInterval(tick, TICK_MS);
    }
  }

  load(url, { trim = false } = {}) {
    if (!this.cache.has(url)) {
      const p = fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
          return r.arrayBuffer();
        })
        .then((data) => decode(this.ctx, data))
        .then((buf) => (trim ? trimPadding(this.ctx, buf) : buf));
      this.cache.set(url, p);
      p.catch(() => this.cache.delete(url));
    }
    return this.cache.get(url);
  }

  bytes(url) {
    if (!this.byteCache.has(url)) {
      const p = fetch(url).then((r) => {
        if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
        return r.arrayBuffer();
      });
      this.byteCache.set(url, p);
      p.catch(() => this.byteCache.delete(url));
    }
    return this.byteCache.get(url);
  }

  noise(color = 'pink') {
    return (this._noise[color] ||= makeNoise(this.ctx, color));
  }

  impulse(type) {
    return (this._impulses[type] ||= makeImpulse(this.ctx, type));
  }

  async play(def, levels, { fade = 3 } = {}) {
    this.ensure();
    await this.resume();
    if (this.scene && this.scene.def.id === def.id) {
      this._fadeMaster(1, 1.5);
      this.paused = false;
      this.dispatchEvent(new Event('play'));
      return;
    }
    const old = this.scene;
    if (old) old.stop(fade);
    this.scene = new Scene(this, def, levels);
    this._release(def, old);
    this.paused = false;
    this._fadeMaster(1, 1);
    this.dispatchEvent(new Event('play'));
    await this.scene.start(fade);
  }

  // Free decoded audio that the new scene doesn't use (it can be a lot of memory on a phone).
  _release(def, old) {
    if (!old) return;
    const keep = new Set(sceneFiles(def));
    setTimeout(() => {
      for (const url of [...this.cache.keys()]) if (!keep.has(url)) this.cache.delete(url);
      for (const url of [...this.byteCache.keys()]) if (!keep.has(url)) this.byteCache.delete(url);
    }, 4000);
  }

  async resume() {
    if (!this.ctx) return;
    if (this.ctx.state !== 'running') {
      try {
        await this.ctx.resume();
      } catch {
        /* needs a gesture */
      }
    }
  }

  pause(fade = 1.2) {
    if (!this.ctx) return;
    this.paused = true;
    this._fadeMaster(0, fade);
    clearTimeout(this._suspendTimer);
    this._suspendTimer = setTimeout(() => {
      if (!this.paused) return;
      this.ctx.suspend().catch(() => {});
      this._silent?.pause();
    }, fade * 1000 + 300);
    this.dispatchEvent(new Event('pause'));
  }

  async unpause() {
    if (!this.scene) return;
    this.ensure();
    clearTimeout(this._suspendTimer);
    await this.resume();
    this.paused = false;
    this._fadeMaster(1, 1.5);
    this.dispatchEvent(new Event('play'));
  }

  stop(fade = 1.5) {
    if (!this.scene) return;
    this.scene.stop(fade);
    this.scene = null;
    this.pause(fade);
  }

  setVolume(v) {
    this.volume = v;
    store.set('volume', v);
    if (!this.paused) this._fadeMaster(1, 0.15);
  }

  setHeadphones(on) {
    this.hrtf = on;
    store.set('headphones', on);
  }

  setLevel(id, v) {
    this.scene?.setLevel(id, v);
  }

  layerState(id) {
    return this.scene?.layers.get(id)?.state ?? 'idle';
  }

  sleepIn(minutes) {
    this.sleepAt = minutes ? Date.now() + minutes * 60000 : null;
  }

  _fadeMaster(to, seconds) {
    if (!this.ctx) return;
    const g = this.master.gain;
    const now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(to * faderGain(this.volume), now + seconds);
  }

  // Seconds until an audio-clock time happens at the speakers, for syncing visuals.
  delayUntil(at) {
    if (!this.ctx) return 0;
    const latency = (this.ctx.outputLatency || this.ctx.baseLatency || 0) || 0;
    return at - this.ctx.currentTime + latency;
  }
}

export function sceneFiles(def) {
  const files = [];
  for (const l of def.layers) {
    if (l.files) files.push(...l.files);
    if (l.pool) files.push(...l.pool.map((p) => (typeof p === 'string' ? p : p.file)));
    if (l.species) for (const s of l.species) files.push(...s.files.map((f) => (typeof f === 'string' ? f : f.file)));
    if (l.tick) files.push(l.tick);
    if (l.tock) files.push(l.tock);
    if (l.chime) files.push(l.chime.file);
  }
  return files;
}

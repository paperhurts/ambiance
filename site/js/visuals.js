// Scene paintings. Each scene is a quiet, slowly moving picture drawn on one canvas.
// Static parts are painted once per resize into an offscreen layer; only the living parts
// (rain, water, snow, light) are redrawn, at most 30 times a second, and nothing is drawn
// while the page is hidden or dimmed.

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

function hex(c) {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a, b, t) {
  const x = hex(a);
  const y = hex(b);
  return `rgb(${Math.round(lerp(x[0], y[0], t))},${Math.round(lerp(x[1], y[1], t))},${Math.round(lerp(x[2], y[2], t))})`;
}
// sample a list of [stop, colour] at t
function ramp(stops, t) {
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [a, ca] = stops[i - 1];
      const [b, cb] = stops[i];
      return mix(ca, cb, (t - a) / (b - a || 1));
    }
  }
  return stops[stops.length - 1][1];
}

function layer(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function vgrad(g, y0, y1, stops) {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  return gr;
}

// A ragged treeline: conifers or round crowns along a baseline.
function treeline(g, w, base, height, colour, kind = 'pine', seed = 1) {
  let s = seed;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  g.fillStyle = colour;
  g.beginPath();
  g.moveTo(0, base + height);
  let x = -20;
  while (x < w + 40) {
    const th = height * (0.55 + r() * 0.6);
    const tw = th * (kind === 'pine' ? 0.42 : 0.9) * (0.7 + r() * 0.5);
    if (kind === 'pine') {
      g.lineTo(x, base);
      g.lineTo(x + tw / 2, base - th);
      g.lineTo(x + tw, base);
    } else {
      g.lineTo(x, base);
      g.quadraticCurveTo(x - tw * 0.1, base - th * 0.9, x + tw / 2, base - th);
      g.quadraticCurveTo(x + tw * 1.1, base - th * 0.9, x + tw, base);
    }
    x += tw * (0.55 + r() * 0.3);
  }
  g.lineTo(w + 40, base + height);
  g.closePath();
  g.fill();
}

function hills(g, w, base, amp, colour, waves = 3, phase = 0) {
  g.fillStyle = colour;
  g.beginPath();
  g.moveTo(0, g.canvas.height);
  for (let x = 0; x <= w; x += 8) {
    const t = x / w;
    const y = base - amp * (0.5 + 0.5 * Math.sin(t * waves * TAU * 0.5 + phase)) * (0.6 + 0.4 * Math.sin(t * 7.1 + phase * 2));
    g.lineTo(x, y);
  }
  g.lineTo(w, g.canvas.height);
  g.closePath();
  g.fill();
}

// ---------------------------------------------------------------------------------------------
class Painting {
  constructor(canvas, engine) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.engine = engine;
    this.t = 0;
    this.dim = 0;
    this.running = false;
    this.flashes = [];
    this.resize();
  }
  get drivers() {
    return this.engine.scene?.drivers || {};
  }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (w === this.w && h === this.h) return;
    this.canvas.width = this.w = w;
    this.canvas.height = this.h = h;
    this.dpr = dpr;
    this.u = Math.min(w, h) / 100; // a unit that scales with the screen
    this.build();
    this.draw(0);
  }
  build() {}
  frame(dt) {}
  event() {}
  start() {
    if (this.running) return;
    this.running = true;
    let last = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      const dt = (now - last) / 1000;
      if (dt < 1 / 31) return; // cap at ~30 fps to save battery
      last = now;
      if (document.hidden) return;
      this.t += Math.min(dt, 0.1);
      this.draw(Math.min(dt, 0.1));
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }
  draw(dt) {
    this.frame(dt);
  }
  // schedule something to happen when an audio-clock time reaches the speakers
  at(audioTime, fn) {
    const ms = Math.max(0, this.engine.delayUntil(audioTime) * 1000);
    setTimeout(fn, ms);
  }
}

// ---------------------------------------------------------------------------------------------
// Storm over the sea, at night. A red buoy rides the swell.
class Storm extends Painting {
  build() {
    const { w, h } = this;
    this.horizon = h * 0.56;
    this.bg = layer(w, h);
    const g = this.bg.getContext('2d');
    g.fillStyle = vgrad(g, 0, this.horizon, [
      [0, '#08151c'],
      [0.55, '#132b35'],
      [1, '#2b4c57'],
    ]);
    g.fillRect(0, 0, w, this.horizon + 2);
    // the last light out at sea, under the cloud base
    const hz = g.createLinearGradient(0, this.horizon - h * 0.08, 0, this.horizon);
    hz.addColorStop(0, 'rgba(120,150,160,0)');
    hz.addColorStop(1, 'rgba(120,150,160,0.22)');
    g.fillStyle = hz;
    g.fillRect(0, this.horizon - h * 0.08, w, h * 0.08);
    // a moon somewhere behind the weather gives the clouds their shape
    const mg = g.createRadialGradient(w * 0.28, h * 0.16, 0, w * 0.28, h * 0.16, h * 0.35);
    mg.addColorStop(0, 'rgba(170,200,210,0.32)');
    mg.addColorStop(1, 'rgba(170,200,210,0)');
    g.fillStyle = mg;
    g.fillRect(0, 0, w, this.horizon);
    this.clouds = Array.from({ length: 16 }, (_, i) => ({
      x: rand(-0.2, 1.2) * w,
      y: lerp(0.02, 0.42, i / 15) * h + rand(-0.03, 0.03) * h,
      r: rand(0.14, 0.32) * Math.max(w, h),
      s: rand(4, 12) * this.u * 0.1,
      shade: rand(0.45, 0.8),
      light: rand(0, 1),
    }));
    const n = Math.round((w * h) / (9000 * this.dpr));
    this.drops = Array.from({ length: Math.min(900, n) }, () => this.drop(true));
    this.caps = [];
  }
  drop(anywhere) {
    return {
      x: rand(-0.3, 1.1) * this.w,
      y: anywhere ? rand(0, this.h) : rand(-0.2, 0) * this.h,
      v: rand(0.9, 1.4),
      l: rand(0.6, 1.4),
      a: rand(0.12, 0.35),
    };
  }
  event(e) {
    if (e.type === 'lightning') {
      this.at(e.at, () => {
        const strokes = e.strength > 0.5 ? Math.round(rand(2, 4)) : 1;
        let t = 0;
        for (let i = 0; i < strokes; i++) {
          this.flashes.push({ t0: this.t + t, life: rand(0.08, 0.2), k: e.strength * rand(0.6, 1), bolt: e.km < 3.5 && i === 0 ? this.bolt() : null, cx: rand(0.15, 0.85) });
          t += rand(0.06, 0.18);
        }
      });
    }
  }
  bolt() {
    const pts = [];
    let x = rand(0.15, 0.85) * this.w;
    let y = rand(0.05, 0.2) * this.h;
    while (y < this.horizon) {
      pts.push([x, y]);
      x += rand(-0.05, 0.05) * this.w;
      y += rand(0.02, 0.06) * this.h;
    }
    pts.push([x, this.horizon]);
    return pts;
  }
  frame(dt) {
    const { g, w, h, t, u } = this;
    const storm = this.drivers.storm ?? 0.7;
    g.drawImage(this.bg, 0, 0);

    // lightning light
    let flash = 0;
    let fx = 0.5;
    this.flashes = this.flashes.filter((f) => t - f.t0 < f.life + 0.25);
    for (const f of this.flashes) {
      const age = t - f.t0;
      if (age < 0) continue;
      const k = age < f.life ? f.k : f.k * Math.max(0, 1 - (age - f.life) / 0.25);
      if (k > flash) {
        flash = k;
        fx = f.cx;
      }
    }
    if (flash > 0) {
      const gr = g.createRadialGradient(fx * w, h * 0.15, 0, fx * w, h * 0.15, w * 0.9);
      gr.addColorStop(0, `rgba(200,225,255,${0.55 * flash})`);
      gr.addColorStop(1, `rgba(120,160,200,${0.12 * flash})`);
      g.fillStyle = gr;
      g.fillRect(0, 0, w, this.horizon);
    }

    // clouds
    for (const c of this.clouds) {
      c.x -= c.s * dt * 10;
      if (c.x < -c.r) c.x = w + c.r;
      const gr = g.createRadialGradient(c.x, c.y - c.r * 0.2, 0, c.x, c.y, c.r);
      const lit = flash * 0.55;
      const base = 48 + c.light * 34;
      gr.addColorStop(0, `rgba(${base + lit * 160},${base + 14 + lit * 170},${base + 22 + lit * 190},${c.shade})`);
      gr.addColorStop(0.55, `rgba(${base - 8},${base + 4},${base + 10},${c.shade * 0.6})`);
      gr.addColorStop(1, 'rgba(20,34,42,0)');
      g.fillStyle = gr;
      g.fillRect(c.x - c.r, c.y - c.r, c.r * 2, c.r * 2);
    }

    // the bolt itself
    for (const f of this.flashes) {
      if (!f.bolt || t - f.t0 > f.life || t < f.t0) continue;
      g.strokeStyle = `rgba(235,245,255,${0.9 * f.k})`;
      g.lineWidth = 2.2 * this.dpr;
      g.shadowColor = 'rgba(180,210,255,0.9)';
      g.shadowBlur = 18 * this.dpr;
      g.beginPath();
      f.bolt.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.stroke();
      g.shadowBlur = 0;
    }

    // sea: rows of swell, darker and larger toward us
    const rows = 14;
    for (let i = 0; i < rows; i++) {
      const p = i / (rows - 1);
      const y0 = lerp(this.horizon, h * 1.02, p * p);
      const amp = lerp(0.3, 7.5, p * p) * u * (0.6 + storm * 0.6);
      const len = lerp(0.03, 0.006, p);
      const speed = lerp(0.3, 1.2, p) * (0.6 + storm);
      const base = ramp([[0, '#2a4b55'], [0.5, '#163039'], [1, '#0a1a20']], p);
      g.fillStyle = flash > 0 ? mix('#0a1a20', '#5d7f8c', clamp(flash * (1 - p) * 0.8, 0, 1)) : base;
      if (flash <= 0) g.fillStyle = base;
      g.beginPath();
      g.moveTo(0, h);
      for (let x = 0; x <= w + 10; x += 10) {
        const y = y0 + Math.sin(x * len + t * speed + i * 1.7) * amp + Math.sin(x * len * 2.3 - t * speed * 0.7 + i) * amp * 0.45;
        g.lineTo(x, y);
      }
      g.lineTo(w, h);
      g.closePath();
      g.fill();
      // whitecaps on the crests
      if (i > 3 && Math.random() < 0.08 * storm) this.caps.push({ x: rand(0, w), y: y0 - amp, life: rand(0.6, 1.6), age: 0, wdt: rand(0.02, 0.07) * w * p });
      if (i === 9) this.drawBuoy(y0, amp, len, speed, i);
    }
    this.caps = this.caps.filter((c) => (c.age += dt) < c.life);
    for (const c of this.caps) {
      const k = 1 - c.age / c.life;
      g.strokeStyle = `rgba(225,240,240,${0.35 * k})`;
      g.lineWidth = 1.4 * this.dpr;
      g.beginPath();
      g.moveTo(c.x - c.wdt / 2, c.y);
      g.quadraticCurveTo(c.x, c.y - 3 * this.dpr, c.x + c.wdt / 2, c.y);
      g.stroke();
    }

    // rain, slanted by the wind
    const slant = 0.28 + storm * 0.25;
    const count = Math.round(this.drops.length * clamp(0.35 + storm * 0.75, 0, 1));
    g.strokeStyle = 'rgba(200,220,230,0.25)';
    g.lineWidth = 1 * this.dpr;
    g.beginPath();
    for (let i = 0; i < count; i++) {
      const d = this.drops[i];
      const vy = d.v * h * 1.25 * dt;
      d.y += vy;
      d.x += vy * slant;
      if (d.y > h || d.x > w * 1.2) Object.assign(d, this.drop(false));
      const L = d.l * 2.4 * u;
      g.moveTo(d.x, d.y);
      g.lineTo(d.x - L * slant, d.y - L);
    }
    g.stroke();
  }
  drawBuoy(y0, amp, len, speed, i) {
    const { g, t, u, w } = this;
    const x = w * 0.72;
    const y = y0 + Math.sin(x * len + t * speed + i * 1.7) * amp + Math.sin(x * len * 2.3 - t * speed * 0.7 + i) * amp * 0.45;
    const tilt = Math.cos(x * len + t * speed + i * 1.7) * 0.25;
    g.save();
    g.translate(x, y - u * 0.4);
    g.rotate(tilt);
    g.scale(1.6, 1.6);
    g.fillStyle = '#A3332A';
    g.beginPath();
    g.moveTo(-u * 1.4, 0);
    g.lineTo(u * 1.4, 0);
    g.lineTo(u * 0.7, -u * 3.4);
    g.lineTo(-u * 0.7, -u * 3.4);
    g.closePath();
    g.fill();
    g.fillStyle = '#E4572E';
    g.fillRect(-u * 0.9, -u * 2.2, u * 1.8, u * 0.7);
    g.fillStyle = '#0a1a20';
    g.fillRect(-u * 1.6, -u * 0.2, u * 3.2, u * 0.9);
    const blink = (t % 4) < 0.35;
    if (blink) {
      const gr = g.createRadialGradient(0, -u * 4, 0, 0, -u * 4, u * 4);
      gr.addColorStop(0, 'rgba(255,120,90,0.95)');
      gr.addColorStop(1, 'rgba(255,90,60,0)');
      g.fillStyle = gr;
      g.fillRect(-u * 4, -u * 8, u * 8, u * 8);
    }
    g.restore();
  }
}

// ---------------------------------------------------------------------------------------------
// A waterfall in a green, misty forest.
class Waterfall extends Painting {
  build() {
    const { w, h, u } = this;
    this.bg = layer(w, h);
    const g = this.bg.getContext('2d');
    let seed = 7;
    const r = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    g.fillStyle = vgrad(g, 0, h, [
      [0, '#cfe3dc'],
      [0.3, '#8fbfb0'],
      [0.6, '#3f7563'],
      [1, '#16352b'],
    ]);
    g.fillRect(0, 0, w, h);
    treeline(g, w, h * 0.3, h * 0.1, 'rgba(90,140,125,0.5)', 'pine', 3);
    treeline(g, w, h * 0.35, h * 0.13, 'rgba(55,105,88,0.7)', 'round', 7);
    this.fx = w * 0.5;
    this.fw = Math.max(w * 0.16, 14 * u);
    this.top = h * 0.32;
    this.base = h * 0.7;
    // a jagged rock wall with the river pouring over its lip
    const rock = (x0, x1, y0, y1, c0, c1, jag) => {
      g.fillStyle = vgrad(g, y0, y1, [
        [0, c0],
        [1, c1],
      ]);
      g.beginPath();
      g.moveTo(x0, y1);
      const steps = 14;
      for (let i = 0; i <= steps; i++) {
        const x = lerp(x0, x1, i / steps);
        g.lineTo(x, y0 + (r() - 0.5) * jag);
      }
      g.lineTo(x1, y1);
      g.closePath();
      g.fill();
    };
    rock(-w * 0.05, w * 1.05, this.top - h * 0.015, this.base + h * 0.06, '#4b5a55', '#26302d', h * 0.02);
    // strata: darker ledges across the face
    g.strokeStyle = 'rgba(20,28,26,0.45)';
    g.lineWidth = 0.5 * u;
    for (let i = 0; i < 9; i++) {
      const y = lerp(this.top + h * 0.02, this.base, i / 9) + r() * h * 0.01;
      g.beginPath();
      g.moveTo(0, y);
      for (let x = 0; x <= w; x += w / 12) g.lineTo(x, y + (r() - 0.5) * h * 0.012);
      g.stroke();
    }
    // nearer buttresses either side, darker
    const side = (dir) => {
      const xEdge = dir < 0 ? 0 : w;
      const xIn = this.fx + dir * this.fw * 0.62;
      g.fillStyle = vgrad(g, this.top, h, [
        [0, '#34413d'],
        [1, '#1a2321'],
      ]);
      g.beginPath();
      g.moveTo(xEdge, this.top - h * 0.04);
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        g.lineTo(lerp(xEdge, xIn, t) + (r() - 0.5) * u * 2, this.top - h * 0.03 + t * h * 0.02 + (r() - 0.5) * h * 0.02);
      }
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        g.lineTo(xIn + dir * t * w * 0.06 + (r() - 0.5) * u * 1.5, lerp(this.top, this.base + h * 0.05, t));
      }
      g.lineTo(xEdge, h * 0.86);
      g.closePath();
      g.fill();
    };
    side(-1);
    side(1);
    // foliage clinging to the rock
    const greens = ['#1f4a36', '#2c5e42', '#24533b', '#183d2c'];
    for (let i = 0; i < 70; i++) {
      const dir = i % 2 ? 1 : -1;
      const x = this.fx + dir * (this.fw * 0.65 + r() * w * 0.45);
      const y = lerp(this.top - h * 0.05, this.base + h * 0.02, Math.pow(r(), 1.6));
      g.fillStyle = greens[i % greens.length];
      g.beginPath();
      g.ellipse(x, y, (1.5 + r() * 4) * u, (1 + r() * 2.5) * u, r() * 0.6, 0, TAU);
      g.fill();
    }
    // the canopy overhead, framing the clearing
    g.fillStyle = '#0f2a20';
    for (let i = 0; i < 60; i++) {
      const x = r() * w;
      const y = -h * 0.02 + Math.pow(r(), 2.2) * h * 0.14 * (0.4 + Math.abs(x / w - 0.5) * 1.6);
      g.beginPath();
      g.ellipse(x, y, (3 + r() * 6) * u, (2 + r() * 4) * u, r() * TAU, 0, TAU);
      g.fill();
    }
    // pool
    g.fillStyle = vgrad(g, this.base, h, [
      [0, '#4f9a9a'],
      [1, '#16353b'],
    ]);
    g.beginPath();
    g.ellipse(this.fx, this.base + h * 0.08, w * 0.6, h * 0.12, 0, 0, TAU);
    g.fill();
    // foreground ferns get drawn live (they sway)
    this.ferns = Array.from({ length: 9 }, (_, i) => ({
      x: (i / 8) * w + rand(-0.05, 0.05) * w,
      y: h * rand(0.92, 1.02),
      len: rand(12, 26) * u,
      ph: rand(0, TAU),
      side: i % 2 ? 1 : -1,
    }));
    this.streaks = Array.from({ length: 90 }, () => this.streak(true));
    this.mist = Array.from({ length: 26 }, () => this.puff(true));
    this.glints = Array.from({ length: 40 }, () => ({ x: rand(0.1, 0.9) * w, y: rand(this.base + h * 0.02, h * 0.95), ph: rand(0, TAU) }));
  }
  streak(anywhere) {
    return {
      x: this.fx + rand(-0.5, 0.5) * this.fw,
      y: anywhere ? rand(this.top, this.base) : this.top - rand(0, 20),
      v: rand(0.8, 1.3),
      l: rand(3, 9) * this.u,
      a: rand(0.25, 0.7),
    };
  }
  puff(anywhere) {
    return {
      x: this.fx + rand(-1, 1) * this.fw * 1.2,
      y: this.base + rand(-0.04, 0.06) * this.h - (anywhere ? rand(0, 0.25) * this.h : 0),
      r: rand(6, 16) * this.u,
      vx: rand(-0.6, 0.6) * this.u,
      vy: -rand(0.6, 1.8) * this.u,
      a: rand(0.05, 0.14),
      age: anywhere ? rand(0, 8) : 0,
      life: rand(7, 14),
    };
  }
  frame(dt) {
    const { g, w, h, t, u } = this;
    g.drawImage(this.bg, 0, 0);
    // falling water
    const body = g.createLinearGradient(this.fx - this.fw / 2, 0, this.fx + this.fw / 2, 0);
    body.addColorStop(0, 'rgba(220,240,240,0.15)');
    body.addColorStop(0.5, 'rgba(240,250,250,0.55)');
    body.addColorStop(1, 'rgba(220,240,240,0.15)');
    g.fillStyle = body;
    g.fillRect(this.fx - this.fw / 2, this.top, this.fw, this.base - this.top);
    g.lineCap = 'round';
    for (const s of this.streaks) {
      s.y += s.v * (this.base - this.top) * 0.9 * dt;
      if (s.y > this.base) Object.assign(s, this.streak(false));
      g.strokeStyle = `rgba(255,255,255,${s.a})`;
      g.lineWidth = rand(0.6, 1.6) * this.dpr;
      g.beginPath();
      g.moveTo(s.x, s.y);
      g.lineTo(s.x, s.y - s.l);
      g.stroke();
    }
    // foam at the foot
    for (let i = 0; i < 6; i++) {
      const r = (this.fw * 0.7 + Math.sin(t * 3 + i) * u) * (1 + i * 0.15);
      g.fillStyle = `rgba(245,252,252,${0.12 - i * 0.015})`;
      g.beginPath();
      g.ellipse(this.fx, this.base + u * 0.5, r, r * 0.22, 0, 0, TAU);
      g.fill();
    }
    // glints on the pool
    for (const s of this.glints) {
      const k = 0.5 + 0.5 * Math.sin(t * 2.2 + s.ph);
      g.fillStyle = `rgba(230,250,250,${0.35 * k * k})`;
      g.fillRect(s.x + Math.sin(t + s.ph) * u, s.y, 1.6 * u, 0.25 * u);
    }
    // rising mist
    for (const m of this.mist) {
      m.age += dt;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (m.age > m.life) Object.assign(m, this.puff(false));
      const k = Math.sin((m.age / m.life) * Math.PI);
      const gr = g.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * (1 + m.age / m.life));
      gr.addColorStop(0, `rgba(240,250,250,${m.a * k})`);
      gr.addColorStop(1, 'rgba(240,250,250,0)');
      g.fillStyle = gr;
      g.fillRect(m.x - m.r * 2, m.y - m.r * 2, m.r * 4, m.r * 4);
    }
    // sun shafts
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const k = 0.04 + 0.025 * Math.sin(t * 0.3 + i * 2);
      g.fillStyle = `rgba(255,246,229,${k})`;
      g.beginPath();
      const x0 = w * (0.15 + i * 0.22);
      g.moveTo(x0, 0);
      g.lineTo(x0 + w * 0.08, 0);
      g.lineTo(x0 + w * 0.35, h);
      g.lineTo(x0 + w * 0.2, h);
      g.closePath();
      g.fill();
    }
    g.restore();
    // ferns in front, swaying
    for (const f of this.ferns) {
      const sway = Math.sin(t * 0.9 + f.ph) * 0.12;
      g.save();
      g.translate(f.x, f.y);
      g.rotate(-Math.PI / 2 + f.side * 0.5 + sway);
      g.strokeStyle = '#0f2a22';
      g.fillStyle = '#123227';
      g.lineWidth = 0.5 * u;
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(f.len * 0.5, f.side * f.len * 0.12, f.len, f.side * f.len * 0.3);
      g.stroke();
      for (let k = 1; k < 10; k++) {
        const p = k / 10;
        const x = f.len * p;
        const y = f.side * f.len * 0.3 * p * p;
        const l = (1 - p) * f.len * 0.28;
        g.beginPath();
        g.ellipse(x, y - l * 0.5, l * 0.18, l * 0.55, 0.4, 0, TAU);
        g.ellipse(x, y + l * 0.5, l * 0.18, l * 0.55, -0.4, 0, TAU);
        g.fill();
      }
      g.restore();
    }
  }
}

// ---------------------------------------------------------------------------------------------
// A garden at sunrise. The sky follows the dawn; birds appear where you hear them.
class Garden extends Painting {
  build() {
    const { w, h, u } = this;
    this.horizon = h * 0.66;
    this.fg = layer(w, h);
    const g = this.fg.getContext('2d');
    hills(g, w, h * 0.64, h * 0.05, '#4b6b5c', 2, 1.3);
    treeline(g, w, h * 0.66, h * 0.1, '#2f5545', 'round', 11);
    // hedge and fence
    g.fillStyle = '#244636';
    g.fillRect(0, h * 0.7, w, h * 0.3);
    g.fillStyle = '#5a3d27';
    this.fenceY = h * 0.69;
    for (let x = 0; x < w; x += 7 * u) g.fillRect(x, this.fenceY - 4 * u, 1.2 * u, 5 * u);
    g.fillRect(0, this.fenceY - 3 * u, w, 0.7 * u);
    g.fillRect(0, this.fenceY - 1 * u, w, 0.7 * u);
    // lawn
    g.fillStyle = vgrad(g, h * 0.72, h, [
      [0, '#3c6b4a'],
      [1, '#1d3a29'],
    ]);
    g.beginPath();
    g.moveTo(0, h * 0.74);
    g.quadraticCurveTo(w * 0.5, h * 0.7, w, h * 0.75);
    g.lineTo(w, h);
    g.lineTo(0, h);
    g.fill();
    // a branch reaching in from the left, for birds to perch on
    g.strokeStyle = '#2b2018';
    g.lineCap = 'round';
    g.lineWidth = 1.6 * u;
    g.beginPath();
    g.moveTo(-u, h * 0.22);
    g.quadraticCurveTo(w * 0.2, h * 0.27, w * 0.38, h * 0.24);
    g.stroke();
    g.lineWidth = 0.8 * u;
    g.beginPath();
    g.moveTo(w * 0.18, h * 0.255);
    g.quadraticCurveTo(w * 0.24, h * 0.2, w * 0.3, h * 0.19);
    g.stroke();
    g.fillStyle = 'rgba(33,58,40,0.95)';
    for (let i = 0; i < 26; i++) {
      g.beginPath();
      g.ellipse(rand(0, w * 0.36), rand(h * 0.17, h * 0.28), rand(1.4, 2.8) * u, rand(0.7, 1.3) * u, rand(0, TAU), 0, TAU);
      g.fill();
    }
    this.perches = [
      ...Array.from({ length: 6 }, (_, i) => ({ x: (0.08 + i * 0.16) * w, y: this.fenceY - 4 * u })),
      { x: w * 0.12, y: h * 0.235 },
      { x: w * 0.27, y: h * 0.245 },
      { x: w * 0.34, y: h * 0.24 },
    ];
    // the same garden before sunrise: shapes without colour
    this.fgDark = layer(w, h);
    const k = this.fgDark.getContext('2d');
    k.drawImage(this.fg, 0, 0);
    k.globalCompositeOperation = 'source-atop';
    k.fillStyle = 'rgba(12,18,40,0.72)';
    k.fillRect(0, 0, w, h);
    this.flowers = Array.from({ length: 22 }, () => ({
      x: rand(0, w),
      y: rand(h * 0.8, h * 1.0),
      s: rand(0.8, 1.8) * u,
      ph: rand(0, TAU),
      c: ['#FFC53D', '#F4A3B4', '#FFF6E5', '#E4572E', '#B89BE8'][Math.floor(rand(0, 5))],
    }));
    this.motes = Array.from({ length: 40 }, () => ({ x: rand(0, w), y: rand(h * 0.3, h * 0.9), ph: rand(0, TAU), s: rand(0.2, 0.5) * u }));
    this.stars = Array.from({ length: 60 }, () => ({ x: rand(0, w), y: rand(0, h * 0.5), s: rand(0.15, 0.4) * u, ph: rand(0, TAU) }));
    this.birds = [];
  }
  event(e) {
    if (e.type !== 'bird') return;
    this.at(e.at, () => {
      // nearest perch to where the bird is heard (left/right), within the visible half
      const side = clamp(Math.sin((e.az * Math.PI) / 180), -1, 1);
      const x = (0.5 + side * 0.45) * this.w;
      let best = this.perches[0];
      for (const p of this.perches) if (Math.abs(p.x - x) < Math.abs(best.x - x)) best = p;
      const existing = this.birds.find((b) => b.p === best);
      if (existing) {
        existing.sing = this.t;
        existing.until = this.t + e.dur;
        existing.gone = this.t + e.dur + rand(6, 14);
      } else {
        this.birds.push({ p: best, sing: this.t, until: this.t + e.dur, gone: this.t + e.dur + rand(6, 14), size: clamp(18 / (e.dist || 18), 0.6, 1.3), flip: Math.random() < 0.5 });
      }
    });
  }
  frame(dt) {
    const { g, w, h, t, u } = this;
    const d = this.drivers.dawn ?? 0.6;
    g.fillStyle = vgrad(g, 0, this.horizon, [
      [0, ramp([[0, '#0e1a33'], [0.35, '#2b3f6b'], [0.6, '#6f8fbf'], [1, '#a9d4ea']], d)],
      [0.55, ramp([[0, '#24345a'], [0.35, '#8c6d8f'], [0.6, '#f0b8a2'], [1, '#d7ecf0']], d)],
      [1, ramp([[0, '#3a3f63'], [0.35, '#e79a7e'], [0.6, '#ffd9a0'], [1, '#fff3d6']], d)],
    ]);
    g.fillRect(0, 0, w, this.horizon + 2);
    // stars fade as the light comes
    if (d < 0.45) {
      for (const s of this.stars) {
        const k = (1 - d / 0.45) * (0.6 + 0.4 * Math.sin(t * 1.3 + s.ph));
        g.fillStyle = `rgba(255,246,229,${0.7 * k})`;
        g.fillRect(s.x, s.y, s.s, s.s);
      }
    }
    // the sun climbs
    const sx = w * 0.68;
    const sy = this.horizon + h * 0.1 - d * h * 0.42;
    const glow = g.createRadialGradient(sx, sy, 0, sx, sy, h * 0.6);
    glow.addColorStop(0, `rgba(255,214,140,${0.55 * clamp(d * 1.6, 0, 1)})`);
    glow.addColorStop(1, 'rgba(255,214,140,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, w, this.horizon);
    g.fillStyle = ramp([[0, '#ff9a6a'], [0.6, '#ffd27a'], [1, '#fff3d6']], d);
    g.beginPath();
    g.arc(sx, sy, 6 * u, 0, TAU);
    g.fill();
    const dark = clamp(1 - d * 1.6, 0, 1);
    g.drawImage(this.fg, 0, 0);
    if (dark > 0.01) {
      g.globalAlpha = dark;
      g.drawImage(this.fgDark, 0, 0);
      g.globalAlpha = 1;
    }
    // a warm wash over the garden as the sun gets up
    g.fillStyle = `rgba(255,200,140,${0.12 * d})`;
    g.fillRect(0, this.horizon, w, h - this.horizon);
    // flowers
    for (const f of this.flowers) {
      const sway = Math.sin(t * 0.8 + f.ph) * f.s * 0.6;
      g.strokeStyle = '#1f3d29';
      g.lineWidth = 0.3 * u;
      g.beginPath();
      g.moveTo(f.x, h);
      g.quadraticCurveTo(f.x, f.y + (h - f.y) * 0.5, f.x + sway, f.y);
      g.stroke();
      g.fillStyle = dark > 0.01 ? mix(f.c, '#141a2e', dark * 0.75) : f.c;
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * TAU + t * 0.05;
        g.beginPath();
        g.ellipse(f.x + sway + Math.cos(a) * f.s, f.y + Math.sin(a) * f.s, f.s * 0.8, f.s * 0.5, a, 0, TAU);
        g.fill();
      }
      g.fillStyle = '#5a3d27';
      g.beginPath();
      g.arc(f.x + sway, f.y, f.s * 0.5, 0, TAU);
      g.fill();
    }
    // pollen in the sunlight
    for (const m of this.motes) {
      m.x += Math.sin(t * 0.3 + m.ph) * 0.2 * u * dt * 10;
      m.y += Math.cos(t * 0.2 + m.ph) * 0.1 * u * dt * 10;
      g.fillStyle = `rgba(255,236,190,${0.5 * d * (0.5 + 0.5 * Math.sin(t + m.ph))})`;
      g.fillRect(m.x, m.y, m.s, m.s);
    }
    // birds
    this.birds = this.birds.filter((b) => t < b.gone);
    for (const b of this.birds) {
      const singing = t < b.until;
      const hop = singing ? Math.abs(Math.sin(t * 9)) * 0.4 * u : 0;
      this.drawBird(b.p.x, b.p.y - hop, 2.2 * u * b.size, b.flip, singing, clamp((b.gone - t) / 1.5, 0, 1) * clamp((t - b.sing + 0.6) / 0.6, 0, 1));
    }
  }
  drawBird(x, y, s, flip, singing, alpha) {
    const { g } = this;
    g.save();
    g.globalAlpha = alpha;
    g.translate(x, y);
    if (flip) g.scale(-1, 1);
    g.fillStyle = '#1b2421';
    g.beginPath();
    g.ellipse(0, -s * 0.9, s * 1.1, s * 0.8, -0.2, 0, TAU); // body
    g.fill();
    g.beginPath();
    g.arc(s * 0.85, -s * 1.6, s * 0.55, 0, TAU); // head
    g.fill();
    g.beginPath(); // tail
    g.moveTo(-s * 0.9, -s * 0.8);
    g.lineTo(-s * 2.1, -s * 0.2);
    g.lineTo(-s * 1.9, -s * 0.55);
    g.closePath();
    g.fill();
    g.fillStyle = '#E4A23D';
    g.beginPath(); // beak, open when singing
    g.moveTo(s * 1.3, -s * 1.7);
    g.lineTo(s * 1.95, singing ? -s * 1.85 : -s * 1.6);
    g.lineTo(s * 1.3, -s * 1.5);
    g.closePath();
    g.fill();
    g.restore();
  }
}

// ---------------------------------------------------------------------------------------------
// The house on the hill. Someone carries a candle from window to window.
class Mansion extends Painting {
  build() {
    const { w, h, u } = this;
    this.bg = layer(w, h);
    const g = this.bg.getContext('2d');
    g.fillStyle = vgrad(g, 0, h, [
      [0, '#07060f'],
      [0.55, '#1a1430'],
      [0.8, '#2a2140'],
      [1, '#0b0912'],
    ]);
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 120; i++) {
      g.fillStyle = `rgba(255,246,229,${rand(0.15, 0.6)})`;
      const s = rand(0.1, 0.3) * u;
      g.fillRect(rand(0, w), rand(0, h * 0.55), s, s);
    }
    this.moon = { x: w * 0.74, y: h * 0.2, r: Math.max(7 * u, 26) };
    this.fg = layer(w, h);
    const f = this.fg.getContext('2d');
    const ink = '#05040a';
    // hill
    f.fillStyle = ink;
    f.beginPath();
    f.moveTo(0, h * 0.8);
    f.quadraticCurveTo(w * 0.45, h * 0.66, w, h * 0.78);
    f.lineTo(w, h);
    f.lineTo(0, h);
    f.fill();
    // the house: a main block, a tower, gables and chimneys
    const cx = w * 0.42;
    const base = h * 0.71;
    const S = Math.min(w * 0.55, h * 0.5);
    const X = (k) => cx + k * S;
    const Y = (k) => base - k * S;
    f.beginPath();
    f.moveTo(X(-0.5), Y(0));
    f.lineTo(X(-0.5), Y(0.34));
    f.lineTo(X(-0.36), Y(0.52)); // left gable
    f.lineTo(X(-0.22), Y(0.34));
    f.lineTo(X(-0.1), Y(0.36));
    f.lineTo(X(-0.1), Y(0.58)); // tower
    f.lineTo(X(-0.02), Y(0.8));
    f.lineTo(X(0.06), Y(0.58));
    f.lineTo(X(0.06), Y(0.4));
    f.lineTo(X(0.22), Y(0.4));
    f.lineTo(X(0.34), Y(0.55)); // right gable
    f.lineTo(X(0.46), Y(0.4));
    f.lineTo(X(0.46), Y(0));
    f.closePath();
    f.fill();
    f.fillRect(X(-0.3), Y(0.6), S * 0.035, S * 0.16); // chimneys
    f.fillRect(X(0.3), Y(0.62), S * 0.035, S * 0.12);
    f.fillRect(X(-0.0275), Y(0.88), S * 0.005, S * 0.08); // spire
    // a dead tree
    f.strokeStyle = ink;
    f.lineCap = 'round';
    const branch = (x, y, len, ang, wdt, depth) => {
      if (depth === 0 || len < 2) return;
      const x2 = x + Math.cos(ang) * len;
      const y2 = y + Math.sin(ang) * len;
      f.lineWidth = wdt;
      f.beginPath();
      f.moveTo(x, y);
      f.lineTo(x2, y2);
      f.stroke();
      branch(x2, y2, len * rand(0.6, 0.78), ang - rand(0.25, 0.6), wdt * 0.68, depth - 1);
      branch(x2, y2, len * rand(0.6, 0.78), ang + rand(0.2, 0.55), wdt * 0.68, depth - 1);
    };
    branch(w * 0.86, h * 0.79, h * 0.12, -Math.PI / 2 - 0.15, 2.4 * u, 7);
    // fence along the hill
    f.lineWidth = 0.35 * u;
    for (let x = w * 0.05; x < w * 0.95; x += 3.2 * u) {
      const y = h * 0.8 - (Math.sin((x / w) * Math.PI) * h * 0.1) + h * 0.04;
      f.beginPath();
      f.moveTo(x, y);
      f.lineTo(x, y - 2.6 * u);
      f.stroke();
    }
    // windows (lit at runtime)
    this.windows = [
      { x: X(-0.4), y: Y(0.25), w: S * 0.05, h: S * 0.08 },
      { x: X(-0.28), y: Y(0.25), w: S * 0.05, h: S * 0.08 },
      { x: X(-0.06), y: Y(0.5), w: S * 0.04, h: S * 0.07 },
      { x: X(0.12), y: Y(0.27), w: S * 0.05, h: S * 0.08 },
      { x: X(0.3), y: Y(0.27), w: S * 0.05, h: S * 0.08 },
      { x: X(-0.4), y: Y(0.09), w: S * 0.05, h: S * 0.09 },
      { x: X(0.3), y: Y(0.09), w: S * 0.05, h: S * 0.09 },
    ];
    this.windows.forEach((win) => (win.k = 0));
    this.windows[5].k = 1; // the parlour fire
    this.candle = 3;
    this.clouds = Array.from({ length: 5 }, () => ({ x: rand(0, 1.3) * w, y: rand(0.08, 0.35) * h, r: rand(0.15, 0.3) * w, v: rand(0.4, 1) * u }));
    this.fog = Array.from({ length: 7 }, (_, i) => ({ x: rand(0, w), y: h * (0.78 + i * 0.03), r: rand(0.3, 0.6) * w, v: rand(0.5, 1.5) * u }));
    this.bats = [];
  }
  event(e) {
    if (e.type === 'lightning') this.at(e.at, () => this.flashes.push({ t0: this.t, k: e.strength * 0.7 }));
    if (e.type === 'shot' && e.layer === 'steps') {
      // the candle moves to another upstairs window
      this.at(e.at, () => {
        const upstairs = [0, 1, 2, 3, 4];
        let n = this.candle;
        while (n === this.candle) n = upstairs[Math.floor(Math.random() * upstairs.length)];
        this.candle = n;
      });
    }
    if (e.type === 'shot' && e.layer === 'outside' && Math.random() < 0.3) this.at(e.at, () => this.bats.push({ x: -10, y: rand(0.15, 0.45) * this.h, v: rand(8, 14) * this.u, ph: rand(0, TAU) }));
  }
  frame(dt) {
    const { g, w, h, t, u } = this;
    g.drawImage(this.bg, 0, 0);
    // moon behind passing cloud
    const m = this.moon;
    const halo = g.createRadialGradient(m.x, m.y, m.r * 0.8, m.x, m.y, m.r * 5);
    halo.addColorStop(0, 'rgba(230,225,255,0.25)');
    halo.addColorStop(1, 'rgba(230,225,255,0)');
    g.fillStyle = halo;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ece8f4';
    g.beginPath();
    g.arc(m.x, m.y, m.r, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(180,175,200,0.35)';
    g.beginPath();
    g.arc(m.x - m.r * 0.3, m.y - m.r * 0.2, m.r * 0.22, 0, TAU);
    g.arc(m.x + m.r * 0.25, m.y + m.r * 0.3, m.r * 0.15, 0, TAU);
    g.fill();
    for (const c of this.clouds) {
      c.x -= c.v * dt;
      if (c.x < -c.r) c.x = w + c.r;
      const gr = g.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
      gr.addColorStop(0, 'rgba(40,32,60,0.75)');
      gr.addColorStop(1, 'rgba(40,32,60,0)');
      g.fillStyle = gr;
      g.fillRect(c.x - c.r, c.y - c.r, c.r * 2, c.r * 2);
    }
    // lightning
    this.flashes = this.flashes.filter((f) => t - f.t0 < 0.5);
    for (const f of this.flashes) {
      const age = t - f.t0;
      const k = f.k * (age < 0.08 || (age > 0.16 && age < 0.22) ? 1 : Math.max(0, 1 - age / 0.5) * 0.4);
      g.fillStyle = `rgba(200,195,255,${0.45 * k})`;
      g.fillRect(0, 0, w, h);
    }
    g.drawImage(this.fg, 0, 0);
    // windows: candle flicker, and the fire downstairs
    this.windows.forEach((win, i) => {
      const target = i === this.candle || i === 5 ? 1 : 0;
      win.k += (target - win.k) * Math.min(1, dt * (target ? 0.6 : 1.2));
      if (win.k < 0.02) return;
      const flick = 0.75 + 0.25 * Math.sin(t * 13 + i) * Math.sin(t * 7.3 + i * 2) + rand(-0.06, 0.06);
      const k = win.k * flick;
      const gr = g.createRadialGradient(win.x + win.w / 2, win.y + win.h / 2, 0, win.x + win.w / 2, win.y + win.h / 2, win.w * 2.4);
      gr.addColorStop(0, `rgba(255,190,90,${0.5 * k})`);
      gr.addColorStop(1, 'rgba(255,150,60,0)');
      g.fillStyle = gr;
      g.fillRect(win.x - win.w * 2, win.y - win.h * 2, win.w * 5, win.h * 5);
      g.fillStyle = `rgba(255,${200 + 30 * k},${110 + 40 * k},${0.85 * k})`;
      g.fillRect(win.x, win.y, win.w, win.h);
      g.fillStyle = '#05040a';
      g.fillRect(win.x + win.w * 0.45, win.y, win.w * 0.1, win.h);
      g.fillRect(win.x, win.y + win.h * 0.45, win.w, win.h * 0.1);
    });
    // bats
    this.bats = this.bats.filter((b) => b.x < w + 20);
    for (const b of this.bats) {
      b.x += b.v * dt;
      const flap = Math.sin(t * 22 + b.ph);
      const y = b.y + Math.sin(t * 3 + b.ph) * 2 * u;
      g.strokeStyle = '#05040a';
      g.lineWidth = 0.5 * u;
      g.beginPath();
      g.moveTo(b.x - 1.6 * u, y - flap * u);
      g.quadraticCurveTo(b.x - 0.6 * u, y - 0.2 * u, b.x, y);
      g.quadraticCurveTo(b.x + 0.6 * u, y - 0.2 * u, b.x + 1.6 * u, y - flap * u);
      g.stroke();
    }
    // ground fog
    for (const f of this.fog) {
      f.x += f.v * dt;
      if (f.x > w + f.r) f.x = -f.r;
      const gr = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
      gr.addColorStop(0, 'rgba(120,110,150,0.16)');
      gr.addColorStop(1, 'rgba(120,110,150,0)');
      g.fillStyle = gr;
      g.fillRect(f.x - f.r, f.y - f.r * 0.4, f.r * 2, f.r * 0.8);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Snow falling on the pines at dusk; a cabin window glows if the fire is lit.
class Snow extends Painting {
  build() {
    const { w, h, u } = this;
    this.bg = layer(w, h);
    const g = this.bg.getContext('2d');
    g.fillStyle = vgrad(g, 0, h * 0.62, [
      [0, '#0F2A40'],
      [0.5, '#2E5A7A'],
      [1, '#9DB9CF'],
    ]);
    g.fillRect(0, 0, w, h);
    hills(g, w, h * 0.5, h * 0.12, '#6E8FAA', 2, 0.4);
    hills(g, w, h * 0.55, h * 0.07, '#557994', 3, 2.1);
    treeline(g, w, h * 0.58, h * 0.11, '#3d6380', 'pine', 21);
    // frozen lake
    g.fillStyle = vgrad(g, h * 0.6, h * 0.7, [
      [0, '#a9c2d6'],
      [1, '#7f9db6'],
    ]);
    g.beginPath();
    g.ellipse(w * 0.4, h * 0.645, w * 0.5, h * 0.04, 0, 0, TAU);
    g.fill();
    treeline(g, w, h * 0.7, h * 0.18, '#1d3a52', 'pine', 5);
    // snowfield
    g.fillStyle = vgrad(g, h * 0.7, h, [
      [0, '#dbe7f0'],
      [1, '#aac0d3'],
    ]);
    g.beginPath();
    g.moveTo(0, h * 0.74);
    g.quadraticCurveTo(w * 0.3, h * 0.69, w * 0.6, h * 0.73);
    g.quadraticCurveTo(w * 0.85, h * 0.76, w, h * 0.72);
    g.lineTo(w, h);
    g.lineTo(0, h);
    g.fill();
    // cabin
    const cx = w * 0.74;
    const cy = h * 0.735;
    const s = Math.max(8 * u, 30);
    this.cabin = { x: cx, y: cy, s };
    g.fillStyle = '#3a2a22';
    g.fillRect(cx - s, cy - s * 0.9, s * 2, s * 0.9);
    g.fillStyle = '#e8f0f6';
    g.beginPath();
    g.moveTo(cx - s * 1.25, cy - s * 0.85);
    g.lineTo(cx, cy - s * 1.75);
    g.lineTo(cx + s * 1.25, cy - s * 0.85);
    g.closePath();
    g.fill();
    g.fillStyle = '#2c201a';
    g.fillRect(cx + s * 0.45, cy - s * 1.65, s * 0.25, s * 0.5);
    this.win = { x: cx - s * 0.55, y: cy - s * 0.65, w: s * 0.45, h: s * 0.38 };
    this.near = [{ x: -0.06 * w, s: 0.78 }, { x: 1.07 * w, s: 0.84 }];
    const n = Math.min(700, Math.round((w * h) / (5000 * this.dpr)));
    this.flakes = Array.from({ length: n }, () => this.flake(true));
    this.smoke = [];
    this.gust = 0;
    this.gustTarget = 0;
  }
  flake(anywhere) {
    const z = Math.random();
    return { x: rand(-0.1, 1.1) * this.w, y: anywhere ? rand(0, this.h) : -5, z, r: lerp(0.15, 0.7, z * z) * this.u, v: lerp(0.03, 0.12, z), ph: rand(0, TAU) };
  }
  frame(dt) {
    const { g, w, h, t, u } = this;
    g.drawImage(this.bg, 0, 0);
    const fire = this.engine.scene?.layers?.get('fire')?.level ?? 0;
    // cabin window and chimney smoke
    if (fire > 0.01) {
      const k = clamp(fire * 1.4, 0, 1) * (0.85 + 0.15 * Math.sin(t * 9) * Math.sin(t * 5.3));
      const win = this.win;
      const gr = g.createRadialGradient(win.x + win.w / 2, win.y + win.h / 2, 0, win.x + win.w / 2, win.y + win.h / 2, win.w * 3);
      gr.addColorStop(0, `rgba(255,190,100,${0.5 * k})`);
      gr.addColorStop(1, 'rgba(255,160,80,0)');
      g.fillStyle = gr;
      g.fillRect(win.x - win.w * 3, win.y - win.h * 3, win.w * 7, win.h * 7);
      g.fillStyle = `rgba(255,205,120,${0.9 * k})`;
      g.fillRect(win.x, win.y, win.w, win.h);
      if (Math.random() < dt * 3) this.smoke.push({ x: this.cabin.x + this.cabin.s * 0.57, y: this.cabin.y - this.cabin.s * 1.7, r: u, age: 0 });
    }
    this.smoke = this.smoke.filter((p) => (p.age += dt) < 7);
    for (const p of this.smoke) {
      p.y -= u * 1.5 * dt;
      p.x += (u * 0.6 + this.gust * u * 2) * dt;
      p.r += u * 0.5 * dt;
      g.fillStyle = `rgba(220,230,240,${0.18 * (1 - p.age / 7)})`;
      g.beginPath();
      g.arc(p.x, p.y, p.r, 0, TAU);
      g.fill();
    }
    // gusts push the snow sideways
    if (Math.random() < dt * 0.25) this.gustTarget = rand(-0.2, 1) * (this.drivers.wind ?? 0.7);
    this.gust += (this.gustTarget - this.gust) * dt * 0.6;
    g.fillStyle = '#f4f8fb';
    for (const f of this.flakes) {
      f.y += f.v * h * dt;
      f.x += (Math.sin(t * 0.8 + f.ph) * 0.3 + this.gust * 2.2) * u * dt * (0.4 + f.z);
      if (f.y > h + 5 || f.x > w + 10 || f.x < -10) Object.assign(f, this.flake(false));
      g.globalAlpha = 0.35 + f.z * 0.6;
      g.beginPath();
      g.arc(f.x, f.y, f.r, 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;
    // close pines frame the view
    for (const p of this.near) {
      const s = h * 0.5 * p.s;
      const sway = Math.sin(t * 0.5 + p.x) * this.gust * u;
      g.fillStyle = '#0f2233';
      for (let k = 0; k < 6; k++) {
        const y = h * 1.05 - k * s * 0.15;
        const wdt = s * 0.34 * (1 - k / 7);
        g.beginPath();
        g.moveTo(p.x - wdt + sway * k * 0.3, y);
        g.lineTo(p.x + sway * k * 0.4, y - s * 0.24);
        g.lineTo(p.x + wdt + sway * k * 0.3, y);
        g.closePath();
        g.fill();
        g.fillStyle = 'rgba(235,242,248,0.85)';
        g.beginPath();
        g.ellipse(p.x + sway * k * 0.35, y - s * 0.17, wdt * 0.35, s * 0.012, 0, 0, TAU);
        g.fill();
        g.fillStyle = '#0f2233';
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------
// The blank canvas: black, with a slow breathing ring so you know it's alive.
class Blank extends Painting {
  frame() {
    const { g, w, h, t } = this;
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    const k = 0.5 + 0.5 * Math.sin(t * 0.35);
    const r = Math.min(w, h) * (0.18 + 0.02 * k);
    g.strokeStyle = `rgba(207,232,236,${0.05 + 0.04 * k})`;
    g.lineWidth = 1.2 * this.dpr;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.ellipse(w / 2, h * 0.38, r * (1 + i * 0.45), r * (1 + i * 0.45) * 0.5, 0, 0, TAU);
      g.stroke();
    }
  }
}

const PAINTINGS = { storm: Storm, waterfall: Waterfall, garden: Garden, mansion: Mansion, snow: Snow, mixer: Blank };

export function createPainting(id, canvas, engine) {
  const P = PAINTINGS[id] || Blank;
  return new P(canvas, engine);
}

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
// A native-plant butterfly garden in Florida on a warm morning: a live oak hung with Spanish
// moss, sabal palms, and beds of wildflowers in every colour. Butterflies work the flowers,
// dragonflies hover and dart, and the hummingbirds and birds you hear turn up where they'd be.

// The plants. h: stem height, spread: width (garden units); n: flowers per plant; R: flower size;
// leaf: foliage; tube: hummingbirds feed there; spike: flowers along a wand (its length, in R).
const FLORA = {
  hibiscus: { h: [12, 16], spread: 9, n: [2, 3], R: 2.6, leaf: 'palmate', green: '#3b6b35', tube: true }, // scarlet rosemallow
  rosemallow: { h: [10, 13], spread: 11, n: [2, 3], R: 2.8, leaf: 'broad', green: '#4a7a3f' }, // swamp rosemallow
  milkweed: { h: [7, 10], spread: 8, n: [3, 5], R: 1.6, leaf: 'narrow', green: '#3f7040' }, // butterfly milkweed
  swampmilkweed: { h: [9, 12], spread: 8, n: [3, 4], R: 1.4, leaf: 'narrow', green: '#3c6a3a' },
  coreopsis: { h: [6, 9], spread: 10, n: [6, 9], R: 1.3, leaf: 'grass', green: '#4b7d3c' }, // tickseed, the state wildflower
  susan: { h: [7, 10], spread: 9, n: [5, 7], R: 1.5, leaf: 'oval', green: '#3e6b34' }, // black-eyed Susan
  gaillardia: { h: [5, 7], spread: 10, n: [5, 8], R: 1.5, leaf: 'oval', green: '#5a7f4a' }, // blanket flower
  needles: { h: [6, 9], spread: 10, n: [6, 10], R: 1.0, leaf: 'oval', green: '#3d7038' }, // Spanish needles
  porterweed: { h: [7, 9], spread: 9, n: [4, 6], R: 0.9, leaf: 'oval', green: '#356b37', tube: true, spike: 4 }, // blue porterweed
  liatris: { h: [8, 11], spread: 6, n: [3, 6], R: 1.1, leaf: 'grass', green: '#4a7844', spike: 4.5 }, // blazing star
  sage: { h: [6, 9], spread: 7, n: [4, 6], R: 1.1, leaf: 'oval', green: '#3f7239', tube: true, spike: 3.5 }, // scarlet sage
  passionflower: { h: [5, 8], spread: 12, n: [3, 4], R: 1.7, leaf: 'lobed', green: '#3c6e3b', vine: true }, // maypop
  firebush: { h: [15, 19], spread: 13, n: [6, 9], R: 1.4, leaf: 'oval', green: '#2f5a33', tube: true, shrub: true },
  spiderwort: { h: [6, 8], spread: 8, n: [4, 7], R: 1.1, leaf: 'grass', green: '#4a7f5a' },
  mimosa: { h: [1.5, 2.5], spread: 13, n: [6, 10], R: 0.9, leaf: 'fern', green: '#5b8a45', mat: true }, // sunshine mimosa
};
const HUE = { hibiscus: 'red', sage: 'red', firebush: 'red', gaillardia: 'red', milkweed: 'orange', coreopsis: 'yellow', susan: 'yellow', needles: 'white', rosemallow: 'pink', swampmilkweed: 'pink', mimosa: 'pink', porterweed: 'blue', spiderwort: 'blue', liatris: 'purple', passionflower: 'purple' };

// Florida butterflies, and the flowers each likes best.
const BUTTERFLIES = {
  zebra: { wing: '#141414', mark: '#f7e27a', size: 1.15, flap: 5, glide: 0.5, shape: 'long', likes: ['passionflower', 'firebush', 'porterweed'] }, // zebra longwing, the state butterfly
  monarch: { wing: '#e8741a', mark: '#151515', size: 1.1, flap: 6, glide: 0.4, shape: 'round', dots: true, likes: ['milkweed', 'swampmilkweed', 'liatris'] },
  fritillary: { wing: '#f2711c', mark: '#2a1a10', size: 0.95, flap: 8, glide: 0.25, shape: 'round', spots: true, likes: ['passionflower', 'needles', 'porterweed'] }, // gulf fritillary
  sulphur: { wing: '#ffe23d', mark: '#e0b400', size: 0.9, flap: 10, glide: 0.1, shape: 'round', likes: ['hibiscus', 'sage', 'firebush'] }, // cloudless sulphur
  swallowtail: { wing: '#24201b', mark: '#f2d14b', size: 1.25, flap: 5, glide: 0.45, shape: 'tailed', likes: ['firebush', 'liatris', 'milkweed'] }, // giant swallowtail
};

// The birds you can hear, and where each likes to be.
const BIRD_LOOKS = {
  cardinal: { body: '#c8102e', head: '#c8102e', wing: '#a10d24', crest: true, mask: true, beak: '#f28c28', where: 'shrub' },
  'blue-jay': { body: '#dfe7ef', head: '#3a6fc4', wing: '#3a6fc4', crest: true, beak: '#222', size: 1.15, where: 'tree' },
  mockingbird: { body: '#d9d9d6', head: '#8d8f8f', wing: '#6f7272', patch: '#ffffff', tail: 1.5, beak: '#222', where: 'top' },
  'carolina-wren': { body: '#c98a4a', head: '#8a5428', wing: '#8a5428', brow: true, tail: 0.8, cock: true, beak: '#555', size: 0.8, where: 'shrub' },
  'mourning-dove': { body: '#cdb79e', head: '#bba68c', wing: '#a89377', tail: 1.6, beak: '#333', size: 1.1, where: 'ground' },
  'tufted-titmouse': { body: '#e6e2dc', head: '#8f969c', wing: '#8f969c', crest: true, flank: '#d98b5a', beak: '#333', size: 0.85, where: 'tree' },
  'northern-parula': { body: '#f2d33a', head: '#6f86a6', wing: '#6f86a6', beak: '#333', size: 0.7, where: 'tree' },
  'ground-dove': { body: '#c9a08f', head: '#a88d80', wing: '#9c7f72', beak: '#c45b4a', size: 0.75, where: 'ground' },
  'red-bellied-woodpecker': { body: '#e8e2d4', head: '#d62828', wing: '#2b2b2b', bars: true, beak: '#333', where: 'trunk' },
};

// Fill a bed: the plants it must have, the rest drawn from `pool`, no two neighbours the same colour.
function arrange(pool, n, r, must = []) {
  const bag = must.slice(0, n);
  while (bag.length < n) bag.push(pool[Math.floor(r() * pool.length)]);
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  for (let i = 1; i < bag.length; i++) {
    if (HUE[bag[i]] !== HUE[bag[i - 1]]) continue;
    const j = bag.findIndex((k, jj) => jj > i && HUE[k] !== HUE[bag[i - 1]] && HUE[k] !== HUE[bag[i + 1]]);
    if (j > 0) [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

// One leaf of a given type, growing from (x, y) along angle a.
function leaf(g, type, x, y, z, a, col) {
  g.save();
  g.translate(x, y);
  g.rotate(a);
  g.fillStyle = col;
  g.strokeStyle = col;
  switch (type) {
    case 'grass':
      g.lineWidth = z * 0.32;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(z * 2.6, -z * 0.2, z * 4.6, z * 1.3);
      g.stroke();
      break;
    case 'palmate': // deeply cut, like a hand
      for (let k = -2; k <= 2; k++) {
        g.beginPath();
        g.ellipse(Math.cos(k * 0.42) * z * 1.5, Math.sin(k * 0.42) * z * 1.5, z * 1.5, z * 0.26, k * 0.42, 0, TAU);
        g.fill();
      }
      break;
    case 'narrow':
      g.beginPath();
      g.ellipse(z * 1.8, 0, z * 1.8, z * 0.36, 0, 0, TAU);
      g.fill();
      break;
    case 'broad':
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(z * 1.1, -z * 1.3, z * 2.8, 0);
      g.quadraticCurveTo(z * 1.1, z * 1.3, 0, 0);
      g.fill();
      break;
    case 'lobed': // three-lobed passionvine leaves
      for (const k of [-0.65, 0, 0.65]) {
        g.beginPath();
        g.ellipse(Math.cos(k) * z * 1.05, Math.sin(k) * z * 1.05, z * 1.05, z * 0.5, k, 0, TAU);
        g.fill();
      }
      break;
    case 'fern': // feathery mimosa leaves
      g.lineWidth = z * 0.12;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(z * 3, 0);
      g.stroke();
      for (let k = 0.4; k < 3; k += 0.32) {
        g.beginPath();
        g.ellipse(z * k, -z * 0.24, z * 0.13, z * 0.25, 0.3, 0, TAU);
        g.ellipse(z * k, z * 0.24, z * 0.13, z * 0.25, -0.3, 0, TAU);
        g.fill();
      }
      break;
    default:
      g.beginPath();
      g.ellipse(z * 1.2, 0, z * 1.2, z * 0.58, 0, 0, TAU);
      g.fill();
  }
  g.restore();
}

// a ray petal from r0 out to R, w wide at the end, the tip cut into teeth
function ray(g, r0, R, w) {
  g.beginPath();
  g.moveTo(r0, -w * 0.25);
  g.lineTo(R * 0.92, -w);
  g.lineTo(R, -w * 0.6);
  g.lineTo(R * 0.95, -w * 0.3);
  g.lineTo(R * 1.02, 0);
  g.lineTo(R * 0.95, w * 0.3);
  g.lineTo(R, w * 0.6);
  g.lineTo(R * 0.92, w);
  g.lineTo(r0, w * 0.25);
  g.closePath();
  g.fill();
}

// five tiny lobes around a pale eye (porterweed)
function tiny(g, x, y, r, col) {
  g.fillStyle = col;
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU;
    g.beginPath();
    g.arc(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.5, 0, TAU);
    g.fill();
  }
  g.fillStyle = '#f4f1ff';
  g.beginPath();
  g.arc(x, y, r * 0.22, 0, TAU);
  g.fill();
}

// One flower of the kind, centred at (x, y), R across (spikes grow upward from there).
function flower(g, kind, x, y, R, r) {
  g.save();
  g.translate(x, y);
  g.lineCap = 'round';
  const spin = r() * TAU;
  const tilt = 0.7 + r() * 0.3; // seen a little from the side
  switch (kind) {
    case 'hibiscus': {
      // scarlet rosemallow: five narrow petals, spaced apart, and a long stamen column
      g.save();
      g.scale(1, tilt);
      g.rotate(spin);
      for (let k = 0; k < 5; k++) {
        g.rotate(TAU / 5);
        g.fillStyle = k % 2 ? '#c60f2c' : '#d81b36';
        g.beginPath();
        g.moveTo(0, 0);
        g.bezierCurveTo(R * 0.35, -R * 0.08, R * 0.68, -R * 0.36, R * 0.94, -R * 0.22);
        g.quadraticCurveTo(R * 1.1, 0, R * 0.94, R * 0.22);
        g.bezierCurveTo(R * 0.68, R * 0.36, R * 0.35, R * 0.08, 0, 0);
        g.fill();
        g.strokeStyle = 'rgba(110,0,20,0.35)';
        g.lineWidth = R * 0.035;
        g.beginPath();
        g.moveTo(R * 0.12, 0);
        g.lineTo(R * 0.85, 0);
        g.stroke();
      }
      g.restore();
      g.strokeStyle = '#b30c28';
      g.lineWidth = R * 0.07;
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(R * 0.3, -R * 0.35, R * 0.5, -R * 0.78);
      g.stroke();
      g.fillStyle = '#f5c542';
      for (let k = 0; k < 6; k++) {
        g.beginPath();
        g.arc(R * (0.33 + k * 0.03) + (k % 2 ? 1 : -1) * R * 0.06, -R * (0.45 + k * 0.05), R * 0.045, 0, TAU);
        g.fill();
      }
      g.fillStyle = '#8e0a22';
      g.beginPath();
      g.arc(R * 0.52, -R * 0.82, R * 0.06, 0, TAU);
      g.fill();
      break;
    }
    case 'rosemallow': {
      // swamp rosemallow: broad overlapping petals, pink or white, with a crimson eye
      const pink = r() < 0.55;
      g.save();
      g.scale(1, tilt);
      g.rotate(spin);
      for (let k = 0; k < 5; k++) {
        g.rotate(TAU / 5);
        g.fillStyle = pink ? (k % 2 ? '#f5b8cb' : '#f8c6d5') : k % 2 ? '#fbf3ef' : '#fffaf6';
        g.strokeStyle = pink ? 'rgba(214,110,145,0.6)' : 'rgba(205,185,180,0.7)';
        g.lineWidth = R * 0.03;
        g.beginPath();
        g.moveTo(0, 0);
        g.bezierCurveTo(R * 0.15, -R * 0.62, R * 0.95, -R * 0.66, R * 1.02, -R * 0.08);
        g.bezierCurveTo(R * 1.02, R * 0.42, R * 0.45, R * 0.46, 0, 0);
        g.fill();
        g.stroke();
      }
      const eye = g.createRadialGradient(0, 0, 0, 0, 0, R * 0.42);
      eye.addColorStop(0, '#6d0a24');
      eye.addColorStop(0.6, '#a3163c');
      eye.addColorStop(1, 'rgba(163,22,60,0)');
      g.fillStyle = eye;
      g.beginPath();
      g.arc(0, 0, R * 0.42, 0, TAU);
      g.fill();
      g.restore();
      g.strokeStyle = '#fbeed2';
      g.lineWidth = R * 0.08;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(R * 0.22, -R * 0.42);
      g.stroke();
      g.fillStyle = '#f4d35e';
      g.beginPath();
      g.arc(R * 0.23, -R * 0.44, R * 0.09, 0, TAU);
      g.fill();
      break;
    }
    case 'milkweed':
    case 'swampmilkweed': {
      // a flat-topped umbel of small star florets on fine stalks
      const [dark, light] = kind === 'milkweed' ? ['#e35d16', '#ffa94d'] : ['#c64480', '#f4a3c8'];
      const pts = [];
      for (let i = 0; i < 15; i++) {
        const fx = (r() * 2 - 1) * R;
        pts.push([fx, -R * 0.5 * Math.sqrt(1 - (fx / R) ** 2) * (0.6 + r() * 0.5)]);
      }
      g.strokeStyle = '#4f7d3a';
      g.lineWidth = R * 0.05;
      for (const [fx, fy] of pts) {
        g.beginPath();
        g.moveTo(0, R * 0.3);
        g.lineTo(fx, fy);
        g.stroke();
      }
      for (const [fx, fy] of pts) {
        g.fillStyle = dark;
        g.beginPath();
        g.arc(fx, fy, R * 0.21, 0, TAU);
        g.fill();
        g.fillStyle = light;
        g.beginPath();
        g.arc(fx - R * 0.03, fy - R * 0.06, R * 0.11, 0, TAU);
        g.fill();
      }
      break;
    }
    case 'coreopsis':
    case 'gaillardia': {
      const gail = kind === 'gaillardia';
      const n = gail ? 12 : 8;
      g.save();
      g.scale(1, tilt);
      g.rotate(spin);
      for (let k = 0; k < n; k++) {
        g.rotate(TAU / n);
        g.fillStyle = gail ? '#f7c02a' : '#ffd21f';
        ray(g, R * 0.12, R, R * (gail ? 0.26 : 0.34));
        if (gail) {
          // blanket flower: red, tipped with yellow
          g.fillStyle = '#b8261d';
          ray(g, R * 0.12, R * 0.66, R * 0.2);
        }
      }
      g.fillStyle = gail ? '#6e1b14' : '#7b4a12';
      g.beginPath();
      g.arc(0, 0, R * (gail ? 0.32 : 0.24), 0, TAU);
      g.fill();
      g.fillStyle = gail ? '#9c3218' : '#4f2c06';
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * TAU;
        g.beginPath();
        g.arc(Math.cos(a) * R * 0.2, Math.sin(a) * R * 0.2, R * 0.05, 0, TAU);
        g.fill();
      }
      g.restore();
      break;
    }
    case 'susan': {
      g.save();
      g.scale(1, tilt * 0.9);
      g.rotate(spin);
      for (let k = 0; k < 13; k++) {
        g.rotate(TAU / 13);
        g.fillStyle = k % 2 ? '#f5ab0c' : '#f9b918';
        g.beginPath();
        g.ellipse(R * 0.58, 0, R * 0.48, R * 0.16, 0, 0, TAU);
        g.fill();
      }
      g.restore();
      g.fillStyle = '#2b170a';
      g.beginPath();
      g.arc(0, -R * 0.05, R * 0.3, 0, TAU);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.14)';
      g.beginPath();
      g.arc(-R * 0.08, -R * 0.14, R * 0.12, 0, TAU);
      g.fill();
      break;
    }
    case 'needles': {
      // Spanish needles: a few broad white rays round a yellow disc
      const n = 5 + Math.floor(r() * 3);
      g.save();
      g.scale(1, tilt);
      g.rotate(spin);
      g.strokeStyle = 'rgba(170,170,160,0.6)';
      g.lineWidth = R * 0.03;
      for (let k = 0; k < n; k++) {
        g.rotate(TAU / n);
        g.fillStyle = '#fcfcf7';
        g.beginPath();
        g.ellipse(R * 0.6, 0, R * 0.45, R * 0.3, 0, 0, TAU);
        g.fill();
        g.stroke();
      }
      g.restore();
      g.fillStyle = '#efbe2a';
      g.beginPath();
      g.arc(0, 0, R * 0.27, 0, TAU);
      g.fill();
      break;
    }
    case 'spiderwort': {
      g.save();
      g.scale(1, tilt);
      g.rotate(spin);
      g.fillStyle = '#6a62d8';
      for (let k = 0; k < 3; k++) {
        g.rotate(TAU / 3);
        g.beginPath();
        g.ellipse(R * 0.5, 0, R * 0.52, R * 0.42, 0, 0, TAU);
        g.fill();
      }
      g.restore();
      g.fillStyle = '#ffd84d';
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU;
        g.beginPath();
        g.arc(Math.cos(a) * R * 0.18, Math.sin(a) * R * 0.18, R * 0.07, 0, TAU);
        g.fill();
      }
      break;
    }
    case 'passionflower': {
      // maypop: pale petals, a banded corona of wavy filaments, a green crown
      g.save();
      g.scale(1, tilt);
      g.rotate(spin);
      for (let k = 0; k < 10; k++) {
        g.rotate(TAU / 10);
        g.fillStyle = k % 2 ? '#ece3f5' : '#f6f0fb';
        g.beginPath();
        g.ellipse(R * 0.58, 0, R * 0.46, R * 0.15, 0, 0, TAU);
        g.fill();
      }
      g.lineWidth = R * 0.035;
      for (let k = 0; k < 40; k++) {
        const a = (k / 40) * TAU;
        const c = Math.cos(a);
        const s = Math.sin(a);
        for (const [r0, r1, col] of [
          [0.15, 0.45, '#4b1f73'],
          [0.45, 0.62, '#fbf8ff'],
          [0.62, 0.95, '#8c5cc8'],
        ]) {
          g.strokeStyle = col;
          g.beginPath();
          g.moveTo(c * R * r0, s * R * r0);
          g.lineTo(c * R * r1 + Math.sin(k * 2.3) * R * 0.03, s * R * r1);
          g.stroke();
        }
      }
      g.restore();
      g.fillStyle = '#a8c66c';
      g.beginPath();
      g.arc(0, 0, R * 0.14, 0, TAU);
      g.fill();
      g.strokeStyle = '#5e7a2e';
      g.lineWidth = R * 0.05;
      for (let k = 0; k < 3; k++) {
        const a = -Math.PI / 2 + (k - 1) * 0.7;
        g.beginPath();
        g.moveTo(0, -R * 0.05);
        g.lineTo(Math.cos(a) * R * 0.3, Math.sin(a) * R * 0.3 - R * 0.1);
        g.stroke();
      }
      break;
    }
    case 'firebush': {
      // a loose cluster of slender red-orange tubes
      const n = 6 + Math.floor(r() * 4);
      for (let k = 0; k < n; k++) {
        const a = -Math.PI * (0.08 + 0.84 * r());
        const L = R * (0.7 + r() * 0.4);
        g.save();
        g.rotate(a);
        const gr = g.createLinearGradient(0, 0, L, 0);
        gr.addColorStop(0, '#c0391b');
        gr.addColorStop(1, '#f2712e');
        g.fillStyle = gr;
        g.beginPath();
        g.ellipse(L * 0.55, 0, L * 0.5, R * 0.09, 0, 0, TAU);
        g.fill();
        g.restore();
      }
      break;
    }
    case 'porterweed': {
      // a long thin spike, a few small blue flowers open partway up it
      const L = R * 4;
      const bend = (r() - 0.5) * R;
      const at = (t) => [bend * (2 * t - 1.5 * t * t), -L * t];
      g.strokeStyle = '#2e5a2a';
      g.lineWidth = R * 0.14;
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(bend, -L * 0.5, bend * 0.5, -L);
      g.stroke();
      const t0 = 0.35 + r() * 0.35;
      for (let k = 0; k < 4; k++) {
        const [px, py] = at(t0 + (k - 1.5) * 0.07);
        tiny(g, px + (k % 2 ? 1 : -1) * R * 0.28, py, R * 0.36, k % 2 ? '#5b4fd0' : '#6a5fe0');
      }
      break;
    }
    case 'liatris': {
      // blazing star: a wand of fuzzy purple flowers, opening from the top down
      const L = R * 4.5;
      const bend = (r() - 0.5) * R * 0.6;
      g.strokeStyle = '#4c6b3a';
      g.lineWidth = R * 0.12;
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(bend, -L * 0.5, bend * 0.5, -L);
      g.stroke();
      for (let i = 0; i < 46; i++) {
        const t = i / 46;
        const x = bend * (2 * t - 1.5 * t * t);
        const wd = R * 0.42 * (1 - t * 0.55);
        const open = t > 0.35;
        g.fillStyle = open ? ['#9a46c8', '#b56ad8', '#7f34aa'][i % 3] : ['#6d5a7c', '#5f6f58'][i % 2];
        g.beginPath();
        g.arc(x + (r() - 0.5) * 2 * wd, -L * t, R * (open ? 0.17 : 0.11), 0, TAU);
        g.fill();
      }
      break;
    }
    case 'sage': {
      // scarlet sage: tiers of red two-lipped tubes up the stem
      const L = R * 3.5;
      g.strokeStyle = '#3b5e2c';
      g.lineWidth = R * 0.1;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(0, -L);
      g.stroke();
      g.fillStyle = '#e3262f';
      for (let k = 0; k < 4; k++) {
        for (const side of [-1, 1]) {
          if (k === 3 && side === 1) continue;
          g.save();
          g.translate(0, -L * (0.2 + k * 0.22));
          g.scale(side, 1);
          g.rotate(-0.35);
          g.beginPath();
          g.ellipse(R * 0.35, 0, R * 0.35, R * 0.1, 0, 0, TAU);
          g.fill();
          g.beginPath();
          g.ellipse(R * 0.68, R * 0.08, R * 0.16, R * 0.2, 0.4, 0, TAU);
          g.fill();
          g.restore();
        }
      }
      g.fillStyle = '#9c1c26';
      g.beginPath();
      g.ellipse(0, -L - R * 0.1, R * 0.1, R * 0.22, 0, 0, TAU);
      g.fill();
      break;
    }
    case 'mimosa': {
      // sunshine mimosa: pink powder puffs
      g.lineWidth = R * 0.06;
      for (let k = 0; k < 28; k++) {
        const a = r() * TAU;
        const l = R * (0.6 + r() * 0.4);
        g.strokeStyle = '#e45d9e';
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(Math.cos(a) * l, Math.sin(a) * l * 0.9);
        g.stroke();
        g.fillStyle = '#ffd4e8';
        g.beginPath();
        g.arc(Math.cos(a) * l, Math.sin(a) * l * 0.9, R * 0.07, 0, TAU);
        g.fill();
      }
      break;
    }
  }
  g.restore();
}

// One plant: its leafy base is painted onto the static layer `fg`; its stems and flowers go into
// a sprite that sways from the root. Returns the sprite and where its flowers are.
function plant(fg, x, y, kind, s, r) {
  const F = FLORA[kind];
  const H = lerp(F.h[0], F.h[1], r()) * s;
  const W = F.spread * s;
  const R = F.R * s;
  const spike = F.spike ? F.spike * R : 0;
  const n = Math.round(lerp(F.n[0], F.n[1], r()));
  const shade = (k) => mix(F.green, k < 0 ? '#16301a' : '#a9cf86', Math.min(1, Math.abs(k)));
  // the leafy base, darker underneath
  fg.save();
  fg.translate(x, y);
  const count = F.mat ? 44 : 26;
  for (let i = 0; i < count; i++) {
    const lx = (r() - 0.5) * W * (F.mat ? 1.1 : 0.9);
    if (F.mat) {
      leaf(fg, 'fern', lx * 0.5, -r() * H * 0.5, s * (0.7 + r() * 0.5), (lx < 0 ? Math.PI : 0) + (r() - 0.5) * 0.7, shade(lerp(-0.4, 0.2, i / count)));
    } else {
      const ly = -r() * H * (F.shrub ? 0.15 : 0.3) * (1 - Math.abs(lx) / W);
      leaf(fg, F.leaf, lx * 0.6, ly, s * (0.8 + r() * 0.6), -Math.PI / 2 + (lx / W) * 2.2 + (r() - 0.5) * 0.9, shade(lerp(-0.45, 0.15, i / count)));
    }
  }
  fg.restore();

  const cw = Math.ceil(W + 2.6 * R + 4 * s);
  const ch = Math.ceil(H + spike + 1.6 * R + 4 * s);
  const c = layer(cw, ch);
  const g = c.getContext('2d');
  const ax = cw / 2;
  const ay = ch - s;
  g.translate(ax, ay);
  g.lineCap = 'round';
  const heads = [];
  if (F.shrub) {
    // firebush: a rounded crown, bronze new growth on top, flower clusters all round it
    for (let i = 0; i < 120; i++) {
      let lx;
      let ly;
      do {
        lx = (r() * 2 - 1) * W * 0.5;
        ly = -r() * H;
      } while ((lx / (W * 0.5)) ** 2 + ((ly + H * 0.55) / (H * 0.5)) ** 2 > 1);
      const k = -ly / H;
      const col = k > 0.8 && r() < 0.35 ? '#8a3a26' : shade(lerp(-0.5, 0.25, k) + (r() - 0.5) * 0.2);
      leaf(g, 'oval', lx, ly, s * (0.9 + r() * 0.5), r() * TAU, col);
    }
    for (let i = 0; i < n; i++) {
      const a = -Math.PI * (0.06 + 0.88 * r());
      heads.push({ dx: Math.cos(a) * W * 0.44, dy: -H * 0.55 + Math.sin(a) * H * 0.46, R: R * (0.85 + r() * 0.3) });
    }
  } else if (F.vine) {
    // passionflower scrambling over a low mound, tendrils curling off it
    for (let i = 0; i < 46; i++) {
      const lx = (r() - 0.5) * W;
      const ly = -r() * H * (1 - (Math.abs(lx) / W) * 1.2);
      leaf(g, 'lobed', lx, ly, s * (0.8 + r() * 0.5), -Math.PI / 2 + (r() - 0.5) * 2, shade(lerp(-0.4, 0.2, i / 46)));
    }
    g.strokeStyle = shade(0.15);
    g.lineWidth = s * 0.12;
    for (let i = 0; i < 6; i++) {
      const tx = (r() - 0.5) * W;
      const ty = -H * (0.6 + r() * 0.5);
      g.beginPath();
      g.moveTo(tx, ty + s);
      g.bezierCurveTo(tx + s, ty - s, tx + 2 * s, ty, tx + 1.2 * s, ty + 0.6 * s);
      g.stroke();
    }
    for (let i = 0; i < n; i++) heads.push({ dx: (r() - 0.5) * W * 0.8, dy: -H * (0.45 + r() * 0.5), R: R * (0.85 + r() * 0.3) });
  } else if (F.mat) {
    // groundcover: the puffs stand just above the leaves
    g.strokeStyle = shade(-0.1);
    g.lineWidth = s * 0.15;
    for (let i = 0; i < n; i++) {
      const dx = (r() - 0.5) * W;
      const dy = -H * (0.7 + r() * 0.5) - R * 0.4;
      g.beginPath();
      g.moveTo(dx, dy + H * 0.7);
      g.lineTo(dx, dy);
      g.stroke();
      heads.push({ dx, dy, R: R * (0.85 + r() * 0.3) });
    }
  } else {
    // stems from the root, leaves up them, flowers at the tips
    for (let i = 0; i < n; i++) {
      const bx = (r() - 0.5) * W * 0.35;
      const tx = (r() - 0.5) * W * 0.95;
      const ty = -H * (0.62 + r() * 0.38);
      const mx = bx + (tx - bx) * 0.15;
      const my = ty * 0.55;
      g.strokeStyle = shade(-0.25);
      g.lineWidth = Math.max(1, s * 0.3);
      g.beginPath();
      g.moveTo(bx, 0);
      g.quadraticCurveTo(mx, my, tx, ty);
      g.stroke();
      const nl = F.leaf === 'grass' ? 2 : 3;
      for (let k = 1; k <= nl; k++) {
        const t = k / (nl + 1.3);
        const px = (1 - t) ** 2 * bx + 2 * (1 - t) * t * mx + t * t * tx;
        const py = 2 * (1 - t) * t * my + t * t * ty;
        const side = k % 2 ? 1 : -1;
        leaf(g, F.leaf, px, py, s * (0.6 + r() * 0.3) * (1 - t * 0.4), -Math.PI / 2 + side * (0.9 + r() * 0.4), shade(-0.1 + r() * 0.2));
      }
      heads.push({ dx: tx, dy: ty, R: R * (0.85 + r() * 0.3) });
    }
  }
  // flowers, highest first, so the nearer, lower ones overlap them
  heads.sort((a, b) => a.dy - b.dy);
  for (const hd of heads) flower(g, kind, hd.dx, hd.dy, hd.R, r);
  // on a spike, butterflies and hummingbirds feed partway up it
  if (spike) for (const hd of heads) hd.dy -= hd.R * F.spike * 0.6;
  return { c, ax, ay, heads, top: -H };
}

// A ragged band of mixed low foliage along a bed, so the plants stand in a planted bed rather
// than dotted about a lawn.
function bedBand(g, w, y, s, r) {
  const greens = ['#2c5530', '#356338', '#3f6f3c', '#2a4d2e', '#4a7a42', '#5a8a4a'];
  for (let x = -2 * s; x < w + 2 * s; x += s * 0.8) {
    const n = Math.floor(r() * 4); // 0-3 leaves here, so the edge is uneven
    for (let k = 0; k < n; k++) {
      const type = ['oval', 'narrow', 'grass', 'oval', 'broad'][Math.floor(r() * 5)];
      leaf(g, type, x + (r() - 0.5) * s * 1.5, y + s * 0.6 - r() * s * 1.8, s * (0.5 + r()), -Math.PI / 2 + (r() - 0.5) * 2.6, greens[Math.floor(r() * greens.length)]);
    }
  }
}

class Butterfly extends Painting {
  build() {
    const { w, h, u } = this;
    this.horizon = h * 0.6;
    let seed = 11;
    const r = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    // the sky, which clouds drift across
    this.sky = layer(w, h);
    let g = this.sky.getContext('2d');
    g.fillStyle = vgrad(g, 0, this.horizon, [
      [0, '#6dbcd8'],
      [0.55, '#bde5ee'],
      [1, '#fbefcf'],
    ]);
    g.fillRect(0, 0, w, this.horizon + 2);
    const sg = g.createRadialGradient(w * 0.84, h * 0.08, 0, w * 0.84, h * 0.08, h * 0.5);
    sg.addColorStop(0, 'rgba(255,250,225,0.95)');
    sg.addColorStop(0.12, 'rgba(255,244,205,0.5)');
    sg.addColorStop(1, 'rgba(255,244,205,0)');
    g.fillStyle = sg;
    g.fillRect(0, 0, w, this.horizon);
    // everything on the ground, painted once
    this.fg = layer(w, h);
    g = this.fg.getContext('2d');
    treeline(g, w, this.horizon - h * 0.015, h * 0.07, '#86ad92', 'round', 13);
    g.fillStyle = vgrad(g, this.horizon - h * 0.02, h, [
      [0, '#86ad5f'],
      [0.35, '#5b8843'],
      [1, '#2c552b'],
    ]);
    g.fillRect(0, this.horizon - h * 0.02, w, h);
    // the oak's shade on the grass
    const sh = g.createRadialGradient(w * 0.16, this.horizon + h * 0.07, 0, w * 0.16, this.horizon + h * 0.07, w * 0.4);
    sh.addColorStop(0, 'rgba(20,50,25,0.3)');
    sh.addColorStop(1, 'rgba(20,50,25,0)');
    g.fillStyle = sh;
    g.fillRect(0, this.horizon, w * 0.6, h * 0.2);
    // pink muhly grass: clumps of fine blades under a haze of pink seed heads
    for (let i = 0; i < 18; i++) {
      const x = r() * w;
      const y = this.horizon + h * (0.03 + r() * 0.05);
      const rad = (5 + r() * 5) * u;
      g.strokeStyle = 'rgba(70,110,60,0.6)';
      g.lineWidth = 0.18 * u;
      for (let k = 0; k < 18; k++) {
        const a = -Math.PI / 2 + (r() - 0.5) * 2.2;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(a) * rad * 0.6, y + Math.sin(a) * rad * 0.5);
        g.stroke();
      }
      const hz = g.createRadialGradient(x, y - rad * 0.35, 0, x, y - rad * 0.35, rad);
      hz.addColorStop(0, 'rgba(226,124,186,0.75)');
      hz.addColorStop(0.6, 'rgba(232,150,200,0.35)');
      hz.addColorStop(1, 'rgba(232,150,200,0)');
      g.fillStyle = hz;
      g.beginPath();
      g.ellipse(x, y - rad * 0.35, rad, rad * 0.6, 0, 0, TAU);
      g.fill();
      g.strokeStyle = 'rgba(214,110,170,0.35)';
      g.lineWidth = 0.12 * u;
      for (let k = 0; k < 14; k++) {
        const a = -Math.PI / 2 + (r() - 0.5) * 2.6;
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + Math.cos(a) * rad * 0.5, y + Math.sin(a) * rad * 0.7, x + Math.cos(a) * rad * 0.95, y - rad * 0.35 + Math.sin(a) * rad * 0.5);
        g.stroke();
      }
    }
    // a live oak on the left, Spanish moss hanging from its limbs
    this.oak = { x: -w * 0.04, y: this.horizon + h * 0.05 };
    this.perches = [];
    this.drawOak(g, r);
    // sabal palms are drawn live so they can sway
    this.palms = [
      { x: w * 0.8, base: this.horizon + h * 0.06, hgt: h * 0.5, lean: 0.06, ph: 0 },
      { x: w * 0.62, base: this.horizon + h * 0.03, hgt: h * 0.36, lean: -0.04, ph: 1.7 },
    ];
    // the flower beds: three rows, nearer ones bigger
    const all = Object.keys(FLORA);
    const rows = [
      { y: 0.685, sc: 0.8, gap: 7.5, must: ['firebush', 'firebush', 'liatris', 'hibiscus', 'passionflower', 'sage'], pool: ['firebush', 'hibiscus', 'rosemallow', 'liatris', 'passionflower', 'porterweed', 'sage', 'swampmilkweed', 'susan', 'coreopsis', 'needles'] },
      { y: 0.765, sc: 1.15, gap: 10.5, must: ['rosemallow', 'swampmilkweed', 'porterweed', 'liatris', 'passionflower', 'susan'], pool: all.filter((k) => k !== 'firebush' && k !== 'mimosa') },
      { y: 0.865, sc: 1.6, gap: 14, must: ['hibiscus', 'milkweed', 'coreopsis', 'gaillardia'], pool: all.filter((k) => k !== 'firebush') },
      // the nearest bed, cut off by the bottom of the screen
      { y: 0.985, sc: 2.2, gap: 19, must: ['milkweed', 'rosemallow', 'needles'], pool: ['milkweed', 'coreopsis', 'gaillardia', 'needles', 'mimosa', 'spiderwort', 'susan', 'swampmilkweed', 'hibiscus', 'rosemallow'] },
    ];
    this.plants = [];
    this.heads = [];
    rows.forEach((row, ri) => {
      const n = Math.ceil(w / (row.gap * u)) + 1;
      const kinds = arrange(row.pool, n, r, row.must);
      bedBand(g, w, h * row.y, row.sc * u, r);
      for (let i = 0; i < n; i++) {
        const x = ((i + (r() - 0.5) * 0.6) / (n - 1)) * w;
        const y = h * row.y + (r() - 0.5) * h * 0.012;
        const F = FLORA[kinds[i]];
        const p = { x, y, row: ri, kind: kinds[i], ph: r() * TAU, cos: 1, sin: 0, flex: F.shrub ? 0.008 : F.mat ? 0.004 : 0.016 + r() * 0.012, ...plant(g, x, y, kinds[i], row.sc * u, r) };
        for (const hd of p.heads) Object.assign(hd, { p, kind: p.kind, tube: !!F.tube, x: x + hd.dx, y: y + hd.dy });
        if (F.shrub) this.perches.push({ p, dx: 0, dy: p.top * 0.97, x, y: y + p.top, kind: 'shrub' });
        this.heads.push(...p.heads);
        this.plants.push(p);
      }
    });
    this.butterflies = ['zebra', 'zebra', 'monarch', 'fritillary', 'sulphur', 'sulphur', 'swallowtail', 'monarch'].map((kind) => this.newButterfly(kind, true));
    this.dragonflies = [
      { kind: 'pondhawk', color: '#7fb8e6', wing: 'rgba(230,245,255,0.45)' },
      { kind: 'pennant', color: '#6b3b16', wing: 'rgba(240,150,60,0.55)', bands: true },
      { kind: 'pondhawk-f', color: '#4ea65a', wing: 'rgba(230,245,255,0.45)' },
    ].map((d) => ({ ...d, x: rand(0.1, 0.9) * w, y: rand(0.35, 0.7) * h, tx: 0, ty: 0, hold: 0, ang: 0 }));
    this.hummers = [];
    this.birds = [];
    this.hawk = null;
    this.motes = Array.from({ length: 30 }, () => ({ x: rand(0, w), y: rand(h * 0.3, h * 0.9), ph: rand(0, TAU), s: rand(0.2, 0.45) * u }));
    this.clouds = Array.from({ length: 4 }, () => ({ x: rand(0, w), y: rand(0.05, 0.3) * h, r: rand(0.08, 0.16) * w, v: rand(0.3, 0.8) * u }));
  }

  drawOak(g, r) {
    const { w, h, u } = this;
    const ox = this.oak.x;
    const oy = this.oak.y;
    g.strokeStyle = '#4b3b2b';
    g.lineCap = 'round';
    g.lineWidth = 5 * u;
    g.beginPath();
    g.moveTo(ox, h);
    g.quadraticCurveTo(ox + w * 0.05, oy, ox + w * 0.06, h * 0.32);
    g.stroke();
    const limbs = [
      [ox + w * 0.06, h * 0.36, w * 0.36, h * 0.3],
      [ox + w * 0.05, h * 0.45, w * 0.3, h * 0.44],
      [ox + w * 0.06, h * 0.3, w * 0.22, h * 0.17],
    ];
    for (const [x0, y0, x1, y1] of limbs) {
      g.lineWidth = 2.4 * u;
      g.beginPath();
      g.moveTo(x0, y0);
      g.quadraticCurveTo((x0 + x1) / 2, Math.min(y0, y1) - h * 0.03, x1, y1);
      g.stroke();
      this.perches.push({ x: x0 + (x1 - x0) * 0.62, y: (y0 + y1) / 2 - h * 0.018, kind: 'branch' });
      this.perches.push({ x: x1 - w * 0.02, y: y1 - h * 0.006, kind: 'branch' });
    }
    // canopy: puffs of small leaves, lit from above
    const puffs = [
      [0.0, 0.16, 10], [0.12, 0.12, 10], [0.25, 0.15, 9], [0.36, 0.24, 8], [0.05, 0.27, 11],
      [0.19, 0.25, 10], [0.3, 0.33, 7], [0.1, 0.38, 9], [0.23, 0.41, 6],
    ];
    for (const [fx, fy, fr] of puffs) {
      const cx = ox + w * (fx + 0.04);
      const cy = h * fy;
      const rad = fr * u;
      for (let i = 0; i < 80; i++) {
        const a = r() * TAU;
        const d = Math.sqrt(r()) * rad;
        const y = cy + Math.sin(a) * d * 0.75;
        const k = clamp((y - (cy - rad * 0.75)) / (rad * 1.5) + (r() - 0.5) * 0.35, 0, 1);
        g.fillStyle = mix('#64945c', '#203f26', k);
        g.beginPath();
        g.ellipse(cx + Math.cos(a) * d * 1.3, y, (1 + r() * 1.3) * u, (0.6 + r() * 0.7) * u, r() * TAU, 0, TAU);
        g.fill();
      }
    }
    // Spanish moss: grey-green strands hanging in curtains
    g.strokeStyle = 'rgba(176,186,160,0.85)';
    g.lineWidth = 0.35 * u;
    for (let i = 0; i < 70; i++) {
      const x = ox + w * (0.08 + r() * 0.32);
      const y = h * (0.2 + r() * 0.24);
      const len = (4 + r() * 12) * u;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + (r() - 0.5) * 2 * u, y + len * 0.5, x + (r() - 0.5) * 3 * u, y + len);
      g.stroke();
    }
  }

  newButterfly(kind, anywhere) {
    const b = BUTTERFLIES[kind];
    return {
      kind,
      look: b,
      x: anywhere ? rand(0.05, 0.95) * this.w : rand(0, 1) < 0.5 ? -20 : this.w + 20,
      y: anywhere ? rand(0.4, 0.85) * this.h : rand(0.45, 0.8) * this.h,
      vx: 0,
      vy: 0,
      target: null,
      rest: 0,
      flapPh: rand(0, TAU),
      wob: rand(0, TAU),
      perched: false,
    };
  }

  // somewhere to feed: usually a flower this butterfly favours
  pickFlower(b) {
    const seen = this.heads.filter((hd) => hd.x > this.w * 0.03 && hd.x < this.w * 0.97);
    const liked = seen.filter((hd) => b.look.likes.includes(hd.kind));
    const list = liked.length && Math.random() < 0.65 ? liked : seen;
    return list[Math.floor(Math.random() * list.length)] || null;
  }

  event(e) {
    if (e.type === 'shot' && e.layer === 'hummingbird') {
      this.at(e.at, () => {
        const fromLeft = (e.az ?? rand(-90, 90)) < 0;
        // it feeds along one of the nearer beds, and is drawn to that bed's scale
        const tubes = this.heads.filter((hd) => hd.tube && hd.p.row > 0 && hd.x > this.w * 0.05 && hd.x < this.w * 0.95);
        const row = tubes.length ? tubes[Math.floor(Math.random() * tubes.length)].p.row : 0;
        const stops = tubes.filter((hd) => hd.p.row === row);
        const any = () => stops[Math.floor(Math.random() * stops.length)];
        this.hummers.push({
          x: fromLeft ? -10 : this.w + 10,
          y: rand(0.45, 0.7) * this.h,
          visits: [any(), any()].filter(Boolean),
          hover: 0,
          leaveBy: this.t + Math.max(2.5, e.dur || 3) + 1.5,
          dir: fromLeft ? 1 : -1,
          size: [0.8, 1.15, 1.6, 2.2][row] * 0.9,
        });
      });
    }
    if (e.type === 'bird') {
      this.at(e.at, () => this.showBird(e));
    }
  }

  showBird(e) {
    const { w, h, u } = this;
    if (e.species === 'red-shouldered-hawk') {
      this.hawk = { t0: this.t, cx: rand(0.3, 0.7) * w, cy: h * 0.14, r: rand(0.12, 0.2) * w, until: this.t + 18 };
      return;
    }
    const look = BIRD_LOOKS[e.species];
    if (!look) return;
    const key = e.bird ?? e.species;
    const existing = this.birds.find((b) => b.key === key);
    if (existing) {
      existing.sing = this.t;
      existing.until = this.t + (e.dur || 2);
      existing.gone = Math.max(existing.gone, this.t + (e.dur || 2) + rand(8, 16));
      return;
    }
    let spot;
    if (look.where === 'trunk') {
      const p = this.palms[0];
      spot = { x: p.x + p.lean * p.hgt * 0.4 - 0.8 * u, y: p.base - p.hgt * 0.42, trunk: true };
    } else if (look.where === 'ground') {
      // on the grass between the back bed and the middle one
      spot = { x: rand(0.12, 0.88) * w, y: h * rand(0.722, 0.745), ground: true };
    } else {
      const free = (kind) => this.perches.filter((p) => p.kind === kind && !this.birds.some((b) => b.spot === p));
      const shrubs = free('shrub');
      let list = look.where === 'shrub' && shrubs.length ? shrubs : free('branch');
      if (look.where === 'top') list = list.sort((a, b) => a.y - b.y).slice(0, 2);
      if (!list.length) list = shrubs.length ? shrubs : this.perches;
      // a pair keeps together: perch near the mate if it's in view
      const mate = this.birds.find((b) => b.species === e.species && !b.spot.ground);
      if (mate) list = [...list].sort((a, b) => Math.hypot(a.x - mate.spot.x, a.y - mate.spot.y) - Math.hypot(b.x - mate.spot.x, b.y - mate.spot.y)).slice(0, 1);
      spot = list[Math.floor(Math.random() * list.length)];
    }
    this.birds.push({ key, species: e.species, look, spot, sing: this.t, until: this.t + (e.dur || 2), gone: this.t + (e.dur || 2) + rand(8, 16), flip: (e.az ?? 0) > 0 });
  }

  frame(dt) {
    const { g, w, h, t, u } = this;
    const breeze = this.drivers.breeze ?? 0.4;
    g.drawImage(this.sky, 0, 0);
    // slow fair-weather clouds, behind the oak
    for (const c of this.clouds) {
      c.x += c.v * dt;
      if (c.x > w + c.r * 2) c.x = -c.r * 2;
      g.fillStyle = 'rgba(255,255,255,0.55)';
      for (let k = 0; k < 4; k++) {
        g.beginPath();
        g.ellipse(c.x + (k - 1.5) * c.r * 0.45, c.y - Math.sin(k * 1.3) * c.r * 0.12, c.r * 0.42, c.r * 0.26, 0, 0, TAU);
        g.fill();
      }
    }
    // a red-shouldered hawk circling high up
    if (this.hawk) {
      const k = this.hawk;
      if (t > k.until) this.hawk = null;
      else {
        const a = (t - k.t0) * 0.35;
        const x = k.cx + Math.cos(a) * k.r;
        const y = k.cy + Math.sin(a) * k.r * 0.3;
        g.strokeStyle = 'rgba(60,45,35,0.85)';
        g.lineWidth = 0.9 * u;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(x - 4.2 * u, y + 0.6 * u);
        g.quadraticCurveTo(x - 2 * u, y - 1.1 * u, x, y);
        g.quadraticCurveTo(x + 2 * u, y - 1.1 * u, x + 4.2 * u, y + 0.6 * u);
        g.stroke();
        g.fillStyle = 'rgba(60,45,35,0.85)';
        g.beginPath();
        g.ellipse(x, y + 0.5 * u, 0.5 * u, 1.1 * u, 0, 0, TAU);
        g.fill();
      }
    }
    g.drawImage(this.fg, 0, 0);
    for (const p of this.palms) this.drawPalm(p, breeze);
    // the beds, swaying from their roots; birds on the grass go between the back bed and the next
    const sp = 0.7 + breeze * 0.8;
    let grounded = false;
    for (const p of this.plants) {
      if (p.row > 0 && !grounded) {
        g.setTransform(1, 0, 0, 1, 0, 0);
        for (const b of this.birds) if (b.spot.ground && t < b.gone) this.drawBird(b);
        grounded = true;
      }
      const a = (Math.sin(t * sp + p.ph) * (0.4 + breeze) + Math.sin(t * 2.1 + p.ph * 3) * 0.2 * breeze) * p.flex;
      p.cos = Math.cos(a);
      p.sin = Math.sin(a);
      g.setTransform(p.cos, p.sin, -p.sin, p.cos, p.x, p.y);
      g.drawImage(p.c, -p.ax, -p.ay);
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    for (const o of this.heads) this.follow(o);
    for (const o of this.perches) if (o.p) this.follow(o);
    // birds you can hear
    this.birds = this.birds.filter((b) => t < b.gone);
    for (const b of this.birds) if (!b.spot.ground) this.drawBird(b);
    this.updateButterflies(dt);
    this.updateDragonflies(dt);
    this.updateHummers(dt);
    // warm motes in the light
    for (const m of this.motes) {
      m.x += Math.sin(t * 0.3 + m.ph) * u * dt * 1.5;
      m.y += Math.cos(t * 0.25 + m.ph) * u * dt;
      g.fillStyle = `rgba(255,240,200,${0.4 + 0.3 * Math.sin(t + m.ph)})`;
      g.fillRect(m.x, m.y, m.s, m.s);
    }
  }

  // move a point on a plant (a flower, a perch) with the plant's sway
  follow(o) {
    const p = o.p;
    o.x = p.x + o.dx * p.cos - o.dy * p.sin;
    o.y = p.y + o.dx * p.sin + o.dy * p.cos;
  }

  drawPalm(p, breeze) {
    const { g, t, u } = this;
    const sway = Math.sin(t * 0.6 + p.ph) * (0.6 + breeze) * 0.012;
    const topX = p.x + (p.lean + sway) * p.hgt;
    const topY = p.base - p.hgt;
    g.strokeStyle = '#7a6a52';
    g.lineWidth = 2.2 * u;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(p.x, p.base);
    g.quadraticCurveTo(p.x + p.lean * p.hgt * 0.3, p.base - p.hgt * 0.55, topX, topY);
    g.stroke();
    // the criss-cross "boots" of old leaf bases on the trunk
    g.strokeStyle = 'rgba(90,75,55,0.6)';
    g.lineWidth = 0.4 * u;
    for (let k = 0.15; k < 0.95; k += 0.07) {
      const x = p.x + (topX - p.x) * k * k;
      const y = p.base - p.hgt * k;
      g.beginPath();
      g.moveTo(x - 1.1 * u, y - 0.5 * u);
      g.lineTo(x + 1.1 * u, y + 0.5 * u);
      g.stroke();
    }
    // fan fronds
    const n = 13;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI + (i / (n - 1)) * Math.PI * 1.15 - 0.08 + Math.sin(t * 1.3 + i + p.ph) * 0.04 * (0.4 + breeze);
      const len = p.hgt * (0.2 + 0.05 * Math.sin(i * 2.1));
      const droop = Math.abs(Math.cos(a)) * 0.35;
      const ex = topX + Math.cos(a) * len;
      const ey = topY + Math.sin(a) * len * 0.7 + droop * len * 0.6;
      g.strokeStyle = i % 2 ? '#3f6e46' : '#4c7d52';
      g.lineWidth = 0.6 * u;
      g.beginPath();
      g.moveTo(topX, topY);
      g.quadraticCurveTo(topX + Math.cos(a) * len * 0.5, topY + Math.sin(a) * len * 0.35 - len * 0.1, ex, ey);
      g.stroke();
      // the fan: short segments splaying from the frond tip
      g.fillStyle = i % 2 ? 'rgba(63,110,70,0.9)' : 'rgba(76,125,82,0.9)';
      g.beginPath();
      g.moveTo(topX + Math.cos(a) * len * 0.45, topY + Math.sin(a) * len * 0.32);
      for (let k = 0; k <= 6; k++) {
        const aa = a + (k - 3) * 0.09;
        g.lineTo(ex + Math.cos(aa) * len * 0.12, ey + Math.sin(aa) * len * 0.12 + droop * 2 * u);
      }
      g.closePath();
      g.fill();
    }
  }

  drawButterfly(b, open) {
    const { g, u } = this;
    const L = b.look;
    const s = 1.5 * u * L.size;
    g.save();
    g.translate(b.x, b.y);
    g.rotate(Math.atan2(b.vy, Math.abs(b.vx) + 0.01) * 0.3);
    if (b.vx < 0) g.scale(-1, 1);
    for (const side of [-1, 1]) {
      g.save();
      g.scale(side * Math.max(0.12, open), 1);
      g.fillStyle = L.wing;
      g.beginPath();
      if (L.shape === 'long') {
        g.ellipse(s * 1.6, -s * 0.6, s * 1.9, s * 0.65, -0.35, 0, TAU);
        g.ellipse(s * 1.2, s * 0.5, s * 1.3, s * 0.5, 0.3, 0, TAU);
      } else {
        g.ellipse(s * 1.25, -s * 0.7, s * 1.35, s * 0.95, -0.5, 0, TAU);
        g.ellipse(s * 1.0, s * 0.55, s * 1.0, s * 0.8, 0.4, 0, TAU);
      }
      g.fill();
      if (L.shape === 'tailed') {
        g.fillRect(s * 1.2, s * 1.0, s * 0.25, s * 0.9);
      }
      g.strokeStyle = L.mark;
      g.fillStyle = L.mark;
      g.lineWidth = s * 0.22;
      if (L.shape === 'long') {
        g.beginPath();
        g.moveTo(s * 0.4, -s * 0.5);
        g.lineTo(s * 3.0, -s * 1.0);
        g.moveTo(s * 0.5, s * 0.3);
        g.lineTo(s * 2.2, s * 0.6);
        g.stroke();
      } else if (L.dots || L.spots) {
        g.lineWidth = s * 0.12;
        g.beginPath();
        g.moveTo(s * 0.2, -s * 0.2);
        g.lineTo(s * 2.1, -s * 1.2);
        g.moveTo(s * 0.3, s * 0.2);
        g.lineTo(s * 1.6, s * 0.9);
        g.stroke();
        for (let k = 0; k < 3; k++) {
          g.beginPath();
          g.arc(s * (1.5 + k * 0.3), -s * (1.1 - k * 0.25), s * 0.13, 0, TAU);
          g.fill();
        }
      } else if (L.shape === 'tailed') {
        g.beginPath();
        g.moveTo(s * 0.4, -s * 0.9);
        g.lineTo(s * 2.2, -s * 0.2);
        g.stroke();
      }
      g.restore();
    }
    g.fillStyle = '#1a1a1a';
    g.beginPath();
    g.ellipse(0, 0, s * 0.28, s * 1.2, 0, 0, TAU);
    g.fill();
    g.restore();
  }

  updateButterflies(dt) {
    const { w, h, t, u } = this;
    for (let i = 0; i < this.butterflies.length; i++) {
      const b = this.butterflies[i];
      if (b.perched) {
        b.rest -= dt;
        // perched: wings slowly open and close
        b.x = b.target.x;
        b.y = b.target.y - 1.2 * u;
        this.drawButterfly(b, 0.35 + 0.35 * Math.sin(t * 1.4 + b.flapPh));
        if (b.rest <= 0) {
          b.perched = false;
          // now and then one drifts off out of the garden (and another comes in)
          b.target = Math.random() < 0.85 ? this.pickFlower(b) : { x: b.x < w / 2 ? -80 : w + 80, y: rand(0.3, 0.6) * h, away: true };
        }
        continue;
      }
      if (!b.target) b.target = this.pickFlower(b) || { x: w / 2, y: h / 2, away: true };
      const tx = b.target.x;
      const ty = b.target.away ? b.target.y : b.target.y - 1.2 * u;
      const dx = tx - b.x;
      const dy = ty - b.y;
      const d = Math.hypot(dx, dy) || 1;
      const speed = (24 + 30 * (1 - b.look.glide)) * u * 0.25;
      b.wob += dt * 3;
      b.vx = (dx / d) * speed + Math.sin(b.wob) * speed * 0.6;
      b.vy = (dy / d) * speed + Math.cos(b.wob * 1.3) * speed * 0.8;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.flapPh += dt * b.look.flap * TAU;
      const glide = Math.sin(t * 0.7 + i) > 1 - b.look.glide * 1.2;
      this.drawButterfly(b, glide ? 0.9 : Math.abs(Math.cos(b.flapPh)));
      if (d < 2 * u && !b.target.away) {
        b.perched = true;
        b.rest = rand(2, 9);
      }
      if (b.x < -60 || b.x > w + 60 || b.y < -60 || b.y > h + 60) this.butterflies[i] = this.newButterfly(b.kind, false);
    }
  }

  updateDragonflies(dt) {
    const { g, w, h, t, u } = this;
    for (const d of this.dragonflies) {
      d.hold -= dt;
      if (d.hold <= 0) {
        // dart to a new hover point
        d.tx = rand(0.08, 0.92) * w;
        d.ty = rand(0.38, 0.72) * h;
        d.hold = rand(1.2, 4.5);
      }
      const k = Math.min(1, dt * 6);
      d.x += (d.tx - d.x) * k + Math.sin(t * 9 + d.ty) * 0.15 * u;
      d.y += (d.ty - d.y) * k + Math.cos(t * 11 + d.tx) * 0.12 * u;
      d.ang = Math.atan2(d.ty - d.y, d.tx - d.x);
      g.save();
      g.translate(d.x, d.y);
      g.rotate(Math.abs(d.tx - d.x) > 2 ? d.ang : 0);
      g.strokeStyle = d.color;
      g.lineWidth = 0.55 * u;
      g.beginPath();
      g.moveTo(-3.8 * u, 0);
      g.lineTo(1.2 * u, 0);
      g.stroke();
      g.fillStyle = d.color;
      g.beginPath();
      g.arc(1.6 * u, 0, 0.6 * u, 0, TAU);
      g.fill();
      const flick = 0.75 + 0.25 * Math.sin(t * 60);
      g.fillStyle = d.wing;
      for (const sy of [-1, 1]) {
        g.beginPath();
        g.ellipse(0.4 * u, sy * 1.5 * u * flick, 0.55 * u, 1.7 * u, sy * 0.3, 0, TAU);
        g.ellipse(-0.6 * u, sy * 1.4 * u * flick, 0.5 * u, 1.5 * u, -sy * 0.3, 0, TAU);
        g.fill();
      }
      if (d.bands) {
        g.fillStyle = 'rgba(90,50,20,0.6)';
        g.fillRect(-0.2 * u, -2.6 * u, 0.4 * u, 5.2 * u);
      }
      g.restore();
    }
  }

  updateHummers(dt) {
    const { g, w, t } = this;
    this.hummers = this.hummers.filter((m) => m.x > -30 && m.x < w + 30 && !(t > m.leaveBy && m.left));
    for (const m of this.hummers) {
      const u = this.u * m.size;
      let tx;
      let ty;
      if (t > m.leaveBy || !m.visits.length) {
        m.left = true;
        tx = m.dir > 0 ? w + 40 : -40;
        ty = m.y - 20 * u;
      } else {
        // hover with the bill in the flower
        const f = m.visits[0];
        if (Math.abs(f.x - m.x) > 6 * u) m.dir = f.x > m.x ? 1 : -1;
        tx = f.x - m.dir * 3.8 * u;
        ty = f.y + 0.3 * u;
        if (Math.hypot(tx - m.x, ty - m.y) < 1.5 * u) {
          m.hover += dt;
          if (m.hover > 1.2) {
            m.visits.shift();
            m.hover = 0;
          }
        }
      }
      const k = Math.min(1, dt * 7);
      m.x += (tx - m.x) * k;
      m.y += (ty - m.y) * k + Math.sin(t * 20) * 0.08 * u;
      g.save();
      g.translate(m.x, m.y);
      g.scale(m.dir, 1);
      g.fillStyle = '#2e8b57';
      g.beginPath();
      g.ellipse(0, 0, 1.8 * u, 0.9 * u, -0.35, 0, TAU);
      g.fill();
      g.fillStyle = '#c1121f';
      g.beginPath();
      g.arc(1.3 * u, 0.1 * u, 0.55 * u, 0, TAU);
      g.fill();
      g.fillStyle = '#2e8b57';
      g.beginPath();
      g.arc(1.6 * u, -0.5 * u, 0.6 * u, 0, TAU);
      g.fill();
      g.strokeStyle = '#222';
      g.lineWidth = 0.22 * u;
      g.beginPath();
      g.moveTo(2.1 * u, -0.5 * u);
      g.lineTo(4 * u, -0.3 * u);
      g.stroke();
      g.fillStyle = `rgba(220,235,240,${0.35 + 0.25 * Math.sin(t * 80)})`;
      g.beginPath();
      g.ellipse(-0.2 * u, -1.3 * u, 0.7 * u, 1.9 * u, -0.5, 0, TAU);
      g.fill();
      g.fillStyle = '#245c3c';
      g.beginPath();
      g.moveTo(-1.6 * u, 0.2 * u);
      g.lineTo(-3 * u, 0.8 * u);
      g.lineTo(-2.8 * u, -0.1 * u);
      g.closePath();
      g.fill();
      g.restore();
    }
  }

  drawBird(b) {
    const { g, t, u } = this;
    const L = b.look;
    const singing = t < b.until;
    const s = 1.9 * u * (L.size || 1);
    const fade = Math.min(1, (b.gone - t) / 1.5, (t - b.sing + 0.8) / 0.8);
    const hop = singing ? Math.abs(Math.sin(t * 9)) * 0.3 * u : 0;
    g.save();
    g.globalAlpha = Math.max(0, fade);
    g.translate(b.spot.x, b.spot.y - hop);
    // a woodpecker clings to the trunk head-up; anyone else faces where it's singing to
    if (b.spot.trunk) g.rotate(-Math.PI / 2.3);
    else if (b.flip) g.scale(-1, 1);
    // tail
    g.fillStyle = L.wing;
    g.beginPath();
    g.moveTo(-s * 0.8, -s * 0.6);
    g.lineTo(-s * (1.9 + (L.tail || 1) * 0.6), L.cock ? -s * 1.9 : -s * 0.15);
    g.lineTo(-s * (1.7 + (L.tail || 1) * 0.6), L.cock ? -s * 1.5 : -s * 0.5);
    g.closePath();
    g.fill();
    // body and wing
    g.fillStyle = L.body;
    g.beginPath();
    g.ellipse(0, -s * 0.8, s * 1.1, s * 0.75, -0.15, 0, TAU);
    g.fill();
    if (L.flank) {
      g.fillStyle = L.flank;
      g.beginPath();
      g.ellipse(s * 0.1, -s * 0.55, s * 0.5, s * 0.3, 0, 0, TAU);
      g.fill();
    }
    g.fillStyle = L.wing;
    g.beginPath();
    g.ellipse(-s * 0.2, -s * 0.95, s * 0.75, s * 0.42, -0.25, 0, TAU);
    g.fill();
    if (L.bars) {
      g.strokeStyle = '#f2efe6';
      g.lineWidth = s * 0.1;
      for (let k = -3; k <= 2; k++) {
        g.beginPath();
        g.moveTo(k * s * 0.2 - s * 0.3, -s * 1.25);
        g.lineTo(k * s * 0.2 - s * 0.1, -s * 0.7);
        g.stroke();
      }
    }
    if (L.patch) {
      g.fillStyle = L.patch;
      g.fillRect(-s * 0.35, -s * 1.05, s * 0.35, s * 0.14);
    }
    // head
    g.fillStyle = L.head;
    g.beginPath();
    g.arc(s * 0.85, -s * 1.45, s * 0.5, 0, TAU);
    g.fill();
    if (L.crest) {
      g.beginPath();
      g.moveTo(s * 0.55, -s * 1.75);
      g.lineTo(s * 0.45, -s * 2.35);
      g.lineTo(s * 1.0, -s * 1.85);
      g.closePath();
      g.fill();
    }
    if (L.mask) {
      g.fillStyle = '#1a1a1a';
      g.beginPath();
      g.arc(s * 1.15, -s * 1.42, s * 0.22, 0, TAU);
      g.fill();
    }
    if (L.brow) {
      g.strokeStyle = '#f4ead8';
      g.lineWidth = s * 0.12;
      g.beginPath();
      g.moveTo(s * 0.6, -s * 1.62);
      g.lineTo(s * 1.25, -s * 1.55);
      g.stroke();
    }
    g.fillStyle = '#111';
    g.beginPath();
    g.arc(s * 1.05, -s * 1.52, s * 0.08, 0, TAU);
    g.fill();
    g.fillStyle = L.beak;
    g.beginPath();
    g.moveTo(s * 1.28, -s * 1.52);
    g.lineTo(s * 1.75, singing ? -s * 1.6 : -s * 1.45);
    g.lineTo(s * 1.28, -s * 1.36);
    g.closePath();
    g.fill();
    g.restore();
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

const PAINTINGS = { storm: Storm, waterfall: Waterfall, garden: Garden, butterfly: Butterfly, mansion: Mansion, snow: Snow, mixer: Blank };

export function createPainting(id, canvas, engine) {
  const P = PAINTINGS[id] || Blank;
  return new P(canvas, engine);
}

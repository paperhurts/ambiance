// Scene paintings. Each scene is a quiet, slowly moving picture drawn on one canvas.
// Static parts are painted once per resize into an offscreen layer; only the living parts
// (rain, water, snow, light) are redrawn, at most 30 times a second, and nothing is drawn
// while the page is hidden or dimmed.

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

// a colour as [r, g, b], from '#rrggbb' or 'rgb(r,g,b)' (so mixes can be mixed again)
function hex(c) {
  if (c[0] !== '#') return c.match(/[\d.]+/g).slice(0, 3).map(Number);
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
  tropical: { h: [13, 17], spread: 13, n: [2, 3], R: 3.3, leaf: 'oval', green: '#3f7a35', tube: true, shrub: true, gloss: true }, // tropical hibiscus
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
  firebush: { h: [15, 19], spread: 13, n: [6, 9], R: 1.4, leaf: 'oval', green: '#2f5a33', tube: true, shrub: true, bronze: true },
  spiderwort: { h: [6, 8], spread: 8, n: [4, 7], R: 1.1, leaf: 'grass', green: '#4a7f5a' },
  mimosa: { h: [1.5, 2.5], spread: 13, n: [6, 10], R: 0.9, leaf: 'fern', green: '#5b8a45', mat: true }, // sunshine mimosa
};
const HUE = { tropical: 'sunset', hibiscus: 'red', sage: 'red', firebush: 'red', gaillardia: 'red', milkweed: 'orange', coreopsis: 'yellow', susan: 'yellow', needles: 'white', rosemallow: 'pink', swampmilkweed: 'pink', mimosa: 'pink', porterweed: 'blue', spiderwort: 'blue', liatris: 'purple', passionflower: 'purple' };

// Tropical hibiscus: salmon; yellow with a deep red eye; coral with a dark eye and gold edges.
const TROPICAL = [
  { petal: '#f37d4a', eye: '#e0552c', eyeSize: 0.12, edge: '#fb9d66', vein: 'rgba(196,70,30,0.15)', column: ['#e2532c', '#f68a4e'], pollen: '#f6c31a', stigma: '#e3111e' },
  { petal: '#f6cd1a', eye: '#8e0f2b', eyeSize: 0.34, edge: '#fadc40', vein: 'rgba(180,130,0,0.15)', column: ['#b3122f', '#fbeae4'], pollen: '#f8b61e', stigma: '#f28a10' },
  { petal: '#e84e3a', eye: '#5c0a1b', eyeSize: 0.32, edge: '#f4a64a', vein: 'rgba(255,236,226,0.35)', column: ['#c61d35', '#ea4a5c'], pollen: '#f2c01a', stigma: '#ec5216' },
];

// Florida butterflies, and the flowers each likes best.
const BUTTERFLIES = {
  zebra: { wing: '#141414', mark: '#f7e27a', size: 1.15, flap: 5, glide: 0.5, shape: 'long', likes: ['passionflower', 'firebush', 'porterweed'] }, // zebra longwing, the state butterfly
  monarch: { wing: '#e8741a', mark: '#151515', size: 1.1, flap: 6, glide: 0.4, shape: 'round', dots: true, likes: ['milkweed', 'swampmilkweed', 'liatris'] },
  fritillary: { wing: '#f2711c', mark: '#2a1a10', size: 0.95, flap: 8, glide: 0.25, shape: 'round', spots: true, likes: ['passionflower', 'needles', 'porterweed'] }, // gulf fritillary
  sulphur: { wing: '#ffe23d', mark: '#e0b400', size: 0.9, flap: 10, glide: 0.1, shape: 'round', likes: ['hibiscus', 'tropical', 'sage', 'firebush'] }, // cloudless sulphur
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
function flower(g, kind, x, y, R, r, variant = 0) {
  g.save();
  g.translate(x, y);
  g.lineCap = 'round';
  const spin = r() * TAU;
  const tilt = 0.7 + r() * 0.3; // seen a little from the side
  switch (kind) {
    case 'tropical': {
      // tropical hibiscus: five broad, ruffled, overlapping petals around a dark eye, and a long
      // column dusted with pollen, tipped with five round stigma pads
      const v = TROPICAL[variant % TROPICAL.length];
      g.save();
      g.scale(1, tilt);
      g.rotate(spin);
      for (let k = 0; k < 5; k++) {
        g.rotate(TAU / 5);
        // a broad lobe with a ruffled rim, narrowing to the notches between petals
        const petal = new Path2D();
        petal.moveTo(0, 0);
        for (let i = 0; i <= 18; i++) {
          const a = -0.74 + (1.48 * i) / 18;
          const rr = R * (0.55 + 0.45 * Math.cos(a * 1.9)) * (1 + 0.035 * Math.sin(i * 2.3 + k * 1.7));
          petal.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        petal.closePath();
        const gr = g.createRadialGradient(0, 0, 0, 0, 0, R);
        gr.addColorStop(0, v.eye);
        gr.addColorStop(v.eyeSize, v.eye);
        gr.addColorStop(Math.min(0.9, v.eyeSize + 0.14), v.petal);
        gr.addColorStop(0.86, v.petal);
        gr.addColorStop(1, v.edge);
        g.fillStyle = gr;
        g.fill(petal);
        // shade one side, so each petal shows where it overlaps the next
        g.save();
        g.clip(petal);
        const sh = g.createLinearGradient(0, -R, 0, R);
        sh.addColorStop(0, 'rgba(0,0,0,0)');
        sh.addColorStop(0.55, 'rgba(0,0,0,0)');
        sh.addColorStop(1, 'rgba(60,10,0,0.2)');
        g.fillStyle = sh;
        g.fillRect(0, -R, R * 1.1, 2 * R);
        g.restore();
        g.strokeStyle = v.vein;
        g.lineWidth = R * 0.012;
        for (let j = -1; j <= 1; j++) {
          g.beginPath();
          g.moveTo(R * 0.14, 0);
          g.lineTo(Math.cos(j * 0.28) * R * 0.7, Math.sin(j * 0.28) * R * 0.7);
          g.stroke();
        }
      }
      g.restore();
      const ex = R * 0.6;
      const ey = -R * 0.42;
      const cg = g.createLinearGradient(0, 0, ex, ey);
      cg.addColorStop(0, v.column[0]);
      cg.addColorStop(1, v.column[1]);
      g.strokeStyle = cg;
      g.lineWidth = R * 0.07;
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(ex * 0.45, ey * 0.15, ex, ey);
      g.stroke();
      g.fillStyle = v.pollen;
      for (let i = 0; i < 22; i++) {
        const t = 0.6 + r() * 0.32;
        const px = 2 * (1 - t) * t * ex * 0.45 + t * t * ex;
        const py = 2 * (1 - t) * t * ey * 0.15 + t * t * ey;
        g.beginPath();
        g.arc(px + (r() - 0.5) * R * 0.14, py + (r() - 0.5) * R * 0.14, R * 0.035, 0, TAU);
        g.fill();
      }
      g.fillStyle = v.stigma;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        g.beginPath();
        g.arc(ex + R * 0.04 + Math.cos(a) * R * 0.06, ey - R * 0.05 + Math.sin(a) * R * 0.06, R * 0.045, 0, TAU);
        g.fill();
      }
      break;
    }
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
function plant(fg, x, y, kind, s, r, variant = 0) {
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
    // a rounded crown, darker inside (firebush shows bronze new growth on top, hibiscus is glossy)
    for (let i = 0; i < 120; i++) {
      let lx;
      let ly;
      do {
        lx = (r() * 2 - 1) * W * 0.5;
        ly = -r() * H;
      } while ((lx / (W * 0.5)) ** 2 + ((ly + H * 0.55) / (H * 0.5)) ** 2 > 1);
      const k = -ly / H;
      const col = F.bronze && k > 0.8 && r() < 0.35 ? '#8a3a26' : shade(lerp(-0.5, F.gloss ? 0.4 : 0.25, k) + (r() - 0.5) * 0.2);
      leaf(g, 'oval', lx, ly, s * (0.9 + r() * 0.5) * (F.gloss ? 1.25 : 1), r() * TAU, col);
    }
    if (F.gloss) {
      // light catching the shiny leaves, and a few tight buds
      g.fillStyle = 'rgba(255,255,255,0.16)';
      for (let i = 0; i < 16; i++) {
        g.beginPath();
        g.ellipse((r() - 0.5) * W * 0.7, -H * (0.4 + r() * 0.5), s * 0.9, s * 0.25, r() * TAU, 0, TAU);
        g.fill();
      }
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI * (0.15 + 0.7 * r());
        const bx = Math.cos(a) * W * 0.47;
        const by = -H * 0.55 + Math.sin(a) * H * 0.5;
        g.save();
        g.translate(bx, by);
        g.rotate(a + Math.PI / 2);
        g.fillStyle = '#5c8f3a';
        g.beginPath();
        g.ellipse(0, -s * 0.9, s * 0.45, s * 1.1, 0, 0, TAU);
        g.fill();
        g.fillStyle = TROPICAL[variant % TROPICAL.length].petal;
        g.beginPath();
        g.ellipse(0, -s * 1.7, s * 0.22, s * 0.45, 0, 0, TAU);
        g.fill();
        g.restore();
      }
    }
    for (let i = 0; i < n; i++) {
      const a = -Math.PI * (0.06 + 0.88 * r());
      // hibiscus blooms sit all over the top of the bush; firebush clusters ring its edge
      const k = F.gloss ? 0.45 + 0.45 * r() : 1;
      heads.push({ dx: Math.cos(a) * W * 0.44 * k, dy: -H * 0.55 + Math.sin(a) * H * 0.46 * k, R: R * (0.85 + r() * 0.3) });
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
  for (const hd of heads) flower(g, kind, hd.dx, hd.dy, hd.R, r, variant);
  // on a spike, butterflies and hummingbirds feed partway up it
  if (spike) for (const hd of heads) hd.dy -= hd.R * F.spike * 0.6;
  return trim({ c, ax, ay, heads, top: -H });
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

// Crop a sprite to what was actually drawn, keeping its anchor: transparent margins still cost
// time every frame once the sprite is rotated.
function trim(sp) {
  const { c } = sp;
  const { data, width: W, height: H } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
  let x0 = W;
  let y0 = H;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * 4 + 3] > 4) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return sp;
  const out = layer(x1 - x0 + 1, y1 - y0 + 1);
  out.getContext('2d').drawImage(c, -x0, -y0);
  return { ...sp, c: out, ax: sp.ax - x0, ay: sp.ay - y0 };
}

// A beard of Spanish moss: a tangled, nest-like clump on the branch, with curly, kinked strands
// falling from it and thinning to a few long wisps. Painted once into a sprite that sways from
// the branch.
const MOSS = [
  ['rgba(98,108,92,0.75)', 0.2, 16],
  ['rgba(158,168,148,0.9)', 0.19, 20],
  ['rgba(201,208,190,0.9)', 0.17, 18],
  ['rgba(228,232,220,0.9)', 0.13, 6],
];
function mossBeard(L, W, u, r, pal = MOSS) {
  const pad = 2 * u;
  const cw = Math.ceil(W * 1.6 + pad * 2);
  const ch = Math.ceil(L * 1.12 + pad * 2);
  const c = layer(cw, ch);
  const g = c.getContext('2d');
  const ax = cw / 2;
  const ay = pad + L * 0.06;
  g.translate(ax, ay);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const step = 0.55 * u;
  // widest just under the clump, tapering to a point
  const half = (y) => (W / 2) * Math.max(0.08, 1 - Math.max(0, y) / L) ** 0.8;
  const strand = (x, y, len, curl) => {
    let th = Math.PI / 2 + (r() - 0.5) * 1.2;
    let loop = 0;
    let turn = 0;
    g.beginPath();
    g.moveTo(x, y);
    let px = x;
    let py = y;
    for (let d = 0; d < len; d += step) {
      if (loop > 0) {
        // curling round in a little loop
        th += turn;
        loop--;
      } else {
        if (r() < curl) {
          loop = 8 + Math.floor(r() * 8);
          turn = (r() < 0.5 ? -1 : 1) * (0.35 + r() * 0.3);
        }
        th += (r() - 0.5) * 0.9;
        // gravity pulls it back toward hanging straight down
        th += Math.atan2(Math.sin(Math.PI / 2 - th), Math.cos(Math.PI / 2 - th)) * 0.08;
        const lim = half(y);
        if (x > lim) th += 0.35;
        else if (x < -lim) th -= 0.35;
      }
      x += Math.cos(th) * step;
      y += Math.sin(th) * step;
      g.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2);
      px = x;
      py = y;
    }
    g.lineTo(px, py);
    g.stroke();
  };
  // back to front: shadowed strands, then lighter ones, then the silvery highlights
  for (const [col, lw, n] of pal) {
    g.strokeStyle = col;
    g.lineWidth = lw * u;
    for (let i = 0; i < n; i++) strand((r() - 0.5) * W * 0.8, r() * L * 0.1, L * (0.25 + 0.75 * r() ** 0.9), 0.025);
  }
  // the tangle on the branch
  for (let i = 0; i < 22; i++) {
    g.strokeStyle = pal[1 + (i % 3)][0];
    g.lineWidth = 0.17 * u;
    strand((r() - 0.5) * W * 0.9, -L * 0.04 + r() * L * 0.08, (3 + r() * 6) * u, 0.15);
  }
  return trim({ c, ax, ay });
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
    // the scenery as last drawn (see frame)
    this.still = layer(w, h);
    this.sg = this.still.getContext('2d');
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
      { y: 0.765, sc: 1.15, gap: 10.5, must: ['rosemallow', 'swampmilkweed', 'porterweed', 'liatris', 'passionflower', 'susan'], pool: all.filter((k) => !['firebush', 'mimosa', 'tropical'].includes(k)) },
      { y: 0.865, sc: 1.6, gap: 14, must: ['tropical', 'hibiscus', 'milkweed', 'coreopsis', 'gaillardia'], pool: all.filter((k) => k !== 'firebush' && k !== 'tropical') },
      // the nearest bed, cut off by the bottom of the screen
      { y: 0.985, sc: 2.2, gap: 19, must: ['tropical', 'tropical', 'milkweed', 'needles'], pool: ['milkweed', 'coreopsis', 'gaillardia', 'needles', 'mimosa', 'spiderwort', 'susan', 'swampmilkweed', 'hibiscus', 'rosemallow'] },
    ];
    this.plants = [];
    this.heads = [];
    let tropicals = 0; // each hibiscus bush gets the next of the three colours
    rows.forEach((row, ri) => {
      const n = Math.ceil(w / (row.gap * u)) + 1;
      const kinds = arrange(row.pool, n, r, row.must);
      // the hibiscus go where they'll be seen: spread along the bed, in from the edges
      const hib = kinds.filter((k) => k === 'tropical').length;
      if (hib) {
        const rest = kinds.filter((k) => k !== 'tropical');
        for (const f of [[0.5], [0.3, 0.72], [0.2, 0.5, 0.8]][Math.min(hib, 3) - 1]) rest.splice(Math.round(f * (n - 1)), 0, 'tropical');
        kinds.splice(0, n, ...rest.slice(0, n));
      }
      bedBand(g, w, h * row.y, row.sc * u, r);
      for (let i = 0; i < n; i++) {
        const x = ((i + (r() - 0.5) * 0.6) / (n - 1)) * w;
        const y = h * row.y + (r() - 0.5) * h * 0.012;
        const F = FLORA[kinds[i]];
        const variant = kinds[i] === 'tropical' ? tropicals++ : 0;
        const p = { x, y, row: ri, kind: kinds[i], ph: r() * TAU, cos: 1, sin: 0, flex: F.shrub ? 0.008 : F.mat ? 0.004 : 0.016 + r() * 0.012, ...plant(g, x, y, kinds[i], row.sc * u, r, variant) };
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
    const trunk = (t) => [(1 - t) ** 2 * ox + 2 * (1 - t) * t * (ox + w * 0.05) + t * t * (ox + w * 0.06), (1 - t) ** 2 * h + 2 * (1 - t) * t * oy + t * t * h * 0.32];
    // rough, furrowed bark with pale patches of lichen
    for (let i = 0; i < 90; i++) {
      const [x, y] = trunk(r());
      const dx = (r() - 0.5) * 4 * u;
      if (i % 3) {
        g.strokeStyle = 'rgba(38,28,20,0.6)';
        g.lineWidth = 0.35 * u;
        g.beginPath();
        g.moveTo(x + dx, y);
        g.lineTo(x + dx + (r() - 0.5) * 0.6 * u, y + (1 + r() * 2) * u);
        g.stroke();
      } else {
        g.fillStyle = 'rgba(176,190,166,0.45)';
        g.beginPath();
        g.ellipse(x + dx, y, (0.4 + r() * 0.6) * u, (0.3 + r() * 0.4) * u, 0, 0, TAU);
        g.fill();
      }
    }
    // a shelf fungus on the trunk: pale on top, banded brown underneath
    for (const [t, sz] of [[0.72, 1], [0.67, 0.6]]) {
      const [x, y] = trunk(t);
      const fx = x + 2.2 * u + sz * 1.6 * u;
      g.fillStyle = '#6e4f34';
      g.beginPath();
      g.ellipse(fx, y, 3.2 * u * sz, 1.3 * u * sz, 0, 0, Math.PI);
      g.fill();
      g.fillStyle = '#d9d0bd';
      g.beginPath();
      g.ellipse(fx, y, 3.2 * u * sz, 0.7 * u * sz, 0, Math.PI, TAU);
      g.fill();
      g.strokeStyle = '#a58a66';
      g.lineWidth = 0.25 * u;
      g.beginPath();
      g.ellipse(fx, y + 0.15 * u, 3 * u * sz, 0.9 * u * sz, 0, 0.15, Math.PI - 0.15);
      g.stroke();
    }
    const limbs = [
      [ox + w * 0.06, h * 0.36, w * 0.36, h * 0.3],
      [ox + w * 0.05, h * 0.45, w * 0.3, h * 0.44],
      [ox + w * 0.06, h * 0.3, w * 0.22, h * 0.17],
    ];
    g.strokeStyle = '#4b3b2b';
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
    // Spanish moss: clumps on the limbs with beards hanging from them, and some from twigs out in
    // the canopy; they're sprites so they can sway (see frame)
    this.moss = [];
    const beard = (x, y, L, W) => this.moss.push({ x, y, ph: r() * TAU, flex: L / (20 * u), ...mossBeard(L, W, u, r) });
    for (const [x0, y0, x1, y1] of limbs) {
      const cx = (x0 + x1) / 2;
      const cy = Math.min(y0, y1) - h * 0.03;
      for (let k = 0; k < 5; k++) {
        const t = 0.2 + k * 0.18 + (r() - 0.5) * 0.08;
        beard((1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * x1, (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t * t * y1, (14 + r() * 26) * u, (2.5 + r() * 2.5) * u);
      }
    }
    for (let i = 0; i < 6; i++) beard(ox + w * (0.1 + r() * 0.3), h * (0.2 + r() * 0.18), (8 + r() * 16) * u, (1.8 + r() * 2) * u);
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
    const { g, t, u } = this;
    // The slow-moving scenery (clouds, the hawk, the oak and its moss, the palms, the swaying beds)
    // is redrawn about 15 times a second; everything that flits is drawn every frame.
    this.age = (this.age ?? 1) + dt;
    if (this.age >= 0.06 || !dt) {
      const main = this.g;
      this.g = this.sg;
      this.scenery(this.age);
      this.g = main;
      this.age = 0;
    }
    g.drawImage(this.still, 0, 0);
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

  scenery(dt) {
    const { g, w, t, u } = this;
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
    // the moss swings a little from its branches, and leans with the breeze
    for (const m of this.moss) {
      const a = (Math.sin(t * 0.8 + m.ph) * (0.015 + breeze * 0.035) - breeze * 0.03) * m.flex;
      const c = Math.cos(a);
      const s = Math.sin(a);
      g.setTransform(c, s, -s, c, m.x, m.y);
      g.drawImage(m.c, -m.ax, -m.ay);
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
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
// A summer thunderstorm over the Everglades. Sawgrass to the horizon, cypress domes and tree
// islands. A thunderhead builds ahead, comes overhead with the downpour and moves off again; then
// the low sun behind us lights the wet prairie gold, with a rainbow over the departing storm.

// a cumulonimbus: a towering, cauliflowered body on a broad, flat base, under an anvil that
// spreads downwind. The tower is a crowd of billows with smaller ones boiling out of them, lit as
// one surface: each pixel takes the billow nearest us there and is shaded by the sun on it, so
// billows merge into creases rather than sitting there as separate balls. Shading is worked out
// at a fraction of the size (it's soft anyway) and drawn back inside the crisp outline. One
// shape, painted twice (sunlit and in shadow) so the storm can darken by crossfading.
function cumulonimbus(W, H, r) {
  const baseY = H * 0.86;
  const lobes = [];
  // the tower: broad billows low down, smaller and tighter toward the top, leaning downwind
  for (let i = 0; i < 70; i++) {
    const t = r() ** 0.8;
    const rad = W * (0.055 + r() * 0.05) * (1 - t * 0.45);
    lobes.push({ x: W * 0.5 + (r() * 2 - 1) * W * (0.27 - t * 0.12) + t * W * 0.04, y: lerp(baseY - H * 0.05, H * 0.27, t), r: rad });
  }
  // the broad, flat base
  for (let x = W * 0.22; x <= W * 0.78; x += W * 0.04) lobes.push({ x: x + (r() - 0.5) * W * 0.02, y: baseY - H * 0.015, r: W * (0.05 + r() * 0.03) });
  // depth: the middle of the tower bulges toward us, its sides curve away
  for (const p of lobes) p.z = p.r * (-0.5 + 0.4 * (1 - Math.min(1, Math.abs(p.x - W * 0.5) / (W * 0.3))) + r() * 0.15);
  // cauliflower: small billows boiling out of the big ones, mostly on top and on the sunny side
  const big = lobes.length;
  for (let i = 0; i < 70; i++) {
    const p = lobes[Math.floor(r() * big)];
    const a = -Math.PI * (0.08 + r() * 0.84) - (r() < 0.3 ? 0.35 : 0);
    const d = p.r * (0.5 + r() * 0.3);
    const sr = p.r * (0.3 + r() * 0.22);
    lobes.push({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, r: sr, z: p.z + Math.sqrt(Math.max(0, p.r * p.r - d * d)) - sr * 0.6 });
  }
  const anvil = new Path2D();
  anvil.moveTo(W * 0.34, H * 0.32);
  anvil.bezierCurveTo(W * 0.26, H * 0.22, W * 0.3, H * 0.12, W * 0.45, H * 0.1);
  anvil.bezierCurveTo(W * 0.62, H * 0.085, W * 0.85, H * 0.095, W * 0.99, H * 0.115);
  anvil.bezierCurveTo(W * 1.01, H * 0.125, W * 0.99, H * 0.155, W * 0.92, H * 0.16);
  anvil.bezierCurveTo(W * 0.78, H * 0.17, W * 0.66, H * 0.2, W * 0.6, H * 0.32);
  anvil.closePath();
  const outline = new Path2D();
  for (const p of lobes) {
    outline.moveTo(p.x + p.r, p.y);
    outline.arc(p.x, p.y, p.r, 0, TAU);
  }
  // the cloud's surface, at low resolution: the billows blended where they meet (a soft maximum
  // of their heights), so creases are soft folds rather than seams; then lit by its slope
  const S = Math.max(2, Math.round(W / 320));
  const w3 = Math.ceil(W / S);
  const h3 = Math.ceil(H / S);
  const K = 2.4; // how soft the folds are, in low-res pixels
  const acc = new Float64Array(w3 * h3);
  for (const p of lobes) {
    const cx = p.x / S;
    const cy = p.y / S;
    const rr = p.r / S;
    const reach = rr + 1.5; // a little past the edge, so the crisp outline never shows a gap
    for (let y = Math.max(0, Math.floor(cy - reach)); y <= Math.min(h3 - 1, Math.ceil(cy + reach)); y++) {
      for (let x = Math.max(0, Math.floor(cx - reach)); x <= Math.min(w3 - 1, Math.ceil(cx + reach)); x++) {
        const d2 = (x - cx) ** 2 + (y - cy) ** 2;
        if (d2 > reach * reach) continue;
        acc[y * w3 + x] += Math.exp((p.z / S + Math.sqrt(Math.max(0, rr * rr - d2))) / K);
      }
    }
  }
  const hf = new Float32Array(w3 * h3).map((_, i) => (acc[i] > 0 ? K * Math.log(acc[i]) : NaN));
  const light = new Float32Array(w3 * h3);
  const [lx, ly, lz] = [-0.5, -0.62, 0.6];
  for (let y = 0; y < h3; y++) {
    for (let x = 0; x < w3; x++) {
      const i = y * w3 + x;
      const c = hf[i];
      if (Number.isNaN(c)) continue;
      // past the edge the surface falls steeply away: that's the cloud's rounded limb
      const e = x + 1 < w3 ? hf[i + 1] : NaN;
      const wv = x > 0 ? hf[i - 1] : NaN;
      const sv = y + 1 < h3 ? hf[i + w3] : NaN;
      const nv = y > 0 ? hf[i - w3] : NaN;
      const gx = ((Number.isNaN(e) ? c - 4 : e) - (Number.isNaN(wv) ? c - 4 : wv)) / 2;
      const gy = ((Number.isNaN(sv) ? c - 4 : sv) - (Number.isNaN(nv) ? c - 4 : nv)) / 2;
      const n = Math.hypot(gx, gy, 1);
      // clouds scatter light into their own shadows, so the dark side never goes black
      light[i] = 0.32 + 0.68 * Math.max(0, ((-gx * lx - gy * ly + lz) / n + 0.25) / 1.25);
    }
  }
  const top = hf.map((v) => (Number.isNaN(v) ? -1e9 : v));
  const paint = (pal) => {
    const lut = Array.from({ length: 256 }, (_, k) => hex(ramp(pal.ramp, k / 255)));
    const small = layer(w3, h3);
    const sg = small.getContext('2d');
    const img = sg.createImageData(w3, h3);
    for (let y = 0; y < h3; y++) {
      // the lower cloud sits in its own shadow, darkest at the base
      const v = clamp((y * S - H * 0.4) / (baseY - H * 0.4), 0, 1);
      const dim = 1 - pal.under * v ** 1.3;
      for (let x = 0; x < w3; x++) {
        const i = y * w3 + x;
        if (top[i] < -1e8) continue;
        const c = lut[Math.round(clamp(light[i] * dim, 0, 1) * 255)];
        const o = i * 4;
        img.data[o] = c[0];
        img.data[o + 1] = c[1];
        img.data[o + 2] = c[2];
        img.data[o + 3] = 255;
      }
    }
    sg.putImageData(img, 0, 0);
    const c = layer(W, H);
    const g = c.getContext('2d');
    g.save();
    g.beginPath();
    g.rect(0, 0, W, baseY);
    g.clip();
    // the anvil: smooth, pale on top, its underside in the shadow of itself
    g.fillStyle = vgrad(g, H * 0.08, H * 0.32, [
      [0, ramp(pal.ramp, 0.97)],
      [0.55, ramp(pal.ramp, 0.75)],
      [1, ramp(pal.ramp, 0.42)],
    ]);
    g.fill(anvil);
    g.clip(outline);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(small, 0, 0, w3 * S, h3 * S);
    g.restore();
    // ice streaming off the far end of the anvil
    g.strokeStyle = pal.wisp;
    g.lineWidth = H * 0.004;
    for (let i = 0; i < 14; i++) {
      const y = H * (0.11 + r() * 0.06);
      g.beginPath();
      g.moveTo(W * (0.85 + r() * 0.08), y);
      g.quadraticCurveTo(W * 0.97, y + H * 0.005, W, y + H * (0.01 + r() * 0.02));
      g.stroke();
    }
    return c;
  };
  return {
    lit: paint({ ramp: [[0, '#5d6878'], [0.4, '#99a5b3'], [0.7, '#dde2e7'], [1, '#ffffff']], under: 0.5, wisp: 'rgba(240,240,236,0.5)' }),
    dark: paint({ ramp: [[0, '#171c23'], [0.4, '#353d48'], [0.7, '#5d6672'], [1, '#929ba6']], under: 0.55, wisp: 'rgba(120,130,140,0.4)' }),
  };
}

// A bald cypress: a straight trunk flaring into buttresses at the waterline, knees poking up
// round it, rising limbs carrying flat, feathery masses of foliage. Returns the places where
// Spanish moss can hang.
function baldCypress(g, x, y, ht, u, r, o = {}) {
  const near = o.near;
  const bark = o.bark ?? '#6c645a';
  const tw = o.trunk ?? ht * 0.035; // half the trunk's width above the buttress
  const flare = tw * (near ? 3 : 2.3);
  const topX = x + (o.lean ?? (r() - 0.5) * 0.04) * ht;
  const topY = y - ht;
  const at = (k) => lerp(x, topX, k);
  const water = (fn) => {
    if (!o.water) return;
    g.save();
    g.clip(o.water);
    fn();
    g.restore();
  };
  // its reflection, under everything, kept to the water
  water(() => {
    g.fillStyle = 'rgba(40,46,40,0.35)';
    g.beginPath();
    g.moveTo(x - flare, y);
    g.quadraticCurveTo(x - tw * 1.1, y + ht * 0.04, x - tw, y + ht * 0.14);
    g.lineTo(x - tw * 0.85, y + ht * 0.3);
    g.lineTo(x + tw * 0.85, y + ht * 0.3);
    g.lineTo(x + tw, y + ht * 0.14);
    g.quadraticCurveTo(x + tw * 1.1, y + ht * 0.04, x + flare, y);
    g.fill();
  });
  // the trunk: bell-bottomed, then nearly straight, thinning where the crown begins
  const buttress = near ? 0.2 : 0.13;
  const trunk = new Path2D();
  trunk.moveTo(x - flare, y);
  trunk.bezierCurveTo(x - tw * 1.2, y - ht * 0.01, x - tw * 1.05, y - ht * buttress * 0.5, x - tw, y - ht * buttress);
  trunk.lineTo(topX - tw * 0.4, topY + ht * 0.05);
  trunk.lineTo(topX + tw * 0.4, topY + ht * 0.05);
  trunk.lineTo(x + tw, y - ht * buttress);
  trunk.bezierCurveTo(x + tw * 1.05, y - ht * buttress * 0.5, x + tw * 1.2, y - ht * 0.01, x + flare, y);
  trunk.closePath();
  g.fillStyle = bark;
  g.fill(trunk);
  g.save();
  g.clip(trunk);
  // afternoon light down the sunny side, shade down the other
  const lg = g.createLinearGradient(x - flare, 0, x + flare, 0);
  lg.addColorStop(0, 'rgba(0,0,0,0)');
  lg.addColorStop(0.3, 'rgba(225,212,190,0.28)');
  lg.addColorStop(0.5, 'rgba(0,0,0,0)');
  lg.addColorStop(0.8, 'rgba(30,24,20,0.3)');
  g.fillStyle = lg;
  g.fillRect(x - flare * 1.5, topY, flare * 3 + Math.abs(topX - x), ht + 2);
  // stringy, ridged bark, and the flutes of the buttress
  g.lineWidth = Math.max(0.5, tw * (near ? 0.05 : 0.1));
  for (let k = 0; k < (near ? 26 : 6); k++) {
    const f = (r() - 0.5) * 1.8;
    g.strokeStyle = r() < 0.5 ? 'rgba(40,34,28,0.35)' : 'rgba(200,188,166,0.2)';
    g.beginPath();
    g.moveTo(x + f * flare * 0.55, y);
    g.bezierCurveTo(x + f * tw * 0.7, y - ht * buttress * 0.6, x + f * tw * 0.5, y - ht * 0.3, at(0.8) + f * tw * 0.25, y - ht * 0.8);
    g.stroke();
  }
  g.restore();
  // knees: knobbly stumps poking up out of the water round the tree
  for (let i = 0; i < (o.knees ?? 0); i++) {
    const side = o.kneesSide ? (r() < 0.8 ? o.kneesSide : -o.kneesSide) : i % 2 ? 1 : -1;
    const kx = x + side * flare * (1.05 + r() * (near ? 1.8 : 2));
    const ky = y + (r() - 0.35) * (near ? 1.6 * u : flare * 0.3);
    const kh = near ? (1.6 + r() * 3) * u : ht * (0.02 + r() * 0.03);
    const kw = kh * (0.32 + r() * 0.12);
    const tip = (r() - 0.5) * kw * 0.6;
    water(() => {
      g.fillStyle = 'rgba(40,46,40,0.3)';
      g.beginPath();
      g.moveTo(kx - kw, ky);
      g.quadraticCurveTo(kx, ky + kh * 1.5, kx + kw, ky);
      g.fill();
    });
    g.fillStyle = bark;
    g.beginPath();
    g.moveTo(kx - kw, ky);
    g.bezierCurveTo(kx - kw * 0.75, ky - kh * 0.6, kx + tip - kw * 0.55, ky - kh * 1.05, kx + tip, ky - kh);
    g.bezierCurveTo(kx + tip + kw * 0.55, ky - kh * 1.05, kx + kw * 0.75, ky - kh * 0.6, kx + kw, ky);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(215,205,185,0.3)';
    g.beginPath();
    g.ellipse(kx + tip - kw * 0.15, ky - kh * 0.88, kw * 0.32, kh * 0.1, 0, 0, TAU);
    g.fill();
  }
  // limbs, rising from the upper trunk
  const greens = o.greens ?? ['#4a6531', '#58763a', '#678545', '#7d9a52'];
  const limbs = [];
  const n = o.limbs ?? 5;
  for (let i = 0; i < n; i++) {
    const k = (o.from ?? 0.45) + (i / n) * (0.95 - (o.from ?? 0.45)) + (r() - 0.5) * 0.06;
    const dir = o.side ? (r() < 0.2 ? -o.side : o.side) : i % 2 ? 1 : -1;
    const len = ht * (0.12 + r() * 0.12) * (o.reach ?? 1) * (1 - k * 0.4);
    const rise = 0.25 + r() * 0.45;
    const x0 = at(k);
    const y0 = y - ht * k;
    const x1 = x0 + dir * len;
    const y1 = y0 - len * rise;
    const mx = lerp(x0, x1, 0.45);
    const my = lerp(y0, y1, 0.45) + len * 0.06;
    g.strokeStyle = bark;
    g.lineCap = 'round';
    g.lineWidth = tw * (near ? 0.42 : 0.5) * (1 - k * 0.3);
    g.beginPath();
    g.moveTo(x0, y0);
    g.quadraticCurveTo(mx, my, x1, y1);
    g.stroke();
    // a couple of side branches
    g.lineWidth *= 0.45;
    for (let j = 0; j < 2; j++) {
      const t = 0.45 + j * 0.25;
      const bx = lerp(x0, x1, t);
      const by = lerp(y0, y1, t) + len * 0.03;
      g.beginPath();
      g.moveTo(bx, by);
      g.lineTo(bx + dir * len * 0.25, by - len * (j ? 0.22 : -0.04));
      g.stroke();
    }
    limbs.push({ x0, y0, x1, y1, len, dir });
  }
  // foliage: flat, feathery masses along the limbs and round the top, lighter on top where the sun
  // catches it, with the sky showing through
  const mass = (cx, cy, rw) => {
    const rh = rw * 0.4;
    const nTufts = near ? 170 : 16;
    // a soft body of shade under the sprays, so the mass reads as foliage, not scattered leaves
    g.fillStyle = 'rgba(52,72,36,0.35)';
    g.beginPath();
    g.ellipse(cx, cy + rh * 0.15, rw * 0.85, rh * 0.75, 0, 0, TAU);
    g.fill();
    const sprays = greens.map(() => new Path2D());
    for (let j = 0; j < nTufts; j++) {
      const a = r() * TAU;
      const d = Math.sqrt(r());
      const px = cx + Math.cos(a) * rw * d;
      const py = cy + Math.sin(a) * rh * d;
      const up = (cy - py) / rh; // +1 at the top of the mass, -1 underneath
      const shade = clamp(Math.round(1.6 + up * 1.6 + (r() - 0.5)), 0, greens.length - 1);
      g.fillStyle = greens[shade];
      if (near) {
        // a little spray of needles, drooping at the tip
        const len = (0.8 + r() * 1.1) * u;
        const ang = (r() - 0.5) * 0.8 + (r() < 0.5 ? 0 : Math.PI);
        sprays[shade].moveTo(px, py);
        sprays[shade].quadraticCurveTo(px + Math.cos(ang) * len * 0.6, py + Math.sin(ang) * len * 0.3, px + Math.cos(ang) * len, py + len * 0.35);
      } else {
        g.beginPath();
        g.ellipse(px, py, rw * (0.22 + r() * 0.2), rh * (0.3 + r() * 0.25), 0, 0, TAU);
        g.fill();
      }
    }
    if (near) {
      g.lineWidth = 0.32 * u;
      g.lineCap = 'round';
      sprays.forEach((path, k) => {
        g.strokeStyle = greens[k];
        g.stroke(path);
      });
    }
  };
  const hangs = [];
  for (const l of limbs) {
    const k = near ? 5 : 3;
    for (let j = 0; j < k; j++) {
      const t = 0.3 + (j / (k - 1 || 1)) * 0.7;
      const cx = lerp(l.x0, l.x1, t);
      const cy = lerp(l.y0, l.y1, t) - l.len * 0.04;
      const rw = l.len * (near ? 0.17 : 0.42) * (1.15 - t * 0.3);
      mass(cx, cy, rw);
      hangs.push({ x: cx + (r() - 0.5) * rw, y: cy + rw * 0.25 });
    }
  }
  for (let j = 0; j < (near ? 4 : 3); j++) mass(topX + (r() - 0.5) * ht * 0.12, topY + ht * (0.03 + r() * 0.08), ht * (near ? 0.05 : 0.09));
  return hangs;
}

// the storm overhead: a low, rolling, mottled cloud base filling the sky
function overcast(w, h, r) {
  const c = layer(w, h);
  const g = c.getContext('2d');
  g.fillStyle = vgrad(g, 0, h, [
    [0, '#2b3239'],
    [1, '#4d5862'],
  ]);
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 90; i++) {
    const y = h * (0.05 + r() * 0.9);
    const rx = w * (0.08 + r() * 0.16);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    const dark = r() < 0.5;
    gr.addColorStop(0, dark ? 'rgba(28,33,39,0.55)' : 'rgba(110,120,130,0.35)');
    gr.addColorStop(1, 'rgba(40,46,54,0)');
    g.save();
    g.translate(r() * w, y);
    g.scale(1, 0.32 + r() * 0.2);
    g.fillStyle = gr;
    g.fillRect(-rx, -rx, rx * 2, rx * 2);
    g.restore();
  }
  return c;
}

const GLADES_BIRDS = {
  'red-winged-blackbird': { body: '#141414', head: '#141414', wing: '#141414', patch: '#d8231f', beak: '#222', size: 0.9 },
  'boat-tailed-grackle': { body: '#1b1830', head: '#1b1830', wing: '#221d3a', beak: '#222', tail: 1.9, size: 1.05 },
};

class Glades extends Painting {
  build() {
    const { w, h, u } = this;
    this.horizon = h * 0.6;
    let seed = 23;
    const r = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    this.cloud = cumulonimbus(Math.round(w * 1.1), Math.round(h * 0.72), r);
    this.over = overcast(w, Math.round(this.horizon + h * 0.02), r);
    // the far side, hazy with distance: trees all along the horizon, cypress domes (tallest in
    // the middle, where the water's deepest) and hammocks of hardwoods with cabbage palms
    this.far = layer(w, h);
    let g = this.far.getContext('2d');
    const hz = this.horizon;
    g.fillStyle = '#7d8e86';
    g.beginPath();
    g.moveTo(0, hz + 1);
    for (let x = 0; x <= w + 4 * u; x += (0.8 + r() * 1.6) * u) g.lineTo(x, hz - (0.3 + r() * 1) * u);
    g.lineTo(w + 4 * u, hz + 1);
    g.fill();
    for (const [i, fx] of [0.06, 0.24, 0.41, 0.58, 0.76, 0.93].entries()) {
      const x = (fx + (r() - 0.5) * 0.06) * w;
      if (i % 2 === 0) {
        // a cypress dome: a crowd of narrow, flat-topped crowns on pale trunks
        const wd = (12 + r() * 12) * u;
        const ht = (4.5 + r() * 3) * u;
        const n = Math.round(wd / (0.75 * u));
        for (let k = 0; k < n; k++) {
          const f = (k + r() * 0.6) / n;
          const tx = x - wd / 2 + f * wd;
          const th = ht * (0.3 + 0.7 * Math.sqrt(Math.max(0, 1 - (2 * f - 1) ** 2))) * (0.8 + r() * 0.35);
          g.strokeStyle = '#8b8d86';
          g.lineWidth = 0.16 * u;
          g.beginPath();
          g.moveTo(tx, hz + 1);
          g.lineTo(tx, hz - th * 0.7);
          g.stroke();
          g.fillStyle = ['#5d7152', '#68795a', '#53664a', '#71825f'][k % 4];
          g.beginPath();
          g.ellipse(tx, hz - th * 0.74, (0.55 + r() * 0.45) * u, th * 0.28, 0, 0, TAU);
          g.fill();
        }
      } else {
        // a hammock: a rounded mound of hardwoods, cabbage palms poking above it
        const wd = (8 + r() * 12) * u;
        const ht = (2 + r() * 2.2) * u;
        g.fillStyle = '#41543f';
        g.beginPath();
        g.moveTo(x - wd / 2, hz + 1);
        for (let k = 0; k <= 8; k++) {
          const f = k / 8;
          g.lineTo(x - wd / 2 + f * wd, hz - ht * Math.sin(f * Math.PI) ** 0.7 * (0.85 + r() * 0.3));
        }
        g.lineTo(x + wd / 2, hz + 1);
        g.fill();
        for (let k = 0; k < 3; k++) {
          const px = x + (r() - 0.5) * wd * 0.6;
          const top = hz - ht * (1.5 + r());
          g.strokeStyle = '#41543f';
          g.lineWidth = 0.25 * u;
          g.beginPath();
          g.moveTo(px, hz - ht * 0.6);
          g.lineTo(px, top);
          g.stroke();
          for (let f = 0; f < 7; f++) {
            const a = -Math.PI + (f / 6) * Math.PI;
            g.beginPath();
            g.moveTo(px, top);
            g.lineTo(px + Math.cos(a) * u * 1.2, top + Math.sin(a) * u * 0.7 + u * 0.25);
            g.stroke();
          }
        }
      }
    }
    // the prairie: sawgrass, golden green, with sloughs of open water cut out of it
    this.prairie = layer(w, h);
    g = this.prairie.getContext('2d');
    g.fillStyle = vgrad(g, this.horizon, h, [
      [0, '#8f9257'],
      [0.25, '#9c9450'],
      [0.6, '#7f7c3e'],
      [1, '#55552a'],
    ]);
    g.fillRect(0, this.horizon, w, h - this.horizon);
    g.lineWidth = 0.18 * u;
    for (let i = 0; i < 2400; i++) {
      const y = this.horizon + (r() ** 1.6) * (h - this.horizon);
      const p = (y - this.horizon) / (h - this.horizon);
      const x = r() * w;
      const len = (0.4 + p * 3.5) * u * (0.6 + r() * 0.8);
      g.strokeStyle = ['rgba(70,72,30,0.5)', 'rgba(170,160,90,0.45)', 'rgba(110,112,50,0.5)'][i % 3];
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (r() - 0.5) * len * 0.5, y - len);
      g.stroke();
    }
    // sloughs: the river of grass, open water in long shallow channels
    g.globalCompositeOperation = 'destination-out';
    const blob = (cx, cy, rx, ry) => {
      const path = new Path2D();
      for (let i = 0; i <= 48; i++) {
        const a = (i / 48) * TAU;
        const k = 1 + 0.2 * Math.sin(a * 3 + cx) + 0.12 * Math.sin(a * 5 + cy) + (r() - 0.5) * 0.08;
        const x = cx + Math.cos(a) * rx * k;
        const y = cy + Math.sin(a) * ry * k;
        if (i) path.lineTo(x, y);
        else path.moveTo(x, y);
      }
      path.closePath();
      return { x: cx, y: cy, rx, ry, path };
    };
    this.sloughs = [blob(w * 0.38, this.horizon + h * 0.13, w * 0.42, h * 0.024), blob(w * 0.83, this.horizon + h * 0.05, w * 0.2, h * 0.01), blob(w * 0.1, this.horizon + h * 0.028, w * 0.16, h * 0.007)];
    for (const sl of this.sloughs) g.fill(sl.path);
    g.globalCompositeOperation = 'source-over';
    // the land as painted, and again in the storm's shadow (crossfaded as it comes over)
    this.land = layer(w, h);
    const lg = this.land.getContext('2d');
    lg.drawImage(this.far, 0, 0);
    lg.drawImage(this.prairie, 0, 0);
    // a cypress strand off to the right, standing in the slough, hung with moss
    const strand = this.sloughs[1];
    for (let i = 0; i < 7; i++) {
      const x = strand.x + (i / 6 - 0.45) * strand.rx * 1.5 + (r() - 0.5) * 4 * u;
      const y = strand.y + (r() - 0.4) * strand.ry * 0.8;
      const ht = h * (0.06 + r() * 0.11);
      const hangs = baldCypress(lg, x, y, ht, u, r, { knees: 4, limbs: 3 + Math.floor(r() * 3), from: 0.4 + r() * 0.15, water: strand.path, trunk: ht * 0.028 });
      for (const m0 of hangs) {
        if (r() < 0.5) continue;
        const m = mossBeard((1.4 + r() * 2.8) * u, (0.6 + r() * 0.6) * u, u * 0.45, r);
        lg.drawImage(m.c, m0.x - m.ax, m0.y - m.ay);
      }
    }
    this.landDark = layer(w, h);
    const dg = this.landDark.getContext('2d');
    dg.drawImage(this.land, 0, 0);
    dg.globalCompositeOperation = 'source-atop';
    dg.fillStyle = 'rgba(18,24,30,0.72)';
    dg.fillRect(0, 0, w, h);
    this.far = this.prairie = null;
    // up close on the left, a big bald cypress at the edge of the slough, knees all round it and
    // Spanish moss on its limbs (the moss drawn live, so it can blow about in the gust front)
    this.near = layer(w, h);
    const ng = this.near.getContext('2d');
    const pool = this.sloughs[0];
    const bx = w * 0.1;
    const by = pool.y + pool.ry * 0.5;
    const hangs = baldCypress(ng, bx, by, by + h * 0.1, u, r, { near: true, knees: 14, kneesSide: 1, limbs: 5, from: 0.5, side: 1, reach: 1.9, water: pool.path, trunk: w * 0.04, lean: 0.015 });
    // only the part with the tree in it gets drawn every frame
    this.near = trim({ c: this.near, ax: 0, ay: 0 });
    this.nearDark = { ...this.near, c: layer(this.near.c.width, this.near.c.height) };
    const nd = this.nearDark.c.getContext('2d');
    nd.drawImage(this.near.c, 0, 0);
    nd.globalCompositeOperation = 'source-atop';
    nd.fillStyle = 'rgba(16,21,27,0.66)';
    nd.fillRect(0, 0, this.near.c.width, this.near.c.height);
    this.moss = [];
    for (const m0 of hangs) {
      if (r() < 0.35) continue;
      const L = (6 + r() ** 1.5 * 22) * u;
      const W = (1.8 + r() * 2.6) * u;
      const lit = mossBeard(L, W, u, r, MOSS);
      // the same beard in the storm's shadow
      const dim = { ...lit, c: layer(lit.c.width, lit.c.height) };
      const dg2 = dim.c.getContext('2d');
      dg2.drawImage(lit.c, 0, 0);
      dg2.globalCompositeOperation = 'source-atop';
      dg2.fillStyle = 'rgba(30,36,40,0.62)';
      dg2.fillRect(0, 0, dim.c.width, dim.c.height);
      this.moss.push({ x: m0.x, y: m0.y, ph: r() * TAU, lit, dim });
    }
    // the near grass: blades drawn live so the wind can push them about
    this.blades = Array.from({ length: Math.round(w / (0.9 * u)) }, () => ({
      x: r() * w,
      hgt: (0.1 + r() * 0.2) * h,
      lean: (r() - 0.5) * 0.3,
      ph: r() * TAU,
      col: ['#6f6c33', '#8a8440', '#56562a', '#9c9350'][Math.floor(r() * 4)],
    }));
    // cattails, where the blackbirds sing from
    this.cattails = [
      { x: w * 0.16, hgt: h * 0.3, ph: 0.5 },
      { x: w * 0.78, hgt: h * 0.34, ph: 2.1 },
      { x: w * 0.9, hgt: h * 0.26, ph: 4 },
    ];
    this.drops = Array.from({ length: Math.min(900, Math.round((w * h) / (2400 * this.dpr))) }, () => this.drop(true));
    // summer cumulus drifting about the rest of the sky
    this.puffs = Array.from({ length: 6 }, (_, i) => ({ x: r() * w, y: this.horizon - h * (0.06 + r() * 0.3), s: (2 + r() * 4) * u * (1 - i * 0.08), v: (0.2 + r() * 0.3) * u }));
    this.ripples = [];
    this.flyers = [];
    this.perched = [];
    this.cranes = null;
    this.limpkin = null;
  }

  drop(anywhere) {
    return { x: rand(-0.3, 1.1) * this.w, y: anywhere ? rand(0, this.h) : rand(-0.2, 0) * this.h, v: rand(0.9, 1.4), l: rand(0.6, 1.4) };
  }

  event(e) {
    if (e.type === 'lightning') {
      this.at(e.at, () => {
        const near = e.km < 3;
        const strokes = e.strength > 0.5 ? Math.round(rand(2, 4)) : 1;
        let dt = 0;
        const bolt = this.bolt(near, e.km);
        for (let i = 0; i < strokes; i++) {
          this.flashes.push({ t0: this.t + dt, life: rand(0.08, 0.2), k: e.strength * rand(0.6, 1), bolt: i === 0 || near ? bolt : null, near });
          dt += rand(0.06, 0.18);
        }
      });
    }
    if (e.type === 'bird') this.at(e.at, () => this.showBird(e));
  }

  // where the storm cloud sits now: it grows from a tower on the horizon to the sky overhead
  cloudBox() {
    const { w, h } = this;
    const a = this.drivers.storm ?? 0.3;
    const k = lerp(0.6, 1.75, a ** 1.4);
    const cw = this.cloud.lit.width * k;
    const ch = this.cloud.lit.height * k;
    const cx = lerp(0.6, 0.5, a) * w;
    const base = this.horizon - lerp(0.015, 0.14, a) * h;
    return { x: cx - cw / 2, y: base - ch * 0.86, w: cw, h: ch, base, cx };
  }

  bolt(near, km) {
    const { w, h } = this;
    const box = this.cloudBox();
    const pts = [];
    let x = near ? rand(0.15, 0.85) * w : box.cx + rand(-0.18, 0.18) * box.w;
    let y = near ? 0 : box.base;
    const bottom = this.horizon + (near ? rand(0.01, 0.06) * h : 0);
    const step = near ? 0.05 : 0.025;
    while (y < bottom) {
      pts.push([x, y]);
      x += rand(-0.6, 0.6) * step * w;
      y += rand(0.4, 1) * step * h;
    }
    pts.push([x, bottom]);
    return { pts, width: near ? 2.4 : clamp(1.6 - km / 10, 0.6, 1.4) };
  }

  showBird(e) {
    const { w, h } = this;
    const sp = e.species;
    if (sp === 'great-egret' || sp === 'osprey') {
      const fromLeft = Math.random() < 0.5;
      this.flyers.push({ sp, x: fromLeft ? -0.05 * w : 1.05 * w, y: (sp === 'osprey' ? rand(0.1, 0.25) : rand(0.3, 0.5)) * h, v: (fromLeft ? 1 : -1) * rand(0.04, 0.07) * w, ph: rand(0, TAU) });
    } else if (sp === 'sandhill-crane') {
      this.cranes = { x: rand(0.2, 0.8) * w, until: this.t + 40 };
    } else if (sp === 'limpkin') {
      this.limpkin = { x: this.sloughs[0].x + rand(-0.3, 0.3) * this.sloughs[0].rx, until: this.t + 30, sing: this.t, singUntil: this.t + (e.dur || 2) };
    } else if (GLADES_BIRDS[sp]) {
      const existing = this.perched.find((p) => p.key === (e.bird ?? sp));
      if (existing) {
        existing.until = this.t + (e.dur || 2);
        existing.gone = Math.max(existing.gone, this.t + (e.dur || 2) + rand(8, 16));
        return;
      }
      const free = this.cattails.filter((c) => !this.perched.some((p) => p.cat === c));
      const cat = free[Math.floor(Math.random() * free.length)];
      if (cat) this.perched.push({ key: e.bird ?? sp, look: GLADES_BIRDS[sp], cat, until: this.t + (e.dur || 2), gone: this.t + (e.dur || 2) + rand(8, 16), sing: this.t });
    }
  }

  frame(dt) {
    const { g, w, h, t, u } = this;
    const storm = this.drivers.storm ?? 0.3;
    const after = this.drivers.after ?? 0;
    const dark = clamp((storm - 0.15) / 0.75, 0, 1);
    const rain = clamp((storm - 0.35) / 0.5, 0, 1);
    const wind = clamp((storm - 0.3) / 0.45, 0, 1) * (0.75 + 0.25 * Math.sin(t * 0.7));
    const gold = after * (1 - dark);

    // lightning: the brightest flash right now
    let flash = 0;
    let near = false;
    this.flashes = this.flashes.filter((f) => t - f.t0 < f.life + 0.3);
    for (const f of this.flashes) {
      const age = t - f.t0;
      if (age < 0) continue;
      const k = age < f.life ? f.k : f.k * Math.max(0, 1 - (age - f.life) / 0.3);
      if (k > flash) {
        flash = k;
        near = f.near;
      }
    }

    // sky: hot hazy blue, going slate under the storm, warm when it clears
    const top = mix(mix('#4b9ad3', '#2f3740', dark), '#6a93bf', gold * 0.6);
    const mid = mix(mix('#98c8e6', '#48525c', dark), '#e6c49a', gold * 0.7);
    const low = mix(mix('#e9eef0', '#5c676e', dark), '#f6d7a6', gold * 0.8);
    g.fillStyle = vgrad(g, 0, this.horizon, [
      [0, top],
      [0.6, mid],
      [1, low],
    ]);
    g.fillRect(0, 0, w, this.horizon + 2);

    // fair-weather cumulus, swallowed by the storm
    const fair = 1 - clamp((storm - 0.12) / 0.22, 0, 1);
    if (fair > 0) {
      for (const p of this.puffs) {
        p.x += p.v * dt;
        if (p.x > w + p.s * 4) p.x = -p.s * 4;
        for (let k = 0; k < 5; k++) {
          const x = p.x + (k - 2) * p.s * 0.7;
          const y = p.y - Math.sin(k * 1.1 + 0.4) * p.s * 0.45;
          const rr = p.s * (1 - Math.abs(k - 2) * 0.15);
          const gr = g.createRadialGradient(x - rr * 0.2, y - rr * 0.3, 0, x, y, rr);
          gr.addColorStop(0, `rgba(255,255,253,${0.9 * fair})`);
          gr.addColorStop(0.7, `rgba(240,242,245,${0.6 * fair})`);
          gr.addColorStop(1, 'rgba(235,238,242,0)');
          g.fillStyle = gr;
          g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
        }
      }
    }
    // the thunderhead, and its rain shaft
    const box = this.cloudBox();
    const fade = clamp(1 - (storm - 0.8) / 0.18, 0, 1);
    if (fade > 0) {
      g.globalAlpha = fade;
      g.drawImage(this.cloud.lit, box.x, box.y, box.w, box.h);
      g.globalAlpha = fade * Math.min(1, dark * 1.3);
      g.drawImage(this.cloud.dark, box.x, box.y, box.w, box.h);
      g.globalAlpha = 1;
      const shaft = clamp((storm - 0.2) / 0.3, 0, 1) * fade;
      if (shaft > 0) {
        // the rain shaft: a soft grey curtain hanging from the base, leaning with the wind
        const sx = box.cx - box.w * 0.2;
        const sw = box.w * 0.4;
        const gr = g.createLinearGradient(sx, 0, sx + sw, 0);
        gr.addColorStop(0, 'rgba(80,90,102,0)');
        gr.addColorStop(0.3, `rgba(80,90,102,${0.5 * shaft})`);
        gr.addColorStop(0.75, `rgba(80,90,102,${0.45 * shaft})`);
        gr.addColorStop(1, 'rgba(80,90,102,0)');
        g.fillStyle = gr;
        g.beginPath();
        g.moveTo(sx, box.base - 2);
        g.lineTo(sx + sw, box.base - 2);
        g.lineTo(sx + sw * 1.1, this.horizon);
        g.lineTo(sx + sw * 0.08, this.horizon);
        g.closePath();
        g.fill();
      }
    }
    // overhead: the low cloud base fills the sky
    const overA = clamp((storm - 0.6) / 0.3, 0, 1);
    if (overA > 0) {
      g.globalAlpha = overA;
      g.drawImage(this.over, 0, 0);
      g.globalAlpha = 1;
    }
    // a rainbow over the departing storm, the sun low behind us
    const bow = clamp(after * 1.6 - 0.25, 0, 1) * clamp(1 - storm / 0.4, 0, 1);
    if (bow > 0) {
      const cx = w * 0.62;
      const cy = this.horizon + h * 0.08;
      const R = Math.min(w, h) * 0.55;
      const cols = ['255,80,60', '255,160,50', '255,230,80', '120,210,100', '80,150,230', '110,90,200', '150,90,190'];
      g.lineWidth = R * 0.018;
      cols.forEach((c, i) => {
        g.strokeStyle = `rgba(${c},${0.22 * bow})`;
        g.beginPath();
        g.arc(cx, cy, R - i * g.lineWidth, Math.PI * 1.08, Math.PI * 1.92);
        g.stroke();
      });
    }
    // lightning lights the cloud from inside and the whole sky
    if (flash > 0) {
      const fx = near ? w * 0.5 : box.cx;
      const fy = near ? h * 0.1 : box.base - box.h * 0.3;
      const gr = g.createRadialGradient(fx, fy, 0, fx, fy, w * (near ? 1.1 : 0.6));
      gr.addColorStop(0, `rgba(220,232,255,${0.6 * flash})`);
      gr.addColorStop(1, `rgba(160,180,220,${(near ? 0.18 : 0.04) * flash})`);
      g.fillStyle = gr;
      g.fillRect(0, 0, w, this.horizon);
    }
    for (const f of this.flashes) {
      if (!f.bolt || t - f.t0 > f.life || t < f.t0) continue;
      g.strokeStyle = `rgba(240,246,255,${0.95 * f.k})`;
      g.lineWidth = f.bolt.width * this.dpr;
      g.shadowColor = 'rgba(190,215,255,0.9)';
      g.shadowBlur = 16 * this.dpr;
      g.beginPath();
      f.bolt.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.stroke();
      g.shadowBlur = 0;
    }

    // the sloughs mirror the sky (rain stipples them), then the land, darkened under the storm
    for (const sl of this.sloughs) {
      g.fillStyle = vgrad(g, sl.y - sl.ry * 1.3, sl.y + sl.ry * 1.3, [
        [0, mix(low, '#2a3438', 0.2)],
        [1, mix(mid, '#1d2629', 0.35)],
      ]);
      g.fill(sl.path);
    }
    g.drawImage(this.land, 0, 0);
    if (dark > 0) {
      g.globalAlpha = dark * 0.85;
      g.drawImage(this.landDark, 0, 0);
      g.globalAlpha = 1;
    }
    if (rain > 0.05) {
      for (let i = 0; i < rain * 4; i++) {
        const s = this.sloughs[Math.random() < 0.7 ? 0 : 1];
        const a = Math.random() * TAU;
        const rr = Math.sqrt(Math.random());
        this.ripples.push({ x: s.x + Math.cos(a) * s.rx * rr, y: s.y + Math.sin(a) * s.ry * rr, age: 0 });
      }
    }
    this.ripples = this.ripples.filter((p) => (p.age += dt) < 0.7);
    g.strokeStyle = 'rgba(220,230,235,0.35)';
    g.lineWidth = 0.15 * u;
    g.beginPath();
    for (const p of this.ripples) {
      const rad = p.age * 2.2 * u;
      g.moveTo(p.x + rad, p.y);
      g.ellipse(p.x, p.y, rad, rad * 0.3, 0, 0, TAU);
    }
    g.stroke();

    // birds out on the prairie
    if (this.cranes && t < this.cranes.until) this.drawCranes();
    if (this.limpkin && t < this.limpkin.until) this.drawLimpkin();
    this.flyers = this.flyers.filter((f) => f.x > -0.1 * w && f.x < 1.1 * w);
    for (const f of this.flyers) {
      f.x += f.v * dt;
      this.drawFlyer(f);
    }

    // warm when the sun comes back
    if (gold > 0) {
      g.fillStyle = `rgba(255,186,96,${gold * 0.18})`;
      g.fillRect(0, this.horizon, w, h);
    }
    if (flash > 0) {
      g.fillStyle = `rgba(200,215,240,${flash * (near ? 0.3 : 0.08)})`;
      g.fillRect(0, this.horizon, w, h);
    }
    // a grey veil of rain over everything far away
    if (rain > 0) {
      g.fillStyle = vgrad(g, 0, this.horizon + h * 0.16, [
        [0, `rgba(120,130,140,${rain * 0.25})`],
        [0.78, `rgba(120,130,140,${rain * 0.3})`],
        [1, 'rgba(120,130,140,0)'],
      ]);
      g.fillRect(0, 0, w, this.horizon + h * 0.16);
    }

    // the big cypress up close, in the storm's shadow as it comes over, its moss blowing about
    g.drawImage(this.near.c, -this.near.ax, -this.near.ay);
    if (dark > 0) {
      g.globalAlpha = dark * 0.85;
      g.drawImage(this.nearDark.c, -this.nearDark.ax, -this.nearDark.ay);
      g.globalAlpha = 1;
    }
    for (const m of this.moss) {
      const ang = Math.sin(t * (0.5 + wind * 1.6) + m.ph) * (0.025 + wind * 0.1) - wind * 0.16;
      g.setTransform(Math.cos(ang), Math.sin(ang), -Math.sin(ang), Math.cos(ang), m.x, m.y);
      g.drawImage(m.lit.c, -m.lit.ax, -m.lit.ay);
      if (dark > 0) {
        g.globalAlpha = Math.min(1, dark * 1.1);
        g.drawImage(m.dim.c, -m.dim.ax, -m.dim.ay);
        g.globalAlpha = 1;
      }
    }
    g.setTransform(1, 0, 0, 1, 0, 0);

    // the near sawgrass and cattails, pushed by the wind
    const lean = wind * 0.35;
    const shade = (c) => (dark > 0 ? mix(c, '#1f2426', dark * 0.45) : c);
    g.lineCap = 'round';
    for (const b of this.blades) {
      const sway = Math.sin(t * (1.2 + wind * 2.5) + b.ph) * (0.03 + wind * 0.08) + lean + b.lean;
      g.strokeStyle = shade(b.col);
      g.lineWidth = 0.35 * u;
      g.beginPath();
      g.moveTo(b.x, h + u);
      g.quadraticCurveTo(b.x + sway * b.hgt * 0.3, h - b.hgt * 0.6, b.x + sway * b.hgt, h - b.hgt);
      g.stroke();
    }
    for (const c of this.cattails) {
      const sway = Math.sin(t * (0.9 + wind * 2) + c.ph) * (0.02 + wind * 0.06) + lean * 0.7;
      const tx = c.x + sway * c.hgt;
      const ty = h - c.hgt;
      c.tx = tx;
      c.ty = ty;
      g.strokeStyle = shade('#5d6b34');
      g.lineWidth = 0.5 * u;
      g.beginPath();
      g.moveTo(c.x, h + u);
      g.quadraticCurveTo(c.x + sway * c.hgt * 0.3, h - c.hgt * 0.6, tx, ty);
      g.stroke();
      g.fillStyle = shade('#5a3a22');
      g.beginPath();
      g.ellipse(tx, ty + 2.6 * u, 0.9 * u, 2.6 * u, sway * 0.6, 0, TAU);
      g.fill();
    }
    this.perched = this.perched.filter((p) => t < p.gone);
    for (const p of this.perched) this.drawPerched(p, dark);

    // rain, slanted by the wind
    if (rain > 0) {
      const slant = 0.12 + wind * 0.35;
      const count = Math.round(this.drops.length * rain);
      g.strokeStyle = `rgba(210,222,232,${0.2 + rain * 0.16})`;
      g.lineWidth = 1 * this.dpr;
      g.beginPath();
      for (let i = 0; i < count; i++) {
        const d = this.drops[i];
        const vy = d.v * h * 1.3 * dt;
        d.y += vy;
        d.x += vy * slant;
        if (d.y > h || d.x > w * 1.2) Object.assign(d, this.drop(false));
        const L = d.l * 2.6 * u;
        g.moveTo(d.x, d.y);
        g.lineTo(d.x - L * slant, d.y - L);
      }
      g.stroke();
    }
  }

  drawFlyer(f) {
    const { g, t, u } = this;
    const s = (f.sp === 'osprey' ? 1.6 : 1.9) * u;
    const flap = Math.sin(t * (f.sp === 'osprey' ? 4 : 2.6) + f.ph);
    g.save();
    g.translate(f.x, f.y);
    if (f.v < 0) g.scale(-1, 1);
    g.strokeStyle = f.sp === 'osprey' ? '#3a3027' : '#f4f2ea';
    g.fillStyle = f.sp === 'osprey' ? '#f0ece4' : '#f7f5ee';
    g.lineWidth = 0.45 * u;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-s * 1.8, -flap * s * 0.9);
    g.quadraticCurveTo(-s * 0.7, -s * 0.4 - flap * s * 0.3, 0, 0);
    g.quadraticCurveTo(s * 0.7, -s * 0.4 - flap * s * 0.3, s * 1.8, -flap * s * 0.9);
    g.stroke();
    g.beginPath();
    g.ellipse(0, s * 0.1, s * 0.75, s * 0.22, 0, 0, TAU);
    g.fill();
    if (f.sp === 'great-egret') {
      // neck tucked, legs trailing
      g.strokeStyle = '#2a2a2a';
      g.lineWidth = 0.15 * u;
      g.beginPath();
      g.moveTo(-s * 0.7, s * 0.15);
      g.lineTo(-s * 1.7, s * 0.25);
      g.stroke();
      g.fillStyle = '#e8b020';
      g.beginPath();
      g.moveTo(s * 0.75, s * 0.05);
      g.lineTo(s * 1.35, s * 0.12);
      g.lineTo(s * 0.75, s * 0.2);
      g.fill();
    }
    g.restore();
  }

  drawCranes() {
    const { g, t, u } = this;
    const y = this.horizon + this.h * 0.035;
    for (const [dx, ph] of [
      [0, 0],
      [3.2 * u, 1.3],
    ]) {
      const x = this.cranes.x + dx + Math.sin(t * 0.2 + ph) * u;
      const s = 0.9 * u;
      g.fillStyle = '#8d8f93';
      g.beginPath();
      g.ellipse(x, y - s * 3.2, s * 1.6, s * 0.9, -0.1, 0, TAU);
      g.fill();
      g.strokeStyle = '#8d8f93';
      g.lineWidth = s * 0.35;
      g.beginPath();
      g.moveTo(x + s * 1.2, y - s * 3.6);
      g.quadraticCurveTo(x + s * 1.6, y - s * 5.2, x + s * 1.9 + Math.sin(t + ph) * s * 0.3, y - s * 6);
      g.stroke();
      g.fillStyle = '#c0392b';
      g.beginPath();
      g.arc(x + s * 1.95, y - s * 6.1, s * 0.3, 0, TAU);
      g.fill();
      g.strokeStyle = '#4a4a4a';
      g.lineWidth = s * 0.18;
      g.beginPath();
      g.moveTo(x - s * 0.2, y - s * 2.5);
      g.lineTo(x - s * 0.3, y);
      g.moveTo(x + s * 0.3, y - s * 2.5);
      g.lineTo(x + s * 0.4, y);
      g.stroke();
    }
  }

  drawLimpkin() {
    const { g, t, u } = this;
    const L = this.limpkin;
    const s = 1.1 * u;
    const x = L.x;
    const y = this.sloughs[0].y - this.sloughs[0].ry * 0.6;
    const singing = t < L.singUntil;
    g.fillStyle = '#6a4a2e';
    g.beginPath();
    g.ellipse(x, y - s * 2.6, s * 1.5, s * 0.85, -0.15, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(240,235,220,0.7)';
    for (let k = 0; k < 6; k++) g.fillRect(x - s + k * s * 0.35, y - s * 2.9 + (k % 2) * s * 0.4, s * 0.15, s * 0.15);
    g.strokeStyle = '#6a4a2e';
    g.lineWidth = s * 0.4;
    g.beginPath();
    g.moveTo(x + s, y - s * 3);
    g.quadraticCurveTo(x + s * 1.5, y - s * (singing ? 5 : 4.4), x + s * 1.7, y - s * (singing ? 5.6 : 4.8));
    g.stroke();
    g.strokeStyle = '#b8902a';
    g.lineWidth = s * 0.18;
    g.beginPath();
    g.moveTo(x + s * 1.75, y - s * (singing ? 5.6 : 4.8));
    g.lineTo(x + s * 3, y - s * (singing ? 6.4 : 4.9));
    g.stroke();
    g.strokeStyle = '#3a3a3a';
    g.lineWidth = s * 0.16;
    g.beginPath();
    g.moveTo(x - s * 0.2, y - s * 1.9);
    g.lineTo(x - s * 0.2, y);
    g.moveTo(x + s * 0.3, y - s * 1.9);
    g.lineTo(x + s * 0.4, y);
    g.stroke();
  }

  drawPerched(p, dark) {
    const { g, t, u } = this;
    const L = p.look;
    const singing = t < p.until;
    const s = 2.4 * u * (L.size || 1);
    const fade = Math.min(1, (p.gone - t) / 1.5, (t - p.sing + 0.8) / 0.8);
    g.save();
    g.globalAlpha = Math.max(0, fade);
    g.translate(p.cat.tx, p.cat.ty - 0.2 * u);
    if (p.cat.x > this.w / 2) g.scale(-1, 1);
    g.fillStyle = L.wing;
    g.beginPath();
    g.moveTo(-s * 0.8, -s * 0.6);
    g.lineTo(-s * (1.9 + (L.tail || 1) * 0.6), -s * 0.1);
    g.lineTo(-s * (1.7 + (L.tail || 1) * 0.6), -s * 0.5);
    g.closePath();
    g.fill();
    g.fillStyle = L.body;
    g.beginPath();
    g.ellipse(0, -s * 0.8, s * 1.05, s * 0.72, -0.15, 0, TAU);
    g.fill();
    if (L.patch) {
      // red shoulders, flared while he sings
      g.fillStyle = L.patch;
      g.beginPath();
      g.ellipse(-s * 0.1, -s * (singing ? 1.1 : 0.95), s * (singing ? 0.45 : 0.3), s * 0.18, -0.3, 0, TAU);
      g.fill();
      g.fillStyle = '#f2d36b';
      g.fillRect(-s * 0.35, -s * 0.98, s * 0.45, s * 0.07);
    }
    g.fillStyle = L.head;
    g.beginPath();
    g.arc(s * 0.85, -s * 1.4, s * 0.48, 0, TAU);
    g.fill();
    g.fillStyle = L.beak;
    g.beginPath();
    g.moveTo(s * 1.25, -s * 1.48);
    g.lineTo(s * 1.75, singing ? -s * 1.62 : -s * 1.42);
    g.lineTo(s * 1.25, -s * 1.32);
    g.closePath();
    g.fill();
    g.fillStyle = '#ddd';
    g.beginPath();
    g.arc(s * 1.02, -s * 1.5, s * 0.07, 0, TAU);
    g.fill();
    g.restore();
  }
}

// ---------------------------------------------------------------------------------------------
// A cypress pond in Florida, the night after the storm: moonlight on still black water, bald
// cypress hung with moss, lily pads and pickerelweed. The frogs you hear show up, throats puffed
// out; fireflies drift over the water; an owl calls from the cypress; now and then a pair of eyes
// glows red at the surface.

const MOSS_NIGHT = [
  ['rgba(30,38,46,0.85)', 0.2, 16],
  ['rgba(52,62,72,0.85)', 0.19, 20],
  ['rgba(78,90,100,0.8)', 0.17, 16],
  ['rgba(120,132,142,0.7)', 0.13, 5],
];

// what each frog looks like, and where it sits: on a stem, on a pad, in the water, or on the bank
const FROG_LOOKS = {
  'green-treefrog': { body: '#5f9e48', stripe: '#e8e6c8', sac: '#f2efc4', size: 0.8, where: 'stem' },
  'squirrel-treefrog': { body: '#7c8a4c', sac: '#efe7c0', size: 0.65, where: 'stem' },
  'barking-treefrog': { body: '#6f9a4c', spots: '#3d5a2a', sac: '#efe9c2', size: 0.95, where: 'water' },
  'pig-frog': { body: '#3d5a35', sac: '#d9d3a8', size: 1.25, where: 'water', low: true },
  'leopard-frog': { body: '#6b8f4e', spots: '#24361e', sac: '#e7e3c3', size: 0.9, where: 'pad', pair: true },
  'southern-toad': { body: '#7a5c40', spots: '#4a3624', sac: '#e9dcc0', size: 1, where: 'bank', big: true },
  'oak-toad': { body: '#5a5048', stripe: '#d9c9a0', sac: '#e6dcc0', size: 0.6, where: 'bank', big: true },
  'cricket-frog': { body: '#6d6a48', sac: '#e2dcb8', size: 0.5, where: 'pad' },
};

class Pond extends Painting {
  build() {
    const { w, h, u } = this;
    this.shore = h * 0.5;
    let seed = 41;
    const r = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    this.moon = { x: w * 0.68, y: h * 0.13, r: 3.6 * u };
    // the night sky: stars, the moon, and the last of the storm clouds drifting off
    this.sky = layer(w, h);
    let g = this.sky.getContext('2d');
    g.fillStyle = vgrad(g, 0, this.shore, [
      [0, '#050a14'],
      [0.6, '#0e1a2c'],
      [1, '#1c2a3d'],
    ]);
    g.fillRect(0, 0, w, this.shore + 2);
    for (let i = 0; i < 220; i++) {
      const y = r() ** 1.4 * this.shore * 0.9;
      g.fillStyle = `rgba(230,236,255,${0.25 + r() * 0.6})`;
      const s = (0.12 + r() * 0.22) * u;
      g.fillRect(r() * w, y, s, s);
    }
    const mg = g.createRadialGradient(this.moon.x, this.moon.y, 0, this.moon.x, this.moon.y, this.moon.r * 9);
    mg.addColorStop(0, 'rgba(225,230,210,0.35)');
    mg.addColorStop(0.3, 'rgba(160,175,190,0.12)');
    mg.addColorStop(1, 'rgba(120,140,170,0)');
    g.fillStyle = mg;
    g.fillRect(0, 0, w, this.shore);
    g.fillStyle = '#efeadb';
    g.beginPath();
    g.arc(this.moon.x, this.moon.y, this.moon.r, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(180,176,160,0.35)';
    for (const [dx, dy, rr] of [[-0.3, -0.2, 0.28], [0.25, 0.15, 0.2], [-0.1, 0.35, 0.16]]) {
      g.beginPath();
      g.arc(this.moon.x + dx * this.moon.r, this.moon.y + dy * this.moon.r, rr * this.moon.r, 0, TAU);
      g.fill();
    }
    // a gibbous moon: shade one edge
    g.fillStyle = 'rgba(10,16,28,0.55)';
    g.beginPath();
    g.arc(this.moon.x + this.moon.r * 0.55, this.moon.y, this.moon.r * 0.95, -Math.PI / 2, Math.PI / 2);
    g.arc(this.moon.x + this.moon.r * 0.15, this.moon.y, this.moon.r * 0.95, Math.PI / 2, -Math.PI / 2, true);
    g.fill();
    // storm clouds moving off, silver-edged by the moon
    this.clouds = Array.from({ length: 5 }, () => ({ x: r() * w, y: (0.04 + r() * 0.22) * h, rx: (0.18 + r() * 0.2) * w, v: (0.05 + r() * 0.08) * u }));

    // the far shore: a wall of cypress, and its reflection
    this.land = layer(w, h);
    g = this.land.getContext('2d');
    g.fillStyle = vgrad(g, this.shore, h, [
      [0, '#121c28'],
      [0.4, '#0a121b'],
      [1, '#04070b'],
    ]);
    g.fillRect(0, this.shore, w, h - this.shore);
    const treeline = (gg, flip) => {
      gg.fillStyle = flip ? 'rgba(6,10,14,0.55)' : '#070c10';
      for (let i = 0; i < 26; i++) {
        const x = (i / 25) * w + (r() - 0.5) * 4 * u;
        const th = (8 + r() * 14) * u;
        const tw = (3 + r() * 4) * u;
        gg.beginPath();
        // bald cypress: a narrow, flat-topped crown on a straight trunk
        gg.moveTo(x - tw, this.shore);
        gg.lineTo(x - tw * 0.8, this.shore - th * (flip ? -1 : 1) * 0.55);
        gg.quadraticCurveTo(x - tw * 1.1, this.shore - th * (flip ? -1 : 1) * 0.95, x, this.shore - th * (flip ? -1 : 1));
        gg.quadraticCurveTo(x + tw * 1.1, this.shore - th * (flip ? -1 : 1) * 0.95, x + tw * 0.8, this.shore - th * (flip ? -1 : 1) * 0.55);
        gg.lineTo(x + tw, this.shore);
        gg.closePath();
        gg.fill();
      }
      gg.fillRect(0, this.shore - (flip ? -1.2 : 3) * u, w, 4.2 * u);
    };
    let s0 = seed;
    treeline(g, false);
    seed = s0; // the reflection is the same trees, upside down
    treeline(g, true);
    // two big cypress up close, framing the pond, with flared trunks and knees in the water
    this.perches = [];
    this.moss = [];
    for (const [x, lean] of [
      [w * 0.07, 0.05],
      [w * 0.95, -0.04],
    ]) {
      const base = h * 0.8;
      const top = -h * 0.05;
      g.fillStyle = '#0b1014';
      g.beginPath();
      g.moveTo(x - 9 * u, base);
      g.quadraticCurveTo(x - 4 * u, base - h * 0.06, x - 3 * u + lean * h * 0.3, base - h * 0.3);
      g.lineTo(x - 2.2 * u + lean * h * 0.9, top);
      g.lineTo(x + 2.2 * u + lean * h * 0.9, top);
      g.lineTo(x + 3 * u + lean * h * 0.3, base - h * 0.3);
      g.quadraticCurveTo(x + 4 * u, base - h * 0.06, x + 9 * u, base);
      g.closePath();
      g.fill();
      // moonlight down one side of the trunk
      g.strokeStyle = 'rgba(130,145,160,0.35)';
      g.lineWidth = 0.55 * u;
      g.beginPath();
      g.moveTo(x + 1.9 * u + lean * h * 0.3, base - h * 0.3);
      g.lineTo(x + 1.4 * u + lean * h * 0.9, top);
      g.stroke();
      // limbs reaching in over the water (not the same on both trees), perches for the owls,
      // and moss hanging along them
      const dir = x < w / 2 ? 1 : -1;
      for (const k of dir > 0 ? [0.14, 0.37, 0.6] : [0.27, 0.52]) {
        const ly = lerp(base - h * 0.3, top, k + 0.12);
        const lx = x + lean * h * (0.3 + (k + 0.12) * 0.6);
        const len = (15 + r() * 15) * u;
        const ex = lx + dir * len;
        const ey = ly - (1 + r() * 5) * u;
        const cx = lx + dir * len * 0.45;
        const cy = ly - (3 + r() * 2) * u;
        // a tapering limb: thick at the trunk, a twig at the end
        const along = (f) => {
          const a = (1 - f) * (1 - f), b = 2 * f * (1 - f), c = f * f;
          return [a * lx + b * cx + c * ex, a * ly + b * cy + c * ey];
        };
        const pts = Array.from({ length: 13 }, (_, i) => along(i / 12));
        const half = (i) => lerp(1.3, 0.2, i / 12) * u;
        g.fillStyle = '#0d1418';
        g.beginPath();
        pts.forEach(([px, py], i) => (i ? g.lineTo(px, py - half(i)) : g.moveTo(px, py - half(i))));
        for (let i = 12; i >= 0; i--) g.lineTo(pts[i][0], pts[i][1] + half(i));
        g.closePath();
        g.fill();
        // twigs
        g.strokeStyle = '#0d1418';
        g.lineCap = 'round';
        g.lineWidth = 0.4 * u;
        for (let tw = 0; tw < 4; tw++) {
          const [tx, ty] = along(0.35 + tw * 0.17);
          g.beginPath();
          g.moveTo(tx, ty);
          g.lineTo(tx + dir * (2 + r() * 3) * u, ty - (2 + r() * 3) * u);
          g.stroke();
        }
        // moonlight along the top of the limb, so it reads against the sky
        g.strokeStyle = 'rgba(150,165,180,0.38)';
        g.lineWidth = 0.45 * u;
        g.beginPath();
        pts.forEach(([px, py], i) => (i ? g.lineTo(px, py - half(i)) : g.moveTo(px, py - half(i))));
        g.stroke();
        const [px, py] = along(0.62);
        this.perches.push({ x: px, y: py - 1.6 * u, dir });
        // moss: thickest out along the limb, a few beards of different lengths
        const n = 3 + Math.floor(r() * 3);
        for (let m = 0; m < n; m++) {
          const f = 0.22 + (m + r() * 0.6) * (0.75 / n);
          const [mx, my] = along(Math.min(f, 0.97));
          this.moss.push({ x: mx, y: my, ph: r() * TAU, flex: 0.8, ...mossBeard((8 + r() * 22) * u, (2 + r() * 2.5) * u, u, r, MOSS_NIGHT) });
        }
      }
      // knees
      for (let k = 0; k < 5; k++) {
        const kx = x + (r() - 0.5) * 22 * u;
        const ky = base + (r() - 0.2) * h * 0.04;
        const kh = (1.2 + r() * 2) * u;
        g.fillStyle = '#0d1317';
        g.beginPath();
        g.moveTo(kx - 0.9 * u, ky);
        g.quadraticCurveTo(kx - 0.3 * u, ky - kh * 1.2, kx, ky - kh);
        g.quadraticCurveTo(kx + 0.3 * u, ky - kh * 1.2, kx + 0.9 * u, ky);
        g.fill();
      }
    }
    // lily pads, a few white water lilies
    this.pads = [];
    for (let i = 0; i < 26; i++) {
      const y = lerp(this.shore + h * 0.06, h * 0.9, r() ** 0.8);
      const p = (y - this.shore) / (h - this.shore);
      const rx = (1 + p * 4.5) * u * (0.7 + r() * 0.5);
      const x = w * (0.15 + r() * 0.75);
      this.pads.push({ x, y, rx });
      g.fillStyle = ['#16301f', '#1b3824', '#122a1a'][i % 3];
      g.beginPath();
      g.ellipse(x, y, rx, rx * 0.32, 0, 0.25, TAU - 0.05);
      g.lineTo(x, y);
      g.fill();
      g.strokeStyle = 'rgba(140,170,150,0.15)';
      g.lineWidth = 0.12 * u;
      g.stroke();
      if (r() < 0.25) {
        // a water lily, glowing faintly in the moonlight
        const fx = x + rx * 0.3;
        const fy = y - rx * 0.1;
        const fs = rx * 0.45;
        for (let k = 0; k < 8; k++) {
          const a = -Math.PI + (k / 7) * Math.PI;
          g.fillStyle = k % 2 ? '#dcdccf' : '#c8cac0';
          g.beginPath();
          g.ellipse(fx + Math.cos(a) * fs * 0.5, fy + Math.sin(a) * fs * 0.35, fs * 0.45, fs * 0.16, a, 0, TAU);
          g.fill();
        }
        g.fillStyle = '#e3c86a';
        g.beginPath();
        g.arc(fx, fy - fs * 0.05, fs * 0.15, 0, TAU);
        g.fill();
      }
    }
    // pickerelweed and sawgrass along the near edge
    this.stems = [];
    for (let i = 0; i < 46; i++) {
      const x = r() * w;
      const hgt = (0.06 + r() * 0.14) * h;
      const lean = (r() - 0.5) * 0.25;
      const tx = x + lean * hgt;
      const ty = h - hgt;
      g.strokeStyle = ['#0e1a12', '#13221a', '#0a140e'][i % 3];
      g.lineWidth = (0.35 + r() * 0.3) * u;
      g.beginPath();
      g.moveTo(x, h + u);
      g.quadraticCurveTo(x + lean * hgt * 0.3, h - hgt * 0.6, tx, ty);
      g.stroke();
      if (i % 4 === 0) {
        // pickerelweed: heart-shaped leaves and a spike of violet flowers
        g.fillStyle = '#122318';
        g.beginPath();
        g.ellipse(x + 1.6 * u, h - hgt * 0.45, 1.8 * u, 1 * u, -0.6, 0, TAU);
        g.fill();
        g.fillStyle = 'rgba(120,100,170,0.6)';
        for (let k = 0; k < 6; k++) {
          g.beginPath();
          g.arc(tx + (r() - 0.5) * 0.5 * u, ty + k * 0.55 * u, 0.32 * u, 0, TAU);
          g.fill();
        }
      } else if (i % 3 === 0) this.stems.push({ x: tx, y: ty + 1.2 * u });
    }
    // the far bank, where toads sing
    this.bank = Array.from({ length: 6 }, () => ({ x: w * (0.15 + r() * 0.7), y: this.shore + h * (0.012 + r() * 0.02) }));
    this.fireflies = Array.from({ length: 42 }, () => ({
      x: r() * w,
      y: lerp(this.shore - h * 0.12, h * 0.95, r()),
      vx: (r() - 0.5) * 1.2 * u,
      vy: (r() - 0.5) * 0.6 * u,
      ph: r() * 6,
      period: 2 + r() * 4,
    }));
    this.mist = Array.from({ length: 4 }, (_, i) => ({ x: r() * w, y: this.shore + h * (0.02 + i * 0.03), rx: (0.3 + r() * 0.3) * w, v: (0.08 + r() * 0.1) * u }));
    this.frogs = [];
    this.owls = [];
    this.gators = [];
    this.ripples = [];
    this.glow = 0;
  }

  event(e) {
    if (e.type === 'bird') this.at(e.at, () => this.show(e));
    if (e.type === 'shot' && e.layer === 'alligator') {
      this.at(e.at, () => {
        const x = rand(0.25, 0.75) * this.w;
        const y = lerp(this.shore + this.h * 0.05, this.h * 0.75, Math.random());
        this.gators.push({ x, y, t0: this.t, until: this.t + Math.max(18, (e.dur || 6) + 12), bellow: this.t + (e.dur || 6) });
        this.ripple(x, y, 3);
      });
    }
    if (e.type === 'lightning') this.at(e.at, () => (this.glow = Math.max(this.glow, 0.35 * (e.strength ?? 0.3) + 0.15)));
  }

  ripple(x, y, n = 1) {
    for (let i = 0; i < n; i++) this.ripples.push({ x, y, age: -i * 0.35 });
  }

  show(e) {
    const sp = e.species;
    const key = e.bird ?? sp;
    const L = FROG_LOOKS[sp];
    if (!L) {
      // owls and the chuck-will's-widow: on a cypress limb
      const existing = this.owls.find((o) => o.key === key);
      if (existing) {
        existing.until = this.t + (e.dur || 2);
        existing.gone = Math.max(existing.gone, this.t + (e.dur || 2) + rand(10, 20));
        return;
      }
      const free = this.perches.filter((p) => !this.owls.some((o) => o.spot === p));
      const spot = free[Math.floor(Math.random() * free.length)];
      if (spot) this.owls.push({ key, sp, spot, until: this.t + (e.dur || 2), gone: this.t + (e.dur || 2) + rand(10, 20), sing: this.t });
      return;
    }
    const existing = this.frogs.find((f) => f.key === key);
    if (existing) {
      existing.until = this.t + (e.dur || 2);
      existing.gone = Math.max(existing.gone, this.t + (e.dur || 2) + rand(10, 25));
      return;
    }
    let spot;
    const taken = (p) => this.frogs.some((f) => f.spot === p);
    if (L.where === 'stem') spot = this.stems.filter((p) => !taken(p))[Math.floor(Math.random() * this.stems.length)];
    else if (L.where === 'pad') spot = this.pads.filter((p) => !taken(p) && p.y > this.shore + this.h * 0.1)[Math.floor(Math.random() * 8)];
    else if (L.where === 'bank') spot = this.bank.filter((p) => !taken(p))[Math.floor(Math.random() * this.bank.length)];
    if (!spot) spot = { x: rand(0.2, 0.8) * this.w, y: lerp(this.shore + this.h * 0.05, this.h * 0.8, Math.random()), water: true };
    this.frogs.push({ key, sp, look: L, spot, until: this.t + (e.dur || 2), gone: this.t + (e.dur || 2) + rand(10, 25), sing: this.t, flip: Math.random() < 0.5 });
  }

  frame(dt) {
    const { g, w, h, t, u } = this;
    g.drawImage(this.sky, 0, 0);
    // a far flash over the departing storm
    if (this.glow > 0.01) {
      const gr = g.createRadialGradient(w * 0.2, this.shore - h * 0.08, 0, w * 0.2, this.shore - h * 0.08, w * 0.8);
      gr.addColorStop(0, `rgba(190,200,230,${this.glow})`);
      gr.addColorStop(1, 'rgba(120,130,170,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, this.shore);
      this.glow *= Math.exp(-dt * 9);
    }
    // the storm's last clouds, edged with moonlight
    for (const c of this.clouds) {
      c.x += c.v * dt;
      if (c.x - c.rx > w) c.x = -c.rx;
      const gr = g.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.rx);
      gr.addColorStop(0, 'rgba(22,30,44,0.75)');
      gr.addColorStop(0.7, 'rgba(40,52,70,0.4)');
      gr.addColorStop(1, 'rgba(40,52,70,0)');
      g.save();
      g.translate(c.x, c.y);
      g.scale(1, 0.25);
      g.translate(-c.x, -c.y);
      g.fillStyle = gr;
      g.fillRect(c.x - c.rx, c.y - c.rx, c.rx * 2, c.rx * 2);
      g.restore();
    }
    g.drawImage(this.land, 0, 0);
    // the moon's path across the water
    const mx = this.moon.x;
    for (let i = 0; i < 26; i++) {
      const y = this.shore + 0.5 * u + i * i * 0.07 * u;
      if (y > h * 0.86) break;
      const wd = (1 + i * 0.35) * u * (0.6 + 0.4 * Math.sin(t * 1.3 + i * 1.7));
      g.fillStyle = `rgba(230,228,205,${0.35 * (1 - i / 26) * (0.6 + 0.4 * Math.sin(t * 2.1 + i))})`;
      g.fillRect(mx - wd + Math.sin(t * 0.8 + i) * u, y, wd * 2, 0.22 * u);
    }
    // mist lying on the water
    for (const m of this.mist) {
      m.x += m.v * dt;
      if (m.x - m.rx > w) m.x = -m.rx;
      const gr = g.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.rx);
      gr.addColorStop(0, 'rgba(170,185,200,0.1)');
      gr.addColorStop(1, 'rgba(170,185,200,0)');
      g.save();
      g.translate(m.x, m.y);
      g.scale(1, 0.12);
      g.translate(-m.x, -m.y);
      g.fillStyle = gr;
      g.fillRect(m.x - m.rx, m.y - m.rx, m.rx * 2, m.rx * 2);
      g.restore();
    }
    // ripples
    this.ripples = this.ripples.filter((p) => (p.age += dt) < 3);
    g.lineWidth = 0.15 * u;
    for (const p of this.ripples) {
      if (p.age < 0) continue;
      const k = 1 - p.age / 3;
      const s = 1 + ((p.y - this.shore) / (h - this.shore)) * 3;
      g.strokeStyle = `rgba(190,200,210,${0.3 * k})`;
      g.beginPath();
      g.ellipse(p.x, p.y, p.age * 2 * u * s, p.age * 0.6 * u * s, 0, 0, TAU);
      g.stroke();
    }
    // alligators: eyes catching the light, the water dancing on its back as it bellows
    this.gators = this.gators.filter((a) => t < a.until);
    for (const a of this.gators) this.drawGator(a);
    // moss swaying a little
    for (const m of this.moss) {
      const ang = Math.sin(t * 0.5 + m.ph) * 0.02;
      g.setTransform(Math.cos(ang), Math.sin(ang), -Math.sin(ang), Math.cos(ang), m.x, m.y);
      g.drawImage(m.c, -m.ax, -m.ay);
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    // owls and nightjars on the cypress limbs
    this.owls = this.owls.filter((o) => t < o.gone);
    for (const o of this.owls) this.drawOwl(o);
    // frogs
    this.frogs = this.frogs.filter((f) => t < f.gone);
    for (const f of this.frogs) this.drawFrog(f);
    // fireflies
    for (const f of this.fireflies) {
      f.x += (f.vx + Math.sin(t * 0.7 + f.ph) * 0.6 * u) * dt;
      f.y += (f.vy + Math.cos(t * 0.5 + f.ph) * 0.4 * u) * dt;
      if (f.x < -10) f.x = w + 10;
      if (f.x > w + 10) f.x = -10;
      if (f.y < this.shore - h * 0.15 || f.y > h) f.vy = -f.vy;
      const p = (t + f.ph) % f.period;
      const on = p < 0.35 ? Math.sin((p / 0.35) * Math.PI) : 0;
      if (on <= 0.02) continue;
      const rr = 1.6 * u;
      const gr = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, rr);
      gr.addColorStop(0, `rgba(235,255,150,${0.95 * on})`);
      gr.addColorStop(0.25, `rgba(190,240,90,${0.45 * on})`);
      gr.addColorStop(1, 'rgba(160,220,60,0)');
      g.fillStyle = gr;
      g.fillRect(f.x - rr, f.y - rr, rr * 2, rr * 2);
    }
  }

  drawGator(a) {
    const { g, t, u } = this;
    const p = (a.y - this.shore) / (this.h - this.shore);
    const s = (0.6 + p * 1.6) * u;
    const fade = Math.min(1, (t - a.t0) / 1.5, (a.until - t) / 2);
    g.save();
    g.globalAlpha = Math.max(0, fade);
    // the head, barely above the water
    g.fillStyle = '#0b1210';
    g.beginPath();
    g.ellipse(a.x, a.y, s * 6, s * 0.7, 0, Math.PI, TAU);
    g.fill();
    // eyeshine
    for (const dx of [-1.1, 1.1]) {
      const ex = a.x - s * 2.5 + dx * s;
      const gr = g.createRadialGradient(ex, a.y - s * 0.5, 0, ex, a.y - s * 0.5, s * 1.4);
      gr.addColorStop(0, 'rgba(255,140,70,0.95)');
      gr.addColorStop(0.4, 'rgba(230,80,40,0.45)');
      gr.addColorStop(1, 'rgba(200,60,30,0)');
      g.fillStyle = gr;
      g.fillRect(ex - s * 1.4, a.y - s * 1.9, s * 2.8, s * 2.8);
    }
    // as it bellows, the water dances in droplets over its back
    if (t < a.bellow) {
      g.fillStyle = 'rgba(200,210,220,0.6)';
      for (let k = 0; k < 14; k++) {
        const dx = (k / 13 - 0.5) * s * 8 + s * 3;
        const hop = Math.abs(Math.sin(t * 22 + k * 1.3)) * s * 1.6;
        g.fillRect(a.x + dx, a.y - s * 0.5 - hop, s * 0.25, s * 0.25);
      }
      if (Math.random() < 0.05) this.ripple(a.x + s * 3, a.y);
    }
    g.restore();
  }

  drawOwl(o) {
    const { g, t, u } = this;
    const singing = t < o.until;
    const fade = Math.min(1, (o.gone - t) / 1.5, (t - o.sing + 0.8) / 0.8);
    const s = (o.sp === 'barred-owl' ? 2.1 : o.sp === 'screech-owl' ? 1.3 : 1.5) * u;
    g.save();
    g.globalAlpha = Math.max(0, fade);
    g.translate(o.spot.x, o.spot.y);
    g.fillStyle = '#121a1f';
    if (o.sp === 'chuck-wills-widow') {
      // a nightjar lies along the limb
      g.beginPath();
      g.ellipse(0, -s * 0.5, s * 1.6, s * 0.55, 0, 0, TAU);
      g.fill();
      g.beginPath();
      g.arc(o.spot.dir * s * 1.2, -s * 0.8 - (singing ? Math.abs(Math.sin(t * 6)) * s * 0.15 : 0), s * 0.5, 0, TAU);
      g.fill();
    } else {
      g.beginPath();
      g.ellipse(0, -s * 1.2, s * 0.95, s * 1.3, 0, 0, TAU);
      g.fill();
      const bob = singing ? Math.sin(t * 5) * s * 0.12 : 0;
      g.beginPath();
      g.arc(0, -s * 2.6 + bob, s * 0.75, 0, TAU);
      g.fill();
      if (o.sp === 'screech-owl') {
        g.beginPath();
        g.moveTo(-s * 0.6, -s * 3.1 + bob);
        g.lineTo(-s * 0.45, -s * 3.7 + bob);
        g.lineTo(-s * 0.15, -s * 3.2 + bob);
        g.moveTo(s * 0.6, -s * 3.1 + bob);
        g.lineTo(s * 0.45, -s * 3.7 + bob);
        g.lineTo(s * 0.15, -s * 3.2 + bob);
        g.fill();
      }
      // eyes catching the moon
      g.fillStyle = o.sp === 'screech-owl' ? 'rgba(240,200,80,0.8)' : 'rgba(90,70,50,0.9)';
      for (const dx of [-0.3, 0.3]) {
        g.beginPath();
        g.arc(dx * s, -s * 2.65 + bob, s * 0.16, 0, TAU);
        g.fill();
      }
    }
    g.restore();
  }

  drawFrog(f) {
    const { g, t, u } = this;
    const L = f.look;
    const sp = f.spot;
    const p = clamp((sp.y - this.shore) / (this.h - this.shore), 0, 1);
    const s = (1 + p * 2) * u * L.size;
    const singing = t < f.until;
    const fade = Math.min(1, (f.gone - t) / 2, (t - f.sing + 0.8) / 0.8);
    // the throat swells with each call
    const puff = singing ? 0.5 + 0.5 * Math.abs(Math.sin(t * (L.big ? 3 : 6) + f.sing)) : 0;
    g.save();
    g.globalAlpha = Math.max(0, fade);
    g.translate(sp.x, sp.y);
    if (f.flip) g.scale(-1, 1);
    if (sp.water || L.low) {
      // just the head and eyes above the surface
      g.fillStyle = L.body;
      g.beginPath();
      g.ellipse(0, 0, s * 1.3, s * 0.45, 0, Math.PI, TAU);
      g.fill();
      for (const dx of [-0.55, 0.55]) {
        g.beginPath();
        g.arc(dx * s, -s * 0.35, s * 0.28, 0, TAU);
        g.fill();
      }
      if (puff > 0) {
        g.fillStyle = L.sac;
        g.globalAlpha *= 0.85;
        g.beginPath();
        g.ellipse(s * 0.9, -s * 0.05, s * 0.6 * puff, s * 0.45 * puff, 0, 0, TAU);
        g.fill();
        if (Math.random() < 0.03) this.ripple(sp.x, sp.y);
      }
    } else {
      // sitting up: body, head, a bright vocal sac under the chin
      g.fillStyle = L.body;
      g.beginPath();
      g.ellipse(0, -s * 0.6, s * 1.1, s * 0.75, -0.2, 0, TAU);
      g.fill();
      g.beginPath();
      g.ellipse(s * 0.8, -s * 1.1, s * 0.6, s * 0.45, -0.3, 0, TAU);
      g.fill();
      if (L.stripe) {
        g.strokeStyle = L.stripe;
        g.lineWidth = s * 0.14;
        g.beginPath();
        g.moveTo(-s * 0.9, -s * 0.55);
        g.quadraticCurveTo(0, -s * 0.85, s * 1.1, -s * 1.15);
        g.stroke();
      }
      if (L.spots) {
        g.fillStyle = L.spots;
        for (const [dx, dy] of [[-0.4, -0.8], [0.1, -0.95], [-0.1, -0.5], [0.4, -0.7]]) {
          g.beginPath();
          g.arc(dx * s, dy * s, s * 0.14, 0, TAU);
          g.fill();
        }
      }
      g.fillStyle = '#0c1210';
      g.beginPath();
      g.arc(s * 0.95, -s * 1.38, s * 0.16, 0, TAU);
      g.fill();
      if (puff > 0) {
        g.fillStyle = L.sac;
        g.beginPath();
        g.arc(s * 1.15, -s * (L.big ? 0.7 : 0.8), s * (L.big ? 0.75 : 0.45) * puff, 0, TAU);
        g.fill();
      }
    }
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

const PAINTINGS = { storm: Storm, waterfall: Waterfall, garden: Garden, butterfly: Butterfly, glades: Glades, pond: Pond, mansion: Mansion, snow: Snow, mixer: Blank };

export function createPainting(id, canvas, engine) {
  const P = PAINTINGS[id] || Blank;
  return new P(canvas, engine);
}

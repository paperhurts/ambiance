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

// a grain texture, and a way to print it onto a layer (only where the layer has paint)
function grainLayer(w, h) {
  const c = layer(Math.ceil(w / 2), Math.ceil(h / 2));
  const q = c.getContext('2d');
  const img = q.createImageData(c.width, c.height);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (Math.random() - 0.5) * 200;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  q.putImageData(img, 0, 0);
  return c;
}
function printGrain(c, grain, alpha) {
  const m = layer(c.width, c.height);
  const mc = m.getContext('2d');
  mc.drawImage(grain, 0, 0, c.width, c.height);
  mc.globalCompositeOperation = 'destination-in';
  mc.drawImage(c, 0, 0);
  const cc = c.getContext('2d');
  cc.globalCompositeOperation = 'overlay';
  cc.globalAlpha = alpha;
  cc.drawImage(m, 0, 0);
  cc.globalAlpha = 1;
  cc.globalCompositeOperation = 'source-over';
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
// After the East Hampton waterfall, in summer: a stepped cascade over layered, mossy slate ledges, a broad
// white fan over a rock slab, and the creek running out toward you between lichen-spotted boulders,
// under a canopy lit from behind by the sun. The water moves along each fall, the fan and the
// creek; there's foam where it lands and mist rising from the plunge.

// where a point sits in a flow: u runs along it (0 at the top, 1 at the bottom), v across (-1..1)
function flowAt(f, u, v) {
  const n = f.secs.length - 1;
  const p = clamp(u, 0, 1) * n;
  const i = Math.min(n - 1, Math.floor(p));
  const k = p - i;
  const a = f.secs[i];
  const b = f.secs[i + 1];
  return [lerp(a.x, b.x, k) + v * lerp(a.hw, b.hw, k), lerp(a.y, b.y, k)];
}
function flowPath(f) {
  const path = new Path2D();
  f.secs.forEach((c, i) => (i ? path.lineTo(c.x - c.hw, c.y) : path.moveTo(c.x - c.hw, c.y)));
  for (let i = f.secs.length - 1; i >= 0; i--) path.lineTo(f.secs[i].x + f.secs[i].hw, f.secs[i].y);
  path.closePath();
  return path;
}

class Waterfall extends Painting {
  build() {
    const { w, h, u } = this;
    let seed = 7;
    const r = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    this.bg = layer(w, h);
    const g = this.bg.getContext('2d');
    const sun = { x: w * 0.6, y: h * 0.07 };
    const lit = (x, y) => Math.exp(-Math.hypot((x - sun.x) / w, (y - sun.y) / h) * 3);
    const fx = w * 0.5;

    // ---- light through the canopy
    g.fillStyle = '#2a4f26';
    g.fillRect(0, 0, w, h);
    const glow = g.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, Math.max(w, h) * 0.6);
    glow.addColorStop(0, '#fdfde6');
    glow.addColorStop(0.1, '#eef5a8');
    glow.addColorStop(0.3, '#a6cf55');
    glow.addColorStop(0.55, '#5a9238');
    glow.addColorStop(1, '#244a22');
    g.fillStyle = glow;
    g.fillRect(0, 0, w, h * 0.62);

    // leaves, batched by colour; lit ones yellow-green, shaded ones deep and bluish
    const PAL = ['#14301a', '#1f4422', '#2d5e28', '#41782f', '#5f9a38', '#87bd42', '#b5da58', '#def08c'];
    const leaves = (ctx, cx, cy, rx, ry, n, size, bias = 0) => {
      const paths = PAL.map(() => new Path2D());
      for (let i = 0; i < n; i++) {
        const a = r() * TAU;
        const d = Math.sqrt(r());
        const x = cx + Math.cos(a) * rx * d;
        const y = cy + Math.sin(a) * ry * d;
        // lighter on top of the mass and toward the sun, darker underneath and inside
        const k = clamp(0.3 + lit(x, y) * 0.9 + ((cy - y) / ry) * 0.22 - d * 0.08 + (r() - 0.5) * 0.3 + bias, 0, 0.999);
        const P = paths[Math.floor(k * PAL.length)];
        const z = size * (0.6 + r() * 0.7);
        const ang = r() * TAU;
        const ca = Math.cos(ang);
        const sa = Math.sin(ang);
        P.moveTo(x - ca * z, y - sa * z);
        P.quadraticCurveTo(x - sa * z * 0.5, y + ca * z * 0.5, x + ca * z, y + sa * z);
        P.quadraticCurveTo(x + sa * z * 0.5, y - ca * z * 0.5, x - ca * z, y - sa * z);
      }
      paths.forEach((P, i) => {
        ctx.fillStyle = PAL[i];
        ctx.fill(P);
      });
    };
    const trunk = (ctx, x, y0, y1, wd, col, lean = 0) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(x - wd, y1);
      ctx.lineTo(x + lean - wd * 0.55, y0);
      ctx.lineTo(x + lean + wd * 0.55, y0);
      ctx.lineTo(x + wd, y1);
      ctx.fill();
    };
    // far trunks, pale in the haze of light
    for (let i = 0; i < 9; i++) trunk(g, w * (0.04 + i * 0.12 + (r() - 0.5) * 0.04), -h * 0.02, h * 0.36, (0.35 + r() * 0.5) * u, `rgba(225,232,205,${0.3 + r() * 0.2})`);
    // the canopy: far, soft masses, then fuller nearer ones, leaving the bright gap round the sun
    for (let i = 0; i < 30; i++) {
      const x = r() * w;
      const y = r() ** 1.3 * h * 0.34;
      if (Math.hypot((x - sun.x) / w, (y - sun.y) / h) < 0.12) continue;
      leaves(g, x, y, (5 + r() * 9) * u, (3 + r() * 5) * u, 160, 0.8 * u, 0.1);
    }
    // nearer trunks leaning in over the creek
    trunk(g, w * 0.07, -h * 0.02, h * 0.56, 2.2 * u, '#8b9787', w * 0.02);
    trunk(g, w * 0.86, -h * 0.02, h * 0.5, 1.5 * u, '#97a28f', -w * 0.03);
    g.fillStyle = 'rgba(30,40,30,0.3)';
    g.beginPath();
    g.moveTo(w * 0.07 + 0.3 * u, h * 0.56);
    g.lineTo(w * 0.09 + 0.3 * u, -h * 0.02);
    g.lineTo(w * 0.09 + 1.4 * u, -h * 0.02);
    g.lineTo(w * 0.07 + 2.2 * u, h * 0.56);
    g.fill();
    for (let i = 0; i < 22; i++) {
      const x = r() * w;
      const y = r() ** 1.6 * h * 0.3;
      if (Math.hypot((x - sun.x) / w, (y - sun.y) / h) < 0.1) continue;
      leaves(g, x, y, (6 + r() * 10) * u, (3.5 + r() * 6) * u, 300, 1 * u);
    }

    // ---- the streambed: a staircase of slate, the water running across each step and dropping off
    // its front edge, banked either side by a jumble of stones with ferns and moss between them
    // behind the stones: the dark of the banks, shading into the forest floor further up
    g.fillStyle = vgrad(g, h * 0.27, h * 0.72, [
      [0, '#55702f'],
      [0.12, '#3c5126'],
      [0.4, '#273424'],
      [1, '#1a2320'],
    ]);
    g.beginPath();
    g.moveTo(0, h * 0.33);
    for (let x = 0; x <= w; x += w / 10) g.lineTo(x, h * (0.285 + Math.abs(x / w - 0.5) * 0.07) + (r() - 0.5) * h * 0.01);
    g.lineTo(w, h);
    g.lineTo(0, h);
    g.fill();
    for (let i = 0; i < 10; i++) leaves(g, w * r(), h * (0.29 + r() * 0.05), (3 + r() * 5) * u, (1.5 + r() * 2) * u, 90, 0.9 * u, -0.1);

    // a stone: rounded, a little flat on top the way slate breaks, lit from above, a dark crevice
    // where it sits, pale lichen and tufts of moss along its top
    const stone = (ctx, cx, cy, rx, ry, o = {}) => {
      const n = 11;
      const pts = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + r() * 0.3;
        let k = 0.86 + r() * 0.24;
        let y = cy + Math.sin(a) * ry * k;
        if (Math.sin(a) < -0.2) y = cy - ry * (0.75 + r() * 0.12); // a flattish top
        pts.push([cx + Math.cos(a) * rx * k, y]);
      }
      pts.sort((p1, p2) => Math.atan2(p1[1] - cy, p1[0] - cx) - Math.atan2(p2[1] - cy, p2[0] - cx));
      const path = new Path2D();
      pts.forEach(([x, y], i) => {
        const [nx, ny] = pts[(i + 1) % n];
        if (!i) path.moveTo((x + nx) / 2, (y + ny) / 2);
        else path.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
      });
      path.quadraticCurveTo(pts[0][0], pts[0][1], (pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2);
      path.closePath();
      const tone = o.tone ?? r();
      const base = mix('#6f7f7b', '#5d6a72', tone);
      const gr = ctx.createLinearGradient(cx - rx * 0.4, cy - ry, cx + rx * 0.3, cy + ry);
      gr.addColorStop(0, mix(base, '#dfe6dc', 0.45));
      gr.addColorStop(0.35, base);
      gr.addColorStop(1, mix(base, '#141a1a', 0.7));
      ctx.fillStyle = gr;
      ctx.fill(path);
      ctx.save();
      ctx.clip(path);
      // the lit top facet
      ctx.fillStyle = 'rgba(225,232,220,0.28)';
      ctx.beginPath();
      ctx.ellipse(cx - rx * 0.05, cy - ry * 0.75, rx * 0.95, ry * (0.32 + r() * 0.12), 0, 0, TAU);
      ctx.fill();
      // lichen and stain
      for (let i = 0; i < Math.min(60, (rx * ry) / (u * u) * 0.25); i++) {
        const x = cx + (r() - 0.5) * rx * 2;
        const y = cy + (r() - 0.5) * ry * 2;
        ctx.fillStyle = r() < 0.6 ? `rgba(220,230,212,${0.12 + r() * 0.2})` : 'rgba(30,40,44,0.2)';
        ctx.beginPath();
        ctx.ellipse(x, y, (0.25 + r() * 1) * u, (0.2 + r() * 0.6) * u, r() * 3, 0, TAU);
        ctx.fill();
      }
      // wet and dark underneath
      const wl = ctx.createLinearGradient(0, cy + ry * 0.1, 0, cy + ry);
      wl.addColorStop(0, 'rgba(10,16,16,0)');
      wl.addColorStop(1, 'rgba(10,16,16,0.6)');
      ctx.fillStyle = wl;
      ctx.fillRect(cx - rx * 1.2, cy, rx * 2.4, ry * 1.1);
      ctx.restore();
      // moss in fine tufts along the top
      if (!o.bare) {
        const tufts = Math.round(rx / u * 1.5);
        const paths = [new Path2D(), new Path2D(), new Path2D()];
        for (let i = 0; i < tufts; i++) {
          const x = cx + (r() - 0.5) * rx * 1.5;
          const y = cy - ry * (0.65 + r() * 0.2);
          const P = paths[Math.floor(r() * 3)];
          for (let k = 0; k < 4; k++) {
            const tx = x + (r() - 0.5) * u * 1.2;
            const ty = y + (r() - 0.5) * u * 0.4;
            P.moveTo(tx + 0.35 * u, ty);
            P.ellipse(tx, ty, 0.35 * u, 0.22 * u, 0, 0, TAU);
          }
        }
        ['#557d2c', '#6f9a36', '#8db544'].forEach((c, i) => {
          ctx.fillStyle = c;
          ctx.fill(paths[i]);
        });
      }
      return path;
    };
    // a crag of slate: a big block with a lit top plane, a darker face banded with layers, a shadowed
    // side away from the light, moss and lichen on it. x0..x1 across, y0 its top, y1 its foot,
    // ridge the share of its height that's top plane.
    const crag = (ctx, x0, x1, y0, y1, o = {}) => {
      const ridge = o.ridge ?? 0.3;
      const topPts = [];
      const n = 8;
      for (let i = 0; i <= n; i++) {
        const k = i / n;
        // slate breaks flat: a level-ish top that drops away at the ends, a step or two in it
        const shoulder = Math.min(1, Math.sin(k * Math.PI) * 2.2) ** 0.8;
        topPts.push([lerp(x0, x1, k) + (r() - 0.5) * u, y1 - (y1 - y0) * (0.35 + 0.65 * shoulder) + (r() < 0.25 ? 1 : 0.3) * (r() - 0.5) * (y1 - y0) * 0.12 + (k - 0.5) * (o.tilt ?? 0) * (y1 - y0)]);
      }
      const outline = new Path2D();
      outline.moveTo(x0, y1);
      topPts.forEach(([x, y]) => outline.lineTo(x, y));
      outline.lineTo(x1, y1);
      outline.closePath();
      ctx.save();
      ctx.clip(outline);
      // the face
      ctx.fillStyle = vgrad(ctx, y0, y1, [
        [0, '#66746f'],
        [0.5, '#46524f'],
        [1, '#232b2a'],
      ]);
      ctx.fillRect(x0 - u, y0 - u, x1 - x0 + 2 * u, y1 - y0 + 2 * u);
      // layers in the slate, each with a lit lip over a dark seam
      const bands = 3 + Math.floor(r() * 3);
      for (let i = 1; i <= bands; i++) {
        const yy = lerp(y0, y1, ridge + (i / (bands + 1)) * (1 - ridge)) + (r() - 0.5) * u;
        const seam = new Path2D();
        seam.moveTo(x0 - u, yy);
        for (let x = x0; x <= x1 + u; x += (x1 - x0) / 7) seam.lineTo(x, yy + (r() - 0.5) * u * 0.8 + ((x - x0) / (x1 - x0)) * (o.dip ?? 0) * u);
        ctx.strokeStyle = 'rgba(14,18,18,0.55)';
        ctx.lineWidth = (0.4 + r() * 0.5) * u;
        ctx.stroke(seam);
        ctx.save();
        ctx.translate(0, -0.55 * u);
        ctx.strokeStyle = 'rgba(190,200,186,0.25)';
        ctx.lineWidth = 0.25 * u;
        ctx.stroke(seam);
        ctx.restore();
      }
      // the top plane, lit
      const top = new Path2D();
      topPts.forEach(([x, y], i) => (i ? top.lineTo(x, y) : top.moveTo(x, y)));
      const ph = r() * 6;
      for (let i = n; i >= 0; i--) top.lineTo(topPts[i][0], topPts[i][1] + (y1 - y0) * ridge * (0.8 + 0.18 * Math.sin(i * 1.1 + ph)));
      top.closePath();
      ctx.fillStyle = vgrad(ctx, y0, y0 + (y1 - y0) * ridge, [
        [0, '#a9b3a8'],
        [1, '#808d86'],
      ]);
      ctx.fill(top);
      // the side away from the light
      const sh = ctx.createLinearGradient(lerp(x0, x1, 0.55), 0, x1, 0);
      sh.addColorStop(0, 'rgba(10,14,16,0)');
      sh.addColorStop(1, 'rgba(10,14,16,0.4)');
      ctx.fillStyle = sh;
      ctx.fillRect(x0, y0 - u, x1 - x0, y1 - y0 + 2 * u);
      // lichen rosettes and dark stains
      for (let i = 0; i < Math.min(140, ((x1 - x0) * (y1 - y0)) / (u * u) * 0.12); i++) {
        ctx.fillStyle = r() < 0.6 ? `rgba(222,232,214,${0.12 + r() * 0.2})` : 'rgba(25,32,32,0.22)';
        ctx.beginPath();
        ctx.ellipse(lerp(x0, x1, r()), lerp(y0, y1, r()), (0.3 + r() * 1.3) * u, (0.25 + r() * 0.7) * u, r() * 3, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
      // moss in soft cushions on the top, a little spilling over the edge
      ctx.save();
      ctx.clip(outline);
      for (let i = 0; i < 3 + (x1 - x0) / (w * 0.08); i++) {
        if (o.bare) break;
        const k = 0.1 + r() * 0.8;
        const j = Math.min(n - 1, Math.floor(k * n));
        const x = lerp(topPts[j][0], topPts[j + 1][0], k * n - j);
        const y = lerp(topPts[j][1], topPts[j + 1][1], k * n - j);
        const mw = (2 + r() * 5) * u;
        const mh = (0.6 + r() * 1.2) * u;
        const mg = ctx.createRadialGradient(x, y, 0, x, y + mh * 0.3, mw);
        mg.addColorStop(0, 'rgba(126,168,60,0.95)');
        mg.addColorStop(0.6, 'rgba(92,134,46,0.8)');
        mg.addColorStop(1, 'rgba(70,104,40,0)');
        ctx.fillStyle = mg;
        ctx.beginPath();
        ctx.ellipse(x, y + mh * 0.4, mw, mh * 1.4, 0, 0, TAU);
        ctx.fill();
        // a few tufts catching the light on it
        ctx.fillStyle = 'rgba(170,205,90,0.7)';
        for (let q = 0; q < 6; q++) {
          ctx.beginPath();
          ctx.ellipse(x + (r() - 0.5) * mw * 1.2, y + (r() - 0.3) * mh, 0.35 * u, 0.2 * u, 0, 0, TAU);
          ctx.fill();
        }
      }
      ctx.restore();
      // the lit edge of the top
      ctx.strokeStyle = 'rgba(230,236,222,0.5)';
      ctx.lineWidth = 0.3 * u;
      ctx.beginPath();
      topPts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      return outline;
    };
    // the banks: big blocks stepping down either side, a great layered outcrop on the right like the
    // one by the real falls; ferns and saplings between them
    crag(g, -w * 0.06, w * 0.3, h * 0.29, h * 0.37, { ridge: 0.35 });
    crag(g, w * 0.6, w * 1.06, h * 0.25, h * 0.44, { ridge: 0.25, dip: 2 });
    crag(g, w * 0.22, w * 0.44, h * 0.3, h * 0.39, { ridge: 0.3 });
    crag(g, -w * 0.08, w * 0.4, h * 0.36, h * 0.5, { ridge: 0.3, dip: -1 });
    crag(g, w * 0.56, w * 0.78, h * 0.33, h * 0.46, { ridge: 0.3 });
    crag(g, w * 0.66, w * 1.08, h * 0.42, h * 0.58, { ridge: 0.28, dip: 1 });
    crag(g, -w * 0.06, w * 0.34, h * 0.47, h * 0.6, { ridge: 0.3 });
    for (const [x, y] of [[0.05, 0.36], [0.37, 0.355], [0.9, 0.42], [0.15, 0.47], [0.62, 0.45], [0.9, 0.56]]) leaves(g, w * x, h * y, (3 + r() * 4) * u, (1.5 + r() * 2) * u, 90, 0.9 * u, -0.08);

    // the steps, top (far) to bottom (near): lip position, water width, how deep the step's top looks,
    // how far the water drops off it
    const steps = [
      { cx: 0.53, y: 0.31, hw: 0.026, depth: 0.012, drop: 0.026, rock: 0.07 },
      { cx: 0.47, y: 0.355, hw: 0.032, depth: 0.016, drop: 0.032, rock: 0.09 },
      { cx: 0.525, y: 0.41, hw: 0.042, depth: 0.02, drop: 0.04, rock: 0.12 },
      { cx: 0.485, y: 0.475, hw: 0.056, depth: 0.024, drop: 0.048, rock: 0.15 },
    ];
    this.flows = [];
    for (const st of steps) {
      const cx = w * st.cx;
      const y = h * st.y;
      // the step: a stone whose flat top the water crosses, its front face under the drop
      crag(g, cx - w * st.rock, cx + w * st.rock, y - h * st.depth * 1.2, y + h * st.drop * 1.15, { ridge: (st.depth * 1.2) / (st.depth * 1.2 + st.drop * 1.15) });
      this.flows.push({ kind: 'run', speed: 0.5, n: 5, secs: [{ x: cx + w * 0.004, y: y - h * st.depth, hw: w * st.hw * 0.75 }, { x: cx, y, hw: w * st.hw }] });
      this.flows.push({ kind: 'fall', speed: 1.7, n: 12, secs: [{ x: cx, y: y + 0.2 * u, hw: w * st.hw }, { x: cx + w * 0.003, y: y + h * st.drop * 0.5, hw: w * st.hw * 0.93 }, { x: cx + w * 0.005, y: y + h * st.drop, hw: w * st.hw * 1.1 }] });
    }
    // the big slab at the bottom: the water spreads across its rounded back in a broad sheet, then
    // pours off its front edge into the pool
    const fanBack = h * 0.523;
    const fanLip = h * 0.62;
    crag(g, w * 0.1, w * 0.86, fanBack - h * 0.012, h * 0.69, { ridge: 0.62 });
    this.flows.push({ kind: 'sheet', speed: 0.45, n: 50, secs: [{ x: fx - w * 0.01, y: fanBack, hw: w * 0.1 }, { x: fx - w * 0.035, y: lerp(fanBack, fanLip, 0.45), hw: w * 0.2 }, { x: fx - w * 0.06, y: fanLip, hw: w * 0.27 }] });
    this.flows.push({ kind: 'curtain', speed: 1.3, n: 46, secs: [{ x: fx - w * 0.06, y: fanLip - 0.5 * u, hw: w * 0.27 }, { x: fx - w * 0.06, y: lerp(fanLip, h * 0.68, 0.5), hw: w * 0.276 }, { x: fx - w * 0.06, y: h * 0.68, hw: w * 0.285 }] });
    for (const f of this.flows) f.path = flowPath(f);
    // the water as painted: soft-edged and glassy, white strands running with it, ragged at the edges,
    // rock showing through where it runs thin, bright where it spills over a lip
    for (const f of this.flows) {
      const sheet = f.kind === 'sheet';
      const curtain = f.kind === 'curtain';
      if (curtain) {
        g.save();
        g.clip(f.path);
        g.fillStyle = vgrad(g, f.secs[0].y, f.secs[2].y, [
          [0, 'rgba(235,244,240,0.75)'],
          [1, 'rgba(220,234,230,0.35)'],
        ]);
        g.fill(f.path);
        g.lineCap = 'round';
        for (let i = 0; i < 130; i++) {
          const v = r() * 2 - 1;
          const u1 = 0.7 + r() * 0.3;
          g.strokeStyle = `rgba(252,254,253,${0.25 + r() * 0.55})`;
          g.lineWidth = (0.3 + r() * 0.8) * u;
          const [ax, ay] = flowAt(f, 0, v);
          const [bx, by] = flowAt(f, u1, v + (r() - 0.5) * 0.02);
          g.beginPath();
          g.moveTo(ax, ay);
          g.lineTo(bx, by);
          g.stroke();
        }
        g.restore();
        const e = f.secs[2];
        g.save();
        g.shadowColor = 'rgba(255,255,255,0.9)';
        g.shadowBlur = 2 * u;
        g.fillStyle = 'rgba(250,253,252,0.9)';
        g.beginPath();
        for (let k = 0; k < 22; k++) {
          const x = e.x + ((k / 21) * 2 - 1) * e.hw * 1.02;
          const ry = (0.8 + r() * 1.4) * u;
          g.moveTo(x + 3 * u, e.y);
          g.ellipse(x, e.y - ry * 0.4, (1.6 + r() * 1.6) * u, ry, 0, 0, TAU);
        }
        g.fill();
        g.restore();
        continue;
      }
      if (!sheet) {
        g.save();
        g.shadowColor = 'rgba(235,245,242,0.9)';
        g.shadowBlur = 1.4 * u;
        g.fillStyle = f.kind === 'fall' ? 'rgba(225,238,234,0.6)' : 'rgba(205,224,218,0.5)';
        g.fill(f.path);
        g.restore();
      }
      g.save();
      if (!sheet) g.clip(f.path);
      g.lineCap = 'round';
      const n = sheet ? 150 : f.kind === 'fall' ? 30 + (f.secs[0].hw / u) * 2.2 : 14;
      for (let i = 0; i < n; i++) {
        const v = sheet ? (r() * 2 - 1) * 1.05 : (i / n) * 2 - 1 + (r() - 0.5) * (2 / n);
        const edge = 1 - Math.min(1, Math.abs(v)) ** 3;
        // a sheet frays at its edges: strands there start late and stop short
        const u0 = sheet ? r() * 0.25 + (1 - edge) * r() * 0.5 : r() * 0.15;
        const u1 = sheet ? 1 - (1 - edge) * r() * 0.3 : 1;
        g.strokeStyle = `rgba(252,254,253,${(sheet ? 0.25 + r() * 0.5 : 0.18 + r() * 0.5) * (0.35 + edge * 0.65)})`;
        g.lineWidth = (sheet ? 0.5 + r() * 1.1 : 0.25 + r() * 0.6) * u;
        g.beginPath();
        for (let k = 0; k <= 8; k++) {
          const [x, y] = flowAt(f, lerp(u0, u1, k / 8), v + Math.sin(k * 0.9 + i) * 0.015);
          if (k) g.lineTo(x, y);
          else g.moveTo(x, y);
        }
        g.stroke();
      }
      g.restore();
      if (f.kind === 'fall') {
        const s0 = f.secs[0];
        g.strokeStyle = 'rgba(255,255,255,0.9)';
        g.lineWidth = 0.4 * u;
        g.beginPath();
        g.moveTo(s0.x - s0.hw, s0.y + 0.3 * u);
        g.quadraticCurveTo(s0.x, s0.y - 0.5 * u, s0.x + s0.hw, s0.y + 0.3 * u);
        g.stroke();
        // white water churning where it lands, ragged
        const e = f.secs[f.secs.length - 1];
        g.save();
        g.shadowColor = 'rgba(255,255,255,0.9)';
        g.shadowBlur = 1.5 * u;
        g.fillStyle = 'rgba(250,253,252,0.85)';
        g.beginPath();
        const blobs = 5 + Math.round(e.hw / u);
        for (let k = 0; k < blobs; k++) {
          const x = e.x + ((k / (blobs - 1)) * 2 - 1) * e.hw * 1.05 + (r() - 0.5) * u;
          const ry = (0.5 + r() * 0.8) * u;
          g.moveTo(x + e.hw * 0.3, e.y);
          g.ellipse(x, e.y - ry * 0.3 + (r() - 0.5) * u * 0.6, e.hw * (0.15 + r() * 0.15) + u * 0.4, ry, 0, 0, TAU);
        }
        g.fill();
        g.restore();
      }
    }
    // the pool below, dark green, gold where the canopy shows in it
    const pool = new Path2D();
    pool.moveTo(-w * 0.05, h * 0.695);
    pool.bezierCurveTo(w * 0.2, h * 0.675, w * 0.8, h * 0.675, w * 1.05, h * 0.695);
    pool.lineTo(w * 1.05, h * 1.02);
    pool.lineTo(-w * 0.05, h * 1.02);
    pool.closePath();
    this.pool = pool;
    g.fillStyle = vgrad(g, h * 0.675, h, [
      [0, '#7da48f'],
      [0.2, '#47705f'],
      [0.6, '#2c4e45'],
      [1, '#1b332f'],
    ]);
    g.fill(pool);
    g.save();
    g.clip(pool);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(${170 + r() * 60},${200 + r() * 40},120,${0.05 + r() * 0.1})`;
      g.beginPath();
      g.ellipse(w * r(), h * (0.69 + r() * 0.3), (3 + r() * 9) * u, (0.3 + r() * 0.6) * u, 0, 0, TAU);
      g.fill();
    }
    const landing = g.createLinearGradient(0, h * 0.675, 0, h * 0.73);
    landing.addColorStop(0, 'rgba(250,252,250,0.9)');
    landing.addColorStop(1, 'rgba(250,252,250,0)');
    g.fillStyle = landing;
    g.beginPath();
    g.ellipse(fx - w * 0.07, h * 0.687, w * 0.34, h * 0.028, 0, 0, TAU);
    g.fill();
    g.restore();
    // stones in the pool and banking it, the near ones big
    for (const [x, y, rx, ry] of [
      [0.06, 0.72, 0.17, 0.04],
      [0.95, 0.715, 0.16, 0.04],
      [0.27, 0.8, 0.07, 0.016],
      [0.72, 0.82, 0.08, 0.018],
      [0.5, 0.885, 0.06, 0.014],
      [0.08, 0.87, 0.16, 0.04],
      [0.93, 0.89, 0.15, 0.04],
    ]) crag(g, w * (x - rx), w * (x + rx), h * (y - ry * 1.1), h * (y + ry * 0.9), { ridge: 0.45, bare: y > 0.78 && x > 0.2 && x < 0.8, tilt: (r() - 0.5) * 0.3 });
    const boulder = (ctx, cx, cy, rx, ry) => crag(ctx, cx - rx, cx + rx, cy - ry * 1.2, cy + ry, { ridge: 0.4, tilt: (r() - 0.5) * 0.3 });

    // ---- in front, drawn over the water: a leafy bush leaning in from the right, ferns, near rocks
    this.front = layer(w, h);
    const fg = this.front.getContext('2d');
    boulder(fg, w * 0.16, h * 0.97, w * 0.3, h * 0.05);
    boulder(fg, w * 0.86, h * 0.985, w * 0.26, h * 0.05);
    fg.strokeStyle = '#4c4a3a';
    fg.lineCap = 'round';
    for (let i = 0; i < 10; i++) {
      const x0 = w * (0.95 + r() * 0.12);
      const y0 = h * (0.8 + r() * 0.15);
      const x1 = w * (0.62 + r() * 0.3);
      const y1 = h * (0.5 + r() * 0.3);
      fg.lineWidth = (0.2 + r() * 0.3) * u;
      fg.beginPath();
      fg.moveTo(x0, y0);
      fg.quadraticCurveTo((x0 + x1) / 2 + u * 3, (y0 + y1) / 2, x1, y1);
      fg.stroke();
      for (let k = 0; k < 5; k++) {
        const t = 0.35 + k * 0.16;
        leaves(fg, lerp(x0, x1, t), lerp(y0, y1, t), (2.5 + r() * 3.5) * u, (2 + r() * 2.5) * u, 70, 1.15 * u, -0.05);
      }
    }
    // the canopy's lowest leaves, framing the top, dark against the light
    for (let i = 0; i < 10; i++) leaves(fg, w * r(), -h * 0.01 + r() * h * 0.05, (5 + r() * 8) * u, (3 + r() * 4) * u, 200, 1.2 * u, -0.3);
    this.ferns = Array.from({ length: 7 }, (_, i) => ({
      x: (i / 6) * w + rand(-0.05, 0.05) * w,
      y: h * rand(0.96, 1.03),
      len: rand(14, 26) * u,
      ph: rand(0, TAU),
      side: i % 2 ? 1 : -1,
    }));

    // ---- what moves
    this.streaks = [];
    for (const f of this.flows) {
      for (let i = 0; i < f.n; i++) this.streaks.push(this.streak(f, true));
    }
    this.foams = this.flows.filter((f) => f.kind === 'fall').map((f) => {
      const e = f.secs[f.secs.length - 1];
      return { x: e.x, y: e.y, r: e.hw * 1.3 };
    });
    // foam and ripples drifting away from the fan across the pool, toward you
    this.drift = Array.from({ length: 34 }, () => this.flake(true));
    this.mist = Array.from({ length: 14 }, () => this.puff(true));
    this.glints = Array.from({ length: 30 }, () => ({ x: rand(0.1, 0.9) * w, y: rand(0.7, 0.97) * h, ph: rand(0, TAU) }));
  }

  streak(f, anywhere) {
    return {
      f,
      u: anywhere ? Math.random() : -Math.random() * 0.15,
      v: rand(-0.9, 0.9),
      sp: f.speed * rand(0.8, 1.25),
      l: f.kind === 'fall' || f.kind === 'curtain' ? rand(0.2, 0.4) : f.kind === 'run' ? rand(0.2, 0.4) : rand(0.08, 0.16),
      a: rand(0.25, 0.8),
    };
  }

  // a fleck of foam or a ripple, carried from the foot of the fan out across the pool
  flake(anywhere) {
    const { w, h } = this;
    const k = Math.random() * 2 - 1;
    return {
      x: w * 0.43 + k * w * 0.3,
      y: h * (0.69 + (anywhere ? Math.random() * 0.3 : 0)),
      vx: k * w * 0.012,
      vy: h * rand(0.012, 0.022),
      s: rand(0.6, 1.6) * this.u,
      ring: Math.random() < 0.5,
      ph: rand(0, TAU),
    };
  }

  puff(anywhere) {
    const base = this.flows[this.flows.length - 1].secs[2];
    return {
      x: base.x + rand(-1, 1) * base.hw * 1.6,
      y: base.y - (anywhere ? rand(0, 0.08) * this.h : 0),
      r: rand(3, 9) * this.u,
      vx: rand(-0.4, 0.4) * this.u,
      vy: -rand(0.4, 1.2) * this.u,
      a: rand(0.05, 0.12),
      age: anywhere ? rand(0, 8) : 0,
      life: rand(6, 11),
    };
  }

  frame(dt) {
    const { g, w, h, t, u } = this;
    g.drawImage(this.bg, 0, 0);
    // the water moving: streaks riding down every drop and tongue, batched by brightness
    const bands = [new Path2D(), new Path2D(), new Path2D()];
    for (const s of this.streaks) {
      s.u += s.sp * dt;
      if (s.u - s.l > 1) Object.assign(s, this.streak(s.f, false));
      const [x0, y0] = flowAt(s.f, s.u, s.v);
      const [x1, y1] = flowAt(s.f, s.u - s.l, s.v);
      const P = bands[s.a > 0.65 ? 2 : s.a > 0.45 ? 1 : 0];
      P.moveTo(x0, y0);
      P.lineTo(x1, y1);
    }
    g.lineCap = 'round';
    bands.forEach((P, i) => {
      g.strokeStyle = `rgba(255,255,255,${[0.35, 0.55, 0.8][i]})`;
      g.lineWidth = [0.8, 1.1, 1.4][i] * this.dpr;
      g.stroke(P);
    });
    // foam boiling at the foot of each drop
    for (const [i, f] of this.foams.entries()) {
      for (let k = 0; k < 3; k++) {
        const rr = f.r * (0.6 + k * 0.25) * (1 + 0.08 * Math.sin(t * 3 + k * 2 + i));
        g.fillStyle = `rgba(250,253,252,${0.3 - k * 0.08})`;
        g.beginPath();
        g.ellipse(f.x, f.y, rr, rr * 0.35, 0, 0, TAU);
        g.fill();
      }
    }
    // foam and ripples drifting out across the pool, spreading as they come toward you
    g.save();
    g.clip(this.pool);
    for (const d of this.drift) {
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (d.y > h * 1.02) Object.assign(d, this.flake(false));
      const near = (d.y - h * 0.66) / (h * 0.36);
      const fade = clamp(1 - near * 0.8, 0.15, 1);
      if (d.ring) {
        g.strokeStyle = `rgba(230,245,240,${0.3 * fade})`;
        g.lineWidth = 0.18 * u;
        g.beginPath();
        g.ellipse(d.x, d.y, d.s * (1.5 + near * 4), d.s * (0.3 + near * 0.8), 0, Math.PI * 1.05, Math.PI * 1.95);
        g.stroke();
      } else {
        g.fillStyle = `rgba(245,250,248,${0.4 * fade})`;
        g.beginPath();
        g.ellipse(d.x + Math.sin(t + d.ph) * u * 0.3, d.y, d.s * (1 + near * 2), d.s * (0.35 + near * 0.6), 0, 0, TAU);
        g.fill();
      }
    }
    g.restore();
    // glints on the water
    for (const s of this.glints) {
      const k = 0.5 + 0.5 * Math.sin(t * 2.4 + s.ph);
      g.fillStyle = `rgba(250,255,230,${0.45 * k * k})`;
      g.fillRect(s.x + Math.sin(t + s.ph) * u * 0.5, s.y, 1.4 * u, 0.22 * u);
    }
    // mist off the biggest drop
    for (const m of this.mist) {
      m.age += dt;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (m.age > m.life) Object.assign(m, this.puff(false));
      const k = Math.sin((m.age / m.life) * Math.PI);
      const gr = g.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * (1 + m.age / m.life));
      gr.addColorStop(0, `rgba(240,250,245,${m.a * k})`);
      gr.addColorStop(1, 'rgba(240,250,245,0)');
      g.fillStyle = gr;
      g.fillRect(m.x - m.r * 2, m.y - m.r * 2, m.r * 4, m.r * 4);
    }
    // sun slanting down through the leaves
    g.save();
    g.globalCompositeOperation = 'lighter';
    // (each shaft feathered across its width, so it reads as light and not a stripe)
    for (let i = 0; i < 4; i++) {
      const k = 0.035 + 0.02 * Math.sin(t * 0.25 + i * 1.7);
      const x0 = w * (0.52 + i * 0.06);
      const xb = x0 - w * (0.15 + i * 0.07);
      g.save();
      g.beginPath();
      g.moveTo(x0 - w * 0.01, 0);
      g.lineTo(x0 + w * 0.05, 0);
      g.lineTo(xb + w * 0.06, h * 0.85);
      g.lineTo(xb - w * 0.07, h * 0.85);
      g.closePath();
      g.clip();
      const gr = g.createLinearGradient(xb - w * 0.07, 0, xb + w * 0.06, 0);
      gr.addColorStop(0, 'rgba(255,248,210,0)');
      gr.addColorStop(0.5, `rgba(255,248,210,${k})`);
      gr.addColorStop(1, 'rgba(255,248,210,0)');
      const fade = g.createLinearGradient(0, 0, 0, h * 0.85);
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h * 0.85);
      fade.addColorStop(0, 'rgba(0,0,0,0)');
      g.restore();
    }
    g.restore();
    g.drawImage(this.front, 0, 0);
    // ferns in front, swaying
    for (const f of this.ferns) {
      const sway = Math.sin(t * 0.9 + f.ph) * 0.1;
      g.save();
      g.translate(f.x, f.y);
      g.rotate(-Math.PI / 2 + f.side * 0.5 + sway);
      g.strokeStyle = '#1d4a22';
      g.fillStyle = '#2f6a2c';
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
    this.gustPh = 0;
    this.flutterPh = 0;
    // waders that stand it out in the slough whatever the weather: a great blue heron and a great egret
    const sl = this.sloughs[0];
    this.waders = [
      { sp: 'great-blue-heron', x: sl.x + sl.rx * 0.48, y: sl.y + sl.ry * 0.2, s: 1.6, dir: -1, next: 5, min: sl.x + sl.rx * 0.4, max: sl.x + sl.rx * 0.58 },
      { sp: 'great-egret', x: sl.x + sl.rx * 0.2, y: sl.y - sl.ry * 0.1, s: 1.4, dir: 1, next: 11, min: sl.x + sl.rx * 0.12, max: sl.x + sl.rx * 0.28 },
    ];
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
    if (sp === 'great-egret' || sp === 'osprey' || sp === 'great-blue-heron') {
      // one bird, one crossing: its next calls come from the bird already on its way over
      const key = e.bird ?? sp;
      if (this.flyers.some((f) => f.key === key)) return;
      // or the heron or egret standing in the slough is the one calling
      const wd = this.waders.find((x) => x.sp === sp);
      if (wd && Math.random() < 0.45) {
        wd.callUntil = this.t + (e.dur || 2);
        return;
      }
      const fromLeft = Math.random() < 0.5;
      const y = sp === 'osprey' ? rand(0.1, 0.25) : sp === 'great-blue-heron' ? rand(0.18, 0.4) : rand(0.3, 0.5);
      this.flyers.push({ key, sp, x: fromLeft ? -0.05 * w : 1.05 * w, y: y * h, v: (fromLeft ? 1 : -1) * rand(0.04, 0.07) * w, ph: rand(0, TAU) });
    } else if (sp === 'sandhill-crane') {
      // a pair out on the prairie, staying a good while
      this.cranes = { x: this.cranes && this.t < this.cranes.until ? this.cranes.x : rand(0.45, 0.85) * w, until: this.t + rand(150, 320) };
    } else if (sp === 'limpkin') {
      const L = this.limpkin && this.t < this.limpkin.until ? this.limpkin : null;
      this.limpkin = { x: L ? L.x : this.sloughs[0].x + rand(0.68, 0.8) * this.sloughs[0].rx, until: this.t + rand(60, 150), sing: this.t, singUntil: this.t + (e.dur || 2) };
    } else if (GLADES_BIRDS[sp]) {
      const existing = this.perched.find((p) => p.key === (e.bird ?? sp));
      // blackbirds hang on to their cattails a good while after singing, rain or not
      if (existing) {
        existing.until = this.t + (e.dur || 2);
        existing.gone = Math.max(existing.gone, this.t + (e.dur || 2) + rand(45, 120));
        return;
      }
      const free = this.cattails.filter((c) => !this.perched.some((p) => p.cat === c));
      const cat = free[Math.floor(Math.random() * free.length)];
      if (cat) this.perched.push({ key: e.bird ?? sp, look: GLADES_BIRDS[sp], cat, until: this.t + (e.dur || 2), gone: this.t + (e.dur || 2) + rand(45, 120), sing: this.t });
    }
  }

  frame(dt) {
    const { g, w, h, t, u } = this;
    const storm = this.drivers.storm ?? 0.3;
    const after = this.drivers.after ?? 0;
    const dark = clamp((storm - 0.15) / 0.75, 0, 1);
    const rain = clamp((storm - 0.35) / 0.5, 0, 1);
    const wind = clamp((storm - 0.3) / 0.45, 0, 1);
    // gusts: a slow, uneven swell that rolls across the prairie. The phases add up frame by frame, so
    // nothing speeds up or jitters as the wind rises and falls.
    this.gustPh += dt * (0.22 + wind * 0.4);
    this.flutterPh += dt * (1.1 + wind * 1.3);
    const gustAt = (x) => {
      const p = this.gustPh - (x / w) * 2.4;
      return clamp(0.5 + 0.28 * Math.sin(p) + 0.17 * Math.sin(p * 2.13 + 1.3) + 0.08 * Math.sin(p * 4.7 + 0.4), 0, 1);
    };
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

    // birds out on the prairie, and the waders in the slough
    if (this.cranes && t < this.cranes.until) this.drawCranes();
    if (this.limpkin && t < this.limpkin.until) this.drawLimpkin();
    for (const wd of this.waders) this.drawWader(wd, storm, dark);
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
      // blown out sideways in the gusts, easing back between them, and just swaying in a breeze
      const ang = -wind * (0.12 + 0.42 * gustAt(m.x)) + Math.sin(this.flutterPh * 0.55 + m.ph) * (0.03 - wind * 0.012);
      g.setTransform(Math.cos(ang), Math.sin(ang), -Math.sin(ang), Math.cos(ang), m.x, m.y);
      g.drawImage(m.lit.c, -m.lit.ax, -m.lit.ay);
      if (dark > 0) {
        g.globalAlpha = Math.min(1, dark * 1.1);
        g.drawImage(m.dim.c, -m.dim.ax, -m.dim.ay);
        g.globalAlpha = 1;
      }
    }
    g.setTransform(1, 0, 0, 1, 0, 0);

    // the near sawgrass and cattails: a breeze sways them; a storm wind lays them over, further in
    // each gust as it rolls across, with a flutter on top
    const shade = (c) => (dark > 0 ? mix(c, '#1f2426', dark * 0.45) : c);
    g.lineCap = 'round';
    for (const b of this.blades) {
      const sway = wind * (0.1 + 0.42 * gustAt(b.x)) + Math.sin(this.flutterPh + b.ph) * (0.045 - wind * 0.025) + b.lean;
      g.strokeStyle = shade(b.col);
      g.lineWidth = 0.35 * u;
      g.beginPath();
      g.moveTo(b.x, h + u);
      g.quadraticCurveTo(b.x + sway * b.hgt * 0.3, h - b.hgt * 0.6, b.x + sway * b.hgt, h - b.hgt);
      g.stroke();
    }
    for (const c of this.cattails) {
      const sway = wind * (0.06 + 0.28 * gustAt(c.x)) + Math.sin(this.flutterPh * 0.7 + c.ph) * (0.025 - wind * 0.01);
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
      const slant = 0.12 + wind * (0.12 + 0.3 * gustAt(w * 0.5));
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

  // A heron or egret standing in the slough: still for long spells, now and then a step, a look the
  // other way, a stab at a fish or a long stretch of the neck; hunched up with its neck drawn in when it
  // pours; mirrored in the water.
  drawWader(wd, storm, dark) {
    const { g, t, u } = this;
    if (t > wd.next) {
      const r = Math.random();
      wd.act = r < 0.3 ? 'step' : r < 0.5 ? 'look' : r < 0.8 ? 'strike' : 'stretch';
      wd.t0 = t;
      wd.dur = { step: 1.8, look: 0.5, strike: 1.1, stretch: 4 }[wd.act];
      wd.next = t + wd.dur + rand(6, 24);
      if (wd.act === 'look') wd.dir = -wd.dir;
      if (wd.act === 'step') {
        wd.from = wd.x;
        wd.to = clamp(wd.x + wd.dir * rand(1.5, 3.5) * u, wd.min, wd.max);
        if (wd.to === wd.from) wd.dir = -wd.dir;
      }
    }
    const k = wd.act ? clamp((t - wd.t0) / wd.dur, 0, 1) : 1;
    if (wd.act === 'step' && k < 1) {
      wd.x = lerp(wd.from, wd.to, k * k * (3 - 2 * k));
      if (Math.random() < 0.08) this.ripples.push({ x: wd.x, y: wd.y, age: 0 });
    }
    if (wd.act === 'strike' && k > 0.35 && k < 0.45 && !wd.splashed) {
      wd.splashed = true;
      this.ripples.push({ x: wd.x + wd.dir * 3 * wd.s * u, y: wd.y + 0.3 * u, age: 0 });
    }
    if (wd.act !== 'strike' || k >= 1) wd.splashed = false;
    // neck: drawn in when it pours, raised to look about, right out at the water to strike
    let up = 0.75 - clamp((storm - 0.5) / 0.35, 0, 1) * 0.75;
    if (wd.act === 'stretch' && k < 1) up = Math.max(up, Math.sin(k * Math.PI));
    const calling = t < (wd.callUntil ?? 0);
    if (calling) up = Math.max(up, 0.85);
    const reach = wd.act === 'strike' && k < 1 ? Math.sin(k * Math.PI) ** 0.7 : 0;
    const heron = wd.sp === 'great-blue-heron';
    const tone = (c) => (dark > 0 ? mix(c, '#1f2426', dark * (heron ? 0.4 : 0.3)) : c);
    const col = heron
      ? { body: tone('#7a8da3'), wing: tone('#5d6f86'), neck: tone('#a3a9b4'), head: tone('#e9e9e6'), crown: tone('#1d2228'), bill: tone('#d4a33a'), legs: tone('#4b4338') }
      : { body: tone('#f6f5ef'), wing: tone('#e6e5de'), neck: tone('#f6f5ef'), head: tone('#f6f5ef'), crown: null, bill: tone('#e6c22c'), legs: tone('#1a1a1a') };
    const s = wd.s * u;
    const shape = () => {
      const d = wd.dir;
      // legs, the front one a little forward
      g.strokeStyle = col.legs;
      g.lineWidth = 0.16 * s;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(-0.15 * s, -3.6 * s);
      g.lineTo(-0.25 * s * d, 0);
      g.moveTo(0.15 * s, -3.6 * s);
      g.lineTo(0.3 * s * d, 0);
      g.stroke();
      // body, tilted up at the front, the back feathers trailing
      g.fillStyle = col.body;
      g.beginPath();
      g.ellipse(0, -4.3 * s, 1.75 * s, 0.8 * s, -0.22 * d, 0, TAU);
      g.fill();
      g.fillStyle = col.wing;
      g.beginPath();
      g.moveTo(-1.6 * s * d, -4.1 * s);
      g.quadraticCurveTo(-0.2 * s * d, -5.1 * s, 0.9 * s * d, -4.7 * s);
      g.quadraticCurveTo(-0.6 * s * d, -3.9 * s, -2.3 * s * d, -3.5 * s);
      g.closePath();
      g.fill();
      // the neck, an S that straightens as it reaches out
      const lerp2 = (a, b, k2) => [lerp(a[0], b[0], k2), lerp(a[1], b[1], k2)];
      const base = [1.2 * d, -4.8];
      const head = lerp2(lerp2([1.35 * d, -5.75], [1.85 * d, -8.3], up), [3.1 * d, -2.7], reach);
      const ctrl = lerp2(lerp2([1.7 * d, -5.0], [0.6 * d, -6.8], up), [2.5 * d, -4.7], reach);
      g.strokeStyle = col.neck;
      g.lineWidth = (heron ? 0.5 : 0.36) * s;
      g.beginPath();
      g.moveTo(base[0] * s, base[1] * s);
      g.quadraticCurveTo(ctrl[0] * s, ctrl[1] * s, head[0] * s, head[1] * s);
      g.stroke();
      // the head and its dagger of a bill, open while it calls
      const hx = head[0] * s;
      const hy = head[1] * s;
      const ang = lerp(0.12, 1.05, reach);
      const bl = (heron ? 1.7 : 1.5) * s;
      g.fillStyle = col.head;
      g.beginPath();
      g.ellipse(hx, hy, 0.48 * s, 0.32 * s, ang * d, 0, TAU);
      g.fill();
      if (col.crown) {
        // the black stripe over the eye, running back into the plume
        g.strokeStyle = col.crown;
        g.lineWidth = 0.14 * s;
        g.beginPath();
        g.moveTo(hx + 0.3 * s * d, hy - 0.2 * s);
        g.lineTo(hx - 0.35 * s * d, hy - 0.25 * s);
        g.lineTo(hx - 1.1 * s * d, hy - 0.05 * s);
        g.stroke();
      }
      const gape = calling ? 0.12 : 0;
      g.fillStyle = col.bill;
      g.beginPath();
      g.moveTo(hx + 0.3 * s * d * Math.cos(ang), hy - 0.12 * s);
      g.lineTo(hx + d * Math.cos(ang - gape) * bl, hy + Math.sin(ang - gape) * bl);
      g.lineTo(hx + 0.3 * s * d * Math.cos(ang), hy + 0.1 * s);
      g.lineTo(hx + d * Math.cos(ang + gape) * bl, hy + Math.sin(ang + gape) * bl);
      g.closePath();
      g.fill();
    };
    g.save();
    g.translate(wd.x, wd.y);
    shape();
    g.restore();
    // its reflection, broken up by the rain
    g.save();
    g.clip(this.sloughs[0].path);
    g.globalAlpha = 0.2 * (1 - clamp((storm - 0.4) / 0.5, 0, 0.8));
    g.translate(wd.x, wd.y);
    g.scale(1, -0.8);
    shape();
    g.restore();
  }

  drawFlyer(f) {
    const { g, t, u } = this;
    if (f.sp === 'great-blue-heron') {
      // big, slow, deep wingbeats; neck folded back, legs trailing
      const s = 2.4 * u;
      const flap = Math.sin(t * 2 + f.ph);
      g.save();
      g.translate(f.x, f.y);
      if (f.v < 0) g.scale(-1, 1);
      g.fillStyle = '#6f8298';
      g.beginPath();
      g.moveTo(-s * 0.4, 0);
      g.quadraticCurveTo(-s * 0.9, -s * 0.5 - flap * s * 0.6, -s * 2, -flap * s * 1.1);
      g.quadraticCurveTo(-s * 0.9, s * 0.1 - flap * s * 0.3, s * 0.3, s * 0.15);
      g.moveTo(s * 0.4, 0);
      g.quadraticCurveTo(s * 0.9, -s * 0.5 - flap * s * 0.6, s * 2, -flap * s * 1.1);
      g.quadraticCurveTo(s * 0.9, s * 0.1 - flap * s * 0.3, -s * 0.3, s * 0.15);
      g.fill();
      g.fillStyle = '#7e90a5';
      g.beginPath();
      g.ellipse(0, s * 0.08, s * 0.8, s * 0.24, 0, 0, TAU);
      g.fill();
      g.beginPath();
      g.arc(s * 0.85, -s * 0.02, s * 0.2, 0, TAU);
      g.fill();
      g.fillStyle = '#d4a33a';
      g.beginPath();
      g.moveTo(s * 1, -s * 0.07);
      g.lineTo(s * 1.65, s * 0.02);
      g.lineTo(s * 1, s * 0.06);
      g.fill();
      g.strokeStyle = '#4b4338';
      g.lineWidth = 0.14 * u;
      g.beginPath();
      g.moveTo(-s * 0.7, s * 0.15);
      g.lineTo(-s * 1.75, s * 0.28);
      g.stroke();
      g.restore();
      return;
    }
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
// The great hall of a castle in the Highlands, looking down its length: four long tables running
// up to the dais, tall windows down both walls, candles floating in their hundreds under an
// enchanted ceiling that shows the sky. At Halloween the sky is a storm, jack-o'-lanterns float
// among the candles and bats flit under the roof; at Christmas it snows from the ceiling (the
// flakes fade before they reach the tables) and twelve frosted trees stand along the walls.
const HALL = { eye: 0.42, top: 3.2, far: 4.2, near: 0.12 }; // the hall's unit is about 10 m
const HALL_PIERS = [0.82, 1.6, 2.24, 2.93, 3.68]; // between the windows: piers, banners, torches, arches
const HOUSE_BANNERS = [
  ['#7a1622', '#d4a640'], // crimson and gold
  ['#1b4a2e', '#b9c2c6'], // green and silver
  ['#1d2f68', '#b07a45'], // blue and bronze
  ['#c9961c', '#1a1612'], // yellow and black
];
// two moods for the one hall: plum stone and coral light for Halloween, indigo and gold for Christmas
const HALL_PAL = {
  halloween: { dark: '#24122a', mid: '#4e2846', lit: '#7c3e5c', edge: '#a0566c', rim: '#ff9a76', floor: ['#22121f', '#4a2a3e'], sky: ['#10061a', '#3e1a44'], glass: ['#1a0e2c', '#3a2054'] },
  christmas: { dark: '#0f1830', mid: '#233658', lit: '#3a5480', edge: '#5a74a0', rim: '#ffd08a', floor: ['#121a30', '#2a3656'], sky: ['#060e26', '#1e3462'], glass: ['#0f2240', '#2a4a74'] },
};

// one carved pumpkin, lit from inside, as a sprite (centre at the middle)
function jackSprite(R, lit = 1) {
  const c = layer(Math.ceil(R * 2.4), Math.ceil(R * 2.4));
  const g = c.getContext('2d');
  const cx = c.width / 2;
  const cy = c.height / 2 + R * 0.08;
  // ribbed body: overlapping lobes, darker toward the edges
  for (const [dx, rx, col] of [
    [-0.55, 0.55, '#b34a10'],
    [0.55, 0.55, '#b34a10'],
    [-0.28, 0.6, '#d0621a'],
    [0.28, 0.6, '#d0621a'],
    [0, 0.62, '#e2782a'],
  ]) {
    g.fillStyle = col;
    g.beginPath();
    g.ellipse(cx + dx * R, cy, rx * R, R * 0.82, 0, 0, TAU);
    g.fill();
  }
  g.strokeStyle = 'rgba(90,30,5,0.5)';
  g.lineWidth = R * 0.04;
  for (const dx of [-0.42, 0, 0.42]) {
    g.beginPath();
    g.ellipse(cx + dx * R, cy, R * 0.32, R * 0.8, 0, -Math.PI / 2, Math.PI / 2, dx > 0);
    g.stroke();
  }
  // stem
  g.fillStyle = '#4a3a1a';
  g.beginPath();
  g.moveTo(cx - R * 0.08, cy - R * 0.74);
  g.quadraticCurveTo(cx - R * 0.02, cy - R * 1.02, cx + R * 0.16, cy - R * 1.08);
  g.lineTo(cx + R * 0.12, cy - R * 0.92);
  g.lineTo(cx + R * 0.08, cy - R * 0.72);
  g.fill();
  // the carved face, glowing
  const glow = `rgba(255,${200 + 30 * lit},${90 + 40 * lit},1)`;
  g.fillStyle = glow;
  g.shadowColor = 'rgba(255,190,80,0.9)';
  g.shadowBlur = R * 0.25;
  const tri = (x, y, s, flip) => {
    g.beginPath();
    g.moveTo(cx + (x - s) * R, cy + (y + (flip ? -s : s) * 0.6) * R);
    g.lineTo(cx + (x + s) * R, cy + (y + (flip ? -s : s) * 0.6) * R);
    g.lineTo(cx + x * R, cy + (y - (flip ? -s : s) * 0.6) * R);
    g.fill();
  };
  tri(-0.3, -0.18, 0.15);
  tri(0.3, -0.18, 0.15);
  tri(0, 0.04, 0.08, true);
  g.beginPath(); // a jagged grin
  const m = [
    [-0.48, 0.2],
    [-0.36, 0.3],
    [-0.28, 0.22],
    [-0.16, 0.36],
    [-0.04, 0.26],
    [0.08, 0.38],
    [0.2, 0.26],
    [0.32, 0.34],
    [0.48, 0.2],
    [0.36, 0.5],
    [0.12, 0.56],
    [0.04, 0.48],
    [-0.08, 0.58],
    [-0.3, 0.52],
  ];
  g.moveTo(cx + m[0][0] * R, cy + m[0][1] * R);
  for (const [x, y] of m.slice(1)) g.lineTo(cx + x * R, cy + y * R);
  g.closePath();
  g.fill();
  return c;
}

class GreatHall extends Painting {
  get season() {
    return 'halloween';
  }
  // world → screen: X across the hall (the walls at ±1), Y up from the floor, d down the hall
  P(X, Y, d) {
    return [this.vx + (this.F * X) / d, this.vy - (this.F * (Y - HALL.eye)) / d];
  }

  build() {
    const { w, h } = this;
    const xmas = this.season === 'christmas';
    const C = (this.C = HALL_PAL[this.season]);
    this.F = Math.min(w, h * 0.9) * 0.5;
    this.vx = w / 2;
    this.vy = h * 0.6;
    const P = (X, Y, d) => this.P(X, Y, d);
    const F = this.F;
    const { top: T, far: D, near: N } = HALL;
    let seed = 11;
    const r = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    const R = (a, b) => a + r() * (b - a);

    this.hall = layer(w, h);
    const g = this.hall.getContext('2d');
    const poly = (pts, pen = g) => {
      pen.moveTo(...pts[0]);
      for (const p of pts.slice(1)) pen.lineTo(...p);
      pen.closePath();
    };
    const seg = (a, b) => {
      g.moveTo(...a);
      g.lineTo(...b);
    };

    // the enchanted ceiling is everything above the walls' tops: drawn live, so left clear here
    this.sky = new Path2D();
    poly([P(-1, T, N), P(-1, T, D), P(1, T, D), P(1, T, N)], this.sky);
    this.skyTop = Math.max(0, P(0, T, D)[1]);

    // --- the far wall, with the great window over the dais
    const farTop = P(-1, T, D)[1];
    const farBot = P(-1, 0, D)[1];
    const VAULT = 0.95; // how far the arches rise above the tops of the walls
    const gable = (pen, d, lift = 0, inset = 0, cont = false) => {
      const l = P(-1 + inset, T, d);
      const a = P(0, T + VAULT - lift, d);
      const rr = P(1 - inset, T, d);
      if (cont) pen.lineTo(...l);
      else pen.moveTo(...l);
      pen.quadraticCurveTo(l[0] + (a[0] - l[0]) * 0.12, l[1] - (l[1] - a[1]) * 0.82, ...a);
      pen.quadraticCurveTo(rr[0] - (rr[0] - a[0]) * 0.12, rr[1] - (rr[1] - a[1]) * 0.82, ...rr);
    };
    g.fillStyle = vgrad(g, P(0, T + VAULT, D)[1], farBot, [
      [0, C.dark],
      [0.55, C.mid],
      [1, C.dark],
    ]);
    g.beginPath();
    g.moveTo(...P(-1, 0, D));
    gable(g, D, 0, 0, true);
    g.lineTo(...P(1, 0, D));
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(18,12,14,0.5)';
    g.lineWidth = Math.max(1, (F * 0.006) / D);
    g.beginPath();
    for (let Y = 0.12, k = 0; Y < T; Y += 0.12, k++) {
      seg(P(-1, Y, D), P(1, Y, D));
      for (let X = -1 + (k % 2) * 0.1; X < 1; X += 0.2) seg(P(X, Y - 0.12, D), P(X, Y, D));
    }
    g.stroke();
    const farWindow = (pen) => {
      const [xa, y0] = P(-0.4, 0.62, D);
      const [xb] = P(0.4, 0.62, D);
      const y1 = P(0, 2.25, D)[1];
      const ya = P(0, 2.85, D)[1];
      const xm = (xa + xb) / 2;
      pen.moveTo(xa, y0);
      pen.lineTo(xa, y1);
      pen.quadraticCurveTo(xa + (xm - xa) * 0.1, y1 - (y1 - ya) * 0.8, xm, ya);
      pen.quadraticCurveTo(xb - (xb - xm) * 0.1, y1 - (y1 - ya) * 0.8, xb, y1);
      pen.lineTo(xb, y0);
      pen.closePath();
    };

    // --- the side walls: stone courses, tall lancet windows, banners, torches and two hearths
    this.glass = new Path2D();
    farWindow(this.glass);
    const WIN = [1.12, 1.74, 2.4, 3.1];
    const WD = 0.36;
    const sideWindow = (pen, s, d0, d1, y0 = 0.75, y1 = 2.3, apex = 2.72) => {
      const dm = (d0 + d1) / 2;
      pen.moveTo(...P(s, y0, d0));
      pen.lineTo(...P(s, y1, d0));
      pen.quadraticCurveTo(...P(s, y1 + (apex - y1) * 0.8, d0 + (dm - d0) * 0.12), ...P(s, apex, dm));
      pen.quadraticCurveTo(...P(s, y1 + (apex - y1) * 0.8, d1 - (d1 - dm) * 0.12), ...P(s, y1, d1));
      pen.lineTo(...P(s, y0, d1));
      pen.closePath();
    };
    this.torches = [];
    this.hearths = [];
    this.lights = []; // the giant pumpkins' faces, flickering
    for (const s of [-1, 1]) {
      const near = P(s, T * 0.5, 0.45)[0];
      const far = P(s, T * 0.5, D)[0];
      const gr = g.createLinearGradient(near, 0, far, 0);
      gr.addColorStop(0, C.dark);
      gr.addColorStop(0.45, C.mid);
      gr.addColorStop(1, C.dark);
      g.fillStyle = gr;
      g.beginPath();
      poly([P(s, 0, N), P(s, T, N), P(s, T, D), P(s, 0, D)]);
      g.fill();
      // stones, each a slightly different tint
      for (let Y = 0, k = 0; Y < T - 0.01; Y += 0.12, k++) {
        for (let d = N + (k % 2) * 0.13; d < D; d += 0.26) {
          const d1 = Math.min(D, d + 0.26);
          const v = R(-1, 1);
          g.fillStyle = v > 0 ? `rgba(255,225,190,${v * 0.05})` : `rgba(0,0,0,${-v * 0.1})`;
          g.beginPath();
          poly([P(s, Y, d), P(s, Y + 0.12, d), P(s, Y + 0.12, d1), P(s, Y, d1)]);
          g.fill();
        }
      }
      g.strokeStyle = 'rgba(16,10,12,0.55)';
      g.beginPath();
      for (let Y = 0.12, k = 0; Y < T; Y += 0.12, k++) seg(P(s, Y, N), P(s, Y, D));
      g.lineWidth = Math.max(1, F * 0.004);
      g.stroke();
      g.beginPath();
      for (let Y = 0, k = 0; Y < T - 0.01; Y += 0.12, k++) for (let d = N + (k % 2) * 0.13; d < D; d += 0.26) seg(P(s, Y, d), P(s, Y + 0.12, d));
      g.stroke();
      // warm light from the candles in the middle of the wall, dark toward the floor and roof
      const yl = P(s, 2.2, 1)[1];
      const wash = g.createLinearGradient(0, P(s, T, 0.8)[1], 0, P(s, 0, 0.8)[1]);
      wash.addColorStop(0, 'rgba(10,6,12,0.55)');
      wash.addColorStop(0.45, 'rgba(255,170,90,0.07)');
      wash.addColorStop(1, 'rgba(8,5,6,0.5)');
      g.fillStyle = wash;
      g.beginPath();
      poly([P(s, 0, N), P(s, T, N), P(s, T, D), P(s, 0, D)]);
      g.fill();
      void yl;
      // windows
      for (const d0 of WIN) {
        const d1 = d0 + WD;
        sideWindow(this.glass, s, d0, d1);
        // the deep stone reveal around the glass
        g.beginPath();
        sideWindow(g, s, d0 - 0.05, d1 + 0.05, 0.68, 2.3, 2.8);
        g.fillStyle = C.lit;
        g.fill();
        g.strokeStyle = C.rim;
        g.globalAlpha = 0.55;
        g.lineWidth = Math.max(1, (F * 0.006) / d0);
        g.stroke();
        g.globalAlpha = 1;
        g.beginPath();
        sideWindow(g, s, d0, d1);
        const gy0 = P(s, 2.7, d0)[1];
        const gy1 = P(s, 0.75, d0)[1];
        g.fillStyle = vgrad(g, gy0, gy1, [
          [0, C.glass[0]],
          [1, C.glass[1]],
        ]);
        g.fill();
        // leading and the mullion
        g.save();
        g.clip();
        g.strokeStyle = 'rgba(20,16,24,0.85)';
        g.lineWidth = Math.max(1, (F * 0.012) / d0);
        g.beginPath();
        seg(P(s, 0.75, (d0 + d1) / 2), P(s, 2.72, (d0 + d1) / 2));
        seg(P(s, 1.5, d0), P(s, 1.5, d1));
        g.stroke();
        g.lineWidth = Math.max(0.6, (F * 0.004) / d0);
        g.beginPath();
        for (let Y = 0.85; Y < 2.7; Y += 0.1) seg(P(s, Y, d0), P(s, Y, d1));
        g.globalAlpha = 0.5;
        g.stroke();
        g.globalAlpha = 1;
        if (xmas) {
          // snow banked against the panes
          g.fillStyle = 'rgba(232,240,250,0.85)';
          g.beginPath();
          g.moveTo(...P(s, 0.75, d0));
          for (let k = 0; k <= 8; k++) g.lineTo(...P(s, 0.8 + Math.sin(k * 1.7) * 0.02 + (k % 4 === 0 ? 0.025 : 0), d0 + (WD * k) / 8));
          g.lineTo(...P(s, 0.75, d1));
          g.fill();
          g.fillStyle = 'rgba(230,238,250,0.5)';
          for (let k = 0; k < 14; k++) {
            const [x, y] = P(s, R(0.85, 2.6), R(d0, d1));
            g.fillRect(x, y, Math.max(1, F * 0.006 / d0), Math.max(1, F * 0.006 / d0));
          }
        } else {
          // rain running down the glass
          g.strokeStyle = 'rgba(150,150,210,0.25)';
          g.lineWidth = Math.max(0.6, (F * 0.003) / d0);
          g.beginPath();
          for (let k = 0; k < 10; k++) {
            const dd = R(d0, d1);
            const Y = R(0.85, 2.5);
            seg(P(s, Y, dd), P(s, Y - R(0.08, 0.25), dd));
          }
          g.stroke();
        }
        g.restore();
        // the sill
        g.fillStyle = C.edge;
        g.beginPath();
        poly([P(s, 0.75, d0 - 0.05), P(s, 0.75, d1 + 0.05), P(s * 0.97, 0.72, d1 + 0.05), P(s * 0.97, 0.72, d0 - 0.05)]);
        g.fill();
      }
      // banners between the windows, in the four house colours
      const gaps = HALL_PIERS;
      for (const dc of gaps) {
        // a pier, standing proud of the wall, with a capital where the arch springs
        const face = [P(s * 0.965, 0, dc - 0.055), P(s * 0.965, T, dc - 0.055), P(s * 0.965, T, dc + 0.055), P(s * 0.965, 0, dc + 0.055)];
        g.fillStyle = C.mid;
        g.beginPath();
        poly([P(s, 0, dc - 0.055), P(s, T, dc - 0.055), P(s * 0.965, T, dc - 0.055), P(s * 0.965, 0, dc - 0.055)]);
        g.fill();
        g.fillStyle = C.lit;
        g.beginPath();
        poly(face);
        g.fill();
        g.strokeStyle = C.rim;
        g.globalAlpha = 0.6;
        g.lineWidth = Math.max(1, (F * 0.008) / dc);
        g.beginPath();
        seg(face[0], face[1]);
        g.stroke();
        g.globalAlpha = 1;
        g.fillStyle = C.edge;
        g.beginPath();
        poly([P(s * 0.95, T - 0.12, dc - 0.075), P(s * 0.95, T - 0.03, dc - 0.075), P(s * 0.95, T - 0.03, dc + 0.075), P(s * 0.95, T - 0.12, dc + 0.075)]);
        g.fill();
      }
      gaps.forEach((dc, i) => {
        const [col, trim] = HOUSE_BANNERS[(i + (s > 0 ? 1 : 0)) % 4];
        const b0 = dc - 0.07;
        const b1 = dc + 0.07;
        const yb = 1.3;
        g.fillStyle = col;
        g.beginPath();
        const flag = [P(s * 0.955, 2.92, b0), P(s * 0.955, 2.92, b1), P(s * 0.955, yb, b1), P(s * 0.955, yb + 0.16, dc), P(s * 0.955, yb, b0)];
        poly(flag);
        g.fill();
        // the harlequin pattern: diamonds, light and dark
        g.save();
        g.clip();
        g.lineWidth = Math.max(1, (F * 0.01) / dc);
        for (const [dir, col] of [
          [1, 'rgba(255,255,255,0.22)'],
          [-1, 'rgba(0,0,0,0.3)'],
        ]) {
          g.strokeStyle = col;
          g.beginPath();
          for (let Y = 3.1; Y > yb - 0.4; Y -= 0.16) seg(P(s * 0.955, Y, dir > 0 ? b0 : b1), P(s * 0.955, Y - 0.16, dir > 0 ? b1 : b0));
          g.stroke();
        }
        g.restore();
        g.beginPath();
        poly(flag);
        g.strokeStyle = trim;
        g.lineWidth = Math.max(1, (F * 0.01) / dc);
        g.stroke();
        // a fold of shadow down the middle
        g.strokeStyle = 'rgba(0,0,0,0.25)';
        g.lineWidth = Math.max(1, (F * 0.02) / dc);
        g.beginPath();
        seg(P(s * 0.955, 2.88, dc), P(s * 0.955, yb + 0.18, dc));
        g.stroke();
        // the pole
        g.strokeStyle = '#2a2018';
        g.lineWidth = Math.max(1, (F * 0.012) / dc);
        g.beginPath();
        seg(P(s * 0.955, 2.94, b0 - 0.02), P(s * 0.955, 2.94, b1 + 0.02));
        g.stroke();
        // a torch in an iron bracket below
        const [tx, ty] = P(s * 0.955, 0.55, dc);
        const sc = F / dc;
        g.fillStyle = '#1c1512';
        g.fillRect(tx - sc * 0.005, ty, sc * 0.01, sc * 0.05);
        g.beginPath();
        g.moveTo(tx - sc * 0.014, ty);
        g.lineTo(tx + sc * 0.014, ty);
        g.lineTo(tx + sc * 0.007, ty + sc * 0.018);
        g.lineTo(tx - sc * 0.007, ty + sc * 0.018);
        g.fill();
        this.torches.push({ x: tx, y: ty, s: sc, ph: R(0, TAU) });
      });
      // a great hearth on each wall, under the windows
      const [h0, h1] = s > 0 ? [1.32, 1.72] : [2.0, 2.38];
      g.fillStyle = C.lit;
      g.beginPath();
      poly([P(s, 0, h0 - 0.08), P(s, 0.42, h0 - 0.08), P(s, 0.42, h1 + 0.08), P(s, 0, h1 + 0.08)]);
      g.fill();
      g.fillStyle = '#120a08';
      g.beginPath();
      const mouth = [P(s, 0, h0), P(s, 0.3, h0), P(s, 0.34, (h0 + h1) / 2), P(s, 0.3, h1), P(s, 0, h1)];
      poly(mouth);
      g.fill();
      g.fillStyle = C.edge;
      g.beginPath(); // the mantel shelf
      poly([P(s, 0.42, h0 - 0.1), P(s * 0.96, 0.42, h0 - 0.1), P(s * 0.96, 0.42, h1 + 0.1), P(s, 0.42, h1 + 0.1)]);
      g.fill();
      const [mx, my] = P(s * 0.99, 0.12, (h0 + h1) / 2);
      this.hearths.push({ x: mx, y: my, s: F / ((h0 + h1) / 2), mouth });
      if (xmas) {
        // holly swags along the top of the wall
        for (let d = 0.5; d < D - 0.1; d += 0.42) {
          const d1 = Math.min(D - 0.02, d + 0.42);
          const a = P(s * 0.99, 3.04, d);
          const b = P(s * 0.99, 3.04, d1);
          const m = P(s * 0.99, 2.84, (d + d1) / 2);
          g.strokeStyle = '#1e3a22';
          g.lineWidth = Math.max(1.5, (F * 0.035) / (d + 0.2));
          g.lineCap = 'round';
          g.beginPath();
          g.moveTo(...a);
          g.quadraticCurveTo(2 * m[0] - (a[0] + b[0]) / 2, 2 * m[1] - (a[1] + b[1]) / 2, ...b);
          g.stroke();
          g.strokeStyle = '#2f5a33';
          g.lineWidth *= 0.45;
          g.stroke();
          for (let k = 0; k < 6; k++) {
            const tt = R(0.1, 0.9);
            const qx = (1 - tt) * (1 - tt) * a[0] + 2 * (1 - tt) * tt * (2 * m[0] - (a[0] + b[0]) / 2) + tt * tt * b[0];
            const qy = (1 - tt) * (1 - tt) * a[1] + 2 * (1 - tt) * tt * (2 * m[1] - (a[1] + b[1]) / 2) + tt * tt * b[1];
            g.fillStyle = '#c0182a';
            g.beginPath();
            g.arc(qx + R(-2, 2), qy + R(-2, 2), Math.max(1, (F * 0.012) / (d + 0.2)), 0, TAU);
            g.fill();
          }
        }
      }
    }
    // the cornice along the tops of the walls
    g.fillStyle = C.lit;
    for (const s of [-1, 1]) {
      g.beginPath();
      poly([P(s, T, N), P(s, T, D), P(s, T - 0.08, D), P(s, T - 0.08, N)]);
      g.fill();
    }
    g.beginPath();
    poly([P(-1, T, D), P(1, T, D), P(1, T - 0.08, D), P(-1, T - 0.08, D)]);
    g.fill();
    g.strokeStyle = C.rim;
    g.globalAlpha = 0.5;
    g.lineWidth = Math.max(1, F * 0.004);
    g.beginPath();
    for (const s of [-1, 1]) seg(P(s, T - 0.08, N), P(s, T - 0.08, D));
    g.stroke();
    g.globalAlpha = 1;
    // ribbed arches across the vault, springing from the piers, with the sky between them
    for (const dc of [...HALL_PIERS].reverse()) {
      if (P(0, T + VAULT, dc)[1] < -this.h * 0.6) continue;
      g.beginPath();
      gable(g, dc, 0.03, 0.035);
      g.strokeStyle = C.mid;
      g.lineWidth = (F * 0.13) / dc;
      g.lineCap = 'butt';
      g.stroke();
      g.strokeStyle = C.lit;
      g.lineWidth = (F * 0.08) / dc;
      g.stroke();
      g.beginPath();
      gable(g, dc, 0.09, 0.08);
      g.strokeStyle = C.rim;
      g.globalAlpha = 0.65;
      g.lineWidth = Math.max(1, (F * 0.008) / dc);
      g.stroke();
      g.globalAlpha = 1;
    }

    // the far window itself, over the dais
    g.beginPath();
    farWindow(g);
    g.lineWidth = (F * 0.05) / D;
    g.strokeStyle = C.lit;
    g.stroke();
    g.fillStyle = vgrad(g, P(0, 2.9, D)[1], P(0, 0.62, D)[1], [
      [0, C.glass[0]],
      [1, C.glass[1]],
    ]);
    g.fill();
    g.save();
    g.clip();
    if (xmas) {
      g.fillStyle = 'rgba(232,240,250,0.85)';
      g.beginPath();
      g.moveTo(...P(-0.45, 0.62, D));
      for (let k = 0; k <= 12; k++) g.lineTo(...P(-0.4 + (0.8 * k) / 12, 0.68 + Math.sin(k * 1.3) * 0.025, D));
      g.lineTo(...P(0.45, 0.62, D));
      g.fill();
    }
    g.strokeStyle = 'rgba(22,16,26,0.9)';
    g.lineWidth = Math.max(1, (F * 0.022) / D);
    g.beginPath();
    for (const X of [-0.2, 0, 0.2]) seg(P(X, 0.62, D), P(X, 2.25, D));
    for (const Y of [1.2, 1.75]) seg(P(-0.4, Y, D), P(0.4, Y, D));
    g.stroke();
    // a rose of tracery in the head of the arch
    const [rx, ry] = P(0, 2.53, D);
    const rr = (F * 0.14) / D;
    g.beginPath();
    g.arc(rx, ry, rr, 0, TAU);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU;
      g.moveTo(rx + Math.cos(a) * rr * 0.45 + rr * 0.3, ry + Math.sin(a) * rr * 0.45);
      g.arc(rx + Math.cos(a) * rr * 0.45, ry + Math.sin(a) * rr * 0.45, rr * 0.3, 0, TAU);
    }
    g.stroke();
    g.restore();

    // --- the floor: flagstones, with a warm sheen down the aisles
    g.fillStyle = vgrad(g, P(0, 0, D)[1], h, [
      [0, C.floor[0]],
      [1, C.floor[1]],
    ]);
    g.beginPath();
    poly([P(-1, 0, N), P(1, 0, N), P(1, 0, D), P(-1, 0, D)]);
    g.fill();
    g.strokeStyle = 'rgba(12,8,10,0.45)';
    g.lineWidth = Math.max(1, F * 0.003);
    g.beginPath();
    for (let X = -1; X <= 1.001; X += 0.25) seg(P(X, 0, N), P(X, 0, D));
    for (let d = N; d < D; d *= 1.16) seg(P(-1, 0, d), P(1, 0, d));
    g.stroke();
    for (const X of [-0.4, 0, 0.4]) {
      g.fillStyle = 'rgba(255,175,95,0.05)';
      g.beginPath();
      poly([P(X - 0.1, 0, N), P(X + 0.1, 0, N), P(X + 0.1, 0, D), P(X - 0.1, 0, D)]);
      g.fill();
    }

    // --- the dais and the staff table
    const dd = D - 0.5;
    g.fillStyle = C.mid;
    g.beginPath();
    poly([P(-1, 0, dd), P(1, 0, dd), P(1, 0.1, dd), P(-1, 0.1, dd)]);
    g.fill();
    g.fillStyle = C.dark;
    g.beginPath();
    poly([P(-1, 0.1, dd), P(1, 0.1, dd), P(1, 0.1, D), P(-1, 0.1, D)]);
    g.fill();
    // high-backed chairs, the middle one grandest
    g.fillStyle = '#24170f';
    for (let X = -0.72; X <= 0.721; X += 0.12) {
      const big = Math.abs(X) < 0.05;
      const top = big ? 0.46 : 0.34;
      const hw = big ? 0.032 : 0.022;
      g.beginPath();
      poly([P(X - hw, 0.15, D - 0.1), P(X - hw, top - 0.03, D - 0.1), P(X, top + 0.02, D - 0.1), P(X + hw, top - 0.03, D - 0.1), P(X + hw, 0.15, D - 0.1)]);
      g.fill();
    }
    const dt = D - 0.3;
    g.fillStyle = xmas ? '#1d3f2a' : '#4e1620';
    g.beginPath();
    poly([P(-0.8, 0.1, dt), P(0.8, 0.1, dt), P(0.8, 0.185, dt), P(-0.8, 0.185, dt)]);
    g.fill();
    g.strokeStyle = '#c9a24a';
    g.lineWidth = Math.max(1, (F * 0.008) / dt);
    g.beginPath();
    seg(P(-0.8, 0.17, dt), P(0.8, 0.17, dt));
    g.stroke();
    g.fillStyle = '#5a3a24';
    g.beginPath();
    poly([P(-0.8, 0.185, dt), P(0.8, 0.185, dt), P(0.8, 0.185, dt + 0.1), P(-0.8, 0.185, dt + 0.1)]);
    g.fill();

    // --- the four long tables, with benches and gold plates and goblets all down them
    const TX = [-0.6, -0.2, 0.2, 0.6];
    this.tableFlames = [];
    const t0 = 0.34;
    const t1 = D - 0.78;
    for (const X of TX) {
      for (const bx of [X - 0.105, X + 0.105]) {
        const side = bx > 0 ? -1 : 1; // the face we can see is the one toward the middle
        g.fillStyle = '#3a2416';
        g.beginPath();
        poly([P(bx + side * 0.022, 0.05, t0), P(bx + side * 0.022, 0.05, t1), P(bx + side * 0.022, 0.03, t1), P(bx + side * 0.022, 0.03, t0)]);
        g.fill();
        g.fillStyle = '#5a3a22';
        g.beginPath();
        poly([P(bx - 0.022, 0.05, t0), P(bx + 0.022, 0.05, t0), P(bx + 0.022, 0.05, t1), P(bx - 0.022, 0.05, t1)]);
        g.fill();
        g.fillStyle = '#2e1c10';
        g.beginPath();
        poly([P(bx - 0.022, 0.05, t0), P(bx + 0.022, 0.05, t0), P(bx + 0.022, 0, t0), P(bx - 0.022, 0, t0)]);
        g.fill();
      }
      const side = X > 0 ? -1 : 1;
      g.fillStyle = '#26170f';
      g.beginPath();
      poly([P(X + side * 0.06, 0.085, t0), P(X + side * 0.06, 0.085, t1), P(X + side * 0.06, 0.065, t1), P(X + side * 0.06, 0.065, t0)]);
      g.fill();
      const top = [P(X - 0.06, 0.085, t0), P(X + 0.06, 0.085, t0), P(X + 0.06, 0.085, t1), P(X - 0.06, 0.085, t1)];
      g.fillStyle = vgrad(g, top[2][1], top[0][1], [
        [0, '#3a2212'],
        [1, '#6e4426'],
      ]);
      g.beginPath();
      poly(top);
      g.fill();
      // the near end: the board's edge, and legs into shadow
      g.fillStyle = '#2a170c';
      g.beginPath();
      poly([P(X - 0.06, 0.085, t0), P(X + 0.06, 0.085, t0), P(X + 0.06, 0.075, t0), P(X - 0.06, 0.075, t0)]);
      g.fill();
      g.fillStyle = 'rgba(8,4,4,0.55)';
      g.beginPath();
      poly([P(X - 0.06, 0.075, t0), P(X + 0.06, 0.075, t0), P(X + 0.075, 0, t0 + 0.03), P(X - 0.075, 0, t0 + 0.03)]);
      g.fill();
      g.fillStyle = '#1e1009';
      for (const lx of [X - 0.052, X + 0.044]) {
        g.beginPath();
        poly([P(lx, 0.075, t0 + 0.01), P(lx + 0.008, 0.075, t0 + 0.01), P(lx + 0.008, 0, t0 + 0.01), P(lx, 0, t0 + 0.01)]);
        g.fill();
      }
      g.strokeStyle = C.rim;
      g.globalAlpha = 0.4;
      g.lineWidth = Math.max(1, F * 0.004);
      g.beginPath();
      seg(top[0], top[3]);
      seg(top[1], top[2]);
      g.stroke();
      g.globalAlpha = 1;
      // places laid down both sides; down the middle, candelabra and dishes of the feast
      for (let d = t0 + 0.04, k = 0; d < t1 - 0.04; d += 0.085, k++) {
        const sc = F / d;
        for (const px of [X - 0.036, X + 0.036]) {
          const [x, y] = P(px, 0.085, d);
          const rx = sc * 0.013;
          const ry = rx * clamp((HALL.eye - 0.085) / d, 0.1, 0.8);
          g.fillStyle = '#8a6a2c';
          g.beginPath();
          g.ellipse(x, y, rx, ry, 0, 0, TAU);
          g.fill();
          g.fillStyle = '#d8b65e';
          g.beginPath();
          g.ellipse(x, y - ry * 0.12, rx * 0.72, ry * 0.62, 0, 0, TAU);
          g.fill();
          // a goblet beside every other plate
          if ((k + (px < X ? 0 : 1)) % 2 === 0) {
            const [gx, gy] = P(px + (px < X ? 0.018 : -0.018), 0.085, d + 0.03);
            const gs = F / (d + 0.03);
            const cw = gs * 0.0065;
            const ch = gs * 0.011;
            g.fillStyle = '#b08a3a';
            g.beginPath();
            g.ellipse(gx, gy, cw * 0.8, cw * 0.28, 0, 0, TAU); // foot
            g.fill();
            g.fillRect(gx - cw * 0.12, gy - ch * 0.9, cw * 0.24, ch * 0.9); // stem
            g.fillStyle = '#d4ae58';
            g.beginPath(); // bowl
            g.moveTo(gx - cw, gy - ch * 1.9);
            g.lineTo(gx + cw, gy - ch * 1.9);
            g.quadraticCurveTo(gx + cw * 0.9, gy - ch * 0.95, gx, gy - ch * 0.85);
            g.quadraticCurveTo(gx - cw * 0.9, gy - ch * 0.95, gx - cw, gy - ch * 1.9);
            g.fill();
            g.fillStyle = 'rgba(255,240,200,0.55)';
            g.fillRect(gx - cw * 0.6, gy - ch * 1.8, cw * 0.25, ch * 0.6);
          }
        }
        const [x, y] = P(X, 0.085, d + 0.042);
        const ds = F / (d + 0.042);
        if (k % 6 === 1) {
          // a gold candelabrum, three candles lit
          g.fillStyle = '#b8923e';
          g.fillRect(x - ds * 0.002, y - ds * 0.05, ds * 0.004, ds * 0.05);
          g.beginPath();
          g.ellipse(x, y, ds * 0.011, ds * 0.0035, 0, 0, TAU);
          g.fill();
          g.strokeStyle = '#b8923e';
          g.lineWidth = Math.max(1, ds * 0.003);
          g.beginPath();
          g.moveTo(x - ds * 0.02, y - ds * 0.06);
          g.quadraticCurveTo(x - ds * 0.02, y - ds * 0.04, x, y - ds * 0.04);
          g.quadraticCurveTo(x + ds * 0.02, y - ds * 0.04, x + ds * 0.02, y - ds * 0.06);
          g.stroke();
          for (const cx of [-0.02, 0, 0.02]) {
            const top = y - ds * (cx ? 0.06 : 0.07);
            g.fillStyle = '#ece0c8';
            g.fillRect(x + ds * cx - ds * 0.002, top - ds * 0.025, ds * 0.004, ds * 0.025);
            this.tableFlames.push({ x: x + ds * cx, y: top - ds * 0.025, s: ds, ph: R(0, TAU) });
          }
        } else if (k % 6 === 4 && !xmas) {
          g.drawImage(jackSprite(ds * 0.018, 0.4), x - ds * 0.022, y - ds * 0.038, ds * 0.044, ds * 0.044);
        } else if (k % 2 === 1 || k % 6 === 4) {
          // a dish: a roast, a pie, a pudding with holly on top
          const rx = ds * 0.022;
          const ry = rx * clamp((HALL.eye - 0.085) / d, 0.1, 0.8);
          g.fillStyle = '#c9a24a';
          g.beginPath();
          g.ellipse(x, y, rx, ry, 0, 0, TAU);
          g.fill();
          const kind = Math.floor(r() * 3);
          g.fillStyle = ['#7a3a1c', '#b8742e', '#4a2416'][kind];
          g.beginPath();
          g.ellipse(x, y - rx * 0.28, rx * 0.68, rx * 0.4, 0, Math.PI, 0);
          g.lineTo(x + rx * 0.68, y - rx * 0.1);
          g.lineTo(x - rx * 0.68, y - rx * 0.1);
          g.fill();
          g.fillStyle = 'rgba(255,220,170,0.3)';
          g.beginPath();
          g.ellipse(x - rx * 0.2, y - rx * 0.5, rx * 0.25, rx * 0.12, -0.3, 0, TAU);
          g.fill();
          if (xmas && kind === 2) {
            g.fillStyle = '#f2ead8';
            g.beginPath();
            g.ellipse(x, y - rx * 0.62, rx * 0.4, rx * 0.12, 0, 0, TAU);
            g.fill();
            g.fillStyle = '#c0182a';
            g.beginPath();
            g.arc(x, y - rx * 0.72, Math.max(1, rx * 0.08), 0, TAU);
            g.fill();
          }
        }
      }
    }

    // --- along the walls: twelve Christmas trees, or Hagrid-sized pumpkins
    const spots = [
      [-0.88, 1.0],
      [-0.88, 1.55],
      [-0.88, 2.62],
      [-0.88, 3.25],
      [-0.88, 3.75],
      [-0.88, 3.0],
      [0.88, 1.06],
      [0.88, 2.0],
      [0.88, 2.55],
      [0.88, 3.05],
      [0.88, 3.5],
      [0.88, 3.85],
    ].sort((a, b) => b[1] - a[1]);
    this.twinkles = [];
    for (const [X, d] of spots) {
      const [bx, by] = P(X, 0, d);
      const sc = F / d;
      if (xmas) {
        // a tall fir in a tub, snow on its boughs, baubles and candle-lights
        g.fillStyle = '#5a3a24';
        g.fillRect(bx - sc * 0.04, by - sc * 0.08, sc * 0.08, sc * 0.08);
        g.fillStyle = '#3a2416';
        g.fillRect(bx - sc * 0.012, by - sc * 0.12, sc * 0.024, sc * 0.04);
        const tiers = 7;
        for (let i = 0; i < tiers; i++) {
          const yb = by - sc * (0.11 + i * 0.12);
          const hw = sc * 0.12 * (1 - i / (tiers + 0.6));
          const ht = sc * 0.21;
          g.fillStyle = i % 2 ? '#1c3a24' : '#234a2c';
          g.beginPath();
          g.moveTo(bx - hw, yb);
          for (let k = 1; k < 6; k++) g.lineTo(bx - hw + (2 * hw * k) / 6, yb + (k % 2 ? sc * 0.014 : 0));
          g.lineTo(bx + hw, yb);
          g.lineTo(bx, yb - ht);
          g.closePath();
          g.fill();
          g.strokeStyle = 'rgba(236,244,252,0.8)';
          g.lineWidth = Math.max(1, sc * 0.007);
          g.beginPath();
          g.moveTo(bx - hw * 0.95, yb - sc * 0.006);
          g.quadraticCurveTo(bx - hw * 0.3, yb - ht * 0.25, bx, yb - ht * 0.8);
          g.stroke();
          for (let k = 0; k < 3; k++) {
            const u2 = R(-0.8, 0.8);
            const yy = yb - R(0.05, 0.6) * ht * (1 - Math.abs(u2) * 0.6);
            g.fillStyle = ['#b81c2a', '#d4a640', '#c0c8d0'][Math.floor(r() * 3)];
            g.beginPath();
            g.arc(bx + u2 * hw * 0.8, yy, Math.max(1, sc * 0.01), 0, TAU);
            g.fill();
          }
          for (let k = 0; k < 4; k++) this.twinkles.push({ x: bx + R(-0.85, 0.85) * hw, y: yb - R(0.08, 0.55) * ht, s: sc, ph: R(0, TAU), f: R(0.6, 1.6) });
        }
        // the star
        const sy = by - sc * (0.11 + tiers * 0.12 + 0.07);
        g.fillStyle = '#f0d070';
        g.beginPath();
        for (let k = 0; k < 10; k++) {
          const a = -Math.PI / 2 + (k / 10) * TAU;
          const rr = k % 2 ? sc * 0.015 : sc * 0.035;
          g.lineTo(bx + Math.cos(a) * rr, sy + Math.sin(a) * rr);
        }
        g.fill();
        this.twinkles.push({ x: bx, y: sy, s: sc * 2.2, ph: 0, f: 0.3, star: true });
      } else {
        const R0 = sc * 0.065;
        g.drawImage(jackSprite(R0, 1), bx - R0 * 1.2, by - R0 * 2.0, R0 * 2.4, R0 * 2.4);
        this.lights.push({ x: bx, y: by - R0 * 0.85, s: R0, ph: R(0, TAU) });
      }
    }

    // --- what lives in the air: candles (and jack-o'-lanterns), at random down the hall
    this.candles = [];
    for (let i = 0; i < 190; i++) this.candles.push({ X: R(-0.92, 0.92), Y: R(0.75, T - 0.3), d: R(0.6, D - 0.2), ph: R(0, TAU), f: R(0.25, 0.6), fl: R(0, TAU) });
    for (let i = 0; i < 12; i++) {
      // a few hang close enough to be big; kept low enough to be on screen
      const d = R(0.3, 0.6);
      const top = HALL.eye + (this.vy * 0.92 * d) / F;
      this.candles.push({ X: R(-0.75, 0.75), Y: R(top * 0.6, top), d, ph: R(0, TAU), f: R(0.2, 0.4), fl: R(0, TAU) });
    }
    if (!xmas) for (let i = 0; i < 22; i++) this.candles.push({ X: R(-0.85, 0.85), Y: R(0.65, 1.6), d: R(0.75, D - 0.4), ph: R(0, TAU), f: R(0.2, 0.4), fl: R(0, TAU), jack: true });
    this.candles.sort((a, b) => b.d - a.d);
    this.jack = jackSprite(48, 1);
    // a warm glow, and a flame
    this.glow = layer(64, 64);
    const gg = this.glow.getContext('2d');
    const rg = gg.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, 'rgba(255,205,130,0.85)');
    rg.addColorStop(0.25, 'rgba(255,170,90,0.28)');
    rg.addColorStop(1, 'rgba(255,140,60,0)');
    gg.fillStyle = rg;
    gg.fillRect(0, 0, 64, 64);
    this.flame = layer(16, 32);
    const fg = this.flame.getContext('2d');
    const fr = fg.createRadialGradient(8, 22, 0, 8, 22, 12);
    fr.addColorStop(0, 'rgba(255,255,230,1)');
    fr.addColorStop(0.45, 'rgba(255,215,120,1)');
    fr.addColorStop(1, 'rgba(255,140,40,0)');
    fg.fillStyle = fr;
    fg.beginPath();
    fg.moveTo(8, 1);
    fg.quadraticCurveTo(15, 18, 12, 26);
    fg.quadraticCurveTo(8, 31, 4, 26);
    fg.quadraticCurveTo(1, 18, 8, 1);
    fg.fill();

    // --- a crescent moon on the ceiling, and grain over everything, like a print
    this.moon = { x: w * 0.62, y: Math.min(h * 0.07, this.skyTop * 0.3), r: Math.max(10, this.u * 4.2) };
    this.crescent = layer(64, 64);
    const cg = this.crescent.getContext('2d');
    cg.fillStyle = '#f8ead2';
    cg.beginPath();
    cg.arc(32, 32, 30, 0, TAU);
    cg.fill();
    cg.globalCompositeOperation = 'destination-out';
    cg.beginPath();
    cg.arc(44, 24, 27, 0, TAU);
    cg.fill();
    this.moonGlow = layer(64, 64);
    const mg = this.moonGlow.getContext('2d');
    const mgr = mg.createRadialGradient(32, 32, 0, 32, 32, 32);
    mgr.addColorStop(0, 'rgba(255,220,200,0.35)');
    mgr.addColorStop(1, 'rgba(255,200,190,0)');
    mg.fillStyle = mgr;
    mg.fillRect(0, 0, 64, 64);
    this.grain = grainLayer(w, h);
    const printed = (c, alpha) => printGrain(c, this.grain, alpha);
    printed(this.hall, 0.16);
    this.skyBase = layer(w, Math.max(2, Math.ceil(this.skyTop) + 2));
    const sk = this.skyBase.getContext('2d');
    sk.fillStyle = vgrad(sk, 0, this.skyTop, [
      [0, C.sky[0]],
      [1, C.sky[1]],
    ]);
    sk.fillRect(0, 0, w, this.skyBase.height);
    printed(this.skyBase, 0.2);

    // --- the sky's own weather
    const sy0 = 0;
    const sy1 = this.skyTop;
    // the clouds are one long strip that drifts across and wraps; at Halloween a twin of it, lit
    // from within, shows when the lightning goes
    const cw = Math.ceil(w * 2);
    const ch = Math.max(8, Math.ceil(sy1 * 1.05));
    const blobs = Array.from({ length: xmas ? 26 : 70 }, () => ({ x: R(0, cw), y: R(-0.1, 1) * ch, r: R(0.06, 0.2) * Math.max(w, ch) }));
    const paint = (lit) => {
      const c = layer(cw, ch);
      const q = c.getContext('2d');
      for (const pass of xmas ? ['soft'] : ['rim', 'body']) {
        for (const b of blobs) {
          for (const ox of [-cw, 0, cw]) {
            const x = b.x + ox;
            if (x < -b.r || x > cw + b.r) continue;
            const y = pass === 'rim' ? b.y + b.r * 0.18 : b.y;
            const gr = q.createRadialGradient(x, y, 0, x, y, b.r);
            const col = xmas ? 'rgba(160,180,215,' : lit ? (pass === 'rim' ? 'rgba(235,230,255,' : 'rgba(170,160,230,') : pass === 'rim' ? 'rgba(120,104,170,' : 'rgba(12,8,22,';
            const a = xmas ? 0.13 : lit ? 0.5 : pass === 'rim' ? 0.55 : 0.7;
            gr.addColorStop(0, col + a + ')');
            gr.addColorStop(0.6, col + a * 0.5 + ')');
            gr.addColorStop(1, col + '0)');
            q.fillStyle = gr;
            q.fillRect(x - b.r, y - b.r, b.r * 2, b.r * 2);
          }
        }
      }
      return c;
    };
    this.cloudTex = paint(false);
    this.cloudLit = xmas ? null : paint(true);
    this.cloudV = R(0.006, 0.01) * w;
    this.stars = Array.from({ length: 70 }, () => ({ x: R(0, w), y: R(0, sy1), a: R(0.2, 0.8), ph: R(0, TAU) }));
    if (xmas) this.flakes = Array.from({ length: 320 }, () => this.flake(true));
    this.bats = xmas ? [] : Array.from({ length: 6 }, () => ({ cx: R(0.2, 0.8) * w, cy: R(0.08, 0.6) * Math.max(sy1, h * 0.25), ax: R(0.15, 0.35) * w, ay: R(0.03, 0.08) * h, fx: R(0.08, 0.16), fy: R(0.15, 0.3), ph: R(0, TAU), size: R(0.7, 1.2) }));
  }

  // a snowflake, born at the ceiling (or anywhere, at the start)
  flake(anywhere) {
    return { X: rand(-1, 1), Y: anywhere ? rand(0.6, HALL.top) : HALL.top + rand(0, 0.2), d: rand(0.45, HALL.far - 0.1), v: rand(0.1, 0.2), sw: rand(0, TAU), s: rand(0.6, 1.3) };
  }

  event(e) {
    if (e.type === 'lightning') this.at(e.at, () => this.flashes.push({ t0: this.t, k: e.strength ?? 0.7, bolt: this.bolt() }));
  }

  // a forked bolt across the enchanted ceiling, in screen space
  bolt() {
    const { w } = this;
    const pts = [[rand(0.25, 0.75) * w, 0]];
    const end = this.skyTop * rand(0.55, 0.95);
    while (pts[pts.length - 1][1] < end) {
      const [x, y] = pts[pts.length - 1];
      pts.push([x + rand(-0.06, 0.06) * w, y + rand(0.04, 0.09) * end]);
    }
    const fork = pts.slice(Math.floor(pts.length * 0.4), Math.floor(pts.length * 0.4) + 1);
    for (let k = 0; k < 3; k++) {
      const [x, y] = fork[fork.length - 1];
      fork.push([x + rand(0.02, 0.07) * w * (Math.random() < 0.5 ? -1 : 1), y + rand(0.04, 0.08) * end]);
    }
    return [pts, fork];
  }

  frame(dt) {
    const { g, w, h, t } = this;
    const xmas = this.season === 'christmas';
    const F = this.F;
    // the flash of lightning, if any
    this.flashes = this.flashes.filter((f) => t - f.t0 < 0.7);
    let flash = 0;
    for (const f of this.flashes) {
      const age = t - f.t0;
      flash = Math.max(flash, f.k * (age < 0.07 || (age > 0.14 && age < 0.22) ? 1 : Math.max(0, 1 - age / 0.7) * 0.35));
    }

    // the enchanted ceiling
    g.save();
    g.clip(this.sky);
    g.drawImage(this.skyBase, 0, 0);
    g.globalCompositeOperation = 'lighter';
    g.drawImage(this.moonGlow, this.moon.x - this.moon.r * 4, this.moon.y - this.moon.r * 4, this.moon.r * 8, this.moon.r * 8);
    g.globalCompositeOperation = 'source-over';
    g.drawImage(this.crescent, this.moon.x - this.moon.r, this.moon.y - this.moon.r, this.moon.r * 2, this.moon.r * 2);
    for (const s of this.stars) {
      const a = s.a * (0.6 + 0.4 * Math.sin(t * 0.9 + s.ph)) * (xmas ? 1 : 0.35);
      g.fillStyle = `rgba(235,240,255,${a})`;
      g.fillRect(s.x, s.y, 1.5 * this.dpr, 1.5 * this.dpr);
    }
    const cw = this.cloudTex.width;
    const off = (t * this.cloudV) % cw;
    g.drawImage(this.cloudTex, -off, 0);
    g.drawImage(this.cloudTex, cw - off, 0);
    if (flash > 0 && this.cloudLit) {
      g.globalAlpha = Math.min(1, flash * 1.2);
      g.drawImage(this.cloudLit, -off, 0);
      g.drawImage(this.cloudLit, cw - off, 0);
      g.globalAlpha = 1;
    }
    if (flash > 0) {
      g.fillStyle = `rgba(190,190,255,${0.35 * flash})`;
      g.fillRect(0, 0, w, this.skyTop + 2);
      for (const f of this.flashes) {
        if (t - f.t0 > 0.22) continue;
        g.strokeStyle = `rgba(240,240,255,${f.k})`;
        g.shadowColor = 'rgba(200,200,255,0.9)';
        g.shadowBlur = 12 * this.dpr;
        for (const [i, line] of f.bolt.entries()) {
          g.lineWidth = (i ? 1.2 : 2.4) * this.dpr;
          g.beginPath();
          g.moveTo(...line[0]);
          for (const p of line.slice(1)) g.lineTo(...p);
          g.stroke();
        }
        g.shadowBlur = 0;
      }
    }
    g.restore();

    g.drawImage(this.hall, 0, 0);
    if (flash > 0) {
      g.fillStyle = `rgba(205,210,255,${0.7 * flash})`;
      g.fill(this.glass);
      g.fillStyle = `rgba(170,175,255,${0.08 * flash})`;
      g.fillRect(0, 0, w, h);
    }

    // fires in the hearths
    const fireOn = this.engine.scene?.layers?.get('fire')?.level ?? 0.6;
    for (const hh of this.hearths) {
      const k = (0.55 + 0.25 * Math.sin(t * 7.1 + hh.x) * Math.sin(t * 3.3) + 0.1 * Math.sin(t * 13)) * clamp(fireOn * 1.6, 0.15, 1);
      g.save();
      g.beginPath();
      g.moveTo(...hh.mouth[0]);
      for (const p of hh.mouth.slice(1)) g.lineTo(...p);
      g.closePath();
      g.clip();
      const fr = g.createRadialGradient(hh.x, hh.y + hh.s * 0.06, 0, hh.x, hh.y, hh.s * 0.26);
      fr.addColorStop(0, `rgba(255,220,140,${k})`);
      fr.addColorStop(0.4, `rgba(255,120,40,${0.8 * k})`);
      fr.addColorStop(1, 'rgba(120,30,10,0)');
      g.fillStyle = fr;
      g.fillRect(hh.x - hh.s, hh.y - hh.s, hh.s * 2, hh.s * 2);
      g.restore();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.35 * k;
      g.drawImage(this.glow, hh.x - hh.s * 0.4, hh.y - hh.s * 0.3, hh.s * 0.8, hh.s * 0.8);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
    }
    // torches
    g.globalCompositeOperation = 'lighter';
    for (const to of this.torches) {
      const k = 0.75 + 0.25 * Math.sin(t * 9 + to.ph) * Math.sin(t * 5.3 + to.ph * 2);
      g.globalAlpha = 0.5 * k;
      g.drawImage(this.glow, to.x - to.s * 0.09, to.y - to.s * 0.11, to.s * 0.18, to.s * 0.18);
    }
    // the giant pumpkins' faces
    for (const l of this.lights) {
      const k = 0.7 + 0.3 * Math.sin(t * 8 + l.ph) * Math.sin(t * 4.7 + l.ph * 2);
      g.globalAlpha = 0.45 * k;
      g.drawImage(this.glow, l.x - l.s * 1.4, l.y - l.s * 1.4, l.s * 2.8, l.s * 2.8);
    }
    // fairy lights on the trees
    for (const tw of this.twinkles) {
      const k = tw.star ? 0.5 + 0.2 * Math.sin(t * 0.8) : Math.max(0, Math.sin(t * tw.f + tw.ph)) ** 2;
      g.globalAlpha = 0.9 * k;
      const s = tw.s * (tw.star ? 0.1 : 0.028);
      g.drawImage(this.glow, tw.x - s, tw.y - s, s * 2, s * 2);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    for (const to of this.torches) {
      const s = to.s * 0.022;
      g.drawImage(this.flame, to.x - s * 0.5, to.y - s * 1.9, s, s * 2);
    }
    g.globalCompositeOperation = 'lighter';
    for (const f of this.tableFlames) {
      g.globalAlpha = 0.35 + 0.08 * Math.sin(t * 7 + f.ph);
      const s = f.s * 0.06;
      g.drawImage(this.glow, f.x - s / 2, f.y - s * 0.6, s, s);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    for (const f of this.tableFlames) {
      const s = f.s * 0.013;
      g.drawImage(this.flame, f.x - s * 0.25, f.y - s, s * 0.5, s);
    }

    // snow from the enchanted ceiling, melting away above the tables
    if (xmas) {
      g.fillStyle = '#eef4fb';
      for (const f of this.flakes) {
        f.Y -= f.v * dt;
        f.X += Math.sin(t * 0.7 + f.sw) * 0.02 * dt;
        if (f.Y < 0.6) Object.assign(f, this.flake(false));
        const a = clamp((HALL.top - f.Y) / 0.25, 0, 1) * clamp((f.Y - 0.6) / 0.45, 0, 1);
        if (a <= 0) continue;
        const [x, y] = this.P(f.X, f.Y, f.d);
        if (x < -4 || x > w + 4 || y < -4 || y > h) continue;
        const s = Math.max(0.8 * this.dpr, ((F * 0.006) / f.d) * f.s);
        g.globalAlpha = a * 0.85;
        g.fillRect(x - s / 2, y - s / 2, s, s);
      }
      g.globalAlpha = 1;
    }

    // candles and jack-o'-lanterns, bobbing gently in the air: glows first, then the flames
    const pos = [];
    for (const c of this.candles) {
      const Y = c.Y + 0.035 * Math.sin(t * c.f + c.ph);
      const [x, y] = this.P(c.X, Y, c.d);
      const s = F / c.d;
      if (x < -s * 0.3 || x > w + s * 0.3 || y < -s * 0.3 || y > h + s * 0.3) continue;
      pos.push([c, x, y, s]);
    }
    g.globalCompositeOperation = 'lighter';
    for (const [c, x, y, s] of pos) {
      const k = 0.8 + 0.2 * Math.sin(t * 7 + c.fl) * Math.sin(t * 4.3 + c.fl * 1.7);
      const gs = s * (c.jack ? 0.28 : 0.12);
      g.globalAlpha = (c.jack ? 0.5 : 0.42) * k;
      g.drawImage(this.glow, x - gs / 2, y - gs * (c.jack ? 0.5 : 0.75), gs, gs);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    for (const [c, x, y, s] of pos) {
      if (c.jack) {
        const js = s * 0.09;
        g.drawImage(this.jack, x - js / 2, y - js / 2, js, js);
        continue;
      }
      const bh = s * 0.07;
      const bw = Math.max(1, s * 0.009);
      g.fillStyle = '#eadcbf';
      g.fillRect(x - bw / 2, y - bh * 0.25, bw, bh);
      g.fillStyle = 'rgba(120,90,60,0.35)';
      g.fillRect(x, y - bh * 0.25, bw / 2, bh);
      const fh = s * 0.024 * (0.9 + 0.1 * Math.sin(t * 11 + c.fl));
      g.drawImage(this.flame, x - fh * 0.25, y - bh * 0.25 - fh, fh * 0.5, fh);
    }

    // the hall's glow up among the candles
    const haze = g.createRadialGradient(this.vx, this.vy - h * 0.2, 0, this.vx, this.vy - h * 0.2, h * 0.55);
    haze.addColorStop(0, xmas ? 'rgba(255,200,120,0.07)' : 'rgba(255,120,110,0.08)');
    haze.addColorStop(1, 'rgba(255,140,120,0)');
    g.fillStyle = haze;
    g.fillRect(0, 0, w, h);

    // bats under the roof
    for (const b of this.bats) {
      const x = b.cx + b.ax * Math.sin(t * b.fx + b.ph);
      const y = b.cy + b.ay * Math.sin(t * b.fy + b.ph * 1.3);
      const dir = Math.cos(t * b.fx + b.ph) >= 0 ? 1 : -1;
      const flap = Math.sin(t * 16 + b.ph);
      const s = 1.6 * this.u * b.size;
      g.fillStyle = '#0a0608';
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x - s * 0.6, y - s * (0.2 + flap * 0.6), x - s * 1.4, y - flap * s * 0.8);
      g.quadraticCurveTo(x - s * 0.9, y + s * 0.1, x - s * 0.5, y + s * 0.15);
      g.quadraticCurveTo(x - s * 0.25, y + s * 0.05, x, y + s * 0.2);
      g.quadraticCurveTo(x + s * 0.25, y + s * 0.05, x + s * 0.5, y + s * 0.15);
      g.quadraticCurveTo(x + s * 0.9, y + s * 0.1, x + s * 1.4, y - flap * s * 0.8);
      g.quadraticCurveTo(x + s * 0.6, y - s * (0.2 + flap * 0.6), x, y);
      g.fill();
      g.beginPath();
      g.ellipse(x + dir * s * 0.05, y + s * 0.05, s * 0.16, s * 0.22, 0, 0, TAU);
      g.fill();
    }
  }
}
class Halloween extends GreatHall {
  get season() {
    return 'halloween';
  }
}
class Christmas extends GreatHall {
  get season() {
    return 'christmas';
  }
}

// ---------------------------------------------------------------------------------------------
// Two common rooms to read in, one under the lake and one by the kitchens, and what they share.

// a fire in a hearth opening (mo: its box, path: its outline): embers, two logs, tongues of flame
function hearthFire(g, mo, path, glow, t, lvl, flick) {
  const mw = mo.x1 - mo.x0;
  const mh = mo.y1 - mo.y0;
  const fx = (mo.x0 + mo.x1) / 2;
  g.save();
  g.clip(path);
  const fb = mo.y1 - mh * 0.12;
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.7 * flick;
  g.drawImage(glow, fx - mw * 0.5, fb - mh * 0.3, mw, mh * 0.55);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#2a1408';
  for (const [dx, rot] of [
    [-0.09, 0.1],
    [0.09, -0.1],
  ]) {
    g.save();
    g.translate(fx + dx * mw, fb + mh * 0.02);
    g.rotate(rot);
    g.beginPath();
    g.roundRect(-mw * 0.17, -mh * 0.035, mw * 0.34, mh * 0.07, mh * 0.035);
    g.fill();
    g.restore();
  }
  g.globalCompositeOperation = 'lighter';
  for (const [n, sc, c0, c1, a] of [
    [6, 1, '255,120,40', '190,40,10', 0.5],
    [5, 0.62, '255,225,140', '255,140,40', 0.75],
  ]) {
    for (let i = 0; i < n; i++) {
      const p = (i + 0.5) / n;
      const bx = fx + (p - 0.5) * mw * 0.6 * sc;
      const mid = 1 - Math.abs(p - 0.5) * 1.2;
      const nz = 0.7 + 0.18 * Math.sin(t * (2.3 + i * 0.71) + i * 1.3 + sc * 5) + 0.12 * Math.sin(t * (5.1 + i * 0.37) + i);
      const hgt = mh * 0.7 * sc * mid * nz * lvl;
      const wd = mw * 0.17 * sc;
      const tip = bx + Math.sin(t * 1.7 + i * 2.1 + sc * 3) * wd * 0.4;
      const fg = g.createLinearGradient(0, fb, 0, fb - hgt);
      fg.addColorStop(0, `rgba(${c0},${a})`);
      fg.addColorStop(0.6, `rgba(${c1},${a * 0.6})`);
      fg.addColorStop(1, `rgba(${c1},0)`);
      g.fillStyle = fg;
      g.beginPath();
      g.moveTo(bx - wd / 2, fb);
      g.bezierCurveTo(bx - wd / 2, fb - hgt * 0.45, tip - wd * 0.12, fb - hgt * 0.7, tip, fb - hgt);
      g.bezierCurveTo(tip + wd * 0.12, fb - hgt * 0.7, bx + wd / 2, fb - hgt * 0.45, bx + wd / 2, fb);
      g.fill();
    }
  }
  g.globalCompositeOperation = 'source-over';
  g.restore();
}

// a soft round glow as a sprite: stops of [offset, rgba]
function glowSprite(stops) {
  const c = layer(64, 64);
  const q = c.getContext('2d');
  const gr = q.createRadialGradient(32, 32, 0, 32, 32, 32);
  for (const [o, col] of stops) gr.addColorStop(o, col);
  q.fillStyle = gr;
  q.fillRect(0, 0, 64, 64);
  return c;
}

// ---------------------------------------------------------------------------------------------
// A common room under the lake: a long, low dungeon room of rough stone, green lamps hanging on
// chains, and tall windows onto the water, where light comes down in shafts, weed sways, fish
// pass, and now and then the giant squid drifts by. A fire burns under a hooded stone mantel; on
// the rug a little green snake sleeps, pointedly ignoring the black-and-white cat curled up beside it.

// a black-and-white cat curled up asleep, facing right, drawn smooth and clean: a tuxedo with a white
// bib and paws, white whisker pads under a black nose patch, a black spot on his chin and a thin
// white streak up his forehead. Black needs light to read in a dark room: a soft sheen along his
// back and a warm rim from the fire on his right.
function catSprite(S) {
  const c = layer(Math.ceil(S * 1.6), Math.ceil(S * 1.05));
  const g = c.getContext('2d');
  const cx = S * 0.7;
  const cy = S * 0.66;
  const BLACK = '#1c1c22';
  const WHITE = '#f2efe8';
  const rim = (path, x0, x1, a) => {
    const rg = g.createLinearGradient(x0, 0, x1, 0);
    rg.addColorStop(0, 'rgba(255,165,85,0)');
    rg.addColorStop(1, `rgba(255,165,85,${a})`);
    g.strokeStyle = rg;
    g.lineWidth = S * 0.026;
    g.stroke(path);
  };
  // a shape with the fire's light along its outer edge (the rim drawn first, so only its outside shows)
  const lit = (path, col, x0, x1, a) => {
    rim(path, x0, x1, a);
    g.fillStyle = col;
    g.fill(path);
  };
  // shadow on the rug
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.beginPath();
  g.ellipse(cx, cy + S * 0.27, S * 0.6, S * 0.08, 0, 0, TAU);
  g.fill();
  // the body: a round loaf, his haunch a little higher at the back
  const body = new Path2D();
  body.ellipse(cx, cy + S * 0.02, S * 0.5, S * 0.28, 0, 0, TAU);
  body.moveTo(cx - S * 0.2 + S * 0.27, cy - S * 0.02);
  body.ellipse(cx - S * 0.2, cy - S * 0.02, S * 0.27, S * 0.27, 0, 0, TAU);
  lit(body, BLACK, cx, cx + S * 0.5, 0.55);
  // a soft sheen along his back
  g.save();
  g.clip(body);
  const sheen = g.createLinearGradient(0, cy - S * 0.3, 0, cy + S * 0.05);
  sheen.addColorStop(0, 'rgba(150,158,185,0.3)');
  sheen.addColorStop(1, 'rgba(150,158,185,0)');
  g.fillStyle = sheen;
  g.fillRect(0, 0, c.width, c.height);
  const under = g.createLinearGradient(0, cy, 0, cy + S * 0.3);
  under.addColorStop(0, 'rgba(0,0,0,0)');
  under.addColorStop(1, 'rgba(0,0,0,0.3)');
  g.fillStyle = under;
  g.fillRect(0, 0, c.width, c.height);
  g.restore();
  // his tail, tapering, round the front to under his chin
  const tp = (u) => {
    const a = [cx - S * 0.3, cy + S * 0.17];
    const b = [cx - S * 0.12, cy + S * 0.36];
    const e = [cx + S * 0.2, cy + S * 0.24];
    return [(1 - u) ** 2 * a[0] + 2 * (1 - u) * u * b[0] + u * u * e[0], (1 - u) ** 2 * a[1] + 2 * (1 - u) * u * b[1] + u * u * e[1]];
  };
  const side = [];
  const other = [];
  for (let i = 0; i <= 30; i++) {
    const u = i / 30;
    const [x, y] = tp(u);
    const [x2, y2] = tp(Math.min(1, u + 0.01));
    const [x1, y1] = tp(Math.max(0, u - 0.01));
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const nx = -(y2 - y1) / len;
    const ny = (x2 - x1) / len;
    const wd = S * (0.07 - 0.03 * u);
    side.push([x + nx * wd, y + ny * wd]);
    other.push([x - nx * wd, y - ny * wd]);
  }
  const tail = new Path2D();
  tail.moveTo(...side[0]);
  for (const p of side.slice(1)) tail.lineTo(...p);
  const [ex, ey] = tp(1);
  tail.arc(ex, ey, S * 0.04, Math.atan2(side[30][1] - ey, side[30][0] - ex), Math.atan2(other[30][1] - ey, other[30][0] - ex));
  for (const p of other.reverse()) tail.lineTo(...p);
  tail.closePath();
  lit(tail, '#202027', cx - S * 0.1, cx + S * 0.25, 0.35);
  // his white bib under his chin, and his white front paws tucked in
  const hx = cx + S * 0.34;
  const hy = cy - S * 0.02;
  g.fillStyle = WHITE;
  g.beginPath();
  g.ellipse(hx - S * 0.05, hy + S * 0.15, S * 0.11, S * 0.075, -0.25, 0, TAU);
  g.fill();
  for (const [dx, dy] of [
    [-0.01, 0.215],
    [0.11, 0.2],
  ]) {
    g.fillStyle = WHITE;
    g.beginPath();
    g.ellipse(hx + S * dx, hy + S * dy, S * 0.062, S * 0.034, 0.05, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(110,105,100,0.55)';
    g.lineWidth = Math.max(1, S * 0.006);
    g.lineCap = 'round';
    g.beginPath();
    for (const t of [-0.25, 0.25]) {
      g.moveTo(hx + S * (dx + 0.035 + t * 0.06), hy + S * (dy + 0.004));
      g.lineTo(hx + S * (dx + 0.037 + t * 0.06), hy + S * (dy + 0.026));
    }
    g.stroke();
  }
  // ears, then his head
  const head = new Path2D();
  head.ellipse(hx, hy, S * 0.2, S * 0.16, 0.12, 0, TAU);
  for (const [b0, tip, b1] of [
    [
      [-0.15, -0.07],
      [-0.12, -0.27],
      [-0.02, -0.14],
    ],
    [
      [0.04, -0.14],
      [0.15, -0.26],
      [0.17, -0.05],
    ],
  ]) {
    const ear = new Path2D();
    ear.moveTo(hx + b0[0] * S, hy + b0[1] * S);
    ear.quadraticCurveTo(hx + (tip[0] - 0.015) * S, hy + (tip[1] + 0.03) * S, hx + tip[0] * S, hy + tip[1] * S);
    ear.quadraticCurveTo(hx + (tip[0] + 0.025) * S, hy + (tip[1] + 0.06) * S, hx + b1[0] * S, hy + b1[1] * S);
    ear.closePath();
    lit(ear, BLACK, hx, hx + S * 0.2, 0.45);
    const m = [(b0[0] + b1[0]) / 2, (b0[1] + b1[1]) / 2];
    g.fillStyle = 'rgba(120,80,88,0.55)';
    g.beginPath();
    g.moveTo(hx + (m[0] * 0.55 + b0[0] * 0.45) * S, hy + (m[1] * 0.55 + b0[1] * 0.45) * S);
    g.lineTo(hx + (tip[0] * 0.78 + m[0] * 0.22) * S, hy + (tip[1] * 0.78 + m[1] * 0.22) * S);
    g.lineTo(hx + (m[0] * 0.55 + b1[0] * 0.45) * S, hy + (m[1] * 0.55 + b1[1] * 0.45) * S);
    g.fill();
  }
  lit(head, BLACK, hx, hx + S * 0.2, 0.5);
  g.save();
  g.clip(head);
  const hs = g.createLinearGradient(0, hy - S * 0.16, 0, hy + S * 0.05);
  hs.addColorStop(0, 'rgba(150,158,185,0.25)');
  hs.addColorStop(1, 'rgba(150,158,185,0)');
  g.fillStyle = hs;
  g.fillRect(0, 0, c.width, c.height);
  g.restore();
  // his face: white whisker pads and chin, the black nose patch over his lip, the spot on his chin
  g.fillStyle = WHITE;
  g.beginPath();
  g.ellipse(hx + S * 0.085, hy + S * 0.085, S * 0.055, S * 0.045, 0, 0, TAU);
  g.ellipse(hx + S * 0.165, hy + S * 0.07, S * 0.04, S * 0.036, 0, 0, TAU);
  g.ellipse(hx + S * 0.12, hy + S * 0.11, S * 0.05, S * 0.03, 0, 0, TAU);
  g.fill();
  g.fillStyle = BLACK;
  g.beginPath();
  g.ellipse(hx + S * 0.135, hy + S * 0.05, S * 0.045, S * 0.032, 0.15, 0, TAU);
  g.fill();
  g.beginPath();
  g.ellipse(hx + S * 0.115, hy + S * 0.125, S * 0.026, S * 0.014, 0.1, 0, TAU);
  g.fill();
  g.fillStyle = '#0c0c10';
  g.beginPath();
  g.moveTo(hx + S * 0.15, hy + S * 0.03);
  g.quadraticCurveTo(hx + S * 0.175, hy + S * 0.028, hx + S * 0.185, hy + S * 0.036);
  g.quadraticCurveTo(hx + S * 0.172, hy + S * 0.056, hx + S * 0.163, hy + S * 0.058);
  g.closePath();
  g.fill();
  // the thin white streak up his forehead, narrowing to a point
  g.fillStyle = 'rgba(242,239,232,0.9)';
  g.beginPath();
  g.moveTo(hx + S * 0.062, hy + S * 0.0);
  g.quadraticCurveTo(hx + S * 0.05, hy - S * 0.06, hx + S * 0.03, hy - S * 0.115);
  g.quadraticCurveTo(hx + S * 0.06, hy - S * 0.06, hx + S * 0.08, hy - S * 0.004);
  g.closePath();
  g.fill();
  // eyes shut
  g.strokeStyle = '#8c8c98';
  g.lineWidth = Math.max(1, S * 0.011);
  g.lineCap = 'round';
  for (const [ex2, ey2] of [
    [-0.02, -0.01],
    [0.12, -0.025],
  ]) {
    g.beginPath();
    g.arc(hx + ex2 * S, hy + ey2 * S, S * 0.028, 0.3, Math.PI - 0.3);
    g.stroke();
  }
  // whiskers on both sides of his muzzle
  g.strokeStyle = 'rgba(255,252,245,0.8)';
  g.lineWidth = Math.max(1, S * 0.0045);
  for (const [x0, y0, x1, y1, bx, by] of [
    [0.18, 0.06, 0.4, 0.04, 0.3, 0.035],
    [0.18, 0.075, 0.39, 0.1, 0.3, 0.08],
    [0.175, 0.088, 0.36, 0.15, 0.28, 0.11],
    [0.06, 0.07, -0.12, 0.03, -0.03, 0.04],
    [0.06, 0.085, -0.12, 0.09, -0.03, 0.08],
    [0.065, 0.098, -0.1, 0.14, -0.02, 0.115],
  ]) {
    g.beginPath();
    g.moveTo(hx + S * x0, hy + S * y0);
    g.quadraticCurveTo(hx + S * bx, hy + S * by, hx + S * x1, hy + S * y1);
    g.stroke();
  }
  return c;
}

// a little green snake, coiled and asleep, its head on its coils turned away to the left
function snakeSprite(S) {
  const c = layer(Math.ceil(S * 1.3), Math.ceil(S * 0.9));
  const g = c.getContext('2d');
  const cx = c.width * 0.5;
  const cy = c.height * 0.64;
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.beginPath();
  g.ellipse(cx, cy + S * 0.1, S * 0.52, S * 0.1, 0, 0, TAU);
  g.fill();
  // the body is a flattened spiral, tail outside, rising as it winds in; it is drawn a turn at a
  // time from the outside so each coil lies on the one below, joins hidden at the back
  const turns = 2.5;
  const pt = (f) => {
    const a = f * turns * TAU + Math.PI / 2;
    const rr = S * (0.46 - 0.3 * f);
    return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.4 - f * S * 0.16];
  };
  const wid = (f) => S * (f < 0.18 ? 0.025 + (f / 0.18) * 0.075 : 0.1);
  const seg = (f0, f1, col, k, dy = 0) => {
    g.strokeStyle = col;
    g.lineCap = 'round';
    const n = Math.ceil((f1 - f0) * 220);
    for (let i = 0; i < n; i++) {
      const a = f0 + ((f1 - f0) * i) / n;
      const b = f0 + ((f1 - f0) * (i + 1)) / n;
      const [x0, y0] = pt(a);
      const [x1, y1] = pt(b);
      g.lineWidth = wid(a) * k;
      g.beginPath();
      g.moveTo(x0, y0 + dy * wid(a));
      g.lineTo(x1, y1 + dy * wid(a));
      g.stroke();
    }
  };
  for (let tn = 0; tn < Math.ceil(turns * 2); tn++) {
    const f0 = tn / (turns * 2);
    const f1 = Math.min(1, (tn + 1) / (turns * 2));
    seg(f0, f1, '#123d20', 1.25);
    seg(f0, f1, '#2c7a3c', 1);
    seg(f0, f1, '#8ccf86', 0.32, 0.22); // pale belly along the underside
    seg(f0, f1, '#4fa25a', 0.4, -0.18); // sheen along the back
  }
  // scales: a row of dark marks along the back
  g.fillStyle = 'rgba(10,40,18,0.55)';
  for (let f = 0.12; f < 0.98; f += 0.035) {
    const [x, y] = pt(f);
    g.beginPath();
    g.ellipse(x, y - wid(f) * 0.15, wid(f) * 0.16, wid(f) * 0.1, 0, 0, TAU);
    g.fill();
  }
  // the head, chin on the top coil, pointing left
  const [nx, ny] = pt(1);
  const hx = nx - S * 0.1;
  const hy = ny - S * 0.015;
  for (const [col, k] of [
    ['#123d20', 1.18],
    ['#2c7a3c', 1],
  ]) {
    g.fillStyle = col;
    g.beginPath();
    g.ellipse(hx, hy, S * 0.11 * k, S * 0.062 * k, 0.12, 0, TAU);
    g.fill();
  }
  g.fillStyle = '#4fa25a';
  g.beginPath();
  g.ellipse(hx + S * 0.01, hy - S * 0.02, S * 0.07, S * 0.022, 0.12, 0, TAU);
  g.fill();
  g.strokeStyle = '#0c2614';
  g.lineWidth = Math.max(1, S * 0.012);
  g.beginPath();
  g.arc(hx - S * 0.045, hy - S * 0.02, S * 0.018, 0.2, Math.PI - 0.2);
  g.stroke();
  g.fillStyle = '#0c2614';
  g.beginPath();
  g.arc(hx - S * 0.095, hy - S * 0.008, Math.max(0.8, S * 0.006), 0, TAU);
  g.fill();
  return c;
}

class LakeRoom extends Painting {
  build() {
    const { w, h, u } = this;
    const k = Math.min(w * 2, h); // a size for things in the room, the same on any shape of screen
    let seed = 5;
    const r = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    const R = (a, b) => a + r() * (b - a);
    const C = { dark: '#0f1c1a', mid: '#1f3330', lit: '#34504a', edge: '#4f7068', rim: '#9fe0c0', warm: '#ffb070' };
    this.grain = grainLayer(w, h);

    // the room, in one-point perspective toward the window wall
    const vx = w * 0.5;
    const vy = h * 0.42;
    const B = { x0: w * 0.08, x1: w * 0.92, y0: h * 0.1, y1: h * 0.64 };
    const toEdge = (x, y, ex) => vy + ((y - vy) * (ex - vx)) / (x - vx);
    this.room = layer(w, h);
    const g = this.room.getContext('2d');
    const poly = (pts) => {
      g.beginPath();
      g.moveTo(...pts[0]);
      for (const p of pts.slice(1)) g.lineTo(...p);
      g.closePath();
    };
    // ceiling: low rough stone, with ribs running toward the window
    poly([[0, 0], [w, 0], [w, toEdge(B.x1, B.y0, w)], [B.x1, B.y0], [B.x0, B.y0], [0, toEdge(B.x0, B.y0, 0)]]);
    g.fillStyle = vgrad(g, 0, B.y0, [
      [0, '#0a1312'],
      [1, C.mid],
    ]);
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.45)';
    g.lineWidth = 2 * this.dpr;
    for (const t of [0.15, 0.32, 0.5, 0.68, 0.85]) {
      g.beginPath();
      g.moveTo(vx + (B.x0 + (B.x1 - B.x0) * t - vx) * 3, 0);
      g.lineTo(B.x0 + (B.x1 - B.x0) * t, B.y0);
      g.stroke();
    }
    // side walls
    for (const s of [-1, 1]) {
      const bx = s < 0 ? B.x0 : B.x1;
      const ex = s < 0 ? 0 : w;
      poly([[ex, toEdge(bx, B.y0, ex)], [bx, B.y0], [bx, B.y1], [ex, toEdge(bx, B.y1, ex)]]);
      const gr = g.createLinearGradient(ex, 0, bx, 0);
      gr.addColorStop(0, C.dark);
      gr.addColorStop(1, C.mid);
      g.fillStyle = gr;
      g.fill();
    }
    // the floor: dark flags
    poly([[0, toEdge(B.x0, B.y1, 0)], [B.x0, B.y1], [B.x1, B.y1], [w, toEdge(B.x1, B.y1, w)], [w, h], [0, h]]);
    g.fillStyle = vgrad(g, B.y1, h, [
      [0, '#16211f'],
      [1, '#26302c'],
    ]);
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.lineWidth = 1.5 * this.dpr;
    for (let i = -8; i <= 8; i++) {
      const bx = vx + i * (B.x1 - B.x0) * 0.09;
      g.beginPath();
      g.moveTo(bx, B.y1);
      g.lineTo(vx + (bx - vx) * ((h - vy) / (B.y1 - vy)), h);
      g.stroke();
    }
    for (let y = B.y1 + 6 * this.dpr; y < h; y += (y - vy) * 0.18) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }
    // the window wall, rough stone
    poly([[B.x0, B.y0], [B.x1, B.y0], [B.x1, B.y1], [B.x0, B.y1]]);
    g.fillStyle = vgrad(g, B.y0, B.y1, [
      [0, C.mid],
      [1, '#243a36'],
    ]);
    g.fill();
    g.save();
    g.clip();
    for (let y = B.y0; y < B.y1; ) {
      const hh = R(0.025, 0.04) * h;
      for (let x = B.x0 - R(0, 0.06) * w; x < B.x1; ) {
        const bw = R(0.6, 1.3) * hh * 2.6;
        const v = R(-1, 1);
        g.fillStyle = v > 0 ? `rgba(160,220,200,${v * 0.06})` : `rgba(0,0,0,${-v * 0.18})`;
        g.beginPath();
        g.roundRect(x + 1.5 * this.dpr, y + 1.5 * this.dpr, bw - 3 * this.dpr, hh - 3 * this.dpr, 4 * this.dpr);
        g.fill();
        x += bw;
      }
      y += hh;
    }
    g.restore();

    // the fireplace, near on the right: a hooded stone mantel, the flue going up into the dark
    const hb = h * 0.8; // where the hearth meets the floor (the controls cover the bottom of the screen)
    const F = { x0: w - 0.32 * k, mantel: hb - 0.26 * k, flue: w - 0.11 * k };
    F.hood = F.mantel - 0.075 * k;
    const mo = { x0: w - 0.255 * k, x1: w - 0.055 * k, y0: hb - 0.19 * k, y1: hb };

    // the windows: as many tall arched windows as fit between the left wall and the flue
    const Wy0 = h * 0.17;
    const Wy1 = h * 0.585;
    const WH = Wy1 - Wy0;
    const L = B.x0 + 0.05 * w;
    const Rt = F.flue - 0.035 * w;
    const N = Math.max(1, Math.round((Rt - L) / (WH * 0.95)));
    const slot = (Rt - L) / N;
    const winW = Math.min(slot * (N > 1 ? 0.74 : 0.95), WH * 0.85);
    this.wins = Array.from({ length: N }, (_, i) => {
      const cx = L + slot * (i + 0.5);
      return { x0: cx - winW / 2, x1: cx + winW / 2, y0: Wy0, y1: Wy1, rad: winW / 2, lights: winW / WH > 0.6 ? 3 : 2 };
    });
    const U = { x0: this.wins[0].x0, x1: this.wins[N - 1].x1, y0: Wy0, y1: Wy1 };
    this.lake = U;
    const arch = (pen, W, inset = 0) => {
      pen.moveTo(W.x0 + inset, W.y1 - inset);
      pen.lineTo(W.x0 + inset, W.y0 + W.rad);
      pen.arc((W.x0 + W.x1) / 2, W.y0 + W.rad, W.rad - inset, Math.PI, 0);
      pen.lineTo(W.x1 - inset, W.y1 - inset);
      pen.closePath();
    };
    const surround = 0.045 * winW;
    this.glass = new Path2D();
    for (const W of this.wins) {
      g.beginPath();
      arch(g, W, -surround);
      g.fillStyle = C.lit;
      g.fill();
      g.strokeStyle = C.rim;
      g.globalAlpha = 0.35;
      g.lineWidth = 1.5 * this.dpr;
      g.stroke();
      g.globalAlpha = 1;
      arch(this.glass, W, surround * 0.15);
    }
    g.save();
    g.globalCompositeOperation = 'destination-out';
    g.fill(this.glass);
    g.restore();
    // stone tracery over the glass: mullions, a round head to each light, a roundel above them
    this.tracery = (q) => {
      for (const W of this.wins) {
        const cx = (W.x0 + W.x1) / 2;
        const ys = W.y0 + W.rad;
        const n = W.lights;
        const lw = (W.x1 - W.x0) / n;
        const th = Math.max(2, W.rad * 0.07);
        const draw = (dx, col, lwid) => {
          q.strokeStyle = col;
          q.lineWidth = lwid;
          q.beginPath();
          for (let i = 1; i < n; i++) {
            const x = W.x0 + lw * i + dx;
            q.moveTo(x, W.y1);
            q.lineTo(x, ys);
          }
          for (let i = 0; i < n; i++) {
            const x = W.x0 + lw * (i + 0.5) + dx;
            q.moveTo(x + lw / 2, ys);
            q.arc(x, ys, lw / 2, 0, Math.PI, true);
          }
          q.moveTo(cx + W.rad * 0.3 + dx, ys - (W.rad * 2) / 3);
          q.arc(cx + dx, ys - (W.rad * 2) / 3, W.rad * 0.3, 0, TAU);
          q.stroke();
        };
        q.lineCap = 'butt';
        draw(0, '#1a2a27', th);
        draw(-th * 0.3, 'rgba(190,240,220,0.22)', Math.max(1, th * 0.18));
      }
    };
    // a window seat below, with cushions
    const seat = { x0: U.x0 - surround * 1.5, x1: U.x1 + surround * 1.5 };
    g.fillStyle = C.edge;
    g.fillRect(seat.x0, Wy1, seat.x1 - seat.x0, h * 0.018);
    g.fillStyle = C.lit;
    g.fillRect(seat.x0, Wy1 + h * 0.018, seat.x1 - seat.x0, h * 0.035);
    const cushions = ['#1d5a3c', '#a8b4b0', '#1d5a3c', '#2c6a4a', '#a8b4b0'];
    const nc = Math.max(2, Math.round((U.x1 - U.x0) / (0.16 * k)));
    for (let i = 0; i < nc; i++) {
      const cw = 0.075 * k;
      const x = U.x0 + ((U.x1 - U.x0 - cw) * (i + 0.15 + r() * 0.3)) / nc;
      g.fillStyle = cushions[i % cushions.length];
      g.beginPath();
      g.roundRect(x, Wy1 - 0.022 * k, cw, 0.026 * k, 6 * this.dpr);
      g.fill();
    }

    // on a wide screen there is floor to spare: a high-backed chair turned to the window, books by it
    const sofa = { x0: -0.03 * k, x1: 0.21 * k, y0: hb - 0.17 * k, y1: hb + 0.045 * k };
    const rug = { x: w - 0.25 * k, y: hb + 0.03 * k, rx: 0.22 * k, ry: 0.055 * k };
    const free = rug.x - rug.rx - sofa.x1;
    if (free > 0.3 * k) {
      const cx = sofa.x1 + free * 0.5;
      const cw = 0.13 * k;
      const ch = 0.24 * k;
      const by = hb - 0.04 * k;
      g.fillStyle = '#0d241a';
      g.fillRect(cx - cw * 0.42, by - ch * 0.08, cw * 0.06, ch * 0.1);
      g.fillRect(cx + cw * 0.36, by - ch * 0.08, cw * 0.06, ch * 0.1);
      g.fillStyle = '#123526';
      g.beginPath();
      g.moveTo(cx - cw * 0.5, by - ch * 0.05);
      g.lineTo(cx - cw * 0.52, by - ch * 0.62);
      g.quadraticCurveTo(cx - cw * 0.56, by - ch * 0.82, cx - cw * 0.38, by - ch * 0.86);
      g.quadraticCurveTo(cx - cw * 0.3, by - ch * 1.02, cx, by - ch);
      g.quadraticCurveTo(cx + cw * 0.3, by - ch * 1.02, cx + cw * 0.38, by - ch * 0.86);
      g.quadraticCurveTo(cx + cw * 0.56, by - ch * 0.82, cx + cw * 0.52, by - ch * 0.62);
      g.lineTo(cx + cw * 0.5, by - ch * 0.05);
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(150,240,190,0.3)';
      g.lineWidth = 2 * this.dpr;
      g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.3)';
      g.lineWidth = this.dpr;
      g.beginPath();
      g.moveTo(cx - cw * 0.36, by - ch * 0.84);
      g.lineTo(cx - cw * 0.34, by - ch * 0.1);
      g.moveTo(cx + cw * 0.36, by - ch * 0.84);
      g.lineTo(cx + cw * 0.34, by - ch * 0.1);
      g.stroke();
      let y = by + 0.01 * k;
      for (const [bw, col] of [
        [0.07, '#5a2a22'],
        [0.06, '#1f4a3a'],
        [0.065, '#3a3a52'],
        [0.05, '#6a5a2a'],
      ]) {
        const bh = 0.014 * k;
        const bx = cx + cw * 0.75 + R(-0.006, 0.006) * k;
        g.fillStyle = col;
        g.fillRect(bx, y - bh, bw * k, bh);
        g.fillStyle = 'rgba(230,220,190,0.6)';
        g.fillRect(bx + bw * k - 0.006 * k, y - bh * 0.8, 0.004 * k, bh * 0.6);
        y -= bh;
      }
    }

    // the fireplace: flue, hood, mantel shelf, jambs, the opening, a carved serpent down each side
    g.fillStyle = vgrad(g, 0, F.hood, [
      [0, '#0c1615'],
      [1, C.mid],
    ]);
    g.fillRect(F.flue, 0, w - F.flue, F.hood + 1);
    const sweep = (pen) => {
      pen.moveTo(F.x0 + 0.02 * k, F.mantel);
      pen.quadraticCurveTo(F.flue - 0.01 * k, F.mantel - 0.02 * k, F.flue, F.hood);
    };
    g.beginPath();
    sweep(g);
    g.lineTo(w, F.hood);
    g.lineTo(w, F.mantel);
    g.closePath();
    g.fillStyle = vgrad(g, F.hood, F.mantel, [
      [0, '#121f1d'],
      [1, '#2a423d'],
    ]);
    g.fill();
    g.strokeStyle = 'rgba(160,240,200,0.18)';
    g.lineWidth = 1.5 * this.dpr;
    g.beginPath();
    sweep(g);
    g.stroke();
    // a silver serpent in a roundel on the hood
    const md = { x: (F.flue + w) / 2 - 0.01 * k, y: lerp(F.mantel, F.hood, 0.5), r: 0.03 * k };
    g.fillStyle = '#18282a';
    g.beginPath();
    g.ellipse(md.x, md.y, md.r, md.r * 1.1, 0, 0, TAU);
    g.fill();
    g.globalAlpha = 0.75;
    g.strokeStyle = '#a9c4bc';
    g.lineWidth = Math.max(1.5, md.r * 0.08);
    g.stroke();
    g.lineWidth = Math.max(2, md.r * 0.16);
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(md.x + md.r * 0.35, md.y + md.r * 0.75);
    g.bezierCurveTo(md.x - md.r * 0.9, md.y + md.r * 0.5, md.x + md.r * 0.9, md.y - md.r * 0.2, md.x - md.r * 0.1, md.y - md.r * 0.55);
    g.stroke();
    g.fillStyle = '#a9c4bc';
    g.beginPath();
    g.ellipse(md.x - md.r * 0.2, md.y - md.r * 0.62, md.r * 0.2, md.r * 0.13, -0.4, 0, TAU);
    g.fill();
    g.globalAlpha = 1;
    // jambs and frieze
    g.fillStyle = vgrad(g, F.mantel, hb, [
      [0, '#2c4741'],
      [1, '#22372f'],
    ]);
    g.fillRect(F.x0 + 0.02 * k, F.mantel, w - F.x0, hb - F.mantel);
    g.fillStyle = 'rgba(160,240,200,0.14)';
    g.fillRect(F.x0 + 0.02 * k, F.mantel, 0.004 * k, hb - F.mantel);
    // mantel shelf
    g.fillStyle = C.edge;
    g.fillRect(F.x0, F.mantel - 0.025 * k, w - F.x0 + 1, 0.028 * k);
    g.strokeStyle = C.rim;
    g.globalAlpha = 0.4;
    g.lineWidth = 1.5 * this.dpr;
    g.beginPath();
    g.moveTo(F.x0, F.mantel - 0.025 * k);
    g.lineTo(w, F.mantel - 0.025 * k);
    g.stroke();
    g.globalAlpha = 1;
    // a candle or two on the shelf
    for (const [x, ch] of [
      [F.x0 + 0.05 * k, 0.05],
      [F.x0 + 0.075 * k, 0.035],
    ]) {
      g.fillStyle = '#d8d0b8';
      g.fillRect(x, F.mantel - 0.025 * k - ch * k, 0.012 * k, ch * k);
    }
    this.candles = [
      [F.x0 + 0.056 * k, F.mantel - 0.025 * k - 0.05 * k],
      [F.x0 + 0.081 * k, F.mantel - 0.025 * k - 0.035 * k],
    ];
    // the opening, a low arch
    this.mouth = mo;
    this.mouthPath = new Path2D();
    this.mouthPath.moveTo(mo.x0, mo.y1);
    this.mouthPath.lineTo(mo.x0, mo.y0 + 0.03 * k);
    this.mouthPath.quadraticCurveTo((mo.x0 + mo.x1) / 2, mo.y0 - 0.025 * k, mo.x1, mo.y0 + 0.03 * k);
    this.mouthPath.lineTo(mo.x1, mo.y1);
    this.mouthPath.closePath();
    const mg = g.createLinearGradient(0, mo.y0, 0, mo.y1);
    mg.addColorStop(0, '#050403');
    mg.addColorStop(1, '#1a0d06');
    g.fillStyle = mg;
    g.fill(this.mouthPath);
    for (const x of [mo.x0 - 0.026 * k, mo.x1 + 0.012 * k]) {
      g.strokeStyle = 'rgba(110,150,138,0.7)';
      g.lineWidth = 0.011 * k;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(x + 0.007 * k, F.mantel + 0.03 * k);
      for (let i = 0; i < 6; i++) g.quadraticCurveTo(x + (i % 2 ? 0.018 : -0.004) * k, F.mantel + (0.04 + i * 0.03) * k, x + 0.007 * k, F.mantel + (0.055 + i * 0.03) * k);
      g.stroke();
      g.fillStyle = 'rgba(110,150,138,0.8)';
      g.beginPath();
      g.ellipse(x + 0.007 * k, F.mantel + 0.026 * k, 0.012 * k, 0.007 * k, 0, 0, TAU);
      g.fill();
    }
    // hearthstone
    g.fillStyle = '#1e2a27';
    g.fillRect(F.x0 - 0.01 * k, hb, w - F.x0 + 0.02 * k, 0.02 * k);
    g.fillStyle = 'rgba(160,220,200,0.12)';
    g.fillRect(F.x0 - 0.01 * k, hb, w - F.x0 + 0.02 * k, 0.003 * k);

    // the rug, oval, green with a silver border
    this.rug = rug;
    g.fillStyle = '#c2ccc8';
    g.beginPath();
    g.ellipse(rug.x, rug.y, rug.rx, rug.ry, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#1b4a34';
    g.beginPath();
    g.ellipse(rug.x, rug.y, rug.rx * 0.93, rug.ry * 0.84, 0, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(190,210,200,0.35)';
    g.lineWidth = 1.5 * this.dpr;
    g.beginPath();
    g.ellipse(rug.x, rug.y, rug.rx * 0.75, rug.ry * 0.64, 0, 0, TAU);
    g.stroke();

    // a deep chesterfield on the left, its back to us, a book left open on the arm
    const so = sofa;
    g.fillStyle = '#0f2a1e';
    g.beginPath();
    g.roundRect(so.x0, so.y0, so.x1 - so.x0, so.y1 - so.y0, 0.025 * k);
    g.fill();
    g.fillStyle = '#17402d';
    g.beginPath();
    g.roundRect(so.x0 + 0.006 * k, so.y0 + 0.003 * k, so.x1 - so.x0 - 0.012 * k, (so.y1 - so.y0) * 0.55, 0.022 * k);
    g.fill();
    g.fillStyle = 'rgba(10,25,18,0.9)';
    for (let i = 0; i * 0.035 * k < so.x1 - so.x0 - 0.05 * k; i++) {
      for (let j = 0; j < 2; j++) {
        g.beginPath();
        g.arc(so.x0 + (0.025 + i * 0.035 + j * 0.0175) * k, so.y0 + (0.025 + j * 0.03) * k, 0.0028 * k, 0, TAU);
        g.fill();
      }
    }
    g.fillStyle = '#163a29';
    g.beginPath();
    g.roundRect(so.x1 - 0.035 * k, so.y0 - 0.008 * k, 0.04 * k, so.y1 - so.y0 + 0.008 * k, 0.015 * k);
    g.fill();
    g.strokeStyle = C.warm;
    g.globalAlpha = 0.35;
    g.lineWidth = 2 * this.dpr;
    g.beginPath();
    g.moveTo(so.x1 + 0.004 * k, so.y0 + 0.006 * k);
    g.lineTo(so.x1 + 0.004 * k, so.y1 - 0.006 * k);
    g.stroke();
    g.globalAlpha = 1;
    // the book, open face down over the arm
    g.fillStyle = '#5a2a22';
    g.beginPath();
    g.moveTo(so.x1 - 0.04 * k, so.y0 - 0.002 * k);
    g.lineTo(so.x1 - 0.015 * k, so.y0 - 0.016 * k);
    g.lineTo(so.x1 + 0.01 * k, so.y0 - 0.002 * k);
    g.lineTo(so.x1 + 0.012 * k, so.y0 + 0.012 * k);
    g.lineTo(so.x1 - 0.015 * k, so.y0 - 0.004 * k);
    g.lineTo(so.x1 - 0.042 * k, so.y0 + 0.012 * k);
    g.closePath();
    g.fill();
    g.fillStyle = '#e8dcc0';
    g.fillRect(so.x1 - 0.04 * k, so.y0 + 0.004 * k, 0.05 * k, 0.003 * k);

    printGrain(this.room, this.grain, 0.16);

    // sprites
    this.cat = catSprite(0.12 * k);
    this.snake = snakeSprite(0.085 * k);
    this.glow = glowSprite([
      [0, 'rgba(255,200,130,0.85)'],
      [0.3, 'rgba(255,150,70,0.3)'],
      [1, 'rgba(255,120,50,0)'],
    ]);
    this.fireGlow = glowSprite([
      [0, 'rgba(255,140,50,0.75)'],
      [0.35, 'rgba(230,90,30,0.25)'],
      [1, 'rgba(200,60,20,0)'],
    ]);
    this.greenGlow = glowSprite([
      [0, 'rgba(170,255,200,0.8)'],
      [0.3, 'rgba(90,220,150,0.25)'],
      [1, 'rgba(60,200,130,0)'],
    ]);

    // lamps hanging on chains from the vault: [x of the hook, chain length, size]
    this.lamps = [
      [0.24, 0.17, 1.0],
      [0.5, 0.08, 0.6],
      [0.66, 0.2, 1.1],
      [0.38, 0.05, 0.5],
      [0.8, 0.1, 0.8],
    ].map(([x, L, s]) => ({ x: x * w, L: L * h, s: s * u * 3.2, ph: R(0, TAU), f: R(0.35, 0.6) }));

    // the lake: a deep green gradient, far rocks and the bed in silhouette, with grain
    const lw = Math.ceil(U.x1 - U.x0);
    const lh = Math.ceil(U.y1 - U.y0);
    this.water = layer(lw, lh);
    const wq = this.water.getContext('2d');
    wq.fillStyle = vgrad(wq, 0, lh, [
      [0, '#3c8e74'],
      [0.35, '#1d5a48'],
      [1, '#071f1a'],
    ]);
    wq.fillRect(0, 0, lw, lh);
    for (const [base, amp, col, n] of [
      [0.8, 0.22, 'rgba(10,50,38,0.55)', 3],
      [0.93, 0.1, '#06180f', 7],
    ]) {
      wq.fillStyle = col;
      wq.beginPath();
      wq.moveTo(0, lh);
      for (let x = 0; x <= lw; x += 6) {
        const f = x / lw;
        wq.lineTo(x, lh * (base - amp * (0.5 + 0.5 * Math.sin(f * n * TAU * 0.5 + base * 9)) * (0.6 + 0.4 * Math.sin(f * 13.7 + n))));
      }
      wq.lineTo(lw, lh);
      wq.fill();
    }
    printGrain(this.water, this.grain, 0.22);
    this.weeds = Array.from({ length: Math.round(10 + (lw / k) * 8) }, () => ({ x: U.x0 + R(-0.03, 1.03) * lw, hgt: R(0.12, 0.38) * lh, ph: R(0, TAU), f: R(0.25, 0.5), wd: R(2, 5) * this.dpr, col: r() < 0.5 ? '#0d3a2a' : '#164a34' }));
    this.motes = Array.from({ length: Math.round(30 + (lw / k) * 40) }, () => ({ x: U.x0 + R(0, 1) * lw, y: U.y0 + R(0, 1) * lh, v: R(0.4, 1.2) * u, a: R(0.15, 0.5) }));
    this.fish = [];
    this.bubbles = [];
    this.squid = null;
    this.nextSquid = R(25, 70);
    this.mer = null;
  }

  event(e) {
    if (e.type === 'shot' && e.layer === 'bubbles') this.at(e.at, () => this.stream());
    if (e.type === 'shot' && e.layer === 'deep') this.at(e.at, () => (this.mer = { t0: this.t, dir: Math.random() < 0.5 ? 1 : -1, y: rand(0.35, 0.7) }));
  }

  // a stream of bubbles rising past one of the windows
  stream() {
    const W = this.wins[Math.floor(Math.random() * this.wins.length)];
    const x = W.x0 + rand(0.15, 0.85) * (W.x1 - W.x0);
    for (let i = 0; i < 18; i++) this.bubbles.push({ x: x + rand(-1, 1) * this.u, y: W.y1 + i * rand(1.5, 3) * this.u, r: rand(0.25, 0.8) * this.u, v: rand(6, 11) * this.u, ph: rand(0, TAU) });
  }

  frame(dt) {
    const { g, t, u } = this;
    const U = this.lake;
    const ww = U.x1 - U.x0;
    const wh = U.y1 - U.y0;

    // --- the lake through the windows
    g.save();
    g.clip(this.glass);
    g.drawImage(this.water, U.x0, U.y0);
    // shafts of light from the surface, drifting
    g.globalCompositeOperation = 'lighter';
    const ns = Math.max(4, Math.round(ww / (wh * 0.3)));
    for (let i = 0; i < ns; i++) {
      const x = U.x0 + ww * ((i + 0.5) / ns - 0.08) + Math.sin(t * 0.07 + i * 1.7) * ww * 0.03;
      const a = 0.05 + 0.035 * Math.sin(t * 0.13 + i * 2.3);
      const sh = g.createLinearGradient(0, U.y0, 0, U.y0 + wh * 0.9);
      sh.addColorStop(0, `rgba(190,255,220,${a})`);
      sh.addColorStop(1, 'rgba(190,255,220,0)');
      g.fillStyle = sh;
      g.beginPath();
      g.moveTo(x - wh * 0.02, U.y0);
      g.lineTo(x + wh * 0.05, U.y0);
      g.lineTo(x + wh * 0.2, U.y0 + wh * 0.95);
      g.lineTo(x + wh * 0.07, U.y0 + wh * 0.95);
      g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    // when something sings out in the deep, a far, dim swimmer passes in the murk
    if (this.mer) {
      const m = this.mer;
      const age = t - m.t0;
      const life = 40;
      if (age > life) this.mer = null;
      else {
        const p = age / life;
        const x = m.dir > 0 ? U.x0 - wh * 0.1 + p * (ww + wh * 0.2) : U.x1 + wh * 0.1 - p * (ww + wh * 0.2);
        const y = U.y0 + wh * m.y + Math.sin(age * 0.5) * wh * 0.02;
        const s = u * 3;
        g.globalAlpha = 0.28 * Math.sin(Math.PI * p);
        g.fillStyle = '#04140f';
        g.save();
        g.translate(x, y);
        g.scale(m.dir, 1);
        g.beginPath();
        g.ellipse(0, 0, s * 1.6, s * 0.45, 0, 0, TAU);
        g.ellipse(s * 1.7, -s * 0.15, s * 0.45, s * 0.4, 0, 0, TAU);
        g.fill();
        const tail = Math.sin(age * 2) * s * 0.5;
        g.beginPath();
        g.moveTo(-s * 1.5, 0);
        g.lineTo(-s * 2.6, -s * 0.6 + tail);
        g.lineTo(-s * 2.4, tail * 0.3);
        g.lineTo(-s * 2.6, s * 0.6 + tail);
        g.closePath();
        g.fill();
        g.restore();
        g.globalAlpha = 1;
      }
    }
    // the giant squid, drifting past now and then
    this.nextSquid -= dt;
    if (!this.squid && this.nextSquid <= 0) this.squid = { t0: t, dir: Math.random() < 0.5 ? 1 : -1, y: rand(0.4, 0.62) };
    if (this.squid) {
      const sq = this.squid;
      const age = t - sq.t0;
      const S = wh * 0.36;
      const life = 25 + (ww / S) * 6;
      if (age > life) {
        this.squid = null;
        this.nextSquid = rand(120, 300);
      } else {
        const p = age / life;
        const x = sq.dir > 0 ? U.x0 - S * 2 + p * (ww + S * 4) : U.x1 + S * 2 - p * (ww + S * 4);
        const y = U.y0 + wh * sq.y + Math.sin(age * 0.3) * wh * 0.03;
        g.save();
        g.translate(x, y);
        g.scale(-sq.dir, 1); // swims mantle first
        g.globalAlpha = 0.6;
        g.strokeStyle = '#1e1a24';
        g.lineCap = 'round';
        for (let i = 0; i < 10; i++) {
          const len = S * (i < 2 ? 1.7 : 0.95) * (0.85 + 0.15 * Math.sin(i * 3.1));
          const spread = (i - 4.5) * 0.022;
          const w0 = S * (i < 2 ? 0.03 : 0.055);
          let px = S * 0.18;
          let py = spread * S;
          for (let j = 1; j <= 8; j++) {
            const f = j / 8;
            const x = S * 0.18 + len * f;
            const y = spread * S * (1 + f * 1.2) + Math.sin(age * 1.1 + i * 0.5 + f * 3.5) * S * 0.1 * f;
            g.lineWidth = w0 * (1 - f * 0.8);
            g.beginPath();
            g.moveTo(px, py);
            g.lineTo(x, y);
            g.stroke();
            px = x;
            py = y;
          }
        }
        // the mantle, long and tapering to a pair of fins
        g.fillStyle = '#2c2230';
        g.beginPath();
        g.moveTo(-S * 1.25, 0);
        g.lineTo(-S * 0.95, -S * 0.2);
        g.lineTo(-S * 0.8, -S * 0.08);
        g.quadraticCurveTo(-S * 0.3, -S * 0.17, S * 0.08, -S * 0.12);
        g.quadraticCurveTo(S * 0.2, -S * 0.08, S * 0.2, 0);
        g.quadraticCurveTo(S * 0.2, S * 0.08, S * 0.08, S * 0.12);
        g.quadraticCurveTo(-S * 0.3, S * 0.17, -S * 0.8, S * 0.08);
        g.lineTo(-S * 0.95, S * 0.2);
        g.closePath();
        g.fill();
        g.fillStyle = 'rgba(150,120,150,0.3)';
        g.beginPath();
        g.ellipse(-S * 0.35, -S * 0.07, S * 0.4, S * 0.04, 0, 0, TAU);
        g.fill();
        g.fillStyle = '#c8d8a0';
        g.beginPath();
        g.arc(S * 0.1, -S * 0.04, S * 0.03, 0, TAU);
        g.fill();
        g.restore();
        g.globalAlpha = 1;
      }
    }
    // fish, singly and in little shoals
    if (this.fish.length < 7 && Math.random() < dt * 0.25) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      const n = Math.random() < 0.3 ? 5 : 1;
      const y = U.y0 + wh * rand(0.2, 0.8);
      const s = rand(0.6, 1.6) * u;
      for (let i = 0; i < n; i++) this.fish.push({ x: dir > 0 ? U.x0 - 20 - i * s * 4 : U.x1 + 20 + i * s * 4, y: y + rand(-1, 1) * s * 3, dir, s, v: rand(4, 9) * s, ph: rand(0, TAU) });
    }
    this.fish = this.fish.filter((f) => f.x > U.x0 - 60 * this.dpr && f.x < U.x1 + 60 * this.dpr);
    g.fillStyle = 'rgba(8,30,24,0.8)';
    for (const f of this.fish) {
      f.x += f.dir * f.v * dt;
      const y = f.y + Math.sin(t * 1.3 + f.ph) * f.s * 0.6;
      const wag = Math.sin(t * 8 + f.ph) * f.s * 0.35;
      g.beginPath();
      g.ellipse(f.x, y, f.s * 1.6, f.s * 0.55, 0, 0, TAU);
      g.moveTo(f.x - f.dir * f.s * 1.4, y);
      g.lineTo(f.x - f.dir * f.s * 2.6, y - f.s * 0.7 + wag);
      g.lineTo(f.x - f.dir * f.s * 2.6, y + f.s * 0.7 + wag);
      g.fill();
    }
    // weed rising from the bed of the lake, swaying
    g.lineCap = 'round';
    for (const wd of this.weeds) {
      g.strokeStyle = wd.col;
      g.lineWidth = wd.wd;
      g.beginPath();
      g.moveTo(wd.x, U.y1 + 4);
      for (let j = 1; j <= 8; j++) {
        const f = j / 8;
        g.lineTo(wd.x + Math.sin(t * wd.f + wd.ph + f * 2.2) * f * wh * 0.05, U.y1 - wd.hgt * f);
      }
      g.stroke();
    }
    // motes drifting in the water, and bubbles
    for (const m of this.motes) {
      m.y -= m.v * dt * 0.3;
      m.x += Math.sin(t * 0.2 + m.y) * dt * u * 0.2;
      if (m.y < U.y0) m.y = U.y1;
      g.fillStyle = `rgba(200,255,225,${m.a * 0.5})`;
      g.fillRect(m.x, m.y, 1.5 * this.dpr, 1.5 * this.dpr);
    }
    this.bubbles = this.bubbles.filter((b) => b.y > U.y0 - 10);
    g.strokeStyle = 'rgba(210,255,235,0.55)';
    g.lineWidth = this.dpr;
    for (const b of this.bubbles) {
      b.y -= b.v * dt;
      g.beginPath();
      g.arc(b.x + Math.sin(t * 3 + b.ph) * b.r, b.y, b.r, 0, TAU);
      g.stroke();
    }
    g.restore();
    this.tracery(g);

    // --- the room
    g.drawImage(this.room, 0, 0);
    // cool light from the windows, warm light from the fire
    const fireOn = this.engine.scene?.layers?.get('fire')?.level ?? 0.6;
    const lvl = clamp(fireOn * 1.6, 0.25, 1);
    const flick = (0.78 + 0.12 * Math.sin(t * 7.3) * Math.sin(t * 3.1) + 0.1 * Math.sin(t * 13.7)) * lvl;
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.1;
    for (const W of this.wins) {
      const ww1 = W.x1 - W.x0;
      g.drawImage(this.greenGlow, W.x0 - ww1 * 0.3, W.y0 + wh * 0.25, ww1 * 1.6, wh * 1.3);
    }
    const mo = this.mouth;
    const mw = mo.x1 - mo.x0;
    const mh = mo.y1 - mo.y0;
    const fx = (mo.x0 + mo.x1) / 2;
    g.globalAlpha = 0.45 * flick;
    g.drawImage(this.fireGlow, fx - mw * 1.6, mo.y1 - mh * 1.7, mw * 3.2, mh * 2.6);
    for (const [cx, cy] of this.candles) {
      g.globalAlpha = 0.35 + 0.05 * Math.sin(t * 9 + cx);
      g.drawImage(this.glow, cx - mw * 0.15, cy - mw * 0.17, mw * 0.3, mw * 0.3);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    for (const [cx, cy] of this.candles) {
      g.fillStyle = 'rgba(255,220,150,0.95)';
      g.beginPath();
      g.ellipse(cx, cy - mw * 0.02, mw * 0.008, mw * 0.022 * (1 + 0.1 * Math.sin(t * 11 + cx)), 0, 0, TAU);
      g.fill();
    }
    hearthFire(g, mo, this.mouthPath, this.glow, t, lvl, flick);

    // the cat and the snake, asleep on the rug, breathing
    const rug = this.rug;
    const cw = this.cat.width;
    const ch = this.cat.height;
    const cb = 1 + 0.025 * Math.sin(t * 1.6);
    const catX = rug.x - cw * 0.36;
    g.drawImage(this.cat, catX, rug.y - ch * 0.86 - ch * (cb - 1), cw, ch * cb);
    const sw = this.snake.width;
    const sh = this.snake.height;
    const sb = 1 + 0.015 * Math.sin(t * 0.9 + 1);
    g.drawImage(this.snake, catX - sw * 0.78, rug.y - sh * 0.78 - sh * (sb - 1), sw, sh * sb);

    // green lamps swaying on their chains
    for (const l of this.lamps) {
      const ang = Math.sin(t * l.f + l.ph) * 0.04;
      const ex = l.x + Math.sin(ang) * l.L;
      const ey = Math.cos(ang) * l.L;
      g.strokeStyle = 'rgba(150,170,165,0.55)';
      g.lineWidth = Math.max(1, l.s * 0.08);
      g.setLineDash([l.s * 0.18, l.s * 0.1]);
      g.beginPath();
      g.moveTo(l.x, 0);
      g.lineTo(ex, ey);
      g.stroke();
      g.setLineDash([]);
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.5;
      g.drawImage(this.greenGlow, ex - l.s * 3, ey + l.s * 0.2 - l.s * 3, l.s * 6, l.s * 6);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      g.save();
      g.translate(ex, ey);
      g.rotate(-ang);
      g.fillStyle = '#5a6e68';
      g.fillRect(-l.s * 0.5, 0, l.s, l.s * 0.18);
      g.fillStyle = 'rgba(120,255,170,0.85)';
      g.beginPath();
      g.moveTo(-l.s * 0.42, l.s * 0.18);
      g.lineTo(l.s * 0.42, l.s * 0.18);
      g.lineTo(l.s * 0.3, l.s * 1.1);
      g.lineTo(-l.s * 0.3, l.s * 1.1);
      g.fill();
      g.strokeStyle = '#a9c4bc';
      g.lineWidth = Math.max(1, l.s * 0.06);
      g.stroke();
      g.fillStyle = '#5a6e68';
      g.fillRect(-l.s * 0.35, l.s * 1.1, l.s * 0.7, l.s * 0.14);
      g.restore();
    }
  }
}
// ---------------------------------------------------------------------------------------------
// A round, low common room by the kitchens: honey-coloured wood and warm plaster, round windows up
// at the level of the grass outside, plants hanging in copper pots, a fire with a copper hood and
// the kettle by it, tea and a book on the table, and a pile of three cats on the rug by the fire: a
// tuxedo asleep, a bicolour curled up against him, and a black cat behind them, awake, slow-blinking. When it rains the sky outside greys and drops run
// down the glass; when it doesn't, the sun slants in and dandelion seeds drift past. A garden bird
// that sings outside comes down onto the grass while it sings.

// grass blades from the bottom of a layer, tips between two heights; dandelions and seed clocks
function grassLayer(W, H, n, tipLo, tipHi, cols, seed, flowers = 0, clocks = 0) {
  const c = layer(W, H);
  const q = c.getContext('2d');
  const r = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const blade = (x, tip, lean, bw, col) => {
    q.fillStyle = col;
    q.beginPath();
    q.moveTo(x - bw / 2, H);
    q.quadraticCurveTo(x + lean * 0.3, (H + tip) / 2, x + lean, tip);
    q.quadraticCurveTo(x + lean * 0.3 + bw * 0.3, (H + tip) / 2, x + bw / 2, H);
    q.fill();
  };
  for (let i = 0; i < n; i++) blade(r() * W, H * (tipLo + r() * (tipHi - tipLo)), (r() - 0.5) * H * 0.15, H * (0.012 + r() * 0.014), cols[Math.floor(r() * cols.length)]);
  const stem = (x, top) => {
    q.strokeStyle = '#4f8a30';
    q.lineWidth = Math.max(1, H * 0.006);
    q.beginPath();
    q.moveTo(x, H);
    q.quadraticCurveTo(x + H * 0.02, (H + top) / 2, x + H * 0.01, top);
    q.stroke();
  };
  for (let i = 0; i < flowers; i++) {
    const x = r() * W;
    const top = H * (tipLo + 0.06 + r() * 0.16);
    const R = H * (0.016 + r() * 0.008);
    stem(x, top);
    q.fillStyle = '#e8a90e';
    q.beginPath();
    q.ellipse(x + H * 0.01, top, R, R * 0.8, 0, 0, TAU);
    q.fill();
    q.strokeStyle = '#ffd23a';
    q.lineWidth = Math.max(1, R * 0.18);
    q.beginPath();
    for (let j = 0; j < 16; j++) {
      const a = (j / 16) * TAU;
      q.moveTo(x + H * 0.01 + Math.cos(a) * R * 0.3, top + Math.sin(a) * R * 0.25);
      q.lineTo(x + H * 0.01 + Math.cos(a) * R * 1.05, top + Math.sin(a) * R * 0.85);
    }
    q.stroke();
  }
  for (let i = 0; i < clocks; i++) {
    const x = r() * W;
    const top = H * (tipLo - 0.06 + r() * 0.08);
    const R = H * 0.045;
    stem(x, top);
    q.strokeStyle = 'rgba(255,255,255,0.55)';
    q.lineWidth = Math.max(0.6, H * 0.0025);
    q.beginPath();
    for (let j = 0; j < 40; j++) {
      const a = r() * TAU;
      const rr = R * (0.8 + r() * 0.2);
      q.moveTo(x + H * 0.01, top);
      q.lineTo(x + H * 0.01 + Math.cos(a) * rr, top + Math.sin(a) * rr);
    }
    q.stroke();
    q.fillStyle = 'rgba(255,255,255,0.35)';
    q.beginPath();
    q.arc(x + H * 0.01, top, R, 0, TAU);
    q.fill();
  }
  return c;
}

// a small garden bird standing on the grass, facing right
const GARDEN_BIRDS = {
  robin: { body: '#7a5a3a', breast: '#e8743a', beak: '#2a2018', s: 1 },
  blackbird: { body: '#1c1a18', breast: '#26221e', beak: '#f2b21a', s: 1.35 },
  wren: { body: '#8a6440', breast: '#c8a070', beak: '#3a2a1a', s: 0.75, tail: true },
  'song-thrush': { body: '#8a6a44', breast: '#efe0c0', beak: '#3a2a1a', s: 1.2, spots: true },
};
function gardenBird(g, x, y, s, kind, hop) {
  const k = GARDEN_BIRDS[kind] || GARDEN_BIRDS.robin;
  s *= k.s;
  y -= Math.abs(Math.sin(hop * Math.PI)) * s * 0.8;
  g.save();
  g.translate(x, y);
  g.strokeStyle = '#3a2a1a';
  g.lineWidth = Math.max(1, s * 0.08);
  g.beginPath();
  g.moveTo(-s * 0.1, 0);
  g.lineTo(-s * 0.15, s * 0.45);
  g.moveTo(s * 0.12, 0);
  g.lineTo(s * 0.1, s * 0.45);
  g.stroke();
  g.fillStyle = k.body;
  g.beginPath(); // tail
  g.moveTo(-s * 0.5, -s * 0.2);
  g.lineTo(-s * 1.05, k.tail ? -s * 0.85 : -s * 0.05);
  g.lineTo(-s * 0.95, k.tail ? -s * 0.95 : s * 0.12);
  g.lineTo(-s * 0.4, -s * 0.05);
  g.fill();
  g.beginPath();
  g.ellipse(0, -s * 0.3, s * 0.6, s * 0.38, -0.15, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(s * 0.48, -s * 0.68, s * 0.27, 0, TAU);
  g.fill();
  g.fillStyle = k.breast;
  g.beginPath();
  g.ellipse(s * 0.32, -s * 0.38, s * 0.3, s * 0.3, 0, 0, TAU);
  g.fill();
  if (kind === 'robin') {
    g.beginPath();
    g.arc(s * 0.55, -s * 0.62, s * 0.18, 0, TAU);
    g.fill();
  }
  if (k.spots) {
    g.fillStyle = '#5a4026';
    for (const [dx, dy] of [
      [0.25, -0.45],
      [0.4, -0.32],
      [0.3, -0.22],
      [0.45, -0.5],
    ]) {
      g.beginPath();
      g.arc(s * dx, s * dy, s * 0.04, 0, TAU);
      g.fill();
    }
  }
  g.fillStyle = k.beak;
  g.beginPath();
  g.moveTo(s * 0.7, -s * 0.74);
  g.lineTo(s * 0.98, -s * 0.66);
  g.lineTo(s * 0.7, -s * 0.6);
  g.fill();
  g.fillStyle = '#0a0806';
  g.beginPath();
  g.arc(s * 0.55, -s * 0.74, s * 0.05, 0, TAU);
  g.fill();
  g.restore();
}

// a copper pot hung on a chain, a plant in it trailing long strands, as a sprite hung from (S, 0)
function hangingPlant(S, L, seed) {
  const c = layer(Math.ceil(S * 2), Math.ceil(L + S * 2.6));
  const g = c.getContext('2d');
  const r = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const cx = S;
  g.strokeStyle = 'rgba(150,110,70,0.8)';
  g.lineWidth = Math.max(1, S * 0.04);
  g.setLineDash([S * 0.09, S * 0.05]);
  g.beginPath();
  g.moveTo(cx, 0);
  g.lineTo(cx, L - S * 0.35);
  for (const dx of [-0.45, 0.45]) {
    g.moveTo(cx, L - S * 0.35);
    g.lineTo(cx + dx * S, L);
  }
  g.stroke();
  g.setLineDash([]);
  const leaf = (x, y, a, sz, col) => {
    g.fillStyle = col;
    g.beginPath();
    g.ellipse(x, y, sz, sz * 0.5, a, 0, TAU);
    g.fill();
  };
  // trailing strands, under the pot
  const greens = ['#4f7a3a', '#6f9a48', '#3e6a30', '#86ac56'];
  for (let i = 0; i < 6; i++) {
    let x = cx + (r() - 0.5) * S * 0.9;
    let y = L + S * 0.25;
    const len = S * (0.8 + r() * 1.4);
    const drift = (r() - 0.5) * 0.5;
    g.strokeStyle = '#4a6a30';
    g.lineWidth = Math.max(1, S * 0.025);
    g.beginPath();
    g.moveTo(x, y);
    const pts = [];
    for (let j = 1; j <= 8; j++) {
      x += drift * S * 0.12 + Math.sin(j * 0.9 + i) * S * 0.03;
      y += len / 8;
      g.lineTo(x, y);
      pts.push([x, y]);
    }
    g.stroke();
    for (const [px, py] of pts) {
      leaf(px - S * 0.06, py, -0.6, S * 0.09, greens[Math.floor(r() * 4)]);
      leaf(px + S * 0.06, py + S * 0.04, 0.6, S * 0.09, greens[Math.floor(r() * 4)]);
    }
  }
  // the pot, burnished copper
  const pg = g.createLinearGradient(cx - S * 0.5, 0, cx + S * 0.5, 0);
  pg.addColorStop(0, '#6a3418');
  pg.addColorStop(0.35, '#d08448');
  pg.addColorStop(0.5, '#f2b47c');
  pg.addColorStop(1, '#7a3a18');
  g.fillStyle = pg;
  g.beginPath();
  g.moveTo(cx - S * 0.5, L);
  g.quadraticCurveTo(cx - S * 0.48, L + S * 0.48, cx, L + S * 0.5);
  g.quadraticCurveTo(cx + S * 0.48, L + S * 0.48, cx + S * 0.5, L);
  g.closePath();
  g.fill();
  g.fillStyle = '#8a4a22';
  g.fillRect(cx - S * 0.52, L - S * 0.04, S * 1.04, S * 0.08);
  // and a mound of leaves on top
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI;
    leaf(cx + Math.cos(a) * S * 0.45 * r(), L - Math.sin(a) * S * 0.3 * r() - S * 0.02, (r() - 0.5) * 2, S * (0.1 + r() * 0.06), greens[Math.floor(r() * 4)]);
  }
  return c;
}

// an all-black cat with long, soft fur and yellow eyes, lying in a loaf facing left with his head up,
// drawn smooth like his friend; open eyes, or shut for a slow blink. The fire is on his left.
function blackCatSprite(S, open) {
  const c = layer(Math.ceil(S * 1.6), Math.ceil(S * 1.2));
  const g = c.getContext('2d');
  const cx = S * 0.85;
  const cy = S * 0.82;
  const BLACK = '#141418';
  const lit = (path, col, a) => {
    const rg = g.createLinearGradient(cx + S * 0.2, 0, cx - S * 0.6, 0);
    rg.addColorStop(0, 'rgba(255,165,85,0)');
    rg.addColorStop(1, `rgba(255,165,85,${a})`);
    g.strokeStyle = rg;
    g.lineWidth = S * 0.026;
    g.stroke(path);
    g.fillStyle = col;
    g.fill(path);
  };
  const sheen = (path, y0, y1, a) => {
    g.save();
    g.clip(path);
    const sg = g.createLinearGradient(0, y0, 0, y1);
    sg.addColorStop(0, `rgba(205,180,150,${a})`);
    sg.addColorStop(1, 'rgba(205,180,150,0)');
    g.fillStyle = sg;
    g.fillRect(0, 0, c.width, c.height);
    g.restore();
  };
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.beginPath();
  g.ellipse(cx - S * 0.05, cy + S * 0.27, S * 0.58, S * 0.08, 0, 0, TAU);
  g.fill();
  // the body, his haunch at the back, his deep soft chest at the front
  const body = new Path2D();
  body.ellipse(cx, cy + S * 0.02, S * 0.46, S * 0.27, 0, 0, TAU);
  body.moveTo(cx + S * 0.2 + S * 0.26, cy - S * 0.02);
  body.ellipse(cx + S * 0.2, cy - S * 0.02, S * 0.26, S * 0.26, 0, 0, TAU);
  body.moveTo(cx - S * 0.3 + S * 0.19, cy - S * 0.1);
  body.ellipse(cx - S * 0.3, cy - S * 0.1, S * 0.19, S * 0.24, 0.15, 0, TAU);
  lit(body, BLACK, 0.5);
  sheen(body, cy - S * 0.32, cy + S * 0.02, 0.22);
  // the long fur of his chest, a little lighter, and his black paws tucked in front
  g.fillStyle = 'rgba(70,64,62,0.45)';
  g.beginPath();
  g.moveTo(cx - S * 0.44, cy - S * 0.16);
  g.quadraticCurveTo(cx - S * 0.52, cy + S * 0.04, cx - S * 0.4, cy + S * 0.18);
  g.quadraticCurveTo(cx - S * 0.3, cy + S * 0.08, cx - S * 0.3, cy - S * 0.12);
  g.closePath();
  g.fill();
  for (const dx of [-0.42, -0.28]) {
    const paw = new Path2D();
    paw.ellipse(cx + S * dx, cy + S * 0.25, S * 0.062, S * 0.034, 0, 0, TAU);
    lit(paw, '#1c1c22', 0.4);
  }
  // his tail, round the front from the back
  const tp = (u) => {
    const a = [cx + S * 0.3, cy + S * 0.17];
    const b = [cx + S * 0.05, cy + S * 0.37];
    const e = [cx - S * 0.2, cy + S * 0.27];
    return [(1 - u) ** 2 * a[0] + 2 * (1 - u) * u * b[0] + u * u * e[0], (1 - u) ** 2 * a[1] + 2 * (1 - u) * u * b[1] + u * u * e[1]];
  };
  const one = [];
  const two = [];
  for (let i = 0; i <= 30; i++) {
    const u = i / 30;
    const [x, y] = tp(u);
    const [x2, y2] = tp(Math.min(1, u + 0.01));
    const [x1, y1] = tp(Math.max(0, u - 0.01));
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const wd = S * (0.075 - 0.03 * u);
    one.push([x - ((y2 - y1) / len) * wd, y + ((x2 - x1) / len) * wd]);
    two.push([x + ((y2 - y1) / len) * wd, y - ((x2 - x1) / len) * wd]);
  }
  const tail = new Path2D();
  tail.moveTo(...one[0]);
  for (const p of one.slice(1)) tail.lineTo(...p);
  const [ex, ey] = tp(1);
  tail.arc(ex, ey, S * 0.045, Math.atan2(one[30][1] - ey, one[30][0] - ex), Math.atan2(two[30][1] - ey, two[30][0] - ex), true);
  for (const p of two.reverse()) tail.lineTo(...p);
  tail.closePath();
  lit(tail, '#1a1a20', 0.35);
  // his head, up and turned a little toward us, with full cheeks
  const hx = cx - S * 0.36;
  const hy = cy - S * 0.36;
  for (const [b0, tip, b1] of [
    [
      [-0.16, -0.04],
      [-0.17, -0.26],
      [-0.04, -0.13],
    ],
    [
      [0.03, -0.14],
      [0.13, -0.27],
      [0.16, -0.05],
    ],
  ]) {
    const ear = new Path2D();
    ear.moveTo(hx + b0[0] * S, hy + b0[1] * S);
    ear.quadraticCurveTo(hx + (tip[0] + 0.01) * S, hy + (tip[1] + 0.04) * S, hx + tip[0] * S, hy + tip[1] * S);
    ear.quadraticCurveTo(hx + (tip[0] + 0.03) * S, hy + (tip[1] + 0.07) * S, hx + b1[0] * S, hy + b1[1] * S);
    ear.closePath();
    lit(ear, BLACK, 0.5);
    const m = [(b0[0] + b1[0]) / 2, (b0[1] + b1[1]) / 2];
    g.fillStyle = 'rgba(105,72,80,0.55)';
    g.beginPath();
    g.moveTo(hx + (m[0] * 0.55 + b0[0] * 0.45) * S, hy + (m[1] * 0.55 + b0[1] * 0.45) * S);
    g.lineTo(hx + (tip[0] * 0.75 + m[0] * 0.25) * S, hy + (tip[1] * 0.75 + m[1] * 0.25) * S);
    g.lineTo(hx + (m[0] * 0.55 + b1[0] * 0.45) * S, hy + (m[1] * 0.55 + b1[1] * 0.45) * S);
    g.fill();
  }
  const head = new Path2D();
  head.ellipse(hx, hy, S * 0.17, S * 0.145, -0.05, 0, TAU);
  head.moveTo(hx - S * 0.06 + S * 0.12, hy + S * 0.06);
  head.ellipse(hx - S * 0.06, hy + S * 0.06, S * 0.12, S * 0.085, 0, 0, TAU);
  head.moveTo(hx + S * 0.07 + S * 0.11, hy + S * 0.055);
  head.ellipse(hx + S * 0.07, hy + S * 0.055, S * 0.11, S * 0.08, 0, 0, TAU);
  lit(head, BLACK, 0.5);
  sheen(head, hy - S * 0.15, hy + S * 0.02, 0.2);
  // eyes: yellow, a little green round the pupil, or shut in a slow blink
  for (const [ex2, ey2, sc] of [
    [-0.075, -0.005, 0.92],
    [0.055, -0.012, 1],
  ]) {
    const x = hx + ex2 * S;
    const y = hy + ey2 * S;
    if (open) {
      const eg = g.createRadialGradient(x, y, 0, x, y, S * 0.036 * sc);
      eg.addColorStop(0, '#c8d860');
      eg.addColorStop(0.6, '#e2dc6a');
      eg.addColorStop(1, '#a89a3a');
      g.fillStyle = eg;
      g.beginPath();
      g.ellipse(x, y, S * 0.036 * sc, S * 0.027 * sc, 0, 0, TAU);
      g.fill();
      g.fillStyle = '#08080a';
      g.beginPath();
      g.ellipse(x, y, S * 0.011 * sc, S * 0.022 * sc, 0, 0, TAU);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.beginPath();
      g.arc(x + S * 0.008, y - S * 0.009, S * 0.0055, 0, TAU);
      g.fill();
    } else {
      g.strokeStyle = '#5c5a64';
      g.lineWidth = Math.max(1, S * 0.01);
      g.lineCap = 'round';
      g.beginPath();
      g.arc(x, y - S * 0.012, S * 0.03 * sc, 0.35, Math.PI - 0.35);
      g.stroke();
    }
  }
  // nose and mouth, and his whiskers, pale, both sides
  g.fillStyle = '#2c2428';
  g.beginPath();
  g.moveTo(hx - S * 0.03, hy + S * 0.045);
  g.lineTo(hx + S * 0.0, hy + S * 0.045);
  g.lineTo(hx - S * 0.015, hy + S * 0.065);
  g.fill();
  g.strokeStyle = 'rgba(60,52,56,0.9)';
  g.lineWidth = Math.max(1, S * 0.006);
  g.beginPath();
  g.moveTo(hx - S * 0.015, hy + S * 0.065);
  g.quadraticCurveTo(hx - S * 0.025, hy + S * 0.085, hx - S * 0.045, hy + S * 0.083);
  g.moveTo(hx - S * 0.015, hy + S * 0.065);
  g.quadraticCurveTo(hx - S * 0.005, hy + S * 0.085, hx + S * 0.015, hy + S * 0.083);
  g.stroke();
  g.strokeStyle = 'rgba(235,230,225,0.55)';
  g.lineWidth = Math.max(1, S * 0.004);
  for (const [x0, y0, x1, y1, bx, by] of [
    [-0.06, 0.06, -0.3, 0.02, -0.18, 0.03],
    [-0.06, 0.072, -0.29, 0.09, -0.18, 0.07],
    [-0.055, 0.082, -0.26, 0.14, -0.16, 0.1],
    [0.03, 0.06, 0.24, 0.03, 0.14, 0.035],
    [0.03, 0.072, 0.23, 0.1, 0.14, 0.075],
  ]) {
    g.beginPath();
    g.moveTo(hx + S * x0, hy + S * y0);
    g.quadraticCurveTo(hx + S * bx, hy + S * by, hx + S * x1, hy + S * y1);
    g.stroke();
  }
  return c;
}

// a cow cat, mostly white with black patches, curled up asleep facing right with his white front legs
// stretched out: black over his rear and in a patch on his back, a black tail, a black cap over his
// ears and round his eyes with a wide white blaze down the middle, a pink nose. The fire is on his left.
function bicolourCatSprite(S) {
  const c = layer(Math.ceil(S * 1.4), Math.ceil(S * 1.0));
  const g = c.getContext('2d');
  const cx = S * 0.62;
  const cy = S * 0.6;
  const BLACK = '#18181e';
  const WHITE = '#f2efe8';
  const lit = (path, col, a) => {
    const rg = g.createLinearGradient(cx + S * 0.2, 0, cx - S * 0.5, 0);
    rg.addColorStop(0, 'rgba(255,165,85,0)');
    rg.addColorStop(1, `rgba(255,165,85,${a})`);
    g.strokeStyle = rg;
    g.lineWidth = S * 0.026;
    g.stroke(path);
    g.fillStyle = col;
    g.fill(path);
  };
  g.fillStyle = 'rgba(0,0,0,0.33)';
  g.beginPath();
  g.ellipse(cx, cy + S * 0.25, S * 0.5, S * 0.07, 0, 0, TAU);
  g.fill();
  // the body, a round curl: white underneath, a black saddle over his back with a white spot in it
  const body = new Path2D();
  body.ellipse(cx, cy + S * 0.02, S * 0.42, S * 0.26, 0, 0, TAU);
  body.moveTo(cx - S * 0.12 + S * 0.24, cy - S * 0.03);
  body.ellipse(cx - S * 0.12, cy - S * 0.03, S * 0.24, S * 0.24, 0, 0, TAU);
  lit(body, WHITE, 0.45);
  g.save();
  g.clip(body);
  g.fillStyle = BLACK;
  g.beginPath();
  g.ellipse(cx - S * 0.34, cy - S * 0.02, S * 0.2, S * 0.3, 0.1, 0, TAU);
  g.ellipse(cx - S * 0.2, cy - S * 0.2, S * 0.14, S * 0.1, -0.3, 0, TAU);
  g.fill();
  g.beginPath();
  g.ellipse(cx + S * 0.06, cy - S * 0.23, S * 0.15, S * 0.075, 0.1, 0, TAU);
  g.fill();
  const sheen = g.createLinearGradient(0, cy - S * 0.28, 0, cy + S * 0.02);
  sheen.addColorStop(0, 'rgba(205,180,150,0.2)');
  sheen.addColorStop(1, 'rgba(205,180,150,0)');
  g.fillStyle = sheen;
  g.fillRect(0, 0, c.width, c.height);
  const under = g.createLinearGradient(0, cy, 0, cy + S * 0.28);
  under.addColorStop(0, 'rgba(60,40,20,0)');
  under.addColorStop(1, 'rgba(60,40,20,0.28)');
  g.fillStyle = under;
  g.fillRect(0, 0, c.width, c.height);
  g.restore();
  // his black tail round the front
  g.strokeStyle = BLACK;
  g.lineCap = 'round';
  g.lineWidth = S * 0.09;
  g.beginPath();
  g.moveTo(cx - S * 0.36, cy + S * 0.12);
  g.quadraticCurveTo(cx - S * 0.1, cy + S * 0.33, cx + S * 0.18, cy + S * 0.22);
  g.stroke();
  g.lineWidth = S * 0.06;
  g.beginPath();
  g.moveTo(cx + S * 0.15, cy + S * 0.23);
  g.lineTo(cx + S * 0.22, cy + S * 0.2);
  g.stroke();
  // his white front legs stretched out in front of him, one a little ahead of the other
  for (const [y0, x1, dip] of [
    [0.15, 0.56, 0.01],
    [0.2, 0.5, 0.0],
  ]) {
    const leg = new Path2D();
    leg.moveTo(cx + S * 0.18, cy + S * (y0 - 0.035));
    leg.quadraticCurveTo(cx + S * (x1 * 0.6 + 0.08), cy + S * (y0 - 0.03 + dip), cx + S * x1, cy + S * (y0 - 0.022));
    leg.lineTo(cx + S * x1, cy + S * (y0 + 0.022));
    leg.quadraticCurveTo(cx + S * (x1 * 0.6 + 0.08), cy + S * (y0 + 0.035 + dip), cx + S * 0.18, cy + S * (y0 + 0.04));
    leg.closePath();
    lit(leg, WHITE, 0.3);
    const paw = new Path2D();
    paw.ellipse(cx + S * (x1 + 0.015), cy + S * y0, S * 0.042, S * 0.03, 0, 0, TAU);
    lit(paw, WHITE, 0.3);
    g.strokeStyle = 'rgba(150,140,135,0.55)';
    g.lineWidth = Math.max(1, S * 0.005);
    g.lineCap = 'round';
    g.beginPath();
    for (const dy of [-0.011, 0.011]) {
      g.moveTo(cx + S * (x1 + 0.03), cy + S * (y0 + dy));
      g.lineTo(cx + S * (x1 + 0.05), cy + S * (y0 + dy));
    }
    g.stroke();
  }
  // his head, tucked low at the front, face white under a black cap
  const hx = cx + S * 0.28;
  const hy = cy + S * 0.02;
  for (const [b0, tip, b1] of [
    [
      [-0.12, -0.06],
      [-0.08, -0.24],
      [0.0, -0.12],
    ],
    [
      [0.05, -0.12],
      [0.15, -0.22],
      [0.16, -0.03],
    ],
  ]) {
    const ear = new Path2D();
    ear.moveTo(hx + b0[0] * S, hy + b0[1] * S);
    ear.quadraticCurveTo(hx + (tip[0] - 0.01) * S, hy + (tip[1] + 0.04) * S, hx + tip[0] * S, hy + tip[1] * S);
    ear.quadraticCurveTo(hx + (tip[0] + 0.03) * S, hy + (tip[1] + 0.06) * S, hx + b1[0] * S, hy + b1[1] * S);
    ear.closePath();
    lit(ear, BLACK, 0.4);
    const m = [(b0[0] + b1[0]) / 2, (b0[1] + b1[1]) / 2];
    g.fillStyle = 'rgba(190,130,135,0.6)';
    g.beginPath();
    g.moveTo(hx + (m[0] * 0.55 + b0[0] * 0.45) * S, hy + (m[1] * 0.55 + b0[1] * 0.45) * S);
    g.lineTo(hx + (tip[0] * 0.75 + m[0] * 0.25) * S, hy + (tip[1] * 0.75 + m[1] * 0.25) * S);
    g.lineTo(hx + (m[0] * 0.55 + b1[0] * 0.45) * S, hy + (m[1] * 0.55 + b1[1] * 0.45) * S);
    g.fill();
  }
  const head = new Path2D();
  head.ellipse(hx, hy, S * 0.16, S * 0.13, 0.15, 0, TAU);
  lit(head, WHITE, 0.4);
  g.save();
  g.clip(head);
  // the black cap: over the top of his head and round his eyes, more on the far side, with a wide
  // white blaze coming down the middle to his white muzzle
  g.fillStyle = BLACK;
  g.beginPath();
  g.moveTo(hx - S * 0.2, hy - S * 0.2);
  g.lineTo(hx + S * 0.22, hy - S * 0.2);
  g.lineTo(hx + S * 0.22, hy + S * 0.05);
  g.quadraticCurveTo(hx + S * 0.14, hy + S * 0.04, hx + S * 0.08, hy + S * 0.01);
  g.quadraticCurveTo(hx + S * 0.05, hy - S * 0.08, hx + S * 0.03, hy - S * 0.15);
  g.lineTo(hx + S * 0.0, hy - S * 0.15);
  g.quadraticCurveTo(hx - S * 0.03, hy - S * 0.07, hx - S * 0.06, hy - S * 0.02);
  g.quadraticCurveTo(hx - S * 0.12, hy + S * 0.0, hx - S * 0.2, hy - S * 0.01);
  g.closePath();
  g.fill();
  const hs = g.createLinearGradient(0, hy - S * 0.13, 0, hy + S * 0.13);
  hs.addColorStop(0, 'rgba(205,180,150,0.15)');
  hs.addColorStop(1, 'rgba(60,40,20,0.15)');
  g.fillStyle = hs;
  g.fillRect(0, 0, c.width, c.height);
  g.restore();
  // eyes shut, a pink nose, pale whiskers
  g.strokeStyle = '#6a6a74';
  g.lineWidth = Math.max(1, S * 0.01);
  for (const [ex, ey] of [
    [-0.07, -0.005],
    [0.105, 0.0],
  ]) {
    g.beginPath();
    g.arc(hx + ex * S, hy + ey * S, S * 0.026, 0.3, Math.PI - 0.3);
    g.stroke();
  }
  g.fillStyle = '#e8a0a4';
  g.beginPath();
  g.moveTo(hx + S * 0.01, hy + S * 0.05);
  g.lineTo(hx + S * 0.045, hy + S * 0.05);
  g.lineTo(hx + S * 0.028, hy + S * 0.07);
  g.fill();
  g.strokeStyle = 'rgba(150,140,135,0.6)';
  g.lineWidth = Math.max(1, S * 0.004);
  for (const [x0, y0, x1, y1] of [
    [0.06, 0.07, 0.24, 0.05],
    [0.06, 0.08, 0.23, 0.11],
    [-0.01, 0.07, -0.17, 0.05],
    [-0.01, 0.08, -0.16, 0.11],
  ]) {
    g.beginPath();
    g.moveTo(hx + S * x0, hy + S * y0);
    g.lineTo(hx + S * x1, hy + S * y1);
    g.stroke();
  }
  return c;
}

class Sett extends Painting {
  build() {
    const { w, h, u } = this;
    const k = Math.min(w * 2, h);
    let seed = 11;
    const r = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    const R = (a, b) => a + r() * (b - a);
    this.grain = grainLayer(w, h);
    this.room = layer(w, h);
    this.front = layer(w, h); // the table near us, drawn over the cats on the rug
    let g = this.room.getContext('2d');

    // the room is round: its far wall curves away, so the ceiling line dips to the middle and the
    // floor line rises to it. Things on the wall are placed by their angle round it.
    const vx = w * 0.5;
    const d = (x) => (x - vx) / (w * 0.5);
    const ceilY = (x) => h * (0.12 - 0.07 * d(x) ** 2);
    const floorY = (x) => h * (0.6 + 0.08 * d(x) ** 2);
    const Rw = w * 0.55;
    const X = (th) => vx + Rw * Math.sin(th);
    const curve = (fn, x0, x1) => {
      for (let x = x0; x <= x1; x += 4) g.lineTo(x, fn(x));
      g.lineTo(x1, fn(x1));
    };

    // the ceiling: dark boards, beams running out from over the middle of the room
    g.fillStyle = vgrad(g, 0, h * 0.14, [
      [0, '#24160b'],
      [1, '#4a3018'],
    ]);
    g.fillRect(0, 0, w, h * 0.16);
    g.lineCap = 'butt';
    for (let th = -1.4; th <= 1.41; th += 0.28) {
      const x = X(th);
      g.strokeStyle = '#2e1c0c';
      g.lineWidth = 0.022 * k * Math.cos(th);
      g.beginPath();
      g.moveTo(vx + (x - vx) * 2.6, -2);
      g.lineTo(x, ceilY(x));
      g.stroke();
      g.strokeStyle = 'rgba(232,170,100,0.12)';
      g.lineWidth = Math.max(1, 0.004 * k);
      g.beginPath();
      g.moveTo(vx + (x - vx) * 2.6 - 0.008 * k, -2);
      g.lineTo(x - 0.008 * k * Math.cos(th), ceilY(x));
      g.stroke();
    }
    // the wall: warm plaster between the ceiling and the floor
    const wall = new Path2D();
    wall.moveTo(0, ceilY(0));
    for (let x = 0; x <= w; x += 4) wall.lineTo(x, ceilY(x));
    for (let x = w; x >= 0; x -= 4) wall.lineTo(x, floorY(x));
    wall.closePath();
    const wg = g.createLinearGradient(0, 0, w, 0);
    wg.addColorStop(0, '#6a4420');
    wg.addColorStop(0.5, '#c4924e');
    wg.addColorStop(1, '#6a4420');
    g.fillStyle = wg;
    g.fill(wall);
    g.save();
    g.clip(wall);
    for (let i = 0; i < 40; i++) {
      const v = R(-1, 1);
      g.fillStyle = v > 0 ? `rgba(255,230,180,${v * 0.06})` : `rgba(60,30,10,${-v * 0.08})`;
      g.beginPath();
      g.ellipse(R(0, w), R(h * 0.05, h * 0.65), R(0.02, 0.05) * k, R(0.015, 0.03) * k, R(0, 3), 0, TAU);
      g.fill();
    }
    g.fillStyle = vgrad(g, h * 0.03, h * 0.3, [
      [0, 'rgba(30,15,5,0.55)'],
      [1, 'rgba(30,15,5,0)'],
    ]);
    g.fillRect(0, 0, w, h * 0.3);
    // a band of honey-coloured panelling round the bottom of the wall
    const wains = 0.07 * k;
    g.beginPath();
    g.moveTo(0, floorY(0) - wains);
    curve((x) => floorY(x) - wains, 0, w);
    g.lineTo(w, h);
    g.lineTo(0, h);
    g.closePath();
    g.fillStyle = '#8a5a28';
    g.fill();
    g.strokeStyle = 'rgba(40,20,5,0.4)';
    g.lineWidth = Math.max(1, 0.003 * k);
    for (let th = -1.5; th <= 1.5; th += 0.09) {
      const x = X(th);
      g.beginPath();
      g.moveTo(x, floorY(x) - wains);
      g.lineTo(x, floorY(x));
      g.stroke();
    }
    g.strokeStyle = '#c8904a';
    g.lineWidth = Math.max(1.5, 0.006 * k);
    g.beginPath();
    g.moveTo(0, floorY(0) - wains);
    curve((x) => floorY(x) - wains, 0, w);
    g.stroke();
    g.restore();

    // round windows high in the wall, at the level of the grass outside
    const wr = Math.min(0.14 * k, (floorY(vx) - ceilY(vx)) * 0.3);
    const N = Math.min(3, Math.max(1, Math.round((w * 0.9) / (wr * 2.8))));
    const ths = N === 1 ? [0] : N === 2 ? [-0.36, 0.36] : [-0.62, 0, 0.62];
    this.wins = ths.map((th) => {
      const x = X(th);
      return { x, y: ceilY(x) + wr * 1.2, rx: wr * Math.cos(th), ry: wr, th };
    });
    // timber posts between them
    const posts = N === 1 ? [-0.75, 0.75] : N === 2 ? [-0.9, 0, 0.9] : [-0.93, -0.31, 0.31, 0.93];
    for (const th of posts) {
      const x = X(th);
      const pw = 0.016 * k * Math.cos(th);
      const pg = g.createLinearGradient(x - pw, 0, x + pw, 0);
      pg.addColorStop(0, '#3e2610');
      pg.addColorStop(0.4, '#7a4e24');
      pg.addColorStop(1, '#4a2e14');
      g.fillStyle = pg;
      g.fillRect(x - pw, ceilY(x) - 2, pw * 2, floorY(x) - ceilY(x) - wains + 2);
    }
    this.glass = new Path2D();
    for (const W of this.wins) {
      g.fillStyle = '#4a2e14';
      g.beginPath();
      g.ellipse(W.x, W.y, W.rx * 1.2, W.ry * 1.2, 0, 0, TAU);
      g.fill();
      const fg = g.createLinearGradient(0, W.y - W.ry * 1.12, 0, W.y + W.ry * 1.12);
      fg.addColorStop(0, '#c88a44');
      fg.addColorStop(1, '#8a5626');
      g.fillStyle = fg;
      g.beginPath();
      g.ellipse(W.x, W.y, W.rx * 1.12, W.ry * 1.12, 0, 0, TAU);
      g.fill();
      this.glass.moveTo(W.x + W.rx, W.y);
      this.glass.ellipse(W.x, W.y, W.rx, W.ry, 0, 0, TAU);
    }
    g.save();
    g.globalCompositeOperation = 'destination-out';
    g.fill(this.glass);
    g.restore();
    for (const W of this.wins) {
      // glazing bars: a cross and a ring
      g.strokeStyle = '#9a6430';
      g.lineWidth = W.ry * 0.05;
      g.beginPath();
      g.moveTo(W.x, W.y - W.ry);
      g.lineTo(W.x, W.y + W.ry);
      g.moveTo(W.x - W.rx, W.y);
      g.lineTo(W.x + W.rx, W.y);
      g.moveTo(W.x + W.rx * 0.42, W.y);
      g.ellipse(W.x, W.y, W.rx * 0.42, W.ry * 0.42, 0, 0, TAU);
      g.stroke();
      // the sill, and pots on it
      const sy = W.y + W.ry * 1.16;
      g.fillStyle = '#b07838';
      g.fillRect(W.x - W.rx * 1.15, sy - 0.006 * k, W.rx * 2.3, 0.012 * k);
      g.fillStyle = '#6a4018';
      g.fillRect(W.x - W.rx * 1.15, sy + 0.006 * k, W.rx * 2.3, 0.006 * k);
      const sc = Math.cos(W.th);
      for (const [dx, kind] of [
        [-0.62, 'fern'],
        [0.12, 'flower'],
        [0.66, 'trail'],
      ]) {
        const px = W.x + dx * W.rx;
        const pw = 0.022 * k * sc;
        const ph = 0.03 * k;
        g.fillStyle = kind === 'flower' ? '#c8783e' : '#b5603a';
        g.beginPath();
        g.moveTo(px - pw, sy - ph);
        g.lineTo(px + pw, sy - ph);
        g.lineTo(px + pw * 0.75, sy - 0.006 * k);
        g.lineTo(px - pw * 0.75, sy - 0.006 * k);
        g.fill();
        g.fillStyle = 'rgba(0,0,0,0.18)';
        g.fillRect(px - pw, sy - ph, pw * 2, ph * 0.18);
        const greens = ['#4f7a3a', '#6f9a48', '#3e6a30', '#86ac56'];
        if (kind === 'fern') {
          for (let i = 0; i < 9; i++) {
            const a = -Math.PI / 2 + (i - 4) * 0.28;
            const len = 0.05 * k * (1 - Math.abs(i - 4) * 0.08);
            g.strokeStyle = greens[i % 4];
            g.lineWidth = Math.max(1.5, 0.008 * k);
            g.beginPath();
            g.moveTo(px, sy - ph);
            g.quadraticCurveTo(px + Math.cos(a) * len * 0.6, sy - ph + Math.sin(a) * len * 0.8, px + Math.cos(a) * len, sy - ph + Math.sin(a) * len * 0.7 + len * 0.25);
            g.stroke();
          }
        } else if (kind === 'flower') {
          for (let i = 0; i < 7; i++) {
            g.fillStyle = greens[i % 4];
            g.beginPath();
            g.ellipse(px + (i - 3) * pw * 0.3, sy - ph - 0.012 * k, 0.012 * k, 0.006 * k, (i - 3) * 0.4, 0, TAU);
            g.fill();
          }
          for (let i = 0; i < 4; i++) {
            const fx = px + (i - 1.5) * pw * 0.5;
            const fy = sy - ph - 0.03 * k - (i % 2) * 0.008 * k;
            g.strokeStyle = '#4f7a3a';
            g.lineWidth = Math.max(1, 0.003 * k);
            g.beginPath();
            g.moveTo(px, sy - ph);
            g.lineTo(fx, fy);
            g.stroke();
            g.fillStyle = '#f2c21a';
            g.beginPath();
            g.arc(fx, fy, 0.007 * k, 0, TAU);
            g.fill();
          }
        } else {
          for (let i = 0; i < 4; i++) {
            let x = px + (i - 1.5) * pw * 0.6;
            let y = sy - ph;
            const len = 0.03 * k + i * 0.012 * k;
            for (let j = 0; j < 7; j++) {
              g.fillStyle = greens[(i + j) % 4];
              g.beginPath();
              g.ellipse(x, y, 0.009 * k, 0.005 * k, j % 2 ? 0.6 : -0.6, 0, TAU);
              g.fill();
              x += (i - 1.5) * 0.002 * k + 0.002 * k;
              y += len / 6 + (j < 2 ? 0 : 0.002 * k);
            }
          }
        }
      }
    }

    // a round door at the side, to the dormitories
    {
      const th = 1.0;
      const x = X(th);
      const rd = 0.11 * k;
      const rx = rd * Math.cos(th);
      const bot = floorY(x) - wains * 0.1;
      const cy = bot - rd * 0.95;
      g.fillStyle = '#3e2610';
      g.beginPath();
      g.ellipse(x, cy, rx * 1.15, rd * 1.12, 0, 0, TAU);
      g.fill();
      g.save();
      g.beginPath();
      g.ellipse(x, cy, rx, rd, 0, 0, TAU);
      g.clip();
      g.fillStyle = '#b07432';
      g.fillRect(x - rx, cy - rd, rx * 2, rd * 2);
      g.strokeStyle = 'rgba(60,30,8,0.45)';
      g.lineWidth = Math.max(1, 0.003 * k);
      for (let i = -3; i <= 3; i++) {
        g.beginPath();
        g.moveTo(x + (i * rx) / 3.5, cy - rd);
        g.lineTo(x + (i * rx) / 3.5, cy + rd);
        g.stroke();
      }
      g.restore();
      g.fillStyle = '#d8a848';
      g.beginPath();
      g.arc(x, cy, 0.012 * k, 0, TAU);
      g.fill();
    }

    // the floor: wide boards running out from the wall
    g.beginPath();
    g.moveTo(0, floorY(0));
    curve(floorY, 0, w);
    g.lineTo(w, h);
    g.lineTo(0, h);
    g.closePath();
    g.fillStyle = vgrad(g, h * 0.6, h, [
      [0, '#5e3a18'],
      [1, '#94602e'],
    ]);
    g.fill();
    g.strokeStyle = 'rgba(40,20,5,0.35)';
    g.lineWidth = Math.max(1, 0.003 * k);
    for (let i = -14; i <= 14; i++) {
      const bx = vx + i * w * 0.045;
      const by = floorY(bx);
      g.beginPath();
      g.moveTo(bx, by);
      g.lineTo(vx + (bx - vx) * 3.2, h);
      g.stroke();
    }

    // the fireplace, near on the left: brick, a honey-wood mantel beam, a copper hood whose pipe
    // elbows away into the wall
    const hb = h * 0.8; // the controls cover the bottom of the screen
    const F = { x0: -0.03 * k, x1: 0.3 * k, mantel: hb - 0.25 * k };
    const mo = { x0: 0.05 * k, x1: 0.23 * k, y0: hb - 0.18 * k, y1: hb };
    const pc = (F.x0 + F.x1) / 2;
    const beam = { y0: F.mantel - 0.035 * k, y1: F.mantel };
    const copper = (x0, x1) => {
      const cg = g.createLinearGradient(x0, 0, x1, 0);
      cg.addColorStop(0, '#5a2a10');
      cg.addColorStop(0.3, '#c0703a');
      cg.addColorStop(0.42, '#f4b47e');
      cg.addColorStop(0.7, '#a85a2a');
      cg.addColorStop(1, '#5a2a10');
      return cg;
    };
    // hood and pipe
    const neck = beam.y0 - 0.12 * k;
    const pr = 0.019 * k;
    const elbow = neck - 0.05 * k;
    g.fillStyle = copper(pc - pr, pc + pr);
    g.fillRect(pc - pr, elbow, pr * 2, neck - elbow + 2);
    {
      const dx = -1;
      const dy = -0.9;
      const len = Math.hypot(dx, dy);
      const ux = dx / len;
      const uy = dy / len;
      const far = (pc + 0.05 * k) / -ux;
      const ex = pc + ux * far;
      const ey = elbow + uy * far;
      const nx = -uy * pr;
      const ny = ux * pr;
      const cg = g.createLinearGradient(pc + nx, elbow + ny, pc - nx, elbow - ny);
      cg.addColorStop(0, '#5a2a10');
      cg.addColorStop(0.3, '#c0703a');
      cg.addColorStop(0.42, '#f4b47e');
      cg.addColorStop(0.7, '#a85a2a');
      cg.addColorStop(1, '#5a2a10');
      g.fillStyle = cg;
      g.beginPath();
      g.moveTo(pc + nx, elbow + ny);
      g.lineTo(ex + nx, ey + ny);
      g.lineTo(ex - nx, ey - ny);
      g.lineTo(pc - nx, elbow - ny);
      g.fill();
      g.fillStyle = copper(pc - pr * 1.1, pc + pr * 1.1);
      g.beginPath();
      g.ellipse(pc, elbow, pr * 1.1, pr * 0.9, 0, 0, TAU);
      g.fill();
    }
    g.fillStyle = copper(F.x0, F.x1);
    g.beginPath();
    g.moveTo(F.x0 + 0.02 * k, beam.y0);
    g.quadraticCurveTo(pc - pr * 1.5, beam.y0 - 0.03 * k, pc - pr, neck);
    g.lineTo(pc + pr, neck);
    g.quadraticCurveTo(pc + pr * 1.5, beam.y0 - 0.03 * k, F.x1 - 0.02 * k, beam.y0);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(60,25,8,0.7)';
    for (let i = 0; i < 10; i++) {
      g.beginPath();
      g.arc(lerp(F.x0 + 0.07 * k, F.x1 - 0.07 * k, i / 9), beam.y0 - 0.014 * k, Math.max(1, 0.003 * k), 0, TAU);
      g.fill();
    }
    // brick surround
    g.save();
    g.beginPath();
    g.rect(F.x0, F.mantel, F.x1 - F.x0, hb - F.mantel);
    g.clip();
    g.fillStyle = '#5a2e1e';
    g.fillRect(F.x0, F.mantel, F.x1 - F.x0, hb - F.mantel);
    const bh = 0.02 * k;
    for (let y = F.mantel, row = 0; y < hb; y += bh, row++) {
      for (let x = F.x0 - (row % 2) * 0.03 * k; x < F.x1; x += 0.06 * k) {
        g.fillStyle = ['#8a4632', '#7a3c2a', '#94503a', '#83432e'][Math.floor(r() * 4)];
        g.fillRect(x + 0.002 * k, y + 0.002 * k, 0.056 * k, bh - 0.004 * k);
      }
    }
    g.restore();
    // the opening
    this.mouth = mo;
    this.mouthPath = new Path2D();
    this.mouthPath.moveTo(mo.x0, mo.y1);
    this.mouthPath.lineTo(mo.x0, mo.y0 + 0.03 * k);
    this.mouthPath.quadraticCurveTo((mo.x0 + mo.x1) / 2, mo.y0 - 0.025 * k, mo.x1, mo.y0 + 0.03 * k);
    this.mouthPath.lineTo(mo.x1, mo.y1);
    this.mouthPath.closePath();
    const mg = g.createLinearGradient(0, mo.y0, 0, mo.y1);
    mg.addColorStop(0, '#0a0503');
    mg.addColorStop(1, '#2a1208');
    g.fillStyle = mg;
    g.fill(this.mouthPath);
    // the mantel beam, and what's on it
    g.fillStyle = '#b07838';
    g.fillRect(F.x0 - 0.01 * k, beam.y0, F.x1 - F.x0 + 0.03 * k, beam.y1 - beam.y0);
    g.fillStyle = '#e0a860';
    g.fillRect(F.x0 - 0.01 * k, beam.y0, F.x1 - F.x0 + 0.03 * k, 0.004 * k);
    g.fillStyle = 'rgba(50,25,5,0.5)';
    g.fillRect(F.x0 - 0.01 * k, beam.y1 - 0.006 * k, F.x1 - F.x0 + 0.03 * k, 0.006 * k);
    g.strokeStyle = 'rgba(70,35,10,0.5)';
    g.lineWidth = Math.max(1, 0.002 * k);
    for (let x = F.x0 + 0.01 * k; x < F.x1; x += 0.014 * k) {
      g.beginPath();
      g.moveTo(x, beam.y0 + 0.012 * k);
      g.lineTo(x + 0.006 * k, beam.y1 - 0.012 * k);
      g.stroke();
    }
    // a little jar of dandelions, a copper jug, two candles
    const top = beam.y0;
    g.fillStyle = 'rgba(200,230,220,0.35)';
    g.beginPath();
    g.roundRect(F.x0 + 0.06 * k, top - 0.03 * k, 0.022 * k, 0.03 * k, 0.004 * k);
    g.fill();
    for (let i = 0; i < 5; i++) {
      const fx = F.x0 + 0.071 * k + (i - 2) * 0.007 * k;
      const fy = top - 0.045 * k - (i % 2) * 0.008 * k;
      g.strokeStyle = '#4f7a3a';
      g.lineWidth = Math.max(1, 0.002 * k);
      g.beginPath();
      g.moveTo(F.x0 + 0.071 * k, top - 0.02 * k);
      g.lineTo(fx, fy);
      g.stroke();
      g.fillStyle = '#f2c21a';
      g.beginPath();
      g.arc(fx, fy, 0.006 * k, 0, TAU);
      g.fill();
    }
    g.fillStyle = copper(F.x1 - 0.07 * k, F.x1 - 0.03 * k);
    g.beginPath();
    g.moveTo(F.x1 - 0.068 * k, top);
    g.quadraticCurveTo(F.x1 - 0.075 * k, top - 0.03 * k, F.x1 - 0.06 * k, top - 0.042 * k);
    g.lineTo(F.x1 - 0.04 * k, top - 0.042 * k);
    g.quadraticCurveTo(F.x1 - 0.025 * k, top - 0.03 * k, F.x1 - 0.032 * k, top);
    g.fill();
    for (const [x, ch] of [
      [F.x0 + 0.13 * k, 0.045],
      [F.x0 + 0.155 * k, 0.03],
    ]) {
      g.fillStyle = '#efe4c8';
      g.fillRect(x, top - ch * k, 0.011 * k, ch * k);
    }
    this.candles = [
      [F.x0 + 0.1355 * k, top - 0.045 * k],
      [F.x0 + 0.1605 * k, top - 0.03 * k],
    ];
    // the hearthstone
    g.fillStyle = '#6a4a36';
    g.fillRect(F.x0 - 0.01 * k, hb, F.x1 - F.x0 + 0.06 * k, 0.022 * k);
    g.fillStyle = 'rgba(255,220,170,0.15)';
    g.fillRect(F.x0 - 0.01 * k, hb, F.x1 - F.x0 + 0.06 * k, 0.003 * k);
    // the kettle on the hearth
    {
      const kx = mo.x1 + 0.05 * k;
      const ky = hb + 0.004 * k;
      const kr = 0.036 * k;
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.beginPath();
      g.ellipse(kx, ky, kr * 1.1, kr * 0.2, 0, 0, TAU);
      g.fill();
      g.strokeStyle = '#3a2410';
      g.lineWidth = Math.max(1.5, kr * 0.1);
      g.beginPath();
      g.ellipse(kx, ky - kr * 1.45, kr * 0.62, kr * 0.55, 0, Math.PI, TAU);
      g.stroke();
      g.fillStyle = copper(kx + kr * 0.6, kx + kr * 1.5);
      g.beginPath();
      g.moveTo(kx + kr * 0.7, ky - kr * 0.45);
      g.quadraticCurveTo(kx + kr * 1.25, ky - kr * 0.6, kx + kr * 1.45, ky - kr * 1.2);
      g.lineTo(kx + kr * 1.58, ky - kr * 1.2);
      g.quadraticCurveTo(kx + kr * 1.4, ky - kr * 0.5, kx + kr * 0.8, ky - kr * 0.2);
      g.fill();
      const kg = g.createRadialGradient(kx - kr * 0.3, ky - kr * 0.8, kr * 0.1, kx, ky - kr * 0.5, kr * 1.2);
      kg.addColorStop(0, '#f8c08a');
      kg.addColorStop(0.4, '#c0703a');
      kg.addColorStop(1, '#5a2a10');
      g.fillStyle = kg;
      g.beginPath();
      g.ellipse(kx, ky - kr * 0.55, kr, kr * 0.62, 0, 0, TAU);
      g.fill();
      g.fillStyle = '#8a4a22';
      g.beginPath();
      g.ellipse(kx, ky - kr * 1.12, kr * 0.45, kr * 0.12, 0, 0, TAU);
      g.fill();
      g.beginPath();
      g.arc(kx, ky - kr * 1.25, kr * 0.1, 0, TAU);
      g.fill();
      this.spout = [kx + kr * 1.52, ky - kr * 1.25];
    }

    // a round braided rug
    const rug = { x: Math.min(F.x1 + 0.08 * k, w * 0.4), y: hb + 0.065 * k, rx: 0.2 * k, ry: 0.045 * k };
    this.rug = rug;
    const rings = ['#3a2a1a', '#e2b23a', '#a86a2a', '#f0e0b0', '#e2b23a', '#3a2a1a', '#c8893a'];
    rings.forEach((col, i) => {
      const f = 1 - i / rings.length;
      g.fillStyle = col;
      g.beginPath();
      g.ellipse(rug.x, rug.y, rug.rx * f, rug.ry * f, 0, 0, TAU);
      g.fill();
    });

    // the little table near us on the right: tea, a book, ink and a quill
    const tb = { x: w - 0.12 * k, y: Math.min(h - 0.07 * k, h * 0.85), rx: 0.13 * k, ry: 0.032 * k };
    // on a wide screen there's room for an overstuffed yellow armchair turned to the fire
    const free = tb.x - tb.rx - F.x1;
    if (free > 0.35 * k) {
      const cx = F.x1 + free * 0.5;
      const cw = 0.15 * k;
      const ch = 0.2 * k;
      const by = hb + 0.035 * k;
      g.fillStyle = '#2a2018';
      g.fillRect(cx - cw * 0.42, by - ch * 0.06, cw * 0.07, ch * 0.08);
      g.fillRect(cx + cw * 0.35, by - ch * 0.06, cw * 0.07, ch * 0.08);
      const back = new Path2D();
      back.moveTo(cx - cw * 0.5, by - ch * 0.05);
      back.lineTo(cx - cw * 0.54, by - ch * 0.55);
      back.quadraticCurveTo(cx - cw * 0.6, by - ch * 0.8, cx - cw * 0.4, by - ch * 0.84);
      back.quadraticCurveTo(cx - cw * 0.3, by - ch * 1.02, cx, by - ch);
      back.quadraticCurveTo(cx + cw * 0.3, by - ch * 1.02, cx + cw * 0.4, by - ch * 0.84);
      back.quadraticCurveTo(cx + cw * 0.6, by - ch * 0.8, cx + cw * 0.54, by - ch * 0.55);
      back.lineTo(cx + cw * 0.5, by - ch * 0.05);
      back.closePath();
      const ag = g.createLinearGradient(cx - cw * 0.6, 0, cx + cw * 0.6, 0);
      ag.addColorStop(0, '#f0b830');
      ag.addColorStop(0.6, '#d89e22');
      ag.addColorStop(1, '#a87214');
      g.fillStyle = ag;
      g.fill(back);
      g.strokeStyle = '#2a2018';
      g.lineWidth = Math.max(1.5, 0.004 * k);
      g.stroke(back);
      g.beginPath();
      g.moveTo(cx - cw * 0.38, by - ch * 0.82);
      g.lineTo(cx - cw * 0.36, by - ch * 0.08);
      g.moveTo(cx + cw * 0.38, by - ch * 0.82);
      g.lineTo(cx + cw * 0.36, by - ch * 0.08);
      g.stroke();
      // a striped throw over the back
      g.save();
      g.clip(back);
      g.beginPath();
      g.moveTo(cx - cw * 0.1, by - ch * 1.05);
      g.lineTo(cx + cw * 0.3, by - ch * 1.05);
      g.lineTo(cx + cw * 0.26, by - ch * 0.45);
      g.lineTo(cx - cw * 0.06, by - ch * 0.5);
      g.closePath();
      g.clip();
      for (let i = 0; i < 12; i++) {
        g.fillStyle = i % 2 ? '#2a2018' : '#f6d050';
        g.fillRect(cx - cw * 0.12, by - ch * (1.05 - i * 0.05), cw * 0.45, ch * 0.05);
      }
      g.restore();
    }
    g = this.front.getContext('2d');
    g.fillStyle = '#5a3818';
    g.fillRect(tb.x - 0.018 * k, tb.y, 0.036 * k, h - tb.y);
    g.fillStyle = '#8a5a28';
    g.beginPath();
    g.ellipse(tb.x, tb.y + 0.012 * k, tb.rx, tb.ry, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#c08440';
    g.beginPath();
    g.ellipse(tb.x, tb.y, tb.rx, tb.ry, 0, 0, TAU);
    g.fill();
    // the cup and saucer
    const cup = { x: tb.x - tb.rx * 0.5, y: tb.y - tb.ry * 0.1 };
    g.fillStyle = 'rgba(40,20,5,0.3)';
    g.beginPath();
    g.ellipse(cup.x + 0.006 * k, cup.y + 0.004 * k, 0.046 * k, 0.012 * k, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#f4ecdc';
    g.beginPath();
    g.ellipse(cup.x, cup.y, 0.045 * k, 0.012 * k, 0, 0, TAU);
    g.fill();
    const ct = cup.y - 0.04 * k;
    g.strokeStyle = '#f4ecdc';
    g.lineWidth = Math.max(1.5, 0.005 * k);
    g.beginPath();
    g.ellipse(cup.x + 0.032 * k, ct + 0.016 * k, 0.01 * k, 0.012 * k, 0, -1.6, 1.6);
    g.stroke();
    g.fillStyle = '#f4ecdc';
    g.beginPath();
    g.moveTo(cup.x - 0.03 * k, ct);
    g.quadraticCurveTo(cup.x - 0.03 * k, cup.y - 0.004 * k, cup.x, cup.y - 0.004 * k);
    g.quadraticCurveTo(cup.x + 0.03 * k, cup.y - 0.004 * k, cup.x + 0.03 * k, ct);
    g.fill();
    g.fillStyle = '#e2b23a';
    g.fillRect(cup.x - 0.0295 * k, ct + 0.006 * k, 0.059 * k, 0.005 * k);
    g.fillStyle = '#e8dcc4';
    g.beginPath();
    g.ellipse(cup.x, ct, 0.03 * k, 0.008 * k, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#7a4418';
    g.beginPath();
    g.ellipse(cup.x, ct + 0.001 * k, 0.026 * k, 0.0062 * k, 0, 0, TAU);
    g.fill();
    this.cup = { x: cup.x, y: ct };
    // the inkpot and quill
    const ink = { x: tb.x + tb.rx * 0.72, y: tb.y - tb.ry * 0.3 };
    g.fillStyle = '#1a1a26';
    g.beginPath();
    g.roundRect(ink.x - 0.014 * k, ink.y - 0.024 * k, 0.028 * k, 0.026 * k, 0.006 * k);
    g.fill();
    g.fillStyle = 'rgba(200,210,255,0.3)';
    g.fillRect(ink.x - 0.009 * k, ink.y - 0.02 * k, 0.003 * k, 0.014 * k);
    g.save();
    g.translate(ink.x, ink.y - 0.022 * k);
    g.rotate(-0.42);
    g.fillStyle = '#f4eee0';
    g.beginPath();
    g.moveTo(0, -0.01 * k);
    g.quadraticCurveTo(-0.016 * k, -0.06 * k, -0.002 * k, -0.12 * k);
    g.quadraticCurveTo(0.012 * k, -0.07 * k, 0.003 * k, -0.01 * k);
    g.fill();
    g.strokeStyle = 'rgba(120,110,90,0.7)';
    g.lineWidth = Math.max(1, 0.0025 * k);
    g.beginPath();
    g.moveTo(0, 0.005 * k);
    g.quadraticCurveTo(-0.003 * k, -0.06 * k, -0.002 * k, -0.118 * k);
    g.stroke();
    g.restore();
    // the book lies open; its pages are drawn live so one can turn
    this.book = { x: tb.x + tb.rx * 0.15, y: tb.y + tb.ry * 0.15, pw: 0.065 * k, pd: 0.03 * k };
    bookCover(g, this.book, '#6a2a22');

    printGrain(this.room, this.grain, 0.14);
    printGrain(this.front, this.grain, 0.14);

    // the view outside: a strip as wide as the screen, sky over grass, two skies to fade between
    const VH = Math.ceil(wr * 2.3);
    this.viewH = VH;
    const sky = (sunny) => {
      const c = layer(w, VH);
      const q = c.getContext('2d');
      q.fillStyle = vgrad(q, 0, VH * 0.62, sunny ? [
        [0, '#5fa6dc'],
        [1, '#dcefee'],
      ] : [
        [0, '#59626c'],
        [1, '#a2abae'],
      ]);
      q.fillRect(0, 0, w, VH);
      if (sunny) {
        const sg = q.createRadialGradient(w * 0.2, 0, 0, w * 0.2, 0, VH * 0.9);
        sg.addColorStop(0, 'rgba(255,248,215,0.75)');
        sg.addColorStop(1, 'rgba(255,248,215,0)');
        q.fillStyle = sg;
        q.fillRect(0, 0, w, VH);
      }
      let s = sunny ? 3 : 8;
      const rr = () => (s = (s * 9301 + 49297) % 233280) / 233280;
      for (let i = 0; i < (sunny ? w / (VH * 0.6) : w / (VH * 0.3)); i++) {
        const cx = rr() * w;
        const cy = VH * (0.08 + rr() * 0.28);
        const cs = VH * (0.05 + rr() * 0.06);
        q.fillStyle = sunny ? 'rgba(255,255,255,0.75)' : `rgba(${rr() < 0.5 ? '70,78,86' : '150,158,162'},0.45)`;
        for (let j = 0; j < 6; j++) {
          q.beginPath();
          q.ellipse(cx + (j - 2.5) * cs * 0.7, cy - Math.sin((j / 5) * Math.PI) * cs * 0.5, cs * (0.7 + rr() * 0.4), cs * 0.6, 0, 0, TAU);
          q.fill();
        }
      }
      return c;
    };
    this.skySun = sky(true);
    this.skyRain = sky(false);
    this.far = layer(w, VH);
    const fq = this.far.getContext('2d');
    hills(fq, w, VH * 0.58, VH * 0.08, '#94b8a4', 3, 1.2);
    treeline(fq, w, VH * 0.6, VH * 0.07, '#4e6e58', 'pine', 4);
    hills(fq, w, VH * 0.64, VH * 0.04, '#6f9a5a', 4, 0.3);
    this.grassBack = grassLayer(w, VH, Math.round(w / 2.5), 0.5, 0.68, ['#5a8f38', '#4d8030', '#67a040'], 21);
    this.grassFront = grassLayer(w, VH, Math.round(w / 6), 0.36, 0.62, ['#6aa844', '#5b9a3a', '#78b44c'], 37, Math.max(4, Math.round(w / 45)), Math.max(1, Math.round(w / 260)));

    // plants hanging from the beams, away from the middle of the windows
    const hang = N === 1 ? [0.12, 0.88] : [(X(-0.31) / w), X(0.31) / w, 0.05, 0.95];
    this.hanging = hang.map((fx, i) => {
      const S = 0.045 * k;
      const L = h * (0.05 + (i % 2) * 0.03);
      return { x: fx * w, S, spr: hangingPlant(S, L, 50 + i * 7), ph: R(0, TAU), f: R(0.3, 0.5) };
    });

    this.glow = glowSprite([
      [0, 'rgba(255,200,130,0.85)'],
      [0.3, 'rgba(255,150,70,0.3)'],
      [1, 'rgba(255,120,50,0)'],
    ]);
    this.fireGlow = glowSprite([
      [0, 'rgba(255,140,50,0.75)'],
      [0.35, 'rgba(230,90,30,0.25)'],
      [1, 'rgba(200,60,20,0)'],
    ]);
    this.steam = glowSprite([
      [0, 'rgba(255,250,240,0.55)'],
      [0.5, 'rgba(255,250,240,0.2)'],
      [1, 'rgba(255,250,240,0)'],
    ]);
    this.sunGlow = glowSprite([
      [0, 'rgba(255,236,190,0.7)'],
      [0.4, 'rgba(255,220,160,0.2)'],
      [1, 'rgba(255,210,150,0)'],
    ]);
    this.rk = this.rainTarget();
    this.seeds = [];
    this.drops = [];
    this.puffs = [];
    this.motes = Array.from({ length: 30 }, () => ({ x: R(0, 1), y: R(0, 1), v: R(0.2, 0.6), a: R(0.2, 0.6) }));
    this.bird = null;
    this.lightning = null;
    this.flip = null;
    this.tea = -99;
    // the cat pile (see catPile)
    this.cats = catPileSprites(0.105 * k);
  }

  // it's raining in the picture if either rain is up: on the windows, or the steady rain on the hill
  rainTarget() {
    const layers = this.engine.scene?.layers;
    const lv = (id) => layers?.get(id)?.level ?? 0;
    return clamp((layers?.get('rain') ? Math.max(lv('rain'), lv('storm')) : 0.5) / 0.4, 0, 1);
  }

  // far-off lightning: a soft double flicker that fades, only seen while it rains
  flashLevel() {
    const L = this.lightning;
    if (!L) return 0;
    const a = this.t - L.t0;
    if (a > 1.5) {
      this.lightning = null;
      return 0;
    }
    const f = Math.exp(-a * 5) + (a > 0.18 ? 0.6 * Math.exp(-(a - 0.18) * 6) : 0);
    return L.k * Math.min(1, f) * this.rk;
  }

  event(e) {
    if (e.type === 'shot' && e.layer === 'tea') this.at(e.at, () => (this.tea = this.t));
    if (e.type === 'lightning') this.at(e.at, () => (this.lightning = { t0: this.t, k: e.strength ?? 0.4 }));
    if (e.type === 'shot' && e.layer === 'pages') this.at(e.at, () => (this.flip = { t0: this.t }));
    if (e.type === 'bird' && !this.bird) {
      this.at(e.at, () => {
        const W = this.wins[Math.floor(Math.random() * this.wins.length)];
        const dir = Math.random() < 0.5 ? 1 : -1;
        this.bird = { W, kind: e.species, t0: this.t, life: (e.dur || 3) + rand(4, 9), dir, x: rand(0.15, 0.5) * (Math.random() < 0.5 ? -1 : 1) };
      });
    }
  }

  frame(dt) {
    const { g, w, h, t, u } = this;
    this.rk += (this.rainTarget() - this.rk) * Math.min(1, dt * 0.6);
    const rk = this.rk;
    const sun = 1 - rk;
    const fl = this.flashLevel();
    const VH = this.viewH;

    // --- outside, through each window
    const sway = Math.sin(t * 0.7) * 0.05 + Math.sin(t * 1.9 + 1) * 0.02;
    for (const W of this.wins) {
      const vy = W.y - VH * 0.5;
      g.save();
      g.beginPath();
      g.ellipse(W.x, W.y, W.rx, W.ry, 0, 0, TAU);
      g.clip();
      const sx = Math.max(0, W.x - W.ry * 1.2);
      const sw = Math.min(w - sx, W.ry * 2.4);
      const part = (img, alpha = 1) => {
        g.globalAlpha = alpha;
        g.drawImage(img, sx, 0, sw, VH, sx, vy, sw, VH);
        g.globalAlpha = 1;
      };
      if (sun > 0.01) part(this.skySun);
      if (rk > 0.01) part(this.skyRain, rk);
      part(this.far);
      const grass = (img, k2) => {
        g.save();
        g.translate(0, vy + VH);
        g.transform(1, 0, sway * k2, 1, 0, 0);
        g.translate(0, -(vy + VH));
        part(img);
        g.restore();
      };
      grass(this.grassBack, 0.6);
      grass(this.grassFront, 1);
      // a garden bird down on the grass in front while it sings
      const b = this.bird;
      if (b && b.W === W) {
        const age = t - b.t0;
        const inn = clamp(age / 1.2, 0, 1);
        const out = clamp((b.life - age) / 1.2, 0, 1);
        const bx = W.x + W.rx * (b.x - b.dir * (1 - inn) * 1.4 + b.dir * (1 - out) * 1.4) + Math.floor(age / 2.5) * 0.04 * W.rx * b.dir * (inn * out);
        const hop = inn < 1 || out < 1 ? (age * 2.5) % 1 : 0;
        g.save();
        g.translate(bx, vy + VH * 0.62);
        g.scale(b.dir, 1);
        gardenBird(g, 0, 0, W.ry * 0.16, b.kind, hop);
        g.restore();
      }
      if (rk > 0.01) {
        g.fillStyle = `rgba(40,52,60,${0.3 * rk})`;
        g.fillRect(W.x - W.rx, W.y - W.ry, W.rx * 2, W.ry * 2);
        if (fl > 0.01) {
          g.fillStyle = `rgba(225,232,255,${0.55 * fl})`;
          g.fillRect(W.x - W.rx, W.y - W.ry, W.rx * 2, W.ry * 2);
        }
        // rain falling outside
        g.strokeStyle = `rgba(220,230,240,${0.35 * rk})`;
        g.lineWidth = Math.max(1, this.dpr * 0.8);
        g.beginPath();
        const n = Math.round(40 * rk);
        for (let i = 0; i < n; i++) {
          const fx = ((i * 0.618 + t * 0.07 * (1 + (i % 3))) % 1) * 2 - 1;
          const fy = ((i * 0.37 + t * (1.4 + (i % 5) * 0.15)) % 1) * 2 - 1;
          const x = W.x + fx * W.rx;
          const y = W.y + fy * W.ry;
          g.moveTo(x, y);
          g.lineTo(x - W.ry * 0.02, y + W.ry * 0.12);
        }
        g.stroke();
      }
      // sunlight on the glass
      if (sun > 0.01) {
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = 0.14 * sun;
        g.drawImage(this.sunGlow, W.x - W.rx * 1.6, W.y - W.ry * 1.9, W.rx * 2.4, W.ry * 2.4);
        g.globalAlpha = 1;
        g.globalCompositeOperation = 'source-over';
      }
      g.restore();
    }
    // dandelion seeds drifting by in the sun, seen through whichever window they pass
    if (sun > 0.3 && this.seeds.length < 10 && Math.random() < dt * 0.35 * sun) {
      const W = this.wins[Math.floor(Math.random() * this.wins.length)];
      this.seeds.push({ x: W.x - W.rx * 1.3, y: W.y + rand(-0.6, 0.2) * W.ry, v: rand(1.5, 3.5) * u, ph: rand(0, TAU), s: rand(0.7, 1.2) * u });
    }
    this.seeds = this.seeds.filter((s) => s.x < w + 20);
    g.save();
    g.clip(this.glass);
    for (const s of this.seeds) {
      s.x += s.v * dt;
      s.y += Math.sin(t * 0.8 + s.ph) * u * 0.4 * dt - u * 0.15 * dt;
      g.strokeStyle = `rgba(255,255,255,${0.75 * sun})`;
      g.lineWidth = Math.max(0.6, this.dpr * 0.5);
      g.beginPath();
      for (let j = 0; j < 7; j++) {
        const a = -Math.PI / 2 + (j - 3) * 0.32;
        g.moveTo(s.x, s.y);
        g.lineTo(s.x + Math.cos(a) * s.s, s.y + Math.sin(a) * s.s);
      }
      g.moveTo(s.x, s.y);
      g.lineTo(s.x + s.s * 0.15, s.y + s.s * 1.1);
      g.stroke();
    }
    // raindrops on the glass, some running down
    if (rk > 0.05 && this.drops.length < 60 * rk && Math.random() < dt * 12 * rk) {
      const W = this.wins[Math.floor(Math.random() * this.wins.length)];
      const a = rand(0, TAU);
      const rr = Math.sqrt(Math.random());
      this.drops.push({ x: W.x + Math.cos(a) * rr * W.rx, y: W.y + Math.sin(a) * rr * W.ry, r: rand(0.3, 0.9) * u, v: Math.random() < 0.3 ? rand(2, 8) * u : 0, life: rand(6, 16), age: 0 });
    }
    this.drops = this.drops.filter((d) => (d.age += dt) < d.life);
    for (const d of this.drops) {
      d.y += d.v * dt;
      const a = Math.min(1, d.age * 2, (d.life - d.age) * 0.5) * Math.max(rk, 0.2);
      g.fillStyle = `rgba(30,40,50,${0.25 * a})`;
      g.beginPath();
      g.ellipse(d.x, d.y + d.r * 0.15, d.r, d.r * 1.15, 0, 0, TAU);
      g.fill();
      g.fillStyle = `rgba(230,240,250,${0.55 * a})`;
      g.beginPath();
      g.arc(d.x - d.r * 0.3, d.y - d.r * 0.35, d.r * 0.35, 0, TAU);
      g.fill();
    }
    g.restore();

    // --- the room
    g.drawImage(this.room, 0, 0);
    if (rk > 0.01) {
      g.fillStyle = `rgba(25,32,50,${0.16 * rk})`;
      g.fillRect(0, 0, w, h);
    }
    if (fl > 0.01) {
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = `rgba(150,165,210,${0.06 * fl})`;
      g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'source-over';
    }
    const fireOn = this.engine.scene?.layers?.get('fire')?.level ?? 0.6;
    const lvl = clamp(fireOn * 1.6, 0.25, 1);
    const flick = (0.78 + 0.12 * Math.sin(t * 7.3) * Math.sin(t * 3.1) + 0.1 * Math.sin(t * 13.7)) * lvl;
    g.globalCompositeOperation = 'lighter';
    // sun slanting in from each window onto the floor, motes in it
    if (sun > 0.01) {
      for (const W of this.wins) {
        const L = h * 0.42;
        const dx = L * 0.38;
        const bg = g.createLinearGradient(W.x, W.y, W.x + dx, W.y + L);
        const a = (0.075 + 0.015 * Math.sin(t * 0.2 + W.x)) * sun;
        bg.addColorStop(0, 'rgba(255,228,160,0)');
        bg.addColorStop(0.3, `rgba(255,228,160,${a})`);
        bg.addColorStop(1, 'rgba(255,228,160,0)');
        g.fillStyle = bg;
        g.beginPath();
        g.moveTo(W.x - W.rx * 0.85, W.y - W.ry * 0.5);
        g.lineTo(W.x + W.rx * 0.85, W.y + W.ry * 0.5);
        g.lineTo(W.x + W.rx * 0.85 + dx, W.y + W.ry * 0.5 + L);
        g.lineTo(W.x - W.rx * 0.85 + dx, W.y - W.ry * 0.5 + L);
        g.fill();
        for (const m of this.motes) {
          m.y = (m.y + m.v * dt * 0.02) % 1;
          const f = m.y;
          const x = W.x + (m.x - 0.5) * W.rx * 1.4 + dx * f + Math.sin(t * 0.3 + m.x * 9) * u;
          const y = W.y + L * f * 0.85;
          g.fillStyle = `rgba(255,240,200,${m.a * sun * (1 - f) * 0.6})`;
          g.fillRect(x, y, 1.5 * this.dpr, 1.5 * this.dpr);
        }
      }
    }
    // firelight and candlelight
    const mo = this.mouth;
    const mw = mo.x1 - mo.x0;
    const mh = mo.y1 - mo.y0;
    const fx = (mo.x0 + mo.x1) / 2;
    g.globalAlpha = (0.45 + 0.15 * rk) * flick;
    g.drawImage(this.fireGlow, fx - mw * 1.8, mo.y1 - mh * 1.8, mw * 3.6, mh * 2.8);
    for (const [cx, cy] of this.candles) {
      g.globalAlpha = 0.35 + 0.05 * Math.sin(t * 9 + cx);
      g.drawImage(this.glow, cx - mw * 0.15, cy - mw * 0.17, mw * 0.3, mw * 0.3);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    for (const [cx, cy] of this.candles) {
      g.fillStyle = 'rgba(255,220,150,0.95)';
      g.beginPath();
      g.ellipse(cx, cy - mw * 0.02, mw * 0.008, mw * 0.022 * (1 + 0.1 * Math.sin(t * 11 + cx)), 0, 0, TAU);
      g.fill();
    }
    hearthFire(g, mo, this.mouthPath, this.glow, t, lvl, flick);

    catPile(g, this.cats, this.rug, t, dt);
    g.drawImage(this.front, 0, 0);

    // steam: a little always off the tea, more when a fresh cup's poured, and the kettle's as it simmers
    const c = this.cup;
    const fresh = clamp(1 - (t - this.tea) / 12, 0, 1);
    g.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const ph = t * 0.5 + i * 2.1;
      const hgt = mw * (0.45 + 0.1 * Math.sin(ph * 0.7) + 0.25 * fresh);
      g.strokeStyle = `rgba(255,250,240,${0.1 + 0.05 * Math.sin(ph) + 0.12 * fresh})`;
      g.lineWidth = Math.max(1.5, mw * 0.025);
      g.beginPath();
      g.moveTo(c.x + (i - 1) * mw * 0.04, c.y);
      g.bezierCurveTo(c.x + Math.sin(ph) * mw * 0.08, c.y - hgt * 0.35, c.x - Math.sin(ph + 1) * mw * 0.1, c.y - hgt * 0.7, c.x + Math.sin(ph + 2) * mw * 0.06, c.y - hgt);
      g.stroke();
    }
    const kettle = this.engine.scene?.layers?.get('kettle')?.level ?? 0.3;
    if (Math.random() < dt * 6 * kettle) this.puffs.push({ x: this.spout[0], y: this.spout[1], r: mw * 0.03, age: 0, vx: rand(0.05, 0.15) * mw, vy: -rand(0.25, 0.4) * mw });
    this.puffs = this.puffs.filter((p) => (p.age += dt) < 3);
    for (const p of this.puffs) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.r += mw * 0.04 * dt;
      g.globalAlpha = 0.5 * Math.min(1, p.age * 3) * (1 - p.age / 3);
      g.drawImage(this.steam, p.x - p.r * 1.6, p.y - p.r * 1.6, p.r * 3.2, p.r * 3.2);
      g.globalAlpha = 1;
    }

    // the open book, and a page turning when one is heard
    const turn = this.flip ? t - this.flip.t0 : null;
    if (turn != null && turn > 0.9) this.flip = null;
    openBook(g, this.book, turn);

    // plants hanging on their chains
    for (const pl of this.hanging) {
      const ang = Math.sin(t * pl.f + pl.ph) * 0.025;
      g.save();
      g.translate(pl.x, 0);
      g.rotate(ang);
      g.drawImage(pl.spr, -pl.S, 0);
      g.restore();
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Three rooms at the tops of towers, at night: a common room in scarlet and gold round a roaring
// fire, an airy one in blue and bronze under a dome painted with stars, and the headmaster's study,
// where silver instruments whirr on spindly tables, old portraits doze in their frames and a phoenix
// keeps watch from a golden perch. They're built the same way: a round stone room whose far wall
// curves away, tall arched windows onto the night, a fire near us on the left with the cats on the
// rug in front of it, and a table near us on the right.

// the cat pile from the room by the kitchens: a tuxedo asleep facing the fire, a bicolour curled up
// against him and a black cat awake behind them, who now and then closes his eyes in a slow blink
function catPileSprites(cs) {
  return { tux: catSprite(cs), bicolour: bicolourCatSprite(cs * 0.95), blackOpen: blackCatSprite(cs, true), blackShut: blackCatSprite(cs, false), blink: rand(4, 10) };
}
function catPile(g, P, rug, t, dt) {
  const tw = P.tux.width;
  const th = P.tux.height;
  const tb = 1 + 0.025 * Math.sin(t * 1.6);
  const tx = rug.x - tw * 0.42;
  const bw = P.blackOpen.width;
  const bh = P.blackOpen.height;
  const bb = 1 + 0.018 * Math.sin(t * 1.3 + 2);
  P.blink -= dt;
  if (P.blink < -0.9) P.blink = rand(6, 14);
  const eyes = P.blink < 0 ? P.blackShut : P.blackOpen;
  g.drawImage(eyes, tx + tw * 0.3, rug.y - bh * 0.88 - bh * (bb - 1) - th * 0.05, bw, bh * bb);
  g.save();
  g.translate(tx + tw, rug.y - th * 0.84 - th * (tb - 1));
  g.scale(-1, 1);
  g.drawImage(P.tux, 0, 0, tw, th * tb);
  g.restore();
  const cw = P.bicolour.width;
  const ch = P.bicolour.height;
  const cb = 1 + 0.022 * Math.sin(t * 1.45 + 4);
  g.drawImage(P.bicolour, tx - cw * 0.62, rug.y - ch * 0.8 - ch * (cb - 1) + th * 0.04, cw, ch * cb);
}

// an open book lying on a table, its pages drawn live so one can turn (flip: seconds into a turn,
// or null). bk: the spine's foot (x, y), a page's width (pw) and depth (pd).
function openBook(g, bk, flip) {
  const page = (side, lift = 0, ang = 0) => {
    const ox = bk.x + side * Math.cos(ang) * bk.pw;
    const oy = -Math.sin(ang) * bk.pw * 0.55;
    g.beginPath();
    g.moveTo(bk.x, bk.y);
    g.quadraticCurveTo(bk.x + side * bk.pw * 0.5 * Math.cos(ang), bk.y - bk.pd * 0.08 + oy * 0.6 - lift, ox, bk.y + bk.pd * 0.06 + oy);
    g.lineTo(ox - side * bk.pw * 0.04 * Math.cos(ang), bk.y - bk.pd * 0.94 + oy);
    g.quadraticCurveTo(bk.x + side * bk.pw * 0.5 * Math.cos(ang), bk.y - bk.pd * 1.06 + oy * 0.6 - lift, bk.x, bk.y - bk.pd);
    g.closePath();
  };
  for (const side of [-1, 1]) {
    page(side, bk.pd * 0.15);
    g.fillStyle = side < 0 ? '#efe4cc' : '#f6ecd6';
    g.fill();
    g.strokeStyle = 'rgba(90,80,60,0.28)';
    g.lineWidth = Math.max(1, bk.pd * 0.04);
    g.beginPath();
    for (let i = 1; i < 9; i++) {
      const f = i / 9.5;
      g.moveTo(bk.x + side * bk.pw * 0.12, bk.y - bk.pd * f);
      g.lineTo(bk.x + side * bk.pw * 0.86, bk.y - bk.pd * f + bk.pd * 0.04);
    }
    g.stroke();
  }
  g.fillStyle = 'rgba(80,60,40,0.25)';
  g.fillRect(bk.x - 1, bk.y - bk.pd, 2, bk.pd);
  if (flip != null && flip < 0.9) {
    const p = flip / 0.9;
    const e = p * p * (3 - 2 * p);
    const ang = e * Math.PI;
    page(1, 0, ang);
    g.fillStyle = mix('#f6ecd6', '#d8ccb0', Math.sin(ang) * 0.6);
    g.fill();
  }
}
// the cover under an open book
function bookCover(g, bk, col) {
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(bk.x - bk.pw * 1.04, bk.y + bk.pd * 0.12);
  g.lineTo(bk.x + bk.pw * 1.04, bk.y + bk.pd * 0.12);
  g.lineTo(bk.x + bk.pw * 0.98, bk.y - bk.pd * 1.02);
  g.lineTo(bk.x - bk.pw * 0.98, bk.y - bk.pd * 1.02);
  g.fill();
}

// an inkpot with a quill standing in it, its foot at (x, y)
function inkAndQuill(g, x, y, k) {
  g.fillStyle = '#1a1a26';
  g.beginPath();
  g.roundRect(x - 0.014 * k, y - 0.024 * k, 0.028 * k, 0.026 * k, 0.006 * k);
  g.fill();
  g.fillStyle = 'rgba(200,210,255,0.3)';
  g.fillRect(x - 0.009 * k, y - 0.02 * k, 0.003 * k, 0.014 * k);
  g.save();
  g.translate(x, y - 0.022 * k);
  g.rotate(-0.42);
  g.fillStyle = '#f4eee0';
  g.beginPath();
  g.moveTo(0, -0.01 * k);
  g.quadraticCurveTo(-0.016 * k, -0.06 * k, -0.002 * k, -0.12 * k);
  g.quadraticCurveTo(0.012 * k, -0.07 * k, 0.003 * k, -0.01 * k);
  g.fill();
  g.strokeStyle = 'rgba(120,110,90,0.7)';
  g.lineWidth = Math.max(1, 0.0025 * k);
  g.beginPath();
  g.moveTo(0, 0.005 * k);
  g.quadraticCurveTo(-0.003 * k, -0.06 * k, -0.002 * k, -0.118 * k);
  g.stroke();
  g.restore();
}

// a stack of closed books lying flat, bottom centre at (x, y): [width, colour] from the bottom up
function bookStack(g, x, y, k, books) {
  let yy = y;
  for (const [bw, col] of books) {
    const bh = 0.014 * k;
    g.fillStyle = col;
    g.fillRect(x - (bw * k) / 2, yy - bh, bw * k, bh);
    g.fillStyle = 'rgba(240,225,190,0.75)';
    g.fillRect(x - (bw * k) / 2 + 0.003 * k, yy - bh * 0.72, bw * k - 0.006 * k, bh * 0.44);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(x - (bw * k) / 2, yy - bh * 0.12, bw * k, bh * 0.12);
    yy -= bh;
  }
  return yy;
}

// a rack of books standing on a shelf from x0 to x1 with their feet at y
function bookRow(g, x0, x1, y, k, cols, r) {
  let x = x0;
  while (x < x1 - 0.012 * k) {
    const bw = (0.01 + r() * 0.012) * k;
    const bh = (0.045 + r() * 0.03) * k;
    if (r() < 0.08) {
      x += bw;
      continue;
    }
    const lean = r() < 0.1 ? 0.12 : 0;
    g.save();
    g.translate(x, y);
    g.rotate(lean);
    g.fillStyle = cols[Math.floor(r() * cols.length)];
    g.fillRect(0, -bh, Math.min(bw, x1 - x), bh);
    g.fillStyle = 'rgba(255,220,150,0.35)';
    g.fillRect(0, -bh * 0.82, Math.min(bw, x1 - x), 0.003 * k);
    g.fillRect(0, -bh * 0.22, Math.min(bw, x1 - x), 0.003 * k);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(Math.min(bw, x1 - x) - 0.002 * k, -bh, 0.002 * k, bh);
    g.restore();
    x += bw + 0.001 * k;
  }
}

// an overstuffed armchair facing us, its feet on the floor at by: c holds its colours
function armchair(g, cx, by, cw, ch, c, k) {
  g.fillStyle = c.legs;
  g.fillRect(cx - cw * 0.42, by - ch * 0.06, cw * 0.07, ch * 0.08);
  g.fillRect(cx + cw * 0.35, by - ch * 0.06, cw * 0.07, ch * 0.08);
  const back = new Path2D();
  back.moveTo(cx - cw * 0.5, by - ch * 0.05);
  back.lineTo(cx - cw * 0.56, by - ch * 0.5);
  back.quadraticCurveTo(cx - cw * 0.66, by - ch * 0.78, cx - cw * 0.42, by - ch * 0.84);
  back.quadraticCurveTo(cx - cw * 0.3, by - ch * 1.04, cx, by - ch);
  back.quadraticCurveTo(cx + cw * 0.3, by - ch * 1.04, cx + cw * 0.42, by - ch * 0.84);
  back.quadraticCurveTo(cx + cw * 0.66, by - ch * 0.78, cx + cw * 0.56, by - ch * 0.5);
  back.lineTo(cx + cw * 0.5, by - ch * 0.05);
  back.closePath();
  const ag = g.createLinearGradient(cx - cw * 0.6, 0, cx + cw * 0.6, 0);
  ag.addColorStop(0, c.lit);
  ag.addColorStop(0.6, c.mid);
  ag.addColorStop(1, c.dark);
  g.fillStyle = ag;
  g.fill(back);
  g.strokeStyle = c.line;
  g.lineWidth = Math.max(1.5, 0.004 * k);
  g.stroke(back);
  // the squashy seat cushion and the arms
  g.fillStyle = c.mid;
  g.beginPath();
  g.roundRect(cx - cw * 0.36, by - ch * 0.42, cw * 0.72, ch * 0.2, ch * 0.08);
  g.fill();
  g.stroke();
  for (const s of [-1, 1]) {
    g.fillStyle = s < 0 ? c.lit : c.dark;
    g.beginPath();
    g.roundRect(cx + s * cw * 0.5 - cw * 0.14, by - ch * 0.56, cw * 0.28, ch * 0.52, cw * 0.12);
    g.fill();
    g.stroke();
  }
  if (c.trim) {
    g.strokeStyle = c.trim;
    g.lineWidth = Math.max(1, 0.003 * k);
    g.beginPath();
    g.moveTo(cx - cw * 0.3, by - ch * 0.86);
    g.quadraticCurveTo(cx, by - ch * 0.95, cx + cw * 0.3, by - ch * 0.86);
    g.stroke();
  }
}

class TowerRoom extends Painting {
  // the shape of the room: the wall's top line at the middle (top) and how far it lifts at the
  // sides (lift); its foot at the middle (foot) and how far it drops at the sides (drop)
  shape(top, lift, foot, drop) {
    const { w, h } = this;
    const vx = (this.vx = w * 0.5);
    const d = (x) => (x - vx) / (w * 0.5);
    this.ceilY = (x) => h * (top - lift * d(x) ** 2);
    this.floorY = (x) => h * (foot + drop * d(x) ** 2);
    const Rw = w * 0.55;
    this.X = (th) => vx + Rw * Math.sin(th);
    this.TH = (x) => Math.asin(clamp((x - vx) / Rw, -1, 1));
  }
  // trace a curve y = fn(x) from x0 to x1 (after a moveTo or lineTo)
  curve(g, fn, x0, x1) {
    if (x1 >= x0) for (let x = x0; x <= x1; x += 4) g.lineTo(x, fn(x));
    else for (let x = x0; x >= x1; x -= 4) g.lineTo(x, fn(x));
    g.lineTo(x1, fn(x1));
  }
  wallPath() {
    const { w } = this;
    const p = new Path2D();
    p.moveTo(0, this.ceilY(0));
    this.curve(p, this.ceilY, 0, w);
    this.curve(p, this.floorY, w, 0);
    p.closePath();
    return p;
  }
  // coursed stone on the far wall, the courses following its curve: pal = [mortar, stone, light,
  // dark], rowH and stoneW the size of a stone (in k)
  stones(g, pal, rowH, stoneW) {
    const { w, k } = this;
    const wall = this.wallPath();
    g.fillStyle = pal[0];
    g.fill(wall);
    g.save();
    g.clip(wall);
    const rows = Math.max(6, Math.round((this.floorY(this.vx) - this.ceilY(this.vx)) / (rowH * k)));
    const yAt = (x, f) => lerp(this.ceilY(x), this.floorY(x), f);
    const gap = Math.max(1, 0.0014 * k);
    for (let i = 0; i < rows; i++) {
      const f0 = i / rows;
      const f1 = (i + 1) / rows;
      let x = -this.r() * stoneW * k;
      while (x < w) {
        const narrow = 0.6 + 0.4 * Math.cos(this.TH(x));
        const x1 = x + stoneW * k * (0.7 + this.r() * 0.6) * narrow;
        const v = this.R(-1, 1);
        g.fillStyle = mix(pal[1], v > 0 ? pal[2] : pal[3], Math.abs(v) * 0.6);
        g.beginPath();
        g.moveTo(x + gap, yAt(x + gap, f0) + gap);
        g.lineTo(x1 - gap, yAt(x1 - gap, f0) + gap);
        g.lineTo(x1 - gap, yAt(x1 - gap, f1) - gap);
        g.lineTo(x + gap, yAt(x + gap, f1) - gap);
        g.closePath();
        g.fill();
        x = x1;
      }
    }
    g.restore();
  }
  // clip to everything but the glass, for washes of light and shade over the room
  noGlass(g) {
    const p = new Path2D();
    p.rect(0, 0, this.w, this.h);
    p.addPath(this.glass);
    g.save();
    g.clip(p, 'evenodd');
  }
  // a floor of wide boards running out from the wall
  boards(g, c0, c1, line) {
    const { w, h } = this;
    g.beginPath();
    g.moveTo(0, this.floorY(0));
    this.curve(g, this.floorY, 0, w);
    g.lineTo(w, h);
    g.lineTo(0, h);
    g.closePath();
    g.fillStyle = vgrad(g, h * 0.6, h, [
      [0, c0],
      [1, c1],
    ]);
    g.fill();
    g.strokeStyle = line;
    g.lineWidth = Math.max(1, 0.003 * this.k);
    for (let i = -14; i <= 14; i++) {
      const bx = this.vx + i * w * 0.045;
      g.beginPath();
      g.moveTo(bx, this.floorY(bx));
      g.lineTo(this.vx + (bx - this.vx) * 3.2, h);
      g.stroke();
    }
  }
  // dark beams running out across the ceiling from over the middle of the room
  beams(g, c0, c1, beam, sheen) {
    const { w, h, k } = this;
    const top = Math.max(this.ceilY(0), this.ceilY(this.vx)) + 2;
    g.fillStyle = vgrad(g, 0, top, [
      [0, c0],
      [1, c1],
    ]);
    g.fillRect(0, 0, w, top);
    for (let th = -1.4; th <= 1.41; th += 0.28) {
      const x = this.X(th);
      g.strokeStyle = beam;
      g.lineWidth = 0.022 * k * Math.cos(th);
      g.beginPath();
      g.moveTo(this.vx + (x - this.vx) * 2.6, -2);
      g.lineTo(x, this.ceilY(x));
      g.stroke();
      g.strokeStyle = sheen;
      g.lineWidth = Math.max(1, 0.004 * k);
      g.beginPath();
      g.moveTo(this.vx + (x - this.vx) * 2.6 - 0.008 * k, -2);
      g.lineTo(x - 0.008 * k * Math.cos(th), this.ceilY(x));
      g.stroke();
    }
    void h;
  }

  // tall pointed windows in the far wall at the angles ths, from a little below its top to a
  // little above its foot; the glass is cut out of the room layer so the night shows through
  lancets(g, ths, o) {
    const { k } = this;
    this.wins = ths.map((th) => {
      const x = this.X(th);
      const hw = o.hw * Math.cos(th);
      const y0 = this.ceilY(x) + o.top;
      const y1 = this.floorY(x) - o.foot;
      return { x, th, hw, y0, y1, ys: y0 + Math.min(hw * 2.2, (y1 - y0) * 0.4) };
    });
    const arch = (p, W, e = 0) => {
      const a = W.ys - W.y0;
      p.moveTo(W.x - W.hw - e, W.y1 + e);
      p.lineTo(W.x - W.hw - e, W.ys);
      p.bezierCurveTo(W.x - W.hw - e, W.ys - a * 0.55, W.x - (W.hw + e) * 0.4, W.y0 - e + a * 0.12, W.x, W.y0 - e);
      p.bezierCurveTo(W.x + (W.hw + e) * 0.4, W.y0 - e + a * 0.12, W.x + W.hw + e, W.ys - a * 0.55, W.x + W.hw + e, W.ys);
      p.lineTo(W.x + W.hw + e, W.y1 + e);
      p.closePath();
    };
    this.arch = arch;
    this.glass = new Path2D();
    const rev = o.reveal * k;
    for (const W of this.wins) {
      // the deep reveal of a thick tower wall, lit on the side away from us
      const outer = new Path2D();
      arch(outer, W, rev * Math.cos(W.th) + rev * 0.4);
      g.fillStyle = o.surround;
      g.fill(outer);
      const inner = new Path2D();
      arch(inner, W, rev * 0.55);
      const rg = g.createLinearGradient(W.x - W.hw - rev, 0, W.x + W.hw + rev, 0);
      rg.addColorStop(0, W.th > 0 ? o.revealLit : o.revealDark);
      rg.addColorStop(1, W.th > 0 ? o.revealDark : o.revealLit);
      g.fillStyle = rg;
      g.fill(inner);
      // the sill
      g.fillStyle = o.sill;
      g.fillRect(W.x - W.hw - rev * 1.2, W.y1 + rev * 0.3, (W.hw + rev * 1.2) * 2, 0.014 * k);
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.fillRect(W.x - W.hw - rev * 1.2, W.y1 + rev * 0.3 + 0.014 * k, (W.hw + rev * 1.2) * 2, 0.006 * k);
      arch(this.glass, W);
    }
    g.save();
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = '#000';
    g.fill(this.glass);
    g.restore();
    // leading: a mullion, a transom, and small diamond panes
    for (const W of this.wins) {
      g.save();
      const gp = new Path2D();
      arch(gp, W);
      g.clip(gp);
      g.strokeStyle = o.lead;
      g.lineWidth = Math.max(1, 0.0013 * k);
      g.beginPath();
      const pane = Math.max(W.hw * 0.55, 0.022 * k);
      for (let x = W.x - W.hw * 3; x < W.x + W.hw * 3; x += pane) {
        g.moveTo(x, W.y0);
        g.lineTo(x + (W.y1 - W.y0) * 0.6, W.y1);
        g.moveTo(x, W.y0);
        g.lineTo(x - (W.y1 - W.y0) * 0.6, W.y1);
      }
      g.stroke();
      g.restore();
      g.strokeStyle = o.bar;
      g.lineWidth = Math.max(2, 0.006 * k * Math.cos(W.th));
      g.beginPath();
      g.moveTo(W.x, W.y0);
      g.lineTo(W.x, W.y1);
      const ty = lerp(W.ys, W.y1, 0.42);
      g.moveTo(W.x - W.hw, ty);
      g.lineTo(W.x + W.hw, ty);
      g.stroke();
    }
  }

  // the night outside, as one layer as big as the screen: a deep sky full of stars, the moon, and
  // the land far below (the castle grounds, or mountains)
  nightView(land) {
    const { w, h, k } = this;
    const c = layer(w, h);
    const q = c.getContext('2d');
    const top = Math.min(...this.wins.map((W) => W.y0));
    const bot = Math.max(...this.wins.map((W) => W.y1));
    const hy = lerp(top, bot, land === 'mountains' ? 0.64 : 0.74);
    this.horizon = hy;
    q.fillStyle = vgrad(q, top, hy, [
      [0, '#070c22'],
      [0.6, '#13204a'],
      [1, '#2c3f72'],
    ]);
    q.fillRect(0, 0, w, h);
    let s = 7;
    const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    // the milky way, a faint band across the sky
    q.save();
    q.translate(w * 0.5, (top + hy) / 2);
    q.rotate(-0.5);
    for (let i = 0; i < 60; i++) {
      q.fillStyle = `rgba(190,200,255,${0.006 + r() * 0.012})`;
      q.beginPath();
      q.ellipse((r() - 0.5) * w * 1.6, (r() - 0.5) * 0.06 * k, (0.04 + r() * 0.08) * k, (0.012 + r() * 0.02) * k, 0, 0, TAU);
      q.fill();
    }
    q.restore();
    const n = Math.round((w * (hy - top)) / (0.0009 * k * k));
    for (let i = 0; i < n; i++) {
      const x = r() * w;
      const y = top + Math.pow(r(), 1.3) * (hy - top);
      const sz = Math.max(0.6, (0.4 + Math.pow(r(), 3) * 1.6) * this.dpr);
      q.fillStyle = `rgba(${r() < 0.2 ? '255,230,200' : '225,232,255'},${0.35 + r() * 0.6})`;
      q.fillRect(x, y, sz, sz);
    }
    // bright stars that twinkle (drawn live)
    this.stars = Array.from({ length: Math.round(n / 12) }, () => ({ x: r() * w, y: top + Math.pow(r(), 1.2) * (hy - top) * 0.92, s: (0.8 + r() * 1.2) * this.dpr, ph: r() * TAU, f: 0.6 + r() * 2 }));
    // the moon, in the window nearest the middle, high up
    const mid = this.wins.reduce((a, b) => (Math.abs(b.th - 0.15) < Math.abs(a.th - 0.15) ? b : a));
    const mr = Math.min(mid.hw * 0.42, 0.03 * k);
    this.moon = { x: mid.x + mid.hw * 0.35, y: lerp(mid.ys, hy, 0.2), r: mr };
    const M = this.moon;
    const halo = q.createRadialGradient(M.x, M.y, mr, M.x, M.y, mr * 6);
    halo.addColorStop(0, 'rgba(200,215,255,0.25)');
    halo.addColorStop(1, 'rgba(200,215,255,0)');
    q.fillStyle = halo;
    q.fillRect(M.x - mr * 6, M.y - mr * 6, mr * 12, mr * 12);
    q.fillStyle = '#f2eedc';
    q.beginPath();
    q.arc(M.x, M.y, mr, 0, TAU);
    q.fill();
    q.fillStyle = 'rgba(160,160,150,0.25)';
    for (const [dx, dy, rr] of [
      [-0.3, -0.2, 0.22],
      [0.25, 0.1, 0.16],
      [-0.05, 0.35, 0.12],
    ]) {
      q.beginPath();
      q.arc(M.x + dx * mr, M.y + dy * mr, rr * mr, 0, TAU);
      q.fill();
    }
    if (land === 'mountains') {
      // jagged peaks, snow on their shoulders catching the moon, a dark ridge in front
      const peaks = (base, amp, col, snow, seed, n2) => {
        let s2 = seed;
        const r2 = () => (s2 = (s2 * 9301 + 49297) % 233280) / 233280;
        const pts = [];
        for (let x = -w * 0.05, i = 0; x < w * 1.05; i++) {
          pts.push([x, base - amp * (0.35 + r2() * 0.65)]);
          x += (w / n2) * (0.5 + r2() * 0.5);
          pts.push([x, base - amp * (0.05 + r2() * 0.25)]);
          x += (w / n2) * (0.3 + r2() * 0.4);
        }
        q.fillStyle = col;
        q.beginPath();
        q.moveTo(-10, h);
        for (const p of pts) q.lineTo(...p);
        q.lineTo(w + 10, h);
        q.closePath();
        q.fill();
        if (snow) {
          for (let i = 0; i < pts.length - 1; i++) {
            const [x, y] = pts[i];
            if (y > base - amp * 0.45) continue;
            const depth = (base - y) * 0.3;
            const [xl, yl] = pts[i - 1] || [x - 10, y + 10];
            const [xr, yr] = pts[i + 1];
            const fl = depth / Math.max(1, yl - y);
            const fr = depth / Math.max(1, yr - y);
            q.fillStyle = snow;
            q.beginPath();
            q.moveTo(x, y);
            q.lineTo(x + (xr - x) * fr, y + depth);
            q.lineTo(x + (xr - x) * fr * 0.55, y + depth * 0.7);
            q.lineTo(x, y + depth * 0.95);
            q.lineTo(x + (xl - x) * fl * 0.5, y + depth * 0.8);
            q.lineTo(x + (xl - x) * fl, y + depth);
            q.closePath();
            q.fill();
          }
        }
      };
      peaks(hy - 0.02 * k, 0.16 * k, '#34436e', 'rgba(205,218,245,0.85)', 3, 5);
      peaks(hy + 0.02 * k, 0.1 * k, '#202b4e', 'rgba(170,185,225,0.55)', 9, 7);
      treeline(q, w, hy + 0.04 * k, 0.03 * k, '#0d1428', 'pine', 5);
      q.fillStyle = '#0d1428';
      q.fillRect(0, hy + 0.06 * k, w, h);
    } else {
      // far hills and the forest, the lake in front with the moon on it, the dark lawns
      hills(q, w, hy - 0.005 * k, 0.05 * k, '#1d2850', 3, 0.7);
      treeline(q, w, hy - 0.01 * k, 0.035 * k, '#0b1226', 'pine', 3);
      q.fillStyle = '#0b1226';
      q.fillRect(0, hy + 0.02 * k, w, 0.01 * k);
      q.fillStyle = vgrad(q, hy + 0.025 * k, hy + 0.055 * k, [
        [0, '#2c3c70'],
        [1, '#1a2550'],
      ]);
      q.fillRect(0, hy + 0.025 * k, w, 0.03 * k);
      q.fillStyle = 'rgba(240,235,210,0.4)';
      for (let i = 0; i < 9; i++) {
        const yy = hy + 0.027 * k + i * 0.003 * k;
        const ww = M.r * (1.8 - i * 0.12) * (0.6 + r() * 0.6);
        q.fillRect(M.x - ww / 2 + (r() - 0.5) * M.r * 0.4, yy, ww, Math.max(1, 0.0012 * k));
      }
      hills(q, w, hy + 0.06 * k, 0.012 * k, '#101830', 2, 2.1);
      q.fillStyle = '#101830';
      q.fillRect(0, hy + 0.06 * k, w, h);
      // a hut at the forest's edge, its window lit
      const hx = this.wins[0].x - this.wins[0].hw * 0.3;
      const hY = hy + 0.022 * k;
      q.fillStyle = '#0b1226';
      q.beginPath();
      q.moveTo(hx - 0.012 * k, hY);
      q.lineTo(hx - 0.012 * k, hY - 0.01 * k);
      q.lineTo(hx, hY - 0.02 * k);
      q.lineTo(hx + 0.012 * k, hY - 0.01 * k);
      q.lineTo(hx + 0.012 * k, hY);
      q.fill();
      this.hut = { x: hx + 0.004 * k, y: hY - 0.007 * k };
    }
    return c;
  }

  // rain on the windows if the rain's up (it never is to start with): the stars go, the sky greys
  rainTarget() {
    const lv = this.engine.scene?.layers?.get('rain')?.level ?? 0;
    return clamp(lv / 0.4, 0, 1);
  }

  // the night through the glass: the view, twinkling stars, the hut's window, rain if it's raining
  drawView(g, dt) {
    const { t, k, w } = this;
    this.rk += (this.rainTarget() - this.rk) * Math.min(1, dt * 0.6);
    const rk = this.rk;
    g.save();
    g.clip(this.glass);
    g.drawImage(this.view, 0, 0);
    if (rk < 0.99) {
      for (const s of this.stars) {
        const a = (0.55 + 0.45 * Math.sin(t * s.f + s.ph)) * (1 - rk);
        g.fillStyle = `rgba(240,244,255,${a})`;
        g.fillRect(s.x - s.s / 2, s.y - s.s / 2, s.s, s.s);
        if (s.s > 1.6 * this.dpr) {
          g.fillStyle = `rgba(220,230,255,${a * 0.25})`;
          g.fillRect(s.x - s.s * 1.5, s.y - s.s * 0.15, s.s * 3, s.s * 0.3);
          g.fillRect(s.x - s.s * 0.15, s.y - s.s * 1.5, s.s * 0.3, s.s * 3);
        }
      }
    }
    if (this.hut) {
      const a = 0.75 + 0.15 * Math.sin(t * 0.9) + 0.1 * Math.sin(t * 2.3);
      g.fillStyle = `rgba(255,190,90,${a})`;
      g.fillRect(this.hut.x - 0.002 * k, this.hut.y - 0.002 * k, 0.004 * k, 0.004 * k);
    }
    // a shooting star now and then
    if (!this.meteor && rk < 0.3 && Math.random() < dt / 70) {
      const W = this.wins[Math.floor(Math.random() * this.wins.length)];
      this.meteor = { x: W.x + rand(-1, 1) * W.hw, y: lerp(W.y0, this.horizon, rand(0.1, 0.4)), t0: t, dx: rand(0.5, 1) * (Math.random() < 0.5 ? -1 : 1), len: rand(0.05, 0.1) * k };
    }
    const m = this.meteor;
    if (m) {
      const p = (t - m.t0) / 0.9;
      if (p >= 1) this.meteor = null;
      else {
        const hx = m.x + m.dx * m.len * 2 * p;
        const hyy = m.y + m.len * p;
        const gr = g.createLinearGradient(hx, hyy, hx - m.dx * m.len, hyy - m.len * 0.5);
        gr.addColorStop(0, `rgba(255,255,240,${0.9 * Math.sin(p * Math.PI)})`);
        gr.addColorStop(1, 'rgba(255,255,240,0)');
        g.strokeStyle = gr;
        g.lineWidth = Math.max(1, 0.0016 * k);
        g.beginPath();
        g.moveTo(hx, hyy);
        g.lineTo(hx - m.dx * m.len, hyy - m.len * 0.5);
        g.stroke();
      }
    }
    if (rk > 0.01) {
      g.fillStyle = `rgba(40,46,60,${0.75 * rk})`;
      g.fillRect(0, 0, w, this.h);
      g.strokeStyle = `rgba(200,210,230,${0.3 * rk})`;
      g.lineWidth = Math.max(1, this.dpr * 0.8);
      g.beginPath();
      for (const W of this.wins) {
        const n = Math.round(30 * rk);
        for (let i = 0; i < n; i++) {
          const fx = ((i * 0.618 + t * 0.05 * (1 + (i % 3))) % 1) * 2 - 1;
          const fy = (i * 0.37 + t * (1.2 + (i % 5) * 0.15)) % 1;
          const x = W.x + fx * W.hw;
          const y = W.y0 + fy * (W.y1 - W.y0);
          g.moveTo(x, y);
          g.lineTo(x - W.hw * 0.03, y + 0.025 * k);
        }
      }
      g.stroke();
      // drops on the glass, some running down
      if (this.drops.length < 50 * rk && Math.random() < dt * 10 * rk) {
        const W = this.wins[Math.floor(Math.random() * this.wins.length)];
        this.drops.push({ x: W.x + rand(-1, 1) * W.hw, y: rand(W.y0, W.y1), r: rand(0.002, 0.005) * k, v: Math.random() < 0.3 ? rand(0.01, 0.04) * k : 0, life: rand(6, 16), age: 0 });
      }
    }
    this.drops = this.drops.filter((d) => (d.age += dt) < d.life);
    for (const d of this.drops) {
      d.y += d.v * dt;
      const a = Math.min(1, d.age * 2, (d.life - d.age) * 0.5) * Math.max(rk, 0.2);
      g.fillStyle = `rgba(20,24,34,${0.3 * a})`;
      g.beginPath();
      g.ellipse(d.x, d.y + d.r * 0.15, d.r, d.r * 1.15, 0, 0, TAU);
      g.fill();
      g.fillStyle = `rgba(220,230,250,${0.45 * a})`;
      g.beginPath();
      g.arc(d.x - d.r * 0.3, d.y - d.r * 0.35, d.r * 0.35, 0, TAU);
      g.fill();
    }
    g.restore();
  }

  // a stone fireplace near us on the left: F = { x0, x1, mantel } (the surround and the top of
  // the mantel shelf), mo = the opening; c holds its colours. The chimney breast goes up into the
  // dark, narrowing; things for the shelf are drawn by the caller on top.
  fireplace(g, F, mo, c) {
    const { k, h } = this;
    const hb = mo.y1;
    // the chimney breast
    const cb = { x0: F.x0 + (F.x1 - F.x0) * 0.08, x1: F.x1 - (F.x1 - F.x0) * 0.08 };
    const sg = g.createLinearGradient(cb.x0, 0, cb.x1, 0);
    sg.addColorStop(0, c.dark);
    sg.addColorStop(0.55, c.stone);
    sg.addColorStop(1, c.dark);
    // it goes up into the dark, or (top) ends at the cornice
    const top = c.top ?? -2;
    g.fillStyle = sg;
    g.fillRect(cb.x0, top, cb.x1 - cb.x0, F.mantel - top + 4);
    g.save();
    g.beginPath();
    g.rect(cb.x0, top, cb.x1 - cb.x0, F.mantel - top + 4);
    g.clip();
    const bh = 0.04 * k;
    g.strokeStyle = c.joint;
    g.lineWidth = Math.max(1, 0.002 * k);
    for (let y = F.mantel, row = 0; y > -bh; y -= bh, row++) {
      g.beginPath();
      g.moveTo(cb.x0, y);
      g.lineTo(cb.x1, y);
      for (let x = cb.x0 + (row % 2 ? 0.05 : 0.02) * k; x < cb.x1; x += 0.07 * k) {
        g.moveTo(x, y);
        g.lineTo(x, y - bh);
      }
      g.stroke();
    }
    g.fillStyle = vgrad(g, top, top + h * 0.25, [
      [0, 'rgba(0,0,0,0.55)'],
      [1, 'rgba(0,0,0,0)'],
    ]);
    g.fillRect(cb.x0, top, cb.x1 - cb.x0, h * 0.25);
    g.restore();
    if (c.top != null) {
      g.fillStyle = c.edge;
      g.fillRect(cb.x0 - 0.01 * k, top - 0.012 * k, cb.x1 - cb.x0 + 0.02 * k, 0.014 * k);
      g.fillStyle = c.dark;
      g.fillRect(cb.x0 - 0.01 * k, top + 0.002 * k, cb.x1 - cb.x0 + 0.02 * k, 0.004 * k);
    }
    // the surround: big dressed stones round the opening
    g.fillStyle = c.stone;
    g.fillRect(F.x0, F.mantel, F.x1 - F.x0, hb - F.mantel);
    g.strokeStyle = c.joint;
    g.lineWidth = Math.max(1, 0.002 * k);
    g.beginPath();
    for (let y = F.mantel + 0.045 * k; y < hb; y += 0.045 * k) {
      g.moveTo(F.x0, y);
      g.lineTo(mo.x0, y);
      g.moveTo(mo.x1, y);
      g.lineTo(F.x1, y);
    }
    g.stroke();
    // the opening: a low four-centred arch with a keystone, dark inside
    this.mouth = mo;
    const mp = new Path2D();
    const mw = mo.x1 - mo.x0;
    mp.moveTo(mo.x0, mo.y1);
    mp.lineTo(mo.x0, mo.y0 + mw * 0.16);
    mp.quadraticCurveTo(mo.x0, mo.y0, mo.x0 + mw * 0.25, mo.y0 - mw * 0.02);
    mp.lineTo(mo.x1 - mw * 0.25, mo.y0 - mw * 0.02);
    mp.quadraticCurveTo(mo.x1, mo.y0, mo.x1, mo.y0 + mw * 0.16);
    mp.lineTo(mo.x1, mo.y1);
    mp.closePath();
    this.mouthPath = mp;
    g.strokeStyle = c.lit;
    g.lineWidth = 0.02 * k;
    g.stroke(mp);
    const mg = g.createLinearGradient(0, mo.y0, 0, mo.y1);
    mg.addColorStop(0, '#080403');
    mg.addColorStop(1, '#26100a');
    g.fillStyle = mg;
    g.fill(mp);
    // soot up the back, a grate
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(mo.x0 + mw * 0.15, mo.y0, mw * 0.7, (mo.y1 - mo.y0) * 0.5);
    g.strokeStyle = '#1a1210';
    g.lineWidth = Math.max(2, 0.006 * k);
    g.beginPath();
    g.moveTo(mo.x0 + mw * 0.12, hb - 0.012 * k);
    g.lineTo(mo.x1 - mw * 0.12, hb - 0.012 * k);
    for (let i = 0; i <= 6; i++) {
      const x = lerp(mo.x0 + mw * 0.14, mo.x1 - mw * 0.14, i / 6);
      g.moveTo(x, hb - 0.012 * k);
      g.lineTo(x, hb - 0.03 * k);
    }
    g.stroke();
    // the mantel shelf, a moulded beam of stone on corbels
    g.fillStyle = c.lit;
    g.fillRect(F.x0 - 0.02 * k, F.mantel - 0.03 * k, F.x1 - F.x0 + 0.04 * k, 0.03 * k);
    g.fillStyle = c.edge;
    g.fillRect(F.x0 - 0.02 * k, F.mantel - 0.03 * k, F.x1 - F.x0 + 0.04 * k, 0.004 * k);
    g.fillStyle = c.dark;
    g.fillRect(F.x0 - 0.02 * k, F.mantel - 0.005 * k, F.x1 - F.x0 + 0.04 * k, 0.005 * k);
    for (const x of [F.x0 + 0.01 * k, F.x1 - 0.04 * k]) {
      g.fillStyle = c.lit;
      g.beginPath();
      g.moveTo(x, F.mantel);
      g.lineTo(x + 0.03 * k, F.mantel);
      g.lineTo(x + 0.024 * k, F.mantel + 0.035 * k);
      g.lineTo(x + 0.006 * k, F.mantel + 0.035 * k);
      g.fill();
    }
    // the hearthstone
    g.fillStyle = c.hearth;
    g.fillRect(F.x0 - 0.02 * k, hb, F.x1 - F.x0 + 0.06 * k, 0.022 * k);
    g.fillStyle = 'rgba(255,220,170,0.15)';
    g.fillRect(F.x0 - 0.02 * k, hb, F.x1 - F.x0 + 0.06 * k, 0.003 * k);
    this.shelf = F.mantel - 0.03 * k;
  }

  // a candle standing at (x, y), ch tall; its flame is drawn live
  candle(g, x, y, ch, col = '#efe4c8') {
    const { k } = this;
    g.fillStyle = col;
    g.fillRect(x - 0.0055 * k, y - ch, 0.011 * k, ch);
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.fillRect(x - 0.0045 * k, y - ch, 0.003 * k, ch);
    (this.candles ||= []).push([x, y - ch]);
  }
  // a brass candlestick with its candle
  candlestick(g, x, y, ch, brass = '#c89a40') {
    const { k } = this;
    g.fillStyle = brass;
    g.beginPath();
    g.ellipse(x, y - 0.003 * k, 0.014 * k, 0.004 * k, 0, 0, TAU);
    g.fill();
    g.fillRect(x - 0.003 * k, y - 0.03 * k, 0.006 * k, 0.028 * k);
    g.beginPath();
    g.ellipse(x, y - 0.03 * k, 0.009 * k, 0.003 * k, 0, 0, TAU);
    g.fill();
    this.candle(g, x, y - 0.03 * k, ch);
  }

  // a round rug: rings of colour from the outside in
  rugAt(g, rug, rings) {
    rings.forEach((col, i) => {
      const f = 1 - i / rings.length;
      g.fillStyle = col;
      g.beginPath();
      g.ellipse(rug.x, rug.y, rug.rx * f, rug.ry * f, 0, 0, TAU);
      g.fill();
    });
  }

  // how bright the fire is, from its slider, with a flicker
  fireLevel() {
    const fireOn = this.engine.scene?.layers?.get('fire')?.level ?? 0.6;
    const lvl = clamp(fireOn * 1.6, 0.25, 1);
    const t = this.t;
    return { lvl, flick: (0.78 + 0.12 * Math.sin(t * 7.3) * Math.sin(t * 3.1) + 0.1 * Math.sin(t * 13.7)) * lvl };
  }
  // firelight on the room, candle glows, the flames and the candle flames
  lights(g, warmth = 0.5) {
    const { t } = this;
    const { lvl, flick } = this.fireLevel();
    const mo = this.mouth;
    const mw = mo.x1 - mo.x0;
    const mh = mo.y1 - mo.y0;
    const fx = (mo.x0 + mo.x1) / 2;
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = warmth * flick;
    g.drawImage(this.fireGlow, fx - mw * 2, mo.y1 - mh * 2, mw * 4, mh * 3.2);
    for (const [cx, cy] of this.candles || []) {
      g.globalAlpha = 0.35 + 0.05 * Math.sin(t * 9 + cx);
      g.drawImage(this.glow, cx - mw * 0.15, cy - mw * 0.17, mw * 0.3, mw * 0.3);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    for (const [cx, cy] of this.candles || []) {
      g.fillStyle = 'rgba(255,220,150,0.95)';
      g.beginPath();
      g.ellipse(cx, cy - mw * 0.02, mw * 0.008, mw * 0.022 * (1 + 0.1 * Math.sin(t * 11 + cx)), 0, 0, TAU);
      g.fill();
    }
    hearthFire(g, mo, this.mouthPath, this.glow, t, lvl, flick);
  }

  // the sprites every tower room uses
  sprites() {
    this.glow = glowSprite([
      [0, 'rgba(255,200,130,0.85)'],
      [0.3, 'rgba(255,150,70,0.3)'],
      [1, 'rgba(255,120,50,0)'],
    ]);
    this.fireGlow = glowSprite([
      [0, 'rgba(255,140,50,0.75)'],
      [0.35, 'rgba(230,90,30,0.25)'],
      [1, 'rgba(200,60,20,0)'],
    ]);
    this.cats = catPileSprites(0.105 * this.k);
    this.rk = this.rainTarget();
    this.drops = [];
    this.meteor = null;
    this.flip = null;
  }
  event(e) {
    if (e.type === 'shot' && e.layer === 'pages') this.at(e.at, () => (this.flip = { t0: this.t }));
  }
  // set up the room's size and its random numbers
  begin(seed) {
    const { w, h } = this;
    this.k = Math.min(w * 2, h);
    let s = seed;
    this.r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    this.R = (a, b) => a + this.r() * (b - a);
    this.grain = grainLayer(w, h);
    this.room = layer(w, h);
    this.front = layer(w, h);
    this.hb = h * 0.8; // the controls cover the bottom of the screen
    this.candles = [];
  }
}

// ---------------------------------------------------------------------------------------------
// A common room at the top of a tower, in scarlet and gold: a great stone fireplace roaring away,
// scarlet hangings on the walls, squashy armchairs, tall windows onto the grounds at night (the
// forest, the lake with the moon on it, a light in a hut at the forest's edge), the cats asleep on
// the hearthrug, and a game of chess left going on a low table, whose pieces move by themselves.

// a scarlet hanging with a gold border and a gold device, hung from a rod at (x, y0) to y1
function hanging(g, x, y0, y1, hw, k, c) {
  const p = new Path2D();
  p.moveTo(x - hw, y0);
  p.lineTo(x + hw, y0);
  p.lineTo(x + hw, y1);
  p.lineTo(x, y1 + hw * 0.5);
  p.lineTo(x - hw, y1);
  p.closePath();
  const fg = g.createLinearGradient(x - hw, 0, x + hw, 0);
  for (let i = 0; i <= 6; i++) fg.addColorStop(i / 6, i % 2 ? c.cloth : c.fold);
  g.fillStyle = fg;
  g.fill(p);
  // the border
  g.save();
  g.clip(p);
  g.strokeStyle = c.gold;
  g.lineWidth = hw * 0.1;
  g.stroke(p);
  g.restore();
  g.strokeStyle = c.gold;
  g.lineWidth = Math.max(1, hw * 0.025);
  g.beginPath();
  g.moveTo(x - hw * 0.72, y0 + hw * 0.25);
  g.lineTo(x + hw * 0.72, y0 + hw * 0.25);
  g.lineTo(x + hw * 0.72, y1 - hw * 0.05);
  g.lineTo(x, y1 + hw * 0.3);
  g.lineTo(x - hw * 0.72, y1 - hw * 0.05);
  g.closePath();
  g.stroke();
  // a gold shield with a band across it, and a star over it
  const sy = lerp(y0, y1, 0.45);
  const sw = hw * 0.55;
  const sh = sw * 1.25;
  const sp = new Path2D();
  sp.moveTo(x - sw, sy - sh * 0.5);
  sp.lineTo(x + sw, sy - sh * 0.5);
  sp.lineTo(x + sw, sy);
  sp.quadraticCurveTo(x + sw, sy + sh * 0.45, x, sy + sh * 0.7);
  sp.quadraticCurveTo(x - sw, sy + sh * 0.45, x - sw, sy);
  sp.closePath();
  g.fillStyle = c.gold;
  g.fill(sp);
  g.save();
  g.clip(sp);
  g.fillStyle = c.cloth;
  g.beginPath();
  g.moveTo(x - sw * 1.2, sy - sh * 0.1);
  g.lineTo(x - sw * 1.2, sy + sh * 0.25);
  g.lineTo(x + sw * 1.2, sy - sh * 0.45);
  g.lineTo(x + sw * 1.2, sy - sh * 0.8);
  g.fill();
  g.restore();
  g.fillStyle = c.gold;
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = (i % 2 ? 0.42 : 1) * hw * 0.22;
    g.lineTo(x + Math.cos(a) * rr, sy - sh * 0.95 + Math.sin(a) * rr);
  }
  g.fill();
  // the rod, its finials, and tassels at the point
  g.fillStyle = c.gold;
  g.fillRect(x - hw * 1.2, y0 - hw * 0.06, hw * 2.4, hw * 0.12);
  for (const s of [-1, 1]) {
    g.beginPath();
    g.arc(x + s * hw * 1.25, y0, hw * 0.1, 0, TAU);
    g.fill();
  }
  g.strokeStyle = c.gold;
  g.lineWidth = Math.max(1, hw * 0.03);
  g.beginPath();
  g.moveTo(x, y1 + hw * 0.5);
  g.lineTo(x, y1 + hw * 0.75);
  g.stroke();
  g.beginPath();
  g.ellipse(x, y1 + hw * 0.85, hw * 0.06, hw * 0.13, 0, 0, TAU);
  g.fill();
}

// a chess piece standing at (x, y), s tall: kind is p, r, n, b, q or k
function chessPiece(g, x, y, s, kind, col, rim) {
  g.fillStyle = col;
  g.strokeStyle = rim;
  g.lineWidth = Math.max(1, s * 0.05);
  g.beginPath();
  g.ellipse(x, y - s * 0.06, s * 0.3, s * 0.08, 0, 0, TAU);
  g.fill();
  g.stroke();
  const body = new Path2D();
  const top = kind === 'p' ? 0.62 : kind === 'k' || kind === 'q' ? 1 : 0.85;
  body.moveTo(x - s * 0.22, y - s * 0.1);
  body.quadraticCurveTo(x - s * 0.08, y - s * 0.35, x - s * 0.1, y - s * top * 0.75);
  body.lineTo(x + s * 0.1, y - s * top * 0.75);
  body.quadraticCurveTo(x + s * 0.08, y - s * 0.35, x + s * 0.22, y - s * 0.1);
  body.closePath();
  g.fill(body);
  g.stroke(body);
  const hy = y - s * top * 0.8;
  g.beginPath();
  if (kind === 'p') g.arc(x, hy, s * 0.14, 0, TAU);
  else if (kind === 'r') g.rect(x - s * 0.16, hy - s * 0.18, s * 0.32, s * 0.2);
  else if (kind === 'n') {
    g.moveTo(x - s * 0.12, hy + s * 0.04);
    g.lineTo(x - s * 0.1, hy - s * 0.2);
    g.lineTo(x + s * 0.18, hy - s * 0.1);
    g.lineTo(x + s * 0.06, hy - s * 0.03);
    g.lineTo(x + s * 0.12, hy + s * 0.04);
  } else if (kind === 'b') g.ellipse(x, hy - s * 0.06, s * 0.1, s * 0.16, 0, 0, TAU);
  else {
    g.arc(x, hy - s * 0.04, s * 0.15, 0, TAU);
    if (kind === 'k') {
      g.rect(x - s * 0.025, hy - s * 0.32, s * 0.05, s * 0.16);
      g.rect(x - s * 0.08, hy - s * 0.27, s * 0.16, s * 0.045);
    }
  }
  g.fill();
  g.stroke();
}

class Den extends TowerRoom {
  build() {
    this.begin(17);
    const { w, h, k, hb } = this;
    this.shape(0.1, 0.06, 0.6, 0.08);
    const C = { cloth: '#9a1c1c', fold: '#6e1014', gold: '#d9a23a', pale: '#f2c766' };
    let g = this.room.getContext('2d');
    this.beams(g, '#0a0605', '#20140c', '#120a06', 'rgba(255,170,100,0.07)');
    this.stones(g, ['#2a1f18', '#4e3e30', '#6a5442', '#34281e'], 0.034, 0.075);

    // where the fireplace goes, so the windows can keep clear of its chimney
    const F = { x0: -0.03 * k, x1: 0.34 * k, mantel: hb - 0.27 * k };
    const mo = { x0: 0.045 * k, x1: 0.265 * k, y0: hb - 0.2 * k, y1: hb };
    const xmin = F.x1 + 0.07 * k;
    const xmax = w - 0.09 * k;
    const N = clamp(Math.round((xmax - xmin) / (0.34 * k)) || 1, 1, 3);
    const xs = N === 1 ? [Math.max(xmin, (xmin + xmax) / 2)] : Array.from({ length: N }, (_, i) => lerp(xmin, xmax, i / (N - 1)));
    this.lancets(g, xs.map(this.TH), { hw: 0.06 * k, top: 0.07 * k, foot: 0.09 * k, reveal: 0.014, surround: '#33261c', revealLit: '#6e5844', revealDark: '#22180f', sill: '#7a6450', lead: 'rgba(30,20,12,0.4)', bar: '#1c130c' });
    this.view = this.nightView('grounds');

    // scarlet hangings between the windows and on either side of them
    const gaps = [];
    for (let i = 0; i < N - 1; i++) gaps.push((this.wins[i].x + this.wins[i + 1].x) / 2);
    if (N > 1 && this.wins[N - 1].x + 0.2 * k < w) gaps.push(this.wins[N - 1].x + (this.wins[N - 1].x - gaps[gaps.length - 1]));
    for (const x of gaps) {
      const th = this.TH(x);
      const y0 = this.ceilY(x) + 0.05 * k;
      hanging(g, x, y0, y0 + 0.3 * k, 0.045 * k * Math.cos(th), k, C);
    }

    // the night in the room: dark away from the fire, deepest up in the corners
    this.noGlass(g);
    const dk = g.createRadialGradient(F.x1 * 0.5, hb, 0.1 * k, F.x1 * 0.5, hb, Math.max(w, h) * 0.95);
    dk.addColorStop(0, 'rgba(8,4,10,0)');
    dk.addColorStop(1, 'rgba(8,4,10,0.55)');
    g.fillStyle = dk;
    g.fillRect(0, 0, w, h);
    // moonlight falling from each window onto the floor
    for (const W of this.wins) {
      const mg = g.createLinearGradient(0, W.y1, 0, W.y1 + 0.3 * k);
      mg.addColorStop(0, 'rgba(150,170,230,0.08)');
      mg.addColorStop(1, 'rgba(150,170,230,0)');
      g.fillStyle = mg;
      g.beginPath();
      g.moveTo(W.x - W.hw, W.y1);
      g.lineTo(W.x + W.hw, W.y1);
      g.lineTo(W.x + W.hw * 2.2, W.y1 + 0.3 * k);
      g.lineTo(W.x - W.hw * 0.2, W.y1 + 0.3 * k);
      g.fill();
    }
    g.restore();

    this.boards(g, '#2a1a10', '#4a2e1a', 'rgba(10,5,2,0.4)');
    this.fireplace(g, F, mo, { stone: '#6a5848', lit: '#8a7660', edge: '#b09a80', dark: '#3a2e24', joint: 'rgba(20,12,8,0.45)', hearth: '#4e3e32' });
    // a hanging over the fire, and on the shelf: candlesticks, a gold cup, books, a clock
    {
      const cx = (F.x0 + F.x1) / 2;
      const y0 = Math.max(this.ceilY(cx) + 0.05 * k, F.mantel - 0.62 * k);
      hanging(g, cx, y0, Math.min(y0 + 0.3 * k, F.mantel - 0.13 * k), 0.06 * k, k, C);
      const top = this.shelf;
      this.candlestick(g, F.x0 + 0.04 * k, top, 0.05 * k);
      this.candlestick(g, F.x1 - 0.03 * k, top, 0.04 * k);
      // the cup, two handles
      const ux = F.x0 + 0.24 * k;
      const ug = g.createLinearGradient(ux - 0.022 * k, 0, ux + 0.022 * k, 0);
      ug.addColorStop(0, '#8a5e18');
      ug.addColorStop(0.35, '#f6d478');
      ug.addColorStop(1, '#9a6a1c');
      g.fillStyle = ug;
      g.beginPath();
      g.moveTo(ux - 0.012 * k, top);
      g.lineTo(ux + 0.012 * k, top);
      g.lineTo(ux + 0.004 * k, top - 0.012 * k);
      g.lineTo(ux + 0.004 * k, top - 0.022 * k);
      g.quadraticCurveTo(ux + 0.022 * k, top - 0.03 * k, ux + 0.02 * k, top - 0.055 * k);
      g.lineTo(ux - 0.02 * k, top - 0.055 * k);
      g.quadraticCurveTo(ux - 0.022 * k, top - 0.03 * k, ux - 0.004 * k, top - 0.022 * k);
      g.lineTo(ux - 0.004 * k, top - 0.012 * k);
      g.closePath();
      g.fill();
      g.strokeStyle = '#d9a23a';
      g.lineWidth = Math.max(1.5, 0.004 * k);
      for (const s of [-1, 1]) {
        g.beginPath();
        g.ellipse(ux + s * 0.024 * k, top - 0.042 * k, 0.008 * k, 0.01 * k, 0, s < 0 ? Math.PI * 0.5 : -Math.PI * 0.5, s < 0 ? Math.PI * 1.5 : Math.PI * 0.5);
        g.stroke();
      }
      bookStack(g, F.x0 + 0.14 * k, top, k, [
        [0.06, '#5a1a14'],
        [0.052, '#2a3a5a'],
        [0.056, '#7a5a20'],
      ]);
    }

    // the hearthrug, scarlet and gold
    const rug = { x: Math.min(F.x1 + 0.06 * k, w * 0.4), y: hb + 0.065 * k, rx: 0.21 * k, ry: 0.047 * k };
    this.rug = rug;
    this.rugAt(g, rug, ['#3a0a0c', '#d9a23a', '#8e1b1b', '#f0d27a', '#8e1b1b', '#d9a23a', '#6a1214']);

    // the table near us on the right: an open book, a mug of cocoa, ink and a quill
    const tb = { x: w - 0.12 * k, y: Math.min(h - 0.07 * k, h * 0.85), rx: 0.13 * k, ry: 0.032 * k };
    // on a wide screen, a squashy scarlet armchair turned to the fire, and the chess game on a stool
    const free = tb.x - tb.rx - (rug.x + rug.rx);
    if (free > 0.2 * k) {
      const cx = rug.x + rug.rx + free * 0.45;
      armchair(g, cx, hb + 0.035 * k, 0.16 * k, 0.2 * k, { lit: '#a82420', mid: '#7a1618', dark: '#420a0c', line: '#220606', legs: '#2a1810', trim: '#b88a30' }, k);
    }
    this.chess = null;
    if (free > 0.45 * k) {
      // a low table with the board on it, between the rug and the armchair
      const cx = rug.x + rug.rx + free * 0.06 + 0.1 * k;
      const cy = hb + 0.03 * k;
      g.fillStyle = '#2a1810';
      g.fillRect(cx - 0.08 * k, cy, 0.01 * k, 0.09 * k);
      g.fillRect(cx + 0.07 * k, cy, 0.01 * k, 0.09 * k);
      g.fillStyle = '#5a3a20';
      g.fillRect(cx - 0.1 * k, cy - 0.008 * k, 0.2 * k, 0.016 * k);
      g.fillStyle = '#3a2414';
      g.fillRect(cx - 0.1 * k, cy + 0.008 * k, 0.2 * k, 0.006 * k);
      this.chess = { x: cx, y: cy - 0.006 * k, bw: 0.17 * k, bd: 0.045 * k };
      const B = this.chess;
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          const [a, b] = [this.square(i, j, 0, 0), this.square(i, j, 1, 1)];
          g.fillStyle = (i + j) % 2 ? '#e8d4a8' : '#3a2416';
          g.beginPath();
          g.moveTo(...this.square(i, j, 0, 0));
          g.lineTo(...this.square(i, j, 1, 0));
          g.lineTo(...b);
          g.lineTo(...this.square(i, j, 0, 1));
          g.fill();
          void a;
        }
      }
      void B;
      // a game in the middle of play: [file, rank, kind, white?]
      this.pieces = [
        [0, 0, 'r', 1], [4, 0, 'k', 1], [5, 1, 'p', 1], [6, 1, 'p', 1], [3, 2, 'n', 1], [2, 3, 'b', 1], [4, 3, 'p', 1], [7, 0, 'r', 1], [3, 0, 'q', 1],
        [0, 7, 'r', 0], [6, 7, 'k', 0], [5, 6, 'p', 0], [6, 6, 'p', 0], [7, 5, 'p', 0], [2, 5, 'n', 0], [4, 4, 'p', 0], [3, 6, 'b', 0], [3, 7, 'q', 0],
      ].map(([f, rk, kind, white]) => ({ f, r: rk, kind, white }));
      this.move = null;
      this.nextMove = rand(20, 50);
    }

    g = this.front.getContext('2d');
    g.fillStyle = '#3a2414';
    g.fillRect(tb.x - 0.018 * k, tb.y, 0.036 * k, h - tb.y);
    g.fillStyle = '#5a3818';
    g.beginPath();
    g.ellipse(tb.x, tb.y + 0.012 * k, tb.rx, tb.ry, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#8a5a2c';
    g.beginPath();
    g.ellipse(tb.x, tb.y, tb.rx, tb.ry, 0, 0, TAU);
    g.fill();
    // a scarlet mug with a gold band
    const mug = { x: tb.x - tb.rx * 0.55, y: tb.y - tb.ry * 0.15 };
    g.fillStyle = 'rgba(20,10,5,0.35)';
    g.beginPath();
    g.ellipse(mug.x + 0.004 * k, mug.y + 0.002 * k, 0.03 * k, 0.008 * k, 0, 0, TAU);
    g.fill();
    g.strokeStyle = '#8e1b1b';
    g.lineWidth = Math.max(2, 0.006 * k);
    g.beginPath();
    g.ellipse(mug.x + 0.026 * k, mug.y - 0.025 * k, 0.011 * k, 0.014 * k, 0, -1.6, 1.6);
    g.stroke();
    const mgr = g.createLinearGradient(mug.x - 0.026 * k, 0, mug.x + 0.026 * k, 0);
    mgr.addColorStop(0, '#6a1214');
    mgr.addColorStop(0.35, '#c42a24');
    mgr.addColorStop(1, '#5a0f12');
    g.fillStyle = mgr;
    g.fillRect(mug.x - 0.024 * k, mug.y - 0.05 * k, 0.048 * k, 0.05 * k);
    g.beginPath();
    g.ellipse(mug.x, mug.y, 0.024 * k, 0.006 * k, 0, 0, Math.PI);
    g.fill();
    g.fillStyle = '#d9a23a';
    g.fillRect(mug.x - 0.024 * k, mug.y - 0.016 * k, 0.048 * k, 0.005 * k);
    g.fillStyle = '#a8442a';
    g.beginPath();
    g.ellipse(mug.x, mug.y - 0.05 * k, 0.024 * k, 0.006 * k, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#4a2410';
    g.beginPath();
    g.ellipse(mug.x, mug.y - 0.049 * k, 0.02 * k, 0.0045 * k, 0, 0, TAU);
    g.fill();
    this.cup = { x: mug.x, y: mug.y - 0.05 * k };
    inkAndQuill(g, tb.x + tb.rx * 0.72, tb.y - tb.ry * 0.3, k);
    this.book = { x: tb.x + tb.rx * 0.12, y: tb.y + tb.ry * 0.15, pw: 0.065 * k, pd: 0.03 * k };
    bookCover(g, this.book, '#7a1a16');

    printGrain(this.room, this.grain, 0.14);
    printGrain(this.front, this.grain, 0.14);
    this.sprites();
  }

  // a corner of square (i, j) of the chess board, u and v across it: the board is seen from the
  // front and above, its far rank narrower
  square(i, j, u, v) {
    const B = this.chess;
    const fy = (j + v) / 8;
    const y = B.y - B.bd * (1 - fy);
    const half = (B.bw / 2) * (0.82 + 0.18 * fy);
    return [B.x - half + ((i + u) / 8) * half * 2, y];
  }

  event(e) {
    super.event(e);
  }

  frame(dt) {
    const { g, t, k } = this;
    this.drawView(g, dt);
    g.drawImage(this.room, 0, 0);
    this.lights(g, 0.6);
    catPile(g, this.cats, this.rug, t, dt);

    // the chess pieces, now and then one sliding to a new square by itself
    if (this.chess) {
      if (!this.move && (this.nextMove -= dt) < 0) {
        const pc = this.pieces[Math.floor(Math.random() * this.pieces.length)];
        const dir = pc.white ? 1 : -1;
        const opts = [];
        for (const [df, dr] of [[0, 1], [1, 1], [-1, 1], [0, 2], [2, 1], [-2, 1], [1, 2], [-1, 2]]) {
          const f = pc.f + df;
          const r = pc.r + dr * dir;
          if (f < 0 || f > 7 || r < 0 || r > 7) continue;
          if (this.pieces.some((q) => q.f === f && q.r === r)) continue;
          opts.push([f, r]);
        }
        if (opts.length) {
          const [f, r] = opts[Math.floor(Math.random() * opts.length)];
          this.move = { pc, f0: pc.f, r0: pc.r, f, r, t0: t };
        }
        this.nextMove = rand(25, 70);
      }
      const s = this.chess.bw / 8;
      const at = (f, r) => this.square(f, r, 0.5, 0.5);
      const list = this.pieces.map((p) => {
        let [x, y] = at(p.f, p.r);
        const m = this.move;
        if (m && m.pc === p) {
          const q = clamp((t - m.t0) / 1.6, 0, 1);
          const e = q * q * (3 - 2 * q);
          const [x0, y0] = at(m.f0, m.r0);
          const [x1, y1] = at(m.f, m.r);
          x = lerp(x0, x1, e);
          y = lerp(y0, y1, e);
          if (q >= 1) {
            p.f = m.f;
            p.r = m.r;
            this.move = null;
          }
        }
        return { p, x, y };
      });
      list.sort((a, b) => a.y - b.y);
      for (const { p, x, y } of list) {
        const sc = 0.8 + 0.2 * ((y - (this.chess.y - this.chess.bd)) / this.chess.bd);
        chessPiece(g, x, y, s * 1.7 * sc, p.kind, p.white ? '#efe2c4' : '#2a1a14', p.white ? 'rgba(120,90,50,0.6)' : 'rgba(200,150,90,0.45)');
      }
    }

    g.drawImage(this.front, 0, 0);
    // steam off the cocoa
    const c = this.cup;
    const mw = 0.21 * k;
    g.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const ph = t * 0.5 + i * 2.1;
      const hgt = mw * (0.4 + 0.1 * Math.sin(ph * 0.7));
      g.strokeStyle = `rgba(255,250,240,${0.1 + 0.05 * Math.sin(ph)})`;
      g.lineWidth = Math.max(1.5, mw * 0.025);
      g.beginPath();
      g.moveTo(c.x + (i - 1) * mw * 0.04, c.y);
      g.bezierCurveTo(c.x + Math.sin(ph) * mw * 0.08, c.y - hgt * 0.35, c.x - Math.sin(ph + 1) * mw * 0.1, c.y - hgt * 0.7, c.x + Math.sin(ph + 2) * mw * 0.06, c.y - hgt);
      g.stroke();
    }
    const fl = this.flip ? t - this.flip.t0 : null;
    if (fl != null && fl > 0.9) this.flip = null;
    openBook(g, this.book, fl);
  }
}

// ---------------------------------------------------------------------------------------------
// A common room high in a tower, airy and round, in blue and bronze: a domed ceiling painted with
// stars, tall arched windows onto the mountains under the moon, blue silk at the windows stirring
// in the night air, books everywhere, a fire with a star chart over it, and the cats asleep on the
// rug. On a wide screen there are bookcases between the windows and a telescope at one of them.

// a five-pointed star, flat, centred at (x, y)
function star5(g, x, y, r) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.42 : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
}

class Eyrie extends TowerRoom {
  build() {
    this.begin(29);
    const { w, h, k, hb } = this;
    this.shape(0.24, 0.1, 0.62, 0.07);
    const C = { silk: '#2a4a9a', fold: '#18306a', lit: '#4a6cc0', bronze: '#b07a3a', pale: '#e0a868' };
    this.C = C;
    let g = this.room.getContext('2d');

    // the dome: midnight blue painted with gold stars, bronze ribs rising to a boss above us
    {
      const dome = new Path2D();
      dome.moveTo(0, -2);
      dome.lineTo(w, -2);
      dome.lineTo(w, this.ceilY(w));
      this.curve(dome, this.ceilY, w, 0);
      dome.closePath();
      const dg = g.createRadialGradient(this.vx, -h * 0.25, h * 0.05, this.vx, -h * 0.25, h * 0.6);
      dg.addColorStop(0, '#2a3c7a');
      dg.addColorStop(1, '#0c1434');
      g.fillStyle = dg;
      g.fill(dome);
      g.save();
      g.clip(dome);
      // constellations, faintly joined, and stars scattered over the rest
      this.painted = [];
      const nC = Math.round(w / (0.25 * k)) + 2;
      for (let c = 0; c < nC; c++) {
        const cx = this.R(0, w);
        const cy = this.R(0.1, 0.8) * this.ceilY(cx);
        const pts = Array.from({ length: 4 + Math.floor(this.r() * 3) }, () => [cx + this.R(-0.08, 0.08) * k, cy + this.R(-0.05, 0.05) * k]);
        g.strokeStyle = 'rgba(224,180,110,0.28)';
        g.lineWidth = Math.max(1, 0.0012 * k);
        g.beginPath();
        pts.forEach((p, i) => (i ? g.lineTo(...p) : g.moveTo(...p)));
        g.stroke();
        for (const [x, y] of pts) this.painted.push({ x, y, r: this.R(0.005, 0.009) * k, ph: this.R(0, TAU) });
      }
      for (let i = 0; i < w / (0.012 * k); i++) {
        const x = this.R(0, w);
        const y = this.R(0, 1) * this.ceilY(x);
        const big = this.r() < 0.25;
        g.fillStyle = big ? '#e8c27a' : `rgba(240,220,170,${this.R(0.4, 0.9)})`;
        if (big) this.painted.push({ x, y, r: this.R(0.004, 0.008) * k, ph: this.R(0, TAU) });
        else g.fillRect(x, y, Math.max(1, 0.002 * k), Math.max(1, 0.002 * k));
      }
      g.fillStyle = '#e8c27a';
      for (const s of this.painted) star5(g, s.x, s.y, s.r);
      // the ribs
      for (let th = -1.35; th <= 1.36; th += 0.3) {
        const x = this.X(th);
        const y = this.ceilY(x);
        const tx = this.vx + (x - this.vx) * 0.18;
        const ty = -h * 0.12;
        for (const [col, lw, dx] of [
          ['#5a3c1a', 0.012, 0],
          ['#c08a48', 0.003, -0.003],
        ]) {
          g.strokeStyle = col;
          g.lineWidth = lw * k * Math.cos(th);
          g.beginPath();
          g.moveTo(x + dx * k, y);
          g.quadraticCurveTo(x + (tx - x) * 0.15 + dx * k, (y + ty) * 0.45, tx + dx * k, ty);
          g.stroke();
        }
      }
      g.restore();
    }

    // the wall: pale stone in the blue of the night, a bronze cornice along its top
    this.stones(g, ['#3a3e52', '#5c6078', '#727892', '#4a4e64'], 0.032, 0.08);
    g.strokeStyle = C.bronze;
    g.lineWidth = 0.012 * k;
    g.beginPath();
    g.moveTo(0, this.ceilY(0));
    this.curve(g, this.ceilY, 0, w);
    g.stroke();
    g.strokeStyle = C.pale;
    g.lineWidth = Math.max(1, 0.002 * k);
    g.beginPath();
    g.moveTo(0, this.ceilY(0) - 0.004 * k);
    this.curve(g, (x) => this.ceilY(x) - 0.004 * k, 0, w);
    g.stroke();

    // the fireplace and the windows
    const F = { x0: -0.03 * k, x1: 0.32 * k, mantel: hb - 0.25 * k };
    const mo = { x0: 0.045 * k, x1: 0.245 * k, y0: hb - 0.18 * k, y1: hb };
    const xmin = F.x1 + 0.08 * k;
    const xmax = w - 0.09 * k;
    const N = clamp(Math.round((xmax - xmin) / (0.3 * k)) + 1, 1, 4);
    const xs = N === 1 ? [Math.max(xmin, (xmin + xmax) / 2)] : Array.from({ length: N }, (_, i) => lerp(xmin, xmax, i / (N - 1)));
    this.lancets(g, xs.map(this.TH), { hw: 0.07 * k, top: 0.05 * k, foot: 0.08 * k, reveal: 0.012, surround: '#2e3246', revealLit: '#7a809c', revealDark: '#262a3c', sill: '#8a90aa', lead: 'rgba(20,24,40,0.3)', bar: '#1a1e30' });
    this.view = this.nightView('mountains');

    // bookcases between the windows, where there's room
    for (let i = 0; i < N - 1; i++) {
      const a = this.wins[i];
      const b = this.wins[i + 1];
      const gapW = b.x - b.hw * 1.9 - (a.x + a.hw * 1.9);
      if (gapW < 0.1 * k) continue;
      const cx = (a.x + a.hw * 1.9 + b.x - b.hw * 1.9) / 2;
      const bw = Math.min(gapW * 0.45, 0.1 * k);
      const y1 = this.floorY(cx) + 0.01 * k;
      const y0 = y1 - 0.26 * k;
      g.fillStyle = '#2a1c10';
      g.fillRect(cx - bw, y0, bw * 2, y1 - y0);
      g.fillStyle = '#4a321c';
      g.fillRect(cx - bw - 0.006 * k, y0 - 0.012 * k, bw * 2 + 0.012 * k, 0.014 * k);
      for (let s = 0; s < 5; s++) {
        const sy = y0 + ((s + 1) * (y1 - y0 - 0.01 * k)) / 5;
        g.fillStyle = '#1a1008';
        g.fillRect(cx - bw + 0.008 * k, sy - (y1 - y0) / 5 + 0.006 * k, bw * 2 - 0.016 * k, (y1 - y0) / 5 - 0.006 * k);
        bookRow(g, cx - bw + 0.01 * k, cx + bw - 0.01 * k, sy, k, ['#2a4a9a', '#7a5a2a', '#1e2e5a', '#8a6a3a', '#3a3a4a', '#5a2a1e', '#b07a3a'], this.r);
        g.fillStyle = '#4a321c';
        g.fillRect(cx - bw, sy, bw * 2, 0.008 * k);
      }
    }

    // the night in the room, and moonlight pooling under each window
    this.noGlass(g);
    const dk = g.createRadialGradient(F.x1 * 0.5, hb, 0.1 * k, F.x1 * 0.5, hb, Math.max(w, h) * 0.95);
    dk.addColorStop(0, 'rgba(6,8,20,0)');
    dk.addColorStop(1, 'rgba(6,8,20,0.5)');
    g.fillStyle = dk;
    g.fillRect(0, 0, w, h);
    g.restore();

    // the floor: a midnight-blue carpet scattered with little stars
    g.beginPath();
    g.moveTo(0, this.floorY(0));
    this.curve(g, this.floorY, 0, w);
    g.lineTo(w, h);
    g.lineTo(0, h);
    g.closePath();
    g.fillStyle = vgrad(g, h * 0.6, h, [
      [0, '#0e1430'],
      [1, '#1c2752'],
    ]);
    g.fill();
    g.save();
    g.clip();
    for (let i = 0; i < (w * h) / (0.003 * k * k); i++) {
      const x = this.R(0, w);
      const y = this.R(h * 0.58, h);
      const f = (y - h * 0.6) / (h * 0.4);
      g.fillStyle = `rgba(224,190,120,${0.18 + this.r() * 0.25})`;
      star5(g, x, y, (0.002 + f * 0.004) * k);
    }
    for (const W of this.wins) {
      const mg = g.createLinearGradient(0, W.y1, 0, W.y1 + 0.32 * k);
      mg.addColorStop(0, 'rgba(170,190,250,0.12)');
      mg.addColorStop(1, 'rgba(170,190,250,0)');
      g.fillStyle = mg;
      g.beginPath();
      g.moveTo(W.x - W.hw, W.y1);
      g.lineTo(W.x + W.hw, W.y1);
      g.lineTo(W.x + W.hw * 2.4, W.y1 + 0.32 * k);
      g.lineTo(W.x - W.hw * 0.1, W.y1 + 0.32 * k);
      g.fill();
    }
    g.restore();

    // a telescope on its tripod at one of the windows, on a wide screen
    if (N > 2) {
      const W = this.wins[N - 2];
      const tx = W.x + W.hw * 0.2;
      const ty = this.floorY(tx) + 0.05 * k;
      g.strokeStyle = '#5a3c1a';
      g.lineWidth = Math.max(2, 0.005 * k);
      g.beginPath();
      for (const dx of [-0.04, 0, 0.04]) {
        g.moveTo(tx, ty - 0.13 * k);
        g.lineTo(tx + dx * k, ty);
      }
      g.stroke();
      g.save();
      g.translate(tx, ty - 0.135 * k);
      g.rotate(-0.55);
      const tg = g.createLinearGradient(0, -0.016 * k, 0, 0.016 * k);
      tg.addColorStop(0, '#e0a868');
      tg.addColorStop(0.5, '#b07a3a');
      tg.addColorStop(1, '#5a3c1a');
      g.fillStyle = tg;
      g.beginPath();
      g.moveTo(-0.06 * k, -0.009 * k);
      g.lineTo(0.09 * k, -0.016 * k);
      g.lineTo(0.09 * k, 0.016 * k);
      g.lineTo(-0.06 * k, 0.009 * k);
      g.closePath();
      g.fill();
      g.fillStyle = '#5a3c1a';
      g.fillRect(0.085 * k, -0.018 * k, 0.012 * k, 0.036 * k);
      g.fillRect(-0.02 * k, -0.013 * k, 0.008 * k, 0.026 * k);
      g.restore();
    }

    // the fireplace, pale stone, and a round bronze star chart over it
    this.fireplace(g, F, mo, { top: this.ceilY((F.x0 + F.x1) / 2) + 0.012 * k, stone: '#7a7e92', lit: '#9aa0b6', edge: '#c8cee0', dark: '#4a4e62', joint: 'rgba(20,24,40,0.35)', hearth: '#4a4e62' });
    {
      const cx = (F.x0 + F.x1) / 2;
      const cr = Math.min(0.1 * k, (F.mantel - 0.06 * k - (this.ceilY(cx) + 0.03 * k)) / 2);
      const cy = F.mantel - 0.1 * k - cr;
      g.fillStyle = '#5a3c1a';
      g.beginPath();
      g.arc(cx, cy, cr * 1.08, 0, TAU);
      g.fill();
      const sg = g.createRadialGradient(cx, cy, 0, cx, cy, cr);
      sg.addColorStop(0, '#22346e');
      sg.addColorStop(1, '#101a40');
      g.fillStyle = sg;
      g.beginPath();
      g.arc(cx, cy, cr, 0, TAU);
      g.fill();
      g.strokeStyle = C.pale;
      g.lineWidth = Math.max(1, 0.0025 * k);
      g.beginPath();
      g.arc(cx, cy, cr * 0.95, 0, TAU);
      g.moveTo(cx + cr * 0.62, cy);
      g.arc(cx, cy, cr * 0.62, 0, TAU);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        g.moveTo(cx + Math.cos(a) * cr * 0.62, cy + Math.sin(a) * cr * 0.62);
        g.lineTo(cx + Math.cos(a) * cr * 0.95, cy + Math.sin(a) * cr * 0.95);
      }
      g.stroke();
      g.strokeStyle = 'rgba(224,168,104,0.6)';
      g.beginPath();
      g.ellipse(cx, cy, cr * 0.95, cr * 0.35, -0.4, 0, TAU);
      g.stroke();
      g.fillStyle = '#e8c27a';
      for (let i = 0; i < 14; i++) {
        const a = this.R(0, TAU);
        const rr = this.R(0.08, 0.58) * cr;
        star5(g, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, this.R(0.02, 0.05) * cr);
      }
      this.chart = { x: cx, y: cy, r: cr };
      // on the shelf: bronze candlesticks, books, a little globe
      const top = this.shelf;
      this.candlestick(g, F.x0 + 0.04 * k, top, 0.045 * k, C.bronze);
      this.candlestick(g, F.x1 - 0.03 * k, top, 0.05 * k, C.bronze);
      bookStack(g, F.x0 + 0.13 * k, top, k, [
        [0.06, '#1e2e5a'],
        [0.05, '#8a6a3a'],
      ]);
      const gx = F.x0 + 0.23 * k;
      g.fillStyle = '#5a3c1a';
      g.fillRect(gx - 0.012 * k, top - 0.006 * k, 0.024 * k, 0.006 * k);
      g.fillRect(gx - 0.002 * k, top - 0.016 * k, 0.004 * k, 0.012 * k);
      const gg = g.createRadialGradient(gx - 0.008 * k, top - 0.04 * k, 0.002 * k, gx, top - 0.034 * k, 0.022 * k);
      gg.addColorStop(0, '#9ab8e0');
      gg.addColorStop(1, '#2a4a7a');
      g.fillStyle = gg;
      g.beginPath();
      g.arc(gx, top - 0.034 * k, 0.02 * k, 0, TAU);
      g.fill();
      g.strokeStyle = C.bronze;
      g.lineWidth = Math.max(1.5, 0.003 * k);
      g.beginPath();
      g.arc(gx, top - 0.034 * k, 0.024 * k, Math.PI * 0.6, Math.PI * 2.4);
      g.stroke();
    }

    // the rug, blue and bronze
    const rug = { x: Math.min(F.x1 + 0.05 * k, w * 0.4), y: hb + 0.065 * k, rx: 0.21 * k, ry: 0.047 * k };
    this.rug = rug;
    this.rugAt(g, rug, ['#0c1430', '#b07a3a', '#24407e', '#e0c08a', '#24407e', '#b07a3a', '#1a2c5c']);

    // a blue armchair on a wide screen
    const tb = { x: w - 0.12 * k, y: Math.min(h - 0.07 * k, h * 0.85), rx: 0.13 * k, ry: 0.032 * k };
    const free = tb.x - tb.rx - (rug.x + rug.rx);
    if (free > 0.22 * k) armchair(g, rug.x + rug.rx + free * 0.45, hb + 0.035 * k, 0.15 * k, 0.21 * k, { lit: '#3a5aa8', mid: '#24407e', dark: '#142650', line: '#0a1228', legs: '#2a1c10', trim: '#c08a48' }, k);

    // the table near us: an open book, books piled up, ink and a quill, an hourglass
    g = this.front.getContext('2d');
    g.fillStyle = '#2a1c10';
    g.fillRect(tb.x - 0.018 * k, tb.y, 0.036 * k, h - tb.y);
    g.fillStyle = '#4a321c';
    g.beginPath();
    g.ellipse(tb.x, tb.y + 0.012 * k, tb.rx, tb.ry, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#7a5630';
    g.beginPath();
    g.ellipse(tb.x, tb.y, tb.rx, tb.ry, 0, 0, TAU);
    g.fill();
    bookStack(g, tb.x - tb.rx * 0.6, tb.y - tb.ry * 0.25, k, [
      [0.07, '#1e2e5a'],
      [0.064, '#7a5a2a'],
      [0.068, '#2a4a9a'],
    ]);
    inkAndQuill(g, tb.x + tb.rx * 0.74, tb.y - tb.ry * 0.3, k);
    this.book = { x: tb.x + tb.rx * 0.08, y: tb.y + tb.ry * 0.2, pw: 0.065 * k, pd: 0.03 * k };
    bookCover(g, this.book, '#1e2e5a');
    this.glassH = { x: tb.x - tb.rx * 0.6, y: tb.y - tb.ry * 0.25 - 0.042 * k, s: 0.03 * k };

    printGrain(this.room, this.grain, 0.12);
    printGrain(this.front, this.grain, 0.12);
    this.sprites();
    this.sand = rand(0, 1);
  }

  // blue silk at a window: a panel each side from a bronze rod over the arch, caught back with a
  // bronze tieback, the hem stirring in the air from the open window
  silk(g, W, t, ph) {
    const { k } = this;
    const C = this.C;
    const ry = W.y0 - 0.02 * k;
    const hem = W.y1 + 0.03 * k;
    const tie = lerp(W.ys, W.y1, 0.45);
    for (const s of [-1, 1]) {
      const sway = (Math.sin(t * 0.5 + ph + s) * 0.6 + Math.sin(t * 1.3 + ph * 2) * 0.4) * 0.012 * k;
      const outer = W.x + s * W.hw * 1.75;
      const inner = W.x + s * W.hw * 0.75;
      const tx = W.x + s * W.hw * 1.12;
      const p = new Path2D();
      p.moveTo(outer, ry);
      p.lineTo(inner, ry);
      p.quadraticCurveTo(inner, lerp(ry, tie, 0.6), tx, tie);
      p.quadraticCurveTo(tx + s * 0.004 * k, lerp(tie, hem, 0.5), inner + s * W.hw * 0.05 + sway, hem);
      p.lineTo(outer + s * W.hw * 0.08 + sway * 0.6, hem + 0.004 * k);
      p.quadraticCurveTo(outer + s * 0.004 * k, lerp(tie, hem, 0.5), outer + s * 0.002 * k, tie);
      p.closePath();
      const gr = g.createLinearGradient(outer, 0, inner, 0);
      gr.addColorStop(0, C.fold);
      gr.addColorStop(0.3, C.silk);
      gr.addColorStop(0.5, C.fold);
      gr.addColorStop(0.75, C.lit);
      gr.addColorStop(1, C.silk);
      g.fillStyle = gr;
      g.fill(p);
      g.strokeStyle = 'rgba(10,16,40,0.5)';
      g.lineWidth = Math.max(1, 0.0015 * k);
      g.stroke(p);
      // a bronze fringe along the hem, and the tieback
      g.strokeStyle = C.bronze;
      g.lineWidth = Math.max(1.5, 0.004 * k);
      g.beginPath();
      g.moveTo(inner + s * W.hw * 0.05 + sway, hem);
      g.lineTo(outer + s * W.hw * 0.08 + sway * 0.6, hem + 0.004 * k);
      g.stroke();
      g.fillStyle = C.pale;
      g.beginPath();
      g.ellipse(tx + s * 0.004 * k, tie, 0.01 * k, 0.006 * k, 0, 0, TAU);
      g.fill();
    }
    // the rod and its finials
    g.fillStyle = C.bronze;
    g.fillRect(W.x - W.hw * 1.85, ry - 0.004 * k, W.hw * 3.7, 0.008 * k);
    g.fillStyle = C.pale;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.arc(W.x + s * W.hw * 1.9, ry, 0.008 * k, 0, TAU);
      g.fill();
    }
  }

  frame(dt) {
    const { g, t, k } = this;
    this.drawView(g, dt);
    g.drawImage(this.room, 0, 0);
    // the painted stars on the dome catch the light now and then
    g.globalCompositeOperation = 'lighter';
    for (const s of this.painted) {
      const a = Math.max(0, Math.sin(t * 0.4 + s.ph)) ** 6 * 0.5;
      if (a < 0.02) continue;
      g.globalAlpha = a;
      g.drawImage(this.glow, s.x - s.r * 3, s.y - s.r * 3, s.r * 6, s.r * 6);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    this.wins.forEach((W, i) => this.silk(g, W, t, i * 1.7));
    this.lights(g, 0.55);
    catPile(g, this.cats, this.rug, t, dt);
    g.drawImage(this.front, 0, 0);

    // the hourglass on the table: sand running down, turned over when it's run out
    {
      const H = this.glassH;
      const s = H.s;
      this.sand += dt / 90;
      if (this.sand > 1.08) this.sand = 0;
      const f = clamp(this.sand, 0, 1);
      const x = H.x;
      const y = H.y;
      g.fillStyle = '#5a3c1a';
      g.fillRect(x - s * 0.5, y - s * 0.06, s, s * 0.06);
      g.fillRect(x - s * 0.5, y - s * 1.36, s, s * 0.06);
      g.fillRect(x - s * 0.44, y - s * 1.3, s * 0.05, s * 1.24);
      g.fillRect(x + s * 0.39, y - s * 1.3, s * 0.05, s * 1.24);
      const bulb = (up) => {
        const yb = up ? y - s * 1.3 : y - s * 0.06;
        const dir = up ? 1 : -1;
        const p = new Path2D();
        p.moveTo(x - s * 0.3, yb);
        p.quadraticCurveTo(x - s * 0.34, yb + dir * s * 0.4, x - s * 0.03, yb + dir * s * 0.6);
        p.lineTo(x + s * 0.03, yb + dir * s * 0.6);
        p.quadraticCurveTo(x + s * 0.34, yb + dir * s * 0.4, x + s * 0.3, yb);
        p.closePath();
        return p;
      };
      const top = bulb(true);
      const bot = bulb(false);
      g.fillStyle = 'rgba(200,220,255,0.18)';
      g.fill(top);
      g.fill(bot);
      g.fillStyle = '#e0c088';
      g.save();
      g.clip(top);
      g.fillRect(x - s * 0.4, y - s * 1.3 + s * 0.6 * f, s * 0.8, s * 0.6);
      g.restore();
      g.save();
      g.clip(bot);
      g.fillRect(x - s * 0.4, y - s * 0.06 - s * 0.55 * f, s * 0.8, s * 0.6);
      g.restore();
      if (f < 1) g.fillRect(x - Math.max(0.5, s * 0.015), y - s * 0.7, Math.max(1, s * 0.03), s * 0.62 * (1 - f * 0.9));
      g.strokeStyle = 'rgba(220,235,255,0.35)';
      g.lineWidth = Math.max(1, s * 0.03);
      g.stroke(top);
      g.stroke(bot);
    }
    const fl = this.flip ? t - this.flip.t0 : null;
    if (fl != null && fl > 0.9) this.flip = null;
    openBook(g, this.book, fl);
    void k;
  }
}

// ---------------------------------------------------------------------------------------------
// The headmaster's study, at the top of a tower: a round room whose walls are hung to the ceiling
// with portraits of old headmasters and headmistresses, all dozing in their frames (one now and
// then gives a snore, and you can see which). Silver instruments whirr and puff on spindly tables,
// a tattered old hat sits on the mantelpiece, and on a golden perch by the great claw-footed desk
// sits the phoenix, scarlet and gold, its long tail hanging down; it shakes out its feathers now
// and then, and when it sings it lifts its head and glows. The cats are asleep by the fire.

// someone asleep in a portrait, as a sprite W by H: a, their looks
function sitterSprite(W, H, a) {
  const c = layer(Math.ceil(W), Math.ceil(H));
  const g = c.getContext('2d');
  const cx = W * 0.5;
  const hy = H * 0.46;
  const hr = Math.min(W * 0.2, H * 0.15);
  // robes: shoulders slumped in a chair
  g.fillStyle = a.robe;
  g.beginPath();
  g.moveTo(cx - W * 0.46, H);
  g.quadraticCurveTo(cx - W * 0.42, hy + hr * 1.3, cx, hy + hr * 1.05);
  g.quadraticCurveTo(cx + W * 0.42, hy + hr * 1.3, cx + W * 0.46, H);
  g.closePath();
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.08)';
  g.beginPath();
  g.moveTo(cx - W * 0.05, hy + hr * 1.1);
  g.lineTo(cx + W * 0.02, H);
  g.lineTo(cx - W * 0.12, H);
  g.fill();
  // the head, leant a little to one side in sleep
  g.save();
  g.translate(cx, hy);
  g.rotate(a.lean);
  if (a.hair) {
    g.fillStyle = a.hair;
    g.beginPath();
    g.ellipse(0, -hr * 0.1, hr * 1.18, hr * 1.12, 0, 0, TAU);
    g.fill();
    if (a.bun) {
      g.beginPath();
      g.arc(0, -hr * 1.1, hr * 0.42, 0, TAU);
      g.fill();
    }
  }
  g.fillStyle = a.skin;
  g.beginPath();
  g.ellipse(0, 0, hr * 0.92, hr, 0, 0, TAU);
  g.fill();
  // shut eyes, a nose, a mouth a little open
  g.strokeStyle = 'rgba(60,35,25,0.8)';
  g.lineWidth = Math.max(1, hr * 0.09);
  g.lineCap = 'round';
  for (const s of [-1, 1]) {
    g.beginPath();
    g.arc(s * hr * 0.36, -hr * 0.05, hr * 0.17, 0.2, Math.PI - 0.2);
    g.stroke();
  }
  if (a.specs) {
    g.strokeStyle = 'rgba(210,190,130,0.85)';
    g.lineWidth = Math.max(1, hr * 0.06);
    for (const s of [-1, 1]) {
      g.beginPath();
      g.arc(s * hr * 0.36, -hr * 0.02, hr * 0.24, 0, TAU);
      g.stroke();
    }
  }
  g.fillStyle = 'rgba(120,60,40,0.35)';
  g.beginPath();
  g.ellipse(0, hr * 0.22, hr * 0.12, hr * 0.18, 0, 0, TAU);
  g.fill();
  if (a.beard) {
    g.fillStyle = a.beard;
    g.beginPath();
    g.moveTo(-hr * 0.85, hr * 0.15);
    g.quadraticCurveTo(-hr * 0.9, hr * (1.2 + a.long), 0, hr * (1.6 + a.long * 1.5));
    g.quadraticCurveTo(hr * 0.9, hr * (1.2 + a.long), hr * 0.85, hr * 0.15);
    g.quadraticCurveTo(hr * 0.5, hr * 0.6, 0, hr * 0.42);
    g.quadraticCurveTo(-hr * 0.5, hr * 0.6, -hr * 0.85, hr * 0.15);
    g.fill();
    g.fillStyle = a.beard;
    g.beginPath();
    g.ellipse(-hr * 0.25, hr * 0.42, hr * 0.32, hr * 0.12, 0.3, 0, TAU);
    g.ellipse(hr * 0.25, hr * 0.42, hr * 0.32, hr * 0.12, -0.3, 0, TAU);
    g.fill();
  } else {
    g.strokeStyle = 'rgba(110,50,40,0.6)';
    g.beginPath();
    g.ellipse(0, hr * 0.55, hr * 0.12, hr * 0.08, 0, 0, TAU);
    g.stroke();
  }
  if (a.hat === 'pointed') {
    g.fillStyle = a.hatCol;
    g.beginPath();
    g.ellipse(0, -hr * 0.7, hr * 1.35, hr * 0.28, 0, 0, TAU);
    g.fill();
    g.beginPath();
    g.moveTo(-hr * 0.8, -hr * 0.75);
    g.quadraticCurveTo(-hr * 0.2, -hr * 1.6, hr * 0.5, -hr * 2.6);
    g.quadraticCurveTo(hr * 0.3, -hr * 1.5, hr * 0.8, -hr * 0.75);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(-hr * 0.8, -hr * 0.92, hr * 1.6, hr * 0.14);
  } else if (a.hat === 'cap') {
    g.fillStyle = a.hatCol;
    g.beginPath();
    g.ellipse(0, -hr * 0.62, hr * 0.95, hr * 0.5, 0, Math.PI, TAU);
    g.fill();
  }
  g.restore();
  return c;
}

const SITTERS = [
  { robe: '#4a2a6a', skin: '#e8c8a8', hair: '#e8e4dc', beard: '#eeeae2', long: 0.6, hat: 'pointed', hatCol: '#3a2458', specs: true },
  { robe: '#1e4a3a', skin: '#d8b090', hair: '#5a4030', hat: 'cap', hatCol: '#14302a' },
  { robe: '#6a1e24', skin: '#f0d0b8', hair: '#b8b0a8', bun: true, specs: true },
  { robe: '#2a3456', skin: '#c89878', hair: '#2a2420', beard: '#2a2420', long: 0.1, hat: 'pointed', hatCol: '#1a2240' },
  { robe: '#5a4a1e', skin: '#e0b898', hair: '#d8d4cc', beard: '#d8d4cc', long: 0.3 },
  { robe: '#3a1e3a', skin: '#a87858', hair: '#1a1410', bun: true, hat: 'pointed', hatCol: '#241024' },
  { robe: '#1e3a5a', skin: '#ecc8a8', hair: '#a8a098', beard: '#c8c2b8', long: 0.9, hat: 'cap', hatCol: '#5a1e24' },
  { robe: '#4a3a2a', skin: '#d8a888', hair: '#7a5a3a', specs: true },
];
const PORTRAIT_BG = ['#1e2a1e', '#2a1a16', '#1a1e2c', '#2c2418', '#22161e', '#182424'];

// the phoenix, perched, facing left: body and folded wing as one sprite S wide; the head is drawn
// on its own so it can lift and turn
function phoenixBody(S) {
  const c = layer(Math.ceil(S * 1.2), Math.ceil(S * 1.5));
  const g = c.getContext('2d');
  const cx = S * 0.6;
  const cy = S * 0.62;
  // the body: a teardrop, deep crimson to scarlet, breast catching the light
  const bg = g.createRadialGradient(cx - S * 0.1, cy - S * 0.1, S * 0.05, cx, cy, S * 0.5);
  bg.addColorStop(0, '#f05a2a');
  bg.addColorStop(0.5, '#c8221c');
  bg.addColorStop(1, '#7a0e12');
  g.fillStyle = bg;
  g.beginPath();
  g.moveTo(cx - S * 0.12, cy - S * 0.42);
  g.bezierCurveTo(cx - S * 0.4, cy - S * 0.3, cx - S * 0.36, cy + S * 0.3, cx - S * 0.02, cy + S * 0.5);
  g.bezierCurveTo(cx + S * 0.18, cy + S * 0.62, cx + S * 0.3, cy + S * 0.7, cx + S * 0.36, cy + S * 0.78);
  g.bezierCurveTo(cx + S * 0.34, cy + S * 0.4, cx + S * 0.3, cy - S * 0.2, cx + S * 0.08, cy - S * 0.42);
  g.closePath();
  g.fill();
  // breast feathers: little gold scallops
  g.strokeStyle = 'rgba(255,190,80,0.45)';
  g.lineWidth = Math.max(1, S * 0.012);
  for (let r = 0; r < 4; r++) {
    for (let i = 0; i < 3; i++) {
      const x = cx - S * 0.2 + i * S * 0.07 + (r % 2) * S * 0.035;
      const y = cy - S * 0.15 + r * S * 0.1;
      g.beginPath();
      g.arc(x, y, S * 0.035, 0.2, Math.PI - 0.2);
      g.stroke();
    }
  }
  // the folded wing: layered feathers, scarlet to gold at the tips
  const wg = g.createLinearGradient(cx, cy - S * 0.35, cx + S * 0.3, cy + S * 0.7);
  wg.addColorStop(0, '#a8141a');
  wg.addColorStop(0.55, '#e0401c');
  wg.addColorStop(1, '#f6b030');
  g.fillStyle = wg;
  g.beginPath();
  g.moveTo(cx - S * 0.04, cy - S * 0.36);
  g.bezierCurveTo(cx + S * 0.24, cy - S * 0.3, cx + S * 0.34, cy + S * 0.2, cx + S * 0.44, cy + S * 0.86);
  g.bezierCurveTo(cx + S * 0.24, cy + S * 0.5, cx - S * 0.04, cy + S * 0.3, cx - S * 0.12, cy - S * 0.05);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(90,10,10,0.5)';
  g.lineWidth = Math.max(1, S * 0.01);
  for (let i = 0; i < 5; i++) {
    const f = i / 5;
    g.beginPath();
    g.moveTo(cx + S * (0.02 + f * 0.1), cy - S * (0.2 - f * 0.35));
    g.quadraticCurveTo(cx + S * (0.2 + f * 0.05), cy + S * (0.1 + f * 0.3), cx + S * (0.36 + f * 0.02), cy + S * (0.5 + f * 0.3));
    g.stroke();
  }
  g.fillStyle = 'rgba(255,214,110,0.5)';
  g.beginPath();
  g.moveTo(cx + S * 0.2, cy + S * 0.3);
  g.quadraticCurveTo(cx + S * 0.38, cy + S * 0.55, cx + S * 0.44, cy + S * 0.86);
  g.quadraticCurveTo(cx + S * 0.28, cy + S * 0.62, cx + S * 0.18, cy + S * 0.42);
  g.fill();
  // golden talons gripping the perch, at the foot of the sprite
  g.fillStyle = '#e8b040';
  for (const dx of [-0.08, 0.06]) {
    const x = cx + dx * S;
    const y = S * 1.18;
    g.fillRect(x - S * 0.015, y - S * 0.1, S * 0.03, S * 0.1);
    for (const a of [-0.9, 0, 0.9]) {
      g.beginPath();
      g.ellipse(x + Math.sin(a) * S * 0.03, y + S * 0.01, S * 0.012, S * 0.03, a, 0, TAU);
      g.fill();
    }
  }
  return c;
}
// the phoenix's head, facing left, with a crest of gold-tipped feathers: open is how far its beak
// is open (0 shut). Drawn round (0, 0), the base of the neck.
function phoenixHead(g, S, open, blink) {
  // neck
  g.fillStyle = '#c8221c';
  g.beginPath();
  g.moveTo(-S * 0.12, S * 0.12);
  g.quadraticCurveTo(-S * 0.16, -S * 0.1, -S * 0.08, -S * 0.2);
  g.lineTo(S * 0.08, -S * 0.16);
  g.quadraticCurveTo(S * 0.1, 0, S * 0.1, S * 0.14);
  g.fill();
  // crest
  for (let i = 0; i < 5; i++) {
    const a = -1.9 + i * 0.28;
    const len = S * (0.2 - Math.abs(i - 1.5) * 0.02);
    const bx = -S * 0.02 + i * S * 0.015;
    const by = -S * 0.3;
    const cg = g.createLinearGradient(bx, by, bx + Math.cos(a) * len, by + Math.sin(a) * len);
    cg.addColorStop(0, '#d82a1c');
    cg.addColorStop(1, '#ffd060');
    g.strokeStyle = cg;
    g.lineWidth = Math.max(1.5, S * 0.022);
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(bx, by);
    g.quadraticCurveTo(bx + Math.cos(a) * len * 0.5 + S * 0.03, by + Math.sin(a) * len * 0.5, bx + Math.cos(a) * len, by + Math.sin(a) * len);
    g.stroke();
  }
  // the head
  const hg = g.createRadialGradient(-S * 0.08, -S * 0.3, S * 0.01, -S * 0.04, -S * 0.26, S * 0.13);
  hg.addColorStop(0, '#f86a30');
  hg.addColorStop(1, '#b81a18');
  g.fillStyle = hg;
  g.beginPath();
  g.ellipse(-S * 0.04, -S * 0.26, S * 0.1, S * 0.09, -0.2, 0, TAU);
  g.fill();
  // the beak: gold, hooked, opening when it sings
  g.fillStyle = '#f0c048';
  g.beginPath();
  g.moveTo(-S * 0.11, -S * 0.3);
  g.quadraticCurveTo(-S * 0.2, -S * 0.31, -S * 0.22, -S * 0.25 - open * S * 0.02);
  g.quadraticCurveTo(-S * 0.17, -S * 0.27, -S * 0.12, -S * 0.25);
  g.fill();
  g.fillStyle = '#c89028';
  g.beginPath();
  g.moveTo(-S * 0.12, -S * 0.25 + open * S * 0.005);
  g.quadraticCurveTo(-S * 0.17, -S * 0.24 + open * S * 0.03, -S * 0.19, -S * 0.23 + open * S * 0.045);
  g.quadraticCurveTo(-S * 0.15, -S * 0.22 + open * S * 0.02, -S * 0.1, -S * 0.22);
  g.fill();
  // the eye: black and bright, a gold ring round it
  g.fillStyle = '#ffd060';
  g.beginPath();
  g.arc(-S * 0.06, -S * 0.29, S * 0.022, 0, TAU);
  g.fill();
  if (blink) {
    g.strokeStyle = '#3a0808';
    g.lineWidth = Math.max(1, S * 0.008);
    g.beginPath();
    g.moveTo(-S * 0.08, -S * 0.29);
    g.lineTo(-S * 0.04, -S * 0.29);
    g.stroke();
  } else {
    g.fillStyle = '#120404';
    g.beginPath();
    g.arc(-S * 0.062, -S * 0.29, S * 0.014, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.beginPath();
    g.arc(-S * 0.067, -S * 0.295, S * 0.004, 0, TAU);
    g.fill();
  }
}

// the old hat: patched, frayed, its tip slumped over, a rip above the brim
function oldHat(g, x, y, s) {
  g.fillStyle = '#4a3624';
  g.beginPath();
  g.ellipse(x, y - s * 0.04, s * 0.62, s * 0.12, 0, 0, TAU);
  g.fill();
  const hg = g.createLinearGradient(x - s * 0.4, 0, x + s * 0.4, 0);
  hg.addColorStop(0, '#3a2a1a');
  hg.addColorStop(0.45, '#6a5034');
  hg.addColorStop(1, '#2e2014');
  g.fillStyle = hg;
  g.beginPath();
  g.moveTo(x - s * 0.4, y - s * 0.06);
  g.quadraticCurveTo(x - s * 0.3, y - s * 0.5, x - s * 0.05, y - s * 0.78);
  g.quadraticCurveTo(x + s * 0.2, y - s * 0.98, x + s * 0.42, y - s * 0.72);
  g.quadraticCurveTo(x + s * 0.5, y - s * 0.58, x + s * 0.44, y - s * 0.52);
  g.quadraticCurveTo(x + s * 0.32, y - s * 0.7, x + s * 0.14, y - s * 0.62);
  g.quadraticCurveTo(x + s * 0.3, y - s * 0.4, x + s * 0.4, y - s * 0.06);
  g.closePath();
  g.fill();
  // creases, a patch, and the rip
  g.strokeStyle = 'rgba(20,12,6,0.6)';
  g.lineWidth = Math.max(1, s * 0.02);
  g.beginPath();
  g.moveTo(x - s * 0.22, y - s * 0.3);
  g.quadraticCurveTo(x, y - s * 0.36, x + s * 0.2, y - s * 0.28);
  g.moveTo(x - s * 0.12, y - s * 0.55);
  g.quadraticCurveTo(x + s * 0.02, y - s * 0.6, x + s * 0.12, y - s * 0.52);
  g.stroke();
  g.fillStyle = '#7a6040';
  g.beginPath();
  g.moveTo(x + s * 0.1, y - s * 0.46);
  g.lineTo(x + s * 0.26, y - s * 0.42);
  g.lineTo(x + s * 0.24, y - s * 0.3);
  g.lineTo(x + s * 0.08, y - s * 0.33);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(230,210,170,0.5)';
  g.lineWidth = Math.max(1, s * 0.01);
  g.setLineDash([s * 0.025, s * 0.02]);
  g.stroke();
  g.setLineDash([]);
  g.strokeStyle = '#140c06';
  g.lineWidth = Math.max(1.5, s * 0.03);
  g.beginPath();
  g.moveTo(x - s * 0.26, y - s * 0.16);
  g.quadraticCurveTo(x - s * 0.1, y - s * 0.12, x + s * 0.06, y - s * 0.17);
  g.stroke();
}

class Study extends TowerRoom {
  build() {
    this.begin(41);
    const { w, h, k, hb } = this;
    this.shape(0.1, 0.06, 0.6, 0.08);
    let g = this.room.getContext('2d');
    this.beams(g, '#08060a', '#1e1418', '#100a0c', 'rgba(255,180,120,0.07)');
    // a warm, dark wall, panelled in wood below
    this.stones(g, ['#24181a', '#3e2a28', '#523834', '#2e201e'], 0.04, 0.09);

    const F = { x0: -0.03 * k, x1: 0.33 * k, mantel: hb - 0.26 * k };
    const mo = { x0: 0.045 * k, x1: 0.255 * k, y0: hb - 0.19 * k, y1: hb };
    const cbx = F.x1 - (F.x1 - F.x0) * 0.08;
    this.fireX = F.x1 * 0.5;
    // the phoenix's perch stands by the desk, to the right
    const px = w - 0.11 * k - Math.max(0, w - 0.6 * k) * 0.3;
    // a window in the middle of the wall on a wide screen
    const xmin = cbx + 0.1 * k;
    const xmax = px - 0.12 * k;
    const xs = xmax - xmin > 0.3 * k ? [(xmin + xmax) / 2] : [];
    if (xs.length) {
      this.lancets(g, xs.map(this.TH), { hw: 0.065 * k, top: 0.06 * k, foot: 0.1 * k, reveal: 0.013, surround: '#24181a', revealLit: '#5a4440', revealDark: '#1a1012', sill: '#6a5048', lead: 'rgba(20,12,10,0.4)', bar: '#140c0a' });
      this.view = this.nightView('grounds');
    } else {
      this.wins = [];
      this.glass = new Path2D();
    }
    // wainscot: dark panels round the foot of the wall
    const yAt = (x, f) => lerp(this.ceilY(x), this.floorY(x), f);
    const wf = 0.74;
    g.beginPath();
    g.moveTo(0, yAt(0, wf));
    this.curve(g, (x) => yAt(x, wf), 0, w);
    this.curve(g, this.floorY, w, 0);
    g.closePath();
    g.fillStyle = '#2a1a12';
    g.fill();
    g.strokeStyle = 'rgba(200,140,80,0.18)';
    g.lineWidth = Math.max(1, 0.003 * k);
    g.beginPath();
    g.moveTo(0, yAt(0, wf));
    this.curve(g, (x) => yAt(x, wf), 0, w);
    g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    for (let th = -1.2; th <= 1.2; th += 0.12) {
      const x = this.X(th);
      g.beginPath();
      g.moveTo(x, yAt(x, wf) + 0.008 * k);
      g.lineTo(x, this.floorY(x) - 0.008 * k);
      g.stroke();
    }

    // portraits, frame to frame, from the cornice down to the panelling
    this.portraits = [];
    const clear = (x0, x1, y0, y1) => {
      if (x0 < cbx + 0.01 * k) return false;
      for (const W of this.wins) if (x1 > W.x - W.hw - 0.03 * k && x0 < W.x + W.hw + 0.03 * k && y1 > W.y0 - 0.04 * k) return false;
      return true;
    };
    const bands = [0.04, 0.27, 0.5, 0.71];
    for (let b = 0; b < bands.length - 1; b++) {
      let x = cbx + this.R(0.01, 0.04) * k;
      while (x < w) {
        const th = this.TH(x);
        const fw = this.R(0.055, 0.085) * k * (0.55 + 0.45 * Math.cos(th));
        const top = yAt(x + fw / 2, bands[b]) + this.R(0.005, 0.02) * k;
        const bot = yAt(x + fw / 2, bands[b + 1]) - this.R(0.008, 0.025) * k;
        if (bot - top > 0.05 * k && clear(x, x + fw, top, bot)) this.portraits.push({ x0: x, x1: x + fw, y0: top, y1: bot });
        x += fw + this.R(0.012, 0.03) * k;
      }
    }
    // a few of them breathe where you can see it (and they're the ones that snore); the rest are
    // painted into the room
    const live = new Set();
    while (live.size < Math.min(8, this.portraits.length)) live.add(this.portraits[Math.floor(this.r() * this.portraits.length)]);
    this.portraits.forEach((P, i) => this.portrait(g, P, i, live.has(P)));
    this.portraits = this.portraits.filter((P) => P.live);

    // the night in the room
    this.noGlass(g);
    const dk = g.createRadialGradient(F.x1 * 0.5, hb, 0.1 * k, F.x1 * 0.5, hb, Math.max(w, h) * 0.95);
    dk.addColorStop(0, 'rgba(8,4,10,0)');
    dk.addColorStop(1, 'rgba(8,4,10,0.5)');
    g.fillStyle = dk;
    g.fillRect(0, 0, w, h);
    g.restore();

    // a floor of dark boards, a deep red carpet
    this.boards(g, '#24160e', '#3e2616', 'rgba(8,4,2,0.4)');

    // spindly tables of silver instruments, where there's floor for them
    this.instruments = [];
    const room = px - 0.1 * k - (F.x1 + 0.04 * k);
    const spots = room > 0.7 * k ? [0.2, 0.75] : room > 0.3 * k ? [0.5] : [];
    for (const f of spots) {
      const x = F.x1 + 0.04 * k + room * f;
      const y = this.floorY(x) + 0.07 * k;
      const tw = 0.06 * k;
      const top = y - 0.16 * k;
      g.strokeStyle = '#2a1a10';
      g.lineWidth = Math.max(1.5, 0.004 * k);
      g.beginPath();
      for (const dx of [-1, 0, 1]) {
        g.moveTo(x + dx * tw * 0.5, top);
        g.quadraticCurveTo(x + dx * tw * 0.7, (top + y) / 2, x + dx * tw * 0.9, y);
      }
      g.stroke();
      g.fillStyle = '#4a2e1a';
      g.beginPath();
      g.ellipse(x, top, tw, tw * 0.22, 0, 0, TAU);
      g.fill();
      g.fillStyle = '#6a4428';
      g.beginPath();
      g.ellipse(x, top - 0.003 * k, tw, tw * 0.22, 0, 0, TAU);
      g.fill();
      this.instruments.push({ kind: f < 0.5 && spots.length > 1 ? 'puffer' : 'armillary', x, y: top - 0.003 * k, s: 0.065 * k, ph: this.R(0, TAU) });
    }

    // the fireplace, and on the mantelpiece the old hat, candles, and a little silver puffer
    this.fireplace(g, F, mo, { stone: '#5a4642', lit: '#7a625a', edge: '#a08878', dark: '#2e2220', joint: 'rgba(16,8,6,0.45)', hearth: '#3e302c' });
    {
      const top = this.shelf;
      this.candlestick(g, F.x0 + 0.035 * k, top, 0.045 * k);
      this.candlestick(g, F.x1 - 0.025 * k, top, 0.035 * k);
      oldHat(g, F.x0 + 0.13 * k, top, 0.1 * k);
      // a big portrait over the mantelpiece
      const cx = (F.x0 + F.x1) / 2;
      const pw = 0.17 * k;
      const y1 = F.mantel - 0.13 * k;
      const y0 = Math.max(this.ceilY(cx) + 0.06 * k, y1 - 0.3 * k);
      const P = { x0: cx - pw / 2, x1: cx + pw / 2, y0, y1, big: true };
      this.portrait(g, P, 6, true);
      if (P.live) this.portraits.push(P);
      if (!this.instruments.some((i) => i.kind === 'puffer')) this.instruments.push({ kind: 'puffer', x: F.x0 + 0.255 * k, y: top, s: 0.055 * k, ph: 0 });
    }

    // the rug before the fire
    const rug = { x: Math.min(F.x1 + 0.05 * k, w * 0.4), y: hb + 0.065 * k, rx: 0.21 * k, ry: 0.047 * k };
    this.rug = rug;
    this.rugAt(g, rug, ['#2a0c14', '#b8862e', '#5a1428', '#d8b060', '#5a1428', '#3a0c1a']);

    // the golden perch: a stand on a round foot, a bar across the top
    const by = this.floorY(px) + 0.03 * k;
    const bar = by - 0.24 * k;
    this.perch = { x: px, y: bar, w: 0.06 * k };
    {
      const gold = (x0, x1) => {
        const gg = g.createLinearGradient(x0, 0, x1, 0);
        gg.addColorStop(0, '#6a4410');
        gg.addColorStop(0.4, '#f6d070');
        gg.addColorStop(1, '#8a5a14');
        return gg;
      };
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.beginPath();
      g.ellipse(px, by + 0.004 * k, 0.05 * k, 0.012 * k, 0, 0, TAU);
      g.fill();
      g.fillStyle = gold(px - 0.04 * k, px + 0.04 * k);
      g.beginPath();
      g.ellipse(px, by, 0.04 * k, 0.01 * k, 0, 0, TAU);
      g.fill();
      g.fillRect(px - 0.004 * k, bar, 0.008 * k, by - bar);
      g.beginPath();
      g.ellipse(px, lerp(bar, by, 0.55), 0.01 * k, 0.007 * k, 0, 0, TAU);
      g.fill();
      g.fillStyle = gold(px, px + 0.002 * k);
      g.beginPath();
      g.roundRect(px - 0.06 * k, bar - 0.005 * k, 0.12 * k, 0.01 * k, 0.005 * k);
      g.fill();
      g.fillStyle = '#f6d070';
      for (const s of [-1, 1]) {
        g.beginPath();
        g.arc(px + s * 0.062 * k, bar, 0.008 * k, 0, TAU);
        g.fill();
      }
    }

    // the desk near us on the right: dark wood, claw feet, papers, the book, ink and a quill,
    // a dish of sweets, and a little orrery
    g = this.front.getContext('2d');
    const D = { x0: w - 0.25 * k, x1: w + 0.05 * k, y: Math.min(h - 0.08 * k, h * 0.84), d: 0.05 * k };
    const dg = g.createLinearGradient(0, D.y, 0, h);
    dg.addColorStop(0, '#3a2014');
    dg.addColorStop(1, '#1e100a');
    g.fillStyle = dg;
    g.fillRect(D.x0, D.y, D.x1 - D.x0, h - D.y);
    g.strokeStyle = 'rgba(220,160,90,0.25)';
    g.lineWidth = Math.max(1, 0.003 * k);
    g.strokeRect(D.x0 + 0.02 * k, D.y + 0.025 * k, 0.1 * k, 0.05 * k);
    g.strokeRect(D.x0 + 0.14 * k, D.y + 0.025 * k, 0.1 * k, 0.05 * k);
    g.fillStyle = '#c89a40';
    g.fillRect(D.x0 + 0.065 * k, D.y + 0.048 * k, 0.012 * k, 0.005 * k);
    g.fillRect(D.x0 + 0.185 * k, D.y + 0.048 * k, 0.012 * k, 0.005 * k);
    // a claw foot at the corner
    {
      const fx = D.x0 + 0.015 * k;
      const fy = Math.min(h, D.y + 0.16 * k);
      g.fillStyle = '#2a160c';
      g.fillRect(D.x0, D.y, 0.03 * k, fy - D.y);
      g.fillStyle = '#3a2214';
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.ellipse(fx - 0.012 * k + i * 0.012 * k, fy - 0.006 * k, 0.008 * k, 0.012 * k, (i - 1) * 0.3, 0, TAU);
        g.fill();
      }
      g.fillStyle = 'rgba(220,170,90,0.4)';
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.arc(fx - 0.012 * k + i * 0.012 * k, fy + 0.004 * k, 0.003 * k, 0, TAU);
        g.fill();
      }
    }
    // the top
    g.fillStyle = '#5a3420';
    g.beginPath();
    g.moveTo(D.x0 - 0.01 * k, D.y);
    g.lineTo(D.x1, D.y);
    g.lineTo(D.x1, D.y - D.d);
    g.lineTo(D.x0 + 0.015 * k, D.y - D.d);
    g.closePath();
    g.fill();
    g.fillStyle = '#7a4a2c';
    g.fillRect(D.x0 - 0.01 * k, D.y - 0.004 * k, D.x1 - D.x0 + 0.01 * k, 0.008 * k);
    // loose papers
    for (const [dx, dy, rot] of [
      [0.03, -0.03, -0.12],
      [0.05, -0.022, 0.08],
    ]) {
      g.save();
      g.translate(D.x0 + dx * k, D.y + dy * k);
      g.transform(1, 0, -0.6, 0.35, 0, 0);
      g.rotate(rot);
      g.fillStyle = '#e8dcbc';
      g.fillRect(-0.03 * k, -0.04 * k, 0.06 * k, 0.08 * k);
      g.restore();
    }
    this.book = { x: D.x0 + 0.13 * k, y: D.y - 0.008 * k, pw: 0.06 * k, pd: 0.028 * k };
    bookCover(g, this.book, '#3a1e4a');
    inkAndQuill(g, D.x0 + 0.215 * k, D.y - 0.02 * k, k);
    // a glass dish of lemon sweets, on a wide screen where the desk shows more
    if (w > 0.9 * k) {
      const sx = D.x0 + 0.04 * k;
      const sy = D.y - 0.006 * k;
      g.fillStyle = 'rgba(200,220,240,0.35)';
      g.beginPath();
      g.ellipse(sx, sy - 0.006 * k, 0.022 * k, 0.008 * k, 0, 0, Math.PI);
      g.fill();
      g.fillStyle = '#f0d040';
      for (const [dx, dy] of [
        [-0.01, -0.008],
        [0, -0.01],
        [0.01, -0.008],
        [-0.005, -0.014],
        [0.006, -0.015],
      ]) {
        g.beginPath();
        g.ellipse(sx + dx * k, sy + dy * k, 0.006 * k, 0.004 * k, 0, 0, TAU);
        g.fill();
      }
    }
    this.instruments.push({ kind: 'orrery', x: D.x0 + 0.05 * k + (w > 0.9 * k ? 0.04 * k : 0), y: D.y - 0.03 * k, s: 0.05 * k, ph: 0, front: true });

    printGrain(this.room, this.grain, 0.14);
    printGrain(this.front, this.grain, 0.14);
    this.sprites();
    this.bird = phoenixBody(0.12 * k);
    this.smoke = glowSprite([
      [0, 'rgba(235,235,245,0.55)'],
      [0.5, 'rgba(235,235,245,0.2)'],
      [1, 'rgba(235,235,245,0)'],
    ]);
    this.phoenixGlow = glowSprite([
      [0, 'rgba(255,190,90,0.6)'],
      [0.4, 'rgba(255,120,40,0.2)'],
      [1, 'rgba(255,90,30,0)'],
    ]);
    this.puffs = [];
    this.snores = [];
    this.song = null;
    this.ruffle = null;
    this.whirr = -99;
    this.look = { a: 0, to: 0, next: rand(5, 12) };
    this.pblink = rand(3, 8);
  }

  // a portrait in its gilt frame; a live one's sitter is drawn each frame, the rest painted in now
  portrait(g, P, i, live) {
    const { k, w, h } = this;
    const bw = Math.max(3, (P.big ? 0.014 : 0.009) * k);
    const ix = P.x0 + bw;
    const iy = P.y0 + bw;
    const iw = P.x1 - P.x0 - bw * 2;
    const ih = P.y1 - P.y0 - bw * 2;
    Object.assign(P, { ix, iy, iw, ih, live });
    if (iw < 4 || ih < 4) {
      P.live = false; // too small to paint (a screen not laid out yet)
      return;
    }
    const oval = !P.big && this.r() < 0.25;
    const fg = g.createLinearGradient(P.x0, P.y0, P.x1, P.y1);
    fg.addColorStop(0, '#f0c870');
    fg.addColorStop(0.5, '#a07428');
    fg.addColorStop(1, '#5a3c14');
    g.fillStyle = 'rgba(0,0,0,0.4)';
    g.fillRect(P.x0 + bw * 0.4, P.y0 + bw * 0.6, P.x1 - P.x0, P.y1 - P.y0);
    g.fillStyle = fg;
    g.fillRect(P.x0, P.y0, P.x1 - P.x0, P.y1 - P.y0);
    g.strokeStyle = 'rgba(60,35,10,0.6)';
    g.lineWidth = Math.max(1, bw * 0.2);
    g.strokeRect(P.x0 + bw * 0.5, P.y0 + bw * 0.5, P.x1 - P.x0 - bw, P.y1 - P.y0 - bw);
    // the painted background, darkened with age, a little light behind the sitter
    const bgc = PORTRAIT_BG[i % PORTRAIT_BG.length];
    const pth = new Path2D();
    if (oval) pth.ellipse(ix + iw / 2, iy + ih / 2, iw / 2, ih / 2, 0, 0, TAU);
    else pth.rect(ix, iy, iw, ih);
    g.fillStyle = bgc;
    g.fill(pth);
    g.save();
    g.clip(pth);
    const lg = g.createRadialGradient(ix + iw * 0.45, iy + ih * 0.35, 0, ix + iw * 0.45, iy + ih * 0.35, ih * 0.7);
    lg.addColorStop(0, 'rgba(255,220,160,0.14)');
    lg.addColorStop(1, 'rgba(255,220,160,0)');
    g.fillStyle = lg;
    g.fillRect(ix, iy, iw, ih);
    const look = { ...SITTERS[(i * 5 + 3) % SITTERS.length], lean: this.R(-0.25, 0.25) };
    const spr = sitterSprite(iw, ih, look);
    if (!live) g.drawImage(spr, ix, iy);
    g.restore();
    if (!live) return;
    // a live sitter is drawn over the room's shading, so it takes that shading now: clipped to its
    // frame, and darkened as much as the room is darkened where it hangs
    const q = spr.getContext('2d');
    q.globalCompositeOperation = 'destination-in';
    q.fillStyle = '#000';
    q.translate(-ix, -iy);
    q.fill(pth);
    q.setTransform(1, 0, 0, 1, 0, 0);
    if (!P.big) {
      const fx = this.fireX;
      const d = Math.hypot(ix + iw / 2 - fx, iy + ih / 2 - this.hb);
      const R = Math.max(w, h) * 0.95;
      q.globalCompositeOperation = 'source-atop';
      q.fillStyle = `rgba(8,4,10,${0.5 * clamp((d - 0.1 * k) / (R - 0.1 * k), 0, 1)})`;
      q.fillRect(0, 0, spr.width, spr.height);
    }
    q.globalCompositeOperation = 'source-over';
    P.spr = spr;
    P.ph = this.R(0, TAU);
    P.f = this.R(0.18, 0.3);
  }

  event(e) {
    super.event(e);
    const layer = e.layer;
    if (e.type !== 'shot') return;
    if (layer === 'snore') {
      this.at(e.at, () => {
        const P = this.portraits[Math.floor(Math.random() * this.portraits.length)];
        if (P) this.snores.push({ P, t0: this.t, dur: Math.max(3, e.dur || 4) });
      });
    }
    if (layer === 'phoenix') this.at(e.at, () => (this.song = { t0: this.t, dur: Math.max(4, e.dur || 12) }));
    if (layer === 'feathers') this.at(e.at, () => (this.ruffle = { t0: this.t }));
    if (layer === 'whirr') {
      this.at(e.at, () => {
        this.whirr = this.t;
        const I = this.instruments.filter((i) => i.kind === 'puffer');
        for (const i of I) this.puff(i, 3);
      });
    }
  }

  puff(I, n) {
    for (let j = 0; j < n; j++) this.puffs.push({ x: I.x + I.s * 0.28, y: I.y - I.s * 0.95, r: I.s * 0.08, age: -j * 0.25, vx: rand(-0.04, 0.08) * I.s, vy: -rand(0.5, 0.8) * I.s });
  }

  // a silver instrument on its table: spinning faster for a while after a whirr is heard
  instrument(g, I, t, dt) {
    const s = I.s;
    const boost = clamp(1 - (t - this.whirr) / 6, 0, 1);
    I.ph += dt * (0.25 + boost * 2.5);
    const silver = (x0, x1) => {
      const sg = g.createLinearGradient(x0, 0, x1, 0);
      sg.addColorStop(0, '#6a7080');
      sg.addColorStop(0.4, '#f0f4ff');
      sg.addColorStop(1, '#7a8090');
      return sg;
    };
    if (I.kind === 'orrery') {
      // a gold sun on a stand, planets wheeling round it on silver arms
      const cx = I.x;
      const cy = I.y - s * 0.55;
      g.fillStyle = silver(cx - s * 0.2, cx + s * 0.2);
      g.beginPath();
      g.ellipse(I.x, I.y, s * 0.22, s * 0.06, 0, 0, TAU);
      g.fill();
      g.fillRect(I.x - s * 0.02, cy, s * 0.04, I.y - cy);
      const planets = [0.38, 0.62, 0.9].map((rr, i) => {
        const a = I.ph * (1.6 - i * 0.45) + i * 2;
        return { x: cx + Math.cos(a) * rr * s, y: cy + Math.sin(a) * rr * s * 0.28, z: Math.sin(a), r: s * (0.06 + i * 0.015), col: ['#c0c8d8', '#6a9ae0', '#e07a4a'][i] };
      });
      g.strokeStyle = 'rgba(200,210,230,0.35)';
      g.lineWidth = Math.max(1, s * 0.02);
      g.beginPath();
      g.ellipse(cx, cy, s * 0.9, s * 0.25, 0, 0, TAU);
      g.stroke();
      const draw = (p) => {
        g.strokeStyle = '#c8d0e0';
        g.lineWidth = Math.max(1, s * 0.025);
        g.beginPath();
        g.moveTo(cx, cy);
        g.lineTo(p.x, p.y);
        g.stroke();
        g.fillStyle = p.col;
        g.beginPath();
        g.arc(p.x, p.y, p.r, 0, TAU);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.5)';
        g.beginPath();
        g.arc(p.x - p.r * 0.3, p.y - p.r * 0.3, p.r * 0.35, 0, TAU);
        g.fill();
      };
      planets.filter((p) => p.z < 0).forEach(draw);
      const sg = g.createRadialGradient(cx - s * 0.04, cy - s * 0.04, 0, cx, cy, s * 0.14);
      sg.addColorStop(0, '#fff2b0');
      sg.addColorStop(1, '#d89a20');
      g.fillStyle = sg;
      g.beginPath();
      g.arc(cx, cy, s * 0.13, 0, TAU);
      g.fill();
      planets.filter((p) => p.z >= 0).forEach(draw);
    } else if (I.kind === 'armillary') {
      // silver rings round a little globe, turning on their own axes
      const cx = I.x;
      const cy = I.y - s * 0.75;
      g.fillStyle = silver(cx - s * 0.12, cx + s * 0.12);
      g.beginPath();
      g.moveTo(cx - s * 0.18, I.y);
      g.lineTo(cx + s * 0.18, I.y);
      g.lineTo(cx + s * 0.03, cy + s * 0.4);
      g.lineTo(cx - s * 0.03, cy + s * 0.4);
      g.fill();
      g.fillStyle = '#4a6aa0';
      g.beginPath();
      g.arc(cx, cy, s * 0.12, 0, TAU);
      g.fill();
      for (let i = 0; i < 3; i++) {
        const a = I.ph * (1 + i * 0.6) + i;
        g.save();
        g.translate(cx, cy);
        g.rotate([0.4, -0.5, 1.4][i]);
        g.strokeStyle = ['#e8eef8', '#b8c0d0', '#f0d080'][i];
        g.lineWidth = Math.max(1.5, s * 0.035);
        g.beginPath();
        g.ellipse(0, 0, s * 0.4, s * 0.4 * Math.max(0.06, Math.abs(Math.cos(a))), 0, 0, TAU);
        g.stroke();
        g.restore();
      }
      g.strokeStyle = '#c8d0e0';
      g.lineWidth = Math.max(1, s * 0.025);
      g.beginPath();
      g.arc(cx, cy, s * 0.46, 0, TAU);
      g.stroke();
    } else {
      // a silver vessel with a thin chimney and a little wheel: it gives off a puff now and then
      const cx = I.x;
      const by = I.y;
      g.fillStyle = silver(cx - s * 0.28, cx + s * 0.28);
      g.beginPath();
      g.moveTo(cx - s * 0.24, by);
      g.quadraticCurveTo(cx - s * 0.34, by - s * 0.42, cx, by - s * 0.5);
      g.quadraticCurveTo(cx + s * 0.34, by - s * 0.42, cx + s * 0.24, by);
      g.closePath();
      g.fill();
      g.fillRect(cx + s * 0.24, by - s * 0.95, s * 0.08, s * 0.6);
      g.strokeStyle = '#e8eef8';
      g.lineWidth = Math.max(1, s * 0.03);
      const wx = cx - s * 0.36;
      const wy = by - s * 0.42;
      g.beginPath();
      g.arc(wx, wy, s * 0.12, 0, TAU);
      for (let i = 0; i < 4; i++) {
        const a = I.ph * 2 + (i * Math.PI) / 2;
        g.moveTo(wx, wy);
        g.lineTo(wx + Math.cos(a) * s * 0.12, wy + Math.sin(a) * s * 0.12);
      }
      g.stroke();
      if (Math.random() < dt / 9) this.puff(I, 1);
    }
  }

  frame(dt) {
    const { g, t, k } = this;
    if (this.wins.length) this.drawView(g, dt);
    g.drawImage(this.room, 0, 0);

    // the sleepers in their frames, breathing; one snoring when a snore is heard
    this.snores = this.snores.filter((s) => t - s.t0 < s.dur + 2);
    for (const P of this.portraits) {
      const sn = this.snores.find((s) => s.P === P);
      let a = 0.012 * Math.sin(t * P.f * TAU + P.ph);
      if (sn) {
        const q = (t - sn.t0) / sn.dur;
        if (q < 1) a += 0.05 * Math.sin(q * Math.PI * 2 * Math.max(1, Math.round(sn.dur / 3.5))) * Math.sin(q * Math.PI);
      }
      g.save();
      g.translate(P.ix + P.iw / 2, P.iy + P.ih);
      g.scale(1 + a * 0.3, 1 + a);
      g.drawImage(P.spr, -P.iw / 2, -P.ih);
      g.restore();
    }
    // the z of a snore, floating up out of the frame
    g.font = `italic ${Math.round(0.022 * k)}px Fraunces, Georgia, serif`;
    for (const sn of this.snores) {
      const P = sn.P;
      for (let j = 0; j < 3; j++) {
        const q = (t - sn.t0 - j * 0.9) / 2.6;
        if (q < 0 || q > 1) continue;
        g.fillStyle = `rgba(240,230,210,${0.8 * Math.sin(q * Math.PI)})`;
        g.fillText('z', P.ix + P.iw * 0.7 + q * 0.03 * k + j * 0.006 * k, P.iy + P.ih * 0.3 - q * 0.06 * k);
      }
    }

    this.lights(g, 0.55);

    // the phoenix's own warm glow, brighter when it sings
    const song = this.song && t - this.song.t0 < this.song.dur ? this.song : null;
    if (this.song && !song && t - this.song.t0 > this.song.dur + 2) this.song = null;
    const singing = song ? clamp(Math.min((t - song.t0) / 1.2, (song.dur - (t - song.t0)) / 1.5), 0, 1) : 0;
    const P = this.perch;
    const S = this.bird.width / 1.2;
    const bx = P.x - S * 0.6;
    const breath = 1 + 0.02 * Math.sin(t * 1.4);
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = Math.min(1, 0.35 + 0.1 * Math.sin(t * 0.7) + 0.65 * singing);
    g.drawImage(this.phoenixGlow, P.x - S * 1.4, P.y - S * 1.6, S * 2.8, S * 2.6);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';

    for (const I of this.instruments) if (!I.front) this.instrument(g, I, t, dt);
    catPile(g, this.cats, this.rug, t, dt);

    // the tail: long golden feathers hanging below the perch, stirring
    {
      g.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const x0 = P.x + S * 0.12 + i * S * 0.02;
        const y0 = P.y - S * 0.06;
        const len = S * (1.15 + (i % 3) * 0.18);
        const sw = Math.sin(t * 0.6 + i * 0.7) * S * 0.04;
        const tg = g.createLinearGradient(0, y0, 0, y0 + len);
        tg.addColorStop(0, '#d8301c');
        tg.addColorStop(0.5, '#f08a28');
        tg.addColorStop(1, '#ffd868');
        g.strokeStyle = tg;
        g.lineWidth = Math.max(1.5, S * (0.05 - i * 0.004));
        g.beginPath();
        g.moveTo(x0, y0);
        g.bezierCurveTo(x0 + S * 0.08, y0 + len * 0.35, x0 + sw + S * 0.02, y0 + len * 0.7, x0 + sw * 1.6 + S * (0.02 + i * 0.012), y0 + len);
        g.stroke();
        g.fillStyle = '#ffd868';
        g.beginPath();
        g.ellipse(x0 + sw * 1.6 + S * (0.02 + i * 0.012), y0 + len, S * 0.025, S * 0.05, 0, 0, TAU);
        g.fill();
      }
    }
    // the body on the perch; a ruffle shakes it and puffs it up for a moment
    let ruff = 0;
    if (this.ruffle) {
      const q = (t - this.ruffle.t0) / 1.6;
      if (q > 1) this.ruffle = null;
      else ruff = Math.sin(q * Math.PI);
    }
    const shake = ruff * Math.sin(t * 40) * 0.02;
    g.save();
    g.translate(P.x, P.y + 0.002 * k);
    g.rotate(shake);
    g.scale((1 + ruff * 0.08) * breath, (1 + ruff * 0.05) * breath);
    g.drawImage(this.bird, -S * 0.6, -S * 1.2, this.bird.width, this.bird.height);
    g.restore();
    // the head: looks about now and then; lifted and singing when its song is heard
    const L = this.look;
    L.next -= dt;
    if (L.next < 0) {
      L.to = Math.random() < 0.5 ? 0 : rand(-0.25, 0.2);
      L.next = rand(4, 12);
    }
    L.a += (L.to - L.a) * Math.min(1, dt * 3);
    this.pblink -= dt;
    if (this.pblink < -0.15) this.pblink = rand(3, 9);
    const open = singing * (0.5 + 0.5 * Math.abs(Math.sin(t * 5.5) * Math.sin(t * 1.7)));
    g.save();
    g.translate(P.x - S * 0.06, P.y - S * 0.62 * breath - ruff * S * 0.03);
    g.rotate(L.a - singing * 0.35);
    g.scale(1.3, 1.3);
    phoenixHead(g, S, open, this.pblink < 0);
    g.restore();
    // golden sparks rising while it sings
    if (singing > 0.1 && Math.random() < dt * 6 * singing) this.puffs.push({ spark: true, x: P.x - S * 0.25 + rand(-1, 1) * S * 0.1, y: P.y - S * 0.9, r: S * 0.02, age: 0, vx: rand(-0.1, 0.1) * S, vy: -rand(0.2, 0.4) * S });
    void bx;

    g.drawImage(this.front, 0, 0);
    for (const I of this.instruments) if (I.front) this.instrument(g, I, t, dt);

    // smoke from the instruments, sparks from the phoenix
    this.puffs = this.puffs.filter((p) => (p.age += dt) < 3);
    for (const p of this.puffs) {
      if (p.age < 0) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.spark) {
        g.fillStyle = `rgba(255,220,120,${0.9 * (1 - p.age / 3)})`;
        g.beginPath();
        g.arc(p.x + Math.sin(p.age * 4 + p.y) * p.r, p.y, p.r * (1 - p.age / 4), 0, TAU);
        g.fill();
        continue;
      }
      p.r += p.r * 0.6 * dt;
      g.globalAlpha = 0.6 * Math.min(1, p.age * 4) * (1 - p.age / 3);
      g.drawImage(this.smoke, p.x - p.r * 1.6, p.y - p.r * 1.6, p.r * 3.2, p.r * 3.2);
      g.globalAlpha = 1;
    }
    const fl = this.flip ? t - this.flip.t0 : null;
    if (fl != null && fl > 0.9) this.flip = null;
    openBook(g, this.book, fl);
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

const PAINTINGS = { storm: Storm, waterfall: Waterfall, garden: Garden, butterfly: Butterfly, glades: Glades, pond: Pond, mansion: Mansion, snow: Snow, halloween: Halloween, christmas: Christmas, lake: LakeRoom, kitchens: Sett, den: Den, eyrie: Eyrie, study: Study, mixer: Blank };

export function createPainting(id, canvas, engine) {
  const P = PAINTINGS[id] || Blank;
  return new P(canvas, engine);
}

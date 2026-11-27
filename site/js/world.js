// What the scenes drawn in three dimensions have in common (storm3d.js, waterfall3d.js): a canvas
// of their own slipped under the stage, a graphics context that can be lost and handed back, a
// clock that stops when nobody's looking, the painting to fall back on, and a table of noise.

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const sstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const rand = (a, b) => a + Math.random() * (b - a);
export const norm = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export function rng(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// a number written so a shader reads it as a float
export const f = (x) => {
  const s = Number(x).toFixed(6);
  return s.includes('.') ? s : s + '.0';
};
// ?gl=off in the address asks for the paintings; ?gl=soft lets a software renderer try (for tests);
// ?gl=1 holds the storm to the older WebGL
export const query = new URLSearchParams(location.search);

// ---------------------------------------------------------------------------------------------
// Noise: one 256 x 256 table of random values. Each texel also carries its three neighbours, so
// a single lookup gives a smooth value (and its slope). Shaders and scripts read the same table,
// so a script can know what a shader will draw.
export const NT = 256;
export const packed = new Uint8Array(NT * NT * 4);
{
  const r = rng(20261126);
  const b = new Uint8Array(NT * NT);
  for (let i = 0; i < b.length; i++) b[i] = (r() * 256) | 0;
  for (let j = 0; j < NT; j++) {
    for (let i = 0; i < NT; i++) {
      const i1 = (i + 1) & 255;
      const j1 = (j + 1) & 255;
      const k = (j * NT + i) * 4;
      packed[k] = b[j * NT + i];
      packed[k + 1] = b[j * NT + i1];
      packed[k + 2] = b[j1 * NT + i];
      packed[k + 3] = b[j1 * NT + i1];
    }
  }
}
export function nzv(x, y) {
  const fx = Math.floor(x);
  const fy = Math.floor(y);
  const tx = x - fx;
  const ty = y - fy;
  const k = ((((fy % NT) + NT) % NT) * NT + (((fx % NT) + NT) % NT)) * 4;
  const a = packed[k] / 255;
  const b = packed[k + 1] / 255;
  const c = packed[k + 2] / 255;
  const d = packed[k + 3] / 255;
  const ux = tx * tx * (3 - 2 * tx);
  const uy = ty * ty * (3 - 2 * ty);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

export const VS = 'attribute vec2 aP;varying vec2 vP;void main(){vP=aP;gl_Position=vec4(aP,0.0,1.0);}';

// tx: the table's four values at a whole-numbered place. nv: smooth noise. nz: noise and its slope.
export const NOISE_GLSL = `
uniform sampler2D uN;
vec4 tx(vec2 p){return TX(p);}
float nv(vec2 x){vec2 p=floor(x),f=x-p;vec4 t=tx(p);vec2 u=f*f*(3.0-2.0*f);
  return t.x+(t.y-t.x)*u.x+(t.z-t.x)*u.y+(t.x-t.y-t.z+t.w)*u.x*u.y;}
vec3 nz(vec2 x){vec2 p=floor(x),f=x-p;vec4 t=tx(p);vec2 u=f*f*(3.0-2.0*f);vec2 du=6.0*f*(1.0-f);
  float k1=t.y-t.x,k2=t.z-t.x,k4=t.x-t.y-t.z+t.w;
  return vec3(t.x+k1*u.x+k2*u.y+k4*u.x*u.y,du*vec2(k1+k4*u.y,k2+k4*u.x));}
`;

// ---------------------------------------------------------------------------------------------
// A scene drawn on the graphics chip. It looks to the player like a painting does (resize, start,
// stop, event, and destroy when it's done with), and becomes one if it has to: where there's no
// WebGL, where a shader won't build, where the context is taken away and not given back, or where
// the scene itself gives up, the painting it replaced takes over and every call is passed on to it.
//
// A scene supplies:
//   setup()            make programs and textures (again after a lost context is handed back)
//   sized(w, h)        the picture should now be w x h pixels
//   step(dt, now, ms)  draw a frame: dt seconds on the scene's clock, ms since the last frame drawn
//   heard(e)           something the sound engine did (optional)
// and calls boot() at the end of its constructor.
export class World {
  // null where it can't be done, so the caller can paint instead
  static create(stage, engine, makeFallback) {
    if (query.get('gl') === 'off') return null;
    try {
      return new this(stage, engine, makeFallback);
    } catch (e) {
      console.warn(`${this.name}: painting it instead.`, e.message || e);
      return null;
    }
  }

  // needs2: this scene can't be drawn with the older WebGL
  constructor(stage, engine, makeFallback, { needs2 = false, maxPixels = 3200000 } = {}) {
    this.stage = stage;
    this.engine = engine;
    this.makeFallback = makeFallback;
    this.fallback = null;
    this.running = false;
    this.lost = false;
    this.gone = false;
    this.t = 0;
    this.timers = new Set();
    this.maxPixels = maxPixels;
    this.coarse = !!(window.matchMedia && matchMedia('(pointer:coarse)').matches);

    const cv = document.createElement('canvas');
    cv.className = 'stage-gl';
    cv.setAttribute('aria-hidden', 'true');
    this.cv = cv;
    this.onLost = (e) => {
      e.preventDefault();
      this.lost = true;
      // phones take the graphics context away now and then; if it isn't handed back, paint instead
      this.later(() => this.lost && this.giveUp(), 2500);
    };
    this.onRestored = () => {
      try {
        this.setup();
        this.lost = false;
        this.cw = 0;
        this.resize();
      } catch {
        this.giveUp();
      }
    };
    cv.addEventListener('webglcontextlost', this.onLost);
    cv.addEventListener('webglcontextrestored', this.onRestored);
    const opts = { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: query.get('gl') !== 'soft' };
    const gl = (query.get('gl') === '1' ? null : cv.getContext('webgl2', opts)) || (needs2 ? null : cv.getContext('webgl', opts));
    if (!gl) throw new Error(needs2 ? 'no WebGL 2 here' : 'no WebGL here');
    this.gl = gl;
    this.GL2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
  }

  // the last thing a scene's constructor does
  boot() {
    try {
      this.setup(); // throws if the shaders won't build on this device
    } catch (e) {
      this.gl.getExtension('WEBGL_lose_context')?.loseContext();
      throw e;
    }
    // the 2D stage stays on top (it takes the taps), cleared so this shows through from beneath it
    this.stage.width = this.stage.height = 2;
    this.stage.parentNode.insertBefore(this.cv, this.stage);
    this.resize();
  }

  get drivers() {
    return this.engine.scene?.drivers || {};
  }
  // how far up a layer of the mix is, 0..1 (d when the scene isn't playing)
  level(id, d) {
    return this.engine.scene?.layers?.get(id)?.level ?? d;
  }

  // ---- programs
  // Build a program from a vertex and a fragment shader written in the older dialect (attribute,
  // varying, gl_FragColor), which is turned into the newer one where the context is WebGL 2.
  // outs: the fragment shader writes to that many targets at once, o0, o1, ... (WebGL 2 only).
  // The work may go on in the background: done() says when it's over, and throws if it failed.
  compile(vs, fs, { outs = 0 } = {}) {
    const gl = this.gl;
    const GL2 = this.GL2;
    const lodExt = !GL2 && gl.getExtension('EXT_shader_texture_lod');
    const TX = GL2
      ? '#define TX(p) texelFetch(uN,ivec2(p)&255,0)\n'
      : lodExt
        ? '#define TX(p) texture2DLodEXT(uN,(mod(p,256.0)+0.5)/256.0,0.0)\n'
        : '#define TX(p) texture2D(uN,(mod(p,256.0)+0.5)/256.0)\n';
    let targets = 'out vec4 fragColor;\n#define gl_FragColor fragColor\n';
    if (outs) targets = Array.from({ length: outs }, (_, i) => `layout(location=${i}) out vec4 o${i};\n`).join('');
    const vsrc = GL2 ? '#version 300 es\n#define attribute in\n#define varying out\n' + vs : vs;
    const fsrc = GL2
      ? '#version 300 es\nprecision highp float;\nprecision highp int;\n#define varying in\n#define texture2D texture\n' + targets + TX + fs
      : (lodExt ? '#extension GL_EXT_shader_texture_lod : enable\n' : '') + 'precision highp float;\n' + TX + fs;
    const p = gl.createProgram();
    const shaders = [
      [gl.VERTEX_SHADER, vsrc],
      [gl.FRAGMENT_SHADER, fsrc],
    ].map(([type, src]) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      gl.attachShader(p, sh);
      return sh;
    });
    gl.bindAttribLocation(p, 0, 'aP');
    gl.linkProgram(p);
    const par = gl.getExtension('KHR_parallel_shader_compile');
    const prog = { p, u: null };
    prog.done = () => {
      if (prog.u) return true;
      if (par && !gl.getProgramParameter(p, par.COMPLETION_STATUS_KHR)) return false;
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        const why = shaders.map((sh) => gl.getShaderInfoLog(sh)).join('') || gl.getProgramInfoLog(p);
        throw new Error('shader: ' + why);
      }
      prog.u = {};
      const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) {
        const name = gl.getActiveUniform(p, i).name;
        prog.u[name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, name);
      }
      return true;
    };
    return prog;
  }
  // the same, waited for
  program(vs, fs, opts) {
    const prog = this.compile(vs, fs, opts);
    this.gl.getProgramParameter(prog.p, this.gl.LINK_STATUS); // asking for this waits for the work to finish
    if (!prog.done()) throw new Error('shader: not built');
    return prog;
  }
  // the table of noise as a texture, on unit 0
  noiseTexture() {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, NT, NT, 0, gl.RGBA, gl.UNSIGNED_BYTE, packed);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    return tex;
  }
  // one triangle that covers the screen, on attribute 0
  screenTriangle() {
    const gl = this.gl;
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    return buf;
  }

  // ---- size
  resize() {
    if (this.fallback) return this.fallback.resize();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = Math.max(2, Math.round(this.stage.clientWidth * dpr));
    let h = Math.max(2, Math.round(this.stage.clientHeight * dpr));
    const k = Math.sqrt(Math.min(1, this.maxPixels / (w * h)));
    w = Math.round(w * k);
    h = Math.round(h * k);
    if (w === this.cw && h === this.ch) return;
    this.cw = w;
    this.ch = h;
    this.sized(w, h);
  }
  // the picture has been drawn for the first time: let it fade up from black
  reveal() {
    if (this.shown) return;
    this.shown = true;
    this.cv.classList.add('on');
  }

  // ---- the clock
  start() {
    if (this.fallback) return this.fallback.start();
    if (this.running) return;
    this.running = true;
    let last = performance.now();
    this.began?.(last);
    const loop = (now) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      const ms = now - last;
      if (ms < 1000 / 31) return; // 30 frames a second is plenty, and kinder to a battery
      last = now;
      if (document.hidden || this.lost) return;
      const dt = Math.min(ms / 1000, 0.1);
      this.t += dt;
      this.step(dt, now, ms);
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop() {
    if (this.fallback) return this.fallback.stop();
    this.running = false;
    cancelAnimationFrame(this.raf);
  }
  // done with: called when the player moves on to another scene, or closes
  destroy() {
    this.stop();
    this.fallback = null;
    this.dispose();
  }
  dispose() {
    if (this.gone) return;
    this.gone = true;
    for (const id of this.timers) clearTimeout(id);
    this.timers.clear();
    this.cv.removeEventListener('webglcontextlost', this.onLost);
    this.cv.removeEventListener('webglcontextrestored', this.onRestored);
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
    this.cv.remove();
  }
  // can't go on: hand over to the painting
  giveUp() {
    if (this.gone) return;
    const was = this.running;
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.dispose();
    this.fallback = this.makeFallback();
    if (was) this.fallback.start();
  }
  later(fn, ms) {
    const id = setTimeout(() => {
      this.timers.delete(id);
      if (!this.gone) fn();
    }, ms);
    this.timers.add(id);
  }
  // run fn when an audio-clock time reaches the speakers
  at(audioTime, fn) {
    this.later(fn, Math.max(0, this.engine.delayUntil(audioTime) * 1000));
  }

  // ---- what the engine tells us
  event(e) {
    if (this.fallback) return this.fallback.event(e);
    this.heard?.(e);
  }
}

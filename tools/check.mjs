// Smoke test + offline audio renders, in headless Chromium.
//
//   node tools/check.mjs ui [outdir]                 load the app at phone size, open every scene,
//                                                   screenshot, fail on console errors
//   node tools/check.mjs render <scene> <seconds> <out.wav> [overrides: id=0.5,...,@driver=0.8,only=a+b]
//                                                   render a scene's mix offline to a WAV file
//                                                   (layer levels, or a driver held at a value)
import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const { chromium } = await import('playwright').catch(() => import('/opt/node-tools/node_modules/playwright/index.mjs'));
const ROOT = new URL('../site/', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json' };

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      let path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^\/+/, '');
      if (!path || path.endsWith('/')) path += 'index.html';
      try {
        const body = await readFile(join(ROOT, path));
        res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' });
        res.end(body);
      } catch {
        res.writeHead(404);
        res.end('not found');
      }
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

const server = await serve();
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const [mode, ...args] = process.argv.slice(2);
let failed = false;

try {
  if (mode === 'ui') {
    const out = args[0] || 'shots';
    await mkdir(out, { recursive: true });
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'dark' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(base);
    await page.waitForSelector('.card');
    await page.screenshot({ path: `${out}/home.png`, fullPage: true });
    const ids = await page.$$eval('.card', (cs) => cs.map((c) => c.dataset.scene));
    for (const id of ids) {
      await page.click(`.card[data-scene="${id}"]`);
      await page.waitForFunction(() => !document.querySelector('#play.busy'), null, { timeout: 30000 });
      await page.waitForTimeout(2500);
      const info = await page.evaluate(() => {
        const e = window.ambiance.engine;
        return { state: e.ctx?.state, scene: e.scene?.def.id, paused: e.paused, layers: [...(e.scene?.layers.values() || [])].map((l) => `${l.id}:${l.state}`) };
      });
      console.log(id, JSON.stringify(info));
      await page.screenshot({ path: `${out}/${id}.png` });
      await page.click('#mix-btn');
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${out}/${id}-mix.png` });
      await page.keyboard.press('Escape');
      await page.click('#back');
      await page.waitForTimeout(400);
    }
    await page.screenshot({ path: `${out}/home-playing.png` });
    // light theme too
    const light = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'light' });
    const lp = await light.newPage();
    await lp.goto(base);
    await lp.waitForSelector('.card');
    await lp.screenshot({ path: `${out}/home-light.png`, fullPage: true });
    const wide = await browser.newContext({ viewport: { width: 1280, height: 860 }, colorScheme: 'dark' });
    const wp = await wide.newPage();
    await wp.goto(base);
    await wp.waitForSelector('.card');
    await wp.screenshot({ path: `${out}/home-wide.png` });
    if (errors.length) {
      failed = true;
      console.error('console errors:\n' + errors.join('\n'));
    } else console.log('no console errors');
  } else if (mode === 'offline') {
    // play a scene online (its sounds get cached), then cut the network, reload, and play it again
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(base);
    await page.waitForFunction(() => navigator.serviceWorker?.controller || navigator.serviceWorker?.ready.then(() => true));
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
    const id = args[0] || 'waterfall';
    await page.click(`.card[data-scene="${id}"]`);
    await page.waitForFunction(() => !document.querySelector('#play.busy'), null, { timeout: 60000 });
    await page.waitForTimeout(4000);
    await ctx.setOffline(true);
    await page.goto(base); // leave the scene…
    await page.reload(); // …and load the whole app again, from the service worker's cache
    await page.waitForSelector('.card', { timeout: 15000 });
    await page.click(`.card[data-scene="${id}"]`);
    await page.waitForFunction(() => !document.querySelector('#play.busy'), null, { timeout: 30000 });
    await page.waitForTimeout(3000);
    const info = await page.evaluate(() => {
      const e = window.ambiance.engine;
      return { scene: e.scene?.def.id, state: e.ctx?.state, paused: e.paused, layers: [...(e.scene?.layers.values() || [])].map((l) => `${l.id}:${l.state}`) };
    });
    console.log('offline replay:', JSON.stringify(info));
    const bad = info.layers.filter((l) => l.endsWith(':error'));
    if (!info.scene || bad.length || errors.length) {
      failed = true;
      console.error('offline problems:', bad, errors);
    } else console.log('offline OK');
  } else if (mode === 'render') {
    const [sceneId, seconds = '60', outFile = `${sceneId}.wav`, overrides = ''] = args;
    const page = await browser.newPage();
    page.on('console', (m) => ['error', 'warning'].includes(m.type()) && console.error('[page]', m.text()));
    await page.goto(base);
    await page.waitForSelector('.card');
    const result = await page.evaluate(
      async ({ sceneId, seconds, overrides }) => {
        const { Engine, Scene } = await import('./js/engine.js');
        const { buildScenes } = await import('./js/scenes.js');
        const manifest = await (await fetch('audio/manifest.json')).json();
        const def = buildScenes(manifest.pools).find((s) => s.id === sceneId);
        // pin slow drivers (storm strength, wind) to the middle of their range so loudness
        // measurements are repeatable; dawn ramps are left alone
        for (const d of Object.values(def.drivers || {})) {
          if (d.range && !d.ramp) {
            const m = (d.range[0] + d.range[1]) / 2;
            d.range = [m, m];
            d.start = m;
          }
        }
        const levels = Object.fromEntries(def.layers.map((l) => [l.id, l.level ?? 0]));
        for (const kv of overrides.split(',').filter(Boolean)) {
          const [k, v] = kv.split('=');
          // "@name=value" holds a driver still (a storm stage, say); anything else is a layer level
          if (k.startsWith('@')) def.drivers[k.slice(1)] = { range: [Number(v), Number(v)], start: Number(v) };
          // "only=rain+thunder" mutes every other layer
          else if (k === 'only') for (const id of Object.keys(levels)) levels[id] = v.split('+').includes(id) ? levels[id] : 0;
          else levels[k] = Number(v);
        }
        const rate = 48000;
        const ctx = new OfflineAudioContext(2, Math.round(rate * seconds), rate);
        const engine = new Engine();
        engine.attach(ctx);
        engine.master.gain.value = 0.72; // the app's default volume (0.85 on a squared fader)
        const scene = new Scene(engine, def, levels);
        engine.scene = scene;
        const events = [];
        engine.addEventListener('scene-event', (e) => events.push({ type: e.detail.type, layer: e.detail.layer, at: +e.detail.at.toFixed(2) }));
        await scene.start(0.5);
        await Promise.allSettled([...scene.layers.values()].map((l) => l.loading).filter(Boolean));
        const states = [...scene.layers.values()].map((l) => `${l.id}:${l.state}`);
        const step = 0.2;
        scene.tick(0);
        const plan = (t) =>
          ctx.suspend(t).then(() => {
            scene.tick(t);
            if (t + step < seconds - 0.01) plan(+(t + step).toFixed(3));
            ctx.resume();
          });
        plan(step);
        const buf = await ctx.startRendering();
        const L = buf.getChannelData(0);
        const R = buf.getChannelData(1);
        let peak = 0;
        let sum = 0;
        const pcm = new Int16Array(L.length * 2);
        for (let i = 0; i < L.length; i++) {
          const l = L[i];
          const r = R[i];
          peak = Math.max(peak, Math.abs(l), Math.abs(r));
          sum += l * l + r * r;
          pcm[2 * i] = Math.max(-32768, Math.min(32767, l * 32767));
          pcm[2 * i + 1] = Math.max(-32768, Math.min(32767, r * 32767));
        }
        const bytes = new Uint8Array(pcm.buffer);
        let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        return { b64: btoa(bin), peak, rms: Math.sqrt(sum / (2 * L.length)), states, events, rate };
      },
      { sceneId, seconds: Number(seconds), overrides },
    );
    const data = Buffer.from(result.b64, 'base64');
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + data.length, 4);
    header.write('WAVEfmt ', 8);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(2, 22);
    header.writeUInt32LE(result.rate, 24);
    header.writeUInt32LE(result.rate * 4, 28);
    header.writeUInt16LE(4, 32);
    header.writeUInt16LE(16, 34);
    header.write('data', 36);
    header.writeUInt32LE(data.length, 40);
    await writeFile(outFile, Buffer.concat([header, data]));
    const counts = {};
    for (const e of result.events) counts[`${e.layer}:${e.type}`] = (counts[`${e.layer}:${e.type}`] || 0) + 1;
    console.log(JSON.stringify({ scene: sceneId, peak_dbfs: +(20 * Math.log10(result.peak || 1e-9)).toFixed(1), rms_dbfs: +(20 * Math.log10(result.rms || 1e-9)).toFixed(1), layers: result.states, events: counts }));
    console.log('wrote', outFile);
  } else {
    console.log('usage: node tools/check.mjs ui [outdir] | render <scene> <seconds> <out.wav> [id=level,...]');
  }
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);

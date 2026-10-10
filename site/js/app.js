import { Engine, sceneFiles } from './engine.js';
import { buildScenes } from './scenes.js';
import { createPainting } from './visuals.js';
import { icons, thumbs, logo } from './art.js';
import { store } from './store.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const engine = new Engine();
window.ambiance = { engine }; // handy from the console, and for tests
let scenes = [];
let byId = {};
let credits = [];
let shown = null; // the scene open in the player
let painting = null;
let busy = false;

// ---------------------------------------------------------------- boot
async function boot() {
  $('#logo').innerHTML = logo;
  $('#back').innerHTML = icons.back;
  $('#dim').innerHTML = icons.moon;
  $('#mix-btn').innerHTML = `${icons.mix}<span>Mix</span>`;
  $$('[data-close]').forEach((b) => (b.innerHTML = icons.close));
  updateTimerButton();

  const manifest = await fetch('audio/manifest.json')
    .then((r) => r.json())
    .catch(() => ({ pools: {} }));
  credits = manifest.credits || [];
  scenes = buildScenes(manifest.pools || {});
  byId = Object.fromEntries(scenes.map((s) => [s.id, s]));
  renderHome();
  wireHome();
  wirePlayer();
  wireEngine();
  window.addEventListener('hashchange', route);
  route();
  registerServiceWorker();
  setupInstall();
}

// ---------------------------------------------------------------- levels
function defaults(def) {
  return Object.fromEntries(def.layers.map((l) => [l.id, l.level ?? 0]));
}
function levelsFor(def) {
  return { ...defaults(def), ...store.get('levels:' + def.id, {}) };
}

// ---------------------------------------------------------------- home
function renderHome() {
  $('#scene-list').innerHTML = scenes
    .map(
      (s) => `<li><button class="card" data-scene="${s.id}" aria-label="${esc(s.name)}: ${esc(s.what)}">
        <span class="thumb">${thumbs[s.id] || thumbs.mixer}<span class="live"><i></i>Playing</span></span>
        <span class="name">${esc(s.name)}</span>
        <span class="what">${esc(s.what)}</span>
      </button></li>`,
    )
    .join('');
}

function wireHome() {
  $('#scene-list').addEventListener('click', (e) => {
    const card = e.target.closest('[data-scene]');
    if (!card) return;
    const def = byId[card.dataset.scene];
    // Start sound inside the tap itself: browsers only allow audio to begin from a gesture.
    const already = engine.scene?.def.id === def.id;
    if (!already) start(def);
    else if (engine.paused) engine.unpause();
    location.hash = '#/' + def.id;
  });

  const hp = $('#set-headphones');
  hp.setAttribute('aria-checked', String(engine.hrtf));
  hp.addEventListener('click', () => {
    const on = hp.getAttribute('aria-checked') !== 'true';
    hp.setAttribute('aria-checked', String(on));
    engine.setHeadphones(on);
    toast(on ? 'Headphones mode on: sounds now come from all around you.' : 'Speaker mode: simple left–right placement.');
  });

  const aw = $('#set-awake');
  aw.setAttribute('aria-checked', String(store.get('awake', false)));
  aw.addEventListener('click', () => {
    const on = aw.getAttribute('aria-checked') !== 'true';
    aw.setAttribute('aria-checked', String(on));
    store.set('awake', on);
    keepAwake();
  });

  $('#save-offline').addEventListener('click', saveOffline);
  $('#open-credits').addEventListener('click', showCredits);
  $$('[data-close-dialog]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));

  $('#now-open').addEventListener('click', () => {
    if (engine.scene) location.hash = '#/' + engine.scene.def.id;
  });
  $('#now-toggle').addEventListener('click', togglePlay);
}

function updateNowBar() {
  const s = engine.scene?.def;
  const bar = $('#now');
  bar.hidden = !s || !!shown;
  if (s) {
    $('#now-name').textContent = s.name;
    $('#now-state').textContent = engine.paused ? 'Paused' : sleepLabel() || 'Playing';
    $('#now-toggle').innerHTML = engine.paused ? icons.play : icons.pause;
    $('#now-toggle').setAttribute('aria-label', engine.paused ? 'Play' : 'Pause');
  }
  $$('.card').forEach((c) => c.classList.toggle('playing', !!s && c.dataset.scene === s.id && !engine.paused));
}

// ---------------------------------------------------------------- routing
function route() {
  const m = location.hash.match(/^#\/([\w-]+)/);
  const def = m && byId[m[1]];
  if (def) openPlayer(def);
  else closePlayer();
}

function openPlayer(def) {
  if (shown?.id !== def.id) {
    shown = def;
    $('#scene-title').textContent = def.name;
    $('#scene-kicker').textContent = def.kicker || '';
    painting?.stop();
    painting = createPainting(def.id, $('#stage'), engine);
    renderMix(def);
  }
  $('#player').hidden = false;
  document.title = `${def.name} · Ambiance`;
  requestAnimationFrame(() => {
    painting.resize();
    painting.start();
  });
  setDim(false);
  updatePlayButton();
  updateNowBar();
  poke();
  // the blank canvas opens on its sound picker
  if (def.id === 'mixer' && !Object.values(levelsFor(def)).some((v) => v > 0)) openSheet('mix-sheet');
}

function closePlayer() {
  if (!shown && $('#player').hidden) return;
  shown = null;
  painting?.stop();
  painting = null;
  closeSheets();
  $('#player').hidden = true;
  document.title = 'Ambiance';
  updateNowBar();
}

// ---------------------------------------------------------------- playback
async function start(def) {
  engine.ensure();
  setBusy(true);
  try {
    await engine.play(def, levelsFor(def));
    const failed = [...(engine.scene?.layers.values() || [])].filter((l) => l.state === 'error');
    if (failed.length) toast(navigator.onLine ? 'Some sounds didn’t load. Try again in a moment.' : 'You’re offline, and these sounds aren’t saved on this device yet.');
  } catch (e) {
    console.error(e);
    toast("Couldn't start the sound. Check your connection and try again.");
  }
  setBusy(false);
  mediaSession(def);
  keepAwake();
}

function togglePlay() {
  const def = shown || engine.scene?.def;
  if (!def) return;
  engine.ensure();
  if (engine.scene?.def.id !== def.id) start(def);
  else if (engine.paused) engine.unpause();
  else engine.pause();
}

function setBusy(on) {
  busy = on;
  $('#status').textContent = on ? 'Gathering the sounds…' : '';
  updatePlayButton();
}

function updatePlayButton() {
  const b = $('#play');
  const playing = !!shown && engine.scene?.def.id === shown.id && !engine.paused;
  b.classList.toggle('busy', busy);
  b.innerHTML = busy ? icons.spinner : playing ? icons.pause : icons.play;
  b.setAttribute('aria-label', playing ? 'Pause' : 'Play');
}

function wireEngine() {
  engine.addEventListener('scene-event', (e) => {
    if (painting && shown && e.detail.scene === shown.id) painting.event(e.detail);
  });
  const refresh = () => {
    updatePlayButton();
    updateNowBar();
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = engine.paused ? 'paused' : 'playing';
    keepAwake();
  };
  engine.addEventListener('play', refresh);
  engine.addEventListener('pause', refresh);
  engine.addEventListener('slept', () => {
    updateTimerButton();
    refresh();
  });
  engine.addEventListener('layer-state', (e) => {
    const row = $(`.mixrow[data-layer="${e.detail.layer}"]`);
    if (!row || e.detail.scene !== shown?.id) return;
    row.classList.toggle('wait', e.detail.state === 'loading');
    row.classList.toggle('err', e.detail.state === 'error');
  });
  // Phones interrupt audio (calls, Siri); pick back up when we're visible again.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && engine.scene && !engine.paused) engine.resume();
    if (!document.hidden) keepAwake();
  });
}

function mediaSession(def) {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: def.name,
      artist: 'Ambiance',
      album: def.kicker || '',
      artwork: [
        { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    });
    navigator.mediaSession.setActionHandler('play', () => engine.unpause());
    navigator.mediaSession.setActionHandler('pause', () => engine.pause());
    navigator.mediaSession.setActionHandler('stop', () => {
      engine.stop();
      updateNowBar();
    });
  } catch {
    /* partial support */
  }
}

let wakeLock = null;
async function keepAwake() {
  const want = store.get('awake', false) && engine.scene && !engine.paused && !document.hidden;
  try {
    if (want && !wakeLock && navigator.wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => (wakeLock = null));
    } else if (!want && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    wakeLock = null;
  }
}

// ---------------------------------------------------------------- player chrome
function wirePlayer() {
  $('#back').addEventListener('click', () => {
    if (history.length > 1 && location.hash) history.back();
    else location.hash = '';
  });
  $('#play').addEventListener('click', togglePlay);
  $('#mix-btn').addEventListener('click', () => toggleSheet('mix-sheet'));
  $('#timer-btn').addEventListener('click', () => toggleSheet('timer-sheet'));
  $('#dim').addEventListener('click', () => setDim(true));
  $('#veil').addEventListener('click', () => setDim(false));
  $('#stage').addEventListener('click', closeSheets); // tap the picture to put the sheet away
  $$('[data-close]').forEach((b) => b.addEventListener('click', closeSheets));
  $('#mix-reset').addEventListener('click', () => {
    if (!shown) return;
    store.set('levels:' + shown.id, {});
    applyLevels(shown, defaults(shown));
  });
  $('#mix-save').addEventListener('click', () => {
    $('#mix-name').value = '';
    $('#save-mix').showModal();
    setTimeout(() => $('#mix-name').focus(), 50);
  });
  $('#mix-name-ok').addEventListener('click', () => {
    const name = $('#mix-name').value.trim() || `Mix ${store.get('mixes', []).length + 1}`;
    const mixes = store.get('mixes', []).filter((m) => m.name !== name);
    mixes.push({ name, levels: levelsFor(shown) });
    store.set('mixes', mixes);
    $('#save-mix').close();
    renderMixes();
    toast(`Saved “${name}”.`);
  });

  // timer chips
  const choices = [
    [0, 'Off'],
    [15, '15 min'],
    [30, '30 min'],
    [45, '45 min'],
    [60, '1 hour'],
    [90, '1½ hours'],
    [120, '2 hours'],
    [240, '4 hours'],
  ];
  $('#timer-chips').innerHTML = choices.map(([m, l]) => `<button class="chip" data-min="${m}" aria-pressed="false">${l}</button>`).join('');
  $('#timer-chips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-min]');
    if (!b) return;
    const min = Number(b.dataset.min);
    engine.sleepIn(min);
    store.set('timer', min);
    updateTimerButton();
    closeSheets();
    if (min) toast(`Fading out in ${b.textContent.replace(' min', ' minutes')}.`);
  });
  setInterval(updateTimerButton, 15000);

  // controls tuck themselves away while you listen
  const player = $('#player');
  ['pointerdown', 'pointermove', 'keydown'].forEach((ev) => player.addEventListener(ev, poke, { passive: true }));
  window.addEventListener('resize', () => painting?.resize());
  document.addEventListener('keydown', (e) => {
    if (!shown) return;
    if (e.key === ' ' && !e.target.closest('input, button, dialog')) {
      e.preventDefault();
      togglePlay();
    }
    if (e.key === 'Escape') {
      if ($('.sheet:not(.closed)')) closeSheets();
      else if ($('#player').classList.contains('dim')) setDim(false);
    }
  });
}

let idleTimer;
let sleepyTimer;
function poke() {
  const p = $('#player');
  p.classList.remove('idle');
  clearTimeout(idleTimer);
  clearTimeout(sleepyTimer);
  idleTimer = setTimeout(() => {
    if (shown && !engine.paused && !$('.sheet:not(.closed)')) p.classList.add('idle');
  }, 6000);
  // with a sleep timer running, you're probably drifting off: go dark after two quiet minutes
  sleepyTimer = setTimeout(() => {
    if (shown && engine.sleepAt && !engine.paused && !$('.sheet:not(.closed)')) setDim(true);
  }, 120000);
}

function setDim(on) {
  $('#player').classList.toggle('dim', on);
  if (!painting) return;
  if (on) setTimeout(() => $('#player').classList.contains('dim') && painting?.stop(), 2600);
  else painting.start();
}

function sleepLabel() {
  if (!engine.sleepAt) return '';
  const min = Math.max(1, Math.round((engine.sleepAt - Date.now()) / 60000));
  return min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}` : `${min} min`;
}

function updateTimerButton() {
  const label = sleepLabel();
  const b = $('#timer-btn');
  b.innerHTML = `${icons.timer}<span>${label || 'Timer'}</span>`;
  b.classList.toggle('on', !!label);
  const current = engine.sleepAt ? store.get('timer', 0) : 0;
  $$('#timer-chips .chip').forEach((c) => c.setAttribute('aria-pressed', String(Number(c.dataset.min) === current)));
  updateNowBar();
}

function toggleSheet(id) {
  const el = $('#' + id);
  if (el.classList.contains('closed')) openSheet(id);
  else closeSheets();
}
function openSheet(id) {
  closeSheets();
  $('#' + id).classList.remove('closed');
  $('#player').classList.remove('idle');
}
function closeSheets() {
  $$('.sheet').forEach((s) => s.classList.add('closed'));
  poke();
}

// ---------------------------------------------------------------- mix sheet
function renderMix(def) {
  const levels = levelsFor(def);
  const isMixer = def.id === 'mixer';
  $('#mix-title').textContent = isMixer ? 'Pick your sounds' : 'Mix';
  $('#mix-hint').textContent = isMixer
    ? 'Tap a sound to bring it in, slide to set how near it is. Save mixes you like.'
    : 'Everything here is a real recording. Slide to taste; it’s remembered.';
  $('#mix-save').hidden = !isMixer;
  let group = null;
  let html = '';
  for (const l of def.layers) {
    if (l.group && l.group !== group) {
      group = l.group;
      html += `<div class="group">${esc(group)}</div>`;
    }
    const v = levels[l.id] ?? 0;
    const state = engine.scene?.def.id === def.id ? engine.layerState(l.id) : 'idle';
    html += `<div class="mixrow ${v > 0 ? 'on' : ''} ${state === 'loading' ? 'wait' : ''} ${state === 'error' ? 'err' : ''}" data-layer="${l.id}">
      <button class="ico" aria-label="Turn ${esc(l.label)} ${v > 0 ? 'off' : 'on'}">${icons[l.icon] || icons.noise}</button>
      <label for="lv-${l.id}">${esc(l.label)}<small>${Math.round(v * 100)}%</small></label>
      <input type="range" id="lv-${l.id}" min="0" max="100" step="1" value="${Math.round(v * 100)}" style="--p:${v * 100}%">
    </div>`;
  }
  $('#mix-rows').innerHTML = html;
  renderMixes();

  $('#mix-rows').oninput = (e) => {
    const input = e.target.closest('input[type=range]');
    if (!input) return;
    const row = input.closest('.mixrow');
    setLayer(def, row.dataset.layer, input.value / 100);
  };
  $('#mix-rows').onclick = (e) => {
    const btn = e.target.closest('.ico');
    if (!btn) return;
    const id = btn.closest('.mixrow').dataset.layer;
    const levels = levelsFor(def);
    const layer = def.layers.find((l) => l.id === id);
    const prev = store.get(`prev:${def.id}:${id}`, layer.level || 0.5);
    if (levels[id] > 0) store.set(`prev:${def.id}:${id}`, levels[id]);
    setLayer(def, id, levels[id] > 0 ? 0 : prev || 0.5);
  };
}

function setLayer(def, id, v) {
  const levels = levelsFor(def);
  levels[id] = v;
  store.set('levels:' + def.id, levels);
  const row = $(`.mixrow[data-layer="${id}"]`);
  if (row) {
    row.classList.toggle('on', v > 0);
    const input = row.querySelector('input');
    input.value = Math.round(v * 100);
    input.style.setProperty('--p', `${v * 100}%`);
    row.querySelector('small').textContent = `${Math.round(v * 100)}%`;
    row.querySelector('.ico').setAttribute('aria-label', `Turn ${def.layers.find((l) => l.id === id).label} ${v > 0 ? 'off' : 'on'}`);
  }
  if (engine.scene?.def.id === def.id) engine.setLevel(id, v);
  else if (v > 0 && def.id === shown?.id) start(def); // raising a sound on a stopped scene starts it
}

function applyLevels(def, levels) {
  store.set('levels:' + def.id, levels);
  for (const l of def.layers) {
    if (engine.scene?.def.id === def.id) engine.setLevel(l.id, levels[l.id] ?? 0);
  }
  renderMix(def);
}

function renderMixes() {
  const box = $('#mixes');
  if (shown?.id !== 'mixer') {
    box.hidden = true;
    return;
  }
  const mixes = store.get('mixes', []);
  box.hidden = !mixes.length;
  box.innerHTML = mixes
    .map((m, i) => `<button class="chip ghost" data-mix="${i}">${esc(m.name)}<span class="x" data-del="${i}" aria-label="Delete ${esc(m.name)}">×</span></button>`)
    .join('');
  box.onclick = (e) => {
    const del = e.target.closest('[data-del]');
    const all = store.get('mixes', []);
    if (del) {
      const m = all[del.dataset.del];
      if (m && confirm(`Delete “${m.name}”?`)) {
        all.splice(del.dataset.del, 1);
        store.set('mixes', all);
        renderMixes();
      }
      return;
    }
    const b = e.target.closest('[data-mix]');
    if (!b) return;
    const m = all[b.dataset.mix];
    applyLevels(shown, { ...Object.fromEntries(shown.layers.map((l) => [l.id, 0])), ...m.levels });
    if (!engine.scene || engine.scene.def.id !== shown.id) start(shown);
    toast(`“${m.name}”`);
  };
}

// ---------------------------------------------------------------- credits, offline, install
function showCredits() {
  const list = $('#credit-list');
  list.innerHTML = credits.length
    ? credits
        .map(
          (c) =>
            `<li><b>${esc(c.what)}</b> — <a href="${esc(c.page)}" target="_blank" rel="noopener">${esc(c.title)}</a> by ${esc(c.author || 'unknown')} · <a href="${esc(c.license_url || '#')}" target="_blank" rel="noopener">${esc(c.license)}</a>${c.note ? ` · ${esc(c.note)}` : ''}</li>`,
        )
        .join('')
    : '<li>Credits will appear here once sounds are installed.</li>';
  $('#credits').showModal();
}

async function saveOffline() {
  const btn = $('#save-offline');
  const files = [...new Set(scenes.flatMap((s) => sceneFiles(s)))];
  if (!('caches' in window)) {
    toast('This browser can’t store sounds for offline use.');
    return;
  }
  btn.disabled = true;
  let done = 0;
  const cache = await caches.open('ambiance-audio');
  const queue = [...files];
  const worker = async () => {
    while (queue.length) {
      const url = queue.shift();
      try {
        if (!(await cache.match(url))) {
          const r = await fetch(url);
          if (r.ok) await cache.put(url, r);
        }
      } catch {
        /* skip; will retry next time */
      }
      done++;
      btn.textContent = `${Math.round((done / files.length) * 100)}%`;
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  btn.textContent = 'Saved';
  $('#offline-note').textContent = 'Every scene is stored on this device and works without a connection.';
  store.set('offline', true);
}

function setupInstall() {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone) return;
  const row = $('#install-row');
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios) {
    row.hidden = false;
    $('#install-note').textContent = 'In Safari, tap the Share button, then “Add to Home Screen”.';
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    row.hidden = false;
    $('#install-note').textContent = 'Install Ambiance as an app: full screen, works offline.';
    const b = $('#install-btn');
    b.hidden = false;
    b.onclick = async () => {
      e.prompt();
      await e.userChoice.catch(() => {});
      row.hidden = true;
    };
  });
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('sw.js').catch((e) => console.warn('service worker', e));
  if (store.get('offline', false)) {
    $('#save-offline').textContent = 'Update';
    $('#offline-note').textContent = 'Every scene is stored on this device and works without a connection.';
  }
}

let toastTimer;
function toast(msg) {
  let t = $('.toast');
  if (!t) {
    t = document.createElement('div');
    t.className = 'toast';
    t.setAttribute('role', 'status');
    document.body.append(t);
  }
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 3200);
}

boot();

# Ambiance

Realistic ambient soundscapes you can put on your home screen. Every sound is a real field recording.
None of them loops audibly: long recordings crossfade between random points, and the one-off sounds
(a bird, a creak, a roll of thunder) arrive at natural, irregular moments from different places around you.

**Scenes**

| | |
|---|---|
| **Storm at Sea** | Breakers, rain and a gale; thunder that arrives after its lightning, later and duller the further away it is. A red buoy rides the swell. |
| **Forest Waterfall** | Falls, a creek, forest air and leaves; birds that each keep their own perch and sing in bouts. |
| **Sunrise Garden** | A real dawn chorus that builds over 25 minutes as the sky (and the birds) wake up. |
| **Butterfly Garden** | A Florida yard full of pollinators: big tropical hibiscus in sunset colours, milkweed and a rainbow of native wildflowers under a live oak hung with Spanish moss; zebra longwings and monarchs working the flowers, hummingbirds at the firebush and sage, cicadas, bees and a breeze in the palms. Ten Florida birds (cardinal, mockingbird, Carolina wren, blue jay, red-bellied woodpecker, northern parula, tufted titmouse, mourning and ground doves, a red-shouldered hawk overhead), each shown in its own colours when it sings. |
| **Everglades Storm** | Summer thunderstorms over the sawgrass, seen from under a big bald cypress hung with moss, its knees poking out of the slough. The scene opens as the gust front hits; it rains most of the time, the downpour with thunder overhead easing to steady rain as each storm moves off, then dripping, frogs starting up and a rainbow, a short steamy lull and the next thunderhead building. Thunder comes from as far away as the storm is. |
| **Cypress Pond** | The same night: a chorus of Florida frogs round a moonlit cypress pond (each species on its own slider, each frog shown with its throat puffed out as it calls), crickets and katydids, owls and a chuck-will's-widow in the cypress, an alligator bellowing, fireflies over the water. |
| **Haunted Mansion** | Wind in the eaves, a hall clock, the fire, the house settling, something walking upstairs (watch the candle move between windows). |
| **Snowy Woods** | Wind in the pines, snow slumping off branches, footsteps passing, the lake ice singing. |
| **Blank Canvas** | A black screen and every sound in the app, plus white/pink/brown noise. Save your own mixes. |

Every scene has a **Mix** sheet (each layer on its own slider, every bird species too, remembered), a **sleep timer** that fades out
over the last minute and a half, and **Dim** for a black screen. **Headphones mode** places sounds in 3D
(behind, above, moving past) using the browser's HRTF panner. On a phone's lock screen, ◀◀ and ▶▶ step
between scenes.

## Put it on your phone

The app is served from GitHub Pages: **https://ambiance.paperhurts.dev**

- **iPhone / iPad:** open the link in Safari → Share → **Add to Home Screen**.
- **Android:** open it in Chrome → menu → **Install app** (or use the Install button under Settings).

It works offline: scenes you've played are kept on the device, and **Settings → Offline → Save all** stores
the rest.

### One-time setup: turn on GitHub Pages

Repository **Settings → Pages → Build and deployment → Source: GitHub Actions**. After that, every push to
`main` deploys automatically (`.github/workflows/pages.yml`).

## How it works

```
site/                 the app (no build step, plain ES modules)
  js/engine.js        Web Audio engine: beds, shots, bird flocks, thunder, clock, generated noise/wind/drone
  js/scenes.js        the scenes: which recordings, default levels, where sounds sit in space
  js/visuals.js       the animated paintings (canvas)
  js/app.js           interface: home, player, mix sheet, timer, offline, install
  sw.js               service worker (offline)
  audio/              encoded sounds + manifest.json (generated)
tools/
  sources/*.json      every recording used: where it came from, its licence, which part of it we use
  build_audio.py      downloads the originals, cuts, cleans, loudness-matches and encodes them
  check.mjs           headless-browser smoke test, and offline renders of a scene to WAV
  render_icons.mjs    PNG icons from the SVGs
```

### Realism tricks

- **No audible loops.** Beds are long recordings made seamlessly loopable, then the engine jumps to a
  random point every 30–75 s with a 5–10 s equal-power crossfade, so the pattern never repeats.
- **Events have places.** Shots are positioned around you; distance lowers the level, takes the top off
  (air absorption) and adds reverb. In headphones mode they're rendered binaurally.
- **Birds behave like birds.** Each one has a perch, sings a bout of phrases with short gaps, rests, and
  eventually moves. Activity follows the dawn.
- **Weather breathes.** Slow "drivers" (storm strength, wind) push rain, gusts and thunder up and down
  together over minutes.
- **Thunder obeys physics.** Lightning first; the thunder 2.9 s per km later, quieter and duller with distance.
- **One acoustic space per scene.** Generated reverbs (hall, room, forest, open air, snow) glue the
  recordings into one place.

### Swapping or adding a sound

1. Add an entry to `tools/sources/<scene>.json` (source URL, segment, licence; see the docstring in
   `tools/build_audio.py` for all fields). The key's pool name (`storm/rain-3` → pool `storm/rain`) decides
   which layer it joins.
2. `python3 tools/build_audio.py` (needs `ffmpeg` and `numpy`).
3. Commit `tools/sources/*.json` and `site/audio/`.

Check everything still runs: `node tools/check.mjs ui shots/` (Playwright + Chromium).

## Credits

All recordings are public domain or Creative Commons licensed; the full list (with links and licences) is in
the app under **Settings → Credits**, and in `tools/sources/*.json`. Fonts: Fraunces and Nunito (SIL Open Font
Licence). Palette borrowed from *Beyond the Buoys*.

Most of the Florida birds and frogs come from [xeno-canto](https://xeno-canto.org) under CC BY-NC-SA (and a
few frogs from [iNaturalist](https://www.inaturalist.org) under CC BY-NC), which allow non-commercial use only.
That's fine for a free app; if Ambiance were ever sold or carried ads, those recordings would need replacing.

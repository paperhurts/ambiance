// Little pictures: the scene cards and the interface icons, as inline SVG.

const svg = (body, vb = '0 0 24 24') =>
  `<svg viewBox="${vb}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const icons = {
  play: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>`,
  pause: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect fill="currentColor" x="6" y="5" width="4.2" height="14" rx="1.3"/><rect fill="currentColor" x="13.8" y="5" width="4.2" height="14" rx="1.3"/></svg>`,
  spinner: svg('<path d="M12 3a9 9 0 1 0 9 9" />'),
  back: svg('<path d="M15 5l-7 7 7 7" />'),
  moon: svg('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />'),
  timer: svg('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9.5 2.5h5" />'),
  mix: svg('<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18" />'),
  // layer icons
  wave: svg('<path d="M2 15c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M2 19c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M7 10c0-3 2-5 5-5 2 0 3 1 3.5 2" />'),
  rain: svg('<path d="M7 15a4 4 0 0 1-.6-7.95A6 6 0 0 1 18 8a3.5 3.5 0 0 1 0 7M8 18l-1 3M12 18l-1 3M16 18l-1 3" />'),
  wind: svg('<path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h7" />'),
  bolt: svg('<path d="M13 2L5 13h6l-1 9 8-11h-6l1-9z" />'),
  fire: svg('<path d="M12 22c4 0 7-2.8 7-6.8 0-4.2-3.5-6.7-4.5-11.2-2 1.8-3 4-3 6-1-.8-1.8-2-2-3.2C7.2 8.8 5 11.6 5 15.2 5 19.2 8 22 12 22z" />'),
  water: svg('<path d="M12 3s6 6.4 6 10.5A6 6 0 0 1 6 13.5C6 9.4 12 3 12 3z" />'),
  falls: svg('<path d="M4 3h16M7 3v11M12 3v14M17 3v11M3 19c2 0 2-1.5 4.5-1.5S10 19 12 19s2-1.5 4.5-1.5S19 19 21 19" />'),
  leaf: svg('<path d="M5 19c0-8 5-14 15-15-1 10-7 15-15 15zM5 19l8-8" />'),
  bird: svg('<path d="M3 14c3 0 5-1 7-4 1.5-2.5 4-4 6.5-3L21 6l-2.5 2c.5 4-2.5 9-9 9-3 0-5-1-6.5-3zM9 17l-1 4M13 16.5l1 4.5" />'),
  owl: svg('<path d="M6 4l2 3h8l2-3v9a6 6 0 0 1-12 0V4z"/><circle cx="9.5" cy="10.5" r="1.6"/><circle cx="14.5" cy="10.5" r="1.6"/><path d="M11.2 13.5L12 15l.8-1.5" />'),
  clock: svg('<path d="M8 2h8v20H8zM8 7h8M12 11v5"/><circle cx="12" cy="17" r="1.5"/>'),
  steps: svg('<path d="M8 3c2 0 3 2 3 4.5S10 13 8.5 13 6 10 6 7.5 6.5 3 8 3zM7 15.5h3M16 9c2 0 3 2 3 4.5S18 19 16.5 19 14 16 14 13.5 14.5 9 16 9zM15 21.5h3" />'),
  door: svg('<path d="M5 21V3h11v18M16 5l3 1v15M3 21h18"/><circle cx="13" cy="12" r="1"/>'),
  creak: svg('<path d="M3 17h18M3 13h18M6 13v4M12 13v4M18 13v4M5 9c2-2 4 2 6 0s4 2 6 0 2-1 3-1" />'),
  bell: svg('<path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2zM10 21h4" />'),
  snow: svg('<path d="M12 2v20M4.5 6.5l15 11M19.5 6.5l-15 11M9 4l3 2 3-2M9 20l3-2 3 2" />'),
  ice: svg('<path d="M3 14l5-3 4 2 4-3 5 2M3 18h18M8 11l-1 3M16 10l1 4" />'),
  crunch: svg('<path d="M4 20l3-4 3 2 3-5 3 3 4-6M4 8h2M9 5h2M15 4h2" />'),
  noise: svg('<path d="M2 12h2l1-5 2 10 2-12 2 14 2-9 2 6 2-4 1 2h4" />'),
  drone: svg('<path d="M2 12c3-6 5-6 8 0s5 6 8 0 3-4 4-4" />'),
  piano: svg('<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M8 5v14M13 5v14M18 5v14M7 5v8M12 5v8M17 5v8" />'),
  moonlight: svg('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />'),
  bee: svg('<ellipse cx="12" cy="14" rx="4" ry="5.5"/><path d="M8.5 12h7M8.5 15.5h7M12 8.5c-1.5-3-5-4-6.5-2.5S7 10 12 8.5zM12 8.5c1.5-3 5-4 6.5-2.5S17 10 12 8.5z" />'),
  rooster: svg('<path d="M7 20h10M10 20l1-4M14 20l-1-4M6 9c0-3 2-5 5-5 1 0 2 .5 2 .5S14 3 15 3s.5 2 0 2.5c2 1 3 3.5 3 6 0 3.5-3 5.5-6 5.5s-6-2-6-5.5L4 11z" />'),
  ghost: svg('<path d="M6 20V10a6 6 0 1 1 12 0v10l-2-2-2 2-2-2-2 2-2-2-2 2z"/><circle cx="10" cy="10" r="1"/><circle cx="14" cy="10" r="1"/>'),
  palm: svg('<path d="M12 22c0-5 .5-9 1.5-12M13.5 10C11 6 7 5 3 6.5M13.5 10c1-4 4-6.5 8-6M13.5 10c3-1.5 6.5-1 8.5 1.5M13.5 10C10 9 6.5 10.5 4.5 13" />'),
  cicada: svg('<ellipse cx="12" cy="13" rx="3" ry="6"/><path d="M9.5 9C6 7 3 8.5 2.5 12c3 .5 5.5-.5 7-2.5M14.5 9C18 7 21 8.5 21.5 12c-3 .5-5.5-.5-7-2.5M10 7l-1.5-2M14 7l1.5-2" />'),
  hummingbird: svg('<path d="M3 11l7.5 1M10.5 12c1.5-3 4-4 6-3.5 1.5.4 2.5 1.6 2.5 3 0 2.5-2.5 4.5-6 4.5L9 20l2.5-5.5M16 7.5c0-2 1.5-4 4-4.5-1 2-1.5 3.5-2 5M13 12c-1-2.5-.5-5.5 1.5-8" />'),
  butterfly: svg('<path d="M12 7v12M12 9C9 3 3 3.5 3 8s4 5 9 4c5 1 9 .5 9-4s-6-5-9 1zM12 13c-3 0-6 1.5-6 4s3 3 6-1c3 4 6 3 6 1s-3-4-6-4zM12 7l-2-3M12 7l2-3" />'),
  sun: svg('<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" />'),
  frog: svg('<path d="M4 15c0-3.5 3.5-6 8-6s8 2.5 8 6-3 5-8 5-8-1.5-8-5z"/><circle cx="8" cy="8.5" r="2.3"/><circle cx="16" cy="8.5" r="2.3"/><path d="M9 15.5c1.8 1 4.2 1 6 0M4.5 17L2 19.5M19.5 17L22 19.5" />'),
  cricket: svg('<path d="M5 15.5l9-5a2.8 2.8 0 0 1 3 4.6l-9 4.2a2.5 2.5 0 0 1-3-3.8zM15.5 10.5L21 4M16.5 11.5l5.5-3M8 18.5L6.5 21.5M12 16.5l1 3.5M15 14.5l3.5 2.5" />'),
  gator: svg('<path d="M2.5 14.5c3-2.5 6-3.5 10-3.5h3.5c2 0 3.5 1 5.5 2-2 1.2-4 2-8.5 2H2.5z"/><circle cx="15.5" cy="10.2" r="1.2"/><path d="M2 18.5c3 0 3-1.5 6-1.5s3 1.5 6 1.5 3-1.5 6-1.5" />'),
  headphones: svg('<path d="M4 15v-3a8 8 0 1 1 16 0v3"/><rect x="3" y="14" width="4" height="7" rx="1.5"/><rect x="17" y="14" width="4" height="7" rx="1.5"/>'),
};

// ---- scene cards (160 × 120) ----
// The butterfly garden card is mostly flowers, so its petals are built in code.
const ring = (n, f) => Array.from({ length: n }, (_, i) => f((i * 360) / n)).join('');
const at = (x, y, body, extra = '') => `<g transform="translate(${x} ${y})"${extra}>${body}</g>`;
const hibiscus = (x, y, r, rot = 0) =>
  at(x, y, ring(5, (a) => `<ellipse cy="${-r * 0.55}" rx="${r * 0.22}" ry="${r * 0.55}" transform="rotate(${a + rot})"/>`) +
    `<path d="M0 0Q${r * 0.25} ${-r * 0.45} ${r * 0.42} ${-r * 0.85}" stroke="#a80b25" stroke-width="${r * 0.08}" fill="none"/><circle cx="${r * 0.43}" cy="${-r * 0.88}" r="${r * 0.09}" fill="#f5c542"/>`, ' fill="#d3142f"');
const mallow = (x, y, r, petal) =>
  at(x, y, ring(5, (a) => `<ellipse cy="${-r * 0.5}" rx="${r * 0.46}" ry="${r * 0.55}" transform="rotate(${a + 18})"/>`) +
    `<circle r="${r * 0.3}" fill="#9d1238"/><circle cx="${r * 0.12}" cy="${-r * 0.2}" r="${r * 0.08}" fill="#f4d35e"/>`, ` fill="${petal}"`);
const daisy = (x, y, r, n, petal, centre, tip) =>
  at(x, y, ring(n, (a) => `<ellipse cy="${-r * 0.6}" rx="${r * 0.21}" ry="${r * 0.45}" fill="${petal}" transform="rotate(${a})"/>` + (tip ? `<circle cy="${-r * 0.92}" r="${r * 0.17}" fill="${tip}" transform="rotate(${a})"/>` : '')) +
    `<circle r="${r * 0.3}" fill="${centre}"/>`);
const UMBEL = [[-0.8, 0.1], [-0.5, -0.25], [-0.15, -0.42], [0.2, -0.4], [0.55, -0.24], [0.82, 0.08], [-0.38, 0.1], [0.04, -0.06], [0.42, 0.08]];
const umbel = (x, y, r, dark, light) =>
  at(x, y, UMBEL.map(([u, v]) => `<circle cx="${u * r}" cy="${v * r}" r="${r * 0.22}" fill="${dark}"/><circle cx="${u * r - r * 0.04}" cy="${v * r - r * 0.07}" r="${r * 0.1}" fill="${light}"/>`).join(''));
const spike = (x, y, h, cols) =>
  Array.from({ length: 9 }, (_, i) => `<circle cx="${x + Math.sin(i * 2.1) * 0.7}" cy="${y - (i * h) / 9}" r="${1.5 - i * 0.08}" fill="${cols[i % cols.length]}"/>`).join('');
const passion = (x, y, r) =>
  at(x, y, ring(10, (a) => `<ellipse cy="${-r * 0.55}" rx="${r * 0.16}" ry="${r * 0.45}" fill="#f3edf9" transform="rotate(${a})"/>`) +
    `<circle r="${r * 0.62}" fill="none" stroke="#8c5cc8" stroke-width="${r * 0.3}" stroke-dasharray="${r * 0.08} ${r * 0.08}"/><circle r="${r * 0.3}" fill="#4b1f73"/><circle r="${r * 0.14}" fill="#a8c66c"/>`);
const FRONDS = [-200, -172, -146, -121, -96, -71, -46, -21, 4, 26];
// a tropical hibiscus like the ones in Sid's yard: five ruffled lobes round a dark eye, a long
// column dusted with pollen and five round stigma pads
const LOBE = Array.from({ length: 13 }, (_, i) => {
  const a = -0.74 + (1.48 * i) / 12;
  const rr = 0.55 + 0.45 * Math.cos(a * 1.9);
  return [Math.cos(a) * rr, Math.sin(a) * rr];
});
const tropical = (x, y, r, id, petal, eye, edge, eyeSize = 0.32) =>
  at(x, y,
    `<defs><radialGradient id="${id}" cx="0" cy="0" r="${r}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${eye}"/><stop offset="${eyeSize}" stop-color="${eye}"/><stop offset="${eyeSize + 0.15}" stop-color="${petal}"/><stop offset=".86" stop-color="${petal}"/><stop offset="1" stop-color="${edge}"/></radialGradient></defs>` +
      ring(5, (a) => `<path d="M0 0L${LOBE.map(([u, v]) => `${(u * r).toFixed(2)} ${(v * r).toFixed(2)}`).join('L')}Z" fill="url(#${id})" stroke="rgba(80,20,10,.15)" stroke-width=".3" transform="rotate(${a - 72})"/>`) +
      `<path d="M0 0Q${r * 0.27} ${-r * 0.06} ${r * 0.6} ${-r * 0.42}" stroke="#b3122f" stroke-width="${r * 0.07}" fill="none"/>` +
      [0.62, 0.7, 0.78, 0.86].map((t, i) => `<circle cx="${(r * 0.6 * t + (i % 2 ? 1 : -1) * r * 0.05).toFixed(2)}" cy="${(-r * 0.42 * t * t).toFixed(2)}" r="${r * 0.045}" fill="#f8b61e"/>`).join('') +
      ring(5, (a) => `<circle cx="${(r * 0.64 + Math.cos((a * Math.PI) / 180) * r * 0.06).toFixed(2)}" cy="${(-r * 0.47 + Math.sin((a * Math.PI) / 180) * r * 0.06).toFixed(2)}" r="${r * 0.05}" fill="#f28a10"/>`));
// a clump of upright leaves fanning out from a base
const bush = (x, y, w, h, col, light) =>
  at(x, y, `<ellipse cy="${-h * 0.15}" rx="${w * 0.5}" ry="${h * 0.32}" fill="${col}"/>` + Array.from({ length: 11 }, (_, i) => {
    const t = i / 10 - 0.5;
    const cx = t * w * 0.85;
    const cy = -h * 0.42 * (1 - Math.abs(t) * 1.1);
    return `<ellipse cx="${cx}" cy="${cy}" rx="${w * 0.075}" ry="${h * 0.5}" fill="${i % 3 ? col : light}" transform="rotate(${t * 120} ${cx} ${cy})"/>`;
  }).join(''));
const TUBES = [-60, -30, 0, 30, 60];
const firebush = (x, y) =>
  bush(x, y, 22, 14, '#2a5530', '#3a6b3c') + [[-5, -11], [1, -14], [6, -10]].map(([u, v]) => at(x + u, y + v, TUBES.map((a) => `<ellipse cy="-2.2" rx=".6" ry="2.2" transform="rotate(${a})"/>`).join(''), ' fill="#e4572e"')).join('');

export const thumbs = {
  storm: `<svg viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="ts-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#071219"/><stop offset="1" stop-color="#244651"/></linearGradient></defs>
    <rect width="160" height="120" fill="url(#ts-sky)"/>
    <ellipse cx="40" cy="22" rx="58" ry="20" fill="#1a3039"/><ellipse cx="118" cy="16" rx="60" ry="18" fill="#152a32"/>
    <path d="M98 26 L88 46 L96 46 L86 68" fill="none" stroke="#FFF6E5" stroke-width="2.4" stroke-linejoin="round"/>
    <g stroke="#CFE8EC" stroke-opacity=".35" stroke-width="1"><path d="M20 30l-6 18M44 34l-6 18M70 28l-6 18M126 32l-6 18M146 30l-6 18M30 52l-5 14M108 50l-5 14M136 56l-5 14"/></g>
    <path d="M0 74 Q20 66 40 74 T80 74 T120 74 T160 74 V120 H0Z" fill="#163039"/>
    <path d="M0 88 Q24 78 48 88 T96 88 T144 88 T192 88 V120 H0Z" fill="#0f242c"/>
    <path d="M0 102 Q30 92 60 102 T120 102 T180 102 V120 H0Z" fill="#081a20"/>
    <path d="M30 86q6-4 12 0M88 99q7-4 14 0M118 84q6-4 12 0" stroke="#E6F2F2" stroke-opacity=".6" stroke-width="1.6" fill="none"/>
    <g transform="translate(122 80) rotate(-8)"><path d="M-5 0h10l-2.5-12h-5z" fill="#A3332A"/><rect x="-3.4" y="-8" width="6.8" height="2.4" fill="#E4572E"/><circle cy="-14.5" r="2.2" fill="#FF7A5C"/></g>
  </svg>`,
  waterfall: `<svg viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="tw-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d7ecf0"/><stop offset=".55" stop-color="#5f9f8a"/><stop offset="1" stop-color="#16352b"/></linearGradient>
    <linearGradient id="tw-fall" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e8f6f6" stop-opacity=".4"/><stop offset=".5" stop-color="#fff"/><stop offset="1" stop-color="#e8f6f6" stop-opacity=".4"/></linearGradient></defs>
    <rect width="160" height="120" fill="url(#tw-sky)"/>
    <path d="M0 44 L12 30 L22 44 L32 28 L44 44 L56 32 L66 44 L80 30 L92 44 L104 28 L116 44 L130 30 L142 44 L156 30 L160 36 V60 H0Z" fill="#4f8a7a" opacity=".7"/>
    <path d="M0 40 L60 34 L66 92 L0 104Z" fill="#24453d"/><path d="M160 36 L94 33 L90 92 L160 108Z" fill="#24453d"/>
    <rect x="64" y="34" width="30" height="60" fill="url(#tw-fall)"/>
    <g stroke="#fff" stroke-opacity=".8" stroke-width="1"><path d="M70 40v14M76 50v16M82 38v12M88 56v14M73 70v12M85 74v10"/></g>
    <ellipse cx="80" cy="96" rx="70" ry="14" fill="#2f6f73"/>
    <ellipse cx="79" cy="92" rx="26" ry="6" fill="#fff" opacity=".55"/><ellipse cx="72" cy="84" rx="18" ry="8" fill="#fff" opacity=".2"/><ellipse cx="92" cy="80" rx="14" ry="7" fill="#fff" opacity=".18"/>
    <path d="M6 120 Q10 98 22 92 M14 120 Q20 102 34 98 M150 120 Q146 100 136 94 M142 120 Q138 106 124 100" stroke="#0f2a22" stroke-width="3" fill="none"/>
  </svg>`,
  garden: `<svg viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="tg-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b3f6b"/><stop offset=".55" stop-color="#f0b8a2"/><stop offset="1" stop-color="#ffd9a0"/></linearGradient>
    <radialGradient id="tg-sun"><stop offset="0" stop-color="#ffe2a0"/><stop offset="1" stop-color="#ffe2a0" stop-opacity="0"/></radialGradient></defs>
    <rect width="160" height="120" fill="url(#tg-sky)"/>
    <circle cx="108" cy="70" r="40" fill="url(#tg-sun)"/><circle cx="108" cy="70" r="11" fill="#ffd27a"/>
    <path d="M0 74 Q40 62 80 70 T160 66 V120 H0Z" fill="#2f5545"/>
    <rect y="80" width="160" height="40" fill="#244636"/>
    <g fill="#5a3d27"><rect x="0" y="72" width="160" height="2"/><rect x="0" y="78" width="160" height="2"/><rect x="8" y="68" width="3" height="14"/><rect x="30" y="68" width="3" height="14"/><rect x="52" y="68" width="3" height="14"/><rect x="74" y="68" width="3" height="14"/><rect x="96" y="68" width="3" height="14"/><rect x="118" y="68" width="3" height="14"/><rect x="140" y="68" width="3" height="14"/></g>
    <g transform="translate(36 68)"><ellipse cx="0" cy="-3" rx="5" ry="3.6" fill="#1b2421"/><circle cx="4" cy="-6.5" r="2.6" fill="#1b2421"/><path d="M6 -7l3.6 -.6-3.2 1.8z" fill="#E4A23D"/><path d="M-4 -3l-5 3 .6-2z" fill="#1b2421"/></g>
    <g><circle cx="20" cy="100" r="4" fill="#FFC53D"/><circle cx="46" cy="108" r="3.4" fill="#F4A3B4"/><circle cx="70" cy="98" r="3.6" fill="#FFF6E5"/><circle cx="98" cy="106" r="4" fill="#E4572E"/><circle cx="126" cy="98" r="3.4" fill="#B89BE8"/><circle cx="148" cy="108" r="3.8" fill="#FFC53D"/></g>
    <path d="M0 18 Q30 24 58 20" stroke="#2b2018" stroke-width="3" fill="none"/><ellipse cx="18" cy="16" rx="6" ry="3" fill="#213a28"/><ellipse cx="34" cy="22" rx="5" ry="2.6" fill="#213a28"/><ellipse cx="48" cy="18" rx="5" ry="2.4" fill="#213a28"/>
  </svg>`,
  mansion: `<svg viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="tm-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#07060f"/><stop offset=".7" stop-color="#2a2140"/><stop offset="1" stop-color="#0b0912"/></linearGradient>
    <radialGradient id="tm-moon"><stop offset="0" stop-color="#e6e1ff" stop-opacity=".35"/><stop offset="1" stop-color="#e6e1ff" stop-opacity="0"/></radialGradient></defs>
    <rect width="160" height="120" fill="url(#tm-sky)"/>
    <circle cx="118" cy="30" r="36" fill="url(#tm-moon)"/><circle cx="118" cy="30" r="13" fill="#ece8f4"/>
    <path d="M0 98 Q70 78 160 94 V120 H0Z" fill="#05040a"/>
    <path d="M36 92 V64 L46 52 L56 64 L62 64 L62 46 L68 30 L74 46 L74 62 L92 62 L100 52 L108 62 V92Z" fill="#05040a"/>
    <rect x="44" y="40" width="3" height="10" fill="#05040a"/><rect x="96" y="44" width="3" height="8" fill="#05040a"/>
    <rect x="66" y="50" width="4" height="6" fill="#FFC870"/><rect x="42" y="72" width="5" height="7" fill="#FFB65C" opacity=".9"/><rect x="96" y="72" width="5" height="7" fill="#3a2a40"/>
    <path d="M140 100 L138 70 M138 82 L128 72 M138 76 L148 64 M128 72 L122 70 M148 64 L152 58" stroke="#05040a" stroke-width="2.2" fill="none"/>
    <path d="M18 34c2-2 4 0 5 0s3-2 5 0" stroke="#05040a" stroke-width="1.4" fill="none"/>
  </svg>`,
  snow: `<svg viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="tn-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0F2A40"/><stop offset=".6" stop-color="#2E5A7A"/><stop offset="1" stop-color="#9DB9CF"/></linearGradient></defs>
    <rect width="160" height="120" fill="url(#tn-sky)"/>
    <path d="M0 64 Q40 44 80 58 T160 52 V120 H0Z" fill="#6E8FAA"/>
    <path d="M0 76 L8 62 L16 76 L24 58 L32 76 L40 64 L48 76 L56 60 L64 76 L72 64 L80 76 L88 58 L96 76 L104 62 L112 76 L120 60 L128 76 L136 64 L144 76 L152 60 L160 76 V90 H0Z" fill="#3d6380"/>
    <path d="M0 92 Q50 84 100 90 T160 88 V120 H0Z" fill="#dbe7f0"/>
    <g transform="translate(118 90)"><rect x="-12" y="-11" width="24" height="11" fill="#3a2a22"/><path d="M-15 -10 L0 -21 L15 -10Z" fill="#e8f0f6"/><rect x="-7" y="-8" width="5" height="4.5" fill="#FFC870"/><rect x="5" y="-20" width="3" height="6" fill="#2c201a"/></g>
    <path d="M14 120 L26 84 L38 120Z M30 120 L42 92 L54 120Z" fill="#0f2233"/>
    <g fill="#fff"><circle cx="20" cy="20" r="1.2"/><circle cx="46" cy="36" r="1"/><circle cx="70" cy="14" r="1.4"/><circle cx="96" cy="30" r="1"/><circle cx="130" cy="18" r="1.3"/><circle cx="150" cy="40" r="1"/><circle cx="60" cy="56" r="1.2"/><circle cx="108" cy="58" r="1"/><circle cx="84" cy="74" r="1.3"/><circle cx="140" cy="70" r="1"/><circle cx="30" cy="66" r="1"/></g>
  </svg>`,
  butterfly: `<svg viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="tb-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#78c3dc"/><stop offset=".62" stop-color="#cdeeee"/><stop offset="1" stop-color="#fbefcf"/></linearGradient>
    <linearGradient id="tb-grass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7aa352"/><stop offset="1" stop-color="#2f5a2e"/></linearGradient>
    <radialGradient id="tb-sun"><stop offset="0" stop-color="#fffbe6"/><stop offset="1" stop-color="#fffbe6" stop-opacity="0"/></radialGradient>
    <radialGradient id="tb-muhly"><stop offset="0" stop-color="#e98cbf" stop-opacity=".85"/><stop offset="1" stop-color="#e98cbf" stop-opacity="0"/></radialGradient></defs>
    <rect width="160" height="120" fill="url(#tb-sky)"/>
    <circle cx="138" cy="15" r="24" fill="url(#tb-sun)"/><circle cx="138" cy="15" r="7" fill="#fff8de"/>
    <path d="M0 70Q10 62 20 68Q30 60 42 67Q54 61 66 68Q80 62 92 68Q104 61 116 67Q128 62 140 68Q150 63 160 66V78H0Z" fill="#8db59a"/>
    <path d="M131 76Q127 54 133 31" stroke="#7a6a52" stroke-width="2.2" fill="none"/>
    ${at(133, 31, FRONDS.map((a) => `<path transform="rotate(${a})" d="M0 0L15 -3.5L14 -1.6L17 -.6L14 .4L17 1.4L14 2.4L15 3.5Z"/>`).join(''), ' fill="#3f6e46"')}
    <g fill="url(#tb-muhly)"><ellipse cx="14" cy="74" rx="16" ry="7"/><ellipse cx="52" cy="73" rx="18" ry="7"/><ellipse cx="98" cy="74" rx="17" ry="7"/><ellipse cx="146" cy="73" rx="18" ry="7"/></g>
    <rect y="75" width="160" height="45" fill="url(#tb-grass)"/>
    ${[12, 44, 78, 148].map((x) => bush(x, 86, 28, 9, '#3d6b3a', '#4f7f45')).join('')}
    <g stroke="#2f5a2e" stroke-width=".9"><path d="M34 85V71M39 85V74M70 85V73M146 85V77"/></g>
    ${spike(34, 84, 14, ['#9a46c8', '#b56ad8'])}${spike(39, 85, 11, ['#7f34aa', '#9a46c8'])}${spike(70, 84, 11, ['#5b4fd0', '#2e5a2a', '#2e5a2a'])}
    ${firebush(102, 86)}
    ${hibiscus(146, 79, 6, 10)}${daisy(118, 80, 4, 8, '#ffd21f', '#7b4a12')}
    ${[20, 62, 102, 142].map((x) => bush(x, 101, 36, 12, '#2f5d33', '#437a42')).join('')}
    <g stroke="#2f5a2e" stroke-width="1"><path d="M60 99V92M88 99V91M112 99V95M136 99V93"/></g>
    ${mallow(60, 91, 8, '#f6bcd0')}${umbel(88, 91, 6, '#c64480', '#f4a3c8')}${passion(112, 95, 7)}${daisy(136, 93, 5, 8, '#ffd21f', '#7b4a12')}
    ${[22, 64, 106, 148].map((x) => bush(x, 122, 44, 16, '#24492a', '#35663a')).join('')}
    <g stroke="#2a5230" stroke-width="1.3"><path d="M22 118V101M52 118V109M80 118V111M106 118V107M124 118V113M146 118V109"/></g>
    ${tropical(24, 99, 17, 'tb-hib-y', '#f6cd1a', '#8e0f2b', '#fadc40')}${umbel(52, 108, 10, '#e35d16', '#ffa94d')}${daisy(80, 110, 8.5, 12, '#c0391b', '#6e1b14', '#f7c02a')}
    ${daisy(106, 106, 8, 12, '#f6ab0c', '#2b170a')}${daisy(124, 113, 6.5, 12, '#f9b918', '#2b170a')}${daisy(146, 108, 5.5, 6, '#fcfcf7', '#efbe2a')}${daisy(155, 116, 4.5, 6, '#fcfcf7', '#efbe2a')}
    <g transform="translate(80 46) rotate(-12)"><path d="M0 0C-8-15-26-14-24-6C-22 0-8 2 0 0C8-15 26-14 24-6C22 0 8 2 0 0" fill="#161616"/><path d="M0 0C-5 6-15 9-16 5C-17 2-8 0 0 0C5 6 15 9 16 5C17 2 8 0 0 0" fill="#161616"/><path d="M-3-3L-21-8M-3 1L-13 5M3-3L21-8M3 1L13 5" stroke="#ffe066" stroke-width="1.5"/><ellipse rx="1" ry="5" fill="#111"/></g>
    <g transform="translate(116 66) rotate(8)"><path d="M0 0C-4-8-12-8-11-2C-10 2-4 2 0 0C4-8 12-8 11-2C10 2 4 2 0 0" fill="#e8741a"/><path d="M0 0C-3 4-8 5-8 2.5C-8 1-4 0 0 0C3 4 8 5 8 2.5C8 1 4 0 0 0" fill="#e8741a"/><path d="M-1-1L-9-4M1-1L9-4" stroke="#1a1a1a" stroke-width=".8"/><ellipse rx=".7" ry="3.2" fill="#1a1a1a"/></g>
    <g transform="translate(47 85) scale(1.35)"><ellipse rx="4.4" ry="2.2" fill="#2e8b57" transform="rotate(-20)"/><circle cx="-3.4" cy="-1.6" r="1.8" fill="#2e8b57"/><circle cx="-3" cy="-.2" r="1.3" fill="#c1121f"/><path d="M-5 -1.6L-11 1" stroke="#222" stroke-width=".8"/><path d="M4 .6L8 2.6L7.5 .2Z" fill="#245c3c"/><ellipse cx="1" cy="-4.5" rx="2" ry="5" fill="#dcebf0" opacity=".75" transform="rotate(30 1 -4.5)"/></g>
    <g transform="translate(104 56)"><path d="M-9 0H3" stroke="#3b6fb6" stroke-width="1.3"/><circle cx="4" r="1.5" fill="#3b6fb6"/><g fill="#e6f3fa" opacity=".8"><ellipse cx="1" cy="-3.6" rx="1.2" ry="3.6"/><ellipse cx="-1.5" cy="-3.2" rx="1.1" ry="3.2"/><ellipse cx="1" cy="3.6" rx="1.2" ry="3.6"/><ellipse cx="-1.5" cy="3.2" rx="1.1" ry="3.2"/></g></g>
  </svg>`,
  glades: `<svg viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="tgl-sky" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5aa4d6"/><stop offset=".55" stop-color="#7c98ad"/><stop offset="1" stop-color="#3b4652"/></linearGradient>
    <linearGradient id="tgl-cb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fdfcf8"/><stop offset=".6" stop-color="#e3e1db"/><stop offset="1" stop-color="#9aa3ad"/></linearGradient>
    <linearGradient id="tgl-rain" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a5562" stop-opacity=".8"/><stop offset="1" stop-color="#5b6672" stop-opacity=".35"/></linearGradient>
    <linearGradient id="tgl-grass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a39a55"/><stop offset="1" stop-color="#5d5b2d"/></linearGradient></defs>
    <rect width="160" height="120" fill="url(#tgl-sky)"/>
    <path d="M84 14Q88 8 102 7L152 9Q158 11 150 13Q128 14 116 22Z" fill="#e9e7e1"/>
    <g fill="url(#tgl-cb)">${[[96, 30, 11], [108, 26, 12], [102, 40, 13], [116, 36, 12], [94, 50, 12], [110, 48, 14], [124, 46, 11], [100, 58, 11], [114, 58, 12], [126, 56, 10]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>
    <path d="M84 62H134V66H84Z" fill="#59636e"/><path d="M84 66H134L140 78H80Z" fill="url(#tgl-rain)"/>
    <path d="M118 66l-4 6 3 1-5 8" stroke="#f4f7ff" stroke-width="1.3" fill="none"/>
    <g fill="#465a45"><path d="M0 79Q8 72 16 79Z"/><path d="M40 79Q50 71 62 79Z"/><path d="M138 79Q148 73 160 79Z"/></g>
    <rect y="78" width="160" height="42" fill="url(#tgl-grass)"/>
    <path d="M14 92Q60 86 110 92Q70 99 14 96Z" fill="#9db7c7" opacity=".85"/>
    <g stroke="#6c6a33" stroke-width="1.1" stroke-linecap="round"><path d="M6 120l3-26M12 120l-1-22M20 120l4-24M30 120l-2-20M118 120l3-24M126 120l-2-28M134 120l4-22M146 120l-1-26M154 120l3-20"/></g>
    <g stroke="#5d6b34" stroke-width="1.2"><path d="M24 120V86M140 120V82"/></g><g fill="#5a3a22"><ellipse cx="24" cy="89" rx="1.6" ry="4.5"/><ellipse cx="140" cy="85" rx="1.6" ry="4.5"/></g>
    <g transform="translate(40 40)" stroke="#f6f4ec" stroke-width="1.4" fill="none" stroke-linecap="round"><path d="M-9 -2Q-4 -6 0 0Q4 -6 9 -2"/></g>
  </svg>`,
  pond: `<svg viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="tpd-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#060b16"/><stop offset="1" stop-color="#1c2a3d"/></linearGradient>
    <radialGradient id="tpd-moon"><stop offset="0" stop-color="#e6e8d8" stop-opacity=".4"/><stop offset="1" stop-color="#e6e8d8" stop-opacity="0"/></radialGradient>
    <radialGradient id="tpd-fly"><stop offset="0" stop-color="#eeff9a"/><stop offset=".3" stop-color="#c8f060" stop-opacity=".7"/><stop offset="1" stop-color="#b0e040" stop-opacity="0"/></radialGradient>
    <radialGradient id="tpd-eye"><stop offset="0" stop-color="#ff9a50"/><stop offset="1" stop-color="#e05020" stop-opacity="0"/></radialGradient></defs>
    <rect width="160" height="120" fill="url(#tpd-sky)"/>
    <g fill="#dfe6ff">${[[20, 12], [44, 22], [70, 8], [86, 30], [132, 40], [150, 14], [60, 36], [28, 40], [118, 8]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".6"/>`).join('')}</g>
    <circle cx="104" cy="20" r="24" fill="url(#tpd-moon)"/><circle cx="104" cy="20" r="7" fill="#efeadb"/>
    <path d="M0 62Q10 50 20 60Q28 46 40 58Q52 48 62 59Q74 46 86 58Q98 50 108 60Q120 46 132 58Q146 50 160 60V68H0Z" fill="#070c10"/>
    <rect y="66" width="160" height="54" fill="#0a121b"/>
    <path d="M0 68Q10 76 20 70Q28 80 40 70Q52 78 62 70Q74 80 86 70Q98 76 108 70Q120 80 132 70Q146 76 160 70V66H0Z" fill="#0d151d"/>
    <g fill="#e8e4c8" opacity=".55"><rect x="100" y="70" width="8" height=".8"/><rect x="98" y="75" width="12" height=".8"/><rect x="99" y="81" width="10" height=".8"/><rect x="97" y="88" width="14" height=".8"/></g>
    <path d="M12 0V112M14 112Q10 106 6 120H26Q20 106 16 112" stroke="#0b1014" stroke-width="7" fill="#0b1014"/>
    <path d="M14 30Q30 24 46 28M14 50Q28 44 40 48" stroke="#0c1216" stroke-width="2" fill="none"/>
    <g stroke="#8d9aa4" stroke-width=".6" fill="none" opacity=".75"><path d="M24 28q1 8-1 14q2 4 0 8M30 27q-1 6 1 12q-2 5 0 9M36 27q1 7-1 11M42 28q-1 5 1 9q-1 4 1 6M22 47q1 6-1 10M28 46q-1 7 1 12M34 46q1 5-1 8"/></g>
    <g fill="#16301f"><ellipse cx="60" cy="96" rx="12" ry="3.2"/><ellipse cx="92" cy="106" rx="14" ry="3.6"/><ellipse cx="128" cy="92" rx="10" ry="2.8"/><ellipse cx="44" cy="110" rx="12" ry="3.2"/></g>
    <g fill="#dcdccf"><ellipse cx="96" cy="104" rx="3" ry="1.4"/><ellipse cx="131" cy="91" rx="2.4" ry="1.1"/></g>
    <g transform="translate(62 93)"><ellipse rx="5" ry="3.2" fill="#5f9e48"/><ellipse cx="4" cy="-2.6" rx="2.6" ry="2" fill="#5f9e48"/><path d="M-4 -0.4Q0 -2 5 -3.4" stroke="#e8e6c8" stroke-width=".9" fill="none"/><circle cx="5.2" cy="-3.6" r=".7" fill="#0c1210"/><circle cx="6.4" cy="-0.6" r="2.4" fill="#f2efc4"/></g>
    <g fill="url(#tpd-eye)"><circle cx="118" cy="84" r="2.2"/><circle cx="123" cy="84" r="2.2"/></g>
    <g fill="url(#tpd-fly)">${[[36, 76], [78, 66], [140, 70], [110, 98], [52, 84], [148, 104], [24, 96]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.2"/>`).join('')}</g>
    <g stroke="#0e1a12" stroke-width="1.2"><path d="M140 120l2-20M146 120l-1-16M152 120l3-22M4 120l-1-14"/></g>
  </svg>`,
  mixer: `<svg viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="160" height="120" fill="#000"/>
    <g fill="none" stroke="#CFE8EC"><ellipse cx="80" cy="54" rx="22" ry="11" stroke-opacity=".22"/><ellipse cx="80" cy="54" rx="40" ry="20" stroke-opacity=".14"/><ellipse cx="80" cy="54" rx="60" ry="30" stroke-opacity=".08"/></g>
    <g stroke-linecap="round" stroke-width="3"><path d="M30 96h100" stroke="#CFE8EC" stroke-opacity=".2"/><path d="M30 96h62" stroke="#CFE8EC"/><path d="M30 106h100" stroke="#CFE8EC" stroke-opacity=".2"/><path d="M30 106h28" stroke="#CFE8EC"/></g>
    <circle cx="92" cy="96" r="4" fill="#FFF6E5"/><circle cx="58" cy="106" r="4" fill="#FFF6E5"/>
  </svg>`,
};

export const logo = `<svg viewBox="0 0 32 32" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><ellipse cx="16" cy="22.5" rx="14" ry="5.5" opacity=".35"/><ellipse cx="16" cy="22.5" rx="9" ry="3.4" opacity=".6"/></g><circle cx="16" cy="6.5" r="4.5" fill="#FFC53D" opacity=".3"/><path d="M14 19.5 15 9.5h2l1 10z" fill="#E4572E"/><path d="M14.4 15.6h3.2l.25 1.6h-3.7z" fill="#FFF6E5"/><circle cx="16" cy="7" r="1.6" fill="#FFC53D"/><path d="M9.5 22c0-2.4 3-3 6.5-3s6.5.6 6.5 3z" fill="#E4572E"/><path d="M8 22.4q8-2.2 16 0-3 2.2-8 2.2t-8-2.2z" fill="#0F4A59"/></svg>`;

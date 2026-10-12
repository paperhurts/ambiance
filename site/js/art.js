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
  castle: svg('<path d="M4 21V9h3V6h2v3h2V6h2v3h2V6h2v3h3v12M10 21v-5a2 2 0 0 1 4 0v5M2 21h20" />'),
  goblet: svg('<path d="M7 3h10c0 5-2 8-5 8S7 8 7 3zM12 11v7M8 21h8M9.5 21L12 18l2.5 3" />'),
  note: svg('<path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>'),
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
// a tropical hibiscus: five ruffled lobes round a dark eye, a long
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
    <defs><radialGradient id="tw-sun" cx=".62" cy=".08" r=".9"><stop offset="0" stop-color="#fbfbe0"/><stop offset=".18" stop-color="#e2ef98"/><stop offset=".45" stop-color="#93c34e"/><stop offset="1" stop-color="#2c5a28"/></radialGradient>
    <linearGradient id="tw-pool" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6f9a86"/><stop offset="1" stop-color="#1d3833"/></linearGradient>
    <linearGradient id="tw-rock" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5f6d68"/><stop offset="1" stop-color="#252d2c"/></linearGradient></defs>
    <rect width="160" height="120" fill="url(#tw-sun)"/>
    <g fill="#c9d4b0" opacity=".5"><rect x="14" y="0" width="2" height="44"/><rect x="40" y="0" width="1.4" height="40"/><rect x="128" y="0" width="1.6" height="42"/><rect x="146" y="0" width="2" height="46"/></g>
    <g fill="#3f7a30"><ellipse cx="18" cy="8" rx="26" ry="12"/><ellipse cx="140" cy="10" rx="28" ry="12"/><ellipse cx="50" cy="22" rx="16" ry="8"/><ellipse cx="118" cy="26" rx="14" ry="7"/></g>
    <g fill="#5f9a38"><ellipse cx="22" cy="5" rx="16" ry="7"/><ellipse cx="134" cy="7" rx="18" ry="7"/><ellipse cx="46" cy="19" rx="10" ry="5"/></g>
    <path d="M0 40 L30 36 L60 39 V80 H0Z" fill="url(#tw-rock)"/><path d="M160 34 L118 30 L96 36 V82 H160Z" fill="url(#tw-rock)"/>
    <path d="M0 40 L30 36 L60 39 L58 44 L0 47Z" fill="#9aa69d"/><path d="M160 34 L118 30 L96 36 L98 41 L160 40Z" fill="#9aa69d"/>
    <g stroke="#161c1c" stroke-opacity=".55" stroke-width="1.2" fill="none"><path d="M0 56 L58 53 M0 66 L56 64 M98 52 L160 50 M98 63 L160 62"/></g>
    <g fill="#6f9a36"><ellipse cx="18" cy="39" rx="9" ry="2"/><ellipse cx="44" cy="38" rx="7" ry="1.6"/><ellipse cx="130" cy="32" rx="10" ry="2"/></g>
    <g fill="#59665f"><rect x="70" y="38" width="20" height="9"/><rect x="66" y="47" width="22" height="10"/><rect x="70" y="57" width="24" height="12"/></g>
    <g fill="#f4f9f7"><path d="M77 36 h7 v9 h-7z"/><path d="M73 46 h8 v10 h-8z"/><path d="M78 56 h10 v12 h-10z"/></g>
    <g fill="#fff" opacity=".9"><ellipse cx="80.5" cy="45.5" rx="6" ry="1.6"/><ellipse cx="77" cy="56" rx="7" ry="1.8"/><ellipse cx="83" cy="68" rx="9" ry="2"/></g>
    <path d="M30 86 Q36 70 80 68 Q124 70 130 86Z" fill="#69766f"/>
    <path d="M66 69 Q80 67 96 69 L118 88 L42 88Z" fill="#eef6f3" opacity=".92"/>
    <g stroke="#fff" stroke-width=".8" opacity=".9"><path d="M60 76 L50 88 M70 72 L64 88 M80 70 L80 88 M90 72 L96 88 M100 76 L110 88"/></g>
    <rect y="88" width="160" height="32" fill="url(#tw-pool)"/>
    <ellipse cx="80" cy="90" rx="44" ry="4" fill="#fff" opacity=".85"/><ellipse cx="74" cy="100" rx="16" ry="1.4" fill="#fff" opacity=".35"/><ellipse cx="98" cy="108" rx="12" ry="1.2" fill="#fff" opacity=".25"/>
    <path d="M-4 120 L-4 98 Q14 92 34 100 L36 120Z" fill="#5a6863"/><path d="M164 120 L164 96 Q146 90 126 98 L124 120Z" fill="#5a6863"/>
    <g fill="#6f9a36"><ellipse cx="12" cy="96" rx="10" ry="2"/><ellipse cx="146" cy="94" rx="10" ry="2"/></g>
    <path d="M6 120 Q10 104 22 100 M150 120 Q146 104 134 100" stroke="#2f6a2c" stroke-width="3" fill="none"/>
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
  halloween: `<svg viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="th-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#10061a"/><stop offset="1" stop-color="#3e1a44"/></linearGradient><linearGradient id="th-glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a0e2c"/><stop offset="1" stop-color="#3a2054"/></linearGradient><linearGradient id="th-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22121f"/><stop offset="1" stop-color="#4a2a3e"/></linearGradient><radialGradient id="th-glow"><stop offset="0" stop-color="#ffc878" stop-opacity=".8"/><stop offset="1" stop-color="#ffa050" stop-opacity="0"/></radialGradient><radialGradient id="th-fire" cx=".5" cy=".85" r=".8"><stop offset="0" stop-color="#ffd27a"/><stop offset=".45" stop-color="#e0661e"/><stop offset="1" stop-color="#3a120a"/></radialGradient><filter id="th-soft" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="3"/></filter></defs>
    <rect width="160" height="120" fill="url(#th-sky)"/>
    <g filter="url(#th-soft)"><ellipse cx="76" cy="20" rx="9" ry="5" fill="#7a68aa" opacity=".45"/><ellipse cx="76" cy="17" rx="9" ry="4" fill="#0c0818" opacity=".7"/><ellipse cx="117" cy="3" rx="13" ry="7" fill="#7a68aa" opacity=".45"/><ellipse cx="117" cy="0" rx="13" ry="6" fill="#0c0818" opacity=".7"/><ellipse cx="120" cy="7" rx="14" ry="7" fill="#7a68aa" opacity=".45"/><ellipse cx="120" cy="4" rx="14" ry="6" fill="#0c0818" opacity=".7"/><ellipse cx="92" cy="5" rx="12" ry="6" fill="#7a68aa" opacity=".45"/><ellipse cx="92" cy="2" rx="12" ry="5" fill="#0c0818" opacity=".7"/><ellipse cx="100" cy="24" rx="15" ry="8" fill="#7a68aa" opacity=".45"/><ellipse cx="100" cy="21" rx="15" ry="7" fill="#0c0818" opacity=".7"/><ellipse cx="46" cy="14" rx="9" ry="5" fill="#7a68aa" opacity=".45"/><ellipse cx="46" cy="11" rx="9" ry="4" fill="#0c0818" opacity=".7"/><ellipse cx="81" cy="45" rx="14" ry="7" fill="#7a68aa" opacity=".45"/><ellipse cx="81" cy="42" rx="14" ry="6" fill="#0c0818" opacity=".7"/><ellipse cx="107" cy="21" rx="15" ry="8" fill="#7a68aa" opacity=".45"/><ellipse cx="107" cy="18" rx="15" ry="7" fill="#0c0818" opacity=".7"/><ellipse cx="40" cy="16" rx="15" ry="7" fill="#7a68aa" opacity=".45"/><ellipse cx="40" cy="13" rx="15" ry="7" fill="#0c0818" opacity=".7"/><ellipse cx="103" cy="22" rx="9" ry="4" fill="#7a68aa" opacity=".45"/><ellipse cx="103" cy="19" rx="9" ry="4" fill="#0c0818" opacity=".7"/></g>
    <circle cx="100" cy="9" r="12" fill="#ffd8c8" opacity=".12"/><path d="M104 4a6 6 0 1 0 1 10a5 5 0 1 1 -1 -10z" fill="#f8ead2"/>
    <path d="M-150.0 182.6 L-150.0 -553.4 L69.0 55.6 L69.0 90.6Z" fill="#4e2846"/>
    <path d="M-150.0 127.4 L69.0 88.0M-150.0 72.2 L69.0 85.3M-150.0 17.0 L69.0 82.7M-150.0 -38.2 L69.0 80.1M-150.0 -93.4 L69.0 77.5M-150.0 -148.6 L69.0 74.8M-150.0 -203.8 L69.0 72.2M-150.0 -259.0 L69.0 69.6M-150.0 -314.2 L69.0 66.9M-150.0 -369.4 L69.0 64.3M-150.0 -424.6 L69.0 61.7M-150.0 -479.8 L69.0 59.1M-150.0 -535.0 L69.0 56.4" stroke="#2a1f22" stroke-width=".4" fill="none"/>
    <path d="M38.9 72.4 L38.9 8.8 Q40.0 -3.2 44.6 4.6 Q48.3 15.3 48.9 27.6 L48.9 75.7Z" fill="url(#th-glass)" stroke="#7c3e5c" stroke-width="1.6"/>
    <path d="M53.6 77.3 L53.6 36.3 Q54.0 28.0 56.0 30.9 Q57.8 36.4 58.1 44.8 L58.1 78.8Z" fill="url(#th-glass)" stroke="#7c3e5c" stroke-width="1.2"/>
    <path d="M60.8 79.7 L60.8 50.0 Q61.1 43.8 62.2 45.0 Q63.2 48.4 63.3 54.7 L63.3 80.5Z" fill="url(#th-glass)" stroke="#7c3e5c" stroke-width="1.0"/>
    <path d="M65.2 81.1 L65.2 58.1 Q65.3 53.2 66.0 53.7 Q66.6 56.1 66.7 61.0 L66.7 81.6Z" fill="url(#th-glass)" stroke="#7c3e5c" stroke-width="0.9"/>
    <path d="M21.4 -67.3 L30.6 -43.2 L30.6 40.5 L26.4 27.7 L21.4 32.0Z" fill="#7a1622"/>
    <path d="M51.3 10.8 L53.7 17.1 L53.7 61.8 L52.5 56.1 L51.3 59.5Z" fill="#1b4a2e"/>
    <path d="M59.8 33.0 L61.0 36.2 L61.0 68.5 L60.4 64.6 L59.8 67.3Z" fill="#1d2f68"/>
    <path d="M64.6 45.8 L65.4 47.7 L65.4 72.5 L65.0 69.7 L64.6 71.8Z" fill="#c9961c"/>
    <path d="M310.0 182.6 L310.0 -553.4 L91.0 55.6 L91.0 90.6Z" fill="#4e2846"/>
    <path d="M310.0 127.4 L91.0 88.0M310.0 72.2 L91.0 85.3M310.0 17.0 L91.0 82.7M310.0 -38.2 L91.0 80.1M310.0 -93.4 L91.0 77.5M310.0 -148.6 L91.0 74.8M310.0 -203.8 L91.0 72.2M310.0 -259.0 L91.0 69.6M310.0 -314.2 L91.0 66.9M310.0 -369.4 L91.0 64.3M310.0 -424.6 L91.0 61.7M310.0 -479.8 L91.0 59.1M310.0 -535.0 L91.0 56.4" stroke="#2a1f22" stroke-width=".4" fill="none"/>
    <path d="M121.1 72.4 L121.1 8.8 Q120.0 -3.2 115.4 4.6 Q111.7 15.3 111.1 27.6 L111.1 75.7Z" fill="url(#th-glass)" stroke="#7c3e5c" stroke-width="1.6"/>
    <path d="M106.4 77.3 L106.4 36.3 Q106.0 28.0 104.0 30.9 Q102.2 36.4 101.9 44.8 L101.9 78.8Z" fill="url(#th-glass)" stroke="#7c3e5c" stroke-width="1.2"/>
    <path d="M99.2 79.7 L99.2 50.0 Q98.9 43.8 97.8 45.0 Q96.8 48.4 96.7 54.7 L96.7 80.5Z" fill="url(#th-glass)" stroke="#7c3e5c" stroke-width="1.0"/>
    <path d="M94.8 81.1 L94.8 58.1 Q94.7 53.2 94.0 53.7 Q93.4 56.1 93.3 61.0 L93.3 81.6Z" fill="url(#th-glass)" stroke="#7c3e5c" stroke-width="0.9"/>
    <path d="M138.6 -67.3 L129.4 -43.2 L129.4 40.5 L133.6 27.7 L138.6 32.0Z" fill="#1b4a2e"/>
    <path d="M108.7 10.8 L106.3 17.1 L106.3 61.8 L107.5 56.1 L108.7 59.5Z" fill="#1d2f68"/>
    <path d="M100.2 33.0 L99.0 36.2 L99.0 68.5 L99.6 64.6 L100.2 67.3Z" fill="#c9961c"/>
    <path d="M95.4 45.8 L94.6 47.7 L94.6 72.5 L95.0 69.7 L95.4 71.8Z" fill="#7a1622"/>
    <path d="M69.0 90.6 L69.0 55.6 Q70.4 47.0 80.0 45.1 Q89.6 47.0 91.0 55.6 L91.0 90.6Z" fill="#4e2846"/>
    <path d="M67.9 51.2 Q69.4 41.8 80.0 39.8 Q90.6 41.8 92.1 51.2" fill="none" stroke="#7c3e5c" stroke-width="1.4"/><path d="M67.9 51.2 Q69.4 41.8 80.0 39.8 Q90.6 41.8 92.1 51.2" fill="none" stroke="#ff9a76" stroke-opacity=".6" stroke-width="0.30"/>
    <path d="M64.8 42.4 Q66.7 30.5 80.0 27.9 Q93.3 30.5 95.2 42.4" fill="none" stroke="#7c3e5c" stroke-width="1.7"/><path d="M64.8 42.4 Q66.7 30.5 80.0 27.9 Q93.3 30.5 95.2 42.4" fill="none" stroke="#ff9a76" stroke-opacity=".6" stroke-width="0.30"/>
    <path d="M60.2 28.9 Q62.6 13.4 80.0 10.0 Q97.4 13.4 99.8 28.9" fill="none" stroke="#7c3e5c" stroke-width="2.3"/><path d="M60.2 28.9 Q62.6 13.4 80.0 10.0 Q97.4 13.4 99.8 28.9" fill="none" stroke="#ff9a76" stroke-opacity=".6" stroke-width="0.30"/>
    <path d="M52.3 6.1 Q55.6 -15.6 80.0 -20.4 Q104.4 -15.6 107.7 6.1" fill="none" stroke="#7c3e5c" stroke-width="3.2"/><path d="M52.3 6.1 Q55.6 -15.6 80.0 -20.4 Q104.4 -15.6 107.7 6.1" fill="none" stroke="#ff9a76" stroke-opacity=".6" stroke-width="0.30"/>
    <path d="M75.6 83.8 L75.6 66.0 Q76.6 61.4 80 59.4 Q83.4 61.4 84.4 66.0 L84.4 83.8Z" fill="url(#th-glass)"/>
    <path d="M-150.0 182.6 L310.0 182.6 L91.0 90.6 L69.0 90.6Z" fill="url(#th-floor)"/>
    <path d="M67.6 91.2 L92.4 91.2 L92.4 90.0 L67.6 90.0Z" fill="#24122a"/>
    <path d="M117.1 101.6 L117.1 86.0 L105.6 86.0 L105.6 96.7Z" fill="#7c3e5c"/>
    <path d="M114.8 100.6 L114.8 90.2 L110.3 88.4 L106.7 89.2 L106.7 97.2Z" fill="url(#th-fire)"/>
    <path d="M56.0 96.1 L56.0 86.0 L61.3 86.0 L61.3 93.9Z" fill="#7c3e5c"/>
    <path d="M57.0 95.7 L57.0 88.8 L59.0 87.7 L60.7 88.3 L60.7 94.1Z" fill="url(#th-fire)"/>
    <path d="M-9.3 131.3 L6.9 131.3 L72.7 90.5 L71.1 90.5Z" fill="#6a4426"/>
    <ellipse cx="21.5" cy="116.8" rx="1.3" ry="0.6" fill="#d8b65e"/>
    <ellipse cx="28.1" cy="116.8" rx="1.3" ry="0.6" fill="#d8b65e"/>
    <ellipse cx="41.0" cy="106.5" rx="0.9" ry="0.4" fill="#d8b65e"/>
    <ellipse cx="45.4" cy="106.5" rx="0.9" ry="0.4" fill="#d8b65e"/>
    <ellipse cx="50.7" cy="101.4" rx="0.7" ry="0.3" fill="#d8b65e"/>
    <ellipse cx="54.1" cy="101.4" rx="0.7" ry="0.3" fill="#d8b65e"/>
    <ellipse cx="59.1" cy="97.0" rx="0.5" ry="0.2" fill="#d8b65e"/>
    <ellipse cx="61.5" cy="97.0" rx="0.5" ry="0.2" fill="#d8b65e"/>
    <ellipse cx="64.6" cy="94.1" rx="0.4" ry="0.2" fill="#d8b65e"/>
    <ellipse cx="66.3" cy="94.1" rx="0.4" ry="0.2" fill="#d8b65e"/>
    <ellipse cx="68.3" cy="92.2" rx="0.4" ry="0.2" fill="#d8b65e"/>
    <ellipse cx="69.6" cy="92.2" rx="0.4" ry="0.2" fill="#d8b65e"/>
    <path d="M44.8 131.3 L61.1 131.3 L78.1 90.5 L76.5 90.5Z" fill="#6a4426"/>
    <ellipse cx="58.3" cy="116.8" rx="1.3" ry="0.6" fill="#d8b65e"/>
    <ellipse cx="64.9" cy="116.8" rx="1.3" ry="0.6" fill="#d8b65e"/>
    <ellipse cx="65.5" cy="106.5" rx="0.9" ry="0.4" fill="#d8b65e"/>
    <ellipse cx="69.9" cy="106.5" rx="0.9" ry="0.4" fill="#d8b65e"/>
    <ellipse cx="69.1" cy="101.4" rx="0.7" ry="0.3" fill="#d8b65e"/>
    <ellipse cx="72.5" cy="101.4" rx="0.7" ry="0.3" fill="#d8b65e"/>
    <ellipse cx="72.2" cy="97.0" rx="0.5" ry="0.2" fill="#d8b65e"/>
    <ellipse cx="74.6" cy="97.0" rx="0.5" ry="0.2" fill="#d8b65e"/>
    <ellipse cx="74.3" cy="94.1" rx="0.4" ry="0.2" fill="#d8b65e"/>
    <ellipse cx="76.0" cy="94.1" rx="0.4" ry="0.2" fill="#d8b65e"/>
    <ellipse cx="75.7" cy="92.2" rx="0.4" ry="0.2" fill="#d8b65e"/>
    <ellipse cx="77.0" cy="92.2" rx="0.4" ry="0.2" fill="#d8b65e"/>
    <path d="M98.9 131.3 L115.2 131.3 L83.5 90.5 L81.9 90.5Z" fill="#6a4426"/>
    <ellipse cx="95.1" cy="116.8" rx="1.3" ry="0.6" fill="#d8b65e"/>
    <ellipse cx="101.7" cy="116.8" rx="1.3" ry="0.6" fill="#d8b65e"/>
    <ellipse cx="90.1" cy="106.5" rx="0.9" ry="0.4" fill="#d8b65e"/>
    <ellipse cx="94.5" cy="106.5" rx="0.9" ry="0.4" fill="#d8b65e"/>
    <ellipse cx="87.5" cy="101.4" rx="0.7" ry="0.3" fill="#d8b65e"/>
    <ellipse cx="90.9" cy="101.4" rx="0.7" ry="0.3" fill="#d8b65e"/>
    <ellipse cx="85.4" cy="97.0" rx="0.5" ry="0.2" fill="#d8b65e"/>
    <ellipse cx="87.8" cy="97.0" rx="0.5" ry="0.2" fill="#d8b65e"/>
    <ellipse cx="84.0" cy="94.1" rx="0.4" ry="0.2" fill="#d8b65e"/>
    <ellipse cx="85.7" cy="94.1" rx="0.4" ry="0.2" fill="#d8b65e"/>
    <ellipse cx="83.0" cy="92.2" rx="0.4" ry="0.2" fill="#d8b65e"/>
    <ellipse cx="84.3" cy="92.2" rx="0.4" ry="0.2" fill="#d8b65e"/>
    <path d="M153.1 131.3 L169.3 131.3 L88.9 90.5 L87.3 90.5Z" fill="#6a4426"/>
    <ellipse cx="131.9" cy="116.8" rx="1.3" ry="0.6" fill="#d8b65e"/>
    <ellipse cx="138.5" cy="116.8" rx="1.3" ry="0.6" fill="#d8b65e"/>
    <ellipse cx="114.6" cy="106.5" rx="0.9" ry="0.4" fill="#d8b65e"/>
    <ellipse cx="119.0" cy="106.5" rx="0.9" ry="0.4" fill="#d8b65e"/>
    <ellipse cx="105.9" cy="101.4" rx="0.7" ry="0.3" fill="#d8b65e"/>
    <ellipse cx="109.3" cy="101.4" rx="0.7" ry="0.3" fill="#d8b65e"/>
    <ellipse cx="98.5" cy="97.0" rx="0.5" ry="0.2" fill="#d8b65e"/>
    <ellipse cx="100.9" cy="97.0" rx="0.5" ry="0.2" fill="#d8b65e"/>
    <ellipse cx="93.7" cy="94.1" rx="0.4" ry="0.2" fill="#d8b65e"/>
    <ellipse cx="95.4" cy="94.1" rx="0.4" ry="0.2" fill="#d8b65e"/>
    <ellipse cx="90.4" cy="92.2" rx="0.4" ry="0.2" fill="#d8b65e"/>
    <ellipse cx="91.7" cy="92.2" rx="0.4" ry="0.2" fill="#d8b65e"/>
    <circle cx="39.5" cy="102.3" r="6.6" fill="url(#th-glow)"/><ellipse cx="39.5" cy="102.3" rx="3.3" ry="2.5" fill="#e2782a"/><path d="M38.0 102.0 h0.9 l-0.4 0.7Z M40.1 102.0 h0.9 l-0.4 0.7Z M38.0 103.2 h3.0 l-0.6 0.7 h-1.8Z" fill="#ffd27a"/>
    <circle cx="53.9" cy="96.5" r="4.2" fill="url(#th-glow)"/><ellipse cx="53.9" cy="96.5" rx="2.1" ry="1.6" fill="#e2782a"/><path d="M52.9 96.3 h0.6 l-0.3 0.5Z M54.3 96.3 h0.6 l-0.3 0.5Z M52.9 97.1 h1.9 l-0.4 0.5 h-1.2Z" fill="#ffd27a"/>
    <circle cx="64.5" cy="92.2" r="2.5" fill="url(#th-glow)"/><ellipse cx="64.5" cy="92.2" rx="1.3" ry="1.0" fill="#e2782a"/><path d="M64.0 92.1 h0.3 l-0.2 0.3Z M64.8 92.1 h0.3 l-0.2 0.3Z M64.0 92.6 h1.1 l-0.2 0.3 h-0.7Z" fill="#ffd27a"/>
    <circle cx="118.2" cy="101.4" r="6.2" fill="url(#th-glow)"/><ellipse cx="118.2" cy="101.4" rx="3.1" ry="2.4" fill="#e2782a"/><path d="M116.8 101.1 h0.8 l-0.4 0.7Z M118.8 101.1 h0.8 l-0.4 0.7Z M116.8 102.3 h2.8 l-0.6 0.7 h-1.7Z" fill="#ffd27a"/>
    <circle cx="100.2" cy="94.2" r="3.3" fill="url(#th-glow)"/><ellipse cx="100.2" cy="94.2" rx="1.6" ry="1.3" fill="#e2782a"/><path d="M99.5 94.0 h0.4 l-0.2 0.4Z M100.5 94.0 h0.4 l-0.2 0.4Z M99.5 94.6 h1.5 l-0.3 0.4 h-0.9Z" fill="#ffd27a"/>
    <circle cx="95.9" cy="92.4" r="2.6" fill="url(#th-glow)"/><ellipse cx="95.9" cy="92.4" rx="1.3" ry="1.0" fill="#e2782a"/><path d="M95.3 92.3 h0.4 l-0.2 0.3Z M96.1 92.3 h0.4 l-0.2 0.3Z M95.3 92.8 h1.2 l-0.2 0.3 h-0.7Z" fill="#ffd27a"/>
    <circle cx="89.2" cy="80.3" r="1.2" fill="url(#th-glow)"/><rect x="89.0" y="80.6" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="89.2" cy="80.5" r="0.35" fill="#fff2c0"/>
    <circle cx="73.2" cy="57.9" r="1.2" fill="url(#th-glow)"/><rect x="72.9" y="58.2" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="73.2" cy="58.0" r="0.35" fill="#fff2c0"/>
    <circle cx="74.9" cy="79.7" r="1.2" fill="url(#th-glow)"/><rect x="74.7" y="80.0" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="74.9" cy="79.9" r="0.35" fill="#fff2c0"/>
    <circle cx="71.4" cy="65.4" r="1.2" fill="url(#th-glow)"/><rect x="71.2" y="65.7" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="71.4" cy="65.6" r="0.35" fill="#fff2c0"/>
    <circle cx="87.0" cy="75.3" r="1.2" fill="url(#th-glow)"/><rect x="86.8" y="75.6" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="87.0" cy="75.5" r="0.35" fill="#fff2c0"/>
    <circle cx="84.9" cy="60.0" r="1.2" fill="url(#th-glow)"/><rect x="84.7" y="60.3" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="84.9" cy="60.1" r="0.35" fill="#fff2c0"/>
    <circle cx="70.4" cy="71.1" r="1.2" fill="url(#th-glow)"/><rect x="70.2" y="71.4" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="70.4" cy="71.3" r="0.35" fill="#fff2c0"/>
    <circle cx="84.0" cy="75.7" r="1.2" fill="url(#th-glow)"/><rect x="83.7" y="76.0" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="84.0" cy="75.9" r="0.35" fill="#fff2c0"/>
    <circle cx="87.1" cy="79.4" r="1.2" fill="url(#th-glow)"/><rect x="86.9" y="79.7" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="87.1" cy="79.5" r="0.35" fill="#fff2c0"/>
    <circle cx="84.4" cy="62.7" r="1.2" fill="url(#th-glow)"/><rect x="84.2" y="63.0" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="84.4" cy="62.9" r="0.35" fill="#fff2c0"/>
    <circle cx="78.8" cy="59.1" r="1.2" fill="url(#th-glow)"/><rect x="78.5" y="59.4" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="78.8" cy="59.2" r="0.35" fill="#fff2c0"/>
    <circle cx="88.3" cy="64.1" r="1.2" fill="url(#th-glow)"/><rect x="88.1" y="64.4" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="88.3" cy="64.2" r="0.35" fill="#fff2c0"/>
    <circle cx="80.8" cy="73.2" r="1.2" fill="url(#th-glow)"/><rect x="80.6" y="73.5" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="80.8" cy="73.4" r="0.35" fill="#fff2c0"/>
    <circle cx="71.2" cy="65.4" r="1.2" fill="url(#th-glow)"/><rect x="71.0" y="65.7" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="71.2" cy="65.6" r="0.35" fill="#fff2c0"/>
    <circle cx="82.4" cy="73.0" r="1.2" fill="url(#th-glow)"/><rect x="82.2" y="73.3" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="82.4" cy="73.2" r="0.35" fill="#fff2c0"/>
    <circle cx="92.4" cy="75.0" r="1.2" fill="url(#th-glow)"/><rect x="92.2" y="75.3" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="92.4" cy="75.1" r="0.35" fill="#fff2c0"/>
    <circle cx="89.2" cy="69.3" r="2.6" fill="url(#th-glow)"/><circle cx="89.2" cy="69.3" r="1.1" fill="#e2782a"/><rect x="88.6" y="69.2" width="1.1" height="0.3" fill="#ffd27a"/>
    <circle cx="94.7" cy="76.6" r="1.2" fill="url(#th-glow)"/><rect x="94.5" y="76.9" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="94.7" cy="76.8" r="0.35" fill="#fff2c0"/>
    <circle cx="84.0" cy="80.0" r="2.6" fill="url(#th-glow)"/><circle cx="84.0" cy="80.0" r="1.1" fill="#e2782a"/><rect x="83.4" y="79.9" width="1.1" height="0.3" fill="#ffd27a"/>
    <circle cx="79.4" cy="42.1" r="1.2" fill="url(#th-glow)"/><rect x="79.2" y="42.4" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="79.4" cy="42.2" r="0.35" fill="#fff2c0"/>
    <circle cx="91.0" cy="80.3" r="2.6" fill="url(#th-glow)"/><circle cx="91.0" cy="80.3" r="1.1" fill="#e2782a"/><rect x="90.5" y="80.1" width="1.1" height="0.3" fill="#ffd27a"/>
    <circle cx="92.4" cy="70.7" r="2.6" fill="url(#th-glow)"/><circle cx="92.4" cy="70.7" r="1.1" fill="#e2782a"/><rect x="91.8" y="70.5" width="1.1" height="0.3" fill="#ffd27a"/>
    <circle cx="62.2" cy="70.2" r="1.2" fill="url(#th-glow)"/><rect x="61.9" y="70.5" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="62.2" cy="70.3" r="0.35" fill="#fff2c0"/>
    <circle cx="86.6" cy="71.8" r="2.6" fill="url(#th-glow)"/><circle cx="86.6" cy="71.8" r="1.1" fill="#e2782a"/><rect x="86.1" y="71.6" width="1.1" height="0.3" fill="#ffd27a"/>
    <circle cx="91.3" cy="62.9" r="1.2" fill="url(#th-glow)"/><rect x="91.1" y="63.2" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="91.3" cy="63.1" r="0.35" fill="#fff2c0"/>
    <circle cx="70.4" cy="44.3" r="1.2" fill="url(#th-glow)"/><rect x="70.1" y="44.6" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="70.4" cy="44.5" r="0.35" fill="#fff2c0"/>
    <circle cx="79.7" cy="76.3" r="1.2" fill="url(#th-glow)"/><rect x="79.5" y="76.6" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="79.7" cy="76.4" r="0.35" fill="#fff2c0"/>
    <circle cx="79.9" cy="35.8" r="1.2" fill="url(#th-glow)"/><rect x="79.6" y="36.1" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="79.9" cy="35.9" r="0.35" fill="#fff2c0"/>
    <circle cx="83.3" cy="56.1" r="1.2" fill="url(#th-glow)"/><rect x="83.1" y="56.4" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="83.3" cy="56.3" r="0.35" fill="#fff2c0"/>
    <circle cx="69.3" cy="32.3" r="1.2" fill="url(#th-glow)"/><rect x="69.1" y="32.6" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="69.3" cy="32.5" r="0.35" fill="#fff2c0"/>
    <circle cx="95.6" cy="74.1" r="1.2" fill="url(#th-glow)"/><rect x="95.4" y="74.4" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="95.6" cy="74.3" r="0.35" fill="#fff2c0"/>
    <circle cx="74.7" cy="34.7" r="1.2" fill="url(#th-glow)"/><rect x="74.5" y="35.0" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="74.7" cy="34.8" r="0.35" fill="#fff2c0"/>
    <circle cx="84.7" cy="74.4" r="1.2" fill="url(#th-glow)"/><rect x="84.4" y="74.7" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="84.7" cy="74.6" r="0.35" fill="#fff2c0"/>
    <circle cx="67.1" cy="52.6" r="1.3" fill="url(#th-glow)"/><rect x="66.9" y="52.9" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="67.1" cy="52.8" r="0.35" fill="#fff2c0"/>
    <circle cx="86.1" cy="65.4" r="2.6" fill="url(#th-glow)"/><circle cx="86.1" cy="65.4" r="1.1" fill="#e2782a"/><rect x="85.6" y="65.2" width="1.1" height="0.3" fill="#ffd27a"/>
    <circle cx="68.6" cy="63.2" r="1.4" fill="url(#th-glow)"/><rect x="68.4" y="63.5" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="68.6" cy="63.4" r="0.35" fill="#fff2c0"/>
    <circle cx="85.3" cy="66.1" r="1.4" fill="url(#th-glow)"/><rect x="85.1" y="66.5" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="85.3" cy="66.3" r="0.35" fill="#fff2c0"/>
    <circle cx="90.9" cy="15.1" r="1.5" fill="url(#th-glow)"/><rect x="90.7" y="15.5" width="0.45" height="1.3" fill="#eadcbf"/><circle cx="90.9" cy="15.3" r="0.35" fill="#fff2c0"/>
    <circle cx="73.9" cy="53.7" r="2.6" fill="url(#th-glow)"/><circle cx="73.9" cy="53.7" r="1.1" fill="#e2782a"/><rect x="73.3" y="53.5" width="1.1" height="0.3" fill="#ffd27a"/>
    <circle cx="57.2" cy="23.9" r="1.5" fill="url(#th-glow)"/><rect x="57.0" y="24.2" width="0.45" height="1.4" fill="#eadcbf"/><circle cx="57.2" cy="24.1" r="0.35" fill="#fff2c0"/>
    <circle cx="83.6" cy="44.6" r="1.7" fill="url(#th-glow)"/><rect x="83.4" y="45.0" width="0.45" height="1.5" fill="#eadcbf"/><circle cx="83.6" cy="44.8" r="0.35" fill="#fff2c0"/>
    <circle cx="72.8" cy="8.3" r="1.7" fill="url(#th-glow)"/><rect x="72.6" y="8.7" width="0.45" height="1.5" fill="#eadcbf"/><circle cx="72.8" cy="8.5" r="0.35" fill="#fff2c0"/>
    <circle cx="110.9" cy="43.8" r="1.8" fill="url(#th-glow)"/><rect x="110.7" y="44.2" width="0.45" height="1.7" fill="#eadcbf"/><circle cx="110.9" cy="44.0" r="0.35" fill="#fff2c0"/>
    <circle cx="94.0" cy="49.8" r="3.3" fill="url(#th-glow)"/><circle cx="94.0" cy="49.8" r="1.4" fill="#e2782a"/><rect x="93.4" y="49.6" width="1.4" height="0.4" fill="#ffd27a"/>
    <circle cx="49.9" cy="15.8" r="2.0" fill="url(#th-glow)"/><rect x="49.6" y="16.2" width="0.45" height="1.8" fill="#eadcbf"/><circle cx="49.9" cy="16.1" r="0.35" fill="#fff2c0"/>
    <circle cx="72.3" cy="13.0" r="2.1" fill="url(#th-glow)"/><rect x="72.1" y="13.5" width="0.45" height="1.9" fill="#eadcbf"/><circle cx="72.3" cy="13.3" r="0.35" fill="#fff2c0"/>
    <circle cx="84.8" cy="56.5" r="2.1" fill="url(#th-glow)"/><rect x="84.5" y="57.0" width="0.45" height="1.9" fill="#eadcbf"/><circle cx="84.8" cy="56.8" r="0.35" fill="#fff2c0"/>
    <circle cx="82.5" cy="39.1" r="3.6" fill="url(#th-glow)"/><circle cx="82.5" cy="39.1" r="1.5" fill="#e2782a"/><rect x="81.8" y="38.9" width="1.5" height="0.4" fill="#ffd27a"/>
    <circle cx="83.1" cy="67.1" r="2.1" fill="url(#th-glow)"/><rect x="82.8" y="67.6" width="0.45" height="1.9" fill="#eadcbf"/><circle cx="83.1" cy="67.4" r="0.35" fill="#fff2c0"/>
    <circle cx="57.0" cy="67.9" r="2.2" fill="url(#th-glow)"/><rect x="56.7" y="68.4" width="0.45" height="1.9" fill="#eadcbf"/><circle cx="57.0" cy="68.2" r="0.35" fill="#fff2c0"/>
    <circle cx="84.6" cy="1.1" r="2.3" fill="url(#th-glow)"/><rect x="84.4" y="1.6" width="0.45" height="2.0" fill="#eadcbf"/><circle cx="84.6" cy="1.4" r="0.35" fill="#fff2c0"/>
    <circle cx="88.9" cy="66.2" r="2.3" fill="url(#th-glow)"/><rect x="88.6" y="66.8" width="0.45" height="2.1" fill="#eadcbf"/><circle cx="88.9" cy="66.5" r="0.35" fill="#fff2c0"/>
    <circle cx="79.5" cy="56.6" r="2.4" fill="url(#th-glow)"/><rect x="79.3" y="57.1" width="0.45" height="2.2" fill="#eadcbf"/><circle cx="79.5" cy="56.9" r="0.35" fill="#fff2c0"/>
    <circle cx="126.9" cy="-0.2" r="2.7" fill="url(#th-glow)"/><rect x="126.6" y="0.4" width="0.45" height="2.4" fill="#eadcbf"/><circle cx="126.9" cy="0.2" r="0.35" fill="#fff2c0"/>
    <path d="M46 16 q-2.0 -1.5 -4.0 -0.5 q1.2 0.8 1.6 1.6 q1.4 -0.4 2.4 0.8 q1.0 -1.2 2.4 -0.8 q0.4 -0.8 1.6 -1.6 q-2.0 -1.0 -4.0 0.5Z" fill="#0a0608"/>
    <path d="M112 24 q-1.6 -1.2 -3.2 -0.4 q1.0 0.6 1.3 1.3 q1.1 -0.3 1.9 0.6 q0.8 -1.0 1.9 -0.6 q0.3 -0.6 1.3 -1.3 q-1.6 -0.8 -3.2 0.4Z" fill="#0a0608"/>
    <path d="M96 10 q-1.4 -1.0 -2.8 -0.3 q0.8 0.6 1.1 1.1 q1.0 -0.3 1.7 0.6 q0.7 -0.8 1.7 -0.6 q0.3 -0.6 1.1 -1.1 q-1.4 -0.7 -2.8 0.3Z" fill="#0a0608"/>
  </svg>`,
  christmas: `<svg viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="tx-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#060e26"/><stop offset="1" stop-color="#1e3462"/></linearGradient><linearGradient id="tx-glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0f2240"/><stop offset="1" stop-color="#2a4a74"/></linearGradient><linearGradient id="tx-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#121a30"/><stop offset="1" stop-color="#2a3656"/></linearGradient><radialGradient id="tx-glow"><stop offset="0" stop-color="#ffc878" stop-opacity=".8"/><stop offset="1" stop-color="#ffa050" stop-opacity="0"/></radialGradient><radialGradient id="tx-fire" cx=".5" cy=".85" r=".8"><stop offset="0" stop-color="#ffd27a"/><stop offset=".45" stop-color="#e0661e"/><stop offset="1" stop-color="#3a120a"/></radialGradient><filter id="tx-soft" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="3"/></filter></defs>
    <rect width="160" height="120" fill="url(#tx-sky)"/>
    <g fill="#fff"><circle cx="38" cy="5" r=".6"/><circle cx="63" cy="7" r=".6"/><circle cx="11" cy="18" r=".6"/><circle cx="147" cy="35" r=".6"/><circle cx="122" cy="10" r=".6"/><circle cx="86" cy="12" r=".6"/><circle cx="28" cy="5" r=".6"/><circle cx="34" cy="41" r=".6"/><circle cx="133" cy="35" r=".6"/><circle cx="128" cy="9" r=".6"/><circle cx="50" cy="28" r=".6"/><circle cx="117" cy="38" r=".6"/><circle cx="141" cy="4" r=".6"/><circle cx="97" cy="30" r=".6"/><circle cx="81" cy="8" r=".6"/><circle cx="76" cy="4" r=".6"/><circle cx="150" cy="38" r=".6"/><circle cx="88" cy="13" r=".6"/><circle cx="145" cy="25" r=".6"/><circle cx="141" cy="37" r=".6"/><circle cx="81" cy="18" r=".6"/><circle cx="96" cy="19" r=".6"/><circle cx="26" cy="13" r=".6"/><circle cx="130" cy="2" r=".6"/></g>
    <circle cx="100" cy="9" r="12" fill="#ffd8c8" opacity=".12"/><path d="M104 4a6 6 0 1 0 1 10a5 5 0 1 1 -1 -10z" fill="#f8ead2"/>
    <path d="M-150.0 182.6 L-150.0 -553.4 L69.0 55.6 L69.0 90.6Z" fill="#233658"/>
    <path d="M-150.0 127.4 L69.0 88.0M-150.0 72.2 L69.0 85.3M-150.0 17.0 L69.0 82.7M-150.0 -38.2 L69.0 80.1M-150.0 -93.4 L69.0 77.5M-150.0 -148.6 L69.0 74.8M-150.0 -203.8 L69.0 72.2M-150.0 -259.0 L69.0 69.6M-150.0 -314.2 L69.0 66.9M-150.0 -369.4 L69.0 64.3M-150.0 -424.6 L69.0 61.7M-150.0 -479.8 L69.0 59.1M-150.0 -535.0 L69.0 56.4" stroke="#2a1f22" stroke-width=".4" fill="none"/>
    <path d="M38.9 72.4 L38.9 8.8 Q40.0 -3.2 44.6 4.6 Q48.3 15.3 48.9 27.6 L48.9 75.7Z" fill="url(#tx-glass)" stroke="#3a5480" stroke-width="1.6"/>
    <path d="M38.9 72.4 L38.9 68.3 L48.9 72.6 L48.9 75.7Z" fill="#e8f0f8"/>
    <path d="M53.6 77.3 L53.6 36.3 Q54.0 28.0 56.0 30.9 Q57.8 36.4 58.1 44.8 L58.1 78.8Z" fill="url(#tx-glass)" stroke="#3a5480" stroke-width="1.2"/>
    <path d="M53.6 77.3 L53.6 74.6 L58.1 76.6 L58.1 78.8Z" fill="#e8f0f8"/>
    <path d="M60.8 79.7 L60.8 50.0 Q61.1 43.8 62.2 45.0 Q63.2 48.4 63.3 54.7 L63.3 80.5Z" fill="url(#tx-glass)" stroke="#3a5480" stroke-width="1.0"/>
    <path d="M60.8 79.7 L60.8 77.8 L63.3 78.8 L63.3 80.5Z" fill="#e8f0f8"/>
    <path d="M65.2 81.1 L65.2 58.1 Q65.3 53.2 66.0 53.7 Q66.6 56.1 66.7 61.0 L66.7 81.6Z" fill="url(#tx-glass)" stroke="#3a5480" stroke-width="0.9"/>
    <path d="M65.2 81.1 L65.2 79.6 L66.7 80.3 L66.7 81.6Z" fill="#e8f0f8"/>
    <path d="M21.4 -67.3 L30.6 -43.2 L30.6 40.5 L26.4 27.7 L21.4 32.0Z" fill="#7a1622"/>
    <path d="M51.3 10.8 L53.7 17.1 L53.7 61.8 L52.5 56.1 L51.3 59.5Z" fill="#1b4a2e"/>
    <path d="M59.8 33.0 L61.0 36.2 L61.0 68.5 L60.4 64.6 L59.8 67.3Z" fill="#1d2f68"/>
    <path d="M64.6 45.8 L65.4 47.7 L65.4 72.5 L65.0 69.7 L64.6 71.8Z" fill="#c9961c"/>
    <path d="M310.0 182.6 L310.0 -553.4 L91.0 55.6 L91.0 90.6Z" fill="#233658"/>
    <path d="M310.0 127.4 L91.0 88.0M310.0 72.2 L91.0 85.3M310.0 17.0 L91.0 82.7M310.0 -38.2 L91.0 80.1M310.0 -93.4 L91.0 77.5M310.0 -148.6 L91.0 74.8M310.0 -203.8 L91.0 72.2M310.0 -259.0 L91.0 69.6M310.0 -314.2 L91.0 66.9M310.0 -369.4 L91.0 64.3M310.0 -424.6 L91.0 61.7M310.0 -479.8 L91.0 59.1M310.0 -535.0 L91.0 56.4" stroke="#2a1f22" stroke-width=".4" fill="none"/>
    <path d="M121.1 72.4 L121.1 8.8 Q120.0 -3.2 115.4 4.6 Q111.7 15.3 111.1 27.6 L111.1 75.7Z" fill="url(#tx-glass)" stroke="#3a5480" stroke-width="1.6"/>
    <path d="M121.1 72.4 L121.1 68.3 L111.1 72.6 L111.1 75.7Z" fill="#e8f0f8"/>
    <path d="M106.4 77.3 L106.4 36.3 Q106.0 28.0 104.0 30.9 Q102.2 36.4 101.9 44.8 L101.9 78.8Z" fill="url(#tx-glass)" stroke="#3a5480" stroke-width="1.2"/>
    <path d="M106.4 77.3 L106.4 74.6 L101.9 76.6 L101.9 78.8Z" fill="#e8f0f8"/>
    <path d="M99.2 79.7 L99.2 50.0 Q98.9 43.8 97.8 45.0 Q96.8 48.4 96.7 54.7 L96.7 80.5Z" fill="url(#tx-glass)" stroke="#3a5480" stroke-width="1.0"/>
    <path d="M99.2 79.7 L99.2 77.8 L96.7 78.8 L96.7 80.5Z" fill="#e8f0f8"/>
    <path d="M94.8 81.1 L94.8 58.1 Q94.7 53.2 94.0 53.7 Q93.4 56.1 93.3 61.0 L93.3 81.6Z" fill="url(#tx-glass)" stroke="#3a5480" stroke-width="0.9"/>
    <path d="M94.8 81.1 L94.8 79.6 L93.3 80.3 L93.3 81.6Z" fill="#e8f0f8"/>
    <path d="M138.6 -67.3 L129.4 -43.2 L129.4 40.5 L133.6 27.7 L138.6 32.0Z" fill="#1b4a2e"/>
    <path d="M108.7 10.8 L106.3 17.1 L106.3 61.8 L107.5 56.1 L108.7 59.5Z" fill="#1d2f68"/>
    <path d="M100.2 33.0 L99.0 36.2 L99.0 68.5 L99.6 64.6 L100.2 67.3Z" fill="#c9961c"/>
    <path d="M95.4 45.8 L94.6 47.7 L94.6 72.5 L95.0 69.7 L95.4 71.8Z" fill="#7a1622"/>
    <path d="M69.0 90.6 L69.0 55.6 Q70.4 47.0 80.0 45.1 Q89.6 47.0 91.0 55.6 L91.0 90.6Z" fill="#233658"/>
    <path d="M67.9 51.2 Q69.4 41.8 80.0 39.8 Q90.6 41.8 92.1 51.2" fill="none" stroke="#3a5480" stroke-width="1.4"/><path d="M67.9 51.2 Q69.4 41.8 80.0 39.8 Q90.6 41.8 92.1 51.2" fill="none" stroke="#ffd08a" stroke-opacity=".6" stroke-width="0.30"/>
    <path d="M64.8 42.4 Q66.7 30.5 80.0 27.9 Q93.3 30.5 95.2 42.4" fill="none" stroke="#3a5480" stroke-width="1.7"/><path d="M64.8 42.4 Q66.7 30.5 80.0 27.9 Q93.3 30.5 95.2 42.4" fill="none" stroke="#ffd08a" stroke-opacity=".6" stroke-width="0.30"/>
    <path d="M60.2 28.9 Q62.6 13.4 80.0 10.0 Q97.4 13.4 99.8 28.9" fill="none" stroke="#3a5480" stroke-width="2.3"/><path d="M60.2 28.9 Q62.6 13.4 80.0 10.0 Q97.4 13.4 99.8 28.9" fill="none" stroke="#ffd08a" stroke-opacity=".6" stroke-width="0.30"/>
    <path d="M52.3 6.1 Q55.6 -15.6 80.0 -20.4 Q104.4 -15.6 107.7 6.1" fill="none" stroke="#3a5480" stroke-width="3.2"/><path d="M52.3 6.1 Q55.6 -15.6 80.0 -20.4 Q104.4 -15.6 107.7 6.1" fill="none" stroke="#ffd08a" stroke-opacity=".6" stroke-width="0.30"/>
    <path d="M75.6 83.8 L75.6 66.0 Q76.6 61.4 80 59.4 Q83.4 61.4 84.4 66.0 L84.4 83.8Z" fill="url(#tx-glass)"/>
    <path d="M-150.0 182.6 L310.0 182.6 L91.0 90.6 L69.0 90.6Z" fill="url(#tx-floor)"/>
    <path d="M67.6 91.2 L92.4 91.2 L92.4 90.0 L67.6 90.0Z" fill="#0f1830"/>
    <path d="M117.1 101.6 L117.1 86.0 L105.6 86.0 L105.6 96.7Z" fill="#3a5480"/>
    <path d="M114.8 100.6 L114.8 90.2 L110.3 88.4 L106.7 89.2 L106.7 97.2Z" fill="url(#tx-fire)"/>
    <path d="M56.0 96.1 L56.0 86.0 L61.3 86.0 L61.3 93.9Z" fill="#3a5480"/>
    <path d="M57.0 95.7 L57.0 88.8 L59.0 87.7 L60.7 88.3 L60.7 94.1Z" fill="url(#tx-fire)"/>
    <path d="M-9.3 131.3 L6.9 131.3 L72.7 90.5 L71.1 90.5Z" fill="#6a4426"/>
    <ellipse cx="21.5" cy="116.8" rx="1.3" ry="0.6" fill="#d8b65e"/>
    <ellipse cx="28.1" cy="116.8" rx="1.3" ry="0.6" fill="#d8b65e"/>
    <ellipse cx="41.0" cy="106.5" rx="0.9" ry="0.4" fill="#d8b65e"/>
    <ellipse cx="45.4" cy="106.5" rx="0.9" ry="0.4" fill="#d8b65e"/>
    <ellipse cx="50.7" cy="101.4" rx="0.7" ry="0.3" fill="#d8b65e"/>
    <ellipse cx="54.1" cy="101.4" rx="0.7" ry="0.3" fill="#d8b65e"/>
    <ellipse cx="59.1" cy="97.0" rx="0.5" ry="0.2" fill="#d8b65e"/>
    <ellipse cx="61.5" cy="97.0" rx="0.5" ry="0.2" fill="#d8b65e"/>
    <ellipse cx="64.6" cy="94.1" rx="0.4" ry="0.2" fill="#d8b65e"/>
    <ellipse cx="66.3" cy="94.1" rx="0.4" ry="0.2" fill="#d8b65e"/>
    <ellipse cx="68.3" cy="92.2" rx="0.4" ry="0.2" fill="#d8b65e"/>
    <ellipse cx="69.6" cy="92.2" rx="0.4" ry="0.2" fill="#d8b65e"/>
    <path d="M44.8 131.3 L61.1 131.3 L78.1 90.5 L76.5 90.5Z" fill="#6a4426"/>
    <ellipse cx="58.3" cy="116.8" rx="1.3" ry="0.6" fill="#d8b65e"/>
    <ellipse cx="64.9" cy="116.8" rx="1.3" ry="0.6" fill="#d8b65e"/>
    <ellipse cx="65.5" cy="106.5" rx="0.9" ry="0.4" fill="#d8b65e"/>
    <ellipse cx="69.9" cy="106.5" rx="0.9" ry="0.4" fill="#d8b65e"/>
    <ellipse cx="69.1" cy="101.4" rx="0.7" ry="0.3" fill="#d8b65e"/>
    <ellipse cx="72.5" cy="101.4" rx="0.7" ry="0.3" fill="#d8b65e"/>
    <ellipse cx="72.2" cy="97.0" rx="0.5" ry="0.2" fill="#d8b65e"/>
    <ellipse cx="74.6" cy="97.0" rx="0.5" ry="0.2" fill="#d8b65e"/>
    <ellipse cx="74.3" cy="94.1" rx="0.4" ry="0.2" fill="#d8b65e"/>
    <ellipse cx="76.0" cy="94.1" rx="0.4" ry="0.2" fill="#d8b65e"/>
    <ellipse cx="75.7" cy="92.2" rx="0.4" ry="0.2" fill="#d8b65e"/>
    <ellipse cx="77.0" cy="92.2" rx="0.4" ry="0.2" fill="#d8b65e"/>
    <path d="M98.9 131.3 L115.2 131.3 L83.5 90.5 L81.9 90.5Z" fill="#6a4426"/>
    <ellipse cx="95.1" cy="116.8" rx="1.3" ry="0.6" fill="#d8b65e"/>
    <ellipse cx="101.7" cy="116.8" rx="1.3" ry="0.6" fill="#d8b65e"/>
    <ellipse cx="90.1" cy="106.5" rx="0.9" ry="0.4" fill="#d8b65e"/>
    <ellipse cx="94.5" cy="106.5" rx="0.9" ry="0.4" fill="#d8b65e"/>
    <ellipse cx="87.5" cy="101.4" rx="0.7" ry="0.3" fill="#d8b65e"/>
    <ellipse cx="90.9" cy="101.4" rx="0.7" ry="0.3" fill="#d8b65e"/>
    <ellipse cx="85.4" cy="97.0" rx="0.5" ry="0.2" fill="#d8b65e"/>
    <ellipse cx="87.8" cy="97.0" rx="0.5" ry="0.2" fill="#d8b65e"/>
    <ellipse cx="84.0" cy="94.1" rx="0.4" ry="0.2" fill="#d8b65e"/>
    <ellipse cx="85.7" cy="94.1" rx="0.4" ry="0.2" fill="#d8b65e"/>
    <ellipse cx="83.0" cy="92.2" rx="0.4" ry="0.2" fill="#d8b65e"/>
    <ellipse cx="84.3" cy="92.2" rx="0.4" ry="0.2" fill="#d8b65e"/>
    <path d="M153.1 131.3 L169.3 131.3 L88.9 90.5 L87.3 90.5Z" fill="#6a4426"/>
    <ellipse cx="131.9" cy="116.8" rx="1.3" ry="0.6" fill="#d8b65e"/>
    <ellipse cx="138.5" cy="116.8" rx="1.3" ry="0.6" fill="#d8b65e"/>
    <ellipse cx="114.6" cy="106.5" rx="0.9" ry="0.4" fill="#d8b65e"/>
    <ellipse cx="119.0" cy="106.5" rx="0.9" ry="0.4" fill="#d8b65e"/>
    <ellipse cx="105.9" cy="101.4" rx="0.7" ry="0.3" fill="#d8b65e"/>
    <ellipse cx="109.3" cy="101.4" rx="0.7" ry="0.3" fill="#d8b65e"/>
    <ellipse cx="98.5" cy="97.0" rx="0.5" ry="0.2" fill="#d8b65e"/>
    <ellipse cx="100.9" cy="97.0" rx="0.5" ry="0.2" fill="#d8b65e"/>
    <ellipse cx="93.7" cy="94.1" rx="0.4" ry="0.2" fill="#d8b65e"/>
    <ellipse cx="95.4" cy="94.1" rx="0.4" ry="0.2" fill="#d8b65e"/>
    <ellipse cx="90.4" cy="92.2" rx="0.4" ry="0.2" fill="#d8b65e"/>
    <ellipse cx="91.7" cy="92.2" rx="0.4" ry="0.2" fill="#d8b65e"/>
    <path d="M34.0 100.7 L39.5 59.3 L45.0 100.7Z" fill="#234a2c"/>
    <circle cx="39.5" cy="59.3" r="1.4" fill="#f0d070"/>
    <circle cx="40.6" cy="91.2" r="0.6" fill="#ffd27a"/>
    <circle cx="40.3" cy="78.5" r="0.6" fill="#ffd27a"/>
    <circle cx="42.7" cy="83.2" r="0.6" fill="#b81c2a"/>
    <circle cx="43.0" cy="90.7" r="0.6" fill="#ffd27a"/>
    <path d="M50.3 95.5 L53.9 68.8 L57.4 95.5Z" fill="#234a2c"/>
    <circle cx="53.9" cy="68.8" r="0.9" fill="#f0d070"/>
    <circle cx="53.3" cy="79.2" r="0.4" fill="#ffd27a"/>
    <circle cx="54.2" cy="82.6" r="0.4" fill="#ffd27a"/>
    <circle cx="55.1" cy="80.5" r="0.4" fill="#b81c2a"/>
    <circle cx="54.3" cy="75.6" r="0.4" fill="#ffd27a"/>
    <path d="M62.4 91.6 L64.5 75.8 L66.7 91.6Z" fill="#234a2c"/>
    <circle cx="64.5" cy="75.8" r="0.8" fill="#f0d070"/>
    <circle cx="64.7" cy="80.6" r="0.4" fill="#b81c2a"/>
    <circle cx="65.9" cy="87.2" r="0.4" fill="#ffd27a"/>
    <circle cx="63.6" cy="83.7" r="0.4" fill="#ffd27a"/>
    <circle cx="66.0" cy="87.6" r="0.4" fill="#ffd27a"/>
    <path d="M113.0 99.9 L118.2 60.8 L123.4 99.9Z" fill="#234a2c"/>
    <circle cx="118.2" cy="60.8" r="1.3" fill="#f0d070"/>
    <circle cx="119.7" cy="73.4" r="0.5" fill="#b81c2a"/>
    <circle cx="117.1" cy="83.9" r="0.5" fill="#b81c2a"/>
    <circle cx="117.9" cy="72.4" r="0.5" fill="#ffd27a"/>
    <circle cx="116.6" cy="74.8" r="0.5" fill="#ffd27a"/>
    <path d="M97.5 93.4 L100.2 72.7 L103.0 93.4Z" fill="#234a2c"/>
    <circle cx="100.2" cy="72.7" r="0.8" fill="#f0d070"/>
    <circle cx="100.0" cy="86.6" r="0.4" fill="#b81c2a"/>
    <circle cx="100.6" cy="85.9" r="0.4" fill="#b81c2a"/>
    <circle cx="98.7" cy="84.8" r="0.4" fill="#b81c2a"/>
    <circle cx="99.9" cy="83.1" r="0.4" fill="#ffd27a"/>
    <path d="M93.7 91.8 L95.9 75.5 L98.0 91.8Z" fill="#234a2c"/>
    <circle cx="95.9" cy="75.5" r="0.8" fill="#f0d070"/>
    <circle cx="95.9" cy="78.0" r="0.4" fill="#ffd27a"/>
    <circle cx="95.8" cy="78.2" r="0.4" fill="#b81c2a"/>
    <circle cx="94.5" cy="87.3" r="0.4" fill="#ffd27a"/>
    <circle cx="96.4" cy="86.7" r="0.4" fill="#b81c2a"/>
    <circle cx="86.2" cy="72.2" r="1.2" fill="url(#tx-glow)"/><rect x="86.0" y="72.5" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="86.2" cy="72.4" r="0.35" fill="#fff2c0"/>
    <circle cx="79.0" cy="75.9" r="1.2" fill="url(#tx-glow)"/><rect x="78.8" y="76.2" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="79.0" cy="76.1" r="0.35" fill="#fff2c0"/>
    <circle cx="76.7" cy="79.0" r="1.2" fill="url(#tx-glow)"/><rect x="76.5" y="79.3" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="76.7" cy="79.2" r="0.35" fill="#fff2c0"/>
    <circle cx="74.0" cy="79.5" r="1.2" fill="url(#tx-glow)"/><rect x="73.8" y="79.8" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="74.0" cy="79.7" r="0.35" fill="#fff2c0"/>
    <circle cx="77.8" cy="78.7" r="1.2" fill="url(#tx-glow)"/><rect x="77.6" y="79.0" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="77.8" cy="78.9" r="0.35" fill="#fff2c0"/>
    <circle cx="81.4" cy="60.4" r="1.2" fill="url(#tx-glow)"/><rect x="81.2" y="60.7" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="81.4" cy="60.6" r="0.35" fill="#fff2c0"/>
    <circle cx="74.6" cy="72.0" r="1.2" fill="url(#tx-glow)"/><rect x="74.4" y="72.3" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="74.6" cy="72.2" r="0.35" fill="#fff2c0"/>
    <circle cx="90.7" cy="62.9" r="1.2" fill="url(#tx-glow)"/><rect x="90.5" y="63.2" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="90.7" cy="63.1" r="0.35" fill="#fff2c0"/>
    <circle cx="84.8" cy="71.6" r="1.2" fill="url(#tx-glow)"/><rect x="84.6" y="71.9" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="84.8" cy="71.8" r="0.35" fill="#fff2c0"/>
    <circle cx="77.4" cy="59.7" r="1.2" fill="url(#tx-glow)"/><rect x="77.2" y="60.0" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="77.4" cy="59.9" r="0.35" fill="#fff2c0"/>
    <circle cx="75.7" cy="79.4" r="1.2" fill="url(#tx-glow)"/><rect x="75.5" y="79.7" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="75.7" cy="79.6" r="0.35" fill="#fff2c0"/>
    <circle cx="71.8" cy="63.1" r="1.2" fill="url(#tx-glow)"/><rect x="71.6" y="63.4" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="71.8" cy="63.3" r="0.35" fill="#fff2c0"/>
    <circle cx="78.0" cy="74.0" r="1.2" fill="url(#tx-glow)"/><rect x="77.8" y="74.3" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="78.0" cy="74.2" r="0.35" fill="#fff2c0"/>
    <circle cx="78.3" cy="77.1" r="1.2" fill="url(#tx-glow)"/><rect x="78.1" y="77.4" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="78.3" cy="77.3" r="0.35" fill="#fff2c0"/>
    <circle cx="89.8" cy="51.6" r="1.2" fill="url(#tx-glow)"/><rect x="89.6" y="51.9" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="89.8" cy="51.7" r="0.35" fill="#fff2c0"/>
    <circle cx="74.1" cy="46.0" r="1.2" fill="url(#tx-glow)"/><rect x="73.8" y="46.3" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="74.1" cy="46.1" r="0.35" fill="#fff2c0"/>
    <circle cx="83.8" cy="47.2" r="1.2" fill="url(#tx-glow)"/><rect x="83.5" y="47.5" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="83.8" cy="47.4" r="0.35" fill="#fff2c0"/>
    <circle cx="68.2" cy="51.1" r="1.2" fill="url(#tx-glow)"/><rect x="67.9" y="51.4" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="68.2" cy="51.3" r="0.35" fill="#fff2c0"/>
    <circle cx="83.3" cy="59.0" r="1.2" fill="url(#tx-glow)"/><rect x="83.1" y="59.3" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="83.3" cy="59.2" r="0.35" fill="#fff2c0"/>
    <circle cx="77.8" cy="44.6" r="1.2" fill="url(#tx-glow)"/><rect x="77.6" y="44.9" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="77.8" cy="44.8" r="0.35" fill="#fff2c0"/>
    <circle cx="74.1" cy="74.4" r="1.2" fill="url(#tx-glow)"/><rect x="73.9" y="74.7" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="74.1" cy="74.6" r="0.35" fill="#fff2c0"/>
    <circle cx="76.9" cy="46.6" r="1.2" fill="url(#tx-glow)"/><rect x="76.6" y="46.9" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="76.9" cy="46.8" r="0.35" fill="#fff2c0"/>
    <circle cx="79.7" cy="68.0" r="1.2" fill="url(#tx-glow)"/><rect x="79.5" y="68.3" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="79.7" cy="68.2" r="0.35" fill="#fff2c0"/>
    <circle cx="68.7" cy="68.6" r="1.2" fill="url(#tx-glow)"/><rect x="68.5" y="68.9" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="68.7" cy="68.8" r="0.35" fill="#fff2c0"/>
    <circle cx="81.0" cy="42.3" r="1.2" fill="url(#tx-glow)"/><rect x="80.8" y="42.6" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="81.0" cy="42.4" r="0.35" fill="#fff2c0"/>
    <circle cx="81.0" cy="53.4" r="1.2" fill="url(#tx-glow)"/><rect x="80.8" y="53.7" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="81.0" cy="53.5" r="0.35" fill="#fff2c0"/>
    <circle cx="78.6" cy="55.2" r="1.2" fill="url(#tx-glow)"/><rect x="78.4" y="55.5" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="78.6" cy="55.4" r="0.35" fill="#fff2c0"/>
    <circle cx="85.1" cy="68.0" r="1.2" fill="url(#tx-glow)"/><rect x="84.9" y="68.3" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="85.1" cy="68.2" r="0.35" fill="#fff2c0"/>
    <circle cx="92.1" cy="61.0" r="1.2" fill="url(#tx-glow)"/><rect x="91.9" y="61.3" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="92.1" cy="61.2" r="0.35" fill="#fff2c0"/>
    <circle cx="88.8" cy="74.9" r="1.2" fill="url(#tx-glow)"/><rect x="88.6" y="75.2" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="88.8" cy="75.1" r="0.35" fill="#fff2c0"/>
    <circle cx="75.7" cy="39.9" r="1.2" fill="url(#tx-glow)"/><rect x="75.5" y="40.2" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="75.7" cy="40.1" r="0.35" fill="#fff2c0"/>
    <circle cx="78.7" cy="27.6" r="1.3" fill="url(#tx-glow)"/><rect x="78.5" y="27.9" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="78.7" cy="27.8" r="0.35" fill="#fff2c0"/>
    <circle cx="97.9" cy="25.5" r="1.3" fill="url(#tx-glow)"/><rect x="97.7" y="25.8" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="97.9" cy="25.6" r="0.35" fill="#fff2c0"/>
    <circle cx="101.0" cy="66.3" r="1.3" fill="url(#tx-glow)"/><rect x="100.8" y="66.6" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="101.0" cy="66.4" r="0.35" fill="#fff2c0"/>
    <circle cx="79.8" cy="26.2" r="1.4" fill="url(#tx-glow)"/><rect x="79.6" y="26.5" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="79.8" cy="26.4" r="0.35" fill="#fff2c0"/>
    <circle cx="86.0" cy="30.3" r="1.4" fill="url(#tx-glow)"/><rect x="85.7" y="30.6" width="0.45" height="1.2" fill="#eadcbf"/><circle cx="86.0" cy="30.5" r="0.35" fill="#fff2c0"/>
    <circle cx="62.5" cy="38.3" r="1.4" fill="url(#tx-glow)"/><rect x="62.3" y="38.6" width="0.45" height="1.3" fill="#eadcbf"/><circle cx="62.5" cy="38.5" r="0.35" fill="#fff2c0"/>
    <circle cx="60.2" cy="41.2" r="1.4" fill="url(#tx-glow)"/><rect x="60.0" y="41.5" width="0.45" height="1.3" fill="#eadcbf"/><circle cx="60.2" cy="41.4" r="0.35" fill="#fff2c0"/>
    <circle cx="63.9" cy="72.3" r="1.4" fill="url(#tx-glow)"/><rect x="63.7" y="72.6" width="0.45" height="1.3" fill="#eadcbf"/><circle cx="63.9" cy="72.5" r="0.35" fill="#fff2c0"/>
    <circle cx="88.2" cy="45.8" r="1.5" fill="url(#tx-glow)"/><rect x="88.0" y="46.2" width="0.45" height="1.4" fill="#eadcbf"/><circle cx="88.2" cy="46.1" r="0.35" fill="#fff2c0"/>
    <circle cx="73.9" cy="21.2" r="1.6" fill="url(#tx-glow)"/><rect x="73.6" y="21.6" width="0.45" height="1.4" fill="#eadcbf"/><circle cx="73.9" cy="21.4" r="0.35" fill="#fff2c0"/>
    <circle cx="83.7" cy="44.8" r="1.7" fill="url(#tx-glow)"/><rect x="83.4" y="45.2" width="0.45" height="1.6" fill="#eadcbf"/><circle cx="83.7" cy="45.0" r="0.35" fill="#fff2c0"/>
    <circle cx="56.9" cy="17.7" r="1.9" fill="url(#tx-glow)"/><rect x="56.7" y="18.1" width="0.45" height="1.7" fill="#eadcbf"/><circle cx="56.9" cy="17.9" r="0.35" fill="#fff2c0"/>
    <circle cx="110.2" cy="31.0" r="2.0" fill="url(#tx-glow)"/><rect x="110.0" y="31.5" width="0.45" height="1.8" fill="#eadcbf"/><circle cx="110.2" cy="31.3" r="0.35" fill="#fff2c0"/>
    <circle cx="101.5" cy="64.7" r="2.2" fill="url(#tx-glow)"/><rect x="101.3" y="65.2" width="0.45" height="2.0" fill="#eadcbf"/><circle cx="101.5" cy="65.0" r="0.35" fill="#fff2c0"/>
    <g fill="#eef4fb" opacity=".9"><circle cx="63" cy="17" r=".55"/><circle cx="54" cy="52" r=".55"/><circle cx="40" cy="7" r=".55"/><circle cx="113" cy="34" r=".55"/><circle cx="113" cy="48" r=".55"/><circle cx="85" cy="56" r=".55"/><circle cx="81" cy="29" r=".55"/><circle cx="89" cy="26" r=".55"/><circle cx="60" cy="37" r=".55"/><circle cx="119" cy="23" r=".55"/><circle cx="75" cy="38" r=".55"/><circle cx="94" cy="39" r=".55"/><circle cx="63" cy="57" r=".55"/><circle cx="56" cy="48" r=".55"/><circle cx="94" cy="53" r=".55"/><circle cx="46" cy="40" r=".55"/><circle cx="112" cy="22" r=".55"/><circle cx="70" cy="14" r=".55"/><circle cx="111" cy="38" r=".55"/><circle cx="82" cy="46" r=".55"/><circle cx="47" cy="24" r=".55"/><circle cx="105" cy="10" r=".55"/><circle cx="55" cy="59" r=".55"/><circle cx="93" cy="60" r=".55"/><circle cx="46" cy="56" r=".55"/><circle cx="119" cy="14" r=".55"/><circle cx="78" cy="54" r=".55"/><circle cx="58" cy="48" r=".55"/><circle cx="93" cy="52" r=".55"/><circle cx="95" cy="53" r=".55"/></g>
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

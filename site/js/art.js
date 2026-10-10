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
  headphones: svg('<path d="M4 15v-3a8 8 0 1 1 16 0v3"/><rect x="3" y="14" width="4" height="7" rx="1.5"/><rect x="17" y="14" width="4" height="7" rx="1.5"/>'),
};

// ---- scene cards (160 × 120) ----
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
  mixer: `<svg viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="160" height="120" fill="#000"/>
    <g fill="none" stroke="#CFE8EC"><ellipse cx="80" cy="54" rx="22" ry="11" stroke-opacity=".22"/><ellipse cx="80" cy="54" rx="40" ry="20" stroke-opacity=".14"/><ellipse cx="80" cy="54" rx="60" ry="30" stroke-opacity=".08"/></g>
    <g stroke-linecap="round" stroke-width="3"><path d="M30 96h100" stroke="#CFE8EC" stroke-opacity=".2"/><path d="M30 96h62" stroke="#CFE8EC"/><path d="M30 106h100" stroke="#CFE8EC" stroke-opacity=".2"/><path d="M30 106h28" stroke="#CFE8EC"/></g>
    <circle cx="92" cy="96" r="4" fill="#FFF6E5"/><circle cx="58" cy="106" r="4" fill="#FFF6E5"/>
  </svg>`,
};

export const logo = `<svg viewBox="0 0 32 32" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><ellipse cx="16" cy="22.5" rx="14" ry="5.5" opacity=".35"/><ellipse cx="16" cy="22.5" rx="9" ry="3.4" opacity=".6"/></g><circle cx="16" cy="6.5" r="4.5" fill="#FFC53D" opacity=".3"/><path d="M14 19.5 15 9.5h2l1 10z" fill="#E4572E"/><path d="M14.4 15.6h3.2l.25 1.6h-3.7z" fill="#FFF6E5"/><circle cx="16" cy="7" r="1.6" fill="#FFC53D"/><path d="M9.5 22c0-2.4 3-3 6.5-3s6.5.6 6.5 3z" fill="#E4572E"/><path d="M8 22.4q8-2.2 16 0-3 2.2-8 2.2t-8-2.2z" fill="#0F4A59"/></svg>`;

/* Runtime shared by every page: React + htm, vi-VN dates and numbers, seeded random, theme switch, icons. */
'use strict';

const { useState, useEffect, useMemo, useRef, useCallback, useContext, createContext, Fragment } = React;

const html = htm.bind(React.createElement);
document.documentElement.lang = 'vi';

const IMG = {
  logo: 'assets/echokid-logo.png',
  happy: 'assets/happy.png',
  calm: 'assets/calm.png',
  irritable: 'assets/angry.png',
  anxious: 'assets/worry.png',
  withdrawn: 'assets/shy.png',
};

/* ---------- dates & numbers (vi-VN) ---------- */
const pad2 = (n) => String(n).padStart(2, '0');

function localISODate(d = new Date()) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }

function dateFromISO(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }

function addDaysISO(s, n) { const d = dateFromISO(s); d.setDate(d.getDate() + n); return localISODate(d); }

function timeHM(d = new Date()) { return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }

function minutesOf(hm) { const [h, m] = hm.split(':').map(Number); return h * 60 + m; }

function hmOf(mins) { return `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`; }

const nf1 = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });

const fmt1 = (n) => nf1.format(n);

const dfLong = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' });

const dfFull = new Intl.DateTimeFormat('vi-VN');

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function fmtLongDate(iso) { return cap(dfLong.format(dateFromISO(iso))); }

function fmtFullDate(iso) { return dfFull.format(dateFromISO(iso)); }

function fmtShortDate(iso) { const d = dateFromISO(iso); return `${d.getDate()}/${d.getMonth() + 1}`; }

function weekdayShort(iso) { const w = dateFromISO(iso).getDay(); return w === 0 ? 'CN' : `T${w + 1}`; }

function relDay(iso) {
  const today = localISODate();
  if (iso === today) return 'Hôm nay';
  if (iso === addDaysISO(today, -1)) return 'Hôm qua';
  return fmtLongDate(iso);
}

function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 11) return 'Chào buổi sáng';
  if (h < 14) return 'Chào buổi trưa';
  if (h < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const MIN = 60e3, HOUR = 60 * MIN, DAY = 24 * HOUR;

/* lower-case and drop Vietnamese tone marks, so "dap dau" matches "đập đầu" and "gd-1a2b" matches "GĐ-1A2B" */
const fold = (s) => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/đ/g, 'd').trim();

const cx = (...parts) => parts.filter(Boolean).join(' ');

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pickOne = (rng, arr) => arr[Math.floor(rng() * arr.length)];

function weighted(rng, pairs) { let r = rng(); for (const [v, w] of pairs) { if ((r -= w) <= 0) return v; } return pairs[pairs.length - 1][0]; }

function applyTheme(theme) {
  if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
}

/* ---------- icons (24px stroke set) ---------- */
const ICONS = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
  book: '<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M9 7.5h6M9 11.5h6M9 15.5h3.5M5 7H3.5M5 12H3.5M5 17H3.5"/>',
  sparkle: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z"/><path d="m18.5 15 .7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z"/>',
  steth: '<path d="M5 3v5a4 4 0 0 0 8 0V3"/><path d="M9 12v2a5 5 0 0 0 10 0v-1.5"/><circle cx="19" cy="10.5" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12.3 2.7 2.7L16 9.7"/>',
  chevronRight: '<path d="m9 6 6 6-6 6"/>',
  chevronLeft: '<path d="m15 6-6 6 6 6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  alert: '<path d="M10.3 4.2 2.6 17.5a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z"/><path d="M12 9.5v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5h.01"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>',
  storm: '<path d="M7 17.5a4.5 4.5 0 1 1 .9-8.9A6 6 0 0 1 19.4 10.5 3.5 3.5 0 0 1 18 17.5"/><path d="m12.5 12.5-2 3.5h3l-2 3.5"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19.5c.6-3.4 2.8-5.5 6-5.5s5.4 2.1 6 5.5"/><path d="M15.5 5.2a3 3 0 0 1 0 5.6M17.5 14.2c2 .6 3.2 2.4 3.5 5.3"/>',
  heart: '<path d="M12 20s-7.5-4.6-9.2-9.3C1.7 7.4 3.8 4.5 7 4.5c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.2 0 5.3 2.9 4.2 6.2C19.5 15.4 12 20 12 20Z"/>',
  pencil: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 1.5M9.5 2.5h5"/>',
  phone: '<path d="M6.5 3.5h3l1.5 4-2 1.3a11 11 0 0 0 6.2 6.2l1.3-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2Z"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
  shield: '<path d="M12 3 19 6v5.5c0 4.4-3 7.9-7 9.5-4-1.6-7-5.1-7-9.5V6Z"/><path d="m9 12 2 2 4-4"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  star: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4"/>',
  logout: '<path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 16l4-4-4-4M19 12H9"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  trendDown: '<path d="m3 7 6 6 4-4 8 8"/><path d="M21 11v6h-6"/>',
  trendUp: '<path d="m3 17 6-6 4 4 8-8"/><path d="M21 13V7h-6"/>',
  trendFlat: '<path d="M3 12h18M15 6l6 6-6 6"/>',
  sprout: '<path d="M12 20v-8"/><path d="M12 12C12 8 9.5 5.5 5 5.5c0 4.5 2.5 6.5 7 6.5Z"/><path d="M12 14c0-3.5 2.5-6 7-6 0 4-2.5 6-7 6Z"/>',
  table: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M3.5 14.5h17M9.5 9.5v10"/>',
  home: '<path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5M10 20v-5.5h4V20"/>',
  bookOpen: '<path d="M2.5 5.5C5 4 8 4 12 6c4-2 7-2 9.5-.5V19c-2.5-1.5-5.5-1.5-9.5.5-4-2-7-2-9.5-.5Z"/><path d="M12 6v13.5"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5c1 1.3 2.1 2 3.5 2s2.5-.7 3.5-2M9 9.5h.01M15 9.5h.01"/>',
  utensils: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10"/><path d="M17 21V3c-2.2 1-3.5 3.5-3.5 7v3H17"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
  chart: '<path d="M4 20V11M10 20V5M16 20v-6M21 20H3"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><path d="M14.8 9.3c-.5-.9-1.5-1.4-2.8-1.4-1.6 0-2.8.8-2.8 2.1 0 2.9 5.8 1.5 5.8 4.3 0 1.3-1.2 2.1-3 2.1-1.4 0-2.5-.6-3-1.6M12 6.3v1.5M12 16.4v1.4"/>',
  server: '<rect x="3.5" y="4" width="17" height="7" rx="2"/><rect x="3.5" y="13" width="17" height="7" rx="2"/><path d="M7.5 7.5h.01M7.5 16.5h.01"/>',
  gauge: '<path d="M4.5 17.5a8.5 8.5 0 1 1 15 0"/><path d="m12 13.5 3.5-4"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
};

function Icon({ name, className }) {
  return html`<svg className=${cx('icon', className)} viewBox="0 0 24 24" aria-hidden="true" focusable="false"
    fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    dangerouslySetInnerHTML=${{ __html: ICONS[name] || '' }}></svg>`;
}

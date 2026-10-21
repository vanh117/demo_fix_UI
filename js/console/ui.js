/* Moderator console UI kit: formatting helpers, Tailwind components on the EchoKid tokens, dialogs, toasts and
   the data hooks every page uses (useApi / send). */
'use strict';

/* ---------- extra icons, same 24px stroke set as core.js ---------- */
Object.assign(ICONS, {
  menu: '<path d="M4 6.5h16M4 12h16M4 17.5h16"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15Z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  inbox: '<path d="M3.5 13.5 6 5h12l2.5 8.5V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19Z"/><path d="M3.5 13.5h5l1.5 2.5h4l1.5-2.5h5"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5M4.5 20h15"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5"/>',
  power: '<path d="M12 3.5v8M7 6.5a7.5 7.5 0 1 0 10 0"/>',
  megaphone: '<path d="M4 10v4h3l9 5V5L7 10Z"/><path d="M7 14v4.5h3v-3M19 10a3 3 0 0 1 0 4"/>',
  history: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9"/><path d="M4.5 4.5V9H9M12 8v4.5l3 1.8"/>',
  userPlus: '<circle cx="10" cy="8" r="3.5"/><path d="M3.5 20c.7-3.8 3.1-6 6.5-6 1.6 0 3 .5 4 1.4M18 14v6M15 17h6"/>',
  ban: '<circle cx="12" cy="12" r="8.5"/><path d="m6 6 12 12"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="m4 7 8 6 8-6"/>',
  activity: '<path d="M3 12h4l2.5-6 5 12 2.5-6h4"/>',
  tag: '<path d="M3.5 12.5V4.5h8l9 9-8 8Z"/><circle cx="8" cy="9" r="1.2"/>',
  send: '<path d="M20.5 3.5 10 14M20.5 3.5 14 20.5l-4-6.5-6.5-4Z"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 8.5-8.5M16.5 6.5l2.5 2.5M14 9l2 2"/>',
  command: '<path d="M9 6v12M15 6v12M6 9h12M6 15h12"/>',
  play: '<path d="M8 5.5v13l10.5-6.5Z"/>',
  message: '<path d="M4.5 5.5h15v10h-9l-4.5 4v-4h-1.5Z"/>',
  pause: '<path d="M8.5 5.5v13M15.5 5.5v13"/>',
});

/* ---------- numbers, time and text (vi-VN) ---------- */
const nfInt = new Intl.NumberFormat('vi-VN');
const fmtInt = (n) => nfInt.format(Math.round(n));
const usd = (n, digits = 2) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
const pct = (x, digits = 1) => new Intl.NumberFormat('vi-VN', { style: 'percent', maximumFractionDigits: digits }).format(Number.isFinite(x) ? x : 0);
const hourRange = (h, span = 1) => `${pad2(h % 24)}:00–${pad2((h + span) % 24)}:00`;
const fmtDT = (ms) => { const d = new Date(ms); return `${timeHM(d)}, ${d.getDate()}/${d.getMonth() + 1}`; };
const fmtDate = (ms) => { const d = new Date(ms); return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`; };
function durationText(ms) {
  const m = Math.max(0, Math.round(ms / MIN));
  if (m < 1) return 'dưới 1 phút';
  if (m < 60) return `${m} phút`;
  const h = Math.floor(m / 60), rm = m % 60;
  if (h < 24) return rm && h < 6 ? `${h} giờ ${rm} phút` : `${h} giờ`;
  const d = Math.floor(h / 24), rh = h % 24;
  return rh && d < 3 ? `${d} ngày ${rh} giờ` : `${d} ngày`;
}
const ago = (ms) => (Date.now() - ms < MIN ? 'vừa xong' : `${durationText(Date.now() - ms)} trước`);
function initials(name) {
  const words = String(name).replace(/^(BS|ThS|TS|CN|PGS)\.\s*/, '').trim().split(/\s+/);
  return (words.length > 1 ? words[words.length - 2][0] + words[words.length - 1][0] : words[0].slice(0, 2)).toUpperCase();
}
function readPref(key, fallback) { try { return localStorage.getItem(key) ?? fallback; } catch (e) { return fallback; } }
function writePref(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* private window: keep it in memory only */ } }

/* ---------- data: one refresh signal for every useApi() on screen ---------- */
const dataBus = { version: 0, subs: new Set(), onAuth: null };
function refreshAll() { dataBus.version += 1; dataBus.subs.forEach((f) => f(dataBus.version)); }

async function request(path, init) {
  let res;
  try { res = await consoleFetch(path, init); } catch (e) { return { ok: false, status: 0, body: { error: 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.' } }; }
  let body;
  try { body = await res.json(); } catch (e) { body = { error: 'Máy chủ trả về dữ liệu không đọc được.' }; }
  if (res.status === 401) dataBus.onAuth?.('expired');
  if (res.status === 403 && body?.code === 'NOT_A_MODERATOR') dataBus.onAuth?.('denied');
  return { ok: res.ok, status: res.status, body };
}

/* writes refresh every list on screen; failures surface as a toast unless the caller shows them inline */
async function send(path, method, payload, { quiet } = {}) {
  const r = await request(path, { method, body: JSON.stringify(payload || {}) });
  if (r.ok) refreshAll();
  else if (r.status !== 401 && !quiet) toast(r.body?.error || 'Chưa lưu được, vui lòng thử lại.', 'crit');
  return r;
}

/* keeps the last good data on screen while refetching, so filters don't flash skeletons */
function useApi(path) {
  const [version, setVersion] = useState(dataBus.version);
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState({ data: null, error: null, loading: !!path });
  useEffect(() => { dataBus.subs.add(setVersion); return () => dataBus.subs.delete(setVersion); }, []);
  useEffect(() => {
    if (!path) { setState({ data: null, error: null, loading: false }); return undefined; }
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    request(path).then((r) => {
      if (!alive) return;
      /* a 401 keeps the page as it was under the sign-in dialog */
      setState((s) => (r.ok ? { data: r.body, error: null, loading: false }
        : { data: r.status === 401 ? s.data : null, error: { status: r.status, message: r.body?.error || 'Không tải được dữ liệu.' }, loading: false }));
    });
    return () => { alive = false; };
  }, [path, version, nonce]);
  return { ...state, reload: () => setNonce((n) => n + 1) };
}

/* ---------- toasts ---------- */
const toastBus = { list: [], subs: new Set() };
function toast(text, tone = 'good') {
  const id = Math.random().toString(36).slice(2);
  const emit = () => toastBus.subs.forEach((f) => f(toastBus.list));
  toastBus.list = [...toastBus.list, { id, text, tone }]; emit();
  setTimeout(() => { toastBus.list = toastBus.list.filter((t) => t.id !== id); emit(); }, tone === 'crit' ? 6000 : 3800);
}
function Toasts() {
  const [list, setList] = useState(toastBus.list);
  useEffect(() => { toastBus.subs.add(setList); return () => toastBus.subs.delete(setList); }, []);
  return html`<div className="pointer-events-none fixed inset-x-4 bottom-4 z-[70] flex flex-col items-center gap-2 sm:inset-x-auto sm:left-6 sm:items-start lg:left-[292px]" role="status" aria-live="polite">
    ${list.map((t) => html`<div key=${t.id} className="pointer-events-auto flex max-w-sm items-start gap-2.5 rounded-xl bg-ink px-4 py-3 text-sm font-medium text-surface shadow-pop motion-safe:animate-pop">
      <${Icon} name=${t.tone === 'crit' ? 'alert' : 'checkCircle'} className=${cx('mt-px size-[18px]', t.tone === 'crit' ? 'text-crit-line' : 'text-good-line')} />${t.text}</div>`)}
  </div>`;
}

async function copyText(text, label = 'Đã chép') {
  try { await navigator.clipboard.writeText(text); toast(label); }
  catch (e) { toast('Trình duyệt chặn sao chép. Hãy bôi đen và chép thủ công.', 'crit'); }
}
function downloadFile(name, text, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob(['﻿' + text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- primitives ---------- */
const TONES = {
  neutral: 'border-line bg-surface-2 text-ink-2',
  primary: 'border-transparent bg-primary-tint text-primary-ink',
  info: 'border-transparent bg-teal-tint text-teal',
  good: 'border-good-line bg-good-tint text-good',
  warn: 'border-warn-line bg-warn-tint text-warn',
  crit: 'border-crit-line bg-crit-tint text-crit',
};
const TONE_TEXT = { neutral: 'text-ink-3', primary: 'text-primary-ink', info: 'text-teal', good: 'text-good', warn: 'text-warn', crit: 'text-crit' };

function Pill({ tone = 'neutral', icon, children, className, title }) {
  return html`<span title=${title} className=${cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-px text-xs font-semibold leading-5', TONES[tone], className)}>
    ${icon && html`<${Icon} name=${icon} className="size-3.5" />`}${children}</span>`;
}

const BTN_VARIANT = {
  primary: 'bg-primary text-on-primary shadow-sm hover:bg-primary-hover',
  secondary: 'border border-line-strong bg-surface text-ink hover:border-control hover:bg-surface-2',
  quiet: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  danger: 'bg-crit-btn text-on-crit shadow-sm hover:bg-crit-btn-hover',
  dangerQuiet: 'text-crit hover:bg-crit-tint',
};
const BTN_SIZE = { xs: 'h-7 gap-1 rounded-lg px-2 text-xs', sm: 'h-8 gap-1.5 rounded-lg px-3 text-[13px]', md: 'h-10 gap-2 rounded-xl px-4 text-sm', lg: 'h-11 gap-2 rounded-xl px-5 text-[15px]' };
const btnClass = (variant = 'primary', size = 'md', block, className) => cx('inline-flex shrink-0 items-center justify-center whitespace-nowrap font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50', BTN_VARIANT[variant], BTN_SIZE[size], block && 'w-full', className);
const btnIcon = (size) => (size === 'xs' || size === 'sm' ? 'size-4' : 'size-[18px]');

function Button({ variant, size = 'md', icon, iconRight, block, className, type = 'button', busy, children, ...rest }) {
  return html`<button type=${type} className=${btnClass(variant, size, block, className)} aria-busy=${busy || undefined} ...${rest}>
    ${busy ? html`<span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true"></span>` : icon && html`<${Icon} name=${icon} className=${btnIcon(size)} />`}
    ${children}${iconRight && html`<${Icon} name=${iconRight} className="size-4" />`}
  </button>`;
}
function LinkButton({ variant = 'secondary', size = 'md', icon, iconRight, block, className, children, ...rest }) {
  return html`<a className=${btnClass(variant, size, block, className)} ...${rest}>${icon && html`<${Icon} name=${icon} className=${btnIcon(size)} />`}${children}${iconRight && html`<${Icon} name=${iconRight} className="size-4" />`}</a>`;
}
function IconButton({ icon, label, className, badge, ...rest }) {
  return html`<button type="button" aria-label=${label} title=${label} className=${cx('relative inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink', className)} ...${rest}>
    <${Icon} name=${icon} className="size-5" />
    ${badge ? html`<span className="absolute right-1 top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-crit-btn px-1 text-[11px] font-bold leading-none text-on-crit">${badge}</span>` : null}
  </button>`;
}

function Card({ className, children, ...rest }) {
  return html`<section className=${cx('rounded-2xl border border-line bg-surface shadow-card', className)} ...${rest}>${children}</section>`;
}
function CardHead({ icon, title, sub, actions, id, className }) {
  return html`<div className=${cx('flex flex-wrap items-start gap-x-4 gap-y-2 px-5 pt-5', className)}>
    <div className="min-w-0 flex-1">
      <h2 id=${id} className="flex items-center gap-2 text-[15px] font-bold text-ink">${icon && html`<${Icon} name=${icon} className="size-[18px] text-ink-3" />`}${title}</h2>
      ${sub && html`<p className="mt-1 text-[13px] leading-relaxed text-ink-3">${sub}</p>`}
    </div>
    ${actions && html`<div className="flex shrink-0 flex-wrap items-center gap-2">${actions}</div>`}
  </div>`;
}
function PageHeader({ title, sub, actions, kicker }) {
  return html`<header className="mb-6 flex flex-wrap items-end gap-x-6 gap-y-4">
    <div className="min-w-0 flex-1 basis-[20rem]">
      ${kicker && html`<p className="mb-1.5 text-[13px] font-semibold text-primary-ink">${kicker}</p>`}
      <h1 className="text-[26px] font-bold leading-tight tracking-tight text-ink sm:text-[28px]">${title}</h1>
      ${sub && html`<p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-2">${sub}</p>`}
    </div>
    ${actions && html`<div className="flex flex-wrap items-center gap-2">${actions}</div>`}
  </header>`;
}

function Stat({ label, value, sub, delta, tone, icon, href }) {
  const body = html`
    <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink-2">${icon && html`<${Icon} name=${icon} className=${cx('size-4', tone ? TONE_TEXT[tone] : 'text-ink-3')} />`}${label}</p>
    <p className=${cx('mt-2.5 text-[26px] font-bold leading-none tracking-tight', tone === 'crit' || tone === 'warn' ? TONE_TEXT[tone] : 'text-ink')}>${value}</p>
    ${sub && html`<p className="mt-2 text-[13px] leading-snug text-ink-3">${sub}</p>`}
    ${delta && html`<div className="mt-2">${delta}</div>`}`;
  const cls = 'block rounded-2xl border border-line bg-surface p-4 shadow-card';
  return href ? html`<a href=${href} className=${cx(cls, 'transition-colors hover:border-line-strong hover:bg-surface-2/50')}>${body}</a>` : html`<div className=${cls}>${body}</div>`;
}

/* change vs the previous period; coloured only when up/down has a clear good/bad meaning */
function Delta({ cur, prev, goodWhenUp, neutral }) {
  if (!prev) return html`<span className="text-xs text-ink-3">Chưa có kỳ trước để so</span>`;
  const d = (cur - prev) / prev;
  if (Math.abs(d) < 0.005) return html`<span className="inline-flex items-center gap-1 text-xs font-medium text-ink-3"><${Icon} name="trendFlat" className="size-3.5" />Như kỳ trước</span>`;
  const up = d > 0;
  const tone = neutral ? 'text-ink-3' : up === !!goodWhenUp ? 'text-good' : 'text-crit';
  return html`<span className=${cx('inline-flex items-center gap-1 text-xs font-semibold', tone)}><${Icon} name=${up ? 'trendUp' : 'trendDown'} className="size-3.5" />${up ? '+' : '−'}${pct(Math.abs(d), 0)} so với kỳ trước</span>`;
}

function Segmented({ value, onChange, options, label, size = 'md', className }) {
  return html`<div role="group" aria-label=${label} className=${cx('inline-flex max-w-full gap-0.5 overflow-x-auto rounded-xl border border-line bg-surface-2 p-1', className)}>
    ${options.map((o) => {
      const on = String(o.value) === String(value);
      return html`<button key=${o.value} type="button" aria-pressed=${on} onClick=${() => onChange(o.value)}
        className=${cx('inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg font-semibold transition-colors', size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-[13px]', on ? 'bg-surface text-ink shadow-sm' : 'text-ink-2 hover:text-ink')}>
        ${o.icon && html`<${Icon} name=${o.icon} className="size-4" />`}${o.label}
        ${o.count != null && html`<span className=${cx('min-w-5 rounded-full px-1.5 text-center text-[11px] leading-[18px] tabular-nums', o.tone === 'crit' && o.count ? 'bg-crit-tint text-crit' : on ? 'bg-surface-2 text-ink-2' : 'bg-surface-3 text-ink-2')}>${o.count}</span>`}
      </button>`;
    })}
  </div>`;
}

const CONTROL = 'block w-full rounded-xl border border-line-strong bg-surface text-sm text-ink placeholder:text-ink-3 transition-[border-color,box-shadow] hover:border-control focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60';
function Input({ className, ...rest }) { return html`<input className=${cx(CONTROL, 'h-10 px-3', className)} ...${rest} />`; }
function Textarea({ className, ...rest }) { return html`<textarea className=${cx(CONTROL, 'min-h-[92px] px-3 py-2.5 leading-relaxed', className)} ...${rest}></textarea>`; }
function Select({ className, children, ...rest }) {
  return html`<div className=${cx('relative', className)}>
    <select className=${cx(CONTROL, 'h-10 appearance-none pl-3 pr-9')} ...${rest}>${children}</select>
    <${Icon} name="chevronDown" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
  </div>`;
}
function SearchBox({ value, onChange, placeholder, className, id }) {
  return html`<div className=${cx('relative', className)}>
    <${Icon} name="search" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
    <input id=${id} type="search" aria-label=${placeholder} placeholder=${placeholder} value=${value} onChange=${(e) => onChange(e.target.value)} className=${cx(CONTROL, 'h-10 pl-9 pr-3')} />
  </div>`;
}
function Field({ label, htmlFor, hint, error, aside, children, className }) {
  return html`<div className=${cx('space-y-1.5', className)}>
    ${label && html`<div className="flex items-baseline justify-between gap-3"><label htmlFor=${htmlFor} className="text-[13px] font-semibold text-ink">${label}</label>${aside}</div>`}
    ${children}
    ${error ? html`<p className="flex items-start gap-1.5 text-[13px] font-medium text-crit" role="alert"><${Icon} name="info" className="mt-px size-4" />${error}</p>`
      : hint && html`<p className="text-[12.5px] leading-snug text-ink-3">${hint}</p>`}
  </div>`;
}
function Check({ checked, onChange, children, disabled, hint }) {
  return html`<label className=${cx('flex cursor-pointer items-start gap-3 rounded-xl px-1 py-1.5 text-sm text-ink', disabled && 'cursor-not-allowed opacity-60')}>
    <input type="checkbox" className="mt-0.5 size-[18px] shrink-0 cursor-pointer accent-primary" checked=${checked} disabled=${disabled} onChange=${(e) => onChange(e.target.checked)} />
    <span className="leading-snug">${children}${hint && html`<span className="mt-0.5 block text-[12.5px] text-ink-3">${hint}</span>`}</span>
  </label>`;
}
function Switch({ checked, onChange, label, disabled, id }) {
  return html`<button type="button" role="switch" id=${id} aria-checked=${checked} aria-label=${label} disabled=${disabled} onClick=${() => onChange(!checked)}
    className=${cx('relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50', checked ? 'bg-primary' : 'bg-line-strong')}>
    <span className=${cx('inline-block size-5 rounded-full bg-surface shadow-sm transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-0.5')}></span>
  </button>`;
}

/* fill carries the state; the track is a lighter step of the same hue */
function Meter({ value, tone = 'primary', label, className }) {
  const fill = { primary: 'bg-primary', good: 'bg-good', warn: 'bg-warn', crit: 'bg-crit' }[tone];
  const track = { primary: 'bg-primary-tint', good: 'bg-good-tint', warn: 'bg-warn-tint', crit: 'bg-crit-tint' }[tone];
  const v = clamp(Number.isFinite(value) ? value : 0, 0, 1);
  return html`<div className=${cx('h-2 w-full overflow-hidden rounded-full', track, className)} role="meter" aria-label=${label} aria-valuemin="0" aria-valuemax="100" aria-valuenow=${Math.round(v * 100)}>
    <div className=${cx('h-full rounded-full transition-[width] duration-500', fill)} style=${{ width: `${v * 100}%` }}></div>
  </div>`;
}

const AVATAR_TONES = ['bg-primary-tint text-primary-ink', 'bg-teal-tint text-teal', 'bg-peach-tint text-peach-ink'];
function Avatar({ name, size = 'md' }) {
  const h = [...String(name)].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const sz = { xs: 'size-6 text-[10px]', sm: 'size-7 text-[11px]', md: 'size-9 text-[13px]', lg: 'size-12 text-base' }[size];
  return html`<span aria-hidden="true" className=${cx('inline-grid shrink-0 place-items-center rounded-full font-bold', sz, AVATAR_TONES[h % 3])}>${initials(name)}</span>`;
}
function Kbd({ children }) { return html`<kbd className="rounded-md border border-line-strong bg-surface px-1.5 py-px font-sans text-[11px] font-semibold text-ink-3">${children}</kbd>`; }

function Callout({ tone = 'info', icon, title, children, action, className }) {
  const box = { info: 'border-line bg-surface-2', warn: 'border-warn-line bg-warn-tint', crit: 'border-crit-line bg-crit-tint', good: 'border-good-line bg-good-tint' }[tone];
  const ic = { info: 'text-ink-3', warn: 'text-warn', crit: 'text-crit', good: 'text-good' }[tone];
  return html`<div className=${cx('flex flex-wrap items-start gap-x-3 gap-y-2 rounded-xl border px-4 py-3 text-[13px] leading-relaxed text-ink-2', box, className)}>
    <${Icon} name=${icon || (tone === 'good' ? 'checkCircle' : tone === 'info' ? 'info' : 'alert')} className=${cx('mt-0.5 size-[18px]', ic)} />
    <div className="min-w-0 flex-1 basis-60">${title && html`<p className="font-semibold text-ink">${title}</p>`}${children}</div>
    ${action && html`<div className="shrink-0">${action}</div>`}
  </div>`;
}
function EmptyState({ icon = 'checkCircle', title, text, children }) {
  return html`<div className="flex flex-col items-center px-6 py-12 text-center">
    <span className="grid size-12 place-items-center rounded-2xl bg-surface-2 text-ink-3"><${Icon} name=${icon} className="size-6" /></span>
    <p className="mt-3 text-[15px] font-semibold text-ink">${title}</p>
    ${text && html`<p className="mt-1 max-w-sm text-[13px] leading-relaxed text-ink-3">${text}</p>`}
    ${children && html`<div className="mt-4">${children}</div>`}
  </div>`;
}
function Skel({ h = 120, className }) { return html`<div className=${cx('animate-pulse rounded-2xl bg-surface-2', className)} style=${{ height: h }} aria-hidden="true"></div>`; }
function ErrorCard({ error, onRetry }) {
  const denied = error.status === 403;
  return html`<${Card} className="p-2"><${EmptyState} icon=${denied ? 'lock' : 'alert'} title=${denied ? 'Bạn không có quyền xem mục này' : 'Chưa tải được dữ liệu'}
    text=${denied ? 'Quyền được cấp theo vai trò. Nhờ quản trị viên nếu bạn cần xem mục này.' : error.message}>
    ${!denied && html`<${Button} variant="secondary" size="sm" icon="refresh" onClick=${onRetry}>Thử lại<//>`}<//><//>`;
}
/* skeleton the first time, the last good render (dimmed) while refetching, a retry card on failure */
function Loaded({ q, skeleton, children }) {
  if (q.error && !q.data) return html`<${ErrorCard} error=${q.error} onRetry=${q.reload} />`;
  if (!q.data) return skeleton || html`<${Skel} h=${260} />`;
  return html`<div className=${cx('transition-opacity duration-200', q.loading && 'opacity-60')} aria-busy=${q.loading}>${children(q.data)}</div>`;
}

const TH = 'whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold text-ink-3';
const TD = 'px-4 py-3 align-middle';
function Table({ head, children, minWidth = 640, className }) {
  return html`<div className=${cx('overflow-x-auto', className)}><table className="w-full border-collapse text-sm" style=${{ minWidth }}>
    <thead className="border-y border-line bg-surface-2/70"><tr>${head.map((h, i) => (typeof h === 'string' ? html`<th key=${i} scope="col" className=${TH}>${h}</th>` : html`<th key=${i} scope="col" className=${cx(TH, h.className)}>${h.label}</th>`))}</tr></thead>
    <tbody className="divide-y divide-line">${children}</tbody>
  </table></div>`;
}
function Pager({ page, pageSize, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? (page - 1) * pageSize + 1 : 0, to = Math.min(total, page * pageSize);
  return html`<div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-[13px] text-ink-3">
    <span>Hiển thị <b className="font-semibold text-ink">${fmtInt(from)}–${fmtInt(to)}</b> trên ${fmtInt(total)}</span>
    ${pages > 1 && html`<div className="flex items-center gap-1.5">
      <${Button} variant="secondary" size="sm" icon="chevronLeft" disabled=${page <= 1} onClick=${() => onPage(page - 1)}>Trước<//>
      <span className="px-1.5 tabular-nums">${page}/${pages}</span>
      <${Button} variant="secondary" size="sm" iconRight="chevronRight" disabled=${page >= pages} onClick=${() => onPage(page + 1)}>Sau<//>
    </div>`}
  </div>`;
}
/* key / value rows for detail panels */
function Facts({ rows, className }) {
  return html`<dl className=${cx('grid grid-cols-[minmax(0,10rem)_1fr] gap-x-4 gap-y-2.5 text-sm', className)}>
    ${rows.filter(Boolean).map(([k, v]) => html`<${Fragment} key=${k}><dt className="text-ink-3">${k}</dt><dd className="min-w-0 font-medium text-ink">${v}</dd><//>`)}
  </dl>`;
}

/* ---------- dialogs: one shared stack so Escape only closes the top one ---------- */
const dialogStack = [];
function useDialog(open, onClose, ref, { busy, focusFirstInput } = {}) {
  const live = useRef(null);
  live.current = { onClose, busy };
  useEffect(() => {
    if (!open) return undefined;
    const token = {};
    dialogStack.push(token);
    const opener = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const node = ref.current;
    const raf = requestAnimationFrame(() => {
      const first = node && (node.querySelector('[data-autofocus]') || (focusFirstInput && node.querySelector('input:not([type=hidden]):not([disabled]), textarea, select')));
      (first || node)?.focus({ preventScroll: true });
    });
    const onKey = (e) => {
      if (dialogStack[dialogStack.length - 1] !== token) return;
      if (e.key === 'Escape' && !live.current.busy) { e.preventDefault(); live.current.onClose(); }
      if (e.key === 'Tab' && node) {
        const items = [...node.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]')].filter((el) => el.offsetParent !== null);
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === node)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      dialogStack.splice(dialogStack.indexOf(token), 1);
      if (!dialogStack.length) document.body.style.overflow = prevOverflow;
      if (opener && opener.focus && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [open]);
}

function Drawer({ open, onClose, title, sub, badges, children, footer, busy, wide }) {
  const ref = useRef(null);
  const id = React.useId();
  useDialog(open, onClose, ref, { busy });
  if (!open) return null;
  return html`<div className="fixed inset-0 z-50 flex justify-end">
    <div className="absolute inset-0 bg-scrim motion-safe:animate-fade" onMouseDown=${() => !busy && onClose()}></div>
    <section ref=${ref} role="dialog" aria-modal="true" aria-labelledby=${id} tabIndex="-1"
      className=${cx('relative flex h-full w-full flex-col bg-surface shadow-pop outline-none motion-safe:animate-drawer', wide ? 'sm:max-w-2xl' : 'sm:max-w-xl')}>
      <header className="flex items-start gap-3 border-b border-line px-5 py-4 sm:px-6">
        <div className="min-w-0 flex-1">
          ${badges && html`<div className="mb-1.5 flex flex-wrap items-center gap-1.5">${badges}</div>`}
          <h2 id=${id} className="text-lg font-bold leading-snug text-ink">${title}</h2>
          ${sub && html`<p className="mt-0.5 text-[13px] text-ink-3">${sub}</p>`}
        </div>
        <${IconButton} icon="x" label="Đóng" onClick=${onClose} disabled=${busy} className="-mr-2" />
      </header>
      <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">${children}</div>
      ${footer && html`<footer className="flex flex-wrap items-center gap-2 border-t border-line bg-surface px-5 py-3.5 sm:px-6">${footer}</footer>`}
    </section>
  </div>`;
}

function Modal({ open, onClose, title, intro, children, footer, busy, tone, dismissible = true }) {
  const ref = useRef(null);
  const id = React.useId();
  useDialog(open, onClose, ref, { busy: busy || !dismissible, focusFirstInput: true });
  if (!open) return null;
  return html`<div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-6">
    <div className="absolute inset-0 bg-scrim motion-safe:animate-fade" onMouseDown=${() => !busy && dismissible && onClose()}></div>
    <section ref=${ref} role="dialog" aria-modal="true" aria-labelledby=${id} tabIndex="-1"
      className="relative flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-surface shadow-pop outline-none motion-safe:animate-pop sm:max-w-lg sm:rounded-2xl">
      <header className="flex items-start gap-3 px-5 pb-2 pt-5 sm:px-6">
        ${tone && html`<span className=${cx('grid size-10 shrink-0 place-items-center rounded-xl', tone === 'crit' ? 'bg-crit-tint text-crit' : tone === 'warn' ? 'bg-warn-tint text-warn' : 'bg-primary-tint text-primary-ink')}><${Icon} name=${tone === 'crit' ? 'alert' : tone === 'warn' ? 'lock' : 'info'} className="size-5" /></span>`}
        <div className="min-w-0 flex-1 pt-0.5"><h2 id=${id} className="text-[17px] font-bold leading-snug text-ink">${title}</h2>${intro && html`<p className="mt-1 text-[13px] leading-relaxed text-ink-2">${intro}</p>`}</div>
        ${dismissible && html`<${IconButton} icon="x" label="Đóng" onClick=${onClose} disabled=${busy} className="-mr-2 -mt-1" />`}
      </header>
      ${children && html`<div className="overflow-y-auto px-5 py-3 sm:px-6">${children}</div>`}
      ${footer && html`<footer className="flex flex-wrap justify-end gap-2 px-5 pb-5 pt-3 sm:px-6">${footer}</footer>`}
    </section>
  </div>`;
}

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const down = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', down); document.removeEventListener('keydown', key); };
  }, [open]);
  return { open, setOpen, ref };
}

/* re-render every `ms` so countdowns and "x minutes ago" stay true */
function useNow(ms = 30e3) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

/* Console charts: column chart (hover + arrow keys), weekday × hour heatmap and a share bar. Each chart has a table twin. */
'use strict';

/* clean axis ticks: 0 and 3–5 round steps covering max */
function niceTicks(max, target = 4) {
  if (!(max > 0)) return { top: 1, ticks: [0, 1] };
  const raw = max / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((v) => v >= raw);
  const top = Math.ceil(max / step) * step;
  return { top, ticks: Array.from({ length: Math.round(top / step) + 1 }, (_, i) => +(i * step).toFixed(10)) };
}

/* x-axis label for a day: weekday for a week, a date every few days otherwise */
function dayAxisLabel(date, index, count) {
  if (count <= 7) return weekdayShort(date);
  const every = count <= 31 ? 5 : 15;
  return index % every === 0 || index === count - 1 ? fmtShortDate(date) : '';
}

function TableView({ head, rows }) {
  return html`<details className="group mt-4 border-t border-line pt-3">
    <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-lg text-[13px] font-semibold text-ink-2 hover:text-ink">
      <${Icon} name="table" className="size-4" />Xem dạng bảng<${Icon} name="chevronDown" className="size-4 transition-transform group-open:rotate-180" /></summary>
    <div className="mt-3 max-h-72 overflow-auto rounded-xl border border-line">
      <table className="w-full text-[13px]">
        <thead className="sticky top-0 bg-surface-2"><tr>${head.map((h, i) => html`<th key=${i} scope="col" className=${cx('px-3 py-2 font-semibold text-ink-3', i ? 'text-right' : 'text-left')}>${h}</th>`)}</tr></thead>
        <tbody className="divide-y divide-line">${rows.map((r, i) => html`<tr key=${i}>${r.map((c, j) => (j ? html`<td key=${j} className="px-3 py-1.5 text-right tabular-nums">${c}</td>` : html`<th key=${j} scope="row" className="px-3 py-1.5 text-left font-medium">${c}</th>`))}</tr>`)}</tbody>
      </table>
    </div>
  </details>`;
}

/* one series: no legend (the title names it), max bar labelled, hover or arrow keys for the rest */
function ColumnChart({ title, sub, points, fmt, labelled, color = 'var(--viz-1)', height = 220, yWidth = 48, emptyText = 'Chưa có dữ liệu.', tableHead, footer }) {
  const [active, setActive] = useState(null);
  const n = points.length;
  const { top, ticks } = niceTicks(Math.max(0, ...points.map((p) => p.value)));
  const hasData = points.some((p) => p.value > 0);
  const tip = active != null ? points[active] : null;
  const leftPct = active != null ? ((active + 0.5) / n) * 100 : 0;
  const shift = leftPct < 18 ? '-12%' : leftPct > 82 ? '-88%' : '-50%';
  const onKey = (e) => {
    const go = { ArrowRight: (a) => (a == null ? 0 : Math.min(n - 1, a + 1)), ArrowLeft: (a) => (a == null ? n - 1 : Math.max(0, a - 1)), Home: () => 0, End: () => n - 1 }[e.key];
    if (go) { e.preventDefault(); setActive(go); }
    if (e.key === 'Escape') setActive(null);
  };
  return html`<figure className="rounded-2xl border border-line bg-surface p-5 shadow-card">
    <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <span className="text-[15px] font-bold text-ink">${title}</span><span className="text-[13px] text-ink-3">${sub}</span>
    </figcaption>
    ${!hasData ? html`<p className="grid place-items-center text-sm text-ink-3" style=${{ height }}>${emptyText}</p>` : html`
    <div className="mt-6 grid" style=${{ gridTemplateColumns: `${yWidth}px minmax(0,1fr)` }}>
      <div className="relative" style=${{ height }} aria-hidden="true">
        ${ticks.map((t) => html`<span key=${t} className="absolute right-2.5 translate-y-1/2 text-[11px] tabular-nums text-ink-3" style=${{ bottom: `${(t / top) * 100}%` }}>${fmt(t)}</span>`)}
      </div>
      <div className="relative rounded-sm outline-offset-4" style=${{ height }} tabIndex="0" role="group"
        aria-label=${`${title}. Dùng phím mũi tên trái phải để đọc từng cột.`} onKeyDown=${onKey} onBlur=${() => setActive(null)} onPointerLeave=${() => setActive(null)}>
        ${ticks.map((t) => html`<span key=${t} aria-hidden="true" className=${cx('absolute inset-x-0 h-px', t === 0 ? 'bg-axis' : 'bg-grid')} style=${{ bottom: `${(t / top) * 100}%` }}></span>`)}
        <div className="absolute inset-0 flex items-end gap-[2px]">
          ${points.map((p, i) => {
            const h = (p.value / top) * 100;
            return html`<div key=${p.key} className="relative flex h-full min-w-0 flex-1 items-end justify-center" onPointerEnter=${() => setActive(i)}>
              <div className="w-full max-w-6 rounded-t-[4px] transition-opacity" style=${{ height: `${h}%`, minHeight: p.value > 0 ? 2 : 0, background: color, opacity: active == null || active === i ? 1 : 0.45 }}></div>
              ${labelled && labelled.has(p.key) && html`<span aria-hidden="true" className="absolute whitespace-nowrap text-[11px] font-semibold tabular-nums text-ink-2" style=${{ bottom: `calc(${h}% + 4px)` }}>${fmt(p.value)}</span>`}
            </div>`;
          })}
        </div>
        ${tip && html`<div className="pointer-events-none absolute z-10 whitespace-nowrap rounded-xl border border-line bg-surface px-3 py-2 shadow-pop" aria-live="polite"
          style=${{ left: `${leftPct}%`, bottom: `calc(${(tip.value / top) * 100}% + 10px)`, transform: `translateX(${shift})` }}>
          <p className="text-sm font-bold tabular-nums text-ink">${tip.tip.value}</p><p className="text-xs text-ink-3">${tip.tip.detail}</p>
        </div>`}
      </div>
      <span></span>
      <div className="mt-2 flex gap-[2px]" aria-hidden="true">
        ${points.map((p) => html`<span key=${p.key} className="relative h-4 min-w-0 flex-1"><span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] text-ink-3">${p.label}</span></span>`)}
      </div>
    </div>
    <${TableView} head=${tableHead || ['', title]} rows=${points.map((p) => [p.full || p.key, fmt(p.value)])} />`}
    ${footer}
  </figure>`;
}

function Heatmap({ grid, total }) {
  const [tip, setTip] = useState(null);
  const box = useRef(null);
  const max = Math.max(1, ...grid.flat());
  const level = (v) => (v === 0 ? 0 : Math.max(1, Math.ceil((v / max) * 7)));
  const show = (e, r, h, v) => {
    const a = box.current.getBoundingClientRect(), b = e.currentTarget.getBoundingClientRect();
    setTip({ x: b.left - a.left + b.width / 2, y: b.top - a.top, value: `${fmtInt(v)} lượt ghi`, detail: `${WEEKDAY_NAMES[r]} · ${hourRange(h)} · ${pct(v / (total || 1))}` });
  };
  return html`<div className="relative" ref=${box} onPointerLeave=${() => setTip(null)}>
    <div className="grid gap-[2px]" style=${{ gridTemplateColumns: '30px repeat(24, minmax(0, 1fr))' }} role="img" aria-label="Bản đồ nhiệt số lượt ghi theo thứ và giờ. Số liệu chi tiết nằm trong bảng bên dưới.">
      ${grid.map((row, r) => html`<${Fragment} key=${r}>
        <span className="self-center text-[11px] font-semibold text-ink-3">${WEEKDAY_ROWS[r]}</span>
        ${row.map((v, h) => html`<span key=${h} className="h-6 rounded-[3px] sm:h-7" style=${{ background: `var(--heat-${level(v)})` }} onPointerEnter=${(e) => show(e, r, h, v)}></span>`)}
      <//>`)}
      <span></span>
      ${Array.from({ length: 24 }, (_, h) => html`<span key=${'x' + h} className="pt-1 text-center text-[10px] tabular-nums text-ink-3">${h % 3 === 0 ? h : ''}</span>`)}
    </div>
    ${tip && html`<div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-xl border border-line bg-surface px-3 py-2 shadow-pop" style=${{ left: tip.x, top: tip.y - 8 }}>
      <p className="text-sm font-bold tabular-nums text-ink">${tip.value}</p><p className="text-xs text-ink-3">${tip.detail}</p></div>`}
    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-3" aria-hidden="true">
      <span>Ít</span>${[1, 2, 3, 4, 5, 6, 7].map((i) => html`<i key=${i} className="h-2.5 w-5 rounded-sm" style=${{ background: `var(--heat-${i})` }}></i>`)}<span>Nhiều</span>
      <span className="ml-auto">giờ trong ngày (0–23), giờ Việt Nam</span>
    </div>
    <${TableView} head=${['Giờ', ...WEEKDAY_ROWS]} rows=${Array.from({ length: 24 }, (_, h) => [hourRange(h), ...grid.map((row) => fmtInt(row[h]))])} />
  </div>`;
}

/* part-to-whole in one bar; 2px surface gaps between segments, legend rows carry labels and values */
function ShareBar({ parts, fmt }) {
  const total = parts.reduce((sum, p) => sum + p.value, 0) || 1;
  return html`<div>
    <div className="flex h-3 gap-[2px] overflow-hidden rounded-full" role="img" aria-label=${parts.map((p) => `${p.label} ${pct(p.value / total)}`).join(', ')}>
      ${parts.map((p) => html`<span key=${p.key} style=${{ flexGrow: p.value, background: p.color }}></span>`)}
    </div>
    <ul className="mt-4 space-y-2.5">${parts.map((p) => html`<li key=${p.key} className="flex items-center gap-2.5 text-[13px]">
      <i className="size-2.5 shrink-0 rounded-sm" style=${{ background: p.color }}></i><span className="min-w-0 flex-1 text-ink-2">${p.label}</span>
      <span className="w-12 text-right tabular-nums text-ink-3">${pct(p.value / total)}</span><span className="w-20 text-right font-semibold tabular-nums text-ink">${fmt(p.value)}</span></li>`)}</ul>
  </div>`;
}

/* 24 hourly counts as thin bars, for small "last 24 hours" panels */
function MiniBars({ values, color = 'var(--viz-2)', label }) {
  const max = Math.max(1, ...values);
  return html`<div className="flex h-10 items-end gap-[2px]" role="img" aria-label=${label}>
    ${values.map((v, i) => html`<span key=${i} className="min-w-0 flex-1 rounded-t-[2px]" style=${{ height: `${Math.max(v ? 8 : 4, (v / max) * 100)}%`, background: v ? color : 'var(--chart-grid)' }}></span>`)}
  </div>`;
}

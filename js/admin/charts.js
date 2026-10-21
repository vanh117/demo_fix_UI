/* Moderator formatting (vi-VN) and charts: weekday × hour heatmap, share bar, tick helper. */
'use strict';

const nfInt = new Intl.NumberFormat('vi-VN');
const fmtInt = (n) => nfInt.format(Math.round(n));
const usd = (n, digits = 2) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
const pct = (x, digits = 1) => new Intl.NumberFormat('vi-VN', { style: 'percent', maximumFractionDigits: digits }).format(Number.isFinite(x) ? x : 0);
const hourRange = (h, span = 1) => `${pad2(h % 24)}:00–${pad2((h + span) % 24)}:00`;

/* clean axis ticks: 0 and 3–5 round steps covering max */
function niceTicks(max, target = 4) {
  if (!(max > 0)) return { top: 1, ticks: [0, 1] };
  const raw = max / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((v) => v >= raw);
  const top = Math.ceil(max / step) * step;
  return { top, ticks: Array.from({ length: Math.round(top / step) + 1 }, (_, i) => +(i * step).toFixed(10)) };
}

/* label for a day on an x axis: weekday for a week, date every few days otherwise */
function dayAxisLabel(date, index, count) {
  if (count <= 7) return weekdayShort(date);
  const every = count <= 31 ? 5 : 15;
  return index % every === 0 || index === count - 1 ? fmtShortDate(date) : '';
}

function Heatmap({ grid, total }) {
  const tip = useTip();
  const max = Math.max(1, ...grid.flat());
  const level = (v) => (v === 0 ? 0 : Math.max(1, Math.ceil((v / max) * 7)));
  return html`<div className="heat" ref=${tip.ref}>
    <div className="heat__grid" role="img" aria-label="Bản đồ nhiệt số lượt ghi theo thứ và giờ. Số liệu chi tiết nằm trong bảng bên dưới.">
      ${grid.map((row, r) => html`<${Fragment} key=${r}>
        <span className="heat__row">${WEEKDAY_ROWS[r]}</span>
        ${row.map((v, h) => html`<span key=${h} className="heat__cell" style=${{ background: `var(--heat-${level(v)})` }}
          onPointerEnter=${(e) => tip.show(e, { value: `${fmtInt(v)} lượt ghi`, detail: `${WEEKDAY_NAMES[r]} · ${hourRange(h)} · ${pct(v / (total || 1))}` })}
          onPointerLeave=${tip.hide}></span>`)}
      <//>`)}
      <span></span>
      ${Array.from({ length: 24 }, (_, h) => html`<span key=${'x' + h} className="heat__x">${h % 3 === 0 ? h : ''}</span>`)}
    </div>
    <div className="heat__legend" aria-hidden="true"><span>Ít</span>${[1, 2, 3, 4, 5, 6, 7].map((i) => html`<i key=${i} style=${{ background: `var(--heat-${i})` }}></i>`)}<span>Nhiều</span><span className="heat__unit">giờ trong ngày (0–23)</span></div>
    ${tip.node}
  </div>`;
}

function HeatTable({ grid }) {
  return html`<details className="table-view">
    <summary><${Icon} name="table" />Xem dạng bảng</summary>
    <div className="table-scroll"><table>
      <thead><tr><th scope="col">Giờ</th>${WEEKDAY_ROWS.map((d) => html`<th key=${d} scope="col">${d}</th>`)}</tr></thead>
      <tbody>${Array.from({ length: 24 }, (_, h) => html`<tr key=${h}><th scope="row" className="num">${hourRange(h)}</th>
        ${grid.map((row, r) => html`<td key=${r} className="num">${fmtInt(row[h])}</td>`)}</tr>`)}</tbody>
    </table></div>
  </details>`;
}

/* part-to-whole in one bar; the legend rows carry the labels and values */
function ShareBar({ parts, fmt }) {
  const total = parts.reduce((sum, p) => sum + p.value, 0) || 1;
  return html`<div className="share">
    <div className="share__bar" role="img" aria-label=${parts.map((p) => `${p.label} ${pct(p.value / total)}`).join(', ')}>
      ${parts.map((p) => html`<span key=${p.key} style=${{ flexGrow: p.value, background: p.color }}></span>`)}
    </div>
    <ul className="share__legend">${parts.map((p) => html`<li key=${p.key}>
      <i style=${{ background: p.color }}></i><span className="share__label">${p.label}</span>
      <span className="share__pct num">${pct(p.value / total)}</span><span className="share__val num">${fmt(p.value)}</span></li>`)}</ul>
  </div>`;
}

function Meter({ value }) {
  return html`<span className="meter" aria-hidden="true"><i style=${{ width: `${clamp(value, 0, 1) * 100}%` }}></i></span>`;
}

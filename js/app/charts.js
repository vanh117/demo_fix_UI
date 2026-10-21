/* Today-page charts: mood rhythm, table view, sleep/meltdown series. */
'use strict';

/* moods sit in the two bands EchoKid's risk check uses (moodBand in recommendation.service.ts) */
function MoodRhythm({ observations, range }) {
  const tip = useTip();
  const narrow = useNarrow();
  const pts = observations.slice(narrow ? -8 : -12);
  const n = pts.length;
  const xs = pts.map((_, i) => (n === 1 ? 50 : 6 + (i * 88) / (n - 1)));
  const ys = pts.map((p) => (POSITIVE.has(p.mood) ? 25 : 75));
  const labels = pts.map((p, i) => {
    if (range === 'day') return i % Math.ceil(n / 6) === 0 || i === n - 1 ? p.time : '';
    return i === 0 || p.date !== pts[i - 1].date ? fmtShortDate(p.date) : '';
  });
  /* keep labels at least 16% of the plot apart so they never collide on a phone */
  let lastX = -99;
  const spaced = labels.map((l, i) => { if (!l || xs[i] - lastX < 16) return ''; lastX = xs[i]; return l; });
  return html`<figure className="chart card chart--wide">
    <figcaption className="chart__head"><span className="chart__title">Nhịp cảm xúc</span><span className="chart__sub">${n ? `${n} lần ghi gần nhất` : ''}</span></figcaption>
    <div className="legend" aria-hidden="true">${MOODS.map((m) => html`<span key=${m.value}><img src=${IMG[m.value]} alt="" width="18" height="18" />${m.label}</span>`)}</div>
    ${n < 2 ? html`<p className="chart__empty">Cần ít nhất hai lần ghi nhận để thấy nhịp cảm xúc của con.</p>` : html`
    <div className="rhythm" ref=${tip.ref}>
      <div className="rhythm__bands" aria-hidden="true"><span>Tích cực</span><span>Cần hỗ trợ</span></div>
      <div className="rhythm__plot">
        <svg className="rhythm__line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polyline points=${xs.map((x, i) => `${x},${ys[i]}`).join(' ')} vectorEffect="non-scaling-stroke" />
        </svg>
        ${pts.map((p, i) => {
          const tipContent = { value: MOOD_LABEL[p.mood], detail: `${fmtShortDate(p.date)} · ${p.time} · ngủ ${fmt1(p.sleepHours)} giờ${p.meltdownCount ? ` · ${p.meltdownCount} meltdown` : ''}` };
          return html`<button type="button" key=${p.id} className=${cx('rhythm__pt', i === n - 1 && 'rhythm__pt--last')}
            style=${{ left: xs[i] + '%', top: ys[i] + '%' }} aria-label=${`${tipContent.value}, ${tipContent.detail}`}
            onPointerEnter=${(e) => tip.show(e, tipContent)} onPointerLeave=${tip.hide} onFocus=${(e) => tip.show(e, tipContent)} onBlur=${tip.hide}>
            <img src=${IMG[p.mood]} alt="" width="30" height="30" /></button>`;
        })}
      </div>
      <div className="rhythm__x" aria-hidden="true">${pts.map((p, i) => (spaced[i] ? html`<span key=${p.id} style=${{ left: xs[i] + '%' }}>${spaced[i]}</span>` : null))}</div>
      ${tip.node}
    </div>`}
  </figure>`;
}

function DataTable({ observations }) {
  if (!observations.length) return null;
  return html`<details className="table-view">
    <summary><${Icon} name="table" />Xem dữ liệu dạng bảng (${observations.length} lần ghi)</summary>
    <div className="table-scroll"><table>
      <thead><tr><th scope="col">Ngày</th><th scope="col">Giờ</th><th scope="col">Cảm xúc</th><th scope="col">Ngủ</th><th scope="col">Meltdown</th><th scope="col">Ghi chú</th></tr></thead>
      <tbody>${observations.slice().reverse().map((o) => html`<tr key=${o.id}>
        <td className="num">${fmtShortDate(o.date)}</td><td className="num">${o.time}</td><td>${MOOD_LABEL[o.mood]}</td>
        <td className="num">${fmt1(o.sleepHours)} giờ</td><td className="num">${o.meltdownCount}</td><td>${o.note || '—'}</td></tr>`)}</tbody>
    </table></div>
  </details>`;
}

/* build sleep & meltdown series from /api/dashboard/progress */
function buildSeries(progress, range) {
  const today = localISODate();
  let slots;
  if (range === 'day') {
    slots = progress.observations.map((o) => ({ key: o.id, label: o.time, full: `${o.time} hôm nay`, sleep: o.sleepHours, melt: o.meltdownCount }));
  } else {
    const days = range === 'month' ? 30 : 7;
    const byDate = new Map(progress.dailyBreakdown.map((d) => [d.date, d]));
    slots = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = addDaysISO(today, -i);
      const d = byDate.get(date);
      const idx = days - 1 - i;
      const label = range === 'week' ? weekdayShort(date) : (idx % 6 === 0 || i === 0 ? fmtShortDate(date) : '');
      slots.push({ key: date, label, full: relDay(date), sleep: d ? d.sleepHours : null, melt: d ? d.meltdownCount : null });
    }
  }
  const sleepVals = slots.filter((s) => s.sleep != null);
  const sleepLabels = new Set();
  if (sleepVals.length) {
    sleepLabels.add(sleepVals[sleepVals.length - 1].key);
    const min = sleepVals.reduce((a, b) => (b.sleep < a.sleep ? b : a));
    sleepLabels.add(min.key);
  }
  const meltVals = slots.filter((s) => s.melt);
  const meltLabels = new Set();
  if (meltVals.length) {
    meltLabels.add(meltVals.reduce((a, b) => (b.melt > a.melt ? b : a)).key);
    if (slots[slots.length - 1].melt) meltLabels.add(slots[slots.length - 1].key);
  }
  const meltMax = Math.max(2, ...slots.map((s) => s.melt || 0));
  const meltStep = meltMax <= 4 ? 1 : 2;
  const meltTop = Math.ceil(meltMax / meltStep) * meltStep;
  const none = 'Chưa ghi nhận';
  return {
    sleep: {
      points: slots.map((s) => ({ key: s.key, label: s.label, value: s.sleep,
        aria: `${s.full}: ${s.sleep == null ? none : fmt1(s.sleep) + ' giờ ngủ'}`,
        tip: { value: s.sleep == null ? none : `${fmt1(s.sleep)} giờ`, detail: s.full } })),
      labelled: sleepLabels, max: 12, ticks: [0, 4, 8, 12],
    },
    melt: {
      points: slots.map((s) => ({ key: s.key, label: s.label, value: s.melt,
        aria: `${s.full}: ${s.melt == null ? none : s.melt + ' cơn meltdown'}`,
        tip: { value: s.melt == null ? none : `${s.melt} cơn`, detail: s.full } })),
      labelled: meltLabels, max: meltTop,
      ticks: Array.from({ length: meltTop / meltStep + 1 }, (_, i) => i * meltStep),
    },
  };
}

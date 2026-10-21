/* Moderator sections: overview KPIs and when families use EchoKid. */
'use strict';

const dayDate = (m, day) => addDaysISO(m.today, day - (USAGE_DAYS - 1));
/* today's bar is still filling up, so say so instead of letting it read as a drop */
const dayTip = (m, date) => (date === m.today ? 'Hôm nay, tính đến giờ này' : relDay(date));
/* direct-label only the highest bar; the axis and tooltips carry the rest */
const busiest = (pts) => pts.reduce((a, b) => (b.value > a.value ? b : a)).key;
const whenText = (w) => `${relDay(w.date)}, ${pad2(w.hour)}:${pad2(w.minute || 0)}`;

function SectionHead({ id, title, sub }) {
  return html`<div className="section-head"><div><h2 id=${id}>${title}</h2>${sub && html`<p>${sub}</p>`}</div></div>`;
}

/* change vs the previous period; colour only when the direction has a clear good/bad meaning */
function Delta({ cur, prev, goodWhenUp, neutral }) {
  if (!prev) return html`<span className="delta delta--flat">Chưa có kỳ trước</span>`;
  const d = (cur - prev) / prev;
  if (Math.abs(d) < 0.005) return html`<span className="delta delta--flat"><${Icon} name="trendFlat" />Như kỳ trước</span>`;
  const up = d > 0;
  const tone = neutral ? 'flat' : up === !!goodWhenUp ? 'good' : 'crit';
  return html`<span className=${'delta delta--' + tone}><${Icon} name=${up ? 'trendUp' : 'trendDown'} />${up ? '+' : '−'}${pct(Math.abs(d), 0)} so với kỳ trước</span>`;
}

function Stat({ label, value, sub, delta, tone, icon }) {
  return html`<div className="card kpi">
    <span className="kpi__label">${icon && html`<${Icon} name=${icon} />`}${label}</span>
    <span className=${cx('kpi__value', tone && 'kpi__value--' + tone)}>${value}</span>
    ${sub && html`<span className="kpi__sub">${sub}</span>`}${delta}
  </div>`;
}

function OverviewSection({ m, d }) {
  const c = m.current, p = m.previous;
  const fails = (x) => x.failures.API_ERROR + x.failures.AI_INVALID_RESPONSE;
  const pts = c.daily.map((x, i) => {
    const date = dayDate(m, x.day);
    return { key: date, label: dayAxisLabel(date, i, c.daily.length), value: x.entries,
      aria: `${fmtShortDate(date)}: ${x.entries} lượt ghi`, tip: { value: `${fmtInt(x.entries)} lượt ghi`, detail: dayTip(m, date) } };
  });
  const { top, ticks } = niceTicks(Math.max(...pts.map((x) => x.value)));
  const labelled = new Set([busiest(pts)]);
  return html`<section className="section admin-section" aria-labelledby="overview">
    <${SectionHead} id="overview" title="Tổng quan" sub=${`${m.range} ngày gần nhất, so với ${m.range} ngày trước đó.`} />
    <div className="kpis kpis--6">
      <${Stat} label="Gia đình hoạt động" value=${fmtInt(c.families)} sub=${`trên ${fmtInt(m.registeredFamilies)} gia đình đã đăng ký`}
        delta=${html`<${Delta} cur=${c.families} prev=${p.families} goodWhenUp />`} />
      <${Stat} label="Lượt ghi nhật ký" value=${fmtInt(c.entries)} sub=${`${fmt1(c.entries / Math.max(1, c.families) / c.days)} lượt mỗi gia đình mỗi ngày`}
        delta=${html`<${Delta} cur=${c.entries} prev=${p.entries} goodWhenUp />`} />
      <${Stat} label="Chi phí Gemini" value=${usd(d.gemini.total)} sub=${`≈ ${usd(d.gemini30)} mỗi 30 ngày`}
        delta=${html`<${Delta} cur=${d.gemini.total} prev=${d.geminiPrev.total} neutral />`} />
      <${Stat} label="Chi phí mỗi gia đình" value=${usd(d.perFamily)} sub="mỗi tháng, gồm Gemini và Firestore"
        delta=${html`<${Delta} cur=${d.perFamily} prev=${d.perFamilyPrev} />`} />
      <${Stat} label="Cảnh báo cần chú ý" value=${fmtInt(c.high)} sub=${`${fmtInt(c.highFamilies)} gia đình · ${pct(c.high / Math.max(1, c.entries))} lượt ghi`}
        delta=${html`<${Delta} cur=${c.high} prev=${p.high} neutral />`} />
      <${Stat} label="Lượt gọi AI bị lỗi" value=${pct(fails(c) / Math.max(1, c.calls))} sub=${`${fmtInt(fails(c))} trên ${fmtInt(c.calls)} lượt gọi`}
        delta=${html`<${Delta} cur=${fails(c) / Math.max(1, c.calls)} prev=${fails(p) / Math.max(1, p.calls)} />`} />
    </div>
    <${ColumnChart} title="Lượt ghi mỗi ngày" sub=${`${m.range} ngày gần nhất`} color="var(--viz-1)" points=${pts} max=${top} ticks=${ticks}
      fmt=${fmtInt} labelled=${labelled} yWidth="36px" emptyText="Chưa có lượt ghi." />
  </section>`;
}

function HoursSection({ m, rpmLimit, setRpmLimit }) {
  const c = m.current;
  const hourly = Array.from({ length: 24 }, (_, h) => c.heat.reduce((sum, row) => sum + row[h], 0));
  const total = hourly.reduce((a, b) => a + b, 0) || 1;
  const share = (arr, start, span) => { let s = 0; for (let i = 0; i < span; i++) s += arr[(start + i) % 24]; return s; };
  const best = (arr, from, to, span, pickMin) => {
    let bestH = from, bestV = pickMin ? Infinity : -1;
    for (let h = from; h <= to; h++) { const v = share(arr, h, span); if (pickMin ? v < bestV : v > bestV) { bestV = v; bestH = h; } }
    return { h: bestH, v: bestV };
  };
  const evening = best(hourly, 17, 22, 2), morning = best(hourly, 5, 10, 2), quiet = best(hourly, 0, 23, 3, true);
  const alertTotal = c.highByHour.reduce((a, b) => a + b, 0) || 1;
  const onCall = best(c.highByHour, 0, 23, 3);
  const morningPeak = (rows) => best(hourly.map((_, h) => rows.reduce((s, r) => s + c.heat[r][h], 0)), 5, 11, 1).h;
  const shift = morningPeak([5, 6]) - morningPeak([0, 1, 2, 3, 4]);
  const limit = Number(rpmLimit);
  const used = limit > 0 ? c.peakMinute.count / limit : null;
  const usedTone = used == null ? '' : used >= 0.8 ? 'crit' : used >= 0.5 ? 'warn' : 'good';
  return html`<section className="section admin-section" aria-labelledby="hours">
    <${SectionHead} id="hours" title="Khung giờ sử dụng"
      sub="Ba mẹ ghi nhật ký vào giờ nào, theo giờ Việt Nam (UTC+7). Dùng để xếp lịch trực cảnh báo, bảo trì và kiểm tra giới hạn Gemini." />
    <div className="hours-layout">
      <figure className="card chart">
        <figcaption className="chart__head"><span className="chart__title">Lượt ghi theo thứ và giờ</span><span className="chart__sub">${fmtInt(c.entries)} lượt ghi · ${m.range} ngày</span></figcaption>
        <${Heatmap} grid=${c.heat} total=${c.entries} />
        <${HeatTable} grid=${c.heat} />
      </figure>
      <div className="callouts">
        <div className="card callout"><span className="callout__icon"><${Icon} name="moon" /></span><div>
          <p className="callout__label">Cao điểm buổi tối</p><p className="callout__value num">${hourRange(evening.h, 2)}</p>
          <p className="callout__text">${pct(evening.v / total, 0)} lượt ghi. Ba mẹ thường ghi sau khi con đã ngủ.</p></div></div>
        <div className="card callout"><span className="callout__icon"><${Icon} name="sun" /></span><div>
          <p className="callout__label">Buổi sáng</p><p className="callout__value num">${hourRange(morning.h, 2)}</p>
          <p className="callout__text">${pct(morning.v / total, 0)} lượt ghi, trước giờ đưa con đi học.${shift > 0 ? ` Cuối tuần muộn hơn khoảng ${shift} giờ.` : ''}</p></div></div>
        <div className="card callout"><span className="callout__icon"><${Icon} name="server" /></span><div>
          <p className="callout__label">Vắng nhất</p><p className="callout__value num">${hourRange(quiet.h, 3)}</p>
          <p className="callout__text">Chỉ ${pct(quiet.v / total)} lượt ghi. Nên bảo trì hoặc triển khai bản mới trong khung này.</p></div></div>
        <div className="card callout"><span className="callout__icon callout__icon--crit"><${Icon} name="alert" /></span><div>
          <p className="callout__label">Giờ nên trực cảnh báo</p><p className="callout__value num">${hourRange(onCall.h, 3)}</p>
          <p className="callout__text">${pct(onCall.v / alertTotal, 0)} cảnh báo "Cần chú ý" rơi vào khung này.</p></div></div>
      </div>
    </div>
    <div className="card load">
      <div className="load__main">
        <p className="kicker"><${Icon} name="gauge" />Tải cao nhất lên Gemini</p>
        <p className="load__value"><span>${fmtInt(c.peakMinute.count)}</span> yêu cầu trong 1 phút</p>
        <p className="muted">Lúc ${whenText(c.peakMinute)}. Giờ bận nhất: ${fmtInt(c.peakHour.count)} yêu cầu (${whenText(c.peakHour)}).</p>
      </div>
      <div className="field load__limit">
        <label className="field__label" htmlFor="rpm-limit">Giới hạn yêu cầu/phút (RPM) của dự án</label>
        <input id="rpm-limit" className="input" type="number" min="1" inputMode="numeric" placeholder="Xem trong Google AI Studio" value=${rpmLimit} onChange=${(e) => setRpmLimit(e.target.value)} />
        ${used == null
          ? html`<p className="field__hint">Google không công bố giới hạn cố định; mỗi dự án xem giới hạn của mình tại <a href=${PRICE_SOURCES.rateLimits} target="_blank" rel="noopener">AI Studio</a>.</p>`
          : html`<p className=${'status status--' + usedTone}><${Icon} name=${usedTone === 'good' ? 'checkCircle' : 'alert'} /><span>Lúc cao điểm dùng ${pct(used, 0)} giới hạn.</span></p>`}
      </div>
    </div>
  </section>`;
}

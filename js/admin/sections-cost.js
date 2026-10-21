/* Moderator sections: Gemini API cost (measured) and the monthly cost forecast (what-if). */
'use strict';

function PricePanel({ pricing }) {
  const model = modelById(pricing.modelId);
  const setField = (k) => (e) => {
    const v = Math.max(0, Number(e.target.value));
    if (Number.isFinite(v)) pricing.setCustom({ ...pricing.price, [k]: v });
  };
  return html`<div className="card price-panel">
    <div className="price-panel__grid">
      <div className="field">
        <label className="field__label" htmlFor="pp-model">Mô hình Gemini</label>
        <select id="pp-model" className="select" value=${pricing.modelId} onChange=${(e) => pricing.setModelId(e.target.value)}>
          ${GEMINI_MODELS.map((mm) => html`<option key=${mm.id} value=${mm.id}>${mm.label}${mm.id === CURRENT_MODEL ? ' (đang dùng)' : ''}</option>`)}
        </select>
        <p className="field__hint">${model.note}</p>
      </div>
      ${model.prices.from2027 && html`<fieldset className="field">
        <legend className="field__label">Bảng giá áp dụng</legend>
        <${Seg} name="pp-period" label="Bảng giá áp dụng" cols=${2} value=${pricing.period} onChange=${pricing.setPeriod}
          options=${[{ value: 'now', label: 'Đến 31/12/2026' }, { value: 'from2027', label: 'Từ 01/01/2027' }]} />
      </fieldset>`}
      <div className="field">
        <label className="field__label" htmlFor="pp-in">Giá đầu vào (US$ / 1 triệu token)</label>
        <input id="pp-in" className="input" type="number" min="0" step="0.01" value=${pricing.price.input} onChange=${setField('input')} />
      </div>
      <div className="field">
        <label className="field__label" htmlFor="pp-out">Giá đầu ra, gồm suy luận (US$ / 1 triệu token)</label>
        <input id="pp-out" className="input" type="number" min="0" step="0.01" value=${pricing.price.output} onChange=${setField('output')} />
      </div>
    </div>
    <p className="price-panel__source">
      ${pricing.custom ? 'Đang dùng giá bạn nhập.' : `Giá niêm yết, gói trả phí, kiểm tra ngày ${PRICE_CHECKED}.`}
      <a href=${PRICE_SOURCES.gemini} target="_blank" rel="noopener">Bảng giá Gemini API<${Icon} name="external" /></a>
      ${pricing.custom && html`<button type="button" className="link-btn" onClick=${pricing.reset}>Dùng lại giá niêm yết</button>`}
    </p>
  </div>`;
}

function AiCostSection({ m, d, pricing }) {
  const c = m.current;
  const model = modelById(pricing.modelId);
  const n = Math.max(1, c.billedCalls);
  const avg = (k) => c.tokens[k] / n;
  const per30 = (x) => (x / c.days) * 30;
  const calls30 = per30(c.billedCalls);
  const saveThinking = (calls30 * Math.max(0, avg('thinking') - 200) * pricing.price.output) / 1e6;
  const saveHistory = (per30(c.histOver10) * TOKEN_MODEL.perHistoryEntry * pricing.price.input) / 1e6;
  const saveLite = Math.max(0, d.gemini30 - per30(tokenCost(c.tokens, listedPrice('gemini-3.1-flash-lite', 'now')).total));
  const future = model.prices.from2027 && pricing.period === 'now' && !pricing.custom ? per30(tokenCost(c.tokens, model.prices.from2027).total) : null;
  const pts = c.daily.map((x, i) => {
    const date = dayDate(m, x.day);
    const cost = tokenCost(x, pricing.price).total;
    return { key: date, label: dayAxisLabel(date, i, c.daily.length), value: cost,
      aria: `${fmtShortDate(date)}: ${usd(cost)}`, tip: { value: usd(cost), detail: `${dayTip(m, date)} · ${fmtInt(x.entries)} lượt ghi` } };
  });
  const { top, ticks } = niceTicks(Math.max(...pts.map((x) => x.value)));
  const labelled = new Set([busiest(pts)]);
  const savings = [
    { title: 'Hạ mức suy luận (thinking)', text: `Đặt thinkingConfig ở mức thấp để mỗi lượt suy luận khoảng 200 token, thay vì trung bình ${fmtInt(avg('thinking'))} như hiện nay.`, value: saveThinking, check: true },
    { title: 'Gửi 10 lần ghi cũ thay vì 20', text: 'Lời nhắc hiện kèm tối đa 20 lần ghi gần nhất. Giảm còn 10 vẫn đủ để so sánh xu hướng trong tuần.', value: saveHistory, check: true },
    { title: 'Chuyển sang Gemini 3.1 Flash-Lite', text: 'Giá đầu vào 0,25 và đầu ra 1,50 US$ cho mỗi triệu token.', value: saveLite, check: true },
  ];
  return html`<section className="section admin-section" aria-labelledby="ai">
    <${SectionHead} id="ai" title="Chi phí Gemini API"
      sub="Mỗi lượt ghi nhật ký gọi Gemini một lần. Chi phí = token của từng lượt gọi × bảng giá; token suy luận tính theo giá đầu ra." />
    <${PricePanel} pricing=${pricing} />
    <div className="kpis">
      <${Stat} label="Chi phí mỗi lượt gọi" value=${usd(d.gemini.total / n, 4)} sub=${`${fmtInt(c.billedCalls)} lượt gọi có tính phí`} />
      <${Stat} label="Token mỗi lượt" value=${fmtInt(avg('input') + avg('output') + avg('thinking'))}
        sub=${`${fmtInt(avg('input'))} vào · ${fmtInt(avg('output'))} trả lời · ${fmtInt(avg('thinking'))} suy luận`} />
      <${Stat} label="Thời gian chờ" value=${`${fmt1(c.latency.p50 / 1000)} giây`} sub=${`95% lượt gọi dưới ${fmt1(c.latency.p95 / 1000)} giây; ba mẹ chờ trong lúc này`} />
      <${Stat} label="Ước tính mỗi 30 ngày" value=${usd(d.gemini30)} sub=${future ? `Từ 01/01/2027: ${usd(future)}` : `theo lượng dùng ${m.range} ngày qua`}
        tone=${future ? 'warn' : ''} />
    </div>
    <div className="charts">
      <figure className="card chart">
        <figcaption className="chart__head"><span className="chart__title">Tiền Gemini đi đâu</span><span className="chart__sub">${usd(d.gemini.total)} trong ${m.range} ngày</span></figcaption>
        <${ShareBar} fmt=${(v) => usd(v)} parts=${[
          { key: 'input', label: 'Đầu vào: lời nhắc và nhật ký cũ', value: d.gemini.input, color: 'var(--viz-1)' },
          { key: 'output', label: 'Câu trả lời JSON', value: d.gemini.output, color: 'var(--viz-2)' },
          { key: 'thinking', label: 'Suy luận (thinking)', value: d.gemini.thinking, color: 'var(--viz-3)' },
        ]} />
      </figure>
      <${ColumnChart} title="Chi phí Gemini mỗi ngày" sub=${`US$, ${m.range} ngày`} color="var(--viz-1)" points=${pts} max=${top} ticks=${ticks}
        fmt=${(v) => usd(v)} labelled=${labelled} yWidth="64px" emptyText="Chưa có lượt gọi." />
    </div>
    <div className="cost-notes">
      <section className="card" aria-labelledby="save-title">
        <h3 className="card-title" id="save-title"><${Icon} name="coin" />Cách giảm chi phí</h3>
        <ul className="savings">${savings.map((s) => html`<li key=${s.title}>
          <div><strong>${s.title}</strong><p>${s.text}</p>${s.check && html`<span className="pill pill--warn">Cần thử lại chất lượng gợi ý</span>`}</div>
          <span className="savings__value num">−${usd(s.value)}<small>mỗi 30 ngày</small></span></li>`)}</ul>
      </section>
      <section className="card" aria-labelledby="risk-title">
        <h3 className="card-title" id="risk-title"><${Icon} name="alert" />Rủi ro chi phí và dữ liệu</h3>
        <ul className="risks">
          <li className="status status--crit"><${Icon} name="alert" /><div><strong>/api/test gọi Gemini mà không cần đăng nhập</strong>
            <span>Ai biết đường dẫn cũng gọi được liên tục và tiêu tiền của dự án. Xóa route này hoặc yêu cầu đăng nhập.</span></div></li>
          <li className="status status--warn"><${Icon} name="lock" /><div><strong>Gói miễn phí dùng nội dung để cải thiện sản phẩm</strong>
            <span>Nhật ký của trẻ là dữ liệu nhạy cảm. Bật thanh toán (gói trả phí) trước khi có gia đình thật; ở gói trả phí Google không dùng nội dung này.</span></div></li>
          ${future && html`<li className="status status--warn"><${Icon} name="calendar" /><div><strong>Giá Gemini 3.6 Flash tăng gấp đôi từ 01/01/2027</strong>
            <span>Với lượng dùng hiện tại, chi phí mỗi 30 ngày sẽ từ ${usd(d.gemini30)} lên ${usd(future)}.</span></div></li>`}
        </ul>
      </section>
    </div>
  </section>`;
}

/* 50 → 10.000 families on a log slider */
const FAM_MIN = 50, FAM_MAX = 10000;
const famFromSlider = (s) => { const raw = FAM_MIN * (FAM_MAX / FAM_MIN) ** (s / 1000); const mag = 10 ** Math.floor(Math.log10(raw)); return Math.round(raw / (mag / 2)) * (mag / 2); };
const sliderFromFam = (f) => Math.round((Math.log(clamp(f, FAM_MIN, FAM_MAX) / FAM_MIN) / Math.log(FAM_MAX / FAM_MIN)) * 1000);

function RangeField({ id, label, value, min, max, step, onChange, format, hint }) {
  return html`<div className="field">
    <div className="range-field__top"><label className="field__label" htmlFor=${id}>${label}</label><output htmlFor=${id} className="range-field__out num">${format(value)}</output></div>
    <input id=${id} className="range" type="range" min=${min} max=${max} step=${step} value=${value} onChange=${(e) => onChange(Number(e.target.value))} />
    ${hint && html`<p className="field__hint">${hint}</p>`}
  </div>`;
}

function ForecastSection({ m, pricing }) {
  const c = m.current;
  const [families, setFamilies] = useState(() => Math.max(FAM_MIN, c.families));
  const [entriesPerDay, setEntries] = useState(() => Math.round((c.entries / Math.max(1, c.families) / c.days) * 10) / 10);
  const [historySent, setHistory] = useState(20);
  const [thinking, setThinking] = useState(() => Math.round(c.tokens.thinking / Math.max(1, c.billedCalls) / 50) * 50);
  const [monthsActive, setMonths] = useState(6);
  const [queryFixed, setQueryFixed] = useState(false);
  const [hosting, setHosting] = useState(0);
  const base = { entriesPerDay, historySent, thinking, monthsActive, queryFixed, hosting, price: pricing.price };
  const r = projectMonthly({ ...base, families });
  const rows = [
    ['Gemini · đầu vào', r.gemini.input], ['Gemini · câu trả lời', r.gemini.output], ['Gemini · suy luận', r.gemini.thinking],
    ['Firestore · lượt đọc', r.firestore.reads], ['Firestore · lượt ghi', r.firestore.writes], ['Firestore · lưu trữ', r.firestore.storage],
    ['Hosting và dịch vụ khác', r.hosting],
  ];
  const scales = [100, 500, 1000, 2500, 5000, 10000];
  const nearest = scales.reduce((a, b) => (Math.abs(b - families) < Math.abs(a - families) ? b : a));
  const pts = scales.map((f) => {
    const t = projectMonthly({ ...base, families: f }).total;
    return { key: String(f), label: fmtInt(f), value: t, aria: `${fmtInt(f)} gia đình: ${usd(t)} mỗi tháng`, tip: { value: `${usd(t)} / tháng`, detail: `${fmtInt(f)} gia đình · ${usd(t / f)} mỗi gia đình` } };
  });
  const { top, ticks } = niceTicks(Math.max(...pts.map((x) => x.value)));
  return html`<section className="section admin-section" aria-labelledby="forecast">
    <${SectionHead} id="forecast" title="Dự báo chi phí"
      sub="Kéo các giả định để xem chi phí mỗi tháng khi EchoKid có thêm gia đình. Dùng bảng giá Gemini ở mục trên; mặc định lấy từ số liệu thật của kỳ đang xem." />
    <div className="forecast">
      <div className="card forecast__inputs">
        <div className="field">
          <div className="range-field__top"><label className="field__label" htmlFor="fc-fam">Số gia đình hoạt động</label>
            <input className="input fc-num" type="number" min=${FAM_MIN} max=${FAM_MAX} value=${families} aria-label="Nhập số gia đình"
              onChange=${(e) => setFamilies(clamp(Math.round(Number(e.target.value) || FAM_MIN), 1, 100000))} /></div>
          <input id="fc-fam" className="range" type="range" min="0" max="1000" step="1" value=${sliderFromFam(families)} onChange=${(e) => setFamilies(famFromSlider(Number(e.target.value)))} />
        </div>
        <${RangeField} id="fc-entries" label="Lượt ghi mỗi gia đình mỗi ngày" value=${entriesPerDay} min=${0.2} max=${5} step=${0.1} onChange=${setEntries} format=${fmt1} />
        <${RangeField} id="fc-hist" label="Số lần ghi cũ gửi kèm cho AI" value=${historySent} min=${0} max=${20} step=${1} onChange=${setHistory} format=${(v) => String(v)} hint="Code hiện gửi tối đa 20." />
        <${RangeField} id="fc-think" label="Token suy luận mỗi lượt" value=${thinking} min=${0} max=${3000} step=${50} onChange=${setThinking} format=${fmtInt} />
        <${RangeField} id="fc-months" label="Số tháng gia đình đã dùng (trung bình)" value=${monthsActive} min=${1} max=${24} step=${1} onChange=${setMonths} format=${(v) => `${v} tháng`}
          hint="Nhật ký càng dài, Firestore càng tốn lượt đọc nếu chưa sửa truy vấn." />
        <label className="check-row"><input type="checkbox" checked=${queryFixed} onChange=${(e) => setQueryFixed(e.target.checked)} />Đã sửa truy vấn Firestore (chỉ đọc 30 ngày gần nhất)</label>
        <div className="field">
          <label className="field__label" htmlFor="fc-host">Hosting và dịch vụ khác · US$ mỗi tháng</label>
          <input id="fc-host" className="input" type="number" min="0" step="1" value=${hosting} onChange=${(e) => setHosting(Math.max(0, Number(e.target.value) || 0))} />
        </div>
      </div>
      <div className="forecast__results">
        <div className="card forecast__total">
          <p className="kicker"><${Icon} name="coin" />Tổng chi phí mỗi tháng</p>
          <p className="hero-figure">${usd(r.total)}</p>
          <p className="muted">≈ ${usd(r.perFamily, 3)} mỗi gia đình · ${fmtInt(r.callsPerMonth)} lượt gọi Gemini · ${fmtInt(r.readsPerDay)} lượt đọc Firestore mỗi ngày (miễn phí ${fmtInt(FIRESTORE.free.readsPerDay)})</p>
          <div className="table-scroll"><table className="cost-table">
            <tbody>${rows.map(([label, v]) => html`<tr key=${label}><th scope="row">${label}</th><td className="num">${usd(v)}</td><td className="num muted">${pct(v / (r.total || 1), 0)}</td></tr>`)}</tbody>
            <tfoot><tr><th scope="row">Tổng</th><td className="num">${usd(r.total)}</td><td></td></tr></tfoot>
          </table></div>
        </div>
        <${ColumnChart} title="Chi phí mỗi tháng theo quy mô" sub=${`với các giả định bên trái · gần nhất: ${fmtInt(nearest)} gia đình`} color="var(--viz-1)" points=${pts}
          max=${top} ticks=${ticks} fmt=${(v) => usd(v, 0)} labelled=${new Set([String(nearest), '10000'])} yWidth="64px" emptyText="" />
      </div>
    </div>
  </section>`;
}

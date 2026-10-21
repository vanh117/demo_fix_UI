/* Monitoring pages: overview (what needs attention + headline numbers), usage hours, Gemini cost and the cost forecast. */
'use strict';

const RANGE_OPTIONS = [{ value: 7, label: '7 ngày' }, { value: 30, label: '30 ngày' }, { value: 90, label: '90 ngày' }];
const dayDate = (m, day) => addDaysISO(m.today, day - (USAGE_DAYS - 1));
/* today's bar is still filling up, so say so instead of letting it read as a drop */
const dayTip = (m, date) => (date === m.today ? 'Hôm nay, tính đến giờ này' : relDay(date));
const whenText = (w) => `${relDay(w.date)}, ${pad2(w.hour)}:${pad2(w.minute || 0)}`;
const busiest = (pts) => pts.reduce((a, b) => (b.value > a.value ? b : a)).key;

/* cost figures for the chosen period at the given prices */
function deriveCosts(m, price) {
  const c = m.current, p = m.previous;
  const storedGiB = (m.totalEntries * BYTES_PER_ENTRY) / 2 ** 30;
  const fsMonthly = (x) => firestoreMonthly(x.reads / x.days, x.writes / x.days, storedGiB);
  const gemini = tokenCost(c.tokens, price), geminiPrev = tokenCost(p.tokens, price);
  const fs = fsMonthly(c), fsPrev = fsMonthly(p);
  const month = (x, days) => (x / days) * 30;
  const gemini30 = month(gemini.total, c.days);
  return {
    gemini, geminiPrev, gemini30,
    firestorePeriod: (fs.total * c.days) / 30,
    perFamily: c.families ? (gemini30 + fs.total) / c.families : 0,
    perFamilyPrev: p.families ? (month(geminiPrev.total, p.days) + fsPrev.total) / p.families : 0,
  };
}
/* the busiest (or quietest) window of `span` hours between two start hours */
function bestWindow(arr, from, to, span, pickMin) {
  const sum = (start) => { let s = 0; for (let i = 0; i < span; i++) s += arr[(start + i) % 24]; return s; };
  let best = { h: from, v: pickMin ? Infinity : -1 };
  for (let h = from; h <= to; h++) { const v = sum(h); if (pickMin ? v < best.v : v > best.v) best = { h, v }; }
  return best;
}
const hourlyTotals = (heat) => Array.from({ length: 24 }, (_, h) => heat.reduce((s, row) => s + row[h], 0));

function RangeFilter({ range, setRange }) {
  return html`<${Segmented} label="Khoảng thời gian" value=${range} onChange=${(v) => setRange(Number(v))} options=${RANGE_OPTIONS} />`;
}
function KpiSkeleton({ n = 6 }) {
  return html`<div className="space-y-5"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">${Array.from({ length: n }, (_, i) => html`<${Skel} key=${i} h=${122} />`)}</div><${Skel} h=${330} /></div>`;
}

/* ---------- overview ---------- */
function AttentionCard({ tone, icon, href, value, label, sub, meter }) {
  const strong = tone === 'crit';
  return html`<a href=${href} className=${cx('group flex flex-col rounded-2xl border p-4 shadow-card transition-colors', strong ? 'border-crit-line bg-crit-tint hover:border-crit' : 'border-line bg-surface hover:border-line-strong')}>
    <div className="flex items-start gap-3">
      <span className=${cx('grid size-10 shrink-0 place-items-center rounded-xl', strong ? 'bg-surface text-crit' : tone === 'warn' ? 'bg-warn-tint text-warn' : tone === 'good' ? 'bg-good-tint text-good' : 'bg-surface-2 text-ink-2')}><${Icon} name=${icon} className="size-5" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold leading-snug text-ink-2">${label}</p>
        <p className=${cx('mt-1 text-[26px] font-bold leading-none tracking-tight', strong ? 'text-crit' : 'text-ink')}>${value}</p>
      </div>
      <${Icon} name="arrowRight" className="size-4 text-ink-3 transition-transform group-hover:translate-x-0.5" />
    </div>
    ${meter != null && html`<${Meter} className="mt-3" value=${meter} tone=${meter >= 1 ? 'crit' : tone === 'warn' ? 'warn' : 'primary'} label=${label} />`}
    <p className="mt-2.5 text-[13px] leading-snug text-ink-3">${sub}</p>
  </a>`;
}

function Attention({ s, me }) {
  if (!s) return html`<div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">${[1, 2, 3, 4].map((i) => html`<${Skel} key=${i} h=${128} />`)}</div>`;
  const items = [];
  if (s.cases) {
    const c = s.cases;
    items.push(c.p1New
      ? { key: 'p1', tone: 'crit', icon: 'alert', href: '#/alerts', value: fmtInt(c.p1New), label: 'Ca nguy cơ an toàn chưa có người nhận', sub: `Lâu nhất đã chờ ${durationText(Date.now() - c.oldestP1At)}, hạn phản hồi 2 giờ.` }
      : { key: 'p1', tone: 'good', icon: 'shield', href: '#/alerts', value: '0', label: 'Ca nguy cơ an toàn đang chờ', sub: `${fmtInt(c.p1Open)} ca P1 đang có người xử lý.` });
    items.push({ key: 'open', tone: c.overdue ? 'warn' : 'neutral', icon: 'bell', href: '#/alerts', value: fmtInt(c.open), label: 'Ca cảnh báo đang mở', sub: `${fmtInt(c.unassigned)} chưa có người nhận · ${fmtInt(c.overdue)} quá hạn phản hồi.` });
  }
  if (s.bookings) items.push({ key: 'bk', tone: s.bookings.waitingOver24h ? 'warn' : 'neutral', icon: 'inbox', href: '#/bookings', value: fmtInt(s.bookings.new), label: 'Yêu cầu chuyên gia chờ chuyển',
    sub: s.bookings.waitingOver24h ? `${s.bookings.waitingOver24h} yêu cầu đã chờ hơn 24 giờ.` : 'Không có yêu cầu nào chờ quá 24 giờ.' });
  if (s.dataRequests) items.push({ key: 'dr', tone: s.dataRequests.dueSoon ? 'warn' : 'neutral', icon: 'file', href: '#/accounts', value: fmtInt(s.dataRequests.open), label: 'Yêu cầu về dữ liệu đang mở',
    sub: s.dataRequests.dueSoon ? `${s.dataRequests.dueSoon} yêu cầu đến hạn trong 24 giờ tới.` : 'Chưa có yêu cầu nào sát hạn.' });
  if (s.ai.spendToday != null) {
    const share = s.ai.spendToday / s.ai.budget;
    items.push({ key: 'spend', tone: share >= 1 ? 'crit' : share >= s.ai.alertAt ? 'warn' : 'neutral', icon: 'coin', href: me.perms.includes('ai') ? '#/ai' : '#/cost', value: usd(s.ai.spendToday),
      label: 'Chi phí Gemini hôm nay', sub: `${pct(share, 0)} ngân sách ${usd(s.ai.budget)} mỗi ngày.`, meter: share });
  }
  if (s.system) items.push({ key: 'err', tone: s.system.rate > 0.03 ? 'warn' : 'neutral', icon: 'server', href: '#/system', value: pct(s.system.rate), label: 'Lỗi gọi Gemini, 1 giờ qua', sub: `${fmtInt(s.system.errors)} trên ${fmtInt(s.system.calls)} lượt gọi.` });
  if (s.quality && items.length < 4) items.push({ key: 'q', tone: 'neutral', icon: 'star', href: '#/quality', value: fmtInt(s.quality.pending), label: 'Gợi ý bị chấm thấp chờ rà soát', sub: 'Ba mẹ chấm 1–2 sao trong 7 ngày qua.' });
  if (!items.length) return null;
  return html`<section aria-label="Cần chú ý" className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">${items.slice(0, 4).map((it) => html`<${AttentionCard} ...${it} />`)}</section>`;
}

function RecentActivity({ items }) {
  return html`<${Card} className="flex flex-col">
    <${CardHead} icon="history" title="Hoạt động gần đây của nhóm" actions=${html`<a href="#/audit" className="text-[13px] font-semibold text-primary-ink hover:underline">Xem tất cả</a>`} />
    <ul className="mt-3 flex-1 divide-y divide-line px-5 pb-3">${items.map((a) => html`<li key=${a.id} className="flex items-start gap-3 py-2.5">
      <${Avatar} name=${a.actor} size="sm" />
      <div className="min-w-0 flex-1 text-[13px] leading-snug"><p className="text-ink"><b className="font-semibold">${a.actor}</b> ${(AUDIT_ACTIONS[a.action] || [a.action])[0].toLowerCase()} <span className="font-medium text-ink-2">${a.target}</span></p>
        <p className="mt-0.5 text-xs text-ink-3">${ago(a.at)}</p></div></li>`)}</ul>
  <//>`;
}
function RhythmCard({ m }) {
  const c = m.current;
  const hourly = hourlyTotals(c.heat);
  const total = hourly.reduce((a, b) => a + b, 0) || 1;
  const evening = bestWindow(hourly, 17, 22, 2), quiet = bestWindow(hourly, 0, 23, 3, true), onCall = bestWindow(c.highByHour, 0, 23, 3);
  const rows = [
    ['moon', 'Cao điểm buổi tối', hourRange(evening.h, 2), `${pct(evening.v / total, 0)} lượt ghi`],
    ['alert', 'Nên trực cảnh báo', hourRange(onCall.h, 3), `nhiều cảnh báo nhất`],
    ['server', 'Vắng nhất, hợp để bảo trì', hourRange(quiet.h, 3), `${pct(quiet.v / total)} lượt ghi`],
  ];
  return html`<${Card}>
    <${CardHead} icon="clock" title="Nhịp sử dụng" sub="Giờ Việt Nam, theo khoảng thời gian đang xem." actions=${html`<a href="#/hours" className="text-[13px] font-semibold text-primary-ink hover:underline">Chi tiết</a>`} />
    <ul className="space-y-1 px-5 pb-5 pt-3">${rows.map(([icon, label, value, sub]) => html`<li key=${label} className="flex items-center gap-3 rounded-xl px-1 py-2">
      <span className="grid size-9 place-items-center rounded-xl bg-surface-2 text-ink-2"><${Icon} name=${icon} className="size-[18px]" /></span>
      <div className="min-w-0 flex-1"><p className="text-[13px] text-ink-3">${label}</p><p className="text-[15px] font-semibold tabular-nums text-ink">${value}</p></div>
      <span className="text-xs text-ink-3">${sub}</span></li>`)}</ul>
  <//>`;
}

function OverviewPage({ me, range, setRange }) {
  const q = useApi(`/api/admin/metrics?range=${range}`);
  const s = useApi('/api/admin/summary');
  const canCost = me.perms.includes('cost');
  return html`<${Fragment}>
    <${PageHeader} kicker=${fmtLongDate(localISODate())} title=${`${greeting()}, ${me.name}`}
      sub="Việc cần làm ngay ở hàng đầu. Phía dưới là số liệu tổng hợp, ẩn danh của mọi gia đình dùng EchoKid."
      actions=${html`<${RangeFilter} range=${range} setRange=${setRange} />`} />
    <${Attention} s=${s.data} me=${me} />
    <${Loaded} q=${q} skeleton=${html`<${KpiSkeleton} />`}>${(m) => {
      const c = m.current, p = m.previous;
      const d = deriveCosts(m, listedPrice(m.model, 'now'));
      const fails = (x) => x.failures.API_ERROR + x.failures.AI_INVALID_RESPONSE;
      const pts = c.daily.map((x, i) => { const date = dayDate(m, x.day); return { key: date, full: fmtFullDate(date), label: dayAxisLabel(date, i, c.daily.length), value: x.entries, tip: { value: `${fmtInt(x.entries)} lượt ghi`, detail: dayTip(m, date) } }; });
      return html`<div className="space-y-5">
        <div className=${cx('grid gap-3 sm:grid-cols-2', canCost ? 'lg:grid-cols-3' : 'lg:grid-cols-4')}>
          <${Stat} label="Gia đình hoạt động" value=${fmtInt(c.families)} sub=${`trên ${fmtInt(m.registeredFamilies)} gia đình đã đăng ký`} delta=${html`<${Delta} cur=${c.families} prev=${p.families} goodWhenUp />`} />
          <${Stat} label="Lượt ghi nhật ký" value=${fmtInt(c.entries)} sub=${`${fmt1(c.entries / Math.max(1, c.families) / c.days)} lượt mỗi gia đình mỗi ngày`} delta=${html`<${Delta} cur=${c.entries} prev=${p.entries} goodWhenUp />`} />
          <${Stat} label="Lượt ghi ở mức Cần chú ý" value=${fmtInt(c.high)} sub=${`${fmtInt(c.highFamilies)} gia đình · ${pct(c.high / Math.max(1, c.entries))} lượt ghi`} delta=${html`<${Delta} cur=${c.high} prev=${p.high} neutral />`} />
          <${Stat} label="Lượt gọi AI bị lỗi" value=${pct(fails(c) / Math.max(1, c.calls))} sub=${`${fmtInt(fails(c))} trên ${fmtInt(c.calls)} lượt gọi`} delta=${html`<${Delta} cur=${fails(c) / Math.max(1, c.calls)} prev=${fails(p) / Math.max(1, p.calls)} />`} />
          ${canCost && html`<${Stat} label="Chi phí Gemini" value=${usd(d.gemini.total)} sub=${m.range === 30 ? `${fmtInt(c.billedCalls)} lượt gọi · ${modelById(m.model).label}` : `≈ ${usd(d.gemini30)} mỗi 30 ngày · ${modelById(m.model).label}`} delta=${html`<${Delta} cur=${d.gemini.total} prev=${d.geminiPrev.total} neutral />`} />`}
          ${canCost && html`<${Stat} label="Chi phí mỗi gia đình" value=${usd(d.perFamily)} sub="mỗi tháng, gồm Gemini và Firestore" delta=${html`<${Delta} cur=${d.perFamily} prev=${d.perFamilyPrev} />`} />`}
        </div>
        <div className="grid gap-5 xl:grid-cols-3">
          <div className="min-w-0 xl:col-span-2"><${ColumnChart} title="Lượt ghi mỗi ngày" sub=${`${m.range} ngày gần nhất · cập nhật ${timeHM(new Date(m.generatedAt))}`} points=${pts} fmt=${fmtInt}
            labelled=${new Set([busiest(pts)])} tableHead=${['Ngày', 'Lượt ghi']} /></div>
          <div className="min-w-0">${s.data?.recent ? html`<${RecentActivity} items=${s.data.recent} />` : html`<${RhythmCard} m=${m} />`}</div>
        </div>
      </div>`;
    }}<//>
  <//>`;
}

/* ---------- usage hours ---------- */
function HoursPage({ range, setRange }) {
  const q = useApi(`/api/admin/metrics?range=${range}`);
  const [rpm, setRpmState] = useState(() => readPref('echokid.rpmLimit', ''));
  const setRpm = (v) => { setRpmState(v); writePref('echokid.rpmLimit', v); };
  return html`<${Fragment}>
    <${PageHeader} title="Khung giờ sử dụng" sub="Ba mẹ ghi nhật ký vào giờ nào. Dùng để xếp lịch trực cảnh báo, chọn giờ bảo trì và kiểm tra giới hạn gọi Gemini."
      actions=${html`<${RangeFilter} range=${range} setRange=${setRange} />`} />
    <${Loaded} q=${q} skeleton=${html`<${Skel} h=${420} />`}>${(m) => {
      const c = m.current;
      const hourly = hourlyTotals(c.heat);
      const total = hourly.reduce((a, b) => a + b, 0) || 1;
      const evening = bestWindow(hourly, 17, 22, 2), morning = bestWindow(hourly, 5, 10, 2), quiet = bestWindow(hourly, 0, 23, 3, true);
      const alertTotal = c.highByHour.reduce((a, b) => a + b, 0) || 1;
      const onCall = bestWindow(c.highByHour, 0, 23, 3);
      const morningPeak = (rows) => bestWindow(hourly.map((_, h) => rows.reduce((s, r) => s + c.heat[r][h], 0)), 5, 11, 1).h;
      const shift = morningPeak([5, 6]) - morningPeak([0, 1, 2, 3, 4]);
      const limit = Number(rpm);
      const used = limit > 0 ? c.peakMinute.count / limit : null;
      const usedTone = used == null ? 'neutral' : used >= 0.8 ? 'crit' : used >= 0.5 ? 'warn' : 'good';
      const callouts = [
        ['moon', 'Cao điểm buổi tối', hourRange(evening.h, 2), `${pct(evening.v / total, 0)} lượt ghi. Ba mẹ thường ghi sau khi con đã ngủ.`],
        ['sun', 'Buổi sáng', hourRange(morning.h, 2), `${pct(morning.v / total, 0)} lượt ghi, trước giờ đưa con đi học.${shift > 0 ? ` Cuối tuần muộn hơn khoảng ${shift} giờ.` : ''}`],
        ['server', 'Vắng nhất', hourRange(quiet.h, 3), `Chỉ ${pct(quiet.v / total)} lượt ghi. Nên bảo trì hoặc triển khai bản mới trong khung này.`],
        ['alert', 'Giờ nên trực cảnh báo', hourRange(onCall.h, 3), `${pct(onCall.v / alertTotal, 0)} lượt ghi mức "Cần chú ý" rơi vào khung này.`],
      ];
      return html`<div className="space-y-5">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <figure className="min-w-0 rounded-2xl border border-line bg-surface p-5 shadow-card">
            <figcaption className="mb-5 flex flex-wrap items-baseline justify-between gap-2"><span className="text-[15px] font-bold">Lượt ghi theo thứ và giờ</span><span className="text-[13px] text-ink-3">${fmtInt(c.entries)} lượt ghi · ${m.range} ngày</span></figcaption>
            <${Heatmap} grid=${c.heat} total=${c.entries} />
          </figure>
          <div className="grid content-start gap-3 sm:grid-cols-2 xl:grid-cols-1">${callouts.map(([icon, label, value, text]) => html`<div key=${label} className="flex gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
            <span className=${cx('grid size-10 shrink-0 place-items-center rounded-xl', icon === 'alert' ? 'bg-crit-tint text-crit' : 'bg-surface-2 text-ink-2')}><${Icon} name=${icon} className="size-5" /></span>
            <div className="min-w-0"><p className="text-[13px] font-medium text-ink-3">${label}</p><p className="text-lg font-bold tabular-nums text-ink">${value}</p><p className="mt-0.5 text-[13px] leading-snug text-ink-2">${text}</p></div></div>`)}</div>
        </div>
        <${Card} className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] md:items-start">
          <div>
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-2"><${Icon} name="gauge" className="size-4 text-ink-3" />Tải cao nhất lên Gemini</p>
            <p className="mt-2 text-ink"><span className="text-4xl font-bold tracking-tight">${fmtInt(c.peakMinute.count)}</span> <span className="text-sm text-ink-2">yêu cầu trong 1 phút</span></p>
            <p className="mt-1.5 text-[13px] text-ink-3">Lúc ${whenText(c.peakMinute)}. Giờ bận nhất: ${fmtInt(c.peakHour.count)} yêu cầu (${whenText(c.peakHour)}).</p>
          </div>
          <${Field} label="Giới hạn yêu cầu mỗi phút (RPM) của dự án" htmlFor="rpm"
            hint=${used == null && html`<span>Google không công bố giới hạn cố định; xem giới hạn của dự án tại <a className="font-semibold text-primary-ink underline" href=${PRICE_SOURCES.rateLimits} target="_blank" rel="noopener">AI Studio</a>. Chỉ lưu trên máy này.</span>`}>
            <${Input} id="rpm" type="number" min="1" inputMode="numeric" placeholder="Ví dụ: 1000" value=${rpm} onChange=${(e) => setRpm(e.target.value)} />
            ${used != null && html`<div className="space-y-1.5 pt-1"><${Meter} value=${used} tone=${usedTone} label="Phần giới hạn đã dùng lúc cao điểm" />
              <p className=${cx('flex items-center gap-1.5 text-[13px] font-medium', TONE_TEXT[usedTone])}><${Icon} name=${usedTone === 'good' ? 'checkCircle' : 'alert'} className="size-4" />Lúc cao điểm dùng ${pct(used, 0)} giới hạn.</p></div>`}
          <//>
        <//>
      </div>`;
    }}<//>
  <//>`;
}

/* ---------- Gemini cost ---------- */
function PricePanel({ pricing, canChangeModel }) {
  const model = modelById(pricing.modelId);
  const setField = (k) => (e) => { const v = Math.max(0, Number(e.target.value)); if (Number.isFinite(v)) pricing.setCustom({ ...pricing.price, [k]: v }); };
  return html`<${Card} className="p-5">
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <${Field} label="Tính theo mô hình" htmlFor="pp-model" hint=${model.note}>
        <${Select} id="pp-model" value=${pricing.modelId} onChange=${(e) => pricing.setModelId(e.target.value)}>
          ${GEMINI_MODELS.map((mm) => html`<option key=${mm.id} value=${mm.id}>${mm.label}${mm.id === pricing.inUse ? ' (đang dùng)' : ''}</option>`)}
        <//>
      <//>
      ${model.prices.from2027 ? html`<${Field} label="Bảng giá áp dụng"><${Segmented} label="Bảng giá áp dụng" value=${pricing.period} onChange=${pricing.setPeriod} className="w-full"
          options=${[{ value: 'now', label: 'Đến 31/12/2026' }, { value: 'from2027', label: 'Từ 01/01/2027' }]} /><//>` : html`<div className="hidden xl:block"></div>`}
      <${Field} label="Giá đầu vào · US$ / 1 triệu token" htmlFor="pp-in"><${Input} id="pp-in" type="number" min="0" step="0.01" value=${pricing.price.input} onChange=${setField('input')} /><//>
      <${Field} label="Giá đầu ra · US$ / 1 triệu token" htmlFor="pp-out" hint="Gồm cả token suy luận."><${Input} id="pp-out" type="number" min="0" step="0.01" value=${pricing.price.output} onChange=${setField('output')} /><//>
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3 text-[13px] text-ink-3">
      <span>${pricing.custom ? 'Đang dùng giá bạn nhập.' : `Giá niêm yết, gói trả phí, kiểm tra ngày ${PRICE_CHECKED}.`}</span>
      <a className="inline-flex items-center gap-1 font-semibold text-primary-ink hover:underline" href=${PRICE_SOURCES.gemini} target="_blank" rel="noopener">Bảng giá Gemini API<${Icon} name="external" className="size-3.5" /></a>
      ${pricing.custom && html`<button type="button" className="font-semibold text-primary-ink hover:underline" onClick=${pricing.reset}>Dùng lại giá niêm yết</button>`}
      <span className="basis-full sm:ml-auto sm:basis-auto">Chỉ để tính thử, không đổi mô hình thật.${canChangeModel && html` <a className="font-semibold text-primary-ink hover:underline" href="#/ai">Đổi mô hình ở Điều khiển AI</a>`}</span>
    </div>
  <//>`;
}

function CostPage({ me, range, setRange, pricing }) {
  const q = useApi(`/api/admin/metrics?range=${range}`);
  useEffect(() => { if (q.data && !pricing.touched) pricing.adopt(q.data.model); }, [q.data?.model]);
  return html`<${Fragment}>
    <${PageHeader} title="Chi phí Gemini API" sub="Mỗi lượt ghi nhật ký gọi Gemini một lần. Chi phí = token của từng lượt gọi × bảng giá; token suy luận tính theo giá đầu ra."
      actions=${html`<${RangeFilter} range=${range} setRange=${setRange} />`} />
    <div className="space-y-5">
      <${PricePanel} pricing=${pricing} canChangeModel=${me.perms.includes('ai')} />
      <${Loaded} q=${q} skeleton=${html`<${KpiSkeleton} n=${4} />`}>${(m) => {
        const c = m.current;
        const d = deriveCosts(m, pricing.price);
        const n = Math.max(1, c.billedCalls);
        const avg = (k) => c.tokens[k] / n;
        const per30 = (x) => (x / c.days) * 30;
        const model = modelById(pricing.modelId);
        const future = model.prices.from2027 && pricing.period === 'now' && !pricing.custom ? per30(tokenCost(c.tokens, model.prices.from2027).total) : null;
        const pts = c.daily.map((x, i) => {
          const date = dayDate(m, x.day), cost = tokenCost(x, pricing.price).total;
          return { key: date, full: fmtFullDate(date), label: dayAxisLabel(date, i, c.daily.length), value: cost, tip: { value: usd(cost), detail: `${dayTip(m, date)} · ${fmtInt(x.entries)} lượt ghi` } };
        });
        const savings = [
          ['Hạ mức suy luận (thinking)', `Đặt mức suy luận thấp để mỗi lượt khoảng 200 token, thay vì trung bình ${fmtInt(avg('thinking'))} như hiện nay.`, (per30(c.billedCalls) * Math.max(0, avg('thinking') - 200) * pricing.price.output) / 1e6],
          ['Gửi 10 lần ghi cũ thay vì 20', 'Lời nhắc hiện kèm tối đa 20 lần ghi gần nhất. Giảm còn 10 vẫn đủ để so sánh xu hướng trong tuần.', (per30(c.histOver10) * TOKEN_MODEL.perHistoryEntry * pricing.price.input) / 1e6],
          ['Chuyển sang Gemini 3.1 Flash-Lite', 'Giá đầu vào 0,25 và đầu ra 1,50 US$ cho mỗi triệu token.', Math.max(0, d.gemini30 - per30(tokenCost(c.tokens, listedPrice('gemini-3.1-flash-lite', 'now')).total))],
        ];
        return html`<div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <${Stat} label="Chi phí mỗi lượt gọi" value=${usd(d.gemini.total / n, 4)} sub=${`${fmtInt(c.billedCalls)} lượt gọi có tính phí`} />
            <${Stat} label="Token mỗi lượt" value=${fmtInt(avg('input') + avg('output') + avg('thinking'))} sub=${`${fmtInt(avg('input'))} vào · ${fmtInt(avg('output'))} trả lời · ${fmtInt(avg('thinking'))} suy luận`} />
            <${Stat} label="Thời gian chờ" value=${`${fmt1(c.latency.p50 / 1000)} giây`} sub=${`95% lượt gọi dưới ${fmt1(c.latency.p95 / 1000)} giây; ba mẹ chờ trong lúc này`} />
            <${Stat} label="Ước tính mỗi 30 ngày" value=${usd(d.gemini30)} tone=${future ? 'warn' : ''} icon=${future ? 'calendar' : ''} sub=${future ? `Từ 01/01/2027: ${usd(future)}` : `theo lượng dùng ${m.range} ngày qua`} />
          </div>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
            <${Card} className="p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-[15px] font-bold">Tiền Gemini đi đâu</h2><span className="text-[13px] text-ink-3">${usd(d.gemini.total)} trong ${m.range} ngày</span></div>
              <div className="mt-5"><${ShareBar} fmt=${(v) => usd(v)} parts=${[
                { key: 'input', label: 'Đầu vào: lời nhắc và nhật ký cũ', value: d.gemini.input, color: 'var(--viz-1)' },
                { key: 'output', label: 'Câu trả lời JSON', value: d.gemini.output, color: 'var(--viz-2)' },
                { key: 'thinking', label: 'Suy luận (thinking)', value: d.gemini.thinking, color: 'var(--viz-3)' },
              ]} /></div>
            <//>
            <div className="min-w-0"><${ColumnChart} title="Chi phí Gemini mỗi ngày" sub=${`US$, ${m.range} ngày`} points=${pts} fmt=${(v) => usd(v)} labelled=${new Set([busiest(pts)])} yWidth=${64} tableHead=${['Ngày', 'Chi phí']} /></div>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <${Card}>
              <${CardHead} icon="coin" title="Cách giảm chi phí" sub="Ước tính mỗi 30 ngày với lượng dùng hiện tại." />
              <ul className="mt-2 divide-y divide-line px-5 pb-2">${savings.map(([title, text, value]) => html`<li key=${title} className="flex items-start gap-4 py-3.5">
                <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-ink">${title}</p><p className="mt-0.5 text-[13px] leading-snug text-ink-2">${text}</p>
                  <${Pill} tone="warn" className="mt-2">Cần thử lại chất lượng gợi ý<//></div>
                <p className="text-right"><span className="block text-lg font-bold tabular-nums text-good">−${usd(value)}</span><span className="text-xs text-ink-3">mỗi 30 ngày</span></p></li>`)}</ul>
            <//>
            <${Card}>
              <${CardHead} icon="alert" title="Rủi ro chi phí và dữ liệu" />
              <div className="space-y-3 p-5">
                <${Callout} tone="crit" title="/api/test gọi Gemini mà không cần đăng nhập">Ai biết đường dẫn cũng gọi được liên tục và tiêu tiền của dự án. Xóa route này hoặc yêu cầu đăng nhập.<//>
                <${Callout} tone="warn" icon="lock" title="Gói miễn phí dùng nội dung để cải thiện sản phẩm">Nhật ký của trẻ là dữ liệu nhạy cảm. Bật thanh toán trước khi có gia đình thật; ở gói trả phí Google không dùng nội dung này.<//>
                ${future && html`<${Callout} tone="warn" icon="calendar" title="Giá Gemini 3.6 Flash tăng gấp đôi từ 01/01/2027">Với lượng dùng hiện tại, chi phí mỗi 30 ngày sẽ từ ${usd(d.gemini30)} lên ${usd(future)}.<//>`}
              </div>
            <//>
          </div>
        </div>`;
      }}<//>
    </div>
  <//>`;
}

/* ---------- forecast ---------- */
const FAM_MIN = 50, FAM_MAX = 10000;
const famFromSlider = (s) => { const raw = FAM_MIN * (FAM_MAX / FAM_MIN) ** (s / 1000); const mag = 10 ** Math.floor(Math.log10(raw)); return Math.round(raw / (mag / 2)) * (mag / 2); };
const sliderFromFam = (f) => Math.round((Math.log(clamp(f, FAM_MIN, FAM_MAX) / FAM_MIN) / Math.log(FAM_MAX / FAM_MIN)) * 1000);

function RangeField({ id, label, value, min, max, step, onChange, format, hint }) {
  return html`<div className="space-y-2">
    <div className="flex items-baseline justify-between gap-3"><label htmlFor=${id} className="text-[13px] font-semibold text-ink">${label}</label><output htmlFor=${id} className="text-sm font-bold tabular-nums text-ink">${format(value)}</output></div>
    <input id=${id} type="range" className="w-full accent-primary" min=${min} max=${max} step=${step} value=${value} onChange=${(e) => onChange(Number(e.target.value))} />
    ${hint && html`<p className="text-[12.5px] text-ink-3">${hint}</p>`}
  </div>`;
}

function ForecastBody({ m, pricing }) {
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
    ['Gemini · đầu vào', r.gemini.input, 'var(--viz-1)'], ['Gemini · câu trả lời', r.gemini.output, 'var(--viz-2)'], ['Gemini · suy luận', r.gemini.thinking, 'var(--viz-3)'],
    ['Firestore · lượt đọc', r.firestore.reads], ['Firestore · lượt ghi', r.firestore.writes], ['Firestore · lưu trữ', r.firestore.storage], ['Hosting và dịch vụ khác', r.hosting],
  ];
  const scales = [100, 500, 1000, 2500, 5000, 10000];
  const nearest = scales.reduce((a, b) => (Math.abs(b - families) < Math.abs(a - families) ? b : a));
  const pts = scales.map((f) => { const t = projectMonthly({ ...base, families: f }).total; return { key: String(f), full: `${fmtInt(f)} gia đình`, label: fmtInt(f), value: t, tip: { value: `${usd(t)} / tháng`, detail: `${fmtInt(f)} gia đình · ${usd(t / f)} mỗi gia đình` } }; });
  return html`<div className="grid gap-5 xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
    <${Card} className="space-y-5 p-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3"><label htmlFor="fc-fam" className="text-[13px] font-semibold text-ink">Số gia đình hoạt động</label>
          <${Input} className="!h-8 !w-24 text-right tabular-nums" type="number" min=${FAM_MIN} max=${FAM_MAX} value=${families} aria-label="Nhập số gia đình" onChange=${(e) => setFamilies(clamp(Math.round(Number(e.target.value) || FAM_MIN), 1, 100000))} /></div>
        <input id="fc-fam" type="range" className="w-full accent-primary" min="0" max="1000" step="1" value=${sliderFromFam(families)} onChange=${(e) => setFamilies(famFromSlider(Number(e.target.value)))} />
      </div>
      <${RangeField} id="fc-entries" label="Lượt ghi mỗi gia đình mỗi ngày" value=${entriesPerDay} min=${0.2} max=${5} step=${0.1} onChange=${setEntries} format=${fmt1} />
      <${RangeField} id="fc-hist" label="Số lần ghi cũ gửi kèm cho AI" value=${historySent} min=${0} max=${20} step=${1} onChange=${setHistory} format=${String} hint="Code hiện gửi tối đa 20." />
      <${RangeField} id="fc-think" label="Token suy luận mỗi lượt" value=${thinking} min=${0} max=${3000} step=${50} onChange=${setThinking} format=${fmtInt} />
      <${RangeField} id="fc-months" label="Số tháng gia đình đã dùng (trung bình)" value=${monthsActive} min=${1} max=${24} step=${1} onChange=${setMonths} format=${(v) => `${v} tháng`} hint="Nhật ký càng dài, Firestore càng tốn lượt đọc nếu chưa sửa truy vấn." />
      <${Check} checked=${queryFixed} onChange=${setQueryFixed}>Đã sửa truy vấn Firestore (chỉ đọc 30 ngày gần nhất)<//>
      <${Field} label="Hosting và dịch vụ khác · US$ mỗi tháng" htmlFor="fc-host"><${Input} id="fc-host" type="number" min="0" step="1" value=${hosting} onChange=${(e) => setHosting(Math.max(0, Number(e.target.value) || 0))} /><//>
    <//>
    <div className="min-w-0 space-y-5">
      <${Card} className="p-5">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-2"><${Icon} name="coin" className="size-4 text-ink-3" />Tổng chi phí mỗi tháng</p>
        <p className="mt-2 text-5xl font-bold tracking-tight text-ink">${usd(r.total)}</p>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-3">≈ ${usd(r.perFamily, 3)} mỗi gia đình · ${fmtInt(r.callsPerMonth)} lượt gọi Gemini · ${fmtInt(r.readsPerDay)} lượt đọc Firestore mỗi ngày (miễn phí ${fmtInt(FIRESTORE.free.readsPerDay)})</p>
        <div className="mt-4 overflow-x-auto"><table className="w-full text-sm">
          <tbody className="divide-y divide-line">${rows.map(([label, v, color]) => html`<tr key=${label}><th scope="row" className="py-2 text-left font-normal text-ink-2"><span className="inline-flex items-center gap-2">${color ? html`<i className="size-2.5 rounded-sm" style=${{ background: color }}></i>` : html`<i className="size-2.5 rounded-sm bg-line-strong"></i>`}${label}</span></th>
            <td className="py-2 text-right font-semibold tabular-nums">${usd(v)}</td><td className="w-16 py-2 text-right tabular-nums text-ink-3">${pct(v / (r.total || 1), 0)}</td></tr>`)}</tbody>
          <tfoot className="border-t-2 border-line-strong"><tr><th scope="row" className="py-2 text-left">Tổng</th><td className="py-2 text-right font-bold tabular-nums">${usd(r.total)}</td><td></td></tr></tfoot>
        </table></div>
      <//>
      <${ColumnChart} title="Chi phí mỗi tháng theo quy mô" sub=${`với các giả định bên trái · gần nhất: ${fmtInt(nearest)} gia đình`} points=${pts} fmt=${(v) => usd(v, 0)}
        labelled=${new Set([String(nearest), '10000'])} yWidth=${68} tableHead=${['Quy mô', 'Chi phí mỗi tháng']} />
    </div>
  </div>`;
}

function ForecastPage({ range, setRange, pricing }) {
  const q = useApi(`/api/admin/metrics?range=${range}`);
  return html`<${Fragment}>
    <${PageHeader} title="Dự báo chi phí" sub="Kéo các giả định để xem chi phí mỗi tháng khi EchoKid có thêm gia đình. Dùng bảng giá ở trang Chi phí AI; mặc định lấy từ số liệu thật của kỳ đang xem."
      actions=${html`<${RangeFilter} range=${range} setRange=${setRange} />`} />
    <${Loaded} q=${q} skeleton=${html`<${Skel} h=${520} />`}>${(m) => html`<${ForecastBody} key=${m.range} m=${m} pricing=${pricing} />`}<//>
  <//>`;
}

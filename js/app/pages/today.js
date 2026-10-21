/* Today page (app/dashboard/page.tsx). */
'use strict';

/* ---------- Today (app/dashboard/page.tsx) ---------- */
/* computeTrend calls 0 → 1 meltdown "increasing"; only name a trend once there is enough to go on */
function meltdownView(progress) {
  const melts = progress.observations.reduce((s, o) => s + o.meltdownCount, 0);
  const days = progress.dailyBreakdown.length;
  const perDay = days ? progress.dailyBreakdown.reduce((s, d) => s + d.meltdownCount, 0) / days : 0;
  if (melts === 0) return { value: 'Không có', icon: 'checkCircle', cls: 'kpi__value--good', sub: 'không có cơn nào', sentence: 'Không có cơn meltdown nào.' };
  if (melts < 3 || progress.summary.logsSubmitted < 4) return { value: `${melts} cơn`, icon: null, cls: '', sub: 'chưa đủ để thấy xu hướng', sentence: `Có ${melts} cơn meltdown, chưa đủ để thấy xu hướng.` };
  const [value, icon, cls, phrase] = {
    decreasing: ['Giảm', 'trendDown', 'kpi__value--good', 'đang giảm dần'],
    increasing: ['Tăng', 'trendUp', 'kpi__value--crit', 'có xu hướng tăng'],
    stable: ['Ổn định', 'trendFlat', '', 'khá ổn định'],
  }[progress.summary.meltdownTrend];
  return { value, icon, cls, sub: `TB ${fmt1(perDay)} cơn/ngày có ghi`, sentence: `Có ${melts} cơn meltdown, ${phrase}.` };
}

function insightText(name, range, progress) {
  const obs = progress.observations;
  const n = obs.length;
  if (!n) return `Chưa có ghi nhận nào ${range === 'day' ? 'hôm nay' : `trong ${RANGE_SPAN[range]}`}. Ghi nhật ký để bắt đầu thấy nhịp của ${name}.`;
  const pos = Math.round((obs.filter((o) => POSITIVE.has(o.mood) && o.meltdownCount === 0).length / n) * 100);
  const when = range === 'day' ? 'Hôm nay' : cap(RANGE_SPAN[range]);
  return `${when}, ${name} có ${n} lần ghi nhận, ${pos}% là khoảnh khắc ổn định. Ngủ trung bình ${fmt1(progress.summary.sleepAvgHours)} giờ. ${meltdownView(progress).sentence}`;
}

function DashboardPage() {
  const { route, activeChild, session } = useApp();
  const childId = route.params.childId;
  const today = localISODate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [latest, setLatest] = useState(undefined);
  const [range, setRange] = useState('week');
  const [progress, setProgress] = useState(null);
  const [progressLoading, setProgressLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    if (!childId) return undefined;
    let alive = true;
    setLoading(true); setError('');
    const q = encodeURIComponent(childId);
    getJSON(`/api/dashboard?childId=${q}`).then((p) => alive && setData(p))
      .catch(() => alive && setError('Chưa thể tải dữ liệu hôm nay. Bạn thử lại nhé.'))
      .finally(() => alive && setLoading(false));
    /* same endpoint the diary page uses for "latest saved result"; gives severity for the alert */
    getJSON(`/api/recommendation?childId=${q}`).then((p) => alive && setLatest(p)).catch(() => alive && setLatest(null));
    return () => { alive = false; };
  }, [childId, reload]);

  useEffect(() => {
    if (!childId) return undefined;
    let alive = true;
    setProgressLoading(true);
    getJSON(`/api/dashboard/progress?childId=${encodeURIComponent(childId)}&range=${range}`)
      .then((p) => alive && setProgress(p)).catch(() => alive && setProgress(null))
      .finally(() => alive && setProgressLoading(false));
    return () => { alive = false; };
  }, [childId, range, reload]);

  if (!childId) {
    return html`<div className="page"><${EmptyState} title="Hôm nay mình đồng hành cùng ai?" text="Chọn hồ sơ của bé để xem nhịp chăm sóc trong ngày.">
      <${LinkBtn} to="/children">Chọn hồ sơ bé<//><//></div>`;
  }
  const name = activeChild?.name || 'bé';
  const rec = latest?.recommendation;
  const escalate = rec?.escalation?.shouldSuggestExpert;
  const todayEntries = (progress?.observations || []).filter((o) => o.date === today);

  return html`<div className="page">
    <header className="page-head">
      <p className="page-head__kicker">${greeting()}, ${session?.name}</p>
      <h1>Hôm nay của ${name}</h1>
      <p className="page-head__meta"><${Icon} name="calendar" />${fmtLongDate(today)}</p>
    </header>

    ${error && html`<div className="form-error" role="alert"><${Icon} name="info" /><div className="form-error__body"><span>${error}</span>
      <div className="form-error__actions"><${Btn} size="sm" variant="secondary" onClick=${() => setReload((n) => n + 1)}><${Icon} name="refresh" />Thử lại<//></div></div></div>`}

    ${escalate && html`<${EscalationAlert} severity=${rec.severityLevel} message=${rec.escalation.message} child=${activeChild}
      childId=${childId} date=${latest.observation.date} observationId=${rec.logId} onReport=${() => setReportOpen(true)} />`}

    <div className="today-grid">
      <${CheckinCard} name=${name} childId=${childId} entries=${todayEntries} ready=${!progressLoading || !!progress} />
      <div className="side-stack">
        <${StreakCard} loading=${loading} days=${data?.streakDays ?? 0} />
        <${LatestCard} loading=${loading || latest === undefined} last=${data?.lastRecommendation} rec=${rec} childId=${childId} />
      </div>
    </div>

    <${Overview} name=${name} range=${range} setRange=${setRange} progress=${progress} loading=${progressLoading} />

    <section className="card helper">
      <div className="helper__main">
        <span className="helper__icon"><${Icon} name="steth" /></span>
        <div><h2>Cần thêm người đồng hành?</h2><p>Đặt lịch với bác sĩ hoặc chuyên gia và gửi kèm bản tóm tắt 30 ngày của ${name}.</p></div>
      </div>
      <${LinkBtn} to="/expert" params=${{ childId, date: today }} variant="secondary">Kết nối chuyên gia<${Icon} name="arrowRight" /><//>
    </section>
    <${ReportSheet} open=${reportOpen} onClose=${() => setReportOpen(false)} child=${activeChild} />
  </div>`;
}

function CheckinCard({ name, childId, entries, ready }) {
  const logged = entries.length > 0;
  const last = entries[entries.length - 1];
  return html`<section className="card checkin" aria-labelledby="checkin-title">
    <${Hands} />
    <div className="checkin__copy">
      <span>${!ready ? html`<span className="pill pill--neutral">Đang kiểm tra...</span>`
        : logged ? html`<span className="pill pill--good"><${Icon} name="check" />Đã ghi ${entries.length} lần hôm nay</span>`
        : html`<span className="pill pill--neutral">Chưa ghi hôm nay</span>`}</span>
      <h2 id="checkin-title">${logged ? `Bây giờ ${name} thế nào?` : `Hôm nay ${name} thế nào?`}</h2>
      <p>${logged ? `Lần gần nhất lúc ${last.time}: ${MOOD_LABEL[last.mood].toLowerCase()}. Ghi thêm khi cảm xúc hoặc hành vi của con thay đổi.`
        : 'Chạm vào gương mặt gần nhất với cảm xúc của con để bắt đầu. Chỉ mất khoảng một phút.'}</p>
    </div>
    <nav className="quick-moods" aria-label="Bắt đầu ghi với một cảm xúc">
      ${MOODS.map((m) => html`<${Link} key=${m.value} to="/daily-log" params=${{ childId, mood: m.value }} className="quick-mood">
        <${Face} mood=${m.value} size=${48} />${m.label}<//>`)}
    </nav>
    <div className="checkin__actions">
      <${LinkBtn} to="/daily-log" params=${{ childId }}><${Icon} name="pencil" />${logged ? 'Ghi thêm' : 'Ghi nhật ký'}<//>
      <${LinkBtn} to="/daily-log" params=${{ childId, view: 'history' }} variant="quiet">Xem nhật ký đã ghi<//>
    </div>
  </section>`;
}

function StreakCard({ loading, days }) {
  return html`<section className="card streak">
    <div className="streak__badge"><strong>${loading ? '–' : days}</strong><small>ngày</small></div>
    <div>
      <p className="kicker"><${Icon} name="sprout" />Chuỗi đồng hành</p>
      <h2>${days > 0 ? 'Mình đang làm rất tốt!' : 'Bắt đầu chuỗi hôm nay'}</h2>
      <p>Mỗi ghi nhận đều là một bước nhỏ để hiểu con hơn.</p>
    </div>
  </section>`;
}

function LatestCard({ loading, last, rec, childId }) {
  if (loading) return html`<section className="card latest"><${Skel} h=${22} w="40%" /><${Skel} h=${26} /><${Skel} h=${44} /></section>`;
  if (!last) return html`<section className="card latest">
    <p className="kicker kicker--teal"><${Icon} name="sparkle" />Gợi ý gần nhất</p>
    <h3>Chưa có hoạt động được gợi ý</h3>
    <p className="latest__meta">Hoàn tất ghi nhận để nhận gợi ý phù hợp cho bé.</p>
    <${LinkBtn} to="/daily-log" params=${{ childId }} variant="secondary">Tạo gợi ý đầu tiên<//>
  </section>`;
  return html`<section className="card latest">
    <div className="latest__top"><p className="kicker kicker--teal"><${Icon} name="sparkle" />Gợi ý gần nhất</p>${rec && html`<${SeverityPill} level=${rec.severityLevel} />`}</div>
    <h3>${last.activityTitle}</h3>
    <p className="latest__meta">Từ ghi nhận ngày ${fmtFullDate(last.date)}${rec ? ` · ${rec.recommendation.durationMinutes} phút` : ''}</p>
    <${LinkBtn} to="/recommendation" params=${{ childId, observationId: last.id }} variant="secondary">Xem chi tiết gợi ý<${Icon} name="arrowRight" /><//>
  </section>`;
}

function Overview({ name, range, setRange, progress, loading }) {
  const first = loading && !progress;
  const obs = progress?.observations || [];
  const n = obs.length;
  const pos = n ? Math.round((obs.filter((o) => POSITIVE.has(o.mood) && o.meltdownCount === 0).length / n) * 100) : 0;
  const melt = progress ? meltdownView(progress) : null;
  const series = progress ? buildSeries(progress, range) : null;
  const unitSub = range === 'day' ? 'theo từng lần ghi hôm nay' : 'mỗi ngày';
  return html`<section className="section overview" aria-labelledby="overview-title">
    <div className="section-head">
      <div><h2 id="overview-title">Nhịp của ${name}</h2><p>So sánh cảm xúc, giấc ngủ và meltdown trong khoảng thời gian ba mẹ chọn.</p></div>
      <${Seg} name="range" label="Khoảng thời gian" className="tabs-switch" value=${range} options=${RANGES} onChange=${setRange} />
    </div>
    ${first ? html`<${Skel} h=${56} /><div className="kpis">${[0, 1, 2, 3].map((i) => html`<${Skel} key=${i} h=${104} />`)}</div><${Skel} h=${260} />`
      : !progress ? html`<p className="chart__empty">Chưa thể tải tiến trình lúc này.</p>`
      : html`<div className=${cx('overview__body', loading && 'is-refreshing')} aria-busy=${loading}>
        <p className="insight"><${Icon} name="sparkle" /><span>${insightText(name, range, progress)}</span></p>
        <div className="kpis">
          <div className="card kpi"><span className="kpi__label">Lần ghi nhận</span><span className="kpi__value">${n}</span><span className="kpi__sub">${RANGE_SPAN[range]}</span></div>
          <div className="card kpi"><span className="kpi__label">Khoảnh khắc ổn định</span><span className="kpi__value">${pos}%</span><span className="kpi__sub">vui vẻ hoặc bình tĩnh, không meltdown</span></div>
          <div className="card kpi"><span className="kpi__label">Ngủ trung bình</span><span className="kpi__value">${fmt1(progress.summary.sleepAvgHours)}<small>giờ</small></span><span className="kpi__sub">mỗi ngày có ghi nhận</span></div>
          <div className="card kpi"><span className="kpi__label">Meltdown</span><span className=${cx('kpi__value', melt.cls)}>${melt.icon && html`<${Icon} name=${melt.icon} />`}${melt.value}</span><span className="kpi__sub">${melt.sub}</span></div>
        </div>
        <div className="charts">
          <${MoodRhythm} observations=${obs} range=${range} />
          <${ColumnChart} title="Giấc ngủ" sub=${`giờ, ${unitSub}`} color="var(--series-sleep)" ...${series.sleep} fmt=${fmt1} emptyText="Chưa có dữ liệu giấc ngủ trong khoảng này." />
          <${ColumnChart} title="Meltdown" sub=${`số cơn, ${unitSub}`} color="var(--series-melt)" ...${series.melt} fmt=${(v) => String(v)} emptyText="Chưa có dữ liệu trong khoảng này." />
        </div>
        <${DataTable} observations=${obs} />
      </div>`}
  </section>`;
}

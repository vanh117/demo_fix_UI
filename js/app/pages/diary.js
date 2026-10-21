/* Diary: new entry + history (app/daily-log → app/analysis/page.tsx). */
'use strict';

/* ---------- Diary (app/daily-log → app/analysis/page.tsx) ---------- */
function DiaryPage() {
  const { route, navigate, activeChild, shared } = useApp();
  const childId = route.params.childId;
  const today = localISODate();
  const [view, setView] = useState(route.params.view === 'history' ? 'history' : 'write');
  const [mood, setMood] = useState(MOOD_LABEL[route.params.mood] ? route.params.mood : 'calm');
  const [sleepHours, setSleepHours] = useState(8);
  const [sleepQuality, setSleepQuality] = useState('good');
  const [social, setSocial] = useState('medium');
  const [focus, setFocus] = useState('medium');
  const [ateNormally, setAteNormally] = useState(true);
  const [mealNotes, setMealNotes] = useState('');
  const [meltdown, setMeltdown] = useState(false);
  const [meltdownCount, setMeltdownCount] = useState(1);
  const [meltdownTrigger, setMeltdownTrigger] = useState('');
  const [note, setNote] = useState('');
  const [phase, setPhase] = useState('idle');
  const [error, setError] = useState(null);
  const [tracks, setTracks] = useState(null);
  const [days, setDays] = useState(7);
  const [latest, setLatest] = useState(undefined);
  const [prefill, setPrefill] = useState(null);
  const [savedAt, setSavedAt] = useState('');

  const loadTracks = useCallback(() => {
    if (!childId) return;
    getJSON(`/api/daily_log?childId=${encodeURIComponent(childId)}&days=${days}`)
      .then((d) => setTracks((d.observations ?? []).slice().reverse())).catch(() => setTracks([]));
  }, [childId, days]);
  useEffect(loadTracks, [loadTracks]);
  useEffect(() => {
    if (!childId) return;
    getJSON(`/api/recommendation?childId=${encodeURIComponent(childId)}`).then(setLatest).catch(() => setLatest(null));
  }, [childId]);
  /* sleep is the same for the whole day: start from today's last entry instead of 8 h */
  useEffect(() => {
    if (!tracks || prefill !== null) return;
    const t = tracks.find((x) => x.date === today);
    if (t) { setSleepHours(t.sleep.hours); setSleepQuality(t.sleep.quality); setPrefill(t.time); } else setPrefill(false);
  }, [tracks]);

  async function analyze(observationId) {
    setPhase('analyzing');
    const res = await apiFetch('/api/recommendation', { method: 'POST', body: JSON.stringify({ childId, observationId }) });
    const body = await res.json();
    if (!res.ok) { setError({ message: body.error || 'AI chưa thể phân tích.', observationId, code: body.code, safety: body.safety }); setPhase('idle'); loadTracks(); return; }
    navigate('/recommendation', { childId, observationId }, { replace: true });
  }
  async function submit(e) {
    e.preventDefault();
    if (!childId || phase !== 'idle') return;
    setError(null); setPhase('saving'); setSavedAt(timeHM());
    try {
      const res = await apiFetch('/api/daily_log', {
        method: 'POST',
        body: JSON.stringify({
          childId, date: today, mood,
          sleep: { hours: sleepHours, quality: sleepQuality },
          meal: { ateNormally, notes: mealNotes }, socialInteraction: social, focus, freeTextNote: note,
          meltdown: { occurred: meltdown, count: meltdown ? meltdownCount : 0, trigger: meltdown ? meltdownTrigger : '' },
          markCompleted: true,
        }),
      });
      const logData = await res.json();
      if (!res.ok) throw new Error(logData.error || 'Không thể lưu ghi nhận.');
      await analyze(logData.observationId);
    } catch (cause) { setError({ message: cause.message || 'Có lỗi xảy ra.' }); setPhase('idle'); }
  }

  if (!childId) return html`<div className="page"><${EmptyState} title="Chọn bé trước khi bắt đầu" text="Mỗi bé có nhật ký và gợi ý riêng.">
    <${LinkBtn} to="/children">Đến trang chọn bé<//><//></div>`;
  const name = activeChild?.name || 'bé';
  const savedButFailed = !!error?.observationId;
  const todayCount = (tracks || []).filter((t) => t.date === today).length;
  const aiPaused = shared.settings?.aiEnabled === false;
  const aiOff = !!shared.family?.aiOptOut;

  return html`<div className="page">
    <header className="page-head">
      <h1>Nhật ký của ${name}</h1>
      <p className="page-head__meta"><${Icon} name="calendar" />${fmtLongDate(today)} · Ghi bao nhiêu lần trong ngày cũng được.</p>
    </header>
    <${Seg} name="diary-view" label="Chế độ xem" className="tabs-switch diary-switch" value=${view} onChange=${setView}
      options=${[{ value: 'write', label: 'Viết mới' }, { value: 'history', label: tracks ? `Đã ghi (${tracks.length})` : 'Đã ghi' }]} />

    ${(aiPaused || aiOff) && html`<div className="status status--warn" role="status"><${Icon} name="info" /><div>
      <strong>${aiOff ? 'Ba mẹ đã tắt gợi ý AI' : 'Gợi ý AI đang tạm nghỉ'}</strong>
      <span>${aiOff ? 'Nhật ký vẫn được lưu như thường. Bật lại trong mục Quyền riêng tư và dữ liệu.' : 'Ba mẹ vẫn ghi nhật ký bình thường; gợi ý sẽ có khi hệ thống chạy lại.'}</span></div></div>`}
    ${error?.safety && html`<${EscalationAlert} severity="high" message=${error.safety.message} child=${activeChild} childId=${childId} date=${today} />`}

    <div className="diary" data-view=${view}>
      <div className="diary__write">
        <form className="log-form" onSubmit=${submit} noValidate aria-label="Ghi nhật ký mới">
          <section className="log-sec" aria-labelledby="sec-mood">
            <div className="log-sec__head"><span className="log-sec__icon"><${Icon} name="heart" /></span>
              <div><h2 id="sec-mood">${name} đang cảm thấy thế nào?</h2><p>Chọn gương mặt gần nhất với lúc này.</p></div></div>
            <div className="moods" role="radiogroup" aria-labelledby="sec-mood">
              ${MOODS.map((m) => html`<label key=${m.value} className="mood-opt">
                <input type="radio" id=${'mood-' + m.value} name="mood" value=${m.value} checked=${mood === m.value} onChange=${() => setMood(m.value)} />
                <span className="mood-opt__card"><span className="mood-opt__check"><${Icon} name="check" /></span><${Face} mood=${m.value} size=${48} /><span>${m.label}</span></span>
              </label>`)}
            </div>
          </section>

          <section className="log-sec" aria-labelledby="sec-sleep">
            <div className="log-sec__head"><span className="log-sec__icon"><${Icon} name="moon" /></span>
              <div><h2 id="sec-sleep">Giấc ngủ</h2><p>${prefill ? `Đã điền theo lần ghi lúc ${prefill}. Sửa nếu cần.` : 'Đêm qua con ngủ bao lâu?'}</p></div></div>
            <div className="sleep-ctl">
              <div className="sleep-ctl__row">
                <${Stepper} id="sleep-hours" label="Số giờ ngủ" value=${sleepHours} min=${3} max=${12} step=${0.5} format=${(v) => `${fmt1(v)} giờ`} onChange=${setSleepHours} />
                <input className="range" type="range" id="sleep-range" min="3" max="12" step="0.5" value=${sleepHours} aria-label="Số giờ ngủ" onChange=${(e) => setSleepHours(Number(e.target.value))} />
              </div>
              <${Seg} name="sleep-quality" label="Chất lượng giấc ngủ" value=${sleepQuality} options=${SLEEP_QUALITY} onChange=${setSleepQuality} />
            </div>
          </section>

          <section className="log-sec" aria-labelledby="sec-day">
            <div className="log-sec__head"><span className="log-sec__icon"><${Icon} name="users" /></span>
              <div><h2 id="sec-day">Trong ngày</h2><p>Để nguyên nếu mọi thứ như thường lệ.</p></div></div>
            <div className="log-row"><span className="log-row__label" id="lbl-social">Tương tác với mọi người</span>
              <${Seg} name="social" label="Tương tác với mọi người" value=${social} options=${LEVELS} onChange=${setSocial} /></div>
            <div className="log-row"><span className="log-row__label" id="lbl-focus">Khả năng tập trung</span>
              <${Seg} name="focus" label="Khả năng tập trung" value=${focus} options=${LEVELS} onChange=${setFocus} /></div>
            <div className="log-row"><span className="log-row__label">Ăn uống</span>
              <${Seg} name="meal" label="Ăn uống" cols=${2} value=${ateNormally ? 'yes' : 'no'} onChange=${(v) => setAteNormally(v === 'yes')}
                options=${[{ value: 'yes', label: 'Bình thường' }, { value: 'no', label: 'Chưa bình thường' }]} />
              ${!ateNormally && html`<div className="field"><label className="field__label" htmlFor="meal-notes">Ghi chú bữa ăn</label>
                <textarea id="meal-notes" className="textarea" rows="2" value=${mealNotes} onChange=${(e) => setMealNotes(e.target.value)} placeholder="Ví dụ: Chỉ ăn bánh gạo, từ chối cơm..."></textarea></div>`}
            </div>
          </section>

          <section className="log-sec" aria-labelledby="sec-melt">
            <div className="log-sec__head"><span className="log-sec__icon"><${Icon} name="storm" /></span>
              <div><h2 id="sec-melt">Meltdown</h2><p>Cơn mất kiểm soát cảm xúc hoặc hành vi của con.</p></div></div>
            <${Seg} name="melt" label="Có xảy ra meltdown không?" cols=${2} value=${meltdown ? 'yes' : 'no'} onChange=${(v) => setMeltdown(v === 'yes')}
              options=${[{ value: 'no', label: 'Không có' }, { value: 'yes', label: 'Có xảy ra' }]} />
            ${meltdown && html`<div className="melt-details">
              <div className="log-row"><span className="log-row__label">Số lần</span>
                <${Stepper} id="melt-count" label="Số lần meltdown" value=${meltdownCount} min=${1} max=${20} format=${(v) => `${v} lần`} onChange=${setMeltdownCount} /></div>
              <div className="field">
                <label className="field__label" htmlFor="melt-trigger">Điều gì có thể đã gây ra?</label>
                <input id="melt-trigger" className="input" value=${meltdownTrigger} onChange=${(e) => setMeltdownTrigger(e.target.value)} placeholder="Ví dụ: Đồ ăn không đúng vị" />
                <div className="trigger-chips" aria-label="Chọn nhanh">${TRIGGER_CHIPS.map((t) => html`<button key=${t} type="button" className="trigger-chip"
                  aria-pressed=${meltdownTrigger === t} onClick=${() => setMeltdownTrigger(meltdownTrigger === t ? '' : t)}>${t}</button>`)}</div>
              </div>
            </div>`}
          </section>

          <section className="log-sec" aria-labelledby="sec-note">
            <div className="log-sec__head"><span className="log-sec__icon"><${Icon} name="pencil" /></span>
              <div><h2 id="sec-note">Ghi chú thêm</h2><p>Không bắt buộc, nhưng rất có ích cho gợi ý.</p></div></div>
            <textarea id="free-note" className="textarea" aria-labelledby="sec-note" value=${note} onChange=${(e) => setNote(e.target.value)}
              placeholder="Điều gì vừa xảy ra? Có tác nhân nào đáng chú ý không?"></textarea>
          </section>

          <div className="save-bar">
            ${error && html`<div className="form-error" role="alert"><${Icon} name="info" /><div className="form-error__body">
              <span>${savedButFailed ? `Nhật ký đã được lưu. ${error.message}` : error.message}</span></div></div>`}
            ${savedButFailed && error.code !== 'AI_OFF'
              ? html`<${Btn} size="lg" block onClick=${() => { setError(null); analyze(error.observationId); }}><${Icon} name="refresh" />Thử phân tích lại<//>`
              : html`<${Btn} type="submit" size="lg" block disabled=${phase !== 'idle'}>${phase !== 'idle' ? 'Đang lưu...' : aiPaused || aiOff ? 'Lưu nhật ký' : 'Lưu & nhận gợi ý'}<${Icon} name=${aiPaused || aiOff ? 'check' : 'sparkle'} /><//>`}
            <p className="save-bar__meta">${savedButFailed ? 'Không cần ghi lại. EchoKid sẽ phân tích lần ghi vừa lưu.' : `Ghi cho ${name} · hôm nay${todayCount ? ` đã có ${todayCount} lần ghi` : ''}`}</p>
          </div>
        </form>
      </div>

      <aside className="diary__history" aria-label="Nhật ký đã ghi">
        ${latest && html`<section className="card mini-rec">
          <p className="kicker kicker--teal"><${Icon} name="sparkle" />Gợi ý gần nhất</p>
          <h3>${latest.recommendation.recommendation.title}</h3>
          <p className="mini-rec__meta"><${SeverityPill} level=${latest.recommendation.severityLevel} />${relDay(latest.observation.date)}, ${latest.observation.time}</p>
          <${LinkBtn} to="/recommendation" params=${{ childId, observationId: latest.recommendation.logId }} variant="secondary" size="sm">Xem & phản hồi<//>
        </section>`}
        <${DiaryHistory} tracks=${tracks} days=${days} setDays=${setDays} childId=${childId} />
      </aside>
    </div>
    ${phase !== 'idle' && html`<${Analyzing} phase=${phase} name=${name} savedAt=${savedAt} />`}
  </div>`;
}

function DiaryHistory({ tracks, days, setDays, childId }) {
  if (!tracks) return html`<div className="history"><${Skel} h=${24} w="50%" /><${Skel} h=${110} /><${Skel} h=${110} /></div>`;
  const groups = [];
  for (const t of tracks) {
    const g = groups[groups.length - 1];
    if (g && g.date === t.date) g.items.push(t); else groups.push({ date: t.date, items: [t] });
  }
  return html`<section className="history">
    <div className="history__head"><h2>Các trang nhật ký</h2><span className="muted">${tracks.length} lần ghi · ${days} ngày gần nhất</span></div>
    ${!tracks.length && html`<p className="history__empty">Chưa có ghi nhận. Khoảnh khắc đầu tiên sẽ xuất hiện tại đây.</p>`}
    ${groups.map((g) => html`<div className="day-group" key=${g.date}>
      <h3 className="day-group__head">${relDay(g.date)}<span>${g.items.length} lần</span></h3>
      ${g.items.map((t) => {
        const signals = entrySignals(t);
        return html`<article className="entry" key=${t.id}>
          <${Face} mood=${t.mood} size=${40} />
          <div className="entry__body">
            <div className="entry__top"><span className="entry__time">${t.time}</span><span className="entry__mood">${MOOD_LABEL[t.mood]}</span>
              ${signals.length > 0 && html`<span className="pill pill--warn">Cần theo dõi</span>`}</div>
            <p className="entry__facts">Ngủ ${fmt1(t.sleep.hours)} giờ · tương tác ${LEVEL_LABEL[t.socialInteraction]} · tập trung ${LEVEL_LABEL[t.focus]}</p>
            ${(signals.length > 0 || t.meal?.ateNormally === false) && html`<div className="entry__chips">
              ${signals.map((s) => html`<span key=${s} className="chip chip--warn">${s}</span>`)}
              ${t.meal?.ateNormally === false && html`<span className="chip">Ăn uống chưa bình thường</span>`}</div>`}
            ${t.freeTextNote && html`<p className="entry__note">“${t.freeTextNote}”</p>`}
            <${Link} to="/recommendation" params=${{ childId, observationId: t.id }} className="entry__link">Xem gợi ý<${Icon} name="chevronRight" /><//>
          </div>
        </article>`;
      })}
    </div>`)}
    ${days < 30 && html`<${Btn} variant="secondary" onClick=${() => setDays(30)}>Xem 30 ngày<//>`}
  </section>`;
}

function Analyzing({ phase, name, savedAt }) {
  const [step, setStep] = useState(1);
  useEffect(() => {
    if (phase !== 'analyzing') return undefined;
    setStep(2);
    const t = setTimeout(() => setStep(3), 700);
    return () => clearTimeout(t);
  }, [phase]);
  const items = [`Lưu nhật ký lúc ${savedAt}`, 'Đối chiếu với 30 ngày gần nhất', `Chọn một hoạt động phù hợp với ${name}`];
  return html`<div className="analyzing" role="status" aria-live="polite">
    <div className="analyzing__card">
      <h2>EchoKid đang đọc nhật ký</h2>
      <ol className="analyzing__steps">${items.map((label, i) => {
        const state = i + 1 < step ? 'is-done' : i + 1 === step ? 'is-active' : '';
        return html`<li key=${i} className=${state}><span className="analyzing__dot">${state === 'is-done' && html`<${Icon} name="check" />`}</span>${label}</li>`;
      })}</ol>
      <p className="muted">Thường chỉ mất vài giây.</p>
    </div>
  </div>`;
}

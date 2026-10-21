/* Advice for one diary entry (app/recommendation/page.tsx). */
'use strict';

/* ---------- Advice (app/recommendation/page.tsx) ---------- */
function RecommendationPage() {
  const { route, activeChild } = useApp();
  const { childId, observationId } = route.params;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState(undefined);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deferred, setDeferred] = useState(false);
  const [done, setDone] = useState({});
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    if (!childId) return undefined;
    let alive = true;
    const q = new URLSearchParams({ childId });
    if (observationId) q.set('observationId', observationId);
    getJSON(`/api/recommendation?${q}`).then((p) => {
      if (!alive) return;
      setData(p);
      return getJSON(`/api/feedback?childId=${encodeURIComponent(childId)}&observationId=${encodeURIComponent(p.recommendation.logId)}`)
        .then((f) => alive && setFeedback(f.feedback[f.feedback.length - 1] || null));
    }).catch((e) => alive && setError(e.status === 404 ? 'none' : e.message || 'Không thể tải gợi ý.'));
    return () => { alive = false; };
  }, [childId, observationId]);

  if (!childId) return html`<div className="page"><${EmptyState} icon="sparkle" title="Chưa chọn bé" text="Chọn hồ sơ để xem gợi ý gần nhất của bé.">
    <${LinkBtn} to="/children">Chọn hồ sơ bé<//><//></div>`;
  if (error === 'none') return html`<div className="page"><${EmptyState} icon="sparkle" title="Chưa có gợi ý nào" text="Ghi nhật ký lần đầu để EchoKid gợi ý một hoạt động phù hợp với bé.">
    <${LinkBtn} to="/daily-log" params=${{ childId }}>Ghi nhật ký<//><//></div>`;
  if (error) return html`<div className="page"><${EmptyState} title="Chưa thể mở gợi ý" text=${error}>
    <${LinkBtn} to="/dashboard" params=${{ childId }}>Quay lại hôm nay<//><//></div>`;
  if (!data) return html`<div className="page rec"><${Skel} h=${28} w="45%" /><${Skel} h=${64} /><${Skel} h=${160} /><${Skel} h=${420} /></div>`;

  const result = data.recommendation;
  const obs = data.observation;
  const r = result.recommendation;
  const name = activeChild?.name || 'bé';
  const escalate = result.escalation.shouldSuggestExpert;
  const doneCount = r.steps.filter((_, i) => done[i]).length;
  const fbState = feedback ? 'existing' : saved ? 'saved' : deferred ? 'deferred' : 'ask';
  const fbCopy = {
    existing: ['Ba mẹ đã phản hồi hoạt động này', feedback ? `${feedback.wasHelpful ? 'Hữu ích' : 'Chưa hữu ích'} · ${feedback.rating ?? '–'}/5 sao · “${feedback.content}”` : ''],
    saved: ['Cảm ơn bạn đã chia sẻ kết quả', 'Phản hồi đã được ghi nhận để các gợi ý sau phù hợp hơn với bé.'],
    deferred: ['Bạn có thể quay lại sau khi thực hiện', 'EchoKid chỉ ghi nhận phản hồi khi bạn đã thử hoạt động cùng bé. Gợi ý này luôn nằm trong nhật ký.'],
    ask: ['Bạn đã thực hiện gợi ý này chưa?', 'Phản hồi của bạn giúp EchoKid hiểu bé hơn và cải thiện những gợi ý tiếp theo.'],
  }[fbState];

  return html`<div className="page rec">
    <header className="page-head">
      <${Link} to="/dashboard" params=${{ childId }} className="back-link"><${Icon} name="chevronLeft" />Hôm nay<//>
      <h1>Gợi ý cho ${name}</h1>
      <p className="page-head__meta"><${Face} mood=${obs.mood} size=${24} />Từ nhật ký lúc ${obs.time}, ${['Hôm nay', 'Hôm qua'].includes(relDay(obs.date)) ? relDay(obs.date).toLowerCase() : fmtFullDate(obs.date)} · ${MOOD_LABEL[obs.mood]}</p>
    </header>

    ${escalate
      ? html`<${EscalationAlert} severity=${result.severityLevel} message=${result.escalation.message} child=${activeChild} childId=${childId}
          date=${obs.date} onReport=${() => setReportOpen(true)} />`
      : html`<${SeverityStatus} level=${result.severityLevel} />`}

    <section className="card understand" aria-labelledby="understand-title">
      <h2 className="card-title" id="understand-title"><${Icon} name="eye" />Điều EchoKid nhận thấy</h2>
      <p className="understand__summary">${result.contextSummary}</p>
      <figure className="note-from">
        <blockquote>${result.empathyMessage}</blockquote>
        <figcaption><${Icon} name="heart" />Lời nhắn cho ba mẹ</figcaption>
      </figure>
    </section>

    <section className="card activity" aria-labelledby="activity-title">
      <div className="activity__head">
        <p className="kicker kicker--teal"><${Icon} name="sparkle" />Việc nên làm ngay</p>
        <h2 className="activity__title" id="activity-title">${r.title}</h2>
        <div className="activity__facts">
          <span className="pill pill--neutral"><${Icon} name="timer" />${r.durationMinutes} phút</span>
          <span className="pill pill--neutral"><${Icon} name="home" />Làm tại nhà</span>
        </div>
      </div>
      <div className="steps-block">
        <div className="steps-head"><h3>Các bước thực hiện</h3><span>${doneCount}/${r.steps.length} bước</span></div>
        <ol className="steps">${r.steps.map((s, i) => html`<li className="step" key=${i}>
          <input type="checkbox" id=${'step-' + i} checked=${!!done[i]} onChange=${() => setDone((d) => ({ ...d, [i]: !d[i] }))} />
          <label htmlFor=${'step-' + i}><span className="step__num">${done[i] ? html`<${Icon} name="check" />` : i + 1}</span><span className="step__text">${s}</span></label>
        </li>`)}</ol>
        <p className="steps-hint">Chạm vào từng bước khi làm xong để dễ theo dõi trong lúc chơi cùng con.</p>
      </div>
      <div className="why"><strong><${Icon} name="info" />Vì sao là hoạt động này?</strong><p>${r.whyThis}</p></div>
      ${r.references?.length > 0 && html`<details className="sources">
        <summary><${Icon} name="bookOpen" />Nguồn tham khảo (${r.references.length})</summary>
        <ul>${r.references.map((ref) => html`<li className="source" key=${ref.key}><b>${ref.title}</b><small>${ref.organization}</small><p>${ref.note}</p></li>`)}</ul>
      </details>`}
    </section>

    <section className="card feedback" aria-labelledby="fb-cta-title">
      <div>
        <p className="kicker">Phản hồi từ phụ huynh</p>
        <h2 id="fb-cta-title">${fbCopy[0]}</h2>
        <p>${fbCopy[1]}</p>
      </div>
      ${(fbState === 'ask' || fbState === 'deferred') && html`<div className="feedback__actions">
        <${Btn} onClick=${() => { setDeferred(false); setSheetOpen(true); }}>Đã thực hiện<//>
        ${fbState === 'ask' && html`<${Btn} variant="secondary" onClick=${() => setDeferred(true)}>Chưa thực hiện<//>`}
      </div>`}
    </section>

    <p className="disclaimer"><${Icon} name="shield" />${result.disclaimer}</p>

    <${FeedbackSheet} open=${sheetOpen} onClose=${() => setSheetOpen(false)} childId=${childId} childName=${name}
      observationId=${result.logId} title=${r.title} onSaved=${() => { setSaved(true); setSheetOpen(false); }} />
    <${ReportSheet} open=${reportOpen} onClose=${() => setReportOpen(false)} child=${activeChild} />
  </div>`;
}

/* Operations pages: AI controls (kill switch, model, budget, safety keywords), advice quality, system health and
   parent-facing announcements. */
'use strict';

/* ---------- AI controls ---------- */
const AI_KEYS = ['model', 'thinking', 'historySent', 'dailyBudget', 'budgetAlertAt', 'budgetAction', 'perFamilyLimit', 'safetyWords'];
const pickAi = (s) => Object.fromEntries(AI_KEYS.map((k) => [k, Array.isArray(s[k]) ? s[k].slice() : s[k]]));
const perCallCost = (d) => tokenCost({ input: TOKEN_MODEL.baseInput + TOKEN_MODEL.perHistoryEntry * d.historySent, output: TOKEN_MODEL.visibleOutput, thinking: THINKING_LEVELS.find((t) => t.value === d.thinking).tokens }, listedPrice(d.model, 'now')).total;

function PauseModal({ open, onClose }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (open) { setReason(''); setError(''); } }, [open]);
  async function submit(e) {
    e.preventDefault(); setBusy(true);
    const r = await send('/api/admin/ai/pause', 'POST', { reason }, { quiet: true });
    setBusy(false);
    if (r.ok) { toast('Đã tạm dừng gợi ý AI.'); onClose(); } else setError(r.body?.error || 'Chưa tạm dừng được.');
  }
  return html`<${Modal} open=${open} onClose=${onClose} busy=${busy} tone="crit" title="Tạm dừng gợi ý AI cho mọi gia đình" intro="Có hiệu lực ngay. Ba mẹ vẫn ghi nhật ký bình thường, chỉ không nhận gợi ý cho tới khi bật lại."
    footer=${html`<${Button} variant="quiet" onClick=${onClose} disabled=${busy}>Hủy<//><${Button} type="submit" form="pause-form" variant="danger" icon="pause" busy=${busy}>Tạm dừng ngay<//>`}>
    <form id="pause-form" className="space-y-4" onSubmit=${submit}>
      <${Field} label="Lý do" htmlFor="pause-reason" error=${error} hint="Cả nhóm thấy lý do này ở thanh trên cùng và trong nhật ký kiểm tra.">
        <${Input} id="pause-reason" value=${reason} onChange=${(e) => setReason(e.target.value)} placeholder="Ví dụ: Gemini trả lời sai định dạng hàng loạt" /><//>
      <div><p className="mb-1.5 text-[13px] font-semibold text-ink">Ba mẹ sẽ thấy</p>
        <div className="flex gap-2.5 rounded-xl border border-warn-line bg-warn-tint px-3.5 py-3 text-[13px] leading-relaxed text-ink"><${Icon} name="info" className="mt-0.5 size-4 text-warn" />${PARENT_PAUSE_TEXT}</div></div>
      <p className="text-[12.5px] text-ink-3">Từ khóa an toàn vẫn được kiểm tra khi AI tạm dừng, nên ca nguy cơ an toàn vẫn được mở.</p>
    </form>
  <//>`;
}

function AiPage({ me }) {
  const q = useApi('/api/admin/settings');
  const m = useApi('/api/admin/metrics?range=30');
  const [draft, setDraft] = useState(null);
  const [note, setNote] = useState('');
  const [newWord, setNewWord] = useState('');
  const [probe, setProbe] = useState('Hôm nay bé dap dau vao tuong khi bi tat tivi');
  const [pausing, setPausing] = useState(false);
  const [busy, setBusy] = useState('');
  useEffect(() => { if (q.data && !draft) setDraft(pickAi(q.data)); }, [q.data]);
  const s = q.data;
  const saved = s && pickAi(s);
  const changed = draft && saved ? AI_KEYS.filter((k) => JSON.stringify(draft[k]) !== JSON.stringify(saved[k])) : [];
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  async function save() {
    setBusy('save');
    const body = Object.fromEntries(changed.map((k) => [k, draft[k]]));
    const r = await send('/api/admin/settings/ai', 'PATCH', { ...body, reason: note });
    setBusy('');
    if (r.ok) { setDraft(pickAi(r.body)); setNote(''); toast('Đã lưu cài đặt AI. Áp dụng cho lượt gọi tiếp theo.'); }
  }
  async function resume() { setBusy('resume'); const r = await send('/api/admin/ai/resume', 'POST'); setBusy(''); if (r.ok) toast('Đã bật lại gợi ý AI.'); }
  const addWord = (e) => {
    e.preventDefault();
    const w = newWord.trim().toLowerCase();
    if (w.length < 2) return;
    if (draft.safetyWords.some((x) => fold(x) === fold(w))) { toast('Từ khóa này đã có trong danh sách.', 'crit'); return; }
    set('safetyWords', [...draft.safetyWords, w]); setNewWord('');
  };
  if (!s || !draft) return html`<${Fragment}><${PageHeader} title="Điều khiển AI" /><${Loaded} q=${q} skeleton=${html`<div className="space-y-5"><${Skel} h=${120} /><${Skel} h=${320} /></div>`}>${() => null}<//><//>`;
  const calls30 = m.data ? (m.data.current.billedCalls / m.data.current.days) * 30 : null;
  const before = perCallCost(saved), after = perCallCost(draft);
  const spendShare = s.spendToday / draft.dailyBudget;
  const hits = safetyMatches(probe, draft.safetyWords);
  return html`<${Fragment}>
    <${PageHeader} title="Điều khiển AI" sub="Các cài đặt ở đây đổi cách EchoKid gọi Gemini cho mọi gia đình. Mọi thay đổi được ghi vào nhật ký kiểm tra." />
    <div className="space-y-5 pb-24">
      ${s.aiEnabled ? html`<${Card} className="flex flex-wrap items-center gap-4 p-5">
          <span className="relative grid size-12 place-items-center rounded-2xl bg-good-tint text-good"><${Icon} name="sparkle" className="size-6" /><span className="absolute right-1.5 top-1.5 size-2.5 rounded-full bg-good ring-2 ring-good-tint motion-safe:animate-pulse"></span></span>
          <div className="min-w-0 flex-1 basis-52"><p className="text-lg font-bold text-ink">Gợi ý AI đang chạy</p><p className="text-[13px] text-ink-2">${modelById(s.model).label} · lời nhắc ${s.promptVersion} · suy luận ${THINKING_LEVELS.find((t) => t.value === s.thinking).label.toLowerCase()}</p></div>
          <${Button} variant="secondary" icon="pause" onClick=${() => setPausing(true)}>Tạm dừng gợi ý AI<//>
        <//>`
        : html`<${Card} className="flex flex-wrap items-center gap-4 border-warn-line bg-warn-tint p-5">
          <span className="grid size-12 place-items-center rounded-2xl bg-surface text-warn"><${Icon} name="pause" className="size-6" /></span>
          <div className="min-w-0 flex-1 basis-52"><p className="text-lg font-bold text-ink">Gợi ý AI đang tạm dừng</p><p className="text-[13px] text-ink-2">Từ ${fmtDT(s.pausedAt)} bởi ${s.pausedBy} · ${s.pauseReason}</p></div>
          <${Button} icon="play" busy=${busy === 'resume'} onClick=${resume}>Bật lại<//>
        <//>`}

      <div className="grid gap-5 xl:grid-cols-2">
        <${Card}>
          <${CardHead} icon="sparkle" title="Mô hình và lời nhắc" sub="Đổi mô hình thật ở đây. Trang Chi phí AI chỉ dùng để tính thử." />
          <div className="space-y-5 p-5">
            <${Field} label="Mô hình Gemini" htmlFor="ai-model" hint=${modelById(draft.model).note}>
              <${Select} id="ai-model" value=${draft.model} onChange=${(e) => set('model', e.target.value)}>
                ${GEMINI_MODELS.map((x) => html`<option key=${x.id} value=${x.id}>${x.label} · ${usd(x.prices.now.input)} / ${usd(x.prices.now.output)} mỗi 1 triệu token</option>`)}
              <//>
            <//>
            ${draft.model !== saved.model && html`<${Callout} tone="warn" title="Chạy thử trước khi đổi">So 50 nhật ký mẫu giữa hai mô hình ở trang Chất lượng gợi ý. Mô hình rẻ hơn có thể chọn sai mức độ hoặc trả JSON thiếu trường.<//>`}
            <${Field} label="Mức suy luận (thinking)" hint="Token suy luận tính theo giá đầu ra. Mức thấp nhanh và rẻ hơn, cần thử lại chất lượng gợi ý.">
              <${Segmented} label="Mức suy luận" value=${draft.thinking} onChange=${(v) => set('thinking', v)} options=${THINKING_LEVELS.map((t) => ({ value: t.value, label: `${t.label} · ~${fmtInt(t.tokens)}` }))} />
            <//>
            <${Field} label="Số lần ghi cũ gửi kèm" hint="Lời nhắc kèm các lần ghi gần nhất để AI so sánh xu hướng.">
              <${Segmented} label="Số lần ghi cũ gửi kèm" value=${draft.historySent} onChange=${(v) => set('historySent', Number(v))} options=${[5, 10, 20].map((v) => ({ value: v, label: `${v} lần` }))} />
            <//>
            <div className="rounded-xl bg-surface-2 px-4 py-3">
              <p className="text-[13px] text-ink-3">Ước tính mỗi lượt gọi</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-ink">${usd(after, 4)}${changed.some((k) => ['model', 'thinking', 'historySent'].includes(k)) && html` <span className="text-sm font-medium text-ink-3">từ ${usd(before, 4)}</span> <span className=${cx('text-sm font-semibold', after <= before ? 'text-good' : 'text-crit')}>${after <= before ? '−' : '+'}${pct(Math.abs(after - before) / before, 0)}</span>`}</p>
              ${calls30 != null && html`<p className="text-[13px] text-ink-3">≈ ${usd(after * calls30)} mỗi 30 ngày với ${fmtInt(calls30)} lượt gọi</p>`}
            </div>
            <p className="text-[13px] leading-relaxed text-ink-3"><${Icon} name="file" className="mr-1.5 inline size-4 align-[-3px]" />Lời nhắc đang dùng: <b className="font-semibold text-ink">${s.promptVersion}</b> từ ${fmtFullDate(s.promptDate)}.${me.perms.includes('quality') && html` <a className="font-semibold text-primary-ink hover:underline" href="#/quality">So sánh các phiên bản</a>`}</p>
          </div>
        <//>

        <div className="space-y-5">
          <${Card}>
            <${CardHead} icon="coin" title="Ngân sách mỗi ngày" sub="Tính theo giờ Việt Nam, đặt lại lúc 0:00." />
            <div className="space-y-5 p-5">
              <div><div className="mb-1.5 flex items-baseline justify-between text-[13px]"><span className="text-ink-2">Hôm nay đã dùng</span><span className="font-semibold tabular-nums text-ink">${usd(s.spendToday)} / ${usd(draft.dailyBudget)}</span></div>
                <${Meter} value=${spendShare} tone=${spendShare >= 1 ? 'crit' : spendShare >= draft.budgetAlertAt ? 'warn' : 'primary'} label="Phần ngân sách hôm nay đã dùng" /></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <${Field} label="Ngân sách · US$ mỗi ngày" htmlFor="ai-budget"><${Input} id="ai-budget" type="number" min="0.5" step="0.5" value=${draft.dailyBudget} onChange=${(e) => set('dailyBudget', Math.max(0, Number(e.target.value)))} /><//>
                <${Field} label="Báo khi đã dùng"><${Segmented} label="Báo khi đã dùng" value=${draft.budgetAlertAt} onChange=${(v) => set('budgetAlertAt', Number(v))} options=${[0.5, 0.8, 0.9].map((v) => ({ value: v, label: pct(v, 0) }))} /><//>
              </div>
              <${Field} label="Khi hết ngân sách" hint=${draft.budgetAction === 'pause' ? 'Gợi ý tạm dừng tới 0:00; ba mẹ vẫn ghi được nhật ký và từ khóa an toàn vẫn chạy.' : 'Chỉ gửi báo động; AI vẫn chạy và tiếp tục tính tiền.'}>
                <${Segmented} label="Khi hết ngân sách" value=${draft.budgetAction} onChange=${(v) => set('budgetAction', v)} options=${[{ value: 'alert', label: 'Chỉ báo động' }, { value: 'pause', label: 'Tạm dừng AI' }]} />
              <//>
            </div>
          <//>
          <${Card}>
            <${CardHead} icon="users" title="Giới hạn mỗi gia đình" sub="Chặn một tài khoản hoặc một lỗi lặp vô hạn tiêu hết ngân sách." />
            <div className="flex flex-wrap items-end gap-4 p-5">
              <${Field} className="w-44" label="Lượt gọi AI mỗi ngày" htmlFor="ai-limit"><${Input} id="ai-limit" type="number" min="1" step="1" value=${draft.perFamilyLimit} onChange=${(e) => set('perFamilyLimit', Math.max(1, Math.round(Number(e.target.value) || 1)))} /><//>
              <p className="min-w-0 flex-1 basis-56 text-[13px] leading-relaxed text-ink-2">7 ngày qua, gia đình dùng nhiều nhất gọi <b className="text-ink">${s.limitHits.maxPerDay} lượt</b> trong một ngày. Với giới hạn đã lưu (${s.perFamilyLimit}), ${s.limitHits.families ? `${s.limitHits.families} gia đình đã bị chặn ${s.limitHits.familyDays} ngày.` : 'chưa gia đình nào bị chặn.'}</p>
            </div>
          <//>
        </div>
      </div>

      <${Card}>
        <${CardHead} icon="shield" title="Từ khóa an toàn" sub="Lưới dự phòng chạy trước khi gửi cho Gemini, kể cả khi AI tạm dừng. Không phân biệt dấu: “dap dau” khớp “đập đầu”. Khớp → lượt ghi ở mức Cần chú ý và mở ca P1." />
        <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <div>
            <ul className="flex flex-wrap gap-2" aria-label="Danh sách từ khóa">
              ${draft.safetyWords.map((w) => html`<li key=${w} className=${cx('inline-flex items-center gap-1 rounded-full border py-1 pl-3 pr-1 text-[13px] font-medium', hits.includes(w) ? 'border-crit-line bg-crit-tint text-crit' : 'border-line bg-surface-2 text-ink')}>
                ${w}<button type="button" className="grid size-6 place-items-center rounded-full text-ink-3 hover:bg-surface-3 hover:text-ink" aria-label=${`Bỏ "${w}"`} onClick=${() => set('safetyWords', draft.safetyWords.filter((x) => x !== w))}><${Icon} name="x" className="size-3.5" /></button></li>`)}
            </ul>
            <form className="mt-4 flex max-w-md gap-2" onSubmit=${addWord}>
              <${Input} aria-label="Thêm từ khóa" placeholder="Thêm từ khóa, ví dụ: tự cào" value=${newWord} onChange=${(e) => setNewWord(e.target.value)} />
              <${Button} type="submit" variant="secondary" icon="plus" disabled=${newWord.trim().length < 2}>Thêm<//>
            </form>
          </div>
          <div className="rounded-xl border border-line bg-surface-2/60 p-4">
            <${Field} label="Thử với một câu ghi chú" htmlFor="ai-probe"><${Textarea} id="ai-probe" className="min-h-[72px]!" value=${probe} onChange=${(e) => setProbe(e.target.value)} /><//>
            <p className=${cx('mt-3 flex items-start gap-1.5 text-[13px] font-medium', hits.length ? 'text-crit' : 'text-ink-3')} aria-live="polite">
              <${Icon} name=${hits.length ? 'alert' : 'checkCircle'} className="mt-px size-4" />${hits.length ? `Khớp “${hits.join('”, “')}”: sẽ mở ca P1.` : 'Không khớp từ khóa nào.'}</p>
          </div>
        </div>
      <//>
    </div>

    ${changed.length > 0 && html`<div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 py-3 shadow-pop backdrop-blur lg:left-[268px]">
      <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-3">
        <p className="text-sm font-semibold text-ink"><${Icon} name="pencil" className="mr-1.5 inline size-4 text-ink-3" />${changed.length} thay đổi chưa lưu</p>
        <${Input} className="h-9! min-w-0 flex-1 basis-48" aria-label="Ghi chú cho thay đổi" placeholder="Ghi chú cho nhóm (không bắt buộc)" value=${note} onChange=${(e) => setNote(e.target.value)} />
        <${Button} variant="quiet" onClick=${() => setDraft(pickAi(s))} disabled=${!!busy}>Bỏ thay đổi<//>
        <${Button} icon="check" busy=${busy === 'save'} onClick=${save}>Lưu thay đổi<//>
      </div>
    </div>`}
    <${PauseModal} open=${pausing} onClose=${() => setPausing(false)} />
  <//>`;
}

/* ---------- advice quality ---------- */
function Stars({ value }) {
  return html`<span className="inline-flex items-center gap-0.5" role="img" aria-label=${`${value} trên 5 sao`}>${[1, 2, 3, 4, 5].map((i) => html`<${Icon} key=${i} name="star" className=${cx('size-3.5', i <= value ? 'fill-current text-warn' : 'text-line-strong')} />`)}</span>`;
}
function ReviewItem({ r, canReview }) {
  const [tags, setTags] = useState(r.tags);
  const [busy, setBusy] = useState(false);
  const toggle = (t) => setTags((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]));
  const done = async () => { setBusy(true); const res = await send(`/api/admin/quality/${r.id}`, 'PATCH', { tags }); setBusy(false); if (res.ok) toast('Đã rà soát. Nhãn này được dùng khi sửa lời nhắc.'); };
  return html`<li className="px-5 py-4">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <${Stars} value=${r.rating} /><span className="text-sm font-semibold text-ink">${r.title}</span>
      <${Pill} tone=${r.severity === 'high' ? 'crit' : r.severity === 'moderate' ? 'warn' : 'neutral'}>${{ high: 'Cần chú ý', moderate: 'Cần hỗ trợ', mild: 'Ổn định' }[r.severity]}<//>
      <span className="text-xs text-ink-3">${r.id} · bé ${r.band} · lời nhắc ${r.version} · ${ago(r.at)}</span>
    </div>
    <blockquote className="mt-2 border-l-2 border-line-strong pl-3 text-sm leading-relaxed text-ink-2">“${r.comment}”</blockquote>
    ${r.status === 'done'
      ? html`<p className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-3"><${Icon} name="check" className="size-3.5 text-good" />${r.reviewedBy} đã rà soát:${r.tags.map((t) => html`<${Pill} key=${t}>${t}<//>`)}</p>`
      : canReview && html`<div className="mt-3 flex flex-wrap items-center gap-1.5">
        ${REVIEW_TAGS.map((t) => html`<button key=${t} type="button" aria-pressed=${tags.includes(t)} onClick=${() => toggle(t)} className=${cx('rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors', tags.includes(t) ? 'border-primary bg-primary-tint text-primary-ink' : 'border-line text-ink-2 hover:bg-surface-2')}>${t}</button>`)}
        <${Button} size="xs" className="ml-auto" icon="check" disabled=${!tags.length} busy=${busy} onClick=${done}>Xong<//>
      </div>`}
  </li>`;
}

function QualityPage({ me }) {
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [status]);
  const q = useApi(`/api/admin/quality?status=${status}&page=${page}`);
  const m = useApi('/api/admin/metrics?range=30');
  const price = listedPrice(m.data?.model || CURRENT_MODEL, 'now');
  const c = m.data?.current;
  const canReview = me.perms.includes('review');
  return html`<${Fragment}>
    <${PageHeader} title="Chất lượng gợi ý" sub="Ba mẹ chấm sao và ghi phản hồi sau mỗi gợi ý. Trang này chỉ hiện gợi ý và lời phản hồi, không hiện nhật ký của bé." />
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <${Stat} icon="heart" label="Gợi ý được đánh giá hữu ích" value=${c ? pct(c.fbHelpful / Math.max(1, c.fbCount), 0) : '–'} sub=${c ? `${fmtInt(c.fbCount)} phản hồi trong 30 ngày` : ''} />
      <${Stat} icon="star" label="Mức phù hợp trung bình" value=${c ? `${fmt1(c.ratingSum / Math.max(1, c.fbCount))}/5` : '–'} sub="theo số sao ba mẹ chấm" />
      <${Stat} icon="message" label="Lượt ghi có phản hồi" value=${c ? pct(c.fbCount / Math.max(1, c.entries), 0) : '–'} sub="Ba mẹ thường bỏ qua bước này" />
      <${Stat} icon="server" label="JSON sai cấu trúc" value=${c ? pct(c.failures.AI_INVALID_RESPONSE / Math.max(1, c.calls)) : '–'} sub="Vẫn bị tính phí, ba mẹ phải thử lại" />
    </div>
    <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]">
      <${Card}>
        <${CardHead} icon="star" title="Gợi ý bị chấm 1–2 sao" sub=${canReview ? 'Gắn nhãn lý do để nhóm biết cần sửa lời nhắc ở đâu.' : 'Vai trò của bạn chỉ xem, không gắn nhãn được.'}
          actions=${html`<${Segmented} size="sm" label="Trạng thái rà soát" value=${status} onChange=${setStatus} options=${[{ value: 'pending', label: 'Chờ rà soát', count: q.data?.counts.pending }, { value: 'done', label: 'Đã xong', count: q.data?.counts.done }]} />`} />
        <${Loaded} q=${q} skeleton=${html`<div className="space-y-3 p-5">${[1, 2, 3].map((i) => html`<${Skel} key=${i} h=${110} />`)}</div>`}>${(data) => data.total === 0
          ? html`<${EmptyState} title="Không còn gợi ý nào chờ rà soát" text="Gợi ý bị chấm thấp sẽ xuất hiện ở đây." />`
          : html`<ul className="mt-3 divide-y divide-line border-t border-line">${data.items.map((r) => html`<${ReviewItem} key=${r.id} r=${r} canReview=${canReview} />`)}</ul>
            <${Pager} page=${data.page} pageSize=${data.pageSize} total=${data.total} onPage=${setPage} />`}<//>
      <//>
      <div className="min-w-0 space-y-5">
        <${Card}>
          <${CardHead} icon="file" title="Phiên bản lời nhắc" sub="So sánh trước khi đổi lời nhắc hoặc mô hình." />
          <${Loaded} q=${q}>${(data) => html`<${Table} className="mt-3" minWidth=${460} head=${['Phiên bản', 'Lượt gọi', 'Hữu ích', 'Sao', 'JSON sai', 'Mỗi lượt']}>
            ${data.versions.map((v) => html`<tr key=${v.version}>
              <td className=${TD}><span className="font-semibold">${v.version}</span>${v.version === data.current && html`<${Pill} tone="primary" className="ml-1.5">Đang dùng<//>`}<p className="text-xs text-ink-3">${fmtShortDate(v.from)}–${fmtShortDate(v.to)}</p></td>
              <td className=${cx(TD, 'tabular-nums')}>${fmtInt(v.calls)}</td><td className=${cx(TD, 'tabular-nums')}>${pct(v.helpful / Math.max(1, v.fb), 0)}</td>
              <td className=${cx(TD, 'tabular-nums')}>${fmt1(v.ratingSum / Math.max(1, v.fb))}</td><td className=${cx(TD, 'tabular-nums')}>${pct(v.invalid / Math.max(1, v.calls))}</td>
              <td className=${cx(TD, 'tabular-nums')}>${usd(tokenCost(v, price).total / Math.max(1, v.billed), 4)}</td></tr>`)}
          <//>`}<//>
        <//>
        <${Card}>
          <${CardHead} icon="sparkle" title="Hoạt động được gợi ý" sub="30 ngày qua" />
          <${Loaded} q=${m}>${(mm) => html`<${Table} className="mt-3" minWidth=${420} head=${['Hoạt động', 'Lần gợi ý', 'Hữu ích']}>
            ${mm.current.activities.map((a) => html`<tr key=${a.key}><td className=${TD}>${a.title}</td><td className=${cx(TD, 'tabular-nums')}>${fmtInt(a.count)}</td>
              <td className=${cx(TD, 'w-40')}><div className="flex items-center gap-2"><span className="w-10 text-right tabular-nums">${a.fb ? pct(a.helpful / a.fb, 0) : '–'}</span><${Meter} value=${a.fb ? a.helpful / a.fb : 0} label=${`Tỉ lệ hữu ích của ${a.title}`} /></div></td></tr>`)}
          <//>`}<//>
        <//>
      </div>
    </div>
  <//>`;
}

/* ---------- system health ---------- */
const BACKEND_TODO = [
  ['Ghi lại mỗi lượt gọi Gemini', 'Lưu usageMetadata (promptTokenCount, candidatesTokenCount, thoughtsTokenCount), thời gian chờ, mã lỗi và requestId vào collection aiCalls.'],
  ['Lưu yêu cầu chuyên gia', 'POST /api/expert ghi vào collection bookings; hiện ba mẹ thấy "đã gửi" nhưng không ai nhận được.'],
  ['Ca cảnh báo và nhật ký kiểm tra', 'Collection cases (gom theo gia đình, 72 giờ) và auditLog chỉ thêm, không sửa hoặc xóa được.'],
  ['Quyền điều hành từ phía máy chủ', 'Danh sách moderators với vai trò; mọi route /api/admin/* kiểm tra vai trò từ phiên NextAuth, không tin tham số trong URL.'],
  ['Cài đặt AI đọc lúc chạy', 'services/ai.service.ts đọc mô hình, mức suy luận, ngân sách và từ khóa an toàn từ settings thay vì hằng số.'],
  ['Giờ Việt Nam', 'Giờ ghi nhận đang lấy từ toISOString() (UTC), lệch 7 tiếng. Lưu mốc thời gian đầy đủ và quy đổi khi hiển thị.'],
  ['Giới hạn truy vấn Firestore', "Thêm where('observedAt', '>=', mốc) vào getObservations() thay vì tải toàn bộ nhật ký rồi lọc."],
];
const ERROR_CODES = { API_ERROR: { label: 'Gemini báo lỗi', tone: 'warn', billed: false }, AI_INVALID_RESPONSE: { label: 'JSON sai cấu trúc', tone: 'crit', billed: true } };

function AlertRules({ settings }) {
  const [f, setF] = useState(settings);
  const [busy, setBusy] = useState('');
  useEffect(() => setF(settings), [JSON.stringify(settings)]);
  const dirty = JSON.stringify(f) !== JSON.stringify(settings);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => { setBusy('save'); const r = await send('/api/admin/settings/alerts', 'PATCH', f); setBusy(''); if (r.ok) toast('Đã lưu ngưỡng báo động.'); };
  const test = async () => { setBusy('test'); const r = await send('/api/admin/settings/alerts/test', 'POST'); setBusy(''); if (r.ok) toast(r.body.message); };
  const row = (k, label, hint) => html`<div className="flex items-center gap-3 py-2"><${Switch} id=${`al-${k}`} checked=${f[k]} onChange=${(v) => set(k, v)} label=${label} /><label htmlFor=${`al-${k}`} className="flex-1 text-sm text-ink">${label}${hint && html`<span className="block text-xs text-ink-3">${hint}</span>`}</label></div>`;
  return html`<${Card}>
    <${CardHead} icon="bell" title="Ngưỡng báo động" sub="Gửi cho người đang trực, thay vì chỉ đổi màu ô số liệu." />
    <div className="space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <${Field} label="Tỉ lệ lỗi Gemini · %" htmlFor="al-err" hint="Trong 15 phút, khi có ít nhất 20 lượt gọi."><${Input} id="al-err" type="number" min="0.5" max="50" step="0.5" value=${f.errorRate} onChange=${(e) => set('errorRate', Number(e.target.value))} /><//>
        <${Field} label="Độ trễ P95 · giây" htmlFor="al-p95" hint="Ba mẹ chờ gợi ý lâu hơn mức này."><${Input} id="al-p95" type="number" min="1" max="60" step="0.5" value=${f.p95} onChange=${(e) => set('p95', Number(e.target.value))} /><//>
      </div>
      <div className="divide-y divide-line">
        ${row('p1', 'Có ca nguy cơ an toàn mới', 'Gửi ngay, kể cả ngoài giờ trực')}
        ${row('budget', 'Chi phí AI chạm mức báo động trong ngày')}
      </div>
      <fieldset><legend className="mb-2 text-[13px] font-semibold text-ink">Kênh nhận</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-1">${[['email', 'Email'], ['telegram', 'Telegram'], ['zalo', 'Zalo OA']].map(([k, l]) => html`<${Check} key=${k} checked=${f[k]} onChange=${(v) => set(k, v)}>${l}<//>`)}</div>
      </fieldset>
      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <${Button} icon="check" disabled=${!dirty} busy=${busy === 'save'} onClick=${save}>Lưu<//>
        <${Button} variant="secondary" icon="send" busy=${busy === 'test'} onClick=${test}>Gửi thử<//>
      </div>
    </div>
  <//>`;
}

function SystemPage({ range, setRange }) {
  const [code, setCode] = useState('all');
  const [term, setTerm] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);
  useEffect(() => setPage(1), [code, term]);
  const q = useApi(`/api/admin/errors?code=${code}&q=${encodeURIComponent(term)}&page=${page}`);
  const m = useApi(`/api/admin/metrics?range=${range}`);
  const e = q.data;
  const geminiWarn = e && e.hour.calls >= 20 && e.hour.rate * 100 > e.settings.errorRate;
  const status = [
    ['Gemini API', geminiWarn ? 'warn' : 'good', geminiWarn ? 'Lỗi tăng' : 'Hoạt động', e ? `${fmtInt(e.hour.errors)} lỗi / ${fmtInt(e.hour.calls)} lượt gọi trong 1 giờ` : ''],
    ['Firestore', 'good', 'Hoạt động', 'Độ trễ đọc bình thường'],
    ['Đăng nhập Google', 'good', 'Hoạt động', 'NextAuth phản hồi bình thường'],
  ];
  return html`<${Fragment}>
    <${PageHeader} title="Hệ thống và lỗi" sub="Lỗi khi gọi Gemini, Firestore và ngưỡng báo động. Mỗi lỗi có mã yêu cầu để lần lại khi ba mẹ báo “không nhận được gợi ý”."
      actions=${html`<${RangeFilter} range=${range} setRange=${setRange} />`} />
    <div className="mb-5 grid gap-3 md:grid-cols-3">${status.map(([name, tone, label, sub]) => html`<div key=${name} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
      <span className=${cx('size-2.5 shrink-0 rounded-full', tone === 'good' ? 'bg-good' : 'bg-warn')}></span>
      <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-ink">${name}</p><p className="truncate text-xs text-ink-3">${sub}</p></div>
      <${Pill} tone=${tone} icon=${tone === 'good' ? 'checkCircle' : 'alert'}>${label}<//></div>`)}</div>
    <${Loaded} q=${m} skeleton=${html`<div className="mb-5"><${Skel} h=${120} /></div>`}>${(mm) => {
      const c = mm.current;
      const d = deriveCosts(mm, listedPrice(mm.model, 'now'));
      const failTotal = c.failures.API_ERROR + c.failures.AI_INVALID_RESPONSE;
      const readsPerEntry = c.reads / Math.max(1, c.entries);
      const fixed = readsPerSession(Math.min(Math.max(0, (readsPerEntry - 38) / 9), (c.entries / Math.max(1, c.families) / c.days) * 30));
      return html`<div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <${Stat} label="Lượt gọi Gemini" value=${fmtInt(c.calls)} sub=${`${fmtInt(c.billedCalls)} có tính phí · ${fmtInt(c.calls - c.entries)} lượt thử lại`} />
        <${Stat} label="Độ trễ P95" value=${`${fmt1(c.latency.p95 / 1000)} giây`} tone=${c.latency.p95 / 1000 > (e?.settings.p95 ?? 5) ? 'warn' : ''} sub=${`P50 ${fmt1(c.latency.p50 / 1000)} giây`} />
        <${Stat} label="Lượt gọi lỗi" value=${fmtInt(failTotal)} tone=${failTotal / Math.max(1, c.calls) > 0.03 ? 'crit' : ''} sub=${`${pct(failTotal / Math.max(1, c.calls))} tổng lượt gọi`} />
        <${Stat} label="Lượt đọc Firestore mỗi lần ghi" value=${fmtInt(readsPerEntry)} tone="warn" sub=${`sau khi sửa truy vấn ≈ ${fmtInt(fixed)}`} />
        <${Stat} label="Chi phí Firestore" value=${usd(d.firestorePeriod)} sub=${`${fmtInt(c.reads / c.days)} lượt đọc mỗi ngày · miễn phí ${fmtInt(FIRESTORE.free.readsPerDay)}`} />
      </div>`;
    }}<//>
    <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      <${Card} className="min-w-0">
        <${CardHead} icon="server" title="Lỗi khi gọi Gemini · 7 ngày" sub=${e ? `${fmtInt(e.day.errors)} lỗi trong 24 giờ qua (${pct(e.day.rate)}).` : ''}
          actions=${e && html`<div className="w-40"><${MiniBars} values=${e.hourly.map((h) => h.count)} label="Số lỗi mỗi giờ trong 24 giờ qua" /><p className="mt-1 text-right text-[11px] text-ink-3">24 giờ qua, theo giờ</p></div>`} />
        <div className="flex flex-wrap items-center gap-3 p-4">
          <${Segmented} size="sm" label="Loại lỗi" value=${code} onChange=${setCode} options=${[{ value: 'all', label: 'Tất cả' }, ...Object.entries(ERROR_CODES).map(([k, v]) => ({ value: k, label: v.label }))]} />
          <${SearchBox} className="min-w-48 flex-1" value=${term} onChange=${setTerm} placeholder="Tìm mã yêu cầu hoặc mã gia đình" />
        </div>
        <${Loaded} q=${q} skeleton=${html`<div className="space-y-2 p-4">${[1, 2, 3, 4].map((i) => html`<${Skel} key=${i} h=${40} />`)}</div>`}>${(data) => data.total === 0 ? html`<${EmptyState} title="Không có lỗi nào khớp" />` : html`
          <${Table} minWidth=${820} head=${['Thời gian', 'Mã yêu cầu', 'Lỗi', 'Chi tiết', 'Thời gian chờ', 'Ba mẹ thử lại']}>
            ${data.items.map((x) => html`<${Fragment} key=${x.id}>
              <tr className="cursor-pointer hover:bg-surface-2/70" onClick=${() => setOpen(open === x.id ? null : x.id)} aria-expanded=${open === x.id}>
                <td className=${cx(TD, 'whitespace-nowrap text-[13px]')}>${fmtDT(x.at)}</td>
                <td className=${TD}><button type="button" className="inline-flex items-center gap-1 rounded font-mono text-[12.5px] text-ink hover:text-primary-ink" onClick=${(ev) => { ev.stopPropagation(); copyText(x.id, 'Đã chép mã yêu cầu'); }} title="Chép mã yêu cầu">${x.id}<${Icon} name="copy" className="size-3.5 text-ink-3" /></button></td>
                <td className=${TD}><${Pill} tone=${ERROR_CODES[x.code].tone}>${x.http} · ${ERROR_CODES[x.code].label}<//></td>
                <td className=${cx(TD, 'max-w-xs truncate text-[13px] text-ink-2')}>${x.detail}</td>
                <td className=${cx(TD, 'tabular-nums text-[13px]')}>${fmt1(x.ms / 1000)} giây</td>
                <td className=${cx(TD, 'text-[13px]')}>${x.retriedOk ? html`<span className="text-good">Thành công</span>` : html`<span className="text-ink-3">Không</span>`}</td>
              </tr>
              ${open === x.id && html`<tr className="bg-surface-2/50"><td colSpan="6" className="px-4 pb-4 pt-1">
                <${Facts} className="text-[13px]!" rows=${[['Route', html`<code className="font-mono">${x.route}</code>`], ['Gia đình', x.fam], ['Chi tiết', x.detail], ['Bị tính phí', ERROR_CODES[x.code].billed ? 'Có, token đã dùng vẫn bị tính' : 'Không']]} />
                ${x.raw && html`<pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-xl border border-line bg-surface p-3 font-mono text-xs text-ink-2">${x.raw}</pre>`}
              </td></tr>`}
            <//>`)}
          <//><${Pager} page=${data.page} pageSize=${data.pageSize} total=${data.total} onPage=${setPage} />`}<//>
      <//>
      <div className="min-w-0 space-y-5">
        ${e && html`<${AlertRules} settings=${e.settings} />`}
        ${e && html`<${Callout} tone="crit" icon="key" title=${`/api/test bị gọi ${e.testRoute.calls7d} lần trong 7 ngày, từ ${e.testRoute.ips} địa chỉ IP`}>Route này gọi Gemini mà không cần đăng nhập; lần gần nhất ${ago(e.testRoute.lastAt)}. Xóa route hoặc yêu cầu đăng nhập trước khi có gia đình thật.<//>`}
        <${Card}>
          <${CardHead} icon="checkCircle" title="Để trang này dùng số liệu thật" sub="Việc cần làm ở backend." />
          <ol className="space-y-3 p-5 text-sm">${BACKEND_TODO.map(([t, x], i) => html`<li key=${t} className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-bold text-ink-2">${i + 1}</span><div><p className="font-semibold text-ink">${t}</p><p className="mt-0.5 text-[13px] leading-snug text-ink-2">${x}</p></div></li>`)}</ol>
        <//>
      </div>
    </div>
  <//>`;
}

/* ---------- announcements to parents ---------- */
const ANN_STATE = { live: { label: 'Đang hiện', tone: 'good', icon: 'eye' }, scheduled: { label: 'Đã lên lịch', tone: 'info', icon: 'calendar' }, ended: { label: 'Đã kết thúc', tone: 'neutral', icon: 'check' } };
const toLocalInput = (ms) => { const d = new Date(ms); return `${localISODate(d)}T${timeHM(d)}`; };
const fromLocalInput = (v) => { const [d, t] = v.split('T'); const x = dateFromISO(d); const [h, mi] = t.split(':').map(Number); x.setHours(h, mi, 0, 0); return x.getTime(); };

function ParentBanner({ kind, title, body }) {
  const k = ANNOUNCE_KIND[kind];
  const box = { info: 'border-teal-tint bg-teal-tint', maintenance: 'border-warn-line bg-warn-tint', incident: 'border-crit-line bg-crit-tint' }[kind];
  return html`<div className=${cx('flex gap-2.5 rounded-2xl border px-3.5 py-3', box)}>
    <${Icon} name=${k.icon} className=${cx('mt-0.5 size-[18px]', TONE_TEXT[k.tone])} />
    <div className="min-w-0"><p className="text-[13px] font-bold text-ink">${title || 'Tiêu đề thông báo'}</p><p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-2">${body || 'Nội dung ba mẹ sẽ thấy ở đầu trang Hôm nay.'}</p></div>
  </div>`;
}

function AnnouncePage() {
  const q = useApi('/api/admin/announcements');
  const m = useApi('/api/admin/metrics?range=30');
  const quiet = m.data ? bestWindow(hourlyTotals(m.data.current.heat), 0, 23, 3, true).h : 2;
  const nextQuiet = () => { const d = new Date(); d.setHours(quiet, 0, 0, 0); if (d.getTime() < Date.now() + HOUR) d.setDate(d.getDate() + 1); return d.getTime(); };
  const [f, setF] = useState(() => ({ kind: 'maintenance', title: 'Bảo trì hệ thống', body: '', startsAt: toLocalInput(nextQuiet()), endsAt: toLocalInput(nextQuiet() + 2 * HOUR) }));
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const useQuiet = () => { const s = nextQuiet(); setF((x) => ({ ...x, startsAt: toLocalInput(s), endsAt: toLocalInput(s + 2 * HOUR) })); };
  async function publish(e) {
    e.preventDefault(); setBusy('create'); setError('');
    const r = await send('/api/admin/announcements', 'POST', { ...f, startsAt: fromLocalInput(f.startsAt), endsAt: fromLocalInput(f.endsAt) }, { quiet: true });
    setBusy('');
    if (r.ok) { toast(r.body.state === 'live' ? 'Thông báo đang hiện với ba mẹ.' : 'Đã lên lịch thông báo.'); setF((x) => ({ ...x, body: '' })); } else setError(r.body?.error || 'Chưa đăng được.');
  }
  const end = async (a) => { setBusy(a.id); const r = await send(`/api/admin/announcements/${a.id}/end`, 'POST'); setBusy(''); if (r.ok) toast(a.state === 'live' ? 'Đã gỡ thông báo.' : 'Đã hủy lịch.'); };
  return html`<${Fragment}>
    <${PageHeader} title="Thông báo tới phụ huynh" sub="Dải thông báo ở đầu trang Hôm nay của ứng dụng, cho bảo trì, sự cố hoặc thay đổi chính sách." />
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
      <${Card}>
        <${CardHead} icon="megaphone" title="Đã đăng và đã lên lịch" />
        <${Loaded} q=${q} skeleton=${html`<div className="p-5"><${Skel} h=${220} /></div>`}>${(data) => html`<ul className="mt-3 divide-y divide-line border-t border-line">
          ${data.items.map((a) => { const st = ANN_STATE[a.state]; return html`<li key=${a.id} className="flex flex-wrap items-start gap-4 px-5 py-4">
            <div className="min-w-0 flex-1 basis-72">
              <div className="flex flex-wrap items-center gap-2"><${Pill} tone=${ANNOUNCE_KIND[a.kind].tone} icon=${ANNOUNCE_KIND[a.kind].icon}>${ANNOUNCE_KIND[a.kind].label}<//><${Pill} tone=${st.tone} icon=${st.icon}>${st.label}<//></div>
              <p className="mt-2 text-sm font-semibold text-ink">${a.title}</p><p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">${a.body}</p>
              <p className="mt-1.5 text-xs text-ink-3">${fmtDT(a.startsAt)} → ${fmtDT(a.endedAt || a.endsAt)} · ${a.id} · ${a.createdBy}</p>
            </div>
            ${a.state !== 'ended' && html`<${Button} variant="secondary" size="sm" icon="x" busy=${busy === a.id} onClick=${() => end(a)}>${a.state === 'live' ? 'Gỡ ngay' : 'Hủy lịch'}<//>`}
          </li>`; })}
        </ul>`}<//>
      <//>
      <${Card} className="p-5">
        <h2 className="flex items-center gap-2 text-[15px] font-bold"><${Icon} name="plus" className="size-[18px] text-ink-3" />Thông báo mới</h2>
        <form className="mt-4 space-y-4" onSubmit=${publish}>
          <${Field} label="Loại"><${Segmented} label="Loại thông báo" value=${f.kind} onChange=${(v) => set('kind', v)} options=${Object.entries(ANNOUNCE_KIND).map(([k, v]) => ({ value: k, label: v.label, icon: v.icon }))} /><//>
          <${Field} label="Tiêu đề" htmlFor="an-title"><${Input} id="an-title" value=${f.title} maxLength=${60} onChange=${(e) => set('title', e.target.value)} /><//>
          <${Field} label="Nội dung" htmlFor="an-body" aside=${html`<span className=${cx('text-xs tabular-nums', f.body.length > 180 ? 'text-crit' : 'text-ink-3')}>${f.body.length}/180</span>`}>
            <${Textarea} id="an-body" value=${f.body} onChange=${(e) => set('body', e.target.value)} placeholder="Ngắn gọn, nói rõ ba mẹ có ghi nhật ký được không." /><//>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <${Field} label="Bắt đầu" htmlFor="an-start"><${Input} id="an-start" type="datetime-local" value=${f.startsAt} onChange=${(e) => set('startsAt', e.target.value)} /><//>
            <${Field} label="Kết thúc" htmlFor="an-end"><${Input} id="an-end" type="datetime-local" value=${f.endsAt} onChange=${(e) => set('endsAt', e.target.value)} /><//>
          </div>
          <button type="button" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary-ink hover:underline" onClick=${useQuiet}><${Icon} name="moon" className="size-4" />Dùng khung vắng nhất (${hourRange(quiet, 2)})</button>
          <div><p className="mb-2 text-[13px] font-semibold text-ink">Ba mẹ sẽ thấy</p>
            <div className="rounded-3xl border border-line bg-bg p-3"><${ParentBanner} kind=${f.kind} title=${f.title} body=${f.body} /></div></div>
          ${error && html`<p className="text-[13px] font-medium text-crit" role="alert">${error}</p>`}
          <${Button} type="submit" icon="send" busy=${busy === 'create'}>Đăng thông báo<//>
        </form>
      <//>
    </div>
  <//>`;
}

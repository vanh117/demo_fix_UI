/* Family-support pages: safety cases, expert requests, the expert directory, and accounts with data requests.
   Diary content never reaches these pages; contact details stay masked until a moderator gives a logged reason. */
'use strict';

function PriorityPill({ kind }) { const k = CASE_KIND[kind]; return html`<${Pill} tone=${k.tone} icon=${k.icon}>P${k.priority} · ${k.label}<//>`; }
function StatusPill({ map, status }) { const s = map[status]; return html`<${Pill} tone=${s.tone} icon=${s.icon}>${s.label}<//>`; }
function Who({ name, empty = 'Chưa có' }) {
  return name ? html`<span className="inline-flex items-center gap-2 whitespace-nowrap"><${Avatar} name=${name} size="xs" />${name}</span>` : html`<span className="text-ink-3">${empty}</span>`;
}
function SlaChip({ c, now }) {
  if (c.status === 'closed') return html`<span className="whitespace-nowrap text-[13px] text-ink-3">Đóng ${ago(c.closedAt)}</span>`;
  if (c.ackAt) return html`<span className=${cx('whitespace-nowrap text-[13px]', c.lateAck ? 'text-warn' : 'text-ink-3')}>${c.lateAck ? 'Phản hồi trễ, sau ' : 'Phản hồi sau '}${durationText(c.ackAt - c.firstAt)}</span>`;
  const left = c.dueAt - now;
  if (left < 0) return html`<${Pill} tone="crit" icon="clock">Quá hạn ${durationText(-left)}<//>`;
  return html`<${Pill} tone=${left < CASE_KIND[c.kind].sla * 0.25 ? 'warn' : 'neutral'} icon="clock">Còn ${durationText(left)}<//>`;
}
function Timeline({ items }) {
  return html`<ol className="relative space-y-4 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-px before:bg-line">
    ${items.map((it, i) => html`<li key=${i} className="relative flex gap-3">
      <span className=${cx('relative z-10 grid size-8 shrink-0 place-items-center rounded-full border-2 border-surface', it.tone === 'crit' ? 'bg-crit-tint text-crit' : it.tone === 'warn' ? 'bg-warn-tint text-warn' : it.tone === 'good' ? 'bg-good-tint text-good' : 'bg-surface-2 text-ink-2')}>
        <${Icon} name=${it.icon} className="size-4" /></span>
      <div className="min-w-0 flex-1 pt-1">
        <p className="text-sm text-ink"><span className="font-semibold">${it.title}</span> <span className="text-xs text-ink-3">· ${fmtDT(it.at)}</span></p>
        ${it.text && html`<p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">${it.text}</p>`}
      </div>
    </li>`)}
  </ol>`;
}
function Section({ title, children, aside }) {
  return html`<section className="border-t border-line pt-5 first:border-t-0 first:pt-0">
    <div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-[13px] font-bold uppercase tracking-wide text-ink-3">${title}</h3>${aside}</div>${children}</section>`;
}

/* ---------- break-glass: contact details need a reason, and every view is logged ---------- */
function RevealModal({ open, onClose, path, subject }) {
  const [reason, setReason] = useState(REVEAL_REASONS[0]);
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (open) { setDetail(''); setError(''); } }, [open]);
  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    const r = await send(path, 'POST', { reason, detail }, { quiet: true });
    setBusy(false);
    if (r.ok) { toast('Đã hiện liên hệ trong 10 phút. Lượt xem đã được ghi lại.'); onClose(); }
    else setError(r.body?.error || 'Chưa xem được liên hệ.');
  }
  return html`<${Modal} open=${open} onClose=${onClose} busy=${busy} tone="warn" title="Xem thông tin liên hệ của gia đình"
    intro=${`Email và số điện thoại của ${subject} được ẩn mặc định. Lượt xem này được ghi vào nhật ký kiểm tra kèm lý do, và quản trị viên nhận được thông báo.`}
    footer=${html`<${Button} variant="quiet" onClick=${onClose} disabled=${busy}>Hủy<//><${Button} type="submit" form="reveal-form" icon="eye" busy=${busy}>Hiện trong 10 phút<//>`}>
    <form id="reveal-form" className="space-y-4" onSubmit=${submit}>
      <${Field} label="Lý do" htmlFor="rv-reason"><${Select} id="rv-reason" value=${reason} onChange=${(e) => setReason(e.target.value)}>${REVEAL_REASONS.map((r) => html`<option key=${r}>${r}</option>`)}<//><//>
      <${Field} label="Ghi rõ hơn" htmlFor="rv-detail" error=${error} hint="Ví dụ: gọi để hỏi tình trạng của bé sau cảnh báo đập đầu lúc 14:20.">
        <${Textarea} id="rv-detail" value=${detail} onChange=${(e) => setDetail(e.target.value)} maxLength=${300} />
      <//>
    </form>
  <//>`;
}
function ContactPanel({ contact, canReveal, onReveal, now }) {
  const shown = contact.revealed && contact.revealed.until > now ? contact.revealed : null;
  const row = (icon, label, masked, real) => html`<div className="flex items-center gap-3 py-2">
    <${Icon} name=${icon} className="size-[18px] text-ink-3" />
    <div className="min-w-0 flex-1"><p className="text-xs text-ink-3">${label}</p><p className=${cx('truncate text-sm font-semibold tabular-nums', shown ? 'text-ink' : 'text-ink-2')}>${real || masked}</p></div>
    ${real && html`<${Button} variant="quiet" size="xs" icon="copy" onClick=${() => copyText(real)}>Chép<//>`}
  </div>`;
  return html`<div className=${cx('rounded-xl border px-4 py-2', shown ? 'border-warn-line bg-warn-tint/50' : 'border-line bg-surface-2/60')}>
    ${row('mail', 'Email đăng nhập', contact.email, shown?.email)}
    ${row('phone', 'Số điện thoại', contact.phone, shown?.phone)}
    <div className="flex flex-wrap items-center gap-2 border-t border-line py-2.5">
      ${shown ? html`<p className="flex items-center gap-1.5 text-[13px] text-warn"><${Icon} name="eye" className="size-4" />Tự ẩn lại sau ${durationText(shown.until - now)}. Lượt xem đã ghi vào nhật ký.</p>`
        : canReveal ? html`<${Button} variant="secondary" size="sm" icon="eye" onClick=${onReveal}>Xem liên hệ (cần ghi lý do)<//>`
        : html`<p className="flex items-center gap-1.5 text-[13px] text-ink-3"><${Icon} name="lock" className="size-4" />Vai trò của bạn không xem được liên hệ.</p>`}
    </div>
  </div>`;
}

/* ---------- safety cases ---------- */
const CASE_LOG = {
  ack: ['clock', (l) => `${l.by} nhận xử lý`], assign: ['users', (l) => `${l.by} giao lại ca`], contacted: ['phone', (l) => `${l.by} đã liên hệ gia đình`, 'good'],
  note: ['pencil', (l) => `${l.by} thêm ghi chú`], close: ['check', (l) => (l.by === 'Hệ thống' ? 'Hệ thống đóng ca' : `${l.by} đóng ca`)], reopen: ['undo', (l) => `${l.by} mở lại ca`, 'warn'],
  reveal: ['eye', (l) => `${l.by} xem liên hệ gia đình`, 'warn'],
  escalate: ['alert', () => 'Hệ thống nâng mức ưu tiên', 'crit'],
};
function caseTimeline(d) {
  const alerts = d.alerts.map((a) => ({ at: a.at, icon: CASE_KIND[a.kind].icon, tone: CASE_KIND[a.kind].tone === 'neutral' ? '' : CASE_KIND[a.kind].tone, title: `Cảnh báo: ${CASE_KIND[a.kind].label}`, text: a.reason + (a.booked ? '. Gia đình đã gửi yêu cầu chuyên gia ngay sau đó.' : '.') }));
  const acts = d.log.map((l) => { const [icon, title, tone] = CASE_LOG[l.type] || ['info', () => l.type]; return { at: l.at, icon, tone, title: title(l), text: l.text }; });
  return [...alerts, ...acts].sort((a, b) => a.at - b.at);
}

function CloseCaseModal({ open, onClose, c }) {
  const [outcome, setOutcome] = useState(c?.booked ? 'booked' : 'stable');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setBusy(true);
    const r = await send(`/api/admin/cases/${c.id}`, 'PATCH', { action: 'close', outcome, note });
    setBusy(false);
    if (r.ok) { toast(`Đã đóng ca ${c.id}.`); onClose(); }
  }
  return html`<${Modal} open=${open} onClose=${onClose} busy=${busy} title=${`Đóng ca ${c?.id}`} intro="Kết quả giúp nhóm biết cảnh báo nào hữu ích và chỉnh lại quy tắc khi cần."
    footer=${html`<${Button} variant="quiet" onClick=${onClose} disabled=${busy}>Hủy<//><${Button} type="submit" form="close-form" icon="check" busy=${busy}>Đóng ca<//>`}>
    <form id="close-form" className="space-y-4" onSubmit=${submit}>
      <fieldset className="space-y-1.5"><legend className="mb-1.5 text-[13px] font-semibold text-ink">Kết quả</legend>
        ${Object.entries(CLOSE_OUTCOMES).map(([k, label]) => html`<label key=${k} className=${cx('flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors', outcome === k ? 'border-primary bg-primary-tint/60' : 'border-line hover:bg-surface-2')}>
          <input type="radio" name="outcome" className="size-4 accent-primary" checked=${outcome === k} onChange=${() => setOutcome(k)} />${label}</label>`)}
      </fieldset>
      <${Field} label="Ghi chú (không bắt buộc)" htmlFor="close-note"><${Textarea} id="close-note" value=${note} onChange=${(e) => setNote(e.target.value)} placeholder="Không ghi nội dung nhật ký của bé ở đây." /><//>
    </form>
  <//>`;
}

function CaseDrawer({ id, me, onClose }) {
  const q = useApi(id ? `/api/admin/cases/${id}` : null);
  const now = useNow(15e3);
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');
  const [revealing, setRevealing] = useState(false);
  const [closing, setClosing] = useState(false);
  const d = q.data && q.data.id === id ? q.data : null;
  const act = async (action, extra = {}, done) => {
    setBusy(action);
    const r = await send(`/api/admin/cases/${id}`, 'PATCH', { action, ...extra });
    setBusy('');
    if (r.ok && done) done();
  };
  const open = !!d && d.status !== 'closed';
  const footer = d && html`
    ${d.status === 'new' && html`<${Button} icon="check" busy=${busy === 'ack'} onClick=${() => act('ack', {}, () => toast(`Bạn đã nhận ca ${d.id}.`))}>Nhận xử lý<//>`}
    ${(d.status === 'ack' || d.status === 'new') && html`<${Button} variant="secondary" icon="phone" busy=${busy === 'contacted'} onClick=${() => act('contacted', {}, () => toast('Đã đánh dấu đã liên hệ.'))}>Đã liên hệ gia đình<//>`}
    ${open && html`<${Button} variant=${d.status === 'contacted' ? 'primary' : 'secondary'} icon="checkCircle" onClick=${() => setClosing(true)}>Đóng ca<//>`}
    ${d.status === 'closed' && html`<${Button} variant="secondary" icon="undo" busy=${busy === 'reopen'} onClick=${() => act('reopen', {}, () => toast('Đã mở lại ca.'))}>Mở lại ca<//>`}`;
  return html`<${Drawer} open=${!!id} onClose=${onClose} wide title=${d ? `Ca ${d.id}` : `Ca ${id || ''}`}
    sub=${d ? `Gia đình ${d.fam} · bé ${d.band} · mở lúc ${fmtDT(d.firstAt)}` : 'Đang tải…'}
    badges=${d && html`<${PriorityPill} kind=${d.kind} /><${StatusPill} map=${CASE_STATUS} status=${d.status} />`} footer=${footer}>
    ${q.error && !d ? html`<${ErrorCard} error=${q.error} onRetry=${q.reload} />` : !d ? html`<div className="space-y-4"><${Skel} h=${90} /><${Skel} h=${140} /><${Skel} h=${220} /></div>` : html`<div className="space-y-6">
      ${d.status !== 'closed' && html`<div className=${cx('flex items-center gap-3 rounded-xl border px-4 py-3', d.overdue ? 'border-crit-line bg-crit-tint' : 'border-line bg-surface-2/60')}>
        <${Icon} name="timer" className=${cx('size-5', d.overdue ? 'text-crit' : 'text-ink-3')} />
        <div className="min-w-0 flex-1 text-sm"><p className="font-semibold text-ink">Hạn phản hồi đầu tiên: ${CASE_KIND[d.kind].slaText} kể từ cảnh báo đầu</p>
          <p className="text-[13px] text-ink-2">${d.ackAt ? `${d.assignee?.name || 'Nhóm'} đã nhận sau ${durationText(d.ackAt - d.firstAt)}.` : d.overdue ? `Đã quá hạn ${durationText(now - d.dueAt)}. Cần người nhận ngay.` : `Còn ${durationText(d.dueAt - now)}, đến ${fmtDT(d.dueAt)}.`}</p></div>
      </div>`}

      ${d.kind === 'safety' && d.status !== 'closed' && html`<${Callout} tone="crit" title="Các bước cho ca nguy cơ an toàn">
        <ol className="mt-1 list-decimal space-y-1 pl-5">
          <li>Liên hệ gia đình trong 2 giờ: hỏi bé đang ở đâu, có ai ở cạnh, có bị thương không.</li>
          <li>Nếu bé bị thương hoặc đang gặp nguy hiểm: hướng dẫn gọi cấp cứu <b>115</b>.</li>
          <li>Nếu nghi bé bị bạo hành hoặc bỏ mặc: Tổng đài quốc gia bảo vệ trẻ em <b>111</b>.</li>
          <li>Đề nghị gia đình gặp chuyên gia trong tuần và hỗ trợ đặt lịch.</li>
        </ol><//>`}

      <${Section} title="Ca này">
        <${Facts} rows=${[
          ['Lý do', d.reason],
          ['Số cảnh báo', `${d.alertCount} cảnh báo · gần nhất ${ago(d.lastAt)}`],
          ['Người xử lý', open && d.team.length > 1 ? html`<${Select} className="max-w-60" aria-label="Giao cho" value=${d.assignee?.id || ''} onChange=${(e) => e.target.value && act('assign', { memberId: e.target.value }, () => toast('Đã giao ca.'))}>
              <option value="">Chưa có người nhận</option>${d.team.map((m) => html`<option key=${m.id} value=${m.id}>${m.name}${m.id === me.id ? ' (bạn)' : ''}</option>`)}<//>` : html`<${Who} name=${d.assignee?.name} />`],
          ['Yêu cầu chuyên gia', d.bookings.length ? html`<span className="flex flex-wrap gap-1.5">${d.bookings.map((b) => html`<a key=${b.id} href=${`#/bookings/${b.id}`} className="font-semibold text-primary-ink hover:underline">${b.id} · ${BOOKING_STATUS[b.status].label}</a>`)}</span>` : 'Chưa gửi'],
          d.outcome && ['Kết quả', CLOSE_OUTCOMES[d.outcome]],
          ['Gia đình', `${d.family.kids.length} hồ sơ bé · ${fmtInt(d.family.entries)} lượt ghi · dùng từ ${fmtDate(d.family.joinedAt)}`],
        ]} />
      <//>

      <${Section} title="Liên hệ gia đình">
        <${ContactPanel} contact=${d.contact} canReveal=${me.perms.includes('reveal')} onReveal=${() => setRevealing(true)} now=${now} />
        <p className="mt-2 text-[12.5px] text-ink-3">Nội dung nhật ký và tên bé không hiện ở trang điều hành. Nếu cần thêm thông tin, hãy hỏi trực tiếp ba mẹ.</p>
      <//>

      <${Section} title="Diễn biến"><${Timeline} items=${caseTimeline(d)} /><//>

      ${open && html`<${Section} title="Thêm ghi chú">
        <div className="space-y-2"><${Textarea} aria-label="Ghi chú cho ca" value=${note} onChange=${(e) => setNote(e.target.value)} placeholder="Đã gọi lúc nào, gia đình nói gì, bước tiếp theo. Không chép nội dung nhật ký." />
          <div className="flex justify-end"><${Button} variant="secondary" size="sm" icon="pencil" disabled=${note.trim().length < 3} busy=${busy === 'note'} onClick=${() => act('note', { note }, () => { setNote(''); toast('Đã thêm ghi chú.'); })}>Lưu ghi chú<//></div></div>
      <//>`}
    </div>`}
    <${RevealModal} open=${revealing} onClose=${() => setRevealing(false)} path=${`/api/admin/cases/${id}/reveal`} subject=${`gia đình ${d?.fam || ''}`} />
    ${d && html`<${CloseCaseModal} key=${d.id} open=${closing} onClose=${() => setClosing(false)} c=${d} />`}
  <//>`;
}

function AlertsPage({ me, route, go }) {
  const [view, setView] = useState('open');
  const [prio, setPrio] = useState('all');
  const [term, setTerm] = useState('');
  const [page, setPage] = useState(1);
  const now = useNow(30e3);
  useEffect(() => setPage(1), [view, prio, term]);
  const q = useApi(`/api/admin/cases?view=${view}&priority=${prio}&q=${encodeURIComponent(term)}&page=${page}`);
  const counts = q.data?.counts, stats = q.data?.stats;
  return html`<${Fragment}>
    <${PageHeader} title="Cảnh báo an toàn" sub="Mỗi ca gom các cảnh báo của một gia đình trong 72 giờ, xếp theo mức ưu tiên và hạn phản hồi. Ca P2, P3 tự đóng khi gia đình đã gửi yêu cầu gặp chuyên gia." />
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <${Stat} icon="alert" tone=${counts?.p1 ? 'crit' : ''} label="P1 · Nguy cơ an toàn đang mở" value=${counts ? fmtInt(counts.p1) : '–'} sub=${`Phản hồi trong ${CASE_KIND.safety.slaText}`} />
      <${Stat} icon="trendDown" label="P2 · Khó khăn kéo dài" value=${counts ? fmtInt(counts.p2) : '–'} sub="Phản hồi trong 24 giờ" />
      <${Stat} icon="activity" label="P3 · Dao động trong ngày" value=${counts ? fmtInt(counts.p3) : '–'} sub="Phản hồi trong 72 giờ" />
      <${Stat} icon="timer" label="Phản hồi đầu tiên (trung vị)" value=${stats?.medianAck != null ? durationText(stats.medianAck) : '–'}
        sub=${stats ? `${pct(stats.slaMet ?? 0, 0)} ca đúng hạn · ${fmtInt(stats.alerts30)} cảnh báo thành ${fmtInt(stats.cases30)} ca trong 30 ngày, ${fmtInt(stats.autoClosed30)} ca tự đóng` : ''} />
    </div>
    <${Card}>
      <div className="flex flex-wrap items-center gap-3 p-4">
        <${Segmented} label="Lọc ca" value=${view} onChange=${setView} options=${[
          { value: 'open', label: 'Đang mở', count: counts?.open }, { value: 'unassigned', label: 'Chưa có người nhận', count: counts?.unassigned, tone: 'crit' },
          { value: 'mine', label: 'Của tôi', count: counts?.mine }, { value: 'closed', label: 'Đã đóng' }, { value: 'all', label: 'Tất cả' }]} />
        <${Select} className="w-40" aria-label="Mức ưu tiên" value=${prio} onChange=${(e) => setPrio(e.target.value)}>
          <option value="all">Mọi mức ưu tiên</option><option value="1">P1 · Nguy cơ an toàn</option><option value="2">P2 · Khó khăn kéo dài</option><option value="3">P3 · Dao động</option>
        <//>
        <${SearchBox} className="min-w-52 flex-1" value=${term} onChange=${setTerm} placeholder="Tìm mã ca hoặc mã gia đình" />
      </div>
      <${Loaded} q=${q} skeleton=${html`<div className="space-y-2 p-4">${[1, 2, 3, 4, 5].map((i) => html`<${Skel} key=${i} h=${44} />`)}</div>`}>${(data) => data.total === 0
        ? html`<${EmptyState} icon="shield" title=${view === 'unassigned' ? 'Không có ca nào đang chờ người nhận' : 'Không có ca nào khớp bộ lọc'} text="Ca mới xuất hiện ở đây ngay khi một lượt ghi được đánh giá ở mức Cần chú ý." />`
        : html`<ul className="divide-y divide-line border-t border-line md:hidden">${data.items.map((c) => html`<li key=${c.id}>
            <a href=${`#/alerts/${c.id}`} className="block px-4 py-3.5 transition-colors hover:bg-surface-2/70">
              <div className="flex flex-wrap items-center justify-between gap-2"><${PriorityPill} kind=${c.kind} /><${SlaChip} c=${c} now=${now} /></div>
              <p className="mt-2 font-semibold text-ink">${c.id} <span className="font-normal text-ink-3">· ${c.fam} · bé ${c.band}</span></p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-ink-2"><${StatusPill} map=${CASE_STATUS} status=${c.status} />${c.assignee && html`<${Who} name=${c.assignee.name} />`}<span>${c.alertCount} cảnh báo</span></div>
            </a></li>`)}</ul>
          <div className="hidden md:block"><${Table} minWidth=${900} head=${['Ưu tiên', 'Ca', 'Gia đình', 'Cảnh báo', 'Trạng thái', 'Người xử lý', 'Hạn phản hồi']}>
          ${data.items.map((c) => html`<tr key=${c.id} className=${cx('cursor-pointer transition-colors hover:bg-surface-2/70', route.id === c.id && 'bg-primary-tint/40')} onClick=${() => go(`#/alerts/${c.id}`)}>
            <td className=${TD}><${PriorityPill} kind=${c.kind} /></td>
            <td className=${TD}><a href=${`#/alerts/${c.id}`} className="font-semibold text-ink hover:text-primary-ink hover:underline" onClick=${(e) => e.stopPropagation()}>${c.id}</a><p className="whitespace-nowrap text-xs text-ink-3">${ago(c.firstAt)}</p></td>
            <td className=${TD}><span className="font-medium tabular-nums">${c.fam}</span><p className="text-xs text-ink-3">bé ${c.band}</p></td>
            <td className=${TD}><span className="flex items-center gap-2 whitespace-nowrap tabular-nums">${c.alertCount}${c.booked && html`<${Pill} tone="good" icon="steth">Đã đặt lịch<//>`}</span></td>
            <td className=${TD}><${StatusPill} map=${CASE_STATUS} status=${c.status} /></td>
            <td className=${TD}><${Who} name=${c.assignee?.name} /></td>
            <td className=${TD}><${SlaChip} c=${c} now=${now} /></td>
          </tr>`)}
        <//></div><${Pager} page=${data.page} pageSize=${data.pageSize} total=${data.total} onPage=${setPage} />`}<//>
    <//>
    <p className="mt-4 flex items-center gap-1.5 text-[13px] text-ink-3"><${Icon} name="lock" className="size-4" />Trang này chỉ hiện mã gia đình ẩn danh và nhóm tuổi. Tên bé, ghi chú và nội dung nhật ký không hiển thị.</p>
    <${CaseDrawer} id=${route.id} me=${me} onClose=${() => go('#/alerts')} />
  <//>`;
}

/* ---------- expert requests ---------- */
const BOOKING_LOG = { forward: ['send', 'đã chuyển cho chuyên gia'], confirm: ['calendar', 'ghi nhận lịch hẹn', 'good'], done: ['checkCircle', 'đánh dấu đã gặp', 'good'], cancel: ['x', 'hủy yêu cầu', 'warn'] };

function BookingDrawer({ id, me, onClose }) {
  const q = useApi(id ? `/api/admin/bookings/${id}` : null);
  const now = useNow(15e3);
  const [busy, setBusy] = useState('');
  const [modal, setModal] = useState('');
  const [when, setWhen] = useState('');
  const [reason, setReason] = useState('');
  const d = q.data && q.data.id === id ? q.data : null;
  useEffect(() => { if (d) setWhen(`${d.wantDate}T${['09:00', '15:00', '18:30'][BOOKING_SLOTS.indexOf(d.slot)] || '09:00'}`); }, [d?.id]);
  const act = async (action, extra, msg) => {
    setBusy(action);
    const r = await send(`/api/admin/bookings/${id}`, 'PATCH', { action, ...extra });
    setBusy('');
    if (r.ok) { setModal(''); toast(msg); }
  };
  const items = d ? [{ at: d.createdAt, icon: 'inbox', title: 'Ba mẹ gửi yêu cầu trong ứng dụng', text: `${d.expert?.name} · ${fmtFullDate(d.wantDate)} · ${d.slot}` },
    ...d.log.map((l) => { const [icon, verb, tone] = BOOKING_LOG[l.type]; return { at: l.at, icon, tone, title: `${l.by} ${verb}`, text: l.text }; })] : [];
  const footer = d && html`
    ${d.status === 'new' && html`<${Button} icon="send" onClick=${() => setModal('forward')}>Chuyển cho chuyên gia<//>`}
    ${d.status === 'forwarded' && html`<${Button} icon="calendar" onClick=${() => setModal('confirm')}>Ghi nhận lịch đã xác nhận<//>`}
    ${d.status === 'confirmed' && html`<${Button} icon="checkCircle" busy=${busy === 'done'} onClick=${() => act('done', {}, 'Đã đánh dấu buổi hẹn đã diễn ra.')}>Đánh dấu đã gặp<//>`}
    ${['new', 'forwarded', 'confirmed'].includes(d.status) && html`<${Button} variant="dangerQuiet" icon="x" onClick=${() => setModal('cancel')}>Hủy yêu cầu<//>`}`;
  return html`<${Drawer} open=${!!id} onClose=${onClose} title=${d ? `Yêu cầu ${d.id}` : `Yêu cầu ${id || ''}`} sub=${d ? `Gia đình ${d.fam} · bé ${d.band} · gửi ${ago(d.createdAt)}` : 'Đang tải…'}
    badges=${d && html`<${StatusPill} map=${BOOKING_STATUS} status=${d.status} />${d.caseId && html`<a href=${`#/alerts/${d.caseId}`} className="text-xs font-semibold text-primary-ink hover:underline">Từ ca ${d.caseId}</a>`}`} footer=${footer}>
    ${q.error && !d ? html`<${ErrorCard} error=${q.error} onRetry=${q.reload} />` : !d ? html`<div className="space-y-4"><${Skel} h=${140} /><${Skel} h=${180} /></div>` : html`<div className="space-y-6">
      ${d.waitingOver24h && html`<${Callout} tone="warn" icon="clock" title=${`Đã chờ ${durationText(now - d.createdAt)}`}>Ba mẹ đã thấy "Yêu cầu đã gửi" từ lúc đó. Chuyển cho chuyên gia ngay hoặc báo lại cho gia đình.<//>`}
      <${Section} title="Yêu cầu">
        <${Facts} rows=${[
          ['Chuyên gia', d.expert ? `${d.expert.name} · ${d.expert.location}` : 'Không còn trong danh sách'],
          ['Ngày mong muốn', `${fmtLongDate(d.wantDate)}`], ['Khung giờ', d.slot],
          d.confirmedFor && ['Lịch đã hẹn', `${d.confirmedFor.slice(11)} · ${fmtFullDate(d.confirmedFor.slice(0, 10))}`],
          d.cancelReason && ['Lý do hủy', d.cancelReason],
        ]} />
      <//>
      ${d.status === 'new' && html`<${Section} title="Sẽ gửi cho chuyên gia">
        <ul className="space-y-2 text-sm text-ink-2">
          ${['Bản tóm tắt 30 ngày nhật ký, đúng bản ba mẹ đã xem trước khi gửi', 'Số điện thoại hoặc email ba mẹ để lại', 'Điều ba mẹ muốn trao đổi'].map((t) => html`<li key=${t} className="flex gap-2"><${Icon} name="check" className="mt-0.5 size-4 text-good" />${t}</li>`)}
        </ul>
        <p className="mt-2 text-[13px] text-ink-3">Gửi tới ${d.expertEmail}. Ba mẹ đã đồng ý chia sẻ với chuyên gia này khi bấm gửi.</p>
      <//>`}
      <${Section} title="Liên hệ ba mẹ để lại">
        <${ContactPanel} contact=${d.contact} canReveal=${me.perms.includes('reveal')} onReveal=${() => setModal('reveal')} now=${now} />
        <p className="mt-2 text-[12.5px] text-ink-3">Ghi chú ba mẹ viết cho chuyên gia chỉ gửi tới chuyên gia, không hiện ở đây.</p>
      <//>
      <${Section} title="Diễn biến"><${Timeline} items=${items} /><//>
    </div>`}
    <${RevealModal} open=${modal === 'reveal'} onClose=${() => setModal('')} path=${`/api/admin/bookings/${id}/reveal`} subject=${`gia đình ${d?.fam || ''}`} />
    <${Modal} open=${modal === 'forward'} onClose=${() => setModal('')} busy=${busy === 'forward'} title="Chuyển yêu cầu cho chuyên gia" intro=${d && `${d.expert?.name} nhận email kèm bản tóm tắt và liên hệ của ba mẹ. Ba mẹ nhận thông báo "Đã gửi tới chuyên gia".`}
      footer=${html`<${Button} variant="quiet" onClick=${() => setModal('')}>Hủy<//><${Button} icon="send" busy=${busy === 'forward'} onClick=${() => act('forward', {}, 'Đã chuyển cho chuyên gia.')}>Gửi ngay<//>`} />
    <${Modal} open=${modal === 'confirm'} onClose=${() => setModal('')} busy=${busy === 'confirm'} title="Ghi nhận lịch đã xác nhận" intro="Nhập thời gian chuyên gia đã hẹn với gia đình. Ba mẹ sẽ thấy lịch này trong ứng dụng."
      footer=${html`<${Button} variant="quiet" onClick=${() => setModal('')}>Hủy<//><${Button} icon="calendar" busy=${busy === 'confirm'} onClick=${() => act('confirm', { at: when }, 'Đã lưu lịch hẹn.')}>Lưu lịch hẹn<//>`}>
      <${Field} label="Ngày giờ hẹn" htmlFor="bk-when"><${Input} id="bk-when" type="datetime-local" value=${when} onChange=${(e) => setWhen(e.target.value)} /><//>
    <//>
    <${Modal} open=${modal === 'cancel'} onClose=${() => setModal('')} busy=${busy === 'cancel'} tone="crit" title="Hủy yêu cầu chuyên gia" intro="Ba mẹ nhận thông báo kèm lý do và gợi ý chọn chuyên gia khác."
      footer=${html`<${Button} variant="quiet" onClick=${() => setModal('')}>Không hủy<//><${Button} variant="danger" busy=${busy === 'cancel'} onClick=${() => act('cancel', { reason }, 'Đã hủy yêu cầu.')}>Hủy yêu cầu<//>`}>
      <${Field} label="Lý do" htmlFor="bk-reason"><${Input} id="bk-reason" value=${reason} onChange=${(e) => setReason(e.target.value)} placeholder="Ví dụ: chuyên gia không còn lịch trống tuần này" /><//>
    <//>
  <//>`;
}

function BookingsPage({ me, route, go }) {
  const [status, setStatus] = useState('new');
  const [term, setTerm] = useState('');
  const [page, setPage] = useState(1);
  const now = useNow(30e3);
  useEffect(() => setPage(1), [status, term]);
  const q = useApi(`/api/admin/bookings?status=${status}&q=${encodeURIComponent(term)}&page=${page}`);
  const counts = q.data?.counts, stats = q.data?.stats;
  return html`<${Fragment}>
    <${PageHeader} title="Yêu cầu gặp chuyên gia" sub="Ba mẹ gửi từ trang Chuyên gia. Mục tiêu: chuyển cho chuyên gia trong 24 giờ và báo lại cho gia đình ở mỗi bước." />
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <${Stat} icon="inbox" tone=${stats?.overdue ? 'warn' : ''} label="Chờ chuyển" value=${counts ? fmtInt(counts.new) : '–'} sub=${stats ? (stats.overdue ? `${stats.overdue} yêu cầu chờ hơn 24 giờ` : 'Không có yêu cầu quá 24 giờ') : ''} />
      <${Stat} icon="send" label="Chờ chuyên gia xác nhận" value=${counts ? fmtInt(counts.forwarded) : '–'} sub="Đã gửi email cho chuyên gia" />
      <${Stat} icon="timer" label="Thời gian chuyển (trung vị)" value=${stats?.medianForward != null ? durationText(stats.medianForward) : '–'} sub="30 ngày qua" />
      <${Stat} icon="alert" label="Đến từ cảnh báo" value=${stats ? pct(stats.fromCases / Math.max(1, stats.month), 0) : '–'} sub=${stats ? `${fmtInt(stats.fromCases)} trên ${fmtInt(stats.month)} yêu cầu trong 30 ngày` : ''} />
    </div>
    <${Card}>
      <div className="flex flex-wrap items-center gap-3 p-4">
        <${Segmented} label="Trạng thái" value=${status} onChange=${setStatus} options=${[
          ...Object.entries(BOOKING_STATUS).map(([k, v]) => ({ value: k, label: v.label, count: counts?.[k], tone: k === 'new' ? 'crit' : undefined })), { value: 'all', label: 'Tất cả' }]} />
        <${SearchBox} className="min-w-52 flex-1" value=${term} onChange=${setTerm} placeholder="Tìm mã yêu cầu hoặc mã gia đình" />
      </div>
      <${Loaded} q=${q} skeleton=${html`<div className="space-y-2 p-4">${[1, 2, 3, 4].map((i) => html`<${Skel} key=${i} h=${44} />`)}</div>`}>${(data) => data.total === 0
        ? html`<${EmptyState} icon="inbox" title="Không có yêu cầu nào ở mục này" text=${status === 'new' ? 'Mọi yêu cầu mới đã được chuyển cho chuyên gia.' : 'Thử chọn trạng thái khác.'} />`
        : html`<ul className="divide-y divide-line border-t border-line md:hidden">${data.items.map((b) => html`<li key=${b.id}>
            <a href=${`#/bookings/${b.id}`} className="block px-4 py-3.5 transition-colors hover:bg-surface-2/70">
              <div className="flex flex-wrap items-center justify-between gap-2"><${StatusPill} map=${BOOKING_STATUS} status=${b.status} />
                <span className=${cx('text-[13px] font-medium', b.waitingOver24h ? 'text-crit' : 'text-ink-3')}>${b.status === 'new' || b.status === 'forwarded' ? `Đã chờ ${durationText(now - b.createdAt)}` : fmtDT(b.createdAt)}</span></div>
              <p className="mt-2 font-semibold text-ink">${b.id} <span className="font-normal text-ink-3">· ${b.fam}${b.caseId ? ` · từ ca ${b.caseId}` : ''}</span></p>
              <p className="mt-1 text-[13px] text-ink-2">${b.expert?.name} · ${fmtFullDate(b.wantDate)} · ${b.slot}</p>
            </a></li>`)}</ul>
          <div className="hidden md:block"><${Table} minWidth=${860} head=${['Yêu cầu', 'Gia đình', 'Chuyên gia', 'Ngày mong muốn', 'Trạng thái', 'Đã chờ']}>
          ${data.items.map((b) => html`<tr key=${b.id} className=${cx('cursor-pointer transition-colors hover:bg-surface-2/70', route.id === b.id && 'bg-primary-tint/40')} onClick=${() => go(`#/bookings/${b.id}`)}>
            <td className=${TD}><a href=${`#/bookings/${b.id}`} className="font-semibold hover:text-primary-ink hover:underline" onClick=${(e) => e.stopPropagation()}>${b.id}</a>${b.caseId && html`<p className="text-xs text-ink-3">từ ca ${b.caseId}</p>`}</td>
            <td className=${TD}><span className="font-medium tabular-nums">${b.fam}</span><p className="text-xs text-ink-3">bé ${b.band}</p></td>
            <td className=${TD}>${b.expert?.name}<p className="text-xs text-ink-3">${b.expert?.location}</p></td>
            <td className=${TD}>${fmtFullDate(b.wantDate)}<p className="text-xs text-ink-3">${b.slot}</p></td>
            <td className=${TD}><${StatusPill} map=${BOOKING_STATUS} status=${b.status} /></td>
            <td className=${TD}>${b.status === 'new' || b.status === 'forwarded'
              ? html`<span className=${cx('whitespace-nowrap text-[13px] font-medium', b.waitingOver24h ? 'text-crit' : 'text-ink-2')}>${durationText(now - b.createdAt)}</span>`
              : html`<span className="whitespace-nowrap text-[13px] text-ink-3">${fmtDT(b.createdAt)}</span>`}</td>
          </tr>`)}
        <//></div><${Pager} page=${data.page} pageSize=${data.pageSize} total=${data.total} onPage=${setPage} />`}<//>
    <//>
    <${BookingDrawer} id=${route.id} me=${me} onClose=${() => go('#/bookings')} />
  <//>`;
}

/* ---------- expert directory ---------- */
const EXPERT_STATE = {
  verified: { label: 'Đã xác minh', tone: 'good', icon: 'shield' },
  expired: { label: 'Quá hạn xác minh lại', tone: 'warn', icon: 'clock' },
  pending: { label: 'Chờ xác minh', tone: 'neutral', icon: 'info' },
};
const EXPERT_BLANK = { name: '', specialty: '', hospital: '', location: '', experience: '', description: '', email: '', license: '', issuer: '', checks: [] };

function ExpertDrawer({ open, expert, onClose }) {
  const [f, setF] = useState(EXPERT_BLANK);
  const [reverify, setReverify] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (open) { setF(expert ? { ...EXPERT_BLANK, ...expert, checks: expert.checks.slice() } : EXPERT_BLANK); setReverify(false); setError(''); } }, [open, expert?.id]);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const toggle = (k, on) => setF((x) => ({ ...x, checks: on ? [...x.checks, k] : x.checks.filter((c) => c !== k) }));
  const complete = EXPERT_CHECKS.every(([k]) => f.checks.includes(k));
  async function save(e) {
    e.preventDefault(); setBusy(true); setError('');
    const body = { ...f, reverify };
    const r = expert ? await send(`/api/admin/experts/${expert.id}`, 'PATCH', body, { quiet: true }) : await send('/api/admin/experts', 'POST', body, { quiet: true });
    setBusy(false);
    if (r.ok) { toast(expert ? 'Đã lưu thông tin chuyên gia.' : 'Đã thêm chuyên gia.'); onClose(); } else setError(r.body?.error || 'Chưa lưu được.');
  }
  const text = (k, label, props = {}) => html`<${Field} label=${label} htmlFor=${`ex-${k}`}><${Input} id=${`ex-${k}`} value=${f[k]} onChange=${set(k)} ...${props} /><//>`;
  return html`<${Drawer} open=${open} onClose=${onClose} busy=${busy} title=${expert ? `Sửa: ${expert.name}` : 'Thêm chuyên gia'} sub="Ba mẹ chỉ thấy chuyên gia đã xác minh đủ 3 bước trong 12 tháng qua."
    footer=${html`${error && html`<p className="basis-full text-[13px] font-medium text-crit" role="alert">${error}</p>`}<${Button} type="submit" form="expert-form" icon="check" busy=${busy}>${expert ? 'Lưu thay đổi' : 'Thêm chuyên gia'}<//><${Button} variant="quiet" onClick=${onClose} disabled=${busy}>Hủy<//>`}>
    <form id="expert-form" className="space-y-6" onSubmit=${save}>
      <${Section} title="Hiện với ba mẹ"><div className="grid gap-4 sm:grid-cols-2">
        ${text('name', 'Họ tên và học hàm', { placeholder: 'BS. Nguyễn Văn A', required: true })}
        ${text('specialty', 'Chuyên môn', { placeholder: 'Can thiệp sớm', required: true })}
        ${text('hospital', 'Nơi làm việc', { required: true })}
        ${text('location', 'Thành phố')}
        ${text('experience', 'Kinh nghiệm', { placeholder: '10 năm' })}
        ${text('email', 'Email nhận yêu cầu', { type: 'email' })}
        <${Field} className="sm:col-span-2" label="Giới thiệu ngắn" htmlFor="ex-description"><${Textarea} id="ex-description" value=${f.description} onChange=${set('description')} maxLength=${200} /><//>
      </div><//>
      <${Section} title="Xác minh" aside=${html`<${Pill} tone=${complete ? 'good' : 'neutral'} icon=${complete ? 'shield' : 'info'}>${complete ? 'Đủ 3 bước' : `${f.checks.length}/3 bước`}<//>`}>
        <div className="grid gap-4 sm:grid-cols-2">
          ${text('license', 'Số chứng chỉ hành nghề', { placeholder: '000000/HNO-CCHN' })}
          ${text('issuer', 'Nơi cấp', { placeholder: 'Sở Y tế Hà Nội' })}
        </div>
        <div className="mt-3 space-y-1">${EXPERT_CHECKS.map(([k, label]) => html`<${Check} key=${k} checked=${f.checks.includes(k)} onChange=${(on) => toggle(k, on)}>${label}<//>`)}</div>
        ${expert?.verifiedAt && complete && html`<div className="mt-2"><${Check} checked=${reverify} onChange=${setReverify} hint=${`Lần trước: ${fmtDate(expert.verifiedAt)} bởi ${expert.verifiedBy}.`}>Tôi vừa kiểm tra lại cả 3 bước hôm nay<//></div>`}
      <//>
    </form>
  <//>`;
}

function ExpertsPage() {
  const q = useApi('/api/admin/experts');
  const [editing, setEditing] = useState(null);
  const items = q.data?.items || [];
  const toggleActive = async (x, on) => { const r = await send(`/api/admin/experts/${x.id}`, 'PATCH', { active: on, onlyActive: true }); if (r.ok) toast(on ? `${x.name} đã hiện với ba mẹ.` : `Đã ẩn ${x.name}.`); };
  const expiredVisible = items.filter((x) => x.active && x.state === 'expired');
  return html`<${Fragment}>
    <${PageHeader} title="Chuyên gia" sub="Danh sách ba mẹ thấy ở trang Kết nối chuyên gia. Nhãn “Đã xác minh” trong ứng dụng lấy từ đây, không còn gắn cứng cho mọi người."
      actions=${html`<${Button} icon="plus" onClick=${() => setEditing('new')}>Thêm chuyên gia<//>`} />
    ${expiredVisible.length > 0 && html`<${Callout} className="mb-5" tone="warn" title=${`${expiredVisible.length} chuyên gia đang hiện nhưng đã quá 12 tháng chưa xác minh lại`}
      action=${html`<${Button} size="sm" variant="secondary" onClick=${() => setEditing(expiredVisible[0])}>Xác minh lại<//>`}>${expiredVisible.map((x) => x.name).join(', ')}. Kiểm tra lại chứng chỉ hành nghề và nơi làm việc, hoặc ẩn khỏi danh sách.<//>`}
    <div className="mb-5 grid gap-3 sm:grid-cols-3">
      <${Stat} icon="eye" label="Đang hiện với ba mẹ" value=${q.data ? fmtInt(items.filter((x) => x.active).length) : '–'} sub="Chỉ chuyên gia đã xác minh" />
      <${Stat} icon="info" label="Chờ xác minh" value=${q.data ? fmtInt(items.filter((x) => x.state === 'pending').length) : '–'} sub="Chưa đủ 3 bước" />
      <${Stat} icon="clock" tone=${expiredVisible.length ? 'warn' : ''} label="Quá hạn xác minh lại" value=${q.data ? fmtInt(items.filter((x) => x.state === 'expired').length) : '–'} sub="Xác minh lại mỗi 12 tháng" />
    </div>
    <${Loaded} q=${q} skeleton=${html`<div className="grid gap-4 lg:grid-cols-2">${[1, 2, 3, 4].map((i) => html`<${Skel} key=${i} h=${260} />`)}</div>`}>${(data) => html`<div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
      ${data.items.map((x) => { const st = EXPERT_STATE[x.state]; return html`<${Card} key=${x.id} className="flex flex-col p-5">
        <div className="flex flex-wrap items-start gap-3">
          <${Avatar} name=${x.name} size="lg" />
          <div className="min-w-0 flex-1 basis-44"><p className="font-bold leading-snug text-ink">${x.name}</p><p className="text-[13px] text-ink-2">${x.specialty}</p><p className="text-[13px] text-ink-3">${x.hospital} · ${x.location}</p></div>
          <${Pill} tone=${st.tone} icon=${st.icon}>${st.label}<//>
        </div>
        <${Facts} className="mb-4 mt-4 grid-cols-[minmax(0,8.5rem)_1fr]! text-[13px]!" rows=${[
          ['Chứng chỉ hành nghề', x.license ? `${x.license} · ${x.issuer}` : html`<span className="text-ink-3">Chưa nhập</span>`],
          ['Xác minh', x.verifiedAt ? `${fmtDate(x.verifiedAt)} · ${x.verifiedBy}` : `${x.checks.length}/3 bước`],
          ['Yêu cầu 30 ngày', x.requests30 ? `${fmtInt(x.requests30)}${x.confirmMedian != null ? ` · xác nhận sau ${durationText(x.confirmMedian)}` : ''}` : 'Chưa có'],
        ]} />
        <div className="mt-auto flex items-center gap-3 border-t border-line pt-4">
          <${Switch} id=${`ex-on-${x.id}`} checked=${x.active} onChange=${(on) => toggleActive(x, on)} disabled=${!x.active && x.state !== 'verified'} label=${`Hiện ${x.name} với ba mẹ`} />
          <label htmlFor=${`ex-on-${x.id}`} className="flex-1 text-[13px] font-medium text-ink-2">${x.active ? 'Đang hiện với ba mẹ' : x.state === 'verified' ? 'Đang ẩn' : 'Ẩn cho tới khi xác minh xong'}</label>
          <${Button} variant="secondary" size="sm" icon="pencil" onClick=${() => setEditing(x)}>Sửa<//>
        </div>
      <//>`; })}
    </div>`}<//>
    <${ExpertDrawer} open=${!!editing} expert=${editing === 'new' ? null : editing} onClose=${() => setEditing(null)} />
  <//>`;
}

/* ---------- accounts and data requests ---------- */
const ACCOUNT_STATUS = {
  active: { label: 'Đang dùng', tone: 'good', icon: 'checkCircle' }, inactive: { label: 'Ngừng dùng hơn 30 ngày', tone: 'neutral', icon: 'clock' },
  suspended: { label: 'Đang tạm khóa', tone: 'warn', icon: 'lock' }, pending_deletion: { label: 'Chờ xóa', tone: 'crit', icon: 'trash' },
};
const LOOKUP_REASONS = ['Xử lý yêu cầu về dữ liệu', 'Gia đình gửi email nhờ hỗ trợ', 'Theo một ca cảnh báo an toàn'];

function AccountPanel({ a, onChange }) {
  const [modal, setModal] = useState('');
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const open = (m) => { setModal(m); setReason(''); setConfirm(''); setError(''); };
  const run = async (action, body = {}) => {
    setBusy(true); setError('');
    const r = await send(`/api/admin/accounts/${encodeURIComponent(a.id)}/${action}`, 'POST', body, { quiet: true });
    setBusy(false);
    if (r.ok) { setModal(''); toast(r.body.message); onChange(r.body); } else setError(r.body?.error || 'Chưa thực hiện được.');
  };
  const st = ACCOUNT_STATUS[a.status];
  const openReq = a.requests.filter((r) => r.status === 'open');
  const quick = openReq.find((r) => r.type === 'withdraw' || r.type === 'correct');
  return html`<${Card} className="p-5">
    <div className="flex flex-wrap items-start gap-3">
      <span className="grid size-12 place-items-center rounded-2xl bg-surface-2 text-ink-2"><${Icon} name="users" className="size-6" /></span>
      <div className="min-w-0 flex-1"><p className="text-lg font-bold tabular-nums text-ink">${a.id}</p><p className="text-[13px] text-ink-3">${a.email}</p></div>
      <${Pill} tone=${st.tone} icon=${st.icon}>${st.label}${a.deleteAt ? ` lúc ${fmtDT(a.deleteAt)}` : ''}<//>
    </div>
    ${a.openCases > 0 && html`<${Callout} className="mt-4" tone="crit" title=${`Gia đình đang có ${a.openCases} ca cảnh báo mở`}>Xử lý xong ca trước khi khóa hoặc xóa tài khoản.<//>`}
    <${Facts} className="mt-5" rows=${[
      ['Tham gia', fmtDate(a.joinedAt)], ['Hoạt động gần nhất', a.lastActiveAt ? ago(a.lastActiveAt) : 'Chưa ghi lần nào'],
      ['Hồ sơ bé', a.kids.map((k) => `bé ${k}`).join(', ')], ['Nhật ký', `${fmtInt(a.entries)} lượt ghi · ${fmtInt(a.aiCalls)} lượt gọi AI (${fmtInt(a.aiFailures)} lỗi)`],
      ['Đồng ý điều khoản', html`<span className="inline-flex flex-wrap items-center gap-2">${a.consent.version} · ${fmtDate(a.consent.at)}${a.consent.version !== 'v2' && html`<${Pill} tone="warn">Cần đồng ý lại theo bản v2<//>`}</span>`],
      openReq.length > 0 && ['Yêu cầu đang mở', openReq.map((r) => `${r.id} · ${DATA_REQ[r.type].label}`).join('; ')],
    ]} />
    <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
      <${Button} variant="secondary" size="sm" icon="download" onClick=${() => open('export')}>Xuất dữ liệu<//>
      ${quick && html`<${Button} variant="secondary" size="sm" icon="check" busy=${busy} onClick=${() => run(quick.type === 'withdraw' ? 'withdraw-ai' : 'correct')}>Hoàn tất ${quick.id}<//>`}
      ${a.status === 'suspended' ? html`<${Button} variant="secondary" size="sm" icon="undo" busy=${busy} onClick=${() => run('unsuspend')}>Mở khóa<//>`
        : a.status !== 'pending_deletion' && html`<${Button} variant="secondary" size="sm" icon="lock" onClick=${() => open('suspend')}>Tạm khóa<//>`}
      ${a.status === 'pending_deletion' ? html`<${Button} variant="secondary" size="sm" icon="undo" busy=${busy} onClick=${() => run('cancel-delete')}>Hủy lịch xóa<//>`
        : html`<${Button} variant="dangerQuiet" size="sm" icon="trash" onClick=${() => open('delete')}>Xóa tài khoản<//>`}
    </div>

    <${Modal} open=${modal === 'export'} onClose=${() => setModal('')} busy=${busy} title=${`Xuất dữ liệu của ${a.id}`} intro="Hệ thống tạo một file JSON và gửi link tải tới email đăng nhập của ba mẹ, không gửi cho người điều hành. Link hết hạn sau 7 ngày."
      footer=${html`<${Button} variant="quiet" onClick=${() => setModal('')}>Hủy<//><${Button} icon="send" busy=${busy} onClick=${() => run('export')}>Gửi link cho ba mẹ<//>`}>
      <ul className="space-y-1.5 text-sm text-ink-2">${['Hồ sơ bé', 'Toàn bộ nhật ký và các lần ghi', 'Gợi ý AI và phản hồi của ba mẹ', 'Yêu cầu gặp chuyên gia'].map((t) => html`<li key=${t} className="flex gap-2"><${Icon} name="check" className="mt-0.5 size-4 text-good" />${t}</li>`)}</ul>
      ${error && html`<p className="mt-3 text-[13px] font-medium text-crit" role="alert">${error}</p>`}
    <//>
    <${Modal} open=${modal === 'suspend'} onClose=${() => setModal('')} busy=${busy} tone="warn" title=${`Tạm khóa ${a.id}`} intro="Ba mẹ không đăng nhập được cho tới khi mở khóa, và thấy hướng dẫn liên hệ hỗ trợ. Dữ liệu được giữ nguyên."
      footer=${html`<${Button} variant="quiet" onClick=${() => setModal('')}>Hủy<//><${Button} icon="lock" busy=${busy} onClick=${() => run('suspend', { reason })}>Tạm khóa<//>`}>
      <${Field} label="Lý do" htmlFor="ac-reason" error=${error}><${Input} id="ac-reason" value=${reason} onChange=${(e) => setReason(e.target.value)} placeholder="Ví dụ: ba mẹ báo mất điện thoại" /><//>
    <//>
    <${Modal} open=${modal === 'delete'} onClose=${() => setModal('')} busy=${busy} tone="crit" title=${`Xóa tài khoản ${a.id}`} intro="Việc xóa chạy sau 24 giờ; trong thời gian đó vẫn hủy được. Sau khi chạy thì không khôi phục được."
      footer=${html`<${Button} variant="quiet" onClick=${() => setModal('')}>Không xóa<//><${Button} variant="danger" icon="trash" busy=${busy} disabled=${fold(confirm) !== fold(a.id)} onClick=${() => run('delete', { confirm, reason: LOOKUP_REASONS[0] })}>Lên lịch xóa<//>`}>
      <div className="space-y-4 text-sm">
        <div><p className="font-semibold text-ink">Sẽ xóa</p><p className="mt-0.5 text-ink-2">Tài khoản đăng nhập, hồ sơ bé, nhật ký, gợi ý AI, phản hồi và yêu cầu gặp chuyên gia.</p></div>
        <div><p className="font-semibold text-ink">Vẫn giữ</p><p className="mt-0.5 text-ink-2">Số liệu tổng hợp không gắn với gia đình (lượt gọi AI, chi phí) và nhật ký kiểm tra của nhóm điều hành.</p></div>
        <${Field} label=${`Nhập lại mã gia đình (${a.id}) để xác nhận`} htmlFor="ac-confirm" error=${error}><${Input} id="ac-confirm" value=${confirm} onChange=${(e) => setConfirm(e.target.value)} autoComplete="off" /><//>
      </div>
    <//>
  <//>`;
}

function AccountsPage() {
  const reqs = useApi('/api/admin/data-requests');
  const now = useNow(60e3);
  const [term, setTerm] = useState('');
  const [reason, setReason] = useState(LOOKUP_REASONS[1]);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lookup = async (value = term, why = reason) => {
    setBusy(true); setError('');
    const r = await request(`/api/admin/accounts?q=${encodeURIComponent(value)}&reason=${encodeURIComponent(why)}`);
    setBusy(false);
    if (r.ok) setResult({ term: value, items: r.body.items }); else setError(r.body?.error || 'Chưa tra cứu được.');
  };
  const openRequest = (r) => { setTerm(r.fam); setReason(LOOKUP_REASONS[0]); lookup(r.fam, `${LOOKUP_REASONS[0]} ${r.id}`); };
  return html`<${Fragment}>
    <${PageHeader} title="Tài khoản và dữ liệu" sub="Xử lý yêu cầu xuất, sửa, xóa dữ liệu của ba mẹ và hỗ trợ tài khoản. Không có danh sách duyệt mọi gia đình: chỉ tra cứu chính xác, và mỗi lượt tra cứu đều được ghi lại." />
    <div className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <${Card}>
        <${CardHead} icon="file" title="Yêu cầu về dữ liệu" sub="Hạn nội bộ: 72 giờ kể từ khi nhận." />
        <${Loaded} q=${reqs} skeleton=${html`<div className="p-5"><${Skel} h=${200} /></div>`}>${(data) => html`<ul className="mt-3 divide-y divide-line border-t border-line">
          ${data.items.map((r) => { const left = r.dueAt - now; const isOpen = r.status === 'open'; return html`<li key=${r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
            <span className=${cx('grid size-9 place-items-center rounded-xl', isOpen ? 'bg-primary-tint text-primary-ink' : 'bg-surface-2 text-ink-3')}><${Icon} name=${DATA_REQ[r.type].icon} className="size-[18px]" /></span>
            <div className="min-w-0 flex-1 basis-56"><p className="text-sm font-semibold text-ink">${DATA_REQ[r.type].label}</p><p className="text-xs text-ink-3">${r.id} · ${r.fam} · ${r.channel} · nhận ${ago(r.receivedAt)}</p></div>
            ${isOpen ? html`<${Pill} tone=${left < 0 ? 'crit' : left < DAY ? 'warn' : 'neutral'} icon="clock">${left < 0 ? `Quá hạn ${durationText(-left)}` : `Còn ${durationText(left)}`}<//>
              <${Button} size="sm" variant="secondary" onClick=${() => openRequest(r)}>Mở tài khoản<//>`
              : html`<span className="text-[13px] text-ink-3">Xong ${fmtDate(r.doneAt)} · ${r.doneBy}</span>`}
          </li>`; })}
        </ul>`}<//>
      <//>
      <${Card} className="p-5">
        <h2 className="flex items-center gap-2 text-[15px] font-bold"><${Icon} name="search" className="size-[18px] text-ink-3" />Tra cứu tài khoản</h2>
        <form className="mt-4 space-y-3" onSubmit=${(e) => { e.preventDefault(); lookup(); }}>
          <${Field} label="Email đăng nhập hoặc mã gia đình" htmlFor="ac-term" error=${error} hint="Ví dụ: GĐ-1A2B hoặc gd1a2b. Tìm chính xác, không tìm theo một phần.">
            <${Input} id="ac-term" value=${term} onChange=${(e) => setTerm(e.target.value)} autoComplete="off" />
          <//>
          <${Field} label="Lý do tra cứu" htmlFor="ac-why"><${Select} id="ac-why" value=${reason} onChange=${(e) => setReason(e.target.value)}>${LOOKUP_REASONS.map((r) => html`<option key=${r}>${r}</option>`)}<//><//>
          <${Button} type="submit" icon="search" busy=${busy} disabled=${term.trim().length < 4}>Tra cứu<//>
        </form>
        <p className="mt-4 flex items-start gap-1.5 text-[12.5px] text-ink-3"><${Icon} name="history" className="mt-px size-4" />Mỗi lượt tra cứu được ghi vào nhật ký kiểm tra kèm lý do.</p>
      <//>
    </div>
    ${result && html`<div className="mt-5 space-y-4">
      ${result.items.length ? result.items.map((a) => html`<${AccountPanel} key=${a.id} a=${a} onChange=${(next) => setResult((r) => ({ ...r, items: r.items.map((x) => (x.id === next.id ? next : x)) }))} />`)
        : html`<${Card}><${EmptyState} icon="search" title=${`Không có tài khoản nào khớp "${result.term}"`} text="Kiểm tra lại email hoặc mã gia đình. Mã có dạng GĐ-XXXX." /><//>`}
    </div>`}
  <//>`;
}

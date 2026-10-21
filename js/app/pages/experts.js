/* Expert list and booking (app/expert/page.tsx). */
'use strict';

/* ---------- Experts (app/expert/page.tsx) ---------- */
function ExpertPage() {
  const { route, activeChild, shared, kids } = useApp();
  const childId = route.params.childId;
  const [experts, setExperts] = useState(null);
  const [selected, setSelected] = useState(null);
  const [date, setDate] = useState(route.params.date || localISODate());
  const [slot, setSlot] = useState(SLOTS[0]);
  const [contact, setContact] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [formError, setFormError] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [requests, setRequests] = useState(null);
  const loadRequests = useCallback(() => { getJSON('/api/expert/requests').then((d) => setRequests(d.requests)).catch(() => setRequests([])); }, []);

  /* moderators can hide or re-verify experts and move requests along from the console, so refetch when it writes */
  useEffect(() => {
    getJSON('/api/expert').then((items) => { setExperts(items); setSelected((cur) => (items.some((x) => x.id === cur) ? cur : items[0]?.id ?? null)); }).catch(() => setExperts([]));
    loadRequests();
  }, [shared]);

  async function book(e) {
    e.preventDefault();
    if (!childId || !selected) return;
    if (!contact.trim()) return setFormError('Ba mẹ hãy nhập số điện thoại hoặc email để chuyên gia liên hệ.');
    setSending(true); setFormError('');
    const res = await apiFetch('/api/expert', {
      method: 'POST',
      body: JSON.stringify({ childId, date, note: `${note}\nLiên hệ: ${contact}\nKhung giờ: ${slot}`, expertId: selected }),
    });
    const data = await res.json();
    if (res.ok) { setResult({ message: data.message, expert: data.booking.expert }); loadRequests(); }
    else setFormError(data.error);
    setSending(false);
  }

  if (!childId) return html`<div className="page"><${EmptyState} icon="steth" title="Chọn bé trước khi đặt lịch" text="Bản tóm tắt gửi chuyên gia được lấy từ nhật ký của từng bé.">
    <${LinkBtn} to="/children">Chọn hồ sơ<//><//></div>`;
  const name = activeChild?.name || 'bé';

  return html`<div className="page">
    <header className="page-head">
      <h1>Kết nối chuyên gia</h1>
      <p className="page-head__sub">Chọn bác sĩ hoặc chuyên gia phù hợp, gửi kèm bản tóm tắt nhật ký để buổi tư vấn đi thẳng vào điều quan trọng.</p>
    </header>

    <div className="expert-layout">
      <div className="expert-col">
        ${requests?.length > 0 && html`<${MyRequests} requests=${requests} kids=${kids || []} />`}
        <section className="card report-card" aria-labelledby="step1">
          <div className="step-head"><span className="step-head__num">1</span><div><h2 id="step1">Chuẩn bị hồ sơ</h2><p>Tự động tổng hợp từ 30 ngày nhật ký gần nhất.</p></div></div>
          <div className="report-card__row">
            <span className="report-card__icon"><${Icon} name="file" /></span>
            <div><strong>Bản tóm tắt EchoKid của ${name}</strong><p>Số lần ghi, tâm trạng thường gặp, giấc ngủ trung bình và 20 lần ghi gần nhất. File .txt, mang theo hoặc gửi trước cho chuyên gia.</p></div>
          </div>
          <${Btn} variant="secondary" onClick=${() => setReportOpen(true)}><${Icon} name="eye" />Xem & tải bản tóm tắt<//>
        </section>

        <section className="expert-list" aria-labelledby="step2">
          <div className="step-head"><span className="step-head__num">2</span><div><h2 id="step2">Chọn chuyên gia</h2><p>Danh sách gợi ý dựa trên nhu cầu phát triển của trẻ.</p></div></div>
          ${!experts ? html`<${Skel} h=${140} /><${Skel} h=${140} />` : html`<div className="expert-list" role="radiogroup" aria-labelledby="step2">
            ${experts.map((ex) => html`<label key=${ex.id} className="expert">
              <input type="radio" id=${'expert-' + ex.id} name="expert" checked=${selected === ex.id} onChange=${() => setSelected(ex.id)} />
              <span className="expert__card">
                <span className="expert__avatar" aria-hidden="true"><svg viewBox="0 0 100 120"><circle cx="50" cy="37" r="22"></circle><path d="M13 112c2-34 15-50 37-50s35 16 37 50"></path></svg></span>
                <span className="expert__body">
                  <strong className="expert__name">${ex.name}</strong>
                  <span className="expert__spec">${ex.specialty}</span>
                  <span className="expert__where">${ex.hospital} · ${ex.location}</span>
                  <span className="expert__desc">${ex.description}</span>
                  <span className="expert__tags">${ex.verified
                    ? html`<span className="pill pill--teal"><${Icon} name="check" />Đã xác minh ${pad2(new Date(ex.verifiedAt).getMonth() + 1)}/${new Date(ex.verifiedAt).getFullYear()}</span>`
                    : html`<span className="pill pill--neutral">Đang xác minh lại</span>`}<span className="pill pill--neutral">${ex.experience} kinh nghiệm</span></span>
                </span>
                <span className="expert__radio" aria-hidden="true">${selected === ex.id && html`<${Icon} name="check" />`}</span>
              </span>
            </label>`)}
          </div>`}
          ${experts && experts.length === 0 && html`<p className="list-note">Hiện chưa có chuyên gia nào nhận yêu cầu. Ba mẹ quay lại sau nhé.</p>`}
          <p className="list-note">Tên chuyên gia trong bản mẫu là dữ liệu giả lập. Nhãn “Đã xác minh” nghĩa là nhóm EchoKid đã kiểm tra chứng chỉ hành nghề và nơi làm việc trong 12 tháng qua.</p>
        </section>
      </div>

      <section className="card booking" aria-labelledby="step3">
        ${result ? html`<div className="success" role="status">
          <span className="success__icon"><${Icon} name="checkCircle" /></span>
          <h2>Đã gửi yêu cầu đặt lịch</h2>
          <p>${result.message}</p>
          <dl className="summary-list">
            <div><dt>Chuyên gia</dt><dd>${result.expert.name}</dd></div>
            <div><dt>Ngày mong muốn</dt><dd>${fmtFullDate(date)}</dd></div>
            <div><dt>Khung giờ</dt><dd>${slot}</dd></div>
            <div><dt>Liên hệ</dt><dd>${contact}</dd></div>
          </dl>
          <p className="muted">Trong lúc chờ, ba mẹ có thể tiếp tục ghi nhật ký để bản tóm tắt đầy đủ hơn.</p>
          <div className="form-actions">
            <${LinkBtn} to="/dashboard" params=${{ childId }}>Về trang Hôm nay<//>
            <${Btn} variant="quiet" onClick=${() => setResult(null)}>Gửi yêu cầu khác<//>
          </div>
        </div>` : html`<form className="booking__form" onSubmit=${book} noValidate>
          <div className="step-head"><span className="step-head__num">3</span><div><h2 id="step3">Thông tin buổi hẹn</h2><p>Chuyên gia sẽ liên hệ để xác nhận.</p></div></div>
          <div className="field"><label className="field__label" htmlFor="bk-date">Ngày mong muốn</label>
            <input id="bk-date" className="input" type="date" min=${localISODate()} value=${date} onChange=${(e) => setDate(e.target.value)} /></div>
          <fieldset className="field"><legend className="field__label">Khung giờ thuận tiện</legend>
            <${Seg} name="bk-slot" label="Khung giờ thuận tiện" cols=${1} className="seg--compact" value=${slot} options=${SLOTS.map((s) => ({ value: s, label: s }))} onChange=${setSlot} /></fieldset>
          <div className="field"><label className="field__label" htmlFor="bk-contact">Số điện thoại hoặc email</label>
            <input id="bk-contact" className="input" value=${contact} onChange=${(e) => setContact(e.target.value)} placeholder="Để chuyên gia liên hệ lại" autoComplete="tel" /></div>
          <div className="field"><label className="field__label" htmlFor="bk-note">Điều ba mẹ muốn trao đổi</label>
            <textarea id="bk-note" className="textarea" value=${note} onChange=${(e) => setNote(e.target.value)} placeholder="Ví dụ: Bé gần đây thường thu mình vào buổi chiều..."></textarea></div>
          ${formError && html`<p className="form-error" role="alert"><${Icon} name="info" />${formError}</p>`}
          <${Btn} type="submit" size="lg" block disabled=${sending || !selected}>${sending ? 'Đang gửi...' : 'Gửi yêu cầu đặt lịch'}<${Icon} name="arrowRight" /><//>
          <p className="privacy"><${Icon} name="lock" />Thông tin chỉ được chia sẻ với chuyên gia ba mẹ chọn.</p>
        </form>`}
      </section>
    </div>
    <${ReportSheet} open=${reportOpen} onClose=${() => setReportOpen(false)} child=${activeChild} />
  </div>`;
}

/* the parent's own requests; moderators move them along in the console */
const REQUEST_STATUS = {
  new: ['Đã nhận', 'neutral', () => 'EchoKid sẽ chuyển cho chuyên gia trong 24 giờ.'],
  forwarded: ['Đã gửi chuyên gia', 'teal', () => 'Chuyên gia sẽ liên hệ ba mẹ để chốt lịch.'],
  confirmed: ['Đã hẹn', 'good', (r) => `Lịch hẹn: ${r.confirmedFor.slice(11)}, ${fmtFullDate(r.confirmedFor.slice(0, 10))}.`],
  done: ['Đã gặp', 'good', () => 'Ba mẹ tiếp tục ghi nhật ký để chuyên gia theo dõi tiến triển.'],
  cancelled: ['Đã hủy', 'warn', (r) => `${r.cancelReason ? `Lý do: ${r.cancelReason}. ` : ''}Ba mẹ có thể chọn chuyên gia khác.`],
};
function MyRequests({ requests, kids }) {
  return html`<section className="card my-requests" aria-labelledby="my-req-title">
    <h2 className="card-title" id="my-req-title"><${Icon} name="calendar" />Yêu cầu của ba mẹ</h2>
    <ul className="requests">${requests.map((r) => {
      const [label, tone, text] = REQUEST_STATUS[r.status] || REQUEST_STATUS.new;
      const kid = kids.find((k) => k.id === r.childId);
      return html`<li key=${r.id} className="request">
        <div className="request__top"><strong>${r.expert}</strong><span className=${`pill pill--${tone}`}>${label}</span></div>
        <p className="request__text">${text(r)}</p>
        <p className="request__meta">${kid ? `${kid.name} · ` : ''}mong muốn ${fmtFullDate(r.wantDate)} · ${r.slot} · gửi ${relDay(localISODate(new Date(r.createdAt))).toLowerCase()}, ${timeHM(new Date(r.createdAt))}</p>
      </li>`;
    })}</ul>
  </section>`;
}

/* Privacy and data (new; the repo has no equivalent yet): consent, the AI switch, export, deletion, request status. */
'use strict';

const PARENT_REQUEST_LABEL = { export: 'Gửi bản sao dữ liệu qua email', delete: 'Xóa tài khoản và dữ liệu', correct: 'Sửa thông tin hồ sơ bé', withdraw: 'Tắt gợi ý AI' };

function downloadJSON(name, data) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function PrivacyPage() {
  const { shared, toast, refreshShared } = useApp();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const load = useCallback(() => { getJSON('/api/account').then(setData).catch((e) => setError(e.message || 'Chưa tải được thông tin tài khoản.')); }, []);
  useEffect(load, [shared]);

  async function post(key, path, body, message) {
    setBusy(key);
    const res = await apiFetch(path, { method: 'POST', body: JSON.stringify(body || {}) });
    const out = await res.json();
    setBusy('');
    if (!res.ok) { toast(out.error || 'Chưa thực hiện được, ba mẹ thử lại nhé.'); return false; }
    toast(message); load(); refreshShared();
    return true;
  }
  async function download() {
    setBusy('download');
    try { downloadJSON(`EchoKid-du-lieu-${localISODate()}.json`, await getJSON('/api/account/export')); toast('Đã tải file dữ liệu về máy.'); }
    catch (e) { toast('Chưa tải được dữ liệu, ba mẹ thử lại nhé.'); }
    setBusy('');
  }

  if (error) return html`<div className="page"><${EmptyState} title="Chưa mở được trang này" text=${error} /></div>`;
  if (!data) return html`<div className="page"><${Skel} h=${40} w="50%" /><${Skel} h=${140} /><${Skel} h=${260} /></div>`;
  const f = data.family;
  const consentOk = f.consent.version === data.consentVersion;
  const open = (type) => data.requests.some((r) => r.type === type && r.status === 'open');
  const pendingDelete = f.status === 'pending_deletion' || open('delete');

  return html`<div className="page privacy-page">
    <header className="page-head">
      <h1>Quyền riêng tư và dữ liệu</h1>
      <p className="page-head__sub">Nhật ký của con là dữ liệu nhạy cảm. Ba mẹ quyết định EchoKid được làm gì với dữ liệu này, và có thể tải về hoặc xóa bất cứ lúc nào.</p>
    </header>

    ${consentOk ? html`<div className="status status--good"><${Icon} name="checkCircle" /><div><strong>Ba mẹ đã đồng ý điều khoản bản ${f.consent.version}</strong>
        <span>Ngày ${fmtFullDate(localISODate(new Date(f.consent.at)))}.</span></div></div>`
      : html`<section className="alert alert--warn" aria-labelledby="consent-title">
        <div className="alert__top"><span className="alert__icon"><${Icon} name="file" /></span><div className="alert__body">
          <p className="alert__eyebrow">Cần ba mẹ xem lại</p>
          <h2 className="alert__title" id="consent-title">EchoKid đã cập nhật điều khoản (bản ${data.consentVersion})</h2>
          <ul className="privacy-list">
            <li>Nhật ký được Gemini của Google phân tích ở gói trả phí; Google không dùng nội dung này để cải thiện sản phẩm.</li>
            <li>Nhóm điều hành chỉ thấy số liệu tổng hợp và mã gia đình ẩn danh. Liên hệ của ba mẹ chỉ được xem khi có cảnh báo an toàn, kèm lý do, và mọi lượt xem đều được ghi lại.</li>
            <li>Ba mẹ có thể tắt gợi ý AI, tải về hoặc xóa toàn bộ dữ liệu ngay trên trang này.</li>
          </ul></div></div>
        <div className="alert__actions"><${Btn} disabled=${busy === 'consent'} onClick=${() => post('consent', '/api/account/consent', {}, 'Cảm ơn ba mẹ. Đã lưu đồng ý bản mới.')}>${busy === 'consent' ? 'Đang lưu...' : `Tôi đồng ý với bản ${data.consentVersion}`}<//></div>
      </section>`}

    <div className="privacy-grid">
      <section className="card privacy-card" aria-labelledby="ai-title">
        <h2 id="ai-title"><${Icon} name="sparkle" />Gợi ý bằng AI</h2>
        <p>Khi tắt, ba mẹ vẫn ghi nhật ký như thường nhưng EchoKid không gửi nhật ký cho Gemini nữa. Từ khóa an toàn vẫn được kiểm tra để nhắc ba mẹ khi con có thể gặp nguy hiểm.</p>
        ${data.aiPaused && !f.aiOptOut && html`<p className="muted">Hiện nhóm EchoKid đang tạm dừng gợi ý AI cho mọi gia đình.</p>`}
        <${Seg} name="ai-optin" label="Dùng AI để gợi ý hoạt động" cols=${2} value=${f.aiOptOut ? 'off' : 'on'}
          options=${[{ value: 'on', label: 'Đang bật' }, { value: 'off', label: 'Đã tắt' }]}
          onChange=${(v) => post('ai', '/api/account/ai', { enabled: v === 'on' }, v === 'on' ? 'Đã bật lại gợi ý AI.' : 'Đã tắt gợi ý AI. Nhật ký vẫn được lưu.')} />
      </section>

      <section className="card privacy-card" aria-labelledby="export-title">
        <h2 id="export-title"><${Icon} name="file" />Tải dữ liệu của gia đình</h2>
        <p>Một file JSON gồm hồ sơ bé, toàn bộ nhật ký, gợi ý, phản hồi và yêu cầu gặp chuyên gia.</p>
        <div className="form-actions">
          <${Btn} disabled=${busy === 'download'} onClick=${download}><${Icon} name="file" />${busy === 'download' ? 'Đang chuẩn bị...' : 'Tải về máy'}<//>
          <${Btn} variant="secondary" disabled=${busy === 'export' || open('export')} onClick=${() => post('export', '/api/account/requests', { type: 'export' }, 'Đã gửi yêu cầu. EchoKid sẽ gửi link tải tới email của ba mẹ.')}>
            ${open('export') ? 'Đã yêu cầu gửi email' : 'Gửi bản sao qua email'}<//>
        </div>
      </section>

      <section className="card privacy-card" aria-labelledby="fix-title">
        <h2 id="fix-title"><${Icon} name="pencil" />Sửa thông tin</h2>
        <p>Tuổi hoặc thông tin hồ sơ của bé bị nhập sai? Gửi yêu cầu, nhóm EchoKid sẽ liên hệ để sửa giúp ba mẹ.</p>
        <div className="form-actions"><${Btn} variant="secondary" disabled=${busy === 'correct' || open('correct')} onClick=${() => post('correct', '/api/account/requests', { type: 'correct' }, 'Đã gửi yêu cầu sửa thông tin.')}>
          ${open('correct') ? 'Đã gửi yêu cầu' : 'Gửi yêu cầu sửa'}<//></div>
      </section>

      <section className="card privacy-card privacy-card--danger" aria-labelledby="delete-title">
        <h2 id="delete-title"><${Icon} name="alert" />Xóa tài khoản</h2>
        <p>Xóa tài khoản, hồ sơ bé, nhật ký, gợi ý, phản hồi và yêu cầu gặp chuyên gia. EchoKid xử lý trong 72 giờ và gửi email xác nhận trước khi xóa.</p>
        <div className="form-actions"><${Btn} variant="danger" disabled=${pendingDelete} onClick=${() => setConfirmDelete(true)}>${pendingDelete ? 'Đã gửi yêu cầu xóa' : 'Yêu cầu xóa tài khoản'}<//></div>
      </section>
    </div>

    <section className="section" aria-labelledby="req-title">
      <div className="section-head"><div><h2 id="req-title">Yêu cầu của ba mẹ</h2><p>Mã gia đình khi liên hệ hỗ trợ: <b>${f.code}</b>. Nhóm điều hành không thấy tên bé hay nội dung nhật ký.</p></div></div>
      ${data.requests.length === 0 ? html`<p className="muted">Chưa có yêu cầu nào.</p>` : html`<ul className="requests">${data.requests.map((r) => html`<li key=${r.id} className="request">
        <div className="request__top"><strong>${PARENT_REQUEST_LABEL[r.type]}</strong>
          <span className=${`pill pill--${r.status === 'open' ? 'warn' : 'good'}`}>${r.status === 'open' ? 'Đang xử lý' : 'Đã xong'}</span></div>
        <p className="request__meta">${r.id} · gửi ${relDay(localISODate(new Date(r.receivedAt))).toLowerCase()}, ${timeHM(new Date(r.receivedAt))}${r.status === 'open'
          ? ` · hạn ${fmtFullDate(localISODate(new Date(r.receivedAt + 72 * HOUR)))}` : r.doneAt ? ` · xong ${fmtFullDate(localISODate(new Date(r.doneAt)))}` : ''}</p>
      </li>`)}</ul>`}
    </section>

    <${Sheet} open=${confirmDelete} onClose=${() => setConfirmDelete(false)} busy=${busy === 'delete'} labelledBy="del-title" title="Xóa tài khoản EchoKid?"
      intro="Sau khi xóa, nhật ký và gợi ý của các bé không khôi phục được. Ba mẹ có thể tải dữ liệu về máy trước.">
      <${Fragment}>
        <${Btn} variant="secondary" onClick=${download}><${Icon} name="file" />Tải dữ liệu về máy trước<//>
        <div className="sheet__actions">
          <${Btn} variant="secondary" onClick=${() => setConfirmDelete(false)}>Giữ tài khoản<//>
          <${Btn} variant="danger" disabled=${busy === 'delete'} onClick=${async () => { if (await post('delete', '/api/account/requests', { type: 'delete' }, 'Đã gửi yêu cầu xóa. EchoKid sẽ email xác nhận.')) setConfirmDelete(false); }}>
            ${busy === 'delete' ? 'Đang gửi...' : 'Gửi yêu cầu xóa'}<//>
        </div>
      <//>
    <//>
  </div>`;
}

/* Moderator sections: safety & quality (alerts, expert requests, feedback) and system health. */
'use strict';

function SafetySection({ m }) {
  const c = m.current;
  const [seen, setSeen] = useState(() => new Set());
  const toggle = (id) => setSeen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const fb = Math.max(1, c.fbCount);
  return html`<section className="section admin-section" aria-labelledby="safety">
    <${SectionHead} id="safety" title="An toàn & chất lượng"
      sub="Chỉ hiện mã gia đình ẩn danh và nhóm tuổi. Tên bé, ghi chú và nội dung nhật ký không hiển thị ở trang này." />
    <div className="kpis">
      <${Stat} label="Cảnh báo cần chú ý" value=${fmtInt(c.high)} sub=${`${fmtInt(c.highFamilies)} gia đình nhận ít nhất một cảnh báo`} tone="crit" />
      <${Stat} label="Yêu cầu gặp chuyên gia" value=${fmtInt(c.booked)} sub=${`${pct(c.bookedFromAlert / Math.max(1, c.high), 0)} cảnh báo dẫn tới đặt lịch`} />
      <${Stat} label="Gợi ý được đánh giá hữu ích" value=${pct(c.fbHelpful / fb, 0)} sub=${`${fmtInt(c.fbCount)} phản hồi · ${pct(c.fbCount / Math.max(1, c.entries), 0)} lượt ghi có phản hồi`} />
      <${Stat} label="Mức phù hợp trung bình" value=${`${fmt1(c.ratingSum / fb)}/5`} sub="theo số sao ba mẹ chấm" />
    </div>
    <div className="stack-layout">
      <section className="card" aria-labelledby="alerts-title">
        <h3 className="card-title" id="alerts-title"><${Icon} name="alert" />Cảnh báo gần đây</h3>
        <p className="muted small">Theo dõi xem gia đình đã được nhắc gặp chuyên gia và đã gửi yêu cầu hay chưa. Nút "Đã xem" chỉ lưu trên máy này.</p>
        <div className="table-scroll"><table className="alert-table">
          <thead><tr><th scope="col">Thời gian</th><th scope="col">Gia đình</th><th scope="col">Tuổi bé</th><th scope="col">Lý do</th><th scope="col">Đặt lịch</th><th scope="col"><span className="sr-only">Đã xem</span></th></tr></thead>
          <tbody>${c.alerts.map((a) => html`<tr key=${a.id} className=${seen.has(a.id) ? 'is-seen' : ''}>
            <td className="num">${whenText(a)}</td><td className="num">${a.fam}</td><td>${a.band}</td><td>${a.reason}</td>
            <td>${a.booked ? html`<span className="pill pill--good"><${Icon} name="check" />Đã gửi</span>` : html`<span className="pill pill--warn">Chưa</span>`}</td>
            <td><button type="button" className="btn btn--quiet btn--sm" aria-pressed=${seen.has(a.id)} onClick=${() => toggle(a.id)}>${seen.has(a.id) ? 'Đã xem' : 'Đánh dấu'}</button></td>
          </tr>`)}</tbody>
        </table></div>
        <p className="note"><${Icon} name="info" />Yêu cầu đặt lịch hiện chưa được lưu: POST /api/expert chỉ trả lời "đã gửi". Cột này cần collection bookings ở backend.</p>
      </section>
      <section className="card" aria-labelledby="acts-title">
        <h3 className="card-title" id="acts-title"><${Icon} name="sparkle" />Hoạt động được gợi ý</h3>
        <div className="table-scroll"><table className="act-table">
          <thead><tr><th scope="col">Hoạt động</th><th scope="col">Lần gợi ý</th><th scope="col">Phản hồi</th><th scope="col">Hữu ích</th></tr></thead>
          <tbody>${c.activities.map((a) => html`<tr key=${a.key}>
            <th scope="row">${a.title}</th><td className="num">${fmtInt(a.count)}</td><td className="num">${fmtInt(a.fb)}</td>
            <td className="num"><span className="meter-cell">${a.fb ? pct(a.helpful / a.fb, 0) : '–'}<${Meter} value=${a.fb ? a.helpful / a.fb : 0} /></span></td>
          </tr>`)}</tbody>
        </table></div>
      </section>
    </div>
  </section>`;
}

function SystemSection({ m, d }) {
  const c = m.current;
  const failTotal = c.failures.API_ERROR + c.failures.AI_INVALID_RESPONSE;
  const readsPerEntry = c.reads / Math.max(1, c.entries);
  /* readsPerSession = 9 × history + 38, so recover the average history, then cap it at ~30 days of entries */
  const avgHistory = Math.max(0, (readsPerEntry - 38) / 9);
  const fixedPerEntry = readsPerSession(Math.min(avgHistory, (c.entries / Math.max(1, c.families) / c.days) * 30));
  const todo = [
    ['Ghi lại mỗi lượt gọi Gemini', 'Lưu response.usageMetadata (promptTokenCount, candidatesTokenCount, thoughtsTokenCount), thời gian chờ và lỗi vào collection aiCalls. Chi phí trên trang này tính từ đây.'],
    ['Lưu yêu cầu đặt lịch', 'POST /api/expert cần ghi vào collection bookings và báo cho chuyên gia; hiện ba mẹ thấy "đã gửi" nhưng không ai nhận được.'],
    ['Quyền điều hành', 'Thêm vai trò moderator cho tài khoản và route GET /api/admin/metrics chỉ trả số liệu tổng hợp, ẩn danh.'],
    ['Giờ Việt Nam', 'Giờ ghi nhận đang lấy từ toISOString() (UTC), lệch 7 tiếng. Lưu mốc thời gian đầy đủ và quy đổi khi hiển thị.'],
    ['Giới hạn truy vấn Firestore', "Thêm where('observedAt', '>=', mốc) vào getObservations() thay vì tải toàn bộ nhật ký rồi lọc."],
    ['Khóa /api/test', 'Route này gọi Gemini mà không cần đăng nhập.'],
  ];
  return html`<section className="section admin-section" aria-labelledby="system">
    <${SectionHead} id="system" title="Hệ thống" sub="Lỗi AI, Firestore và những việc backend cần làm để trang này dùng số liệu thật." />
    <div className="kpis">
      <${Stat} label="Lượt gọi Gemini" value=${fmtInt(c.calls)} sub=${`${fmtInt(c.billedCalls)} có tính phí · gồm ${fmtInt(c.calls - c.entries)} lượt thử lại`} />
      <${Stat} label="Độ trễ P95" value=${`${fmtInt(c.latency.p95)} ms`} sub=${`P50 ${fmtInt(c.latency.p50)} ms · lượt gọi thành công`} tone=${c.latency.p95 > 5000 ? 'warn' : ''} />
      <${Stat} label="Lượt gọi lỗi" value=${fmtInt(failTotal)} sub=${`${pct(failTotal / Math.max(1, c.calls))} tổng lượt gọi`} tone=${failTotal / Math.max(1, c.calls) > 0.03 ? 'crit' : ''} />
      <${Stat} label="Lượt đọc Firestore mỗi lần ghi" value=${fmtInt(readsPerEntry)} sub=${`sau khi sửa truy vấn ≈ ${fmtInt(fixedPerEntry)}`} tone="warn" />
      <${Stat} label="Chi phí Firestore" value=${usd(d.firestorePeriod)} sub=${`${fmtInt(c.reads / c.days)} lượt đọc mỗi ngày · miễn phí ${fmtInt(FIRESTORE.free.readsPerDay)}`} />
    </div>
    <div className="safety-layout">
      <section className="card" aria-labelledby="fail-title">
        <h3 className="card-title" id="fail-title"><${Icon} name="server" />Lỗi khi gọi Gemini</h3>
        <div className="table-scroll"><table className="fail-table">
          <thead><tr><th scope="col">Lỗi</th><th scope="col">Số lượt</th><th scope="col">Bị tính phí</th></tr></thead>
          <tbody>${Object.entries(FAILURES).map(([code, f]) => html`<tr key=${code}>
            <th scope="row"><code>${code}</code><span className="muted small">${f.label}</span></th>
            <td className="num">${fmtInt(c.failures[code])}</td><td>${f.billed ? 'Có' : 'Không'}</td></tr>`)}</tbody>
        </table></div>
        <p className="note"><${Icon} name="info" />Khoảng 70% lượt lỗi được ba mẹ bấm "Thử phân tích lại"; bản thiết kế mới chỉ gọi lại AI, không lưu nhật ký lần hai.</p>
      </section>
      <section className="card" aria-labelledby="todo-title">
        <h3 className="card-title" id="todo-title"><${Icon} name="checkCircle" />Để trang này dùng số liệu thật</h3>
        <ol className="todo">${todo.map(([t, x]) => html`<li key=${t}><strong>${t}</strong><span>${x}</span></li>`)}</ol>
      </section>
    </div>
  </section>`;
}

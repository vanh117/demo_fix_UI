/* Parent-app pieces that need the app router: links, escalation alert, report and feedback sheets. */
'use strict';

/* ---------- app context & navigation ---------- */
const AppCtx = createContext(null);

const useApp = () => useContext(AppCtx);

const PATH_TOKEN = { '/': 'home', '/login': 'login', '/children': 'children', '/dashboard': 'today', '/daily-log': 'diary', '/recommendation': 'advice', '/expert': 'expert', '/privacy': 'privacy' };

function Link({ to, params, className, children, onClick, ...rest }) {
  const { navigate } = useApp();
  return html`<a href=${'#' + (PATH_TOKEN[to] || 'home')} className=${className} ...${rest}
    onClick=${(e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      if (onClick) onClick(e);
      navigate(to, params);
    }}>${children}</a>`;
}

function LinkBtn({ variant = 'primary', size, block, className, ...rest }) {
  return html`<${Link} className=${cx('btn', 'btn--' + variant, size && 'btn--' + size, block && 'btn--block', className)} ...${rest} />`;
}

/* escalation: the "what to do now" block when EchoKid suggests an expert */
function EscalationAlert({ severity, message, child, childId, date, observationId, onReport }) {
  const high = severity === 'high';
  const titleId = 'alert-title-' + (observationId || 'x');
  return html`<section className=${cx('alert', high ? 'alert--crit' : 'alert--warn')} aria-labelledby=${titleId}>
    <div className="alert__top">
      <span className="alert__icon"><${Icon} name="alert" /></span>
      <div className="alert__body">
        <p className="alert__eyebrow">${high ? 'Cần chú ý' : 'Khuyến nghị'}</p>
        <h2 className="alert__title" id=${titleId}>Ba mẹ nên trao đổi với bác sĩ hoặc chuyên gia</h2>
        <p className="alert__msg">${message}</p>
      </div>
    </div>
    <div className="alert__actions">
      <${LinkBtn} to="/expert" params=${{ childId, date }} variant=${high ? 'danger' : 'primary'}><${Icon} name="steth" />Đặt lịch với chuyên gia<//>
      ${onReport && html`<${Btn} variant="secondary" onClick=${onReport}><${Icon} name="file" />Xem bản tóm tắt<//>`}
      ${observationId && html`<${LinkBtn} to="/recommendation" params=${{ childId, observationId }} variant="quiet">Xem việc nên làm ngay<//>`}
    </div>
    ${high && html`<p className="alert__foot"><${Icon} name="phone" /><span>Nếu ${child?.name || 'con'} có nguy cơ tự làm đau mình hoặc đang gặp nguy hiểm, hãy gọi cấp cứu <b>115</b> ngay.</span></p>`}
  </section>`;
}

/* GET /api/report preview. The real app downloads EchoKid-<name>.txt */
function ReportSheet({ open, onClose, child }) {
  const { toast } = useApp();
  const [text, setText] = useState('');
  const preRef = useRef(null);
  useEffect(() => {
    if (!open || !child) return;
    setText('');
    apiFetch(`/api/report?childId=${encodeURIComponent(child.id)}`).then((r) => r.text()).then(setText);
  }, [open, child?.id]);
  function copyText() {
    const done = () => toast('Đã sao chép bản tóm tắt.');
    const fallback = () => {
      const sel = window.getSelection(); const range = document.createRange();
      range.selectNodeContents(preRef.current); sel.removeAllRanges(); sel.addRange(range);
      toast('Đã chọn toàn bộ văn bản. Nhấn giữ hoặc Ctrl+C để sao chép.');
    };
    try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
  }
  return html`<${Sheet} open=${open} onClose=${onClose} labelledBy="report-title" title="Bản tóm tắt EchoKid"
    intro=${child ? `30 ngày nhật ký gần nhất của ${child.name}, sẵn sàng gửi cho chuyên gia.` : ''}>
    ${text ? html`<pre className="report-pre" ref=${preRef} tabIndex="0">${text}</pre>` : html`<${Skel} h=${220} />`}
    <p className="field__hint">Trên ứng dụng, nút tải sẽ lưu file EchoKid-${child?.name || ''}.txt về máy.</p>
    <div className="sheet__actions">
      <${Btn} variant="secondary" onClick=${onClose}>Đóng<//>
      <${Btn} onClick=${copyText} disabled=${!text}><${Icon} name="copy" />Sao chép<//>
    </div>
  <//>`;
}

/* components/recommendation-feedback.tsx, same validation and payload */
function FeedbackSheet({ open, onClose, childId, childName, observationId, title, onSaved }) {
  const [rating, setRating] = useState(5);
  const [wasHelpful, setWasHelpful] = useState(undefined);
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  async function submit(e) {
    e.preventDefault();
    if (wasHelpful === undefined) return setError('Vui lòng cho biết gợi ý có hữu ích với bé không.');
    if (!content.trim()) return setError('Vui lòng chia sẻ ngắn gọn kết quả sau khi thực hiện.');
    setSaving(true); setError('');
    try {
      const res = await apiFetch('/api/feedback', { method: 'POST', body: JSON.stringify({ childId, observationId, content: content.trim(), wasHelpful, rating }) });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? 'Không thể lưu phản hồi.');
      onSaved(payload.feedback);
    } catch (cause) { setError(cause.message || 'Không thể lưu phản hồi.'); }
    finally { setSaving(false); }
  }
  return html`<${Sheet} open=${open} onClose=${onClose} busy=${saving} labelledBy="feedback-title" title="Hoạt động diễn ra thế nào?"
    intro=${`Phản hồi cho “${title}” giúp EchoKid hiểu điều gì phù hợp với ${childName || 'bé'}.`}>
    <form className="sheet__body" onSubmit=${submit} noValidate>
      <fieldset className="field">
        <legend className="field__label">Gợi ý có hữu ích không?</legend>
        <${Seg} name="fb-helpful" label="Gợi ý có hữu ích không?" cols=${2}
          value=${wasHelpful === undefined ? '' : wasHelpful ? 'yes' : 'no'}
          options=${[{ value: 'yes', label: 'Có, hữu ích' }, { value: 'no', label: 'Chưa hữu ích' }]}
          onChange=${(v) => setWasHelpful(v === 'yes')} />
      </fieldset>
      <fieldset className="field">
        <legend className="field__label">Mức độ phù hợp</legend>
        <div className="stars">${[1, 2, 3, 4, 5].map((v) => html`<button key=${v} type="button" className=${v <= rating ? 'is-on' : ''}
          aria-label=${`${v} sao`} aria-pressed=${v === rating} onClick=${() => setRating(v)}><${Icon} name="star" className="icon--fill" /></button>`)}</div>
      </fieldset>
      <div className="field">
        <label className="field__label" htmlFor="fb-content">Kết quả sau khi thực hiện</label>
        <textarea id="fb-content" className="textarea" rows="4" value=${content} onChange=${(e) => setContent(e.target.value)}
          placeholder="Ví dụ: Bé tham gia khoảng 5 phút, bình tĩnh hơn và chủ động giao tiếp..."></textarea>
      </div>
      ${error && html`<p className="form-error" role="alert"><${Icon} name="info" />${error}</p>`}
      <div className="sheet__actions">
        <${Btn} variant="secondary" onClick=${onClose} disabled=${saving}>Để sau<//>
        <${Btn} type="submit" disabled=${saving}>${saving ? 'Đang ghi nhận...' : 'Gửi phản hồi'}<//>
      </div>
    </form>
  <//>`;
}

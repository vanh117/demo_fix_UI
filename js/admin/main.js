/* Moderator console: header, section navigation, range filter, pricing state, render. */
'use strict';

const ADMIN_ROLES = {
  admin: { label: 'Quản trị viên', short: 'Toàn quyền', tone: 'teal', sections: ['overview', 'hours', 'ai', 'forecast', 'safety', 'system'], summary: 'Toàn bộ số liệu, chi phí, an toàn và vận hành.' },
  backend: { label: 'Backend / SRE', short: 'Vận hành', tone: 'neutral', sections: ['hours', 'system'], summary: 'Tải hệ thống, độ trễ, lỗi API và Firestore.' },
  analytics: { label: 'Phân tích dữ liệu', short: 'Analytics', tone: 'warn', sections: ['overview', 'hours', 'ai', 'forecast'], summary: 'Xu hướng sử dụng, quy mô người dùng và chi phí.' },
};
const ADMIN_SECTIONS = [['overview', 'Tổng quan'], ['hours', 'Khung giờ'], ['ai', 'Chi phí AI'], ['forecast', 'Dự báo'], ['safety', 'An toàn'], ['system', 'Hệ thống']];
const ADMIN_RANGES = [{ value: '7', label: '7 ngày' }, { value: '30', label: '30 ngày' }, { value: '90', label: '90 ngày' }];

/* cost figures for the chosen period at the chosen prices */
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

function AdminProtoBar({ theme, setTheme }) {
  const next = { auto: 'light', light: 'dark', dark: 'auto' }[theme];
  const label = { auto: 'Theo máy', light: 'Sáng', dark: 'Tối' }[theme];
  return html`<div className="proto-bar"><div className="container proto-bar__inner">
    <span className="proto-bar__text"><b>Bản mẫu trang điều hành</b> · dữ liệu giả lập</span>
    <span className="proto-bar__actions">
      <button type="button" className="proto-bar__btn" onClick=${() => setTheme(next)} aria-label=${`Giao diện: ${label}. Bấm để đổi.`}>
        <${Icon} name=${theme === 'dark' ? 'moon' : 'sun'} />${label}</button>
    </span>
  </div></div>`;
}

function AdminHeader({ role }) {
  const meta = ADMIN_ROLES[role];
  return html`<header className="app-header"><div className="container app-header__inner">
    <a className="brand" href="index.html" aria-label="EchoKid, mở ứng dụng phụ huynh"><${Brand} /></a>
    <span className=${`pill pill--${meta.tone} admin-badge`}><${Icon} name="shield" />${meta.short}</span>
    <div className="header-right">
      <a className="btn btn--quiet btn--sm admin-applink" href="index.html"><${Icon} name="external" />Ứng dụng phụ huynh</a>
      <span className="admin-who"><${Avatar} name="Lan Anh" tone=${2} size=${36} /><span>Lan Anh</span></span>
    </div>
  </div></header>`;
}

function AdminApp() {
  const [theme, setThemeState] = useState(() => {
    const t = (location.hash || '').replace(/^#/, '').split('.').find((x) => x === 'dark' || x === 'light') || 'auto';
    applyTheme(t);
    return t;
  });
  const [range, setRange] = useState(30);
  const [m, setM] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modelId, setModelId] = useState(CURRENT_MODEL);
  const [period, setPeriod] = useState('now');
  const [custom, setCustom] = useState(null);
  const [rpmLimit, setRpmLimit] = useState('');
  const [role, setRole] = useState(() => {
    const requested = new URLSearchParams(location.search).get('role');
    return ADMIN_ROLES[requested] ? requested : 'admin';
  });
  const roleMeta = ADMIN_ROLES[role];
  const canSee = (id) => roleMeta.sections.includes(id);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    adminFetch(`/api/admin/metrics?range=${range}&role=${role}`).then((r) => r.json()).then((b) => alive && setM(b)).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [range, role]);

  const price = custom || listedPrice(modelId, period);
  const pricing = {
    modelId, period, price, custom: !!custom, setCustom,
    setModelId: (id) => { setModelId(id); setPeriod('now'); setCustom(null); },
    setPeriod: (p) => { setPeriod(p); setCustom(null); },
    reset: () => setCustom(null),
  };
  const d = useMemo(() => (m ? deriveCosts(m, price) : null), [m, price.input, price.output]);
  const setTheme = (t) => { applyTheme(t); setThemeState(t); };

  return html`<${Fragment}>
    <${AdminProtoBar} theme=${theme} setTheme=${setTheme} />
    <${AdminHeader} role=${role} />
    <nav className="section-nav" aria-label="Các mục"><div className="container section-nav__inner">
      ${ADMIN_SECTIONS.filter(([id]) => canSee(id)).map(([id, label]) => html`<a key=${id} href=${'#' + id}>${label}</a>`)}
    </div></nav>
    <main className="container admin-main">
      <header className="page-head">
        <p className="page-head__kicker">Không gian điều hành · ${roleMeta.label}</p>
        <h1>Bảng điều hành EchoKid</h1>
        <p className="page-head__sub">Số liệu tổng hợp, ẩn danh của mọi gia đình dùng EchoKid${m ? `, cập nhật lúc ${timeHM(new Date(m.generatedAt))}` : ''}.</p>
      </header>
      <section className="access-panel" aria-labelledby="access-title">
        <div className="access-panel__copy"><span className="access-panel__eyebrow"><${Icon} name="shield" />Phạm vi truy cập</span><h2 id="access-title">${roleMeta.short}</h2><p>${roleMeta.summary}</p></div>
        <label className="field access-panel__select"><span className="field__label">Xem với vai trò</span><select className="input" value=${role} onChange=${(e) => { setRole(e.target.value); history.replaceState(null, '', `?role=${e.target.value}`); }}>
          ${Object.entries(ADMIN_ROLES).map(([value, item]) => html`<option key=${value} value=${value}>${item.label}</option>`)}
        </select></label>
        <div className="access-panel__permissions">${roleMeta.sections.map((id) => { const section = ADMIN_SECTIONS.find(([key]) => key === id); return html`<span key=${id} className="access-tag"><${Icon} name="check" />${section[1]}</span>`; })}</div>
      </section>
      <div className="filter-row">
        <${Seg} name="admin-range" label="Khoảng thời gian" className="tabs-switch" value=${String(range)} options=${ADMIN_RANGES} onChange=${(v) => setRange(Number(v))} />
        <span className="muted small">Áp dụng cho mọi số liệu bên dưới, trừ phần Dự báo.</span>
      </div>
      ${!m ? html`<div className="admin-body"><div className="kpis kpis--6">${[1, 2, 3, 4, 5, 6].map((i) => html`<${Skel} key=${i} h=${118} />`)}</div><${Skel} h=${260} /><${Skel} h=${320} /></div>`
        : html`<div className=${cx('admin-body', loading && 'is-refreshing')} aria-busy=${loading}>
          ${canSee('overview') && html`<${OverviewSection} m=${m} d=${d} />`}
          ${canSee('hours') && html`<${HoursSection} m=${m} rpmLimit=${rpmLimit} setRpmLimit=${setRpmLimit} />`}
          ${canSee('ai') && html`<${AiCostSection} m=${m} d=${d} pricing=${pricing} />`}
          ${canSee('forecast') && html`<${ForecastSection} m=${m} pricing=${pricing} />`}
          ${canSee('safety') && html`<${SafetySection} key=${range} m=${m} />`}
          ${canSee('system') && html`<${SystemSection} m=${m} d=${d} />`}
        </div>`}
    </main>
    <footer className="container site-footer admin-foot">
      <p><strong>Quyền riêng tư:</strong> trang này chỉ hiện số liệu tổng hợp và mã gia đình ẩn danh. Tên bé, ghi chú và nội dung nhật ký không hiển thị ở đây.</p>
      <p>Dữ liệu mẫu, sinh ngẫu nhiên với hạt giống cố định. Giá Gemini API và Firestore (nam5) kiểm tra ngày ${PRICE_CHECKED}.</p>
    </footer>
  <//>`;
}

ReactDOM.createRoot(document.getElementById('app')).render(html`<${AdminApp} />`);

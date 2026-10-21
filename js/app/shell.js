/* App shell (components/app-shell.tsx + navbar.tsx) and the prototype-only controls. */
'use strict';

/* ---------- shell (components/app-shell.tsx + navbar.tsx) ---------- */
const NAV = [
  { path: '/dashboard', label: 'Hôm nay', icon: 'sun' },
  { path: '/daily-log', label: 'Nhật ký', icon: 'book' },
  { path: '/recommendation', label: 'Gợi ý', icon: 'sparkle' },
  { path: '/expert', label: 'Chuyên gia', icon: 'steth' },
];

const PUBLIC = new Set(['/', '/login']);

function navParams(path, childId) {
  if (!childId) return {};
  if (path === '/expert') return { childId, date: localISODate() };
  return { childId };
}

function AccountMenu() {
  const { session, signOut } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return html`<div className="account" ref=${ref}>
    <button type="button" className="account__btn" aria-expanded=${open} aria-haspopup="true" aria-label="Tài khoản" onClick=${() => setOpen((v) => !v)}>
      <${Avatar} name=${session.name} tone=${1} size=${36} /></button>
    ${open && html`<div className="account__menu">
      <div className="account__who"><strong>${session.name}</strong><small>${session.email}</small></div>
      <${Link} to="/children" className="menu-item" onClick=${() => setOpen(false)}><${Icon} name="users" />Hồ sơ các bé<//>
      <${Link} to="/privacy" className="menu-item" onClick=${() => setOpen(false)}><${Icon} name="shield" />Quyền riêng tư và dữ liệu<//>
      <button type="button" className="menu-item" onClick=${signOut}><${Icon} name="logout" />Đăng xuất</button>
    </div>`}
  </div>`;
}

function AppHeader() {
  const { route, activeChildId, activeChild, toneOf } = useApp();
  return html`<header className="app-header"><div className="container app-header__inner">
    <${Link} to="/dashboard" params=${navParams('/dashboard', activeChildId)} className="brand" aria-label="EchoKid, về trang Hôm nay"><${Brand} /><//>
    <nav className="nav-tabs" aria-label="Điều hướng chính">
      ${NAV.map((item) => html`<${Link} key=${item.path} to=${item.path} params=${navParams(item.path, activeChildId)} className="nav-tab"
        aria-current=${route.path === item.path ? 'page' : undefined}><${Icon} name=${item.icon} />${item.label}<//>`)}
    </nav>
    <div className="header-right">
      ${activeChild
        ? html`<${Link} to="/children" className="child-chip" aria-label=${`Đang xem ${activeChild.name}. Đổi hồ sơ bé`}>
            <${Avatar} name=${activeChild.name} tone=${toneOf(activeChild.id)} size=${36} ring />
            <span className="child-chip__name">${activeChild.name}</span><span className="child-chip__switch">Đổi bé</span><${Icon} name="chevronDown" /><//>`
        : html`<${Link} to="/children" className="child-chip child-chip--empty"><${Icon} name="users" />Chọn bé<//>`}
      <${AccountMenu} />
    </div>
  </div></header>`;
}

function TabBar() {
  const { route, activeChildId } = useApp();
  return html`<nav className="tabbar" aria-label="Điều hướng"><div className="tabbar__inner">
    ${NAV.map((item) => html`<${Link} key=${item.path} to=${item.path} params=${navParams(item.path, activeChildId)}
      aria-current=${route.path === item.path ? 'page' : undefined}><span className="tabbar__icon"><${Icon} name=${item.icon} /></span>${item.label}<//>`)}
  </div></nav>`;
}

/* notices from the moderator console: the live announcement, and the account's own state */
const NOTICE_KIND = { info: ['info', 'info'], maintenance: ['warn', 'server'], incident: ['crit', 'alert'] };
function SharedNotices() {
  const { shared } = useApp();
  const [hidden, setHidden] = useState(() => { try { return JSON.parse(localStorage.getItem('echokid.hiddenNotices') || '[]'); } catch (e) { return []; } });
  const ann = liveAnnouncement(shared.announcements);
  const fam = shared.family || {};
  const hide = (id) => { const next = [...hidden, id]; setHidden(next); try { localStorage.setItem('echokid.hiddenNotices', JSON.stringify(next)); } catch (e) { /* this visit only */ } };
  const when = (ms) => `${timeHM(new Date(ms))}, ${fmtFullDate(localISODate(new Date(ms)))}`;
  const items = [];
  if (fam.status === 'pending_deletion') items.push(html`<div key="del" className="notice notice--crit" role="status"><${Icon} name="alert" />
    <div><strong>Tài khoản sẽ được xóa lúc ${when(fam.deleteAt)}</strong><p>Theo yêu cầu của ba mẹ. Nếu đổi ý, hãy trả lời email xác nhận của EchoKid trước thời điểm này.</p></div></div>`);
  if (ann && !hidden.includes(ann.id)) {
    const [tone, icon] = NOTICE_KIND[ann.kind] || NOTICE_KIND.info;
    items.push(html`<div key=${ann.id} className=${`notice notice--${tone}`} role="status"><${Icon} name=${icon} />
      <div><strong>${ann.title}</strong><p>${ann.body}</p></div>
      <button type="button" className="notice__close" aria-label="Ẩn thông báo này" onClick=${() => hide(ann.id)}><${Icon} name="x" /></button></div>`);
  }
  return items.length ? html`<div className="notices">${items}</div>` : null;
}

function AppShell({ children }) {
  const { route, session, navigate, shared } = useApp();
  useEffect(() => {
    if (!session) navigate('/login', { callbackUrl: { path: route.path, params: route.params } }, { replace: true });
  }, [session]);
  if (!session) return html`<div className="auth-loading"><${Skel} h=${160} w="min(520px, 80vw)" /><p>Đang kiểm tra phiên đăng nhập...</p></div>`;
  const suspended = shared.family?.status === 'suspended';
  return html`<${Fragment}><${AppHeader} /><main className="app-main"><div className="container"><${SharedNotices} />
    ${suspended ? html`<div className="page"><${EmptyState} icon="lock" title="Tài khoản đang tạm khóa"
      text="Nhóm EchoKid đã tạm khóa tài khoản này để bảo vệ ba mẹ và bé. Dữ liệu vẫn được giữ nguyên. Liên hệ hotro@echokid.example để được mở lại." /></div>` : children}
  </div></main><${TabBar} /><//>`;
}

/* ---------- prototype controls (not part of the product) ---------- */
function ProtoBar() {
  const { setDemoOpen } = useApp();
  return html`<div className="proto-bar"><div className="container proto-bar__inner">
    <span className="proto-bar__text"><b>Bản mẫu thiết kế EchoKid</b> · dữ liệu giả lập, bấm thử được</span>
    <span className="proto-bar__actions">
      <a className="proto-bar__btn proto-bar__btn--wide" href="admin.html"><${Icon} name="chart" />Trang điều hành</a>
      <button type="button" className="proto-bar__btn" onClick=${() => setDemoOpen(true)}><${Icon} name="sliders" />Điều khiển</button>
    </span>
  </div></div>`;
}

const SCREENS = [['Giới thiệu', '/'], ['Đăng nhập', '/login'], ['Chọn bé', '/children'], ['Hôm nay', '/dashboard'], ['Nhật ký', '/daily-log'], ['Gợi ý', '/recommendation'], ['Chuyên gia', '/expert'], ['Quyền riêng tư', '/privacy']];

const SCENARIOS = [
  { value: 'stable', label: 'Ổn định' },
  { value: 'alert', label: 'Cần chú ý' },
  { value: 'new', label: 'Tài khoản mới' },
];

function DemoPanel() {
  const app = useApp();
  const { demo, demoOpen, setDemoOpen } = app;
  const go = (path) => { setDemoOpen(false); app.jump(path); };
  return html`<${Sheet} open=${demoOpen} onClose=${() => setDemoOpen(false)} labelledBy="demo-title" title="Điều khiển bản mẫu"
    intro="Chuyển màn hình và tình huống để xem mọi trạng thái của thiết kế. Phần này không có trong ứng dụng thật.">
    <div className="demo">
      <div><h3>Màn hình</h3><div className="demo__screens">${SCREENS.map(([label, path]) => html`<${Btn} key=${path} variant="secondary" size="sm" onClick=${() => go(path)}>${label}<//>`)}
        <a className="btn btn--secondary btn--sm" href="admin.html"><${Icon} name="chart" />Trang điều hành</a></div></div>
      <fieldset><legend><h3>Tình huống dữ liệu</h3></legend>
        <${Seg} name="demo-scenario" label="Tình huống dữ liệu" value=${demo.scenario} options=${SCENARIOS} onChange=${(v) => { setDemoOpen(false); app.setScenario(v); }} />
        <p className="demo__note" style=${{ marginTop: 8 }}>“Cần chú ý” thêm ba lần ghi khó khăn hôm nay để thấy cảnh báo gặp chuyên gia. “Tài khoản mới” bắt đầu chưa có hồ sơ bé.</p>
      </fieldset>
      <label className="check-row"><input type="checkbox" checked=${demo.aiError} onChange=${(e) => app.setAiError(e.target.checked)} />Giả lập lỗi AI khi lưu nhật ký</label>
      <fieldset><legend><h3>Giao diện</h3></legend>
        <${Seg} name="demo-theme" label="Giao diện" value=${demo.theme} onChange=${app.setTheme}
          options=${[{ value: 'auto', label: 'Theo máy' }, { value: 'light', label: 'Sáng' }, { value: 'dark', label: 'Tối' }]} /></fieldset>
      <div><h3>Kết nối với trang điều hành</h3>
        <p className="demo__note">Mở <a href="admin.html" target="_blank" rel="noopener">trang điều hành</a> ở tab khác. Yêu cầu chuyên gia, cảnh báo an toàn, đánh giá thấp và yêu cầu về dữ liệu sẽ hiện ở đó ngay; thông báo, tạm dừng AI và danh sách chuyên gia đi theo chiều ngược lại.</p></div>
      <${Btn} variant="quiet" onClick=${() => { setDemoOpen(false); app.setScenario(demo.scenario); }}><${Icon} name="refresh" />Đặt lại dữ liệu mẫu<//>
      <${Btn} variant="quiet" onClick=${() => { bridge.reset(); setDemoOpen(false); app.setScenario(demo.scenario); app.refreshShared(); }}><${Icon} name="x" />Xóa dữ liệu dùng chung với trang điều hành<//>
      <p className="demo__note">Nhật ký mẫu nằm trong trình duyệt và được tạo lại khi tải trang. Dữ liệu dùng chung với trang điều hành được giữ lại cho tới khi xóa.</p>
    </div>
  <//>`;
}

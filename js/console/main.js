/* Console boot: page registry, hash routing (#/alerts/CA-2100), session state, shared pricing, render. */
'use strict';

const CONSOLE_PAGES = [
  { id: 'overview', group: 'monitor', label: 'Tổng quan', icon: 'home', perm: 'metrics', C: OverviewPage },
  { id: 'hours', group: 'monitor', label: 'Khung giờ sử dụng', icon: 'clock', perm: 'metrics', C: HoursPage },
  { id: 'cost', group: 'monitor', label: 'Chi phí AI', icon: 'coin', perm: 'cost', C: CostPage },
  { id: 'forecast', group: 'monitor', label: 'Dự báo chi phí', icon: 'trendUp', perm: 'cost', C: ForecastPage },
  { id: 'alerts', group: 'support', label: 'Cảnh báo an toàn', icon: 'alert', perm: 'cases', C: AlertsPage },
  { id: 'bookings', group: 'support', label: 'Yêu cầu chuyên gia', icon: 'inbox', perm: 'bookings', C: BookingsPage },
  { id: 'experts', group: 'support', label: 'Chuyên gia', icon: 'steth', perm: 'experts', C: ExpertsPage },
  { id: 'accounts', group: 'support', label: 'Tài khoản và dữ liệu', icon: 'users', perm: 'accounts', C: AccountsPage },
  { id: 'ai', group: 'ops', label: 'Điều khiển AI', icon: 'sliders', perm: 'ai', C: AiPage },
  { id: 'quality', group: 'ops', label: 'Chất lượng gợi ý', icon: 'star', perm: 'quality', C: QualityPage },
  { id: 'system', group: 'ops', label: 'Hệ thống và lỗi', icon: 'server', perm: 'system', C: SystemPage },
  { id: 'announce', group: 'ops', label: 'Thông báo phụ huynh', icon: 'megaphone', perm: 'announce', C: AnnouncePage },
  { id: 'team', group: 'admin', label: 'Nhóm điều hành', icon: 'shield', perm: 'team', C: TeamPage },
  { id: 'audit', group: 'admin', label: 'Nhật ký kiểm tra', icon: 'history', perm: 'audit', C: AuditPage },
];

function parseRoute() {
  const [page = '', id = ''] = (location.hash || '').replace(/^#\/?/, '').split('/');
  return { page: decodeURIComponent(page), id: decodeURIComponent(id) || null };
}
const go = (href) => { if (location.hash !== href) location.hash = href; };

/* prototype: ?as=m-3 signs in as another member, ?theme=dark forces a theme */
function bootPrototype() {
  const p = new URLSearchParams(location.search);
  const as = p.get('as');
  if (as === 'outsider') mockAuth.outsider = true;
  else if (TEAM_SEED.some((m) => m.id === as && m.status === 'active')) mockAuth.memberId = as;
  const theme = ['auto', 'light', 'dark'].includes(p.get('theme')) ? p.get('theme') : readPref('echokid.theme', 'auto');
  applyTheme(theme);
  return { theme, signedOut: as === 'signout' };
}

function usePricing(inUse) {
  const [p, setP] = useState({ modelId: CURRENT_MODEL, period: 'now', custom: null, touched: false });
  return {
    ...p, inUse, custom: !!p.custom, price: p.custom || listedPrice(p.modelId, p.period),
    adopt: (id) => setP((x) => (x.touched ? x : { ...x, modelId: id })),
    setModelId: (id) => setP({ modelId: id, period: 'now', custom: null, touched: true }),
    setPeriod: (v) => setP((x) => ({ ...x, period: v, custom: null, touched: true })),
    setCustom: (c) => setP((x) => ({ ...x, custom: c, touched: true })),
    reset: () => setP((x) => ({ ...x, custom: null })),
  };
}

function ConsoleApp() {
  const boot = useMemo(bootPrototype, []);
  const [theme, setThemeState] = useState(boot.theme);
  const [auth, setAuth] = useState(boot.signedOut ? 'signedOut' : 'ok');
  const [route, setRoute] = useState(parseRoute);
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [range, setRange] = useState(30);
  const [memberId, setMemberId] = useState(mockAuth.outsider ? 'outsider' : mockAuth.memberId);
  const session = useApi(auth === 'signedOut' || auth === 'denied' ? null : `/api/admin/session?m=${memberId}`);
  const summary = useApi(session.data ? '/api/admin/summary' : null);
  const pricing = usePricing(summary.data?.ai.model || CURRENT_MODEL);

  useEffect(() => { dataBus.onAuth = (state) => setAuth((cur) => (cur === 'signedOut' ? cur : state)); return () => { dataBus.onAuth = null; }; }, []);
  /* the parent app (another tab) wrote to the shared state: merge it and say what arrived */
  useEffect(() => bridge.subscribe(() => {
    if (!srv) return;
    const fresh = syncBridge();
    refreshAll();
    const lines = [
      ...fresh.raised.map((c) => [`Cảnh báo mới từ gia đình ${c.fam}: ca ${c.id} (P${c.priority})`, c.priority === 1 ? 'crit' : 'good']),
      ...fresh.bookings.map((b) => [`Yêu cầu gặp chuyên gia mới: ${b.id}`, 'good']),
      ...fresh.reviews.map((r) => [`Gợi ý bị chấm ${r.rating} sao chờ rà soát: ${r.id}`, 'good']),
      ...fresh.dataRequests.map((r) => [`Yêu cầu về dữ liệu mới: ${DATA_REQ[r.type].label}`, 'good']),
    ];
    lines.slice(0, 3).forEach(([text, tone]) => toast(text, tone));
  }), []);
  useEffect(() => {
    const onHash = () => { setRoute(parseRoute()); setMenuOpen(false); };
    const onKey = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen(true); } };
    window.addEventListener('hashchange', onHash);
    document.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('hashchange', onHash); document.removeEventListener('keydown', onKey); };
  }, []);

  const setTheme = (t) => { applyTheme(t); writePref('echokid.theme', t); setThemeState(t); };
  const signIn = () => { mockAuth.expired = false; mockAuth.outsider = memberId === 'outsider'; setAuth('ok'); refreshAll(); };
  const switchMember = (id) => {
    mockAuth.expired = false;
    if (id === 'signout') { setAuth('signedOut'); return; }
    mockAuth.outsider = id === 'outsider';
    if (id !== 'outsider') mockAuth.memberId = id;
    setMemberId(id); setAuth('ok');
    go('#/overview'); refreshAll();
  };
  const signOut = () => setAuth('signedOut');
  const bar = html`<${ProtoBar} theme=${theme} setTheme=${setTheme} onSwitch=${switchMember} current=${auth === 'signedOut' ? 'signout' : memberId} />`;

  if (auth === 'signedOut') return html`<${Fragment}>${bar}<${SignInScreen} onSignIn=${() => switchMember(memberId === 'outsider' ? 'm-1' : memberId)} /><${Toasts} /><//>`;
  if (auth === 'denied') return html`<${Fragment}>${bar}<${DeniedScreen} onSwitch=${() => switchMember('m-1')} /><${Toasts} /><//>`;
  if (!session.data) {
    return html`<${Fragment}>${bar}<main className="mx-auto max-w-md px-4 py-24">${session.error && session.error.status !== 401
      ? html`<${ErrorCard} error=${session.error} onRetry=${session.reload} />`
      : html`<div className="space-y-3"><${Skel} h=${64} /><${Skel} h=${180} /></div>`}</main>
      <${ExpiredModal} open=${auth === 'expired'} onSignIn=${signIn} /><//>`;
  }

  const me = { ...session.data.member, perms: session.data.perms };
  const allowed = CONSOLE_PAGES.filter((p) => me.perms.includes(p.perm));
  const page = CONSOLE_PAGES.find((p) => p.id === route.page);
  if (!page && allowed[0]) { location.replace(`#/${allowed[0].id}`); return null; }
  const permitted = page && me.perms.includes(page.perm);
  document.title = `${page ? page.label : 'Điều hành'} · EchoKid`;
  const Page = page?.C;
  const navProps = { pages: CONSOLE_PAGES, me, route, summary: summary.data };
  return html`<${Fragment}>
    <a href="#main" className="sr-only z-50 rounded-xl bg-surface px-4 py-2 font-semibold focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Bỏ qua tới nội dung</a>
    ${bar}
    <div className="lg:flex">
      <${Sidebar} ...${navProps} />
      <div className="min-w-0 flex-1">
        <${Topbar} me=${me} onMenu=${() => setMenuOpen(true)} onSearch=${() => setPaletteOpen(true)} onSignOut=${signOut} />
        <${AiPausedBanner} ai=${summary.data?.ai} me=${me} />
        <main id="main" className="mx-auto w-full max-w-[1360px] px-4 pb-16 pt-6 sm:px-6 lg:px-8 lg:pt-8">
          ${permitted ? html`<${Page} key=${`${page.id}:${me.id}`} me=${me} route=${route} go=${go} range=${range} setRange=${setRange} pricing=${pricing} />`
            : html`<${NoAccess} page=${page} first=${allowed[0]} />`}
        </main>
      </div>
    </div>
    <${MobileNav} open=${menuOpen} onClose=${() => setMenuOpen(false)} ...${navProps} />
    <${CommandPalette} open=${paletteOpen} onClose=${() => setPaletteOpen(false)} pages=${CONSOLE_PAGES} me=${me} go=${go} />
    <${ExpiredModal} open=${auth === 'expired'} onSignIn=${signIn} />
    <${Toasts} />
  <//>`;
}

ReactDOM.createRoot(document.getElementById('app')).render(html`<${ConsoleApp} />`);

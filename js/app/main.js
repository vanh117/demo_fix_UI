/* Boot: reads #screen tokens, seeds sample data, renders <App />. */
'use strict';

/* ---------- App ---------- */
const TOKEN_PATH = { home: '/', login: '/login', children: '/children', today: '/dashboard', dashboard: '/dashboard', diary: '/daily-log', advice: '/recommendation', expert: '/expert', privacy: '/privacy' };

function readBoot() {
  const tokens = (location.hash || '').replace(/^#/, '').split('.').filter(Boolean);
  const boot = { path: '/', scenario: 'stable', aiError: false, theme: 'auto' };
  for (const t of tokens) {
    if (TOKEN_PATH[t]) boot.path = TOKEN_PATH[t];
    else if (SCENARIOS.some((s) => s.value === t)) boot.scenario = t;
    else if (t === 'aierror') boot.aiError = true;
    else if (t === 'dark' || t === 'light') boot.theme = t;
  }
  return boot;
}

function App() {
  const boot = useMemo(() => {
    const b = readBoot();
    seedDb(b.scenario);
    syncFamily();
    mock.aiError = b.aiError;
    applyTheme(b.theme);
    const signedIn = !PUBLIC.has(b.path);
    mock.session = signedIn ? USER : null;
    const kid = db.children[0]?.id;
    b.route = { path: b.path, params: signedIn && kid && b.path !== '/children' ? navParams(b.path, kid) : {} };
    b.session = mock.session;
    return b;
  }, []);
  const [route, setRoute] = useState(boot.route);
  const [session, setSession] = useState(boot.session);
  const [kids, setKids] = useState(null);
  const [kidsError, setKidsError] = useState('');
  const [lastChildId, setLastChildId] = useState(boot.route.params.childId || null);
  const [demo, setDemo] = useState({ scenario: boot.scenario, aiError: boot.aiError, theme: boot.theme, version: 0 });
  const [demoOpen, setDemoOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  /* what the moderator console shares: announcements, AI pause, expert list, request statuses (another tab writes it) */
  const [shared, setShared] = useState(() => bridge.read());
  useEffect(() => bridge.subscribe(() => setShared(bridge.read())), []);

  const navigate = useCallback((path, params = {}) => {
    const clean = Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== ''));
    setRoute({ path, params: clean });
    if (clean.childId) setLastChildId(clean.childId);
    window.scrollTo(0, 0);
  }, []);
  const toast = useCallback((text) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  const loadKids = useCallback(() => {
    setKidsError('');
    getJSON('/api/children').then((d) => setKids(d.children ?? [])).catch(() => setKidsError('Không thể tải hồ sơ bé.'));
  }, []);
  useEffect(() => { if (session) loadKids(); else setKids(null); }, [session, demo.version]);

  const activeChildId = route.params.childId || (PUBLIC.has(route.path) ? null : lastChildId);
  const activeChild = (kids || []).find((k) => k.id === activeChildId) || null;
  const firstKidId = () => (kids && kids[0]?.id) || db.children[0]?.id || null;

  const value = {
    route, navigate, session, kids, kidsError, toast, demo, demoOpen, setDemoOpen, shared, refreshShared: () => setShared(bridge.read()),
    activeChildId: activeChild ? activeChildId : null, activeChild,
    toneOf: (id) => Math.max(0, (kids || []).findIndex((k) => k.id === id)),
    addKid: (child) => setKids((k) => [...(k || []), child]),
    signIn: () => { mock.session = USER; setSession(USER); },
    signOut: () => { mock.session = null; setSession(null); setLastChildId(null); navigate('/'); },
    startApp: () => { const k = lastChildId || firstKidId(); navigate(k ? '/dashboard' : '/children', k ? { childId: k } : {}); },
    jump: (path) => {
      if (!PUBLIC.has(path) && !session) { mock.session = USER; setSession(USER); }
      const k = lastChildId || firstKidId();
      navigate(path, path === '/children' || PUBLIC.has(path) ? {} : navParams(path, k));
    },
    setScenario: (scenario) => {
      seedDb(scenario);
      syncFamily();
      setShared(bridge.read());
      setDemo((d) => ({ ...d, scenario, version: d.version + 1 }));
      setKids(null);
      if (!session) { mock.session = USER; setSession(USER); }
      const k = db.children[0]?.id;
      setLastChildId(k || null);
      navigate(k ? '/dashboard' : '/children', k ? { childId: k } : {});
      toast(scenario === 'alert' ? 'Đã thêm ba lần ghi khó khăn cho An hôm nay.' : scenario === 'new' ? 'Đang xem như một tài khoản mới.' : 'Đã đặt lại dữ liệu mẫu.');
    },
    setAiError: (on) => { mock.aiError = on; setDemo((d) => ({ ...d, aiError: on })); },
    setTheme: (theme) => { applyTheme(theme); setDemo((d) => ({ ...d, theme })); },
  };

  const PAGES = { '/': LandingPage, '/login': LoginPage, '/children': ChildrenPage, '/dashboard': DashboardPage, '/daily-log': DiaryPage, '/recommendation': RecommendationPage, '/expert': ExpertPage, '/privacy': PrivacyPage };
  const Page = PAGES[route.path] || LandingPage;
  const pageKey = `${demo.version}:${route.path}:${JSON.stringify(route.params)}`;
  const isPublic = PUBLIC.has(route.path);
  return html`<${AppCtx.Provider} value=${value}>
    <${ProtoBar} />
    ${isPublic ? html`<${Page} key=${pageKey} />` : html`<${AppShell}><${Page} key=${pageKey} /><//>`}
    <${DemoPanel} />
    <div className=${cx('toasts', !isPublic && 'toasts--raised')} role="status" aria-live="polite">
      ${toasts.map((t) => html`<div className="toast" key=${t.id}><${Icon} name="checkCircle" />${t.text}</div>`)}
    </div>
  <//>`;
}

ReactDOM.createRoot(document.getElementById('app')).render(html`<${App} />`);

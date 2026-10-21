/* Console shell: prototype bar, sidebar, top bar (search, notifications, account), sign-in and session screens. */
'use strict';

const NAV_GROUPS = [['monitor', 'Theo dõi'], ['support', 'Hỗ trợ gia đình'], ['ops', 'Vận hành'], ['admin', 'Quản trị']];

function BrandMark({ sub }) {
  return html`<span className="flex items-center gap-2.5">
    <img src="assets/echokid-logo.png" alt="" className="size-9 rounded-xl" />
    <span className="leading-none"><span className="font-brand text-[19px] font-black tracking-tight"><span className="text-brand-echo">Echo</span><span className="text-brand-kid">Kid</span></span>
      ${sub && html`<span className="mt-1 block text-[11px] font-semibold text-ink-3">${sub}</span>`}</span>
  </span>`;
}

/* prototype-only controls: switch the signed-in member to see each role, simulate an expired session */
function ProtoBar({ theme, setTheme, onSwitch, current }) {
  const next = { auto: 'light', light: 'dark', dark: 'auto' }[theme];
  const themeLabel = { auto: 'Theo máy', light: 'Sáng', dark: 'Tối' }[theme];
  const ctl = 'h-7 rounded-lg border border-proto-ink/25 bg-proto px-2 text-[12.5px] font-semibold text-proto-ink hover:border-proto-ink/50';
  return html`<div className="bg-proto text-proto-ink">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-1.5 text-[12.5px] sm:px-6">
      <span className="mr-auto"><b>Bản mẫu trang điều hành</b><span className="hidden sm:inline"> · dữ liệu giả lập, bấm thử được</span></span>
      <label className="flex items-center gap-2"><span className="hidden md:inline">Đăng nhập thử với</span>
        <select className=${ctl} value=${current} onChange=${(e) => onSwitch(e.target.value)} aria-label="Đăng nhập thử với">
          ${TEAM_SEED.filter((m) => m.status === 'active').map((m) => html`<option key=${m.id} value=${m.id}>${m.name} · ${ROLES[m.role].short}</option>`)}
          <option value="outsider">Người ngoài nhóm</option>
          <option value="signout">Chưa đăng nhập</option>
        </select></label>
      <button type="button" className=${ctl} onClick=${() => { mockAuth.expired = true; refreshAll(); }}>Giả lập phiên hết hạn</button>
      <button type="button" className=${ctl} title="Xóa dữ liệu dùng chung với ứng dụng phụ huynh và tải lại" onClick=${() => { bridge.reset(); location.reload(); }}>Đặt lại dữ liệu</button>
      <button type="button" className=${cx(ctl, 'inline-flex items-center gap-1')} onClick=${() => setTheme(next)} aria-label=${`Giao diện: ${themeLabel}. Bấm để đổi.`}><${Icon} name=${theme === 'dark' ? 'moon' : 'sun'} className="size-3.5" />${themeLabel}</button>
      <a className=${cx(ctl, 'inline-flex items-center gap-1')} href="index.html"><${Icon} name="external" className="size-3.5" />Ứng dụng phụ huynh</a>
    </div>
  </div>`;
}

function NavBadge({ value, tone }) {
  if (!value) return null;
  return html`<span className=${cx('min-w-5 rounded-full px-1.5 text-center text-[11px] font-bold leading-5 tabular-nums', tone === 'crit' ? 'bg-crit-btn text-on-crit' : tone === 'warn' ? 'bg-warn-tint text-warn' : 'bg-surface-3 text-ink-2')}>${value}</span>`;
}
function navBadge(id, s) {
  if (!s) return null;
  if (id === 'alerts' && s.cases) return { value: s.cases.open, tone: s.cases.p1New ? 'crit' : s.cases.overdue ? 'warn' : '' };
  if (id === 'bookings' && s.bookings) return { value: s.bookings.new, tone: s.bookings.waitingOver24h ? 'warn' : '' };
  if (id === 'accounts' && s.dataRequests) return { value: s.dataRequests.open, tone: s.dataRequests.dueSoon ? 'warn' : '' };
  if (id === 'quality' && s.quality) return { value: s.quality.pending };
  if (id === 'experts' && s.experts) return { value: s.experts.expiredVisible, tone: 'warn' };
  if (id === 'ai' && !s.ai.enabled) return { value: 'Tạm dừng', tone: 'warn' };
  return null;
}

function NavList({ pages, me, route, summary, onPick }) {
  return html`<nav aria-label="Các mục điều hành" className="space-y-5 px-3 py-4">
    ${NAV_GROUPS.map(([g, label]) => {
      const items = pages.filter((p) => p.group === g && me.perms.includes(p.perm));
      if (!items.length) return null;
      return html`<div key=${g}><p className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-3">${label}</p>
        <ul className="space-y-0.5">${items.map((p) => {
          const active = route.page === p.id;
          const badge = navBadge(p.id, summary);
          return html`<li key=${p.id}><a href=${`#/${p.id}`} aria-current=${active ? 'page' : undefined} onClick=${onPick}
            className=${cx('group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors', active ? 'bg-primary-tint text-primary-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink')}>
            <${Icon} name=${p.icon} className=${cx('size-[18px]', active ? 'text-primary-ink' : 'text-ink-3 group-hover:text-ink-2')} />
            <span className="min-w-0 flex-1 truncate">${p.label}</span>${badge && html`<${NavBadge} ...${badge} />`}</a></li>`;
        })}</ul></div>`;
    })}
  </nav>`;
}

function Sidebar(props) {
  return html`<aside className="hidden w-[268px] shrink-0 lg:block">
    <div className="sticky top-0 flex h-screen flex-col border-r border-line bg-surface">
      <a href="#/overview" className="flex h-16 shrink-0 items-center border-b border-line px-5"><${BrandMark} sub="Bảng điều hành" /></a>
      <div className="min-h-0 flex-1 overflow-y-auto"><${NavList} ...${props} /></div>
      <p className="shrink-0 border-t border-line px-5 py-3 text-[11.5px] leading-snug text-ink-3"><${Icon} name="lock" className="mr-1 inline size-3.5" />Chỉ số liệu tổng hợp và mã gia đình ẩn danh. Không có nội dung nhật ký.</p>
    </div>
  </aside>`;
}
function MobileNav({ open, onClose, ...props }) {
  const ref = useRef(null);
  useDialog(open, onClose, ref);
  if (!open) return null;
  return html`<div className="fixed inset-0 z-50 lg:hidden">
    <div className="absolute inset-0 bg-scrim motion-safe:animate-fade" onMouseDown=${onClose}></div>
    <div ref=${ref} role="dialog" aria-modal="true" aria-label="Menu điều hành" tabIndex="-1" className="relative flex h-full w-[84vw] max-w-[300px] flex-col bg-surface shadow-pop outline-none">
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-4"><${BrandMark} sub="Bảng điều hành" /><${IconButton} icon="x" label="Đóng menu" onClick=${onClose} /></div>
      <div className="min-h-0 flex-1 overflow-y-auto"><${NavList} ...${props} onPick=${onClose} /></div>
    </div>
  </div>`;
}

function NotificationsMenu() {
  const q = useApi('/api/admin/notifications');
  const pop = usePopover();
  const [seen, setSeen] = useState(() => new Set((readPref('echokid.seenNotifs', '') || '').split('|').filter(Boolean)));
  const items = q.data?.items || [];
  const unread = items.filter((n) => !seen.has(n.id)).length;
  const markAll = () => { const s = new Set(items.map((n) => n.id)); setSeen(s); writePref('echokid.seenNotifs', [...s].join('|')); };
  return html`<div className="relative" ref=${pop.ref}>
    <${IconButton} icon="bell" label=${unread ? `Thông báo, ${unread} chưa đọc` : 'Thông báo'} badge=${unread || null} aria-expanded=${pop.open} onClick=${() => pop.setOpen((v) => !v)} />
    ${pop.open && html`<div className="absolute right-0 top-12 z-40 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line bg-surface shadow-pop motion-safe:animate-pop">
      <div className="flex items-center justify-between border-b border-line px-4 py-3"><p className="text-sm font-bold">Thông báo</p>
        ${unread > 0 && html`<button type="button" className="text-[13px] font-semibold text-primary-ink hover:underline" onClick=${markAll}>Đánh dấu đã đọc</button>`}</div>
      ${items.length === 0 ? html`<${EmptyState} title="Không có gì cần chú ý" text="Ca nguy cơ an toàn, yêu cầu quá hạn và báo động chi phí sẽ hiện ở đây." />`
        : html`<ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">${items.map((n) => html`<li key=${n.id}><a href=${n.href} onClick=${() => pop.setOpen(false)} className="flex gap-3 px-4 py-3 transition-colors hover:bg-surface-2">
          <span className=${cx('grid size-9 shrink-0 place-items-center rounded-xl', n.tone === 'crit' ? 'bg-crit-tint text-crit' : 'bg-warn-tint text-warn')}><${Icon} name=${n.icon} className="size-[18px]" /></span>
          <div className="min-w-0 flex-1"><p className=${cx('text-[13px] leading-snug text-ink', !seen.has(n.id) && 'font-semibold')}>${n.title}</p><p className="mt-0.5 text-xs text-ink-3">${n.sub}</p></div>
          ${!seen.has(n.id) && html`<span className="mt-1.5 size-2 shrink-0 rounded-full bg-crit-btn" aria-label="Chưa đọc"></span>`}</a></li>`)}</ul>`}
    </div>`}
  </div>`;
}

function UserMenu({ me, onSignOut }) {
  const pop = usePopover();
  return html`<div className="relative" ref=${pop.ref}>
    <button type="button" className="flex items-center gap-2.5 rounded-xl py-1 pl-1 pr-2 transition-colors hover:bg-surface-2" aria-expanded=${pop.open} aria-label="Tài khoản" onClick=${() => pop.setOpen((v) => !v)}>
      <${Avatar} name=${me.name} /><span className="hidden text-left leading-tight xl:block"><span className="block text-sm font-semibold text-ink">${me.name}</span><span className="block text-xs text-ink-3">${ROLES[me.role].label}</span></span>
      <${Icon} name="chevronDown" className="hidden size-4 text-ink-3 xl:block" />
    </button>
    ${pop.open && html`<div className="absolute right-0 top-12 z-40 w-72 rounded-2xl border border-line bg-surface p-2 shadow-pop motion-safe:animate-pop">
      <div className="flex items-center gap-3 px-2 py-2"><${Avatar} name=${me.name} size="lg" /><div className="min-w-0"><p className="font-semibold text-ink">${me.name}</p><p className="truncate text-xs text-ink-3">${me.email}</p>
        <${Pill} tone=${ROLE_TONE[me.role]} className="mt-1">${ROLES[me.role].label}<//></div></div>
      <p className="px-2 pb-2 text-xs leading-snug text-ink-3">${ROLES[me.role].desc}</p>
      <button type="button" className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-sm font-medium text-ink-2 hover:bg-surface-2 hover:text-ink" onClick=${onSignOut}><${Icon} name="logout" className="size-[18px]" />Đăng xuất</button>
    </div>`}
  </div>`;
}

function Topbar({ me, onMenu, onSearch, onSignOut }) {
  return html`<header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
    <div className="flex h-16 items-center gap-2 px-3 sm:px-6">
      <${IconButton} icon="menu" label="Mở menu" className="lg:hidden" onClick=${onMenu} />
      <a href="#/overview" className="mr-2 lg:hidden"><${BrandMark} /></a>
      <button type="button" onClick=${onSearch} className="hidden h-10 w-full max-w-md items-center gap-2.5 rounded-xl border border-line bg-surface-2 px-3 text-sm text-ink-3 transition-colors hover:border-line-strong md:flex">
        <${Icon} name="search" className="size-4" /><span className="flex-1 text-left">Tìm ca, yêu cầu, trang…</span><span className="flex gap-1"><${Kbd}>Ctrl<//><${Kbd}>K<//></span>
      </button>
      <div className="ml-auto flex items-center gap-1">
        <${IconButton} icon="search" label="Tìm kiếm" className="md:hidden" onClick=${onSearch} />
        <${NotificationsMenu} />
        <${UserMenu} me=${me} onSignOut=${onSignOut} />
      </div>
    </div>
  </header>`;
}

function AiPausedBanner({ ai, me }) {
  if (!ai || ai.enabled) return null;
  return html`<div className="border-b border-warn-line bg-warn-tint px-4 py-2.5 text-[13px] text-ink sm:px-6" role="status">
    <${Icon} name="pause" className="mr-1.5 inline size-4 text-warn" /><b>Gợi ý AI đang tạm dừng</b> từ ${fmtDT(ai.pausedAt)} bởi ${ai.pausedBy}. ${ai.reason}
    ${me.perms.includes('ai') && html` <a href="#/ai" className="font-semibold text-primary-ink underline">Mở Điều khiển AI</a>`}
  </div>`;
}

/* Ctrl+K: pages, quick actions and cases/requests by id or family code */
function CommandPalette({ open, onClose, pages, me, go }) {
  const ref = useRef(null);
  const [term, setTerm] = useState('');
  const [hits, setHits] = useState([]);
  const [idx, setIdx] = useState(0);
  useDialog(open, onClose, ref, { focusFirstInput: true });
  useEffect(() => { if (open) { setTerm(''); setHits([]); setIdx(0); } }, [open]);
  useEffect(() => {
    if (!open || fold(term).length < 2) { setHits([]); return undefined; }
    let alive = true;
    const t = setTimeout(() => request(`/api/admin/search?q=${encodeURIComponent(term)}`).then((r) => alive && r.ok && setHits(r.body.items)), 180);
    return () => { alive = false; clearTimeout(t); };
  }, [term, open]);
  if (!open) return null;
  const f = fold(term);
  const pageItems = pages.filter((p) => me.perms.includes(p.perm) && (!f || fold(p.label).includes(f))).map((p) => ({ key: `p-${p.id}`, icon: p.icon, title: p.label, sub: 'Trang', href: `#/${p.id}` }));
  const actions = [
    me.perms.includes('cases') && { key: 'a-unassigned', icon: 'bell', title: 'Ca chưa có người nhận', sub: 'Thao tác nhanh', href: '#/alerts' },
    me.perms.includes('ai') && { key: 'a-ai', icon: 'pause', title: 'Tạm dừng gợi ý AI', sub: 'Thao tác nhanh', href: '#/ai' },
    me.perms.includes('announce') && { key: 'a-ann', icon: 'megaphone', title: 'Đăng thông báo cho phụ huynh', sub: 'Thao tác nhanh', href: '#/announce' },
  ].filter((a) => a && (!f || fold(a.title).includes(f)));
  const results = [...hits.map((h) => ({ key: `s-${h.id}`, icon: h.type === 'case' ? 'alert' : 'inbox', title: h.title, sub: h.sub, href: h.href })), ...pageItems, ...actions].slice(0, 12);
  const pick = (r) => { onClose(); go(r.href); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(results.length - 1, i + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
    if (e.key === 'Enter' && results[idx]) { e.preventDefault(); pick(results[idx]); }
  };
  return html`<div className="fixed inset-0 z-[60] flex items-start justify-center p-3 pt-[10vh]">
    <div className="absolute inset-0 bg-scrim motion-safe:animate-fade" onMouseDown=${onClose}></div>
    <div ref=${ref} role="dialog" aria-modal="true" aria-label="Tìm nhanh" tabIndex="-1" className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-pop outline-none motion-safe:animate-pop">
      <div className="flex items-center gap-3 border-b border-line px-4">
        <${Icon} name="search" className="size-5 text-ink-3" />
        <input className="h-14 flex-1 bg-transparent text-[15px] text-ink placeholder:text-ink-3 focus:outline-none" placeholder="Mã ca (CA-…), mã yêu cầu (YC-…), mã gia đình hoặc tên trang"
          value=${term} onChange=${(e) => { setTerm(e.target.value); setIdx(0); }} onKeyDown=${onKey} aria-label="Tìm nhanh" role="combobox" aria-expanded="true" aria-controls="palette-list" aria-activedescendant=${results[idx] ? `pal-${results[idx].key}` : undefined} />
        <${Kbd}>Esc<//>
      </div>
      <ul id="palette-list" role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
        ${results.length === 0 ? html`<li className="px-3 py-8 text-center text-sm text-ink-3">Không tìm thấy gì khớp “${term}”.</li>` : results.map((r, i) => html`<li key=${r.key} id=${`pal-${r.key}`} role="option" aria-selected=${i === idx}>
          <button type="button" onMouseEnter=${() => setIdx(i)} onClick=${() => pick(r)} className=${cx('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left', i === idx ? 'bg-primary-tint' : '')}>
            <span className="grid size-8 place-items-center rounded-lg bg-surface-2 text-ink-2"><${Icon} name=${r.icon} className="size-4" /></span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink">${r.title}</span><span className="block truncate text-xs text-ink-3">${r.sub}</span></span>
            ${i === idx && html`<${Icon} name="arrowRight" className="size-4 text-primary-ink" />`}
          </button></li>`)}
      </ul>
    </div>
  </div>`;
}

/* ---------- full-screen states ---------- */
function GateScreen({ icon, tone, title, children, action }) {
  return html`<main className="grid min-h-[calc(100vh-40px)] place-items-center px-4 py-12">
    <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-8 text-center shadow-card">
      <div className="flex justify-center"><${BrandMark} sub="Bảng điều hành" /></div>
      <span className=${cx('mx-auto mt-8 grid size-14 place-items-center rounded-2xl', tone === 'crit' ? 'bg-crit-tint text-crit' : 'bg-primary-tint text-primary-ink')}><${Icon} name=${icon} className="size-7" /></span>
      <h1 className="mt-4 text-xl font-bold text-ink">${title}</h1>
      <div className="mt-2 text-sm leading-relaxed text-ink-2">${children}</div>
      <div className="mt-6">${action}</div>
    </div>
  </main>`;
}
const GoogleButton = ({ onClick, children }) => html`<${Button} size="lg" block onClick=${onClick}><svg viewBox="0 0 24 24" className="size-5" aria-hidden="true"><path fill="#fff" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3Z"/><path fill="#fff" opacity=".85" d="M12 22c2.7 0 5-.9 6.6-2.5l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z"/><path fill="#fff" opacity=".7" d="M6.4 13.9a6 6 0 0 1 0-3.8V7.5H3.1a10 10 0 0 0 0 9l3.3-2.6Z"/><path fill="#fff" opacity=".55" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.5l3.3 2.6C7.2 7.8 9.4 6 12 6Z"/></svg>${children}<//>`;

function SignInScreen({ onSignIn }) {
  return html`<${GateScreen} icon="shield" title="Trang điều hành EchoKid" action=${html`<${GoogleButton} onClick=${onSignIn}>Đăng nhập bằng Google<//>`}>
    <p>Chỉ dành cho tài khoản trong nhóm điều hành, đã bật xác minh 2 bước. Ba mẹ dùng <a className="font-semibold text-primary-ink underline" href="index.html">ứng dụng phụ huynh</a>.</p>
  <//>`;
}
function DeniedScreen({ onSwitch }) {
  return html`<${GateScreen} icon="lock" tone="crit" title="Tài khoản này không có quyền vào trang điều hành"
    action=${html`<${Button} variant="secondary" block onClick=${onSwitch}>Đăng nhập bằng tài khoản khác<//>`}>
    <p>Bạn đã đăng nhập bằng <b>ngoai.nhom@example.com</b>. Nếu bạn cần quyền, hãy nhờ một quản trị viên mời bạn ở mục Nhóm điều hành.</p>
  <//>`;
}
function ExpiredModal({ open, onSignIn }) {
  return html`<${Modal} open=${open} onClose=${() => {}} dismissible=${false} tone="warn" title="Phiên đăng nhập đã hết hạn"
    intro="Đăng nhập lại để tiếp tục. Trang và những gì bạn đang nhập vẫn giữ nguyên."
    footer=${html`<${GoogleButton} onClick=${onSignIn}>Đăng nhập lại bằng Google<//>`} />`;
}
function NoAccess({ page, first }) {
  return html`<${Card} className="mx-auto mt-10 max-w-lg"><${EmptyState} icon="lock" title=${`Vai trò của bạn không mở được “${page ? page.label : 'trang này'}”`}
    text="Máy chủ kiểm tra quyền theo tài khoản đăng nhập. Nhờ quản trị viên đổi vai trò nếu bạn cần mục này.">
    ${first && html`<${LinkButton} href=${`#/${first.id}`} icon="arrowLeft">Về ${first.label}<//>`}<//><//>`;
}

/* Admin pages: the moderator team with roles, and the append-only audit log. */
'use strict';

const ROLE_TONE = { admin: 'primary', safety: 'crit', backend: 'info', analytics: 'neutral' };

function TeamPage({ me }) {
  const q = useApi('/api/admin/team');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('safety');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [revoking, setRevoking] = useState(null);
  async function invite(e) {
    e.preventDefault(); setBusy('invite'); setError('');
    const r = await send('/api/admin/team', 'POST', { email, role }, { quiet: true });
    setBusy('');
    if (r.ok) { toast(`Đã gửi lời mời tới ${email}.`); setEmail(''); } else setError(r.body?.error || 'Chưa mời được.');
  }
  const changeRole = async (m, next) => { const r = await send(`/api/admin/team/${m.id}`, 'PATCH', { role: next }); if (r.ok) toast(`${m.name}: ${ROLES[next].label}.`); };
  const revoke = async () => { setBusy('revoke'); const r = await send(`/api/admin/team/${revoking.id}`, 'DELETE'); setBusy(''); if (r.ok) { toast(`Đã thu hồi quyền của ${revoking.name}.`); setRevoking(null); } };
  const noTwoStep = (q.data?.items || []).filter((m) => m.status === 'active' && !m.twoStep);
  return html`<${Fragment}>
    <${PageHeader} title="Nhóm điều hành" sub="Ai được vào trang này và được làm gì. Quyền kiểm tra ở máy chủ theo tài khoản đăng nhập, không theo đường dẫn." />
    ${noTwoStep.length > 0 && html`<${Callout} className="mb-5" tone="warn" icon="key" title=${`${noTwoStep.map((m) => m.name).join(', ')} chưa bật xác minh 2 bước của Google`}>Tài khoản điều hành xem được dữ liệu nhạy cảm của trẻ. Nhắc bật xác minh 2 bước; nên chặn đăng nhập nếu chưa bật sau 7 ngày.<//>`}
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,21rem)]">
      <${Card} className="min-w-0">
        <${CardHead} icon="users" title="Thành viên" />
        <${Loaded} q=${q} skeleton=${html`<div className="p-5"><${Skel} h=${240} /></div>`}>${(data) => html`<${Table} className="mt-3" minWidth=${680} head=${['Thành viên', 'Vai trò', 'Xác minh 2 bước', 'Hoạt động', '']}>
          ${data.items.map((m) => html`<tr key=${m.id}>
            <td className=${TD}><div className="flex items-center gap-3"><${Avatar} name=${m.name} /><div className="min-w-0"><p className="font-semibold text-ink">${m.name}${m.id === me.id && html` <span className="text-xs font-medium text-ink-3">(bạn)</span>`}</p><p className="text-xs text-ink-3">${m.email}</p></div></div></td>
            <td className=${TD}>${m.id === me.id ? html`<${Pill} tone=${ROLE_TONE[m.role]}>${ROLES[m.role].label}<//>`
              : html`<${Select} className="w-44" aria-label=${`Vai trò của ${m.name}`} value=${m.role} onChange=${(e) => changeRole(m, e.target.value)}>${Object.entries(ROLES).map(([k, r]) => html`<option key=${k} value=${k}>${r.label}</option>`)}<//>`}</td>
            <td className=${TD}>${m.status === 'invited' ? html`<${Pill} tone="info" icon="mail">Đang mời<//>` : m.twoStep ? html`<${Pill} tone="good" icon="shield">Đã bật<//>` : html`<${Pill} tone="warn" icon="key">Chưa bật<//>`}</td>
            <td className=${cx(TD, 'whitespace-nowrap text-[13px] text-ink-2')}>${m.lastActiveAt ? ago(m.lastActiveAt) : '–'}</td>
            <td className=${cx(TD, 'text-right')}>${m.id !== me.id && html`<${Button} variant="dangerQuiet" size="sm" onClick=${() => setRevoking(m)}>${m.status === 'invited' ? 'Hủy lời mời' : 'Thu hồi'}<//>`}</td>
          </tr>`)}
        <//>`}<//>
      <//>
      <${Card} className="p-5">
        <h2 className="flex items-center gap-2 text-[15px] font-bold"><${Icon} name="userPlus" className="size-[18px] text-ink-3" />Mời thành viên</h2>
        <form className="mt-4 space-y-4" onSubmit=${invite}>
          <${Field} label="Email Google" htmlFor="tm-email" error=${error} hint="Người được mời đăng nhập bằng Google với đúng email này và phải bật xác minh 2 bước."><${Input} id="tm-email" type="email" value=${email} onChange=${(e) => setEmail(e.target.value)} placeholder="ten@echokid.example" /><//>
          <${Field} label="Vai trò" htmlFor="tm-role" hint=${ROLES[role].desc}><${Select} id="tm-role" value=${role} onChange=${(e) => setRole(e.target.value)}>${Object.entries(ROLES).map(([k, r]) => html`<option key=${k} value=${k}>${r.label}</option>`)}<//><//>
          <${Button} type="submit" icon="send" busy=${busy === 'invite'} disabled=${!email.includes('@')}>Gửi lời mời<//>
        </form>
      <//>
    </div>
    <${Card} className="mt-5">
      <${CardHead} icon="shield" title="Quyền theo vai trò" sub="Ít quyền nhất đủ để làm việc. Chỉ quản trị viên và kiểm duyệt an toàn xem được liên hệ gia đình, và luôn phải ghi lý do." />
      <${Table} className="mt-3" minWidth=${720} head=${[{ label: 'Khu vực', className: 'w-1/3' }, ...Object.values(ROLES).map((r) => ({ label: r.label, className: 'text-center' }))]}>
        ${AREAS.map(([k, label]) => html`<tr key=${k}><td className=${cx(TD, 'py-2.5 text-[13px]')}>${label}</td>
          ${Object.keys(ROLES).map((r) => html`<td key=${r} className=${cx(TD, 'py-2.5 text-center')}>${ROLES[r].perms.includes(k)
            ? html`<${Icon} name="check" className="inline size-[18px] text-good" /><span className="sr-only">Có</span>` : html`<span className="text-line-strong" aria-label="Không">–</span>`}</td>`)}</tr>`)}
      <//>
    <//>
    <${Modal} open=${!!revoking} onClose=${() => setRevoking(null)} busy=${busy === 'revoke'} tone="crit" title=${revoking?.status === 'invited' ? `Hủy lời mời ${revoking?.email}` : `Thu hồi quyền của ${revoking?.name}`}
      intro=${revoking?.status === 'invited' ? 'Link mời sẽ không dùng được nữa.' : 'Người này bị đăng xuất khỏi mọi thiết bị ngay. Ca cảnh báo đang giữ sẽ trở lại hàng chờ.'}
      footer=${html`<${Button} variant="quiet" onClick=${() => setRevoking(null)}>Hủy<//><${Button} variant="danger" busy=${busy === 'revoke'} onClick=${revoke}>${revoking?.status === 'invited' ? 'Hủy lời mời' : 'Thu hồi quyền'}<//>`} />
  <//>`;
}

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

function AuditPage() {
  const [actor, setActor] = useState('all');
  const [group, setGroup] = useState('all');
  const [term, setTerm] = useState('');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  useEffect(() => setPage(1), [actor, group, term]);
  const filters = `actor=${actor}&group=${group}&q=${encodeURIComponent(term)}`;
  const q = useApi(`/api/admin/audit?${filters}&page=${page}`);
  async function exportCsv() {
    setBusy(true);
    const r = await request(`/api/admin/audit?${filters}&export=1`);
    setBusy(false);
    if (!r.ok) return toast(r.body?.error || 'Chưa xuất được.', 'crit');
    const rows = [['Thời gian', 'Người thực hiện', 'Vai trò', 'Hành động', 'Đối tượng', 'Chi tiết', 'Lý do'],
      ...r.body.all.map((a) => [new Date(a.at).toISOString(), a.actor, ROLES[a.role]?.label || 'Hệ thống', (AUDIT_ACTIONS[a.action] || [a.action])[0], a.target, a.detail, a.reason])];
    downloadFile(`echokid-nhat-ky-kiem-tra-${localISODate()}.csv`, rows.map((row) => row.map(csvCell).join(',')).join('\r\n'));
    toast(`Đã xuất ${fmtInt(r.body.all.length)} dòng.`);
  }
  return html`<${Fragment}>
    <${PageHeader} title="Nhật ký kiểm tra" sub="Mọi thao tác trên trang điều hành: ai xem liên hệ gia đình, ai đóng ca, ai đổi cài đặt AI. Chỉ thêm, không ai sửa hoặc xóa được, kể cả quản trị viên."
      actions=${html`<${Button} variant="secondary" icon="download" busy=${busy} onClick=${exportCsv}>Xuất CSV<//>`} />
    <${Card}>
      <div className="flex flex-wrap items-center gap-3 p-4">
        <${Select} className="w-48" aria-label="Người thực hiện" value=${actor} onChange=${(e) => setActor(e.target.value)}>
          <option value="all">Mọi người</option>${(q.data?.actors || []).map((a) => html`<option key=${a.id} value=${a.id}>${a.name}</option>`)}
        <//>
        <${Select} className="w-52" aria-label="Loại thao tác" value=${group} onChange=${(e) => setGroup(e.target.value)}>
          <option value="all">Mọi loại thao tác</option>${Object.entries(AUDIT_GROUPS).map(([k, v]) => html`<option key=${k} value=${k}>${v}</option>`)}
        <//>
        <${SearchBox} className="min-w-52 flex-1" value=${term} onChange=${setTerm} placeholder="Tìm mã ca, mã gia đình, nội dung" />
      </div>
      <${Loaded} q=${q} skeleton=${html`<div className="space-y-2 p-4">${[1, 2, 3, 4, 5].map((i) => html`<${Skel} key=${i} h=${44} />`)}</div>`}>${(data) => data.total === 0 ? html`<${EmptyState} icon="history" title="Không có thao tác nào khớp bộ lọc" />` : html`
        <${Table} minWidth=${900} head=${['Thời gian', 'Người thực hiện', 'Hành động', 'Đối tượng', 'Chi tiết và lý do']}>
          ${data.items.map((a) => { const [label, grp] = AUDIT_ACTIONS[a.action] || [a.action, 'other']; return html`<tr key=${a.id}>
            <td className=${cx(TD, 'whitespace-nowrap text-[13px] text-ink-2')}>${fmtDT(a.at)}<p className="text-xs text-ink-3">${ago(a.at)}</p></td>
            <td className=${TD}><div className="flex items-center gap-2"><${Avatar} name=${a.actor} size="sm" /><div><p className="whitespace-nowrap font-medium">${a.actor}</p><p className="text-xs text-ink-3">${ROLES[a.role]?.short || 'Tự động'}</p></div></div></td>
            <td className=${TD}><${Pill} tone=${grp === 'privacy' ? 'warn' : 'neutral'} icon=${grp === 'privacy' ? 'eye' : undefined}>${label}<//></td>
            <td className=${cx(TD, 'font-medium tabular-nums')}>${a.target}</td>
            <td className=${cx(TD, 'text-[13px] text-ink-2')}>${a.detail}${a.reason && html`<p className="mt-0.5 text-ink-3"><span className="font-semibold">Lý do:</span> ${a.reason}</p>`}</td>
          </tr>`; })}
        <//><${Pager} page=${data.page} pageSize=${data.pageSize} total=${data.total} onPage=${setPage} />`}<//>
    <//>
  <//>`;
}

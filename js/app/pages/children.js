/* Choose or add a child (app/children/page.tsx). */
'use strict';

/* ---------- Choose child (app/children/page.tsx) ---------- */
function ChildrenPage() {
  const { kids, kidsError, addKid, toast } = useApp();
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [years, setYears] = useState('2');
  const [months, setMonths] = useState('0');
  const [gender, setGender] = useState('male');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [freshId, setFreshId] = useState(null);
  const showForm = formOpen || (kids && kids.length === 0);

  async function createChild(e) {
    e.preventDefault();
    const ageMonths = combineAgeMonths(Number(years), Number(months));
    if (!name.trim()) return setError('Ba mẹ hãy nhập tên bé.');
    if (!Number.isInteger(Number(years)) || !Number.isInteger(Number(months)) || ageMonths < 1 || ageMonths > 216) return setError('Ba mẹ hãy nhập tuổi hợp lệ cho bé.');
    setCreating(true); setError('');
    const res = await apiFetch('/api/children', {
      method: 'POST',
      body: JSON.stringify({ name: name.trim(), ageMonths, gender, diagnosis: { status: 'not_evaluated', type: [], diagnosedDate: null }, goals: [] }),
    });
    const data = await res.json();
    if (res.ok) {
      addKid(data.child);
      setFreshId(data.child.id);
      setName(''); setYears('2'); setMonths('0'); setGender('male'); setFormOpen(false);
      toast(`Đã tạo hồ sơ cho ${data.child.name}.`);
    } else setError(data.error || 'Không thể tạo hồ sơ.');
    setCreating(false);
  }

  return html`<div className="page">
    <header className="page-head">
      <h1>Hôm nay mình đồng hành cùng ai?</h1>
      <p className="page-head__sub">Chọn hồ sơ để mở nhật ký, gợi ý và tiến trình riêng của bé.</p>
    </header>
    ${kidsError && html`<p className="form-error" role="alert"><${Icon} name="info" />${kidsError}</p>`}
    ${!kids ? html`<div className="kids"><${Skel} h=${96} /><${Skel} h=${96} /></div>` : html`
      <div className="kids">
        ${kids.map((k, i) => html`<${Link} key=${k.id} to="/dashboard" params=${{ childId: k.id }} className=${cx('kid', freshId === k.id && 'kid--fresh')}>
          <${Avatar} name=${k.name} tone=${i} size=${64} ring />
          <div><h2>${k.name}</h2><p>${formatAge(k.ageMonths)} · ${GENDER_LABEL[k.gender] ?? 'Khác'}</p></div>
          <${Icon} name="chevronRight" className="kid__go" />
        <//>`)}
        ${!showForm && html`<button type="button" className="kid kid--new" onClick=${() => setFormOpen(true)}><${Icon} name="plus" />Thêm hồ sơ bé</button>`}
      </div>`}
    ${kids && showForm && html`<form className="card new-kid" onSubmit=${createChild} noValidate>
      <div className="section-head"><div><h2>Thêm một thành viên nhỏ</h2><p>Thông tin cơ bản giúp gợi ý phù hợp với độ tuổi của bé.</p></div></div>
      <div className="new-kid__grid">
        <div className="field field--wide">
          <label className="field__label" htmlFor="kid-name">Tên hoặc biệt danh của bé</label>
          <input id="kid-name" className="input" value=${name} onChange=${(e) => setName(e.target.value)} placeholder="Ví dụ: An" autoComplete="off" />
        </div>
        <div className="field">
          <span className="field__label" id="kid-age-label">Tuổi</span>
          <div className="age-inputs" role="group" aria-labelledby="kid-age-label">
            <div className="input-wrap"><input id="kid-years" className="input" type="number" inputMode="numeric" min="0" max="18" value=${years} onChange=${(e) => setYears(e.target.value)} aria-label="Số năm" /><span className="input-wrap__unit">tuổi</span></div>
            <div className="input-wrap"><input id="kid-months" className="input" type="number" inputMode="numeric" min="0" max="11" value=${months} onChange=${(e) => setMonths(e.target.value)} aria-label="Số tháng" /><span className="input-wrap__unit">tháng</span></div>
          </div>
        </div>
        <fieldset className="field">
          <legend className="field__label">Giới tính</legend>
          <${Seg} name="kid-gender" label="Giới tính" value=${gender} options=${GENDERS} onChange=${setGender} />
        </fieldset>
      </div>
      ${error && html`<p className="form-error" role="alert"><${Icon} name="info" />${error}</p>`}
      <div className="form-actions">
        <${Btn} type="submit" disabled=${creating}>${creating ? 'Đang lưu...' : 'Tạo hồ sơ'}<//>
        ${kids.length > 0 && html`<${Btn} variant="quiet" onClick=${() => { setFormOpen(false); setError(''); }}>Hủy<//>`}
      </div>
    </form>`}
  </div>`;
}

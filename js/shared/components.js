/* UI building blocks shared by both pages: buttons, radios as chips, stepper, sheet, skeleton, column chart. */
'use strict';

function Btn({ variant = 'primary', size, block, className, type = 'button', ...rest }) {
  return html`<button type=${type} className=${cx('btn', 'btn--' + variant, size && 'btn--' + size, block && 'btn--block', className)} ...${rest}></button>`;
}

function Face({ mood, size = 40, alt = '', className }) {
  return html`<img className=${cx('face', className)} src=${IMG[mood]} width=${size} height=${size} alt=${alt} />`;
}

function Avatar({ name, tone = 0, size = 40, ring = false }) {
  const letter = (name || '?').trim().charAt(0).toUpperCase();
  const style = { '--size': size + 'px' };
  if (ring) return html`<span className="avatar avatar--ring" style=${style} aria-hidden="true"><span className=${'tone-' + (tone % 4)}>${letter}</span></span>`;
  return html`<span className=${'avatar tone-' + (tone % 4)} style=${style} aria-hidden="true">${letter}</span>`;
}

function Brand() {
  return html`<span className="brand__mark"><img src=${IMG.logo} alt="" /></span><span className="brand__word"><b>Echo</b><span>Kid</span></span>`;
}

function Hands({ className, style }) { return html`<span className=${cx('hands', className)} style=${style} aria-hidden="true"></span>`; }

/* native radios styled as chips: keyboard and screen-reader behaviour for free */
function Seg({ name, value, options, onChange, cols, className, label }) {
  return html`<div className=${cx('seg', className)} role="radiogroup" aria-label=${label} style=${{ '--cols': cols || options.length }}>
    ${options.map((o) => html`<label key=${o.value} className="seg__opt">
      <input type="radio" id=${`${name}-${o.value}`} name=${name} value=${o.value} checked=${value === o.value} onChange=${() => onChange(o.value)} />
      <span className="seg__label">${value === o.value && html`<${Icon} name="check" />`}${o.label}</span>
    </label>`)}
  </div>`;
}

function Stepper({ id, value, min, max, step = 1, format, onChange, label }) {
  const dec = () => onChange(clamp(Math.round((value - step) * 100) / 100, min, max));
  const inc = () => onChange(clamp(Math.round((value + step) * 100) / 100, min, max));
  return html`<div className="stepper" role="group" aria-label=${label}>
    <button type="button" onClick=${dec} disabled=${value <= min} aria-label=${`Giảm ${label.toLowerCase()}`}><${Icon} name="chevronLeft" /></button>
    <output id=${id} aria-live="polite">${format ? format(value) : value}</output>
    <button type="button" onClick=${inc} disabled=${value >= max} aria-label=${`Tăng ${label.toLowerCase()}`}><${Icon} name="chevronRight" /></button>
  </div>`;
}

/* bottom sheet on phones, centred dialog on larger screens */
function Sheet({ open, onClose, title, intro, busy, children, labelledBy = 'sheet-title' }) {
  const ref = useRef(null);
  const live = useRef({ busy, onClose });
  live.current = { busy, onClose };
  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const node = ref.current;
    const first = node && node.querySelector('input, textarea, select, button:not(.sheet__close)');
    (first || node)?.focus({ preventScroll: true });
    const onKey = (e) => {
      if (e.key === 'Escape' && !live.current.busy) live.current.onClose();
      if (e.key === 'Tab' && node) {
        const items = [...node.querySelectorAll('a[href], button:not([disabled]), input, textarea, select, [tabindex="0"]')];
        if (!items.length) return;
        const firstEl = items[0], lastEl = items[items.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
        else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      if (opener && opener.focus) opener.focus({ preventScroll: true });
    };
  }, [open]);
  if (!open) return null;
  return html`<div className="sheet-backdrop" onMouseDown=${(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
    <section className="sheet" role="dialog" aria-modal="true" aria-labelledby=${labelledBy} ref=${ref} tabIndex="-1">
      <div className="sheet__handle" aria-hidden="true"></div>
      <button type="button" className="sheet__close" aria-label="Đóng" onClick=${onClose} disabled=${busy}><${Icon} name="x" /></button>
      <header className="sheet__head"><h2 id=${labelledBy}>${title}</h2>${intro && html`<p>${intro}</p>`}</header>
      <div className="sheet__body">${children}</div>
    </section>
  </div>`;
}

function EmptyState({ icon = 'heart', title, text, children }) {
  return html`<section className="empty card"><span className="empty__icon"><${Icon} name=${icon} /></span><h1>${title}</h1>${text && html`<p>${text}</p>`}${children}</section>`;
}

function Skel({ h = 120, w = '100%', r }) { return html`<div className="skel" style=${{ height: h, width: w, borderRadius: r }} aria-hidden="true"></div>`; }

function SeverityPill({ level }) {
  const s = SEVERITY[level] || SEVERITY.mild;
  return html`<span className=${'pill pill--' + s.tone}><${Icon} name=${s.icon} />${s.label}</span>`;
}

function SeverityStatus({ level }) {
  const s = SEVERITY[level] || SEVERITY.mild;
  return html`<div className=${'status status--' + s.tone}><${Icon} name=${s.icon} /><div><strong>${s.label}</strong><span>${s.hint}</span></div></div>`;
}

/* ---------- charts: HTML/CSS marks so text stays at real sizes on phones ---------- */
function useTip() {
  const ref = useRef(null);
  const [tip, setTip] = useState(null);
  const show = useCallback((e, content) => {
    const host = ref.current; if (!host) return;
    const anchor = e.currentTarget.querySelector('.col__bar, .col__zero, .col__none, img') || e.currentTarget;
    const r = anchor.getBoundingClientRect(), h = host.getBoundingClientRect();
    setTip({ x: r.left + r.width / 2 - h.left, y: r.top - h.top, w: h.width, content });
  }, []);
  const hide = useCallback(() => setTip(null), []);
  const node = tip && html`<div className="tip" aria-hidden="true" style=${{ left: clamp(tip.x, 80, Math.max(80, tip.w - 80)) + 'px', top: tip.y + 'px' }}>
    <strong>${tip.content.value}</strong><span>${tip.content.detail}</span></div>`;
  return { ref, show, hide, node };
}

function useNarrow(query = '(max-width: 639px)') {
  const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return narrow;
}

function ColumnChart({ title, sub, color, points, max, ticks, fmt, labelled, emptyText, yWidth }) {
  const tip = useTip();
  const hasData = points.some((p) => p.value != null);
  return html`<figure className="chart card">
    <figcaption className="chart__head"><span className="chart__title">${title}</span><span className="chart__sub">${sub}</span></figcaption>
    ${!hasData ? html`<p className="chart__empty">${emptyText}</p>` : html`
    <div className="cols" ref=${tip.ref} style=${{ '--series': color, '--y-w': yWidth }}>
      <div className="cols__y" aria-hidden="true">${ticks.map((t) => html`<span key=${t} style=${{ bottom: (t / max) * 100 + '%' }}>${fmt(t)}</span>`)}</div>
      <div className="cols__plot">
        ${ticks.filter((t) => t > 0).map((t) => html`<i key=${'g' + t} className="cols__grid" style=${{ bottom: (t / max) * 100 + '%' }}></i>`)}
        ${points.map((p) => html`<button type="button" key=${p.key} className="col" aria-label=${p.aria}
            onPointerEnter=${(e) => tip.show(e, p.tip)} onPointerLeave=${tip.hide} onFocus=${(e) => tip.show(e, p.tip)} onBlur=${tip.hide}>
          ${p.value == null ? html`<span className="col__none"></span>`
            : p.value === 0 ? html`<span className="col__zero"></span>`
            : html`<span className="col__bar" style=${{ height: Math.max((p.value / max) * 100, 2) + '%' }}>${labelled.has(p.key) && html`<span className="col__val">${fmt(p.value)}</span>`}</span>`}
        </button>`)}
      </div>
      <div className="cols__x" aria-hidden="true">${points.map((p) => html`<span key=${p.key}>${p.label}</span>`)}</div>
      ${tip.node}
    </div>`}
  </figure>`;
}

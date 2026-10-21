// Logic checks without a browser: the mock API and the shared bridge, loaded in a Node sandbox.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { suite } = require('./lib');

function sandbox() {
  const store = {};
  const React = { createElement() {}, Fragment: {}, useState() {}, useEffect() {}, useMemo() {}, useRef() {}, useCallback() {}, createContext() { return {}; }, useContext() {}, useId() {} };
  const ctx = {
    console, Intl, Date, Math, Set, Map, URL, URLSearchParams, clearTimeout, Promise, JSON, React,
    /* api.js waits like a network call; no need to here */
    setTimeout: (fn) => setTimeout(fn, 0),
    htm: { bind: () => () => null }, document: { documentElement: { setAttribute() {}, removeAttribute() {} } },
    window: { addEventListener() {}, removeEventListener() {} },
    localStorage: { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  };
  vm.createContext(ctx);
  const root = path.resolve(__dirname, '..');
  for (const f of ['js/shared/core.js', 'js/shared/bridge.js', 'js/shared/domain.js', 'js/mock/ai.js', 'js/mock/db.js', 'js/mock/api.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}

/* every page's scripts share one global scope: a repeated top-level const would stop the page from loading */
function loadPage(file) {
  const root = path.resolve(__dirname, '..');
  const store = {};
  const ctx = {
    console, Intl, Date, Math, Set, Map, URL, URLSearchParams, setTimeout, clearTimeout, Promise, JSON,
    React: { createElement() {}, Fragment: {}, useState() {}, useEffect() {}, useMemo() {}, useRef() {}, useCallback() {}, createContext() { return {}; }, useContext() {}, useId() {} },
    ReactDOM: { createRoot: () => ({ render() {} }) }, htm: { bind: () => () => null },
    document: { documentElement: { setAttribute() {}, removeAttribute() {} }, getElementById: () => ({}), addEventListener() {} },
    location: { hash: '', search: '' }, window: { addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) },
    localStorage: { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  };
  vm.createContext(ctx);
  const scripts = [...fs.readFileSync(path.join(root, file), 'utf8').matchAll(/<script src="(js\/[^"]+)"/g)].map((m) => m[1]).filter((f) => !f.includes('dev-errors'));
  for (const f of scripts) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  return `${scripts.length} scripts`;
}

async function run() {
  const s = suite('Logic: mock API and shared state (no browser)');
  for (const page of ['index.html', 'admin.html', 'admin-v1.html']) await s.step(`${page}: every script loads, no name clashes`, async () => loadPage(page));
  const c = sandbox();
  const E = (code) => vm.runInContext(code, c);
  const call = async (method, url, body) => {
    const res = await E(`apiFetch(${JSON.stringify(url)}, ${JSON.stringify({ method, body: body ? JSON.stringify(body) : undefined })})`);
    return { status: res.status, body: await res.json() };
  };

  s.check('streak keeps yesterday\'s chain before today\'s first entry', E(`computeStreak([addDaysISO(localISODate(), -1), addDaysISO(localISODate(), -2)])`) === 2);
  s.check('streak counts today when logged', E(`computeStreak([localISODate(), localISODate(), addDaysISO(localISODate(), -1)])`) === 2);
  s.check('trend: 0 → 1 meltdown is not "increasing"', E(`computeTrend([0, 0, 0, 1])`) === 'stable');
  s.check('trend: a real rise is still "increasing"', E(`computeTrend([0, 1, 2, 3])`) === 'increasing');
  s.check('safety words ignore tone marks', E(`safetyMatches('Chiều nay bé dap dau vao tuong', DEFAULT_SAFETY_WORDS).join()`) === 'đập đầu');
  s.check('safety words: no false match on calm notes', E(`safetyMatches('Bé chơi xếp khối rất vui', DEFAULT_SAFETY_WORDS).length`) === 0);
  s.check('age bands match the console', E(`[ageBand(30), ageBand(50), ageBand(100)].join('|')`) === '2–3 tuổi|3–5 tuổi|6–9 tuổi');

  E(`seedDb('stable'); mock.session = USER; syncFamily();`);
  const date = E('localISODate()');
  await s.step('a worrying note opens a P1 alert before any AI call', async () => {
    const r = await call('POST', '/api/daily_log', { childId: 'c-an', date, mood: 'irritable', sleep: { hours: 7, quality: 'poor' }, freeTextNote: 'bé dap dau vao tuong', meltdown: { occurred: false } });
    const alerts = E('bridge.read().alerts');
    if (r.status !== 201 || alerts.length !== 1 || alerts[0].kind !== 'safety' || alerts[0].fam !== 'GĐ-7A3C') throw new Error(JSON.stringify(alerts));
    const rec = await call('POST', '/api/recommendation', { childId: 'c-an', observationId: r.body.observationId });
    if (rec.body.severityLevel !== 'high') throw new Error('advice was ' + rec.body.severityLevel);
    if (E('bridge.read().alerts.length') !== 1) throw new Error('the same entry raised a second alert');
    return 'severity high, one alert';
  });
  await s.step('booking an expert is stored (the repo drops it)', async () => {
    const r = await call('POST', '/api/expert', { childId: 'c-an', date, expertId: 1, note: 'Bé hay khóc\nLiên hệ: 0901234567\nKhung giờ: Tối · 18:00–20:00' });
    const list = await call('GET', '/api/expert/requests');
    if (r.status !== 200 || list.body.requests.length !== 1 || list.body.requests[0].slot !== 'Tối · 18:00–20:00') throw new Error(JSON.stringify(list.body));
    if (E('bridge.read().family.phone') !== '0901234567') throw new Error('contact not kept');
    return r.body.booking.id;
  });
  await s.step('parents only see experts moderators keep active', async () => {
    E(`bridge.update((b) => { b.experts = seedExperts().map((x) => (x.id === 1 ? { ...x, active: false } : x)); return b; })`);
    const r = await call('GET', '/api/expert');
    if (r.body.some((x) => x.id === 1) || r.body.some((x) => x.id === 4)) throw new Error(r.body.map((x) => x.id).join());
    const viet = r.body.find((x) => x.id === 3);
    if (!viet || viet.verified) throw new Error('an expert past 12 months still shows as verified');
  });
  await s.step('AI pause: the entry is saved, advice waits, the safety check still runs', async () => {
    E(`bridge.update((b) => { b.settings = { ...(b.settings || {}), aiEnabled: false, safetyWords: DEFAULT_SAFETY_WORDS }; return b; })`);
    const log = await call('POST', '/api/daily_log', { childId: 'c-may', date, mood: 'anxious', sleep: { hours: 9, quality: 'good' }, freeTextNote: 'con nuot phai vien bi', meltdown: { occurred: false } });
    const rec = await call('POST', '/api/recommendation', { childId: 'c-may', observationId: log.body.observationId });
    if (rec.status !== 503 || rec.body.code !== 'AI_PAUSED' || !rec.body.safety) throw new Error(JSON.stringify(rec.body));
    if (E('bridge.read().alerts.length') !== 2) throw new Error('no alert while paused');
    E(`bridge.update((b) => { b.settings.aiEnabled = true; return b; })`);
  });
  await s.step('a 1–2 star rating goes to the review queue without the child\'s name', async () => {
    const obs = E(`db.observations.filter((o) => o.childId === 'c-an').slice(-1)[0].id`);
    await call('POST', '/api/feedback', { childId: 'c-an', observationId: obs, content: 'An không chịu làm theo', wasHelpful: false, rating: 2 });
    const reviews = E('bridge.read().reviews');
    if (reviews.length !== 1 || reviews[0].comment.includes('An ')) throw new Error(JSON.stringify(reviews));
  });
  await s.step('privacy: consent, AI switch-off and a deletion request', async () => {
    await call('POST', '/api/account/consent');
    await call('POST', '/api/account/ai', { enabled: false });
    const del = await call('POST', '/api/account/requests', { type: 'delete' });
    const dup = await call('POST', '/api/account/requests', { type: 'delete' });
    const acc = await call('GET', '/api/account');
    if (acc.body.family.consent.version !== 'v2' || !acc.body.family.aiOptOut || del.status !== 201 || dup.status !== 409) throw new Error(JSON.stringify(acc.body.family));
    const last = E(`db.observations.slice(-1)[0]`);
    const off = await call('POST', '/api/recommendation', { childId: last.childId, observationId: last.id });
    if (off.body.code !== 'AI_OFF') throw new Error('AI still ran after the parent switched it off');
  });
  await s.step('a suspended account is stopped by the server', async () => {
    E(`bridge.update((b) => { b.family.status = 'suspended'; return b; })`);
    const r = await call('GET', `/api/children`);
    if (r.status !== 403 || r.body.code !== 'ACCOUNT_SUSPENDED') throw new Error(String(r.status));
  });
  return s.report();
}

module.exports = run;
if (require.main === module) run().then((f) => process.exit(f ? 1 : 0));

/* apiFetch(): same URLs, payloads, status codes and error messages as app/api/* in the EchoKid repo. */
'use strict';

/* ---------- apiFetch: same URLs, payloads and errors as app/api/* ---------- */
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const copy = (v) => JSON.parse(JSON.stringify(v));

function respond(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => copy(body), text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) };
}

class Forbidden extends Error { constructor() { super('FORBIDDEN'); } }

function owned(childId) {
  const child = childById(childId);
  if (!child || child.parentUid !== mock.session?.id) throw new Forbidden();
  return child;
}

/* fixed vs the repo: count back from yesterday until today has an entry, so the chain does not read 0 every morning */
function computeStreak(dates) {
  const sorted = [...new Set(dates)].sort().reverse();
  const today = localISODate();
  let streak = 0; let cursor = sorted[0] === today ? today : addDaysISO(today, -1);
  for (const d of sorted) { if (d === cursor) { streak++; cursor = addDaysISO(cursor, -1); } else break; }
  return streak;
}

function computeTrend(values) {
  if (values.length < 4) return 'stable';
  const mid = Math.floor(values.length / 2);
  const first = values.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
  const second = values.slice(mid).reduce((a, b) => a + b, 0) / (values.length - mid);
  /* fixed vs the repo: from a zero baseline any single meltdown read as "increasing"; require a real change */
  if (Math.abs(second - first) <= 0.5) return 'stable';
  if (second > first * 1.15) return 'increasing';
  if (second < first * 0.85) return 'decreasing';
  return 'stable';
}

function latestRecommendationFor(childId, days) {
  for (const o of observationsFor(childId, days).slice().reverse()) {
    if (db.recommendations[o.id]) return { rec: db.recommendations[o.id], obs: o };
  }
  return null;
}

/* ---------- shared with the moderator console (js/shared/bridge.js) ---------- */
function familyChildren() { return db.children.filter((c) => c.parentUid === USER.id); }

/* the family as moderators see it: age bands and counts, never names or diary text */
function syncFamily() {
  if (!db) return;
  const kids = familyChildren();
  const ids = new Set(kids.map((k) => k.id));
  const obs = db.observations.filter((o) => ids.has(o.childId));
  const last = obs.reduce((m, o) => Math.max(m, Date.parse(o.observedAt)), 0);
  bridge.update((b) => {
    const f = b.family || {};
    const joinedAt = f.joinedAt || (kids[0] ? Date.parse(kids[0].createdAt) : Date.now());
    b.family = { ...f, id: DEMO_FAMILY.id, kids: kids.map((k) => ageBand(k.ageMonths)), entries: obs.length, aiCalls: obs.length,
      lastActiveAt: last || f.lastActiveAt || null, joinedAt, consent: f.consent || { version: 'v1', at: joinedAt } };
    return b;
  });
}

const ALERT_REASON = {
  keyword: 'Ghi chú khớp danh sách từ khóa an toàn.',
  safety: 'Gemini đánh giá ghi chú có dấu hiệu nguy cơ an toàn.',
  sustained: 'Ba lần ghi gần nhất có dấu hiệu khó khăn.',
  volatile: 'Cảm xúc đổi qua lại nhiều lần trong ngày.',
};
/* one alert per entry; the console groups alerts into cases */
function raiseAlert(child, o, kind, reason) {
  if (o.alerted) return;
  o.alerted = true;
  bridge.update((b) => { b.alerts.push({ id: bridge.id(b, 'AL'), fam: DEMO_FAMILY.id, band: ageBand(child.ageMonths), at: Date.now(), kind, reason, caseId: null }); return b; });
}

const aiOptedOut = () => !!bridge.read().family?.aiOptOut;
function expertForParents(x) {
  return { id: x.id, name: x.name, specialty: x.specialty, hospital: x.hospital, experience: x.experience, location: x.location, description: x.description,
    verified: expertVerified(x), verifiedAt: x.verifiedAt };
}
const visibleExperts = () => bridge.experts().filter((x) => x.active).map(expertForParents);

const ROUTES = {
  'GET /api/children': () => respond(200, { children: db.children.filter((c) => c.parentUid === mock.session.id) }),
  'POST /api/children': (q, body) => {
    if (!body.name || !body.ageMonths || !body.gender) return respond(400, { error: 'Thiếu thông tin hồ sơ bé' });
    const child = { id: `c-${db.seq++}`, parentUid: mock.session.id, ...body, createdAt: new Date().toISOString() };
    db.children.push(child);
    syncFamily();
    return respond(201, { child });
  },
  'POST /api/daily_log': (q, body) => {
    if (!body.childId || !body.date) return respond(400, { error: 'childId và date là bắt buộc' });
    owned(body.childId);
    const occurred = !!body.meltdown?.occurred;
    const o = makeObservation({
      childId: body.childId, date: body.date, time: timeHM(), mood: body.mood || 'calm', sleep: body.sleep,
      meal: body.meal, meltdown: occurred ? { count: body.meltdown.count, trigger: body.meltdown.trigger } : null,
      social: body.socialInteraction, focus: body.focus, note: body.freeTextNote,
    });
    /* deterministic safety backstop: runs before Gemini and even when AI is paused or switched off */
    o.safetyMatch = safetyMatches([body.freeTextNote, body.meal?.notes, body.meltdown?.trigger].filter(Boolean).join(' '), bridge.settings().safetyWords);
    db.observations.push(o);
    if (o.safetyMatch.length) raiseAlert(childById(body.childId), o, 'safety', ALERT_REASON.keyword);
    syncFamily();
    return respond(201, { dailyLog: dailyLogsFor(body.childId).find((l) => l.date === body.date), observationId: o.id });
  },
  'GET /api/daily_log': (q) => {
    const childId = q.get('childId');
    if (!childId) return respond(400, { error: 'childId là bắt buộc' });
    owned(childId);
    return respond(200, { observations: observationsFor(childId, Math.min(Number(q.get('days') ?? 30), 365)) });
  },
  'GET /api/dashboard': (q) => {
    const childId = q.get('childId');
    if (!childId) return respond(400, { error: 'childId là bắt buộc' });
    owned(childId);
    const logs = dailyLogsFor(childId);
    const recentLogs = logs.slice(0, 7);
    const last = latestRecommendationFor(childId, 30);
    const n = recentLogs.length || 1;
    return respond(200, {
      todayLogSubmitted: logs.some((l) => l.date === localISODate() && l.status === 'completed'),
      streakDays: computeStreak(recentLogs.map((l) => l.date)),
      lastRecommendation: last ? { id: last.rec.logId, activityTitle: last.rec.recommendation.title, date: last.obs.date } : null,
      quickStats7d: {
        meltdownAvg: Number((recentLogs.reduce((s, l) => s + l.meltdown.totalCount, 0) / n).toFixed(1)),
        sleepAvgHours: Number((recentLogs.reduce((s, l) => s + (l.sleep?.hours ?? 0), 0) / n).toFixed(1)),
      },
    });
  },
  'GET /api/dashboard/progress': (q) => {
    const childId = q.get('childId');
    const range = q.get('range') ?? 'week';
    if (!childId) return respond(400, { error: 'childId là bắt buộc' });
    owned(childId);
    const days = range === 'day' ? 1 : range === 'month' ? 30 : 7;
    const from = addDaysISO(localISODate(), -(days - 1));
    const logs = dailyLogsFor(childId).filter((l) => l.date >= from).reverse();
    const n = logs.length || 1;
    return respond(200, {
      childId, range,
      summary: {
        logsSubmitted: logs.length,
        meltdownTrend: computeTrend(logs.map((l) => l.meltdown.totalCount)),
        sleepAvgHours: Number((logs.reduce((s, l) => s + (l.sleep?.hours ?? 0), 0) / n).toFixed(1)),
        activitiesCompleted: logs.filter((l) => l.status === 'completed').length,
      },
      dailyBreakdown: logs.map((l) => ({ date: l.date, mood: l.mood, meltdownCount: l.meltdown.totalCount, sleepHours: l.sleep?.hours ?? 0, socialInteraction: l.socialInteraction, focus: l.focus, activityCompleted: true })),
      observations: observationsFor(childId, days).map((o) => ({
        id: o.id, date: o.date, time: o.time, observedAt: o.observedAt, mood: o.mood, sleepHours: o.sleep?.hours ?? 0,
        meltdownCount: o.meltdown.totalCount, socialInteraction: o.socialInteraction, focus: o.focus, note: o.freeTextNote ?? '',
      })),
    });
  },
  'GET /api/recommendation': (q) => {
    const childId = q.get('childId');
    let observationId = q.get('observationId');
    if (!childId) return respond(400, { error: 'Thiếu mã hồ sơ.' });
    owned(childId);
    if (!observationId) observationId = latestRecommendationFor(childId, 365)?.obs.id ?? null;
    const observation = observationId && db.observations.find((o) => o.id === observationId);
    if (!observation || observation.childId !== childId || !db.recommendations[observationId]) return respond(404, { error: 'Không tìm thấy gợi ý.' });
    return respond(200, { recommendation: generateRecommendation(childById(childId), childId, observationId), observation });
  },
  'POST /api/recommendation': (q, body) => {
    if (!body.childId || !body.observationId) return respond(400, { error: 'Thiếu mã hồ sơ hoặc lần ghi nhận.' });
    const child = owned(body.childId);
    const o = db.observations.find((x) => x.id === body.observationId && x.childId === body.childId);
    if (!o) return respond(404, { error: 'Không tìm thấy lần ghi nhận vừa lưu.' });
    const safety = o.safetyMatch?.length ? { message: SAFETY_MESSAGE } : null;
    if (aiOptedOut()) return respond(403, { error: 'Ba mẹ đã tắt gợi ý AI. Nhật ký vẫn được lưu; bật lại trong mục Quyền riêng tư và dữ liệu.', code: 'AI_OFF', safety });
    if (!bridge.settings().aiEnabled) return respond(503, { error: PARENT_PAUSE_TEXT, code: 'AI_PAUSED', safety });
    if (mock.aiError) return respond(502, { error: 'Gemini không thể phân tích dữ liệu lúc này. Dữ liệu đã được lưu; vui lòng thử lại sau.', code: 'AI_GENERATION_FAILED', safety });
    const fresh = !db.recommendations[o.id];
    const result = generateRecommendation(child, body.childId, o.id);
    if (fresh && result.severityLevel === 'high' && o.alertKind) raiseAlert(child, o, o.alertKind, ALERT_REASON[o.alertKind]);
    return respond(200, result);
  },
  'POST /api/feedback': (q, body) => {
    if (!body.childId || !body.observationId || !body.content?.trim()) return respond(400, { error: 'childId, observationId và content là bắt buộc.' });
    if (body.rating !== undefined && !(Number.isInteger(body.rating) && body.rating >= 1 && body.rating <= 5)) return respond(400, { error: 'rating phải là số nguyên từ 1 đến 5.' });
    owned(body.childId);
    const o = db.observations.find((x) => x.id === body.observationId);
    if (!o || o.childId !== body.childId) return respond(404, { error: 'Không tìm thấy lần ghi nhận.' });
    const now = new Date().toISOString();
    const record = { id: `f-${db.seq++}`, childId: body.childId, observationId: body.observationId, content: body.content.trim(), wasHelpful: body.wasHelpful ?? null, rating: body.rating ?? null, createdAt: now, updatedAt: now };
    db.feedback.push(record);
    if (record.rating != null && record.rating <= 2) {
      const child = childById(body.childId);
      const rec = db.recommendations[body.observationId];
      bridge.update((b) => {
        b.reviews.push({ id: bridge.id(b, 'FB'), at: Date.now(), fam: DEMO_FAMILY.id, band: ageBand(child.ageMonths), act: null,
          title: rec?.recommendation.title || 'Gợi ý', severity: rec?.severityLevel || 'mild', rating: record.rating,
          comment: record.content.split(child.name).join('bé'), version: bridge.settings().promptVersion, status: 'pending', tags: [], reviewedBy: null });
        return b;
      });
    }
    return respond(201, { feedback: record });
  },
  'GET /api/feedback': (q) => {
    const childId = q.get('childId');
    const observationId = q.get('observationId');
    if (!childId) return respond(400, { error: 'childId là bắt buộc.' });
    owned(childId);
    return respond(200, { feedback: db.feedback.filter((f) => f.childId === childId && (!observationId || f.observationId === observationId)) });
  },
  'GET /api/expert': () => respond(200, visibleExperts()),
  /* fixed vs the repo: the request is stored (it used to be dropped) and needs a signed-in parent */
  'POST /api/expert': (q, body) => {
    if (!body.childId || !body.date || !body.expertId) return respond(400, { error: 'Thiếu thông tin yêu cầu chuyên gia.' });
    const expert = visibleExperts().find((e) => e.id === body.expertId);
    if (!expert) return respond(400, { error: 'Chuyên gia không hợp lệ.' });
    const child = owned(body.childId);
    const field = (label) => ((body.note || '').match(new RegExp(`${label}: (.*)`)) || [])[1]?.trim() || '';
    const contact = field('Liên hệ');
    const state = bridge.update((b) => {
      b.bookings.push({ id: bridge.id(b, 'YC'), fam: DEMO_FAMILY.id, band: ageBand(child.ageMonths), childId: child.id, createdAt: Date.now(), expertId: expert.id,
        wantDate: body.date, slot: field('Khung giờ') || SLOTS[0], caseId: null, status: 'new', log: [], confirmedFor: null, cancelReason: null });
      if (/^[0-9 +.]{8,}$/.test(contact)) b.family = { ...(b.family || {}), phone: contact.replace(/\D/g, '') };
      return b;
    });
    const booking = state.bookings[state.bookings.length - 1];
    return respond(200, { ok: true, message: `EchoKid đã nhận yêu cầu và sẽ chuyển tới ${expert.name} trong 24 giờ. Ba mẹ theo dõi trạng thái ngay trên trang này.`, booking: { ...body, id: booking.id, expert } });
  },
  'GET /api/expert/requests': () => {
    const experts = bridge.experts();
    const list = bridge.read().bookings.filter((x) => x.fam === DEMO_FAMILY.id).sort((x, y) => y.createdAt - x.createdAt);
    return respond(200, { requests: list.map((x) => ({ id: x.id, childId: x.childId, createdAt: x.createdAt, wantDate: x.wantDate, slot: x.slot, status: x.status,
      confirmedFor: x.confirmedFor, cancelReason: x.cancelReason, expert: experts.find((e) => e.id === x.expertId)?.name || 'Chuyên gia' })) });
  },
  /* new: privacy and data (the repo has no equivalent yet) */
  'GET /api/account': () => {
    const b = bridge.read();
    const f = b.family || {};
    return respond(200, {
      family: { code: DEMO_FAMILY.id, email: USER.email, consent: f.consent || { version: 'v1', at: null }, status: f.status || 'active', deleteAt: f.deleteAt || null, aiOptOut: !!f.aiOptOut },
      consentVersion: CONSENT_VERSION, aiPaused: !bridge.settings().aiEnabled,
      requests: b.dataRequests.filter((r) => r.fam === DEMO_FAMILY.id).sort((x, y) => y.receivedAt - x.receivedAt),
    });
  },
  'POST /api/account/consent': () => {
    bridge.update((b) => { b.family = { ...(b.family || {}), consent: { version: CONSENT_VERSION, at: Date.now() } }; return b; });
    return respond(200, { ok: true });
  },
  'POST /api/account/ai': (q, body) => {
    const off = body.enabled === false;
    bridge.update((b) => {
      b.family = { ...(b.family || {}), aiOptOut: off };
      /* moderators see the change; it takes effect at once, no one has to process it */
      if (off) b.dataRequests.push({ id: bridge.id(b, 'DR'), type: 'withdraw', channel: 'Trong ứng dụng', fam: DEMO_FAMILY.id, receivedAt: Date.now(), status: 'done', doneAt: Date.now(), doneBy: 'Ba mẹ tự tắt trong ứng dụng' });
      return b;
    });
    return respond(200, { ok: true, aiOptOut: off });
  },
  'POST /api/account/requests': (q, body) => {
    if (!['export', 'delete', 'correct'].includes(body.type)) return respond(400, { error: 'Loại yêu cầu không hợp lệ.' });
    if (bridge.read().dataRequests.some((r) => r.fam === DEMO_FAMILY.id && r.type === body.type && r.status === 'open')) return respond(409, { error: 'Ba mẹ đã gửi yêu cầu này, EchoKid đang xử lý.' });
    const state = bridge.update((b) => {
      b.dataRequests.push({ id: bridge.id(b, 'DR'), type: body.type, channel: 'Trong ứng dụng', fam: DEMO_FAMILY.id, receivedAt: Date.now(), status: 'open', doneAt: null, doneBy: null });
      return b;
    });
    return respond(201, { request: state.dataRequests[state.dataRequests.length - 1] });
  },
  /* right of access: everything stored for this family, as one JSON file */
  'GET /api/account/export': () => {
    const kids = familyChildren();
    const ids = new Set(kids.map((k) => k.id));
    const obs = db.observations.filter((o) => ids.has(o.childId)).map(({ alerted, alertKind, safetyMatch, ...o }) => o);
    return respond(200, {
      exportedAt: new Date().toISOString(), account: { email: USER.email, name: USER.name }, children: kids, observations: obs,
      recommendations: obs.map((o) => db.recommendations[o.id]).filter(Boolean), feedback: db.feedback.filter((f) => ids.has(f.childId)),
      expertRequests: bridge.read().bookings.filter((x) => x.fam === DEMO_FAMILY.id).map(({ fam, log, ...x }) => x),
    });
  },
  'GET /api/report': (q) => {
    const childId = q.get('childId');
    if (!childId) return respond(400, { error: 'Thiếu childId' });
    return respond(200, buildReport(owned(childId)));
  },
};

const PUBLIC_API = new Set(['GET /api/expert']);

const LATENCY = { 'POST /api/recommendation': 1500, 'POST /api/daily_log': 450, 'POST /api/expert': 700, 'POST /api/feedback': 500, 'POST /api/children': 450 };

async function apiFetch(input, init = {}) {
  const url = new URL(input, 'https://echokid.local');
  const method = (init.method || 'GET').toUpperCase();
  const key = `${method} ${url.pathname}`;
  await wait(LATENCY[key] ?? 260 + Math.random() * 180);
  const handler = ROUTES[key];
  if (!handler) return respond(404, { error: 'Not found' });
  if (!PUBLIC_API.has(key) && !mock.session) return respond(401, { error: 'Unauthorized' });
  if (mock.session && bridge.read().family?.status === 'suspended' && !key.startsWith('GET /api/account'))
    return respond(403, { error: 'Tài khoản đang tạm khóa. Vui lòng liên hệ hỗ trợ EchoKid.', code: 'ACCOUNT_SUSPENDED' });
  try { return handler(url.searchParams, init.body ? JSON.parse(init.body) : {}); }
  catch (e) {
    if (e instanceof Forbidden) return respond(403, { error: 'Forbidden' });
    console.error(e);
    return respond(500, { error: 'Internal error' });
  }
}

async function getJSON(url) {
  const res = await apiFetch(url);
  const body = await res.json();
  if (!res.ok) { const err = new Error(body.error || 'Request failed'); err.status = res.status; throw err; }
  return body;
}

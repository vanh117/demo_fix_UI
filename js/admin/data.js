/* Sample usage for the moderator console: 180 days of pseudonymous diary activity, seeded so every reload matches.
   In production this comes from GET /api/admin/metrics, built on observations and feedback plus two collections the
   backend does not have yet: `aiCalls` (Gemini usageMetadata, latency, error per call) and `bookings`. */
'use strict';

const USAGE_DAYS = 180;
/* relative share of diary entries per hour, Vietnam time (UTC+7) */
const HOURLY_WEEKDAY = [0.3, 0.12, 0.05, 0.05, 0.1, 0.6, 2.4, 5.4, 4.6, 3, 2.4, 3.4, 3.6, 2.4, 2.3, 2.9, 4.1, 5, 5.4, 6.9, 9.6, 10.2, 6.4, 2.4];
const HOURLY_WEEKEND = [0.4, 0.15, 0.06, 0.05, 0.08, 0.3, 1, 2.8, 4.8, 5.6, 5.2, 4.4, 3.6, 2.6, 2.8, 3.4, 4.2, 4.6, 5, 6.4, 8.8, 9.2, 6.2, 2.8];
const WEEKDAY_ROWS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const WEEKDAY_NAMES = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];
const AGE_BANDS = ['2–3 tuổi', '3–5 tuổi', '6–9 tuổi', '10–14 tuổi'];
const ACTIVITY_TITLES = {
  calmCorner: 'Góc bình yên 10 phút', visualSchedule: 'Lịch trình bằng hình ảnh', parallelPlay: 'Chơi song song',
  bedtime: 'Nghi thức trước giờ ngủ', sorting: 'Trò chơi phân loại', foodPlay: 'Làm quen món mới',
  sharedReading: 'Đọc truyện tranh cùng nhau', turnTaking: 'Chơi luân phiên xếp khối',
};
const ACTIVITY_WEIGHTS = {
  mild: [1, 0.5, 0.6, 0.5, 0.6, 0.4, 2.2, 2.6],
  moderate: [2.4, 1.6, 1.4, 1, 0.9, 0.7, 0.5, 0.4],
  high: [3, 1.4, 1.6, 0.8, 0.3, 0.4, 0.2, 0.1],
};
const ALERT_REASONS = ['Ba lần ghi gần nhất có dấu hiệu khó khăn', 'Cảm xúc đổi qua lại nhiều lần trong ngày', 'Ghi chú có dấu hiệu nguy cơ an toàn'];
const FAILURES = {
  API_ERROR: { label: 'Gemini API báo lỗi (quá tải, 429, 5xx)', billed: false },
  AI_INVALID_RESPONSE: { label: 'JSON trả về sai cấu trúc, bị loại khi kiểm tra', billed: true },
};

function poisson(rng, lambda) {
  const limit = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k += 1; p *= rng(); } while (p > limit);
  return k - 1;
}
function pickIndex(rng, weights) {
  let r = rng() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return i; }
  return weights.length - 1;
}
function gauss(rng) { return Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng()); }

function makeCall(rng, outcome, hist) {
  if (outcome === 'API_ERROR') return { outcome, input: 0, output: 0, thinking: 0, ms: Math.round(800 + rng() * 9000) };
  const input = Math.round(TOKEN_MODEL.baseInput + TOKEN_MODEL.perHistoryEntry * hist + gauss(rng) * 40);
  const output = Math.max(220, Math.round(TOKEN_MODEL.visibleOutput + gauss(rng) * 45));
  const thinking = clamp(Math.round(850 * Math.exp(0.5 * gauss(rng))), 120, 4200);
  return { outcome, input, output, thinking, ms: Math.round(1300 + thinking * 1.4 + 900 * Math.exp(0.45 * gauss(rng))) };
}

function generateUsage() {
  const rng = mulberry32(71209260);
  const today = localISODate();
  const last = USAGE_DAYS - 1;
  const families = [];
  for (let day = 0; day < USAGE_DAYS; day++) {
    const t = day / last;
    for (let j = poisson(rng, 0.3 + 2.1 * t * t); j > 0; j--) {
      const kind = pickIndex(rng, [0.22, 0.45, 0.33]);
      families.push({
        id: `GĐ-${Math.floor(rng() * 0xffff).toString(16).toUpperCase().padStart(4, '0')}`,
        joinedDay: day,
        rate: [2.5, 1.35, 0.45][kind] * (0.8 + rng() * 0.4),
        churnAfter: rng() < 0.28 ? 14 + Math.floor(rng() * 50) : Infinity,
        kids: Array.from({ length: rng() < 0.16 ? 2 : 1 }, () => ({ band: AGE_BANDS[pickIndex(rng, [0.22, 0.44, 0.24, 0.1])], total: 0, recent: [], difficulty: rng() })),
      });
    }
  }
  const actKeys = Object.keys(ACTIVITY_TITLES);
  const events = [];
  for (let day = 0; day < USAGE_DAYS; day++) {
    const row = (dateFromISO(addDaysISO(today, day - last)).getDay() + 6) % 7;
    const weekend = row >= 5;
    for (const f of families) {
      if (f.joinedDay > day || day - f.joinedDay > f.churnAfter) continue;
      const n = poisson(rng, f.rate * (day - f.joinedDay < 14 ? 1.2 : 1) * (weekend ? 0.9 : 1));
      for (let k = 0; k < n; k++) {
        const hour = pickIndex(rng, weekend ? HOURLY_WEEKEND : HOURLY_WEEKDAY);
        const minute = Math.floor(rng() * 60);
        const kid = f.kids[Math.floor(rng() * f.kids.length)];
        kid.recent = kid.recent.filter((d0) => day - d0 < 30);
        const hist = Math.min(kid.recent.length, TOKEN_MODEL.maxHistory);
        const pHigh = 0.03 + 0.11 * kid.difficulty, pMod = 0.34 + 0.26 * kid.difficulty;
        const r = rng();
        const severity = r < pHigh ? 'high' : r < pHigh + pMod ? 'moderate' : 'mild';
        const o = rng();
        const calls = [makeCall(rng, o < 0.013 ? 'API_ERROR' : o < 0.017 ? 'AI_INVALID_RESPONSE' : 'ok', hist)];
        if (calls[0].outcome !== 'ok' && rng() < 0.7) calls.push(makeCall(rng, 'ok', hist)); // parent taps "Thử phân tích lại"
        const gotAdvice = calls[calls.length - 1].outcome === 'ok';
        const act = actKeys[pickIndex(rng, ACTIVITY_WEIGHTS[severity])];
        const helpful = rng() < { mild: 0.84, moderate: 0.77, high: 0.6 }[severity];
        const fb = gotAdvice && rng() < 0.33 ? { helpful, rating: helpful ? (rng() < 0.55 ? 5 : 4) : (rng() < 0.5 ? 3 : 2) } : null;
        events.push({
          day, row, hour, minute, hist, fam: f.id, band: kid.band, severity, calls, fb,
          act: gotAdvice ? act : null,
          booked: severity === 'high' ? rng() < 0.22 : rng() < 0.004,
          reason: severity === 'high' ? ALERT_REASONS[pickIndex(rng, [0.72, 0.2, 0.08])] : null,
          reads: readsPerSession(kid.total), writes: 3 + (rng() < 0.4 ? 1 : 0),
        });
        kid.total += 1;
        kid.recent.push(day);
      }
    }
  }
  const nowMin = minutesOf(timeHM());
  return {
    today, families,
    events: events.filter((e) => e.day < last || e.hour * 60 + e.minute <= nowMin)
      .sort((a, b) => a.day - b.day || a.hour - b.hour || a.minute - b.minute),
  };
}

function aggregateUsage(usage, fromDay, toDay) {
  const events = usage.events.filter((e) => e.day >= fromDay && e.day <= toDay);
  const days = toDay - fromDay + 1;
  const fams = new Set(), highFams = new Set();
  const tokens = { input: 0, output: 0, thinking: 0 };
  const failures = { API_ERROR: 0, AI_INVALID_RESPONSE: 0 };
  const daily = Array.from({ length: days }, (_, i) => ({ day: fromDay + i, entries: 0, input: 0, output: 0, thinking: 0 }));
  const heat = Array.from({ length: 7 }, () => new Array(24).fill(0));
  const highByHour = new Array(24).fill(0);
  const perMinute = new Map(), perHour = new Map();
  const activities = {};
  const latencies = [];
  const s = { calls: 0, billedCalls: 0, high: 0, moderate: 0, booked: 0, bookedFromAlert: 0, fbCount: 0, fbHelpful: 0, ratingSum: 0, reads: 0, writes: 0, histOver10: 0 };
  for (const e of events) {
    fams.add(e.fam);
    const d = daily[e.day - fromDay];
    d.entries += 1;
    heat[e.row][e.hour] += 1;
    const minuteKey = e.day * 1440 + e.hour * 60 + e.minute, hourKey = e.day * 24 + e.hour;
    perMinute.set(minuteKey, (perMinute.get(minuteKey) || 0) + e.calls.length);
    perHour.set(hourKey, (perHour.get(hourKey) || 0) + e.calls.length);
    for (const c of e.calls) {
      s.calls += 1;
      if (c.outcome !== 'ok') failures[c.outcome] += 1;
      if (c.outcome !== 'API_ERROR') {
        s.billedCalls += 1;
        s.histOver10 += Math.max(0, e.hist - 10);
        for (const k of ['input', 'output', 'thinking']) { tokens[k] += c[k]; d[k] += c[k]; }
      }
      if (c.outcome === 'ok') latencies.push(c.ms);
    }
    if (e.severity === 'high') { s.high += 1; highFams.add(e.fam); highByHour[e.hour] += 1; if (e.booked) s.bookedFromAlert += 1; }
    if (e.severity === 'moderate') s.moderate += 1;
    if (e.booked) s.booked += 1;
    if (e.fb) { s.fbCount += 1; s.ratingSum += e.fb.rating; if (e.fb.helpful) s.fbHelpful += 1; }
    if (e.act) {
      const a = activities[e.act] || (activities[e.act] = { key: e.act, title: ACTIVITY_TITLES[e.act], count: 0, fb: 0, helpful: 0 });
      a.count += 1;
      if (e.fb) { a.fb += 1; if (e.fb.helpful) a.helpful += 1; }
    }
    s.reads += e.reads;
    s.writes += e.writes;
  }
  latencies.sort((a, b) => a - b);
  const q = (p) => (latencies.length ? latencies[Math.min(latencies.length - 1, Math.floor(p * latencies.length))] : 0);
  const peak = (map) => { let best = { count: 0, key: 0 }; for (const [key, count] of map) if (count > best.count) best = { count, key }; return best; };
  const pm = peak(perMinute), ph = peak(perHour);
  const when = (day, hour, minute = 0) => ({ date: addDaysISO(usage.today, day - (USAGE_DAYS - 1)), hour, minute });
  return {
    days, entries: events.length, families: fams.size, highFamilies: highFams.size, ...s, failures, tokens, daily, heat, highByHour,
    latency: { p50: q(0.5), p95: q(0.95) },
    peakMinute: { count: pm.count, ...when(Math.floor(pm.key / 1440), Math.floor((pm.key % 1440) / 60), pm.key % 60) },
    peakHour: { count: ph.count, ...when(Math.floor(ph.key / 24), ph.key % 24) },
    activities: Object.values(activities).sort((a, b) => b.count - a.count),
    alerts: events.filter((e) => e.severity === 'high').slice(-10).reverse()
      .map((e, i) => ({ id: `${e.fam}-${e.day}-${e.hour}-${e.minute}-${i}`, ...when(e.day, e.hour, e.minute), fam: e.fam, band: e.band, reason: e.reason, booked: e.booked })),
  };
}

/* mock of the proposed GET /api/admin/metrics?range=7|30|90&role=admin */
let USAGE = null;
async function adminFetch(url) {
  const u = new URL(url, 'https://echokid.local');
  await new Promise((r) => setTimeout(r, 280));
  if (u.pathname !== '/api/admin/metrics') return { ok: false, status: 404, json: async () => ({ error: 'Not found' }) };
  const role = u.searchParams.get('role') || 'admin';
  if (!['admin', 'backend', 'analytics'].includes(role)) return { ok: false, status: 403, json: async () => ({ error: 'Role is not allowed' }) };
  if (!USAGE) USAGE = generateUsage();
  const range = [7, 30, 90].includes(Number(u.searchParams.get('range'))) ? Number(u.searchParams.get('range')) : 30;
  const last = USAGE_DAYS - 1;
  const body = {
    range, generatedAt: new Date().toISOString(), today: USAGE.today,
    registeredFamilies: USAGE.families.length,
    totalEntries: USAGE.events.length,
    current: aggregateUsage(USAGE, last - range + 1, last),
    previous: aggregateUsage(USAGE, last - 2 * range + 1, last - range),
  };
  return { ok: true, status: 200, json: async () => body };
}

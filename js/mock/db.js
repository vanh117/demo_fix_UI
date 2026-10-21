/* In-memory stand-in for Firestore (services/firestore.service.ts) with a seeded sample diary. */
'use strict';

/* ---------- in-memory stand-in for Firestore (services/firestore.service.ts) ---------- */
const USER = { id: 'u-demo', name: 'Thu Hà', email: 'thuha.demo@example.com' };

/* experts now come from the shared list moderators manage (js/shared/bridge.js) */

const mock = { session: null, aiError: false };

let db = null;

const SAFETY_MESSAGE = 'Ghi chú cho thấy con có thể đã tự làm đau mình hoặc gặp nguy hiểm. Ba mẹ nên liên hệ bác sĩ hoặc chuyên gia sớm để được hướng dẫn giữ an toàn cho con.';

function makeObservation({ childId, date, time, mood, sleep, meal, meltdown, social, focus, note }) {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const observedAt = new Date(y, m - 1, d, hh, mm).toISOString();
  const count = meltdown?.count ?? 0;
  return {
    id: `o-${db.seq++}`, childId, date, time, observedAt, mood,
    sleep: { hours: sleep.hours, quality: sleep.quality },
    meal: meal ?? { ateNormally: true, notes: '' },
    meltdown: { totalCount: count, events: count ? [{ time, trigger: meltdown.trigger || '', count }] : [] },
    socialInteraction: social ?? 'medium', focus: focus ?? 'medium',
    freeTextNote: note ?? '', status: 'completed', createdAt: observedAt,
  };
}

/* the days are relative to today, so the sample diary always looks current */
const AN_RECENT = [
  { day: -7, time: '08:15', mood: 'calm', sleep: [8.5, 'good'], note: 'Đi học đúng giờ, không khóc lúc chia tay mẹ.' },
  { day: -7, time: '17:40', mood: 'irritable', sleep: [8.5, 'good'], social: 'low', focus: 'low', melt: [1, 'Tiếng máy xay sinh tố'], note: 'Bịt tai và la hét khi mẹ xay sinh tố.' },
  { day: -6, time: '09:00', mood: 'happy', sleep: [9, 'good'], social: 'high', note: 'Chơi xếp khối với bố gần 15 phút, tự đưa khối cho bố.' },
  { day: -6, time: '18:10', mood: 'irritable', sleep: [9, 'good'], melt: [1, 'Chuyển từ chơi sang tắm'], note: 'Không chịu dừng chơi để đi tắm, khóc khoảng 5 phút.' },
  { day: -4, time: '07:50', mood: 'anxious', sleep: [7, 'restless'], focus: 'low', note: 'Trời mưa, phải đổi đường đi học, con hỏi đi hỏi lại.' },
  { day: -4, time: '16:20', mood: 'withdrawn', sleep: [7, 'restless'], social: 'low', note: 'Về nhà ngồi một mình xếp xe thành hàng, không muốn ai chạm vào.' },
  { day: -4, time: '20:10', mood: 'calm', sleep: [7, 'restless'], note: 'Dịu lại sau khi tắm nước ấm.' },
  { day: -3, time: '08:30', mood: 'calm', sleep: [8, 'good'] },
  { day: -3, time: '15:00', mood: 'happy', sleep: [8, 'good'], social: 'high', focus: 'high', note: 'Chơi thổi bong bóng, con nói được "nữa" 3 lần!' },
  { day: -2, time: '10:10', mood: 'irritable', sleep: [7.5, 'restless'], social: 'low', focus: 'low', melt: [1, 'Chuyển từ chơi sang ăn trưa'], meal: 'Chỉ ăn cơm trắng, gạt rau ra.', note: 'Khóc khoảng 10 phút khi phải cất đồ chơi.' },
  { day: -2, time: '18:45', mood: 'calm', sleep: [7.5, 'restless'], note: 'Chơi đất nặn cùng chị họ.' },
  { day: -1, time: '07:40', mood: 'happy', sleep: [9, 'good'] },
  { day: -1, time: '12:30', mood: 'calm', sleep: [9, 'good'], focus: 'high' },
  { day: -1, time: '19:00', mood: 'happy', sleep: [9, 'good'], social: 'high', note: 'Tự xếp giày lên kệ sau khi đi chơi về.' },
];

const AN_TODAY_STABLE = [
  { day: 0, time: '07:35', mood: 'happy', sleep: [9, 'good'], focus: 'high', note: 'Dậy sớm, vui vẻ ăn sáng.' },
];

const AN_TODAY_ALERT = [
  { day: 0, time: '07:35', mood: 'calm', sleep: [6.5, 'poor'], note: 'Thức giấc hai lần trong đêm.' },
  { day: 0, time: '10:05', mood: 'anxious', sleep: [6.5, 'poor'], focus: 'low', melt: [1, 'Đổi đường đi học'], note: 'Khóc và bịt tai suốt đoạn đường tới lớp.' },
  { day: 0, time: '13:20', mood: 'irritable', sleep: [6.5, 'poor'], social: 'low', focus: 'low', melt: [2, 'Chỗ đông người'], note: 'Ở siêu thị, con nằm ra sàn và la hét rất lâu.' },
  { day: 0, time: '16:40', mood: 'withdrawn', sleep: [6.5, 'poor'], social: 'low', focus: 'low', meal: 'Bỏ bữa chiều.', note: 'Ngồi một mình trong góc phòng, không muốn ai lại gần.' },
];

const MAY_RECENT = [
  { day: -9, time: '09:30', mood: 'happy', sleep: [11, 'good'] },
  { day: -8, time: '16:00', mood: 'calm', sleep: [10.5, 'good'] },
  { day: -6, time: '10:15', mood: 'irritable', sleep: [10, 'restless'], melt: [1, 'Đói hoặc mệt'], note: 'Quấy khi đói, dịu lại sau khi ăn.' },
  { day: -4, time: '08:45', mood: 'calm', sleep: [11, 'good'] },
  { day: -2, time: '17:30', mood: 'happy', sleep: [11, 'good'], social: 'high', note: 'Tự chỉ vào con mèo và kêu "meo".' },
  { day: -1, time: '09:10', mood: 'calm', sleep: [10.5, 'good'] },
];

const GEN_NOTES_POS = ['Chơi cát ở công viên rất vui.', 'Tự cầm thìa ăn hết bát cháo.', 'Nhìn mẹ và cười khi được cù.', 'Ngồi nghe kể chuyện đến hết.', 'Chủ động kéo tay bố đi xem cá.'];

const GEN_NOTES_LOW = ['Khó chịu khi mặc áo mới.', 'Không muốn rời màn hình.', 'Hay đi vòng quanh phòng.', 'Bịt tai khi nghe tiếng khoan.', 'Không chịu vào lớp buổi sáng.'];

const GEN_TRIGGERS = ['Tiếng ồn lớn', 'Chuyển hoạt động', 'Đói hoặc mệt', 'Chỗ đông người', 'Thay đổi lịch sinh hoạt'];

const GEN_MEALS = ['Chỉ ăn bánh gạo, từ chối cơm.', 'Ăn rất ít bữa trưa.', 'Nhè thức ăn có rau.'];

function addEntries(childId, list, today, shiftToNow) {
  const nowMin = minutesOf(timeHM());
  list.forEach((e, idx) => {
    let time = e.time;
    if (shiftToNow && e.day === 0) {
      const later = list.length - idx - 1;
      const latest = nowMin - 20 - later * 55;
      if (minutesOf(time) > latest) time = hmOf(Math.max(6 * 60 + idx * 5, latest));
    }
    db.observations.push(makeObservation({
      childId, date: addDaysISO(today, e.day), time, mood: e.mood,
      sleep: { hours: e.sleep[0], quality: e.sleep[1] },
      meal: e.meal ? { ateNormally: false, notes: e.meal } : undefined,
      meltdown: e.melt ? { count: e.melt[0], trigger: e.melt[1] } : null,
      social: e.social, focus: e.focus, note: e.note,
    }));
  });
}

function seedDb(scenario) {
  /* before 8 AM nobody has logged yet: end the sample diary yesterday instead of inventing future entries */
  const beforeEight = new Date().getHours() < 8;
  const today = beforeEight ? addDaysISO(localISODate(), -1) : localISODate();
  db = { children: [], observations: [], recommendations: {}, feedback: [], seq: 1 };
  if (scenario === 'new') return;
  const created = new Date(); created.setDate(created.getDate() - 45);
  db.children.push({ id: 'c-an', parentUid: USER.id, name: 'An', ageMonths: 50, gender: 'male', diagnosis: { status: 'diagnosed', type: [], diagnosedDate: null }, goals: [], createdAt: created.toISOString() });
  db.children.push({ id: 'c-may', parentUid: USER.id, name: 'Mây', ageMonths: 30, gender: 'female', diagnosis: { status: 'not_evaluated', type: [], diagnosedDate: null }, goals: [], createdAt: created.toISOString() });

  /* older history for An: more hard moments early in the month, fewer lately */
  const rng = mulberry32(20260929);
  const slots = [[450, 540], [660, 780], [930, 1230]];
  for (let back = 29; back >= 8; back--) {
    if ([26, 21, 16, 11].includes(back)) continue;
    const date = addDaysISO(today, -back);
    const early = back >= 19;
    const hours = clamp(Math.round((8.6 + (rng() - 0.5) * 2.6 - (early ? 0.4 : 0)) * 2) / 2, 5.5, 11);
    const quality = hours >= 8.5 ? 'good' : hours >= 7 ? 'restless' : 'poor';
    const n = 1 + Math.floor(rng() * 3);
    const picked = slots.slice().sort(() => rng() - 0.5).slice(0, n).sort((a, b) => a[0] - b[0]);
    for (const [lo, hi] of picked) {
      const mood = weighted(rng, early
        ? [['happy', 0.2], ['calm', 0.3], ['irritable', 0.2], ['anxious', 0.15], ['withdrawn', 0.15]]
        : [['happy', 0.32], ['calm', 0.42], ['irritable', 0.12], ['anxious', 0.09], ['withdrawn', 0.05]]);
      const pos = POSITIVE.has(mood);
      const melt = !pos && rng() < (early ? 0.62 : 0.34) ? (rng() < 0.25 ? 2 : 1) : 0;
      const ateNormally = rng() > 0.12;
      db.observations.push(makeObservation({
        childId: 'c-an', date, time: hmOf(lo + Math.floor(rng() * (hi - lo) / 5) * 5), mood,
        sleep: { hours, quality },
        meal: ateNormally ? undefined : { ateNormally: false, notes: pickOne(rng, GEN_MEALS) },
        meltdown: melt ? { count: melt, trigger: pickOne(rng, GEN_TRIGGERS) } : null,
        social: pos ? (rng() < 0.45 ? 'high' : 'medium') : (rng() < 0.55 ? 'low' : 'medium'),
        focus: pos ? (rng() < 0.35 ? 'high' : 'medium') : (rng() < 0.5 ? 'low' : 'medium'),
        note: rng() < 0.3 ? pickOne(rng, pos ? GEN_NOTES_POS : GEN_NOTES_LOW) : '',
      }));
    }
  }
  addEntries('c-an', AN_RECENT, today, false);
  addEntries('c-an', scenario === 'alert' ? AN_TODAY_ALERT : AN_TODAY_STABLE, today, !beforeEight);
  addEntries('c-may', MAY_RECENT, today, false);

  /* every saved entry went through POST /api/recommendation in the real flow */
  db.observations.sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  for (const o of db.observations) generateRecommendation(childById(o.childId), o.childId, o.id);

  const fb = (day, time, wasHelpful, rating, content) => {
    const o = db.observations.find((x) => x.childId === 'c-an' && x.date === addDaysISO(today, day) && x.time === time);
    if (o) db.feedback.push({ id: `f-${db.seq++}`, childId: 'c-an', observationId: o.id, content, wasHelpful, rating, createdAt: o.observedAt, updatedAt: o.observedAt });
  };
  fb(-3, '15:00', true, 5, 'Con chơi được 8 phút và nói "nữa" 3 lần.');
  fb(-2, '10:10', true, 4, 'Con dịu lại sau khoảng 6 phút ôm gối.');
}

function childById(id) { return db.children.find((c) => c.id === id) || null; }

/* calendar-window version of getObservations(childId, days) */
function observationsFor(childId, days) {
  const from = addDaysISO(localISODate(), -(days - 1));
  return db.observations.filter((o) => o.childId === childId && o.date >= from)
    .sort((a, b) => a.observedAt.localeCompare(b.observedAt));
}

/* daily log documents, rebuilt the way upsertDailyLog merges each observation */
function dailyLogsFor(childId) {
  const byDate = new Map();
  for (const o of db.observations.filter((x) => x.childId === childId).sort((a, b) => a.observedAt.localeCompare(b.observedAt))) {
    const prev = byDate.get(o.date);
    byDate.set(o.date, {
      id: `${childId}_${o.date}`, childId, date: o.date, status: 'completed',
      mood: o.mood, sleep: o.sleep, meal: o.meal, socialInteraction: o.socialInteraction, focus: o.focus, freeTextNote: o.freeTextNote,
      meltdown: { totalCount: (prev?.meltdown.totalCount ?? 0) + o.meltdown.totalCount, events: [...(prev?.meltdown.events ?? []), ...o.meltdown.events] },
    });
  }
  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
}

function generateRecommendation(child, childId, observationId) {
  const current = db.observations.find((o) => o.id === observationId);
  if (!current || current.childId !== childId) throw new Error('OBSERVATION_NOT_FOUND');
  const recent = db.observations.filter((i) => i.childId === childId && i.id !== observationId &&
    i.observedAt < current.observedAt && i.date >= addDaysISO(current.date, -30));
  const risk = assessRiskPatterns(current, recent);
  /* the keyword backstop (POST /api/daily_log) wins over the model: a match is always "Cần chú ý" */
  const flagged = (current.safetyMatch || []).length > 0;
  const cached = db.recommendations[observationId];
  if (cached) {
    const severityLevel = flagged || risk.high ? 'high' : severityFromObservation(current, cached.severityLevel);
    return {
      ...cached, severityLevel,
      escalation: severityLevel === 'high' ? { shouldSuggestExpert: true, message: flagged ? SAFETY_MESSAGE : cached.escalation.message || highRiskMessage(risk.reasons) } : cached.escalation,
    };
  }
  const generated = mockGenerateAI(child, current, recent);
  const severityLevel = flagged || risk.high ? 'high' : severityFromObservation(current, generated.severityLevel);
  /* which kind of case this opens in the moderator console */
  current.alertKind = severityLevel !== 'high' ? null : flagged || generated.severityLevel === 'high' ? 'safety'
    : risk.reasons.some((r) => r.startsWith('Ba lần')) ? 'sustained' : 'volatile';
  const result = {
    logId: observationId, severityLevel,
    empathyMessage: generated.empathyMessage, contextSummary: generated.contextSummary,
    recommendation: { activityId: `ai-${observationId}`, ...generated.recommendation },
    escalation: severityLevel === 'high'
      ? { shouldSuggestExpert: true, message: flagged ? SAFETY_MESSAGE : generated.escalation.message || highRiskMessage(risk.reasons) }
      : generated.escalation,
    disclaimer: DISCLAIMER,
  };
  db.recommendations[observationId] = { ...result, createdAt: current.observedAt };
  return { ...result, createdAt: null };
}

/* app/api/report/route.ts (enum values shown in Vietnamese) */
function buildReport(child) {
  const observations = observationsFor(child.id, 30);
  const recent = observations.slice(-20);
  const counts = recent.reduce((acc, i) => { acc[i.mood] = (acc[i.mood] ?? 0) + 1; return acc; }, {});
  const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const sleepAvg = recent.length ? recent.reduce((s, i) => s + (i.sleep?.hours ?? 0), 0) / recent.length : 0;
  return [
    'TÓM TẮT THEO DÕI ECHOKID',
    `Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}`, '',
    `Bé: ${child.name}`, `Tuổi: ${child.ageMonths} tháng`,
    `Số lần ghi nhận trong 30 ngày: ${observations.length}`,
    `Tâm trạng thường gặp: ${MOOD_LABEL[dominant] ?? 'Chưa đủ dữ liệu'}`,
    `Thời lượng ngủ trung bình: ${sleepAvg.toFixed(1)} giờ`, '',
    'CÁC GHI NHẬN GẦN NHẤT',
    ...recent.slice().reverse().map((i) => `- ${i.date} ${i.time}: ${MOOD_LABEL[i.mood] ?? i.mood}; ngủ ${i.sleep?.hours ?? 0}h; tương tác ${LEVEL_LABEL[i.socialInteraction]}; tập trung ${LEVEL_LABEL[i.focus]}${i.freeTextNote ? `; ghi chú: ${i.freeTextNote}` : ''}`),
    '', 'Lưu ý: Tài liệu do phụ huynh ghi nhận, chỉ hỗ trợ trao đổi và không thay thế chẩn đoán y khoa.',
  ].join('\n');
}

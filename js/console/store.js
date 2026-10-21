/* Mock server for the moderator console. It stands in for the Next.js routes and the Firestore collections the
   console needs (moderators, cases, bookings, experts, settings, announcements, auditLog), seeded from the same
   sample usage as the charts. consoleFetch() answers like fetch(). The role always comes from the signed-in
   member on the server side, never from the request. */
'use strict';

/* ---------- roles ---------- */
const ROLES = {
  admin: { label: 'Quản trị viên', short: 'Quản trị', desc: 'Toàn quyền: số liệu, hỗ trợ gia đình, điều khiển AI, nhóm điều hành và nhật ký kiểm tra.',
    perms: ['metrics', 'cost', 'cases', 'reveal', 'bookings', 'experts', 'accounts', 'ai', 'quality', 'review', 'system', 'announce', 'team', 'audit'] },
  safety: { label: 'Kiểm duyệt an toàn', short: 'An toàn', desc: 'Xử lý ca cảnh báo, yêu cầu chuyên gia, danh sách chuyên gia và rà soát gợi ý.',
    perms: ['metrics', 'cases', 'reveal', 'bookings', 'experts', 'quality', 'review', 'announce'] },
  backend: { label: 'Backend / SRE', short: 'Vận hành', desc: 'Tải hệ thống, lỗi API, điều khiển AI và thông báo bảo trì.',
    perms: ['metrics', 'system', 'ai', 'announce'] },
  analytics: { label: 'Phân tích dữ liệu', short: 'Phân tích', desc: 'Xu hướng sử dụng, chi phí, dự báo và chất lượng gợi ý, chỉ xem.',
    perms: ['metrics', 'cost', 'quality'] },
};
const AREAS = [
  ['metrics', 'Tổng quan, khung giờ'], ['cost', 'Chi phí AI, dự báo'], ['cases', 'Ca cảnh báo an toàn'], ['reveal', 'Xem liên hệ gia đình (ghi lý do)'],
  ['bookings', 'Yêu cầu chuyên gia'], ['experts', 'Danh sách chuyên gia'], ['accounts', 'Tài khoản, yêu cầu dữ liệu'], ['ai', 'Điều khiển AI'],
  ['quality', 'Xem chất lượng gợi ý'], ['review', 'Rà soát gợi ý'], ['system', 'Hệ thống, lỗi, ngưỡng báo động'], ['announce', 'Thông báo tới phụ huynh'],
  ['team', 'Nhóm điều hành'], ['audit', 'Nhật ký kiểm tra'],
];
const can = (member, perm) => !!member && !!ROLES[member.role] && ROLES[member.role].perms.includes(perm);

/* ---------- vocabulary ---------- */
const CASE_KIND = {
  safety: { priority: 1, label: 'Nguy cơ an toàn', sla: 2 * HOUR, slaText: '2 giờ', tone: 'crit', icon: 'alert', hint: 'Ghi chú nhắc tới việc con tự làm đau mình hoặc gặp nguy hiểm.' },
  sustained: { priority: 2, label: 'Khó khăn kéo dài', sla: 24 * HOUR, slaText: '24 giờ', tone: 'warn', icon: 'trendDown', hint: 'Ba lần ghi gần nhất đều có dấu hiệu khó khăn.' },
  volatile: { priority: 3, label: 'Dao động trong ngày', sla: 72 * HOUR, slaText: '72 giờ', tone: 'neutral', icon: 'activity', hint: 'Cảm xúc đổi qua lại nhiều lần trong một ngày.' },
};
const KIND_OF_REASON = { [ALERT_REASONS[0]]: 'sustained', [ALERT_REASONS[1]]: 'volatile', [ALERT_REASONS[2]]: 'safety' };
const CASE_STATUS = {
  new: { label: 'Chưa có người nhận', tone: 'warn', icon: 'bell' },
  ack: { label: 'Đang xử lý', tone: 'primary', icon: 'clock' },
  contacted: { label: 'Đã liên hệ', tone: 'info', icon: 'phone' },
  closed: { label: 'Đã đóng', tone: 'neutral', icon: 'check' },
};
const CLOSE_OUTCOMES = {
  booked: 'Gia đình đã gửi yêu cầu gặp chuyên gia',
  stable: 'Đã liên hệ, gia đình ổn, không cần hỗ trợ thêm',
  emergency: 'Đã hướng dẫn gọi cấp cứu 115 hoặc tổng đài 111',
  unreachable: 'Không liên lạc được sau 3 lần thử',
  false_alarm: 'Cảnh báo chưa chính xác',
};
const BOOKING_STATUS = {
  new: { label: 'Chờ chuyển', tone: 'warn', icon: 'inbox' },
  forwarded: { label: 'Đã gửi chuyên gia', tone: 'info', icon: 'send' },
  confirmed: { label: 'Đã xác nhận lịch', tone: 'primary', icon: 'calendar' },
  done: { label: 'Đã gặp', tone: 'good', icon: 'checkCircle' },
  cancelled: { label: 'Đã hủy', tone: 'neutral', icon: 'x' },
};
const BOOKING_SLOTS = ['Sáng · 08:00–11:00', 'Chiều · 13:30–17:00', 'Tối · 18:00–20:00'];
const DATA_REQ = {
  export: { label: 'Xuất dữ liệu', icon: 'download' },
  delete: { label: 'Xóa tài khoản và dữ liệu', icon: 'trash' },
  correct: { label: 'Sửa thông tin hồ sơ bé', icon: 'pencil' },
  withdraw: { label: 'Rút lại đồng ý xử lý bằng AI', icon: 'ban' },
};
const DATA_REQ_DUE = 72 * HOUR;
const REVEAL_REASONS = ['Liên hệ gia đình theo ca nguy cơ an toàn', 'Gia đình chưa phản hồi lời nhắc trong ứng dụng', 'Hỗ trợ gia đình đặt lịch với chuyên gia', 'Gia đình gửi email nhờ hỗ trợ'];
const REVEAL_TTL = 10 * MIN;
const REVIEW_TAGS = ['Không hợp tuổi', 'Khó làm tại nhà', 'Lặp lại gợi ý cũ', 'Sai mức độ', 'Quá chung chung', 'Khác'];
const THINKING_LEVELS = [{ value: 'low', label: 'Thấp', tokens: 200 }, { value: 'medium', label: 'Vừa', tokens: 900 }, { value: 'high', label: 'Cao', tokens: 2000 }];
const EXPERT_VERIFY_TTL = EXPERT_VERIFY_DAYS * DAY;
const EXPERT_CHECKS = [
  ['license', 'Đã tra số chứng chỉ hành nghề trên cổng thông tin của Sở Y tế hoặc Bộ Y tế'],
  ['workplace', 'Đã gọi tới nơi làm việc để xác nhận người này đang công tác'],
  ['agreement', 'Đã ký thỏa thuận bảo mật dữ liệu với EchoKid'],
];
const ANNOUNCE_KIND = {
  info: { label: 'Thông tin', tone: 'info', icon: 'info' },
  maintenance: { label: 'Bảo trì', tone: 'warn', icon: 'server' },
  incident: { label: 'Sự cố', tone: 'crit', icon: 'alert' },
};
const AUDIT_ACTIONS = {
  'case.ack': ['Nhận xử lý ca', 'cases'], 'case.assign': ['Giao ca', 'cases'], 'case.contacted': ['Đánh dấu đã liên hệ', 'cases'],
  'case.note': ['Thêm ghi chú vào ca', 'cases'], 'case.close': ['Đóng ca', 'cases'], 'case.reopen': ['Mở lại ca', 'cases'],
  'contact.reveal': ['Xem liên hệ gia đình', 'privacy'], 'account.lookup': ['Tra cứu tài khoản', 'privacy'],
  'booking.forward': ['Chuyển yêu cầu cho chuyên gia', 'bookings'], 'booking.confirm': ['Ghi nhận lịch đã xác nhận', 'bookings'],
  'booking.done': ['Đánh dấu buổi hẹn đã diễn ra', 'bookings'], 'booking.cancel': ['Hủy yêu cầu chuyên gia', 'bookings'],
  'expert.create': ['Thêm chuyên gia', 'experts'], 'expert.update': ['Sửa thông tin chuyên gia', 'experts'], 'expert.verify': ['Xác minh chuyên gia', 'experts'],
  'expert.show': ['Hiện chuyên gia với ba mẹ', 'experts'], 'expert.hide': ['Ẩn chuyên gia', 'experts'],
  'account.export': ['Xuất dữ liệu gia đình', 'accounts'], 'account.suspend': ['Tạm khóa tài khoản', 'accounts'], 'account.unsuspend': ['Mở khóa tài khoản', 'accounts'],
  'account.delete': ['Lên lịch xóa tài khoản', 'accounts'], 'account.delete_cancel': ['Hủy lịch xóa tài khoản', 'accounts'], 'request.done': ['Hoàn tất yêu cầu dữ liệu', 'accounts'],
  'ai.pause': ['Tạm dừng gợi ý AI', 'ai'], 'ai.resume': ['Bật lại gợi ý AI', 'ai'], 'ai.settings': ['Đổi cài đặt AI', 'ai'],
  'alerts.settings': ['Đổi ngưỡng báo động', 'ai'], 'alerts.test': ['Gửi thử báo động', 'ai'],
  'review.done': ['Rà soát gợi ý', 'quality'], 'announce.create': ['Tạo thông báo cho phụ huynh', 'other'], 'announce.end': ['Kết thúc thông báo', 'other'],
  'team.invite': ['Mời thành viên', 'team'], 'team.role': ['Đổi vai trò', 'team'], 'team.revoke': ['Thu hồi quyền', 'team'],
};
const AUDIT_GROUPS = { cases: 'Ca cảnh báo', privacy: 'Quyền riêng tư', bookings: 'Yêu cầu chuyên gia', experts: 'Chuyên gia', accounts: 'Tài khoản', ai: 'AI và báo động', quality: 'Chất lượng', team: 'Nhóm điều hành', other: 'Khác' };

const TEAM_SEED = [
  { id: 'm-1', name: 'Lan Anh', email: 'lananh@echokid.example', role: 'admin', status: 'active', twoStep: true, idle: 3 * MIN, since: '02/03/2026' },
  { id: 'm-2', name: 'Minh Châu', email: 'minhchau@echokid.example', role: 'safety', status: 'active', twoStep: true, idle: 38 * MIN, since: '15/04/2026' },
  { id: 'm-3', name: 'Quốc Tú', email: 'quoctu@echokid.example', role: 'backend', status: 'active', twoStep: true, idle: 3 * HOUR, since: '02/03/2026' },
  { id: 'm-4', name: 'Hải Yến', email: 'haiyen@echokid.example', role: 'analytics', status: 'active', twoStep: false, idle: 2 * DAY, since: '20/07/2026' },
  { id: 'm-5', name: 'Đức Huy', email: 'duchuy@echokid.example', role: 'safety', status: 'invited', twoStep: false, idle: null, since: null },
];

const FEEDBACK_TEXT = {
  calmCorner: ['Nhà chật, không có chỗ làm góc riêng cho con.', 'Con không chịu vào góc yên tĩnh, càng khóc to hơn.'],
  visualSchedule: ['Con chưa hiểu tranh, cần cách làm thẻ hình đơn giản hơn.', 'Phải in tranh mới làm được, buổi tối không kịp.'],
  parallelPlay: ['Con bỏ đi chỗ khác sau một phút.', 'Gợi ý giống hệt hôm qua.'],
  bedtime: ['Gợi ý giống hệt hôm qua.', 'Nhà có em bé nên không giảm tiếng ồn được.'],
  sorting: ['Hoạt động quá dài so với tuổi của con.', 'Con chỉ ném đồ, chưa phân loại được.'],
  foodPlay: ['Con nôn khi chạm vào rau, không làm tiếp được.', 'Gợi ý chung chung, không nói tới việc con chỉ ăn đồ trắng.'],
  sharedReading: ['Con không ngồi yên được để nghe.', 'Bé nhỏ quá, chưa hợp với truyện tranh.'],
  turnTaking: ['Bé chưa biết xếp khối, cần hoạt động dễ hơn.', 'Con giành đồ chơi, không chờ lượt được.'],
};
const CASE_NOTES = {
  contacted: ['Đã gọi cho ba mẹ, con đã bình tĩnh lại. Gửi thêm hướng dẫn góc bình yên.', 'Ba mẹ cho biết tuần này con đổi lớp nên khó chịu. Hẹn hỏi lại sau 3 ngày.',
    'Đã nhắn qua email, ba mẹ trả lời trong buổi chiều. Gia đình muốn xem danh sách chuyên gia ở Hà Nội.'],
  emergency: ['Ba mẹ cho biết con đập đầu nhiều lần. Đã hướng dẫn giữ an toàn và đưa con tới cơ sở y tế gần nhất.'],
};

/* ---------- state ---------- */
const mockAuth = { memberId: 'm-1', outsider: false, expired: false };
let srv = null;

function evAt(e) {
  const d = dateFromISO(addDaysISO(USAGE.today, e.day - (USAGE_DAYS - 1)));
  d.setHours(e.hour, e.minute, 0, 0);
  return d.getTime();
}
const maskEmail = (email) => { const [u, d] = email.split('@'); return `${u.slice(0, 3)}•••@${d}`; };
const maskPhone = (p) => `${p.slice(0, 3)}• ••• ${p.slice(-3)}`;
const hex4 = (rng) => Math.floor(rng() * 0xffff).toString(36).padStart(4, '0');

function buildServer() {
  if (!USAGE) USAGE = generateUsage();
  const rng = mulberry32(20261001);
  const now = Date.now();
  const last = USAGE_DAYS - 1;
  const team = TEAM_SEED.map(({ idle, ...m }) => ({ ...m, lastActiveAt: idle == null ? null : now - idle }));
  const safetyIds = ['m-2', 'm-2', 'm-2', 'm-1'];
  const memberById = (id) => team.find((m) => m.id === id);
  const s = { seq: 1, team, settings: null, audit: [], auditLive: [], reveals: [], alertCases: new Map(), dirty: false };

  /* experts */
  s.experts = seedExperts(now).map((x) => ({ ...x, createdAt: now - 200 * DAY }));

  /* accounts */
  s.accounts = new Map();
  for (const f of USAGE.families) {
    if (s.accounts.has(f.id)) continue;
    const slug = fold(f.id).replace(/[^a-z0-9]/g, '');
    s.accounts.set(f.id, {
      id: f.id, email: `phuhuynh.${slug}@example.com`, phone: `09${Math.floor(10000000 + rng() * 89999999)}`,
      joinedAt: evAt({ day: f.joinedDay, hour: 8 + Math.floor(rng() * 13), minute: Math.floor(rng() * 60) }),
      kids: f.kids.map((k) => k.band), entries: 0, aiCalls: 0, aiFailures: 0, lastActiveAt: null,
      consent: f.joinedDay < last - 90 ? { version: 'v1', at: null } : { version: 'v2', at: null }, status: 'active', deleteAt: null,
    });
  }
  for (const a of s.accounts.values()) a.consent.at = a.joinedAt;

  /* walk the sample events once */
  const highs = [], booked = [], failures = [], feedback = [], callsByFamDay = new Map();
  for (const e of USAGE.events) {
    const a = s.accounts.get(e.fam);
    const at = evAt(e);
    a.entries += 1; a.aiCalls += e.calls.length;
    a.aiFailures += e.calls.filter((c) => c.outcome !== 'ok').length;
    a.lastActiveAt = at;
    if (last - e.day < 7) { const k = `${e.fam}|${e.day}`; callsByFamDay.set(k, (callsByFamDay.get(k) || 0) + e.calls.length); }
    if (now - at > 60 * DAY) continue;
    if (e.severity === 'high') highs.push({ e, at });
    if (e.booked) booked.push({ e, at });
    if (now - at <= 7 * DAY) e.calls.forEach((c, i) => { if (c.outcome !== 'ok') failures.push({ e, at: at + i * 40e3, c, i }); });
    if (e.fb && now - at <= 30 * DAY) feedback.push({ e, at });
  }
  s.callsByFamDay = callsByFamDay;
  for (const a of s.accounts.values()) if (!a.lastActiveAt || now - a.lastActiveAt > 30 * DAY) a.status = 'inactive';

  /* safety cases: alerts from one family within 72 hours of each other form one case */
  const cases = [], openByFam = new Map();
  for (const { e, at } of highs) {
    let c = openByFam.get(e.fam);
    if (!c || at - c.lastAt > 72 * HOUR) {
      c = { fam: e.fam, band: e.band, alerts: [], firstAt: at, lastAt: at };
      cases.push(c); openByFam.set(e.fam, c);
    }
    c.alerts.push({ at, kind: KIND_OF_REASON[e.reason], reason: e.reason, booked: e.booked });
    c.lastAt = at;
  }
  cases.sort((x, y) => x.firstAt - y.firstAt);
  cases.forEach((c, i) => {
    c.id = `CA-${2100 + i}`;
    c.kind = ['safety', 'sustained', 'volatile'].find((k) => c.alerts.some((x) => x.kind === k));
    c.priority = CASE_KIND[c.kind].priority;
    c.booked = c.alerts.some((x) => x.booked);
    c.log = [];
    c.assignee = null; c.ackAt = null; c.closedAt = null; c.outcome = null;
    const sla = CASE_KIND[c.kind].sla;
    const handler = memberById(pickOne(rng, safetyIds));
    const respond = () => Math.max(4 * MIN, Math.min(sla * (rng() < 0.08 ? 1.4 + rng() : 0.08 + rng() * 0.6), (now - c.firstAt) * (0.15 + rng() * 0.7)));
    const push = (at, type, by, text) => c.log.push({ at, type, by: by ? by.name : 'Hệ thống', text: text || '' });
    if (c.booked && c.kind !== 'safety') {
      const at = c.alerts.find((x) => x.booked).at + 6 * MIN;
      c.status = 'closed'; c.closedAt = Math.min(at, now); c.outcome = 'booked';
      push(c.closedAt, 'close', null, 'Tự đóng: gia đình đã gửi yêu cầu gặp chuyên gia ngay trong ứng dụng.');
    } else if (now - c.lastAt > 4 * DAY) {
      const outcome = c.booked ? 'booked' : weighted(rng, c.kind === 'safety' ? [['emergency', 0.2], ['stable', 0.55], ['unreachable', 0.25]] : [['stable', 0.7], ['unreachable', 0.18], ['false_alarm', 0.12]]);
      let ackAt = c.firstAt + respond(), contactedAt = ackAt + (1 + rng() * 6) * HOUR;
      const closedAt = Math.min(now - HOUR, Math.max(contactedAt + HOUR, c.lastAt + (1 + rng() * 2) * DAY));
      contactedAt = Math.min(contactedAt, closedAt - 30 * MIN); ackAt = Math.min(ackAt, contactedAt - 30 * MIN);
      c.assignee = handler.id; c.ackAt = ackAt; c.status = 'closed'; c.outcome = outcome; c.closedAt = closedAt;
      push(ackAt, 'ack', handler);
      if (outcome !== 'unreachable') push(contactedAt, 'contacted', handler, pickOne(rng, outcome === 'emergency' ? CASE_NOTES.emergency : CASE_NOTES.contacted));
      push(closedAt, 'close', handler, CLOSE_OUTCOMES[outcome]);
    } else {
      const fresh = now - c.firstAt < sla * 0.9 || rng() < 0.18;
      if (fresh && rng() < 0.62) c.status = 'new';
      else {
        c.assignee = handler.id; c.ackAt = c.firstAt + respond(); c.status = 'ack';
        push(c.ackAt, 'ack', handler);
        if (rng() < 0.5 && now - c.ackAt > 2 * HOUR) {
          c.status = 'contacted';
          push(c.ackAt + Math.min(now - c.ackAt - MIN, (0.5 + rng() * 5) * HOUR), 'contacted', handler, pickOne(rng, CASE_NOTES.contacted));
        }
      }
    }
  });
  /* the demo always has one fresh, unclaimed P1 case */
  if (!cases.some((c) => c.priority === 1 && c.status === 'new')) {
    const fam = [...s.accounts.values()].filter((a) => a.status === 'active').sort((x, y) => y.lastActiveAt - x.lastActiveAt)[3];
    const at = now - 47 * MIN;
    cases.push({ id: `CA-${2100 + cases.length}`, fam: fam.id, band: fam.kids[0], kind: 'safety', priority: 1, booked: false, status: 'new', log: [],
      assignee: null, ackAt: null, closedAt: null, outcome: null, alerts: [{ at, kind: 'safety', reason: ALERT_REASONS[2], booked: false }], firstAt: at, lastAt: at });
  }
  s.cases = cases;

  /* expert requests (POST /api/expert, once it stores them) */
  const visible = s.experts.filter((x) => x.active).map((x) => x.id);
  s.bookings = booked.map(({ e, at }, i) => {
    const createdAt = at + (2 + rng() * 18) * MIN;
    const age = now - createdAt;
    const want = new Date(createdAt + (1 + Math.floor(rng() * 6)) * DAY);
    const kase = cases.find((c) => c.fam === e.fam && c.alerts.some((x) => x.at === at));
    const b = {
      id: `YC-${4100 + i}`, fam: e.fam, band: e.band, createdAt, expertId: pickOne(rng, visible), wantDate: localISODate(want),
      slot: pickOne(rng, BOOKING_SLOTS), caseId: kase ? kase.id : null, status: 'new', log: [], confirmedFor: null, cancelReason: null,
    };
    const fwd = createdAt + (0.5 + rng() * 5) * HOUR;
    const conf = fwd + (2 + rng() * 30) * HOUR;
    const log = (t, type, by, text) => b.log.push({ at: t, type, by, text: text || '' });
    if (age < 16 * HOUR) { if (rng() < 0.4 && fwd < now) { b.status = 'forwarded'; log(fwd, 'forward', 'Minh Châu'); } }
    else if (age < 40 * HOUR && rng() < 0.25) { /* left waiting: shows up as overdue */ }
    else {
      log(fwd, 'forward', 'Minh Châu');
      if (conf > now) b.status = 'forwarded';
      else if (rng() < 0.07) { b.status = 'cancelled'; b.cancelReason = pickOne(rng, ['Gia đình bận đột xuất', 'Chuyên gia không còn lịch trống tuần này']); log(conf, 'cancel', 'Minh Châu', b.cancelReason); }
      else {
        b.status = 'confirmed'; b.confirmedFor = `${b.wantDate}T${['09:00', '15:00', '18:30'][BOOKING_SLOTS.indexOf(b.slot)]}`;
        log(conf, 'confirm', 'Minh Châu', `Hẹn ${b.slot.split(' · ')[0].toLowerCase()} ${fmtFullDate(b.wantDate)}`);
        if (dateFromISO(b.wantDate).getTime() + DAY < now) { b.status = 'done'; log(dateFromISO(b.wantDate).getTime() + 20 * HOUR, 'done', 'Minh Châu'); }
      }
    }
    return b;
  });

  /* Gemini errors in the last 7 days, with a request id each */
  s.errors = failures.map(({ e, at, c, i }) => {
    const id = `req_${hex4(rng)}${hex4(rng)}`;
    const api = c.outcome === 'API_ERROR';
    const http = api ? weighted(rng, [[429, 0.55], [503, 0.35], [504, 0.1]]) : 502;
    const detail = api
      ? { 429: 'RESOURCE_EXHAUSTED: vượt giới hạn yêu cầu mỗi phút của dự án.', 503: 'UNAVAILABLE: mô hình đang quá tải, thử lại sau.', 504: 'DEADLINE_EXCEEDED: không có phản hồi sau 10 giây.' }[http]
      : pickOne(rng, ['Thiếu trường "recommendation.steps" trong JSON trả về.', 'JSON bị cắt ở ký tự 1.842 (finishReason: MAX_TOKENS).', 'Trường "severityLevel" có giá trị "medium", ngoài danh sách cho phép.']);
    const raw = api ? null : '{"severityLevel":"moderate","empathyMessage":"Những lúc con khó chịu cũng thường là lúc ba mẹ mệt nhất...","recommendation":{"title":"Góc bình yên 10 phút","durationMinutes":10,"whyThis":"Con đang';
    return { id, at, route: 'POST /api/recommendation', code: c.outcome, http, detail, raw, ms: c.ms, fam: e.fam, retriedOk: e.calls.length > i + 1 && e.calls[e.calls.length - 1].outcome === 'ok' };
  }).sort((x, y) => y.at - x.at);
  s.testRoute = { calls7d: 46, ips: 3, lastAt: now - 5 * HOUR };

  /* advice the parents rated low, for review */
  const promptVersion = (day) => (day < last - 75 ? 'v1.2' : day < last - 20 ? 'v1.3' : 'v1.4');
  s.reviews = feedback.filter(({ e }) => e.act && (!e.fb.helpful && e.fb.rating <= 2)).map(({ e, at }, i) => ({
    id: `FB-${7000 + i}`, at, fam: e.fam, band: e.band, act: e.act, title: ACTIVITY_TITLES[e.act], severity: e.severity, rating: e.fb.rating,
    comment: pickOne(rng, FEEDBACK_TEXT[e.act]), version: promptVersion(e.day), status: now - at > 6 * DAY ? 'done' : 'pending',
    tags: now - at > 6 * DAY ? [pickOne(rng, REVIEW_TAGS.slice(0, 5))] : [], reviewedBy: now - at > 6 * DAY ? 'Minh Châu' : null,
  })).sort((x, y) => y.at - x.at);
  const vers = {};
  for (const e of USAGE.events) {
    const v = promptVersion(e.day);
    const r = vers[v] || (vers[v] = { version: v, from: e.day, to: e.day, calls: 0, billed: 0, invalid: 0, input: 0, output: 0, thinking: 0, fb: 0, helpful: 0, ratingSum: 0 });
    r.to = e.day;
    for (const c of e.calls) {
      r.calls += 1;
      if (c.outcome === 'AI_INVALID_RESPONSE') r.invalid += 1;
      if (c.outcome !== 'API_ERROR') { r.billed += 1; r.input += c.input; r.output += c.output; r.thinking += c.thinking; }
    }
    if (e.fb) { r.fb += 1; r.ratingSum += e.fb.rating; if (e.fb.helpful) r.helpful += 1; }
  }
  s.promptVersions = Object.values(vers).map((r) => ({ ...r, from: addDaysISO(USAGE.today, r.from - last), to: addDaysISO(USAGE.today, r.to - last) })).reverse();

  /* settings: budget starts at ~1.6 × the average day of the last 30 */
  let tok30 = { input: 0, output: 0, thinking: 0 };
  for (const e of USAGE.events) if (last - e.day < 30 && e.day < last) for (const c of e.calls) if (c.outcome !== 'API_ERROR') { tok30.input += c.input; tok30.output += c.output; tok30.thinking += c.thinking; }
  const avgDay = tokenCost(tok30, listedPrice(CURRENT_MODEL, 'now')).total / 29;
  s.settings = {
    aiEnabled: true, pausedAt: null, pausedBy: null, pauseReason: '',
    model: CURRENT_MODEL, thinking: 'medium', historySent: 20, promptVersion: 'v1.4', promptDate: addDaysISO(USAGE.today, -20),
    dailyBudget: Math.ceil(avgDay * 1.6 * 2) / 2, budgetAlertAt: 0.8, budgetAction: 'alert', perFamilyLimit: 12,
    safetyWords: DEFAULT_SAFETY_WORDS.slice(),
    alerts: { errorRate: 3, p95: 5, budget: true, p1: true, email: true, telegram: true, zalo: false },
  };

  /* data requests that arrived by email or from the app */
  const accs = [...s.accounts.values()].filter((a) => a.status === 'active');
  s.dataRequests = [
    { type: 'delete', channel: 'Email hỗ trợ', ago: 51 * HOUR, fam: accs[7] }, { type: 'export', channel: 'Trong ứng dụng', ago: 20 * HOUR, fam: accs[19] },
    { type: 'withdraw', channel: 'Email hỗ trợ', ago: 9 * HOUR, fam: accs[31] }, { type: 'correct', channel: 'Email hỗ trợ', ago: 4 * DAY, fam: accs[44], done: true },
    { type: 'export', channel: 'Trong ứng dụng', ago: 9 * DAY, fam: accs[52], done: true },
  ].map((r, i) => ({ id: `DR-${31 - i}`, type: r.type, channel: r.channel, fam: r.fam.id, receivedAt: now - r.ago, status: r.done ? 'done' : 'open',
    doneAt: r.done ? now - r.ago + 30 * HOUR : null, doneBy: r.done ? 'Lan Anh' : null }));

  /* announcements: the next maintenance goes in the quietest 3 hours */
  const quiet = new Date(now + DAY); quiet.setHours(2, 0, 0, 0);
  s.announcements = [
    { id: 'TB-14', kind: 'maintenance', title: 'Bảo trì hệ thống', body: 'EchoKid bảo trì từ 02:00 đến 04:00. Ba mẹ vẫn xem được nhật ký nhưng chưa ghi mới được trong lúc này.',
      startsAt: quiet.getTime(), endsAt: quiet.getTime() + 2 * HOUR, createdBy: 'Quốc Tú', createdAt: now - 5 * HOUR, endedAt: null },
    { id: 'TB-13', kind: 'incident', title: 'Gợi ý AI chậm hơn bình thường', body: 'Gợi ý có thể mất tới 30 giây. Nhật ký của ba mẹ vẫn được lưu đầy đủ.',
      startsAt: now - 9 * DAY, endsAt: now - 9 * DAY + 3 * HOUR, createdBy: 'Quốc Tú', createdAt: now - 9 * DAY, endedAt: now - 9 * DAY + 2.5 * HOUR },
    { id: 'TB-12', kind: 'info', title: 'Cập nhật chính sách quyền riêng tư', body: 'EchoKid cập nhật cách xử lý nhật ký bằng AI. Ba mẹ xem và đồng ý lại trong mục Tài khoản.',
      startsAt: now - 30 * DAY, endsAt: now - 16 * DAY, createdBy: 'Lan Anh', createdAt: now - 31 * DAY, endedAt: null },
  ];

  /* audit log: what the team did in the last ten days */
  const A = (at, who, action, target, detail, reason) => s.audit.push({ id: `AU-${s.seq++}`, at, actor: who ? who.name : 'Hệ thống', actorId: who ? who.id : 'system', role: who ? who.role : 'system', action, target, detail: detail || '', reason: reason || '' });
  for (const c of cases) for (const l of c.log) {
    if (now - l.at > 10 * DAY) continue;
    const who = team.find((m) => m.name === l.by);
    if (l.type === 'ack') A(l.at, who, 'case.ack', c.id, CASE_KIND[c.kind].label);
    if (l.type === 'contacted') {
      if (c.kind === 'safety') A(l.at - 20 * MIN, who, 'contact.reveal', `${c.id} · ${c.fam}`, 'Email và số điện thoại', REVEAL_REASONS[0]);
      A(l.at, who, 'case.contacted', c.id);
    }
    if (l.type === 'close') A(l.at, who || null, 'case.close', c.id, CLOSE_OUTCOMES[c.outcome]);
  }
  const lan = memberById('m-1'), tu = memberById('m-3');
  A(now - 5 * HOUR, tu, 'announce.create', 'TB-14', 'Bảo trì · 02:00–04:00');
  A(now - 26 * HOUR, lan, 'ai.settings', 'Ngân sách AI', `Ngân sách mỗi ngày ${usd(s.settings.dailyBudget - 0.5)} → ${usd(s.settings.dailyBudget)}`);
  A(now - 3 * DAY, lan, 'team.invite', 'duchuy@echokid.example', 'Vai trò: Kiểm duyệt an toàn');
  A(now - 4 * DAY, lan, 'account.lookup', 'phuhuynh.•••@example.com', '1 kết quả', 'Gia đình gửi email nhờ hỗ trợ');
  A(now - 6 * DAY, lan, 'expert.verify', 'BS. Trần Minh Khang', 'Đủ 3 bước xác minh');
  A(now - 8 * DAY, tu, 'ai.settings', 'Mức suy luận', 'Cao → Vừa');
  s.audit.sort((x, y) => y.at - x.at);
  return s;
}

/* ---------- derived views ---------- */
function caseView(c) {
  const kind = CASE_KIND[c.kind];
  const dueAt = c.firstAt + kind.sla;
  const assignee = c.assignee ? srv.team.find((m) => m.id === c.assignee) : null;
  return {
    id: c.id, fam: c.fam, band: c.band, kind: c.kind, priority: c.priority, status: c.status, firstAt: c.firstAt, lastAt: c.lastAt,
    alertCount: c.alerts.length, reason: kind.hint, booked: c.booked, dueAt, ackAt: c.ackAt, closedAt: c.closedAt, outcome: c.outcome,
    assignee: assignee ? { id: assignee.id, name: assignee.name } : null,
    overdue: c.status === 'new' && Date.now() > dueAt, lateAck: !!c.ackAt && c.ackAt > dueAt,
  };
}
function bookingView(b) {
  const x = srv.experts.find((e) => e.id === b.expertId);
  return { ...b, log: undefined, expert: x ? { id: x.id, name: x.name, location: x.location } : null, waitingOver24h: b.status === 'new' && Date.now() - b.createdAt > 24 * HOUR };
}
function expertView(x) {
  const verified = EXPERT_CHECKS.every(([k]) => x.checks.includes(k)) && !!x.verifiedAt;
  const expired = verified && Date.now() - x.verifiedAt > EXPERT_VERIFY_TTL;
  const recent = srv.bookings.filter((b) => b.expertId === x.id && Date.now() - b.createdAt <= 30 * DAY);
  const waits = recent.map((b) => { const f = b.log.find((l) => l.type === 'forward'), c = b.log.find((l) => l.type === 'confirm'); return f && c ? c.at - f.at : null; }).filter((v) => v != null).sort((p, q) => p - q);
  return { ...x, verified, expired, state: !verified ? 'pending' : expired ? 'expired' : 'verified', requests30: recent.length, confirmMedian: waits.length ? waits[Math.floor(waits.length / 2)] : null };
}
function todaySpend() {
  const last = USAGE_DAYS - 1;
  const tok = { input: 0, output: 0, thinking: 0 };
  for (const e of USAGE.events) if (e.day === last) for (const c of e.calls) if (c.outcome !== 'API_ERROR') { tok.input += c.input; tok.output += c.output; tok.thinking += c.thinking; }
  return tokenCost(tok, listedPrice(srv.settings.model, 'now')).total;
}
function errorStats(windowMs) {
  const since = Date.now() - windowMs;
  const last = USAGE_DAYS - 1;
  let calls = 0;
  for (let i = USAGE.events.length - 1; i >= 0; i--) {
    const e = USAGE.events[i];
    if (last - e.day > Math.ceil(windowMs / DAY) + 1) break;
    if (evAt(e) >= since) calls += e.calls.length;
  }
  const errs = srv.errors.filter((x) => x.at >= since).length;
  return { calls, errors: errs, rate: calls ? errs / calls : 0 };
}
function familyLimitHits(limit) {
  const fams = new Set(); let days = 0, maxPerDay = 0;
  for (const [k, n] of srv.callsByFamDay) { maxPerDay = Math.max(maxPerDay, n); if (n > limit) { days += 1; fams.add(k.split('|')[0]); } }
  return { families: fams.size, familyDays: days, maxPerDay };
}
function revealFor(me, key) {
  return srv.reveals.find((r) => r.memberId === me.id && r.key === key && r.until > Date.now()) || null;
}
function memberView(m) { return { id: m.id, name: m.name, email: m.email, role: m.role, status: m.status, twoStep: m.twoStep, lastActiveAt: m.lastActiveAt, since: m.since }; }

/* ---------- bridge to the parent app (js/shared/bridge.js) ----------
   The sample family's records and the moderator-managed settings are shared; everything else stays sample data. */
const BRIDGED = ['cases', 'bookings', 'reviews', 'dataRequests'];
const mergeById = (theirs, ours) => { const m = new Map(theirs.map((x) => [x.id, x])); for (const x of ours) m.set(x.id, x); return [...m.values()]; };
const unbridge = ({ bridged, ...x }) => x;

function demoAccount(f, prev) {
  const joinedAt = f?.joinedAt || prev?.joinedAt || Date.now() - 45 * DAY;
  return {
    id: DEMO_FAMILY.id, email: DEMO_FAMILY.email, phone: f?.phone || DEMO_FAMILY.phone, joinedAt, kids: f?.kids || ['3–5 tuổi', '2–3 tuổi'],
    entries: f?.entries ?? 0, aiCalls: f?.aiCalls ?? f?.entries ?? 0, aiFailures: f?.aiFailures ?? 0, lastActiveAt: f?.lastActiveAt || null,
    consent: f?.consent || { version: 'v1', at: joinedAt }, status: f?.status || 'active', deleteAt: f?.deleteAt || null, bridged: true,
  };
}
const openBridgedCase = (fam, at) => srv.cases.find((c) => c.bridged && c.fam === fam && c.status !== 'closed' && at >= c.firstAt - DAY);

/* same rule as the sample cases: alerts from one family within 72 hours share a case; a worse alert raises its priority */
function foldAlert(a) {
  const alert = { at: a.at, kind: a.kind, reason: a.reason, booked: false };
  let c = srv.cases.find((x) => x.bridged && x.fam === a.fam && x.status !== 'closed' && a.at - x.lastAt <= 72 * HOUR);
  if (c) {
    c.alerts.push(alert);
    c.lastAt = Math.max(c.lastAt, a.at);
    if (CASE_KIND[a.kind].priority < c.priority) {
      c.kind = a.kind; c.priority = CASE_KIND[a.kind].priority;
      c.log.push({ at: a.at, type: 'escalate', by: 'Hệ thống', text: `Nâng lên P${c.priority}: ${CASE_KIND[a.kind].label}.` });
    }
  } else {
    c = { id: a.id.replace(/^AL-/, 'CA-'), fam: a.fam, band: a.band, kind: a.kind, priority: CASE_KIND[a.kind].priority, booked: false, status: 'new', log: [],
      assignee: null, ackAt: null, closedAt: null, outcome: null, alerts: [alert], firstAt: a.at, lastAt: a.at, bridged: true };
    srv.cases.push(c);
  }
  srv.alertCases.set(a.id, c.id);
  return c;
}

/* pull what the other tab wrote; returns the records that are new to this tab */
function syncBridge() {
  const b = bridge.read();
  const known = Object.fromEntries(BRIDGED.map((k) => [k, new Set(srv[k].filter((x) => x.bridged).map((x) => x.id))]));
  if (b.settings) srv.settings = { ...srv.settings, ...b.settings };
  if (b.announcements) srv.announcements = b.announcements;
  if (b.experts) srv.experts = b.experts;
  if (b.team) srv.team = b.team;
  srv.accounts.set(DEMO_FAMILY.id, demoAccount(b.family, srv.accounts.get(DEMO_FAMILY.id)));
  for (const k of BRIDGED) srv[k] = [...srv[k].filter((x) => !x.bridged), ...b[k].map((x) => ({ ...x, bridged: true }))];
  srv.reviews.sort((x, y) => y.at - x.at);
  const liveIds = new Set(srv.auditLive.map((x) => x.id));
  const incoming = b.audit.filter((x) => !liveIds.has(x.id));
  if (incoming.length) {
    srv.auditLive = [...incoming, ...srv.auditLive].sort((x, y) => y.at - x.at);
    srv.audit = [...incoming, ...srv.audit].sort((x, y) => y.at - x.at);
  }
  let changed = false;
  const raised = [];
  for (const a of b.alerts) {
    if (a.caseId || srv.alertCases.has(a.id)) continue;
    raised.push(foldAlert(a)); changed = true;
  }
  const now = Date.now();
  for (const bk of srv.bookings) if (bk.bridged && !bk.caseId) { const c = openBridgedCase(bk.fam, bk.createdAt); if (c) { bk.caseId = c.id; changed = true; } }
  for (const c of srv.cases) {
    if (!c.bridged || c.status === 'closed' || c.booked) continue;
    if (!srv.bookings.some((bk) => bk.fam === c.fam && bk.createdAt >= c.firstAt - DAY && bk.status !== 'cancelled')) continue;
    c.booked = true; changed = true;
    if (c.kind !== 'safety' && c.status === 'new') {
      Object.assign(c, { status: 'closed', closedAt: now, outcome: 'booked' });
      c.log.push({ at: now, type: 'close', by: 'Hệ thống', text: 'Tự đóng: gia đình đã gửi yêu cầu gặp chuyên gia ngay trong ứng dụng.' });
    }
  }
  if (changed) persistBridge();
  const fresh = Object.fromEntries(BRIDGED.map((k) => [k, srv[k].filter((x) => x.bridged && !known[k].has(x.id))]));
  return { ...fresh, raised };
}

function persistBridge() {
  bridge.update((b) => {
    Object.assign(b, { settings: srv.settings, announcements: srv.announcements, experts: srv.experts, team: srv.team });
    for (const k of BRIDGED) b[k] = mergeById(b[k], srv[k].filter((x) => x.bridged).map(unbridge));
    b.alerts = b.alerts.map((a) => (a.caseId || !srv.alertCases.has(a.id) ? a : { ...a, caseId: srv.alertCases.get(a.id) }));
    const acc = srv.accounts.get(DEMO_FAMILY.id);
    if (acc) b.family = { ...(b.family || {}), status: acc.status, deleteAt: acc.deleteAt };
    b.audit = srv.auditLive.slice(0, 300);
    return b;
  });
  srv.dirty = false;
}

/* ---------- routes ---------- */
const ok = (body) => [200, body];
const fail = (status, error, code) => [status, { error, code }];
function audit(me, action, target, detail, reason) {
  const entry = { id: `AU-L${Date.now().toString(36)}${srv.seq++}`, at: Date.now(), actor: me.name, actorId: me.id, role: me.role, action, target, detail: detail || '', reason: reason || '' };
  srv.audit.unshift(entry);
  srv.auditLive.unshift(entry);
  srv.dirty = true;
}
function paginate(list, q, size = 20) {
  const page = Math.max(1, Number(q.get('page')) || 1);
  return { total: list.length, page, pageSize: size, items: list.slice((page - 1) * size, page * size) };
}

function summary({ me }) {
  const now = Date.now();
  const out = { ai: { enabled: srv.settings.aiEnabled, pausedAt: srv.settings.pausedAt, pausedBy: srv.settings.pausedBy, reason: srv.settings.pauseReason, model: srv.settings.model } };
  if (can(me, 'cases')) {
    const open = srv.cases.filter((c) => c.status !== 'closed');
    const p1New = open.filter((c) => c.priority === 1 && c.status === 'new');
    out.cases = {
      open: open.length, p1Open: open.filter((c) => c.priority === 1).length, p1New: p1New.length,
      oldestP1At: p1New.length ? Math.min(...p1New.map((c) => c.firstAt)) : null,
      overdue: open.filter((c) => c.status === 'new' && now > c.firstAt + CASE_KIND[c.kind].sla).length,
      unassigned: open.filter((c) => c.status === 'new').length, mine: open.filter((c) => c.assignee === me.id).length,
    };
  }
  if (can(me, 'bookings')) {
    const waiting = srv.bookings.filter((b) => b.status === 'new');
    out.bookings = { new: waiting.length, waitingOver24h: waiting.filter((b) => now - b.createdAt > 24 * HOUR).length, forwarded: srv.bookings.filter((b) => b.status === 'forwarded').length };
  }
  if (can(me, 'accounts')) {
    const open = srv.dataRequests.filter((r) => r.status === 'open');
    out.dataRequests = { open: open.length, dueSoon: open.filter((r) => r.receivedAt + DATA_REQ_DUE - now < 24 * HOUR).length };
  }
  if (can(me, 'experts')) { const xs = srv.experts.map(expertView); out.experts = { expiredVisible: xs.filter((x) => x.active && x.state === 'expired').length, pending: xs.filter((x) => x.state === 'pending').length }; }
  if (can(me, 'quality')) out.quality = { pending: srv.reviews.filter((r) => r.status === 'pending').length };
  if (can(me, 'cost') || can(me, 'ai')) Object.assign(out.ai, { spendToday: todaySpend(), budget: srv.settings.dailyBudget, alertAt: srv.settings.budgetAlertAt, action: srv.settings.budgetAction });
  if (can(me, 'system')) out.system = errorStats(HOUR);
  if (can(me, 'audit')) out.recent = srv.audit.slice(0, 6);
  return ok(out);
}

function notifications({ me }) {
  const now = Date.now();
  const items = [];
  const add = (id, tone, icon, title, sub, href, at) => items.push({ id, tone, icon, title, sub, href, at });
  if (can(me, 'cases')) {
    for (const c of srv.cases) if (c.status === 'new' && c.priority === 1) add(`p1-${c.id}`, 'crit', 'alert', `Ca ${c.id}: nguy cơ an toàn chưa có người nhận`, `Gia đình ${c.fam} · hạn phản hồi ${fmtDT(c.firstAt + CASE_KIND.safety.sla)}`, `#/alerts/${c.id}`, c.firstAt);
    const over = srv.cases.filter((c) => c.status === 'new' && now > c.firstAt + CASE_KIND[c.kind].sla);
    if (over.length) add(`over-${over.length}`, 'warn', 'clock', `${over.length} ca đã quá hạn phản hồi đầu tiên`, 'Mở hàng chờ để nhận xử lý', '#/alerts', Math.max(...over.map((c) => c.firstAt + CASE_KIND[c.kind].sla)));
  }
  if (can(me, 'bookings')) {
    const late = srv.bookings.filter((b) => b.status === 'new' && now - b.createdAt > 24 * HOUR);
    if (late.length) add(`bk-${late.length}`, 'warn', 'inbox', `${late.length} yêu cầu chuyên gia chờ hơn 24 giờ`, 'Ba mẹ vẫn nghĩ yêu cầu đã tới chuyên gia', '#/bookings', Math.min(...late.map((b) => b.createdAt)) + 24 * HOUR);
  }
  if (can(me, 'accounts')) for (const r of srv.dataRequests) if (r.status === 'open' && r.receivedAt + DATA_REQ_DUE - now < 24 * HOUR) add(`dr-${r.id}`, 'warn', DATA_REQ[r.type].icon, `Yêu cầu ${r.id} sắp đến hạn`, `${DATA_REQ[r.type].label} · còn ${durationText(r.receivedAt + DATA_REQ_DUE - now)}`, '#/accounts', r.receivedAt);
  if (can(me, 'experts')) for (const x of srv.experts.map(expertView)) if (x.active && x.state === 'expired') add(`ex-${x.id}`, 'warn', 'steth', `${x.name} quá hạn xác minh lại`, 'Vẫn đang hiện nhãn "Đã xác minh" với ba mẹ', '#/experts', x.verifiedAt + EXPERT_VERIFY_TTL);
  if (can(me, 'cost') || can(me, 'ai')) {
    const spend = todaySpend(), b = srv.settings.dailyBudget;
    if (spend >= b * srv.settings.budgetAlertAt) add(`budget-${localISODate()}`, 'warn', 'coin', `Chi phí AI hôm nay đã tới ${pct(spend / b, 0)} ngân sách`, `${usd(spend)} trên ${usd(b)}`, can(me, 'ai') ? '#/ai' : '#/cost', now);
  }
  if (!srv.settings.aiEnabled) add(`paused-${srv.settings.pausedAt}`, 'warn', 'power', 'Gợi ý AI đang tạm dừng', `Từ ${fmtDT(srv.settings.pausedAt)} · ${srv.settings.pausedBy}`, can(me, 'ai') ? '#/ai' : '#/overview', srv.settings.pausedAt);
  return ok({ items: items.sort((x, y) => y.at - x.at) });
}

function metrics({ q }) {
  const last = USAGE_DAYS - 1;
  const range = [7, 30, 90].includes(Number(q.get('range'))) ? Number(q.get('range')) : 30;
  return ok({
    range, generatedAt: new Date().toISOString(), today: USAGE.today, model: srv.settings.model,
    registeredFamilies: srv.accounts.size, totalEntries: USAGE.events.length,
    current: aggregateUsage(USAGE, last - range + 1, last), previous: aggregateUsage(USAGE, last - 2 * range + 1, last - range),
  });
}

function search({ me, q }) {
  const term = fold(q.get('q'));
  if (term.length < 2) return ok({ items: [] });
  const items = [];
  if (can(me, 'cases')) for (const c of srv.cases) if (fold(c.id).includes(term) || fold(c.fam).includes(term)) items.push({ type: 'case', id: c.id, title: `${c.id} · ${CASE_KIND[c.kind].label}`, sub: `Gia đình ${c.fam} · ${CASE_STATUS[c.status].label}`, href: `#/alerts/${c.id}`, tone: CASE_KIND[c.kind].tone });
  if (can(me, 'bookings')) for (const b of srv.bookings) if (fold(b.id).includes(term) || fold(b.fam).includes(term)) items.push({ type: 'booking', id: b.id, title: `${b.id} · Yêu cầu chuyên gia`, sub: `Gia đình ${b.fam} · ${BOOKING_STATUS[b.status].label}`, href: `#/bookings/${b.id}`, tone: BOOKING_STATUS[b.status].tone });
  return ok({ items: items.reverse().slice(0, 8) });
}

/* cases */
function listCases({ me, q }) {
  const view = q.get('view') || 'open';
  const prio = q.get('priority') || 'all';
  const term = fold(q.get('q'));
  let list = srv.cases.slice();
  if (view === 'open') list = list.filter((c) => c.status !== 'closed');
  if (view === 'mine') list = list.filter((c) => c.status !== 'closed' && c.assignee === me.id);
  if (view === 'unassigned') list = list.filter((c) => c.status === 'new');
  if (view === 'closed') list = list.filter((c) => c.status === 'closed');
  if (prio !== 'all') list = list.filter((c) => String(c.priority) === prio);
  if (term) list = list.filter((c) => fold(c.id).includes(term) || fold(c.fam).includes(term));
  /* open work: most urgent first (priority, then the closest deadline); history: newest first */
  const due = (c) => c.firstAt + CASE_KIND[c.kind].sla;
  if (view === 'closed' || view === 'all') list.sort((x, y) => y.lastAt - x.lastAt);
  else list.sort((x, y) => x.priority - y.priority || (y.status === 'new') - (x.status === 'new') || due(x) - due(y));
  const open = srv.cases.filter((c) => c.status !== 'closed');
  const month = srv.cases.filter((c) => Date.now() - c.firstAt <= 30 * DAY);
  const acked = month.filter((c) => c.ackAt).map((c) => ({ wait: c.ackAt - c.firstAt, ok: c.ackAt <= c.firstAt + CASE_KIND[c.kind].sla }));
  const waits = acked.map((x) => x.wait).sort((x, y) => x - y);
  return ok({
    ...paginate(list.map(caseView), q),
    counts: {
      open: open.length, mine: open.filter((c) => c.assignee === me.id).length, unassigned: open.filter((c) => c.status === 'new').length,
      closed: srv.cases.length - open.length, all: srv.cases.length,
      p1: open.filter((c) => c.priority === 1).length, p2: open.filter((c) => c.priority === 2).length, p3: open.filter((c) => c.priority === 3).length,
    },
    stats: {
      alerts30: month.reduce((n, c) => n + c.alerts.length, 0), cases30: month.length,
      autoClosed30: month.filter((c) => c.outcome === 'booked' && !c.assignee).length,
      medianAck: waits.length ? waits[Math.floor(waits.length / 2)] : null, slaMet: acked.length ? acked.filter((x) => x.ok).length / acked.length : null,
    },
  });
}
function findCase(id) { return srv.cases.find((c) => c.id === id); }
function getCase({ me, params }) {
  const c = findCase(params.id);
  if (!c) return fail(404, 'Không tìm thấy ca này.');
  const acc = srv.accounts.get(c.fam);
  const r = revealFor(me, `case:${c.id}`);
  const bookings = srv.bookings.filter((b) => b.fam === c.fam && b.createdAt >= c.firstAt - DAY).map(bookingView);
  return ok({
    ...caseView(c), alerts: c.alerts, log: c.log.slice().sort((x, y) => x.at - y.at),
    contact: { email: maskEmail(acc.email), phone: maskPhone(acc.phone), revealed: r ? { email: acc.email, phone: acc.phone, until: r.until } : null },
    family: { kids: acc.kids, entries: acc.entries, joinedAt: acc.joinedAt, status: acc.status },
    bookings, team: srv.team.filter((m) => m.status === 'active' && can(m, 'cases')).map(memberView),
  });
}
function updateCase({ me, params, body }) {
  const c = findCase(params.id);
  if (!c) return fail(404, 'Không tìm thấy ca này.');
  const now = Date.now();
  const log = (type, text) => c.log.push({ at: now, type, by: me.name, text: text || '' });
  if (body.action === 'ack') {
    if (c.status !== 'new') return fail(409, 'Ca này đã có người nhận.');
    c.status = 'ack'; c.assignee = me.id; c.ackAt = now; log('ack'); audit(me, 'case.ack', c.id, CASE_KIND[c.kind].label);
  } else if (body.action === 'assign') {
    const m = srv.team.find((x) => x.id === body.memberId && x.status === 'active' && can(x, 'cases'));
    if (!m) return fail(400, 'Người này không xử lý được ca cảnh báo.');
    c.assignee = m.id;
    if (c.status === 'new') { c.status = 'ack'; c.ackAt = now; }
    log('assign', `Giao cho ${m.name}`); audit(me, 'case.assign', c.id, `Giao cho ${m.name}`);
  } else if (body.action === 'contacted') {
    if (c.status === 'closed') return fail(409, 'Ca đã đóng.');
    if (!c.ackAt) { c.ackAt = now; c.assignee = me.id; }
    c.status = 'contacted'; log('contacted', (body.note || '').trim()); audit(me, 'case.contacted', c.id);
  } else if (body.action === 'note') {
    const text = (body.note || '').trim();
    if (text.length < 3) return fail(400, 'Ghi chú quá ngắn.');
    log('note', text); audit(me, 'case.note', c.id);
  } else if (body.action === 'close') {
    if (!CLOSE_OUTCOMES[body.outcome]) return fail(400, 'Chọn kết quả trước khi đóng ca.');
    if (!c.ackAt) { c.ackAt = now; c.assignee = me.id; }
    c.status = 'closed'; c.closedAt = now; c.outcome = body.outcome;
    log('close', [CLOSE_OUTCOMES[body.outcome], (body.note || '').trim()].filter(Boolean).join('. ')); audit(me, 'case.close', c.id, CLOSE_OUTCOMES[body.outcome]);
  } else if (body.action === 'reopen') {
    if (c.status !== 'closed') return fail(409, 'Ca đang mở.');
    c.status = 'ack'; c.closedAt = null; c.outcome = null; c.assignee = me.id; log('reopen', (body.note || '').trim()); audit(me, 'case.reopen', c.id);
  } else return fail(400, 'Thao tác không hợp lệ.');
  return ok(caseView(c));
}
function reveal(me, key, target, fam, body) {
  const reason = (body.reason || '').trim(), detail = (body.detail || '').trim();
  if (!REVEAL_REASONS.includes(reason)) return fail(400, 'Chọn lý do cần xem liên hệ.');
  if (detail.length < 10) return fail(400, 'Ghi rõ hơn lý do (ít nhất 10 ký tự).');
  const acc = srv.accounts.get(fam);
  const until = Date.now() + REVEAL_TTL;
  srv.reveals.push({ memberId: me.id, key, until });
  audit(me, 'contact.reveal', target, 'Email và số điện thoại', `${reason}: ${detail}`);
  return ok({ email: acc.email, phone: acc.phone, until });
}
function revealCase({ me, params, body }) {
  const c = findCase(params.id);
  if (!c) return fail(404, 'Không tìm thấy ca này.');
  const r = reveal(me, `case:${c.id}`, `${c.id} · ${c.fam}`, c.fam, body);
  if (r[0] === 200) c.log.push({ at: Date.now(), type: 'reveal', by: me.name, text: body.reason });
  return r;
}

/* bookings */
function listBookings({ q }) {
  const status = q.get('status') || 'new';
  const term = fold(q.get('q'));
  let list = srv.bookings.slice();
  if (status !== 'all') list = list.filter((b) => b.status === status);
  if (term) list = list.filter((b) => fold(b.id).includes(term) || fold(b.fam).includes(term));
  list.sort(status === 'new' || status === 'forwarded' ? (x, y) => x.createdAt - y.createdAt : (x, y) => y.createdAt - x.createdAt);
  const counts = { all: srv.bookings.length };
  for (const k of Object.keys(BOOKING_STATUS)) counts[k] = srv.bookings.filter((b) => b.status === k).length;
  const month = srv.bookings.filter((b) => Date.now() - b.createdAt <= 30 * DAY);
  const fwd = month.map((b) => { const f = b.log.find((l) => l.type === 'forward'); return f ? f.at - b.createdAt : null; }).filter((v) => v != null).sort((x, y) => x - y);
  return ok({ ...paginate(list.map(bookingView), q), counts, stats: { month: month.length, fromCases: month.filter((b) => b.caseId).length, medianForward: fwd.length ? fwd[Math.floor(fwd.length / 2)] : null, overdue: srv.bookings.filter((b) => b.status === 'new' && Date.now() - b.createdAt > 24 * HOUR).length } });
}
function getBooking({ me, params }) {
  const b = srv.bookings.find((x) => x.id === params.id);
  if (!b) return fail(404, 'Không tìm thấy yêu cầu này.');
  const acc = srv.accounts.get(b.fam);
  const r = revealFor(me, `booking:${b.id}`);
  return ok({ ...bookingView(b), log: b.log.slice().sort((x, y) => x.at - y.at),
    contact: { phone: maskPhone(acc.phone), email: maskEmail(acc.email), revealed: r ? { email: acc.email, phone: acc.phone, until: r.until } : null },
    expertEmail: srv.experts.find((x) => x.id === b.expertId)?.email || '' });
}
function updateBooking({ me, params, body }) {
  const b = srv.bookings.find((x) => x.id === params.id);
  if (!b) return fail(404, 'Không tìm thấy yêu cầu này.');
  const now = Date.now();
  const log = (type, text) => b.log.push({ at: now, type, by: me.name, text: text || '' });
  if (body.action === 'forward') {
    if (b.status !== 'new') return fail(409, 'Yêu cầu đã được chuyển.');
    b.status = 'forwarded'; log('forward'); audit(me, 'booking.forward', b.id, srv.experts.find((x) => x.id === b.expertId).name);
  } else if (body.action === 'confirm') {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(body.at || '')) return fail(400, 'Nhập ngày giờ chuyên gia đã hẹn.');
    b.status = 'confirmed'; b.confirmedFor = body.at;
    const [d, t] = body.at.split('T');
    log('confirm', `Hẹn ${t} ${fmtFullDate(d)}`); audit(me, 'booking.confirm', b.id, `${t} ${fmtFullDate(d)}`);
  } else if (body.action === 'done') {
    b.status = 'done'; log('done'); audit(me, 'booking.done', b.id);
  } else if (body.action === 'cancel') {
    const reason = (body.reason || '').trim();
    if (reason.length < 3) return fail(400, 'Ghi lý do hủy để báo lại cho ba mẹ.');
    b.status = 'cancelled'; b.cancelReason = reason; log('cancel', reason); audit(me, 'booking.cancel', b.id, reason);
  } else return fail(400, 'Thao tác không hợp lệ.');
  return ok(bookingView(b));
}
function revealBooking({ me, params, body }) {
  const b = srv.bookings.find((x) => x.id === params.id);
  if (!b) return fail(404, 'Không tìm thấy yêu cầu này.');
  return reveal(me, `booking:${b.id}`, `${b.id} · ${b.fam}`, b.fam, body);
}

/* experts */
function listExperts() { return ok({ items: srv.experts.map(expertView) }); }
function saveExpert(me, x, body, isNew) {
  const fields = ['name', 'specialty', 'hospital', 'location', 'experience', 'description', 'email', 'license', 'issuer'];
  for (const f of fields) if (typeof body[f] === 'string') x[f] = body[f].trim();
  if (!x.name || !x.specialty || !x.hospital) return fail(400, 'Cần tên, chuyên môn và nơi làm việc.');
  if (x.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x.email)) return fail(400, 'Email chuyên gia chưa đúng.');
  const before = EXPERT_CHECKS.every(([k]) => x.checks.includes(k));
  if (Array.isArray(body.checks)) x.checks = body.checks.filter((k) => EXPERT_CHECKS.some(([c]) => c === k));
  const complete = EXPERT_CHECKS.every(([k]) => x.checks.includes(k));
  if (complete && !x.license) return fail(400, 'Nhập số chứng chỉ hành nghề trước khi xác minh.');
  if (complete && (body.reverify || !before)) { x.verifiedAt = Date.now(); x.verifiedBy = me.name; audit(me, 'expert.verify', x.name, 'Đủ 3 bước xác minh'); }
  if (!complete) { x.verifiedAt = null; x.verifiedBy = ''; }
  if (typeof body.active === 'boolean' && body.active !== x.active) {
    if (body.active && (!complete || Date.now() - x.verifiedAt > EXPERT_VERIFY_TTL)) return fail(409, 'Chỉ hiện với ba mẹ khi chuyên gia đã xác minh trong 12 tháng qua.');
    x.active = body.active; audit(me, body.active ? 'expert.show' : 'expert.hide', x.name);
  }
  if (!complete && x.active) { x.active = false; audit(me, 'expert.hide', x.name, 'Chưa đủ bước xác minh'); }
  if (isNew) { srv.experts.push(x); audit(me, 'expert.create', x.name); } else if (!body.onlyActive) audit(me, 'expert.update', x.name);
  return ok(expertView(x));
}
function createExpert({ me, body }) {
  return saveExpert(me, { id: Math.max(...srv.experts.map((x) => x.id)) + 1, checks: [], active: false, verifiedAt: null, verifiedBy: '', createdAt: Date.now() }, body, true);
}
function updateExpert({ me, params, body }) {
  const x = srv.experts.find((e) => String(e.id) === params.id);
  if (!x) return fail(404, 'Không tìm thấy chuyên gia.');
  const draft = { ...x, checks: x.checks.slice() };
  const r = saveExpert(me, draft, body, false);
  if (r[0] === 200) Object.assign(x, draft);
  return r;
}

/* accounts and data requests */
function accountView(a) {
  const reqs = srv.dataRequests.filter((r) => r.fam === a.id);
  return { id: a.id, email: maskEmail(a.email), kids: a.kids, joinedAt: a.joinedAt, lastActiveAt: a.lastActiveAt, entries: a.entries, aiCalls: a.aiCalls, aiFailures: a.aiFailures,
    consent: a.consent, status: a.status, deleteAt: a.deleteAt, requests: reqs, openCases: srv.cases.filter((c) => c.fam === a.id && c.status !== 'closed').length };
}
function searchAccounts({ me, q }) {
  const term = fold(q.get('q'));
  const reason = (q.get('reason') || '').trim();
  if (term.length < 4) return fail(400, 'Nhập ít nhất 4 ký tự của email hoặc mã gia đình.');
  const hits = [...srv.accounts.values()].filter((a) => fold(a.email) === term || fold(a.id) === term || fold(a.id).replace(/[^a-z0-9]/g, '') === term.replace(/[^a-z0-9]/g, '')).slice(0, 5);
  audit(me, 'account.lookup', hits.length === 1 ? hits[0].id : term.includes('@') ? maskEmail(term) : term.toUpperCase(), `${hits.length} kết quả`, reason);
  return ok({ items: hits.map(accountView) });
}
function accountAction({ me, params, body }) {
  const a = srv.accounts.get(params.id);
  if (!a) return fail(404, 'Không tìm thấy tài khoản.');
  const now = Date.now();
  const closeRequest = (type) => { for (const r of srv.dataRequests) if (r.fam === a.id && r.type === type && r.status === 'open') { r.status = 'done'; r.doneAt = now; r.doneBy = me.name; audit(me, 'request.done', r.id, DATA_REQ[type].label); } };
  const act = params.action;
  if (act === 'export') {
    audit(me, 'account.export', a.id, 'Gửi link tải tới email của ba mẹ, hết hạn sau 7 ngày'); closeRequest('export');
    return ok({ ...accountView(a), message: `Đã gửi link tải dữ liệu tới ${maskEmail(a.email)}.` });
  }
  if (act === 'suspend') {
    if ((body.reason || '').trim().length < 5) return fail(400, 'Ghi lý do tạm khóa.');
    a.status = 'suspended'; audit(me, 'account.suspend', a.id, '', body.reason.trim());
    return ok({ ...accountView(a), message: 'Đã tạm khóa. Ba mẹ sẽ thấy hướng dẫn liên hệ hỗ trợ khi đăng nhập.' });
  }
  if (act === 'unsuspend') { a.status = 'active'; audit(me, 'account.unsuspend', a.id); return ok({ ...accountView(a), message: 'Đã mở khóa tài khoản.' }); }
  if (act === 'delete') {
    if (fold(body.confirm) !== fold(a.id)) return fail(400, 'Mã gia đình nhập lại chưa khớp.');
    a.status = 'pending_deletion'; a.deleteAt = now + DAY; audit(me, 'account.delete', a.id, `Xóa lúc ${fmtDT(a.deleteAt)}`, (body.reason || '').trim()); closeRequest('delete');
    return ok({ ...accountView(a), message: `Đã lên lịch xóa lúc ${fmtDT(a.deleteAt)}. Có thể hủy trước thời điểm này.` });
  }
  if (act === 'cancel-delete') { a.status = 'active'; a.deleteAt = null; audit(me, 'account.delete_cancel', a.id); return ok({ ...accountView(a), message: 'Đã hủy lịch xóa.' }); }
  if (act === 'withdraw-ai' || act === 'correct') {
    closeRequest(act === 'withdraw-ai' ? 'withdraw' : 'correct');
    return ok({ ...accountView(a), message: 'Đã đánh dấu yêu cầu hoàn tất.' });
  }
  return fail(400, 'Thao tác không hợp lệ.');
}
function listDataRequests() {
  /* open requests first, oldest (closest to the deadline) on top; finished ones newest first */
  const items = srv.dataRequests.slice().sort((x, y) => (y.status === 'open') - (x.status === 'open') || (x.status === 'open' ? x.receivedAt - y.receivedAt : y.receivedAt - x.receivedAt));
  return ok({ items: items.map((r) => ({ ...r, dueAt: r.receivedAt + DATA_REQ_DUE })) });
}

/* settings */
function getSettings() {
  const s = srv.settings;
  return ok({ ...s, spendToday: todaySpend(), limitHits: familyLimitHits(s.perFamilyLimit), testRoute: srv.testRoute });
}
function patchAi({ me, body }) {
  const s = srv.settings;
  const changes = [];
  const set = (k, v, label, show = (x) => x) => { if (v !== undefined && JSON.stringify(v) !== JSON.stringify(s[k])) { changes.push(`${label}: ${show(s[k])} → ${show(v)}`); s[k] = v; } };
  if (body.model !== undefined && !GEMINI_MODELS.some((m) => m.id === body.model)) return fail(400, 'Mô hình không hợp lệ.');
  if (body.dailyBudget !== undefined && !(body.dailyBudget > 0)) return fail(400, 'Ngân sách mỗi ngày phải lớn hơn 0.');
  if (body.perFamilyLimit !== undefined && !(Number.isInteger(body.perFamilyLimit) && body.perFamilyLimit >= 1)) return fail(400, 'Giới hạn mỗi gia đình phải là số nguyên từ 1.');
  if (body.safetyWords !== undefined && (!Array.isArray(body.safetyWords) || !body.safetyWords.length)) return fail(400, 'Danh sách từ khóa an toàn không được để trống.');
  set('model', body.model, 'Mô hình', (v) => modelById(v).label);
  set('thinking', body.thinking, 'Mức suy luận', (v) => THINKING_LEVELS.find((t) => t.value === v)?.label);
  set('historySent', body.historySent, 'Số lần ghi cũ gửi kèm');
  set('dailyBudget', body.dailyBudget, 'Ngân sách mỗi ngày', (v) => usd(v));
  set('budgetAlertAt', body.budgetAlertAt, 'Báo khi tới', (v) => pct(v, 0));
  set('budgetAction', body.budgetAction, 'Khi hết ngân sách', (v) => (v === 'pause' ? 'tạm dừng AI' : 'chỉ báo động'));
  set('perFamilyLimit', body.perFamilyLimit, 'Giới hạn mỗi gia đình mỗi ngày');
  if (body.safetyWords !== undefined) {
    const added = body.safetyWords.filter((w) => !s.safetyWords.includes(w)), removed = s.safetyWords.filter((w) => !body.safetyWords.includes(w));
    if (added.length || removed.length) changes.push(`Từ khóa an toàn: ${[added.length && `thêm "${added.join('", "')}"`, removed.length && `bỏ "${removed.join('", "')}"`].filter(Boolean).join('; ')}`);
    s.safetyWords = body.safetyWords.slice();
  }
  if (!changes.length) return fail(400, 'Không có thay đổi nào.');
  audit(me, 'ai.settings', 'Cài đặt AI', changes.join(' · '), (body.reason || '').trim());
  return getSettings();
}
function pauseAi({ me, body }) {
  const reason = (body.reason || '').trim();
  if (reason.length < 5) return fail(400, 'Ghi lý do tạm dừng để cả nhóm cùng biết.');
  Object.assign(srv.settings, { aiEnabled: false, pausedAt: Date.now(), pausedBy: me.name, pauseReason: reason });
  audit(me, 'ai.pause', 'Gợi ý AI', '', reason);
  return getSettings();
}
function resumeAi({ me }) {
  const since = srv.settings.pausedAt;
  Object.assign(srv.settings, { aiEnabled: true, pausedAt: null, pausedBy: null, pauseReason: '' });
  audit(me, 'ai.resume', 'Gợi ý AI', since ? `Đã tạm dừng ${durationText(Date.now() - since)}` : '');
  return getSettings();
}
function patchAlerts({ me, body }) {
  const a = srv.settings.alerts;
  const next = { ...a, ...body };
  if (!(next.errorRate > 0 && next.errorRate <= 50) || !(next.p95 > 0 && next.p95 <= 60)) return fail(400, 'Ngưỡng chưa hợp lệ.');
  if (!next.email && !next.telegram && !next.zalo) return fail(400, 'Cần ít nhất một kênh nhận báo động.');
  const diff = Object.keys(next).filter((k) => next[k] !== a[k]);
  if (!diff.length) return fail(400, 'Không có thay đổi nào.');
  srv.settings.alerts = next;
  audit(me, 'alerts.settings', 'Ngưỡng báo động', diff.join(', '));
  return getSettings();
}
function testAlert({ me }) { audit(me, 'alerts.test', 'Kênh báo động', 'Gửi thử tới các kênh đang bật'); return ok({ message: 'Đã gửi thử tới các kênh đang bật.' }); }

/* quality */
function getQuality({ q }) {
  const status = q.get('status') || 'pending';
  const list = srv.reviews.filter((r) => status === 'all' || r.status === status);
  return ok({ ...paginate(list, q, 8), counts: { pending: srv.reviews.filter((r) => r.status === 'pending').length, done: srv.reviews.filter((r) => r.status === 'done').length }, versions: srv.promptVersions, current: srv.settings.promptVersion });
}
function reviewDone({ me, params, body }) {
  const r = srv.reviews.find((x) => x.id === params.id);
  if (!r) return fail(404, 'Không tìm thấy phản hồi.');
  const tags = (body.tags || []).filter((t) => REVIEW_TAGS.includes(t));
  if (!tags.length) return fail(400, 'Chọn ít nhất một nhãn để nhóm biết cần sửa lời nhắc ở đâu.');
  Object.assign(r, { status: 'done', tags, reviewedBy: me.name });
  audit(me, 'review.done', r.id, `${r.title} · ${tags.join(', ')}`);
  return ok(r);
}

/* system */
function listErrors({ q }) {
  const code = q.get('code') || 'all';
  const term = fold(q.get('q'));
  let list = srv.errors;
  if (code !== 'all') list = list.filter((x) => x.code === code);
  if (term) list = list.filter((x) => fold(x.id).includes(term) || fold(x.fam).includes(term));
  const hourly = Array.from({ length: 24 }, (_, i) => { const end = Date.now() - (23 - i) * HOUR; return { end, count: srv.errors.filter((x) => x.at > end - HOUR && x.at <= end).length }; });
  return ok({ ...paginate(list, q, 12), hour: errorStats(HOUR), day: errorStats(DAY), hourly, settings: srv.settings.alerts, testRoute: srv.testRoute });
}

/* announcements */
function annView(a) {
  const now = Date.now();
  const state = a.endedAt || a.endsAt <= now ? 'ended' : a.startsAt > now ? 'scheduled' : 'live';
  return { ...a, state };
}
function listAnnouncements() { return ok({ items: srv.announcements.map(annView).sort((x, y) => ({ live: 0, scheduled: 1, ended: 2 }[x.state] - { live: 0, scheduled: 1, ended: 2 }[y.state]) || y.startsAt - x.startsAt) }); }
function createAnnouncement({ me, body }) {
  const title = (body.title || '').trim(), text = (body.body || '').trim();
  if (!ANNOUNCE_KIND[body.kind]) return fail(400, 'Chọn loại thông báo.');
  if (title.length < 3 || text.length < 10) return fail(400, 'Cần tiêu đề và nội dung (ít nhất 10 ký tự).');
  if (text.length > 180) return fail(400, 'Nội dung tối đa 180 ký tự để vừa màn hình điện thoại.');
  if (!(body.startsAt < body.endsAt)) return fail(400, 'Thời gian kết thúc phải sau thời gian bắt đầu.');
  const a = { id: `TB-${15 + srv.announcements.length - 3}`, kind: body.kind, title, body: text, startsAt: body.startsAt, endsAt: body.endsAt, createdBy: me.name, createdAt: Date.now(), endedAt: null };
  srv.announcements.push(a);
  audit(me, 'announce.create', a.id, `${ANNOUNCE_KIND[a.kind].label} · ${title}`);
  return ok(annView(a));
}
function endAnnouncement({ me, params }) {
  const a = srv.announcements.find((x) => x.id === params.id);
  if (!a) return fail(404, 'Không tìm thấy thông báo.');
  a.endedAt = Date.now(); audit(me, 'announce.end', a.id, a.title);
  return ok(annView(a));
}

/* team */
function listTeam() { return ok({ items: srv.team.map(memberView) }); }
function invite({ me, body }) {
  const email = (body.email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail(400, 'Email chưa đúng.');
  if (!ROLES[body.role]) return fail(400, 'Chọn vai trò.');
  if (srv.team.some((m) => m.email === email && m.status !== 'revoked')) return fail(409, 'Email này đã ở trong nhóm.');
  const name = email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
  const m = { id: `m-${srv.seq++}`, name, email, role: body.role, status: 'invited', twoStep: false, lastActiveAt: null, since: null };
  srv.team.push(m); audit(me, 'team.invite', email, `Vai trò: ${ROLES[m.role].label}`);
  return ok(memberView(m));
}
function updateMember({ me, params, body }) {
  const m = srv.team.find((x) => x.id === params.id);
  if (!m) return fail(404, 'Không tìm thấy thành viên.');
  if (m.id === me.id) return fail(409, 'Không tự đổi vai trò của chính mình. Nhờ một quản trị viên khác.');
  if (!ROLES[body.role]) return fail(400, 'Vai trò không hợp lệ.');
  const admins = srv.team.filter((x) => x.role === 'admin' && x.status === 'active');
  if (m.role === 'admin' && body.role !== 'admin' && admins.length <= 1) return fail(409, 'Nhóm cần ít nhất một quản trị viên.');
  audit(me, 'team.role', m.email, `${ROLES[m.role].label} → ${ROLES[body.role].label}`);
  m.role = body.role;
  return ok(memberView(m));
}
function revokeMember({ me, params }) {
  const m = srv.team.find((x) => x.id === params.id);
  if (!m) return fail(404, 'Không tìm thấy thành viên.');
  if (m.id === me.id) return fail(409, 'Không tự thu hồi quyền của chính mình.');
  if (m.role === 'admin' && srv.team.filter((x) => x.role === 'admin' && x.status === 'active').length <= 1) return fail(409, 'Nhóm cần ít nhất một quản trị viên.');
  audit(me, 'team.revoke', m.email, m.status === 'invited' ? 'Hủy lời mời' : 'Đăng xuất khỏi mọi thiết bị');
  srv.team = srv.team.filter((x) => x.id !== m.id);
  for (const c of srv.cases) if (c.assignee === m.id && c.status !== 'closed') { c.assignee = null; c.status = 'new'; c.ackAt = null; c.log.push({ at: Date.now(), type: 'assign', by: me.name, text: `Trả lại hàng chờ vì ${m.name} không còn trong nhóm` }); }
  return ok({ id: m.id });
}

/* audit */
function listAudit({ q }) {
  const actor = q.get('actor') || 'all', group = q.get('group') || 'all';
  const term = fold(q.get('q'));
  let list = srv.audit;
  if (actor !== 'all') list = list.filter((x) => x.actorId === actor);
  if (group !== 'all') list = list.filter((x) => (AUDIT_ACTIONS[x.action] || [])[1] === group);
  if (term) list = list.filter((x) => fold(`${x.target} ${x.detail} ${x.reason}`).includes(term));
  const actors = [...new Map(srv.audit.map((x) => [x.actorId, { id: x.actorId, name: x.actor }])).values()];
  return ok({ ...paginate(list, q, 15), actors, all: q.get('export') ? list : undefined });
}

const CONSOLE_ROUTES = [
  ['GET', '/api/admin/session', null, ({ me }) => ok({ member: memberView(me), perms: ROLES[me.role].perms })],
  ['GET', '/api/admin/summary', null, summary],
  ['GET', '/api/admin/notifications', null, notifications],
  ['GET', '/api/admin/search', null, search],
  ['GET', '/api/admin/metrics', 'metrics', metrics],
  ['GET', '/api/admin/cases', 'cases', listCases],
  ['GET', '/api/admin/cases/:id', 'cases', getCase],
  ['PATCH', '/api/admin/cases/:id', 'cases', updateCase],
  ['POST', '/api/admin/cases/:id/reveal', 'reveal', revealCase],
  ['GET', '/api/admin/bookings', 'bookings', listBookings],
  ['GET', '/api/admin/bookings/:id', 'bookings', getBooking],
  ['PATCH', '/api/admin/bookings/:id', 'bookings', updateBooking],
  ['POST', '/api/admin/bookings/:id/reveal', 'reveal', revealBooking],
  ['GET', '/api/admin/experts', 'experts', listExperts],
  ['POST', '/api/admin/experts', 'experts', createExpert],
  ['PATCH', '/api/admin/experts/:id', 'experts', updateExpert],
  ['GET', '/api/admin/accounts', 'accounts', searchAccounts],
  ['POST', '/api/admin/accounts/:id/:action', 'accounts', accountAction],
  ['GET', '/api/admin/data-requests', 'accounts', listDataRequests],
  ['GET', '/api/admin/settings', ['ai', 'system'], getSettings],
  ['PATCH', '/api/admin/settings/ai', 'ai', patchAi],
  ['POST', '/api/admin/ai/pause', 'ai', pauseAi],
  ['POST', '/api/admin/ai/resume', 'ai', resumeAi],
  ['PATCH', '/api/admin/settings/alerts', 'system', patchAlerts],
  ['POST', '/api/admin/settings/alerts/test', 'system', testAlert],
  ['GET', '/api/admin/quality', 'quality', getQuality],
  ['PATCH', '/api/admin/quality/:id', 'review', reviewDone],
  ['GET', '/api/admin/errors', 'system', listErrors],
  ['GET', '/api/admin/announcements', 'announce', listAnnouncements],
  ['POST', '/api/admin/announcements', 'announce', createAnnouncement],
  ['POST', '/api/admin/announcements/:id/end', 'announce', endAnnouncement],
  ['GET', '/api/admin/team', 'team', listTeam],
  ['POST', '/api/admin/team', 'team', invite],
  ['PATCH', '/api/admin/team/:id', 'team', updateMember],
  ['DELETE', '/api/admin/team/:id', 'team', revokeMember],
  ['GET', '/api/admin/audit', 'audit', listAudit],
];

function matchRoute(pattern, path) {
  const a = pattern.split('/'), b = path.split('/');
  if (a.length !== b.length) return null;
  const params = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

/* fetch()-shaped entry point; GET /api/admin/* would sit behind NextAuth + a moderator allowlist in the real app */
async function consoleFetch(url, init = {}) {
  const u = new URL(url, 'https://echokid.local');
  const method = (init.method || 'GET').toUpperCase();
  await new Promise((r) => setTimeout(r, method === 'GET' ? 140 + Math.random() * 160 : 320 + Math.random() * 200));
  const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => JSON.parse(JSON.stringify(body)) });
  if (!srv) { srv = buildServer(); syncBridge(); }
  if (mockAuth.expired) return reply(401, { error: 'Phiên đăng nhập đã hết hạn.', code: 'SESSION_EXPIRED' });
  const me = mockAuth.outsider ? null : srv.team.find((m) => m.id === mockAuth.memberId && m.status === 'active');
  if (!me) return reply(403, { error: 'Tài khoản này không có trong danh sách điều hành.', code: 'NOT_A_MODERATOR' });
  me.lastActiveAt = Date.now();
  for (const [m, pattern, perm, handler] of CONSOLE_ROUTES) {
    if (m !== method) continue;
    const params = matchRoute(pattern, u.pathname);
    if (!params) continue;
    const perms = perm == null ? [] : [].concat(perm);
    if (perms.length && !perms.some((p) => can(me, p))) return reply(403, { error: 'Vai trò của bạn không có quyền này.', code: 'FORBIDDEN' });
    try {
      const [status, body] = handler({ me, q: u.searchParams, params, body: init.body ? JSON.parse(init.body) : {} });
      if (status < 300 && (method !== 'GET' || srv.dirty)) persistBridge();
      return reply(status, body);
    } catch (e) {
      console.error(e);
      return reply(500, { error: 'Lỗi máy chủ, vui lòng thử lại.', code: 'INTERNAL' });
    }
  }
  return reply(404, { error: 'Not found' });
}

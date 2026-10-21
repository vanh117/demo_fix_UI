/* Shared state between the parent app and the moderator console (prototype only).
   It stands in for the Firestore documents both sides would read in production: the settings, announcements and
   expert list that moderators manage, and the records the sample family creates (bookings, safety alerts, low
   ratings, data requests). Kept in localStorage, so a parent tab and a console tab stay in sync through the
   `storage` event. If storage is blocked, each page keeps its own copy in memory. */
'use strict';

const BRIDGE_KEY = 'echokid.bridge.v1';

/* the parent app's sample family (js/mock/db.js) as the console sees it: a pseudonymous code, never a name */
const DEMO_FAMILY = { id: 'GĐ-7A3C', email: 'thuha.demo@example.com', phone: '0912345678' };
const CONSENT_VERSION = 'v2';
const DEFAULT_SAFETY_WORDS = ['tự đánh', 'đập đầu', 'cắn tay', 'tự cắn', 'tự làm đau', 'cào mặt', 'bỏ chạy ra đường', 'co giật', 'ngừng thở', 'nuốt phải'];
const PARENT_PAUSE_TEXT = 'Gợi ý AI đang tạm nghỉ. Nhật ký của ba mẹ vẫn được lưu đầy đủ, gợi ý sẽ có khi hệ thống chạy lại.';
const EXPERT_CHECK_KEYS = ['license', 'workplace', 'agreement'];
const EXPERT_VERIFY_DAYS = 365;

/* the first three match the parent app's original sample list; all names are made up */
const EXPERT_SEED = [
  { id: 1, name: 'BS. Trần Minh Khang', specialty: 'Nhi khoa & Tâm bệnh học', hospital: 'Phòng khám Nhi An Tâm', location: 'Hà Nội', experience: '18 năm',
    description: 'Đánh giá và đồng hành cùng trẻ có khó khăn về phát triển, hành vi và cảm xúc.', email: 'khang.tran@example.com',
    license: '004512/HNO-CCHN', issuer: 'Sở Y tế Hà Nội', verifiedDaysAgo: 49, verifiedBy: 'Lan Anh', checks: ['license', 'workplace', 'agreement'], active: true },
  { id: 2, name: 'ThS. Lê Thu Hằng', specialty: 'Can thiệp sớm & Ngôn ngữ trị liệu', hospital: 'Trung tâm Can thiệp sớm Mầm Xanh', location: 'TP. Hồ Chí Minh', experience: '12 năm',
    description: 'Xây dựng kế hoạch can thiệp tại nhà và hướng dẫn ba mẹ luyện giao tiếp cùng con.', email: 'hang.le@example.com',
    license: '018833/HCM-CCHN', issuer: 'Sở Y tế TP. Hồ Chí Minh', verifiedDaysAgo: 131, verifiedBy: 'Lan Anh', checks: ['license', 'workplace', 'agreement'], active: true },
  { id: 3, name: 'BS. Phạm Quốc Việt', specialty: 'Sức khỏe tâm thần trẻ em', hospital: 'Phòng khám Tâm lý Nhi Hướng Dương', location: 'Đà Nẵng', experience: '15 năm',
    description: 'Khám và tư vấn các vấn đề lo âu, giấc ngủ và hành vi ở trẻ nhỏ.', email: 'viet.pham@example.com',
    license: '002271/ĐNA-CCHN', issuer: 'Sở Y tế Đà Nẵng', verifiedDaysAgo: 388, verifiedBy: 'Lan Anh', checks: ['license', 'workplace', 'agreement'], active: true },
  { id: 4, name: 'ThS. Nguyễn Thảo Vy', specialty: 'Tâm lý học lâm sàng trẻ em', hospital: 'Trung tâm Tâm lý Ánh Dương', location: 'Cần Thơ', experience: '8 năm',
    description: 'Đánh giá tâm lý, tư vấn cho ba mẹ về cảm xúc và hành vi của trẻ.', email: 'vy.nguyen@example.com',
    license: '', issuer: '', verifiedDaysAgo: null, verifiedBy: '', checks: ['agreement'], active: false },
];
function seedExperts(now = Date.now()) {
  return EXPERT_SEED.map(({ verifiedDaysAgo, ...x }) => ({ ...x, checks: x.checks.slice(), verifiedAt: verifiedDaysAgo == null ? null : now - verifiedDaysAgo * DAY }));
}
/* verified = all three checks done within the last 12 months; parents only see active experts */
const expertVerified = (x, now = Date.now()) => EXPERT_CHECK_KEYS.every((k) => x.checks.includes(k)) && !!x.verifiedAt && now - x.verifiedAt <= EXPERT_VERIFY_DAYS * DAY;

/* the console's age bands, from a child's age in months */
function ageBand(months) {
  const y = months / 12;
  return y < 2 ? 'dưới 2 tuổi' : y < 3 ? '2–3 tuổi' : y < 6 ? '3–5 tuổi' : y < 10 ? '6–9 tuổi' : '10–14 tuổi';
}

/* deterministic safety backstop: runs before Gemini, even when AI is paused; ignores Vietnamese tone marks */
function safetyMatches(text, words) {
  const t = fold(text);
  return t ? words.filter((w) => t.includes(fold(w))) : [];
}

/* the announcement parents should see right now; incidents first */
function liveAnnouncement(list, now = Date.now()) {
  const rank = { incident: 0, maintenance: 1, info: 2 };
  return (list || []).filter((a) => !a.endedAt && a.startsAt <= now && now < a.endsAt).sort((x, y) => rank[x.kind] - rank[y.kind])[0] || null;
}

const bridge = {
  mem: null,
  blank() {
    return { version: 1, seq: 1, settings: null, announcements: null, experts: null, team: null, family: null,
      alerts: [], cases: [], bookings: [], reviews: [], dataRequests: [], audit: [] };
  },
  /* storage is the source of truth when it works; memory only when the browser blocks it */
  read() {
    let raw;
    try { raw = localStorage.getItem(BRIDGE_KEY); } catch (e) { return this.mem ? JSON.parse(JSON.stringify(this.mem)) : this.blank(); }
    if (!raw) return this.blank();
    try { const s = JSON.parse(raw); if (s && s.version === 1) return { ...this.blank(), ...s }; } catch (e) { /* corrupt: start over */ }
    return this.blank();
  },
  /* read-modify-write on a fresh copy, so a write from the other tab in between is not lost */
  update(fn) {
    const s = this.read();
    const out = fn(s) || s;
    this.mem = out;
    try { localStorage.setItem(BRIDGE_KEY, JSON.stringify(out)); } catch (e) { /* memory only */ }
    return out;
  },
  id(s, prefix) { return `${prefix}-${9000 + s.seq++}`; },
  reset() {
    this.mem = null;
    try { localStorage.removeItem(BRIDGE_KEY); } catch (e) { /* nothing stored */ }
  },
  /* fires only for writes made in another tab */
  subscribe(fn) {
    const h = (e) => { if (e.key === BRIDGE_KEY || e.key === null) fn(); };
    window.addEventListener('storage', h);
    return () => window.removeEventListener('storage', h);
  },
  settings() {
    const s = this.read().settings;
    return { aiEnabled: true, safetyWords: DEFAULT_SAFETY_WORDS, promptVersion: 'v1.4', ...(s || {}) };
  },
  experts(now = Date.now()) { return this.read().experts || seedExperts(now); },
};

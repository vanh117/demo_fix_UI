/* EchoKid vocabulary shared by the parent app and the moderator console. */
'use strict';

/* children/page.tsx formatter */
function formatAge(m) {
  if (m < 12) return `${m} tháng`;
  const y = Math.floor(m / 12), r = m % 12;
  return r ? `${y} tuổi ${r} tháng` : `${y} tuổi`;
}

/* lib/age.ts */
function combineAgeMonths(years, months) {
  const y = Number.isInteger(years) && years >= 0 ? years : 0;
  const m = Number.isInteger(months) && months >= 0 ? months : 0;
  return y * 12 + m;
}

/* ---------- domain vocabulary ---------- */
const MOODS = [
  { value: 'happy', label: 'Vui vẻ' },
  { value: 'calm', label: 'Bình tĩnh' },
  { value: 'irritable', label: 'Cáu gắt' },
  { value: 'anxious', label: 'Lo âu' },
  { value: 'withdrawn', label: 'Thu mình' },
];

const MOOD_LABEL = Object.fromEntries(MOODS.map((m) => [m.value, m.label]));

const POSITIVE = new Set(['happy', 'calm']);

const LEVELS = [{ value: 'low', label: 'Thấp' }, { value: 'medium', label: 'Vừa' }, { value: 'high', label: 'Tốt' }];

const LEVEL_LABEL = { low: 'thấp', medium: 'vừa', high: 'tốt' };

const SLEEP_QUALITY = [{ value: 'good', label: 'Ngủ tốt' }, { value: 'restless', label: 'Trằn trọc' }, { value: 'poor', label: 'Ngủ kém' }];

const SLEEP_LABEL = { good: 'ngủ tốt', restless: 'trằn trọc', poor: 'ngủ kém' };

const GENDERS = [{ value: 'male', label: 'Bé trai' }, { value: 'female', label: 'Bé gái' }, { value: 'other', label: 'Khác' }];

const GENDER_LABEL = { male: 'Bé trai', female: 'Bé gái', other: 'Khác' };

const RANGES = [{ value: 'day', label: 'Hôm nay' }, { value: 'week', label: '7 ngày' }, { value: 'month', label: '30 ngày' }];

const RANGE_SPAN = { day: 'hôm nay', week: '7 ngày qua', month: '30 ngày qua' };

const SLOTS = ['Sáng · 08:00–11:00', 'Chiều · 13:30–17:00', 'Tối · 18:00–20:00'];

const TRIGGER_CHIPS = ['Tiếng ồn lớn', 'Thay đổi lịch sinh hoạt', 'Chuyển hoạt động', 'Chỗ đông người', 'Đói hoặc mệt', 'Đồ ăn không đúng vị'];

const SEVERITY = {
  mild: { label: 'Ổn định', tone: 'good', icon: 'checkCircle', hint: 'Lần ghi này nằm trong nhịp bình thường của con.' },
  moderate: { label: 'Theo dõi thêm', tone: 'warn', icon: 'eye', hint: 'Có vài dấu hiệu cần để ý trong những lần ghi tới.' },
  high: { label: 'Cần chú ý', tone: 'crit', icon: 'alert', hint: 'EchoKid khuyên ba mẹ trao đổi với chuyên gia.' },
};

const DISCLAIMER = 'Phân tích được tạo bởi AI từ dữ liệu phụ huynh vừa nhập và lịch sử EchoKid; không thay thế chẩn đoán hoặc điều trị y khoa.';

/* track signals, as in app/analysis/page.tsx */
function entrySignals(o) {
  const s = [];
  const melt = o.meltdown?.totalCount ?? o.meltdownCount ?? 0;
  if (melt > 0) s.push(`Meltdown ${melt} lần`);
  if (o.sleep?.quality === 'poor') s.push('Ngủ kém');
  if (o.sleep?.quality === 'restless') s.push('Ngủ trằn trọc');
  if (o.socialInteraction === 'low') s.push('Tương tác thấp');
  if (o.focus === 'low') s.push('Tập trung thấp');
  return s;
}

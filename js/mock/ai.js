/* Stand-in for the Gemini call (services/ai.service.ts) plus the ported risk rules (services/recommendation.service.ts). */
'use strict';

/* ---------- lib/activities.ts (copied) ---------- */
const REF_CATALOG = {
  esdm: { key: 'esdm', title: 'Early Start Denver Model', organization: 'Sally Rogers & Geraldine Dawson', note: 'Phù hợp các hoạt động tương tác tự nhiên, lượt chơi và giao tiếp sớm.' },
  aba: { key: 'aba', title: 'Applied Behavior Analysis', organization: 'Behavior Analyst Certification Board', note: 'Phù hợp khi cần chia nhỏ bước, tăng cường phản hồi và cụ thể hóa kỳ vọng.' },
  sensory_regulation: { key: 'sensory_regulation', title: 'Sensory Regulation Strategies', organization: 'Sensory integration practice', note: 'Phù hợp khi trẻ có dấu hiệu quá tải kích thích hoặc cần ổn định cảm giác.' },
  who_cst: { key: 'who_cst', title: 'Caregiver Skills Training', organization: 'World Health Organization', note: 'Nhấn mạnh cách cha mẹ hỗ trợ trẻ tại nhà bằng các hoạt động gần với sinh hoạt hằng ngày.' },
  aap_co_regulation: { key: 'aap_co_regulation', title: 'Co-Regulation And Supportive Routines', organization: 'American Academy of Pediatrics', note: 'Phù hợp với hoạt động ngắn, an toàn, giúp người lớn đồng điều hòa cùng trẻ.' },
  cdc_play: { key: 'cdc_play', title: 'Developmental Play And Routines', organization: 'CDC', note: 'Phù hợp với hoạt động chơi đơn giản, rõ ràng, dễ áp dụng tại nhà theo từng độ tuổi.' },
};

/* ---------- stand-in for the Gemini call (services/ai.service.ts) ---------- */
const ACTIVITIES = {
  calmCorner: {
    title: 'Góc bình yên 10 phút', minutes: 10, refs: ['sensory_regulation', 'aap_co_regulation'],
    steps: [
      'Đưa con đến một góc yên tĩnh, giảm đèn và tắt bớt tiếng ồn xung quanh.',
      'Ngồi ngang tầm mắt con, nói chậm và ít từ: "Mẹ ở đây. Mình thở cùng nhau nhé."',
      'Đưa con một món đồ quen thuộc như gối ôm, chăn nặng hoặc đồ bóp tay.',
      'Cùng thở chậm 5 lần: hít vào đếm 4, thở ra đếm 4. Có thể thổi chong chóng cho dễ theo.',
      'Khi con dịu lại, khen cụ thể: "Con đã bình tĩnh lại rồi, giỏi lắm."',
    ],
    why: (o, c) => c.melt > 0
      ? `Lần ghi này có ${c.melt} cơn meltdown${c.trigger ? ` sau khi gặp "${c.trigger}"` : ''}. Một góc ít kích thích cùng nhịp thở chậm giúp con điều hòa lại trước khi quay về hoạt động khác.`
      : `Con đang cáu gắt${o.sleep?.quality === 'poor' ? ' và ngủ chưa ngon' : ''}. Giảm kích thích xung quanh giúp con hạ nhiệt mà không bị ép phải nói ra cảm xúc.`,
  },
  visualSchedule: {
    title: 'Lịch trình bằng hình ảnh cho nửa ngày còn lại', minutes: 15, refs: ['aba', 'who_cst'],
    steps: [
      'Chuẩn bị 3–4 thẻ hình cho các việc sắp tới, ví dụ ăn nhẹ, tắm, chơi, đi ngủ.',
      'Xếp thẻ theo thứ tự từ trái sang phải và cùng con gọi tên từng việc.',
      'Xong mỗi việc, để con tự lật thẻ hoặc bỏ thẻ vào hộp "Đã xong".',
      'Báo trước 5 phút trước mỗi lần chuyển việc bằng đồng hồ cát hoặc hẹn giờ.',
    ],
    why: (o) => `Con có biểu hiện lo âu${o.focus === 'low' ? ' và khó tập trung' : ''}. Khi biết trước điều gì sắp diễn ra, trẻ trong phổ tự kỷ thường bớt căng thẳng trước những thay đổi trong ngày.`,
  },
  parallelPlay: {
    title: 'Chơi song song với món đồ con thích', minutes: 10, refs: ['esdm', 'cdc_play'],
    steps: [
      'Ngồi cạnh con và chơi cùng loại đồ chơi con đang thích, không yêu cầu con nhìn hay trả lời.',
      'Bắt chước hành động của con (xếp, lăn, gõ) và mô tả thật ngắn: "Xe chạy. Xe dừng."',
      'Khi con liếc nhìn hoặc lại gần, đáp lại bằng nụ cười và một từ đơn giản.',
      'Dừng nhẹ nhàng khi con có dấu hiệu mệt, không kéo dài.',
    ],
    why: (o) => `Con đang thu mình${o.socialInteraction === 'low' ? ' và ít tương tác' : ''}. Chơi song song cho con cảm giác an toàn khi có người bên cạnh mà không bị đòi hỏi giao tiếp.`,
  },
  bedtime: {
    title: 'Nghi thức thư giãn trước giờ ngủ', minutes: 20, refs: ['aap_co_regulation', 'who_cst'],
    steps: [
      'Tắt màn hình ít nhất 30 phút trước giờ ngủ và giảm ánh sáng trong phòng.',
      'Làm cùng một chuỗi việc mỗi tối: tắm ấm, thay đồ, đánh răng, đọc một cuốn truyện ngắn.',
      'Dùng thẻ hình cho từng bước để con biết việc gì đến tiếp theo.',
      'Nói cùng một câu chúc ngủ ngon mỗi tối để báo hiệu ngày đã kết thúc.',
    ],
    why: (o) => `Con ngủ ${fmt1(o.sleep?.hours ?? 0)} giờ và ngủ kém. Một chuỗi việc giống nhau mỗi tối giúp cơ thể con nhận tín hiệu đi ngủ sớm hơn.`,
  },
  sorting: {
    title: 'Trò chơi phân loại 5 phút', minutes: 5, refs: ['aba', 'cdc_play'],
    steps: [
      'Chuẩn bị 2 hộp và khoảng 10 món đồ thuộc 2 màu hoặc 2 loại.',
      'Làm mẫu một lần: "Đỏ vào hộp đỏ."',
      'Để con làm từng món và khen ngay khi con làm đúng.',
      'Dừng khi con vẫn còn vui, trước khi con mất tập trung.',
    ],
    why: () => 'Khả năng tập trung của con lúc này đang thấp. Một nhiệm vụ ngắn, rõ ràng và có điểm kết thúc giúp con trải nghiệm cảm giác hoàn thành.',
  },
  foodPlay: {
    title: 'Làm quen món mới bằng trò chơi', minutes: 15, refs: ['sensory_regulation', 'cdc_play'],
    steps: [
      'Đặt một miếng nhỏ món mới cạnh món con thích, không ép con ăn.',
      'Cho con chạm, ngửi hoặc dùng món đó để xếp hình trên đĩa.',
      'Ba mẹ ăn thử trước và mô tả: "Giòn giòn, ngọt ngọt."',
      'Khen khi con chạm hoặc nếm thử, dù chỉ một chút.',
    ],
    why: (o) => `Con ăn uống chưa bình thường${o.meal?.notes ? ` (${o.meal.notes.replace(/\.$/, '').toLowerCase()})` : ''}. Làm quen món mới qua chạm, ngửi và chơi giúp giảm áp lực quanh bữa ăn.`,
  },
  sharedReading: {
    title: 'Đọc truyện tranh cùng nhau', minutes: 10, refs: ['esdm', 'cdc_play'],
    steps: [
      'Chọn một cuốn truyện có hình lớn và ít chữ.',
      'Chỉ vào hình và gọi tên, chờ con chỉ theo hoặc lặp lại.',
      'Hỏi câu lựa chọn: "Con mèo hay con chó?"',
      'Khen khi con tham gia, dù chỉ là chỉ tay hay nhìn theo.',
    ],
    why: (o) => `Con đang bình tĩnh${o.socialInteraction === 'high' ? ' và tương tác tốt' : ''}. Đây là lúc thích hợp để luyện chú ý chung và vốn từ qua hình ảnh.`,
  },
  turnTaking: {
    title: 'Chơi luân phiên: xếp tháp khối', minutes: 10, refs: ['esdm', 'who_cst'],
    steps: [
      'Ngồi đối diện con, chia khối thành hai phần: của con và của ba mẹ.',
      'Nói "Lượt của con" rồi chờ con đặt một khối, sau đó "Lượt của mẹ".',
      'Dừng một nhịp trước khi đặt khối để con có cơ hội nhìn hoặc ra hiệu.',
      'Khi tháp đổ, cùng cười và hỏi: "Đổ rồi! Làm lại nhé?"',
    ],
    why: (o) => `Con đang vui vẻ${o.socialInteraction === 'high' ? ' và chủ động tương tác' : ''}. Tận dụng tâm trạng tốt để luyện chờ lượt, giao tiếp mắt và yêu cầu bằng lời.`,
  },
};

function pickActivity(o) {
  const melt = o.meltdown?.totalCount ?? 0;
  if (melt > 0 || o.mood === 'irritable') return 'calmCorner';
  if (o.mood === 'anxious') return 'visualSchedule';
  if (o.mood === 'withdrawn' || o.socialInteraction === 'low') return 'parallelPlay';
  if (o.sleep?.quality === 'poor') return 'bedtime';
  if (o.focus === 'low') return 'sorting';
  if (o.meal && o.meal.ateNormally === false) return 'foodPlay';
  if (o.mood === 'calm') return 'sharedReading';
  return 'turnTaking';
}

const MOOD_PHRASE = { happy: 'đang vui vẻ', calm: 'khá bình tĩnh', irritable: 'đang cáu gắt', anxious: 'có biểu hiện lo âu', withdrawn: 'có xu hướng thu mình' };

const SAFETY_WORDS = /(tự đánh|đập đầu|cắn tay|tự cắn|tự làm đau|cào mặt|bỏ chạy ra đường)/i;

function mockGenerateAI(child, o, recent) {
  const melt = o.meltdown?.totalCount ?? 0;
  const trigger = o.meltdown?.events?.[0]?.trigger || '';
  const note = o.freeTextNote || '';
  const key = pickActivity(o);
  const act = ACTIVITIES[key];
  const lastWeek = recent.filter((r) => r.date >= addDaysISO(o.date, -7));
  const posShare = lastWeek.length ? lastWeek.filter((r) => POSITIVE.has(r.mood)).length : 0;

  let severityLevel = 'mild', shouldSuggestExpert = false, message = null;
  const low = !POSITIVE.has(o.mood) || melt > 0 || o.sleep?.quality === 'poor' || o.socialInteraction === 'low' || o.focus === 'low';
  if (SAFETY_WORDS.test(note)) {
    severityLevel = 'high'; shouldSuggestExpert = true;
    message = 'Ghi chú cho thấy con có thể đã tự làm đau mình hoặc gặp nguy hiểm. Ba mẹ nên liên hệ bác sĩ hoặc chuyên gia sớm để được hướng dẫn giữ an toàn cho con.';
  } else if (melt >= 3) {
    severityLevel = 'moderate'; shouldSuggestExpert = true;
    message = `Con có ${melt} cơn meltdown trong lần ghi này. Nếu tình trạng lặp lại trong vài ngày tới, ba mẹ nên trao đổi với chuyên gia để tìm hiểu nguyên nhân.`;
  } else if (low) severityLevel = 'moderate';

  const parts = [
    `Lúc ${o.time}, ${child.name} ${MOOD_PHRASE[o.mood]}.`,
    `Con ngủ ${fmt1(o.sleep?.hours ?? 0)} giờ (${SLEEP_LABEL[o.sleep?.quality] ?? 'chưa rõ'}), tương tác ${LEVEL_LABEL[o.socialInteraction]} và tập trung ${LEVEL_LABEL[o.focus]}.`,
  ];
  if (melt) parts.push(`Có ${melt} cơn meltdown${trigger ? `, có thể liên quan đến "${trigger}"` : ''}.`);
  if (o.meal && o.meal.ateNormally === false) parts.push(`Con ăn uống chưa bình thường${o.meal.notes ? `: ${o.meal.notes.replace(/\.$/, '').toLowerCase()}` : ''}.`);
  if (lastWeek.length >= 3) parts.push(`Trong 7 ngày trước đó, ${posShare}/${lastWeek.length} lần ghi con vui vẻ hoặc bình tĩnh.`);

  let empathyMessage;
  if (severityLevel === 'high') empathyMessage = 'Ba mẹ không phải đi một mình. Khi có dấu hiệu đáng lo, có thêm người đồng hành sẽ giúp cả nhà nhẹ lòng hơn.';
  else if (melt > 0) empathyMessage = 'Cơn meltdown không phải lỗi của con hay của ba mẹ. Việc ba mẹ bình tĩnh quan sát và ghi lại tác nhân đã là một bước rất tốt.';
  else if (!POSITIVE.has(o.mood)) empathyMessage = 'Những lúc con khó chịu cũng thường là lúc ba mẹ mệt nhất. Ba mẹ đã dừng lại để ghi chép, đó là một cách chăm sóc cả con lẫn chính mình.';
  else empathyMessage = `Thật vui khi thấy ${child.name} có một khoảnh khắc dễ chịu. Ghi lại những lúc như thế này giúp ba mẹ biết điều gì đang có tác dụng với con.`;

  return {
    severityLevel,
    empathyMessage,
    contextSummary: parts.join(' '),
    recommendation: {
      title: act.title,
      durationMinutes: act.minutes,
      whyThis: act.why(o, { melt, trigger }),
      steps: act.steps.slice(),
      references: act.refs.map((k) => REF_CATALOG[k]),
    },
    escalation: { shouldSuggestExpert, message },
  };
}

/* ---------- services/recommendation.service.ts (ported) ---------- */
function moodBand(mood) { return mood === 'happy' || mood === 'calm' ? 'positive' : 'low'; }

function assessRiskPatterns(current, recent) {
  const history = [...recent, current].sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  const sameDay = history.filter((item) => item.date === current.date);
  const moodChanges = sameDay.slice(1).reduce((count, item, i) => (moodBand(item.mood) !== moodBand(sameDay[i].mood) ? count + 1 : count), 0);
  const volatileInOneDay = sameDay.length >= 4 && moodChanges >= 3;
  const lastThree = history.slice(-3);
  const sustainedLow = lastThree.length === 3 && lastThree.every((item) => (
    moodBand(item.mood) === 'low' || item.socialInteraction === 'low' || item.focus === 'low' || (item.meltdown?.totalCount ?? 0) > 0
  ));
  const reasons = [];
  if (volatileInOneDay) reasons.push('Cảm xúc thay đổi liên tục giữa tích cực và khó khăn trong cùng một ngày.');
  if (sustainedLow) reasons.push('Ba lần ghi nhận gần nhất liên tục có dấu hiệu ở mức thấp hoặc cần hỗ trợ.');
  return { high: reasons.length > 0, reasons };
}

function highRiskMessage(reasons) {
  const context = reasons.length ? ` ${reasons.join(' ')}` : '';
  return `EchoKid nhận thấy một pattern cần được quan tâm.${context} Ba mẹ nên đặt lịch trao đổi với bác sĩ hoặc chuyên gia để được đánh giá kỹ hơn.`;
}

function severityFromObservation(o, aiSeverity) {
  const melt = o.meltdown?.totalCount ?? 0;
  const needsSupport = ['irritable', 'anxious', 'withdrawn'].includes(o.mood) || melt > 0 ||
    o.sleep?.quality === 'poor' || o.socialInteraction === 'low' || o.focus === 'low';
  if (aiSeverity === 'high') return 'high';
  if (aiSeverity === 'moderate' || needsSupport) return 'moderate';
  return 'mild';
}

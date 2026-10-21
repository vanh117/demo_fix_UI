/* Price tables and the cost model behind the moderator console.
   Gemini: ai.google.dev/gemini-api/docs/pricing (page updated 24/09/2026). Output price includes thinking tokens.
   Firestore: firebase.google.com/docs/firestore/billing-example (nam5 multi-region, updated 24/09/2026). */
'use strict';

const PRICE_CHECKED = '24/09/2026';
const PRICE_SOURCES = {
  gemini: 'https://ai.google.dev/gemini-api/docs/pricing',
  firestore: 'https://firebase.google.com/docs/firestore/billing-example',
  rateLimits: 'https://aistudio.google.com/rate-limit',
};

/* US$ per 1 million tokens, standard paid tier, text input */
const GEMINI_MODELS = [
  { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', note: 'Mô hình EchoKid đang gọi trong services/ai.service.ts.',
    prices: { now: { input: 0.75, output: 3.75 }, from2027: { input: 1.5, output: 7.5 } } },
  { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite', note: 'Rẻ hơn nhiều, cần thử lại chất lượng gợi ý trước khi đổi.',
    prices: { now: { input: 0.25, output: 1.5 } } },
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', note: 'Đắt hơn bản 3.6 Flash đang dùng.', prices: { now: { input: 1.5, output: 9 } } },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', note: 'Thế hệ cũ.', prices: { now: { input: 0.3, output: 2.5 } } },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite', note: 'Thế hệ cũ, rẻ nhất.', prices: { now: { input: 0.1, output: 0.4 } } },
];
const CURRENT_MODEL = 'gemini-3.6-flash';

const FIRESTORE = {
  readsPer100k: 0.06, writesPer100k: 0.18, storagePerGiBMonth: 0.18,
  free: { readsPerDay: 50000, writesPerDay: 20000, storageGiB: 1 },
};

/* Measured from the prompt in services/ai.service.ts: about 3,450 fixed characters plus about 1,950 for the
   response schema, and about 443 characters per past entry (the code sends up to 20). Converted at about
   3.25 characters per token for Vietnamese text mixed with JSON. The real numbers come from usageMetadata. */
const TOKEN_MODEL = { baseInput: 1660, perHistoryEntry: 136, maxHistory: 20, visibleOutput: 375, thinking: 900 };

/* Firestore reads for one diary session in the redesigned flow (Today → Diary → save → advice).
   getObservations() loads every observation of the child and filters by date in memory,
   so reads grow with the child's whole history (N). With a date filter in the query, N stays at ~30 days. */
const readsPerSession = (history) => 9 * history + 38;
const WRITES_PER_SESSION = 3.4;
const BYTES_PER_ENTRY = 5 * 1024;

function modelById(id) { return GEMINI_MODELS.find((m) => m.id === id) || GEMINI_MODELS[0]; }
function listedPrice(id, period) {
  const m = modelById(id);
  return (period === 'from2027' && m.prices.from2027) || m.prices.now;
}

/* US$ for a batch of tokens; thinking tokens are billed at the output price */
function tokenCost(tokens, price) {
  const input = (tokens.input * price.input) / 1e6;
  const output = (tokens.output * price.output) / 1e6;
  const thinking = (tokens.thinking * price.output) / 1e6;
  return { input, output, thinking, total: input + output + thinking };
}

function firestoreMonthly(readsPerDay, writesPerDay, storedGiB) {
  const reads = (Math.max(0, readsPerDay - FIRESTORE.free.readsPerDay) * 30 / 1e5) * FIRESTORE.readsPer100k;
  const writes = (Math.max(0, writesPerDay - FIRESTORE.free.writesPerDay) * 30 / 1e5) * FIRESTORE.writesPer100k;
  const storage = Math.max(0, storedGiB - FIRESTORE.free.storageGiB) * FIRESTORE.storagePerGiBMonth;
  return { reads, writes, storage, total: reads + writes + storage };
}

/* Monthly cost for the forecast tool */
function projectMonthly({ families, entriesPerDay, historySent, thinking, monthsActive, queryFixed, hosting, price }) {
  const sessionsPerDay = families * entriesPerDay;
  const callsPerMonth = sessionsPerDay * 30;
  const perCall = { input: TOKEN_MODEL.baseInput + TOKEN_MODEL.perHistoryEntry * historySent, output: TOKEN_MODEL.visibleOutput, thinking };
  const gemini = tokenCost({ input: perCall.input * callsPerMonth, output: perCall.output * callsPerMonth, thinking: perCall.thinking * callsPerMonth }, price);
  const historyAllTime = entriesPerDay * 30 * Math.max(0.5, monthsActive - 0.5);
  const history = queryFixed ? Math.min(historyAllTime, entriesPerDay * 30) : historyAllTime;
  const readsPerDay = sessionsPerDay * readsPerSession(history);
  const writesPerDay = sessionsPerDay * WRITES_PER_SESSION;
  const storedGiB = (sessionsPerDay * 30 * monthsActive * BYTES_PER_ENTRY) / 2 ** 30;
  const firestore = firestoreMonthly(readsPerDay, writesPerDay, storedGiB);
  const total = gemini.total + firestore.total + hosting;
  return { callsPerMonth, perCall, gemini, firestore, readsPerDay, writesPerDay, storedGiB, hosting, total, perFamily: families ? total / families : 0 };
}

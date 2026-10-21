# EchoKid redesign prototype

A clickable prototype of the EchoKid redesign: a diary app that helps Vietnamese parents of autistic children log their child's day and get short, evidence-based activity suggestions, plus the moderator console the team needs to run it safely.

It is based on [nghuyn1512/EchoKid](https://github.com/nghuyn1512/EchoKid) (Next.js 16, Firebase, NextAuth with Google, Gemini). Everything here runs in the browser on sample data. The mock layer keeps the repo's URLs, payloads and error messages, so the design can be ported back without guessing.

| Page | Who it is for | What it does |
|---|---|---|
| [`index.html`](index.html) | Parents | Choose a child, log mood/sleep/meltdowns, get a suggestion, see the week, book an expert, manage privacy and data |
| [`admin.html`](admin.html) | Moderators | Safety cases, expert requests, expert verification, accounts and data requests, AI controls, cost, quality, errors, announcements, team, audit log |
| [`admin-v1.html`](admin-v1.html) | – | The first, read-only console. Kept for comparison; safe to delete |

---

## Quick start

1. Open `index.html` and `admin.html` in **Edge or Chrome**, ideally in two tabs of the same window. No install and no build step; an internet connection is needed for React, htm, Tailwind and the fonts (all from CDNs).
2. In the parent app, the **Điều khiển** button (top right) switches screens and data scenarios. In the console, the dark bar at the top lets you sign in as each team member, simulate an expired session, reset the shared data and switch theme.
3. To run the checks: `npm test` (needs Node 22+ and Edge or Chrome; nothing to install).

Firefox treats every local file as a separate site, so the two pages cannot see each other's data there. Use Edge/Chrome, or serve the folder: `npm run serve` (Python's built-in server) and open http://localhost:8080/.

**URL shortcuts**

- Parent app: `index.html#<screen>.<scenario>.<theme>` (any order). Screens: `home`, `login`, `children`, `today`, `diary`, `advice`, `expert`, `privacy`. Scenarios: `stable`, `alert` (three hard entries today), `new` (no child profile yet), `aierror`. Themes: `light`, `dark`.
  Example: `index.html#today.alert.dark`
- Console: `admin.html?as=<member>&theme=<theme>#/<page>/<id>`. Members: `m-1` Lan Anh (admin), `m-2` Minh Châu (safety), `m-3` Quốc Tú (backend), `m-4` Hải Yến (analytics), `outsider`, `signout`.
  Example: `admin.html?as=m-2&theme=dark#/alerts`

---

## What this upgrade changed (2 Oct 2026)

### Where it stood

The parent app was polished and the console had just been rebuilt with 14 pages, but **the two halves did not talk to each other**. The console exists to act on what parents do. Still, a parent's expert booking, a worrying diary note, a one-star rating or a deletion request never reached it. In the other direction, pausing AI, hiding an expert or posting an announcement never reached parents.

Several gaps from the production audit were also still visible in the parent app:

- Every expert was labelled "Đã xác minh" (verified).
- Booking requests were thrown away.
- Parents had no way to see what happened to a request, to download or delete their data, or to switch AI off.
- Two logic bugs copied from the repo were still in the mock.
- The project had no automated checks.

So the upgrade connects the two apps, closes those gaps, and adds tests. It does **not** restyle the parent app (see [What I did not do](#what-i-did-not-do-and-why)).

### 1. The two apps now share state

[`js/shared/bridge.js`](js/shared/bridge.js) is a small shared store that both pages load. It stands in for the Firestore documents both sides would read in production. Open the two pages side by side and changes show up in the other tab immediately, with a toast in the console.

| Parent does | Console shows |
|---|---|
| Saves a note with a safety keyword (e.g. "đập đầu", or typed without accents as "dap dau") | A new **P1 case** for family `GĐ-7A3C`, plus a toast and a notification |
| Gets an entry rated "Cần chú ý" by the risk rules or the model | A P2 or P3 case (same 72-hour grouping as the sample data) |
| Books an expert | A new request in **Yêu cầu chuyên gia**, linked to the open case. P2/P3 cases close themselves when the family books |
| Rates a suggestion 1–2 stars | An item in the **Chất lượng gợi ý** review queue, with the child's name replaced by "bé" |
| Asks for an emailed copy of their data, a correction or account deletion | A data request with a 72-hour deadline in **Tài khoản và dữ liệu** |
| Switches AI off | A finished "withdraw AI consent" record, so moderators can see it |
| Accepts the v2 terms | The account shows consent v2 instead of "needs re-consent" |

| Moderator does | Parent sees |
|---|---|
| Posts an announcement (info, maintenance, incident) | A banner on every app screen while it is live; parents can dismiss it |
| Pauses AI | "Gợi ý AI đang tạm nghỉ" on the diary. Entries still save, and the safety keyword check still runs |
| Hides an expert, or lets a verification expire | The expert disappears from the list, or loses the "Đã xác minh" badge |
| Forwards, confirms or cancels a booking | The status under **Yêu cầu của ba mẹ** on the expert page |
| Schedules the account for deletion | A red notice with the deletion time |
| Suspends the account | A "Tài khoản đang tạm khóa" screen (the mock API also refuses requests) |
| Edits the safety keyword list | The parent app checks notes against the new list |

### 2. New in the parent app

- **Privacy and data page** (account menu → *Quyền riêng tư và dữ liệu*, file [`js/app/pages/privacy.js`](js/app/pages/privacy.js)). On it, parents can:
  - read and accept the updated terms
  - switch AI suggestions off and on
  - download everything as one JSON file
  - ask for an emailed copy, a correction, or account deletion
  - follow the status of each request
- **Expert page:**
  - The "Đã xác minh" badge appears only when a moderator has completed all three checks in the last 12 months, and shows the month it was checked.
  - A **Yêu cầu của ba mẹ** card shows each request's status in plain language.
  - The confirmation now says what really happens: the EchoKid team forwards the request within 24 hours.
- **Diary:**
  - When AI is paused or switched off, the save button says "Lưu nhật ký" and a calm notice explains why.
  - If the note matched a safety keyword, the urgent block with the 115 emergency number still appears.
- **Notices** at the top of every signed-in screen: the live announcement and pending deletion.

### 3. Safety keywords run before the AI

`POST /api/daily_log` now checks the note, meal note and meltdown trigger against the moderator-managed keyword list, ignoring Vietnamese tone marks. A match:

- always makes the entry "Cần chú ý" (high), whatever the model says;
- opens a P1 case right away, even when AI is paused, failing or switched off by the parent.

Before this change, catching self-harm depended on the model alone.

### 4. Bugs fixed in the mock (the same fixes apply to the repo)

| Bug | Fix | Where |
|---|---|---|
| `POST /api/expert` replied "đã gửi" (sent) but stored nothing | The request is stored and tracked; it also requires a signed-in parent now (it was public) | [`js/mock/api.js`](js/mock/api.js) |
| Streak read 0 every morning until the first entry of the day | Count back from yesterday when today has no entry yet | `computeStreak` |
| One meltdown after a quiet week (0 → 1) was reported as "increasing" | A change of 0.5 per day or less is "stable" | `computeTrend` |
| Low-rated feedback would carry the child's name to moderators | The name is replaced by "bé" before it leaves the parent side | `POST /api/feedback` |

Two fixes from the first redesign are still in place: retrying the AI no longer saves the entry twice, and diary times come from the local clock instead of a UTC slice.

### 5. Tests are part of the project

`npm test` runs 93 checks in about three minutes. See [Tests](#tests).

### 6. Housekeeping

- `MIN`/`HOUR`/`DAY` and the accent-insensitive `fold()` moved into [`js/shared/core.js`](js/shared/core.js), so both apps share them.
- The expert list and the default safety keywords now live in one place, `bridge.js`. Before, the parent app and the console each had their own copy.
- Added `package.json` (scripts only, no dependencies) and a `.gitignore`.

### Walk-through (5 minutes, two tabs)

1. Open `admin.html#/alerts` in one tab and `index.html#diary` in another.
2. In the parent tab, type a note such as *"Chiều nay bé dap dau vao tuong"* and press **Lưu & nhận gợi ý**. The suggestion page shows the red "Cần chú ý" block. In the console tab a toast appears, and case `CA-9001` joins the queue as a P1 case for family `GĐ-7A3C`.
3. Open the case: claim it, view the contact details (a reason is required, and the view is logged), add a note.
4. In the parent tab, go to **Chuyên gia**, enter a phone number and send a request. It appears in the console's **Yêu cầu chuyên gia** inbox, linked to the case. Forward it, and the parent's request card changes to "Đã gửi chuyên gia".
5. In the console, open **Thông báo phụ huynh** and post an incident starting now. The banner appears in the parent app.
6. In the console, open **Điều khiển AI** and pause AI. Save another diary entry: it saves and explains that suggestions are paused.
7. In the parent app, open **Quyền riêng tư và dữ liệu**: accept v2, then request deletion. In the console, open the request from **Tài khoản và dữ liệu** and schedule the deletion. The parent app shows when the account will be deleted.
8. In the console, open **Nhật ký kiểm tra** (audit log) to see everything the moderators did.

To start over, use **Đặt lại dữ liệu** in the console bar, or *Xóa dữ liệu dùng chung* in the parent app's Điều khiển panel.

### What I did not do, and why

- **No Tailwind for the parent app.** Its custom design system ([`css/tokens.css`](css/tokens.css), [`base.css`](css/base.css), [`app.css`](css/app.css)) is complete and tested on phones. Rewriting it now adds risk without anything parents would notice. Do it during the Next.js port, when Tailwind is installed properly. The console's classes and the tokens carry over unchanged.
- **No port to Next.js yet.** That changes the real repo and needs a Firebase project, so it is your call. The plan is below.
- **No git repository.** The folder has no version history, which is why the old console is kept as `admin-v1.html` and not overwritten. Running `git init` and committing before the next round of changes is the first step I recommend.

---

## Project layout

```
index.html                 parent app (loads the scripts below in order)
admin.html                 moderator console (Tailwind v4 from a CDN, mapped onto css/tokens.css)
admin-v1.html              first console, kept for comparison
css/
  tokens.css               colours, type, radii; light and dark (both apps)
  base.css, app.css        parent app styles
  admin.css                admin-v1 only
js/
  shared/
    core.js                React + htm, dates and numbers (vi-VN), icons, theme, fold(), MIN/HOUR/DAY
    bridge.js              state shared by both apps; expert seed; safety keywords; sample family code
    domain.js, components.js   parent vocabulary and UI pieces
  mock/                    parent backend; mirrors services/* and app/api/* in the repo
    ai.js                  stand-in for the Gemini call + ported risk rules
    db.js                  in-memory Firestore stand-in with a seeded sample diary
    api.js                 apiFetch(): same routes and payloads as the repo, plus the new ones
  app/                     parent app: shell, router, pages/
  admin/
    pricing.js, data.js    cost model and seeded usage (used by both consoles)
    charts.js, sections-*.js, main.js   admin-v1 only
  console/                 moderator console
    store.js               mock server: roles, cases, bookings, experts, accounts, settings, audit; bridge sync
    ui.js, charts.js       Tailwind components and charts
    pages-*.js             the 14 pages
    shell.js, main.js      layout, routing, session
tests/                     browser and logic checks (see Tests)
```

All scripts are plain classic `<script>` files sharing one global scope. That is what lets the pages open straight from disk. It also means two files must never declare the same top-level `const`; `npm run test:logic` loads each page's scripts in order and catches that.

---

## How the shared state works

- **One record in `localStorage`** under the key `echokid.bridge.v1`.
- **Updates are read-modify-write** on a fresh copy, so a write from the other tab in between is not lost.
- **Live updates.** The browser's `storage` event tells the other tab something changed. The parent app re-renders; the console merges the change into its mock server, refreshes every list on screen and shows a toast.
- **Who writes what.** Parents only add records (alerts, bookings, reviews, data requests) and update their own family fields (age bands, counts, consent, AI switch). Moderators update statuses, settings, the announcements, the expert list, the team and the audit log. Records are merged by id, so neither side overwrites the other's changes.
- **Only the sample family is bridged.** The parent app's sample family (Thu Hà, children An and Mây) appears in the console as `GĐ-7A3C`. Moderators never see names or diary text. All other families in the console are generated sample data. Shared ids start at 9000 (`CA-9001`, `YC-9002`, …) so they never collide with sample ids.
- **If storage is blocked** (private windows in some browsers), each page keeps working on its own data and the two simply stop syncing.

In production this record becomes Firestore documents, listed in [Porting to the Next.js repo](#porting-to-the-nextjs-repo).

---

## Parent API (mock, [`js/mock/api.js`](js/mock/api.js))

| Route | Status vs the repo |
|---|---|
| `GET/POST /api/children` | Same |
| `POST /api/daily_log` | **Changed:** runs the safety keyword check before any AI call |
| `GET /api/daily_log`, `GET /api/dashboard`, `GET /api/dashboard/progress`, `GET /api/report` | Same payloads; streak and trend fixed |
| `GET /api/recommendation` | Same |
| `POST /api/recommendation` | **Changed:** respects the AI pause (`503 AI_PAUSED`) and the parent's switch-off (`403 AI_OFF`); both include `safety` when a keyword matched. Opens a case when severity is high |
| `GET/POST /api/feedback` | Same payloads; 1–2 star ratings also go to the review queue |
| `GET /api/expert` | **Changed:** only active experts, each with `verified` and `verifiedAt` |
| `POST /api/expert` | **Changed:** stores the request and requires sign-in; returns `booking.id` |
| `GET /api/expert/requests` | **New:** the family's requests and their status |
| `GET /api/account` | **New:** consent, status, AI switch, data requests |
| `POST /api/account/consent` | **New:** accept the current terms (v2) |
| `POST /api/account/ai` | **New:** `{ enabled: false }` switches AI off immediately |
| `POST /api/account/requests` | **New:** `{ type: 'export' \| 'delete' \| 'correct' }`; a second open request of the same type returns 409 |
| `GET /api/account/export` | **New:** everything stored for the family, as JSON |

A suspended account gets `403 ACCOUNT_SUSPENDED` on everything except `/api/account`.

## Moderator API (mock, [`js/console/store.js`](js/console/store.js))

All routes sit under `/api/admin/*` and take the role from the signed-in member, never from the URL. Each route names the permission it needs. Every write, every contact reveal and every account lookup adds an entry to the audit log.

- **Session and summary:** `session`, `summary`, `notifications`, `search`, `metrics?range=7|30|90`
- **Cases:** `cases` (filters and paging), `cases/:id`, `PATCH cases/:id` (claim, assign, contacted, note, close, reopen), `POST cases/:id/reveal` (a reason is required; the details show for 10 minutes)
- **Bookings:** `bookings`, `bookings/:id`, `PATCH bookings/:id` (forward, confirm, done, cancel), `POST bookings/:id/reveal`
- **Experts:** `GET/POST experts`, `PATCH experts/:id` (three-step verification, visibility)
- **Accounts:** `accounts?q=&reason=` (exact match only), `POST accounts/:id/{export|suspend|unsuspend|delete|cancel-delete}`, `data-requests`
- **AI and alerts:** `GET settings`, `PATCH settings/ai`, `POST ai/pause`, `POST ai/resume`, `PATCH settings/alerts`, `POST settings/alerts/test`
- **Quality, errors, announcements:** `quality`, `PATCH quality/:id`, `errors`, `GET/POST announcements`, `POST announcements/:id/end`
- **Team and audit:** `GET/POST team`, `PATCH/DELETE team/:id`, `audit` (with `export=1` for CSV)

**Roles:**

| Role | Can work on |
|---|---|
| Admin | Everything |
| Kiểm duyệt an toàn (safety moderator) | Cases, contact reveal, bookings, experts, quality review, announcements |
| Backend / SRE | Metrics, system, AI controls, announcements |
| Phân tích dữ liệu (analytics) | Metrics, cost, quality (read only) |

The full table is on the console's **Nhóm điều hành** page.

---

## Porting to the Next.js repo

Suggested order. Each step is useful on its own.

1. **Store what is thrown away today.**
   - Write each Gemini call's `usageMetadata`, latency, error code and request id to an `aiCalls` collection. The cost and system pages read from it.
   - Store expert requests in `bookings`.
   - Add the date filter to `getObservations()`; Firestore reads currently grow with a child's whole history.
2. **Safety first.**
   - Add the keyword check to `POST /api/daily_log`, using `fold()` so missing tone marks still match.
   - Create a `cases` collection, grouping alerts per family within 72 hours on the server.
   - Send a push or email to whoever is on call for every new P1 case.
3. **Moderator access.**
   - Add a `moderators` collection with roles.
   - Give every `/api/admin/*` route a role check from the NextAuth session, and require Google 2-step verification.
   - Make `auditLog` append-only: Firestore rules allow create and deny update and delete.
4. **Settings the app reads at run time.** A `settings` document with:
   - `aiEnabled`, `model`, `thinking`, `historySent`
   - `dailyBudget`, `budgetAction`, `perFamilyLimit`
   - `safetyWords`, `promptVersion`

   `services/ai.service.ts` reads it instead of hard-coded values.
5. **Parent-facing pieces.** Port `announcements`, `experts` (with verification fields), `dataRequests`, the new `/api/expert/requests` and `/api/account/*` routes, and the privacy page.
6. **Console UI.** Install Tailwind v4 properly (PostCSS). Copy the `@theme` block from `admin.html` and the tokens, then move each `pages-*.js` component into a route under `app/admin/`. The fetch calls already match the routes above.
7. **Delete `/api/test`.** It calls Gemini without sign-in and spends the project's money.

Two things to confirm with someone who knows Vietnam's data protection law before launch:

- the 72-hour deadline for data requests (an internal placeholder here);
- the wording of the v2 terms on the privacy page.

Gemini and Firestore prices in the console were checked on 24/09/2026. Gemini 3.6 Flash doubles from 1 January 2027.

---

## Tests

```
npm test                 # everything (about 3 minutes)
npm run test:logic       # no browser: every script loads, mock API and shared state (2 seconds)
npm run test:parent      # every parent screen, 3 data scenarios, desktop and phone
npm run test:console     # 14 console pages in light/desktop and dark/phone, plus 14 click-through flows
npm run test:bridge      # a parent tab and a console tab, 10 cross-app flows
```

- **What you need:** Node 22 or newer and Edge or Chrome. Nothing to install. Set `BROWSER=/path/to/chrome` if the browser is not in a standard place.
- **What they check:** every screen has a heading, no script errors, and no sideways scrolling at phone width. The flows click through real UI (claiming a case, revealing contact details, pausing AI, booking an expert, requesting deletion, and so on) and check the result on both sides.
- **Where the results go:** screenshots of every screen are saved in `tests/output/` (ignored by git). The last full run (2 Oct 2026) passed all 93 checks.

---

## Known limitations

- **Sample data is rebuilt on every load.** The parent diary lives in memory and is re-seeded, and the console's families are generated. Only the shared records described above persist, until you reset them.
- **Nothing is really sent.** Emails, Telegram/Zalo alerts, export links and expert notifications are simulated.
- **Tailwind from a CDN.** The console compiles its styles in the browser. That is fine for a prototype; production should build them (see the port plan).
- **Vietnamese only.** Both apps are in Vietnamese, and the dates use the vi-VN format.
- **Old console files.** `js/admin/charts.js`, `sections-*.js` and `main.js` are only used by `admin-v1.html`. `pricing.js` and `data.js` are shared with the new console, so keep them.

## Recommended next steps

1. `git init`, commit, and push to a branch of the EchoKid repo.
2. Follow the port order above, starting with steps 1 and 2 (data that is lost today, and safety).
3. Let parents edit or delete a child profile themselves; today it goes through a correction request.
4. Build a small offline evaluation set (around 50 anonymised entries) so that model and prompt changes can be compared before switching. The console's quality page already shows results per prompt version.
5. Test with screen readers in Vietnamese (TalkBack, VoiceOver), and with two or three parents on their own phones.

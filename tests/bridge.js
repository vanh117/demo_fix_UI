// End to end across both apps: a parent tab and a moderator tab, sharing state through js/shared/bridge.js.
'use strict';
const { launch, pageUrl, suite } = require('./lib');

async function run() {
  const browser = await launch();
  const P = await browser.tab();   // parent app
  const C = await browser.tab();   // moderator console
  const s = suite('Parent app ⇄ moderator console (two tabs)');
  const p = (x) => P.evaluate(x);
  const c = (x) => C.evaluate(x);
  try {
    await C.open(pageUrl('admin.html', '?theme=light#/alerts'));
    await c(`localStorage.clear(); true`);
    await C.reload();
    await P.open(pageUrl('index.html', '#diary.stable.light'), { width: 1280, height: 900 });

    await s.step('a note with "dap dau" opens a P1 case in the console', async () => {
      await p(`__t.set('#free-note', 'Chiều nay bé dap dau vao tuong khi bi tat tivi')`);
      await p(`__t.click('Lưu & nhận gợi ý')`);
      await P.waitText('Gợi ý cho An', 12000);
      await P.waitText('Ba mẹ nên trao đổi với bác sĩ hoặc chuyên gia');
      await C.waitText('Cảnh báo mới từ gia đình GĐ-7A3C');
      await c(`__t.click('Chưa có người nhận', 'button[aria-pressed]')`); await C.sleep(800);
      const row = await c(`[...document.querySelectorAll('tbody tr')].map((r) => r.innerText).find((t) => t.includes('GĐ-7A3C')) || ''`);
      await C.shot('bridge-console-p1');
      if (!row.includes('P1')) throw new Error('no P1 row for GĐ-7A3C: ' + row);
      return row.split('\t').slice(0, 2).join(' ').replace(/\s+/g, ' ');
    });

    await s.step('a parent booking lands in the inbox and links to the case', async () => {
      await P.open(pageUrl('index.html', '#expert.stable.light'), { width: 1280, height: 900 });
      await p(`__t.set('#bk-contact', '0901234567')`);
      await p(`__t.click('Gửi yêu cầu đặt lịch')`);
      await P.waitText('EchoKid đã nhận yêu cầu');
      await P.waitText('Yêu cầu của ba mẹ');
      await C.waitText('Yêu cầu gặp chuyên gia mới');
      await c(`location.hash = '#/bookings'; true`); await C.sleep(900);
      const row = await c(`[...document.querySelectorAll('tbody tr')].map((r) => r.innerText).find((t) => t.includes('GĐ-7A3C')) || ''`);
      if (!/từ ca CA-9/.test(row)) throw new Error('booking not linked to the case: ' + row);
      return row.split('\n')[0];
    });

    await s.step('the moderator forwards it; the parent sees the new status', async () => {
      const id = await c(`[...document.querySelectorAll('tbody tr')].find((r) => r.innerText.includes('GĐ-7A3C')).querySelector('a').textContent`);
      await c(`location.hash = '#/bookings/' + ${JSON.stringify(id)}; true`);
      await C.waitText('Chuyển cho chuyên gia');
      await c(`__t.click('Chuyển cho chuyên gia')`); await C.waitText('Gửi ngay');
      await c(`__t.click('Gửi ngay')`); await C.waitText('Đã chuyển cho chuyên gia');
      await P.waitText('Đã gửi chuyên gia');
      await P.shot('bridge-parent-request', true);
      return id;
    });

    await s.step('a live announcement shows at the top of the parent app', async () => {
      await c(`location.hash = '#/announce'; true`); await C.waitText('Thông báo mới');
      await c(`__t.click('Sự cố', 'button[aria-pressed]')`);
      await c(`__t.set('#an-title', 'Gợi ý AI chậm hơn bình thường')`);
      await c(`__t.set('#an-body', 'Gợi ý có thể mất tới 30 giây. Nhật ký của ba mẹ vẫn được lưu đầy đủ.')`);
      await c(`(() => { const d = new Date(Date.now() - 60e3), e = new Date(Date.now() + 2 * 3600e3); const f = (x) => x.toISOString().slice(0, 10) + 'T' + x.toTimeString().slice(0, 5);
        __t.set('#an-start', f(d)); __t.set('#an-end', f(e)); return true; })()`);
      await c(`__t.click('Đăng thông báo')`); await C.waitText('Thông báo đang hiện với ba mẹ');
      await P.waitText('Gợi ý AI chậm hơn bình thường');
    });

    await s.step('AI paused in the console: the diary still saves and says so', async () => {
      await c(`location.hash = '#/ai'; true`); await C.waitText('Gợi ý AI đang chạy');
      await c(`__t.click('Tạm dừng gợi ý AI')`); await C.waitText('Tạm dừng ngay');
      await c(`__t.set('#pause-reason', 'Kiểm tra lời nhắc mới')`);
      await c(`__t.click('Tạm dừng ngay')`); await C.waitText('Gợi ý AI đang tạm dừng');
      await P.open(pageUrl('index.html', '#diary.stable.light'), { width: 1280, height: 900 });
      await P.waitText('Gợi ý AI đang tạm nghỉ');
      await p(`__t.click('Lưu nhật ký')`);
      await P.waitText('Nhật ký đã được lưu.');
      await P.shot('bridge-parent-paused');
      await c(`__t.click('Bật lại')`); await C.waitText('Đã bật lại gợi ý AI');
    });

    await s.step('a 2-star rating reaches the review queue', async () => {
      await P.open(pageUrl('index.html', '#advice.stable.light'), { width: 1280, height: 900 });
      await P.waitText('Đã thực hiện');
      await p(`__t.click('Đã thực hiện')`); await P.waitText('Hoạt động diễn ra thế nào?');
      await p(`__t.click('Chưa hữu ích', 'label')`);
      await p(`document.querySelector('[aria-label="2 sao"]').click(); true`);
      await p(`__t.set('#fb-content', 'An không chịu làm theo, khóc nhiều hơn')`);
      await p(`__t.click('Gửi phản hồi')`); await P.waitText('Cảm ơn bạn đã chia sẻ');
      await C.waitText('Gợi ý bị chấm 2 sao');
      await c(`location.hash = '#/quality'; true`); await C.sleep(1000);
      const text = await c(`document.querySelector('main').innerText`);
      if (!/FB-9\d+/.test(text)) throw new Error('not in the queue');
      if (text.includes('An không chịu')) throw new Error("the child's name reached the console");
    });

    await s.step('a deletion request reaches the console; scheduling it shows on the parent side', async () => {
      await P.open(pageUrl('index.html', '#privacy.stable.light'), { width: 1280, height: 900 });
      await p(`__t.click('Tôi đồng ý với bản v2')`); await P.waitText('Ba mẹ đã đồng ý điều khoản bản v2');
      await p(`__t.click('Yêu cầu xóa tài khoản')`); await P.waitText('Xóa tài khoản EchoKid?');
      await p(`__t.click('Gửi yêu cầu xóa')`); await P.waitText('Đã gửi yêu cầu xóa');
      await C.waitText('Yêu cầu về dữ liệu mới');
      await c(`location.hash = '#/accounts'; true`); await C.waitText('Mở tài khoản');
      await c(`[...document.querySelectorAll('main li')].find((li) => li.innerText.includes('GĐ-7A3C') && li.innerText.includes('Xóa')).querySelector('button').click(); true`);
      await C.waitText('Đồng ý điều khoản');
      const consent = await c(`__t.has('v2 ·')`);
      await c(`__t.click('Xóa tài khoản')`); await C.waitText('Lên lịch xóa');
      await c(`__t.set('#ac-confirm', 'GĐ-7A3C')`);
      await c(`__t.click('Lên lịch xóa')`); await C.waitText('Đã lên lịch xóa');
      await P.waitText('Tài khoản sẽ được xóa lúc');
      await P.shot('bridge-parent-deletion');
      if (!consent) throw new Error('the console did not see the new consent');
    });

    await s.step('suspending the account locks the parent app; unlocking reopens it', async () => {
      await c(`__t.click('Hủy lịch xóa')`); await C.waitText('Đã hủy lịch xóa');
      await c(`__t.click('Tạm khóa', 'main button')`); await C.waitText('Tạm khóa GĐ-7A3C');
      await c(`__t.set('#ac-reason', 'Ba mẹ báo mất điện thoại')`);
      await c(`__t.click('Tạm khóa', '[role=dialog] button')`); await C.waitText('Đã tạm khóa');
      await P.waitText('Tài khoản đang tạm khóa');
      await c(`__t.click('Mở khóa')`); await C.waitText('Đã mở khóa tài khoản');
      await P.waitGone('Tài khoản đang tạm khóa');
    });

    await s.step('hiding an expert removes them from the parent list', async () => {
      await P.open(pageUrl('index.html', '#expert.stable.light'), { width: 1280, height: 900 });
      await P.waitText('BS. Trần Minh Khang');
      await c(`location.hash = '#/experts'; true`); await C.waitText('Chứng chỉ hành nghề');
      await c(`document.querySelector('[aria-label="Hiện BS. Trần Minh Khang với ba mẹ"]').click(); true`);
      await C.waitText('Đã ẩn BS. Trần Minh Khang');
      /* the name stays in "Yêu cầu của ba mẹ" (the earlier booking was with him); only the picker must drop it */
      const picker = () => p(`(document.querySelector('[role=radiogroup].expert-list') || {}).innerText || ''`);
      for (let i = 0; i < 40 && (await picker()).includes('Trần Minh Khang'); i++) await P.sleep(150);
      if ((await picker()).includes('Trần Minh Khang')) throw new Error('still offered to parents');
    });

    await s.step('everything the moderators did is in the audit log', async () => {
      await c(`location.hash = '#/audit'; true`); await C.sleep(1000);
      const text = await c(`document.querySelector('main').innerText`);
      const missing = ['Chuyển yêu cầu cho chuyên gia', 'Tạo thông báo cho phụ huynh', 'Tạm dừng gợi ý AI', 'Lên lịch xóa tài khoản', 'Tạm khóa tài khoản', 'Ẩn chuyên gia'].filter((n) => !text.includes(n));
      if (missing.length) throw new Error('missing: ' + missing.join(', '));
    });
  } catch (e) { s.check('run', false, e.message); }
  const failed = s.report([...P.errors.map((e) => 'parent: ' + e), ...C.errors.map((e) => 'console: ' + e)]);
  await browser.close();
  return failed;
}

module.exports = run;
if (require.main === module) run().then((f) => process.exit(f ? 1 : 0));

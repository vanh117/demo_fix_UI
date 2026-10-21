// Moderator console: every page renders (light desktop, dark phone) and the main flows work.
'use strict';
const { launch, pageUrl, suite } = require('./lib');

const PAGES = ['overview', 'hours', 'cost', 'forecast', 'alerts', 'bookings', 'experts', 'accounts', 'ai', 'quality', 'system', 'announce', 'team', 'audit'];

async function run() {
  const browser = await launch();
  const t = await browser.tab();
  const s = suite('Moderator console (admin.html)');
  const E = (x) => t.evaluate(x);
  try {
    await t.open(pageUrl('admin.html', '?theme=light#/overview'));
    await E(`localStorage.clear(); true`);

    for (const [theme, width] of [['light', 1440], ['dark', 390]]) {
      await t.open(pageUrl('admin.html', `?theme=${theme}#/overview`), { width, height: 1000 });
      for (const p of PAGES) {
        await s.step(`${p} renders · ${theme} ${width}px`, async () => {
          await E(`location.hash = '#/${p}'; true`);
          await t.sleep(1200);
          const info = await E(`({ h1: (document.querySelector('main h1') || {}).textContent, overflow: __t.overflow(), err: __t.scriptError() })`);
          await t.shot(`console-${theme}-${width}-${p}`, true);
          if (!info.h1) throw new Error('no page heading');
          if (info.err) throw new Error(info.err);
          if (info.overflow > 0) throw new Error(`page scrolls sideways by ${info.overflow}px`);
          return info.h1;
        });
      }
    }

    await t.open(pageUrl('admin.html', '?theme=light#/alerts'));
    await s.step('claim an unassigned case', async () => {
      await E(`__t.click('Chưa có người nhận', 'button[aria-pressed]')`); await t.sleep(900);
      const id = await E(`document.querySelector('tbody tr a').textContent`);
      await E(`location.hash = '#/alerts/' + ${JSON.stringify(id)}; true`);
      await t.waitText('Nhận xử lý');
      await E(`__t.click('Nhận xử lý')`); await t.waitText('Bạn đã nhận ca'); await t.sleep(900);
      if (!(await E(`document.querySelector('[role=dialog]').innerText.includes('Đang xử lý')`))) throw new Error('status did not change');
      return id;
    });
    await s.step('contact details need a reason, then show for 10 minutes', async () => {
      await E(`__t.click('Xem liên hệ (cần ghi lý do)')`); await t.waitText('Hiện trong 10 phút');
      await E(`__t.click('Hiện trong 10 phút')`); await t.waitText('Ghi rõ hơn lý do');
      await E(`__t.set('#rv-detail', 'Gọi hỏi tình trạng của bé sau cảnh báo chiều nay')`);
      await E(`__t.click('Hiện trong 10 phút')`); await t.waitText('Tự ẩn lại sau');
    });
    await s.step('note, then close the case', async () => {
      await E(`__t.set('[aria-label="Ghi chú cho ca"]', 'Đã gọi, bé ổn, hẹn hỏi lại sau 3 ngày.')`);
      await E(`__t.click('Lưu ghi chú')`); await t.waitText('Đã thêm ghi chú');
      await E(`__t.click('Đóng ca', '[role=dialog] footer button')`); await t.waitText('Kết quả giúp nhóm');
      await E(`document.querySelector('button[form=close-form]').click(); true`); await t.waitText('Đã đóng ca'); await t.sleep(600);
      if (!(await E(`document.querySelector('[role=dialog]').innerText.includes('Mở lại ca')`))) throw new Error('case not closed');
      await E(`location.hash = '#/alerts'; true`);
    });
    await s.step('forward a booking to the expert', async () => {
      await E(`location.hash = '#/bookings'; true`); await t.sleep(1000);
      const id = await E(`document.querySelector('tbody tr a').textContent`);
      await E(`location.hash = '#/bookings/' + ${JSON.stringify(id)}; true`);
      await t.waitText('Ba mẹ đã đồng ý chia sẻ');
      await E(`__t.click('Chuyển cho chuyên gia')`); await t.waitText('Gửi ngay');
      await E(`__t.click('Gửi ngay')`); await t.waitText('Đã chuyển cho chuyên gia');
      await E(`location.hash = '#/bookings'; true`);
      return id;
    });
    await s.step('pause and resume AI; the banner shows', async () => {
      await E(`location.hash = '#/ai'; true`); await t.waitText('Gợi ý AI đang chạy');
      await E(`__t.click('Tạm dừng gợi ý AI')`); await t.waitText('Tạm dừng ngay');
      await E(`__t.set('#pause-reason', 'Gemini trả JSON sai hàng loạt')`);
      await E(`__t.click('Tạm dừng ngay')`); await t.waitText('Gợi ý AI đang tạm dừng'); await t.sleep(500);
      if (!(await E(`!!document.querySelector('[role=status].bg-warn-tint')`))) throw new Error('no pause banner');
      await E(`__t.click('Bật lại')`); await t.waitText('Đã bật lại gợi ý AI');
    });
    await s.step('change the budget through the save bar', async () => {
      await E(`__t.set('#ai-budget', '4')`); await t.waitText('thay đổi chưa lưu');
      await E(`__t.click('Lưu thay đổi')`); await t.waitText('Đã lưu cài đặt AI'); await t.waitGone('thay đổi chưa lưu');
    });
    await s.step('account lookup and scheduled delete', async () => {
      await E(`location.hash = '#/accounts'; true`); await t.waitText('Mở tài khoản');
      await E(`__t.click('Mở tài khoản')`); await t.waitText('Đồng ý điều khoản');
      await E(`__t.click('Xóa tài khoản')`); await t.waitText('Lên lịch xóa');
      if (!(await E(`__t.byText('Lên lịch xóa', 'button').disabled`))) throw new Error('delete was not locked before typing the code');
      await E(`__t.set('#ac-confirm', document.querySelector('main section p.text-lg').textContent)`);
      await E(`__t.click('Lên lịch xóa')`); await t.waitText('Đã lên lịch xóa');
    });
    await s.step('re-verify an expert', async () => {
      await E(`location.hash = '#/experts'; true`); await t.waitText('quá 12 tháng');
      await E(`__t.click('Xác minh lại')`); await t.waitText('Tôi vừa kiểm tra lại');
      await E(`__t.click('Tôi vừa kiểm tra lại', 'label')`);
      await E(`__t.click('Lưu thay đổi')`); await t.waitText('Đã lưu thông tin chuyên gia'); await t.waitGone('quá 12 tháng chưa xác minh lại');
    });
    await s.step('invite a team member', async () => {
      await E(`location.hash = '#/team'; true`); await t.waitText('Mời thành viên');
      await E(`__t.set('#tm-email', 'thu.ngan@echokid.example')`);
      await E(`__t.click('Gửi lời mời')`); await t.waitText('Đã gửi lời mời');
    });
    await s.step('the audit log recorded all of it', async () => {
      await E(`location.hash = '#/audit'; true`); await t.sleep(1200);
      const text = await E(`document.querySelector('main').innerText`);
      const missing = ['Xem liên hệ gia đình', 'Đóng ca', 'Tạm dừng gợi ý AI', 'Đổi cài đặt AI', 'Lên lịch xóa tài khoản', 'Xác minh chuyên gia', 'Mời thành viên', 'Chuyển yêu cầu cho chuyên gia'].filter((n) => !text.includes(n));
      if (missing.length) throw new Error('missing: ' + missing.join(', '));
    });
    await s.step('Ctrl+K finds cases', async () => {
      await E(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })); true`); await t.sleep(300);
      await E(`__t.set('input[role=combobox]', 'CA-2')`); await t.sleep(900);
      const n = await E(`document.querySelectorAll('#palette-list [role=option]').length`);
      await E(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true`);
      if (!n) throw new Error('no results');
      return `${n} results`;
    });
    await s.step('an expired session keeps the page under the sign-in dialog', async () => {
      await E(`location.hash = '#/overview'; true`); await t.sleep(900);
      await E(`__t.click('Giả lập phiên hết hạn')`); await t.waitText('Phiên đăng nhập đã hết hạn');
      if (!(await E(`!!document.querySelector('main h1')`))) throw new Error('page was lost');
      await E(`__t.click('Đăng nhập lại bằng Google')`); await t.waitGone('Phiên đăng nhập đã hết hạn');
    });
    await s.step('analytics role is limited on the server side', async () => {
      await E(`__t.set('select[aria-label="Đăng nhập thử với"]', 'm-4')`); await t.sleep(1300);
      await E(`location.hash = '#/alerts'; true`); await t.sleep(900);
      if (!(await E(`__t.has('không mở được')`))) throw new Error('alerts page was not blocked');
    });
    await s.step('someone outside the team is turned away', async () => {
      await E(`__t.set('select[aria-label="Đăng nhập thử với"]', 'outsider')`); await t.sleep(1300);
      if (!(await E(`__t.has('không có quyền vào trang điều hành')`))) throw new Error('no access-denied screen');
    });
  } catch (e) { s.check('run', false, e.message); }
  const failed = s.report(t.errors);
  await browser.close();
  return failed;
}

module.exports = run;
if (require.main === module) run().then((f) => process.exit(f ? 1 : 0));

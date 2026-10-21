/* Login page (app/login/page.tsx). */
'use strict';

/* ---------- Login (app/login/page.tsx) ---------- */
function LoginPage() {
  const { route, session, signIn, navigate, startApp } = useApp();
  const [status, setStatus] = useState('idle');
  const callback = route.params.callbackUrl;
  useEffect(() => {
    if (!session) return;
    if (callback) navigate(callback.path, callback.params, { replace: true });
    else startApp();
  }, [session]);
  function login() { setStatus('loading'); setTimeout(signIn, 650); }
  return html`<main className="container login page">
    <div className="login__card">
      <${Hands} />
      <span className="brand login__brand"><${Brand} /></span>
      <h1>Chào mừng ba mẹ</h1>
      <p>Đăng nhập để mở nhật ký của gia đình. Mỗi bé có không gian riêng và chỉ ba mẹ xem được.</p>
      <div className="login__actions">
        <${Btn} size="lg" block onClick=${login} disabled=${status === 'loading'}>${status === 'loading' ? 'Đang kiểm tra...' : 'Đăng nhập bằng Google'}<//>
        <${LinkBtn} to="/" variant="quiet" block>Về trang chủ<//>
      </div>
      <ul className="login__list" aria-label="Sau khi đăng nhập">
        <li><${Icon} name="check" />Ghi nhận hành vi nhanh chỉ bằng biểu tượng</li>
        <li><${Icon} name="check" />Được nhắc khi có thay đổi bất thường trong ngày</li>
        <li><${Icon} name="check" />Gợi ý hoạt động ngắn kèm lý do và nguồn tham khảo</li>
        <li><${Icon} name="check" />Theo dõi tiến trình theo ngày, tuần và tháng</li>
      </ul>
      <p className="privacy"><${Icon} name="lock" />Nhật ký của con chỉ hiển thị với tài khoản của ba mẹ.</p>
    </div>
  </main>`;
}

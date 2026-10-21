/* Landing page (app/page.tsx). */
'use strict';

/* ---------- Landing (app/page.tsx) ---------- */
const LANDING_SAMPLES = {
  happy: { title: 'Chơi luân phiên: xếp tháp khối', minutes: 10, body: 'Con đang vui, đây là lúc tốt để luyện chờ lượt và giao tiếp mắt. Mỗi người đặt một khối, dừng một nhịp để con ra hiệu.' },
  calm: { title: 'Đọc truyện tranh cùng nhau', minutes: 10, body: 'Con đang thư thái. Chỉ vào hình, gọi tên và hỏi câu lựa chọn: "Con mèo hay con chó?"' },
  irritable: { title: 'Góc bình yên 10 phút', minutes: 10, body: 'Giảm đèn và tiếng ồn, đưa con món đồ quen thuộc để ôm, rồi cùng thở chậm 5 lần.' },
  anxious: { title: 'Lịch trình bằng hình ảnh', minutes: 15, body: 'Xếp 3–4 thẻ hình cho các việc sắp tới để con biết trước điều gì sẽ diễn ra.' },
  withdrawn: { title: 'Chơi song song', minutes: 10, body: 'Ngồi cạnh con, chơi cùng món đồ con thích và bắt chước con. Không ép con nhìn hay trả lời.' },
};

function LandingPage() {
  const { navigate, session, startApp } = useApp();
  const [mood, setMood] = useState('anxious');
  const sample = LANDING_SAMPLES[mood];
  const scrollTo = (id) => (e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const start = () => (session ? startApp() : navigate('/login'));
  return html`<div className="landing page">
    <header className="container site-nav">
      <a href="#home" className="brand" aria-label="EchoKid" onClick=${(e) => e.preventDefault()}><${Brand} /></a>
      <nav className="site-nav__links" aria-label="Trang giới thiệu">
        <a className="btn btn--quiet btn--sm site-nav__how" href="#how" onClick=${scrollTo('how')}>Cách hoạt động</a>
        <${Btn} variant="secondary" size="sm" onClick=${start}>${session ? 'Mở nhật ký' : 'Đăng nhập'}<//>
      </nav>
    </header>
    <main>
      <section className="container hero">
        <div>
          <p className="eyebrow">Nhật ký cho ba mẹ có con trong phổ tự kỷ</p>
          <h1>Ghi lại ngày của con. <span>Biết nên làm gì tiếp theo.</span></h1>
          <p className="hero__lead">Chỉ khoảng một phút để ghi cảm xúc, giấc ngủ và những cơn meltdown của con. EchoKid gợi ý một hoạt động phù hợp ngay lúc đó và nhắc ba mẹ khi đã đến lúc gặp chuyên gia.</p>
          <div className="hero__actions">
            <${Btn} size="lg" onClick=${start}>${session ? 'Mở nhật ký' : 'Bắt đầu với Google'}<${Icon} name="arrowRight" /><//>
            <a className="btn btn--quiet btn--lg" href="#how" onClick=${scrollTo('how')}>Xem cách hoạt động</a>
          </div>
          <ul className="hero__trust">
            <li><${Icon} name="lock" />Chỉ ba mẹ xem được nhật ký của con</li>
            <li><${Icon} name="shield" />Không thay thế chẩn đoán của bác sĩ</li>
          </ul>
        </div>
        <div className="hero__demo">
          <${Hands} />
          <div className="try-card">
            <div className="try-card__top"><p className="try-card__q">Bây giờ con thế nào?</p><span className="pill pill--teal">Thử ngay</span></div>
            <div className="try-faces" role="radiogroup" aria-label="Chọn cảm xúc của con">
              ${MOODS.map((m) => html`<button key=${m.value} type="button" role="radio" aria-checked=${mood === m.value} className="try-face" onClick=${() => setMood(m.value)}>
                <${Face} mood=${m.value} size=${48} />${m.label}</button>`)}
            </div>
            <div className="try-result" aria-live="polite">
              <span className="kicker kicker--teal"><${Icon} name="sparkle" />Ví dụ việc nên làm ngay</span>
              <h3>${sample.title}</h3>
              <p>${sample.body}</p>
              <p className="try-result__meta"><${Icon} name="timer" />${sample.minutes} phút · làm được ngay tại nhà</p>
            </div>
            <p className="try-card__foot">Trong ứng dụng, gợi ý dựa trên nhật ký thật của con và 30 ngày gần nhất.</p>
          </div>
        </div>
      </section>

      <div className="band" id="how">
        <section className="container l-section">
          <div className="l-section__head">
            <h2>Ba bước, mỗi ngày</h2>
            <p>Thiết kế cho những ngày bận rộn nhất: ít chữ, chạm là xong, việc cần làm luôn nằm ở trên cùng.</p>
          </div>
          <ol className="how">
            <li className="how__step">
              <span className="how__num">1</span>
              <h3>Ghi nhật ký trong một phút</h3>
              <p>Chạm vào gương mặt cảm xúc, thêm giấc ngủ, ăn uống, meltdown và vài dòng ghi chú. Ghi bao nhiêu lần trong ngày cũng được.</p>
              <div className="how__faces" aria-hidden="true">${MOODS.map((m) => html`<${Face} key=${m.value} mood=${m.value} size=${30} />`)}</div>
            </li>
            <li className="how__step">
              <span className="how__num">2</span>
              <h3>Nhận việc nên làm ngay</h3>
              <p>EchoKid đọc lần ghi mới cùng 30 ngày gần nhất, rồi gợi ý một hoạt động 5–30 phút với từng bước, lý do chọn và nguồn tham khảo.</p>
            </li>
            <li className="how__step">
              <span className="how__num">3</span>
              <h3>Kết nối chuyên gia khi cần</h3>
              <p>Khi có dấu hiệu đáng lo, ba mẹ được nhắc đặt lịch với bác sĩ hoặc chuyên gia, kèm bản tóm tắt 30 ngày để mang theo.</p>
            </li>
          </ol>
        </section>
      </div>

      <section className="container l-section">
        <div className="alerts-explain">
          <div className="l-section__head">
            <h2>Khi nào EchoKid nhắc ba mẹ gặp chuyên gia?</h2>
            <p>EchoKid không chẩn đoán. Ứng dụng để ý những dấu hiệu lặp lại và luôn nói rõ lý do mỗi khi đưa ra cảnh báo.</p>
            <ul className="reasons">
              <li><span className="reasons__icon"><${Icon} name="refresh" /></span><p>Ba lần ghi gần nhất đều có dấu hiệu khó khăn: cảm xúc tiêu cực, meltdown, ít tương tác hoặc khó tập trung.</p></li>
              <li><span className="reasons__icon"><${Icon} name="trendUp" /></span><p>Cảm xúc của con đổi qua lại nhiều lần trong cùng một ngày.</p></li>
              <li><span className="reasons__icon"><${Icon} name="alert" /></span><p>Ghi chú cho thấy con có nguy cơ tự làm đau mình hoặc gặp nguy hiểm.</p></li>
            </ul>
          </div>
          <div>
            <p className="sample-label">Ví dụ cảnh báo trong ứng dụng</p>
            <section className="alert alert--crit" aria-label="Ví dụ cảnh báo">
              <div className="alert__top">
                <span className="alert__icon"><${Icon} name="alert" /></span>
                <div className="alert__body">
                  <p className="alert__eyebrow">Cần chú ý</p>
                  <h3 className="alert__title">Ba mẹ nên trao đổi với bác sĩ hoặc chuyên gia</h3>
                  <p className="alert__msg">Ba lần ghi nhận gần nhất liên tục có dấu hiệu ở mức thấp hoặc cần hỗ trợ.</p>
                </div>
              </div>
              <div className="alert__actions">
                <span className="btn btn--danger" aria-hidden="true"><${Icon} name="steth" />Đặt lịch với chuyên gia</span>
                <span className="btn btn--secondary" aria-hidden="true"><${Icon} name="file" />Xem bản tóm tắt</span>
              </div>
            </section>
          </div>
        </div>
      </section>

      <div className="band">
        <section className="container l-section">
          <div className="l-section__head"><h2>Những gì ba mẹ nhận được</h2></div>
          <div className="features">
            <article className="feature"><span className="feature__icon"><${Icon} name="calendar" /></span><h3>Nhịp của con theo ngày, tuần, tháng</h3><p>Cảm xúc, giấc ngủ và meltdown được tóm lại bằng một câu dễ hiểu, kèm biểu đồ khi cần xem kỹ.</p></article>
            <article className="feature"><span className="feature__icon"><${Icon} name="users" /></span><h3>Mỗi bé một hồ sơ riêng</h3><p>Nhà có nhiều bé vẫn gọn gàng: nhật ký, gợi ý và lịch sử được tách riêng cho từng bé.</p></article>
            <article className="feature"><span className="feature__icon"><${Icon} name="star" /></span><h3>Gợi ý ngày càng sát với con</h3><p>Sau mỗi hoạt động, ba mẹ cho biết kết quả để lần gợi ý sau phù hợp hơn.</p></article>
            <article className="feature"><span className="feature__icon"><${Icon} name="file" /></span><h3>Bản tóm tắt cho buổi khám</h3><p>30 ngày nhật ký gói gọn trong một trang để chuyên gia nắm nhanh tình hình của con.</p></article>
          </div>
        </section>
      </div>

      <section className="container l-section">
        <div className="cta-band">
          <${Hands} />
          <div><h2>Bắt đầu trang nhật ký đầu tiên hôm nay</h2><p>Đăng nhập bằng Google, tạo hồ sơ cho bé và ghi lần đầu trong vài phút.</p></div>
          <${Btn} size="lg" onClick=${start}>${session ? 'Mở nhật ký' : 'Bắt đầu với Google'}<${Icon} name="arrowRight" /><//>
        </div>
      </section>
    </main>
    <footer className="container site-footer">
      <p><strong>EchoKid</strong> hỗ trợ ba mẹ quan sát và đồng hành cùng con. EchoKid không thay thế chẩn đoán hoặc điều trị y khoa.</p>
      <p>Nếu con đang gặp nguy hiểm, hãy gọi cấp cứu 115.</p>
    </footer>
  </div>`;
}

document.addEventListener("DOMContentLoaded", () => {

  if (localStorage.getItem("anubis_welcome")) return;

  const html = `
<div class="welcome-overlay show" id="welcomeOverlay">
  <div class="welcome-box">

    <img src="favicon.png" alt="ANUBIS APP LIBRARY" style="width:90px;height:90px;border-radius:50%;margin-bottom:15px;">

    <h2>👋 Welcome | مرحبًا بك</h2>

    <p>
      <b>ANUBIS APP LIBRARY</b><br><br>

      Your destination for the best entertainment apps for:

      <br><br>

      Android TV
      <br>
      Google TV

      <br><br>

      📺 New apps are added regularly.
      <br>
      🚀 Stay tuned for the latest updates.

      <br><br>

      <div id="welcomeCountdown" style="margin-top:15px;font-size:14px;opacity:.8;">
        ⏳ Entering in <span id="countdown">10</span>...
      </div>

      <br><br>

      ━━━━━━━━━━━━━━━━━━━━

      <br><br>

      وجهتك لأفضل التطبيقات الترفيهية لـ

      <br><br>

      Android TV
      <br>
      Google TV

      <br><br>

      📺 يتم إضافة تطبيقات جديدة باستمرار.
      <br>
      🚀 تابع آخر التحديثات أولًا بأول.
    </p>

    <button class="welcome-btn" id="welcomeClose">
      🚀 Start Browsing
    </button>

  </div>
</div>
`;

  document.body.insertAdjacentHTML("beforeend", html);

  let seconds = 10;

  const countdown = document.getElementById("countdown");

  const timer = setInterval(() => {
    seconds--;
    countdown.textContent = seconds;

    if (seconds <= 0) {
      clearInterval(timer);

      const overlay = document.getElementById("welcomeOverlay");
      if (overlay) overlay.remove();

      localStorage.setItem("anubis_welcome", "1");
    }
  }, 1000);

  document.getElementById("welcomeClose").onclick = () => {
    clearInterval(timer);

    const overlay = document.getElementById("welcomeOverlay");
    if (overlay) overlay.remove();

    localStorage.setItem("anubis_welcome", "1");
  };

});

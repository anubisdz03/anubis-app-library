document.addEventListener("DOMContentLoaded", () => {
  const TUTORIAL_CONFIG_URL =
    "https://raw.githubusercontent.com/anubisdz03/anubis-app-library/main/tutorial.json";
  const WELCOME_KEY = "anubis_welcome";
  const TUTORIAL_SEEN_KEY = "anubis_tutorial_seen_version";

  let tutorialConfig = null;
  let welcomeOverlay = null;
  let welcomeTimer = null;
  let pendingSkipBeforeConfig = false;
  let welcomeCountdownFinished = false;

  function getSeenVersion() {
    const value = Number.parseInt(
      localStorage.getItem(TUTORIAL_SEEN_KEY) || "0",
      10
    );
    return Number.isFinite(value) ? value : 0;
  }

  function isTutorialPending() {
    return Boolean(
      tutorialConfig &&
      tutorialConfig.enabled &&
      tutorialConfig.version > getSeenVersion()
    );
  }

  function markTutorialSeen(version) {
    if (Number.isInteger(version) && version > 0) {
      localStorage.setItem(TUTORIAL_SEEN_KEY, String(version));
    }
  }

  function closeWelcome(markAsSkipped) {
    if (welcomeTimer) {
      clearInterval(welcomeTimer);
      welcomeTimer = null;
    }

    if (markAsSkipped) {
      if (tutorialConfig && tutorialConfig.enabled) {
        markTutorialSeen(tutorialConfig.version);
      } else {
        pendingSkipBeforeConfig = true;
      }
    }

    localStorage.setItem(WELCOME_KEY, "1");

    if (welcomeOverlay) {
      welcomeOverlay.remove();
      welcomeOverlay = null;
    }
  }

  function openTutorialPlayer(config) {
    if (!config || !config.enabled) return;

    const overlay = document.createElement("div");
    overlay.className = "tutorial-player-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Tutorial video");

    const panel = document.createElement("div");
    panel.className = "tutorial-player-panel";

    const header = document.createElement("div");
    header.className = "tutorial-player-header";

    const title = document.createElement("strong");
    title.textContent = "شاهد الفيديو لطريقة تحميل التطبيقات";

    const closeButton = document.createElement("button");
    closeButton.className = "tutorial-player-close";
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "إغلاق الفيديو");
    closeButton.textContent = "×";

    const media = document.createElement("div");
    media.className = "tutorial-player-media";

    const video = document.createElement("video");
    video.className = "tutorial-player-video";
    video.controls = true;
    video.autoplay = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.src = config.video_url;

    const message = document.createElement("p");
    message.className = "tutorial-player-message";
    message.textContent = "جارٍ تحميل الفيديو...";

    header.append(title, closeButton);
    media.append(video);
    panel.append(header, media, message);
    overlay.append(panel);
    document.body.append(overlay);

    let finished = false;

    function closePlayer(markAsSeen) {
      if (finished) return;
      finished = true;

      if (markAsSeen) {
        markTutorialSeen(config.version);
      }

      video.pause();
      video.removeAttribute("src");
      video.load();
      overlay.remove();
      document.removeEventListener("keydown", onKeyDown);
    }

    function onKeyDown(event) {
      if (event.key === "Escape") {
        closePlayer(true);
      }
    }

    closeButton.addEventListener("click", () => closePlayer(true));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closePlayer(true);
    });

    video.addEventListener("loadeddata", () => {
      message.textContent = "";
    });

    video.addEventListener("ended", () => closePlayer(true));

    video.addEventListener("error", () => {
      message.textContent =
        "تعذر تشغيل الفيديو. تحقق من اتصال الإنترنت ثم حاول مجدداً.";
    });

    document.addEventListener("keydown", onKeyDown);

    const playAttempt = video.play();
    if (playAttempt && typeof playAttempt.catch === "function") {
      playAttempt.catch(() => {
        message.textContent = "اضغط تشغيل لبدء مشاهدة الفيديو.";
      });
    }
  }

  function updateSkipButton() {
    if (!welcomeOverlay || !welcomeCountdownFinished) return;

    const closeButton = welcomeOverlay.querySelector("#welcomeClose");
    const countdownLabel = welcomeOverlay.querySelector("#welcomeCountdown");

    if (closeButton) {
      closeButton.disabled = false;
      closeButton.textContent = isTutorialPending()
        ? "تخطي ومتابعة"
        : "🚀 Start Browsing";
    }

    if (countdownLabel) {
      countdownLabel.textContent = isTutorialPending()
        ? "يمكنك الآن مشاهدة الفيديو أو التخطي"
        : "يمكنك الآن الدخول إلى المكتبة";
    }
  }

  function showTutorialNotice() {
    if (!welcomeOverlay || !tutorialConfig || !isTutorialPending()) return;

    const notice = welcomeOverlay.querySelector("#welcomeTutorial");
    const watchButton = welcomeOverlay.querySelector("#welcomeWatch");

    if (!notice || !watchButton) return;

    notice.hidden = false;
    updateSkipButton();

    if (watchButton.dataset.bound === "1") return;
    watchButton.dataset.bound = "1";

    watchButton.addEventListener("click", () => {
      closeWelcome(false);
      openTutorialPlayer(tutorialConfig);
    });
  }

  function showWelcome() {
    if (welcomeOverlay && welcomeOverlay.isConnected) return;

    welcomeCountdownFinished = false;

    const html =
      '<div class="welcome-overlay show" id="welcomeOverlay">' +
        '<div class="welcome-box">' +
          '<img src="favicon.png" alt="ANUBIS APP LIBRARY" ' +
            'style="width:90px;height:90px;border-radius:50%;margin-bottom:15px;">' +
          '<h2>👋 Welcome | مرحبًا بك</h2>' +
          '<div class="welcome-tutorial" id="welcomeTutorial" hidden>' +
            '<div class="welcome-tutorial-text" dir="rtl">' +
              '🎬 شاهد الفيديو لطريقة تحميل التطبيقات' +
            '</div>' +
            '<button class="welcome-watch-btn" id="welcomeWatch" type="button">' +
              '▶ مشاهدة الفيديو الآن' +
            '</button>' +
          '</div>' +
          '<div class="welcome-countdown" id="welcomeCountdown" ' +
            'aria-live="polite" dir="rtl">' +
            '⏳ يمكنك التخطي بعد <span id="countdown">10</span> ثوانٍ' +
          '</div>' +
          '<p>' +
            '<b>ANUBIS APP LIBRARY</b>' +
            '<br><br>' +
            'Your destination for the best entertainment apps for:' +
            '<br><br>' +
            'Android TV<br>Google TV' +
            '<br><br>' +
            '📺 New apps are added regularly.' +
            '<br><br>' +
            '🚀 Stay tuned for the latest updates.' +
            '<br><br>' +
            '━━━━━━━━━━━━━━━━━━━━' +
            '<br><br>' +
            'وجهتك لأفضل التطبيقات الترفيهية:' +
            '<br><br>' +
            'Android TV<br>Google TV' +
            '<br><br>' +
            '📺 يتم إضافة تطبيقات جديدة باستمرار.' +
            '<br><br>' +
            '🚀 تابع آخر التحديثات أولًا بأول.' +
          '</p>' +
          '<button class="welcome-btn" id="welcomeClose" type="button" disabled>' +
            'يمكنك التخطي بعد 10 ثوانٍ' +
          '</button>' +
        '</div>' +
      '</div>';

    const holder = document.createElement("div");
    holder.innerHTML = html;
    welcomeOverlay = holder.firstElementChild;
    document.body.append(welcomeOverlay);

    const closeButton = welcomeOverlay.querySelector("#welcomeClose");

    closeButton.addEventListener("click", () => {
      if (welcomeCountdownFinished) {
        closeWelcome(true);
      }
    });

    let seconds = 10;

    welcomeTimer = setInterval(() => {
      seconds -= 1;

      const countdown = welcomeOverlay &&
        welcomeOverlay.querySelector("#countdown");

      if (countdown) {
        countdown.textContent = String(Math.max(seconds, 0));
      }

      if (seconds <= 0) {
        clearInterval(welcomeTimer);
        welcomeTimer = null;
        welcomeCountdownFinished = true;
        updateSkipButton();
      }
    }, 1000);

    showTutorialNotice();
  }

  function addReplayButton() {
    if (document.getElementById("tutorialReplayButton")) return;

    const button = document.createElement("button");
    button.id = "tutorialReplayButton";
    button.className = "tutorial-replay-btn";
    button.type = "button";
    button.textContent = "🎬 مشاهدة الفيديو";

    button.addEventListener("click", () => {
      openTutorialPlayer(tutorialConfig);
    });

    document.body.append(button);
  }

  async function fetchTutorialConfig() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(TUTORIAL_CONFIG_URL, {
        cache: "no-store",
        signal: controller.signal
      });

      if (!response.ok) return null;

      const data = await response.json();
      const version = Number(data.tutorial_version);
      const videoUrl = new URL(data.video_url);

      if (
        data.enabled !== true ||
        !Number.isInteger(version) ||
        version < 1 ||
        videoUrl.protocol !== "https:" ||
        videoUrl.hostname !== "raw.githubusercontent.com" ||
        !videoUrl.pathname.toLowerCase().endsWith(".mp4")
      ) {
        return null;
      }

      return {
        version,
        video_url: videoUrl.href,
        enabled: true
      };
    } catch (error) {
      console.warn("Tutorial configuration unavailable:", error);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  // Preserve the original welcome content and countdown, with a visible skip control.
  if (localStorage.getItem(WELCOME_KEY) !== "1") {
    showWelcome();
  }

  // Tutorial configuration is independent of the app/update system.
  fetchTutorialConfig().then((config) => {
    if (!config) return;

    tutorialConfig = config;
    addReplayButton();

    if (pendingSkipBeforeConfig) {
      markTutorialSeen(config.version);
      pendingSkipBeforeConfig = false;
    }

    if (welcomeOverlay && welcomeOverlay.isConnected) {
      showTutorialNotice();
      updateSkipButton();
      return;
    }

    if (isTutorialPending()) {
      showWelcome();
      showTutorialNotice();
    }
  });
});
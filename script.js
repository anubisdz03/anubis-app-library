/* ============================================================
   ANUBIS APP LIBRARY — main script
   Loads app data from apps.json, renders cards, handles search,
   the app details modal, the support popup, and the animated
   galaxy background. Vanilla JS, no dependencies, no build step.
============================================================ */

(function () {
  'use strict';

  /* ============================================================
     MODAL FIELD CONFIG — which keys trigger a modal & how to label them
  ============================================================ */
  const MODAL_TRIGGER_KEYS = ['code', 'username', 'password', 'activated', 'category', 'version', 'size', 'developer', 'updated', 'player_code'];

  function appHasModalFields(app) {
    return MODAL_TRIGGER_KEYS.some(key => app[key] !== undefined && app[key] !== null && app[key] !== '');
  }

  /* ============================================================
     COMING SOON HELPER — an app is "Coming Soon" only when its
     url is exactly "#" or an empty string.
  ============================================================ */
  function isComingSoon(app) {
    return app.url === '#' || app.url === '';
  }

  /* ============================================================
     EXPLAINER VIDEO HELPER — an app has an optional "video" field
     in apps.json. When present (non-empty string), the app modal
     shows a "⚠️ Watch video before installing" button that opens
     the video in an in-site HTML5 <video> modal (not YouTube).
     This never affects card click behavior — only openAppModal().
  ============================================================ */
  function appHasVideo(app) {
    return typeof app.video === 'string' && app.video.trim() !== '';
  }

  /* ============================================================
     RECENT UPDATE HELPER — true when app.updated is within the
     last 7 calendar days (including today).
     Supports:
       - "DD Mon YYYY"
       - "YYYY-MM-DD"
  ============================================================ */
  const MONTH_MAP = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };

  function parseAppUpdatedDate(app) {
    if (!app || !app.updated) return null;

    const raw = String(app.updated).trim();
    let day, month, year;

    let match = /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/.exec(raw);

    if (match) {
      day = Number(match[1]);
      month = MONTH_MAP[match[2].toLowerCase()];
      year = Number(match[3]);

      if (month === undefined) return null;
    } else {
      match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);

      if (!match) return null;

      year = Number(match[1]);
      month = Number(match[2]) - 1;
      day = Number(match[3]);
    }

    const d = new Date(year, month, day);

    if (
      isNaN(d.getTime()) ||
      d.getFullYear() !== year ||
      d.getMonth() !== month ||
      d.getDate() !== day
    ) {
      return null;
    }

    d.setHours(0, 0, 0, 0);

    return d;
  }

  function getUpdateAgeDays(app) {
    const updatedDate = parseAppUpdatedDate(app);

    if (!updatedDate) return null;

    const now = new Date();

    now.setHours(0, 0, 0, 0);

    return Math.floor(
      (now.getTime() - updatedDate.getTime()) / 86400000
    );
  }

  function isRecentUpdate(app) {
    const ageDays = getUpdateAgeDays(app);

    return (
      ageDays !== null &&
      ageDays >= 0 &&
      ageDays <= 7
    );
  }

  function isUpdatedToday(app) {
    return getUpdateAgeDays(app) === 0;
  }

  function sortByUpdatedDesc(list) {
    return list
      .map((app, index) => ({
        app,
        index,
        date: parseAppUpdatedDate(app)
      }))
      .sort((a, b) => {

        if (a.date && b.date) {
          const diff =
            b.date.getTime() -
            a.date.getTime();

          if (diff !== 0) {
            return diff;
          }

        } else if (a.date && !b.date) {
          return -1;

        } else if (!a.date && b.date) {
          return 1;
        }

        return a.index - b.index;
      })
      .map(item => item.app);
  }

  /* ============================================================
     CARD RENDERER
  ============================================================ */
  function createCard(app) {

    const hasModal =
      appHasModalFields(app) ||
      isComingSoon(app);

    const cardComingSoon =
      isComingSoon(app);

    const updatedToday =
      isUpdatedToday(app);

    let el;

    if (hasModal) {

      el = document.createElement('div');

      el.setAttribute(
        'role',
        'button'
      );

      el.setAttribute(
        'tabindex',
        '0'
      );

    } else {

      el = document.createElement('a');

      el.href = app.url;

      el.target = '_blank';

      el.rel =
        'noopener noreferrer';
    }

    el.className = 'app-card';

    el.setAttribute(
      'aria-label',
      `Open ${app.name}`
    );

    const badgeMarkup = cardComingSoon

      ? `<span class="card-badge" style="position:relative; z-index:1; background:linear-gradient(135deg,#a855f7,#7c3aed); color:#fff; border-color:transparent;">🚧 Coming Soon</span>`

      : `<span class="card-badge badge-${app.badge}" style="position:relative; z-index:1;">${
          app.badge === 'live'   ? 'Live'    :
          app.badge === 'new'    ? 'New'     :
          app.badge === 'update' ? 'Updated' :
          'Hot'
        }</span>`;

    el.innerHTML = `
      ${
        cardComingSoon
          ? `<div style="position:absolute; inset:0; background:rgba(8,6,18,0.15); border-radius:inherit; pointer-events:none; z-index:0;"></div>`
          : ''
      }

      ${
        updatedToday
          ? `<span class="card-updated-today-badge" style="position:absolute; top:8px; right:8px; z-index:3;">UPDATED TODAY</span>`
          : ''
      }

      <div class="card-icon" style="background:${app.bg};${
        cardComingSoon
          ? ' position:relative; z-index:1;'
          : ''
      }">

        <img
          src="${app.icon}"
          alt="${app.name}"
          loading="lazy"
        >

      </div>

      <span
        class="card-name"
        ${
          cardComingSoon
            ? 'style="position:relative; z-index:1;"'
            : ''
        }
      >
        ${app.name}
      </span>

      ${
        app.server_url
          ? `<span class="card-code"${
              cardComingSoon
                ? ' style="position:relative; z-index:1;"'
                : ''
            }>🌐 ${app.server_url}</span>`

          : (

            app.code

              ? `<span class="card-code"${
                  cardComingSoon
                    ? ' style="position:relative; z-index:1;"'
                    : ''
                }>🔑 ${app.code}</span>`

              : ""
          )
      }

      ${
        app.username
          ? `<span class="card-code"${
              cardComingSoon
                ? ' style="position:relative; z-index:1;"'
                : ''
            }>👤 Username : ${app.username}</span>`
          : ""
      }

      ${
        app.password
          ? `<span class="card-code"${
              cardComingSoon
                ? ' style="position:relative; z-index:1;"'
                : ''
            }>🔑 Password : ${app.password}</span>`
          : ""
      }

      ${badgeMarkup}
    `;

    if (cardComingSoon) {
      el.style.position = 'relative';
    }

    if (hasModal) {

      el.addEventListener(
        'click',
        () => openAppModal(app)
      );

      el.addEventListener(
        'keydown',
        (e) => {

          if (
            e.key === 'Enter' ||
            e.key === ' '
          ) {

            e.preventDefault();

            openAppModal(app);
          }
        }
      );
    }

    return el;
  }

  /* ============================================================
     RENDER & FILTER
  ============================================================ */

  const grid =
    document.getElementById('cards-grid');

  const countPill =
    document.getElementById('count-pill');

  const noResults =
    document.getElementById('no-results');

  /* ---- Recent Updates styles ---- */

  (function injectTodayUpdatesStyles() {

    const s =
      document.createElement('style');

    s.id =
      'today-updates-styles';

    s.textContent = [

      '.today-updates-title { grid-column: 1 / -1; width: 100%; font-size: 20px; font-weight: 800; margin: 4px 0 10px; background: linear-gradient(135deg,#f97316,#ef4444); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }',

      '.today-updates-hr { grid-column: 1 / -1; width: 100%; height: 1px; border: 0; margin: 0 0 16px; background: linear-gradient(90deg, rgba(249,115,22,.65), rgba(239,68,68,.05)); }',

      '.today-updates-divider { grid-column: 1 / -1; width: 100%; display: flex; align-items: center; gap: 10px; margin: 26px 0 14px; font-size: 13px; font-weight: 700; letter-spacing: .4px; color: #9ca3af; }',

      '.today-updates-divider::after { content: ""; flex: 1; height: 1px; background: rgba(255,255,255,0.12); }',

      '.card-updated-today-badge { background: linear-gradient(135deg,#f97316,#ef4444); color: #fff; font-size: 10px; font-weight: 800; letter-spacing: .3px; padding: 3px 7px; border-radius: 999px; box-shadow: 0 2px 6px rgba(0,0,0,.35); }'

    ].join('\n');

    document.head.appendChild(s);

  })();

  let APPS = [];

  function renderCards(list) {

    const fragment =
      document.createDocumentFragment();

    /*
      التطبيقات التي تم تحديثها اليوم
      وحتى 7 أيام مضت تبقى في الأعلى.

      بعد تجاوز 7 أيام تنتقل تلقائيًا
      إلى القائمة العادية.

      القائمة العادية مرتبة حسب تاريخ
      التحديث من الأحدث إلى الأقدم،
      لذلك التطبيق الذي يخرج من قسم
      الـ 7 أيام يظهر في بداية القائمة
      العادية.
    */

    const recentApps =
      sortByUpdatedDesc(
        list.filter(isRecentUpdate)
      );

    const normalApps =
      sortByUpdatedDesc(
        list.filter(
          app => !isRecentUpdate(app)
        )
      );

    if (recentApps.length > 0) {

      const title =
        document.createElement('div');

      title.className =
        'today-updates-title';

      title.textContent =
        "🔥 NEW & RECENTLY UPDATED";

      fragment.appendChild(title);

      const hr =
        document.createElement('hr');

      hr.className =
        'today-updates-hr';

      fragment.appendChild(hr);

      recentApps.forEach(
        app =>
          fragment.appendChild(
            createCard(app)
          )
      );

      const divider =
        document.createElement('div');

      divider.className =
        'today-updates-divider';

      divider.textContent =
        '📦 ALL APPLICATIONS';

      fragment.appendChild(divider);

      normalApps.forEach(
        app =>
          fragment.appendChild(
            createCard(app)
          )
      );

    } else {

      normalApps.forEach(
        app =>
          fragment.appendChild(
            createCard(app)
          )
      );
    }

    grid.innerHTML = '';

    grid.appendChild(fragment);

    const n = list.length;

    countPill.textContent =
      n === 1
        ? '1 app'
        : `${n} apps`;

    noResults.classList.toggle(
      'visible',
      n === 0
    );
  }

  /* ============================================================
     LIVE SEARCH
  ============================================================ */

  const searchInput =
    document.getElementById('search-input');

  const searchClear =
    document.getElementById('search-clear');

  const categoryFilter =
    document.getElementById('category-filter');

  let searchDebounceTimer = null;

  let currentCategory = 'all';

  function runSearch() {

    const q =
      searchInput.value
        .trim()
        .toLowerCase();

    searchClear.classList.toggle(
      'visible',
      q.length > 0
    );

    let filtered =
      currentCategory === 'all'

        ? APPS

        : APPS.filter(
            a =>
              (a.category || '')
                .toLowerCase() ===
              currentCategory.toLowerCase()
          );

    if (q) {

      filtered =
        filtered.filter(
          a =>
            a.name
              .toLowerCase()
              .includes(q)
        );
    }

    renderCards(filtered);

    const noResultsMsg =
      noResults.querySelector('p');

    if (noResultsMsg) {

      noResultsMsg.textContent =
        (
          filtered.length === 0 &&
          currentCategory !== 'all' &&
          !q
        )

          ? 'No apps available in this category.'

          : 'No apps match your search. Try a different keyword.';
    }
  }

  searchInput.addEventListener(
    'input',
    () => {

      clearTimeout(
        searchDebounceTimer
      );

      searchDebounceTimer =
        setTimeout(
          runSearch,
          60
        );
    }
  );

  searchClear.addEventListener(
    'click',
    () => {

      searchInput.value = '';

      searchClear.classList.remove(
        'visible'
      );

      runSearch();

      searchInput.focus();
    }
  );

  if (categoryFilter) {

    categoryFilter.addEventListener(
      'change',
      () => {

        currentCategory =
          categoryFilter.value;

        runSearch();
      }
    );
  }

  /*
    إعادة ترتيب القسم تلقائيًا بعد منتصف الليل.
    هذا يجعل التطبيق الذي تجاوز 7 أيام ينتقل
    للقائمة العادية بدون الحاجة لإعادة تحميل الصفحة.
  */

  (function scheduleFreshnessRefresh() {

    const now = new Date();

    const nextMidnight =
      new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        2,
        0
      );

    const delay =
      Math.max(
        1000,
        nextMidnight.getTime() -
        now.getTime()
      );

    setTimeout(
      () => {

        runSearch();

        scheduleFreshnessRefresh();

      },
      delay
    );

  })();

  /* ============================================================
     APP MODAL
  ============================================================ */

  const modalOverlay =
    document.getElementById(
      'modal-overlay'
    );

  const appModal =
    document.getElementById(
      'app-modal'
    );

  const modalIcon =
    document.getElementById(
      'modal-icon'
    );

  const modalTitle =
    document.getElementById(
      'modal-title'
    );

  const modalMetaGrid =
    document.getElementById(
      'modal-meta-grid'
    );

  const modalFields =
    document.getElementById(
      'modal-fields'
    );

  const modalDownload =
    document.getElementById(
      'modal-download'
    );

  const modalDownloadDefaultText =
    modalDownload.innerHTML;

  const modalCloseBtn =
    document.getElementById(
      'modal-close'
    );

  let modalVideoBtn = null;

  /* ---- compact modal styles ---- */

  (function injectCompactModalStyles() {

    const s =
      document.createElement('style');

    s.id =
      'compact-modal-styles';

    s.textContent = [

      '#app-modal { padding: 18px 20px 20px; gap: 12px; }',

      '#app-modal .modal-header { gap: 10px; margin-bottom: 0; }',

      '#app-modal .modal-icon { width: 54px; height: 54px; min-width: 54px; }',

      '#app-modal .modal-icon img { width: 36px; height: 36px; }',

      '#app-modal .modal-meta-grid { gap: 6px; margin-bottom: 0; }',

      '#app-modal .modal-fields { gap: 6px; margin-bottom: 0; }',

      '#app-modal .modal-field { padding: 8px 10px; }',

      '#app-modal .modal-actions { margin-top: 4px; gap: 8px; }',

      '#app-modal .modal-download { padding: 10px 16px; }',

      '#app-modal .modal-field-row { display: flex; gap: 6px; width: 100%; }',

      '#app-modal .modal-field-row .modal-field { flex: 1 1 0; min-width: 0; }',

      '#app-modal .modal-field-row .modal-field-value { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }'

    ].join('\n');

    document.head.appendChild(s);

  })();

  /* ---- video modal styles ---- */

  (function injectVideoModalStyles() {

    const s =
      document.createElement('style');

    s.id =
      'video-modal-styles';

    s.textContent = [

      '.video-modal-overlay { position: fixed; inset: 0; z-index: 10000; display: none; align-items: center; justify-content: center; background: rgba(6,4,14,0.82); padding: 24px; box-sizing: border-box; }',

      '.video-modal-overlay.active { display: flex; }',

      '.video-modal-box { position: relative; width: 100%; max-width: 960px; background: #0b0a14; border-radius: 14px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.55); border: 1px solid rgba(255,255,255,0.08); }',

      '.video-modal-box video { display: block; width: 100%; max-height: 78vh; background: #000; }',

      '.video-modal-close { position: absolute; top: 10px; right: 10px; z-index: 1; width: 40px; height: 40px; border-radius: 999px; border: none; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.55); color: #fff; cursor: pointer; }',

      '.video-modal-close svg { width: 20px; height: 20px; }',

      '.modal-video-btn { width: 100%; box-sizing: border-box; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 16px; margin: 0 0 8px; border-radius: 10px; border: 1px solid rgba(249,115,22,0.4); background: linear-gradient(135deg, rgba(249,115,22,0.18), rgba(239,68,68,0.18)); color: #fdba74; font-weight: 700; font-size: 14px; cursor: pointer; }',

      '.modal-video-btn:hover, .modal-video-btn:focus { background: linear-gradient(135deg, rgba(249,115,22,0.28), rgba(239,68,68,0.28)); outline: none; }'

    ].join('\n');

    document.head.appendChild(s);

  })();

  /* ---- video modal markup ---- */

  const videoModalOverlay =
    document.createElement('div');

  videoModalOverlay.className =
    'video-modal-overlay';

  videoModalOverlay.setAttribute(
    'aria-hidden',
    'true'
  );

  videoModalOverlay.innerHTML = `
    <div class="video-modal-box">

      <button
        type="button"
        class="video-modal-close"
        aria-label="Close video"
      >

        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line
            x1="18"
            y1="6"
            x2="6"
            y2="18"
          />

          <line
            x1="6"
            y1="6"
            x2="18"
            y2="18"
          />
        </svg>

      </button>

      <video
        id="explainer-video-player"
        controls
        playsinline
      ></video>

    </div>
  `;

  document.body.appendChild(
    videoModalOverlay
  );

  const explainerVideoEl =
    videoModalOverlay.querySelector(
      '#explainer-video-player'
    );

  const videoModalCloseBtn =
    videoModalOverlay.querySelector(
      '.video-modal-close'
    );

  function openVideoModal(url) {

    if (!url) return;

    explainerVideoEl.src = url;

    videoModalOverlay.classList.add(
      'active'
    );

    videoModalOverlay.setAttribute(
      'aria-hidden',
      'false'
    );

    document.body.style.overflow =
      'hidden';

    const playPromise =
      explainerVideoEl.play();

    if (
      playPromise &&
      typeof playPromise.catch === 'function'
    ) {

      playPromise.catch(() => {});

    }
  }

  function closeVideoModal() {

    explainerVideoEl.pause();

    explainerVideoEl.removeAttribute(
      'src'
    );

    explainerVideoEl.load();

    videoModalOverlay.classList.remove(
      'active'
    );

    videoModalOverlay.setAttribute(
      'aria-hidden',
      'true'
    );

    if (
      !modalOverlayIsActive()
    ) {

      document.body.style.overflow =
        '';
    }
  }

  function modalOverlayIsActive() {

    const overlay =
      document.getElementById(
        'modal-overlay'
      );

    return !!(
      overlay &&
      overlay.classList.contains(
        'active'
      )
    );
  }

  videoModalCloseBtn.addEventListener(
    'click',
    closeVideoModal
  );

  videoModalOverlay.addEventListener(
    'click',
    (e) => {

      if (
        e.target ===
        videoModalOverlay
      ) {

        closeVideoModal();
      }
    }
  );

  document.addEventListener(
    'keydown',
    (e) => {

      if (
        e.key === 'Escape' &&
        videoModalOverlay.classList.contains(
          'active'
        )
      ) {

        closeVideoModal();
      }
    }
  );

  const SVG_COPY =
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;

  const SVG_CHECK =
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

  const SVG_EYE =
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;

  const SVG_EYE_OFF =
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

  const COPY_FIELDS = [
    {
      key: 'code',
      label: 'Code'
    },
  ];

  const META_FIELDS = [

    {
      key: 'category',
      label: 'Category'
    },

    {
      key: 'version',
      label: 'Version'
    },

    {
      key: 'size',
      label: 'Size'
    },

    {
      key: 'developer',
      label: 'Developer'
    },

    {
      key: 'updated',
      label: 'Updated'
    },

    {
      key: 'activated',
      label: 'Activated'
    },

  ];

  async function copyToClipboard(
    text,
    btn
  ) {

    try {

      if (
        navigator.clipboard &&
        navigator.clipboard.writeText
      ) {

        await navigator.clipboard.writeText(
          text
        );

      } else {

        const tmp =
          document.createElement(
            'textarea'
          );

        tmp.value = text;

        tmp.style.position =
          'fixed';

        tmp.style.opacity =
          '0';

        document.body.appendChild(
          tmp
        );

        tmp.select();

        document.execCommand(
          'copy'
        );

        document.body.removeChild(
          tmp
        );
      }

      const original =
        btn.innerHTML;

      btn.innerHTML =
        SVG_CHECK;

      btn.classList.add(
        'copied'
      );

      setTimeout(
        () => {

          btn.innerHTML =
            original;

          btn.classList.remove(
            'copied'
          );

        },
        1500
      );

    } catch (err) {

      console.error(
        'Copy failed:',
        err
      );
    }
  }

  function openAppModal(app) {

    modalIcon.style.background =
      app.bg ||
      'var(--bg-card-hover)';

    modalIcon.innerHTML =
      `<img src="${app.icon}" alt="${app.name}">`;

    modalTitle.textContent =
      app.name;

    const modalBadge =
      document.getElementById(
        "modal-badge"
      );

    modalBadge.className =
      `card-badge badge-${app.badge}`;

    modalBadge.textContent =
      app.badge === "live"
        ? "Live"
        : app.badge === "new"
          ? "New"
          : app.badge === "update"
            ? "Updated"
            : "Hot";

    modalMetaGrid.innerHTML = '';

    const comingSoon =
      isComingSoon(app);

    const hasPlayerCode =
      app.player_code !== undefined &&
      app.player_code !== null &&
      app.player_code !== '';

    const hasServer =
      app.server !== undefined &&
      app.server !== null &&
      app.server !== '';

    if (comingSoon) {

      const enCard =
        document.createElement(
          'div'
        );

      enCard.className =
        'modal-field';

      enCard.style.flexDirection =
        'column';

      enCard.style.alignItems =
        'flex-start';

      enCard.style.gap =
        '4px';

      enCard.innerHTML = `
        <div
          class="modal-field-info"
          style="width:100%; margin-top:0; padding-top:0;"
        >

          <span
            class="modal-field-label"
            style="font-size:16px; font-weight:700; background:linear-gradient(135deg,#a855f7,#7c3aed); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; display:inline-block; line-height:1.3;"
          >
            🚧 Application Coming Soon
          </span>

          <span
            class="modal-field-value"
            style="white-space:normal; line-height:1.6; display:block; margin-top:6px;"
          >
            This application is currently<br>
            being uploaded.<br>
            Please check back later.<br>
            The latest version will be<br>
            available soon.
          </span>

        </div>
      `;

      modalMetaGrid.appendChild(
        enCard
      );

      const arCard =
        document.createElement(
          'div'
        );

      arCard.className =
        'modal-field';

      arCard.style.flexDirection =
        'column';

      arCard.style.alignItems =
        'flex-start';

      arCard.style.gap =
        '4px';

      arCard.style.direction =
        'rtl';

      arCard.style.textAlign =
        'right';

      arCard.innerHTML = `
        <div
          class="modal-field-info"
          style="width:100%; margin-top:0; padding-top:0;"
        >

          <span
            class="modal-field-label"
            style="font-size:16px; font-weight:700; background:linear-gradient(135deg,#a855f7,#7c3aed); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; display:inline-block; line-height:1.3; margin-top:0;"
          >
            🚧 التطبيق قيد الرفع
          </span>

          <span
            class="modal-field-value"
            style="white-space:normal; line-height:1.6; display:block; margin-top:6px;"
          >
            هذا التطبيق جارٍ رفعه حاليًا.<br>
            يرجى العودة لاحقًا.<br>
            سيتم توفير أحدث إصدار قريبًا.
          </span>

        </div>
      `;

      modalMetaGrid.appendChild(
        arCard
      );

    } else if (hasPlayerCode) {

      const playerEnCard =
        document.createElement(
          'div'
        );

      playerEnCard.className =
        'modal-field';

      playerEnCard.style.flexDirection =
        'column';

      playerEnCard.style.alignItems =
        'flex-start';

      playerEnCard.style.gap =
        '4px';

      playerEnCard.innerHTML = `
       <div
         class="modal-field-info"
         style="width:100%; margin-top:0; padding-top:0;"
       >

        <span
          class="modal-field-label"
          style="font-size:16px; font-weight:700; background:linear-gradient(135deg,#a855f7,#7c3aed); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; display:inline-block; line-height:1.3;"
        >
          📺 Player Required
        </span>

        <span
          class="modal-field-value"
          style="white-space:normal; line-height:1.6; display:block; margin-top:6px;"
        >
          To use this application, first download its required player.<br>
          Use the Downloader application to install the player.
        </span>

       </div>
      `;

      playerEnCard.appendChild(
        buildCopyField(
          'player_code',
          'Downloader Code'
        )
      );

      modalMetaGrid.appendChild(
        playerEnCard
      );

      const playerArCard =
        document.createElement(
          'div'
        );

      playerArCard.className =
        'modal-field';

      playerArCard.style.flexDirection =
        'column';

      playerArCard.style.alignItems =
        'flex-start';

      playerArCard.style.gap =
        '4px';

      playerArCard.style.direction =
        'rtl';

      playerArCard.style.textAlign =
        'right';

      playerArCard.innerHTML = `
       <div
         class="modal-field-info"
         style="width:100%; margin-top:0; padding-top:0;"
       >

        <span
          class="modal-field-label"
          style="font-size:16px; font-weight:700; background:linear-gradient(135deg,#a855f7,#7c3aed); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; display:inline-block; line-height:1.3; margin-top:0;"
        >
          📺 المشغل مطلوب
        </span>

        <span
          class="modal-field-value"
          style="white-space:normal; line-height:1.6; display:block; margin-top:6px;"
        >
          لتشغيل هذا التطبيق، قم أولاً بتحميل المشغل الخاص به.<br>
          هذا كود المشغل، قم بتحميله باستخدام تطبيق Downloader.
        </span>

       </div>
      `;

      const playerArCopyField =
        buildCopyField(
          'player_code',
          'كود Downloader'
        );

      playerArCopyField.style.direction =
        'rtl';

      playerArCard.appendChild(
        playerArCopyField
      );

      modalMetaGrid.appendChild(
        playerArCard
      );

    } else if (hasServer) {

      const serverField =
        document.createElement(
          'div'
        );

      serverField.className =
        'modal-field';

      serverField.innerHTML = `
        <div class="modal-field-info">

          <span class="modal-field-label">
            Server
          </span>

          <span class="modal-field-value">
            ${app.server}
          </span>

        </div>
      `;

      modalMetaGrid.appendChild(
        serverField
      );

      if (
        app.server_url !== undefined &&
        app.server_url !== null &&
        app.server_url !== ''
      ) {

        const serverUrlField =
          document.createElement(
            'div'
          );

        serverUrlField.className =
          'modal-field';

        serverUrlField.innerHTML = `
          <div class="modal-field-info">

            <span class="modal-field-label">
              Server URL
            </span>

            <span class="modal-field-value">
              ${app.server_url}
            </span>

          </div>
        `;

        modalMetaGrid.appendChild(
          serverUrlField
        );
      }

      if (
        app.username !== undefined &&
        app.username !== null &&
        app.username !== ''
      ) {

        modalMetaGrid.appendChild(
          buildCopyField(
            'username',
            'Username'
          )
        );
      }

      if (
        app.password !== undefined &&
        app.password !== null &&
        app.password !== ''
      ) {

        modalMetaGrid.appendChild(
          buildCopyField(
            'password',
            'Password',
            true
          )
        );
      }

    } else {

      META_FIELDS.forEach(
        ({ key, label }) => {

          if (
            app[key] === undefined ||
            app[key] === null ||
            app[key] === ''
          ) {
            return;
          }

          const field =
            document.createElement(
              'div'
            );

          field.className =
            'modal-field';

          field.innerHTML = `
            <div class="modal-field-info">

              <span class="modal-field-label">
                ${label}
              </span>

              <span class="modal-field-value">
                ${
                  key === 'activated'

                    ? (
                        app[key]
                          ? '🟢 Activated'
                          : '🔴 Not Activated'
                      )

                    : app[key]
                }
              </span>

            </div>
          `;

          modalMetaGrid.appendChild(
            field
          );
        }
      );
    }

    modalFields.innerHTML = '';

    function buildCopyField(
      key,
      label,
      maskable
    ) {

      const field =
        document.createElement(
          'div'
        );

      field.className =
        'modal-field';

      const valueSpan =
        document.createElement(
          'span'
        );

      valueSpan.className =
        'modal-field-value' +
        (
          maskable
            ? ' is-password'
            : ''
        );

      let realValue =
        String(app[key]);

      let masked =
        maskable;

      valueSpan.textContent =
        maskable
          ? '•'.repeat(
              Math.min(
                realValue.length,
                12
              )
            )
          : realValue;

      const info =
        document.createElement(
          'div'
        );

      info.className =
        'modal-field-info';

      const labelSpan =
        document.createElement(
          'span'
        );

      labelSpan.className =
        'modal-field-label';

      labelSpan.textContent =
        label;

      info.appendChild(
        labelSpan
      );

      info.appendChild(
        valueSpan
      );

      const actions =
        document.createElement(
          'div'
        );

      actions.className =
        'modal-field-actions';

      if (maskable) {

        const toggleBtn =
          document.createElement(
            'button'
          );

        toggleBtn.type =
          'button';

        toggleBtn.className =
          'modal-toggle-btn';

        toggleBtn.setAttribute(
          'aria-label',
          'Show/Hide password'
        );

        toggleBtn.innerHTML =
          SVG_EYE;

        toggleBtn.addEventListener(
          'click',
          () => {

            masked =
              !masked;

            valueSpan.textContent =
              masked

                ? '•'.repeat(
                    Math.min(
                      realValue.length,
                      12
                    )
                  )

                : realValue;

            toggleBtn.innerHTML =
              masked
                ? SVG_EYE
                : SVG_EYE_OFF;
          }
        );

        actions.appendChild(
          toggleBtn
        );
      }

      const copyBtn =
        document.createElement(
          'button'
        );

      copyBtn.type =
        'button';

      copyBtn.className =
        'modal-copy-btn';

      copyBtn.setAttribute(
        'aria-label',
        `Copy ${label}`
      );

      copyBtn.innerHTML =
        SVG_COPY;

      copyBtn.addEventListener(
        'click',
        () =>
          copyToClipboard(
            realValue,
            copyBtn
          )
      );

      actions.appendChild(
        copyBtn
      );

      field.appendChild(
        info
      );

      field.appendChild(
        actions
      );

      return field;
    }

    if (
      !hasPlayerCode &&
      !hasServer
    ) {

      COPY_FIELDS.forEach(
        ({ key, label, maskable }) => {

          if (
            app[key] === undefined ||
            app[key] === null ||
            app[key] === ''
          ) {
            return;
          }

          modalFields.appendChild(
            buildCopyField(
              key,
              label,
              maskable
            )
          );
        }
      );
    }

    /* ---- download button ---- */

    if (comingSoon) {

      modalDownload.href =
        'javascript:void(0)';

      modalDownload.removeAttribute(
        'target'
      );

      modalDownload.setAttribute(
        'aria-disabled',
        'true'
      );

      modalDownload.dataset.comingSoon =
        'true';

      modalDownload.style.pointerEvents =
        'none';

      modalDownload.style.opacity =
        '0.55';

      modalDownload.style.cursor =
        'not-allowed';

      modalDownload.textContent =
        '⏳ Coming Soon';

    } else {

      modalDownload.href =
        app.url || '#';

      modalDownload.removeAttribute(
        'aria-disabled'
      );

      delete modalDownload.dataset
        .comingSoon;

      modalDownload.style.pointerEvents =
        '';

      modalDownload.style.opacity =
        '';

      modalDownload.style.cursor =
        '';

      modalDownload.innerHTML =
        modalDownloadDefaultText;
    }

    /* ---- video button ---- */

    if (appHasVideo(app)) {

      if (!modalVideoBtn) {

        modalVideoBtn =
          document.createElement(
            'button'
          );

        modalVideoBtn.type =
          'button';

        modalVideoBtn.className =
          'modal-video-btn';

        modalVideoBtn.textContent =
          '⚠️ شاهد الفيديو قبل تثبيت التطبيق';

        modalVideoBtn.addEventListener(
          'click',
          () => {

            openVideoModal(
              modalVideoBtn.dataset.videoUrl
            );
          }
        );
      }

      modalVideoBtn.dataset.videoUrl =
        app.video;

      if (
        modalVideoBtn.parentElement !==
        modalDownload.parentElement
      ) {

        modalDownload.parentElement
          .insertBefore(
            modalVideoBtn,
            modalDownload
          );

      } else if (
        modalVideoBtn.nextElementSibling !==
        modalDownload
      ) {

        modalDownload.parentElement
          .insertBefore(
            modalVideoBtn,
            modalDownload
          );
      }

      modalVideoBtn.style.display =
        '';

    } else if (modalVideoBtn) {

      modalVideoBtn.style.display =
        'none';
    }

    modalOverlay.classList.add(
      'active'
    );

    modalOverlay.setAttribute(
      'aria-hidden',
      'false'
    );

    document.body.style.overflow =
      'hidden';

    setTimeout(
      () => {

        const focusable =
          getModalFocusableElements();

        if (focusable.length) {
          focusable[0].focus();
        }

      },
      0
    );
  }

  function closeAppModal() {

    if (
      videoModalOverlay.classList.contains(
        'active'
      )
    ) {

      closeVideoModal();
    }

    modalOverlay.classList.remove(
      'active'
    );

    modalOverlay.setAttribute(
      'aria-hidden',
      'true'
    );

    document.body.style.overflow =
      '';
  }

  function getModalFocusableElements() {

    if (
      !modalOverlay.classList.contains(
        'active'
      )
    ) {
      return [];
    }

    const nodes =
      appModal.querySelectorAll(
        'button, a[href], [tabindex]:not([tabindex="-1"])'
      );

    return Array.prototype.filter.call(
      nodes,
      el => {

        return (
          el.offsetParent !== null &&
          el.getAttribute(
            'aria-disabled'
          ) !== 'true'
        );
      }
    );
  }

  modalCloseBtn.addEventListener(
    'click',
    closeAppModal
  );

  modalDownload.addEventListener(
    'click',
    (e) => {

      if (
        modalDownload.dataset.comingSoon ===
        'true'
      ) {

        e.preventDefault();
      }
    }
  );

  modalOverlay.addEventListener(
    'click',
    (e) => {

      if (
        e.target === modalOverlay
      ) {

        closeAppModal();
      }
    }
  );

  document.addEventListener(
    'keydown',
    (e) => {

      if (
        e.key === 'Escape' &&
        modalOverlay.classList.contains(
          'active'
        ) &&
        !videoModalOverlay.classList.contains(
          'active'
        )
      ) {

        closeAppModal();
      }
    }
  );

  /* ---- Android TV D-pad ---- */

  document.addEventListener(
    'keydown',
    (e) => {

      if (
        !modalOverlay.classList.contains(
          'active'
        )
      ) {
        return;
      }

      if (
        videoModalOverlay.classList.contains(
          'active'
        )
      ) {
        return;
      }

      const isNavKey =
        [
          'ArrowDown',
          'ArrowRight',
          'ArrowUp',
          'ArrowLeft'
        ].includes(e.key);

      if (!isNavKey) return;

      const focusable =
        getModalFocusableElements();

      if (!focusable.length) return;

      const currentIndex =
        focusable.indexOf(
          document.activeElement
        );

      let nextIndex;

      if (
        e.key === 'ArrowDown' ||
        e.key === 'ArrowRight'
      ) {

        nextIndex =
          currentIndex === -1
            ? 0
            : (
                currentIndex + 1
              ) %
              focusable.length;

      } else {

        nextIndex =
          currentIndex === -1
            ? 0
            : (
                currentIndex - 1 +
                focusable.length
              ) %
              focusable.length;
      }

      e.preventDefault();

      focusable[
        nextIndex
      ].focus();
    }
  );

  /* ============================================================
     APP DATA
     hidden: true hides the app completely.
  ============================================================ */

  async function loadApps() {

    try {

      const res =
        await fetch(
          'apps.json',
          {
            cache: 'no-cache'
          }
        );

      if (!res.ok) {
        throw new Error(
          `HTTP ${res.status}`
        );
      }

      const loadedApps =
        await res.json();

      /*
        "hidden": true
        = التطبيق مخفي بالكامل.

        حذف hidden أو:
        "hidden": false
        = التطبيق يظهر من جديد.

        لأن الفلترة تحدث هنا قبل وضع
        البيانات داخل APPS، فالتطبيق المخفي
        لن يظهر في:
        - القائمة
        - البحث
        - التصنيفات
        - العداد
        - قسم التحديثات
      */

      APPS =
        Array.isArray(loadedApps)

          ? loadedApps.filter(
              app =>
                app &&
                app.hidden !== true
            )

          : [];

    } catch (err) {

      console.error(
        'Failed to load apps.json:',
        err
      );

      APPS = [];

      noResults
        .querySelector('p')
        .textContent =
          'Could not load the app list. Please try again later.';

      noResults.classList.add(
        'visible'
      );
    }

    renderCards(APPS);
  }

  loadApps();

  /* ============================================================
     GALAXY CANVAS
  ============================================================ */

  (function () {

    const canvas =
      document.getElementById(
        'galaxy-canvas'
      );

    const ctx =
      canvas.getContext('2d');

    let W, H, stars, nebula;

    const rand =
      (a, b) =>
        Math.random() *
        (b - a) +
        a;

    function resize() {

      W =
        canvas.width =
        window.innerWidth;

      H =
        canvas.height =
        window.innerHeight;

      init();
    }

    function init() {

      stars =
        Array.from(
          {
            length: 280
          },
          () => ({

            x: rand(0, W),

            y: rand(0, H),

            r: rand(
              0.3,
              1.6
            ),

            a: rand(
              0.2,
              1
            ),

            da: rand(
              0.002,
              0.006
            ),

            t: rand(
              0,
              Math.PI * 2
            ),

            c:
              [
                '#ffffff',
                '#c8b8ff',
                '#b8d8ff',
                '#ffd8b8'
              ][
                Math.floor(
                  rand(0, 4)
                )
              ],
          })
        );

      nebula =
        Array.from(
          {
            length: 6
          },
          () => ({

            x: rand(0, W),

            y: rand(0, H),

            r: rand(
              W * 0.15,
              W * 0.38
            ),

            c:
              [
                'rgba(80,40,180,',
                'rgba(120,30,160,',
                'rgba(20,60,140,',
                'rgba(60,20,100,'
              ][
                Math.floor(
                  rand(0, 4)
                )
              ],

            a: rand(
              0.04,
              0.10
            ),

          })
        );
    }

    function draw(ts) {

      ctx.clearRect(
        0,
        0,
        W,
        H
      );

      const bg =
        ctx.createRadialGradient(
          W * .5,
          H * .35,
          0,
          W * .5,
          H * .35,
          Math.max(W, H) * .8
        );

      bg.addColorStop(
        0,
        '#0e0824'
      );

      bg.addColorStop(
        0.5,
        '#07051a'
      );

      bg.addColorStop(
        1,
        '#04040a'
      );

      ctx.fillStyle =
        bg;

      ctx.fillRect(
        0,
        0,
        W,
        H
      );

      nebula.forEach(
        n => {

          const g =
            ctx.createRadialGradient(
              n.x,
              n.y,
              0,
              n.x,
              n.y,
              n.r
            );

          g.addColorStop(
            0,
            n.c +
              n.a +
              ')'
          );

          g.addColorStop(
            1,
            n.c +
              '0)'
          );

          ctx.fillStyle =
            g;

          ctx.beginPath();

          ctx.arc(
            n.x,
            n.y,
            n.r,
            0,
            Math.PI * 2
          );

          ctx.fill();
        }
      );

      const sec =
        ts * 0.001;

      stars.forEach(
        s => {

          const twinkle =
            s.a +
            0.35 *
              Math.sin(
                sec *
                  s.da *
                  60 +
                  s.t
              );

          ctx.globalAlpha =
            Math.max(
              0.05,
              Math.min(
                1,
                twinkle
              )
            );

          ctx.fillStyle =
            s.c;

          ctx.beginPath();

          ctx.arc(
            s.x,
            s.y,
            s.r,
            0,
            Math.PI * 2
          );

          ctx.fill();
        }
      );

      ctx.globalAlpha =
        1;

      requestAnimationFrame(
        draw
      );
    }

    window.addEventListener(
      'resize',
      resize
    );

    resize();

    requestAnimationFrame(
      draw
    );

  })();

  /* ============================================================
     SUPPORT POPUP
  ============================================================ */

  window.openSupport =
    function () {

      document.getElementById(
        'supportModal'
      ).style.display =
        'flex';
    };

  window.closeSupport =
    function () {

      document.getElementById(
        'supportModal'
      ).style.display =
        'none';
    };

  window.addEventListener(
    'click',
    function (event) {

      const modal =
        document.getElementById(
          'supportModal'
        );

      if (
        event.target === modal
      ) {

        closeSupport();
      }
    }
  );

  /* ============================================================
     SUPPORT BANNER
  ============================================================ */

  (function () {

    const bannerEn =
      document.getElementById(
        'banner-en'
      );

    const bannerAr =
      document.getElementById(
        'banner-ar'
      );

    const bannerBtn =
      document.getElementById(
        'banner-btn-text'
      );

    if (
      !bannerEn ||
      !bannerAr ||
      !bannerBtn
    ) {
      return;
    }

    const HIDDEN =
      'support-banner-slide--hidden';

    let showingEn =
      true;

    setInterval(
      function () {

        if (showingEn) {

          bannerEn.classList.add(
            HIDDEN
          );

          bannerAr.classList.remove(
            HIDDEN
          );

          bannerBtn.textContent =
            '❤️ ادعم المشروع';

        } else {

          bannerAr.classList.add(
            HIDDEN
          );

          bannerEn.classList.remove(
            HIDDEN
          );

          bannerBtn.textContent =
            '❤️ Support Project';
        }

        showingEn =
          !showingEn;

      },
      7000
    );

  })();

})();

/* ============================================================
   SUPPORTER FORM — Supabase + PayPal Checkout
============================================================ */

(function () {

  'use strict';

  const SUPABASE_URL =
    'https://ypszdzznqaizopfulioa.supabase.co';

  const SUPABASE_ANON =
    'sb_publishable_EKEuf19RbGaaQ_xjN9VmhA_mkOY9t2q';

  const SUPPORTERS_TABLE_ENDPOINT =
    SUPABASE_URL +
    '/rest/v1/supporters';

  const PUBLIC_SUPPORTERS_ENDPOINT =
    SUPABASE_URL +
    '/rest/v1/public_supporters';

  const CREATE_ORDER_ENDPOINT =
    SUPABASE_URL +
    '/functions/v1/create-order';

  const CAPTURE_ORDER_ENDPOINT =
    SUPABASE_URL +
    '/functions/v1/capture-order';

  const bannerBtn =
    document.getElementById(
      'banner-btn'
    );

  const overlay =
    document.getElementById(
      'supporter-form-overlay'
    );

  const closeBtn =
    document.getElementById(
      'supporter-form-close'
    );

  const skipBtn =
    document.getElementById(
      'supporter-skip-btn'
    );

  const submitBtn =
    document.getElementById(
      'supporter-submit-btn'
    );

  const submitLabel =
    document.getElementById(
      'supporter-submit-label'
    );

  const nameInput =
    document.getElementById(
      'supporter-name'
    );

  const amountInput =
    document.getElementById(
      'supporter-amount'
    );

  const messageInput =
    document.getElementById(
      'supporter-message'
    );

  const showNameCheckbox =
    document.getElementById(
      'supporter-show-name'
    );

  const nameError =
    document.getElementById(
      'supporter-name-error'
    );

  const amountError =
    document.getElementById(
      'supporter-amount-error'
    );

  const paypalButtonContainer =
    document.getElementById(
      'paypal-button-container'
    );

  const PAYPAL_URL =
    'https://www.paypal.com/paypalme/AnubisApps';

  const MIN_DONATION_USD =
    1;

  if (
    !bannerBtn ||
    !overlay
  ) {
    return;
  }

  let currentSupporterId =
    null;

  let paypalButtonsWidget =
    null;

  function openSupporterForm(e) {

    e.preventDefault();

    resetForm();

    overlay.classList.add(
      'active'
    );

    overlay.setAttribute(
      'aria-hidden',
      'false'
    );

    document.body.style.overflow =
      'hidden';

    setTimeout(
      function () {

        if (nameInput) {
          nameInput.focus();
        }

      },
      60
    );
  }

  function closeSupporterForm() {

    overlay.classList.remove(
      'active'
    );

    overlay.setAttribute(
      'aria-hidden',
      'true'
    );

    document.body.style.overflow =
      '';
  }

  function resetForm() {

    if (nameInput)
      nameInput.value = '';

    if (amountInput)
      amountInput.value = '';

    if (messageInput)
      messageInput.value = '';

    if (showNameCheckbox)
      showNameCheckbox.checked =
        true;

    if (nameError)
      nameError.classList.remove(
        'visible'
      );

    if (amountError)
      amountError.classList.remove(
        'visible'
      );

    if (nameInput)
      nameInput.classList.remove(
        'input-error'
      );

    if (amountInput)
      amountInput.classList.remove(
        'input-error'
      );

    if (submitBtn) {

      submitBtn.disabled =
        false;

      submitBtn.style.display =
        '';
    }

    if (submitLabel) {

      submitLabel.textContent =
        '❤️ Continue to PayPal';
    }

    if (paypalButtonContainer) {

      paypalButtonContainer.innerHTML =
        '';

      paypalButtonContainer.style.display =
        'none';
    }

    currentSupporterId =
      null;

    paypalButtonsWidget =
      null;
  }

  function openPayPal() {

    window.open(
      PAYPAL_URL,
      '_blank',
      'noopener,noreferrer'
    );
  }

  async function saveSupporterPending(
    name,
    amount,
    message,
    showName
  ) {

    try {

      const res =
        await fetch(
          SUPPORTERS_TABLE_ENDPOINT,
          {
            method: 'POST',

            headers: {

              'Content-Type':
                'application/json',

              'apikey':
                SUPABASE_ANON,

              'Authorization':
                'Bearer ' +
                SUPABASE_ANON,

              'Prefer':
                'return=representation',
            },

            body:
              JSON.stringify({

                name:
                  name,

                amount:
                  amount,

                message:
                  message ||
                  null,

                show_name:
                  showName,

                status:
                  'pending',
              }),
          }
        );

      if (!res.ok) {

        const errorText =
          await res.text()
            .catch(
              () => ""
            );

        console.error(
          "Supabase insert failed:",
          res.status,
          errorText
        );

        return null;
      }

      const rows =
        await res.json();

      return Array.isArray(rows)
        ? rows[0]
        : rows;

    } catch (err) {

      console.warn(
        'Supabase insert failed:',
        err
      );

      return null;
    }
  }

  async function createPayPalOrder(
    amount,
    supporterId
  ) {

    const res =
      await fetch(
        CREATE_ORDER_ENDPOINT,
        {

          method:
            'POST',

          headers: {

            'Content-Type':
              'application/json',

            'apikey':
              SUPABASE_ANON,

            'Authorization':
              'Bearer ' +
              SUPABASE_ANON,
          },

          body:
            JSON.stringify({

              amount:
                amount,

              supporterId:
                supporterId,

            }),
        }
      );

    const data =
      await res.json();

    if (
      !res.ok ||
      !data.id
    ) {

      throw new Error(
        data &&
        data.error
          ? data.error
          : 'Failed to create PayPal order.'
      );
    }

    return data.id;
  }

  async function capturePayPalOrder(
    orderID
  ) {

    const res =
      await fetch(
        CAPTURE_ORDER_ENDPOINT,
        {

          method:
            'POST',

          headers: {

            'Content-Type':
              'application/json',

            'apikey':
              SUPABASE_ANON,

            'Authorization':
              'Bearer ' +
              SUPABASE_ANON,
          },

          body:
            JSON.stringify({

              orderID:
                orderID,

            }),
        }
      );

    let data;

    try {

      data =
        await res.json();

    } catch (err) {

      throw new Error(
        'Invalid response from capture-order.'
      );
    }

    if (
      !res.ok ||
      !data ||
      data.error
    ) {

      throw new Error(
        data &&
        data.error
          ? data.error
          : 'Failed to capture PayPal order.'
      );
    }

    if (
      data.status !==
        'COMPLETED' ||
      !data.transactionId
    ) {

      throw new Error(
        'PayPal capture did not complete (status: ' +
        (
          data &&
          data.status
            ? data.status
            : 'unknown'
        ) +
        ').'
      );
    }

    return data;
  }

  function renderPayPalButtons(
    orderId
  ) {

    if (
      !paypalButtonContainer ||
      typeof paypal ===
        'undefined'
    ) {

      console.error(
        'PayPal SDK is not available.'
      );

      if (submitLabel) {

        submitLabel.textContent =
          'Payment unavailable — please try again later.';
      }

      if (submitBtn) {

        submitBtn.disabled =
          false;

        submitBtn.style.display =
          '';
      }

      return;
    }

    paypalButtonContainer.innerHTML =
      '';

    paypalButtonContainer.style.display =
      'block';

    if (submitBtn) {

      submitBtn.style.display =
        'none';
    }

    if (submitLabel) {

      submitLabel.textContent =
        '❤️ Continue to PayPal';
    }

    paypalButtonsWidget =
      paypal.Buttons({

        createOrder:
          function () {

            return orderId;
          },

        onApprove:
          async function (data) {

            try {

              await capturePayPalOrder(
                data.orderID
              );

              await loadTopSupporters();

              await loadLiveFeed();

              closeSupporterForm();

              resetForm();

            } catch (err) {

              console.error(
                'Capture failed:',
                err
              );

              alert(
                'We could not confirm your payment. If you were charged, please contact support.'
              );
            }
          },

        onCancel:
          function () {

            /*
              status remains pending
            */
          },

        onError:
          function (err) {

            console.error(
              'PayPal Buttons error:',
              err
            );

            alert(
              'Something went wrong with PayPal. Please try again.'
            );
          },

      });

    paypalButtonsWidget.render(
      paypalButtonContainer
    );
  }

  async function handleSubmit() {

    const name =
      nameInput
        ? nameInput.value.trim()
        : '';

    const amountRaw =
      amountInput
        ? amountInput.value.trim()
        : '';

    const amount =
      amountRaw
        ? Math.round(
            parseFloat(
              amountRaw
            ) * 100
          ) / 100
        : NaN;

    const message =
      messageInput
        ? messageInput.value.trim()
        : '';

    const showName =
      showNameCheckbox
        ? showNameCheckbox.checked
        : true;

    if (!name) {

      if (nameError)
        nameError.classList.add(
          'visible'
        );

      if (nameInput)
        nameInput.classList.add(
          'input-error'
        );

      if (nameInput)
        nameInput.focus();

      return;
    }

    if (nameError)
      nameError.classList.remove(
        'visible'
      );

    if (nameInput)
      nameInput.classList.remove(
        'input-error'
      );

    if (
      !amountRaw ||
      isNaN(amount) ||
      amount <
        MIN_DONATION_USD
    ) {

      if (amountError)
        amountError.classList.add(
          'visible'
        );

      if (amountInput)
        amountInput.classList.add(
          'input-error'
        );

      if (amountInput)
        amountInput.focus();

      return;
    }

    if (amountError)
      amountError.classList.remove(
        'visible'
      );

    if (amountInput)
      amountInput.classList.remove(
        'input-error'
      );

    if (submitBtn)
      submitBtn.disabled =
        true;

    if (submitLabel)
      submitLabel.textContent =
        'Saving…';

    const supporter =
      await saveSupporterPending(
        name,
        amount,
        message,
        showName
      );

    if (
      !supporter ||
      !supporter.id
    ) {

      if (submitBtn)
        submitBtn.disabled =
          false;

      if (submitLabel)
        submitLabel.textContent =
          '❤️ Continue to PayPal';

      alert(
        'Could not save your info. Please try again.'
      );

      return;
    }

    currentSupporterId =
      supporter.id;

    if (submitLabel)
      submitLabel.textContent =
        'Preparing PayPal…';

    let orderId;

    try {

      orderId =
        await createPayPalOrder(
          amount,
          currentSupporterId
        );

    } catch (err) {

      console.error(
        'create-order failed:',
        err
      );

      if (submitBtn)
        submitBtn.disabled =
          false;

      if (submitLabel)
        submitLabel.textContent =
          '❤️ Continue to PayPal';

      alert(
        'Could not start the PayPal checkout. Please try again.'
      );

      return;
    }

    renderPayPalButtons(
      orderId
    );
  }

  bannerBtn.addEventListener(
    'click',
    openSupporterForm
  );

  if (closeBtn)
    closeBtn.addEventListener(
      'click',
      closeSupporterForm
    );

  if (skipBtn)
    skipBtn.addEventListener(
      'click',
      function () {

        closeSupporterForm();

        openPayPal();
      }
    );

  if (submitBtn)
    submitBtn.addEventListener(
      'click',
      handleSubmit
    );

  overlay.addEventListener(
    'click',
    function (e) {

      if (
        e.target === overlay
      ) {

        closeSupporterForm();
      }
    }
  );

  document.addEventListener(
    'keydown',
    function (e) {

      if (
        e.key === 'Escape' &&
        overlay.classList.contains(
          'active'
        )
      ) {

        closeSupporterForm();
      }
    }
  );

  if (nameInput) {

    nameInput.addEventListener(
      'keydown',
      function (e) {

        if (
          e.key === 'Enter'
        ) {

          e.preventDefault();

          handleSubmit();
        }
      }
    );
  }

  /* ===========================
     TOP SUPPORTERS
  =========================== */

  async function loadTopSupporters() {

    try {

      const res =
        await fetch(

          PUBLIC_SUPPORTERS_ENDPOINT +

          '?select=name,amount,message' +

          '&status=eq.paid' +

          '&show_name=eq.true' +

          '&order=amount.desc' +

          '&limit=3',

          {

            headers: {

              apikey:
                SUPABASE_ANON,

              Authorization:
                'Bearer ' +
                SUPABASE_ANON
            }

          }
        );

      if (!res.ok)
        return;

      const supporters =
        await res.json();

      const container =
        document.getElementById(
          'top-supporters'
        );

      if (!container)
        return;

      if (
        supporters.length ===
        0
      ) {

        container.innerHTML =
          '<div class="supporter-loading">🏆 Be the first supporter!</div>';

        return;
      }

      const medals =
        [
          '🥇',
          '🥈',
          '🥉'
        ];

      const tiers =
        [
          'ts-gold',
          'ts-silver',
          'ts-bronze'
        ];

      container.innerHTML =
        '';

      supporters.forEach(
        (s, index) => {

          container.innerHTML += `
            <div class="ts-row ${
              tiers[index] || ''
            }">

              <div class="ts-medal">
                ${medals[index]}
              </div>

              <div class="ts-info">

                <div class="ts-name">
                  ${s.name}
                </div>

                ${
                  s.message
                    ? `<div class="ts-message">${s.message}</div>`
                    : ''
                }

              </div>

              <div class="ts-amount">
                $${s.amount}
              </div>

            </div>
          `;
        }
      );

    } catch (err) {

      console.error(err);
    }
  }

  loadTopSupporters();

  /* ===========================
     LIVE SUPPORT FEED
  =========================== */

  const LIVE_FEED_FETCH_LIMIT =
    20;

  const LIVE_FEED_VISIBLE =
    5;

  const LIVE_FEED_ROTATE_MS =
    3000;

  const LIVE_FEED_REFRESH_MS =
    15000;

  const liveFeedViewport =
    document.getElementById(
      'live-feed-viewport'
    );

  const liveFeedTrack =
    document.getElementById(
      'live-feed-track'
    );

  let liveFeedItems =
    [];

  let liveFeedSignature =
    '';

  let liveFeedRowHeight =
    52;

  let liveFeedIndex =
    0;

  let liveFeedRotateTimer =
    null;

  let liveFeedRefreshTimer =
    null;

  function liveFeedInitial(
    name
  ) {

    const trimmed =
      (name || '').trim();

    return trimmed
      ? trimmed.charAt(0).toUpperCase()
      : '💛';
  }

  function liveFeedEscape(
    str
  ) {

    const div =
      document.createElement(
        'div'
      );

    div.textContent =
      str == null
        ? ''
        : String(str);

    return div.innerHTML;
  }

  function buildLiveFeedRow(
    s
  ) {

    const row =
      document.createElement(
        'div'
      );

    row.className =
      'live-feed-row';

    row.innerHTML = `
      <div class="live-feed-avatar">
        ${
          liveFeedEscape(
            liveFeedInitial(
              s.name
            )
          )
        }
      </div>

      <div class="live-feed-info">

        <div class="live-feed-name-row">

          <span class="live-feed-name">
            ${
              liveFeedEscape(
                s.name ||
                'Anonymous'
              )
            }
          </span>

          <span class="live-feed-amount">
            $${liveFeedEscape(
              s.amount
            )}
          </span>

        </div>

        ${
          s.message
            ? `<div class="live-feed-message">${
                liveFeedEscape(
                  s.message
                )
              }</div>`
            : ''
        }

      </div>
    `;

    return row;
  }

  function stopLiveFeedTicker() {

    if (
      liveFeedRotateTimer
    ) {

      clearInterval(
        liveFeedRotateTimer
      );

      liveFeedRotateTimer =
        null;
    }
  }

  function renderLiveFeedTrack() {

    if (!liveFeedTrack)
      return;

    stopLiveFeedTicker();

    liveFeedTrack.style.transition =
      'none';

    liveFeedTrack.style.transform =
      'translateY(0)';

    liveFeedTrack.innerHTML =
      '';

    liveFeedIndex =
      0;

    if (
      liveFeedItems.length ===
      0
    ) {

      liveFeedTrack.innerHTML =
        '<div class="live-feed-empty">🔥 No support activity yet — be the first!</div>';

      return;
    }

    const doubled =
      liveFeedItems.concat(
        liveFeedItems
      );

    doubled.forEach(
      s =>
        liveFeedTrack.appendChild(
          buildLiveFeedRow(s)
        )
    );

    const firstRow =
      liveFeedTrack.querySelector(
        '.live-feed-row'
      );

    if (firstRow) {

      liveFeedRowHeight =
        firstRow.offsetHeight;
    }

    if (
      liveFeedItems.length >
      LIVE_FEED_VISIBLE
    ) {

      startLiveFeedTicker();
    }
  }

  function startLiveFeedTicker() {

    stopLiveFeedTicker();

    liveFeedRotateTimer =
      setInterval(
        () => {

          if (
            !liveFeedTrack ||
            liveFeedItems.length ===
              0
          ) {
            return;
          }

          liveFeedIndex +=
            1;

          liveFeedTrack.style.transition =
            'transform .6s cubic-bezier(.4,0,.2,1)';

          liveFeedTrack.style.transform =
            `translateY(-${
              liveFeedIndex *
              liveFeedRowHeight
            }px)`;

          if (
            liveFeedIndex >=
            liveFeedItems.length
          ) {

            const onDone =
              () => {

                liveFeedTrack
                  .removeEventListener(
                    'transitionend',
                    onDone
                  );

                liveFeedTrack.style.transition =
                  'none';

                liveFeedTrack.style.transform =
                  'translateY(0)';

                liveFeedIndex =
                  0;
              };

            liveFeedTrack
              .addEventListener(
                'transitionend',
                onDone
              );
          }

        },
        LIVE_FEED_ROTATE_MS
      );
  }

  async function loadLiveFeed() {

    if (!liveFeedTrack)
      return;

    try {

      const res =
        await fetch(

          PUBLIC_SUPPORTERS_ENDPOINT +

          '?select=id,name,amount,message,created_at' +

          '&status=eq.paid' +

          '&show_name=eq.true' +

          '&order=created_at.desc' +

          '&limit=' +
          LIVE_FEED_FETCH_LIMIT,

          {

            headers: {

              apikey:
                SUPABASE_ANON,

              Authorization:
                'Bearer ' +
                SUPABASE_ANON

            }

          }
        );

      if (!res.ok)
        return;

      const supporters =
        await res.json();

      const list =
        Array.isArray(
          supporters
        )
          ? supporters
          : [];

      const signature =
        list
          .map(
            s =>
              s.id +
              ':' +
              s.amount +
              ':' +
              s.show_name
          )
          .join('|');

      if (
        signature ===
          liveFeedSignature &&
        liveFeedTrack.children
          .length
      ) {

        return;
      }

      liveFeedSignature =
        signature;

      liveFeedItems =
        list;

      renderLiveFeedTrack();

    } catch (err) {

      console.error(err);
    }
  }

  function startLiveFeedAutoRefresh() {

    if (
      liveFeedRefreshTimer
    ) {

      clearInterval(
        liveFeedRefreshTimer
      );
    }

    liveFeedRefreshTimer =
      setInterval(
        loadLiveFeed,
        LIVE_FEED_REFRESH_MS
      );
  }

  if (liveFeedTrack) {

    loadLiveFeed();

    startLiveFeedAutoRefresh();
  }

})();

/* ============================================================
   GOOGLE ANALYTICS — EVENT TRACKING
============================================================ */

(function () {

  'use strict';

  function trackEvent(
    eventName,
    params
  ) {

    try {

      if (
        typeof gtag ===
        'function'
      ) {

        gtag(
          'event',
          eventName,
          params || {}
        );
      }

    } catch (err) {

      // fail silently
    }
  }

  /* ---- App Download buttons ---- */

  var modalDownloadBtn =
    document.getElementById(
      'modal-download'
    );

  var modalTitleEl =
    document.getElementById(
      'modal-title'
    );

  if (modalDownloadBtn) {

    modalDownloadBtn.addEventListener(
      'click',
      function () {

        if (
          modalDownloadBtn.dataset
            .comingSoon ===
          'true'
        ) {
          return;
        }

        var appName =
          modalTitleEl
            ? modalTitleEl.textContent
            : '';

        trackEvent(
          'download_app',
          {
            app_name:
              appName
          }
        );
      }
    );
  }

  /* ---- Support Project button ---- */

  var supportBtn =
    document.querySelector(
      '#banner-btn'
    );

  if (supportBtn) {

    supportBtn.addEventListener(
      'click',
      function () {

        trackEvent(
          'support_click'
        );
      }
    );
  }

  /* ---- Telegram button ---- */

  var telegramBtn =
    document.querySelector(
      '.social-btn.telegram'
    );

  if (telegramBtn) {

    telegramBtn.addEventListener(
      'click',
      function () {

        trackEvent(
          'telegram_click'
        );
      }
    );
  }

  /* ---- Facebook button ---- */

  var facebookBtn =
    document.querySelector(
      '.social-btn.facebook'
    );

  if (facebookBtn) {

    facebookBtn.addEventListener(
      'click',
      function () {

        trackEvent(
          'facebook_click'
        );
      }
    );
  }

  /* ---- YouTube button ---- */

  var youtubeBtn =
    document.querySelector(
      '.social-btn.youtube'
    );

  if (youtubeBtn) {

    youtubeBtn.addEventListener(
      'click',
      function () {

        trackEvent(
          'youtube_click'
        );
      }
    );
  }

})();

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
  const MODAL_TRIGGER_KEYS = ['code', 'username', 'password', 'activated', 'category', 'version', 'size', 'developer', 'updated'];

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
     CARD RENDERER
  ============================================================ */
  function createCard(app) {
    const hasModal = appHasModalFields(app) || isComingSoon(app);
    const cardComingSoon = isComingSoon(app);

    let el;
    if (hasModal) {
      el = document.createElement('div');
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
    } else {
      el = document.createElement('a');
      el.href   = app.url;
      el.target = '_blank';
      el.rel    = 'noopener noreferrer';
    }
    el.className = 'app-card';
    el.setAttribute('aria-label', `Open ${app.name}`);

    const badgeMarkup = cardComingSoon
      ? `<span class="card-badge" style="position:relative; z-index:1; background:linear-gradient(135deg,#a855f7,#7c3aed); color:#fff; border-color:transparent;">🚧 Coming Soon</span>`
      : `<span class="card-badge badge-${app.badge}" style="position:relative; z-index:1;">${
          app.badge === 'live'   ? 'Live'    :
          app.badge === 'new'    ? 'New'     :
          app.badge === 'update' ? 'Updated' : 'Hot'
        }</span>`;

    el.innerHTML = `
      ${cardComingSoon ? `<div style="position:absolute; inset:0; background:rgba(8,6,18,0.15); border-radius:inherit; pointer-events:none; z-index:0;"></div>` : ''}
      <div class="card-icon" style="background:${app.bg};${cardComingSoon ? ' position:relative; z-index:1;' : ''}">
  <img src="${app.icon}" alt="${app.name}" loading="lazy">
</div>
<span class="card-name"${cardComingSoon ? ' style="position:relative; z-index:1;"' : ''}>${app.name}</span>
${app.code ? `<span class="card-code"${cardComingSoon ? ' style="position:relative; z-index:1;"' : ''}>🔑 ${app.code}</span>` : ""}
${app.username ? `<span class="card-code"${cardComingSoon ? ' style="position:relative; z-index:1;"' : ''}>👤 Username : ${app.username}</span>` : ""}${badgeMarkup}
    `;

    if (cardComingSoon) {
      el.style.position = 'relative';
    }

    if (hasModal) {
      el.addEventListener('click', () => openAppModal(app));
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openAppModal(app);
        }
      });
    }

    return el;
  }

  /* ============================================================
     RENDER & FILTER
     Uses a DocumentFragment so the grid is rebuilt in a single
     reflow even when the list contains hundreds/thousands of apps.
  ============================================================ */
  const grid      = document.getElementById('cards-grid');
  const countPill = document.getElementById('count-pill');
  const noResults = document.getElementById('no-results');

  let APPS = [];

  function renderCards(list) {
    const fragment = document.createDocumentFragment();
    list.forEach(app => fragment.appendChild(createCard(app)));
    grid.innerHTML = '';
    grid.appendChild(fragment);

    const n = list.length;
    countPill.textContent = n === 1 ? '1 app' : `${n} apps`;
    noResults.classList.toggle('visible', n === 0);
  }

  /* ============================================================
     LIVE SEARCH
     A very short debounce keeps typing feeling instant while
     avoiding redundant renders when the list is very large.
  ============================================================ */
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');

  let searchDebounceTimer = null;

  function runSearch() {
    const q = searchInput.value.trim().toLowerCase();
    searchClear.classList.toggle('visible', q.length > 0);
    const filtered = q
      ? APPS.filter(a => a.name.toLowerCase().includes(q))
      : APPS;
    renderCards(filtered);
  }

  searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(runSearch, 60);
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchClear.classList.remove('visible');
    renderCards(APPS);
    searchInput.focus();
  });

  /* ============================================================
     APP MODAL — open / close / copy logic
  ============================================================ */
  const modalOverlay   = document.getElementById('modal-overlay');
  const appModal       = document.getElementById('app-modal');
  const modalIcon      = document.getElementById('modal-icon');
  const modalTitle     = document.getElementById('modal-title');
  const modalMetaGrid  = document.getElementById('modal-meta-grid');
  const modalFields    = document.getElementById('modal-fields');
  const modalDownload  = document.getElementById('modal-download');
  const modalDownloadDefaultText = modalDownload.innerHTML;
  const modalCloseBtn  = document.getElementById('modal-close');

  /* ---- compact spacing (Android TV / smaller screens) ----------------
     Reduces modal height ~25-30% by tightening internal padding and gaps.
     Scoped entirely to #app-modal — nothing else in the UI is affected.  */
  (function injectCompactModalStyles() {
    const s = document.createElement('style');
    s.id = 'compact-modal-styles';
    s.textContent = [
      '#app-modal                 { padding: 18px 20px 20px; gap: 12px; }',
      '#app-modal .modal-header   { gap: 10px; margin-bottom: 0; }',
      '#app-modal .modal-icon     { width: 54px; height: 54px; min-width: 54px; }',
      '#app-modal .modal-icon img { width: 36px; height: 36px; }',
      '#app-modal .modal-meta-grid{ gap: 6px; margin-bottom: 0; }',
      '#app-modal .modal-fields   { gap: 6px; margin-bottom: 0; }',
      '#app-modal .modal-field    { padding: 8px 10px; }',
      '#app-modal .modal-actions  { margin-top: 4px; gap: 8px; }',
      '#app-modal .modal-download { padding: 10px 16px; }',
    ].join('\n');
    document.head.appendChild(s);
  })();

  const SVG_COPY = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
  const SVG_CHECK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  const SVG_EYE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  const SVG_EYE_OFF = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

  // copyable secure fields → render with copy button
  const COPY_FIELDS = [
    { key: 'code',     label: 'Code' },
    { key: 'username', label: 'Username' },
    { key: 'password', label: 'Password', maskable: true },
  ];

  // simple meta fields → small 2-column grid
  const META_FIELDS = [
    { key: 'category',  label: 'Category' },
    { key: 'version',   label: 'Version' },
    { key: 'size',      label: 'Size' },
    { key: 'developer', label: 'Developer' },
    { key: 'updated',   label: 'Updated' },
    { key: 'activated', label: 'Activated' },
  ];

  async function copyToClipboard(text, btn) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const tmp = document.createElement('textarea');
        tmp.value = text;
        tmp.style.position = 'fixed';
        tmp.style.opacity = '0';
        document.body.appendChild(tmp);
        tmp.select();
        document.execCommand('copy');
        document.body.removeChild(tmp);
      }
      const original = btn.innerHTML;
      btn.innerHTML = SVG_CHECK;
      btn.classList.add('copied');
      setTimeout(() => {
        btn.innerHTML = original;
        btn.classList.remove('copied');
      }, 1500);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  }

  function openAppModal(app) {
    // header
    modalIcon.style.background = app.bg || 'var(--bg-card-hover)';
    modalIcon.innerHTML = `<img src="${app.icon}" alt="${app.name}">`;
    modalTitle.textContent = app.name;
    const modalBadge = document.getElementById("modal-badge");

    modalBadge.className = `card-badge badge-${app.badge}`;

    modalBadge.textContent =
      app.badge === "live" ? "Live" :
      app.badge === "new" ? "New" :
      app.badge === "update" ? "Updated" :
      "Hot";

    // meta grid (category / version / size / developer / updated / activated)
    modalMetaGrid.innerHTML = '';
    const comingSoon = isComingSoon(app);
    if (comingSoon) {
      // "Coming Soon" mode — show two informational cards instead of the
      // normal meta fields (category/version/size/developer/updated/activated).
      const enCard = document.createElement('div');
      enCard.className = 'modal-field';
      enCard.style.flexDirection = 'column';
      enCard.style.alignItems = 'flex-start';
      enCard.style.gap = '4px';
      enCard.innerHTML = `
        <div class="modal-field-info" style="width:100%; margin-top:0; padding-top:0;">
          <span class="modal-field-label" style="font-size:16px; font-weight:700; background:linear-gradient(135deg,#a855f7,#7c3aed); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; display:inline-block; line-height:1.3;">🚧 Application Coming Soon</span>
          <span class="modal-field-value" style="white-space:normal; line-height:1.6; display:block; margin-top:6px;">This application is currently<br>being uploaded.<br>Please check back later.<br>The latest version will be<br>available soon.</span>
        </div>
      `;
      modalMetaGrid.appendChild(enCard);

      const arCard = document.createElement('div');
      arCard.className = 'modal-field';
      arCard.style.flexDirection = 'column';
      arCard.style.alignItems = 'flex-start';
      arCard.style.gap = '4px';
      arCard.style.direction = 'rtl';
      arCard.style.textAlign = 'right';
      arCard.innerHTML = `
        <div class="modal-field-info" style="width:100%; margin-top:0; padding-top:0;">
          <span class="modal-field-label" style="font-size:16px; font-weight:700; background:linear-gradient(135deg,#a855f7,#7c3aed); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; display:inline-block; line-height:1.3; margin-top:0;">🚧 التطبيق قيد الرفع</span>
          <span class="modal-field-value" style="white-space:normal; line-height:1.6; display:block; margin-top:6px;">هذا التطبيق جارٍ رفعه حاليًا.<br>يرجى العودة لاحقًا.<br>سيتم توفير أحدث إصدار قريبًا.</span>
        </div>
      `;
      modalMetaGrid.appendChild(arCard);
    } else {
      META_FIELDS.forEach(({ key, label }) => {
        if (app[key] === undefined || app[key] === null || app[key] === '') return;
        const field = document.createElement('div');
        field.className = 'modal-field';
        field.innerHTML = `
          <div class="modal-field-info">
            <span class="modal-field-label">${label}</span>
            <span class="modal-field-value">${
  key === 'activated'
    ? (app[key] ? '🟢 Activated' : '🔴 Not Activated')
    : app[key]
}</span>
          </div>
        `;
        modalMetaGrid.appendChild(field);
      });
    }

    // copyable fields (code / username / password)
    modalFields.innerHTML = '';
    COPY_FIELDS.forEach(({ key, label, maskable }) => {
      if (app[key] === undefined || app[key] === null || app[key] === '') return;

      const field = document.createElement('div');
      field.className = 'modal-field';

      const valueSpan = document.createElement('span');
      valueSpan.className = 'modal-field-value' + (maskable ? ' is-password' : '');
      let realValue = String(app[key]);
      let masked = maskable;
      valueSpan.textContent = maskable ? '•'.repeat(Math.min(realValue.length, 12)) : realValue;

      const info = document.createElement('div');
      info.className = 'modal-field-info';
      const labelSpan = document.createElement('span');
      labelSpan.className = 'modal-field-label';
      labelSpan.textContent = label;
      info.appendChild(labelSpan);
      info.appendChild(valueSpan);

      const actions = document.createElement('div');
      actions.className = 'modal-field-actions';

      if (maskable) {
        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'modal-toggle-btn';
        toggleBtn.setAttribute('aria-label', 'Show/Hide password');
        toggleBtn.innerHTML = SVG_EYE;
        toggleBtn.addEventListener('click', () => {
          masked = !masked;
          valueSpan.textContent = masked ? '•'.repeat(Math.min(realValue.length, 12)) : realValue;
          toggleBtn.innerHTML = masked ? SVG_EYE : SVG_EYE_OFF;
        });
        actions.appendChild(toggleBtn);
      }

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'modal-copy-btn';
      copyBtn.setAttribute('aria-label', `Copy ${label}`);
      copyBtn.innerHTML = SVG_COPY;
      copyBtn.addEventListener('click', () => copyToClipboard(realValue, copyBtn));
      actions.appendChild(copyBtn);

      field.appendChild(info);
      field.appendChild(actions);
      modalFields.appendChild(field);
    });

    // download button
    if (comingSoon) {
      modalDownload.href = 'javascript:void(0)';
      modalDownload.removeAttribute('target');
      modalDownload.setAttribute('aria-disabled', 'true');
      modalDownload.dataset.comingSoon = 'true';
      modalDownload.style.pointerEvents = 'none';
      modalDownload.style.opacity = '0.55';
      modalDownload.style.cursor = 'not-allowed';
      modalDownload.textContent = '⏳ Coming Soon';
    } else {
      modalDownload.href = app.url || '#';
      modalDownload.removeAttribute('aria-disabled');
      delete modalDownload.dataset.comingSoon;
      modalDownload.style.pointerEvents = '';
      modalDownload.style.opacity = '';
      modalDownload.style.cursor = '';
      modalDownload.innerHTML = modalDownloadDefaultText;
    }

    // show
    modalOverlay.classList.add('active');
    modalOverlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    // Android TV / D-pad support: focus the first interactive element so the
    // remote's D-pad has something focused to navigate from immediately.
    setTimeout(() => {
      const focusable = getModalFocusableElements();
      if (focusable.length) focusable[0].focus();
    }, 0);
  }

  function closeAppModal() {
    modalOverlay.classList.remove('active');
    modalOverlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  // Android TV / D-pad support: collect the modal's interactive elements in
  // their natural document order (close button, copy/toggle buttons, download).
  function getModalFocusableElements() {
    if (!modalOverlay.classList.contains('active')) return [];
    const nodes = appModal.querySelectorAll(
      'button, a[href], [tabindex]:not([tabindex="-1"])'
    );
    return Array.prototype.filter.call(nodes, el => {
      return el.offsetParent !== null && el.getAttribute('aria-disabled') !== 'true';
    });
  }

  // close interactions: X button, click outside, Esc key
  modalCloseBtn.addEventListener('click', closeAppModal);

  modalDownload.addEventListener('click', (e) => {
    if (modalDownload.dataset.comingSoon === 'true') {
      e.preventDefault();
    }
  });

  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeAppModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
      closeAppModal();
    }
  });

  // Android TV remote (D-pad) navigation: many TV/Downloader WebViews don't
  // support spatial navigation, so map Arrow keys to move focus between the
  // modal's interactive elements in order. This only runs while the modal
  // is open and does not affect mouse/touch/keyboard(Tab) behavior at all.
  document.addEventListener('keydown', (e) => {
    if (!modalOverlay.classList.contains('active')) return;
    const isNavKey = ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(e.key);
    if (!isNavKey) return;

    const focusable = getModalFocusableElements();
    if (!focusable.length) return;

    const currentIndex = focusable.indexOf(document.activeElement);
    let nextIndex;

    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % focusable.length;
    } else {
      nextIndex = currentIndex === -1 ? 0 : (currentIndex - 1 + focusable.length) % focusable.length;
    }

    e.preventDefault();
    focusable[nextIndex].focus();
  });

  /* ============================================================
     APP DATA — loaded from apps.json so the library can scale to
     thousands of entries without touching index.html or script.js.
  ============================================================ */
  async function loadApps() {
    try {
      const res = await fetch('apps.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      APPS = await res.json();
    } catch (err) {
      console.error('Failed to load apps.json:', err);
      APPS = [];
      noResults.querySelector('p').textContent = 'Could not load the app list. Please try again later.';
      noResults.classList.add('visible');
    }
    renderCards(APPS);
  }

  loadApps();

  /* ============================================================
     GALAXY CANVAS — procedural star field with nebula clouds
  ============================================================ */
  (function () {
    const canvas = document.getElementById('galaxy-canvas');
    const ctx    = canvas.getContext('2d');

    let W, H, stars, nebula;

    /* ---- helpers ---- */
    const rand = (a, b) => Math.random() * (b - a) + a;

    /* ---- setup ---- */
    function resize() {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
      init();
    }

    function init() {
      /* stars */
      stars = Array.from({ length: 280 }, () => ({
        x:  rand(0, W),
        y:  rand(0, H),
        r:  rand(0.3, 1.6),
        a:  rand(0.2, 1),       // base opacity
        da: rand(0.002, 0.006), // twinkle speed
        t:  rand(0, Math.PI * 2), // twinkle phase
        c:  ['#ffffff','#c8b8ff','#b8d8ff','#ffd8b8'][Math.floor(rand(0,4))],
      }));

      /* nebula blobs */
      nebula = Array.from({ length: 6 }, () => ({
        x:  rand(0, W),
        y:  rand(0, H),
        r:  rand(W * 0.15, W * 0.38),
        c:  ['rgba(80,40,180,', 'rgba(120,30,160,', 'rgba(20,60,140,', 'rgba(60,20,100,'][Math.floor(rand(0,4))],
        a:  rand(0.04, 0.10),
      }));
    }

    /* ---- draw ---- */
    function draw(ts) {
      ctx.clearRect(0, 0, W, H);

      /* deep background */
      const bg = ctx.createRadialGradient(W*.5, H*.35, 0, W*.5, H*.35, Math.max(W,H)*.8);
      bg.addColorStop(0,   '#0e0824');
      bg.addColorStop(0.5, '#07051a');
      bg.addColorStop(1,   '#04040a');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      /* nebula clouds */
      nebula.forEach(n => {
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
        g.addColorStop(0,   n.c + n.a + ')');
        g.addColorStop(1,   n.c + '0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      });

      /* stars */
      const sec = ts * 0.001;
      stars.forEach(s => {
        const twinkle = s.a + 0.35 * Math.sin(sec * s.da * 60 + s.t);
        ctx.globalAlpha = Math.max(0.05, Math.min(1, twinkle));
        ctx.fillStyle   = s.c;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.globalAlpha = 1;
      requestAnimationFrame(draw);
    }

    /* ---- boot ---- */
    window.addEventListener('resize', resize);
    resize();
    requestAnimationFrame(draw);
  })();

  /* ============================================================
     SUPPORT POPUP
  ============================================================ */
  window.openSupport = function () {
    document.getElementById('supportModal').style.display = 'flex';
  };

  window.closeSupport = function () {
    document.getElementById('supportModal').style.display = 'none';
  };

  window.addEventListener('click', function (event) {
    const modal = document.getElementById('supportModal');
    if (event.target === modal) {
      closeSupport();
    }
  });

  /* ============================================================
     SUPPORT BANNER — language switcher (EN ↔ AR, every 3 s)
  ============================================================ */
  (function () {
    const bannerEn  = document.getElementById('banner-en');
    const bannerAr  = document.getElementById('banner-ar');
    const bannerBtn = document.getElementById('banner-btn-text');
    if (!bannerEn || !bannerAr || !bannerBtn) return;

    const HIDDEN = 'support-banner-slide--hidden';
    let showingEn = true;

    setInterval(function () {
      if (showingEn) {
        bannerEn.classList.add(HIDDEN);
        bannerAr.classList.remove(HIDDEN);
        bannerBtn.textContent = '❤️ ادعم المشروع';
      } else {
        bannerAr.classList.add(HIDDEN);
        bannerEn.classList.remove(HIDDEN);
        bannerBtn.textContent = '❤️ Support Project';
      }
      showingEn = !showingEn;
    }, 7000);
  })();

})();

/* ============================================================
   SUPPORTER FORM — Supabase integration
   Intercepts the existing banner-btn click, shows a small form,
   saves to Supabase, then opens PayPal regardless of outcome.
   No existing functionality is modified.
============================================================ */
(function () {
  'use strict';

  const SUPABASE_URL     = 'https://ypszdzznqaizopfulioa.supabase.co';
  const SUPABASE_ANON    = 'sb_publishable_EKEuf19RbGaaQ_xjN9VmhA_mkOY9t2q';
  const PAYPAL_URL       = 'https://www.paypal.com/paypalme/AnubisApps';
  const TABLE_ENDPOINT   = SUPABASE_URL + '/rest/v1/supporters';

  const bannerBtn        = document.getElementById('banner-btn');
  const overlay          = document.getElementById('supporter-form-overlay');
  const closeBtn         = document.getElementById('supporter-form-close');
  const skipBtn          = document.getElementById('supporter-skip-btn');
  const submitBtn        = document.getElementById('supporter-submit-btn');
  const submitLabel      = document.getElementById('supporter-submit-label');
  const nameInput        = document.getElementById('supporter-name');
  const messageInput     = document.getElementById('supporter-message');
  const showNameCheckbox = document.getElementById('supporter-show-name');
  const nameError        = document.getElementById('supporter-name-error');

  if (!bannerBtn || !overlay) return;

  /* ---- open / close ---- */
  function openSupporterForm(e) {
    e.preventDefault();
    resetForm();
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(function () { if (nameInput) nameInput.focus(); }, 60);
  }

  function closeSupporterForm() {
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function resetForm() {
    if (nameInput)        nameInput.value = '';
    if (messageInput)     messageInput.value = '';
    if (showNameCheckbox) showNameCheckbox.checked = true;
    if (nameError)        nameError.classList.remove('visible');
    if (nameInput)        nameInput.classList.remove('input-error');
    if (submitBtn)        submitBtn.disabled = false;
    if (submitLabel)      submitLabel.textContent = '❤️ Continue to PayPal';
  }

  /* ---- open PayPal in new tab (mirrors existing banner-btn behaviour) ---- */
  function openPayPal() {
    window.open(PAYPAL_URL, '_blank', 'noopener,noreferrer');
  }

  /* ---- Supabase insert (INSERT-only; anon role needs INSERT only)
     Returns true on success, false on failure so the caller can
     re-enable the submit button if the request fails.              ---- */
  async function saveToSupabase(name, message, showName) {
    try {
      const res = await fetch(TABLE_ENDPOINT, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'apikey':        SUPABASE_ANON,
          'Authorization': 'Bearer ' + SUPABASE_ANON,
          'Prefer':        'return=minimal',
        },
        body: JSON.stringify({
          name:      name,
          message:   message || null,
          show_name: showName,
          status:    'pending',
        }),
      });
      return res.ok;
    } catch (err) {
      console.warn('Supabase insert failed (non-blocking):', err);
      return false;
    }
  }

  /* ---- submit handler ---- */
  async function handleSubmit() {
    const name     = nameInput     ? nameInput.value.trim()     : '';
    const message  = messageInput  ? messageInput.value.trim()  : '';
    const showName = showNameCheckbox ? showNameCheckbox.checked : true;

    /* validate */
    if (!name) {
      if (nameError) nameError.classList.add('visible');
      if (nameInput) nameInput.classList.add('input-error');
      if (nameInput) nameInput.focus();
      return;
    }
    if (nameError) nameError.classList.remove('visible');
    if (nameInput) nameInput.classList.remove('input-error');

    /* disable immediately to prevent duplicate submissions */
    if (submitBtn)   submitBtn.disabled = true;
    if (submitLabel) submitLabel.textContent = 'Saving…';

    const ok = await saveToSupabase(name, message, showName);

    if (ok) {
      /* success — proceed to PayPal, button stays disabled */
      closeSupporterForm();
      openPayPal();
    } else {
      /* failure — re-enable so the user can try again */
      if (submitBtn)   submitBtn.disabled = false;
      if (submitLabel) submitLabel.textContent = '❤️ Continue to PayPal';
    }
  }

  /* ---- event listeners ---- */
  bannerBtn.addEventListener('click', openSupporterForm);

  if (closeBtn) closeBtn.addEventListener('click', closeSupporterForm);

  if (skipBtn) skipBtn.addEventListener('click', function () {
    closeSupporterForm();
    openPayPal();
  });

  if (submitBtn) submitBtn.addEventListener('click', handleSubmit);

  /* close on backdrop click */
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeSupporterForm();
  });

  /* close on Escape */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay.classList.contains('active')) {
      closeSupporterForm();
    }
  });

  /* Enter in name field submits */
  if (nameInput) {
    nameInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); }
    });
  }

})();

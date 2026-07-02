# Changelog — ANUBIS APP LIBRARY

All notable changes to this project are documented in this file.

Format: `[Version] — Release Date`

---

## [1.0.0] — 2026

### 🚀 Initial Release

**Core Library**
- Curated app library for Android TV & Google TV.
- All app data loaded dynamically from `apps.json` — no code changes needed to add or update apps.
- Animated galaxy background with procedural star field and nebula clouds rendered on HTML5 `<canvas>`.

**App Cards**
- Responsive card grid rendering app icon, name, and status badge.
- Badge types: Live, New, Updated, Hot.
- Coming Soon mode: apps with `"url": "#"` or `"url": ""` display a dimmed card with a `🚧 Coming Soon` badge automatically.
- Full brightness preserved for icon and app name on Coming Soon cards.

**Search**
- Live, debounced search filtering the full app list in real time.
- App count pill updates dynamically.
- Clear button resets search instantly.

**App Detail Modal**
- Opens on card click for apps that have modal fields.
- Displays: category, version, size, developer, updated date, activation status.
- Copyable credential fields: code, username, password.
- Password show/hide toggle.
- One-click copy to clipboard with visual confirmation.
- Direct download button linking to the app's APK or URL.

**Coming Soon Modal**
- Bilingual informational cards (English + Arabic) shown inside the modal for Coming Soon apps.
- Download button replaced with a disabled `⏳ Coming Soon` button.
- Switches to normal modal automatically when a real URL is added to `apps.json`.

**Support Banner**
- Premium dark/purple card displayed below the social links in the header.
- Alternates smoothly between English and Arabic every 7 seconds with a fade transition.
- Gold "Support Project" button linking to the PayPal donation page.
- Proper RTL handling for the Arabic title.

**Android TV & Downloader Compatibility**
- Full D-pad / remote control navigation support.
- Modal auto-focuses the first interactive element on open.
- Arrow key traversal cycles through all interactive modal elements (close, copy, toggle, download).
- Compact modal spacing to keep the Download button visible on smaller TV screens.

**Accessibility**
- ARIA roles and labels throughout.
- Keyboard navigation: Enter/Space on cards, Escape to close modal.
- Screen-reader-friendly live region for search results.

**Social & Support**
- Header links to Telegram, YouTube, and Facebook channels.
- PayPal support popup.
- Support banner with PayPal donation link.

**Project Files**
- `index.html` — Main structure.
- `style.css` — Full dark/purple design system, zero external CSS dependencies.
- `script.js` — All logic, vanilla JS, no frameworks, no build step.
- `apps.json` — Data file; the only file that needs editing for day-to-day updates.
- `LICENSE` — Proprietary All Rights Reserved license.
- `README.md` — Project documentation.
- `SECURITY.md` — Responsible disclosure policy.
- `CHANGELOG.md` — This file.

---

*For the latest updates, follow the official channels:*  
[Telegram](https://t.me/AnubisDZTech) · [YouTube](https://www.youtube.com/@ANUBIS_dz_tech) · [Facebook](https://www.facebook.com/Anubis.dz.Tech)

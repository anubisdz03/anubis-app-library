# ANUBIS APP LIBRARY

<p align="center">
  <img src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhm-PCrImQHv107fSWJJ_5JfXrij4yKeoZoPKagQ7KCYEX9UcCtEIgAmLfkKJnM_nTV5bbhM3ouA7SKZ4ZdCVxYQezQuFFe49BGC7IfcUf4SFyozw8FEtvsO6qcNvYBRTGJiGd_6muyqRe_E9sMMKXWURj6Yhdsgq5NmahABrj0s1X24SRi_gQfbuQCdh_f/s300/ChatGPT%20Image%20Jun%206,%202026,%2001_45_58%20PM.png" alt="ANUBIS APP LIBRARY" width="100" style="border-radius:50%;" />
</p>

<p align="center">
  <strong>A premium, curated app library for Android TV &amp; Google TV.</strong><br/>
  Discover the best entertainment apps for live TV, movies, and series.
</p>

<p align="center">
  <a href="https://anubisdz03.github.io/anubis-app-library/">🌐 Official Website</a> ·
  <a href="https://t.me/AnubisDZTech">📱 Telegram</a> ·
  <a href="https://www.youtube.com/@ANUBIS_dz_tech">▶️ YouTube</a> ·
  <a href="https://www.facebook.com/Anubis.dz.Tech">📘 Facebook</a>
</p>

---

## ✨ Features

- **Curated App Library** — A growing collection of the best Android TV & Google TV apps, all in one place.
- **Live Search** — Instant, debounced search that filters hundreds of apps in real time with no page reload.
- **App Detail Modal** — Each app opens a detail modal showing category, version, size, developer, activation status, credentials, and a direct download button.
- **Copy to Clipboard** — One-click copy for codes, usernames, and passwords directly from the modal.
- **Password Toggle** — Show/hide password fields inside the modal.
- **Coming Soon System** — Apps not yet available display a bilingual (English/Arabic) "Coming Soon" card instead of download details. Switches automatically when a real URL is added to `apps.json`.
- **Bilingual Support Banner** — A support banner that smoothly alternates between English and Arabic every 7 seconds.
- **Animated Galaxy Background** — Procedural star field with nebula clouds rendered on a `<canvas>`.
- **Android TV & Downloader Compatible** — Full D-pad / remote navigation support with auto-focus and arrow-key traversal inside modals.
- **Zero Dependencies** — Vanilla HTML, CSS, and JavaScript. No frameworks, no build step.
- **Data-Driven** — All app data lives in a single `apps.json` file. Update apps without touching any code.

---

## 📸 Screenshots

> *(Add screenshots here)*

| Home Screen | App Modal | Coming Soon |
|:-----------:|:---------:|:-----------:|
| ![Home](screenshots/home.png) | ![Modal](screenshots/modal.png) | ![Coming Soon](screenshots/coming-soon.png) |

---

## 🚀 Installation

1. **Clone or download** the repository.
2. Place all files on any static web host (GitHub Pages, Netlify, Vercel, etc.).
3. Edit `apps.json` to add your apps (see below).
4. No build step required — open `index.html` directly or serve via any HTTP server.

### Local Development

```bash
# Using Python (built-in)
python3 -m http.server 8080

# Using Node.js (npx)
npx serve .
```

Then open `http://localhost:8080` in your browser.

---

## 📝 Updating Apps (`apps.json`)

All app data is stored in `apps.json`. Each entry follows this structure:

```json
{
  "name": "App Name",
  "icon": "https://link-to-icon.png",
  "bg": "#1a1a2e",
  "badge": "live",
  "url": "https://download-link.apk",
  "category": "IPTV",
  "version": "1.0.0",
  "size": "25 MB",
  "developer": "Developer Name",
  "updated": "2026-01-01",
  "activated": true,
  "code": "ABC123",
  "username": "user",
  "password": "pass"
}
```

**Badge values:** `live` · `new` · `update` · `hot`

**Coming Soon mode:** Set `"url": "#"` or `"url": ""` to display the Coming Soon card automatically. Replace with a real URL to switch the app to normal mode instantly — no code changes needed.

---

## 📁 Folder Structure

```
anubis-app-library/
├── index.html        # Main HTML structure
├── style.css         # All styles (dark/purple theme)
├── script.js         # All JavaScript logic
├── apps.json         # App data — the only file you need to edit
├── favicon.png       # Site favicon
├── LICENSE           # Proprietary license
├── README.md         # This file
├── SECURITY.md       # Security disclosure policy
└── CHANGELOG.md      # Version history
```

---

## 🔒 License

This project is **proprietary and All Rights Reserved.**

© 2026 B. Nacereddine — ANUBIS APP LIBRARY

You may **not** copy, modify, redistribute, or use this project commercially without explicit written permission. See [LICENSE](LICENSE) for full terms.

---

## 🌐 Official Website

[https://anubisdz03.github.io/anubis-app-library/](https://anubisdz03.github.io/anubis-app-library/)

---

## 📬 Contact

| Platform | Link |
|----------|------|
| Telegram | [t.me/AnubisDZTech](https://t.me/AnubisDZTech) |
| YouTube  | [youtube.com/@ANUBIS_dz_tech](https://www.youtube.com/@ANUBIS_dz_tech) |
| Facebook | [facebook.com/Anubis.dz.Tech](https://www.facebook.com/Anubis.dz.Tech) |

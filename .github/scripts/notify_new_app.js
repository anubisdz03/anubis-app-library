'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const APPS_JSON_PATH = path.join(process.cwd(), 'apps.json');
const ICON_RAW_BASE =
  'https://raw.githubusercontent.com/anubisdz03/anubis-app-library/main/';

/**
 * Safely parse a JSON string, returning null on failure instead of throwing.
 */
function safeParseJson(raw) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch (err) {
    return null;
  }
}

/**
 * Build a stable unique key for an app entry so we can diff old vs new lists.
 */
function appKey(app) {
  if (!app || typeof app !== 'object') return null;
  if (app.code) return `code:${app.code}`;
  if (app.url) return `url:${app.url}`;
  if (app.name) return `name:${app.name}`;
  return null;
}

function readCurrentApps() {
  let raw;
  try {
    raw = fs.readFileSync(APPS_JSON_PATH, 'utf8');
  } catch (err) {
    console.error(`❌ Unable to read apps.json: ${err.message}`);
    return null;
  }

  const parsed = safeParseJson(raw);
  if (parsed === null) {
    console.error('❌ apps.json could not be parsed as a valid JSON array.');
    return null;
  }
  return parsed;
}

/**
 * Fetch the previous version of apps.json from the last commit.
 * Returns null (not an error) if it cannot be retrieved, e.g. first commit
 * or shallow clone without history for the file.
 */
function readPreviousApps() {
  let raw;
  try {
    raw = execSync('git show HEAD~1:apps.json', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch (err) {
    console.log('ℹ️ No previous version of apps.json found (first commit or unavailable history).');
    return null;
  }

  const parsed = safeParseJson(raw);
  if (parsed === null) {
    console.log('ℹ️ Previous apps.json could not be parsed, treating as no previous data.');
    return null;
  }
  return parsed;
}

function findNewApps(currentApps, previousApps) {
  if (!previousApps) return [];

  const previousKeys = new Set(
    previousApps.map(appKey).filter((key) => key !== null)
  );

  return currentApps.filter((app) => {
    const key = appKey(app);
    return key !== null && !previousKeys.has(key);
  });
}

function buildMessage(app) {
  const name = app.name || 'N/A';
  const category = app.category || 'N/A';
  const version = app.version || 'N/A';
  const size = app.size || 'N/A';

  return [
    '🚀 تم رفع تطبيق جديد في مكتبتنا',
    `📺 ${name}`,
    `📂 ${category}`,
    `⭐ الإصدار: ${version}`,
    `💾 الحجم: ${size}`,
    '━━━━━━━━━━━━━━━━━━',
    '📥 للتثبيت افتح تطبيق Downloader',
    '🔢 Downloader Code',
    '8768043',
    '━━━━━━━━━━━━━━━━━━',
    '🔥 ANUBIS APP LIBRARY',
  ].join('\n');
}

/**
 * Resolve an app's icon path/URL into a full raw.githubusercontent.com URL.
 * Already-absolute URLs are returned unchanged.
 */
function resolveIconUrl(icon) {
  if (!icon || typeof icon !== 'string') return null;
  if (icon.startsWith('http://') || icon.startsWith('https://')) return icon;
  const cleaned = icon.startsWith('/') ? icon.substring(1) : icon;
  return `${ICON_RAW_BASE}${cleaned}`;
}

function sendTelegramPhoto(botToken, chatId, photoUrl, caption) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      chat_id: chatId,
      photo: photoUrl,
      caption,
    });

    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${botToken}/sendPhoto`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body);
        } else {
          reject(new Error(`Telegram API responded with status ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(payload);
    req.end();
  });
}

async function main() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.error('❌ Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID environment variables.');
    process.exit(1);
    return;
  }

  const currentApps = readCurrentApps();
  if (currentApps === null) {
    console.error('❌ Exiting gracefully because apps.json is invalid or missing.');
    process.exit(0);
    return;
  }

  const previousApps = readPreviousApps();
  const newApps = findNewApps(currentApps, previousApps);

  if (newApps.length === 0) {
    console.log('✅ No new apps detected. Nothing to notify.');
    process.exit(0);
    return;
  }

  console.log(`📢 Found ${newApps.length} new app(s). Sending Telegram notifications...`);

  for (const app of newApps) {
    const caption = buildMessage(app);
    const photoUrl = resolveIconUrl(app.icon);

    if (!photoUrl) {
      console.error(`❌ Skipping photo send for ${app.name || 'Unnamed app'}: no valid icon URL.`);
      continue;
    }

    try {
      await sendTelegramPhoto(botToken, chatId, photoUrl, caption);
      console.log(`✅ Notified: ${app.name || 'Unnamed app'}`);
    } catch (err) {
      console.error(`❌ Failed to send photo notification for ${app.name || 'Unnamed app'}: ${err.message}`);
      // Continue execution and never fail the GitHub Action because of this.
    }
  }
}

main().catch((err) => {
  console.error(`❌ Unexpected error: ${err.message}`);
  process.exit(0);
});

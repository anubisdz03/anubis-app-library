/**
 * youtube_notify.js
 * ---------------------------------------------------------------------------
 * Checks a YouTube channel's public RSS feed for the newest video and, if it
 * hasn't been posted before, sends a notification to a Telegram chat via the
 * existing Telegram Bot.
 *
 * Flow:
 *   1. Fetch & parse the YouTube RSS feed for the channel.
 *   2. Read the last posted video id from a small local state file.
 *   3. If the newest video id === last posted id -> nothing to do, exit 0.
 *   4. If the state file doesn't exist yet (first run) -> just record the
 *      current newest video as the baseline WITHOUT sending a Telegram
 *      message, so the automation doesn't "backfill-post" an old video the
 *      first time it runs. (See POST_ON_FIRST_RUN below if you want the
 *      opposite behavior.)
 *   5. Otherwise -> send the Telegram message, then update the state file.
 *
 * Environment variables (provided by the workflow):
 *   TELEGRAM_BOT_TOKEN  - required
 *   TELEGRAM_CHAT_ID    - required
 *   YOUTUBE_CHANNEL_ID  - optional, falls back to the hardcoded channel id
 *   POST_ON_FIRST_RUN   - optional, "true" to send a message even on the
 *                         very first run (default: false)
 *
 * Exit codes:
 *   0 - success (whether or not a new video was found/posted)
 *   1 - a real error occurred (network failure, bad config, Telegram API
 *       error, etc.) so the Actions run is flagged as failed and visible
 *       in the logs.
 * ---------------------------------------------------------------------------
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const Parser = require('rss-parser');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CHANNEL_ID =
  process.env.YOUTUBE_CHANNEL_ID || 'UCz7Q8mpWfogkgSaZdBbxOVw';

const RSS_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const POST_ON_FIRST_RUN =
  String(process.env.POST_ON_FIRST_RUN || 'false').toLowerCase() === 'true';

// State file lives alongside this script's repo, under .github/state/.
// It is created automatically on first run, and this script itself commits
// and pushes it back to the repository (see commitAndPushState below) so
// the state survives across workflow runs.
const STATE_DIR = path.join(__dirname, '..', 'state');
const STATE_FILE = path.join(STATE_DIR, 'last_video.json');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Reads the persisted state (last posted video id), if any.
 * Returns null if the file doesn't exist or is unreadable/corrupt.
 */
function readState() {
  try {
    if (!fs.existsSync(STATE_FILE)) {
      console.log(`[state] No state file found at ${STATE_FILE} (first run).`);
      return null;
    }
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.lastVideoId !== 'string') {
      console.warn('[state] State file exists but is malformed. Treating as empty.');
      return null;
    }
    console.log(`[state] Last posted video id: ${parsed.lastVideoId}`);
    return parsed;
  } catch (err) {
    console.warn(`[state] Failed to read/parse state file: ${err.message}`);
    return null;
  }
}

/**
 * Persists the newest video id so it is never posted again, then commits
 * and pushes that state file back to the repository so it survives future
 * workflow runs (each run gets a fresh checkout, so anything not committed
 * to the repo would otherwise be lost).
 */
function writeState(videoId, title) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const payload = {
    lastVideoId: videoId,
    lastVideoTitle: title,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(STATE_FILE, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(`[state] State file updated -> ${videoId}`);

  commitAndPushState();
}

/**
 * Commits and pushes the updated .github/state/last_video.json file back to
 * the repository using the Git CLI (child_process.execSync). This is what
 * makes the "last posted video" state survive across workflow runs, since
 * each run starts from a fresh checkout of the repo.
 *
 * - Uses the github-actions[bot] identity.
 * - Treats "nothing to commit" as an expected, non-fatal outcome.
 * - Never throws: any Git failure is logged and swallowed so the workflow
 *   never fails just because of state persistence.
 */
function commitAndPushState() {
  try {
    console.log('[git] Ensuring .github/state directory exists...');
    fs.mkdirSync(STATE_DIR, { recursive: true });

    console.log('[git] Configuring git user identity...');
    execSync('git config user.name "github-actions[bot]"', { stdio: 'inherit' });
    execSync(
      'git config user.email "41898282+github-actions[bot]@users.noreply.github.com"',
      { stdio: 'inherit' }
    );

    console.log('[git] Staging .github/state/last_video.json...');
    execSync('git add .github/state/last_video.json', { stdio: 'inherit' });

    console.log('[git] Attempting to commit state changes...');
    try {
      execSync('git commit -m "Update last YouTube video state"', {
        stdio: 'inherit',
      });
      console.log('[git] Commit created successfully.');
    } catch (commitErr) {
      // "git commit" exits non-zero when there is nothing new to commit
      // (state file unchanged). That's an expected, normal situation here.
      console.log(
        '[git] Nothing to commit (state file already up to date). Continuing normally.'
      );
    }

    console.log('[git] Pushing changes to remote...');
    execSync('git push', { stdio: 'inherit' });
    console.log('[git] Push completed successfully.');
  } catch (err) {
    // Any other Git failure (auth, network, conflict, etc.) is logged but
    // does not crash the run — the Telegram notification (the important
    // part) has already succeeded by the time this is called.
    console.error(`[git] Git operation failed: ${err.message}`);
    console.error('[git] Continuing without failing the workflow run.');
  }
}

/**
 * Extracts a YouTube video id from an item returned by rss-parser.
 * Prefers the dedicated <yt:videoId> field; falls back to parsing it out
 * of the item link if that field is ever missing.
 */
function extractVideoId(item) {
  if (item.videoId) return item.videoId;

  const link = item.link || item.id || '';
  const match = link.match(/[?&]v=([^&]+)/);
  if (match) return match[1];

  // Atom "yt:videoId" sometimes lands in item.id as "yt:video:VIDEO_ID"
  const idMatch = (item.id || '').match(/video:([A-Za-z0-9_-]+)/);
  if (idMatch) return idMatch[1];

  return null;
}

/**
 * Fetches and parses the channel's RSS feed, returning the newest video's
 * { id, title, url }, or null if the feed has no items.
 */
async function fetchLatestVideo() {
  console.log(`[rss] Fetching feed: ${RSS_URL}`);

  const response = await fetch(RSS_URL);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch YouTube RSS feed. HTTP ${response.status} ${response.statusText}`
    );
  }
  const xml = await response.text();

  const parser = new Parser({
    customFields: {
      item: [['yt:videoId', 'videoId']],
    },
  });

  const feed = await parser.parseString(xml);

  if (!feed.items || feed.items.length === 0) {
    console.log('[rss] Feed parsed successfully but contains no items.');
    return null;
  }

  // YouTube's RSS feed already lists the newest video first.
  const newest = feed.items[0];
  const videoId = extractVideoId(newest);

  if (!videoId) {
    throw new Error('Could not determine video id from the newest RSS item.');
  }

  const url = newest.link || `https://www.youtube.com/watch?v=${videoId}`;

  console.log(`[rss] Newest video found: "${newest.title}" (${videoId})`);

  return {
    id: videoId,
    title: newest.title || 'Untitled video',
    url,
  };
}

/**
 * Sends a formatted message to the configured Telegram chat using the
 * existing bot (Bot API, no external/paid service involved).
 */
async function sendTelegramMessage(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    throw new Error(
      'Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID environment variable(s).'
    );
  }

  const endpoint = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  console.log('[telegram] Sending notification message...');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text,
      disable_web_page_preview: false,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.ok === false) {
    throw new Error(
      `Telegram API error. HTTP ${response.status}. Response: ${JSON.stringify(data)}`
    );
  }

  console.log('[telegram] Message sent successfully.');
}

/**
 * Builds the exact message format required for new video announcements.
 */
function buildMessage(video) {
  return `🎬 New Video Published!\n\n📺 ${video.title}\n\n▶️ Watch now:\n${video.url}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== YouTube -> Telegram Notifier: starting run ===');
  console.log(`[config] Channel ID: ${CHANNEL_ID}`);

  const latest = await fetchLatestVideo();

  if (!latest) {
    console.log('[result] No videos found in feed. Nothing to do. Exiting cleanly.');
    return;
  }

  const state = readState();

  // ---- First run: no state file exists yet -------------------------------
  if (state === null) {
    if (POST_ON_FIRST_RUN) {
      console.log('[decision] First run, POST_ON_FIRST_RUN=true -> sending notification.');
      await sendTelegramMessage(buildMessage(latest));
    } else {
      console.log(
        '[decision] First run detected. Recording current newest video as the ' +
        'baseline WITHOUT sending a Telegram message (avoids posting an old ' +
        'video on setup). Future new uploads will be posted normally.'
      );
    }
    writeState(latest.id, latest.title);
    console.log('=== Run complete ===');
    return;
  }

  // ---- Subsequent runs: compare against last posted video ---------------
  if (latest.id === state.lastVideoId) {
    console.log('[result] No new video since last check. Exiting cleanly.');
    return;
  }

  console.log(`[result] New video detected: "${latest.title}" (${latest.id})`);
  await sendTelegramMessage(buildMessage(latest));
  writeState(latest.id, latest.title);

  console.log('=== Run complete: new video posted successfully ===');
}

main().catch((err) => {
  console.error('[fatal] Notifier run failed with an error:');
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});

// Local-storage gamification stats: daily checkmark, streak, accuracy trend.
// See docs/quiz.md#completion-side-effects for the completion
// contract this consumes (MAR-13's `daily-trivia:quiz-completed` event and
// the `daily-trivia:quiz:completed:<date>` checkmark key).
const STATS_KEY = "daily-trivia:stats:v1";
const COMPLETION_PREFIX = "daily-trivia:quiz:completed:";
const COLLECTION_CACHE_KEY = "daily-trivia:collected";
const HISTORY_LIMIT = 30;
const TREND_LENGTH = 10;

// Seeded from collection.js's cache (see assets/js/collection.js) so the
// count is available on first paint; kept current after that by the
// "daily-trivia:collection-count" event collection.js dispatches whenever
// the signed-in user's collected facts change.
let collectionCount = loadCachedCollectionCount();

function loadCachedCollectionCount() {
  try {
    const raw = localStorage.getItem(COLLECTION_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && Array.isArray(parsed.ids) ? parsed.ids.length : null;
  } catch (error) {
    return null;
  }
}

// Local calendar date (not UTC) — must match the date quiz.js keys the
// completion checkmark and event by, or completions can land on the wrong
// day near midnight and corrupt the streak / trend history.
function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(dateStr, delta) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return { entries: Array.isArray(parsed && parsed.entries) ? parsed.entries : [] };
  } catch (error) {
    return { entries: [] };
  }
}

function saveStats(stats) {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch (error) {
    // localStorage unavailable — stats won't persist this session.
  }
}

function recordCompletion(date, total, correct) {
  const stats = loadStats();
  const entries = stats.entries
    .filter((entry) => entry.date !== date)
    .concat([{ date, total, correct }])
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-HISTORY_LIMIT);
  saveStats({ entries });
  return entries;
}

// A streak is unbroken as long as every day since the most recent
// completion has been completed — completing "today" or "yesterday" keeps
// it alive (today may still be in progress), any earlier gap breaks it.
function computeStreak(entries, today) {
  const dates = new Set(entries.map((entry) => entry.date));
  if (dates.size === 0) return 0;

  let anchor = today;
  if (!dates.has(anchor)) {
    anchor = addDays(anchor, -1);
    if (!dates.has(anchor)) return 0;
  }

  let streak = 0;
  let cursor = anchor;
  while (dates.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function isCompletedToday() {
  try {
    return Boolean(localStorage.getItem(COMPLETION_PREFIX + todayStr()));
  } catch (error) {
    return false;
  }
}

function accuracyOf(entry) {
  return entry.total > 0 ? Math.round((entry.correct / entry.total) * 100) : 0;
}

function renderWidget(root) {
  const { entries } = loadStats();
  const streak = computeStreak(entries, todayStr());
  const completedToday = isCompletedToday();
  const recent = entries.slice(-TREND_LENGTH);
  const latest = recent[recent.length - 1];

  const bars = recent
    .map((entry) => {
      const pct = accuracyOf(entry);
      return `<span class="stats-bar" style="--pct: ${pct}%" title="${entry.date}: ${entry.correct}/${entry.total} (${pct}%)"></span>`;
    })
    .join("");

  root.innerHTML = `
    <div class="stats-panel">
      <div class="stats-top-row">
        <div class="stats-check${completedToday ? " is-done" : ""}">
          <span class="stats-check-icon" aria-hidden="true">${completedToday ? "&check;" : "&#9675;"}</span>
          <span class="stats-check-label">${completedToday ? "Today's quiz done" : "Quiz not done yet today"}</span>
        </div>
        <div class="stats-row">
          <div class="stats-figure">
            <span class="stats-figure-value">${streak}</span>
            <span class="stats-figure-label">day streak</span>
          </div>
          <div class="stats-figure">
            <span class="stats-figure-value">${latest ? `${accuracyOf(latest)}%` : "—"}</span>
            <span class="stats-figure-label">last score</span>
          </div>
        </div>
        ${recent.length ? `<div class="stats-trend" aria-label="Accuracy trend over recent quizzes">${bars}</div>` : ""}
      </div>
      ${collectionCount !== null ? `
      <div class="stats-collected-row">
        <span class="stats-figure-value">${collectionCount}</span>
        <span class="stats-figure-label">facts collected</span>
      </div>` : ""}
    </div>
  `;
}

function renderAll() {
  document.querySelectorAll("[data-stats-root]").forEach(renderWidget);
}

function init() {
  window.addEventListener("daily-trivia:quiz-completed", function (event) {
    const { date, total, correct } = event.detail;
    recordCompletion(date, total, correct);
    renderAll();
  });

  window.addEventListener("daily-trivia:collection-count", function (event) {
    collectionCount = event.detail.count;
    renderAll();
  });

  renderAll();
}

document.addEventListener("DOMContentLoaded", init);

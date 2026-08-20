/* The daily board: one puzzle, one mode, the same for everyone, rolling at local midnight. */

const EPOCH = [2026, 7, 19];        // 2026-08-19, month is 0-indexed
const STORE_KEY = 'triop.daily.v2';
const LEGACY_KEY = 'triop.daily.v1';
const KEEP_DAYS = 90;
const SITE = 'https://chenhsieh.github.io/triop-game/';

/** Days since the epoch, using local midnight so the puzzle rolls over when the player's date does. */
export function dayNumber(now = new Date()) {
  const start = new Date(EPOCH[0], EPOCH[1], EPOCH[2]).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.floor((today - start) / 86400000) + 1;
}

/** Which mode today's board uses. Rotating keeps all four in circulation. */
export const modeForDay = (day, modeIds) => modeIds[((day - 1) % modeIds.length + modeIds.length) % modeIds.length];

/* Seeds are per day AND per mode id, so a rotation change never silently
 * reuses another day's board. */
export function seedFor(day, modeId) {
  let h = 2166136261 ^ day;
  for (const ch of modeId) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/*
 * History, not just today. The previous version wrote a single result and
 * overwrote it every day, which threw away every past day — so a streak was not
 * merely missing, it was not computable. The outer loop of this game is "come
 * back tomorrow", and it had no memory at all.
 */
export function loadHistory() {
  let history = {};
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (raw && raw.days) history = raw.days;
  } catch { /* fall through to the legacy read */ }
  try {
    // One-time migration: the v1 key held only the most recent day.
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null');
    if (legacy && legacy.day && !history[legacy.day]) history[legacy.day] = legacy;
  } catch { /* ignore */ }
  return history;
}

export function loadResult(day) {
  return loadHistory()[day] || null;
}

export function saveResult(result) {
  const history = loadHistory();
  history[result.day] = result;
  // Keep the store bounded; a streak never needs more than the recent run.
  const days = Object.keys(history).map(Number).sort((a, b) => b - a).slice(0, KEEP_DAYS);
  const trimmed = {};
  days.forEach((d) => { trimmed[d] = history[d]; });
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ days: trimmed })); } catch { /* private mode */ }
}

/**
 * Consecutive days solved, counting back from today. Today being unplayed does
 * not break a streak — it is not over until the day is. A day played and lost
 * does break it.
 */
export function streak(today, history = loadHistory()) {
  let day = today;
  if (!history[day]) day -= 1;          // today is still open
  let n = 0;
  while (history[day] && history[day].won) { n += 1; day -= 1; }
  return n;
}

/** Days recorded, whether solved or not. */
export const daysPlayed = (history = loadHistory()) => Object.keys(history).length;

/*
 * One number and a named outcome. The card used to carry the progress fraction
 * *and* the points, and two numbers a reader cannot rank against each other stop
 * the card working as a currency. Points stay in the game; the card gets the
 * outcome.
 */
export function shareText({ day, modeName, grid, detail, outcome }) {
  return [`TriOp #${day} · ${modeName}`, grid, `${detail} — ${outcome}`, SITE].join('\n');
}

/** Clipboard with a synchronous fallback for browsers that refuse the async API. */
export async function copy(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch { return false; }
}

/* The daily board: one puzzle, one mode, the same for everyone, rolling at local midnight. */

const EPOCH = [2026, 7, 19];        // 2026-08-19, month is 0-indexed
const STORE_KEY = 'triop.daily.v1';
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

export function loadResult(day) {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    return raw && raw.day === day ? raw : null;
  } catch { return null; }
}

export function saveResult(result) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(result)); } catch { /* private mode */ }
}

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

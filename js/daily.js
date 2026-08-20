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

/* ---------- restore codes ----------
 * The daily history lives in localStorage, so it dies when you switch device or
 * clear the browser. A restore code is the whole of it as one paste-able string:
 * no account, no server, and the promise that nothing leaves your browser stays
 * literally true — the string only goes where you put it.
 *
 * The mode list below is part of the code format. Append only: reordering it
 * would silently reinterpret every code already in circulation.
 */
const CODE_PREFIX = 'TRIOP1';
const CODE_MODES = ['ladder', 'classic', 'sprint', 'deduce'];

const toB64 = (text) => {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromB64 = (b64) => {
  const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

/** FNV-1a, so a truncated or mistyped paste is rejected instead of half-imported. */
function checksum(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

/*
 * The payload is a compact text format rather than JSON: repeated `detail` and
 * `outcome` strings go in a table and rows reference them by index, and numbers
 * are base-36. Straight JSON produced a 4172-character code for a full 90-day
 * history, which is not something anyone will paste.
 */
function encodePayload(history, stats) {
  const table = [];
  const idx = (str) => {
    const v = str || '';
    const at = table.indexOf(v);
    return at === -1 ? table.push(v) - 1 : at;
  };
  const rows = Object.keys(history).map(Number).sort((a, b) => a - b).map((d) => {
    const r = history[d];
    return [
      d.toString(36),
      Math.max(0, CODE_MODES.indexOf(r.mode)),
      r.won ? 1 : 0,
      (Math.max(0, Math.round(r.score) || 0)).toString(36),
      idx(r.detail),
      idx(r.outcome),
    ].join(',');
  });
  const statLine = stats
    ? Object.entries(stats.modes || {}).map(([m, v]) => `${m}:${v.best || 0}:${v.plays || 0}:${v.cleared || 0}`).join('|')
      + `~${stats.solved || 0}`
    : '';
  return ['1', table.join('\u001f'), rows.join(';'), statLine].join('\n');
}

function decodePayload(text) {
  const [version, tableLine, rowLine, statLine] = String(text).split('\n');
  if (version !== '1') return null;
  const table = tableLine ? tableLine.split('\u001f') : [];
  const rows = (rowLine ? rowLine.split(';') : []).filter(Boolean).map((row) => {
    const [d, m, w, sc, di, oi] = row.split(',');
    return {
      day: parseInt(d, 36),
      mode: CODE_MODES[Number(m)] || 'classic',
      won: w === '1',
      score: parseInt(sc, 36) || 0,
      detail: table[Number(di)] || '',
      outcome: table[Number(oi)] || '',
    };
  });
  let stats = null;
  if (statLine) {
    const [modePart, solved] = statLine.split('~');
    const modes = {};
    modePart.split('|').filter(Boolean).forEach((entry) => {
      const [m, best, plays, cleared] = entry.split(':');
      modes[m] = { best: Number(best) || 0, plays: Number(plays) || 0, cleared: Number(cleared) || 0 };
    });
    stats = { modes, solved: Number(solved) || 0 };
  }
  return { rows, stats };
}

export function exportCode(history = loadHistory(), stats = null) {
  const body = toB64(encodePayload(history, stats));
  return `${CODE_PREFIX}.${body}.${checksum(body)}`;
}

/**
 * Merge a code into local history. A day already recorded here is never
 * overwritten — you cannot lose a day you actually played by pasting a code.
 */
export function importCode(code) {
  const cleaned = String(code || '').trim().replace(/\s+/g, '');
  const parts = cleaned.split('.');
  if (parts.length !== 3 || parts[0] !== CODE_PREFIX) {
    return { ok: false, error: 'That is not a TriOp restore code.' };
  }
  const [, body, sum] = parts;
  if (checksum(body) !== sum) {
    return { ok: false, error: 'That code looks incomplete — copy the whole thing.' };
  }
  let parsed;
  try { parsed = decodePayload(fromB64(body)); } catch { return { ok: false, error: 'That code could not be read.' }; }
  if (!parsed) return { ok: false, error: 'That code could not be read.' };

  const history = loadHistory();
  let added = 0, kept = 0;
  for (const row of parsed.rows) {
    if (!Number.isFinite(row.day) || row.day < 1) continue;
    if (history[row.day]) { kept += 1; continue; }
    history[row.day] = {
      day: row.day, mode: row.mode, modeName: row.mode[0].toUpperCase() + row.mode.slice(1),
      grid: '', detail: row.detail, outcome: row.outcome || (row.won ? 'solved' : 'not solved'),
      score: row.score, won: row.won, restored: true,
    };
    added += 1;
  }
  const days = Object.keys(history).map(Number).sort((a, b) => b - a).slice(0, KEEP_DAYS);
  const trimmed = {};
  days.forEach((d) => { trimmed[d] = history[d]; });
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ days: trimmed })); } catch { /* private mode */ }
  return { ok: true, added, kept, stats: parsed.stats };
}

/* Mode registry, shared clock, stats, and keyboard routing. */

import { LETTERS, setSeed, clearSeed } from './engine.js';
import * as UI from './ui.js';
import * as Daily from './daily.js';
import * as Audio from './audio.js';
import classic from './modes/classic.js';
import sprint from './modes/sprint.js';
import ladder from './modes/ladder.js';
import deduce from './modes/deduce.js';
import lesson, { lessonDone } from './lesson.js';
import { t, lang, setLang, rules as rulesFor } from './i18n.js';

// Ladder leads: the running total is always on screen and illegal moves are
// greyed out, so it is the mode a newcomer can actually start with.
const MODES = [ladder, classic, sprint, deduce];
const DAILY_TAB = { id: 'daily', get name() { return t('mode_daily'); } };
const SEEN_KEY = 'triop.seen.v1';
const STATS_KEY = 'triop.stats.v2';
const PREFS_KEY = 'triop.prefs.v1';

let current = MODES[0];
let level = 'normal';
let daily = false;
let dailyDay = 0;

/* ---------- clock ---------- */

let clockStart = 0, clockAcc = 0, clockRunning = false;
const clock = {
  start() { if (!clockRunning) { clockRunning = true; clockStart = Date.now(); } },
  stop() { if (clockRunning) { clockAcc += Date.now() - clockStart; clockRunning = false; } },
  reset() { clockAcc = 0; clockRunning = false; },
  ms() { return clockAcc + (clockRunning ? Date.now() - clockStart : 0); },
  seconds() { return Math.floor(clock.ms() / 1000); },
  label() {
    const s = clock.seconds();
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  },
};

/* ---------- stats ---------- */

const blankStats = () => ({ modes: {}, solved: 0 });

function loadStats() {
  try {
    const raw = JSON.parse(localStorage.getItem(STATS_KEY) || 'null');
    return raw && raw.modes ? { ...blankStats(), ...raw } : blankStats();
  } catch { return blankStats(); }
}

function saveStats(stats) {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch { /* private mode */ }
}

function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); } catch { return {}; }
}

function savePrefs() {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify({ mode: daily ? 'daily' : current.id, level })); } catch { /* ignore */ }
}

function renderStats() {
  const stats = loadStats();
  const mine = stats.modes[current.id] || { best: 0, plays: 0, cleared: 0 };
  const history = Daily.loadHistory();
  UI.setStats([
    { label: `${t('best')}: ${current.name}`, value: mine.best },
    { label: `${t('plays')}: ${current.name}`, value: mine.plays },
    { label: t('streak'), value: Daily.streak(Daily.dayNumber(), history) },
    { label: t('dailies'), value: Daily.daysPlayed(history) },
  ]);
}

/* ---------- host handed to every mode ---------- */

const host = {
  level: () => level,
  clock,
  restart() { newRound(); },
  celebrate() { celebrate(); },
  award({ score = 0, solved = 0, cleared = false }) {
    if (current.lesson) return;
    const stats = loadStats();
    const mine = stats.modes[current.id] || { best: 0, plays: 0, cleared: 0 };
    mine.best = Math.max(mine.best, score);
    mine.plays += 1;
    if (cleared) mine.cleared += 1;
    stats.modes[current.id] = mine;
    stats.solved += solved;
    saveStats(stats);
    renderStats();
    if (daily) recordDaily();
    // The result sheet waits for the mode's own closing lines and the win motion.
    if (cleared) celebrate();
    clearTimeout(resultTimer);
    resultTimer = setTimeout(() => showResult(cleared), cleared ? 900 : 500);
  },
};

function recordDaily() {
  if (Daily.loadResult(dailyDay)) return;      // only the first attempt counts
  const sum = current.summary && current.summary();
  if (!sum) return;
  Daily.saveResult({
    day: dailyDay, mode: current.id, modeName: current.name,
    grid: sum.grid, detail: sum.detail, outcome: sum.outcome,
    score: sum.score, won: sum.won,
  });
  renderShare();
}

MODES.forEach((m) => m.init(host));
lesson.init(host, () => { inLesson = false; current = MODES[0]; daily = false; paintChrome(); newRound(); });
let inLesson = false;
let resultTimer = null;

/* ---------- round + mode lifecycle ---------- */

function newRound() {
  clock.reset();
  // The seed stays live for the whole daily session: Sprint draws its next
  // target mid-run, and that sequence has to match for everyone too.
  if (daily) setSeed(Daily.seedFor(dailyDay, current.id));
  else clearSeed();
  current.start();
  renderStats();
  renderShare();
}

/* ---------- share card ---------- */

function renderShare() {
  const box = UI.dom.share;
  if (!box) return;
  box.innerHTML = '';
  const done = daily && Daily.loadResult(dailyDay);
  if (!done) { box.hidden = true; return; }
  box.hidden = false;
  const text = Daily.shareText(done, lang() === 'zh');
  const pre = document.createElement('pre');
  pre.className = 'share-grid';
  pre.textContent = text.split('\n').slice(0, -1).join('\n');
  box.appendChild(pre);
  const run = Daily.streak(dailyDay);
  if (run > 0) {
    // The streak lives here and in the records, never on the copied card.
    const p = document.createElement('p');
    p.className = 'share-streak';
    p.textContent = `${t('streak')} ${run}`;
    box.appendChild(p);
  }
}

/* ---------- sheets ---------- */

const $ = (id) => document.getElementById(id);
let openLayer = null;
function openSheet(id) {
  const layer = $(id);
  if (!layer) return;
  closeSheet();
  layer.hidden = false;
  openLayer = layer;
  const focus = layer.querySelector('.btn-primary, .tab.on, button');
  if (focus && focus.focus) focus.focus();
}
function closeSheet() {
  if (openLayer) openLayer.hidden = true;
  openLayer = null;
}

function celebrate() {
  const m = document.querySelector && document.querySelector('#brand .mascot');
  if (!m) return;
  m.classList.remove('swim'); void m.getBoundingClientRect(); m.classList.add('swim');
}

function showResult(won) {
  if (!$('sheet-result') || current.lesson) return;
  $('result-title').textContent = t(won ? 'res_win' : 'res_over');
  $('result-line').innerHTML = UI.dom.status ? UI.dom.status.innerHTML : '';
  $('sheet-result').classList.toggle('won', !!won);
  renderShare();
  const acts = $('result-actions');
  acts.innerHTML = '';
  const add = (label, cls, fn) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn ' + cls; b.textContent = label;
    b.addEventListener('click', fn);
    acts.appendChild(b);
    return b;
  };
  const done = daily && Daily.loadResult(dailyDay);
  if (done) {
    const copyBtn = add(t('copy_result'), 'btn-primary', async () => {
      const ok = await Daily.copy(Daily.shareText(done, lang() === 'zh'));
      copyBtn.textContent = ok ? t('copied') : t('copy_fail');
      setTimeout(() => { copyBtn.textContent = t('copy_result'); }, 2000);
    });
    add(t('next_daily', { mode: current.name }), '', () => { closeSheet(); switchMode(current.id); });
  } else {
    add(t('play_again'), 'btn-primary', () => { closeSheet(); newRound(); });
  }
  add(t('close'), 'btn-quiet', closeSheet);
  openSheet('sheet-result');
}

function switchMode(id) {
  clock.stop();
  closeSheet();
  if (inLesson) { lesson.stop(); inLesson = false; }
  if (id === 'daily') {
    if (daily) return;                           // already on today's board
    dailyDay = Daily.dayNumber();
    const modeId = Daily.modeForDay(dailyDay, MODES.map((m) => m.id));
    current = MODES.find((m) => m.id === modeId);
    daily = true;
    level = 'normal';                            // one difficulty, so scores compare
    UI.dom.level.value = 'normal';
  } else {
    const next = MODES.find((m) => m.id === id);
    if (!next || (next === current && !daily)) return;
    current = next;
    daily = false;
  }
  savePrefs();
  paintChrome();
  newRound();
}

function seen() { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); } catch { return {}; } }
function markSeen(k) { const x = seen(); x[k] = 1; try { localStorage.setItem(SEEN_KEY, JSON.stringify(x)); } catch { /* ignore */ } }

function paintChrome() {
  const sub = (m) => t(`mode_${m.id}_sub`, { mode: MODES.find((x) => x.id === Daily.modeForDay(Daily.dayNumber(), MODES.map((y) => y.id))).name });
  UI.setTabs([DAILY_TAB, ...MODES].map((m) => ({ id: m.id, name: m.name, sub: sub(m) })), daily ? 'daily' : current.id, switchMode);
  if (UI.dom.goal) {
    UI.dom.goal.textContent = t(`goal_${current.id}`);
    // A rule arrives once, the first time its mode opens, just above the board.
    const k = daily ? `daily-${Daily.dayNumber()}` : current.id;
    const line = daily ? t('daily_line', { n: Daily.dayNumber() }) : t(`rule_${current.id}`);
    const fresh = !seen()[k];
    UI.dom.callout.hidden = !fresh;
    UI.dom.callout.textContent = fresh ? line : '';
    if (fresh) markSeen(k);
  }
  paintWords();
  UI.showLevel(!daily && current.usesLevel !== false);
  document.body.dataset.mode = current.id;
}

/** Every fixed word on the page, in the current language. */
function paintWords() {
  const set = (id, txt) => { const n = $(id); if (n) n.textContent = txt; };
  if (!$('app')) return;
  set('mode-name', daily ? `${t('mode_daily')} #${Daily.dayNumber()}` : current.name);
  set('more-word', t('more'));
  set('modes-title', t('modes'));
  set('more-title', t('more'));
  set('level-word', t('difficulty'));
  set('feed-word', t('feed'));
  set('stats-word', t('records'));
  set('lang', t('language'));
  set('replay-first', t('first_again'));
  document.querySelectorAll('[data-close]').forEach((b) => { b.textContent = t('close'); });
  [...UI.dom.level.options].forEach((o) => { o.textContent = t(o.value); });
  const rulesBox = UI.dom.rules;
  const keep = rulesBox.querySelector('[data-why-exists]');
  rulesBox.innerHTML = `<summary>${t('rules_title')}: ${current.name}</summary><ul>` +
    rulesFor(current.id).map((r) => `<li>${r}</li>`).join('') + '</ul>';
  if (keep) rulesBox.appendChild(keep);
  paintSound();
}

/* ---------- ticker: keeps clocks honest without every mode owning a timer ---------- */

let lastTick = Date.now();
setInterval(() => {
  const now = Date.now();
  const dt = now - lastTick;
  lastTick = now;
  if (hidden) return;                  // the clock does not run while the tab is away
  if (current.tick) current.tick(dt);
  else if (clockRunning) UI.setHudValue('time', clock.label());
}, 250);

/* ---------- moving progress between devices ---------- */

/** Merge restored records by taking the better of each — importing is idempotent. */
function mergeStats(incoming) {
  if (!incoming) return;
  const stats = loadStats();
  Object.entries(incoming.modes || {}).forEach(([id, v]) => {
    const mine = stats.modes[id] || { best: 0, plays: 0, cleared: 0 };
    stats.modes[id] = {
      best: Math.max(mine.best, v.best || 0),
      plays: Math.max(mine.plays, v.plays || 0),
      cleared: Math.max(mine.cleared, v.cleared || 0),
    };
  });
  stats.solved = Math.max(stats.solved, incoming.solved || 0);
  saveStats(stats);
}

function renderTransfer() {
  const box = UI.dom.transfer;
  box.innerHTML = '';

  const summary = document.createElement('summary');
  summary.textContent = t('t_sum');
  box.appendChild(summary);

  const blurb = document.createElement('p');
  blurb.className = 'transfer-note';
  blurb.textContent = t('t_note');
  box.appendChild(blurb);

  const status = document.createElement('p');
  status.className = 'transfer-status';

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'btn btn-primary';
  copyBtn.textContent = t('t_copy');
  copyBtn.addEventListener('click', async () => {
    const history = Daily.loadHistory();
    if (!Object.keys(history).length) {
      status.textContent = t('t_none');
      return;
    }
    const code = Daily.exportCode(history, loadStats());
    const ok = await Daily.copy(code);
    status.textContent = ok
      ? t('t_copied', { d: Object.keys(history).length, c: code.length })
      : t('t_noclip');
    field.value = code;
    copyBtn.blur();
  });

  const field = document.createElement('textarea');
  field.className = 'transfer-field';
  field.setAttribute('rows', '3');
  field.setAttribute('placeholder', t('t_paste'));
  field.setAttribute('aria-label', 'Restore code');

  const restoreBtn = document.createElement('button');
  restoreBtn.type = 'button';
  restoreBtn.className = 'btn';
  restoreBtn.textContent = t('t_restore');
  restoreBtn.addEventListener('click', () => {
    const result = Daily.importCode(field.value);
    if (!result.ok) { status.textContent = result.error; return; }
    mergeStats(result.stats);
    status.textContent = result.added
      ? t('t_added', { a: result.added, k: result.kept })
      : t('t_nothing', { k: result.kept });
    renderStats();
    renderShare();
    restoreBtn.blur();
  });

  const row = document.createElement('div');
  row.className = 'transfer-row';
  row.appendChild(copyBtn);
  row.appendChild(restoreBtn);

  box.appendChild(row);
  box.appendChild(field);
  box.appendChild(status);
}

/*
 * Test hook. The harness cannot wait out a 105-second sprint, so it advances the
 * active mode's clock directly. Exposed deliberately: without it the run-length
 * bound is an assertion rather than a measurement, and that bound is the whole
 * reason Sprint's economy was rebuilt.
 */
globalThis.__triopAdvance = (ms) => {
  if (current.tick) current.tick(ms);
  return true;
};

/* ---------- sound ---------- */

function paintSound() {
  UI.dom.sound.textContent = Audio.isOn() ? t('sound_on') : t('sound_off');
  UI.dom.sound.setAttribute('aria-pressed', String(Audio.isOn()));
  UI.dom.sound.classList.toggle('btn-quiet', !Audio.isOn());
}

UI.dom.sound.addEventListener('click', () => {
  Audio.setEnabled(!Audio.isOn());
  paintSound();
  UI.dom.sound.blur();
});

/* ---------- pause when the tab is hidden ---------- */

/*
 * A timed run draining while the player is looking at another tab is a failure
 * with no event — they come back to a run that ended without them. Sprint's
 * ticker is wall-clock, so hiding the tab used to cost real seconds.
 */
let hidden = false;
document.addEventListener('visibilitychange', () => {
  hidden = document.visibilityState === 'hidden';
  if (hidden) clock.stop();
  else lastTick = Date.now();          // do not bill the player for time away
});

/* ---------- input ---------- */

document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === 'SELECT' || tag === 'INPUT') return;

  if (openLayer) { if (e.key === 'Escape') closeSheet(); return; }
  const key = e.key.toLowerCase();
  if (LETTERS.includes(key)) {
    e.preventDefault();
    current.pick(key);
    return;
  }
  if (e.key === 'Enter' && tag === 'BUTTON') return;   // let the focused button act
  if (current.key && current.key(e)) e.preventDefault();
});

UI.dom.level.addEventListener('change', () => {
  level = UI.dom.level.value;
  savePrefs();
  newRound();
});

/* ---------- boot ---------- */

const prefs = loadPrefs();
if (prefs.level && ['easy', 'normal', 'hard'].includes(prefs.level)) {
  level = prefs.level;
  UI.dom.level.value = level;
}
const startMode = MODES.find((m) => m.id === prefs.mode);
if (prefs.mode === 'daily') {
  daily = true;
  dailyDay = Daily.dayNumber();
  current = MODES.find((m) => m.id === Daily.modeForDay(dailyDay, MODES.map((m) => m.id)));
  level = 'normal';
  UI.dom.level.value = 'normal';
} else if (startMode) {
  current = startMode;
}

function wireSheets() {
  if (!$('app')) return;
  $('modebtn').addEventListener('click', () => openSheet('sheet-modes'));
  $('morebtn').addEventListener('click', () => { renderStats(); openSheet('sheet-more'); });
  $('brand').addEventListener('click', () => openSheet('sheet-modes'));
  document.querySelectorAll('.layer').forEach((layer) => {
    layer.addEventListener('click', (e) => { if (e.target === layer) closeSheet(); });
  });
  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeSheet));
  UI.onMoreAction(closeSheet);
  $('lang').addEventListener('click', () => {
    setLang(lang() === 'zh' ? 'en' : 'zh');
    UI.resetControls();
    paintChrome();
    if (inLesson) lesson.render(); else current.render();
    renderStats();
    renderTransfer();
  });
  $('replay-first').addEventListener('click', () => { closeSheet(); startLesson(); });
}

function startLesson() {
  clock.stop();
  clock.reset();
  clearSeed();
  daily = false;
  inLesson = true;
  current = MODES[0];
  paintChrome();
  if (UI.dom.callout) UI.dom.callout.hidden = true;
  current = lesson;
  lesson.start();
}

setLang(lang());
wireSheets();
renderTransfer();
const firstVisit = $('app') && !lessonDone() && !Object.keys(loadStats().modes).length;
if (firstVisit) {
  startLesson();
} else {
  paintChrome();
  newRound();
}

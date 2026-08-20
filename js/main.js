/* Mode registry, shared clock, stats, and keyboard routing. */

import { LETTERS, setSeed, clearSeed } from './engine.js';
import * as UI from './ui.js';
import * as Daily from './daily.js';
import classic from './modes/classic.js';
import sprint from './modes/sprint.js';
import ladder from './modes/ladder.js';
import deduce from './modes/deduce.js';

// Ladder leads: the running total is always on screen and illegal moves are
// greyed out, so it is the mode a newcomer can actually start with.
const MODES = [ladder, classic, sprint, deduce];
const DAILY_TAB = { id: 'daily', name: 'Daily' };
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
    { label: `Best — ${current.name}`, value: mine.best },
    { label: `Plays — ${current.name}`, value: mine.plays },
    { label: 'Daily streak', value: Daily.streak(Daily.dayNumber(), history) },
    { label: 'Dailies played', value: Daily.daysPlayed(history) },
  ]);
}

/* ---------- host handed to every mode ---------- */

const host = {
  level: () => level,
  clock,
  restart() { newRound(); },
  award({ score = 0, solved = 0, cleared = false }) {
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
  box.innerHTML = '';
  if (!daily) { box.hidden = true; return; }
  box.hidden = false;

  const done = Daily.loadResult(dailyDay);
  const run = Daily.streak(dailyDay);
  const streakLine = run > 0 ? ` You are on a <strong>${run}-day streak</strong>.` : '';

  if (!done) {
    const note = document.createElement('p');
    note.className = 'daily-note';
    note.innerHTML = `Daily #${dailyDay} — <strong>${current.name}</strong>. ` +
      'Everyone gets this exact board today. Your first result is the one that counts.' + streakLine;
    box.appendChild(note);
    return;
  }

  const card = document.createElement('div');
  card.className = 'share-card';
  const add = (tag, cls, text) => {
    const node = document.createElement(tag);
    node.className = cls;
    node.textContent = text;
    card.appendChild(node);
    return node;
  };
  add('div', 'share-head', `TriOp #${done.day} · ${done.modeName}`);
  add('pre', 'share-grid', done.grid);
  add('div', 'share-detail', `${done.detail} — ${done.outcome}`);
  // The streak lives here and in the stats panel, never on the copied card:
  // a second number there would stop the card working as a currency.
  if (run > 0) add('div', 'share-streak', `${run}-day streak`);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-primary';
  btn.textContent = 'Copy result';
  btn.addEventListener('click', async () => {
    const ok = await Daily.copy(Daily.shareText(done));
    btn.textContent = ok ? 'Copied' : 'Press Ctrl+C to copy';
    setTimeout(() => { btn.textContent = 'Copy result'; }, 2000);
    btn.blur();
  });
  card.appendChild(btn);
  box.appendChild(card);
}

function switchMode(id) {
  clock.stop();
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

function paintChrome() {
  UI.setTabs([DAILY_TAB, ...MODES], daily ? 'daily' : current.id, switchMode);
  UI.dom.blurb.innerHTML = daily
    ? `Daily #${Daily.dayNumber()} — today it is <strong>${current.name}</strong>. ${current.blurb}`
    : current.blurb;
  UI.setRules(current.rulesTitle, current.rules);
  UI.showLevel(!daily && current.usesLevel !== false);
  document.body.dataset.mode = current.id;
}

/* ---------- ticker: keeps clocks honest without every mode owning a timer ---------- */

let lastTick = Date.now();
setInterval(() => {
  const now = Date.now();
  const dt = now - lastTick;
  lastTick = now;
  if (current.tick) current.tick(dt);
  else if (clockRunning) UI.setHudValue('Time', clock.label());
}, 250);

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

/* ---------- input ---------- */

document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === 'SELECT' || tag === 'INPUT') return;

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

paintChrome();
newRound();

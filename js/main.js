/* Mode registry, shared clock, stats, and keyboard routing. */

import { LETTERS } from './engine.js';
import * as UI from './ui.js';
import classic from './modes/classic.js';
import sprint from './modes/sprint.js';
import ladder from './modes/ladder.js';
import deduce from './modes/deduce.js';

const MODES = [classic, sprint, ladder, deduce];
const STATS_KEY = 'triop.stats.v2';
const PREFS_KEY = 'triop.prefs.v1';

let current = classic;
let level = 'normal';

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
  try { localStorage.setItem(PREFS_KEY, JSON.stringify({ mode: current.id, level })); } catch { /* ignore */ }
}

function renderStats() {
  const stats = loadStats();
  const mine = stats.modes[current.id] || { best: 0, plays: 0, cleared: 0 };
  UI.setStats([
    { label: `Best — ${current.name}`, value: mine.best },
    { label: `Plays — ${current.name}`, value: mine.plays },
    { label: `Cleared — ${current.name}`, value: mine.cleared },
    { label: 'Lifetime solved', value: stats.solved },
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
  },
};

MODES.forEach((m) => m.init(host));

/* ---------- round + mode lifecycle ---------- */

function newRound() {
  clock.reset();
  current.start();
  renderStats();
}

function switchMode(id) {
  const next = MODES.find((m) => m.id === id);
  if (!next || next === current) return;
  clock.stop();
  current = next;
  savePrefs();
  paintChrome();
  newRound();
}

function paintChrome() {
  UI.setTabs(MODES, current.id, switchMode);
  UI.dom.blurb.innerHTML = current.blurb;
  UI.setRules(current.rulesTitle, current.rules);
  UI.showLevel(current.usesLevel !== false);
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
if (startMode) current = startMode;

paintChrome();
newRound();

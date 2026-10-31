/* DOM rendering. Modes describe what they want; this file draws it. */

import { SYMBOL } from './engine.js';

const el = (id) => document.getElementById(id);

export const dom = {
  tabs: el('tabs'),
  goal: el('goal'),
  callout: el('callout'),
  status: el('status'),
  moreControls: el('more-controls'),
  hud: el('hud'),
  prompt: el('prompt'),
  slots: el('slots'),
  board: el('board'),
  boardNote: el('board-note'),
  level: el('level'),
  sound: el('sound'),
  levelField: el('level-field'),
  controls: el('controls'),
  share: el('share'),
  panel: el('panel'),
  log: el('log'),
  stats: el('stats'),
  transfer: el('transfer'),
  rules: el('rules'),
};

let tileButtons = new Map();
let hudValues = new Map();
let controlsSig = '';

/* ---------- HUD ---------- */

export function setHud(cells) {
  dom.hud.innerHTML = '';
  hudValues = new Map();
  dom.hud.style.gridTemplateColumns = `repeat(${cells.length}, minmax(0, 1fr))`;
  cells.forEach((cell) => {
    const box = document.createElement('div');
    box.className = 'hud-cell' + (cell.big ? ' hud-big' : '') + (cell.warn ? ' hud-warn' : '');
    if (cell.id) box.dataset.hud = cell.id;
    box.innerHTML =
      `<span class="hud-label">${cell.label}</span>` +
      `<strong class="hud-value">${cell.value}</strong>` +
      (cell.sub ? `<span class="hud-sub">${cell.sub}</span>` : '');
    hudValues.set(cell.id || cell.label, box);
    dom.hud.appendChild(box);
  });
}

/** Update one HUD cell in place (by id), used by the ticker so buttons keep focus. */
export function setHudValue(label, value, warn) {
  const box = hudValues.get(label);
  if (!box) return;
  const strong = box.querySelector('.hud-value');
  if (strong) strong.textContent = value;
  if (warn !== undefined) box.classList.toggle('hud-warn', !!warn);
}

export function pulseHud() {
  const big = dom.hud.querySelector('.hud-big');
  if (!big) return;
  big.classList.remove('pulse');
  void big.offsetWidth;
  big.classList.add('pulse');
}

/* ---------- board ---------- */

export function renderBoard(tiles, letters, onPick) {
  dom.board.innerHTML = '';
  tileButtons = new Map();
  letters.forEach((letter) => {
    const t = tiles[letter];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tile';
    btn.dataset.letter = letter;
    btn.innerHTML =
      `<span class="key" aria-hidden="true">${letter.toUpperCase()}</span>` +
      `<span class="op"><span class="sym">${SYMBOL[t.op]}</span>${t.num}</span>`;
    btn.setAttribute('aria-label', `Tile ${letter.toUpperCase()}, ${opWord(t.op)} ${t.num}`);
    btn.addEventListener('click', () => { onPick(letter); btn.blur(); });
    tileButtons.set(letter, btn);
    dom.board.appendChild(btn);
  });
}

const opWord = (op) => ({ '+': 'plus', '-': 'minus', '*': 'times', '/': 'divided by' }[op]);

/** stateFor(letter) -> { classes: [...], disabled: bool, note: string } */
export function markBoard(stateFor) {
  tileButtons.forEach((btn, letter) => {
    const s = stateFor(letter) || {};
    btn.className = 'tile' + (s.classes || []).map((c) => ' ' + c).join('');
    btn.disabled = !!s.disabled;
    const existing = btn.querySelector('.tile-note');
    if (existing) existing.remove();
    if (s.note) {
      const note = document.createElement('span');
      note.className = 'tile-note';
      note.textContent = s.note;
      btn.appendChild(note);
    }
  });
}

export const setBoardNote = (html) => { dom.boardNote.innerHTML = html || ''; };

/* ---------- stage ---------- */

export const setPrompt = (html) => { dom.prompt.innerHTML = html; };

/** entries: array of { top, main } or null; pass [] to hide the row entirely. */
export function setSlots(entries, onClickIndex) {
  dom.slots.innerHTML = '';
  dom.slots.hidden = entries.length === 0;
  entries.forEach((entry, i) => {
    const slot = document.createElement('button');
    slot.type = 'button';
    slot.className = 'slot' + (entry ? ' filled' : '');
    slot.innerHTML = entry
      ? `<span class="slot-letter">${entry.top}</span><span>${entry.main}</span>`
      : '';
    slot.setAttribute('aria-label', entry
      ? `Slot ${i + 1}, tile ${String(entry.top).toUpperCase()}. Activate to remove.`
      : `Slot ${i + 1}, empty`);
    if (onClickIndex) slot.addEventListener('click', () => { onClickIndex(i); slot.blur(); });
    dom.slots.appendChild(slot);
  });
}

export function flashSlots(kind) {
  dom.slots.classList.add(kind);
  setTimeout(() => dom.slots.classList.remove(kind), 420);
}

/* ---------- controls ---------- */

export function setControls(buttons, onAction) {
  // Rebuilding identical buttons on every keystroke would steal focus.
  const sig = JSON.stringify(buttons);
  if (sig === controlsSig) return;
  controlsSig = sig;
  dom.controls.innerHTML = '';
  if (dom.moreControls) dom.moreControls.innerHTML = '';
  buttons.forEach((b) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn' + (b.primary ? ' btn-primary' : '') + (b.quiet ? ' btn-quiet' : '')
      + (b.nudge ? ' nudge' : '');
    btn.dataset.action = b.id;
    btn.innerHTML = b.label + (b.badge !== undefined ? ` <span class="badge">${b.badge}</span>` : '');
    btn.disabled = !!b.disabled;
    btn.addEventListener('click', () => { onAction(b.id); btn.blur(); if (b.more && onMore) onMore(); });
    (b.more && dom.moreControls ? dom.moreControls : dom.controls).appendChild(btn);
  });
}
let onMore = null;
/** Called after a button inside the More sheet acts, so the sheet can close. */
export const onMoreAction = (f) => { onMore = f; };
export const resetControls = () => { controlsSig = ''; };

export const showLevel = (visible) => { dom.levelField.hidden = !visible; };

/* ---------- panel, log, rules ---------- */

export const setPanel = (html) => { dom.panel.innerHTML = html; };

export function say(html, cls = 'note') {
  if (dom.status) { dom.status.innerHTML = html; dom.status.className = 'status ' + cls; }
  const row = document.createElement('div');
  row.className = 'row';
  row.innerHTML = `<span class="${cls}">${html}</span>`;
  dom.log.prepend(row);
  while (dom.log.childElementCount > 60) dom.log.lastElementChild.remove();
}

export const clearLog = () => {
  dom.log.innerHTML = '';
  if (dom.status) dom.status.innerHTML = '';
};

export function setStats(cells) {
  dom.stats.innerHTML = cells
    .map((c) => `<div><span class="hud-label">${c.label}</span><strong>${c.value}</strong></div>`)
    .join('');
}

export function setTabs(modes, activeId, onPick) {
  controlsSig = '';   // a mode switch always redraws its own controls
  dom.tabs.innerHTML = '';
  modes.forEach((m) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tab' + (m.id === activeId ? ' on' : '');
    btn.dataset.mode = m.id;
    btn.textContent = m.name;
    if (m.sub) {
      const sub = document.createElement('small');
      sub.textContent = m.sub;
      btn.appendChild(sub);
    }
    btn.setAttribute('aria-pressed', String(m.id === activeId));
    btn.addEventListener('click', () => { onPick(m.id); btn.blur(); });
    dom.tabs.appendChild(btn);
  });
}

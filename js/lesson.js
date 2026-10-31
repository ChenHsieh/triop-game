/* The first minute: three small boards on one fixed set of tiles, played, not read.
 * 1. one lit tile, one tap, it wins;  2. a tile that would leave a fraction, tried once, safely;
 * 3. a real two-step ladder with the real par. Nothing here touches stats, the daily or saves. */

import * as E from './engine.js';
import * as UI from './ui.js';
import { cue } from './audio.js';
import { t } from './i18n.js';

const KEY = 'triop.lesson.v1';
const TILES = {
  q: { op: '+', num: 3 }, w: { op: '*', num: 4 }, e: { op: '/', num: 2 }, r: { op: '-', num: 1 },
  a: { op: '+', num: 5 }, s: { op: '*', num: 3 }, d: { op: '/', num: 5 }, f: { op: '-', num: 2 },
  z: { op: '+', num: 2 }, x: { op: '*', num: 2 }, c: { op: '/', num: 3 }, v: { op: '-', num: 4 },
};
const STEPS = [
  { start: 3, target: 12, awake: ['w'], goal: 'ls_1' },
  { start: 12, target: 4, awake: ['d', 'c'], goal: 'ls_2', trap: 'd' },
  { start: 2, target: 10, awake: null, goal: 'ls_3', par: 3, optimum: 2 },
];

export const lessonDone = () => { try { return !!localStorage.getItem(KEY); } catch { return true; } };
const markDone = (how) => { try { localStorage.setItem(KEY, how); } catch { /* ignore */ } };

const legal = (v, tile) => {
  const r = E.wholeOrNull(E.apply(v, tile.op, tile.num));
  return r !== null && Math.abs(r) <= 999 ? r : null;
};

let host = null;
let onExit = null;
let s = {};

function begin(i) {
  const st = STEPS[i];
  s = { i, ...st, value: st.start, trail: [], tripped: false, won: false, wait: null };
  UI.clearLog();
  UI.renderBoard(TILES, E.LETTERS, pick);
  render();
}

function start() { begin(0); }

function pick(letter) {
  if (s.won) return;
  const st = STEPS[s.i];
  if (st.awake && !st.awake.includes(letter)) return;
  if (s.trail.includes(letter)) return;
  const tile = TILES[letter];
  if (st.trap === letter && !s.tripped) {
    // The one safe failure: show the fraction, grey the tile, change the line.
    s.tripped = true;
    UI.say(`${s.value} ${E.SYMBOL[tile.op]} ${tile.num} = ${E.fmt(E.apply(s.value, tile.op, tile.num))}`, 'no');
    UI.flashSlots('shake');
    flashTile(letter);
    cue.reject();
    render();
    return;
  }
  const next = legal(s.value, tile);
  if (next === null) { cue.reject(); flashTile(letter); return; }
  s.trail.push(letter);
  const before = s.value;
  s.value = next;
  UI.say(`${before} ${E.SYMBOL[tile.op]} ${tile.num} = ${next}`, next === s.target ? 'ok' : 'note');
  if (next === s.target) {
    s.won = true;
    cue.win();
    host.celebrate();
    render();
    if (s.i < STEPS.length - 1) s.wait = setTimeout(() => begin(s.i + 1), 1100);
    return;
  }
  cue.step(next > before);
  render();
}

function flashTile(letter) {
  const b = UI.dom.board.querySelector(`[data-letter="${letter}"]`);
  if (!b) return;
  b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope');
}

function undo() {
  if (s.won || !s.trail.length) return;
  s.trail.pop();
  s.value = s.trail.reduce((v, l) => legal(v, TILES[l]), s.start);
  cue.undo();
  render();
}

function exit(how) {
  clearTimeout(s.wait);
  markDone(how);
  if (onExit) onExit();
}

function trailHTML() {
  let v = s.start;
  const parts = [`<span class="step start">${s.start}</span>`];
  s.trail.forEach((l) => {
    const tile = TILES[l];
    v = legal(v, tile);
    parts.push(`<span class="op-step">${E.SYMBOL[tile.op]}${tile.num}</span><span class="step${v === s.target ? ' hit' : ''} latest">${v}</span>`);
  });
  return parts.join('<span class="arrow">→</span>');
}

function render() {
  const st = STEPS[s.i];
  const last = s.i === STEPS.length - 1;
  UI.dom.goal.textContent = s.won && last ? t('ls_done') : t(s.tripped && !s.won ? 'ls_2b' : st.goal);
  const callout = UI.dom.callout;
  callout.hidden = s.i !== 0;
  callout.textContent = s.i === 0 ? t('ls_premise') : '';
  const cells = [
    { id: 'now', label: t('hud_now'), value: s.value, big: true },
    { id: 'target', label: t('hud_target'), value: s.target },
  ];
  if (st.par) cells.push({ id: 'tiles', label: t('hud_tiles'), value: `${s.trail.length}/${st.par}`, sub: t('par_sub', { par: st.par, opt: st.optimum }) });
  cells.push({ id: 'step', label: t('ls_step', { n: s.i + 1 }), value: '•'.repeat(s.i + 1) + '◦'.repeat(2 - s.i) });
  UI.setHud(cells);
  UI.setPrompt(trailHTML());
  UI.setSlots([]);
  UI.setPanel('');
  UI.setBoardNote('');
  UI.markBoard((letter) => {
    const used = s.trail.includes(letter);
    const asleep = st.awake && !st.awake.includes(letter);
    const tripped = st.trap === letter && s.tripped;
    const next = used ? null : legal(s.value, TILES[letter]);
    const classes = [];
    if (asleep) classes.push('asleep');
    if (used) classes.push('spent');
    if (!asleep && !used && !s.won && s.i === 0) classes.push('beckon');
    if (s.i === 1 && !s.won && !s.tripped && letter === st.trap) classes.push('beckon');
    return {
      classes,
      // Step 2 keeps the trap tappable once, so the fraction can be seen, not just told.
      disabled: s.won || used || asleep || tripped || (next === null && letter !== st.trap),
    };
  });
  const buttons = [];
  if (st.par && !s.won) buttons.push({ id: 'undo', label: t('undo'), quiet: true, disabled: !s.trail.length });
  if (s.won && last) buttons.push({ id: 'play', label: t('ls_go'), primary: true });
  else buttons.push({ id: 'skip', label: t('ls_skip'), quiet: true });
  UI.setControls(buttons, action);
}

function action(id) {
  if (id === 'undo') undo();
  else if (id === 'skip') exit('skipped');
  else if (id === 'play') exit('done');
}

function key(e) {
  if (e.key === 'Backspace') { undo(); return true; }
  if (e.key === 'Escape') { exit('skipped'); return true; }
  return false;
}

export default {
  id: 'lesson',
  get name() { return t('mode_ladder'); },
  usesLevel: false,
  lesson: true,
  init(h, exitFn) { host = h; onExit = exitFn; },
  start, pick, key, render,
  stop() { clearTimeout(s.wait); },
};

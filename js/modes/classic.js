/* Classic — find every 3-tile combo that hits the target. */

import * as E from '../engine.js';
import * as UI from '../ui.js';
import { cue } from '../audio.js';
import { t } from '../i18n.js';

/*
 * `required` is the real difficulty lever, not the size of the solution set —
 * under "combos examined to clear", needing one more find dominates everything
 * else. Requiring *all* of them originally made Easy the hardest setting, and a
 * first fix left Normal and Hard tied (786 vs 867, inside the noise).
 *
 * What separates them is how many spares you get. Easy has ~11 solutions and
 * needs 2 of them; Hard has exactly 3 and needs all 3. Measured median combos a
 * scanning player examines before clearing: easy 200, normal 636, hard 1031.
 */
const BANDS = {
  easy:   { min: 8, max: 16, required: 2,        hints: 3, timeBonus: 200 },
  normal: { min: 4, max: 8,  required: 3,        hints: 2, timeBonus: 300 },
  hard:   { min: 3, max: 3,  required: Infinity, hints: 1, timeBonus: 450 },
};
/*
 * A fixed price list, deliberately: a solution is +100 and a miss is −20, always.
 * Classic previously also carried a chain multiplier, which is incompatible with
 * that — with escalation the same guess is worth wildly different amounts
 * depending on when it lands, so "is this guess worth trying" stops being
 * computable at the moment you decide it. Sprint keeps its chain, because there
 * the chain *is* the game.
 */
const SCORE = { hit: 100, miss: 20, hint: 75, perfect: 250 };

let host = null;
let s = {};

function start() {
  const band = BANDS[host.level()];
  const puzzle = E.comboPuzzle(band);
  s = {
    tiles: puzzle.tiles, target: puzzle.target, solutions: puzzle.solutions,
    need: Math.min(band.required, puzzle.solutions.length),
    found: new Set(), tried: new Set(), hinted: new Set(), combo: [],
    score: 0, misses: 0, hintsUsed: 0, hintsLeft: band.hints,
    over: false, revealed: false, submitId: null,
  };
  UI.clearLog();
  UI.renderBoard(s.tiles, E.LETTERS, pick);
  UI.say(s.need < s.solutions.length
    ? t('c_new', { need: s.need, n: s.solutions.length, target: s.target })
    : t('c_new_all', { need: s.need, target: s.target }));
  render();
}

function pick(letter) {
  if (s.over || s.combo.length >= 3) return;
  if (s.combo.includes(letter)) { UI.flashSlots('shake'); cue.reject(); return; }
  clearTimeout(s.submitId);
  s.combo.push(letter);
  cue.pick();
  host.clock.start();
  render();
  if (s.combo.length === 3) s.submitId = setTimeout(submit, 260);
}

function pop() {
  if (s.over || !s.combo.length) return;
  clearTimeout(s.submitId);
  s.combo.pop();
  cue.undo();
  render();
}

function clearCombo() {
  clearTimeout(s.submitId);
  s.combo = [];
}

function submit() {
  if (s.over || s.combo.length !== 3) return;
  const combo = s.combo.join('');
  const label = combo.toUpperCase();
  const value = E.comboValue(s.tiles, combo);
  const whole = E.wholeOrNull(value);

  if (s.tried.has(combo)) {
    UI.say(t('tried', { k: `<span class="mono">${label}</span>` }));
    UI.flashSlots('shake');
    cue.reject();
    clearCombo();
    render();
    return;
  }
  s.tried.add(combo);

  if (whole === s.target) {
    s.found.add(combo);
    s.score += SCORE.hit;
    UI.say(t('hit', { k: `<span class="mono">${label}</span>`, target: s.target, p: SCORE.hit }), 'ok');
    UI.flashSlots('good');
    cue.hit();
    UI.pulseHud();
  } else {
    s.misses += 1;
    s.score -= SCORE.miss;
    const off = whole === null ? '' : t('off_by', { n: Math.abs(whole - s.target) });
    UI.say(t('miss', { k: `<span class="mono">${label}</span>`, v: E.fmt(value), off, p: SCORE.miss }), 'no');
    UI.flashSlots('bad');
    cue.miss();
  }

  clearCombo();
  if (s.found.size >= s.need) finish();
  render();
}

function hint() {
  if (s.over || s.hintsLeft <= 0) return;
  const remaining = s.solutions.filter((x) => !s.found.has(x));
  if (!remaining.length) return;
  const pickOne = E.pickFrom(remaining);
  s.hintsLeft -= 1;
  s.hintsUsed += 1;
  s.score -= SCORE.hint;
  s.hinted.add(pickOne[0]);
  s.hinted.add(pickOne[1]);
  host.clock.start();
  UI.say(t('c_hint', { k: `<span class="mono">${pickOne.slice(0, 2).toUpperCase()}</span>`, cost: SCORE.hint }), 'big');
  render();
}

function finish() {
  host.clock.stop();
  s.over = true;
  const secs = host.clock.seconds();
  const bonus = Math.max(0, BANDS[host.level()].timeBonus - 5 * secs);
  s.score += bonus;
  if (s.misses === 0 && s.hintsUsed === 0) {
    s.score += SCORE.perfect;
    UI.say(t('c_flawless', { p: SCORE.perfect }), 'big');
  }
  s.score = Math.max(0, s.score);
  cue.win();
  const spare = s.solutions.length - s.found.size;
  if (spare > 0) UI.say(t('c_others', { list: `<span class="mono">${s.solutions.filter((x) => !s.found.has(x)).map((x) => x.toUpperCase()).join(' ')}</span>` }));
  host.award({ score: s.score, solved: s.found.size, cleared: true });
  UI.say(t('c_clear', { time: host.clock.label(), score: s.score }), 'ok');
}

function reveal() {
  if (s.over) return;
  host.clock.stop();
  s.over = true;
  s.revealed = true;
  s.score = Math.max(0, s.score);
  cue.lose();
  const missed = s.solutions.filter((x) => !s.found.has(x));
  UI.say(t('c_reveal', { list: `<span class="mono">${missed.map((x) => x.toUpperCase()).join(' ') || '-'}</span>` }), 'big');
  host.award({ score: s.score, solved: s.found.size, cleared: false });
  render();
}

function exprHTML(combo, withResult) {
  if (!combo.length) return `<span class="muted">${t('pick_start')}</span>`;
  const T = combo.map((l) => s.tiles[l]);
  let out = String(T[0].num);
  if (combo.length >= 2) out += ` ${E.SYMBOL[T[1].op]} ${T[1].num}`;
  if (combo.length === 3) {
    out = E.prec(T[2].op) > E.prec(T[1].op)
      ? `${T[0].num} ${E.SYMBOL[T[1].op]} <span class="paren">(</span>${T[1].num} ${E.SYMBOL[T[2].op]} ${T[2].num}<span class="paren">)</span>`
      : `${out} ${E.SYMBOL[T[2].op]} ${T[2].num}`;
    if (withResult) out += ` = <span class="res">${E.fmt(E.comboValue(s.tiles, combo.join('')))}</span>`;
  }
  return out;
}

function render() {
  UI.setHud([
    { id: 'target', label: t('hud_target'), value: s.target, big: true },
    { id: 'found', label: t('hud_found'), value: `${s.found.size}/${s.need}`, sub: s.need < s.solutions.length ? t('exist_sub', { n: s.solutions.length }) : '' },
    { id: 'score', label: t('hud_score'), value: s.score },
    { id: 'time', label: t('hud_time'), value: host.clock.label() },
  ]);
  UI.setPrompt(exprHTML(s.combo, s.combo.length === 3));
  UI.setSlots(
    [0, 1, 2].map((i) => {
      const l = s.combo[i];
      if (!l) return null;
      return { top: l, main: i === 0 ? s.tiles[l].num : E.face(s.tiles[l]) };
    }),
    () => pop()
  );
  UI.markBoard((letter) => {
    const idx = s.combo.indexOf(letter);
    const classes = [];
    if (idx !== -1) classes.push('used');
    if (idx === 0) classes.push('first');
    if (s.hinted.has(letter)) classes.push('hinted');
    // Slot 1 contributes its number only — evaluate() never reads its operator.
    // While that slot is the one being filled, every sign on the board is
    // irrelevant, so showing twelve of them at full strength mis-signals.
    if (!s.combo.length) classes.push('op-muted');
    return { classes, disabled: s.over };
  });
  UI.setControls([
    { id: 'hint', label: t('hint'), badge: s.hintsLeft, disabled: s.over || s.hintsLeft <= 0 },
    { id: 'reveal', label: t('reveal'), quiet: true, more: true, disabled: s.over },
    { id: 'new', label: t('new_board'), primary: true, more: !s.over },
  ], action);

  const shown = s.revealed ? s.solutions : [...s.found];
  UI.setPanel(shown.length
    ? `<div class="chips">${shown.map((c) => `<span class="chip${s.found.has(c) ? '' : ' missed'}">${c.toUpperCase()}</span>`).join('')}</div>`
    : '');
}

/** End-of-round result for the daily share card. */
function summary() {
  if (!s.over) return null;
  const grid = '🟩'.repeat(s.found.size) + '⬛'.repeat(Math.max(0, s.need - s.found.size));
  // One number and a named outcome — a card with two numbers is not a currency.
  const clean = s.misses === 0 && s.hintsUsed === 0;
  return {
    grid,
    detail: `${s.found.size}/${s.need}`,
    outcome: s.found.size < s.need ? 'gave up' : clean ? 'flawless' : 'cleared',
    score: s.score,
    won: s.found.size >= s.need,
  };
}

function action(id) {
  if (id === 'hint') hint();
  else if (id === 'reveal') reveal();
  else if (id === 'new') host.restart();
}

function key(e) {
  if (e.key === 'Backspace') { pop(); return true; }
  if (e.key === 'Escape') { clearCombo(); render(); return true; }
  if (e.key === 'Enter') {
    if (s.combo.length === 3) { clearTimeout(s.submitId); submit(); }
    return true;
  }
  if (e.key.toLowerCase() === 'h') { hint(); return true; }
  return false;
}

export default {
  id: 'classic',
  get name() { return t('mode_classic'); },
  usesLevel: true,
  init(h) { host = h; },
  start, pick, key, render, summary,
};

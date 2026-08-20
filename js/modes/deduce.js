/* Deduce — a hidden three-tile combo, narrowed by position and value feedback. */

import * as E from '../engine.js';
import * as UI from '../ui.js';

/*
 * Budget is the whole difficulty lever. Hiding the value arrow on hard dropped a
 * perfect-information reference solver to a 50% win rate — a coin flip, not a
 * puzzle. Keeping the arrow and squeezing the budget instead measures
 * 100% / 96% / 82% for that solver across easy / normal / hard.
 */
const BANDS = {
  easy:   { guesses: 8 },
  normal: { guesses: 6 },
  hard:   { guesses: 5 },
};
const SCORE = { base: 600, perGuess: 90, floor: 80 };

let host = null;
let s = {};

function start() {
  const band = BANDS[host.level()];
  const puzzle = E.deducePuzzle({});
  s = {
    tiles: puzzle.tiles, secret: puzzle.secret, secretValue: puzzle.value,
    combo: [], guesses: [], left: band.guesses, over: false, won: false, score: 0,
  };
  UI.clearLog();
  UI.renderBoard(s.tiles, E.LETTERS, pick);
  UI.setBoardNote('Build a guess, then press <kbd>Enter</kbd>. Nothing auto-submits — this one rewards thinking.');
  UI.say(`A hidden combo is on this board. ${band.guesses} guesses.`);
  render();
}

/** Wordle-style position feedback; combos always hold three distinct tiles. */
function score(guess) {
  return [...guess].map((letter, i) => {
    if (s.secret[i] === letter) return 'hit';
    if (s.secret.includes(letter)) return 'moved';
    return 'off';
  });
}

function pick(letter) {
  if (s.over || s.combo.length >= 3) return;
  if (s.combo.includes(letter)) { UI.flashSlots('shake'); return; }
  host.clock.start();
  s.combo.push(letter);
  render();
}

function pop() {
  if (s.over || !s.combo.length) return;
  s.combo.pop();
  render();
}

function submit() {
  if (s.over || s.combo.length !== 3) { UI.flashSlots('shake'); return; }
  const guess = s.combo.join('');
  if (s.guesses.some((g) => g.combo === guess)) {
    UI.say(`<span class="mono">${guess.toUpperCase()}</span> — already guessed`);
    UI.flashSlots('shake');
    s.combo = [];
    render();
    return;
  }
  const value = E.comboValue(s.tiles, guess);
  const marks = score(guess);
  const delta = s.secretValue - value;
  s.guesses.push({ combo: guess, marks, value, delta });
  s.left -= 1;
  s.combo = [];

  if (guess === s.secret) {
    UI.flashSlots('good');
    finish(true);
  } else {
    UI.flashSlots('bad');
    const hits = marks.filter((m) => m === 'hit').length;
    const moved = marks.filter((m) => m === 'moved').length;
    UI.say(`<span class="mono">${guess.toUpperCase()}</span> = ${E.fmt(value)} — ` +
      `${hits} in place, ${moved} misplaced` +
      `, target value is ${delta === 0 ? 'the same' : delta > 0 ? 'higher' : 'lower'}`, 'no');
    if (s.left <= 0) finish(false);
  }
  render();
}

function finish(won) {
  host.clock.stop();
  s.over = true;
  s.won = won;
  const used = s.guesses.length;
  if (won) {
    s.score = Math.max(SCORE.floor, SCORE.base - SCORE.perGuess * (used - 1));
    UI.say(`Cracked it in ${used} guess${used === 1 ? '' : 'es'} — ${s.score} points.`, 'ok');
  } else {
    s.score = 0;
    UI.say(`Out of guesses. It was <span class="mono">${s.secret.toUpperCase()}</span> = ${E.fmt(s.secretValue)}.`, 'big');
  }
  host.award({ score: s.score, solved: won ? 1 : 0, cleared: won });
}

// Colour alone cannot carry the feedback — green vs amber is the common
// red-green failure case. Every cell also shows a glyph and a spoken label.
const MARK_GLYPH = { hit: '✓', moved: '↔', off: '·' };
const MARK_WORD = { hit: 'right tile, right slot', moved: 'right tile, wrong slot', off: 'not in the combo' };

function gridHTML() {
  if (!s.guesses.length) return '<span class="empty">No guesses yet.</span>';
  return s.guesses.map((g) => {
    const cells = [...g.combo].map((l, i) => {
      const mark = g.marks[i];
      return `<span class="gcell ${mark}" role="img" aria-label="${l.toUpperCase()}, ${MARK_WORD[mark]}">` +
        `<i class="gmark" aria-hidden="true">${MARK_GLYPH[mark]}</i>` +
        `<em>${l.toUpperCase()}</em><small>${i === 0 ? s.tiles[l].num : E.face(s.tiles[l])}</small></span>`;
    }).join('');
    const arrow = g.delta === 0 ? '=' : g.delta > 0 ? '↑' : '↓';
    const tail = `<span class="gval">${E.fmt(g.value)} <b class="garrow">${arrow}</b></span>`;
    return `<div class="grow">${cells}${tail}</div>`;
  }).join('');
}

function render() {
  UI.setHud([
    { label: 'Hidden combo', value: s.over && !s.won ? s.secret.toUpperCase() : '? ? ?', big: true },
    { label: 'Guesses left', value: s.left, warn: s.left <= 1 },
    { label: 'Score', value: s.score },
    { label: 'Time', value: host.clock.label() },
  ]);
  UI.setPrompt(s.combo.length === 3
    ? `${s.combo.map((l, i) => (i === 0 ? String(s.tiles[l].num) : `${E.SYMBOL[s.tiles[l].op]} ${s.tiles[l].num}`)).join(' ')} = <span class="res">${E.fmt(E.comboValue(s.tiles, s.combo.join('')))}</span> &nbsp;<span class="muted">press Enter</span>`
    : '<span class="muted">Green = right tile, right slot. Amber = right tile, wrong slot.</span>');
  UI.setSlots([0, 1, 2].map((i) => {
    const l = s.combo[i];
    return l ? { top: l, main: i === 0 ? s.tiles[l].num : E.face(s.tiles[l]) } : null;
  }), () => pop());
  UI.markBoard((letter) => {
    const idx = s.combo.indexOf(letter);
    const classes = [];
    if (idx !== -1) classes.push('used');
    if (idx === 0) classes.push('first');
    // Once a tile is proven absent from the secret, cross it off for good.
    const dead = s.guesses.some((g) => [...g.combo].some((l, i) => l === letter && g.marks[i] === 'off'));
    const known = s.guesses.some((g) => [...g.combo].some((l, i) => l === letter && g.marks[i] !== 'off'));
    if (dead && !known) classes.push('dead');
    if (known) classes.push('known');
    return { classes, disabled: s.over };
  });
  UI.setControls([
    { id: 'submit', label: 'Guess', disabled: s.over || s.combo.length !== 3 },
    { id: 'new', label: 'New puzzle', primary: true },
  ], action);
  UI.setPanel(`<h2 class="section-title">Guesses</h2><div class="grid">${gridHTML()}</div>`);
}

const EMOJI = { hit: '🟩', moved: '🟨', off: '⬛' };

function summary() {
  if (!s.over) return null;
  return {
    grid: s.guesses.map((g) => g.marks.map((m) => EMOJI[m]).join('')).join('\n'),
    detail: s.won ? `${s.guesses.length}/${s.guesses.length + s.left}` : `X/${s.guesses.length + s.left}`,
    score: s.score,
    won: s.won,
  };
}

function action(id) {
  if (id === 'submit') submit();
  else if (id === 'new') host.restart();
}

function key(e) {
  if (e.key === 'Backspace') { pop(); return true; }
  if (e.key === 'Escape') { s.combo = []; render(); return true; }
  if (e.key === 'Enter') { submit(); return true; }
  return false;
}

export default {
  id: 'deduce',
  name: 'Deduce',
  blurb: 'A hidden combo. Narrow it down with position and value clues.',
  usesLevel: true,
  rulesTitle: 'Deduce',
  rules: [
    'One three-tile combo is hidden. Build a guess and press <kbd>Enter</kbd>.',
'<strong>✓ green</strong> means right tile in the right slot; <strong>↔ amber</strong> means the tile is in the combo but a different slot; <strong>· grey</strong> means it is not in the combo at all.',
    'You also see your guess’s value and whether the hidden combo’s value is higher or lower — the arithmetic narrows it faster than the colours do.',
    'Tiles ruled out are crossed off the board automatically, so you never have to hold it all in your head.',
  ],
  init(h) { host = h; },
  start, pick, key, render, summary,
};

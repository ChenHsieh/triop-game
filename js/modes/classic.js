/* Classic — find every 3-tile combo that hits the target. */

import * as E from '../engine.js';
import * as UI from '../ui.js';

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
  UI.setBoardNote('First tile gives the <em>starting number</em> — its operator is ignored.');
  UI.say(s.need < s.solutions.length
    ? `New ${host.level()} board — find <strong>${s.need}</strong> of the ${s.solutions.length} combos that hit ${s.target}.`
    : `New ${host.level()} board — find <strong>all ${s.need}</strong> combo${s.need === 1 ? '' : 's'} that hit ${s.target}.`);
  render();
}

function pick(letter) {
  if (s.over || s.combo.length >= 3) return;
  if (s.combo.includes(letter)) { UI.flashSlots('shake'); return; }
  clearTimeout(s.submitId);
  s.combo.push(letter);
  host.clock.start();
  render();
  if (s.combo.length === 3) s.submitId = setTimeout(submit, 260);
}

function pop() {
  if (s.over || !s.combo.length) return;
  clearTimeout(s.submitId);
  s.combo.pop();
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
    UI.say(`<span class="mono">${label}</span> — already tried`);
    UI.flashSlots('shake');
    clearCombo();
    render();
    return;
  }
  s.tried.add(combo);

  if (whole === s.target) {
    s.found.add(combo);
    s.score += SCORE.hit;
    UI.say(`<span class="mono">${label}</span> = ${s.target} &nbsp;+${SCORE.hit}`, 'ok');
    UI.flashSlots('good');
    UI.pulseHud();
  } else {
    s.misses += 1;
    s.score -= SCORE.miss;
    const off = whole === null ? '' : ` (off by ${Math.abs(whole - s.target)})`;
    UI.say(`<span class="mono">${label}</span> = ${E.fmt(value)}${off} &nbsp;−${SCORE.miss}`, 'no');
    UI.flashSlots('bad');
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
  UI.say(`Hint: a solution starts <span class="mono">${pickOne.slice(0, 2).toUpperCase()}_</span> &nbsp;−${SCORE.hint}`, 'big');
  render();
}

function finish() {
  host.clock.stop();
  s.over = true;
  const secs = host.clock.seconds();
  const bonus = Math.max(0, BANDS[host.level()].timeBonus - 5 * secs);
  s.score += bonus;
  UI.say(`Board cleared in ${host.clock.label()} — time bonus +${bonus}`, 'big');
  if (s.misses === 0 && s.hintsUsed === 0) {
    s.score += SCORE.perfect;
    UI.say(`Flawless: no misses, no hints — +${SCORE.perfect}`, 'big');
  }
  s.score = Math.max(0, s.score);
  const spare = s.solutions.length - s.found.size;
  if (spare > 0) UI.say(`${spare} other combo${spare === 1 ? '' : 's'} also worked: <span class="mono">${s.solutions.filter((x) => !s.found.has(x)).map((x) => x.toUpperCase()).join(' ')}</span>`);
  host.award({ score: s.score, solved: s.found.size, cleared: true });
  UI.say(`Final score ${s.score}. Hit “New board” to go again.`, 'ok');
}

function reveal() {
  if (s.over) return;
  host.clock.stop();
  s.over = true;
  s.revealed = true;
  s.score = Math.max(0, s.score);
  const missed = s.solutions.filter((x) => !s.found.has(x));
  UI.say(`Revealed — ${missed.length} missed: <span class="mono">${missed.map((x) => x.toUpperCase()).join(' ') || '—'}</span>`, 'big');
  host.award({ score: s.score, solved: s.found.size, cleared: false });
  render();
}

function exprHTML(combo, withResult) {
  if (!combo.length) return '<span class="muted">Pick a tile to start</span>';
  const t = combo.map((l) => s.tiles[l]);
  let out = String(t[0].num);
  if (combo.length >= 2) out += ` ${E.SYMBOL[t[1].op]} ${t[1].num}`;
  if (combo.length === 3) {
    out = E.prec(t[2].op) > E.prec(t[1].op)
      ? `${t[0].num} ${E.SYMBOL[t[1].op]} <span class="paren">(</span>${t[1].num} ${E.SYMBOL[t[2].op]} ${t[2].num}<span class="paren">)</span>`
      : `${out} ${E.SYMBOL[t[2].op]} ${t[2].num}`;
    if (withResult) out += ` = <span class="res">${E.fmt(E.comboValue(s.tiles, combo.join('')))}</span>`;
  }
  return out;
}

function render() {
  UI.setHud([
    { label: 'Target', value: s.target, big: true },
    { label: 'Found', value: `${s.found.size}/${s.need}`, sub: s.need < s.solutions.length ? `${s.solutions.length} exist` : '' },
    { label: 'Score', value: s.score },
    { label: 'Time', value: host.clock.label() },
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
    return { classes, disabled: s.over };
  });
  UI.setControls([
    { id: 'hint', label: 'Hint', badge: s.hintsLeft, disabled: s.over || s.hintsLeft <= 0 },
    { id: 'reveal', label: 'Reveal & end', quiet: true, disabled: s.over },
    { id: 'new', label: 'New board', primary: true },
  ], action);

  const pips = Array.from({ length: s.need }, (_, i) => `<span class="pip${i < s.found.size ? ' on' : ''}"></span>`).join('');
  const shown = s.revealed ? s.solutions : [...s.found];
  const chips = shown.length
    ? shown.map((c) => `<span class="chip${s.found.has(c) ? '' : ' missed'}">${c.toUpperCase()}</span>`).join('')
    : '<span class="empty">None yet.</span>';
  UI.setPanel(`<h2 class="section-title">Solutions <span class="pips">${pips}</span></h2><div class="chips">${chips}</div>`);
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
  name: 'Classic',
  blurb: 'Find <em>every</em> three-tile combo that hits the target.',
  usesLevel: true,
  rulesTitle: 'Classic',
  rules: [
    'Pick <strong>three different tiles</strong>. Tile 1 supplies the starting number — its operator is ignored.',
    'Tiles 2 and 3 apply their operator under normal precedence (<code>×</code> and <code>÷</code> before <code>+</code> and <code>−</code>). The live line shows the implied parentheses.',
    'Clear the board by finding the required number of combos that land exactly on the target — shown as <em>Found</em> in the status bar.',
    'Misses cost points, so sweeping every combination is a losing strategy.',
  ],
  init(h) { host = h; },
  start, pick, key, render, summary,
};

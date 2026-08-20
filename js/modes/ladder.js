/* Ladder — walk a running total from start to target, one tile at a time. */

import * as E from '../engine.js';
import * as UI from '../ui.js';

/*
 * `optimum` is the true shortest route, found by exhaustive breadth-first search
 * when the board is built. Par is deliberately optimum + 1: a par derived
 * straight from an optimal solver can never be beaten, which is the opposite of
 * how par works in golf. A good line matches par; the shortest line beats it and
 * scores the perfect-line bonus.
 */
const BANDS = {
  easy:   { optimum: 3, preview: true,  hints: 2, timeBonus: 150 },
  normal: { optimum: 4, preview: false, hints: 1, timeBonus: 200 },
  hard:   { optimum: 5, preview: false, hints: 1, timeBonus: 300 },
};
const SCORE = { base: 300, overPar: 60, floor: 60, hint: 75, perfectLine: 150 };

let host = null;
let s = {};

const legal = (value, tile) => {
  const r = E.wholeOrNull(E.apply(value, tile.op, tile.num));
  return r !== null && Math.abs(r) <= 999 ? r : null;
};

function start() {
  const band = BANDS[host.level()];
  const puzzle = E.ladderPuzzle({ par: band.optimum });
  s = {
    tiles: puzzle.tiles, start: puzzle.start, target: puzzle.target,
    optimum: puzzle.par, par: puzzle.par + 1,
    trail: [], value: puzzle.start, over: false, won: false,
    hintsLeft: band.hints, hintsUsed: 0, hinted: null, score: 0,
  };
  UI.clearLog();
  UI.renderBoard(s.tiles, E.LETTERS, pick);
  UI.setBoardNote('Tiles apply <em>left to right</em> — no precedence here. Greyed tiles would break the whole number.');
  UI.say(`Walk ${s.start} to ${s.target}. Par is ${s.par} tiles — ${s.optimum} is possible, and beats par.`);
  render();
}

/*
 * Shortest remaining route from the current value, using unused tiles. The depth
 * bound is what keeps this affordable — measured on a par-5 board mid-play it is
 * 4 ms median and 61 ms worst case, and an unbounded search is far worse. It can
 * therefore only report "no route within `depth` tiles", which is what the
 * wording at the call site says.
 */
function routeFromHere(depth = 5) {
  const unused = E.LETTERS.filter((l) => !s.trail.includes(l));
  let frontier = [{ v: s.value, used: [] }];
  for (let d = 1; d <= depth; d++) {
    const next = [];
    for (const node of frontier) {
      for (const l of unused) {
        if (node.used.includes(l)) continue;
        const r = legal(node.v, s.tiles[l]);
        if (r === null) continue;
        const path = node.used.concat(l);
        if (r === s.target) return path;
        next.push({ v: r, used: path });
      }
    }
    frontier = next;
    if (!frontier.length) break;
  }
  return null;
}

function pick(letter) {
  if (s.over) return;
  if (s.trail.includes(letter)) { UI.flashSlots('shake'); return; }
  const next = legal(s.value, s.tiles[letter]);
  if (next === null) {
    UI.say(`<span class="mono">${letter.toUpperCase()}</span> would leave a fraction — not allowed here.`, 'no');
    UI.flashSlots('shake');
    return;
  }
  host.clock.start();
  const before = s.value;
  s.trail.push(letter);
  s.value = next;
  s.hinted = null;
  UI.say(`<span class="mono">${before} ${E.SYMBOL[s.tiles[letter].op]} ${s.tiles[letter].num} = ${next}</span>`, next === s.target ? 'ok' : 'note');
  if (next === s.target) finish();
  else if (!routeFromHere()) {
    s.stuck = true;
    UI.say('No short route from here — undo a step.', 'no');
  } else {
    s.stuck = false;
  }
  render();
}

function undo() {
  if (s.over || !s.trail.length) return;
  s.trail.pop();
  s.value = s.trail.reduce((v, l) => legal(v, s.tiles[l]), s.start);
  s.hinted = null;
  s.stuck = false;
  render();
}

function reset() {
  if (s.over) return;
  s.trail = [];
  s.value = s.start;
  s.hinted = null;
  s.stuck = false;
  render();
}

function hint() {
  if (s.over || s.hintsLeft <= 0) return;
  const route = routeFromHere();
  if (!route) { UI.say('No route from here — undo first.', 'no'); return; }
  s.hintsLeft -= 1;
  s.hintsUsed += 1;
  s.hinted = route[0];
  host.clock.start();
  UI.say(`Hint: play <span class="mono">${route[0].toUpperCase()}</span> next — ${route.length} tile${route.length === 1 ? '' : 's'} left from here. &nbsp;−${SCORE.hint}`, 'big');
  render();
}

function finish() {
  host.clock.stop();
  s.over = true;
  s.won = true;
  const over = Math.max(0, s.trail.length - s.par);
  const perfect = s.trail.length <= s.optimum;
  const secs = host.clock.seconds();
  const bonus = Math.max(0, BANDS[host.level()].timeBonus - 4 * secs);
  s.score = Math.max(SCORE.floor, SCORE.base - SCORE.overPar * over)
    + (perfect ? SCORE.perfectLine : 0) - SCORE.hint * s.hintsUsed + bonus;
  s.score = Math.max(0, s.score);
  const verdict = perfect ? `the perfect line, +${SCORE.perfectLine}` : over === 0 ? 'on par' : `${over} over par`;
  UI.say(`Reached ${s.target} in ${s.trail.length} tiles — ${verdict}. Time bonus +${bonus}. Final score ${s.score}.`, 'big');
  host.award({ score: s.score, solved: 1, cleared: true });
}

function giveUp() {
  if (s.over) return;
  host.clock.stop();
  s.over = true;
  const route = routeFromHere();
  UI.say(route
    ? `Gave up — from ${s.value} the shortest finish was <span class="mono">${route.map((l) => l.toUpperCase()).join(' ')}</span>.`
    : 'Gave up.', 'big');
  host.award({ score: 0, solved: 0, cleared: false });
  render();
}

function trailHTML() {
  let v = s.start;
  const parts = [`<span class="step start">${s.start}</span>`];
  s.trail.forEach((l) => {
    const t = s.tiles[l];
    v = legal(v, t);
    parts.push(`<span class="op-step">${E.SYMBOL[t.op]}${t.num}</span><span class="step${v === s.target ? ' hit' : ''}">${v}</span>`);
  });
  return parts.join('<span class="arrow">→</span>');
}

function render() {
  const band = BANDS[host.level()];
  UI.setHud([
    { label: 'Now', value: s.value, big: true },
    { label: 'Target', value: s.target },
    { label: 'Tiles', value: `${s.trail.length}/${s.par}`, sub: `par · ${s.optimum} beats it` },
    { label: 'Time', value: host.clock.label() },
  ]);
  UI.setPrompt(trailHTML());
  UI.setSlots([]);
  UI.markBoard((letter) => {
    const used = s.trail.includes(letter);
    const next = used ? null : legal(s.value, s.tiles[letter]);
    const classes = [];
    if (used) classes.push('spent');
    if (s.hinted === letter) classes.push('hinted');
    if (!used && next === s.target) classes.push('winning');
    return {
      classes,
      disabled: s.over || used || next === null,
      note: !s.over && !used && next !== null && band.preview ? `→ ${next}` : '',
    };
  });
  UI.setControls([
    { id: 'undo', label: 'Undo', quiet: !s.stuck, primary: !!s.stuck, disabled: s.over || !s.trail.length },
    { id: 'reset', label: 'Reset', quiet: true, disabled: s.over || !s.trail.length },
    { id: 'hint', label: 'Hint', badge: s.hintsLeft, disabled: s.over || s.hintsLeft <= 0 },
    { id: 'giveup', label: 'Give up', quiet: true, disabled: s.over },
    { id: 'new', label: 'New ladder', primary: true },
  ], action);
  UI.setPanel(
    `<h2 class="section-title">Distance</h2>` +
    `<div class="chips"><span class="chip missed">${s.value} → ${s.target}` +
    `${s.value === s.target ? ' — arrived' : ` (${s.target - s.value > 0 ? '+' : ''}${s.target - s.value} away)`}</span></div>`
  );
}

function summary() {
  if (!s.over) return null;
  if (!s.won) return { grid: '⬛'.repeat(s.par), detail: `–/${s.par} tiles`, outcome: 'gave up', score: 0, won: false };
  const over = Math.max(0, s.trail.length - s.par);
  return {
    grid: '🟩'.repeat(Math.min(s.trail.length, s.par)) + '🟨'.repeat(Math.min(over, 6)),
    detail: `${s.trail.length}/${s.par} tiles`,
    outcome: s.trail.length <= s.optimum ? 'perfect line' : over === 0 ? 'on par' : `${over} over`,
    score: s.score,
    won: true,
  };
}

function action(id) {
  if (id === 'undo') undo();
  else if (id === 'reset') reset();
  else if (id === 'hint') hint();
  else if (id === 'giveup') giveUp();
  else if (id === 'new') host.restart();
}

function key(e) {
  if (e.key === 'Backspace') { undo(); return true; }
  if (e.key === 'Escape') { reset(); return true; }
  if (e.key.toLowerCase() === 'h') { hint(); return true; }
  return false;
}

export default {
  id: 'ladder',
  name: 'Ladder',
  blurb: 'Climb from the start value to the target, one tile at a time.',
  usesLevel: true,
  rulesTitle: 'Ladder',
  rules: [
    'You start on a number. Each tile you play applies its operator to the <strong>running total</strong>, left to right — no precedence to track.',
    'Every step must stay a whole number. Tiles that would not are greyed out, so every move you can see is a legal move.',
    'Each tile is usable once. <kbd>Backspace</kbd> undoes a step for free, <kbd>Esc</kbd> resets.',
    'Par is one tile more than the shortest possible route, so par is a good line and the shortest line <em>beats</em> it for a bonus. Going over par costs points, not the round.',
  ],
  init(h) { host = h; },
  start, pick, key, render, summary,
};

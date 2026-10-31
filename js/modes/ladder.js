/* Ladder — walk a running total from start to target, one tile at a time. */

import * as E from '../engine.js';
import * as UI from '../ui.js';
import { cue } from '../audio.js';
import { t } from '../i18n.js';

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
  UI.say(t('l_walk', { start: s.start, target: s.target, par: s.par, opt: s.optimum }));
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
  if (s.trail.includes(letter)) { UI.flashSlots('shake'); cue.reject(); return; }
  const next = legal(s.value, s.tiles[letter]);
  if (next === null) {
    UI.say(t('l_fraction', { k: `<span class="mono">${letter.toUpperCase()}</span>` }), 'no');
    UI.flashSlots('shake');
    cue.reject();
    return;
  }
  host.clock.start();
  const before = s.value;
  s.trail.push(letter);
  s.value = next;
  s.hinted = null;
  UI.say(`<span class="mono">${before} ${E.SYMBOL[s.tiles[letter].op]} ${s.tiles[letter].num} = ${next}</span>`, next === s.target ? 'ok' : 'note');
  if (next === s.target) {
    finish();
  } else {
    cue.step(next > before);
    s.stuck = !routeFromHere();
    if (s.stuck) UI.say(t('l_stuck'), 'no');
  }
  render();
}

function undo() {
  if (s.over || !s.trail.length) return;
  s.trail.pop();
  cue.undo();
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
  if (!route) { UI.say(t('l_noroute'), 'no'); return; }
  s.hintsLeft -= 1;
  s.hintsUsed += 1;
  s.hinted = route[0];
  host.clock.start();
  UI.say(t('l_hint', { k: `<span class="mono">${route[0].toUpperCase()}</span>`, n: route.length, cost: SCORE.hint }), 'big');
  render();
}

function finish() {
  host.clock.stop();
  s.over = true;
  s.won = true;
  cue.win();
  const over = Math.max(0, s.trail.length - s.par);
  const perfect = s.trail.length <= s.optimum;
  const secs = host.clock.seconds();
  const bonus = Math.max(0, BANDS[host.level()].timeBonus - 4 * secs);
  s.score = Math.max(SCORE.floor, SCORE.base - SCORE.overPar * over)
    + (perfect ? SCORE.perfectLine : 0) - SCORE.hint * s.hintsUsed + bonus;
  s.score = Math.max(0, s.score);
  const verdict = perfect ? t('l_perfect') : over === 0 ? t('l_onpar') : t('l_over', { n: over });
  UI.say(t('l_win', { target: s.target, n: s.trail.length, verdict, score: s.score }), 'big');
  host.award({ score: s.score, solved: 1, cleared: true });
}

function giveUp() {
  if (s.over) return;
  host.clock.stop();
  s.over = true;
  cue.lose();
  const route = routeFromHere();
  UI.say(route
    ? t('l_gaveup', { v: s.value, route: `<span class="mono">${route.map((l) => l.toUpperCase()).join(' ')}</span>` })
    : t('gaveup'), 'big');
  host.award({ score: 0, solved: 0, cleared: false });
  render();
}

function trailHTML() {
  let v = s.start;
  const parts = [`<span class="step start">${s.start}</span>`];
  s.trail.forEach((l, i) => {
    const t = s.tiles[l];
    v = legal(v, t);
    const newest = i === s.trail.length - 1;
    parts.push(`<span class="op-step">${E.SYMBOL[t.op]}${t.num}</span>` +
      `<span class="step${v === s.target ? ' hit' : ''}${newest ? ' latest' : ''}">${v}</span>`);
  });
  return parts.join('<span class="arrow">→</span>');
}

function render() {
  const band = BANDS[host.level()];
  UI.setHud([
    { id: 'now', label: t('hud_now'), value: s.value, big: true },
    { id: 'target', label: t('hud_target'), value: s.target },
    { id: 'tiles', label: t('hud_tiles'), value: `${s.trail.length}/${s.par}`, sub: t('par_sub', { par: s.par, opt: s.optimum }) },
    { id: 'time', label: t('hud_time'), value: host.clock.label() },
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
    { id: 'undo', label: t('undo'), quiet: !s.stuck, primary: !!s.stuck, nudge: !!s.stuck,
      disabled: s.over || !s.trail.length },
    { id: 'reset', label: t('reset'), quiet: true, more: true, disabled: s.over || !s.trail.length },
    { id: 'hint', label: t('hint'), badge: s.hintsLeft, disabled: s.over || s.hintsLeft <= 0 },
    { id: 'giveup', label: t('giveup'), quiet: true, more: true, disabled: s.over },
    { id: 'new', label: t('new_ladder'), primary: true, more: !s.over },
  ], action);
  UI.setPanel('');
}

function summary() {
  if (!s.over) return null;
  if (!s.won) return { grid: '⬛'.repeat(s.par), detail: t('sum_tiles', { n: '-', par: s.par }), outcome: 'gave up', score: 0, won: false };
  const over = Math.max(0, s.trail.length - s.par);
  return {
    grid: '🟩'.repeat(Math.min(s.trail.length, s.par)) + '🟨'.repeat(Math.min(over, 6)),
    detail: t('sum_tiles', { n: s.trail.length, par: s.par }),
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
  get name() { return t('mode_ladder'); },
  usesLevel: true,
  init(h) { host = h; },
  start, pick, key, render, summary,
};

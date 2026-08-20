/* Sprint — one solution per target, against the clock. */

import * as E from '../engine.js';
import * as UI from '../ui.js';
import { cue, crossedDown } from '../audio.js';

/*
 * THE RUN LENGTH IS FIXED. Nothing the player does adds time.
 *
 * Clearing a target used to award seconds, which made the clock an unbounded
 * positive loop: the board never changes during a run, so a player memorises the
 * targets, and a remembered answer costs ~1.5s to type against a +3s award.
 * Simulated, 29% of Easy runs never ended at all, with a p90 length of 52
 * minutes. Capping the clock at its starting value does NOT fix this — that
 * bounds the stock while the flow is still positive, and measured the same 29%.
 * A single-player positive loop needs an engineered bound, and a fixed length is
 * the one that cannot be farmed.
 *
 * Lengths chosen so no run clears nothing: at 105/85/70s the 10th percentile is
 * 6/2/1 targets, against 4/1/0 at the old lengths.
 */
const BANDS = {
  easy:   { minSolutions: 16, seconds: 105 },
  normal: { minSolutions: 8,  seconds: 85 },
  hard:   { minSolutions: 5,  seconds: 70 },
};
/*
 * Sprint keeps the chain multiplier that Classic gives up. Here the uncertainty
 * is performative — "can I keep the run going" — rather than analytic, so the
 * chain is the thing being played, not noise over a price list.
 */
const BASE = 100;
const CHAIN_CAP = 5;
// Misses cost points, not seconds — the clock belongs to the run, not the score.
const MISS = 50;
const SKIP = 75;

let host = null;
let s = {};

/*
 * Targets are dealt from a shuffled bag rather than drawn uniformly. Same
 * long-run distribution, far shorter tails: uniform draws put a repeated target
 * in 88% of Easy runs, averaging 1.63 repeats out of 9 with a p95 worst case of
 * seeing one target three times. From a bag that is 2%. Repeats are also what
 * let a player memorise their way to a never-ending run, so this is the same
 * defect's second line of defence.
 */
function qualifying() {
  const band = BANDS[host.level()];
  return [...s.byValue.entries()]
    .filter(([value, combos]) => combos.length >= band.minSolutions && Math.abs(value) <= 150);
}

function pickTarget(exclude) {
  if (!s.bag || !s.bag.length) {
    s.bag = E.shuffle(qualifying());
    // Never hand back the target just cleared as the first of a fresh bag.
    if (s.bag.length > 1 && s.bag[s.bag.length - 1][0] === exclude) {
      const last = s.bag.length - 1;
      [s.bag[last], s.bag[0]] = [s.bag[0], s.bag[last]];
    }
  }
  const entry = s.bag.pop();
  if (!entry) return null;
  return { value: entry[0], combos: entry[1] };
}

function start() {
  const band = BANDS[host.level()];
  // A sprint board stays put for the whole run, so it needs to be rich.
  let tiles, byValue, viable;
  do {
    tiles = E.makeTiles();
    byValue = E.combosByValue(tiles);
    viable = [...byValue.values()].filter((c) => c.length >= band.minSolutions).length;
  } while (viable < 8);

  s = {
    tiles, byValue, combo: [], score: 0, chain: 0, solved: 0, misses: 0,
    msLeft: band.seconds * 1000, over: false, submitId: null, target: null, solutions: [], bag: [],
  };
  const first = pickTarget(null);
  s.target = first.value;
  s.solutions = first.combos;

  UI.clearLog();
  UI.renderBoard(s.tiles, E.LETTERS, pick);
  UI.setBoardNote(`The board stays fixed — only the target changes. <em>One</em> solution clears it.`);
  UI.say(`${band.seconds}s on the clock, and nothing extends it. Clear as many targets as you can.`);
  render();
}

// The clock draining is a failure with no event — the hardest kind to make feel
// fair. These fire on the crossing only, never per tick.
const CLOCK_WARNINGS = [0.5, 0.25, 0.1];

function tick(dt) {
  if (s.over || !s.running) return;
  const total = BANDS[host.level()].seconds * 1000;
  const before = s.msLeft / total;
  s.msLeft -= dt;
  if (s.msLeft <= 0) { s.msLeft = 0; finish(); render(); return; }
  crossedDown(before, s.msLeft / total, CLOCK_WARNINGS)
    .forEach((t) => cue.warn(CLOCK_WARNINGS.indexOf(t)));
  const secs = Math.ceil(s.msLeft / 1000);
  UI.setHudValue('Time left', `${secs}s`, secs <= 10);
}

function begin() {
  if (!s.running && !s.over) { s.running = true; host.clock.start(); }
}

function pick(letter) {
  if (s.over || s.combo.length >= 3) return;
  if (s.combo.includes(letter)) { UI.flashSlots('shake'); cue.reject(); return; }
  clearTimeout(s.submitId);
  begin();
  s.combo.push(letter);
  cue.pick();
  render();
  if (s.combo.length === 3) s.submitId = setTimeout(submit, 200);
}

function pop() {
  if (s.over || !s.combo.length) return;
  clearTimeout(s.submitId);
  s.combo.pop();
  cue.undo();
  render();
}

function submit() {
  if (s.over || s.combo.length !== 3) return;
  const band = BANDS[host.level()];
  const combo = s.combo.join('');
  const label = combo.toUpperCase();
  const value = E.comboValue(s.tiles, combo);
  const whole = E.wholeOrNull(value);
  s.combo = [];

  if (whole === s.target) {
    s.chain = Math.min(CHAIN_CAP, s.chain + 1);
    s.solved += 1;
    const points = BASE * s.chain;
    s.score += points;
    UI.say(`<span class="mono">${label}</span> = ${s.target} &nbsp;+${points}` +
      (s.chain > 1 ? ` <span class="note">(×${s.chain})</span>` : ''), 'ok');
    UI.flashSlots('good');
    cue.hit();
    UI.pulseHud();
    nextTarget();
  } else {
    s.chain = 0;
    s.misses += 1;
    s.score -= MISS;
    const off = whole === null ? '' : ` (off by ${Math.abs(whole - s.target)})`;
    UI.say(`<span class="mono">${label}</span> = ${E.fmt(value)}${off} &nbsp;<span class="no">−${MISS}</span>`, 'no');
    UI.flashSlots('bad');
    cue.miss();
  }
  render();
}

function nextTarget() {
  const next = pickTarget(s.target);
  if (!next) { finish(); return; }
  s.target = next.value;
  s.solutions = next.combos;
}

function skip() {
  if (s.over) return;
  s.score -= SKIP;
  s.chain = 0;
  UI.say(`Skipped ${s.target} — <span class="no">−${SKIP}</span>`, 'note');
  nextTarget();
  render();
}

function finish() {
  s.over = true;
  s.running = false;
  s.score = Math.max(0, s.score);
  host.clock.stop();
  cue.lose();
  UI.say(`Time. ${s.solved} target${s.solved === 1 ? '' : 's'} cleared — final score ${s.score}.`, 'big');
  host.award({ score: s.score, solved: s.solved, cleared: s.solved > 0 });
}

function render() {
  const secs = Math.ceil(s.msLeft / 1000);
  UI.setHud([
    { label: 'Target', value: s.over ? '—' : s.target, big: true },
    { label: 'Cleared', value: s.solved },
    { label: 'Score', value: s.score, sub: s.chain > 1 ? `chain ×${s.chain}` : '' },
    { label: 'Time left', value: `${secs}s`, warn: secs <= 10 },
  ]);
  UI.setPrompt(s.over
    ? `<span class="muted">Run over — ${s.solved} cleared, ${s.score} points.</span>`
    : (s.combo.length
        ? s.combo.map((l, i) => (i === 0 ? String(s.tiles[l].num) : `${E.SYMBOL[s.tiles[l].op]} ${s.tiles[l].num}`)).join(' ')
        : '<span class="muted">Any one combo clears the target</span>'));
  UI.setSlots([0, 1, 2].map((i) => {
    const l = s.combo[i];
    return l ? { top: l, main: i === 0 ? s.tiles[l].num : E.face(s.tiles[l]) } : null;
  }), () => pop());
  UI.markBoard((letter) => {
    const idx = s.combo.indexOf(letter);
    const classes = [];
    if (idx !== -1) classes.push('used');
    if (idx === 0) classes.push('first');
    return { classes, disabled: s.over };
  });
  UI.setControls([
    { id: 'skip', label: 'Skip target', quiet: true, disabled: s.over },
    { id: 'new', label: 'New run', primary: true },
  ], action);
  UI.setPanel(s.over
    ? ''
    : `<h2 class="section-title">This target</h2><div class="chips"><span class="chip missed">${s.solutions.length} combos work — you need one</span></div>`);
}

function summary() {
  if (!s.over) return null;
  return {
    grid: '⚡'.repeat(Math.min(s.solved, 12)) || '⬛',
    detail: `${s.solved} target${s.solved === 1 ? '' : 's'}`,
    outcome: s.misses === 0 && s.solved > 0 ? 'clean run' : 'run over',
    score: s.score,
    won: s.solved > 0,
  };
}

function action(id) {
  if (id === 'skip') skip();
  else if (id === 'new') host.restart();
}

function key(e) {
  if (e.key === 'Backspace') { pop(); return true; }
  if (e.key === 'Escape') { s.combo = []; render(); return true; }
  if (e.key === 'Enter') {
    if (s.combo.length === 3) { clearTimeout(s.submitId); submit(); }
    return true;
  }
  if (e.key === ' ') { skip(); return true; }
  return false;
}

export default {
  id: 'sprint',
  name: 'Sprint',
  blurb: 'One solution per target, as many as you can fit in a fixed run.',
  usesLevel: true,
  rulesTitle: 'Sprint',
  rules: [
    'Same three-tile arithmetic as Classic, but you only need <strong>one</strong> combo per target.',
    'The board never changes — you learn it as you go, which is the whole point.',
    'The run is a fixed length and <strong>nothing extends it</strong> — clearing a target raises your chain multiplier, and a miss costs points and resets it.',
    '<kbd>Space</kbd> skips a target for a bigger point penalty.',
  ],
  init(h) { host = h; },
  start, pick, key, render, tick, summary,
};

/* Sprint — one solution per target, against the clock. */

import * as E from '../engine.js';
import * as UI from '../ui.js';

/*
 * Measured median combos a scanning player examines before finding one solution,
 * by target richness: >=16 -> 39, >=8 -> 53, >=5 -> 74, >=2 -> 137. The old
 * hard band (>=2) had a p90 of 622 inside a 45s clock — unfinishable. Targets
 * are now dense enough that the clock, not the haystack, is the pressure.
 */
const BANDS = {
  easy:   { minSolutions: 16, seconds: 90, reward: 3, penalty: 4, skip: 6 },
  normal: { minSolutions: 8,  seconds: 70, reward: 3, penalty: 5, skip: 8 },
  hard:   { minSolutions: 5,  seconds: 55, reward: 2, penalty: 6, skip: 10 },
};
/*
 * Sprint keeps the chain multiplier that Classic gives up. Here the uncertainty
 * is performative — "can I keep the run going" — rather than analytic, so the
 * chain is the thing being played, not noise over a price list.
 */
const BASE = 100;
const CHAIN_CAP = 5;

let host = null;
let s = {};

function pickTarget(exclude) {
  const band = BANDS[host.level()];
  const options = [...s.byValue.entries()]
    .filter(([value, combos]) => combos.length >= band.minSolutions && Math.abs(value) <= 150 && value !== exclude);
  if (!options.length) return null;
  const [value, combos] = E.pickFrom(options);
  return { value, combos };
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
    msLeft: band.seconds * 1000, over: false, submitId: null, target: null, solutions: [],
  };
  const first = pickTarget(null);
  s.target = first.value;
  s.solutions = first.combos;

  UI.clearLog();
  UI.renderBoard(s.tiles, E.LETTERS, pick);
  UI.setBoardNote(`The board stays fixed — only the target changes. <em>One</em> solution clears it.`);
  UI.say(`${band.seconds}s sprint. Hit each target once; the clock is the only thing you can lose.`);
  render();
}

function tick(dt) {
  if (s.over || !s.running) return;
  s.msLeft -= dt;
  if (s.msLeft <= 0) { s.msLeft = 0; finish(); render(); return; }
  const secs = Math.ceil(s.msLeft / 1000);
  UI.setHudValue('Time left', `${secs}s`, secs <= 10);
}

function begin() {
  if (!s.running && !s.over) { s.running = true; host.clock.start(); }
}

function pick(letter) {
  if (s.over || s.combo.length >= 3) return;
  if (s.combo.includes(letter)) { UI.flashSlots('shake'); return; }
  clearTimeout(s.submitId);
  begin();
  s.combo.push(letter);
  render();
  if (s.combo.length === 3) s.submitId = setTimeout(submit, 200);
}

function pop() {
  if (s.over || !s.combo.length) return;
  clearTimeout(s.submitId);
  s.combo.pop();
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
    s.msLeft += band.reward * 1000;
    UI.say(`<span class="mono">${label}</span> = ${s.target} &nbsp;+${points}` +
      (s.chain > 1 ? ` <span class="note">(×${s.chain})</span>` : '') +
      ` <span class="note">+${band.reward}s</span>`, 'ok');
    UI.flashSlots('good');
    UI.pulseHud();
    nextTarget();
  } else {
    s.chain = 0;
    s.misses += 1;
    s.msLeft -= band.penalty * 1000;
    const off = whole === null ? '' : ` (off by ${Math.abs(whole - s.target)})`;
    UI.say(`<span class="mono">${label}</span> = ${E.fmt(value)}${off} &nbsp;<span class="no">−${band.penalty}s</span>`, 'no');
    UI.flashSlots('bad');
    if (s.msLeft <= 0) { s.msLeft = 0; finish(); }
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
  const band = BANDS[host.level()];
  s.msLeft -= band.skip * 1000;
  s.chain = 0;
  UI.say(`Skipped ${s.target} — <span class="no">−${band.skip}s</span>`, 'note');
  if (s.msLeft <= 0) { s.msLeft = 0; finish(); return; }
  nextTarget();
  render();
}

function finish() {
  s.over = true;
  s.running = false;
  host.clock.stop();
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
  blurb: 'One solution per target. The clock is the only thing you can lose.',
  usesLevel: true,
  rulesTitle: 'Sprint',
  rules: [
    'Same three-tile arithmetic as Classic, but you only need <strong>one</strong> combo per target.',
    'The board never changes — you learn it as you go, which is the whole point.',
    'Clearing a target adds seconds and raises your chain multiplier; a miss costs seconds and resets it.',
    '<kbd>Space</kbd> skips a target for a bigger time penalty.',
  ],
  init(h) { host = h; },
  start, pick, key, render, tick, summary,
};

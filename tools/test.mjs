import { install } from './dom.mjs';
const IDS = ['tabs','blurb','hud','prompt','slots','board','board-note','level','level-field','sound','controls','share','panel','log','stats','transfer','rules'];
const { store, doc } = install(IDS);
doc.visibilityState = 'visible';
store['level'].value = 'normal';

const E = await import('../js/engine.js');
await import('../js/main.js');

const key = (k) => doc.fire('keydown', { key: k, preventDefault() {}, metaKey: false, ctrlKey: false, altKey: false });
const tabs = () => store['tabs'].children;
const gotoMode = (name) => { const t = tabs().find((b) => b.textContent === name); t.fire('click'); };
const setLevel = (lv) => { store['level'].value = lv; store['level'].fire('change'); };
const hud = () => store['hud'].children.map((c) => c.innerHTML.replace(/<[^>]+>/g, '|').replace(/\|+/g, '|'));
const ctl = (label) => store['controls'].children.find((b) => b.innerHTML.includes(label));
const tiles = () => store['board'].children.map((b) => b.dataset.letter);
const parseTile = (btn) => { const m = btn.innerHTML.match(/class="sym">(.)<\/span>(\d+)/); return { op: m[1], num: +m[2] }; };
const boardMap = () => Object.fromEntries(store['board'].children.map((b) => [b.dataset.letter, parseTile(b)]));
const feed = (n = 1) => store['log'].children.slice(0, n).map((r) => r.innerHTML.replace(/<[^>]+>/g, ''));
const SYM = { '+': '+', '−': '-', '×': '*', '÷': '/' };
const num = (s) => Number(String(s).replace(/[^\-0-9.]/g, ''));

let fails = 0;
const check = (label, cond, extra = '') => {
  if (!cond) { fails++; console.log('  FAIL:', label, extra); }
  else console.log('  ok:', label, extra);
};

console.log('\n=== tabs ===');
check('daily + four modes registered', tabs().length === 5, tabs().map((t) => t.textContent).join(','));
check('ladder leads the mode tabs', tabs()[1].textContent === 'Ladder', tabs()[1].textContent);

/* ---------------- CLASSIC ---------------- */
console.log('\n=== classic ===');
gotoMode('Classic'); setLevel('normal');
{
  const tm = boardMap();
  const target = num(hud()[0]);
  const cell = hud()[1];                       // "|Found|0/3|11 exist|"
  const need = Number(cell.split('|')[2].split('/')[1]);
  const subMatch = cell.match(/(\d+) exist/);
  const existing = subMatch ? Number(subMatch[1]) : need;
  const L = tiles();
  const sols = [];
  for (const a of L) for (const b of L) for (const c of L) {
    if (a === b || b === c || a === c) continue;
    const v = E.evaluate(tm[a].num, SYM[tm[b].op], tm[b].num, SYM[tm[c].op], tm[c].num);
    if (E.wholeOrNull(v) === target) sols.push(a + b + c);
  }
  check('solution count matches independent solve', sols.length === existing, `${sols.length} vs ${existing}`);
  check('required <= available', need <= existing, `need ${need} of ${existing}`);
  sols.forEach((s) => { [...s].forEach(key); key('Enter'); });
  check('board clears at the required count', hud()[1].includes(`${need}/${need}`), hud()[1]);
  check('scores > 0 on a clean clear', num(hud()[2]) > 0, `score ${num(hud()[2])}`);
  console.log('  feed:', feed(3));
}

/* ---------------- SPRINT ---------------- */
console.log('\n=== sprint ===');
gotoMode('Sprint');
{
  const tm = boardMap();
  const L = tiles();
  const solve = (target) => {
    for (const a of L) for (const b of L) for (const c of L) {
      if (a === b || b === c || a === c) continue;
      const v = E.evaluate(tm[a].num, SYM[tm[b].op], tm[b].num, SYM[tm[c].op], tm[c].num);
      if (E.wholeOrNull(v) === target) return a + b + c;
    }
    return null;
  };
  const t0 = num(hud()[0]);
  const time0 = num(hud()[3]);
  const combo = solve(t0);
  check('first target is solvable on this board', !!combo, String(t0));
  [...combo].forEach(key); key('Enter');
  check('target advances after a hit', num(hud()[0]) !== t0, `${t0} -> ${num(hud()[0])}`);
  check('cleared counter increments', num(hud()[1]) === 1, hud()[1]);
  // The runaway regression: awarding time per hit made 29% of Easy runs endless.
  check('clearing a target never extends the clock', num(hud()[3]) <= time0, `${time0}s -> ${num(hud()[3])}s`);
  // deliberate miss
  const t1 = num(hud()[0]);
  const before = num(hud()[3]);
  let wrong = null;
  for (const a of L) for (const b of L) for (const c of L) {
    if (a === b || b === c || a === c || wrong) continue;
    const v = E.evaluate(tm[a].num, SYM[tm[b].op], tm[b].num, SYM[tm[c].op], tm[c].num);
    if (E.wholeOrNull(v) !== t1) wrong = a + b + c;
  }
  const scoreBefore = num(hud()[2]);
  [...wrong].forEach(key); key('Enter');
  check('miss costs points, not seconds', num(hud()[2]) < scoreBefore && num(hud()[3]) === before,
    `score ${scoreBefore} -> ${num(hud()[2])}, clock ${before}s -> ${num(hud()[3])}s`);
  const scoreBeforeSkip = num(hud()[2]);
  ctl('Skip').fire('click');
  check('skip costs points and moves on', num(hud()[0]) !== t1 && num(hud()[2]) < scoreBeforeSkip);
  console.log('  feed:', feed(2));

  // Targets come from a shuffled bag: uniform draws repeated a target in 88% of
  // Easy runs, and repeats are what let a player memorise their way to a
  // never-ending run.
  gotoMode('Sprint'); setLevel('easy');
  const tm2 = boardMap(), L2 = tiles();          // the level switch built a new board
  const solve2 = (target) => {
    for (const a of L2) for (const b of L2) for (const c of L2) {
      if (a === b || b === c || a === c) continue;
      const v = E.evaluate(tm2[a].num, SYM[tm2[b].op], tm2[b].num, SYM[tm2[c].op], tm2[c].num);
      if (E.wholeOrNull(v) === target) return a + b + c;
    }
    return null;
  };
  const seen = [];
  for (let i = 0; i < 8; i++) {
    const t = num(hud()[0]);
    seen.push(t);
    const c = solve2(t);
    if (c) { [...c].forEach(key); key('Enter'); } else { ctl('Skip').fire('click'); }
  }
  check('no target repeats inside one bag', new Set(seen).size === seen.length,
    `${new Set(seen).size} distinct of ${seen.length}`);
}

/* ---------------- LADDER ---------------- */
console.log('\n=== ladder ===');
for (const lv of ['easy', 'normal', 'hard']) {
  gotoMode('Ladder'); setLevel(lv);
  const startVal = num(hud()[0]);
  const target = num(hud()[1]);
  const par = Number(hud()[2].split('|')[2].split('/')[1]);
  const tm = boardMap();
  const L = tiles();
  // independent BFS for the true minimum
  const opOf = (l) => SYM[tm[l].op];
  let frontier = [{ v: startVal, used: [] }], found = null;
  for (let d = 1; d <= par && !found; d++) {
    const next = [];
    for (const n of frontier) for (const l of L) {
      if (n.used.includes(l)) continue;
      const r = E.wholeOrNull(E.apply(n.v, opOf(l), tm[l].num));
      if (r === null || Math.abs(r) > 999) continue;
      const path = n.used.concat(l);
      if (r === target && !found) found = path;
      next.push({ v: r, used: path });
    }
    frontier = next;
  }
  // Par must be beatable by exactly one tile: a par taken straight from an
  // optimal solver can never be beaten, which is the opposite of golf.
  check(`${lv}: a route to the target exists`, !!found, found ? found.join('') : 'none');
  check(`${lv}: par ${par} is beatable by exactly one tile`, found.length === par - 1, `shortest is ${found.length}`);
  // an illegal tile must be refused
  const illegal = L.find((l) => E.wholeOrNull(E.apply(startVal, opOf(l), tm[l].num)) === null);
  if (illegal) {
    key(illegal);
    check(`${lv}: fractional move refused`, num(hud()[0]) === startVal, `tile ${illegal}`);
  }
  found.forEach(key);
  check(`${lv}: reaching target ends the ladder`, hud()[0].includes(String(target)), hud()[0]);
  check(`${lv}: the shortest line is named as beating par`, feed(1)[0].includes('perfect line'), feed(1)[0]);
  console.log('  ', lv, 'feed:', feed(1));
}

/* ---------------- DEDUCE ---------------- */
console.log('\n=== deduce ===');
gotoMode('Deduce'); setLevel('normal');
{
  const L = tiles();
  const guessesLeft0 = num(hud()[1]);
  check('starts with 6 guesses on normal', guessesLeft0 === 6, String(guessesLeft0));
  // wrong guess first
  key(L[0]); key(L[1]); key(L[2]); key('Enter');
  check('a guess is consumed', num(hud()[1]) === guessesLeft0 - 1, hud()[1]);
  const stillPossible = () => Number(hud()[2].split('|')[2]);
  check('candidate counter is live and below the full space', stillPossible() > 0 && stillPossible() < 1320, `${stillPossible()} of 1320`);
  check('guess row rendered', store['panel'].innerHTML.includes('gcell'));
  // brute force the secret using only the feedback channel
  const marksOf = () => {
    const rows = store['panel'].innerHTML.split('<div class="grow">').slice(1);
    const last = rows[rows.length - 1];
    return [...last.matchAll(/class="gcell (\w+)"/g)].map((m) => m[1]);
  };
  let solved = false;
  outer:
  for (const a of L) for (const b of L) for (const c of L) {
    if (a === b || b === c || a === c) continue;
    if (num(hud()[1]) <= 0) break outer;
    const beforeN = stillPossible();
    key(a); key(b); key(c); key('Enter');
    if (marksOf().every((m) => m === 'hit')) { solved = true; break outer; }
    if (stillPossible() > beforeN) { check('candidate count never grows', false, `${beforeN} -> ${stillPossible()}`); break outer; }
  }
  check('duplicate guesses do not jam the input', num(hud()[1]) === 0 || solved, `left=${num(hud()[1])} solved=${solved}`);
  check('losing reveals the secret', solved || store['hud'].children[0].innerHTML.match(/[A-Z]{3}/) !== null, hud()[0]);
  console.log('  feed:', feed(1));
}

/* ---------------- deduce: the candidate counter must never lie ---------------- */
console.log('\n=== deduce candidate invariant ===');
{
  let minSeen = Infinity, rounds = 0, monotone = true, everZero = false;
  for (let r = 0; r < 6; r++) {
    gotoMode('Deduce'); setLevel('normal');
    const L = tiles();
    const count = () => Number(hud()[2].split('|')[2]);
    let prev = count();
    rounds++;
    for (let g = 0; g < 5; g++) {
      // a random distinct triple
      const pick = E.shuffle(L.slice()).slice(0, 3);
      pick.forEach(key); key('Enter');
      const now = count();
      if (Number.isNaN(now)) break;             // round ended
      if (now > prev) monotone = false;
      if (now === 0) everZero = true;
      minSeen = Math.min(minSeen, now);
      prev = now;
    }
  }
  // If the secret ever fell out of the set the count would reach zero while the
  // round was still live — the set always contains at least the true answer.
  check('candidate count never reaches zero', !everZero, `min seen ${minSeen} over ${rounds} rounds`);
  check('candidate count never grows', monotone, '');
}

/* ---------------- sprint run-out ---------------- */
console.log('\n=== sprint run length is bounded ===');
{
  gotoMode('Sprint'); setLevel('easy');
  const tm = boardMap(); const L = tiles();
  const solveFor = (target) => {
    for (const a of L) for (const b of L) for (const c of L) {
      if (a === b || b === c || a === c) continue;
      const v = E.evaluate(tm[a].num, SYM[tm[b].op], tm[b].num, SYM[tm[c].op], tm[c].num);
      if (E.wholeOrNull(v) === target) return a + b + c;
    }
    return null;
  };
  const startClock = num(hud()[3]);
  // Clear targets perfectly while advancing only 1.5s each turn — a recalling
  // player on a memorised board, which is exactly the play pattern that used to
  // make a run immortal.
  let cleared = 0, ticks = 0;
  while (num(hud()[3]) > 0 && ticks < 400) {
    const c = solveFor(num(hud()[0]));
    if (c) { [...c].forEach(key); key('Enter'); cleared++; }
    globalThis.__triopAdvance(1500);
    ticks++;
  }
  check('a flawless run still ends', num(hud()[3]) === 0, `${cleared} targets cleared`);
  check('play time never exceeded the stated run length', ticks * 1.5 <= startClock + 2,
    `${(ticks * 1.5).toFixed(0)}s of play against a ${startClock}s clock`);
  check('run-over state is announced', feed(1)[0].includes('Time.'), feed(1)[0]);
}

/* ---------------- persistence ---------------- */
console.log('\n=== stats ===');
{
  const labels = store['stats'].innerHTML;
  check('stats panel names the active mode', labels.includes('Sprint'), '');
  const raw = localStorage.getItem('triop.stats.v2');
  const parsed = JSON.parse(raw);
  check('per-mode stats persisted for all four', Object.keys(parsed.modes).length === 4, Object.keys(parsed.modes).join(','));
  console.log('  stored:', raw);
}

/* ---------------- DAILY ---------------- */
console.log('\n=== daily ===');
{
  const D = await import('../js/daily.js');
  // day numbering and rollover
  const d1 = D.dayNumber(new Date(2026, 7, 19, 23, 59));
  const d2 = D.dayNumber(new Date(2026, 7, 20, 0, 1));
  check('day 1 is the epoch date', d1 === 1, String(d1));
  check('rolls over at local midnight', d2 === 2, `${d1} -> ${d2}`);
  check('rotation covers every mode', new Set([1,2,3,4].map((d) => D.modeForDay(d, ['ladder','classic','sprint','deduce']))).size === 4);
  check('seed is stable per day+mode', D.seedFor(7,'ladder') === D.seedFor(7,'ladder') && D.seedFor(7,'ladder') !== D.seedFor(8,'ladder'));

  // the board must be identical for two independent players on the same day
  const day = D.dayNumber();
  const modeId = D.modeForDay(day, ['ladder','classic','sprint','deduce']);
  const seed = D.seedFor(day, modeId);
  const boardFor = () => { E.setSeed(seed); const t = E.makeTiles(); E.clearSeed(); return JSON.stringify(t); };
  check('same day -> byte-identical board', boardFor() === boardFor(), modeId);
  E.setSeed(D.seedFor(day + 1, modeId)); const tomorrow = JSON.stringify(E.makeTiles()); E.clearSeed();
  check('next day -> different board', boardFor() !== tomorrow);

  // play the daily through the real UI
  const dailyTab = tabs()[0];
  dailyTab.fire('click');
  check('daily tab hides the difficulty selector', store['level-field'].hidden === true);
  check('daily announces the board before you finish', !!store['share'].querySelector('.daily-note'), '');
  check('daily uses the rotated mode', store['blurb'].innerHTML.includes('today it is'), '');

  // finish it: the daily rotation lands on one mode, so drive whichever it is
  const before = JSON.stringify(store['board'].children.map((b) => b.innerHTML));
  ctl('New') && ctl('New').fire('click');
  const after = JSON.stringify(store['board'].children.map((b) => b.innerHTML));
  check('replaying the daily gives the same board', before === after, '');

  // force a completion through whichever mode is live, then check the card
  const give = ctl('Give up') || ctl('Reveal') ;
  if (give) { give.fire('click'); }
  else {
    // sprint or deduce: burn the budget
    // Distinct guesses each time: a repeated one is rejected without consuming
    // the budget, so reusing the same triple would never end the round.
    const L = tiles(); let guard = 0;
    outerBurn:
    for (const a of L) for (const b2 of L) for (const c of L) {
      if (a === b2 || b2 === c || a === c) continue;
      if (store['share'].querySelector('.share-card') || guard++ > 40) break outerBurn;
      key(a); key(b2); key(c); key('Enter');
    }
  }
  const card = store['share'].querySelector('.share-card');
  check('share card appears once the daily is done', !!card, '');
  const stored = D.loadResult(day);
  check('daily result stored for today', stored && stored.day === day, JSON.stringify(stored));
  const text = D.shareText(stored);
  // A spoiler would be a literal combo, which the game always renders uppercase.
  check('share text leaks no combo', !/[QWERASDFZXCV]{3}/.test(text), text.replace(/\n/g, ' | '));
  check('share text carries day, mode and outcome', text.includes(`#${day}`) && text.includes(stored.modeName) && text.includes(stored.outcome));
  check('share text no longer carries points as a second number', !text.includes('pts'), text.replace(/\n/g, ' | '));
  console.log('  share text:'); console.log(text.split('\n').map((l) => '    ' + l).join('\n'));

  // a second completion must not overwrite the first
  const firstScore = stored.score;
  ctl('New') && ctl('New').fire('click');
  const give2 = ctl('Give up') || ctl('Reveal');
  if (give2) give2.fire('click');
  const after2 = D.loadResult(day);
  check('replaying does not overwrite the recorded result', JSON.stringify(after2) === JSON.stringify(stored), `mode=${stored.mode} score=${firstScore}`);

  // --- history and streak: the outer loop had no memory before this ---
  const hist = (...days) => Object.fromEntries(days.map(([d, won]) => [d, { day: d, won }]));
  check('streak counts consecutive solved days back from today',
    D.streak(10, hist([10, true], [9, true], [8, true])) === 3);
  check('an unplayed today does not break the streak',
    D.streak(11, hist([10, true], [9, true])) === 2);
  check('a lost day breaks the streak',
    D.streak(10, hist([10, true], [9, false], [8, true])) === 1);
  check('a skipped day breaks the streak',
    D.streak(10, hist([10, true], [8, true], [7, true])) === 1);
  check('no history means no streak', D.streak(10, {}) === 0);
  check('past days survive a new day being written', Object.keys(D.loadHistory()).length >= 1,
    Object.keys(D.loadHistory()).join(','));
}

/* ---------------- restore codes ---------------- */
console.log('\n=== restore codes ===');
{
  const D = await import('../js/daily.js');
  const mk = (n) => {
    const h = {};
    for (let d = 1; d <= n; d++) h[d] = { day: d, mode: 'ladder', won: d % 9 !== 0, score: 500,
      detail: '4/5 tiles', outcome: d % 9 ? 'on par' : 'gave up' };
    return h;
  };

  const code = D.exportCode(mk(30), { modes: { ladder: { best: 750, plays: 12, cleared: 9 } }, solved: 140 });
  check('a 30-day code is short enough to paste', code.length < 800, `${code.length} chars`);
  check('code is prefixed and checksummed', /^TRIOP1\.[A-Za-z0-9_-]+\.[a-z0-9]+$/.test(code), code.slice(0, 30) + '…');
  check('code leaks no combo', !/[QWERASDFZXCV]{3}/.test(code.split('.')[0]), '');

  // round trip into a clean store
  localStorage.setItem('triop.daily.v2', JSON.stringify({ days: {} }));
  const r1 = D.importCode(code);
  check('round trip restores every day', r1.ok && r1.added === 30, JSON.stringify({ added: r1.added, kept: r1.kept }));
  check('streak survives the round trip', D.streak(30) === 3, String(D.streak(30)));
  check('per-mode records travel with it', r1.stats && r1.stats.modes.ladder.best === 750, '');

  // idempotence
  const r2 = D.importCode(code);
  check('re-importing changes nothing', r2.ok && r2.added === 0 && r2.kept === 30, JSON.stringify({ added: r2.added, kept: r2.kept }));

  // a code must never clobber a day you actually played here
  const local = D.loadHistory();
  local[5] = { day: 5, mode: 'deduce', won: false, score: 0, detail: 'X/6', outcome: 'played here' };
  localStorage.setItem('triop.daily.v2', JSON.stringify({ days: local }));
  D.importCode(code);
  check('a local day is never overwritten by a code', D.loadResult(5).outcome === 'played here', D.loadResult(5).outcome);

  // rejection paths
  const [pfx, body, sum] = code.split('.');
  check('a damaged body is rejected', !D.importCode([pfx, body.slice(0, -8), sum].join('.')).ok);
  check('a single flipped character is rejected', !D.importCode([pfx, body.slice(0, 10) + 'X' + body.slice(11), sum].join('.')).ok);
  check('a truncated paste is rejected', !D.importCode(code.slice(0, 60)).ok);
  check('unrelated text is rejected', !D.importCode('hello world').ok);
  check('whitespace and line breaks survive a paste', D.importCode('  ' + code.slice(0, 40) + '\n' + code.slice(40) + ' ').ok);

  // the UI is wired
  check('transfer panel rendered', !!store['transfer'].querySelector('.transfer-field'), '');
  const buttons = store['transfer'].querySelectorAll('btn');
  check('copy and restore controls exist', store['transfer'].children.length >= 4, `${store['transfer'].children.length} nodes`);
}

/* ---------------- the first slot ignores its operator ---------------- */
console.log('\n=== operator signalling ===');
{
  const muted = () => store['board'].children.filter((t) => t.classList.contains('op-muted')).length;
  for (const mode of ['Classic', 'Sprint', 'Deduce']) {
    gotoMode(mode);
    if (mode !== 'Sprint') setLevel('normal');
    check(`${mode}: every sign is dimmed while slot 1 is being filled`, muted() === 12, `${muted()} of 12`);
    key(tiles()[0]);
    check(`${mode}: signs return once slot 1 is down`, muted() === 0, `${muted()} of 12`);
    key('Escape');
    check(`${mode}: clearing back to empty dims them again`, muted() === 12, `${muted()} of 12`);
  }
  // Ladder must never dim: there the operator applies on every step.
  gotoMode('Ladder'); setLevel('normal');
  check('Ladder never dims its operators', muted() === 0, `${muted()} of 12`);
  key(tiles().find((l) => !store['board'].children.find((b2) => b2.dataset.letter === l).disabled) || tiles()[0]);
  check('Ladder still shows them mid-climb', muted() === 0, `${muted()} of 12`);
}

/* ---------------- feel: sound and motion ---------------- */
console.log('\n=== sound and motion ===');
{
  const A = await import('../js/audio.js');
  const fs = await import('node:fs');

  // Headless: no AudioContext exists, and a cue must never break a turn.
  let threw = false;
  try { A.cue.hit(); A.cue.miss(); A.cue.win(); A.cue.lose(); A.cue.warn(2); A.cue.lastChance(); A.cue.step(true); }
  catch { threw = true; }
  check('cues are safe no-ops without Web Audio', !threw, '');

  // Threshold cues must fire once per downward crossing, never per tick.
  check('a crossing fires once', JSON.stringify(A.crossedDown(0.35, 0.28, [0.5, 0.3, 0.1])) === '[0.3]');
  check('staying below fires nothing', A.crossedDown(0.28, 0.27, [0.5, 0.3, 0.1]).length === 0);
  check('rising past a threshold fires nothing', A.crossedDown(0.2, 0.6, [0.5, 0.3, 0.1]).length === 0);
  check('a large jump reports every threshold it passed', A.crossedDown(0.6, 0.05, [0.5, 0.3, 0.1]).length === 3);

  // The toggle
  const soundBtn = store['sound'];
  const wasOn = A.isOn();
  soundBtn.fire('click');
  check('sound toggle flips state and label', A.isOn() === !wasOn && /Muted|Sound/.test(soundBtn.textContent), soundBtn.textContent);
  check('sound toggle reports state to assistive tech', soundBtn.getAttribute('aria-pressed') === String(A.isOn()));
  check('sound preference persists', localStorage.getItem('triop.sound.v1') === (A.isOn() ? 'on' : 'off'));
  soundBtn.fire('click');

  // A hidden tab must not bill the player for time away.
  gotoMode('Sprint'); setLevel('normal');
  const L3 = tiles(), tm3 = boardMap();
  for (const a of L3) { key(a); break; }            // start the run
  key('Escape');
  const clockBefore = num(hud()[3]);
  doc.visibilityState = 'hidden';
  doc.fire('visibilitychange', {});
  globalThis.__triopAdvance(20000);                 // 20s of wall clock, tab hidden
  doc.visibilityState = 'visible';
  doc.fire('visibilitychange', {});
  check('a hidden tab does not drain the clock', num(hud()[3]) >= clockBefore - 1,
    `${clockBefore}s -> ${num(hud()[3])}s across 20s away`);

  // Reduced motion must substitute, not just delete.
  const css = fs.readFileSync(new URL('../style.css', import.meta.url), 'utf8');
  const rmBlock = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
  check('reduced motion does not blanket-disable every animation',
    !/\*,\s*\*::before[^}]*animation:\s*none/.test(rmBlock), '');
  check('the rejection cue survives reduced motion as an opacity fade',
    /\.slots\.shake\s*{[^}]*reject-fade/.test(css), '');
  check('rejection is never carried by motion alone',
    /\.slots\.shake \.slot\s*{[^}]*border-color/.test(css), '');
  check('the pulse is held at full strength rather than mid-fade',
    /pulse-hold/.test(css), '');
}

console.log(fails === 0 ? '\nALL CHECKS PASSED' : `\n${fails} CHECK(S) FAILED`);
process.exit(fails === 0 ? 0 : 1);

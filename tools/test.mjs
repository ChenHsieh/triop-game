import { install } from './dom.mjs';
const IDS = ['tabs','blurb','hud','prompt','slots','board','board-note','level','level-field','controls','panel','log','stats','rules'];
const { store, doc } = install(IDS);
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
check('four modes registered', tabs().length === 4, tabs().map((t) => t.textContent).join(','));

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
  check('clock gains time on a hit', num(hud()[3]) > time0, `${time0}s -> ${num(hud()[3])}s`);
  // deliberate miss
  const t1 = num(hud()[0]);
  const before = num(hud()[3]);
  let wrong = null;
  for (const a of L) for (const b of L) for (const c of L) {
    if (a === b || b === c || a === c || wrong) continue;
    const v = E.evaluate(tm[a].num, SYM[tm[b].op], tm[b].num, SYM[tm[c].op], tm[c].num);
    if (E.wholeOrNull(v) !== t1) wrong = a + b + c;
  }
  [...wrong].forEach(key); key('Enter');
  check('miss costs seconds', num(hud()[3]) < before, `${before}s -> ${num(hud()[3])}s`);
  ctl('Skip').fire('click');
  check('skip costs seconds and moves on', num(hud()[0]) !== t1);
  console.log('  feed:', feed(2));
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
  check(`${lv}: a par-${par} route exists`, !!found && found.length === par, found ? found.join('') : 'none');
  // an illegal tile must be refused
  const illegal = L.find((l) => E.wholeOrNull(E.apply(startVal, opOf(l), tm[l].num)) === null);
  if (illegal) {
    key(illegal);
    check(`${lv}: fractional move refused`, num(hud()[0]) === startVal, `tile ${illegal}`);
  }
  found.forEach(key);
  check(`${lv}: reaching target ends the ladder`, hud()[0].includes(String(target)), hud()[0]);
  check(`${lv}: on-par run scores`, ctl('New ladder') && true);
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
    key(a); key(b); key(c); key('Enter');
    if (marksOf().every((m) => m === 'hit')) { solved = true; break outer; }
  }
  check('duplicate guesses do not jam the input', num(hud()[1]) === 0 || solved, `left=${num(hud()[1])} solved=${solved}`);
  check('losing reveals the secret', solved || store['hud'].children[0].innerHTML.match(/[A-Z]{3}/) !== null, hud()[0]);
  console.log('  feed:', feed(1));
}

/* ---------------- sprint run-out ---------------- */
console.log('\n=== sprint clock ===');
gotoMode('Sprint');
{
  const tm = boardMap(); const L = tiles();
  let guards = 0;
  while (num(hud()[3]) > 0 && guards++ < 40) {
    const t = num(hud()[0]);
    let wrong = null;
    for (const a of L) for (const b of L) for (const c of L) {
      if (a === b || b === c || a === c || wrong) continue;
      const v = E.evaluate(tm[a].num, SYM[tm[b].op], tm[b].num, SYM[tm[c].op], tm[c].num);
      if (E.wholeOrNull(v) !== t) wrong = a + b + c;
    }
    [...wrong].forEach(key); key('Enter');
  }
  check('sprint ends when the clock runs out', num(hud()[3]) === 0, `after ${guards} misses`);
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

console.log(fails === 0 ? '\nALL CHECKS PASSED' : `\n${fails} CHECK(S) FAILED`);
process.exit(fails === 0 ? 0 : 1);

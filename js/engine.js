/* Pure arithmetic + puzzle generation. No DOM in this file. */

export const LETTERS = 'qwerasdfzxcv'.split('');
export const OPS = ['+', '-', '*', '/'];
export const SYMBOL = { '+': '+', '-': '−', '*': '×', '/': '÷' };
const EPS = 1e-9;

/*
 * Every draw in the game goes through random(). With a seed set, generation is
 * reproducible, which is what makes a daily board the same board for everyone.
 * mulberry32 — small, fast, good enough for puzzle boards.
 */
let seeded = null;

export function setSeed(seed) {
  let a = seed >>> 0;
  seeded = () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clearSeed = () => { seeded = null; };
export const random = () => (seeded || Math.random)();
export const pickFrom = (arr) => arr[Math.floor(random() * arr.length)];

export function apply(a, op, b) {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/': return b === 0 ? null : a / b;
    default: return null;
  }
}

export const prec = (op) => (op === '*' || op === '/' ? 2 : 1);

/** Evaluate `v1 op2 n2 op3 n3` under PEMDAS, without eval/Function. */
export function evaluate(v1, op2, n2, op3, n3) {
  if (prec(op3) > prec(op2)) {
    const right = apply(n2, op3, n3);
    return right === null ? null : apply(v1, op2, right);
  }
  const left = apply(v1, op2, n2);
  return left === null ? null : apply(left, op3, n3);
}

/** 1 / 3 * 3 lands on 1.0000000000000002; snap it or reject it. */
export function wholeOrNull(x) {
  if (x === null || !Number.isFinite(x)) return null;
  const r = Math.round(x);
  return Math.abs(x - r) < EPS ? r : null;
}

export function fmt(x) {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—';
  const whole = wholeOrNull(x);
  return whole !== null ? String(whole) : x.toFixed(2).replace(/0$/, '');
}

export const face = (tile) => SYMBOL[tile.op] + tile.num;

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const randInt = (lo, hi) => lo + Math.floor(random() * (hi - lo + 1));

/**
 * Three tiles per operator, no duplicate op+number pair, and no identity
 * operations (x1, /1) — those are dead tiles that make a board feel padded.
 */
export function makeTiles(letters = LETTERS) {
  const perOp = letters.length / OPS.length;
  const pool = shuffle(OPS.flatMap((op) => Array(Math.ceil(perOp)).fill(op))).slice(0, letters.length);
  const seen = new Set();
  const tiles = {};
  letters.forEach((letter, i) => {
    const op = pool[i];
    const lo = op === '*' || op === '/' ? 2 : 1;
    let num;
    do { num = randInt(lo, 9); } while (seen.has(op + num));
    seen.add(op + num);
    tiles[letter] = { op, num };
  });
  return tiles;
}

export function comboValue(tiles, combo) {
  const [a, b, c] = combo;
  const t1 = tiles[a], t2 = tiles[b], t3 = tiles[c];
  if (!t1 || !t2 || !t3) return null;
  return evaluate(t1.num, t2.op, t2.num, t3.op, t3.num);
}

/** Every 3-tile combo that lands on a whole number, grouped by that number. */
export function combosByValue(tiles, letters = LETTERS) {
  const byValue = new Map();
  for (const a of letters) {
    for (const b of letters) {
      if (b === a) continue;
      for (const c of letters) {
        if (c === a || c === b) continue;
        const value = wholeOrNull(comboValue(tiles, a + b + c));
        if (value === null) continue;
        if (!byValue.has(value)) byValue.set(value, []);
        byValue.get(value).push(a + b + c);
      }
    }
  }
  return byValue;
}

/**
 * Reroll boards until one offers a target inside the requested band. Picking a
 * target uniformly at random gives a degenerate puzzle most of the time —
 * either one lucky combo or two dozen of them.
 */
export function comboPuzzle({ min, max, maxAbs = 150, attempts = 200 }) {
  let fallback = null;
  for (let i = 0; i < attempts; i++) {
    const tiles = makeTiles();
    const byValue = combosByValue(tiles);
    const candidates = [];
    for (const [value, combos] of byValue) {
      if (Math.abs(value) > maxAbs) continue;
      if (combos.length >= min && combos.length <= max) candidates.push({ value, combos });
      if (!fallback || Math.abs(combos.length - min) < fallback.gap) {
        fallback = { tiles, target: value, solutions: combos, gap: Math.abs(combos.length - min) };
      }
    }
    if (candidates.length) {
      const pick = pickFrom(candidates);
      return { tiles, target: pick.value, solutions: pick.combos };
    }
  }
  return { tiles: fallback.tiles, target: fallback.target, solutions: fallback.solutions };
}

/**
 * Breadth-first walk of "apply one unused tile at a time to a running value",
 * keeping only whole-number intermediates. Returns value -> { par, path },
 * where par is the fewest tiles that reach it.
 */
export function ladderReach(tiles, start, maxDepth, letters = LETTERS) {
  const best = new Map();
  let frontier = [{ v: start, used: [] }];
  for (let depth = 1; depth <= maxDepth; depth++) {
    const next = [];
    for (const node of frontier) {
      for (const l of letters) {
        if (node.used.includes(l)) continue;
        const t = tiles[l];
        const r = wholeOrNull(apply(node.v, t.op, t.num));
        if (r === null || Math.abs(r) > 999) continue;
        const path = node.used.concat(l);
        next.push({ v: r, used: path });
        if (!best.has(r)) best.set(r, { par: depth, path });
      }
    }
    frontier = next;
    if (!frontier.length) break;
  }
  return best;
}

/** A ladder puzzle: a start value and a target that is exactly `par` tiles away. */
export function ladderPuzzle({ par, maxAbs = 120, attempts = 60 }) {
  for (let i = 0; i < attempts; i++) {
    const tiles = makeTiles();
    const start = randInt(2, 20);
    const reach = ladderReach(tiles, start, par);
    const candidates = [];
    for (const [value, info] of reach) {
      if (info.par !== par) continue;
      if (value === start || Math.abs(value) > maxAbs) continue;
      candidates.push({ value, path: info.path });
    }
    if (candidates.length) {
      const pick = pickFrom(candidates);
      return { tiles, start, target: pick.value, par, path: pick.path };
    }
  }
  // Should not happen in practice; fall back to a 2-step board.
  const tiles = makeTiles();
  const start = 10;
  const reach = ladderReach(tiles, start, 2);
  const [value, info] = [...reach].find(([v]) => v !== start);
  return { tiles, start, target: value, par: info.par, path: info.path };
}

/** A hidden 3-tile combo whose result is a whole number. */
export function deducePuzzle({ attempts = 80 }) {
  for (let i = 0; i < attempts; i++) {
    const tiles = makeTiles();
    const byValue = combosByValue(tiles);
    const pool = [];
    for (const [value, combos] of byValue) {
      if (Math.abs(value) > 150) continue;
      // Prefer values that several combos share, so the number alone never
      // hands over the answer.
      if (combos.length >= 2) pool.push(...combos.map((combo) => ({ combo, value })));
    }
    if (pool.length) {
      const pick = pickFrom(pool);
      return { tiles, secret: pick.combo, value: pick.value };
    }
  }
  const tiles = makeTiles();
  return { tiles, secret: 'qwe', value: wholeOrNull(comboValue(tiles, 'qwe')) };
}

# TriOp

🧠 Four arithmetic puzzle modes on one twelve-tile board. Vanilla HTML/CSS/JS, no build step.

Play: 👉 https://chenhsieh.github.io/triop-game/

## 🎛 The board

Twelve tiles labelled `Q W E R A S D F Z X C V` — the left-hand keyboard block, so your fingers already know the layout. Each tile carries an operator and a number: `+3`, `×2`, `÷4`, `−1`. Every board is generated with three tiles per operator, no duplicate op+number pair, and no identity tiles (`×1`, `÷1`).

Type or tap. <kbd>Backspace</kbd> undoes, <kbd>Esc</kbd> clears, <kbd>Enter</kbd> submits.

## 🎮 Modes

### Classic — hunt down the combos
Pick three different tiles. Tile 1 supplies the starting number (its operator is ignored, and the board strikes it out so you can see that); tiles 2 and 3 apply their operator under normal precedence, with the implied parentheses shown live. Clear the board by finding the required number of combos that land on the target — three on Easy and Normal, every last one on Hard. Misses cost points, so sweeping all 1320 combinations loses.

### Sprint — one solution per target, against the clock
The board never changes for the whole run, so you learn it as you go. Each target needs only **one** combo. A hit adds seconds and raises a chain multiplier; a miss costs seconds and resets it. <kbd>Space</kbd> skips a target for a bigger penalty. 90s / 60s / 45s by difficulty.

### Ladder — walk the running total
You start on a number and climb to the target one tile at a time, left to right — no precedence to track, and **the running total is always on screen**. Every step must stay a whole number, and tiles that would break that are greyed out, so every move you can see is a legal move. Each tile is usable once; undo is free. Par is the fewest tiles that reach the target, computed by breadth-first search when the puzzle is built.

### Deduce — narrow down a hidden combo
One three-tile combo is hidden. Guess, and get **green** (right tile, right slot), **amber** (right tile, wrong slot), grey (not in the combo) — plus your guess's value and whether the hidden combo's value is higher or lower. Tiles you have ruled out are crossed off the board automatically. 8 / 6 / 5 guesses by difficulty.

## 🎯 Difficulty

One switch, meaning something different per mode:

| Mode | Easy | Normal | Hard |
|---|---|---|---|
| Classic | find 3 of 7–16, 3 hints | find 3 of 3–6, 2 hints | find **all** of 1–3, 1 hint |
| Sprint | 90s, ≥16 combos per target | 70s, ≥8 | 55s, ≥5 |
| Ladder | par 3, move previews on | par 4 | par 5 |
| Deduce | 8 guesses | 6 guesses | 5 guesses |

Best score, plays, and clears are kept per mode in `localStorage`, along with a lifetime solved count.

### Is it actually calibrated?

Difficulty was measured, not guessed. A reference player model — examines combos in
random order, computes each one correctly, recognises a hit immediately — was run over
hundreds of generated boards per level. Effort is *combos examined*, out of 1320.

| Mode | Metric | Easy | Normal | Hard |
|---|---|---|---|---|
| Classic | combos examined to clear (median) | 338 | 771 | 898 |
| Sprint | combos examined per target (median) | 35 | 59 | 68 |
| Ladder | winning-route density at par | 1 in 233 | 1 in 678 | 1 in 4010 |
| Deduce | win rate of a solver that only guesses consistent combos | 100% | 96% | 83% |

Two levels were inverted before this pass and are worth recording:

- **Classic's Easy was the hardest setting.** Clearing meant finding *every* solution, and
  an easy target has ~11 of them against a hard target's ~2 — so Easy took a median 1249
  combos to clear versus Hard's 854. Easy and Normal now require three finds; Hard still
  requires all of them.
- **Deduce's Hard was a coin flip.** Hiding the value arrow dropped a perfect-information
  solver to a 50% win rate, which is noise, not difficulty. The arrow is back on at every
  level and the guess budget alone carries the difficulty.

Sprint's old Hard band (targets with as few as 2 solutions) had a p90 of 622 combos examined
inside a 45-second clock — unfinishable. Targets are now dense enough that the clock, not
the haystack, is the pressure.

## 🚀 Run locally

```bash
git clone https://github.com/ChenHsieh/triop-game.git
cd triop-game
python3 -m http.server
```

Open `http://localhost:8000`. A server is required — the code uses ES modules, which browsers refuse to load over `file://`.

## 🧩 Files

```
├── index.html            # Shell: tabs, HUD, stage, board, panel, feed
├── style.css             # Theme tokens, board, mode surfaces (dark + light, reduced-motion aware)
├── js/
│   ├── engine.js         # Arithmetic + puzzle generation. No DOM — importable and testable on its own.
│   ├── ui.js             # All DOM rendering. Modes describe; this draws.
│   ├── main.js           # Mode registry, shared clock, stats, keyboard routing
│   └── modes/
│       ├── classic.js
│       ├── sprint.js
│       ├── ladder.js
│       └── deduce.js
├── tools/
│   ├── dom.mjs           # Minimal DOM stub so the game runs headlessly under Node
│   ├── test.mjs          # Drives all four modes end to end
│   └── calibrate.mjs     # Difficulty measurement — reproduces the table above
└── README.md
```

Both harnesses are plain Node, no dependencies:

```bash
cd tools
node test.mjs        # behavioural checks — every mode played to completion
node calibrate.mjs   # difficulty measurement — takes a few minutes
```

A mode is an object with `start / pick / key / render` (plus optional `tick`) and some copy. Adding a fifth is a new file in `js/modes/` and one line in `main.js`.

## 🛠️ Design notes

- **Real evaluator, no `eval`.** `engine.js` walks precedence directly instead of building a string for `Function()`.
- **Float snapping.** `1 ÷ 3 × 3` computes to `1.0000000000000002`; results within `1e-9` of an integer are snapped, so valid solutions are not silently dropped.
- **Non-integer feedback.** A miss shows its actual value and how far off it is, rather than reporting "Invalid".
- **Curated targets.** Boards are rerolled until they can offer a target inside the difficulty band — a uniformly random target is degenerate most of the time.
- **The clock never steals focus.** The 250 ms ticker updates a single HUD cell in place instead of redrawing the controls.
- **Accessibility.** Tiles are real buttons with spoken labels and focus rings, the HUD and feed are `aria-live`, and animation respects `prefers-reduced-motion`.

## 🔭 Next steps

- Daily seeded board so scores are comparable
- Share card for a finished run
- Alternate tile layouts (triangle, honeycomb)
- A two-player pass-and-play race on one board

---
🧩 Made for mental fun and technical clarity.

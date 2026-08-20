# TriOp

🧠 Four arithmetic puzzle modes on one twelve-tile board, plus a daily puzzle everyone shares. Vanilla HTML/CSS/JS, no build step.

Play: 👉 https://chenhsieh.github.io/triop-game/

## 🎛 The board

Twelve tiles labelled `Q W E R A S D F Z X C V` — the left-hand keyboard block, so your fingers already know the layout. Each tile carries an operator and a number: `+3`, `×2`, `÷4`, `−1`. Every board is generated with three tiles per operator, no duplicate op+number pair, and no identity tiles (`×1`, `÷1`).

Type or tap. <kbd>Backspace</kbd> undoes, <kbd>Esc</kbd> clears, <kbd>Enter</kbd> submits.

## 📅 Daily

One board a day, the same for everyone, rolling over at your local midnight. The mode rotates — Ladder, Classic, Sprint, Deduce, repeat — so all four stay in circulation. Difficulty is locked to Normal so scores compare, and only your first attempt is recorded.

Solve it on consecutive days and you build a **streak**. An unplayed today does not break it — the day is not over. A day played and lost does. The streak shows in the app and in your stats; it is deliberately **not** on the copied card, because a second number there stops the card working as shareable currency. Finishing gives you a spoiler-free card to copy:

```
TriOp #12 · Deduce
⬛🟨⬛
🟨🟩⬛
🟩🟩🟩
3/6 · 420 pts
https://chenhsieh.github.io/triop-game/
```

The board is generated from a seeded PRNG keyed on the day and mode, so it is reproducible without a server — there is no backend, and nothing leaves your browser.

## 🎮 Modes

### Ladder — walk the running total
The gentlest way in, and the default. You start on a number and climb to the target one tile at a time, left to right — no precedence to track, and **the running total is always on screen**. Every step must stay a whole number, and tiles that would break that are greyed out, so every move you can see is a legal move. Each tile is usable once; undo is free.

Par is **one tile more than the shortest possible route**, so par is a good line and the shortest line beats it for a bonus. A par taken straight from the solver could never be beaten, which is the opposite of how par works in golf.

### Classic — hunt down the combos
Pick three different tiles. Tile 1 supplies the starting number (its operator is ignored, and the board strikes it out so you can see that); tiles 2 and 3 apply their operator under normal precedence, with the implied parentheses shown live. Clear the board by finding the required number of combos that land on the target. Easy gives you plenty of spares — around eleven solutions, and you need two. Hard gives you exactly three and wants all three. Misses cost points, so sweeping all 1320 combinations loses.

### Sprint — one solution per target, against the clock
The board never changes for the whole run, so you learn it as you go. Each target needs only **one** combo. Clearing one raises a chain multiplier; a miss costs points and resets it. <kbd>Space</kbd> skips a target for a bigger point penalty. 105s / 85s / 70s by difficulty.

**The run is a fixed length and nothing extends it.** That is a deliberate bound, not an oversight — see below. Targets are dealt from a shuffled bag, so you will not see the same one twice until the pool runs out.

### Deduce — narrow down a hidden combo
One three-tile combo is hidden. Guess, and get **✓ green** (right tile, right slot), **↔ amber** (right tile, wrong slot), **· grey** (not in the combo) — plus your guess's value and whether the hidden combo's value is higher or lower. Every cell carries a glyph and a spoken label as well as a colour, since green-versus-amber is exactly the case red-green colour blindness fails on. Tiles you have ruled out are crossed off the board automatically, and on Easy and Normal the status bar counts how many combos still fit every clue you have — so you can watch the space close instead of guessing blind. 8 / 6 / 5 guesses by difficulty.

## 🎯 Difficulty

One switch, meaning something different per mode:

| Mode | Easy | Normal | Hard |
|---|---|---|---|
| Ladder | par 3, move previews on | par 4 | par 5 |
| Classic | find 2 of 8–16, 3 hints | find 3 of 4–8, 2 hints | find **all 3 of exactly 3**, 1 hint |
| Sprint | 105s, ≥16 combos per target | 85s, ≥8 | 70s, ≥5 |
| Deduce | 8 guesses | 6 guesses | 5 guesses |

Best score, plays, and clears are kept per mode in `localStorage`, along with a lifetime solved count.

### Is it actually calibrated?

Difficulty was measured, not guessed. A reference player model — examines combos in
random order, computes each one correctly, recognises a hit immediately — was run over
hundreds of generated boards per level. Effort is *combos examined*, out of 1320.

Each mode's difficulty lives on a different axis, so each is judged on its own:

| Mode | Metric | Easy | Normal | Hard | Steps |
|---|---|---|---|---|---|
| Classic | combos examined to clear (median) | 196 | 651 | 1044 | 3.3× , 1.6× |
| Ladder | winning-route density at par | 1 in 204 | 1 in 768 | 1 in 3946 | 3.8× , 5.1× |
| Sprint | targets cleared per run (mean) | 8.9 | 4.3 | 2.9 | 2.1× , 1.5× |
| Deduce | win rate of a solver that only ever guesses consistent combos | 100% | 96% | 80% | −4, −15 pts |

**Monotone is not enough — the step size matters.** Three levels that measure 786 / 867 are
ordered correctly and still identical to play. The harness now fails any effort step under
1.25×, which is what caught Classic's Normal and Hard sitting tied inside the noise.

Three settings were wrong and are worth recording:

- **Classic's Easy was the hardest setting.** Clearing meant finding *every* solution, and
  an easy target has ~11 of them against a hard target's ~2 — so Easy took a median 1249
  combos to clear versus Hard's 854. The fix is that difficulty is *how many spares you
  get*: Easy has ~11 solutions and needs 2, Hard has exactly 3 and needs all 3.
- **Deduce's Hard was a coin flip.** Hiding the value arrow dropped a perfect-information
  solver to a 50% win rate, which is noise, not difficulty. The arrow is back on at every
  level and the guess budget alone carries the difficulty.
- **Sprint's old Hard was unfinishable.** Targets with as few as 2 solutions had a p90 of
  622 combos examined inside a 45-second clock. Targets are now dense enough that the
  clock, not the haystack, is the pressure.

The player model behind the effort numbers is deliberately crude — it examines combos in
random order rather than reasoning backwards from the target. Treat the numbers as a
*relative* ordering between levels, not a prediction of how long you personally will take.

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
│   ├── engine.js         # Arithmetic, seeded PRNG, puzzle generation. No DOM — importable and testable on its own.
│   ├── daily.js          # Day numbering, mode rotation, seeds, share text, clipboard
│   ├── ui.js             # All DOM rendering. Modes describe; this draws.
│   ├── main.js           # Mode registry, shared clock, stats, keyboard routing
│   └── modes/
│       ├── ladder.js
│       ├── classic.js
│       ├── sprint.js
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
node test.mjs        # behavioural checks — every mode played to completion, plus the
                     # regression that a flawless Sprint run still ends
node calibrate.mjs   # difficulty measurement — takes a few minutes
```

A mode is an object with `start / pick / key / render` (plus optional `tick`) and some copy. Adding a fifth is a new file in `js/modes/` and one line in `main.js`.

## 🧠 Design decisions worth defending

Three calls where two reasonable designs exist and the game picks one on purpose.

**Classic has a fixed price list; Sprint has a chain multiplier. Not both, in either.**
A solution in Classic is always +100 and a miss is always −20, so "is this guess worth
trying" is answerable at the moment you decide it. Classic used to *also* carry a chain
bonus, which makes the same guess worth wildly different amounts depending on when it
lands and quietly deletes that calculation. Sprint keeps its chain, because Sprint's
question is "can I keep the run going" rather than "what is this worth" — the chain is the
thing being played there, not noise over a price list.

**Targets come from a bag, not a uniform draw.** Drawing uniformly put a repeated target
in **88% of Easy runs**, averaging 1.63 repeats out of 9, with a 95th-percentile worst case
of meeting the same target three times in one run. Dealing from a shuffled bag has the same
long-run distribution and a far shorter tail — 2%. When randomness feels unfair, change the
distribution rather than the odds. Repeats were also what let a player memorise a board into
a never-ending run, so this is the same defect's second line of defence.

**Sprint's run length is fixed and nothing extends it.** Clearing a target used to award
seconds. The board does not change during a run, so a player memorises the targets, and a
remembered answer costs about 1.5 seconds to type against a +3 second award — an unbounded
positive loop. Simulated with a learning player, **29% of Easy runs never ended at all**,
with a 90th-percentile length of 52 minutes. Easy has only ~17 distinct qualifying targets,
so repeats arrive fast.

The first fix I tried — capping the clock at its starting value — **did not work, and the
measurement said so**: 28.7% of runs still ran away. Capping the *stock* of time does
nothing while the *flow* is positive; you simply return to the cap after every target. A
single-player positive loop has nothing pushing back on it, so it needs an engineered bound,
and a fixed run length is the one that cannot be farmed. Misses and skips now cost points
instead of seconds. There is a regression test that plays a flawless memorised run and
asserts it still ends.

**Par is beatable.** Ladder's par is the shortest route plus one. Deriving par straight
from an optimal solver means par *is* perfect play, so nobody ever beats it and the mode
has no ceiling to chase.

**Difficulty stays a menu.** An earlier plan was to pick the level automatically from
recorded performance. Rejected: a system that scales the numbers against a player
invisibly makes their model of the game false, and difficulty presets are the standard
place to put guidance settings — which is exactly how they are used here (move previews on
Easy Ladder, the candidate counter on Easy and Normal Deduce).

### Rejected, with the measurement

**Capping Sprint's clock instead of fixing its length.** Measured at 28.7% runaway runs
versus 29.3% uncapped — no effect. Kept in the notes because it is the obvious fix and it
is wrong.

**Greying out moves that strand you.** On a par-5 Ladder board, 52 of 100 random
continuations reach a state with no route to the target — so marking those moves before
they are taken looked like the single biggest improvement available. It is not affordable
and, done cheaply, it lies. An honest check costs 81 ms median and 137 ms p90 on a
server CPU, which is a visible hitch on a phone for something that runs on every render.
Shortening the search horizon makes it cheap and wrong: on a par-3 board a horizon of 4
flags 4.0 first moves as dead ends where a horizon of 5 flags 0.8 — it would grey out
moves that actually win. The existing post-move warning stays, and now promotes the Undo
button instead of scrolling past in the feed.

## 🛠️ Design notes

- **Real evaluator, no `eval`.** `engine.js` walks precedence directly instead of building a string for `Function()`.
- **Float snapping.** `1 ÷ 3 × 3` computes to `1.0000000000000002`; results within `1e-9` of an integer are snapped, so valid solutions are not silently dropped.
- **Non-integer feedback.** A miss shows its actual value and how far off it is, rather than reporting "Invalid".
- **Curated targets.** Boards are rerolled until they can offer a target inside the difficulty band — a uniformly random target is degenerate most of the time.
- **The clock never steals focus.** The 250 ms ticker updates a single HUD cell in place instead of redrawing the controls.
- **No dead readouts.** Deduce showed a Score that sat at 0 for the entire round; a number that does not move when the player decides something is noise on the screen. It now shows how many combos still fit the clues, which moves on every guess.
- **The share card carries one number.** Two numbers a reader cannot rank against each other stop a card working as shareable currency, so points stayed in the game and the card takes the outcome.
- **Accessibility.** Tiles are real buttons with spoken labels and focus rings, the HUD and feed are `aria-live`, and animation respects `prefers-reduced-motion`.

## 🔁 The three loops

Naming them is the check, and the rule is that the outer loop must vary the *conditions* of
the inner one rather than only its numbers.

| Loop | Length | What it is |
|---|---|---|
| Inner | seconds | Pick three tiles, read the result |
| Middle | 1–3 minutes | One board, or one fixed-length run |
| Outer | days | The daily, which **rotates the mode** — so tomorrow changes the verb, not the difficulty |

The outer loop had no memory until recently: the daily wrote a single result and overwrote
it the next day, so a streak was not merely missing, it was not computable. It now keeps a
bounded history and the v1 single-result store migrates into it on first read.

## 🔭 Next steps

- A guided first run for players who have never seen the board
- Replaying past dailies unranked, which the current one-attempt rule does not allow for
- Alternate tile layouts (triangle, honeycomb)
- A two-player pass-and-play race on one board

---
🧩 Made for mental fun and technical clarity.

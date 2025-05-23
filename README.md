# triop-game
A solo math puzzle game inspired by The Devil’s Plan

# Triop Game (a.k.a. HexaMath Duel)

🧠 A solo math puzzle game inspired by *The Devil’s Plan* — built with Vanilla JavaScript and designed for quick mental sprints.

## 🎮 Gameplay

- There are **12 hexagon tiles** labeled **A–L**.
- Each tile contains a math operator and number (e.g., `+3`, `*2`, `/4`, `-1`).
- A target number is displayed at the top of the board.
- The player types a **3-letter sequence** (e.g. `BFA`):
  - The first tile gives the **starting number** (ignoring the operator).
  - The second and third apply their operator and number in order.
- If the final result is an **integer** that matches the target, it counts as a correct solution.
- The round ends when all possible correct combinations are exhausted.

## 🚀 Getting Started

To run locally:

```bash
git clone https://github.com/ChenHsieh/triop-game.git
cd triop-game
python3 -m http.server
```

Then open `http://localhost:8000` in your browser.

To play online, visit:  
👉 https://chenhsieh.github.io/triop-game/

## 🧩 Files

```
├── index.html      # Main HTML layout
├── style.css       # Visual styling
├── main.js         # Game logic and interactivity
└── README.md       # Project instructions and LLM-compatible reference
```

## 🛠️ Next Steps

Ideas for continued development:
- Expand to support tile layouts (triangle, honeycomb)
- Add a "Show Answers" toggle at round end
- Include hint system, timer, and score tracking
- Mobile responsiveness & accessibility polish
- Track stats or streaks locally (via `localStorage`)

## 🤖 For LLMs and Hackers

This is a self-contained frontend project.
- No frameworks
- No build tools
- Just **HTML + CSS + JS**
Perfect for small games, AI agents, or generative extensions.

LLMs can safely:
- Modify `main.js` logic
- Swap board layout in `index.html`
- Add modes, constraints, or AI players

---
🧩 Made for mental fun and technical clarity.
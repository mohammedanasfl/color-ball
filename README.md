# Colour Sort — Ball Puzzle Game

A production-quality, browser-native ball sorting puzzle built with **pure HTML + CSS + Vanilla JS + Phaser 3**.  
No React · No TypeScript · No build tool — open `index.html` in a browser through a local or hosted web server.

## 🌐 Live Demo

Play the published version here:

**Render URL:** https://color-ball.onrender.com/

---

## 🎮 Game Rules

1. Tubes contain stacked coloured balls (LIFO structure).
2. **Only the top ball** can be moved at a time.
3. A ball can be moved to a destination tube if:
   - The destination is empty, **or**
   - The destination's top ball is the **same colour**.
   - The destination has at least one free slot.
4. Solved tubes (full, single colour) are locked.
5. The puzzle is won when every non-empty tube holds a single colour.

### Controls
| Action | How |
|---|---|
| Select a tube | Tap / click |
| Move selected ball | Tap / click destination tube |
| Deselect | Tap the selected tube again |
| Undo last move | Undo button (bottom-left) — costs 3 pts |
| Reset puzzle | Reset button (bottom-right) — costs 15 pts |

---

## 🏗️ Architecture Overview

```
phaser/
├── index.html               # HTML entry point (CDN Phaser 3.80.1)
├── style.css                # Responsive full-screen CSS
└── src/
    ├── constants.js         # All game config (colours, difficulty, layout, scoring)
    ├── audio.js             # Web Audio API synthesizer (zero external files)
    ├── logic/
    │   ├── MoveEngine.js    # Pure move validation & application (no side-effects)
    │   ├── PuzzleGenerator.js # Deterministic puzzle generation (key module)
    │   └── ScoreEngine.js   # Score tracking & computation
    ├── rendering/
    │   ├── AnimationEngine.js # 3-phase lift-travel-drop tween orchestrator
    │   └── TubeRenderer.js  # Phaser container rendering tubes & balls
    └── scenes/
        ├── BootScene.js     # Procedural ball texture generation
        ├── MenuScene.js     # Animated difficulty selection
        ├── GameScene.js     # Core game loop & state machine
        └── VictoryScene.js  # Score breakdown & celebration
```

### Script load order (index.html)
```
Phaser CDN → constants → audio → MoveEngine → PuzzleGenerator → ScoreEngine
           → AnimationEngine → TubeRenderer
           → BootScene → MenuScene → GameScene → VictoryScene → main
```

No ES modules are used (avoids CORS restrictions for `file://` hosting).  
All modules publish to `window.*` and are accessed as globals by later scripts.

---

## ⚙️ Where Phaser Is Used

Phaser powers the full in-game canvas experience, while HTML/CSS is used for the outer interface.

### Phaser responsibilities
- **Scene flow:** Boot, Menu, Game, and Victory scenes
- **Canvas rendering:** backgrounds, glass tubes, balls, glow effects, confetti
- **Input handling:** click / tap interaction on tubes and buttons inside the canvas
- **Tween animations:** lift, travel, drop, shake, pulse, fade, and celebration effects
- **Camera effects:** fade-in and fade-out transitions between scenes
- **Timing:** delayed calls, animation timing, and game-loop updates

### HTML/CSS responsibilities
- **Top HUD bar** for moves, timer, menu, undo, and reset
- **Menu overlay styling** with premium glassmorphism look
- **Responsive page layout** outside the game canvas

So the game logic and motion are handled by Phaser, while the polished app shell uses HTML and CSS.

---

## 🎞️ Animation System

Animation is handled mainly by **Phaser Tweens** through the animation layer.

### Ball movement animation
The main ball move uses a strict 3-step path:

1. **Lift** — the ball rises straight upward above every tube
2. **Travel** — it moves horizontally across the board at a fixed air height
3. **Drop** — it falls straight down into the destination tube with a bounce

This is implemented to make movement feel clear and realistic, while also preventing the ball from visually clipping through tube walls.

### Other animations used in the app
- **Tube shake** for invalid moves
- **Completion pulse** when a tube is fully solved
- **Confetti burst** on the result screen
- **Scene fades** when entering menu, game, or victory screens
- **Score count-up** animation on the result page
- **Menu / victory UI glow** for a more premium game feel

Main animation-related files:
- `src/rendering/AnimationEngine.js`
- `src/rendering/TubeRenderer.js`
- `src/scenes/BootScene.js`
- `src/scenes/VictoryScene.js`

---

## 🧩 Puzzle Generation Algorithm

### Core Invariants
```
colours  = n
capacity = n              (each tube holds n balls)
each colour appears exactly n times
total tubes = n + 1       (one dedicated empty tube)
total empty slots = n
```

| Difficulty | n | Tubes | Approach |
|---|---|---|---|
| Easy   | 4 | 5 | Backward generation, depth 20 + solvability check |
| Medium | 5 | 6 | Backward generation, depth 55 + solvability check |
| Hard   | 5 | 6 | Deterministic Latin-square construction |

---

### Easy / Medium — Backward (Reverse-Shuffle) Generation

```
1. Start from the SOLVED state
   tube[i] = [colour_i, colour_i, ..., colour_i]   (n balls each)
   tube[n] = [0, 0, ..., 0]                         (empty)

2. Repeat targetMoves times:
   a. Collect all valid forward moves (canMove check)
   b. Score each move by entropy gain (∆H across all tubes)
   c. Anti-oscillation filter: skip moves that undo the last move
   d. Randomly pick from top-3 scoring candidates
   e. Apply the chosen move

3. Output the shuffled state
```

**Solvability guarantee:** generated boards are validated with a real solvability search under the same move rules used by the player.  
**Randomness:** entropy-weighted selection + seeded Mulberry32 PRNG.

---

### Hard — Deterministic Latin-Square Construction

**No retry loops. All constraints enforced DURING generation.**

```
1. Build Cyclic Latin Square base
   ball[tube t][position p] = ((t + p) % n) + 1

   Properties (guaranteed by construction):
   ✓ Every tube contains all n distinct colours
   ✓ No two adjacent balls have the same colour
   ✓ Each colour appears exactly n times total

2. Apply seeded colour-relabelling permutation
   (reindex colours so pattern is non-obvious)

3. Apply seeded tube-reordering permutation
   (reorder tube positions randomly)

4. Apply n×4 constrained layer-swaps
   For each swap of ball[t1][layer] ↔ ball[t2][layer]:
   - Check: new value at t1[layer] ≠ t1[layer-1] AND ≠ t1[layer+1]
   - Check: new value at t2[layer] ≠ t2[layer-1] AND ≠ t2[layer+1]
   - Apply ONLY if both guards pass; otherwise SKIP (no retry)

5. Append empty tube

6. Safety assertion: hasConsecutiveSameColor() → must be false
   (Theoretically unreachable; fallback to pure Latin square if triggered)
```

**Why Latin-square is hard:** every tube holds all different colours → maximum disorder,  
few valid "chain" moves, forces deep multi-step planning from the first move.

**Diffculty score for hard mode (analytical):**
- Entropy norm ≈ 1.0 (all different colours per tube)
- Valid moves ≈ n (only to empty tube) → move blockage near 1.0
- Misplaced balls = 100% (no tube has a uniform colour)
- **Score ≈ 95 / 100**

---

## 📊 Complexity Analysis

| Operation | Time Complexity | Notes |
|---|---|---|
| `canMove(from, to, tubes, n)` | **O(n)** | Scans tube top; n ≤ 8 → effectively O(1) |
| `applyMove(from, to, tubes, n)` | **O(n)** | Two linear scans; returns new array |
| `isTubeDone(tube, n)` | **O(n)** | Linear scan + Set construction |
| `isBoardSolved(tubes, n)` | **O(n²)** | Calls isTubeDone for each of n+1 tubes |
| `getAllValidMoves(tubes, n)` | **O(n²)** | n² pair checks |
| `generate('easy'/'medium')` | **O(n² × depth)** | depth ≤ 35; n² per step |
| `generate('hard')` | **O(n²)** | Latin square + n×4 guarded swaps |
| `computeDifficultyScore` | **O(n²)** | Entropy over all tubes + move count |

Space: **O(n²)** for the tubes array. Undo stack: O(n² × undoCount).

---

## 🎨 Visual Design

- **Rendering:** Phaser 3 WebGL with Canvas fallback for broad browser support  
- **Scaling:** Phaser scale-fit layout for desktop and mobile screens  
- **Ball textures:** Procedural 3D spheres generated in the boot scene using the Canvas API  
- **Tubes:** Custom Phaser Graphics drawing for the glass-cylinder look  
- **Animations:** Tween-based motion, bounce landing, hover feedback, score reveals, and confetti  
- **Audio:** Web Audio API oscillator synthesis with zero external sound files  

---

## 🏆 Scoring

```
Base Score          60  (awarded on completion)
Efficiency Bonus  0–25  (move count vs estimated optimal)
Speed Bonus       0–10  (elapsed time vs difficulty threshold)
──────────────────────
Undo Penalty        –3  (per undo)
Reset Penalty      –15  (per reset)
──────────────────────
Total          0–100
```

**Optimal move estimate:**  
`lower_bound = Σ (distinct colours in tube − 1)` across all tubes.  
`estimate = lower_bound × 1.6`, clamped to [lower_bound, reverseMoveCount].

---


## 🚀 Running the Game

### Option 1 — Python (recommended)
```bash
cd "c:\Users\Mohamed Anas\Downloads\phaser"
python -m http.server 8080
# Open: http://localhost:8080
```

### Option 2 — Node.js (npx)
```bash
cd "c:\Users\Mohamed Anas\Downloads\phaser"
npx serve .
# Open the URL shown in terminal
```

### Option 3 — VS Code Live Server extension
Right-click `index.html` → **Open with Live Server**

> ⚠️ Do **not** open `index.html` directly via `file://` — browsers block  
> script loading across directories for security reasons.

---

## ☁️ Deployment on Render

This project is deployed as a **Node Web Service** on Render.

### Render configuration
- **Environment:** Node
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Root service file:** `server.js`

### Production URL
- https://color-ball.onrender.com/

The server reads `process.env.PORT`, so it works both locally and on Render without code changes.

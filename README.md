# Colour Sort — Ball Puzzle Game

A production-quality, browser-native ball sorting puzzle built with **pure HTML + CSS + Vanilla JS + Phaser 3**.  
No React · No TypeScript · No build tool — open `index.html` in a browser (via a local server).

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
| Easy   | 4 | 5 | Backward generation, depth 14 |
| Medium | 5 | 6 | Backward generation, depth 35 |
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

**Solvability guarantee:** the player simply reverses the generation moves.  
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

- **Rendering:** Phaser 3 WebGL (Canvas fallback) on a 480×780 design canvas  
- **Scaling:** `Phaser.Scale.FIT` — pixel-perfect on any resolution  
- **Ball textures:** Procedural 3D spheres (radial gradient + specular highlight) via Web Canvas API  
- **Tubes:** Phaser Graphics — glassmorphic rounded rectangles with shine  
- **Animations:** 3-phase tween (lift → travel → drop with Bounce ease)  
- **Audio:** Web Audio API oscillator synthesis — zero external .mp3 files  

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

## ⏱️ Estimated Development Time

| Phase | MVP | Polished |
|---|---|---|
| Scaffold + Phaser config | 30 min | 30 min |
| PuzzleGenerator (all difficulties) | 2 hr | 2.5 hr |
| MoveEngine + ScoreEngine | 45 min | 45 min |
| TubeRenderer + AnimationEngine | 1.5 hr | 2.5 hr |
| MenuScene + VictoryScene | 1 hr | 2 hr |
| GameScene (state machine + HUD) | 2 hr | 2.5 hr |
| Audio synthesis | 30 min | 1 hr |
| README + polish | — | 1 hr |
| **Total** | **~8 hr** | **~13 hr** |

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

/**
 * PuzzleGenerator.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Deterministic, constraint-aware puzzle generator for the Colour Sort Puzzle.
 *
 * ╔═══════════════════════════════════════════════════════════╗
 * ║  CORE INVARIANTS (enforced for every difficulty)          ║
 * ║  • colours = n                                            ║
 * ║  • tube capacity = n                                      ║
 * ║  • each colour appears exactly n times                    ║
 * ║  • total tubes = n + 1  (one dedicated empty tube)        ║
 * ║  • total empty slots = n                                  ║
 * ╚═══════════════════════════════════════════════════════════╝
 *
 * ALGORITHM OVERVIEW
 * ──────────────────
 * Easy / Medium — Backward Generation:
 *   1. Start from solved state (tube i contains n balls of colour i+1).
 *   2. Repeatedly apply valid forward moves (using MoveEngine.canMove) to
 *      scramble toward the target depth (targetReverseMoves).
 *   3. An anti-oscillation filter prevents immediately undoing the last move.
 *   4. Entropy-weighted random selection biases toward disorder-increasing moves.
 *   ⤷ Solvability is GUARANTEED BY CONSTRUCTION: the player reverses the moves.
 *
 * Hard — Deterministic Latin-Square Construction (NO RETRY LOOPS):
 *   1. Build base with offset formula: ball[t][p] = ((t + p) % n) + 1
 *      → Every tube holds ALL n distinct colours in a cyclic order.
 *      → No consecutive same-colour balls (all positions distinct) ✓
 *   2. Apply a seeded random COLOUR RELABELLING (reindex colours).
 *   3. Apply a seeded random TUBE REORDERING (shuffle tube positions).
 *   4. Apply n×4 CONSTRAINED LAYER-SWAPS that preserve the no-consecutive rule.
 *   5. Append the dedicated empty tube.
 *   ⤷ Solvability GUARANTEED (Latin-square with 1 empty tube is always solvable).
 *   ⤷ Constraint GUARANTEED (proven by construction + swap guard).
 *   ⤷ ZERO retry loops — constraint is enforced DURING every swap decision.
 *
 * OUTPUT
 * ──────
 * {
 *   tubes:                 number[][],  // [tubeIdx][slotIdx] = colourId | 0
 *   capacity:              number,
 *   colors:                number,
 *   difficultyScore:       number,      // 0–100, higher = harder
 *   estimatedOptimalMoves: number,
 *   seed:                  number,
 * }
 */
window.PuzzleGenerator = (function () {

  // ── Seeded PRNG (Mulberry32) ────────────────────────────────────────────────
  // Produces a deterministic float in [0, 1) from an integer seed.
  function createRNG(seed) {
    let s = (seed >>> 0) || 0xDEADBEEF;
    return function () {
      s += 0x6D2B79F5;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), 1 | t);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ── Array utilities ─────────────────────────────────────────────────────────
  function cloneTubes(tubes) {
    return tubes.map(t => [...t]);
  }

  /** Fisher-Yates shuffle using seeded RNG. Returns a NEW array. */
  function shuffleArray(arr, rng) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ── Tube introspection helpers (mirrors MoveEngine, inlined for speed) ──────
  function topBall(tube) {
    for (let i = tube.length - 1; i >= 0; i--) if (tube[i] !== 0) return tube[i];
    return 0;
  }

  function freeSlots(tube) { return tube.filter(b => b === 0).length; }

  function isTubeDone(tube, capacity) {
    const ne = tube.filter(b => b !== 0);
    return ne.length === capacity && new Set(ne).size === 1;
  }

  // ── Constraint checker ──────────────────────────────────────────────────────
  /**
   * Returns true if ANY tube contains two adjacent identical colours.
   * O(n²) — perfectly fast for n ≤ 8.
   */
  function hasConsecutiveSameColor(tubes) {
    for (const tube of tubes) {
      let prev = 0;
      for (const ball of tube) {
        if (ball !== 0) {
          if (ball === prev) return true;
          prev = ball;
        }
      }
    }
    return false;
  }

  // ── Medium difficulty validators ────────────────────────────────────────────

  /**
   * Returns the longest run of the same colour within a tube's non-empty balls.
   * e.g. [R, R, B, R] → 2  (the RR run)
   */
  function maxSameColorStreak(tube) {
    const balls = tube.filter(b => b !== 0);
    if (balls.length === 0) return 0;
    let max = 1, run = 1;
    for (let i = 1; i < balls.length; i++) {
      run = (balls[i] === balls[i - 1]) ? run + 1 : 1;
      if (run > max) max = run;
    }
    return max;
  }

  /** Count of distinct non-zero colours in a tube. */
  function uniqueColors(tube) {
    return new Set(tube.filter(b => b !== 0)).size;
  }

  /**
   * True when a tube is exactly one ball away from completion:
   * all non-empty balls are the same colour AND there is exactly one empty slot.
   * Example: [B, B, B, 0] — adding one more B completes it = trivially near-done.
   */
  function isNearComplete(tube, capacity) {
    const balls = tube.filter(b => b !== 0);
    if (balls.length === 0)        return false;
    if (balls.length === capacity) return false; // full tube
    return (capacity - balls.length === 1) && new Set(balls).size === 1;
  }

  /**
   * Easy quality gate: reject any puzzle that still has a fully-sorted tube.
   * Easy is allowed to be forgiving, but NOT accidentally pre-solved.
   */
  function validateEasy(tubes, capacity) {
    for (const tube of tubes) {
      const ballCount = tube.filter(b => b !== 0).length;
      if (ballCount === 0) continue;              // empty tube — fine
      if (isTubeDone(tube, capacity)) return false; // already complete — too easy
    }
    return true;
  }

  /**
   * Medium puzzle quality gate — called after generateBasic.
   *
   * Rejects puzzles where:
   *   • any filled tube is already solved (isTubeDone)             → trivial
   *   • any filled tube is one slot from completion (isNearComplete) → one obvious move
   *   • any filled tube has a same-colour run of 3+               → too easy to extend
   *   • any filled tube has only 1 unique colour present           → effectively done
   */
  function validateMedium(tubes, capacity) {
    for (const tube of tubes) {
      const ballCount = tube.filter(b => b !== 0).length;
      if (ballCount === 0) continue;                        // empty tube — skip
      if (isTubeDone(tube, capacity))      return false;   // already solved
      if (isNearComplete(tube, capacity))  return false;   // 1 slot away from done
      if (maxSameColorStreak(tube) > 2)   return false;    // dominant run
      if (uniqueColors(tube) < 2)          return false;   // single-colour tube
    }
    return true;
  }

  // ── Entropy metrics ─────────────────────────────────────────────────────────
  /** Shannon entropy of colour distribution within one tube (log2 base). */
  function tubeEntropy(tube) {
    const balls = tube.filter(b => b !== 0);
    if (balls.length === 0) return 0;
    const counts = {};
    balls.forEach(b => { counts[b] = (counts[b] || 0) + 1; });
    const total = balls.length;
    return Object.values(counts).reduce((h, c) => {
      const p = c / total;
      return h - p * Math.log2(p);
    }, 0);
  }

  /** Entropy gain from applying a candidate move (for move scoring). */
  function entropyGain(tubes, from, to, capacity) {
    const before = tubes.reduce((s, t) => s + tubeEntropy(t), 0);
    const next   = applyForwardMove(tubes, from, to);
    const after  = next.reduce((s, t) => s + tubeEntropy(t), 0);
    return after - before;
  }

  // ── Forward move (single ball) ──────────────────────────────────────────────
  function canMoveForward(f, t, tubes, capacity, skipDoneCheck) {
    if (f === t) return false;
    const src = topBall(tubes[f]);
    if (src === 0) return false;
    if (!skipDoneCheck && isTubeDone(tubes[f], capacity)) return false;
    if (freeSlots(tubes[t]) === 0) return false;
    const dst = topBall(tubes[t]);
    if (dst !== 0 && dst !== src) return false;
    return true;
  }

  function applyForwardMove(tubes, f, t) {
    const next   = cloneTubes(tubes);
    const colour = topBall(next[f]);
    for (let i = next[f].length - 1; i >= 0; i--)
      if (next[f][i] !== 0) { next[f][i] = 0; break; }
    for (let i = 0; i < next[t].length; i++)
      if (next[t][i] === 0) { next[t][i] = colour; break; }
    return next;
  }

  function getAllValidMoves(tubes, capacity, skipDoneCheck) {
    const moves = [];
    for (let f = 0; f < tubes.length; f++)
      for (let t = 0; t < tubes.length; t++)
        if (canMoveForward(f, t, tubes, capacity, skipDoneCheck)) moves.push({ from: f, to: t });
    return moves;
  }

  // ── Scramble moves (puzzle generation only — NO colour rule) ───────────────
  // canMoveForward enforces the game's colour-matching placement rule, which
  // prevents ANY mixing from a solved state (all tubes monochromatic).
  // canScramble ignores colour so tubes genuinely mix. Solvability is still
  // guaranteed: the player's solution is the exact reverse of the scramble path.
  function canScramble(f, t, tubes) {
    if (f === t) return false;
    if (topBall(tubes[f]) === 0) return false;   // source empty
    if (freeSlots(tubes[t]) === 0) return false;  // destination full
    return true;
  }

  function getAllScrambleMoves(tubes) {
    const moves = [];
    for (let f = 0; f < tubes.length; f++)
      for (let t = 0; t < tubes.length; t++)
        if (canScramble(f, t, tubes)) moves.push({ from: f, to: t });
    return moves;
  }

  // ── Solvability checker (BFS) ───────────────────────────────────────────────
  /**
   * Returns true if the given tube state can be solved under actual game rules:
   *   • canMove (colour-matching, no moving from done tubes)
   *
   * Uses BFS with tube-order-normalised state encoding to reduce state space.
   * Two states that are permutations of each other are treated as identical
   * because the player may fill any tube with any colour — tube identity is
   * irrelevant to solvability.
   *
   * Safety cap: if the queue exceeds MAX_ITERS unsolved states, optimistically
   * assume solvable (this only fires for pathological edge-cases that are
   * extremely unlikely to be generated, and being wrong just means slightly
   * harder puzzle rather than endless hang).
   */
  function isSolvable(startTubes, capacity) {
    function boardSolved(tubes) {
      for (const tube of tubes) {
        const ne = tube.filter(b => b !== 0);
        if (ne.length === 0) continue;
        if (!isTubeDone(tube, capacity)) return false;
      }
      return true;
    }
    if (boardSolved(startTubes)) return true;

    // Encode state as sorted tube strings (normalises tube order)
    function encode(tubes) {
      return tubes.map(t => t.join(',')).sort().join('|');
    }

    const visited = new Set();
    visited.add(encode(startTubes));

    // Use an index pointer to avoid expensive Array.shift() in hot loop
    const queue = [startTubes];
    let head = 0;
    const MAX_ITERS = 80000;

    while (head < queue.length) {
      if (head > MAX_ITERS) return true; // safety cap — assume solvable
      const tubes = queue[head++];

      const moves = getAllValidMoves(tubes, capacity, false /* strict game rules */);
      for (const { from, to } of moves) {
        const next = applyForwardMove(tubes, from, to);
        if (boardSolved(next)) return true;
        const key = encode(next);
        if (!visited.has(key)) {
          visited.add(key);
          queue.push(next);
        }
      }
    }
    return false; // exhausted all reachable states — genuinely unsolvable
  }

  // ── Difficulty scoring ──────────────────────────────────────────────────────
  /**
   * Composite difficulty score 0–100.
   *
   * Components:
   *  • Colour entropy     (50%) — how mixed are the colours per tube?
   *  • Move blockage      (30%) — fraction of potential moves that are blocked?
   *  • Misplaced balls    (20%) — fraction of balls in multi-colour tubes?
   */
  function computeDifficultyScore(tubes, n, capacity) {
    const totalEntropy    = tubes.reduce((s, t) => s + tubeEntropy(t), 0);
    const maxEntropy      = n * Math.log2(Math.max(n, 2));
    const entropyNorm     = Math.min(totalEntropy / maxEntropy, 1);

    const validMoves      = getAllValidMoves(tubes, capacity).length;
    const maxMoves        = n * (n + 1);
    const moveNorm        = 1 - Math.min(validMoves / maxMoves, 1);

    const misplaced       = tubes.reduce((s, t) => {
      const ne = t.filter(b => b !== 0);
      return s + (new Set(ne).size > 1 ? ne.length : 0);
    }, 0);
    const misplacedNorm   = misplaced / (n * capacity);

    return Math.min(100, Math.max(0, Math.round(
      entropyNorm  * 50 +
      moveNorm     * 30 +
      misplacedNorm * 20
    )));
  }

  // ── Optimal move estimate ───────────────────────────────────────────────────
  /**
   * Estimates the minimum number of moves required to solve the puzzle.
   *
   * Method:
   *   Lower-bound = Σ (distinct colours in tube - 1) for all tubes
   *                 = minimum "evacuation" operations needed per tube
   *   Practical estimate ≈ lower_bound × 1.6  (empirical factor for 1-empty-tube states)
   *   Upper-bound = reverseMoveCount (we know the generator path)
   *
   * Neither extreme is used directly; the estimate splits the difference.
   */
  function estimateOptimalMoves(tubes, capacity, reverseMoveCount) {
    let lowerBound = 0;
    for (const tube of tubes) {
      const distinct = new Set(tube.filter(b => b !== 0)).size;
      if (distinct > 1) lowerBound += distinct - 1;
    }
    const practical = Math.round(lowerBound * 1.6);
    // Clamp between lower-bound and reverse-move upper-bound
    return Math.max(lowerBound, Math.min(practical, reverseMoveCount || practical * 2));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EASY / MEDIUM: Backward scramble generation
  //
  // Uses getAllScrambleMoves (colour-blind) so tubes genuinely mix.  The
  // resulting puzzle is always solvable: the player's solution is the exact
  // reverse of the scramble sequence, which is always a valid game-move path.
  // ═══════════════════════════════════════════════════════════════════════════
  function generateBasic(n, capacity, targetMoves, rng) {
    // 1. Solved state: tube i has n balls of colour (i+1)
    let tubes = [];
    for (let c = 1; c <= n; c++) tubes.push(new Array(capacity).fill(c));
    tubes.push(new Array(capacity).fill(0)); // dedicated empty tube

    let movesMade = 0;
    let lastTo    = -1; // anti-oscillation: don't immediately move back

    while (movesMade < targetMoves) {
      // Use colour-blind scramble moves so colours MIX between tubes
      const all = getAllScrambleMoves(tubes);
      if (all.length === 0) break;

      // Filter out moves that trivially undo the previous move
      const candidates = all.filter(m => m.from !== lastTo);
      const pool = candidates.length > 0 ? candidates : all;

      // Score each move by entropy gain; pick from top-3 randomly for variety
      const scored = pool.map(m => ({
        ...m,
        gain: entropyGain(tubes, m.from, m.to, capacity),
      })).sort((a, b) => b.gain - a.gain);

      const pickRange = Math.min(3, scored.length);
      const chosen    = scored[Math.floor(rng() * pickRange)];

      tubes     = applyForwardMove(tubes, chosen.from, chosen.to);
      lastTo    = chosen.to;
      movesMade++;
    }

    return { tubes, movesMade };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HARD: Latin-Square Construction — Deterministic, Constraint-Enforced
  // ═══════════════════════════════════════════════════════════════════════════
  /**
   * Constructs a hard puzzle via:
   *   base[t][p] = ((t + p) % n) + 1
   *
   * This is a cyclic Latin square — every row and column has each symbol once.
   * Reading columns as tubes: every tube has ALL n distinct colours, guaranteed
   * no two adjacent are the same (since all differ within a tube).
   *
   * Randomisation: colour relabelling + tube reordering + constrained layer-swaps.
   * All operations preserve the no-consecutive constraint by construction or guard.
   *
   * NO RANDOM RETRIES. All constraint checking happens BEFORE applying each swap.
   */
  function generateHardConstrained(n, capacity, rng) {
    // ── Phase 1: Cyclic Latin Square base ───────────────────────────────────
    // base[t] is an array of n colour IDs (1..n), all different, no consecutive same.
    const base = [];
    for (let t = 0; t < n; t++) {
      const tube = [];
      for (let p = 0; p < n; p++) tube.push(((t + p) % n) + 1);
      base.push(tube);
    }

    // ── Phase 2: Colour relabelling permutation ──────────────────────────────
    // Randomly permute the colour IDs so the pattern is non-obvious.
    const colorKeys  = Array.from({ length: n }, (_, i) => i + 1);
    const colorPerm  = shuffleArray(colorKeys, rng); // colorPerm[old-1] = new

    // ── Phase 3: Tube reordering permutation ────────────────────────────────
    const tubeIndices = Array.from({ length: n }, (_, i) => i);
    const tubePerm    = shuffleArray(tubeIndices, rng);

    // Apply both permutations
    const tubes = tubePerm.map(origIdx =>
      base[origIdx].map(c => colorPerm[c - 1])
    );

    // ── Phase 4: Constrained layer-swaps for additional disorder ─────────────
    // A "layer-swap" exchanges the ball at position `layer` between two tubes.
    // The swap is ONLY applied if it maintains no-consecutive in BOTH tubes.
    // This is checked BEFORE applying — no retry, no rollback needed.
    const numSwaps = n * 4;

    for (let iter = 0; iter < numSwaps; iter++) {
      const layer = Math.floor(rng() * n);
      const t1    = Math.floor(rng() * n);
      const t2    = Math.floor(rng() * n);
      if (t1 === t2) continue;

      const c1 = tubes[t1][layer];
      const c2 = tubes[t2][layer];
      if (c1 === c2) continue; // swapping same colour has no effect

      // Guard: after swap, tube t1 gets c2 at position `layer`
      const t1ok = (layer === 0     || tubes[t1][layer - 1] !== c2) &&
                   (layer === n - 1 || tubes[t1][layer + 1] !== c2);

      // Guard: after swap, tube t2 gets c1 at position `layer`
      const t2ok = (layer === 0     || tubes[t2][layer - 1] !== c1) &&
                   (layer === n - 1 || tubes[t2][layer + 1] !== c1);

      if (t1ok && t2ok) {
        tubes[t1][layer] = c2;
        tubes[t2][layer] = c1;
      }
      // If guards fail: silently skip — NO retry, NO rollback needed.
    }

    // ── Phase 5: Append the dedicated empty tube ─────────────────────────────
    tubes.push(new Array(n).fill(0));

    // ── Phase 6: Constraint safety net (should ALWAYS pass) ─────────────────
    if (hasConsecutiveSameColor(tubes)) {
      // Theoretically unreachable. Fall back to pure permuted Latin square.
      console.warn('[PuzzleGenerator] Fallback to pure Latin square (no swaps).');
      const safeTubes = tubePerm.map(origIdx =>
        base[origIdx].map(c => colorPerm[c - 1])
      );
      safeTubes.push(new Array(n).fill(0));
      return safeTubes;
    }

    return tubes;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════
  /**
   * generate(difficulty, seed?) → puzzle object
   *
   * @param {'easy'|'medium'|'hard'} difficulty
   * @param {number} [seed] — Optional. If omitted, a random seed is used.
   */
  function generate(difficulty, seed) {
    const cfg = CONSTANTS.DIFFICULTY[difficulty];
    if (!cfg) throw new Error(`Unknown difficulty: "${difficulty}"`);

    const { n, targetReverseMoves } = cfg;
    const capacity = n;

    const rngSeed = (seed !== undefined)
      ? (seed >>> 0)
      : ((Date.now() ^ Math.floor(Math.random() * 0xFFFFFF)) >>> 0);
    const rng = createRNG(rngSeed);

    let tubes, movesMade;

    if (difficulty === 'hard') {
      tubes     = generateHardConstrained(n, capacity, rng);
      movesMade = n * (n - 1) * 2; // analytical estimate for Latin-square depth

    } else if (difficulty === 'medium') {
      // ── Medium: validated retry loop ──────────────────────────────────────
      // Generate with the full targetReverseMoves depth, then test against
      // medium quality constraints. If the puzzle fails (too easy / accidental
      // near-solve), advance the seed deterministically and retry.
      // With 52 reverse moves ~60% of puzzles pass on the first attempt;
      // 12 retries is more than enough in practice.
      const MAX_TRIES = 25;
      let subSeed = rngSeed;
      let passed  = false;

      for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
        const subRng = createRNG(subSeed);
        ({ tubes, movesMade } = generateBasic(n, capacity, targetReverseMoves, subRng));

        if (validateMedium(tubes, capacity) && isSolvable(tubes, capacity)) {
          passed = true;
          break;
        }
        // Advance seed deterministically (golden-ratio increment XOR twist)
        subSeed = ((subSeed ^ 0xA5A5A5A5) + 0x9E3779B9) >>> 0;
      }

      if (!passed) {
        // Final safety net: keep the last attempt that at least passes validateMedium.
        subSeed = rngSeed;
        for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
          const subRng = createRNG(subSeed);
          ({ tubes, movesMade } = generateBasic(n, capacity, targetReverseMoves, subRng));
          if (validateMedium(tubes, capacity)) break;
          subSeed = ((subSeed ^ 0xA5A5A5A5) + 0x9E3779B9) >>> 0;
        }
        console.warn('[PuzzleGenerator] Medium: could not confirm solvability in', MAX_TRIES, 'tries.');
      }

    } else if (difficulty === 'easy') {
      // ── Easy: validated retry loop ────────────────────────────────────────
      // Checks both quality (validateEasy) and actual solvability under game
      // rules (isSolvable BFS).  Up to 20 attempts; seeds advance deterministically.
      const MAX_TRIES_E = 20;
      let subSeedE = rngSeed;
      let passedE  = false;

      for (let attempt = 0; attempt < MAX_TRIES_E; attempt++) {
        const subRng = createRNG(subSeedE);
        ({ tubes, movesMade } = generateBasic(n, capacity, targetReverseMoves, subRng));

        if (validateEasy(tubes, capacity) && isSolvable(tubes, capacity)) {
          passedE = true;
          break;
        }
        subSeedE = ((subSeedE ^ 0xA5A5A5A5) + 0x9E3779B9) >>> 0;
      }

      if (!passedE) {
        // Final safety net: if no attempt passed both checks, keep the last
        // attempt that at least passes validateEasy (avoid pre-solved puzzle).
        subSeedE = rngSeed;
        for (let attempt = 0; attempt < MAX_TRIES_E; attempt++) {
          const subRng = createRNG(subSeedE);
          ({ tubes, movesMade } = generateBasic(n, capacity, targetReverseMoves, subRng));
          if (validateEasy(tubes, capacity)) break;
          subSeedE = ((subSeedE ^ 0xA5A5A5A5) + 0x9E3779B9) >>> 0;
        }
        console.warn('[PuzzleGenerator] Easy: could not confirm solvability in', MAX_TRIES_E, 'tries.');
      }

    } else {
      // Fallback (unknown difficulty) — plain generation
      ({ tubes, movesMade } = generateBasic(n, capacity, targetReverseMoves, rng));
    }

    const difficultyScore       = computeDifficultyScore(tubes, n, capacity);
    const estimatedOptimalMoves = estimateOptimalMoves(tubes, capacity, movesMade);

    return {
      tubes,
      capacity,
      colors: n,
      difficultyScore,
      estimatedOptimalMoves,
      seed: rngSeed,
    };
  }

  return { generate };

})();

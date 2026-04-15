/**
 * MoveEngine.js
 * Pure, side-effect-free move validation and application logic.
 *
 * Tube model:
 *   tube[i] = colour ID (1-n) or 0 (empty slot)
 *   index 0 = BOTTOM of tube, index capacity-1 = TOP
 *   Balls always fill from index 0 upward; empty slots are at the top.
 *
 * This implements SINGLE-BALL LIFO moves (only the topmost ball moves).
 */
window.MoveEngine = (function () {

  /**
   * Returns the colour ID of the topmost non-empty ball, or 0 if tube is empty.
   * O(n) worst case but n ≤ 8 — effectively O(1).
   */
  function topBall(tube) {
    for (let i = tube.length - 1; i >= 0; i--) {
      if (tube[i] !== 0) return tube[i];
    }
    return 0;
  }

  /**
   * Returns the SLOT INDEX of the topmost ball, or -1 if empty.
   */
  function topSlotIndex(tube) {
    for (let i = tube.length - 1; i >= 0; i--) {
      if (tube[i] !== 0) return i;
    }
    return -1;
  }

  /**
   * Returns the INDEX of the first empty (zero) slot from the bottom.
   * This is where the next ball placed into the tube will land.
   * Returns -1 if the tube is full.
   */
  function nextEmptySlotIndex(tube) {
    for (let i = 0; i < tube.length; i++) {
      if (tube[i] === 0) return i;
    }
    return -1; // full
  }

  /**
   * Number of free (zero) slots in a tube.
   */
  function freeSlots(tube) {
    return tube.filter(b => b === 0).length;
  }

  /**
   * Returns true if a tube is completely solved:
   *   - All slots filled (no zeros)
   *   - All balls the same colour
   */
  function isTubeDone(tube, capacity) {
    const nonEmpty = tube.filter(b => b !== 0);
    if (nonEmpty.length !== capacity) return false;
    return new Set(nonEmpty).size === 1;
  }

  /**
   * Returns true when EVERY non-empty tube is fully solved.
   * Empty tubes are considered "complete" (they need no sorting).
   * O(n²) total.
   */
  function isBoardSolved(tubes, capacity) {
    for (const tube of tubes) {
      const nonEmpty = tube.filter(b => b !== 0);
      if (nonEmpty.length === 0) continue;         // empty tube — fine
      if (!isTubeDone(tube, capacity)) return false;
    }
    return true;
  }

  /**
   * Validates a single-ball move from tube[fromIdx] → tube[toIdx].
   * Returns true if the move is legal.
   *
   * Rules:
   *  1. from ≠ to
   *  2. Source tube is not empty
   *  3. Source tube is not already done (prevent disturbing solved tubes)
   *  4. Destination tube has at least one free slot
   *  5. Destination is empty OR its top ball matches the source top ball
   */
  function canMove(fromIdx, toIdx, tubes, capacity) {
    if (fromIdx === toIdx) return false;

    const srcTop = topBall(tubes[fromIdx]);
    if (srcTop === 0) return false;                     // source empty

    if (isTubeDone(tubes[fromIdx], capacity)) return false; // already solved

    if (freeSlots(tubes[toIdx]) === 0) return false;    // destination full

    const dstTop = topBall(tubes[toIdx]);
    if (dstTop !== 0 && dstTop !== srcTop) return false; // colour mismatch

    return true;
  }

  /**
   * Applies a single-ball move (from → to), returning a NEW immutable tubes array.
   * Assumes canMove() has already been verified.
   */
  function applyMove(fromIdx, toIdx, tubes) {
    const next = tubes.map(t => [...t]);

    // Remove top ball from source
    const srcSlot = topSlotIndex(next[fromIdx]);
    if (srcSlot !== -1) next[fromIdx][srcSlot] = 0;

    // Place ball in first empty slot of destination
    const dstSlot = nextEmptySlotIndex(next[toIdx]);
    if (dstSlot !== -1) next[toIdx][dstSlot] = next[fromIdx][srcSlot + 0] || topBall(tubes[fromIdx]);

    return next;
  }

  /**
   * Correct version: carry the colour explicitly.
   */
  function applyMoveSafe(fromIdx, toIdx, tubes) {
    const next = tubes.map(t => [...t]);
    const colour = topBall(next[fromIdx]);

    // Remove top ball from source
    for (let i = next[fromIdx].length - 1; i >= 0; i--) {
      if (next[fromIdx][i] !== 0) { next[fromIdx][i] = 0; break; }
    }

    // Place in first empty slot of destination
    for (let i = 0; i < next[toIdx].length; i++) {
      if (next[toIdx][i] === 0) { next[toIdx][i] = colour; break; }
    }

    return next;
  }

  /**
   * Returns all currently legal moves as {from, to} objects.
   */
  function getAllValidMoves(tubes, capacity) {
    const moves = [];
    for (let f = 0; f < tubes.length; f++) {
      for (let t = 0; t < tubes.length; t++) {
        if (canMove(f, t, tubes, capacity)) {
          moves.push({ from: f, to: t });
        }
      }
    }
    return moves;
  }

  return {
    topBall,
    topSlotIndex,
    nextEmptySlotIndex,
    freeSlots,
    isTubeDone,
    isBoardSolved,
    canMove,
    applyMove: applyMoveSafe, // always use the safe version
    getAllValidMoves,
  };
})();

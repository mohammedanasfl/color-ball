/**
 * ScoreEngine.js
 * Tracks game events and computes the final score (capped at 100).
 *
 * Score breakdown:
 *   Base          60   — awarded on puzzle completion
 *   Efficiency  0–25   — based on move count vs estimated optimal
 *   Speed       0–10   — based on elapsed time vs difficulty threshold
 *   Undo penalty   –3  — per undo action
 *   Reset penalty –15  — per reset action
 */
window.ScoreEngine = (function () {

  class ScoreTracker {
    constructor(estimatedOptimalMoves, difficulty) {
      this.optimal    = estimatedOptimalMoves || 1;
      this.difficulty = difficulty;
      this.cfg        = CONSTANTS.SCORE;
      this.difCfg     = CONSTANTS.DIFFICULTY[difficulty];

      // Mutable state
      this.moveCount   = 0;
      this.undoCount   = 0;
      this.resetCount  = 0;
      this.startTime   = Date.now();
    }

    // ── Event recording ───────────────────────────────────────────────────────
    recordMove()  { this.moveCount++; }
    recordUndo()  { this.undoCount++;  this.moveCount = Math.max(0, this.moveCount - 1); }
    recordReset() { this.resetCount++; }

    /** Elapsed time in seconds since the tracker was created. */
    elapsedSeconds() { return (Date.now() - this.startTime) / 1000; }

    // ── Live estimates (shown in HUD) ─────────────────────────────────────────
    /** Rough score estimate during play (not final, no speed bonus yet). */
    liveScore() {
      const efficiencyBonus = this._efficiencyBonus();
      const penalty         = this._totalPenalty();
      return Math.max(0, this.cfg.base + efficiencyBonus - penalty);
    }

    // ── Final score on win ────────────────────────────────────────────────────
    computeFinalScore() {
      const base      = this.cfg.base;
      const efficiency = this._efficiencyBonus();
      const speed     = this._speedBonus();
      const penalty   = this._totalPenalty();
      const total     = Math.max(0, Math.min(100, base + efficiency + speed - penalty));

      return {
        base,
        efficiency,
        speed,
        penalty,
        total,
        moveCount:   this.moveCount,
        undoCount:   this.undoCount,
        resetCount:  this.resetCount,
        elapsedSec:  Math.round(this.elapsedSeconds()),
      };
    }

    // ── Private helpers ───────────────────────────────────────────────────────
    _efficiencyBonus() {
      if (this.optimal <= 0) return 0;
      const ratio = this.optimal / Math.max(this.moveCount, this.optimal);
      return Math.round(this.cfg.maxEfficiency * Math.max(0, ratio));
    }

    _speedBonus() {
      const elapsed    = this.elapsedSeconds();
      const threshold  = this.difCfg.speedThreshold;
      const ratio      = Math.max(0, 1 - elapsed / threshold);
      return Math.round(this.cfg.maxSpeed * ratio);
    }

    _totalPenalty() {
      return (this.undoCount  * this.cfg.undoPenalty) +
             (this.resetCount * this.cfg.resetPenalty);
    }
  }

  /** Factory: creates a fresh ScoreTracker for a new game. */
  function create(estimatedOptimalMoves, difficulty) {
    return new ScoreTracker(estimatedOptimalMoves, difficulty);
  }

  return { create };

})();

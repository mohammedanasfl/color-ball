/**
 * constants.js
 * Central configuration for the Colour Sort Puzzle game.
 * All magic numbers live here — nothing is hardcoded in scenes.
 */
window.CONSTANTS = (function () {

  // ── Canvas / Scene ────────────────────────────────────────────────────────
  const GAME_WIDTH  = 900;
  const GAME_HEIGHT = 640;

  // ── Ball colour palette ───────────────────────────────────────────────────
  // hex values are Phaser-style 0xRRGGBB integers; rgb is CSS string for
  // Canvas-API gradient drawing in BootScene.
  const BALL_COLORS = {
    1: { hex: 0xFF4757, rgb: '#FF4757', name: 'Red'    },
    2: { hex: 0x2196F3, rgb: '#2196F3', name: 'Blue'   },
    3: { hex: 0x00E676, rgb: '#00E676', name: 'Green'  },
    4: { hex: 0xFFC107, rgb: '#FFC107', name: 'Amber'  },
    5: { hex: 0xCE93D8, rgb: '#CE93D8', name: 'Lilac'  },
    6: { hex: 0xFF6E40, rgb: '#FF6E40', name: 'Coral'  },
    7: { hex: 0x26C6DA, rgb: '#26C6DA', name: 'Cyan'   },
    8: { hex: 0x69F0AE, rgb: '#69F0AE', name: 'Mint'   },
    9: { hex: 0xFFAB40, rgb: '#FFAB40', name: 'Peach'  },
   10: { hex: 0xEA80FC, rgb: '#EA80FC', name: 'Pink'   },
  };

  // ── Difficulty configurations ─────────────────────────────────────────────
  // n      = number of colours = tube capacity = filled tubes
  // tubes  = n + 1  (one always-empty tube)
  // Hard mode uses a deterministic Latin-square construction (not retry-based)
  const DIFFICULTY = {
    easy: {
      n: 4,                  // 4 colours, 4-ball capacity, 5 tubes
      targetReverseMoves: 20,// 20 scramble moves → mixed tubes, 15–25 moves to solve
      minScore: 20,
      speedThreshold: 120,   // seconds for max speed bonus
      label: 'Easy',
      description: '4 colours · 5 tubes',
    },
    medium: {
      n: 5,
      targetReverseMoves: 55, // 55 scramble moves → well-mixed, 35–55 moves to solve
      minScore: 45,
      speedThreshold: 240,
      label: 'Medium',
      description: '5 colours · 6 tubes',
    },
    hard: {
      n: 5,                  // deliberately kept at n=5 (6 tubes) —
      targetReverseMoves: 0, // difficulty comes from distribution, not size
      minScore: 65,
      speedThreshold: 360,
      label: 'Hard',
      description: '5 colours · 6 tubes · max entropy',
    },
  };

  // ── Tube visual parameters ────────────────────────────────────────────────
  // These are base values. TubeRenderer scales them by ballRadius.
  const TUBE = {
    wallThickness: 5,     // px each side
    rimHeight: 8,         // top opening extra px
    baseHeight: 12,       // bottom platform extra px
    cornerRadius: 14,     // rounded corners
    innerPadding: 3,      // gap between ball and inner wall (each side)
    ballGap: 2,           // vertical gap between balls
    shineWidth: 5,        // left-side highlight width
    selectionGlow: 0x6c5ce7, // purple for selected tube
    completeGlow: 0x00cec9,  // teal for completed tube
  };

  // Ball pixel radius per n value (tube width = radius*2 + innerPadding*2 + wallThickness*2)
  const BALL_RADIUS = { 4: 32, 5: 27 };

  // ── Animation durations (ms) ──────────────────────────────────────────────
  const ANIM = {
    liftDuration:   110,
    liftHeight:     80,   // px to lift ball above source tube
    travelDuration: 160,
    dropDuration:   160,
    shakeDuration:  50,
    shakeRepeats:   3,
  };

  // ── Scoring ───────────────────────────────────────────────────────────────
  const SCORE = {
    base: 60,
    maxEfficiency: 25,
    maxSpeed: 10,          // remaining 5 pts come from rounding
    undoPenalty: 3,
    resetPenalty: 15,
  };

  // ── HUD layout ────────────────────────────────────────────────────────────
  const HUD_Y = 36;        // Y centre of top HUD bar
  const BTN_Y = GAME_HEIGHT - 44; // Y centre of bottom button bar

  return {
    GAME_WIDTH, GAME_HEIGHT,
    BALL_COLORS,
    DIFFICULTY,
    TUBE, BALL_RADIUS,
    ANIM, SCORE,
    HUD_Y, BTN_Y,
  };
})();

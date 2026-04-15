/**
 * GameScene.js
 * Core gameplay scene — the heart of the puzzle game.
 *
 * Responsibilities:
 *   1. Generate puzzle via PuzzleGenerator
 *   2. Layout tube renderers based on difficulty config
 *   3. Input state machine: IDLE → SELECTED → ANIMATING → (WIN)
 *   4. Execute moves with 3-phase animations via AnimationEngine
 *   5. Manage undo stack and reset
 *   6. Update HUD (moves, timer, live score)
 *   7. Detect win → transition to VictoryScene
 *
 * State machine transitions:
 *   IDLE      + click tube (has balls)          → SELECTED
 *   SELECTED  + click same tube                 → IDLE (deselect)
 *   SELECTED  + click valid destination         → ANIMATING
 *   SELECTED  + click invalid destination       → shake → SELECTED
 *   ANIMATING + animation complete              → IDLE (or WIN)
 */
class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * @param {{ difficulty: 'easy'|'medium'|'hard' }} data
   */
  init(data) {
    this.difficulty = data.difficulty || 'easy';
  }

  create() {
    const W = CONSTANTS.GAME_WIDTH;
    const H = CONSTANTS.GAME_HEIGHT;

    // ── Generate puzzle ────────────────────────────────────────────────────
    const puzzle = PuzzleGenerator.generate(this.difficulty);

    // ── Game state object ─────────────────────────────────────────────────
    this.gs = {
      difficulty:    this.difficulty,
      tubes:         puzzle.tubes,
      initialTubes:  puzzle.tubes.map(t => [...t]),
      capacity:      puzzle.capacity,
      colors:        puzzle.colors,
      selectedTube:  null,
      status:        'IDLE',   // 'IDLE' | 'SELECTED' | 'ANIMATING' | 'WIN'
    };

    // ── Supporting systems ────────────────────────────────────────────────
    this.scoreEngine  = ScoreEngine.create(puzzle.estimatedOptimalMoves, this.difficulty);
    this.animEngine   = AnimationEngine.create(this);
    this.undoStack    = [];
    this.tubeRenderers = [];

    // ── Layout calculation ────────────────────────────────────────────────
    this._layout = this._computeLayout();

    // ── Scene construction ────────────────────────────────────────────────
    this._drawBackground(W, H);
    this._buildHUD(W);
    this._buildTubes();
    this._buildBottomBar(W);

    // ── Timer ─────────────────────────────────────────────────────────────
    this._timerEvent = this.time.addEvent({
      delay: 1000,
      callback: this._tickTimer,
      callbackScope: this,
      loop: true,
    });

    // ── Fade in ───────────────────────────────────────────────────────────
    this.cameras.main.fadeIn(350, 10, 12, 22);

    // ── Hide HUD when this scene shuts down ──────────────────────────────
    this.events.once('shutdown', () => {
      document.getElementById('game-hud').classList.add('ghud-hidden');
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Layout
  // ─────────────────────────────────────────────────────────────────────────

  _computeLayout() {
    const { colors: n, capacity } = this.gs;
    const numTubes   = n + 1;
    const ballRadius = CONSTANTS.BALL_RADIUS[capacity] || 23;
    const T          = CONSTANTS.TUBE;

    // Tube outer dimensions (matches what TubeRenderer computes internally)
    const ballDiam = ballRadius * 2;
    const outerW   = ballDiam + T.innerPadding * 2 + T.wallThickness * 2;
    const innerH   = ballDiam * capacity + T.ballGap * (capacity - 1) + T.rimHeight;
    const outerH   = innerH + T.baseHeight;

    // Horizontal: evenly spaced with generous edge padding so tubes fill canvas
    const edgePad = 44;   // px inset from each canvas edge
    const spacing  = (CONSTANTS.GAME_WIDTH - edgePad * 2) / numTubes;

    // Vertical: game area starts STRICTLY below the 76 px HUD bar
    const HUD_BAR  = 76;  // must match _buildHUD BARY
    const topGap   = 14;  // breathing room between bar bottom and tube top
    const botGap   = 18;  // breathing room at canvas bottom
    const gameH    = CONSTANTS.GAME_HEIGHT - HUD_BAR - topGap - botGap;
    const tubeCY   = HUD_BAR + topGap + gameH / 2;

    return { numTubes, ballRadius, spacing, tubeCY, outerW, outerH, edgePad };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Scene construction helpers
  // ─────────────────────────────────────────────────────────────────────────

  _drawBackground(W, H) {
    const HUD_BAR = 76;
    // ── Layer 1: near-black background ────────────────────────────────────
    const bg = this.add.graphics().setDepth(0);
    bg.fillStyle(0x05070f, 1);
    bg.fillRect(0, 0, W, H);

    // ── Layer 2: HUD zone — slightly lighter to read as a distinct panel ──
    bg.fillStyle(0x000000, 0.30);
    bg.fillRect(0, 0, W, HUD_BAR);

    // ── Layer 3: single-pixel purple separator line ───────────────────────
    // (the HUD draws its own bottom border, this extends it into the bg)
    bg.fillStyle(0x6c5ce7, 0.18);
    bg.fillRect(0, HUD_BAR, W, 1);

    // ── Layer 4: subtle radial stage light ONLY in game area ──────────────
    // Centred in the play area (below HUD), tightly contained so it doesn't
    // flood the edges — gives depth without obscuring the dark theme.
    const gameAreaCY = HUD_BAR + (H - HUD_BAR) / 2;
    const glow = this.add.graphics().setDepth(1);
    glow.fillStyle(0x0c1430, 0.55);
    glow.fillEllipse(W / 2, gameAreaCY, W * 0.68, (H - HUD_BAR) * 0.60);
  }

  _buildHUD(_W) {
    // ── Show the full-viewport HTML HUD overlay ───────────────────────────
    const hud = document.getElementById('game-hud');
    hud.classList.remove('ghud-hidden');

    // ── Set difficulty badge colour via CSS custom property ───────────────
    const badgeRgb = { easy: '0,184,148', medium: '253,203,110', hard: '225,112,85' };
    const cfg      = CONSTANTS.DIFFICULTY[this.difficulty];
    hud.style.setProperty('--badge-rgb', badgeRgb[this.difficulty] || '108,92,231');
    document.getElementById('ghud-badge').style
      .setProperty('--badge-rgb', badgeRgb[this.difficulty] || '108,92,231');
    document.getElementById('ghud-badge-label').textContent = cfg.label.toUpperCase();

    // ── Wire up button clicks ─────────────────────────────────────────────
    // Re-assign (not addEventListener) to avoid duplicate handlers on restart
    document.getElementById('ghud-menu-btn').onclick  = () => this._goToMenu();
    document.getElementById('ghud-undo-btn').onclick  = () => { AudioEngine.playSelectSound(); this._undo(); };
    document.getElementById('ghud-reset-btn').onclick = () => { AudioEngine.playSelectSound(); this._reset(); };

    // ── Store DOM refs for live updates ──────────────────────────────────
    this._movesEl = document.getElementById('ghud-moves');
    this._timeEl  = document.getElementById('ghud-time');
    // (keep _movesText/_timerText as null — no Phaser text objects needed)
    this._movesText = null;
    this._timerText = null;
  }

  _buildTubes() {
    const { numTubes, ballRadius, spacing, tubeCY, edgePad } = this._layout;
    const { tubes, capacity } = this.gs;

    for (let i = 0; i < numTubes; i++) {
      const tx = edgePad + spacing * i + spacing / 2;
      const tr = new TubeRenderer.TubeRenderer(
        this, tx, tubeCY, capacity, ballRadius, i
      );
      tr.setBalls(tubes[i]);
      tr.setDepth(10);
      tr.onPointerDown(() => this._handleTubeClick(i));
      this.tubeRenderers.push(tr);
    }
  }

  _buildBottomBar(_W) {
    // Bottom bar removed — all controls are integrated into the top HUD.
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Input — main state machine
  // ─────────────────────────────────────────────────────────────────────────

  _handleTubeClick(tubeIdx) {
    const { status, tubes, capacity } = this.gs;

    // Block input during animation or win
    if (status === 'ANIMATING' || status === 'WIN') return;

    if (status === 'IDLE') {
      // Nothing currently selected
      const topC = MoveEngine.topBall(tubes[tubeIdx]);
      if (topC === 0) return;                              // empty tube
      if (MoveEngine.isTubeDone(tubes[tubeIdx], capacity)) return; // already done

      this.gs.selectedTube = tubeIdx;
      this.gs.status = 'SELECTED';
      this.tubeRenderers[tubeIdx].setSelected(true);
      AudioEngine.playSelectSound();

    } else if (status === 'SELECTED') {
      const from = this.gs.selectedTube;

      if (tubeIdx === from) {
        // Tap same tube → deselect
        this.tubeRenderers[from].setSelected(false);
        this.gs.selectedTube = null;
        this.gs.status = 'IDLE';

      } else if (MoveEngine.canMove(from, tubeIdx, tubes, capacity)) {
        // Valid move → animate
        this._executeMove(from, tubeIdx);

      } else {
        // Invalid move → shake destination and play error sound
        AudioEngine.playErrorSound();
        this.animEngine.animateShake(this.tubeRenderers[tubeIdx].container);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Move execution
  // ─────────────────────────────────────────────────────────────────────────

  _executeMove(from, to) {
    const gs = this.gs;
    gs.status = 'ANIMATING';

    // Deselect source visually
    this.tubeRenderers[from].setSelected(false);
    gs.selectedTube = null;

    // Identify slots
    const srcSlot = MoveEngine.topSlotIndex(gs.tubes[from]);
    const dstSlot = MoveEngine.nextEmptySlotIndex(gs.tubes[to]);
    const colorId = gs.tubes[from][srcSlot];

    // Compute world-space positions
    const srcX = this.tubeRenderers[from].getBallWorldX();
    const srcY = this.tubeRenderers[from].getBallWorldY(srcSlot);
    const dstX = this.tubeRenderers[to].getBallWorldX();
    const dstY = this.tubeRenderers[to].getBallWorldY(dstSlot);

    // Hide the source ball sprite while the flying clone is in motion
    const srcSprite = this.tubeRenderers[from].ballSprites[srcSlot];
    if (srcSprite) srcSprite.setVisible(false);

    // Create the temporary flying-ball image at source world position
    const diam = this._layout.ballRadius * 2;
    const flyingBall = this.add.image(srcX, srcY, `ball_${colorId}`);
    flyingBall.setDisplaySize(diam, diam);
    flyingBall.setDepth(200);

    // ── Air-path height: fixed Y above every tube's top rim ────────────────
    // tubeCY is the container centre; outerH/2 reaches the tube's top rim.
    // We clear that by an extra 46px so the ball is visibly in open air.
    const airY = this._layout.tubeCY - this._layout.outerH / 2 - 46;

    // ── Push current state to undo stack BEFORE changing anything ────────
    this.undoStack.push(gs.tubes.map(t => [...t]));

    // ── Animate ───────────────────────────────────────────────────────────
    this.animEngine.animateMove(flyingBall, srcX, srcY, dstX, dstY, airY, () => {
      flyingBall.destroy();

      // Apply move to canonical state
      gs.tubes = MoveEngine.applyMove(from, to, gs.tubes);

      // Sync renderers (rebuild from state)
      this.tubeRenderers[from].setBalls(gs.tubes[from]);
      this.tubeRenderers[to].setBalls(gs.tubes[to]);

      // Score & audio
      this.scoreEngine.recordMove();
      AudioEngine.playDropSound();

      // Tube-complete check for destination
      if (MoveEngine.isTubeDone(gs.tubes[to], gs.capacity)) {
        this.tubeRenderers[to].setComplete();
        this.animEngine.animateComplete(this.tubeRenderers[to].container);
        AudioEngine.playSortedSound();
      }

      gs.status = 'IDLE';
      this._updateHUD();
      this._checkWin();
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Undo / Reset
  // ─────────────────────────────────────────────────────────────────────────

  _undo() {
    if (this.gs.status === 'ANIMATING' || this.gs.status === 'WIN') return;
    if (this.undoStack.length === 0) return;

    this.gs.tubes = this.undoStack.pop();
    this._deselectAll();
    this.gs.status = 'IDLE';
    this._refreshAllRenderers();
    this.scoreEngine.recordUndo();
    this._updateHUD();
  }

  _reset() {
    if (this.gs.status === 'ANIMATING' || this.gs.status === 'WIN') return;

    this.undoStack = [];
    this.gs.tubes  = this.gs.initialTubes.map(t => [...t]);
    this._deselectAll();
    this.gs.status = 'IDLE';
    this._refreshAllRenderers();
    this.scoreEngine.recordReset();
    this._updateHUD();
  }

  _deselectAll() {
    if (this.gs.selectedTube !== null) {
      this.tubeRenderers[this.gs.selectedTube]?.setSelected(false);
      this.gs.selectedTube = null;
    }
  }

  _refreshAllRenderers() {
    const { tubes, capacity } = this.gs;
    this.tubeRenderers.forEach((tr, i) => {
      tr.selected = false;
      tr.complete  = MoveEngine.isTubeDone(tubes[i], capacity);
      tr._drawTube();
      tr.setBalls(tubes[i]);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Win detection
  // ─────────────────────────────────────────────────────────────────────────

  _checkWin() {
    if (!MoveEngine.isBoardSolved(this.gs.tubes, this.gs.capacity)) return;

    this.gs.status = 'WIN';
    this._timerEvent.remove(false);

    const scoreResult = this.scoreEngine.computeFinalScore();

    // ── Confetti across the screen ────────────────────────────────────────
    const W = CONSTANTS.GAME_WIDTH;
    const H = CONSTANTS.GAME_HEIGHT;
    for (let i = 0; i < 3; i++) {
      this.time.delayedCall(i * 250, () => {
        this.animEngine.burstConfetti(
          Phaser.Math.Between(80, W - 80),
          Phaser.Math.Between(200, H - 200),
          20
        );
      });
    }

    AudioEngine.playWinSound();

    // Camera flash
    this.cameras.main.flash(600, 255, 255, 255, false);

    // Transition to VictoryScene after celebration
    this.time.delayedCall(1800, () => {
      document.getElementById('game-hud').classList.add('ghud-hidden');
      this.cameras.main.fadeOut(400, 10, 12, 22);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('VictoryScene', {
          scoreResult,
          difficulty: this.difficulty,
        });
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HUD updates
  // ─────────────────────────────────────────────────────────────────────────

  _tickTimer() {
    if (this.gs.status === 'WIN') return;
    this._updateHUD();
  }

  _updateHUD() {
    const moves = this.scoreEngine.moveCount;
    const sec   = Math.round(this.scoreEngine.elapsedSeconds());
    const mm    = String(Math.floor(sec / 60)).padStart(2, '0');
    const ss    = String(sec % 60).padStart(2, '0');

    // Update HTML HUD elements
    if (this._movesEl) this._movesEl.textContent = String(moves);
    if (this._timeEl)  this._timeEl.textContent  = `${mm}:${ss}`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Navigation
  // ─────────────────────────────────────────────────────────────────────────

  _goToMenu() {
    if (this.gs.status === 'ANIMATING') return;
    this._timerEvent?.remove(false);
    document.getElementById('game-hud').classList.add('ghud-hidden');
    this.cameras.main.fadeOut(300, 10, 12, 22);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('MenuScene');
    });
  }
}

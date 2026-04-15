/**
 * TubeRenderer.js
 * Manages the complete visual representation of one tube and its balls.
 *
 * Each renderer owns:
 *   • a Phaser.GameObjects.Container  (the tube body)
 *   • a Graphics object               (the glass tube drawn procedurally)
 *   • an array of Image objects       (one per ball slot)
 *
 * Ball slot convention:
 *   slot 0 = physical bottom of tube (largest Y within container)
 *   slot capacity-1 = physical top   (smallest Y within container)
 *
 * World Y of a ball = container.y + getBallLocalY(slot)
 * World X of a ball = container.x  (balls are centred horizontally)
 */
window.TubeRenderer = (function () {

  class TubeRenderer {
    /**
     * @param {Phaser.Scene} scene
     * @param {number} worldX     - Container centre X in world space
     * @param {number} worldY     - Container centre Y in world space
     * @param {number} capacity   - Balls this tube can hold
     * @param {number} ballRadius - Pixel radius of each ball
     * @param {number} tubeIndex  - Index for labelling / event routing
     */
    constructor(scene, worldX, worldY, capacity, ballRadius, tubeIndex) {
      this.scene      = scene;
      this.capacity   = capacity;
      this.ballRadius = ballRadius;
      this.tubeIndex  = tubeIndex;
      this._worldX    = worldX;
      this._worldY    = worldY;
      this.selected   = false;
      this.complete   = false;

      // ── Geometry ───────────────────────────────────────────────────────────
      const T          = CONSTANTS.TUBE;
      const ballDiam   = ballRadius * 2;
      this.innerW      = ballDiam + T.innerPadding * 2;
      this.innerH      = ballDiam * capacity + T.ballGap * (capacity - 1) + T.rimHeight;
      this.outerW      = this.innerW  + T.wallThickness * 2;
      this.outerH      = this.innerH  + T.baseHeight;
      this.cornerR     = T.cornerRadius;

      // Bottom of tube relative to container centre → used to position balls
      this._bottomBase = this.outerH / 2 - T.baseHeight / 2;

      // ── Phaser objects ────────────────────────────────────────────────────
      this.container  = scene.add.container(worldX, worldY);
      this.gfx        = scene.add.graphics();
      this.container.add(this.gfx);

      // Invisible hit-area (interactive zone spans full tube + small border)
      this.hitArea = scene.add.rectangle(
        0, 0,
        this.outerW + 14,
        this.outerH + 20,
        0x000000, 0
      );
      this.hitArea.setInteractive({ useHandCursor: true });
      this.container.add(this.hitArea);

      // Ball sprite slots
      this.ballSprites = new Array(capacity).fill(null);

      // Initial draw
      this._drawTube();
    }

    // ── Public geometry helpers ───────────────────────────────────────────────
    /**
     * Local Y offset (relative to container centre) for the centre of a ball
     * sitting at `slotIdx` (0 = bottom).
     */
    getBallLocalY(slotIdx) {
      // Slot 0 sits just above the base; each extra slot moves up by one ball diameter.
      const ballDiam = this.ballRadius * 2;
      return this._bottomBase - this.ballRadius - slotIdx * (ballDiam + CONSTANTS.TUBE.ballGap);
    }

    /** World-space Y of the centre of a ball at slotIdx. */
    getBallWorldY(slotIdx) { return this._worldY + this.getBallLocalY(slotIdx); }

    /** World-space X of any ball (always tube centre). */
    getBallWorldX() { return this._worldX; }

    // ── Ball management ───────────────────────────────────────────────────────
    /**
     * Fully synchronise the visual state with a new balls array.
     * Destroys any existing sprites and recreates them.
     * @param {number[]} balls - tube data array (0 = empty)
     */
    setBalls(balls) {
      // Destroy existing sprites
      for (let i = 0; i < this.capacity; i++) {
        if (this.ballSprites[i]) {
          this.ballSprites[i].destroy();
          this.ballSprites[i] = null;
        }
      }
      // Recreate for non-zero slots
      for (let i = 0; i < balls.length; i++) {
        if (balls[i] === 0) continue;
        this._createBallAt(balls[i], i);
      }
    }

    // ── Visual state ──────────────────────────────────────────────────────────
    setSelected(value) {
      this.selected = value;
      this._drawTube();
    }

    setComplete() {
      this.complete = true;
      this._drawTube();
    }

    // ── Hit area interactivity ────────────────────────────────────────────────
    onPointerDown(callback) {
      this.hitArea.on('pointerdown', callback);
    }

    onPointerOver(callback) {
      this.hitArea.on('pointerover', callback);
    }

    onPointerOut(callback) {
      this.hitArea.on('pointerout', callback);
    }

    // ── Depth ────────────────────────────────────────────────────────────────
    setDepth(d) { this.container.setDepth(d); }

    // ── Cleanup ───────────────────────────────────────────────────────────────
    destroy() { this.container.destroy(true); }

    // ── Private: drawing ─────────────────────────────────────────────────────
    _drawTube() {
      const g   = this.gfx;
      const T   = CONSTANTS.TUBE;
      const hw  = this.outerW / 2;
      const hh  = this.outerH / 2;
      // Glass tube body height (excludes the base shadow zone)
      const tubeH    = this.outerH - T.baseHeight;
      const tubeTop  = -hh;
      const rimSemiH = 9;            // half-height of the top oval rim
      const bodyTop  = tubeTop + rimSemiH;
      const bodyH    = tubeH - rimSemiH;
      g.clear();

      // ── 1. Drop shadow below tube ─────────────────────────────────────────
      g.fillStyle(0x000000, 0.45);
      g.fillEllipse(0, hh - 1, this.outerW + 24, 11);
      g.fillStyle(0x000000, 0.15);
      g.fillEllipse(0, hh + 5, this.outerW + 40, 7);

      // ── 2. White base disc ────────────────────────────────────────────────
      const discY = hh - T.baseHeight * 0.35;
      g.fillStyle(0x7788a0, 0.90);
      g.fillEllipse(0, discY + 4, this.outerW + 12, T.baseHeight + 8);
      g.fillStyle(0xc8d8e8, 1.0);
      g.fillEllipse(0, discY, this.outerW + 8, T.baseHeight + 4);
      g.fillStyle(0xf0f6ff, 1.0);
      g.fillEllipse(0, discY - 2, this.outerW + 4, T.baseHeight);
      // Specular highlight on disc
      g.fillStyle(0xffffff, 0.70);
      g.fillEllipse(-hw * 0.28, discY - 3, this.outerW * 0.46, T.baseHeight * 0.55);

      // ── 3. Main tube body (deep dark glass interior) ──────────────────────
      g.fillStyle(0x050b13, 0.97);
      g.fillRoundedRect(-hw, bodyTop, this.outerW, bodyH, { tl: 2, tr: 2, bl: 6, br: 6 });

      // ── 4. Top oval rim (cylinder opening viewed in perspective) ──────────
      const rimY = tubeTop + rimSemiH;
      // Outer metallic ring
      g.fillStyle(0x2e4458, 0.95);
      g.fillEllipse(0, rimY, this.outerW + 1, rimSemiH * 2.2);
      // Mid-rim lighter band
      g.fillStyle(0x607a90, 0.82);
      g.fillEllipse(0, rimY, this.outerW - 3, rimSemiH * 1.5);
      // Dark inner opening
      g.fillStyle(0x020609, 0.98);
      g.fillEllipse(0, rimY, this.innerW - 2, rimSemiH * 0.72);
      // Bright specular on rim top-left
      g.fillStyle(0xdceefc, 0.88);
      g.fillEllipse(-hw * 0.28, rimY - rimSemiH * 0.45, this.outerW * 0.50, rimSemiH * 0.68);

      // ── 5. Left-side cylindrical glass reflection ─────────────────────────
      const reflX = -hw + T.wallThickness - 1;
      const reflY = bodyTop + 6;
      const reflH = bodyH - 16;
      // Wide soft primary highlight
      g.fillStyle(0xffffff, 0.22);
      g.fillRoundedRect(reflX, reflY, 12, reflH, 6);
      // Bright narrow core
      g.fillStyle(0xffffff, 0.14);
      g.fillRoundedRect(reflX + 3, reflY + 14, 5, reflH - 28, 3);

      // ── 6. Right-side faint reflection ────────────────────────────────────
      g.fillStyle(0xffffff, 0.05);
      g.fillRoundedRect(hw - T.wallThickness - 7, reflY + 20, 5, reflH - 40, 3);

      // ── 7. Glass wall border ──────────────────────────────────────────────
      const borderColor = this.complete ? CONSTANTS.TUBE.completeGlow
                        : this.selected ? CONSTANTS.TUBE.selectionGlow
                        : 0x4a6070;
      const borderAlpha = this.complete || this.selected ? 0.90 : 0.35;
      g.lineStyle(this.selected || this.complete ? 2 : 1.5, borderColor, borderAlpha);
      g.strokeRoundedRect(-hw, bodyTop, this.outerW, bodyH, { tl: 2, tr: 2, bl: 6, br: 6 });

      // ── 8. Selection / completion aura ────────────────────────────────────
      if (this.selected || this.complete) {
        const gc = this.complete ? CONSTANTS.TUBE.completeGlow : CONSTANTS.TUBE.selectionGlow;
        g.lineStyle(12, gc, 0.15);
        g.strokeRoundedRect(-hw - 8, bodyTop - 4, this.outerW + 16, bodyH + 8, 8);
        g.lineStyle(3, gc, 0.45);
        g.strokeRoundedRect(-hw - 2, bodyTop - 1, this.outerW + 4, bodyH + 4, 5);
      }
    }

    // ── Private: ball sprite creation ─────────────────────────────────────────
    _createBallAt(colorId, slotIdx) {
      const localY = this.getBallLocalY(slotIdx);
      const diam   = this.ballRadius * 2;
      const img    = this.scene.add.image(0, localY, `ball_${colorId}`);
      img.setDisplaySize(diam, diam); // scale texture to match this tube's ball size
      img.setDepth(1);
      this.container.add(img);
      this.ballSprites[slotIdx] = img;
      return img;
    }
  }

  return { TubeRenderer };

})();

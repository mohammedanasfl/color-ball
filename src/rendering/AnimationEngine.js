/**
 * AnimationEngine.js
 * Centralized 3-phase tween orchestrator for ball movements.
 *
 * Phase 1 — LIFT:     ball rises above source tube (ease-out, slight scale-up)
 * Phase 2 — TRAVEL:   ball glides horizontally to destination column (linear)
 * Phase 3 — DROP:     ball falls into destination slot (bounce, scale reset)
 *
 * The engine uses a BUSY FLAG to serialize moves — clicks are blocked
 * (by the GameScene state machine) while an animation is running.
 *
 * All positions are in Phaser WORLD SPACE (not relative to any container).
 */
window.AnimationEngine = (function () {

  class AnimationEngine {
    constructor(scene) {
      this.scene = scene;
      this.busy  = false;
    }

    /**
     * Animate a ball sprite from (fromX, fromY) → (toX, toY) with the
     * strict 3-phase lift-travel-drop sequence.
     *
     * Phase 1 — LIFT:    ball rises STRAIGHT UP from its current slot to
     *                     a fixed air-path height above ALL tube openings.
     * Phase 2 — TRAVEL:  ball glides horizontally AT that fixed height.
     * Phase 3 — DROP:    ball falls STRAIGHT DOWN into the destination slot.
     *
     * @param {Phaser.GameObjects.Image} sprite      - Temporary flying-ball image
     * @param {number} fromX
     * @param {number} fromY  - World Y of ball's current slot inside source tube
     * @param {number} toX
     * @param {number} toY    - World Y of destination slot inside dest tube
     * @param {number} airY   - Fixed world Y for the horizontal flight path
     *                          (must be above the top rim of every tube)
     * @param {Function} onComplete
     */
    animateMove(sprite, fromX, fromY, toX, toY, airY, onComplete) {
      this.busy = true;
      const { liftDuration, travelDuration, dropDuration } = CONSTANTS.ANIM;
      const scene = this.scene;

      sprite.setPosition(fromX, fromY);
      sprite.setScale(1.0);
      sprite.setDepth(200);

      // ── Drop shadow underneath the flying ball (destroyed at end) ─────────
      const shadow = scene.add.ellipse(fromX, fromY + 6, sprite.displayWidth * 0.65, 9, 0x000000, 0.0);
      shadow.setDepth(199);
      scene.tweens.add({ targets: shadow, alpha: 0.45, duration: liftDuration, ease: 'Cubic.easeOut' });

      // ── Phase 1: Lift — straight up to air-path height ────────────────────
      // Distance from ball's current slot all the way to airY, regardless of
      // which slot the ball is in. This guarantees the ball is completely clear
      // of tube walls before any horizontal movement.
      scene.tweens.add({
        targets:  sprite,
        y:        airY,
        scaleX:   1.18,
        scaleY:   1.18,
        duration: liftDuration,
        ease:     'Cubic.easeOut',
        onUpdate: () => { shadow.x = sprite.x; shadow.y = sprite.y + sprite.displayHeight * 0.55; },
        onComplete: () => {
          // Shadow dims at full lift
          scene.tweens.add({ targets: shadow, alpha: 0.22, duration: 60 });

          // ── Phase 2: Travel — horizontal at fixed airY, no Y change ───────
          scene.tweens.add({
            targets:  sprite,
            x:        toX,
            duration: travelDuration,
            ease:     'Sine.easeInOut',
            onUpdate: () => { shadow.x = sprite.x; },
            onComplete: () => {

              // Shadow vanishes as ball enters tube
              scene.tweens.add({ targets: shadow, alpha: 0, duration: dropDuration * 0.6,
                onComplete: () => shadow.destroy() });

              // ── Phase 3: Drop — straight down from airY into destination ──
              scene.tweens.add({
                targets:  sprite,
                y:        toY,
                scaleX:   1.0,
                scaleY:   1.0,
                duration: dropDuration,
                ease:     'Bounce.easeOut',
                onComplete: () => {
                  this.busy = false;
                  if (onComplete) onComplete();
                },
              });
            },
          });
        },
      });
    }

    /**
     * Play a horizontal shake on a Phaser Container / GameObject.
     * Used for invalid move feedback.
     *
     * @param {Phaser.GameObjects.Container|Phaser.GameObjects.Image} target
     * @param {Function} [onComplete]
     */
    animateShake(target, onComplete) {
      const { shakeDuration, shakeRepeats } = CONSTANTS.ANIM;
      const originX = target.x;

      this.scene.tweens.add({
        targets:  target,
        x:        originX + 9,
        duration: shakeDuration,
        ease:     'Sine.easeInOut',
        yoyo:     true,
        repeat:   shakeRepeats,
        onComplete: () => {
          target.x = originX; // snap back to exact origin
          if (onComplete) onComplete();
        },
      });
    }

    /**
     * Flash a completed tube green — scale pulse + colour tint.
     * @param {Phaser.GameObjects.Container} container
     */
    animateComplete(container) {
      this.scene.tweens.add({
        targets:  container,
        scaleX:   1.08,
        scaleY:   1.08,
        duration: 140,
        ease:     'Sine.easeOut',
        yoyo:     true,
        onComplete: () => {
          container.setScale(1);
        },
      });
    }

    /**
     * Burst confetti sprites at a given position (win celebration).
     * @param {number} cx - centre X
     * @param {number} cy - centre Y
     * @param {number} count - number of particles
     */
    burstConfetti(cx, cy, count = 30) {
      const scene  = this.scene;
      const colors = Object.values(CONSTANTS.BALL_COLORS);

      for (let i = 0; i < count; i++) {
        const colorInfo = colors[Math.floor(Math.random() * colors.length)];
        const size      = 6 + Math.random() * 8;
        const particle  = scene.add.rectangle(cx, cy, size, size, colorInfo.hex);
        particle.setDepth(300);

        const angle    = (Math.random() * Math.PI * 2);
        const speed    = 80 + Math.random() * 160;
        const targetX  = cx + Math.cos(angle) * speed;
        const targetY  = cy + Math.sin(angle) * speed;
        const duration = 600 + Math.random() * 500;

        scene.tweens.add({
          targets:  particle,
          x:        targetX,
          y:        targetY + 200,
          alpha:    0,
          angle:    Math.random() * 360,
          scaleX:   0.1,
          scaleY:   0.1,
          duration,
          ease:     'Cubic.easeOut',
          onComplete: () => particle.destroy(),
        });
      }
    }
  }

  /** Factory — one instance per Phaser scene. */
  function create(scene) { return new AnimationEngine(scene); }

  return { create };

})();

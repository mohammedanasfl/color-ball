/**
 * BootScene.js
 * Preloads all procedurally-generated assets before transitioning to MenuScene.
 *
 * Since the game uses zero external image files, this scene's main job is to
 * create canvas-based ball textures (one per colour) using the Web Canvas API.
 * Each texture renders a 3D-looking sphere with a radial gradient and specular highlight.
 */
class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Nothing to load from disk — all assets are generated in create()
  }

  create() {
    const W = CONSTANTS.GAME_WIDTH;
    const H = CONSTANTS.GAME_HEIGHT;

    // ── Splash background (dark-to-purple — matches menu theme) ───────────
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a0a20, 0x0a0a20, 0x160a38, 0x160a38, 1);
    bg.fillRect(0, 0, W, H);

    // Subtle radial glow at top-centre
    const glow = this.add.graphics();
    glow.fillStyle(0x6c5ce7, 0.10);
    glow.fillEllipse(W / 2, -40, 580, 260);

    const titleText = this.add.text(W / 2, H / 2 - 30, 'COLOUR SORT', {
      fontFamily: 'Orbitron, Outfit, sans-serif',
      fontSize:   '30px',
      fontStyle:  'bold',
      color:      '#c8bfff',
      shadow: { offsetX: 0, offsetY: 0, color: '#6c5ce7', blur: 22, fill: true },
    }).setOrigin(0.5).setAlpha(0);

    const loadText = this.add.text(W / 2, H / 2 + 24, 'Loading…', {
      fontFamily: 'Outfit, sans-serif',
      fontSize:   '13px',
      color:      'rgba(162,155,254,0.55)',
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({ targets: [titleText, loadText], alpha: 1, duration: 400 });

    // ── Generate ball textures ────────────────────────────────────────────────
    // One canvas texture per colour ID (key = `ball_N`).
    // We use radius 27 (the larger size) for the base texture — Phaser scales
    // the image to match the tube's ball radius at display time via setDisplaySize.
    const BASE_RADIUS = 27;

    for (const [idStr, colorInfo] of Object.entries(CONSTANTS.BALL_COLORS)) {
      const id = Number(idStr);
      this._createBallTexture(id, colorInfo, BASE_RADIUS);
    }

    // ── Transition after brief splash ────────────────────────────────────────
    this.time.delayedCall(600, () => {
      this.cameras.main.fadeOut(300, 10, 10, 20);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('MenuScene');
      });
    });
  }

  /**
   * Creates a canvas texture with key `ball_<colorId>`.
   * Draws a 3-D sphere using radial-gradient fills on a Web Canvas 2D context.
   */
  _createBallTexture(colorId, colorInfo, radius) {
    const key  = `ball_${colorId}`;
    const size = radius * 2 + 4; // +4px for anti-alias padding
    if (!this.textures.exists(key)) {
      this._drawSphere(key, colorInfo, radius, size);
    }
  }

  _drawSphere(key, colorInfo, radius, size) {
    const ct  = this.textures.createCanvas(key, size, size);
    const ctx = ct.getContext();
    const cx  = size / 2;
    const cy  = size / 2;
    const r   = radius;

    // Extract RGB channels from packed hex
    const hex = colorInfo.hex;
    const rd  = (hex >> 16) & 0xff;
    const gn  = (hex >> 8)  & 0xff;
    const bl  =  hex        & 0xff;

    const lighter = (ch, d) => Math.min(255, ch + d);
    const darker  = (ch, d) => Math.max(0,   ch - d);

    // ── Main sphere gradient (light source top-left) ────────────────────────
    const main = ctx.createRadialGradient(
      cx - r * 0.35, cy - r * 0.35, r * 0.02,
      cx + r * 0.1,  cy + r * 0.1,  r
    );
    main.addColorStop(0,    `rgb(${lighter(rd,120)},${lighter(gn,120)},${lighter(bl,120)})`);
    main.addColorStop(0.35, `rgb(${rd},${gn},${bl})`);
    main.addColorStop(1,    `rgb(${darker(rd,90)},${darker(gn,90)},${darker(bl,90)})`);

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = main;
    ctx.fill();

    // ── Large soft glossy highlight — upper-left, covers ~half ball ─────────
    const spec = ctx.createRadialGradient(
      cx - r * 0.28, cy - r * 0.36, 0,
      cx - r * 0.08, cy - r * 0.16, r * 0.68
    );
    spec.addColorStop(0,    'rgba(255,255,255,0.95)');
    spec.addColorStop(0.25, 'rgba(255,255,255,0.62)');
    spec.addColorStop(0.55, 'rgba(255,255,255,0.18)');
    spec.addColorStop(1,    'rgba(255,255,255,0)');

    ctx.beginPath();
    ctx.arc(cx - r * 0.08, cy - r * 0.16, r * 0.68, 0, Math.PI * 2);
    ctx.fillStyle = spec;
    ctx.fill();

    // ── Small bright inner highlight dot (top-left) ─────────────────────────
    const dot = ctx.createRadialGradient(
      cx - r * 0.38, cy - r * 0.42, 0,
      cx - r * 0.38, cy - r * 0.42, r * 0.24
    );
    dot.addColorStop(0, 'rgba(255,255,255,1.0)');
    dot.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.beginPath();
    ctx.arc(cx - r * 0.38, cy - r * 0.42, r * 0.24, 0, Math.PI * 2);
    ctx.fillStyle = dot;
    ctx.fill();

    // ── Bottom rim darkening (ambient occlusion feel) ───────────────────────
    const rim = ctx.createRadialGradient(cx, cy + r * 0.15, r * 0.4, cx, cy, r);
    rim.addColorStop(0, 'rgba(0,0,0,0)');
    rim.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = rim;
    ctx.fill();

    ct.refresh();
  }
}

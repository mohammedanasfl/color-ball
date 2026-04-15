/**
 * VictoryScene.js
 * Win screen — premium dark theme.
 */
class VictoryScene extends Phaser.Scene {
  constructor() {
    super({ key: 'VictoryScene' });
  }

  create(data) {
    const W  = CONSTANTS.GAME_WIDTH;
    const H  = CONSTANTS.GAME_HEIGHT;
    const sr   = data.scoreResult  || { base: 60, efficiency: 0, speed: 0, penalty: 0, total: 60, moveCount: 0, elapsedSec: 0 };
    const diff = data.difficulty || 'easy';

    // Persist best score
    const bestKey = `colorsort_best_${diff}`;
    const prev    = parseInt(localStorage.getItem(bestKey) || '0');
    const isNew   = sr.total > prev;
    if (isNew) localStorage.setItem(bestKey, String(sr.total));

    // Dark background
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x080d18, 0x080d18, 0x04080e, 0x04080e, 1);
    bg.fillRect(0, 0, W, H);

    // Radial glow at centre
    const glowFx = this.add.graphics();
    glowFx.fillStyle(0x6c5ce7, 0.07);
    glowFx.fillEllipse(W / 2, H / 2, 600, 380);
    glowFx.fillStyle(0x6c5ce7, 0.04);
    glowFx.fillEllipse(W / 2, H / 2, 800, 500);

    // Card
    const cardW = 360, cardH = 420;
    const cardX = W / 2 - cardW / 2;
    const cardY = H / 2 - cardH / 2;

    // Card outer glow
    const cardGlow = this.add.graphics();
    cardGlow.lineStyle(8, 0x6c5ce7, 0.10);
    cardGlow.strokeRoundedRect(cardX - 8, cardY - 8, cardW + 16, cardH + 16, 32);
    cardGlow.lineStyle(3, 0x6c5ce7, 0.20);
    cardGlow.strokeRoundedRect(cardX - 3, cardY - 3, cardW + 6, cardH + 6, 28);

    // Card body
    const card = this.add.graphics();
    card.fillStyle(0x0c1428, 0.96);
    card.fillRoundedRect(cardX, cardY, cardW, cardH, 24);
    card.lineStyle(1.5, 0x6c5ce7, 0.35);
    card.strokeRoundedRect(cardX, cardY, cardW, cardH, 24);
    // Card inner top highlight
    card.lineStyle(1, 0xffffff, 0.06);
    card.strokeRoundedRect(cardX + 1, cardY + 1, cardW - 2, 60, { tl: 23, tr: 23, bl: 0, br: 0 });

    // "PUZZLE SOLVED!" title
    this.add.text(W / 2, cardY + 36, 'PUZZLE SOLVED', {
      fontFamily: 'Orbitron, Outfit, sans-serif',
      fontSize:   '20px',
      fontStyle:  'bold',
      color:      '#c8bfff',
      letterSpacing: 3,
      shadow: { offsetX: 0, offsetY: 0, color: '#6c5ce7', blur: 18, fill: true },
    }).setOrigin(0.5);

    const difLabel = CONSTANTS.DIFFICULTY[diff].label;
    this.add.text(W / 2, cardY + 62, difLabel + ' Mode', {
      fontFamily: 'Outfit, sans-serif',
      fontSize:   '11px',
      color:      'rgba(162,155,254,0.45)',
      letterSpacing: 2,
    }).setOrigin(0.5);

    // Star rating
    const stars = sr.total >= 80 ? 3 : sr.total >= 50 ? 2 : 1;
    for (let s = 0; s < 3; s++) {
      const filled = s < stars;
      const sx     = W / 2 + (s - 1) * 46;
      const star   = this.add.text(sx, cardY + 100, '?', {
        fontFamily: 'Outfit, sans-serif',
        fontSize:   '34px',
        color:      filled ? '#FFD700' : '#1e2040',
        shadow: filled ? { offsetX: 0, offsetY: 0, color: '#ffb400', blur: 14, fill: true } : undefined,
      }).setOrigin(0.5).setAlpha(0);

      this.tweens.add({
        targets: star, alpha: 1, scaleX: 1.35, scaleY: 1.35,
        duration: 220, ease: 'Back.easeOut',
        delay: 280 + s * 120,
        onComplete: () => {
          this.tweens.add({ targets: star, scaleX: 1, scaleY: 1, duration: 100 });
        },
      });
    }

    if (isNew) {
      this.add.text(W / 2, cardY + 132, '? New Best Score!', {
        fontFamily: 'Outfit, sans-serif',
        fontSize:   '11px',
        color:      '#FFD700',
      }).setOrigin(0.5);
    }

    // Divider
    const topDivider = this.add.graphics();
    topDivider.lineStyle(1, 0xffffff, 0.07);
    topDivider.lineBetween(cardX + 28, cardY + 148, cardX + cardW - 28, cardY + 148);

    // Score rows
    const rows = [
      { label: 'Base Score',       value: sr.base,       color: '#a29bfe', sign: '+' },
      { label: 'Efficiency Bonus', value: sr.efficiency, color: '#00cec9', sign: '+' },
      { label: 'Speed Bonus',      value: sr.speed,      color: '#fdcb6e', sign: '+' },
      { label: 'Penalty',          value: sr.penalty,    color: '#e17055', sign: '-' },
    ];

    const rowStartY = cardY + 158;
    const rowH      = 36;

    rows.forEach((row, i) => {
      const ry = rowStartY + i * rowH;
      this.add.text(cardX + 28, ry + rowH / 2, row.label, {
        fontFamily: 'Outfit, sans-serif',
        fontSize:   '12.5px',
        color:      'rgba(200,195,255,0.55)',
      }).setOrigin(0, 0.5);

      const valText = this.add.text(cardX + cardW - 28, ry + rowH / 2, '0', {
        fontFamily: 'Outfit, sans-serif',
        fontSize:   '15px',
        fontStyle:  'bold',
        color:      row.color,
      }).setOrigin(1, 0.5);

      const finalVal = row.value;
      this.tweens.addCounter({
        from: 0, to: finalVal, duration: 600, ease: 'Cubic.easeOut',
        delay: 450 + i * 110,
        onUpdate: (t) => {
          const v = Math.round(t.getValue());
          valText.setText((row.sign === '-' && v > 0 ? '-' : '+') + v);
        },
      });
    });

    // Divider before total
    const divY = rowStartY + rows.length * rowH + 4;
    const div  = this.add.graphics();
    div.lineStyle(1, 0x6c5ce7, 0.28);
    div.lineBetween(cardX + 28, divY, cardX + cardW - 28, divY);

    // Total score
    this.add.text(cardX + 28, divY + 14, 'TOTAL', {
      fontFamily: 'Orbitron, Outfit, sans-serif',
      fontSize:   '10px',
      color:      'rgba(162,155,254,0.40)',
      letterSpacing: 3,
    });

    const totalText = this.add.text(cardX + cardW - 28, divY + 10, '0', {
      fontFamily: 'Outfit, sans-serif',
      fontSize:   '32px',
      fontStyle:  'bold',
      color:      '#c8bfff',
      shadow: { offsetX: 0, offsetY: 0, color: '#6c5ce7', blur: 16, fill: true },
    }).setOrigin(1, 0);

    this.tweens.addCounter({
      from: 0, to: sr.total, duration: 900, ease: 'Cubic.easeOut', delay: 750,
      onUpdate: (t) => { totalText.setText(Math.round(t.getValue())); },
    });

    this.add.text(cardX + cardW - 28, divY + 46, '/ 100', {
      fontFamily: 'Outfit, sans-serif',
      fontSize:   '11px',
      color:      'rgba(162,155,254,0.28)',
    }).setOrigin(1, 0);

    // Move + time stats
    const elapsed = sr.elapsedSec || 0;
    const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const ss = String(elapsed % 60).padStart(2, '0');
    this.add.text(W / 2, divY + 66, `${sr.moveCount} moves  ·  ${mm}:${ss}`, {
      fontFamily: 'Outfit, sans-serif',
      fontSize:   '11px',
      color:      'rgba(162,155,254,0.28)',
    }).setOrigin(0.5);

    // Buttons
    const btnY = cardY + cardH - 44;
    this._makeBtn(W / 2 - 84, btnY, 'Play Again', 0x6c5ce7, () => {
      this.cameras.main.fadeOut(260, 10, 12, 22);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('GameScene', { difficulty: diff });
      });
    });
    this._makeBtn(W / 2 + 84, btnY, '? Menu', 0x4a6fa5, () => {
      this.cameras.main.fadeOut(260, 10, 12, 22);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('MenuScene');
      });
    });

    // Confetti
    this._burstConfetti(W, H, 55);

    this.cameras.main.fadeIn(380, 10, 12, 22);
  }

  _makeBtn(cx, cy, label, color, onClick) {
    const bw = 140, bh = 40;
    const gfx = this.add.graphics();
    const draw = (fa, la) => {
      gfx.clear();
      gfx.fillStyle(color, fa);
      gfx.fillRoundedRect(cx - bw / 2, cy - bh / 2, bw, bh, 12);
      gfx.lineStyle(1.5, color, la);
      gfx.strokeRoundedRect(cx - bw / 2, cy - bh / 2, bw, bh, 12);
    };
    draw(0.14, 0.55);

    this.add.text(cx, cy, label, {
      fontFamily: 'Outfit, sans-serif',
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    const hit = this.add.rectangle(cx, cy, bw, bh, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerover',  () => draw(0.30, 0.85));
    hit.on('pointerout',   () => draw(0.14, 0.55));
    hit.on('pointerdown',  () => { AudioEngine.playSelectSound(); onClick(); });
  }

  _burstConfetti(W, H, count) {
    const cx      = W / 2;
    const cy      = H / 2;
    const palette = Object.values(CONSTANTS.BALL_COLORS);
    for (let i = 0; i < count; i++) {
      const info  = palette[Math.floor(Math.random() * palette.length)];
      const size  = 4 + Math.random() * 8;
      const piece = this.add.rectangle(
        cx + Phaser.Math.Between(-40, 40),
        cy - 30,
        size, size, info.hex
      ).setDepth(400);

      const angle = Math.random() * Math.PI * 2;
      const speed = 90 + Math.random() * 200;
      this.tweens.add({
        targets:  piece,
        x:        piece.x + Math.cos(angle) * speed,
        y:        piece.y + Math.sin(angle) * speed + 240,
        alpha:    0,
        angle:    Math.random() * 720 - 360,
        scaleX:   0.1,
        scaleY:   0.1,
        duration: 700 + Math.random() * 600,
        ease:     'Cubic.easeOut',
        delay:    Math.random() * 220,
        onComplete: () => piece.destroy(),
      });
    }
  }
}

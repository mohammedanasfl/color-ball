/**
 * main.js
 * Entry point — creates the Phaser.Game instance with all scenes registered.
 *
 * Phaser.Scale.FIT scales the 480×780 design canvas to fill any
 * viewport (phone, tablet, desktop) while preserving aspect ratio.
 * No physics engine is loaded — we use only Tweens and Graphics.
 */

/* global Phaser, BootScene, MenuScene, GameScene, VictoryScene */

const config = {
  type: Phaser.AUTO,          // WebGL → Canvas automatic fallback
  width:  900,
  height: 640,
  scale: {
    mode:       Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  backgroundColor: '#0a0a14',
  parent: 'game-container',
  scene: [BootScene, MenuScene, GameScene, VictoryScene],
  // No physics needed — pure Tween-based movement
};

const game = new Phaser.Game(config); // eslint-disable-line no-unused-vars

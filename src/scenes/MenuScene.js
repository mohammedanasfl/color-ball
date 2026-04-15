/**
 * MenuScene.js
 *
 * Architecture: thin Phaser scene + HTML/CSS overlay.
 *
 * The premium menu UI lives entirely in #menu-overlay (index.html + style.css).
 * This file has two responsibilities:
 *   1. _MenuOverlay — controls show/hide of the HTML overlay and bridges events to Phaser.
 *   2. MenuScene    — a minimal Phaser.Scene that invokes _MenuOverlay.show() on create().
 *
 * Flow:
 *   BootScene ? MenuScene.create() ? _MenuOverlay.show()
 *   Card click ? _MenuOverlay.hide() ? scene.start('GameScene', { difficulty })
 *   VictoryScene/GameScene ? scene.start('MenuScene') ? same flow repeats
 */

// -----------------------------------------------------------------------------
// HTML Overlay controller (module pattern, lives in global scope of this file)
// -----------------------------------------------------------------------------
const _MenuOverlay = (function () {

  let _el        = null;   // cached #menu-overlay DOM node
  let _onSelect  = null;   // callback(difficulty: string)

  // Lazy-init the overlay reference
  function _getEl() {
    if (!_el) _el = document.getElementById('menu-overlay');
    return _el;
  }

  // Pull best scores from localStorage and stamp them onto the badge elements
  function _refreshBadges() {
    ['easy', 'medium', 'hard'].forEach(function (diff) {
      const pts = parseInt(localStorage.getItem('colorsort_best_' + diff) || '0', 10);
      const el  = document.getElementById('badge-' + diff);
      if (el) el.textContent = pts > 0 ? ('Best: ' + pts + ' pts') : 'Not played yet';
    });
  }

  // Slide cards in with a staggered CSS-transition entrance.
  // Removes the class first (+ reflow) so the animation re-runs on every menu open.
  function _animateCards() {
    var wraps = _getEl().querySelectorAll('.card-wrap');
    wraps.forEach(function (wrap, i) {
      wrap.classList.remove('menu-enter');
      void wrap.offsetWidth; // force reflow ? resets transition from initial state
      setTimeout(function () {
        wrap.classList.add('menu-enter');
      }, 130 + i * 100);
    });
  }

  /**
   * Show the menu overlay.
   * @param {function(string): void} onSelect  Called with the chosen difficulty key.
   */
  function show(onSelect) {
    _onSelect = onSelect;
    _refreshBadges();

    // Wire card click handlers (assignment replaces any previous handler — no duplicates)
    _getEl().querySelectorAll('.dcard').forEach(function (card) {
      card.onclick = function (e) {
        e.preventDefault();
        var diff = card.dataset.difficulty;

        // Sound (guarded so it doesn't throw if AudioEngine isn't ready)
        try { AudioEngine.playSelectSound(); } catch (_) {}

        // Press-down feedback
        card.style.transform  = 'scale(0.955)';
        card.style.transition = 'transform 0.07s ease-in';

        setTimeout(function () {
          card.style.transform  = '';
          card.style.transition = '';

          // Fade overlay out, then hand off to Phaser
          hide();
          setTimeout(function () {
            if (_onSelect) _onSelect(diff);
          }, 360); // matches overlay CSS transition (0.38 s)
        }, 85);
      };
    });

    // Reveal overlay + run card entrance animations
    _getEl().classList.remove('menu-hidden');
    _animateCards();
  }

  /** Fade the overlay out (pointer-events disabled immediately via CSS). */
  function hide() {
    _getEl().classList.add('menu-hidden');
  }

  return { show: show, hide: hide };

})(); // _MenuOverlay


// -----------------------------------------------------------------------------
// MenuScene — thin Phaser wrapper
// -----------------------------------------------------------------------------
class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    // Dark solid background visible around the canvas edges (letterbox) —
    // matches the HTML overlay so it's seamless.
    this.cameras.main.setBackgroundColor('#0a0a14');

    // Show HTML overlay; when user picks a difficulty start the game scene.
    _MenuOverlay.show((difficulty) => {
      this.scene.start('GameScene', { difficulty });
    });
  }

  // Ensure the overlay is hidden whenever this scene is torn down
  // (covers edge-cases like scene.stop() calls).
  shutdown() {
    _MenuOverlay.hide();
  }
}

/**
 * audio.js
 * Zero-dependency Web Audio API synthesizer for Colour Sort Puzzle.
 * All sounds are procedurally generated — no external .mp3 files required.
 */
window.AudioEngine = (function () {
  let ctx = null;

  function getCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  /**
   * Plays a clean sine-based note.
   * @param {number} freq - Frequency in Hz
   * @param {number} duration - Duration in seconds
   * @param {number} volume - Peak gain (0–1)
   * @param {'sine'|'triangle'|'square'} type - Waveform
   */
  function playTone(freq, duration, volume, type = 'sine') {
    try {
      const c   = getCtx();
      const osc = c.createOscillator();
      const env = c.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, c.currentTime);

      env.gain.setValueAtTime(0, c.currentTime);
      env.gain.linearRampToValueAtTime(volume, c.currentTime + 0.01);
      env.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);

      osc.connect(env);
      env.connect(c.destination);
      osc.start(c.currentTime);
      osc.stop(c.currentTime + duration + 0.02);
    } catch (_) { /* Audio not available */ }
  }

  /**
   * Soft 'click' when a tube is selected.
   */
  function playSelectSound() {
    playTone(600, 0.06, 0.15, 'sine');
  }

  /**
   * Satisfying 'bloop' drop on successful ball placement.
   */
  function playDropSound() {
    try {
      const c   = getCtx();
      const osc = c.createOscillator();
      const env = c.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(480, c.currentTime);
      osc.frequency.exponentialRampToValueAtTime(210, c.currentTime + 0.12);

      env.gain.setValueAtTime(0, c.currentTime);
      env.gain.linearRampToValueAtTime(0.28, c.currentTime + 0.01);
      env.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.14);

      osc.connect(env);
      env.connect(c.destination);
      osc.start(c.currentTime);
      osc.stop(c.currentTime + 0.18);
    } catch (_) {}
  }

  /**
   * Dull buzz for invalid moves.
   */
  function playErrorSound() {
    try {
      const c   = getCtx();
      const osc = c.createOscillator();
      const env = c.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, c.currentTime);
      osc.frequency.linearRampToValueAtTime(95, c.currentTime + 0.18);

      env.gain.setValueAtTime(0.22, c.currentTime);
      env.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.18);

      osc.connect(env);
      env.connect(c.destination);
      osc.start(c.currentTime);
      osc.stop(c.currentTime + 0.22);
    } catch (_) {}
  }

  /**
   * Ascending arpeggio chord on win.
   */
  function playWinSound() {
    const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 0.5, 0.18, 'sine'), i * 110);
    });
  }

  /**
   * Subtle chime when a tube is fully sorted.
   */
  function playSortedSound() {
    [880, 1108].forEach((freq, i) => {
      setTimeout(() => playTone(freq, 0.3, 0.14, 'sine'), i * 80);
    });
  }

  return {
    playSelectSound,
    playDropSound,
    playErrorSound,
    playWinSound,
    playSortedSound,
  };
})();

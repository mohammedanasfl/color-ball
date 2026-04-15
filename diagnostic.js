/**
 * diagnostic.js
 * Copy-paste this into the browser console (F12 → Console) while the game
 * is loaded at http://localhost:8080 to verify all systems are working.
 *
 * Run AFTER the game has loaded (you should see the Menu screen).
 */
(function runDiagnostic() {
  const results = [];
  const ok  = (msg) => results.push(`✅ ${msg}`);
  const err = (msg) => results.push(`❌ ${msg}`);
  const warn= (msg) => results.push(`⚠️  ${msg}`);

  // 1. Check global modules loaded
  ['CONSTANTS','AudioEngine','MoveEngine','PuzzleGenerator','ScoreEngine',
   'AnimationEngine','TubeRenderer'].forEach(mod => {
    if (window[mod]) ok(`${mod} loaded`);
    else err(`${mod} MISSING`);
  });

  // 2. Check Phaser
  if (window.Phaser && Phaser.VERSION) ok(`Phaser ${Phaser.VERSION}`);
  else err('Phaser NOT loaded');

  // 3. Check CONSTANTS values
  const C = window.CONSTANTS;
  if (C) {
    ok(`GAME canvas: ${C.GAME_WIDTH}×${C.GAME_HEIGHT}`);
    ok(`BALL_COLORS: ${Object.keys(C.BALL_COLORS).length} colours defined`);
    ['easy','medium','hard'].forEach(d => {
      const cfg = C.DIFFICULTY[d];
      if (cfg) ok(`Difficulty.${d}: n=${cfg.n}, tubes=${cfg.n+1}`);
      else err(`Difficulty.${d} MISSING`);
    });
  }

  // 4. Test MoveEngine with a solved state
  if (window.MoveEngine) {
    const tubes = [
      [1,1,1,1], [2,2,2,2], [3,3,3,3], [4,4,4,4], [0,0,0,0]
    ];
    const solved = MoveEngine.isBoardSolved(tubes, 4);
    if (solved) ok('MoveEngine.isBoardSolved() → true for solved state');
    else err('MoveEngine.isBoardSolved() returned false on solved state!');

    // unsolved state should not be solved
    const scrambled = [[1,2,1,2],[2,1,2,1],[3,3,3,3],[4,4,4,4],[0,0,0,0]];
    const notSolved = !MoveEngine.isBoardSolved(scrambled, 4);
    if (notSolved) ok('MoveEngine.isBoardSolved() → false for scrambled state');
    else err('MoveEngine.isBoardSolved() returned true on scrambled state!');

    // canMove test
    const can = MoveEngine.canMove(0, 4, tubes, 4); // move from solved tube → blocked
    if (!can) ok('MoveEngine.canMove() blocks moving from solved tube');
    else warn('MoveEngine.canMove() allowed move from solved tube (unexpected)');
  }

  // 5. Test PuzzleGenerator
  if (window.PuzzleGenerator) {
    ['easy','medium','hard'].forEach(diff => {
      try {
        const p = PuzzleGenerator.generate(diff, 42);
        const n = p.colors;
        const totalBalls = p.tubes.reduce((s, t) => s + t.filter(b => b !== 0).length, 0);
        const expected   = n * n;
        if (totalBalls === expected)
          ok(`PuzzleGenerator.generate('${diff}') → ${p.tubes.length} tubes, ${totalBalls}/${expected} balls`);
        else
          err(`PuzzleGenerator.generate('${diff}') ball count mismatch: ${totalBalls} ≠ ${expected}`);

        // Verify invariants
        if (p.tubes.length === n + 1) ok(`  tube count n+1 = ${p.tubes.length} ✓`);
        else err(`  tube count wrong: ${p.tubes.length} ≠ ${n+1}`);

        if (p.capacity === n) ok(`  capacity = n = ${p.capacity} ✓`);
        else err(`  capacity ${p.capacity} ≠ n ${n}`);

        // Count each colour
        const counts = {};
        p.tubes.forEach(t => t.forEach(b => { if (b) counts[b] = (counts[b]||0)+1; }));
        const allN = Object.values(counts).every(c => c === n);
        if (allN) ok(`  each colour appears exactly ${n} times ✓`);
        else err(`  colour counts: ${JSON.stringify(counts)} (expected all ${n})`);

      } catch(e) {
        err(`PuzzleGenerator.generate('${diff}') threw: ${e.message}`);
      }
    });
  }

  // 6. Test ScoreEngine
  if (window.ScoreEngine) {
    const se = ScoreEngine.create(20, 'easy');
    se.recordMove(); se.recordMove(); se.recordMove();
    se.recordUndo();
    const live = se.liveScore();
    if (live > 0) ok(`ScoreEngine live score: ${live}`);
    else warn(`ScoreEngine live score unexpectedly 0`);
    if (se.moveCount === 2) ok(`ScoreEngine move count after 3 moves + 1 undo = 2 ✓`);
    else err(`ScoreEngine move count = ${se.moveCount}, expected 2`);
  }

  // 7. Check ball textures in Phaser cache
  if (window.game && game.textures) {
    const keys = game.textures.getTextureKeys();
    const ballKeys = keys.filter(k => k.startsWith('ball_'));
    if (ballKeys.length >= 5)
      ok(`Ball textures in cache: ${ballKeys.join(', ')}`);
    else
      err(`Only ${ballKeys.length} ball textures found (expected ≥5): ${ballKeys.join(', ')}`);
  } else {
    warn('window.game not available — run this after Phaser initialises');
  }

  // Print results
  console.log('\n═══════════════════════════════════════');
  console.log('   COLOUR SORT — DIAGNOSTIC REPORT');
  console.log('═══════════════════════════════════════');
  results.forEach(r => console.log(r));
  const fails = results.filter(r => r.startsWith('❌')).length;
  console.log('───────────────────────────────────────');
  console.log(fails === 0
    ? `🎉 All checks passed! (${results.length} checks)`
    : `⚠️  ${fails} check(s) FAILED`);
  console.log('═══════════════════════════════════════\n');

  return results;
})();

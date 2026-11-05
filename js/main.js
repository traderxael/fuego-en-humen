(function () {
  const canvas = document.getElementById('game-canvas');

  const state = createGameState();
  // Debug globals only under ?debug=1 (headless smoke + later tasks).
  const DEBUG_MODE = window.location && /[?&]debug=1\b/.test(window.location.search);
  if (DEBUG_MODE) window.__state = state;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  // Camera children (viewmodel) only render if the camera is in the scene graph.
  scene.add(camera);

  const renderer = new THREE.WebGLRenderer({ canvas: canvas });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const world = buildWorld(scene);

  // Shared enemies array: passed to the player (raycast/melee targets) and
  // filled by Enemies.spawnWave / maintained by Enemies.updateEnemies.
  const enemies = [];
  if (DEBUG_MODE) window.__enemies = enemies; // debug only: smoke tests / debugging

  // Player spawns inside the fort, looking north toward the sea/beach/ships.
  // (createPlayer owns the camera transform: eyes at 1.7 m, yaw 0 = -Z.)
  const player = createPlayer(camera, canvas, {
    state: state,
    enemies: enemies,
    onEnemyHit: function (enemy) {
      Enemies.flashEnemy(enemy);
      HUD.flashHit(); // brief white flash at the crosshair
    },
  });

  // Wave 1 is on the beach from the start (phase stays 'menu' until the user
  // clicks into pointer lock, at which point the game begins).
  Enemies.spawnWave(scene, WAVES[0], enemies, 1);

  // Lightweight cached HUD repaint for playerHp / fortIntegrity — the spans are
  // also written by js/player.js, we only touch them when the value changed.
  const hudHealth = document.getElementById('hud-health');
  const hudFort = document.getElementById('hud-fort');
  let lastHudHp = null;
  let lastHudFort = null;
  function refreshHud() {
    const hp = state.playerHp;
    if (hp !== lastHudHp) {
      lastHudHp = hp;
      if (hudHealth) hudHealth.textContent = 'HP ' + hp;
    }
    const fort = state.fortIntegrity;
    if (fort !== lastHudFort) {
      lastHudFort = fort;
      if (hudFort) hudFort.textContent = 'Fuerte ' + fort;
    }
  }

  // Both damage-to-fort channels end in this one path.
  const fortDamaged = function (dmg) {
    applyWaveDamage(state, dmg);
    refreshHud();
  };
  const playerDamaged = function (dmg) {
    applyPlayerDamage(state, dmg);
    refreshHud();
  };

  const enemyCallbacks = {
    onEnemyDamagePlayer: playerDamaged,
    // Artillery (and fallback channel for soldier melee if onEnemyReachWall is
    // absent): raw fort damage.
    onEnemyDamageFort: fortDamaged,
    // Soldier reached the parapet plane and melee'd it: route through the same
    // fort-damage path.
    onEnemyReachWall: function (enemy) {
      const dmg = (enemy && enemy.userData && enemy.userData.damage) || 10;
      fortDamaged(dmg);
    },
    onEnemyKilled: function () { state.score = (state.score || 0) + 100; },
  };

  // --- Menu start + end-of-game screens ---
  function exitPointerLockSafe() {
    try {
      if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
    } catch (e) { /* headless / unsupported */ }
  }
  function hidePauseOverlay() {
    const overlay = document.getElementById('pause-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  const btnPlay = document.getElementById('btn-play');
  if (btnPlay) {
    btnPlay.addEventListener('click', function () {
      Screens.hideMenu();
      hidePauseOverlay();
      HUD.show();
      setPhase(state, 'playing'); // menu -> playing; onLockChange also asserts this
      Screens.showIntroToast();
      try {
        const p = canvas.requestPointerLock();
        if (p && typeof p.catch === 'function') p.catch(function () { /* headless / cooldown */ });
      } catch (e) { /* pointer lock unavailable (e.g. headless) */ }
    });
  }

  // React to phase flips (victory/defeat can happen mid-frame inside
  // updateEnemies/nextWave). Defeat cause is read at the flip, when we can
  // still tell which pool hit 0.
  let lastPhase = state.phase;
  function onPhaseChanged(now) {
    if (now === 'playing') {
      Screens.hideMenu();
      HUD.show();
      return;
    }
    if (now === 'victory') {
      HUD.hide();
      hidePauseOverlay();
      exitPointerLockSafe();
      Screens.showVictory({ wavesRepelled: WAVES.length, score: state.score || 0 });
      return;
    }
    if (now === 'defeat') {
      HUD.hide();
      hidePauseOverlay();
      exitPointerLockSafe();
      Screens.showDefeat(Screens.detectDefeatCause(state));
    }
  }

  let lastTime = performance.now();
  function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    player.update(dt);

    if (state.phase === 'playing') {
      // Enemy AI + spawn trickle; also detects a cleared wave and advances.
      Enemies.updateEnemies(dt, player, world, enemyCallbacks);

      // Re-check phase: an enemy may have flipped it to 'defeat' mid-frame.
      if (state.phase === 'playing' && Enemies.pendingSpawns() === 0 && enemies.length === 0) {
        const prevWave = state.wave;
        nextWave(state); // wave 3 clear -> phase 'victory'
        if (state.phase === 'playing' && state.wave !== prevWave) {
          Enemies.spawnWave(scene, WAVES[state.wave - 1], enemies, state.wave);
        }
      }
    }

    // Bars/counters/hit-marker-adjacent readout (cached; writes DOM on change only).
    HUD.updateHUD(state);
    if (state.phase !== lastPhase) {
      lastPhase = state.phase;
      onPhaseChanged(state.phase);
    }

    // Gentle sea bob so the deck doesn't feel static (ships only).
    world.ships.forEach((ship, i) => {
      const baseY = ship.userData.baseY !== undefined ? ship.userData.baseY : 0;
      ship.position.y = baseY + Math.sin(now / 1400 + i * 1.3) * 0.18;
    });
    // Always render — when paused the world stays visible behind the overlay.
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
})();

(function () {
  const canvas = document.getElementById('game-canvas');

  const state = createGameState();
  // Debug globals only under ?debug=1 (headless smoke + verification).
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const world = buildWorld(scene);

  // Effects and the rigid-body world are created before the player/enemies:
  // both modules need them, and the physics owns the shared player body.
  const effects = Effects.create(scene, camera);
  const physics = GamePhysics.create(scene, world, effects);
  Enemies.bindPhysics(physics);

  // Shared enemies array: passed to the player and filled by Enemies.
  const enemies = [];
  if (DEBUG_MODE) window.__enemies = enemies;

  function sfxCall(name) {
    if (typeof sfx !== 'undefined' && sfx && typeof sfx[name] === 'function') {
      try { sfx[name](); } catch (e) { /* audio is non-critical */ }
    }
  }

  // Projectiles (physics) call with (enemy, damage, point, dir, kind);
  // the player's melee calls with (enemy, damage, weaponKey, dir, point).
  // Both end in Enemies.applyHit, which owns hp, flash, stagger and knockback.
  function handleEnemyHit(enemy, damage, third, fourth, fifth) {
    let dir;
    let point;
    let kind;
    if (typeof third === 'string') {
      kind = third === 'sable' ? 'sable' : 'musket';
      dir = fourth;
      point = fifth;
    } else {
      point = third;
      dir = fourth;
      kind = fifth || 'musket';
    }
    if (!Enemies.applyHit(enemy, damage, dir, point, kind)) return;
    HUD.flashHit();
    if (kind !== 'cannon') sfxCall('hit');
  }

  const player = createPlayer(camera, canvas, {
    state: state,
    enemies: enemies,
    physics: physics,
    effects: effects,
    world: world,
    onEnemyHit: handleEnemyHit,
  });

  // Wave 1 is on the beach from the start (phase stays 'menu' until the user
  // clicks into pointer lock, at which point the game begins).
  Enemies.spawnWave(scene, WAVES[0], enemies, 1);

  // Both damage-to-fort channels end in this one path.
  const fortDamaged = function (dmg) {
    applyWaveDamage(state, dmg);
  };
  const playerDamaged = function (dmg) {
    applyPlayerDamage(state, dmg);
  };

  const enemyCallbacks = {
    effects: effects,
    onEnemyDamagePlayer: function (dmg) {
      playerDamaged(dmg);
      HUD.flashDamage();
      if (effects) effects.addShake(0.18);
      sfxCall('hit');
    },
    onEnemyDamageFort: fortDamaged,
    onEnemyReachWall: function (enemy) {
      const dmg = (enemy && enemy.userData && enemy.userData.damage) || 10;
      fortDamaged(dmg);
    },
    onEnemyKilled: function (enemy) {
      state.score = (state.score || 0) + 100;
      if (enemy && enemy.userData && enemy.userData.kind === 'artillery') {
        if (effects) {
          effects.explosion({ x: enemy.position.x, y: 0.9, z: enemy.position.z });
          effects.addShake(0.25);
        }
        sfxCall('explosion');
      }
    },
  };

  // Physics owns projectile/explosion damage routing. Enemy cannonballs hurt
  // the fort only when they land inside its footprint (see GamePhysics).
  const physicsCtx = {
    onEnemyHit: handleEnemyHit,
    onPlayerHit: function (damage, point, kind) {
      playerDamaged(damage);
      HUD.flashDamage();
      if (effects) effects.addShake(kind === 'cannon' ? 0.55 : 0.14);
      sfxCall('hit');
    },
    onWorldImpact: function () { /* visuals are owned by js/effects.js */ },
    onExplosion: function () {
      sfxCall('explosion');
    },
    onFortImpact: function (damage, point) {
      fortDamaged(damage);
      if (effects) effects.addShake(0.3);
    },
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

  // Wave horn: exactly once per wave.
  let hornWave = 0;
  function playWaveHorn() {
    if (state.wave === hornWave) return;
    hornWave = state.wave;
    sfxCall('waveHorn');
  }

  const btnPlay = document.getElementById('btn-play');
  if (btnPlay) {
    btnPlay.addEventListener('click', function () {
      sfxCall('unlock'); // AudioContext must be created/resumed inside this gesture
      sfxCall('ambientSea');
      sfxCall('music'); // "Al otro lado del río" — assets/audio/al_otro_lado_del_rio.mp3
      Screens.hideMenu();
      hidePauseOverlay();
      HUD.show();
      setPhase(state, 'playing');
      playWaveHorn();
      Screens.showIntroToast();
      try {
        const p = canvas.requestPointerLock();
        if (p && typeof p.catch === 'function') p.catch(function () { /* headless / cooldown */ });
      } catch (e) { /* pointer lock unavailable (e.g. headless) */ }
    });
  }

  const btnMusic = document.getElementById('btn-music');
  function syncMusicButton() {
    if (!btnMusic) return;
    var muted = false;
    try { if (typeof sfx !== 'undefined' && sfx && typeof sfx.isMuted === 'function') muted = sfx.isMuted(); } catch (e) {}
    btnMusic.textContent = muted ? '♪ Música: Silenciada (M)' : '♪ Música: Al otro lado del río (M)';
    btnMusic.setAttribute('aria-pressed', muted ? 'true' : 'false');
    btnMusic.style.opacity = muted ? '0.65' : '1';
  }
  if (btnMusic) {
    btnMusic.addEventListener('click', function (ev) {
      if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
      sfxCall('unlock');
      sfxCall('toggleMusic');
      syncMusicButton();
    });
  }
  window.addEventListener('keydown', function (e) { if (e.code === 'KeyM') { sfxCall('unlock'); sfxCall('toggleMusic'); syncMusicButton(); } });
  try { state.missionTitle = 'Humen, 1841'; } catch (e) {}
  syncMusicButton();

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
      sfxCall('victory');
      Screens.showVictory({ wavesRepelled: WAVES.length, score: state.score || 0 });
      return;
    }
    if (now === 'defeat') {
      HUD.hide();
      hidePauseOverlay();
      exitPointerLockSafe();
      sfxCall('defeat');
      Screens.showDefeat(Screens.detectDefeatCause(state));
    }
  }

  let lastTime = performance.now();
  function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    // 1. Player input -> body velocity + weapon fire (spawns projectiles).
    player.update(dt);

    if (state.phase === 'playing') {
      // 2. Enemy AI -> body velocities + enemy fire.
      Enemies.updateEnemies(dt, player, world, enemyCallbacks);
      // 3. Rigid bodies, projectiles, impacts, corpses.
      physics.step(dt, physicsCtx);
      // 4. Particles and camera shake decay.
      if (effects) effects.update(dt);
      // 5. Camera from the post-step body position.
      player.syncCamera(dt);

      // Wave-clear detection after the physics step so the last corpse does
      // not block the advance.
      if (state.phase === 'playing' && Enemies.pendingSpawns() === 0 && enemies.length === 0) {
        const prevWave = state.wave;
        nextWave(state);
        if (state.phase === 'playing' && state.wave !== prevWave) {
          Enemies.spawnWave(scene, WAVES[state.wave - 1], enemies, state.wave);
          playWaveHorn();
        }
      }
    } else {
      // Menu/paused: the world is frozen, but the camera still follows the
      // settled body so the menu shows the fort from eye height.
      player.syncCamera(dt);
    }

    HUD.updateHUD(state);
    if (state.phase !== lastPhase) {
      lastPhase = state.phase;
      onPhaseChanged(state.phase);
    }

    // Gentle sea bob so the ships do not feel static (ships only).
    world.ships.forEach(function (ship, i) {
      const baseY = ship.userData.baseY !== undefined ? ship.userData.baseY : 0;
      ship.position.y = baseY + Math.sin(now / 1400 + i * 1.3) * 0.18;
    });

    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  if (DEBUG_MODE) {
    window.__player = player;
    window.__physics = physics;
    window.__effects = effects;
    window.__camera = camera;
    window.__world = world;
    window.__game = {
      state: state,
      player: player,
      physics: physics,
      effects: effects,
      enemies: enemies,
      world: world,
      camera: camera,
      scene: scene,
      renderer: renderer,
      WAVES: WAVES,
    };
  }
})();

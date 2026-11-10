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
    // Allied fire kills on its own: no crosshair marker, no hit tick, no score.
    if (kind === 'ally') return;
    HUD.flashHit();
    if (kind !== 'cannon') sfxCall('hit');
  }

  const allies = (typeof Allies !== 'undefined' && Allies)
    ? Allies.create({ world: world, physics: physics, effects: effects, sfxCall: sfxCall })
    : null;

  const player = createPlayer(camera, canvas, {
    state: state,
    enemies: enemies,
    physics: physics,
    effects: effects,
    world: world,
    onEnemyHit: handleEnemyHit,
    canStart: function () { return missionStarted; },
  });

  // --- Mission flow ------------------------------------------------------
  const MISSION = (typeof CAMPAIGN !== 'undefined' && CAMPAIGN.mission) ? CAMPAIGN.mission : null;
  const SCORE_CFG = (typeof SCORE !== 'undefined') ? SCORE : {
    rifleman: 100, marine: 175, officer: 400, artillery: 250,
    streakWindow: 6, streakStep: 0.25, streakMax: 3, signalKey: 'KeyG',
  };

  let missionStarted = false;
  let streak = 1;
  let streakTimer = 0;
  let signalsUsed = {};
  let beatIndex = 0;
  let pendingBeats = [];

  function setWorldVisible(v) {
    if (world.group) world.group.visible = v;
    for (var i = 0; i < enemies.length; i++) {
      if (enemies[i]) enemies[i].visible = v;
    }
    if (player.viewmodel) player.viewmodel.visible = v;
  }

  function exitPointerLockSafe() {
    try {
      if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
    } catch (e) { /* headless / unsupported */ }
  }
  function hidePauseOverlay() {
    const overlay = document.getElementById('pause-overlay');
    if (overlay) overlay.style.display = 'none';
  }
  function requestPointerLock() {
    try {
      const p = canvas.requestPointerLock();
      if (p && typeof p.catch === 'function') p.catch(function () { /* headless / cooldown */ });
    } catch (e) { /* pointer lock unavailable (e.g. headless) */ }
  }

  // --- Historical beats and radio ---------------------------------------
  const firedBeats = {};
  // Phase checkpoint: a defeat resumes from the start of the current wave.
  function checkpointStorage() {
    try { return (typeof window !== 'undefined') ? window.localStorage : null; } catch (error) { return null; }
  }
  function saveCheckpoint() {
    if (typeof CheckpointLogic === 'undefined') return;
    CheckpointLogic.save(checkpointStorage(), {
      wave: state.wave,
      hp: state.playerHp,
      fort: state.fortIntegrity,
      score: state.score || 0,
    });
  }
  function clearCheckpoint() {
    if (typeof CheckpointLogic === 'undefined') return;
    CheckpointLogic.clear(checkpointStorage());
  }
  function restoreCheckpoint() {
    if (typeof CheckpointLogic === 'undefined') return false;
    var checkpoint = CheckpointLogic.load(checkpointStorage());
    if (!checkpoint) return false;
    state.wave = checkpoint.wave;
    state.playerHp = checkpoint.hp;
    state.fortIntegrity = checkpoint.fort;
    state.score = checkpoint.score;
    return true;
  }

  function triggerBeat(id) {
    if (!MISSION || !MISSION.beats) return;
    if (firedBeats[id]) return;
    firedBeats[id] = true;
    for (var i = 0; i < MISSION.beats.length; i++) {
      var beat = MISSION.beats[i];
      if (beat.id !== id) continue;
      HUD.showBeat(beat, 11);
      var radio = radioFor(id);
      if (radio) HUD.showRadio(radio.speaker, radio.text, 7);
      return;
    }
  }

  function radioFor(id) {
    if (!MISSION || !MISSION.radio) return null;
    for (var i = 0; i < MISSION.radio.length; i++) {
      if (MISSION.radio[i].id === id) return MISSION.radio[i];
    }
    return null;
  }

  function playRadio(id) {
    var radio = radioFor(id);
    if (radio) HUD.showRadio(radio.speaker, radio.text, 7);
  }

  // --- Scoring -----------------------------------------------------------
  function addScore(points, label) {
    var base = points || 100;
    var gained = Math.round(base * streak);
    state.score = (state.score || 0) + gained;
    return gained;
  }

  function bumpStreak() {
    streak = Math.min(SCORE_CFG.streakMax || 3, streak + (SCORE_CFG.streakStep || 0.25));
    streakTimer = SCORE_CFG.streakWindow || 6;
    HUD.setStreak(streak);
  }

  function decayStreak(dt) {
    if (streakTimer > 0) {
      streakTimer -= dt;
      if (streakTimer <= 0 && streak > 1) {
        streak = 1;
        HUD.setStreak(streak);
      }
    }
  }

  // --- Signals (call for support) ---------------------------------------
  function availableSignal() {
    if (!MISSION || !MISSION.signals) return null;
    var best = null;
    for (var i = 0; i < MISSION.signals.length; i++) {
      var sig = MISSION.signals[i];
      if (signalsUsed[sig.id]) continue;
      if ((state.score || 0) >= sig.cost && !best) best = sig;
    }
    return best;
  }

  function refreshSignalPrompt() {
    var sig = availableSignal();
    if (!sig) {
      HUD.showSignal(null);
      return;
    }
    HUD.showSignal(
      '<b>' + (SCORE_CFG.signalKey === 'KeyG' ? 'G' : SCORE_CFG.signalKey) + '</b> — ' +
      sig.label + ' <span style="opacity:.7">(' + sig.cost + ' pts)</span>'
    );
  }

  function useSignal() {
    var sig = availableSignal();
    if (!sig || state.phase !== 'playing') return false;
    signalsUsed[sig.id] = true;
    state.score = Math.max(0, (state.score || 0) - sig.cost);
    HUD.showRadio('Cuartel general', sig.text, 7);
    sfxCall('unlock');
    if (sig.id === 'reparar') {
      state.fortIntegrity = Math.min(100, state.fortIntegrity + 25);
    } else if (sig.id === 'municion') {
      if (player.refillAmmo) player.refillAmmo();
    } else if (sig.id === 'fuego') {
      // A reserve gun: a shell lands in the courtyard.
      if (effects) {
        effects.explosion({ x: 0, y: 1, z: 12 });
        effects.addShake(0.4);
      }
      sfxCall('explosion');
    }
    refreshSignalPrompt();
    return true;
  }

  // --- Cinematics --------------------------------------------------------
  function setViewmodelVisible(v) {
    if (player && player.viewmodel) player.viewmodel.visible = v;
  }

  function playCinematic(id, opts) {
    opts = opts || {};
    setWorldVisible(false);
    setViewmodelVisible(false);
    HUD.hide();
    hidePauseOverlay();
    exitPointerLockSafe();
    var ok = Cinematics.start(id, {
      scene: scene,
      camera: camera,
      effects: effects,
      waitForInput: !!opts.waitForInput,
      continueText: opts.continueText,
      onEnd: function () {
        setWorldVisible(true);
        setViewmodelVisible(true);
        if (opts.onEnd) opts.onEnd();
      },
    });
    if (!ok) {
      setWorldVisible(true);
      setViewmodelVisible(true);
      if (opts.onEnd) opts.onEnd();
    }
    return ok;
  }

  function beginMission() {
    missionStarted = true;
    HUD.show();
    setPhase(state, 'playing');
    requestPointerLock();
    var resumed = restoreCheckpoint();
    if (!enemies.length) Enemies.spawnWave(scene, WAVES[state.wave - 1], enemies, state.wave);
    if (state.wave === 1) {
      triggerBeat('landing');
      playRadio('start');
    } else if (resumed) {
      HUD.showRadio('Punto de control', 'Fase ' + state.wave + ' de ' + WAVES.length + ' · ' + (WAVES[state.wave - 1].phase || ''), 4);
    }
    saveCheckpoint();
    refreshSignalPrompt();
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
      if (MISSION) Screens.showBriefing(MISSION);
      else beginMission();
    });
  }

  const btnDeploy = document.getElementById('btn-deploy');
  if (btnDeploy) {
    btnDeploy.addEventListener('click', function () {
      sfxCall('unlock');
      Screens.hideBriefing();
      // The historical prologue, then the wall.
      playCinematic('humen-1839', {
        waitForInput: true,
        continueText: 'Pulsa para tomar la muralla',
        onEnd: function () {
          beginMission();
        },
      });
    });
  }

  const btnBack = document.getElementById('btn-back');
  if (btnBack) {
    btnBack.addEventListener('click', function () {
      Screens.hideBriefing();
      Screens.showMenu();
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
  window.addEventListener('keydown', function (e) {
    if (e.code === 'KeyM') { sfxCall('unlock'); sfxCall('toggleMusic'); syncMusicButton(); }
    if (e.code === (SCORE_CFG.signalKey || 'KeyG') && state.phase === 'playing') {
      if (useSignal()) e.preventDefault();
    }
  });
  try { state.missionTitle = 'Humen, 1841'; } catch (e) {}
  syncMusicButton();

  // A click or a key confirms the end of a cinematic.
  function confirmCinematic() {
    if (!Cinematics.isActive()) return;
    if (Cinematics.confirm()) {
      setWorldVisible(true);
      setViewmodelVisible(true);
    }
  }
  window.addEventListener('keydown', confirmCinematic);
  window.addEventListener('mousedown', confirmCinematic);
  // While a cinematic owns the screen, clicks confirm it but must not reach
  // the canvas: its click handler requests pointer lock, which would start the
  // mission before beginMission() (no wave, no checkpoint).
  window.addEventListener('click', function (ev) {
    if (typeof Cinematics === 'undefined' || !Cinematics.isActive()) return;
    ev.stopPropagation();
    confirmCinematic();
  }, true);


  // The static GLB replaces the primitive soldier as soon as it decodes; when
  // the page is opened from file:// the fetch fails and the primitives stay.
  Models.loadBritishSoldierModel('assets/models/soldado-britanico-1841-rigged.glb', function () {
    Enemies.refreshSoldierVisuals(enemies);
  });

  // Both damage-to-fort channels end in this one path.
  const fortDamaged = function (dmg) {
    applyWaveDamage(state, dmg);
    if (state.fortIntegrity <= 50 && state.fortIntegrity > 0) playRadio('lowFort');
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
      const u = (enemy && enemy.userData) || {};
      const friendly = u.lastHitKind === 'ally';
      if (!friendly) {
        const base = u.kind === 'artillery' ? (SCORE_CFG.artillery || 250) : (u.score || SCORE_CFG.rifleman || 100);
        const gained = addScore(base);
        bumpStreak();
        refreshSignalPrompt();
        HUD.showRadio('Parte de bajas', '+' + gained + ' puntos (x' + streak.toFixed(2) + ')', 3);
      }
      if (u.kind === 'artillery') {
        triggerBeat('artillery');
        if (effects) {
          effects.explosion({ x: enemy.position.x, y: 0.9, z: enemy.position.z });
          effects.addShake(0.25);
        }
        sfxCall('explosion');
      } else if (!friendly && u.archetype === 'officer') {
        triggerBeat('officer');
        playRadio('officer');
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

  let lastPhase = state.phase;
  function onPhaseChanged(now) {
    if (now === 'playing') {
      Screens.hideMenu();
      HUD.show();
      return;
    }
    if (now === 'victory') {
      clearCheckpoint();
      HUD.hide();
      hidePauseOverlay();
      exitPointerLockSafe();
      sfxCall('victory');
      // The honest ending: the fort falls on 26 February 1841.
      playCinematic('humen-fall', {
        waitForInput: true,
        continueText: 'Pulsa para cerrar el parte',
        onEnd: function () {
          Screens.showVictory({ wavesRepelled: WAVES.length, score: state.score || 0 });
        },
      });
      return;
    }
    if (now === 'defeat') {
      HUD.hide();
      hidePauseOverlay();
      exitPointerLockSafe();
      sfxCall('defeat');
      var cause = Screens.detectDefeatCause(state);
      Screens.showDefeat(cause);
    }
  }

  let lastTime = performance.now();
  function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    // 0. Cinematics own the camera and the scene.
    if (Cinematics.isActive()) {
      Cinematics.update(dt);
      if (effects) effects.update(dt);
      renderer.render(scene, camera);
      return;
    }

    // 1. Player input -> body velocity + weapon fire (spawns projectiles).
    player.update(dt);

    if (state.phase === 'playing') {
      // 2. Enemy AI -> body velocities + enemy fire.
      Enemies.updateEnemies(dt, player, world, enemyCallbacks);
      // 2b. Qing garrison picks targets, animates and fires.
      if (allies) allies.update(dt, player, state.time);
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
          if (state.wave === 2) triggerBeat('artillery');
          if (state.wave === 3) {
            triggerBeat('assault');
            playRadio('wave3');
          }
          saveCheckpoint();
          refreshSignalPrompt();
        }
      }

      decayStreak(dt);
      HUD.tickTimers(dt);
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
    if (typeof world.update === 'function') world.update(now / 1000);

    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  if (DEBUG_MODE) {
    window.__allies = allies;
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
      cinematics: typeof Cinematics !== 'undefined' ? Cinematics : null,
    };
  }
})();

(async function () {
  const assetsReady = typeof Assets !== 'undefined' && typeof Assets.load === 'function'
    ? Assets.load() : Promise.resolve();
  const btnArmoryStart = document.getElementById('btn-armory-start');
  if (btnArmoryStart) {
    btnArmoryStart.disabled = true;
    btnArmoryStart.textContent = 'Cargando modelos…';
  }

  // The intro comes first: cinematic on black, the three chapters, then the
  // menu. The theme keeps playing under the menu and stops when the assault
  // starts, where the war drums take over. Once seen it is not replayed in
  // the same session, so "Reintentar" goes straight to the menu.
  let introSeen = false;
  try {
    introSeen = typeof sessionStorage !== 'undefined' &&
      sessionStorage.getItem('fuego-en-humen:introSeen') === '1';
  } catch (e) { /* storage unavailable */ }
  if (!introSeen && typeof Screens !== 'undefined' && typeof Screens.showIntro === 'function') {
    Screens.showIntro();
  }

  const btnPlay = document.getElementById('btn-play');
  if (btnPlay) {
    btnPlay.addEventListener('click', function () {
      sfxCall('unlock'); // AudioContext must be created/resumed inside this gesture
      sfxCall('ambientSea');
      Screens.showArmory();
    });
  }

  // Menu gestures are safe while loading; gameplay is wired only once ready.
  await assetsReady;
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
  const pickups = (typeof Pickups !== 'undefined' && Pickups)
    ? Pickups.create(scene, world.fort)
    : null;
  if (DEBUG_MODE) window.__pickups = pickups;

  // Effects and the rigid-body world are created before the player/enemies:
  // both modules need them, and the physics owns the shared player body.
  const effects = Effects.create(scene, camera);
  const physics = GamePhysics.create(scene, world, effects);
  Enemies.bindPhysics(physics);

  // Shared enemies array: passed to the player and filled by Enemies.
  const enemies = [];
  if (DEBUG_MODE) window.__enemies = enemies;

  function sfxCall(name, arg) {
    if (typeof sfx !== 'undefined' && sfx && typeof sfx[name] === 'function') {
      try { sfx[name](arg); } catch (e) { /* audio is non-critical */ }
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
      // Melee weapons (sable, pica) share the heavy knockback of the blade.
      var meleeDef = (typeof WEAPONS !== 'undefined') ? WEAPONS[third] : null;
      kind = (meleeDef && meleeDef.type === 'melee') || third === 'sable' ? 'sable' : 'musket';
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
    if (kind !== 'cannon' && kind !== 'shotgun') sfxCall('hit');
  }

  const player = createPlayer(camera, canvas, {
    state: state,
    enemies: enemies,
    physics: physics,
    effects: effects,
    world: world,
    onEnemyHit: handleEnemyHit,
    onPickupRequest: function () {
      return pickups ? pickups.tryPickup(player, state.time).ok : false;
    },
  });

  if (typeof player.fireCannon === 'function') {
    const baseFireCannon = player.fireCannon;
    player.fireCannon = function () {
      const fired = baseFireCannon.apply(player, arguments);
      if (fired) objectiveEvent('cannon');
      return fired;
    };
  }

  const allies = (typeof Allies !== 'undefined' && Allies)
    ? Allies.create({ world: world, physics: physics, effects: effects, sfxCall: sfxCall })
    : null;
  if (DEBUG_MODE) window.__allies = allies;

  // --- Campaign: mission objectives, checkpoints and progression ---
  let missionState = null;
  let missionIndex = 1;

  function missionEntry(n) {
    return (typeof Campaign !== 'undefined' && Campaign.waveEntry) ? Campaign.waveEntry(n) : null;
  }

  function startMission(n) {
    missionIndex = n;
    var entry = missionEntry(n);
    missionState = (typeof ObjectiveLogic !== 'undefined' && entry)
      ? ObjectiveLogic.create(entry)
      : null;
    if (missionState && typeof HUD !== 'undefined') {
      if (typeof HUD.updateObjective === 'function') HUD.updateObjective(ObjectiveLogic.label(missionState));
      if (typeof HUD.radio === 'function' && entry.radio) HUD.radio(entry.radio.start);
    }
    if (typeof Screens !== 'undefined' && Screens.setCampaignCheckpoint) {
      Screens.setCampaignCheckpoint({
        mission: n,
        hp: state.playerHp,
        fort: state.fortIntegrity,
        score: state.score || 0,
      });
    }
  }

  function objectiveEvent(type) {
    if (!missionState || state.phase !== 'playing' || typeof ObjectiveLogic === 'undefined') return;
    var result = ObjectiveLogic.register(missionState, type);
    if (typeof HUD !== 'undefined' && typeof HUD.updateObjective === 'function') {
      HUD.updateObjective(ObjectiveLogic.label(missionState));
    }
    if (result.completed && typeof HUD !== 'undefined' && typeof HUD.radio === 'function') {
      var entry = missionEntry(missionIndex);
      if (entry && entry.radio && entry.radio.objective) HUD.radio(entry.radio.objective);
    }
  }

  const intermission = (typeof Intermission !== 'undefined' && Intermission)
    ? Intermission.create({
        state: state,
        setPhase: setPhase,
        hud: HUD,
        sfx: sfxCall,
        campaign: (typeof Campaign !== 'undefined') ? Campaign : null,
        requestPointerLock: function () {
          try { canvas.requestPointerLock(); } catch (error) { /* lock is optional */ }
        },
      })
    : null;
  if (DEBUG_MODE) window.__intermission = intermission;

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
      const u = (enemy && enemy.userData) || {};
      if (pickups) pickups.onEnemyKilled(enemy);
      const friendly = u.lastHitKind === 'ally';
      if (!friendly) objectiveEvent('kill');
      if (u.kind === 'artillery') objectiveEvent('artillery');
      if (!friendly) {
        const pts = u.score || 100;
        state.score = (state.score || 0) + pts;
        HUD.killPopup(pts);
      }
      if (u.kind === 'artillery') {
        const point = { x: enemy.position.x, y: 0.9, z: enemy.position.z };
        if (effects) {
          effects.explosion(point);
          effects.addShake(0.25);
        }
        sfxCall('explosion', point);
      } else if (!friendly) {
        sfxCall('kill');
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
    onExplosion: function (point) {
      sfxCall('explosion', point);
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

  // Armory: the chosen weapon is equipped before the assault starts.
  if (btnArmoryStart) {
    btnArmoryStart.addEventListener('click', function () {
      const key = Screens.getArmoryWeapon();
      if (player && typeof player.setLoadout === 'function') player.setLoadout(key);
      state.loadout = key;
      const mission = (typeof Screens !== 'undefined' && Screens.getCampaignMission)
        ? Screens.getCampaignMission()
        : 1;
      const checkpoint = (typeof Screens !== 'undefined' && Screens.getCampaignCheckpoint)
        ? Screens.getCampaignCheckpoint()
        : null;
      if (typeof Enemies !== 'undefined' && typeof Enemies.reset === 'function') {
        Enemies.reset(enemies, scene, physics);
      }
      state.wave = mission;
      if (checkpoint && checkpoint.mission === mission) {
        state.playerHp = checkpoint.hp;
        state.fortIntegrity = checkpoint.fort;
        state.score = checkpoint.score;
      }
      if (typeof Enemies !== 'undefined' && Enemies.spawnWave) {
        Enemies.spawnWave(scene, WAVES[mission - 1], enemies, mission);
      }
      startMission(mission);
      sfxCall('startWarDrums');
      Screens.stopIntroMusic();
      Screens.hideArmory();
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

  // Best score: merge on game end, persist only when beaten. Degrades to a
  // session-only number when Records/localStorage is unavailable.
  function recordStats() {
    const score = state.score || 0;
    if (typeof Records === 'undefined') return { best: score, isNew: false };
    const merged = Records.mergeRecord(Records.load(), score);
    if (merged.isNew) Records.save(merged.best);
    return merged;
  }

  const menuBest = document.getElementById('menu-best');
  if (menuBest && typeof Records !== 'undefined') {
    const best = Records.load();
    menuBest.textContent = best > 0 ? 'Mejor puntuación: ' + best : '';
  }

  let lastPhase = state.phase;
  function onPhaseChanged(now) {
    if (now === 'playing') {
      Screens.hideMenu();
      HUD.show();
      sfxCall('startWarDrums');
      return;
    }
    if (now === 'paused') {
      sfxCall('stopWarDrums');
      return;
    }
    if (now === 'intermission') {
      HUD.hide();
      hidePauseOverlay();
      sfxCall('stopWarDrums');
      return;
    }
    if (now === 'victory') {
      HUD.hide();
      hidePauseOverlay();
      exitPointerLockSafe();
      sfxCall('stopWarDrums');
      sfxCall('victory');
      const rec = recordStats();
      Screens.showVictory({
        wavesRepelled: WAVES.length,
        score: state.score || 0,
        bestScore: rec.best,
        isNewRecord: rec.isNew,
      });
      return;
    }
    if (now === 'defeat') {
      HUD.hide();
      hidePauseOverlay();
      exitPointerLockSafe();
      sfxCall('stopWarDrums');
      sfxCall('defeat');
      const rec = recordStats();
      Screens.showDefeat(Screens.detectDefeatCause(state), {
        score: state.score || 0,
        bestScore: rec.best,
        isNewRecord: rec.isNew,
      });
    }
  }

  // Shared by the natural wave-clear and the debug hook.
  function startIntermission() {
    if (!intermission) return false;
    if (state.wave >= WAVES.length) {
      intermission.begin({
        wave: state.wave,
        final: true,
        onDone: function () {
        state.defeatCause = 'history';
        if (typeof Screens !== 'undefined' && Screens.clearCampaignCheckpoint) {
          Screens.clearCampaignCheckpoint();
        }
      },
      });
      return true;
    }
    nextWave(state);
    intermission.begin({
      wave: state.wave,
      onDone: function () {
        Enemies.spawnWave(scene, WAVES[state.wave - 1], enemies, state.wave);
        startMission(state.wave);
        waveClearing = false;
      },
    });
    return true;
  }

  let lastTime = performance.now();
  let lastBeat = 0;
  let lastFort = FORT_INTEGRITY;
  let smokeTimer = 0;
  let waveClearing = false;
  function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    // 1. Player input -> body velocity + weapon fire (spawns projectiles).
    // The intermission freezes the body and the game clock while the clip plays.
    if (state.phase !== 'intermission') player.update(dt);

    if (state.phase === 'playing') {
      // 2. Enemy AI -> body velocities + enemy fire.
      Enemies.updateEnemies(dt, player, world, enemyCallbacks);
      // 2b. Qing allies pick targets and fire their muskets.
      if (allies) allies.update(dt, player, state.time);
      // 3. Rigid bodies, projectiles, impacts, corpses.
      physics.step(dt, physicsCtx);
      // 3b. Crates, dropped loot and the F prompt.
      if (pickups) pickups.update(dt, player, state.time);
      // 4. Particles and camera shake decay.
      if (effects) effects.update(dt);
      // 5. Camera from the post-step body position.
      player.syncCamera(dt);

      // Low-HP heartbeat; state.time freezes on pause, so the beat stops too.
      const beatInterval = heartbeatInterval(state.playerHp);
      if (beatInterval && state.time - lastBeat >= beatInterval) {
        lastBeat = state.time;
        sfxCall('heartbeat');
      }

      // Wave-clear detection after the physics step so the last corpse does
      // not block the advance. waveClearing keeps the intermission from
      // re-triggering while the next wave has not spawned yet.
      if (state.phase === 'playing' && !waveClearing &&
          Enemies.pendingSpawns() === 0 && enemies.length === 0) {
        waveClearing = true;
        objectiveEvent('wave-cleared');
        if (typeof Screens !== 'undefined' && Screens.unlockNextMission) {
          Screens.unlockNextMission(state.wave);
        }
        if (intermission) {
          startIntermission();
        } else {
          const prevWave = state.wave;
          nextWave(state);
          if (state.phase === 'playing' && state.wave !== prevWave) {
            Enemies.spawnWave(scene, WAVES[state.wave - 1], enemies, state.wave);
            playWaveHorn();
            waveClearing = false;
          } else if (state.phase === 'playing') {
            waveClearing = false;
          }
        }
      }
    } else {
      // Menu/paused: the world is frozen, but the camera still follows the
      // settled body so the menu shows the fort from eye height.
      player.syncCamera(dt);
    }

    if (intermission) intermission.update();

    // Spatial audio listener follows the camera (safe before audio unlock).
    if (typeof sfx !== 'undefined' && sfx && typeof sfx.setListener === 'function') {
      sfx.setListener(camera.position, camera.rotation.y);
    }

    // Ambient world motion + visible fort damage as integrity drops.
    if (typeof world.update === 'function') world.update(now / 1000);
    if (state.fortIntegrity !== lastFort) {
      lastFort = state.fortIntegrity;
      if (typeof world.setFortDamage === 'function') {
        world.setFortDamage(1 - state.fortIntegrity / FORT_INTEGRITY);
      }
    }
    if (state.phase === 'playing' && state.fortIntegrity < FORT_INTEGRITY / 2 &&
        world.scorches && effects && typeof effects.smoke === 'function') {
      smokeTimer -= dt;
      if (smokeTimer <= 0) {
        smokeTimer = 0.6;
        const visible = world.scorches.filter(function (s) { return s.mesh.visible; });
        if (visible.length > 0) {
          const s = visible[Math.floor(Math.random() * visible.length)];
          effects.smoke({ x: s.x, y: s.y, z: s.z });
        }
      }
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

    // The intro covers the screen: no need to draw the 3D scene behind it.
    if (typeof Screens === 'undefined' || !Screens.isIntroVisible || !Screens.isIntroVisible()) {
      renderer.render(scene, camera);
    }
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
    if (typeof Records !== 'undefined') window.__records = Records;
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
    window.__debug = {
      skipWave: function () {
        if (state.phase !== 'playing' || !intermission || intermission.isActive()) return false;
        waveClearing = true;
        return startIntermission();
      },
    };
  }

  if (btnArmoryStart) {
    btnArmoryStart.disabled = false;
    btnArmoryStart.textContent = 'Comenzar el asalto';
  }
})();

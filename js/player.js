// Player controller: pointer lock, WASD movement, mosquete/sable weapons.
// Browser global `createPlayer`; also guarded for Node tooling consistency.
//
// createPlayer(camera, domElement, hooks) -> player
//   hooks (all optional):
//     state    - game state from createGameState() (plain object, mutated in place)
//     enemies  - array of THREE.Object3D with numeric `userData.hp` (Task 5 fills this; [] is fine)
//     onAmmoChange(weaponKey, ammo, clipSize, reloading) - fired on any ammo/reload change
//     onEnemyHit(enemy, damage, weaponKey) - fired after an enemy takes damage
//
// HUD / state contract (consumed by the HUD task, e.g. Task 6):
//   state.weapon     'mosquete' | 'sable'
//   state.ammo       rounds left in the mosquete clip (1 max); null for sable (no clip)
//   state.clipSize   current weapon clip size; null for sable
//   state.reloading  boolean, true while state.time < state.reloadingUntil
// The player writes these directly into `state` (and mirrors them into the
// #hud-* placeholder spans added in index.html) so the HUD can stay read-only.
//
// The player also advances state.time while phase === 'playing' so reload
// deadlines (state.reloadingUntil, via startReload) tick in step with the game.

var createPlayer = (function () {
  var EYE_HEIGHT = 1.7; // brief: eyes at 1.7 m even though the fort floor is y=0
  var WALK_SPEED = 4.0; // m/s
  var RUN_MULT = 1.6; // Shift run multiplier
  var MOUSE_SENSITIVITY = 0.0023; // rad per pixel
  var PITCH_LIMIT = 1.45; // ~83 deg
  var MELEE_ANGLE = Math.PI / 3; // hits allowed within ~60 deg of view direction

  function createPlayer(camera, domElement, hooks) {
    hooks = hooks || {};
    var state = hooks.state || (typeof createGameState === 'function' ? createGameState() : { phase: 'menu', wave: 1, playerHp: 100, fortIntegrity: 100, score: 0, time: 0, reloadingUntil: 0 });
    var enemies = Array.isArray(hooks.enemies) ? hooks.enemies : [];

    // --- Camera rig ---
    camera.rotation.order = 'YXZ';
    camera.position.set(0, EYE_HEIGHT, 24);
    camera.rotation.set(0, 0, 0); // yaw 0 = facing -Z (toward the sea)

    var yaw = 0;
    var pitch = 0;

    // --- Weapon state ---
    var clips = { mosquete: WEAPONS.mosquete.clipSize }; // sable has no clip
    var currentKey = 'mosquete';
    var lastShotAt = -Infinity;

    function weaponDef() {
      return WEAPONS[currentKey];
    }

    function isReloading() {
      return (state.reloadingUntil || 0) > (state.time || 0);
    }

    function syncStateAmmo() {
      var def = weaponDef();
      if (def.type === 'melee') {
        state.weapon = currentKey;
        state.ammo = null;
        state.clipSize = null;
      } else {
        state.weapon = currentKey;
        state.ammo = clips[currentKey];
        state.clipSize = def.clipSize;
      }
      state.reloading = isReloading();
      if (typeof hooks.onAmmoChange === 'function') {
        hooks.onAmmoChange(currentKey, state.ammo, state.clipSize, state.reloading);
      }
      updateHud();
    }

    function updateHud() {
      if (typeof document === 'undefined') return;
      var el;
      el = document.getElementById('hud-health');
      if (el) el.textContent = 'HP ' + state.playerHp;
      el = document.getElementById('hud-ammo');
      if (el) {
        var def = weaponDef();
        el.textContent = isReloading()
          ? 'Recargando…'
          : def.type === 'melee'
            ? 'Sable'
            : 'Mosquete ' + state.ammo + '/' + state.clipSize;
      }
      el = document.getElementById('hud-wave');
      if (el) el.textContent = 'Oleada ' + state.wave;
      el = document.getElementById('hud-fort');
      if (el) el.textContent = 'Fuerte ' + state.fortIntegrity;
    }

    // --- Viewmodels (primitive shapes attached to the camera) ---
    var viewmodel = new THREE.Group();
    viewmodel.name = 'viewmodel';
    camera.add(viewmodel);

    // Musket: dark wood stock + dark metal barrel, held lower-right.
    var musket = new THREE.Group();
    var stock = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.09, 0.62),
      new THREE.MeshStandardMaterial({ color: 0x4a2f1d, roughness: 0.9 })
    );
    stock.position.set(0, 0, -0.08);
    musket.add(stock);
    var barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.55, 10),
      new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.5, metalness: 0.7 })
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.055, -0.32);
    musket.add(barrel);
    viewmodel.add(musket);

    // Sable: light curved-ish blade (flattened box) + small hilt.
    var sable = new THREE.Group();
    var blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.025, 0.055, 0.78),
      new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.25, metalness: 0.9 })
    );
    blade.position.set(0, 0.02, -0.25);
    blade.rotation.x = 0.12;
    sable.add(blade);
    var hilt = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, 0.12, 0.14),
      new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.8 })
    );
    hilt.position.set(0, -0.02, 0.18);
    sable.add(hilt);
    viewmodel.add(sable);

    var VM_BASE = { x: 0.32, y: -0.30, z: -0.55 };
    viewmodel.position.set(VM_BASE.x, VM_BASE.y, VM_BASE.z);
    viewmodel.rotation.y = 0.08;

    function syncViewmodel() {
      musket.visible = currentKey === 'mosquete';
      sable.visible = currentKey === 'sable';
    }

    // --- Pointer lock + overlay ---
    var overlay = typeof document !== 'undefined' ? document.getElementById('pause-overlay') : null;

    function lockPointer() {
      try {
        var p = domElement.requestPointerLock();
        if (p && typeof p.catch === 'function') p.catch(function () { /* browser cooldown after Esc; user can click again */ });
      } catch (e) { /* pointer lock unavailable (e.g. headless) */ }
    }

    function onLockChange() {
      var locked = typeof document !== 'undefined' && document.pointerLockElement === domElement;
      if (locked) {
        if (state.phase === 'menu' || state.phase === 'paused') setPhase(state, 'playing');
        if (overlay) overlay.style.display = 'none';
      } else {
        for (var k in keys) keys[k] = false; // avoid stuck keys after Esc/alt-tab
        if (state.phase === 'playing' && setPhase(state, 'paused') && overlay) {
          overlay.style.display = 'flex';
        }
      }
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('pointerlockchange', onLockChange);
      domElement.addEventListener('click', lockPointer);
      if (overlay) overlay.addEventListener('click', lockPointer);
    }

    // --- Mouse look ---
    function onMouseMove(e) {
      if (typeof document === 'undefined' || document.pointerLockElement !== domElement) return;
      yaw -= (e.movementX || 0) * MOUSE_SENSITIVITY;
      pitch -= (e.movementY || 0) * MOUSE_SENSITIVITY;
      if (pitch > PITCH_LIMIT) pitch = PITCH_LIMIT;
      if (pitch < -PITCH_LIMIT) pitch = -PITCH_LIMIT;
      camera.rotation.y = yaw;
      camera.rotation.x = pitch;
    }
    if (typeof document !== 'undefined') document.addEventListener('mousemove', onMouseMove);

    // --- Keyboard ---
    var keys = {};
    function onKeyDown(e) {
      keys[e.code] = true;
      if (e.code === 'KeyR') reload();
      else if (e.code === 'Digit1' || e.code === 'Numpad1') switchWeapon(1);
      else if (e.code === 'Digit2' || e.code === 'Numpad2') switchWeapon(2);
    }
    function onKeyUp(e) {
      keys[e.code] = false;
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
    }

    // --- Firing ---
    var raycaster = typeof THREE !== 'undefined' ? new THREE.Raycaster() : null;

    function updateEnemyMatrices() {
      for (var i = 0; i < enemies.length; i++) {
        if (enemies[i] && typeof enemies[i].updateWorldMatrix === 'function') {
          enemies[i].updateWorldMatrix(true, false);
        }
      }
    }

    function hitEnemy(damage, weaponKeyName) {
      if (!raycaster) return null;
      updateEnemyMatrices(); // enemies may move between renders
      raycaster.setFromCamera({ x: 0, y: 0 }, camera);
      raycaster.far = 250;
      var hits = raycaster.intersectObjects(enemies, true);
      if (!hits.length) return null;
      var target = hits[0].object;
      var node = target;
      while (node && !(node.userData && typeof node.userData.hp === 'number') && node.parent) node = node.parent;
      var enemy = node && node.userData && typeof node.userData.hp === 'number' ? node : target;
      if (enemy.userData && typeof enemy.userData.hp === 'number') enemy.userData.hp -= damage;
      if (typeof hooks.onEnemyHit === 'function') hooks.onEnemyHit(enemy, damage, weaponKeyName);
      return enemy;
    }

    function hitMelee(damage, weaponKeyName) {
      var origin = typeof camera.getWorldPosition === 'function'
        ? camera.getWorldPosition(new THREE.Vector3())
        : camera.position;
      var forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      var best = null;
      var bestDist = Infinity;
      for (var i = 0; i < enemies.length; i++) {
        var enemy = enemies[i];
        if (!enemy) continue;
        var enemyPos = typeof enemy.getWorldPosition === 'function'
          ? enemy.getWorldPosition(new THREE.Vector3())
          : enemy.position;
        var toEnemy = new THREE.Vector3().subVectors(enemyPos, origin);
        var dist = toEnemy.length();
        if (dist > weaponDef().range) continue;
        if (dist > 0.0001) {
          var angle = forward.angleTo(toEnemy.normalize());
          if (angle > MELEE_ANGLE) continue;
        }
        if (dist < bestDist) { bestDist = dist; best = enemy; }
      }
      if (best && best.userData && typeof best.userData.hp === 'number') best.userData.hp -= damage;
      if (best && typeof hooks.onEnemyHit === 'function') hooks.onEnemyHit(best, damage, weaponKeyName);
      return best;
    }

    var recoil = 0;
    var bobPhase = 0;

    function shoot() {
      if (state.phase !== 'playing') return false;
      if (typeof document !== 'undefined' && document.pointerLockElement !== domElement) return false;
      if (typeof camera.updateMatrixWorld === 'function') camera.updateMatrixWorld(true);
      var def = weaponDef();
      var now = state.time || 0;
      if (now - lastShotAt < (def.fireCooldown || 0)) return false;
      if (isReloading()) return false;

      if (def.type !== 'melee') {
        if ((clips[currentKey] || 0) <= 0) return false;
        clips[currentKey] -= 1;
      }
      lastShotAt = now;

      if (def.type === 'melee') hitMelee(def.damage, currentKey);
      else hitEnemy(def.damage, currentKey);

      recoil = 1;

      // Mosquete: after firing the last round, auto-reload.
      if (def.type !== 'melee' && clips[currentKey] === 0) startReload(currentKey, state);

      syncStateAmmo();
      return true;
    }

    function reload() {
      var started = startReload(currentKey, state); // sable: no reloadTime -> graceful no-op
      syncStateAmmo();
      return started;
    }

    function switchWeapon(i) {
      var next = null;
      if (i === 1 || i === '1' || i === 'mosquete') next = 'mosquete';
      else if (i === 2 || i === '2' || i === 'sable') next = 'sable';
      if (!next || next === currentKey || !WEAPONS[next]) return currentKey;
      currentKey = next;
      syncViewmodel();
      syncStateAmmo();
      return currentKey;
    }

    if (typeof document !== 'undefined') {
      domElement.addEventListener('mousedown', function (e) {
        if (e.button === 0) shoot();
      });
    }

    // --- Per-frame update ---
    var forwardVec = new THREE.Vector3();
    var rightVec = new THREE.Vector3();

    function update(dt) {
      dt = Math.min(Math.max(dt || 0, 0), 0.1);
      if (state.phase === 'playing') state.time = (state.time || 0) + dt;

      // Reload completion: refill the mosquete clip when the deadline passes.
      if (isReloading() === false && state.reloadingUntil && state.reloadingUntil > 0 && (state.time || 0) >= state.reloadingUntil) {
        if (WEAPONS.mosquete.reloadTime && clips.mosquete < WEAPONS.mosquete.clipSize) {
          clips.mosquete = WEAPONS.mosquete.clipSize;
        }
        state.reloadingUntil = 0;
        syncStateAmmo();
      }

      // Movement (only while playing).
      var moveX = 0;
      var moveZ = 0;
      if (state.phase === 'playing') {
        if (keys['KeyW'] || keys['ArrowUp']) moveZ += 1;
        if (keys['KeyS'] || keys['ArrowDown']) moveZ -= 1;
        if (keys['KeyD'] || keys['ArrowRight']) moveX += 1;
        if (keys['KeyA'] || keys['ArrowLeft']) moveX -= 1;
      }
      var moving = moveX !== 0 || moveZ !== 0;
      if (moving) {
        var run = keys['ShiftLeft'] || keys['ShiftRight'];
        var speed = WALK_SPEED * (run ? RUN_MULT : 1);
        forwardVec.set(-Math.sin(yaw), 0, -Math.cos(yaw));
        rightVec.set(Math.cos(yaw), 0, -Math.sin(yaw));
        var dir = new THREE.Vector3()
          .addScaledVector(forwardVec, moveZ)
          .addScaledVector(rightVec, moveX);
        if (dir.lengthSq() > 0) dir.normalize();
        camera.position.addScaledVector(dir, speed * dt);
        camera.position.y = EYE_HEIGHT;
        bobPhase += speed * dt * 1.6;
      } else {
        bobPhase *= 1 - Math.min(1, dt * 6);
      }

      // Viewmodel bob + recoil decay.
      recoil = Math.max(0, recoil - dt * 3.2);
      var bobY = Math.sin(bobPhase * 2) * 0.014 * (moving ? 1 : 0);
      var bobX = Math.cos(bobPhase) * 0.010 * (moving ? 1 : 0);
      viewmodel.position.set(
        VM_BASE.x + bobX,
        VM_BASE.y + bobY,
        VM_BASE.z + recoil * 0.18
      );
      viewmodel.rotation.x = recoil * 0.22;

      // Keep HUD reload label fresh as the deadline passes.
      if (typeof document !== 'undefined' && isReloading() !== state.reloading) updateHud();
      state.reloading = isReloading();

      return player;
    }

    var player = {
      update: update,
      shoot: shoot,
      reload: reload,
      switchWeapon: switchWeapon,
      state: state,
      enemies: enemies,
    };

    // Initial HUD/viewmodel sync.
    syncViewmodel();
    syncStateAmmo();

    return player;
  }

  return createPlayer;
})();

if (typeof module !== 'undefined') module.exports = { createPlayer: createPlayer };

// Player controller: pointer lock, physical movement (cannon-es body),
// ballistic musket, sable, jump and usable fort cannons.
// Browser global `createPlayer`; also guarded for Node tooling consistency.
//
// createPlayer(camera, domElement, hooks) -> player
//   hooks:
//     state    game state from createGameState() (mutated in place)
//     enemies  shared array of enemy pivots (filled by Enemies.spawnWave)
//     physics  result of GamePhysics.create() — REQUIRED
//     effects  js/effects.js instance (optional but expected in the browser)
//     world    buildWorld() result, for the usable cannons
//     onAmmoChange(weaponKey, ammo, clipSize, reloading)
//     onEnemyHit(enemy, damage, weaponKey, dir, point) — damage is applied by
//       the caller (main.js routes it to Enemies.applyHit)
//
// HUD / state contract (js/hud.js reads state every frame):
//   state.weapon, state.ammo, state.clipSize, state.reloading, state.time
// state.time advances only while phase === 'playing'; reload deadlines and
// cannon cooldowns use that clock.
//
// Physics contract:
//   camera = body centre + EYE_OFFSET + bob/dip/shake
//   horizontal velocity is steered toward the input with acceleration, so the
//   solver resolves wall contacts, sliding and collisions with soldiers.

var createPlayer = (function () {
  var WALK_SPEED = 4.0; // m/s
  var RUN_MULT = 1.6;
  var GROUND_ACCEL = 36; // m/s^2 toward the desired velocity
  var GROUND_DECEL = 28;
  var AIR_ACCEL = 7;
  var JUMP_SPEED = 4.4; // ~1 m jump under 9.81 gravity
  var MOUSE_SENSITIVITY = 0.0023; // rad per pixel
  var PITCH_LIMIT = 1.45; // ~83 deg
  var MELEE_ANGLE = Math.PI / 3;
  var CANNON_RANGE = 3.7; // m from the player to the nearest gun
  var CANNON_COOLDOWN = 3.5;
  var CANNON_AIM_DISTANCE = 120;
  var STEP_DISTANCE = 1.9; // metres between footstep sounds
  var STANDING_SPREAD = 0.0025; // radians
  var MOVING_SPREAD = 0.014;
  var AIR_SPREAD = 0.03;

  function approach(value, target, maxDelta) {
    if (value < target) return Math.min(value + maxDelta, target);
    if (value > target) return Math.max(value - maxDelta, target);
    return value;
  }

  function createPlayer(camera, domElement, hooks) {
    hooks = hooks || {};
    var state = hooks.state || (typeof createGameState === 'function' ? createGameState() : {
      phase: 'menu', wave: 1, playerHp: 100, fortIntegrity: 100, score: 0,
      time: 0, reloadingUntil: 0,
    });
    var enemies = Array.isArray(hooks.enemies) ? hooks.enemies : [];
    var physics = hooks.physics || null;
    if (!physics) throw new Error('createPlayer: hooks.physics is required');
    var effects = hooks.effects || null;
    var world = hooks.world || null;
    var body = physics.playerBody;

    // --- Camera rig ---
    camera.rotation.order = 'YXZ';
    camera.position.set(body.position.x, body.position.y + physics.EYE_OFFSET, body.position.z);
    camera.rotation.set(0, 0, 0); // yaw 0 = facing -Z (toward the sea)

    var yaw = 0;
    var pitch = 0;
    var pitchKick = 0;
    var yawKick = 0;
    var recoil = 0;
    var bobPhase = 0;
    var bobBlend = 0;
    var landDip = 0;
    var meleeSwing = 0;
    var stepAccum = 0;
    var preGrounded = true;
    var preFallSpeed = 0;
    var lastGrounded = true;

    // --- Weapon state ---
    // Every firearm gets a clip; melee weapons have none.
    var clips = {};
    (function () {
      for (var key in WEAPONS) {
        if (!Object.prototype.hasOwnProperty.call(WEAPONS, key)) continue;
        var def = WEAPONS[key];
        if (def.type !== 'melee') clips[key] = def.clipSize;
      }
    })();
    var currentKey = (typeof ARMORY_ORDER !== 'undefined' && ARMORY_ORDER.length)
      ? ARMORY_ORDER[0]
      : 'mosquete';
    var lastShotAt = {}; // per-weapon fire cooldown timestamps
    var reloadingKey = null; // weapon whose reload is in flight

    // --- Inventory (weapons stay on 1-5; consumables live on 6-8) ---
    var items = (typeof ItemLogic !== 'undefined' && ItemLogic) ? ItemLogic : null;
    var inventory = items ? items.createInventory() : { medkit: 0, ammoBag: 0, grenade: 0 };
    var maxHp = (typeof PLAYER_HP !== 'undefined') ? PLAYER_HP : 100;
    var lastGrenadeAt = -Infinity;
    state.inventory = inventory;

    function flashSlot(slot) {
      if (typeof HUD === 'undefined' || !HUD || typeof HUD.flashSlot !== 'function') return;
      HUD.flashSlot(slot);
    }

    function useItemSlot(slot) {
      if (state.phase !== 'playing') return false;
      if (!items) return false;
      if (slot === 6) {
        if ((inventory.medkit || 0) <= 0 || (state.playerHp || 0) >= maxHp) {
          flashSlot(6);
          return false;
        }
        items.useItem(inventory, 'medkit');
        state.playerHp = Math.min(maxHp, (state.playerHp || 0) + items.ITEM_DEFS.medkit.heal);
        flashSlot(6);
        return true;
      }
      if (slot === 7) {
        if ((inventory.ammoBag || 0) <= 0 || !items.needsAmmo(clips, WEAPONS)) {
          flashSlot(7);
          return false;
        }
        items.useItem(inventory, 'ammoBag');
        items.refillClips(clips, WEAPONS);
        state.reloadingUntil = 0;
        reloadingKey = null;
        syncStateAmmo();
        flashSlot(7);
        return true;
      }
      if (slot === 8) return throwGrenade();
      return false;
    }

    function throwGrenade() {
      if (state.phase !== 'playing' || !items) return false;
      if ((inventory.grenade || 0) <= 0) {
        flashSlot(8);
        return false;
      }
      if ((state.time || 0) - lastGrenadeAt < 0.8) return false;
      if (!physics || typeof physics.fireCannon !== 'function') return false;

      camera.updateMatrixWorld(true);
      camera.getWorldDirection(forwardVec);
      var origin = {
        x: camera.position.x + forwardVec.x * 0.6,
        y: camera.position.y + forwardVec.y * 0.6 - 0.05,
        z: camera.position.z + forwardVec.z * 0.6,
      };
      var def = items.ITEM_DEFS.grenade;
      var target = (typeof physics.aimPoint === 'function')
        ? physics.aimPoint(origin, forwardVec, def.maxRange)
        : { x: origin.x + forwardVec.x * 16, y: origin.y + forwardVec.y * 16, z: origin.z + forwardVec.z * 16 };
      target.y = Math.max(0.25, Math.min(4, target.y || 0.25));

      items.useItem(inventory, 'grenade');
      lastGrenadeAt = state.time || 0;
      physics.fireCannon({
        from: origin,
        target: target,
        owner: 'player',
        damage: def.damage,
        blastRadius: def.blastRadius,
        fortDamage: 0,
        speed: def.speed,
      });
      if (effects && typeof effects.addShake === 'function') effects.addShake(0.05);
      sfxCall('shot');
      flashSlot(8);
      return true;
    }

    function tryPickup() {
      if (state.phase !== 'playing') return false;
      if (typeof hooks.onPickupRequest !== 'function') return false;
      return hooks.onPickupRequest();
    }

    function weaponDef() {
      return WEAPONS[currentKey];
    }

    // Armory pick: works in any phase so the loadout can be set before play.
    function setLoadout(key) {
      var next = (typeof sanitizeLoadout === 'function')
        ? sanitizeLoadout(key, WEAPONS)
        : (WEAPONS[key] ? key : 'mosquete');
      if (next === currentKey) return currentKey;
      currentKey = next;
      syncViewmodel();
      syncStateAmmo();
      return currentKey;
    }

    function getWeaponKey() {
      return currentKey;
    }

    // Audio is optional: if js/audio.js failed to load, gameplay must continue.
    function sfxCall(name, arg) {
      if (typeof sfx !== 'undefined' && sfx && typeof sfx[name] === 'function') {
        try {
          if (arg === undefined) sfx[name]();
          else sfx[name](arg);
        } catch (e) { /* audio is non-critical */ }
      }
    }

    function hudHints(text) {
      if (typeof HUD !== 'undefined' && HUD && typeof HUD.setCannonHint === 'function') {
        HUD.setCannonHint(text);
      }
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
    }

    // --- Viewmodels (primitive shapes attached to the camera) ---
    var viewmodel = new THREE.Group();
    viewmodel.name = 'viewmodel';
    camera.add(viewmodel);

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

    // Flintlock rifle: longer barrel, brass furniture, held lower.
    var fusil = new THREE.Group();
    var fusilStock = new THREE.Mesh(
      new THREE.BoxGeometry(0.085, 0.1, 0.78),
      new THREE.MeshStandardMaterial({ color: 0x3b2517, roughness: 0.92 })
    );
    fusilStock.position.set(0, -0.01, -0.1);
    fusil.add(fusilStock);
    var fusilBarrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.019, 0.019, 0.82, 10),
      new THREE.MeshStandardMaterial({ color: 0x33333a, roughness: 0.42, metalness: 0.78 })
    );
    fusilBarrel.rotation.x = Math.PI / 2;
    fusilBarrel.position.set(0, 0.035, -0.52);
    fusil.add(fusilBarrel);
    var fusilLock = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.075, 0.16),
      new THREE.MeshStandardMaterial({ color: 0xb08b3a, roughness: 0.35, metalness: 0.85 })
    );
    fusilLock.position.set(0, 0.02, -0.02);
    fusil.add(fusilLock);
    viewmodel.add(fusil);

    // Pike: long shaft with a leaf blade, held diagonally.
    var pica = new THREE.Group();
    var shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.021, 1.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x5a4128, roughness: 0.9 })
    );
    shaft.rotation.x = Math.PI / 2 - 0.1;
    shaft.position.set(0, -0.02, -0.26);
    pica.add(shaft);
    var pikeBlade = new THREE.Mesh(
      new THREE.ConeGeometry(0.045, 0.34, 6),
      new THREE.MeshStandardMaterial({ color: 0xc9ced4, roughness: 0.28, metalness: 0.88 })
    );
    pikeBlade.rotation.x = -Math.PI / 2 + 0.1;
    pikeBlade.position.set(0, 0.05, -0.92);
    pica.add(pikeBlade);
    viewmodel.add(pica);

    var trabuco = new THREE.Group();
    var trabucoStock = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 0.42),
      new THREE.MeshStandardMaterial({ color: 0x4a2f1d, roughness: 0.9 })
    );
    trabucoStock.position.set(0, -0.01, -0.02);
    trabuco.add(trabucoStock);
    var trabucoBarrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.027, 0.027, 0.42, 10),
      new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.5, metalness: 0.7 })
    );
    trabucoBarrel.rotation.x = Math.PI / 2;
    trabucoBarrel.position.set(0, 0.05, -0.3);
    trabuco.add(trabucoBarrel);
    var trabucoMuzzle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.027, 0.2, 10),
      trabucoBarrel.material
    );
    trabucoMuzzle.rotation.x = -Math.PI / 2;
    trabucoMuzzle.position.set(0, 0.05, -0.6);
    trabuco.add(trabucoMuzzle);
    viewmodel.add(trabuco);

    var VM_BASE = { x: 0.32, y: -0.30, z: -0.55 };
    viewmodel.position.set(VM_BASE.x, VM_BASE.y, VM_BASE.z);
    viewmodel.rotation.y = 0.08;

    var viewmodels = { mosquete: musket, fusil: fusil, sable: sable, pica: pica, trabuco: trabuco };

    function syncViewmodel() {
      for (var key in viewmodels) {
        if (!Object.prototype.hasOwnProperty.call(viewmodels, key)) continue;
        viewmodels[key].visible = key === currentKey;
      }
    }

    // --- Fort cannons (usable with E) ---
    var cannons = world && Array.isArray(world.cannons) ? world.cannons : [];
    var cannonSpots = [];
    for (var ci = 0; ci < cannons.length; ci++) {
      var cp = new THREE.Vector3();
      cannons[ci].getWorldPosition(cp);
      cannonSpots.push(cp);
      if (!cannons[ci].userData.cooldownUntil) cannons[ci].userData.cooldownUntil = 0;
    }
    var activeCannon = null;

    function updateCannonChoice(dt) {
      var eye = camera.position;
      var forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      var fx = forward.x;
      var fz = forward.z;
      var flen = Math.hypot(fx, fz) || 1;
      fx /= flen;
      fz /= flen;

      var best = null;
      var bestDist = CANNON_RANGE;
      for (var i = 0; i < cannons.length; i++) {
        var spot = cannonSpots[i];
        var dx = spot.x - eye.x;
        var dz = spot.z - eye.z;
        var dist = Math.hypot(dx, dz);
        if (dist > bestDist) continue;
        var dot = (dx / (dist || 1)) * fx + (dz / (dist || 1)) * fz;
        if (dot < 0.25) continue;
        best = cannons[i];
        bestDist = dist;
      }
      activeCannon = best;

      if (best) {
        // Turn the barrel toward the view so firing reads visually.
        best.updateMatrixWorld(true);
        var targetYaw = Math.atan2(-fx, -fz);
        var delta = targetYaw - best.rotation.y;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        var step = Math.max(-3.2 * dt, Math.min(3.2 * dt, delta));
        best.rotation.y += step;
        var ready = (best.userData.cooldownUntil || 0) <= (state.time || 0);
        hudHints(ready ? 'E — Fuego de cañón' : 'Cañón recargando…');
      } else {
        hudHints(null);
      }
    }

    function fireCannon() {
      if (state.phase !== 'playing' || !activeCannon) return false;
      var now = state.time || 0;
      if ((activeCannon.userData.cooldownUntil || 0) > now) return false;
      activeCannon.updateMatrixWorld(true);
      var muzzle = activeCannon.localToWorld(new THREE.Vector3(0, 0.87, -1.5));
      var forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      var eye = camera.position;
      var target = physics.aimPoint(
        { x: eye.x, y: eye.y, z: eye.z },
        { x: forward.x, y: forward.y, z: forward.z },
        CANNON_AIM_DISTANCE,
        physics.GROUP.WORLD | physics.GROUP.ENEMY
      );
      target.y = Math.max(0.4, Math.min(5, target.y));
      // The fort guns sit behind a 1.3 m parapet with no embrasures. Start the
      // ball just beyond the wall so the player's cannon is actually usable;
      // the muzzle flash still comes from the barrel.
      var fwdH = new THREE.Vector3(forward.x, 0, forward.z);
      if (fwdH.lengthSq() < 1e-6) fwdH.set(0, 0, -1);
      fwdH.normalize();
      var horizontalTarget = Math.hypot(target.x - muzzle.x, target.z - muzzle.z);
      var offset = Math.min(6.5, Math.max(0, horizontalTarget - 1));
      var shotFrom = {
        x: muzzle.x + fwdH.x * offset,
        y: muzzle.y + 0.5,
        z: muzzle.z + fwdH.z * offset,
      };
      physics.fireCannon({
        from: shotFrom,
        target: target,
        owner: 'player',
        damage: 135,
        blastRadius: 6,
        speed: 62,
      });
      if (effects) {
        effects.muzzleFlash(muzzle, forward, { big: true });
        effects.addShake(0.35);
      }
      sfxCall('cannon');
      activeCannon.userData.cooldownUntil = now + CANNON_COOLDOWN;
      recoil = 1.2;
      pitchKick += 0.035;
      return true;
    }

    // --- Pointer lock + overlay ---
    var overlay = typeof document !== 'undefined' ? document.getElementById('pause-overlay') : null;

    function lockPointer() {
      try {
        var p = domElement.requestPointerLock();
        if (p && typeof p.catch === 'function') p.catch(function () { /* browser cooldown after Esc; click again */ });
      } catch (e) { /* pointer lock unavailable (e.g. headless) */ }
    }

    function onLockChange() {
      var locked = typeof document !== 'undefined' && document.pointerLockElement === domElement;
      if (locked) {
        if (state.phase === 'menu' || state.phase === 'paused') setPhase(state, 'playing');
        if (overlay) overlay.style.display = 'none';
      } else {
        for (var k in keys) keys[k] = false;
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
    }
    if (typeof document !== 'undefined') document.addEventListener('mousemove', onMouseMove);

    // --- Keyboard ---
    var keys = {};
    var jumpQueued = false;
    var jumpQueuedAt = 0;

    function onKeyDown(e) {
      keys[e.code] = true;
      if (e.code === 'KeyR') reload();
      else if (e.code === 'Digit1' || e.code === 'Numpad1') switchWeapon(1);
      else if (e.code === 'Digit2' || e.code === 'Numpad2') switchWeapon(2);
      else if (e.code === 'Digit3' || e.code === 'Numpad3') switchWeapon(3);
      else if (e.code === 'Digit4' || e.code === 'Numpad4') switchWeapon(4);
      else if (e.code === 'Digit5' || e.code === 'Numpad5') switchWeapon(5);
      else if (e.code === 'Digit6' || e.code === 'Numpad6') useItemSlot(6);
      else if (e.code === 'Digit7' || e.code === 'Numpad7') useItemSlot(7);
      else if (e.code === 'Digit8' || e.code === 'Numpad8') useItemSlot(8);
      else if (e.code === 'KeyF') tryPickup();
      else if (e.code === 'KeyE') fireCannon();
      else if (e.code === 'Space') {
        jumpQueued = true;
        jumpQueuedAt = state.time || 0;
        if (typeof e.preventDefault === 'function') e.preventDefault();
      }
    }
    function onKeyUp(e) {
      keys[e.code] = false;
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
    }

    // --- Firing ---
    var forwardVec = new THREE.Vector3();
    var rightVec = new THREE.Vector3();
    var muzzlePoint = new THREE.Vector3();

    function canShoot() {
      if (state.phase !== 'playing') return false;
      if (typeof document !== 'undefined' && document.pointerLockElement !== domElement) return false;
      return true;
    }

    function hitMelee(damage, weaponKeyName) {
      var origin = camera.getWorldPosition(new THREE.Vector3());
      var forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      var best = null;
      var bestDist = Infinity;
      for (var i = 0; i < enemies.length; i++) {
        var enemy = enemies[i];
        if (!enemy || !enemy.position) continue;
        var enemyPos = enemy.position;
        var toEnemy = new THREE.Vector3(enemyPos.x - origin.x, enemyPos.y - origin.y, enemyPos.z - origin.z);
        var dist = toEnemy.length();
        if (dist > weaponDef().range) continue;
        if (dist > 0.0001) {
          var angle = forward.angleTo(toEnemy.clone().normalize());
          if (angle > MELEE_ANGLE) continue;
        }
        var chest = { x: enemyPos.x, y: 1.15, z: enemyPos.z };
        if (!physics.lineOfSight({ x: origin.x, y: origin.y, z: origin.z }, chest)) continue;
        if (dist < bestDist) { bestDist = dist; best = enemy; }
      }
      if (best) {
        var dir = new THREE.Vector3(best.position.x - origin.x, 0, best.position.z - origin.z);
        if (dir.lengthSq() > 0) dir.normalize();
        var point = { x: best.position.x, y: 1.15, z: best.position.z };
        if (typeof hooks.onEnemyHit === 'function') {
          hooks.onEnemyHit(best, damage, weaponKeyName, { x: dir.x, y: 0, z: dir.z }, point);
        }
      }
      return best;
    }

    function shoot() {
      if (!canShoot()) return false;
      var def = weaponDef();
      var now = state.time || 0;
      if (now - (lastShotAt[currentKey] || -Infinity) < (def.fireCooldown || 0)) return false;
      if (def.type !== 'melee' && isReloading()) return false;

      if (def.type !== 'melee') {
        if ((clips[currentKey] || 0) <= 0) return false;
        clips[currentKey] -= 1;
      }
      lastShotAt[currentKey] = now;

      if (def.type === 'melee') {
        meleeSwing = 0.32;
        hitMelee(def.damage, currentKey);
        sfxCall('swish');
      } else {
        if (typeof camera.updateMatrixWorld === 'function') camera.updateMatrixWorld(true);
        camera.getWorldDirection(forwardVec);
        rightVec.set(-forwardVec.z, 0, forwardVec.x);
        var speed = Math.hypot(body.velocity.x, body.velocity.z);
        var spread = !physics.isGrounded() ? AIR_SPREAD : (speed > 0.8 ? MOVING_SPREAD : STANDING_SPREAD);
        muzzlePoint.copy(camera.position)
          .addScaledVector(forwardVec, 0.55)
          .addScaledVector(rightVec, 0.13);
        muzzlePoint.y -= 0.1;
        if (def.pellets > 1) {
          physics.fireShotgun({
            from: { x: muzzlePoint.x, y: muzzlePoint.y, z: muzzlePoint.z },
            dir: { x: forwardVec.x, y: forwardVec.y, z: forwardVec.z },
            spread: def.spread + spread,
            damage: def.damage,
            pellets: def.pellets,
            owner: 'player',
          });
        } else {
          physics.fireMusket({
            from: { x: muzzlePoint.x, y: muzzlePoint.y, z: muzzlePoint.z },
            dir: { x: forwardVec.x, y: forwardVec.y, z: forwardVec.z },
            spread: spread,
            damage: def.damage,
            owner: 'player',
          });
        }
        if (effects) {
          effects.muzzleFlash(muzzlePoint, forwardVec);
          effects.addShake(0.05);
        }
        recoil = 1;
        pitchKick += 0.018 + Math.random() * 0.012;
        yawKick += (Math.random() - 0.5) * 0.01;
        sfxCall('shot');
      }

      if (def.type !== 'melee' && clips[currentKey] === 0) {
        if (startReload(currentKey, state)) {
          reloadingKey = currentKey;
          sfxCall('reload', def.reloadTime);
        }
      }
      syncStateAmmo();
      return true;
    }

    function reload() {
      if (state.phase !== 'playing') return false;
      var started = startReload(currentKey, state);
      if (started) {
        reloadingKey = currentKey;
        sfxCall('reload', weaponDef().reloadTime);
      }
      syncStateAmmo();
      return started;
    }

    // 1..5 map to the armory order; names are accepted too.
    function switchWeapon(i) {
      if (state.phase !== 'playing') return currentKey;
      var next = null;
      var order = (typeof ARMORY_ORDER !== 'undefined' && ARMORY_ORDER.length)
        ? ARMORY_ORDER
        : Object.keys(WEAPONS);
      if (typeof i === 'number' && i >= 1 && i <= order.length) next = order[i - 1];
      else if (typeof i === 'string') {
        var n = parseInt(i, 10);
        if (!isNaN(n) && n >= 1 && n <= order.length) next = order[n - 1];
        else if (WEAPONS[i]) next = i;
      }
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

    // --- Per-frame update: input, weapons, cannon choice ---
    function update(dt) {
      dt = Math.min(Math.max(dt || 0, 0), 0.1);
      if (state.phase === 'playing') state.time = (state.time || 0) + dt;

      // Reload completion: refills the weapon that was actually reloading,
      // which may not be the one in hand if the player swapped mid-reload.
      if (isReloading() === false && state.reloadingUntil && state.reloadingUntil > 0 && (state.time || 0) >= state.reloadingUntil) {
        var doneKey = reloadingKey || currentKey;
        var doneDef = WEAPONS[doneKey];
        if (doneDef && doneDef.reloadTime && clips[doneKey] < doneDef.clipSize) {
          clips[doneKey] = doneDef.clipSize;
        }
        state.reloadingUntil = 0;
        reloadingKey = null;
        syncStateAmmo();
      }

      preGrounded = physics.isGrounded();
      preFallSpeed = body.velocity.y;

      // Horizontal input -> desired velocity. The solver turns this into
      // sliding contacts and collisions with soldiers.
      var moveX = 0;
      var moveZ = 0;
      if (state.phase === 'playing') {
        if (keys['KeyW'] || keys['ArrowUp']) moveZ += 1;
        if (keys['KeyS'] || keys['ArrowDown']) moveZ -= 1;
        if (keys['KeyD'] || keys['ArrowRight']) moveX += 1;
        if (keys['KeyA'] || keys['ArrowLeft']) moveX -= 1;
      }
      var input = moveX !== 0 || moveZ !== 0;
      var run = keys['ShiftLeft'] || keys['ShiftRight'];
      var speed = WALK_SPEED * (run ? RUN_MULT : 1);
      var targetVx = 0;
      var targetVz = 0;
      if (input) {
        forwardVec.set(-Math.sin(yaw), 0, -Math.cos(yaw));
        rightVec.set(Math.cos(yaw), 0, -Math.sin(yaw));
        var dir = new THREE.Vector3()
          .addScaledVector(forwardVec, moveZ)
          .addScaledVector(rightVec, moveX);
        if (dir.lengthSq() > 0) dir.normalize();
        targetVx = dir.x * speed;
        targetVz = dir.z * speed;
      }
      var rate;
      if (input) rate = (preGrounded ? GROUND_ACCEL : AIR_ACCEL) * dt;
      else rate = (preGrounded ? GROUND_DECEL : AIR_ACCEL * 0.35) * dt;
      body.velocity.x = approach(body.velocity.x, targetVx, rate);
      body.velocity.z = approach(body.velocity.z, targetVz, rate);

      // Jump (input buffered ~0.2 s for a little forgiveness).
      if (jumpQueued) {
        if (preGrounded && state.phase === 'playing') {
          body.velocity.y = JUMP_SPEED;
          jumpQueued = false;
        } else if ((state.time || 0) - jumpQueuedAt > 0.2) {
          jumpQueued = false;
        }
      }

      // Head bob + footstep cadence.
      var horizontalSpeed = Math.hypot(body.velocity.x, body.velocity.z);
      var moving = horizontalSpeed > 0.4 && preGrounded;
      bobBlend = approach(bobBlend, moving ? 1 : 0, dt * 6);
      if (moving) bobPhase += horizontalSpeed * dt * 1.9;
      stepAccum += (moving ? horizontalSpeed : 0) * dt;
      if (stepAccum > STEP_DISTANCE * (run ? 1.15 : 1)) {
        stepAccum = 0;
        sfxCall('step');
      }

      // Weapon kicks, landing dip and melee swing recovery.
      recoil = Math.max(0, recoil - dt * 3.2);
      pitchKick *= Math.exp(-9 * dt);
      yawKick *= Math.exp(-9 * dt);
      landDip *= Math.exp(-7 * dt);
      meleeSwing = Math.max(0, meleeSwing - dt);
      if (Math.abs(pitchKick) < 1e-5) pitchKick = 0;
      if (Math.abs(yawKick) < 1e-5) yawKick = 0;

      updateCannonChoice(dt);

      // Viewmodel bob + recoil + sable swing + reload dip.
      var bobY = Math.sin(bobPhase * 2) * 0.014 * bobBlend;
      var bobX = Math.cos(bobPhase) * 0.010 * bobBlend;
      var reloadDef = WEAPONS[currentKey];
      var reloadDip = isReloading() && reloadDef
        ? Math.sin(reloadProgress(state.reloadingUntil, state.time, reloadDef.reloadTime) * Math.PI)
        : 0;
      viewmodel.position.set(
        VM_BASE.x + bobX,
        VM_BASE.y + bobY - reloadDip * 0.14,
        VM_BASE.z + recoil * 0.18
      );
      viewmodel.rotation.x = recoil * 0.22 + reloadDip * 0.25;
      viewmodel.rotation.z = meleeSwing > 0
        ? Math.sin((0.32 - meleeSwing) / 0.32 * Math.PI) * 0.5
        : 0;

      state.reloading = isReloading();
      return player;
    }

    // --- Camera follows the body after the physics step ---
    function syncCamera(dt) {
      var groundedNow = physics.isGrounded();
      if (!preGrounded && groundedNow && preFallSpeed < -3) {
        landDip = Math.min(0.16, -preFallSpeed * 0.02);
        sfxCall('step');
      }
      lastGrounded = groundedNow;

      var shake = effects && typeof effects.getShake === 'function'
        ? effects.getShake()
        : { x: 0, y: 0, z: 0, roll: 0 };
      var bobY = Math.sin(bobPhase * 2) * 0.022 * bobBlend;
      var bobX = Math.cos(bobPhase) * 0.015 * bobBlend;
      var eyeY = body.position.y + physics.EYE_OFFSET - landDip;
      camera.position.set(
        body.position.x + bobX + shake.x,
        eyeY + bobY + shake.y,
        body.position.z + shake.z
      );
      camera.rotation.x = pitch + pitchKick + shake.roll * 0.35;
      camera.rotation.y = yaw + yawKick;
      camera.rotation.z = shake.roll;
    }

    function addShake(amount) {
      if (effects && typeof effects.addShake === 'function') effects.addShake(amount);
    }

    var player = {
      update: update,
      syncCamera: syncCamera,
      shoot: shoot,
      reload: reload,
      switchWeapon: switchWeapon,
      setLoadout: setLoadout,
      getWeaponKey: getWeaponKey,
      useItemSlot: useItemSlot,
      throwGrenade: throwGrenade,
      tryPickup: tryPickup,
      getInventory: function () { return inventory; },
      inventory: inventory,
      fireCannon: fireCannon,
      addShake: addShake,
      state: state,
      enemies: enemies,
      physics: physics,
      body: body,
      camera: camera,
      isGrounded: function () { return lastGrounded; },
      getActiveCannon: function () { return activeCannon; },
    };

    syncViewmodel();
    syncStateAmmo();
    syncCamera(0);

    return player;
  }

  return createPlayer;
})();

if (typeof module !== 'undefined') module.exports = { createPlayer: createPlayer };

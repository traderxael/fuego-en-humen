// Enemy waves and AI: British landing force attacking the Humen fort.
// Browser global `Enemies`; also guarded for Node tooling (never requires
// THREE at import time — THREE is only touched inside functions, and only
// when a scene is actually used).
//
// Contract:
//   Enemies.spawnWave(scene, waveDef, spawnInto, waveIndex) -> Array<Object3D>
//     Creates the wave. `scene` is a THREE.Scene (or any Object3D parent).
//     `waveDef` is one entry of WAVES: { count, interval, hp, damage }.
//     `spawnInto` (optional but strongly recommended): the SAME array reference
//       that was passed to createPlayer's `hooks.enemies`, so the player's
//       raycast/melee sees the enemies. Spawned enemies are pushed into it;
//       without it an internal list is used and the player will NOT see them.
//     `waveIndex` (optional, 1-based): used to decide the wave>=2 artillery
//       unit. Falls back to locating waveDef inside the WAVES global (or the
//       CommonJS config), else 1.
//     The first soldier spawns immediately; the rest trickle in one per
//       `waveDef.interval` seconds, driven by updateEnemies. Waves >= 2 also
//       get 1 artillery piece on the beach (fires every 6 s).
//     Returns the array the enemies were pushed into.
//
//   Enemies.updateEnemies(dt, player, world, callbacks) -> void
//     dt      : seconds since last frame (clamped internally).
//     player  : the object returned by createPlayer (or any duck-typed object
//               with `.enemies` and a camera: `.camera.position` is read as the
//               player position; `.state` is read for fortIntegrity/phase).
//     world   : the object returned by buildWorld ({ fort, ... }); the north
//               parapet plane is derived from `world.fort.position.z - 14`
//               (fort-local parapet offset); falls back to world z = 6.
//     callbacks (all optional, all guarded):
//       onEnemyDamagePlayer(dmg) - soldier shot / melee hit the player
//       onEnemyDamageFort(dmg)   - soldier/artillery hit the fort (wall/cannon fire)
//       onEnemyKilled(enemy)     - enemy hp dropped to <= 0 (enemy already removed)
//
//   Enemies.flashEnemy(enemy) -> void  (emissive hit flash, ~80 ms; wired to
//                                       the player's onEnemyHit hook in main.js)
//   Enemies.pendingSpawns() -> number  (soldiers not yet trickled in; used by
//                                       main.js to detect a cleared wave)
//
// Per-enemy behaviour:
//   kind 'soldier': state machine 'advance' | 'shoot' | 'melee'.
//     advance - steer toward the north parapet (per-enemy lateral offset so
//               they don't stack); simple separation between nearby soldiers.
//     shoot   - halted once within 30 m of the player; fires on a cooldown
//               (damage via onEnemyDamagePlayer). Skipped entirely when the
//               fort is already below LOW_FORT_INTEGRITY — the wave then makes
//               a straight melee rush on the wall.
//     melee   - within ~2.5 m of the player or of the north wall: attacks on
//               a cooldown. Hits the player if in range, otherwise the fort
//               (onEnemyDamageFort).
//   kind 'artillery': static; every 6 s fires on the fort (onEnemyDamageFort(8)).
//     90 hp. Spawned one per wave from wave 2 onward (in addition to the
//     waveDef.count soldiers).
//
// Dead enemies (userData.hp <= 0) are removed from the scene AND spliced out
// of the shared enemies array, then reported via callbacks.onEnemyKilled.
// Wave-clear detection: `Enemies.pendingSpawns() === 0 && enemies.length === 0`.

var Enemies = (function () {
  var steerFn = (typeof steerTowards !== 'undefined')
    ? steerTowards
    : (typeof require !== 'undefined' ? require('./logic/combat').steerTowards : null);

  var ModelsRef = (typeof Models !== 'undefined')
    ? Models
    : (typeof require !== 'undefined' ? require('./models') : null);

  var SPAWN_POINTS = [
    { x: -24, z: -40 },
    { x: -12, z: -43 },
    { x: 0, z: -38 },
    { x: 12, z: -43 },
    { x: 24, z: -40 },
  ];

  var SPEED = 2.4;               // soldier advance speed, m/s
  var SHOOT_RANGE = 30;          // m from player: stop and shoot
  var MELEE_RANGE = 2.5;         // m from player or north wall: melee
  var WALL_HALF_SPAN = 18;       // aim at the middle 36 m of the 40 m parapet
  var SEPARATION_RADIUS = 1.4;   // m; push apart closer soldiers
  var SEPARATION_PUSH = 0.9;     // m/s lateral shove
  var SHOOT_COOLDOWN = 2.6;      // s between soldier shots
  var MELEE_COOLDOWN = 1.1;      // s between melee swings
  var LOW_FORT_INTEGRITY = 50;   // below this soldiers rush the wall for melee
  var ARTILLERY_HP = 90;
  var ARTILLERY_INTERVAL = 6.0;  // s between artillery rounds
  var ARTILLERY_DAMAGE = 8;      // fort damage per artillery round
  var FLASH_SECONDS = 0.08;      // 80 ms emissive hit flash
  var FLASH_HEX = 0xffdd66;

  // Trickle-spawn state (one wave pending at a time; main.js spawns the next
  // wave only after the previous one is fully cleared).
  var pending = {
    remaining: 0,
    interval: 1,
    timer: 0,
    waveDef: null,
    spawnInto: null,
    scene: null,
  };

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function pendingSpawns() { return pending.remaining; }

  function resolveWaveIndex(waveDef, waveIndex) {
    if (typeof waveIndex === 'number' && isFinite(waveIndex)) return waveIndex;
    var waves = null;
    if (typeof WAVES !== 'undefined') waves = WAVES;
    else if (typeof require !== 'undefined') {
      try { waves = require('./logic/config').WAVES; } catch (e) { waves = null; }
    }
    var idx = waves ? waves.indexOf(waveDef) : -1;
    return idx >= 0 ? idx + 1 : 1;
  }

  function playerPosition(player) {
    var cam = player && player.camera;
    if (cam) {
      if (typeof cam.getWorldPosition === 'function' && typeof THREE !== 'undefined') {
        return cam.getWorldPosition(new THREE.Vector3());
      }
      if (cam.position) return cam.position;
    }
    if (player && player.position) return player.position; // duck-typed fallback
    return { x: 0, y: 1.7, z: 24 };
  }

  function northWallZ(world) {
    if (world && world.fort && world.fort.position && typeof world.fort.position.z === 'number') {
      return world.fort.position.z - 14; // fort-local north parapet offset
    }
    return 6; // known layout fallback: fort at z=20, parapet local z=-14
  }

  function collectEmissiveMaterials(root) {
    var mats = [];
    if (!root || typeof root.traverse !== 'function') return mats;
    root.traverse(function (node) {
      if (!node || !node.material) return;
      var list = Array.isArray(node.material) ? node.material : [node.material];
      for (var i = 0; i < list.length; i++) {
        var m = list[i];
        if (m && m.emissive) {
          mats.push({ m: m, hex: m.emissive.getHex(), intensity: m.emissiveIntensity || 1 });
        }
      }
    });
    return mats;
  }

  function flashEnemy(enemy) {
    if (!enemy) return;
    if (!enemy.userData.flashMats) enemy.userData.flashMats = collectEmissiveMaterials(enemy);
    var mats = enemy.userData.flashMats;
    for (var i = 0; i < mats.length; i++) {
      mats[i].m.emissive.setHex(FLASH_HEX);
      mats[i].m.emissiveIntensity = 0.9;
    }
    enemy.userData.flashT = FLASH_SECONDS;
  }

  function tickFlash(enemy, dt) {
    var t = enemy.userData.flashT || 0;
    if (t <= 0) return;
    t -= dt;
    enemy.userData.flashT = t;
    if (t > 0) return;
    var mats = enemy.userData.flashMats || [];
    for (var i = 0; i < mats.length; i++) {
      mats[i].m.emissive.setHex(mats[i].hex);
      mats[i].m.emissiveIntensity = mats[i].intensity;
    }
  }

  function trackMaterials(enemy) {
    enemy.userData.flashMats = collectEmissiveMaterials(enemy);
    enemy.userData.flashT = 0;
  }

  function makeSoldier(waveDef) {
    if (!ModelsRef || typeof ModelsRef.makeBritishSoldier !== 'function') {
      throw new Error('Enemies.spawnWave: Models.makeBritishSoldier unavailable');
    }
    var s = ModelsRef.makeBritishSoldier();
    s.userData.type = 'british-soldier'; // keep the model's tag
    s.userData.kind = 'soldier';
    s.userData.hp = waveDef.hp;
    s.userData.damage = waveDef.damage;
    s.userData.aiState = 'advance';
    s.userData.cooldown = 0.5 + Math.random() * 1.2; // desync first volley
    s.userData.offsetX = (Math.random() * 2 - 1) * 2.5; // lateral jitter at the parapet
    s.userData.targetX = 0; // set from spawn point
    return s;
  }

  function makeArtillery() {
    if (!ModelsRef || typeof ModelsRef.makeCannon !== 'function') {
      throw new Error('Enemies.spawnWave: Models.makeCannon unavailable');
    }
    var c = ModelsRef.makeCannon();
    c.userData.type = 'enemy-artillery';
    c.userData.kind = 'artillery';
    c.userData.hp = ARTILLERY_HP;
    c.userData.damage = ARTILLERY_DAMAGE;
    c.userData.cooldown = ARTILLERY_INTERVAL * 0.5; // first round lands sooner
    return c;
  }

  function placeAtSpawnPoint(enemy, spawnList, index) {
    var sp = spawnList[index % spawnList.length];
    var jitterX = (Math.random() * 2 - 1) * 1.5;
    var jitterZ = (Math.random() * 2 - 1) * 2.0;
    enemy.position.set(clamp(sp.x + jitterX, -30, 30), 0, sp.z + jitterZ);
    enemy.userData.targetX = clamp(sp.x, -WALL_HALF_SPAN, WALL_HALF_SPAN);
    enemy.rotation.y = Math.PI; // model faces -Z; we want it facing the fort (+Z)
    return enemy;
  }

  function spawnIntoWave(scene, waveDef, into, spawnIndex) {
    var enemy = makeSoldier(waveDef);
    placeAtSpawnPoint(enemy, pending.spawnPoints || SPAWN_POINTS, spawnIndex);
    scene.add(enemy);
    trackMaterials(enemy);
    if (into) into.push(enemy);
    return enemy;
  }

  function spawnWave(scene, waveDef, spawnInto, waveIndex) {
    if (!scene) throw new Error('Enemies.spawnWave: scene is required');
    if (!waveDef) throw new Error('Enemies.spawnWave: waveDef is required');
    var into = Array.isArray(spawnInto) ? spawnInto : [];
    var index = resolveWaveIndex(waveDef, waveIndex);

    // Reset pending trickle state for this wave.
    pending.waveDef = waveDef;
    pending.interval = waveDef.interval || 1;
    pending.timer = pending.interval;
    pending.spawnInto = into;
    pending.scene = scene;
    pending.spawnPoints = SPAWN_POINTS;

    // Immediate first soldier so the wave is on the field right away.
    var first = makeSoldier(waveDef);
    placeAtSpawnPoint(first, SPAWN_POINTS, Math.floor(Math.random() * SPAWN_POINTS.length));
    scene.add(first);
    trackMaterials(first);
    into.push(first);
    pending.remaining = Math.max(0, (waveDef.count || 0) - 1);
    pending.spawnedCount = 1;

    // Objective artillery: 1 per wave from wave 2 onward (extra, on top of the
    // soldier count — it is a gun crew, not a body to count against the wave).
    if (index >= 2) {
      var gun = makeArtillery();
      var gx = (Math.random() * 2 - 1) * 20;
      gun.position.set(gx, 0, -36 - Math.random() * 4);
      gun.rotation.y = Math.PI; // barrel toward the fort
      scene.add(gun);
      trackMaterials(gun);
      into.push(gun);
    }

    return into;
  }

  function removeDead(list, i) {
    var enemy = list[i];
    if (enemy.userData) enemy.userData.dead = true;
    if (enemy.parent) enemy.parent.remove(enemy);
    list.splice(i, 1);
    return enemy;
  }

  function updateEnemies(dt, player, world, callbacks) {
    dt = clamp(dt || 0, 0, 0.1);
    callbacks = callbacks || {};
    var enemies = (player && Array.isArray(player.enemies)) ? player.enemies : [];
    var playerPos = playerPosition(player);
    var wallZ = northWallZ(world);
    var fortIntegrity = (player && player.state && typeof player.state.fortIntegrity === 'number')
      ? player.state.fortIntegrity
      : 100;
    var wallRush = fortIntegrity < LOW_FORT_INTEGRITY;

    // --- Trickle spawning ---
    if (pending.remaining > 0) {
      pending.timer -= dt;
      while (pending.timer <= 0 && pending.remaining > 0) {
        var idx = pending.spawnedCount || 0;
        var soldier = spawnIntoWave(pending.scene, pending.waveDef, pending.spawnInto, idx);
        pending.spawnedCount = idx + 1;
        pending.remaining -= 1;
        pending.timer += pending.interval;
      }
    }

    // --- Per-enemy AI (backwards so splice-on-death is safe) ---
    for (var i = enemies.length - 1; i >= 0; i--) {
      var enemy = enemies[i];
      if (!enemy || !enemy.userData) continue;

      // Killed by the player this frame (hp decremented in js/player.js).
      if (typeof enemy.userData.hp === 'number' && enemy.userData.hp <= 0) {
        var deadEnemy = removeDead(enemies, i);
        if (typeof callbacks.onEnemyKilled === 'function') callbacks.onEnemyKilled(deadEnemy);
        continue;
      }

      tickFlash(enemy, dt);

      var pos = enemy.position;
      var dx = playerPos.x - pos.x;
      var dz = playerPos.z - pos.z;
      var distPlayer = Math.sqrt(dx * dx + dz * dz);
      var distWall = wallZ - pos.z; // >0 while on the beach; 0 at the parapet

      if (enemy.userData.kind === 'artillery') {
        enemy.userData.cooldown -= dt;
        if (enemy.userData.cooldown <= 0) {
          enemy.userData.cooldown = ARTILLERY_INTERVAL;
          flashEnemy(enemy); // muzzle flash
          if (typeof callbacks.onEnemyDamageFort === 'function') {
            callbacks.onEnemyDamageFort(ARTILLERY_DAMAGE);
          }
        }
        continue;
      }

      // --- Soldier state machine ---
      var atWall = distWall <= MELEE_RANGE;
      var atPlayer = distPlayer <= MELEE_RANGE;

      if (atPlayer || atWall) {
        enemy.userData.aiState = 'melee';
      } else if (!wallRush && distPlayer <= SHOOT_RANGE) {
        enemy.userData.aiState = 'shoot';
      } else {
        enemy.userData.aiState = 'advance';
      }

      if (enemy.userData.aiState === 'advance') {
        var tx = clamp((enemy.userData.targetX || 0) + (enemy.userData.offsetX || 0),
          -WALL_HALF_SPAN, WALL_HALF_SPAN);
        var dir = steerFn({ x: pos.x, z: pos.z }, { x: tx, z: wallZ });
        pos.x += dir.x * SPEED * dt;
        pos.z += dir.z * SPEED * dt;
        enemy.rotation.y = Math.atan2(dir.x, dir.z) + Math.PI;

        // Simple separation: shove apart soldiers standing too close.
        for (var j = 0; j < enemies.length; j++) {
          if (j === i) continue;
          var other = enemies[j];
          if (!other || !other.position) continue;
          var ox = pos.x - other.position.x;
          var oz = pos.z - other.position.z;
          var od = Math.sqrt(ox * ox + oz * oz);
          if (od > 0.0001 && od < SEPARATION_RADIUS) {
            var push = (SEPARATION_RADIUS - od) * SEPARATION_PUSH * dt;
            pos.x += (ox / od) * push;
            pos.z += (oz / od) * push;
          }
        }
      } else if (enemy.userData.aiState === 'shoot') {
        // Stand still, face the player, fire on cooldown.
        enemy.rotation.y = Math.atan2(dx, dz) + Math.PI;
        enemy.userData.cooldown -= dt;
        if (enemy.userData.cooldown <= 0) {
          enemy.userData.cooldown = SHOOT_COOLDOWN;
          flashEnemy(enemy); // muzzle flash (doubles as feedback)
          if (typeof callbacks.onEnemyDamagePlayer === 'function') {
            callbacks.onEnemyDamagePlayer(enemy.userData.damage || 10);
          }
        }
      } else { // melee
        enemy.userData.cooldown -= dt;
        // Face whatever we are swinging at.
        if (atPlayer) enemy.rotation.y = Math.atan2(dx, dz) + Math.PI;
        else enemy.rotation.y = Math.PI; // face the wall/fort
        if (enemy.userData.cooldown <= 0) {
          enemy.userData.cooldown = MELEE_COOLDOWN;
          if (atPlayer && typeof callbacks.onEnemyDamagePlayer === 'function') {
            callbacks.onEnemyDamagePlayer(enemy.userData.damage || 10);
          } else if (typeof callbacks.onEnemyDamageFort === 'function') {
            callbacks.onEnemyDamageFort(enemy.userData.damage || 10);
          }
        }
      }
    }
  }

  return {
    spawnWave: spawnWave,
    updateEnemies: updateEnemies,
    flashEnemy: flashEnemy,
    pendingSpawns: pendingSpawns,
    SPAWN_POINTS: SPAWN_POINTS,
  };
})();

if (typeof module !== 'undefined') module.exports = Enemies;

// Enemy waves and AI: British landing force attacking the Humen fort.
// Browser global `Enemies`; also guarded for Node tooling.
//
// Physics integration:
//   Enemies.bindPhysics(physics) before spawnWave.
//   Every soldier is a THREE.Group pivot (body centre y=0.9) whose visual is
//   offset -0.9 so the feet sit on the ground. A cannon-es box body follows
//   the pivot; AI steers body velocities, so walls, soldiers and knockback are
//   resolved by the solver.
//   Musket shots are real projectiles (spawned in physics); a soldier only
//   fires when it has line of sight, otherwise it keeps advancing.
//   Deaths ragdoll the body; the pivot stays as a corpse for CORPSE_SECONDS.
//
// Contract:
//   Enemies.bindPhysics(physics)
//   Enemies.spawnWave(scene, waveDef, spawnInto, waveIndex) -> Array<pivot>
//   Enemies.updateEnemies(dt, player, world, callbacks)
//     callbacks.onEnemyDamagePlayer(dmg)   soldier melee hit the player
//     callbacks.onEnemyDamageFort(dmg)     fallback melee channel
//     callbacks.onEnemyReachWall(enemy)    soldier swinging at the parapet
//     callbacks.onEnemyKilled(enemy)       enemy hp reached 0 (already removed)
//     callbacks.effects                    js/effects.js instance (optional)
//   Enemies.applyHit(enemy, damage, dir, point, kind) -> boolean
//   Enemies.flashEnemy(enemy)
//   Enemies.pendingSpawns() -> number
//   Enemies.updateCorpses(dt)
//
// Artillery: static cannon on the beach, one per wave from wave 2. Fires a
// ballistic cannonball every ARTILLERY_INTERVAL seconds at the fort courtyard;
// fort damage and player blast are applied by physics on impact.

var Enemies = (function () {
  var steerFn = (typeof steerTowards !== 'undefined')
    ? steerTowards
    : (typeof require !== 'undefined' ? require('./logic/combat').steerTowards : null);

  var ModelsRef = (typeof Models !== 'undefined')
    ? Models
    : (typeof require !== 'undefined' ? require('./models') : null);

  var RigRef = (typeof Rig !== 'undefined')
    ? Rig
    : (typeof require !== 'undefined' ? require('./rig/humanoid') : null);

  var AnimRef = (typeof RigAnim !== 'undefined')
    ? RigAnim
    : (typeof require !== 'undefined' ? require('./rig/anim') : null);

  // Clips are stateless (they are a pure function of time), so one instance is
  // shared by every soldier and the animator keeps its own clock.
  var CLIP = {};
  function clip(name) {
    if (CLIP[name]) return CLIP[name];
    if (!AnimRef) return null;
    var C = AnimRef.Clips;
    switch (name) {
      case 'idle': CLIP[name] = C.idle(); break;
      case 'walk': CLIP[name] = C.walk(1); break;
      case 'aim': CLIP[name] = C.aim(); break;
      case 'melee': CLIP[name] = C.melee(); break;
      case 'fire': CLIP[name] = C.fire(); break;
      case 'hit': CLIP[name] = C.hit(); break;
      case 'death': CLIP[name] = C.death(); break;
      case 'limp': CLIP[name] = C.limp(); break;
      case 'kneel': CLIP[name] = C.kneel(); break;
      default: return null;
    }
    return CLIP[name];
  }

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
  var SEPARATION_PUSH = 1.1;     // lateral shove (m/s at contact)
  var SHOOT_COOLDOWN = 2.6;      // s between soldier shots
  var MELEE_COOLDOWN = 1.1;      // s between melee swings
  var LOW_FORT_INTEGRITY = 50;   // below this soldiers rush the wall for melee
  var ARTILLERY_HP = 90;
  var ARTILLERY_INTERVAL = 6.0;  // s between artillery rounds
  var ARTILLERY_DAMAGE = 8;      // fort damage per artillery round
  var FLASH_SECONDS = 0.08;      // 80 ms emissive hit flash
  var FLASH_HEX = 0xffdd66;
  var CORPSE_SECONDS = 12;
  var ENEMY_TURN_RATE = 5.0;     // rad/s
  var ENEMY_ACCEL = 14;          // m/s^2 toward desired velocity
  var ENEMY_DECEL = 18;
  var ENEMY_SPREAD = 0.012;      // radians, musket dispersion
  var ENEMY_MUZZLE_Y = 0.35;     // above the body centre -> world ~1.25 m
  var ARTILLERY_TARGET = { minX: -14, maxX: 14, minZ: 8, maxZ: 16 };
  var CENTER_Y = (typeof GamePhysics !== 'undefined' && GamePhysics.ENEMY_CENTER_Y) || 0.9;

  var physicsRef = null;

  // Trickle-spawn state (one wave pending at a time; main.js spawns the next
  // wave only after the previous one is fully cleared).
  var pending = {
    remaining: 0,
    interval: 1,
    timer: 0,
    waveDef: null,
    spawnInto: null,
    scene: null,
    spawnedCount: 0,
    spawnPoints: SPAWN_POINTS,
  };

  var corpses = [];

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  // --- Animation ---------------------------------------------------------
  // The rig follows the AI: marching while advancing, shouldered musket
  // while shooting, bayonet thrust when it reaches the wall.
  function updateEnemyAnim(enemy, dt, speed) {
    var u = enemy.userData;
    var anim = u.animator;
    if (!anim) return;
    var want = u.aiState === 'shoot' ? 'aim'
      : u.aiState === 'melee' ? 'melee'
        : 'advance';
    if (want !== u.animState) {
      u.animState = want;
      if (want === 'melee') anim.play(clip('melee'), { fade: 0.12 });
      else if (want === 'aim') anim.play(clip('aim'), { fade: 0.28 });
      else anim.play(clip('walk'), { fade: 0.28 });
    }
    anim.speed = want === 'advance' ? clamp((speed || 0) / SPEED, 0.35, 2.4) : 1;
    anim.update(dt);
  }

  // An officer on the field steadies the column: better aim, faster advance.
  function officerAlive(enemies) {
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (e && e.userData && e.userData.archetype === 'officer' && !e.userData.dead) return true;
    }
    return false;
  }

  function approach(value, target, maxDelta) {
    if (value < target) return Math.min(value + maxDelta, target);
    if (value > target) return Math.max(value - maxDelta, target);
    return value;
  }

  function angleTowards(current, target, maxStep) {
    if (typeof PhysicsLogic !== 'undefined' && PhysicsLogic.turnTowards) {
      return PhysicsLogic.turnTowards(current, target, maxStep);
    }
    var delta = target - current;
    return current + clamp(delta, -maxStep, maxStep);
  }

  function bindPhysics(physics) { physicsRef = physics; }

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
    var pb = player && player.physics && player.physics.playerBody;
    if (pb && pb.position) return pb.position;
    var cam = player && player.camera;
    if (cam) {
      if (typeof cam.getWorldPosition === 'function' && typeof THREE !== 'undefined') {
        return cam.getWorldPosition(new THREE.Vector3());
      }
      if (cam.position) return cam.position;
    }
    if (player && player.position) return player.position;
    return { x: 0, y: 1.7, z: 24 };
  }

  function northWallZ(world) {
    if (world && world.fort && world.fort.position && typeof world.fort.position.z === 'number') {
      return world.fort.position.z - 14; // fort-local north parapet offset
    }
    return 6;
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

  // Archetypes of the landing force. The officer is the one whose fall
  // breaks the momentum of the column.
  var ARCHETYPES = {
    rifleman: { variant: 'british', hp: 1, damage: 1, speed: 1, score: 100, label: 'Fusilero' },
    marine: { variant: 'marine', hp: 1.3, damage: 1.15, speed: 1.25, score: 175, label: 'Royal Marine' },
    officer: { variant: 'officer', hp: 1.9, damage: 1.25, speed: 1.1, score: 400, label: 'Oficial' },
  };

  function attachRigWeapon(rig, visual) {
    if (!rig || !rig.weapon || !visual) return;
    visual.add(rig.weapon);
    rig.weapon.position.set(-0.3, 0.92, 0.03);
    rig.weapon.rotation.set(Math.PI / 2, 0, 0);
    rig.weapon.scale.setScalar(1);
  }

  function attachGlbVisual(pivot, rig, u) {
    if (!ModelsRef || typeof ModelsRef.hasBritishModel !== 'function' || !ModelsRef.hasBritishModel()) return null;
    if (typeof ModelsRef.makeBritishSoldier !== 'function') return null;
    var visual = ModelsRef.makeBritishSoldier();
    if (!visual) return null;
    visual.position.y = -CENTER_Y;
    attachRigWeapon(rig, visual);
    pivot.add(visual);
    if (u) u.visual = visual;
    return visual;
  }

  function makeSoldier(waveDef, archetypeName) {
    if (!RigRef || typeof RigRef.buildSoldier !== 'function') {
      throw new Error('Enemies.spawnWave: Rig.buildSoldier unavailable');
    }
    var arch = ARCHETYPES[archetypeName] || ARCHETYPES.rifleman;
    var rig = RigRef.buildSoldier({ faction: 'british', variant: arch.variant });
    var pivot = new THREE.Group();
    pivot.position.y = CENTER_Y;
    // The animator starts with no clip, so the march has to be started here:
    // the AI only plays a new clip when the state actually changes.
    var animator = AnimRef ? new AnimRef.Animator(rig) : null;
    if (animator) animator.play(clip('walk'), { fade: 0 });
    pivot.userData = {
      type: 'british-soldier',
      kind: 'soldier',
      hp: Math.round(waveDef.hp * arch.hp),
      damage: Math.round(waveDef.damage * arch.damage),
      aiState: 'advance',
      animState: 'advance',
      cooldown: 0.5 + Math.random() * 1.2, // desync first volley
      offsetX: (Math.random() * 2 - 1) * 2.5,
      targetX: 0,
      yaw: Math.PI,
      stagger: 0,
      rig: rig,
      animator: animator,
      archetype: archetypeName || 'rifleman',
      score: arch.score,
      dead: false,
    };
    if (!attachGlbVisual(pivot, rig, pivot.userData)) {
      rig.group.position.y = -CENTER_Y; // pivot sits at the body centre
      pivot.add(rig.group);
    }
    return pivot;
  }

  function refreshSoldierVisuals(list) {
    if (!Array.isArray(list) || !ModelsRef || typeof ModelsRef.makeBritishSoldier !== 'function') return 0;
    var refreshed = 0;
    for (var i = 0; i < list.length; i++) {
      var enemy = list[i];
      var u = enemy && enemy.userData;
      if (!u || u.kind !== 'soldier' || u.dead || u.visual) continue;
      if (!attachGlbVisual(enemy, u.rig, u)) continue;
      if (u.rig && u.rig.group && u.rig.group.parent) u.rig.group.parent.remove(u.rig.group);
      trackMaterials(enemy);
      refreshed++;
    }
    return refreshed;
  }

  function makeArtillery() {
    if (!ModelsRef || typeof ModelsRef.makeCannon !== 'function') {
      throw new Error('Enemies.spawnWave: Models.makeCannon unavailable');
    }
    var gun = ModelsRef.makeCannon();
    gun.userData = {
      type: 'enemy-artillery',
      kind: 'artillery',
      hp: ARTILLERY_HP,
      damage: ARTILLERY_DAMAGE,
      aiState: 'static',
      cooldown: ARTILLERY_INTERVAL * 0.5, // first round lands sooner
      yaw: Math.PI,
      dead: false,
    };
    return gun;
  }

  function placeSoldier(enemy, spawnList, index) {
    var sp = spawnList[index % spawnList.length];
    var jitterX = (Math.random() * 2 - 1) * 1.5;
    var jitterZ = (Math.random() * 2 - 1) * 2.0;
    enemy.position.set(clamp(sp.x + jitterX, -30, 30), CENTER_Y, sp.z + jitterZ);
    enemy.userData.targetX = clamp(sp.x, -WALL_HALF_SPAN, WALL_HALF_SPAN);
    enemy.rotation.y = Math.PI; // model faces -Z; face the fort (+Z)
    return enemy;
  }

  function attachBody(enemy, kind) {
    if (!physicsRef) return null;
    var entry = physicsRef.addEnemyBody(enemy, kind);
    enemy.userData.entry = entry;
    enemy.userData.body = entry.body;
    return entry;
  }

  function archetypeFor(waveDef, index) {
    var list = waveDef && waveDef.archetypes;
    if (!list || !list.length) return 'rifleman';
    return list[index % list.length];
  }

  function spawnIntoWave(scene, waveDef, into, spawnIndex) {
    var enemy = makeSoldier(waveDef, archetypeFor(waveDef, spawnIndex));
    placeSoldier(enemy, pending.spawnPoints || SPAWN_POINTS, spawnIndex);
    scene.add(enemy);
    trackMaterials(enemy);
    attachBody(enemy, 'soldier');
    if (into) into.push(enemy);
    return enemy;
  }

  function spawnWave(scene, waveDef, spawnInto, waveIndex) {
    if (!scene) throw new Error('Enemies.spawnWave: scene is required');
    if (!waveDef) throw new Error('Enemies.spawnWave: waveDef is required');
    var into = Array.isArray(spawnInto) ? spawnInto : [];
    var index = resolveWaveIndex(waveDef, waveIndex);

    pending.waveDef = waveDef;
    pending.interval = waveDef.interval || 1;
    pending.timer = pending.interval;
    pending.spawnInto = into;
    pending.scene = scene;
    pending.spawnPoints = SPAWN_POINTS;

    var first = makeSoldier(waveDef, archetypeFor(waveDef, 0));
    placeSoldier(first, SPAWN_POINTS, Math.floor(Math.random() * SPAWN_POINTS.length));
    scene.add(first);
    trackMaterials(first);
    attachBody(first, 'soldier');
    into.push(first);
    pending.remaining = Math.max(0, (waveDef.count || 0) - 1);
    pending.spawnedCount = 1;

    // Objective artillery: a gun crew on the beach. It is not a body to
    // count against the wave, but it is the priority target.
    var gunCount = typeof waveDef.artillery === 'number'
      ? waveDef.artillery
      : (index >= 2 ? 1 : 0);
    for (var gi = 0; gi < gunCount; gi++) {
      var gun = makeArtillery();
      var gx = (Math.random() * 2 - 1) * 20;
      gun.position.set(gx, 0, -36 - Math.random() * 4 - gi * 5);
      gun.rotation.y = Math.PI; // barrel toward the fort
      scene.add(gun);
      trackMaterials(gun);
      attachBody(gun, 'artillery');
      into.push(gun);
    }

    return into;
  }

  // Hits are applied by main.js (projectiles and melee both route here).
  function applyHit(enemy, damage, dir, point, kind) {
    if (!enemy || !enemy.userData) return false;
    var u = enemy.userData;
    if (typeof u.hp !== 'number' || u.hp <= 0) return false;
    u.hp -= damage;
    flashEnemy(enemy);

    var dx = dir && Number.isFinite(dir.x) ? dir.x : 0;
    var dz = dir && Number.isFinite(dir.z) ? dir.z : 1;
    var len = Math.hypot(dx, dz);
    if (len < 1e-6) { dx = 0; dz = 1; len = 1; }
    dx /= len;
    dz /= len;
    u.lastHitDir = { x: dx, z: dz };
    u.stagger = Math.max(u.stagger || 0, 0.28);
    if (u.animator) u.animator.playAdditive(clip('hit'), 1);

    var body = u.body;
    if (body && u.kind === 'soldier') {
      var strength = kind === 'cannon' ? 2.0 : (kind === 'sable' ? 2.4 : 0.7);
      body.velocity.x += dx * strength;
      body.velocity.z += dz * strength;
    }
    return true;
  }

  function removeDead(list, i) {
    var enemy = list[i];
    var u = enemy.userData || {};
    u.dead = true;
    var dir = u.lastHitDir || { x: 0, z: -1 };

    // The corpse leaves the AI loop, so clear any hit-flash emissive here.
    var mats = u.flashMats || [];
    for (var m = 0; m < mats.length; m++) {
      mats[m].m.emissive.setHex(mats[m].hex);
      mats[m].m.emissiveIntensity = mats[m].intensity;
    }
    u.flashT = 0;

    if (u.kind === 'soldier') {
      if (ModelsRef && typeof ModelsRef.stopSoldierAnimation === 'function') {
        ModelsRef.stopSoldierAnimation(u.visual);
      }
      if (physicsRef && u.entry) physicsRef.ragdoll(u.entry, dir.x, dir.z);
      if (u.animator) {
        u.animator.play(clip('death'), {
          fade: 0.05,
          onEnd: function () {
            if (u.animator) u.animator.play(clip('limp'), { fade: 0.2 });
          },
        });
      }
      corpses.push({ enemy: enemy, timer: CORPSE_SECONDS });
      list.splice(i, 1);
      return enemy;
    }

    // Artillery: the gun is removed outright, with a debris burst.
    if (physicsRef) {
      physicsRef.spawnDebris(
        { x: enemy.position.x, y: 0.8, z: enemy.position.z },
        { x: 0, y: 1, z: 0 },
        5
      );
      if (u.body) physicsRef.removeBody(u.body);
    }
    if (enemy.parent) enemy.parent.remove(enemy);
    list.splice(i, 1);
    return enemy;
  }

  function updateCorpses(dt) {
    for (var i = corpses.length - 1; i >= 0; i--) {
      var c = corpses[i];
      c.timer -= dt;
      if (c.timer > 0) continue;
      var body = c.enemy && c.enemy.userData ? c.enemy.userData.body : null;
      if (physicsRef && body) physicsRef.removeBody(body);
      if (c.enemy && c.enemy.parent) c.enemy.parent.remove(c.enemy);
      corpses.splice(i, 1);
    }
  }

  function fireMusket(enemy, playerPos, effects) {
    var body = enemy.userData.body;
    if (!body) return;
    var pos = body.position;
    var eye = { x: pos.x, y: pos.y + ENEMY_MUZZLE_Y, z: pos.z };
    // Aim at the upper body: a chest-flat shot would always hit the 1.3 m
    // parapet, so British muskets clear it by aiming at the exposed torso/head.
    var target = { x: playerPos.x, y: playerPos.y + 0.75, z: playerPos.z };
    var dx = target.x - eye.x;
    var dy = target.y - eye.y;
    var dz = target.z - eye.z;
    var len = Math.hypot(dx, dy, dz) || 1;
    var dir = { x: dx / len, y: dy / len, z: dz / len };
    var muzzle = {
      x: eye.x + dir.x * 0.45,
      y: eye.y + dir.y * 0.45,
      z: eye.z + dir.z * 0.45,
    };
    if (physicsRef) {
      physicsRef.fireMusket({
        from: muzzle,
        dir: dir,
        spread: ENEMY_SPREAD,
        damage: enemy.userData.damage || 10,
        owner: 'enemy',
      });
    }
    if (effects && typeof effects.muzzleFlash === 'function') {
      effects.muzzleFlash(muzzle, dir);
    }
    if (enemy.userData.animator) enemy.userData.animator.playAdditive(clip('fire'), 1);
    flashEnemy(enemy);
    if (typeof sfx !== 'undefined' && sfx && typeof sfx.enemyShot === 'function') {
      sfx.enemyShot();
    }
  }

  function fireArtillery(enemy, effects) {
    enemy.updateMatrixWorld(true);
    var muzzle = enemy.localToWorld(new THREE.Vector3(0, 0.87, -1.42));
    var tx = ARTILLERY_TARGET.minX + Math.random() * (ARTILLERY_TARGET.maxX - ARTILLERY_TARGET.minX);
    var tz = ARTILLERY_TARGET.minZ + Math.random() * (ARTILLERY_TARGET.maxZ - ARTILLERY_TARGET.minZ);
    var target = { x: tx, y: 0.2, z: tz };
    if (physicsRef) {
      physicsRef.fireCannon({
        from: { x: muzzle.x, y: muzzle.y, z: muzzle.z },
        target: target,
        owner: 'enemy',
        speed: 62,
        blastRadius: 3.4,
        blastDamage: 25,
        fortDamage: ARTILLERY_DAMAGE,
      });
    }
    var dx = target.x - muzzle.x;
    var dz = target.z - muzzle.z;
    var len = Math.hypot(dx, dz) || 1;
    var dir = { x: dx / len, y: 0.15, z: dz / len };
    if (effects && typeof effects.muzzleFlash === 'function') {
      effects.muzzleFlash(muzzle, dir, { big: true });
    }
    flashEnemy(enemy);
    if (typeof sfx !== 'undefined' && sfx) {
      if (typeof sfx.cannon === 'function') sfx.cannon();
      else if (typeof sfx.enemyShot === 'function') sfx.enemyShot();
    }
  }

  function updateEnemies(dt, player, world, callbacks) {
    dt = clamp(dt || 0, 0, 0.1);
    callbacks = callbacks || {};
    updateCorpses(dt);
    var enemies = (player && Array.isArray(player.enemies)) ? player.enemies : [];
    var playerPos = playerPosition(player);
    var wallZ = northWallZ(world);
    var fortIntegrity = (player && player.state && typeof player.state.fortIntegrity === 'number')
      ? player.state.fortIntegrity
      : 100;
    var wallRush = fortIntegrity < LOW_FORT_INTEGRITY;
    var officer = officerAlive(enemies);
    var effects = callbacks.effects || null;

    // --- Trickle spawning ---
    if (pending.remaining > 0) {
      pending.timer -= dt;
      while (pending.timer <= 0 && pending.remaining > 0) {
        var idx = pending.spawnedCount || 0;
        spawnIntoWave(pending.scene, pending.waveDef, pending.spawnInto, idx);
        pending.spawnedCount = idx + 1;
        pending.remaining -= 1;
        pending.timer += pending.interval;
      }
    }

    // --- Per-enemy AI (backwards so splice-on-death is safe) ---
    for (var i = enemies.length - 1; i >= 0; i--) {
      var enemy = enemies[i];
      if (!enemy || !enemy.userData) continue;
      var u = enemy.userData;

      if (typeof u.hp === 'number' && u.hp <= 0) {
        var deadEnemy = removeDead(enemies, i);
        if (typeof callbacks.onEnemyKilled === 'function') callbacks.onEnemyKilled(deadEnemy);
        continue;
      }

      tickFlash(enemy, dt);

      if (u.kind === 'artillery') {
        u.cooldown -= dt;
        if (u.cooldown <= 0) {
          u.cooldown = ARTILLERY_INTERVAL;
          fireArtillery(enemy, effects);
        }
        continue;
      }

      if (u.kind === 'soldier' && ModelsRef && typeof ModelsRef.updateSoldierAnimation === 'function') {
        var animBody = u.body;
        var animSpeed = animBody ? Math.hypot(animBody.velocity.x, animBody.velocity.z) : 0;
        ModelsRef.updateSoldierAnimation(u.visual, dt, animSpeed, u.aiState);
      }

      var body = u.body;
      if (!body) continue;
      var pos = body.position;
      var dx = playerPos.x - pos.x;
      var dz = playerPos.z - pos.z;
      var distPlayer = Math.hypot(dx, dz);
      var distWall = wallZ - pos.z;
      var playerChest = { x: playerPos.x, y: playerPos.y + 0.35, z: playerPos.z };
      var playerHead = { x: playerPos.x, y: playerPos.y + 0.75, z: playerPos.z };
      var eye = { x: pos.x, y: pos.y + ENEMY_MUZZLE_Y, z: pos.z };
      var canSeeChest = physicsRef
        ? physicsRef.lineOfSight(eye, playerChest)
        : true;
      var canSeePlayer = physicsRef
        ? physicsRef.lineOfSight(eye, playerHead)
        : true;
      var atWall = distWall <= MELEE_RANGE;
      var atPlayer = distPlayer <= MELEE_RANGE && canSeeChest;

      if (u.stagger > 0) {
        u.stagger -= dt;
        u.yaw = angleTowards(u.yaw, Math.atan2(dx, dz) + Math.PI, ENEMY_TURN_RATE * dt);
        enemy.rotation.y = u.yaw;
        body.quaternion.setFromEuler(0, u.yaw, 0);
        updateEnemyAnim(enemy, dt, 0);
        continue;
      }

      var desiredX = 0;
      var desiredZ = 0;

      if (atPlayer || atWall) {
        u.aiState = 'melee';
        var face = atPlayer ? Math.atan2(dx, dz) + Math.PI : Math.PI;
        u.yaw = angleTowards(u.yaw, face, ENEMY_TURN_RATE * dt);
        u.cooldown -= dt;
        if (u.cooldown <= 0) {
          u.cooldown = MELEE_COOLDOWN;
          if (atPlayer) {
            if (typeof callbacks.onEnemyDamagePlayer === 'function') {
              callbacks.onEnemyDamagePlayer(u.damage || 10);
            }
          } else {
            if (typeof callbacks.onEnemyReachWall === 'function') {
              callbacks.onEnemyReachWall(enemy);
            } else if (typeof callbacks.onEnemyDamageFort === 'function') {
              callbacks.onEnemyDamageFort(u.damage || 10);
            }
            if (effects && typeof effects.impact === 'function') {
              effects.impact({ x: pos.x, y: 1.0, z: wallZ - 0.7 }, { x: 0, y: 0, z: -1 }, 'wall');
            }
          }
        }
      } else if (!wallRush && distPlayer <= SHOOT_RANGE && canSeePlayer) {
        u.aiState = 'shoot';
        u.yaw = angleTowards(u.yaw, Math.atan2(dx, dz) + Math.PI, ENEMY_TURN_RATE * dt);
        u.cooldown -= dt;
        if (u.cooldown <= 0) {
          u.cooldown = SHOOT_COOLDOWN * (officer ? 0.78 : 1);
          fireMusket(enemy, playerPos, effects);
        }
      } else {
        u.aiState = 'advance';
        var tx = clamp((u.targetX || 0) + (u.offsetX || 0), -WALL_HALF_SPAN, WALL_HALF_SPAN);
        var dir = steerFn({ x: pos.x, z: pos.z }, { x: tx, z: wallZ });
        var pace = SPEED * (officer ? 1.12 : 1);
        desiredX = dir.x * pace;
        desiredZ = dir.z * pace;

        // Soft separation keeps the line from collapsing into one stack.
        for (var j = 0; j < enemies.length; j++) {
          if (j === i) continue;
          var other = enemies[j];
          if (!other || !other.userData || !other.userData.body) continue;
          var op = other.userData.body.position;
          var ox = pos.x - op.x;
          var oz = pos.z - op.z;
          var od = Math.hypot(ox, oz);
          if (od > 0.0001 && od < SEPARATION_RADIUS) {
            var push = (SEPARATION_RADIUS - od) * SEPARATION_PUSH;
            desiredX += (ox / od) * push;
            desiredZ += (oz / od) * push;
          }
        }

        u.yaw = angleTowards(u.yaw, Math.atan2(dir.x, dir.z) + Math.PI, ENEMY_TURN_RATE * dt);
      }

      var wantsMove = Math.abs(desiredX) + Math.abs(desiredZ) > 0.05;
      var rate = (wantsMove ? ENEMY_ACCEL : ENEMY_DECEL) * dt;
      body.velocity.x = approach(body.velocity.x, desiredX, rate);
      body.velocity.z = approach(body.velocity.z, desiredZ, rate);
      enemy.rotation.y = u.yaw;
      body.quaternion.setFromEuler(0, u.yaw, 0);
      updateEnemyAnim(enemy, dt, Math.hypot(body.velocity.x, body.velocity.z));
    }
  }

  return {
    bindPhysics: bindPhysics,
    spawnWave: spawnWave,
    updateEnemies: updateEnemies,
    applyHit: applyHit,
    flashEnemy: flashEnemy,
    pendingSpawns: pendingSpawns,
    updateCorpses: updateCorpses,
    refreshSoldierVisuals: refreshSoldierVisuals,
    SPAWN_POINTS: SPAWN_POINTS,
    CORPSE_SECONDS: CORPSE_SECONDS,
  };
})();

if (typeof module !== 'undefined') module.exports = Enemies;

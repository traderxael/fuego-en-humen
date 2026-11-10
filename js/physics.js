// Rigid-body world (cannon-es) plus projectile raycasts.
// Browser global `GamePhysics`; also guarded for Node tooling.
//
// Why raycasts for projectiles: cannon-es has no continuous collision
// detection, and a 320 m/s musket ball would tunnel through 1.4 m walls.
// Each projectile advances in <=1.25 m segments and asks the world for the
// closest hit, so impacts are exact regardless of frame rate.
//
// Contract:
//   GamePhysics.create(scene, world, effects) -> physics
//     scene   THREE.Scene (only used for debris meshes; optional in Node)
//     world   buildWorld() result: needs `colliders` and `fort`
//     effects optional js/effects.js instance (trails, impacts, explosions)
//   physics.playerBody      CANNON.Body (box, centre y=0.9)
//   physics.isGrounded()
//   physics.addEnemyBody(pivot, kind) -> entry {pivot, body, alive, static}
//   physics.ragdoll(entry, dirX, dirZ)
//   physics.removeBody(body)
//   physics.lineOfSight(from, to) -> boolean
//   physics.aimPoint(origin, dir, maxDistance) -> THREE.Vector3
//   physics.fireMusket({ from, dir, spread, damage, owner })
//   physics.fireCannon({ from, target, owner, damage, blastRadius,
//                        fortDamage, blastDamage, speed })
//   physics.spawnDebris(point, normal, count)
//   physics.step(dt, ctx)
//     ctx.onEnemyHit(enemyPivot, damage, point, dir, kind)
//     ctx.onPlayerHit(damage, point, kind)
//     ctx.onWorldImpact(point, normal, kind) — also fired where a cannonball
//       lands, before the explosion callbacks (kind 'cannon')
//     ctx.onExplosion(point, owner) — exactly once per cannonball impact
//     ctx.onFortImpact(damage, point)
//   physics.getStats() -> { bodies, enemies, projectiles, debris, lastStepMs }

var GamePhysics = (function () {
  var GROUP = { WORLD: 1, PLAYER: 2, ENEMY: 4, DEBRIS: 8 };
  var GRAVITY = 9.81;
  var MUSKET_SPEED = 320;
  var CANNON_SPEED = 62;
  var PLAYER_HALF = { x: 0.35, y: 0.9, z: 0.35 };
  var EYE_OFFSET = 0.8; // camera = body centre + 0.8 -> eyes at 1.7 m
  var ENEMY_HALF = { x: 0.35, y: 0.9, z: 0.35 };
  var ENEMY_CENTER_Y = 0.9;
  var MAX_SEGMENT = 1.25; // projectile ray sub-step, metres
  var MUSKET_LIFE = 1.0;
  var CANNON_LIFE = 5.0;
  var MAX_DEBRIS = 60;

  function requireCannon() {
    if (typeof CANNON === 'undefined') {
      throw new Error('GamePhysics: CANNON (vendor/cannon-es.min.js) is not loaded');
    }
    return CANNON;
  }

  function plain(v) {
    return { x: v.x, y: v.y, z: v.z };
  }

  function distanceToBody(body, point) {
    var dx = body.position.x - point.x;
    var dy = body.position.y - point.y;
    var dz = body.position.z - point.z;
    return Math.hypot(dx, dy, dz);
  }

  function create(scene, world, effects) {
    var C = requireCannon();

    var cworld = new C.World({ gravity: new C.Vec3(0, -GRAVITY, 0) });
    cworld.broadphase = new C.SAPBroadphase(cworld);
    cworld.allowSleep = true;
    cworld.solver.iterations = 8;
    cworld.defaultContactMaterial.friction = 0.3;
    cworld.defaultContactMaterial.restitution = 0;

    var matGround = new C.Material('ground');
    var matPlayer = new C.Material('player');
    var matEnemy = new C.Material('enemy');
    var matDebris = new C.Material('debris');
    // Characters steer their own horizontal velocity; ground friction would
    // fight the AI (box-on-box contacts generate big normal impulses in
    // cannon-es and friction then cancels the desired walk velocity).
    cworld.addContactMaterial(new C.ContactMaterial(matPlayer, matGround, { friction: 0, restitution: 0 }));
    cworld.addContactMaterial(new C.ContactMaterial(matPlayer, matEnemy, { friction: 0, restitution: 0 }));
    cworld.addContactMaterial(new C.ContactMaterial(matEnemy, matGround, { friction: 0, restitution: 0 }));
    cworld.addContactMaterial(new C.ContactMaterial(matEnemy, matEnemy, { friction: 0.02, restitution: 0 }));
    cworld.addContactMaterial(new C.ContactMaterial(matDebris, matGround, { friction: 0.7, restitution: 0.25 }));
    cworld.addContactMaterial(new C.ContactMaterial(matDebris, matDebris, { friction: 0.4, restitution: 0.2 }));

    // --- Static world ---
    // A thick box instead of CANNON.Plane: cannon-es raycasts against an
    // infinite plane miss it (its AABB is unbounded), and every projectile,
    // line-of-sight and ground check in this game is a raycast.
    var ground = new C.Body({
      mass: 0,
      material: matGround,
      shape: new C.Box(new C.Vec3(400, 0.5, 400)),
      position: new C.Vec3(0, -0.5, 0),
      collisionFilterGroup: GROUP.WORLD,
      collisionFilterMask: -1,
    });
    cworld.addBody(ground);

    var colliders = (world && world.colliders) || [];
    for (var i = 0; i < colliders.length; i++) {
      var d = colliders[i];
      var wall = new C.Body({
        mass: 0,
        material: matGround,
        shape: new C.Box(new C.Vec3(d.length / 2, d.height / 2, d.thickness / 2)),
        position: new C.Vec3(d.x, d.height / 2, d.z),
        collisionFilterGroup: GROUP.WORLD,
        collisionFilterMask: -1,
      });
      wall.quaternion.setFromEuler(0, d.angle || 0, 0);
      cworld.addBody(wall);
    }

    // --- Player ---
    var startX = 0;
    var startZ = 24;
    var playerBody = new C.Body({
      mass: 80,
      material: matPlayer,
      shape: new C.Box(new C.Vec3(PLAYER_HALF.x, PLAYER_HALF.y, PLAYER_HALF.z)),
      position: new C.Vec3(startX, PLAYER_HALF.y, startZ),
      fixedRotation: true,
      allowSleep: false,
      linearDamping: 0,
      angularDamping: 0,
      collisionFilterGroup: GROUP.PLAYER,
      collisionFilterMask: GROUP.WORLD | GROUP.ENEMY,
    });
    playerBody.updateMassProperties();
    cworld.addBody(playerBody);

    // --- Enemy registry ---
    var entries = [];
    var bodyToEntry = new Map();

    function addEnemyBody(pivot, kind) {
      var isArtillery = kind === 'artillery';
      var body;
      if (isArtillery) {
        body = new C.Body({
          mass: 0,
          material: matEnemy,
          shape: new C.Box(new C.Vec3(0.55, 0.8, 1.7)),
          position: new C.Vec3(pivot.position.x, 0.8, pivot.position.z),
          collisionFilterGroup: GROUP.ENEMY,
          collisionFilterMask: GROUP.WORLD | GROUP.PLAYER | GROUP.ENEMY,
        });
      } else {
        body = new C.Body({
          mass: 75,
          material: matEnemy,
          shape: new C.Box(new C.Vec3(ENEMY_HALF.x, ENEMY_HALF.y, ENEMY_HALF.z)),
          position: new C.Vec3(pivot.position.x, ENEMY_CENTER_Y, pivot.position.z),
          fixedRotation: true,
          allowSleep: false,
          linearDamping: 0.01,
          angularDamping: 0.4,
          collisionFilterGroup: GROUP.ENEMY,
          collisionFilterMask: GROUP.WORLD | GROUP.PLAYER | GROUP.ENEMY,
        });
        body.updateMassProperties();
      }
      cworld.addBody(body);
      var entry = {
        pivot: pivot,
        body: body,
        alive: true,
        static: isArtillery,
        kind: isArtillery ? 'artillery' : 'soldier',
      };
      entries.push(entry);
      bodyToEntry.set(body.id, entry);
      if (pivot.userData) pivot.userData.body = body;
      return entry;
    }

    function removeEntry(entry) {
      if (!entry) return;
      var idx = entries.indexOf(entry);
      if (idx >= 0) entries.splice(idx, 1);
      bodyToEntry.delete(entry.body.id);
      cworld.removeBody(entry.body);
    }

    function removeBody(body) {
      if (!body) return;
      var entry = bodyToEntry.get(body.id);
      if (entry) removeEntry(entry);
    }

    function ragdoll(entry, dirX, dirZ) {
      if (!entry || entry.static) return;
      var body = entry.body;
      var len = Math.hypot(dirX, dirZ);
      var dx = len > 1e-6 ? dirX / len : 0;
      var dz = len > 1e-6 ? dirZ / len : 1;
      body.fixedRotation = false;
      body.updateMassProperties();
      body.allowSleep = true;
      body.sleepSpeedLimit = 0.18;
      body.sleepTimeLimit = 0.5;
      body.linearDamping = 0.03;
      body.angularDamping = 0.28;
      // Corpses lie on the ground and stop blocking the living / bullets.
      body.collisionFilterGroup = GROUP.DEBRIS;
      body.collisionFilterMask = GROUP.WORLD;
      body.velocity.x += dx * 2.2;
      body.velocity.z += dz * 2.2;
      body.velocity.y += 0.7;
      // Spin around cross(up, dir) so the head falls along the shot.
      body.angularVelocity.set(dz * 5.5, (Math.random() - 0.5) * 3, -dx * 5.5);
      entry.alive = false;
    }

    function syncEntries() {
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        if (e.static) continue;
        var b = e.body;
        e.pivot.position.set(b.position.x, b.position.y, b.position.z);
        if (!e.alive) {
          e.pivot.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
        }
      }
    }

    // --- Queries ---
    function raycastClosest(from, to, mask) {
      var result = new C.RaycastResult();
      cworld.raycastClosest(
        new C.Vec3(from.x, from.y, from.z),
        new C.Vec3(to.x, to.y, to.z),
        {
          collisionFilterGroup: GROUP.WORLD,
          collisionFilterMask: mask,
          skipBackfaces: true,
          checkCollisionResponse: false,
        },
        result
      );
      return result;
    }

    function isGrounded() {
      var p = playerBody.position;
      var result = raycastClosest(
        { x: p.x, y: p.y, z: p.z },
        { x: p.x, y: p.y - (PLAYER_HALF.y + 0.15), z: p.z },
        GROUP.WORLD
      );
      return result.hasHit;
    }

    function lineOfSight(from, to) {
      if (!from || !to) return false;
      var result = raycastClosest(from, to, GROUP.WORLD);
      return !result.hasHit;
    }

    function aimPoint(origin, dir, maxDistance, mask) {
      var dist = maxDistance || 120;
      var to = {
        x: origin.x + dir.x * dist,
        y: origin.y + dir.y * dist,
        z: origin.z + dir.z * dist,
      };
      var result = raycastClosest(origin, to, mask || GROUP.WORLD);
      if (result.hasHit && result.hitPointWorld) {
        return {
          x: result.hitPointWorld.x,
          y: result.hitPointWorld.y,
          z: result.hitPointWorld.z,
        };
      }
      return to;
    }

    // --- Projectiles ---
    var projectiles = [];
    var debris = [];
    var lastStepMs = 0;

    function fireMusket(opts) {
      opts = opts || {};
      if (!opts.from || !opts.dir) return null;
      var dir = PhysicsLogic.spreadDirection(
        opts.dir,
        opts.spread || 0,
        Math.random(),
        Math.random()
      );
      var speed = opts.speed || MUSKET_SPEED;
      var owner = opts.owner === 'enemy' ? 'enemy' : 'player';
      var from = plain(opts.from);
      var kind = opts.kind || 'musket';
      var proj = {
        kind: kind,
        owner: owner,
        pos: from,
        vel: { x: dir.x * speed, y: dir.y * speed, z: dir.z * speed },
        damage: opts.damage || 10,
        radius: 0.04,
        life: MUSKET_LIFE,
        mask: owner === 'enemy' ? (GROUP.WORLD | GROUP.PLAYER) : (GROUP.WORLD | GROUP.ENEMY),
        trail: opts.withTrail === false
          ? null
          : (effects && typeof effects.trail === 'function' ? effects.trail(from, kind) : null),
      };
      projectiles.push(proj);
      return proj;
    }

    function fireShotgun(opts) {
      var out = [];
      var count = opts.pellets || 8;
      var forward = new THREE.Vector3(opts.dir.x, opts.dir.y, opts.dir.z).normalize();
      var up = Math.abs(forward.y) > 0.99 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      var right = new THREE.Vector3().crossVectors(forward, up).normalize();
      up.crossVectors(right, forward).normalize();
      for (var i = 0; i < count; i++) {
        var radius = Math.tan(opts.spread || 0) * Math.sqrt(Math.random());
        var angle = Math.random() * Math.PI * 2;
        var direction = forward.clone()
          .addScaledVector(right, radius * Math.cos(angle))
          .addScaledVector(up, radius * Math.sin(angle)).normalize();
        out.push(fireMusket({
          from: opts.from,
          dir: direction,
          spread: 0,
          damage: opts.damage,
          owner: opts.owner,
          kind: 'shotgun',
          withTrail: false,
        }));
      }
      return out;
    }

    function fireCannon(opts) {
      opts = opts || {};
      if (!opts.from || !opts.target) return null;
      var speed = opts.speed || CANNON_SPEED;
      var owner = opts.owner === 'enemy' ? 'enemy' : 'player';
      var from = plain(opts.from);
      var vel = PhysicsLogic.ballisticVelocity(from, opts.target, speed);
      var proj = {
        kind: 'cannon',
        owner: owner,
        pos: from,
        vel: vel,
        damage: opts.damage || 120,
        blastRadius: opts.blastRadius || 5.5,
        blastDamage: opts.blastDamage || 25,
        fortDamage: opts.fortDamage || 8,
        radius: 0.16,
        life: CANNON_LIFE,
        mask: owner === 'enemy' ? (GROUP.WORLD | GROUP.PLAYER) : (GROUP.WORLD | GROUP.ENEMY),
        trail: effects && typeof effects.trail === 'function' ? effects.trail(from, 'cannon') : null,
        mesh: effects && typeof effects.cannonball === 'function' ? effects.cannonball(from) : null,
      };
      projectiles.push(proj);
      return proj;
    }

    function disposeProjectile(proj) {
      if (proj.trail) proj.trail.dispose();
      if (proj.mesh) {
        if (proj.mesh.parent) proj.mesh.parent.remove(proj.mesh);
        if (typeof effects.removeCannonball === 'function') effects.removeCannonball(proj.mesh);
      }
    }

    function spawnDebris(point, normal, count) {
      if (!effects || typeof effects.debrisMesh !== 'function' || !scene) return;
      var n = Math.min(count || 6, 10);
      for (var i = 0; i < n; i++) {
        if (debris.length >= MAX_DEBRIS) {
          var old = debris.shift();
          if (old.body) cworld.removeBody(old.body);
          if (old.mesh && old.mesh.parent) old.mesh.parent.remove(old.mesh);
        }
        var size = 0.06 + Math.random() * 0.12;
        var mesh = effects.debrisMesh(size);
        if (!mesh) continue;
        scene.add(mesh);
        var body = new C.Body({
          mass: 0.18,
          material: matDebris,
          shape: new C.Box(new C.Vec3(size / 2, size / 2, size / 2)),
          position: new C.Vec3(
            point.x + (Math.random() - 0.5) * 0.6,
            Math.max(0.1, point.y + (Math.random() - 0.3) * 0.5),
            point.z + (Math.random() - 0.5) * 0.6
          ),
          collisionFilterGroup: GROUP.DEBRIS,
          collisionFilterMask: GROUP.WORLD | GROUP.DEBRIS,
          linearDamping: 0.05,
          angularDamping: 0.3,
        });
        body.velocity.set(
          (normal ? normal.x : 0) * (1 + Math.random() * 2) + (Math.random() - 0.5) * 3,
          1.5 + Math.random() * 3,
          (normal ? normal.z : 0) * (1 + Math.random() * 2) + (Math.random() - 0.5) * 3
        );
        body.angularVelocity.set(Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * 8 - 4);
        cworld.addBody(body);
        debris.push({ mesh: mesh, body: body, life: 6 + Math.random() * 3 });
      }
    }

    function stepDebris(dt) {
      for (var i = debris.length - 1; i >= 0; i--) {
        var d = debris[i];
        d.life -= dt;
        if (d.life <= 0) {
          cworld.removeBody(d.body);
          if (d.mesh && d.mesh.parent) d.mesh.parent.remove(d.mesh);
          debris.splice(i, 1);
          continue;
        }
        d.mesh.position.set(d.body.position.x, d.body.position.y, d.body.position.z);
        d.mesh.quaternion.set(d.body.quaternion.x, d.body.quaternion.y, d.body.quaternion.z, d.body.quaternion.w);
      }
    }

    function impactKind(point) {
      if (!point) return 'wall';
      if (point.y <= 0.05) return point.z < -46 ? 'water' : 'ground';
      return 'wall';
    }

    function inFort(point) {
      if (!point || !world || !world.fort || !world.fort.position) return false;
      var fz = world.fort.position.z;
      return point.x >= -21 && point.x <= 21 && point.z >= fz - 15 && point.z <= fz + 15 && point.y <= 8;
    }

    function normalizeDir(vel) {
      var len = Math.hypot(vel.x, vel.y, vel.z);
      if (len < 1e-9) return { x: 0, y: 0, z: -1 };
      return { x: vel.x / len, y: vel.y / len, z: vel.z / len };
    }

    function hitEnemiesInRadius(proj, point, ctx) {
      if (typeof ctx.onEnemyHit !== 'function') return;
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        if (!e.alive) continue;
        var b = e.body;
        var d = distanceToBody(b, point);
        if (d > proj.blastRadius) continue;
        var f = PhysicsLogic.falloff(d, proj.blastRadius);
        var dmg = Math.round(proj.damage * f);
        if (dmg <= 0) continue;
        if (!e.static) {
          var dx = b.position.x - point.x;
          var dz = b.position.z - point.z;
          var dl = Math.hypot(dx, dz) || 1;
          b.velocity.x += (dx / dl) * 5 * f;
          b.velocity.z += (dz / dl) * 5 * f;
          b.velocity.y += 1.6 * f;
        }
        ctx.onEnemyHit(e.pivot, dmg, point, { x: 0, y: 1, z: 0 }, 'cannon');
      }
    }

    function explode(proj, point, normal, ctx) {
      if (effects) {
        if (typeof effects.explosion === 'function') effects.explosion(point, { normal: normal, kind: proj.kind, big: proj.owner === 'player' });
      }
      if (typeof ctx.onExplosion === 'function') ctx.onExplosion(point, proj.owner);
      spawnDebris(point, normal, proj.owner === 'player' ? 9 : 6);
      if (proj.owner === 'player') {
        hitEnemiesInRadius(proj, point, ctx);
        return;
      }
      if (inFort(point) && typeof ctx.onFortImpact === 'function') {
        ctx.onFortImpact(proj.fortDamage, point);
      }
      var pd = distanceToBody(playerBody, point);
      if (pd < proj.blastRadius && typeof ctx.onPlayerHit === 'function') {
        var blast = Math.round(proj.blastDamage * PhysicsLogic.falloff(pd, proj.blastRadius));
        if (blast > 0) ctx.onPlayerHit(blast, point, 'cannon');
      }
    }

    function handleHit(proj, index, result, ctx) {
      var body = result.body;
      var point = result.hitPointWorld
        ? { x: result.hitPointWorld.x, y: result.hitPointWorld.y, z: result.hitPointWorld.z }
        : proj.pos;
      var normal = result.hitNormalWorld
        ? { x: result.hitNormalWorld.x, y: result.hitNormalWorld.y, z: result.hitNormalWorld.z }
        : { x: 0, y: 1, z: 0 };
      var dir = normalizeDir(proj.vel);
      var entry = body ? bodyToEntry.get(body.id) : null;

      if (proj.kind === 'cannon') {
        if (!entry && body !== playerBody && typeof ctx.onWorldImpact === 'function') {
          ctx.onWorldImpact(point, normal, 'cannon');
        }
        explode(proj, point, normal, ctx);
        disposeProjectile(proj);
        projectiles.splice(index, 1);
        return;
      }

      if (entry && proj.owner === 'player' && typeof ctx.onEnemyHit === 'function') {
        if (effects && typeof effects.impact === 'function') effects.impact(point, normal, 'flesh');
        ctx.onEnemyHit(entry.pivot, proj.damage, point, dir, proj.kind);
      } else if (body === playerBody && proj.owner === 'enemy' && typeof ctx.onPlayerHit === 'function') {
        if (effects && typeof effects.impact === 'function') effects.impact(point, normal, 'flesh');
        ctx.onPlayerHit(proj.damage, point, proj.kind);
      } else {
        var kind = impactKind(point);
        if (effects && typeof effects.impact === 'function') effects.impact(point, normal, kind);
        if (typeof ctx.onWorldImpact === 'function') ctx.onWorldImpact(point, normal, kind);
      }
      disposeProjectile(proj);
      projectiles.splice(index, 1);
    }

    function stepProjectiles(dt, ctx) {
      for (var i = projectiles.length - 1; i >= 0; i--) {
        var proj = projectiles[i];
        proj.life -= dt;
        if (proj.life <= 0) {
          disposeProjectile(proj);
          projectiles.splice(i, 1);
          continue;
        }

        var prev = { x: proj.pos.x, y: proj.pos.y, z: proj.pos.z };
        proj.vel.y -= GRAVITY * dt;
        var next = {
          x: proj.pos.x + proj.vel.x * dt,
          y: proj.pos.y + proj.vel.y * dt,
          z: proj.pos.z + proj.vel.z * dt,
        };
        var segLen = Math.hypot(next.x - prev.x, next.y - prev.y, next.z - prev.z);
        var steps = Math.max(1, Math.ceil(segLen / MAX_SEGMENT));
        var hit = null;
        var from = { x: prev.x, y: prev.y, z: prev.z };

        for (var s = 1; s <= steps; s++) {
          var t = s / steps;
          var to = {
            x: prev.x + (next.x - prev.x) * t,
            y: prev.y + (next.y - prev.y) * t,
            z: prev.z + (next.z - prev.z) * t,
          };
          var result = raycastClosest(from, to, proj.mask);
          if (result.hasHit) {
            hit = result;
            break;
          }
          from = to;
        }

        if (hit) {
          handleHit(proj, i, hit, ctx);
          continue;
        }

        proj.pos = next;
        if (proj.trail) proj.trail.update(prev, next);
        if (proj.mesh) proj.mesh.position.set(next.x, next.y, next.z);
      }
    }

    function step(dt, ctx) {
      var started = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
      var clamped = Math.min(Math.max(dt || 0, 0), 0.1);
      cworld.step(1 / 60, clamped, 4);
      syncEntries();
      stepProjectiles(clamped, ctx || {});
      stepDebris(clamped);
      if (started) lastStepMs = performance.now() - started;
    }

    function getStats() {
      return {
        bodies: cworld.bodies.length,
        enemies: entries.length,
        projectiles: projectiles.length,
        debris: debris.length,
        lastStepMs: lastStepMs,
      };
    }

    return {
      world: cworld,
      playerBody: playerBody,
      GROUP: GROUP,
      EYE_OFFSET: EYE_OFFSET,
      isGrounded: isGrounded,
      lineOfSight: lineOfSight,
      aimPoint: aimPoint,
      addEnemyBody: addEnemyBody,
      ragdoll: ragdoll,
      removeBody: removeBody,
      removeEntry: removeEntry,
      fireMusket: fireMusket,
      fireShotgun: fireShotgun,
      fireCannon: fireCannon,
      spawnDebris: spawnDebris,
      step: step,
      getStats: getStats,
      entries: entries,
    };
  }

  return {
    create: create,
    GROUP: GROUP,
    EYE_OFFSET: EYE_OFFSET,
    MUSKET_SPEED: MUSKET_SPEED,
    CANNON_SPEED: CANNON_SPEED,
    ENEMY_CENTER_Y: ENEMY_CENTER_Y,
  };
})();

if (typeof module !== 'undefined') module.exports = GamePhysics;

// Qing garrison that fights: eight rigged soldiers, four on the walls and
// four patrolling the courtyard. They pick the nearest British soldier with
// line of sight, aim, fire and animate with the shared rig clips. They have no
// physics bodies: they cannot be hit, pushed or hit by friendly fire, and they
// never join `enemies` (so they do not affect wave clearing).

var Allies = (function () {
  var CLIP = {};

  function clip(name) {
    if (CLIP[name]) return CLIP[name];
    if (typeof RigAnim === 'undefined' || !RigAnim.Clips) return null;
    var C = RigAnim.Clips;
    switch (name) {
      case 'idle': CLIP[name] = C.idle(); break;
      case 'walk': CLIP[name] = C.walk(1); break;
      case 'aim': CLIP[name] = C.aim(); break;
      case 'fire': CLIP[name] = C.fire(); break;
      default: return null;
    }
    return CLIP[name];
  }

  function create(options) {
    var opts = options || {};
    var world = opts.world;
    var physics = opts.physics;
    var effects = opts.effects;
    var sfxCall = typeof opts.sfxCall === 'function' ? opts.sfxCall : function () {};
    var logic = (typeof AllyLogic !== 'undefined') ? AllyLogic : null;
    var fort = world && world.fort;
    var list = [];
    if (!fort || !logic) return { list: list, update: function () {} };

    for (var i = 0; i < logic.ALLY_DEFS.length; i++) {
      var def = logic.ALLY_DEFS[i];
      var pivot = new THREE.Group();
      var rig = null;
      var animator = null;
      if (typeof Rig !== 'undefined' && Rig.buildSoldier) {
        rig = Rig.buildSoldier({ faction: 'qing' });
        if (typeof RigAnim !== 'undefined' && RigAnim.Animator) {
          animator = new RigAnim.Animator(rig);
          animator.play(clip('idle'), { fade: 0 });
        }
        pivot.add(rig.group);
      } else if (typeof Models !== 'undefined' && Models.makeQingSoldier) {
        pivot.add(Models.makeQingSoldier());
      }
      pivot.position.set(def.fortLocal[0], def.fortLocal[1], def.fortLocal[2]);
      pivot.userData = { ally: true, animState: 'idle', rig: rig, animator: animator };

      if (def.mobile && typeof Models !== 'undefined' && Models.makeRattanShield) {
        var shield = Models.makeRattanShield();
        shield.position.set(0.3, 1.0, -0.2);
        shield.rotation.y = 0.3;
        pivot.add(shield);
      }

      fort.add(pivot);
      list.push({
        pivot: pivot,
        def: def,
        mobile: !!def.mobile,
        waypoint: 0,
        nextScanAt: 0,
        nextFireAt: 0,
        target: null,
      });
    }

    function setAnim(ally, name, fade, speed) {
      var data = ally.pivot.userData;
      if (!data || !data.animator) return;
      if (data.animState !== name) {
        data.animState = name;
        data.animator.play(clip(name), { fade: fade == null ? 0.2 : fade });
      }
      if (speed != null) data.animator.speed = speed;
    }

    function worldPosition(ally) {
      var local = ally.pivot.position;
      return {
        x: fort.position.x + local.x,
        y: local.y,
        z: fort.position.z + local.z,
      };
    }

    function hasLineOfSight(from, to) {
      if (!physics || typeof physics.lineOfSight !== 'function') return true;
      return physics.lineOfSight(from, to);
    }

    function fire(ally, from, target, time) {
      var dx = target.position.x - from.x;
      var dy = (target.position.y + 0.1) - from.y;
      var dz = target.position.z - from.z;
      var len = Math.hypot(dx, dy, dz) || 1;
      var dir = { x: dx / len, y: dy / len, z: dz / len };
      if (physics && typeof physics.fireMusket === 'function') {
        physics.fireMusket({
          from: from,
          dir: dir,
          spread: logic.SPREAD,
          damage: logic.DAMAGE,
          owner: 'player',
          kind: 'ally',
          withTrail: false,
        });
      }
      if (effects && typeof effects.muzzleFlash === 'function') effects.muzzleFlash(from, dir);
      sfxCall('enemyShot', from);
      var data = ally.pivot.userData;
      if (data && data.animator) data.animator.playAdditive(clip('fire'), 1);
      ally.nextFireAt = time + logic.FIRE_COOLDOWN;
    }

    function patrol(ally, dt) {
      var points = ally.def.waypoints;
      var point = points[ally.waypoint % points.length];
      var px = ally.pivot.position.x;
      var pz = ally.pivot.position.z;
      var dx = point[0] - px;
      var dz = point[2] - pz;
      var dist = Math.hypot(dx, dz);
      if (dist < 0.45) {
        ally.waypoint = (ally.waypoint + 1) % points.length;
        point = points[ally.waypoint];
        dx = point[0] - px;
        dz = point[2] - pz;
        dist = Math.hypot(dx, dz);
        if (dist < 1e-6) return;
      }
      var step = Math.min(logic.PATROL_SPEED * dt, dist);
      ally.pivot.position.x = px + (dx / dist) * step;
      ally.pivot.position.z = pz + (dz / dist) * step;
      // The qing rig faces -Z, so yaw = atan2(-dx, -dz).
      ally.pivot.rotation.y = Math.atan2(-dx, -dz);
      setAnim(ally, 'walk', 0.25, 1);
    }

    function update(dt, player, time) {
      var now = typeof time === 'number' ? time : 0;
      var enemies = (player && player.enemies) || [];
      for (var i = 0; i < list.length; i++) {
        var ally = list[i];
        var position = worldPosition(ally);
        var eye = {
          x: position.x,
          y: position.y + logic.AIM_HEIGHT,
          z: position.z,
        };
        if (now >= ally.nextScanAt) {
          ally.nextScanAt = now + 0.4;
          ally.target = logic.pickTarget(eye, enemies, hasLineOfSight, logic.RANGE);
        }
        var target = ally.target;
        if (target && (!target.userData || target.userData.dead || !(target.userData.hp > 0))) {
          target = null;
          ally.target = null;
        }
        if (target) {
          ally.pivot.rotation.y = Math.atan2(
            -(target.position.x - position.x),
            -(target.position.z - position.z)
          );
          setAnim(ally, 'aim', 0.2, 1);
          if (logic.canFire(now, ally.nextFireAt)) fire(ally, eye, target, now);
        } else if (ally.mobile) {
          patrol(ally, dt);
        } else {
          setAnim(ally, 'idle', 0.3, 1);
        }
        var data = ally.pivot.userData;
        if (data && data.animator) data.animator.update(dt);
      }
    }

    return { list: list, update: update };
  }

  return { create: create };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = { Allies: Allies };

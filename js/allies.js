// Qing garrison combat: the eight soldiers adopted from world.garrison aim at
// the nearest British soldier with line of sight, fire muskets and (the four on
// the ground) patrol the courtyard. They have no physics bodies: they cannot be
// hit, pushed or hit by friendly fire, and they never join `enemies`.

var Allies = (function () {
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

    var garrison = Array.isArray(world.garrison) ? world.garrison : [];
    for (var i = 0; i < logic.ALLY_DEFS.length; i++) {
      var def = logic.ALLY_DEFS[i];
      var pivot = garrison[i];
      if (!pivot) {
        if (typeof Models === 'undefined' || typeof Models.makeQingSoldier !== 'function') continue;
        pivot = Models.makeQingSoldier();
        pivot.position.set(def.fortLocal[0], def.fortLocal[1], def.fortLocal[2]);
        fort.add(pivot);
      }
      pivot.userData = pivot.userData || {};
      pivot.userData.ally = true;
      // The courtyard patrols carry rattan shields on their left arm.
      if (def.mobile && typeof Models !== 'undefined' && typeof Models.makeRattanShield === 'function') {
        var shield = Models.makeRattanShield();
        shield.position.set(0.3, 1.0, -0.2);
        shield.rotation.y = 0.3;
        pivot.add(shield);
      }
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
      // The qing model faces -Z, so yaw = atan2(-dx, -dz).
      ally.pivot.rotation.y = Math.atan2(-dx, -dz);
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
          if (logic.canFire(now, ally.nextFireAt)) fire(ally, eye, target, now);
          continue;
        }
        if (ally.mobile) patrol(ally, dt);
      }
    }

    return { list: list, update: update };
  }

  return { create: create };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = { Allies: Allies };

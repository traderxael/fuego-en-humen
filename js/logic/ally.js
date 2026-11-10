// Friendly garrison logic: where the eight qing soldiers stand, which way
// they patrol and which British soldier each one shoots at.
// Pure logic (no THREE, no DOM); browser globals + CommonJS for tests.

var ALLY_DEFS = [
  // Four fixed posts: two on the seaward parapet, two on the horn arms.
  { fortLocal: [-16, 1.3, -14], mobile: false },
  { fortLocal: [16, 1.3, -14], mobile: false },
  { fortLocal: [-23, 4, -16], mobile: false },
  { fortLocal: [23, 4, -16], mobile: false },
  // Four patrolling the courtyard (routes stay inside the walls).
  {
    fortLocal: [-14, 0, 10],
    mobile: true,
    waypoints: [[-14, 0, 10], [-10, 0, 6], [-16, 0, 4]],
  },
  {
    fortLocal: [14, 0, 10],
    mobile: true,
    waypoints: [[14, 0, 10], [10, 0, 6], [16, 0, 4]],
  },
  {
    fortLocal: [-7, 0, 13],
    mobile: true,
    waypoints: [[-7, 0, 13], [-4, 0, 9], [-10, 0, 8]],
  },
  {
    fortLocal: [7, 0, 13],
    mobile: true,
    waypoints: [[7, 0, 13], [4, 0, 9], [10, 0, 8]],
  },
];

var AllyLogic = (function () {
  var RANGE = 45;          // metres: allies engage before the beach landing
  var DAMAGE = 26;
  var FIRE_COOLDOWN = 1.7; // seconds between shots of the same ally
  var SPREAD = 0.012;      // radians
  var PATROL_SPEED = 1.6;  // m/s
  var AIM_HEIGHT = 1.15;   // eye offset above the pivot

  function toWorld(local, fort) {
    var origin = (fort && fort.position) || { x: 0, y: 0, z: 0 };
    return { x: origin.x + local[0], y: local[1], z: origin.z + local[2] };
  }

  // Nearest living British soldier inside range and with a clear line of
  // sight. `los(from, to)` returns true when nothing blocks the shot.
  function pickTarget(from, enemies, los, maxRange) {
    if (!from || !Array.isArray(enemies) || enemies.length === 0) return null;
    var range = maxRange === undefined ? RANGE : maxRange;
    var best = null;
    var bestDist = Infinity;
    for (var i = 0; i < enemies.length; i++) {
      var enemy = enemies[i];
      if (!enemy || !enemy.position) continue;
      var data = enemy.userData || {};
      if (data.dead || typeof data.hp !== 'number' || data.hp <= 0) continue;
      var to = {
        x: enemy.position.x,
        y: enemy.position.y + 0.1,
        z: enemy.position.z,
      };
      var dx = to.x - from.x;
      var dy = to.y - from.y;
      var dz = to.z - from.z;
      var dist = Math.hypot(dx, dy, dz);
      if (dist > range || dist >= bestDist) continue;
      if (typeof los === 'function' && !los(from, to)) continue;
      best = enemy;
      bestDist = dist;
    }
    return best;
  }

  function canFire(now, nextAt) {
    return now >= nextAt;
  }

  return {
    ALLY_DEFS: ALLY_DEFS,
    RANGE: RANGE,
    DAMAGE: DAMAGE,
    FIRE_COOLDOWN: FIRE_COOLDOWN,
    SPREAD: SPREAD,
    PATROL_SPEED: PATROL_SPEED,
    AIM_HEIGHT: AIM_HEIGHT,
    toWorld: toWorld,
    pickTarget: pickTarget,
    canFire: canFire,
  };
})();

if (typeof module !== 'undefined') {
  module.exports = { AllyLogic: AllyLogic, ALLY_DEFS: ALLY_DEFS };
}

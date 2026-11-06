// Pure physics math shared by the browser world and the Node tests.
// No THREE / CANNON here: plain objects in, plain objects out.

var PhysicsLogic = (function () {
  var GRAVITY = 9.81;

  function clamp(v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
  }

  // Semi-implicit Euler: velocity first, then position (stable at 60 Hz).
  function stepProjectile(pos, vel, dt, gravity) {
    var g = typeof gravity === 'number' ? gravity : GRAVITY;
    vel.y -= g * dt;
    pos.x += vel.x * dt;
    pos.y += vel.y * dt;
    pos.z += vel.z * dt;
    return { pos: pos, vel: vel };
  }

  // Initial velocity to hit `to` from `from`, treating `speed` as the
  // horizontal component. Gravity is compensated with the exact drop for the
  // flight time (flat-fire approximation, enough for <150 m).
  function ballisticVelocity(from, to, speed, gravity) {
    var g = typeof gravity === 'number' ? gravity : GRAVITY;
    var s = (typeof speed === 'number' && speed > 0) ? speed : 1;
    var dx = to.x - from.x;
    var dy = to.y - from.y;
    var dz = to.z - from.z;
    var horizontal = Math.hypot(dx, dz);
    if (horizontal < 1e-6) {
      return { x: 0, y: dy >= 0 ? s : -s, z: 0 };
    }
    var t = horizontal / s;
    var vy = (dy + 0.5 * g * t * t) / t;
    return { x: dx / t, y: vy, z: dz / t };
  }

  function normalize(v) {
    var len = Math.hypot(v.x, v.y, v.z);
    if (!Number.isFinite(len) || len < 1e-9) return { x: 0, y: 0, z: -1 };
    return { x: v.x / len, y: v.y / len, z: v.z / len };
  }

  function cross(a, b) {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x,
    };
  }

  // Uniform cone spread. randA/randB are in [0, 1); spreadRad is the max
  // half-angle. Returns a normalized direction.
  function spreadDirection(dir, spreadRad, randA, randB) {
    var d = normalize(dir);
    var spread = Number.isFinite(spreadRad) ? Math.max(0, spreadRad) : 0;
    if (spread === 0) return d;
    var up = Math.abs(d.y) > 0.99 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
    var right = normalize(cross(d, up));
    var up2 = normalize(cross(right, d));
    var a = (clamp(randA, 0, 0.999999) * 2 - 1) * spread;
    var b = (clamp(randB, 0, 0.999999) * 2 - 1) * spread;
    return normalize({
      x: d.x + right.x * Math.tan(a) + up2.x * Math.tan(b),
      y: d.y + right.y * Math.tan(a) + up2.y * Math.tan(b),
      z: d.z + right.z * Math.tan(a) + up2.z * Math.tan(b),
    });
  }

  // 1 at the center, 0 at (and beyond) the radius.
  function falloff(distance, radius) {
    if (!Number.isFinite(radius) || radius <= 0) return 0;
    return clamp(1 - distance / radius, 0, 1);
  }

  // Wrap-aware angular approach used to turn soldiers smoothly.
  function turnTowards(current, target, maxStep) {
    var delta = target - current;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    var step = clamp(delta, -Math.abs(maxStep), Math.abs(maxStep));
    return current + step;
  }

  function dropAt(distance, speed, gravity) {
    var g = typeof gravity === 'number' ? gravity : GRAVITY;
    var s = speed > 0 ? speed : 1;
    var t = Math.max(0, distance) / s;
    return (g * t * t) / 2;
  }

  return {
    GRAVITY: GRAVITY,
    clamp: clamp,
    stepProjectile: stepProjectile,
    ballisticVelocity: ballisticVelocity,
    normalize: normalize,
    spreadDirection: spreadDirection,
    falloff: falloff,
    turnTowards: turnTowards,
    dropAt: dropAt,
  };
})();

if (typeof module !== 'undefined') module.exports = PhysicsLogic;

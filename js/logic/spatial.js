// Pure spatial-audio math (plain objects, no THREE): linear distance
// attenuation and stereo pan from the listener's yaw. Browser global
// `SpatialLogic`; CommonJS for Node tests.
//
// Convention matches the FPS camera: yaw 0 faces -Z, and the listener's
// right vector in XZ is (cos yaw, -sin yaw).

var SpatialLogic = (function () {
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function attenuation(dist, maxDist) {
    if (!Number.isFinite(dist) || !Number.isFinite(maxDist) || maxDist <= 0) return 0;
    return clamp(1 - Math.max(0, dist) / maxDist, 0, 1);
  }

  function finitePoint(p) {
    return p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);
  }

  function spatialGains(listener, source, maxDist) {
    if (!finitePoint(listener) || !finitePoint(source) || !Number.isFinite(listener.yaw)) {
      return { gain: 0, pan: 0 };
    }
    var dx = source.x - listener.x;
    var dy = source.y - listener.y;
    var dz = source.z - listener.z;
    var gain = attenuation(Math.hypot(dx, dy, dz), maxDist);
    var lenXZ = Math.hypot(dx, dz);
    if (lenXZ < 1e-6) return { gain: gain, pan: 0 };
    var rightX = Math.cos(listener.yaw);
    var rightZ = -Math.sin(listener.yaw);
    var dot = (dx / lenXZ) * rightX + (dz / lenXZ) * rightZ;
    return { gain: gain, pan: clamp(dot, -1, 1) * 0.85 };
  }

  return {
    attenuation: attenuation,
    spatialGains: spatialGains,
  };
})();

if (typeof module !== 'undefined') module.exports = SpatialLogic;
// Pure combat math: reloads, damage application and steering.
// Works as a browser global script and as a CommonJS module for Node tests.

var logicConfig = (typeof module !== 'undefined' && module.exports)
  ? require('./config')
  : { WEAPONS: WEAPONS, WAVES: WAVES, PLAYER_HP: PLAYER_HP, FORT_INTEGRITY: FORT_INTEGRITY };

function startReload(weapon, state) {
  var def = logicConfig.WEAPONS[weapon];
  var reloadTime = def ? def.reloadTime : 0;
  if (!Number.isFinite(reloadTime) || reloadTime <= 0) return false; // no reload for weapons without a reloadTime
  var now = state.time || 0;
  if (state.reloadingUntil > now) return false; // already reloading
  state.reloadingUntil = now + reloadTime;
  return true;
}

function applyWaveDamage(state, amount) {
  state.fortIntegrity = Math.max(0, state.fortIntegrity - amount);
  if (state.fortIntegrity <= 0) state.phase = 'defeat';
  return state.fortIntegrity;
}

function applyPlayerDamage(state, amount) {
  state.playerHp = Math.max(0, state.playerHp - amount);
  if (state.playerHp <= 0) state.phase = 'defeat';
  return state.playerHp;
}

function steerTowards(from, to) {
  var fromX = from ? from.x : 0;
  var fromZ = from ? from.z : 0;
  var toX = to ? to.x : 0;
  var toZ = to ? to.z : 0;
  var dx = toX - fromX;
  var dz = toZ - fromZ;
  var len = Math.hypot(dx, dz);
  if (!Number.isFinite(len) || len === 0) return { x: 1, z: 0 };
  return { x: dx / len, z: dz / len };
}

// Low-HP heartbeat cadence: null when safe/dead, 1.1s at 30 HP down to
// 0.55s at 1 HP. The caller owns the clock so pause freezes the beat.
function heartbeatInterval(hp) {
  if (!Number.isFinite(hp) || hp > 30 || hp <= 0) return null;
  var t = (30 - hp) / 29;
  return 1.1 - t * 0.55;
}

// Reload animation progress 0..1 (0 at start, 1 at the deadline). Returns 0
// when not reloading or for weapons without a valid reloadTime. The caller
// shapes the viewmodel dip from this; pause freezes state.time so it holds.
function reloadProgress(reloadingUntil, now, reloadTime) {
  if (!Number.isFinite(reloadTime) || reloadTime <= 0) return 0;
  if (!(reloadingUntil > 0)) return 0;
  var remaining = reloadingUntil - now;
  return Math.max(0, Math.min(1, 1 - remaining / reloadTime));
}

if (typeof module !== 'undefined') module.exports = { startReload, applyWaveDamage, applyPlayerDamage, steerTowards, heartbeatInterval, reloadProgress };

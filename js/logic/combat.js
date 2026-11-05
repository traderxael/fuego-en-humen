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

if (typeof module !== 'undefined') module.exports = { startReload, applyWaveDamage, applyPlayerDamage, steerTowards };

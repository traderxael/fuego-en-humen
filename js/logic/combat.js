// Pure combat math: reloads, damage application and steering.
// Works as a browser global script and as a CommonJS module for Node tests.

var logicConfig = (typeof module !== 'undefined' && module.exports)
  ? require('./config')
  : {
      WEAPONS: WEAPONS,
      WAVES: WAVES,
      PLAYER_HP: PLAYER_HP,
      FORT_INTEGRITY: FORT_INTEGRITY,
      MEDKIT: (typeof MEDKIT !== 'undefined' ? MEDKIT : null),
    };

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

function startHeal(state, fromStation) {
  if (!state || state.phase !== 'playing') return false;
  if ((state.playerHp || 0) <= 0 || state.playerHp >= logicConfig.PLAYER_HP) return false;
  var now = state.time || 0;
  if ((state.healingUntil || 0) > now) return false;
  if (!fromStation) {
    if ((state.medkits || 0) <= 0) return false;
    state.medkits -= 1;
  }
  var dur = (logicConfig.MEDKIT && typeof logicConfig.MEDKIT.healDuration === 'number')
    ? logicConfig.MEDKIT.healDuration
    : 1.8;
  state.healingUntil = now + dur;
  return true;
}

function applyPlayerHeal(state, amount) {
  if (!state || (state.playerHp || 0) <= 0) return state ? state.playerHp : 0;
  var heal = typeof amount === 'number' ? amount : ((logicConfig.MEDKIT && logicConfig.MEDKIT.healAmount) || 45);
  state.playerHp = Math.min(logicConfig.PLAYER_HP, Math.max(0, state.playerHp + Math.max(0, heal)));
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

if (typeof module !== 'undefined') module.exports = { startReload, applyWaveDamage, applyPlayerDamage, startHeal, applyPlayerHeal, steerTowards };

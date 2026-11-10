// Pure wave composition: enemy type picking, stat resolution and artillery
// counts. Browser global `WaveLogic`; CommonJS for Node tests.

var WaveLogic = (function () {
  var config = (typeof module !== 'undefined' && module.exports)
    ? require('./config')
    : { ENEMY_TYPES: ENEMY_TYPES };

  var BASE_SPEED = 2.4;          // matches Enemies.SPEED baseline
  var BASE_MELEE_COOLDOWN = 1.1; // matches Enemies.MELEE_COOLDOWN baseline

  function pickEnemyType(waveDef, spawnIndex) {
    var mix = waveDef && waveDef.mix;
    if (!Array.isArray(mix) || mix.length === 0) return 'soldier';
    var len = mix.length;
    var idx = ((spawnIndex % len) + len) % len;
    var type = mix[idx];
    return config.ENEMY_TYPES[type] ? type : 'soldier';
  }

  function resolveEnemyStats(waveDef, enemyType) {
    var def = config.ENEMY_TYPES[enemyType] || config.ENEMY_TYPES.soldier;
    var hp = (waveDef && waveDef.hp) || 0;
    var damage = (waveDef && waveDef.damage) || 0;
    return {
      hp: Math.round(hp * (def.hpMult || 1)),
      damage: Math.round(damage * (def.damageMult || 1)),
      speed: BASE_SPEED * (def.speedMult || 1),
      canShoot: def.canShoot !== false,
      meleeCooldown: def.meleeCooldown || BASE_MELEE_COOLDOWN,
      score: def.score != null ? def.score : 100,
    };
  }

  function artilleryCount(waveDef, waveIndex) {
    if (waveDef && waveDef.artillery != null) return waveDef.artillery;
    return waveIndex >= 2 ? 1 : 0;
  }

  return {
    pickEnemyType: pickEnemyType,
    resolveEnemyStats: resolveEnemyStats,
    artilleryCount: artilleryCount,
  };
})();

if (typeof module !== 'undefined') module.exports = WaveLogic;
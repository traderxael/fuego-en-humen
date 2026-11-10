const test = require('node:test');
const assert = require('node:assert');

const { WAVES, ENEMY_TYPES } = require('../js/logic/config');
const { pickEnemyType, resolveEnemyStats, artilleryCount } = require('../js/logic/waves');

test('WAVES has 5 entries with escalating counts', () => {
  assert.strictEqual(WAVES.length, 5);
  assert.deepStrictEqual(WAVES.map((w) => w.count), [10, 15, 20, 26, 34]);
});

test('ENEMY_TYPES defines soldier, runner and officer', () => {
  assert.ok(ENEMY_TYPES.soldier);
  assert.ok(ENEMY_TYPES.runner);
  assert.ok(ENEMY_TYPES.officer);
  assert.strictEqual(ENEMY_TYPES.runner.canShoot, false);
  assert.ok(ENEMY_TYPES.runner.speedMult > 1);
  assert.ok(ENEMY_TYPES.runner.hpMult < 1);
  assert.ok(ENEMY_TYPES.officer.hpMult > 1);
});

test('pickEnemyType falls back to soldier without a mix', () => {
  assert.strictEqual(pickEnemyType(WAVES[0], 0), 'soldier');
  assert.strictEqual(pickEnemyType({ count: 3 }, 7), 'soldier');
});

test('pickEnemyType cycles the wave mix deterministically', () => {
  const waveDef = { mix: ['soldier', 'runner', 'officer'] };
  assert.strictEqual(pickEnemyType(waveDef, 0), 'soldier');
  assert.strictEqual(pickEnemyType(waveDef, 1), 'runner');
  assert.strictEqual(pickEnemyType(waveDef, 2), 'officer');
  assert.strictEqual(pickEnemyType(waveDef, 3), 'soldier');
  assert.strictEqual(pickEnemyType(waveDef, 5), 'officer');
});

test('pickEnemyType ignores unknown types in a mix', () => {
  assert.strictEqual(pickEnemyType({ mix: ['dragon'] }, 0), 'soldier');
});

test('resolveEnemyStats keeps the soldier baseline', () => {
  const stats = resolveEnemyStats(WAVES[0], 'soldier');
  assert.strictEqual(stats.hp, WAVES[0].hp);
  assert.strictEqual(stats.damage, WAVES[0].damage);
  assert.strictEqual(stats.canShoot, true);
  assert.strictEqual(stats.score, 100);
  assert.ok(Number.isFinite(stats.speed) && stats.speed > 0);
  assert.ok(Number.isFinite(stats.meleeCooldown) && stats.meleeCooldown > 0);
});

test('resolveEnemyStats makes the runner fast, fragile and melee-only', () => {
  const base = resolveEnemyStats(WAVES[4], 'soldier');
  const runner = resolveEnemyStats(WAVES[4], 'runner');
  assert.strictEqual(runner.hp, Math.round(WAVES[4].hp * ENEMY_TYPES.runner.hpMult));
  assert.strictEqual(runner.canShoot, false);
  assert.ok(runner.speed > base.speed);
  assert.ok(runner.meleeCooldown < base.meleeCooldown);
  assert.strictEqual(runner.score, ENEMY_TYPES.runner.score);
});

test('resolveEnemyStats makes the officer tough and valuable', () => {
  const officer = resolveEnemyStats(WAVES[4], 'officer');
  assert.strictEqual(officer.hp, Math.round(WAVES[4].hp * ENEMY_TYPES.officer.hpMult));
  assert.ok(officer.damage > WAVES[4].damage);
  assert.strictEqual(officer.canShoot, true);
  assert.strictEqual(officer.score, ENEMY_TYPES.officer.score);
});

test('resolveEnemyStats falls back to soldier for unknown types', () => {
  const stats = resolveEnemyStats(WAVES[0], 'dragon');
  assert.strictEqual(stats.hp, WAVES[0].hp);
  assert.strictEqual(stats.score, 100);
});

test('artilleryCount defaults to one gun from wave 2 onward', () => {
  assert.strictEqual(artilleryCount(WAVES[0], 1), 0);
  assert.strictEqual(artilleryCount(WAVES[1], 2), 1);
  assert.strictEqual(artilleryCount(WAVES[2], 3), 1);
});

test('artilleryCount honours an explicit wave override', () => {
  assert.strictEqual(artilleryCount({ artillery: 2 }, 5), 2);
  assert.strictEqual(artilleryCount({ artillery: 0 }, 3), 0);
});
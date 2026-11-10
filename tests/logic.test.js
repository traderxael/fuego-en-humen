const test = require('node:test');
const assert = require('node:assert');

const { WEAPONS, WAVES, ENEMY_TYPES, PLAYER_HP, FORT_INTEGRITY } = require('../js/logic/config');
const { resolveEnemyStats } = require('../js/logic/waves');
const { createGameState, setPhase, nextWave } = require('../js/logic/state');
const {
  startReload,
  applyWaveDamage,
  applyPlayerDamage,
  steerTowards,
  heartbeatInterval,
  reloadProgress,
} = require('../js/logic/combat');

test('createGameState starts in menu with wave 1 and full HP/integrity', () => {
  const state = createGameState();
  assert.strictEqual(state.phase, 'menu');
  assert.strictEqual(state.wave, 1);
  assert.strictEqual(state.playerHp, PLAYER_HP);
  assert.strictEqual(state.playerHp, 100);
  assert.strictEqual(state.fortIntegrity, FORT_INTEGRITY);
  assert.strictEqual(state.fortIntegrity, 100);
});

test('setPhase enforces legal transitions only', () => {
  const state = createGameState();
  assert.strictEqual(setPhase(state, 'playing'), true);
  assert.strictEqual(state.phase, 'playing');
  assert.strictEqual(setPhase(state, 'paused'), true);
  assert.strictEqual(state.phase, 'paused');
  assert.strictEqual(setPhase(state, 'playing'), true);
  assert.strictEqual(state.phase, 'playing');
  assert.strictEqual(setPhase(state, 'victory'), true);
  assert.strictEqual(state.phase, 'victory');

  const fromMenu = createGameState();
  assert.strictEqual(setPhase(fromMenu, 'victory'), false);
  assert.strictEqual(fromMenu.phase, 'menu');
  assert.strictEqual(setPhase(fromMenu, 'defeat'), false);
  assert.strictEqual(fromMenu.phase, 'menu');

  const fromPaused = createGameState();
  fromPaused.phase = 'paused';
  assert.strictEqual(setPhase(fromPaused, 'defeat'), false);
  assert.strictEqual(fromPaused.phase, 'paused');
});

test('la intermisión es una fase legal entre oleadas y no se pausa', () => {
  const state = createGameState();
  setPhase(state, 'playing');
  assert.strictEqual(setPhase(state, 'intermission'), true);
  assert.strictEqual(state.phase, 'intermission');
  assert.strictEqual(setPhase(state, 'playing'), true);

  const mid = createGameState();
  setPhase(mid, 'playing');
  setPhase(mid, 'intermission');
  assert.strictEqual(setPhase(mid, 'paused'), false, 'la intermisión no se pausa');
  assert.strictEqual(setPhase(mid, 'defeat'), true, 'el final histórico llega desde la intermisión');
});

test('startReload twice in the same tick does not double reloadingUntil', () => {
  const state = createGameState();
  state.time = 5;
  assert.strictEqual(startReload('mosquete', state), true);
  const untilAfterFirst = state.reloadingUntil;
  assert.strictEqual(startReload('mosquete', state), false);
  assert.strictEqual(state.reloadingUntil, untilAfterFirst);

  // Once the reload window has elapsed, a new reload can start.
  state.time = 10;
  assert.strictEqual(startReload('mosquete', state), true);
});

test('applyWaveDamage clamps fortIntegrity at 0 and sets defeat phase', () => {
  const state = createGameState();
  state.phase = 'playing';
  state.fortIntegrity = 30;
  assert.strictEqual(applyWaveDamage(state, 50), 0);
  assert.strictEqual(state.fortIntegrity, 0);
  assert.strictEqual(state.phase, 'defeat');
});

test('applyWaveDamage reduces fortIntegrity without defeat while above zero', () => {
  const state = createGameState();
  state.phase = 'playing';
  assert.strictEqual(applyWaveDamage(state, 30), 70);
  assert.strictEqual(state.fortIntegrity, 70);
  assert.strictEqual(state.phase, 'playing');
});

test('applyPlayerDamage clamps playerHp at 0 and sets defeat phase', () => {
  const state = createGameState();
  state.phase = 'playing';
  state.playerHp = 40;
  applyPlayerDamage(state, 100);
  assert.strictEqual(state.playerHp, 0);
  assert.strictEqual(state.phase, 'defeat');
});

test('nextWave after clearing the last wave sets phase to victory', () => {
  const state = createGameState();
  state.phase = 'playing';
  state.wave = WAVES.length;
  nextWave(state);
  assert.strictEqual(state.phase, 'victory');
});

test('nextWave advances to the next wave while waves remain', () => {
  const state = createGameState();
  state.phase = 'playing';
  state.wave = 1;
  nextWave(state);
  assert.strictEqual(state.wave, 2);
  assert.strictEqual(state.phase, 'playing');
});

test('WAVES counts escalate across all entries', () => {
  assert.ok(WAVES.length >= 3);
  for (let i = 1; i < WAVES.length; i++) {
    assert.ok(WAVES[i].count > WAVES[i - 1].count);
  }
});

test('WEAPONS defines mosquete and sable with combat stats', () => {
  assert.ok(WEAPONS.mosquete);
  assert.ok(WEAPONS.sable);
  assert.strictEqual(WEAPONS.mosquete.damage, 80);
  assert.strictEqual(WEAPONS.sable.damage, 60);
  assert.ok(WEAPONS.trabuco);
  assert.strictEqual(WEAPONS.trabuco.spread, 0.07);
  assert.strictEqual(WEAPONS.trabuco.fireCooldown, 1.15);
});

test('el trabuco mata al enemigo más duro con seis de sus ocho perdigones', () => {
  const toughestHp = Math.max(...WAVES.flatMap((wave) =>
    Object.keys(ENEMY_TYPES).map((type) => resolveEnemyStats(wave, type).hp)));
  const trabuco = WEAPONS.trabuco;
  assert.strictEqual(trabuco.pellets, 8);
  assert.ok(trabuco.damage * 6 >= toughestHp,
    `seis perdigones hacen ${trabuco.damage * 6} y el enemigo más duro tiene ${toughestHp} HP`);
});

test('heartbeatInterval is silent above 30 HP and at death', () => {
  assert.strictEqual(heartbeatInterval(100), null);
  assert.strictEqual(heartbeatInterval(31), null);
  assert.strictEqual(heartbeatInterval(0), null);
  assert.strictEqual(heartbeatInterval(-3), null);
});

test('heartbeatInterval speeds up as HP falls from 30 to 1', () => {
  const at30 = heartbeatInterval(30);
  const at15 = heartbeatInterval(15);
  const at1 = heartbeatInterval(1);
  assert.ok(Math.abs(at30 - 1.1) < 1e-9);
  assert.ok(Math.abs(at1 - 0.55) < 1e-9);
  assert.ok(at15 < at30 && at1 < at15);
});

test('steerTowards returns a finite unit vector, NaN-safe for zero distance', () => {
  const zero = steerTowards({ x: 0, z: 0 }, { x: 0, z: 0 });
  assert.ok(Number.isFinite(zero.x));
  assert.ok(Number.isFinite(zero.z));
  const unit = steerTowards({ x: 0, z: 0 }, { x: 3, z: 4 });
  assert.ok(Number.isFinite(unit.x));
  assert.ok(Number.isFinite(unit.z));
  assert.ok(Math.abs(Math.hypot(unit.x, unit.z) - 1) < 1e-9);
});

test('reloadProgress is 0 when not reloading or reloadTime invalid', () => {
  assert.strictEqual(reloadProgress(0, 5, 2.6), 0);
  assert.strictEqual(reloadProgress(0, 0, 2.6), 0);
  assert.strictEqual(reloadProgress(10, 5, 0), 0);
  assert.strictEqual(reloadProgress(10, 5, -1), 0);
  assert.strictEqual(reloadProgress(10, 5, NaN), 0);
});

test('reloadProgress runs 0 -> 1 across the reload window', () => {
  const reloadTime = 2.6;
  const start = 10;
  const until = start + reloadTime;
  assert.ok(Math.abs(reloadProgress(until, start, reloadTime) - 0) < 1e-9);
  assert.ok(Math.abs(reloadProgress(until, start + reloadTime / 2, reloadTime) - 0.5) < 1e-9);
  assert.ok(Math.abs(reloadProgress(until, until, reloadTime) - 1) < 1e-9);
});

test('reloadProgress clamps past the deadline to 1', () => {
  assert.strictEqual(reloadProgress(10, 12, 2.6), 1);
});

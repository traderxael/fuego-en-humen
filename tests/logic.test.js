const test = require('node:test');
const assert = require('node:assert');

const { WEAPONS, WAVES, PLAYER_HP, FORT_INTEGRITY } = require('../js/logic/config');
const { createGameState, setPhase, nextWave } = require('../js/logic/state');
const {
  startReload,
  applyWaveDamage,
  applyPlayerDamage,
  steerTowards,
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

test('nextWave after clearing wave 3 sets phase to victory', () => {
  const state = createGameState();
  state.phase = 'playing';
  state.wave = 3;
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

test('WAVES has exactly 3 entries with escalating counts', () => {
  assert.strictEqual(WAVES.length, 3);
  assert.deepStrictEqual(WAVES.map((w) => w.count), [7, 11, 15]);
});

test('WAVES entries describe a historical phase and match their archetypes', () => {
  WAVES.forEach((w, i) => {
    assert.ok(w.phase, 'phase ' + i + ' has a name');
    assert.ok(w.date, 'phase ' + i + ' has a date');
    assert.ok(w.objective, 'phase ' + i + ' has an objective');
    assert.strictEqual(w.archetypes.length, w.count);
  });
  // Difficulty must escalate: hp, damage and density all grow.
  assert.ok(WAVES[1].hp > WAVES[0].hp);
  assert.ok(WAVES[2].hp > WAVES[1].hp);
  assert.ok(WAVES[2].damage > WAVES[0].damage);
  assert.ok(WAVES[1].interval < WAVES[0].interval);
});

test('WEAPONS defines mosquete and sable with combat stats', () => {
  assert.ok(WEAPONS.mosquete);
  assert.ok(WEAPONS.sable);
  assert.strictEqual(WEAPONS.mosquete.damage, 80);
  assert.strictEqual(WEAPONS.sable.damage, 60);
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

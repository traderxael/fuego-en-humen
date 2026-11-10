const test = require('node:test');
const assert = require('node:assert/strict');

const {
  AllyLogic,
  ALLY_DEFS,
} = require('../js/logic/ally');

test('hay ocho aliados: cuatro fijos en la muralla y cuatro móviles en el patio', () => {
  assert.equal(ALLY_DEFS.length, 8);
  assert.equal(ALLY_DEFS.filter((def) => def.mobile).length, 4);
  assert.equal(ALLY_DEFS.filter((def) => !def.mobile).length, 4);
  for (const def of ALLY_DEFS) {
    assert.equal(def.fortLocal.length, 3);
    if (!def.mobile) {
      assert.ok(def.fortLocal[1] > 0, 'los fijos están elevados en la muralla');
    } else {
      assert.equal(def.fortLocal[1], 0);
      assert.ok(Array.isArray(def.waypoints) && def.waypoints.length >= 2);
      for (const point of def.waypoints) {
        assert.ok(Math.abs(point[0]) <= 17 && point[2] >= 2 && point[2] <= 13,
          'las rutas se quedan dentro del patio');
        assert.equal(point[1], 0);
      }
    }
  }
});

test('toWorld suma la posición del fuerte', () => {
  const fort = { position: { x: 0, y: 0, z: 20 } };
  assert.deepEqual(ALLY_DEFS.map((def) => AllyLogic.toWorld(def.fortLocal, fort))[0],
    { x: -16, y: 1.3, z: 6 });
});

test('pickTarget elige el enemigo vivo más cercano con línea de visión', () => {
  const from = { x: 0, y: 1.2, z: 0 };
  const enemies = [
    { position: { x: 0, y: 0.9, z: -10 }, userData: { hp: 45, kind: 'soldier' } },
    { position: { x: 0, y: 0.9, z: -6 }, userData: { hp: 45, kind: 'soldier' } },
    { position: { x: 0, y: 0.9, z: -3 }, userData: { hp: 0, kind: 'soldier', dead: true } },
    { position: { x: 0, y: 0.9, z: -2 }, userData: { hp: 45, kind: 'soldier' } },
  ];
  const visible = AllyLogic.pickTarget(from, enemies, () => true, 45);  assert.equal(visible, enemies[3], 'el más cercano vivo');

  const blocked = AllyLogic.pickTarget(from, enemies,
    (a, b) => Math.abs(b.z + 2) > 1e-9, 45);
  assert.equal(blocked, enemies[1], 'el de z=-2 queda tapado por un muro');

  const outOfRange = AllyLogic.pickTarget(from, enemies, () => true, 1);
  assert.equal(outOfRange, null);
  assert.equal(AllyLogic.pickTarget(from, [], () => true, 45), null);
});

test('canFire respeta el tiempo de recarga', () => {
  assert.equal(AllyLogic.canFire(10, 10), true);
  assert.equal(AllyLogic.canFire(10.4, 10.7), false);
  assert.equal(AllyLogic.canFire(12, 10.7), true);
});

test('las constantes de combate aliado son modestas', () => {
  assert.ok(AllyLogic.DAMAGE > 10 && AllyLogic.DAMAGE < 40);
  assert.ok(AllyLogic.FIRE_COOLDOWN >= 1.2 && AllyLogic.FIRE_COOLDOWN <= 2.5);
  assert.ok(AllyLogic.SPREAD > 0 && AllyLogic.SPREAD < 0.05);
  assert.ok(AllyLogic.RANGE >= 30 && AllyLogic.RANGE <= 60);
});

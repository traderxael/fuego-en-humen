const test = require('node:test');
const assert = require('node:assert');

const { WEAPONS } = require('../js/logic/config');
const { ARMORY_ORDER, armoryEntries, sanitizeLoadout } = require('../js/logic/armory');

test('ARMORY_ORDER lists every weapon exactly once', () => {
  assert.ok(Array.isArray(ARMORY_ORDER));
  assert.strictEqual(ARMORY_ORDER.length, 5);
  assert.strictEqual(new Set(ARMORY_ORDER).size, ARMORY_ORDER.length);
  for (const key of ARMORY_ORDER) assert.ok(WEAPONS[key], 'unknown weapon ' + key);
});

test('armoryEntries describes every weapon with its stats', () => {
  const entries = armoryEntries(WEAPONS);
  assert.strictEqual(entries.length, 5);
  const mosquete = entries.find((e) => e.key === 'mosquete');
  assert.strictEqual(mosquete.type, 'rifle');
  assert.strictEqual(mosquete.damage, 80);
  assert.ok(mosquete.label.length > 0);
  assert.ok(mosquete.desc.length > 0);
  const pica = entries.find((e) => e.key === 'pica');
  assert.strictEqual(pica.type, 'melee');
  assert.strictEqual(pica.range, 3.0);
});

test('armoryEntries keeps the armory order', () => {
  const entries = armoryEntries(WEAPONS);
  assert.deepStrictEqual(entries.map((e) => e.key), ARMORY_ORDER);
});

test('armoryEntries ignores weapons that are not in the armory', () => {
  const weapons = Object.assign({}, WEAPONS, { ballesta: { type: 'rifle', damage: 1 } });
  const entries = armoryEntries(weapons);
  assert.strictEqual(entries.length, 5);
  assert.ok(!entries.some((e) => e.key === 'ballesta'));
});

test('el trabuco entra en la armería con ocho perdigones', () => {
  const entries = armoryEntries(WEAPONS);
  const trabuco = entries.find((e) => e.key === 'trabuco');
  assert.ok(trabuco);
  assert.strictEqual(trabuco.type, 'rifle');
  assert.strictEqual(trabuco.damage, 40);
  assert.strictEqual(trabuco.pellets, 8);
  assert.strictEqual(trabuco.clipSize, 1);
  assert.strictEqual(trabuco.reloadTime, 2.8);
});

test('sanitizeLoadout keeps a valid weapon and falls back to the mosquete', () => {
  assert.strictEqual(sanitizeLoadout('fusil', WEAPONS), 'fusil');
  assert.strictEqual(sanitizeLoadout('pica', WEAPONS), 'pica');
  assert.strictEqual(sanitizeLoadout('ballesta', WEAPONS), 'mosquete');
  assert.strictEqual(sanitizeLoadout(undefined, WEAPONS), 'mosquete');
  assert.strictEqual(sanitizeLoadout('', WEAPONS), 'mosquete');
  assert.strictEqual(sanitizeLoadout(null, WEAPONS), 'mosquete');
});

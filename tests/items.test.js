const test = require('node:test');
const assert = require('node:assert/strict');

const { WEAPONS } = require('../js/logic/config');
const {
  ItemLogic,
  ITEM_DEFS,
  createInventory,
  addItem,
  useItem,
  needsAmmo,
  refillClips,
  rollDrop,
  inPickupRange,
} = require('../js/logic/items');

test('el inventario arranca vacío y los objetos ocupan los huecos 6, 7 y 8', () => {
  assert.equal(typeof ItemLogic.addItem, 'function');
  assert.deepEqual(Object.keys(ITEM_DEFS).sort(), ['ammoBag', 'grenade', 'medkit']);
  assert.equal(ITEM_DEFS.medkit.slot, 6);
  assert.equal(ITEM_DEFS.ammoBag.slot, 7);
  assert.equal(ITEM_DEFS.grenade.slot, 8);
  assert.equal(ITEM_DEFS.medkit.max, 3);
  assert.equal(ITEM_DEFS.ammoBag.max, 3);
  assert.equal(ITEM_DEFS.grenade.max, 2);
  assert.equal(ITEM_DEFS.medkit.heal, 35);
  assert.deepEqual(createInventory(), { medkit: 0, ammoBag: 0, grenade: 0 });
});

test('addItem satura en el tope y devuelve el sobrante', () => {
  const inventory = createInventory();
  assert.deepEqual(addItem(inventory, 'medkit', 2), { added: 2, leftover: 0 });
  assert.equal(inventory.medkit, 2);
  assert.deepEqual(addItem(inventory, 'medkit', 2), { added: 1, leftover: 1 });
  assert.equal(inventory.medkit, 3);
  assert.deepEqual(addItem(inventory, 'grenade', 5), { added: 2, leftover: 3 });
  assert.equal(inventory.grenade, 2);
});

test('addItem ignora objetos desconocidos o cantidades no positivas', () => {
  const inventory = createInventory();
  assert.deepEqual(addItem(inventory, 'ballesta', 1), { added: 0, leftover: 1 });
  assert.deepEqual(addItem(inventory, 'medkit', 0), { added: 0, leftover: 0 });
  assert.equal(inventory.medkit, 0);
});

test('useItem consume uno y falla sin existencias', () => {
  const inventory = createInventory();
  assert.equal(useItem(inventory, 'grenade'), false);
  addItem(inventory, 'grenade', 1);
  assert.equal(useItem(inventory, 'grenade'), true);
  assert.equal(inventory.grenade, 0);
  assert.equal(useItem(inventory, 'grenade'), false);
});

test('needsAmmo sólo mira armas de fuego y refillClips las deja llenas', () => {
  const clips = { mosquete: 1, fusil: 0, trabuco: 1 };
  assert.equal(needsAmmo(clips, WEAPONS), true);
  assert.equal(refillClips(clips, WEAPONS), 1, 'sólo el fusil estaba vacío');
  assert.deepEqual(clips, { mosquete: 1, fusil: 1, trabuco: 1 });
  assert.equal(needsAmmo(clips, WEAPONS), false);
  assert.equal(refillClips(clips, WEAPONS), 0);
  assert.equal('sable' in clips, false, 'las armas cuerpo a cuerpo no tienen cargador');
});

test('rollDrop reparte botiquín, munición y granada por tramos', () => {
  assert.equal(rollDrop(0), 'medkit');
  assert.equal(rollDrop(0.0999), 'medkit');
  assert.equal(rollDrop(0.1), 'ammoBag');
  assert.equal(rollDrop(0.2199), 'ammoBag');
  assert.equal(rollDrop(0.22), 'grenade');
  assert.equal(rollDrop(0.2799), 'grenade');
  assert.equal(rollDrop(0.28), null);
  assert.equal(rollDrop(0.99), null);
});

test('inPickupRange acepta 1.79 m y rechaza 1.81 m o 1.3 m de altura', () => {
  assert.equal(inPickupRange({ x: 0, y: 0, z: 0 }, { x: 1.79, y: 0, z: 0 }), true);
  assert.equal(inPickupRange({ x: 0, y: 0, z: 0 }, { x: 1.81, y: 0, z: 0 }), false);
  assert.equal(inPickupRange({ x: 0, y: 0, z: 0 }, { x: 0, y: 1.3, z: 0 }), false);
  assert.equal(inPickupRange({ x: 0, y: 1.2, z: 0 }, { x: 0, y: 0, z: 0 }), true);
});

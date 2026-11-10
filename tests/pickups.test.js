const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const THREE = require('../vendor/three.min.js');

const { createInventory } = require('../js/logic/items');

function runtime(options) {
  const context = vm.createContext({ THREE });
  for (const file of ['items']) {
    vm.runInContext(
      fs.readFileSync(path.join(__dirname, '..', 'js', 'logic', file + '.js'), 'utf8'),
      context,
    );
  }
  // pickups.js is a browser global that reads ITEM_DEFS/ItemLogic globals.
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'pickups.js'), 'utf8'), context);
  const scene = new THREE.Scene();
  const fort = new THREE.Group();
  fort.position.set(0, 0, 20);
  const pickups = context.Pickups.create(scene, fort, options);
  return { Pickups: context.Pickups, pickups, scene, fort };
}

function playerAt(x, y, z, inventory) {
  return {
    position: new THREE.Vector3(x, y, z),
    inventory: inventory || createInventory(),
  };
}

function fixed(pickups, key) {
  return pickups.list.find((item) => item.kind === 'fixed' && item.key === key);
}

test('crea tres cajas fijas junto al patio y sin proyectar sombra', () => {
  const { pickups, scene } = runtime();
  assert.equal(pickups.list.length, 3);
  assert.deepEqual(Array.from(pickups.list, (item) => item.key).sort(), ['ammoBag', 'grenade', 'medkit']);
  for (const item of pickups.list) {
    assert.equal(item.kind, 'fixed');
    assert.equal(item.active, true);
    assert.equal(item.mesh.castShadow, false);
    assert.equal(item.mesh.parent, scene);
    assert.equal(item.mesh.userData.pickupKey, item.key);
  }
  const medkit = fixed(pickups, 'medkit');
  assert.deepEqual(
    [medkit.mesh.position.x, medkit.mesh.position.y, medkit.mesh.position.z],
    [-7, 0.45, 14],
    'las cajas se colocan en coordenadas del fuerte',
  );
});

test('recoger a menos de 1.8 m suma el objeto y oculta la caja', () => {
  const { pickups } = runtime();
  const inventory = createInventory();
  const player = playerAt(-7, 1.2, 15, inventory);
  const result = pickups.tryPickup(player);
  assert.equal(result.ok, true);
  assert.equal(result.key, 'medkit');
  assert.equal(inventory.medkit, 1);
  const crate = fixed(pickups, 'medkit');
  assert.equal(crate.active, false);
  assert.equal(crate.mesh.visible, false);
});

test('recoger mide desde el cuerpo, no desde los ojos a 1,7 m', () => {
  const { pickups } = runtime();
  const body = { position: new THREE.Vector3(-7, 0.9, 15) };
  const camera = { position: new THREE.Vector3(-7, 1.7, 15) };
  const inventory = createInventory();
  const result = pickups.tryPickup({ body, camera, inventory });
  assert.equal(result.ok, true, 'con la cámara a 1,7 m el objeto del suelo queda fuera de rango');
  assert.equal(inventory.medkit, 1);
});

test('no recoge lejos ni con el inventario lleno', () => {
  const { pickups } = runtime();
  const far = playerAt(20, 1, 40, createInventory());
  assert.equal(pickups.tryPickup(far).ok, false);
  assert.equal(fixed(pickups, 'medkit').active, true);

  const full = createInventory();
  full.medkit = 3;
  const near = playerAt(-7, 1.2, 15, full);
  const result = pickups.tryPickup(near);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'full');
  assert.equal(fixed(pickups, 'medkit').active, true);
});

test('la caja reaparece a los 25 s', () => {
  const { pickups } = runtime();
  const player = playerAt(-7, 1.2, 15, createInventory());
  pickups.tryPickup(player);
  pickups.update(0.016, player, 10);
  assert.equal(fixed(pickups, 'medkit').active, false);
  pickups.update(0.016, player, 36);
  assert.equal(fixed(pickups, 'medkit').active, true);
});

test('sólo la infantería suelta botín y nunca hay más de ocho drops', () => {
  const { pickups } = runtime({ random: () => 0.05 });
  const enemy = { position: new THREE.Vector3(0, 0.9, 0), userData: { kind: 'soldier' } };
  const none = pickups.onEnemyKilled({ position: enemy.position, userData: { kind: 'artillery' } });
  assert.equal(none, null);
  assert.equal(pickups.drops.length, 0);

  for (let i = 0; i < 9; i++) {
    const drop = pickups.onEnemyKilled(enemy);
    assert.ok(drop);
    assert.equal(drop.key, 'medkit');
  }
  assert.equal(pickups.drops.length, 8, 'el más antiguo se retira');
});

test('los objetos del suelo caducan a los 30 s', () => {
  const { pickups, scene } = runtime({ random: () => 0.15 });
  const enemy = { position: new THREE.Vector3(0, 0.9, 0), userData: { kind: 'soldier' } };
  const drop = pickups.onEnemyKilled(enemy);
  assert.equal(drop.key, 'ammoBag');
  assert.equal(drop.mesh.parent, scene);
  pickups.update(0.016, playerAt(0, 1, 0), 10);
  assert.equal(drop.active, true);
  pickups.update(0.016, playerAt(0, 1, 0), 41);
  assert.equal(drop.active, false);
  assert.equal(drop.mesh.parent, null);
});

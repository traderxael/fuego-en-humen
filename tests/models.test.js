const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const THREE = require('../vendor/three.min.js');
const { createCanvas } = require('./helpers/fake-canvas.js');

function runtime(withAssets = true) {
  const context = vm.createContext({
    THREE,
    document: { createElement: createCanvas },
  });
  for (const file of [...(withAssets ? ['assets'] : []), 'models', 'world']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', file + '.js'), 'utf8'), context);
  }
  return context;
}

function asset(name) {
  const original = new THREE.Group();
  original.name = name;
  const nested = new THREE.Group();
  nested.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ map: new THREE.Texture() })));
  original.add(nested);
  return original;
}

function meshes(root) {
  const result = [];
  root.traverse(object => { if (object.isMesh) result.push(object); });
  return result;
}

test('makeCannon prefiere el asset, conserva tipo y activa sombras sin modificar el original', () => {
  const { Assets, Models } = runtime();
  const original = asset('bronze-cannon');
  original.userData.source = 'embedded';
  Assets.register('cannon', original);
  const cannon = Models.makeCannon();
  assert.equal(cannon.name, 'bronze-cannon');
  assert.equal(cannon.userData.type, 'cannon');
  assert.equal(cannon.userData.source, 'embedded');
  assert.notStrictEqual(cannon, original);
  assert.equal(cannon.rotation.y, 0, 'no invertir el asset normalizado hacia -Z');
  for (const mesh of meshes(cannon)) {
    assert.equal(mesh.castShadow, true);
    assert.equal(mesh.receiveShadow, true);
  }
  assert.equal(original.userData.type, undefined);
  assert.equal(meshes(original)[0].castShadow, false);
});

test('dos cañones clonan jerarquía y transformaciones pero comparten geometría, material y textura', () => {
  const { Assets, Models } = runtime();
  const original = asset('cannon');
  Assets.register('cannon', original);
  const a = Models.makeCannon();
  const b = Models.makeCannon();
  const source = meshes(original)[0];
  for (const cannon of [a, b]) {
    const mesh = meshes(cannon)[0];
    assert.notStrictEqual(mesh, source);
    assert.strictEqual(mesh.geometry, source.geometry);
    assert.strictEqual(mesh.material, source.material);
    assert.strictEqual(mesh.material.map, source.material.map);
  }
  assert.notStrictEqual(a, b);
  a.position.x = 10;
  a.children[0].rotation.z = 0.3;
  assert.equal(b.position.x, 0);
  assert.ok(b.children[0].rotation.z === 0, 'THREE puede representar la rotación nula como -0');
  assert.equal(original.position.x, 0);
});

test('makeCannon conserva la primitiva al eliminar el asset o sin Assets global', () => {
  const registered = runtime();
  registered.Assets.register('cannon', asset('removed'));
  registered.Assets.register('cannon', null);
  assert.equal(registered.Assets.has('cannon'), false);
  for (const { Models } of [registered, runtime(false)]) {
    const cannon = Models.makeCannon();
    assert.equal(cannon.userData.type, 'cannon');
    assert.equal(meshes(cannon).length, 7);
    assert.equal(cannon.children[1].position.z, -0.5);
  }
});

test('guarnición: ocho clones locales mirando -Z, recursos compartidos y sin nuevos colliders ni luces', () => {
  const { Assets, buildWorld } = runtime();
  const scene = new THREE.Scene();
  const original = asset('qing');
  Assets.register('qing', original);
  const world = buildWorld(scene);
  assert.ok(Array.isArray(world.garrison));
  assert.deepEqual(Array.from(world.garrison, q => q.position.toArray()), [
    [-16, 1.3, -14], [16, 1.3, -14], [-23, 4, -16],
    [23, 4, -16], [-14, 0, 10], [14, 0, 10],
    [-7, 0, 13], [7, 0, 13],
  ]);
  assert.equal(new Set(world.garrison).size, 8);
  const source = meshes(original)[0];
  for (const qing of world.garrison) {
    assert.strictEqual(qing.parent, world.fort);
    assert.notStrictEqual(qing, original);
    assert.equal(qing.rotation.y, 0);
    assert.notStrictEqual(meshes(qing)[0], source);
    assert.strictEqual(meshes(qing)[0].geometry, source.geometry);
    assert.strictEqual(meshes(qing)[0].material, source.material);
    assert.strictEqual(meshes(qing)[0].material.map, source.material.map);
  }
  const baseline = runtime(false).buildWorld(new THREE.Scene());
  assert.deepEqual(JSON.parse(JSON.stringify(world.colliders)), JSON.parse(JSON.stringify(baseline.colliders)));
  let lights = 0;
  scene.traverse(object => { if (object.isLight) lights++; });
  assert.equal(lights, 2);
});

test('world.update balancea sólo los clones qing sin acumular rotación ni deformar su geometría', () => {
  const { Assets, buildWorld } = runtime();
  const original = asset('qing');
  Assets.register('qing', original);
  const world = buildWorld(new THREE.Scene());
  assert.ok(Array.isArray(world.garrison));
  const positions = world.garrison.map(q => q.position.clone());
  const geometry = meshes(original)[0].geometry.attributes.position.array;
  const before = Array.from(geometry);
  for (const time of [0, 2.5, 0]) {
    world.update(time);
    world.garrison.forEach((qing, i) => {
      assert.ok(Math.abs(qing.rotation.z - Math.sin(time * 0.8 + i) * 0.008) < 1e-12);
      assert.ok(qing.position.equals(positions[i]));
      assert.equal(qing.rotation.y, 0);
    });
  }
  assert.equal(original.rotation.z, 0);
  assert.deepEqual(Array.from(geometry), before);
});

test('buildWorld y update no fallan sin qing registrado o sin Assets global', () => {
  const registered = runtime();
  registered.Assets.register('qing', asset('removed'));
  registered.Assets.register('qing', null);
  for (const { buildWorld } of [registered, runtime(false)]) {
    const world = buildWorld(new THREE.Scene());
    assert.ok(Array.isArray(world.garrison));
    assert.equal(world.garrison.length, 0);
    assert.equal(world.cannons.length, 4);
    assert.doesNotThrow(() => world.update(1));
  }
});

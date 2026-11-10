const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const THREE = require('../vendor/three.min.js');
const { createCanvas } = require('./helpers/fake-canvas.js');

function runtime() {
  const context = vm.createContext({
    THREE,
    document: { createElement: createCanvas },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'models.js'), 'utf8'), context);
  return context.Models;
}

function lights(root) {
  let count = 0;
  root.traverse((object) => { if (object.isLight) count++; });
  return count;
}

test('el vapor Nemesis es una sola malla con ruedas, chimenea y pabellón', () => {
  const Models = runtime();
  const steamer = Models.makeSteamer();
  assert.equal(steamer.isMesh, true, 'una malla fusionada, un draw call');
  assert.equal(steamer.userData.type, 'steamer');
  assert.ok(steamer.geometry.index.count > 600, 'detalle suficiente');
  assert.equal(lights(steamer), 0);
});

test('juncos, cadena y aldea son mallas fusionadas sin luces', () => {
  const Models = runtime();
  for (const [builder, type] of [
    ['makeJunk', 'junk'],
    ['makeChainBoom', 'chain-boom'],
    ['makeVillage', 'village'],
  ]) {
    const prop = Models[builder]();
    assert.equal(prop.isMesh, true, type);
    assert.equal(prop.userData.type, type);
    assert.equal(lights(prop), 0);
    assert.ok(prop.geometry.attributes.color, 'color por vértice');
  }
});

test('la balsa incendiaria lleva brasas emisivas', () => {
  const Models = runtime();
  const raft = Models.makeFireRaft();
  assert.equal(raft.userData.type, 'fire-raft');
  assert.equal(raft.children.length, 1);
  const ember = raft.userData.ember;
  assert.equal(ember.userData.type, 'fire-raft-ember');
  assert.ok(ember.material.emissiveIntensity > 1);
});

test('los banderines qing usan un carácter y no la bandera nacional posterior', () => {
  const Models = runtime();
  const brave = Models.getBannerTexture('勇');
  const order = Models.getBannerTexture('令');
  assert.ok(brave.image && brave.image.width === 64);
  assert.notStrictEqual(brave, order, 'cada carácter tiene su textura');
  assert.strictEqual(Models.getBannerTexture('勇'), brave, 'se cachea');
  assert.strictEqual(Models.getFlagTexture(), brave, 'la bandera del fuerte es el banderín');
});

test('el pabellón británico es distinto del banderín qing', () => {
  const Models = runtime();
  const ensign = Models.getEnsignTexture();
  assert.notStrictEqual(ensign, Models.getBannerTexture('勇'));
  assert.equal(ensign.image.width, 48);
  assert.strictEqual(Models.getEnsignTexture(), ensign, 'se cachea');
});

test('los veleros izan el pabellón blanco en la popa', () => {
  const Models = runtime();
  const ship = Models.makeShip();
  let ensign = null;
  ship.traverse((object) => { if (object.userData.type === 'ensign') ensign = object; });
  assert.ok(ensign, 'el barco debe llevar pabellón');
  assert.strictEqual(ensign.material.map, Models.getEnsignTexture());
  assert.equal(ensign.castShadow, false);
  assert.ok(ensign.position.z < -4, 'a popa');
});

test('buildWorld monta la flota histórica sin luces ni colliders extra', () => {
  const context = vm.createContext({
    THREE,
    document: { createElement: createCanvas },
  });
  for (const file of ['models', 'world']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', file + '.js'), 'utf8'), context);
  }
  const scene = new THREE.Scene();
  const world = context.buildWorld(scene);

  assert.equal(world.steamers.length, 1);
  assert.equal(world.steamers[0].userData.type, 'steamer');
  assert.equal(world.junks.length, 3);
  assert.equal(world.chain.userData.type, 'chain-boom');
  assert.equal(world.fireRafts.length, 2);
  assert.equal(world.village.length, 2);
  assert.equal(world.colliders.length, 11, 'la física no cambia');
  assert.equal(lights(scene), 2, 'sin luces nuevas');

  const positions = world.fireRafts.map((raft) => raft.mesh.position.y);
  world.update(2.5);
  assert.notDeepEqual(world.fireRafts.map((raft) => raft.mesh.position.y), positions,
    'las balsas se mecen');
});

test('los jingales son props fusionados', () => {
  const Models = runtime();
  const jingal = Models.makeJingal();
  assert.equal(jingal.userData.type, 'jingal');
  assert.equal(jingal.isMesh, true);
  assert.equal(lights(jingal), 0);
});

test('el fuerte monta cuatro jingales en el parapeto', () => {
  const context = vm.createContext({ THREE, document: { createElement: createCanvas } });
  for (const file of ['models', 'world']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', file + '.js'), 'utf8'), context);
  }
  const world = context.buildWorld(new THREE.Scene());
  assert.equal(world.jingals.length, 4);
  for (const jingal of world.jingals) assert.equal(jingal.userData.type, 'jingal');
});

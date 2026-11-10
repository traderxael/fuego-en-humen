const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const THREE = require('../vendor/three.min.js');
const { createCanvas } = require('./helpers/fake-canvas.js');

function runtime(withAsset = true) {
  const context = vm.createContext({
    THREE,
    document: { createElement: createCanvas },
  });
  for (const file of ['assets', 'models']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', file + '.js'), 'utf8'), context);
  }
  if (withAsset) context.Assets.register('british', britishAsset());
  return context;
}

// Stand-in for the Rodin GLB: two meshes, two shared-texture materials, one
// metre tall and centred off the origin so normalization has work to do.
function britishAsset() {
  const root = new THREE.Group();
  root.name = 'british-glb';
  const texture = new THREE.Texture();
  const coat = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.7, 0.3),
    new THREE.MeshStandardMaterial({ map: texture, color: 0xaa2222 }),
  );
  coat.position.set(0.2, 0.35, 0);
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.3, 0.25),
    new THREE.MeshStandardMaterial({ map: texture, color: 0xdddddd }),
  );
  legs.position.set(0.2, 0.85, 0);
  root.add(coat);
  root.add(legs);
  root.userData.source = 'rodin';
  return root;
}

function meshes(root) {
  const out = [];
  root.traverse((object) => { if (object.isMesh) out.push(object); });
  return out;
}

function height(root) {
  const box = new THREE.Box3().setFromObject(root);
  return box.getSize(new THREE.Vector3()).y;
}

test('el británico usa el GLB, se normaliza a 1,75 m y apoya en el suelo', () => {
  const { Models } = runtime();
  const soldier = Models.makeBritishSoldier();
  assert.equal(soldier.userData.type, 'british-soldier');
  assert.equal(meshes(soldier).length, 2, 'mallas del GLB, no primitivas');
  assert.ok(Math.abs(height(soldier) - 1.75) < 1e-6, `altura ${height(soldier)}`);
  const box = new THREE.Box3().setFromObject(soldier);
  assert.ok(Math.abs(box.min.y) < 1e-6, 'los pies tocan el suelo');
  const center = box.getCenter(new THREE.Vector3());
  assert.ok(Math.abs(center.x) < 1e-6 && Math.abs(center.z) < 1e-6, 'centrado en el pivote');
});

test('cada enemigo recibe su propio material para que el flash sea individual', () => {
  const { Models, Assets } = runtime();
  const source = meshes(Assets.clone('british')).map((mesh) => mesh.material);
  const a = Models.makeBritishSoldier();
  const b = Models.makeBritishSoldier();
  const meshA = meshes(a);
  const meshB = meshes(b);
  for (let i = 0; i < meshA.length; i++) {
    const sourceMesh = meshes(Assets.clone('british'))[i];
    assert.strictEqual(meshA[i].geometry, sourceMesh.geometry, 'la geometría se comparte');
    assert.strictEqual(meshA[i].material.map, sourceMesh.material.map, 'la textura se comparte');
    assert.notStrictEqual(meshA[i].material, sourceMesh.material, 'el material no se comparte con el asset');
    assert.notStrictEqual(meshA[i].material, meshB[i].material, 'dos enemigos no comparten material');
  }
  for (const material of source) assert.ok(material);
});

test('soldado, runner y oficial se distinguen por tinte y escala', () => {
  const { Models } = runtime();
  const soldier = Models.makeBritishSoldier();
  const runner = Models.makeBritishRunner();
  const officer = Models.makeBritishOfficer();
  assert.equal(runner.userData.type, 'british-runner');
  assert.equal(officer.userData.type, 'british-officer');
  const colors = [soldier, runner, officer].map((unit) => meshes(unit)[0].material.color.getHex());
  assert.equal(new Set(colors).size, 3, 'cada tipo tiene su tinte');
  assert.equal(colors[0], 0xffffff, 'el soldado no se tiñe');
  assert.ok(Math.abs(height(runner) / height(soldier) - 0.95) < 1e-6);
  assert.ok(Math.abs(height(officer) / height(soldier) - 1.06) < 1e-6);
});

test('el GLB proyecta y recibe sombra en todas sus mallas', () => {
  const { Models } = runtime();
  for (const unit of [Models.makeBritishSoldier(), Models.makeBritishRunner(), Models.makeBritishOfficer()]) {
    for (const mesh of meshes(unit)) {
      assert.equal(mesh.castShadow, true);
      assert.equal(mesh.receiveShadow, true);
    }
  }
});

test('sin asset, el fallback es una sola malla con color por vértice', () => {
  const { Models } = runtime(false);
  const soldier = Models.makeBritishSoldier();
  const runner = Models.makeBritishRunner();
  const officer = Models.makeBritishOfficer();
  assert.equal(soldier.userData.type, 'british-soldier');
  assert.equal(runner.userData.type, 'british-runner');
  assert.equal(officer.userData.type, 'british-officer');

  for (const unit of [soldier, runner, officer]) {
    assert.equal(meshes(unit).length, 1, 'una malla por soldado');
    const { material } = meshes(unit)[0];
    assert.equal(material.vertexColors, true);
    assert.ok(material.emissive, 'el flash de impacto necesita emisivo');
  }

  const a = Models.makeBritishSoldier();
  const b = Models.makeBritishSoldier();
  assert.strictEqual(meshes(a)[0].geometry, meshes(b)[0].geometry, 'la geometría se cachea por tipo');
  assert.notStrictEqual(meshes(a)[0].material, meshes(b)[0].material, 'material único por enemigo');
  assert.notStrictEqual(meshes(a)[0].geometry, meshes(runner)[0].geometry, 'cada tipo tiene su malla');

  const info = meshes(soldier)[0].geometry;
  assert.ok(info.index && info.index.count >= 200, 'detalle suficiente en la malla fusionada');
  assert.ok(info.attributes.position.count > 100);
  assert.ok(height(soldier) >= 1.8 && height(soldier) <= 2.1, `altura ${height(soldier)}`);
  assert.ok(height(officer) > height(soldier), 'el oficial es más alto');
});

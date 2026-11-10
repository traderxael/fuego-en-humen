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
  for (const file of ['assets', 'models', 'world']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', file + '.js'), 'utf8'), context);
  }
  return context;
}

function meshes(root) {
  const out = [];
  root.traverse(object => { if (object.isMesh) out.push(object); });
  return out;
}

function roles(root, name) {
  return meshes(root).filter(mesh => mesh.userData.wallRole === name);
}

function top(mesh) {
  return mesh.position.y + mesh.geometry.parameters.height / 2;
}

function size(mesh) {
  const p = mesh.geometry.parameters;
  return { w: p.width, h: p.height, d: p.depth };
}

function maxU(mesh) {
  const uv = mesh.geometry.attributes.uv;
  let max = 0;
  for (let i = 0; i < uv.count; i++) max = Math.max(max, uv.getX(i));
  return max;
}

test('la muralla estrena perfil: zócalo más ancho, cuerpo y cornisa', () => {
  const { Models } = runtime();
  const wall = Models.makeFortWall(28, 4, { kind: 'side' });
  assert.equal(wall.userData.type, 'fort-wall');
  assert.equal(wall.userData.kind, 'side');

  const [body] = roles(wall, 'body');
  const [plinth] = roles(wall, 'plinth');
  const [coping] = roles(wall, 'coping');
  assert.ok(body && plinth && coping, 'faltan body/plinth/coping');
  assert.ok(size(plinth).d > size(body).d, 'el zócalo debe ser más ancho que el cuerpo');
  assert.ok(size(coping).d > size(body).d, 'la cornisa debe volar sobre el cuerpo');
  assert.ok(Math.abs(size(body).w - 28) < 1e-9);
  assert.ok(Math.abs(size(body).h - 4) < 1e-9);
  assert.ok(Math.abs(top(body) - 4) < 1e-9, 'el cuerpo llega hasta la altura pedida');
  assert.ok(top(coping) > 4 && top(coping) <= 4.4, 'la cornisa remata por encima del cuerpo');
});

test('la piedra es una sola textura repetida y compartida por todos los muros', () => {
  const { Models } = runtime();
  const a = Models.makeFortWall(40, 1.3, { kind: 'parapet' });
  const b = Models.makeFortWall(10, 4, { kind: 'arm' });
  const mapA = roles(a, 'body')[0].material.map;
  const mapB = roles(b, 'body')[0].material.map;
  assert.ok(mapA, 'el cuerpo debe usar la textura de piedra');
  assert.strictEqual(mapA, mapB, 'los muros deben compartir la misma textura');
  assert.equal(mapA.wrapS, THREE.RepeatWrapping);
  assert.equal(mapA.wrapT, THREE.RepeatWrapping);
  assert.equal(mapA.image.width, 256);
  assert.equal(mapA.image.height, 256);
});

test('las UVs crecen con la longitud: la piedra no se estira', () => {
  const { Models } = runtime();
  const long = roles(Models.makeFortWall(40, 1.3, { kind: 'parapet' }), 'body')[0];
  const short = roles(Models.makeFortWall(10, 4, { kind: 'arm' }), 'body')[0];
  assert.ok(maxU(long) >= 10, `UV máxima ${maxU(long)} en 40 m`);
  assert.ok(maxU(short) >= 2.5 && maxU(short) <= 4.5, `UV máxima ${maxU(short)} en 10 m`);
});

test('el parapeto de mar no tapa la línea de visión', () => {
  const { Models } = runtime();
  const parapet = Models.makeFortWall(40, 1.3, { kind: 'parapet' });
  assert.equal(roles(parapet, 'merlon').length, 0, 'el parapeto no lleva almenas');
  for (const mesh of meshes(parapet)) {
    assert.ok(top(mesh) <= 1.6, `estorbaba la vista a ${top(mesh)} m (${mesh.userData.wallRole})`);
  }
});

test('los muros altos llevan almenas separadas y dentro de la longitud', () => {
  const { Models } = runtime();
  const wall = Models.makeFortWall(28, 4, { kind: 'side' });
  const merlons = roles(wall, 'merlon');
  assert.ok(merlons.length >= 8, `sólo ${merlons.length} almenas`);
  const xs = merlons.map(m => m.position.x).sort((p, q) => p - q);
  const width = size(merlons[0]).w;
  for (let i = 0; i < xs.length; i++) {
    assert.ok(Math.abs(xs[i]) + width / 2 <= 14 + 1e-9, 'almena fuera del muro');
    if (i > 0) assert.ok(xs[i] - xs[i - 1] - width >= 0.35, `almenas solapadas en ${xs[i]}`);
    assert.ok(top(merlons[i]) > 4 && top(merlons[i]) <= 4.8, 'almena a altura rara');
  }
  for (const merlon of merlons) assert.strictEqual(merlon.geometry, merlons[0].geometry);
});

test('cada muro remata sus extremos con bastiones simétricos', () => {
  const { Models } = runtime();
  for (const length of [10, 28, 40]) {
    const wall = Models.makeFortWall(length, 4, { kind: 'side' });
    const bastions = roles(wall, 'bastion');
    assert.equal(bastions.length, 2, `bastiones inesperados en ${length} m`);
    const xs = bastions.map(b => b.position.x).sort((p, q) => p - q);
    assert.ok(Math.abs(xs[0] + xs[1]) < 1e-9, 'bastiones asimétricos');
    for (const bastion of bastions) {
      assert.ok(Math.abs(bastion.position.x) + size(bastion).w / 2 <= length / 2 + 1e-9);
    }
  }
});

test('el muro terrestre tiene puerta con portón de madera, jambas y dintel', () => {
  const { Models } = runtime();
  const gated = Models.makeFortWall(40, 5, { kind: 'landward', gate: true, face: -1 });
  const stone = roles(gated, 'body')[0].material;
  assert.equal(roles(gated, 'gate-jamb').length, 2);
  assert.equal(roles(gated, 'gate-lintel').length, 1);
  const leaves = roles(gated, 'gate-leaf');
  assert.equal(leaves.length, 2);
  for (const leaf of leaves) assert.notStrictEqual(leaf.material, stone, 'el portón no es piedra');
  assert.ok(roles(gated, 'gate-band').length >= 4);
  assert.equal(roles(gated, 'gate-plaque').length, 1);
  const bare = Models.makeFortWall(40, 5, { kind: 'landward' });
  assert.equal(roles(bare, 'gate-leaf').length, 0, 'sin gate no hay portón');
});

test('el muro terrestre amuebla el patio con barriles y cajas', () => {
  const { Models } = runtime();
  const gated = Models.makeFortWall(40, 5, { kind: 'landward', gate: true, face: -1 });
  assert.ok(roles(gated, 'barrel').length >= 2);
  assert.ok(roles(gated, 'crate').length >= 1);
  const side = Models.makeFortWall(28, 4, { kind: 'side' });
  assert.equal(roles(side, 'barrel').length, 0, 'los pertrechos son sólo del muro terrestre');
});

test('las banderas se cuelgan en la cara del patio', () => {
  const { Models } = runtime();
  const inward = Models.makeFortWall(28, 4, { kind: 'side', face: 1 });
  const banners = roles(inward, 'banner');
  assert.equal(banners.length, 2);
  for (const banner of banners) {
    assert.ok(banner.position.z > 0.7, 'la bandera debe quedar por delante del cuerpo');
    assert.equal(banner.rotation.y, 0);
    assert.equal(banner.material.side, THREE.DoubleSide);
  }
  const outward = Models.makeFortWall(28, 4, { kind: 'side', face: -1 });
  for (const banner of roles(outward, 'banner')) {
    assert.ok(banner.position.z < -0.7);
    assert.ok(Math.abs(banner.rotation.y) === Math.PI);
  }
});

test('los detalles no proyectan sombra; los volúmenes principales sí', () => {
  const { Models } = runtime();
  const wall = Models.makeFortWall(40, 5, { kind: 'landward', gate: true, face: -1 });
  for (const name of ['body', 'plinth', 'coping']) {
    assert.ok(roles(wall, name).length > 0, 'falta ' + name);
    for (const mesh of roles(wall, name)) assert.equal(mesh.castShadow, true, name + ' sin sombra');
  }
  for (const name of ['merlon', 'banner', 'gate-band', 'gate-plaque', 'barrel', 'crate']) {
    assert.ok(roles(wall, name).length > 0, 'falta ' + name);
    for (const mesh of roles(wall, name)) assert.equal(mesh.castShadow, false, name + ' proyecta sombra');
  }
});

test('el portón se ve: hojas por delante de la cara y jambas que envuelven el muro', () => {
  const { Models } = runtime();
  const gated = Models.makeFortWall(40, 5, { kind: 'landward', gate: true, face: -1 });
  const body = roles(gated, 'body')[0];
  const face = body.geometry.parameters.depth / 2;
  for (const leaf of roles(gated, 'gate-leaf')) {
    assert.ok(Math.abs(leaf.position.z) > face, 'la hoja queda dentro del muro y no se ve');
  }
  for (const jamb of roles(gated, 'gate-jamb')) {
    assert.ok(jamb.geometry.parameters.depth > face * 2, 'la jamba debe envolver el espesor del muro');
  }
  for (const band of roles(gated, 'gate-band')) {
    assert.ok(Math.abs(band.position.z) > face, 'los herrajes deben quedar por delante');
  }
});

test('la torre del ángulo usa la misma piedra y un zócalo más ancho', () => {
  const { Models } = runtime();
  assert.equal(typeof Models.makeTower, 'function');
  const tower = Models.makeTower(4, 7);
  assert.equal(tower.userData.type, 'fort-tower');
  const [base] = roles(tower, 'tower-base');
  const [plinth] = roles(tower, 'tower-plinth');
  const [cornice] = roles(tower, 'tower-cornice');
  assert.ok(base && plinth && cornice, 'faltan base/zócalo/cornisa');
  assert.ok(size(plinth).w > size(base).w);
  assert.ok(top(cornice) >= 7 && top(cornice) <= 7.6);
  const wall = Models.makeFortWall(10, 4, { kind: 'arm' });
  assert.strictEqual(base.material.map, roles(wall, 'body')[0].material.map,
    'la torre debe compartir la textura de la muralla');
});

test('cada cañón descansa sobre una plataforma compartida y sin collider extra', () => {
  const { buildWorld } = runtime();
  const scene = new THREE.Scene();
  const world = buildWorld(scene);
  const platforms = [];
  world.fort.traverse(object => {
    if (object.userData && object.userData.type === 'gun-platform') platforms.push(object);
  });
  assert.equal(platforms.length, 4);
  for (const platform of platforms) {
    assert.strictEqual(platform.geometry, platforms[0].geometry);
    assert.strictEqual(platform.material, platforms[0].material);
    assert.equal(platform.castShadow, false);
  }
  for (const cannon of world.cannons) {
    const deck = platforms.find(p => Math.abs(p.position.x - cannon.position.x) < 1e-9);
    assert.ok(deck, 'cañón sin plataforma');
    assert.ok(Math.abs((deck.position.y + deck.geometry.parameters.height / 2) - cannon.position.y) < 1e-9,
      'el cañón debe apoyar en la plataforma');
  }
  assert.equal(world.colliders.length, 11);
});

test('buildWorld mantiene seis muros, once colliders y dos luces', () => {
  const { buildWorld } = runtime();
  const scene = new THREE.Scene();
  const world = buildWorld(scene);
  assert.equal(world.walls.length, 6);
  const kinds = Array.from(world.walls, w => w.userData.kind).sort();
  assert.deepEqual(kinds, ['arm', 'arm', 'landward', 'parapet', 'side', 'side']);
  assert.equal(world.colliders.length, 11, 'la física de la muralla no cambia');
  let lights = 0;
  scene.traverse(object => { if (object.isLight) lights++; });
  assert.equal(lights, 2, 'sin luces nuevas');
  const gated = world.walls.find(w => w.userData.kind === 'landward');
  assert.equal(roles(gated, 'gate-leaf').length, 2, 'la puerta debe estar en el muro terrestre');
});

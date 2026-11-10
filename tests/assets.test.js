const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const THREE = require('../vendor/three.min.js');
global.THREE = THREE;
const Assets = require('../js/assets');

test('el registro entrega clones recursivos independientes con geometría y material compartidos', () => {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshBasicMaterial();
  const original = new THREE.Group();
  original.add(new THREE.Mesh(geometry, material));
  Assets.register('test-box', original);

  const a = Assets.clone('test-box');
  const b = Assets.clone('test-box');
  assert.ok(Assets.has('test-box'));
  assert.notStrictEqual(a, original);
  assert.notStrictEqual(a, b);
  assert.notStrictEqual(a.children[0], b.children[0]);
  assert.strictEqual(a.children[0].geometry, geometry);
  assert.strictEqual(a.children[0].geometry, b.children[0].geometry);
  assert.strictEqual(a.children[0].material, material);
  assert.strictEqual(a.children[0].material, b.children[0].material);
  a.position.x = 4;
  a.children[0].rotation.y = 1;
  assert.equal(b.position.x, 0);
  assert.equal(original.position.x, 0);
  assert.equal(b.children[0].rotation.y, 0);
  assert.equal(original.children[0].rotation.y, 0);
  assert.equal(Assets.has('missing'), false);
  assert.strictEqual(Assets.clone('missing'), null);
});

test('register reemplaza entradas y register(name, null) las elimina', () => {
  const original = new THREE.Group();
  const replacement = new THREE.Group();
  replacement.name = 'replacement';
  Assets.register('__proto__', original);
  Assets.register('__proto__', replacement);
  assert.equal(Assets.clone('__proto__').name, 'replacement');
  Assets.register('__proto__', null);
  assert.equal(Assets.has('__proto__'), false);
  assert.strictEqual(Assets.clone('__proto__'), null);
  assert.doesNotThrow(() => Assets.register('never-registered', null));
});

// A self-contained, uncompressed triangle: no fixture files or network required.
function triangleGLB(overrides = {}) {
  const json = Buffer.from(JSON.stringify({
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ name: 'embedded-scene', nodes: [0] }],
    nodes: [{ name: 'triangle', mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
    materials: [{ pbrMetallicRoughness: { baseColorFactor: [0.2, 0.4, 0.6, 1] } }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }],
    buffers: [{ byteLength: 36 }],
    ...overrides,
  }));
  const jsonLength = Math.ceil(json.length / 4) * 4;
  const bytes = Buffer.alloc(12 + 8 + jsonLength + 8 + 36);
  bytes.writeUInt32LE(0x46546c67, 0);
  bytes.writeUInt32LE(2, 4);
  bytes.writeUInt32LE(bytes.length, 8);
  bytes.writeUInt32LE(jsonLength, 12);
  bytes.writeUInt32LE(0x4e4f534a, 16);
  bytes.fill(0x20, 20, 20 + jsonLength);
  json.copy(bytes, 20);
  const bin = 20 + jsonLength;
  bytes.writeUInt32LE(36, bin);
  bytes.writeUInt32LE(0x004e4942, bin + 4);
  [0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((value, i) => bytes.writeFloatLE(value, bin + 8 + i * 4));
  return bytes.toString('base64');
}

function runScript(context, file) {
  return vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
}

function browserRuntime() {
  const warnings = [];
  const requests = [];
  const context = vm.createContext({
    console,
    atob,
    TextDecoder,
    Request,
    fetch(url) {
      requests.push(url);
      throw new Error('Unexpected network request: ' + url);
    },
  });
  vm.runInContext('window = globalThis; self = globalThis;', context);
  runScript(context, 'vendor/three.min.js');
  runScript(context, 'vendor/gltfloader.min.js');
  runScript(context, 'js/assets.js');
  // Capture asset warnings without hiding them or the pre-existing Three UMD warning.
  context.console = {
    ...console,
    warn(...args) { warnings.push(args); console.warn(...args); },
  };
  return { context, warnings, requests };
}

function embed(context, entries) {
  vm.runInContext('window.HUMEN_ASSETS = ' + JSON.stringify(entries) + ';', context);
}

test('load sin assets resuelve void, incluso sin window, THREE ni loader', async () => {
  assert.strictEqual(await Assets.load(), undefined);
  const context = vm.createContext({ console });
  runScript(context, 'js/assets.js');
  for (const declaration of ['window = {};', 'window.HUMEN_ASSETS = null;', 'window.HUMEN_ASSETS = {};']) {
    vm.runInContext(declaration, context);
    assert.strictEqual(await context.Assets.load(), undefined);
  }
});

test('GLTFLoader IIFE usa THREE r160 y parsea un GLB en el mismo realm', async () => {
  const { context, requests } = browserRuntime();
  embed(context, { triangle: triangleGLB() });
  assert.equal(context.THREE.REVISION, '160');
  assert.equal(typeof context.THREE.GLTFLoader, 'function');
  // Construct ArrayBuffer INSIDE this context, not in the host Node realm.
  const gltf = await vm.runInContext(`
    new Promise((resolve, reject) => {
      const binary = atob(window.HUMEN_ASSETS.triangle);
      const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
      new THREE.GLTFLoader().parse(bytes.buffer, '', resolve, reject);
    });
  `, context);
  assert.ok(gltf.scene instanceof context.THREE.Object3D);
  assert.ok(gltf.scene.children.length > 0);
  let meshes = 0;
  gltf.scene.traverse(object => { if (object.isMesh) meshes++; });
  assert.ok(meshes > 0);
  assert.deepEqual(requests, []);
});

test('load decodifica base64, registra la escena y permite clonar sin red', async () => {
  const { context, warnings, requests } = browserRuntime();
  embed(context, { triangle: triangleGLB() });
  assert.strictEqual(await context.Assets.load(), undefined);
  assert.ok(context.Assets.has('triangle'));
  const a = context.Assets.clone('triangle');
  const b = context.Assets.clone('triangle');
  assert.equal(a.name, 'embedded-scene');
  assert.ok(a instanceof context.THREE.Object3D);
  assert.equal(a.children[0].geometry.attributes.position.count, 3);
  assert.ok(a.children[0].material instanceof context.THREE.MeshStandardMaterial);
  assert.notStrictEqual(a.children[0], b.children[0]);
  assert.strictEqual(a.children[0].geometry, b.children[0].geometry);
  assert.strictEqual(a.children[0].material, b.children[0].material);
  assert.deepEqual(warnings, []);
  assert.deepEqual(requests, []);
});

test('load avisa por cada error de base64, parse síncrono y asíncrono sin bloquear otros assets', async () => {
  const { context, warnings, requests } = browserRuntime();
  embed(context, {
    'bad-base64': '%%%invalid%%%',
    'bad-json': Buffer.from('not a GLB').toString('base64'),
    'bad-accessor': triangleGLB({ meshes: [{ primitives: [{ attributes: { POSITION: 99 } }] }] }),
    valid: triangleGLB(),
  });
  assert.strictEqual(await context.Assets.load(), undefined);
  assert.ok(context.Assets.has('valid'));
  for (const name of ['bad-base64', 'bad-json', 'bad-accessor']) {
    assert.equal(context.Assets.has(name), false);
    assert.ok(warnings.some(args => String(args[0]).includes(name)), 'warning identifies ' + name);
  }
  assert.equal(warnings.length, 3);
  assert.deepEqual(requests, []);
});

test('load sin GLTFLoader avisa por asset y resuelve sin rechazar', async () => {
  const { context, warnings } = browserRuntime();
  delete context.THREE.GLTFLoader;
  embed(context, { unavailable: triangleGLB() });
  assert.strictEqual(await context.Assets.load(), undefined);
  assert.equal(context.Assets.has('unavailable'), false);
  assert.equal(warnings.length, 1);
});

test('load rechaza dependencias externas antes de hacer fetch y continúa', async () => {
  const { context, warnings, requests } = browserRuntime();
  embed(context, {
    external: triangleGLB({ buffers: [{ byteLength: 36, uri: 'https://example.invalid/mesh.bin' }] }),
    valid: triangleGLB(),
  });
  assert.strictEqual(await context.Assets.load(), undefined);
  assert.equal(context.Assets.has('external'), false);
  assert.ok(context.Assets.has('valid'));
  assert.equal(warnings.length, 1);
  assert.deepEqual(requests, []);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const THREE = require('../vendor/three.min.js');
global.THREE = THREE;
global.Rig = require('../js/rig/humanoid');
global.RigAnim = require('../js/rig/anim');
global.Models = require('../js/models');
const Scenes = require('../js/story/scenes');
global.Scenes = Scenes;
const Cinematics = require('../js/story/cinematics');

const ROOT = path.join(__dirname, '..');
const CINE_DIR = path.join(ROOT, 'assets', 'models', 'cinematics');

function parseGlbJson(filePath) {
  const buf = fs.readFileSync(filePath);
  assert.ok(buf.length > 10 * 1024, `${path.basename(filePath)} must be > 10 KB`);
  assert.strictEqual(buf.toString('utf8', 0, 4), 'glTF', 'valid glTF magic header');
  assert.strictEqual(buf.readUInt32LE(4), 2, 'glTF version 2');
  const jsonLen = buf.readUInt32LE(12);
  const chunkType = buf.toString('utf8', 16, 20);
  assert.strictEqual(chunkType, 'JSON', 'first GLB chunk must be JSON');
  return JSON.parse(buf.toString('utf8', 20, 20 + jsonLen));
}

test('Blender 3D cinematic GLBs exist, are valid glTF 2.0, and expose required named landmarks and PBR materials', () => {
  const specs = [
    {
      file: 'humen-1839-opium.glb',
      requiredNodes: ['Pavilion', 'LinZexu', 'OpiumPit', 'SluiceGate', 'LimeWater', 'OpiumChests', 'OpiumBalls', 'Paddles'],
    },
    {
      file: 'humen-squadron-bogue.glb',
      requiredNodes: ['Nemesis', 'Wheel_L', 'Wheel_R', 'Funnel', 'WarJunk', 'IronChainBoom', 'AnunghoyBattery'],
    },
    {
      file: 'humen-assault-breach.glb',
      requiredNodes: ['BreachedBastion', 'Gate_L', 'Gate_R', 'SiegeLadders', 'GuanTianpei', 'Saber', 'ImperialSeal', 'AdmiralCannon'],
    },
    {
      file: 'humen-fall-memorial.glb',
      requiredNodes: ['HumenBell', 'BellFrame', 'BellBody', 'CapturedArtillery', 'FallenStandard', 'UnionFlagPole', 'FlagCloth'],
    },
  ];

  for (const spec of specs) {
    const fullPath = path.join(CINE_DIR, spec.file);
    assert.ok(fs.existsSync(fullPath), `${spec.file} exists`);
    assert.strictEqual(Scenes.MODEL_URLS && Object.values(Scenes.MODEL_URLS).includes(`assets/models/cinematics/${spec.file}`), true);
    const gltf = parseGlbJson(fullPath);
    assert.ok(Array.isArray(gltf.materials) && gltf.materials.length >= 6, `${spec.file} has PBR materials`);
    for (const mat of gltf.materials) {
      assert.ok(mat.pbrMetallicRoughness, `${spec.file} material ${mat.name} uses PBR`);
    }
    const nodeNames = new Set((gltf.nodes || []).map((n) => n.name));
    for (const req of spec.requiredNodes) {
      assert.ok(nodeNames.has(req), `${spec.file} includes named node ${req}`);
    }
  }
});

function makeMockGlbWithNodes(names) {
  const root = new THREE.Group();
  let sharedDisposeCalls = 0;
  for (const name of names) {
    const geom = new THREE.BoxGeometry(1, 1, 1);
    const origDispose = geom.dispose.bind(geom);
    geom.dispose = () => {
      sharedDisposeCalls++;
      return origDispose();
    };
    const mat = new THREE.MeshStandardMaterial({ color: 0xaa8844 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.name = name;
    root.add(mesh);
  }
  root.getSharedDisposeCalls = () => sharedDisposeCalls;
  return root;
}

test('Scenes builders construct 3D sets, animate Blender nodes cleanly, and preserve sharedAsset geometries on dispose', () => {
  const effectsSpy = {
    smokes: 0,
    explosions: 0,
    muzzleFlashes: 0,
    smoke() { this.smokes++; },
    explosion() { this.explosions++; },
    muzzleFlash() { this.muzzleFlashes++; },
  };
  const ctx = { effects: effectsSpy };

  // 1. Fallback path (no GLB registered yet) runs safely and disposes.
  for (const fn of ['opiumDestruction', 'squadronApproach', 'rearAssault', 'theFall']) {
    const st = Scenes[fn](ctx);
    assert.ok(st && st.group && st.group.isObject3D, `${fn} fallback returns THREE group`);
    st.update(1.5, 0.05);
    st.update(3.2, 0.05);
    st.dispose();
  }
  assert.ok(effectsSpy.smokes > 0, 'smoke effects triggered');
  assert.ok(effectsSpy.explosions > 0, 'explosion effects triggered');
  assert.ok(effectsSpy.muzzleFlashes > 0, 'muzzleFlash effects triggered');

  // 2. Mounted Blender GLB path animates named nodes and protects sharedAsset geometries from dispose().
  const opiumMock = makeMockGlbWithNodes(['Pavilion', 'LinZexu', 'OpiumPit', 'SluiceGate', 'LimeWater', 'OpiumChests', 'OpiumBalls', 'Paddles']);
  const squadronMock = makeMockGlbWithNodes(['Nemesis', 'Wheel_L', 'Wheel_R', 'WarJunk', 'IronChainBoom']);
  const assaultMock = makeMockGlbWithNodes(['BreachedBastion', 'Gate_L', 'Gate_R', 'GuanTianpei', 'Saber', 'ImperialSeal']);
  const fallMock = makeMockGlbWithNodes(['HumenBell', 'BellBody', 'CapturedArtillery', 'FallenStandard', 'FlagCloth']);

  Scenes.registerModel('opium', opiumMock);
  Scenes.registerModel('squadron', squadronMock);
  Scenes.registerModel('assault', assaultMock);
  Scenes.registerModel('fall', fallMock);

  assert.strictEqual(Scenes.hasModel('opium'), true);

  const s1 = Scenes.opiumDestruction(ctx);
  assert.strictEqual(s1.blenderSet.mounted, true);
  s1.update(3.5, 0.05);
  assert.notStrictEqual(s1.blenderSet.nodes.OpiumBalls.scale.y, 1, 'opium balls shrink into lime pool');
  assert.ok(s1.blenderSet.nodes.SluiceGate.position.y > 0, 'sluice gate lifts');
  s1.dispose();
  assert.strictEqual(opiumMock.getSharedDisposeCalls(), 0, 'sharedAsset geometry must not be disposed');

  const s2 = Scenes.squadronApproach(ctx);
  assert.strictEqual(s2.blenderSet.mounted, true);
  s2.update(2.0, 0.1);
  assert.ok(s2.blenderSet.nodes.Wheel_L.rotation.x < 0, 'paddle wheel rotates');
  assert.ok(s2.blenderSet.nodes.Nemesis.position.z > 0, 'Nemesis steams forward');
  s2.dispose();
  assert.strictEqual(squadronMock.getSharedDisposeCalls(), 0);

  const s3 = Scenes.rearAssault(ctx);
  assert.strictEqual(s3.blenderSet.mounted, true);
  s3.update(2.0, 0.05);
  assert.notStrictEqual(s3.blenderSet.nodes.Saber.rotation.x, 0, 'Guan Tianpei saber animates');
  s3.dispose();
  assert.strictEqual(assaultMock.getSharedDisposeCalls(), 0);

  const s4 = Scenes.theFall(ctx);
  assert.strictEqual(s4.blenderSet.mounted, true);
  s4.update(1.0, 0.05);
  assert.notStrictEqual(s4.blenderSet.nodes.BellBody.rotation.z, 0, 'Humen bell tolls subtly');
  assert.notStrictEqual(s4.blenderSet.nodes.FlagCloth.rotation.y, 0, 'flag cloth waves');
  s4.dispose();
  assert.strictEqual(fallMock.getSharedDisposeCalls(), 0);
});

test('Cinematics sequences step through all shots, interpolate camera FOV/pos, fire onShot, and restore camera FOV on finish/stop', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 1000);

  for (const id of ['humen-1839', 'humen-squadron', 'humen-assault', 'humen-fall']) {
    const seq = Cinematics.SEQUENCES[id];
    assert.ok(seq && seq.shots.length >= 2, `${id} defines shots`);

    let ended = false;
    const shotsFired = [];
    const ok = Cinematics.start(id, {
      scene,
      camera,
      waitForInput: true,
      continueText: 'Continuar',
      onShot: (shot, idx) => shotsFired.push(idx),
      onEnd: () => { ended = true; },
    });
    assert.strictEqual(ok, true);
    assert.strictEqual(Cinematics.isActive(), true);
    assert.notStrictEqual(camera.fov, 75, `${id} applies cinematic FOV`);

    for (let s = 0; s < seq.shots.length; s++) {
      const dur = seq.shots[s].duration;
      Cinematics.update(dur * 0.5);
      Cinematics.update(dur * 0.6);
    }
    assert.strictEqual(shotsFired.length, seq.shots.length, `${id} fires onShot for every shot`);
    assert.strictEqual(Cinematics.confirm(), true, `${id} confirms at end`);
    assert.strictEqual(ended, true, `${id} triggers onEnd`);
    assert.strictEqual(Cinematics.isActive(), false);
    assert.strictEqual(camera.fov, 75, `${id} restores gameplay FOV after finish`);
  }

  // Verify early stop() also restores camera FOV cleanly.
  Cinematics.start('humen-assault', { scene, camera, waitForInput: true });
  Cinematics.update(0.5);
  assert.notStrictEqual(camera.fov, 75);
  Cinematics.stop();
  assert.strictEqual(Cinematics.isActive(), false);
  assert.strictEqual(camera.fov, 75, 'stop() restores gameplay FOV');
});

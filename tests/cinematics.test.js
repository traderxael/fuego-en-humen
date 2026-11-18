const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const THREE = require('../vendor/three.min.js');
global.THREE = THREE;
global.Rig = require('../js/rig/humanoid');
global.RigAnim = require('../js/rig/anim');
const Models = require('../js/models');
global.Models = Models;
const Scenes = require('../js/story/scenes');
global.Scenes = Scenes;
const Cinematics = require('../js/story/cinematics');
const { Voice } = require('../js/voice');

const ROOT = path.join(__dirname, '..');
const CINE_DIR = path.join(ROOT, 'assets', 'models', 'cinematics');
const MODELS_DIR = path.join(ROOT, 'assets', 'models');
const PROPS_DIR = path.join(MODELS_DIR, 'props');

function parseGlbJson(filePath, minBytes = 10 * 1024) {
  const buf = fs.readFileSync(filePath);
  assert.ok(buf.length > minBytes, `${path.basename(filePath)} must be > ${minBytes} bytes`);
  assert.strictEqual(buf.toString('utf8', 0, 4), 'glTF', 'valid glTF magic header');
  assert.strictEqual(buf.readUInt32LE(4), 2, 'glTF version 2');
  const jsonLen = buf.readUInt32LE(12);
  const chunkType = buf.toString('utf8', 16, 20);
  assert.strictEqual(chunkType, 'JSON', 'first GLB chunk must be JSON');
  return JSON.parse(buf.toString('utf8', 20, 20 + jsonLen));
}

test('Blender 3D cinematic GLBs and GitHub rigged/prop GLBs exist, are valid glTF 2.0, and embed PBR textures and landmarks', () => {
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
    assert.ok(Array.isArray(gltf.images) && gltf.images.length >= 1, `${spec.file} embeds PBR images`);
    assert.ok(Array.isArray(gltf.textures) && gltf.textures.length >= 1, `${spec.file} embeds glTF textures`);
    for (const mat of gltf.materials) {
      assert.ok(mat.pbrMetallicRoughness, `${spec.file} material ${mat.name} uses PBR`);
    }
    const nodeNames = new Set((gltf.nodes || []).map((n) => n.name));
    for (const req of spec.requiredNodes) {
      assert.ok(nodeNames.has(req), `${spec.file} includes named node ${req}`);
    }
  }

  for (const prop of ['arch.glb', 'column.glb', 'torch.glb', 'katana.glb']) {
    const p = path.join(PROPS_DIR, prop);
    assert.ok(fs.existsSync(p), `prop ${prop} exists`);
    parseGlbJson(p, 5 * 1024);
  }

  for (const charGlb of ['qing-soldier-rigged.glb', 'guan-tianpei-rigged.glb']) {
    const p = path.join(MODELS_DIR, charGlb);
    assert.ok(fs.existsSync(p), `rigged character ${charGlb} exists`);
    const gltf = parseGlbJson(p, 100 * 1024);
    assert.ok(Array.isArray(gltf.animations) && gltf.animations.length >= 2, `${charGlb} includes animation clips`);
  }

  assert.strictEqual(typeof Models.loadQingSoldierModels, 'function');
  assert.strictEqual(typeof Models.hasQingModel, 'function');
  assert.strictEqual(typeof Models.hasCommanderModel, 'function');
  const cmdFallback = Models.makeQingCommander();
  assert.strictEqual(cmdFallback.userData.type, 'qing-commander');
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

  // 1. Fallback path runs safely and disposes.
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
  const squadronMock = makeMockGlbWithNodes(['Nemesis', 'Wheel_L', 'Wheel_R', 'WakeFoam', 'WarJunk', 'BurningJunk', 'IronChainBoom']);
  const assaultMock = makeMockGlbWithNodes(['BreachedBastion', 'Gate_L', 'Gate_R', 'GuanTianpei', 'Saber', 'ImperialSeal']);
  const fallMock = makeMockGlbWithNodes(['HumenBell', 'BellBody', 'CapturedArtillery', 'FallenStandard', 'FlagCloth']);

  Scenes.registerModel('opium', opiumMock);
  Scenes.registerModel('squadron', squadronMock);
  Scenes.registerModel('assault', assaultMock);
  Scenes.registerModel('fall', fallMock);

  assert.strictEqual(Scenes.hasModel('opium'), true);

  const s1 = Scenes.opiumDestruction(ctx);
  assert.strictEqual(s1.blenderSet.mounted, true);
  s1.update(6.5, 0.05);
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

test('Cinematics keeps 3D stage alive across all shots, applies & restores sky/fog atmosphere and FOV, and supports skip/advance', () => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fc7e8);
  scene.fog = new THREE.Fog(0x9fc7e8, 60, 220);
  const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 1000);

  const seqStageNames = {
    'humen-1839': 'scene-opium-1839',
    'humen-squadron': 'scene-squadron',
    'humen-assault': 'scene-assault',
    'humen-fall': 'scene-fall',
  };

  for (const id of Object.keys(seqStageNames)) {
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
    assert.strictEqual(scene.background.getHex(), seq.atmosphere.bg, `${id} applies sky color`);
    assert.strictEqual(scene.fog.color.getHex(), seq.atmosphere.fogColor, `${id} applies fog color`);

    for (let s = 0; s < seq.shots.length; s++) {
      // Stage group MUST remain mounted in scene on Shot 0, Shot 1, Shot 2, Shot 3!
      assert.ok(
        scene.children.some((c) => c.name === seqStageNames[id]),
        `${id} keeps stage mounted during shot ${s}`
      );
      const dur = seq.shots[s].duration;
      Cinematics.update(dur * 0.5);
      Cinematics.update(dur * 0.6);
    }

    assert.strictEqual(shotsFired.length, seq.shots.length, `${id} fires onShot for every shot`);
    assert.strictEqual(Cinematics.confirm(), true, `${id} confirms at end`);
    assert.strictEqual(ended, true, `${id} triggers onEnd`);
    assert.strictEqual(Cinematics.isActive(), false);
    assert.strictEqual(camera.fov, 75, `${id} restores gameplay FOV after finish`);
    assert.strictEqual(scene.background.getHex(), 0x9fc7e8, `${id} restores gameplay sky after finish`);
    assert.strictEqual(scene.fog.color.getHex(), 0x9fc7e8, `${id} restores gameplay fog after finish`);
  }

  // Verify advanceOrConfirm respects early click guard (< 0.35s) and advances shot (> 0.35s), and skip() restores everything.
  let skippedEnded = false;
  Cinematics.start('humen-assault', {
    scene,
    camera,
    waitForInput: true,
    onEnd: () => { skippedEnded = true; },
  });
  Cinematics.update(0.1);
  assert.strictEqual(Cinematics.advanceOrConfirm(), false, 'blocks accidental advance immediately after start');
  Cinematics.update(0.5);
  assert.strictEqual(Cinematics.advanceOrConfirm(), true, 'advances shot on deliberate input');
  assert.ok(scene.children.some((c) => c.name === 'scene-assault'), 'stage remains present after advance');
  assert.strictEqual(Cinematics.skip(), true, 'skip() finishes cinematic');
  assert.strictEqual(skippedEnded, true);
  assert.strictEqual(Cinematics.isActive(), false);
  assert.strictEqual(camera.fov, 75);
  assert.strictEqual(scene.background.getHex(), 0x9fc7e8);
});

test('Neural Spanish MP3 narration clips exist for briefing, cinematics, waves, beats and endings', () => {
  assert.ok(Voice && Voice.AUDIO_CLIPS, 'Voice.AUDIO_CLIPS exported');
  const keys = Object.keys(Voice.AUDIO_CLIPS);
  assert.ok(keys.length >= 30, 'all 30+ story narration keys registered');

  for (const key of keys) {
    const relPath = Voice.AUDIO_CLIPS[key];
    const absPath = path.join(ROOT, relPath);
    assert.ok(fs.existsSync(absPath), `${relPath} exists`);
    const stat = fs.statSync(absPath);
    assert.ok(stat.size > 5 * 1024, `${relPath} is non-empty MP3 (> 5 KB)`);
  }

  for (const seqId of ['humen-1839', 'humen-squadron', 'humen-assault', 'humen-fall']) {
    const seq = Cinematics.SEQUENCES[seqId];
    for (let i = 0; i < seq.shots.length; i++) {
      const shot = seq.shots[i];
      assert.ok(shot.voiceKey && Voice.AUDIO_CLIPS[shot.voiceKey], `${seqId} shot ${i} links valid voiceKey`);
      assert.strictEqual(typeof shot.narration, 'string', `${seqId} shot ${i} defines narration script`);
      assert.ok(shot.narration.length > 20, `${seqId} shot ${i} narration is substantive`);
      assert.ok(shot.duration >= 9, `${seqId} shot ${i} duration covers spoken track`);
    }
  }
});

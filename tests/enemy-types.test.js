const test = require('node:test');
const assert = require('node:assert');

const THREE = require('../vendor/three.min.js');
global.THREE = THREE;
global.PhysicsLogic = require('../js/logic/physics');

const Enemies = require('../js/enemies');
const Models = require('../js/models');
const { WAVES } = require('../js/logic/config');

function fakePhysics() {
  const calls = { shots: [], ragdolled: [], removed: [] };
  const physics = {
    addEnemyBody(pivot) {
      return {
        pivot,
        alive: true,
        static: false,
        kind: 'soldier',
        body: {
          position: { x: pivot.position.x, y: 0.9, z: pivot.position.z },
          velocity: { x: 0, y: 0, z: 0 },
          quaternion: { setFromEuler() {} },
        },
      };
    },
    ragdoll(entry, dx, dz) { calls.ragdolled.push({ entry, dx, dz }); entry.alive = false; },
    removeBody(body) { calls.removed.push(body); },
    lineOfSight() { return true; },
    fireMusket(opts) { calls.shots.push(opts); },
    fireCannon(opts) { calls.shots.push(opts); },
    spawnDebris() {},
  };
  return { physics, calls };
}

function makePlayer(enemies, x, z) {
  return {
    enemies,
    state: { fortIntegrity: 100 },
    physics: { playerBody: { position: { x, y: 0.9, z } } },
  };
}

const world = { fort: { position: { z: 20 } } };

test('Models builds runner and officer visuals with their type tag', () => {
  const runner = Models.makeBritishRunner();
  const officer = Models.makeBritishOfficer();
  assert.ok(runner.isObject3D);
  assert.ok(officer.isObject3D);
  assert.strictEqual(runner.userData.type, 'british-runner');
  assert.strictEqual(officer.userData.type, 'british-officer');
});

test('spawnWave cycles the mix across trickle spawns', () => {
  const { physics } = fakePhysics();
  Enemies.bindPhysics(physics);
  const scene = new THREE.Scene();
  const enemies = [];
  const waveDef = { count: 5, interval: 0.1, hp: 50, damage: 10, mix: ['soldier', 'runner', 'officer'] };
  Enemies.spawnWave(scene, waveDef, enemies, 4);
  const player = makePlayer(enemies, 0, 60);
  for (let i = 0; i < 80 && Enemies.pendingSpawns() > 0; i++) {
    Enemies.updateEnemies(0.05, player, world, {});
  }
  assert.strictEqual(Enemies.pendingSpawns(), 0);
  const spawned = enemies.filter((e) => e.userData.kind === 'soldier');
  assert.deepStrictEqual(
    spawned.map((e) => e.userData.enemyType),
    ['soldier', 'runner', 'officer', 'soldier', 'runner']
  );
});

test('waves without a mix still spawn plain soldiers with score 100', () => {
  const { physics } = fakePhysics();
  Enemies.bindPhysics(physics);
  const scene = new THREE.Scene();
  const enemies = [];
  Enemies.spawnWave(scene, { count: 1, interval: 1, hp: 45, damage: 10 }, enemies, 1);
  assert.strictEqual(enemies[0].userData.enemyType, 'soldier');
  assert.strictEqual(enemies[0].userData.score, 100);
  assert.strictEqual(enemies[0].userData.hp, 45);
});

test('runner resolves fragile stats and never fires a musket', () => {
  const { physics, calls } = fakePhysics();
  Enemies.bindPhysics(physics);
  const scene = new THREE.Scene();
  const enemies = [];
  Enemies.spawnWave(scene, { count: 1, interval: 1, hp: 80, damage: 18, mix: ['runner'] }, enemies, 5);
  const runner = enemies[0];
  assert.strictEqual(runner.userData.hp, 40);
  assert.strictEqual(runner.userData.score, 150);
  assert.strictEqual(runner.userData.canShoot, false);

  runner.userData.body.position.x = 0;
  runner.userData.body.position.z = 0;
  runner.position.set(0, 0.9, 0);
  runner.userData.cooldown = 0;
  runner.userData.offsetX = 0;

  const player = makePlayer(enemies, 0, 20);
  for (let i = 0; i < 10; i++) {
    Enemies.updateEnemies(0.016, player, world, {});
    assert.notStrictEqual(runner.userData.aiState, 'shoot');
  }
  assert.strictEqual(calls.shots.length, 0);
  assert.ok(runner.userData.body.velocity.z > 0, 'runner keeps advancing toward the fort');
});

test('officer resolves tough stats and a higher score', () => {
  const { physics } = fakePhysics();
  Enemies.bindPhysics(physics);
  const scene = new THREE.Scene();
  const enemies = [];
  Enemies.spawnWave(scene, { count: 1, interval: 1, hp: 70, damage: 16, mix: ['officer'] }, enemies, 4);
  const officer = enemies[0];
  assert.strictEqual(officer.userData.hp, 154);
  assert.strictEqual(officer.userData.score, 250);
  assert.strictEqual(officer.userData.canShoot, true);
});

test('runner death still ragdolls through the soldier physics path', () => {
  const { physics, calls } = fakePhysics();
  Enemies.bindPhysics(physics);
  const scene = new THREE.Scene();
  const enemies = [];
  Enemies.spawnWave(scene, { count: 1, interval: 1, hp: 40, damage: 10, mix: ['runner'], artillery: 0 }, enemies, 5);
  const runner = enemies[0];
  Enemies.applyHit(runner, 999, { x: 0, z: 1 }, null, 'musket');
  const player = makePlayer(enemies, 0, 60);
  Enemies.updateEnemies(0.016, player, world, { onEnemyKilled() {} });
  assert.strictEqual(enemies.length, 0);
  assert.strictEqual(calls.ragdolled.length, 1);
});

test('explicit artillery override spawns that many guns', () => {
  const { physics } = fakePhysics();
  Enemies.bindPhysics(physics);
  const scene = new THREE.Scene();
  const enemies = [];
  Enemies.spawnWave(scene, { count: 1, interval: 1, hp: 50, damage: 10, artillery: 2 }, enemies, 5);
  const guns = enemies.filter((e) => e.userData.kind === 'artillery');
  assert.strictEqual(guns.length, 2);
});

test('los sepoys del 37.º usan su propio modelo y las oleadas 4-5 los mezclan', () => {
  const { physics } = fakePhysics();
  Enemies.bindPhysics(physics);
  const scene = new THREE.Scene();
  const enemies = [];
  Enemies.spawnWave(scene, { count: 1, interval: 1, hp: 70, damage: 16, mix: ['sepoy'] }, enemies, 4);
  assert.equal(enemies[0].userData.type, 'british-soldier', 'el pivote comparte física');
  assert.equal(enemies[0].userData.enemyType, 'sepoy');
  assert.equal(enemies[0].userData.visual.userData.type, 'sepoy', 'uniforme del 37.º');
  assert.ok(WAVES[3].mix.includes('sepoy'));
  assert.ok(WAVES[4].mix.includes('sepoy'));
});

test('la oleada con rockets monta la batería Congreve en vez del primer cañón', () => {
  const { physics } = fakePhysics();
  Enemies.bindPhysics(physics);
  const scene = new THREE.Scene();
  const enemies = [];
  Enemies.spawnWave(scene, { count: 1, interval: 1, hp: 80, damage: 18, artillery: 2, rockets: 1 }, enemies, 5);
  const guns = enemies.filter((e) => e.userData.kind === 'artillery');
  assert.equal(guns.length, 2);
  const rocket = guns.find((gun) => gun.userData.rocket);
  assert.ok(rocket, 'una pieza debe ser de cohetes');
  assert.equal(rocket.userData.type, 'enemy-rockets');
  assert.equal(rocket.userData.damage, 6);
});

test('WAVES 4 and 5 carry mixes and artillery pressure', () => {
  assert.ok(Array.isArray(WAVES[3].mix) && WAVES[3].mix.includes('runner'));
  assert.ok(Array.isArray(WAVES[4].mix) && WAVES[4].mix.includes('officer'));
  assert.strictEqual(WAVES[4].artillery, 2);
});
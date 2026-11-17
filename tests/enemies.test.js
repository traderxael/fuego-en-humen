const test = require('node:test');
const assert = require('node:assert');

const THREE = require('../vendor/three.min.js');
global.THREE = THREE;
global.PhysicsLogic = require('../js/logic/physics');

const Enemies = require('../js/enemies');

function fakePhysics() {
  const calls = { shots: [], ragdolled: [], removed: [] };
  const physics = {
    addEnemyBody(pivot) {
      const entry = {
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
      return entry;
    },
    ragdoll(entry, dx, dz) {
      calls.ragdolled.push({ entry, dx, dz });
      entry.alive = false;
    },
    removeBody(body) { calls.removed.push(body); },
    lineOfSight() { return true; },
    fireMusket(opts) { calls.shots.push(opts); },
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

test('enemy AI fires a real musket projectile when it can see the player', () => {
  const { physics, calls } = fakePhysics();
  Enemies.bindPhysics(physics);
  const scene = new THREE.Scene();
  const enemies = [];
  Enemies.spawnWave(scene, { count: 1, interval: 1, hp: 45, damage: 10 }, enemies, 1);
  assert.strictEqual(enemies.length, 1);

  const enemy = enemies[0];
  enemy.userData.body.position.x = 0;
  enemy.userData.body.position.z = 0;
  enemy.position.set(0, 0.9, 0);
  enemy.userData.cooldown = 0;
  enemy.userData.offsetX = 0;

  const player = makePlayer(enemies, 0, 20);
  Enemies.updateEnemies(0.016, player, { fort: { position: { z: 20 } } }, {});
  assert.strictEqual(calls.shots.length, 1);
  assert.strictEqual(calls.shots[0].owner, 'enemy');
  assert.strictEqual(calls.shots[0].damage, 10);
  assert.ok(calls.shots[0].from.y > 1 && calls.shots[0].from.y < 1.5);
});

test('applyHit damages, staggers and knocks back; death ragdolls and later removes the corpse', () => {
  const { physics, calls } = fakePhysics();
  Enemies.bindPhysics(physics);
  const scene = new THREE.Scene();
  const enemies = [];
  Enemies.spawnWave(scene, { count: 1, interval: 1, hp: 45, damage: 10 }, enemies, 1);
  const enemy = enemies[0];
  enemy.userData.body.position.x = 0;
  enemy.userData.body.position.z = 0;
  enemy.position.set(0, 0.9, 0);

  assert.strictEqual(Enemies.applyHit(enemy, 20, { x: 1, z: 0 }, null, 'musket'), true);
  assert.strictEqual(enemy.userData.hp, 25);
  assert.ok(enemy.userData.stagger > 0);
  assert.ok(enemy.userData.body.velocity.x > 0, 'musket hit must add knockback');

  Enemies.applyHit(enemy, 30, { x: 1, z: 0 }, null, 'sable');
  assert.strictEqual(enemy.userData.hp, -5);

  const killed = [];
  const player = makePlayer(enemies, 0, 20);
  Enemies.updateEnemies(0.016, player, { fort: { position: { z: 20 } } }, {
    onEnemyKilled(e) { killed.push(e); },
  });
  assert.strictEqual(enemies.length, 0);
  assert.strictEqual(killed.length, 1);
  assert.strictEqual(calls.ragdolled.length, 1);
  assert.ok(scene.children.length > 0, 'corpse pivot still in the scene');

  Enemies.updateCorpses(Enemies.CORPSE_SECONDS + 1);
  assert.strictEqual(calls.removed.length, 1);
  assert.strictEqual(scene.children.length, 0, 'corpse removed after its timer');
});

test('dead enemies are ignored by applyHit and a cleared wave has no pending spawns', () => {
  const { physics } = fakePhysics();
  Enemies.bindPhysics(physics);
  const scene = new THREE.Scene();
  const enemies = [];
  Enemies.spawnWave(scene, { count: 2, interval: 0.5, hp: 10, damage: 5 }, enemies, 1);
  assert.strictEqual(Enemies.pendingSpawns(), 1);

  const enemy = enemies[0];
  Enemies.applyHit(enemy, 20, { x: 0, z: 1 }, null, 'musket');
  assert.strictEqual(Enemies.applyHit(enemy, 20, { x: 0, z: 1 }, null, 'musket'), false);

  const player = makePlayer(enemies, 0, 20);
  Enemies.updateEnemies(0.016, player, { fort: { position: { z: 20 } } }, {
    onEnemyKilled() {},
  });
  // The second soldier trickles in at 0.5 s intervals.
  for (let i = 0; i < 40; i++) {
    Enemies.updateEnemies(0.016, player, { fort: { position: { z: 20 } } }, { onEnemyKilled() {} });
  }
  assert.strictEqual(Enemies.pendingSpawns(), 0);
  assert.strictEqual(enemies.length, 1);
});

test('applyHit recuerda el tipo de atacante para que las bajas aliadas no sumen', () => {
  const { physics } = fakePhysics();
  Enemies.bindPhysics(physics);
  const scene = new THREE.Scene();
  const enemies = [];
  Enemies.spawnWave(scene, { count: 1, interval: 1, hp: 200, damage: 10 }, enemies, 1);
  const enemy = enemies[0];
  assert.strictEqual(Enemies.applyHit(enemy, 20, { x: 0, z: 1 }, null, 'ally'), true);
  assert.strictEqual(enemy.userData.lastHitKind, 'ally');
  Enemies.applyHit(enemy, 20, { x: 0, z: 1 }, null, 'musket');
  assert.strictEqual(enemy.userData.lastHitKind, 'musket');
});

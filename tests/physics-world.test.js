const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Real vendor libs in Node: Three.js is CommonJS-friendly, cannon-es is
// evaluated as the same IIFE the browser loads.
const THREE = require('../vendor/three.min.js');
const cannonSandbox = { console, performance };
vm.createContext(cannonSandbox);
vm.runInContext(
  fs.readFileSync(path.join(__dirname, '..', 'vendor', 'cannon-es.min.js'), 'utf8'),
  cannonSandbox
);
global.THREE = THREE;
global.CANNON = cannonSandbox.CANNON;
global.PhysicsLogic = require('../js/logic/physics');

const GamePhysics = require('../js/physics');

function setup(colliders, effects = null) {
  const scene = new THREE.Scene();
  const world = {
    colliders: colliders || [],
    fort: { position: { x: 0, y: 0, z: 20 } },
  };
  const physics = GamePhysics.create(scene, world, effects);
  return { scene, world, physics };
}

function makeEnemy(physics, x, z) {
  const pivot = new THREE.Group();
  pivot.position.set(x, 0.9, z);
  pivot.userData = { hp: 50 };
  const entry = physics.addEnemyBody(pivot, 'soldier');
  return { pivot, entry };
}

function run(physics, seconds, ctx) {
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) physics.step(dt, ctx || {});
}

function recorder() {
  const calls = { enemy: [], player: [], world: [], fort: [] };
  return {
    calls,
    ctx: {
      onEnemyHit(enemy, damage, point, dir, kind) {
        calls.enemy.push({ enemy, damage, point, dir, kind });
      },
      onPlayerHit(damage, point, kind) {
        calls.player.push({ damage, point, kind });
      },
      onWorldImpact(point, normal, kind) {
        calls.world.push({ point, normal, kind });
      },
      onFortImpact(damage, point) {
        calls.fort.push({ damage, point });
      },
    },
  };
}

test('a musket ball physically reaches an enemy', () => {
  const { physics } = setup();
  const { pivot } = makeEnemy(physics, 0, 0);
  const rec = recorder();
  physics.fireMusket({
    from: { x: 0, y: 1.4, z: 10 },
    dir: { x: 0, y: 0, z: -1 },
    damage: 50,
    owner: 'player',
  });
  run(physics, 0.4, rec.ctx);
  assert.strictEqual(rec.calls.enemy.length, 1, 'expected one enemy hit');
  assert.strictEqual(rec.calls.enemy[0].enemy, pivot);
  assert.strictEqual(rec.calls.enemy[0].damage, 50);
  assert.strictEqual(rec.calls.enemy[0].kind, 'musket');
  assert.strictEqual(physics.getStats().projectiles, 0);
});

test('a wall stops the projectile before the enemy behind it', () => {
  const { physics } = setup([
    { x: 0, z: 5, angle: 0, length: 12, thickness: 1, height: 4 },
  ]);
  makeEnemy(physics, 0, 0);
  const rec = recorder();
  physics.fireMusket({
    from: { x: 0, y: 1.4, z: 10 },
    dir: { x: 0, y: 0, z: -1 },
    damage: 50,
    owner: 'player',
  });
  run(physics, 0.4, rec.ctx);
  assert.strictEqual(rec.calls.enemy.length, 0, 'must not shoot through the wall');
  assert.strictEqual(rec.calls.world.length, 1);
  assert.ok(Math.abs(rec.calls.world[0].point.z - 5.5) < 0.1);
});

test('a slow cannonball lands on its ballistic target', () => {
  const { physics } = setup();
  const rec = recorder();
  const target = { x: 8, y: 0, z: 15 };
  physics.fireCannon({
    from: { x: 0, y: 0.9, z: -40 },
    target,
    owner: 'player',
  });
  run(physics, 4, rec.ctx);
  assert.strictEqual(rec.calls.world.length, 1, 'cannonball must land');
  const p = rec.calls.world[0].point;
  assert.ok(Math.hypot(p.x - target.x, p.z - target.z) < 2, 'landed at ' + p.x + ',' + p.z);
});

test('the player box is stopped by a wall and stays grounded', () => {
  const { physics } = setup([
    { x: -4, z: 24, angle: Math.PI / 2, length: 12, thickness: 1, height: 4 },
  ]);
  run(physics, 0.3, {});
  for (let i = 0; i < 180; i++) {
    physics.playerBody.velocity.x = -6;
    physics.playerBody.velocity.z = 0;
    physics.step(1 / 60, {});
  }
  assert.ok(physics.playerBody.position.x > -3.6, 'crossed the wall: ' + physics.playerBody.position.x);
  assert.ok(physics.playerBody.position.x < -2.2, 'did not reach the wall: ' + physics.playerBody.position.x);
  assert.strictEqual(physics.isGrounded(), true);
});

test('ragdoll turns the soldier into a tumbling corpse', () => {
  const { physics } = setup();
  const { pivot, entry } = makeEnemy(physics, 2, 0);
  physics.ragdoll(entry, 0, -1);
  assert.strictEqual(entry.alive, false);
  run(physics, 1.5, {});
  assert.ok(pivot.position.y < 0.8, 'corpse should fall, y=' + pivot.position.y);
  assert.ok(pivot.position.z < -0.1, 'corpse should slide along the shot');
  const q = pivot.quaternion;
  assert.ok(Math.abs(q.w) < 0.999 || Math.abs(q.x) + Math.abs(q.z) > 0.01, 'corpse should rotate');
});

test('lineOfSight and aimPoint respect the parapet', () => {
  const { physics } = setup([
    { x: 0, z: 5, angle: 0, length: 12, thickness: 1, height: 1.3 },
  ]);
  assert.strictEqual(physics.lineOfSight({ x: 0, y: 1.4, z: 10 }, { x: 0, y: 1.2, z: 0 }), false);
  assert.strictEqual(physics.lineOfSight({ x: 0, y: 1.4, z: 10 }, { x: 0, y: 1.2, z: 8 }), true);
  const hit = physics.aimPoint({ x: 0, y: 1.2, z: 10 }, { x: 0, y: 0, z: -1 }, 50);
  assert.ok(Math.abs(hit.z - 5.5) < 0.1, 'aim point z=' + hit.z);
});

test('an enemy cannonball inside the fort damages fort integrity', () => {
  const { physics } = setup();
  const rec = recorder();
  physics.fireCannon({
    from: { x: 0, y: 0.9, z: -36 },
    target: { x: 0, y: 0.2, z: 10 },
    owner: 'enemy',
  });
  run(physics, 4, rec.ctx);
  assert.strictEqual(rec.calls.fort.length, 1);
  assert.strictEqual(rec.calls.fort[0].damage, 8);
  assert.strictEqual(rec.calls.player.length, 0, 'player is out of blast range');
});

test('a player cannonball damages enemies inside the blast radius', () => {
  const { physics } = setup();
  const a = makeEnemy(physics, 0, 0);
  makeEnemy(physics, 1.5, 0);
  const rec = recorder();
  physics.fireCannon({
    from: { x: 0, y: 0.9, z: 8 },
    target: { x: 0, y: 0.6, z: 0 },
    owner: 'player',
    damage: 120,
    blastRadius: 5.5,
  });
  run(physics, 2, rec.ctx);
  assert.ok(rec.calls.enemy.length >= 2, 'both soldiers should take blast damage');
  const biggest = Math.max(...rec.calls.enemy.map((h) => h.damage));
  assert.ok(biggest >= 100, 'close soldier takes most of the blast, got ' + biggest);
  assert.strictEqual(rec.calls.enemy[0].kind, 'cannon');
  assert.strictEqual(a.pivot, rec.calls.enemy[0].enemy);
});

test('el trabuco crea ocho proyectiles shotgun dentro del cono', (t) => {
  const { physics } = setup();
  // Boundary samples make a square spread fail reliably instead of intermittently.
  const samples = [0, 0, 0, 0.5, 0, 0.999999, 0.5, 0,
    0.5, 0.999999, 0.999999, 0, 0.999999, 0.5, 0.999999, 0.999999];
  let sample = 0;
  t.mock.method(Math, 'random', () => samples[sample++ % samples.length]);
  const shots = physics.fireShotgun({
    from: { x: 0, y: 1.7, z: 0 },
    dir: { x: 0, y: 0, z: -1 },
    spread: 0.07,
    damage: 22,
    pellets: 8,
    owner: 'player',
  });
  assert.strictEqual(shots.length, 8);
  for (const shot of shots) {
    assert.strictEqual(shot.kind, 'shotgun');
    assert.strictEqual(shot.damage, 22);
    const len = Math.hypot(shot.vel.x, shot.vel.y, shot.vel.z);
    assert.ok(len > 0);
    const angle = Math.acos(Math.max(-1, Math.min(1, -shot.vel.z / len)));
    assert.ok(angle <= 0.07 + 1e-9, `perdigón fuera del cono: ${angle} rad`);
  }
});

test('shotgun no crea trails y musket crea exactamente uno', (t) => {
  const trail = { update() {}, dispose() {} };
  const effects = { trail: t.mock.fn(() => trail) };
  const { physics } = setup([], effects);
  const opts = {
    from: { x: 0, y: 1.7, z: 0 },
    dir: { x: 0, y: 0, z: -1 },
    spread: 0.07,
    damage: 22,
    pellets: 8,
    owner: 'player',
  };
  const shots = physics.fireShotgun(opts);
  assert.strictEqual(shots.length, 8);
  assert.strictEqual(effects.trail.mock.callCount(), 0);
  for (const shot of shots) assert.strictEqual(shot.trail, null);

  const musket = physics.fireMusket(opts);
  assert.strictEqual(effects.trail.mock.callCount(), 1);
  assert.deepStrictEqual(effects.trail.mock.calls[0].arguments, [opts.from, 'musket']);
  assert.strictEqual(musket.trail, trail);
});

test('shotgun con spread cero conserva kind y 22 de daño al impactar', () => {
  const { physics } = setup();
  const { pivot } = makeEnemy(physics, 0, 0);
  const rec = recorder();
  physics.fireShotgun({
    from: { x: 0, y: 1.4, z: 10 },
    dir: { x: 0, y: 0, z: -1 },
    spread: 0,
    damage: 22,
    pellets: 8,
    owner: 'player',
  });
  run(physics, 0.4, rec.ctx);
  assert.strictEqual(rec.calls.enemy.length, 8);
  for (const hit of rec.calls.enemy) {
    assert.strictEqual(hit.enemy, pivot);
    assert.strictEqual(hit.kind, 'shotgun');
    assert.strictEqual(hit.damage, 22);
  }
  assert.strictEqual(physics.getStats().projectiles, 0);
});

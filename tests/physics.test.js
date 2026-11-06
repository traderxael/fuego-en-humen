const test = require('node:test');
const assert = require('node:assert');

const P = require('../js/logic/physics');

function simulateToTarget(from, to, speed) {
  const pos = { x: from.x, y: from.y, z: from.z };
  const vel = P.ballisticVelocity(from, to, speed);
  const initialVel = { x: vel.x, y: vel.y, z: vel.z };
  let best = Infinity;
  for (let i = 0; i < 4000; i++) {
    P.stepProjectile(pos, vel, 1 / 2000);
    const d = Math.hypot(pos.x - to.x, pos.y - to.y, pos.z - to.z);
    if (d < best) best = d;
    if (d < 0.05) break;
  }
  return { best, initialVel, pos };
}

test('ballisticVelocity reaches a 40 m target at chest height', () => {
  const from = { x: 0, y: 1.4, z: 20 };
  const to = { x: 12, y: 1.0, z: -20 };
  const { best, initialVel } = simulateToTarget(from, to, 320);
  assert.ok(Math.hypot(initialVel.x, initialVel.z) > 0);
  assert.ok(best < 0.06, 'closest approach was ' + best);
});

test('ballisticVelocity compensates a slow cannon arc', () => {
  const from = { x: 0, y: 0.9, z: -40 };
  const to = { x: 6, y: 0.4, z: 10 };
  const { best, initialVel } = simulateToTarget(from, to, 62);
  assert.ok(initialVel.y > 0, 'cannon must lob upwards');
  assert.ok(best < 0.1, 'closest approach was ' + best);
});

test('stepProjectile applies gravity to the vertical velocity', () => {
  const pos = { x: 0, y: 10, z: 0 };
  const vel = { x: 20, y: 0, z: -5 };
  P.stepProjectile(pos, vel, 0.5);
  assert.ok(Math.abs(pos.x - 10) < 1e-9);
  assert.ok(Math.abs(pos.z + 2.5) < 1e-9);
  assert.ok(Math.abs(vel.y + P.GRAVITY * 0.5) < 1e-9);
});

test('spreadDirection returns the input direction when spread is zero', () => {
  const dir = P.normalize({ x: 0.3, y: -0.2, z: -1 });
  const out = P.spreadDirection(dir, 0, 0.2, 0.8);
  assert.ok(Math.abs(out.x - dir.x) < 1e-9);
  assert.ok(Math.abs(out.y - dir.y) < 1e-9);
  assert.ok(Math.abs(out.z - dir.z) < 1e-9);
});

test('spreadDirection stays inside the requested cone', () => {
  const dir = { x: 0, y: 0, z: -1 };
  const spread = 0.02;
  const maxAngle = spread * Math.SQRT2 + 1e-9;
  for (let i = 0; i < 200; i++) {
    const out = P.spreadDirection(dir, spread, (i * 0.37) % 1, (i * 0.61) % 1);
    const angle = Math.acos(-out.z);
    assert.ok(Number.isFinite(angle));
    assert.ok(angle <= maxAngle, 'angle ' + angle + ' exceeded ' + maxAngle);
  }
});

test('spreadDirection is deterministic for identical randoms', () => {
  const a = P.spreadDirection({ x: 0, y: 0, z: -1 }, 0.05, 0.25, 0.75);
  const b = P.spreadDirection({ x: 0, y: 0, z: -1 }, 0.05, 0.25, 0.75);
  assert.deepStrictEqual(a, b);
});

test('falloff goes from full damage at the center to zero at the radius', () => {
  assert.strictEqual(P.falloff(0, 5), 1);
  assert.strictEqual(P.falloff(5, 5), 0);
  assert.strictEqual(P.falloff(9, 5), 0);
  assert.ok(Math.abs(P.falloff(2.5, 5) - 0.5) < 1e-9);
  assert.strictEqual(P.falloff(1, 0), 0);
});

test('turnTowards takes the short way around the wrap point', () => {
  const result = P.turnTowards(Math.PI - 0.1, -Math.PI + 0.1, 0.5);
  assert.ok(result > Math.PI - 0.1, 'must cross +pi, not go back through 0');
  assert.ok(Math.abs(result - (Math.PI + 0.1)) < 1e-9);
  assert.strictEqual(P.turnTowards(0, 1, 0.2), 0.2);
  assert.strictEqual(P.turnTowards(0.5, -0.5, 1), -0.5);
});

test('dropAt matches free fall for the flight time', () => {
  const drop = P.dropAt(320, 320, 9.81);
  assert.ok(Math.abs(drop - 4.905) < 1e-6);
});

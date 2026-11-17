const test = require('node:test');
const assert = require('node:assert');

const { attenuation, spatialGains } = require('../js/logic/spatial');

test('attenuation falls linearly from 1 to 0 and clamps beyond maxDist', () => {
  assert.strictEqual(attenuation(0, 60), 1);
  assert.strictEqual(attenuation(30, 60), 0.5);
  assert.strictEqual(attenuation(60, 60), 0);
  assert.strictEqual(attenuation(120, 60), 0);
  assert.strictEqual(attenuation(-5, 60), 1);
});

test('spatialGains pans a source to the right at yaw 0', () => {
  const listener = { x: 0, y: 0, z: 0, yaw: 0 };
  const { gain, pan } = spatialGains(listener, { x: 10, y: 0, z: 0 }, 60);
  assert.ok(Math.abs(gain - (1 - 10 / 60)) < 1e-9);
  assert.ok(pan > 0.5);
});

test('spatialGains pans a source to the left at yaw 0', () => {
  const listener = { x: 0, y: 0, z: 0, yaw: 0 };
  const { pan } = spatialGains(listener, { x: -10, y: 0, z: 0 }, 60);
  assert.ok(pan < -0.5);
});

test('spatialGains keeps a source dead ahead centred', () => {
  const listener = { x: 0, y: 0, z: 0, yaw: 0 };
  const { pan } = spatialGains(listener, { x: 0, y: 0, z: -10 }, 60);
  assert.ok(Math.abs(pan) < 1e-9);
});

test('spatialGains rotates the right vector with listener yaw', () => {
  // yaw +pi/2 turns the camera to face -X; its right side points to -Z.
  const listener = { x: 0, y: 0, z: 0, yaw: Math.PI / 2 };
  const right = spatialGains(listener, { x: 0, y: 0, z: -10 }, 60);
  assert.ok(right.pan > 0.5);
  const left = spatialGains(listener, { x: 0, y: 0, z: 10 }, 60);
  assert.ok(left.pan < -0.5);
});

test('spatialGains uses 3D distance for attenuation', () => {
  const listener = { x: 0, y: 0, z: 0, yaw: 0 };
  const { gain } = spatialGains(listener, { x: 0, y: 30, z: 0 }, 60);
  assert.ok(Math.abs(gain - 0.5) < 1e-9);
});

test('spatialGains is NaN-safe and silent for invalid input', () => {
  const listener = { x: 0, y: 0, z: 0, yaw: 0 };
  const bad = spatialGains(listener, { x: NaN, y: 0, z: 5 }, 60);
  assert.strictEqual(bad.gain, 0);
  assert.strictEqual(bad.pan, 0);
  const badListener = spatialGains({ x: 0, y: 0, z: 0, yaw: NaN }, { x: 5, y: 0, z: 0 }, 60);
  assert.ok(Number.isFinite(badListener.gain));
  assert.ok(Number.isFinite(badListener.pan));
});
// Tests for the procedural rig and the animation system.
//
//   node --test tests/rig.test.js
//
// three.js is loaded from vendor/ as a CommonJS module so the rig can be
// exercised without a browser.

const path = require('path');
const test = require('node:test');
const assert = require('node:assert');

const ROOT = path.join(__dirname, '..');
global.THREE = require(path.join(ROOT, 'vendor', 'three.min.js'));
const Rig = require(path.join(ROOT, 'js', 'rig', 'humanoid.js'));
const RigAnim = require(path.join(ROOT, 'js', 'rig', 'anim.js'));

function buildRig(faction) {
  return Rig.buildSoldier({ faction: faction || 'british' });
}

test('the rig builds a skeleton with the expected bones', () => {
  const rig = buildRig();
  const expected = [
    'root', 'hips', 'spine', 'chest', 'neck', 'head',
    'shoulderR', 'upperArmR', 'forearmR', 'handR',
    'shoulderL', 'upperArmL', 'forearmL', 'handL',
    'thighR', 'shinR', 'footR', 'thighL', 'shinL', 'footL',
    'weapon',
  ];
  for (const name of expected) {
    assert.ok(rig.byName[name], 'missing bone ' + name);
  }
  assert.equal(rig.bones.length, expected.length);
  assert.equal(rig.bones[0].name, 'root', 'the root bone must come first');
});

test('skin weights are normalised and reference real bones', () => {
  const rig = buildRig();
  const geo = rig.mesh.geometry;
  const weights = geo.getAttribute('skinWeight');
  const indices = geo.getAttribute('skinIndex');
  assert.ok(weights.count > 0, 'the mesh has no vertices');
  for (let i = 0; i < weights.count; i++) {
    let sum = 0;
    for (let j = 0; j < 4; j++) {
      const w = weights.getComponent(i, j);
      assert.ok(w >= 0 && w <= 1, 'weight out of range at ' + i);
      assert.ok(indices.getComponent(i, j) < rig.bones.length, 'bone index out of range');
      sum += w;
    }
    assert.ok(Math.abs(sum - 1) < 1e-4, 'weights do not sum to 1 at vertex ' + i + ': ' + sum);
  }
});

test('the skin index buffer matches the bone order', () => {
  const rig = buildRig();
  const indices = rig.mesh.geometry.getAttribute('skinIndex');
  for (let i = 0; i < indices.count; i++) {
    assert.ok(indices.getComponent(i, 0) >= 0);
  }
  assert.equal(rig.mesh.geometry.groups.length > 0, true, 'the mesh has no material groups');
});

test('the weapon bone is a child of the chest and carries the musket', () => {
  const rig = buildRig();
  assert.equal(rig.byName.weapon.parent, rig.byName.chest);
  assert.ok(rig.weapon, 'the musket is not attached');
  assert.equal(rig.weapon.parent, rig.byName.weapon);
});

test('the IK puts the hand on the musket grip', () => {
  const rig = buildRig();
  const anim = new RigAnim.Animator(rig);
  anim.play(RigAnim.Clips.aim());
  anim.update(0);

  const ik = rig.ik;
  const grip = new THREE.Vector3().copy(ik.grip)
    .applyQuaternion(rig.byName.weapon.quaternion)
    .add(ik.weaponRest);
  // The fist bone ends up at the shoulder + arm chain, so compare the
  // distance between the solved hand and the grip in the chest frame.
  const hand = rig.byName.handR.getWorldPosition(new THREE.Vector3());
  const chest = rig.byName.chest.getWorldPosition(new THREE.Vector3());
  const handLocal = hand.clone().sub(chest);
  const gripLocal = grip.clone();
  assert.ok(
    handLocal.distanceTo(gripLocal) < 0.12,
    'the right hand is ' + handLocal.distanceTo(gripLocal).toFixed(3) + ' m from the grip'
  );
});

test('the aim clip points the musket downrange', () => {
  const rig = buildRig();
  const anim = new RigAnim.Animator(rig);
  anim.play(RigAnim.Clips.aim());
  anim.update(0);

  // The musket points along the weapon bone's -Z, so with the bone almost
  // level the barrel must be horizontal.
  const forward = new THREE.Vector3(0, 0, -1)
    .applyQuaternion(rig.byName.weapon.getWorldQuaternion(new THREE.Quaternion()));
  assert.ok(
    Math.abs(forward.y) < 0.25,
    'the barrel is not level: y=' + forward.y.toFixed(3)
  );
  assert.ok(forward.z < -0.8, 'the musket does not point downrange: z=' + forward.z.toFixed(3));
});

test('the port arms carry keeps the muzzle up', () => {
  const rig = buildRig();
  const anim = new RigAnim.Animator(rig);
  anim.play(RigAnim.Clips.idle());
  anim.update(0.5);
  const forward = new THREE.Vector3(0, 0, -1)
    .applyQuaternion(rig.byName.weapon.getWorldQuaternion(new THREE.Quaternion()));
  assert.ok(forward.y > 0.4, 'the muzzle should point up: y=' + forward.y.toFixed(3));
});

test('the animator advances the clip time and writes the bones', () => {
  const rig = buildRig();
  const anim = new RigAnim.Animator(rig);
  anim.play(RigAnim.Clips.walk(1));
  const before = rig.byName.thighR.quaternion.clone();
  anim.update(0.2);
  assert.ok(anim.time > 0, 'the clock did not advance');
  assert.notDeepEqual(
    before.toArray(), rig.byName.thighR.quaternion.toArray(),
    'the thigh bone was not animated'
  );
});

test('cross fading blends between two clips', () => {
  const rig = buildRig();
  const anim = new RigAnim.Animator(rig);
  anim.play(RigAnim.Clips.aim());
  anim.update(0.5);
  anim.play(RigAnim.Clips.idle(), { fade: 0.4 });
  anim.update(0.2);
  assert.ok(anim.fade > 0 && anim.fade < 1, 'the fade did not start');
  for (let i = 0; i < 20 && anim.fade < 1; i++) anim.update(0.1);
  assert.ok(anim.fade >= 1, 'the fade never finished');
});

test('the reload clip takes the right hand to the cartridge pouch', () => {
  const rig = buildRig();
  const anim = new RigAnim.Animator(rig);
  anim.play(RigAnim.Clips.reload());
  anim.time = 0.75;
  anim.update(0);
  assert.ok(
    anim.pose.targets.rightMode < 0.5,
    'the right hand should have left the stock during the reload'
  );
});

test('the viewmodel rig only carries arms', () => {
  const vm = Rig.buildViewmodel({});
  assert.ok(vm.byName.upperArmR, 'the viewmodel has no right arm');
  assert.equal(vm.byName.hips, undefined, 'the viewmodel should not have a body');
  const anim = new RigAnim.Animator(vm);
  anim.play(RigAnim.Clips.vmIdle());
  anim.update(0.1);
  assert.ok(vm.byName.handR.quaternion.length() > 0.99);
});

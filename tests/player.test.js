const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const THREE = require('../vendor/three.min.js');
const { WEAPONS } = require('../js/logic/config');

const sandbox = { THREE, WEAPONS };
vm.runInNewContext(
  fs.readFileSync(path.join(__dirname, '..', 'js', 'player.js'), 'utf8'),
  sandbox
);

test('la boca del trabuco se ensancha hacia -Z en el viewmodel real', () => {
  const camera = new THREE.PerspectiveCamera();
  const player = sandbox.createPlayer(camera, null, {
    physics: {
      playerBody: { position: new THREE.Vector3(0, 0.9, 0) },
      EYE_OFFSET: 0.8,
      isGrounded: () => true,
    },
  });
  player.setLoadout('trabuco');
  camera.updateMatrixWorld(true);

  const viewmodel = camera.getObjectByName('viewmodel');
  const visibleWeapons = viewmodel.children.filter((weapon) => weapon.visible);
  assert.strictEqual(visibleWeapons.length, 1);
  const muzzle = visibleWeapons[0].children.find((mesh) => {
    const geometry = mesh.geometry;
    return geometry && geometry.type === 'CylinderGeometry'
      && geometry.parameters.radiusTop !== geometry.parameters.radiusBottom;
  });
  assert.ok(muzzle, 'el trabuco debe tener una boca acampanada');

  const positions = muzzle.geometry.getAttribute('position');
  const vertices = Array.from({ length: positions.count }, (_, i) =>
    new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(muzzle.matrix)
  );
  const frontZ = Math.min(...vertices.map((v) => v.z));
  const rearZ = Math.max(...vertices.map((v) => v.z));
  const radiusAt = (z) => Math.max(...vertices
    .filter((v) => Math.abs(v.z - z) < 1e-6)
    .map((v) => Math.hypot(v.x - muzzle.position.x, v.y - muzzle.position.y)));
  const frontRadius = radiusAt(frontZ);
  const rearRadius = radiusAt(rearZ);
  assert.ok(frontRadius > rearRadius,
    `la boca debe ensancharse hacia -Z: radio frontal=${frontRadius}, trasero=${rearRadius}`);
});

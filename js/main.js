(function () {
  const canvas = document.getElementById('game-canvas');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  const renderer = new THREE.WebGLRenderer({ canvas: canvas });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const world = buildWorld(scene);

  // Camera inside the fort, looking north toward the sea/beach/ships.
  camera.position.set(0, 2.2, 24);
  camera.lookAt(0, 2.0, -60);

  function animate() {
    requestAnimationFrame(animate);
    // Gentle sea bob so the deck doesn't feel static (ships only).
    world.ships.forEach((ship, i) => {
      const baseY = ship.userData.baseY !== undefined ? ship.userData.baseY : 0;
      ship.position.y = baseY + Math.sin(performance.now() / 1400 + i * 1.3) * 0.18;
    });
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
})();

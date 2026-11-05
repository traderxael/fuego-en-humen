(function () {
  const canvas = document.getElementById('game-canvas');

  const state = createGameState();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  // Camera children (viewmodel) only render if the camera is in the scene graph.
  scene.add(camera);

  const renderer = new THREE.WebGLRenderer({ canvas: canvas });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const world = buildWorld(scene);

  // Player spawns inside the fort, looking north toward the sea/beach/ships.
  // (createPlayer owns the camera transform: eyes at 1.7 m, yaw 0 = -Z.)
  const player = createPlayer(camera, canvas, { state: state, enemies: [] });

  let lastTime = performance.now();
  function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    player.update(dt);

    // Gentle sea bob so the deck doesn't feel static (ships only).
    world.ships.forEach((ship, i) => {
      const baseY = ship.userData.baseY !== undefined ? ship.userData.baseY : 0;
      ship.position.y = baseY + Math.sin(now / 1400 + i * 1.3) * 0.18;
    });
    // Always render — when paused the world stays visible behind the overlay.
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
})();

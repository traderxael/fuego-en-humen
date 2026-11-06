// Builds the low-poly Humen scene: beach, sea, U-shaped fort, cannons, ships.
// Exposes `buildWorld(scene)` -> { fort, walls, sea, ships, cannons } in the browser;
// also guarded for Node tooling consistency.

var buildWorld = (function () {
  function buildWorld(scene) {
    var group = new THREE.Group();
    group.name = 'world';
    scene.add(group);

    // --- Sky / fog / lights ---
    scene.background = new THREE.Color(0x9fc7e8);
    scene.fog = new THREE.Fog(0x9fc7e8, 60, 220);

    var hemi = new THREE.HemisphereLight(0xcfe8ff, 0xe6cf9a, 0.85);
    group.add(hemi);

    var sun = new THREE.DirectionalLight(0xfff2d8, 1.1);
    sun.position.set(40, 60, -20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -70;
    sun.shadow.camera.right = 70;
    sun.shadow.camera.top = 70;
    sun.shadow.camera.bottom = -70;
    sun.shadow.camera.far = 180;
    group.add(sun);

    // --- Ground: sandy beach strip + inland dirt ---
    var sand = new THREE.Mesh(
      new THREE.PlaneGeometry(240, 120),
      new THREE.MeshStandardMaterial({ color: 0xe3cd9a, roughness: 1.0 })
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0, 10);
    sand.receiveShadow = true;
    group.add(sand);

    // Dirt courtyard inside the fort
    var dirt = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 28),
      new THREE.MeshStandardMaterial({ color: 0xb59a6e, roughness: 1.0 })
    );
    dirt.rotation.x = -Math.PI / 2;
    dirt.position.set(0, 0.02, 24);
    dirt.receiveShadow = true;
    group.add(dirt);

    // --- Sea: plane beyond the beach (north, -Z) with transparency ---
    // Waterline at z = -45 so the landing beach (spawns at z -38..-43) is dry.
    var sea = new THREE.Mesh(
      new THREE.PlaneGeometry(300, 180),
      new THREE.MeshStandardMaterial({
        color: 0x2a6ea6,
        transparent: true,
        opacity: 0.85,
        roughness: 0.35,
        metalness: 0.05,
      })
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, 0.02, -135);
    sea.receiveShadow = true;
    group.add(sea);

    // --- Fort: U-shaped wall opening toward the sea (-Z) ---
    // Player stands inside. The seaward face is a LOW battery parapet
    // (~1.3 m + parapet lip) the player can fire over; the U opens
    // toward the sea via two angled "horn" arms extending north from
    // the side walls. No embrasures — the fort cannons are props for
    // now; the interactive cannon arrives with its own task.
    var fort = new THREE.Group();
    fort.name = 'fort';
    fort.position.set(0, 0, 20);

    var parapetHeight = 1.3;
    var wallHeight = 4;
    var walls = [];
    var colliders = []; // fort-local boxes for the physics world

    function addFortCollider(localX, localZ, angle, length, thickness, height) {
      colliders.push({
        x: fort.position.x + localX,
        z: fort.position.z + localZ,
        angle: angle || 0,
        length: length,
        thickness: thickness,
        height: height,
      });
    }

    // North battery parapet (sea side), ~40 wide, low enough to see/fire over
    var northWall = Models.makeFortWall(40, parapetHeight);
    northWall.position.set(0, 0, -14);
    fort.add(northWall);
    walls.push(northWall);
    // Low seaward parapet: blocks bodies, lets musket balls clear its top.
    addFortCollider(0, -14, 0, 40, 1.4, parapetHeight);

    // Horn arms extending toward the sea at both corners (the "U" opening)
    var westArm = Models.makeFortWall(10, wallHeight);
    westArm.rotation.y = Math.PI / 3;
    westArm.position.set(-23, 0, -16);
    fort.add(westArm);
    walls.push(westArm);
    addFortCollider(-23, -16, Math.PI / 3, 10, 1.4, wallHeight);

    var eastArm = Models.makeFortWall(10, wallHeight);
    eastArm.rotation.y = -Math.PI / 3;
    eastArm.position.set(23, 0, -16);
    fort.add(eastArm);
    walls.push(eastArm);
    addFortCollider(23, -16, -Math.PI / 3, 10, 1.4, wallHeight);

    // South wall (behind player) - taller watchtower-ish, same builder
    var southWall = Models.makeFortWall(40, wallHeight + 1);
    southWall.position.set(0, 0, 14);
    fort.add(southWall);
    walls.push(southWall);
    addFortCollider(0, 14, 0, 40, 1.4, wallHeight + 1);

    // West / East side walls (connecting north and south)
    var westWall = Models.makeFortWall(28, wallHeight);
    westWall.rotation.y = Math.PI / 2;
    westWall.position.set(-20, 0, 0);
    fort.add(westWall);
    walls.push(westWall);
    addFortCollider(-20, 0, Math.PI / 2, 28, 1.4, wallHeight);

    var eastWall = Models.makeFortWall(28, wallHeight);
    eastWall.rotation.y = Math.PI / 2;
    eastWall.position.set(20, 0, 0);
    fort.add(eastWall);
    walls.push(eastWall);
    addFortCollider(20, 0, Math.PI / 2, 28, 1.4, wallHeight);

    // Small watchtower at the south-west corner (non-interactive prop)
    var towerBase = new THREE.Mesh(
      new THREE.BoxGeometry(4, 7, 4),
      new THREE.MeshStandardMaterial({ color: 0xc9a06a, roughness: 0.95 })
    );
    towerBase.position.set(-18, 3.5, 12);
    towerBase.castShadow = true;
    towerBase.receiveShadow = true;
    fort.add(towerBase);
    var towerRoof = new THREE.Mesh(
      new THREE.ConeGeometry(3.2, 2.2, 4),
      new THREE.MeshStandardMaterial({ color: 0x8a5a3a, roughness: 0.9 })
    );
    towerRoof.position.set(-18, 8.1, 12);
    towerRoof.rotation.y = Math.PI / 4;
    towerRoof.castShadow = true;
    fort.add(towerRoof);
    addFortCollider(-18, 12, 0, 4, 4, 7);

    group.add(fort);

    // --- Cannons: 4 props inside the fort facing the sea ---
    var cannons = [];
    var cannonPositions = [
      { x: -12, z: -10 },
      { x: -4, z: -11 },
      { x: 4, z: -11 },
      { x: 12, z: -10 },
    ];
    for (var c = 0; c < cannonPositions.length; c++) {
      var cannon = Models.makeCannon();
      cannon.position.set(cannonPositions[c].x, 0, cannonPositions[c].z);
      // Barrel of makeCannon points along -Z (north, toward the sea) — no flip needed
      fort.add(cannon);
      cannons.push(cannon);
      // Carriage + barrel footprint, slightly back from the muzzle.
      addFortCollider(cannonPositions[c].x, cannonPositions[c].z - 0.4, 0, 0.8, 2.4, 1.1);
    }

    // --- Ships: 3 anchored offshore beyond the beach ---
    var ships = [];
    var shipDefs = [
      { x: -28, z: -95, rot: 0.25, scale: 1.0 },
      { x: 6, z: -115, rot: -0.15, scale: 1.25 },
      { x: 38, z: -100, rot: 0.5, scale: 0.9 },
    ];
    for (var s = 0; s < shipDefs.length; s++) {
      var ship = Models.makeShip();
      ship.position.set(shipDefs[s].x, -0.5, shipDefs[s].z);
      ship.userData.baseY = -0.5;
      ship.rotation.y = shipDefs[s].rot;
      ship.scale.setScalar(shipDefs[s].scale);
      group.add(ship);
      ships.push(ship);
    }

    return { fort: fort, walls: walls, sea: sea, ships: ships, cannons: cannons, colliders: colliders };
  }

  return buildWorld;
})();

if (typeof module !== 'undefined') module.exports = { buildWorld: buildWorld };

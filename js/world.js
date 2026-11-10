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

    // The lights live in the scene, not in `group`: the cinematics hide the
    // world group, and the sets still need to be lit.
    var hemi = new THREE.HemisphereLight(0xcfe8ff, 0xe6cf9a, 0.85);
    scene.add(hemi);

    var sun = new THREE.DirectionalLight(0xfff2d8, 1.1);
    sun.position.set(40, 60, -20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -70;
    sun.shadow.camera.right = 70;
    sun.shadow.camera.top = 70;
    sun.shadow.camera.bottom = -70;
    sun.shadow.camera.far = 180;
    scene.add(sun);

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
    var northWall = Models.makeFortWall(40, parapetHeight, { kind: 'parapet' });
    northWall.position.set(0, 0, -14);
    fort.add(northWall);
    walls.push(northWall);
    // Low seaward parapet: blocks bodies, lets musket balls clear its top.
    addFortCollider(0, -14, 0, 40, 1.4, parapetHeight);

    // Horn arms extending toward the sea at both corners (the "U" opening)
    var westArm = Models.makeFortWall(10, wallHeight, { kind: 'arm' });
    westArm.rotation.y = Math.PI / 3;
    westArm.position.set(-23, 0, -16);
    fort.add(westArm);
    walls.push(westArm);
    addFortCollider(-23, -16, Math.PI / 3, 10, 1.4, wallHeight);

    var eastArm = Models.makeFortWall(10, wallHeight, { kind: 'arm' });
    eastArm.rotation.y = -Math.PI / 3;
    eastArm.position.set(23, 0, -16);
    fort.add(eastArm);
    walls.push(eastArm);
    addFortCollider(23, -16, -Math.PI / 3, 10, 1.4, wallHeight);

    // South wall (behind player) - taller watchtower-ish, same builder
    var southWall = Models.makeFortWall(40, wallHeight + 1, { kind: 'landward', gate: true, face: -1 });
    southWall.position.set(0, 0, 14);
    fort.add(southWall);
    walls.push(southWall);
    addFortCollider(0, 14, 0, 40, 1.4, wallHeight + 1);

    // West / East side walls (connecting north and south)
    var westWall = Models.makeFortWall(28, wallHeight, { kind: 'side', face: 1 });
    westWall.rotation.y = Math.PI / 2;
    westWall.position.set(-20, 0, 0);
    fort.add(westWall);
    walls.push(westWall);
    addFortCollider(-20, 0, Math.PI / 2, 28, 1.4, wallHeight);

    var eastWall = Models.makeFortWall(28, wallHeight, { kind: 'side', face: -1 });
    eastWall.rotation.y = Math.PI / 2;
    eastWall.position.set(20, 0, 0);
    fort.add(eastWall);
    walls.push(eastWall);
    addFortCollider(20, 0, Math.PI / 2, 28, 1.4, wallHeight);

    // Small stone watchtower at the south-west corner (non-interactive prop)
    var tower = Models.makeTower(4, 7);
    tower.position.set(-18, 0, 12);
    fort.add(tower);
    var towerRoof = new THREE.Mesh(
      new THREE.ConeGeometry(3.2, 2.2, 4),
      new THREE.MeshStandardMaterial({ color: 0x8a5a3a, roughness: 0.9 })
    );
    towerRoof.position.set(-18, 8.32, 12);
    towerRoof.rotation.y = Math.PI / 4;
    towerRoof.castShadow = true;
    fort.add(towerRoof);
    addFortCollider(-18, 12, 0, 4, 4, 7);

    // --- Qing unit banners (cloth waves in world.update) ---
    var flags = [];
    var flagDefs = [
      { x: -18, y: 9.0, z: 12, phase: 0 },
      { x: -16, y: 5.0, z: 14, phase: 1.7 },
      { x: 16, y: 5.0, z: 14, phase: 3.4 },
    ];
    for (var f = 0; f < flagDefs.length; f++) {
      var flag = Models.makeFlag();
      flag.position.set(flagDefs[f].x, flagDefs[f].y, flagDefs[f].z);
      fort.add(flag);
      flags.push({ cloth: flag.userData.cloth, phase: flagDefs[f].phase });
    }

    group.add(fort);

    // --- Cannons: 4 props inside the fort facing the sea ---
    var cannons = [];
    var cannonPositions = [
      { x: -12, z: -10 },
      { x: -4, z: -11 },
      { x: 4, z: -11 },
      { x: 12, z: -10 },
    ];
    var platformGeo = new THREE.BoxGeometry(3.0, 0.12, 3.4);
    var platformMat = new THREE.MeshStandardMaterial({ color: 0x6a5136, roughness: 0.95 });
    for (var c = 0; c < cannonPositions.length; c++) {
      var platform = new THREE.Mesh(platformGeo, platformMat);
      platform.position.set(cannonPositions[c].x, 0.06, cannonPositions[c].z - 0.5);
      platform.receiveShadow = true;
      platform.castShadow = false;
      platform.userData.type = 'gun-platform';
      fort.add(platform);
      var cannon = Models.makeCannon();
      cannon.position.set(cannonPositions[c].x, 0.12, cannonPositions[c].z);
      // Barrel of makeCannon points along -Z (north, toward the sea) — no flip needed
      fort.add(cannon);
      cannons.push(cannon);
      // Carriage + barrel footprint, slightly back from the muzzle.
      addFortCollider(cannonPositions[c].x, cannonPositions[c].z - 0.4, 0, 0.8, 2.4, 1.1);
    }

    // --- Jingals (wall guns) along the seaward parapet ---
    var jingals = [];
    var jingalXs = [-18, -8, 8, 18];
    for (var jg = 0; jg < jingalXs.length; jg++) {
      var jingal = Models.makeJingal();
      jingal.position.set(jingalXs[jg], 1.54, -14);
      fort.add(jingal);
      jingals.push(jingal);
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

    // --- Historical fleet: Nemesis, war junks, the Bogue boom and rafts ---
    var steamers = [];
    var nemesis = Models.makeSteamer();
    nemesis.position.set(14, -0.35, -72);
    nemesis.rotation.y = -0.12;
    group.add(nemesis);
    steamers.push(nemesis);

    var junks = [];
    var junkDefs = [
      { x: -34, z: -64, rot: 0.18 },
      { x: -50, z: -74, rot: -0.22 },
      { x: 38, z: -66, rot: 0.34 },
    ];
    for (var j = 0; j < junkDefs.length; j++) {
      var junk = Models.makeJunk();
      junk.position.set(junkDefs[j].x, -0.3, junkDefs[j].z);
      junk.rotation.y = junkDefs[j].rot;
      group.add(junk);
      junks.push(junk);
    }

    var chain = Models.makeChainBoom();
    chain.position.set(0, 0, -52);
    group.add(chain);

    var fireRafts = [];
    var raftDefs = [
      { x: -10, z: -56, phase: 0.6 },
      { x: 18, z: -60, phase: 2.1 },
    ];
    for (var r = 0; r < raftDefs.length; r++) {
      var raft = Models.makeFireRaft();
      raft.position.set(raftDefs[r].x, 0.05, raftDefs[r].z);
      group.add(raft);
      fireRafts.push({ mesh: raft, baseY: 0.05, phase: raftDefs[r].phase, yaw: 0.2 + r * 0.5 });
    }

    var village = [];
    var villageDefs = [
      { x: -52, z: -18, rot: 0.3 },
      { x: 54, z: -12, rot: -0.4 },
    ];
    for (var v = 0; v < villageDefs.length; v++) {
      var town = Models.makeVillage();
      town.position.set(villageDefs[v].x, 0, villageDefs[v].z);
      town.rotation.y = villageDefs[v].rot;
      group.add(town);
      village.push(town);
    }

    function update(t) {
      for (var i = 0; i < fireRafts.length; i++) {
        var raft = fireRafts[i];
        raft.mesh.position.y = raft.baseY + Math.sin(t * 0.9 + raft.phase) * 0.06;
        raft.mesh.rotation.y = raft.yaw + t * 0.02;
      }
      for (var f2 = 0; f2 < flags.length; f2++) {
        var cloth = flags[f2].cloth;
        var pos = cloth.geometry.attributes.position;
        var phase = flags[f2].phase;
        for (var vi = 0; vi < pos.count; vi++) {
          var cx = pos.getX(vi);
          pos.setZ(vi, Math.sin(cx * 3 + t * 4 + phase) * 0.12 * (cx / 1.7 + 0.5));
        }
        pos.needsUpdate = true;
      }
    }

    return {
      group: group,
      fort: fort,
      walls: walls,
      sea: sea,
      ships: ships,
      steamers: steamers,
      junks: junks,
      chain: chain,
      fireRafts: fireRafts,
      village: village,
      jingals: jingals,
      flags: flags,
      update: update,
      cannons: cannons,
      colliders: colliders,
    };
  }

  return buildWorld;
})();

if (typeof module !== 'undefined') module.exports = { buildWorld: buildWorld };

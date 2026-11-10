// Builds the low-poly Humen scene: beach, sea, U-shaped fort, cannons, ships.
// Exposes `buildWorld(scene)` -> { fort, walls, sea, ships, cannons } in the browser;
// also guarded for Node tooling consistency.

var buildWorld = (function () {
  // Shared radial-gradient canvas texture (sun disc, scorch decals).
  function makeRadialTexture(inner, outer) {
    var size = 64;
    var canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    var ctx = canvas.getContext('2d');
    var grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, inner);
    grad.addColorStop(1, outer);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    var tex = new THREE.CanvasTexture(canvas);
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function buildWorld(scene) {
    var group = new THREE.Group();
    group.name = 'world';
    scene.add(group);

    // --- Sky / fog / lights ---
    // Gradient sky dome (vertex-colored, unlit) instead of a flat background.
    // Cheap: one BackSide sphere, no extra lights, fog disabled on the dome.
    var horizonColor = new THREE.Color(0xdceaf9);
    var zenithColor = new THREE.Color(0x5f97cf);
    scene.background = horizonColor.clone();
    scene.fog = new THREE.Fog(horizonColor.getHex(), 60, 220);

    var skyGeom = new THREE.SphereGeometry(450, 16, 12);
    var skyPos = skyGeom.attributes.position;
    var skyColors = new Float32Array(skyPos.count * 3);
    var tmpColor = new THREE.Color();
    for (var si = 0; si < skyPos.count; si++) {
      var h = Math.max(0, skyPos.getY(si)) / 450;
      tmpColor.copy(horizonColor).lerp(zenithColor, h);
      skyColors[si * 3] = tmpColor.r;
      skyColors[si * 3 + 1] = tmpColor.g;
      skyColors[si * 3 + 2] = tmpColor.b;
    }
    skyGeom.setAttribute('color', new THREE.BufferAttribute(skyColors, 3));
    var sky = new THREE.Mesh(
      skyGeom,
      new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })
    );
    sky.name = 'sky';
    sky.renderOrder = -2;
    group.add(sky);

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

    // Visible sun disc + halo in the light's direction (two sprites, no cost
    // beyond a pair of quads). Shares one radial canvas texture.
    var sunTex = makeRadialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
    var sunDir = new THREE.Vector3(40, 60, -20).normalize().multiplyScalar(430);
    var sunCore = new THREE.Sprite(new THREE.SpriteMaterial({
      map: sunTex, color: 0xffffff, fog: false, depthWrite: false, transparent: true,
    }));
    sunCore.position.copy(sunDir);
    sunCore.scale.setScalar(18);
    sunCore.renderOrder = -1;
    group.add(sunCore);
    var sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: sunTex, color: 0xfff3c4, fog: false, depthWrite: false, transparent: true, opacity: 0.55,
    }));
    sunHalo.position.copy(sunDir);
    sunHalo.scale.setScalar(45);
    sunHalo.renderOrder = -1;
    group.add(sunHalo);

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
      new THREE.PlaneGeometry(300, 180, 36, 22),
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

    // Small watchtower at the south-west corner (non-interactive prop)
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

    // --- Qing garrison: four fixed posts and four courtyard patrols ---
    var garrison = [];
    if (typeof Assets !== 'undefined' && Assets.has('qing')) {
      var garrisonPositions = [
        [-16, 1.3, -14], [16, 1.3, -14],
        [-23, 4, -16], [23, 4, -16],
        [-14, 0, 10], [14, 0, 10],
        [-7, 0, 13], [7, 0, 13],
      ];
      for (var q = 0; q < garrisonPositions.length; q++) {
        var guard = Assets.clone('qing');
        guard.position.fromArray(garrisonPositions[q]);
        // The asset is already normalized facing -Z, toward the sea.
        fort.add(guard);
        garrison.push(guard);
      }
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

    // --- Historical fleet: Nemesis, war junks, the boom and fire rafts ---
    // All merged single-mesh props: the whole navy costs nine draw calls.
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
      fireRafts.push({
        mesh: raft,
        baseY: 0.05,
        phase: raftDefs[r].phase,
        yaw: 0.2 + r * 0.5,
      });
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

    // --- Jingals (wall guns) along the seaward parapet ---
    var jingals = [];
    var jingalXs = [-18, -8, 8, 18];
    for (var jg = 0; jg < jingalXs.length; jg++) {
      var jingal = Models.makeJingal();
      jingal.position.set(jingalXs[jg], 1.54, -14);
      fort.add(jingal);
      jingals.push(jingal);
    }

    // --- Qing flags: tower + south-wall corners (cloth waves in update) ---
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

    // --- Scorch decals: revealed as the fort takes damage ---
    // 6 on the north parapet's inner face + 4 on the courtyard ground. All
    // start hidden; setFortDamage(ratio) shows round(ratio*10). Stored in
    // WORLD coords so main.js can emit smoke from the visible ones.
    var scorches = [];
    var scorchTex = makeRadialTexture('rgba(22,16,11,0.62)', 'rgba(22,16,11,0)');
    var scorchGeom = new THREE.PlaneGeometry(1.5, 1.5);
    var scorchMat = new THREE.MeshBasicMaterial({
      map: scorchTex, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    });
    function addScorch(x, y, z, flat, scale) {
      var m = new THREE.Mesh(scorchGeom, scorchMat);
      m.position.set(x, y, z);
      if (flat) m.rotation.x = -Math.PI / 2;
      m.scale.setScalar(scale || 1);
      m.visible = false;
      m.renderOrder = 1;
      group.add(m);
      scorches.push({ mesh: m, x: x, y: y, z: z });
    }
    var wallXs = [-15, -9, -3, 3, 9, 15];
    for (var w = 0; w < wallXs.length; w++) {
      // fort-local z -13.29 (inner face) -> world z +20; faces +Z (courtyard).
      addScorch(wallXs[w], 0.7, 6.71, false, 0.85);
    }
    var groundDefs = [
      { x: -8, z: 18 }, { x: 6, z: 24 }, { x: -3, z: 28 }, { x: 10, z: 14 },
    ];
    for (var gd = 0; gd < groundDefs.length; gd++) {
      addScorch(groundDefs[gd].x, 0.03, groundDefs[gd].z, true, 1.25);
    }

    function setFortDamage(ratio) {
      var r = Math.max(0, Math.min(1, ratio || 0));
      var count = Math.round(r * scorches.length);
      for (var i = 0; i < scorches.length; i++) scorches[i].mesh.visible = i < count;
    }

    // --- Per-frame animation: gentle sea swell + waving flag cloth ---
    var seaPos = sea.geometry.attributes.position;
    function update(t) {
      for (var q = 0; q < garrison.length; q++) {
        garrison[q].rotation.z = Math.sin(t * 0.8 + q) * 0.008;
      }
      for (var i = 0; i < seaPos.count; i++) {
        var x = seaPos.getX(i);
        var y = seaPos.getY(i);
        seaPos.setZ(i, Math.sin(x * 0.08 + t * 1.1) * 0.12 + Math.cos(y * 0.06 + t * 0.8) * 0.10);
      }
      seaPos.needsUpdate = true;
      for (var f = 0; f < flags.length; f++) {
        var cloth = flags[f].cloth;
        var pos = cloth.geometry.attributes.position;
        var phase = flags[f].phase;
        for (var v = 0; v < pos.count; v++) {
          var cx = pos.getX(v);
          pos.setZ(v, Math.sin(cx * 3 + t * 4 + phase) * 0.12 * (cx / 1.7 + 0.5));
        }
        pos.needsUpdate = true;
      }
      for (var r = 0; r < fireRafts.length; r++) {
        var raft = fireRafts[r];
        raft.mesh.position.y = raft.baseY + Math.sin(t * 0.9 + raft.phase) * 0.06;
        raft.mesh.rotation.y = raft.yaw + t * 0.02;
      }
    }

    return {
      fort: fort, walls: walls, sea: sea, ships: ships, cannons: cannons, colliders: colliders,
      garrison: garrison, flags: flags, scorches: scorches,
      steamers: steamers, junks: junks, chain: chain, fireRafts: fireRafts, village: village,
      jingals: jingals,
      update: update, setFortDamage: setFortDamage,
    };
  }

  return buildWorld;
})();

if (typeof module !== 'undefined') module.exports = { buildWorld: buildWorld };

// Builds the enhanced Humen scene: beach, rolling sea, U-shaped stone fort,
// 4 detailed Qing cannons with recoil, imperial dragon flags, props and 3-masted British warships.
// Exposes `buildWorld(scene)` -> { group, fort, walls, sea, ships, cannons, colliders, update } in the browser;
// also guarded for Node tooling consistency.

var buildWorld = (function () {
  function buildWorld(scene) {
    var group = new THREE.Group();
    group.name = 'world';
    scene.add(group);

    // --- Sky / fog / lights ---
    scene.background = new THREE.Color(0x9fc7e8);
    scene.fog = new THREE.Fog(0x9fc7e8, 70, 260);

    // Hemispheric ambient light (sky/ground bounce)
    var hemi = new THREE.HemisphereLight(0xd9ecff, 0xdfcb9f, 0.9);
    scene.add(hemi);

    // Warm tropical sunlight casting soft shadows
    var sun = new THREE.DirectionalLight(0xfff5e0, 1.25);
    sun.position.set(45, 65, -25);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -75;
    sun.shadow.camera.right = 75;
    sun.shadow.camera.top = 75;
    sun.shadow.camera.bottom = -75;
    sun.shadow.camera.far = 190;
    sun.shadow.bias = -0.0005;
    scene.add(sun);

    // --- Ground: sandy beach strip + inland dirt courtyard ---
    var sand = new THREE.Mesh(
      new THREE.PlaneGeometry(280, 140),
      new THREE.MeshStandardMaterial({ color: 0xe0caa0, roughness: 0.98 })
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0, 10);
    sand.receiveShadow = true;
    group.add(sand);

    // Dirt courtyard inside the fort
    var dirt = new THREE.Mesh(
      new THREE.PlaneGeometry(42, 32),
      new THREE.MeshStandardMaterial({ color: 0xaa8e63, roughness: 0.96 })
    );
    dirt.rotation.x = -Math.PI / 2;
    dirt.position.set(0, 0.02, 24);
    dirt.receiveShadow = true;
    group.add(dirt);

    // --- Sea: Pearl River estuary (bocana de Humen) with gentle rolling waves ---
    var seaGeo = new THREE.PlaneGeometry(360, 220, 48, 32);
    var seaMat = new THREE.MeshStandardMaterial({
      color: 0x246296,
      transparent: true,
      opacity: 0.88,
      roughness: 0.25,
      metalness: 0.12,
    });
    var sea = new THREE.Mesh(seaGeo, seaMat);
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, 0.02, -145);
    sea.receiveShadow = true;
    group.add(sea);

    // Store base vertices of sea for wave animation
    var seaBasePos = null;
    if (seaGeo.attributes && seaGeo.attributes.position) {
      seaBasePos = seaGeo.attributes.position.clone();
    }

    // --- Fort: U-shaped stone wall opening toward the sea (-Z) ---
    var fort = new THREE.Group();
    fort.name = 'fort';
    fort.position.set(0, 0, 20);

    var parapetHeight = 1.3;
    var wallHeight = 4;
    var walls = [];
    var colliders = [];

    function addFortCollider(localX, localZ, angle, length, thickness, height, y, pitch) {
      colliders.push({
        x: fort.position.x + localX,
        z: fort.position.z + localZ,
        angle: angle || 0,
        length: length,
        thickness: thickness,
        height: height,
        y: y,
        pitch: pitch || 0,
      });
    }

    // North battery parapet (sea side), ~40 m wide, low enough to see/fire over
    var northWall = Models.makeFortWall(40, parapetHeight);
    northWall.position.set(0, 0, -14);
    fort.add(northWall);
    walls.push(northWall);
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

    // South wall (behind player)
    var southWall = Models.makeFortWall(40, wallHeight + 1);
    southWall.position.set(0, 0, 14);
    fort.add(southWall);
    walls.push(southWall);
    addFortCollider(0, 14, 0, 40, 1.4, wallHeight + 1);

    // West / East side walls
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

    // --- Authentic Chinese Military Watchtower (望楼) at SW corner ---
    var watchtower = (typeof Models.makeWatchtower === 'function')
      ? Models.makeWatchtower()
      : null;

    if (watchtower) {
      watchtower.position.set(-18, 0, 12);
      fort.add(watchtower);
      addFortCollider(-18, 12, 0, 4.4, 4.4, 7);
    } else {
      var towerBase = new THREE.Mesh(
        new THREE.BoxGeometry(4, 7, 4),
        new THREE.MeshStandardMaterial({ color: 0xc9a06a, roughness: 0.95 })
      );
      towerBase.position.set(-18, 3.5, 12);
      fort.add(towerBase);
      addFortCollider(-18, 12, 0, 4, 4, 7);
    }

    // --- Imperial Qing Dragon Flags (黄龙旗) on battlements ---
    var flags = [];
    if (typeof Models.makeFlagPole === 'function') {
      var flagSpots = [
        { x: -21, z: -15, h: 7 }, // NW corner horn
        { x: 21, z: -15, h: 7 },  // NE corner horn
        { x: -18, z: 12, h: 10 }, // On watchtower
      ];
      for (var f = 0; f < flagSpots.length; f++) {
        var pole = Models.makeFlagPole(flagSpots[f].h);
        pole.position.set(flagSpots[f].x, 0, flagSpots[f].z);
        fort.add(pole);
        flags.push(pole);
      }
    }

    // --- Sandbag defensive revetments on the wings ---
    if (typeof Models.makeSandbagWall === 'function') {
      var sandbags1 = Models.makeSandbagWall(4.2);
      sandbags1.position.set(-17.5, 0, -11.5);
      fort.add(sandbags1);

      var sandbags2 = Models.makeSandbagWall(4.2);
      sandbags2.position.set(17.5, 0, -11.5);
      fort.add(sandbags2);
    }

    group.add(fort);

    // --- Cannons: 4 interactive Qing cannons facing the sea with ammo & powder ---
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
      fort.add(cannon);
      cannons.push(cannon);
      addFortCollider(cannonPositions[c].x, cannonPositions[c].z - 0.4, 0, 0.8, 2.4, 1.1);

      // Stack of cannonballs to the right of each cannon
      if (typeof Models.makeCannonballStack === 'function') {
        var shotPyramid = Models.makeCannonballStack();
        shotPyramid.position.set(cannonPositions[c].x + 1.25, 0, cannonPositions[c].z + 0.6);
        fort.add(shotPyramid);
      }

      // Powder barrel to the left of each cannon
      if (typeof Models.makePowderBarrel === 'function') {
        var barrel = Models.makePowderBarrel();
        barrel.position.set(cannonPositions[c].x - 1.2, 0, cannonPositions[c].z + 0.7);
        fort.add(barrel);
      }
    }

    // --- Firing Banquettes (Banquetas de tiro tras el parapeto norte) ---
    var stepXs = [-8, 0, 8];
    for (var fi = 0; fi < stepXs.length; fi++) {
      if (typeof Models.makeFiringStep === 'function') {
        var step = Models.makeFiringStep(4.2);
        step.position.set(stepXs[fi], 0, -12.4);
        fort.add(step);
      }
      // Flat elevated deck + gentle sloped ramp so player box walks smoothly up
      addFortCollider(stepXs[fi], -12.4, 0, 4.2, 1.25, 0.38);
      addFortCollider(stepXs[fi], -11.35, 0, 4.2, 1.2, 0.16, 0.14, 0.25);
    }

    // --- Medical Aid Stations (Zonas de curación / botiquines) ---
    var medicalStations = [];
    var medSpots = [
      { x: -14.5, z: 3.5, rot: 0.35 },
      { x: 14.5, z: 3.5, rot: -0.35 },
    ];
    for (var mi = 0; mi < medSpots.length; mi++) {
      if (typeof Models.makeMedicalStation === 'function') {
        var station = Models.makeMedicalStation();
        station.position.set(medSpots[mi].x, 0, medSpots[mi].z);
        station.rotation.y = medSpots[mi].rot;
        fort.add(station);
        medicalStations.push(station);
        addFortCollider(medSpots[mi].x, medSpots[mi].z, medSpots[mi].rot, 1.5, 0.9, 0.9);
      }
    }

    // --- Bamboo Assault Ladders (appear on exterior north wall in later phases) ---
    var ladders = [];
    var ladderXs = [-13, -5, 5, 13];
    for (var li = 0; li < ladderXs.length; li++) {
      if (typeof Models.makeAssaultLadder === 'function') {
        var ladder = Models.makeAssaultLadder(2.4);
        ladder.position.set(ladderXs[li], 0, -15.05);
        ladder.rotation.x = 0.22;
        ladder.visible = false;
        fort.add(ladder);
        ladders.push(ladder);
      }
    }

    // --- Dynamic Wave Atmosphere (Day -> Sunset -> Night -> Dawn -> Storm) ---
    function setAtmosphereForWave(wave) {
      var w = wave || 1;
      var skyHex = 0x9fc7e8;
      var fogHex = 0x9fc7e8;
      var hemiSky = 0xd9ecff;
      var hemiGround = 0xdfcb9f;
      var hemiInt = 0.9;
      var sunHex = 0xfff5e0;
      var sunInt = 1.25;
      var sunPos = [45, 65, -25];

      if (w >= 4 && w <= 6) {
        // Sunset over the Pearl River estuary
        skyHex = 0xd47d58;
        fogHex = 0xc97b5b;
        hemiSky = 0xffb88c;
        hemiGround = 0x7d583c;
        hemiInt = 0.78;
        sunHex = 0xff9254;
        sunInt = 1.05;
        sunPos = [-55, 22, -40];
      } else if (w === 7) {
        // Night battle: moonlit estuary with darker fog
        skyHex = 0x162238;
        fogHex = 0x1a2942;
        hemiSky = 0x3b5885;
        hemiGround = 0x26211c;
        hemiInt = 0.55;
        sunHex = 0x9ab8e8;
        sunInt = 0.65;
        sunPos = [-30, 50, -35];
      } else if (w === 8) {
        // Broken dawn
        skyHex = 0x8fa3c7;
        fogHex = 0x9ca7c4;
        hemiSky = 0xd6d2ea;
        hemiGround = 0x8f7e66;
        hemiInt = 0.75;
        sunHex = 0xffcaa6;
        sunInt = 0.95;
        sunPos = [60, 20, -25];
      } else if (w >= 9) {
        // Stormy final assault
        skyHex = 0x627385;
        fogHex = 0x69798a;
        hemiSky = 0x9eb0c2;
        hemiGround = 0x6e604f;
        hemiInt = 0.72;
        sunHex = 0xffe4c4;
        sunInt = 0.9;
        sunPos = [35, 45, -20];
      }

      if (scene.background && scene.background.setHex) scene.background.setHex(skyHex);
      if (scene.fog && scene.fog.color && scene.fog.color.setHex) scene.fog.color.setHex(fogHex);
      if (hemi) {
        hemi.color.setHex(hemiSky);
        hemi.groundColor.setHex(hemiGround);
        hemi.intensity = hemiInt;
      }
      if (sun) {
        sun.color.setHex(sunHex);
        sun.intensity = sunInt;
        sun.position.set(sunPos[0], sunPos[1], sunPos[2]);
      }
    }

    // --- Ships: 3 British 3-masted warships anchored offshore ---
    var ships = [];
    var shipDefs = [
      { x: -32, z: -98, rot: 0.22, scale: 1.0 },
      { x: 8, z: -120, rot: -0.12, scale: 1.28 },
      { x: 42, z: -104, rot: 0.48, scale: 0.95 },
    ];
    for (var s = 0; s < shipDefs.length; s++) {
      var ship = Models.makeShip();
      ship.position.set(shipDefs[s].x, -0.4, shipDefs[s].z);
      ship.userData.baseY = -0.4;
      ship.userData.phase = s * 1.5;
      ship.rotation.y = shipDefs[s].rot;
      ship.scale.setScalar(shipDefs[s].scale);
      group.add(ship);
      ships.push(ship);
    }

    // --- Per-frame dynamic updates for world assets ---
    function update(dt, time) {
      var t = typeof time === 'number' ? time : performance.now() / 1000;

      // 1. Gentle ocean swells on the Pearl River
      if (sea && sea.geometry && seaBasePos) {
        var pos = sea.geometry.attributes.position;
        if (pos) {
          for (var i = 0; i < pos.count; i++) {
            var bx = seaBasePos.getX(i);
            var by = seaBasePos.getY(i);
            // Wave displacement along Z (which is vertical Y in world space before rotation)
            var wave = Math.sin(bx * 0.045 + t * 1.4) * Math.cos(by * 0.04 + t * 1.1) * 0.35;
            pos.setZ(i, wave);
          }
          pos.needsUpdate = true;
        }
      }

      // 2. Ships gently pitching and rolling with the sea swells
      for (var si = 0; si < ships.length; si++) {
        var sh = ships[si];
        var phase = (sh.userData.phase || 0) + t;
        sh.position.y = (sh.userData.baseY || -0.4) + Math.sin(phase * 1.2) * 0.14;
        sh.rotation.z = Math.sin(phase * 0.9) * 0.022;
        sh.rotation.x = Math.cos(phase * 0.8) * 0.018;
      }

      // 3. Flags waving in the coastal breeze
      for (var fi = 0; fi < flags.length; fi++) {
        if (flags[fi] && flags[fi].userData && typeof flags[fi].userData.update === 'function') {
          flags[fi].userData.update(t);
        }
      }

      // 4. Cannons recoil spring recovery
      for (var ci = 0; ci < cannons.length; ci++) {
        if (cannons[ci] && cannons[ci].userData && typeof cannons[ci].userData.updateRecoil === 'function') {
          cannons[ci].userData.updateRecoil(dt);
        }
      }

      // 5. Medical stations zone ring & lantern pulse
      for (var msi = 0; msi < medicalStations.length; msi++) {
        var ms = medicalStations[msi];
        if (!ms || !ms.userData) continue;
        var pulse = 0.5 + 0.5 * Math.sin(t * 2.8 + msi);
        var ready = ms.userData.isReady !== false;
        if (ms.userData.zoneRing && ms.userData.zoneRing.material) {
          ms.userData.zoneRing.material.opacity = ready ? (0.18 + 0.14 * pulse) : 0.08;
        }
        if (ms.userData.lantern && ms.userData.lantern.material) {
          ms.userData.lantern.material.emissiveIntensity = ready ? (0.55 + 0.35 * pulse) : 0.2;
        }
      }
    }

    return {
      group: group,
      fort: fort,
      walls: walls,
      sea: sea,
      ships: ships,
      cannons: cannons,
      medicalStations: medicalStations,
      ladders: ladders,
      colliders: colliders,
      update: update,
      setAtmosphereForWave: setAtmosphereForWave,
    };
  }

  return buildWorld;
})();

if (typeof module !== 'undefined') module.exports = { buildWorld: buildWorld };

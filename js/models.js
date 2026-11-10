// Low-poly model builders using THREE primitives only (no external assets).
// Browser global script exposing `Models`; optional Node guard for tooling.

var Models = (function () {
  var britishTemplate = null;
  var britishClips = null;

  function mat(color) {
    return new THREE.MeshStandardMaterial({ color: color, roughness: 0.9, metalness: 0.0 });
  }

  function box(w, h, d, color, x, y, z) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  function cyl(rTop, rBottom, h, color, x, y, z, segments) {
    var m = new THREE.Mesh(
      new THREE.CylinderGeometry(rTop, rBottom, h, segments || 10),
      mat(color)
    );
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  function sphere(r, color, x, y, z) {
    var m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), mat(color));
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  function cone(r, h, color, x, y, z) {
    var m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 12), mat(color));
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  function makeMusket() {
    var g = new THREE.Group();
    var barrel = cyl(0.03, 0.03, 1.5, 0x4a3421, 0, 0, -0.25, 8);
    barrel.rotation.x = Math.PI / 2;
    var stock = box(0.07, 0.12, 0.5, 0x6b4a2f, 0, -0.02, 0.45);
    g.add(barrel);
    g.add(stock);
    g.position.set(0.25, 1.25, 0.05);
    g.rotation.x = -0.15;
    return g;
  }

  function makeQingSoldier() {
    var g = new THREE.Group();
    // Blue robe: tapered body (cylinder) + shoulders
    g.add(cyl(0.22, 0.34, 1.05, 0x2e4a7a, 0, 0.55, 0, 12));
    g.add(box(0.5, 0.22, 0.3, 0x2e4a7a, 0, 1.08, 0));
    // Trousers / legs
    g.add(box(0.16, 0.5, 0.2, 0x1f3558, -0.12, 0.25, 0));
    g.add(box(0.16, 0.5, 0.2, 0x1f3558, 0.12, 0.25, 0));
    // Head
    g.add(sphere(0.16, 0xe8b98a, 0, 1.36, 0));
    // Conical hat: brim disc + cone
    var brim = cyl(0.42, 0.42, 0.04, 0xc2a878, 0, 1.48, 0, 14);
    var top = cone(0.26, 0.22, 0xc2a878, 0, 1.59, 0);
    g.add(brim);
    g.add(top);
    // Musket
    g.add(makeMusket());
    g.userData = { type: 'qing-soldier' };
    return g;
  }

  function fitToHeight(root, height) {
    root.updateMatrixWorld(true);
    var box = new THREE.Box3().setFromObject(root);
    var size = box.getSize(new THREE.Vector3());
    if (size.y > 1e-6) root.scale.multiplyScalar(height / size.y);
    root.updateMatrixWorld(true);
    box.setFromObject(root);
    var center = box.getCenter(new THREE.Vector3());
    root.position.x -= center.x;
    root.position.z -= center.z;
    root.position.y -= box.min.y;
    return root;
  }

  function findClip(pattern) {
    if (!britishClips) return null;
    for (var i = 0; i < britishClips.length; i++) {
      if (pattern.test(britishClips[i].name)) return britishClips[i];
    }
    return null;
  }

  function rootSpeed(clip) {
    if (!clip || !clip.duration) return 0;
    var tracks = clip.tracks || [];
    for (var i = 0; i < tracks.length; i++) {
      var track = tracks[i];
      if (track.name.indexOf('Hips') === -1 || !/\.position$/.test(track.name)) continue;
      var values = track.values;
      var min = Infinity;
      var max = -Infinity;
      for (var k = 2; k < values.length; k += 3) {
        min = Math.min(min, values[k]);
        max = Math.max(max, values[k]);
      }
      return (max - min) / clip.duration;
    }
    return 0;
  }

  // The clip advances the hips forward; the game already moves the pivot, so
  // keep only the vertical bob to avoid foot-slide + snap at loop.
  function stripRootMotion(clip) {
    var tracks = clip.tracks || [];
    for (var i = 0; i < tracks.length; i++) {
      var track = tracks[i];
      if (track.name.indexOf('Hips') === -1 || !/\.position$/.test(track.name)) continue;
      var values = track.values;
      var baseX = values[0];
      var baseZ = values[2];
      for (var k = 0; k < values.length; k += 3) {
        values[k] = baseX;
        values[k + 2] = baseZ;
      }
    }
  }

  function setSoldierAction(anim, name, fade) {
    if (!anim || anim.current === name || !anim.actions[name]) return;
    var next = anim.actions[name];
    var previous = anim.current ? anim.actions[anim.current] : null;
    next.reset();
    next.enabled = true;
    next.setEffectiveWeight(1);
    next.play();
    if (previous && previous !== next) next.crossFadeFrom(previous, fade || 0.2, false);
    anim.current = name;
  }

  function setupSoldierAnim(model) {
    if (!britishClips || !britishClips.length || typeof THREE.AnimationMixer !== 'function') return;
    var walkClip = findClip(/jogging/i) || findClip(/walking/i);
    var idleClip = findClip(/offensiveidle/i) || findClip(/idle/i);
    var deathClip = findClip(/dying|death/i);
    var mixer = new THREE.AnimationMixer(model);
    var actions = {};
    if (walkClip) actions.walk = mixer.clipAction(walkClip);
    if (idleClip) actions.idle = mixer.clipAction(idleClip);
    if (deathClip) actions.death = mixer.clipAction(deathClip);
    var current = null;
    if (actions.walk) {
      actions.walk.play();
      current = 'walk';
    } else if (actions.idle) {
      actions.idle.play();
      current = 'idle';
    }
    model.userData.anim = {
      mixer: mixer,
      actions: actions,
      current: current,
      walkSpeed: walkClip && walkClip._rootSpeed > 0.1 ? walkClip._rootSpeed : 1.67,
    };
  }

  function updateSoldierAnimation(model, dt, speed, state) {
    var anim = model && model.userData && model.userData.anim;
    if (!anim) return;
    anim.mixer.update(dt);
    var desired = speed > 0.35 ? 'walk' : 'idle';
    if (!anim.actions[desired]) desired = anim.actions.walk ? 'walk' : (anim.actions.idle ? 'idle' : null);
    if (!desired) return;
    if (desired === 'walk' && anim.actions.walk) {
      var natural = anim.walkSpeed || 1.67;
      var scale = speed > 0.1 ? speed / natural : 1;
      anim.actions.walk.setEffectiveTimeScale(Math.max(0.65, Math.min(1.8, scale)));
    }
    setSoldierAction(anim, desired, 0.18);
  }

  function stopSoldierAnimation(model) {
    var anim = model && model.userData && model.userData.anim;
    if (anim) anim.mixer.stopAllAction();
  }

  function loadBritishSoldierModel(url, onReady) {
    if (typeof THREE === 'undefined' || !THREE.GLTFLoader) return;
    var loader = new THREE.GLTFLoader();
    loader.load(url, function (gltf) {
      var root = gltf.scene;
      root.rotation.y = Math.PI; // exported model faces +Z; game forward is -Z
      fitToHeight(root, 1.92);
      britishClips = gltf.animations || [];
      for (var i = 0; i < britishClips.length; i++) {
        var clip = britishClips[i];
        clip._rootSpeed = rootSpeed(clip);
        if (/jogging|walking/i.test(clip.name)) stripRootMotion(clip);
      }
      britishTemplate = root;
      if (typeof onReady === 'function') onReady(root);
    }, undefined, function (error) {
      if (typeof console !== 'undefined') console.warn('No se pudo cargar el soldado británico GLB:', error);
    });
  }

  function hasBritishModel() {
    return !!britishTemplate;
  }

  function makeBritishSoldier() {
    if (britishTemplate && typeof THREE.SkeletonUtils !== 'undefined') {
      var model = THREE.SkeletonUtils.clone(britishTemplate);
      model.traverse(function (node) {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
          node.frustumCulled = false;
          if (node.material) node.material = node.material.clone();
        }
      });
      model.userData = { type: 'british-soldier' };
      setupSoldierAnim(model);
      var holder = new THREE.Group();
      holder.add(model);
      holder.userData = model.userData;
      return holder;
    }
    var g = new THREE.Group();
    // Red coat
    g.add(box(0.48, 1.0, 0.3, 0xb02a22, 0, 0.85, 0));
    // White trousers
    g.add(box(0.16, 0.55, 0.2, 0xe8e4da, -0.12, 0.28, 0));
    g.add(box(0.16, 0.55, 0.2, 0xe8e4da, 0.12, 0.28, 0));
    // Head
    g.add(sphere(0.16, 0xe8b98a, 0, 1.52, 0));
    // Black shako (tall cylinder) + brim
    g.add(cyl(0.16, 0.19, 0.3, 0x141414, 0, 1.75, 0, 12));
    g.add(box(0.3, 0.03, 0.2, 0x141414, 0, 1.62, -0.12));
    // Musket
    g.add(makeMusket());
    g.userData = { type: 'british-soldier' };
    return g;
  }

  function makeShip() {
    var g = new THREE.Group();
    var hullColor = 0x5a4230;
    var deckColor = 0x8a6b4a;
    // Hull: long box + bow box + forward cone wedge
    g.add(box(3.2, 1.1, 10, hullColor, 0, 0.6, 0));
    var bow = box(2.6, 1.0, 3.0, hullColor, 0, 0.55, 6.2);
    // Simple bow wedge using a scaled cone rotated forward
    var wedge = cone(1.4, 3.0, hullColor, 0, 0.6, 6.8);
    wedge.rotation.x = Math.PI / 2;
    wedge.scale.set(1, 1, 0.8);
    g.add(bow);
    g.add(wedge);
    // Deck
    g.add(box(2.8, 0.15, 9.4, deckColor, 0, 1.2, 0.4));
    // Rail strips
    g.add(box(0.15, 0.5, 9.4, hullColor, -1.5, 1.4, 0.4));
    g.add(box(0.15, 0.5, 9.4, hullColor, 1.5, 1.4, 0.4));
    // Masts (3) with white sails (thin boxes)
    var mastZs = [-3.4, 0.4, 4.2];
    var mastHs = [6.5, 8.0, 5.5];
    for (var i = 0; i < 3; i++) {
      g.add(cyl(0.07, 0.1, mastHs[i], 0x6b4a2f, 0, mastHs[i] / 2 + 1.2, mastZs[i], 8));
      var sailW = 2.2 - i * 0.25;
      var sail = box(sailW, 1.8, 0.08, 0xf2ead8, 0, mastHs[i] / 2 + 1.6, mastZs[i]);
      g.add(sail);
      var yard = cyl(0.03, 0.03, sailW + 0.6, 0x6b4a2f, 0, mastHs[i] / 2 + 2.5, mastZs[i], 6);
      yard.rotation.z = Math.PI / 2;
      g.add(yard);
    }
    // Stern cabin
    g.add(box(2.4, 0.9, 2.0, deckColor, 0, 1.7, -4.2));
    g.userData = { type: 'ship' };
    return g;
  }

  function makeFortWall(length, height) {
    var h = height || 4;
    var g = new THREE.Group();
    var thickness = 1.4;
    // Main adobe body
    g.add(box(length, h, thickness, 0xc9a06a, 0, h / 2, 0));
    // Low parapet lip: keeps the top below eye height (1.7 m) so the player
    // can see and fire over the seaward battery.
    g.add(box(length, 0.2, thickness + 0.3, 0xb98f57, 0, h + 0.1, 0));
    // Crenellations: small blocks along the top
    var n = Math.max(3, Math.floor(length / 2));
    for (var i = 0; i < n; i++) {
      var x = -length / 2 + (i + 0.5) * (length / n);
      g.add(box(0.7, 0.4, 0.5, 0xc9a06a, x, h + 0.4, 0));
    }
    g.userData = { type: 'fort-wall' };
    return g;
  }

  function makeCannon() {
    var g = new THREE.Group();
    // Carriage
    g.add(box(0.7, 0.35, 1.6, 0x5a4230, 0, 0.35, 0));
    // Barrel (points forward -Z)
    var barrel = cyl(0.14, 0.18, 2.0, 0x2b2b2b, 0, 0.75, -0.5, 12);
    barrel.rotation.x = Math.PI / 2 - 0.12;
    g.add(barrel);
    // Muzzle ring
    var muzzle = cyl(0.19, 0.19, 0.12, 0x1f1f1f, 0, 0.87, -1.42, 12);
    muzzle.rotation.x = Math.PI / 2 - 0.12;
    g.add(muzzle);
    // Wheels
    function wheel(x, z) {
      var w = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.42, 0.12, 12),
        mat(0x4a3421)
      );
      w.position.set(x, 0.42, z);
      w.rotation.z = Math.PI / 2;
      w.castShadow = true;
      return w;
    }
    g.add(wheel(-0.45, 0.4));
    g.add(wheel(0.45, 0.4));
    g.add(wheel(-0.45, -0.4));
    g.add(wheel(0.45, -0.4));
    g.userData = { type: 'cannon' };
    return g;
  }

  return {
    makeQingSoldier: makeQingSoldier,
    makeBritishSoldier: makeBritishSoldier,
    hasBritishModel: hasBritishModel,
    loadBritishSoldierModel: loadBritishSoldierModel,
    updateSoldierAnimation: updateSoldierAnimation,
    stopSoldierAnimation: stopSoldierAnimation,
    makeShip: makeShip,
    makeFortWall: makeFortWall,
    makeCannon: makeCannon,
  };
})();

if (typeof module !== 'undefined') module.exports = Models;

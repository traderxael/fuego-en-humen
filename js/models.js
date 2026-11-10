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
    // White ensign at the stern (no lights, no shadow pass).
    var ensign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.0, 0.62),
      new THREE.MeshStandardMaterial({ map: getEnsignTexture(), side: THREE.DoubleSide, roughness: 1 })
    );
    ensign.position.set(0, 3.4, -5.1);
    ensign.rotation.y = Math.PI;
    ensign.castShadow = false;
    ensign.receiveShadow = false;
    ensign.userData.type = 'ensign';
    g.add(ensign);
    g.userData = { type: 'ship' };
    return g;
  }

  function part(geometry, color, x, y, z, rx, ry, rz) {
    return { g: geometry, c: color, p: [x || 0, y || 0, z || 0], r: [rx || 0, ry || 0, rz || 0] };
  }

  function mergeParts(parts) {
    var totalVerts = 0;
    var totalIndices = 0;
    for (var i = 0; i < parts.length; i++) {
      var count = parts[i].g.attributes.position.count;
      totalVerts += count;
      totalIndices += parts[i].g.index ? parts[i].g.index.count : count;
    }
    var positions = new Float32Array(totalVerts * 3);
    var normals = new Float32Array(totalVerts * 3);
    var colors = new Float32Array(totalVerts * 3);
    var indices = new (totalVerts > 65535 ? Uint32Array : Uint16Array)(totalIndices);
    var vertexOffset = 0;
    var indexOffset = 0;
    var quaternion = new THREE.Quaternion();
    var euler = new THREE.Euler();
    var vector = new THREE.Vector3();
    var color = new THREE.Color();

    for (var p = 0; p < parts.length; p++) {
      var partDef = parts[p];
      var geometry = partDef.g;
      euler.set(partDef.r[0], partDef.r[1], partDef.r[2]);
      quaternion.setFromEuler(euler);
      color.setHex(partDef.c);
      var position = geometry.attributes.position;
      var normal = geometry.attributes.normal;
      for (var v = 0; v < position.count; v++) {
        vector.fromBufferAttribute(position, v).applyQuaternion(quaternion);
        var at = (vertexOffset + v) * 3;
        positions[at] = vector.x + partDef.p[0];
        positions[at + 1] = vector.y + partDef.p[1];
        positions[at + 2] = vector.z + partDef.p[2];
        vector.fromBufferAttribute(normal, v).applyQuaternion(quaternion);
        normals[at] = vector.x;
        normals[at + 1] = vector.y;
        normals[at + 2] = vector.z;
        colors[at] = color.r;
        colors[at + 1] = color.g;
        colors[at + 2] = color.b;
      }
      if (geometry.index) {
        for (var n = 0; n < geometry.index.count; n++) {
          indices[indexOffset + n] = geometry.index.getX(n) + vertexOffset;
        }
        indexOffset += geometry.index.count;
      } else {
        for (var q = 0; q < position.count; q++) {
          indices[indexOffset + q] = vertexOffset + q;
        }
        indexOffset += position.count;
      }
      vertexOffset += position.count;
    }

    var merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    merged.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    merged.setIndex(new THREE.BufferAttribute(indices, 1));
    merged.computeBoundingSphere();
    return merged;
  }


  // --- Historical set dressing ------------------------------------------
  // Every prop below is merged into one vertex-coloured mesh: the whole
  // squadron plus the chain adds a handful of draw calls, no lights and no
  // colliders. Colours follow the 1841 palette (tarred hulls, ochre sails).
  var NAVY = {
    hull: 0x2a2320, deck: 0x5a4432, wood: 0x6b4a2f, iron: 0x2f2f33,
    sail: 0xa89a82, junkSail: 0x8a6a44, white: 0xe8e6e0, blue: 0x1b2a5a,
    red: 0xb3202a, stone: 0xb8a07a, roof: 0x7a3a2a, thatch: 0x8a7448,
  };

  function mergedModel(parts, options) {
    var opts = options || {};
    var material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: opts.roughness === undefined ? 0.9 : opts.roughness,
      metalness: opts.metalness || 0,
    });
    var mesh = new THREE.Mesh(mergeParts(parts), material);
    mesh.castShadow = !!opts.castShadow;
    mesh.receiveShadow = true;
    mesh.userData.type = opts.type || 'prop';
    return mesh;
  }

  function pBox(w, h, d, color, x, y, z, rx, ry, rz) {
    return part(new THREE.BoxGeometry(w, h, d), color, x, y, z, rx, ry, rz);
  }

  function pCyl(rTop, rBottom, h, color, x, y, z, rx, ry, rz, segments) {
    return part(new THREE.CylinderGeometry(rTop, rBottom, h, segments || 8), color, x, y, z, rx, ry, rz);
  }

  function pCone(radius, h, color, x, y, z, rx, ry, rz, segments) {
    return part(new THREE.ConeGeometry(radius, h, segments || 4), color, x, y, z, rx, ry, rz);
  }

  // The Nemesis: iron paddle steamer, two wheels, funnel and a white ensign.
  function makeSteamer() {
    var parts = [];
    parts.push(pBox(3.6, 1.3, 12.0, NAVY.hull, 0, 0.65, 0));
    parts.push(pCone(1.6, 2.6, NAVY.hull, 0, 0.65, -6.8, -Math.PI / 2, 0, 0, 8));
    parts.push(pBox(3.2, 0.16, 11.2, NAVY.deck, 0, 1.33, 0));
    for (var side = -1; side <= 1; side += 2) {
      parts.push(pBox(0.55, 1.7, 2.4, NAVY.wood, side * 1.95, 1.2, 0.2));
      parts.push(pCyl(0.95, 0.95, 0.16, NAVY.iron, side * 2.28, 1.2, 0.2, 0, 0, Math.PI / 2, 12));
    }
    parts.push(pCyl(0.28, 0.28, 2.3, NAVY.iron, 0, 2.7, 1.1, 0, 0, 0, 8));
    parts.push(pBox(3.0, 0.9, 1.6, NAVY.wood, 0, 1.85, 3.6));
    for (var m = 0; m < 2; m++) {
      var mz = m === 0 ? -2.4 : 3.4;
      var mh = m === 0 ? 6.2 : 5.2;
      parts.push(pCyl(0.07, 0.09, mh, NAVY.wood, 0, 1.4 + mh / 2, mz, 0, 0, 0, 6));
      parts.push(pBox(2.0, 1.6, 0.06, NAVY.sail, 0, 1.6 + mh * 0.6, mz));
    }
    parts.push(pBox(1.2, 0.7, 0.06, NAVY.white, 0, 6.4, 4.9));
    parts.push(pBox(0.5, 0.3, 0.07, NAVY.blue, -0.34, 6.55, 4.86));
    return mergedModel(parts, { type: 'steamer', roughness: 0.75, metalness: 0.1 });
  }

  // War junk: battened sails (horizontal slats), stern cabin and fight pennant.
  function makeJunk() {
    var parts = [];
    parts.push(pBox(3.0, 1.1, 9.0, NAVY.wood, 0, 0.55, 0));
    parts.push(pBox(2.6, 0.16, 8.2, NAVY.deck, 0, 1.16, 0));
    parts.push(pBox(1.2, 0.8, 2.0, NAVY.wood, 0, 1.5, 2.9));
    var zs = [-2.8, 0.2, 3.2];
    var hs = [5.6, 6.6, 5.0];
    for (var m = 0; m < 3; m++) {
      parts.push(pCyl(0.08, 0.1, hs[m], NAVY.wood, 0, 1.2 + hs[m] / 2, zs[m], 0, 0, 0, 6));
      for (var b = 0; b < 5; b++) {
        parts.push(pBox(2.7, 0.42, 0.06, NAVY.junkSail, 0, 2.3 + b * 0.6, zs[m] - 0.12));
      }
    }
    parts.push(pBox(0.1, 1.6, 0.5, NAVY.red, 0, 8.1, 4.6));
    return mergedModel(parts, { type: 'junk', roughness: 0.95 });
  }

  // The Bogue boom: chain cables over wooden rafts, laid across the strait.
  function makeChainBoom() {
    var parts = [];
    for (var i = 0; i < 11; i++) {
      var x = -30 + i * 6;
      parts.push(pBox(6.2, 0.18, 0.18, NAVY.iron, x + 3, 0.55, 0));
      if (i % 2 === 0) {
        parts.push(pBox(2.6, 0.5, 2.2, NAVY.wood, x + 3, 0.25, 1.4));
        parts.push(pBox(0.5, 1.2, 0.5, NAVY.wood, x + 3, 0.8, 2.2));
      }
    }
    return mergedModel(parts, { type: 'chain-boom', roughness: 0.6, metalness: 0.5 });
  }

  // Fire raft: a burning hulk that drifts toward the squadron.
  function makeFireRaft() {
    var parts = [];
    parts.push(pBox(2.4, 0.35, 3.4, NAVY.wood, 0, 0.18, 0));
    parts.push(pBox(0.6, 0.3, 3.0, NAVY.wood, -0.7, 0.4, 0));
    parts.push(pBox(0.6, 0.3, 3.0, NAVY.wood, 0.7, 0.4, 0));
    parts.push(pBox(1.2, 0.8, 1.2, NAVY.thatch, 0, 0.9, 0.4));
    var raft = mergedModel(parts, { type: 'fire-raft', roughness: 0.95 });
    var ember = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 8, 6),
      new THREE.MeshStandardMaterial({
        color: 0xff7a2a, emissive: 0xff5a10, emissiveIntensity: 1.6, roughness: 0.6,
      })
    );
    ember.position.set(0, 1.5, 0.2);
    ember.castShadow = false;
    ember.userData.type = 'fire-raft-ember';
    raft.add(ember);
    raft.userData.ember = ember;
    return raft;
  }

  // Fishing village and pagodas on the shore, far from the walls.
  function makeVillage() {
    var parts = [];
    for (var p = 0; p < 2; p++) {
      var px = p * 7 - 3;
      for (var t = 0; t < 3; t++) {
        var w = 4.2 - t * 1.1;
        parts.push(pBox(w, 1.6, w, NAVY.stone, px, 0.8 + t * 1.8, 0));
        parts.push(pCone(w * 0.85, 0.9, NAVY.roof, px, 1.7 + t * 1.8, 0, 0, 0, 0, 4));
      }
      parts.push(pCone(0.7, 1.4, NAVY.roof, px, 6.6, 0, 0, 0, 0, 6));
    }
    for (var h = 0; h < 6; h++) {
      var hx = -8 + h * 3.2;
      var hz = 5 + (h % 2) * 2.4;
      parts.push(pBox(2.2, 1.4, 2.0, NAVY.stone, hx, 0.7, hz));
      parts.push(pCone(1.7, 0.8, NAVY.thatch, hx, 1.8, hz, 0, 0, 0, 4));
    }
    return mergedModel(parts, { type: 'village', roughness: 0.95 });
  }

  // Wall gun (jingal) on a wooden pintle: the fort's secondary armament.
  function makeJingal() {
    var parts = [];
    parts.push(pBox(0.16, 0.46, 0.16, NAVY.wood, 0, 0.23, 0.18));
    parts.push(pBox(0.46, 0.08, 0.34, NAVY.wood, 0, 0.48, 0.16));
    parts.push(pCyl(0.04, 0.055, 1.7, NAVY.iron, 0, 0.6, -0.68, Math.PI / 2, 0, 0, 8));
    parts.push(pBox(0.12, 0.12, 0.42, NAVY.wood, 0, 0.6, 0.06));
    return mergedModel(parts, { type: 'jingal', roughness: 0.8, metalness: 0.3 });
  }

  // Rattan shield of the Qing braves: a lacquered disc with an iron boss.
  function makeRattanShield() {
    var parts = [];
    parts.push(pCyl(0.34, 0.34, 0.05, 0x9a7444, 0, 0, 0, Math.PI / 2, 0, 0, 14));
    parts.push(pCyl(0.36, 0.36, 0.02, 0x6b4a2f, 0, 0, 0.03, Math.PI / 2, 0, 0, 14));
    parts.push(pBox(0.14, 0.14, 0.06, 0x3a3a3d, 0, 0, 0.05));
    return mergedModel(parts, { type: 'rattan-shield', roughness: 0.95 });
  }

  // Congreve rocket rack: the battery that set the junks alight.

  // --- Fort wall facade --------------------------------------------------
  // One 256px stone canvas tiled every 3.2 m, one cached geometry per box
  // size (with UVs scaled by metres so courses never stretch), and a single
  // shared material set: the six walls cost no extra uploads.
  var STONE_TILE = 3.6;
  var stoneTexture = null;
  var wallMats = null;
  var wallGeoCache = {};

  function getStoneTexture() {
    if (stoneTexture) return stoneTexture;
    var size = 256;
    var c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    var g = c.getContext('2d');
    // Deep mortar bed; blocks sit on top with a visible 3px joint.
    g.fillStyle = '#7a5738';
    g.fillRect(0, 0, size, size);
    var seed = 1841;
    function rnd() {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    }
    var rowH = 32;
    for (var row = 0; row * rowH < size; row++) {
      var y = row * rowH;
      var x = -((row % 2) * 30) - 12;
      while (x < size) {
        var w = 34 + rnd() * 34;
        var tone = 0.74 + rnd() * 0.38;
        g.fillStyle = 'rgb(' + Math.round(198 * tone) + ',' +
          Math.round(166 * tone) + ',' + Math.round(122 * tone) + ')';
        g.fillRect(x + 3, y + 3, w - 4, rowH - 4);
        // Chipped corner on some blocks.
        if (rnd() > 0.8) {
          g.fillStyle = 'rgba(104, 80, 54, 0.55)';
          g.fillRect(x + 3, y + 3, 7, 6);
        }
        x += w;
      }
    }
    g.strokeStyle = 'rgba(92, 66, 42, 0.85)';
    g.lineWidth = 3;
    for (var line = 0; line <= size; line += rowH) {
      g.beginPath();
      g.moveTo(0, line);
      g.lineTo(size, line);
      g.stroke();
    }
    g.fillStyle = 'rgba(80, 62, 44, 0.2)';
    for (var i = 0; i < 520; i++) {
      g.fillRect(Math.floor(rnd() * size), Math.floor(rnd() * size), 2 + (i % 2), 2);
    }
    stoneTexture = new THREE.CanvasTexture(c);
    stoneTexture.wrapS = THREE.RepeatWrapping;
    stoneTexture.wrapT = THREE.RepeatWrapping;
    stoneTexture.needsUpdate = true;
    return stoneTexture;
  }

  function wallMaterials() {
    if (wallMats) return wallMats;
    var tex = getStoneTexture();
    wallMats = {
      stone: new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff, roughness: 0.95 }),
      stoneDark: new THREE.MeshStandardMaterial({ map: tex, color: 0xc2b19a, roughness: 0.98 }),
      stoneTrim: new THREE.MeshStandardMaterial({ map: tex, color: 0xe8d9bf, roughness: 0.9 }),
      wood: new THREE.MeshStandardMaterial({ color: 0x6b4630, roughness: 0.85 }),
      iron: new THREE.MeshStandardMaterial({ color: 0x3a3a3d, roughness: 0.6, metalness: 0.55 }),
      banner: new THREE.MeshStandardMaterial({
        map: getFlagTexture(),
        side: THREE.DoubleSide,
        roughness: 1,
        metalness: 0,
      }),
    };
    return wallMats;
  }

  // BoxGeometry lays faces in +X, -X, +Y, -Y, +Z, -Z order; each face's
  // natural size drives its UV span so a 40 m wall shows 12 stone tiles.
  function wallGeometry(w, h, d) {
    var key = w + '|' + h + '|' + d;
    if (wallGeoCache[key]) return wallGeoCache[key];
    var geo = new THREE.BoxGeometry(w, h, d);
    var uv = geo.attributes.uv;
    var spansU = [d, d, w, w, w, w];
    var spansV = [h, h, d, d, h, h];
    for (var face = 0; face < 6; face++) {
      for (var i = 0; i < 4; i++) {
        var v = face * 4 + i;
        uv.setXY(v, uv.getX(v) * spansU[face] / STONE_TILE, uv.getY(v) * spansV[face] / STONE_TILE);
      }
    }
    uv.needsUpdate = true;
    wallGeoCache[key] = geo;
    return geo;
  }

  function wallBox(parent, role, w, h, d, x, y, z, material, flat) {
    var mesh = new THREE.Mesh(wallGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = !flat;
    mesh.receiveShadow = true;
    mesh.userData.wallRole = role;
    parent.add(mesh);
    return mesh;
  }

  function addMerlons(parent, length, height, material) {
    var margin = 1.4;
    var usable = length - margin * 2;
    var count = Math.max(2, Math.floor(usable / 1.9));
    var step = usable / count;
    var base = height + 0.26;
    for (var i = 0; i < count; i++) {
      var x = -usable / 2 + (i + 0.5) * step;
      wallBox(parent, 'merlon', 0.9, 0.4, 0.7, x, base + 0.2, 0, material, true);
    }
  }

  function addBanners(parent, length, height, face, mats) {
    for (var side = -1; side <= 1; side += 2) {
      var x = side * length / 4;
      var pole = wallBox(parent, 'banner-pole', 1.95, 0.06, 0.06,
        x, height * 0.72 + 0.55, face * 0.74, mats.iron, true);
      pole.castShadow = false;
      var cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.05), mats.banner);
      cloth.position.set(x, height * 0.72, face * 0.74);
      cloth.rotation.y = face > 0 ? 0 : Math.PI;
      cloth.castShadow = false;
      cloth.receiveShadow = false;
      cloth.userData.wallRole = 'banner';
      parent.add(cloth);
    }
  }

  function addGate(parent, face, mats) {
    // The portal wraps the wall thickness so it reads from both faces; the
    // leaves sit proud of the inner face, never buried inside the body.
    for (var side = -1; side <= 1; side += 2) {
      wallBox(parent, 'gate-jamb', 0.85, 3.5, 1.96, side * 2.2, 1.75, 0, mats.stoneDark);
      wallBox(parent, 'gate-leaf', 1.7, 3.4, 0.14, side * 0.86, 1.7, face * 0.78, mats.wood, true);
      for (var band = 0; band < 2; band++) {
        wallBox(parent, 'gate-band', 1.7, 0.14, 0.2,
          side * 0.86, 0.95 + band * 1.5, face * 0.87, mats.iron, true);
      }
    }
    wallBox(parent, 'gate-lintel', 4.7, 0.8, 1.96, 0, 3.9, 0, mats.stoneDark);
    wallBox(parent, 'gate-cornice', 5.0, 0.16, 2.12, 0, 4.38, 0, mats.stoneTrim, true);
    wallBox(parent, 'gate-sill', 3.6, 0.12, 0.7, 0, 0.06, face * 0.86, mats.stoneDark, true);
    wallBox(parent, 'gate-band', 3.4, 0.1, 0.12, 0, 1.5, face * 0.9, mats.iron, true);
    wallBox(parent, 'gate-plaque', 2.9, 0.5, 0.12, 0, 4.76, face * 0.75, mats.wood, true);
  }

  function addProvisions(parent, face, mats) {
    var barrelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.92, 12);
    var hoopGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.1, 12);
    for (var i = 0; i < 2; i++) {
      var x = 5.2 + i * 1.15;
      var barrel = new THREE.Mesh(barrelGeo, mats.wood);
      barrel.position.set(x, 0.46, face * 1.35);
      barrel.castShadow = false;
      barrel.receiveShadow = true;
      barrel.userData.wallRole = 'barrel';
      parent.add(barrel);
      for (var h = 0; h < 2; h++) {
        var hoop = new THREE.Mesh(hoopGeo, mats.iron);
        hoop.position.set(x, 0.24 + h * 0.44, face * 1.35);
        hoop.castShadow = false;
        hoop.userData.wallRole = 'barrel-hoop';
        parent.add(hoop);
      }
    }
    wallBox(parent, 'crate', 0.9, 0.9, 0.9, 7.75, 0.45, face * 1.35, mats.wood, true);
    wallBox(parent, 'crate', 0.68, 0.62, 0.68, 7.85, 1.21, face * 1.35, mats.stoneDark, true);
  }

  function makeFortWall(length, height, options) {
    var opts = options || {};
    var kind = opts.kind || 'side';
    var h = height || 4;
    var face = opts.face === -1 ? -1 : 1;
    var thickness = 1.4;
    var mats = wallMaterials();
    var g = new THREE.Group();
    g.userData = { type: 'fort-wall', kind: kind };

    // Battered footing, main body, walkway lip and coping.
    wallBox(g, 'plinth', length, 0.5, thickness + 0.3, 0, 0.25, 0, mats.stoneDark);
    wallBox(g, 'body', length, h, thickness, 0, h / 2, 0, mats.stone);
    wallBox(g, 'walk', length, 0.14, thickness + 0.12, 0, h + 0.07, 0, mats.stone, true);
    wallBox(g, 'coping', length, 0.12, thickness + 0.3, 0, h + 0.2, 0, mats.stoneTrim);

    // End bastions hide the seams where two walls meet.
    var bastionH = kind === 'parapet' ? h + 0.1 : h + 0.5;
    for (var side = -1; side <= 1; side += 2) {
      var x = side * (length / 2 - 0.8);
      wallBox(g, 'bastion', 1.6, bastionH, thickness + 0.5, x, bastionH / 2, 0, mats.stone);
      wallBox(g, 'bastion-cap', 1.8, 0.1, thickness + 0.7, x, bastionH + 0.05, 0, mats.stoneTrim, true);
    }

    // The seaward parapet stays clear: no merlons above the firing line.
    if (kind !== 'parapet') addMerlons(g, length, h, mats.stone);

    if (kind === 'landward') {
      if (opts.gate) addGate(g, face, mats);
      addProvisions(g, face, mats);
    }
    if (kind === 'landward' || kind === 'side') addBanners(g, length, h, face, mats);

    return g;
  }

  function makeTower(size, height) {
    var mats = wallMaterials();
    var g = new THREE.Group();
    var s = size || 4;
    var h = height || 7;
    wallBox(g, 'tower-plinth', s + 0.4, 0.6, s + 0.4, 0, 0.3, 0, mats.stoneDark);
    wallBox(g, 'tower-base', s, h, s, 0, h / 2, 0, mats.stone);
    wallBox(g, 'tower-cornice', s + 0.5, 0.22, s + 0.5, 0, h + 0.11, 0, mats.stoneTrim);
    g.userData = { type: 'fort-tower' };
    return g;
  }

  // Unit banners: no national flag existed in 1841, so the garrison flies
  // yellow standards with a character (勇, "brave") and a red border.
  var bannerTextures = {};
  function getBannerTexture(char) {
    var glyph = char || '勇';
    if (bannerTextures[glyph]) return bannerTextures[glyph];
    var c = document.createElement('canvas');
    c.width = 64; c.height = 40;
    var g = c.getContext('2d');
    g.fillStyle = '#d8b52a';
    g.fillRect(0, 0, 64, 40);
    g.strokeStyle = '#8f2a1f';
    g.lineWidth = 4;
    g.strokeRect(2, 2, 60, 36);
    g.fillStyle = '#1f2a44';
    if (typeof g.fillText === 'function') {
      g.font = 'bold 26px "Microsoft YaHei", "Noto Sans SC", sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(glyph, 32, 21);
    } else {
      g.fillRect(22, 10, 20, 20);
    }
    var texture = new THREE.CanvasTexture(c);
    texture.needsUpdate = true;
    bannerTextures[glyph] = texture;
    return texture;
  }

  function getFlagTexture() {
    return getBannerTexture('勇');
  }

  // White ensign with a simplified Union canton, flown by the squadron.
  var ensignTexture = null;
  function getEnsignTexture() {
    if (ensignTexture) return ensignTexture;
    var c = document.createElement('canvas');
    c.width = 48; c.height = 30;
    var g = c.getContext('2d');
    g.fillStyle = '#e8e6e0';
    g.fillRect(0, 0, 48, 30);
    g.fillStyle = '#1b2a5a';
    g.fillRect(0, 0, 20, 13);
    g.strokeStyle = '#e8e6e0';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, 0); g.lineTo(20, 13);
    g.moveTo(20, 0); g.lineTo(0, 13);
    g.stroke();
    g.strokeStyle = '#b3202a';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(0, 0); g.lineTo(20, 13);
    g.moveTo(20, 0); g.lineTo(0, 13);
    g.stroke();
    ensignTexture = new THREE.CanvasTexture(c);
    ensignTexture.needsUpdate = true;
    return ensignTexture;
  }

  function makeFlag() {
    var g = new THREE.Group();
    g.add(cyl(0.04, 0.05, 3.2, 0x6b4a2f, 0, 1.6, 0, 8));
    var cloth = new THREE.Mesh(
      new THREE.PlaneGeometry(1.7, 1.05, 8, 4),
      new THREE.MeshStandardMaterial({
        map: getFlagTexture(),
        side: THREE.DoubleSide,
        roughness: 1,
        metalness: 0,
      })
    );
    // Left edge meets the pole; the free edge waves in world.update().
    cloth.position.set(0.88, 2.55, 0);
    cloth.castShadow = false;
    cloth.receiveShadow = false;
    g.add(cloth);
    g.userData = { type: 'flag', cloth: cloth };
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
    makeSteamer: makeSteamer,
    makeJunk: makeJunk,
    makeChainBoom: makeChainBoom,
    makeFireRaft: makeFireRaft,
    makeVillage: makeVillage,
    makeJingal: makeJingal,
    makeRattanShield: makeRattanShield,
    makeTower: makeTower,
    getBannerTexture: getBannerTexture,
    getFlagTexture: getFlagTexture,
    getEnsignTexture: getEnsignTexture,
    makeFlag: makeFlag,
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

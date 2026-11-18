// 3D staging for the cinematics: Blender-crafted historical GLB landmarks
// combined with rigged soldiers, fleet vessels, smoke and gunfire effects.
//
// Each builder returns { group, update(t, dt), dispose() } and is dropped
// into the main scene for the length of a shot. Cached GLB scenes are cloned
// per shot and tagged `userData.sharedAsset = true` so dispose() leaves shared
// WebGL geometries/materials intact for instant replay.
//
// Browser global `Scenes`; also guarded for Node tooling consistency.

var Scenes = (function () {
  var MODEL_URLS = {
    opium: 'assets/models/cinematics/humen-1839-opium.glb',
    squadron: 'assets/models/cinematics/humen-squadron-bogue.glb',
    assault: 'assets/models/cinematics/humen-assault-breach.glb',
    fall: 'assets/models/cinematics/humen-fall-memorial.glb',
  };

  var modelCache = {};
  var pendingCallbacks = {};

  function mat(color, opts) {
    opts = opts || {};
    return new THREE.MeshStandardMaterial({
      color: color,
      roughness: opts.roughness != null ? opts.roughness : 0.9,
      metalness: opts.metalness != null ? opts.metalness : 0.0,
      flatShading: opts.flat !== false,
      transparent: !!opts.transparent,
      opacity: opts.opacity != null ? opts.opacity : 1,
      emissive: opts.emissive || 0x000000,
    });
  }

  function box(w, h, d, color, x, y, z, opts) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  function plane(w, h, color, x, y, z, opts) {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat(color, opts));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x || 0, y || 0, z || 0);
    m.receiveShadow = true;
    return m;
  }

  function markSharedSubtree(root) {
    if (!root || !root.traverse) return;
    root.traverse(function (node) {
      node.userData = node.userData || {};
      node.userData.sharedAsset = true;
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
  }

  function indexNodesByName(root) {
    var map = {};
    if (!root || !root.traverse) return map;
    root.traverse(function (node) {
      if (node.name && !map[node.name]) map[node.name] = node;
    });
    return map;
  }

  function registerModel(key, root) {
    if (!key || !root) return null;
    markSharedSubtree(root);
    modelCache[key] = root;
    return root;
  }

  function hasModel(key) {
    return !!modelCache[key];
  }

  function loadCinematicModel(key, url, onDone) {
    var cb = typeof url === 'function' ? url : onDone;
    var resolvedUrl = (typeof url === 'string' && url) ? url : MODEL_URLS[key];

    if (modelCache[key]) {
      if (typeof cb === 'function') cb(modelCache[key]);
      return true;
    }

    if (typeof THREE === 'undefined' || typeof THREE.GLTFLoader !== 'function' || typeof window === 'undefined' || !resolvedUrl) {
      if (typeof cb === 'function') cb(null);
      return false;
    }

    if (pendingCallbacks[key]) {
      if (typeof cb === 'function') pendingCallbacks[key].push(cb);
      return true;
    }

    pendingCallbacks[key] = typeof cb === 'function' ? [cb] : [];
    var loader = new THREE.GLTFLoader();
    loader.load(
      resolvedUrl,
      function (gltf) {
        var root = gltf && gltf.scene ? gltf.scene : null;
        if (root) registerModel(key, root);
        var list = pendingCallbacks[key] || [];
        delete pendingCallbacks[key];
        for (var i = 0; i < list.length; i++) list[i](root);
      },
      undefined,
      function (err) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('No se pudo cargar el modelo cinemático GLB (' + key + '):', err);
        }
        var list = pendingCallbacks[key] || [];
        delete pendingCallbacks[key];
        for (var i = 0; i < list.length; i++) list[i](null);
      }
    );
    return true;
  }

  function preloadModels(onAllDone) {
    var keys = Object.keys(MODEL_URLS);
    if (!keys.length) {
      if (typeof onAllDone === 'function') onAllDone(modelCache);
      return;
    }
    var remaining = keys.length;
    function step() {
      remaining--;
      if (remaining <= 0 && typeof onAllDone === 'function') onAllDone(modelCache);
    }
    for (var i = 0; i < keys.length; i++) {
      loadCinematicModel(keys[i], MODEL_URLS[keys[i]], step);
    }
  }

  function mountBlenderSet(key, targetGroup, transform, onMounted) {
    var holder = { mounted: false, root: null, nodes: {}, base: {} };
    var disposed = false;

    function attach(template) {
      if (disposed || !template || !targetGroup) return;
      var clone = template.clone(true);
      markSharedSubtree(clone);
      if (transform) {
        if (transform.pos) clone.position.set(transform.pos[0], transform.pos[1], transform.pos[2]);
        if (transform.rotY != null) clone.rotation.y = transform.rotY;
        if (transform.scale != null) clone.scale.setScalar(transform.scale);
      }
      targetGroup.add(clone);
      holder.mounted = true;
      holder.root = clone;
      holder.nodes = indexNodesByName(clone);
      Object.keys(holder.nodes).forEach(function (n) {
        var obj = holder.nodes[n];
        holder.base[n] = {
          px: obj.position.x,
          py: obj.position.y,
          pz: obj.position.z,
          rx: obj.rotation.x,
          ry: obj.rotation.y,
          rz: obj.rotation.z,
        };
      });
      if (typeof onMounted === 'function') onMounted(holder);
    }

    if (modelCache[key]) {
      attach(modelCache[key]);
    } else {
      loadCinematicModel(key, MODEL_URLS[key], function (tpl) {
        if (tpl) attach(tpl);
      });
    }

    holder.cancel = function () { disposed = true; };
    return holder;
  }

  // A soldier posed with the procedural rig (or rigged Hyper3D GLB for walk/idle).
  function figure(variant, clipName, t) {
    var wantGlb = (clipName === 'walk' || clipName === 'idle' || !clipName) &&
      variant !== 'officer' &&
      typeof Models !== 'undefined' &&
      Models &&
      typeof Models.hasBritishModel === 'function' &&
      Models.hasBritishModel() &&
      typeof Models.makeBritishSoldier === 'function';

    if (wantGlb) {
      var glbSoldier = Models.makeBritishSoldier();
      markSharedSubtree(glbSoldier);
      var moveSpeed = clipName === 'walk' ? 1.8 : 0.0;
      if (typeof Models.updateSoldierAnimation === 'function') {
        Models.updateSoldierAnimation(glbSoldier, t || 0, moveSpeed, clipName || 'idle');
      }
      glbSoldier.userData.glbUpdate = function (dt, speed, state) {
        if (typeof Models.updateSoldierAnimation === 'function') {
          Models.updateSoldierAnimation(glbSoldier, dt, speed != null ? speed : moveSpeed, state || clipName || 'idle');
        }
      };
      return { group: glbSoldier, isGlb: true };
    }

    var rig = Rig.buildSoldier({ faction: 'british', variant: variant });
    var anim = new RigAnim.Animator(rig);
    var clip = clipName === 'aim' ? RigAnim.Clips.aim()
      : clipName === 'walk' ? RigAnim.Clips.walk(1)
      : clipName === 'kneel' ? RigAnim.Clips.kneel()
      : RigAnim.Clips.idle();
    anim.play(clip);
    anim.time = t || 0;
    anim.update(0);
    rig.group.userData.animator = anim;
    return rig;
  }

  function qingFigure(t, clipName) {
    var rig = Rig.buildSoldier({ faction: 'qing' });
    var anim = new RigAnim.Animator(rig);
    var clip = clipName === 'aim' ? RigAnim.Clips.aim()
      : clipName === 'walk' ? RigAnim.Clips.walk(1)
      : RigAnim.Clips.idle();
    anim.play(clip);
    anim.time = t || 0;
    anim.update(0);
    rig.group.userData.animator = anim;
    return rig;
  }

  function updateFigure(fig, dt, speed, state) {
    if (!fig || !fig.group || !fig.group.userData) return;
    if (typeof fig.group.userData.glbUpdate === 'function') {
      fig.group.userData.glbUpdate(dt, speed, state);
    } else if (fig.group.userData.animator) {
      fig.group.userData.animator.update(dt);
    }
  }

  function disposeNode(node) {
    if (!node) return;
    if (node.userData && node.userData.sharedAsset) return;
    if (node.geometry && node.geometry.dispose) node.geometry.dispose();
    if (node.material) {
      var list = Array.isArray(node.material) ? node.material : [node.material];
      for (var i = 0; i < list.length; i++) {
        if (list[i] && list[i].dispose) list[i].dispose();
      }
    }
    var children = node.children || [];
    for (var c = 0; c < children.length; c++) {
      disposeNode(children[c]);
    }
  }

  function disposeGroup(group) {
    if (!group) return;
    disposeNode(group);
    if (group.parent) group.parent.remove(group);
  }

  // --- Set 1: Humen beach, 3 June 1839, the destruction of the opium -----
  function opiumDestruction(ctx) {
    var group = new THREE.Group();
    group.name = 'scene-opium-1839';

    group.add(plane(180, 180, 0xd9c391, 0, 0, 0, { roughness: 1 }));
    var sea = plane(240, 160, 0x265d88, 0, 0.03, -84, { roughness: 0.35, transparent: true, opacity: 0.92 });
    group.add(sea);
    group.add(box(180, 0.45, 4, 0xcdb37e, 0, 0.22, -26));

    // Procedural fallback shown only until the Blender GLB mounts.
    var fallback = new THREE.Group();
    group.add(fallback);
    var crates = [];
    for (var r = 0; r < 3; r++) {
      for (var c = 0; c < 6; c++) {
        var crate = box(1.5, 0.9, 1.1, 0x6b4a2f, -7.5 + c * 3, 0.45, -14 + r * 2.4);
        fallback.add(crate);
        crates.push(crate);
      }
    }
    var lumps = [];
    for (var l = 0; l < 10; l++) {
      var lump = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 8, 6),
        mat(0x4a3a24, { roughness: 0.95 })
      );
      lump.position.set(-8 + (l % 5) * 4, 0.5, -12 + Math.floor(l / 5) * 3);
      lump.castShadow = true;
      fallback.add(lump);
      lumps.push(lump);
    }

    // Mount Blender 3D set (Pavilion, LinZexu, OpiumPit, SluiceGate, LimeWater, OpiumChests, OpiumBalls, Paddles).
    var blenderSet = mountBlenderSet('opium', group, null, function () {
      fallback.visible = false;
    });

    // Qing officials and pit workers around the trench.
    var officials = [];
    var spots = [
      { x: -1.8, y: 0.78, z: -5.2 },
      { x: 1.8, y: 0.78, z: -5.2 },
      { x: -9.5, y: 0, z: -10.5 },
      { x: 9.5, y: 0, z: -10.5 },
    ];
    for (var i = 0; i < spots.length; i++) {
      var f = qingFigure(i * 0.7);
      f.group.position.set(spots[i].x, spots[i].y, spots[i].z);
      f.group.rotation.y = Math.PI;
      group.add(f.group);
      officials.push(f);
    }
    var soldiers = [];
    for (var s = 0; s < 5; s++) {
      var sf = qingFigure(s * 0.5);
      sf.group.position.set(-10 + s * 5, 0, -2.5);
      sf.group.rotation.y = Math.PI;
      group.add(sf.group);
      soldiers.push(sf);
    }

    // British merchant hulks waiting offshore.
    var hulks = [];
    for (var h = 0; h < 3; h++) {
      var ship = Models.makeShip();
      ship.position.set(-18 + h * 18, -0.4, -60 - h * 7);
      ship.rotation.y = 0.1 * h;
      ship.scale.setScalar(1.1);
      group.add(ship);
      hulks.push(ship);
    }

    var smokeTick = 0;
    return {
      group: group,
      blenderSet: blenderSet,
      update: function (t, dt) {
        var pour = Math.max(0, Math.min(1, (t - 1.2) / 5));
        sea.position.y = 0.03 + Math.sin(t * 1.4) * 0.04;

        if (blenderSet.mounted) {
          var nodes = blenderSet.nodes;
          var base = blenderSet.base;
          if (nodes.LimeWater && base.LimeWater) {
            nodes.LimeWater.position.y = base.LimeWater.py + Math.sin(t * 2.4) * 0.045;
          }
          if (nodes.OpiumBalls && base.OpiumBalls) {
            nodes.OpiumBalls.position.y = base.OpiumBalls.py - pour * 0.44;
            nodes.OpiumBalls.scale.set(1, Math.max(0.14, 1 - pour * 0.86), 1);
          }
          if (nodes.Paddles && base.Paddles) {
            nodes.Paddles.rotation.x = base.Paddles.rx + Math.sin(t * 3.1) * 0.12;
          }
          if (nodes.SluiceGate && base.SluiceGate) {
            var lift = Math.max(0, Math.min(1, (t - 2.4) / 3.5));
            nodes.SluiceGate.position.y = base.SluiceGate.py + lift * 0.72;
          }
          if (nodes.LinZexu && base.LinZexu) {
            nodes.LinZexu.rotation.y = base.LinZexu.ry + Math.sin(t * 0.6) * 0.06;
          }
        } else {
          for (var i = 0; i < lumps.length; i++) {
            var lp = lumps[i];
            var k = Math.max(0, Math.min(1, (t - 1.5 - i * 0.22) / 2.2));
            lp.position.x += Math.sin(i * 2.7) * 0.012;
            lp.position.z -= k * k * 9;
            lp.position.y = 0.5 - k * k * 1.1;
            lp.scale.setScalar(Math.max(0.05, 1 - k * 0.8));
          }
          for (var c = 0; c < crates.length; c++) {
            crates[c].rotation.y = Math.max(0, Math.min(0.5, (t - 1 - c * 0.08) * 0.05));
          }
        }

        if (ctx && ctx.effects && typeof ctx.effects.smoke === 'function' && t > smokeTick + 0.55) {
          smokeTick = t;
          ctx.effects.smoke({ x: -3 + Math.sin(t * 1.7) * 4, y: 0.9, z: -13.5 + Math.cos(t) * 2 });
        }

        for (var o = 0; o < officials.length; o++) updateFigure(officials[o], dt);
        for (var g = 0; g < soldiers.length; g++) updateFigure(soldiers[g], dt);
        for (var hh = 0; hh < hulks.length; hh++) {
          hulks[hh].position.y = -0.4 + Math.sin(t * 0.6 + hh) * 0.12;
        }
      },
      dispose: function () {
        blenderSet.cancel();
        disposeGroup(group);
      },
    };
  }

  // --- Set 2: the British squadron enters the strait, 23 February 1841 -----
  function squadronApproach(ctx) {
    var group = new THREE.Group();
    group.name = 'scene-squadron';

    var water = plane(360, 360, 0x265985, 0, 0, 0, { roughness: 0.34, transparent: true, opacity: 0.95 });
    group.add(water);
    // Pearl River banks & defensive earthworks.
    group.add(box(120, 3, 60, 0xb89968, 0, -1, 48));
    group.add(box(120, 3, 60, 0xb89968, 0, -1, -78));
    var fortSpots = [
      { x: -16, z: 26 }, { x: 14, z: 26 },
    ];
    for (var f = 0; f < fortSpots.length; f++) {
      var wall = Models.makeFortWall(16, 3.2);
      wall.position.set(fortSpots[f].x, 0, fortSpots[f].z);
      wall.rotation.y = Math.PI;
      group.add(wall);
      var gun = Models.makeCannon();
      gun.position.set(fortSpots[f].x, 0, fortSpots[f].z - 2);
      group.add(gun);
    }

    // Procedural fallback fleet hidden once Blender set mounts.
    var fallback = new THREE.Group();
    group.add(fallback);
    if (typeof Models.makeSteamer === 'function') {
      var st = Models.makeSteamer();
      st.position.set(0, -0.4, -40);
      fallback.add(st);
    }
    if (typeof Models.makeJunk === 'function') {
      var jk = Models.makeJunk();
      jk.position.set(14, -0.3, -28);
      fallback.add(jk);
    }
    if (typeof Models.makeChainBoom === 'function') {
      var boom = Models.makeChainBoom();
      boom.position.set(0, 0, -31);
      fallback.add(boom);
    }

    // Mount Blender 3D set (Nemesis, Wheel_L, Wheel_R, Funnel, WarJunk, IronChainBoom, AnunghoyBattery).
    var blenderSet = mountBlenderSet('squadron', group, null, function () {
      fallback.visible = false;
    });

    // Flanking wooden Royal Navy ships & Qing fire raft.
    var ships = [];
    var defs = [
      { x: -16, z: -56, rot: 0.14, s: 1.1 },
      { x: 18, z: -64, rot: -0.1, s: 1.2 },
      { x: -8, z: -78, rot: 0.06, s: 1.0 },
    ];
    for (var i = 0; i < defs.length; i++) {
      var ship = Models.makeShip();
      ship.position.set(defs[i].x, -0.6, defs[i].z);
      ship.rotation.y = defs[i].rot;
      ship.scale.setScalar(defs[i].s);
      group.add(ship);
      ships.push({ mesh: ship, def: defs[i] });
    }
    var fireRaft = typeof Models.makeFireRaft === 'function' ? Models.makeFireRaft() : null;
    if (fireRaft) {
      fireRaft.position.set(-7, 0.05, -26);
      group.add(fireRaft);
    }

    var cannonTick = 0;
    var steamTick = 0;
    return {
      group: group,
      blenderSet: blenderSet,
      update: function (t, dt) {
        water.position.y = Math.sin(t * 1.1) * 0.05;

        if (blenderSet.mounted) {
          var nodes = blenderSet.nodes;
          var base = blenderSet.base;
          if (nodes.Nemesis && base.Nemesis) {
            nodes.Nemesis.position.z = base.Nemesis.pz + t * 1.1;
            nodes.Nemesis.position.y = base.Nemesis.py - 0.35 + Math.sin(t * 1.3) * 0.12;
            nodes.Nemesis.rotation.z = base.Nemesis.rz + Math.sin(t * 1.1) * 0.025;
            if (ctx && ctx.effects && typeof ctx.effects.smoke === 'function' && t > steamTick + 0.32) {
              steamTick = t;
              ctx.effects.smoke({
                x: nodes.Nemesis.position.x,
                y: 8.2,
                z: nodes.Nemesis.position.z - 0.2,
              });
            }
          }
          if (nodes.Wheel_L) nodes.Wheel_L.rotation.x -= dt * 4.5;
          if (nodes.Wheel_R) nodes.Wheel_R.rotation.x -= dt * 4.5;
          if (nodes.WarJunk && base.WarJunk) {
            nodes.WarJunk.position.y = base.WarJunk.py - 0.25 + Math.sin(t * 1.2 + 1.0) * 0.14;
            nodes.WarJunk.rotation.z = base.WarJunk.rz + Math.sin(t * 0.9) * 0.03;
          }
          if (nodes.IronChainBoom && base.IronChainBoom) {
            nodes.IronChainBoom.rotation.z = base.IronChainBoom.rz + Math.sin(t * 1.5) * 0.008;
          }
        }

        for (var i = 0; i < ships.length; i++) {
          var s = ships[i];
          s.mesh.position.z += dt * 1.3;
          s.mesh.position.y = -0.6 + Math.sin(t * 0.9 + i) * 0.12;
          s.mesh.rotation.z = Math.sin(t * 0.7 + i) * 0.02;
        }
        if (fireRaft) {
          fireRaft.position.y = 0.05 + Math.sin(t * 1.8) * 0.07;
          fireRaft.rotation.y += dt * 0.08;
        }

        if (ctx && ctx.effects && t > cannonTick + 1.45) {
          cannonTick = t;
          var flashZ = blenderSet.mounted && blenderSet.nodes.Nemesis
            ? blenderSet.nodes.Nemesis.position.z + 6
            : -34;
          ctx.effects.muzzleFlash(
            { x: -1.5, y: 2.2, z: flashZ },
            { x: -0.3, y: 0.15, z: 1.0 },
            { big: true }
          );
        }
      },
      dispose: function () {
        blenderSet.cancel();
        disposeGroup(group);
      },
    };
  }

  // --- Set 3: the assault on the rear wall, 26 February 1841 -------------
  function rearAssault(ctx) {
    var group = new THREE.Group();
    group.name = 'scene-assault';

    group.add(plane(220, 220, 0xd2bb8a, 0, 0, 0, { roughness: 1 }));
    // Flanking side wall so the bastion corner encloses the shot.
    var sideWall = Models.makeFortWall(28, 4.2);
    sideWall.position.set(-20, 0, 12);
    sideWall.rotation.y = Math.PI / 2;
    group.add(sideWall);
    if (typeof Models.makeSandbagWall === 'function') {
      var bags = Models.makeSandbagWall(5);
      bags.position.set(0, 0, 4.8);
      group.add(bags);
    }

    // Procedural fallback wall + ladders hidden once Blender breach GLB mounts.
    var fallback = new THREE.Group();
    group.add(fallback);
    var wall = Models.makeFortWall(40, 4.2);
    fallback.add(wall);

    var ladderSpots = [-7.2, -3.6, 6.4];
    for (var l = 0; l < ladderSpots.length; l++) {
      var lad = new THREE.Group();
      for (var r = 0; r < 2; r++) {
        lad.add(box(0.09, 5.8, 0.09, 0x6b4a2f, r === 0 ? -0.32 : 0.32, 2.9, 0));
      }
      for (var s = 0; s < 10; s++) {
        lad.add(box(0.72, 0.07, 0.07, 0x5a3d26, 0, 0.45 + s * 0.52, 0));
      }
      lad.position.set(ladderSpots[l], 0, 2.2);
      lad.rotation.x = -0.24;
      fallback.add(lad);
    }

    // Mount Blender 3D set (BreachedBastion, Gate_L, Gate_R, SiegeLadders, GuanTianpei, Saber, ImperialSeal, AdmiralCannon).
    var blenderSet = mountBlenderSet('assault', group, null, function () {
      fallback.visible = false;
    });

    // Storming British column (rigged GLB attackers + officers).
    var climbers = [];
    for (var i = 0; i < 10; i++) {
      var variant = i === 0 ? 'officer' : (i % 3 === 0 ? 'marine' : 'british');
      var f = figure(variant, 'walk', i * 0.3);
      var lane = ladderSpots[i % ladderSpots.length] + ((i % 2) - 0.5) * 0.55;
      f.group.position.set(lane, 0, 4.8 + (i % 3) * 0.9);
      f.group.rotation.y = Math.PI;
      group.add(f.group);
      climbers.push({ rig: f, lane: lane, laneZ: f.group.position.z, phase: i * 0.6 });
    }

    // Qing garrison holding the rampart alongside Admiral Guan Tianpei.
    var defenders = [];
    for (var d = 0; d < 6; d++) {
      var dx = d < 3 ? -12 + d * 3.8 : 4.2 + (d - 3) * 3.8;
      var q = qingFigure(d * 0.6, d % 2 === 0 ? 'aim' : 'idle');
      q.group.position.set(dx, 4.2, -1.0);
      q.group.rotation.y = 0;
      group.add(q.group);
      defenders.push(q);
    }

    // Bombardment smoke rolling behind the parapet.
    var puffs = [];
    for (var p = 0; p < 10; p++) {
      var puff = new THREE.Mesh(
        new THREE.SphereGeometry(0.65 + (p % 3) * 0.2, 7, 5),
        mat(0x4a4a4a, { roughness: 1, transparent: true, opacity: 0.5 })
      );
      puff.position.set(-16 + p * 3.6, 4.4 + (p % 3), -3.5 - (p % 2) * 1.5);
      group.add(puff);
      puffs.push({ mesh: puff, vx: ((p % 2) - 0.5) * 0.45, vy: 0.45 + (p % 3) * 0.15, life: p * 0.6 });
    }

    var blew = 0;
    return {
      group: group,
      blenderSet: blenderSet,
      update: function (t, dt) {
        if (blenderSet.mounted) {
          var nodes = blenderSet.nodes;
          var base = blenderSet.base;
          if (nodes.Saber && base.Saber) {
            nodes.Saber.rotation.x = base.Saber.rx - 0.18 + Math.sin(t * 2.8) * 0.18;
          }
          if (nodes.GuanTianpei && base.GuanTianpei) {
            nodes.GuanTianpei.rotation.y = base.GuanTianpei.ry + Math.sin(t * 1.1) * 0.08;
          }
          if (nodes.Gate_L && base.Gate_L) {
            nodes.Gate_L.rotation.z = base.Gate_L.rz + Math.sin(t * 7.5) * 0.025;
          }
          if (nodes.Gate_R && base.Gate_R) {
            nodes.Gate_R.rotation.z = base.Gate_R.rz - Math.sin(t * 7.5 + 1.0) * 0.025;
          }
        }

        for (var i = 0; i < climbers.length; i++) {
          var c = climbers[i];
          var k = Math.max(0, Math.min(1, (t - i * 0.35) / 5));
          c.rig.group.position.z = c.laneZ - k * 2.6;
          c.rig.group.position.y = k * 2.35;
          updateFigure(c.rig, dt * (0.6 + k), 1.9, 'walk');
        }
        for (var d = 0; d < defenders.length; d++) {
          updateFigure(defenders[d], dt);
        }
        for (var p = 0; p < puffs.length; p++) {
          var pf = puffs[p];
          pf.life += dt;
          pf.mesh.position.x += pf.vx * dt;
          pf.mesh.position.y += pf.vy * dt;
          pf.mesh.scale.multiplyScalar(1 + dt * 0.32);
          if (pf.life > 7) {
            pf.life = 0;
            pf.mesh.position.set(-16 + p * 3.6, 4.2 + (p % 3) * 0.7, -3.2 - (p % 2) * 1.4);
            pf.mesh.scale.setScalar(0.65);
          }
          pf.mesh.material.opacity = Math.max(0, 0.5 - pf.life * 0.05);
        }
        if (ctx && ctx.effects && t > blew + 1.4) {
          blew = t;
          ctx.effects.explosion({
            x: -14 + ((t * 7) % 28),
            y: 4.5 + Math.sin(t) * 0.8,
            z: -1.5,
          });
        }
      },
      dispose: function () {
        blenderSet.cancel();
        disposeGroup(group);
      },
    };
  }

  // --- Set 4: the fort taken, 26 February 1841, afternoon -----------------
  function theFall(ctx) {
    var group = new THREE.Group();
    group.name = 'scene-fall';

    group.add(plane(240, 240, 0xc4a174, 0, 0, 0, { roughness: 1 }));
    group.add(plane(240, 140, 0x265985, 0, -0.05, -88, { roughness: 0.35, transparent: true, opacity: 0.94 }));
    var wall = Models.makeFortWall(40, 4.2);
    group.add(wall);
    var wall2 = Models.makeFortWall(26, 4.2);
    wall2.position.set(-22, 0, 12);
    wall2.rotation.y = Math.PI / 2;
    group.add(wall2);

    // Fallback cannons + flag shown only until Blender memorial set mounts.
    var fallback = new THREE.Group();
    group.add(fallback);
    for (var g = 0; g < 4; g++) {
      var gun = Models.makeCannon();
      gun.position.set(-12 + g * 8, 0, 8 + (g % 2) * 2);
      gun.rotation.y = Math.PI * 0.5 + g * 0.2;
      fallback.add(gun);
    }
    var flagFallback = box(0.08, 2.2, 3.2, 0x9c2b25, -3, 5.2, -0.5);
    fallback.add(flagFallback);
    fallback.add(box(0.12, 3.4, 0.12, 0x4a3421, -3, 5.4, -2.0));

    // Mount Blender 3D set (HumenBell, BellFrame, BellBody, CapturedArtillery, FallenStandard, UnionFlagPole, FlagCloth).
    var blenderSet = mountBlenderSet('fall', group, null, function () {
      fallback.visible = false;
    });

    // HMS Blenheim & Nemesis offshore firing the minute-gun salute.
    var ships = [];
    for (var s = 0; s < 2; s++) {
      var ship = Models.makeShip();
      ship.position.set(-22 + s * 40, -0.6, -58 - s * 14);
      ship.scale.setScalar(1.2);
      group.add(ship);
      ships.push(ship);
    }

    // Occupying British soldiers along the captured parapet.
    var holders = [];
    for (var h = 0; h < 7; h++) {
      var f = figure(h % 2 ? 'marine' : 'british', 'idle', h * 0.4);
      f.group.position.set(-15 + h * 5, 4.2, -0.8);
      group.add(f.group);
      holders.push(f);
    }

    var salute = 0;
    return {
      group: group,
      blenderSet: blenderSet,
      update: function (t, dt) {
        if (blenderSet.mounted) {
          var nodes = blenderSet.nodes;
          var base = blenderSet.base;
          if (nodes.BellBody && base.BellBody) {
            nodes.BellBody.rotation.z = base.BellBody.rz + Math.sin(t * 1.7) * 0.08;
          }
          if (nodes.FlagCloth && base.FlagCloth) {
            nodes.FlagCloth.rotation.y = base.FlagCloth.ry + Math.sin(t * 4.2) * 0.10;
            nodes.FlagCloth.rotation.z = base.FlagCloth.rz + Math.cos(t * 3.1) * 0.03;
          }
        } else {
          flagFallback.rotation.z = Math.sin(t * 1.6) * 0.06;
        }

        for (var i = 0; i < holders.length; i++) {
          updateFigure(holders[i], dt, 0, 'idle');
        }
        for (var s2 = 0; s2 < ships.length; s2++) {
          ships[s2].position.y = -0.6 + Math.sin(t * 0.8 + s2) * 0.1;
        }
        if (ctx && ctx.effects && t > salute + 1.25) {
          salute = t;
          ctx.effects.muzzleFlash(
            { x: ships[0].position.x, y: 2.2, z: ships[0].position.z + 8 },
            { x: 0, y: 0.1, z: 1 },
            { big: true }
          );
        }
      },
      dispose: function () {
        blenderSet.cancel();
        disposeGroup(group);
      },
    };
  }

  return {
    MODEL_URLS: MODEL_URLS,
    preloadModels: preloadModels,
    loadCinematicModel: loadCinematicModel,
    registerModel: registerModel,
    hasModel: hasModel,
    opiumDestruction: opiumDestruction,
    squadronApproach: squadronApproach,
    rearAssault: rearAssault,
    theFall: theFall,
    figure: figure,
    qingFigure: qingFigure,
  };
})();

if (typeof module !== 'undefined') module.exports = Scenes;

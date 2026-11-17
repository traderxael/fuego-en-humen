// Low-poly & enhanced model builders using THREE primitives and procedural textures.
// Browser global script exposing `Models`; guarded for Node tooling and test suites.

var Models = (function () {
  var britishTemplate = null;
  var britishClips = null;

  // Cached materials and procedural textures (created lazily in browser).
  var textures = {};
  var materials = {};

  function isBrowser() {
    return typeof document !== 'undefined' && typeof window !== 'undefined';
  }

  function getProceduralTexture(key, width, height, drawFn, repX, repY) {
    if (!isBrowser()) return null;
    if (textures[key]) return textures[key];
    try {
      var canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      var ctx = canvas.getContext('2d');
      drawFn(ctx, width, height);
      var tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(repX || 1, repY || 1);
      textures[key] = tex;
      return tex;
    } catch (e) {
      return null;
    }
  }

  // 1. Stone wall masonry texture: warm granite / adobe with mortar joints & weathering.
  function getStoneWallMaterial(repX, repY) {
    var key = 'stone_' + (repX || 1) + '_' + (repY || 1);
    if (materials[key]) return materials[key];

    var tex = getProceduralTexture('stone_tex', 512, 512, function (ctx, w, h) {
      // Base sandstone tone
      ctx.fillStyle = '#bda072';
      ctx.fillRect(0, 0, w, h);

      // Noise grain
      var imgData = ctx.getImageData(0, 0, w, h);
      var d = imgData.data;
      for (var p = 0; p < d.length; p += 4) {
        var n = (Math.random() - 0.5) * 28;
        d[p] = Math.min(255, Math.max(0, d[p] + n));
        d[p + 1] = Math.min(255, Math.max(0, d[p + 1] + n));
        d[p + 2] = Math.min(255, Math.max(0, d[p + 2] + n));
      }
      ctx.putImageData(imgData, 0, 0);

      // Masonry stone blocks in staggered courses
      var rows = 8;
      var rowH = h / rows;
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#5a4631';

      for (var r = 0; r <= rows; r++) {
        var y = r * rowH;
        // Horizontal mortar lines
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();

        if (r < rows) {
          var cols = 5;
          var colW = w / cols;
          var offset = (r % 2) * (colW * 0.5);
          for (var c = -1; c <= cols + 1; c++) {
            var x = c * colW + offset;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + rowH);
            ctx.stroke();

            // Subtle shade inside random blocks
            if ((r + c) % 3 === 0) {
              ctx.fillStyle = 'rgba(70, 50, 30, 0.08)';
              ctx.fillRect(x + 2, y + 2, colW - 4, rowH - 4);
            } else if ((r + c) % 4 === 0) {
              ctx.fillStyle = 'rgba(255, 240, 200, 0.08)';
              ctx.fillRect(x + 2, y + 2, colW - 4, rowH - 4);
            }
          }
        }
      }

      // Weathering gradient at bottom
      var grad = ctx.createLinearGradient(0, h * 0.6, 0, h);
      grad.addColorStop(0, 'rgba(60, 45, 25, 0)');
      grad.addColorStop(1, 'rgba(50, 40, 20, 0.35)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, h * 0.6, w, h * 0.4);
    }, repX, repY);

    var m = new THREE.MeshStandardMaterial({
      color: 0xc4a170,
      map: tex || null,
      roughness: 0.9,
      metalness: 0.05,
    });
    materials[key] = m;
    return m;
  }

  // 2. Wood material: oak / teak with longitudinal grain and plank seams.
  function getWoodMaterial(dark, repX, repY) {
    var key = (dark ? 'wood_dark_' : 'wood_') + (repX || 1) + '_' + (repY || 1);
    if (materials[key]) return materials[key];

    var baseColor = dark ? '#432918' : '#6f4e37';
    var tex = getProceduralTexture(key + '_tex', 256, 256, function (ctx, w, h) {
      ctx.fillStyle = baseColor;
      ctx.fillRect(0, 0, w, h);

      // Fine grain streaks
      ctx.fillStyle = dark ? 'rgba(25, 14, 8, 0.4)' : 'rgba(40, 24, 14, 0.35)';
      for (var i = 0; i < 40; i++) {
        var x = Math.random() * w;
        var width = 1 + Math.random() * 2.5;
        ctx.fillRect(x, 0, width, h);
      }

      // Plank separation seams
      ctx.strokeStyle = dark ? '#201209' : '#331d10';
      ctx.lineWidth = 3;
      var planks = 6;
      for (var p = 0; p <= planks; p++) {
        var px = p * (w / planks);
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, h);
        ctx.stroke();

        // Nail dots
        ctx.fillStyle = '#1c1c1c';
        for (var ny = 20; ny < h; ny += 60) {
          ctx.beginPath();
          ctx.arc(px + 6, ny, 2, 0, Math.PI * 2);
          ctx.arc(px + (w / planks) - 6, ny, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }, repX, repY);

    var m = new THREE.MeshStandardMaterial({
      color: dark ? 0x4a3220 : 0x735034,
      map: tex || null,
      roughness: 0.78,
      metalness: 0.04,
    });
    materials[key] = m;
    return m;
  }

  // 3. Antique bronze patina material for Chinese imperial cannons.
  function getBronzeMaterial() {
    if (materials.bronze) return materials.bronze;
    var tex = getProceduralTexture('bronze_tex', 256, 256, function (ctx, w, h) {
      // Warm aged bronze base
      ctx.fillStyle = '#7a6039';
      ctx.fillRect(0, 0, w, h);

      // Verdigris oxidation in streaks
      ctx.fillStyle = 'rgba(54, 98, 80, 0.32)';
      for (var i = 0; i < 24; i++) {
        var y = Math.random() * h;
        var ht = 8 + Math.random() * 22;
        ctx.fillRect(0, y, w, ht);
      }
      // Stippling
      for (var s = 0; s < 120; s++) {
        ctx.fillStyle = 'rgba(78, 136, 110, 0.4)';
        ctx.beginPath();
        ctx.arc(Math.random() * w, Math.random() * h, 1.5 + Math.random() * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    var m = new THREE.MeshStandardMaterial({
      color: 0x8b6c3e,
      map: tex || null,
      roughness: 0.42,
      metalness: 0.75,
    });
    materials.bronze = m;
    return m;
  }

  // 4. Forged cast-iron material.
  function getIronMaterial() {
    if (materials.iron) return materials.iron;
    var m = new THREE.MeshStandardMaterial({
      color: 0x272729,
      roughness: 0.48,
      metalness: 0.82,
    });
    materials.iron = m;
    return m;
  }

  // 5. Imperial Qing Yellow Dragon Banner (黄龙旗) texture.
  function getQingFlagTexture() {
    return getProceduralTexture('qing_flag', 512, 320, function (ctx, w, h) {
      // Imperial golden yellow background
      ctx.fillStyle = '#f39c12';
      ctx.fillRect(0, 0, w, h);

      // Flame border (triangular jagged teeth in crimson along top, bottom and right edges)
      ctx.fillStyle = '#c0392b';
      var toothSize = 24;
      // Top border
      for (var x = 0; x < w; x += toothSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + toothSize * 0.5, toothSize);
        ctx.lineTo(x + toothSize, 0);
        ctx.fill();
      }
      // Bottom border
      for (var bx = 0; bx < w; bx += toothSize) {
        ctx.beginPath();
        ctx.moveTo(bx, h);
        ctx.lineTo(bx + toothSize * 0.5, h - toothSize);
        ctx.lineTo(bx + toothSize, h);
        ctx.fill();
      }
      // Right border
      for (var ry = 0; ry < h; ry += toothSize) {
        ctx.beginPath();
        ctx.moveTo(w, ry);
        ctx.lineTo(w - toothSize, ry + toothSize * 0.5);
        ctx.lineTo(w, ry + toothSize);
        ctx.fill();
      }

      // Azure dragon body (coiling Chinese serpentine dragon)
      ctx.strokeStyle = '#1b3f73';
      ctx.lineWidth = 18;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(110, 180);
      ctx.bezierCurveTo(160, 80, 260, 90, 310, 150);
      ctx.bezierCurveTo(360, 210, 270, 260, 200, 220);
      ctx.bezierCurveTo(140, 180, 170, 120, 230, 130);
      ctx.stroke();

      // Dragon spine scales
      ctx.fillStyle = '#e67e22';
      for (var s = 0; s < 12; s++) {
        var sx = 140 + s * 16;
        var sy = 135 + Math.sin(s * 0.8) * 40;
        ctx.beginPath();
        ctx.arc(sx, sy, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Dragon head
      ctx.fillStyle = '#1b3f73';
      ctx.beginPath();
      ctx.ellipse(330, 140, 24, 18, 0.3, 0, Math.PI * 2);
      ctx.fill();
      // Antlers / horns
      ctx.strokeStyle = '#f1c40f';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(330, 125);
      ctx.lineTo(345, 95);
      ctx.moveTo(320, 126);
      ctx.lineTo(315, 100);
      ctx.stroke();
      // White eye & fangs
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(336, 134, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(337, 134, 2, 0, Math.PI * 2);
      ctx.fill();

      // Flaming Pearl of Wisdom (宝珠)
      ctx.fillStyle = '#e74c3c';
      ctx.beginPath();
      ctx.arc(390, 135, 16, 0, Math.PI * 2);
      ctx.fill();
      // Flames around pearl
      ctx.fillStyle = '#f1c40f';
      for (var f = 0; f < 5; f++) {
        var fa = (f / 5) * Math.PI * 2;
        var fx = 390 + Math.cos(fa) * 22;
        var fy = 135 + Math.sin(fa) * 22;
        ctx.beginPath();
        ctx.arc(fx, fy, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  // 6. Sandbag burlap weave material.
  function getSandbagMaterial() {
    if (materials.sandbag) return materials.sandbag;
    var tex = getProceduralTexture('sandbag_tex', 256, 256, function (ctx, w, h) {
      ctx.fillStyle = '#b79769';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(70, 50, 30, 0.25)';
      for (var y = 0; y < h; y += 4) {
        ctx.fillRect(0, y, w, 1);
      }
      for (var x = 0; x < w; x += 4) {
        ctx.fillRect(x, 0, 1, h);
      }
      ctx.strokeStyle = '#4e3820';
      ctx.lineWidth = 3;
      ctx.strokeRect(4, 4, w - 8, h - 8);
    });
    var m = new THREE.MeshStandardMaterial({
      color: 0xb5976b,
      map: tex || null,
      roughness: 0.95,
      metalness: 0.02,
    });
    materials.sandbag = m;
    return m;
  }

  function mat(color, roughness, metalness) {
    return new THREE.MeshStandardMaterial({
      color: color,
      roughness: typeof roughness === 'number' ? roughness : 0.9,
      metalness: typeof metalness === 'number' ? metalness : 0.0,
    });
  }

  function box(w, h, d, colorOrMat, x, y, z) {
    var m = typeof colorOrMat === 'object' && colorOrMat.isMaterial
      ? colorOrMat
      : mat(colorOrMat);
    var mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x || 0, y || 0, z || 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  function cyl(rTop, rBottom, h, colorOrMat, x, y, z, segments) {
    var m = typeof colorOrMat === 'object' && colorOrMat.isMaterial
      ? colorOrMat
      : mat(colorOrMat);
    var mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(rTop, rBottom, h, segments || 12),
      m
    );
    mesh.position.set(x || 0, y || 0, z || 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  function sphere(r, colorOrMat, x, y, z) {
    var m = typeof colorOrMat === 'object' && colorOrMat.isMaterial
      ? colorOrMat
      : mat(colorOrMat);
    var mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 12), m);
    mesh.position.set(x || 0, y || 0, z || 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  function cone(r, h, colorOrMat, x, y, z, segments) {
    var m = typeof colorOrMat === 'object' && colorOrMat.isMaterial
      ? colorOrMat
      : mat(colorOrMat);
    var mesh = new THREE.Mesh(new THREE.ConeGeometry(r, h, segments || 14), m);
    mesh.position.set(x || 0, y || 0, z || 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  // --- Upgraded Musket Model ---
  function makeMusket() {
    var g = new THREE.Group();
    var ironMat = getIronMaterial();
    var woodMat = getWoodMaterial(true);
    var brassMat = mat(0xc9a84a, 0.45, 0.65);

    // Long barrel
    var barrel = cyl(0.024, 0.028, 1.55, ironMat, 0, 0, -0.28, 10);
    barrel.rotation.x = Math.PI / 2;
    g.add(barrel);

    // Muzzle ring
    var muzzleBand = cyl(0.03, 0.03, 0.04, brassMat, 0, 0, -1.04, 10);
    muzzleBand.rotation.x = Math.PI / 2;
    g.add(muzzleBand);

    // Middle barrel band
    var midBand = cyl(0.032, 0.032, 0.03, brassMat, 0, 0, -0.45, 10);
    midBand.rotation.x = Math.PI / 2;
    g.add(midBand);

    // Wooden stock with cheek comb
    var stock = box(0.065, 0.11, 0.52, woodMat, 0, -0.02, 0.46);
    g.add(stock);

    // Fore-end wooden stock under barrel
    var foreStock = box(0.05, 0.045, 0.9, woodMat, 0, -0.02, -0.22);
    g.add(foreStock);

    // Ramrod (baqueta de hierro bajo el cañón)
    var ramrod = cyl(0.008, 0.008, 1.35, ironMat, 0, -0.045, -0.32, 6);
    ramrod.rotation.x = Math.PI / 2;
    g.add(ramrod);

    // Flintlock / lockplate assembly on right side
    var lockPlate = box(0.015, 0.045, 0.12, ironMat, 0.036, 0.01, 0.15);
    g.add(lockPlate);
    var hammer = box(0.012, 0.055, 0.02, ironMat, 0.038, 0.045, 0.12);
    hammer.rotation.x = -0.3;
    g.add(hammer);

    // Brass trigger guard
    var guard = box(0.018, 0.035, 0.08, brassMat, 0, -0.07, 0.28);
    g.add(guard);

    g.position.set(0.25, 1.25, 0.05);
    g.rotation.x = -0.15;
    return g;
  }

  // --- Upgraded Qing Defender Soldier ---
  // Authentic Green Standard / Eight Banners coastal defender (1841)
  function makeQingSoldier() {
    var g = new THREE.Group();
    var blueSilk = mat(0x1e3a68, 0.82, 0.05);
    var redTrim = mat(0xa82824, 0.8, 0.05);
    var darkNavy = mat(0x13233f, 0.9, 0.02);
    var skin = mat(0xe5b88a, 0.85, 0.0);
    var strawHat = mat(0xd6be8a, 0.92, 0.0);
    var redTassel = mat(0xbd2424, 0.95, 0.0);
    var brassKnob = mat(0xd4af37, 0.4, 0.7);

    // Torso: flared traditional robe (Magua)
    g.add(cyl(0.23, 0.35, 1.08, blueSilk, 0, 0.56, 0, 14));
    g.add(box(0.52, 0.24, 0.32, blueSilk, 0, 1.1, 0));

    // Circular chest insignia patch (补子) displaying bravery "勇"
    var patchBorder = cyl(0.14, 0.14, 0.02, redTrim, 0, 0.92, 0.165, 16);
    patchBorder.rotation.x = Math.PI / 2;
    g.add(patchBorder);
    var patchCenter = cyl(0.11, 0.11, 0.022, mat(0xf4f1ea, 0.9, 0), 0, 0.92, 0.166, 16);
    patchCenter.rotation.x = Math.PI / 2;
    g.add(patchCenter);
    // Dark character mark
    var patchMark = box(0.07, 0.07, 0.025, mat(0x111111, 0.9, 0), 0, 0.92, 0.168);
    g.add(patchMark);

    // Trousers & boots
    g.add(box(0.16, 0.52, 0.22, darkNavy, -0.13, 0.26, 0));
    g.add(box(0.16, 0.52, 0.22, darkNavy, 0.13, 0.26, 0));
    // Black boots with thick white soles
    g.add(box(0.17, 0.18, 0.26, mat(0x1a1a1a, 0.7, 0.1), -0.13, 0.09, 0.02));
    g.add(box(0.17, 0.18, 0.26, mat(0x1a1a1a, 0.7, 0.1), 0.13, 0.09, 0.02));
    g.add(box(0.175, 0.04, 0.27, mat(0xf0eee8, 0.9, 0), -0.13, 0.02, 0.02));
    g.add(box(0.175, 0.04, 0.27, mat(0xf0eee8, 0.9, 0), 0.13, 0.02, 0.02));

    // Head and neck
    g.add(cyl(0.09, 0.1, 0.14, skin, 0, 1.25, 0, 10));
    g.add(sphere(0.16, skin, 0, 1.39, 0));

    // Traditional Qing conical summer hat (红缨凉帽)
    var hatBrim = cyl(0.44, 0.44, 0.035, strawHat, 0, 1.5, 0, 18);
    var hatCone = cone(0.28, 0.24, strawHat, 0, 1.62, 0, 18);
    var tassel = cone(0.16, 0.28, redTassel, 0, 1.66, 0, 16);
    var finial = sphere(0.045, brassKnob, 0, 1.78, 0);
    g.add(hatBrim);
    g.add(hatCone);
    g.add(tassel);
    g.add(finial);

    // Waist sash with scabbard & saber (柳叶刀 Liuyedao)
    var sash = box(0.5, 0.08, 0.33, mat(0xd4af37, 0.8, 0.1), 0, 0.68, 0);
    g.add(sash);
    var scabbard = box(0.045, 0.72, 0.08, mat(0x2d1810, 0.7, 0.1), -0.28, 0.52, 0);
    scabbard.rotation.z = -0.25;
    g.add(scabbard);
    var guard = cyl(0.055, 0.055, 0.02, brassKnob, -0.22, 0.86, 0, 10);
    g.add(guard);

    // Musket
    g.add(makeMusket());
    g.userData = { type: 'qing-soldier' };
    return g;
  }

  function fitToHeight(root, height) {
    root.updateMatrixWorld(true);
    var b = new THREE.Box3().setFromObject(root);
    var size = b.getSize(new THREE.Vector3());
    if (size.y > 1e-6) root.scale.multiplyScalar(height / size.y);
    root.updateMatrixWorld(true);
    b.setFromObject(root);
    var center = b.getCenter(new THREE.Vector3());
    root.position.x -= center.x;
    root.position.z -= center.z;
    root.position.y -= b.min.y;
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
    if (anim) {
      anim.mixer.update(dt);
      if (!anim.dying) {
        var desired = speed > 0.35 ? 'walk' : 'idle';
        if (!anim.actions[desired]) desired = anim.actions.walk ? 'walk' : (anim.actions.idle ? 'idle' : null);
        if (desired) {
          if (desired === 'walk' && anim.actions.walk) {
            var natural = anim.walkSpeed || 1.67;
            var scale = speed > 0.1 ? speed / natural : 1;
            anim.actions.walk.setEffectiveTimeScale(Math.max(0.65, Math.min(1.8, scale)));
          }
          setSoldierAction(anim, desired, 0.18);
        }
      }
    }
    var w = model && model.userData && model.userData.attachedWeapon;
    if (w && (!anim || !anim.dying)) {
      var targetX = state === 'shoot' ? 0 : (state === 'melee' ? 0.25 : 0.72);
      var targetZ = state === 'melee' ? -0.24 : 0.03;
      w.rotation.x += (targetX - w.rotation.x) * Math.min(1, dt * 10);
      w.position.z += (targetZ - w.position.z) * Math.min(1, dt * 10);
    }
  }

  function playSoldierDeath(model) {
    var anim = model && model.userData && model.userData.anim;
    if (!anim) return false;
    anim.dying = true;
    var death = anim.actions && anim.actions.death;
    if (!death) {
      anim.mixer.stopAllAction();
      return false;
    }
    if (typeof THREE.LoopOnce !== 'undefined') death.setLoop(THREE.LoopOnce, 1);
    death.clampWhenFinished = true;
    death.reset();
    death.enabled = true;
    death.setEffectiveWeight(1);
    death.play();
    var previous = anim.current ? anim.actions[anim.current] : null;
    if (previous && previous !== death) death.crossFadeFrom(previous, 0.15, false);
    anim.current = 'death';
    return true;
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
      root.rotation.y = Math.PI;
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
    // White crossbelts (bandolera cruzada)
    g.add(box(0.5, 0.9, 0.31, 0xf0efe8, 0, 0.85, 0));
    // White trousers
    g.add(box(0.16, 0.55, 0.2, 0xe8e4da, -0.12, 0.28, 0));
    g.add(box(0.16, 0.55, 0.2, 0xe8e4da, 0.12, 0.28, 0));
    // Head
    g.add(sphere(0.16, 0xe8b98a, 0, 1.52, 0));
    // Black Belgic shako with plate & peak
    g.add(cyl(0.16, 0.19, 0.3, 0x141414, 0, 1.75, 0, 12));
    g.add(box(0.3, 0.03, 0.2, 0x141414, 0, 1.62, -0.12));
    // Shako brass plate & white plume
    g.add(box(0.08, 0.08, 0.02, 0xd4af37, 0, 1.76, -0.18));
    g.add(cyl(0.025, 0.025, 0.14, 0xf5f5f5, 0, 1.94, -0.12, 8));
    // Musket
    g.add(makeMusket());
    g.userData = { type: 'british-soldier' };
    return g;
  }

  // --- Upgraded 3-Masted British Warship of the Line / Frigate ---
  // Realistic Nelson-checker hull, bowsprit, tiered masts, yards, billowing sails, flags.
  function makeShip() {
    var g = new THREE.Group();
    var hullWood = getWoodMaterial(true, 4, 1);
    var deckWood = getWoodMaterial(false, 3, 2);
    var mastWood = getWoodMaterial(true);
    var whiteStripe = mat(0xe5e1d5, 0.7, 0.05);
    var blackStripe = mat(0x1a1a1a, 0.75, 0.1);
    var sailMat = mat(0xf3eee1, 0.9, 0.0);
    var redInside = mat(0x8a2420, 0.8, 0.05);

    // Main lower hull
    var hull = box(3.4, 1.4, 13.5, hullWood, 0, 0.7, 0);
    g.add(hull);

    // Curved bow cutwater
    var bow = box(2.8, 1.4, 4.0, hullWood, 0, 0.75, 8.2);
    g.add(bow);
    var cutwater = box(0.3, 1.6, 3.2, blackStripe, 0, 0.8, 9.8);
    cutwater.rotation.x = -0.35;
    g.add(cutwater);

    // Raised quarterdeck at stern
    var quarterDeck = box(3.2, 0.9, 4.2, hullWood, 0, 1.75, -5.2);
    g.add(quarterDeck);
    // Transom stern gallery (ventanales de popa del capitán)
    var sternGallery = box(3.0, 0.7, 0.2, mat(0x759cb8, 0.2, 0.4), 0, 1.85, -7.35);
    g.add(sternGallery);

    // Nelson Checker gunport bands (bandas negras y crema a los costados)
    function addGunports(sideX) {
      var stripe = box(0.08, 0.5, 12.0, whiteStripe, sideX, 1.05, -0.2);
      g.add(stripe);
      // Gunport lids (tapas de cañonera abiertas con cañones asomando)
      for (var z = -4.5; z <= 4.5; z += 1.8) {
        var lid = box(0.12, 0.26, 0.28, sideX > 0 ? redInside : redInside, sideX * 1.02, 1.25, z);
        lid.rotation.z = sideX > 0 ? -0.4 : 0.4;
        g.add(lid);
        // Cannon barrel poking through
        var gun = cyl(0.045, 0.065, 0.55, getIronMaterial(), sideX * 1.05, 1.05, z, 8);
        gun.rotation.z = Math.PI / 2;
        g.add(gun);
      }
    }
    addGunports(1.72);
    addGunports(-1.72);

    // Deck with planking
    var deck = box(3.1, 0.15, 12.8, deckWood, 0, 1.42, 0.2);
    g.add(deck);

    // Bulwarks / gunwales
    g.add(box(0.14, 0.55, 12.8, blackStripe, -1.6, 1.68, 0.2));
    g.add(box(0.14, 0.55, 12.8, blackStripe, 1.6, 1.68, 0.2));

    // Bowsprit (bauprés con botalón de foque)
    var bowsprit = cyl(0.09, 0.13, 6.2, mastWood, 0, 2.2, 11.2, 8);
    bowsprit.rotation.x = -Math.PI / 2 + 0.35;
    g.add(bowsprit);

    // 3 Full Masts: Foremast, Mainmast, Mizzenmast
    var mastConfigs = [
      { z: 4.8, h: 9.5, sailW: 2.8, yards: [3.4, 2.8, 2.2] },  // Trinquete
      { z: 0.2, h: 11.8, sailW: 3.4, yards: [4.2, 3.4, 2.6] }, // Mayor
      { z: -4.0, h: 8.8, sailW: 2.4, yards: [2.8, 2.3, 1.8] }, // Mesana
    ];

    for (var m = 0; m < mastConfigs.length; m++) {
      var cfg = mastConfigs[m];
      var mX = 0;
      var mZ = cfg.z;
      var mastMesh = cyl(0.08, 0.14, cfg.h, mastWood, mX, cfg.h * 0.5 + 1.2, mZ, 8);
      g.add(mastMesh);

      // Fighting top (cofa redonda para vigías y tiradores de marina)
      var cofa = cyl(0.65, 0.65, 0.1, blackStripe, mX, cfg.h * 0.42 + 1.2, mZ, 12);
      g.add(cofa);

      // Yards (vergas) and billowing square sails (velas henchidas)
      var tiers = 3;
      for (var t = 0; t < tiers; t++) {
        var yH = (cfg.h * 0.38) + t * (cfg.h * 0.24) + 1.2;
        var yW = cfg.yards[t];
        var yard = cyl(0.035, 0.035, yW, mastWood, mX, yH, mZ, 6);
        yard.rotation.z = Math.PI / 2;
        g.add(yard);

        // Curved sail catching the wind
        var sW = yW * 0.88;
        var sH = cfg.h * 0.2;
        var sail = box(sW, sH, 0.07, sailMat, mX, yH - sH * 0.48, mZ + 0.15);
        sail.rotation.x = 0.12;
        g.add(sail);
      }

      // Shrouds / Standing rigging (obenques laterales)
      function addShrouds(side) {
        var shroud = box(0.04, cfg.h * 0.5, 0.04, mat(0x222222, 0.9, 0), side * 1.5, (cfg.h * 0.25) + 1.4, mZ);
        shroud.rotation.z = side * -0.15;
        g.add(shroud);
      }
      addShrouds(1);
      addShrouds(-1);
    }

    // White Ensign / Royal Navy Flag at stern gaff
    var ensignPole = cyl(0.03, 0.03, 2.4, mastWood, 0, 3.2, -6.8, 6);
    ensignPole.rotation.x = -0.3;
    g.add(ensignPole);

    var ensignFlag = box(1.4, 0.9, 0.02, mat(0xfbfbfb, 0.9, 0), 0.72, 3.6, -7.1);
    g.add(ensignFlag);
    // Red St George's cross on flag
    var crossH = box(1.42, 0.16, 0.025, mat(0xcc292b, 0.9, 0), 0.72, 3.6, -7.1);
    var crossV = box(0.16, 0.92, 0.025, mat(0xcc292b, 0.9, 0), 0.42, 3.6, -7.1);
    g.add(crossH);
    g.add(crossV);

    g.userData = { type: 'ship' };
    return g;
  }

  // --- Upgraded Fort Wall Model ---
  // Sloped battered base, stone masonry texture, stone coping, almenas con aspilleras.
  function makeFortWall(length, height) {
    var h = height || 4;
    var g = new THREE.Group();
    var thickness = 1.45;
    var stoneMat = getStoneWallMaterial(Math.max(1, Math.round(length / 4)), Math.max(1, Math.round(h / 2)));
    var darkStone = getStoneWallMaterial(Math.max(1, Math.round(length / 4)), 1);

    // Sloped battered base (talud chino defensivo)
    var batterBase = box(length, 0.6, thickness + 0.5, darkStone, 0, 0.3, 0);
    g.add(batterBase);

    // Main masonry wall body
    var wallBody = box(length, h - 0.5, thickness, stoneMat, 0, (h + 0.1) * 0.5, 0);
    g.add(wallBody);

    // Stone coping ledge / cordon along the top
    var coping = box(length + 0.1, 0.22, thickness + 0.35, darkStone, 0, h + 0.05, 0);
    g.add(coping);

    // Crenellations: rectangular merlons with embrasures (lower on seaward parapet for clear sightlines)
    var isParapet = h <= 1.5;
    var n = Math.max(3, Math.floor(length / (isParapet ? 3.2 : 2.2)));
    var merlonW = (length / n) * (isParapet ? 0.44 : 0.55);
    var merlonH = isParapet ? 0.34 : 0.52;
    var merlonY = isParapet ? h + 0.25 : h + 0.4;
    for (var i = 0; i < n; i++) {
      var x = -length / 2 + (i + 0.5) * (length / n);
      var merlon = box(merlonW, merlonH, thickness * 0.6, stoneMat, x, merlonY, 0);
      g.add(merlon);
    }

    g.userData = { type: 'fort-wall' };
    return g;
  }

  // --- Upgraded Imperial Qing Coastal Cannon ---
  // Realistic bronze barrel with staged reinforce rings, cascabel, trunnions,
  // 4-wheeled naval truck carriage with quoin, iron bands, recoil animation pivot.
  function makeCannon() {
    var g = new THREE.Group();
    var bronzeMat = getBronzeMaterial();
    var ironMat = getIronMaterial();
    var woodMat = getWoodMaterial(false);
    var darkWood = getWoodMaterial(true);

    // Recoil pivot: displaced backwards on firing and smoothly sprung back
    var recoilPivot = new THREE.Group();
    g.add(recoilPivot);

    // --- 1. Cannon Barrel (points along -Z, towards the sea) ---
    var barrelGroup = new THREE.Group();
    barrelGroup.position.set(0, 0.78, 0);

    // Cascabel button & neck (esfera trasera de puntería)
    var cascabel = sphere(0.095, bronzeMat, 0, 0, 0.85);
    barrelGroup.add(cascabel);
    var cascabelNeck = cyl(0.06, 0.08, 0.12, bronzeMat, 0, 0, 0.75, 10);
    cascabelNeck.rotation.x = Math.PI / 2;
    barrelGroup.add(cascabelNeck);

    // Breech & vent field (recámara reforzada)
    var breech = cyl(0.24, 0.26, 0.45, bronzeMat, 0, 0, 0.5, 14);
    breech.rotation.x = Math.PI / 2;
    barrelGroup.add(breech);

    // Touch-hole / vent block on top of breech
    var ventBlock = box(0.08, 0.05, 0.1, bronzeMat, 0, 0.14, 0.5);
    barrelGroup.add(ventBlock);

    // First reinforce ring
    var ring1 = cyl(0.25, 0.25, 0.05, bronzeMat, 0, 0, 0.26, 14);
    ring1.rotation.x = Math.PI / 2;
    barrelGroup.add(ring1);

    // Second reinforce with trunnions (muñones de rotación)
    var reinforce2 = cyl(0.20, 0.23, 0.5, bronzeMat, 0, 0, 0.0, 14);
    reinforce2.rotation.x = Math.PI / 2;
    barrelGroup.add(reinforce2);

    // Left and right trunnion cylindrical pins
    var trunnionL = cyl(0.06, 0.06, 0.62, bronzeMat, 0, 0, 0.05, 10);
    trunnionL.rotation.z = Math.PI / 2;
    barrelGroup.add(trunnionL);

    // Chase (cuerpo cónico del cañón)
    var chase = cyl(0.15, 0.19, 1.25, bronzeMat, 0, 0, -0.78, 14);
    chase.rotation.x = Math.PI / 2;
    barrelGroup.add(chase);

    // Muzzle astragal & muzzle swell (boca acampanada)
    var muzzleSwell = cyl(0.21, 0.16, 0.22, bronzeMat, 0, 0, -1.48, 14);
    muzzleSwell.rotation.x = Math.PI / 2;
    barrelGroup.add(muzzleSwell);

    // Dark bore aperture (agujero oscuro de la boca)
    var boreHole = cyl(0.09, 0.09, 0.08, ironMat, 0, 0, -1.58, 12);
    boreHole.rotation.x = Math.PI / 2;
    barrelGroup.add(boreHole);

    // Slight upward elevation angle typical of coastal batteries
    barrelGroup.rotation.x = 0.08;
    recoilPivot.add(barrelGroup);

    // --- 2. Naval Truck Carriage (Cureña naval de madera pesada) ---
    var carriage = new THREE.Group();

    // Two stepped wooden cheek sides (gualderas)
    function makeCheek(x) {
      var cheek = new THREE.Group();
      cheek.position.x = x;
      // Stepped blocks
      cheek.add(box(0.14, 0.45, 1.5, woodMat, 0, 0.35, 0));
      cheek.add(box(0.14, 0.22, 0.8, woodMat, 0, 0.55, -0.1));
      // Iron trunnion capsquare strap
      cheek.add(box(0.16, 0.04, 0.18, ironMat, 0, 0.72, 0.05));
      // Side iron ringbolt for rope breechings
      cheek.add(cyl(0.05, 0.05, 0.03, ironMat, x > 0 ? 0.08 : -0.08, 0.38, 0.2, 8));
      return cheek;
    }
    carriage.add(makeCheek(0.32));
    carriage.add(makeCheek(-0.32));

    // Transom crossbeam & rear bed
    carriage.add(box(0.55, 0.2, 0.3, darkWood, 0, 0.28, -0.4));
    carriage.add(box(0.55, 0.18, 0.4, darkWood, 0, 0.28, 0.45));

    // Wooden quoin (cuña de puntería con mango) under breech
    var quoin = box(0.32, 0.16, 0.35, darkWood, 0, 0.48, 0.45);
    carriage.add(quoin);

    // Front and rear wooden wheel axles (ejes de cureña)
    var frontAxle = cyl(0.06, 0.06, 1.05, darkWood, 0, 0.22, -0.42, 8);
    frontAxle.rotation.z = Math.PI / 2;
    carriage.add(frontAxle);

    var rearAxle = cyl(0.06, 0.06, 1.05, darkWood, 0, 0.22, 0.42, 8);
    rearAxle.rotation.z = Math.PI / 2;
    carriage.add(rearAxle);

    // 4 Solid wooden truck wheels with iron rims and linchpins
    function wheel(x, z) {
      var wGroup = new THREE.Group();
      wGroup.position.set(x, 0.25, z);

      // Wooden wheel disc
      var wDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.11, 14), woodMat);
      wDisc.rotation.z = Math.PI / 2;
      wDisc.castShadow = true;
      wGroup.add(wDisc);

      // Iron outer tire hoop
      var wRim = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.115, 14), ironMat);
      wRim.rotation.z = Math.PI / 2;
      wRim.scale.set(1.02, 0.98, 1.02);
      wGroup.add(wRim);

      // Iron center linchpin hub
      var hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.15, 8), ironMat);
      hub.rotation.z = Math.PI / 2;
      wGroup.add(hub);

      return wGroup;
    }

    carriage.add(wheel(-0.48, -0.42));
    carriage.add(wheel(0.48, -0.42));
    carriage.add(wheel(-0.48, 0.42));
    carriage.add(wheel(0.48, 0.42));

    recoilPivot.add(carriage);

    // Setup userData and recoil trigger/spring updater
    g.userData = {
      type: 'cannon',
      recoilOffset: 0,
      recoilVelocity: 0,
      recoilPivot: recoilPivot,
      triggerRecoil: function () {
        this.recoilOffset = 0.58; // Kick back 58 cm along +Z
      },
      updateRecoil: function (dt) {
        if (this.recoilOffset > 0) {
          this.recoilOffset = Math.max(0, this.recoilOffset - dt * 1.6);
          this.recoilPivot.position.z = this.recoilOffset;
        }
      },
    };

    return g;
  }

  // --- Upgraded Chinese Watchtower (望楼) ---
  // Authentic Qing military watchtower with arched stone base, timber pavilion,
  // flared hip-and-gable roof (歇山顶 / 飞檐) and red hanging lanterns.
  function makeWatchtower() {
    var g = new THREE.Group();
    var stoneMat = getStoneWallMaterial(2, 2);
    var timberMat = getWoodMaterial(true);
    var redLacquer = mat(0xa82824, 0.75, 0.05);
    var tileMat = mat(0x3a3a3a, 0.85, 0.05);
    var goldFinial = mat(0xd4af37, 0.4, 0.6);

    // 1. Lower stone bastion
    var stoneBase = box(4.4, 5.2, 4.4, stoneMat, 0, 2.6, 0);
    g.add(stoneBase);

    // Arched portal door
    var door = box(1.4, 2.4, 0.1, timberMat, 0, 1.2, 2.22);
    g.add(door);

    // Stone balcony platform
    var balcony = box(4.8, 0.35, 4.8, stoneMat, 0, 5.35, 0);
    g.add(balcony);

    // Balcony timber perimeter railing
    function addRailing(x, z, w, d) {
      g.add(box(w, 0.65, d, timberMat, x, 5.85, z));
    }
    addRailing(0, 2.3, 4.6, 0.1);
    addRailing(0, -2.3, 4.6, 0.1);
    addRailing(2.3, 0, 0.1, 4.6);
    addRailing(-2.3, 0, 0.1, 4.6);

    // 2. Upper timber guard pavilion
    // 4 Corner red lacquer pillars
    var pillarCoords = [
      [-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]
    ];
    for (var p = 0; p < pillarCoords.length; p++) {
      var col = cyl(0.12, 0.12, 2.6, redLacquer, pillarCoords[p][0], 6.8, pillarCoords[p][1], 8);
      g.add(col);
    }

    // Upper room timber walls with observation window slots
    var upperRoom = box(3.2, 2.4, 3.2, mat(0xcbb189, 0.9, 0), 0, 6.7, 0);
    g.add(upperRoom);

    // 3. Traditional Chinese Curved Roof (歇山顶 / 飞檐)
    // Primary roof pyramid with flared eaves
    var roofBase = new THREE.Mesh(
      new THREE.ConeGeometry(3.6, 1.8, 4),
      tileMat
    );
    roofBase.position.set(0, 8.8, 0);
    roofBase.rotation.y = Math.PI / 4;
    roofBase.castShadow = true;
    g.add(roofBase);

    // Upturned roof corners (飞檐)
    for (var c = 0; c < 4; c++) {
      var angle = (c * Math.PI) / 2 + Math.PI / 4;
      var cx = Math.cos(angle) * 2.8;
      var cz = Math.sin(angle) * 2.8;
      var eaveTip = cone(0.25, 0.7, goldFinial, cx, 8.4, cz, 6);
      eaveTip.rotation.x = Math.sin(angle) * 0.45;
      eaveTip.rotation.z = -Math.cos(angle) * 0.45;
      g.add(eaveTip);

      // Hanging red silk lantern at each corner
      var lanternGroup = new THREE.Group();
      lanternGroup.position.set(cx * 0.92, 7.8, cz * 0.92);
      // Cord
      lanternGroup.add(cyl(0.015, 0.015, 0.35, mat(0x222222), 0, 0.18, 0, 4));
      // Red sphere body
      var lanternBody = sphere(0.24, mat(0xcc292b, 0.6, 0.1), 0, -0.05, 0);
      lanternBody.scale.set(1, 1.25, 1);
      lanternGroup.add(lanternBody);
      // Gold tassel
      lanternGroup.add(cyl(0.04, 0.02, 0.25, goldFinial, 0, -0.32, 0, 6));
      g.add(lanternGroup);
    }

    // Roof peak golden finial
    var roofPeak = sphere(0.28, goldFinial, 0, 9.8, 0);
    g.add(roofPeak);

    g.userData = { type: 'watchtower' };
    return g;
  }

  // --- Imperial Qing Dragon Flag Pole ---
  // Waving triangular yellow dragon standard on timber mast.
  function makeFlagPole(height) {
    var h = height || 8;
    var g = new THREE.Group();
    var timberMat = getWoodMaterial(true);
    var goldMat = mat(0xd4af37, 0.4, 0.6);

    // Wooden mast
    var mast = cyl(0.09, 0.13, h, timberMat, 0, h * 0.5, 0, 8);
    g.add(mast);

    // Masthead finial
    var finial = sphere(0.18, goldMat, 0, h + 0.1, 0);
    g.add(finial);

    // Cross yard for halyard
    var yard = cyl(0.03, 0.03, 1.2, timberMat, 0, h - 0.4, 0, 6);
    yard.rotation.z = Math.PI / 2;
    g.add(yard);

    // Triangular dragon flag with wave geometry
    var flagTex = getQingFlagTexture();
    var flagMat = new THREE.MeshStandardMaterial({
      color: 0xf5f5f5,
      map: flagTex || null,
      side: THREE.DoubleSide,
      roughness: 0.85,
      metalness: 0.02,
    });

    var flagGeo = new THREE.PlaneGeometry(2.4, 1.5, 8, 4);
    var flagMesh = new THREE.Mesh(flagGeo, flagMat);
    flagMesh.position.set(1.25, h - 1.1, 0);
    flagMesh.castShadow = true;
    g.add(flagMesh);

    g.userData = {
      type: 'flagpole',
      flagMesh: flagMesh,
      update: function (time) {
        if (!flagMesh || !flagMesh.geometry) return;
        var pos = flagMesh.geometry.attributes.position;
        if (!pos) return;
        for (var i = 0; i < pos.count; i++) {
          var px = pos.getX(i);
          var wave = Math.sin(px * 3.0 + time * 6.0) * 0.12 * (px / 2.4);
          pos.setZ(i, wave);
        }
        pos.needsUpdate = true;
      },
    };

    return g;
  }

  // --- Tactical Courtyard Props ---
  // 1. Powder Barrel (Barril de pólvora con aros de hierro)
  function makePowderBarrel() {
    var g = new THREE.Group();
    var wood = getWoodMaterial(false);
    var iron = getIronMaterial();

    // Staved bulging barrel body
    var body = cyl(0.32, 0.32, 0.82, wood, 0, 0.41, 0, 12);
    body.scale.set(1.15, 1, 1.15);
    g.add(body);

    // 4 Iron hoops (aros de hierro forjado)
    var hoops = [-0.28, -0.12, 0.12, 0.28];
    for (var i = 0; i < hoops.length; i++) {
      var hoop = cyl(0.355, 0.355, 0.04, iron, 0, 0.41 + hoops[i], 0, 12);
      hoop.scale.set(1.16, 1, 1.16);
      g.add(hoop);
    }
    g.userData = { type: 'powder-barrel' };
    return g;
  }

  // 2. Cannonball Pyramid Stack (Pirámide de balas de cañón de hierro)
  function makeCannonballStack() {
    var g = new THREE.Group();
    var iron = getIronMaterial();
    var wood = getWoodMaterial(true);
    var r = 0.11;

    // Wooden base frame (marco para balas)
    g.add(box(0.9, 0.08, 0.9, wood, 0, 0.04, 0));

    // Base layer: 3x3 = 9 cannonballs
    for (var x = -1; x <= 1; x++) {
      for (var z = -1; z <= 1; z++) {
        g.add(sphere(r, iron, x * r * 2.1, r + 0.04, z * r * 2.1));
      }
    }
    // Second layer: 2x2 = 4 cannonballs
    var y2 = r + 0.04 + r * 1.5;
    for (var x2 = -0.5; x2 <= 0.5; x2 += 1) {
      for (var z2 = -0.5; z2 <= 0.5; z2 += 1) {
        g.add(sphere(r, iron, x2 * r * 2.1, y2, z2 * r * 2.1));
      }
    }
    // Top cannonball: 1
    g.add(sphere(r, iron, 0, y2 + r * 1.5, 0));

    g.userData = { type: 'cannonball-stack' };
    return g;
  }

  // 3. Sandbag Wall (Trinchera de sacos de arena)
  function makeSandbagWall(length) {
    var g = new THREE.Group();
    var bagMat = getSandbagMaterial();
    var len = length || 3;
    var count = Math.max(2, Math.floor(len / 0.8));

    for (var layer = 0; layer < 3; layer++) {
      var y = layer * 0.22 + 0.12;
      var offset = (layer % 2) * 0.35;
      for (var i = 0; i < count; i++) {
        var x = -len * 0.5 + (i + 0.5) * (len / count) + offset;
        var bag = box(0.68, 0.22, 0.38, bagMat, x, y, 0);
        bag.rotation.y = (Math.random() - 0.5) * 0.1;
        g.add(bag);
      }
    }
    g.userData = { type: 'sandbag-wall' };
    return g;
  }

  // 4. Garrison Medical Aid Station (Puesto de botiquín y curación)
  function makeMedicalStation() {
    var g = new THREE.Group();
    var wood = getWoodMaterial(false);
    var darkWood = getWoodMaterial(true);
    var whiteCloth = mat(0xf2efe8, 0.88, 0.0);
    var redCross = mat(0xc42824, 0.6, 0.05);
    var herbGlass = mat(0x2d7a4f, 0.25, 0.15);
    var amberGlass = mat(0xb87624, 0.25, 0.15);
    var iron = getIronMaterial();

    // Wooden field table
    g.add(box(1.5, 0.09, 0.9, wood, 0, 0.80, 0));
    var legCoords = [[-0.66, -0.36], [0.66, -0.36], [-0.66, 0.36], [0.66, 0.36]];
    for (var li = 0; li < legCoords.length; li++) {
      g.add(box(0.09, 0.78, 0.09, darkWood, legCoords[li][0], 0.39, legCoords[li][1]));
    }
    // White-and-crimson field cloth runner across table
    g.add(box(0.65, 0.02, 0.94, whiteCloth, 0, 0.855, 0));
    g.add(box(0.08, 0.022, 0.32, redCross, 0, 0.86, 0));
    g.add(box(0.32, 0.022, 0.08, redCross, 0, 0.86, 0));

    // Red-lacquered medical chest (药箱) with open lid
    g.add(box(0.46, 0.24, 0.32, redCross, -0.38, 0.96, 0.02));
    var lid = box(0.46, 0.05, 0.32, redCross, -0.38, 1.15, -0.14);
    lid.rotation.x = -1.1;
    g.add(lid);
    g.add(box(0.18, 0.02, 0.06, whiteCloth, -0.38, 1.09, 0.02));
    g.add(box(0.06, 0.02, 0.18, whiteCloth, -0.38, 1.09, 0.02));

    // Rolled white linen bandages
    var roll1 = cyl(0.055, 0.055, 0.16, whiteCloth, 0.28, 0.90, 0.14, 10);
    roll1.rotation.z = Math.PI / 2;
    var roll2 = cyl(0.05, 0.05, 0.15, whiteCloth, 0.34, 0.90, -0.02, 10);
    roll2.rotation.z = Math.PI / 2;
    roll2.rotation.y = 0.4;
    g.add(roll1, roll2);

    // Herbal medicine bottles
    g.add(cyl(0.045, 0.05, 0.19, herbGlass, 0.52, 0.94, -0.18, 8));
    g.add(cyl(0.04, 0.045, 0.15, amberGlass, 0.41, 0.92, -0.22, 8));

    // Lantern pole and glowing healing lantern
    g.add(cyl(0.03, 0.04, 1.7, iron, -0.68, 0.85, -0.38, 8));
    g.add(box(0.36, 0.04, 0.04, iron, -0.52, 1.68, -0.38));
    var lanternMat = new THREE.MeshStandardMaterial({
      color: 0xffd27a,
      emissive: 0x3ad97b,
      emissiveIntensity: 0.75,
      roughness: 0.35,
    });
    var lantern = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), lanternMat);
    lantern.position.set(-0.36, 1.54, -0.38);
    g.add(lantern);

    // Healing zone floor ring (1.6 m radius)
    var zoneGeo = new THREE.CylinderGeometry(1.6, 1.6, 0.02, 24);
    var zoneMat = new THREE.MeshStandardMaterial({
      color: 0x2ecc71,
      emissive: 0x1e8449,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.28,
      roughness: 0.9,
    });
    var zoneRing = new THREE.Mesh(zoneGeo, zoneMat);
    zoneRing.position.set(0, 0.03, 0);
    g.add(zoneRing);

    g.userData = {
      type: 'medical-station',
      zoneRing: zoneRing,
      lantern: lantern,
      cooldownUntil: 0,
    };
    return g;
  }

  // 5. Firing Banquette Step (Banqueta de tiro tras el parapeto norte)
  function makeFiringStep(length) {
    var g = new THREE.Group();
    var len = length || 4.2;
    var wood = getWoodMaterial(false, 2, 1);
    var darkWood = getWoodMaterial(true);

    // Main raised plank deck (height 0.38 m so player eyes clear the parapet cleanly)
    g.add(box(len, 0.38, 1.25, wood, 0, 0.19, 0));
    // Lower back tread step for smooth walk-up
    g.add(box(len, 0.19, 0.55, darkWood, 0, 0.095, 0.85));
    // Support beams
    for (var x = -len * 0.4; x <= len * 0.41; x += len * 0.4) {
      g.add(box(0.14, 0.40, 1.32, darkWood, x, 0.2, 0));
    }

    g.userData = { type: 'firing-step' };
    return g;
  }

  // 6. Bamboo Assault Ladder (Escala de asalto sobre el parapeto)
  function makeAssaultLadder(height) {
    var h = height || 2.6;
    var g = new THREE.Group();
    var bamboo = mat(0xa8925a, 0.82, 0.02);
    var rope = mat(0x6e5332, 0.95, 0.0);

    g.add(cyl(0.038, 0.045, h, bamboo, -0.32, h * 0.5, 0, 8));
    g.add(cyl(0.038, 0.045, h, bamboo, 0.32, h * 0.5, 0, 8));

    var rungs = Math.max(4, Math.floor(h / 0.36));
    for (var i = 1; i < rungs; i++) {
      var y = (i / rungs) * h;
      var rung = cyl(0.024, 0.024, 0.7, bamboo, 0, y, 0, 8);
      rung.rotation.z = Math.PI / 2;
      g.add(rung);
      g.add(box(0.07, 0.05, 0.07, rope, -0.32, y, 0));
      g.add(box(0.07, 0.05, 0.07, rope, 0.32, y, 0));
    }

    g.userData = { type: 'assault-ladder' };
    return g;
  }

  return {
    makeQingSoldier: makeQingSoldier,
    makeBritishSoldier: makeBritishSoldier,
    hasBritishModel: hasBritishModel,
    loadBritishSoldierModel: loadBritishSoldierModel,
    updateSoldierAnimation: updateSoldierAnimation,
    playSoldierDeath: playSoldierDeath,
    stopSoldierAnimation: stopSoldierAnimation,
    makeShip: makeShip,
    makeFortWall: makeFortWall,
    makeCannon: makeCannon,
    makeWatchtower: makeWatchtower,
    makeFlagPole: makeFlagPole,
    makePowderBarrel: makePowderBarrel,
    makeCannonballStack: makeCannonballStack,
    makeSandbagWall: makeSandbagWall,
    makeMedicalStation: makeMedicalStation,
    makeFiringStep: makeFiringStep,
    makeAssaultLadder: makeAssaultLadder,
    getStoneWallMaterial: getStoneWallMaterial,
    getWoodMaterial: getWoodMaterial,
    getBronzeMaterial: getBronzeMaterial,
    getIronMaterial: getIronMaterial,
  };
})();

if (typeof module !== 'undefined') module.exports = Models;

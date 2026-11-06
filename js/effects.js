// Visual effects for the physics layer: muzzle smoke, tracers, dust, sparks,
// explosions, debris meshes and camera shake. Browser global `Effects`;
// returns null when there is no DOM (Node tests never need visuals).
//
// Contract:
//   Effects.create(scene, camera) -> effects | null
//   effects.muzzleFlash(point, dir, opts)
//   effects.impact(point, normal, kind)          kind: ground|wall|water|flesh
//   effects.explosion(point, opts)
//   effects.trail(from, kind) -> { update(a, b), dispose() }
//   effects.cannonball(point) -> Mesh
//   effects.removeCannonball(mesh)
//   effects.debrisMesh(size) -> Mesh
//   effects.update(dt)
//   effects.addShake(amount); effects.getShake() -> {x,y,z,roll}
//   effects.particleCount()

var Effects = (function () {
  var SOFT_POOL = 150;
  var GLOW_POOL = 60;

  function makeGlowTexture() {
    var size = 64;
    var canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;
    var grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.65)');
    grad.addColorStop(0.7, 'rgba(255,255,255,0.18)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    var tex = new THREE.CanvasTexture(canvas);
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function create(scene, camera) {
    if (typeof document === 'undefined' || typeof THREE === 'undefined') return null;
    var texture = makeGlowTexture();
    if (!texture) return null;

    var softPool = [];
    var glowPool = [];
    var shakeAmp = 0;
    var shakeTime = 0;
    var time = 0;

    function makeParticle(additive) {
      var material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        opacity: 1,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      });
      var sprite = new THREE.Sprite(material);
      sprite.visible = false;
      sprite.frustumCulled = false;
      scene.add(sprite);
      return {
        sprite: sprite,
        material: material,
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        baseOpacity: 1,
        grow: 0,
        gravity: 0,
        drag: 0,
        rotation: 0,
        spin: 0,
        active: false,
      };
    }

    for (var i = 0; i < SOFT_POOL; i++) softPool.push(makeParticle(false));
    for (var j = 0; j < GLOW_POOL; j++) glowPool.push(makeParticle(true));
    var cursorSoft = 0;
    var cursorGlow = 0;

    function spawn(pool, cursorName, opts) {
      var p;
      if (cursorName === 'soft') {
        p = softPool[cursorSoft % softPool.length];
        cursorSoft++;
      } else {
        p = glowPool[cursorGlow % glowPool.length];
        cursorGlow++;
      }
      p.active = true;
      p.sprite.visible = true;
      p.sprite.position.set(opts.x, opts.y, opts.z);
      p.vel.set(opts.vx || 0, opts.vy || 0, opts.vz || 0);
      p.life = opts.life || 0.5;
      p.maxLife = p.life;
      p.baseOpacity = opts.opacity === undefined ? 0.8 : opts.opacity;
      p.grow = opts.grow || 0;
      p.gravity = opts.gravity || 0;
      p.drag = opts.drag || 0;
      p.rotation = Math.random() * Math.PI * 2;
      p.spin = opts.spin || 0;
      var scale = opts.scale || 0.3;
      p.sprite.scale.set(scale, scale, 1);
      p.material.color.setHex(opts.color === undefined ? 0xffffff : opts.color);
      p.material.opacity = p.baseOpacity;
      p.material.rotation = p.rotation;
      return p;
    }

    function soft(opts) { return spawn(softPool, 'soft', opts); }
    function glow(opts) { return spawn(glowPool, 'glow', opts); }

    function puff(x, y, z, vx, vy, vz, opts) {
      return soft({
        x: x, y: y, z: z, vx: vx, vy: vy, vz: vz,
        life: opts.life,
        scale: opts.scale,
        grow: opts.grow,
        gravity: opts.gravity || 0,
        drag: opts.drag === undefined ? 1.4 : opts.drag,
        color: opts.color,
        opacity: opts.opacity,
      });
    }

    function update(dt) {
      dt = Math.min(Math.max(dt || 0, 0), 0.1);
      time += dt;
      shakeTime += dt;
      shakeAmp *= Math.exp(-4.5 * dt);
      if (shakeAmp < 0.001) shakeAmp = 0;

      var pools = [softPool, glowPool];
      for (var pi = 0; pi < pools.length; pi++) {
        var pool = pools[pi];
        for (var k = 0; k < pool.length; k++) {
          var p = pool[k];
          if (!p.active) continue;
          p.life -= dt;
          if (p.life <= 0) {
            p.active = false;
            p.sprite.visible = false;
            continue;
          }
          var d = Math.exp(-p.drag * dt);
          p.vel.x *= d;
          p.vel.z *= d;
          p.vel.y = p.vel.y * d - p.gravity * dt;
          p.sprite.position.x += p.vel.x * dt;
          p.sprite.position.y += p.vel.y * dt;
          p.sprite.position.z += p.vel.z * dt;
          var s = p.sprite.scale.x + p.grow * dt;
          p.sprite.scale.set(s, s, 1);
          p.rotation += p.spin * dt;
          p.material.rotation = p.rotation;
          var t = p.life / p.maxLife;
          p.material.opacity = p.baseOpacity * (t < 0.35 ? t / 0.35 : 1);
        }
      }
    }

    // --- Muzzle smoke + flash ---
    function muzzleFlash(point, dir, opts) {
      if (!point) return;
      var big = opts && opts.big;
      var dx = dir ? dir.x : 0;
      var dy = dir ? dir.y : 0;
      var dz = dir ? dir.z : -1;
      glow({
        x: point.x + dx * 0.08,
        y: point.y + dy * 0.08,
        z: point.z + dz * 0.08,
        life: big ? 0.12 : 0.07,
        scale: big ? 1.25 : 0.42,
        grow: big ? 3.2 : 1.4,
        color: big ? 0xffb35e : 0xffe6a8,
        opacity: 0.95,
      });
      var puffs = big ? 7 : 3;
      for (var i = 0; i < puffs; i++) {
        puff(
          point.x + (Math.random() - 0.5) * 0.15,
          point.y + (Math.random() - 0.5) * 0.15,
          point.z + (Math.random() - 0.5) * 0.15,
          dx * (1 + Math.random() * 2.2) + (Math.random() - 0.5) * 0.7,
          dy * (1 + Math.random()) + 0.35 + Math.random() * 0.5,
          dz * (1 + Math.random() * 2.2) + (Math.random() - 0.5) * 0.7,
          {
            life: 0.8 + Math.random() * 0.9,
            scale: (big ? 0.55 : 0.16) + Math.random() * (big ? 0.5 : 0.12),
            grow: (big ? 1.8 : 0.55) + Math.random() * 0.4,
            color: big ? 0xc9c2b4 : 0xdedad0,
            opacity: big ? 0.4 : 0.3,
          }
        );
      }
      if (big) addShake(0.12);
    }

    // --- Impacts ---
    function impact(point, normal, kind) {
      if (!point) return;
      var nx = normal ? normal.x : 0;
      var ny = normal ? normal.y : 1;
      var nz = normal ? normal.z : 0;
      var i;
      if (kind === 'flesh') {
        for (i = 0; i < 5; i++) {
          puff(
            point.x, point.y, point.z,
            nx * 0.7 + (Math.random() - 0.5) * 1.4,
            0.3 + Math.random() * 1.1,
            nz * 0.7 + (Math.random() - 0.5) * 1.4,
            {
              life: 0.35 + Math.random() * 0.25,
              scale: 0.1 + Math.random() * 0.12,
              grow: 0.35,
              color: 0x6e1f1a,
              opacity: 0.5,
            }
          );
        }
        return;
      }
      if (kind === 'water') {
        for (i = 0; i < 6; i++) {
          puff(
            point.x, Math.max(0.05, point.y), point.z,
            (Math.random() - 0.5) * 1.8,
            1.2 + Math.random() * 2.2,
            (Math.random() - 0.5) * 1.8,
            {
              life: 0.5 + Math.random() * 0.4,
              scale: 0.12 + Math.random() * 0.14,
              grow: 0.6,
              gravity: 3.5,
              color: 0xd8f0ff,
              opacity: 0.55,
            }
          );
        }
        return;
      }
      var color = kind === 'wall' ? 0xcbb187 : 0xb79a6c;
      for (i = 0; i < 4; i++) {
        puff(
          point.x, point.y, point.z,
          nx * (0.5 + Math.random()) + (Math.random() - 0.5) * 1.2,
          0.25 + Math.random() * 0.9,
          nz * (0.5 + Math.random()) + (Math.random() - 0.5) * 1.2,
          {
            life: 0.35 + Math.random() * 0.45,
            scale: 0.08 + Math.random() * 0.12,
            grow: 0.55,
            color: color,
            opacity: 0.5,
          }
        );
      }
      if (kind === 'wall') {
        for (i = 0; i < 3; i++) {
          glow({
            x: point.x, y: point.y, z: point.z,
            vx: nx * 2 + (Math.random() - 0.5) * 3,
            vy: 0.8 + Math.random() * 2,
            vz: nz * 2 + (Math.random() - 0.5) * 3,
            life: 0.18 + Math.random() * 0.2,
            scale: 0.05,
            gravity: 5,
            color: 0xffd58a,
            opacity: 0.9,
          });
        }
      }
    }

    function addShake(amount) {
      shakeAmp = Math.min(1.4, shakeAmp + amount);
    }

    function explosion(point, opts) {
      if (!point) return;
      var big = opts && opts.big ? 1.35 : 1;
      var dist = 10;
      if (camera && camera.position) {
        dist = Math.hypot(
          point.x - camera.position.x,
          point.y - camera.position.y,
          point.z - camera.position.z
        );
      }
      addShake(0.6 * big * Math.max(0, 1 - dist / 45));
      glow({
        x: point.x, y: point.y + 0.35, z: point.z,
        life: 0.16,
        scale: 1.5 * big,
        grow: 7 * big,
        color: 0xffd27a,
        opacity: 1,
      });
      glow({
        x: point.x, y: point.y + 0.2, z: point.z,
        life: 0.28,
        scale: 1.0,
        grow: 4,
        color: 0xff7a2a,
        opacity: 0.85,
      });
      var i;
      for (i = 0; i < 14; i++) {
        var a = Math.random() * Math.PI * 2;
        var speed = 1.5 + Math.random() * 4;
        puff(
          point.x + Math.cos(a) * 0.4,
          point.y + 0.2 + Math.random() * 0.7,
          point.z + Math.sin(a) * 0.4,
          Math.cos(a) * speed,
          1.2 + Math.random() * 3,
          Math.sin(a) * speed,
          {
            life: 1.2 + Math.random() * 1.4,
            scale: 0.5 + Math.random() * 0.7,
            grow: 1.7,
            gravity: -0.2,
            drag: 0.9,
            color: i % 3 === 0 ? 0x5d554a : 0x8b8172,
            opacity: 0.45,
          }
        );
      }
      for (i = 0; i < 12; i++) {
        glow({
          x: point.x, y: point.y + 0.2, z: point.z,
          vx: (Math.random() - 0.5) * 12,
          vy: 2 + Math.random() * 7,
          vz: (Math.random() - 0.5) * 12,
          life: 0.35 + Math.random() * 0.5,
          scale: 0.06,
          gravity: 7,
          color: 0xffc466,
          opacity: 0.9,
        });
      }
      for (i = 0; i < 8; i++) {
        puff(
          point.x + (Math.random() - 0.5) * 1.2,
          point.y + 0.05,
          point.z + (Math.random() - 0.5) * 1.2,
          (Math.random() - 0.5) * 3,
          0.4 + Math.random() * 1.2,
          (Math.random() - 0.5) * 3,
          {
            life: 0.6 + Math.random() * 0.7,
            scale: 0.14 + Math.random() * 0.2,
            grow: 1.0,
            color: 0xa88b5f,
            opacity: 0.5,
          }
        );
      }
    }

    // --- Projectile trails ---
    function trail(from, kind) {
      var positions = new Float32Array(6);
      var geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      var mat = new THREE.LineBasicMaterial({
        color: kind === 'cannon' ? 0xffb865 : 0xfff0c0,
        transparent: true,
        opacity: kind === 'cannon' ? 0.5 : 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      var line = new THREE.Line(geom, mat);
      line.frustumCulled = false;
      line.visible = false;
      scene.add(line);
      var lastSmoke = 0;
      return {
        update: function (a, b) {
          positions[0] = a.x;
          positions[1] = a.y;
          positions[2] = a.z;
          positions[3] = b.x;
          positions[4] = b.y;
          positions[5] = b.z;
          geom.attributes.position.needsUpdate = true;
          line.visible = true;
          if (kind === 'cannon' && time - lastSmoke > 0.045) {
            lastSmoke = time;
            puff(b.x, b.y, b.z, (Math.random() - 0.5) * 0.2, 0.1, (Math.random() - 0.5) * 0.2, {
              life: 0.7 + Math.random() * 0.5,
              scale: 0.18,
              grow: 1.1,
              color: 0xbdb6aa,
              opacity: 0.3,
            });
          }
        },
        dispose: function () {
          scene.remove(line);
          geom.dispose();
          mat.dispose();
        },
      };
    }

    var ballGeom = new THREE.SphereGeometry(0.16, 8, 6);
    var ballMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2c, roughness: 0.5, metalness: 0.6 });

    function cannonball(point) {
      var mesh = new THREE.Mesh(ballGeom, ballMat);
      mesh.position.set(point.x, point.y, point.z);
      mesh.castShadow = false;
      scene.add(mesh);
      return mesh;
    }

    function removeCannonball(mesh) {
      if (mesh && mesh.parent) mesh.parent.remove(mesh);
    }

    var debrisGeom = new THREE.BoxGeometry(1, 1, 1);
    var debrisMats = [
      new THREE.MeshStandardMaterial({ color: 0x8a7454, roughness: 1 }),
      new THREE.MeshStandardMaterial({ color: 0x6d6255, roughness: 1 }),
      new THREE.MeshStandardMaterial({ color: 0x9c8058, roughness: 1 }),
    ];

    function debrisMesh(size) {
      var mesh = new THREE.Mesh(debrisGeom, debrisMats[Math.floor(Math.random() * debrisMats.length)]);
      mesh.scale.set(size, size * (0.5 + Math.random() * 0.8), size);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      return mesh;
    }

    function getShake() {
      var a = shakeAmp;
      return {
        x: Math.sin(shakeTime * 43) * a * 0.35,
        y: Math.cos(shakeTime * 57) * a * 0.25,
        z: Math.sin(shakeTime * 37) * a * 0.18,
        roll: Math.sin(shakeTime * 31) * a * 0.05,
      };
    }

    function particleCount() {
      var n = 0;
      for (var i = 0; i < softPool.length; i++) if (softPool[i].active) n++;
      for (var j = 0; j < glowPool.length; j++) if (glowPool[j].active) n++;
      return n;
    }

    // Pre-warm the texture upload once so the first shot does not hitch.
    texture.needsUpdate = true;

    return {
      muzzleFlash: muzzleFlash,
      impact: impact,
      explosion: explosion,
      trail: trail,
      cannonball: cannonball,
      removeCannonball: removeCannonball,
      debrisMesh: debrisMesh,
      update: update,
      addShake: addShake,
      getShake: getShake,
      particleCount: particleCount,
      camera: camera,
    };
  }

  return { create: create };
})();

if (typeof module !== 'undefined') module.exports = Effects;

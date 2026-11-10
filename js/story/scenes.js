// 3D staging for the cinematics: the sets of the historical moments.
//
// Each builder returns { group, update(t, dt), dispose() } and is dropped
// into the main scene for the length of a shot. Everything is primitives and
// the procedural rig, so the game still runs without external assets.
//
// Browser global `Scenes`; also guarded for Node tooling consistency.

var Scenes = (function () {
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

  // A soldier posed with the procedural rig, for the cinematics.
  function figure(variant, clipName, t) {
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

  function qingFigure(t) {
    var rig = Rig.buildSoldier({ faction: 'qing' });
    var anim = new RigAnim.Animator(rig);
    anim.play(RigAnim.Clips.idle());
    anim.time = t || 0;
    anim.update(0);
    rig.group.userData.animator = anim;
    return rig;
  }

  function disposeGroup(group) {
    if (!group || !group.traverse) return;
    group.traverse(function (node) {
      if (node.geometry && node.geometry.dispose) node.geometry.dispose();
      if (node.material) {
        var list = Array.isArray(node.material) ? node.material : [node.material];
        for (var i = 0; i < list.length; i++) if (list[i].dispose) list[i].dispose();
      }
    });
    if (group.parent) group.parent.remove(group);
  }

  // --- Set 1: Humen beach, 3 June 1839, the destruction of the opium -----
  function opiumDestruction(ctx) {
    var group = new THREE.Group();
    group.name = 'scene-opium-1839';

    group.add(plane(160, 160, 0xd9c391, 0, 0, 0, { roughness: 1 }));
    group.add(plane(220, 140, 0x2c6c9c, 0, 0.02, -70, { roughness: 0.4, transparent: true, opacity: 0.92 }));
    // The sea edge where the opium was poured.
    group.add(box(160, 0.5, 4, 0xcdb37e, 0, 0.25, -26));

    // The chests, in rows, and the barrels of opium on the sand.
    var crates = [];
    for (var r = 0; r < 4; r++) {
      for (var c = 0; c < 7; c++) {
        var crate = box(1.5, 0.9, 1.1, 0x6b4a2f, -9 + c * 3, 0.45, -14 + r * 2.4);
        group.add(crate);
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
      group.add(lump);
      lumps.push(lump);
    }

    // Officials and soldiers watching, and the merchants on the beach.
    var officials = [];
    var spots = [
      { x: -6, z: -6, v: null }, { x: -3.5, z: -5, v: null },
      { x: 4, z: -6.5, v: null }, { x: 6.5, z: -5.5, v: null },
    ];
    for (var i = 0; i < spots.length; i++) {
      var f = qingFigure(i * 0.7);
      f.group.position.set(spots[i].x, 0, spots[i].z);
      f.group.rotation.y = Math.PI;
      group.add(f.group);
      officials.push(f);
    }
    var soldiers = [];
    for (var s = 0; s < 5; s++) {
      var sf = qingFigure(s * 0.5);
      sf.group.position.set(-11 + s * 2.2, 0, 2.5);
      sf.group.rotation.y = Math.PI * 0.9;
      group.add(sf.group);
      soldiers.push(sf);
    }

    // The British merchant ships, hulked offshore, watching.
    var hulks = [];
    for (var h = 0; h < 3; h++) {
      var ship = Models.makeShip();
      ship.position.set(-16 + h * 16, -0.4, -58 - h * 7);
      ship.rotation.y = 0.1 * h;
      ship.scale.setScalar(1.1);
      group.add(ship);
      hulks.push(ship);
    }

    return {
      group: group,
      update: function (t, dt) {
        // The chests are emptied and the opium is poured into the sea.
        var pour = Math.max(0, Math.min(1, (t - 1.2) / 5));
        for (var i = 0; i < lumps.length; i++) {
          var l = lumps[i];
          var k = Math.max(0, Math.min(1, (t - 1.5 - i * 0.22) / 2.2));
          l.position.x += (Math.sin(i * 2.7) * 0.012);
          l.position.z -= k * k * 9;
          l.position.y = 0.5 - k * k * 1.1;
          l.scale.setScalar(Math.max(0.05, 1 - k * 0.8));
        }
        for (var c = 0; c < crates.length; c++) {
          crates[c].rotation.y = Math.max(0, Math.min(0.5, (t - 1 - c * 0.08) * 0.05));
        }
        for (var o = 0; o < officials.length; o++) {
          var anim = officials[o].group.userData.animator;
          if (anim) anim.update(dt);
        }
        for (var g = 0; g < soldiers.length; g++) {
          var sa = soldiers[g].group.userData.animator;
          if (sa) sa.update(dt);
        }
        for (var hh = 0; hh < hulks.length; hh++) {
          hulks[hh].position.y = -0.4 + Math.sin(t * 0.6 + hh) * 0.12;
        }
        void pour;
      },
      dispose: function () { disposeGroup(group); },
    };
  }

  // --- Set 2: the British squadron enters the strait, 23 February 1841 -----
  function squadronApproach(ctx) {
    var group = new THREE.Group();
    group.name = 'scene-squadron';

    group.add(plane(300, 300, 0x2a5f8c, 0, 0, 0, { roughness: 0.35, transparent: true, opacity: 0.95 }));
    // The banks of the strait, with the forts on them.
    group.add(box(120, 3, 60, 0xc2a271, 0, -1, 46));
    group.add(box(120, 3, 60, 0xc2a271, 0, -1, -46));
    var fortSpots = [
      { x: -16, z: 32 }, { x: 14, z: 30 }, { x: -18, z: -30 }, { x: 16, z: -32 },
    ];
    for (var f = 0; f < fortSpots.length; f++) {
      var wall = Models.makeFortWall(16, 3.2);
      wall.position.set(fortSpots[f].x, 0, fortSpots[f].z);
      wall.rotation.y = fortSpots[f].z > 0 ? Math.PI : 0;
      group.add(wall);
      var gun = Models.makeCannon();
      gun.position.set(fortSpots[f].x, 0, fortSpots[f].z + (fortSpots[f].z > 0 ? -2 : 2));
      group.add(gun);
    }

    var ships = [];
    var defs = [
      { x: -9, z: -34, rot: 0.1, s: 1.15 },
      { x: 7, z: -52, rot: -0.05, s: 1.0 },
      { x: -20, z: -70, rot: 0.2, s: 1.25 },
      { x: 18, z: -86, rot: -0.15, s: 0.95 },
    ];
    for (var i = 0; i < defs.length; i++) {
      var ship = Models.makeShip();
      ship.position.set(defs[i].x, -0.6, defs[i].z);
      ship.rotation.y = defs[i].rot;
      ship.scale.setScalar(defs[i].s);
      group.add(ship);
      ships.push({ mesh: ship, def: defs[i] });
    }

    return {
      group: group,
      update: function (t, dt) {
        for (var i = 0; i < ships.length; i++) {
          var s = ships[i];
          s.mesh.position.z += dt * 1.6;
          s.mesh.position.y = -0.6 + Math.sin(t * 0.9 + i) * 0.1;
          s.mesh.rotation.z = Math.sin(t * 0.7 + i) * 0.015;
        }
      },
      dispose: function () { disposeGroup(group); },
    };
  }

  // --- Set 3: the assault on the rear wall, 26 February 1841 -------------
  function rearAssault(ctx) {
    var group = new THREE.Group();
    group.name = 'scene-assault';

    group.add(plane(200, 200, 0xd6bf8e, 0, 0, 0, { roughness: 1 }));
    // The fort wall seen from the land side.
    var wall = Models.makeFortWall(40, 4.2);
    wall.position.set(0, 0, 0);
    group.add(wall);
    var wall2 = Models.makeFortWall(26, 4.2);
    wall2.position.set(-32, 0, 10);
    wall2.rotation.y = Math.PI / 2;
    group.add(wall2);

    // The scaling ladders against the stone.
    var ladders = [];
    var ladderSpots = [-7, -1, 6, 12];
    for (var l = 0; l < ladderSpots.length; l++) {
      var lad = new THREE.Group();
      var rails = [-0.32, 0.32];
      for (var r = 0; r < 2; r++) {
        var rail = box(0.09, 6.4, 0.09, 0x6b4a2f, rails[r], 3.2, 0);
        lad.add(rail);
      }
      for (var s = 0; s < 10; s++) {
        var rung = box(0.72, 0.07, 0.07, 0x5a3d26, 0, 0.45 + s * 0.6, 0);
        lad.add(rung);
      }
      lad.position.set(ladderSpots[l], 0, 2.2);
      lad.rotation.x = -0.22;
      group.add(lad);
      ladders.push(lad);
    }

    // The scaling column: marines going up, red coats, bayonets fixed.
    var climbers = [];
    for (var i = 0; i < 10; i++) {
      var f = figure(i % 3 === 0 ? 'marine' : 'british', 'walk', i * 0.3);
      var lane = ladderSpots[i % ladderSpots.length] + (Math.random() - 0.5) * 0.8;
      f.group.position.set(lane, 0, 4.5 + (i % 3) * 0.8);
      f.group.rotation.y = Math.PI;
      group.add(f.group);
      climbers.push({ rig: f, lane: lane, laneZ: f.group.position.z, phase: i * 0.6 });
    }

    // The Qing defenders on the rampart.
    var defenders = [];
    for (var d = 0; d < 6; d++) {
      var q = qingFigure(d * 0.6);
      q.group.position.set(-14 + d * 5.5, 4.2, -1.2);
      q.group.rotation.y = 0;
      group.add(q.group);
      defenders.push(q);
    }

    // Smoke of the bombardment behind the wall.
    var puffs = [];
    for (var p = 0; p < 10; p++) {
      var puff = new THREE.Mesh(
        new THREE.SphereGeometry(0.6 + Math.random() * 0.5, 7, 5),
        mat(0x4a4a4a, { roughness: 1, transparent: true, opacity: 0.5 })
      );
      puff.position.set(-18 + Math.random() * 36, 4 + Math.random() * 4, -3 - Math.random() * 3);
      group.add(puff);
      puffs.push({ mesh: puff, vx: (Math.random() - 0.5) * 0.5, vy: 0.4 + Math.random() * 0.5, life: Math.random() * 6 });
    }

    var blew = 0;
    return {
      group: group,
      update: function (t, dt) {
        // The column climbs.
        for (var i = 0; i < climbers.length; i++) {
          var c = climbers[i];
          var k = Math.max(0, Math.min(1, (t - i * 0.35) / 5));
          c.rig.group.position.z = c.laneZ - k * 2.6;
          c.rig.group.position.y = k * 2.2;
          var anim = c.rig.group.userData.animator;
          if (anim) anim.update(dt * (0.6 + k));
        }
        for (var d = 0; d < defenders.length; d++) {
          var da = defenders[d].group.userData.animator;
          if (da) da.update(dt);
        }
        // Smoke rolls over the parapet.
        for (var p = 0; p < puffs.length; p++) {
          var pf = puffs[p];
          pf.life += dt;
          pf.mesh.position.x += pf.vx * dt;
          pf.mesh.position.y += pf.vy * dt;
          pf.mesh.scale.multiplyScalar(1 + dt * 0.35);
          if (pf.life > 7) {
            pf.life = 0;
            pf.mesh.position.set(-18 + Math.random() * 36, 4 + Math.random() * 3, -3 - Math.random() * 3);
            pf.mesh.scale.setScalar(0.6 + Math.random() * 0.5);
          }
          pf.mesh.material.opacity = Math.max(0, 0.5 - pf.life * 0.05);
        }
        // Shells landing on the wall.
        if (ctx && ctx.effects && t > blew + 1.4) {
          blew = t;
          ctx.effects.explosion({
            x: -16 + Math.random() * 32,
            y: 4.5 + Math.random() * 1.5,
            z: -2 + Math.random() * 2,
          });
        }
      },
      dispose: function () { disposeGroup(group); },
    };
  }

  // --- Set 4: the fort taken, 26 February 1841, afternoon -----------------
  function theFall(ctx) {
    var group = new THREE.Group();
    group.name = 'scene-fall';

    group.add(plane(240, 240, 0xcaa87a, 0, 0, 0, { roughness: 1 }));
    var wall = Models.makeFortWall(40, 4.2);
    group.add(wall);
    var wall2 = Models.makeFortWall(26, 4.2);
    wall2.position.set(-32, 0, 10);
    wall2.rotation.y = Math.PI / 2;
    group.add(wall2);

    // The captured guns, lined up and disarmed.
    var guns = [];
    for (var g = 0; g < 5; g++) {
      var gun = Models.makeCannon();
      gun.position.set(-14 + g * 7, 0, 7 + (g % 2) * 2);
      gun.rotation.y = Math.PI * 0.5 + g * 0.2;
      group.add(gun);
      guns.push(gun);
    }

    // The British flag on the wall, and the minute-gun salute from the river.
    var flag = box(0.08, 2.2, 3.2, 0x9c2b25, -3, 5.2, -0.5);
    group.add(flag);
    var pole = box(0.12, 3.4, 0.12, 0x4a3421, -3, 5.4, -2.0);
    group.add(pole);

    var ships = [];
    for (var s = 0; s < 2; s++) {
      var ship = Models.makeShip();
      ship.position.set(-24 + s * 40, -0.6, -60 - s * 14);
      ship.scale.setScalar(1.2);
      group.add(ship);
      ships.push(ship);
    }

    // British soldiers holding the wall.
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
      update: function (t, dt) {
        for (var i = 0; i < holders.length; i++) {
          var a = holders[i].group.userData.animator;
          if (a) a.update(dt);
        }
        flag.rotation.z = Math.sin(t * 1.6) * 0.06;
        for (var s2 = 0; s2 < ships.length; s2++) {
          ships[s2].position.y = -0.6 + Math.sin(t * 0.8 + s2) * 0.1;
        }
        // The minute-gun salute.
        if (ctx && ctx.effects && t > salute + 1.1) {
          salute = t;
          ctx.effects.muzzleFlash(
            { x: ships[0].position.x, y: 2.2, z: ships[0].position.z + 8 },
            { x: 0, y: 0.1, z: 1 },
            { big: true }
          );
        }
      },
      dispose: function () { disposeGroup(group); },
    };
  }

  return {
    opiumDestruction: opiumDestruction,
    squadronApproach: squadronApproach,
    rearAssault: rearAssault,
    theFall: theFall,
    figure: figure,
    qingFigure: qingFigure,
  };
})();

if (typeof module !== 'undefined') module.exports = Scenes;

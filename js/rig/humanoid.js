// Procedural skeletal rig for the game's soldiers.
//
// Everything is generated in code: the bone hierarchy, the skinned geometry
// and the skin weights. No external model files, so the game keeps working
// offline and the repo stays asset-free.
//
// Browser global `Rig`; also guarded for Node tooling consistency.
//
// Rig.buildSoldier({ faction: 'british' | 'qing' }) -> {
//   group,      THREE.Group to add to the scene
//   mesh,       THREE.SkinnedMesh
//   skeleton,   THREE.Skeleton
//   bones,      array of THREE.Bone in parent-first order
//   byName,     { boneName: THREE.Bone }
//   rest,       { boneName: { p: Vector3, q: Quaternion } } bind pose
//   hold,       { boneName: { q: Quaternion } }  always-on layer (musket grip)
//   height,
// }

var Rig = (function () {
  var DEG = Math.PI / 180;

  // --- Palette -------------------------------------------------------------
  // british: line infantry of the 26th and 49th regiments.
  // marine:  Royal Marines, who led the assault from the rear.
  // officer:  the officer whose fall demoralises the garrison.
  // qing:     Guangdong garrison (Lübing) with the conical straw hat.
  var PALETTE = {
    british: {
      coat: 0xa82a1f,
      trousers: 0xe4dfd0,
      skin: 0xd7a578,
      hat: 0x1a1a1a,
      leather: 0x4a3222,
      strap: 0xf0ece0,
      metal: 0x9a9aa2,
      accent: 0x2f4a78,
    },
    marine: {
      coat: 0x8e2318,
      trousers: 0xe8e4d8,
      skin: 0xd7a578,
      hat: 0x1c1c1c,
      leather: 0x4a3222,
      strap: 0xf4f0e4,
      metal: 0xb9b9c0,
      accent: 0xd8b34a,
    },
    officer: {
      coat: 0x1f3050,
      trousers: 0xd8cfb8,
      skin: 0xd7a578,
      hat: 0x141414,
      leather: 0x3a2a1c,
      strap: 0xd8b34a,
      metal: 0xc9c9d2,
      accent: 0xd8b34a,
    },
    qing: {
      coat: 0x2f4a78,
      trousers: 0x1f3558,
      skin: 0xd7a578,
      hat: 0xc9b07e,
      leather: 0x4a3222,
      strap: 0x8f2f24,
      metal: 0x9a9aa2,
      accent: 0xd9b45a,
    },
  };

  // --- Bone hierarchy ------------------------------------------------------
  // The character faces -Z. Its right hand is at +X.
  function skeletonSpec() {
    return [
      { name: 'root', parent: null, pos: [0, 0, 0] },
      { name: 'hips', parent: 'root', pos: [0, 0.95, 0] },
      { name: 'spine', parent: 'hips', pos: [0, 0.18, 0] },
      { name: 'chest', parent: 'spine', pos: [0, 0.18, 0] },
      { name: 'neck', parent: 'chest', pos: [0, 0.18, 0] },
      { name: 'head', parent: 'neck', pos: [0, 0.1, 0] },
      { name: 'shoulderR', parent: 'chest', pos: [0.08, 0.12, 0] },
      { name: 'upperArmR', parent: 'shoulderR', pos: [0.13, -0.03, 0] },
      { name: 'forearmR', parent: 'upperArmR', pos: [0, -0.29, 0] },
      { name: 'handR', parent: 'forearmR', pos: [0, -0.27, 0] },
      { name: 'shoulderL', parent: 'chest', pos: [-0.08, 0.12, 0] },
      { name: 'upperArmL', parent: 'shoulderL', pos: [-0.13, -0.03, 0] },
      { name: 'forearmL', parent: 'upperArmL', pos: [0, -0.29, 0] },
      { name: 'handL', parent: 'forearmL', pos: [0, -0.27, 0] },
      { name: 'thighR', parent: 'hips', pos: [0.1, -0.03, 0] },
      { name: 'shinR', parent: 'thighR', pos: [0, -0.45, 0] },
      { name: 'footR', parent: 'shinR', pos: [0, -0.43, 0] },
      { name: 'thighL', parent: 'hips', pos: [-0.1, -0.03, 0] },
      { name: 'shinL', parent: 'thighL', pos: [0, -0.45, 0] },
      { name: 'footL', parent: 'shinL', pos: [0, -0.43, 0] },
      // The musket hangs from the chest so its aim can be authored directly
      // (a child of the hand would inherit the whole arm chain and could not
      // be aimed independently). The arms are posed to meet it.
      { name: 'weapon', parent: 'chest', pos: [0.15, -0.26, 0.02] },
    ];
  }

  function buildSkeleton(spec) {
    var bones = [];
    var byName = {};
    var bindPos = {};
    var bind = {};
    for (var i = 0; i < spec.length; i++) {
      var def = spec[i];
      var bone = new THREE.Bone();
      bone.name = def.name;
      bone.position.set(def.pos[0], def.pos[1], def.pos[2]);
      var parent = def.parent ? byName[def.parent] : null;
      var local = new THREE.Vector3(def.pos[0], def.pos[1], def.pos[2]);
      if (parent) {
        parent.add(bone);
        bindPos[def.name] = bindPos[def.parent].clone().add(local);
      } else {
        bindPos[def.name] = local.clone();
      }
      bones.push(bone);
      byName[def.name] = bone;
      bind[def.name] = local.clone();
    }
    return { bones: bones, byName: byName, bindPos: bindPos, bind: bind };
  }

  // --- Geometry builder ----------------------------------------------------
  // Flat-shaded, non-indexed geometry grouped per material, with skin
  // weights resolved from the distance to the influencing bone segments.
  function Builder(skeleton) {
    this.skeleton = skeleton;
    this.groups = []; // { mat: index, pos: [], nor: [], si: [], sw: [] }
  }

  Builder.prototype.group = function (mat) {
    var g = { mat: mat, pos: [], nor: [], si: [], sw: [] };
    this.groups.push(g);
    return g;
  };

  // Distance from p to the segment a->b.
  function distToSegment(px, py, pz, a, b) {
    var abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
    var apx = px - a.x, apy = py - a.y, apz = pz - a.z;
    var len2 = abx * abx + aby * aby + abz * abz;
    var t = 0;
    if (len2 > 1e-9) t = (apx * abx + apy * aby + apz * abz) / len2;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    var cx = a.x + abx * t - px;
    var cy = a.y + aby * t - py;
    var cz = a.z + abz * t - pz;
    return Math.sqrt(cx * cx + cy * cy + cz * cz);
  }

  // Weights of a vertex over the influencing bones (max 4).
  Builder.prototype.weights = function (px, py, pz, infl) {
    var sk = this.skeleton;
    var list = [];
    var total = 0;
    for (var i = 0; i < infl.length; i++) {
      var name = infl[i];
      var a = sk.bindPos[name];
      if (!a) continue;
      var b = a;
      var child = sk.childOf[name];
      if (child && sk.bindPos[child]) b = sk.bindPos[child];
      var d = distToSegment(px, py, pz, a, b);
      var w = 1 / (d * d + 0.004);
      list.push({ index: sk.indexOf[name], w: w });
      total += w;
    }
    list.sort(function (x, y) { return y.w - x.w; });
    var out = [[0, 0], [0, 0], [0, 0], [0, 0]];
    var sum = 0;
    for (var k = 0; k < list.length && k < 4; k++) {
      var share = list[k].w / (total || 1);
      out[k] = [list[k].index, share];
      sum += share;
    }
    if (sum > 0) {
      for (var m = 0; m < 4; m++) out[m][1] /= sum;
    } else {
      out[0] = [sk.indexOf[infl[0] || 'hips'], 1];
    }
    return out;
  };

  Builder.prototype.vertex = function (g, x, y, z, nx, ny, nz, infl) {
    g.pos.push(x, y, z);
    g.nor.push(nx, ny, nz);
    var w = this.weights(x, y, z, infl);
    g.si.push(w[0][0], w[1][0], w[2][0], w[3][0]);
    g.sw.push(w[0][1], w[1][1], w[2][1], w[3][1]);
  };

  // Quad with a flat normal (two triangles).
  Builder.prototype.quad = function (g, p0, p1, p2, p3, infl) {
    var ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2];
    var vx = p3[0] - p0[0], vy = p3[1] - p0[1], vz = p3[2] - p0[2];
    var nx = uy * vz - uz * vy;
    var ny = uz * vx - ux * vz;
    var nz = ux * vy - uy * vx;
    var len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    nx /= len; ny /= len; nz /= len;
    this.vertex(g, p0[0], p0[1], p0[2], nx, ny, nz, infl);
    this.vertex(g, p1[0], p1[1], p1[2], nx, ny, nz, infl);
    this.vertex(g, p2[0], p2[1], p2[2], nx, ny, nz, infl);
    this.vertex(g, p0[0], p0[1], p0[2], nx, ny, nz, infl);
    this.vertex(g, p2[0], p2[1], p2[2], nx, ny, nz, infl);
    this.vertex(g, p3[0], p3[1], p3[2], nx, ny, nz, infl);
  };

  // Tapered elliptical prism from a to b.
  Builder.prototype.prism = function (g, a, b, ra, rb, sides, infl) {
    var dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    var len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    var dir = [dx / len, dy / len, dz / len];
    var up = Math.abs(dir[1]) > 0.95 ? [0, 0, 1] : [0, 1, 0];
    var rx = dir[1] * up[2] - dir[2] * up[1];
    var ry = dir[2] * up[0] - dir[0] * up[2];
    var rz = dir[0] * up[1] - dir[1] * up[0];
    var rl = Math.sqrt(rx * rx + ry * ry + rz * rz) || 1;
    rx /= rl; ry /= rl; rz /= rl;
    var ux = dir[1] * rz - dir[2] * ry;
    var uy = dir[2] * rx - dir[0] * rz;
    var uz = dir[0] * ry - dir[1] * rx;

    function ring(center, rxr, rzr, i) {
      var ang = (i / sides) * Math.PI * 2;
      var c = Math.cos(ang), s = Math.sin(ang);
      return [
        center[0] + rx * c * rxr + ux * s * rzr,
        center[1] + ry * c * rxr + uy * s * rzr,
        center[2] + rz * c * rxr + uz * s * rzr,
      ];
    }
    for (var i = 0; i < sides; i++) {
      var a0 = ring(a, ra[0], ra[1], i);
      var a1 = ring(a, ra[0], ra[1], i + 1);
      var b0 = ring(b, rb[0], rb[1], i);
      var b1 = ring(b, rb[0], rb[1], i + 1);
      this.quad(g, a0, a1, b1, b0, infl);
    }
  };

  Builder.prototype.box = function (g, center, size, infl) {
    var hx = size[0] / 2, hy = size[1] / 2, hz = size[2] / 2;
    var x0 = center[0] - hx, x1 = center[0] + hx;
    var y0 = center[1] - hy, y1 = center[1] + hy;
    var z0 = center[2] - hz, z1 = center[2] + hz;
    var F = [x0, y0, z1], B = [x1, y0, z1], C = [x1, y1, z1], D = [x0, y1, z1];
    var E = [x0, y0, z0], G = [x1, y0, z0], H = [x1, y1, z0], I = [x0, y1, z0];
    this.quad(g, F, B, C, D, infl); // +Z
    this.quad(g, G, E, I, H, infl); // -Z
    this.quad(g, B, G, H, C, infl); // +X
    this.quad(g, E, F, D, I, infl); // -X
    this.quad(g, D, C, H, I, infl); // +Y
    this.quad(g, E, G, B, F, infl); // -Y
  };

  Builder.prototype.cone = function (g, base, apex, r, sides, infl) {
    var dx = apex[0] - base[0], dy = apex[1] - base[1], dz = apex[2] - base[2];
    var len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    var dir = [dx / len, dy / len, dz / len];
    var up = Math.abs(dir[1]) > 0.95 ? [0, 0, 1] : [0, 1, 0];
    var rx = dir[1] * up[2] - dir[2] * up[1];
    var ry = dir[2] * up[0] - dir[0] * up[2];
    var rz = dir[0] * up[1] - dir[1] * up[0];
    var rl = Math.sqrt(rx * rx + ry * ry + rz * rz) || 1;
    rx /= rl; ry /= rl; rz /= rl;
    var ux = dir[1] * rz - dir[2] * ry;
    var uy = dir[2] * rx - dir[0] * rz;
    var uz = dir[0] * ry - dir[1] * rx;
    for (var i = 0; i < sides; i++) {
      var a0 = (i / sides) * Math.PI * 2;
      var a1 = ((i + 1) / sides) * Math.PI * 2;
      var p0 = [base[0] + (rx * Math.cos(a0) + ux * Math.sin(a0)) * r,
                base[1] + (ry * Math.cos(a0) + uy * Math.sin(a0)) * r,
                base[2] + (rz * Math.cos(a0) + uz * Math.sin(a0)) * r];
      var p1 = [base[0] + (rx * Math.cos(a1) + ux * Math.sin(a1)) * r,
                base[1] + (ry * Math.cos(a1) + uy * Math.sin(a1)) * r,
                base[2] + (rz * Math.cos(a1) + uz * Math.sin(a1)) * r];
      this.tri(g, p0, p1, apex, infl);
    }
  };

  Builder.prototype.tri = function (g, p0, p1, p2, infl) {
    var ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2];
    var vx = p2[0] - p0[0], vy = p2[1] - p0[1], vz = p2[2] - p0[2];
    var nx = uy * vz - uz * vy;
    var ny = uz * vx - ux * vz;
    var nz = ux * vy - uy * vx;
    var len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    nx /= len; ny /= len; nz /= len;
    this.vertex(g, p0[0], p0[1], p0[2], nx, ny, nz, infl);
    this.vertex(g, p1[0], p1[1], p1[2], nx, ny, nz, infl);
    this.vertex(g, p2[0], p2[1], p2[2], nx, ny, nz, infl);
  };

  // --- Soldier body --------------------------------------------------------
  function buildBody(b, sk, pal, faction) {
    var bp = sk.bindPos;
    var gCoat = b.group(0);
    var gPants = b.group(1);
    var gSkin = b.group(2);
    var gHat = b.group(3);
    var gLeather = b.group(4);
    var gStrap = b.group(5);

    var R = 'R', L = 'L';

    // Torso
    b.prism(gCoat, [0, 0.84, 0], [0, 0.99, 0], [0.145, 0.105], [0.15, 0.107], 8, ['hips', 'spine']);
    b.prism(gCoat, [0, 0.99, 0], [0, 1.21, 0], [0.152, 0.108], [0.163, 0.112], 8, ['hips', 'spine', 'chest']);
    b.prism(gCoat, [0, 1.21, 0], [0, 1.45, 0], [0.163, 0.112], [0.188, 0.118], 8, ['spine', 'chest', 'neck']);

    // Neck + head
    b.prism(gSkin, [0, 1.43, 0], [0, 1.55, 0], [0.055, 0.055], [0.05, 0.05], 6, ['chest', 'neck', 'head']);
    b.prism(gSkin, [0, 1.52, 0], [0, 1.73, 0], [0.094, 0.1], [0.086, 0.093], 8, ['head', 'neck']);
    // Face plate keeps the low-poly head from reading as a featureless egg.
    b.box(gSkin, [0, 1.62, -0.085], [0.1, 0.09, 0.03], ['head']);

    // Hat
    if (faction === 'qing') {
      // The classic conical straw hat of the Guangdong garrison.
      b.cone(gHat, [0, 1.66, 0], [0, 1.92, 0], 0.33, 14, ['head']);
      // Queue (braid) behind the hat
      b.prism(gLeather, [0, 1.66, 0.09], [0, 1.4, 0.11], [0.045, 0.045], [0.03, 0.03], 6, ['head', 'neck']);
    } else {
      // British shako: tall cylinder + peak
      b.prism(gHat, [0, 1.68, 0], [0, 1.9, 0], [0.112, 0.112], [0.1, 0.1], 10, ['head']);
      b.prism(gHat, [0, 1.66, 0], [0, 1.69, 0], [0.128, 0.128], [0.128, 0.128], 10, ['head']);
      b.box(gHat, [0, 1.71, -0.12], [0.2, 0.025, 0.1], ['head']);
      if (pal.accent === 0xd8b34a) {
        // Officer's plume on the left side of the shako.
        b.prism(gStrap, [0.1, 1.92, 0.02], [0.09, 2.06, -0.02], [0.035, 0.035], [0.02, 0.02], 6, ['head']);
      }
    }

    // Arms. The shoulder bone is left out of the influence list on purpose:
    // blending it with the upper arm made the deltoid bulge like a wing when
    // the arm rotated. A shoulder cap bound to the shoulder bone covers the
    // joint instead, and the IK keeps that bone still.
    var armR = ['upperArm' + R, 'forearm' + R, 'hand' + R];
    var armL = ['upperArm' + L, 'forearm' + L, 'hand' + L];
    b.box(gCoat, [bp.upperArmR.x - 0.03, bp.upperArmR.y + 0.035, bp.upperArmR.z],
      [0.15, 0.15, 0.17], ['shoulder' + R]);
    b.box(gCoat, [bp.upperArmL.x + 0.03, bp.upperArmL.y + 0.035, bp.upperArmL.z],
      [0.15, 0.15, 0.17], ['shoulder' + L]);
    b.prism(gCoat, [bp.upperArmR.x, bp.upperArmR.y, bp.upperArmR.z],
      [bp.forearmR.x, bp.forearmR.y, bp.forearmR.z], [0.072, 0.072], [0.052, 0.052], 7, armR);
    b.prism(gSkin, [bp.forearmR.x, bp.forearmR.y, bp.forearmR.z],
      [bp.handR.x, bp.handR.y, bp.handR.z], [0.05, 0.05], [0.041, 0.041], 7, ['upperArm' + R, 'forearm' + R, 'hand' + R]);
    b.box(gSkin, [bp.handR.x, bp.handR.y - 0.045, bp.handR.z], [0.075, 0.11, 0.055], ['forearm' + R, 'hand' + R]);

    b.prism(gCoat, [bp.upperArmL.x, bp.upperArmL.y, bp.upperArmL.z],
      [bp.forearmL.x, bp.forearmL.y, bp.forearmL.z], [0.072, 0.072], [0.052, 0.052], 7, armL);
    b.prism(gSkin, [bp.forearmL.x, bp.forearmL.y, bp.forearmL.z],
      [bp.handL.x, bp.handL.y, bp.handL.z], [0.05, 0.05], [0.041, 0.041], 7, ['upperArm' + L, 'forearm' + L, 'hand' + L]);
    b.box(gSkin, [bp.handL.x, bp.handL.y - 0.045, bp.handL.z], [0.075, 0.11, 0.055], ['forearm' + L, 'hand' + L]);

    // Legs
    b.prism(gPants, [bp.thighR.x, bp.thighR.y, bp.thighR.z],
      [bp.shinR.x, bp.shinR.y, bp.shinR.z], [0.088, 0.088], [0.066, 0.066], 7, ['hips', 'thigh' + R, 'shin' + R]);
    b.prism(gPants, [bp.shinR.x, bp.shinR.y, bp.shinR.z],
      [bp.footR.x, bp.footR.y, bp.footR.z], [0.066, 0.066], [0.05, 0.05], 7, ['thigh' + R, 'shin' + R, 'foot' + R]);
    b.box(gLeather, [bp.footR.x, bp.footR.y - 0.035, bp.footR.z - 0.055], [0.105, 0.07, 0.235], ['shin' + R, 'foot' + R]);

    b.prism(gPants, [bp.thighL.x, bp.thighL.y, bp.thighL.z],
      [bp.shinL.x, bp.shinL.y, bp.shinL.z], [0.088, 0.088], [0.066, 0.066], 7, ['hips', 'thigh' + L, 'shin' + L]);
    b.prism(gPants, [bp.shinL.x, bp.shinL.y, bp.shinL.z],
      [bp.footL.x, bp.footL.y, bp.footL.z], [0.066, 0.066], [0.05, 0.05], 7, ['thigh' + L, 'shin' + L, 'foot' + L]);
    b.box(gLeather, [bp.footL.x, bp.footL.y - 0.035, bp.footL.z - 0.055], [0.105, 0.07, 0.235], ['shin' + L, 'foot' + L]);

    // Kit: belt, crossbelt and the cartridge box on the hip.
    b.prism(gLeather, [0, 0.9, 0], [0, 0.985, 0], [0.152, 0.112], [0.152, 0.112], 8, ['hips']);
    if (faction === 'british') {
      // White crossbelt from the right shoulder to the left hip.
      b.prism(gStrap, [0.1, 1.42, -0.1], [-0.11, 0.92, 0.11], [0.026, 0.012], [0.026, 0.012], 4,
        ['chest', 'spine', 'hips']);
      b.box(gLeather, [-0.15, 0.95, 0.04], [0.07, 0.11, 0.14], ['hips']);
    } else {
      // Qing: red sash and a Qing-style jacket skirt.
      b.prism(gStrap, [0, 1.0, 0], [0, 1.06, 0], [0.157, 0.115], [0.157, 0.115], 8, ['hips', 'spine']);
      b.prism(gCoat, [0, 0.78, 0], [0, 0.9, 0], [0.155, 0.115], [0.152, 0.112], 8, ['hips']);
    }

    return [gCoat, gPants, gSkin, gHat, gLeather, gStrap];
  }

  function buildGeometry(b) {
    var geo = new THREE.BufferGeometry();
    var positions = [];
    var normals = [];
    var skinIndices = [];
    var skinWeights = [];
    var groups = [];
    var offset = 0;
    for (var i = 0; i < b.groups.length; i++) {
      var g = b.groups[i];
      if (!g.pos.length) continue;
      for (var p = 0; p < g.pos.length; p++) positions.push(g.pos[p]);
      for (var n = 0; n < g.nor.length; n++) normals.push(g.nor[n]);
      for (var s = 0; s < g.si.length; s++) skinIndices.push(g.si[s]);
      for (var w = 0; w < g.sw.length; w++) skinWeights.push(g.sw[w]);
      groups.push({ start: offset, count: g.pos.length / 3, materialIndex: i });
      offset += g.pos.length / 3;
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
    for (var gi = 0; gi < groups.length; gi++) geo.addGroup(groups[gi].start, groups[gi].count, groups[gi].materialIndex);
    geo.computeBoundingSphere();
    return geo;
  }

  function materialsFor(pal) {
    function m(color, metal) {
      return new THREE.MeshStandardMaterial({
        color: color,
        roughness: metal ? 0.45 : 0.92,
        metalness: metal ? 0.6 : 0.0,
        flatShading: true,
      });
    }
    return [m(pal.coat), m(pal.trousers), m(pal.skin), m(pal.hat), m(pal.leather), m(pal.strap)];
  }

  // The musket is rigid and hangs from the 'weapon' bone, so it follows the
  // right hand through every animation.
  function buildMusket(pal, scale) {
    var g = new THREE.Group();
    var s = scale || 1;
    function std(color, metal, rough) {
      return new THREE.MeshStandardMaterial({
        color: color, metalness: metal ? 0.65 : 0.0, roughness: rough || 0.6, flatShading: true,
      });
    }
    var wood = std(pal.leather, false, 0.85);
    var iron = std(0x3b3b40, true, 0.4);
    var barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014 * s, 0.016 * s, 0.92 * s, 8), iron);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0, -0.2 * s);
    var stock = new THREE.Mesh(new THREE.BoxGeometry(0.05 * s, 0.085 * s, 0.42 * s), wood);
    stock.position.set(0, -0.018 * s, 0.2 * s);
    var butt = new THREE.Mesh(new THREE.BoxGeometry(0.055 * s, 0.115 * s, 0.06 * s), wood);
    butt.position.set(0, -0.03 * s, 0.42 * s);
    var lock = new THREE.Mesh(new THREE.BoxGeometry(0.03 * s, 0.05 * s, 0.1 * s), iron);
    lock.position.set(0.028 * s, 0.005 * s, 0.1 * s);
    var ramrod = new THREE.Mesh(new THREE.CylinderGeometry(0.007 * s, 0.007 * s, 0.5 * s, 6), iron);
    ramrod.rotation.x = Math.PI / 2;
    ramrod.position.set(-0.02 * s, -0.045 * s, 0.02 * s);
    var bayonet = new THREE.Mesh(new THREE.ConeGeometry(0.022 * s, 0.2 * s, 6), std(0xd8dde2, true, 0.25));
    bayonet.rotation.x = -Math.PI / 2;
    bayonet.position.set(0, 0, -0.74 * s);
    g.add(barrel, stock, butt, lock, ramrod, bayonet);
    g.userData = { type: 'musket' };
    return g;
  }

  // The always-on layer: how the musket is carried at the ready. The arms
  // are not authored here — the IK solver drives them from the hand targets,
  // so the hands always end up on the weapon.
  function holdPose(sk) {
    var hold = {};
    function e(name, x, y, z) {
      var q = new THREE.Quaternion();
      var eu = new THREE.Euler(x, y, z, 'XYZ');
      q.setFromEuler(eu);
      hold[name] = { q: q };
    }
    // Muzzle up and across: the port-arms carry.
    e('weapon', 1.05, 0.3, 0);
    return hold;
  }

  // Arm lengths and joint anchors, in the chest's local frame. The IK solver
  // works in this frame so the torso can rotate freely.
  function ikData(sk) {
    var chest = sk.bindPos.chest;
    var upperR = sk.bindPos.upperArmR;
    var foreR = sk.bindPos.forearmR;
    var handR = sk.bindPos.handR;
    var upperL = sk.bindPos.upperArmL;
    var foreL = sk.bindPos.forearmL;
    var handL = sk.bindPos.handL;
    return {
      L1R: upperR.distanceTo(foreR),
      L2R: foreR.distanceTo(handR),
      L1L: upperL.distanceTo(foreL),
      L2L: foreL.distanceTo(handL),
      shoulderR: upperR.clone().sub(chest),
      shoulderL: upperL.clone().sub(chest),
      weaponRest: sk.bindPos.weapon.clone().sub(chest),
      // Grip points on the musket, relative to the weapon bone.
      grip: new THREE.Vector3(0, -0.04, 0.14),
      barrel: new THREE.Vector3(0, 0.03, -0.16),
      pouch: new THREE.Vector3(-0.12, -0.33, 0.07),
    };
  }

  function buildSoldier(options) {
    options = options || {};
    var faction = options.faction === 'qing' ? 'qing' : 'british';
    var variant = options.variant && PALETTE[options.variant] ? options.variant : faction;
    var pal = PALETTE[variant];
    var spec = skeletonSpec();
    var sk = buildSkeleton(spec);

    // Segment endpoints for the skin weights: a bone's influence segment runs
    // to its first child.
    sk.childOf = {};
    sk.indexOf = {};
    for (var i = 0; i < spec.length; i++) {
      sk.indexOf[spec[i].name] = i;
      if (spec[i].parent && !sk.childOf[spec[i].parent]) sk.childOf[spec[i].parent] = spec[i].name;
    }

    var b = new Builder(sk);
    buildBody(b, sk, pal, faction);
    var geo = buildGeometry(b);

    var skeleton = new THREE.Skeleton(sk.bones);
    var mesh = new THREE.SkinnedMesh(geo, materialsFor(pal));
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Bind before the mesh joins a parent: the bind matrix must match the
    // mesh's local space, otherwise the skeleton double-applies the offset.
    sk.bones[0].updateMatrixWorld(true);
    mesh.add(sk.bones[0]);
    mesh.bind(skeleton);

    var group = new THREE.Group();
    group.name = 'soldier-' + faction;
    group.add(mesh);

    // Rest pose (bind pose) for every bone.
    var rest = {};
    for (var n = 0; n < spec.length; n++) {
      var name = spec[n].name;
      rest[name] = {
        p: new THREE.Vector3(spec[n].pos[0], spec[n].pos[1], spec[n].pos[2]),
        q: new THREE.Quaternion(),
      };
    }

    var rig = {
      group: group,
      mesh: mesh,
      skeleton: skeleton,
      bones: sk.bones,
      byName: sk.byName,
      boneNames: spec.map(function (s) { return s.name; }),
      rest: rest,
      hold: holdPose(sk),
      ik: ikData(sk),
      height: 1.9,
      faction: faction,
      variant: variant,
    };

    if (options.weapon !== false) {
      var musket = buildMusket(pal, 1);
      // The bone sits at the right hand; the musket is aligned so the stock
      // lands in the fist and the barrel points forward.
      musket.position.set(0, 0, 0.02);
      musket.rotation.set(0, 0, 0);
      rig.byName.weapon.add(musket);
      rig.weapon = musket;
    }

    return rig;
  }

  // A first-person viewmodel rig: only the arms and hands, so nothing of the
  // body shows up in front of the camera. Same skeleton maths, own bone list.
  function viewmodelSpec() {
    return [
      { name: 'root', parent: null, pos: [0, 0, 0] },
      { name: 'spine', parent: 'root', pos: [0, 1.13, 0] },
      { name: 'chest', parent: 'spine', pos: [0, 1.31, 0] },
      { name: 'shoulderR', parent: 'chest', pos: [0.08, 0.12, 0] },
      { name: 'upperArmR', parent: 'shoulderR', pos: [0.13, -0.03, 0] },
      { name: 'forearmR', parent: 'upperArmR', pos: [0, -0.29, 0] },
      { name: 'handR', parent: 'forearmR', pos: [0, -0.27, 0] },
      { name: 'shoulderL', parent: 'chest', pos: [-0.08, 0.12, 0] },
      { name: 'upperArmL', parent: 'shoulderL', pos: [-0.13, -0.03, 0] },
      { name: 'forearmL', parent: 'upperArmL', pos: [0, -0.29, 0] },
      { name: 'handL', parent: 'forearmL', pos: [0, -0.27, 0] },
      // The musket hangs in front of the chest, not below it: in first person
      // the shoulders have to stay behind and below the weapon.
      { name: 'weapon', parent: 'chest', pos: [0.12, -0.07, -0.26] },
    ];
  }

  // Arms only: sleeve, forearm and fist.
  function buildArms(b, sk, pal) {
    var bp = sk.bindPos;
    var gCoat = b.group(0);
    var gSkin = b.group(2);
    var gLeather = b.group(4);

    b.prism(gCoat, [bp.upperArmR.x, bp.upperArmR.y, bp.upperArmR.z],
      [bp.forearmR.x, bp.forearmR.y, bp.forearmR.z], [0.07, 0.07], [0.055, 0.055], 8,
      ['upperArmR', 'forearmR']);
    b.prism(gSkin, [bp.forearmR.x, bp.forearmR.y, bp.forearmR.z],
      [bp.handR.x, bp.handR.y, bp.handR.z], [0.052, 0.052], [0.043, 0.043], 8,
      ['upperArmR', 'forearmR', 'handR']);
    b.box(gSkin, [bp.handR.x, bp.handR.y - 0.05, bp.handR.z], [0.08, 0.12, 0.06], ['forearmR', 'handR']);

    b.prism(gCoat, [bp.upperArmL.x, bp.upperArmL.y, bp.upperArmL.z],
      [bp.forearmL.x, bp.forearmL.y, bp.forearmL.z], [0.07, 0.07], [0.055, 0.055], 8,
      ['upperArmL', 'forearmL']);
    b.prism(gSkin, [bp.forearmL.x, bp.forearmL.y, bp.forearmL.z],
      [bp.handL.x, bp.handL.y, bp.handL.z], [0.052, 0.052], [0.043, 0.043], 8,
      ['upperArmL', 'forearmL', 'handL']);
    b.box(gSkin, [bp.handL.x, bp.handL.y - 0.05, bp.handL.z], [0.08, 0.12, 0.06], ['forearmL', 'handL']);

    // Cuffs
    b.prism(gLeather, [bp.forearmR.x, bp.forearmR.y - 0.03, bp.forearmR.z],
      [bp.forearmR.x, bp.forearmR.y - 0.11, bp.forearmR.z], [0.056, 0.056], [0.056, 0.056], 8,
      ['upperArmR', 'forearmR']);
    b.prism(gLeather, [bp.forearmL.x, bp.forearmL.y - 0.03, bp.forearmL.z],
      [bp.forearmL.x, bp.forearmL.y - 0.11, bp.forearmL.z], [0.056, 0.056], [0.056, 0.056], 8,
      ['upperArmL', 'forearmL']);
  }

  function buildViewmodel(options) {
    options = options || {};
    var pal = PALETTE.qing;
    var spec = viewmodelSpec();
    var sk = buildSkeleton(spec);
    sk.childOf = {};
    sk.indexOf = {};
    for (var i = 0; i < spec.length; i++) {
      sk.indexOf[spec[i].name] = i;
      if (spec[i].parent && !sk.childOf[spec[i].parent]) sk.childOf[spec[i].parent] = spec[i].name;
    }

    var b = new Builder(sk);
    buildArms(b, sk, pal);
    var geo = buildGeometry(b);

    var skeleton = new THREE.Skeleton(sk.bones);
    var mesh = new THREE.SkinnedMesh(geo, materialsFor(pal));
    mesh.frustumCulled = false;
    sk.bones[0].updateMatrixWorld(true);
    mesh.add(sk.bones[0]);
    mesh.bind(skeleton);

    var rest = {};
    for (var n = 0; n < spec.length; n++) {
      var name = spec[n].name;
      rest[name] = {
        p: new THREE.Vector3(spec[n].pos[0], spec[n].pos[1], spec[n].pos[2]),
        q: new THREE.Quaternion(),
      };
    }

    var rig = {
      group: mesh,
      mesh: mesh,
      skeleton: skeleton,
      bones: sk.bones,
      byName: sk.byName,
      boneNames: spec.map(function (s) { return s.name; }),
      rest: rest,
      hold: {},
      ik: ikData(sk),
      height: 1.9,
      faction: 'qing',
    };

    if (options.weapon !== false) {
      var musket = buildMusket(pal, 1);
      musket.position.set(0, 0, 0.02);
      rig.byName.weapon.add(musket);
      rig.weapon = musket;
    }

    return rig;
  }

  return {
    PALETTE: PALETTE,
    skeletonSpec: skeletonSpec,
    viewmodelSpec: viewmodelSpec,
    buildSoldier: buildSoldier,
    buildViewmodel: buildViewmodel,
    buildMusket: buildMusket,
  };
})();

if (typeof module !== 'undefined') module.exports = Rig;

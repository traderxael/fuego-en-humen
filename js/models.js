// Low-poly model builders using THREE primitives only (no external assets).
// Browser global script exposing `Models`; optional Node guard for tooling.

var Models = (function () {
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

  function makeBritishSoldier() {
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
    makeShip: makeShip,
    makeFortWall: makeFortWall,
    makeCannon: makeCannon,
  };
})();

if (typeof module !== 'undefined') module.exports = Models;

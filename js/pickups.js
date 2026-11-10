// World pickups: three fixed crates inside the fort plus loot dropped by
// fallen British infantry. No physics bodies and no colliders: the player
// collects with F (see player.tryPickup -> main -> Pickups.tryPickup).

var Pickups = (function () {
  var FIXED = [
    { key: 'medkit', local: [-7, 0.45, -6] },
    { key: 'ammoBag', local: [8, 0.45, 6] },
    { key: 'grenade', local: [0, 0.45, 11] },
  ];
  var RESPAWN_SECONDS = 25;
  var DROP_LIFE = 30;
  var MAX_DROPS = 8;
  var SIZE = 0.34;
  var COLORS = { medkit: 0xe8e4da, ammoBag: 0x8a5a2b, grenade: 0x2f2f33 };

  var geometry = null;
  var materials = {};

  function makeMesh(key) {
    if (!geometry) geometry = new THREE.BoxGeometry(SIZE, SIZE, SIZE);
    if (!materials[key]) {
      materials[key] = new THREE.MeshStandardMaterial({
        color: COLORS[key] || 0xffffff,
        roughness: 0.8,
        emissive: COLORS[key] || 0xffffff,
        emissiveIntensity: 0.12,
      });
    }
    var mesh = new THREE.Mesh(geometry, materials[key]);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.userData.pickupKey = key;
    return mesh;
  }

  function labelFor(key) {
    if (typeof ITEM_DEFS !== 'undefined' && ITEM_DEFS[key] && ITEM_DEFS[key].label) {
      return ITEM_DEFS[key].label;
    }
    return key;
  }

  function setHint(text) {
    if (typeof HUD === 'undefined' || !HUD || typeof HUD.setPickupHint !== 'function') return;
    HUD.setPickupHint(text);
  }

  // Measured from the torso, not the eyes: crates rest at 0.45 m and the
  // camera sits at 1.7 m, which would put them outside the height window.
  function playerPosition(player) {
    if (!player) return null;
    if (player.body && player.body.position) return player.body.position;
    if (player.camera && player.camera.position) return player.camera.position;
    if (player.position) return player.position;
    return null;
  }

  function create(scene, fort, options) {
    var settings = options || {};
    var random = typeof settings.random === 'function' ? settings.random : Math.random;
    var list = [];
    var drops = [];
    var lastTime = 0;
    var hint = null;

    for (var i = 0; i < FIXED.length; i++) {
      var def = FIXED[i];
      var mesh = makeMesh(def.key);
      mesh.position.set(
        fort.position.x + def.local[0],
        def.local[1],
        fort.position.z + def.local[2]
      );
      scene.add(mesh);
      list.push({
        key: def.key,
        kind: 'fixed',
        mesh: mesh,
        active: true,
        base: def.local[1],
        phase: def.local[0] * 0.7,
        respawnAt: 0,
        diesAt: Infinity,
      });
    }

    function dropIndex(item) {
      for (var d = 0; d < drops.length; d++) if (drops[d] === item) return d;
      return -1;
    }

    function removeItem(item) {
      item.active = false;
      if (item.mesh.parent) item.mesh.parent.remove(item.mesh);
      var index = list.indexOf(item);
      if (index >= 0) list.splice(index, 1);
      var dropped = dropIndex(item);
      if (dropped >= 0) drops.splice(dropped, 1);
    }

    function nearest(player) {
      var position = playerPosition(player);
      if (!position) return null;
      var best = null;
      var bestDist = Infinity;
      for (var n = 0; n < list.length; n++) {
        var item = list[n];
        if (!item.active) continue;
        if (!ItemLogic.inPickupRange(position, item.mesh.position)) continue;
        var dx = position.x - item.mesh.position.x;
        var dz = position.z - item.mesh.position.z;
        var dist = Math.hypot(dx, dz);
        if (dist < bestDist) {
          bestDist = dist;
          best = item;
        }
      }
      return best;
    }

    function update(dt, player, time) {
      if (typeof time === 'number') lastTime = time;
      for (var n = 0; n < list.length; n++) {
        var item = list[n];
        if (!item.active) continue;
        item.mesh.rotation.y += dt * 1.3;
        item.mesh.position.y = item.base + Math.sin(lastTime * 2 + item.phase) * 0.08;
      }
      for (var d = drops.length - 1; d >= 0; d--) {
        if (lastTime >= drops[d].diesAt) removeItem(drops[d]);
      }
      for (var f = 0; f < list.length; f++) {
        var fixed = list[f];
        if (fixed.kind !== 'fixed' || fixed.active) continue;
        if (lastTime >= fixed.respawnAt) {
          fixed.active = true;
          fixed.mesh.visible = true;
        }
      }
      var near = nearest(player);
      var text = near ? '[F] Recoger ' + labelFor(near.key) : null;
      if (text !== hint) {
        hint = text;
        setHint(text);
      }
      return near;
    }

    function tryPickup(player, time) {
      var now = typeof time === 'number' ? time : lastTime;
      var target = nearest(player);
      if (!target) return { ok: false, reason: 'none' };
      var result = ItemLogic.addItem(player.inventory, target.key, 1);
      if (result.added <= 0) {
        setHint('Inventario lleno');
        hint = 'Inventario lleno';
        return { ok: false, reason: 'full' };
      }
      if (target.kind === 'fixed') {
        target.active = false;
        target.mesh.visible = false;
        target.respawnAt = now + RESPAWN_SECONDS;
      } else {
        removeItem(target);
      }
      setHint(null);
      hint = null;
      return { ok: true, key: target.key };
    }

    function onEnemyKilled(enemy) {
      var data = (enemy && enemy.userData) || {};
      if (data.kind !== 'soldier') return null;
      var key = ItemLogic.rollDrop(random());
      if (!key) return null;
      if (drops.length >= MAX_DROPS) removeItem(drops[0]);
      var mesh = makeMesh(key);
      mesh.position.set(enemy.position.x, 0.45, enemy.position.z);
      scene.add(mesh);
      var item = {
        key: key,
        kind: 'drop',
        mesh: mesh,
        active: true,
        base: 0.45,
        phase: drops.length * 1.7,
        respawnAt: 0,
        diesAt: lastTime + DROP_LIFE,
      };
      drops.push(item);
      list.push(item);
      return item;
    }

    return {
      list: list,
      drops: drops,
      update: update,
      tryPickup: tryPickup,
      onEnemyKilled: onEnemyKilled,
    };
  }

  return { create: create };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = { Pickups: Pickups };

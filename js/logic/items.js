// Consumables that share the hotbar with the five weapons. Pure logic:
// no DOM, no THREE. Browser global `ITEM_DEFS`/`ItemLogic`; CommonJS for tests.

var ITEM_DEFS = {
  medkit: {
    name: 'medkit',
    slot: 6,
    max: 3,
    heal: 35,
    label: 'Botiquín',
    short: 'Bot',
  },
  ammoBag: {
    name: 'ammoBag',
    slot: 7,
    max: 3,
    label: 'Munición',
    short: 'Mun',
  },
  grenade: {
    name: 'grenade',
    slot: 8,
    max: 2,
    damage: 120,
    blastRadius: 4.5,
    speed: 26,
    maxRange: 22,
    label: 'Pólvora',
    short: 'Pol',
  },
};

var ItemLogic = (function () {
  var PICKUP_RANGE = 1.8;
  var PICKUP_MAX_DY = 1.2;
  var DROP_TABLE = [
    { limit: 0.10, key: 'medkit' },
    { limit: 0.22, key: 'ammoBag' },
    { limit: 0.28, key: 'grenade' },
  ];

  function createInventory() {
    return { medkit: 0, ammoBag: 0, grenade: 0 };
  }

  function addItem(inventory, key, count) {
    var def = ITEM_DEFS[key];
    var amount = Math.max(0, Math.floor(count || 0));
    if (!def || amount <= 0) return { added: 0, leftover: amount };
    var current = inventory[key] || 0;
    var added = Math.min(Math.max(0, def.max - current), amount);
    inventory[key] = current + added;
    return { added: added, leftover: amount - added };
  }

  function useItem(inventory, key) {
    if (!ITEM_DEFS[key]) return false;
    var current = inventory[key] || 0;
    if (current <= 0) return false;
    inventory[key] = current - 1;
    return true;
  }

  function needsAmmo(clips, weapons) {
    if (!clips || !weapons) return false;
    for (var key in weapons) {
      if (!Object.prototype.hasOwnProperty.call(weapons, key)) continue;
      var def = weapons[key];
      if (!def || def.type === 'melee') continue;
      if ((clips[key] || 0) < def.clipSize) return true;
    }
    return false;
  }

  function refillClips(clips, weapons) {
    if (!clips || !weapons) return 0;
    var filled = 0;
    for (var key in weapons) {
      if (!Object.prototype.hasOwnProperty.call(weapons, key)) continue;
      var def = weapons[key];
      if (!def || def.type === 'melee') continue;
      if ((clips[key] || 0) < def.clipSize) {
        clips[key] = def.clipSize;
        filled++;
      }
    }
    return filled;
  }

  function rollDrop(value) {
    var roll = typeof value === 'number' ? value : Math.random();
    for (var i = 0; i < DROP_TABLE.length; i++) {
      if (roll < DROP_TABLE[i].limit) return DROP_TABLE[i].key;
    }
    return null;
  }

  function inPickupRange(a, b, maxDist, maxDy) {
    if (!a || !b) return false;
    var reach = maxDist === undefined ? PICKUP_RANGE : maxDist;
    var height = maxDy === undefined ? PICKUP_MAX_DY : maxDy;
    var dx = (a.x || 0) - (b.x || 0);
    var dz = (a.z || 0) - (b.z || 0);
    var dy = (a.y || 0) - (b.y || 0);
    return Math.hypot(dx, dz) <= reach && Math.abs(dy) <= height;
  }

  return {
    ITEM_DEFS: ITEM_DEFS,
    createInventory: createInventory,
    addItem: addItem,
    useItem: useItem,
    needsAmmo: needsAmmo,
    refillClips: refillClips,
    rollDrop: rollDrop,
    inPickupRange: inPickupRange,
  };
})();

if (typeof module !== 'undefined') {
  module.exports = {
    ItemLogic: ItemLogic,
    ITEM_DEFS: ITEM_DEFS,
    createInventory: ItemLogic.createInventory,
    addItem: ItemLogic.addItem,
    useItem: ItemLogic.useItem,
    needsAmmo: ItemLogic.needsAmmo,
    refillClips: ItemLogic.refillClips,
    rollDrop: ItemLogic.rollDrop,
    inPickupRange: ItemLogic.inPickupRange,
  };
}

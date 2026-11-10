// Pure armory data: the weapons the player can choose before the assault.
// Browser global script and CommonJS module for Node tests.

var ARMORY_ORDER = ['mosquete', 'fusil', 'sable', 'pica', 'trabuco'];

// Card data for the armory screen: one entry per weapon, in armory order.
function armoryEntries(weapons) {
  var out = [];
  for (var i = 0; i < ARMORY_ORDER.length; i++) {
    var key = ARMORY_ORDER[i];
    var def = weapons ? weapons[key] : null;
    if (!def) continue;
    out.push({
      key: key,
      label: def.label || def.name || key,
      desc: def.desc || '',
      type: def.type,
      damage: def.damage,
      pellets: def.pellets,
      range: def.range,
      clipSize: def.clipSize,
      reloadTime: def.reloadTime,
      fireCooldown: def.fireCooldown,
    });
  }
  return out;
}

// A loadout is only honoured when it names a weapon that exists.
function sanitizeLoadout(key, weapons) {
  if (key && weapons && weapons[key]) return key;
  return 'mosquete';
}

if (typeof module !== 'undefined') {
  module.exports = { ARMORY_ORDER, armoryEntries, sanitizeLoadout };
}

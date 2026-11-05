// Pure game configuration: weapons, waves, player HP and fort integrity.
// Works as a browser global script and as a CommonJS module for Node tests.

var PLAYER_HP = 100;
var FORT_INTEGRITY = 100;

var WEAPONS = {
  mosquete: {
    name: 'mosquete',
    type: 'rifle',
    damage: 80,
    clipSize: 1,
    fireCooldown: 1.1,
    reloadTime: 2.6,
  },
  sable: {
    name: 'sable',
    type: 'melee',
    damage: 60,
    range: 2.2,
    fireCooldown: 0.35,
  },
};

var WAVES = [
  { count: 6, interval: 1.5, hp: 45, damage: 10 },
  { count: 9, interval: 1.0, hp: 55, damage: 12 },
  { count: 12, interval: 0.8, hp: 65, damage: 15 },
];

if (typeof module !== 'undefined') module.exports = { PLAYER_HP, FORT_INTEGRITY, WEAPONS, WAVES };

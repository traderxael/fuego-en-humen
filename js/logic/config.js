// Pure game configuration: weapons, waves, player HP and fort integrity.
// Works as a browser global script and as a CommonJS module for Node tests.

var PLAYER_HP = 100;
var FORT_INTEGRITY = 100;

var WEAPONS = {
  mosquete: {
    name: 'mosquete',
    label: 'Mosquete',
    type: 'rifle',
    damage: 80,
    clipSize: 1,
    fireCooldown: 1.1,
    reloadTime: 2.6,
    desc: 'Arma de infantería qing. Un tiro, una recarga. Fiable y sin sorpresas.',
  },
  fusil: {
    name: 'fusil',
    label: 'Fusil de chispa',
    type: 'rifle',
    damage: 130,
    clipSize: 1,
    fireCooldown: 1.7,
    reloadTime: 3.4,
    desc: 'Cañón largo, mucho más certero y letal, pero tarda lo suyo en recargar.',
  },
  sable: {
    name: 'sable',
    label: 'Sable',
    type: 'melee',
    damage: 60,
    range: 2.2,
    fireCooldown: 0.35,
    desc: 'Acero chino. Sin munición, sin recarga: siempre a mano.',
  },
  pica: {
    name: 'pica',
    label: 'Pica',
    type: 'melee',
    damage: 85,
    range: 3.0,
    fireCooldown: 0.55,
    desc: 'Alcance de lanza contra infantería. Golpea más lento, pero llega antes.',
  },
  trabuco: {
    name: 'trabuco',
    label: 'Trabuco',
    type: 'rifle',
    damage: 40,
    pellets: 8,
    spread: 0.07,
    clipSize: 1,
    fireCooldown: 1.15,
    reloadTime: 2.8,
    desc: 'Boca ancha qing. Ocho perdigones devastadores de cerca, inútiles de lejos.',
  },
};

// Enemy archetypes: multipliers over the wave baseline. `kind` stays
// 'soldier' in the physics layer; only AI stats and score differ.
var ENEMY_TYPES = {
  soldier: { hpMult: 1.0, damageMult: 1.0, speedMult: 1.0, canShoot: true, score: 100 },
  runner: { hpMult: 0.5, damageMult: 0.8, speedMult: 1.9, canShoot: false, meleeCooldown: 0.8, score: 150 },
  officer: { hpMult: 2.2, damageMult: 1.25, speedMult: 0.8, canShoot: true, score: 250 },
  // 37th Madras Native Infantry: same musket drill, different uniform.
  sepoy: { hpMult: 1.0, damageMult: 0.9, speedMult: 1.0, canShoot: true, score: 120 },
};

var WAVES = [
  { count: 10, interval: 1.4, hp: 45, damage: 10 },
  { count: 15, interval: 1.05, hp: 55, damage: 12 },
  { count: 20, interval: 0.9, hp: 65, damage: 15 },
  { count: 26, interval: 0.85, hp: 70, damage: 16, mix: ['soldier', 'runner', 'sepoy', 'soldier', 'officer'], artillery: 1 },
  { count: 34, interval: 0.8, hp: 80, damage: 18, mix: ['runner', 'soldier', 'sepoy', 'officer', 'soldier', 'runner'], artillery: 2, rockets: 1 },
];

if (typeof module !== 'undefined') module.exports = { PLAYER_HP, FORT_INTEGRITY, WEAPONS, WAVES, ENEMY_TYPES };

// Pure game configuration: weapons, phases of the assault, player HP and
// fort integrity.
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

// Ten phases of the assault, tied to the real chronology of the
// Battle of the Bogue (23-26 February 1841). Extended from 3 to 10
// for a long campaign; difficulty scales (count/hp/damage, faster trickle).
function _arch(list) { return list.slice(); }
var WAVES = [
  {
    count: 7,
    interval: 1.7,
    hp: 45,
    damage: 10,
    archetypes: _arch(['rifleman', 'rifleman', 'rifleman', 'rifleman', 'rifleman', 'marine', 'rifleman']),
    phase: 'El desembarco',
    date: '23 de febrero de 1841',
    objective: 'Repele el desembarco de la playa',
    artillery: 0,
  },
  {
    count: 11,
    interval: 1.15,
    hp: 52,
    damage: 12,
    archetypes: _arch(['rifleman', 'rifleman', 'marine', 'rifleman', 'rifleman', 'officer', 'rifleman', 'marine', 'rifleman', 'rifleman', 'marine']),
    phase: 'El bombardeo',
    date: '26 de febrero de 1841 · mañana',
    objective: 'Silencia la artillería enemiga',
    artillery: 1,
  },
  {
    count: 15,
    interval: 0.85,
    hp: 58,
    damage: 14,
    archetypes: _arch(['marine', 'rifleman', 'marine', 'rifleman', 'officer', 'rifleman', 'marine', 'rifleman', 'marine', 'rifleman', 'marine', 'rifleman', 'marine', 'rifleman', 'marine']),
    phase: 'El asalto',
    date: '26 de febrero de 1841 · 13:20',
    objective: 'Resiste hasta el último asalto',
    artillery: 2,
  },
  { count: 17, interval: 0.75, hp: 68, damage: 16, archetypes: _arch(['marine','rifleman','marine','rifleman','officer','marine','rifleman','marine','rifleman','rifleman','officer','marine','rifleman','marine','rifleman','marine','rifleman']), phase: 'Refuerzos del mar', date: '26 de febrero · 15:00', objective: 'Aguanta el refuerzo de la flota', artillery: 2 },
  { count: 19, interval: 0.65, hp: 78, damage: 18, archetypes: _arch(['rifleman','marine','rifleman','officer','marine','rifleman','marine','rifleman','officer','marine','rifleman','marine','rifleman','marine','officer','rifleman','marine','rifleman','marine']), phase: 'Contraofensiva', date: '26 de febrero · 16:30', objective: 'Empuja al enemigo fuera de la muralla', artillery: 2 },
  { count: 21, interval: 0.55, hp: 88, damage: 20, archetypes: _arch(['marine','marine','rifleman','marine','officer','rifleman','marine','rifleman','marine','rifleman','officer','marine','rifleman','marine','rifleman','marine','rifleman','officer','marine','rifleman','marine']), phase: 'La marea humana', date: '26 de febrero · 18:00', objective: 'Resiste la marea humana', artillery: 3 },
  { count: 23, interval: 0.5, hp: 98, damage: 22, archetypes: _arch(['marine','rifleman','marine','marine','rifleman','officer','marine','rifleman','marine','rifleman','marine','rifleman','officer','marine','rifleman','marine','rifleman','marine','officer','rifleman','marine','rifleman','marine']), phase: 'Noche de fuego', date: '26 de febrero · 22:00', objective: 'Defiende el fuerte de noche', artillery: 3 },
  { count: 25, interval: 0.45, hp: 108, damage: 24, archetypes: _arch(['rifleman','marine','rifleman','marine','officer','rifleman','marine','rifleman','marine','rifleman','marine','rifleman','officer','marine','rifleman','marine','rifleman','marine','officer','rifleman','marine','rifleman','marine','rifleman','marine']), phase: 'El amanecer roto', date: '27 de febrero · 05:00', objective: 'Aguanta hasta el amanecer', artillery: 3 },
  { count: 27, interval: 0.4, hp: 122, damage: 26, archetypes: _arch(['marine','rifleman','marine','marine','rifleman','officer','marine','rifleman','marine','rifleman','marine','rifleman','officer','marine','rifleman','marine','rifleman','marine','officer','rifleman','marine','rifleman','marine','rifleman','marine','officer','marine']), phase: 'El último asalto', date: '27 de febrero · 09:00', objective: 'Resiste el último asalto', artillery: 4 },
  { count: 30, interval: 0.35, hp: 140, damage: 30, archetypes: _arch(['marine','marine','rifleman','marine','officer','rifleman','marine','rifleman','marine','rifleman','marine','rifleman','officer','marine','rifleman','marine','rifleman','marine','officer','rifleman','marine','rifleman','marine','rifleman','marine','officer','marine','rifleman','marine','rifleman']), phase: 'La resistencia final', date: '27 de febrero · 12:00', objective: 'El fuerte resiste. Humen no cae.', artillery: 4 },
];

// Scoring and streaks.
var SCORE = {
  rifleman: 100,
  marine: 175,
  officer: 400,
  artillery: 250,
  streakWindow: 6.0,   // s to keep a streak alive
  streakStep: 0.25,   // multiplier gained per kill
  streakMax: 3.0,
  signalKey: 'KeyG',  // call for support
};

if (typeof module !== 'undefined') {
  module.exports = { PLAYER_HP, FORT_INTEGRITY, WEAPONS, WAVES, SCORE };
}

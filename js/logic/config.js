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

// The three phases of the assault, tied to the real chronology of the
// Battle of the Bogue (23-26 February 1841).
var WAVES = [
  {
    count: 7,
    interval: 1.7,
    hp: 45,
    damage: 10,
    archetypes: ['rifleman', 'rifleman', 'rifleman', 'rifleman', 'rifleman', 'marine', 'rifleman'],
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
    archetypes: ['rifleman', 'rifleman', 'marine', 'rifleman', 'rifleman', 'officer', 'rifleman', 'marine', 'rifleman', 'rifleman', 'marine'],
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
    archetypes: ['marine', 'rifleman', 'marine', 'rifleman', 'officer', 'rifleman', 'marine', 'rifleman', 'marine', 'rifleman', 'marine', 'rifleman', 'marine', 'rifleman', 'marine'],
    phase: 'El asalto',
    date: '26 de febrero de 1841 · 13:20',
    objective: 'Resiste hasta el último asalto',
    artillery: 2,
  },
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

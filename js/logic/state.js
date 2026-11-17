// Pure game state machine: game state creation, phase transitions and wave progression.
// Works as a browser global script and as a CommonJS module for Node tests.

var logicConfig = (typeof module !== 'undefined' && module.exports)
  ? require('./config')
  : {
      PLAYER_HP: PLAYER_HP,
      FORT_INTEGRITY: FORT_INTEGRITY,
      WEAPONS: WEAPONS,
      WAVES: WAVES,
      MEDKIT: (typeof MEDKIT !== 'undefined' ? MEDKIT : null),
    };

var LEGAL_TRANSITIONS = {
  menu: ['playing'],
  playing: ['paused', 'victory', 'defeat'],
  paused: ['playing'],
  victory: [],
  defeat: [],
};

function createGameState() {
  var initialMedkits = (logicConfig.MEDKIT && typeof logicConfig.MEDKIT.initialCharges === 'number')
    ? logicConfig.MEDKIT.initialCharges
    : 2;
  return {
    phase: 'menu',
    wave: 1,
    playerHp: logicConfig.PLAYER_HP,
    fortIntegrity: logicConfig.FORT_INTEGRITY,
    score: 0,
    time: 0,
    reloadingUntil: 0,
    medkits: initialMedkits,
    healingUntil: 0,
  };
}

function setPhase(state, phase) {
  var allowed = LEGAL_TRANSITIONS[state.phase] || [];
  if (allowed.indexOf(phase) === -1) return false;
  state.phase = phase;
  return true;
}

function nextWave(state) {
  if (state.wave >= logicConfig.WAVES.length) {
    state.phase = 'victory';
    return state;
  }
  state.wave += 1;
  state.phase = 'playing';
  return state;
}

if (typeof module !== 'undefined') module.exports = { createGameState, setPhase, nextWave };

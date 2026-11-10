// Mission objectives: a short sequential checklist per campaign mission.
// The last objective is always "hold the line" and completes when the wave is
// cleared; clearing the wave also closes any unmet objective so the campaign
// can never soft-lock. Pure logic (no DOM, no THREE).

var ObjectiveLogic = (function () {
  function create(mission) {
    var defs = (mission && mission.objectives) || [];
    var state = {
      objectives: defs.map(function (def) {
        return {
          kind: def.kind,
          target: def.target || 1,
          label: def.label,
          progress: 0,
          done: false,
        };
      }),
      index: 0,
      allDone: false,
    };
    if (!state.objectives.length) state.allDone = true;
    return state;
  }

  function current(state) {
    if (!state || state.allDone) return null;
    return state.objectives[state.index] || null;
  }

  function label(state) {
    var objective = state && !state.allDone ? current(state) : null;
    if (!objective) return 'Misión cumplida';
    var counter = objective.target > 1
      ? ' (' + objective.progress + '/' + objective.target + ')'
      : '';
    return 'Objetivo ' + (state.index + 1) + '/' + state.objectives.length +
      ' · ' + objective.label + counter;
  }

  function completeRemaining(state) {
    for (var i = state.index; i < state.objectives.length; i++) {
      state.objectives[i].progress = state.objectives[i].target;
      state.objectives[i].done = true;
    }
    state.index = state.objectives.length;
    state.allDone = true;
  }

  // Events: 'kill', 'artillery', 'cannon', 'wave-cleared'.
  function register(state, eventType, amount) {
    if (!state) return { completed: null, allDone: true };
    if (state.allDone) return { completed: null, allDone: true };
    var objective = current(state);
    if (!objective) {
      state.allDone = true;
      return { completed: null, allDone: true };
    }
    if (eventType === 'wave-cleared') {
      completeRemaining(state);
      return { completed: objective, allDone: true };
    }
    var matches = objective.kind === 'survive'
      ? eventType === 'wave-cleared'
      : objective.kind === eventType;
    if (!matches) return { completed: null, allDone: false };
    objective.progress += amount || 1;
    if (objective.progress < objective.target) return { completed: null, allDone: false };
    objective.done = true;
    state.index += 1;
    if (state.index >= state.objectives.length) state.allDone = true;
    return { completed: objective, allDone: state.allDone };
  }

  return {
    create: create,
    current: current,
    label: label,
    register: register,
  };
})();

if (typeof module !== 'undefined') module.exports = { ObjectiveLogic: ObjectiveLogic };

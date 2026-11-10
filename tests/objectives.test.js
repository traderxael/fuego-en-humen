const test = require('node:test');
const assert = require('node:assert/strict');

const { ObjectiveLogic } = require('../js/logic/objectives');

const MISSION = {
  n: 2,
  name: 'El Bogue',
  objectives: [
    { kind: 'artillery', target: 1, label: 'Silencia el cañón de asedio' },
    { kind: 'survive', target: 1, label: 'Aguanta el asalto' },
  ],
};

test('la misión arranca con su primer objetivo activo', () => {
  const state = ObjectiveLogic.create(MISSION);
  assert.equal(state.index, 0);
  assert.equal(state.allDone, false);
  assert.equal(ObjectiveLogic.current(state).kind, 'artillery');
  assert.match(ObjectiveLogic.label(state), /Objetivo 1\/2/);
  assert.match(ObjectiveLogic.label(state), /Silencia/);
});

test('los eventos que no corresponden al objetivo activo no cuentan', () => {
  const state = ObjectiveLogic.create(MISSION);
  assert.deepEqual(ObjectiveLogic.register(state, 'kill'), { completed: null, allDone: false });
  assert.equal(state.objectives[0].progress, 0);
});

test('completar el objetivo activo pasa al siguiente', () => {
  const state = ObjectiveLogic.create(MISSION);
  const result = ObjectiveLogic.register(state, 'artillery');
  assert.equal(result.completed.kind, 'artillery');
  assert.equal(result.allDone, false);
  assert.equal(state.index, 1);
  assert.equal(ObjectiveLogic.current(state).kind, 'survive');
  assert.match(ObjectiveLogic.label(state), /Objetivo 2\/2/);
});

test('los objetivos con varias unidades cuentan por progreso', () => {
  const state = ObjectiveLogic.create({
    objectives: [{ kind: 'kill', target: 3, label: 'Abate a tres' }],
  });
  assert.equal(ObjectiveLogic.register(state, 'kill').completed, null);
  assert.equal(ObjectiveLogic.register(state, 'kill').completed, null);
  const third = ObjectiveLogic.register(state, 'kill');
  assert.equal(third.completed.kind, 'kill');
  assert.equal(third.allDone, true);
});

test('limpiar la oleada cierra la misión aunque falte un objetivo', () => {
  const state = ObjectiveLogic.create({
    objectives: [
      { kind: 'cannon', target: 2, label: 'Dispara el cañón del fuerte' },
      { kind: 'survive', target: 1, label: 'Aguanta el asalto' },
    ],
  });
  const result = ObjectiveLogic.register(state, 'wave-cleared');
  assert.equal(result.allDone, true);
  assert.ok(state.objectives.every((objective) => objective.done));
  assert.equal(ObjectiveLogic.label(state), 'Misión cumplida');
});

test('una misión sin objetivos se completa al limpiar la oleada', () => {
  const state = ObjectiveLogic.create({ objectives: [] });
  assert.equal(state.allDone, true);
  assert.equal(ObjectiveLogic.register(state, 'kill').allDone, true);
});

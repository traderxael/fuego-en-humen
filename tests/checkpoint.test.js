const test = require('node:test');
const assert = require('node:assert/strict');

const { CheckpointLogic } = require('../js/logic/checkpoint');

function memoryStorage() {
  const data = {};
  return {
    getItem: (key) => (Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null),
    setItem: (key, value) => { data[key] = String(value); },
    removeItem: (key) => { delete data[key]; },
  };
}

test('sin guardado no hay punto de control', () => {
  assert.equal(CheckpointLogic.load(memoryStorage()), null);
  assert.equal(CheckpointLogic.load(null), null);
});

test('el punto de control guarda fase, vida, fuerte y puntuación', () => {
  const storage = memoryStorage();
  CheckpointLogic.save(storage, { wave: 4, hp: 72, fort: 90, score: 450 });
  assert.deepEqual(CheckpointLogic.load(storage), { wave: 4, hp: 72, fort: 90, score: 450 });
});

test('los valores se acotan al rango del juego', () => {
  const storage = memoryStorage();
  CheckpointLogic.save(storage, { wave: 99, hp: 999, fort: -5, score: -10 });
  assert.deepEqual(CheckpointLogic.load(storage), { wave: 10, hp: 100, fort: 0, score: 0 });
  CheckpointLogic.save(storage, { wave: 0, hp: 50, fort: 50, score: 0 });
  assert.equal(CheckpointLogic.load(storage).wave, 1);
});

test('un guardado corrupto se ignora y se puede borrar', () => {
  const storage = memoryStorage();
  storage.setItem(CheckpointLogic.KEY, '{no es json');
  assert.equal(CheckpointLogic.load(storage), null);
  CheckpointLogic.save(storage, { wave: 2, hp: 80, fort: 70, score: 100 });
  CheckpointLogic.clear(storage);
  assert.equal(CheckpointLogic.load(storage), null);
});

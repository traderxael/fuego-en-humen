const test = require('node:test');
const assert = require('node:assert/strict');

const { ProgressLogic } = require('../js/logic/progress');

function memoryStorage() {
  const data = {};
  return {
    getItem: (key) => (Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null),
    setItem: (key, value) => { data[key] = String(value); },
    removeItem: (key) => { delete data[key]; },
    _data: data,
  };
}

test('sin guardado la campaña empieza en la misión 1 y sin checkpoint', () => {
  const progress = ProgressLogic.load(memoryStorage());
  assert.equal(progress.unlocked, 1);
  assert.equal(progress.checkpoint, null);
  assert.equal(ProgressLogic.isUnlocked(1, progress), true);
  assert.equal(ProgressLogic.isUnlocked(2, progress), false);
});

test('completar una misión desbloquea la siguiente sin pasar del límite', () => {
  const storage = memoryStorage();
  const progress = ProgressLogic.load(storage);
  ProgressLogic.unlock(progress, 1);
  assert.equal(progress.unlocked, 2);
  ProgressLogic.save(storage, progress);
  assert.equal(ProgressLogic.load(storage).unlocked, 2);
  ProgressLogic.unlock(progress, 5);
  assert.equal(progress.unlocked, 5);
});

test('el checkpoint guarda misión, vida, fuerte y puntuación', () => {
  const storage = memoryStorage();
  const progress = ProgressLogic.load(storage);
  ProgressLogic.setCheckpoint(progress, { mission: 3, hp: 72, fort: 90, score: 450 });
  ProgressLogic.save(storage, progress);
  const reloaded = ProgressLogic.load(storage);
  assert.deepEqual(reloaded.checkpoint, { mission: 3, hp: 72, fort: 90, score: 450 });
  assert.equal(reloaded.unlocked, 1);
  ProgressLogic.clearCheckpoint(reloaded);
  assert.equal(reloaded.checkpoint, null);
});

test('un guardado corrupto no rompe la campaña', () => {
  const storage = memoryStorage();
  storage.setItem('humen.campaign.v1', '{no es json');
  const progress = ProgressLogic.load(storage);
  assert.equal(progress.unlocked, 1);
  assert.equal(progress.checkpoint, null);
});

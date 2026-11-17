const test = require('node:test');
const assert = require('node:assert');

const Records = require('../js/logic/records');

test('parseRecord accepts finite non-negative integers only', () => {
  assert.strictEqual(Records.parseRecord(null), 0);
  assert.strictEqual(Records.parseRecord(undefined), 0);
  assert.strictEqual(Records.parseRecord(''), 0);
  assert.strictEqual(Records.parseRecord('abc'), 0);
  assert.strictEqual(Records.parseRecord('-5'), 0);
  assert.strictEqual(Records.parseRecord('123.9'), 123);
  assert.strictEqual(Records.parseRecord('42'), 42);
  assert.strictEqual(Records.parseRecord(99.9), 99);
  assert.strictEqual(Records.parseRecord(Infinity), 0);
});

test('mergeRecord flags a new record only when the score beats the best', () => {
  assert.deepStrictEqual(Records.mergeRecord(100, 150), { best: 150, isNew: true });
  assert.deepStrictEqual(Records.mergeRecord(100, 50), { best: 100, isNew: false });
  assert.deepStrictEqual(Records.mergeRecord(100, 100), { best: 100, isNew: false });
  assert.deepStrictEqual(Records.mergeRecord(0, 0), { best: 0, isNew: false });
});

test('load and save round-trip through localStorage', () => {
  const store = {};
  global.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
  };
  try {
    assert.strictEqual(Records.load(), 0);
    Records.save(750);
    assert.strictEqual(Records.load(), 750);
    assert.strictEqual(store['fuego-en-humen:bestScore'], '750');
  } finally {
    delete global.localStorage;
  }
});

test('load tolerates corrupt stored values', () => {
  global.localStorage = { getItem: () => 'not-a-number', setItem: () => {} };
  try {
    assert.strictEqual(Records.load(), 0);
  } finally {
    delete global.localStorage;
  }
});

test('load and save are safe when localStorage throws or is absent', () => {
  global.localStorage = {
    getItem: () => { throw new Error('private mode'); },
    setItem: () => { throw new Error('private mode'); },
  };
  try {
    assert.strictEqual(Records.load(), 0);
    assert.doesNotThrow(() => Records.save(100));
  } finally {
    delete global.localStorage;
  }
  assert.strictEqual(Records.load(), 0);
  assert.doesNotThrow(() => Records.save(100));
});
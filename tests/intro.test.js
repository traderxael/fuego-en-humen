const test = require('node:test');
const assert = require('node:assert');

const { INTRO_BEATS, introAdvance, introButtonLabel } = require('../js/logic/intro');

test('INTRO_BEATS tells the siege in three short chapters', () => {
  assert.strictEqual(INTRO_BEATS.length, 3);
  for (const beat of INTRO_BEATS) {
    assert.ok(beat.kicker.length > 0, 'beat needs a kicker');
    assert.ok(beat.title.length > 0, 'beat needs a title');
    assert.ok(beat.body.length > 40, 'beat needs a real paragraph');
  }
  assert.ok(INTRO_BEATS[2].title.toLowerCase().includes('oleada'));
});

test('introAdvance walks the chapters and reports the end', () => {
  const count = INTRO_BEATS.length;
  const first = introAdvance(0, count);
  assert.strictEqual(first.index, 1);
  assert.strictEqual(first.done, false);

  const last = introAdvance(count - 1, count);
  assert.strictEqual(last.index, count - 1);
  assert.strictEqual(last.done, true);
});

test('introAdvance never runs past the last chapter', () => {
  assert.strictEqual(introAdvance(9, 3).index, 2);
  assert.strictEqual(introAdvance(9, 3).done, true);
  assert.strictEqual(introAdvance(0, 0).done, true);
  assert.strictEqual(introAdvance(-4, 3).index, 1);
});

test('introButtonLabel changes on the final chapter', () => {
  const count = INTRO_BEATS.length;
  assert.ok(introButtonLabel(0, count) !== introButtonLabel(count - 1, count));
  assert.ok(/continuar/i.test(introButtonLabel(0, count)));
  assert.ok(/tomar/i.test(introButtonLabel(count - 1, count)));
});

const test = require('node:test');
const assert = require('node:assert/strict');

const { INTRO_BEATS } = require('../js/logic/intro');
const { Campaign } = require('../js/logic/campaign');

test('la intro usa los datos reales de 1839-1841', () => {
  const text = INTRO_BEATS.map((beat) => beat.kicker + ' ' + beat.title + ' ' + beat.body).join(' ');
  assert.match(text, /1839/);
  assert.match(text, /Lin Zexu/);
  assert.match(text, /Chuenpi/);
  assert.match(text, /Nemesis/);
  assert.match(text, /Weiyuan/);
  assert.match(text, /Bogue/);
  assert.doesNotMatch(text, /dragón/i, 'el dragón amarillo es posterior a 1841');
});

test('las cinco oleadas citan hechos documentados', () => {
  const facts = Campaign.WAVES.map((wave) => wave.fact).join(' ');
  assert.match(facts, /juncos/);
  assert.match(facts, /Nemesis/);
  assert.match(facts, /Weiyuan/);
  assert.match(facts, /Jingyuan/);
  assert.match(facts, /mil treinta y siete|1\.037|1037/i);
  assert.match(facts, /Guan Tianpei/);
  const dates = Campaign.WAVES.map((wave) => wave.date).join(' ');
  assert.match(dates, /7 de enero de 1841/);
  assert.match(dates, /23 de febrero de 1841/);
  assert.match(dates, /25 de febrero de 1841/);
  assert.match(dates, /26 de febrero de 1841/);
});

test('la lección de cada oleada es táctica y no repite el hecho', () => {
  for (const wave of Campaign.WAVES) {
    assert.notEqual(wave.lesson, wave.fact);
    assert.ok(wave.quote.length > 10);
  }
});

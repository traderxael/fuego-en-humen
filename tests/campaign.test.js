const test = require('node:test');
const assert = require('node:assert/strict');

const { Campaign } = require('../js/logic/campaign');
const { WAVES } = require('../js/logic/config');

test('la campaña tiene una entrada histórica por oleada', () => {
  assert.equal(Campaign.WAVES.length, 5);
  assert.equal(Campaign.WAVES.length, WAVES.length, 'campaña y oleadas no pueden divergir');
  assert.equal(Campaign.FINAL_WAVE, 5);
  for (const wave of Campaign.WAVES) {
    assert.ok(wave.name.length > 0);
    assert.match(wave.date, /1841/);
    assert.ok(wave.fact.length > 40, 'cada oleada explica un hecho real');
    assert.ok(wave.lesson.length > 20, 'cada oleada deja una lección táctica');
  }
  assert.deepEqual(Array.from(Campaign.WAVES, (w) => w.n), [1, 2, 3, 4, 5]);
});

test('los nombres de oleada siguen la cronología documentada', () => {
  const names = Campaign.WAVES.map((wave) => wave.name);
  assert.deepEqual(names, ['Chuenpi', 'El Bogue', 'Anunghoy', 'Wangtong', 'Jingyuan']);
  assert.match(Campaign.WAVES[0].date, /7 de enero de 1841/);
  assert.match(Campaign.WAVES[4].date, /26 de febrero de 1841/);
});

test('cada oleada apunta a su clip y no comparte ruta', () => {
  const paths = Campaign.WAVES.map((wave) => Campaign.clipPath(wave.n));
  assert.deepEqual(paths, [1, 2, 3, 4, 5].map((n) => 'assets/cinematic/wave' + n + '.mp4'));
  assert.equal(new Set(paths).size, 5);
  assert.equal(Campaign.clipPath(0), null);
  assert.equal(Campaign.clipPath(6), null);
});

test('las tarjetas de intermisión reutilizan los datos históricos', () => {
  const card = Campaign.card(3);
  assert.match(card.kicker, /23 de febrero de 1841/);
  assert.equal(card.title, 'Anunghoy');
  assert.match(card.body, /Weiyuan/);
  assert.match(card.body, /Jingyuan/);
  assert.ok(card.lesson.length > 20);
  assert.equal(Campaign.card(99), null);

  const final = Campaign.finalCard();
  assert.match(final.kicker, /26 de febrero de 1841/);
  assert.match(final.title, /Bogue|Jingyuan/);
  assert.match(final.body, /cinco|cinco asaltos|Guan Tianpei/);
});

test('el epílogo cierra la campaña con el resultado real', () => {
  assert.equal(Campaign.EPILOGUE.length, 3);
  const text = Campaign.EPILOGUE.join(' ');
  assert.match(text, /Anunghoy/);
  assert.match(text, /Guan Tianpei/);
  assert.match(text, /1841/);
  assert.match(text, /Hong Kong/);
  assert.match(text, /Nankín|Nanking/);
});

test('cada misión define dos objetivos y una línea de radio', () => {
  for (const wave of Campaign.WAVES) {
    assert.equal(wave.objectives.length, 2, 'misión ' + wave.n);
    const kinds = wave.objectives.map((objective) => objective.kind);
    for (const kind of kinds) {
      assert.ok(['kill', 'artillery', 'cannon', 'survive'].includes(kind), kind);
    }
    assert.equal(kinds[kinds.length - 1], 'survive', 'la misión cierra aguantando');
    for (const objective of wave.objectives) {
      assert.ok(objective.target >= 1);
      assert.ok(objective.label.length > 10);
    }
    assert.ok(wave.radio.start.length > 20);
    assert.ok(wave.radio.objective.length > 10);
  }
});

test('el briefing de misión reúne fecha, hecho y objetivos', () => {
  const brief = Campaign.briefing(4);
  assert.match(brief.kicker, /Misión 4/);
  assert.match(brief.kicker, /25 de febrero de 1841/);
  assert.equal(brief.title, 'Wangtong');
  assert.match(brief.body, /Pratt/);
  assert.equal(brief.objectives.length, 2);
  assert.match(brief.objectives[0], /doce/);
  assert.match(brief.radio, /portón/);
  assert.equal(Campaign.briefing(9), null);
});

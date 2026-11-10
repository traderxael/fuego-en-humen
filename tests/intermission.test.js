const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { makeDocument } = require('./helpers/fake-dom.js');
const { createGameState, setPhase } = require('../js/logic/state');
const { Campaign } = require('../js/logic/campaign');

const IDS = [
  'intermission-screen',
  'intermission-video',
  'intermission-kicker',
  'intermission-title',
  'intermission-body',
  'intermission-lesson',
  'intermission-hint',
];

function runtime() {
  const document = makeDocument(IDS);
  const timers = [];
  const hidden = [];
  const drums = [];
  const horns = [];
  const locks = [];
  const hud = {
    hide: () => hidden.push('hide'),
    show: () => hidden.push('show'),
  };
  const video = document.getElementById('intermission-video');
  video.readyState = 0;
  video.ended = false;
  video.src = '';
  video.playCalls = 0;
  video.pauseCalls = 0;
  video.play = () => { video.playCalls++; return Promise.resolve(); };
  video.pause = () => { video.pauseCalls++; };
  video.load = () => {};

  const context = vm.createContext({
    document,
    console,
    Promise,
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimeout: () => {},
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'logic', 'campaign.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'intermission.js'), 'utf8'), context);

  const state = createGameState();
  state.phase = 'playing';
  const controller = context.Intermission.create({
    state,
    setPhase,
    hud,
    sfx: (name) => { if (name === 'stopWarDrums') drums.push('stop'); if (name === 'startWarDrums') drums.push('start'); if (name === 'waveHorn') horns.push(name); },
    campaign: Campaign,
    requestPointerLock: () => locks.push('lock'),
  });
  return { controller, state, document, video, timers, hidden, drums, horns, locks };
}

test('begin abre la intermisión, congela la fase y pinta la tarjeta histórica', () => {
  const run = runtime();
  assert.equal(run.controller.begin({ wave: 3, onDone() {} }), true);
  assert.equal(run.state.phase, 'intermission');
  assert.equal(run.state.time, 0, 'el reloj del juego no avanza durante el clip');
  const screen = run.document.getElementById('intermission-screen');
  assert.equal(screen.classList.contains('hidden'), false);
  assert.match(run.document.getElementById('intermission-kicker').textContent, /23 de febrero de 1841/);
  assert.equal(run.document.getElementById('intermission-title').textContent, 'Anunghoy');
  assert.match(run.document.getElementById('intermission-body').textContent, /Weiyuan/);
  assert.match(run.document.getElementById('intermission-lesson').textContent, /flanco/);
  assert.equal(run.video.src, Campaign.clipPath(3));
  assert.equal(run.video.playCalls, 1);
  assert.deepEqual(run.drums, ['stop']);
  assert.deepEqual(run.hidden, ['hide']);
});

test('begin no es reentrante', () => {
  const run = runtime();
  assert.equal(run.controller.begin({ wave: 2, onDone() {} }), true);
  assert.equal(run.controller.begin({ wave: 4, onDone() {} }), false);
  assert.equal(run.state.wave, 1, 'la intermisión no toca la oleada');
  assert.equal(run.controller.isActive(), true);
});

test('finish reanuda la siguiente oleada una sola vez y recupera el puntero', () => {
  const run = runtime();
  let done = 0;
  run.controller.begin({ wave: 2, onDone: () => { done++; } });
  run.controller.finish();
  assert.equal(done, 1);
  assert.equal(run.state.phase, 'playing');
  assert.equal(run.controller.isActive(), false);
  assert.equal(run.document.getElementById('intermission-screen').classList.contains('hidden'), true);
  assert.equal(run.video.pauseCalls, 1);
  assert.deepEqual(run.hidden, ['hide', 'show']);
  assert.deepEqual(run.drums, ['stop', 'start']);
  assert.deepEqual(run.horns, ['waveHorn']);
  assert.deepEqual(run.locks, ['lock']);
  run.controller.finish();
  assert.equal(done, 1, 'el segundo finish no repite el avance');
});

test('la tarjeta final lleva a la derrota histórica', () => {
  const run = runtime();
  let done = 0;
  run.controller.begin({ wave: 5, final: true, onDone: () => { done++; } });
  const title = run.document.getElementById('intermission-title').textContent;
  assert.match(title, /Bogue/);
  run.controller.finish();
  assert.equal(done, 1);
  assert.equal(run.state.phase, 'defeat');
  assert.equal(run.drums.includes('start'), false, 'no reanuda tambores en la derrota');
  assert.deepEqual(run.horns, [], 'no suena el cuerno de oleada en la caída');
});

test('un clic en la pantalla reanuda la partida', () => {
  const run = runtime();
  run.controller.begin({ wave: 2, onDone() {} });
  run.document.getElementById('intermission-screen').dispatch('click');
  assert.equal(run.state.phase, 'playing');
});

test('si el vídeo no arranca cae al fondo y la tarjeta sin bloquear', () => {
  const run = runtime();
  run.video.play = () => Promise.reject(new Error('autoplay'));
  run.controller.begin({ wave: 1, onDone() {} });
  const fallback = run.timers.find((timer) => timer.ms === 900);
  assert.ok(fallback, 'hay un temporizador de respaldo');
  fallback.fn();
  assert.equal(run.video.classList.contains('hidden'), true);
  assert.equal(run.document.getElementById('intermission-screen').classList.contains('hidden'), false);
  assert.match(run.document.getElementById('intermission-hint').textContent, /clic/i);
  run.controller.finish();
  assert.equal(run.state.phase, 'playing');
});

test('el fin del vídeo muestra la pista de continuar', () => {
  const run = runtime();
  run.controller.begin({ wave: 4, onDone() {} });
  run.video.ended = true;
  run.controller.update();
  assert.match(run.document.getElementById('intermission-hint').textContent, /clic/i);
  assert.equal(run.state.phase, 'intermission', 'no avanza sin gesto del jugador');
});

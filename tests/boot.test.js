const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const THREE = require('../vendor/three.min.js');
const { createCanvas } = require('./helpers/fake-canvas.js');

// Run the actual bootstrap, state machine and world. Only browser/GPU, audio
// and gameplay services are doubled so the asset promise can be held pending.
function boot({ assets = true, introSeen = false, debug = true } = {}) {
  const events = [];
  const elements = new Map();
  let inGesture = false;
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      disabled: false, textContent: '', style: {}, listeners: [],
      addEventListener(type, handler) { this.listeners.push({ type, handler }); },
      click() {
        if (this.disabled) return;
        inGesture = true;
        try { for (const entry of this.listeners) if (entry.type === 'click') entry.handler(); }
        finally { inGesture = false; }
      },
      requestPointerLock() { events.push('pointer-lock'); },
    });
    return elements.get(id);
  }
  const ui = { intro: false, armory: false, menu: true, hud: false };
  let playerOptions;
  const player = {
    update() { events.push('player-update'); }, syncCamera() {},
    setLoadout(key) { events.push('equip:' + key); },
  };
  const effects = { update() {}, addShake() {} };
  const physics = { step() {} };
  const frames = [];
  const window = {
    location: { search: debug ? '?debug=1' : '' },
    innerWidth: 1280, innerHeight: 720,
    addEventListener(type) { events.push('window:' + type); },
  };
  const context = vm.createContext({
    console, window, performance: { now: () => 1000 },
    sessionStorage: { getItem: () => introSeen ? '1' : null },
    document: {
      getElementById: element,
      createElement: createCanvas,
    },
    THREE: {
      ...THREE,
      WebGLRenderer: class {
        constructor() { this.shadowMap = {}; events.push('renderer'); }
        setPixelRatio() {} setSize() {} render() { events.push('render'); }
      },
    },
    requestAnimationFrame(callback) { frames.push(callback); },
    Screens: {
      showIntro() { events.push('intro'); ui.intro = true; },
      showArmory() { events.push('armory'); ui.armory = true; ui.menu = false; },
      getArmoryWeapon: () => 'trabuco',
      stopIntroMusic() { events.push('stop-intro-music'); },
      hideArmory() { ui.armory = false; }, hideMenu() { ui.menu = false; },
      showIntroToast() { events.push('toast'); }, isIntroVisible: () => ui.intro,
    },
    sfx: {
      unlock() { assert.equal(inGesture, true); events.push('unlock'); },
      ambientSea() { events.push('sea-audio'); },
      startWarDrums() { events.push('drums'); },
      waveHorn() { events.push('horn'); }, hit() { events.push('hit-audio'); },
    },
    HUD: {
      show() { ui.hud = true; }, updateHUD() {},
      flashHit() { events.push('hit-marker'); },
    },
    Effects: { create() { events.push('effects'); return effects; } },
    GamePhysics: { create() { events.push('physics'); return physics; } },
    Enemies: {
      bindPhysics() { events.push('bind-physics'); },
      spawnWave() { events.push('spawn'); }, applyHit: () => true,
    },
    createPlayer(camera, canvas, options) {
      events.push('player'); playerOptions = options; return player;
    },
  });
  function run(file) {
    return vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', file + '.js'), 'utf8'), context,
      { filename: 'js/' + file + '.js' });
  }
  for (const file of ['logic/config', 'logic/state', 'models', 'world']) run(file);
  const build = context.buildWorld;
  context.buildWorld = scene => { events.push('world'); return build(scene); };
  let resolveLoad;
  if (assets) {
    run('assets');
    const pending = new Promise(resolve => { resolveLoad = resolve; });
    context.Assets.load = () => { events.push('load'); return pending; };
  }
  const done = run('main');
  return {
    context, window, events, ui, frames, done, element, player, physics, effects,
    get playerOptions() { return playerOptions; },
    finishLoad({ cannon = false } = {}) {
      // Missing qing models represent an individual load failure; load resolves.
      if (cannon) {
        const model = new THREE.Group();
        model.name = 'loaded-cannon';
        model.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()));
        context.Assets.register('cannon', model);
      }
      resolveLoad();
    },
  };
}

test('intro y armería accesibles durante la carga, sin jugador ni listeners de asalto prematuros', async () => {
  const app = boot();
  const start = app.element('btn-armory-start');
  assert.equal(app.events[0], 'load');
  assert.equal(app.ui.intro, true);
  assert.equal(start.disabled, true);
  assert.equal(start.textContent, 'Cargando modelos…');
  assert.equal(start.listeners.length, 0);
  assert.equal(app.events.includes('world'), false);
  assert.equal(app.events.includes('player'), false);
  assert.equal(app.frames.length, 0);
  assert.equal(app.window.__player, undefined);
  assert.equal(app.events.includes('unlock'), false, 'audio sólo tras gesto');
  app.element('btn-play').click();
  assert.equal(app.ui.armory, true);
  assert.deepEqual(app.events.slice(-3), ['unlock', 'sea-audio', 'armory']);
  start.click();
  assert.equal(app.events.includes('equip:trabuco'), false);

  app.finishLoad({ cannon: true });
  await app.done;
  assert.equal(start.disabled, false);
  assert.equal(start.textContent, 'Comenzar el asalto');
  assert.equal(start.listeners.length, 1);
  assert.equal(app.element('btn-play').listeners.length, 1);
  assert.equal(app.events.filter(event => event === 'intro').length, 1);
  assert.equal(app.ui.armory, true, 'no volver a la intro al terminar la carga');
  assert.deepEqual(app.events.filter(event => ['world', 'effects', 'physics', 'bind-physics', 'player', 'spawn', 'player-update'].includes(event)),
    ['world', 'effects', 'physics', 'bind-physics', 'player', 'spawn', 'player-update']);
  assert.equal(app.frames.length, 1);
  assert.ok(app.window.__world.cannons.every(cannon => cannon.name === 'loaded-cannon'));
  assert.equal(app.window.__world.garrison.length, 0, 'fallo individual qing no bloquea');
  assert.strictEqual(app.window.__player, app.player);
  assert.strictEqual(app.window.__physics, app.physics);
  assert.strictEqual(app.window.__effects, app.effects);
  assert.strictEqual(app.window.__game.state, app.window.__state);
  assert.strictEqual(app.window.__game.enemies, app.window.__enemies);
  assert.strictEqual(app.window.__game.camera, app.window.__camera);
  assert.ok(app.window.__game.scene instanceof THREE.Scene);
  assert.equal(app.window.__state.phase, 'menu');
  start.click();
  assert.equal(app.window.__state.phase, 'playing');
  assert.equal(app.window.__state.loadout, 'trabuco');
  assert.equal(app.events.filter(event => event === 'equip:trabuco').length, 1);
  assert.equal(app.events.filter(event => event === 'horn').length, 1);
  assert.ok(app.events.includes('pointer-lock'));
  assert.equal(app.ui.armory, false);
  assert.equal(app.ui.hud, true);
});

test('sin Assets global arranca con primitivas y respeta intro vista y DEBUG desactivado', async () => {
  const app = boot({ assets: false, introSeen: true, debug: false });
  await app.done;
  assert.equal(app.events.includes('load'), false);
  assert.equal(app.events.includes('intro'), false);
  assert.equal(app.events.filter(event => event === 'world').length, 1);
  assert.equal(app.frames.length, 1);
  assert.equal(app.element('btn-armory-start').disabled, false);
  assert.equal(app.element('btn-armory-start').textContent, 'Comenzar el asalto');
  assert.equal(app.playerOptions.world.cannons.length, 4);
  assert.equal(app.playerOptions.world.garrison.length, 0);
  assert.ok(app.playerOptions.world.cannons.every(cannon => cannon.userData.type === 'cannon'));
  assert.equal(Object.keys(app.window).some(key => key.startsWith('__')), false);
  app.element('btn-play').click();
  app.element('btn-armory-start').click();
  assert.equal(app.playerOptions.state.phase, 'playing');
});

test('carga resuelta sin modelos habilita el asalto; shotgun conserva hit marker sin audio por perdigón', async () => {
  const app = boot();
  app.finishLoad();
  await app.done;
  assert.equal(app.element('btn-armory-start').disabled, false);
  assert.equal(app.playerOptions.world.cannons[0].children.length, 7);
  const hit = app.playerOptions.onEnemyHit;
  hit({}, 22, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }, 'shotgun');
  assert.equal(app.events.filter(event => event === 'hit-marker').length, 1);
  assert.equal(app.events.filter(event => event === 'hit-audio').length, 0);
  hit({}, 50, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }, 'musket');
  assert.equal(app.events.filter(event => event === 'hit-marker').length, 2);
  assert.equal(app.events.filter(event => event === 'hit-audio').length, 1);
});

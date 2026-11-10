const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const THREE = require('../vendor/three.min.js');

const { WEAPONS } = require('../js/logic/config');
const { ARMORY_ORDER } = require('../js/logic/armory');
const ItemLogic = require('../js/logic/items');

function setup() {
  const events = [];
  const listeners = {};
  const canvas = {
    id: 'game-canvas',
    addEventListener: () => {},
    requestPointerLock: () => {},
    style: {},
  };
  const state = {
    phase: 'playing',
    wave: 1,
    playerHp: 100,
    fortIntegrity: 100,
    score: 0,
    time: 10,
    reloadingUntil: 0,
  };
  const fired = [];
  const grenades = [];
  let pickupRequests = 0;
  const physics = {
    playerBody: {
      position: new THREE.Vector3(0, 0.9, 8),
      velocity: new THREE.Vector3(0, 0, 0),
    },
    EYE_OFFSET: 0.8,
    isGrounded: () => true,
    aimPoint: (origin, dir, distance) => ({ x: 0, y: 0.1, z: 8 - (distance || 12) }),
    fireMusket: (opts) => { fired.push(opts); return { owner: 'player' }; },
    fireShotgun: (opts) => { fired.push(opts); return []; },
    fireCannon: (opts) => { grenades.push(opts); return {}; },
  };
  const flashes = [];
  const effects = {
    muzzleFlash: () => {},
    addShake: () => {},
    trail: () => null,
  };
  const context = vm.createContext({
    THREE,
    console,
    PLAYER_HP: 100,
    sfx: {
      shot: () => events.push('shot'),
      swish: () => events.push('swish'),
      reload: () => events.push('reload'),
      hit: () => events.push('hit'),
    },
    HUD: {
      setCannonHint: () => {},
      flashSlot: (slot) => flashes.push(slot),
    },
    document: {
      pointerLockElement: canvas,
      addEventListener: () => {},
      exitPointerLock: () => {},
      getElementById: () => null,
    },
    window: {
      addEventListener: (type, fn) => { listeners[type] = fn; },
    },
  });
  for (const file of ['config', 'state', 'combat', 'physics', 'armory', 'items']) {
    vm.runInContext(
      fs.readFileSync(path.join(__dirname, '..', 'js', 'logic', file + '.js'), 'utf8'),
      context,
    );
  }
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'player.js'), 'utf8'), context);
  const camera = new THREE.PerspectiveCamera();
  const player = context.createPlayer(camera, canvas, {
    state,
    physics,
    effects,
    onPickupRequest: () => { pickupRequests++; return true; },
  });
  function key(code) {
    listeners.keydown({ code, preventDefault() {} });
  }
  return { player, state, key, fired, grenades, flashes, camera, events, pickups: () => pickupRequests };
}

function keysDown(setupResult, code) {
  setupResult.key(code);
}

test('la tecla 6 cura con botiquín y no gasta nada sin él o con la vida llena', () => {
  const run = setup();
  run.state.playerHp = 80;
  keysDown(run, 'Digit6');
  assert.equal(run.state.playerHp, 80, 'sin botiquín no cura');
  assert.deepEqual(run.flashes, [6]);

  run.player.inventory.medkit = 1;
  keysDown(run, 'Digit6');
  assert.equal(run.state.playerHp, 100);
  assert.equal(run.player.inventory.medkit, 0);

  run.player.inventory.medkit = 2;
  keysDown(run, 'Digit6');
  assert.equal(run.state.playerHp, 100, 'con la vida llena no consume');
  assert.equal(run.player.inventory.medkit, 2);
});

test('la tecla 7 rellena el cargador y cancela una recarga en curso', () => {
  const run = setup();
  run.key('Digit1');
  run.player.shoot();
  assert.equal(run.state.ammo, 0, 'el mosquete gasta su único tiro');
  assert.ok(run.state.reloadingUntil > run.state.time, 'arranca la recarga automática');
  assert.equal(run.player.inventory.ammoBag, 0);
  keysDown(run, 'Digit7');
  assert.equal(run.state.ammo, 0, 'sin bolsa no hay munición');

  run.player.inventory.ammoBag = 1;
  run.state.time = 10.5;
  keysDown(run, 'Digit7');
  assert.equal(run.player.inventory.ammoBag, 0);
  assert.equal(run.state.ammo, 1);
  assert.equal(run.state.reloading, false);
  assert.ok(!run.state.reloadingUntil || run.state.reloadingUntil <= run.state.time,
    'la recarga pendiente se cancela');
});

test('la tecla 8 lanza una granada con explosión de jugador y consume una carga', () => {
  const run = setup();
  run.player.inventory.grenade = 1;
  keysDown(run, 'Digit8');
  assert.equal(run.player.inventory.grenade, 0);
  assert.equal(run.grenades.length, 1);
  const shot = run.grenades[0];
  assert.equal(shot.owner, 'player');
  assert.equal(shot.damage, 120);
  assert.equal(shot.blastRadius, 4.5);
  assert.equal(shot.fortDamage, 0);
  assert.ok(shot.target.y >= 0.25, 'el objetivo no puede quedar bajo tierra');

  keysDown(run, 'Digit8');
  assert.equal(run.grenades.length, 1, 'sin granadas no lanza');
});

test('F pide recoger y las teclas 6-8 no cambian de arma', () => {
  const run = setup();
  run.key('Digit2');
  run.player.inventory.medkit = 1;
  run.player.inventory.ammoBag = 1;
  run.player.inventory.grenade = 1;
  keysDown(run, 'Digit6');
  keysDown(run, 'Digit7');
  keysDown(run, 'Digit8');
  keysDown(run, 'KeyF');
  assert.equal(run.player.getWeaponKey(), 'fusil');
  assert.equal(run.pickups(), 1);
});

test('el inventario se publica en el estado para el HUD', () => {
  const run = setup();
  assert.equal(run.state.inventory, run.player.inventory);
  const inventory = run.player.getInventory();
  assert.equal(inventory.medkit, 0);
  assert.equal(inventory.ammoBag, 0);
  assert.equal(inventory.grenade, 0);
});

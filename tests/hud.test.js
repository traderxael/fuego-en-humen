const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { makeDocument } = require('./helpers/fake-dom.js');
const { WEAPONS } = require('../js/logic/config');
const { ARMORY_ORDER } = require('../js/logic/armory');
const { ITEM_DEFS, createInventory } = require('../js/logic/items');

const HUD_IDS = [
  'hud', 'hud-health-bar', 'hud-health', 'hud-fort-bar', 'hud-fort', 'hud-wave',
  'hud-ammo', 'hit-marker', 'cannon-hint', 'damage-vignette', 'kill-popups',
  'hud-inventory', 'pickup-hint', 'hud-objective', 'hud-radio',
];

function runtime() {
  const document = makeDocument(HUD_IDS);
  const timers = [];
  const context = vm.createContext({
    document,
    PLAYER_HP: 100,
    FORT_INTEGRITY: 100,
    WAVES: [1, 2, 3],
    WEAPONS,
    ARMORY_ORDER,
    ITEM_DEFS,
    setTimeout: (fn) => { timers.push(fn); return timers.length; },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'hud.js'), 'utf8'), context);
  return { HUD: context.HUD, document, timers };
}

function state(overrides) {
  return Object.assign({
    playerHp: 100,
    fortIntegrity: 100,
    wave: 1,
    weapon: 'mosquete',
    ammo: 1,
    clipSize: 1,
    time: 0,
    inventory: createInventory(),
  }, overrides);
}

function slots(inventoryEl) {
  return inventoryEl.children;
}

test('la barra de inventario crea ocho huecos con su tecla', () => {
  const { HUD, document } = runtime();
  HUD.updateHUD(state());
  const bar = document.getElementById('hud-inventory');
  assert.equal(slots(bar).length, 8);
  const keys = slots(bar).map((slot) => slot.getAttribute('data-slot'));
  assert.deepEqual(keys, ['1', '2', '3', '4', '5', '6', '7', '8']);
  for (const slot of slots(bar)) {
    const keyLabel = slot.children.find((child) => child.className.includes('inv-key'));
    assert.ok(keyLabel && keyLabel.textContent === slot.getAttribute('data-slot'));
  }
  assert.equal(slots(bar)[0].children.find((c) => c.className.includes('inv-name')).textContent,
    WEAPONS[ARMORY_ORDER[0]].label);
});

test('el arma activa se marca y los objetos vacíos se atenúan', () => {
  const { HUD, document } = runtime();
  const inventory = createInventory();
  inventory.medkit = 2;
  inventory.grenade = 1;
  HUD.updateHUD(state({ weapon: 'trabuco', inventory }));
  const bar = document.getElementById('hud-inventory');
  const list = slots(bar);
  assert.equal(list[4].classList.contains('inv-slot-on'), true, 'el trabuco es el hueco 5');
  assert.equal(list[0].classList.contains('inv-slot-on'), false);

  const medkit = list[5];
  assert.equal(medkit.classList.contains('inv-slot-empty'), false);
  assert.equal(medkit.children.find((c) => c.className.includes('inv-count')).textContent, '2');
  assert.equal(list[6].classList.contains('inv-slot-empty'), true);
  assert.equal(list[6].children.find((c) => c.className.includes('inv-count')).textContent, '0');
  assert.equal(list[7].children.find((c) => c.className.includes('inv-count')).textContent, '1');
});

test('el HUD sólo reescribe el DOM cuando cambia algo', () => {
  const { HUD, document } = runtime();
  const inventory = createInventory();
  const current = state({ weapon: 'fusil', inventory });
  HUD.updateHUD(current);
  const bar = document.getElementById('hud-inventory');
  const total = () => bar.children.reduce(
    (sum, slot) => sum + slot.textWrites + slot.children.reduce((inner, child) => inner + child.textWrites, 0),
    0,
  );
  const before = total();
  HUD.updateHUD(current);
  assert.equal(total(), before, 'un segundo update idéntico no debe escribir');
  inventory.medkit = 1;
  HUD.updateHUD(current);
  assert.ok(total() > before, 'al cambiar el inventario sí debe escribir');
});

test('setPickupHint muestra y oculta el aviso de recogida', () => {
  const { HUD, document } = runtime();
  const hint = document.getElementById('pickup-hint');
  HUD.setPickupHint('[F] Recoger botiquín');
  assert.equal(hint.textContent, '[F] Recoger botiquín');
  assert.equal(hint.classList.contains('hidden'), false);
  HUD.setPickupHint(null);
  assert.equal(hint.classList.contains('hidden'), true);
});

test('flashSlot marca el hueco usado y lo apaga al vencer el pulso', () => {
  const { HUD, document, timers } = runtime();
  HUD.updateHUD(state());
  const bar = document.getElementById('hud-inventory');
  HUD.flashSlot(6);
  assert.equal(slots(bar)[5].classList.contains('inv-slot-pulse'), true);
  assert.equal(timers.length, 1);
  timers[0]();
  assert.equal(slots(bar)[5].classList.contains('inv-slot-pulse'), false);
  HUD.flashDamage();
  assert.equal(document.getElementById('damage-vignette').classList.contains('hit-flash'), true);
});

test('la línea de objetivo se pinta y se oculta', () => {
  const { HUD, document } = runtime();
  HUD.updateObjective('Objetivo 1/2 · Silencia el cañón');
  const el = document.getElementById('hud-objective');
  assert.equal(el.textContent, 'Objetivo 1/2 · Silencia el cañón');
  assert.equal(el.classList.contains('hidden'), false);
  HUD.updateObjective(null);
  assert.equal(el.classList.contains('hidden'), true);
});

test('la radio muestra la línea y se apaga con el temporizador', () => {
  const { HUD, document, timers } = runtime();
  HUD.radio('Chen Wei, aguanta el primer choque.');
  const el = document.getElementById('hud-radio');
  assert.equal(el.textContent, 'Chen Wei, aguanta el primer choque.');
  assert.equal(el.classList.contains('hidden'), false);
  const hide = timers[timers.length - 1];
  hide();
  assert.equal(el.classList.contains('hidden'), true);
});

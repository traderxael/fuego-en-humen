const test = require('node:test');
const assert = require('node:assert');

const THREE = require('../vendor/three.min.js');
global.THREE = THREE;

const Models = require('../js/models');
const { DIALOGUES } = require('../js/dialogues');
const { Voice } = require('../js/voice');

test('Models.makeCannon builds high-detail cannon with recoil pivot and trigger', () => {
  const cannon = Models.makeCannon();
  assert.ok(cannon, 'cannon exists');
  assert.strictEqual(cannon.userData.type, 'cannon');
  assert.strictEqual(typeof cannon.userData.triggerRecoil, 'function');
  assert.strictEqual(typeof cannon.userData.updateRecoil, 'function');

  // Trigger recoil and check offset
  cannon.userData.triggerRecoil();
  assert.ok(cannon.userData.recoilOffset > 0.5, 'recoil displacement active');
  cannon.userData.updateRecoil(0.2);
  assert.ok(cannon.userData.recoilOffset < 0.58, 'recoil springs back over time');
});

test('Models.makeShip builds 3-masted British warship', () => {
  const ship = Models.makeShip();
  assert.ok(ship, 'ship exists');
  assert.strictEqual(ship.userData.type, 'ship');
  assert.ok(ship.children.length >= 10, 'has hull, masts, sails, and details');
});

test('Models.makeFortWall builds textured masonry wall with parapet', () => {
  const wall = Models.makeFortWall(20, 4);
  assert.ok(wall, 'wall exists');
  assert.strictEqual(wall.userData.type, 'fort-wall');
  assert.ok(wall.children.length >= 3, 'has base, body, coping, and merlons');
});

test('Models.makeWatchtower, makeFlagPole, and tactical props build expected structures', () => {
  const tower = Models.makeWatchtower();
  assert.strictEqual(tower.userData.type, 'watchtower');

  const flag = Models.makeFlagPole(8);
  assert.strictEqual(flag.userData.type, 'flagpole');
  assert.strictEqual(typeof flag.userData.update, 'function');

  const barrel = Models.makePowderBarrel();
  assert.strictEqual(barrel.userData.type, 'powder-barrel');

  const shot = Models.makeCannonballStack();
  assert.strictEqual(shot.userData.type, 'cannonball-stack');

  const sandbags = Models.makeSandbagWall(4);
  assert.strictEqual(sandbags.userData.type, 'sandbag-wall');
});

test('Models.makeQingSoldier builds imperial Green Standard defender', () => {
  const qing = Models.makeQingSoldier();
  assert.ok(qing, 'qing soldier exists');
  assert.strictEqual(qing.userData.type, 'qing-soldier');
  assert.ok(qing.children.length >= 6, 'has robe, boots, hat with tassel, sash, and musket');
});

test('DIALOGUES defines narrative arc, Maestro Xu narrator lines, and combat barks', () => {
  assert.ok(DIALOGUES.narrator, 'narrator defined');
  assert.strictEqual(DIALOGUES.narrator.name, 'Maestro Xu');
  assert.strictEqual(typeof DIALOGUES.narrateWave(1), 'string');
  assert.strictEqual(typeof DIALOGUES.narrateEnd('victory'), 'string');
  assert.strictEqual(typeof DIALOGUES.waveToast(1), 'string');

  const bark = DIALOGUES.bark('chen', 'reload');
  assert.strictEqual(typeof bark, 'string');
});

test('Voice provides stateful API with safe fallbacks in Node', () => {
  assert.strictEqual(typeof Voice.isEnabled, 'function');
  assert.strictEqual(typeof Voice.speak, 'function');
  assert.strictEqual(typeof Voice.stop, 'function');
  assert.strictEqual(typeof Voice.toggle, 'function');
  // In Node environment without window.speechSynthesis, speak gracefully returns false
  assert.strictEqual(Voice.speak('test line'), false);
});

test('sfx audio synthesis methods are safe and non-throwing without DOM', () => {
  const { sfx } = require('../js/audio');
  assert.ok(sfx, 'sfx module exported');
  assert.strictEqual(typeof sfx.shot, 'function');
  assert.strictEqual(typeof sfx.cannon, 'function');
  assert.strictEqual(typeof sfx.enemyShot, 'function');

  // Must not throw when called outside browser
  assert.doesNotThrow(() => {
    sfx.shot();
    sfx.cannon();
    sfx.enemyShot();
    sfx.swish();
    sfx.reload();
    sfx.heal();
  });
});

test('Medical station, firing banquette, assault ladder, 10-wave dialogues and heal/reload clips', () => {
  const station = Models.makeMedicalStation();
  assert.strictEqual(station.userData.type, 'medical-station');
  assert.ok(station.userData.zoneRing);

  const step = Models.makeFiringStep(4.2);
  assert.strictEqual(step.userData.type, 'firing-step');

  const ladder = Models.makeAssaultLadder(2.4);
  assert.strictEqual(ladder.userData.type, 'assault-ladder');

  for (let w = 1; w <= 10; w++) {
    assert.strictEqual(typeof DIALOGUES.narrateWave(w), 'string');
    assert.ok(DIALOGUES.narrateWave(w).length > 5);
    assert.strictEqual(typeof DIALOGUES.waveToast(w), 'string');
  }
  assert.strictEqual(typeof DIALOGUES.bark('chen', 'heal'), 'string');

  const Rig = require('../js/rig/humanoid');
  const RigAnim = require('../js/rig/anim');
  const vm = Rig.buildViewmodel({});
  assert.ok(vm.weapon && vm.weapon.userData && vm.weapon.userData.ramrod, 'viewmodel musket exposes ramrod');

  const anim = new RigAnim.Animator(vm);
  const healClip = RigAnim.Clips.vmHeal();
  assert.strictEqual(healClip.name, 'vmHeal');
  anim.play(healClip);
  anim.update(0.6);
  assert.ok(anim.pose.targets.leftMode < 0.5 && anim.pose.targets.rightMode < 0.5, 'both hands free to bandage');

  const reloadClip = RigAnim.Clips.vmReload();
  assert.strictEqual(reloadClip.name, 'vmReload');
  anim.play(reloadClip, { restart: true });
  anim.time = 0.75;
  anim.update(0);
  assert.ok(anim.pose.targets.rightMode < 0.5, 'right hand pours powder at t=0.75');
});

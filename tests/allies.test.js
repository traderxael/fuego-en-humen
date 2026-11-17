const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const THREE = require('../vendor/three.min.js');

function setup() {
  const clipNames = {};
  ['idle', 'walk', 'aim', 'fire'].forEach(function (name) {
    clipNames[name] = function () { return { name: name, duration: 1, loop: true, fn: function () {} }; };
  });
  const RigAnim = {
    Clips: clipNames,
    Animator: function () {
      this.state = null;
      this.speed = 1;
      this.updates = 0;
    },
  };
  RigAnim.Animator.prototype.play = function (clip) { if (clip) this.state = clip.name; };
  RigAnim.Animator.prototype.playAdditive = function () {};
  RigAnim.Animator.prototype.update = function () { this.updates++; };

  const Rig = {
    buildSoldier: function () { return { group: new THREE.Group(), bones: {}, variant: 'qing' }; },
  };
  const Models = {
    makeRattanShield: function () {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.05));
      mesh.userData.type = 'rattan-shield';
      return mesh;
    },
  };

  const context = vm.createContext({ THREE, Rig, RigAnim, Models });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'logic', 'ally.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'allies.js'), 'utf8'), context);

  const fort = new THREE.Group();
  fort.position.set(0, 0, 20);
  const world = { fort: fort };
  const shots = [];
  const flashes = [];
  const sounds = [];
  const physics = {
    fireMusket: function (opts) { shots.push(opts); return {}; },
    lineOfSight: function () { return true; },
  };
  const effects = { muzzleFlash: function (from, dir) { flashes.push({ from: from, dir: dir }); } };
  const allies = context.Allies.create({
    world: world,
    physics: physics,
    effects: effects,
    sfxCall: function (name, arg) { sounds.push({ name: name, arg: arg }); },
  });
  const player = { enemies: [] };
  return { allies, fort, shots, flashes, sounds, physics, player };
}

function enemyAt(x, y, z, hp) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  pivot.userData = { hp: hp === undefined ? 45 : hp, kind: 'soldier' };
  return pivot;
}

test('crea ocho aliados qing sobre el rig; los móviles llevan escudo de ratán', () => {
  const run = setup();
  assert.equal(run.allies.list.length, 8);
  assert.equal(run.allies.list.filter(function (ally) { return ally.mobile; }).length, 4);
  for (const ally of run.allies.list) {
    assert.equal(ally.pivot.userData.ally, true);
    assert.equal(ally.pivot.parent, run.fort);
    const shield = ally.pivot.children.find(function (child) { return child.userData.type === 'rattan-shield'; });
    assert.equal(!!shield, ally.mobile, 'solo los móviles llevan escudo');
  }
});

test('los aliados disparan al enemigo más cercano y respetan la recarga', () => {
  const run = setup();
  run.player.enemies.push(enemyAt(0, 0.9, 30));
  run.allies.update(0.016, run.player, 10);
  assert.equal(run.shots.length, 8, 'los ocho abren fuego');
  for (const shot of run.shots) {
    assert.equal(shot.owner, 'player', 'los perdigones aliados no dañan a otros aliados');
    assert.equal(shot.kind, 'ally');
    assert.equal(shot.withTrail, false);
    assert.equal(shot.damage, 26);
    assert.ok(shot.from.y > 1);
  }
  assert.equal(run.flashes.length, 8);
  assert.deepEqual(Array.from(run.sounds, function (s) { return s.name; }), new Array(8).fill('enemyShot'));
  run.allies.update(0.016, run.player, 10.2);
  assert.equal(run.shots.length, 8, 'la recarga frena el segundo disparo');
  run.allies.update(0.016, run.player, 12);
  assert.equal(run.shots.length, 16);
});

test('sin línea de visión no disparan y los móviles patrullan', () => {
  const run = setup();
  run.physics.lineOfSight = function () { return false; };
  run.player.enemies.push(enemyAt(0, 0.9, 30));
  const fixed = run.allies.list.filter(function (ally) { return !ally.mobile; });
  const mobile = run.allies.list.filter(function (ally) { return ally.mobile; });
  const fixedBefore = fixed.map(function (ally) { return ally.pivot.position.clone(); });
  const mobileBefore = mobile.map(function (ally) { return ally.pivot.position.clone(); });
  run.allies.update(0.5, run.player, 10);
  assert.equal(run.shots.length, 0);
  fixed.forEach(function (ally, i) { assert.ok(ally.pivot.position.equals(fixedBefore[i])); });
  mobile.forEach(function (ally, i) { assert.equal(ally.pivot.position.equals(mobileBefore[i]), false); });
});

test('ignoran enemigos muertos y pasan al siguiente objetivo', () => {
  const run = setup();
  const near = enemyAt(0, 0.9, 32);
  const far = enemyAt(0, 0.9, 40);
  run.player.enemies.push(near, far);
  run.allies.update(0.016, run.player, 10);
  assert.equal(run.allies.list[0].target, near);
  near.userData.hp = 0;
  near.userData.dead = true;
  run.allies.update(0.016, run.player, 10.5);
  assert.equal(run.allies.list[0].target, far);
});

test('la animación sigue el estado: apuntan al enemigo y caminan en patrulla', () => {
  const run = setup();
  run.player.enemies.push(enemyAt(0, 0.9, 30));
  run.allies.update(0.016, run.player, 10);
  assert.equal(run.allies.list[0].pivot.userData.animState, 'aim');
  run.player.enemies.length = 0;
  run.allies.update(0.5, run.player, 11);
  const mobile = run.allies.list.find(function (ally) { return ally.mobile; });
  assert.equal(mobile.pivot.userData.animState, 'walk');
  assert.ok(mobile.pivot.userData.animator.updates > 0, 'el animador avanza');
});

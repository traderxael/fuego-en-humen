const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const THREE = require('../vendor/three.min.js');

function setup() {
  const Models = {
    makeRattanShield: function () {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.05));
      mesh.userData.type = 'rattan-shield';
      return mesh;
    },
  };
  const context = vm.createContext({ THREE, Models });
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, '..', 'js', 'logic', 'ally.js'), 'utf8'),
    context,
  );
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, '..', 'js', 'allies.js'), 'utf8'),
    context,
  );

  const fort = new THREE.Group();
  fort.position.set(0, 0, 20);
  const garrison = context.ALLY_DEFS.map((def) => {
    const qing = new THREE.Group();
    qing.position.set(def.fortLocal[0], def.fortLocal[1], def.fortLocal[2]);
    fort.add(qing);
    return qing;
  });
  const world = { fort, garrison };
  const shots = [];
  const flashes = [];
  const sounds = [];
  const physics = {
    fireMusket: (opts) => { shots.push(opts); return {}; },
    lineOfSight: () => true,
  };
  const effects = { muzzleFlash: (from, dir) => flashes.push({ from, dir }) };
  const allies = context.Allies.create({
    world,
    physics,
    effects,
    sfxCall: (name, arg) => sounds.push({ name, arg }),
  });
  const player = { enemies: [] };
  return { allies, garrison, world, shots, flashes, sounds, physics, player, fort };
}

function enemyAt(x, y, z, hp) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  pivot.userData = { hp: hp === undefined ? 45 : hp, kind: 'soldier' };
  return pivot;
}

test('adopta la guarnición y la marca como aliada', () => {
  const { allies, garrison } = setup();
  assert.equal(allies.list.length, 8);
  assert.equal(allies.list.filter((ally) => ally.mobile).length, 4);
  for (const ally of allies.list) {
    assert.equal(ally.pivot.userData.ally, true);
    assert.ok(garrison.includes(ally.pivot));
    const shield = ally.pivot.children.find((child) => child.userData.type === 'rattan-shield');
    assert.equal(!!shield, ally.mobile, 'solo los móviles llevan escudo de ratán');
  }
});

test('los aliados disparan al británico más cercano y respetan la recarga', () => {
  const run = setup();
  run.player.enemies.push(enemyAt(0, 0.9, 30));
  run.allies.update(0.016, run.player, 10);
  assert.equal(run.shots.length, 8, 'los ocho abren fuego a la vez');
  for (const shot of run.shots) {
    assert.equal(shot.owner, 'player', 'los perdigones aliados no dañan a otros aliados');
    assert.equal(shot.kind, 'ally');
    assert.equal(shot.withTrail, false);
    assert.equal(shot.damage, 26);
    assert.ok(shot.from.y > 1, 'disparan a la altura del pecho');
  }
  assert.equal(run.flashes.length, 8);
  assert.deepEqual(Array.from(run.sounds, (s) => s.name), new Array(8).fill('enemyShot'));

  run.allies.update(0.016, run.player, 10.2);
  assert.equal(run.shots.length, 8, 'la recarga frena el segundo disparo');
  run.allies.update(0.016, run.player, 12);
  assert.equal(run.shots.length, 16);
});

test('sin línea de visión no disparan y los móviles patrullan', () => {
  const run = setup();
  run.physics.lineOfSight = () => false;
  run.player.enemies.push(enemyAt(0, 0.9, 30));
  const fixed = run.allies.list.filter((ally) => !ally.mobile);
  const fixedBefore = Array.from(fixed, (ally) => ally.pivot.position.clone());
  const mobile = run.allies.list.filter((ally) => ally.mobile);
  const mobileBefore = Array.from(mobile, (ally) => ally.pivot.position.clone());

  run.allies.update(0.5, run.player, 10);
  assert.equal(run.shots.length, 0);
  fixed.forEach((ally, i) => assert.ok(ally.pivot.position.equals(fixedBefore[i]), 'los fijos no se mueven'));
  mobile.forEach((ally, i) => assert.equal(ally.pivot.position.equals(mobileBefore[i]), false,
    'los móviles avanzan hacia su ruta'));
});

test('ignoran enemigos muertos y eligen un objetivo nuevo al caer el anterior', () => {
  const run = setup();
  const near = enemyAt(0, 0.9, 32);
  const far = enemyAt(0, 0.9, 40);
  run.player.enemies.push(near, far);
  run.allies.update(0.016, run.player, 10);
  assert.equal(run.allies.list[0].target, near);

  near.userData.hp = 0;
  near.userData.dead = true;
  run.allies.update(0.016, run.player, 10.5);
  assert.equal(run.allies.list[0].target, far, 'el escaneo descarta al caído');
});

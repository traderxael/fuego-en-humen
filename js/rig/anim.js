// Animation system for the procedural rigs.
//
// Model: a clip never rotates the arms. It places the musket and the two
// hand targets (in the chest's local frame) and animates the torso, head and
// legs. A two bone analytic IK then solves the shoulders, elbows and fists,
// so the hands are always exactly on the weapon or on the cartridge pouch.
//
// A clip is { name, duration, loop, fn(t, pose) }.
//
// Browser global `RigAnim`; also guarded for Node tooling consistency.

var RigAnim = (function () {
  var DOWN = new THREE.Vector3(0, -1, 0);
  var IDENTITY = new THREE.Quaternion();

  var _v1 = new THREE.Vector3();
  var _v2 = new THREE.Vector3();
  var _v3 = new THREE.Vector3();
  var _v4 = new THREE.Vector3();
  var _v5 = new THREE.Vector3();
  var _v6 = new THREE.Vector3();
  var _q1 = new THREE.Quaternion();
  var _q2 = new THREE.Quaternion();
  var _q3 = new THREE.Quaternion();
  var _q4 = new THREE.Quaternion();
  var _e1 = new THREE.Euler();
  // Dedicated temporaries for the IK solver: solveArm() reuses _v1.._v6, so
  // the hand targets must live in their own vectors.
  var _t1 = new THREE.Vector3();
  var _t2 = new THREE.Vector3();
  var _t3 = new THREE.Vector3();
  var _t4 = new THREE.Vector3();

  function ensureTmp() {
    // The temporaries are created eagerly, so nothing else is needed here.
  }

  // --- Pose ---------------------------------------------------------------
  // targets.rightMode / leftMode: 1 = the hand follows the musket, 0 = the
  // hand uses the free target. Values in between blend between the two, so a
  // reload can move a hand to the pouch and back without popping.
  function createPose(rig) {
    var bones = {};
    for (var i = 0; i < rig.boneNames.length; i++) {
      var n = rig.boneNames[i];
      bones[n] = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
    }
    return {
      bones: bones,
      rig: rig,
      targets: {
        right: new THREE.Vector3(),
        left: new THREE.Vector3(),
        rightMode: 1,
        leftMode: 1,
      },
    };
  }

  function resetPose(pose, rig) {
    for (var i = 0; i < rig.boneNames.length; i++) {
      var n = rig.boneNames[i];
      var slot = pose.bones[n];
      if (!slot) continue;
      slot.p.copy(rig.rest[n].p);
      slot.q.copy(rig.rest[n].q);
    }
    var t = pose.targets;
    t.rightMode = 1;
    t.leftMode = 1;
    t.right.copy(rig.ik ? rig.ik.grip : ZERO);
    t.left.copy(rig.ik ? rig.ik.barrel : ZERO);
  }

  var ZERO = new THREE.Vector3();

  function applyHold(pose, rig) {
    if (!rig.hold) return;
    for (var name in rig.hold) {
      var slot = pose.bones[name];
      if (!slot) continue;
      slot.q.copy(rig.hold[name].q);
    }
  }

  function setEuler(pose, name, x, y, z) {
    var slot = pose.bones[name];
    if (!slot) return;
    _e1.set(x, y, z, 'XYZ');
    slot.q.setFromEuler(_e1);
  }

  // Rotates on top of whatever the pose already holds (sway, additive kicks).
  function addEuler(pose, name, x, y, z) {
    var slot = pose.bones[name];
    if (!slot) return;
    _e1.set(x, y, z, 'XYZ');
    _q2.setFromEuler(_e1);
    slot.q.multiply(_q2);
  }

  function setQuat(pose, name, q) {
    var slot = pose.bones[name];
    if (!slot) return;
    slot.q.copy(q);
  }

  function offsetPos(pose, name, x, y, z) {
    var slot = pose.bones[name];
    if (!slot) return;
    slot.p.x += x;
    slot.p.y += y;
    slot.p.z += z;
  }

  // Hands: mode 1 follows the musket, 0 uses the given free target.
  function setHand(pose, side, x, y, z) {
    var t = pose.targets;
    if (side === 'R') {
      t.rightMode = 0;
      t.right.set(x, y, z);
    } else {
      t.leftMode = 0;
      t.left.set(x, y, z);
    }
  }

  function setHandMode(pose, side, mode) {
    if (side === 'R') pose.targets.rightMode = mode;
    else pose.targets.leftMode = mode;
  }

  // --- Sampling -----------------------------------------------------------
  function sample(clip, time, pose, rig) {
    resetPose(pose, rig);
    applyHold(pose, rig);
    if (!clip) return pose;
    var t = clip.duration > 0 ? time % clip.duration : 0;
    if (clip.loop === false && time > clip.duration) t = clip.duration;
    if (typeof clip.fn === 'function') clip.fn(t, pose);
    return pose;
  }

  function applyAdditive(base, delta, weight) {
    for (var name in delta.bones) {
      var slot = base.bones[name];
      if (!slot) continue;
      var d = delta.bones[name];
      if (weight < 1) {
        _q3.copy(d.q).slerp(IDENTITY, 1 - weight);
        slot.q.multiply(_q3);
      } else {
        slot.q.multiply(d.q);
      }
      slot.p.x += d.p.x * weight;
      slot.p.y += d.p.y * weight;
      slot.p.z += d.p.z * weight;
    }
  }

  function blend(a, b, w, out) {
    var rig = out.rig || a.rig;
    for (var i = 0; i < rig.boneNames.length; i++) {
      var n = rig.boneNames[i];
      var pa = a.bones[n];
      var pb = b.bones[n];
      var po = out.bones[n];
      if (!pa || !pb || !po) continue;
      po.p.lerpVectors(pa.p, pb.p, w);
      po.q.copy(pa.q).slerp(pb.q, w);
    }
    out.targets.rightMode = a.targets.rightMode + (b.targets.rightMode - a.targets.rightMode) * w;
    out.targets.leftMode = a.targets.leftMode + (b.targets.leftMode - a.targets.leftMode) * w;
    out.targets.right.lerpVectors(a.targets.right, b.targets.right, w);
    out.targets.left.lerpVectors(a.targets.left, b.targets.left, w);
    return out;
  }

  // --- Two bone IK --------------------------------------------------------
  // Solves the shoulder and elbow so the hand lands on `target`, both given
  // in the chest's local frame.
  function solveArm(pose, rig, side, target) {
    var ik = rig.ik;
    if (!ik) return;
    var shoulder = side === 'R' ? ik.shoulderR : ik.shoulderL;
    var L1 = side === 'R' ? ik.L1R : ik.L1L;
    var L2 = side === 'R' ? ik.L2R : ik.L2L;

    _v1.copy(target).sub(shoulder);
    var d = _v1.length();
    if (d < 1e-5) {
      _v1.set(0, -1, 0);
      d = 0.001;
    } else {
      _v1.divideScalar(d);
    }
    var dc = Math.max(Math.abs(L1 - L2) + 0.02, Math.min((L1 + L2) * 0.995, d));

    // The elbow points down and back.
    if (side === 'R') _v2.set(0.25, -1, 0.6);
    else _v2.set(-0.25, -1, 0.6);
    _v2.normalize();

    _v3.crossVectors(_v1, _v2);
    if (_v3.lengthSq() < 1e-8) _v3.set(1, 0, 0);
    else _v3.normalize();

    var cosA = (L1 * L1 + dc * dc - L2 * L2) / (2 * L1 * dc);
    var a = Math.acos(Math.max(-1, Math.min(1, cosA)));
    _q1.setFromAxisAngle(_v3, a);

    _v4.copy(_v1).applyQuaternion(_q1).normalize();
    _q2.setFromUnitVectors(DOWN, _v4);

    _v5.copy(shoulder).addScaledVector(_v4, L1);
    _v6.copy(target).sub(_v5);
    if (_v6.lengthSq() < 1e-8) _v6.copy(_v4);
    else _v6.normalize();
    _q3.setFromUnitVectors(DOWN, _v6);

    _q4.copy(_q2).invert().multiply(_q3);

    setQuat(pose, 'shoulder' + side, IDENTITY);
    setQuat(pose, 'upperArm' + side, _q2);
    setQuat(pose, 'forearm' + side, _q4);
  }

  // Places the hands on the musket (or on their free targets) and solves the
  // arms. Runs after the pose is blended, so the hands follow the weapon
  // through every transition.
  function solveArms(rig, pose) {
    var ik = rig.ik;
    if (!ik) return;
    var wq = pose.bones.weapon ? pose.bones.weapon.q : IDENTITY;

    var grip = _t1.copy(ik.grip).applyQuaternion(wq).add(ik.weaponRest);
    var barrel = _t2.copy(ik.barrel).applyQuaternion(wq).add(ik.weaponRest);

    var right = _t3.copy(pose.targets.right).lerp(grip, pose.targets.rightMode);
    var left = _t4.copy(pose.targets.left).lerp(barrel, pose.targets.leftMode);

    solveArm(pose, rig, 'R', right);
    solveArm(pose, rig, 'L', left);
  }

  function applyPose(rig, pose) {
    for (var i = 0; i < rig.boneNames.length; i++) {
      var n = rig.boneNames[i];
      var bone = rig.byName[n];
      var slot = pose.bones[n];
      if (!bone || !slot) continue;
      bone.position.copy(slot.p);
      bone.quaternion.copy(slot.q);
    }
  }

  // --- Animator -----------------------------------------------------------
  function Animator(rig, options) {
    options = options || {};
    this.rig = rig;
    this.pose = createPose(rig);
    this.current = createPose(rig);
    this.previous = createPose(rig);
    this.delta = createPose(rig);
    this.clip = null;
    this.prevClip = null;
    this.time = 0;
    this.prevTime = 0;
    this.fade = 1;
    this.fadeDur = options.fade != null ? options.fade : 0.14;
    this.speed = 1;
    this.onEnd = options.onEnd || null;
    this.additive = null;
    this.additiveTime = 0;
    this.additiveSpeed = 1;
    this.additiveWeight = 1;
  }

  Animator.prototype.play = function (clip, opts) {
    opts = opts || {};
    if (!clip) return this;
    if (this.clip === clip && !opts.restart) {
      if (opts.fade != null) this.fadeDur = opts.fade;
      return this;
    }
    this.prevClip = this.clip;
    this.prevTime = this.time;
    this.clip = clip;
    this.time = 0;
    this.fade = this.prevClip ? 0 : 1;
    this.fadeDur = opts.fade != null ? opts.fade : this.fadeDur;
    this.speed = opts.speed != null ? opts.speed : 1;
    this.onEnd = opts.onEnd || null;
    return this;
  };

  Animator.prototype.playAdditive = function (clip, weight, speed) {
    if (!clip) return this;
    this.additive = clip;
    this.additiveTime = 0;
    this.additiveWeight = weight != null ? weight : 1;
    this.additiveSpeed = speed != null ? speed : 1;
    return this;
  };

  Animator.prototype.stopAdditive = function () {
    this.additive = null;
    return this;
  };

  Animator.prototype.update = function (dt) {
    dt = Math.min(Math.max(dt || 0, 0), 0.1);
    if (this.clip) {
      this.time += dt * this.speed;
      if (this.clip.loop === false && this.time >= this.clip.duration) {
        this.time = this.clip.duration;
        if (this.onEnd) this.onEnd(this);
      }
    }
    if (this.prevClip) this.prevTime += dt;

    sample(this.clip, this.time, this.current, this.rig);
    if (this.prevClip && this.fade < 1) {
      sample(this.prevClip, this.prevTime, this.previous, this.rig);
      this.fade = Math.min(1, this.fade + dt / (this.fadeDur || 0.14));
      blend(this.previous, this.current, this.fade, this.pose);
    } else {
      this.fade = 1;
      for (var i = 0; i < this.rig.boneNames.length; i++) {
        var n = this.rig.boneNames[i];
        var src = this.current.bones[n];
        var dst = this.pose.bones[n];
        if (!src || !dst) continue;
        dst.p.copy(src.p);
        dst.q.copy(src.q);
      }
      this.pose.targets.rightMode = this.current.targets.rightMode;
      this.pose.targets.leftMode = this.current.targets.leftMode;
      this.pose.targets.right.copy(this.current.targets.right);
      this.pose.targets.left.copy(this.current.targets.left);
    }

    if (this.additive) {
      this.additiveTime += dt * this.additiveSpeed;
      if (this.additiveTime >= this.additive.duration) {
        this.additive = null;
      } else {
        sample(this.additive, this.additiveTime, this.delta, this.rig);
        applyAdditive(this.pose, this.delta, this.additiveWeight);
      }
    }

    // The arms are solved last so they follow the final weapon transform.
    solveArms(this.rig, this.pose);
    applyPose(this.rig, this.pose);
    return this;
  };

  // --- Clip library -------------------------------------------------------
  function smooth(u) {
    if (u <= 0) return 0;
    if (u >= 1) return 1;
    return u * u * (3 - 2 * u);
  }

  // 0..1 ramp between two times.
  function ramp(t, t0, t1) {
    return smooth((t - t0) / Math.max(1e-6, t1 - t0));
  }

  function Clips() {}

  // Port arms: the musket carried across the body, muzzle up.
  var PORT_X = 1.05;
  var PORT_Y = 0.3;

  // Musket shouldered, pointing downrange.
  var AIM_X = 0.02;
  var AIM_Y = 0.05;

  Clips.idle = function () {
    return {
      name: 'idle',
      duration: 4.2,
      loop: true,
      fn: function (t, pose) {
        var b = Math.sin((t * Math.PI * 2) / 4.2);
        var b2 = Math.sin((t * Math.PI * 2) / 2.1 + 0.7);
        setEuler(pose, 'weapon', PORT_X + b * 0.012, PORT_Y + b2 * 0.02, 0);
        addEuler(pose, 'chest', 0.022 * b, 0.012 * b2, 0);
        addEuler(pose, 'head', -0.03 * b, 0.05 * b2, 0);
        offsetPos(pose, 'hips', 0, 0.004 * b, 0);
      },
    };
  };

  // Marching cycle; `power` scales the stride and the lean.
  Clips.walk = function (power) {
    var amp = power || 1;
    var period = 1.05 / Math.max(0.35, amp);
    return {
      name: 'walk',
      duration: period,
      loop: true,
      fn: function (t, pose) {
        var p = t * Math.PI * 2;
        var s = Math.sin(p);
        var c = Math.cos(p);
        var stride = 0.5 * amp;
        setEuler(pose, 'thighR', s * stride, 0, 0);
        setEuler(pose, 'thighL', -s * stride, 0, 0);
        var kneeR = Math.max(0, -Math.sin(p - 0.75)) * (0.9 * amp);
        var kneeL = Math.max(0, -Math.sin(p + Math.PI - 0.75)) * (0.9 * amp);
        setEuler(pose, 'shinR', kneeR, 0, 0);
        setEuler(pose, 'shinL', kneeL, 0, 0);
        setEuler(pose, 'footR', -s * 0.2 * amp + kneeR * 0.28, 0, 0);
        setEuler(pose, 'footL', s * 0.2 * amp + kneeL * 0.28, 0, 0);
        offsetPos(pose, 'hips', 0, Math.abs(c) * 0.035 * amp - 0.017 * amp, 0);
        setEuler(pose, 'hips', 0, -s * 0.11 * amp, 0);
        addEuler(pose, 'chest', 0.04 * amp, s * 0.07 * amp, 0);
        addEuler(pose, 'head', -0.035 * amp, -s * 0.05 * amp, 0);
        // The musket rides with the stride.
        setEuler(pose, 'weapon', PORT_X - s * 0.05 * amp, PORT_Y + s * 0.06 * amp, 0);
        offsetPos(pose, 'weapon', 0, c * 0.012 * amp, 0);
      },
    };
  };

  Clips.run = function () {
    return Clips.walk(1.55);
  };

  // Musket shouldered, aimed downrange.
  Clips.aim = function () {
    return {
      name: 'aim',
      duration: 3.6,
      loop: true,
      fn: function (t, pose) {
        var b = Math.sin(t * 1.9);
        setEuler(pose, 'weapon', AIM_X + b * 0.006, AIM_Y, 0);
        setEuler(pose, 'chest', 0, 0.14, 0);
        setEuler(pose, 'head', 0, -0.12, 0);
        addEuler(pose, 'chest', b * 0.012, 0, 0);
      },
    };
  };

  // Recoil kick, layered additively over whatever the soldier is doing.
  Clips.fire = function () {
    return {
      name: 'fire',
      duration: 0.45,
      loop: false,
      additive: true,
      fn: function (t, pose) {
        var kick = Math.max(0, 1 - t / 0.1);
        var settle = Math.max(0, 1 - t / 0.45);
        addEuler(pose, 'upperArmR', -0.26 * kick, 0, 0);
        addEuler(pose, 'forearmR', 0.34 * kick, 0, 0);
        addEuler(pose, 'shoulderR', -0.12 * kick, 0, 0);
        addEuler(pose, 'chest', -0.1 * kick, 0.05 * kick, 0);
        addEuler(pose, 'head', 0.14 * kick, 0, 0);
        addEuler(pose, 'weapon', 0.42 * kick, 0, 0);
        offsetPos(pose, 'hips', 0, -0.02 * settle, 0);
      },
    };
  };

  // Loading a flintlock: bite the cartridge, prime the pan, ram the charge.
  Clips.reload = function () {
    return {
      name: 'reload',
      duration: 2.6,
      loop: false,
      fn: function (t, pose) {
        var lower = ramp(t, 0.05, 0.5);
        var grab = ramp(t, 0.5, 0.9);
        var raise = ramp(t, 0.9, 1.3);
        var ram = ramp(t, 1.3, 1.95);
        var back = ramp(t, 1.95, 2.6);

        var tilt = lower * (1 - back);
        setEuler(pose, 'weapon', AIM_X + tilt * 0.85, AIM_Y + tilt * 0.3, 0);
        addEuler(pose, 'chest', -0.05 * tilt, 0.05 * tilt, 0);
        addEuler(pose, 'head', tilt * 0.2, 0, 0);

        // The right hand leaves the stock and digs the cartridge out of the
        // pouch worn on the left hip, then goes back to the stock.
        var atPouch = ramp(t, 0.45, 0.8) * (1 - ramp(t, 1.15, 1.5));
        setHandMode(pose, 'R', 1 - atPouch);
        if (atPouch > 0) {
          var ik = pose.rig.ik;
          setHand(pose, 'R', ik.pouch.x, ik.pouch.y - 0.05 * grab, ik.pouch.z);
        }

        // The left hand takes the ramrod and pushes the charge home.
        var push = ram * (1 - back);
        setHandMode(pose, 'L', 1 - push * 0.9);
        if (push > 0) {
          var ik2 = pose.rig.ik;
          setHand(pose, 'L', ik2.barrel.x, ik2.barrel.y - 0.03, ik2.barrel.z + push * 0.12);
        }
      },
    };
  };

  // Bayonet charge.
  Clips.melee = function () {
    return {
      name: 'melee',
      duration: 0.7,
      loop: false,
      fn: function (t, pose) {
        var wind = ramp(t, 0, 0.22);
        var thrust = ramp(t, 0.22, 0.38);
        var back = ramp(t, 0.38, 0.7);
        var push = thrust * (1 - back);
        setEuler(pose, 'weapon', AIM_X + wind * 0.5 - push * 0.35, AIM_Y - wind * 0.1, 0);
        setEuler(pose, 'chest', 0, 0.14 + wind * 0.12 - push * 0.1, 0);
        addEuler(pose, 'chest', -push * 0.18, 0, 0);
        addEuler(pose, 'head', wind * 0.08, 0, 0);
        offsetPos(pose, 'hips', 0, 0, push * 0.12);
        // The left hand slides forward on the barrel to drive the thrust.
        var ik = pose.rig.ik;
        setHandMode(pose, 'L', 1 - push * 0.85);
        if (push > 0) {
          setHand(pose, 'L', ik.barrel.x, ik.barrel.y, ik.barrel.z + push * 0.14);
        }
      },
    };
  };

  // Flinch when a round lands.
  Clips.hit = function () {
    return {
      name: 'hit',
      duration: 0.36,
      loop: false,
      additive: true,
      fn: function (t, pose) {
        var k = Math.max(0, 1 - t / 0.12);
        addEuler(pose, 'chest', 0.14 * k, 0.1 * k, 0.06 * k);
        addEuler(pose, 'head', 0.2 * k, -0.12 * k, 0);
        addEuler(pose, 'weapon', -0.12 * k, 0.05 * k, 0);
      },
    };
  };

  // The knees go and the body folds. The physics ragdoll takes the body the
  // rest of the way down, so this clip only covers the first instant.
  Clips.death = function () {
    return {
      name: 'death',
      duration: 0.45,
      loop: false,
      fn: function (t, pose) {
        var buckle = ramp(t, 0, 0.22);
        var slump = ramp(t, 0.08, 0.45);
        setEuler(pose, 'thighR', -0.55 * buckle, 0, 0.08 * buckle);
        setEuler(pose, 'thighL', -0.42 * buckle, 0, -0.1 * buckle);
        setEuler(pose, 'shinR', 0.95 * buckle, 0, 0);
        setEuler(pose, 'shinL', 1.05 * buckle, 0, 0);
        offsetPos(pose, 'hips', 0, -0.16 * buckle, 0.04 * buckle);
        setEuler(pose, 'hips', 0.12 * buckle, 0.1 * buckle, 0);
        setEuler(pose, 'spine', -0.2 * slump, 0, 0.06 * slump);
        setEuler(pose, 'chest', -0.16 * slump, 0.06 * slump, 0);
        setEuler(pose, 'head', -0.22 * slump, 0.12 * slump, 0.08 * slump);
        // The musket slips from the hands.
        setEuler(pose, 'weapon', 0.5 * slump, 0.2 * slump, 0);
        offsetPos(pose, 'weapon', 0, -0.18 * slump, 0.04 * slump);
        setHandMode(pose, 'R', 1 - slump);
        setHandMode(pose, 'L', 1 - slump);
        if (slump > 0) {
          setHand(pose, 'R', 0.16, -0.46, 0.06);
          setHand(pose, 'L', -0.14, -0.48, 0.1);
        }
      },
    };
  };

  // Final resting pose of a corpse: arms hanging, musket on the ground.
  Clips.limp = function () {
    return {
      name: 'limp',
      duration: 1,
      loop: false,
      fn: function (t, pose) {
        var drop = ramp(t, 0, 0.3);
        setEuler(pose, 'thighR', -0.18 * drop, 0, 0.05 * drop);
        setEuler(pose, 'thighL', -0.12 * drop, 0, -0.07 * drop);
        setEuler(pose, 'shinR', 0.3 * drop, 0, 0);
        setEuler(pose, 'shinL', 0.36 * drop, 0, 0);
        offsetPos(pose, 'hips', 0, -0.1 * drop, 0);
        setEuler(pose, 'spine', -0.1 * drop, 0.04 * drop, 0);
        setEuler(pose, 'chest', -0.08 * drop, 0.04 * drop, 0);
        setEuler(pose, 'head', -0.12 * drop, 0.08 * drop, 0.05 * drop);
        setEuler(pose, 'weapon', 1.45 * drop, 0.25 * drop, 0);
        offsetPos(pose, 'weapon', 0.04 * drop, -0.52 * drop, 0.06 * drop);
        setHandMode(pose, 'R', 0);
        setHandMode(pose, 'L', 0);
        setHand(pose, 'R', 0.26, -0.54, 0.05);
        setHand(pose, 'L', -0.26, -0.54, 0.09);
      },
    };
  };

  // Artillery crew at its gun: musket held low across the body.
  Clips.kneel = function () {
    return {
      name: 'kneel',
      duration: 3.2,
      loop: true,
      fn: function (t, pose) {
        var b = Math.sin(t * 1.6);
        setEuler(pose, 'thighR', -1.35, 0, 0.22);
        setEuler(pose, 'thighL', -1.2, 0, -0.26);
        setEuler(pose, 'shinR', 1.9, 0, 0);
        setEuler(pose, 'shinL', 1.7, 0, 0);
        setEuler(pose, 'footR', 0.35, 0, 0);
        setEuler(pose, 'footL', 0.35, 0, 0);
        offsetPos(pose, 'hips', 0, -0.52, -0.06);
        setEuler(pose, 'hips', 0.24, 0.1, 0);
        setEuler(pose, 'chest', 0.22, 0, 0);
        addEuler(pose, 'chest', 0.02 * b, 0, 0);
        setEuler(pose, 'head', -0.18, 0, 0);
        setEuler(pose, 'weapon', 0.55 + b * 0.01, 0.55, 0);
      },
    };
  };

  // --- First person viewmodel clips ---------------------------------------
  // The viewmodel rig lives in camera space: it is scaled down and offset so
  // the hands sit where the weapon is expected.
  function vmWeapon(pose, x, y, z) {
    setEuler(pose, 'weapon', x, y, z);
  }

  Clips.vmIdle = function () {
    return {
      name: 'vmIdle',
      duration: 4,
      loop: true,
      fn: function (t, pose) {
        var b = Math.sin(t * 1.5);
        // The musket rests angled across the lower right of the view: the
        // barrel points up and to the left, the stock sits near the camera.
        vmWeapon(pose, 0.12 + b * 0.012, 0.95, 0.2);
        addEuler(pose, 'chest', b * 0.01, 0, 0);
      },
    };
  };

  Clips.vmFire = function () {
    return {
      name: 'vmFire',
      duration: 0.35,
      loop: false,
      additive: true,
      fn: function (t, pose) {
        var k = Math.max(0, 1 - t / 0.08);
        addEuler(pose, 'chest', -0.12 * k, 0.06 * k, 0);
        addEuler(pose, 'weapon', 0.5 * k, 0, 0);
      },
    };
  };

  Clips.vmReload = function () {
    return {
      name: 'vmReload',
      duration: 2.6,
      loop: false,
      fn: function (t, pose) {
        var lower = ramp(t, 0.05, 0.55);
        var grab = ramp(t, 0.55, 0.95);
        var raise = ramp(t, 0.95, 1.35);
        var ram = ramp(t, 1.35, 2.05);
        var back = ramp(t, 2.05, 2.6);
        var tilt = lower * (1 - back);
        var push = ram * (1 - back);
        vmWeapon(pose, 0.12 + tilt * 0.8, 0.95 + tilt * 0.25, 0.2);

        var pouch = ramp(t, 0.45, 0.8) * (1 - ramp(t, 1.25, 1.7));
        setHandMode(pose, 'R', 1 - pouch);
        if (pouch > 0) {
          var ik = pose.rig.ik;
          setHand(pose, 'R', ik.pouch.x, ik.pouch.y - 0.04 * grab, ik.pouch.z);
        }
        setHandMode(pose, 'L', 1 - push * 0.9);
        if (push > 0) {
          var ik2 = pose.rig.ik;
          setHand(pose, 'L', ik2.barrel.x, ik2.barrel.y - 0.03, ik2.barrel.z + push * 0.1);
        }
      },
    };
  };

  Clips.vmMelee = function () {
    return {
      name: 'vmMelee',
      duration: 0.65,
      loop: false,
      fn: function (t, pose) {
        var wind = ramp(t, 0, 0.2);
        var thrust = ramp(t, 0.2, 0.36);
        var back = ramp(t, 0.36, 0.65);
        var push = thrust * (1 - back);
        vmWeapon(pose, 0.12 + wind * 0.4 - push * 0.3, 0.95 - wind * 0.35, 0.2);
        addEuler(pose, 'chest', -push * 0.14, 0, 0);
      },
    };
  };

  Clips.vmSprint = function () {
    return {
      name: 'vmSprint',
      duration: 1.0,
      loop: true,
      fn: function (t, pose) {
        var s = Math.sin(t * Math.PI * 2);
        vmWeapon(pose, 0.55, 0.6, 0.15);
        addEuler(pose, 'chest', 0.05, 0, 0);
        offsetPos(pose, 'chest', 0, s * 0.02, 0);
      },
    };
  };

  Clips.vmAim = function () {
    return {
      name: 'vmAim',
      duration: 3,
      loop: true,
      fn: function (t, pose) {
        var b = Math.sin(t * 1.7);
        vmWeapon(pose, 0.10 + b * 0.006, 0.35, 0.1);
        // Shouldering the musket brings it to the middle of the view; the
        // chest slides sideways only, so the sleeves stay out of the frame.
        offsetPos(pose, 'chest', -0.30, -0.02, 0);
        addEuler(pose, 'chest', 0.012 * b, 0, 0);
      },
    };
  };

  return {
    createPose: createPose,
    resetPose: resetPose,
    setEuler: setEuler,
    addEuler: addEuler,
    setQuat: setQuat,
    offsetPos: offsetPos,
    setHand: setHand,
    setHandMode: setHandMode,
    sample: sample,
    blend: blend,
    applyPose: applyPose,
    applyAdditive: applyAdditive,
    solveArms: solveArms,
    solveArm: solveArm,
    Animator: Animator,
    Clips: Clips,
    ramp: ramp,
    smooth: smooth,
  };
})();

if (typeof module !== 'undefined') module.exports = RigAnim;

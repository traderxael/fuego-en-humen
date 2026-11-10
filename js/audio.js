// Procedural audio: Web Audio API only, no assets. Browser global `sfx`;
// also guarded for Node tooling (CommonJS export, never touches AudioContext
// at import time).
//
// Autoplay policy: the AudioContext is created/resumed only from a user
// gesture via sfx.unlock() (wired to the menu "Jugar" click and pointer
// lock). Until then — or if Web Audio is unavailable — every sfx call is a
// silent no-op, so headless/CDP runs stay clean.
//
// Levels are kept conservative and routed through one master GainNode (~0.5).

var sfx = (function () {
  var MASTER_LEVEL = 0.5;

  // null until unlock() runs inside a user gesture.
  var ctx = null;
  var master = null;
  var unlocked = false;
  var seaStarted = false;

  // Camera pose for cheap spatialization; safe to set before unlock.
  var listener = { x: 0, y: 1.7, z: 24, yaw: 0 };
  function setListener(pos, yaw) {
    if (!pos) return;
    if (Number.isFinite(pos.x)) listener.x = pos.x;
    if (Number.isFinite(pos.y)) listener.y = pos.y;
    if (Number.isFinite(pos.z)) listener.z = pos.z;
    if (Number.isFinite(yaw)) listener.yaw = yaw;
  }

  function audioCtor() {
    if (typeof window === 'undefined') return null;
    return window.AudioContext || window.webkitAudioContext || null;
  }

  // Create (once) and resume the context. Must be called from a gesture.
  function unlock() {
    if (!ctx) {
      var AC = audioCtor();
      if (!AC) return null;
      try {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = MASTER_LEVEL;
        master.connect(ctx.destination);
      } catch (e) {
        ctx = null;
        master = null;
        return null;
      }
    }
    unlocked = true;
    if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
      try {
        var p = ctx.resume();
        if (p && typeof p.catch === 'function') p.catch(function () { /* still suspended; sounds stay silent */ });
      } catch (e) { /* ignore */ }
    }
    return ctx;
  }

  // For sfx calls: returns a running context, or null (silent no-op).
  function ready() {
    if (!unlocked || !ctx) return null;
    if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
      try {
        var p = ctx.resume();
        if (p && typeof p.catch === 'function') p.catch(function () { /* still suspended; sounds stay silent */ });
      } catch (e) { /* ignore */ }
    }
    if (ctx.state !== 'running') return null; // still not running -> silent no-op, never schedule late
    return ctx;
  }

  function noiseBuffer(c, seconds) {
    var len = Math.max(1, Math.floor(c.sampleRate * (seconds || 1)));
    var buf = c.createBuffer(1, len, c.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  // Simple attack/exp-decay gain envelope. Returns the gain node.
  function envelope(c, dest, t0, peak, attack, decay) {
    var g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0001), t0 + Math.max(attack, 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(attack, 0.005) + Math.max(decay, 0.01));
    g.connect(dest || master);
    return g;
  }

  function playNoise(c, t0, opts) {
    var src = c.createBufferSource();
    src.buffer = noiseBuffer(c, opts.seconds || 0.3);
    var filter = c.createBiquadFilter();
    filter.type = opts.filterType || 'lowpass';
    filter.frequency.setValueAtTime(opts.freq || 800, t0);
    if (opts.freqEnd) filter.frequency.exponentialRampToValueAtTime(opts.freqEnd, t0 + (opts.seconds || 0.3));
    filter.Q.value = opts.q || 0.8;
    var g = envelope(c, opts.dest || master, t0, opts.peak || 0.5, opts.attack || 0.005, opts.decay || opts.seconds || 0.2);
    src.connect(filter);
    filter.connect(g);
    src.start(t0);
    src.stop(t0 + (opts.seconds || 0.3) + 0.05);
  }

  function playTone(c, t0, opts) {
    var osc = c.createOscillator();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(opts.freq || 440, t0);
    if (opts.freqEnd) osc.frequency.exponentialRampToValueAtTime(opts.freqEnd, t0 + (opts.glide || opts.seconds || 0.2));
    if (opts.detune) osc.detune.value = opts.detune;
    var g = envelope(c, opts.dest || master, t0, opts.peak || 0.3, opts.attack || 0.01, opts.decay || opts.seconds || 0.2);
    osc.connect(g);
    osc.start(t0);
    osc.stop(t0 + (opts.seconds || 0.2) + 0.1);
  }

  // One StereoPanner per positional one-shot; distance gain is folded into
  // each voice's peak. Returns null when the source is too far to be heard,
  // so callers skip node creation entirely. Falls back to centred master
  // when no position is given or StereoPanner is unavailable.
  function spatialDest(c, pos, maxDist) {
    if (!pos || typeof SpatialLogic === 'undefined') return { dest: master, gain: 1 };
    var g = SpatialLogic.spatialGains(listener, pos, maxDist);
    if (g.gain < 0.01) return null;
    var dest = master;
    if (typeof c.createStereoPanner === 'function') {
      var p = c.createStereoPanner();
      p.pan.value = g.pan;
      p.connect(master);
      dest = p;
    }
    return { dest: dest, gain: g.gain };
  }

  // --- Public API ---

  // Musket: short noise burst + lowpass thump.
  function shot() {
    var c = ready(); if (!c) return;
    try {
      var t = c.currentTime;
      playNoise(c, t, { seconds: 0.16, filterType: 'lowpass', freq: 1100, freqEnd: 220, peak: 0.65, attack: 0.004, decay: 0.15, q: 0.6 });
      playTone(c, t, { type: 'square', freq: 170, freqEnd: 65, glide: 0.12, seconds: 0.13, peak: 0.28, attack: 0.003, decay: 0.12 });
    } catch (e) { /* stay silent */ }
  }

  // Enemy fire: same shape, much softer. Optional pos spatializes it.
  function enemyShot(pos) {
    var c = ready(); if (!c) return;
    try {
      var sp = spatialDest(c, pos, 60); if (!sp) return;
      var t = c.currentTime;
      playNoise(c, t, { seconds: 0.13, filterType: 'lowpass', freq: 750, freqEnd: 180, peak: 0.2 * sp.gain, attack: 0.004, decay: 0.12, q: 0.6, dest: sp.dest });
      playTone(c, t, { type: 'square', freq: 130, freqEnd: 55, glide: 0.1, seconds: 0.1, peak: 0.09 * sp.gain, attack: 0.003, decay: 0.1, dest: sp.dest });
    } catch (e) { /* stay silent */ }
  }

  // Sable: metallic swish — bandpassed noise with a fast downward sweep.
  function swish() {
    var c = ready(); if (!c) return;
    try {
      var t = c.currentTime;
      playNoise(c, t, { seconds: 0.22, filterType: 'bandpass', freq: 3400, freqEnd: 650, peak: 0.35, attack: 0.02, decay: 0.2, q: 2.2 });
      playTone(c, t, { type: 'triangle', freq: 1900, freqEnd: 700, glide: 0.18, seconds: 0.18, peak: 0.07, attack: 0.02, decay: 0.16 });
    } catch (e) { /* stay silent */ }
  }

  // Reload: the full ramrod sequence scheduled at once (no timers), scaled
  // to the weapon's actual reloadTime: click, ram swish, seat thump, clicks.
  function reload(reloadTime) {
    var c = ready(); if (!c) return;
    try {
      var t = c.currentTime;
      var total = Number.isFinite(reloadTime) && reloadTime > 0
        ? reloadTime
        : ((typeof WEAPONS !== 'undefined' && WEAPONS.mosquete && WEAPONS.mosquete.reloadTime) || 2.6);
      var k = total / 2.6;
      playTone(c, t, { type: 'square', freq: 1250, seconds: 0.03, peak: 0.16, attack: 0.002, decay: 0.03 });
      playNoise(c, t + 0.45 * k, { seconds: 0.25, filterType: 'bandpass', freq: 1800, freqEnd: 600, peak: 0.1, attack: 0.03, decay: 0.22, q: 1.2 });
      playTone(c, t + 1.1 * k, { type: 'sine', freq: 300, freqEnd: 120, glide: 0.1, seconds: 0.12, peak: 0.14, attack: 0.004, decay: 0.11 });
      playTone(c, t + 1.9 * k, { type: 'square', freq: 900, seconds: 0.03, peak: 0.14, attack: 0.002, decay: 0.03 });
      playTone(c, t + 2.45 * k, { type: 'square', freq: 1400, seconds: 0.04, peak: 0.16, attack: 0.002, decay: 0.04 });
    } catch (e) { /* stay silent */ }
  }

  // Hit: low thud (sine drop).
  function hit() {
    var c = ready(); if (!c) return;
    try {
      var t = c.currentTime;
      playTone(c, t, { type: 'sine', freq: 165, freqEnd: 52, glide: 0.16, seconds: 0.2, peak: 0.5, attack: 0.004, decay: 0.19 });
      playNoise(c, t, { seconds: 0.05, filterType: 'lowpass', freq: 500, peak: 0.12, attack: 0.003, decay: 0.05 });
    } catch (e) { /* stay silent */ }
  }

  // Wave horn: low sawtooth swell, slow attack and decay (call at wave start).
  function waveHorn() {
    var c = ready(); if (!c) return;
    try {
      var t = c.currentTime;
      var dur = 2.3;
      var g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.34, t + 0.55);
      g.gain.setValueAtTime(0.34, t + dur - 0.9);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      var filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      filter.Q.value = 1.1;
      [73.42, 73.42 * 1.006].forEach(function (f) { // D2, slightly detuned pair
        var o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.connect(filter);
        o.start(t);
        o.stop(t + dur + 0.05);
      });
      filter.connect(g);
      g.connect(master);
    } catch (e) { /* stay silent */ }
  }

  // Fort / enemy cannon: deep boom with a long low rumble. Optional pos.
  function cannon(pos) {
    var c = ready(); if (!c) return;
    try {
      var sp = spatialDest(c, pos, 120); if (!sp) return;
      var t = c.currentTime;
      playNoise(c, t, { seconds: 0.45, filterType: 'lowpass', freq: 420, freqEnd: 70, peak: 0.75 * sp.gain, attack: 0.004, decay: 0.4, q: 0.8, dest: sp.dest });
      playTone(c, t, { type: 'sine', freq: 68, freqEnd: 26, glide: 0.5, seconds: 0.55, peak: 0.5 * sp.gain, attack: 0.006, decay: 0.5, dest: sp.dest });
      playTone(c, t, { type: 'square', freq: 120, freqEnd: 45, glide: 0.2, seconds: 0.22, peak: 0.12 * sp.gain, attack: 0.004, decay: 0.2, dest: sp.dest });
    } catch (e) { /* stay silent */ }
  }

  // Cannonball impact: bigger, dirtier rumble than the shot. Optional pos.
  function explosion(pos) {
    var c = ready(); if (!c) return;
    try {
      var sp = spatialDest(c, pos, 90); if (!sp) return;
      var t = c.currentTime;
      playNoise(c, t, { seconds: 0.9, filterType: 'lowpass', freq: 260, freqEnd: 45, peak: 0.65 * sp.gain, attack: 0.005, decay: 0.85, q: 0.7, dest: sp.dest });
      playTone(c, t, { type: 'sine', freq: 52, freqEnd: 22, glide: 0.7, seconds: 0.8, peak: 0.4 * sp.gain, attack: 0.004, decay: 0.75, dest: sp.dest });
    } catch (e) { /* stay silent */ }
  }

  // Kill confirmation: distinct rising-then-falling tick, never the hit thud.
  function kill() {
    var c = ready(); if (!c) return;
    try {
      var t = c.currentTime;
      playTone(c, t, { type: 'triangle', freq: 740, freqEnd: 370, glide: 0.12, seconds: 0.13, peak: 0.22, attack: 0.003, decay: 0.12 });
      playNoise(c, t, { seconds: 0.04, filterType: 'highpass', freq: 2500, peak: 0.08, attack: 0.002, decay: 0.04 });
    } catch (e) { /* stay silent */ }
  }

  // Low-HP heartbeat: two soft thumps; main.js owns the cadence.
  function heartbeat() {
    var c = ready(); if (!c) return;
    try {
      var t = c.currentTime;
      playTone(c, t, { type: 'sine', freq: 55, freqEnd: 40, glide: 0.1, seconds: 0.12, peak: 0.3, attack: 0.004, decay: 0.11 });
      playTone(c, t + 0.16, { type: 'sine', freq: 50, freqEnd: 38, glide: 0.09, seconds: 0.1, peak: 0.2, attack: 0.004, decay: 0.09 });
    } catch (e) { /* stay silent */ }
  }

  // War drums: one synthesized 4-beat loop (72 BPM), very quiet under the
  // battle. One BufferSource at a time; stop ramps down to avoid clicks.
  var drumsBuffer = null;
  var drumsSrc = null;
  var drumsGain = null;

  function makeDrumsBuffer(c) {
    var beat = 60 / 72;
    var dur = beat * 4;
    var buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
    var d = buf.getChannelData(0);
    function thump(at, accent) {
      var start = Math.floor(at * c.sampleRate);
      var len = Math.floor(0.4 * c.sampleRate);
      for (var i = 0; i < len && start + i < d.length; i++) {
        var tt = i / c.sampleRate;
        var env = Math.exp(-tt * 9);
        var phase = 2 * Math.PI * (58 * tt + 20 * tt * Math.exp(-tt * 12));
        d[start + i] += Math.sin(phase) * env * 0.9 * accent;
        if (tt < 0.02) d[start + i] += (Math.random() * 2 - 1) * Math.exp(-tt * 60) * 0.25 * accent;
      }
    }
    for (var b = 0; b < 4; b++) {
      thump(b * beat, b === 0 ? 1.0 : 0.75);
      thump(b * beat + beat * 0.5, 0.3);
    }
    return buf;
  }

  function startWarDrums() {
    var c = ready(); if (!c) return;
    try {
      if (drumsSrc) return;
      if (!drumsBuffer) drumsBuffer = makeDrumsBuffer(c);
      drumsSrc = c.createBufferSource();
      drumsSrc.buffer = drumsBuffer;
      drumsSrc.loop = true;
      var filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 300;
      drumsGain = c.createGain();
      drumsGain.gain.value = 0.05;
      drumsSrc.connect(filter);
      filter.connect(drumsGain);
      drumsGain.connect(master);
      drumsSrc.start();
    } catch (e) {
      drumsSrc = null;
      drumsGain = null;
    }
  }

  function stopWarDrums() {
    if (!drumsSrc || !ctx) return;
    try {
      var src = drumsSrc;
      var g = drumsGain;
      drumsSrc = null;
      drumsGain = null;
      var t = ctx.currentTime;
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0.0001, t + 0.15);
      src.stop(t + 0.2);
    } catch (e) { /* already stopped */ }
  }

  // Footstep / landing: short filtered thud.
  function step() {
    var c = ready(); if (!c) return;
    try {
      var t = c.currentTime;
      playNoise(c, t, { seconds: 0.07, filterType: 'lowpass', freq: 700, freqEnd: 240, peak: 0.075, attack: 0.003, decay: 0.07, q: 0.8 });
      playTone(c, t, { type: 'sine', freq: 92, freqEnd: 58, glide: 0.06, seconds: 0.07, peak: 0.05, attack: 0.002, decay: 0.06 });
    } catch (e) { /* stay silent */ }
  }

  // Victory: major triad arpeggio (C4 E4 G4 C5).
  function victory() {
    var c = ready(); if (!c) return;
    try {
      var t = c.currentTime;
      [261.63, 329.63, 392.0, 523.25].forEach(function (f, i) {
        playTone(c, t + i * 0.17, { type: 'triangle', freq: f, seconds: 0.34, peak: 0.3, attack: 0.01, decay: 0.33 });
      });
    } catch (e) { /* stay silent */ }
  }

  // Defeat: minor triad descent (A3 F3 D3).
  function defeat() {
    var c = ready(); if (!c) return;
    try {
      var t = c.currentTime;
      [220.0, 174.61, 146.83].forEach(function (f, i) {
        playTone(c, t + i * 0.32, { type: 'sawtooth', freq: f, seconds: 0.42, peak: 0.22, attack: 0.02, decay: 0.4 });
      });
    } catch (e) { /* stay silent */ }
  }

  // Ambient sea: looped filtered noise with a slow LFO on the gain.
  // Quiet (~ -20 dB under the master). Starts on first user gesture.
  function ambientSea() {
    var c = unlock();
    if (!c) return;
    if (seaStarted) return;
    try {
      seaStarted = true;
      var t = c.currentTime;
      var src = c.createBufferSource();
      src.buffer = noiseBuffer(c, 4);
      src.loop = true;
      var filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 480;
      filter.Q.value = 0.6;
      var seaGain = c.createGain();
      seaGain.gain.value = 0.045; // ~ -27 dB under master; audible but quiet
      var lfo = c.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.09; // slow swell, ~11 s period
      var lfoGain = c.createGain();
      lfoGain.gain.value = 0.025;
      lfo.connect(lfoGain);
      lfoGain.connect(seaGain.gain);
      src.connect(filter);
      filter.connect(seaGain);
      seaGain.connect(master);
      src.start(t);
      lfo.start(t);
    } catch (e) {
      seaStarted = false;
    }
  }

  return {
    unlock: unlock,
    setListener: setListener,
    shot: shot,
    enemyShot: enemyShot,
    swish: swish,
    reload: reload,
    hit: hit,
    kill: kill,
    heartbeat: heartbeat,
    startWarDrums: startWarDrums,
    stopWarDrums: stopWarDrums,
    waveHorn: waveHorn,
    victory: victory,
    defeat: defeat,
    ambientSea: ambientSea,
    cannon: cannon,
    explosion: explosion,
    step: step,
  };
})();

if (typeof module !== 'undefined') module.exports = { sfx: sfx };

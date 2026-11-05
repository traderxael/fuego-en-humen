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
    var g = envelope(c, master, t0, opts.peak || 0.5, opts.attack || 0.005, opts.decay || opts.seconds || 0.2);
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
    var g = envelope(c, master, t0, opts.peak || 0.3, opts.attack || 0.01, opts.decay || opts.seconds || 0.2);
    osc.connect(g);
    osc.start(t0);
    osc.stop(t0 + (opts.seconds || 0.2) + 0.1);
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

  // Enemy fire: same shape, much softer.
  function enemyShot() {
    var c = ready(); if (!c) return;
    try {
      var t = c.currentTime;
      playNoise(c, t, { seconds: 0.13, filterType: 'lowpass', freq: 750, freqEnd: 180, peak: 0.2, attack: 0.004, decay: 0.12, q: 0.6 });
      playTone(c, t, { type: 'square', freq: 130, freqEnd: 55, glide: 0.1, seconds: 0.1, peak: 0.09, attack: 0.003, decay: 0.1 });
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

  // Reload: two clicks ~120 ms apart.
  function reload() {
    var c = ready(); if (!c) return;
    try {
      var t = c.currentTime;
      [0, 0.12].forEach(function (offset, i) {
        playTone(c, t + offset, { type: 'square', freq: i === 0 ? 1250 : 830, seconds: 0.03, peak: 0.16, attack: 0.002, decay: 0.03 });
      });
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
    shot: shot,
    enemyShot: enemyShot,
    swish: swish,
    reload: reload,
    hit: hit,
    waveHorn: waveHorn,
    victory: victory,
    defeat: defeat,
    ambientSea: ambientSea,
  };
})();

if (typeof module !== 'undefined') module.exports = { sfx: sfx };

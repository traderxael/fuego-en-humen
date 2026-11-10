// Voice: narration with Web Speech API (no assets, offline).
// Browser global `Voice`; also guarded for Node tooling.
//
// Narrator is Maestro Xu (see js/dialogues.js). All calls are silent no-ops
// until the user has interacted (the "Jugar" click unlocks speechSynthesis)
// or when the browser has no voices. Toggling is persisted in localStorage
// and is independent of the music toggle (key M).

var Voice = (function () {
  var enabled = true;
  var lastText = null;
  try {
    if (typeof localStorage !== 'undefined') {
      enabled = localStorage.getItem('fuego-voice-enabled') !== '0';
    }
  } catch (e) {}

  function synth() {
    if (typeof window === 'undefined') return null;
    return window.speechSynthesis || null;
  }

  function pickVoice() {
    var s = synth();
    if (!s || typeof s.getVoices !== 'function') return null;
    var voices = s.getVoices() || [];
    // Prefer Spanish voices, in order of closeness to a narrator tone.
    var prefs = ['es-ES', 'es-MX', 'es-US', 'es'];
    for (var i = 0; i < prefs.length; i++) {
      for (var j = 0; j < voices.length; j++) {
        if (voices[j] && voices[j].lang && voices[j].lang.toLowerCase().indexOf(prefs[i].toLowerCase()) === 0) {
          return voices[j];
        }
      }
    }
    // Any voice whose lang starts with "es"
    for (var k = 0; k < voices.length; k++) {
      if (voices[k] && voices[k].lang && voices[k].lang.toLowerCase().indexOf('es') === 0) return voices[k];
    }
    return null;
  }

  function speak(text, opts) {
    if (!enabled || !text) return false;
    var s = synth();
    if (!s || typeof s.speak !== 'function') return false;
    if (typeof window === 'undefined' || typeof window.SpeechSynthesisUtterance !== 'function') return false;
    try {
      // Avoid stacking narration: a new line interrupts the previous one.
      if (opts && opts.interrupt !== false && typeof s.cancel === 'function') s.cancel();
      var u = new window.SpeechSynthesisUtterance(String(text));
      var cfg = (opts && opts.narratorTts) || { lang: 'es-ES', rate: 0.92, pitch: 0.85, volume: 1.0 };
      u.lang = cfg.lang || 'es-ES';
      u.rate = typeof cfg.rate === 'number' ? cfg.rate : 0.92;
      u.pitch = typeof cfg.pitch === 'number' ? cfg.pitch : 0.85;
      u.volume = typeof cfg.volume === 'number' ? cfg.volume : 1.0;
      var v = pickVoice();
      if (v) u.voice = v;
      s.speak(u);
      lastText = String(text);
      return true;
    } catch (e) {
      return false;
    }
  }

  function stop() {
    var s = synth();
    if (!s || typeof s.cancel !== 'function') return false;
    try { s.cancel(); return true; } catch (e) { return false; }
  }

  function isEnabled() { return enabled; }

  function setEnabled(on) {
    enabled = on === true;
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem('fuego-voice-enabled', enabled ? '1' : '0');
    } catch (e) {}
    if (!enabled) stop();
    return enabled;
  }

  function toggle() { return setEnabled(!enabled); }

  return {
    speak: speak,
    stop: stop,
    toggle: toggle,
    setEnabled: setEnabled,
    isEnabled: isEnabled,
    lastText: function () { return lastText; },
  };
})();

if (typeof module !== 'undefined') module.exports = { Voice: Voice };

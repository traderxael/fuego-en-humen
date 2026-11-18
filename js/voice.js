// Voice: neural Spanish MP3 narration (assets/audio/voice/*.mp3) with Web Speech
// API fallback and automatic background music ducking.
// Browser global `Voice`; also guarded for Node tooling.

var Voice = (function () {
  var AUDIO_CLIPS = {
    briefing: 'assets/audio/voice/briefing.mp3',
    'cine-1839-0': 'assets/audio/voice/cine-1839-0.mp3',
    'cine-1839-1': 'assets/audio/voice/cine-1839-1.mp3',
    'cine-1839-2': 'assets/audio/voice/cine-1839-2.mp3',
    'cine-1839-3': 'assets/audio/voice/cine-1839-3.mp3',
    'cine-squadron-0': 'assets/audio/voice/cine-squadron-0.mp3',
    'cine-squadron-1': 'assets/audio/voice/cine-squadron-1.mp3',
    'cine-assault-0': 'assets/audio/voice/cine-assault-0.mp3',
    'cine-assault-1': 'assets/audio/voice/cine-assault-1.mp3',
    'cine-assault-2': 'assets/audio/voice/cine-assault-2.mp3',
    'cine-fall-0': 'assets/audio/voice/cine-fall-0.mp3',
    'cine-fall-1': 'assets/audio/voice/cine-fall-1.mp3',
    'cine-fall-2': 'assets/audio/voice/cine-fall-2.mp3',
    'wave-1': 'assets/audio/voice/wave-1.mp3',
    'wave-2': 'assets/audio/voice/wave-2.mp3',
    'wave-3': 'assets/audio/voice/wave-3.mp3',
    'wave-4': 'assets/audio/voice/wave-4.mp3',
    'wave-5': 'assets/audio/voice/wave-5.mp3',
    'wave-6': 'assets/audio/voice/wave-6.mp3',
    'wave-7': 'assets/audio/voice/wave-7.mp3',
    'wave-8': 'assets/audio/voice/wave-8.mp3',
    'wave-9': 'assets/audio/voice/wave-9.mp3',
    'wave-10': 'assets/audio/voice/wave-10.mp3',
    'beat-landing': 'assets/audio/voice/beat-landing.mp3',
    'beat-artillery': 'assets/audio/voice/beat-artillery.mp3',
    'beat-officer': 'assets/audio/voice/beat-officer.mp3',
    'beat-assault': 'assets/audio/voice/beat-assault.mp3',
    'beat-guan': 'assets/audio/voice/beat-guan.mp3',
    'radio-lowfort': 'assets/audio/voice/radio-lowfort.mp3',
    'end-victory': 'assets/audio/voice/end-victory.mp3',
    'end-soldier': 'assets/audio/voice/end-soldier.mp3',
    'end-fort': 'assets/audio/voice/end-fort.mp3',
  };

  var enabled = true;
  var lastText = null;
  var lastClip = null;
  var activeAudio = null;
  var activeUtterance = null;
  var queuedItem = null;
  var isAudioPlaying = false;
  var playToken = 0;

  try {
    if (typeof localStorage !== 'undefined') {
      enabled = localStorage.getItem('fuego-voice-enabled') !== '0';
    }
  } catch (e) {}

  function duck(on) {
    try {
      if (typeof sfx !== 'undefined' && sfx && typeof sfx.duckMusic === 'function') {
        sfx.duckMusic(!!on);
      }
    } catch (e) {}
  }

  function synth() {
    if (typeof window === 'undefined') return null;
    return window.speechSynthesis || null;
  }

  function pickVoice() {
    var s = synth();
    if (!s || typeof s.getVoices !== 'function') return null;
    var voices = s.getVoices() || [];
    var prefs = ['es-ES', 'es-MX', 'es-AR', 'es-CO', 'es'];
    for (var i = 0; i < prefs.length; i++) {
      for (var j = 0; j < voices.length; j++) {
        if (voices[j] && voices[j].lang && voices[j].lang.toLowerCase().indexOf(prefs[i].toLowerCase()) === 0) {
          return voices[j];
        }
      }
    }
    return null;
  }

  function unlock() {
    try {
      if (!activeAudio && typeof window !== 'undefined' && typeof window.Audio === 'function') {
        activeAudio = new window.Audio();
        activeAudio.preload = 'auto';
      }
      var s = synth();
      if (s && typeof s.getVoices === 'function') s.getVoices();
    } catch (e) {}
    return true;
  }

  function stopAudioOnly() {
    isAudioPlaying = false;
    if (!activeAudio) return;
    try {
      activeAudio.onended = null;
      activeAudio.onerror = null;
      activeAudio.pause();
    } catch (e) {}
  }

  function speakSpeechSynthesis(text, opts) {
    if (!enabled || !text) return false;
    var s = synth();
    if (!s || typeof s.speak !== 'function') return false;
    if (typeof window === 'undefined' || typeof window.SpeechSynthesisUtterance !== 'function') return false;
    try {
      if ((!opts || opts.interrupt !== false) && (s.speaking || s.pending) && typeof s.cancel === 'function') {
        s.cancel();
      }
      var u = new window.SpeechSynthesisUtterance(String(text));
      var cfg = (opts && opts.narratorTts) || { lang: 'es-ES', rate: 0.92, pitch: 0.85, volume: 1.0 };
      u.lang = cfg.lang || 'es-ES';
      u.rate = typeof cfg.rate === 'number' ? cfg.rate : 0.92;
      u.pitch = typeof cfg.pitch === 'number' ? cfg.pitch : 0.85;
      u.volume = typeof cfg.volume === 'number' ? cfg.volume : 1.0;
      var v = pickVoice();
      if (v) u.voice = v;
      u.onstart = function () { duck(true); };
      u.onend = function () {
        if (activeUtterance === u) activeUtterance = null;
        duck(false);
      };
      u.onerror = function () {
        if (activeUtterance === u) activeUtterance = null;
        duck(false);
      };
      // Retain module reference so Chromium GC never cuts off speech mid-line.
      activeUtterance = u;
      s.speak(u);
      lastText = String(text);
      return true;
    } catch (e) {
      duck(false);
      return false;
    }
  }

  function playClip(key, fallbackText, opts) {
    if (!enabled) return false;
    var clipUrl = key && AUDIO_CLIPS[key];
    if (opts && opts.queue === true && isAudioPlaying) {
      queuedItem = { key: key, text: fallbackText, opts: opts };
      return true;
    }
    queuedItem = null;
    var token = ++playToken;

    if (clipUrl && typeof window !== 'undefined' && typeof window.Audio === 'function') {
      stopAudioOnly();
      var s = synth();
      if (s && (s.speaking || s.pending) && typeof s.cancel === 'function') {
        try { s.cancel(); } catch (e) {}
      }
      activeUtterance = null;

      try {
        var audio = activeAudio || new window.Audio();
        activeAudio = audio;
        audio.src = clipUrl;
        audio.volume = (opts && opts.narratorTts && typeof opts.narratorTts.volume === 'number')
          ? opts.narratorTts.volume
          : 1.0;
        audio.currentTime = 0;

        audio.onended = function () {
          if (token !== playToken) return;
          isAudioPlaying = false;
          if (queuedItem) {
            var next = queuedItem;
            queuedItem = null;
            playClip(next.key, next.text, Object.assign({}, next.opts, { queue: false }));
            return;
          }
          duck(false);
        };
        audio.onerror = function () {
          if (token !== playToken) return;
          isAudioPlaying = false;
          queuedItem = null;
          duck(false);
          if (fallbackText) speakSpeechSynthesis(fallbackText, opts);
        };

        duck(true);
        isAudioPlaying = true;
        var p = audio.play();
        if (p && typeof p.catch === 'function') {
          p.catch(function () {
            if (token !== playToken) return;
            isAudioPlaying = false;
            queuedItem = null;
            duck(false);
            if (fallbackText) speakSpeechSynthesis(fallbackText, opts);
          });
        }
        lastClip = key;
        lastText = fallbackText ? String(fallbackText) : String(key);
        return true;
      } catch (e) {
        isAudioPlaying = false;
        duck(false);
      }
    }

    if (fallbackText) return speakSpeechSynthesis(fallbackText, opts);
    return false;
  }

  function speak(text, opts) {
    if (!enabled || !text) return false;
    if (opts && opts.clipKey && AUDIO_CLIPS[opts.clipKey]) {
      return playClip(opts.clipKey, text, opts);
    }
    return speakSpeechSynthesis(text, opts);
  }

  function stop() {
    playToken++;
    queuedItem = null;
    stopAudioOnly();
    activeUtterance = null;
    duck(false);
    var s = synth();
    if (!s || typeof s.cancel !== 'function') return false;
    try {
      if (s.speaking || s.pending) s.cancel();
      return true;
    } catch (e) {
      return false;
    }
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
    AUDIO_CLIPS: AUDIO_CLIPS,
    unlock: unlock,
    playClip: playClip,
    speak: speak,
    stop: stop,
    toggle: toggle,
    setEnabled: setEnabled,
    isEnabled: isEnabled,
    lastText: function () { return lastText; },
    lastClip: function () { return lastClip; },
  };
})();

if (typeof module !== 'undefined') module.exports = { Voice: Voice };

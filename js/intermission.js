// Between-wave intermission: plays the historical clip, freezes the game and
// waits for a click (needed to regain pointer lock). Never blocks on video:
// if the clip is missing or autoplay is refused, the card stays and the run
// continues. Browser global `Intermission`; factory is testable with a DOM stub.

var Intermission = (function () {
  function create(deps) {
    var options = deps || {};
    var state = options.state;
    var setPhase = options.setPhase;
    var hud = options.hud;
    var sfx = typeof options.sfx === 'function' ? options.sfx : function () {};
    var campaign = options.campaign || (typeof Campaign !== 'undefined' ? Campaign : null);
    var requestPointerLock = typeof options.requestPointerLock === 'function'
      ? options.requestPointerLock
      : function () {};
    var setTimer = options.setTimeout || (typeof setTimeout === 'function' ? setTimeout : null);
    var doc = options.document || (typeof document !== 'undefined' ? document : null);

    var active = false;
    var current = null;
    var bound = false;

    function el(id) {
      return doc && typeof doc.getElementById === 'function' ? doc.getElementById(id) : null;
    }

    function setText(id, text) {
      var node = el(id);
      if (node) node.textContent = text || '';
    }

    function showHint(text) {
      setText('intermission-hint', text);
    }

    function fallback() {
      var video = el('intermission-video');
      if (video) video.classList.add('hidden');
      var screen = el('intermission-screen');
      if (screen) screen.classList.add('fallback');
      showHint('Haz clic para continuar');
    }

    function bindClick() {
      if (bound) return;
      var screen = el('intermission-screen');
      if (!screen || typeof screen.addEventListener !== 'function') return;
      bound = true;
      screen.addEventListener('click', function () { finish(); });
    }

    function begin(opts) {
      var info = opts || {};
      if (active) return false;
      active = true;
      current = {
        wave: info.wave,
        final: !!info.final,
        onDone: info.onDone,
      };
      if (typeof setPhase === 'function') setPhase(state, 'intermission');
      if (hud && typeof hud.hide === 'function') hud.hide();
      sfx('stopWarDrums');
      if (doc && doc.pointerLockElement && typeof doc.exitPointerLock === 'function') {
        try { doc.exitPointerLock(); } catch (error) { /* lock is optional */ }
      }

      var card = null;
      if (campaign) {
        card = current.final ? campaign.finalCard() : campaign.card(info.wave);
      }
      var screen = el('intermission-screen');
      if (screen) {
        screen.classList.remove('hidden');
        screen.classList.remove('fallback');
      }
      if (card) {
        setText('intermission-kicker', card.kicker);
        setText('intermission-title', card.title);
        setText('intermission-body', card.body);
        setText('intermission-lesson', card.lesson);
      }
      showHint('');
      bindClick();

      var video = el('intermission-video');
      if (video && campaign) {
        video.classList.remove('hidden');
        video.src = campaign.clipPath(current.final ? campaign.FINAL_WAVE : info.wave);
        if (typeof video.load === 'function') video.load();
        var playing = video.play();
        if (playing && typeof playing.catch === 'function') playing.catch(fallback);
      } else {
        fallback();
      }

      if (setTimer) {
        setTimer(function () {
          var late = el('intermission-video');
          if (active && late && late.readyState < 2) fallback();
        }, 900);
      }
      return true;
    }

    function finish() {
      if (!active) return false;
      var snapshot = current;
      active = false;
      current = null;
      var screen = el('intermission-screen');
      if (screen) screen.classList.add('hidden');
      var video = el('intermission-video');
      if (video && typeof video.pause === 'function') video.pause();

      if (snapshot && typeof snapshot.onDone === 'function') snapshot.onDone();
      if (snapshot && snapshot.final) {
        if (typeof setPhase === 'function') setPhase(state, 'defeat');
        return true;
      }
      if (typeof setPhase === 'function') setPhase(state, 'playing');
      if (hud && typeof hud.show === 'function') hud.show();
      sfx('startWarDrums');
      sfx('waveHorn');
      requestPointerLock();
      return true;
    }

    function update() {
      if (!active) return;
      var video = el('intermission-video');
      if (video && video.ended) showHint('Haz clic para continuar');
    }

    return {
      begin: begin,
      finish: finish,
      update: update,
      isActive: function () { return active; },
    };
  }

  return { create: create };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = { Intermission: Intermission };

// Screens: full-screen menu, victory and defeat overlays.
// Browser global `Screens`; also guarded for Node tooling consistency.
//
// All show/hide logic lives here so js/main.js only reacts to phase flips.
// Buttons wired here reload the page (an honest full reset).

var Screens = (function () {
  var els = null;

  function cache() {
    if (els || typeof document === 'undefined') return els;
    els = {
      menu: document.getElementById('menu-screen'),
      victory: document.getElementById('victory-screen'),
      defeat: document.getElementById('defeat-screen'),
      briefing: document.getElementById('briefing-screen'),
      pauseOverlay: document.getElementById('pause-overlay'),
      defeatCause: document.getElementById('defeat-cause'),
      statWaves: document.getElementById('stat-waves'),
      statScore: document.getElementById('stat-score'),
      toast: document.getElementById('intro-toast'),
      btnRetry: document.getElementById('btn-retry'),
      briefKicker: document.getElementById('brief-kicker'),
      briefTitle: document.getElementById('brief-title'),
      briefDate: document.getElementById('brief-date'),
      briefPlace: document.getElementById('brief-place'),
      briefUnit: document.getElementById('brief-unit'),
      briefBody: document.getElementById('brief-body'),
      briefFacts: document.getElementById('brief-facts'),
      victoryTitle: document.querySelector('#victory-screen .screen-title'),
    };
    return els;
  }

  function setVisible(el, visible) {
    if (!el) return;
    if (visible) el.classList.remove('hidden');
    else el.classList.add('hidden');
  }

  function showMenu() {
    var e = cache();
    if (!e) return;
    setVisible(e.menu, true);
    setVisible(e.victory, false);
    setVisible(e.defeat, false);
  }

  function hideMenu() {
    var e = cache();
    if (e) setVisible(e.menu, false);
  }

  function hideAll() {
    var e = cache();
    if (!e) return;
    setVisible(e.menu, false);
    setVisible(e.victory, false);
    setVisible(e.defeat, false);
    setVisible(e.briefing, false);
    if (e.pauseOverlay) e.pauseOverlay.style.display = 'none';
  }

  // The briefing: the historical frame of the mission, with the sources.
  function showBriefing(mission) {
    var e = cache();
    if (!e || !mission) return;
    hideAll();
    if (e.briefKicker) e.briefKicker.textContent = mission.kicker || '';
    if (e.briefTitle) e.briefTitle.textContent = mission.title || '';
    if (e.briefDate) e.briefDate.textContent = mission.date || '';
    if (e.briefPlace) e.briefPlace.textContent = mission.place || '';
    if (e.briefUnit) e.briefUnit.textContent = mission.unit || '';
    if (e.briefBody) {
      e.briefBody.innerHTML = '';
      var brief = mission.brief || [];
      for (var i = 0; i < brief.length; i++) {
        var p = document.createElement('p');
        p.textContent = brief[i];
        e.briefBody.appendChild(p);
      }
    }
    if (e.briefFacts) {
      e.briefFacts.innerHTML = '';
      var facts = mission.facts || [];
      for (var f = 0; f < facts.length; f++) {
        var fact = facts[f];
        var box = document.createElement('div');
        box.className = 'brief-fact';
        var tag = document.createElement('div');
        tag.className = 'brief-fact-tag';
        tag.textContent = fact.tag || '';
        var text = document.createElement('div');
        text.className = 'brief-fact-text';
        text.textContent = fact.text || '';
        var src = document.createElement('div');
        src.className = 'brief-fact-source';
        src.textContent = fact.source || '';
        box.appendChild(tag);
        box.appendChild(text);
        box.appendChild(src);
        e.briefFacts.appendChild(box);
      }
    }
    setVisible(e.briefing, true);
  }

  function hideBriefing() {
    var e = cache();
    if (!e) return;
    setVisible(e.briefing, false);
  }

  // stats: { wavesRepelled, wavesTotal, score } — only what state actually
  // holds; kills are not tracked as a counter, so they are not shown.
  function showVictory(stats) {
    var e = cache();
    if (!e) return;
    stats = stats || {};
    hideAll();
    if (e.statWaves) e.statWaves.textContent = String(stats.wavesRepelled != null ? stats.wavesRepelled : 3);
    if (e.statScore) e.statScore.textContent = String(stats.score != null ? stats.score : 0);
    if (e.victoryTitle) {
      e.victoryTitle.innerHTML = 'Resististe hasta el último.<br />Humen cayó: el parte de 1841 no dice otra cosa.';
    }
    setVisible(e.victory, true);
  }

  // Cause-of-defeat detection, evaluated at the moment of the flip.
  // playerHp hit 0 -> the soldier fell; otherwise the fort was taken.
  function detectDefeatCause(state) {
    if (state && (state.playerHp || 0) <= 0) return 'soldier';
    return 'fort';
  }

  // cause: 'soldier' | 'fort' (anything else falls back to a line naming both).
  function showDefeat(cause) {
    var e = cache();
    if (!e) return;
    hideAll();
    var checkpoint = null;
    if (typeof CheckpointLogic !== 'undefined' && typeof window !== 'undefined') {
      try { checkpoint = CheckpointLogic.load(window.localStorage); } catch (error) { checkpoint = null; }
    }
    if (e.btnRetry) {
      e.btnRetry.textContent = checkpoint ? 'Reintentar fase ' + checkpoint.wave : 'Reintentar';
    }
    if (e.defeatCause) {
      e.defeatCause.textContent = cause === 'soldier'
        ? 'Has caído defendiendo la muralla.'
        : cause === 'fort'
          ? 'El fuerte ha sido tomado por los británicos.'
          : 'La guarnición ha sido masacrada o el fuerte ha caído.';
    }
    setVisible(e.defeat, true);
  }

  // Battle-start toast; CSS animation handles the 4 s auto-hide.
  function showIntroToast() {
    var e = cache();
    var el = e && e.toast;
    if (!el) return;
    el.classList.remove('toast-show');
    void el.offsetWidth;
    el.classList.add('toast-show');
  }

  return {
    showMenu: showMenu,
    hideMenu: hideMenu,
    hideAll: hideAll,
    showBriefing: showBriefing,
    hideBriefing: hideBriefing,
    showVictory: showVictory,
    showDefeat: showDefeat,
    detectDefeatCause: detectDefeatCause,
    showIntroToast: showIntroToast,
  };
})();

if (typeof document !== 'undefined') {
  document.addEventListener('click', function (ev) {
    var id = ev.target && ev.target.id;
    if (id === 'btn-again' || id === 'btn-retry') {
      window.location.reload();
    }
  });
}

if (typeof module !== 'undefined') module.exports = { Screens: Screens };

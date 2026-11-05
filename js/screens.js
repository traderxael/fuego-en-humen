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
      pauseOverlay: document.getElementById('pause-overlay'),
      defeatCause: document.getElementById('defeat-cause'),
      statWaves: document.getElementById('stat-waves'),
      statScore: document.getElementById('stat-score'),
      toast: document.getElementById('intro-toast'),
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
    if (e.pauseOverlay) e.pauseOverlay.style.display = 'none';
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

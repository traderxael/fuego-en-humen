// HUD: bars, ammo readout, wave counter, crosshair visibility and hit marker.
// Browser global `HUD`; also guarded for Node tooling consistency.
//
// The HUD is read-only with respect to game state: it never mutates `state`.
// This module is the sole writer of the #hud-* readouts (health, fort, ammo,
// wave) plus the bars and the hit marker.

var HUD = (function () {
  var els = null;
  var last = { hp: null, fort: null, wave: null, ammo: null };
  var MAX_HP = (typeof PLAYER_HP !== 'undefined') ? PLAYER_HP : 100;
  var MAX_FORT = (typeof FORT_INTEGRITY !== 'undefined') ? FORT_INTEGRITY : 100;

  function cache() {
    if (els || typeof document === 'undefined') return els;
    els = {
      root: document.getElementById('hud'),
      healthBar: document.getElementById('hud-health-bar'),
      healthText: document.getElementById('hud-health'),
      fortBar: document.getElementById('hud-fort-bar'),
      fortText: document.getElementById('hud-fort'),
      waveText: document.getElementById('hud-wave'),
      ammoText: document.getElementById('hud-ammo'),
      hitMarker: document.getElementById('hit-marker'),
    };
    return els;
  }

  function setBar(bar, ratio) {
    if (!bar) return;
    var clamped = Math.max(0, Math.min(1, ratio));
    bar.style.width = (clamped * 100).toFixed(1) + '%';
  }

  function setBarState(bar, ratio) {
    if (!bar) return;
    if (ratio <= 0.3) bar.classList.add('bar-low');
    else bar.classList.remove('bar-low');
  }

  // updateHUD(state) — call every frame; internally cached so the DOM is only
  // touched when a value actually changed.
  function updateHUD(state) {
    var e = cache();
    if (!e || !state) return;

    var hp = Math.max(0, state.playerHp || 0);
    if (hp !== last.hp) {
      last.hp = hp;
      setBar(e.healthBar, hp / MAX_HP);
      setBarState(e.healthBar, hp / MAX_HP);
      if (e.healthText) e.healthText.textContent = 'HP ' + hp;
    }

    var fort = Math.max(0, state.fortIntegrity || 0);
    if (fort !== last.fort) {
      last.fort = fort;
      setBar(e.fortBar, fort / MAX_FORT);
      setBarState(e.fortBar, fort / MAX_FORT);
      if (e.fortText) e.fortText.textContent = 'Fuerte ' + fort;
    }

    var wave = state.wave || 1;
    if (wave !== last.wave) {
      last.wave = wave;
      var total = (typeof WAVES !== 'undefined' && WAVES.length) ? WAVES.length : 3;
      if (e.waveText) e.waveText.textContent = 'Oleada ' + wave + '/' + total;
    }

    // Ammo readout — mirrors js/player.js with an identical format. Only key
    // reload logic off the *active* weapon: the sable never reloads.
    var weapon = state.weapon || 'mosquete';
    var def = (typeof WEAPONS !== 'undefined') ? WEAPONS[weapon] : null;
    var isMelee = def ? def.type === 'melee' : weapon === 'sable';
    var reloading = !isMelee && (state.reloading === true || (state.reloadingUntil || 0) > (state.time || 0));
    var ammoKey = isMelee ? 'melee' : (reloading ? 'reload' : 'ammo:' + state.ammo + '/' + state.clipSize);
    if (ammoKey !== last.ammo) {
      last.ammo = ammoKey;
      if (e.ammoText) {
        e.ammoText.textContent = isMelee
          ? 'Sable'
          : reloading
            ? 'Recargando…'
            : 'Mosquete ' + state.ammo + ' / ' + state.clipSize;
      }
    }
  }

  function show() {
    var e = cache();
    if (e && e.root) e.root.classList.remove('hidden');
  }

  function hide() {
    var e = cache();
    if (e && e.root) e.root.classList.add('hidden');
  }

  // Brief white flash at the crosshair when an enemy is hit.
  function flashHit() {
    var e = cache();
    var el = e && e.hitMarker;
    if (!el) return;
    el.classList.remove('hit-flash');
    void el.offsetWidth; // restart the CSS animation
    el.classList.add('hit-flash');
  }

  return { updateHUD: updateHUD, show: show, hide: hide, flashHit: flashHit };
})();

if (typeof module !== 'undefined') module.exports = { HUD: HUD };

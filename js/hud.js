// HUD: bars, ammo readout, wave counter, crosshair visibility and hit marker.
// Browser global `HUD`; also guarded for Node tooling consistency.
//
// The HUD is read-only with respect to game state: it never mutates `state`.
// This module is the sole writer of the #hud-* readouts (health, fort, ammo,
// wave) plus the bars and the hit marker.

var HUD = (function () {
  var els = null;
  var last = { hp: null, fort: null, wave: null, ammo: null, score: null, mission: null, objective: null, streak: null };
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
      cannonHint: document.getElementById('cannon-hint'),
      damage: document.getElementById('damage-vignette'),
      scoreText: document.getElementById('hud-score'),
      streakText: document.getElementById('hud-streak'),
      missionText: document.getElementById('hud-mission'),
      objectiveText: document.getElementById('hud-objective'),
      signalBox: document.getElementById('hud-signal'),
      radioLine: document.getElementById('radio-line'),
      beatCard: document.getElementById('beat-card'),
      hudEl: document.getElementById('hud'),
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
      var def = (typeof WAVES !== 'undefined') ? WAVES[wave - 1] : null;
      if (e.waveText) {
        e.waveText.textContent = def && def.phase
          ? def.phase + ' · ' + wave + '/' + total
          : 'Fase ' + wave + '/' + total;
      }
      setObjective(def && def.objective ? def.objective : '');
    }

    // Ammo readout — hud.js owns this now (player.js no longer writes it).
    // Only key reload logic off the *active* weapon: the sable never reloads.
    var weapon = state.weapon || 'mosquete';
    var def = (typeof WEAPONS !== 'undefined') ? WEAPONS[weapon] : null;
    var isMelee = def ? def.type === 'melee' : weapon === 'sable';
    var reloading = !isMelee && (state.reloading === true || (state.reloadingUntil || 0) > (state.time || 0));
    var ammoKey = isMelee ? 'melee' : (reloading ? 'reload' : 'ammo:' + state.ammo + '/' + state.clipSize);
    if (ammoKey !== last.ammo) {
      last.ammo = ammoKey;
      if (e.ammoText) {
        e.ammoText.textContent = isMelee
          ? 'Sable · 1/2'
          : reloading
            ? 'Recargando…'
            : 'Mosquete ' + state.ammo + ' / ' + state.clipSize;
      }
    }

    var score = (typeof state.score === 'number') ? state.score : 0;
    if (score !== last.score) { last.score = score; if (e.scoreText) e.scoreText.textContent = 'Puntuación ' + score; }
    var missionName = (typeof state.missionTitle === 'string') ? state.missionTitle : '';
    if (missionName !== last.mission) { last.mission = missionName; if (e.missionText) e.missionText.textContent = missionName; }
    try { if (e.hudEl) { var low = hp > 0 && hp / MAX_HP <= 0.3; e.hudEl.classList.toggle('hud-low-hp', low); } } catch (err) {}
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

  // Red vignette when the player takes damage.
  function flashDamage() {
    var e = cache();
    var el = e && e.damage;
    if (!el) return;
    el.classList.remove('hit-flash');
    void el.offsetWidth;
    el.classList.add('hit-flash');
  }

  var lastCannonHint = null;
  // Contextual prompt near a fort cannon; null hides it.
  function setCannonHint(text) {
    var e = cache();
    var el = e && e.cannonHint;
    if (!el || text === lastCannonHint) return;
    lastCannonHint = text;
    if (text) {
      el.textContent = text;
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  }

  // --- Objective ---------------------------------------------------------
  function setObjective(text) {
    var e = cache();
    var el = e && e.objectiveText;
    if (!el || text === last.objective) return;
    last.objective = text;
    el.textContent = text || '';
    el.style.display = text ? 'block' : 'none';
  }

  // --- Streak ------------------------------------------------------------
  function setStreak(multiplier) {
    var e = cache();
    var el = e && e.streakText;
    if (!el) return;
    var m = Math.round((multiplier || 1) * 100) / 100;
    if (m === last.streak) return;
    last.streak = m;
    el.textContent = 'Racha ×' + m.toFixed(2).replace(/\.00$/, '');
    el.style.color = m > 1.2 ? 'var(--ochre)' : '';
  }

  // --- Signal prompt -----------------------------------------------------
  function showSignal(html) {
    var e = cache();
    var el = e && e.signalBox;
    if (!el) return;
    if (!html) {
      el.classList.add('hidden');
      return;
    }
    el.innerHTML = html;
    el.classList.remove('hidden');
  }

  // --- Radio -------------------------------------------------------------
  var radioTimer = 0;
  function showRadio(speaker, text, seconds) {
    var e = cache();
    var el = e && e.radioLine;
    if (!el) return;
    if (!text) {
      el.classList.add('hidden');
      return;
    }
    var sp = el.querySelector('.radio-speaker');
    var tx = el.querySelector('.radio-text');
    if (sp) sp.textContent = speaker || '';
    if (tx) tx.textContent = text;
    el.classList.remove('hidden');
    radioTimer = seconds || 6;
  }

  // --- Historical beat card ---------------------------------------------
  var beatTimer = 0;
  function showBeat(beat, seconds) {
    var e = cache();
    var el = e && e.beatCard;
    if (!el) return;
    if (!beat) {
      el.classList.add('hidden');
      return;
    }
    var tag = el.querySelector('.beat-tag');
    var text = el.querySelector('.beat-text');
    var source = el.querySelector('.beat-source');
    if (tag) tag.textContent = beat.title || '';
    if (text) text.textContent = beat.text || '';
    if (source) source.textContent = beat.source || '';
    el.classList.remove('hidden');
    // Restart the entry animation.
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    beatTimer = seconds || 9;
  }

  function tickTimers(dt) {
    if (radioTimer > 0) {
      radioTimer -= dt;
      if (radioTimer <= 0) {
        var e = cache();
        if (e && e.radioLine) e.radioLine.classList.add('hidden');
      }
    }
    if (beatTimer > 0) {
      beatTimer -= dt;
      if (beatTimer <= 0) {
        var e2 = cache();
        if (e2 && e2.beatCard) e2.beatCard.classList.add('hidden');
      }
    }
  }

  return {
    updateHUD: updateHUD,
    show: show,
    hide: hide,
    flashHit: flashHit,
    flashDamage: flashDamage,
    setCannonHint: setCannonHint,
    setObjective: setObjective,
    setStreak: setStreak,
    showSignal: showSignal,
    showRadio: showRadio,
    showBeat: showBeat,
    tickTimers: tickTimers,
  };
})();

if (typeof module !== 'undefined') module.exports = { HUD: HUD };

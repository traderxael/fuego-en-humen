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
      statBest: document.getElementById('stat-best'),
      newRecord: document.getElementById('new-record'),
      defeatScore: document.getElementById('defeat-score'),
      defeatBest: document.getElementById('defeat-best'),
      defeatKicker: document.getElementById('defeat-kicker'),
      defeatTitle: document.getElementById('defeat-title'),
      btnRetry: document.getElementById('btn-retry'),
      epilogue: document.getElementById('epilogue-panel'),
      epilogueBody: document.getElementById('epilogue-body'),
      toast: document.getElementById('intro-toast'),
      armory: document.getElementById('armory-screen'),
      armoryCards: document.getElementById('armory-cards'),
      armoryBrief: document.getElementById('armory-brief'),
      campaignList: document.getElementById('campaign-list'),
      armoryEquipped: document.getElementById('armory-equipped'),
      intro: document.getElementById('intro-screen'),
      introChapters: document.getElementById('intro-chapters'),
      introKicker: document.getElementById('intro-kicker'),
      introTitle: document.getElementById('intro-title'),
      introBody: document.getElementById('intro-body'),
      introNext: document.getElementById('btn-intro-next'),
      introVideo: document.getElementById('intro-video'),
      introMusic: document.getElementById('intro-music'),
    };
    return els;
  }

  // --- Armory: weapon cards, selection and its own screen ---
  var armoryWeapon = 'mosquete';

  function weaponLabel(key) {
    var def = (typeof WEAPONS !== 'undefined') ? WEAPONS[key] : null;
    return (def && (def.label || def.name)) || key;
  }

  function statLine(entry) {
    if (entry.type === 'melee') {
      return 'Daño ' + entry.damage + ' · Alcance ' + entry.range + ' m';
    }
    if (entry.pellets > 1) {
      return entry.pellets + ' × ' + entry.damage + ' daño · Carga ' + entry.clipSize +
        ' · Recarga ' + entry.reloadTime + ' s';
    }
    return 'Daño ' + entry.damage + ' · Carga ' + entry.clipSize +
      ' · Recarga ' + entry.reloadTime + ' s';
  }

  // Simple vector silhouettes so each card reads as its weapon. Built with
  // the DOM API (no innerHTML) so nothing is ever parsed as markup.
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var WEAPON_ICONS = {
    mosquete: [
      { t: 'line', x1: 10, y1: 34, x2: 40, y2: 14 },
      { t: 'line', x1: 10, y1: 34, x2: 19, y2: 40 },
      { t: 'line', x1: 27, y1: 21, x2: 31, y2: 25 },
    ],
    fusil: [
      { t: 'line', x1: 8, y1: 38, x2: 42, y2: 10 },
      { t: 'line', x1: 8, y1: 38, x2: 17, y2: 44 },
      { t: 'rect', x: 17, y: 25, w: 7, h: 7, rot: -38 },
    ],
    sable: [
      { t: 'path', d: 'M13 39 Q26 27 38 10' },
      { t: 'line', x1: 13, y1: 39, x2: 21, y2: 33 },
      { t: 'line', x1: 18, y1: 36, x2: 22, y2: 40 },
    ],
    pica: [
      { t: 'line', x1: 10, y1: 40, x2: 35, y2: 15 },
      { t: 'path', d: 'M35 15 L42 6 L39 17 Z' },
    ],
    trabuco: [
      { t: 'line', x1: 8, y1: 38, x2: 32, y2: 17 },
      { t: 'line', x1: 8, y1: 38, x2: 17, y2: 43 },
      { t: 'path', d: 'M29 13 L39 7 L43 14 L34 20 Z' },
    ],
  };

  function weaponIcon(key) {
    var parts = WEAPON_ICONS[key];
    if (!parts) return null;
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'armory-icon');
    svg.setAttribute('viewBox', '0 0 48 48');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2.4');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      var node = document.createElementNS(SVG_NS, part.t);
      for (var key2 in part) {
        if (!Object.prototype.hasOwnProperty.call(part, key2)) continue;
        if (key2 === 't') continue;
        if (key2 === 'rot') {
          node.setAttribute('transform', 'rotate(' + part.rot + ' ' + (part.x + part.w / 2) + ' ' + (part.y + part.h / 2) + ')');
          continue;
        }
        node.setAttribute(key2, part[key2]);
      }
      svg.appendChild(node);
    }
    return svg;
  }

  function renderArmory() {
    var e = cache();
    if (!e || !e.armoryCards) return;
    var entries = (typeof armoryEntries === 'function')
      ? armoryEntries(WEAPONS)
      : [];
    e.armoryCards.textContent = '';
    for (var i = 0; i < entries.length; i++) {
      (function (entry) {
        var card = document.createElement('div');
        card.className = 'armory-card';
        card.setAttribute('data-weapon', entry.key);
        var icon = document.createElement('div');
        icon.className = 'armory-card-icon';
        var svgIcon = weaponIcon(entry.key);
        if (svgIcon) icon.appendChild(svgIcon);
        var name = document.createElement('div');
        name.className = 'armory-card-name';
        name.textContent = entry.label;
        var stats = document.createElement('div');
        stats.className = 'armory-card-stats';
        stats.textContent = statLine(entry);
        var desc = document.createElement('p');
        desc.className = 'armory-card-desc';
        desc.textContent = entry.desc;
        card.appendChild(icon);
        card.appendChild(name);
        card.appendChild(stats);
        card.appendChild(desc);
        card.addEventListener('click', function () {
          setArmoryWeapon(entry.key);
        });
        e.armoryCards.appendChild(card);
      })(entries[i]);
    }
    paintArmorySelection();
  }

  function paintArmorySelection() {
    var e = cache();
    if (!e || !e.armoryCards) return;
    var cards = e.armoryCards.children;
    for (var i = 0; i < cards.length; i++) {
      var key = cards[i].getAttribute('data-weapon');
      if (key === armoryWeapon) cards[i].classList.add('armory-card-on');
      else cards[i].classList.remove('armory-card-on');
    }
    if (e.armoryEquipped) e.armoryEquipped.textContent = weaponLabel(armoryWeapon);
  }

  function setArmoryWeapon(key) {
    var next = (typeof sanitizeLoadout === 'function')
      ? sanitizeLoadout(key, WEAPONS)
      : (WEAPONS[key] ? key : 'mosquete');
    armoryWeapon = next;
    paintArmorySelection();
    return armoryWeapon;
  }

  function getArmoryWeapon() {
    return armoryWeapon;
  }

  function showArmory() {
    var e = cache();
    if (!e) return;
    renderArmory();
    renderArmoryBrief();
    setVisible(e.armory, true);
    setVisible(e.menu, false);
  }

  function hideArmory() {
    var e = cache();
    if (e) setVisible(e.armory, false);
  }

  function setVisible(el, visible) {
    if (!el) return;
    if (visible) el.classList.remove('hidden');
    else el.classList.add('hidden');
  }

  function showMenu() {
    var e = cache();
    if (!e) return;
    var checkpoint = getCampaignCheckpoint();
    if (checkpoint) selectedMission = checkpoint.mission;
    renderCampaignList();
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
    setVisible(e.armory, false);
    if (e.pauseOverlay) e.pauseOverlay.style.display = 'none';
  }

  // stats: { wavesRepelled, score, bestScore, isNewRecord }.
  function showVictory(stats) {
    var e = cache();
    if (!e) return;
    stats = stats || {};
    hideAll();
    var total = (typeof WAVES !== 'undefined' && WAVES.length) ? WAVES.length : 5;
    if (e.statWaves) e.statWaves.textContent = String(stats.wavesRepelled != null ? stats.wavesRepelled : total);
    if (e.statScore) e.statScore.textContent = String(stats.score != null ? stats.score : 0);
    if (e.statBest) e.statBest.textContent = String(stats.bestScore != null ? stats.bestScore : (stats.score || 0));
    setVisible(e.newRecord, !!stats.isNewRecord);
    setVisible(e.victory, true);
  }

  // Cause-of-defeat detection, evaluated at the moment of the flip.
  // playerHp hit 0 -> the soldier fell; otherwise the fort was taken.
  function detectDefeatCause(state) {
    if (state && state.defeatCause === 'history') return 'history';
    if (state && (state.playerHp || 0) <= 0) return 'soldier';
    return 'fort';
  }

  var epilogueBuilt = false;
  function fillEpilogue() {
    var e = cache();
    if (!e || !e.epilogueBody || epilogueBuilt) return;
    epilogueBuilt = true;
    var paragraphs = (typeof Campaign !== 'undefined' && Campaign && Campaign.EPILOGUE)
      ? Campaign.EPILOGUE
      : [];
    for (var i = 0; i < paragraphs.length; i++) {
      var p = document.createElement('p');
      p.textContent = paragraphs[i];
      e.epilogueBody.appendChild(p);
    }
  }

  // cause: 'soldier' | 'fort' | 'history' (fallback names both).
  // stats (optional): { score, bestScore } for the end-of-run readouts.
  function showDefeat(cause, stats) {
    var e = cache();
    if (!e) return;
    hideAll();
    var history = cause === 'history';
    if (e.defeatKicker) e.defeatKicker.textContent = history ? '26 de febrero de 1841' : 'Derrota';
    if (e.defeatTitle) e.defeatTitle.textContent = history ? 'Humen cayó' : 'Derrota';
    if (e.defeatCause) {
      e.defeatCause.textContent = history
        ? 'Rechazaste cinco asaltos, pero los fuertes de Anunghoy y Wangtong cayeron ante la escuadra de Bremer.'
        : cause === 'soldier'
          ? 'Has caído defendiendo la muralla.'
          : cause === 'fort'
            ? 'El fuerte ha sido tomado por los británicos.'
            : 'La guarnición ha sido masacrada o el fuerte ha caído.';
    }
    if (e.epilogue) {
      if (history) {
        fillEpilogue();
        e.epilogue.classList.remove('hidden');
      } else {
        e.epilogue.classList.add('hidden');
      }
    }
    var checkpoint = getCampaignCheckpoint();
    if (e.btnRetry) {
      e.btnRetry.textContent = checkpoint ? 'Reintentar misión ' + checkpoint.mission : 'Reintentar';
    }
    stats = stats || {};
    if (e.defeatScore) e.defeatScore.textContent = String(stats.score != null ? stats.score : 0);
    if (e.defeatBest) e.defeatBest.textContent = String(stats.bestScore != null ? stats.bestScore : (stats.score || 0));
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

  // --- Intro: cinematic on black with the three chapters ---
  var introIndex = 0;

  function introBeats() {
    return (typeof INTRO_BEATS !== 'undefined') ? INTRO_BEATS : [];
  }

  function paintIntro() {
    var e = cache();
    if (!e) return;
    var beats = introBeats();
    if (!beats.length) return;
    var beat = beats[Math.max(0, Math.min(beats.length - 1, introIndex))];
    if (e.introKicker) e.introKicker.textContent = beat.kicker;
    if (e.introTitle) e.introTitle.textContent = beat.title;
    if (e.introBody) e.introBody.textContent = beat.body;
    if (e.introNext) {
      e.introNext.textContent = (typeof introButtonLabel === 'function')
        ? introButtonLabel(introIndex, beats.length)
        : 'Continuar ▸';
    }
    // Re-trigger the fade-in of the chapter.
    if (e.introChapters) {
      e.introChapters.classList.remove('intro-beat');
      void e.introChapters.offsetWidth;
      e.introChapters.classList.add('intro-beat');
    }
  }

  // Autoplay is blocked before a gesture, so the media is retried on click.
  function startIntroMedia() {
    var e = cache();
    if (!e) return;
    if (e.introVideo) {
      try {
        var vp = e.introVideo.play();
        if (vp && typeof vp.catch === 'function') vp.catch(function () { /* needs a gesture */ });
      } catch (err) { /* media unavailable */ }
    }
    if (e.introMusic) {
      try {
        var mp = e.introMusic.play();
        if (mp && typeof mp.catch === 'function') mp.catch(function () { /* needs a gesture */ });
      } catch (err) { /* media unavailable */ }
    }
  }

  function showIntro() {
    var e = cache();
    if (!e) return;
    introIndex = 0;
    paintIntro();
    setVisible(e.intro, true);
    setVisible(e.menu, false);
    startIntroMedia();
  }

  // Returns false when the last chapter was reached (intro finished).
  function nextIntro() {
    var beats = introBeats();
    var res = (typeof introAdvance === 'function')
      ? introAdvance(introIndex, beats.length)
      : { index: introIndex, done: true };
    introIndex = res.index;
    if (res.done) {
      hideIntro();
      return false;
    }
    paintIntro();
    startIntroMedia();
    return true;
  }

  function hideIntro() {
    var e = cache();
    if (!e) return;
    setVisible(e.intro, false);
    if (e.introVideo) {
      try { e.introVideo.pause(); } catch (err) { /* ignore */ }
    }
  }

  // The theme keeps playing under the menu; the war drums take over in game.
  function stopIntroMusic() {
    var e = cache();
    if (!e || !e.introMusic) return;
    try { e.introMusic.pause(); } catch (err) { /* ignore */ }
  }

  function isIntroVisible() {
    var e = cache();
    return !!(e && e.intro && !e.intro.classList.contains('hidden'));
  }

  // The intro is shown once per session: a retry goes straight to the menu.
  function markIntroSeen() {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('fuego-en-humen:introSeen', '1');
      }
    } catch (e) { /* storage unavailable */ }
  }

  // --- Campaign: mission select, briefing and saved progress ---
  var campaignProgressCache = null;
  var selectedMission = 1;

  function storage() {
    try { return (typeof window !== 'undefined') ? window.localStorage : null; } catch (error) { return null; }
  }

  function campaignProgress() {
    if (!campaignProgressCache) {
      campaignProgressCache = (typeof ProgressLogic !== 'undefined')
        ? ProgressLogic.load(storage())
        : { unlocked: 1, checkpoint: null };
    }
    return campaignProgressCache;
  }

  function saveProgress() {
    if (typeof ProgressLogic !== 'undefined') ProgressLogic.save(storage(), campaignProgress());
  }

  function getCampaignMission() {
    var progress = campaignProgress();
    if (!(typeof ProgressLogic !== 'undefined') || ProgressLogic.isUnlocked(selectedMission, progress)) {
      return selectedMission;
    }
    return progress.unlocked;
  }

  function setCampaignMission(n) {
    var progress = campaignProgress();
    if (typeof ProgressLogic !== 'undefined' && !ProgressLogic.isUnlocked(n, progress)) return false;
    selectedMission = Math.max(1, Math.min(5, Math.floor(Number(n) || 1)));
    renderCampaignList();
    renderArmoryBrief();
    return true;
  }

  function getCampaignCheckpoint() {
    return campaignProgress().checkpoint;
  }

  function setCampaignCheckpoint(checkpoint) {
    if (typeof ProgressLogic === 'undefined') return;
    ProgressLogic.setCheckpoint(campaignProgress(), checkpoint);
    saveProgress();
  }

  function clearCampaignCheckpoint() {
    if (typeof ProgressLogic === 'undefined') return;
    ProgressLogic.clearCheckpoint(campaignProgress());
    saveProgress();
  }

  function unlockNextMission(n) {
    if (typeof ProgressLogic === 'undefined') return;
    ProgressLogic.unlock(campaignProgress(), n);
    saveProgress();
    renderCampaignList();
  }

  function renderCampaignList() {
    var e = cache();
    if (!e || !e.campaignList || typeof Campaign === 'undefined' || !Campaign.WAVES) return;
    var progress = campaignProgress();
    var unlocked = (typeof ProgressLogic !== 'undefined')
      ? function (n) { return ProgressLogic.isUnlocked(n, progress); }
      : function () { return true; };
    e.campaignList.textContent = '';
    for (var i = 0; i < Campaign.WAVES.length; i++) {
      (function (entry) {
        var button = document.createElement('button');
        var open = unlocked(entry.n);
        button.className = 'campaign-mission' +
          (entry.n === selectedMission && open ? ' campaign-mission-on' : '') +
          (open ? '' : ' campaign-mission-locked');
        button.disabled = !open;
        button.setAttribute('data-mission', String(entry.n));
        var title = document.createElement('span');
        title.className = 'campaign-mission-title';
        title.textContent = 'M' + entry.n + ' · ' + entry.name;
        var date = document.createElement('span');
        date.className = 'campaign-mission-date';
        date.textContent = open ? entry.date : 'Bloqueada';
        button.appendChild(title);
        button.appendChild(date);
        button.addEventListener('click', function () { setCampaignMission(entry.n); });
        e.campaignList.appendChild(button);
      })(Campaign.WAVES[i]);
    }
  }

  function renderArmoryBrief() {
    var e = cache();
    if (!e || !e.armoryBrief || typeof Campaign === 'undefined') return;
    var brief = Campaign.briefing(getCampaignMission());
    e.armoryBrief.textContent = '';
    if (!brief) return;
    var kicker = document.createElement('div');
    kicker.className = 'brief-kicker';
    kicker.textContent = brief.kicker;
    var title = document.createElement('div');
    title.className = 'brief-title';
    title.textContent = brief.title;
    var body = document.createElement('p');
    body.className = 'brief-body';
    body.textContent = brief.body;
    var list = document.createElement('ul');
    list.className = 'brief-objectives';
    for (var i = 0; i < brief.objectives.length; i++) {
      var item = document.createElement('li');
      item.textContent = brief.objectives[i];
      list.appendChild(item);
    }
    e.armoryBrief.appendChild(kicker);
    e.armoryBrief.appendChild(title);
    e.armoryBrief.appendChild(body);
    e.armoryBrief.appendChild(list);
  }

  return {
    showMenu: showMenu,
    hideMenu: hideMenu,
    hideAll: hideAll,
    showArmory: showArmory,
    hideArmory: hideArmory,
    setArmoryWeapon: setArmoryWeapon,
    getArmoryWeapon: getArmoryWeapon,
    showIntro: showIntro,
    nextIntro: nextIntro,
    hideIntro: hideIntro,
    stopIntroMusic: stopIntroMusic,
    isIntroVisible: isIntroVisible,
    markIntroSeen: markIntroSeen,
    showVictory: showVictory,
    showDefeat: showDefeat,
    detectDefeatCause: detectDefeatCause,
    showIntroToast: showIntroToast,
    getCampaignMission: getCampaignMission,
    setCampaignMission: setCampaignMission,
    getCampaignCheckpoint: getCampaignCheckpoint,
    setCampaignCheckpoint: setCampaignCheckpoint,
    clearCampaignCheckpoint: clearCampaignCheckpoint,
    unlockNextMission: unlockNextMission,
  };
})();

if (typeof document !== 'undefined') {
  document.addEventListener('click', function (ev) {
    var id = ev.target && ev.target.id;
    if (id === 'btn-again' || id === 'btn-retry') {
      window.location.reload();
      return;
    }
    if (id === 'btn-intro-next') {
      if (!Screens.nextIntro()) {
        Screens.markIntroSeen();
        Screens.showMenu();
      }
      return;
    }
    if (id === 'btn-intro-skip') {
      Screens.markIntroSeen();
      Screens.hideIntro();
      Screens.showMenu();
    }
  });

  // Keyboard: Enter/Space advances the chapter, Escape skips the intro.
  document.addEventListener('keydown', function (ev) {
    if (!Screens.isIntroVisible()) return;
    var code = ev.code || ev.key;
    if (code === 'Enter' || code === 'Space' || code === 'NumpadEnter') {
      if (typeof ev.preventDefault === 'function') ev.preventDefault();
      if (!Screens.nextIntro()) {
        Screens.markIntroSeen();
        Screens.showMenu();
      }
    } else if (code === 'Escape') {
      Screens.markIntroSeen();
      Screens.hideIntro();
      Screens.showMenu();
    }
  });
}

if (typeof module !== 'undefined') module.exports = { Screens: Screens };

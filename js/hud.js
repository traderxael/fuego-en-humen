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
      cannonHint: document.getElementById('cannon-hint'),
      damage: document.getElementById('damage-vignette'),
      popups: document.getElementById('kill-popups'),
      objective: document.getElementById('hud-objective'),
      radio: document.getElementById('hud-radio'),
      inventory: document.getElementById('hud-inventory'),
      pickupHint: document.getElementById('pickup-hint'),
    };
    return els;
  }

  function armoryOrder() {
    if (typeof ARMORY_ORDER !== 'undefined' && ARMORY_ORDER.length) return ARMORY_ORDER;
    return (typeof WEAPONS !== 'undefined') ? Object.keys(WEAPONS) : [];
  }

  function itemForSlot(number) {
    if (typeof ITEM_DEFS === 'undefined') return null;
    for (var key in ITEM_DEFS) {
      if (Object.prototype.hasOwnProperty.call(ITEM_DEFS, key) && ITEM_DEFS[key].slot === number) {
        return ITEM_DEFS[key];
      }
    }
    return null;
  }

  // Builds the eight hotbar slots once; the markup lives in the HUD module so
  // index.html only needs the empty container.
  var invBuilt = false;
  function buildInventory(e) {
    if (invBuilt || !e.inventory || typeof document === 'undefined') return;
    if (typeof document.createElement !== 'function') return;
    invBuilt = true;
    var order = armoryOrder();
    var i;
    for (i = 0; i < order.length; i++) {
      var def = (typeof WEAPONS !== 'undefined') ? WEAPONS[order[i]] : null;
      var weaponSlot = document.createElement('div');
      weaponSlot.className = 'inv-slot inv-slot-weapon';
      weaponSlot.setAttribute('data-slot', String(i + 1));
      var keyEl = document.createElement('span');
      keyEl.className = 'inv-key';
      keyEl.textContent = String(i + 1);
      var nameEl = document.createElement('span');
      nameEl.className = 'inv-name';
      nameEl.textContent = (def && (def.label || def.name)) || order[i];
      var emptyEl = document.createElement('span');
      emptyEl.className = 'inv-count';
      weaponSlot.appendChild(keyEl);
      weaponSlot.appendChild(nameEl);
      weaponSlot.appendChild(emptyEl);
      e.inventory.appendChild(weaponSlot);
    }
    if (typeof ITEM_DEFS === 'undefined') return;
    for (var name in ITEM_DEFS) {
      if (!Object.prototype.hasOwnProperty.call(ITEM_DEFS, name)) continue;
      var itemDef = ITEM_DEFS[name];
      var itemSlot = document.createElement('div');
      itemSlot.className = 'inv-slot inv-slot-item';
      itemSlot.setAttribute('data-slot', String(itemDef.slot));
      itemSlot.setAttribute('data-item', name);
      var itemKeyEl = document.createElement('span');
      itemKeyEl.className = 'inv-key';
      itemKeyEl.textContent = String(itemDef.slot);
      var itemNameEl = document.createElement('span');
      itemNameEl.className = 'inv-name';
      itemNameEl.textContent = itemDef.short || itemDef.label;
      var countEl = document.createElement('span');
      countEl.className = 'inv-count';
      countEl.textContent = '0';
      itemSlot.appendChild(itemKeyEl);
      itemSlot.appendChild(itemNameEl);
      itemSlot.appendChild(countEl);
      e.inventory.appendChild(itemSlot);
    }
  }

  var lastInventory = null;
  function updateInventory(state) {
    var e = cache();
    if (!e || !e.inventory) return;
    buildInventory(e);
    var inventory = state.inventory || {};
    var weapon = state.weapon || '';
    var signature = weapon + '|' + (inventory.medkit || 0) + '|' +
      (inventory.ammoBag || 0) + '|' + (inventory.grenade || 0);
    if (signature === lastInventory) return;
    lastInventory = signature;

    var slots = e.inventory.children;
    var order = armoryOrder();
    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];
      var number = Number(slot.getAttribute('data-slot'));
      if (number >= 1 && number <= order.length) {
        slot.classList.toggle('inv-slot-on', weapon === order[number - 1]);
        continue;
      }
      var itemDef = itemForSlot(number);
      if (!itemDef) continue;
      var count = inventory[itemDef.name] || 0;
      slot.classList.toggle('inv-slot-empty', count <= 0);
      var countEl = slot.children[2];
      if (countEl) countEl.textContent = String(count);
    }
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
      if (e.waveText) e.waveText.textContent = 'Misión ' + wave + '/' + total;
    }

    // Ammo readout — hud.js owns this now (player.js no longer writes it).
    // Only key reload logic off the *active* weapon: the sable never reloads.
    var weapon = state.weapon || 'mosquete';
    var def = (typeof WEAPONS !== 'undefined') ? WEAPONS[weapon] : null;
    var isMelee = def ? def.type === 'melee' : weapon === 'sable';
    var label = (def && (def.label || def.name)) || (isMelee ? 'Sable' : 'Mosquete');
    var reloading = !isMelee && (state.reloading === true || (state.reloadingUntil || 0) > (state.time || 0));
    var ammoKey = weapon + ':' + (isMelee ? 'melee' : (reloading ? 'reload' : 'ammo:' + state.ammo + '/' + state.clipSize));
    if (ammoKey !== last.ammo) {
      last.ammo = ammoKey;
      if (e.ammoText) {
        e.ammoText.textContent = isMelee
          ? label
          : reloading
            ? 'Recargando…'
            : label + ' ' + state.ammo + ' / ' + state.clipSize;
      }
    }

    updateInventory(state);
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

  // Floating "+points" on kill: a fixed pool of divs, CSS animation restarts
  // via the same reflow trick as the hit marker. No per-kill allocation.
  var popupPool = null;
  var popupCursor = 0;
  function killPopup(points) {
    var e = cache();
    if (!e || !e.popups || typeof document.createElement !== 'function') return;
    if (!popupPool) {
      popupPool = [];
      for (var i = 0; i < 4; i++) {
        var div = document.createElement('div');
        div.className = 'kill-popup';
        e.popups.appendChild(div);
        popupPool.push(div);
      }
    }
    var el = popupPool[popupCursor % popupPool.length];
    popupCursor++;
    el.textContent = '+' + points;
    el.style.marginLeft = (((popupCursor % 3) - 1) * 26) + 'px';
    el.classList.remove('kill-float');
    void el.offsetWidth; // restart the CSS animation
    el.classList.add('kill-float');
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

  var lastObjective = null;
  // Mission objective line under the wave counter; null hides it.
  function updateObjective(text) {
    var e = cache();
    var el = e && e.objective;
    if (!el || text === lastObjective) return;
    lastObjective = text;
    if (text) {
      el.textContent = text;
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  }

  var radioTimer = null;
  var lastRadio = null;
  // Squad radio line: shows for a few seconds and fades out.
  function radio(text) {
    var e = cache();
    var el = e && e.radio;
    if (!el || !text) return;
    lastRadio = text;
    el.textContent = text;
    el.classList.remove('hidden');
    if (typeof setTimeout === 'function') {
      if (radioTimer) clearTimeout(radioTimer);
      radioTimer = setTimeout(function () {
        if (lastRadio === text) el.classList.add('hidden');
      }, 4500);
    }
  }

  var lastPickupHint = null;
  // Prompt for the item under the player's feet; null hides it.
  function setPickupHint(text) {
    var e = cache();
    var el = e && e.pickupHint;
    if (!el || text === lastPickupHint) return;
    lastPickupHint = text;
    if (text) {
      el.textContent = text;
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  }

  // Brief highlight on a hotbar slot, used when an item is used or missing.
  function flashSlot(number) {
    var e = cache();
    if (!e || !e.inventory) return;
    var slots = e.inventory.children;
    for (var i = 0; i < slots.length; i++) {
      if (slots[i].getAttribute('data-slot') !== String(number)) continue;
      var slot = slots[i];
      slot.classList.add('inv-slot-pulse');
      if (typeof setTimeout === 'function') {
        setTimeout(function () { slot.classList.remove('inv-slot-pulse'); }, 260);
      }
      return;
    }
  }

  return {
    updateHUD: updateHUD,
    show: show,
    hide: hide,
    flashHit: flashHit,
    flashDamage: flashDamage,
    killPopup: killPopup,
    setCannonHint: setCannonHint,
    setPickupHint: setPickupHint,
    updateObjective: updateObjective,
    radio: radio,
    flashSlot: flashSlot,
  };
})();

if (typeof module !== 'undefined') module.exports = { HUD: HUD };

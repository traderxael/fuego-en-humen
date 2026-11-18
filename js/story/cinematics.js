// Cinematic engine: letterboxed sequences with continuous multi-shot 3D stages,
// camera keyframes (pos, look, fov), per-sequence sky/fog atmosphere grading,
// handheld battle shake, shot progress UI, subtitles and historical cards.
//
// Browser global `Cinematics`; also guarded for Node tooling consistency.

var Cinematics = (function () {
  var active = null;
  var DEFAULT_FOV = 52;

  function easeInOut(u) {
    if (u <= 0) return 0;
    if (u >= 1) return 1;
    return u * u * (3 - 2 * u);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function el(id) {
    if (typeof document === 'undefined') return null;
    return document.getElementById(id);
  }

  function showCaption(caption) {
    var card = el('cine-caption');
    if (!card) return;
    if (!caption) {
      card.classList.add('hidden');
      return;
    }
    var tag = card.querySelector('.cine-caption-tag');
    var text = card.querySelector('.cine-caption-text');
    var source = card.querySelector('.cine-caption-source');
    if (tag) tag.textContent = caption.tag || '';
    if (text) text.textContent = caption.text || '';
    if (source) source.textContent = caption.source || '';
    card.classList.remove('hidden');
  }

  function showSubtitle(sub) {
    var box = el('cine-subtitle');
    if (!box) return;
    if (!sub) {
      box.classList.add('hidden');
      return;
    }
    var speaker = box.querySelector('.cine-speaker');
    var line = box.querySelector('.cine-line');
    if (speaker) speaker.textContent = sub.speaker ? sub.speaker + ':' : '';
    if (line) line.textContent = sub.text || '';
    box.classList.remove('hidden');
  }

  function setOverlay(on) {
    var root = el('cinematic');
    if (root) root.classList.toggle('active', !!on);
  }

  function updateProgressUI(stateObj, u) {
    var stepEl = el('cine-step');
    var fillEl = el('cine-progress-fill');
    if (!stateObj || !stateObj.def || !stateObj.def.shots) {
      if (stepEl) stepEl.textContent = '';
      if (fillEl) fillEl.style.width = '0%';
      return;
    }
    var total = stateObj.def.shots.length;
    var idx = Math.max(0, Math.min(total - 1, stateObj.shotIndex));
    if (stepEl) stepEl.textContent = 'Plano ' + (idx + 1) + ' / ' + total;
    var overall = total > 0 ? ((idx + (u || 0)) / total) * 100 : 0;
    if (fillEl) fillEl.style.width = Math.max(0, Math.min(100, overall)).toFixed(1) + '%';
  }

  function cameraState(shot, u) {
    var keys = shot.camera || [];
    if (!keys.length) return null;
    var a = keys[0];
    var b = keys[keys.length - 1];
    for (var i = 0; i < keys.length - 1; i++) {
      if (u >= keys[i].t && u <= keys[i + 1].t) {
        a = keys[i];
        b = keys[i + 1];
        break;
      }
    }
    var span = Math.max(1e-6, b.t - a.t);
    var k = easeInOut((u - a.t) / span);
    var fovA = a.fov != null ? a.fov : DEFAULT_FOV;
    var fovB = b.fov != null ? b.fov : fovA;
    return {
      pos: [
        lerp(a.pos[0], b.pos[0], k),
        lerp(a.pos[1], b.pos[1], k),
        lerp(a.pos[2], b.pos[2], k),
      ],
      look: [
        lerp(a.look[0], b.look[0], k),
        lerp(a.look[1], b.look[1], k),
        lerp(a.look[2], b.look[2], k),
      ],
      fov: lerp(fovA, fovB, k),
    };
  }

  var _look = new THREE.Vector3();

  function applyCamera(camera, state, elapsed, shake, handheld) {
    if (!state || !camera) return;
    var t = elapsed || 0;
    var sx = 0;
    var sy = 0;
    if (handheld && t > 0) {
      sx += Math.sin(t * 1.45) * 0.03;
      sy += Math.cos(t * 1.85) * 0.02;
    }
    if (shake && shake > 0.001) {
      sx += Math.sin(t * 37.0) * shake * 0.22;
      sy += Math.cos(t * 43.0) * shake * 0.16;
    }
    camera.position.set(state.pos[0] + sx, state.pos[1] + sy, state.pos[2]);
    _look.set(state.look[0], state.look[1], state.look[2]);
    camera.lookAt(_look);
    if (state.fov != null && typeof camera.fov === 'number' && Math.abs(camera.fov - state.fov) > 1e-4) {
      camera.fov = state.fov;
      if (typeof camera.updateProjectionMatrix === 'function') camera.updateProjectionMatrix();
    }
  }

  function restoreFov(stateObj) {
    if (!stateObj || !stateObj.ctx || !stateObj.ctx.camera) return;
    var cam = stateObj.ctx.camera;
    if (typeof cam.fov === 'number') {
      cam.fov = stateObj.savedFov || 75;
      if (typeof cam.updateProjectionMatrix === 'function') cam.updateProjectionMatrix();
    }
  }

  function applyAtmosphere(scene, atmo) {
    if (!scene || !atmo) return;
    if (atmo.bg != null) scene.background = new THREE.Color(atmo.bg);
    if (atmo.fogColor != null && typeof THREE.Fog === 'function') {
      scene.fog = new THREE.Fog(atmo.fogColor, atmo.fogNear || 20, atmo.fogFar || 120);
    }
  }

  function restoreAtmosphere(stateObj) {
    if (!stateObj || !stateObj.ctx || !stateObj.ctx.scene) return;
    stateObj.ctx.scene.background = stateObj.savedBg || null;
    stateObj.ctx.scene.fog = stateObj.savedFog || null;
  }

  // --- Sequences ----------------------------------------------------------
  var SEQUENCES = {
    // The destruction of the opium, Humen beach, 3 June 1839.
    'humen-1839': {
      id: 'humen-1839',
      atmosphere: { bg: 0xd8c39e, fogColor: 0xd8c39e, fogNear: 26, fogFar: 130 },
      handheld: false,
      shots: [
        {
          duration: 7,
          camera: [
            { t: 0, pos: [12, 5.4, -24], look: [0, 1.3, -10], fov: 50 },
            { t: 1, pos: [-9, 4.0, -21], look: [0, 1.2, -10], fov: 46 },
          ],
          caption: {
            tag: 'Humen · 3 de junio de 1839',
            text: 'Lin Zexu ha ordenado destruir el opio confiscado. En la playa de Humen se abren las cajas: el opio, mezclado con cal y sal y regado con agua de mar, se vierte al mar con la marea baja.',
            source: 'Wikipedia · Destruction of opium at Humen',
          },
          subtitle: {
            speaker: 'Comisario Lin Zexu',
            text: 'Ni una sola caja regresará intacta al mar. Que la cal y la marea borren este veneno de nuestras costas.',
          },
          audio: 'waveHorn',
          stage: function (ctx) { return Scenes.opiumDestruction(ctx); },
        },
        {
          duration: 8,
          camera: [
            { t: 0, pos: [-7.5, 2.1, -17.8], look: [0, 0.85, -13.5], fov: 44 },
            { t: 1, pos: [6.8, 2.4, -17.2], look: [0, 0.85, -13.5], fov: 42 },
          ],
          caption: {
            tag: 'Veinte días de fuego',
            text: 'La operación dura veintitrés días. El 23 de junio ardieron 19.187 cajas y 2.119 sacos de opio: unas 1.000 toneladas largas. Los comerciantes que lo trajeron miraban desde la orilla.',
            source: 'Wikipedia · Destruction of opium at Humen',
          },
          subtitle: {
            speaker: 'Maestro Xu',
            text: 'El agua turbia hierve con la cal viva; los obreros remueven las tres fosas antes de abrir la compuerta.',
          },
        },
        {
          duration: 7,
          camera: [
            { t: 0, pos: [-4.6, 2.3, -9.8], look: [0, 1.9, -4.8], fov: 42 },
            { t: 1, pos: [3.8, 2.5, -9.5], look: [0, 1.85, -4.8], fov: 39 },
          ],
          caption: {
            tag: 'Los testigos',
            text: 'Las autoridades imperiales observan desde la orilla. Londres responde con cañones: el 7 de enero de 1841 los británicos toman Shajiao y Dajiao tras la segunda batalla de Chuenpi, donde destruyen once junks de la flota meridional.',
            source: 'Wikipedia · Humen / First Opium War',
          },
          subtitle: {
            speaker: 'Sargento Chen',
            text: 'Desde el pabellón, el comisario vigiló cada carga. Meses después respondieron los barcos de hierro.',
          },
        },
        {
          duration: 6,
          camera: [
            { t: 0, pos: [0, 2.8, -20], look: [0, 1.4, -60], fov: 48 },
            { t: 1, pos: [2, 4.4, -32], look: [0, 1.2, -66], fov: 54 },
          ],
          caption: {
            tag: 'Dos años después',
            text: 'Veinte meses y veintitrés días separan la destrucción del opio del asalto de Humen. Esta partida transcurre en la segunda.',
            source: 'Wikipedia · First Opium War',
          },
          audio: 'cannon',
        },
      ],
    },

    // The squadron forces the strait, 23 February 1841.
    'humen-squadron': {
      id: 'humen-squadron',
      atmosphere: { bg: 0x6e8294, fogColor: 0x6e8294, fogNear: 24, fogFar: 135 },
      handheld: true,
      shots: [
        {
          duration: 7,
          camera: [
            { t: 0, pos: [-12, 5.6, -14], look: [0, 2.6, -38], fov: 54 },
            { t: 1, pos: [8, 4.3, -20], look: [0, 2.4, -40], fov: 48 },
          ],
          caption: {
            tag: '23 de febrero de 1841',
            text: 'La escuadra entra en la bocana. Doce navíos británicos contra treinta junks chinos, dos mil hombres, más de quinientas piezas y tres fortalezas.',
            source: 'Wikipedia · Battle of the Bogue',
          },
          subtitle: {
            speaker: 'Vigía de Anunghoy',
            text: '¡Vela y humo en la garganta del río! El vapor de hierro embiste la cadena del Bogue.',
          },
          audio: 'waveHorn',
          stage: function (ctx) { return Scenes.squadronApproach(ctx); },
        },
        {
          duration: 7,
          camera: [
            { t: 0, pos: [-8.5, 2.5, -31], look: [0, 2.5, -38], fov: 46 },
            { t: 1, pos: [-6.0, 3.8, -44], look: [0, 2.6, -36], fov: 44 },
          ],
          caption: {
            tag: 'El paso posterior',
            text: 'El capitán Herbert y el commissioner Elliot navegan en el Nemesis hacia la espalda de Anunghoy con las pinazas del Calliope, Samarang, Herald y Alligator. Se topan con una batería enmascarada de veinte cañones: la toman y la inutilizan. No hay bajas británicas; Herbert calcula veinte o treinta chinos muertos.',
            source: 'Wikipedia · Battle of the Bogue',
          },
          subtitle: {
            speaker: 'Comandante Guan Tianpei',
            text: 'Sus ruedas remontan la corriente sin viento y lanzan cohetes incendarios. ¡Asegurad la batería!',
          },
          audio: 'cannon',
        },
      ],
    },

    // The rear assault, 26 February 1841, 13:30.
    'humen-assault': {
      id: 'humen-assault',
      atmosphere: { bg: 0x4a3528, fogColor: 0x4a3528, fogNear: 18, fogFar: 95 },
      handheld: true,
      shots: [
        {
          duration: 8,
          camera: [
            { t: 0, pos: [2.5, 2.0, 13], look: [0, 2.4, 0], fov: 52 },
            { t: 1, pos: [-4.5, 2.6, 8.5], look: [0, 2.4, 0], fov: 46 },
          ],
          caption: {
            tag: '26 de febrero de 1841 · 13:20',
            text: 'Tras el bombardeo, Senhouse desembarca en la batería sur con unos 300 Royal Marines y marineros. A la 13:30, las fortificaciones están tomadas.',
            source: 'Wikipedia · Battle of the Bogue',
          },
          subtitle: {
            speaker: 'Sargento Chen',
            text: '¡Las hojas del portón ceden bajo los hachazos! ¡Cerrad la brecha en la puerta norte!',
          },
          audio: 'cannon',
          stage: function (ctx) { return Scenes.rearAssault(ctx); },
        },
        {
          duration: 8,
          camera: [
            { t: 0, pos: [-13, 5.2, 10], look: [-2, 3.4, 0.5], fov: 48 },
            { t: 1, pos: [-4.5, 6.2, 7.5], look: [-1, 3.6, 0.2], fov: 45 },
          ],
          caption: {
            tag: 'La escala',
            text: 'Bajo el mayor Thomas Simson Pratt desembarcan 1.037 hombres por la espalda de la fortaleza: los regimientos 26 y 49, el 37.º de Madrás, los Voluntarios de Bengala y los Royal Marines. El mayor Johnstone escala, el capitán Ellis fuerza la puerta.',
            source: 'Wikipedia · Battle of the Bogue / London Gazette · despacho del mayor E. L. Pratt',
          },
          subtitle: {
            speaker: 'Maestro Xu',
            text: 'Apoyan las escalas de bambú contra el granito mientras las balas barren el parapeto.',
          },
          audio: 'explosion',
        },
        {
          duration: 6,
          camera: [
            { t: 0, pos: [-1.8, 5.4, 4.2], look: [0, 5.3, -0.8], fov: 40 },
            { t: 1, pos: [1.2, 5.5, 3.2], look: [0, 5.3, -0.8], fov: 36 },
          ],
          caption: {
            tag: 'La guarnición',
            text: '关天培 sigue en su puesto de tiro. Un soldado le pide que se retire; se niega, entrega su sello a otro para que llegue al emperador y cae allí mismo, en el fuego.',
            source: 'Wikipedia · Guan Tianpei',
          },
          subtitle: {
            speaker: 'Almirante Guan Tianpei',
            text: 'Lleva mi sello al emperador. Yo juré guardar estas baterías con mi vida; no daré un paso atrás.',
          },
        },
      ],
    },

    // The fort is taken: the honest ending.
    'humen-fall': {
      id: 'humen-fall',
      atmosphere: { bg: 0x3b3548, fogColor: 0x3b3548, fogNear: 22, fogFar: 115 },
      handheld: false,
      shots: [
        {
          duration: 8,
          camera: [
            { t: 0, pos: [-1.5, 2.5, 16], look: [-1.5, 2.4, 6.5], fov: 50 },
            { t: 1, pos: [5.5, 3.0, 13], look: [-1.5, 2.4, 6.5], fov: 44 },
          ],
          caption: {
            tag: 'La tarde del 26 de febrero',
            text: 'Se capturaron 339 piezas de artillería, 167 de ellas en Wangtong. Cinco ingleses heridos y mil trescientos chinos rendidos: esa es la cuenta del día.',
            source: 'Wikipedia · Battle of the Bogue',
          },
          subtitle: {
            speaker: 'Maestro Xu',
            text: 'Cañones de bronce clavados sobre sus cureñas rotas; la campana de Humen enmudece bajo otro pabellón.',
          },
          audio: 'cannon',
          stage: function (ctx) { return Scenes.theFall(ctx); },
        },
        {
          duration: 8,
          camera: [
            { t: 0, pos: [3.2, 2.8, 10.5], look: [-2.2, 4.8, -2.0], fov: 44 },
            { t: 1, pos: [-4.5, 6.4, 9.0], look: [-2.2, 4.8, -2.0], fov: 48 },
          ],
          caption: {
            tag: 'Un saludo de minuto',
            text: 'Al día siguiente, la familia del almirante Guan Tianpei reclama su cuerpo y el Blenheim lo despide con un saludo de minuto. Tres años después, la campana que Senhouse capturó en Humen acaba en la iglesia de St Mary’s, en Gosforth (Northumberland), donada por su viuda.',
            source: 'Wikipedia · Guan Tianpei / Battle of the Bogue',
          },
          subtitle: {
            speaker: 'Parte naval del HMS Blenheim',
            text: 'Salva de honor minuto a minuto por el valiente almirante Guan Tianpei, caído frente a su batería.',
          },
        },
        {
          duration: 8,
          camera: [
            { t: 0, pos: [4, 4.8, 10], look: [0, 2.2, -32], fov: 50 },
            { t: 1, pos: [0, 6.5, 14], look: [0, 2.2, -36], fov: 58 },
          ],
          caption: {
            tag: 'Lo que vino después',
            text: 'Humen cayó. Canton se rindió en mayo de 1841 por seis millones de dólares. El Tratado de Nankín, en 1842, cedió Hong Kong a Inglaterra y abrió cinco puertos al comercio occidental.',
            source: 'Wikipedia · First Opium War / Treaty of Nanking',
          },
          subtitle: {
            speaker: 'Maestro Xu',
            text: 'Las murallas de Humen cayeron en un día, pero su memoria permaneció intacta en la piedra.',
          },
        },
      ],
    },
  };

  // --- Player -------------------------------------------------------------
  function start(id, ctx) {
    var def = SEQUENCES[id];
    if (!def) return false;
    stop();
    var cam = ctx && ctx.camera;
    var scn = ctx && ctx.scene;
    var savedFov = (cam && typeof cam.fov === 'number') ? cam.fov : 75;
    var savedBg = (scn && scn.background && typeof scn.background.clone === 'function')
      ? scn.background.clone()
      : (scn ? scn.background : null);
    var savedFog = (scn && scn.fog && typeof scn.fog.clone === 'function')
      ? scn.fog.clone()
      : (scn ? scn.fog : null);

    active = {
      def: def,
      ctx: ctx || {},
      savedFov: savedFov,
      savedBg: savedBg,
      savedFog: savedFog,
      shotIndex: -1,
      shotTime: 0,
      stageTime: 0,
      stage: null,
      waiting: false,
      elapsed: 0,
      shake: 0,
    };
    if (scn && def.atmosphere) applyAtmosphere(scn, def.atmosphere);
    setOverlay(true);
    nextShot();
    return true;
  }

  function nextShot() {
    if (!active) return;
    active.shotIndex++;
    active.shotTime = 0;
    if (active.shotIndex >= active.def.shots.length) {
      finish();
      return;
    }
    var shot = active.def.shots[active.shotIndex];
    showCaption(shot.caption || null);
    showSubtitle(shot.subtitle || null);
    updateProgressUI(active, 0);

    // Keep previous 3D stage alive across shots unless this shot supplies a new stage!
    if (shot.stage && active.ctx.scene) {
      if (active.stage && active.stage.dispose) active.stage.dispose();
      active.stage = shot.stage(active.ctx);
      active.stageTime = 0;
      if (active.stage && active.stage.group && active.ctx.scene) {
        active.ctx.scene.add(active.stage.group);
      }
    }

    applyCamera(active.ctx.camera, cameraState(shot, 0), active.elapsed, active.shake, false);
    if (active.ctx && typeof active.ctx.onShot === 'function') {
      active.ctx.onShot(shot, active.shotIndex);
    }
  }

  function finish() {
    var prev = active;
    var ctx = prev ? prev.ctx : null;
    if (prev && prev.stage && prev.stage.dispose) prev.stage.dispose();
    active = null;
    restoreFov(prev);
    restoreAtmosphere(prev);
    showCaption(null);
    showSubtitle(null);
    updateProgressUI(null, 0);
    setOverlay(false);
    if (ctx && typeof ctx.onEnd === 'function') ctx.onEnd();
  }

  function stop() {
    if (!active) return;
    var prev = active;
    if (prev.stage && prev.stage.dispose) prev.stage.dispose();
    active = null;
    restoreFov(prev);
    restoreAtmosphere(prev);
    showCaption(null);
    showSubtitle(null);
    updateProgressUI(null, 0);
    setOverlay(false);
  }

  function isActive() {
    return !!active;
  }

  function addCineShake(amount) {
    if (!active) return;
    active.shake = Math.min(1.5, Math.max(active.shake || 0, amount || 0.25));
  }

  function update(dt) {
    if (!active) return false;
    var shot = active.def.shots[active.shotIndex];
    if (!shot) { finish(); return false; }
    active.shotTime += dt;
    active.stageTime += dt;
    active.elapsed += dt;
    active.shake = Math.max(0, (active.shake || 0) - dt * 1.8);

    var u = shot.duration > 0 ? Math.min(1, active.shotTime / shot.duration) : 1;
    applyCamera(active.ctx.camera, cameraState(shot, u), active.elapsed, active.shake, !!active.def.handheld);
    updateProgressUI(active, u);

    if (active.stage && active.stage.update) active.stage.update(active.stageTime, dt);

    if (u >= 1) {
      var last = active.shotIndex >= active.def.shots.length - 1;
      if (last && active.ctx.waitForInput) {
        active.waiting = true;
        showSubtitle({ speaker: '', text: active.ctx.continueText || 'Pulsa para continuar' });
        return true;
      }
      nextShot();
    }
    return true;
  }

  // Called from a click or a key press while the engine waits for input.
  function confirm() {
    if (!active || !active.waiting) return false;
    active.waiting = false;
    showSubtitle(null);
    finish();
    return true;
  }

  function advanceOrConfirm() {
    if (!active) return false;
    if (active.waiting) return confirm();
    // Require at least 0.35s on current shot so start click/key doesn't double-skip.
    if (active.shotTime < 0.35) return false;
    nextShot();
    return true;
  }

  function skip() {
    if (!active) return false;
    finish();
    return true;
  }

  return {
    start: start,
    stop: stop,
    update: update,
    confirm: confirm,
    advanceOrConfirm: advanceOrConfirm,
    skip: skip,
    addCineShake: addCineShake,
    isActive: isActive,
    SEQUENCES: SEQUENCES,
  };
})();

if (typeof module !== 'undefined') module.exports = Cinematics;

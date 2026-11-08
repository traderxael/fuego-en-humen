// Cinematic engine: letterboxed sequences with camera keyframes, subtitles
// and historical caption cards.
//
// A sequence is { id, shots: [...] }. A shot is:
//   {
//     duration: seconds,
//     camera:   [ { t, pos: [x,y,z], look: [x,y,z] }, ... ]   (t in 0..1)
//     caption:  { tag, text, source }   historical card, bottom left
//     subtitle: { speaker, text }        dialogue, bottom centre
//     stage:    function(ctx) -> { update(t, dt), dispose() }
//   }
//
// The engine owns the main camera while a sequence runs; the player loop is
// suspended by the caller.
//
// Browser global `Cinematics`; also guarded for Node tooling consistency.

var Cinematics = (function () {
  var active = null;

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
    };
  }

  var _look = new THREE.Vector3();

  function applyCamera(camera, state) {
    if (!state || !camera) return;
    camera.position.set(state.pos[0], state.pos[1], state.pos[2]);
    _look.set(state.look[0], state.look[1], state.look[2]);
    camera.lookAt(_look);
  }

  // --- Sequences ----------------------------------------------------------
  var SEQUENCES = {
    // The destruction of the opium, Humen beach, 3 June 1839.
    'humen-1839': {
      id: 'humen-1839',
      shots: [
        {
          duration: 7,
          camera: [
            { t: 0, pos: [0, 7.5, -44], look: [0, 1.2, -12] },
            { t: 1, pos: [2, 5.0, -30], look: [0, 1.0, -12] },
          ],
          caption: {
            tag: 'Humen · 3 de junio de 1839',
            text: 'Lin Zexu ha ordenado destruir el opio confiscado. En la playa de Humen se abren las cajas: el opio, mezclado con cal y sal y regado con agua de mar, se vierte al mar con la marea baja.',
            source: 'Wikipedia · Destruction of opium at Humen',
          },
          stage: function (ctx) { return Scenes.opiumDestruction(ctx); },
        },
        {
          duration: 8,
          camera: [
            { t: 0, pos: [-7, 1.6, -19], look: [3, 0.7, -11] },
            { t: 1, pos: [5, 2.4, -17], look: [-2, 0.8, -11] },
          ],
          caption: {
            tag: 'Veinte días de fuego',
            text: 'La operación dura veintités días. El 23 de junio ardieron 19.187 cajas y 2.119 sacos de opio: unas 1.000 toneladas largas. Los comerciantes que lo trajeron miraban desde la orilla.',
            source: 'Wikipedia · Destruction of opium at Humen',
          },
        },
        {
          duration: 7,
          camera: [
            { t: 0, pos: [9, 2.6, -3], look: [-3, 1.4, -7] },
            { t: 1, pos: [-2, 2.2, -1], look: [-6, 1.5, -8] },
          ],
          caption: {
            tag: 'Los testigos',
            text: 'Las autoridades imperiales observan desde la orilla. Londres responde con cañones: el 7 de enero de 1841 los británicos toman Shajiao y Dajiao tras la segunda batalla de Chuenpi, donde destruyen once junks de la flota meridional.',
            source: 'Wikipedia · Humen / First Opium War',
          },
        },
        {
          duration: 6,
          camera: [
            { t: 0, pos: [0, 2.4, -8], look: [0, 1.2, -58] },
            { t: 1, pos: [0, 3.2, -14], look: [0, 1.0, -64] },
          ],
          caption: {
            tag: 'Dos años después',
            text: 'Veinte meses y veintités días separan la destrucción del opio del asalto de Humen. Esta partida transcurre en la segunda.',
            source: 'Wikipedia · First Opium War',
          },
        },
      ],
    },

    // The squadron forces the strait, 23 February 1841.
    'humen-squadron': {
      id: 'humen-squadron',
      shots: [
        {
          duration: 7,
          camera: [
            { t: 0, pos: [-13, 3.4, -18], look: [2, 3.0, -50] },
            { t: 1, pos: [-6, 2.6, -26], look: [0, 2.4, -56] },
          ],
          caption: {
            tag: '23 de febrero de 1841',
            text: 'La escuadra entra en la bocana. Doce navíos británicos contra treinta junks chinos, dos mil hombres, más de quinientas piezas y tres fortalezas.',
            source: 'Wikipedia · Battle of the Bogue',
          },
          stage: function (ctx) { return Scenes.squadronApproach(ctx); },
        },
        {
          duration: 7,
          camera: [
            { t: 0, pos: [11, 2.2, -44], look: [-3, 3.2, -68] },
            { t: 1, pos: [4, 4.5, -58], look: [-6, 3.0, -76] },
          ],
          caption: {
            tag: 'El paso posterior',
            text: 'El capitán Herbert y el commissioner Elliot navegan en el Nemesis hacia la espalda de Anunghoy con las pinazas del Calliope, Samarang, Herald y Alligator. Se topan con una batería enmascarada de veinte cañones: la toman y la inutilizan. No hay bajas británicas; Herbert calcula veinte o treinta chinos muertos.',
            source: 'Wikipedia · Battle of the Bogue',
          },
        },
      ],
    },

    // The rear assault, 26 February 1841, 13:30.
    'humen-assault': {
      id: 'humen-assault',
      shots: [
        {
          duration: 8,
          camera: [
            { t: 0, pos: [2, 1.8, 14], look: [0, 3.0, 1] },
            { t: 1, pos: [-6, 2.6, 9], look: [-1, 3.4, 0] },
          ],
          caption: {
            tag: '26 de febrero de 1841 · 13:20',
            text: 'Tras el bombardeo, Senhouse desembarca en la batería sur con unos 300 Royal Marines y marineros. A la 13:30, las fortificaciones están tomadas.',
            source: 'Wikipedia · Battle of the Bogue',
          },
          stage: function (ctx) { return Scenes.rearAssault(ctx); },
        },
        {
          duration: 8,
          camera: [
            { t: 0, pos: [-13, 5.4, 11], look: [1, 3.2, 0] },
            { t: 1, pos: [-4, 6.4, 8], look: [3, 3.0, -1] },
          ],
          caption: {
            tag: 'La escala',
            text: 'Bajo el mayor Thomas Simson Pratt desembarcan 1.037 hombres por la espalda de la fortaleza: los regimientos 26 y 49, el 37.º de Madrás, los Voluntarios de Bengala y los Royal Marines. El mayor Johnstone escala, el capitán Ellis fuerza la puerta.',
            source: 'Wikipedia · Battle of the Bogue / London Gazette · despacho del mayor E. L. Pratt',
          },
        },
        {
          duration: 6,
          camera: [
            { t: 0, pos: [0, 4.2, 6], look: [0, 4.4, -1] },
            { t: 1, pos: [0, 3.4, 4], look: [0, 4.2, -1] },
          ],
          caption: {
            tag: 'La guarnición',
            text: '关天培 sigue en su puesto de tiro. Un soldado le pide que se retire; se niega, entrega su sello a otro para que llegue al emperador y cae allí mismo, en el fuego.',
            source: 'Wikipedia · Guan Tianpei',
          },
        },
      ],
    },

    // The fort is taken: the honest ending.
    'humen-fall': {
      id: 'humen-fall',
      shots: [
        {
          duration: 8,
          camera: [
            { t: 0, pos: [0, 2.4, 17], look: [0, 3.6, 0] },
            { t: 1, pos: [6, 3.2, 12], look: [-2, 3.4, 0] },
          ],
          caption: {
            tag: 'La tarde del 26 de febrero',
            text: 'Se capturaron 339 piezas de artillería, 167 de ellas en Wangtong. Cinco ingleses heridos y mil trescientos chinos rendidos: esa es la cuenta del día.',
            source: 'Wikipedia · Battle of the Bogue',
          },
          stage: function (ctx) { return Scenes.theFall(ctx); },
        },
        {
          duration: 8,
          camera: [
            { t: 0, pos: [-16, 5.5, -22], look: [0, 3.0, 2] },
            { t: 1, pos: [-6, 4.2, -14], look: [0, 3.2, 1] },
          ],
          caption: {
            tag: 'Un saludo de minuto',
            text: 'Al día siguiente, la familia del almirante Guan Tianpei reclama su cuerpo y el Blenheim lo despide con un saludo de minuto. Tres años después, la campana que Senhouse capturó en Humen acaba en la iglesia de St Mary’s, en Gosforth (Northumberland), donada por su viuda.',
            source: 'Wikipedia · Guan Tianpei / Battle of the Bogue',
          },
        },
        {
          duration: 8,
          camera: [
            { t: 0, pos: [0, 3.0, 10], look: [0, 2.6, -30] },
            { t: 1, pos: [0, 3.6, 4], look: [0, 2.4, -40] },
          ],
          caption: {
            tag: 'Lo que vino después',
            text: 'Humen cayó. Canton se rindió en mayo de 1841 por seis millones de dólares. El Tratado de Nankín, en 1842, cedió Hong Kong a Inglaterra y abrió cinco puertos al comercio occidental.',
            source: 'Wikipedia · First Opium War / Treaty of Nanking',
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
    active = {
      def: def,
      ctx: ctx || {},
      shotIndex: -1,
      shotTime: 0,
      stage: null,
      waiting: false,
      elapsed: 0,
    };
    setOverlay(true);
    nextShot();
    return true;
  }

  function nextShot() {
    if (!active) return;
    if (active.stage && active.stage.dispose) active.stage.dispose();
    active.stage = null;
    active.shotIndex++;
    active.shotTime = 0;
    if (active.shotIndex >= active.def.shots.length) {
      finish();
      return;
    }
    var shot = active.def.shots[active.shotIndex];
    showCaption(shot.caption || null);
    showSubtitle(shot.subtitle || null);
    if (shot.stage && active.ctx.scene) {
      active.stage = shot.stage(active.ctx);
      if (active.stage && active.stage.group && active.ctx.scene) {
        active.ctx.scene.add(active.stage.group);
      }
    }
  }

  function finish() {
    var ctx = active ? active.ctx : null;
    if (active && active.stage && active.stage.dispose) active.stage.dispose();
    active = null;
    showCaption(null);
    showSubtitle(null);
    setOverlay(false);
    if (ctx && typeof ctx.onEnd === 'function') ctx.onEnd();
  }

  function stop() {
    if (!active) return;
    if (active.stage && active.stage.dispose) active.stage.dispose();
    active = null;
    showCaption(null);
    showSubtitle(null);
    setOverlay(false);
  }

  function isActive() {
    return !!active;
  }

  function update(dt) {
    if (!active) return false;
    var shot = active.def.shots[active.shotIndex];
    if (!shot) { finish(); return false; }
    active.shotTime += dt;
    active.elapsed += dt;

    var u = shot.duration > 0 ? Math.min(1, active.shotTime / shot.duration) : 1;
    applyCamera(active.ctx.camera, cameraState(shot, u));

    if (active.stage && active.stage.update) active.stage.update(active.shotTime, dt);

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

  return {
    start: start,
    stop: stop,
    update: update,
    confirm: confirm,
    isActive: isActive,
    SEQUENCES: SEQUENCES,
  };
})();

if (typeof module !== 'undefined') module.exports = Cinematics;

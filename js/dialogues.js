// DIALOGUES: dialogue lines for Fuego en Humen (Humen 1841, First Opium War).
// Browser global `DIALOGUES`; also guarded for Node tests / tooling.
//
// Text is Spanish, short on purpose: long lines are for briefing / end screens,
// short lines are for toasts and combat barks. Each entry is plain data so
// screens.js / hud.js can consume it without depending on the whole script.
//
// See docs/dialogos.md for the full script and speaker notes.

var DIALOGUES = (function () {
  var intro = [
    { who: 'Comandante Guan', text: 'Chen. Las bocas ya están cargadas. Hoy cobramos lo de 1839 en plomo.' },
    { who: 'Wei', text: '¡Cañón dos, lista! Necesito ojos en la muralla.' },
    { who: 'Xiao Ping', text: 'El mar se puso negro. ¿Hay barcos de verdad?' },
    { who: 'Comandante Guan', text: 'Defendemos la entrada del río. Que no ceda el aliento.' },
    { who: 'Chen', text: 'A sus órdenes.' },
  ];

  var briefingToast = 'Humen, 1841 — Los británicos desembarcan. ¡A las murallas!';

  // Narrator: Maestro Xu, customs clerk of Humen. He watched Lin Zexu throw
  // the opium into the sea in 1839 and survives to remember 1841. He is not
  // a combatant — he tells the scene from the dock, slowly, as a chronicler.
  var narrator = {
    name: 'Maestro Xu',
    role: 'Escribano de la aduana de Humen',
    voiceStyle: 'Hombre mayor, pausado, tono de cronista de puerto',
    // TTS hints consumed by js/voice.js. No audio assets needed.
    tts: { lang: 'es-ES', rate: 0.92, pitch: 0.85, volume: 1.0 },
    lines: {
      briefing: 'Humen, mil ochocientos cuarenta y uno. Yo, Xu, vi arrojar el opio al mar en mil ochocientos treinta y nueve. Hoy vuelve la escuadra inglesa a cobrarse. Tú estás en la muralla.',
      wave1: 'La primera balsa toca la arena. Los casacas rojas marchan paso doble.',
      wave2: 'La segunda ola trae cañones. La piedra aprenderá a temblar.',
      wave3: 'La última fila ataca la brecha. Si cae la muralla, cae el río.',
      victory: 'El mar se queda sin botes. El fuerte, contra toda razón, sigue en pie.',
      defeatSoldier: 'El soldado cae. Pero la muralla aún guarda el aliento.',
      defeatFort: 'La piedra se abre. El río, esta vez, no nos escucha.',
    },
  };

  var waves = {
    1: {
      toast: 'Oleada 1 — Desembarco en la playa.',
      lines: [
        { who: 'Comandante Guan', text: 'Primera balsa. Mosquetes a la vez. ¡No regalen el disparo!' },
        { who: 'Ben', text: '¡Compañía, formen! ¡Paso doble!' },
      ],
      clear: 'Oleada 1 repelida. Prepárate. Viene la artillería.',
    },
    2: {
      toast: 'Oleada 2 — Cañones en la playa.',
      lines: [
        { who: 'Jack', text: 'Dos grados más… ¡Fuego!' },
        { who: 'Comandante Guan', text: '¡Cañón enemigo en la playa! Es prioridad, Chen.' },
      ],
      clear: 'Oleada 2 repelida. El asalto final entra por la brecha.',
    },
    3: {
      toast: 'Oleada 3 — Asalto a la muralla.',
      lines: [
        { who: 'Comandante Guan', text: 'Esta es la última fila. Si cae la muralla, cae Humen.' },
        { who: 'Mayor Gough', text: 'Cierre lento. Gana quien no se rompe antes.' },
      ],
      clear: 'Resiste. El mar ya se quedó sin botes.',
    },
  };

  var victory = {
    title: 'El fuerte resiste. Humen no cae.',
    lines: [
      { who: 'Comandante Guan', text: 'Escuchen ese silencio. El río sigue nuestro.' },
      { who: 'Wei', text: 'Soldo el cañón dos, comandante. Todavía humea.' },
      { who: 'Xiao Ping', text: '¿Seguimos de guardia?' },
      { who: 'Comandante Guan', text: 'Siempre.' },
    ],
  };

  var defeat = {
    soldier: {
      title: 'Has caído defendiendo la muralla.',
      lines: [
        { who: 'Xiao Ping', text: '¡Chen! ¡Wei, ven! ¡Se desploma!' },
        { who: 'Comandante Guan', text: 'Retírenlo de la muralla. Y denle la playa.' },
      ],
    },
    fort: {
      title: 'El fuerte ha sido tomado por los británicos.',
      lines: [
        { who: 'Comandante Guan', text: 'No hay tierra que aguante esto.' },
        { who: 'Mayor Gough', text: 'Anotad: Humen, 1841.' },
        { who: 'Wei', text: 'Se fue el río…' },
      ],
    },
  };

  // Short combat barks (one line each, safe for HUD/toast).
  // Indexed by moment; `random` would pick one per call in the game loop.
  var barks = {
    chen: {
      shoot: ['Ahí va.'],
      reload: ['Pólvora… manos firmes.'],
      melee: ['Sin bala, sin problema.'],
      killArtillery: ['Fuego apagado.'],
      hurt: ['Tengo el pecho entero.'],
    },
    guan: {
      lowFort: ['La piedra aguanta. Tú también.'],
      criticalFort: ['¡Que les cueste cada ladrillo!'],
    },
    wei: {
      cannon: ['¡Fuego cuando lo tengas delante!'],
      warn: ['¡Cuidado, viene tanta gente que el ruido los esconde!'],
    },
    ping: {
      scared: ['¡Me tiemblan los dedos, pero no los pies!'],
      falling: ['¡Si me caigo, recoge mi gorro!'],
    },
    ben: {
      advance: ['¡Advance!'],
      surprised: ['¡Diablos, apuntan de verdad!'],
      respect: ['Ellos sí que no huyen.'],
    },
    jack: {
      load: ['¡Carga! ¡Que el cañón no era para decorar!'],
      miss: ['¡Le di! …No, fue la piedra.'],
    },
    gough: {
      order: ['No hay gloria en una brecha barata. Tómenla.'],
      doubt: ['No acepto que un fuerte de adobe sea una bahía.'],
    },
  };

  var api = {
    intro: intro,
    briefingToast: briefingToast,
    narrator: narrator,
    waves: waves,
    victory: victory,
    defeat: defeat,
    barks: barks,

    // Narrator line for a wave number (1-based). Null when unknown.
    narrateWave: function (wave) {
      if (wave === 1) return narrator.lines.wave1;
      if (wave === 2) return narrator.lines.wave2;
      if (wave === 3) return narrator.lines.wave3;
      return null;
    },
    // Narrator line for an end-of-game moment.
    narrateEnd: function (moment) {
      if (moment === 'victory') return narrator.lines.victory;
      if (moment === 'soldier') return narrator.lines.defeatSoldier;
      if (moment === 'fort') return narrator.lines.defeatFort;
      return null;
    },

    // Helpers: pick the toast text for a wave (1-based), falling back to the
    // briefing toast when data is missing.
    waveToast: function (wave) {
      var w = waves[wave];
      return w && w.toast ? w.toast : briefingToast;
    },
    waveClear: function (wave) {
      var w = waves[wave];
      return w && w.clear ? w.clear : null;
    },
    // Pick a bark at random from a group when requested.
    bark: function (group, key) {
      var g = barks[group];
      var list = g && g[key];
      if (!list || !list.length) return null;
      return list[Math.floor(Math.random() * list.length)];
    },
  };
  return api;
})();

if (typeof module !== 'undefined') module.exports = { DIALOGUES: DIALOGUES };

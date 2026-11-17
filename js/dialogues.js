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
      wave3: 'La tercera fila asalta el parapeto con escalas. Si cae la muralla, cae el río.',
      wave4: 'El sol cae sobre el estuario. Más botes llegan desde los navíos.',
      wave5: 'La tarde arde en pólvora. Empuja a los marines fuera del muro.',
      wave6: 'Marea humana contra las almenas. Ni un paso atrás en Weiyuan.',
      wave7: 'La noche cubre la bocana. Solo los fogonazos iluminan la playa.',
      wave8: 'Un amanecer roto sobre el río de la Perla. Resistid hasta el relevo.',
      wave9: 'Cuatro cañones enemigos baten el patio. Silenciad las piezas.',
      wave10: 'El último asalto británico. Humen resiste mientras quede un defensor.',
      victory: 'El mar se queda sin botes. El fuerte, contra toda razón, sigue en pie.',
      defeatSoldier: 'El soldado cae. Pero la muralla aún guarda el aliento.',
      defeatFort: 'La piedra se abre. El río, esta vez, no nos escucha.',
    },
  };

  var waves = {
    1: {
      toast: 'Fase 1 — El desembarco en la playa.',
      lines: [
        { who: 'Comandante Guan', text: 'Primera balsa. Mosquetes a la vez. ¡No regalen el disparo!' },
        { who: 'Ben', text: '¡Compañía, formen! ¡Paso doble!' },
      ],
      clear: 'Desembarco contenido. Prepárate. Viene la artillería.',
    },
    2: {
      toast: 'Fase 2 — El bombardeo. Cañones en la playa.',
      lines: [
        { who: 'Jack', text: 'Dos grados más… ¡Fuego!' },
        { who: 'Comandante Guan', text: '¡Cañón enemigo en la playa! Es prioridad, Chen.' },
      ],
      clear: 'Batería silenciada. Se acercan con escalas.',
    },
    3: {
      toast: 'Fase 3 — El asalto a la muralla.',
      lines: [
        { who: 'Comandante Guan', text: 'Esta es la brecha. Si cae la muralla, cae Humen.' },
        { who: 'Mayor Gough', text: 'Cierre lento. Gana quien no se rompe antes.' },
      ],
      clear: 'Asalto repelido. Los navíos lanzan más pinazas.',
    },
    4: { toast: 'Fase 4 — Refuerzos del mar (15:00).', clear: 'Los refuerzos retroceden hacia el agua.' },
    5: { toast: 'Fase 5 — Contraofensiva en el parapeto (16:30).', clear: 'El parapeto vuelve a ser nuestro.' },
    6: { toast: 'Fase 6 — La marea humana (18:00).', clear: 'Cae la tarde; la línea no se ha quebrado.' },
    7: { toast: 'Fase 7 — Noche de fuego en Anunghoy (22:00).', clear: 'La oscuridad no pudo tomar el fuerte.' },
    8: { toast: 'Fase 8 — El amanecer roto (05:00).', clear: 'Sobrevivimos al alba. Prepara la pólvora.' },
    9: { toast: 'Fase 9 — El último asalto (09:00).', clear: 'Un último esfuerzo para cerrar el día.' },
    10: { toast: 'Fase 10 — La resistencia final (12:00).', clear: '¡Humen sigue en pie!' },
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
  var barks = {
    chen: {
      shoot: ['Ahí va.', 'En el blanco.', 'Por la dinastía.'],
      reload: ['Pólvora… manos firmes.', 'Cebando la cazoleta...', 'Bala en el cañón.'],
      melee: ['Sin bala, sin problema.', '¡Afilado para esto!', '¡Sable en mano!'],
      killArtillery: ['Fuego apagado.', 'Cañón silenciado.', 'La playa respira.'],
      hurt: ['Tengo el pecho entero.', '¡Solo es un rasguño!', 'Sigo en pie.'],
      heal: ['Venda apretada. Vuelvo al parapeto.', 'Las hierbas cierran la herida.', 'Aún tengo aliento para luchar.'],
    },
    guan: {
      lowFort: ['La piedra aguanta. ¡Tú también, Chen!'],
      criticalFort: ['¡Que les cueste cada ladrillo! ¡Fuego a discreción!'],
    },
    wei: {
      cannon: ['¡Fuego cuando lo tengas delante!', '¡La mecha está encendida!'],
      warn: ['¡Cuidado, viene tanta gente que el ruido los esconde!'],
    },
    ping: {
      scared: ['¡Me tiemblan los dedos, pero no los pies!'],
      falling: ['¡Si me caigo, recoge mi gorro!'],
    },
    ben: {
      advance: ['¡Advance! Make every musket count!'],
      surprised: ['¡Diablos, apuntan de verdad!'],
      respect: ['Steady lads! They will not give up the wall!'],
    },
    jack: {
      load: ['¡Carga! ¡Que el cañón no era para decorar!'],
      miss: ['¡Le di! …No, fue la piedra.'],
    },
    gough: {
      order: ['No hay gloria en una brecha barata. Tómenla.'],
      doubt: ['No acepto que un fuerte de adobe detenga a la escuadra.'],
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

    narrateWave: function (wave) {
      return narrator.lines['wave' + wave] || null;
    },
    narrateEnd: function (moment) {
      if (moment === 'victory') return narrator.lines.victory;
      if (moment === 'soldier') return narrator.lines.defeatSoldier;
      if (moment === 'fort') return narrator.lines.defeatFort;
      return null;
    },
    waveToast: function (wave) {
      var w = waves[wave];
      return w && w.toast ? w.toast : briefingToast;
    },
    waveClear: function (wave) {
      var w = waves[wave];
      return w && w.clear ? w.clear : null;
    },
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

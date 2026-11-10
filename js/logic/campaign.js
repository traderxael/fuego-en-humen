// Historical campaign layer: one documented episode per wave, the clip that
// introduces it, the intermission card and the epilogue after the fall.
// Pure data + helpers (no DOM, no THREE); browser global and CommonJS.

var Campaign = (function () {
  var WAVES = [
    {
      n: 1,
      name: 'Chuenpi',
      date: '7 de enero de 1841',
      fact: 'La flota de Guan Tianpei, quince juncos y dos mil hombres, defiende los fuertes de Chuenpi y Taikoktow. El vapor Nemesis lanza un cohete Congreve que hace estallar un junco junto al almirante.',
      lesson: 'El Nemesis remonta el río sin viento: sus cohetes alcanzan lo que los cañones de tierra no ven venir.',
      quote: '«El estruendo de los cañones se oyó en Cantón.»',
      objectives: [
        { kind: 'kill', target: 6, label: 'Abate a seis soldados' },
        { kind: 'survive', target: 1, label: 'Aguanta el primer asalto' },
      ],
      radio: {
        start: 'Chen Wei, los juncos están ardiendo. Aguanta el primer choque.',
        objective: 'Seis menos. Sigue así.',
      },
    },
    {
      n: 2,
      name: 'El Bogue',
      date: '23 de febrero de 1841',
      fact: 'Bremer reúne doce barcos ante el Bogue. El Nemesis silencia la batería enmascarada de Anunghoy mientras una cadena de cables con balsas cierra el paso del estrecho.',
      lesson: 'La cadena del Bogue es la última puerta del río: si cae, la escuadra entra hasta Cantón.',
      quote: '«Wellesley, Druid, Blenheim, Melville, Nemesis.»',
      objectives: [
        { kind: 'artillery', target: 1, label: 'Silencia el cañón de asedio' },
        { kind: 'survive', target: 1, label: 'Aguanta el asalto' },
      ],
      radio: {
        start: 'El Nemesis está silenciando la batería. Baja ese cañón, Chen Wei.',
        objective: 'Cañón silenciado. Ahora aguanta la línea.',
      },
    },
    {
      n: 3,
      name: 'Anunghoy',
      date: '23 de febrero de 1841',
      fact: 'Weiyuan (42 cañones) y Jingyuan (60) baten el estrecho desde Anunghoy. Los Royal Marines desembarcan por el flanco mientras la escuadra bombardea de frente.',
      lesson: 'Los fuertes disparan de frente; el desembarco siempre llega por el flanco.',
      quote: '«Tres fuertes, más de 140 cañones, un solo estrecho.»',
      objectives: [
        { kind: 'cannon', target: 2, label: 'Dispara el cañón del fuerte dos veces' },
        { kind: 'survive', target: 1, label: 'Aguanta el asalto' },
      ],
      radio: {
        start: 'Usa el cañón del fuerte: dos andanadas y los desembarcos se retiran. Pulsa E junto a una pieza.',
        objective: 'Buen tiro. No aflojes.',
      },
    },
    {
      n: 4,
      name: 'Wangtong',
      date: '25 de febrero de 1841',
      fact: 'Mil treinta y siete hombres del mayor Pratt desembarcan en North Wangtong. El fuerte Yong\'an (40 cañones) y la obra de 17 piezas caen uno tras otro.',
      lesson: 'Sin reservas en la orilla, cada cañón perdido abre un hueco en la línea.',
      quote: '«La cadena y las balsas ya no guardan el paso.»',
      objectives: [
        { kind: 'kill', target: 12, label: 'Abate a doce soldados' },
        { kind: 'survive', target: 1, label: 'Defiende el portón' },
      ],
      radio: {
        start: 'Mil hombres en la orilla. No dejes que lleguen al portón.',
        objective: 'Doce menos. El portón aguanta.',
      },
    },
    {
      n: 5,
      name: 'Jingyuan',
      date: '26 de febrero de 1841',
      fact: 'Jingyuan resiste el último asalto. El almirante Guan Tianpei muere en el fuerte y trescientos treinta y nueve cañones quedan en manos británicas.',
      lesson: 'El Bogue queda abierto: el camino a Cantón ya no tiene puertas.',
      quote: '«Guan Tianpei murió en su puesto, no en su casa.»',
      objectives: [
        { kind: 'artillery', target: 2, label: 'Silencia las dos piezas de asedio' },
        { kind: 'survive', target: 1, label: 'Resiste hasta el final' },
      ],
      radio: {
        start: 'Guan Tianpei resiste en Jingyuan. Silencia sus dos piezas y aguanta.',
        objective: 'Las piezas están calladas. Solo queda resistir.',
      },
    },
  ];

  var FINAL_WAVE = 5;

  var EPILOGUE = [
    'El 26 de febrero de 1841 cayeron los fuertes de Anunghoy y Wangtong. El almirante Guan Tianpei murió defendiendo Jingyuan y los británicos capturaron trescientos treinta y nueve cañones ese día.',
    'Con el Bogue abierto, la escuadra de Bremer remontó el río hasta Cantón. La Convención de Chuenpi ya había cedido Hong Kong en enero, y el Tratado de Nankín cerró la guerra en 1842.',
    'Este juego es un homenaje a los defensores de Humen: la guarnición resistió cinco asaltos antes de que la historia siguiera su curso.',
  ];

  function waveEntry(n) {
    for (var i = 0; i < WAVES.length; i++) {
      if (WAVES[i].n === n) return WAVES[i];
    }
    return null;
  }

  function clipPath(n) {
    return waveEntry(n) ? 'assets/cinematic/wave' + n + '.mp4' : null;
  }

  function card(n) {
    var entry = waveEntry(n);
    if (!entry) return null;
    return {
      kicker: entry.date + ' · ' + entry.name,
      title: entry.name,
      body: entry.fact,
      lesson: entry.lesson,
      quote: entry.quote,
    };
  }

  function briefing(n) {
    var entry = waveEntry(n);
    if (!entry) return null;
    return {
      kicker: 'Misión ' + n + ' · ' + entry.date,
      title: entry.name,
      body: entry.fact,
      objectives: entry.objectives.map(function (objective) { return objective.label; }),
      radio: entry.radio.start,
    };
  }

  function finalCard() {
    return {
      kicker: '26 de febrero de 1841 · Jingyuan',
      title: 'El Bogue cae',
      body: 'Has rechazado cinco asaltos. Pero el 26 de febrero de 1841 los fuertes de Anunghoy y Wangtong cayeron: Guan Tianpei murió en Jingyuan y la escuadra de Bremer abrió el camino a Cantón.',
      lesson: 'La historia no se negocia: este es el final documentado de la defensa de Humen.',
      quote: '«339 cañones capturados.»',
    };
  }

  return {
    WAVES: WAVES,
    FINAL_WAVE: FINAL_WAVE,
    EPILOGUE: EPILOGUE,
    waveEntry: waveEntry,
    clipPath: clipPath,
    card: card,
    briefing: briefing,
    finalCard: finalCard,
  };
})();

if (typeof module !== 'undefined') {
  module.exports = { Campaign: Campaign };
}

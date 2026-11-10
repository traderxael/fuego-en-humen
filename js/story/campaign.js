// Campaign data: the historical frame of "Fuego en Humen".
//
// Everything the game states as history lives here, with its source, so the
// fiction (the player) and the record (the facts) never get mixed up.
// The player is a fictional defender; every date, number and name around him
// is taken from the historical account.
//
// Browser global `CAMPAIGN`; also guarded for Node tooling consistency.

var CAMPAIGN = (function () {
  var MISSION = {
    id: 'humen-1841',
    index: 1,
    title: 'Los fuertes de Humen',
    kicker: 'Primera Guerra del Opio',
    date: '23 – 26 de febrero de 1841',
    place: 'Boca de Humen (el Bogue) · delta del río de la Perla, Guangdong',
    unit: 'Batería de Weiyuan · guarnición de Guangdong, al mando de 关天培',
    playerRole: 'Tirador de la muralla · literado',
    brief: [
      'Lin Zexu ha hecho destruir el opio. Londres ha enviado cañones. Esta vez no es un bergantín: es la escuadra entera, con sus vapores de hierro y su desembarco.',
      'Los ocho fuertes de Humen guardan la garganta del río de la Perla: sin ellos, la flota puede subir hasta Canton. Ocho baterías, tres mil hombres y trescientos seis cañones contra doce navíos.',
      'Tú estás en la batería de Weiyuan, con el mar a la espalda y el río delante. No ganas la guerra: ganas las horas que la historia tardó en cerrarse.',
    ],
    // The historical record behind the mission.
    facts: [
      {
        tag: '1839',
        text: 'Del 3 al 23 de junio de 1839, en la orilla del río de la Perla frente a Humen, Lin Zexu hizo destruir el opio confiscado a los comerciantes europeos. El opio se vertió en tres fosas con cal y sal, rellenadas con agua de mar, y la mezcla se soltó al mar con la marea baja. El total destruido se cifra en unas 1.000 toneladas largas (1.016 t); el 23 de junio ardieron 19.187 cajas y 2.119 sacos.',
        source: 'Wikipedia · Destruction of opium at Humen (las cifras del artículo oscilan entre 1.016 t y 2.376.254 kg según la fuente citada)',
      },
      {
        tag: 'Humen',
        text: 'La defensa de la boca del río constaba de ocho baterías —Shajiao, Dajiao, Hengdang, Yong’an, Gonggu, Zhenyuan, Jingyuan y Weiyuan— con unos 3.000 hombres y 306 cañones.',
        source: 'Wikipedia · Humen / First Opium War',
      },
      {
        tag: '23 feb 1841',
        text: 'El 23 de febrero, el capitán Herbert, con el commissioner Charles Elliot, navegó en el Nemesis hacia el paso posterior de Anunghoy con las pinazas del Calliope, Samarang, Herald y Alligator. Se toparon con una batería enmascarada de veinte cañones: la tomaron, inutilizaron veinte piezas montadas rompiendo sus ejes y hallaron otras sesenta desmontadas. Sin bajas británicas; Herbert calculó veinte o treinta chinos muertos.',
        source: 'Wikipedia · Battle of the Bogue',
      },
      {
        tag: '26 feb 1841',
        text: 'A la 13:20, tras el bombardeo, Senhouse desembarcó en la batería sur con unos 300 Royal Marines y marineros. A la 13:30 las fortificaciones estaban tomadas.',
        source: 'Wikipedia · Battle of the Bogue',
      },
      {
        tag: '13:30',
        text: 'Bajo el mayor Thomas Simson Pratt (26.º Cameronianos) desembarcaron 1.037 tropas: los regimientos 26 y 49, el 37.º Infantería de Madrás, los Voluntarios de Bengala y los Royal Marines, por la espalda de la fortaleza, desde los vapores Nemesis y Madagascar. El mayor Johnstone guiaba la escala, el capitán Ellis forzaba la puerta, el capitán Duff mandaba el 37.º y el capitán Ince los Voluntarios de Bengala.',
        source: 'Wikipedia · Battle of the Bogue / London Gazette, despacho del mayor E. L. Pratt',
      },
      {
        tag: '26 feb 1841',
        text: 'En minutos, 1.300 chinos se rindieron. Se capturaron 339 piezas de artillería —167 de ellas en Wangtong— y cinco británicos quedaron heridos. La cadena de hierro que cerraba el río fue retirada por los vapores.',
        source: 'Wikipedia · Battle of the Bogue / Engagement Archive · Battle of Humen',
      },
      {
        tag: 'Guan Tianpei',
        text: '关天培 (1781 – 26 de febrero de 1841), comandante en jefe de la fuerza naval de Guangdong, murió en su puesto de tiro. El parte británico: «cayó de una herida de bayoneta en el pecho, al salir al encuentro de su enemigo en la puerta de Anunghoy, entregando su bravo espíritu voluntariamente a una muerte de soldado, cuando su vida solo podía preservarse con la certeza de la deshonra». Su familia reclamó el cadáver al día siguiente y el Blenheim lo despidió con un saludo de minuto.',
        source: 'Wikipedia · Guan Tianpei / Battle of the Bogue',
      },
      {
        tag: 'Verdadero final',
        text: 'El fuerte cayó. Humen se rindió y China pagó seis millones de dólares de rescate por Canton en mayo de 1841. La Primera Guerra del Opio terminó con el Tratado de Nankín (1842): Hong Kong para Inglaterra y cinco puertos abiertos al comercio occidental.',
        source: 'Wikipedia · First Opium War / Treaty of Nanking',
      },
    ],
    // Radio and narration lines, keyed to the mission flow.
    radio: [
      {
        id: 'start',
        speaker: 'Sargento Chen',
        text: '¡A la muralla! Los ingleses han tomado la playa. Que nadie abandone su tronera.',
      },
      {
        id: 'wave2',
        speaker: 'Sargento Chen',
        text: 'Traen cañones de campaña. Si no los callamos, nos bombardearán el fuerte desde el mar.',
      },
      {
        id: 'officer',
        speaker: 'Sargento Chen',
        text: '¡Han caído su oficial! Sin cabeza, la columna se rompe sola. ¡Seguid!',
      },
      {
        id: 'wave3',
        speaker: 'Comandante Guan Tianpei',
        text: 'La cadena del río ya no nos protege. Escribid a la autoridad provincial: si Humen cae, cae la puerta de Canton.',
      },
      {
        id: 'lowFort',
        speaker: 'Sargento Chen',
        text: '¡La muralla se abre! Replegad las piezas de la batería norte. ¡Que no se fisgone el fuerte!',
      },
    ],
    // Story beats that land as historical captions during the mission.
    beats: [
      {
        id: 'landing',
        trigger: { type: 'wave', value: 1 },
        title: '23 de febrero de 1841',
        text: 'La escuadra forzando la bocana. El Nemesis y las pinazas buscan el paso posterior de la isla de Anunghoy: si encuentran la espalda de las baterías, la línea entera se vuelve por tierra.',
        source: 'Wikipedia · Battle of the Bogue',
      },
      {
        id: 'artillery',
        trigger: { type: 'kill', value: 'artillery' },
        title: 'Silencio la artillería',
        text: 'Los cañones de la artillería británica castigaban el fuerte desde la playa. Sin cañones enemigos, la muralla aguanta; con ellos, el fuerte cae por dentro.',
        source: 'Engagement Archive · Battle of Humen',
      },
      {
        id: 'officer',
        trigger: { type: 'kill', value: 'officer' },
        title: 'El oficial de la columna',
        text: 'En el parte del mayor Pratt: 1.037 hombres desembarcados por la espalda, con el mayor Johnstone escalando, el capitán Ellis forzando la puerta, el capitán Duff con el 37.º y el capitán Ince con los Voluntarios de Bengala. Sin guía, el ascenso se convierte en una carrera.',
        source: 'London Gazette · despacho del mayor E. L. Pratt',
      },
      {
        id: 'assault',
        trigger: { type: 'wave', value: 3 },
        title: '26 de febrero de 1841 · 13:20',
        text: 'Tras el bombardeo, Senhouse desembarca en la batería sur con unos 300 Royal Marines y marineros. La cuerda de la escala choca contra la piedra: por primera vez los ingleses están en la muralla.',
        source: 'Wikipedia · Battle of the Bogue',
      },
      {
        id: 'guan',
        trigger: { type: 'guan', value: 1 },
        title: 'El almirante en su puesto',
        text: '关天培 no suelta el cañón. Un soldado le pide que se retire; se niega —rendirse sería traición— y entrega su sello para que llegue al emperador. Un proyectil lo alcanza allí mismo, con cuatrocientos hombres a su lado. Su cuerpo lo reclamará su familia al día siguiente.',
        source: 'Wikipedia · Guan Tianpei',
      },
    ],
    objectives: {
      1: 'Repele el desembarco de la playa',
      2: 'Silencia la artillería enemiga',
      3: 'Resiste hasta el último asalto',
    },
    // Scoring rewards, in the spirit of a Call of Duty streak system but
    // framed in the language of the garrison.
    signals: [
      { id: 'municion', cost: 300, label: 'Munición de reserva', text: 'Cajas de cartuchos de papel desde el almacén del fuerte.' },
      { id: 'reparar', cost: 500, label: 'Reparar la muralla', text: 'Los zapadores rellenan el parapeto con adobe y cestos de tierra.' },
      { id: 'fuego', cost: 750, label: 'Fuego de cañón de reserva', text: 'Una pieza de la batería sur, cargada y con mecha.' },
    ],
  };

  return {
    missions: [MISSION],
    mission: MISSION,
    facts: MISSION.facts,
  };
})();

if (typeof module !== 'undefined') module.exports = CAMPAIGN;

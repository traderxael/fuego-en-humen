// Pure intro script: the short chapters shown over the cinematic on black.
// Browser global script and CommonJS module for Node tests.

var INTRO_BEATS = [
  {
    kicker: 'Humen · Estuario del Río de las Perlas · 1841',
    title: 'El humo del opio',
    body: 'En 1839 el comisionado Lin Zexu hizo destruir en Humen más de mil cajas de opio británico. Londres respondió con una escuadra: en enero de 1841 ya había tomado Chuenpi y Taikoktow, y el Bogue era la última puerta hacia Cantón.',
  },
  {
    kicker: 'La víspera',
    title: 'El último parapeto',
    body: 'Eres Chen Wei, de la guarnición de Anunghoy. Al amanecer verás las velas y las chimeneas del Nemesis. Detrás de ti no hay refuerzos: solo el río, los juncos y las aldeas que dependen de este muro.',
  },
  {
    kicker: 'Tu misión',
    title: 'Resiste cinco oleadas',
    body: 'La escuadra de Bremer viene a tomar el Bogue: doce barcos, tres mil hombres y más de quinientos cañones. Aguanta cinco asaltos y defiende el fuerte de Weiyuan todo lo que la historia permita.',
  },
];

// Step to the next chapter. Stops on the last one and flags the end.
function introAdvance(index, count) {
  if (!count || count <= 0) return { index: 0, done: true };
  var current = Math.max(0, Math.min(count - 1, index || 0));
  var next = current + 1;
  if (next >= count) return { index: count - 1, done: true };
  return { index: next, done: false };
}

function introButtonLabel(index, count) {
  if (count && index >= count - 1) return 'Tomar posición ▸';
  return 'Continuar ▸';
}

if (typeof module !== 'undefined') {
  module.exports = { INTRO_BEATS, introAdvance, introButtonLabel };
}

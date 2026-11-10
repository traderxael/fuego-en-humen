// Best-score persistence: pure parse/merge plus a guarded localStorage
// wrapper. Browser global `Records`; CommonJS for Node tests. Private-mode
// or absent storage degrades to a session-only record, never throws.

var Records = (function () {
  var KEY = 'fuego-en-humen:bestScore';

  function parseRecord(raw) {
    if (raw == null) return 0;
    var n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.floor(n);
  }

  function mergeRecord(best, score) {
    var b = parseRecord(best);
    var s = parseRecord(score);
    return { best: Math.max(b, s), isNew: s > b };
  }

  function load() {
    try {
      if (typeof localStorage === 'undefined') return 0;
      return parseRecord(localStorage.getItem(KEY));
    } catch (e) {
      return 0;
    }
  }

  function save(best) {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(KEY, String(parseRecord(best)));
    } catch (e) { /* storage unavailable: session-only record */ }
  }

  return {
    KEY: KEY,
    parseRecord: parseRecord,
    mergeRecord: mergeRecord,
    load: load,
    save: save,
  };
})();

if (typeof module !== 'undefined') module.exports = Records;
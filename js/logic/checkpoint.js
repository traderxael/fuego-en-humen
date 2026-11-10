// Phase checkpoint for the campaign: the start of each wave snapshots the
// player's state so a defeat can resume from that phase instead of restarting
// the ten-phase assault. Pure logic with injected storage (Node-testable).

var CheckpointLogic = (function () {
  var KEY = 'humen.checkpoint.v1';
  var MAX_WAVE = 10;

  function clampStat(value, max) {
    var number = Math.floor(Number(value));
    if (!Number.isFinite(number)) return max;
    return Math.max(0, Math.min(max, number));
  }

  function load(storage) {
    if (!storage || typeof storage.getItem !== 'function') return null;
    try {
      var raw = storage.getItem(KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || !data.wave) return null;
      return {
        wave: Math.max(1, Math.min(MAX_WAVE, Math.floor(Number(data.wave)))),
        hp: clampStat(data.hp, 100),
        fort: clampStat(data.fort, 100),
        score: Math.max(0, Math.floor(Number(data.score) || 0)),
      };
    } catch (error) {
      return null;
    }
  }

  function save(storage, checkpoint) {
    if (!storage || typeof storage.setItem !== 'function' || !checkpoint) return;
    try {
      storage.setItem(KEY, JSON.stringify({
        wave: Math.max(1, Math.min(MAX_WAVE, Math.floor(Number(checkpoint.wave) || 1))),
        hp: clampStat(checkpoint.hp, 100),
        fort: clampStat(checkpoint.fort, 100),
        score: Math.max(0, Math.floor(Number(checkpoint.score) || 0)),
      }));
    } catch (error) { /* storage blocked: the run simply restarts from phase 1 */ }
  }

  function clear(storage) {
    if (!storage || typeof storage.removeItem !== 'function') return;
    try { storage.removeItem(KEY); } catch (error) { /* ignore */ }
  }

  return { KEY: KEY, MAX_WAVE: MAX_WAVE, load: load, save: save, clear: clear };
})();

if (typeof module !== 'undefined') module.exports = { CheckpointLogic: CheckpointLogic };

// Campaign progress and mission checkpoint, persisted in localStorage.
// Pure logic: the storage is injected so Node tests can use a memory stub.

var ProgressLogic = (function () {
  var KEY = 'humen.campaign.v1';
  var MAX_MISSION = 5;

  function clampMission(n) {
    var value = Math.floor(Number(n) || 1);
    return Math.max(1, Math.min(MAX_MISSION, value));
  }

  function clampStat(value, max) {
    var number = Number(value);
    if (!Number.isFinite(number)) return max;
    return Math.max(0, Math.min(max, number));
  }

  function load(storage) {
    var fallback = { unlocked: 1, checkpoint: null };
    if (!storage || typeof storage.getItem !== 'function') return fallback;
    try {
      var raw = storage.getItem(KEY);
      if (!raw) return fallback;
      var parsed = JSON.parse(raw);
      var checkpoint = parsed && parsed.checkpoint;
      var validCheckpoint = checkpoint && checkpoint.mission
        ? {
            mission: clampMission(checkpoint.mission),
            hp: clampStat(checkpoint.hp, 100),
            fort: clampStat(checkpoint.fort, 100),
            score: Math.max(0, Math.floor(Number(checkpoint.score) || 0)),
          }
        : null;
      return {
        unlocked: clampMission(parsed && parsed.unlocked),
        checkpoint: validCheckpoint,
      };
    } catch (error) {
      return fallback;
    }
  }

  function save(storage, progress) {
    if (!storage || typeof storage.setItem !== 'function' || !progress) return;
    try {
      storage.setItem(KEY, JSON.stringify({
        unlocked: clampMission(progress.unlocked),
        checkpoint: progress.checkpoint || null,
      }));
    } catch (error) { /* storage full or blocked: progress is optional */ }
  }

  function unlock(progress, mission) {
    if (!progress) return;
    var next = clampMission((Number(mission) || 0) + 1);
    progress.unlocked = clampMission(Math.max(progress.unlocked || 1, next));
  }

  function isUnlocked(mission, progress) {
    return clampMission(mission) <= clampMission(progress && progress.unlocked);
  }

  function setCheckpoint(progress, checkpoint) {
    if (!progress || !checkpoint) return;
    progress.checkpoint = {
      mission: clampMission(checkpoint.mission),
      hp: clampStat(checkpoint.hp, 100),
      fort: clampStat(checkpoint.fort, 100),
      score: Math.max(0, Math.floor(Number(checkpoint.score) || 0)),
    };
  }

  function clearCheckpoint(progress) {
    if (progress) progress.checkpoint = null;
  }

  return {
    KEY: KEY,
    MAX_MISSION: MAX_MISSION,
    load: load,
    save: save,
    unlock: unlock,
    isUnlocked: isUnlocked,
    setCheckpoint: setCheckpoint,
    clearCheckpoint: clearCheckpoint,
  };
})();

if (typeof module !== 'undefined') module.exports = { ProgressLogic: ProgressLogic };

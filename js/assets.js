// Embedded GLB registry. Clones own their transforms but share geometry/materials.
var Assets = (function () {
  var cache = new Map();

  function register(name, object3D) {
    if (object3D === null) cache.delete(name);
    else cache.set(name, object3D);
  }

  function has(name) {
    return cache.has(name);
  }

  function clone(name) {
    return has(name) ? cache.get(name).clone(true) : null;
  }

  function load() {
    var embedded = (typeof window !== 'undefined' && window.HUMEN_ASSETS) || {};
    return Promise.all(Object.keys(embedded).map(function (name) {
      return new Promise(function (resolve, reject) {
        var binary = atob(embedded[name]);
        var bytes = new Uint8Array(binary.length);
        for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

        // Embedded resources only: never fall back to network or file:// fetches.
        var manager = new THREE.LoadingManager();
        manager.setURLModifier(function (url) {
          if (!/^(data:|blob:)/i.test(url)) {
            throw new Error('External GLTF resource is not allowed: ' + url);
          }
          return url;
        });
        var loader = new THREE.GLTFLoader(manager);
        loader.parse(bytes.buffer, '', resolve, reject);
      }).then(function (gltf) {
        register(name, gltf.scene);
      }).catch(function (error) {
        console.warn('[Assets] Could not load "' + name + '":', error);
      });
    })).then(function () {});
  }

  return { load: load, register: register, has: has, clone: clone };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Assets;

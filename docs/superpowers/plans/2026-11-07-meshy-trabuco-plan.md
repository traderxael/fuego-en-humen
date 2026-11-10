# Modelos Meshy y trabuco Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar un cañón de bronce y una guarnición qing generados con Meshy, y añadir el trabuco como quinta arma jugable.

**Architecture:** Los GLB de Meshy se normalizan en Blender y se comprometen como base64 dentro de scripts locales. Un GLTFLoader vendorizado los parsea sin red y un registro entrega clones; las primitivas quedan como fallback. El trabuco dispara ocho proyectiles físicos con daño individual y knockback reducido.

**Tech Stack:** Three.js r160 UMD, cannon-es 0.20.0, Meshy MCP, Blender 5.2 headless, Node `node:test`, esbuild 0.28.2.

**Spec:** `docs/superpowers/specs/2026-11-07-meshy-trabuco-design.md`

## Global Constraints

- Trabajar en `C:\Users\USUARIO\Documents\Qoder\2026-11-06\c78ab791`.
- No commits, push ni publicación sin autorización explícita; no tocar los 28 cambios preexistentes salvo los ficheros enumerados.
- Mantener three r160 UMD, ejecución offline y apertura por `file://`; prohibido `fetch` de modelos, texturas o WASM.
- GPU objetivo GT 640 / 2 GB; sin luces nuevas y con clones que comparten recursos GPU.
- No generar textos con claves ni exponer `MESHY_API_KEY`.
- Cada cambio de lógica se prueba con `node --test`; no marcar una tarea completa con tests rojos.

---

### Task 1: Trabuco en configuración, armería y combate

**Files:**
- Modify: `js/logic/config.js:7-46`
- Modify: `js/logic/armory.js:4-24`
- Modify: `js/player.js:155-244,455-505`
- Modify: `js/physics.js:288-313,463-497`
- Modify: `js/enemies.js:322-344`
- Modify: `js/main.js:46-64`
- Modify: `js/screens.js:48-79`
- Modify: `index.html:78`
- Test: `tests/armory.test.js`, `tests/logic.test.js`, `tests/physics-world.test.js`

**Interfaces:**
- Consumes: `WEAPONS`, `ARMORY_ORDER`, `physics.fireMusket`, `Enemies.applyHit`.
- Produces: `WEAPONS.trabuco`; `physics.fireShotgun(opts) -> projectile[]`; `armoryEntries` incluye `pellets`; `kind === 'shotgun'`.

- [ ] **Step 1: Convertir las expectativas de cuatro armas a cinco y escribir el test del trabuco**

En `tests/armory.test.js` cambiar las tres expectativas `4` por `5` y añadir:

```js
test('el trabuco entra en la armería con ocho perdigones', () => {
  const entries = armoryEntries(WEAPONS);
  const trabuco = entries.find((e) => e.key === 'trabuco');
  assert.ok(trabuco);
  assert.strictEqual(trabuco.type, 'rifle');
  assert.strictEqual(trabuco.damage, 22);
  assert.strictEqual(trabuco.pellets, 8);
  assert.strictEqual(trabuco.clipSize, 1);
  assert.strictEqual(trabuco.reloadTime, 2.8);
});
```

En `tests/logic.test.js` añadir una guarda de `spread: 0.07` y `fireCooldown: 1.15`.

- [ ] **Step 2: Ejecutar y comprobar el rojo**

Run: `node --test tests/armory.test.js tests/logic.test.js`
Expected: FAIL por longitud 4 y por ausencia de `WEAPONS.trabuco`.

- [ ] **Step 3: Añadir el arma y sus datos de presentación**

Insertar en `WEAPONS` la definición exacta de la spec. Añadir `'trabuco'` al final de `ARMORY_ORDER`, propagar `pellets` en `armoryEntries`, añadir un icono de boca ancha en `WEAPON_ICONS.trabuco` y esta rama en `statLine`:

```js
if (entry.pellets > 1) {
  return entry.pellets + ' × ' + entry.damage + ' daño · Carga ' + entry.clipSize +
    ' · Recarga ' + entry.reloadTime + ' s';
}
```

Actualizar el hint de `index.html` a `1`–`5`.

- [ ] **Step 4: Ejecutar los tests de datos**

Run: `node --test tests/armory.test.js tests/logic.test.js`
Expected: PASS.

- [ ] **Step 5: Escribir el test físico de ocho perdigones**

En `tests/physics-world.test.js`, con el mundo real de pruebas y `effects: null`, añadir:

```js
test('el trabuco crea ocho proyectiles shotgun dentro del cono', () => {
  const physics = GamePhysics.create(scene, world, null);
  const shots = physics.fireShotgun({
    from: { x: 0, y: 1.7, z: 0 },
    dir: { x: 0, y: 0, z: -1 },
    spread: 0.07,
    damage: 22,
    pellets: 8,
    owner: 'player',
  });
  assert.strictEqual(shots.length, 8);
  for (const shot of shots) {
    assert.strictEqual(shot.kind, 'shotgun');
    assert.strictEqual(shot.damage, 22);
    assert.strictEqual(shot.trail, null);
    const len = Math.hypot(shot.vel.x, shot.vel.y, shot.vel.z);
    assert.ok(len > 0);
  }
});
```

Run: `node --test tests/physics-world.test.js`
Expected: FAIL porque `fireShotgun` no existe.

- [ ] **Step 6: Implementar perdigones y knockback acotado**

Extraer el cuerpo actual de `fireMusket` a un creador interno que acepte `kind` y `withTrail`. Mantener `fireMusket` como wrapper de un proyectil con estela. Implementar:

```js
function fireShotgun(opts) {
  var out = [];
  var count = opts.pellets || 8;
  for (var i = 0; i < count; i++) {
    out.push(fireMusket({
      from: opts.from,
      dir: opts.dir,
      spread: opts.spread,
      damage: opts.damage,
      owner: opts.owner,
      kind: 'shotgun',
      withTrail: false,
    }));
  }
  return out;
}
```

El creador interno usa `kind: opts.kind || 'musket'` y `trail: opts.withTrail === false ? null : ...`. En `handleHit`, propagar `proj.kind` en vez del literal `'musket'`. En `Enemies.applyHit` añadir `kind === 'shotgun' ? 0.1` al cálculo de fuerza. En `main.js`, omitir `sfxCall('hit')` para ese kind.

- [ ] **Step 7: Añadir viewmodel y disparo del jugador**

Crear un grupo `trabuco` con culata corta y boca ancha, registrarlo en `viewmodels` y cambiar la rama de fuego:

```js
if (def.pellets > 1) {
  physics.fireShotgun({
    from: { x: muzzlePoint.x, y: muzzlePoint.y, z: muzzlePoint.z },
    dir: { x: forwardVec.x, y: forwardVec.y, z: forwardVec.z },
    spread: def.spread + spread,
    damage: def.damage,
    pellets: def.pellets,
    owner: 'player',
  });
} else {
  physics.fireMusket({ /* llamada actual, sin cambios */ });
}
```

Mantener una sola resta de munición, un cooldown y una recarga.

- [ ] **Step 8: Ejecutar toda la suite**

Run: `node --test tests/*.test.js`
Expected: todos PASS.

---

### Task 2: Generar los dos modelos Meshy y normalizarlos

**Files:**
- Create: `tools/blender/meshy_to_glb.py`
- Create: `tools/models/embed_glb.mjs`
- Create: `assets/models/cannon.model.js` (generado)
- Create: `assets/models/qing.model.js` (generado)
- External temp: `C:\Users\USUARIO\AppData\Local\Temp\fuego-humen-meshy\`

**Interfaces:**
- Consumes: tareas Meshy `text-to-image` e `image-to-3d`.
- Produces: `window.HUMEN_ASSETS.cannon` y `.qing`, strings base64 de GLB sin Draco.

- [ ] **Step 1: Generar y revisar la imagen del cañón**

Prompt: «Antique Chinese coastal fort cannon, 1841, long cast-bronze barrel with restrained decorative rings and patina, dark wooden naval carriage with four small wheels, historically plausible, stylized low-poly game asset, three-quarter side view, entire object visible, neutral gray background, no people, no text».

Usar `meshy_text_to_image` con `ai_model: nano-banana-2`, `aspect_ratio: 1:1`, `remove_background: true`. Descargar la imagen a la carpeta temporal y revisarla con `Read`. Si no es un cañón reconocible y completo, corregir el prompt antes de continuar.

- [ ] **Step 2: Generar y revisar la imagen del soldado qing**

Prompt: «Qing dynasty Chinese infantryman from 1841, blue robe, lamellar armor over chest and shoulders, conical straw helmet, holding a musket lowered, historically plausible, full body, standing A-pose, stylized low-poly game character, neutral gray background, no text».

Usar `nano-banana-2-lite`, `pose_mode: a-pose`, `remove_background: true`. Revisar cuerpo completo y ausencia de miembros extra.

- [ ] **Step 3: Generar y descargar los GLB**

Para cada imagen aprobada llamar a `meshy_image_to_3d` con `input_task_id`, `ai_model: meshy-t2.5`, `model_type: smart-topology`, `texture_model: meshy-7`, `enable_pbr: true`, `target_formats: ['glb']`, `origin_at: bottom`. Usar `target_polycount: 8000` para el cañón y `12000` para el qing; el soldado lleva además `pose_mode: a-pose`. Descargar con `meshy_download_model(format: 'glb')` a la carpeta temporal. Consultar `meshy_check_balance` al final y anotar el gasto real.

- [ ] **Step 4: Escribir el conversor Blender**

`tools/blender/meshy_to_glb.py` acepta `-- --input <glb> --output <glb> --kind cannon|qing`. Importa con `bpy.ops.import_scene.gltf`, aplica transforms, decima a los presupuestos, normaliza altura (qing 1.75 m) o longitud (cañón 2.2 m), coloca la base en Z=0, reescala imágenes a máximo 1024 px y exporta:

```python
bpy.ops.export_scene.gltf(
    filepath=args.output,
    export_format='GLB',
    export_apply=True,
    export_draco_mesh_compression_enable=False,
    export_image_format='AUTO',
)
```

La orientación del cañón se fija con la boca a lo largo de Blender `+Y` (glTF `-Z`), corregido tras comprobar la conversión de ejes del exportador. No adivinarla: comprobar primero los bounds del GLB importado y ajustar la rotación explícita del script.

- [ ] **Step 5: Ejecutar Blender y validar el GLB**

Run: `"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup --python tools/blender/meshy_to_glb.py -- --input <temp/cannon.glb> --output <temp/cannon.clean.glb> --kind cannon`
Expected: `GLB_OK`, archivo existente, sin `KHR_draco_mesh_compression` en su chunk JSON.

- [ ] **Step 6: Empaquetar los GLB como scripts**

`tools/models/embed_glb.mjs` recibe `<input.glb> <assetName> <output.js>` y escribe:

```js
window.HUMEN_ASSETS = window.HUMEN_ASSETS || {};
window.HUMEN_ASSETS['cannon'] = '<base64>';
```

Validar longitud, prefijo `glTF` al decodificar y tamaño final. Repetir para `qing`. No commitear los GLB temporales.

---

### Task 3: Vendorizar GLTFLoader y crear el registro de assets

**Files:**
- Create: `vendor/gltfloader.min.js`
- Create: `tools/models/build_loader.mjs`
- Create: `js/assets.js`
- Modify: `vendor/README.md`
- Modify: `index.html:111-113`
- Test: `tests/assets.test.js`

**Interfaces:**
- Consumes: `window.HUMEN_ASSETS`, `THREE.GLTFLoader`.
- Produces: `Assets.load() -> Promise<void>`, `Assets.has(name) -> boolean`, `Assets.clone(name) -> THREE.Object3D|null`, `Assets.register(name, object3D)`.

- [ ] **Step 1: Escribir el test del registro**

```js
const THREE = require('../vendor/three.min.js');
global.THREE = THREE;
const Assets = require('../js/assets');

test('el registro entrega clones independientes que comparten geometría', () => {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const original = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  Assets.register('test-box', original);
  const a = Assets.clone('test-box');
  const b = Assets.clone('test-box');
  assert.ok(Assets.has('test-box'));
  assert.notStrictEqual(a, b);
  assert.strictEqual(a.geometry, b.geometry);
  a.position.x = 4;
  assert.strictEqual(b.position.x, 0);
  assert.strictEqual(Assets.clone('missing'), null);
});
```

Run: `node --test tests/assets.test.js`
Expected: FAIL porque el módulo no existe.

- [ ] **Step 2: Implementar `js/assets.js`**

Mantener un mapa `cache`. `register` guarda el objeto; `clone` hace `.clone(true)`; `has` comprueba presencia. `load()` recorre `window.HUMEN_ASSETS`, decodifica base64 a `Uint8Array`, llama a `loader.parse(buffer, '', onLoad, onError)` y registra `gltf.scene`. Cada asset se captura por separado: error → `console.warn` y continuar. `Promise.all` resuelve siempre. Añadir guarda CommonJS para tests.

- [ ] **Step 3: Reproducir el bundle validado**

`tools/models/build_loader.mjs` instala sólo en una carpeta temporal `three@0.160.0` y `esbuild@0.28.2`, genera el shim de todos los imports de `GLTFLoader.js` y `BufferGeometryUtils.js`, y ejecuta el binario esbuild con `--bundle --format=iife --alias:three=<shim> --minify`. El entry añade `globalThis.THREE.GLTFLoader = GLTFLoader`. Copiar el resultado a `vendor/gltfloader.min.js`.

Documentar en `vendor/README.md` que se requiere red sólo para reconstruir el vendor, no para jugar.

- [ ] **Step 4: Verificar el bundle con el loader real**

Cargar `vendor/three.min.js`, `vendor/gltfloader.min.js` y un `assets/models/cannon.model.js` en un único realm Node, en ese orden, y parsear. Assert: `THREE.REVISION === '160'`, `gltf.scene.children.length > 0` y al menos una malla.

- [ ] **Step 5: Añadir scripts a `index.html` y ejecutar tests**

Orden: `three.min.js`, `gltfloader.min.js`, `cannon-es.min.js`, los dos `.model.js`, `js/assets.js`, luego el resto. Run: `node --test tests/*.test.js`. Expected: PASS.

---

### Task 4: Integrar modelos, guarnición y arranque

**Files:**
- Modify: `js/models.js:189-218,259-268`
- Modify: `js/world.js:218-234,306-330`
- Modify: `js/main.js:1-200`
- Test: `tests/models.test.js`

**Interfaces:**
- Consumes: `Assets.has/clone/load`.
- Produces: `Models.makeCannon()` con fallback; `world.garrison` y balanceo en `world.update`; arranque que no permite comenzar antes de construir el mundo.

- [ ] **Step 1: Escribir test de preferencia y fallback**

```js
test('makeCannon usa el asset registrado y conserva su tipo', () => {
  const original = new THREE.Group();
  original.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
  Assets.register('cannon', original);
  const cannon = Models.makeCannon();
  assert.strictEqual(cannon.userData.type, 'cannon');
  assert.ok(cannon.children.length > 0);
  Assets.register('cannon', null);
  const fallback = Models.makeCannon();
  assert.strictEqual(fallback.userData.type, 'cannon');
});
```

Ajustar el helper de limpieza del test para que `register(name, null)` elimine la entrada.

- [ ] **Step 2: Añadir preferencia por asset en `Models.makeCannon`**

Si `typeof Assets !== 'undefined' && Assets.has('cannon')`, clonar, asignar `userData.type = 'cannon'`, activar sombras en las mallas y devolver. Si no, ejecutar el constructor procedural intacto.

- [ ] **Step 3: Añadir la guarnición**

En `buildWorld`, si `Assets.has('qing')`, crear los seis clones de la spec, añadirlos a `fort` y guardarlos en `garrison`. En `update(t)` aplicar a cada uno `rotation.z = Math.sin(t * 0.8 + index) * 0.008`. Incluir `garrison` en el retorno del mundo.

- [ ] **Step 4: Hacer el arranque tolerante a carga asíncrona**

Iniciar `Assets.load()` al entrar en `main.js`. Mostrar la intro antes de esperar. Deshabilitar `#btn-armory-start` y ponerle texto `Cargando modelos…`. Tras resolver (también con fallos parciales), construir mundo, física, jugador y enemigos, iniciar `animate()`, reactivar el botón y restaurar `Comenzar el asalto`. Los listeners de menú no deben llamar a `player` antes de que exista.

- [ ] **Step 5: Ejecutar suite y comprobar fallback**

Run: `node --test tests/*.test.js`.
Expected: PASS. Además borrar temporalmente el registro `qing` en una prueba Node y verificar que `buildWorld` no lanza.

---

### Task 5: Documentación y verificación en navegador

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-11-07-meshy-trabuco-design.md` (resultados reales)
- Test: verificación E2E documentada en el resumen final

**Interfaces:**
- Consumes: juego servido en `http://localhost:8820/?debug=1`.
- Produces: evidencia separada de probado y pendiente.

- [ ] **Step 1: Actualizar README y créditos**

Documentar cinco armas, tabla del trabuco, teclas `1`–`5`, guarnición, pipeline Meshy→Blender→base64 y crédito Meshy. Sustituir la afirmación de ausencia total de assets externos por la descripción exacta del contenido procedural y generado.

- [ ] **Step 2: Levantar o reutilizar el servidor**

Comprobar `curl http://localhost:8820/js/assets.js`. Si no responde el repo vivo, usar otro puerto con `python -m http.server` desde el repo y anotarlo. No matar procesos ajenos.

- [ ] **Step 3: Ejecutar el juego en Chrome real**

Con Chrome DevTools MCP, abrir `http://localhost:8820/?debug=1`, saltar intro por DOM, abrir armería y comprobar cinco tarjetas. Capturar consola. Iniciar partida y verificar:

```js
({
  cannons: __world.cannons.length,
  garrison: __world.garrison.length,
  weaponOrder: ARMORY_ORDER.slice(),
  rendererCalls: __game.renderer.info.render.calls,
  triangles: __game.renderer.info.render.triangles,
})
```

Esperar: 4 cañones, 6 qing, `trabuco` presente, sin errores.

- [ ] **Step 4: Verificar disparo del trabuco**

Equipar `trabuco`, fijar fase `playing`, llamar al disparo y contar los proyectiles `kind === 'shotgun'`. Esperar 8 y una sola munición consumida. Confirmar recarga y cambio por tecla `5` con evento DOM, marcando explícitamente que es evidencia scripted.

- [ ] **Step 5: Medir FPS antes/después y revisar apariencia**

Medir `requestAnimationFrame` durante al menos 120 frames con el mismo punto de vista. Si la regresión supera 25%, reducir texturas/polycount y repetir. Tomar captura del fuerte y revisar escala/orientación de cañón y soldados; corregir en Blender si están girados o flotando.

- [ ] **Step 6: Ejecutar la suite final y reportar**

Run: `node --test tests/*.test.js`.
Reportar por separado: tests Node, checks DOM/WebGL, captura visual, FPS medidos y cualquier aspecto no verificado. No commitear ni publicar.

## Self-Review

- Cobertura: pipeline, loader, cañón, guarnición, trabuco, documentación y verificación tienen tarea propia.
- Consistencia: `Assets.load/has/clone/register`, `physics.fireShotgun`, `kind: 'shotgun'` y `world.garrison` se usan con los mismos nombres en todas las tareas.
- Decisiones explícitas: sin Draco, sin red, fallback a primitivas, ocho perdigones, daño 22, cono 0.07 rad, seis clones qing y cero commits automáticos.

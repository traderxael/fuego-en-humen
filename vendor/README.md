# Vendor

## cannon-es 0.20.0

Motor de física 3D (MIT). Se usa como script global `CANNON`, sin módulos ES,
para que `index.html` siga funcionando con doble clic y sin conexión.

Origen: `cannon-es@0.20.0` (npm), empaquetado con esbuild 0.28.2:

    npm install --no-save cannon-es@0.20.0 esbuild@0.28.2
    npx esbuild node_modules/cannon-es/dist/cannon-es.js \
      --bundle --format=iife --global-name=CANNON --minify \
      --outfile=vendor/cannon-es.min.js

El archivo generado se compromete al repositorio: no hace falta ejecutar el
build para jugar.

## three.min.js

Three.js r160 (MIT), ya presente en el proyecto. No se modifica.

## gltfloader.min.js

GLTFLoader y la utilidad `toTrianglesDrawMode` de BufferGeometryUtils de
`three@0.160.0` (MIT), empaquetados con `esbuild@0.28.2`. La licencia de Three.js
se conserva en la cabecera del bundle. Es un IIFE que añade `THREE.GLTFLoader`
al Three.js global r160 existente; no incluye otra copia de Three.js ni necesita
módulos ES en runtime.

Reconstrucción desde la raíz del proyecto, con Node.js y npm disponibles:

```sh
node tools/models/build_loader.mjs
```

La receta instala las versiones fijadas **sólo en una carpeta temporal**, sin
postinstall ni nuevas dependencias/package-lock en el repositorio. Extrae los
67 nombres importados de Three.js por GLTFLoader y BufferGeometryUtils, genera
un shim que los obtiene de `globalThis.THREE` y ejecuta el binario nativo de
esbuild con `--bundle --format=iife --alias:three=<shim> --minify`. Copia el
resultado a `vendor/gltfloader.min.js` y elimina la carpeta temporal incluso
si el build falla. Se requiere red sólo para reconstruir el vendor, no para jugar.

Orden de scripts clásicos: `three.min.js`, `gltfloader.min.js`, `cannon-es.min.js`,
`assets/models/cannon.model.js`, `assets/models/qing.model.js`, `js/assets.js`,
luego el resto del juego. Los `.model.js` proporcionan GLB base64 en
`window.HUMEN_ASSETS`; `Assets.load()` decodifica y usa `loader.parse`, nunca
`loader.load`. Los recursos deben estar embebidos: se rechazan rutas/URLs
externas; no se instalan decodificadores Draco/KTX2/Meshopt ni se descarga WASM.
Así funciona también desde `file://`, sin servidor ni conexión.

`Assets.register(name, object3D)` guarda la plantilla y `register(name, null)` la
elimina; `Assets.clone(name)` devuelve `clone(true)` o `null`. Los clones tienen
transformaciones/jerarquías independientes, pero comparten geometría y material
(no deben destruirse ni modificarse como si fueran exclusivos de un clon).
La carga devuelve `Promise<void>` aun sin assets; cada error genera un warning
identificando el asset, sin impedir la carga de los demás. No se amplía aquí
la clonación de esqueletos animados: se usa la semántica estándar de `clone(true)`.

Verificación focal, sin red ni dependencias adicionales:

```sh
node --test tests/assets.test.js
```

Los tests evalúan Three.js, el loader y los buffers en el mismo realm: pasar un
`ArrayBuffer` de otro contexto Node rompe el `instanceof ArrayBuffer` del loader.
El warning de deprecación del UMD de Three.js ya existía y no se silencia.

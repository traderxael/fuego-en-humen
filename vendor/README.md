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

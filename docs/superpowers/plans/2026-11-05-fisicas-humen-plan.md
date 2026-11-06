# Plan — Físicas realistas en Fuego en Humen

## 1. Vendor y base

- [x] Generar `vendor/cannon-es.min.js` (cannon-es 0.20.0 + esbuild, IIFE
      global `CANNON`) y documentar la regeneración en `vendor/README.md`.
- [x] `js/logic/physics.js` + `tests/physics.test.js`.
- [x] `world.colliders` en `js/world.js` (muros, torre y los 4 cañones).
- [x] Suelo como caja estática: el raycast de cannon-es no detecta
      `CANNON.Plane` (AABB infinita), y toda la balística usa raycasts.

## 2. Mundo físico y efectos

- [x] `js/effects.js` (sprites, trazadoras, escombros visuales, shake).
- [x] `js/physics.js` (cannon world, cuerpos, proyectiles, impactos, área).
- [x] Tests de integración en Node con cannon-es + Three.js reales:
      bala alcanza enemigo, muro bloquea, cañón impacta cerca del objetivo,
      jugador no atraviesa un muro, ragdoll, LOS, área y daño al fuerte.
- [x] Fricción 0 en contactos de personajes: la fricción box-box de cannon-es
      anulaba la velocidad de avance de la IA.

## 3. Jugador

- [x] Cuerpo, inercia, gravedad, salto, colisión, cámara y aterrizaje.
- [x] Disparo balístico + dispersión + fogonazo + retroceso + audio.
- [x] Melee con LOS e impulso; cañón usable con `E` y aviso HUD.
- [x] HUD: aviso de cañón y viñeta de daño.
- [x] Parapeto visual a 1,5 m (antes 1,8 m): con ojos a 1,7 m tapaba la playa.

## 4. Enemigos

- [x] Cuerpos + IA física + separación + giro suave.
- [x] Disparo con proyectil y LOS (apuntan a la parte alta para pasar el
      parapeto); artillería con cañonazo balístico.
- [x] `applyHit`, aturdimiento, muerte con ragdoll y cadáveres (12 s).
- [x] Callbacks de daño al fuerte/jugador conectados a `main.js`.

## 5. Integración y ajuste

- [x] `main.js`: orden update jugador → IA → physics → efectos → cámara.
- [x] Audio: `cannon`, `explosion`, `step`.
- [x] README, controles y `?debug=1` con referencias para pruebas.
- [x] Mar movido a la línea de costa real (z ≈ -45); la playa de desembarco
      ya no está bajo el agua.

## 6. Verificación

- [x] `node --test` — 31/31 tests (lógica, física pura, mundo físico, IA).
- [x] Partida real en Chrome headless con WebGL: 17/17 comprobaciones
      (movimiento, salto, colisión, disparo, IA, muerte, cañón, explosión,
      HUD, rendimiento, consola limpia).
- [x] Flujo de oleadas completo verificado hasta victoria, con artillería
      enemiga dañando el fuerte al impactar.
- [x] `physics.step` ≈ 2 ms con 34 cuerpos; capturas en `.vendor-build/shots`.

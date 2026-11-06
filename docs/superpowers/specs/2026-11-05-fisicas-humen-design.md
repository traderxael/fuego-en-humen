# Diseño — Físicas realistas para Fuego en Humen

Fecha: 2026-11-05
Base: `traderxael/fuego-en-humen` (FPS Three.js r160, sin build).

## Objetivo

Sustituir el movimiento cinemático y el combate por hitscan por una simulación
física coherente: inercia, gravedad, colisiones, proyectiles balísticos,
retroceso, muertes con cuerpo físico y cañones usables. El juego debe seguir
funcionando abriendo `index.html` sin conexión ni build en runtime.

## Decisiones

1. **cannon-es 0.20.0 vendorizado** como `vendor/cannon-es.min.js`
   (IIFE con global `CANNON`, generado con esbuild y comprometido en el repo).
   No hay CDN ni módulos ES: los `<script>` locales siguen siendo el contrato.
2. **Balística por raycast con subpasos**, no cuerpos rígidos para proyectiles.
   cannon-es no trae CCD y una bala a 320 m/s atravesaría muros de 1,4 m.
   Cada proyectil avanza en tramos de ≤1,25 m y consulta `world.raycastClosest`
   con máscaras de colisión (mundo / jugador / enemigo).
3. **Cuerpos rígidos** para jugador (caja fija sin rotación), soldados (cajas),
   artillería (cuerpo estático), cadáveres (dinámicos) y escombros (cajas
   pequeñas). La IA fija velocidades horizontales; el solver resuelve
   colisiones, empujes y separación.
4. **Partículas propias** (sprites con texturas generadas por canvas): humo,
   fogonazo, polvo, chispas y trazadoras. Los escombros usan cuerpos cannon.
5. **Cañones del fuerte usables** con `E` cuando el jugador está cerca: apuntan
   con la vista, disparan una bala explosiva de área y tienen recarga.

## Componentes

### `js/logic/physics.js` (puro, testeable en Node)

- `GRAVITY`, `ballisticVelocity(from, to, speed, g)`.
- `stepProjectile(pos, vel, dt, g)`.
- `spreadDirection(dir, spreadRad, randA, randB)`.
- `falloff(distance, radius)`.
- `clamp`.

### `js/physics.js` (mundo cannon)

- `GamePhysics.create(scene, world, effects)`.
- Grupo de colisión: `WORLD=1, PLAYER=2, ENEMY=4, DEBRIS=8`.
- Colliders estáticos desde `world.colliders` (muros, torre, cañones).
- Suelo: `CANNON.Plane` en y=0.
- Cuerpo del jugador: caja 0,7×1,8×0,7, centro y=0,9, rotación fija,
  fricción 0; cámara = centro + 0,8.
- Soldados: caja 0,7×1,8×0,7, centro y=0,9, rotación fija mientras viven.
- API: `playerBody`, `isGrounded()`, `addEnemyBody(pivot)`, `removeBody`,
  `ragdoll(body, impulse, spin)`, `lineOfSight(from, to)`,
  `fireMusket(opts)`, `fireCannon(opts)`, `spawnDebris(point, normal, count)`,
  `step(dt, ctx)`.
- `step` hace: `world.step(1/60, dt, 4)`, avanza proyectiles, sincroniza
  enemigos vivos (posición) y muertos (posición + cuaternión), actualiza
  escombros y limpia cadáveres cuando el dueño lo pide.
- Impactos:
  - enemigo → `ctx.onEnemyHit(enemy, damage, point, dir, kind)`;
  - jugador → `ctx.onPlayerHit(damage, point, kind)`;
  - mundo → `ctx.onWorldImpact(point, normal, kind)`;
  - bala de cañón en el fuerte → `ctx.onFortImpact(damage, point)` + explosión,
    área (enemigos si es del jugador; jugador si es enemiga).

### `js/effects.js`

- `Effects.create(scene, camera)`.
- `muzzleFlash`, `impact`, `explosion`, `trail`, `debrisMesh`, `update`,
  `shake`, `consumedShake`/`getShake`.
- Pool máximo ~160 sprites; sin luces dinámicas; `castShadow=false` en
  partículas y escombros.

### Jugador (`js/player.js`)

- Inercia horizontal (aceleración/frenado), gravedad, salto con `Espacio`,
  colisiones deslizantes, `isGrounded`, golpe de aterrizaje.
- Cámara desde el cuerpo + bob + retroceso de disparo + sacudida.
- Disparo: proyectil real con dispersión (quieto 0,0025 rad; moviéndose
  0,012 rad), fogonazo, humo y trazadora.
- Sable: comprueba línea de visión y aplica daño + impulso vía `onEnemyHit`.
- Cañón: detecta el más cercano ≤3,5 m y ≤75° de la vista; `E` dispara con
  el punto de mira y recarga de 3,5 s.
- Expone `physics`, `syncCamera(dt)`, `addShake(amount)`.

### Enemigos (`js/enemies.js`)

- Pivote visual + cuerpo cannon por soldado; IA con velocidad deseada,
  separación y giro suave; los contactos frenan contra muros y entre sí.
- Disparo con proyectil real desde el pecho y dispersión; si no hay línea de
  visión, avanza en vez de disparar.
- `applyHit(enemy, damage, dir, point)`: vida, flash, aturdimiento e impulso.
- Muerte: el cuerpo pasa a dinámico, cae y rueda; el cadáver permanece 12 s.
- Artillería: cañonazo visible con arco balístico; daña el fuerte al impactar
  dentro del recinto; puede herir al jugador en el área.
- `bindPhysics(physics)`.

### HUD / audio / mundo

- HUD: aviso contextual de cañón y viñeta roja breve al recibir daño.
- Audio: `cannon`, `explosion`, `step`.
- `buildWorld` devuelve `colliders` (muros, torre y los 4 cañones).
- README y controles actualizados (`Espacio`, `E`).

## Balance

- Bala de mosquete: 320 m/s, daño 80; bala enemiga: 320 m/s, daño 10–15.
- Cañón enemigo: 62 m/s, 8 de daño al fuerte, 25 al jugador en radio 3,5 m.
- Cañón del jugador: 62 m/s, 120 de daño con caída hasta radio 5,5 m.
- Gravedad 9,81; salto 4,4 m/s; caminar 4 m/s; correr 6,4 m/s.

## Riesgos y mitigación

- **Tunneling**: subpasos de raycast, no cuerpos para proyectiles.
- **Coste CPU**: máximo ~90 cuerpos (12 soldados + escombros/cadáveres),
  partículas en pool, pocas luces. Medicion de `physics.step` en la
  verificación.
- **Atascos en muros**: fricción 0 en el jugador y contacto resuelto por el
  solver; se valida caminando contra cada muro.
- **Pérdida de jugabilidad**: dispersión baja y ayuda de puntería; el cañón
  permite limpiar grupos.

## Verificación

1. `node --test tests/` (lógica + física pura + mundo cannon en Node).
2. Chrome headless (Playwright + SwiftShader): menú, partida, mover con
   teclado, chocar con muro, disparar y ver impacto, cañón con `E`, muerte
   con caída, consola sin errores nuevos.
3. Capturas de menú, combate y explosión; medición de tiempo de física.

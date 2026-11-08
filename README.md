# Fuego en Humen

**Un FPS de navegador ambientado en la defensa de los fuertes de Humen (Anunghoy), 1841 — Primera Guerra del Opio.**

Controlas a un soldado patriota qing que defiende la posición costera de Humen frente al asalto de las tropas británicas. Mosquete de avancarga y sable en primera persona, tres fases de ataque y artillería británica, y un fuerte que resiste o cae.

Todo el juego es original: los modelos 3D low-poly están construidos con primitivas (sin assets externos), los efectos de sonido se sintetizan con la Web Audio API y no hay ninguna dependencia de red — funciona sin conexión.

Antes de la misión hay un **briefing** con los hechos históricos y sus fuentes, y una **cinemática** de apertura; al final, una cinemática cuenta lo que pasó de verdad. Los soldados tienen **esqueleto y animaciones propias**, no modelos rígidos.

## Animaciones y esqueleto

- Los soldados son **rigs esqueléticos con skinning real** (21 huesos, `SkinnedMesh` + `Skeleton`), generados por código: no hay mallas importadas ni assets.
- El motor de animación **no rota los brazos**: coloca el mosquete y los dos puntos donde van las manos, y un solver de IK de dos huesos calcula hombro y codo. Por eso las manos nunca flotan y la recarga puede llevar la mano a la cartuchera.
- Cada soldado cambia de animación según lo que hace: marcha al avanzar, apunta al disparar, tira de bayoneta al llegar a la muralla, y cae con la física al morir.
- La **primera persona** usa el mismo esqueleto (solo brazos): mosquete, sable, recarga, apuntado y estocada están animados.
- Arquetipos con perfil propio: `rifleman`, `marine` y `officer` (vida, daño, velocidad y puntuación distintos). El oficial mantiene la columna en pie: mientras siga vivo, su muerte puntúa mucho más.
- El retroceso, el golpe de aterrizaje y la dispersión al moverse salen de la simulación, no de animaciones fijas.

## Historia y cinemáticas

- **Briefing** antes de desplegar: el marco histórico de la misión con los hechos y **la fuente de cada dato**.
- **Cuatro cinemáticas** 3D dentro del motor, con carta de banda, cámara por keyframes y subtítulos: la destrucción del opio en Humen (junio de 1839), la escuadra forzando la bocana (23-feb-1841), el asalto por escalas (26-feb-1841, 13:20) y la caída del fuerte.
- Durante la partida, **tarjetas históricas** aparecen según lo que va pasando (desembarco, artillería, oficial, asalto, 关天培), siempre con su fuente.
- La historia **no se falsea**: el jugador es un defensor ficticio, pero el desenlace real (el fuerte cayó, 339 piezas de artillería capturadas, 1.300 chinos rendidos, cinco británicos heridos, Canton rescatada por seis millones de dólares y el Tratado de Nankín) se cuenta tal cual al final.

## Física

- Jugador y soldados son cuerpos rígidos (cannon-es): inercia, gravedad, salto, colisiones deslizantes contra murallas y empujes entre cuerpos.
- Las balas de mosquete son proyectiles reales con tiempo de vuelo, caída y dispersión. Las paredes bloquean la línea de fuego, así que hay que ver al enemigo para darle.
- Los soldados británicos también disparan proyectiles: pueden fallar, moverse o estrellarse en el parapeto.
- La artillería enemiga lanza balas de cañón con arco parabólico visible; el daño al fuerte ocurre **al impactar**, no al disparar. La explosión levanta escombros, sacude la cámara y puede herir al jugador.
- Los muertos caen con física y quedan en el campo antes de desaparecer.
- El retroceso de la cámara y del arma, el golpe de aterrizaje y la dispersión al moverse salen de la simulación, no de animaciones fijas.

## Cómo jugar

Opción 0 — jugar online (GitHub Pages, se actualiza solo al pushear a `main`):

    https://traderxael.github.io/fuego-en-humen/

Opción 1 — abrir directamente:

    index.html

(doble clic en el navegador; todos los scripts son locales)

Opción 2 — servir la carpeta (recomendado si el navegador restringe `file://`):

    npx serve .
    # o
    python -m http.server 8820

y abrir `http://localhost:8820`.

## Controles

| Tecla | Acción |
|---|---|
| `W` `A` `S` `D` | Moverse |
| Ratón | Mirar (clic en la escena para capturar el puntero) |
| Clic izquierdo | Disparar (mosquete) o golpear (sable) |
| Clic derecho | Apuntar (reducce la dispersión y estrecha el campo de visión) |
| `R` | Recargar el mosquete |
| `1` / `2` | Mosquete / sable |
| `G` | Llamar a refuerzos (señales) |
| `Shift` | Correr |
| `Espacio` | Saltar |
| `E` | Disparar el cañón del fuerte cuando estás cerca y apuntas a él |
| `Esc` | Pausa (clic para continuar) |

## Reglas

- La partida tiene **tres fases**, y cada una es un momento real de la batalla: *El desembarco* (23 de febrero de 1841), *El bombardeo* (26 de febrero por la mañana) y *El asalto* (26 de febrero a las 13:20). El objetivo de cada fase aparece en el HUD.
- Victoria: repeler las tres fases británicas.
- Derrota: tu salud llega a 0, o la integridad del fuerte llega a 0.
- Cada cañonazo que impacta dentro del fuerte y cada soldado que golpea la muralla dañan la integridad del fuerte; los mosquetes enemigos dañan tu salud.
- El sable funciona aunque el mosquete esté recargando: úsalo cuando te falte munición.
- La artillería británica castiga el fuerte aunque no te toque a ti: prioriza a los artilleros.
- Los cañones del fuerte (los cuatro del patio) están operativos: acércate, apunta y pulsa `E`. Tienen recarga y su explosión limpia grupos enteros.
- El parapeto te cubre mientras no te acerques demasiado: los británicos solo disparan cuando tienen línea de visión.
- **Racha**: encadena bajas en pocos segundos para subir el multiplicador de puntuación hasta ×3.
- **Señales** (`G`): gasta puntos en munición de reserva, reparación de la muralla o un cañonazo de la batería sur. Cada señal solo se puede usar una vez por partida.

## Nota histórica

En 1839 el comisionado imperial Lin Zexu ordenó la destrucción del opio acumulado en Humen: miles de cajas fueron arrojadas al mar. Londres respondió con cañones. La Primera Guerra del Opio (1839-1842) terminó con el Tratado de Nankín, que cedió Hong Kong a Inglaterra y abrió cinco puertos chinos al comercio occidental.

Esta partida representa el asalto británico a los fuertes de Humen en 1841, con el jugador en el papel de un soldado qing que resiste el desembarco.

Cada dato que el juego presenta como historia lleva **su fuente** (Wikipedia · *Battle of the Bogue*, *Guan Tianpei*, *Destruction of opium at Humen*, *London Gazette*…) y aparece en pantalla. Cuando la fuente y el relato no coinciden, manda la fuente: el juego no dramatiza los números.

## Fase 2 (planificada)

Campaña con varias misiones desde 1839 hasta el Tratado de Nankín (1842): batallas navales del Bogue, Dinghai, Ningpo, Shanghái/Wusong y Zhenjiang. La estructura ya lo permite: `CAMPAIGN.missions` es un array y Humen 1841 es el primer elemento; cada misión lleva su briefing, sus hechos con fuente, sus cinemáticas y sus fases.

## Estructura

- `index.html` — página del juego (carga todos los scripts locales)
- `js/logic/` — lógica pura (estado, combate, configuración, balística) con tests en Node
- `js/rig/` — rig esquelético procedural (`humanoid.js`) y motor de animación con IK (`anim.js`)
- `js/story/` — datos históricos (`campaign.js`), sets 3D de las cinemáticas (`scenes.js`) y motor de cinemáticas (`cinematics.js`)
- `js/physics.js` — mundo cannon-es: cuerpos rígidos, colisiones, proyectiles y daño en área
- `js/effects.js` — humo, chispas, trazadoras, polvo, escombros y sacudida de cámara
- `js/models.js`, `js/world.js` — modelos low-poly, colliders y escena del fuerte
- `js/player.js`, `js/enemies.js` — controlador FPS y IA de las fases sobre física
- `js/hud.js`, `js/screens.js`, `js/audio.js` — HUD, pantallas y sonido procedural
- `vendor/cannon-es.min.js` — motor de física 0.20.0 empaquetado como global local
- `tests/` — tests de Node (`npm test`)
- `tools/rig-preview.html` — previsualizador del esqueleto y las poses (`?pose=aim&view=three&faction=british&t=0.4`)
- `docs/HANDOFF-campana-v2.md` — traspaso de la última iteración: qué se hizo, decisiones, validación y pendientes

## Tests

```bash
npm test
```

Equivale a `node --test tests/logic.test.js tests/physics.test.js tests/physics-world.test.js tests/enemies.test.js tests/rig.test.js` (43 tests, sin dependencias).

Con `?debug=1` al final de la URL se exponen `window.__game`, `__state`, `__player`, `__physics` y `__enemies` para probar el juego desde la consola.

## Créditos y licencias

Proyecto original. No utiliza assets, código, audio ni diseño de ningún juego comercial (incluido Call of Duty, del que solo se toma el género FPS). Three.js y cannon-es se distribuyen bajo licencia MIT; el motor de física va vendorizado en `vendor/` y el juego sigue funcionando sin conexión.

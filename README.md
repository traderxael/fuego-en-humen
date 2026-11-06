# Fuego en Humen

**Un FPS de navegador ambientado en la defensa de los fuertes de Humen (Anunghoy), 1841 — Primera Guerra del Opio.**

Controlas a un soldado patriota qing que defiende la posición costera de Humen frente al asalto de las tropas británicas. Mosquete de avancarga y sable en primera persona, tres oleadas de infantería y artillería británica, y un fuerte que resiste o cae.

Todo el juego es original: los modelos 3D low-poly están construidos con primitivas (sin assets externos), los efectos de sonido se sintetizan con la Web Audio API y no hay ninguna dependencia de red — funciona sin conexión.

## Física

- Jugador y soldados son cuerpos rígidos (cannon-es): inercia, gravedad, salto, colisiones deslizantes contra murallas y empujes entre cuerpos.
- Las balas de mosquete son proyectiles reales con tiempo de vuelo, caída y dispersión. Las paredes bloquean la línea de fuego, así que hay que ver al enemigo para darle.
- Los soldados británicos también disparan proyectiles: pueden fallar, moverse o estrellarse en el parapeto.
- La artillería enemiga lanza balas de cañón con arco parabólico visible; el daño al fuerte ocurre **al impactar**, no al disparar. La explosión levanta escombros, sacude la cámara y puede herir al jugador.
- Los muertos caen con física y quedan en el campo antes de desaparecer.
- El retroceso de la cámara y del arma, el golpe de aterrizaje y la dispersión al moverse salen de la simulación, no de animaciones fijas.

## Cómo jugar

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
| `R` | Recargar el mosquete |
| `1` / `2` | Mosquete / sable |
| `Shift` | Correr |
| `Espacio` | Saltar |
| `E` | Disparar el cañón del fuerte cuando estás cerca y apuntas a él |
| `Esc` | Pausa (clic para continuar) |

## Reglas

- Victoria: repeler las 3 oleadas británicas.
- Derrota: tu salud llega a 0, o la integridad del fuerte llega a 0.
- Cada cañonazo que impacta dentro del fuerte y cada soldado que golpea la muralla dañan la integridad del fuerte; los mosquetes enemigos dañan tu salud.
- El sable funciona aunque el mosquete esté recargando: úsalo cuando te falte munición.
- La artillería británica castiga el fuerte aunque no te toque a ti: prioriza a los artilleros.
- Los cañones del fuerte (los cuatro del patio) están operativos: acércate, apunta y pulsa `E`. Tienen recarga y su explosión limpia grupos enteros.
- El parapeto te cubre mientras no te acerques demasiado: los británicos solo disparan cuando tienen línea de visión.

## Nota histórica

En 1839 el comisionado imperial Lin Zexu ordenó la destrucción del opio acumulado en Humen: miles de cajas fueron arrojadas al mar. Londres respondió con cañones. La Primera Guerra del Opio (1839-1842) terminó con el Tratado de Nankín, que cedió Hong Kong a Inglaterra y abrió cinco puertos chinos al comercio occidental.

Esta partida representa el asalto británico a los fuertes de Humen en 1841, con el jugador en el papel de un soldado qing que resiste el desembarco.

## Fase 2 (planificada)

Campaña con varias misiones desde 1839 hasta el Tratado de Nankín (1842): batallas navales del Bogue, Dinghai, Ningpo, Shanghái/Wusong y Zhenjiang.

## Estructura

- `index.html` — página del juego (carga todos los scripts locales)
- `js/logic/` — lógica pura (estado, combate, configuración, balística) con tests en Node
- `js/physics.js` — mundo cannon-es: cuerpos rígidos, colisiones, proyectiles y daño en área
- `js/effects.js` — humo, chispas, trazadoras, polvo, escombros y sacudida de cámara
- `js/models.js`, `js/world.js` — modelos low-poly, colliders y escena del fuerte
- `js/player.js`, `js/enemies.js` — controlador FPS y IA de las oleadas sobre física
- `js/hud.js`, `js/screens.js`, `js/audio.js` — HUD, pantallas y sonido procedural
- `vendor/cannon-es.min.js` — motor de física 0.20.0 empaquetado como global local
- `tests/` — `node --test tests/logic.test.js tests/physics.test.js tests/physics-world.test.js tests/enemies.test.js`

## Créditos y licencias

Proyecto original. No utiliza assets, código, audio ni diseño de ningún juego comercial (incluido Call of Duty, del que solo se toma el género FPS). Three.js y cannon-es se distribuyen bajo licencia MIT; el motor de física va vendorizado en `vendor/` y el juego sigue funcionando sin conexión.

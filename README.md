# Fuego en Humen

**Un FPS de navegador ambientado en la defensa de los fuertes de Humen (Anunghoy), 1841 — Primera Guerra del Opio.**

Controlas a un soldado patriota qing que defiende la posición costera de Humen frente al asalto de las tropas británicas. Mosquete de avancarga y sable en primera persona, tres oleadas de infantería y artillería británica, y un fuerte que resiste o cae.

Todo el juego es original: los modelos 3D low-poly están construidos con primitivas (sin assets externos), los efectos de sonido se sintetizan con la Web Audio API y no hay ninguna dependencia de red — funciona sin conexión.

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
| `Esc` | Pausa (clic para continuar) |

## Reglas

- Victoria: repeler las 3 oleadas británicas.
- Derrota: tu salud llega a 0, o la integridad del fuerte llega a 0.
- Cada balazo enemigo y cada soldado que alcanza la muralla dañan el fuerte.
- El sable funciona aunque el mosquete esté recargando: úsalo cuando te falte munición.
- La artillería británica castiga el fuerte aunque no te toque a ti: prioriza a los artilleros.

## Nota histórica

En 1839 el comisionado imperial Lin Zexu ordenó la destrucción del opio acumulado en Humen: miles de cajas fueron arrojadas al mar. Londres respondió con cañones. La Primera Guerra del Opio (1839-1842) terminó con el Tratado de Nankín, que cedió Hong Kong a Inglaterra y abrió cinco puertos chinos al comercio occidental.

Esta partida representa el asalto británico a los fuertes de Humen en 1841, con el jugador en el papel de un soldado qing que resiste el desembarco.

## Fase 2 (planificada)

Campaña con varias misiones desde 1839 hasta el Tratado de Nankín (1842): batallas navales del Bogue, Dinghai, Ningpo, Shanghái/Wusong y Zhenjiang.

## Estructura

- `index.html` — página del juego (carga todos los scripts locales)
- `js/logic/` — lógica pura (estado, combate, configuración) con tests en Node
- `js/models.js`, `js/world.js` — modelos low-poly y escena del fuerte
- `js/player.js`, `js/enemies.js` — controlador FPS e IA de las oleadas
- `js/hud.js`, `js/screens.js`, `js/audio.js` — HUD, pantallas y sonido procedural
- `tests/logic.test.js` — tests de la lógica (`node --test tests/logic.test.js`)

## Créditos y licencias

Proyecto original. No utiliza assets, código, audio ni diseño de ningún juego comercial (incluido Call of Duty, del que solo se toma el género FPS). Three.js se distribuye bajo licencia MIT.

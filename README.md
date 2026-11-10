# Fuego en Humen

**Un FPS de navegador ambientado en la defensa de los fuertes de Humen (Anunghoy), 1841 — Primera Guerra del Opio.**

Controlas a un soldado patriota qing que defiende la posición costera de Humen frente al asalto de las tropas británicas. Cinco armas a elegir en la armería (mosquete, fusil de chispa, sable, pica y trabuco), cinco oleadas de infantería y artillería británica, y un fuerte que resiste o cae.

El escenario y los enemigos usan modelos low-poly procedurales; los cañones de bronce y seis soldados decorativos de la guarnición qing son modelos PBR generados con Meshy. Los efectos de sonido se sintetizan con Web Audio. Todos los recursos se incluyen localmente: el juego funciona sin conexión, también con `file://`.

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

Con `?debug=1` al final de la URL se exponen `window.__game`, `__state`, `__physics` y `__enemies` para probar el juego desde la consola.

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
| Clic izquierdo | Disparar (mosquete, fusil o trabuco) o golpear (sable o pica) |
| `R` | Recargar el arma de fuego |
| `1` – `5` | Cambiar de arma (mosquete, fusil, sable, pica, trabuco) |
| `F` | Recoger el objeto que haya en el suelo (a menos de 1,8 m) |
| `6` | Usar botiquín (cura 35) |
| `7` | Usar bolsa de munición (rellena todos los cargadores) |
| `8` | Lanzar granada de pólvora (explosión de 4,5 m) |
| `Shift` | Correr |
| `Espacio` | Saltar |
| `E` | Disparar el cañón del fuerte cuando estás cerca y apuntas a él |
| `Esc` | Pausa (clic para continuar) |

## Reglas

- **Victoria táctica**: repeler las 5 oleadas británicas. La campaña, sin embargo, termina como en la historia: tras el quinto asalto los fuertes caen y se muestra el **epílogo histórico** (26 de febrero de 1841).
- Derrota: tu salud llega a 0, o la integridad del fuerte llega a 0. Si caes antes de la quinta oleada, la derrota es normal y no lleva epílogo.
- Cada cañonazo que impacta dentro del fuerte y cada soldado que golpea la muralla dañan la integridad del fuerte; los mosquetes enemigos dañan tu salud.
- El sable funciona aunque el mosquete esté recargando: úsalo cuando te falte munición.
- La artillería británica castiga el fuerte aunque no te toque a ti: prioriza a los artilleros.
- Los cañones del fuerte (los cuatro del patio) están operativos: acércate, apunta y pulsa `E`. Tienen recarga y su explosión limpia grupos enteros.
- El parapeto te cubre mientras no te acerques demasiado: los británicos solo disparan cuando tienen línea de visión.

## Introducción

Antes del menú se reproduce una **intro sobre fondo negro**, al estilo briefing de misión:

1. **Cinemática** (`assets/cinematic/intro.mp4`, 10 s): tres planos renderizados con **Blender 5.2** en modo headless — el fuerte de Anunghoy al amanecer, el escuadrón británico al frente y sus salvas de apertura. Escena low-poly procedural (fuerte, mar, barcos, bandera qing), sin assets externos.
2. **Música de fondo** (`assets/audio/war_theme.mp3`): tema de asedio sintetizado por completo con un script de matemáticas puras (`tools/audio/war_theme.js`): bordón grave, viento, cuerdas en Re menor, melodía del soldado, tambores de guerra a 72 BPM y cañonazos lejanos.
3. **Tres capítulos** de historia sobre la escena, con botón *Continuar* y *Saltar intro*.

Al terminar (o al saltar) aparece el menú, y desde *Jugar* se pasa a la **armería**.

### Armería

Pantalla para elegir el arma con la que entras en combate. Las cinco opciones:

| Arma | Tipo | Daño | Notas |
|---|---|---|---|
| Mosquete | fuego | 80 | Un tiro, recarga de 2.6 s. El clásico. |
| Fusil de chispa | fuego | 130 | Más certero y letal, pero recarga 3.4 s. |
| Sable | cuerpo a cuerpo | 60 | Alcance 2.2 m. Sin munición ni recarga. |
| Pica | cuerpo a cuerpo | 85 | Alcance 3 m, golpe más lento. |
| Trabuco | fuego | 8 × 40 | Ocho perdigones por cartucho, cono de 0.07 rad y recarga de 2.8 s. Seis perdigones bastan contra el enemigo más duro (176 HP). |

**Objetos del inventario** (huecos 6–8 de la barra inferior)

| Objeto | Efecto | Máximo |
|---|---|---|
| Botiquín | Cura 35 HP | 3 |
| Bolsa de munición | Rellena todos los cargadores y cancela la recarga en curso | 3 |
| Granada de pólvora | Explosión de 120 de daño en 4,5 m; no daña el fuerte ni al jugador | 2 |

Los objetos salen de tres cajas fijas del fuerte (reaparecen a los 25 s) y de un 28 % de probabilidad al abatir infantería británica (el botín caduca a los 30 s). La barra muestra el arma equipada y las existencias de cada objeto.

**Guarnición aliada**: los ocho soldados qing disparan al británico más cercano con línea de visión (26 de daño, 1,7 s entre disparos). Cuatro patrullan el patio y los otros cuatro están fijos en el parapeto y los brazos del fuerte; son invulnerables y sus bajas no suman puntuación.

El arma elegida se equipa al empezar y se puede cambiar durante la batalla con `1`–`5`. El botón de comienzo espera a que terminen de cargarse los modelos; la intro y la armería siguen disponibles.

### Assets generados con IA

`assets/ai/` contiene el fondo de la intro y la textura de pergamino. `assets/models/` contiene el cañón de bronce y el soldado qing generados con Meshy AI; la guarnición son seis clones decorativos sin IA ni colisiones que comparten geometría, materiales y texturas.

Pipeline de modelos: imagen Meshy → GLB PBR (`meshy-t2.5`, `meshy-7`) → `tools/blender/meshy_to_glb.py` → `tools/models/embed_glb.mjs`. Blender normaliza el cañón a 2.2 m de largo y el soldado a 1.75 m, con texturas de 1024 px y sin Draco. Los scripts base64 se decodifican con el GLTFLoader local: no se descargan GLB, texturas ni WASM al jugar. Si un modelo falta o falla, el cañón conserva su primitiva y se omite la guarnición.

La generación de ambos modelos consumió 39 créditos Meshy. Sólo regenerar modelos o reconstruir el vendor requiere red; abrir el juego no.

## Novedades

**Gameplay y contenido**

- Cinco oleadas (antes tres): **10, 15, 20, 26 y 34** soldados, con entradas por goteo para que el pico no ahogue al equipo. Las dos finales mezclan tipos de enemigo y traen más artillería.
- Tres tipos de infantería, cada uno con su modelo y comportamiento:
  - **Soldado**: equilibrado, dispara mosquete.
  - **Corredor** (casaca roja clara): rápido (×1.9) y frágil (×0.5 de vida), no dispara; se lanza al cuerpo a cuerpo con cadencia corta.
  - **Oficial** (casaca granate, charreteras doradas y bicornio): lento (×0.8) pero resistente (×2.2 de vida) y más daño; dispara.
  - **Sepoy** del 37.º de Madrás (casaca azul pizarra y turbante blanco): mismo mosquete que el soldado, algo menos de daño (×0.9). Aparece en las oleadas 4 y 5.
- **Cohetes Congreve**: en la última oleada una de las piezas de asedio es una batería de cohetes (cadencia 4,5 s, daño al fuerte ×0,75 y explosión menor).
- Puntuación por tipo (soldado 100, corredor 150, oficial 250) y **mejor puntuación persistente** en `localStorage`, visible en el menú y en las pantallas de victoria/derrota, con aviso de «¡Nuevo récord!».
- **Feedback de baja**: popup flotante «+puntos» en el centro de la pantalla con cada enemigo abatido.

**Sensaciones y audio** (todo sintetizado, sin assets)

- **Audio posicional**: disparos enemigos, cañonazos y explosiones se atenúan con la distancia y se panoramizan según la dirección respecto a la cámara.
- **Tambores de guerra** en bucle mientras se juega (se detienen en pausa y al terminar).
- **Latido** a baja salud (≤30 HP) que se acelera cuanto más cerca de la muerte.
- Secuencia de recarga sincronizada con el tiempo real de cada arma (el fusil de chispa tarda más que el mosquete), y un tono breve de confirmación por baja.
- El arma **baja y se inclina** durante la recarga (animación procedural sobre el viewmodel).

**Flota y escenario históricos**

- **HMS Nemesis**: vapor de ruedas con chimenea, dos paletas y pabellón blanco, fondeado frente al fuerte (malla fusionada, 1 draw call).
- **Juncos de guerra qing** con velas de batten, **cadena del Bogue con balsas**, dos **balsas incendiarias** con brasas emisivas que se mecen, y **aldeas con pagodas** en la orilla.
- **Jingales** (cañones de muralla) sobre el parapeto, **banderines de unidad** con el carácter 勇 en lugar de una bandera nacional que aún no existía, y **pabellones británicos** en los veleros.
- Todo el decorado son mallas fusionadas con color por vértice: sin luces nuevas (siguen 2) y sin colliders adicionales.

**Gráficos y ambiente** (ligero, sin postprocesado ni luces nuevas)

- **Cielo degradado** (domo de colores por vértice) con **sol** visible (disco + halo).
- **Mar animado** con oleaje suave por vértice.
- **Muralla de piedra**: una sola textura procedural de sillería (256 px, repetida cada 3,6 m con UVs escaladas por metro para que las hiladas no se estiren), zócalo ataluzado, cornisa, almenas en los muros altos y bastiones en las ocho esquinas y remates. El parapeto de mar queda a 1,54 m —por debajo de los ojos— para poder disparar por encima.
- **Puerta terrestre**: portal de piedra que envuelve el muro, cornisa, portón de madera con herrajes y placa, umbral y pertrechos (barriles y cajas) en el patio. La torre del ángulo comparte piedra y cornisa con la muralla.
- **Plataformas de cañón** de madera bajo las cuatro piezas del patio.
- **Banderas qing** (amarillas con borde azul y sello central) en la torre, el patio y la muralla, ondeando al viento.
- **Daño visible en el fuerte**: marcas de quemado que aparecen progresivamente en el parapeto y el patio a medida que cae la integridad, con **humo** ascendente cuando el fuerte está por debajo de la mitad.

## Modo campaña

- **Menú de campaña**: las cinco misiones aparecen en el menú. Empiezas con la 1 y cada misión completada desbloquea la siguiente; el progreso y el punto de control se guardan en `localStorage`.
- **Briefing + armería**: al elegir misión, la armería muestra la fecha, el hecho histórico y los dos objetivos de esa misión antes de equipar el arma.
- **Objetivos**: cada misión tiene dos objetivos secuenciales (bajas, silenciar artillería o usar el cañón del fuerte) y un cierre de «aguanta el asalto». Se muestran bajo el contador `Misión N/5` y se anuncian por radio de escuadra.
- **Transiciones**: al completar una misión suena el clip histórico de la siguiente y se muestra la tarjeta con el hecho y la lección táctica.
- **Checkpoint por misión**: al empezar cada misión se guarda vida, integridad del fuerte y puntuación. Si caes, la pantalla de derrota ofrece «Reintentar misión N»: al recargar, el menú preselecciona esa misión y el asalto se reanuda desde el punto de control.
- La quinta misión cierra con la caída histórica y el epílogo (el punto de control se borra al terminar).

## Campaña histórica

Cada oleada se presenta con un **clip prerenderizado** de 2,5 s y una tarjeta con la fecha y el hecho real:

| Oleada | Fecha | Hecho |
|---|---|---|
| 1 · Chuenpi | 7 de enero de 1841 | Quince juncos y 2.000 hombres defienden Chuenpi y Taikoktow; el Nemesis lanza un cohete Congreve que hace estallar un junco. |
| 2 · El Bogue | 23 de febrero de 1841 | Doce barcos de Bremer; el Nemesis silencia la batería enmascarada y la cadena con balsas cierra el estrecho. |
| 3 · Anunghoy | 23 de febrero de 1841 | Weiyuan (42 cañones) y Jingyuan (60) baten el paso; los Royal Marines desembarcan por el flanco. |
| 4 · Wangtong | 25 de febrero de 1841 | 1.037 hombres del mayor Pratt desembarcan; caen Yong'an (40 cañones) y la obra de 17 piezas. |
| 5 · Jingyuan | 26 de febrero de 1841 | Último asalto: muere el almirante Guan Tianpei y 339 cañones quedan en manos británicas. |

Los clips se renderizan con `tools/blender/wave_scene.py` (escena procedural, 24 fps, 640×360, Cycles CPU) y `tools/video/encode_wave.sh`, y se guardan en `assets/cinematic/wave{1..5}.mp4`. Si un clip falta, la transición cae a la tarjeta estática sin bloquear la partida.

## Nota histórica

En 1839 el comisionado imperial Lin Zexu ordenó la destrucción del opio acumulado en Humen: miles de cajas fueron arrojadas al mar. Londres respondió con cañones. La Primera Guerra del Opio (1839-1842) terminó con el Tratado de Nankín, que cedió Hong Kong a Inglaterra y abrió cinco puertos chinos al comercio occidental.

Esta partida representa el asalto británico a los fuertes de Humen en 1841, con el jugador en el papel de un soldado qing que resiste el desembarco.

## Fase 2 (planificada)

Campaña con varias misiones desde 1839 hasta el Tratado de Nankín (1842): batallas navales del Bogue, Dinghai, Ningpo, Shanghái/Wusong y Zhenjiang.

## Estructura

- `index.html` — página del juego (carga todos los scripts locales)
- `js/logic/` — lógica pura (estado, combate, configuración, balística, oleadas, récords y audio espacial) con tests en Node
- `js/physics.js` — mundo cannon-es: cuerpos rígidos, colisiones, proyectiles y daño en área
- `js/effects.js` — humo, chispas, trazadoras, polvo, escombros y sacudida de cámara
- `js/models.js`, `js/world.js` — modelos low-poly, flota histórica, colliders y escena del fuerte
- `js/intermission.js`, `js/logic/campaign.js` — clips y tarjetas entre oleadas, epílogo histórico
- `js/player.js`, `js/enemies.js` — controlador FPS y IA de las oleadas sobre física
- `js/hud.js`, `js/screens.js`, `js/audio.js` — HUD, pantallas y sonido procedural
- `js/assets.js` — carga asíncrona y registro de modelos embebidos, con clones compartidos
- `assets/models/` — cañón y soldado qing en scripts base64 locales
- `tools/blender/meshy_to_glb.py`, `tools/models/embed_glb.mjs` — normalización y empaquetado de modelos
- `vendor/gltfloader.min.js`, `tools/models/build_loader.mjs` — GLTFLoader r160 y receta de reconstrucción
- `vendor/cannon-es.min.js` — motor de física 0.20.0 empaquetado como global local
- `assets/cinematic/`, `assets/audio/`, `assets/ai/` — cinemática, tema musical y fondos generados
- `tools/blender/intro_scene.py` — escena de la cinemática (Blender headless, Cycles CPU)
- `tools/audio/war_theme.js` — sintetizador del tema musical (matemáticas puras, sin muestras)
- `tests/` — lógica pura, física, mundo y enemigos; se ejecutan con `node --test tests/*.test.js`

## Créditos y licencias

Proyecto original. No utiliza assets, código, audio ni diseño de ningún juego comercial (incluido Call of Duty, del que solo se toma el género FPS). Modelos 3D generados con Meshy AI (plan gratuito). Three.js, GLTFLoader y cannon-es se distribuyen bajo licencia MIT; las bibliotecas van vendorizadas en `vendor/` y el juego sigue funcionando sin conexión.

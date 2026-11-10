# Traspaso — Campaña de Humen v2 (jugabilidad, esqueleto, historia)

Estado de la segunda pasada de trabajo sobre **Fuego en Humen**, pedido como
«mejorame la jugabilidad y el juego y las animaciones, esqueleto y la historia…
cinemáticas con hechos reales, como Call of Duty».

Fecha: 2026-11-08 · Rama: `main` · Estado: **entregado y verificado en navegador**, pendiente solo la decisión de alcance/entrega.

---

## 1. Qué se ha hecho

### 1.1 Esqueleto y animaciones (eje nuevo)

- `js/rig/humanoid.js` — **rig esquelético procedural** con skinning real.
  Jerarquía de 21 huesos (`root → hips → spine → chest → neck → head`, brazos,
  piernas y `weapon`), geometría flat-shaded con `skinIndex`/`skinWeight`
  calculados por distancia al segmento de hueso, `THREE.SkinnedMesh` +
  `THREE.Skeleton` y paletas `british` / `marine` / `officer` / `qing`.
  Exports: `buildSoldier()` (soldado completo) y `buildViewmodel()` (solo
  brazos, para primera persona).
- `js/rig/anim.js` — motor de animación. Los clips **no rotan los brazos**:
  colocan el mosquete y los dos objetivos de mano (en espacio del pecho) y un
  **solver IK analítico de dos huesos** (`solveArm` / `solveArms`) calcula
  hombro y codo, así las manos nunca flotan. Capa aditiva para retroceso y
  flinches, crossfade entre clips y reloj propio por animador.
  Clips: `idle/walk/run/aim/fire/reload/melee/hit/death/limp/kneel` +
  `vmIdle/vmFire/vmReload/vmMelee/vmSprint/vmAim`.
- `js/enemies.js` — los británicos ahora usan el rig. Arquetipos
  `rifleman` / `marine` / `officer` (vida, daño, velocidad y puntuación
  distintos), animación por estado de IA (`advance → walk`, `shoot → aim`,
  `melee → bayoneta`), aditiva de disparo y de impacto, muerte en `death` →
  `limp`, y bonus de puntuación mientras el oficial sigue vivo.
- `js/player.js` — el **viewmodel de primera persona** es ahora el rig de
  brazos con mosquete y sable, animado (idle, apuntado, recarga, carrera,
  estocada). Botón derecho = apuntado (FOV 75→52, dispersión ×0.22).
- `tools/rig-preview.html` — herramienta de QA: `?pose=aim&view=three&faction=british&t=0.4`.

### 1.2 Jugabilidad

- Las tres oleadas son ahora **tres fases** ligadas a la cronología real
  (`js/logic/config.js`): *El desembarco* (23-feb), *El bombardeo* (26-feb
  mañana) y *El asalto* (26-feb 13:20). Cada una con arquetipos, cadencia,
  artillería y objetivo propios.
- **Arquetipos enemigos** con estadísticas diferenciadas y bonus por oficial.
- **Racha y multiplicador** de puntuación (hasta ×3) y **señales** con la
  tecla `G`: munición, reparación de muralla y fuego de cañón, cada una con
  su coste en puntos.
- **Objetivo de fase** y **radio** en el HUD, con tarjetas de los hechos que
  van apareciendo según lo que ocurre en la partida.
- Menú → **briefing** con los hechos y sus fuentes → cinemática → misión.

### 1.3 Historia y cinemáticas

- `js/story/campaign.js` — los datos de la misión: briefing, **8 hechos
  históricos con su fuente**, radio, 5 *beats* que saltan por evento,
  objetivos y las tres señales.
- `js/story/scenes.js` — cuatro sets 3D construidos con primitivas:
  destrucción del opio (1839), la escuadra en la bocana, el asalto por
  escalas (26-feb-1841) y la caída del fuerte.
- `js/story/cinematics.js` — motor de cinemáticas: letterbox, cámara con
  keyframes interpolados, tarjetas históricas con fuente, subtítulos y
  espera de pulsación. Secuencias `humen-1839`, `humen-squadron`,
  `humen-assault`, `humen-fall`.
- `js/main.js` — flujo completo: menú → briefing → cinemática de apertura →
  misión con beats y radio → cinemática final → parte de victoria.
- **Marco honesto**: el jugador es un defensor ficticio; el desenlace real
  (el fuerte cayó, 339 cañones capturados, Canton rescatada por seis millones
  de dólares, Tratado de Nankín) se cuenta en la cinemática final, no se falsea.

### 1.4 Bugs encontrados y corregidos en esta pasada

| Bug | Causa | Corrección |
|---|---|---|
| Las cinemáticas salían **en negro** | las luces vivían dentro de `world.group`, que se oculta durante las cinemáticas | `js/world.js`: hemisférica y direccional ahora cuelgan de la escena |
| El **viewmodel no se veía** en primera persona | estaba en `z` positivo, es decir **detrás de la cámara** (que mira a `-z`) | `js/player.js`: recolocado en espacio de cámara (`z` negativo) y recalibrado con un solver |
| Las **mangas tapaban la vista** al apuntar | el offset del pecho subía los hombros al encuadre | `js/rig/anim.js` (`vmAim`): el pecho se desplaza solo de lado |
| Los **enemigos no se animaban** | el animador arrancaba sin clip: la IA solo cambiaba de clip al cambiar de estado, y el estado inicial nunca cambia | `js/enemies.js`: el clip `walk` se arranca en el spawn |
| El arma colgaba **debajo del pecho**, así que los brazos llegaban desde arriba | el hueso `weapon` estaba por debajo del pecho en la especificación del viewmodel | `js/rig/humanoid.js`: el mosketecuelga **delante** del pecho |
| Textos **corruptos** en el código narrativo (`opio British`, `nosumbledearán`, `alidade provincial`, `los granados`…) | — | 19 reemplazos verificados uno a uno (`js/story/*.js`) |

### 1.5 Errores históricos corregidos contra la fuente

Todo el texto narrativo se contrastó con Wikipedia (incluido el *wikitext* con
sus referencias) y con el *London Gazette*:

- El 23 de febrero **no hubo retirada**: Herbert y Elliot tomaron la batería
  enmascarada de veinte cañones, inutilizaron veinte piezas montadas rompiendo
  sus ejes y hallaron otras sesenta desmontadas, sin bajas británicas.
- La destrucción del opio fue **del 3 al 23 de junio de 1839** (no un solo
  día): 19.187 cajas y 2.119 sacos, en tres fosas con cal y sal y agua de mar.
- Entre la destrucción del opio y el asalto median **veinte meses y veintitrés
  días**, no diecisiete.
- Las **granadas** no aparecen en la fuente: se han quitado de la cinemática
  final.
- La **campana** de Humen llegó a la iglesia de St Mary's en Gosforth en 1844
  (no cuatro años después), donada por la viuda de Senhouse.
- 关天培 murió por un **proyectil**, no por una granada; entregó su sello a un
  soldado para que llegara al emperador y se negó a rendirse porque hacerlo
  implicaría traición.
- El texto de victoria ya no afirma que «Humen no cede»: el fuerte cayó.

---

## 2. Decisiones

1. **«Esqueleto» = rig esquelético con skinning real**, no un grupo de mallas.
   Es el eje técnico pedido y el que da valor a las animaciones.
2. **Los clips no rotan los brazos**: definen dónde van el mosquete y las dos
   manos, y el IK de dos huesos resuelve hombro y codo. Evita manos flotando y
   permite animar la recarga con la mano en la cartuchera.
3. El hueso `weapon` cuelga **delante** del pecho en el viewmodel (en el
   soldado, del pecho) para poder apuntar el mosquete de forma independiente.
4. El rig del viewmodel es **solo de brazos** (sin torso ni cabeza), escalado
   0.55 y colocado en espacio de cámara para que los hombros queden fuera de
   plano.
5. Las **3 oleadas son 3 fases** ligadas a la cronología real.
6. El motor de cinemáticas está diseñado con **tarjetas de texto + fuente**,
   de modo que admite también el formato «paneles» si se prefiere.
7. El proyecto sigue **asset-free y offline**: solo primitivas Three.js y
   `vendor/`.

---

## 3. Validación

- **Tests de Node**: `npm test` → **43 tests, 43 pasan** (antes había 1 roto
  por una expectativa antigua de `WAVES`).
- **Smoke test headless** (Playwright + Chrome, script fuera del repo):
  **23/23 comprobaciones y 0 errores de consola**. Cubre menú → briefing →
  cinemática → misión, aparición de enemigos, IK y estado del animador,
  viewmodel delante de la cámara, apuntado real sobre un enemigo, disparo,
  recarga automática, cambio de arma, señales y pausa.
- **Renders headless** de las 4 cinemáticas (12 planos) y de los estados del
  viewmodel (idle / apuntado / recarga). Están en `tools/shots/` (ignoradas
  por git).
- `?debug=1` expone `window.__game`, `__state`, `__player`, `__physics`,
  `__enemies` para seguir depurando desde la consola.

### Cómo repetir la validación

```powershell
# tests
cd <repo>; npm test

# smoke test headless (necesita playwright-core + Chrome)
node smoke.js   # el script vive fuera del repo; ver §5
```

---

## 4. Pendientes y decisiones abiertas

Estas decisiones **no** se han tomado todavía; el trabajo entregado es
compatible con las tres opciones de cada una:

1. **Formato de las cinemáticas**: 3D dentro del motor (lo implementado) /
   paneles narrativos de texto / híbrido. El motor ya tiene las tarjetas
   históricas con fuente, así que el formato «paneles» es un cambio de
   presentación, no de datos.
2. **Alcance de la campaña**: Humen 1841 a fondo (lo entregado) / una misión
   más (Dinghai) / campaña de 5 misiones hasta Nankín. La estructura ya lo
   permite: `CAMPAIGN.missions` es un array y `MISSION` es el primer elemento.
3. **Entrega**: push directo a `main` (auto-deploy a GitHub Pages) / rama con
   PR / solo local. **El commit local está hecho; el push a `main` está
   pendiente de confirmación** porque publica el juego en la URL pública.

---

## 5. Estado del árbol de trabajo

- Rama `main`, sin commits nuevos **publicados** (el commit local sí está).
- Ficheros nuevos: `js/rig/humanoid.js`, `js/rig/anim.js`,
  `js/story/campaign.js`, `js/story/scenes.js`, `js/story/cinematics.js`,
  `tests/rig.test.js`, `tools/rig-preview.html`, `package.json`,
  `docs/HANDOFF-campana-v2.md`.
- Modificados: `index.html`, `css/style.css`, `js/main.js`, `js/player.js`,
  `js/enemies.js`, `js/hud.js`, `js/screens.js`, `js/world.js`,
  `js/logic/config.js`, `tests/logic.test.js`, `.gitignore`, `README.md`.
- `tools/.chromeprofile/` y `tools/shots/` quedan fuera del repo por
  `.gitignore`: son artefactos de QA, no del juego.
- El script de smoke test (`smoke.js`) y los auxiliares de render están
  **fuera del repo**, en el directorio de sesión, porque dependen de un
  `playwright-core` instalado en otra ruta de esta máquina. Conviene moverlos
  a `tools/` con una dependencia declarada si se quiere mantenerlos.

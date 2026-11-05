# Diseño — "Fuego en Humen" (FPS de la Primera Guerra del Opio)

Fecha: 2026-11-04
Ubicación del proyecto: `C:\Users\USUARIO\juegos\guerra-opio-humen` (no es un repositorio git todavía)

## Intención y por qué
El jugador quiere un juego de disparos en primera persona con temática china histórica: soldado patriota Qing defendiendo China en la Primera Guerra del Opio (1839–1842). Primera fase: **una batalla jugable completa**. Fases futuras (no en este doc como alcance, pero sí como dirección): campaña de varias misiones hasta el Tratado de Nankín (1842).

Se pide "ingeniería inversa" de Call of Duty. Lo que se toma son las mecánicas genéricas del género (correr, apuntar, disparar, recargar, oleadas de enemigos, HUD), que son ideas de diseño. **Anti-objetivo explícito:** copiar código, modelos, mapas, sonidos o textos propietarios de Call of Duty o de cualquier otro juego comercial. Todos los assets son originales o gratuitos (CC0).

## Objetivo de esta fase
Una batalla jugable de principio a fin en el navegador: **el asalto británico a los fuertes de Humen/Anunghoy (1841)** — respuesta armada británica a la destrucción del opio ordenada por Lin Zexu en 1839. El jugador es un soldado Qing en el fuerte; oleadas de marineros e infantería británica (con cañones de campaña) atacan la posición.

Condiciones de victoria/derrota:
- Victoria: resistir N oleadas (3 en v1) y/o repeler el asalto final al fuerte.
- Derrota: la salud del jugador llega a 0, o el fuerte es tomado (barra de moral/integridad del fuerte a 0).

## Goals
- FPS en primera persona, en el navegador, sin instalar nada.
- Three.js (se reutiliza el `three.min.js` ya presente en el entorno del jugador).
- Controles: WASD + ratón (pointer lock), clic disparar, R recargar, 1/2 cambiar arma (mosquete / sable), Shift correr, Espacio saltar (opcional).
- Armas Qing: mosquete/jingal de avancarga (lento, daño alto, recarga manual) y sable para combate cercano.
- Enemigos británicos low-poly: infantería de línea (rojo) y marineros; IA simple: avanzar hacia el fuerte, disparar en rango, atacar cuerpo a cuerpo si están cerca.
- Escenario: fuerte de adobe/piedra de Humen, muralla, parapetos, costa, mar, barcos británicos low-poly al fondo, cielo, niebla.
- HUD: salud, munición, oleada, integridad del fuerte, crosshair, mensajes de batalla (intro con contexto histórico breve).
- Menú de inicio con título, "Jugar", créditos; pantalla de victoria y de derrota; reiniciar.
- Modelos 3D low-poly originales construidos con primitivas/geometría en Three.js (no assets de CoD). Estilo: estilizado, no realista.
- Sonidos generados por código (Web Audio API): disparo, recarga, impacto, grito de oleada, ambiente; sin samples con copyright.
- Estructura: `index.html` + carpeta `js/` (o un solo HTML si resulta más simple para v1), servible con `npx serve` o abriéndolo directamente.
- Texto en español (interfaz), con nombres históricos chinos e ingleses donde proceda. Contenido histórico correcto: Lin Zexu, Humen, Primera Guerra del Opio, 1839.

## Non-goals / Anti-goals
- No multijugador (v1).
- No campaña completa en v1 (se diseña para añadir misiones después, pero no se construyen ahora).
- No fotorrealismo ni assets comerciales; no copiar nada de Call of Duty.
- No motor externo adicional; no Godot en esta fase.
- No dependencia de assets remotos obligatorios: el juego debe funcionar offline (todo embebido o generado).

## Constraints
- Plataforma: Windows 10/11 del jugador, navegador moderno (Chrome/Edge/Firefox).
- Three.js disponible en `C:\Users\USUARIO\juego-3d-demo\three.min.js` — copiarlo al proyecto.
- Sin conexión garantizada: todo debe ser local.
- El jugador prefiere juegos web como sus proyectos previos (`3d-space`, `juego-3d-demo`).

## Approaches consideradas
1. **Three.js desde cero (elegida).** Control total, cero dependencias nuevas, coherente con el entorno del jugador. Trade-off: físicas/colisiones sencillas hechas a mano.
2. **Babylon.js.** FPS con física integrada, pero dependencia grande y fuera del patrón del jugador. Descartada.
3. **Instalar Godot 4.** Mejor a futuro para un FPS serio, pero no está instalado y es un salto pesado. Descartado por ahora; la fase 2 (campaña) puede reevaluar motor.

## Decisiones del diseño (tomadas en conversación)
- Temática: Primera Guerra del Opio, lado chino Qing, soldado patriota.
- Formato: FPS primera persona.
- Motor: Three.js en navegador (no Godot aún).
- Alcance v1: una batalla completa, jugable con modelos 3D. Ubicación: `C:\Users\USUARIO\juegos\guerra-opio-humen`.
- Marco histórico (1841): asalto británico a los fuertes de Humen/Anunghoy tras la destrucción del opio de Lin Zexu (1839). Primera oleada = bombardeo naval, luego desembarco y asalto. Un solo fuerte jugable; escenario y textos con ese rigor.
- El jugador maneja **arma personal** (mosquete + sable), no cañones. El cañón del fuerte es ambientación disparable con E (opcional, no central).
- Victoria: sobrevivir 3 oleadas → victoria. Sin fase final guionizada en v1.
- Integridad del fuerte: la dañan los cañones de campaña británicos y los ataques cuerpo a cuerpo en la muralla. El jugador reduce el daño priorizando artilleros enemigos. Sin reparación en v1.
- Listón de terminado: arranca, menú → batalla → victoria/derrota → reinicia, sin errores de consola. Sin pulido extra en v1 (partículas, música, animaciones avanzadas).
- Campaña futura: código ordenado y oleadas/misiones en un archivo de configuración simple; sin abstracciones anticipadas.
- Assets: originales/low-poly generados por código; audio por Web Audio API.

## Partes que decide el builder
- Estructura exacta de archivos y módulos.
- Balance concreto (daño, vida, tiempos de recarga, número de enemigos por oleada) — criterio: "difícil pero justo en 5–10 minutos de partida".
- Diseño visual detallado de modelos low-poly.
- Textos de intro/outro (mantener rigor histórico y tono épico, frases cortas).
- Si usa `npx serve` o `file://` para jugar.

## Verificación
- Abrir `index.html` en el navegador: el juego arranca sin errores de consola.
- Jugar una partida completa: menú → batalla → victoria o derrota → reiniciar.
- Controles responden, puntero se captura/libera con Esc.
- HUD actualiza salud/munición/oleada/integridad del fuerte.
- Sin assets externos: red desactivada y el juego sigue cargando.

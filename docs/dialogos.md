# Diálogos — Fuego en Humen

Lenguaje: **español**, frases cortas para toast/HUD (ideal ≤ 90 caracteres).
Tono: épico sobrio, histórico, sin caricaturas: los dos bandos son personas.
Ficción alt-histórica: la victoria es aspiracional; la Humen real cayó el 26 feb 1841 con el comandante Guan Tianpei.

> Para usarlos en el juego desde `js/dialogues.js`:
> `DIALOGUES.intro`, `DIALOGUES.waves[1..3]`, `DIALOGUES.victory`, `DIALOGUES.defeat.soldier|fort`, `DIALOGUES.barks.*`
> Son datos: el código los puede mostrar en `#intro-toast`, `#hud-mission` o pantallas de `js/screens.js` tal cual.

## Personajes

| Rol | Quién | Voz |
|---|---|---|
| **Jugador** | Chen, soldado Qing del fuerte | Silencioso en combate; susurros breves de determinación. |
| **Comandante Guan** | Guan Tianpei (adaptado) | Órdenes cortas, firme, sin discursos. |
| **Wei** | Cañonero del patio | Gritos técnicos: carga, apuntado, ¡fuego! |
| **Xiao Ping** | Recluta joven | Nervioso, leal; grita lo que ve. |
| **Mayor Gough** | Avance británico (Hugh Gough) | Seco, profesional, desprecia la defensa local. |
| **Ben** | Casaca roja veterano | Burlón al principio, serio al final. |
| **Jack** | Artillero británico | Cifras, puntería, frustración. |
| **Maestro Xu — Narrador** | Escribano de la aduana de Humen | **La voz del juego.** Hombre mayor, pausado, tono de cronista que vio 1839 y cuenta 1841. No combate: narra desde el puerto. |

### Narrador — Maestro Xu

- **Quién es:** escribano de la aduana de Humen. Estuvo allí cuando Lin Zexu destruyó el opio y sobrevivió para recordarlo.
- **Voz:** TTS español vía `Web Speech API` (sin assets, funciona offline). Config: `lang: es-ES, rate: 0.92, pitch: 0.85`. Válvula: tecla `V` o botón «🎙️ Voz: Maestro Xu» en las menú. Si el navegador no tiene voz española, usa la de sistema sin romperse.
- **Cuándo habla:** briefing al pulsar **Jugar**, al empezar cada oleada y al terminar (victoria / caída / fuerte tomado). Las líneas están en `DIALOGUES.narrator.lines` (`briefing`, `wave1-3`, `victory`, `defeatSoldier`, `defeatFort`). Código: `js/voice.js` + `main.js:narrate*`.

**Maestro Xu (briefing):** «Humen, mil ochocientos cuarenta y uno. Yo, Xu, vi arrojar el opio al mar en mil ochocientos treinta y nueve. Hoy vuelve la escuadra inglesa a cobrarse. Tú estás en la muralla.»

**Maestro Xu (oleada 1):** «La primera balsa toca la arena. Los casacas rojas marchan paso doble.»

**Maestro Xu (oleada 2):** «La segunda ola trae cañones. La piedra aprenderá a temblar.»

**Maestro Xu (oleada 3):** «La última fila ataca la brecha. Si cae la muralla, cae el río.»

**Maestro Xu (victoria):** «El mar se queda sin botes. El fuerte, contra toda razón, sigue en pie.»

**Maestro Xu (caída):** «El soldado cae. Pero la muralla aún guarda el aliento.»

**Maestro Xu (fuerte):** «La piedra se abre. El río, esta vez, no nos escucha.»

## 1) Briefing (clic Jugar)

**Comandante Guan:** «Chen. Las bocas ya están cargadas. La flota inglés no perdonó 1839, hoy cobra su opio en plomo.»

**Wei:** «¡Cañón dos, lista! Si ves mi humo, aparta—no, quédate. Necesito ojos en la muralla.»

**Xiao Ping:** «¿Aún quedan barcos? El mar se puso negro.»

**Comandante Guan:** «Defendemos la entrada del río. Que no bajen la muralla. Que no te baje el aliento.»

**Chen:** «A sus órdenes.»

**Toast (4 s):** `Humen, 1841. Desembarcan. ¡A las murallas!`

## 2) Oleada 1 — Desembarco

**Comandante Guan:** «Primera balsa en la arena. Mosquetes a la vez. ¡No regalen el disparo!»

**Xiao Ping:** «¡Ahí! ¡Rojo en la orilla! ¡Los veo!»

**Ben (a lo lejos):** «¡Compañía, formen! ¡Paso doble!»

**Chen (tras un impacto):** «Uno menos en la fila.»

**Wei:** «¡Fuego del cañón dos! ¡Abajo, Chen!»

**Comandante Guan (cierre de oleada):** «Respira. Cargan pólvora. La segunda viene con fierros.»

Toast: `Oleada 1 repelida. Prepárate. Viene la artillería.`

## 3) Oleada 2 — Artillería

**Jack:** «Dos grados más… ¡Fuego! A ver si la muralla aprende.»

**Comandante Guan:** «¡Cañón enemigo en la playa! ¡Es prioridad, Chen!»

**Wei:** «¡Escucha el zumbido! ¡Eso no lo para un parapeto sin respetar el ángulo!»

**Xiao Ping:** «¡El suelo se movió! ¿Eso era el fuerte?»

**Mayor Gough:** «Un cañón por batería. Otra vez. Desgastamos la piedra hasta abrirla.»

**Chen (artillero abatido):** «Paz en el suelo.»

Toast: `Oleada 2 repelida. El asalto final entra por la brecha.`

## 4) Oleada 3 — Asalto final

**Comandante Guan:** «Esta es la última fila, Chen. Si cae la muralla, cae el río. ¡Y todo Humen!»

**Xiao Ping:** «¡Están pegados a los muros! ¡No puedo recargar!»

**Ben:** «¡Ya es la bandera! ¡Con el sable, muchachos!»

**Wei:** «¡Un cañón más! ¡Apunta tú, yo quemo!»

**Mayor Gough:** «Cierre lento. Gana quien no se rompe antes.»

**Chen (al final):** «¿Oyes el agua? Ya no hay barcos.»

## 5) Barks de combate (línea única)

_Se pueden disparar sin cortar la escena; una cada 8–12 s._

**Jugador / Chen**
- Al disparar: «Ahí va.»
- Al recargar: «Pólvora… manos firmes.»
- Con sable: «Sin bala, sin problema.»
- Al matar artillero: «Fuego apagado.»
- Al recibir daño: «Tengo el pecho entero.»

**Comandante Guan**
- Sin munición: «Sable, Chen. No te quedes mirando el pelo del cerdo.» _[expresión de desdén, opcional]_
- Fuerte bajo 50%: «La piedra aguanta. Tú también.»
- Fuerte bajo 20%: «¡Que les cueste cada ladrillo!»

**Wei (cañonero)**
- «¡Fuego cuando coloque la bandera delante de ti!»
- «¡Cuidado, vienen tantos que hasta el ruido los esconde!»
- «¡Huele a mar quemado! ¡Eso es bueno!»

**Xiao Ping**
- «¡Me tiemblan los dedos, pero no los pies!»
- «¡Si me caigo, recoge mi gorro!»
- «¿Eso era un águila o una bala?»

**Ben (enemigo)**
- «¡A cubierto! ¡Gritó de la muralla!»
- «¡Diablos, apuntan de verdad!»
- Al final: «Ellos sí que no huyen.»

**Jack (enemigo)**
- «¡Carga! ¡Carga! ¡Que el cañón no era para decorar!»
- «¡Le di! …No, fue la piedra.»

**Mayor Gough**
- Ocasional: «No hay gloria en una brecha barata. Tómenla.»
- Atraso: «No acepto que un fuerte de adobe sea una bahía.»

## 6) Pantallas de fin

### Victoria

**Comandante Guan:** «Escuchen ese silencio. El río sigue nuestro.»

**Wei:** «Soldo el cañón dos, comandante. Todavía humea.»

**Xiao Ping:** «¿Seguimos de guardia?»

**Comandante Guan:** «Siempre.»

**Pantalla:** «El fuerte resiste. Humen no cae.»

### Derrota — Has caído

**Xiao Ping:** «¡Chen! ¡Wei, ven! ¡Se desploma!»

**Wei:** «Ya no escucho mosquetes. Que al menos no se llevó el fuerte.»

**Comandante Guan:** «Retírenlo de la muralla. Y denle la playa.»

**Texto:** «Has caído defendiendo la muralla.»

### Derrota — El fuerte

**Comandante Guan:** «El adobe está lleno de agujeros. No hay tierra que aguante esto.»

**Ben:** «Habitación libre. Ni una ración de ron.»

**Mayor Gough:** «Anotad: Humen, 1841. Otro lugar que aprendió que no se discute con una escuadra.»

**Wei:** «Se fue el río…»

**Texto:** «El fuerte ha sido tomado por los británicos.»

## Notas de producción

- **Nombres y cargos:** Guan Tianpei (comandante histórico, 1841) y Hugh Gough (comandante británico del asalto) son personajes reales adaptados; sus líneas son ficción para el juego.
- **Pronunciación / subtítulos:** los barks británicos suenan mejor si se dejan en inglés corto: `Advance!`, `Fire!`, `Hold the wall!` con subtítulo en español.
- **Límites HUD:** ninguna línea de bark supera los 90 caracteres salvo briefing y finales, pensado para toast de 15 px.
- **Sin TTS aún:** estos textos están listos para usar con `js/dialogues.js` sin voz; si se agrega voz, cada entrada de bark es un `key` estable.

## Propuestas Fase 2 (campaña 1839-1842)

- **Bogue:** Guan / Lin Zexu flashback: «Humen 1839, lección dulce y amarga.»
- **Dinghai:** Wei evacuando; Ping pierde el gorro (callback).
- **Ningpo / Shanghái:** Gough escucha un inglés intérprete; Jack rebautiza la pólvora.
- **Zhenjiang:** cierre: Guan ya murió, Chen hereda el fuerte: «A sus órdenes.»

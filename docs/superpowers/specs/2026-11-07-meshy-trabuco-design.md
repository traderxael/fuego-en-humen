# Modelos Meshy y trabuco — diseño aprobado

## Objetivo

Sustituir el cañón procedural de **Fuego en Humen** por un cañón de bronce generado con Meshy, añadir una guarnición qing estática con armadura y agregar un quinto arma de fuego, el trabuco.

## Restricciones globales

- Repo vivo: `C:\Users\USUARIO\Documents\Qoder\2026-11-06\c78ab791`.
- No publicar, no hacer push y no crear commits sin autorización explícita. Los 28 cambios preexistentes quedan intactos.
- Three.js r160 UMD en `vendor/three.min.js`; no migrar a módulos ES.
- El juego debe seguir funcionando offline y con doble clic sobre `index.html` (`file://`). Nada de `fetch` de GLB, texturas, WASM ni módulos en runtime.
- GPU objetivo: GT 640 / 2 GB. La guarnición comparte geometría, materiales y texturas; no se añaden luces.
- Presupuesto de partida: 71 créditos Meshy. Estimación aprobada: cañón 21, soldado 18, total 39, con margen para reintentos.
- No se reemplazan los soldados británicos: sus oleadas llegan a 34 instancias y deben seguir siendo baratas.

## Pipeline de assets

1. Generar la imagen de diseño con `meshy_text_to_image` y revisarla antes de gastar en geometría.
2. Generar GLB texturizado con `meshy_image_to_3d`, geometría `meshy-t2.5`, `model_type: smart-topology`.
3. Descargar el GLB a una carpeta temporal fuera del repo.
4. Pasarlo por Blender headless: importar, decimar, normalizar escala/orientación, reescalar texturas a un máximo de 1024 px y exportar GLB **sin Draco** y con texturas embebidas.
5. Convertir el GLB final a base64 dentro de `assets/models/cannon.model.js` y `assets/models/qing.model.js`, en el mapa global `window.HUMEN_ASSETS`.
6. Vendorizar `GLTFLoader` de three r160 como script IIFE que añade `THREE.GLTFLoader`, usando un shim que toma los símbolos del `THREE` global. No se necesita `DRACOLoader` porque Blender elimina Draco.
7. `js/assets.js` decodifica base64 y usa `GLTFLoader.parse`. Registra los objetos por nombre y entrega clones con geometría/materiales compartidos.
8. Si un asset falta o falla al parsear, se registra un `console.warn` y se usa la primitiva existente. Nunca se bloquea el arranque por un asset.

La ruta crítica ya se validó en un sandbox con three r160, un GLB exportado por Blender y base64: la escena se parseó sin red y conservó sus mallas y material PBR.

## Modelos

### Cañón de bronce

`Models.makeCannon()` devuelve un clone del asset `cannon` cuando está disponible y la primitiva actual en caso contrario. Conserva `userData.type = 'cannon'` y la orientación con el cañón apuntando a `-Z`. Se reutiliza en los cuatro cañones del fuerte y en la artillería enemiga.

Escala objetivo: aproximadamente 2,2 m de largo y origen en la base. En Blender se normaliza para que la boca apunte a `+Y`; el exportador glTF lo convierte en `-Z`, con `+Y` como vertical. La conversión se comprobó con el modelo importado y una captura: la boca original apunta a `-X`, por lo que se aplica un giro de -90° alrededor de Z.

### Guarnición qing

Seis clones del asset `qing`, sin IA ni cuerpo físico. Comparten geometría, material y textura. Posiciones en coordenadas locales del fuerte:

- Dos sobre el parapeto norte, en `x = -16` y `x = 16`, `y = 1.3`, `z = -14`, mirando al mar.
- Dos sobre los brazos laterales, en `x = -23` y `x = 23`, `y = 4`, `z = -16`.
- Dos en el patio junto a la muralla sur, en `x = -14` y `x = 14`, `y = 0`, `z = 10`, mirando al mar.

`world.garrison` expone los clones y `world.update(t)` aplica un balanceo sutil de `rotation.z`. No bloquean al jugador ni reciben disparos: son decoración deliberada, no combatientes.

## Trabuco

Quinta arma y quinta tecla de la armería.

```js
trabuco: {
  name: 'trabuco',
  label: 'Trabuco',
  type: 'rifle',
  damage: 22,
  pellets: 8,
  spread: 0.07,
  clipSize: 1,
  fireCooldown: 1.15,
  reloadTime: 2.8,
  desc: 'Boca ancha qing. Ocho perdigones devastadores de cerca, inútiles de lejos.',
}
```

- `physics.fireShotgun({ from, dir, spread, damage, pellets, owner })` crea ocho proyectiles independientes, cada uno con su dirección aleatoria dentro del cono y `kind: 'shotgun'`. Devuelve el array creado. No crea estelas.
- `physics.fireMusket` conserva su comportamiento actual; el proyectil admite `kind` para distinguir el trabuco.
- `Enemies.applyHit` usa fuerza de knockback `0.1` para `kind === 'shotgun'`, evitando multiplicar por ocho el empujón.
- `main.js` no reproduce ocho sonidos de impacto por disparo: el trabuco conserva el hit marker, pero no el `sfx('hit')` por perdigón.
- El gasto de munición, cooldown y recarga ocurren una vez por disparo, no por perdigón.
- `player.js` añade el viewmodel y la rama `def.pellets > 1`; `screens.js` añade icono y la línea `8 × 22 daño · Carga 1 · Recarga 2.8 s`.

## Arranque asíncrono

La intro se muestra inmediatamente porque sólo usa DOM. La carga de modelos empieza en paralelo y el mundo se construye cuando termina. El botón **Comenzar el asalto** queda deshabilitado hasta que el mundo esté listo; al fallar un asset se habilita igualmente con las primitivas.

## Documentación

Actualizar `README.md`: cinco armas, teclas `1`–`5`, pipeline de Meshy y crédito «Modelos 3D generados con Meshy AI (plan gratuito)». Eliminar la afirmación absoluta de que no existen assets externos; el juego sigue siendo offline. Actualizar `vendor/README.md` con la receta del bundle.

## Verificación

- `node --test tests/*.test.js` para configuración, armería, registro/clonado de assets, proyectiles del trabuco y knockback.
- Navegador real con `http://localhost:8820/?debug=1`: consola sin errores, cañones PBR presentes, seis qing visibles, trabuco equipable y ocho proyectiles por disparo.
- Medir FPS antes y después con el mismo recorrido. Si hay regresión severa, reducir polycount/texturas y luego la guarnición; no afirmar rendimiento sin evidencia.

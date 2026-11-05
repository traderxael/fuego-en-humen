# Fuego en Humen — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build "Fuego en Humen", a playable browser FPS of the Qing defense of the Humen/Anunghoy forts (1841), per the approved spec.

**Architecture:** Single-page Three.js game. Pure-logic modules (config, state machine, combat math) are plain JS files loadable both by the browser (`<script>` tags, no build step) and by Node for unit tests. Rendering/scene code lives in separate modules. No external assets — models are low-poly primitives, audio is Web Audio API.

**Tech Stack:** Three.js (copy `C:\Users\USUARIO\juego-3d-demo\three.min.js`), vanilla JS (no build step, no npm deps), Node for logic unit tests (`node --test`), served with `npx serve` or `file://`.

**Spec:** `C:\Users\USUARIO\juegos\guerra-opio-humen\docs\superpowers\specs\2026-11-04-humen-fps-design.md`

## Global Constraints

- Platform: Windows 10/11, modern browser; must run offline, no remote assets.
- No assets copied from Call of Duty or any commercial game — all models/audio original or generated.
- UI text in Spanish; historical copy concise and correct (Lin Zexu, Humen, 1841).
- Scope v1: one battle, 3 waves, mosquete + sable, win = survive 3 waves, lose = player HP 0 or fort integrity 0.
- No polish extras: no particles, no music, no advanced animation states.
- No git identity exists yet for auto-commit; initialize git in Task 1 and ask the human partner before first commit if `git config user.name` is missing.
- Project root: `C:\Users\USUARIO\juegos\guerra-opio-humen` (paths below are relative to it).

## Review Focus

1. Pointer lock released mid-game (Esc) → game must pause cleanly and show a "Clic para continuar" overlay; clicking re-locks. Test: state machine test for `playing ↔ paused`.
2. Tab closed/reload mid-fight → no partial state saved; plain reload restarts to menu. Test: none needed beyond manual reload check (document in verification).
3. Enemy AI stuck on walls/fort edge → enemies must path around via simple steering + waypoint, never NaN position. Test: unit test for `steerTowards` returns finite vector on obstacle; manual playtest.
4. Fort integrity dropped to exactly 0 same frame as player HP 0 → defeat screen regardless of cause; `fortIntegrity` never goes below 0 in HUD. Test: state machine unit test.
5. Reload spam (R pressed repeatedly) → reload timer resets once, not stacked; ammo cannot go negative. Test: unit test for `startReload`.

---

### Task 1: Project scaffold + git + smoke page

**Files:**
- Create: `index.html`, `css/style.css`, `js/main.js`, `.gitignore`
- Copy: `vendor/three.min.js` (from `C:\Users\USUARIO\juego-3d-demo\three.min.js`)
- Test: manual (browser opens page)

- [ ] **Step 1:** `git init` in project root; `.gitignore` with `node_modules/`, `.DS_Store`.
- [ ] **Step 2:** Copy `three.min.js` to `vendor/three.min.js`.
- [ ] **Step 3:** `index.html` loads `vendor/three.min.js`, `css/style.css`, `js/main.js`; `js/main.js` creates a renderer, scene, camera, one rotating cube (placeholder), and an animation loop. No errors in console.
- [ ] **Step 4:** Open `file:///C:/Users/USUARIO/juegos/guerra-opio-humen/index.html`; cube visible, console clean.
- [ ] **Step 5:** Commit `chore: scaffold project` (after confirming git identity with the human partner).

### Task 2: Pure game logic modules (TDD)

**Files:**
- Create: `js/logic/config.js` (weapon defs, wave defs, fort integrity, HP), `js/logic/state.js`, `js/logic/combat.js`
- Test: `tests/logic.test.js` (run with `node --test tests/`)

**Interfaces:**
- Produces: `WEAPONS = { mosquete: {...}, sable: {...} }`, `WAVES = [ {count, interval, hp, damage}, ... ]` (3 waves), `createGameState()` → `{ phase: 'menu'|'playing'|'paused'|'victory'|'defeat', wave, playerHp, fortIntegrity, score }`, `setPhase(state, phase)` (legal transitions only), `startReload(weapon, state)`, `applyWaveDamage(state, amount)`, `applyPlayerDamage(state, amount)`, `nextWave(state)`, `steerTowards(from, to)`.

- [ ] **Step 1: Write failing tests** — `node --test tests/logic.test.js`:
  - `createGameState()` returns phase `menu`, wave 1, playerHp 100, fortIntegrity 100.
  - `setPhase(state, 'paused')` then `setPhase(state, 'playing')` round-trips; `setPhase(state, 'victory')` from `menu` is rejected (only legal transitions allowed: menu→playing, playing↔paused, playing→victory|defeat).
  - `startReload` twice in same tick does not double `reloadingUntil`.
  - `applyWaveDamage(state, 150)` clamps fortIntegrity at 0 and phase becomes `defeat`.
  - `applyPlayerDamage(state, 100)` sets playerHp 0 and phase `defeat`.
  - `nextWave` after wave 3 sets phase `victory` (waves exhausted).
  - `WAVES` has exactly 3 entries; counts escalate (e.g. 6, 9, 12).
- [ ] **Step 2:** Run tests; expect FAIL (modules missing).
- [ ] **Step 3:** Implement `js/logic/config.js`, `js/logic/state.js`, `js/logic/combat.js` (plain `module.exports` guarded so they also work as browser globals: `if (typeof module !== 'undefined') module.exports = {...}`).
- [ ] **Step 4:** Tests PASS.
- [ ] **Step 5:** Commit `feat: pure game logic with tests`.

### Task 3: 3D world — fort, terrain, sea, ships

**Files:**
- Create: `js/world.js` (exports `buildWorld(scene)` → `{ fort, walls, sea, ships }`)
- Create: `js/models.js` (low-poly builders: `makeQingSoldier()`, `makeBritishSoldier()`, `makeShip()`, `makeFortWall()`)

**Interfaces:**
- Produces: `buildWorld(scene)`; models are `THREE.Group` with userData `{ type }`.

- [ ] **Step 1:** Implement `models.js`: Qing soldier (blue/robe-ish cloth colors, conical hat brim, musket cylinder), British soldier (red coat, black shako, musket), ship (hull box + masts), fort wall (adobe-colored boxes, crenellations).
- [ ] **Step 2:** Implement `world.js`: ground plane (sand), sea plane (blue, slight transparency), fort = U-shaped wall with parapet, 4 cannons as props (one interactive later), 2–3 ships anchored offshore, fog + hemisphere/directional light.
- [ ] **Step 3:** Smoke test in browser: camera looks at fort from sea side; console clean. Commit `feat: low-poly world and models`.

### Task 4: Player controller — pointer lock, movement, weapons

**Files:**
- Create: `js/player.js` (exports `createPlayer(camera, domElement)` with `update(dt)`, `shoot()`, `switchWeapon(i)`, `state` bridging to logic modules)
- Modify: `js/main.js`, `index.html` (HUD placeholder elements)

**Interfaces:**
- Consumes: `WEAPONS` from `js/logic/config.js`.
- Produces: player object; `pointerlockchange` → `state.phase = 'paused'` overlay.

- [ ] **Step 1:** Pointer lock on canvas click; WASD + Shift run; mouse look; camera height 1.7.
- [ ] **Step 2:** Weapons: mosquete (damage 80, clip 1, reload 2.6s, bolt-action cadence 1.1s), sable (melee range 2.2m, damage 60, fast). R reloads via `startReload`. 1/2 switch.
- [ ] **Step 3:** Shooting: raycast center-screen; enemy hit → enemy HP -= damage; HUD ammo updates.
- [ ] **Step 4:** Esc pauses (overlay "Clic para continuar"); click re-locks.
- [ ] **Step 5:** Manual test in browser: walk around, shoot, reload, switch weapons, pause/resume. Commit `feat: player controller`.

### Task 5: Enemies — waves, AI, spawning

**Files:**
- Create: `js/enemies.js` (exports `spawnWave(scene, waveDef)`, `updateEnemies(dt, player, world, callbacks)`)
- Modify: `js/main.js`

**Interfaces:**
- Consumes: `WAVES` from config; `makeBritishSoldier` from models.
- Produces: `steerTowards(from, to)` → finite unit vector (NaN-safe when from==to), `onEnemyReachWall(enemy)` and `onEnemyDamagePlayer(dmg)` callbacks wired in `main.js`.

- [ ] **Step 0: Write failing test** in `tests/logic.test.js`: `steerTowards({x:0,z:0},{x:0,z:0})` returns a finite vector (length ≥ 0, no NaN). Run; expect FAIL. Implement `steerTowards` in `js/logic/combat.js`; expect PASS.

- [ ] **Step 1:** Spawn points on beach (3–5 positions); `updateEnemies`: steer toward fort wall breach, stop at 30m to fire (damage player on LOS timer), or advance to melee if wall integrity low; melee attack damages fort (`applyWaveDamage`) via callback.
- [ ] **Step 2:** Enemy HP bars not required; hit flash (material emissive pulse 80ms) instead.
- [ ] **Step 3:** Objective artillery: each enemy artillery unit (1 per wave, spawns wave ≥2) fires every 6s → `applyWaveDamage(state, 8)`.
- [ ] **Step 4:** Manual test: wave 1 spawns, advances, shoots; fort HP drops; killing all advances wave. Commit `feat: enemy waves and AI`.

### Task 6: HUD, menu, victory/defeat screens

**Files:**
- Create: `js/hud.js`, `js/screens.js`; Modify: `index.html`, `css/style.css`, `js/main.js`

**Interfaces:**
- Consumes: `createGameState`, `WEAPONS`.
- Produces: `showMenu()`, `showVictory(stats)`, `showDefeat(cause)`, `updateHUD(state)` (health bar, ammo, wave "Oleada 1/3", fort integrity bar, crosshair, hit marker).

- [ ] **Step 1:** Menu screen: title "Fuego en Humen", subtitle historical brief (2–3 lines: 1841, Lin Zexu, the affray), "Jugar" button, créditos line.
- [ ] **Step 2:** HUD: top-left salud bar; bottom-right munición; top-center oleada; top-right integridad del fuerte bar; center crosshair + hitmarker.
- [ ] **Step 3:** Victory screen ("El fuerte resiste. Humen no cae.") and defeat screens (player death / fort taken) with "Reintentar" button → reload state.
- [ ] **Step 4:** Intro toast at battle start: "Humen, 1841 — Los británicos desembarcan. ¡A las murallas!" (auto-hide 4s).
- [ ] **Step 5:** Manual test: full loop menu→play→end→retry. Commit `feat: HUD and screens`.

### Task 7: Audio (Web Audio API, no assets)

**Files:**
- Create: `js/audio.js` (exports `sfx = { shot(), reload(), hit(), waveHorn(), defeat(), victory(), ambientSea() }`)
- Modify: `js/main.js`, `js/player.js`, `js/enemies.js` (call sites)

- [ ] **Step 1:** Implement: musket = short noise burst + lowpass; sable = metallic swish (bandpassed noise, fast pitch down); reload = two clicks; hit = thud; waveHorn = low sawtooth swell; victory/defeat = simple major/minor triad arpeggio; ambient sea = filtered noise loop with LFO.
- [ ] **Step 2:** Wire calls: shoot → `sfx.shot()`, enemy hit → `sfx.hit()`, wave start → `sfx.waveHorn()`, end screens → respective jingles.
- [ ] **Step 3:** Manual test: all SFX audible, no console errors. Commit `feat: procedural audio`.

### Task 8: Final integration + verification

**Files:** Modify any; no new features.

- [ ] **Step 1:** Run `node --test tests/` — all pass.
- [ ] **Step 2:** Fresh `file://` load with network disabled: menu → battle → win/lose both reachable (use devtools to force fortIntegrity=1 or playerHp=1 for defeat path) → retry works.
- [ ] **Step 3:** Console has zero errors; Esc pause/resume works; reload while mid-reload does not stack (per Review Focus).
- [ ] **Step 4:** Update `README.md` with: how to play, controls, historical note, "Fase 2: campaña hasta el Tratado de Nankín".
- [ ] **Step 5:** Commit `docs: readme and verification`.

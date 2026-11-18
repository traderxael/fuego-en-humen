# Créditos de Assets 3D — Fuego en Humen

## Props CC0 (Poly Pizza / Quaternius / Pichuliru)
Reutilizados e integrados desde [traderxael/oriental-arena-warriors](https://github.com/traderxael/oriental-arena-warriors) y [Poly Pizza](https://poly.pizza) bajo licencia **Public Domain (CC0 1.0)** (`assets/models/props/` y dentro de los escenarios Blender `assets/models/cinematics/`):

- **Arch** (`assets/models/props/arch.glb`)
  - Autor: **Quaternius**
  - Fuente: https://poly.pizza/m/QwWdOcNIMh
  - Licencia: Public Domain (CC0 1.0) — https://creativecommons.org/publicdomain/zero/1.0/
- **Column** (`assets/models/props/column.glb`)
  - Autor: **Quaternius**
  - Fuente: https://poly.pizza/m/wLubNpOTX4
  - Licencia: Public Domain (CC0 1.0) — https://creativecommons.org/publicdomain/zero/1.0/
- **Torch** (`assets/models/props/torch.glb`)
  - Autor: **Quaternius**
  - Fuente: https://poly.pizza/m/Gq38E7hFZw
  - Licencia: Public Domain (CC0 1.0) — https://creativecommons.org/publicdomain/zero/1.0/
- **Katana / Blade prop** (`assets/models/props/katana.glb`)
  - Autor: **Pichuliru**
  - Fuente: https://poly.pizza/m/15A7InejC7
  - Licencia: Public Domain (CC0 1.0) — https://creativecommons.org/publicdomain/zero/1.0/

## Personajes 3D riggeados (Hyper3D Rodin)
- `assets/models/soldado-britanico-1841-rigged.glb` — Soldado británico (52 huesos, clips de marcha, idle y muerte), generado con [Hyper3D Rodin](https://hyper3d.ai).
- `assets/models/qing-soldier-rigged.glb` y `assets/models/guan-tianpei-rigged.glb` — Guarnición Qing y comandante Guan Tianpei (52 huesos, clips `HumanSpOffensiveIdle`, `HumanSpJogging`/`HumanSpWalking`, `HumanSpDying`, texturas WebP embebidas), integrados desde [traderxael/oriental-arena-warriors](https://github.com/traderxael/oriental-arena-warriors) con fallback al rig esquelético procedural (`js/rig/humanoid.js`).

## Escenarios cinemáticos 3D (Blender 5.3)
- `assets/models/cinematics/humen-1839-opium.glb`
- `assets/models/cinematics/humen-squadron-bogue.glb`
- `assets/models/cinematics/humen-assault-breach.glb`
- `assets/models/cinematics/humen-fall-memorial.glb`

Construidos y texturizados proceduralmente en Blender 5.3 mediante `scripts/build_cinematic_models.py` combinando arquitectura histórica Qing/británica con los props CC0 anteriores.

# Kampung Quest — module contract (for parallel workstreams)

All runtime code is **classic scripts** (no ES modules — file:// rule) that attach to one namespace:

```js
(function (KQ) {
  "use strict";
  /* ... */
})((window.KQ = window.KQ || {}));
```

`THREE` is the global from vendored **r147** `games/kampung-quest/three.min.js`. Set `renderer.outputEncoding = THREE.sRGBEncoding`. Gate every fetched asset (texture, audio) on `KQ.CAN_FETCH = location.protocol !== "file:"` and always have a procedural fallback. ESLint applies to every file: functions ≤ 40 lines, depth ≤ 3, no console.log, no empty catch. Run `npx eslint <file>` after each batch.

## Layout (games/kampung-quest/)

| Path                                 | Owner       | Exposes                                                                                                                       |
| ------------------------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `js/data/prayer-times.js`            | research    | `KQ.PRAYER_TIMES` = `{ date:"2026-11-26", source, subuh, syuruk, zohor, asar, maghrib, isyak }` as `"HH:MM"` 24 h             |
| `js/data/azan.js`                    | research    | `KQ.AZAN_TEXT` = `[{ ar, translit, en, start, end }]` caption cues (seconds, matching the recording)                          |
| `assets/audio/azan.ogg` (+mp3)       | research    | Licensed recording; licence file alongside; row in `assets/CREDITS.md`                                                        |
| `js/sim/*.js`                        | systems     | Pure logic, **no THREE, no DOM** — see below. Unit-tested from Node (`tests/kampung-quest/*.test.mjs` via `node:test` + `vm`) |
| `js/figures/*.js`                    | figures     | `KQ.Figures` — see below                                                                                                      |
| `js/world/*.js` + `assets/textures/` | world       | `KQ.World` — see below                                                                                                        |
| `js/game/*.js`, `index.html`         | integration | Player controller, camera, input, NPC agents, HUD, audio, main loop (built after the above land, to the chosen mockup)        |

## KQ.Sim (systems)

- `KQ.Sim.Clock` — `create({ startMin=420, realSecPerGameMin=2 })` → `{ minute (0..1439.99), day, tick(dtSec), set(min), hhmm(), phase() /* 'night'|'dawn'|'day'|'dusk' */, sunFactor() /* 0..1 */ }`.
- `KQ.Sim.Prayer` — `create(times)` → `{ update(clockMinute, day) → events[], state(), startFlow(name), wuduStep(id) → {ok, hint}, prayStep(id) → {ok, hint, done}, nextWuduStep(), nextPrayStep(), due(), isBlockingMissions() }`. The sequences are data-driven (`KQ.Sim.Prayer.WUDU_STEPS`, `.rakaatPlan(name)` → step list incl. tasyahud awal/akhir, salam). The statuses are `upcoming|due|in-progress|done|qada|qada-done`.
- `KQ.Sim.Needs` — hunger/energy 0..100, drain per game minute, `eat(item)`, `rest(min)`.
- `KQ.Sim.Economy` — coins (never < 0), `KQ.Sim.MENU` (≥ 8 halal dishes, by stall), the shop items, `buy(id)`.
- `KQ.Sim.Missions` — `KQ.Sim.MISSIONS` data (≥ 8; each has id, title, giver NPC id, steps `[{type:'goto'|'talk'|'buy'|'deliver'|'collect', target poi/npc id, count?}]`, reward); `create()` → `{ available(), accept(id), active(), notify(event{type, target}), progress(), paused flag honoured }`.
- `KQ.Sim.Save` — `load(storage) / save(storage, state)`, key `kampung-quest:v1`, schema-checked, clamped, never throws.
- `KQ.Sim.Schedule` — NPC routine table: `routineFor(npcId, minute, prayerState)` → `{ poi, activity:'walk'|'sit'|'eat'|'shop'|'pray'|'idle'|'play' }`.

POI ids (shared vocabulary for world + sim): `home`, `block_a`, `block_b`, `block_c`, `hawker`, `stall_prata`, `stall_nasi_lemak`, `stall_mee_soto`, `stall_drinks`, `stall_satay`, `mosque_gate`, `mosque_wudu`, `mosque_hall`, `minimart`, `barber`, `clinic`, `library`, `playground`, `bus_stop`, `park`, `recycling`.

NPC ids (shared): `nenek`, `atuk`, `imam_hakim`, `makcik_siti`, `pakcik_rahman`, `uncle_lim`, `aunty_mei`, `hawker_ali`, `hawker_aminah`, `barber_raju`, `dr_nurul`, `librarian_farah`, `kid_irfan`, `kid_aisyah`, `kid_wei`, `postman_dan`.

## KQ.Figures (figures)

- `KQ.Figures.build(spec)` → `THREE.Group` with `userData.rig = { root, hips, torso, head, armL, armR, handL, handR, legL, legR, accessory? }`. Toy-figure scale: 1 world unit = 1 m, figure ≈ 1.0 m tall (stylised kid-world scale; doors ~1.6 m).
- `KQ.Figures.CAST` — the specs keyed by the NPC ids above + `hero`.
- `KQ.Figures.pose(rig, name, phase01, weight)` with names: `idle`, `walk`, `run`, `sit`, `eat`, `wave`, `talk`, `carry`, `wudu_hands`, `wudu_face`, `wudu_feet`, `qiyam`, `takbir`, `ruku`, `itidal`, `sujud`, `julus`, `salam_r`, `salam_l`, `doa`. `KQ.Figures.Animator(rig)` → `{ play(name, fadeSec), update(dt) }`.
- Materials: shared, cached glossy plastic (`MeshPhysicalMaterial`, clearcoat), printed faces/torso prints via `CanvasTexture` (no external images needed, so it works on file://).

## KQ.World (world)

- `KQ.World.build(scene, { quality })` → `{ pois: { [poiId]: { pos: Vector3, facing: radians, radius } }, colliders: [{minX,maxX,minZ,maxZ}] (AABB, XZ), walkGraph: { nodes:[{id,x,z}], edges:[[a,b]] } (sidewalks/crossings for NPC pathing), interactables:[{id, poi, pos, label}], lights:{ sun, hemi, street:[...] }, update(dt, clock) /* sky, sun angle, streetlights, window glow */, setQuality(tier) }`.
- Textures: CC0 photographic PBR (ambientCG / Poly Haven), ≤ 1024 px JPEG, credited in `assets/CREDITS.md`, with a procedural CanvasTexture fallback when `!KQ.CAN_FETCH`.

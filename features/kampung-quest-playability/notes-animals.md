# Kampung Quest playability: animals (AC-P5..P7)

Workstream notes for section B of `requirements.md`: camels you can greet and ride, horses and ponies.

## What changed

- **Rideable animals** (new, separate from the instanced herd): 3 camels in Makkah (two in a fenced "camel & horse rides" lot next to the camel yard, one at the palm oasis), 3 horses at a stable in the same lot, and 2 ponies at a new pony-ride corner at the east end of the kampung park (by block C's void deck). The original herd (yard, caravan, oasis; six instanced meshes) is untouched.
- **Interact menu.** Within ~2 m an animal shows a "Camel" / "Horse" / "Pony" prompt; pressing it (tap, E) opens a card with **Say hi**, **Ride** and **Not now** (keyboard operable, the shared sheet / focus trap). Say hi: the head turns to the hero and nods twice, the tail swishes, a soft synth call (camel grunt, horse whinny + snort, higher pony whinny) and a toast "Sandy grunts hello!".
- **Riding.** The hero sits on the saddle (camel: in front of the hump, legs forward, `ride_camel` pose; horse / pony: astride, hands on the reins, `ride` pose, bouncing with the stride). Steering is camera-relative like walking (the animal turns toward where the stick points, can turn on the spot). Top speeds: camel 1.8x run (7.9 m/s), horse 2.2x (9.7 m/s), pony 2.0x (8.8 m/s). Gaits by speed: camel walk / pace, horse and pony walk / trot / canter, with real footfall orders and knee folds; soft hoof clops. Jump while riding = "Pat" (the animal calls). The camera eases back; Exit slows to a stop and sets the hero down on the first free spot beside it (not in a no-ride zone).
- **Never hurts anyone / stays put.** The ridden animal brakes for people with `KQ.Sim.Vehicle.speedCap` / `brakeFor` (same rules as the cars), collides with colliders (two circles, `Collide.settle`, legs of 0.2 m), follows the ground, and stops at the vehicles' no-drive zones (Haram, mataf, mas'a, plazas, kampung mosque...) with "Let's walk inside the masjid. Animals wait outside." / "Animals wait outside here. Let's get down and walk.". A standing animal is a collider (hero, NPCs and crowd keep out; the crowd prunes slots it covers on the first frame). An animal left far from home goes back when the hero is far away.

## Files

| Layer   | File                       | Role                                                                                                                                                                         |
| ------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| sim     | `js/sim/mount.js`          | `KQ.Sim.Mount`: specs, camera-relative steer, gaits + footfall, `legPose` / `stance`, `exitSpots`, `yieldTo` (people). Unit-tested.                                          |
| figures | `js/figures/animal-rig.js` | `KQ.Figures.AnimalRig`: a whole animal as ONE rigidly skinned mesh (13 bones), geometry kit (ell / limb / box / cone), `pose()`.                                             |
| figures | `js/figures/horse-mesh.js` | `KQ.Figures.HorseMesh`: toy horse spec (mane, forelock, tail, ears, saddle + blanket + stirrups, bridle + reins), coats bay / chestnut / grey / black / palomino.            |
| figures | `js/figures/ride-poses.js` | `ride`, `ride_camel` poses (loads before `animator.js`).                                                                                                                     |
| world   | `js/world/stables.js`      | `KQ.WorldParts.Stables`: the Makkah lot (fence with a street gate, stable shed, hay, trough) and the kampung pony corner (fence, sand, hay, flag); `MOUNTS` and `POIS` data. |
| game    | `js/game/mounts.js`        | `KQ.Game.Mounts`: spawn, cull (> 60 m not drawn / posed), prompt, menu, say hi, send home, `debug()`.                                                                        |
| game    | `js/game/mount-ride.js`    | `KQ.Game.MountRide`: mount, steer, zones, walls, people, seat, camera, exit.                                                                                                 |
| game    | `js/game/mount-rigs.js`    | builds the camel rig from the herd's own part geometry and the horse / pony rig; idle / hi / stride poses; `seatOf`.                                                         |
| game    | `js/game/mount-sound.js`   | synth calls and clops; silent under azan / prayer / mute / pause / hidden (`Audio.bus().ok`).                                                                                |

Small hooks into shared files (one or two lines each): `loop.js` (`Mounts.update` after `Vehicles.update`, skips `Player.update` while riding), `interact.js` (target, dispatch `mount:` ids, icons, Exit-only while riding), `actions.js` (Jump = pat while riding), `hooks.js` (`mounts`, `mountAct`), `holy-makkah.js` (build + reserve the lot), `holy-world.js` (Makkah POIs), `world.js` (build the pony corner), `world-build.js` / `world-runtime.js` (kampung POI), `index.html` (scripts in layer order).

## POI ids (for the map)

| id             | region  | where                                     | `label`        |
| -------------- | ------- | ----------------------------------------- | -------------- |
| `camel_yard`   | Makkah  | (-193, -132), the rides lot's street gate | "Camel rides"  |
| `horse_stable` | Makkah  | (-184, -132), same gate, east half        | "Horse stable" |
| `camel_oasis`  | Makkah  | (-158, 92), by the oasis camel            | "Oasis camel"  |
| `pony_ride`    | kampung | (57.6, 40), the pony corner's west gate   | "Pony ride"    |

They live in the world's own POI tables (Makkah's survives the city swap in `holy-world.js`), with `pos`, `facing`, `radius` and the nearest walk-graph `node`, plus a `label`. `KQ.WorldParts.Stables.POI_IDS` lists them.

## Test hooks

- `__kq.mounts()`: `{ ready, region, riding, hi, menus, sound: {calls, clops, refused, last}, list: [{id, kind, name, x, z, y, heading, speed, gait, phase, visible, ridden, greeting}], exiting, blocked, braked, rides, exits, zones, note }`.
- `__kq.mountAct(id)`: `"mount:<id>"` opens the menu, `"mount:hi:<id>"` / `"mount:ride:<id>"` act, `"mount:exit"` gets down. Animal ids: `camel_sandy`, `camel_dune`, `camel_noor`, `horse_barq`, `horse_layla`, `horse_amber`, `pony_kiwi`, `pony_bintang`.

## Tests

- `npm run test:kq` → `tests/kampung-quest/mount.test.mjs` (8 tests: speeds, dead zone, camera-relative turning, gaits, legs move, stride phase, never reaches a person, exit spots).
- `tests/kampung-quest-mounts.spec.mjs` (13 tests, ~2 min): POIs + one skinned mesh per animal, Say hi (menu, head turn, sound gate), mute gate, camel ride (> 1.5x run, gait, legs move, on the ground, hero high on the hump), Exit on free ground (camel solid again), no entry into the Haram with the friendly line, horse ride (> 1.9x run, trot / canter), draw calls, ponies + `pony_ride`, pony ride + exit, no console errors.
- Draw calls, low tier (`stats().calls`, incl. shadows): Makkah rides lot 105-118, oasis 98-137, the outskirts spec's four views unchanged in budget (max < 400, passes); kampung pony corner 158-176, park 245. Each animal is 1 call (no shadow caster on low).

## Decisions

- **One skinned mesh per animal** (rigid skinning, every vertex 100 % on one bone) instead of a THREE.Group of parts: an animated quadruped costs 1 draw call instead of ~12. Rejected: instancing like the herd (the ridden animal needs its own moving legs; instancing 8 rigs saves almost nothing).
- **The ridden camel reuses the herd's part geometry** (`CamelMesh.parts()`), split at the knee into two bones, so ridden and herd camels look alike. The rig is built in the game layer (it reads world geometry); horses are pure figures.
- **Camera-relative steering** for animals (like walking), not car steering: a 6-year-old pushes where they want to go; animals can turn on the spot.
- **Separate modules, not `vehicles.js`**, because another workstream is reworking vehicles; only the pure people-braking and zone tests of `KQ.Sim.Vehicle` and `G.VehicleSpots.zones()` are reused by call.
- The yard's fence is closed on all sides (unchanged), so the rideable camels stand in the new lot beside it, which has a gate to the street.

## Learnings

- `BufferGeometry.translate/scale/rotateX` also transform normals, so merged parts can keep their own smooth normals; recomputing normals on a non-indexed merge makes everything faceted.
- `SkinnedMesh.bind()` must run with the mesh at identity and the bones' world matrices updated (`mesh.add(rootBone); mesh.updateMatrixWorld(true)` first).
- `Collide.freeSpot` / `settle` can push a spot INTO a no-drive zone (e.g. next to the clock tower into the gate plaza); `blockedMove` then lets the animal leave but not re-enter. Test zone blocking from a spot clearly outside (the Haram's west side).

## Not done / risks

- No browser test drives an NPC into the ridden animal's path (the braking rule is unit-tested and is the vehicles' tested rule).
- The pony corner sits on block C's void-deck lawn, not inside the `LAYOUT.park` rectangle (the park's free ground is crossed by paths and trees); it is next to it and on the map.
- Screenshots: `shots/animals-camel-ride.png`, `shots/animals-horse.png`, `shots/animals-pony.png` (re-take with `PW_PORT=5602 node features/kampung-quest-playability/shoot-animals.mjs` while `node tools/serve.mjs 5602` runs).

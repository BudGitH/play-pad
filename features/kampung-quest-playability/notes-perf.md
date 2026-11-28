# Notes: low-tier draw calls on the integrated build (AC-14 budget <= 400)

Follow-up to `notes-ipad.md`, on the integration commit 3504764 (every playability workstream merged).

## How it was measured

- `perf/calls.mjs`: the orchestrator's sweep, extended. Low tier, phone frustum (844 x 390, rendered at 211 x 98, same aspect), 10:00. For each spot (home, block_b, block_c, hawker, playground, park, pony_ride, mosque_gate; in Haramain every POI) x each town event (none + all nine `WorldEvents.SCRIPTS`; an event the spot refuses is skipped) x 4 yaws: one frame's `renderer.info.render.calls` (shadow pass included), the shadow / main split, and the top contributors by object name (it wraps `renderer.renderBufferDirect`). Extras: the bus stop with the bus standing at it and the traffic running, and the mosque gate at Maghrib.
- Before = 3504764 served unchanged on its own port; after = this branch. Draw calls are deterministic (no timing noise), one run each.
- `perf/compare.mjs` makes the tables; `perf/shoot.mjs` the screenshots.

## Findings (before)

- 55 of 272 kampung views were over 400; worst 525 (park, photo event). Worst with no event: 448 (playground).
- The biggest share was the **toy figures**: every cast neighbour and every event actor is 14-15 part meshes (one material), drawn once in the main pass and again in the shadow pass. A football or kompang event adds 4-8 of them: +100-200 calls. In the playground + rain view, 13 figures = 182 main calls + ~100 shadow calls.
- Second: **parked vehicles** (5-10 calls each: body, roof, glass, trim, 4 wheels, ground blob; bicycles frame / fork / wheels), drawn up to 85 m away: ~140 calls in the park view.
- Haramain was already under budget (worst 332, gate + football).

## Changes

| Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Effect                                                                                                                                                   | Files                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **One draw call per figure** (`KQ.Figures.mergeRig`): the rig's parts become the bones of one `SkinnedMesh` (weight 1 per part, identity bone inverses, "attached" bind mode), the parts move to a hidden layer (31) so neither camera draws them. Posing still rotates the parts, so the poses, Animator, prayer rows and every test that reads a part are unchanged. The merged geometry rebuilds itself when a part's geometry, material or visibility changes (a per-render signature check), so dressing / head pieces / drapes need no change. Props held in a hand stay separate meshes. Applied to the cast NPCs and the event actors; **not the hero** (repainted in place by the wardrobe; one figure). | A figure costs 1 + 1 (shadow) instead of ~14 + ~14. Pixel-identical (ImageMagick `compare -metric AE` = 0 on a football view at the playground).         | `js/figures/rig-merge.js` (new), `npc-agent.js`, `event-actors.js`, `index.html` |
| Parked vehicles on the low tier are drawn to 55 m instead of 85 m (a car past 55 m is a few phone pixels). Med / high unchanged.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Fewer far wheels / trims / blobs in the carpark views.                                                                                                   | `vehicles.js` (`DRAW_FAR_LOW`)                                                   |
| The crowd's one-off slot prune (`Crowd.prune`, which must follow vehicle placement) is queued on `KQ.Game.Defer` right after the vehicle jobs, so it runs behind the loading bar, not in the Start tap.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Start-tap first frame at 4x CPU: Loop.frame ~490 ms, of which Crowd.update ~220 ms (the remainder is the instant fill, which needs the hero's position). | `crowd.js`, `boot.js`                                                            |
| AC-14's sweep (`drawCallSweep`) now looks 4 ways at every POI by day and night, and runs the kompang, rain and football events at six busy spots (4 ways each), plus the prayers. Split into page-side pieces (`sweepSetup`, `sweepPlaces`, `sweepEvents`, `sweepPrayers`); timeout 480 s.                                                                                                                                                                                                                                                                                                                                                                                                                        | CI catches an over-budget view or event from now on.                                                                                                     | `tests/kampung-quest-ac.spec.mjs`                                                |

Not needed after the merge: shadow-caster changes, static-batch merging, small-prop culling, rain-umbrella instancing, a dynamic guard. All views sit at 319 or below, a ~80-call margin.

## Before / after (low tier, worst of 4 yaws per cell)

Kampung:

| view                |      none |  football |  icecream |  catchase |      rain |   balloon |     dates |     photo |   kompang |
| ------------------- | --------: | --------: | --------: | --------: | --------: | --------: | --------: | --------: | --------: |
| home                | 409 → 314 | 453 → 319 | 426 → 318 | 414 → 319 | 463 → 316 | 407 → 298 | 418 → 310 | 429 → 307 |           |
| block_b             | 311 → 255 | 347 → 252 | 341 → 259 | 303 → 247 | 352 → 257 | 324 → 254 | 330 → 261 | 346 → 250 | 364 → 255 |
| block_c             | 331 → 177 | 372 → 172 | 365 → 184 | 350 → 182 | 365 → 172 | 320 → 164 | 362 → 191 | 357 → 180 | 407 → 186 |
| hawker              | 439 → 215 | 482 → 219 | 459 → 222 | 444 → 220 | 491 → 225 | 410 → 218 | 421 → 223 | 447 → 220 |           |
| playground          | 448 → 277 | 503 → 275 | 472 → 277 | 455 → 273 | 505 → 275 | 459 → 269 | 470 → 281 | 487 → 271 | 492 → 270 |
| park                | 438 → 251 | 496 → 257 | 457 → 257 | 442 → 255 | 499 → 254 | 467 → 248 | 505 → 268 | 525 → 261 | 509 → 257 |
| pony_ride           | 356 → 226 | 443 → 242 | 396 → 241 | 370 → 240 | 394 → 243 | 381 → 233 | 416 → 247 | 465 → 230 | 479 → 240 |
| mosque_gate         | 396 → 237 | 513 → 249 | 465 → 240 | 481 → 241 |           |           |           |           | 201 → 164 |
| bus_stop (bus true) | 401 → 287 |           |           |           |           |           |           |           |           |
| mosque_gate maghrib | 212 → 167 |           |           |           |           |           |           |           |           |

worst view: 525 → 319

Haramain (the busiest POIs; every other POI improved or stayed the same; the outskirts / camel views were already 111-172):

| view      |      none |  football |  icecream |  catchase |   kompang |      rain |   balloon |   pigeons |     dates |     photo |
| --------- | --------: | --------: | --------: | --------: | --------: | --------: | --------: | --------: | --------: | --------: |
| forecourt | 264 → 224 | 321 → 230 | 285 → 232 | 270 → 230 | 324 → 231 | 328 → 236 | 282 → 228 | 281 → 228 | 292 → 239 | 309 → 229 |
| gate      | 250 → 221 | 332 → 230 | 279 → 223 | 263 → 220 | 318 → 222 | 323 → 228 | 272 → 215 | 273 → 217 | 285 → 229 | 301 → 218 |
| hall      | 251 → 215 | 305 → 218 | 271 → 222 | 256 → 220 | 309 → 220 | 313 → 225 | 268 → 218 | 250 → 214 | 277 → 228 | 294 → 218 |
| hall_w    | 242 → 221 | 299 → 227 | 258 → 224 | 252 → 223 | 310 → 221 | 311 → 223 | 268 → 218 | 253 → 217 | 278 → 229 | 282 → 221 |
| wudu      | 218 → 208 | 269 → 212 | 235 → 212 | 219 → 209 | 296 → 208 | 275 → 213 | 228 → 204 | 226 → 203 | 138 → 138 |           |
| mataf     | 171 → 145 |           |           |           |           |           |           |           |           |           |

worst view: 332 → 239

## Trade-offs

- **Look:** none measurable for the figures (same pixels). Parked vehicles between 55 and 85 m are no longer drawn on the low tier.
- **Culling:** the merged mesh has a fixed bounding sphere (1.3 m round the figure's group), so frustum culling still works per figure.
- **GPU:** skinning is 15 bones per figure; negligible. The merged mesh uses the same material, plus the skinning variant of its program (compiled at boot with the cast, so no first-sight compile).
- **Rebuild cost:** a part change rebuilds the figure's merged geometry (a few thousand vertices) once; this happens on a re-dress, not per frame.

## Learnings

- r147 has no `BufferAttribute.getComponent`; use `getX/getY/getZ/getW`.
- Figure parts carry `color` and `aSkin` attributes besides position / normal / uv; a merge must copy every attribute (the first version dropped `color` and the NPC rendered black).
- A `Skeleton` accepts any `Object3D` as a bone (it reads `matrixWorld`), so an existing FK hierarchy can drive a `SkinnedMesh` without converting it to `THREE.Bone`s.

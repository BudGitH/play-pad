# Notes: vehicles workstream (section D, AC-P11..P14)

For the orchestrator to fold into the brain docs (ARCHITECTURE, LEARNINGS, DECISIONS, game CLAUDE.md module map).

## What changed

| AC | Change | Files |
| --- | --- | --- |
| P11 ground | Every vehicle sits on the plane fitted through the ground under its tyres (`Sim.Vehicle.groundPose`: height, pitch, roll + per-tyre `off`), not on one sample under its middle. Car front wheels drop / lift on their own and the rear axle tilts (`Figures.Vehicles.suspend`), so all four tyres touch a kerb. The ground under a tyre is the highest in its 8 cm footprint (`groundUnder`). Snapped every frame (no damping). Parked spots astride a kerb edge slide sideways until both tyres stand on one level (`offEdge`). A soft blob shadow under every vehicle (one shared material). | `js/sim/vehicle.js`, `js/game/vehicles.js`, `js/figures/vehicle-meshes.js`, `vehicle-parts.js` |
| P12 solid | A parked vehicle is ONE oriented-box collider the size of its model's footprint (`mesh.foot`), not two axis-aligned squares round its two rings (those left a 0.56 m gap mid-car: the "walk through the middle" bug). `Collide` supports `obb` colliders (`orientedBox`, `hits`, `pushOut`); `minX..maxZ` stay the bounds so broad-phase filters are unchanged. A driven vehicle that bumps head-on into a parked one stops dead (`bumped` counter); a scrape just slows it. Parking a vehicle clears the NPCs' near-collider cache. Spawn checks the whole body (both rings) is free (`placeFree`). | `js/game/collide.js`, `js/game/vehicles.js` |
| P13 speed | Car 12.5 m/s (2.84x run), scooter 10 (2.27x), bicycle 7.4 (1.68x); accel / brake / coast raised to match. `lookAhead(spec)` = max(14, v²/2·6.5 + halfLen + 3) and `peopleNear` widened while mounted, so a faster car still eases down for people. Camera: pulls back `camFar` (car 1.6 m, scooter 1.2, bike 0.8) with speed (keeps the player's zoom), swings in behind the heading when the player is not looking around. | `js/sim/vehicle.js`, `js/game/vehicles.js` |
| P14 models | Car: curved side profile (rounded nose, crowned bonnet, sloping boot, round arches, rounded roof corners), body and cabin squeezed toward nose / tail / roof, arch trims, window rubbers, pillars leaning in, wrap-round head / tail lamps, fog lamps, grille with chrome bars, mirrors on arms, side skirts; rear wheels merged into one axle mesh (calls per car unchanged at 10 incl. the blob). Bicycle: thicker diamond frame, 16 laced spokes, chain ring + chain + rear sprocket, shaped saddle, swept-back bars with grips and levers, fork that turns about the head tube, smaller basket, kickstand (parked bikes lean on it). Scooter: curved rear cowl with a wheel arch, floorboard, curved leg shield, long seat, front fender, headlight cowl. | `js/figures/vehicle-{parts,car-geo,two-wheel-geo,meshes}.js` |

No new script files; `index.html` untouched.

## Measured

- Wheel-to-ground gap (tyre bottom through the drawn wheel pivots vs ground under it): every parked vehicle within 3 cm in both regions (26 kampung, 100 Haramain); driven car / bike / scooter (kampung, incl. a kerb) and car / scooter (Makkah) within 3 cm.
- Top speeds reached in the browser: car 12.5, scooter 10, bike 7.4 m/s (run 4.4); largest one-frame speed change 0.18-0.22 m/s; speed after 0.5 s: car 2.6, scooter 2.5, bike 0.84; camera stays behind (dot > 0.99) at 5.4-7.2 m.
- Driven car into a parked car 8 m ahead: stops dead (speed 0), nose ring 0.80 m clear of the other's body.

## Tests

- `tests/kampung-quest/vehicle.test.mjs` (+9): speed ratios vs `Sim.Vehicle.RUN`, smooth acceleration, look-ahead, the box, OBB push-out (no point inside a turned car, middle included), exact OBB corners, ground fit (flat, nose up, roll, one wheel up + suspension), two-wheeler no-roll, kerb edge.
- `tests/kampung-quest-vehicles-ground.spec.mjs` (new): AC-P11 parked + driven in both regions, AC-P12 middle/flank blocked, hero walking at a car's middle stops at its side, driven car stops at a parked one, AC-P13 speeds / smoothness / camera.
- New hooks: `G.Vehicles.groundGaps()` (worst tyre gap per vehicle), `__kq.vehicles().bumped`.

## Learnings (gotchas)

- 2026-11-28 · vehicles · Two axis-aligned squares round a car's two collision circles leave a gap in the middle (r 0.8, offset 1.08: 0.56 m) a 0.66 m person nearly fits through, and over-cover a turned car's corners. · Use one oriented box per vehicle (`Collide.orientedBox`).
- 2026-11-28 · vehicles · Damping a vehicle's height toward the ground sinks the tyres into a kerb for several frames. · Snap to a plane fitted through the tyre contacts every frame; let per-wheel suspension take up what the plane cannot.
- 2026-11-28 · vehicles · A least-squares roll through two nearly collinear contacts (a bicycle with its front wheel steered 3 cm sideways) is wildly ill-conditioned. · Fit roll only with 3+ contacts.
- 2026-11-28 · vehicles · Measuring "wheel on the ground" with a bounding box of a rotating wheel reads up to r·(√2−1) low; a merged rear axle's bbox centre is mid-car. · Carry the tyre's lowest point through the wheel pivot's world matrix.
- 2026-11-28 · tests · `page.evaluate(fn)` sends only `fn`'s source: helpers it calls must be installed on `window` first or passed as source text.

## Decisions

- One oriented box per parked vehicle, kept in the shared `world.colliders` (rejected: a separate dynamic-collider list every caller would have to merge; per-vehicle circle chains). The driven vehicle is still removed from the list (the hero's own settle runs while seated); NPCs meet a driven vehicle only through its people-braking.
- Speeds as ratios of the hero's run (`Sim.Vehicle.RUN` mirrors `Player.RUN`): 2.84x / 2.27x / 1.68x leave margin over the AC's 2.5 / 2 / 1.5.
- Head-on bump stops a driven vehicle; a glancing touch only slows it (so you can steer away from a car you are scraping).
- "Ground under a tyre" = highest ground in an 8 cm footprint (a tyre on a kerb edge rests on the kerb).

## Risks / not done

- Draw calls: car 10, bicycle 6 (was 5: + blob), scooter 7 (was 7 incl. blob, since lamps were already separate... + blob = 8). The `vehicles-all` budget test (< 420 street view) is the guard; see the run in the final report.
- Kerb heights other than 0.12 m, or a tyre exactly on a kerb corner while steering hard, can still read a few cm; the spec drives over the kampung kerbs only.
- The driven vehicle is not a collider for NPCs / the crowd (they are only braked for).

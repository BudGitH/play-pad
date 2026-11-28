# Notes: vehicles workstream (section D, AC-P11..P14, plus the bus and the lorry)

For the orchestrator to fold into the brain docs (ARCHITECTURE, LEARNINGS, DECISIONS, game CLAUDE.md module map / hooks).

## What changed

| AC / ask | Change | Files |
| --- | --- | --- |
| P11 ground | Every vehicle sits on the plane fitted through the ground under its tyres (`Sim.Vehicle.groundPose`: height, pitch, roll + per-tyre `off`), not one sample under its middle; snapped every frame (no damping). Car / lorry front wheels drop or lift on their own, the rear axle (and a bus's front axle) tilts (`Figures.Vehicles.suspend`). Ground under a tyre = highest in its 8 cm footprint (`groundUnder`). Two-wheelers never roll from the fit. Spots astride a kerb edge slide sideways (`offEdge`). Soft blob shadow under each vehicle. | `js/sim/vehicle.js`, `js/game/vehicles.js`, `js/figures/vehicle-meshes.js`, `vehicle-parts.js` |
| P12 solid | A parked vehicle is ONE oriented-box collider the size of its model (`mesh.foot`), not two squares round its rings (those left a 0.56 m gap mid-car). `Collide` supports `obb` colliders (`orientedBox`, `hits`, `pushOut`); `minX..maxZ` stay the bounds so broad-phase filters work unchanged. A driven vehicle bumping head-on into a parked one (or the bus) stops dead (`bumped`); a glancing scrape only slows it. Parking clears the NPCs' near-collider cache. Spawn checks the whole body is free (`placeFree`). The hero is now placed straight into the seat on mount. | `js/game/collide.js`, `js/game/vehicles.js` |
| P13 speed | Car 12.5 m/s (2.84x run), scooter 10 (2.27x), bicycle 7.4 (1.68x), lorry 9.6 (2.18x); accel / brake / coast raised to match. `lookAhead(spec)` = max(14, v^2/(2*6.5) + halfLen + 3) and a wider people search while mounted, so faster vehicles still ease down for people. Camera pulls back `camFar` with speed (keeps the player's zoom) and swings in behind the heading. | `js/sim/vehicle.js`, `js/game/vehicles.js` |
| P14 models | Smooth, lifelike: crease-angle smooth shading (`P.smoothed`), bevelled curved extrusions (`P.sideShape` + `P.squeeze`), ellipsoid lamps / mirrors / saddle (`P.lens`), swept tubes (`P.bent`). Cars: curved profile (rounded nose, crowned bonnet, sloping boot, crowned roof shell), tumblehome, flared arch trims (thicker on the SUV), wrap-round lens lamps, grille with chrome bars, mirrors on arms, glossier paint (roughness 0.3). Bicycle: thin round-tube diamond frame, curved stays and fork blades, 16 laced spokes, riser bar, shaped saddle, tube rack, chain / chain ring / sprocket, reflectors, lamp, bell, kickstand (parked bikes lean on it). Scooter: rounded rear cowl with wheel arch, curved leg shield, cushioned seat, swept exhaust, grab rail, round mirrors, headlight cowl. | `js/figures/vehicle-{parts,car-geo,two-wheel-geo,meshes}.js` |
| Bus (owner) | Generic unbranded single-deck low-floor town bus, light body with green stripes and skirt, tinted windows, two LEFT-side plug doors, rabbit-ear mirrors, wheel arches, sign "Kampung 21". **Ambient only** (no driving, no passenger ride). Route: the E-W road, left-hand traffic: westbound lane z = +0.3 from x = +70, pulls in to z = +1.9 and stops with its front door at the shelter (LAYOUT.busStop centre + 3.95 = x 23.95), doors open 5 s, pulls out, leaves at x = -70; 6 s later comes back eastbound on z = -0.3 and leaves at x = +70; it only (re)appears when the hero is > 35 m from the entry. Brakes for people, the hero and every drivable vehicle (their nose / tail points) via `Sim.Vehicle.speedCap`; one moving oriented-box collider updated each step (parked far away while out of town). Kampung only. | `js/game/bus.js` (new), `js/figures/vehicle-big-geo.js` (new), `js/sim/vehicle.js` (`SPECS.bus`), `index.html` (2 script tags) |
| Lorry (owner) | Small canopy lorry: blue cab-over cab, tray with drop sides, green canvas canopy on a rounded section, dual rear wheels; drivable (`kind: "lorry"`, label Drive, pose drive, horn Honk), 9.6 m/s. Parked kerbside on the E-W road's north side in front of the hawker centre / minimart: (36.5, -2.5), facing east. | `vehicle-big-geo.js`, `vehicle-spots.js`, `vehicles.js` |
| Kerbside cars | The three E-W road kerbside cars moved from z = +-2.0/2.1 to +-2.6 so the bus passes them (car1 (-22, 2.6), car9 (60, 2.6), car10 (-62, -2.6)). | `vehicle-spots.js` |

## Fix round 2 (after the screenshot review and the owner's "real Singapore cars")

- **Roof bug.** The roof cap was a thin shell only about 0.5 m long, so the car read as an open frame. It is now the cabin's own outline cut 8 cm under the roof line. Points below the cut are pulled onto the windscreen and rear-glass lines (`cutSpan`), so the cap covers the glass exactly. It is solid on every parked car and fades only on the car being driven (spec asserts this).
- **Fronts.** Flatter bonnet, small nose radius, bumper with a lip, straight boot deck, crisper shoulder (bevel 0.035, crease angle 34 degrees, less tuck), more raked windscreen with tighter roof corners.
- **Singapore look** (`sg-cars-reference.md`): kampung mix of sedans, SUVs, an MPV, a hatch and 2 taxis, in white, silver, grey, black, dark blue and deep red. Singapore plates front and rear: black plates on sedans, taxis and the MPV; white-front / yellow-rear on the hatch and SUVs. Taxis have a two-tone teal/white livery and a "TAXI" sign. Haramain cars keep their looks with plain white plates.
- **Low-tier LOD** (`VehicleParts.setDetail`, `S.quality === "low"` when spawning): car ~6.3k triangles, down from 9.9k. On the low tier the lamps merge into the trim, and only the body casts a shadow (cars, two-wheelers, lorry).
- **Placed at boot.** `Vehicles.prepare(G.Defer)` is called in `boot.js` `buildActors`, queuing one job per vehicle plus one for the bus. The texture-upload drain runs them behind the loading bar, so they are placed before Start and before the crowd's first update and prune. `ensure()` falls back to placing them at once.
- **Bus sign.** The sign now sits above the mirrors, the mirrors are lowered, and the text fits. The earlier "clipping" in the shot was a lamp post in front of the camera.
- **Numbers (low tier, incl. shadows).**
  - Kampung vehicles street view: 260 -> 230 calls.
  - Bus-stop view at the old camera angle: 394 with the bus, 387 without. Second angle: 367 / 359. Was 406 / 399.
  - Haramain view: 149 -> 138.
  - Per model: car 9 meshes / ~6.4k triangles (low), bus 6 meshes / 5.8k.

## Measured

- Wheel-to-ground gap (tyre bottom through the drawn wheel pivots vs ground under it): every parked vehicle within 3 cm in both regions; driven car / bike / scooter (kampung, across kerbs) and car / scooter (Makkah) within 3 cm.
- Top speeds in the browser (run 4.4): car 12.5, scooter 10, bike 7.4, lorry 9.6 m/s; largest one-frame speed-up 0.18-0.22 m/s; camera behind (dot > 0.99) at 5.4-7.2 m (lorry ~9-10 m).
- Driven car into a car parked 8 m ahead: stops dead, its front ring 0.80 m clear of the other's body.
- Draw calls (low tier incl. shadow pass): kampung street view (vehicles-all view) 255 before -> 260 after; Haramain 149 -> 149. Bus-stop view beside the hawker centre: 399 without the bus, 406 with it standing at the stop (+7 calls). **That view is already at the 400 line before the bus** (hawker centre + crowd); the bus is trimmed to 7 calls (body, trim incl. glass and lamps, doors, sign, 2 axles, body shadow).
- Calls / triangles per model: car 10 calls / ~9.9k tris, bicycle 6 / 5.3k, scooter 7 / 6.5k, lorry 9 / 5.8k, bus 7 / 5.8k. The car is above the suggested ~8k (lens lamps + flared trims); fine on the low tier in the measured views but a candidate for a low-tier LOD.

## Tests

- `tests/kampung-quest/vehicle.test.mjs` (+9, 378 unit tests pass): speed ratios vs `Sim.Vehicle.RUN` (and lorry between bike and car), smooth acceleration, look-ahead, the box, OBB push-out (no point inside a turned car, middle included), exact OBB corners, ground fit (flat, nose up, roll, one wheel up + suspension), two-wheeler no-roll, kerb edge; kinds now include lorry and bus (bus has no label: never driven).
- `tests/kampung-quest-vehicles-ground.spec.mjs` (new, 13 tests): AC-P11 parked + driven in both regions, AC-P12 middle / flank blocked, hero walking at a car's middle stops at its side, driven car stops at a parked one, AC-P13 speeds / smoothness / camera for car, scooter, bike and lorry; the bus pulls in at the stop with doors open and is solid (hero walking into it stops at its side), brakes for the hero in its lane, leaves town and comes back the other way on its own left lane.
- Updated: `-vehicles.spec.mjs` (28 vehicle colliders = 26 + lorry + bus; car1 home z 2.6; the no-drive toast is checked sooner because the car arrives sooner), `-vehicles-all.spec.mjs` (kampung has 1 lorry, the bus is not in the drivable list and is ready; lorry labels / pose / horn).
- New hooks: `G.Vehicles.groundGaps()`, `G.Vehicles.sims()`, `__kq.vehicles().bumped`, `__kq.vehicles().bus` (state, dir, x, z, speed, doors, stops, runs, braked, stopX).
- Dev probe (not CI): `features/kampung-quest-playability/vehicles-measure.mjs` (gaps, draw calls, triangles, screenshots: `KINDS=`, `PICK=`, args `haramain shots calls bus nomeasure`).

## Learnings (gotchas)

- 2026-11-28 · vehicles · Two axis-aligned squares round a car's two collision circles leave a gap mid-car (r 0.8, offset 1.08: 0.56 m) a 0.66 m person nearly fits through. · One oriented box per vehicle (`Collide.orientedBox`).
- 2026-11-28 · vehicles · Damping a vehicle's height toward the ground sinks the tyres into a kerb for several frames. · Snap to a plane fitted through the tyre contacts; let per-wheel suspension take up the rest.
- 2026-11-28 · vehicles · A least-squares roll through two nearly collinear contacts (a bicycle steering 3 cm sideways) is ill-conditioned. · Fit roll only with 3+ contacts.
- 2026-11-28 · vehicles · A rotating wheel's bounding box reads up to r(sqrt2-1) low, and a merged axle's bbox centre is mid-car. · Carry each tyre's lowest point through the wheel pivot's world matrix.
- 2026-11-28 · vehicles · Mounting placed the hero at the vehicle's middle; a seat far from the middle (the lorry cab) read as "displaced" next step and threw him out. · Place him straight into the seat.
- 2026-11-28 · bus · A lane function that snaps back to the lane centre the moment a flag flips made the bus turn 90 degrees at the stop and stall. · Keep lane offsets continuous in x for every state.
- 2026-11-28 · tests · `page.evaluate(fn)` sends only `fn`'s source: helpers it calls must be on `window` or passed as source text.

## Decisions

- One oriented box per parked vehicle, kept in the shared `world.colliders` (rejected: a separate dynamic list every caller must merge). The driven vehicle is removed while driven (the hero's own settle runs while seated); the bus keeps one box updated in place.
- Speeds as ratios of the hero's run (`Sim.Vehicle.RUN` mirrors `Player.RUN`).
- Head-on bump stops a driven vehicle; a glancing touch only slows it.
- "Ground under a tyre" = highest ground in an 8 cm footprint.
- Bus is ambient only (no passenger ride): a ride needs seat / camera / exit-at-stop flows not worth the risk this round. It runs on the existing E-W road only and enters / leaves out of the hero's reach, so the HDB / hawker rework does not touch it; it needs `LAYOUT.road` (lanes at |z| 0.3 / 1.9) and `LAYOUT.busStop`.

## Risks / not done

- Bus-stop view: 406 low-tier calls with the bus at the stop (399 without). If AC-14-style audits look there, the hawker / crowd side needs trimming, or the bus a cheaper wheel set.
- The bus is a moving solid on the E-W road: a spec that walks the hero across that road could meet it (it waits for him; he cannot pass through).
- The lorry's cab windows are tinted opaque, so the hero is hard to see while driving it (chase camera sees the canopy).
- `tests/kampung-quest-ac.spec.mjs` and the mobile / Haramain-outskirts specs were not all re-run here (see the final report for what was).

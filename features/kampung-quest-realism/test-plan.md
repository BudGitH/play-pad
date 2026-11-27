# Test Plan: Kampung Quest realism round

> **Phase 2 of the workflow.** Every acceptance criterion in `requirements.md` maps to at least one test. Tests were written with each feature; this plan records the mapping and the final run.

**Feature:** Kampung Quest realism (guide, tailor, vehicles, crowd, outskirts and camels)
**Ticket:** PLAY-013
**Created:** 2026-11-27

---

## Coverage map (AC to test)

| Acceptance criterion                          | Test(s)                                                                                                                                                                                                                                                                                                                                                                          | Type           |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| AC-R1 guide appears / goes                    | `tests/kampung-quest-tawaf-guide.spec.mjs` (the dotted guide appears ... gone on other steps; sa'i lane); `tests/kampung-quest/ritual-guide.test.mjs` (dot ring, lane geometry)                                                                                                                                                                                                  | e2e + unit     |
| AC-R2 guide follows the hero                  | tawaf-guide spec (the guide follows the hero ... survives closing the card); `ritual-guide.test.mjs`                                                                                                                                                                                                                                                                             | e2e + unit     |
| AC-R3 gentle hints                            | tawaf-guide spec (the hint is gentle ...); `ritual-guide.test.mjs`                                                                                                                                                                                                                                                                                                               | e2e + unit     |
| AC-R4 calm pace, forgiving counting           | tawaf-guide spec (Walk for me is calm: about half a minute a round); `tests/kampung-quest-rituals.spec.mjs` (tawaf by hand / by Walk for me, sa'i by hand); `tests/kampung-quest/umrah.test.mjs`                                                                                                                                                                                 | e2e + unit     |
| AC-R5 tailor in three places, try-on, persist | `tests/kampung-quest-wardrobe.spec.mjs` (Butik opens the wardrobe; keyboard friendly; Makkah and Madinah each have a tailor)                                                                                                                                                                                                                                                     | e2e            |
| AC-R6 wardrobe data and save                  | `tests/kampung-quest/wardrobe.test.mjs` (outfits x colours, sanitize, damaged shared look, New game forgets it); `tests/kampung-quest/save.test.mjs`; wardrobe spec (the ihram overrides it)                                                                                                                                                                                     | unit + e2e     |
| AC-R7 phone wardrobe                          | wardrobe spec (phone portrait: bottom sheet with 48 px targets and Save in view)                                                                                                                                                                                                                                                                                                 | e2e            |
| AC-R8 every vehicle drivable                  | `tests/kampung-quest-vehicles-all.spec.mjs` (lots of vehicles ... none decoration; every spot free ground; every vehicle shows Drive / Ride, mounts, seats, leaves; a car, a bike and a scooter drive away)                                                                                                                                                                      | e2e            |
| AC-R9 vehicle safety                          | `tests/kampung-quest-vehicles.spec.mjs` (stops at a wall; no-drive zone; a person in the way; horn obeys mute / pause / azan; teleport un-seats); `tests/kampung-quest/vehicle.test.mjs`                                                                                                                                                                                         | e2e + unit     |
| AC-R10 spots off the walk graph               | `tests/kampung-quest-haramain-world.spec.mjs` (every stand spot ... walk-graph path is clear of colliders); `vehicles-all` (spots free, outside noDrive)                                                                                                                                                                                                                         | e2e            |
| AC-R11 crowd density, caps, variety           | `tests/kampung-quest-crowd.spec.mjs` (more characters ...; a varied crowd; under the tier cap, nobody in a wall; seats; headcount follows tier); haramain-world (inside its cap; varied; more happening); `tests/kampung-quest/crowd.test.mjs`, `crowd-pilgrim.test.mjs`                                                                                                         | e2e + unit     |
| AC-R12 crowd after a jump                     | haramain-world (AC-H2 tawaf walkers anticlockwise; the Sa'i lane has walkers; Arafah dua)                                                                                                                                                                                                                                                                                        | e2e            |
| AC-R13 draw cap and call budget               | crowd spec (a busy hawker still fits the phone draw-call budget); `vehicles-all` (a street full of vehicles stays inside the budget); `haramain-outskirts` (camels and outskirts keep the budget); haramain-world (bigger crowd inside the cap and budget); AC-14 in `kampung-quest-ac.spec.mjs`; combined sweep in `qa-report.md` (38 Makkah + 18 Madinah views, max 228 calls) | e2e + measured |
| AC-R14 outskirts world                        | `tests/kampung-quest-haramain-outskirts.spec.mjs` (photo textures loaded; facades, mountains, palms exist); haramain-world (AC-H1 also from `file://`)                                                                                                                                                                                                                           | e2e            |
| AC-R15 camels                                 | outskirts spec (a herd ... six instanced meshes, none on a street; hero pushed out of a standing camel; a walking camel moves)                                                                                                                                                                                                                                                   | e2e            |
| AC-R16 no regressions                         | all `kampung-quest-*.spec.mjs` incl. `-ac`, `-mobile`, `-collision`, `-hud-move`, `-prayer`, `-voice`, `-greetings`, `-ambience`; `smoke.spec.mjs`; "no console errors" tests                                                                                                                                                                                                    | e2e            |

## Test cases

### Happy path

- [x] Tawaf by hand and by Walk for me reach 7 rounds; sa'i reaches Marwa on leg 7; Next alone still finishes every rite.
- [x] Pick an outfit and colour at the Butik, Save, reload: the hero is dressed the same, in Makkah and Madinah too.
- [x] Mount a car, a bicycle and a scooter in each region and drive away; Exit puts the hero beside it.

### Edge cases (boundaries)

- [x] Clockwise tawaf is not counted; a wide start line still counts; the guide survives closing the card.
- [x] Hostile / damaged wardrobe save and shared look are ignored; New game forgets the look.
- [x] Teleport or clock jump: the new crowd fills at once and never exceeds the cap.
- [x] A street full of vehicles and the busiest plaza stay under the draw-call budget.

### Error paths

- [x] A car meets a wall, a no-drive zone or a person: it stops short, friendly line, nobody touched.
- [x] No `speechSynthesis`, blocked textures (`file://`): the game still runs with no console errors.

### Non-functional checks

- [x] **Accuracy:** anticlockwise tawaf with the Kaaba on the left; 7 rounds / 7 legs; modest outfits (unit test over `OUTFITS`).
- [x] **Risk:** `Wardrobe.sanitize` and `Save` clamp hostile input (unit); wardrobe labels via `textContent` (QA RISK lens).
- [x] **Compliance:** CC0 credits for every new texture (QA COMPLIANCE lens).

## How to run

```
npm run check && npm run secrets && npm run test:kq
PW_CHROMIUM_PATH=/usr/bin/google-chrome npx playwright test --grep-invert @slow   # npm run smoke
# the combined draw-call sweep is a dev script, numbers recorded in qa-report.md
```

## Definition of done

- [x] All tests above pass (final numbers in `qa-report.md`).
- [x] Every acceptance criterion in `requirements.md` is covered.
- [x] Lite design path: wardrobe sheet follows the prayer-panel pattern.
- [x] `qa-report.md` is clean (no unresolved CRITICAL/HIGH).

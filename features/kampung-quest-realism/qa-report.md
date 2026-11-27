# QA Report (Post-Run Findings): Kampung Quest realism round

> **Phase 4 output.** The four lenses (ACCURACY, QUALITY, COMPLIANCE, RISK) were run as four separate, evidence-based passes and merged here. **Honest note:** the integrating session had no sub-agent tool, so the "panel" was one reviewer taking each lens in turn (against the requirement, the test plan and the matching slice of `docs/CODE_QUALITY.md`), not four independent agents. A fresh-eyes re-run with real parallel agents is recommended before a public release (listed under Open items).

**Feature:** Kampung Quest realism (guide, tailor, vehicles, crowd, outskirts and camels)
**Ticket:** PLAY-013
**Run at:** 2026-11-27 (round 1, re-verified after fixes; round 2 below, run by an independent panel)
**Overall result:** [x] PASS (no CRITICAL / HIGH open)

---

## Gate summary

| Lens (dimension) | Agent verdict | Findings             | Blocking? |
| ---------------- | ------------- | -------------------- | --------- |
| ACCURACY         | PASS          | 2 (1 fixed, 1 fixed) | no        |
| QUALITY          | PASS          | 1 (fixed) + 2 notes  | no        |
| COMPLIANCE       | PASS          | 0 (1 process note)   | no        |
| RISK (security)  | PASS          | 0                    | no        |
| **Tests**        | PASS          | see the table below  | no        |

### Test results (final code, `PW_CHROMIUM_PATH=/usr/bin/google-chrome`, `--trace off`, `@slow` skipped)

| Suite                                                                                                 | Result                                                                                                 |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `npm run check` (eslint, lint ratchet, prettier)                                                      | clean: 0 errors, 41 legacy warnings, none new                                                          |
| `npm run secrets`                                                                                     | clean                                                                                                  |
| `npm run test:kq` (sim unit tests)                                                                    | 364 / 364                                                                                              |
| Playwright `core` project (hub, other games, viewport-fit)                                            | 150 / 150                                                                                              |
| Playwright `kampung-quest` project (all `kampung-quest-*.spec.mjs`)                                   | 193 / 193 (run twice: before and after the fixes)                                                      |
| Draw calls, low tier, combined sweep (38 Makkah + 18 Madinah views, 07:00-18:30, plus kampung hawker) | max 228 (Madinah, first frame after teleport); typical 100-185; kampung hawker lunch 235. Budget < 400 |

## Findings

### FINDING-2026-11-27-001

- **Severity:** MEDIUM (it was a failing audit test, so it blocked the merge until fixed)
- **Dimensions:** accuracy, quality
- **Where:** `games/kampung-quest/js/world/holy-nav.js`, `vehicleSpots` (`MAKKAH_BIKES`, `MAKKAH_MOTOS`, `MADINAH_BIKES`, `MADINAH_MOTOS`)
- **What:** seven parked bikes / scooters stood on walk-graph edges 21-22, 22-23, 25-26, 55-56, 56-57, 105-106 and 82-112, so `tests/kampung-quest-haramain-world.spec.mjs` "every stand spot ... walk-graph path is clear of colliders" failed (strollers would have been routed through a vehicle).
- **Recommendation:** move the spots about 1.4 m off the edge, outside every `noDrive` zone. Done: scooter (-160) and bikes (-120, 70) now z -115.3; bike (71.2, 40) is at x 69.8; bike (40, 76.3) at z 74.9; bike (538, -60) at z -58.4; scooter (600, -113.8) at x 606. A throw-away probe confirms no walk-graph edge is blocked any more; `-haramain-world`, `-vehicles-all` and `-vehicles` pass.
- **Recurrence:** 2nd occurrence of `placement-on-walk-graph` (the outskirts city blocks were the first): logged in `docs/findings-ledger.md` as `TICKET_REQUIRED` with a systemic plan (new placed objects go through the lot test and the clearance audit).
- **Status:** FIXED

### FINDING-2026-11-27-002

- **Severity:** MEDIUM
- **Dimensions:** accuracy (tawaf headcount)
- **Where:** `games/kampung-quest/js/game/crowd.js` (`liveCount`)
- **What:** the tawaf walker-count tests (`AC-H2` more than 10 walkers, all anticlockwise) were listed as a known failure: after a teleport the fading old crowd counted against the cap and left no room for the new one. The crowd agent's `liveCount` change (only people who stay count while `C.instant`) is the root-cause fix. Verified: the tests pass in both full runs.
- **Recommendation:** none beyond the learning recorded in `docs/LEARNINGS.md`.
- **Recurrence:** new.
- **Status:** FIXED (verified, not re-implemented)

### FINDING-2026-11-27-003

- **Severity:** LOW
- **Dimensions:** quality
- **Where:** `tests/kampung-quest-haramain-outskirts.spec.mjs` ("camels and outskirts keep the draw-call budget")
- **What:** the assertion allowed `< 450` calls while the requirement and the other budget tests say `< 400`.
- **Recommendation:** tighten to `< 400` (the measured worst is about 140). Done; the spec passes.
- **Recurrence:** new.
- **Status:** FIXED

### FINDING-2026-11-27-004 (note, no action)

- **Severity:** LOW
- **Dimensions:** quality
- **Where:** `games/kampung-quest/js/figures/{dress,vehicle-*}.js`, `world/tailor.js`
- **What:** these files use a short leading comment instead of the boxed `FILE / PURPOSE / BUSINESS CONTEXT` header. It matches the existing figures layer (`vehicle-meshes.js`, `parts.js` already did) and each states purpose, layout and the performance cost. No change.
- **Status:** ACCEPTED (consistent with the layer)

### FINDING-2026-11-27-005 (observation)

- **Severity:** LOW
- **Dimensions:** quality (UX)
- **Where:** a `?still` phone-portrait screenshot of the wardrobe sheet and the Umrah card shows the start-of-game "Welcome to Makkah" toast sitting over the sheet's title row.
- **What:** the toast was already on screen when the sheet opened (the rule "toasts are held while a modal sheet is open" covers new toasts, not one already showing); in `?still` no loop ages the toast, so a real player sees it vanish after a few seconds. Not reproduced as a defect in play and the mobile HUD spec (10 viewports) passes.
- **Recommendation:** have `UI.openSheet` hide the toast stack when a sheet opens. Parked in `docs/IDEAS.md`.
- **Status:** OPEN (LOW, backlog)

## Lens notes (what was checked)

- **ACCURACY:** tawaf anticlockwise with the Kaaba on the left, 7 rounds from the Black Stone, 7 sa'i legs ending at Marwa (`ritual-walk.js`, `umrah.test.mjs`, rituals spec); counting slack (35 degree start, 26 degree early) only makes counting more forgiving, never wrong-way; every outfit is modest (unit test over all 8 x 8 specs: only the classic jacket has bare arms; shorts stop at the knee); the default look keeps the colour family; driver seat on the right in the kampung and on the left in Haramain; every food / prayer rule untouched. Screenshots reviewed: ground guide, wardrobe, thobe on a bike and in a car, camel yard, city street, hawker lunch, Butik.
- **QUALITY:** `npm run check` clean, no new lint warnings (3 legacy warnings are `tests/probes/stride-probe.mjs`); no TODO / FIXME; functions within the 40-line / depth-3 limits; the new tests assert behaviour, not just "no throw"; the pure logic (`wardrobe`, `ritual-walk`, crowd rules, `vehicle`) is unit-tested; the draw-call budget is asserted in four specs.
- **COMPLIANCE:** all seven new CC0 texture sets (sand, dirt, rock, limestone, sandstone, wood, soil) are in `assets/CREDITS.md` with source ids and in `assets/textures/LICENSE.txt` (23 assets); payload of the game folder is 7.4 MB (< 12 MB); `_redirects` already covers `/features/*`, `/docs/*`, `/tests/*`, `/games/kampung-quest/CLAUDE.md`: no new non-game file needs a rule; no PII; docs updated (CLAUDE.md files, ARCHITECTURE, LEARNINGS, DECISIONS, IDEAS).
- **RISK:** none of the new files use `innerHTML` (only the existing `U.svgFrom` for our own constant SVG), `eval`, `fetch`, `document.write` or a `console` call (`textures.js` keeps its pre-existing `console.warn`); the wardrobe sheet builds labels with `U.el(... text)` and sets `aria-label` / `title` as attributes; `Wardrobe.sanitize` whitelists outfit and colour ids by `Array.find` (a `__proto__` key cannot match); `readLook` caps the string length and checks the version before parsing; localStorage failures are caught and the game plays on; vehicles never damage anyone; hooks stay test-only.

## Blocker classification -> response

| Severity | ACCURACY         | QUALITY            | COMPLIANCE          | RISK              |
| -------- | ---------------- | ------------------ | ------------------- | ----------------- |
| CRITICAL | hotfix now       | stop-ship          | stop-ship           | stop-ship         |
| HIGH     | blocks feature   | blocks feature     | blocks feature      | blocks feature    |
| MEDIUM   | fix next release | ticket, <=2 cycles | ticket, <=1 cycle   | ticket, <=1 cycle |
| LOW      | backlog          | tech-debt register | compliance register | risk register     |

## Human summary

All five features are in, work together, and pass every automated check. Two integration problems were found and fixed (parked bikes standing on footpaths people walk along, and the tawaf crowd not filling after a teleport) and one test threshold was tightened. Nothing CRITICAL or HIGH is open. Round 1 ran the four review lenses as one reviewer in turn; round 2 re-ran them with independent reviewers and found a HIGH (tawaf round 7 counted after about 6.5 laps) and a MEDIUM (New game did not clear the look in the other region), both fixed, with the LOWs.

## Open items

- ~~Re-run the lens review with four independent agents~~ done in round 2.
- A real mid-range phone check of fps and the tier thresholds (everything here ran on software GL; same watch-item as Sunset Stride in `docs/IDEAS.md`).

---

## Round 2 (independent panel)

> Round 1 was one reviewer taking each lens in turn. Round 2 ran the four lenses as **independent reviewers**, which closes the process gap noted above (ledger `qa-panel-not-independent`). It found one HIGH and one MEDIUM defect that round 1 missed, plus CI and hygiene LOWs. All are fixed and re-verified below.

### Findings and fixes

| #   | Severity | Dimension            | Finding                                                                                                                                                                                                                                                                                                                                                                                       | Fix and proof                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | -------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | HIGH     | ACCURACY             | **Tawaf drift.** `turnTawaf` banked a round at `TAU - SLACK` then did `acc -= TAU; acc = max(0, acc)`, so the 26-degree early credit was re-granted every round: round 7 counted after about 6.5 laps, not 7.                                                                                                                                                                                 | Counting is cumulative against the Black Stone line: round n banks at `n * TAU - SLACK`, remainder carried, floor `-SLACK`; `progress` and the "Nearly round n" hint use the same total. New unit tests (`ritual-guide.test.mjs`) walk 7 laps in 0.005-lap steps from the line and from 0.55 rad before it: round 7 banks only after more than 6.9 laps; clockwise never counts and builds no debt.                                                                            |
| 2   | MEDIUM   | ACCURACY             | **New game did not clear the look everywhere.** `clearLook` removed the shared key, but another region's slot still held its wardrobe / outfit, so kampung, New game, Makkah, kampung brought the old clothes back.                                                                                                                                                                           | `clearLook` writes a `{ v, cleared: true }` marker that every region reads as the default look (replaced by the real look at the next save). Unit test reproduces the scenario with two region save modules (`loadSim(files, region)`).                                                                                                                                                                                                                                        |
| 3   | LOW      | QUALITY (UX)         | Wardrobe Save toasted success even when `Loop.save()` was refused (stale tab / blocked storage). The rite hint used the fixed `T.base` count instead of the card's count after Next. `noteFor` left a trailing space on an empty hint.                                                                                                                                                        | Wardrobe shows a gentle "could not keep them for next time" notice when the save fails. `RitualTrek.sync(count)` keeps the hint on the card's count (called from `refresh()`). `noteFor` appends the hint only when there is one.                                                                                                                                                                                                                                              |
| 4   | MEDIUM   | QUALITY (CI)         | The five new browser specs (tawaf-guide, wardrobe, vehicles-all, haramain-outskirts, crowd) were not run by CI.                                                                                                                                                                                                                                                                               | New `npm run smoke:kq:realism` and a path-filtered "Kampung Quest (realism)" leg in `probes.yml` (about 6.5 min of software-GL runtime, so not a per-PR job). YAML parsed with a YAML loader.                                                                                                                                                                                                                                                                                  |
| 5   | LOW      | COMPLIANCE / QUALITY | Missing Tier-1 headers on `dress.js`, `vehicle-car-geo.js`, `vehicle-parts.js`, `vehicle-two-wheel-geo.js`, `tailor.js`. Dead `c.kind === "car"` branch and stale comments in `detail.js` / `props.js`. Unused exported `cap` in `ritual-walk.js`. `V.kind` not initialised and `V.dots` not disposed in `ritual-guide.js`. Per-frame allocations in `ritual-trek.update` and the camel herd. | Headers added. Dead branch and stale comments fixed (parked vehicles' missing contact-shadow blob is parked in `docs/IDEAS.md`: not cheap, it needs a shared instanced blob mesh). `cap` removed (the one in `ritual-flow.js` stays). `V.kind` initialised and `V.dots.dispose()` called in `hide()`. `ritual-trek` reuses scratch view / signature objects and rebuilds the hint only when its inputs change; the camel herd reuses a scratch `Vector3` and shared leg poses. |
| 6   | LOW      | ACCURACY (modesty)   | The classic jacket's bare arms were an undocumented exception to "modest clothes only".                                                                                                                                                                                                                                                                                                       | Documented in the `js/sim/wardrobe.js` header and in `requirements.md` (it is the hero's own default look). New tests: tee and sporty are knee-length shorts with sleeves in every colour, and `classic` is the only outfit with bare arms.                                                                                                                                                                                                                                    |

### Test results after the round 2 fixes (`PW_CHROMIUM_PATH=/usr/bin/google-chrome`, `--trace off`, `@slow` skipped)

| Suite                                             | Result                                        |
| ------------------------------------------------- | --------------------------------------------- |
| `npm run check` (eslint, lint ratchet, prettier)  | clean: 0 errors, 41 legacy warnings, none new |
| `npm run secrets`                                 | clean                                         |
| `npm run test:kq`                                 | 369 / 369 (was 364; +5 new tests)             |
| `tests/kampung-quest-tawaf-guide.spec.mjs`        | 5 / 5                                         |
| `tests/kampung-quest-rituals.spec.mjs`            | 19 / 19                                       |
| `tests/kampung-quest-wardrobe.spec.mjs`           | 4 / 4                                         |
| `tests/kampung-quest-vehicles-all.spec.mjs`       | 10 / 10                                       |
| `tests/kampung-quest-haramain-outskirts.spec.mjs` | 5 / 5                                         |
| `tests/kampung-quest-haramain-world.spec.mjs`     | 17 / 17                                       |
| `tests/kampung-quest-crowd.spec.mjs`              | 7 / 7                                         |
| `tests/kampung-quest-ac.spec.mjs`                 | 36 / 36                                       |

**Round 2 result:** no CRITICAL / HIGH / MEDIUM open. Remaining open items: a real mid-range phone check (above) and the parked-vehicle contact shadow (`docs/IDEAS.md`).

---

### Loop control

Round 1: no CRITICAL / HIGH open. Round 2 (independent panel): one HIGH and one MEDIUM found, fixed and re-verified in one loop; nothing open at CRITICAL / HIGH / MEDIUM. Next: `product-validation.md`.

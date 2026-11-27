# QA Report (Post-Run Findings): Kampung Quest realism round

> **Phase 4 output.** The four lenses (ACCURACY, QUALITY, COMPLIANCE, RISK) were run as four separate, evidence-based passes and merged here. **Honest note:** the integrating session had no sub-agent tool, so the "panel" was one reviewer taking each lens in turn (against the requirement, the test plan and the matching slice of `docs/CODE_QUALITY.md`), not four independent agents. A fresh-eyes re-run with real parallel agents is recommended before a public release (listed under Open items).

**Feature:** Kampung Quest realism (guide, tailor, vehicles, crowd, outskirts and camels)
**Ticket:** PLAY-013
**Run at:** 2026-11-27 (round 1, then re-verified after fixes in the same session)
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

All five features are in, work together, and pass every automated check. Two integration problems were found and fixed (parked bikes standing on footpaths people walk along, and the tawaf crowd not filling after a teleport) and one test threshold was tightened. Nothing CRITICAL or HIGH is open. The one honest caveat is that the four review lenses were run by one reviewer in turn rather than by four parallel agents, so a fresh-eyes pass is advisable before a public release.

## Open items

- Re-run the lens review with four independent agents when a sub-agent tool is available (process gap, not a code defect).
- A real mid-range phone check of fps and the tier thresholds (everything here ran on software GL; same watch-item as Sunset Stride in `docs/IDEAS.md`).

---

### Loop control

No CRITICAL / HIGH open, so no second fix round was needed. Next: `product-validation.md`.

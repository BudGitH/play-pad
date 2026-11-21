# QA Report (Post-Run Findings): Sunset Stride (Neon Rush rework)

> **Phase 4 output.** Merged from the four independent lens agents (ACCURACY · QUALITY · COMPLIANCE · RISK). The implementer did not grade its own work: each lens was a fresh agent given the requirements, the test plan and the code, and told to try to find problems.

**Feature:** Sunset Stride — golden-hour rebuild of Neon Rush (new look, real runner animation, dog chasers, real-world obstacles, better mechanics)
**Ticket:** PLAY-007
**Run at:** 2026-11-21 (round 1 of the panel + a model-fidelity / obstacle rework by owner request mid-run, re-verified)
**Overall result:** ☑ PASS — zero open CRITICAL / HIGH; every MEDIUM fixed or ticketed (see below)

---

## Gate summary

| Lens (dimension) | Agent verdict | Findings (C/H/M/L/I)                                                 | Blocking? |
| ---------------- | ------------- | -------------------------------------------------------------------- | --------- |
| ACCURACY         | PASS          | 0 / 0 / 3 / 6 / 1                                                    | no        |
| QUALITY          | PASS          | 0 / 0 / 5 / 7 / 0                                                    | no        |
| COMPLIANCE       | PASS          | 0 / 0 / 2 / 4 / 6                                                    | no        |
| RISK (security)  | PASS          | 0 / 0 / 1 / 7 / 0                                                    | no        |
| **Tests**        | PASS          | probe 47/47 · smoke 20/20 · `npm run check` 0 errors · secrets clean | no        |

**Tool evidence (not re-reviewed by eye, per `docs/ENFORCEMENT.md`):** `npm run check` → ESLint 0 errors (`max-lines-per-function` warnings only, ledgered), Prettier clean; `npm run secrets` → clean; `npx playwright test` → 20 passed (hub ×8, every game opens, every game starts a round on phone + desktop, Sunset Stride included); `node tests/probes/stride-probe.mjs` → every acceptance criterion probed headless (WebGL via SwiftShader): animation weights in every state, slide pose + uniform scale, dogs behind the runner and on screen, stumble / caught / side-scrape / close call / input buffer / slide cancel, persistence + legacy import + corrupt save, all-assets-blocked and `file://` fallbacks, no-WebGL notice, reduced-motion (with a positive control), phone portrait framing, 3-minute soak.

## Findings and their disposition

All severities are the agents' own, re-checked by reproduction where marked.

### ACCURACY (agent `aaca35…`, reproduced against the real engine, 4200-tick fuzz, 60 seeds × 1500 m of the Director)

| ID   | Sev  | What                                                                                                                                     | Status                                                                                             |
| ---- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| A-1  | MED  | Resuming from a pause burned the stumble i-frames (invulnT 1.4 → 0.17 across the 3-2-1) while the dogs stayed in the danger window       | **FIXED** — countdown holds `invulnT` / `laneChangeT` / `bufT`; probe-covered path                 |
| A-2  | MED  | A focused HUD button swallowed arrows / Space (control dead after clicking mute) — ledger `keydown-focused-control`, 3rd recurrence      | **FIXED** — bail on Space/Enter only; pointer click blurs; codebase scan: no other site            |
| A-3  | MED  | Slalom / combo row spacing fixed at 15 m (≈ 0.4 s lane-change window at top speed)                                                       | **FIXED** — spacing `max(15, 0.85·v + 4)` / `max(10, 0.85·v)`                                      |
| A-4  | LOW  | close-call bonus awarded late (far face), and also paid when the lane dodged into was blocked too; variable names `zNear`/`zFar` swapped | **FIXED** — awarded when the near face passes; ignores dodges into a blocked lane; names corrected |
| A-5  | LOW  | pause mid-slide/jump + resume + skip replayed "run" while the hitbox was still sliding/airborne                                          | **FIXED**                                                                                          |
| A-6  | LOW  | doc/code drift: speed recovery 0.99 s vs "2.2 s"; dead coyote time; `INPUT_BUFFER` comment; AC5 "5 s" vs 3.45 m                          | **FIXED** (code now matches 2.2 s; coyote removed; comments / docs corrected)                      |
| A-7  | LOW  | quitting forfeited the run's coins / best                                                                                                | **FIXED** — retiring banks them                                                                    |
| A-8  | LOW  | how-to legend / requirements said crates were hazard-striped                                                                             | **FIXED** — legend rewritten for the real-world obstacle set                                       |
| A-9  | LOW  | primitive runner kept running when caught                                                                                                | **FIXED** — topples                                                                                |
| A-10 | LOW  | two coins inside a pickup ring (cosmetic)                                                                                                | accepted (IDEAS)                                                                                   |
| A-11 | INFO | Jump clip hand span 1.25 m at take-off is an authored pose, weights sum 1                                                                | no action                                                                                          |

### QUALITY (agent `ab57ed…`)

| ID     | Sev | What                                                                                                                                                                                                    | Status                                                                                      |
| ------ | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Q-1    | MED | standing "checkable but unenforced": the AC probe is not in CI                                                                                                                                          | **TICKETED** — ledger + IDEAS (nightly / `workflow_dispatch`)                               |
| Q-2    | MED | reduced-motion probe could not fail                                                                                                                                                                     | **FIXED** — positive control (normal mode kicks > 3°)                                       |
| Q-3    | MED | top-level `if (renderer)` World / player-FX blocks are 262 / 63 lines (not caught by `max-lines-per-function`)                                                                                          | **TICKETED** — IDEAS (wrap as `buildWorld()` / `buildPlayerFx()`; low-risk, comment-banded) |
| Q-4    | MED | probe coverage claims not fully tested (countdown pose, GLB dogs, audio, import)                                                                                                                        | **FIXED** — countdown `__sum` + GLB dogs asserted; legacy import now persisted on load      |
| Q-5    | MED | AC1 static check's allow-regex would have passed the stale LICENSE path                                                                                                                                 | **FIXED** — exact allow-list, also scans CLAUDE.md + living docs                            |
| Q-6…12 | LOW | doc drift, naming (`GAP_CAUGHT`), dead code (`runner()`, `lastChangeAt`, `landed`, `chase.caught`, `.owned-tag`, `.sw.gold`, `move*0`), magic numbers, long functions, probe sleeps, leftovers in IDEAS | **FIXED** except long-function decomposition (ledgered / IDEAS) and `THUMB_PX` (LOW, left)  |

### COMPLIANCE (agent `a5bbb5…`)

| ID     | Sev | What                                                                                                                                                                                                                                          | Status                                                                                         |
| ------ | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| C-1    | MED | `LICENSE` still named `games/neon-rush/…` (stale attribution paths)                                                                                                                                                                           | **FIXED**                                                                                      |
| C-2    | MED | AC1 had no automated check beyond the setup text                                                                                                                                                                                              | **FIXED** — `_redirects` 301s, registry, and a stale-reference scan                            |
| C-3    | LOW | no licence text beside `music.ogg`; no MIT text for three.js                                                                                                                                                                                  | **FIXED** — `audio/music_license.txt`, `three_license.txt`                                     |
| C-4    | LOW | un-hashed assets cached 7 days vs coupled code                                                                                                                                                                                                | **MITIGATED** — rule added to `games/sunset-stride/CLAUDE.md` ("changed asset = new filename") |
| C-5    | LOW | WebGL-missing case untested; probe not in CI                                                                                                                                                                                                  | **FIXED / TICKETED** — no-WebGL probe added; CI wiring in IDEAS                                |
| C-6    | LOW | large PR (rename + rework)                                                                                                                                                                                                                    | noted in the PR description                                                                    |
| C-INFO | —   | hub handles the old `neon-rush` id; save key + `best.field` match the registry; CSP unchanged and sufficient (reasoned through the header text: same-origin fetch/Image/audio, `data:` thumbnails, `blob:` kept); all 33 asset files credited | verified                                                                                       |

### RISK (agent `a047c1…`, real Chrome with the production `_headers` CSP injected, hostile `localStorage`, corrupt / blocked assets, WebGL loss, heap sampling)

| ID  | Sev | What                                                                                                                                                                              | Status                                                                                                     |
| --- | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| R-1 | MED | `renderThumb` had no try/finally around its render-target swap: one throw in `render` / `readRenderTargetPixels` left the renderer bound to the 192 px target (game canvas blank) | **FIXED** — try/finally restores the target and clear alpha                                                |
| R-2 | LOW | no `webglcontextlost` handling (sim ran blind; shop thumbnails cached blank)                                                                                                      | **FIXED** — pauses on loss, `resetThumbs()` on restore                                                     |
| R-3 | LOW | `__stride` hook inputs unvalidated (`grantCoins("abc")`, `setQuality("__proto__")`, `step(1e9)`)                                                                                  | **FIXED** — `sanitizeCount`, `hasOwnProperty` tier check, `step` clamped to 120 s; probe-covered           |
| R-4 | LOW | `SaveManager.load`: `unlocked` not de-duplicated or capped; `muted:"false"` read as true                                                                                          | **FIXED** — de-duplicated, `muted === true`; hostile-save probe                                            |
| R-5 | LOW | "no per-frame allocation" contract not literally true (≈ 240 KB/s of short-lived number boxing in `setInst`)                                                                      | **ACCEPTED** — contract reworded in `games/sunset-stride/CLAUDE.md`                                        |
| R-6 | LOW | variant meshes built lazily (mid-run hitch), pool growth after retries                                                                                                            | **FIXED** — `prewarmObstacles` at run start; the 3-minute soak probe asserts the geometry count stays flat |
| R-7 | LOW | canvas size had no pixel cap (5K display ≈ 470 MB on the high tier)                                                                                                               | **FIXED** — drawing buffer capped at ≈ 4.5 M px                                                            |
| R-8 | LOW | no `TRUST_BOUNDARY` tags on `SaveManager.load` / `fetchBuf` → `GLTFLoader.parse`; 7-day cache on un-hashed assets                                                                 | **FIXED** (tags added) / **MITIGATED** ("changed asset = new filename" rule)                               |

**Verified clean by the lens:** no `innerHTML` / `eval` / dynamic script injection / cross-origin URLs / message listeners; shader patches built from constants and `toFixed` numbers only; 0 CSP violations under the production header (photos, GLB parse, `<audio>` music, `data:` thumbnails); `three.min.js` / `GLTFLoader.js` byte-identical to the previous copies; garbage / truncated / 404 / hanging GLBs fall back with 0 errors; no-WebGL shows the notice; secrets scan clean. **Not exhaustively tested by the lens:** the new `quitRun` banking (phase-guarded, single bank) and the new helpers beyond the shader and allocation checks.

**Re-check after the particles + audio work (owner request, same session):** the new `FX` / `AudioManager` code adds no DOM injection, no network access (every SFX is synthesised; the Kenney files are gone) and no new persisted state. The RISK lens ran on the build before that change; the new code was checked by the author with the probe (AC12), the CSP-neutral asset list, `npm run check` and `npm run secrets` only. That is a self-check, not an independent review.

## Blocker classification → response

No CRITICAL or HIGH finding was raised by any lens. Every MEDIUM is fixed or ticketed with an owner-visible entry (`docs/findings-ledger.md`, `docs/IDEAS.md`).

## Mid-run rework (owner request) and how it was verified

After the first panel round the owner asked for (1) higher-fidelity models and (2) obstacles that "make sense" for a real-world setting. Both were built on a branch, merged after the panel's fixes, and re-verified with the same tools: probe (draw calls ≤ 170 / ≤ 110 and luminance probes unchanged in kind), smoke, lint, plus close-up renders of every obstacle variant and of the runner / dogs (`scratchpad` screenshots listed in `product-validation.md`). A late finding from the screenshot review (the runner vanishing during i-frames) was fixed by ghosting instead of hiding.

## Human summary

The rebuild holds up under four independent reviews and a deterministic probe suite. Nothing blocked. The reviewers found real bugs that I had not (pausing burned your second chance; a focused button made the keyboard dead; late-game slaloms were too tight; a stale licence path), all now fixed and covered by probes. What is deliberately not done: running the 2-minute probe in CI, and splitting the longest setup functions — both are logged for a later cycle.

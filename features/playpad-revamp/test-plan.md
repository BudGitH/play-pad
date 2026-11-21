# Test Plan: PlayPad revamp (hub + all five games)

> **Phase 2 of the workflow.** Tests define "done". This plan was written at close-out from what shipped: the committed automated coverage (`npm run smoke`) plus the verification matrix each design spec asked for, marked with how each check was actually proven.

**Feature:** PlayPad revamp (hub + all five games)
**Ticket:** PLAY-006
**Created:** 2026-11-21

---

## How each check was verified (legend)

| Mark  | Meaning                                                                                                                                                                                                     |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** | **Automated and committed** (`tests/smoke.spec.mjs`, `tests/round-drivers.mjs`): runs in CI on every PR.                                                                                                    |
| **Q** | Proven by a one-off Playwright probe in the QA panel (`qa-accuracy-risk.md` "Verified OK", `qa-quality-compliance.md`). Not committed: it will not catch a regression.                                      |
| **P** | Observed in the persona / PM hands-on playthroughs (`product-validation.md`): 13 flows, 0 console errors, 0 overflow, on phone 390×844, landscape 844×390 and laptop 1366×800.                              |
| **–** | No recorded result. The design spec asked for it, but no QA report says it was measured. Treat as unverified. Candidates for the next round of smoke tests are collected in `docs/IDEAS.md` (QC-09, QC-08). |

## Coverage map (requirements AC → test)

| Acceptance criterion (`requirements.md`)                                      | Test(s)                                                                                                                                                        | Type         |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| AC-1 no errors, no sideways scroll, nothing clipped at the four viewports     | **A** hub at 360×740 / 390×844 / 768×1024 / 1366×800; **A** every game's setup + in-round at 390×844 and 1366×800. **Q** games at 360×740, 768×1024, 844×390.  | e2e          |
| AC-2 start → in-round → results → play again, touch **and** keyboard/mouse    | **A** start → in-round (touch tap on phone, click on desktop) in all five games. **P** results → Play again → quit → hub, keyboard-only pass. **–** not in CI. | e2e          |
| AC-3 hub redesign (tokens, light + dark)                                      | **A** card per live game, filter chips, theme toggle, reduced motion. **Q** hostile registry / storage, 320–1920 widths, contrast in both schemes.             | e2e + probes |
| AC-4 Claw Catch improvements                                                  | **A** in-round + frame counter advancing. **Q** scoring, odds, golden cap, best score, rotation, hidden tab, teardown. **P** playthroughs on phone and laptop. | e2e + probes |
| AC-5 Neon Rush polish, no T-pose / floating geometry, playable frame rate     | **A** in-round + score advancing. **Q** state fuzz, quality tiers, camera lanes. **P** animation weights, `groundGap`. Frame rate **–** (software GL only).    | e2e + probes |
| AC-6 `npm run check`, `npm run secrets`, `npm run smoke` pass; smoke extended | **A** CI jobs. At close-out: check exit 0 (0 errors, 28 `max-lines-per-function` warnings), secrets clean, smoke result recorded in `qa-report.md`.            | tooling      |
| _Seam feature?_ No (no backend), so no contract test.                         | n/a                                                                                                                                                            | n/a          |

## Automated coverage (`npm run smoke`, 20 tests)

1. Hub shows a card link `Play <title>` (correct `href`) for every live game; no page/console errors or failed same-origin requests.
2. Hub has no errors and no sideways scroll at 360×740, 390×844, 768×1024, 1366×800 (4 tests; also asserts the layout width equals the device width, i.e. the viewport meta is present).
3. Filter chips: All / Solo / Play together change the card count and the live region ("Showing n solo games"), `aria-pressed` follows, and the choice survives a reload.
4. Theme toggle flips `data-theme`, the button label and both `theme-color` metas; the choice survives a reload and `data-theme` is already set at `DOMContentLoaded` (no flash).
5. Reduced motion: the hub has zero running animations after load.
6. Every live game opens (HTTP 200, title matches, no errors).
7. A round starts in every live game at phone 390×844 (touch) and desktop 1366×800 (mouse): setup has no sideways scroll, Start works with no extra setup, the game's own in-round signal is reached (see `round-drivers.mjs`), a heartbeat counter advances where the game exposes one (Claw frame, Neon score), the in-round screen has no sideways scroll, no errors (10 tests).
8. Guard: `games.js` lists live games, and a live game with no driver is flagged in the test annotations (not a failure).

Known gaps in the automated set: results / Play again, keyboard-only path, landscape 844×390, 360×740 and 768×1024 per game, "focus `#quitBtn` in-round, press Space → setup" (the global-keydown ledger row), `scoreGuess` / `catchOdds` assertions. All in `docs/IDEAS.md`.

## Verification matrix by area

### Hub (`design-hub.md` §5)

| #   | Check                                                                                              | How  | Note                                                                   |
| --- | -------------------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------- |
| 1   | No errors, no overflow, 360–1920, light + dark                                                     | A, Q | CI runs 4 widths; QA probed 320, 844×390 and 1920 as well              |
| 2   | Grid is 1 / 2 / 3 columns, no `.rail`                                                              | P    | Persona screenshots at 390 and 1366; no assertion on the column count  |
| 3   | At 390×844, Play now + ≥2 cards fully visible                                                      | P    | PM: "2.5+ games above the fold" (was 1)                                |
| 4   | One link `Play <title>` per live game, `href` correct                                              | A    |                                                                        |
| 5   | Solo chip leaves solo games, `aria-pressed`, live region, persists; storage throwing still renders | A, Q | Persist + live region in CI; throwing/hostile storage by the QA probe  |
| 6   | Theme button flips `data-theme` + label + both metas; persists; no flash                           | A    |                                                                        |
| 7   | Best badge: `12480` shown; `1e999`, `-5`, `"abc"`, malformed JSON show nothing, no error           | Q    | Claw / Decoder badges via `bestOverall` added in `618802d`             |
| 8   | "Jump back in" after a launch; "Game of the day" fresh; Surprise me never picks the last played    | Q, P | 25 Surprise-me draws, all five games reached; survives bfcache Back    |
| 9   | Keyboard order skip → theme → Play now → Surprise → chips → cards → footer, focus ring visible     | P, Q | A specific card takes 11 Tabs (IDEAS)                                  |
| 10  | 48px targets; reduced motion = no animations                                                       | A, Q | Reduced motion in CI; chip hit area measured 46px (QC-10, open)        |
| 11  | Old-fields-only and `status: "soon"` entries render; hostile `games.js` is inert                   | Q    | 0 injected nodes, links neutralised                                    |
| 12  | `check`, `secrets`, `smoke` pass; CSP unchanged                                                    | A, Q | QA also loaded every page under the exact `_headers` CSP: 0 violations |

### Colour Rush + Snap (`design-party-games.md` §3)

| #   | Check                                                                                         | How  | Note                                                                    |
| --- | --------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------- |
| 1   | No errors / overflow / overlap at five viewports, 2 and 4 players                             | A, Q | CI at 2 widths; fuzzers (10 rounds each: taps, resize, hide, Esc) clean |
| 2   | Fresh load: Start enabled, round in 2 taps, Start visible without scrolling                   | A, P | CI asserts the preselected 2-player chip + Start works                  |
| 3   | Colour Rush: quit mid-countdown leaves no overlay, no ghost game after 70 s                   | Q    | One `.screen.active`, no dots after leaving; no committed test          |
| 4   | Rotation during the 3-2-1: every dot inside the play area                                     | Q    | Resize is in the fuzzers; not asserted as a specific case               |
| 5   | Landscape results: Play again visible; stacked buttons at 360                                 | P    |                                                                         |
| 6   | Contrast ≥ 4.5:1 on every player colour, no Red/Pink pair, glyph on every dot / chip / swatch | Q    | Black ink; the "glyph contrast" findings of a naive checker are false   |
| 7   | Snap cadence: countdown in round 1 only, random shuffle delay, ≥14 rounds per minute          | Q    | Shuffle-window tap fairness verified; the rounds-per-minute figure is – |
| 8   | Snap keyboard A / L / Q / P, no repeat, Esc twice quits                                       | Q    | 4-player seat scoring verified                                          |
| 9   | Gentle mode: no point lost, still locked out                                                  | Q    |                                                                         |
| 10  | Pause: clock frozen while hidden (0:55 before and after 30 s), resume = 3-2-1                 | Q    | Quit reachable while paused added in `618802d` (AR-07)                  |
| 11  | Reduced motion: dots tappable for their full life; no confetti                                | Q    |                                                                         |
| 12  | Play again ×3 with no stacked overlays or duplicate RAF loops                                 | Q    | Fuzzers: exactly one active screen after every action                   |

### Super Decoder (`design-super-decoder.md` §4)

| #     | Check                                                                                     | How  | Note                                                                            |
| ----- | ----------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------- |
| 1     | No errors / overflow on setup, in-round, banner, results at five viewports                | A, Q | CI at 2 widths (setup + in-round)                                               |
| 2–5   | Feedback shapes distinguishable; all rows fit; landscape two-pane; palette 48–64px        | P    | Persona playthroughs at 390, 844×390, 1366; no computed-style assertions        |
| 6     | Keyboard-only session (Enter on focused buttons, 1–6, ←/→, Delete); focus after a submit  | P    | Persona Sam; focus lands on the results title                                   |
| 7–8   | Locked states during reveal; `role="img"` + label on feedback                             | –    |                                                                                 |
| 9     | `PLACING` within 300 ms of Start; Next code advances exactly one code (no double-advance) | A, Q | Round driver waits for `PLACING`; QA raced `skipBanner()` ×3 + 2 clicks + timer |
| 10–11 | Quick round = 1 code; Start visible at 360×740                                            | –    |                                                                                 |
| 12    | Best persisted per difficulty, banked once, storage throwing still plays                  | Q    | Plus hostile values (`1e999`, array, `__proto__`)                               |
| 13    | Reduced motion: session completes, no running animations                                  | Q    | Setup screen measured (0 animations); in-round **–**                            |
| 14    | Quit mid-reveal / mid-banner leaves `pendingTimeouts` empty                               | Q    |                                                                                 |
| 15    | `scoreGuess` AC-7 fixtures unchanged                                                      | Q    | 1,679,616 secret / guess pairs vs an independent reference: 0 mismatches        |

### Claw Catch (`design-claw-catch.md` §4)

| #     | Check                                                                                       | How  | Note                                                                     |
| ----- | ------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------ |
| 1     | No errors / overflow, HUD clear of the rail, targets ≥ 48                                   | A, Q | CI: in-round + frame counter advancing                                   |
| 2     | Rotation mid-round keeps every prize inside the tray                                        | Q    | 13 mid-phase rotations; `carried2` rescale (AR-06) was code-reading only |
| 3–5   | Hopper refills, density, claw stops on the pile                                             | P    | Visual playthrough; no assertion of `binCap` or tip height               |
| 6     | Keyboard: Tab to DROP + Enter, arrows / A D / Space, results → Play again                   | P, Q | QC-01 probe: Space with `#quitBtn` focused (fixed `f038e53`)             |
| 7–9   | Odds, streak (×2 at 3, ×3 at 6), golden +10 and +5 s capped at +20 s                        | Q    | Forced catches; the 10k-trial Monte-Carlo of `catchOdds` is **–**        |
| 10    | Best saved per `<secs>-<difficulty>`, hostile values rejected, storage throwing still plays | Q    |                                                                          |
| 11    | Teardown: quit during countdown, drop, close, lift, return, release                         | Q    | One loop after restart (~63 frames/s)                                    |
| 12    | Hidden 20 s mid-round: clock unchanged to within a frame                                    | Q    |                                                                          |
| 13–14 | Reduced motion; dark cabinet under a light system                                           | Q, – | Setup screen 0 animations; cabinet surface not separately recorded       |
| 15    | Smoke reaches in-round on phone + desktop                                                   | A    |                                                                          |

### Neon Rush (`design-neon-rush.md` §6)

| #   | Check                                                                                        | How  | Note                                                                                 |
| --- | -------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------ |
| 1   | No errors through setup → run → jump → slide → crash → results → retry, 3 skins, 4 viewports | A, Q | CI: in-round at 2 viewports, score advancing; 14-step flow fuzz in QA                |
| 2–3 | `groundGap` < 0.05, no sky under buildings; fog hue stays violet; sun visible                | P    | `groundGap` max 0.02 in the PM pass; screenshots for the sun                         |
| 4   | Sound toggle hit area ≥ 48                                                                   | Q    | Fixed (`.switch::before`)                                                            |
| 5–7 | Slide head height, jump clips, no T-pose (weights sum to 1 in every state)                   | P    | Run, jump, air, slide, death; retry #2 / #3 per skin was part of earlier PLAY-005 QA |
| 8   | Crash: death clip, runner stays ≥ 70% in frame                                               | P    | Crash framing fixed in `cf645b2` and later                                           |
| 9   | Cruiser overlap ≤ 10% at tension 1                                                           | –    | Not automated; see IDEAS                                                             |
| 10  | All three lanes visible at every viewport (portrait included), survives rotation mid-run     | Q    | 320×568 … 1366×800                                                                   |
| 11  | Draw calls: high ≤ 170, low ≤ 110                                                            | –    | CLAUDE.md records ≈75–90 main pass; no report re-measured it                         |
| 12  | Reduced motion: no sky sway / flicker / shake / flash / speed lines                          | –    |                                                                                      |
| 13  | `check`, `secrets`, `smoke` pass; `assets/CREDITS.md` unchanged                              | A, Q | No asset added or removed in the range                                               |
| –   | Quality tiers auto-downgrade; real-device frame rate                                         | Q, – | Downgrade fired under SwiftShader; **no real-hardware measurement**                  |

## How to run

```
npm install                          # once (dev tooling only)
npx playwright install chromium      # once
npm run smoke                        # the 20 automated tests (CI runs the same)
npm run check                        # eslint + prettier (0 errors; 28 max-lines-per-function warnings)
npm run secrets
# Cloud dev box with a pre-installed Chromium:
PW_CHROMIUM_PATH=/usr/bin/google-chrome npm run smoke
```

A new game: add its entry to `games.js`; optionally add one entry to `tests/round-drivers.mjs` (start button, in-round signal, optional heartbeat). Without an entry it still gets the "opens without errors" check.

## Definition of done

- [x] All automated tests pass (result recorded in `qa-report.md`).
- [x] Every acceptance criterion in `requirements.md` is covered by **A**, **Q** or **P** evidence above; the **–** rows are listed in `docs/IDEAS.md`.
- [x] The design path ran (`design-*.md` per area); the tests and probes encode the chosen designs, not a generic UI.
- [x] `qa-report.md` has no unresolved CRITICAL / HIGH. One ledger `STOP_SHIP` (`tap-target-size`) needs an explicit owner decision: see `qa-report.md`.

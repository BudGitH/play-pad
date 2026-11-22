# Test Plan: Sparkle Salon

> **Phase 2 of the workflow.** Tests define "done". The tests are one headless Playwright probe, `features/sparkle-salon/probe.mjs` (dev-only, not part of `npm run smoke`); the orchestrator adds the game to the smoke driver via `__salon` (see "Smoke contract").

**Feature:** Sparkle Salon
**Ticket:** PLAY-008
**Created:** 2026-11-22

---

## Coverage map (AC → test)

| Acceptance criterion      | Probe check(s) (`id`)                                                                                                  | Type                     |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| AC-1 Title screen         | `AC-1` (phase, Start inside viewport, frame idle), `AC-1b` (sound toggle, back link)                                   | e2e                      |
| AC-2 Start / client card  | `AC-2` (4 hints), `AC-2b` (RAF `frame` runs)                                                                           | e2e                      |
| AC-3 Steps in order       | `AC-3a` (8 dots), `AC-3b` (names in order)                                                                             | e2e                      |
| AC-4 Rub-to-apply         | `AC-4a` cleanse, `AC-4b` eye shadow (monotonic + auto-complete), `AC-4c` ring ✓, `AC-4d` mascara lashes                | e2e (real mouse strokes) |
| AC-5 Tap dab              | `AC-5`                                                                                                                 | e2e                      |
| AC-6 Tap-to-choose        | `AC-6a` lenses, `AC-6b` accessories, `AC-6c` stickers                                                                  | e2e                      |
| AC-7 Redo                 | `AC-7`                                                                                                                 | e2e                      |
| AC-8 Next / Skip          | `AC-8a` (ready after done), `AC-8b` ("Photo!" on the last step)                                                        | e2e                      |
| AC-9 Coins & unlocks      | `AC-9a` (lock badge, no Unlock when broke), `AC-9b` (spend + save + select), `AC-9c` (reload)                          | e2e                      |
| AC-10 Persistence         | `AC-10a` (reload), `AC-10b` (hostile save), `AC-10c` (blocked storage)                                                 | integration              |
| AC-11 Reveal              | `AC-11a` flash + stars, `AC-11b` coins banked, `AC-11c` `bestOverall`, `AC-11d` stars lit                              | e2e                      |
| AC-12 Matching & fairness | `AC-12a` (4 matches → 3 stars), `AC-12b` (all skipped → 1 star, 15 coins)                                              | e2e                      |
| AC-13 Replay              | `AC-13`                                                                                                                | e2e                      |
| AC-14 Audio               | `AC-14` (toggle persists, suspends when hidden), `AC-14b` (music scheduled, effects fire), `AC-17` (no audio requests) | e2e                      |
| AC-15 Accessibility       | `AC-15a`–`AC-15g`                                                                                                      | e2e                      |
| AC-16 Responsive          | `AC-16 390x844`, `360x640`, `844x390`, `820x1180`, `1280x800`                                                          | e2e                      |
| AC-17 Clean page          | `AC-17`                                                                                                                | e2e                      |
| AC-18 file://             | `AC-18`                                                                                                                | e2e                      |
| AC-19 Test hook           | `AC-19`                                                                                                                | e2e                      |

## Test cases

### Happy path

- [x] Start → client card → eight steps (real mouse strokes for cleanse / eye shadow / mascara / blush / lipstick; clicks for lens / accessories / stickers) → photo with stars → Play again.
- [x] Matching the four requested colours (tray buttons carrying the heart badge) yields 3 stars.
- [x] Coins +10/step, +25/match, +15/star; unlock spends the exact cost.

### Edge cases (boundaries)

- [x] Skip every step: still 1 star + 15 coins, `stepsDone === 0`.
- [x] Single tap on blush: progress > 0 and < 80%.
- [x] Redo after partial paint: progress exactly 0.
- [x] Reload restores coins, unlocks, best.
- [x] Touch (isMobile + hasTouch): tap on the lifted tool tip paints.
- [x] Landscape 844×390 and short 360×640 phones: nothing clipped off-screen.
- [x] Reduced motion: whole flow completes with stars lit.

### Error paths

- [x] Locked colour with too few coins → sheet without an Unlock button; coins unchanged.
- [x] Hostile save (`"1e999"`, `Infinity`, `__proto__`, unknown ids, `stars: 99`, `score: 1e99`) → clamped/dropped.
- [x] `localStorage` getter throws → page still loads and plays (title phase reached, no errors).

### Non-functional checks

- [x] **Accuracy:** the probe asserts the exact star/coin formula for the two extreme runs (4 matches / 0 matches); coverage progress is checked for monotonicity.
- [x] **Risk:** save sanitising (AC-10b), only same-origin requests (AC-17); the code review lens must confirm no `innerHTML` with dynamic data (grep: the only `innerHTML` absent).
- [x] **Compliance:** nothing personal is stored; a parent-visible list of persisted fields is in AC-10.
- [x] **Not asserted by machines:** how the make-up _looks_ and how the sounds _sound_ — the fidelity loop compared screenshots to the owner's reference by eye (see `screens/`), and the audio mix needs a human ear on a real device (the probe only proves the cues are triggered and the context suspends when hidden).

## How to run

```
# from the repo root (deps installed: npm ci). The probe starts tools/serve.mjs itself on :5601 if nothing answers.
PW_CHROMIUM_PATH=/path/to/chrome node features/sparkle-salon/probe.mjs     # PW_CHROMIUM_PATH optional
npx eslint games/sparkle-salon/index.html
npx prettier --check games/sparkle-salon features/sparkle-salon
```

Screenshots (390×844 and 1280×800, plus a landscape phone) are written to `features/sparkle-salon/screens/`.

## Smoke contract (for the orchestrator's `tests/round-drivers.mjs`)

```js
"sparkle-salon": {
  start: "Start makeover",
  signal: "__salon.phase === 'playing' and __salon.frame advancing",
  async waitForRound(page) {
    await expect.poll(() => page.evaluate(() => window.__salon?.phase), { timeout: ROUND_TIMEOUT_MS }).toBe("playing");
  },
  heartbeat: (page) => page.evaluate(() => window.__salon.frame),
}
```

The Start button is a plain `<button>` whose accessible name is exactly "Start makeover"; it carries no scaling animation (a transform pulse would never pass Playwright's "stable" check).

## Definition of done

- [x] All probe checks pass (45+/45+ — see the report for the latest run).
- [x] Every acceptance criterion in `requirements.md` is covered.
- [x] The tests encode the **chosen** design (owner's reference): tray, tool cursor, step indicator, request card, photo.
- [ ] `qa-report.md` is clean (no unresolved CRITICAL/HIGH) — **Phase 4, run by the orchestrator.**

> The full release checklist is the **Definition of Done** in `docs/WORKFLOW.md` (Phase 6).

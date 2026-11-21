# Test Plan: PlayPad launch — catalog hub + MD3 design system + Colour Rush rebuild

> **Phase 2 of the workflow.** Tests define "done". At **Prototype** tier with no automated harness, the "tests" are an explicit **manual / preview-driven checklist** plus static review by the Phase-4 QA panel; every acceptance criterion maps to at least one check. (When a test harness is added later, port the happy-path + top edges here first.)

**Feature:** PlayPad launch
**Ticket:** PLAY-001
**Created:** 2026-06-21

---

## Coverage map (AC → test)

| Acceptance criterion | Test(s) | Type |
|---|---|---|
| AC-1 hub renders from registry | T-hub-render | manual/preview |
| AC-2 live card navigates | T-card-nav | manual/preview |
| AC-3 horizontal scroll + arrows + no h-scroll | T-rail, T-rail-arrows, T-no-overflow | manual/preview |
| AC-4 "soon" card dimmed & non-interactive | T-soon-card | manual/preview + static |
| AC-5 one-line add (no hub edits) | T-add-game (static contract review) | static |
| AC-6 light/dark via tokens | T-theme-dark, T-theme-light, T-no-raw-values | preview + static |
| AC-7 full game round | T-game-happy | manual/preview |
| AC-8 unique colours | T-colour-exclusivity | manual/preview |
| AC-9 quit preserves selections | T-quit | manual/preview |
| AC-10 back link | T-backlink | manual/preview |
| AC-11 old prototype untouched | T-prototype-unchanged | static/diff |
| AC-12 favicon + manifest | T-favicon, T-manifest | preview + static |
| AC-13 a11y floor | T-keyboard, T-focus, T-h1, T-tap-size, T-reduced-motion, T-contrast | preview + static |

## Test cases

### Happy path
- [ ] T-hub-render: open `index.html` → app bar (logo+wordmark) + Games section + 1 live card (Colour Rush) + "1 game" count; no console errors.
- [ ] T-card-nav: click the Colour Rush card **and** Tab→Enter on it → both load `games/colour-rush/`.
- [ ] T-game-happy: 2 players, pick two colours, Start → countdown → dots spawn → results screen appears after the round → Play again restarts; Change settings returns to setup.
- [ ] T-backlink: "← PlayPad" on setup and on results → returns to `index.html`.

### Edge cases (boundaries)
- [ ] T-rail: with 2+ overflowing cards, the row scroll-snaps; a peek of the next card shows.
- [ ] T-rail-arrows: fine pointer + wide + overflow → prev/next scroll one card and disable at ends; ≤720px or coarse pointer → arrows hidden (`display:none`), swipe works.
- [ ] T-no-overflow: at 375/768/1280px the page has **no horizontal scrollbar**.
- [ ] T-soon-card: the "More to come" card is dimmed, `aria-disabled`, and **not** focusable via Tab.
- [ ] T-colour-exclusivity: P1 picks Red → Red is disabled in P2's row, and vice-versa.
- [ ] T-quit: start a round, press ✕ → back on setup with the same colours still selected and Start enabled.
- [ ] T-game-edges: a round where nobody taps → "Nobody scored"; force equal scores → "It's a tie!"; one point → label reads "1 point".
- [ ] T-empty-registry (static/temporary): with `GAMES=[]` the track shows the "No games yet" placeholder (no crash).

### Error paths
- [ ] T-escape: add a registry entry whose title contains `<b>&"x` → it renders as literal text (no injected markup) — confirms `esc()` covers every injected field.

### Non-functional checks
- [ ] **Accuracy:** T-scoring — only the tapped dot's owner increments; the timer reaches 0:00 and ends the round; spawns stay balanced across colours.
- [ ] **Risk:** T-escape (above) is the only trust boundary; confirm no `eval`, no remote fetch, no secrets.
- [ ] **Compliance:** confirm no storage/network/PII; nothing to audit.
- [ ] **A11y:** T-keyboard (tab through hub→game), T-focus (visible ring on every control), T-h1 (one per page), T-tap-size (cards/buttons ≥48px), T-reduced-motion (animations collapse), T-contrast (AA in light+dark; primary text uses the lightened `#FF6B85` on dark).
- [ ] **Static:** T-prototype-unchanged (`Old prototype/index.html` matches original); T-no-raw-values (component CSS references `--md-sys-*`, not raw hex/px); T-add-game (adding a game touches only `games.js` + a new `games/<slug>/`).

## How to run

```
# Static server (Python is available; Node is not on this machine):
python -m http.server 5500        # then open http://localhost:5500/
# or simply open index.html directly (file://) — the site is build-free.
# Preview harness config: .claude/launch.json → "playpad"
```

## Definition of done
- [ ] All checks above pass (or are noted with a fix plan).
- [ ] Every acceptance criterion in `requirements.md` is covered.
- [ ] The **full** design path's chosen options (horizontal selection, auto-theme, registry hub, rebuilt game) are what the checks exercise.
- [ ] `qa-report.md` is clean (no unresolved CRITICAL/HIGH) and `product-validation.md` PASSES.

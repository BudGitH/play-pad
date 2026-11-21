# Test Plan: Snap — themed card-matching reaction game

> **Phase 2 of the workflow.** At **Prototype** tier with no automated harness, the "tests" are an explicit
> **manual / preview-driven checklist** plus static review by the Phase-4 QA panel; every acceptance
> criterion maps to at least one check. (When a test harness is added later, port the happy-path + top
> edges here first.)

**Feature:** Snap
**Ticket:** PLAY-002
**Created:** 2026-06-21

---

## Coverage map (AC → test)

| Acceptance criterion                                          | Test(s)                                                                         | Type             |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------- |
| AC-1 setup + colour exclusivity + Start gating                | T-setup, T-colour-exclusivity, T-start-gate                                     | manual/preview   |
| AC-2 countdown → simultaneous flip                            | T-reveal                                                                        | manual/preview   |
| AC-3 match → first tap +1, later taps ignored                 | T-match-score, T-match-first-only                                               | manual/preview   |
| AC-4 non-match → −1 floored, locked, others safe, full window | T-penalty, T-floor, T-lockout, T-nonmatch-window                                | manual/preview   |
| AC-5 loop ends at 0:00 → results (winner/tie/zero)            | T-loop-end, T-results-winner, T-results-tie, T-results-zero                     | manual/preview   |
| AC-6 quit/again/change/back                                   | T-quit, T-again, T-change, T-backlink                                           | manual/preview   |
| AC-7 intensity + theme + sound take effect                    | T-intensity, T-theme, T-sound                                                   | manual/preview   |
| AC-8 a11y floor                                               | T-keyboard, T-focus, T-reduced-motion, T-contrast, T-no-colour-only, T-srstatus | preview + static |
| AC-9 one-line add                                             | T-registry (static contract review), T-hub-card-nav                             | static + preview |

## Test cases

### Happy path

- [ ] **T-setup:** open `games/snap/` → setup shows theme picker (Nature default), Players 2–4, colour
      rows, Round length, Intensity, Sound, Start. No console errors.
- [ ] **T-reveal:** Start a game → `#countdown` shows 3·2·1·GO, then **both** cards flip face-up at the
      same time, each showing one themed emoji.
- [ ] **T-match-score:** on a **match** round, tapping a player button (or its key) increments **that**
      player's score by 1, plays the win flash/sound, and the round resolves.
- [ ] **T-loop-end:** let the clock run to **0:00** → the game ends and the results screen appears.
- [ ] **T-results-winner:** results rank by **pairs** desc; the top scorer shows the crown + "Player N
      wins" / "X pairs" ("1 pair" singular).
- [ ] **T-backlink:** "← PlayPad" on setup and results returns to `index.html`.

### Edge cases (boundaries)

- [ ] **T-colour-exclusivity:** P1 picks Red → Red is **disabled** in every other player's row; deselecting
      re-enables it.
- [ ] **T-start-gate:** Start is **disabled** until every active player has a colour; reducing player count
      drops now-extra selections; the note text updates.
- [ ] **T-match-first-only:** on a match, a **second** player tapping after the first does **not** also
      score; the round is already resolved.
- [ ] **T-floor:** a player at **0** who taps a non-match **stays at 0** (never negative).
- [ ] **T-lockout:** after a wrong tap, that player's further taps in the same round do nothing (🚫 state);
      the lockout clears next round.
- [ ] **T-nonmatch-window:** on a non-match, one player's fast wrong tap does **not** end the round — it
      runs the full reveal window; other players are unaffected (no forced penalty).
- [ ] **T-missed-snap:** a match where nobody taps within the window → "Missed!" cue, no score, advance.
- [ ] **T-countdown-tap:** tapping **during** the 3-2-1 (before reveal) neither scores nor penalises.
- [ ] **T-results-tie:** force equal top scores → "It's a tie!" naming the tied players.
- [ ] **T-results-zero:** a game where nobody snaps a pair → "No snaps landed".
- [ ] **T-quit:** ✕ mid-round → back on setup with the same theme/colours/settings still selected.
- [ ] **T-overlay-teardown:** end the game (clock hits 0:00) **during the 3-2-1**, and separately quit ✕ **during the 3-2-1** → the countdown overlay does NOT linger over the results/setup screen. _(regression — fixed 2026-06-21)_
- [ ] **T-again / T-change:** results → Play again restarts the same settings; Change settings → setup.
- [ ] **T-players-2-3-4:** at 2/3/4 players the correct number of edge buttons appear, rotated to face
      each seat; both cards stay centred (check phone portrait **and** landscape via `preview_resize`).
- [ ] **T-distinct-nonmatch:** across many non-match rounds the two cards are always **visibly different**
      symbols (never two identical on a non-match).

### Error paths

- [ ] **T-registry-escape:** (inherited hub behaviour) the Snap registry strings contain no markup; the hub
      renders them as literal text via `esc()` — confirm the card title/description show no injected markup.
- [ ] **T-no-secrets:** static scan — no `eval`, no remote `fetch`, no storage, no secrets in the file.

### Non-functional checks

- [ ] **Accuracy:** T-match-score (only the tapper's score moves), T-floor, T-match-first-only, T-loop-end
      (ends exactly at 0:00), T-distinct-nonmatch.
- [ ] **Risk:** T-no-secrets; the only trust boundary (registry string) is the hub's, already escaped.
- [ ] **Compliance:** confirm no storage/network/PII; nothing to audit; Prototype comment level honoured
      (section banners + Tier-3 "why" comments on the load-bearing logic).
- [ ] **A11y:** **T-keyboard** (tab through the whole setup; each player's key drives their button in-game),
      **T-focus** (visible ring on every control incl. theme cards + swatches), **T-reduced-motion** (flip
      snaps but pacing/scoring stay correct; game fully playable), **T-contrast** (AA in light + dark; white
      score text ≥28px on saturated fills), **T-no-colour-only** (locked = 🚫 + grey + error border; win = ✓
      badge + flash + sound), **T-srstatus** (`#srStatus` announces each outcome + the final result).
- [ ] **Static:** **T-registry** (adding the game touches only `games.js` + `games/snap/`; `coming-soon`
      removed), **T-no-raw-values** (component CSS references `--md-sys-*` / `--brand-*` / `--snap-theme-*`,
      not raw themeable hex/px beyond the deliberate `#000` stage), **T-hub-card-nav** (the Snap card renders
      and navigates to `games/snap/`).

## How to run

```
# Static server (Python available; Node is not on this machine):
python -m http.server 5500        # then open http://localhost:5500/
# or open index.html directly (file://) — the site is build-free.
# Preview harness config: .claude/launch.json → "playpad"
```

## Definition of done

- [ ] All checks above pass (or are noted with a fix plan).
- [ ] Every acceptance criterion in `requirements.md` is covered.
- [ ] The chosen options (two-card simultaneous reveal · 2–4 players · −1 floor-at-0 · touch+keyboard) are
      what the checks exercise.
- [ ] `qa-report.md` is clean (no unresolved CRITICAL/HIGH) and `product-validation.md` PASSES.

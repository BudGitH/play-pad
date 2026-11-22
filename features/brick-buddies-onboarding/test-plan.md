# Test Plan: Brick Buddies onboarding

> **Phase 2 of the workflow.** Tests define "done". Every acceptance criterion maps to at least one test.

**Feature:** Brick Buddies onboarding (first-run how-to, "?" button, coach, three-tap first goal, simple first run)
**Ticket:** PLAY-009 (follow-up)
**Created:** 2026-11-22

---

## Coverage map (AC -> test)

| Acceptance criterion            | Test(s)                                                                                                                                                       | Type             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| AC-22.1 First-run help          | `tests/brick-buddies-help.spec.mjs` "shows on first run ..." (phone + desktop); probe "AC-22.1/2 first-run how-to"                                            | e2e (Playwright) |
| AC-22.2 Dismiss + remember      | same specs (Let's go, reload, Esc); spec "title screen ... close X"; spec "with storage blocked ..."; probe "AC-22.2 blocked storage"; New world in the probe | e2e              |
| AC-22.3 Re-open from "?"        | spec "... reopens" (>= 48px, on screen); probe "AC-22.3/9 at 390x844 / 844x390 / 568x320 / 1280x800"                                                          | e2e              |
| AC-22.4 Three-tap first goal    | probe "AC-22.4 the pre-built hut ..." (shell tiles + 3 `tryPlace` calls house Pip, +40); "AC-18 the full recipe still houses a buddy on bare ground"          | e2e (probe)      |
| AC-22.5 Coach line              | probe "AC-22.5-8 the coach walks a child through the first room" (walk, mode, pick x3, tap x3, step, moving, next, plain coach; texts <= 28 chars)            | e2e (probe)      |
| AC-22.6 Points at the control   | spec "the coach says what to do next and rings the control"; probe slot ring check; probe "AC-22.6 reduced motion" (animation none vs `bb-pulse`)             | e2e              |
| AC-22.7 Taps on the glow work   | spec (tap the second half of the bed); probe (tap the LAST tile of bed / torch / door footprints)                                                             | e2e              |
| AC-22.8 Simple first run        | probe coach flow (hidden during request 1, shown after the move-in); spec (Items hidden, coin chip hidden)                                                    | e2e              |
| AC-22.9 No regressions          | full probe (AC-1..21), `npm run smoke` (every game still starts; `phase` stays `playing` under the how-to), lint / format / secret scan, AC-19 layouts        | regression       |
| AC-22.10 Reads as easy (manual) | `product-validation.md` (persona walkthroughs from real screenshots; owner to confirm with a real child)                                                      | manual           |

## Test cases

### Happy path

- [x] Fresh visitor presses Start: the "How to play" dialog opens with 4 picture cards and "Let's go!" focused; `phase` is `playing`.
- [x] "Let's go!" closes it; reload + Start does not show it; "?" shows it again; Esc closes it.
- [x] Coach: Walk to the hut -> Pick the bed (slot 5 ringed) -> Click the glowing spot -> Pick the torch -> ... -> Pick the door -> ... -> Pip is moving in! -> A new home!; `housed === 1`, +40 coins; coins / stars / Items appear.
- [x] Phone: the left pad is ringed for "Walk to the hut"; tapping the second half of the glowing bed places the bed on its planned spot.

### Edge cases (boundaries)

- [x] Break mode on: "Switch to Build" with the mode button ringed.
- [x] Player standing in the doorway with the door selected: "Step aside" (arrow), not a refusal toast.
- [x] Older save / wrecked hut (probe `wreckHut`): the plain coach, Items / coins show, the card keeps its old open-then-collapse behaviour (AC-12 / AC-17 / AC-19 checks run in this state).
- [x] Full recipe on bare ground (no pre-built hut) still houses a buddy.
- [x] Four viewports: 390x844, 844x390, 568x320, 1280x800 - `?` >= 48px and inside the screen; coach, strip, card shut or open: no HUD overlaps; the how-to card fits the screen (Let's go reachable).
- [x] Hotbar without bed / torch / door: Items stays visible (the simple first run needs the kit on the bar) - covered by reading `updateSimple`; not separately probed.

### Error paths

- [x] `localStorage` throws: the how-to shows once per visit, closes, no page / console error (spec + probe).
- [x] Keys and taps while the how-to is open do not move the player or change the selected slot.

### Non-functional checks

- [x] **Accuracy:** coach text is derived from world state every 0.2 s (probe walks every step with real input).
- [x] **Risk:** no `innerHTML`; storage access try/catch; the save key / format asserted unchanged (`playpad.brickBuddies.v1`).
- [x] **Compliance:** no network (probe AC-14 still shows 0 non-data requests), no new dependency.
- [x] **Accessibility:** dialog is `role=dialog` + `aria-modal`, focus moves in and returns to the game, Esc closes, Tab is trapped; the coach is a polite live region; reduced motion removes the pulse and the arrow bob.

## How to run

```
npm install && npx playwright install chromium     # once
npm run check && npm run secrets                    # lint + format + secret scan
npm run smoke                                       # includes tests/brick-buddies-help.spec.mjs
PW_CHROMIUM_PATH=<chromium> node features/brick-buddies/probe.mjs   # AC-1..22 (not part of CI)
```

## Definition of done

- [x] All AC-22.1..9 pass; AC-22.10 judged in `product-validation.md`
- [x] QA panel clean (`qa-report.md`)
- [x] Product + persona validation PASS (`product-validation.md`)

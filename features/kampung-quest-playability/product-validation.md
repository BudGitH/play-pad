# Product Validation: Kampung Quest playability round

> **Phase 5 output.** Produced after `qa-report.md` is PASS. Roles from `docs/PRODUCT-PANEL.md`. The Senior PM ran as an **independent agent** with the requirements, the QA trail and the build screenshots. **The persona panel (5B) was waived by the owner** ("Skip persona", 2026-11-28), so this page records the PM gate only and does not claim persona verdicts. Real child and parent feedback outranks this page.

**Feature:** Kampung Quest playability round
**Ticket:** PLAY-014
**Run at:** 2026-11-28 (5A round 1 at `ec678d8`; conditions closed by `d653b03`)
**Overall product gate:** [x] PASS (PM PASS, conditions met; 5B waived by the owner)

---

## The gate

PM = PASS with zero open business-requirement blockers. The persona tier (baseline / value / satisfaction) was not run because the owner explicitly waived it; that is recorded in `docs/DECISIONS.md`, and it is the reason this page shows no persona scores.

## 5A - Senior PM review (business requirements)

| Round | Verdict                | Blocking issues | Notes                                                                                     |
| ----- | ---------------------- | --------------- | ----------------------------------------------------------------------------------------- |
| 1     | PASS with 2 conditions | 0               | Condition 1: decide AC-P17 (cast "Say hi"). Condition 2: no new failures in the full run. |

**Evidence anchor** (`requirements.md`, business outcome: "a 6-10 year old can find any place, get there by the most fun means (walk, run, bike, car, camel, horse), do the rites without the screen being blocked, and play as a boy or a girl, on an iPad, without help"):

| Clause                           | Verdict             | Evidence                                                                                                                                   |
| -------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Find any place                   | met                 | full map with every establishment, zoom / pan, "Go here" route and beacon; phone overview keeps headline places (QA fix)                   |
| Get there by the most fun means  | met                 | car 2.84×, scooter 2.27×, bicycle 1.68×, lorry 2.18× run speed; rideable camels, horses, ponies; solid, grounded vehicles; traffic and bus |
| Rites without the screen blocked | met                 | every stepper card minimises to a chip; Walk for me auto-minimises                                                                         |
| Boy or girl                      | met                 | picker on New game; distinct girl model; modest outfits for both; gendered ihram and tahallul                                              |
| On an iPad                       | partly              | detection, touch UI, tiering, load cuts measured in emulation; a real-iPad check remains (AC-P22 / P23 open)                               |
| Without help                     | plausible, unproven | one fixed Action control, picture chooser, one-tap Rest, one Pray path, spoken hints; no real child has played this round                  |

**Conditions, closed:**

1. AC-P17 → option (a), built: cast neighbours offer **Say hi** beside **Talk** (one-tap hello, wave, salaam only between Muslims); `requirements.md` ticked, `docs/DECISIONS.md` row "not waived".
2. Full run → see `qa-report.md` "Test results" (final code).

**Also closed:** AC-P28 (Singapore estate) and AC-P29 (clean figures) added; the lorry and bus named in AC-P13 / P14.

## 5B - Persona panel

**Waived by the owner** on 2026-11-28. Not run; no persona scores are claimed. The PM's persona note stands as advice for any later play-test: judge from the `actions-after-*` shots (some earlier shots show the old hovering button).

## Nice-to-have feedback → `docs/IDEAS.md`

Real-iPad Safari session; M-series iPad auto-picks Medium; slice the Haramain warm-up; announce action changes to assistive tech; a women's wudu room and a self-playing wudu; a calmer Missions badge; a first-ride reward for camel and horse; audit rider poses for clipping; browser tests for the balloon and wedding events and NPC re-routing; a real-child play-test ("find the camels", "Pray", hands-off on an iPad).

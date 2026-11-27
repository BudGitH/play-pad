# Product Validation: Kampung Quest realism round

> **Phase 5 output.** Produced after `qa-report.md` is PASS. Roles are taken from `docs/PRODUCT-PANEL.md`. **Honest caveats:** (1) the integrating session had no sub-agent tool, so the Senior PM and the three personas were played one after another by the same reviewer from the requirements, the code and screenshots, not as independent agents; (2) personas are a structured heuristic, not real users (see `docs/PRODUCT-PANEL.md`). Real child and parent feedback outranks this page.

**Feature:** Kampung Quest realism (guide, tailor, vehicles, crowd, outskirts and camels)
**Ticket:** PLAY-013
**Run at:** 2026-11-27 (round 1)
**Overall product gate:** [x] PASS

---

## The gate (how this PASSES)

Baseline met and value met for every target persona, PM = PASS, zero open baseline / value-blocking criticals. Satisfaction is scored, never gated. Round table capped at 3 rounds.

---

## 5A - Senior PM review (business requirements)

| Round | Verdict | Blocking issues | Notes                                                                                           |
| ----- | ------- | --------------- | ----------------------------------------------------------------------------------------------- |
| 1     | PASS    | 0               | All 16 ACs have a passing test; budgets hold; scope respected (no half-built out-of-scope work) |

**Issues (latest round):**

- **[MEDIUM]** The start-of-game toast can overlap a sheet title on a phone for a few seconds -> not a business-requirement miss (no AC covers it) -> parked in `docs/IDEAS.md`.
- **[MEDIUM]** Review was one reviewer, not independent agents -> process gap, listed in `qa-report.md` open items.

**Evidence anchor:** `requirements.md`: "a child (or parent) can complete a tawaf and a sa'i without help, the world looks and feels lived in, and the player can personalise the hero, without losing the phone budget or the religious-accuracy and child-safety rules." Each clause is met: the guide, hint and calm pace; the 2x crowd, outskirts and camels; the tailor; draw calls 100-235 against a 400 budget; modest outfits, no fail state, vehicles never hurt.

**One-line summary:** the five owner requests are delivered, they fit together, and they stay inside the phone budget and the child-safety and religious-accuracy rules.

---

## 5B - Persona panel (usability & value)

**Evaluation mode:** [x] artifacts (requirements + code + tests) and [x] live (screenshots captured from the running game on desktop 1180x820 and phone portrait 390x844, low tier, software GL). Not run on a real device.

| Persona                   | Baseline | Value | Satisfaction | Critical? | Key feedback                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------- | -------- | ----- | ------------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Priya & kid, "Sofa Co-op" | met      | met   | 4 / 5        | no        | The kid can finish 7 rounds by hand or tap "Walk for me" (about 30 s a round, calm). The card says "Keep the Kaaba on your left and follow the dots" in plain words and never scolds. Thobe / kurta / sports kit, a bike and a car in the same look are the "again!" moments. Camels are a delight. In the thick tawaf crowd the dots are partly hidden by pilgrims, but the hint line and Walk for me still carry the child. |
| Maya, "Commuter Casual"   | met      | met   | 4 / 5        | no        | One-handed on a phone: the wardrobe is a bottom sheet with 48 px tiles and Save / Cancel in view; the tawaf card keeps the big "+1 round" thumb target. Start-to-fun is unchanged (no new loading wall; the low tier stays well under the draw-call budget). Wanted: the welcome toast out of the sheet's way (parked).                                                                                                       |
| Sam, "Keyboard / AT user" | met      | met   | 3 / 5        | no        | The wardrobe is keyboard-complete (focus stays in the sheet, Escape cancels and undoes the try-on, `aria-pressed` and a name on every colour swatch, a status line "Wearing: ..."); Drive / Ride / Exit / Outfits are reachable with E. The dotted ground guide is visual-only, but the same guidance is also text in the card, which a screen reader reads. Nothing is mouse-only.                                           |

**Non-blocking feedback -> `docs/IDEAS.md`** (entry "Kampung Quest realism follow-ups"): far-people LOD so the draw cap can rise; more outfits, accessories and favourite colours; a try-on mirror camera; working car doors and visible wheel turn; feeding or riding camels; a Hajj dotted guide; hide the toast stack while a sheet is open.

---

## 5C - Round-table sessions

No baseline or value blocker was raised, so no round table was needed.

---

## Human summary

The five changes meet the business goal: a child can now follow the tawaf and sa'i with dots and plain hints at a calm pace, choose and keep an outfit in all three places, drive or ride any vehicle in both regions, and walk through a livelier world with a real-looking Makkah edge and camels. The target personas can all do what they came to do and find it worth it; the phone budget holds. Nothing blocks; the small follow-ups (toast over a sheet, far-people LOD, more outfits) are logged for later, and a real-device and real-child check is still the best next step.

---

### Loop control

PASS on round 1. Capture (Phase 6) done: brain docs, learnings, decisions, ideas and the ledger updated.

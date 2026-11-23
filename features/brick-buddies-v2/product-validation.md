# Product Validation: Brick Buddies v2

> **Phase 5 output.** Honest scope note: this run had no sub-agent spawner, so the PM and persona passes below were done by the implementing agent reasoning from `requirements.md`, the code and the screenshots in `screenshots/`. They are **not independent reviews**. The owner's own five minutes on the phone (AC-23.13) is the real validation and is still open. Re-run the panel (PM + the three personas) with spawned agents before merging if the process requires independence.

**Feature:** Brick Buddies v2
**Ticket:** PLAY-009 (follow-up)
**Run at:** 2026-11-23 (round 1, self-run)
**Overall product gate:** PASS on the self-run; **owner device check pending (manual)**

## 5A - Senior PM review (business requirements)

| Round | Verdict | Blocking issues | Notes                                                                                        |
| ----- | ------- | --------------- | -------------------------------------------------------------------------------------------- |
| 1     | PASS    | 0               | Chrome at 915x412 is a stick, one chip, a coach pill, a 3-button bar (was ~half the screen). |

- Metric 1 (chrome <= ~30 %): measured in `tests/brick-buddies-v2.spec.mjs` (AC-23.4): under 30 % of the screen by summed box area in the default state.
- Metric 2 (no accidental build): a pinch whose first finger lifts last builds nothing (AC-23.5, mutation-checked by removing the guard: the test fails).
- Metric 3 (rows name an action and a block): every checklist row and coach line rewritten; the red gap is drawn in the world.
- Metric 4 (mode choice): title radiogroup + menu radiogroup, saved.
- **Evidence anchor:** "a child on a phone in landscape can walk, look around, build on purpose and understand the current goal without an adult".

## 5B - Persona panel (self-run)

| Persona                  | Baseline | Value | Satisfaction | Notes                                                                                                                                                                |
| ------------------------ | -------- | ----- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Priya & kid (Sofa Co-op) | met      | met   | 4 / 5        | The stick is one thumb; the tick badge says "tap here again"; Open play removes pressure. Two taps is one more than before: the guided glow still places on one tap. |
| Maya (Commuter Casual)   | met      | met   | 4 / 5        | One hand: stick left, tray right. The tray is folded so the scene is visible; the held block + Build/Break are always there.                                         |
| Sam (Keyboard / AT user) | met      | met   | 3 / 5        | Keyboard play unchanged; wheel zoom, + / -, Esc closes the picker, radios are buttons (no arrow-key roving yet), swatches have names.                                |

Non-blocking feedback was added to `docs/IDEAS.md`: a one-time pinch hint, a floating stick option, gold glow for a missing door / bed / torch, undo, a paint bucket, more critters, and a real-handset check of the whole-world frame cost.

## 5C - Round table

None needed (no blocking critical). Open items for the owner: does a 40 px slot feel too small for a child? does the stick feel right (dead zone 30 %, jump at 42 % up)? does the rain now sit right?

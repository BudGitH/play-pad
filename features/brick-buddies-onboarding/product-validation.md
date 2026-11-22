# Product Validation: Brick Buddies onboarding

> **Phase 5 output.** Evaluation mode: **artifacts + live driver** (requirements, code, and screenshots / timings from a scripted real-input run of the running game in Chromium). **Not run with a real child**; the personas below are reasoned from the evidence, not observed. Single-reviewer run (no sub-agent tool this session).

**Feature:** Brick Buddies onboarding
**Ticket:** PLAY-009 (follow-up)
**Run at:** 2026-11-22 (round 1)
**Overall product gate:** ☑ PASS ☐ BLOCKED ☐ BLOCKED — ESCALATED _(PASS is provisional until a real child tries it; see AC-22.10)_

---

## 5A — Senior PM review (business requirements)

| Round | Verdict | Blocking issues | Notes                                                                                                                                                                            |
| ----- | ------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | PASS    | 0               | The brief's four asks are all met: a short visual how-to with a `?` re-open, an always-visible pointing prompt, a trivially easy first goal, hidden advanced chrome until needed |

**Measured (scripted player, real input, instant decisions; a child will be slower):** Start -> how-to closed 0.3 s -> bed picked 6.5 s (walk to the hut) -> bed placed ~8 s -> door placed ~13 s -> Pip walking in 13 s -> **buddy housed ~21 s**. Mechanics fit in the 30-second window; a real child's reading / deciding time is the unknown.

**Issues (latest round):**

- **[MEDIUM]** Requests 2+ ("Build a kitchen", walls and all) are still a cliff: the plain coach names the first missing thing but there is no blueprint for walls and roof. Does not break request 1's business requirement; parked as the top IDEA.
- **[LOW]** The walk to the hut is about 33 tiles (6-7 s) from the spawn; fine with the edge label + ringed pad, but a first-time player on a very wide screen sees nothing of the hut until they move.

**Evidence anchor:** `requirements.md` -> _"a first-time player has a buddy housed within ~30 s of pressing Start using only the on-screen pictures / prompts"_ - met mechanically (~21 s scripted).

---

## 5B — Persona panel (usability & value)

**Evaluation mode:** ☑ artifacts (requirements + code + screenshots) ☑ live (one driver ran the real input path in Chromium at 390x844 touch and 1280x800 mouse / keyboard) ☐ **Unverified - no live run**

| Persona                                         | Baseline | Value | Satisfaction | Critical? | Key feedback                                                                                                                                                                                                                                                                          |
| ----------------------------------------------- | -------- | ----- | ------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Priya & kid (7 y/o, shared phone, reads little) | met      | met   | 4            | n         | The four picture cards need no reading; the ringed slot + glowing spot + arrow answer "what next" every time; three taps to a first reward. Pull: the next rooms ask for much more (parked). Reading load per screen is now one short phrase.                                         |
| Maya (commuter, one thumb)                      | met      | met   | 4            | n         | One tap on Let's go!, then the left pad is ringed; everything stays in thumb reach; the how-to is skippable and the `?` is there if she forgets. The simple first run removes the coin / star / Items clutter she would have ignored.                                                 |
| Sam (keyboard / AT)                             | met      | met   | 3            | n         | Dialog has focus in, Esc, Tab trap, returns focus to the game; the coach is a polite live region and names the key (`Pick the bed (5)`, `Press F on the glow`). Wish: the keyboard aim cursor for the glow is still fiddly (I J K L); a "jump the cursor to the glow" key would help. |

**Non-blocking feedback -> `docs/IDEAS.md`:** guided blueprint for walls / roof in later rooms (a ghost outline to tap through, with drag-to-fill); a second and third pre-built shell for the kitchen and library; a "jump aim to the glow" key; read-aloud / voice prompts for pre-readers; a tiny celebration when the how-to finishes; Items reveal moment after the first move-in (pulse it once); test with a real 6-10 year old and tune the timings.

---

## 5C — Round-table sessions

None needed: no baseline or value blocker survived round 1.

---

## Human summary

The first run now teaches itself: a four-picture "How to play" (skippable, re-openable from a gold `?`), a hut that is already built so the first job is just a bed, a torch and a door, and a one-line prompt that rings the exact button and glows the exact spot. A scripted player gets from Start to a housed buddy in about 21 seconds; whether a real 6-year-old does it in 30 is the one thing this run cannot prove. The weak spot is what comes right after: the second request (a kitchen) is still a lot of block-by-block building with only a plain "what's missing" line, so the next best investment is a guided blueprint for later rooms.

---

### Loop control

PASS -> Phase 6 (CAPTURE) done: learnings, decisions, ideas and ledger updated.

---

## Post-launch UAT (after the feature is live)

**UAT run at:** not yet **Led by:** Senior PM

- **What to check with real children:** time from Start to first placed block; whether they find the `?`; whether they finish request 2 without help.
- **Outcome:** ☐ confirmed in the wild ☐ changes looped back through Phase 3

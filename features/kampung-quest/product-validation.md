# Product Validation: Kampung Quest

> **Phase 5 output.** Produced _after_ technical QA (`qa-report.md`) is PASS. This is the **product gate**: the feature is not "done" until this is PASS. Built from the Senior PM review (5A), the persona panel (5B), and any round-table sessions (5C). All roles are spawned from `docs/PRODUCT-PANEL.md` — no external skill or tool required.

**Feature:** Kampung Quest (`games/kampung-quest/`)
**Ticket:** PLAY-013
**Run at:** 2026-11-26 (5A round 1), 2026-11-27 (5A round 2, 5B)
**Overall product gate:** ☐ PASS ☐ BLOCKED ☐ BLOCKED — ESCALATED

---

## The gate (how this PASSES)

**Three-tier bar — two tiers gate, one is scored:**

- **Baseline met** — does what the business requirements say **and** each target persona completes their primary goal. **Hard gate.**
- **Value creation** — personas judge it worth using over the status quo. **Hard gate.**
- **High satisfaction** — scored, pursued via `docs/IDEAS.md` over time. **Never a release gate.**

**Blocks (→ round table):** PM verdict `NEEDS_REVISION`, OR any persona CRITICAL tied to a baseline/value miss.
**Logs, doesn't block:** satisfaction feedback + any "critical" not tied to baseline/value → `docs/IDEAS.md` (recurring → `docs/findings-ledger.md` under PRODUCT/UX).

**PASS when ALL hold:** (1) PM = `PASS`; (2) every target persona reports **baseline = met AND value = met**; (3) zero open baseline/value-blocking criticals. Satisfaction is recorded, never required maximal.

**Loop bound (no infinite loop):** the round table iterates **≤ 3 rounds** per feature. If a blocking item survives 3 rounds → stop, log it in `findings-ledger.md`, mark **BLOCKED — ESCALATED**, and surface it to the human.

---

## 5A — Senior PM review (business requirements)

| Round | Verdict        | Blocking issues | Notes                                                                                                                                               |
| ----- | -------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | NEEDS_REVISION | 1 HIGH          | Live run (1280x720 + iPhone 13 portrait): mission, azan, wudu, prayer, reload mid-prayer and no-WebGL all fine; nothing nudged a new player to eat. |

**Issues (round 1) and what was done:**

- **[HIGH]** No guided path to "eat a meal"; the HUD never signalled hunger → success metric ("eats ≥ 1 meal … without help") → **Fixed (18bef6a):** a one-time first-day nudge after the first mission (or 10:00) with a hawker beacon and minimap dot that clear on eating; soft amber low-meter ring with aria words and one toast per day.
- **[MEDIUM]** Subuh shown as "Prayed" at start without player action → rules 2 and 5 → **Owner decision:** keep it done, labelled "Prayed at home" (built in 18bef6a; `docs/DECISIONS.md`).
- **[MEDIUM]** Open owner decisions → rule 5 →
  - Coins for prayer: **owner decision**, sticker and praise only, no coins (`docs/DECISIONS.md`).
  - Religious read-through and the azan audition on a real phone: **still with the owner** (release conditions).
- **[MEDIUM]** Stale screenshots and an unfilled validation record → Phase 5 inputs → **Fixed:** 21 screenshots retaken (18bef6a), this record filled.
- **[MEDIUM]** Qada UI, the four service sheets and the blocked-storage notice are covered only by unit tests → AC-9 / AC-10 → handed to the persona panel to exercise live; browser probes stay in `docs/IDEAS.md`.

**Evidence anchor (round 1):** "within one 48-minute game day, a new player completes ≥ 1 mission, eats ≥ 1 meal and completes ≥ 1 full prayer flow without help" (`requirements.md`).

---

## 5B — Persona panel (usability & value)

**Evaluation mode:** ☐ artifacts (requirements + code + screenshots) ☐ live (one driver captured the running app)
☐ **Unverified — no live run** (no preview/browser available this session)

> Only the feature's **target personas** (from `requirements.md` → _Target personas_) are spawned — not the whole roster.

| Persona | Baseline    | Value                   | Satisfaction | Critical? | Key feedback |
| ------- | ----------- | ----------------------- | ------------ | --------- | ------------ |
| _name_  | _met / not_ | _met / partial / unmet_ | _1–5_        | _y/n_     | _..._        |

**Non-blocking feedback → `docs/IDEAS.md`:** _list the value/satisfaction improvements parked for later._

---

## 5C — Round-table sessions

> One block per **blocking** critical. Attendees: Senior PM + Senior UX Designer + the persona(s) who raised it.

### RT-1 — <the blocking item>

- **Raised by:** _persona(s)._
- **Problem:** _the baseline/value miss, concretely._
- **Plan:** _the agreed change._
- **Implemented:** _what was done (back through Phase 3)._
- **Re-validation:** _persona / PM verdict after the fix._
- **Status:** OPEN / RESOLVED / ESCALATED (after 3 rounds)

---

## Human summary

_2–3 plain sentences: does it meet the business goal, would the target users value it and keep using it, what (if anything) blocks, and what's next. Written so a non-engineer understands the state._

---

### Loop control

If the gate is BLOCKED → fix (Phase 3) and re-run the blocked stage, adding a new round above. On PASS → proceed to **Phase 6 (CAPTURE)**: log product/UX learnings, move non-blocking feedback to `docs/IDEAS.md`, update `docs/findings-ledger.md`.

---

## Post-launch UAT (after the feature is live)

> **PM-led.** Same gate and round-table mechanics, but against real usage. Trigger when the feature ships. Skip until then.

**UAT run at:** \_\_\_\_ **Led by:** Senior PM

- **What was checked with users / real usage:** _..._
- **Feedback gathered:** _..._
- **Round table (PM + UX + affected persona[s]):** _plan → implement (Phase 3) → re-validate; same ≤ 3-round loop._
- **Outcome:** ☐ confirmed in the wild ☐ changes looped back through Phase 3

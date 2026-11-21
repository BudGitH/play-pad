# Product Validation: <feature name>

> **Phase 5 output.** Produced *after* technical QA (`qa-report.md`) is PASS. This is the **product gate**: the feature is not "done" until this is PASS. Built from the Senior PM review (5A), the persona panel (5B), and any round-table sessions (5C). All roles are spawned from `docs/PRODUCT-PANEL.md` — no external skill or tool required.

**Feature:** <feature name>
**Ticket:** PLAY-___
**Run at:** 2026-11-21 (round 1)
**Overall product gate:** ☐ PASS  ☐ BLOCKED  ☐ BLOCKED — ESCALATED

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

| Round | Verdict | Blocking issues | Notes |
|---|---|---|---|
| 1 | _PASS / NEEDS_REVISION_ | _n_ | _..._ |

**Issues (latest round):**
- **[CRITICAL/HIGH/MEDIUM]** _what's wrong_ → violates _which business requirement_ → _recommended change_.

**Evidence anchor:** _one quote from `requirements.md` / `PROJECT.md` the verdict turns on._

---

## 5B — Persona panel (usability & value)

**Evaluation mode:** ☐ artifacts (requirements + code + screenshots)  ☐ live (one driver captured the running app)
☐ **Unverified — no live run** (no preview/browser available this session)

> Only the feature's **target personas** (from `requirements.md` → *Target personas*) are spawned — not the whole roster.

| Persona | Baseline | Value | Satisfaction | Critical? | Key feedback |
|---|---|---|---|---|---|
| _name_ | _met / not_ | _met / partial / unmet_ | _1–5_ | _y/n_ | _..._ |

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

**UAT run at:** ____   **Led by:** Senior PM
- **What was checked with users / real usage:** _..._
- **Feedback gathered:** _..._
- **Round table (PM + UX + affected persona[s]):** _plan → implement (Phase 3) → re-validate; same ≤ 3-round loop._
- **Outcome:** ☐ confirmed in the wild  ☐ changes looped back through Phase 3

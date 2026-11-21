# PlayPad — Development & QA Workflow (self-contained)

> This is the **standing process** for building anything in this project. It depends on **no external skill** — everything needed is described here. `CLAUDE.md` points every session at this file.
> The shape: **Requirements → [Design — for UI changes] → Tests → Implement → Multi-lens QA panel → Product & UX validation → Capture** — right-sized by project tier, looping on QA and on product validation until clean, with learnings and findings compounding across features.

---

## Why this exists

Quality should never be a per-session coin flip. This workflow makes quality **structural**:
- **Requirements + tests first** so "done" is defined before code is written.
- **An independent QA panel** that the implementer cannot wave through — it spawns *separate* agents who only know the criteria, not the excuses.
- **A learnings store + findings ledger** so every run starts smarter than the last and recurring defects escalate instead of recurring forever.

---

## The six phases

### Phase 1 — REQUIREMENTS
1. Copy `features/_TEMPLATE/` → `features/<feature-name>/`.
2. Fill `requirements.md`: what/why, user-visible behaviour, **testable acceptance criteria**, edge cases, out-of-scope, and the non-functional needs (accuracy / risk / compliance / quality).
3. Fill the **Business requirements & success metrics** and **Target personas & success bar** sections — these are what the Phase 5 PM + persona panel hold the build to. *Vague business requirements produce hand-wavy product validation*, exactly as vague acceptance criteria produce vague QA. Name only the **1–3 relevant personas** from `docs/PRODUCT-PANEL.md`.
4. If the choice of approach is non-obvious, log it in `docs/DECISIONS.md`.
5. **Tech Lead feasibility check** (every feature; scale per the Scaling matrix below). Spawn the Senior Tech Lead from `docs/PRODUCT-PANEL.md`; it writes `PROCEED / PROCEED_WITH_NOTES / FEASIBILITY_BLOCK` into `requirements.md` → *Tech Lead feasibility*. Advisory by default; it blocks only when the requirement is impossible/contradictory, certain to fail Phase-4 RISK, or conflicts with `ARCHITECTURE.md`. Prototype tier = a one-line note, never blocks.

**Exit:** the acceptance criteria **and** the business-requirement / persona bar capture "done", and the Tech Lead verdict is not `FEASIBILITY_BLOCK`.

### Phase 1b — DESIGN (conditional — UI changes only)
A conditional branch of requirements, **not** a separate phase. It decides *how* a UI change should look and work **before** tests are written. Skip entirely for non-UI work. Visual rules come from `docs/DESIGN-SYSTEM.md`.

**Routing (deterministic — record the result in `requirements.md` → Design routing):**

| UI surface? | Reuse-only (existing tokens/components)? | Tier | → Path |
|---|---|---|---|
| No | — | any | **none** (skip 1b) |
| Yes | Yes | any | **lite** |
| Yes | No | Prototype | **lite** (+ log design debt to `IDEAS.md`) |
| Yes | No | Standard / Production | **full** |

**Lite path:** the UX designer checks the change against `DESIGN-SYSTEM.md` (tokens / components / states / a11y) and you get a quick human OK. Record it in `requirements.md` → *Design review*. Done.

**Full path** (record in `features/<name>/design-review.md`):
1. **Diverge** — UX designer + the feature's target personas brainstorm 2–3 approaches (all conforming to `DESIGN-SYSTEM.md`).
2. **Brief** — the PM frames the business requirement + success metric the choice must serve.
3. **Design Roundtable** — Senior Tech Lead + PM + UX converge to 1–3 options with tradeoffs (desirability / viability / feasibility + effort). The Tech Lead **inherits** the Phase-1 feasibility verdict — it costs the *options*, it does not re-open the requirement.
4. **Persona review** — the target personas react to the converged options.
5. **Human decision (the real call):** *interactive* → present the options and let the human pick; *headless* → auto-select the **recommended** option and stamp it; *interactive but no response* → stop, set `Status: BLOCKED — AWAITING DESIGN DECISION` (never guess).

**Exit:** a chosen approach is recorded; Phase 2 tests must encode **that** option.

### Phase 2 — TESTS
1. Fill `test-plan.md`: map every acceptance criterion to at least one test; enumerate happy-path, edge, and error cases.
2. Write the **actual tests**. They should fail now (nothing implemented) and pass when done.

**Exit:** tests exist and express every acceptance criterion — and, if a **full** design path ran, encode the **chosen** option from `design-review.md`.

### Phase 3 — IMPLEMENT
1. Build until the tests pass.
2. Follow `docs/CODE_QUALITY.md` **as you write**, not after — four-tier comments, naming, error handling, type safety, the audit/debug patterns where they apply.
3. Read `docs/LEARNINGS.md` first so you don't repeat a known mistake.

**Exit:** all tests green and the standard followed.

### Phase 4 — QA (recursive multi-lens panel)
This is the core safeguard. **Spawn independent QA agents in parallel — one per dimension.** Do not self-certify.

For each lens, spawn an agent and give it: the feature's `requirements.md`, `test-plan.md`, the changed files, and the **slice of `docs/CODE_QUALITY.md`** relevant to that lens. Instruct each agent to *try to find problems* and return structured findings.

**Run the real tools — don't just read.** The ACCURACY/QUALITY lenses run the commands in `docs/CONVENTIONS.md` → *Dev commands* (tests, lint, type-check, build) and paste real output into the report. Three states, and **a missing tool never blocks**: command `TBD` → `NOT_CONFIGURED` → fall back to static review; command present but the tool errors at startup → `UNAVAILABLE` → static review + a MEDIUM finding; command runs → real findings under the matrix. *A feature is blocked only when a real check fails — never because a tool was absent or unconfigured.*

**Optional lenses (add when relevant; scale per the matrix):** **ACCESSIBILITY** when the feature has UI, **PERFORMANCE** when there's a stated perf budget in *Non-functional requirements*, **PRIVACY** when it touches personal data (often folds into COMPLIANCE).

| Lens | The agent's job | Pulls from CODE_QUALITY.md |
|---|---|---|
| **ACCURACY** | Verify correct output: run/trace the tests, check calculations, rounding, business rules, and every edge case in the test plan. | Testing; error handling; function design |
| **QUALITY** | Hold the code to the standard: naming, the four-tier comment system, complexity/nesting, type safety, test coverage, no dead code/`console.log`. | Naming; functions; commenting; types; structure; testing; logging |
| **COMPLIANCE** | Check audit trail on data/permission/critical mutations, PII handling, required docs/headers, business-rule traceability. | Audit & debug infra; four-tier comments; traceability |
| **RISK** (security) | Hunt vulnerabilities: injection, authn/authz, secrets in code, missing input validation at trust boundaries, insecure deserialization, missing rate limits. | Security gates; security comment tags; backend/ frontend security |

Each agent returns findings as: `{ severity, dimensions, where, what, recommendation }`.

**Merge + dedupe** all findings into `features/<feature-name>/qa-report.md` (the Post-Run Findings Report). For each finding, check `docs/findings-ledger.md` for recurrence and update it.

**Loop:** if any **CRITICAL** or **HIGH** finding is open → **FIX**, then **re-spawn the panel** (add a new round to the report). Repeat until the report is **clean**.

> *The panel is the pipeline.* With no CI, these agents perform the SAST/quality/compliance review and emit the artifact themselves.

**Exit:** `qa-report.md` shows `Overall result = PASS` with zero open CRITICAL/HIGH. → proceed to **Phase 5**.

### Phase 5 — PRODUCT & UX VALIDATION
Technical QA proves the code is *correct*; this phase proves the feature is *worth shipping*. Roles are spawned fresh from `docs/PRODUCT-PANEL.md` (the PM, the UX designer, and the feature's target personas) — no running agents, no external skill or tool required. Record everything in `features/<feature-name>/product-validation.md`.

**5A — Senior PM review (business requirements).** Spawn the PM from its charter; give it `requirements.md` (esp. *Business requirements & success metrics*), `docs/PROJECT.md`, the changed code/UI, and screenshots if available. It returns `PASS` / `NEEDS_REVISION` + issues + an evidence anchor. **`NEEDS_REVISION` blocks** → fix (back to Phase 3) → re-spawn the PM. Repeat until `PASS`. **5A must PASS before 5B runs.**

**5B — Persona panel (usability & value).** Spawn the feature's **1–3 target personas** in parallel (the 5+ roster is the menu — a feature loads only the personas it serves). Each role-plays the person trying the feature and scores the three-tier bar: **baseline** (completed my goal? — hard gate), **value** (worth it over what I do today? — hard gate), **satisfaction** (would I come back? — scored only). Each may flag **CRITICAL** feedback (blocking only when tied to a baseline/value miss) or **nice-to-have** feedback (→ `docs/IDEAS.md`).
- **How personas evaluate (no tool dependency):** the **default** is artifact-based — reason from `requirements.md`, the changed code/UI, and any screenshots. **If** a preview/browser is available this session, **one** driver runs the feature and captures screenshots, then hands them to the personas to judge (don't have five agents fight over one preview). If nothing is runnable, evaluate the *designed* experience and mark the verdict **"unverified — no live run."** Never block a feature solely because the app couldn't be driven.

**5C — Remediation Roundtable.** *(Post-build fix loop — distinct from the pre-build **Design Roundtable** in Phase 1b.)* For each **blocking** item (PM `NEEDS_REVISION`, or a persona CRITICAL tied to baseline/value), convene the **Senior PM + Senior UX Designer + the persona(s) who raised it**. They agree a concrete plan; implement it (back to Phase 3); then re-validate the affected stage. Non-blocking feedback is logged, not fixed now.

**The gate — two tiers gate, one is scored:**
- **Baseline met** (business requirement satisfied + each target persona completes their primary goal) — **hard gate**.
- **Value creation** (personas judge it worth using over the status quo) — **hard gate**.
- **High satisfaction** — **scored**, pursued via `docs/IDEAS.md` over time; **never a release gate**.

**Exit (PASS when ALL hold):** (1) PM = `PASS`; (2) every target persona reports **baseline = met AND value = met**; (3) zero open baseline/value-blocking criticals. Satisfaction is recorded, never required maximal.

**Loop bound (no infinite loop):** the round table iterates **at most 3 rounds** per feature. If a blocking item survives 3 rounds → **stop looping**, log it in `docs/findings-ledger.md` (normal recurrence escalation applies), mark the gate **BLOCKED — ESCALATED**, and surface it to the human for a decision.

> **Post-launch:** once a feature is live, run a PM-led **UAT** using the same panel and round-table loop (the *Post-launch UAT* section of `product-validation.md`) to confirm it landed with real usage.

### Phase 6 — CAPTURE (close the loop)

**Definition of Done — confirm before capturing:**
- [ ] Tests pass (ran the suite at least once, or static fallback noted).
- [ ] `qa-report.md` = PASS (zero open CRITICAL/HIGH).
- [ ] `product-validation.md` = PASS where the tier requires it (baseline + value met).
- [ ] Dev commands in `CONVENTIONS.md` backfilled if the toolchain firmed up.
- [ ] Docs (requirements / acceptance criteria) still match what shipped.

Before finishing:
- **`docs/LEARNINGS.md`** — append any non-obvious gotcha from this feature, **including product/UX lessons** (e.g. an assumption a persona disproved).
- **`docs/ARCHITECTURE.md`** — update the map if structure/data/flow changed (keep it an overview, < ~150 lines).
- **`docs/DECISIONS.md`** — log any non-obvious choice.
- **`docs/findings-ledger.md`** — finalise recurrence counts + escalation for this feature's findings (technical **and** PRODUCT/UX).
- **`docs/IDEAS.md`** — remove the shipped idea; **add the non-blocking value/satisfaction feedback** from the persona panel as future improvements.

**Exit:** the brain reflects reality; the next session starts smarter.

---

## Post-Run Findings Report — required shape

`qa-report.md` must contain: a **gate summary** (per-lens verdict + test pass count), the **findings** (each with severity, dimensions, location, recommendation, recurrence, status), the **blocker classification response** (below), and a plain-English **human summary**. The template in `features/_TEMPLATE/qa-report.md` is the canonical form. Treat the report as an artifact of record — keep it with the feature.

---

## Recursive Findings Tracker

Maintained in `docs/findings-ledger.md`. A finding's **stable ID** is `<rule-or-category> @ <file-or-pattern>` (never line number). Same id seen again ⇒ increment recurrence ⇒ escalate:

| Recurrence | Level | Action |
|---|---|---|
| 1st | `NEW` | Fix, or risk-accept with an inline comment + `PLAY` ref. |
| 2nd | `TICKET_REQUIRED` | Open a `PLAY` ticket with root-cause analysis + systemic fix plan; link it before the feature closes. |
| 3rd | `TECH_DEBT_PRIORITY` | Pull into the current cycle's tech-debt budget; scan the codebase for the same pattern. |
| 4th | `STOP_SHIP` | Release blocker until the systemic fix is merged and verified. |

When a recurring finding is finally fixed, add a `RECURRENCE(...)` comment at the fix site (root cause · systemic fix · codebase scan run).

---

## Blocker Classification Matrix (severity × dimension → response)

| Severity | ACCURACY | QUALITY | COMPLIANCE | RISK |
|---|---|---|---|---|
| **CRITICAL** | hotfix immediately | stop-ship | stop-ship | stop-ship |
| **HIGH** | blocks the feature | blocks the feature | blocks the feature | blocks the feature |
| **MEDIUM** | fix before next release | ticket, fix ≤ 2 cycles | ticket, fix ≤ 1 cycle | ticket, fix ≤ 1 cycle |
| **LOW** | backlog | tech-debt register | compliance register | risk register |

A single finding may score on multiple dimensions; apply the **strictest** matching response.

> **Product & UX findings** (dimensions `PRODUCT`, `UX`) are recorded in `docs/findings-ledger.md` for **recurrence escalation** too, but whether they *block* is decided by the **Phase 5 product gate** (baseline/value) — not by this matrix, which stays technical (ACCURACY / QUALITY / COMPLIANCE / RISK).

---

## Scaling matrix (by tier)

One knob right-sizes the whole loop. A feature reads its **`Feature tier`** from `requirements.md` (defaults to the project tier in `PROJECT.md`) and runs the column below. **Phases reference this matrix instead of restating rules.**

| Phase / check | Prototype | Standard | Production |
|---|---|---|---|
| **1 Tech Lead feasibility** | one-line advisory note | advisory; blocks on the 3 conditions | + effort estimate |
| **1b Design** | lite only (defer new patterns to `IDEAS.md`) | per the routing table | full for any new user-facing pattern |
| **2 Tests** | happy path + top edges | full edge/error matrix | + non-functional probes |
| **4 QA panel** | 1 combined agent (all lenses), still independent | 4 parallel lenses | multiple agents per lens, agreement required |
| **4 Optional lenses** | off | on when the concern applies | on |
| **5A PM gate** | self-confirm baseline | full PM review | full PM review |
| **5B Personas** | skip, or 1 combined "product-sense" check | the feature's 1–3 target personas | full target set; agreement on value |
| **5C Remediation** | baseline blockers only | baseline + value blockers | baseline + value, incl. value-tier misses |
| **6 Capture** | key lessons only | full brain update | + post-launch UAT |

**Two rules that keep it light:**
- **The 5-persona minimum is the roster, not a per-feature tax** — every feature names only the personas it serves.
- **Never let the implementing context be the sole judge of its own work** — QA and the panel stay independent of the implementer at every tier.

---

## Brain health check (run occasionally — every ~5 features)

A quick manual audit; if 2+ fail, fix them or re-run `/code-project-brain` to revamp:
- [ ] `ARCHITECTURE.md` reflects the current code.
- [ ] `LEARNINGS.md` has entries from recent features.
- [ ] `findings-ledger.md` logged the last feature's findings; recurrences escalated.
- [ ] `IDEAS.md` pruned of shipped items.
- [ ] No stale `TBD` in `CONVENTIONS.md` → *Dev commands* once the app runs.
- [ ] `CLAUDE.md` brain-version matches the latest you've migrated to.

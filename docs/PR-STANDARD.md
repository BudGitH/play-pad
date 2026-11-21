# PlayPad — Pull Request Standard

### PR Generation · Review Rubric · Comment Management · Merge

> **Tier-gated: this standard is active at Standard/Production tier when the project has a git repo.** Prototype tier: skip — the Phase-4 QA panel is the sole gate. Platform-agnostic (GitHub / GitLab / Bitbucket / Azure DevOps); adapt platform mechanics (approvals, CODEOWNERS equivalents) locally.
>
> **Severity is unified with the project brain:** the canonical taxonomy is the Blocker Classification Matrix in `docs/WORKFLOW.md` (CRITICAL/HIGH/MEDIUM/LOW × dimension), because it owns the recurrence machinery in `docs/findings-ledger.md`. The S1–S4 labels below are a **merge-gate projection** of it — see §2.3. Never classify a finding twice in two vocabularies.

**Grounding sources:** Google Engineering Practices code-review guide · Conventional Commits v1.0.0 · Conventional Comments · SmartBear/Cisco review study (~400 LOC) · Trunk-Based Development.

---

## Part 0 — Which lane does this change take?

| Lane          | Applies to                                                                                                        | Process                                                                                                        |
| ------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Trivial**   | Docs typos, comment fixes, dependency-bot bumps with green CI, config value already agreed in `docs/DECISIONS.md` | Short description (one line + ticket), CI green, 1 reviewer _or_ self-merge per repo policy. No full template. |
| **Standard**  | Everything else                                                                                                   | Full standard below.                                                                                           |
| **Emergency** | Production is broken and the fix can't wait for the normal path                                                   | §5 break-glass lane.                                                                                           |

_Why lanes exist:_ without a cheap lane for trivial changes, people route around the entire standard — and the habit generalises to changes that matter.

## Part 1 — PR Generation Standard

### 1.1 Size and scope rules

| Rule                    | Standard                                                                                                                                                                               | Rationale                                                                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Max diff size           | ≤ 400 **reviewable** LOC (target ≤ 200)                                                                                                                                                | Review quality degrades sharply past ~400 LOC (SmartBear/Cisco — a single 2006 dataset: treat as a **heuristic, not a law**) |
| Reviewable LOC excludes | Lockfiles, generated clients/types, snapshot tests, framework-generated migrations — mark them `linguist-generated` in `.gitattributes` and list the exclusions here as the repo grows | An honest 80-line change plus a lockfile is not a violation; pretending it is kills the cap's credibility                    |
| One concern per PR      | One feature, one fix, or one refactor — never mixed                                                                                                                                    | Reviewers can't cleanly approve half a PR                                                                                    |
| Refactors separate      | Mechanical refactors (renames, moves, formatting) get their own PR                                                                                                                     | A 50-line logic change buried in a 900-line rename is unreviewable                                                           |
| Branch lifetime         | ≤ 2–3 days from branch to merge                                                                                                                                                        | Long-lived branches rot and conflict                                                                                         |
| Oversized work          | Split it. Stacked PRs are an **advanced practice** — if this team adopts them, document base-branch management and merge order in `docs/CONVENTIONS.md` **first**                      | Adopting stacking without mechanics fails on first contact                                                                   |

### 1.2 PR title — Conventional Commits

```
<type>(<scope>): <imperative summary, ≤ 72 chars>
```

Types: `feat fix refactor perf test docs chore build ci revert`. Breaking change: `!` after type/scope.
Bad: `fixed stuff`, `PLAY-1234`, `updates`. Good: `fix(billing): prevent duplicate record creation on retry`.

### 1.3 PR description template

The canonical fillable copy lives at `.github/PULL_REQUEST_TEMPLATE.md` (or your platform's equivalent — recreate it from this section):

```markdown
## What

One or two sentences, plain language.

## Why

Ticket: PLAY-\_\_\_\_ · business or technical motivation.

## Authored by

- [ ] Human - [ ] Agent - [ ] Pair (human-directed agent)
<!-- Reviewers calibrate differently and deserve to know. See §2.5. -->

## How

Key implementation decisions — anything a reviewer would otherwise reverse-engineer.

## Type of change

- [ ] Bug fix (non-breaking) - [ ] Feature (non-breaking)
- [ ] Breaking change (migration notes below) - [ ] Refactor / no behavior change

## How was this tested?

- [ ] Unit tests added/updated (key cases) - [ ] Integration/E2E
- [ ] Manual verification (exact steps + environment)
- [ ] QA panel report attached: `features/<name>/qa-report.md` (agent-built features)

## Screenshots / recordings

Required for any UI change: before AND after.

## Breaking changes & migration

What breaks, who's affected, migration path. "None" if N/A.

## Rollback plan

How to revert safely. (Revert commit? Flag off? Data reversal needed?)

<!-- "Revert the commit" is only a valid answer if there's no migration. -->

## Reviewer notes

Where to start reading. Known trade-offs. What you want challenged.

## Author checklist

- [ ] Self-reviewed the full diff line by line (for agent-authored code: the HUMAN does this — §2.5)
- [ ] No commented-out code, debug prints, or secrets
- [ ] Tests pass locally and in CI
- [ ] Docs / config / env-var changes documented; `docs/API-CONTRACT.md` updated if the FE/BE seam changed
- [ ] Feature-flagged if risky or incomplete
```

### 1.4 Author pre-review protocol

1. **Self-review first** — read your own diff in the PR view, not the editor; fix everything you'd flag as a reviewer. Self-review measurably reduces review comments.
2. **CI green before requesting review.** Never ask a human to review what a machine already rejected.
3. **Annotate the diff** where a decision needs context.
4. **Draft/WIP until ready.**
5. **1–2 reviewers; one owns the affected area** (CODEOWNERS or equivalent). More reviewers = diffused responsibility. **Solo team? → §6.**

## Part 2 — Review Rubric

### 2.1 Governing principle (Google)

> Approve when the PR **definitely improves overall code health**, even if imperfect. Block on defects, design problems, and standard violations — never on personal preference.

### 2.2 Dimensions — no failing (✗) dimension may be approved

| #   | Dimension                                                                                  | Check                                                                                                                                                                                                       | Fail (✗) examples                                                                   |
| --- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1   | **Correctness**                                                                            | Trace logic **against the ticket's acceptance criteria** — not read for smell. Edge cases: null/empty, boundaries, concurrency, retries, idempotency, timezone/rounding                                     | Reproducible wrong behavior; unhandled happy-path edge; race                        |
| 2   | **Design**                                                                                 | Right abstraction, no needless coupling, consistent with `docs/ARCHITECTURE.md`, YAGNI                                                                                                                      | Duplicate pattern; speculative abstraction; god-class growth                        |
| 3   | **Tests**                                                                                  | Exist, would fail without the change, cover the risk, assert outcomes                                                                                                                                       | No tests for new logic; tests that pass with the bug re-added; mock-only assertions |
| 4   | **Security**                                                                               | Input validation, authz, injection, secrets, PII, **dependency risk — no new dep with a known HIGH/CRITICAL CVE without documented risk acceptance + remediation date** (mirrors `CODE_QUALITY.md` rule 24) | Unvalidated input to a sink; missing authz on new endpoint; credentials in diff     |
| 5   | **Performance**                                                                            | N+1, unbounded loops/payloads, missing pagination, hot-path allocation                                                                                                                                      | Query-per-row in a list endpoint; unbounded dataset in memory                       |
| 6   | **Readability**                                                                            | Understandable in 6 months; comments explain _why_                                                                                                                                                          | Misleading names; 200-line functions; unexplained magic numbers                     |
| 7   | **Observability & ops**                                                                    | New failure modes diagnosable; flags for risky paths; rollback plan is real                                                                                                                                 | Silent catches; no fallback                                                         |
| 8   | **Docs & contract**                                                                        | API/config docs, changelog, breaking-change notes; `docs/API-CONTRACT.md` in the same PR for seam changes                                                                                                   | Breaking change without migration notes; stale contract                             |
| 9   | **Migration safety** _(only when the PR contains a schema/data migration — otherwise N/A)_ | Expand/contract ordering (can OLD code run against the NEW schema during rollout?); lock duration on large tables; resumable backfill; down-migration **actually tested**, not just written                 | Irreversible migration; rollout-window breakage; untested down path                 |

### 2.3 Severity — merge-gate projection of the canonical matrix

| Label                 | Canonical (WORKFLOW matrix) | Meaning                                                                      | Blocks merge?                         |
| --------------------- | --------------------------- | ---------------------------------------------------------------------------- | ------------------------------------- |
| S1 `blocking`         | CRITICAL / HIGH             | Defect, security hole, data-loss risk, broken contract                       | **Yes**                               |
| S2 `blocking-discuss` | HIGH (design)               | Serious design concern; outcome may be "no change" after recorded discussion | **Yes** (fix or documented agreement) |
| S3 `non-blocking`     | MEDIUM                      | Worth doing, not worth holding the PR; may become a follow-up ticket         | No                                    |
| S4 `nit`              | LOW                         | Style/preference; author's call                                              | No                                    |
| `question`            | —                           | Converts to S1–S4 or resolves                                                | Until answered                        |
| `praise`              | —                           | Call out good work; 100%-negative reviews degrade review culture             | No                                    |

**Ledger rule:** every S1/S2 finding is **also recorded in `docs/findings-ledger.md`** under its canonical stable ID, so PR findings and QA-panel findings escalate through ONE recurrence system, not two.
**Approve with comments:** only S3/S4 open → author addresses or acknowledges, merges without re-review.

### 2.4 Reviewer protocol

1. **Shape pass (5 min):** description + full-diff skim. Wrong approach? Say so now — don't line-comment a doomed PR.
2. **Depth pass:** from the entry point (or Reviewer notes). Verify against the **ticket's** acceptance criteria.
3. **Run it when risk warrants** — "LGTM by reading" is insufficient for auth, payments/financial, or migration code.
4. **SLA:** first response within 1 business day; can't do it properly → decline and reassign.
5. **Verdict — exactly one:** **Approve** / **Approve with comments** (only S3/S4 open) / **Request changes** (any S1/S2). Never comment-only as a final state.

### 2.5 Agent-authored PRs (read this — it is this project's default case)

- **The prompting human does the §1.4 self-review.** An agent re-reviewing its own output re-applies the same priors that produced the code; the 30–50%-style reduction does not transfer.
- **Attach `features/<name>/qa-report.md`.** The reviewer MAY skip rubric dimensions the QA panel covered **with pasted tool evidence** (real lint/test output), and MUST NOT skip Correctness — trace it against acceptance criteria. Plausible-looking-but-subtly-wrong is the characteristic agent failure mode, and it is exactly what passes a skim.
- **Disclosure is mandatory** (the "Authored by" field). Undisclosed agent authorship invalidates the reviewer's calibration.

## Part 3 — Comment Management

### 3.1 Format — Conventional Comments

```
<label> [(decorations)]: <subject>

[discussion — reasoning, evidence, suggested alternative]
```

Labels: `issue suggestion question thought nitpick todo praise note chore`. Decorations: `(blocking)`, `(non-blocking)`, `(if-minor)` — plus **local extensions** `(security)`, `(test)` (not part of the upstream Conventional Comments set; ours).

Example:

```
issue (blocking, security): user_id comes from the request body, not the session.
An authenticated user can pass any user_id and read another user's records.
Take the id from the auth context instead.
```

### 3.2 Reviewer side

- Critique the code, never the author. Explain **why**, anchored to evidence (spec, `PLAY` ticket, failing input).
- Every `issue` points at a viable alternative, or says "no better idea — flagging the risk."
- Batch comments into one review pass. Praise deliberately.
- **Three-round rule:** 3 exchanges without convergence → synchronous call / team channel → post the outcome in the thread for the record.

### 3.3 Author side

- **Respond to every comment** before re-requesting: fix / rationale / follow-up ticket link. Silence is never acceptable.
- Push fixes as new commits during review (no force-push over reviewed commits); squash on merge.
- Deadlock after three rounds → tech lead / area owner decides → decision recorded in the thread. **Never merge around an unresolved `blocking` comment.**

### 3.4 Thread resolution

| Rule         | Detail                                                                                                                                                                                                                |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Who resolves | Reviewer resolves blocking threads; author may resolve nits/praise/acknowledged non-blocking                                                                                                                          |
| When         | After the fix is pushed and verified, or agreement recorded in-thread                                                                                                                                                 |
| Merge gate   | All blocking threads resolved + required approvals + CI green. Repo setting: **dismiss stale approvals on new commits** — without it, §3.5 is voluntary (approve → push anything → merge)                             |
| Audit trail  | Decisions live in the thread, never in DMs; calls get summarized back into the thread                                                                                                                                 |
| Stale PRs    | No activity for **2 business days** → author pings once → **day 5** → close or convert to draft _(deliberately tighter than the 2–3-day branch-lifetime target — the stale clock must not outlive the branch budget)_ |

### 3.5 Re-review

1. Author pushes fixes, replies to each thread, **explicitly re-requests**.
2. Reviewer reviews **only the incremental diff** + their own threads — no re-litigating approved code unless the fix touched it.
3. New blocking issues in previously-reviewed code only if the new commits introduced or revealed them.

## Part 4 — Merge & Post-Merge

| Item                 | Standard                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Strategy             | Squash-merge to main (one PR = one commit); merge-commit only for release branches. Pick one per repo, enforce it   |
| Final commit message | PR title (Conventional Commits) + PR number                                                                         |
| Who merges           | The author, after all gates — they own the rollout window                                                           |
| Timing               | Not before going offline / end of week, unless flagged off                                                          |
| Post-merge           | Author watches deploy/dashboards for the change's failure modes; broken main → revert is the default, within 30 min |

## Part 5 — Emergency / break-glass lane

_The reason this section exists: every undocumented bypass becomes the informal norm. A sanctioned lane keeps the log._

| Question                   | Answer                                                                                                                                                                                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| When                       | Production is broken (or a security hole is live) and the standard path is slower than the damage                                                                                                                                                                         |
| Who approves               | The on-call engineer + any one other engineer if reachable; solo team → the human owner, alone, with the retro-review below                                                                                                                                               |
| **Never waived**           | Secret scan on the diff · CI (may run _in parallel_ with deploy, never skipped) · the ledger entry                                                                                                                                                                        |
| Waivable                   | Review SLA · CODEOWNERS routing · size cap · full template (use: what broke, what this does, rollback)                                                                                                                                                                    |
| Afterwards — **mandatory** | Retro-review of the full diff within **24h** by a reviewer who wasn't involved, run as a normal §2 review; findings filed; a `PLAY` ticket links the incident, the PR, and the retro-review. No retro-review ⇒ treat as an open HIGH finding in `docs/findings-ledger.md` |

## Part 6 — Solo-developer path

Two-reviewer rules are unsatisfiable for a team of one. The substitute, in order of preference:

1. **Agent review as a documented stopgap** — spawn an independent reviewer agent with this rubric + the diff + acceptance criteria (it must not be the implementing context). Label the approval `agent-reviewed (stopgap)`.
2. **Self-merge after gates** — QA panel PASS + author checklist + CI green; record `solo-path` in the PR.
3. **Async post-merge review** — when a second human exists later, they review merged PRs in batch; findings go through the ledger like any other.
   The emergency lane's retro-review still applies. Solo does not mean unreviewed — it means review is asynchronous or non-human, and always labelled.

## Part 7 — Metrics (reviewed at the brain health check, every ~5 features)

A standard with no measurement degrades silently — the same failure mode as an unenforced lint rule. Track four numbers, trend not target:

1. **Review turnaround** (request → first response) 2. **PR size distribution** (% over the reviewable-LOC cap) 3. **Revert rate** 4. **Re-review rounds per PR** (rising = comments aren't landing, or PRs are too big)

## Quick reference

**Lane first** (trivial / standard / emergency) → **Author:** small PR → conventional title → full template (+ authored-by, + qa-report if agent-built) → human self-review → CI green → 1–2 reviewers. **Reviewer:** shape pass → depth pass vs 9 dimensions → every comment labelled → verdict ≤ 1 business day. **Comments:** blocking always explicit; 3-round rule then escalate; S1/S2 → findings-ledger. **Merge:** blocking resolved + approvals + CI → squash → author monitors.

---

_Active at Standard/Production tier. Last reviewed: 2026-11-21 by @BudGitH. Team decisions that amend this standard: record in `docs/DECISIONS.md` and edit here._

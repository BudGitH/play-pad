# PlayPad — Code Quality, Audit & Security Standard

**Purpose:** The coding standard for this project — frontend or backend, any language, any framework. The goal is code that a junior engineer can read, a senior engineer respects, and anyone can debug at 2 AM during an incident.

**Core philosophy:** Code is read 10× more than it is written. Optimise for the reader. Every decision — naming, structure, comments, error handling — should reduce the time it takes someone unfamiliar with the code to understand it, modify it, and verify it works.

> **Ticket references** in this document use the prefix `PLAY-###`. Replace with the real ticket whenever you cite one. Tags without a ticket reference are treated as incomplete.

**How this standard is enforced here:** the QA panel in `docs/WORKFLOW.md` checks code against the sections below (QUALITY + COMPLIANCE + RISK lenses). Recurring violations escalate via `docs/findings-ledger.md`. The **Non-Negotiable Rules** (Section 18) block a feature from closing.

---

## 0. How this standard is enforced (read this first)

Rules split into two kinds, and each is policed differently:

- **Mechanically checkable** (~11 of the §18 non-negotiables: no `any`, no `console.log`, no empty catch, function length, nesting, no commented-out code, secrets, coverage, dep CVEs, commit format, no committed `.env`) — these live in **`docs/ENFORCEMENT.md`** and are wired to configs/hooks/CI at Standard+ tier. **In plain terms:** a prose rule decays silently — it just stops being followed one busy session, and you find out during an incident; a lint rule fails in two seconds with a file and line, and the commit doesn't happen. So checkable rules go in config; this document _defines_ what those configs must check.
- **Judgement rules** (naming quality, whether an abstraction is justified, whether a comment explains _why_, design fit) — no tool can check these. They are what this document and the Phase-4 QUALITY lens spend human/agent attention on. QA does **not** re-review by eye what a tool already enforced.

If this document and a generated config ever disagree, this document wins — fix the config and note it in `docs/DECISIONS.md`.

## Why this standard is shaped this way (consensus)

Four senior perspectives shaped it:

1. **Commenting is mandatory and structured**, not discretionary — a four-tier system (file / function / block / inline).
2. **Debug infrastructure is built into the code**, not bolted on — a reusable trace utility any module can opt into.
3. **Audit trails are a first-class pattern** for anything that mutates data, money, or permissions.
4. **Business context is documentation** — every business rule traces to a source.
5. **Security/quality is verified automatically every run** — here, by the QA panel (the pipeline) producing an immutable findings report.
6. **Recurring findings escalate** — the same issue appearing repeatedly triggers root-cause analysis and rising severity.
7. **Every finding is classified** by impact dimension (accuracy, quality, compliance, risk) to drive the right response.

---

## 1. Naming: say exactly what you mean

- **Intention-revealing names.** The name answers: what does this hold, what does it do, why does it exist.
- **No abbreviations** unless universal (`id`, `url`, `http` fine; `usr_reg_dt`, `calc_amt`, `proc` not).
- **Booleans read as yes/no questions:** `is_active`, `has_permission`, `should_retry` — never `active_flag`.
- **Functions describe action + subject:** `calculate_total()`, `fetch_user_by_email()`, `validate_line_items()`.
- **Collections plural, items singular:** `users` (list), `user` (one element).
- **Constants UPPER_SNAKE_CASE and self-explanatory:** `MAX_RETRY_ATTEMPTS = 3`, not `MR = 3`.
- **Avoid generic names:** `data`, `info`, `temp`, `result`, `item`, `handler`, `manager` tell you nothing. Be specific.
- **Match the domain language** from `docs/PROJECT.md`. If the product calls it an "order", the code says `order`.

```python
# BAD
def proc(d):
    r = d * 0.07
    return r

# GOOD
def calculate_sales_tax(purchase_amount: float) -> float:
    """Calculate sales tax at the standard 7% rate."""
    SALES_TAX_RATE = 0.07
    return purchase_amount * SALES_TAX_RATE
```

---

## 2. Function & method design

- **Single Responsibility.** One function, one thing. If you need "and" to describe it, split it.
- **Short.** Aim ≤ 20 lines; > 40 lines almost always does too much.
- **≤ 3–4 parameters.** Beyond that, group into a typed object/struct.
- **Pure functions first.** Input → output, no hidden state. Trivially testable.
- **Separate side effects.** Isolate I/O (DB, API, FS) from business logic; keep the logic pure with a thin I/O wrapper.
- **Guard clauses.** Validate preconditions at the top and return/throw early — no deep nesting.
- **No flag parameters.** A boolean that switches behaviour means two functions.

```python
# GOOD — flat, single-responsibility, guard clauses
def calculate_order_total(items: list[OrderItem]) -> Decimal:
    """Sum the price of all in-stock items. Returns Decimal(0) if none qualify."""
    return sum(item.price * item.quantity for item in items if item.in_stock)


def place_order(order: Order) -> None:
    """Validate, price, persist, and confirm an order."""
    if not order or not order.items:
        raise ValueError("Order must contain at least one item.")
    order.total = calculate_order_total(order.items)
    if order.total <= 0:
        raise ValueError("Order total must be greater than zero.")
    save_to_db(order)
    send_order_confirmation(order)
```

---

## 3. Commenting: the four-tier mandatory standard

Comments are a first-class deliverable. Every tier has a required format. The QA QUALITY/COMPLIANCE lenses reject work that skips a tier.

**Guiding principle:** a stranger should open any file and, within 90 seconds, understand what it's for, what each function does and why, what business rules are encoded, and how to debug it.

### Tier 1 — File header block (every file)

```python
# ==============================================================================
# FILE: <filename>
# PURPOSE: <what this file does, in 1–3 lines>
#
# OWNER: <team or person> (<contact>)
# LAST REVIEWED: 2026-11-21 by <handle>
#
# BUSINESS CONTEXT:
#   <which product decision / regulation / requirement drives this code>
#   <link to the source: ticket PLAY-###, doc, or spec>
#
# DEPENDENCIES:
#   - <internal modules this relies on>
#   - External: <APIs/services, with limits/quirks>
#
# HOW TO TEST:
#   Run: <command>
#   Integration: <command>
#
# KNOWN ISSUES:
#   - WORKAROUND(PLAY-###): <what and why>
#
# CHANGELOG (last 3 significant changes):
#   2026-11-21 - <change> (PLAY-###)
# ==============================================================================
```

```typescript
// =============================================================================
// FILE: <Filename>.ts
// PURPOSE: <what this file does>
// OWNER: <team> (<contact>)
// LAST REVIEWED: 2026-11-21 by <handle>
// BUSINESS CONTEXT: <driver + link to PLAY-###>
// DEPENDENCIES: <internal> / External: <service + limits>
// HOW TO TEST: <command>
// KNOWN ISSUES: WORKAROUND(PLAY-###): <what>
// =============================================================================
```

### Tier 2 — Function/method doc block (every public function)

Required elements (public): **Summary**, **Args/Params** (name, type, meaning, constraints), **Returns** (incl. edge returns), **Throws/Raises** (error + trigger), **Business Rule** (if any, with source), **Debug Hint** (if a known trouble spot), **Example** (for complex functions). Private helpers need at least a one-line summary.

```python
def calculate_discount(
    subtotal: Decimal,
    customer_tier: CustomerTier,
    promo_code: str | None = None,
) -> DiscountResult:
    """
    Calculate the discount applied to an order subtotal.

    Applies the tier's standard discount, unless a valid promo code grants a
    larger one, in which case the promo takes precedence.

    Args:
        subtotal: Pre-discount order total. Must be > 0.
        customer_tier: STANDARD | SILVER | GOLD — drives the base rate.
        promo_code: Optional promo code. If valid, may override the tier rate.

    Returns:
        DiscountResult with: amount (Decimal), effective_rate (Decimal),
        source ("tier" | "promo"), and net (subtotal - amount).

    Raises:
        ValueError: if subtotal <= 0.
        PromoConfigurationError: if a promo code is provided but not configured —
            indicates a missing entry in the promo config; escalate to its owner.

    Business Rule:
        Tier rates and promo rules are defined in promo_config. Promo overrides
        tier when larger. Source: PLAY-### (promo engine).

    Debug Hint:
        Unexpected rate? Check (1) promo_config has the code, (2) the tier
        mapping, (3) that the caller passed the promo_code through.

    Example:
        >>> calculate_discount(Decimal("100.00"), CustomerTier.GOLD).amount
        Decimal("15.00")  # 15% gold-tier discount
    """
```

### Tier 3 — Block-level comments (every logical block)

A logical block = a loop, a conditional branch, a transformation, a validation step, an external call, or any 3+ lines forming one operation. Comment: **what** (1 line), **why** if non-obvious (1–2 lines), **what to check if it fails** (1 line, for complex blocks). Use the standard tags below.

```python
def process_batch(batch: Batch) -> BatchResult:
    """Process all items in a batch; one item's failure doesn't block the rest."""

    # ── STEP 1: Validate the batch is in a processable state ──
    # Only DRAFT or RETRY_PENDING can run. Other states mean it's already
    # submitted or locked. If this fails: check for a concurrent worker.
    if batch.status not in (Status.DRAFT, Status.RETRY_PENDING):
        raise InvalidStateError(f"Batch {batch.id}: unexpected state {batch.status}")

    # ── STEP 2: Process each item independently ──
    # Failures are collected, not raised, so one bad item doesn't abort the batch.
    # DECISION(PLAY-###): partial failure → manual review, not auto-retry.
    results, errors = [], []
    for item in batch.items:
        try:
            results.append(process_item(item))
        except ProcessingError as err:
            errors.append({"item_id": item.id, "error": str(err)})
            logger.error({"event": "item_failed", "batch_id": batch.id, "item_id": item.id})

    # ── STEP 3: Determine outcome ──
    batch.status = Status.PARTIALLY_FAILED if errors else Status.DONE
    save(batch)
    return BatchResult(batch.id, batch.status, len(results), len(errors), errors)
```

### Tier 4 — Inline comments (non-obvious lines only)

Explain **why**, not what.

```python
retry_delay = min(base_delay * (2 ** attempt), 30)  # cap at 30s to spare the downstream service
offset = 1                                           # vendor API is 1-based, not 0-based
amount = amount.quantize(Decimal("0.01"), ROUND_HALF_EVEN)  # banker's rounding for reconciliation
```

Never write `x = x + 1  # increment x`.

### Standardised comment tags (every tag needs a ticket ref)

| Tag                     | Meaning                                   |
| ----------------------- | ----------------------------------------- |
| `TODO(PLAY-###)`        | Planned work, not started                 |
| `FIXME(PLAY-###)`       | Known bug / incorrect behaviour           |
| `HACK(PLAY-###)`        | Intentional shortcut to revisit           |
| `WORKAROUND(PLAY-###)`  | Compensating for an external bug/limit    |
| `KNOWN_ISSUE(PLAY-###)` | Documented, accepted-for-now defect       |
| `PERF(PLAY-###)`        | Performance concern / optimisation target |
| `SECURITY(PLAY-###)`    | Security-relevant note                    |
| `DECISION(PLAY-###)`    | Non-obvious product/architecture decision |

Audit: `grep -rn "TODO\|FIXME\|HACK\|WORKAROUND\|KNOWN_ISSUE" src/` — review periodically.

### Contract comments (module/service boundaries)

At the top of every module/service/route file, state in plain English: **Responsibilities**, **Preconditions** (caller must ensure), **Guarantees** (postconditions), and **Does NOT** (explicit exclusions).

```python
# ==============================================================================
# MODULE CONTRACT: OrderPricingService
# RESPONSIBILITIES:
#   - Compute the priced breakdown (subtotal, discount, tax, total) for one order.
# PRECONDITIONS (caller ensures):
#   - Order has at least one line item; each item has a valid price + quantity.
# GUARANTEES:
#   - Never mutates the order or any DB state. All money math uses Decimal/ROUND_HALF_EVEN.
#   - Missing required data → descriptive error, never a partial/silent result.
# DOES NOT:
#   - Persist anything (PersistenceService) or take payment (PaymentService).
# ==============================================================================
```

### Comment freshness rule

**Stale comments are bugs.** When you change code, update every comment in the block. A stale comment is a valid reason to block in QA. Update Tier-1 CHANGELOG and `LAST REVIEWED` on substantial edits.

---

## 4. Type safety

- **TypeScript over plain JS. Always.** Python: type hints on every signature; `mypy`/`pyright` strict.
- **Avoid `any` / untyped dicts** — they hide design problems.
- **Define types for every data shape that crosses a boundary** (API, params, props, DB row).
- **Enums / literal unions for known value sets** (`status: "draft" | "active" | "closed"`).

---

## 5. Error handling: fail loudly, fail early

- **Validate inputs at the boundary.** Reject invalid data the moment it enters; don't let it travel deeper.
- **Never swallow errors.** No empty `catch {}` / `except: pass`. To ignore, comment _why_.
- **Throw specific, descriptive errors.** Include what failed, expected, received, and how to fix.
- **Custom error classes** for domain failures (`InsufficientBalanceError` ≫ `Error("failed")`).
- **Distinguish expected failures from crashes.** Handle the expected gracefully; let true bugs crash with full context.
- **Context in messages.** Not "Failed to process order" but "Failed to process order ORD-007: line item 3 has negative quantity (-2), violates rule PLAY-###".

```typescript
// GOOD
throw new PaymentProcessingError({
  message: "Payment gateway returned a decline code",
  orderId: order.id,
  gatewayResponse: response.code,
  attemptNumber: retryCount,
  suggestion: "Verify funds or try another method.",
});
```

---

## 6. Audit & debug infrastructure

Two reusable patterns every module can opt into.

### 6A. Debug Trace utility

A per-operation, self-contained diagnostic (distinct from log-level DEBUG). Activated by an env var or per-request flag — **never on in production** unless behind an access-controlled flag.

```python
# DEBUG TRACE UTILITY — pluggable, near-zero overhead when disabled.
# Usage:
#   tracer = DebugTracer(enabled=settings.DEBUG_TRACE_ENABLED)
#   tracer.step("validate_input", payload=clean)
#   tracer.decision("rate_selection", chosen="promo", reason="promo > tier")
#   tracer.checkpoint("priced", total=str(total))
#   report = tracer.get_report()   # structured dict + human narrative

import time, uuid
from dataclasses import dataclass, field
from typing import Any

@dataclass
class TraceEntry:
    timestamp: float
    step_name: str
    entry_type: str          # step | decision | warn | error | checkpoint
    data: dict[str, Any]
    elapsed_ms: float

@dataclass
class DebugTracer:
    enabled: bool = False
    operation_name: str = ""
    trace_id: str = field(default_factory=lambda: str(uuid.uuid4())[:12])
    _entries: list[TraceEntry] = field(default_factory=list)
    _start: float = field(default_factory=time.time)

    def _add(self, name, etype, data):
        if not self.enabled:
            return
        self._entries.append(TraceEntry(time.time(), name, etype, data, self._ms()))

    def step(self, name, **d):       self._add(name, "step", d)
    def decision(self, name, chosen, reason, **d): self._add(name, "decision", {"chosen": chosen, "reason": reason, **d})
    def warn(self, name, **d):       self._add(name, "warn", d)
    def error(self, name, **d):      self._add(name, "error", d)
    def checkpoint(self, name, **d): self._add(name, "checkpoint", d)

    def get_report(self) -> dict:
        if not self.enabled:
            return {"enabled": False}
        lines = [f"=== DEBUG TRACE: {self.operation_name} ===",
                 f"Trace ID: {self.trace_id}", f"Duration: {self._ms():.1f}ms",
                 f"Steps: {len(self._entries)}", ""]
        glyph = {"step": "  STEP", "decision": "  DECIDE", "warn": "  ! WARN",
                 "error": "  x ERROR", "checkpoint": "  ok CHECK"}
        for e in self._entries:
            lines.append(f"{glyph.get(e.entry_type, '  ?')} [{e.elapsed_ms:.1f}ms] {e.step_name}")
            for k, v in e.data.items():
                lines.append(f"         {k}: {v}")
        return {
            "trace_id": self.trace_id, "operation": self.operation_name,
            "duration_ms": self._ms(), "entry_count": len(self._entries),
            "entries": [{"step": e.step_name, "type": e.entry_type,
                         "elapsed_ms": e.elapsed_ms, "data": e.data} for e in self._entries],
            "narrative": "\n".join(lines),
        }

    def _ms(self) -> float:
        return (time.time() - self._start) * 1000
```

The report is built to paste into a ticket, log as one structured entry, or return from a diagnostic endpoint. Pass an optional `tracer` into non-trivial functions; record `step` / `decision` / `checkpoint` / `error` at each meaningful point; attach `trace_id` to results and errors for traceability.

### 6B. Audit trail pattern

Any operation that **mutates data, moves money, or changes permissions** writes a structured, **append-only** audit record (stored separately from app data, with its own retention).

**Minimum audited:** account create/modify/delete; payments/refunds/adjustments; critical-state submissions/approvals/reversals; permission/role changes; data exports, bulk ops, config changes.

```python
@dataclass
class AuditRecord:
    # WHO
    actor_id: str; actor_type: str; actor_ip: str | None
    # WHAT
    action: str                # e.g. "order.submit", "user.update_role"
    resource_type: str; resource_id: str
    # WHEN
    timestamp: datetime; request_id: str   # correlation id
    # BEFORE / AFTER
    state_before: dict | None; state_after: dict | None; changes: dict | None
    # WHY
    reason: str; ticket_reference: str | None; business_rule: str | None
    # NARRATIVE (human-readable, for non-engineers)
    narrative: str
```

```python
def submit_order(order_id: str, actor: User) -> Order:
    order = get_order(order_id)
    before = order.to_audit_snapshot()
    order.status = Status.SUBMITTED
    order.submitted_at = utc_now()
    save_order(order)
    audit.record(AuditRecord(
        actor_id=actor.id, actor_type="user", actor_ip=request_ip(),
        action="order.submit", resource_type="Order", resource_id=order.id,
        timestamp=utc_now(), request_id=correlation_id(),
        state_before=before, state_after=order.to_audit_snapshot(),
        changes={"status": {"from": "DRAFT", "to": "SUBMITTED"}},
        reason="User submitted order for fulfilment",
        ticket_reference=None,
        business_rule="DRAFT orders may be submitted by their owner (PLAY-###).",
        narrative=(f"{actor.display_name} ({actor.email}) submitted order {order.id} "
                   f"with {order.item_count} items totalling {order.currency} {order.total:,.2f}."),
    ))
    return order
```

The trail answers, without reading code: _what happened to resource X?_ (by `resource_id`), _what did user Y do?_ (by `actor_id` + time), _who changed this and when?_ (by `action`), _everything in this request?_ (by `request_id`).

### 6C. Diagnostic endpoint (staging/dev)

Expose `GET /internal/diagnostics/{correlation_id}` returning the combined debug traces + audit records + log entries + a narrative summary for that operation. In production: behind authn/authz + rate-limiting, access logged, PII redacted.

---

## 7. Security review gates & post-run compliance

Here, **the QA panel is the pipeline** (`docs/WORKFLOW.md`). The checks below are what the RISK and COMPLIANCE lenses enforce, and what the Post-Run Findings Report records. If you _do_ have CI, wire these as automated gates too.

### 7A. Gate checklist (run by QA, or CI if present)

- **Secret scanning** — zero secrets (keys, tokens, passwords, private keys) in the diff.
- **SAST / static review** — zero HIGH/CRITICAL; MEDIUM needs a comment with fix plan + ticket.
- **Dependency audit** — no known ≥ HIGH vulns in direct deps.
- **Licence check** — no incompatible licences without approval.
- **Tests** — 100% pass; no skipped tests without a `FIXME` ticket.
- **Coverage** — changed files meet the project bar (see `docs/CONVENTIONS.md`); new files higher.
- **Comment coverage** — public functions have Tier-2 blocks; logical blocks have Tier-3.
- **Audit-trail check** — data-mutation paths emit an `AuditRecord`.
- **Config/IaC** — no placeholder/default secrets in real config; IaC scanned.

### 7B. Post-Run Findings Report (every QA run)

Mandatory, immutable, timestamped, retained with the feature. Canonical form: `features/<name>/qa-report.md`. Captures gate summary, each finding (with classification + recurrence), recursive-findings alert, and a human summary. A run without a report is a failed run.

### 7C. Recursive findings tracker

See `docs/findings-ledger.md`: stable finding IDs, recurrence counting, escalation **2× = ticket, 3× = tech-debt priority, 4× = STOP-SHIP**, and a `RECURRENCE(...)` comment at the fix site documenting root cause + systemic fix + the codebase scan you ran.

### 7D. Blocker classification matrix

Every finding is classified across four dimensions; a finding may score on several. Apply the strictest response.

- **ACCURACY** — wrong output: calc errors, bad transforms, truncation, rounding, off-by-one, wrong rule.
- **QUALITY** — code smells, missing tests/comments, complexity, perf regressions, unhandled edges.
- **COMPLIANCE** — missing audit trail, PII in logs, retention/consent gaps, missing required docs.
- **RISK** — injection, XSS/CSRF, auth bypass, insecure deserialization, secrets, missing validation/rate-limit, DoS.

| Severity | ACCURACY                | QUALITY            | COMPLIANCE          | RISK              |
| -------- | ----------------------- | ------------------ | ------------------- | ----------------- |
| CRITICAL | hotfix ≤ 4h             | stop-ship          | stop-ship           | stop-ship         |
| HIGH     | blocks feature          | blocks feature     | blocks feature      | blocks feature    |
| MEDIUM   | fix before next release | ticket, ≤ 2 cycles | ticket, ≤ 1 cycle   | ticket, ≤ 1 cycle |
| LOW      | backlog                 | tech-debt register | compliance register | risk register     |

When resolving, comment the classification + fix + verification:

```python
# FIX(PLAY-###): resolved FINDING-YYYYMMDD-002 — raw SQL concatenation.
#   Classification: QUALITY + RISK · Severity: MEDIUM
#   Fix: parameterised query. Verified: added injection test. Prevention: lint rule added.
```

### 7E. Security-specific comment tags (mandatory where they apply)

| Tag                       | Purpose                                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `SECURITY_GATE(PLAY-###)` | Marks a security-critical check (authn/authz/validation/rate-limit). Changes need security review.                              |
| `TRUST_BOUNDARY`          | Where data crosses a trust boundary (user→system, system→external, public→private). Everything crossing is validated/sanitised. |
| `DATA_FLOW(<class>)`      | Flow of sensitive data — class ∈ PII \| FINANCIAL \| CREDENTIAL \| INTERNAL.                                                    |
| `THREAT_REF(<id>)`        | Links code to a threat-model entry.                                                                                             |
| `CRYPTO_NOTE`             | Documents a crypto choice (algorithm, key length, rotation). Crypto without this is flagged.                                    |

The RISK lens verifies: authn/authz functions carry `SECURITY_GATE`; external-input handlers carry `TRUST_BOUNDARY`; PII/financial flows carry `DATA_FLOW`.

### 7F. Security review block (sensitive files)

Files handling auth, payments, PII, or external integrations add to their Tier-1 header: last/next security review dates, trust boundaries (with line refs), sensitive data flows, threat-model refs, security assumptions, and known security debt.

---

## 8. Code structure & organisation

- **Group by feature/domain, not by type.** `orders/` (routes, service, models, tests together) ≫ `controllers/` with 40 files.
- **One concept per file.** Split a growing `utils.ts` into `date-utils`, `currency-utils`, etc.
- **Barrel/index files re-export only** — no logic.
- **One-way dependency direction.** Business logic never imports UI/HTTP controllers.
- **Clear module boundaries; no circular deps** — extract the shared concern into a third module.

## 9. SOLID

SRP (one reason to change), OCP (open to extension, closed to modification), LSP (subtypes substitutable), ISP (many specific interfaces > one general), DIP (depend on abstractions, not concretions).

## 10. Simplicity & anti-complexity

- **KISS** — solve the problem in front of you; prefer boring, well-understood patterns. If a junior can't grok a function in 60s, refactor.
- **DRY with judgement** — extract when the same logic appears 3+ times _and_ must change together. Don't force unrelated look-alikes into one abstraction.
- **Minimise nesting** — max 2–3 levels; guard clauses; lookup maps / `switch` over long `if/else` chains.

## 11. Testing

- **Every public function has ≥ 1 test.** No exceptions.
- **Test behaviour, not implementation** — resilient to refactoring.
- **Name tests as sentences:** `test_calculate_total_excludes_out_of_stock_items()`.
- **One scenario per test.** Test boundaries (zero/one/many/max/null/empty/negative/special/timezone) and **error paths** explicitly.
- **Independent tests; mocks as a last resort** — prefer lightweight real implementations.
- **Placement:** unit tests beside the code; integration/e2e under a top-level `tests/`.

## 12. Logging & observability

- **Structured (JSON) logs**, never `console.log("...")`. Levels: DEBUG (local detail), INFO (business events), WARN (recoverable), ERROR (needs investigation).
- **Correlation IDs** on every request/job, in every line. **Log at boundaries**, not inside tight loops.
- **Never log secrets/PII** — redact in logger config. **Connect logs to traces** via the `trace_id` from the DebugTracer.

## 13. Frontend-specific

- **One component, one responsibility.** Props are the API — strict types, sensible defaults, documented. 15+ props ⇒ decompose.
- **Lift state to the lowest common ancestor; derived state is computed, never stored.** Colocate styles/tests/types.
- **Perf:** memoise the expensive bits (profile first); lazy-load heavy routes; size images correctly.
- **Accessibility:** semantic HTML; keyboard-accessible; `alt` text; colour is not the only signal.
- **Errors:** wrap routes/sections in error boundaries; user-friendly error states; log client errors to monitoring.
- **Comment every effect/lifecycle hook** (trigger, action, side effects) and state-placement decisions.

## 14. Backend-specific

- **Consistent URL patterns + response envelope** (`{ data, error, meta }`); **version your APIs**; **meaningful status codes** (never 200-with-error-body); **validate payloads at the boundary** (Zod/Pydantic/JSON Schema).
- **DB:** migrations only (versioned, reversible); clear snake_case names; index WHERE/JOIN/ORDER columns; transactions for multi-step writes; **parameterise all queries**.
- **Async/jobs:** **idempotent**; timeouts on every external call; dead-letter queues for failures.
- **Security baseline:** authenticate → authorise → process; secrets in a manager, never in code; sanitise output (XSS), parameterise (SQLi), sanitise log inputs; least privilege.
- **Comment** every middleware (intercepts/modifies/failure), every non-trivial query, and every scheduled job (schedule, idempotency, overlap behaviour).

## 15. Version control

- **One logical change per commit.** Message: `type(scope): description`. **Never commit secrets/.env** — enforce via `.gitignore` + hooks.
- **Short-lived branches; PRs need a reviewer; PR descriptions say what + why and link the ticket.**

## 16. Configuration & environment

- **No hardcoded environment-specific values** — env vars / config. Sensible defaults with clear overrides. Document every variable in `.env.example` (name, type, default, purpose, range).

---

## 17. Code review checklist

Comments: Tier-1 header? Tier-2 docstrings? Tier-3 block comments? tags have tickets? comments fresh? contract comments at boundaries? business rules traced?
Code: names clear? one responsibility? fully typed (no `any`)? nesting ≤ 3?
Errors: caught, logged with context, surfaced? no empty catches?
Debug/Audit: complex ops use the tracer? mutations/payments/permission changes emit an AuditRecord?
Testing: happy + edge + error paths?
Logging: structured, with correlation + trace IDs?
Security: QA RISK/COMPLIANCE lenses pass? findings report attached with zero open HIGH/CRITICAL? recurring findings escalated? input validated at trust boundaries? `SECURITY_GATE`/`TRUST_BOUNDARY`/`DATA_FLOW` tags present? security review block on sensitive files? secrets out of code? findings classified?
Deps: justified, maintained, licence-OK, no HIGH/CRITICAL CVEs?

---

## 18. Non-negotiable rules (block a feature from closing)

**Commenting & docs**

1. Every file has a Tier-1 header.
2. Every public function has a Tier-2 doc block.
3. Every logical block has a Tier-3 comment.
4. No comment tag without a ticket reference.
5. Stale comments are bugs — update comments when you change code.

**Code quality** 6. No unnamed/abbreviated variables in production code. 7. No function > 40 lines without justification. 8. No empty catch/except blocks. 9. No `any` / missing type hints on public interfaces. 10. No commented-out code on the main branch. 11. No `console.log`/`print` in production code — use a structured logger.

**Audit & debug** 12. No data mutation / payment / permission change without an audit record. 13. Complex operations use the DebugTracer.

**Security & compliance** 14. No hardcoded secrets, URLs, or environment-specific values. 15. All QA gates (RISK + COMPLIANCE lenses, or CI) pass before a feature closes. 16. A Post-Run Findings Report is produced for every QA run. 17. Zero unresolved HIGH/CRITICAL findings. 18. Recurring findings at `TICKET_REQUIRED`+ have a linked ticket with root-cause analysis. 19. `STOP_SHIP` (4th recurrence) blocks all releases until the systemic fix is verified. 20. Authn/authz functions carry a `SECURITY_GATE` tag. 21. Every trust boundary carries a `TRUST_BOUNDARY` tag with its validation method. 22. Every PII/financial flow carries a `DATA_FLOW` tag with classification. 23. Sensitive files (auth/payments/PII/integrations) carry a Security Review Block. 24. No new dependency with a known HIGH/CRITICAL CVE without documented risk acceptance + remediation date.

**Process** 25. No untested public functions. 26. Every feature links to a ticket and has a description.

---

_This is a living standard. Update it as the project learns (record changes in `docs/DECISIONS.md`). The goal isn't perfection — it's consistent, predictable, debuggable code any engineer can pick up with confidence._

# Product Validation: Snap

> **Phase 5 output.** Produced *after* technical QA (`qa-report.md` = PASS). This is the **product gate**.
> Built from the Senior PM review (5A), the persona panel (5B), and the remediation roundtable (5C). All
> roles spawned fresh from `docs/PRODUCT-PANEL.md`.

**Feature:** Snap
**Ticket:** PLAY-002
**Run at:** 2026-06-21 (round 1)
**Overall product gate:** ☑ PASS  ☐ BLOCKED  ☐ BLOCKED — ESCALATED

---

## The gate (how this PASSES)

PASS when ALL hold: (1) PM = `PASS`; (2) every target persona meets **baseline AND value** *for the
in-scope job this feature targets*; (3) zero open baseline/value-blocking criticals that are **in scope**.
Satisfaction is scored, never gated.

---

## 5A — Senior PM review (business requirements)

| Round | Verdict | Blocking issues | Notes |
|---|---|---|---|
| 1 | **PASS** | 0 | Business outcome ("ship a second playable game via the one-object contract") fully delivered; catalog 1→2 live games. |

**Issues (latest round):** none blocking. One non-blocking observation: the solo/single-player gap stays
open — but Snap is local-multiplayer by design and its stated outcome was never to close that gap, so it's
correctly scoped out (→ `IDEAS.md`), not a defect.

**Evidence anchor:** *"PlayPad has a second playable game live in the catalog, added via the established
one-object registry contract… Adding it touches only `games.js` + a new `games/snap/` folder"*
(`requirements.md` → Business requirements) — literally true in the diff.

---

## 5B — Persona panel (usability & value)

**Evaluation mode:** ☑ artifacts + functional verification (requirements + code + the deterministic
16-round logic harness + a11y snapshots) · ☑ **no live pixel screenshots** (the headless preview reports
the page as `hidden`, which throttles `requestAnimationFrame`; gameplay was verified deterministically
instead).

| Persona | Baseline | Value | Satisfaction | Critical? | Key feedback |
|---|---|---|---|---|---|
| **Priya & kid** (Sofa Co-op, **primary**) | **met** | **met** | 3/5 | no | Child picked theme + colour herself, understood "slap when they match" instantly, big reachable buttons, floor-at-0 penalty + non-punitive countdown taps keep her in. Fun tapers because the reaction/judgement skill gap benches a 7-yo on wrong taps — wants a kid-handicap. |
| **Dan** (Office Micro-breaker, **secondary**) | **met** *(with a colleague)* / **not met** *(solo)* | **met** *(with a colleague)* / **partial** *(solo)* | 3/5 | no defect — **fit, not breakage** | With a deskmate: 10-sec setup, keyboard keys G/H parity, 0:30 fits the break, real value. Alone (his common case): Snap needs ≥2 players, so he can't start — the explicitly out-of-scope solo gap. |

**Both personas flagged ZERO build defects.** Priya passes both hard gates. Dan passes both gates *for the
in-scope case this feature targets* (co-op / office-with-a-colleague) and explicitly scopes his solo miss
as "a scope/fit gap the requirements already park in IDEAS — not a build defect… I'd pass this on technical
merit."

**Non-blocking feedback → `docs/IDEAS.md`:** kid/young-player handicap mode (per-player longer reveal or
penalty-off) [Priya, highest-signal]; intensity guidance at setup ("Chill is best for little ones");
gentler non-match cue option for kids; a "great try!" consolation when a player ends on 0; **solo Snap
mode** [Dan, headline ask — reinforces the existing solo priority]; a "Playing solo? Try Colour Rush"
pointer on the setup screen.

---

## 5C — Remediation Roundtable

### RT-1 — Dan's baseline/value miss (the solo gap)
- **Raised by:** Dan (secondary persona).
- **Problem:** Dan misses baseline (can't start) + value (partial) **for his solo default case**, because
  Snap requires ≥2 players.
- **Attendees:** Senior PM + Senior UX Designer + Dan.
- **Plan (a scope ruling, NOT a Phase-3 fix):** The miss is confined entirely to the **solo** case, which
  is **explicitly out of scope** for PLAY-002 (`requirements.md` → *Out of scope*) and is already the
  highest-signal **IDEAS.md** backlog item. Building solo mode now would violate scope discipline and
  delay the feature whose purpose — *ship a second playable co-op game and prove the catalog return-loop* —
  is fully met. Evaluated against the feature's **actual in-scope target** (co-op + office-with-a-colleague),
  Dan meets baseline AND value, as he states himself. **Resolution:** do not rework; **elevate solo Snap /
  a solo path to the top of `IDEAS.md`** (now reinforced by two independent personas — Maya at launch, Dan
  here) and add a setup-screen "playing solo? try Colour Rush" pointer as a small near-term nicety.
- **Implemented:** No Phase-3 change. `IDEAS.md` updated (solo elevated; nice-to-haves logged);
  `findings-ledger.md` `solo-content-gap` updated to note game #2 also doesn't close it.
- **Re-validation:** PM concurs the solo gap is out of scope for PLAY-002; primary persona (Priya) already
  passes both gates. Gate resolves to **PASS** on the in-scope basis.
- **Status:** RESOLVED (scope ruling — 1 round, no escalation).

---

## Human summary

Snap passes the product gate. The PM confirms it delivers exactly its business goal — a second, genuinely
different, drop-in game that doubles the catalog with a one-line add. The primary target users (a parent +
young child on one tablet) can set up and play together, find the visuals clear and friendly, and replay —
both hard gates met; their satisfaction (3/5) points to a future kid-handicap mode. The office persona
loves a quick 2-player keyboard round with a colleague but can't use Snap when he's alone — that's the
known, deliberately out-of-scope solo gap (already the top backlog idea), not a defect, so it doesn't block
shipping game #2. Net: ship Snap; make a solo mode the next priority.

---

### Loop control
Gate = **PASS** → proceed to **Phase 6 (CAPTURE)**: log product/UX learnings, move non-blocking feedback to
`docs/IDEAS.md`, finalise `docs/findings-ledger.md`.

## Post-launch UAT (after the feature is live)
> Skip until live. When Snap ships, run a PM-led UAT with the same panel to confirm the co-op experience
> lands with real parent-child usage and to validate whether the kid-handicap gap suppresses retention.

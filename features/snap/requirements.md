# Feature: Snap — themed card-matching reaction game (PlayPad game #2)

> **Phase 1 of the workflow.** Define what "done" means _before_ writing code. A QA agent will hold the implementation to these criteria — vague requirements produce vague QA.

**Status:** SHIPPED — QA PASS · product gate PASS (2026-06-21)
**Owner:** @BudGitH
**Ticket:** PLAY-002
**Created:** 2026-06-21
**Feature tier:** Prototype _(defaults to the project tier)_

> **Superseded in part by PLAY-006 (see `features/playpad-revamp/`, `design-party-games.md`, 2026-11-21).** History below is kept as written. Stale: the per-round 3-2-1 (flow near line 77, AC-2, and AC-7's "intensity changes the countdown": the 3-2-1 now plays only in round 1 and after a pause; later rounds wait a random shuffle delay of 300-1100 ms, frantic 200-600 ms, and intensity still changes reveal / inter-round timing); "Persistence / high scores" out of scope still holds (Snap saves nothing). New behaviour not described here: avatar + colour identity with shape glyphs, light Pink + black ink, 2 players preselected, sticky Start, Gentle mode, keys A / L / Q / P, two-tap quit + Esc, pause on hidden (resume = 3-2-1), "SNAP!" + reaction time, confetti.

---

## What & why

- **What:** A second PlayPad mini-game, **Snap** — a local-multiplayer (2–4) reaction game for one shared
  screen. Each round, two themed cards flip face-up at the same instant; if the two symbols **match**, the
  fastest player to slap their button scores +1; if they **don't match**, a player who taps is penalised.
  Most pairs at the end wins.
- **Why:** The catalog's "come back to try other games" loop is unproven with one game; the PM flagged
  **time-to-second-game** as the real success signal (`docs/IDEAS.md` → _Ship game #2_; from
  `features/playpad-launch/product-validation.md`). Snap is colourful, easy, and one-screen multiplayer —
  squarely aimed at the **Sofa Co-op** persona.

## Business requirements & success metrics

- **Business outcome:** PlayPad has a **second playable game** live in the catalog, added via the
  established one-object registry contract — proving the hub scales to a growing catalog.
- **Success metric:** catalog game count 1 → **2 live games**; a returning visitor now has a _second_
  distinct game to try (the return-loop precondition). Adding it touches **only** `games.js` + a new
  `games/snap/` folder (the "one-line add" success criterion in `docs/PROJECT.md`).
- **Must-have business rules:**
  - A "Snap" is when the two revealed symbols are **identical**; only then is a tap rewardable.
  - The **first** valid tap on a match scores; ties are resolved by the device's own input ordering.
  - A wrong tap (tapping on a non-match) costs **−1, floored at 0** — a score never goes negative.
  - The game is **fully client-side, no storage, no network, no accounts** (consistent with Colour Rush).

## Target personas & success bar

> Named from `docs/PRODUCT-PANEL.md`. Only these are spawned for the Phase 5B panel.

- **Personas served:** **Priya & kid — "Sofa Co-op"** (primary) and **Dan — "Office Micro-breaker"**
  (secondary; the keyboard keys make a quick 2-player laptop round work). The **Builder-Owner** is served
  by the one-object registry add.
- **Baseline (hard gate):** Priya & her 7-year-old can set up and complete a full game together on one
  tablet; Dan can start and finish a 2-player round on a laptop within a short break.
- **Value (hard gate):** it's a genuinely _different_ game from Colour Rush (card-matching vs. spatial
  tapping) that's worth opening — colourful, easy, and pick-up-and-play for mixed ages.
- **High satisfaction (scored, not gated):** themed cards (Princess!) delight the child; they play more
  than one round; the slap-race is exciting without being stressful.

## Design routing

> UI surface? × reuse-only? × tier → path.

- UI surface? **yes** · Reuse-only? **no** (one new pattern: the theme picker + the two-card flip stage /
  edge-anchored player buttons) · Tier **Prototype** → **Path: lite** (+ log the new patterns to `IDEAS.md`).

## Design review

> **Lite path:** recorded here.

- Checked against `docs/DESIGN-SYSTEM.md`: the setup reuses MD3 tokens + Colour Rush components
  (`.sel-chip`, `.swatch` exclusivity, `.switch`, `.start-btn`, `.back-link`, `.card`, `.button`,
  `:focus-visible`, `.visually-hidden`). **New patterns** — the **theme picker** card and the **roundtable
  stage** (two-card 3D flip + edge-anchored player buttons) — are built entirely from existing
  `--md-sys-*` / `--brand-*` tokens plus three new `--snap-theme-*-back` decorative gradient tokens
  (single source of truth, not inline literals). Colour is never the only signal (every feedback state
  pairs colour with motion + an icon/text badge). The new patterns are logged to `docs/IDEAS.md` as
  design debt to formalise if reused. **Human OK:** approved in the plan (`ExitPlanMode`, 2026-06-21).

## User-visible behaviour

A player opens Snap from the hub → a **setup** screen: pick a **theme** (Nature / Princess / Superheroes),
**player count** (2–4), a **unique colour** for each player, **round length** (0:30–2:00), **intensity**
(Chill → Frantic), and a **sound** toggle. Start is disabled until every player has a colour. On Start, the
**game stage** shows each player a large coloured **button** anchored to their edge of the screen (rotated
to face them), with two face-down cards in the centre. A **3-2-1 countdown** plays, then both cards flip
face-up at once. If they **match**, the first player to hit their button gets +1 and a celebration; if they
**don't match**, anyone who taps gets −1 (floored at 0) and is locked out for that round. Rounds repeat
until the timer reaches 0:00, then a **results** screen ranks players by **pairs** (winner / tie / "no
snaps"), with Play again / Change settings / back to PlayPad.

## Acceptance criteria

- [ ] **AC-1 (setup):** The user can choose a theme, 2–4 players, a **unique** colour per player
      (exclusivity: a taken colour is disabled in other rows), a round length, an intensity, and toggle sound.
      **Start is disabled** until every active player has a colour; the note text reflects the state.
- [ ] **AC-2 (round reveal):** Each round runs a 3-2-1 countdown, then **both** centre cards flip face-up
      **simultaneously** showing one themed symbol each.
- [ ] **AC-3 (match → score):** When the two symbols are **identical**, the **first** valid tap (touch or
      the player's key) awards **+1** to that player and the round resolves; later taps that round are ignored.
- [ ] **AC-4 (non-match → penalty):** When the symbols **differ**, a player who taps gets **−1 floored at
      0** and is **locked out** for the rest of that round (max one penalty each); players who don't tap are
      unaffected; the round **still runs its full reveal window** (a fast wrong tap can't end it for others).
- [ ] **AC-5 (loop + results):** Rounds repeat until the chosen duration elapses (the 0:00 clock ends the
      game, aborting any in-flight round); the results screen then ranks players by pairs, handling **winner**,
      **tie**, and **all-zero ("no snaps")**.
- [ ] **AC-6 (controls):** Quit (✕) returns to setup with selections intact; **Play again** restarts the
      same settings; **Change settings** returns to setup; the "← PlayPad" link returns to the hub.
- [ ] **AC-7 (settings take effect):** Changing **intensity** changes the countdown/reveal/inter-round
      pace; changing **theme** changes the card faces and the card back; **sound off** silences all cues.
- [ ] **AC-8 (a11y):** Setup is fully keyboard-operable with a visible focus ring on every control;
      reduced-motion keeps the game fully playable with correct timing (flip is decoration only); contrast
      meets AA; no state is signalled by colour alone; `#srStatus` announces each round outcome and the result.
- [ ] **AC-9 (one-line add):** The game is registered by appending **one object** to `window.GAMES` in
      `games.js` (and removing the `coming-soon` placeholder); no other hub/shared file is edited; it appears
      as a live card and navigates to `games/snap/`.

## Edge cases & error states

- **Quit mid-round** (✕): no stray timers (all RAF-driven); state resets; back to setup with selections kept.
- **Duration expires mid-round:** the session guard is checked first each frame → the round aborts and
  results show (0:00 == game over). A match tap landing in the same frame _before_ the end-check still counts.
- **Tap during the countdown** (before reveal): does **not** score and is **not** penalised (optional
  non-punitive "too early" shake).
- **Nobody taps a match** within the reveal window: "missed snap" — no score, advance.
- **Several players tap a non-match:** each is penalised once and locked independently; further taps ignored.
- **Reduced motion:** functional timing comes from JS `performance.now()` deadlines, never a CSS
  `animation/transitionend` — the flip is decoration that simply snaps.
- **Resize / orientation change:** CSS edge anchors reflow automatically; any JS sizing is debounced ~150ms.
- **Tie / all-zero** at the end; **backgrounded then resumed** (one frame advances exactly one phase);
  **audio not yet unlocked** (`initAudio()` + `resume()` on the Start gesture; `beep()` is try/caught).
- **Two players want the same key:** keys are auto-assigned distinct defaults (rebinding deferred → IDEAS).

## Out of scope

- **Solo / single-player mode** (Snap is multiplayer by design — the solo gap stays a separate `IDEAS.md`
  item). Custom **key rebinding** (auto-assigned + displayed for v1). Persistence / high scores / accounts.
  Online multiplayer. More than 4 players. Additional themes beyond the three.

## Non-functional requirements

- **Accuracy:** scoring mutates through a single `Math.max(0, score + delta)` point (floor can't be
  bypassed); a match shows one symbol on **both** cards; a non-match shows two **distinct** symbols
  (enforced); only the **first** tapper scores a match; the session ends exactly at 0:00.
- **Risk/Security:** no storage, no network, no `eval`, no secrets, no PII. The only trust boundary is the
  registry string rendered by the hub, already covered by the hub's `esc()`/`safeHref`
  (`docs/LEARNINGS.md`). Inline script/style run under the existing CSP `'unsafe-inline'` (project-wide,
  tracked in `docs/IDEAS.md`).
- **Compliance:** nothing mutates data/money/permissions → no audit trail required (Prototype-tier comment
  relaxations per `docs/CONVENTIONS.md` PLAY-001: section banners + Tier-3 "why" comments on load-bearing
  logic).
- **Quality:** no jank — one RAF loop on `performance.now()`; functions single-responsibility and short;
  intention-revealing names; reuse Colour Rush helpers rather than re-implement.

## Tech Lead feasibility

- **Verdict:** **PROCEED** — pure client-side, mirrors an existing shipped game (Colour Rush) on the same
  build-free stack; introduces no new trust boundary beyond the registry string already handled by `esc()`;
  consistent with `docs/ARCHITECTURE.md` (self-contained `games/<slug>/index.html` + one-object registry).
  Effort: moderate (one new file ~ the size of Colour Rush). One-line Prototype note, non-blocking.

# Feature: Claw Catch (claw-machine game #3)

> **Phase 1 of the workflow.** Define what "done" means _before_ writing code. A QA agent will hold the implementation to these criteria — vague requirements produce vague QA.

**Status:** DRAFT
**Owner:** @BudGitH
**Ticket:** PLAY-003
**Created:** 2026-06-27
**Feature tier:** Prototype _(matches project tier)_

> **Superseded in part by PLAY-006 (see `features/playpad-revamp/`, `design-claw-catch.md`, 2026-11-21).** History below is kept as written. Stale: "Persistent high scores / storage" and "Full rigid-body pile physics" are no longer out of scope (a best score per `<seconds>-<difficulty>` is saved in `playpad.clawCatch.v1`; the pile is a physical heap with tumble); AC-8's `BIN_CAP` periodic refill is now hopper-fed refills (burst of 3 below half the cap). New and not described here: cabinet / marquee / glass, aim line + target ring, skill-based `catchOdds`, streak multiplier, golden prize (+time, capped), two-prize bonus, prize shelf on results, two-tap quit, sticky Start, always-dark cabinet.

---

## What & why

- **What:** A solo arcade claw-machine game. The player steers a hanging claw along a top rail, drops it to grab prizes from a bin, and dumps them into a chute for points within a timed round. The claw drops **straight down** and only **jiggles** a little when the trolley moves (like a real arcade claw), so lining it up and timing the drop is the skill. _(Shipped behaviour after rev 2 — the original draft described a full pendulum swing, since changed per playtest feedback.)_
- **Why:** `docs/IDEAS.md` lists "a solo / single-player path" as the **highest-signal persona ask** — every existing game (Colour Rush, Snap) is local multiplayer. Claw Catch is PlayPad's first single-player game. Reference: the user's claw-machine screenshot (joystick + grab button + a bin of prizes).

## Business requirements & success metrics

- **Business outcome:** PlayPad gains a genuinely single-player game, broadening the catalog beyond shared-screen multiplayer so a lone visitor has something to play.
- **Success metric:** A solo visitor can start and complete a round without a second person (the gap today). Adds one `status:"live"` card to the hub via a one-line registry change (PROJECT.md success criterion: "a new game can be added with a one-line registry change").
- **Must-have business rules:**
  - 1 player only — no second-player dependency anywhere.
  - Drops straight into the existing hub with one `window.GAMES` entry; self-contained under `games/claw-catch/`; no build step; works from `file://`.
  - Scoring is **rarity-weighted but transparent** — the player can always see what each prize is worth before and during play.

## Target personas & success bar

- **Personas served:** **Solo Sam** (a lone visitor wanting a quick single-player break) and **Kid Pilot** (a young player who needs forgiving, obvious controls).
- **Baseline (hard gate):** From the hub, the player opens Claw Catch, starts a round, moves the claw, drops it, and catches at least one prize that adds to their score — alone, no second person.
- **Value (hard gate):** It beats "nothing to play alone" — a self-contained skill game with a clear goal (score), readable controls, and a satisfying grab. Lining up the straight drop (and the risk of a mid-carry slip) makes it skill-based and tense, not random.
- **High satisfaction (scored, not gated):** The claw _feels_ real (believable sway/settle on a flick); three themes invite replay; the capped refill keeps tension; "+N" pops feel rewarding.

## Design routing

> **UI surface?** yes (a whole new game screen) · **Reuse-only?** no (new Canvas stage + control deck) · **Tier** Prototype → **Path: lite**

## Design review

- Checked against `docs/DESIGN-SYSTEM.md`: setup/results/HUD reuse the shared MD3 tokens and the exact Snap markup patterns (`.sel-chip`, `.theme-grid`, `.switch`, `.back-link`, results `.rank`). New surfaces — the canvas cabinet, the bottom control deck (joystick + grab button), and the prize-key panel — use only `--md-sys-*` tokens (colours, radii, elevation, motion). The canvas itself is a decorative stage; all interactive controls remain real DOM buttons with ≥48px hit targets and focus rings. Human OK: pending verification screenshots.

## User-visible behaviour

On the **setup** screen the player picks a **theme** (Critters / Sweets / Space — swaps prizes + cabinet colour), a **round length** (0:30 / 1:00 / 1:30 / 2:00, default 1:00) and a **difficulty** (Chill / Normal / Tricky). A **prize key** below shows every prize in the chosen theme with its ★ rarity and point value. Press **Start**.

In the **game**, a claw hangs from a trolley on a top rail above a bin of prizes. The player moves the trolley left/right (on-screen joystick, or ← → / A D), and the claw **swings** as it moves and settles when still. Pressing the **grab button** (or Space / ↓) drops the claw straight down; it closes, and if a prize is under the claw tip it may be caught (closer = surer; rarer prizes grip worse). The claw lifts, returns to the chute, and releases — a caught prize drops in and a **"+N"** popup shows its points, added to the score. New prizes periodically drop into the bin up to a cap. A clock counts down; at 0:00 the round ends.

On **results**: final score, prizes caught, and the best single catch, with **Play again** / **Change settings** / **Back to PlayPad**.

## Acceptance criteria

- [ ] AC-1: The game is reachable from the hub via a `window.GAMES` entry (`id:"claw-catch"`, `players:"1"`, `status:"live"`) and loads standalone from `file://` with no console errors.
- [ ] AC-2: The setup screen offers exactly 3 themes; selecting one updates the cabinet colour and the prize key. Duration and difficulty selectors work and persist into the round.
- [ ] AC-3: The player can move the claw left/right with the joystick AND with keyboard (← →, A/D); the trolley stays within the cabinet bounds.
- [ ] AC-4: The claw drops **straight down** (its grab point stays under the trolley — the lateral offset does not grow with drop depth). Moving the trolley produces only a **small jiggle** that settles quickly via damping (tilt clamped to a few degrees) — never a string-like swing. _(Revised from the original pendulum-swing AC per rev 2.)_
- [ ] AC-11: A grabbed prize **wobbles** while carried and has a per-difficulty chance to **slip and fall back into the pile mid-carry** (`dropChance`); an empty grab or a slip returns the claw to idle in place without travelling to the chute. _(Added rev 2/3.)_
- [ ] AC-12: Prize emoji render on the canvas on **all engines** (incl. iOS/WebKit) via cached emoji-first sprites — never blank capsules. _(Added rev 4.)_
- [ ] AC-5: Pressing grab (button or Space/↓) runs the full sequence drop → close → lift → return → release exactly once, with player input locked during it, then returns to idle ready for the next grab.
- [ ] AC-6: A prize centred under the claw tip at the bottom of the drop can be caught and scored; a prize far from the tip is not caught. Caught prizes leave the bin; missed prizes remain.
- [ ] AC-7: Scoring is rarity-weighted: the awarded points for a catch equal the caught prize's listed point value, and the same value is shown in the prize key (setup + in-game) — i.e. what's shown equals what's scored.
- [ ] AC-8: Prizes refill periodically up to a cap (`BIN_CAP`); the bin count never exceeds the cap, and refills resume after prizes are removed.
- [ ] AC-9: The round ends at 0:00 → results screen shows final score, prizes caught, best catch; Play again restarts, Change settings returns to setup, Back to PlayPad returns to the hub.
- [ ] AC-10: Under `prefers-reduced-motion: reduce`, gameplay still works and state is never trapped behind an animation (claw/grab outcomes are driven by JS state, not transitionend); layout holds at a phone width.

## Edge cases & error states

- Grab pressed with an empty bin → sequence runs, catches nothing, no score, no error.
- Grab pressed while a sequence is already running → ignored (no double-drop).
- Trolley driven hard into either wall → clamps at the bound; swing still resolves without flinging the claw out of bounds.
- Two prizes overlapping near the tip → at most one is caught per grab.
- Tab backgrounded mid-round → on resume the clock reflects real elapsed time and the round can still end cleanly (RAF-delta safe, like Colour Rush/Snap).
- Quit mid-sequence → returns to setup, no dangling RAF, no lingering overlay.
- Theme switched after a prior round → new round uses the newly selected theme's prizes and colours.

## Out of scope

- Multiplayer / second player.
- Persistent high scores / storage.
- Full rigid-body pile physics (prizes settle into bin slots, not a true physics stack).
- Sound is optional (a light toggle reusing Snap's switch); not a gated requirement.

## Non-functional requirements

- **Accuracy:** Awarded points must equal the caught prize's defined value; the clock must end at exactly 0:00; the bin count must never exceed `BIN_CAP`. Physics constants are named (no magic numbers) so behaviour is inspectable.
- **Risk/Security:** No network, no storage, no user-supplied strings rendered as HTML, no secrets. Trust boundary is only the local input devices. Use `textContent`, not `innerHTML`, for any dynamic values.
- **Compliance:** Prototype tier — section-banner comments + "why" notes per `docs/CONVENTIONS.md` PLAY-001; no PII, no audit trail needed.
- **Quality:** Smooth on a mid mobile (single RAF loop, canvas redraw only; no per-frame DOM thrash). Functions small and single-purpose; difficulty/physics knobs centralised in config tables.

## Tech Lead feasibility

- **Verdict:** PROCEED — Canvas 2D for the stage is a deliberate departure from the DOM-only existing games (to be recorded in `docs/DECISIONS.md`), justified by the swinging-cable / claw-arm rendering. No new dependencies, still `file://`-safe. Pendulum integration is standard and cheap. Effort: medium (one self-contained file).

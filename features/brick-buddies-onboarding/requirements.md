# Feature: Brick Buddies onboarding — a child can play within ~30 seconds

> **Phase 1 of the workflow.** Define what "done" means _before_ writing code.

**Status:** IMPLEMENTED (AC-1..9 checked by `tests/brick-buddies-help.spec.mjs` and `features/brick-buddies/probe.mjs`; AC-10 owner-judged)
**Owner:** @BudGitH
**Ticket:** PLAY-009 (follow-up)
**Created:** 2026-11-22
**Feature tier:** Standard (project tier; public open-source)

---

## What & why

- **What:** make Brick Buddies (`games/brick-buddies/index.html`) startable by a 6-10 year old who reads little: a short picture "How to play" on first run (re-openable from a "?" button), an always-visible plain-language "what to do next" line that rings the exact control and points at the exact tile, a first goal that takes three taps, and a quieter first screen (no coins, stars or menus until they matter).
- **Why:** the owner reports kids do not play it because they have no idea how. Honest read of the old first run (screenshots in `screens/before-*`): a three-line text wall on the title, then a six-row checklist plus a paragraph of tips, a 40-block hut recipe as the very first goal, eight unlabelled hotbar slots, Build / Items / Look / coin / star chrome, and no pointer to what to tap.

## Business requirements & success metrics

- **Business outcome:** a child who opens the game with no adult explaining it gets a first win (a buddy moves in) fast enough to want a second.
- **Success metrics:** (1) a first-time player has a buddy housed within ~30 s of pressing Start using only the on-screen pictures / prompts; (2) the first screen after Start shows at most four picture steps; (3) at no point in the first request is the player's next action unmarked.
- **Must-have business rules:** static, build-free, one self-contained file; no network; **saves untouched** (the existing `playpad.brickBuddies.v1` key and format are not changed; the only new storage is a separate "has seen the how-to" flag); every existing probe check still passes; MD3 tokens only (no new raw palette).

## Target personas & success bar

- **Personas served:** **Priya & kid** "Sofa Co-op" (a ~7-year-old on a shared phone or tablet; reads little), **Maya** "Commuter Casual" (phone, one hand, no patience for a manual), **Sam** "Keyboard / AT user" (the how-to and coach must be operable and announced) — `docs/PRODUCT-PANEL.md`.
- **Baseline (hard gate):** the child can finish request 1 by following the screen alone (walk, pick, tap, tap, tap).
- **Value (hard gate):** it is clearly easier than before (fewer words, one marked next step, a three-tap first goal) without removing the building game.
- **High satisfaction (scored, not gated):** the "oh, I get it" moment; the first move-in feels like a reward; the "?" is there when they forget.

## Design routing

- UI surface? **yes** · Reuse-only? **mostly** (existing tokens, chips, cards, overlay pattern; new: the how-to card, the coach line, the pulse ring) · Tier **Standard** → the strict table says **full** (four mockups). **Deviation, recorded:** this is a product-owner-directed usability fix to an existing screen, the direction (visual, 3-4 steps, "?" button, pointing prompt) is dictated by the brief, and the four-option mockup round is replaced by the before/after screenshot loop in `design-review.md`. Logged in `docs/DECISIONS.md`.
- **Crosses FE/BE seam?** **no**.

## Design review

See `design-review.md` (before/after screenshots at 390x844 and 1280x800; DESIGN-SYSTEM check).

## User-visible behaviour

1. **Title:** name, one short line, a big **Start building**, **? How to play**, **Sound**. The old three-step text list is gone (the pictures replace it).
2. **First run:** pressing Start opens **How to play** over the live scene: four picture cards with a few words each (Pip wants a room / walk / pick a block, tap to place / tick every box, Pip moves in) and one big **Let's go!** (also an X and Esc). It never shows again once dismissed; the **?** chip in the top bar (and on the title) re-opens it any time. The game does not take input while it is open.
3. **Simple first request:** until the first buddy has moved in, the coin and star counters, the **Items** button and **Look** are hidden. A finished hut shell (roof, walls, back wall; doorway open) already stands on the grass left of the house, so the first goal is a bed, a torch and a door: three taps.
4. **The coach:** a one-line prompt with an icon, always visible in the request card even when the card is collapsed, plus three picture ticks (bed / torch / door). It walks the child through: **Walk to the hut** (edge label "Hut" and the walk pad ringed) -> **Pick the bed** (its hotbar slot ringed, the spot already glowing) -> **Tap / Click the glowing spot** (pulsing outline, bouncing arrow; tapping either half of a two-tile item works) -> next job -> **Pip is moving in!** -> **A new home!**. Later requests get a plain line for the first missing thing ("Add a door", "Add a furnace", "Open Items") with the matching slot / button ringed.
5. **After the first move-in:** coins, stars, Items and Look appear; the next request starts with the plain coach.

## Acceptance criteria

> Checked by `tests/brick-buddies-help.spec.mjs` (Playwright, runs in `npm run smoke`) and `features/brick-buddies/probe.mjs` (AC-22 section), unless marked (manual). Numbering continues the Brick Buddies list (AC-1..21 in `features/brick-buddies/requirements.md`); here they are AC-22.1 .. AC-22.10.

- [x] **AC-22.1 First-run help:** with no stored "seen" flag, pressing Start opens a dialog named "How to play" with 1-4 picture steps (each has a pixel icon or symbol and a caption of at most 40 characters), a "Let's go!" button focused, `phase` stays `playing`, and keys / taps do not move or edit the game behind it.
- [x] **AC-22.2 Dismiss + remember:** "Let's go!", the X button and Esc each close it; dismissing writes `playpad.brickBuddies.help.v1 = "1"` (a key of its own; the save is untouched); it does not reappear after a reload; "New world" does not reset it. With storage blocked it still works (once per visit) and raises no error.
- [x] **AC-22.3 Re-open:** a "?" button (accessible name "How to play", at least 48x48 css px, fully on screen) is in the HUD at 390x844, 844x390, 568x320 and 1280x800; the title screen has a "How to play" button; both open the same card.
- [x] **AC-22.4 Three-tap first goal:** a fresh world has a hut shell on the flat plot (pre-built roof, walls, back wall, open doorway); placing only a bed, a torch and a door through the real placement rules (`tryPlace`) houses Pip (`housed === 1`, +40 coins); the save format and key are unchanged (the hut is ordinary tiles).
- [x] **AC-22.5 Coach line:** while a request is open the coach line is visible (also with the card collapsed) with text of at most 28 characters and an icon; in the first request it reports, in order, `walk` -> `pick` -> `tap` for each of bed / torch / door (`__buddies.debug.coach()`), `moving` when the buddy walks in, `next` after the reward.
- [x] **AC-22.6 Points at the control:** the control to use next carries the `coach-pulse` class (the walk pad on touch, the hotbar slot of the item to pick, the Build button when in Break mode); a world arrow + pulsing outline is drawn on the target tile(s), or an edge label when it is off screen; with `prefers-reduced-motion` the ring is steady (no animation) and the arrow does not bob.
- [x] **AC-22.7 Taps on the glow work:** with the coached item selected, tapping any tile of the glowing spot places it on the planned anchor (door: either half; bed: either half); F or Enter places on the glow with no aiming (keyboard-only play); tapping the glow with a different item says "Pick the bed first" and places nothing; a spot filled by a block gets "Switch to Break" / "Break the plank" instead of a dead end.
- [x] **AC-22.8 Simple first run:** until `housed >= 1` (and while the bar holds bed, torch and door) the coin chip, star chip, Items button and Look button are hidden; they are shown again afterwards; the housed counter and the Build / Break toggle stay.
- [x] **AC-22.9 No regressions:** existing probe checks AC-1..21 still pass (updated only where the first-run path changed: the tip text, the hut now pre-built, the controls hidden during the first request); lint, format, secret scan and the smoke suite pass; layout checks at 390x844 / 844x390 / 568x320 still show no overlaps (AC-19), including with the coach line.
- [ ] **AC-22.10 Reads as easy (manual, owner-judged):** a child (or the owner playing as one) reaches the first move-in from a cold start in about 30 seconds without being told anything. Recorded in `product-validation.md`.

## Edge cases & error states

- Older saved world with no hut (request 1 still open): the coach falls back to the plain line ("Build a cosy bedroom" / first missing row) and the tip reverts to the build-it-yourself wording.
- The player rearranges the hotbar so bed / torch / door are not on it: the Items button stays visible (not hidden by the simple first run) and the coach rings it.
- The player stands in the doorway when the door is next: "Step aside" with an arrow, and the walk pad ringed on touch.
- Player in Break mode: the coach says "Switch to Build" and rings the mode button.
- Help opened mid-game with a key held: held keys / pads are released; closing returns focus to the game.
- `localStorage` throws: the how-to shows once per visit; nothing else changes.
- Reduced motion: no pulse animation, no bobbing arrow.

## Out of scope

- A guided blueprint ("tap the glowing tiles") for building walls and roofs in later requests (logged in `docs/IDEAS.md`).
- Voice / read-aloud, translations, a full tutorial level, changes to the starter house or the save format.
- Changes to other games.

## Non-functional requirements

- **Accuracy:** the coach is derived from world state every 0.2 s (never from event history), so loading a save, undoing a block or a second tab cannot leave it stuck.
- **Risk/Security:** no `innerHTML` with dynamic strings (`textContent` / DOM nodes only); the only new storage is one constant-key flag read in try/catch; no network.
- **Compliance:** no PII; no new dependency; art is the game's own pixel icons plus system symbols.
- **Quality:** follows `docs/CODE_QUALITY.md` (why-comments, small functions, lint clean); no per-frame allocation in the new draw path beyond the existing pill / path calls.

## Tech Lead feasibility

- **Verdict:** PROCEED_WITH_NOTES — fits the single-file game. Notes: (1) keep the help flag out of the versioned save; (2) the first-run overlay must not change `phase` (the smoke driver and the hub badge wait for `playing`); (3) the coach must be state-derived; (4) pre-building the hut changes only fresh worlds (tiles are already saved), so no migration.

# Feature: Sparkle Salon — a kids' princess make-up game

> **Phase 1 of the workflow.** Define what "done" means _before_ writing code. A QA agent will hold the implementation to these criteria — vague requirements produce vague QA.

**Status:** IMPLEMENTED — awaiting Phase 4 QA panel + Phase 5 product validation (run by the orchestrator)
**Owner:** @BudGitH
**Ticket:** PLAY-008
**Created:** 2026-11-22
**Feature tier:** Standard _(project tier; public open-source, MIT)_

---

## What & why

- **What:** **Sparkle Salon**, a solo, portrait-first make-up game. A client (a princess) asks for a look; the child gives her a makeover in eight rub-to-apply steps (cleanse, eye shadow, eye lenses, mascara, blush, lipstick, accessories, stickers), then snaps a photo, earns 1–3 stars and coins, and spends coins on fancier colours. One self-contained page (`games/sparkle-salon/index.html`): layered inline SVG + a few small canvases + Web Audio synthesis, no assets, no network.
- **Why:** the owner supplied a reference screenshot of a make-up game and asked for the same look and feel ("design fidelity — I do not accept less"). Strategically it opens PlayPad to **young children (4–10)**, the audience the "Priya & kid" persona stands for, with a game that is gentle, tactile and never punishing (`docs/IDEAS.md` / `docs/PROJECT.md`: one-line registry change, consistent look inside the design system's accessibility floor).

## Business requirements & success metrics

- **Business outcome:** a child can start and finish a makeover on a phone or tablet with no reading and no help, wants to play again, and a parent can see why it is safe and calm (no ads, no network, no sign-in, nothing to buy with real money).
- **Success metrics:** (1) a first-time player completes a full 8-step makeover and reaches the photo screen without a dead end (probe AC-3/AC-11); (2) every run earns at least 1 star and some coins, matching the client earns more (AC-12); (3) coins and unlocks persist across reloads so there is a reason to return (AC-9/AC-10); (4) the hub shows a "Best" badge from the saved `bestOverall`.
- **Must-have business rules:**
  - **Never punish free styling:** a skipped step or a "wrong" colour only costs stars, never blocks progress; every run earns ≥ 1 star and coins.
  - Requests only name **free** colours, so a full 3-star run is always possible without spending.
  - Works from `file://` and any static host; **nothing is fetched at runtime** (everything inline), deployed CSP unchanged.
  - Persistence is one versioned key `playpad.sparkleSalon.v1` = `{ v, coins, unlocked[], sound, looks[], bestOverall }`, treated as untrusted input (validated, try/catch).
  - Safe for children: no external links except the hub, no chat/ads/tracking, no real-money purchases.

## Target personas & success bar

- **Personas served:** **Priya & kid — "Sofa Co-op"** (primary: a 7-year-old on a shared tablet with a parent), **Maya — "Commuter Casual"** (one-handed phone, short sessions), **Sam — "Keyboard / AT user"** (keyboard, visible focus, labels) — from `docs/PRODUCT-PANEL.md`.
- **Baseline (hard gate):** the child can start, apply every make-up step with finger strokes or single taps (no reading needed beyond "Start makeover"), reach the photo, and replay; Maya can do it one-handed in a couple of minutes; Sam can do every step with the keyboard (tray + arrow keys on the face) and hear/see each outcome in words.
- **Value (hard gate):** the visuals are clear, colourful and friendly (they match the owner's reference); rubbing feels responsive (the tool follows the finger, paint builds up, a chime + sparkles reward completion); a client request gives a reason to choose colours.
- **High satisfaction (scored, not gated):** the princess blinks and giggles, the photo reveal is a little celebration, and unlocking a locked colour makes you want one more makeover.

## Design routing

> **UI surface?** yes · **Reuse-only?** no (new immersive art direction, tray/tool components) · **Tier** Standard → **Path: full**, **with the owner's reference image recorded as the chosen direction** (see `design-review.md`; no 4-option mock-ups were produced because the owner's reference _is_ the decision).

- UI surface? **yes** · Reuse-only? **no** · Tier **Standard** → **Path: full (owner reference = chosen option)**
- **Crosses FE/BE seam?** **no** — static page, no backend, no `docs/API-CONTRACT.md` rows.

## Design review

See `design-review.md`. Checked against `docs/DESIGN-SYSTEM.md`: the focus-ring, 48px touch target (`--pp-hit-min`), contrast (≥ 4.5:1 body, ≥ 3:1 large), non-colour-only-signal and reduced-motion rules apply; the pastel salon palette is a deliberate **game-local theme** (like Claw Catch's pinned dark stage) because the owner's reference is a light, saturated vanity room. Human OK: the owner's reference image.

## User-visible behaviour

1. **Title:** a glam princess preview (the reference look), the logo, a big **Start makeover** button, a sound toggle, a coin pill, a round back button to the hub.
2. **Start:** a "New client!" card names the client and shows four colour hints (eye shadow, lenses, blush, lipstick). **Let's glam!** begins; a clipboard button reopens the card.
3. **Eight steps**, shown in a step indicator (name + 8 dots), each with a camera zoom to the face area and a tray of round tool buttons: ① **Cleanse** wipe smudges with a sponge · ② **Eye shadow** · ③ **Eye lenses** (tap to swap the iris colour) · ④ **Mascara** (lashes coat one by one) · ⑤ **Blush** · ⑥ **Lipstick** · ⑦ **Accessories** (tiara / earrings / necklace tabs, tap to wear, tap again to remove) · ⑧ **Stickers** (tap the face).
4. **Rub-to-apply:** the active tool (sponge, brush, mascara wand, lipstick, sticker) follows the finger/cursor as an illustrated object (lifted above a fingertip on touch). Dragging paints colour that builds up inside the target region, with a progress ring; at ≈80% the step auto-completes (sparkle burst, chime, +10 coins, giggle). A single tap paints a dab. **Redo** clears the step. **Next** glows once the step is done; before that it reads **Skip**.
5. **Coins:** +10 per completed step, +25 per matched request colour, +15 per star. Locked colours/accessories carry a lock badge; tapping one opens an Unlock sheet (or says how many more coins are needed).
6. **Photo:** camera flash + shutter, a polaroid-style photo with the princess, 1–3 stars lighting one by one, confetti and a fanfare, a card with the matches, coins earned and best score, then **Play again** / **← PlayPad**.
7. **Princess:** breathes, sways, blinks every few seconds, eyes follow the pointer, giggles when a step completes; the whole page reacts with twinkles.
8. **Sound:** all synthesised — a soft music-box loop, brush swish that follows stroke speed, sponge squeak, lens pop, sparkle chime, coin clink, shutter, fanfare, UI taps. Mute toggle persisted; paused while the tab is hidden.

## Acceptance criteria

> Each criterion maps to a numbered check in `probe.mjs` (see `test-plan.md`). "Region" means the shape a step paints into.

- [ ] **AC-1 Title screen:** on load `__salon.phase === "title"`, the button named exactly **Start makeover** is fully inside the viewport (390×844), a sound toggle and a back link to the hub exist, and `frame` does not advance.
- [ ] **AC-2 Start / client card:** pressing Start sets `phase === "playing"`, shows a dialog listing four colour hints; while playing, `frame` increases every animation frame (≥ 8 frames in 400 ms).
- [ ] **AC-3 Steps:** eight steps in this order — Cleanse, Eye shadow, Eye lenses, Mascara, Blush, Lipstick, Accessories, Stickers — with an indicator of 8 dots and the current step's name.
- [ ] **AC-4 Rub-to-apply:** dragging over the region raises its coverage monotonically from 0; at ≥ 80% **mean saturation** (every region cell saturates at a fixed paint amount; progress is the average of the cells' saturation, so one heavy pass over part of the region does not count as covering all of it) the step completes automatically (`done[i]`), +10 coins, the ring shows ✓, a chime plays. Applies to cleanse (smudges fade), eye shadow, mascara (each lash coats) and, by AC-5/AC-6, the rest.
- [ ] **AC-5 Tap dab:** one tap on the blush region raises progress above 0 but below completion.
- [ ] **AC-6 Tap-to-choose:** choosing a lens colour swaps the iris gradient immediately and completes the step; wearing a tiara/necklace shows that accessory and hides the previous one in the same slot; tapping the face in the stickers step adds a sticker and completes the step.
- [ ] **AC-7 Redo:** Redo returns the step's progress to 0 and removes its paint.
- [ ] **AC-8 Next/Skip:** `#nextBtn` has `data-ready="true"` only once the step is done (reads Next, or **Photo!** on the last step); it can always be pressed to skip.
- [ ] **AC-9 Coins & unlocks:** locked options carry a lock badge and name their cost in the accessible name; with too few coins the sheet offers no Unlock and spends nothing; with enough coins Unlock spends exactly the cost, the item is saved in `unlocked`, selected immediately, and survives a reload.
- [ ] **AC-10 Persistence:** `localStorage["playpad.sparkleSalon.v1"]` holds `{v:1, rev, coins, unlocked, sound, looks, bestOverall}` (`rev` is a write counter so two open tabs merge by "highest rev wins"; a `storage` event adopts the newer save); reload restores coins and best score; a hand-edited save (`"1e999"`, `Infinity`, unknown ids, out-of-range stars) is sanitised; blocked or throwing storage never breaks the game.
- [ ] **AC-11 Reveal:** after the last step: camera flash, `phase` `"reveal"` → `"results"`, a star rating of 1–3 whose stars light one by one, coins banked synchronously and persisted, `bestOverall` a top-level number equal to the run's score when it is a new best.
- [ ] **AC-12 Matching & fairness:** matching all four requested colours with all eight steps done earns 3 stars; a run with every step skipped still earns 1 star and 15 coins.
- [ ] **AC-13 Replay:** Play again starts a new makeover (new client card, `phase === "playing"`, step 0); the results screen links to the hub (`../../index.html`).
- [ ] **AC-14 Audio:** all sound is synthesised (no audio files, no requests); audio starts only after a user gesture; the music loop is scheduled after that gesture and effects fire; the sound toggle persists; the audio context is suspended while the tab is hidden.
- [ ] **AC-15 Accessibility:** (a) every visible button/link has an accessible name; (b) all touch targets ≥ 48×48 px, including the back/exit round buttons; (c) tray tools are keyboard operable (Enter picks) with a visible focus ring ≥ 2 px; (d) on the face, arrow keys move the tool and holding Space/Enter paints; (e) Esc opens/closes the leave sheet; (f) `prefers-reduced-motion`: the full flow still reaches the results with stars lit and buttons visible; (g) touch: a fingertip tap paints at the lifted tool tip.
- [ ] **AC-16 Responsive:** at 390×844, 360×640, 844×390 (landscape phone), 820×1180 and 1280×800 there is no horizontal scroll and Start, a tray tool, Next and Play again are all on screen.
- [ ] **AC-17 Clean page:** no console errors/warnings, no failed requests, and the only requests are the page, `styles/tokens.css`, `styles/base.css` and the favicon (the game pins its own pastel theme, so it does not load `scripts/theme.js`).
- [ ] **AC-18 file://:** the page opens from `file://` and Start works with no errors.
- [ ] **AC-19 Test hook:** `window.__salon` exists from load with live getters `phase`, `step`, `frame`, `coins` (the orchestrator's smoke driver relies on this contract).
- [ ] **AC-20 QA-panel hardening (SS-\*):** (SS-C01) keyboard focus survives every tray rebuild (pick, unlock, accessory toggle); (SS-C02) the stage is not a tab stop and is hidden from the accessibility tree outside the game; (SS-C03) text/glyph contrast ≥ 4.5:1 (≥ 3:1 large) on buttons, tagline, caption, best-score, titles and sheets; (SS-C04) every control measures ≥ 48×48 px; (SS-C05) sheets/modals scroll inside a 568×320 viewport rather than clip; (SS-C06) the results primary button is inside the viewport without scrolling; (SS-C11) each progress dot carries a shape cue as well as colour, and one live region (`#sr`) carries all announcements; (SS-Q04) a keyboard-held paint key is released on blur / hide / screen change; (SS-Q07) debug helpers are inert outside the playing phase; (SS-QA-03) toggling an accessory off un-completes the step; (SS-QA-05) a save written in another tab is adopted (highest `rev` wins) without a reload.

## Edge cases & error states

- Pointer cancelled mid-stroke, leaving mid-stroke (`show()` ends the stroke), tab hidden mid-run (audio suspends, RAF pauses itself).
- Two fast taps on Next; Next during the reveal (ignored: only while `phase === "playing"`).
- Changing the colour after a step is done recolours the paint in place (the match is judged on the final colour).
- Storage full / blocked / corrupt: fall back to in-memory defaults.
- Rotating the phone mid-step (the stage re-fits, paint canvases keep their pixels).
- Locked item tapped with no coins; unlocking the item currently selected.
- Many stickers (capped at 14, oldest dropped).

## Out of scope

- Real-money purchases, ads, accounts, multiplayer, cloud saves.
- Hair/dress changing, a second princess, a gallery of past photos (stored `looks` keeps only the last 6 summaries for a future gallery).
- Haptics, voice-over recordings, bundled audio or image files.

## Non-functional requirements

- **Accuracy:** progress = mean saturation over the region's cells (each cell saturates at `NEED` = 0.55, so it is not a count of "touched" cells); completion at ≥ 80% mean saturation; star/score formula in `index.html` → `computeResult` (stars = 1, +1 if ≥ 6 steps done or ≥ 2 matches, +1 if ≥ 3 matches and ≥ 6 steps; score = 100·stars + 40·matches + 10·steps).
- **Risk/Security:** only `textContent` / `createElementNS` / `setAttribute` write dynamic values (no `innerHTML`); the only external navigation is the relative hub link; stored data is allow-listed field by field; no network.
- **Compliance:** no personal data collected or stored (coins/unlocks/sound/last 6 look summaries only, on-device).
- **Quality:** palette + type from CSS custom properties at the top of the stylesheet; one screen chokepoint `show()` tears down modals/timers/strokes; functional timing in JS, decoration in CSS (reduced-motion safe); no per-frame DOM churn on the hot path (RAF loop only blinks, twinkles, moves the tool and draws particles). Memory: paint canvases are bbox-sized (≈ 0.5 MB total).

## Tech Lead feasibility

- **Verdict:** **PROCEED_WITH_NOTES** — (1) one large inline file (~307 KB / ~5.0k lines: ~40 KB CSS, ~126 KB JS, ~122 KB of compact, `prettier-ignore`d static SVG art) is within the 16 MB artifact norm and keeps the "single static page" contract; (2) Canvas `filter` for soft mask edges is not in older Safari, so the mask falls back to the `shadowBlur` trick (feature-detected); (3) the camera uses CSS transforms on the stage, so pointer mapping uses `getBoundingClientRect()` of the transformed element rather than layout coordinates; (4) keep the Start button free of transform animations (a scaling pulse made it "unstable" for Playwright clicks — LEARNINGS candidate).

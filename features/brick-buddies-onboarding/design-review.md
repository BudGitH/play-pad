# Design Review: Brick Buddies onboarding

> **Phase 1b record.** Product-owner-directed usability fix to an existing screen: the direction was fixed by the brief (3-4 picture steps, a "?" button, a prompt that points at the control), so the four-option `mockups.html` round is replaced by the honest before / after screenshot loop (logged in `docs/DECISIONS.md`).

**Feature:** Brick Buddies onboarding
**Ticket:** PLAY-009 (follow-up)
**Date:** 2026-11-22
**Path:** full, with the mockup round replaced by before / after screenshots

---

## 1. The problem, judged as a child (before)

Screenshots: `screens/before-1-title-*.jpg`, `screens/before-2-first-play-*.jpg` (390x844 and 1280x800).

- The title is three sentences plus a three-row text list plus a keyboard / touch hint; the child has to read to start.
- Seven seconds after Start the screen shows: a six-row checklist (with a paragraph tip under it), a speech toast, coin / house / star chips, an unlabelled eight-slot hotbar, Build and Items buttons, a Look hand, and four pads. Nothing says which one to touch.
- The first goal is a hut of about 33 precisely placed blocks (roof, walls, 18 back-wall tiles) before any reward. The child cannot reach the first win by trial and error.

## 2. What changed (after)

Screenshots: `screens/after-1..6-*-phone.jpg` and `-desktop.jpg`.

| Step | After                                                                                                                                                                              |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Title: name, one short line, **Start building**, **? How to play**, **Sound**.                                                                                                     |
| 2    | First Start: **How to play**, four picture cards (Pip wants a room / walk / pick a block and place it / tick every box) + one big **Let's go!**; X and Esc also close it.          |
| 3    | HUD: only back, housed count, **?** and menu on top; the request card is a header + one **coach line** (icon + at most 28 characters) + three picture ticks (bed, torch, door).    |
| 4    | The coach walks the child: Walk to the hut (edge label, pad ringed) -> Pick the bed (slot ringed, spot already glowing) -> Tap the glowing spot (pulsing outline, bouncing arrow). |
| 5    | A pre-built hut means three jobs, not thirty-three. Tapping either half of the glow places the item. The door goes last: it is the moment Pip moves in.                            |
| 6    | After the first move-in the coin / star chips, Items and Look appear; the next request gets the plain coach ("Add a furnace", "Open Items", ...).                                  |

## 3. Design-system check (`docs/DESIGN-SYSTEM.md`)

- **Tokens only:** the coach uses `--md-sys-color-tertiary-container` / `on-tertiary-container` (the card's existing gold accent), the cards `surface-container-high`, the how-to badges `primary-container`. The only raw colours are the in-canvas glow / arrow (the game's gold `#ffd36b` / `#ffe08a`, as in its other canvas overlays) and the "done" green already used by the checklist ticks.
- **States:** the `?` chip, **Let's go!**, close X and every control keep default / hover / focus / pressed (shared chip and `.btn` classes); the pulse is paired with a text line and an arrow (never colour alone); with `prefers-reduced-motion` the ring is steady and the arrow does not bob.
- **Touch targets:** `?` 48x48, **Let's go!** 52px tall, close X 48x48, hotbar slots unchanged (48).
- **Accessibility floor:** the how-to is a modal `role=dialog` (focus in, Esc, Tab trapped, focus back to the game); the coach line is a polite live region; contrast of coach text is about 7:1; captions are real text.

## 4. Persona reaction (from the screenshots; see `product-validation.md`)

- **Priya & kid:** the picture cards read without reading; the ringed slot and the glowing spot make "what next" unmissable.
- **Maya:** one tap on **Let's go!**, then one hand is enough.
- **Sam:** modal behaves; the coach tells keyboard players the key (`Pick the bed (5)`, `Press F on the glow`).

## 5. Decision

- **Chosen:** the single direction in the brief, implemented as above.
- **Decided by:** owner brief (2026-11-22); no alternatives generated (recorded in `docs/DECISIONS.md`).
- **Rationale:** the brief fixed the shape; the open risk was execution, which the screenshot loop and the probe's four-viewport overlap checks address.

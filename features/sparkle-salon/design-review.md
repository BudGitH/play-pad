# Design Review: Sparkle Salon

> **Phase 1b output — full design path.** The owner's reference image _is_ the chosen design direction, so no 4-option `mockups.html` was produced (the workflow's "headless: the mock-ups put the auto-decision on record" step is replaced by the owner's own decision). Roles are the PM / UX / Tech Lead / personas from `docs/PRODUCT-PANEL.md`; visual rules from `docs/DESIGN-SYSTEM.md`.

**Feature:** Sparkle Salon
**Ticket:** PLAY-008
**Date:** 2026-11-22
**Status:** CHOSEN — owner's reference screenshot (a portrait, close-up chibi princess make-up screen), no alternatives requested ("I do not accept less" than design fidelity)

---

## 1. Diverge — owner reference instead of 4 mock-ups

The reference (the owner's source material, kept out of the repo) shows, in order of visual weight:

| #   | Element in the reference                                                                                                                                                                                                                        | How Sparkle Salon reproduces it (original art, nothing copied)                                                                                                                                                                                                                                      |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | A close-up chibi/anime princess bust fills the screen; very large glossy eyes with layered highlights and lashes, tiny nose, glossy lips, pale shaded skin                                                                                      | Layered inline SVG (≈ 122 KB, stored compact behind `prettier-ignore`; the page is ~307 KB in all): gradient irises with 3 highlights + sparkle + lower glint, thick upper lash line with a wing, double-eyelid crease, individually styled lashes, glossy two-tone lips, soft rim/forehead shading |
| 2   | Voluminous golden hair: high ponytail tuft, swept bangs with an orange cel outline, gradient shading, highlight strands                                                                                                                         | Back hair (depth shading, tail) + front horseshoe (crown, bang flap, face-framing locks), crisp orange outlines, glossy swoosh highlights, fine pale strands                                                                                                                                        |
| 3   | A small silver/pearl tiara, a pearl choker, a butterfly pendant chain, an off-shoulder lilac sparkly dress with a fluffy white fur trim                                                                                                         | Pearl-arch tiara (default look), pearl strand + chain + butterfly pendant, lilac gradient dress with sparkles and a scalloped fur trim                                                                                                                                                              |
| 4   | Soft lilac/pink vanity-room backdrop: blurred bokeh, a pillar of marquee bulbs on the left, a pink table bottom-left                                                                                                                            | Blurred SVG wallpaper (gradient sky, darker wall, bulb pillar, table, bokeh, stars) filling the column                                                                                                                                                                                              |
| 5   | HUD: round red/pink exit button top-left; coin pill (gold heart coin + number) top-right                                                                                                                                                        | Round pink back/exit buttons with a hard bottom edge; white coin pill with a gold heart coin                                                                                                                                                                                                        |
| 6   | Tool tray: a pink band with a hot-pink rim; round white buttons with thick coloured rings and a black outline, the active one larger with a purple halo; mini-illustrations (eye with shadow, lens, cheek, lips); a lock badge on premium items | Same tray and circle recipe; every circle shows a small illustration of its content (eye with that lid colour / iris / lashes, blush pan, lips, tiara, earrings, necklace, sticker); lock badge bottom-right; heart badge = the client's pick                                                       |
| 7   | The active tool drawn as an object on the face (a blush brush with a gold ferrule and a heart; a mascara wand with a red heart tube)                                                                                                            | Brush (fluffy head tinted by the chosen colour, gold ferrule, heart), mascara wand + red heart tube, lipstick, sponge, sticker preview — all SVG, tinted by `--tc`                                                                                                                                  |

Deliberate departures (needed for a playable game): a step indicator + step name (top centre), a **Redo / progress ring / Skip-Next** row above the tray, a speech bubble for hints, a camera that zooms to the face area per step, and a client-request card.

## 2. PM brief

The game must read as _the owner's reference, made playable_: a parent glancing at it should see the same polished pastel make-up world. The success metric is the full flow (title → 8 steps → photo) completed by a 7-year-old without reading; the choice must never frustrate (no fail state).

## 3. Design Roundtable — converge

> The owner's reference removes the option space; the roundtable instead resolved the **interaction details** the reference does not show.

| Question                                      | Desirability (UX / persona)                                                                         | Viability (PM)                                       | Feasibility + effort (Tech Lead)                                           | Decision                  |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------- |
| Where does the tool sit relative to a finger? | Touch: tool tip lifted 46 px above the fingertip so the child sees the work; mouse: tip at cursor   | Needed for the "tool follows the finger" requirement | Trivial (offset on touch only)                                             | **Lift on touch**         |
| How big is the target?                        | Per-step camera zoom (eyes 1.3–1.4×, lips 1.75×) makes small lids/lips big enough for 4–6 year olds | Directly serves the baseline gate                    | CSS transform + clamped pan; pointer mapping via `getBoundingClientRect()` | **Camera per step**       |
| How are premium items shown?                  | Lock badge like the reference + a sheet with the cost; never auto-spend                             | Gives coins a purpose                                | Small modal, focus-trapped                                                 | **Badge + confirm sheet** |
| Dirty-face first step vs. clean start         | A "before" face makes rubbing satisfying and teaches the gesture on the easiest target              | Low risk                                             | Smudges are SVG groups with an `hp` value                                  | **Cleanse step first**    |
| Landscape phones                              | Stage left, tools in a vertical column on the right                                                 | Required by the brief                                | CSS-only media query                                                       | **Two-column landscape**  |

## 4. Persona review

- **Priya & kid:** loves that the sponge/brush "is" the finger; asks for bigger tool circles (done: 62 px, active 1.14×) and that a single tap works (done: dab). Would play "one more" to unlock the gold crown.
- **Maya:** one thumb is enough (tray + Next within reach, tool lifted above the thumb); wants a quick run — a full makeover is ~2 minutes and every step can be skipped.
- **Sam:** needs the face to be operable without a pointer (arrow keys + Space on the stage, tray tools as buttons), live announcements for steps/completions, visible focus, and no motion-only information (stars and ✓ are also text/labels).

## 5. Human decision (the real call)

- **Chosen option:** the owner's reference screenshot, implemented with original art as in §1.
- **Mockup file:** none (the reference replaces it).
- **Decided by:** the owner (brief for PLAY-008).
- **Date:** 2026-11-22
- **Rationale:** the owner explicitly demanded fidelity to the reference; inventing alternatives would waste the choice they already made.

## Handoff — chosen design, full states

Phase 2 tests encode these states (see `test-plan.md`):

- **Title:** glam preview (shadow, blush, lips, sapphire eyes, tiara, butterfly necklace), logo, Start, sound toggle, best-score note. Sound on/off icon states.
- **Request card (modal):** client name, look name, 4 colour swatches with names. Focus on _Let's glam!_, Esc = go.
- **Play (per step):** step name + dots (current enlarged, done filled, skipped lilac), bubble hint, tray (selected = large + purple halo, locked = lock badge, client's pick = heart badge, accessory tabs), Redo, progress ring (% then ✓), Skip → Next (glowing) → Photo!, tool cursor, sparkles. Empty/disabled: Redo and Next are always pressable; locked tools open the sheet.
- **Unlock sheet:** can-afford (Unlock / Not now) and cannot-afford (explains the shortfall, OK) variants.
- **Leave sheet:** Keep playing / Leave (hub).
- **Reveal:** white flash, polaroid photo that drops in, three stars (lit/unlit), headline, results card (look, 4 match chips with ✓, coins earned + breakdown, score/best, "New best score!"), actions.
- **Reduced motion:** no breathing/sway/bounce/pulse; stars and states are applied by class (not by a self-ending animation), so everything stays visible.

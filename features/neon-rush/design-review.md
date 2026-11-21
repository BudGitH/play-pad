# Design Review: Neon Rush

> **Lite path taken** (see `requirements.md` → Design routing) — this file records the lite check only; no full roundtable was required.

**Feature:** Neon Rush — 3D endless runner
**Ticket:** PLAY-005
**Date:** 2026-07-12

---

## Lite check against `docs/DESIGN-SYSTEM.md`

- **Chrome (setup / results / shop / HUD):** reuses the Claw Catch MD3 patterns — tokens for all colours/type/shape, `.sel-chip`-family components, `state-layer` links, `.button--filled/--outlined`. No raw values in chrome.
- **Tap targets:** quit + mute follow the documented 48px-hit/36px-visual pattern verbatim (LEARNINGS `tap-target-size` row — 2nd-occurrence ticket honoured).
- **Focus:** all interactive controls keep or restyle `:focus-visible` at ≥ specificity.
- **Reduced motion:** functional timing (countdown, toasts, power-up timers) is JS-driven; CSS animation is decorative only; camera shake is skipped under `prefers-reduced-motion`.
- **Colour not the only signal:** power-up chips carry icon + word, not colour alone; mute state changes glyph + `aria-pressed`, not just tint.
- **In-canvas 3D art** (neon magenta/cyan world) is game art, exempt from MD3 tokens — same ruling as Claw Catch's cabinet (PLAY-003).
- **New pattern introduced:** bottom-centre power-up timer dock + top-centre HUD pill. Consistent with the HUD-pill precedent; candidate for DESIGN-SYSTEM promotion if a future game reuses it.

**Outcome:** PASS — no deviation requiring the full roundtable.

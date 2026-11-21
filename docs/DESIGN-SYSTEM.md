# PlayPad — Design System

> The **visual language** for this product: the look, the design tokens, and the rules for using components. Whenever anyone — human or agent — builds or changes UI, it conforms to this file. Companion to `CODE_QUALITY.md` (which governs the code); this governs **how it looks**.
>
> _Stable. Changes when the visual direction changes, not when code changes._

**Direction:** Material Design 3 (m3.material.io) — bold typography, tonal surfaces, expressive motion, state-rich components
**Provenance:** Source: https://m3.material.io · Mode: fetched · Distilled: 2026-06-21

> **Mode** = `fetched` (distilled from a reference **in our own words** — no copied text, no brand/trademark assets), `synthesized` (from your description), or `default` (a neutral, accessible starter — replace the values when you have a real reference).

---

## Principles

- **Bold, legible hierarchy.** A clear type scale (display → headline → title → body → label) makes the most important thing obvious at a glance; the wordmark carries the brand gradient.
- **Tonal, accessible colour.** Surfaces are built from stepped tonal containers; colour roles (primary, secondary, tertiary, surface, error) come in matched on-/container pairs and always clear WCAG-AA contrast. Colour is never the only signal.
- **Purposeful, expressive motion.** Standard and emphasized easing guide attention; transitions are short and responsive, and everything collapses under prefers-reduced-motion.
- **State-rich, touch-first components.** Every interactive surface shows default, hover, focus, pressed, and disabled via an MD3 state layer; tap targets are at least 48px.
- **Adaptive & accessible by default.** Light and dark themes from the same token names; fluid type; keyboard operability with a visible focus ring; semantic HTML and labels.

## Tokens

> The single source of visual truth. Build UI from these — **never hardcode raw values**. For light/dark, keep the token names and swap the values.

| Group                 | Tokens (CSS custom property → role)                                                                                                                                                                          | Notes                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| color (dark default)  | `--md-sys-color-primary` #ff6b85 / `-on-primary` #5a0017 / `-primary-container` #7d1530 / `-on-primary-container` #ffd9df; matching `secondary` (#e5bdc4), `tertiary` (#f4c26b gold), `error` (#ffb4ab) sets | brand pink → primary, lightened for AA on dark             |
| color surfaces (dark) | `--md-sys-color-surface` #08080c; `-surface-container-lowest/low/ /high/highest` (#040407 → #292935); `-on-surface` #f4f4f7; `-on-surface-variant` #c5c5d0; `-outline` #908f99; `-outline-variant` #44444e   | stepped tonal containers, seeded from the original game    |
| color (light)         | same role names overridden under `@media (prefers-color-scheme: light)` — primary #b5103a on #ffffff, surface #fff8f7, on-surface #201a1b, etc.                                                              | one token name, two themes                                 |
| type                  | `--md-sys-typescale-{display,headline,title,body,label}-{large/small}-{size,line,weight}`; display/headline use `clamp()` to stay fluid                                                                      | system font stack `--md-sys-typeface-plain`                |
| space                 | `--md-sys-spacing-{xs,sm,md,lg,xl,2xl}` = 4 / 8 / 16 / 24 / 32 / 48px                                                                                                                                        | 4dp grid                                                   |
| radius                | `--md-sys-shape-corner-{none,xs,sm,md,lg,xl,full}` = 0 / 4 / 8 / 12 / 16 / 28 / 999px                                                                                                                        | cards use `lg` (16px)                                      |
| elevation             | `--md-sys-elevation-level0..5` (ready-to-use box-shadow recipes)                                                                                                                                             | cards rest at level1, hover level3                         |
| motion                | easing `-standard` cubic-bezier(.2,0,0,1), `-emphasized` cubic-bezier(.2,.9,.25,1); durations `-short1..4` (50–200ms), `-medium1/2` (250/300ms), `-long1/2` (450/500ms)                                      | emphasized reuses the original game's easing               |
| state                 | `--md-sys-state-{hover,focus,pressed,dragged}-opacity` = .08 / .10 / .10 / .16                                                                                                                               | applied via the `.state-layer::before` overlay in base.css |
| breakpoints           | compact < 600px · medium 600–839px · expanded ≥ 840px                                                                                                                                                        | the game rail uses an auto-fit/scroll-snap layout          |

The canonical, copy-paste source of truth is `styles/tokens.css` (light + dark); components must reference `--md-sys-*` variables, never raw values.

<!-- Expected shape (the setup step fills this; if you skipped, neutral accessible defaults are written here):
| Group | Token | Value | Use |
|---|---|---|---|
| color | primary / surface / on-surface / success / error / warning | … | actions / backgrounds / text / states |
| type  | display / heading / body / caption (family·size·weight·line) | … | hierarchy |
| space | xs sm md lg xl (e.g. 4·8·16·24·40) | … | padding / gaps |
| radius| sm md lg full | … | corners |
| elevation | sm md lg (shadows) | … | depth |
| motion | fast normal slow + easing | … | transitions |
| breakpoints | mobile tablet desktop | … | responsive |
-->

## Component guidelines

Build every component with these states **where they apply**: `default · hover · focus · active · disabled · loading · empty · error`. Each state must be visible and use a token (not a raw value).

**Do**

- Use semantic tokens (`color.primary`, `space.md`) — never raw hex/px.
- Give every interactive element a **visible focus** state (keyboard users).
- Show empty, loading, and error states — not just the happy path.

**Don't**

- Invent spacing/colours outside the scale.
- Signal state with colour alone (pair with icon/text).
- Use a primary/destructive style for a secondary action.

## Accessibility floor (non-negotiable)

- Text contrast ≥ **4.5:1** (≥ 3:1 for large text); never colour-only signals.
- Fully **keyboard operable**; visible focus; logical tab order.
- Semantic HTML + labels/alt text; respects reduced-motion.

## For the agent building UI

Read this file before any UI work. Map every value to a token here; implement all relevant states; meet the accessibility floor. If you need something not covered, **add it to the tokens here** (don't one-off it) and note the choice in `docs/DECISIONS.md`.

---

_Last reviewed: 2026-06-21 by @BudGitH_

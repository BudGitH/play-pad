# PLAY-006 — Hub design spec (front door)

**Owner:** Senior UX/UI designer (hub + shared styles) · **Status:** DECIDED, ready to build
**Scope:** `index.html`, `games.js`, `styles/tokens.css`, `styles/base.css`, new `scripts/theme.js`, `manifest.webmanifest`.
**Reference mockup:** `features/playpad-revamp/mockup-hub.html`. Serve the repo (`node tools/serve.mjs 5611`) and open `/features/playpad-revamp/mockup-hub.html`. It links the real tokens/base, and its inline CSS/JS is the reference build. It is a reference only: `features/*` is already 302'd by `_redirects`.
Screenshots: `…/scratchpad/design-hub/` (`hub-*` = today, `mock-*` = proposed; scratchpad = `/tmp/claude-0/-home-user-play-pad/d673e733-2e20-53e5-baf1-01b45976e8f0/scratchpad`).

---

## 1. Findings (audit of today's hub, 2026-11-21)

| #   | Finding                                                                                                                                                                                                                                                                                                 | Evidence                                                    | Severity |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | -------- |
| F1  | **One game visible on a phone.** At 360/390 wide, the carousel shows 1 card fully, with a 30px peek of the next one. 4 of 5 games are off-screen and you have to swipe sideways to find them. Maya and Priya cannot see the choice at a glance.                                                                                                                   | `hub-dark-390x844.png`, `hub-*-360x740.png` (fullyVisible=1) | HIGH     |
| F2  | **Dead space on desktop.** The page ends at y≈656, so 1920×1080 has about 420px of empty canvas and 1366×800 about 140px. Only 3 or 4 of 5 cards show, and the last one is cut in half by the rail edge.                                                                                                          | `hub-light-1920x1080.png`, `hub-dark-1366x800.png`          | HIGH     |
| F3  | **Rail arrows cover cards.** The disabled "previous" arrow (38% opacity) sits on the Colour Rush tile at 768 and 1366. "Next" covers the 4th card.                                                                                                                                                         | `hub-light-768x1024.png`, `hub-dark-1366x800.png`           | MED      |
| F4  | **Keyboard focus lands on a hidden card.** Tabbing to card 4 at 1366 leaves about 80% of it outside the rail, with the focus ring clipped. The arrows come *after* every card in tab order, and "previous" is the last stop on the page.                                                                                          | `focus-card4-1366.png`, tab-order trace                     | HIGH (Sam) |
| F5  | **No choosing help.** There is no "solo vs together" filter. The only mode cue is chips ("Multiplayer/Local") and a bare `👥 1`. Descriptions are 3-line paragraphs, and Claw Catch's is truncated ("Beat the cloc…").                                                                                                                  | `hub-dark-1366x800.png`                                     | MED      |
| F6  | **No return or delight hooks.** No featured game, no "jump back in", no best score (Neon Rush already saves `highScore`), no "new" marker, and no entrance motion. Launching a game is a hard cut.                                                                                                                       | all `hub-*`                                                 | MED      |
| F7  | **Header and footer don't line up with the content.** The logo and footer are pinned to the viewport edge, while the content is centred in 1120px. At 1920, the logo sits 400px left of the content.                                                                                                                                      | `hub-light-1920x1080.png`                                   | LOW      |
| F8  | **Wrong browser chrome colour in light mode.** `<meta name="theme-color" content="#08080c">` paints the phone status bar black over a light page. There is no manual light/dark choice.                                                                                                                                   | `index.html` head; `hub-light-390x844.png`                  | LOW      |
| F9  | **Semantics.** There is no skip link and no list semantics for the catalog. The count isn't live. Every card's name is "Play X", and the tags/players aren't described.                                                                                                                                               | DOM audit                                                   | MED (Sam) |

What works and stays: no console errors, no horizontal overflow at any viewport, AA colour, `safeHref`/`esc` escaping, cards rendered from the registry, and a visible focus ring.

## 2. Decisions

**D1 — Drop the carousel for a responsive grid.** With 5–12 games, a grid shows everything at once. A carousel hides most games and causes F1–F4. Remove `.rail*` from `index.html` and `base.css`; no game uses it (grep confirmed: Claw Catch's `railY` is a canvas variable).

**D2 — Layout per breakpoint** (content column `max-width: 1200px`, centred, gutter `clamp(16px, 4vw, 32px)`; app bar and footer use the same column):

| Breakpoint             | Featured hero                                                    | Catalog                                                          |
| ---------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| compact < 600          | Horizontal: 96px tile, title and tagline; full-width row of [Play now ▸][🎲 Surprise me] | **1-column list cards** (80px tile · title · 2-line tagline · badges · round ▸). About 2.5 cards plus the hero above the fold at 390×844 (was 1) |
| medium 600–839         | 200px tile on the left, text and actions on the right                                 | **2-column** vertical cards (120px accent media)                 |
| expanded ≥ 840         | Split card: accent panel 5fr (104px emoji) and body 7fr with the full description, badges and actions | **3-column** vertical cards, 20px gap                            |

**D3 — Featured hero ("one-tap start").** If the player has a last-played game, the eyebrow reads **"Jump back in"** and shows that game. Otherwise it reads **"Game of the day"**: `live[floor(Date.now()/86400000) % live.length]`, which is deterministic and needs no server. Primary action: **Play now**. Secondary: **🎲 Surprise me** opens a random live game other than the last-played one. This is our quick-play: one tap from page load. It replaces the IDEAS "Quick play" button on each card. Skipping a game's own setup screen stays with the game owners (see §4 contract).

**D4 — Filter chips: `All n` · `Solo n` · `Play together n`.** Single-select toggle buttons (`aria-pressed`), with the count inside each chip. The mode comes from `players` (`"1"` → Solo, anything else → Play together), so the registry needs no new field. The chosen filter is remembered. When a filter matches nothing: "No games here yet — try "All"." Search is rejected: with fewer than 12 games, chips are faster.

**D5 — Badges on cards (from localStorage, fail-soft).**
- **Mode badge** on every card: `Solo` or `2–4 players`. This replaces `👥 1` and the Multiplayer/Local chips. Genre chips are dropped from cards; the tagline carries the feel.
- **🏆 Best 12,480** when the registry entry has a `best` descriptor and the stored value is a finite number from 1 to 1e9. Neon Rush works today with no game change.
- **New** when `added` is within 30 days, the game has never been launched from the hub, and there is no best score.

**D6 — Theme toggle.** A 48px icon button sits at the right of the app bar. It shows the *target* icon (☀ in dark, ☾ in light), with `aria-label="Switch to light|dark theme"`. The first press stores an explicit choice in `playpad.theme`; with nothing stored, the page follows the system. There is no third "system" state, which is rejected as confusing for a casual audience. Clearing storage resets it. A shared `scripts/theme.js` applies the choice before first paint, so there is no flash.

**D7 — Motion (all inside `@media (prefers-reduced-motion: no-preference)`).**
- **Page load:** the intro, hero and each card *rise* (opacity 0 → 1, translateY 12px → 0) over 300ms with emphasized-decelerate, staggered `--i × 40ms` (only the first 8 items are staggered).
- **Hero emoji:** a single *pop* (scale .6 → 1.06 → 1, small rotation, 450ms).
- **Card hover:** lift −4px with elevation level3; the tile emoji scales 1.12 and rotates −6°. **Press:** scale .97.
- **Launch:** a cross-document View Transition, `@view-transition { navigation: auto }` with a 200ms root cross-fade, in `base.css` so hub and games both opt in. Unsupported browsers ignore it. Navigation is never delayed by JS.

**D8 — Accessibility.** A "Skip to games" link is the first tab stop. `<ul role="list">` holds the cards. Each card is one `<a>` with `aria-label="Play {title}"` and `aria-describedby` pointing at its tagline and badges. A visually-hidden `aria-live="polite"` region says "Showing 3 solo games". Set `html { scroll-padding-top: 80px }` so a focused element never hides under the sticky bar. Tab order: skip → theme → Play now → Surprise → chips → cards → footer.

**D9 — Copy.**
- H1 "Press play." with sub "Quick mini-games. No install, no signup." (one line at 360).
- Section H2 "All games".
- Footer: "PlayPad · built with Material Design 3. New games land here regularly."
- The visible "N games" count is removed because the chips carry the counts.

## 3. Visual spec

**Tokens to add (`tokens.css`, theme-independent, in `:root`):**

| Token                    | Value                     | Use                                   |
| ------------------------ | ------------------------- | ------------------------------------- |
| `--pp-layout-max`        | `1200px`                  | content column (bar, main, footer)    |
| `--pp-gutter`            | `clamp(16px, 4vw, 32px)`  | side padding (combined with `max()` and the safe-area insets) |
| `--pp-card-media-height` | `120px`                   | vertical card accent band             |
| `--pp-list-tile`         | `80px`                    | compact list tile                     |
| `--pp-hit-min`           | `48px`                    | minimum tap target                    |
| `--pp-stagger-step`      | `40ms`                    | entrance stagger                      |

**Theme restructure (`tokens.css`; values unchanged):** wrap the existing light block's selector as `@media (prefers-color-scheme: light) { :root:not([data-theme="dark"]) { … } }`. Then add `:root[data-theme="light"] { …same light values…; color-scheme: light }` and `:root[data-theme="dark"] { …the :root dark colour roles…; color-scheme: dark }`. The `data-theme="dark"` block is required for a light-system user who picks dark.

**Contrast (computed):**

| Pair                     | Dark / Light  |
| ------------------------ | ------------- |
| selected chip            | 7.6 / 13.3    |
| mode badge               | 8.4 / 7.2     |
| best badge               | 7.3 / 13.2    |
| New badge                | 5.3 / 6.8     |
| play pill                | 8.0 / 13.4    |
| eyebrow                  | 6.1 / 5.5     |
| muted text on card       | 10.6 / 8.1    |
| chip outline (3:1 UI)    | 6.3 / 4.3     |

All meet AA.

**Components** (new class names only; existing `.card/.chip/.button/.icon-button` are untouched):
- **App bar:** sticky, `min-height 64px`, inner `.wrap`. Logo 36px (r 9px), `title-large brand-wordmark`, spacer, theme `.icon-button` 48×48. When scrolled: elevation level2 (no border).
- **Hero `.hero-card`:** `surface-container-high`, radius `xl` (28), elevation 1.
  - Compact: padding 16, grid `96px 1fr`, tile 96×96 r `lg` with 56px emoji, actions full row (gap 8, Play now `flex:1`, `nowrap`).
  - Medium: tile 200×168, padding 24.
  - Expanded: padding 0, panel min-height 184, body padding 24/32, actions padding 16/32/24.
  - Tile background: the existing accent gradient recipe (two radials + `--card-accent`).
  - Eyebrow: `label-medium`, uppercase, `primary`. Title: `headline-small`. Long description (≥840 only): `body-large`, muted, 52ch max.
  - Buttons: existing `.button--filled` with ▸ icon and the label "Play now" (accessible name "Play {title} now"), and `.button--tonal` "🎲 Surprise me". Both are 48px tall.
- **Filter chip `.chip-filter`** (proposed for `base.css`, reusable by games):
  - Size: 40px visual height; a `::after` with `inset:-4px 0` gives a 48px hit area. Padding 0 16, radius `sm` (8), gap 8 between chips.
  - Off: transparent, 1px `outline`, `on-surface-variant`, `label-large`.
  - On: `secondary-container` / `on-secondary-container`, no border, leading 18px ✓ (left padding 10).
  - Count: same colour, weight 500, opacity .8.
  - Uses `.state-layer` for hover/focus/press.
- **Game card** (`.card.card--interactive.state-layer.game-card`, one `<a>`):
  - Compact: grid `80px 1fr auto`, gap 16, padding 12, `min-height 104px`. Tile 80×80 r `md` with 44px emoji. Title 18px/700. Tagline `body-medium` muted, 2-line clamp. Trailing 40px round play glyph (`primary-container`), `aria-hidden`.
  - ≥600: grid rows `auto 1fr`, media band 120px with 72px emoji, body padding 16/16/0, gap 6. Title `title-large`. The play pill (40px tall, padding 0 16 0 12, "▸ Play", 700) sits end-aligned with margin 12/16/16.
- **Badge `.badge`:** height 24, padding 0 8, radius `xs`, `label-medium`.
  - Default: `surface-container-highest` / `on-surface-variant`.
  - `--best`: `tertiary-container` / `on-tertiary-container`.
  - `--new`: `primary` / `on-primary`.
- **Card states:**
  - Hover: −4px, level3, emoji transform.
  - Focus: the existing 3px `primary` ring.
  - Pressed: scale .97.
  - "Soon": `aria-disabled`, opacity .62, no play glyph, not a link.
  - Empty grid: centred `body-large` muted text.
- **Footer:** inside `.wrap`, a 1px `outline-variant` top border, padding 24 plus the safe area.
- **`<meta name="theme-color">`:** two tags with media (light `#fff8f7`, dark `#08080c`). `theme.js` rewrites both when the user toggles.

## 4. Implementation notes

**Files:**
- `index.html`: rewrite the markup, the page `<style>` and the inline script. Keep `esc`/`safeHref` and pass every registry string through them, including `tagline` and `accent` (`accent` should also be validated with `/^#[0-9a-f]{3,8}$/i`, else fall back to `primary`).
- `styles/tokens.css`: the new tokens and the theme restructure.
- `styles/base.css`: add `.chip-filter`, `.badge*`, `.skip-link` and `@view-transition`; delete `.rail*`.
- **New** `scripts/theme.js`: a classic script loaded in `<head>`, same-origin, so it passes the CSP. It applies `data-theme` and exports `window.PlayPadTheme.toggle()`.
- `games.js`: document the new fields in its header comment.
- `manifest.webmanifest`: set `background_color`/`theme_color` to `#08080c` (unchanged) and add `"id": "./"`.

**`games.js` schema: optional, backward compatible.** Adding a game is still one object, and an entry without these fields renders correctly.
- `tagline` (string, ≤ 40 chars). Card copy. Falls back to `description` under the 2-line clamp.
- `added` (ISO date). Drives the "New" badge.
- `best` (`{ key, field, label? }`). The localStorage key and numeric field holding the game's best. Neon Rush: `{ key: "playpad.neonRush.v1", field: "highScore", label: "Best" }`.
- Suggested taglines:
  - Colour Rush: "Tap your colour before it vanishes."
  - Snap: "Spot the match — slap first!"
  - Claw Catch: "Swing, drop and snag the rare prize."
  - Super Decoder: "Crack the secret colour code."
  - Neon Rush: "Dash and dodge through a neon city."

**Hub storage:**
- Key `playpad.hub.v1` = `{ v:1, last:id|null, played:{id:epochMs}, filter:"all"|"solo"|"together" }`. Written on any card, hero or Surprise click.
- On read, treat it as untrusted (LEARNINGS 2026-07-12): require `v===1`, drop any `last` or filter value not in the known set, and wrap every access in try/catch. Private mode means in-memory only.
- Best-score reads use `Math.floor(Number(x))` with a finite check, clamp to 1e9, and hide the badge if the value is ≤ 0.

**Contract offered to game owners (optional, not a hub dependency):**
1. Add `<script src="../../scripts/theme.js"></script>` in `<head>` to honour the hub's theme choice. Games that are always dark (Neon Rush) skip this.
2. A game that later persists a best score just adds `best` to its registry entry.
3. If a game supports skipping setup, it may read `?quick=1`. The hub's Surprise/Play now can append it later. **Not built now.**

**Risks for game pages sharing `tokens.css`/`base.css` (FLAG):**
- **R1 (low):** the `:not([data-theme="dark"])` guard changes nothing unless a page sets `data-theme`. Games without `theme.js` keep following the system exactly as today.
- **R2 (low–med):** `@view-transition` in `base.css` opts every game into a 200ms cross-fade on navigation. It is harmless for canvas/WebGL (snapshot cross-fade only), and inputs are blocked for about 200ms during the fade. Keep it in the reduced-motion `no-preference` guard. If any game owner objects, move it to the hub `<style>` (the hub → game fade then degrades to a cut).
- **R3 (none):** deleting `.rail*` is safe (no game uses it). The new class names don't collide: `grep -n "badge\|chip-filter\|skip-link" games/*/index.html` should be empty before merge. Game owners may already define `.badge` locally, so check and namespace as `.pp-badge` if it collides.
- **R4:** never change existing `.chip`, `.card`, `.button` or `.icon-button` rules. Every game uses them.

**Smoke test** (`tests/smoke.spec.mjs`): it uses `getByRole("heading", { name: game.title })`. Cards no longer use `<h3>` (a heading inside a link is noisy for screen readers), so update the test to `getByRole("link", { name: "Play " + title })`. Alternatively, keep an `<h3 class="game-card__title">` inside the link; either is acceptable, but the test and the markup must agree.

## 5. Acceptance checks (automatable with Playwright)

1. At 360×740, 390×844, 768×1024, 1366×800 and 1920×1080, in light and dark: no page or console errors, and `scrollWidth === innerWidth`.
2. Grid columns, read from the `.game-grid` computed `grid-template-columns` count: 1 at 360/390, 2 at 768, 3 at 1366/1920. No element with class `rail` exists.
3. At 390×844, the hero "Play now" and at least 2 game cards are fully inside the viewport. At 1366×800, every card title in the first row is visible without scrolling.
4. Every live registry entry renders exactly one link named `Play {title}`, and its `href` equals `safeHref(path)`.
5. Clicking "Solo" leaves only `players === "1"` games, sets `aria-pressed="true"` on that chip only, and the live region reads "Showing 3 solo games". After a reload the filter persists. With localStorage throwing, the page still renders "All".
6. The theme button flips `html[data-theme]`, its `aria-label` and both `theme-color` metas. The choice survives a reload, and the first paint after reload is already in the chosen theme (no flash: check `data-theme` before `DOMContentLoaded`).
7. Seeding `playpad.neonRush.v1 = {v:1,highScore:12480}` shows "🏆 Best 12,480" on Neon Rush. `"1e999"`, `-5`, `"abc"` or malformed JSON show no badge and cause no error.
8. After clicking a card, the hero eyebrow reads "Jump back in" with that game. On a fresh profile it reads "Game of the day". "Surprise me" navigates to a live game other than the last-played one.
9. Keyboard order: Skip → Theme → Play now → Surprise me → All → Solo → Play together → cards in registry order → footer link. Every focused element is fully visible, and no rail arrows exist.
10. Every interactive element has a box ≥ 48×48, except the card links (larger) and the filter chips (40 visual, 48 hit via `::after`). Under `reducedMotion: "reduce"`, no element has a running animation (`document.getAnimations().length === 0` after load).
11. A registry entry with only the old fields (no tagline/best/added) and one with `status:"soon"` both render without errors. The soon card is not a link.
12. `npm run check`, `npm run secrets` and `npm run smoke` pass, and `_headers` CSP is unchanged.

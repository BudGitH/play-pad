# PlayPad — Architecture (Living Map)

> This is the **map**, not the territory. It is an overview that **links to code** — never a copy of it.
> Update it whenever structure, the data model, or a key flow changes. Prune stale entries. **Target < ~150 lines.**
> Per-game detail lives in each game's own header comment (and `games/sunset-stride/CLAUDE.md`); read that, not this file.

**Stack:** Vanilla HTML/CSS/JS, no build step (static; runs from file:// or any static host)

_Last updated: 2026-11-21 (PLAY-007: Neon Rush → Sunset Stride; PLAY-006 revamp before it: new hub, light/dark toggle, caching policy)_

---

## Top-level structure

> What lives where, one line each.

- [`index.html`](../index.html) — the **hub**, rendered from the registry: sticky app bar + light/dark toggle, a featured hero ("Jump back in" = last game launched, else a deterministic "Game of the day"; **Play now** + **Surprise me**), filter chips (All / Solo / Play together), a responsive card grid (1 / 2 / 3 columns), New / Best badges, a skip link. Its layout CSS and script are inline (hub-only).
- [`games.js`](../games.js) — the **game registry** (`window.GAMES`), the single source of truth for the catalog. Header comment documents every field.
- [`scripts/theme.js`](../scripts/theme.js) — applies `<html data-theme>` before first paint, keeps the `theme-color` metas in step, exposes `window.PlayPadTheme { current, toggle }`. Games opt in with one `<script src="../../scripts/theme.js">` in `<head>` (all five do; Sunset Stride's 3D stage is always bright, only its setup / results / shop chrome follows the theme).
- [`styles/tokens.css`](../styles/tokens.css) — MD3 tokens (colour roles light + dark, type, shape, elevation, motion, `--pp-*` hub layout). Light values exist **twice** (system-light media query + `[data-theme="light"]`): edit both.
- [`styles/base.css`](../styles/base.css) — reset + shared components shared by every page: card, chip, `.chip-filter`, `.badge`, `.skip-link`, button, state layers, focus ring. Hub-only layout stays in `index.html`.
- `games/<slug>/index.html` — one self-contained game per folder: `colour-rush`, `snap`, `claw-catch`, `super-decoder`, `sunset-stride`. Sunset Stride also has `three.min.js`, `GLTFLoader.js`, `assets/` and a local `CLAUDE.md` (its constraints contract).
- [`tests/`](../tests/) — `smoke.spec.mjs` (Playwright), `round-drivers.mjs` (one entry per game: how to start a round + what "in round" means). Run with `npm run smoke`; helper server is [`tools/serve.mjs`](../tools/serve.mjs).
- `manifest.webmanifest` · `icons/` — PWA manifest + SVG favicon/app icon. `404.html` · [`_headers`](../_headers) · [`_redirects`](../_redirects) — not-found page, Cloudflare headers (CSP, caching), dev-file redirects.
- `Old prototype/index.html` — **untouched reference** (the original Colour Rush); never linked or shipped.
- `docs/` · `features/` — the project brain + per-feature records (revamp: `features/playpad-revamp/`).

## Data model

> The only shared "model" is the registry array. Everything else is per-game state, local to the page.

- **`window.GAMES`** — array of `{ id, title, description, tags[], path, accent, icon, players, status }`; `status` is `"live" | "soon"`; `players: "1"` = Solo, anything else = play together (drives the filter + mode badge). **Optional** (all fall back sensibly): `tagline` (card copy), `added` (ISO date → "New" badge for 30 days), `best { key, field, label? }` (localStorage key + a **top-level numeric** field → "Best n" badge). A game that keeps a best per mode also saves a top-level `bestOverall` for the hub.
- **localStorage** — game data only, no PII; every reader validates/whitelists and is wrapped in try/catch (private mode / corrupt data → defaults). Keys:
  - `playpad.theme` (`"light"|"dark"`, absent = follow the system) — [`scripts/theme.js`](../scripts/theme.js)
  - `playpad.hub.v1` `{v,last,played{},filter}` — hub, in [`index.html`](../index.html)
  - `playpad.clawCatch.v1` `{v,best{"<secs>-<difficulty>"},bestOverall,sound}`
  - `playpad.superDecoder.v1` `{v,best{quick,easy,normal,hard},bestOverall}`
  - `playpad.sunsetStride.v1` `{v,coins,unlocked[],equipped,highScore,muted}` (imports coins / best / mute once from the pre-rename `playpad.neonRush.v1`)
  - Colour Rush and Snap persist nothing.
- **Per-game state** (in-memory) — see each file's header comment: Colour Rush / Snap use a round state machine on `performance.now()` deadlines; Claw Catch has a `Phase` machine + prize pile in tray-normalised coordinates; Super Decoder has `session` / `code` + `Phase`; Sunset Stride has a pooled world + fixed-timestep sim (`SaveManager` is its only gateway to storage).
- **Test hooks** — `window.__claw`, `__decoder`, `__stride` mirror state for the smoke test and QA. They ship in production (local-only cheat surface, no backend).

## Key modules / components

| Module        | Responsibility                                                                                                                                                                                                                                                                                                                                                                         | Location                                                                                                                                |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Hub           | Render hero / chips / grid from `window.GAMES` (`esc` + `safeHref` + accent validation on every registry string), badges from storage, `launchHref()` (adds `index.html` under `file://`), `pageshow` refresh after bfcache, theme button                                                                                                                                              | [index.html](../index.html)                                                                                                             |
| Registry      | The list of games; add one object to add a game                                                                                                                                                                                                                                                                                                                                        | [games.js](../games.js)                                                                                                                 |
| Theme         | Pre-paint theme, toggle API, `playpad-themechange` event                                                                                                                                                                                                                                                                                                                               | [scripts/theme.js](../scripts/theme.js)                                                                                                 |
| Design system | Tokens + shared components (see Top-level structure)                                                                                                                                                                                                                                                                                                                                   | [styles/tokens.css](../styles/tokens.css) · [styles/base.css](../styles/base.css)                                                       |
| Colour Rush   | Party reflex game, 2–4 players on one screen. Setup (avatar + colour identity, shape glyph per colour) → 3-2-1 → RAF loop → results; two-tap quit + Esc; pause on hidden; rotation-safe spawns                                                                                                                                                                                         | [games/colour-rush/index.html](../games/colour-rush/index.html)                                                                         |
| Snap          | Party card-match game, 2–4 players on edge buttons. RAF-deadline state machine; 3-2-1 only in round 1 and after a pause, later rounds wait a random shuffle delay; Gentle mode; keys A/L/Q/P; "SNAP!" + reaction time                                                                                                                                                                  | [games/snap/index.html](../games/snap/index.html)                                                                                       |
| Claw Catch    | Solo, Canvas claw machine: cabinet, heaped pile with tumble, hopper refills, aim line, skill-based `catchOdds`, streak multiplier, golden prize (+time), two-prize bonus, saved best; `layout()` is rotation-safe                                                                                                                                                                      | [games/claw-catch/index.html](../games/claw-catch/index.html)                                                                           |
| Super Decoder | Solo, DOM Mastermind. Pure `scoreGuess`; shape-coded feedback (solid dot / ring / pip, classes `.fb.black` / `.fb.white` kept); board sized from viewport height + landscape two-pane; no start countdown; Quick (1 code) / Easy / Normal / Hard; keyboard focus model; saved best                                                                                                     | [games/super-decoder/index.html](../games/super-decoder/index.html)                                                                     |
| Sunset Stride | Solo, Three.js (r147 vendored) endless runner through a golden-hour town: photo-textured world (procedural fallbacks), skinned GLB runner with an authored slide / stumble pose layer, a dog pack chasing from behind (stumble → caught), side-scrape / close-call / input-buffer mechanics, pooled particles (`FX`: dust, coin sparkles, skid sparks, impact debris) and a fully synthesised Web Audio mix (`AudioManager`), quality tiers, pause on hidden, outfit shop + persistence. Module map in its own contract | [games/sunset-stride/index.html](../games/sunset-stride/index.html) · [games/sunset-stride/CLAUDE.md](../games/sunset-stride/CLAUDE.md) |
| Smoke test    | Hub at 4 viewports, filter chips, theme flip + no flash, reduced motion, every game opens, a round starts in every game on phone + desktop (live counter must advance)                                                                                                                                                                                                                 | [tests/smoke.spec.mjs](../tests/smoke.spec.mjs) · [tests/round-drivers.mjs](../tests/round-drivers.mjs)                                 |
| Deploy        | `_headers` (CSP, caching), `_redirects`; served from the repo root by Cloudflare Pages                                                                                                                                                                                                                                                                                                 | [\_headers](../_headers) · [\_redirects](../_redirects)                                                                                 |

## Main flows

- **Browse → launch:** open the hub → filter (optional) → **Play now** (hero), **Surprise me** (random live game, never the last played) or a card link → `games/<slug>/`. The hub stores the launch in `playpad.hub.v1` (next visit: "Jump back in").
- **Party games (Colour Rush, Snap):** setup has defaults pre-selected (2 players) and a sticky Start → countdown → round → results (winner / tie, confetti) → Play again / Change settings / ← PlayPad. ✕ then a second tap (or Esc twice) quits; hiding the tab pauses, resume = 3-2-1.
- **Solo games:** setup → round → results with "New best" when beaten (Claw, Decoder, Stride) → Play again. Claw Catch has a sticky Start bar and a two-tap quit; Sunset Stride pauses when the tab is hidden or the window loses focus (tap to resume, then 3-2-1).
- **Teardown rule:** every cross-screen cleanup (timers, RAF, overlays, `#countdown`) lives inside the game's `show()` chokepoint, never per exit path.
- **Add a game:** append one object to `games.js` (optional `tagline` / `added` / `best`) + create `games/<slug>/index.html` linking `../../styles/tokens.css` + `../../styles/base.css`, with a ← PlayPad back link. **No hub edits.** Optional: `theme.js` opt-in; a one-entry driver in [tests/round-drivers.mjs](../tests/round-drivers.mjs) (otherwise only the "opens without errors" check runs).
- **Build + deploy:** no build step — merging to `main` triggers Cloudflare Pages (Git integration) to publish the repo root.

## Integration points

- **None external at runtime** — no backend, no network. Only storage is the five localStorage keys above.
- **Caching policy ([`_headers`](../_headers)):** every HTML page, `/styles/*`, `/scripts/*` and `/games.js` are `max-age=0, must-revalidate` (filenames are not hashed, and they ship in lock-step; a plain `max-age` gave returning visitors new HTML + old CSS). Sunset Stride's vendored `three.min.js` / `GLTFLoader.js` / `assets/*` cache for 7 days; icons and manifest for 1 day.
- **Three.js (vendored, r147 UMD) + GLTFLoader** — Sunset Stride only; classic same-origin `<script src>` (ES-module builds break under `file://`; a CDN breaks the CSP). Never upgrade past r147 without solving both.
- **Vendored CC0 assets** — Sunset Stride `assets/` (Quaternius runner + dog GLBs, six outfit palettes, ambientCG photo textures, a chill lo-fi loop; every SFX and every particle is generated in code; see `assets/CREDITS.md`). Loaded via `fetch` / `Image` → unavailable under pure `file://`, so a double-clicked file runs on procedural textures + primitive models + synth SFX (still playable, **no** console errors); everything is full on any http(s) origin.
- **CSP:** `_headers` applies the CSP (`'unsafe-inline'` for the inline script/style; `blob:` in `img-src` + `connect-src` for GLB textures; all else same-origin).
- **Optional browser APIs** (feature-detected, silent no-op if absent): Web Audio, `navigator.vibrate` (party games), `visibilitychange` pause.

---

### How to keep this file healthy

- Add a module row the moment you create a module; delete the row when you delete it.
- If a flow changes, update its bullets in the same change — a stale map is worse than no map.
- If this file passes ~150 lines, you're inlining detail that belongs in code. Consolidate.

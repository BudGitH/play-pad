# Feature: PlayPad launch — catalog hub + MD3 design system + Colour Rush rebuild

> **Phase 1 of the workflow.** Define what "done" means _before_ writing code. A QA agent will hold the implementation to these criteria — vague requirements produce vague QA.
>
> _Note: this is the **inaugural release**, documented as one feature because the hub, the shared design system, the brand assets, and the first game shipped together as v1. Authored alongside the build; accurate to what shipped._

**Status:** IMPLEMENTED — in QA
**Owner:** @BudGitH
**Ticket:** PLAY-001
**Created:** 2026-06-21
**Feature tier:** Prototype

> **Superseded in part by PLAY-006 (see `features/playpad-revamp/`, `design-hub.md`, 2026-11-21).** History below is kept as written. AC-3 (the horizontal scroll-snap row with prev/next arrows) is replaced by a featured hero, filter chips and a responsive 1 / 2 / 3-column grid (no rail exists any more); AC-2's card content changed (tagline, mode badge, Best / New badges); AC-7's "Start enabled only when every player has a colour" no longer blocks a fresh visit (2 players and colours are preselected). Everything else (registry-driven hub, MD3 tokens, brand assets, deploy) still holds.

---

## What & why

- **What:** Turn a single loose prototype into **PlayPad** — a branded, Material Design 3 hub whose front door is a horizontal, scroll-based game selection, plus a shared MD3 design system, a favicon/app icon, and **Colour Rush rebuilt from the ground up** in the new look. Adding future games is a one-line registry change.
- **Why:** People want a quick, no-install micro-break game and there was no tidy front door — just one HTML file opened directly. See `docs/PROJECT.md` and `docs/IDEAS.md` → _Now_.

## Business requirements & success metrics

- **Business outcome:** PlayPad presents a real catalog (≥1 playable game today) behind one cohesive brand, and the architecture makes adding the _next_ game trivial.
- **Success metric:** a visitor can spot and start a game within seconds; the catalog grows with a **one-object** registry edit (no hub changes). (Baseline: 0 — there was no catalog.)
- **Must-have business rules:**
  - The original `Old prototype/index.html` is a **reference only** — never modified or linked as a shipping game.
  - The site runs with **no build step**, from `file://` or any static host.
  - Visual surfaces conform to `docs/DESIGN-SYSTEM.md` (MD3 tokens, no raw values).

## Target personas & success bar

> All five from `docs/PRODUCT-PANEL.md` are in scope — the inaugural release _is_ the whole product surface (browse the hub + play a game + add a game).

- **Personas served:** Maya (Commuter Casual), Dan (Office Micro-breaker), Priya & kid (Sofa Co-op), Sam (Keyboard / AT), You (Builder-Owner).
- **Baseline (hard gate):** each persona can complete their primary goal — start a game fast (Maya/Dan), play together on one screen (Priya & kid), browse+launch via keyboard/AT (Sam), add a game with one registry line (You).
- **Value (hard gate):** the hub+game feel like one cohesive, on-brand product worth returning to; beats "open a raw HTML file".
- **High satisfaction (scored):** the MD3 polish (motion, tonal surfaces, gradient brand) makes it feel like a real little arcade.

## Design routing

- UI surface? **yes** · Reuse-only? **no** (net-new design system + brand) · Tier **Prototype** → **Path: full** (significant net-new user-facing pattern; documented in `design-review.md`). Design debt / deferred patterns logged to `docs/IDEAS.md`.

## Design review

- Full path — see `features/playpad-launch/design-review.md`. Four user-facing decisions (name, theme, rebuild-vs-restyle, selection layout) were taken **interactively by the human** via the setup interview.

## User-visible behaviour

Open the site → **PlayPad** app bar (dot logo + gradient wordmark) over a hero and a **horizontal row of game cards**. Each live card shows an accent media tile + icon, title, blurb, tags, player count, and a Play affordance; activating it opens the game. A dimmed "More to come" card signals growth. **Colour Rush**: pick 2–4 players and a unique colour each, choose round length/speed/sound, Start; a 3-2-1-GO countdown, then tap _your_ colour as dots scatter; a timer/progress bar runs the round; results rank the players and offer Play again / Change settings / Back to PlayPad. Light/dark follow the OS.

## Acceptance criteria

- [ ] AC-1: Opening `index.html` renders the PlayPad app bar (logo + wordmark) and a _Games_ section built from `window.GAMES`; the live-game count is shown.
- [ ] AC-2: Each **live** registry entry renders a card (title, description, tags, players, Play); activating it (click **or** keyboard Enter) navigates to its `path`.
- [ ] AC-3: The selection is a **horizontal scroll-snap row**; when it overflows on a fine-pointer/wide viewport, prev/next arrows scroll by one card and disable at the start/end; on touch or ≤720px the arrows hide and native swipe/scroll works. No stray horizontal page scroll.
- [ ] AC-4: A `status:"soon"` entry renders a **dimmed, non-interactive** card (`aria-disabled`, not in the tab order).
- [ ] AC-5: Adding a game requires only appending one object to `games.js` + creating `games/<slug>/` — **no edits to `index.html`**.
- [ ] AC-6: Hub and game adapt to **light and dark** via `prefers-color-scheme`; components reference `--md-sys-*` tokens (no hardcoded colours in component rules).
- [ ] AC-7: Colour Rush completes a full round: setup → Start (enabled only when every player has a colour) → countdown → tappable dots that score their owner → timer end → results (winner / tie / nobody-scored) → replay/settings/back.
- [ ] AC-8: A colour chosen by one player is **disabled** for the others (unique colours enforced).
- [ ] AC-9: **Quit (✕)** during play returns to setup with the prior selections preserved.
- [ ] AC-10: A **"← PlayPad"** link on the game (setup and results) returns to `index.html`.
- [ ] AC-11: `Old prototype/index.html` is **unchanged** from its original content.
- [ ] AC-12: The SVG favicon loads and `manifest.webmanifest` parses and references a `maskable` icon.
- [ ] AC-13: Accessibility floor: every interactive element is keyboard-operable with a **visible focus ring**; exactly one `<h1>` per page; tap targets ≥ 48px; `prefers-reduced-motion` honoured; text meets WCAG AA contrast in both themes.

## Edge cases & error states

- Empty registry → friendly "No games yet" placeholder (no crash).
- Exactly one live game (today) → row looks intentional; not scrollable on desktop → arrows stay hidden.
- Colour Rush: nobody scores → "Nobody scored"; equal top scores → "It's a tie!"; single point → "1 point" (not "points").
- Insane speed + `MAX_DOTS` (12) → spawning stays balanced and non-overlapping; spot-finder degrades gracefully when crowded.
- Backgrounded tab (RAF stalls) → spawn backlog is skipped, not flooded on resume.
- Mid-game resize / orientation change → play area re-measured.
- Registry strings containing `<`, `>`, `&`, `"` → escaped before injection (no markup break / XSS).

## Out of scope

- Score persistence / high-scores, additional games, online multiplayer, a manual in-page theme toggle, service-worker/offline, automated test tooling.

## Non-functional requirements

- **Accuracy:** a tap scores **only** the dot's owner; the round timer and progress bar track real elapsed time; spawn balancing favours the least-spawned colour.
- **Risk/Security:** static site, no backend, no secrets; the only injection surface is registry data rendered to `innerHTML` — it **must be escaped** (`esc()` in `index.html`). Game uses inline data only.
- **Compliance:** no PII, no analytics, no storage; nothing to audit.
- **Quality:** components use tokens, not raw hex/px; no `console.log` left in; reduced-motion respected; keep `ARCHITECTURE.md` ≤ ~150 lines.

## Tech Lead feasibility

- **Verdict:** PROCEED — vanilla static + a `window.GAMES` global is the correct, lowest-risk way to satisfy the `file://` constraint; no conflict with `ARCHITECTURE.md`. (Prototype tier — advisory.)

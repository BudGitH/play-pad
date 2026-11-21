# Feature: PlayPad revamp (hub + all five games)

**Status:** IN PROGRESS
**Owner:** @BudGitH
**Ticket:** PLAY-006
**Created:** 2026-11-21
**Feature tier:** Standard

---

## What & why

- **What:** A whole-product polish pass: a friendlier, more interactive hub; every game reviewed and fixed so it plays well on phone and desktop with no errors or display quirks; a meaningfully improved Claw Catch; and a visually polished Neon Rush (models, environment, lighting, animation).
- **Why:** Owner request (2026-11-21): "more UX/UI friendly, interactive and working absolutely well, fun for all users." Today the hub is a sparse single carousel, Claw Catch feels flat, and Neon Rush's city reads as flat/clay with floating buildings.

## Business requirements & success metrics

- **Business outcome:** a first-time visitor on a phone or a laptop can pick a game and be playing within ~10 seconds, and every game feels finished.
- **Success metric:** zero console/page errors and zero horizontal overflow on hub + every game at 360×740, 390×844, 768×1024 and 1366×800 (automated); every game reaches its in-round state from the hub on both phone and desktop (automated); persona panel baseline + value MET.
- **Must-have business rules:**
  - Static, build-free, works from `file://` and Cloudflare Pages; CSP in `_headers` unchanged in spirit (same-origin scripts only).
  - Neon Rush stays on vendored Three.js r147 + classic-script GLTFLoader; every asset keeps its fallback.
  - `prefers-reduced-motion` respected; WCAG AA contrast; 48px touch targets; keyboard playable on desktop.
  - Add-a-game stays a one-object change in `games.js`.

## Target personas & success bar

Personas from `docs/PRODUCT-PANEL.md` already used by the five games (Sofa Co-op, Priya & kid, Solo Sam, Kid Pilot, Dan, Maya).

- **Baseline (hard gate):** each persona can open the hub, choose their game, start a round and finish it on their device without confusion or a broken layout.
- **Value (hard gate):** the hub helps them choose faster than before; each game is more fun/readable than before.
- **High satisfaction (scored):** delight moments (reward feedback, best scores, polish) that make them return.

## Design routing

- UI surface? **yes** · Reuse-only? **no** · Tier **Standard** → **Path: full**. Owner delegated usability/playability decisions to the design panel (subagents) for this revamp; per-area specs live in this folder (`design-*.md`).
- **Crosses FE/BE seam?** **no** (no backend).

## Scope split (who owns which files)

| Area          | Files                                                    | Spec                       |
| ------------- | -------------------------------------------------------- | -------------------------- |
| Hub + shared  | `index.html`, `games.js`, `styles/*`, `icons/`           | `design-hub.md`            |
| Colour Rush   | `games/colour-rush/`                                     | `design-party-games.md`    |
| Snap          | `games/snap/`                                            | `design-party-games.md`    |
| Super Decoder | `games/super-decoder/`                                   | `design-super-decoder.md`  |
| Claw Catch    | `games/claw-catch/`                                      | `design-claw-catch.md`     |
| Neon Rush     | `games/neon-rush/`                                       | `design-neon-rush.md`      |

## Acceptance criteria

1. Hub and all games: no console/page errors; no horizontal scroll; nothing clipped or overlapping at the four viewports above (portrait and a landscape phone 844×390 for in-round screens).
2. Every game: start → in-round → results → play again works with touch **and** keyboard/mouse.
3. Hub redesign per `design-hub.md`, delivered with tokens from `styles/tokens.css` (light + dark).
4. Claw Catch improvements per `design-claw-catch.md`.
5. Neon Rush visual polish per `design-neon-rush.md`, with no animation glitches (no T-pose, no floating geometry), holding playable frame rate on mid devices (quality tiers allowed).
6. `npm run check`, `npm run secrets`, `npm run smoke` all pass; the smoke test is extended to multiple viewports and to start a round in each game.

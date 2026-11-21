# PlayPad — Project Vision

> A colourful little hub of quick, playable browser mini-games.

_This file is **stable**. It changes when the vision changes, not when the code changes. Keep it short and true._

**Project tier:** Standard (public open-source, MIT — upgraded 2026-11-21) · **Design direction:** see `docs/DESIGN-SYSTEM.md`

---

## The problem

People want a quick, fun micro-break game on any device without installing anything or signing up — and there's no single tidy place to find these small games.

## Who it's for

Casual, mobile-first players looking for a 1–2 minute break; small groups sharing one screen; and the builder/owner who keeps adding games.

## Core concepts (glossary)

> The shared vocabulary. When code and docs use these terms, they mean the same thing.

- **PlayPad / Hub** — the catalog landing page (root `index.html`) that lists the games.
- **Game** — a self-contained mini-game living under `games/<slug>/index.html`.
- **Game registry** — the `window.GAMES` array in `games.js`; the hub renders one card per entry, so adding a game is a one-object change.
- **Design tokens** — the MD3 CSS custom properties in `styles/tokens.css`; the single source of visual truth (never hardcode raw hex/px in components).
- **Old prototype** — the original Colour Rush build, kept untouched in `Old prototype/` purely as a reference.

## Scope

**In scope (now):**

- _TBD_

**Explicitly out of scope (for now):**

- _TBD_

## Success criteria

How we'll know this is working:

- A visitor can spot and start a game within seconds; players come back to try other games; a new game can be added to the catalog with a one-line registry change. (Editable — tune as the catalog grows.)

---

_Last reviewed: 2026-06-21 by @BudGitH_

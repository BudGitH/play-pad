# Design Review: PlayPad launch — catalog hub + MD3 design system + Colour Rush rebuild

> **Phase 1b output — full design path.** Produced _before/while_ building, to choose the UI approach. Visual rules from `docs/DESIGN-SYSTEM.md`. The four user-facing decisions below were taken **interactively by the human** during the setup interview; this records the options and the calls.

**Feature:** PlayPad launch
**Ticket:** PLAY-001
**Date:** 2026-06-21

> **Superseded in part by PLAY-006 (see `features/playpad-revamp/design-hub.md`, 2026-11-21).** The chosen catalog option 4 ("Horizontal scroll selection") was replaced by a featured hero + filter chips + responsive grid. The other chosen options (name, auto light/dark, rebuild Colour Rush fresh) still stand; the manual toggle that option 2 left for later now exists.

---

## 1. Diverge — options on the table

> Senior UX Designer + the target personas brainstormed approaches. All conform to MD3 (`DESIGN-SYSTEM.md`).

**Decision 1 — Brand name**

- Option A — **PlayPad:** short, app-store feel, ownable.
- Option B — Pocket Arcade: evocative, casual.
- Option C — Tapdash / Funbits: energetic / playful.

**Decision 2 — Theme**

- Option A — **Auto light + dark** (`prefers-color-scheme`): one token set, two themes.
- Option B — Dark only (matches the original game's world).
- Option C — Light only.

**Decision 3 — Handling the existing game**

- Option A — **Rebuild Colour Rush fresh** in MD3; keep `Old prototype/` as an untouched reference.
- Option B — Relocate the existing file as-is and re-theme later.
- Option C — Restyle the existing file in place.

**Decision 4 — Game selection layout**

- Option A — **Horizontal scroll-snap row** (a "shelf" that grows sideways).
- Option B — Responsive vertical grid.
- Option C — Grouped category sections.

## 2. PM brief

The choice must serve the success metric — _a visitor spots and starts a game within seconds, and the catalog grows with a one-line registry edit_. So: a name that reads as a small arcade; a look that's cohesive on any device; a first game that demonstrates the MD3 quality bar (not a re-themed afterthought); and a selection pattern that stays elegant from 1 game to many without hub rework.

## 3. Design Roundtable — converge

> Tech Lead inherits the Phase-1 `PROCEED` verdict; it costs the _options_ only.

| Decision | Desirability (UX / persona)                              | Viability (PM / business)       | Feasibility + effort (Tech Lead)                             | Recommended            |
| -------- | -------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------ | ---------------------- |
| 1 Name   | "PlayPad" reads instantly as a games hub                 | brandable, short domain/word    | trivial                                                      | **A — PlayPad**        |
| 2 Theme  | auto light+dark respects user setting (Sam, all)         | cohesive on any device          | low — one token set, media-query override                    | **A — Auto**           |
| 3 Game   | a fresh MD3 build sets the quality bar for future games  | proves the system end-to-end    | medium — rebuild, but logic reused from the proven reference | **A — Rebuild**        |
| 4 Layout | a shelf reads as "a growing collection"; peek hints more | scales 1→many with no hub edits | low — CSS scroll-snap + a JS arrow helper                    | **A — Horizontal row** |

## 4. Persona review

- **Maya / Dan:** a horizontal shelf with a big first card → start fast; a peek of the next card invites a second game.
- **Priya & kid:** bold colourful cards + a friendly first game read as "for us".
- **Sam:** auto-theme + token-driven contrast + real `<a>`/`<button>` controls; the shelf must stay keyboard-reachable (arrows are an _extra_, not the only way) — flagged as a build constraint.
- **You (Builder-Owner):** rebuild-fresh + registry pattern means the next game inherits the system and needs no hub edits.

## 5. Human decision (the real call)

- **Chosen options:** **1=A (PlayPad), 2=A (Auto light+dark), 3=A (Rebuild fresh; old prototype untouched), 4=A (Horizontal scroll selection).**
- **Decided by:** human (@BudGitH), interactively during setup.
- **Date:** 2026-06-21
- **Rationale:** cohesive cross-device brand; a first game that proves the MD3 system; a selection that grows sideways with a one-line registry add.

## Handoff

The chosen options are the spec: Phase 2 tests encode the horizontal selection, the auto-theme, the registry-driven hub, and the rebuilt game; Phase 5 evaluates _these_ (it does not re-open the design). Deferred design debt (e.g. a manual theme toggle, search/filter) → `docs/IDEAS.md`.

# Feature: Clear-search button

> **Worked example (Phase 1).** A filled sample so you can see what "good" looks like end-to-end. To start a _real_ feature, copy `features/_TEMPLATE/` — not this folder.

**Status:** DONE (example)
**Owner:** @BudGitH
**Ticket:** PLAY-001
**Created:** 2026-06-21
**Feature tier:** Prototype

---

## What & why

- **What:** A one-tap "✕" in the search box that empties the query and restores the full list.
- **Why:** Testers said clearing a search by selecting and deleting text was annoying — a fast reset keeps them browsing.

## Business requirements & success metrics

- **Business outcome:** users browse more items per session (less friction resetting search).
- **Success metric:** reset goes from select-all+delete to **one tap**.
- **Must-have rule:** clearing restores the exact pre-search list and scrolls to the top.

## Target personas & success bar

- **Personas served:** "Casual Browser".
- **Baseline:** clear a search in one tap and see all items again.
- **Value:** resetting is faster than before, so they browse more.
- **High satisfaction:** the button is discoverable and feels instant.

## Design routing

UI surface? **Yes** · Reuse-only? **Yes** (existing icon-button + input) · Tier **Prototype** → **Path: lite**.

## Design review (lite)

Checked against `DESIGN-SYSTEM.md`: uses the existing icon-button token and the standard "✕" affordance inside the input. No new pattern. Human OK: **yes**.

## Tech Lead feasibility

**PROCEED** — trivial; reuses the existing input component; no concerns.

## User-visible behaviour

A small "✕" appears at the right of the search box when it has text. Tapping it clears the text, refocuses the box, and shows the full list from the top.

## Acceptance criteria

- [x] AC-1: the "✕" shows only when the box has text.
- [x] AC-2: tapping "✕" empties the box and restores the full list.
- [x] AC-3: after clearing, the list scrolls to the top and the box keeps focus.

## Edge cases & error states

Empty box → no "✕". Whitespace-only query → treated as empty. Rapid taps → no error; stays cleared.

## Out of scope

Search history / recent searches.

## Non-functional requirements

- **Accuracy:** the restored list equals the pre-search list exactly.
- **Risk/Security:** none (client-side filter only).
- **Compliance:** none.
- **Quality:** the clear action feels instant (< 100 ms perceived).

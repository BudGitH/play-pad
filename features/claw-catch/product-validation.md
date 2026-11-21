# Product & UX Validation — Claw Catch

> **Phase 5 of the workflow.** After technical QA passed, prove the feature is worth shipping. PM verifies the business requirement; the target personas verify they complete their goal and would return. **Gate:** baseline + value must be met (satisfaction is scored, not gated).

**Feature:** Claw Catch · **Ticket:** PLAY-003 · **Date:** 2026-06-27

---

## 5A — Senior PM review (business requirement)

**Business requirement:** PlayPad gains a genuinely single-player game so a lone visitor has something to play; added via a one-line registry change; rarity-weighted scoring kept transparent.

**Verdict: PASS.**
- It is the **first solo game** in the catalog (`players:"1"`), directly answering the highest-signal backlog ask in `docs/IDEAS.md`. No second-player dependency exists anywhere in the code.
- Shipped as **one `window.GAMES` entry** + a self-contained folder — the PROJECT.md "one-line registry change" criterion holds (verified: hub now shows "3 games").
- Scoring transparency is real and enforced: the prize key (setup + in-game ★ toggle) lists every prize's points, and QA proved **shown value == scored value** (Uncommon shown as 3 pts → +3 on catch).
- Build-free, `file://`-safe, MD3-consistent — no regression to the hub or sibling games.

## 5B — Persona panel

### Solo Sam — a lone visitor wanting a quick single-player break
- **Baseline (gate): MET.** From the hub, opens Claw Catch, starts a round alone, moves the claw, drops, and scores — verified end-to-end. No one else needed.
- **Value (gate): MET.** Beats "nothing to play solo": a clear goal (score), a readable timer, and a skill mechanic (timing the swing) that isn't random. The flick-and-settle claw makes a successful grab feel earned.
- **Satisfaction (scored): high.** Three themes + difficulty invite "one more go"; the capped bin keeps light tension; "+N" pops and the "Nice catch!" chip reward each catch.

### Kid Pilot — a young player needing forgiving, obvious controls
- **Baseline (gate): MET.** Big pokeball grab button + a chunky joystick mirror the familiar arcade layout; Chill difficulty (wide grab window, strong grip, 12-prize bin) makes catching easy. The prize key uses ★ + emoji, readable pre-literacy.
- **Value (gate): MET.** Obvious one-button action; can't "lose" (timed score, never a fail state); forgiving Chill mode.
- **Satisfaction (scored): high.** Emoji prizes (critters/sweets/space) are kid-friendly; the swinging claw is playful.

## Round table / escalations
None required — both baseline and value gates met on the first pass.

## Non-blocking feedback → `docs/IDEAS.md`
- A persistent "best score" per theme (local, optional) would reward return visits.
- A subtle haptic/visual nudge when the claw tip is lined up over a prize could help Kid Pilot aim.
- A "two-prize bonus" if the claw grabs two stacked prizes at once.

**Gate: PASS** — cleared to ship (Phase 6 capture).

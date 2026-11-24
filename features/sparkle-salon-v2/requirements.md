# Feature: Sparkle Salon v2 — a friendlier princess, smoother on iPad, more fun for kids

> **Phase 1 of the workflow.** Define what "done" means _before_ writing code.

**Status:** IN PROGRESS
**Owner:** @BudGitH
**Ticket:** PLAY-008 (follow-up: owner feedback round 2)
**Created:** 2026-11-24
**Feature tier:** Standard (project tier; public open-source)

---

## What & why

- **What:** four changes to `games/sparkle-salon/index.html`, all from one round of owner feedback:
  1. **Art:** redraw the princess so she reads as a pretty, friendly child, not a monster. This is the word kids playing it used. Done in commit `0769e74`; see `design-review.md`.
  2. **Performance:** remove the lag on iPad Safari. It is worse than on a phone.
  3. **UX / UI / fun:** use the iPad's big screen, give pre-readers picture cues, make progress and rewards more joyful, and give kids a reason to come back. Source: the UX review spec, items S1–S8 below.
  4. **Sound:** make the brushing sound calmer and less harsh.
- **Why:** the owner reports that kids call the art a monster, iPad play lags, and the brush sound is harsh. All three stop kids from playing.

## Business requirements & success metrics

- **Business outcome:** a 4–10-year-old on a phone or iPad plays a full makeover smoothly, likes the princess, understands what to do without reading, and wants another go.
- **Success metrics:**
  1. **Art:** no element reads as a sore, a rash or a monster feature (design review).
  2. **iPad (1024×1366 at 2× scale, 4× CPU throttle in Chromium):** a continuous rub stroke's main-thread time per frame is at or below the budget set from the perf report, and idle play frames do no canvas or style work. Before and after numbers are recorded in `qa-report.md`.
  3. Every acceptance criterion from v1 (AC-1..AC-21) still passes in `features/sparkle-salon/probe.mjs`.
  4. **Sound:** the brush voice has no energy above ~4 kHz from its noise source, and no clicks at the start or end of a stroke.
- **Must-have business rules (unchanged from v1):**
  - Static, one self-contained file, nothing fetched.
  - Never punish free styling.
  - Requests name only free colours.
  - The save key `playpad.sparkleSalon.v1` keeps its keys; new data is optional and additive only.
  - Safe for children: no ads, no real money, no network.
  - Every new motion is respected under `prefers-reduced-motion`.

## Target personas & success bar

- **Personas:** **Priya & kid**, "Sofa Co-op" (primary: a 5–7-year-old on a family iPad), **Maya**, "Commuter Casual" (phone), and **Sam**, "Keyboard / AT".
- **Baseline (hard gate):** complete a full makeover on iPad and on phone with no visible stutter while rubbing, and with no reading needed.
- **Value (hard gate):** the princess looks like a friendly girl; the screen is well used on iPad; progress and rewards are understandable as pictures.
- **Satisfaction (scored):** calm sound, a pointing-hand demo, the album, and drag-and-drop stickers.

## Design routing

- **UI surface:** yes. **Path:** full.
- **Art:** the four-option mockups are in `mockups.html`. The roundtable picked option A, and the owner delegated the choice ("when confident").
- **UX items:** these come from the Senior UX Designer's spec and extend the existing components; no new visual language.

## Acceptance criteria (AC-22.x; v1 AC-1..AC-21 must keep passing)

- [x] **AC-22.1 Art:**
  - The princess has a round child face with a soft chin, an open forehead and flowing golden hair. The hair keeps RT1-hair's hue band.
  - Cleanse smudges read as dirt or paint, not skin disease.
  - The princess SVG has no more elements, filters or gradients than v1.
- [ ] **AC-22.2 iPad performance:** at 1024×1366 and 1366×1024, both at 2× scale:
  - Each canvas backing store is capped at the budget from the perf report.
  - Idle play does no canvas redraws and no per-frame style writes.
  - A rub stroke does at most one paint composite per animation frame and does not read back the whole canvas per pointer move.
  - Measured before and after with the perf script; the numbers are recorded in `perf.md`. **Status:** met except the backing-store cap: the fx canvas keeps its 2048x2732 store but is hidden (not composited) while empty; see `perf.md`.
- [x] **AC-22.3 Phone performance:** at 390×844 at 3× scale, nothing gets slower than before. Same script.
- [x] **AC-22.4 Calm brush sound:**
  - The brush and swish voices are low-passed (cut-off at most ~3.5 kHz), with a soft attack and release of at least 30 ms so there are no clicks.
  - The level is lower than v1 and follows stroke speed smoothly, rate-limited.
  - The sponge squeak is gentler.
  - Still all synthesised (AC-14).
- [ ] **AC-22.5 (S1) iPad layout:**
  - On screens at least 900 wide and at least 700 tall, the app column is wider than in v1 and the background still covers it.
  - Step cameras get an extra tablet zoom of about 1.25×.
  - In iPad landscape (at least 1100 wide and at least 700 tall) the tray and the Redo / ring / Next row move into a right-hand side bar.
  - No horizontal scroll at the AC-16 sizes plus 1024×1366 and 1366×1024. Start, a tray tool, Next and Play again are all on screen.
- [ ] **AC-22.6 (S2) Tablet sizing:** on tablets, tray circles are about 92 px, round buttons 64 px, and Next and Redo at least 64 px tall with larger text.
- [ ] **AC-22.7 (S3) Pointing-hand demo:**
  - On the first visit to each step in a session, a hand demonstrates the action: zig-zags over the region on paint steps, taps the client's wish on pick steps.
  - It never paints, and any pointerdown cancels it at once.
  - The idle nudge is suppressed while the demo plays.
  - Reduced motion shows a still hand instead.
- [ ] **AC-22.8 (S4) Picture progress:**
  - The progress ring shows a heart that fills with progress. The percentage moves into the accessible name only.
  - The floating tool ring is hidden on touch.
  - Small sparkle-and-chime milestones play at 25, 50 and 75 %.
  - On completion the heart is full with a ✓, and Next bounces and glows.
  - Next, Skip and Photo! keep their words.
- [ ] **AC-22.9 (S5) Picture client card:** each wish shows the matching tray icon, large, with a short label. The intro is short. The tray circle of the client's wish glows (not under reduced motion).
- [ ] **AC-22.10 (S6) Results:**
  - The photo is the hero. Wish icons are shown with ✓ or faded.
  - The coin total counts up.
  - **Play again** is the single big primary button; the hub link is a smaller icon link with the accessible name "Back to PlayPad" (still `../../index.html`).
- [ ] **AC-22.11 (S7) Accessories and stickers:**
  - The camera frames each accessory slot, so the tiara is fully visible when it is chosen.
  - A worn item pops on.
  - Stickers can also be dragged from the tray onto the face; tap still works.
- [ ] **AC-22.12 (S8) My Album:**
  - Each finished look saves a small recipe of option ids, and up to 12 looks are kept.
  - An **Album** button on the title screen opens a grid of saved looks drawn locally, with no network.
  - Bad or unknown recipe data is sanitised.
  - Old saves load unchanged.

## Out of scope (backlog → `docs/IDEAS.md`)

UX spec items B1–B9: client variety (skin tones, hair), more free choices, free-style mode, rub-feel extras, tappable step icons, daily client, exit/skip tweaks, audio cues, title extras.

# Product Validation: Sparkle Salon v2

> **Phase 5 output.** The product gate for v2 (friendlier princess, smoother on iPad, more fun for kids, calmer brush sound). Built from the Senior PM review (5A), the Senior UX Designer's read, the persona panel (5B) and the round-table check (5C). All roles are spawned from `docs/PRODUCT-PANEL.md`. Technical QA is `qa-report.md` (written by a separate agent); this file does not repeat it.

**Feature:** Sparkle Salon v2
**Ticket:** PLAY-008 (follow-up: owner feedback round 2)
**Run at:** 2026-11-24 (round 1)
**Overall product gate:** ☒ **PASS** (with two owner-side checks that no headless run can do, listed below) ☐ BLOCKED ☐ BLOCKED, ESCALATED

_No baseline- or value-blocking critical was raised, so no round table was convened (5C: 0 of 3 rounds used)._

---

## The gate (how this passes)

- **Baseline met**: the business requirement is satisfied and each target persona completes their primary goal. **Hard gate.**
- **Value creation**: personas judge it worth using over v1 (the status quo). **Hard gate.**
- **Satisfaction**: scored, pursued through `docs/IDEAS.md`. **Never a gate.**
- **Blocks (to the round table):** PM `NEEDS_REVISION`, or a persona CRITICAL tied to a baseline or value miss.
- **PASS when ALL hold:** PM = `PASS`; every target persona has baseline = met and value = met; zero open blocking criticals.
- **Loop bound:** at most 3 round-table rounds, then BLOCKED, ESCALATED.

---

## How this round was run (evidence, honestly labelled)

- **Evaluation mode:** ☒ **live**. One driver served the game (`node tools/serve.mjs 5651`), drove it in headless Chromium 1243 with Playwright and **real touch events through CDP** (`Input.dispatchTouchEvent`, the fingertip placed `touchLift()` below the tool tip, as a real finger sits), and looked at every screenshot. Sam was driven with the keyboard only and no mouse.
- **Viewports:** 390×844 (phone, touch), 1024×768 and 1080×810 (iPad landscape, touch), 820×1180 (iPad portrait, touch), 1280×800 (Sam, keyboard).
- **Flow captured on all four touch viewports:** title, client card, the pointing-hand demo, rubbing mid-way (heart meter part filled), step done (heart ticked, Next glowing), the shadow step with its demo, accessories with the tiara, stickers, results, title with the Album badge, and the album with 3 looks. Plus one complete 8-step makeover by touch at 1024×768 that matched all four wishes (3 stars, 540 points, 225 coins, 0 console errors).
- **Compared** `screens/before-*.jpg` against `after-*.jpg` and the `ux-*.jpg` set, and against my own fresh captures.
- **Screenshots kept in the repo:** `screens/pv-*.jpg` (13 files, listed at the end).
- **What this run could NOT verify (read this before trusting any "met" below):**
  1. **Real Safari on a real iPad was never run.** Every performance number is Chromium with software GL and a 4× CPU throttle (`perf.md`). The ratios and order are meaningful; the absolute fps is not an iPad number.
  2. **Nobody has heard the new brush sound.** The evidence is an offline render and spectrum (`perf.md`, "Calm brush sound"): energy above 4 kHz is 0.6 to 1.4 % (was 20 to 80 %), onset step about 10× smaller, level about 10 dB lower. That is a strong proxy for "less harsh". It is not a listening test on an iPad speaker.
  3. **No real child has seen the new princess.** The "monster" complaint is the owner's report of children's words. The redraw is judged by the design review, by me, and by the before/after pictures.
  4. Synthetic personas are a heuristic, not user testing. Real feedback outranks them.

---

## 5A: Senior PM review (business requirements)

| Round | Verdict    | Blocking issues | Notes                                                                                                                                                                                                                                                                      |
| ----- | ---------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | **`PASS`** | none            | Every business requirement and success metric is met on the evidence available. Two items cannot be closed by anyone but the owner (real iPad Safari, real children); they are owner verifications, not revisions, and the PM does not hold the gate for them (see below). |

**Evidence anchor** (`requirements.md`): _"a 4–10-year-old on a phone or iPad plays a full makeover smoothly, likes the princess, understands what to do without reading, and wants another go."_

### Business outcome, requirement by requirement

| Requirement / metric                                                                                                            | Verdict                     | Evidence and reasoning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Ask 1: "monster" → friendly person, better vector art** (metric 1: nothing reads as a sore, rash or monster feature)          | **Met** (heuristic)         | `pv-before-after-phone.jpg`: v1 had a lumpy helmet of hair, a long pointed pale face, grey-brown pox blobs and red "sores" on the cleanse step. v2 has a round child face, open forehead, flowing golden hair, a button nose, a smile, and dirt drawn as chocolate / mud swipes, glitter face-paint and crayon. I looked at the title, cleanse, mid-rub, tiara, results and album frames at four sizes: she reads as a friendly girl every time. Remaining risk: the big dark-winged anime eyes (see Future improvements #1).        |
| **Ask 2: iPad lag, worse than phone** (metric 2: stroke main-thread time within budget; idle frames do no canvas or style work) | **Met in Chromium proxy**   | `perf.md` before → after at 4× CPU, iPad 1024×1366 @2×: shadow stroke 8.9 → about 42 fps and 1768 → about 530 ms script per 3 s; blush stroke 8.9 → about 45 fps; idle play 9 → about 37 fps; long tasks 11-12 → 0. iPad landscape and phone are at or near 50-60 fps. The causes the profiler found (57 filtered SVG nodes, the 2048×2732 particle canvas, per-dab compositing, ambient animation during strokes) are removed, not tuned. Idle style writes are 0 (verified with a `MutationObserver`). **Not measured on WebKit.** |
| **Ask 3: UX / UI / more fun for kids** (S1-S8)                                                                                  | **Met**                     | Seen live: side-bar layout on iPad landscape, 92 px tray circles, a picture client card, a pointing-hand demo, a heart that fills, sparkle milestones, a single big Play again, a photo-hero results page, drag-or-tap stickers and an Album with a count badge. A full makeover by touch completed with 0 errors.                                                                                                                                                                                                                   |
| **Ask 4: calmer, non-harsh brush sound** (metric 4: no energy above about 4 kHz from the noise source, no clicks)               | **Met (measured, unheard)** | `perf.md` offline render: 1.2 % / 1.4 % / 0.8 % / 0.6 % of energy above 4 kHz for brush / wand / lipstick / sponge, onset step 0.007 to 0.019 (was 0.044 to 0.177), RMS 9 to 10 dB lower, softer 30 ms+ attack and 100 ms release, gentler sponge squeak. Still all synthesised. Hiding the tab closes the brush voice. Other voices (chimes, coin, shutter, music box) were not retuned (Future improvements #5).                                                                                                                   |
| **Metric 3: every v1 AC (AC-1..21) still passes in the deep probe**                                                             | **Not re-run by me**        | This is the QA lens's job (`qa-report.md`). What I saw live agrees: every v1 flow I touched (title, Start, 8 steps, Skip, Redo, tray, results, save, Album) worked, with 0 page errors.                                                                                                                                                                                                                                                                                                                                              |
| **Must-have rules** (static single file, free styling never punished, requests name only free colours, additive save, kid-safe) | **Met**                     | The wishes shown on the client card are all free colours (Sky blue, Aqua, Peach, Coral, Rose, Violet, Cherry pink, Ruby red). Skipping everything still earns stars and coins (v1 rule, unchanged). No network. Old saves load (the Album shows its own empty state).                                                                                                                                                                                                                                                                |
| **Reduced motion respected**                                                                                                    | **Met**                     | With `prefers-reduced-motion: reduce` the demo is a still hand (`#demoHand.on.still`, 0 animations, `aria-hidden`, `pointer-events: none`) and 0 animations were running on the page.                                                                                                                                                                                                                                                                                                                                                |

### Scope and coherence

- **Scope discipline:** the B1-B9 backlog (skin tones, free-style mode, daily client and so on) is not half-built; nothing in the UI hints at it.
- **Coherence:** the new side bar, tray and buttons reuse the existing MD3 tokens and the same pink / purple language as v1 and the hub. The hub link still goes to `../../index.html`; its accessible name is "Back to PlayPad".
- **Open decisions:** none left as TBD. The two "open questions" in `design-review.md` (puff sleeves now visible; eyes unchanged) are recorded, not hidden.

### UX Designer read (feeds the backlog; does not gate on its own)

**Verdict: `PASS`.** Task flow is short and legible for a pre-reader: **one** primary button on the title, **one** picture card that says what to match, **one** moving hand that shows what to do, **one** heart that fills, **one** glowing Next. Evidence anchor: `pv-phone-demo.jpg` and `pv-ipad1024-client.jpg`. Issues, all MEDIUM or LOW, none blocking a baseline goal:

| #   | Sev    | Observation                                                                                                                                                                                                                                                                       | Recommendation                                                                              |
| --- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| U1  | MEDIUM | On the **stickers** step the camera crops the tiara the child just chose, and the "Stickers" pill and step dots sit on top of what is left (iPad portrait and iPad landscape; `pv-ipad1080-stickers.jpg`, `pv-ipad820-stickers.jpg`). The worn tiara is whole again in the photo. | Frame the stickers step with the accessory camera's top margin, or move the pill. Low cost. |
| U2  | LOW    | The "client's choice" marker on a tray circle is a small heart badge (about 30 px on iPad); the matched ✓ on the results wishes is about 20 px (`pv-ipad1024-results-matched.jpg`). Fine for a parent, small for a 5-year-old.                                                    | Scale both up on tablets; fill the matched wish circle.                                     |
| U3  | LOW    | The instruction line ("Rub the sponge over the smudges!") is text only. The demo hand covers the pre-reader, but there is no read-aloud.                                                                                                                                          | See Future improvements #4.                                                                 |
| U4  | LOW    | The demo plays once per step per session. A child who tapped during it and missed it cannot ask for it again.                                                                                                                                                                     | A small "?" chip that replays the demo.                                                     |
| U5  | LOW    | The Album button on the title is icon-only with a count badge.                                                                                                                                                                                                                    | A tiny "Album" caption under it on tablets.                                                 |

---

## 5B: Persona panel (usability and value)

Scores use the bar in `docs/PRODUCT-PANEL.md`. Satisfaction is 1-5, scored conservatively.

| Persona                             | Baseline | Value   | Satisfaction (1-5) | Verdict basis                                                                                                                                                                             |
| ----------------------------------- | -------- | ------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Priya & kid** (iPad, primary)     | **met**  | **met** | **4**              | Live touch run on three iPad sizes. Perf and sound unverified on a real iPad.                                                                                                             |
| **Maya** (phone, one hand)          | **met**  | **met** | **4**              | Live touch run at 390×844. Phone performance is level with v1 in the proxy.                                                                                                               |
| **Sam** (keyboard / assistive tech) | **met**  | **met** | **3**              | Live keyboard-only run at 1280×800. Full operability and clear names; a few minor gaps listed below. Screen reader not run, so the names are read from the accessibility tree, not heard. |

### Priya & kid: "Sofa Co-op" (a 5-7-year-old on a family iPad)

**What happened, as the child's goal ("make the princess pretty"):**

1. **Title (1024×768 and 820×1180):** the princess fills the left or the middle of the screen; she looks like a girl with golden hair, a tiara and a necklace, and she is smiling. One huge Start button, with a small Album icon beside it. Nothing to read before pressing Start. In landscape the title uses the wide screen (princess left, name and buttons right), which v1 did not.
2. **Client card:** a round portrait with a heart bubble, "Dawn wants: Sunset Gala look", then four big picture tiles (eye shadow with an orange lid, blue eye, blush with a brush, red lips) each with a tiny colour name. A 5-year-old can match pictures to the tray without reading. One big "Let's glam!" button.
3. **First step (cleanse):** the hand appears on the face and rubs the sponge over the smudges. I pressed during the demo: the demo stopped **and the very first touch painted** (14 % progress, one smudge cleared), so a child who dives in is never ignored.
4. **Rubbing:** the sponge sits above the fingertip, the smudges vanish with bubbles, and the heart in the bar fills from the bottom (`pv-phone-rub-mid.jpg`, `pv-ipad1024-rub-mid.jpg`). At done the heart gets a ✓, the eyes close happily, "Love it! +10 coins" shows and **Next** glows and bounces in the corner. A child can follow "heart full, big pink button" with no words.
5. **Paint steps:** the hand shows the zig-zag on the lid once (`pv-phone-demo.jpg` on the shadow step); the tray has 6 big colour circles, the client's choice marked with a heart badge and the locked ones with a padlock. The face is large (the tablet camera boost) and the brush is easy to aim on a 1024×768 screen.
6. **Accessories and stickers:** the tiara fits fully in the picture when chosen (`pv-phone-tiara.jpg`); stickers go on by tap (I placed two by tapping the stage).
7. **Results:** the photo is the hero, stars fill, "Royal makeover!" when all four wishes match, four wish circles with ✓, coins, and one big **Play again** (`pv-ipad1024-results-matched.jpg`). It is saved to My Album.
8. **Album:** polaroid frames with the child's own looks and stars (`pv-ipad820-album.jpg`).

- **Baseline: met.** A full 8-step makeover by touch, matching all four wishes, finished with 3 stars and no errors on 1024×768. The same flow ran to the end at 390×844, 1080×810 and 820×1180. No step needs reading to be started or finished.
- **Value: met.** The owner's own words for v1 were "a monster". The new princess is the visible change; the iPad screen is used well; progress and rewards are pictures.
- **Satisfaction: 4.** Likes: the hand, the filling heart, Play again, My Album as a reason to come back. Held back from 5 by: unverified real-iPad smoothness and sound, the stickers-step crop (U1), and the fact that matching colours is mostly for the parent to read out.
- **Critical:** none. **Honest limits:** I cannot say a real 6-year-old would not call the large eyes "scary"; the redraw removed every cue the design review diagnosed, but only a child can confirm.

### Maya: "Commuter Casual" (phone, one hand)

- Start to first paint at 390×844: one tap on Start, one tap on Let's glam, then rub. No sign-in, no loading. Targets are at least 48 px (the tray is 62 px); Next, Redo and the tray are in the thumb zone at the bottom; Exit and Sound are top-left and top-right (a stretch, but deliberate so they are not hit by accident).
- A whole makeover runs about 30 to 40 seconds of scripted strokes, which fits a train ride; results then offers one big Play again.
- Phone performance in the proxy is level with v1 (about 57 to 60 fps at 4× CPU, `perf.md`), so v2 cost her nothing.
- **Baseline: met. Value: met. Satisfaction: 4** (the friendly face, the heart; she would open the Album again). **Critical:** none. Not re-driven one-handed with a real thumb; thumb reach is read from the layout.

### Sam: "Keyboard / AT user" (1280×800, keyboard only, no mouse)

What I tabbed through and what I found in the accessibility tree:

| Place                | Result                                                                                                                                                                                                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title**            | Tab order: Back to PlayPad → Start makeover → My Album, 2 looks → Sound and music. Every stop has a 3 px outline plus a shadow and is in view. The album count is in the name ("My Album, 2 looks").                                                                                                          |
| **Album**            | Enter opens a `dialog` (`aria-modal`, labelled "My Album"), focus lands on **Close**, Tab moves through each look (names like "Ocean Ball for Princess Marina, 3 of 3 stars") then Close, and wraps inside the dialog. **Escape** closes it and returns focus to the Album button.                            |
| **Client card**      | Opens with focus on **Let's glam!**; Enter closes it and focus goes to the stage.                                                                                                                                                                                                                             |
| **A step (cleanse)** | The stage is `role=application` with the name "The princess. Rub the sponge over the smudges! Use the arrow keys to move the tool and hold Space or Enter to apply it." Next stops: Redo, Skip, the three sponges (names such as "Sponge: Pink sponge"). The live region announces "Step 1 of 8: Cleanse. …". |
| **Shadow tray**      | Names say state: "Eye shadow: Rose, the client's choice", "Eye shadow: Mint, locked, costs 50 coins". The heart meter is `role=img` "Step progress 18 percent", and it updates as I painted.                                                                                                                  |
| **Results**          | Focus moves to **Play again**; the live region says "2 out of 3 stars. 40 coins. New best score: 280!"; the summary says "Ocean Ball for Princess Marina, 0 of 4 matched"; each wish icon is named "matched" or "not matched"; the hub link is "Back to PlayPad".                                             |
| **Reduced motion**   | Honoured (above).                                                                                                                                                                                                                                                                                             |

- **Baseline: met.** Nothing I used was mouse-only; I reached the title, the Album, a step and the results by keyboard, and the demo hand is `aria-hidden` with `pointer-events: none`, so it never traps focus or a click.
- **Value: met.** Visible focus everywhere, honest names, state spoken, Escape works, nothing flashes under reduced motion.
- **Satisfaction: 3.** Gaps (all non-blocking, all logged):
  - **S1 (LOW):** label-in-name. The button reads "Redo" but its accessible name is "Clear this step and try again", so a voice-control user saying "click Redo" will not match it. Make the name start with the visible word.
  - **S2 (LOW):** painting a whole step by arrow keys is slow (each press nudges the tool a little). In my one short wiggle I reached 18 %, not done; **Skip** is always available and the v1 probe (AC-15c/d/e) covers keyboard completion. A Shift-for-bigger-steps option would help.
  - **S3 (LOW):** I did not reach the 25 % milestone by keyboard, so I could not confirm its spoken announcement here (the spec covers it).
- **Critical:** none. **Honest limit:** no screen reader (NVDA / VoiceOver) was run; this is the accessibility tree, not what it sounds like.

---

## 5C: Round-table sessions

**None convened.** No PM `NEEDS_REVISION` and no persona critical tied to a baseline or value miss. Rounds used: **0 of 3**. No entry is needed in `docs/findings-ledger.md` as STOP-SHIP from this phase.

---

## Overall gate

1. **PM = `PASS`** ✔
2. **Every target persona: baseline = met AND value = met** (Priya & kid, Maya, Sam) ✔
3. **Zero open baseline/value-blocking criticals** ✔

→ **PASS.** Satisfaction: Priya & kid 4, Maya 4, Sam 3 (scored, not gated).

### Two owner-side checks (not blockers; nobody else can close them)

These are the owner's own three complaints, and the only evidence for two of them is a proxy.

1. **On a real iPad in Safari:** rub the eye shadow and blush for a few seconds on the iPad that lagged, and listen to the brush with the speaker volume you use. If it still stutters, the next levers (see `perf.md`, "Not verified / risks") are the wider iPad column and the tablet camera boost, which put more pixels on screen, or a lower `#fx` cap (3 Mpx now), not the art or the sound.
2. **With one or two children:** show them the title and the cleanse step. If they still say "monster", the next lever is the eyes: soften the dark liner wing colour (`design-review.md` §6).

---

## Future improvements (non-blocking → `docs/IDEAS.md`)

| #   | Item                                                                                                                                                                                                             | Source         | Size |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ---- |
| 1   | **Soften the eyes** if children still find her stern: lighter, warmer liner wings and slightly smaller irises. Only do this after a real child has seen v2.                                                      | PM / Priya     | S    |
| 2   | **Stickers-step framing (U1):** do not crop the tiara just chosen or put the step pill on top of it, on iPad portrait and landscape.                                                                             | UX / Priya     | S    |
| 3   | **Bigger markers on tablets (U2):** the "client's choice" heart on the tray and the ✓ on results wishes; fill a matched wish circle.                                                                             | UX / Priya     | S    |
| 4   | **Read-aloud for pre-readers:** a speaker chip that says the instruction line and the client's wish ("Rub the sponge over the smudges"). Uses the browser's speech or recorded clips; needs a decision on voice. | Priya & kid    | M    |
| 5   | **A listening pass on the rest of the sound kit:** chimes, coin, shutter and the music box were not retuned; a master volume (not only on / off) would let a parent set the level on a loud iPad speaker.        | PM / Priya     | S-M  |
| 6   | **Replay the demo (U4):** a small "?" chip near the hint that plays the hand again.                                                                                                                              | UX / Priya     | S    |
| 7   | **Voice-control name match (S1):** start the accessible name of Redo with the visible word.                                                                                                                      | Sam            | XS   |
| 8   | **Keyboard rub speed (S2):** Shift for bigger steps, or "auto-sweep" on Space.                                                                                                                                   | Sam            | S    |
| 9   | **A caption under the Album button on tablets (U5).**                                                                                                                                                            | UX / Maya      | XS   |
| 10  | **A real WebKit run in CI** (Playwright WebKit on macOS) for the perf guards, so "iPad Safari" stops being a proxy. Not possible in this environment.                                                            | PM / Tech Lead | M    |
| 11  | **Album share / print** (a polaroid saved as a picture) as the next reason to come back; backlog B-items already list "title extras".                                                                            | Priya          | M    |

---

## Human summary

The new princess looks like a friendly girl, not a monster: round face, open forehead, flowing golden hair, a small smile, and cleanse "dirt" that looks like paint and chocolate instead of sores. A child on an iPad gets a bigger face, big finger-sized buttons, a picture card that says what to match, a hand that shows what to do, a heart that fills up, a big Play again and an Album of their looks. A whole makeover by touch ran start to finish with no errors on a phone and three iPad sizes. The brush is now a low, soft hush, measured with 30 to 55 times less of the harsh top-end energy than before, and the heavy parts of the page that made iPad slow are gone (four to five times the frame rate in the Chromium test).

What nobody could check here: real Safari on a real iPad, how the brush sounds out loud, and what a real child says about her face. The gate passes on the evidence available; please do the two quick checks above before you tell anyone it is "fixed".

### Loop control

Round table rounds used: 0 of 3. Escalation: none.

---

## Screenshots (`features/sparkle-salon-v2/screens/`)

| File                              | Shows                                                                                         |
| --------------------------------- | --------------------------------------------------------------------------------------------- |
| `pv-before-after-phone.jpg`       | v1 vs v2, title and cleanse, 390×844 (left two = before, right two = after)                   |
| `pv-phone-demo.jpg`               | Pointing-hand demo on the cleanse step, 390×844                                               |
| `pv-phone-rub-mid.jpg`            | Rubbing by touch, heart part filled, smudges clearing                                         |
| `pv-phone-tiara.jpg`              | Accessories step with the pearl tiara fully visible                                           |
| `pv-phone-results.jpg`            | Results on a phone (photo hero, stars, wish circles, Play again)                              |
| `pv-ipad1024-client.jpg`          | Picture client card on iPad landscape 1024×768                                                |
| `pv-ipad1024-rub-mid.jpg`         | Mid-rub with the side bar, 1024×768                                                           |
| `pv-ipad1024-shadow-mid.jpg`      | Eye shadow mid-stroke with the tablet zoom and the 6-colour side bar                          |
| `pv-ipad1024-results-matched.jpg` | Results after a full by-touch makeover that matched all four wishes (3 stars, ✓ on each wish) |
| `pv-ipad1080-stickers.jpg`        | Stickers step on 1080×810: the tiara is cropped under the step pill (U1)                      |
| `pv-ipad820-stickers.jpg`         | Stickers step on iPad portrait 820×1180 (same crop)                                           |
| `pv-ipad820-album.jpg`            | My Album with three looks on iPad portrait                                                    |
| `pv-ipad1080-album.jpg`           | My Album on 1080×810                                                                          |

---

## Post-launch UAT (after the feature is live)

- [ ] Owner checks on the iPad that lagged (rub, then listen), and shows one or two children the title and cleanse step.
- [ ] PM-led UAT with the same panel and round-table loop if either check fails; the levers are named in "Two owner-side checks".

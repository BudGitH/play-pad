# Product Validation: Sparkle Salon

> **Phase 5 output.** Produced _after_ technical QA (`qa-report.md`) is PASS. This is the **product gate**: the feature is not "done" until this is PASS. Built from the Senior PM review (5A), the persona panel (5B), and any round-table sessions (5C). All roles are spawned from `docs/PRODUCT-PANEL.md` — no external skill or tool required.

**Feature:** Sparkle Salon — a kids' princess make-up game
**Ticket:** PLAY-008
**Run at:** 2026-11-22 (round 1) · 2026-11-22 (round 2, RT-1 re-validation)
**Overall product gate:** ☒ **PASS** (round 2) ☐ BLOCKED ☐ BLOCKED — ESCALATED — _round 1 was BLOCKED on one narrow fidelity pass (RT-1); all four RT-1 items re-measured MET in round 2, PM = PASS, every persona clears baseline and value_

---

## The gate (how this PASSES)

**Three-tier bar — two tiers gate, one is scored:**

- **Baseline met** — does what the business requirements say **and** each target persona completes their primary goal. **Hard gate.**
- **Value creation** — personas judge it worth using over the status quo. **Hard gate.**
- **High satisfaction** — scored, pursued via `docs/IDEAS.md` over time. **Never a release gate.**

**Blocks (→ round table):** PM verdict `NEEDS_REVISION`, OR any persona CRITICAL tied to a baseline/value miss.
**Logs, doesn't block:** satisfaction feedback + any "critical" not tied to baseline/value → `docs/IDEAS.md` (recurring → `docs/findings-ledger.md` under PRODUCT/UX).

**PASS when ALL hold:** (1) PM = `PASS`; (2) every target persona reports **baseline = met AND value = met**; (3) zero open baseline/value-blocking criticals. Satisfaction is recorded, never required maximal.

**Loop bound (no infinite loop):** the round table iterates **≤ 3 rounds** per feature. If a blocking item survives 3 rounds → stop, log it in `findings-ledger.md`, mark **BLOCKED — ESCALATED**, and surface it to the human.

---

## How this round was run (evidence, honestly labelled)

- **Evaluation mode:** ☒ **live** — one driver served the game (`node tools/serve.mjs 5641`), drove it in headless Chromium with Playwright and looked at the screenshots; ☐ artifacts only. The orchestrator asked for 5A and 5B in one pass, so the personas ran although 5A is `NEEDS_REVISION`; their results stay valid unless the fix in RT-1 changes more than art constants.
- **Devices / input:** Priya & kid and Maya — 390×844 portrait, `hasTouch`/`isMobile`, **real touch events via CDP** (so the 46 px tool lift is exercised), plus 820×1180, 1180×820 and 844×390 for layout. Sam — 1280×800, **keyboard only** (the mouse was never used). Maya also started from the hub (`/`) with two thumb swipes and a tap.
- **Fidelity:** the owner's reference (`makeup-ref.webp`, 166×296, third-party, not in the repo) next to the game's title screen and a glam-look play frame at 390×844, plus crops of the tray and of the eyes/props, and a pixel measurement of the hair colour.
- **Sound was NOT heard** (headless). The sound verdict is **code-reviewed only** (`index.html` → `Sfx`, lines ≈ 2328–2676, and the cue call sites).
- **Caveats:** synthetic personas, scripted strokes (CDP dispatch is slower than a finger, so I judge feel from frame strips, not from speed), no real child. Screenshots live in the session scratchpad (`…/scratchpad/pv-ss/`), not in the repo; ids are quoted below.

---

## 5A — Senior PM review (business requirements)

| Round | Verdict          | Blocking issues                                                        | Notes                                                                                                                                                     |
| ----- | ---------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `NEEDS_REVISION` | 1 HIGH (hair palette) + 2 MEDIUM folded into the same art pass         | Business outcome, fun mechanics and sound are met. The owner's "design fidelity — I do not accept less" is met for the UI, short of it for the character. |
| 2     | **`PASS`**       | none (hair, jaw/neck and props all re-measured MET; see Round 2 below) | Character fidelity now matches the reference palette and prop set; remaining differences are cosmetic and parked in the non-blocking list.                |

**The owner's three asks — verdict on each:**

| Ask                        | Verdict                      | One-line reason                                                                                                                                                                                                                                                         |
| -------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Fidelity to the image   | **Close, not yet "true"**    | Layout, tray, HUD and the princess's composition are faithful (≈ 8–9/10). The character's hair colour, jawline and the wand/brush props are visibly a reinterpretation (≈ 6.5–7/10). See the scorecard below.                                                           |
| 2. Fun, playable mechanics | **Met**                      | Rub-to-apply gives continuous feedback (tool follows the finger, paint builds up with a % ring, auto-completes at 80% with sparkles, chime, giggle and coins). Requests give a reason to choose colours; locked colours give a reason to come back. Never a fail state. |
| 3. Sound design            | **Met (code-reviewed only)** | A cohesive all-synthesised kit: stroke-speed-driven swish per tool, sponge squeak, lens pop, chimes, coin, shutter, star notes, fanfare, a music-box loop, persisted mute, suspended when the tab is hidden. Risks are mix/loop details (below), none blocking.         |

**Business success metrics (requirements.md) — verified live:**

1. A first-time player completes all 8 steps to the photo without a dead end — **yes**: touch run (4/4 matches, 3 stars, 225 coins) and keyboard-only run (8/8 steps, 3 stars).
2. Every run earns ≥ 1 star and coins; matching earns more — **yes** (540 points / 225 coins matched; skip-everything path covered by `probe.mjs` AC-12).
3. Coins and unlocks persist — **yes**: bought "Mint" for 50 of 90 coins, reloaded, coins 40 and `unlocked: ["shadow:mint"]` restored.
4. The hub shows a "Best" badge from `bestOverall` — **yes**: card read `Best 280` after one run.

**Issues (latest round):**

- **[HIGH] Hair palette is warmer and heavier than the reference** → violates _"the visuals … match the owner's reference"_ (requirements.md → Value) and the owner's fidelity ask. The hair is the biggest colour mass on screen. Measured on the same "hair-yellow" pixel class: reference mean hue 43.7°, brightness 0.97, only ≈ 2% of hair pixels darkened; the game's title screen 39.3°, 0.93, ≈ 11% darkened (about 5× more shaded hair), so it reads amber/mustard where the reference reads lemon. The highlight colour already matches (255,221,104 in both); the darks do not. → Lift the back-hair gradient `#gBackBase` (`#d58415 / #eb9c24 / #f8b63c`) toward `#f0a21c / #f8bc34 / #ffd45a`, thin the dark strands, keep the orange outline; target mean brightness ≥ 0.96 and ≤ 4% darkened pixels by the same measure.
- **[MEDIUM] Jawline and neck shadow** → fidelity. The jaw is a V-shaped point where the reference has a softer, rounder chin, and the neck shadow is a brown-pink band that looks muddy at the 1.75× lipstick zoom (shots `p5-step6-lips-start`, `p6-tiara-on`). → Round the chin path; lower the neck-shadow opacity and push it pinker.
- **[MEDIUM] Props are only partly on screen on a phone** → fidelity + clarity. The reference shows the mascara wand's red heart tube; in the game the tube exists in the art (`twTube`) but the wand's handle runs off the right edge, so the tube is never seen, and at rest the wand is mostly clipped (`p5-step4-mascara-start`). In the lipstick step no tool is visible at rest at all. The blush brush head is a cloud shape rather than the reference's round fluffy puff. → Re-pivot/shorten the wand so the tube lands on screen, keep the resting tool inside the viewport in every paint step, round the brush head.
- **[LOW] Hub card art** is a lipstick emoji on pink like its neighbours; it is clear to an adult but not a pull for a child, and the "Kids" tag in `games.js` is not shown on the card. → Parked to `IDEAS.md`.

**Evidence anchor:** _"the owner's reference is the chosen direction"_ / _"the visuals are clear, colourful and friendly (they match the owner's reference)"_ — `requirements.md`, Design routing and Value bar; owner: _"design fidelity, I do not accept less"_.

**One-line summary:** the game is fun, safe and complete and the screen layout is a faithful match, but the princess herself is a shade too orange and a little too pointy-chinned next to the reference, and that is the one thing the owner said they would not compromise on.

### Fidelity scorecard (UX Designer, side by side at 390×844)

| Element                                                                                                                                                 | Match  | Notes                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tray: pink band, hot-pink rim, white discs with thick two-tone ring + black outline, big selected disc with purple halo, lock badge, mini-illustrations | 9/10   | Practically the same recipe (crop `fidelity-tray-and-eyes`). Heart badge for the client's pick is a good extension. Ours clips the 5th disc at 390 px, which doubles as a swipe cue (tray scrolled fine, no accidental taps).              |
| HUD: round exit button top-left, coin pill with gold heart coin top-right                                                                               | 8/10   | Exit is magenta where the reference is red; coin pill matches.                                                                                                                                                                             |
| Princess composition: bust, pearl tiara, choker, butterfly pendant, lilac dress with white fur                                                          | 8/10   | All present and recognisable; the dress is smoother than the reference's glitter texture.                                                                                                                                                  |
| Eyes, lips, blush                                                                                                                                       | 8/10   | Large glossy violet irises with several highlights, glossy two-tone lips, round blush. Upper lash line is heavier and the lashes are plain sticks; the reference's irises are a pink-blue-violet gradient.                                 |
| Hair                                                                                                                                                    | 6/10   | See HIGH issue. Shape (ponytail tuft, swept bang, orange outline) is right; the colour is not.                                                                                                                                             |
| Face shape / neck                                                                                                                                       | 6.5/10 | See MEDIUM issue.                                                                                                                                                                                                                          |
| Props (brush, wand, lipstick, sponge)                                                                                                                   | 7/10   | Gold ferrule + heart on the brush is a good echo; wand tube off-screen, brush head shape differs; the sponge reads as a pink disc.                                                                                                         |
| Backdrop                                                                                                                                                | 7/10   | Blurred lilac/pink vanity room with bulbs and a pink table; ours uses a bulb arch where the reference has a bulb pillar on the left. A deliberate, acceptable departure.                                                                   |
| Departures needed to be a game (step name + 8 dots, hint bubble, Redo / ring / Skip-Next row, request card, per-step camera zoom)                       | n/a    | Well integrated and in the same visual language. The per-step zoom (1.2–1.75×) makes the face much larger than the reference's fixed bust, which helps small fingers but means the player rarely sees the "reference" framing during play. |

### The core rub-to-apply loop (UX Designer: fun and juice)

What happens when a child rubs, from frame strips (`p10-blush-filmstrip`, `p8-giggle-sheet`, `p21-giggle-glam`) and the code:

- The tool is a drawn object that follows the finger and is lifted 46 px above a fingertip so the work stays visible. The % ring chases the tool tip and doubles as the progress meter.
- Paint builds up under the tool (soft blush discs, lid shadow, lash by lash for mascara, smudges fading for cleanse). At ≈ 80% the step finishes by itself: sparkle burst, chime, coin clink, a speech-bubble cheer, and the princess shuts her eyes and giggles (closed lids take the shadow colour). The Next button then glows. This is a good, tactile reward cycle with no way to lose.
- Single taps dab, so a child who cannot scrub still progresses. Tap-to-choose steps (lenses, accessories, stickers) swap the art immediately, and the camera pans between the tiara, earring and necklace tabs.
- **Where it is weaker:** (a) the three tap steps are less tactile than the rub steps; (b) the 80% auto-complete is kind but takes the finishing flourish away from the child; (c) the resting tool is clipped or missing in two steps; (d) one princess, one hairstyle: the novelty is in the colours, not in the character, so replay value rests on unlocks.

### Sound design (code-reviewed only, not heard)

- **Strengths:** everything is synthesised after a user gesture, with a master → compressor chain, a separate music bus (0.5) and effects bus (0.9) and a feedback echo that gives chimes their tail. The swish is band-passed noise whose level and filter follow stroke speed and differ per tool (lipstick 1 kHz, sponge 1.5 kHz, brush 2.3 kHz, wand 3.2 kHz), so rubbing _sounds_ responsive; the sponge adds a rate-limited squeak. The music is an 8-bar C-major music-box loop with humanised velocity; stars light on G5, B5, E6; the fanfare and shutter pair give the reveal weight. Mute persists and audio is suspended while the tab is hidden.
- **Risks (none blocking):** (1) a step completion fires chime, coin and giggle in the same ~300 ms, in unrelated pitches (the coin's square B6 sits a semitone under the chime's C7), so it may sound busy — stagger the coin ~250 ms and tune it to the chime's chord; (2) the "giggle" is three rising blips, cute but not a giggle; (3) the music loop is ≈ 19 s with no variation (a 2-minute makeover hears it six times) and its bass notes (87–130 Hz at gain 0.07 × 0.5) are inaudible on phone speakers; (4) music peaks sit roughly 8 dB under the effects, which is right for a background bed but should be confirmed by ear on a phone speaker; (5) iOS's silent switch will mute Web Audio, which the game cannot influence.

---

## 5B — Persona panel (usability & value)

**Evaluation mode:** ☐ artifacts ☒ live (one driver captured the running app) ☐ **Unverified — no live run**

| Persona                                | Baseline | Value                                     | Satisfaction | Critical?                                  | Key feedback                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------- | -------- | ----------------------------------------- | ------------ | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Priya & kid** — Sofa Co-op (touch)   | **met**  | **met**                                   | **4 / 5**    | n (one MEDIUM, not tied to baseline/value) | The child can finish a full makeover with taps and finger strokes: cleanse reached 100% on the first naive pass, and the visuals are bright, clear and friendly. Friction: nothing shows a non-reader _how_ to start rubbing, and the lifted tool surprises a first touch (below).                                                                                                                       |
| **Maya** — Commuter Casual (phone)     | **met**  | **met** (modest — it fills a short break) | **3 / 5**    | n                                          | Hub to first stroke in ≈ 5 s with two thumb swipes and three taps, no sign-in, no load wait (page load ≈ 110 ms). Every control she needs is in the lower half of the screen. A makeover is about two minutes. No challenge or skill ceiling, so she returns only if she likes dress-up.                                                                                                                 |
| **Sam** — Keyboard / AT user (desktop) | **met**  | **met**                                   | **3 / 5**    | n                                          | Complete keyboard path with nothing mouse-only: Tab to Start, Enter, Enter, arrow keys + held Space on the face, Enter in the tray, Tab to Next. 8/8 steps, 3 stars. Focus is visible (3 px indigo outline, 3 px offset), labels are sensible, and one live region announces steps, selections, completions and the result. It is laborious (below) and the face is not a screen-reader-friendly target. |

### Priya & kid — what they experienced (390×844, touch)

- **Start:** the title screen (`p1-title-390`) is bright and clear; "Start makeover" is big and inside the viewport. The client card (`p1-request-390`) shows four colour swatches a child can match by sight, and the tray marks the client's pick with a heart badge, so matching works without reading.
- **Eight steps completed** with real touch strokes and taps: cleanse (`p3-cleanse-after-naive`), eye shadow (`p4-shadow-done`), lenses (`p5-step3-lens-done`), mascara (`p5-step4-mascara-mid`), blush (`p5-step5-blush-mid`), lipstick (`p5-step6-lips-after`), accessories (`p6-necklace-on`), stickers (`p7-step8-stickers-done`), then the photo reveal with confetti and three stars lighting one by one (`p7-reveal-500-reveal`) and the results card (`p7-reveal-5000-results`): 4/4 matched, 3 stars, +225 coins.
- **The lift is the one thing a first-timer could trip on.** A child who puts a finger _on_ the target gets, after four scrub rows: eye shadow 77%, mascara 55%, blush 24%, lips **0%** (the tip lands 46 px above the finger, on the nose). A child who aims the visible tool tip gets 100 / 75 / 100 / 100%. Because the tool is drawn and moves with the finger, most children will adjust within seconds, so I do **not** rate it baseline-blocking, but nothing teaches it and the hint text does not mention it. The lips target is only ≈ 35 × 81 px even at 1.75× zoom.
- **Reading:** the request card and the hint bubbles are text, and the bubble hides after the first stroke. A 7-year-old can read them, a 4–5-year-old would rely on the pictures: the dirty "before" face, the illustrated tray discs and the glowing Next button are good, but there is no idle nudge (pulse on the target, ghost finger) to show what to do.
- **Safety and calm:** no external link but the hub, no ads, no network; leaving shows a clear sheet ("Your coins are safe, but this makeover will be lost") with big Keep playing / Leave buttons; unlocking shows "Unlock Mint? It costs 50 coins. You have 90." and never spends silently.
- **Would they play twice?** Probably 2–3 rounds: a first run earns enough coins (225) to buy three or four colours, which is a real reason for "one more", but the princess never changes.
- **Larger screens:** on an 820×1180 tablet (`p18-tablet-portrait-blush`) the game fills the screen cleanly; in landscape (`p18-tablet-landscape-blush`) it is a centred portrait column with flat pink gutters, and the 844×390 phone-landscape layout moves the tray to a right-hand column. No horizontal scroll, Next and the tray on screen in all three.

### Maya — what she experienced (390×844, one thumb)

- Card position: Sparkle Salon is the 5th of 7 cards on the phone hub, so she scrolls about 1.5 screens; the "New" badge helps. After a play the card shows the best score.
- Control reach (y of 844): Redo 689, Skip/Next 688, tray 787 — all in thumb range; leave, hint and sound sit in the top corners where they are out of the way. Touch-action is `none` on the stage and overscroll is off, so a stroke never scrolls or pulls to refresh; a two-finger touch causes no errors.
- A full makeover with scripted strokes took about a minute for seven steps, so ≈ 2 minutes for a real player — a good commute length. Zero console errors throughout.

### Sam — what he experienced (1280×800, keyboard)

- Title: Tab order is Back to PlayPad → Start makeover → Sound; Enter starts, Enter on "Let's glam!" hands focus to the face, whose label says "The princess. Rub the sponge over the smudges! Use the arrow keys to move the tool and hold Space or Enter to apply it."
- **Cost of a full makeover by keyboard: ≈ 247 arrow presses and 61 Tab presses**, with Shift for 22-unit jumps (without Shift a blind sweep reached only 42% of the cleanse after 210 presses and stalled). Skipping every step takes 14 key presses from the title for 1 star and 15 coins (measured). That is workable for a sighted keyboard user and tiring for anyone else.
- Announcements (`#sr`): "Step 1 of 8: Cleanse…", "Sky blue selected", "Cleanse complete! Plus 10 coins.", and "3 out of 3 stars. +225 coins. New best score: 540!". There are no progress announcements while painting, and the smudges' positions are not described, so a screen-reader-only user cannot know where to rub — inherent to a drawing game; Skip keeps it completable.
- Focus: the selected tray disc is a large purple halo, keyboard focus a separate 3 px indigo outline (`p20-focus-nonselected`, `p20-focus-next`), both visible. Results focus lands on "Play again".

**Non-blocking feedback → `docs/IDEAS.md`:**

- Hair/jaw/prop art pass beyond RT-1: glitter on the dress, pink-blue-violet iris gradient, finer lashes, a red exit button and a bulb pillar to match the reference more closely.
- Show-me affordances for non-readers: a pulsing ring on the target region after ~4 s idle, a dotted line from fingertip to tool tip on first touch, icon-only hints.
- Hub card: use the princess portrait as the card art and surface the "Kids" tag.
- Keyboard speed: an "apply step" shortcut and 25/50/75% progress announcements.
- Sound: stagger and re-tune the completion cues; add loop variation (a second 8-bar section) and a mid-range doubling of the bass line; consider a short "Mmm!" voiced giggle from filtered formant tones.
- More tactile tap steps: drag stickers into place, slide the lens in; a "wipe the mirror" finish flourish.
- Replay: a second princess or hairstyle, a gallery of past photos (stored `looks` already keeps six), a daily client.
- Desktop: continue the bokeh backdrop into the gutters instead of flat gradients.

---

## 5C — Round-table sessions

### RT-1 — Fidelity pass: hair palette, jaw/neck, props on screen

- **Raised by:** Senior PM (owner's ask: "design fidelity, I do not accept less"); UX Designer (side-by-side); Priya & kid agreed the princess and props should look like the picture she would be shown. No persona reported a baseline or value miss.
- **Problem:** the character — the visual centre — is the place where the game visibly departs from the reference: amber/heavily shaded hair (≈ 11% darkened pixels vs ≈ 2%), a pointed jaw and muddy neck shadow, and a mascara wand whose heart tube is off-screen; two steps show no resting tool.
- **Plan (art-only; no logic, no new files, no network):**
  1. Hair: lighten `#gBackBase` stops to ≈ `#f0a21c / #f8bc34 / #ffd45a` and thin the dark strand overlays; leave the already-matching `gbangA`/`gbangB` highlights. Acceptance: same pixel measure on the 390×844 title screenshot gives mean brightness ≥ 0.96 and ≤ 4% darkened hair pixels.
  2. Face: round the chin path; soften the neck shadow (lower opacity, pinker). Acceptance: UX sign-off against `fidelity-side-by-side` at title zoom and at the 1.75× lipstick zoom.
  3. Props: shorten or re-pivot the wand so the heart tube is on screen at 390 px; make the resting position of every tool land inside the viewport (mascara and lipstick steps); round the brush head. Acceptance: tool visible at rest in all five tool steps at 390×844 and 360×640.
  4. Re-run `features/sparkle-salon/probe.mjs` (AC-15/16/20 are the ones layout changes can touch) and `npm run smoke`.
- **Implemented:** yes — commit `6894121` (lemon hair, rounder chin + pinker neck shadow, round puff brush, wand tube and every resting tool on screen, plus a first-touch tip guide, a 4 s idle nudge and staggered completion chimes added by the builder beyond the plan). Re-validated in round 2 below.
- **Re-validation:** PM + UX re-check the side-by-side (title, blush at 1.2×, lipstick at 1.75×) and Priya re-checks the props; Maya and Sam need no re-run unless layout changes.
- **Status:** **CLOSED — all four plan items MET in round 2 of 3** (evidence in "Round 2" below).

---

## Round 2 — RT-1 re-validation (PM + UX Designer + Priya & kid)

**Run at:** 2026-11-22 · **Build:** `6894121` · **Mode:** ☒ live (own server `node tools/serve.mjs 5652`, headless Chromium, `hasTouch`/`isMobile`, **real touch via CDP**; Playwright probe + smoke re-run) · **Sound not heard** (the staggered chimes are code-reviewed only). Screenshots and scripts are in the session scratchpad (`…/scratchpad/pv-ss2/`, `pvdrv2/`), not in the repo; the owner's reference was only compared, never copied into the repo. The `games/brick-buddies/index.html` change in the working tree is another task's work and was not touched.

### RT-1 plan items, each independently verified

| #   | RT-1 item and acceptance                                                                                                                                                       | Result  | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Hair** palette lifted to lemon: same pixel class (hue 28–62°, sat ≥ .45, value ≥ .5) on the 390×844 title screenshot gives mean brightness ≥ 0.96, ≤ 4% darkened, hue 42–45° | **MET** | My own 390×844 title shot, same `hairmeasure.py`: **1× n=66,724 hue 42.83°, brightness 0.983, 0.17% darkened; 2× n=267,307 hue 42.89°, 0.983, 0.15%.** Reference by the same script: 43.75°, 0.966, 2.07%. Round 1 game: 39.4°, 0.930, 10.7%. Side by side (`side-by-side-title`, `side-by-side-glam`, `face-crop-title`): the hair reads lemon like the reference. The game is now slightly _flatter_ than the reference (0.15% vs 2.07% dark pixels): cosmetic, parked below.                                                                                                                                                                                                                                                   |
| 2   | **Face**: rounder chin, softer/pinker neck shadow; UX sign-off vs the side-by-side at title zoom and at the 1.75× lipstick zoom                                                | **MET** | Title zoom (`face-crop-title`): the chin is a rounded U where round 1 had a V-point. At 1.75× (`props-s5-lips-390x844`): rounded chin and a soft pink neck shadow, no brown-pink band. UX sign-off: **8 / 10** (was 6.5). Residual: the lower jaw still tapers a little faster than the reference's fuller, rounder chin.                                                                                                                                                                                                                                                                                                                                                                                                         |
| 3   | **Props**: heart tube on screen, round fluffy brush puff, every tool visible at rest inside the viewport above Redo/Skip in all tool steps at 390×844 and 360×640              | **MET** | DOM bounding boxes **and** a pixel diff (tool shown vs hidden), all 6 tool steps (sponge, brush ×2, wand, lipstick, sticker) at **390×844 and 360×640**, plus 375×667, 320×568, 844×390 and 820×1180: every tool is inside the viewport and the stage, above the Redo/Skip row (`props-sheet-390x844`, `props-sheet-360x640`). The wand's **red heart tube is fully visible** at rest; lipstick is now visible at rest (round 1: none); the brush head is a round scalloped puff (`props-vs-ref`). One nit, not a miss: at 360×640 and 375×667 the blush brush's DOM box (it includes the drop-shadow region) overshoots the Redo row's top by 3 px, but the rendered pixels end at y = 437 against the row at 453 (16 px clear). |
| 4   | **Regression run**: `probe.mjs` (AC-15/16/20 especially) and `npm run smoke`                                                                                                   | **MET** | `probe.mjs` against my server: **70/70 PASS**, including `RT1-hair` (n=66,221, 42.8°, 0.983, 0.16%), `RT1-props`, `RT1-guide`, `RT1-nudge`, AC-15a–g, AC-16 at 390×844 / 844×390 / 820×1180 / 1280×800 / 360×640, SS-C01–C11 and R2-01–06. `npm run smoke`: **24/24 PASS** (Sparkle Salon reaches its in-round state at 390×844 and 1366×800).                                                                                                                                                                                                                                                                                                                                                                                    |

### Builder additions beyond the plan (checked because Priya's round-1 friction was the lifted tool)

- **First-touch tip guide** — works as built: on the first touch of each paint step (cleanse, shadow, mascara, blush, lips) a 46 px dotted line from the fingertip to the tool tip, a pulse ring at the tip and the bubble "Paint with the tip!" appear for ≈ 1.8 s, follow the finger, are not repeated on that step, and are shown only for touch (`g-cleanse-touch-150ms`, `g-shadow-touch-200ms`, `f-lips-first-touch`). With reduced motion the line and ring stay, as a static ring.
- **Idle nudge** — works as built: after ≈ 4 s of no action a 64 px ring pulses on the part still to do (cleanse: the largest smudge; shadow: the left lid, with more left to do) and the hint is said again; any touch hides it; with reduced motion it never shows (`g-cleanse-nudge`, `g-shadow-nudge`).
- **Staggered chimes** (code-reviewed): chime, coin and giggle now start 120 ms apart and the coin is retuned to G6→C7, chord tones of the chime, which answers round-1 sound risk 1. Not heard.

### Priya & kid on a phone — does finger-on-target painting work now? (real CDP touch, 390×844)

Same measurement as round 1 (`p17`): a finger placed ON the target, four scrub rows, then the same strokes with the finger 46 px lower so the visible tip is on target.

| Step       | Round 1: finger on target | **Round 2: finger on target** | Round 2: aiming the visible tip |
| ---------- | ------------------------- | ----------------------------- | ------------------------------- |
| Eye shadow | 77%                       | **76%**                       | 100%                            |
| Mascara    | 55%                       | **56%**                       | 72% (4 rows; 75% in round 1)    |
| Blush      | 24%                       | **20%**                       | 100%                            |
| Lipstick   | 0%                        | **0%**                        | 100%                            |

**Honest reading:** the tip guidance does **not** make a finger placed on the target paint it — the 46 px lift is unchanged (`TOUCH_LIFT`), so the numbers are the same as round 1 within noise, and the lips are still 0% for a child who never looks up. What changed is that a child is now _told_, in the picture (dotted line + pulse) and in words, the first time it matters. A "learner" run — finger on the target first, then adapting after the guide — completed **all eight steps**, matched **4/4**, earned **3 stars and 225 coins**, with the guide shown on all five paint steps and **0 console errors** (≈ 61 s scripted; `f-*` shots). That is the same outcome as round 1, with the friction now explained on screen. Round 1 rated the lift non-blocking; it is still non-blocking, and the guide is a real mitigation rather than a fix. The idle nudge rings the _region_, so a child who then puts a finger on the ring still lands the tip ≈ 46 px above it until the first-touch guide teaches otherwise (see the non-blocking list).

**No regressions found in the flow:** title → request card → 8 steps → reveal → results all render; results at 390×844, 360×640 and 320×568 show Play again and PlayPad on screen with no horizontal scroll (`res-sheet`, `f-results`); locked colours, unlock, persistence, reduced motion, keyboard and sound gating are covered by the 70/70 probe.

### Verdicts

**Senior PM — `PASS`.** All four RT-1 items are met by measurement, not opinion. The business outcome, the fun mechanics and the sound design were already met in round 1, and the one thing the owner said they would not compromise on — fidelity of the character — now clears the reference-palette and prop checks.

- _Evidence anchor:_ "the visuals are clear, colourful and friendly (they match the owner's reference)" — `requirements.md`, Value bar. The hair is now measured at 42.8° / 0.983 against the reference's 43.75° / 0.966.
- _One-line summary:_ the princess is now the right shade of blonde with a softer chin, and the make-up tools you hold are fully on screen with the red heart tube showing, so the game is at the owner's bar for fidelity on what matters most; what remains is polish.

**Fidelity scorecard (UX Designer, side by side at 390×844) — before → after:**

| Element                                             | Round 1 | **Round 2** | Note                                                                                                                                                          |
| --------------------------------------------------- | ------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hair                                                | 6       | **8.5**     | Colour matches; the side locks are wavier than the reference's smooth swoops and the shading is flatter.                                                      |
| Face shape / neck                                   | 6.5     | **8**       | Rounded chin, soft pink neck shadow; the jaw still tapers a little more than the reference.                                                                   |
| Props (brush, wand, lipstick, sponge)               | 7       | **8**       | All on screen at rest, red heart tube visible, round puff; the wand head is chunkier than the reference's slim tip and its tube is taller than the squat cup. |
| Tray, HUD, composition, eyes, lips, blush, backdrop | 7–9     | unchanged   | Not in RT-1. Eye iris gradient, lash finesse, dress glitter, red exit button and the bulb pillar remain the known, parked departures.                         |

**Persona panel — round 2 scores:**

| Persona                                | Baseline | Value   | Satisfaction          | Critical? | Basis                                                                                                                                                                                                                                                                                    |
| -------------------------------------- | -------- | ------- | --------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Priya & kid** — Sofa Co-op (touch)   | **met**  | **met** | **4 / 5** (was 4 / 5) | n         | Re-driven live. The visuals now look like the picture she would be shown; the tip is taught on first touch and 100% coverage is reached once the tip is aimed. Held at 4: the finger-on-target miss is unchanged and the first-touch guide shows only once per step.                     |
| **Maya** — Commuter Casual (phone)     | **met**  | **met** | **3 / 5** (unchanged) | n         | **Not re-driven by hand** (RT-1 said no re-run unless layout changed). Carried forward and supported by the probe: AC-16 reach on all five viewports, SS-C04 48 px targets, SS-C06 results buttons on screen. Tools now rest in the viewport on every step, which helps one-handed play. |
| **Sam** — Keyboard / AT user (desktop) | **met**  | **met** | **3 / 5** (unchanged) | n         | **Not re-driven by hand.** Carried forward and supported by the probe: AC-15c/d/e (tray Enter, arrows + Space, Esc), SS-C01/C02/C11, AC-20 focus and live-region checks; the new guide is touch-only and the nudge is decoration (`aria-hidden`), so the keyboard path is not affected.  |

### Overall gate (round 2)

1. **PM = `PASS`** ✔ 2. **Every target persona: baseline = met AND value = met** ✔ 3. **Zero open baseline/value-blocking criticals** ✔ → **PASS**. Round table used **1 of 3** rounds (RT-1, closed). No escalation; nothing to log in `findings-ledger.md` as STOP-SHIP.

### Remaining items — all non-blocking (→ `docs/IDEAS.md`)

- **Finger-on-target still misses** (76 / 56 / 20 / 0%). Options, cheapest first: keep the "Paint with the tip!" guide until the first successful stroke on the step rather than 1.8 s; point the idle nudge at where the _finger_ should go (ring centre + the lift) or add a small fingertip glyph under it; use a smaller lift (≈ 28–32 px) on the lips step where the target is only ≈ 35 × 81 px. If real children still miss, this is the first thing to revisit.
- **Hair/face polish:** a little more strand shading (reference 2% dark pixels vs 0.15%), smoother side locks, a fuller round chin.
- **Prop polish:** a slimmer wand head and a squat red tube with a gold rim and gem heart, as in the reference.
- Carried from round 1, unchanged: iris pink-blue-violet gradient, finer lashes, dress glitter, red exit button, bulb pillar, hub card art and "Kids" tag, keyboard shortcut and progress announcements, loop variation and mid-range bass for the music, more tactile tap steps, a second princess or a photo gallery, bokeh in desktop gutters.
- **Sound:** confirm the 120 ms stagger and the retuned coin by ear on a phone speaker (never heard here).

---

## Human summary

Sparkle Salon meets the business goal: a child can finish a full makeover on a phone with finger strokes and taps, a keyboard-only player can finish it too, coins and unlocks persist, the hub shows the best score, and the rub-and-reward loop and the (code-reviewed) sound design are strong. All three target personas clear the baseline and value bars (Priya & kid 4/5, Maya 3/5, Sam 3/5 satisfaction), so nothing blocks them.

What blocks the gate is the owner's own bar: the screen layout, tray and HUD are a faithful match for the reference, but the princess herself is a shade too orange and heavily shaded, her chin is more pointed and the mascara wand's heart tube is off-screen. These are cheap art fixes (RT-1); once done and re-checked side by side, this should go to PASS. Everything else found is logged for the backlog, not for this gate.

**Round 2 update:** the RT-1 art pass landed and was re-checked independently. The hair now measures 42.8° / 0.983 / 0.17% darkened against the reference's 43.75° / 0.966 / 2.07%, the chin is rounded, the neck shadow is soft pink, and every tool rests fully on screen with the wand's red heart tube visible at 390×844 and 360×640 (and four other sizes). The probe passes 70/70 and the smoke test 24/24. The new tip guide and idle nudge work as built, but they teach rather than fix: a finger placed on the target still paints 0% of the lips, so a child has to learn to aim the visible tip, which a learner run did, finishing with 4/4 matches, 3 stars and 225 coins. The PM verdict is **PASS** and the overall product gate is **PASS**; the remaining items are polish for `docs/IDEAS.md`.

---

### Loop control

If the gate is BLOCKED → fix (Phase 3) and re-run the blocked stage, adding a new round above. On PASS → proceed to **Phase 6 (CAPTURE)**: log product/UX learnings, move non-blocking feedback to `docs/IDEAS.md`, update `docs/findings-ledger.md`.

---

## Post-launch UAT (after the feature is live)

> **PM-led.** Same gate and round-table mechanics, but against real usage. Trigger when the feature ships. Skip until then.

**UAT run at:** \_\_\_\_ **Led by:** Senior PM

- **What was checked with users / real usage:** _..._
- **Feedback gathered:** _..._
- **Round table (PM + UX + affected persona[s]):** _plan → implement (Phase 3) → re-validate; same ≤ 3-round loop._
- **Outcome:** ☐ confirmed in the wild ☐ changes looped back through Phase 3

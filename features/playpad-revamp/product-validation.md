# Product & UX Validation — PlayPad revamp (hub + all five games)

> **Phase 5 of the workflow.** Technical QA has passed. This step checks the revamp is worth shipping. The PM checks the business requirement. Each target persona checks it can finish its goal and would come back. **Gate:** baseline + value must be MET. Satisfaction is scored but does not gate.

**Feature:** PlayPad revamp · **Ticket:** PLAY-006 · **Date:** 2026-11-21 · **Branch:** `claude/brave-wozniak-li4rry` @ `f66f668`

**Method.** Every flow was played hands-on in Playwright Chromium against `node tools/serve.mjs`. Neon Rush ran on SwiftShader software GL, so its visuals were judged and its fps was not. Each flow covered: hub → choose → setup → start → a full round → results → play again → quit → back to hub. Devices: phone 390×844 (touch), landscape phone 844×390 (touch), laptop 1366×800 (mouse + keyboard). One pass was keyboard only. Colour Rush dots were tapped live. Snap matches were slapped on real reveals. Claw Catch was steered with the joystick or arrow keys over a visible prize. Super Decoder was solved by placing pegs from the board's own feedback. Neon Rush got swipes or arrow keys. All 13 flows had **0 console/page errors** and **0 horizontal overflow**. Screenshots are in `…/scratchpad/playtest/` (`hub-*`, `colour-rush-*`, `snap-*`, `claw-*`, `dec-*`, `sam-*`, `neon-*`). The pre-revamp state is in `…/scratchpad/shots/`.

### Hub → in-round (measured)

| Game          | Phone (user actions → in round)                                              | Laptop                      | Notes                                                                         |
| ------------- | ---------------------------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------- |
| Colour Rush   | 2 taps → ~5 s (incl. 3-2-1)                                                  | 2 clicks → ~5 s             | 2 players preselected. Start stays on screen (sticky bar)                     |
| Snap          | 2 taps → ~5 s                                                                | 2 → ~5 s                    | Same                                                                          |
| Claw Catch    | 2–3 taps **+ ~1.7 screens of scroll** → ~4 s automated (~6–7 s for a person) | same scroll at 800 px tall  | Start sits under the prize key (y≈1435 on phone, ≈1387 on laptop)             |
| Super Decoder | 2 taps → <1 s                                                                | 2 → <1 s                    | No countdown                                                                  |
| Neon Rush     | 2 taps → ~6 s on software GL (~2–3 s on real hardware)                       | 2 → ~6 s                    | 1.2 s 3-2-1. Retries skip straight to GO                                      |
| _Keyboard_    | —                                                                            | 3 Tabs + Enter → "Play now" | Skip link → theme → Play now → Surprise → chips → cards, all with a 3 px ring |

Every game is under ~10 s of user effort. The hero's **Play now** gets there in **one tap** from page load.

---

## 5A — Senior PM review (business requirement)

**Business requirement:** "a first-time visitor on a phone or a laptop can pick a game and be playing within ~10 seconds, and every game feels finished."

**Verdict: PASS.**

- **Choose faster than before.** Before the revamp, a phone showed one carousel card (`shots/m-hub.png`). Now it shows a "Game of the day / Jump back in" hero with Play now + Surprise me, Solo / Play together filter chips, and list cards with 2.5+ games above the fold (`hub-m-dark.png`). The desktop grid shows all 5 games with no dead canvas (`hub-d-light.png`). Jump back in correctly reflected the last game played every time.
- **Every game reaches round → results → play again → hub** on touch and mouse/keyboard, with no errors. Results screens all offer Play again / Change settings / Back to PlayPad. Bests persist: Claw shows "Best (0:30 · Normal)", Decoder shows "★ New best!", and Neon shows "NEW BEST SCORE".
- **Owner's asks met.** Neon Rush is visibly transformed. Compare the flat clay city with floating blocks (`shots/neon-play.png`) against the textured night street, lit windows, neon signs, synthwave sun, lamps, coins and tram (`neon-d-run1.png`, `neon-m-run2.png`). Animation probes showed weights summing to 1 in every state (run, jump, air, slide, death), so there is no T-pose. The wide-arm air pose is the authored KayKit `Jump_Idle` clip, and `groundGap` max is 0.02 (nothing floats). Claw Catch went from flat prizes on a bare floor (`shots/claw-play.png`) to a cabinet with marquee, glass, heaped tumbling pile, chute, aim line, streaks and a prize shelf on results (`claw-m-mid.png`, `claw-m-results.png`).
- **Scope discipline / coherence.** Add-a-game is still one object in `games.js` (documented header, optional `tagline`/`added`/`best`). Light + dark theme work, and the toggle persists. No out-of-scope work is half-built.
- **Issues (none blocking):** MEDIUM. The Claw Catch Start button is below the fold on both phone and laptop. It is the only game whose primary action needs a scroll, which works against the "~10 s" outcome for Solo Sam / Kid Pilot. Recommended change: reuse Colour Rush's sticky `start-bar`, or move the prize key below Start.

**Evidence anchor:** "a first-time visitor on a phone or a laptop can pick a game and be playing within ~10 seconds" — measured at 1–3 actions and ≤ ~7 s for every game.
**Summary:** Anyone can open PlayPad and be playing in one or two taps. Every game now plays all the way through and looks finished. Ship it, and add the small Claw Catch fix.

## 5B — Persona panel

| Persona (device)                    | Game(s)                  | Baseline | Value | Sat. | Why                                                                                                                                                                                                                                                                                                        |
| ----------------------------------- | ------------------------ | -------- | ----- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Priya & kid — Sofa Co-op (phone)    | Colour Rush, Snap        | MET      | MET   | 4    | 2 players preselected, so the child joins with zero setup. Dots and slap pads are huge, colour + shape coded, and Blue's pad is mirrored for the player opposite. Winner/tie screen with trophy and "Fastest snap". Long Colour Rush setup page, but Start is sticky.                                      |
| Solo Sam — lone break (laptop)      | Claw Catch               | MET      | MET   | 4    | ← → + Space feel tight. Aim line + "Got it! Reeling it to the bay…" feedback. Caught 7 of 8 for 35 with a ×2 streak. "New best!" + prize shelf invite another go. Scrolling past the prize key to reach Start is the one irritation.                                                                       |
| Kid Pilot — young player (phone)    | Claw Catch               | MET      | MET   | 4    | Chunky joystick + big pink DROP. Emoji prizes and ★ rarity readable pre-literacy. No fail state. Caught 5 of 7 on Normal. ✕ quits instantly with no confirm (other games ask "Quit?"), but it sits in the HUD far from the controls.                                                                       |
| Dan — Office Micro-breaker (laptop) | Super Decoder, Neon Rush | MET      | MET   | 5    | Decoder Easy session = 3 codes in ~2 min with digits + Enter. A "Code cracked!" card each time and "Perfect session!". Neon: arrow keys, a run lasts well under a break, Try again restarts instantly. The city looks premium now.                                                                         |
| Maya — Commuter Casual (phone)      | Neon Rush, Super Decoder | MET      | MET   | 4    | One tap from the hero. Swipes work one-handed. Magnet chip, coin trails, HUD clear of the action. Decoder palette + Submit sit in the thumb zone. In landscape, Neon's "Try again" is two screens down on results.                                                                                         |
| Sam — Keyboard / AT (laptop)        | Super Decoder (+ hub)    | MET      | MET   | 4    | Skip link first. Logical tab order. A 3 px focus ring on every stop, including cards. `aria-pressed` chips + live "Showing n solo games". Setup tab order ends at Start. 1–6 / ← → / Enter drive the board, and focus lands on the results title. A specific card takes 11 Tabs (Skip link shortens this). |

_The Builder-Owner was spot-checked: the registry header documents the one-object add, and the hub renders bests/New badges from optional fields. MET/MET._

## Round table / escalations

None required. All baseline and value gates were MET on the first pass. **No CRITICAL (baseline/value-blocking) issues were found.**

## Non-blocking feedback → `docs/IDEAS.md`

1. **Claw Catch: make Start reachable without scrolling.** Use a sticky start bar like the party games, or put Start above the prize key. This is the PM's MEDIUM issue and is recommended before or soon after ship.
2. **Claw Catch: two-tap quit.** Use the same "✕ → Quit?" confirm as Colour Rush/Snap/Decoder, so a child's stray tap doesn't end the round.
3. **Short-landscape results (Claw, Neon).** At 844×390, Play again / Try again is below the fold. Colour Rush/Snap already use a side-by-side results layout there; reuse it. Also, the hub hero's Play now sits just below the fold in landscape.
4. **Hub "Best" badges for Claw Catch and Super Decoder.** Both save bests, but only Neon Rush has a `best` descriptor, so only it shows 🏆 on the hub. This needs a descriptor that can read their per-mode save shape.
5. **Neon Rush results copy.** "You ran 135m" next to "Score 250" looks inconsistent. Say that coins add to the score (e.g. "135 m + 23 coins").
6. **Neon Rush skyline.** A dark skyline block sits square on the road's vanishing point and reads like a wall at the end of the street. Offset it or fade it into the fog.
7. **Hub "Play" for keyboard users.** Consider a roving-tabindex grid, or arrow keys between cards, to cut the 11-Tab walk to the 5th card.

_Calibration: synthetic personas catch obvious misses. A clean panel means "no obvious problems", not "validated by real users"._

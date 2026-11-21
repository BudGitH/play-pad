# Product Validation: Sunset Stride (Neon Rush rework)

> **Phase 5 output.** Produced after technical QA (`qa-report.md`) was PASS. The product gate: Senior PM (5A), the three target personas (5B), and one round-table loop (5C). All roles were spawned fresh from `docs/PRODUCT-PANEL.md`.
>
> **Honest caveat.** The personas are synthetic and judged **artifacts only** (requirements, code, screenshots captured from the running build). Nobody played the game with real hands or ears. A clean panel means "no obvious misses found", not "real players will love it".

**Feature:** Sunset Stride — golden-hour rebuild of Neon Rush (bright readable look, real runner animation, dogs behind the runner, real-world obstacles, polished models, particles + synthesised audio)
**Ticket:** PLAY-007
**Run at:** 2026-11-21 (PM round 2 · personas rounds 1–3)
**Overall product gate:** ☑ PASS ☐ BLOCKED ☐ BLOCKED — ESCALATED

---

## The gate (how this PASSES)

Baseline met (hard) · Value met (hard) · Satisfaction scored (never gated). PASS needs: PM = `PASS`; every target persona baseline **and** value = met; no open baseline/value-blocking critical. Round table ≤ 3 rounds.

---

## 5A — Senior PM review (business requirements)

| Round | Verdict | Blocking issues | Notes                                                                                                                                   |
| ----- | ------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | PASS    | 0               | First build (before the fidelity, obstacle and FX requests); 4 MEDIUMs fixed                                                            |
| 2     | PASS    | 0               | Re-run for the full scope incl. AC11 (fidelity) and AC12 (particles + audio); 0 CRITICAL / HIGH, **7 MEDIUM** (all dispositioned below) |

**Owner requests, one by one (PM round 2, from the evidence):** look & readability — met · chill name — met · no T-pose / real runner — met for rig and pose (motion feel unverifiable) · chasers from behind — met · "not squashed" slide — met · better mechanics — met (fairness is persona-only) · better models — met · high fidelity — **partly, stated honestly** (polished stylised low-poly, not photoreal) · real-world obstacles — met · particles — met but subtle · good audio — partly met, **unverifiable** (every cue is trigger-tested; nobody has heard the mix).

**PM round-2 issues and what was done:**

- **M1** screenshots stale → re-captured every standard screenshot from the final build (the set lives in the session scratchpad, not the repo).
- **M2** power-up chip covered the dogs → moved under the dog meter (`phone-8-powerups-dock.png`).
- **M3** AC12 never independently reviewed → independent review ran (`qa-report.md`, PASS, 3 MEDIUM fixed or ticketed). **A human still has not listened to the mix** — the owner should, on a phone.
- **M4** "high fidelity" gap had no decision record → `docs/DECISIONS.md` + `docs/IDEAS.md`.
- **M5** hints said "swipe" to desktop players → control-aware hints and how-to labels.
- **M6** unverified limits not stated → "Verified by / NOT verified" added to the requirements' NFRs.
- **M7** small coherence gaps → README + CREDITS fixed; "carried-over save" note and more outfits → IDEAS.

**Evidence anchor:** requirements.md — "the flagship solo game is readable at a glance on a phone in daylight, feels like running, and still carries the progression loop (coins → skins → high score) that makes players come back."

---

## 5B — Persona panel (usability & value)

**Evaluation mode:** ☑ artifacts (requirements + code + screenshots from the running build) ☐ live ☑ **Unverified: audio, motion feel, real-handset performance, real-thumb swipe latency, screen-reader output.**

| Persona (target)                     | Round | Baseline                   | Value                                   | Satisfaction | Critical? | Key feedback                                                                                                                                                 |
| ------------------------------------ | ----- | -------------------------- | --------------------------------------- | ------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Maya "Commuter Casual" (phone)       | 1     | met (Start below the fold) | met (provisional)                       | 3.5          | no        | Start below the fold (HIGH); swipe resolved on lift; steep-looking ramp; thin "why did I die"; sound on by default next to instant quit                      |
|                                      | 2     | **met**                    | **met** (provisional)                   | 3.5          | no        | Start + swipe fixed; ramp / death text / quit still parked; new: Sound toggle fell below the sticky bar → moved above the how-to                             |
| Dan "Office Micro-breaker" (desktop) | 1     | met                        | partial                                 | 3            | no        | Start below the fold at 1280×720; no keyboard-only loop; P / M undiscoverable; phone-only labels                                                             |
|                                      | 2     | **met**                    | **met** (caveat: run length unmeasured) | 4            | no        | Start, keyboard loop, labels fixed; Sound toggle moved up (his residual); hint toasts repeat per visit → IDEAS                                               |
| Sam "Keyboard / AT user"             | 1     | met                        | partial                                 | 3            | no        | 3-2-1 numeral pulse (~3 Hz); Esc quit from Pause + HUD tabbable under the modal; shop Equip unnamed + focus lost; chords / repeat steered                    |
|                                      | 2     | met                        | partial, leaning met                    | 4            | no        | All five fixed; residuals: dimmed focus ring on Equipped, announcement noise, contrast, landmark                                                             |
|                                      | 3     | **met**                    | **met**                                 | 4            | no        | Residuals fixed (ring, M announces, toast cleared, `role=main`, contrast raised); remaining gaps are satisfaction / polish, none baseline- or value-blocking |

**Non-blocking feedback → `docs/IDEAS.md`:** difficulty ramp for first runs (needs a real playtest) · "what hit you" on results + first-stumble warning · two-step quit · a "Calm" / Reduce-effects mode, danger-window announcements, reduced-motion change listener · persisted hint-seen · phone-size particle stills · audio tuning after the owner listens · a real fidelity step · carried-over-save note + more outfits.

---

## 5C — Round-table sessions

### RT-1 — Value "partial" for Dan and Sam (Start below the fold, no keyboard loop, modal pause, 3-2-1 pulse, shop focus)

- **Raised by:** Dan, Maya (Start), Sam. No CRITICAL; value-blocking because the gate needs value = met.
- **Problem:** a 5-row how-to pushed Start off the first screen on a phone and a 1280×720 desktop; no keyboard retry / pause / mute loop; Esc both paused and quit (a double tap ended the run); HUD tabbable under the modal Pause; the 3-2-1 numeral faded every 300 ms (≈ 3 Hz pulse over a large glyph); shop Equip unnamed and focus lost after Buy / Equip; Ctrl / Alt chords and key repeat steered; swipes acted on finger-lift.
- **Plan (PM + UX + personas):** sticky Start bar; control-aware labels; Esc / P pause, Esc resumes, M mutes, Try again focused + R retries; HUD inert while paused; scale-only countdown; named shop buttons that keep focus; ignore chords and repeats; swipe at 30 px.
- **Implemented:** all of the above, with probe AC13 (9 checks) and AC12 lifecycle checks; later rounds moved the Sound toggle above the how-to (sticky Start had pushed it down), kept the focus ring visible on the dimmed Equipped button, announced M, cleared stale toast text, added `role=main` and raised two contrast values.
- **Re-validation:** Maya met / met (provisional); Dan met / met; Sam met / met after round 3.
- **Status:** **RESOLVED** in 3 rounds (the cap).

---

## Human summary

Sunset Stride delivers what was asked: it is bright and readable, the runner really runs and slides, the dogs chase from behind, the obstacles are real street objects, and every action now has a particle and a sound. The three target personas (a phone commuter, a desktop break-taker and a keyboard / reduced-motion player) all end at baseline met and value met, after one round of real fixes (Start was below the fold, the keyboard loop was missing, Esc could quit by accident, the countdown pulsed). What is **not** proven: nobody has listened to the audio or felt the motion, the game has not run on a real phone, the difficulty ramp has not been playtested, and "high fidelity" means polished stylised low-poly, not photoreal. Those are the owner's to check, and each is logged in `docs/IDEAS.md`.

---

### Loop control

PASS → Phase 6 (CAPTURE) done: learnings, decisions, ledger and ideas updated in the same change.

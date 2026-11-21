# QA Report — Claw Catch (Post-Run Findings)

> **Phase 4 of the workflow.** Merged + deduped output of the multi-lens QA panel (Accuracy / Quality / Compliance / Risk), plus the end-to-end browser verification. **Gate:** no unresolved CRITICAL/HIGH.

**Feature:** Claw Catch · **Ticket:** PLAY-003 · **Date:** 2026-06-27
**Panel:** 2 independent reviewers — (A) Quality + Compliance, (B) Risk + Accuracy — reviewing `games/claw-catch/index.html`.
**Both panel verdicts:** CLEAN (no CRITICAL/HIGH).

---

## Browser verification (preview MCP) — all 10 acceptance criteria PASS

| AC | Check | Evidence |
|----|-------|----------|
| AC-1 | Hub card + loads clean | Hub renders "3 games"; Claw Catch card (🕹️, cyan, "Solo", "1"). No console errors anywhere. |
| AC-2 | 3 themes + duration + difficulty | Setup renders all; theme switch updates cabinet + prize key; 2:00/0:30 + difficulty persist into round (`__claw.cfg`). |
| AC-3 | Move via keyboard + joystick, bounded | ArrowRight moved cart 527→979 then clamped at the wall; joystick UI drives `joyAxis`. |
| AC-4 | Flick swing + settle | A 280ms flick → **peak |θ| = 0.47 rad (~27°)**, 0.44 at release, **decays to 0.21 after 1s** — drives + damps as designed. |
| AC-5 | Grab sequence once, input-locked | Phase trace `idle→drop→close→lift→return→release→idle`, exactly once. |
| AC-6 | Catch on-target / miss off-target | Centred prize → caught; grab over empty chute area → score unchanged, "Empty grab" feedback. |
| AC-7 | Rarity scoring = shown value | Forced Uncommon caught for **+3** — equals the prize-key value. Common → +1 (smoke). |
| AC-8 | Capped refill | Observed `binMax` reach exactly **10 = binCap** and never exceed; `addPrize` guards `< binCap`. |
| AC-9 | Round end + results | Clock to 0:00 → results: "You scored 4 from 2 prizes", Score 4 / Caught 2 / Best +3. Buttons work. |
| AC-10 | Reduced motion + responsive | Game state is JS/canvas-driven (no `transitionend` gating); popups scale off `reduceMotion`. Mobile 375px: HUD + deck + joystick + grab all fit. |

---

## Panel findings & resolutions

### Resolved this cycle
- **[MEDIUM · Quality/a11y] Focused-joystick arrow keys stopped movement after 120ms.** The slider's own keydown re-implemented movement with a 120ms `setTimeout` latch that fought the global handler. **Fixed:** removed the slider movement handler (global handler already covers Arrow/A/D when the joystick is focused); slider now only maps Enter→grab (with a repeat guard).
- **[MEDIUM · Accuracy] Clock could skip the literal 0:00 frame** (session guard returned before the HUD paint). **Fixed:** `endGame()` now calls `updateSessionHud(sessionEndTs)` to force the 0:00 paint before showing results.
- **[LOW · Quality] Unnamed grab-chance constants** `0.45 / 0.55`. **Fixed:** promoted to `GRAB_BASE_CHANCE` / `GRAB_PROXIMITY_BONUS`.
- **[LOW · Quality] Dead empty `if` in joystick `pointerdown`.** **Fixed:** removed.
- **[LOW · Quality] Brace-less `if` in `drawSpring` (readability trap).** **Fixed:** braced + split.
- **[MEDIUM-doc · Quality] `binCap` vs the AC-8 `BIN_CAP` traceability gap.** **Fixed:** comment at `DIFFICULTIES` ties `binCap` to AC-8's cap.

### Accepted (no change) — documented rationale
- **[LOW · Accuracy] Refill rebases `nextRefillTs = now + refillMs` after a stall** rather than catching up. Invariant-safe (can only under-fill, never exceed cap) and deliberately avoids a post-background "flood" of prizes dropping at once. Accepted as the nicer UX.
- **[LOW · Risk] `innerHTML = ""` clears** in the chip/key/score builders. These are clears, not sinks — every dynamic value is set via `textContent`/`createTextNode`. No injection surface (no network/storage/secrets; trust boundary is local input only).
- **[INFO · Risk] `window.__claw` debug hook** exposes live state + `requestGrab`/`forcePrizeUnderTip`. Required by the Phase-2 test plan, harmless at Prototype tier (purely local; injected prizes respect the schema). Left in, per CONVENTIONS PLAY-001.

### Explicitly checked and sound (static + dynamic)
- Pendulum hard-clamped to ±`MAX_THETA` with `omega` zeroed at the bound + fixed 1/120 substep → a violent flick cannot diverge or NaN.
- RAF delta clamped to 0.05s; `sessionEndTs` is wall-clock → backgrounded tab ends at real time, no multi-phase collapse.
- Quit mid-sequence: `stopToSetup` cancels RAF, resets phase/carried/countdown, clears overlays. No dangling RAF/listeners.
- Slip-back path re-adds exactly the spliced prize → bin count returns to pre-grab value, never exceeds cap; slipped prize is neither scored nor counted.
- All listeners bound once at init (no per-round binding) → no leak across replays.

---

## Gate: **CLEAN** ✓ — no unresolved CRITICAL/HIGH. Cleared to Phase 5.

---

## Revision passes (post-ship playtest feedback)

**Rev 2 (feel & visuals):** replaced the pendulum swing with a tight **jiggle + straight vertical drop** (lateral offset decoupled from drop depth via a fixed `JIGGLE_ARM`); **chute only on a carry** (empty grabs/slips lift back in place, no chute trip); chunky **metallic claw**; **pile physics** (gravity + pairwise separation); a **proper chute box** with a drop-hole + release animation; **DROP button** (claw icon) replacing the pokeball. Verified in-browser (peak `|theta| ≤ ~0.11`, miss→`lift→idle` no chute, catch→`return→release` scores).

**Rev 3 (opacity, tension, drama):**
- **Opaque capsule prizes** — each prize is now a glossy light disc + emoji + highlight (fixes the "still transparent" emoji-on-dark issue). Verified by screenshot (capsules pop on every theme).
- **Carry tension** — carried prize bobs/sways with a periodic downward **lurch** + a prong quiver ("illusion it might drop").
- **Sudden-drop mechanic** — new per-difficulty `dropChance` (Chill 0.08 / Normal 0.18 / Tricky 0.30): a grabbed prize can fall **mid-carry** back into the pile (verified — "It dropped!" feedback observed; claw returns to idle, no score). `slipChance` lowered so the two loss paths stay fun.
- Confirmed the reported **stray red line was a stale mid-edit preview frame** (no red stroke exists in source); added a defensive `ctx.globalAlpha = 1` per frame.
- **Verification note:** the headless preview throttles RAF (advances only while a screenshot pumps frames), so the `window.__claw` data hook reads stale between evals — these revisions were verified by **screenshot**, the reliable path (logged in `docs/LEARNINGS.md`).

**Rev 4 (on-device emoji + lag):**
- **Canvas emoji were blank on the user's iPad/Chrome** (not desktop): `fillText(emoji)` with a Latin-led font doesn't fall back to a trailing emoji family on every engine. Fixed by rasterising each emoji **once** to a cached capsule **sprite** with an **emoji-first** font and `drawImage`-ing it. OS-agnostic. **Escaped earlier verification** because the Chromium preview renders canvas emoji that the user's device won't — logged as a learning + finding (`canvas-emoji-fallback`).
- **iPad lag** reduced: static gradients (cabinet/tray/chute) built once in `layout()` instead of per frame; per-prize gradient + `fillText` replaced by a sprite blit; `dpr` capped at 2. Per frame there are now **zero** prize gradient allocations and **zero** prize `fillText` calls.
- Verified locally (capsule emoji render via sprite, no console errors); **`dist/` rebuilt** and confirmed to carry the sprite/`emojiFont` code. Final emoji confirmation is on-device (the bug can't reproduce in the desktop preview) — user confirmed fixed.

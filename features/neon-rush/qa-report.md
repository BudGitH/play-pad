# QA Report (Post-Run Findings): Neon Rush

> **Phase 4 output.** Merged from the multi-lens QA panel (ACCURACY · QUALITY · COMPLIANCE · RISK). The gate: not done until clean.

**Feature:** Neon Rush — 3D endless runner
**Ticket:** PLAY-005
**Run at:** 2026-07-12 (round 1)
**Overall result:** ☑ PASS

---

## Gate summary

| Lens (dimension)                                  | Agent verdict | Findings            | Blocking? |
| ------------------------------------------------- | ------------- | ------------------- | --------- |
| ACCURACY                                          | PASS          | 1 MED, 2 LOW        | n         |
| QUALITY                                           | PASS          | 2 MED, 3 LOW        | n         |
| COMPLIANCE                                        | PASS          | 1 MED, 2 LOW        | n         |
| RISK (security)                                   | PASS          | 3 LOW               | n         |
| **Tests** (in-page `__neon` probes + screenshots) | PASS          | all AC probes green | n         |

No CRITICAL/HIGH from any lens → gate is clean. The MEDIUMs were fixed anyway (cheap, real). Remaining LOWs are logged below or deferred to `docs/IDEAS.md`.

## Findings merged & dispositions

**Fixed this round (verified via `__neon`):**

- **[ACCURACY MED] Run coins lost on quit during crash animation** — banking moved from the cancellable `showResults` timer into `onCrash()` (synchronous), `showResults` only paints. Verified: crash → immediate persist; quit during anim keeps the coins. (`index.html` `onCrash`/`showResults`)
- **[QUALITY MED] Shop price colour raw `#b8860b` fails light-theme contrast** — now `var(--md-sys-color-tertiary)`.
- **[QUALITY MED] Global keydown hijacked Space on focused HUD buttons** — added `ev.target.closest("button")` bail-out, mirroring the swipe handler's guard (LEARNINGS PLAY-003 joystick lesson).
- **[QUALITY LOW] Dead `transform-origin` on `.pu-bar`** — drain switched to `transform: scaleX()` (no per-frame layout), declaration now load-bearing.
- **[QUALITY LOW] HUD/chip DOM writes inside the fixed-step loop** — moved to a `paintHud()` called once per `render()`; sim `tick()` only decrements timers.
- **[RISK LOW] `Infinity`/`1e999` survived save sanitisation** — added `sanitizeCount()` (`Number.isFinite` + `clamp(0, 1e9)`) for coins & highScore. Verified: crafted `1e999`→0, negative→0, `__proto__` in unlocked rejected.

**Deferred to `docs/IDEAS.md` (non-blocking):**

- [QUALITY LOW] Promote repeated neon hex (`#ff2d95`/`#22e5ff`/`#ffd54a`, duplicated in CSS + the JS `NEON` object) to game-local custom properties so the two copies can't drift.
- [RISK LOW] One-time SHA-256 check of the vendored `three.min.js` against the official `three@0.148.0` artifact (authenticity currently verified by header + REVISION marker + plausible size, not hash).
- [COMPLIANCE LOW] `_headers` has no `must-revalidate` rule for per-game `index.html` (pre-existing gap shared by snap/claw-catch/super-decoder); address when the file is next touched.

**Accepted / documented (no change):**

- [RISK LOW] `window.__neon` hook ships in prod — intentional, documented in the game CLAUDE.md; grants nothing beyond DevTools on a client-only, local-save game.
- [ACCURACY LOW] Super Sneakers can't clear a tall train below ~11.4 m/s — unreachable in organic play (tall trains gate in at distance ≥120m, i.e. speed ≥16.4). Documented in `test-plan.md`; the T12 probe runs at ramped speed.
- [ACCURACY LOW / spec wording] Coin score bonus is +5, not +1 — deliberate; `requirements.md` wording clarified to "+5 score per coin".
- [COMPLIANCE MED] Brain docs owed — handled in Phase 6 CAPTURE (this same change).

## Result

Panel clean on round 1 (no blocker). Proceeding to Phase 5 product validation.

---

## v2 addendum (2026-07-12) — assets/animation/audio/instant-start

Verified via `window.__neon` probes + screenshots (headless preview; screenshots intermittently time out on the WebGL loop — logic verified through `step()`/`.skin`/`.audio` hooks):

- **r147 swap** — `THREE.REVISION==="147"`, `GLTFLoader` present; full obstacle-action regression re-run **before** any other change: barrier jump/slide, low-train jump, tall-train lane-change, no-action-crash all pass.
- **Models** — all 3 GLBs load (`.skin.loaded` = [neonbot,urban,skater]); active skin `kind:"gltf"`; run animation advances (`mixerTime` increases); slide state machine run→slide(Dodge roll)→run; **weapons hidden** (`visibleWeapons: []`); neonbot (no slide clip) uses procedural crouch without error.
- **Audio** — `.audio` = all 6 SFX decoded, `musicReal:true`, `musicPlaying:true`, ctx `running`; network shows SFX 200 + music 206 streaming; synth fallback path intact (`sfx(name, synthFn)`); drone stays synth.
- **Instant start** — first run 1.28s, retry 0.22s, tap-skip 0.18s to control.
- **Perf** — no console errors with skinned meshes; mechanics unaffected (collision boxes untouched — models are cosmetic).
- **Degradation** — fallbacks (primitive skins + synth voices) retained; documented `file://` fetch caveat.

No new CRITICAL/HIGH. Follow-ups (neon-tint the GLB skins; optional true-file:// asset embedding; mobile perf check) logged to `docs/IDEAS.md`. Collision/scoring/save logic unchanged from v1, so the v1 product gate (PM + personas PASS) still holds; v2 only improves fidelity + the start-wait the Maya persona flagged.

---

## v3.1 addendum (2026-07-13) — crossfade T-pose fix (on-device regression)

Owner-reported on the live site: character snaps to a **T-pose after jump→slide/down and never recovers** (plus a "textures missing / white" look). Diagnosis + fix verified on a local http origin (GLB loads there):

- **Root cause (T-pose)** — `ctrl.set()` revived actions with `fadeIn().play()` but three.js sets `enabled=false` when a fadeOut completes; a slide/long-jump fully fades out the run action → disabled → `fadeIn().play()` alone can't revive it → both actions weight 0 → skeleton at bind pose. Permanent because `set()` early-returns on unchanged state. **Fix:** `next.enabled = true; next.paused = false;` before the fade in `set()`. New finding `gltf-action-reenable-tpose` (findings-ledger).
- **Verified** — instrumented `AnimationMixer.prototype.update` to capture the live mixer; asserted on **per-action `isRunning()`/effective weight + skeleton bone world-X-spread** (Rogue T-pose ≈1.451 vs animated ≈0.93) — NOT on `__neon.skin.anim`, which returns the state name and transitions even with zero actions playing (that's why v3 QA missed it). All 3 skins (urban/skater/neonbot) recover across run→slide→run, jump→slide→run, and long (sneakers) jump→land; every snapshot has an active action at weight ≈1, spread never near bind pose. Screenshot confirms the character runs (arms down), fully textured, after slides.
- **Textures "missing"** — NOT a source bug: current source renders the whole scene fully textured/colored (character + KayKit city) — the live white/washed look is a **stale deployed build** predating the v3 `outputEncoding = sRGBEncoding` fix. Resolved by the rebuild + redeploy below.

`dist/` rebuilt (byte-identical to source; carries both the sRGB fix and this T-pose fix). **Redeploy pending** (user's Cloudflare Direct-Upload step) → hard-refresh device.

# PlayPad — Ideas & Backlog

> The user's ideas live here. Sessions **read this to know what to build next** and **prune shipped items** during the maintenance step.
> Bucket by horizon, not priority-within-bucket. Move items up as they become ready; move them out when shipped.

## 🔥 Now (actively building / next up)

- _(Open — pick the next item from "Next". PLAY-005 (Neon Rush) added the first 3D game + the first persistence/progression loop; PLAY-004 (Super Decoder) added the first logic title.)_

## ⏭️ Next (ready, not started)

- **Tooling follow-ups (Standard tier):** one-off repo-wide `npm run format` PR, then gate `format:check` in CI; lint inline `<script>` in game HTML (eslint-plugin-html or extract to `.js`); a minimal smoke test (Playwright: hub loads + each game opens without console errors).

- One-tap **"Quick play"** from a card → straight into a default round, skipping setup for the common case.
- Manual **light/dark toggle** (overrides the system theme).
- Search / tag **filter** once the catalog grows.
- **Kid-friendly setup** (Priya & kid): per-player names or emoji avatars instead of "Player 1/2", simpler tagline, an even-gentler "Tiny" speed below Chill.
- **Snap — young-player / handicap mode** (Priya & kid, highest-signal from Snap Phase 5): a per-player longer reveal window or a penalty-off toggle so a 7-year-old isn't benched on wrong taps and parent-vs-kid feels fair.
- **Snap — setup guidance & gentler cues**: a hint that "Chill suits little ones" by the intensity chips; an option to soften the wrong-tap buzzer/🚫 to a neutral cue; a "great try!" line on results when a player ends on 0.
- **"Playing solo? Try Colour Rush"** pointer on Snap's setup screen — redirect the lone player instead of leaving them at a disabled Start.
- **Super Decoder — quick / short round** (Dan + Maya, PLAY-004 personas): a guaranteed-short option (a "1 code" length, or a per-code soft time cap) so a between-meetings / commute player gets a reliably short session even on a bad streak.
- **Super Decoder — skippable countdown + tap-through banner** (Dan): the 3-2-1-GO and the between-code banner hold pad a turn-based puzzle; let them be skipped to keep momentum.

## 🌱 Later (needs shaping first)

- Local **high-scores / best-time persistence** (localStorage) + remember last settings. _(Now proven in Neon Rush's SaveManager — reuse the versioned-key, fail-soft pattern for the other games; a per-theme best score would reward return visits.)_
- **Neon Rush — polish backlog** (from PLAY-005 QA LOWs + personas): promote the repeated neon hex (`#ff2d95`/`#22e5ff`/`#ffd54a`, duplicated in CSS + the JS `NEON` object) to game-local custom properties; one-time SHA-256 verify of the vendored libraries; add a `must-revalidate` `_headers` rule for per-game `index.html`.
- **Neon Rush — optional timed / "sprint" mode or end-of-break nudge** (Dan, PLAY-005 persona): the endless format with an early speed plateau relies on self-control to stop; a bounded mode would fit the micro-break use case.
- **Neon Rush — real mid-range mobile perf check** (Maya, watch-item): shadows + antialias + skinned GLB meshes; confirm no stutter on a real handset before assuming 60fps everywhere.
- **Neon Rush — true `file://` asset parity** (v2 follow-up): GLB models + Web-Audio SFX can't `fetch` from a double-clicked `file://` page (Chrome CORS), so it degrades to primitives + synth there. To make even the double-clicked file show real models/SFX, embed assets as base64 + `GLTFLoader.parse` / data-URI audio (≈15MB single HTML — only if pure-file:// full-fidelity is wanted; the deployed site is already full).
- **Neon Rush — neon-tint the remaining GLB skins** (v2 follow-up): the Star Rider (Astronaut) now gets cyan accent glow via `glowMats`, but the Urban Runner (green rogue) and Neon Bot keep their default palettes; an emissive rim / palette tint toward magenta-cyan would fit the neon city better.
- **Neon Rush — chaser scale at high tension** (PLAY-005 v3 watch-item): the police-car GLB looms large and can partly occlude the player when `droneTension` is near 1 (right before a catch); if it reads as too much, cap its forward `targetZ` or shrink it slightly so the player stays fully visible.
- **Claw Catch — aim assist & bonuses** (from PLAY-003 personas): a subtle visual nudge when the claw tip lines up over a prize (helps Kid Pilot aim); a two-prize bonus when the claw grabs two stacked prizes at once.
- **PWA offline install** (service worker).
- **Shareable deep links** to a specific game.
- A11y polish as the catalog grows: a "skip to content" link, richer card accessible name (`aria-describedby` for tags/players), revisit rail list semantics + "item N of M", `aria-live` on a dynamic game count.
- **Super Decoder — keyboard & mobile editing polish** (PLAY-004 personas): let a focused slot accept a number key (today placement always targets `code.activeSlot`); give each feedback cluster its own `aria-label` so a past row is inspectable on focus (Sam, AT); widen the active-row slots (>34px) and/or add a "tap colour then tap slot" placement so one-handed peg correction is a confident thumb tap (Maya).
- **Security hardening:** externalise the inline scripts (or hash them) so the CSP can drop `'unsafe-inline'` for `script-src`. _(see `docs/DECISIONS.md`)_

## 💭 Someday / maybe (parking lot)

- Online / async multiplayer.
- Player accounts & profiles.
- "Game of the day" / featured rotation.
- End-of-round confetti / richer reward moments.

---

### Conventions
- Each idea is one line: a verb + the outcome (e.g. "Let users log a meal by photo").
- When you start an idea, move it to **Now** and create `features/<name>/` from `_TEMPLATE/`.
- When it ships, delete it here and note it in `ARCHITECTURE.md` / `DECISIONS.md` as appropriate.

> **Shipped 2026-06-21 (PLAY-001):** PlayPad catalog hub · shared MD3 design system (tokens + base) · favicon/maskable icon/manifest · Colour Rush rebuilt in MD3 · `dist/` + Cloudflare `_headers` deploy package. _(Pruned from "Now" per the maintenance step.)_
> **Shipped 2026-06-21 (PLAY-002):** **Snap** — themed (Nature/Princess/Superheroes) 2–4-player card-matching reaction game; roundtable edge buttons + per-player keyboard keys; RAF-deadline round state machine; QA clean + product gate PASS (Sofa Co-op primary). Catalog now 2 live games. _(Pruned "Ship game #2" from "Now".)_
> **Shipped 2026-06-27 (PLAY-003):** **Claw Catch** — PlayPad's **first solo game**: a Canvas claw machine with a driven-damped-pendulum swing, a drop/grab state machine, 3 themes (Critters/Sweets/Space), transparent rarity-weighted scoring + prize key, and a capped periodic refill; on-screen joystick + grab button + keyboard. QA clean + product gate PASS (Solo Sam, Kid Pilot). **Closes the long-standing solo-path gap.** Catalog now 3 live games. _(Pruned the solo-path item from "Now".)_
> **Shipped 2026-06-27 (PLAY-002 rev2):** Snap on-device fixes — (1) lingering 3-2-1 "GO" overlay over the results screen (2nd recurrence) systemically fixed by moving the teardown into `show()`, the single screen-transition chokepoint; (2) face-vs-back confusion fixed by replacing the big theme-emoji back with a **branded patterned back** (gradient + woven pattern + inset frame + fixed `✦` motif) and a crisper coloured-frame face — removes the Princess/Superheroes back-glyph-equals-face-glyph collision. `dist/` rebuilt + redeployed.
> **Shipped 2026-07-12 (PLAY-005 v2):** **Neon Rush asset overhaul** — swapped the primitive characters for **real CC0 animated GLB models** (KayKit Rogue/Knight + three.js RobotExpressive) with skeletal run/jump/slide via `AnimationMixer` (three.js pinned r148→**r147** for the classic-script `GLTFLoader`); added **real audio** (ansimuz CC0 synthwave loop + Kenney CC0 SFX, each with a synth fallback); procedural **lit-window building textures + scrolling road**; and an **instant start** (retry-skip + tap-skip, first run ~1.2s). Primitive skins + synth voices kept as automatic fallback. `assets/CREDITS.md` + setup-screen credit line. Addresses all four owner asks (start wait, textures/models, crouch animation, real music).
> **Shipped 2026-07-12 (PLAY-005):** **Neon Rush** — PlayPad's **first 3D game** (Three.js r148 UMD, vendored for offline/`file://` + CSP) **and first persistent-save game**. Solo 3-lane neon endless runner: lane/jump/slide dodging (barriers/low trains/tall trains), pooled fairness-patterned spawns, coins, magnet/sneakers/hoverboard power-ups with HUD timers, a cosmetic police-drone chaser, and a coin **shop** with 3 primitive-built skins (buy/equip). Coins + unlocks + equipped skin + high score + mute persist via a versioned, fail-soft `SaveManager` (localStorage). 100% Web Audio synth. Arrows + touch swipes. QA panel clean (4 lenses PASS, all MEDIUMs fixed) + product gate PASS (Maya HIGH, Dan MED-HIGH, both baseline+value MET). Catalog now 5 live games. _(Pruned the persistence + 3D asks from "Later".)_
> **Shipped 2026-06-27 (PLAY-004):** **Super Decoder** — PlayPad's **first logic/deduction game**: a Mastermind-style solo code-breaker. 4-peg / 6-colour / 10-attempt codes with duplicates allowed; the classic two-pass, duplicate-safe `scoreGuess` algorithm verified against fixtures; feedback pegs revealed one at a time with per-peg tones (JS-driven so reduced-motion still paces). Difficulty = session length (3 / 5 / 8 codes). Three palette themes (Classic / Pastel / Neon). Reuses Claw Catch's setup/results/HUD chrome incl. the 48px `#quitBtn` block verbatim; every cross-screen teardown lives inside `show()`. Catalog now 4 live games. _(Pruned the logic-game gap from "Now".)_

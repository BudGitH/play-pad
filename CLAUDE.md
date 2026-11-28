<!-- brain-version: 4 -->

# PlayPad — Project Brain

> A colourful little hub of quick, playable browser mini-games.

PlayPad is a static, build-free web hub that presents a growing catalog of bite-size browser games behind one branded front door. It is styled with Material Design 3 and runs from the file system or any static host — no install, no backend. It launches with one game, Colour Rush, and is built so new games drop in with a one-line change.

> This file is **auto-loaded at the start of every Claude session**. It is the orchestrator: it tells you what to read, how to build, and how to keep itself current. Treat its protocols as standing instructions, not suggestions.

**New here? 30-second orientation:** this project keeps its knowledge in `docs/` and builds every feature through a short loop (below). To start: read the four files in the next section, then follow "How we build every feature." All the depth — tiers, design, QA, the review panel — is pulled in _only when a feature needs it_; you don't have to learn it up front. **Project tier:** Standard (public open-source, MIT).

---

## ⚡ Start of session — read these first

Before doing any work, read in order:

1. `docs/PROJECT.md` — vision, users, scope (the **why**)
2. `docs/ARCHITECTURE.md` — current map of the app (the **what / where**)
3. `docs/LEARNINGS.md` — gotchas not to repeat (the **lessons**)
4. `docs/IDEAS.md` — backlog / what's next (the **next**)

Skim as needed: `docs/WORKFLOW.md` (how we build), `docs/DESIGN-SYSTEM.md` (how it looks), `docs/PRODUCT-PANEL.md` (the review panel), `docs/CODE_QUALITY.md` (the standard), `docs/findings-ledger.md` (recurring issues), `docs/DECISIONS.md` (why things are the way they are).

---

## 🛠️ How we build every feature — the self-contained loop

The full procedure is in `docs/WORKFLOW.md`. **Do not skip phases — the discipline is the point.**

1. **REQUIREMENTS** — copy `features/_TEMPLATE/` to `features/<feature-name>/` (see `features/_EXAMPLE/` for a worked example) and fill `requirements.md`: acceptance criteria + business requirements + target personas + feature tier. The **Senior Tech Lead** does a quick feasibility check (advisory).
   - **1b — DESIGN (UI changes only):** small tweaks → a lite check against `docs/DESIGN-SYSTEM.md`; significant UI → **4 concrete HTML mockup options** in `features/<name>/mockups.html`, the **Design Roundtable** weighs them, and **you choose**. See `docs/WORKFLOW.md`.
2. **TESTS** — fill `test-plan.md` and write the actual tests that encode "done". Tests come _before_ the implementation is finished.
3. **IMPLEMENT** — build until the tests pass, strictly following `docs/CODE_QUALITY.md`.
4. **QA — recursive multi-lens panel.** Spawn a **panel of independent QA agents in parallel**, one per dimension:

   - **ACCURACY** — does it produce correct output? (calculations, edge cases, business rules)
   - **QUALITY** — does it meet `CODE_QUALITY.md`? (naming, comments, tests, complexity)
   - **COMPLIANCE** — audit trail, PII handling, required docs, the four-tier comment system
   - **RISK** — security: injection, authn/authz, secrets, input validation at trust boundaries

   Hand each agent the `requirements.md`, `test-plan.md`, and the slice of `CODE_QUALITY.md` for its lens. Each returns classified findings (severity × dimension). **Merge + dedupe** them into `features/<feature-name>/qa-report.md` (the Post-Run Findings Report). If anything blocks (any CRITICAL/HIGH), **FIX and re-spawn the panel.** Loop until the report is clean. _The panel is the pipeline — no external CI is required._

5. **PRODUCT & UX VALIDATION.** After technical QA passes, prove the feature is _worth shipping_. Spawn — from `docs/PRODUCT-PANEL.md` — the **Senior PM** (does it meet the business requirement? → `PASS`/`NEEDS_REVISION`, loop until PASS), then the feature's **1–3 target personas** (do they complete their goal, is it worth it, would they return? — scoring **baseline / value / satisfaction**). Any baseline/value-blocking critical goes to a **round table** (PM + UX designer + the raising persona) → plan → fix (back to step 3) → re-validate. Record in `features/<feature-name>/product-validation.md`. **Gate:** baseline **and** value must be met (satisfaction is scored, not gated); the round table is capped at **3 rounds**, then escalates to you. _Personas reason from requirements + code + screenshots; if a preview is running, one driver captures it for them — no external tool is required._
6. **CAPTURE** — record what you learned and update the brain (next section).

---

## ♻️ End of work — keep the brain current (the recursive part)

After any meaningful change, **before you finish**:

- **Update `docs/ARCHITECTURE.md`** if structure, data model, or flow changed. Keep it a **MAP that links to code** — an overview, not a copy. Prune stale lines. Target **< ~150 lines**.
- **Append to `docs/LEARNINGS.md`** any non-obvious gotcha: `date · area · lesson · how to apply`. No duplicates.
- **Append to `docs/DECISIONS.md`** any non-obvious choice: `what · why · alternatives rejected`.
- **Update `docs/findings-ledger.md`**: increment recurrence counts for repeat findings and apply escalation (**2× = ticket, 3× = tech-debt priority, 4× = STOP-SHIP**).
- **Update `docs/IDEAS.md`**: move shipped ideas out; add the non-blocking value/satisfaction feedback from the persona panel as future improvements.
- **Check `_redirects` for new dev files.** Cloudflare deploys the whole repo root, so any new top-level file or folder, or any non-game file inside `games/<slug>/` (notes, configs, docs), is publicly served on the live site. When a change adds one, **ask the user** whether to add it to `_redirects` (redirect to `/`). Never block what the site needs (pages, scripts, styles, icons, game assets) or the licence and credit files.

> **RULE:** every brain doc is an **OVERVIEW**. Link to detail; never inline large code or dumps. If a file bloats, consolidate it.

---

## 🧭 Standards

- `docs/CODE_QUALITY.md` — the non-negotiable code-quality + security standard. Read it before writing code.
- `docs/CONVENTIONS.md` — project-local stack, naming, style, and the **dev commands** QA runs.
- `docs/DESIGN-SYSTEM.md` — how the product looks: tokens, components, accessibility floor. Read before any UI work.
- `docs/PRODUCT-PANEL.md` — the **review panel**: the Senior PM, Senior UX Designer, Senior Tech Lead, and the user personas that validate features.
- `docs/ENFORCEMENT.md` — which quality rules are wired to tools vs reviewed by eye. QA's QUALITY lens reads this first.
- `docs/PR-STANDARD.md` — how changes are proposed, reviewed, and merged (every change lands via PR to `main`).
- `CONTRIBUTING.md` — the human contributor guide (public repo).

---

## 🗺️ File map

> Keep this current via the maintenance step. Pointers to the key code, not a full listing.

- **Hub / catalog:** `index.html` (featured game, filter chips, grid, best/new badges — renders from the registry) · `games.js` (`window.GAMES` — add a game here; optional `tagline`/`added`/`best`) · `scripts/theme.js` (light/dark choice, applied before paint; games opt in with one `<script>` tag) · `scripts/viewport.js` (visible height → `--pp-app-h`; every game shell sizes to it so Start / Submit are never off-screen).
- **Design system:** `styles/tokens.css` (MD3 tokens, light+dark) · `styles/base.css` (components, the rail).
- **Games:** `games/<slug>/index.html` — today `games/colour-rush/`, `games/snap/`, `games/claw-catch/` (solo, Canvas), `games/super-decoder/` (solo, DOM logic), `games/sunset-stride/` (solo, 3D Three.js, formerly Neon Rush — vendored `three.min.js` r147 + `GLTFLoader.js` + CC0 `assets/` (GLB runner + dogs, photo textures, lo-fi music; SFX + particles are generated in code) + a game-local `CLAUDE.md`; first game to persist to localStorage and first with vendored assets). `games/sparkle-salon/` (solo, kids' make-up, layered SVG + paint canvases) · `games/brick-buddies/` (solo, 2D block house/room builder, Canvas) · `games/kampung-quest/` (solo, 3D open-world Singapore neighbourhood + Makkah / Madinah; the one multi-file game: ~240 scripts in `js/{data,sim,figures,world,game}` under `window.KQ`, three.js r147, CC0 textures, CC BY-SA azan; game-local `CLAUDE.md` = the contract, module map and hooks). Feature records: `features/kampung-quest/` (base game), `-improvements/`, `-crowd/`, `-realism/` (guided tawaf, tailor, vehicles, 2x crowd, Makkah outskirts and camels) and `features/kampung-quest-playability/` (PLAY-014, 2026-11-28: full map + Go here, rideable camels / horses / ponies, boy or girl hero, vehicle life + traffic + bus, minimisable cards, Say hi + world events + missions, brighter looks, iPad boot, one fixed Action control; `requirements.md`, `test-plan.md`, `notes-<area>.md`). Both are single self-contained files with synthesised audio; deep AC probes live in `features/<slug>/probe.mjs`. Sparkle Salon v2 (`features/sparkle-salon-v2/`: art, iPad performance, calm sound, UX S1-S8 = iPad side bar, heart meter, pointing-hand demo, picture client card, photo-first results, sticker drag, **My Album** from saved recipes; spec `tests/sparkle-salon-v2.spec.mjs`). Brick Buddies' first run is guided (picture how-to + `?` chip, pre-built hut, coach line; `features/brick-buddies-onboarding/`). v2 (`features/brick-buddies-v2/`): one touch joystick, pinch / pan / recenter, goal chip + folded block tray, tap-to-preview-then-place, Goals / Open play, colour tints, juice, softer rain, wandering buddies; its Playwright spec is `tests/brick-buddies-v2.spec.mjs`. (Reference-only, never shipped: `Old prototype/`.)
- **Brand / deploy:** `icons/` · `manifest.webmanifest` · `_headers` · Cloudflare Pages Git integration (auto-deploys `main`; previews off).
- **Tooling / CI:** `package.json` (dev-only) · `eslint.config.mjs` · `.prettierrc.json` · `tools/secret-scan.mjs` · `tools/lint-ratchet.mjs` + `tools/lint-baseline.json` (max-lines / max-depth / jsdoc counts) · `tools/check-commented-code.mjs` · `tools/check-sim-tested.mjs` (= `npm run test:kq`, coverage gate on KQ `js/sim`) · `tools/check-pr-title.mjs` + `.github/workflows/pr-title.yml` · `tests/smoke.spec.mjs` + `tests/brick-buddies-help.spec.mjs` (first-run how-to / coach) + `tests/brick-buddies-v2.spec.mjs` (joystick, pinch, preview-then-place, modes, colour, life) + `tests/sparkle-salon-v2.spec.mjs` (iPad layout, demo hand, heart meter, client card, results, stickers, album) + `tests/kampung-quest-*.spec.mjs` (browser specs per area: only `-ac` and `-mobile` run on every PR (`ci.yml`), the rest via `npm run smoke:kq`; the realism round's run via `smoke:kq:realism` and the playability round's (actions, map, mounts, hero, cards, life, life-holy, looks, ipad, vehicles-ground, vehicle-rig, vehicle-life, figures) via `smoke:kq:playability`; `@slow` = `npm run perf:kq`; parallel checkouts use `PW_PORT`) + `tests/kampung-quest/*.test.mjs` (sim unit tests, `npm run test:kq`, in CI) + `tests/viewport-fit.spec.mjs` (bottom controls stay on screen when the visible area is shorter than the layout) + `tests/round-drivers.mjs` (per-game "start a round" drivers) + `playwright.config.mjs` + `tools/serve.mjs` · `.githooks/pre-commit` · `.github/workflows/ci.yml` (secrets, lint, audit, smoke on every PR) · `.github/workflows/probes.yml` (the three deep AC probes: path-filtered PRs + push to main + nightly + manual, PLAY-012) · `.github/` templates.
- **The full map:** `docs/ARCHITECTURE.md` (structure, data model, flows, modules).

---

## ▶️ Run / test

**Stack:** Vanilla HTML/CSS/JS, no build step (static; runs from file:// or any static host)

The canonical commands live in `docs/CONVENTIONS.md` → _Dev commands_ (Phase 4 QA runs them). Quick reference:

- **Run the app:** open `index.html` directly, or `python -m http.server 5500` → http://localhost:5500/ (preview config: `.claude/launch.json` → `playpad`).
- **Deploy:** merge to `main` → Cloudflare Pages deploys automatically (the only deploy path).
- **Test:** `npm run smoke` — Playwright smoke test (hub + every live game load with no errors); runs in CI on every PR. One-time: `npx playwright install chromium`. Deeper QA is the in-workflow multi-lens panel (`docs/WORKFLOW.md`).
- **Deep probe (Sunset Stride):** `node tools/serve.mjs 5599 &` then `node tests/probes/stride-probe.mjs` (headless WebGL probes for every acceptance criterion, ~2.5 min; set `PW_CHROMIUM_PATH` to a pre-installed Chromium, unset it to use Playwright's own). Runs in CI (`probes.yml`), not on every PR.
- **Deep probes (Sparkle Salon / Brick Buddies):** `PW_CHROMIUM_PATH=<chromium> node features/sparkle-salon/probe.mjs` / `features/brick-buddies/probe.mjs` (each starts its own server, ~3-4 min each; unset `PW_CHROMIUM_PATH` to use Playwright's own browser). All three run in CI via `.github/workflows/probes.yml` (job `Probes`, one matrix leg per game).
- **Perf harness (Sparkle Salon):** `PW_CHROMIUM_PATH=<chromium> node features/sparkle-salon-v2/perf/measure.mjs --cpu 4` (fps / main-thread time per scenario; `perf/sound.mjs` for the brush spectra; `shoot-ux.mjs` re-takes the UX screenshots). Dev-only; numbers are in `features/sparkle-salon-v2/perf.md`.
- **Lint / checks:** `npm install` once, then `npm run check` (lint + lint ratchet + format) and `npm run secrets`. CI runs these on every PR. `max-lines-per-function` / `max-depth` are errors; only the legacy files in `tools/lint-baseline.json` are baselined (it can only go down).

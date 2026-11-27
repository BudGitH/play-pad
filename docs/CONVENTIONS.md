# PlayPad — Project-Local Conventions

> The **heavy, universal** rules live in `docs/CODE_QUALITY.md`. This file holds only what's **specific to this project**: stack choices, naming, folder layout, and any deliberate deviations from the standard.
> Keep it short. If a rule here ever contradicts `CODE_QUALITY.md`, say so explicitly and explain why.

**Stack:** Vanilla HTML/CSS/JS, no build step (static; runs from file:// or any static host)

---

## Project-specific rules

- **Layout:** root `index.html` (catalog) + `games.js` (registry) + `manifest.webmanifest`; `styles/` holds shared MD3 `tokens.css` + `base.css`; `icons/` holds brand SVGs; each game lives in `games/<slug>/index.html`.
- **Naming:** kebab-case for files and game slugs; CSS custom properties follow the `--md-sys-*` MD3 token names; components reference tokens, never raw values.
- **Add a game = append one object** to `window.GAMES` in `games.js` (`{ id, title, description, tags, path, accent, icon, players, status }`) and create `games/<slug>/index.html`. Nothing else.
- **No build step / file:// constraint:** vanilla HTML/CSS/JS only; the registry must be a JS global loaded via `<script src>` (NOT a fetched JSON and NOT ES modules — both fail under file://). All paths relative.
- **Every game page** links `styles/tokens.css` + `styles/base.css` and includes a "← PlayPad" back link to the hub.
- **Dev commands:** Run = open `index.html` in a browser (or `npx serve .` / VS Code Live Server for a localhost). Lint/format tooling is dev-only (`package.json`); the shipped site stays build-free.

## Dev commands

> Phase 4 QA **runs** these to validate (not just read code). Fill them once the app exists; leave `TBD` until then — QA falls back to static review and never blocks on a missing command.

- **Run the app:** open `index.html` in a browser (or `npx serve .` / VS Code Live Server for a localhost)
- **Run tests:** `npm run smoke` (Playwright, everything except `@slow`: the hub, every live game, the Sparkle Salon / Brick Buddies / viewport specs and Kampung Quest's two specs). One-time: `npx playwright install chromium`. A new game is covered automatically by `tests/smoke.spec.mjs` once it's `live` in `games.js`. It is split into two Playwright projects, the same split CI uses: `npm run smoke:core` (everything but Kampung Quest, about 4-5 min) and `npm run smoke:kq` (`tests/kampung-quest-ac.spec.mjs` + `tests/kampung-quest-mobile.spec.mjs`, software-GL 3D; `smoke:kq:ac` / `smoke:kq:mobile` run one file). Kampung Quest also has `npm run test:kq` (Node unit tests of the pure sim layer, under a second, no browser) and `npm run perf:kq` (the `@slow` AC-14 probe: main-thread frame time at 4x CPU throttle; about 1 min). `PW_CHROMIUM_PATH=<chromium>` is optional.
- **Lint / format:** `npm run lint` (ESLint) · `npm run format` (Prettier, gated) · `npm run secrets` (secret scan) · all: `npm run check` (lint + the PLAY-010 lint ratchet `npm run ratchet` + format check). One-time: `npm install` (dev tooling only — the site has no runtime deps).
- **Type check:** N/A (vanilla JS)
- **Hooks:** `git config core.hooksPath .githooks` once per clone (secret scan + lint on commit)
- **Deep probes:** `node tools/serve.mjs 5599 &` then `node tests/probes/stride-probe.mjs` (Sunset Stride, ~2.5 min); `node features/sparkle-salon/probe.mjs` and `node features/brick-buddies/probe.mjs` (each starts its own server, ~3-4 min). Each exits 1 on any FAIL.
- **CI:** `.github/workflows/ci.yml` runs on every PR: job `check` (secrets, lint + format + ratchet, `npm run test:kq`, `npm audit`), job `smoke` (`npm run smoke:core`) and job `Kampung Quest` (a matrix of two legs, `smoke:kq:ac` and `smoke:kq:mobile`, each on its own runner with its own timeout). `.github/workflows/probes.yml` runs the deep probes (Sunset Stride, Sparkle Salon, Brick Buddies and Kampung Quest's `npm run perf:kq`, one matrix leg per game) on PRs touching `games/**`, `features/**/probe.mjs`, `tests/probes/**`, the Kampung Quest specs, `tools/serve.mjs`, `styles/**`, `scripts/**`, `package*.json` or the workflow itself, on push to `main` with the same paths, nightly, and on `workflow_dispatch`. Do not mark it a required check (path-filtered)
- **Deploy:** automatic — Cloudflare Pages Git integration deploys `main`; preview deployments are off. There is no manual deploy path — to ship, merge a PR.
- **Build:** `TBD` (none — static, no build step)

## Naming & layout (this project)

- kebab-case for files and game slugs; CSS custom properties follow the `--md-sys-*` MD3 token names; components reference tokens, never raw values. Each game lives at `games/<slug>/index.html` and links the shared `styles/tokens.css` + `styles/base.css`.

## Deliberate deviations from `CODE_QUALITY.md`

> Every deviation needs a reason and a `PLAY` reference. None by default.

- **Tier-1 file headers & Tier-2 function doc blocks relaxed at Prototype tier (PLAY-001).** Shared files carry descriptive top-of-file comment blocks, and the games use clear section banners + "why" comments on the non-obvious bits instead of the full structured file headers / per-function doc blocks in `CODE_QUALITY.md` §3. Rationale: tightly-scoped, single-file static prototypes with self-documenting names. Re-confirmed at the Standard-tier upgrade (2026-11-21): still relaxed for existing games; **new** shared JS files get full Tier-1 headers. _(Raised by the Phase-4 COMPLIANCE + QUALITY lenses, severity LOW.)_
- **Vendored binary assets allowed for Sunset Stride (ex-Neon Rush; PLAY-005 v2, reworked in PLAY-007).** The zero-asset / synth-only stance holds for the DOM/canvas games, but Sunset Stride vendors CC0 GLB models, photo textures and audio under `games/sunset-stride/assets/` (owner decision 2026-07-12: "proper textures + open-source 3D models… real music"). Rules: same-origin only (no CDN, CSP intact); every asset licence-cleared and listed in `assets/CREDITS.md`; the code must **degrade to the primitive/synth fallbacks** when an asset can't load (so `file://` and partial deploys stay playable). Three.js is pinned r147 (last classic-script `GLTFLoader`).
- **Sparkle Salon pins a light pastel palette via local `--sp-*` tokens (PLAY-008)** instead of the MD3 colour roles and skips `theme.js`; see DECISIONS 2026-11-22. Other new games should keep using the MD3 roles.
- **Deep AC probes per game (PLAY-008/009):** `features/<slug>/probe.mjs` (Stride's is `tests/probes/stride-probe.mjs`). Run in CI by `.github/workflows/probes.yml` (PLAY-012). Locally: `PW_CHROMIUM_PATH=<chromium>` is optional (unset = Playwright's own browser); screenshots only with `SHOTS=1`. Probes must wait on state (`waitForFunction`), never on a fixed sleep; cross-tab `localStorage` is asynchronous.

---

_Last reviewed: 2026-11-26_

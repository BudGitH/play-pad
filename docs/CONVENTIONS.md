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
- **Run tests:** `TBD` (no test tooling at Prototype tier; QA is the in-workflow panel)
- **Lint / format:** `npm run lint` (ESLint) · `npm run format` (Prettier, gated) · `npm run secrets` (secret scan) · all: `npm run check`. One-time: `npm install` (dev tooling only — the site has no runtime deps).
- **Type check:** N/A (vanilla JS)
- **Hooks:** `git config core.hooksPath .githooks` once per clone (secret scan + lint on commit)
- **CI:** `.github/workflows/ci.yml` runs secrets + lint + `npm audit` on every PR
- **Deploy:** automatic — Cloudflare Pages Git integration deploys `main` (PRs get preview URLs). Before any manual deploy: `git pull` first (cloud sessions may have pushed commits).
- **Build:** `TBD` (none — static, no build step)

## Naming & layout (this project)

- kebab-case for files and game slugs; CSS custom properties follow the `--md-sys-*` MD3 token names; components reference tokens, never raw values. Each game lives at `games/<slug>/index.html` and links the shared `styles/tokens.css` + `styles/base.css`.

## Deliberate deviations from `CODE_QUALITY.md`

> Every deviation needs a reason and a `PLAY` reference. None by default.

- **Tier-1 file headers & Tier-2 function doc blocks relaxed at Prototype tier (PLAY-001).** Shared files carry descriptive top-of-file comment blocks, and the games use clear section banners + "why" comments on the non-obvious bits instead of the full structured file headers / per-function doc blocks in `CODE_QUALITY.md` §3. Rationale: tightly-scoped, single-file static prototypes with self-documenting names. Re-confirmed at the Standard-tier upgrade (2026-11-21): still relaxed for existing games; **new** shared JS files get full Tier-1 headers. _(Raised by the Phase-4 COMPLIANCE + QUALITY lenses, severity LOW.)_
- **Vendored binary assets allowed for Neon Rush (PLAY-005 v2).** The zero-asset / synth-only stance holds for the DOM/canvas games, but Neon Rush vendors CC0/CC-BY GLB models + audio under `games/neon-rush/assets/` (owner decision 2026-07-12: "proper textures + open-source 3D models… real music"). Rules: same-origin only (no CDN, CSP intact); every asset licence-cleared and listed in `assets/CREDITS.md`; the code must **degrade to the primitive/synth fallbacks** when an asset can't load (so `file://` and partial deploys stay playable). Three.js is pinned r147 (last classic-script `GLTFLoader`).

---

_Last reviewed: 2026-11-21_

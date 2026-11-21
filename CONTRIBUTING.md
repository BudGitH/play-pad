# Contributing to PlayPad

Thanks for helping! PlayPad is vanilla HTML/CSS/JS — no build step, no install.

## Run locally
    python -m http.server 5500   # then open http://localhost:5500/

## Add a new game
1. Create `games/<slug>/index.html` (self-contained; use the shared `styles/tokens.css` + `styles/base.css`).
2. Register it with one entry in `games.js`.
3. Only use assets you may redistribute (CC0/MIT etc.) and credit them in the game folder.

## Workflow
- Fork → branch (`feat/<thing>`, `fix/<thing>`) → PR to `main`.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `chore:`.
- PRs are squash-merged. Keep them small and include a screenshot for UI changes.
- Read `docs/CODE_QUALITY.md` and `docs/DESIGN-SYSTEM.md` before larger changes.
- Using an AI assistant? `CLAUDE.md` is the project brain it should read first.

By contributing you agree your work is licensed under the MIT License and you follow our [Code of Conduct](CODE_OF_CONDUCT.md).

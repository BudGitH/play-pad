# QA Report (Post-Run Findings): Sparkle Salon

> **Phase 4 output.** Merged from the multi-lens QA panel (ACCURACY · QUALITY · COMPLIANCE · RISK). Round 1 ran two independent agents (ACCURACY+RISK, QUALITY+COMPLIANCE); round 2 was an independent re-verification agent across all four lenses. Repro scripts lived in the session scratchpad (not committed).

**Feature:** Sparkle Salon (kids' princess make-up game)
**Ticket:** PLAY-008
**Run at:** 2026-11-22 (round 1 → fixes → round 2 → fixes; product RT-1 and the kid-touch fix verified by the probe afterwards)
**Overall result:** ☑ PASS ☐ FAIL

---

## Gate summary (final)

| Lens (dimension) | Agent verdict | Findings (round 1 / round 2)                                         | Blocking? |
| ---------------- | ------------- | -------------------------------------------------------------------- | --------- |
| ACCURACY         | PASS          | 1 MED (shared with a11y) + 5 LOW / 1 MED + 3 LOW                     | n         |
| QUALITY          | PASS          | 4 MED + 5 LOW / 1 LOW                                                | n         |
| COMPLIANCE       | PASS          | 1 HIGH + 5 MED + 5 LOW / 1 MED                                       | n         |
| RISK (security)  | PASS          | 4 LOW / 1 LOW                                                        | n         |
| **Tests**        | PASS          | probe 71/71 (x2) · smoke 24/24 · eslint 0/0 · prettier · secret scan | n         |

## Round 1: blocking finding (fixed)

- **SS-C01 / SS-QA-01 · HIGH · a11y, accuracy:** the tray and sub-tabs were rebuilt with `replaceChildren()` on every pick, so keyboard focus fell to `<body>` after each colour, tab or unlock. **Fixed:** updated in place, with `announce()` on each pick. Probe check `SS-C01`. Ledger: `keyboard-focus-lost-on-rerender` (NEW).

## Round 1: non-blocking (all fixed)

- **Stage tab stop on title and results (SS-C02):** fixed.
- **Contrast cluster, white on pink (SS-C03):** fixed (≥ 4.5:1).
- **Touch targets below 48px (SS-C04):** fixed.
- **Modal clipping on short landscape screens (SS-C05):** fixed.
- **Results CTA below the fold (SS-C06):** fixed. Ledger: `primary-cta-below-fold`, 2nd.
- **Local tokens and a false comment (SS-Q01):** fixed.
- **Mask geometry duplicated in JS (SS-Q02):** fixed; masks are now read from the SVG DOM.
- **Dead and duplicated art (SS-Q03):** fixed. The file went from 413 KB to 308 KB.
- **Held-key latch (SS-Q04 / QA-02):** fixed. Ledger: `held-key-stuck-on-blur`, 2nd.
- **"Princess Aurora", a Disney name (SS-C08):** renamed to Dawn.
- **`theme.js` on a pinned page (SS-C09):** removed.
- **Colour-only step dots (SS-C11):** fixed.
- **Accessories stayed complete after removal (QA-03):** fixed.
- **Coverage wording (QA-04):** fixed.
- **Multi-tab overwrite (QA-05):** fixed with a save `rev`.
- **Debug guard (QA-06):** fixed.
- **AudioParam spam (QA-07):** fixed.
- **TRUST_BOUNDARY tag (QA-08):** added.
- **Swish played on non-paint steps (QA-09):** fixed.
- **Other LOW items:** fixed. Full lists are in the commit history (`b0d077a`).

## Round 2: new findings (all fixed in `6894121`)

- **R2-01 · MEDIUM:** a stale Unlock sheet charged twice across tabs. Fixed, with probe check `R2-01`.
- **R2-02 · MEDIUM (regression from SS-C05):** the 4-column wishes grid overflowed below 480px wide. Fixed, with probe check `R2-02`.
- **R2-03 to R2-07 · LOW:** all fixed or documented.
  - Results bar covered the card at small sizes.
  - Cross-tab sound gain.
  - "+10 coins" shown when nothing was paid.
  - Unused tokens and a duplicate id.
  - `addCoins` / `camera` debug exceptions, documented in AC-20.

## Not verified (needs a human)

- The audio mix by ear on a phone speaker.
- Real iOS Safari, where the `filter` fallback was only simulated.
- Real-device frame rate on a low-end tablet. Headless software GL was 40–60 fps.

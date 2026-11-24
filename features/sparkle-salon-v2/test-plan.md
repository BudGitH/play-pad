# Test Plan: Sparkle Salon v2 (art, iPad performance, UX, calm sound)

> **Phase 2 of the workflow.** Tests define "done". Three kinds of evidence: the Playwright spec `tests/sparkle-salon-v2.spec.mjs`
> (runs in `npm run smoke` and CI), the deep v1 probe `features/sparkle-salon/probe.mjs` (dev-only, run by hand), and the
> measurements recorded in [`perf.md`](perf.md).

**Feature:** Sparkle Salon v2
**Ticket:** PLAY-008 (follow-up: owner feedback round 2)
**Created:** 2026-11-24

---

## Coverage map (AC → test)

| Acceptance criterion                   | Test(s)                                                                                                                                                                                                                                                                                                                                                                                                                           | Type                  |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| AC-22.1 Art                            | `design-review.md` (before / after screenshots at 390 and 1024); probe `RT1-hair` (the hair keeps its hue band), `R2-06` (no duplicate ids); no `<filter>` left in the page (`perf.md` item 1)                                                                                                                                                                                                                                    | visual review + probe |
| AC-22.2 iPad performance               | `perf.md` (before / after tables at 1024x1366 and 1366x1024 at 2x, 4x CPU throttle; layers and megapixels); the numbers are re-run by `measure.mjs --cpu 4` after every UX change ("after UX" rows)                                                                                                                                                                                                                               | measurement           |
| AC-22.3 Phone performance              | `perf.md` (phone 390x844 at 3x, same script, nothing slower)                                                                                                                                                                                                                                                                                                                                                                      | measurement           |
| AC-22.4 Calm brush sound               | `perf.md` "Calm brush sound" (offline render of the real handlers: energy above 4 kHz, onset step, ramps); probe `AC-14`, `AC-14b` (audio still works and is synthesised), `AC-17` (no audio files)                                                                                                                                                                                                                               | measurement + probe   |
| AC-22.5 (S1) iPad layout               | spec `layout: <device>` → "everything is on screen, nothing scrolls sideways" (phone, iPad portrait, iPad landscape); "a wider column, a bigger tablet zoom ..." (column width, `stage` scale >= 1.3 x 1.25); "landscape tablet: the tools, Redo, the heart and Next sit in a right-hand bar"; probe `AC-16` at 390x844, 844x390, 820x1180, 1280x800, **1024x1366**, **1366x1024**, 360x640                                       | e2e                   |
| AC-22.6 (S2) Tablet sizing             | spec `a wider column ... finger-sized controls` (tray circle 88-96 px, round buttons 64, Next and Redo >= 64 tall, ring >= 72, bubble and step name >= 20 px); "a phone keeps the 62 px tray and 48 px buttons"; probe `AC-15b` / `SS-C04` (48 px minimum, unchanged)                                                                                                                                                             | e2e                   |
| AC-22.7 (S3) Pointing-hand demo        | spec `pointing-hand demo`: "shows on the first paint step, never paints, and any press cancels it at once" (pointerdown cancels synchronously, nudge quiet), "plays out on its own without painting, then never repeats on that step", "pick steps: the hand taps a tray circle (with a ripple)", "a press that starts the step stops the demo ..."; `pointing-hand demo, reduced motion` (still hand + arrow, nothing animating) | e2e (touch)           |
| AC-22.8 (S4) Picture progress          | spec `heart progress meter`: percentage only in the accessible name, heart fill moves, milestone spoken, tick + `full` + Next hop on done, Skip / Next / Photo! words, floating tool ring off on touch, accessories by thirds; probe `AC-4c` (the ring shows the tick), `AC-8a..c` (Next / Skip / Photo! words), `SS-C03` (Next contrast)                                                                                         | e2e                   |
| AC-22.9 (S5) Picture client card       | spec `client card: <device>` (four wishes with the tray's own icon svg, short label, short intro, portrait is a `data:` image, no sideways scroll, the wished circle pulses); `client card, reduced motion` (no ring); probe `AC-2`, `R2-02` (grid columns at 320x480 .. 844x390, no overflow), `SS-C05` (the sheet fits short landscape screens)                                                                                 | e2e                   |
| AC-22.10 (S6) Results                  | spec `results: <device>` (photo is the hero: >= 66 % of a phone's width, >= 48 % of a portrait tablet's; Play again is the single big button and in view; the hub is a <= 64 px icon link named "Back to PlayPad" to `../../index.html`; wish icons with a tick per match; coin total counts up monotonically to the banked amount); probe `AC-13`, `SS-C06`, `R2-03`, `SS-C03`, `AC-11d`                                         | e2e                   |
| AC-22.11 (S7) Accessories and stickers | spec `accessories: <device>` (tiara, earrings and necklace fully inside the stage host and below the step bar when chosen; the worn piece has a running pop animation); `stickers: drag and drop` (drag lands, off-face drop cancels, tap still adds, a placed sticker moves, a 600 ms hold removes it); probe `AC-6b`, `AC-6c`, `SS-QA-03`                                                                                       | e2e                   |
| AC-22.12 (S8) My Album                 | spec `My Album: saving and sanitising` (recipe saved and survives a reload; hostile / unknown data dropped, caps at 14 stickers and 12 looks, old saves load unchanged); `My Album sheet: <device>` (opens by keyboard, pictures drawn locally per look, polaroids named and >= 48 px, big view, Esc back and out, focus returns, pictures freed on close, no network request); probe `AC-10a..c` (save robustness), `AC-17`      | e2e + integration     |

> **Seam features:** not applicable (static, no backend).

## Test cases

### Happy path

- [x] A makeover on a phone, a portrait iPad and a landscape iPad: everything on screen, no sideways scroll (`layout:`).
- [x] Pointing-hand demo plays on the first paint step and the first pick step, then never again on a step it has shown.
- [x] A finished makeover is saved as a recipe, shows in the album after a reload, and the album draws it.
- [x] A sticker is dragged from the tray onto the face; tap-to-place still works.

### Edge cases (boundaries)

- [x] 12 looks is the cap (15 seeded → 12); 14 stickers is the cap (20 seeded → 14, hostile entries counted against the first 14).
- [x] An old save (no recipe) loads unchanged; the album shows its empty message; Start still works.
- [x] Accessories: a first piece completes the step although the heart shows 1 of 3.
- [x] A press before the demo starts means the demo never shows on that step.
- [x] Reduced motion: the demo is a still hand with an arrow for about 2 s, nothing animating; no wish ring.

### Error paths

- [x] Recipe with unknown ids, prototype keys, wrong types, out-of-range or non-numeric sticker coordinates, a string / array instead of an object: dropped or clamped, never thrown (`errors` stays empty).
- [x] Dropping a dragged sticker off the face (on the tray) adds nothing.

### Non-functional checks

- [x] **Accuracy:** the recipe rendered in the album is the recipe saved (pictures differ per look; the big view paints).
- [x] **Risk:** the recipe is untrusted storage input: allow-listed ids per slot, finite clamped numbers, copied field by field (`cleanRecipe`); the album picture is a local `data:` SVG built from the page's own art (no `innerHTML` of stored text); no request leaves the page.
- [x] **Compliance:** no network, no new dependency, nothing fetched; every new motion is off under `prefers-reduced-motion`.
- [x] **Performance:** the demo hand, count-up and album animate only while active; no filter, no `backdrop-filter`; `#fx` stays hidden when empty; album pictures are plain canvases (`perf.md`, "after UX" rows).

## How to run

```
npm run smoke                                                    # the spec (tests/sparkle-salon-v2.spec.mjs) + the hub / game smoke
PW_CHROMIUM_PATH=/opt/pw-browsers/chromium node features/sparkle-salon/probe.mjs   # the deep v1 probe (not in CI)
node tools/serve.mjs 5611 &  node measure.mjs --cpu 4            # performance (see perf.md)
```

## Definition of done

- [x] All tests above pass.
- [x] Every acceptance criterion in `requirements.md` is covered.
- [x] The tests encode the **chosen** design (option A for the art; the UX items as specified in the UX review).
- [ ] `qa-report.md` is clean (no unresolved CRITICAL/HIGH) (QA panel is run by the orchestrator).

> The full release checklist is the **Definition of Done** in `docs/WORKFLOW.md` (Phase 6).

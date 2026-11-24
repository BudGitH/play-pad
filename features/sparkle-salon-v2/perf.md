# Sparkle Salon v2 — performance and calm-sound pass (AC-22.2, AC-22.3, AC-22.4)

> Chromium is not Safari. Absolute fps here means nothing for a real iPad (software GL, no real GPU). The ratios and the
> ordering are the useful part. Where a result depends on WebKit behaviour that could not be tested here, it says so.

## How it was measured

- Harness: the profiler's `measure.mjs` (kept in the session scratchpad, not in the repo). 4x CPU throttle, synthetic touch
  strokes at 120 Hz, Chromium 1243, profiles iPad 1024x1366 @2x, iPad landscape 1366x1024 @2x, phone 390x844 @3x.
- **Before** = HEAD `76ec1b0` (the art redraw `0769e74` is already in). **After** = this branch.
- Raw results (`before.json`, `after.json`) are not committed; the tables below are generated from them. Re-run with
  `node measure.mjs --cpu 4` against `node tools/serve.mjs 5611`.

## What changed (in the order it was done)

1. **Background without a runtime filter.** The sigma-12 blurred bokeh circles are radial-gradient fills (`bgBk0..9`). The
   sigma-4 soft-focus arch, bulbs and table could not be a plain gradient and keep the look, so it is baked **once** into a
   26 KB WebP (data URI, `<image>` in `.bgSvg`). Source and bake script: `bg-source.svg`, `bake-bg.mjs`. Mean pixel
   difference to the live-filter version is about 1/255 (max 16) at 390 and 1024 wide. No `<filter>` is left in the page.
2. **`#fx` hidden when empty.** `visibility:hidden` in CSS; `setFxShown(true)` runs in the loop before the first
   `drawParticles`, `setFxShown(false)` after the final clearing draw. The 2048x2732 backing store is kept (a lower DPR was
   rejected earlier: blurrier sparkles). The `.twk` twinkles are separate elements and are unaffected.
3. **Batched paint.** `stampPaint` draws only the radial gradient into `region.raw` (this frame's dabs, unmasked) and unions
   a dirty box. `flushAllPaint()` runs once per frame in `loop`: `flushPaint` builds `raw x mask` in `region.scratch` for the
   dirty box only, adds it to the visible canvas with one `drawImage`, then clears the box in `raw`. `fillRegion` and
   `recolorRegion` flush pending dabs first; `clearRegion` also empties `raw`. Coverage code (`stampRegion`, `vs`) is untouched.
   - Deviation from the profiler's patch: it kept one persistent unmasked buffer and re-masked it, which made soft edges
     paler and tighter than before (visible on blush). A per-frame buffer composited with source-over keeps the old
     saturating build-up of the mask edge. The `destination-in` clip warning does not apply because the work buffer
     (`scratch`) is only ever read inside the box.
4. **Ambient animation.** Root class `#app.painting` (set when a paint/wipe stroke starts or moves, cleared 250 ms after it
   ends, 1.5 s safety net if an end event never arrives) pauses `breathe`, `sway`, the glints, `.big-btn` and `#nextBtn` pulses
   with `animation-play-state: paused` (no jump). The tip guide pulse stays (it is meant to show during a touch stroke).
   `will-change: transform` is gone from the hair. The 27 glints are now 4 animated groups (`gl0..gl3`, negative delays);
   z-order of the specks changed trivially (they now sit on top of the dress art, they are 1-3 px dots).
5. **Small items.** `placeNudge` skips an unchanged `cssText` write (it ran every frame while the ring showed);
   `updateLashes` skips lashes whose value did not change; swish automation is rate-limited (see sound). Coalescing pointer
   moves to one `strokeTo` per rAF was **not done** (optional; with the batching the pointer path is no longer the bottleneck,
   and a synchronous read of progress after a move is what several probes rely on).
6. **Dress `fBlur4`.** Replaced: the soft highlight ellipse is a radial-gradient ellipse (`gSoftDot`), the blurred collar
   shadow is three stacked strokes of falling width and opacity. Screenshots show no visible difference.

## Before / after (Chromium, 4x CPU)

**iPad 1024x1366 @2x**

| Scenario                 | fps before | fps after | p95 gap ms    | max gap ms    | main busy %  | script ms   | long tasks |
| ------------------------ | ---------- | --------- | ------------- | ------------- | ------------ | ----------- | ---------- |
| title idle 5s            | 11.6       | **45**    | 116.7 -> 33.4 | 183.3 -> 50.1 | 11.1 -> 25   | 19 -> 38    | 0 -> 0     |
| play idle 5s             | 9          | **34.3**  | 133.3 -> 33.4 | 250 -> 50.1   | 28.2 -> 23.7 | 61 -> 115   | 1 -> 0     |
| cleanse sponge stroke 3s | 8.9        | **26.9**  | 133.4 -> 50.1 | 150 -> 83.3   | 39.4 -> 77.2 | 142 -> 161  | 0 -> 1     |
| shadow idle 3s           | 8.3        | **32.9**  | 166.7 -> 33.4 | 216.6 -> 50.1 | 27.1 -> 22.7 | 33 -> 61    | 0 -> 0     |
| shadow stroke 3s         | 8.9        | **41.3**  | 183.3 -> 50   | 183.4 -> 100  | 91.8 -> 65.1 | 1768 -> 309 | 12 -> 0    |
| blush stroke 3s          | 8.9        | **43.6**  | 183.3 -> 50   | 183.3 -> 83.3 | 90.7 -> 60.9 | 1635 -> 210 | 11 -> 0    |
| step transition          | 9.9        | **30.2**  | 116.7 -> 50   | 183.3 -> 66.6 | 44 -> 87.8   | 41 -> 78    | 2 -> 1     |

**iPad landscape 1366x1024 @2x**

| Scenario                 | fps before | fps after | p95 gap ms    | max gap ms    | main busy %  | script ms   | long tasks |
| ------------------------ | ---------- | --------- | ------------- | ------------- | ------------ | ----------- | ---------- |
| title idle 5s            | 19.5       | **59.5**  | 66.7 -> 16.8  | 116.6 -> 33.4 | 18 -> 29.6   | 35 -> 31    | 0 -> 0     |
| play idle 5s             | 17.2       | **56.7**  | 83.4 -> 33.3  | 100 -> 33.4   | 34.9 -> 23.9 | 77 -> 109   | 0 -> 0     |
| cleanse sponge stroke 3s | 16.2       | **47.6**  | 83.4 -> 33.4  | 150 -> 66.7   | 45.4 -> 87   | 148 -> 151  | 0 -> 1     |
| shadow idle 3s           | 16         | **52.9**  | 83.4 -> 33.3  | 116.6 -> 33.4 | 32.6 -> 26.3 | 40 -> 65    | 0 -> 0     |
| shadow stroke 3s         | 13.4       | **48.4**  | 150 -> 33.4   | 183.3 -> 50.1 | 92.8 -> 63.7 | 1784 -> 315 | 9 -> 0     |
| blush stroke 3s          | 13.9       | **50.5**  | 116.7 -> 33.4 | 150 -> 50     | 91.6 -> 59.7 | 1658 -> 240 | 6 -> 0     |
| step transition          | 16.5       | **52**    | 83.4 -> 33.3  | 99.9 -> 33.4  | 54 -> 80.8   | 68 -> 90    | 0 -> 0     |

**Phone 390x844 @3x**

| Scenario                 | fps before | fps after | p95 gap ms    | max gap ms   | main busy %  | script ms   | long tasks |
| ------------------------ | ---------- | --------- | ------------- | ------------ | ------------ | ----------- | ---------- |
| title idle 5s            | 59.3       | **59.9**  | 16.8 -> 16.7  | 33.4 -> 16.8 | 38.4 -> 30.3 | 46 -> 41    | 0 -> 0     |
| play idle 5s             | 52.3       | **59.9**  | 33.3 -> 16.7  | 83.3 -> 16.8 | 53.6 -> 24.5 | 165 -> 122  | 0 -> 0     |
| cleanse sponge stroke 3s | 44.8       | **59.4**  | 33.4 -> 16.8  | 50.1 -> 33.3 | 79 -> 82.6   | 207 -> 209  | 0 -> 0     |
| shadow idle 3s           | 50.5       | **59.9**  | 33.4 -> 16.8  | 50 -> 16.8   | 47 -> 23     | 67 -> 54    | 0 -> 0     |
| shadow stroke 3s         | 16.1       | **57.7**  | 133.3 -> 16.8 | 150 -> 33.5  | 95.4 -> 66.2 | 1876 -> 309 | 12 -> 0    |
| blush stroke 3s          | 24.8       | **58.6**  | 66.7 -> 16.8  | 83.4 -> 33.4 | 95 -> 59.8   | 1636 -> 240 | 2 -> 0     |
| step transition          | 52.6       | **52.3**  | 33.4 -> 33.4  | 49.9 -> 33.4 | 71.4 -> 81.4 | 102 -> 128  | 0 -> 0     |

Layers with content (CDP LayerTree, play screen): iPad 58 -> 26 layers, 8.4 -> 5.3 Mpx; iPad landscape 54 -> 30, 6.3 -> 4.6 Mpx;
phone 51 -> 23, 3.0 -> 1.7 Mpx.

Reading it:

- iPad idle goes from 8-12 fps to 33-45 fps (landscape 53-60), and an eye-shadow stroke from 8.9 to 41 fps with no long tasks
  (12 before). Script time during a stroke drops from 1.8 s to 0.3 s per 3 s.
- Phone: nothing got slower. Idle and strokes are at 58-60 fps (before 16-52). The step transition is level (52.6 vs 52.3).
- "Main busy %" rises on the sponge stroke and on step transitions only because the frame rate rose 3x (the main thread now
  does 3x as many frames in the same second); script ms per frame is lower or equal.
- What is left on iPad portrait (idle 33-45 fps): the compositor drawing five stage-size art layers while `breathe` / `sway`
  animate them. The profiler's ladder showed breathe as the next biggest item (+16 fps when off) but the owner decision of
  2026-11-22 keeps the sway and the breathing; they are only paused during strokes. On a real GPU this is expected to be
  cheaper than in this software-GL run.

## Acceptance criteria status

| AC                 | Status                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AC-22.2 iPad       | Idle frames do no canvas redraw (fx hidden and not drawn) and no per-frame style write (nudge deduped; iris and tool already write on change only). A stroke does at most one paint composite per frame and no read-back (there was never a `getImageData`). The fx backing store was NOT capped in the perf pass (hidden when empty; see item 2); the UX round added the cap (`FX_MAX_PX` = 3 Mpx, see "After the UX round"). |
| AC-22.3 phone      | Met: no scenario is slower (table above).                                                                                                                                                                                                                                                                                                                                                                                      |
| AC-22.4 calm sound | Met (below).                                                                                                                                                                                                                                                                                                                                                                                                                   |

## After the UX round (S1-S8): "after UX" rows

The UX round (iPad layout, heart meter, pointing-hand demo, picture client card, results, sticker drag, My Album) was measured
with the same harness and the same throttle (4x CPU, 120 Hz synthetic touch strokes).

- **Pairing.** The "before UX" column is the page at HEAD `dc64771` (the end of the perf pass above), run **back to back in the
  same session** with the final page, because absolute numbers move by 10-20 % between sessions on this machine (the tables
  above came from an earlier session: the same page gave 309 ms of script for a shadow stroke then and about 500 ms now). Read
  each row as a pair, not against the tables above. Run-to-run noise on a single row is about +/- 8 %.
- **What is new on the hot paths, and how it was kept cheap.**
  - The demo hand animates the real tool and the hand with WAAPI transforms for about 2.8 s, once per step per session, and never
    runs at idle. Nothing runs per frame; the idle nudge check only reads one boolean.
  - The coin count-up is 20 timers over 800 ms; the album draws one picture per animation frame, only while the sheet is open,
    into plain canvases that are dropped when it closes. Nothing in the album animates.
  - The 25 / 50 / 75 % milestone does **not** use the particle canvas: three pooled `.twk` elements animate with WAAPI. (A first
    version used `sparkleUnits`; it kept the big `#fx` layer on screen for the whole stroke and cost 8-14 % of the iPad stroke
    frame rate.)
  - No SVG or CSS `filter`, no `backdrop-filter`, no new blurred shadow on a large element. `#fx` is still `visibility: hidden`
    when empty; the batched paint flush is untouched.
- **The wider iPad column means more pixels** (landscape stage 603x905 -> 683x1024 px, and the tablet camera boost zooms the face
  steps 1.25x more). The one thing that grew with it was the particle layer, which is sized to the app column: 1100 x 1024 at 2x
  is 4.5 Mpx. It is now **capped at 3 Mpx of backing store** (`FX_MAX_PX`; drawing scale 1.46 on iPad portrait, 1.63 on iPad
  landscape, still 2 on phones). That also meets the "backing store cap" half of AC-22.2 that was open before: the largest canvas
  is now 3 Mpx (iPad portrait canvas total 6.7 -> 4.5 Mpx). Sparkles are drawn from a sprite at that scale; at tablet size the
  difference is not visible in the screenshots.
- **Result.** Every scenario is within +/- 10 % of its pair except **iPad landscape, step transition (-20 %, 55 -> 44 fps)**.
  That row is two camera glides with a 28-star completion burst each, and the stage there is 28 % bigger on screen. Variants
  with the tablet boost off, the demo off, the wish ring off or the Next hop off did not change it beyond the noise; removing
  the burst did, which is how the particle-layer cap above was found (it was -44 % before the cap). It is a software-GL number
  in a 2.4 s window; it was not reproduced on a real GPU.

**iPad 1024x1366 @2x**

| Scenario                 | fps before UX | fps after UX | change | p95 gap ms   | max gap ms   | main busy %  | script ms  | long tasks |
| ------------------------ | ------------- | ------------ | ------ | ------------ | ------------ | ------------ | ---------- | ---------- |
| title idle 5s            | 49.5          | **54.1**     | +9 %   | 33.4 -> 33.3 | 50 -> 50     | 23 -> 23.6   | 30 -> 29   | 0 -> 0     |
| play idle 5s             | 42            | **41.6**     | -1 %   | 33.4 -> 33.4 | 50.1 -> 50   | 21.8 -> 17.1 | 105 -> 82  | 0 -> 0     |
| cleanse sponge stroke 3s | 28.1          | **34.4**     | +22 %  | 50 -> 49.9   | 50.1 -> 66.6 | 81 -> 56.2   | 163 -> 136 | 0 -> 0     |
| shadow idle 3s           | 37.3          | **37.9**     | +2 %   | 33.4 -> 33.4 | 83.3 -> 50   | 21 -> 20.4   | 51 -> 44   | 0 -> 0     |
| shadow stroke 3s         | 46.1          | **48.6**     | +5 %   | 49.9 -> 33.4 | 66.6 -> 66.7 | 64.7 -> 56.5 | 466 -> 487 | 0 -> 0     |
| blush stroke 3s          | 45.9          | **48**       | +5 %   | 49.9 -> 33.4 | 66.7 -> 50.1 | 59.3 -> 47.4 | 376 -> 339 | 0 -> 0     |
| step transition 2x       | 39.8          | **39.1**     | -2 %   | 33.5 -> 33.5 | 50 -> 66.6   | 85 -> 66.9   | 72 -> 88   | 0 -> 0     |

Stage 831x1247 -> 803x1205 px; canvas backing stores 6.72 -> 4.47 Mpx.

**iPad landscape 1366x1024 @2x**

| Scenario                 | fps before UX | fps after UX | change | p95 gap ms   | max gap ms   | main busy %  | script ms  | long tasks |
| ------------------------ | ------------- | ------------ | ------ | ------------ | ------------ | ------------ | ---------- | ---------- |
| title idle 5s            | 59.9          | **59.9**     | 0 %    | 16.8 -> 16.7 | 16.8 -> 16.8 | 26.5 -> 21.3 | 33 -> 20   | 0 -> 0     |
| play idle 5s             | 56.7          | **59.7**     | +5 %   | 16.8 -> 16.7 | 100 -> 16.8  | 24.3 -> 20.1 | 122 -> 89  | 0 -> 0     |
| cleanse sponge stroke 3s | 52.2          | **53.8**     | +3 %   | 33.4 -> 33.3 | 33.4 -> 50   | 78.9 -> 83.1 | 151 -> 156 | 0 -> 0     |
| shadow idle 3s           | 57.9          | **58.3**     | +1 %   | 16.8 -> 16.8 | 33.4 -> 33.4 | 19.9 -> 25   | 55 -> 50   | 0 -> 0     |
| shadow stroke 3s         | 50.7          | **51.9**     | +2 %   | 33.3 -> 33.4 | 116.6 -> 50  | 59.9 -> 66   | 469 -> 542 | 0 -> 0     |
| blush stroke 3s          | 52.8          | **51.8**     | -2 %   | 33.3 -> 33.4 | 50 -> 49.9   | 54.8 -> 60.2 | 349 -> 403 | 0 -> 0     |
| step transition 2x       | 55.1          | **44.3**     | -20 %  | 33.4 -> 33.4 | 50 -> 50     | 81.9 -> 70.9 | 83 -> 71   | 0 -> 0     |

Stage 603x905 -> 683x1024 px; canvas backing stores 4.4 -> 4.47 Mpx.

**Phone 390x844 @3x**

| Scenario                 | fps before UX | fps after UX | change | p95 gap ms   | max gap ms   | main busy %  | script ms  | long tasks |
| ------------------------ | ------------- | ------------ | ------ | ------------ | ------------ | ------------ | ---------- | ---------- |
| title idle 5s            | 59.9          | **59.9**     | 0 %    | 16.7 -> 16.8 | 16.8 -> 16.8 | 25.2 -> 26.5 | 28 -> 38   | 0 -> 0     |
| play idle 5s             | 59.8          | **59.8**     | 0 %    | 16.7 -> 16.8 | 16.8 -> 33.3 | 19.5 -> 17.5 | 94 -> 81   | 0 -> 0     |
| cleanse sponge stroke 3s | 59.3          | **59.4**     | +0 %   | 16.8 -> 16.8 | 33.3 -> 33.3 | 64.3 -> 62.2 | 165 -> 187 | 0 -> 0     |
| shadow idle 3s           | 59.6          | **59.6**     | 0 %    | 16.8 -> 16.7 | 16.8 -> 16.8 | 16.6 -> 20.7 | 50 -> 58   | 0 -> 0     |
| shadow stroke 3s         | 59.3          | **59.4**     | +0 %   | 16.8 -> 16.7 | 33.4 -> 33.4 | 60 -> 57.8   | 510 -> 522 | 0 -> 0     |
| blush stroke 3s          | 59.3          | **59.2**     | -0 %   | 16.8 -> 16.8 | 33.3 -> 33.4 | 50.4 -> 54.6 | 354 -> 390 | 0 -> 0     |
| step transition 2x       | 59.6          | **58.1**     | -3 %   | 16.8 -> 16.8 | 33.3 -> 33.4 | 62.3 -> 68.9 | 83 -> 115  | 0 -> 0     |

Stage 437x655 -> 437x655 px; canvas backing stores 2.43 -> 2.78 Mpx.

Largest drops in the final pairs: iPad landscape step transition -20 %; everything else -3 % or better.

## Calm brush sound (AC-22.4)

The only brush voices are `Sfx.fx.swish` (brush, wand, lipstick, sponge) and the sponge squeak inside it. All still synthesised.

| Parameter     | Before                                                                                         | After                                                                                                                                             |
| ------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source        | white noise, band-pass 2.4 kHz (lipstick 1.0, sponge 1.5, wand 3.2 kHz, +2 Hz per px/s), Q 0.9 | white noise, **low-pass 2.6 kHz (Q 0.5)**, then band-pass at 450 (lipstick) / 560 (sponge) / 650 (brush) / 800 Hz (wand) + 0.4 Hz per px/s, Q 0.6 |
| Level         | `speed * 0.00042`, cap 0.17                                                                    | `speed * 0.0002`, floor 0.02, cap 0.085 (about 10 dB lower)                                                                                       |
| Ramps         | gain tau 25 ms, filter tau 30 ms, fade 40 ms after 80 ms of stillness                          | every change `setTargetAtTime`: tau 60 ms (attack), release tau 100 ms after 120 ms of stillness; no jumps                                        |
| Update rate   | 2 automation events per pointer move (up to 240 / s)                                           | at most one update per 45 ms, speed smoothed (35 % per update)                                                                                    |
| Sponge squeak | 1.8-2.7 kHz sine, gain 0.045, 70 ms, rising 14 %, every 150 ms above 120 px/s                  | 620-920 Hz sine, gain 0.016, 180 ms with 45 ms attack, rising 7 %, every 450 ms above 160 px/s                                                    |

Offline render (real strokes through the real handlers into a virtual-time `OfflineAudioContext`, 44.1 kHz, 3 s per tool,
music and unrelated tones muted; FFT 4096 over the steady part of the stroke; `sound.mjs` in the scratchpad):

| Voice                | RMS before | RMS after  | Energy above 4 kHz before | after                | Centroid before -> after | Onset max sample step before -> after |
| -------------------- | ---------- | ---------- | ------------------------- | -------------------- | ------------------------ | ------------------------------------- |
| brush (eye shadow)   | -24.9 dBFS | -34.4 dBFS | 66.6 % (-1.8 dB re total) | **1.2 % (-19.3 dB)** | 5628 -> 1610 Hz          | 0.160 -> 0.016                        |
| wand (mascara)       | -24.2      | -34.0      | 80.4 %                    | **1.4 %**            | 6516 -> 1711 Hz          | 0.177 -> 0.019                        |
| lipstick             | -29.0      | -35.6      | 29.3 %                    | **0.8 %**            | 3665 -> 1369 Hz          | 0.079 -> 0.011                        |
| sponge (with squeak) | -36.4      | -45.6      | 20.5 %                    | **0.6 %**            | 3132 -> 1237 Hz          | 0.044 -> 0.007                        |

Time to 90 % of the steady level after stroke start: 49-58 ms before (sponge 12 ms) -> 27-139 ms after; fade to -20 dB after
release: 150-215 ms before -> 285-330 ms after. The sponge voice is the quietest because its strokes are slower.

## Not verified / risks

- **The wider iPad column and the tablet camera boost are unmeasured on a real iPad.** Chromium with software GL shows -20 % on one
  landscape row (above); a real GPU is expected to be cheaper, but Safari was not tested. The stage is bigger on screen, so the
  five art layers raster more pixels at the end of each camera glide.

- **No WebKit here.** That SVG filters and SVG-child animations are the iPad Safari cost is the profiler's best lead
  (confirmed for Chromium), not a measurement on Safari. The fixes remove those costs outright, so they should not make
  Safari worse, but the size of the gain on a real iPad is unmeasured.
- WebP with alpha for the baked backdrop needs Safari 14+ / iPadOS 14+. If the image failed to decode, the sky gradient and
  the bokeh circles still show (only the arch, bulbs and table would be missing).
- The soft mask edge now builds per frame instead of per dab: the look matches to within a few percent (see
  `screens/perf-*`), it is not pixel-identical.
- The 4 sound levels are by ear-model only (RMS and spectrum), nobody has listened on a real iPad speaker.

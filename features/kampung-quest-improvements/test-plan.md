# Test plan: Kampung Quest improvements

Each acceptance criterion in `requirements.md` maps to at least one test.

| AC  | Test(s)                                                                                                                                                                                                                                                                       | Type          |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| 1   | `tests/kampung-quest-hud-move.spec.mjs` (one control per action); `tests/kampung-quest-mobile.spec.mjs` (no HUD box overlap, `#kqJump` on screen); `tests/kampung-quest-prayer.spec.mjs` (Sunat note and dock calm)                                                           | browser       |
| 2   | `tests/kampung-quest/greet.test.mjs` (rules, caps, religious accuracy); `tests/kampung-quest-greetings.spec.mjs` (hero greeted, strollers, no extra draw calls)                                                                                                               | unit, browser |
| 3   | `tests/kampung-quest/ambience-mix.test.mjs` (mix maths); `tests/kampung-quest-ambience.spec.mjs` AMB-1..7 (start, clock, place, mute / pause / hidden, azan, prayer flow, footsteps)                                                                                          | unit, browser |
| 4   | `tests/kampung-quest/sunat-and-gametime.test.mjs` (sunat plan, tracker untouched, refusal, take-over, drop keeps wudu); `tests/kampung-quest-prayer.spec.mjs` section 4 (end to end, fard wins, stray, Not now, take-over of an idle sunat flow, hall Pray over a sunat flow) | unit, browser |
| 5   | `tests/kampung-quest/sunat-and-gametime.test.mjs` (due at the exact minute, skips, rewind, no wall clock in the prayer path); `tests/kampung-quest-prayer.spec.mjs` section 5 (Asar step, one azan per skip, rest, save / reload, countdown)                                  | unit, browser |
| 6   | `tests/kampung-quest-hud-move.spec.mjs`; `tests/kampung-quest-mobile.spec.mjs` (`#kqRun` gone)                                                                                                                                                                                | browser       |
| 7   | `tests/kampung-quest-hud-move.spec.mjs` (Shift + W + Space, air momentum); `tests/kampung-quest-mobile.spec.mjs` (walk vs run by reach, stick + Jump with two fingers); `tests/kampung-quest/jump.test.mjs`                                                                   | browser, unit |

## How to run

```
npm run check
npm run test:kq
npx playwright test tests/kampung-quest-{prayer,ambience,hud-move,greetings}.spec.mjs --project=kampung-quest
```

(Browser specs: `npx playwright install chromium` once, or set `PW_CHROMIUM_PATH`.)

# Kampung Quest - prayer improvements (owner requests 4 and 5)

## 4. Pray any time in the mosque (voluntary sunat prayer)

**Behaviour.** Inside the prayer hall (the hall plus its verandah, from `KQ.WorldParts.LAYOUT.mosque`) a Pray prompt is always on the floating button, not only within 2.4 m of the prayer spot.

- If a fard prayer is due, in progress or owed (qada) the prompt reads **Pray** and starts that prayer, exactly as before.
- Otherwise it reads **Sunat prayer** (screen-reader label "Sunat prayer (2 raka'at)") and offers a voluntary 2-raka'at prayer through the same guided flow: wudu at the taps (skipped if the wudu is still clean), then the posture tiles. Panel title: "Sunat prayer - raka'at 1 of 2".
- The wudu taps behave the same way: with nothing owed they start the sunat flow.
- In the hall without clean wudu the prompt gives a kind hint and draws the footprint trail to the taps (no flow starts until wudu begins).

**What a sunat prayer never does.** It has no tracker entry: the five-prayer strip, the qada list, `due`, the prayer stickers, coins and the mission pause are all untouched (`js/sim/prayer.js`, `startSunat` / `finishSunat`). It is refused while a fard prayer is due or being prayed, and a fard prayer falling due mid-sunat takes over (the wudu carries across). A sunat flow the hero walks away from (more than 50 m from the hall, no screen open) is dropped so the clock does not stay slowed. Reward: the praise card only (no coins, no sticker; "small optional reward" deliberately left out to keep the prayer flow free of loot).

**Raka'at and order.** Plan = takbir, 2 x (qiyam, ruku, itidal, sujud, julus, sujud), final tasyahud, salam right, salam left (16 steps; no tasyahud awal, no qunut). Built by `KQ.Sim.Prayer.rakaatPlan("sunat")`; the UI never re-implements it.

**Interaction priority** (`KQ.Sim.Actions`, formerly `Missions.pickTarget`): the hall-wide prompt is a `fallback` object. A neighbour who can be talked to now always beats it; every real object (taps, counters, pick-ups) is found first and the fallback only appears when none is in reach.

**Note for the owner (religious accuracy).** Voluntary prayers without a specific cause are discouraged (makruh) in the Shafi'i school after Subuh until sunrise, after Asar until Maghrib and at the zenith. Per the request the game offers it at any time and does not model those windows; say if you want the prompt to hide in them.

## 5. Azan and prayer time follow game time

**Finding: the sim already follows the game clock; no wall-clock code was involved.** Evidence:

- `js/sim/prayer.js` `update(minute, day)` is a pure function of the injected game-clock reading; the `due` event is stamped with the start minute (`at`) and fires on the first reading `>=` it. `js/sim/clock.js` advances only by `tick(dt)` from the game loop.
- Source guard (`tests/kampung-quest/sunat-and-gametime.test.mjs`, last test): no `Date.now`, `new Date`, `performance.now` or `setInterval` in `js/sim`, `js/data`, `prayer-flow.js` or `hud-view.js`. `Date.now` appears once on the prayer path, in `prayer-ui.js`, only to pace screen-reader announcements.
- Pause / hidden tab stop the clock (`Loop.frame`), so no real time is ever "caught up".
- Browser spec `tests/kampung-quest-prayer.spec.mjs` replaces `Date.now` with random nonsense and still sees the azan start on the step that crosses 16:17, after rest, and after save + reload.
- The HUD already showed game-clock times ("Next: Asar 16:17"; `inMin` is game minutes).

**The gaps found and fixed.**

1. **A time skip played one azan per crossed start time.** A single `update` over a long jump (setMinute, a long catch-up, any skip) emits `due` and `qada` for every prayer it crosses; `PrayerFlow.onEvents` called `onDue` for each, restarting the azan audio and caption card for prayers whose window had already closed. Reproduced before the fix: 07:00 -> 20:00 recorded `["zohor","asar","maghrib"]` azan starts; now exactly `["maghrib"]` (`liveDue` in `prayer-flow.js`: only the last `due` whose window did not close in the same batch starts an azan).
2. **The HUD gave no game-time countdown.** Within 30 game minutes it said only "Asar soon", which a player reads as real time (30 game minutes is one real minute). It now says "Asar in 12 min" inside the last 60 game minutes (`hud-view.js` `nextNote`, one isolated edit) and counts down one per two real seconds; further out it keeps "Next: Asar 16:17".
3. **Azan during a sunat flow.** A running sunat flow does not hold back the azan of a prayer that falls due (only a fard flow does, as before), so the new voluntary prayer cannot make a real azan silent.

**Left as designed (not bugs).** While a fard prayer flow runs the clock slows to 25 % (`FLOW_RATE`) and a prayer falling due during it shows its card without sound after the flow; loading a save with a prayer already due shows the card quietly (no second azan); a rewind rebuilds the tracker.

## Tests

- `tests/kampung-quest/sunat-and-gametime.test.mjs` (unit, `npm run test:kq`): sunat plan and flow, tracker untouched, refused over a fard prayer, take-over, save round trip and hostile snapshot; due fires at exactly the start minute for fixture and real MUIS times; skip emits chronological stamped events; one-minute rest hops; save/load before and after a start; rewind; countdown is game minutes; no wall clock in the prayer path; `pickTarget` fallback.
- `tests/kampung-quest-prayer.spec.mjs` (browser): sunat end to end (zone prompt, wudu, 16 taps, tracker unchanged, second sunat with clean wudu), fard wins when due, stray sunat dropped, azan on the Asar-crossing step, one azan per skip, rest stops at the start, save/reload, HUD countdown.

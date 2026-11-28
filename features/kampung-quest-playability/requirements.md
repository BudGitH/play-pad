# Feature: Kampung Quest playability round (map, mounts, hero choice, vehicles, kid UX, life, looks, iPad)

> One owner brief (2026-11-28) covering eight areas. This file defines "done"; `test-plan.md` maps each AC to a spec. Per-area build notes from each workstream are in `notes-<area>.md` and are folded into the brain docs at CAPTURE.

**Status:** IMPLEMENTED (QA and product gate pending)
**Owner:** @BudGitH
**Ticket:** PLAY-014 (Kampung Quest follow-up)
**Created:** 2026-11-28
**Feature tier:** Standard

---

## What & why

- **What:** (1) every establishment in both regions is on the radar and on a full, zoomable map; (2) camels can be greeted, fed and ridden, and horses are added and ridable; (3) the player picks a boy or girl hero, with customisation for both; (4) vehicles sit on the ground, cannot be walked through, look better and are clearly faster than running; (5) instruction cards (wudu, prayer, tawaf, sa'i, Umrah) can be minimised so they never block play; (6) the kampung's people are more interactive (kids and neighbours greet, little scripted world events happen), and missions are more varied; (7) the world looks brighter and less dull; (8) the game loads and runs well on iPad.
- **Why:** owner play-test feedback: children could not find the tailor or the camels, the cards blocked the screen during the rites, cars hovered and could be walked through and were too slow to bother with, the town felt dull and quiet, and the game loaded poorly on iPad.

## Business requirements & success metrics

- **Business outcome:** a 6-10 year old can find any place, get there by the most fun means (walk, run, bike, car, camel, horse), do the rites without the screen being blocked, and play as a boy or a girl, on an iPad, without help.
- **Success metric:** every AC passes in CI; no console errors in either region; all existing suites stay green; low-tier draw calls stay < 400 in audited views; iPad-class boot reaches "Start enabled" faster than before (measured before/after, in `notes-ipad.md`).
- **Must-have business rules (unchanged, never break):** no violence, no fail state, no scolding; vehicles and animals never hurt anyone (they slow/stop); modest clothes only for both heroes (girl: long sleeves, long skirt or trousers, optional hijab; ihram rules per gender, women's ihram is ordinary modest clothes with the face and hands uncovered); religious accuracy stays in `KQ.Sim.Prayer` / `KQ.Sim.Umrah`; text enters the DOM via `textContent` only; the save is untrusted input (new fields sanitised in `KQ.Sim.Save`); CC0/permissive assets only, credited; `file://` still works (procedural stand-ins); build-free classic scripts under `window.KQ`; lint: functions <= 40 lines, depth <= 3.

## Target personas & success bar

- **Personas served:** **Priya & kid, "Sofa Co-op"** (7-year-old on an iPad with a parent), **Maya, "Commuter Casual"** (phone, one hand), **Sam, "Keyboard / AT user"** (map, hero choice and cards by keyboard).
- **Baseline (hard gate):** the child finds the tailor and the camels from the map; rides a camel and a horse; picks a girl or boy hero; drives a car that is faster than running and cannot be walked through; minimises the tawaf card and still finishes the tawaf.
- **Value (hard gate):** vehicles/animals are worth using over walking; the full map helps plan a route; the town feels alive; it runs on an iPad.
- **High satisfaction (scored, not gated):** wants to try every mount and outfit, notices the town events, would show a friend.

## Design routing

- UI surface? **yes** (full map, hero picker, minimised card chip, mount prompts). Tier **Standard** → **Path: lite** (checked against `docs/DESIGN-SYSTEM.md` and `features/kampung-quest/design-review.md`). Decision recorded in `docs/DECISIONS.md`: the owner asked for an end-to-end build through merge, so the 4-option mockup round is replaced by the lite check plus screenshots shown to the owner during the build.
- **Crosses FE/BE seam?** no.

## Acceptance criteria

### A. Map (radar + full map)

- [x] **AC-P1:** every establishment in both regions (kampung: mosque, hawker / each food stall group, shops, tailor Butik, home, park, playground, clinic/library etc. as present; Makkah/Madinah: Kaaba / Haram gates, Safa-Marwa, Prophet's Mosque, tailor, camel yard, caravan, oasis, horse stable, food, hotel, vehicle parks) has a labelled icon on the full map and shows on the radar when in range.
- [x] **AC-P2:** tapping/clicking the radar (or M) opens a full-screen map of the whole region with the hero's position and heading, a legend, and the current objective highlighted.
- [x] **AC-P3:** the full map zooms in and out (pinch, mouse wheel, +/- buttons >= 48 px) and pans (drag), clamped to the world; a "centre on me" button; Escape / close button / backdrop closes it; keyboard operable.
- [x] **AC-P4:** tapping a place on the full map shows its name and sets it as a "go here" target (a radar arrow + ground beacon), cleared on arrival or by tapping again.
  - Note: a tap selects a place and shows its card; **Go here** on the card sets the target (so a child panning does not set one by brushing the map). Decision in `docs/DECISIONS.md` (2026-11-28 kq playability).

### B. Animals

- [x] **AC-P5:** camels in Makkah can be interacted with: "Say hi" (a little reaction + sound) and "Ride"; riding seats the hero on the hump with a ride pose, moves faster than running, obeys colliders and no-ride zones (the Haram plazas), and Exit sets the hero down on free ground.
- [x] **AC-P6:** horses exist (a stable/paddock in Makkah outskirts and a pony ride in the kampung park area), look like horses (not reskinned camels), can be greeted and ridden like camels, and are on the map.
- [x] **AC-P7:** animals never hurt anyone: they slow/stop for people, stay on the ground, and the ridden animal walks/trots with an animated gait (legs move).
  - Note: the braking rule is unit-tested (`mount.test.mjs`, the vehicles' `speedCap`); no browser test drives an NPC into a ridden animal's path.

### C. Hero choice

- [x] **AC-P8:** on New game the player picks Boy or Girl (big picture cards, keyboard operable); the choice is saved (sanitised), and can be changed later at the tailor.
- [x] **AC-P9:** the girl hero is a distinct model (face, hair or hijab, silhouette) in the same toy style; both heroes have customisation (outfits x colours; hair or hijab styles for the girl; hair/cap styles for the boy); all modest.
- [x] **AC-P10:** ihram follows the hero's gender during the rites and the chosen look comes back after; the girl's prayer uses the women's rows / prayer spot where the world has one.
  - Note: the girl's wudu still uses the shared taps (the women's wudu room is a follow-up); in Makkah / Madinah she uses `prayer_spot_women` (no separate women's row of NPCs).

### D. Vehicles

- [x] **AC-P11:** every car, bicycle and scooter rests its wheels on the ground (wheel bottom within 3 cm of ground height) parked and while driven; nothing hovers.
- [x] **AC-P12:** the hero cannot walk into or through a vehicle (parked or moving); NPCs and the crowd route around parked vehicles; a driven vehicle stops at other vehicles.
  - Note: crowd slots a vehicle covers are pruned on the first reconcile and the NPCs' near-collider cache is cleared on parking; there is no dedicated browser test of an NPC re-routing around a car.
- [x] **AC-P13:** top speeds: car >= 2.5x hero run speed, scooter >= 2x, bicycle >= 1.5x, with smooth acceleration; camera keeps up.
- [x] **AC-P14:** improved models: cars with proper body curvature, wheel arches, windows, lights, mirrors; bicycle with a real frame (diamond frame, spokes, chain, handlebars); scooter recognisable; draw-call budget kept.

### E. Kid UX: instruction cards

- [x] **AC-P15:** every stepper card (wudu, prayer, tawaf, sa'i, Umrah/Hajj/Ziarah steps, eating) has a minimise button (>= 48 px); minimised, it becomes a small chip showing the step and counter that never covers the hero or the joystick; tap restores it. The rite keeps counting while minimised; "Walk for me" keeps working.
- [x] **AC-P16:** during auto actions (Walk for me, auto wudu/prayer animation) the card auto-minimises to the chip so the child can watch, and restores at the next step needing a tap.
  - Note: wudu and prayer have no self-playing sequences today, so only Walk for me and the haircut scene auto-minimise (`RitualUI.setBusy` is the hook for a future "do it for me").

### F. Life and missions

- [ ] **AC-P17:** kampung kids and neighbours greet the hero and can be greeted (a "Say hi" on any nearby cast or crowd kid/neighbour gives a reply bubble + wave), like the Haramain greeting.
  - Status (QA round 1): met for crowd extras (tested); the cast neighbours keep Talk by design (a deliberate deviation, deferred to the owner's call). Left unticked until then.
  - Note: NOT ticked. Crowd extras (kids and neighbours) get **Say hi**, and kids call out first, but the cast neighbours keep **Talk** (their dialogue opens with the greeting) and have no separate Say hi button.
- [x] **AC-P18:** small scripted world events happen during play in both regions (e.g. kids' football match, an ice-cream cart arrival, a cat chase, a wedding procession (kompang), rain shower, a lost-balloon, pigeons scattering); each has a short bubble/sound and optional tiny reward; at most one at a time, child-safe.
  - Note: all nine events are built (one at a time, child-safe); the balloon and the wedding procession were checked by hand only, the rest by spec.
- [x] **AC-P19:** at least 8 new missions with varied verbs (deliver, find, escort, ride-to, photograph/spot, help-a-kid, race-the-clock-without-failing, collect), spread over both regions, using the new mounts/map where it fits; no fail state.

### G. Looks

- [ ] **AC-P20:** the world is visibly brighter and more colourful in daylight (sky, ground, building paint, foliage) in both regions without blowing out highlights; night still reads as night; measured: mean scene saturation and luminance up vs the baseline screenshot in the same pose.
  - Status (QA round 1): met by measurement; the owner's visual sign-off is deferred (it is a judgement call, not a test).
  - Note: NOT ticked. Implemented and measured (saturation +25-50 %, luminance +2-16 %, no clipped white, night unchanged; `notes-looks.md`, `tests/kampung-quest-looks.spec.mjs`); left open for the owner's visual sign-off.

### H. iPad

- [ ] **AC-P21:** iPad (iPadOS reports "Macintosh" + touch) is detected as a touch tablet: touch controls, low/med tier start, pixel ratio cap.
  - Note: NOT ticked. Implemented and covered by `tests/kampung-quest-ipad.spec.mjs`; left open with AC-P22 / P23 until a real iPad confirms it.
- [ ] **AC-P22:** boot work is cut: the loading screen shows real progress; heavy work (textures, shader compiles, higher tiers, the other region) is deferred or streamed; time-to-Start-enabled and peak memory are measured before/after (iPad emulation + 4x CPU throttle) and improve.
  - Status (QA round 1): met in emulation; the real-iPad measurement is deferred (needs a device).
  - Note: NOT ticked. Start enabled is down 42-57 % in the kampung and 13-17 % in Haramain under 4x CPU throttle in emulation (`notes-ipad.md`); not yet measured on a real iPad / Safari.
- [ ] **AC-P23:** no long main-thread stalls (> 200 ms) after Start in the first 10 s of play on the throttled iPad profile; WebGL context loss is recovered or shown as a friendly card.
  - Status (QA round 1): met in emulation; the real-iPad check is deferred (needs a device).
  - Note: NOT ticked. No new one-off stall in the first 10 s (emulated) and a context-loss card exist; Haramain's longest load task rose 5.0 to 6.2 s (the warm-up render with culling off) and needs a real-iPad check.

### I. Simple actions for 7-year-olds (added 2026-11-28, owner follow-up)

> Owner: "Users are confused in terms of the actions they need to take. If the user goes into rest, the hovering part, the praying part, it just confuses the user. Have a simple way to manage it ... it's causing frustration for some of the users who are 7 years old." Detailed ACs come from `actions-audit.md` and are implemented after the A-H merge, so they also cover the new Say hi / Ride / Go here / event actions.

- [x] **AC-P24:** one consistent way to do each action: a picture-first action control in a fixed place (no label that jumps between targets), a small picture chooser when two or more actions are in reach, spoken hints for non-readers.
- [x] **AC-P25:** Rest and Pray each take one obvious path (Rest: one tap, no yes/no dialog; Pray: the Pray button always does the next right thing, wudu first, with no new rule changes to `KQ.Sim.Prayer`).
  - Note: the existing prayer, mobile HUD and `test:kq` suites were adapted for the one Pray path; the pre-existing failures listed in `notes-actions.md` (rituals dock button, portrait azan-pill overlaps) are tracked in `docs/findings-ledger.md` (`hud-element-overlap`).

### J. Vehicle life and traffic (added with the vehicle-life workstream; `notes-vehicle-life.md`)

- [x] **AC-P26:** ambient traffic and the town bus: cars drive the road with a driver (and sometimes passengers) and the bus carries a driver and seated passengers who are visible; at the bus stop people get off and walk away and others walk up, board and sit (bays at the kerb do the same for a parked car). Every road user yields to people on foot (the hero, cast neighbours, crowd extras and the actors of a scripted world event) and stops before a zebra crossing while anyone is on it; vehicles are moving solids, never carjack the hero, and never hurt anyone (they only slow and stop).
  - Covered by `tests/kampung-quest-vehicle-life.spec.mjs` (traffic and bus legs, incl. a scripted-event actor in a car's lane), `tests/kampung-quest/traffic.test.mjs`, `tests/kampung-quest/vehicle.test.mjs` (look-ahead, braking).
- [x] **AC-P27:** vehicle life: getting in and out plays a short door scene (walk to the door, it opens, climb, it shuts; a bicycle or scooter gets a step and a swing; input locked, skippable); brake, head, reverse and indicator lights follow what the vehicle does (and go off when the hero gets out); exhaust only from petrol and diesel (never electric or bicycles), pooled into one draw call; subtle synthesised sounds (engine, bicycle tick, doors, horn) that obey mute, pause, a hidden tab and the azan.
  - Covered by `tests/kampung-quest-vehicle-life.spec.mjs`, `tests/kampung-quest-vehicle-rig.spec.mjs` (the model's doors and lamps), `tests/kampung-quest/vehicle-life.test.mjs` (timeline, lights, puff rates) and `tests/kampung-quest/vehicle-mix.test.mjs` (the sound mix numbers).

# Feature: Kampung Quest playability round (map, mounts, hero choice, vehicles, kid UX, life, looks, iPad)

> One owner brief (2026-11-28) covering eight areas. This file defines "done"; `test-plan.md` maps each AC to a spec. Per-area build notes from each workstream are in `notes-<area>.md` and are folded into the brain docs at CAPTURE.

**Status:** IN PROGRESS
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

- [ ] **AC-P1:** every establishment in both regions (kampung: mosque, hawker / each food stall group, shops, tailor Butik, home, park, playground, clinic/library etc. as present; Makkah/Madinah: Kaaba / Haram gates, Safa-Marwa, Prophet's Mosque, tailor, camel yard, caravan, oasis, horse stable, food, hotel, vehicle parks) has a labelled icon on the full map and shows on the radar when in range.
- [ ] **AC-P2:** tapping/clicking the radar (or M) opens a full-screen map of the whole region with the hero's position and heading, a legend, and the current objective highlighted.
- [ ] **AC-P3:** the full map zooms in and out (pinch, mouse wheel, +/- buttons >= 48 px) and pans (drag), clamped to the world; a "centre on me" button; Escape / close button / backdrop closes it; keyboard operable.
- [ ] **AC-P4:** tapping a place on the full map shows its name and sets it as a "go here" target (a radar arrow + ground beacon), cleared on arrival or by tapping again.

### B. Animals

- [ ] **AC-P5:** camels in Makkah can be interacted with: "Say hi" (a little reaction + sound) and "Ride"; riding seats the hero on the hump with a ride pose, moves faster than running, obeys colliders and no-ride zones (the Haram plazas), and Exit sets the hero down on free ground.
- [ ] **AC-P6:** horses exist (a stable/paddock in Makkah outskirts and a pony ride in the kampung park area), look like horses (not reskinned camels), can be greeted and ridden like camels, and are on the map.
- [ ] **AC-P7:** animals never hurt anyone: they slow/stop for people, stay on the ground, and the ridden animal walks/trots with an animated gait (legs move).

### C. Hero choice

- [ ] **AC-P8:** on New game the player picks Boy or Girl (big picture cards, keyboard operable); the choice is saved (sanitised), and can be changed later at the tailor.
- [ ] **AC-P9:** the girl hero is a distinct model (face, hair or hijab, silhouette) in the same toy style; both heroes have customisation (outfits x colours; hair or hijab styles for the girl; hair/cap styles for the boy); all modest.
- [ ] **AC-P10:** ihram follows the hero's gender during the rites and the chosen look comes back after; the girl's prayer uses the women's rows / prayer spot where the world has one.

### D. Vehicles

- [ ] **AC-P11:** every car, bicycle and scooter rests its wheels on the ground (wheel bottom within 3 cm of ground height) parked and while driven; nothing hovers.
- [ ] **AC-P12:** the hero cannot walk into or through a vehicle (parked or moving); NPCs and the crowd route around parked vehicles; a driven vehicle stops at other vehicles.
- [ ] **AC-P13:** top speeds: car >= 2.5x hero run speed, scooter >= 2x, bicycle >= 1.5x, with smooth acceleration; camera keeps up.
- [ ] **AC-P14:** improved models: cars with proper body curvature, wheel arches, windows, lights, mirrors; bicycle with a real frame (diamond frame, spokes, chain, handlebars); scooter recognisable; draw-call budget kept.

### E. Kid UX: instruction cards

- [ ] **AC-P15:** every stepper card (wudu, prayer, tawaf, sa'i, Umrah/Hajj/Ziarah steps, eating) has a minimise button (>= 48 px); minimised, it becomes a small chip showing the step and counter that never covers the hero or the joystick; tap restores it. The rite keeps counting while minimised; "Walk for me" keeps working.
- [ ] **AC-P16:** during auto actions (Walk for me, auto wudu/prayer animation) the card auto-minimises to the chip so the child can watch, and restores at the next step needing a tap.

### F. Life and missions

- [ ] **AC-P17:** kampung kids and neighbours greet the hero and can be greeted (a "Say hi" on any nearby cast or crowd kid/neighbour gives a reply bubble + wave), like the Haramain greeting.
- [ ] **AC-P18:** small scripted world events happen during play in both regions (e.g. kids' football match, an ice-cream cart arrival, a cat chase, a wedding procession (kompang), rain shower, a lost-balloon, pigeons scattering); each has a short bubble/sound and optional tiny reward; at most one at a time, child-safe.
- [ ] **AC-P19:** at least 8 new missions with varied verbs (deliver, find, escort, ride-to, photograph/spot, help-a-kid, race-the-clock-without-failing, collect), spread over both regions, using the new mounts/map where it fits; no fail state.

### G. Looks

- [ ] **AC-P20:** the world is visibly brighter and more colourful in daylight (sky, ground, building paint, foliage) in both regions without blowing out highlights; night still reads as night; measured: mean scene saturation and luminance up vs the baseline screenshot in the same pose.

### H. iPad

- [ ] **AC-P21:** iPad (iPadOS reports "Macintosh" + touch) is detected as a touch tablet: touch controls, low/med tier start, pixel ratio cap.
- [ ] **AC-P22:** boot work is cut: the loading screen shows real progress; heavy work (textures, shader compiles, higher tiers, the other region) is deferred or streamed; time-to-Start-enabled and peak memory are measured before/after (iPad emulation + 4x CPU throttle) and improve.
- [ ] **AC-P23:** no long main-thread stalls (> 200 ms) after Start in the first 10 s of play on the throttled iPad profile; WebGL context loss is recovered or shown as a friendly card.

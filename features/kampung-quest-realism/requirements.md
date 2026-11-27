# Feature: Kampung Quest realism round (guided tawaf, tailor, vehicles, crowd, Makkah outskirts)

> Five owner requests landed together after the Haramain release. This file defines "done" for all five; `test-plan.md` maps each criterion to a spec.

**Status:** IMPLEMENTED (QA and product gate in `qa-report.md` and `product-validation.md`)
**Owner:** @BudGitH
**Ticket:** PLAY-013 (Kampung Quest follow-up)
**Created:** 2026-11-27
**Feature tier:** Standard

---

## What & why

- **What:** (1) tawaf and sa'i are slower and forgiving, with a dotted ground guide and a gentle hint; (2) a tailor stall in Singapore, Makkah and Madinah where the hero picks one of 8 outfits in one of 8 colours; (3) realistic car, bicycle and scooter models, every one drivable in both regions; (4) a crowd about twice as dense with more kinds of people, bounded by a per-tier draw cap; (5) real photo textures (CC0 ambientCG), a filled city, mountains, palms and desert around Makkah, and camels.
- **Why:** owner feedback: the rites were hard for children to follow, the world felt empty and flat, vehicles looked like boxes, and "show camels in the Makkah region". Links: `features/kampung-quest-crowd/`, `features/kampung-quest-improvements/`, `docs/IDEAS.md`.

## Business requirements & success metrics

- **Business outcome:** a child (or parent) can complete a tawaf and a sa'i without help, the world looks and feels lived in, and the player can personalise the hero, without losing the phone budget or the religious-accuracy and child-safety rules.
- **Success metric:** every AC below passes in CI; low-tier draw calls stay under 400 in every audited view with all five features on (measured 100-230); no console errors in any region; all existing suites stay green.
- **Must-have business rules:** no violence, no fail state, no scolding (hints are gentle); modest clothes only (long sleeves, sleeves to the elbow or knee-length shorts, ihram overrides the wardrobe; the one documented exception is the classic jacket, which has bare arms because it is the hero's own default look and is never repainted); the default hero look keeps the colour family; vehicles never hurt anyone; CC0 / permissive assets with credits; text enters the DOM only through `textContent`; the save is untrusted input.

## Target personas & success bar

- **Personas served:** **Priya & kid, "Sofa Co-op"** (a 7-year-old doing the rites with a parent), **Maya, "Commuter Casual"** (phone, one hand, wants it smooth), **Sam, "Keyboard / AT user"** (wardrobe sheet and prompts by keyboard).
- **Baseline (hard gate):** the child completes 7 tawaf rounds and 7 sa'i legs by hand or with Walk for me; picks and saves an outfit; drives a car or rides a bike in both regions.
- **Value (hard gate):** the guide makes the rite clearer than before; the tailor and vehicles are worth a detour; the world looks richer and still runs on a phone.
- **High satisfaction (scored, not gated):** wants to try every outfit, spots camels, would show a friend.

## Design routing

- UI surface? **yes** (wardrobe sheet, ground guide, hint line) · Reuse-only? **mostly** (the sheet reuses the prayer side panel / bottom sheet pattern, MD tokens) · Tier **Standard** → **Path: lite** (checked against `docs/DESIGN-SYSTEM.md` and `features/kampung-quest/design-review.md`).
- **Crosses FE/BE seam?** **no** (static game, localStorage only).

## Design review

- Lite: wardrobe is a side panel at >= 700 x 340, bottom sheet otherwise, targets >= 48 px, Save / Cancel, nothing changes until Save; the guide is unlit ground geometry, no HUD control added. Human OK: owner requested all five directly.

## User-visible behaviour

1. In Makkah the Tawaf card now shows a dotted teal ring round the Kaaba with a gold line at the Black Stone and an arrow on the dots just ahead; the card says what to do next ("Start at the gold line", "Keep the Kaaba on your left", "Other way, please"). Sa'i shows a dotted lane between Safa and Marwa with a gold line at each hill. Walk for me takes about 30 s a round.
2. A Butik at the Singapore park edge, and a tailor in Makkah and Madinah, opens a sheet: pick an outfit and a colour, see the hero change live, Save or Cancel. The look is the same in all three places and survives a reload; ihram replaces it during the rites and it comes back after.
3. Cars (hatch, sedan, taxi, SUV, MPV), bicycles and scooters look like real vehicles (wheels, glass, lights, rider); every one in both regions can be driven or ridden.
4. The towns and the Haram are visibly fuller and the people more varied, in both regions.
5. Makkah has a limestone / sandstone city that fills the lots, mountains, date palms, desert scrub and camels (a yard, a caravan, an oasis); Madinah gets the same ground and palms.

## Acceptance criteria

- [x] **AC-R1 (guide):** while the tawaf step is active a dotted ring and a start line exist; they are gone on other steps; sa'i shows a lane with a line at each hill only while active.
- [x] **AC-R2 (guide follows):** the dots ahead of the hero glow, the arrow leads anticlockwise, it survives closing the card, and costs about 4 draw calls.
- [x] **AC-R3 (gentle hints):** the hint names the start line first, then "keep the Kaaba on the left"; clockwise gets "Other way, please"; never red, never a fail state.
- [x] **AC-R4 (calm pace):** Walk for me is about 30 s a round (2.8 m/s) and the guide stays up while it walks; counting accepts a wide start line (35 degrees) and counts a round slightly early (26 degrees); both rites still count by hand.
- [x] **AC-R5 (tailor):** the Butik (Singapore), Makkah and Madinah each have a stall that opens the wardrobe; try-on is live, Cancel / Escape undoes it, Save persists through a reload, focus stays inside the sheet.
- [x] **AC-R6 (wardrobe data):** 8 outfits x 8 colours, all modest (the classic jacket's bare arms are the documented exception: it is the hero's default look); the choice is sanitised (unknown ids, hostile data fall back); the look is shared across regions via its own key, New game clears it; the default classic look in royal blue is never repainted; ihram overrides and restores the look.
- [x] **AC-R7 (phone wardrobe):** on a portrait phone the wardrobe is a bottom sheet with 48 px targets and Save in view.
- [x] **AC-R8 (vehicles):** every car, bicycle and scooter in the kampung, Makkah and Madinah is a vehicle (no static decor), of several car styles, in free ground, outside every no-drive zone; each shows Drive / Ride, can be mounted, seats the hero and can be left; a car, bike and scooter each drive away with the hero.
- [x] **AC-R9 (vehicle safety):** a vehicle brakes for people, stops at walls and no-drive zones, never ends inside a collider; horn and engine obey mute, pause and the azan.
- [x] **AC-R10 (vehicle spots vs paths):** no parked vehicle blocks a walk-graph edge (the "clear of colliders" audit passes in Makkah and Madinah).
- [x] **AC-R11 (crowd density):** caps are 120 / 195 / 280 (kampung) and 170 / 290 / 420 (Haramain) per low / med / high tier; the headcount never exceeds the cap and nobody stands in a wall or takes a cast neighbour's seat; more kinds of people (shop browsers, picnics, loners, queues, photo groups, vendors, rests).
- [x] **AC-R12 (crowd jump):** after a teleport or clock jump the new town fills at once: more than 10 tawaf walkers circle the Kaaba at 11:00, all anticlockwise, and the sa'i lane and Arafah dua spots are populated straight after a teleport.
- [x] **AC-R13 (draw cap and budget):** at most 96 / 170 / 320 people are drawn a frame; the low tier stays under 400 draw calls in the busiest views of both regions with every feature on (kampung hawker, Makkah gate plaza, Mataf, camels, vehicle streets, Nabawi).
- [x] **AC-R14 (outskirts world):** the CC0 photo textures load (and have procedural stand-ins on `file://`); facades, mountains and palms exist; city blocks avoid roads, plazas, stalls, paths and vehicle spots.
- [x] **AC-R15 (camels):** a herd with handlers is in Makkah as six instanced meshes; none on a street; the hero is pushed out of a standing camel; a walking camel moves.
- [x] **AC-R16 (no regressions):** no console or page errors in either region, also from `file://`; the kampung default still loads and plays; `npm run check`, `secrets`, `test:kq` and `smoke` are green.

## Edge cases & error states

- Walking the wrong way round the Kaaba, standing far away, or ignoring the guide: nothing counts, the hint is gentle, no penalty.
- A hostile or damaged wardrobe save, or `kampung-quest:look`: ignored, defaults used.
- Blocked localStorage: the look is not saved, a notice shows, the game plays on.
- Photo textures blocked (`file://`): procedural stand-ins draw instead.
- Teleport or clock leap with a full crowd: old people fade, new ones fill at once, never above the cap.
- Hero mounts a vehicle in front of a wardrobe stall or a camel: colliders keep everyone apart.

## Out of scope

- Real-time try-on mirror, more than 8 outfits, riding camels, a far-people LOD (`docs/IDEAS.md`), a Hajj dotted guide, voices for the new people.

## Non-functional requirements

- **Accuracy:** tawaf is anticlockwise (Kaaba on the left), 7 rounds from the Black Stone; sa'i 7 legs Safa to Marwa; modest dress; the wardrobe never changes the hero's colour family by default.
- **Risk/Security:** saves clamped by `Save` and `Wardrobe.sanitize`; text only via `textContent`; no network at runtime beyond same-origin assets; CSP unchanged.
- **Compliance:** CC0 credits for every new texture in `assets/CREDITS.md` and `assets/textures/LICENSE.txt`; the four-tier comment system on every new file; no PII.
- **Quality:** lint ceiling (functions <= 40 lines, depth <= 3) with no new baseline entries; payload < 12 MB; draw calls < 400 on low.

## Tech Lead feasibility

- **Verdict:** PROCEED_WITH_NOTES, the draw budget is the constraint: instanced kits, a per-tier draw cap and distance culling of parked vehicles keep it flat.

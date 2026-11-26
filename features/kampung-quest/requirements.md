# Feature: Kampung Quest — open-neighbourhood life game

> **Phase 1 of the workflow.** Define what "done" means _before_ writing code.

**Status:** IN DESIGN (Phase 1b — awaiting HUD mockup choice)
**Owner:** @BudGitH
**Ticket:** PLAY-013
**Created:** 2026-11-26
**Feature tier:** Standard

---

## What & why

- **What:** A 3D third-person open-world game set in a Singapore HDB-style neighbourhood. You play as a glossy toy-figure kid, walk freely, eat at the hawker centre, use services (mini-mart, barber, clinic, library), talk to neighbours and do missions. The five daily prayers follow a fixed Singapore (MUIS) timetable on a 48-minute game day. When the azan sounds, missions pause and the player goes to the mosque, takes wudu and prays through guided steps.
- **Why:** The owner asked for an open-world "GTA-type" game that is child-friendly and Muslim-centred, with fidelity that isn't compromised. It is PlayPad's first open-world game.

## Business requirements & success metrics

- **Business outcome:** PlayPad gains a flagship, longer-session game that a Muslim family is happy to hand to a child.
- **Success metric:** within one 48-minute game day, a new player completes ≥ 1 mission, eats ≥ 1 meal and completes ≥ 1 full prayer flow without help (measured by the persona panel and the probe).
- **Must-have business rules:**
  1. **Child-friendly:** no violence, weapons, crime, theft, police chases, car-jacking, gambling, romance, music with instruments during prayer, or alcohol/pork/non-halal food. Every food is halal. NPCs never fight. Vehicles never hurt the player: they stop.
  2. **Prayer is required, gently:** at each prayer time the azan plays and new mission progress pauses until that prayer is done. There is no fail state, punishment, score loss or scolding. A late prayer is still accepted and praised.
  3. **Fixed times:** Singapore (MUIS) times for 26 Nov 2026 are hard-coded (no network, no geolocation).
  4. **Character IP:** the cast are **original** toy figures. The hero keeps the reference toy's colour family (royal blue, tan arms, white gloves, red shoes with white band) but must **not** have hedgehog quills, a joined eye-patch, green eyes, a peach muzzle or a belly oval.
  5. **Religious respect:** prayer movements, wudu order and azan text are accurate (Shafi'i practice, as is usual in Singapore). The azan is a real, freely licensed recording with its licence verified and credited.

## Target personas & success bar

- **Personas served:** Priya & kid ("Sofa Co-op" — a parent handing it to a child), Maya ("Commuter Casual" — phone, portrait/landscape, short sessions), Sam ("Keyboard / AT user").
- **Baseline (hard gate):** the child can walk to a place, eat, do a mission and finish a prayer flow. Maya can do the same on a phone with touch only. Sam can do it on keyboard only, with captions for the azan.
- **Value (hard gate):** it beats a generic kids' 3D world because it is safe, rooted in local Muslim daily life, and looks premium.
- **High satisfaction (scored):** the neighbourhood feels alive (NPC routines, day/night), and rewards collect (stickers, outfits).

## Design routing

- UI surface? **yes** · Reuse-only? **no** · Tier **Standard** → **Path: full** (4 HUD/IA mockups → owner picks).
- **Crosses FE/BE seam?** no (static, no backend).

## User-visible behaviour

Happy path: the title shows → the player taps Start → the hero stands outside their HDB block at 07:00 game time → a coach line points to the first mission ("Buy roti prata for Nenek") → the player walks to the hawker centre (joystick / WASD), presses Interact at the stall, pays coins, carries the food back and is thanked (+coins, +sticker) → at Zohor time the azan plays with captions, the HUD shows the prayer card and the mission pauses → the player walks to the mosque, does wudu at the taps (guided steps), enters the prayer hall and completes 4 raka'at as a guided-steps mini-game → reward → missions resume. Evening: streetlights come on, Maghrib, then Isyak. The day loops.

## Acceptance criteria

- [ ] AC-1 **Boot:** `games/kampung-quest/index.html` loads with zero console errors over http and over `file://` (procedural texture stand-ins on file://). It is registered in `games.js` and passes `npm run smoke`.
- [ ] AC-2 **Movement:** a third-person hero moves on WASD/arrows and on a touch joystick, runs with Shift or a run toggle, and is stopped by building/prop colliders. The camera orbits (mouse drag / two-finger) and never clips inside buildings.
- [ ] AC-3 **World:** the map contains at least: 3 HDB blocks with void decks, a hawker centre (≥ 4 stalls), a mosque (dome, minaret, wudu area, prayer hall, separate entrances), a mini-mart, a barber, a clinic, a library, a playground, a bus stop, roads with zebra crossings, and trees. Ground, walls and roads use photographic PBR textures (CC0, credited).
- [ ] AC-4 **Cast:** ≥ 12 distinct original NPC toy figures plus the hero, built to the toy-figure build (block torso, peg arms, C-hands, cylinder hips, square legs, oversized sculpted head piece) with a glossy plastic material (clearcoat). The hero meets business rule 4.
- [ ] AC-5 **NPC life:** ≥ 12 NPCs follow schedule routines (walk sidewalks, sit and eat, queue, shop) and walk to the mosque at prayer times. They avoid the player and never block a doorway for more than 3 s.
- [ ] AC-6 **Clock:** 1 game day = 48 real minutes (1 game minute = 2 real seconds). Day/night lighting follows the clock (sunrise ≈ Syuruk, sunset ≈ Maghrib).
- [ ] AC-7 **Prayer times:** the 5 prayers trigger at the hard-coded MUIS 26 Nov 2026 times (source cited in `assets/CREDITS.md`). Each trigger plays the licensed azan once with on-screen captions (Arabic, transliteration, English). It plays only when the tab is visible and unmuted; otherwise captions only.
- [ ] AC-8 **Prayer flow:** when a prayer is due, mission progress pauses (a mission already in hand is kept). The flow is: go to the mosque → wudu at the taps in the correct order (intention, hands ×3, mouth ×3, nose ×3, face ×3, arms to elbows R then L ×3, wipe head, ears, feet R then L ×3) → enter the hall → pray the correct raka'at count (Subuh 2, Zohor 4, Asar 4, Maghrib 3, Isyak 4) as guided steps (qiyam, ruku, i'tidal, sujud, julus, sujud, tasyahud on the right raka'at, salam). The hero figure takes each posture. No fail state: a wrong tap gives a gentle hint.
- [ ] AC-9 **Late prayer:** if the player is away at a prayer's start, the prayer stays "due" until done or until its time window ends (the next prayer's start; for Subuh, Syuruk/sunrise, per the ruling). Then it is marked "missed — make it up (qada)", and a qada can be prayed any time with gentle copy and no penalty.
- [ ] AC-10 **Needs & services:** a hunger meter and an energy meter drain over time. Eating at a hawker stall (≥ 8 halal dishes with prices) refills hunger. Resting at home refills energy. Mini-mart, barber (changes hair piece), clinic (a friendly check-up refills energy) and library (a story card) are each interactive. Coins are earned from missions and are never negative.
- [ ] AC-11 **Missions:** ≥ 8 missions with a tracker, a world marker and a minimap arrow, each completable and each child-friendly (errands, helping neighbours, finding a lost cat, recycling, carrying groceries for an elder, delivering kuih, cleaning the playground, giving salam to the imam).
- [ ] AC-12 **Interaction:** context prompts appear within 2 m of an interactable. Dialogue uses a speech-bubble UI with polite Malay/English greetings (Assalamualaikum / Waalaikumsalam).
- [ ] AC-13 **Save:** progress (time, coins, needs, missions, prayers, stickers, outfit) persists to localStorage under `kampung-quest:v1` and survives reload. Corrupt or missing saves fall back to a new game without throwing.
- [ ] AC-14 **Performance:** ≥ 50 fps median at 1280×720 on a 4×-CPU-throttled headless run, with quality tiers (low/med/high) and auto-downgrade. Phone layout ≤ 400 draw calls on the low tier.
- [ ] AC-15 **Accessibility:** fully playable by keyboard; all HUD controls ≥ 48 px with visible focus; azan and dialogue captioned; respects prefers-reduced-motion (no camera shake or bob); mute and pause available; touch controls fit inside `--pp-app-h`.
- [ ] AC-16 **Lifecycle:** a hidden tab pauses the sim and audio. Pause dialog. No sound plays while paused or hidden.

## Edge cases & error states

- Prayer time arrives during dialogue or a service menu → finish the menu, then show the prayer card.
- Two prayers overlap because the player idled (e.g. Maghrib → Isyak) → each is tracked separately; the earlier becomes qada.
- Reload mid-prayer flow → resumes at the start of the step (wudu kept if completed).
- Assets fail to load (file://, 404) → procedural textures and synth chime + captions for the azan; game still fully playable.
- WebGL unavailable → a friendly message, no crash.
- Coins exactly 0 → the stall says "You need 2 more coins — try helping Pakcik Rahman!".
- localStorage blocked → play without saving, with a small notice.

## Out of scope

- Driving vehicles; combat of any kind; online multiplayer; dynamic or geolocated prayer times; Hijri calendar events; voice acting beyond the azan.

## Non-functional requirements

- **Accuracy:** prayer times, raka'at counts, wudu order and posture sequence match the cited sources.
- **Risk/Security:** no network calls at runtime; the save is parsed defensively (schema-checked, clamped numbers); dialogue renders with `textContent` only.
- **Compliance:** every third-party asset licence is verified, credited in `games/kampung-quest/assets/CREDITS.md` and has its licence file alongside.
- **Quality:** classic scripts under the `window.KQ` namespace (file:// rule — `docs/LEARNINGS.md`), three.js r147 vendored, functions ≤ 40 lines, depth ≤ 3. The total game payload stays below 12 MB.

## Tech Lead feasibility

- **Verdict:** PROCEED_WITH_NOTES — large effort (5 parallel workstreams, see `contract.md`). "GTA fidelity" is met through art direction, PBR, shadows, a day/night cycle and NPC density within a static WebGL budget, not AAA asset counts. That expectation was stated to the owner. Risk: the prayer-posture poses on a rigid toy figure need hip/torso pivots; this is covered in the figures workstream.

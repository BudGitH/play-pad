# Feature: Kampung Quest improvements (seven owner requests)

**Status:** SHIPPED on branch `claude/kampung-quest-improvements-wh4pls` (QA panel findings fixed)
**Owner:** @BudGitH
**Created:** 2026-11-27
**Feature tier:** Standard (project tier)

## What & why

- **What:** seven requests from the owner to make Kampung Quest calmer to see, nicer to hear, truer to the prayer times and easier to move in.
- **Why:** the owner played it and asked for these directly. Detail per area: `hud-movement.md`, `salaam.md`, `ambience.md`, `prayer.md` in this folder.
- **Personas:** skipped per the owner (no persona panel for this feature); the technical QA panel ran and its findings are fixed.
- **Design routing:** UI surface yes, reuse-only yes (existing HUD tokens) -> lite check, no mockups. Crosses FE/BE seam: no.

## Business rules that still hold

No music ever; nothing under the azan or during a prayer; no fail state or scolding; the salaam exchange only between Muslim people; every fard prayer outranks anything optional.

## Acceptance criteria

1. **HUD easier to see and manage.** One translucent surface token for cards, dock and touch controls; hint text 13 px; Jump is >= 48 px (76 px on tall screens); the dock Pray button and the clock note are urgent only for a fard prayer, never for the optional sunat prayer.
2. **Salaam when paths cross.** Two walking citizens passing within 2.5 m may exchange "Assalamualaikum!" / "Waalaikumsalam!" (others say "Hello!"); a neighbour passing the hero may greet the hero; caps and cooldowns prevent spam; no extra draw calls; the hook rejects non-finite chances and works before the game starts.
3. **Atmospheric sounds.** A synthesised soundscape (traffic, wind, leaves, birds by day, crickets by night, hawker murmur, mosque-hall muffling) follows the game clock and the hero's place; silent under the azan and during a prayer; stops when muted, paused or hidden; the Pause menu has an on/off switch; footsteps vary by kind and surface.
4. **Pray any time in the mosque.** Inside the hall the Pray prompt always exists: the due or owed fard prayer if there is one, else a voluntary 2-raka'at "Sunat prayer" with wudu first; it never touches the prayer tracker; "Not now" ends it; wandering off drops it; a fard prayer falling due always takes over (azan card, HUD "Zohor time!", Pray starts the fard prayer, the wudu carries across).
5. **Azan and prayer time follow game time.** No wall clock on the prayer path; the azan starts on the step that crosses the start minute; a time skip plays one azan; the HUD counts down in game minutes ("Asar in 12 min").
6. **Remove double buttons.** No Run button, no minimap-as-Map button, no "Esc pause" hint; one control per action.
7. **Move, run and jump without stopping.** The joystick follows only its own finger; its rim runs; Jump fires on `pointerdown` from the other thumb; Shift + W + Space combine; a running hop keeps its momentum.

## Definition of done

Every AC has a test in `test-plan.md`; `npm run check`, `npm run test:kq` and the four browser specs are green.

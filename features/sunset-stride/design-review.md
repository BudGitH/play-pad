# Design review — Sunset Stride (full path, headless)

**Status:** CHOSEN (owner delegated visual decisions; rendered screenshots from the build are the record — see `qa-report.md` for the screenshots listed per round)

## Brief (PM)

Players could not read the neon night scene; the owner asked for a bright, real-world look with real textures, a believable runner, chasers behind the runner, a real slide animation, better mechanics and a chill name. Success = a first-time player can read lanes and obstacles in one glance on a phone.

## Options considered (information-architecture level, not styling)

| #   | Direction                                                                                            | Verdict                                                                                                          |
| --- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| A   | Keep the night city, only raise brightness and add rim lights                                        | Rejected — the legibility problem is the palette (dark road, glowing everything)                                 |
| B   | **Golden-hour town**: warm low sun, light sky, grey asphalt, brick / plaster facades, photo textures | **Chosen** — highest contrast between road, hazards and runner; matches "real world textures" and a "chill" name |
| C   | Seaside boardwalk (sand, planks, sea)                                                                | Rejected — no suitable CC0 vehicles / facades, the lane read gets weaker on sand                                 |
| D   | Park trail (grass, trees, fences)                                                                    | Rejected — obstacles lose the road-works vocabulary that signals jump / slide                                    |

## Roundtable notes

- **UX:** hazard stripes (yellow/black, photographed) already mean "careful" everywhere — use them only for things you must jump over or slide under; vans / trucks are painted, never striped, so colour alone tells "go around" from "go over/under". The runner wears a saturated tee against grey asphalt.
- **Tech Lead:** facade windows are generated in the fragment shader (no baked atlas, works with photo or procedural wall textures); dogs are skinned GLBs with a primitive fallback; chasers sit behind the runner so the camera needs to sit back/high enough to keep them at the bottom of the frame on phones.
- **Personas:** Maya — "I can see the road"; Sam — keyboard parity + reduced motion (no shake / FOV kick); Dan — one-tap retry.

## Chosen — full states

Setup (hero sunset strip, bank row, how-to with real obstacle legend, sound toggle), countdown, HUD (score, coins, dog meter, power-up chips, toast), paused, stumble (flash-free; camera nudge only without reduced motion), caught → results ("Caught!"), shop (3D skin thumbnails with emoji fallback), WebGL-unavailable notice. All use the PlayPad MD3 tokens; the in-run HUD uses translucent dark chips over the bright scene.

# Kampung Quest: ambient soundscape

Owner request: "Have atmospheric sounds to make it better to play."

## What it is

`js/game/ambience.js` (new, loaded after `audio.js`) synthesises the neighbourhood with Web Audio. No files, no music.
Roughly 40 nodes, one shared 3 s pink-noise buffer, parameters touched every 80 ms of game time, a silent bed is disconnected.

| Layer                  | Follows                                                                                            | Sound                                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Traffic / town hum     | clock (quieter 22:00-06:00, rush-hour swell), distance to the roads, calmer in the mosque compound | low-passed noise + faint tyre hiss, slow swell                                                   |
| Wind + leaf rustle     | steady, a little more in the park                                                                  | band noise that gusts, quiet high rustle                                                         |
| Birdsong               | Subuh to Maghrib (fades out from 18:04), a little more near the park                               | sparse random phrases: bulbul chirps, mynah chatter, tailorbird "tuk", rare koel whistle, panned |
| Crickets               | Maghrib - 5 min to Subuh + 15 min                                                                  | three pulsed, grouped high sines, rates drift every 6-12 s                                       |
| Hawker murmur + clinks | distance to the hawker centre, open 07:00-22:00                                                    | vowel-band chatter, crockery clinks, the odd wok sizzle                                          |
| Mosque hall            | hero inside the hall                                                                               | whole bus low-passed to about 900 Hz and quieter                                                 |

Times come from `KQ.PRAYER_TIMES` (same source as the sky). `Ambience.mix(minute, x, z)` is the pure target mix and is what the test reads.

## Quiet rules (business rule 1, AC-7)

- Azan live (`Audio.azanActive()` or `PrayerFlow.state.azanLive`, which also covers the chime fallback and captions-only): ducks to zero (fast, rate 6/s). `Audio.startAzan()` calls `Ambience.silence()` first, so nothing sounds under the recording.
- A wudu / prayer screen is open or a prayer flow is running: same.
- It comes back 3 s of game time after both end, fading in slowly (rate 0.4/s).
- Muted / paused / hidden: `Loop.frame` never calls `update()`, `Audio.setGate` hard-ducks and suspends the context, one-offs go through `Audio.ambient()` (the `canSound()` gate).
- "Ambient sounds On / Off" in the Pause menu (`prefs.ambience`, `settings.js`), nothing in the HUD.

## Footsteps

`Audio.footstep(kind)`, kind = `"walk" | "run" | "land" | "jump"` (a boolean still means "running", so `player.js` is unchanged and already calls it every stride; the landing thud is its existing `play("land")`).
Each footfall differs (random noise slice and pitch, feet alternate), is duller on grass and on the mosque carpet (`Audio.setSurface`, set by the ambience from the hero's place) and a double call within 100 ms of audio time is one step. No extra loop.js line was needed for footsteps; the only loop hook is `G.Ambience.update(dt)` in `Loop.frame`.

## Fixed on the way

`Audio.setGate` resumed the context straight after suspending it when only `muted` was set, so muting never suspended it (new beds would have kept playing). It now resumes only when muted, paused and hidden are all clear, and `unlock()` does the same.

## Levels

Measured on the master bus (headless Chromium analyser): day about -37 dB RMS, hawker about -34 dB, night with crickets about -37 dB, mosque hall about -47 dB; peaks under 0.09. The UI sounds peak at about 0.055.

## Debug and tests

`Audio.debug().ambience` = `{ on, quiet ("" | "azan" | "prayer" | "off"), level (model), target, gain (real AudioParam), events, birds, clinks, beds[] , mix }`; `debug().ambient` counts one-offs apart from `played`.
`tests/kampung-quest-ambience.spec.mjs` (AMB-1..7): starts after Start; follows clock and place; stops muted / paused / hidden and resumes; silent under the azan; silent during a prayer flow and back after; footstep kinds and gating.

## Ideas (not done)

Rain / distant thunder at dusk, MRT rumble near the main road, kids' playground voices at the playground, a distant azan-free evening "kampung" layer (cicadas at dusk), per-NPC proximity chatter.

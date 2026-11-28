# Life and missions (section F: AC-P17, AC-P18, AC-P19)

Build notes from the "life" workstream. Fold into `docs/ARCHITECTURE.md`, the game-local `CLAUDE.md`, `docs/LEARNINGS.md` and `docs/DECISIONS.md` at CAPTURE (this workstream did not touch the shared brain docs).

## What was built

### 1. Say hi (AC-P17)

- **Crowd extras are greet-able, not talkable.** `js/game/say-hi.js` (`G.Hi`): the nearest greet-able extra within 2.5 m offers the **Say hi** prompt (interact kind `hi`, same E / button as Talk). Greet-able = on their feet and not praying / circling: fixed-spot rest / roam / pace people and strollers; in Makkah only the "chat" spots and strollers (never tawaf, sa'i, prayer, reading). Seated extras are not offered.
- **The exchange:** the hero's hello shows over the hero, the reply 1 s later over the person (pooled DOM bubbles from `greetings.js`, new `Greetings.say(who, text, delay, secs)` and `Greetings.setActor(id, getter)`), the person stops, turns and waves (the crowd kit's own `wave` pose bank entry, no new mesh: `crowd.js` calls `G.Hi.hold()` while `m.waveT > 0`, then restores their old pose), the hero waves.
- **Words and the Muslim rule are pure** (`js/sim/hi.js`, `KQ.Sim.Hi`): Muslim person (Malay-group extra in the kampung; every pilgrim in Makkah / Madinah) gets "Assalamualaikum!" and answers "Waalaikumsalam! ..."; everyone else "Hello!" / "Hi! Nice cap!". Replies vary by age band (kid: "Wanna play?", "Nice cap!"; teen; adult; elder).
- **Kids call out first:** a kid within 6 m, on their feet, now and then (10 % per half-second look, at most one per 18 s, never when busy) says "Assalamualaikum!" / "Hi! Nice cap!" and the hero's reply bubble shows.
- **Tally:** `Hi.createTally()`: a coin every 5 hellos (at most 6 in a sitting) and the "Friendly" sticker at the 10th. Cast neighbours' small talk counts as a hello too. **Cast neighbours (PM condition, option a):** a free neighbour in reach (`Greetings.castFree`, not escorting, not on cooldown) offers **Say hi** as the second tile beside **Talk** (`G.Hi.castTarget`, rank `Sim.Actions.hiRank(talk.rank)`, so mission business keeps Talk first); `sayHiCast` shares `exchange()` with the extras (hero bubble, reply bubble, hero wave through the Player-lock ticket, cooldown, tally, `event.who`), the neighbour stops, faces the hero and waves through `Npcs.hold` / `A.holdT` (`npc-agent.js holdStill`), and the words come from `Hi.castPerson` (kid from `adult: false`, elder for Nenek and Atuk, salaam only if the profile is Muslim). It never opens the dialogue.
- Busy gate: no prompt and no kid calls while paused, a menu or prayer screen is open, a rite is under way, or the hero rides.

### 2. World events (AC-P18)

- **Director (pure):** `js/sim/events.js` (`KQ.Sim.Events`): first event after 75 s of free play, then one every 140-260 s; weighted choice by region and time of day, the last 2 are not repeated; **one at a time**; the play clock only runs while nothing blocks (`paused, modal, azan, prayerDue, prayerScreen, ritual, eating, mounted`); a running event is ended at once with the reason when something blocks. Seeded rng, 14 unit tests (`tests/kampung-quest/events.test.mjs`).
- **Presentation:** `js/game/world-events.js` (manager: flags, free-spot search, prompt, radar blip, hint chip, teardown) + scripts in `world-events-kampung.js`, `world-events-town.js`, `world-events-holy.js`. People are full toy figures from a pool (`event-actors.js`, specs in `js/figures/life-cast.js`, built on first use, hidden between events); props are plain meshes freed (geometry and materials disposed) at the end; the idle town costs nothing. `life-chip.js` is the little hint chip under the top of the screen.

| Event    | Region               | What happens                                                                                                       | Optional reward                                |
| -------- | -------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| football | kampung, 08:00-18:00 | three kids kick a ball about 6-11 m ahead; walk into the ball and it rolls                                         | 3 kicks: "You joined the game!" +2 coins       |
| icecream | kampung, 10:00-18:00 | seller and cart roll up with a bell; **Ice cream** prompt, 2 coins, a little food                                  | none (it is food)                              |
| catchase | kampung, daytime     | Mimi chases a butterfly; **Pet** her                                                                               | first pat +1 coin                              |
| kompang  | kampung, 09:00-18:00 | wedding procession (drummers, groom, bride) walks past with kompang beats; stay near 6 s                           | +2 coins and the Wedding guest sticker         |
| rain     | kampung, any time    | one-draw-call rain streaks follow the hero, two passers-by with umbrellas run through, a rainbow shows as it stops | none                                           |
| balloon  | kampung, 08:00-18:00 | a kid's balloon floats up and away; **Catch** it and hand it back (it simply floats off if not, "It's okay!")      | +2 coins                                       |
| pigeons  | Makkah / Madinah     | a child runs at a flock and the whole flock takes off (`world.burstPigeons`)                                       | none                                           |
| dates    | Makkah / Madinah     | a volunteer at a table: **Dates**, then **Zamzam**                                                                 | both: +1 coin and the Dates and zamzam sticker |
| photo    | Makkah / Madinah     | a family asks for a photo: **Photo** (flash)                                                                       | +2 coins                                       |

Rewards are capped (12 coins per sitting for all events). Each event shows a hint chip and a purple radar / full-map blip (`map-markers.js`, new kind `event`, 3 lines) while active, and goes quiet in the background if the hero walks 70 m away.

### 3. Missions (AC-P19): 13 new, 5 verbs more than before

New step types (all matched by the existing generic `type + target (+ item)` rule, so `missions.js` needed no step logic): `greet` (target `people` / `kids`, count), `photo` (at a place, press **Photo**), `ride` (arrive at a place riding anything), `escort` (`who` follows the hero to a place). A step may have `verb` (the button word) and `quick` (no dialogue page); a mission may have `region`, `needs` (places the world must have) and `beat: {secs, coins}`.

Kampung: **push_the_car** (Uncle Lim, three quick **Push** presses), **rambutan_basket** (Makcik Siti, collect 5 rambutans in the park, deliver), **walk_wei_home** (Aunty Mei: ask Wei, he follows you to Block C, tell Aunty Mei), **prata_dash** (Abang Ali: "beat the bubble", +3 bonus coins if under 100 s, slow loses nothing), **friendly_five** (Irfan: say hi to 5 people), **kampung_photos** (Aisyah: photos at the mosque gate and the playground), **bike_to_library** (Postman Dan: ride to the library on any ride, then deliver), **visit_the_ponies** (Wei; only offered when the world has the `pony_ride` place).

Makkah / Madinah (new giver mechanism, see below): **h_new_friends** (say hi to 4 pilgrims), **h_zamzam_walk** (zamzam taps, clock tower), **h_visit_camels** (camel yard, photo; only offered when the world has `camel_yard`), **h_madinah_photos** (Prophet's Mosque gate and Quba), **h_ride_to_quba**.

- Rewards 4-7 coins plus a sticker, as before (16 new stickers incl. Friendly, Wedding guest, Dates and zamzam). Reward toast mentions the bubble bonus. No fail state anywhere.
- **Guides:** Makkah and Madinah had no neighbours, so two **guides** (Ustaz Bilal at the hotel forecourt, Ustazah Mariam at the Madinah bus stop) are built as ordinary cast agents (`NpcAgent`) in the Haramain world only (`npc-manager.js` `placeGuide`; profiles in `KQ.Sim.NPC_PROFILE` but **not** in `NPC_IDS`, so the kampung cast, the schedule and the voices never see them). They give the Haramain missions, get the gold star and the radar star, talk with the same dialogue, and never move. Missions are region-filtered in `KQ.Sim.Missions` (`offered()`, `available()`, `wantsTalk()`), the Missions dock button now exists in Makkah too (`hud.js`), and the mission card shows the active Haramain mission instead of the rites line (`hud-view.js`).
- `ride`: counts `G.Vehicles.mounted()` or **`G.Mounts.riding()`** (camels, horses, ponies) (graceful when absent). `needs` missions hide when `world.pois[id]` is missing (`sim-setup.js` passes `hasPoi`).
- Gender-neutral wording toward the hero (unit-tested).

## Hooks (`window.__kq`)

`hi()` (tally, last hello, waving count), `kidChance(p|null)`, `events()` (director + running event + flags), `forceEvent(id)` (true if started; refused while one runs, something blocks, or no room), `stopEvent()`, `lifeChip()`, `steps()` (escort / photo state), `actors()`. Events ids: football, icecream, catchase, kompang, rain, balloon, pigeons, dates, photo.

## Tests

- Unit: `tests/kampung-quest/{events,hi,missions-more}.test.mjs` (30 tests) + `missions.test.mjs` adjusted to the original 12 / region filter; `load-sim.mjs` lists `missions-more`, `hi`, `events`.
- Browser: `tests/kampung-quest-life.spec.mjs` (kampung: say hi, salaam rule, kid-first, football lifecycle and leak check, ice cream purchase, Photo / Push / escort / ride / five hellos, event never during a prayer) and `tests/kampung-quest-life-holy.spec.mjs` (guide, pilgrim hello, the three Haramain events); in-page drivers in `tests/life-drivers.mjs`.
- Screenshots (daylight): `shots/life-hi.png`, `life-football.png`, `life-kompang.png`, `life-icecream.png`, `life-rain.png`, `life-balloon.png`, `life-missions.png`, `life-makkah-dates.png`, `life-makkah-photo.png`, `life-makkah-pigeons.png`, `life-makkah-missions.png`; re-take with `node features/kampung-quest-playability/life-probe.mjs ./probe-shot.mjs` (env `SHOTS=hi,football,...`, `REGION=haramain`).

## For the orchestrator to reconcile

- `map-markers.js`: added `COLORS.event` and the `G.WorldEvents.blip()` push in `build()` (4 lines). If the map is reworked, keep an `event` blip kind (purple, star icon, label from `blip.label`).
- `hud.js`: Missions dock button now in both regions; `hud-view.js` `renderMission` falls through to the mission card in Makkah when a mission is active.
- `interact.js`: `find()` now prefers (in order) a mission "Photo" prompt, an event prompt, then Say hi when nothing real is in reach; "Push" replaces "Talk" on a quick step. New interact kinds: `hi`, `event`, `step`.
- Rideable camels / horses / pony ride (other workstream): `G.Mounts.riding()` makes `ride` steps count (wired at merge); POIs `camel_yard`, `horse_stable`, `pony_ride` to the world POIs and the missions `visit_the_ponies` / `h_visit_camels` appear by themselves.
- Shared edits kept small: `audio.js` (two sounds, `drum`, `patter`), `crowd.js` (3 lines: wave hold), `greetings.js` (`say`, `setActor`), `collectibles.js` (rambutans, `catMesh` exported), `npc-manager.js` (guides, skip routines for guides and escorted kids), `holy-pigeons.js` + `holy-world.js` (`burstPigeons`), `names.js`, `pictures.js` (camera icon, mission icons), `ui-screens.js` (board lists `offered()`), `loop.js` (3 update calls), `index.html` (13 script tags).

## Learnings

- **`Collide.settle` and `heightAt` are enough for event props**: actors reuse the NPC rig and the Animator, so no new pose or mesh code was needed; the crowd's `wave` is just `F.POSES.wave` through the existing bank.
- **Spot choice has to be forward-first.** The first version took the nearest clear candidate and put the cart behind the hero; candidates are now angle-major (straight ahead first) and only fall back behind for open plazas (`anyGround`).
- **Test hook artefact:** rewinding the clock with `setMinute` leaves `Audio.azanActive()` / `PrayerFlow.state.azanLive` true. Events read `azanLive || azanPlaying()` and tests run the prayer scenario last.
- **A quick locked pose (ice cream "eat") blocks `Interact.find()` for ~1.8 s** of game time: tests that follow must `run(3)` first.
- **Lint applies to tests**: scenarios live in `tests/life-drivers.mjs` as functions of at most 40 lines, installed as page globals.
- **Hero bubble height:** `greetings.js` HEAD.hero = 1.0 floats the bubble well above the toy hero's cap in the close camera; not changed here (shared with the salaam feature).

## Not done / risks

- No cast-neighbour "Say hi" button (they keep **Talk**, which opens with a greeting); only crowd extras got the new prompt.
- Football kids and the procession are drawn as full rigs (about 14 meshes each, up to 4-5 at once); fine on the low tier in the shots, not profiled on the throttled iPad profile.
- The balloon catch (+2 coins), the wedding join (+2 coins, sticker) and the bubble chip were checked once in a dev probe (a throw-away probe), not in a spec; the specs cover the football, ice cream, prayer gate, Photo / Push / escort / ride / say-hi missions and the Haramain guide and events.
- `tests/kampung-quest-ac.spec.mjs` "tall sheets scroll inside the stage; the barber shows two columns" fails (2.1 px vs < 2 px) on the base commit too (checked in a clean worktree), so it is not from this work.
- Event audio (bell, drum, patter) is synthesised and gated like the rest; not heard in headless.
- Escort has no pathing: the kid walks straight at a point behind the hero with collision sliding; in tight alleys they may lag (they say "Wait for me!" beyond 14 m and never block the hero).

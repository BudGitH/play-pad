# Kampung Quest: simple actions for 7-year-olds (AC-P24 / AC-P25)

> Owner: "Users are currently confused in terms of the actions that they need to take as well. So if the user goes into rest, the hovering part, the praying part, it just confuses the user ... frustration for some of the users who are 7 years old."
> Built on the audit `actions-audit.md`, re-inventoried after the map, animals, hero choice, town life, cards, iPad, vehicles and Singapore workstreams merged (`5836b86`). No shared brain doc was edited; the doc updates this round needs are listed at the end.

## What a child sees now

- **One Action control**, id `kqTalk` kept: a big picture and ONE word in the same place on a given screen. iPad and tall portrait phone: directly above Jump. Desktop: bottom right above the key hints (key `E`). Phone landscape and a short portrait phone (320 x 568): in the bottom row just left of Jump, because the radar and needs column above Jump leaves no room there (a toast and the control collided at 320 x 568, and the control overlapped the needs bars in every landscape phone). It no longer floats over heads and is never re-projected; it is plain CSS (`#kqAction`, the "Action control" blocks of `styles.css`). Fixed width and height, so the word cannot move or resize it. `HudLayout.fitTalk` (the layout search that chased the floating button) is gone.
- **The world only points.** `#kqPointer` is a non-clickable bobbing arrow (`pointer-events: none`, no text, still under reduced motion) over the highlighted target, and over a neighbour 2.3-4.5 m away. There is no "Walk closer" button any more.
- **Chooser tray.** With two or more actions in reach, up to three picture tiles: the nearest is the big button (`E` or `1`), the others are tiles 2 and 3 (tap or keys `2`, `3`), each at least 56 px with one word. Order, pure and unit-tested (`js/sim/actions.js`): mission business (a neighbour who wants to talk, a Photo step) first, then an owed prayer, then the nearest, then Say hi, then the "I am tired" Rest. The same action found twice collapses (many kids: one Say hi). KNOWN BUG FIXED: a neighbour's Talk used to silently beat the ice-cream cart, Say hi and shop counters; now all of them are offered. A camel or pony offers Ride plus Say hi as two tiles (no "Say hi or Ride" card).
- **One word table** (`js/game/action-words.js`): `key -> { icon, word, say }` for Talk, Say hi, Eat, Buy, Pray, Pray here, Rest, Sit, Ride (animal and bike), Drive, Get off, Pick up, Play, Haircut, Clothes, Check-up, Story, Recycle, Photo, Push, Catch, Pet, Ice cream, Dates, Zamzam. An unknown action falls back to the hand picture and its own label, so a new action needs no HUD change (it keeps emitting the target shape `{kind, id, label, aria, x, z, dist, enabled, h}`).
- **Rest in one tap** (`Services.restHere`): no yes/no card. The hero sits (on a bench seat if one is within 3 m, else where they stand), the screen fades with a soft "Zzz", 30 game minutes pass (`Loop.advanceMinutes`, which still stops at a prayer start) and the energy is full ("Energy is back!"). Offered at the home door or a bench when energy is not full, and anywhere when Tired (last in the tray). Never offered at full energy, during the azan, while a fard prayer is due or being prayed (a kind toast on the Tired bar: "Prayer time first. Then we can rest."). The **Tired bar is the Rest shortcut** (role button, 48 px, amber as before).
- **Pray is one path** (`PrayerFlow.next()`), behind the status card, the azan card, the mosque taps, the hall and the dock (`pressPray()`): within about 25 m of the taps or hall it starts the owed prayer (or the extra one) right there, wudu first and the prayer opens in the same place when wudu is done; far away it draws the green footprints with a spoken line and the Action control offers **Pray here** meanwhile. The words "Sunat", "Wudu" and "Show me the way" are gone from every button (the stepper kicker still says "Sunat prayer (2 raka'at)" and the HUD note still says "Sunat prayer": cards and notes are not actions). A status-card tap with nothing owed opens the day card with one button, "Pray a little extra". `KQ.Sim.Prayer`, the wudu order and the posture sequence are untouched; a fard prayer still replaces a sunat flow (`startFlow(startable() || SUNAT)`).
- **Spoken hints** (`G.Say(key, text)`, `js/game/say.js`, `Voice.hint`): the first time each kind of action is the big button its short line is spoken once ("Tap the big button to talk."), through the existing `voice.js` gates (mute, pause, hidden tab, azan, prayer screen, the "Character voices" switch, no speechSynthesis). A refused hint is retried every 0.6 game seconds and only counts as heard when it was spoken. Heard kinds are kept in `prefs.seen` (booleans, sanitised in `settings.js`), not in the save.

## Polish folded in

- Loading screen: "Getting the shaders ready..." / "Loading photo textures..." became "Making everything shiny..." / "Painting the town..."; the steps read "Waking up the neighbours", "Painting the town", "Waking up the pilgrims" (`boot.js`, `boot-ui.js`, `data/region.js`).
- The minimised card's Hide button shows the picture over the word "Hide" on phones, still a 48 px target.
- Speech bubbles slide left of the Action control instead of covering it (`greetings.js` `clearOfAction`).
- The energy nudge now says "Tap Rest and your energy will come back."

## Acceptance criteria

| AC                                                                                             | Result                                                                                                      |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| P24.1 fixed place, pointer has no text and no pointer events                                   | `tests/kampung-quest-actions.spec.mjs` (same rect +-2 px at the counter, home door, hall, taps, near Nenek) |
| P24.2 no clickable "Walk closer", arrow within 4.5 m                                           | spec "a neighbour a few steps away"                                                                         |
| P24.3 chooser, E / 1 / 2, tiles >= 56 px, neighbour + ice-cream cart, camel Ride + Say hi      | spec + `action-order.test.mjs`                                                                              |
| P24.4 one table, unknown label degrades to the hand                                            | spec "one word table"                                                                                       |
| P24.5 hint once per kind, never while muted                                                    | spec "a spoken hint once per kind" (speechSynthesis stub)                                                   |
| P25.1 Rest one tap, no card, energy >= 95, clock +30, refused when due / full                  | three spec tests                                                                                            |
| P25.2 one Pray path (compound: stepper, far: trail + Pray here), wudu then prayer in one flow  | spec + `kampung-quest-prayer.spec.mjs`                                                                      |
| P25.3 no Sunat / Wudu / Show me the way on buttons; sunat still available and never beats fard | spec + prayer spec (`checkFardWins`, fard over idle sunat)                                                  |
| P25.4 existing prayer, mobile HUD and `test:kq` green                                          | see the final report                                                                                        |

## Decisions

- Kept the element id `kqTalk` (and `.kq-talk`, `.kq-talk-label`) for the big button so focus code and specs keep working; the tray tiles are `.kq-talk-more`, the wrapper `#kqAction`.
- The default (highlighted) action is "business first, then nearest", not nearest only, so a mission neighbour never loses to the counter behind her (the old `pickTarget` rule, kept as ranks; `Missions.pickTarget` stays as a tested pure helper though the game now uses `Sim.Actions`).
- Rest tops the energy up to full (`needs.checkup()` after the 30 minutes) instead of the old +36: the audit asks for >= 95 so a child never has to rest twice. Clock cost is as before.
- The tray is a row to the LEFT of the big button (the big button is always the right-most tile, key 1 / E). On a landscape phone it is lifted above the dock; on a short portrait phone it stacks upward (the joystick is on the left). The azan card on a landscape phone is narrower by a few pixels so it never touches the control (`--kq-azan-side`), and the 667 x 375 card gives back 4 px of padding to keep its height (`kampung-quest-mobile.spec.mjs` A11Y3-01).
- "Go here" from the map keeps its existing beacon and radar blip (no Action tile): the world arrow is for the thing in reach.
- Pray at the taps now prays on the spot after wudu instead of walking to the hall (audit rule 2), so "wudu then prayer" is one flow; the hall's own spot is used when the hero stands at it.

## Existing specs changed (intended behaviour changes only)

- `kampung-quest-prayer.spec.mjs`: the Pray button reads "Pray" (not "Sunat prayer"); Pray before wudu opens wudu in place (no toast and footprints); the first sunat is one press at the taps; the "idle sunat flow" state (still real after a reload or a closed screen) is made through the sim.
- `kampung-quest-ac.spec.mjs`: the azan card button is "Pray" (was "Show me the way").
- `kampung-quest-mobile.spec.mjs`: after wudu the prayer steps open in the same place (no second walk and tap); wording of the far-neighbour check.
- `kampung-quest-mounts.spec.mjs`: Ride and Say hi are two tiles (no menu card); the pony's big button is "Ride".
- `kampung-quest-vehicles.spec.mjs`: the exit button reads "Get off".
- `kampung-quest-ambience.spec.mjs`: starts the flow with `PrayerFlow.next()` at the taps (was `atTaps`).
- `kampung-quest-cards.spec.mjs`: the chip check measures the fixed Action control (there is no `fitTalk` nudging any more); "Start wudu from the Pray card" is one tap at the mosque (it used to be Pray card, then "Wudu and pray right here").
- `kampung-quest-rituals.spec.mjs`: the three "Pray card, then Wudu and pray right here" steps are one `action("pray")` (a due prayer goes straight on).
- `kampung-quest-voice.spec.mjs`: Nenek's line is found by its text, because the one-time spoken hint ("Tap the big button to talk.") may be spoken first. A spoken hint also gives way to a speech bubble (`Voice.bubble`), so hints never delay a neighbour.

## Failures that are NOT from this round (they fail on the integration commit `5836b86` too, checked in a clean `git archive` copy)

- `kampung-quest-rituals.spec.mjs` "Umrah: the dock button opens the rites": expects no `#kqDock-missions` in Makkah, but the integrated build has one there.
- `kampung-quest-mobile.spec.mjs` "HUD layout" for `ipad-portrait` (the azan pill overlaps the top-right buttons) and `narrow-phone`, `android-portrait-360`, `small-phone-portrait-320` (the azan pill overlaps the long toast). Same boxes, same sizes before and after.

## Docs this round needs (shared brain docs were not touched)

- `games/kampung-quest/CLAUDE.md`: Mobile and touch (the Action control replaces the floating Talk button, `fitTalk` is gone), "Interact priority" (ranks in `js/sim/actions.js`), the module map (`action-bar.js`, `action-words.js`, `say.js`, `js/sim/actions.js`), test hooks (`state().targets`, `say()`).
- `docs/ARCHITECTURE.md` (HUD / play map), `docs/LEARNINGS.md` (a fixed control beats a projected one: `fitTalk` was a layout search chasing a moving target; a refused speech hint must not count as heard), `docs/DECISIONS.md` (the rank order and Rest topping up to full), `docs/IDEAS.md` (Go-here tile, highlight keys, a prayer-time "sit and rest" pose on the ground is a stand-in).

## Remaining risks

- The hero's "Rest" pose on open ground reuses the seated pose with the hips at ground level (no lying-down pose exists); on a bench it sits properly.
- On a landscape phone in Makkah and Madinah the dock has a fourth button (Umrah); on the smallest screens (568 wide) it may come within a few pixels of the Action control (the specs run the kampung).
- The tray row is wider than the single control; with the full azan card open on a phone the card and the tiles are close but separate in the specs.
- `speechSynthesis` voices vary by device; with none the hints are silent and the pictures and words carry the meaning.
- `Missions.pickTarget` was removed in QA round 1 (`Sim.Actions` replaced it; its intent is tested in `action-order.test.mjs`).

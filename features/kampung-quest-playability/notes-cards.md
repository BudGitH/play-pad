# Instruction cards: minimise + auto-minimise (section E, AC-P15 / AC-P16)

Owner: "...user cannot minimize the instructions panel. They are blocked by the card that shows up for the instructions."

## Root cause

Every stepper card (wudu, prayer, eating, Umrah / Hajj / Ziarah) is a **modal sheet** (`UI.openSheet`). While a sheet is up
`Loop.stepActors` gives the hero no input (`free = !modalOpen()`), `.kq-modal` hides the joystick, Jump, Talk and dock, and a
side panel covers ~40 % of the screen. The only way out was "Not now" (which ends wudu / prayer) or, on the rites,
"I'll walk myself" (close + a bottom chip that sat on the hero's feet on phones).

## What changed

| File                                                                 | Change                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `js/game/ritual-min.js` (new, in `index.html` before `ritual-ui.js`) | `G.RitualMin`: the Hide button (48 px, `aria-label` "Hide the steps (minimise)", word "Hide" on roomy screens, icon only on phones), the chip (picture icon + `Name n/m` + a cue of <= 6 words, built with `textContent`), the gentle pulse. Adds the `minimise` icon to `Pictures.ICONS`.                                                                                         |
| `js/game/ritual-ui.js`                                               | The ONE stepper gains `ctl.minimise(by)`, `restore()`, `needsTap()`, `relayout()`; `RitualUI.setBusy(on)`, `toggleMin()`, `refit()`, `debug()`. Minimising closes only the sheet (reason `minimise`; the owner's `onClose` is NOT called), keeps the controller, shows the chip and returns `Camera.setShift` to the centre. `show()` keeps the chip current, so counting goes on. |
| `js/game/ritual-flow.js`, `prayer-ui.js`, `eat-flow.js`              | Cards carry `chip: { name, count, cue }` (Tawaf 3/7, Sa'i 2/7, Wudu 4/12, Rakaat 2/4, Eating 3/4). "I'll walk myself" now minimises (game-owned: returns at full count). Walking cues are short forms of the sim hints (`CUES`); the sim text is untouched. Busy edge fed from `RitualFlow.update`.                                                                                |
| `js/game/prayer-flow.js`                                             | `refit()` now calls `RitualUI.refit()` (the same card switches side panel <-> bottom sheet; before it closed and rebuilt the screen, resetting wudu taps). A minimised card stays minimised. Key `1` restores a hidden card instead of tapping it.                                                                                                                                 |
| `js/game/actions.js`, `input.js`                                     | Keys `H` and `-` (`hide`) toggle the card. Dock / status Pray and the Umrah dock button bring a hidden card back (no second card is started).                                                                                                                                                                                                                                      |
| `js/game/hud-layout.js`                                              | Chips join the keep-out list for Talk, the toast lane starts under a top-band chip (`laneTop`).                                                                                                                                                                                                                                                                                    |
| `js/game/hooks.js`                                                   | `__kq.card()` = `{ active, minimised, by, busy, pulsing, chip, kicker }`; `__kq.ritual()` gains `minimised`.                                                                                                                                                                                                                                                                       |
| `styles.css`                                                         | One block at the end, "minimised steps card", ; the old `.kq-ritual-chip` rule is gone.                                                                                                                                                                                                                                                                                            |

## Behaviour

- **Hide / H / -** (card -> chip). **Tap, Enter, H / -** on the chip, or Pray / Umrah in the dock (chip -> card). The chip takes keyboard focus after Hide.
- **Where the chip lives.** Landscape (iPad, phone): centred in the top band between the status card and the radar, the toast lane is pushed under it. Portrait phone: a small two-line chip in the row between the joystick and Jump (below the hero's feet, clear of the azan card). It is hidden while any modal sheet is up (`.kq-modal`).
- **Hero held in place** (wudu, prayer, eating lock the hero): the joystick and Jump are hidden while the card is a chip (`.kq-min-locked`), the chip is the way back. The camera stays on the step's shot (view changes keep working through the card).
- **Auto-minimise (AC-P16).** `RitualUI.setBusy(true)` on the rising edge of "the game moves the hero": Walk for me and the haircut scene. A visible card tucks away ("game"); at the falling edge (walk done / stopped, haircut finished, or the count full) it comes back ("needs a tap"). A card the child hid by hand ("child") stays hidden and its chip pulses for ~2.6 s (static ring under `prefers-reduced-motion`). A card the child re-opens mid-walk stays open (edge-triggered).
- **Wudu / prayer have no self-playing sequences today** (the hero poses on each Next tap), so nothing auto-minimises there. A future "do it for me" only needs `RitualUI.setBusy(true/false)`.
- "Go there" is a fade + teleport, not a watchable action: no auto-minimise.

## Clarity pass and overlaps found / fixed

1. **Toast on the card header.** On iPad and phone landscape the welcome / count toasts (z 30) sat on the open card's title and "Hide / Not now" row. Fixed: with a side panel the toast lane ends at the panel (`.kq-modal-side .kq-toasts`).
2. **Words squeezed out on phone landscape.** The tawaf card's footer (counter, note, big button, two rows of 4 secondary buttons) left ~20 px for the title and instructions at 844x390. Fixed: on short screens the secondary buttons share one scrolling row (one row less), so the title and 1-2 lines of words show; the big "+1 round / Next" stays the obvious primary button.
3. **Old rite chip on the hero's feet.** The closed-rite chip ("Not now" on Umrah) sat bottom-centre above the dock, on the hero's legs on phones, with a long sentence. It is now the same chip as a minimised card (`RitualFlow.syncChip` uses `RitualMin`), in the same top-band / portrait slots.
4. **Hero rebuilt on rotate.** `PrayerFlow.refit()` closed and re-opened the wudu / prayer screen (a rotate reset the wudu taps). It now keeps the same card.
5. Checked at iPad 1180x820, iPhone 13 landscape 844x390, Pixel 7 portrait 412x839 (the device's real height): minimised chip vs hero box (projected from the camera), `.kq-joy`, `.kq-jumpbtn`, `.kq-dock`, status, mission and radar boxes, the Talk button (nudged by `HudLayout.fitTalk`) and the toast lane: no overlaps (`tests/kampung-quest-cards.spec.mjs`). An earlier portrait version (above the joystick row) touched the hero's shoes on a 839 px high screen and was moved to the joystick / Jump row.

## Not done / open

- Wudu / prayer "Not now" still cancels the flow (unchanged). Umrah "Not now" still closes the card and shows the (now shared) chip; Hide keeps the card alive instead, which matters for Walk for me and counting.
- Escape on an open card still closes it (does not minimise). Escape while minimised pauses the game, as in normal play.
- The Hide icon is a chevron over a tray line; on phones it has no word. A play-test with children should confirm it is understood (the tooltip / aria-label say "Hide the steps").
- No change to religious content or order (`KQ.Sim.Prayer`, `KQ.Sim.Umrah`, `ritual-text.js` untouched).

## Tests

`tests/kampung-quest-cards.spec.mjs` (15 tests): wudu and prayer minimise / counter / restore, cue length and chip label, keyboard (H, -, Enter on the focused chip), rotation (card kept, minimised state kept), tawaf by hand (the hero walks, the round counts while minimised), Walk for me auto-minimise / restore / child-minimised pulse, the haircut scene, "I'll walk myself", dock Pray restores, and the three-viewport overlap check.
Two assertions in `tests/kampung-quest-rituals.spec.mjs` and `tests/kampung-quest-tawaf-guide.spec.mjs` now read the new chip (`.kq-min-chip`, "Sa'i 0/7", "Tawaf 0/7").
Screenshots: `shots/cards-*.png` from `features/kampung-quest-playability/shoot-cards.mjs`.

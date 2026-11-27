# Kampung Quest: calmer HUD, move + run + jump together

Owner requests: "make the HUD easier to see and manage", "too much HUD with double buttons, clean it up",
"user can move and run and jump; while moving we do not need to stop and press the button".

## Audit: one control per action

| Was                                                     | Now                                                                                  | Why                                                                                                        |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Run button (touch) **and** Shift in the key hints       | No Run button. Push the joystick out to its dashed rim to run (Shift on a keyboard). | A button the left thumb cannot reach while steering is the thing that made players stop. One less control. |
| Minimap tap opened the Map **and** the dock had Map     | The minimap is a picture only. The dock's Map (and `M`) opens it.                    | Two buttons, one action; the minimap was an unlabelled, role-less button.                                  |
| Key hints listed "Esc pause" **and** the dock has Pause | Hint removed (Esc still works).                                                      | Same action shown twice.                                                                                   |

Kept on purpose: Mute (top right) and the Pause-menu sound switch (a setting, not a HUD control); the status and
mission cards (information, folded on phones as before); the Talk button (the single "do the nearest thing" action).
Not changed: the food / energy ring arcs and number chips both show the meters (the ring is the glance, the chip the
number, and `is-low` hangs from the chip); folding them into one is a possible follow-up.

## Legibility

- One translucent surface token (`--kq-hud`, 88 % of the dark card) for cards, dock, round buttons, joystick and
  Jump, with one rim token (`--kq-rim`) on the touch controls. The scene shows through a little; text stays high contrast.
- Jump is now the single right-thumb control, larger (76 px, 64 px on short phones, always above 48), sitting in the
  corner Run used to share. The old "short phone" and "portrait" Jump-beside-Run offsets are gone.
- Key hint text 12 -> 13 px; the phone "lite" HUD fold behaviour is unchanged.

## Movement

- **Touch:** every control is its own pointer. The joystick only follows the finger that landed on it (a second finger
  on the pad is ignored; `lostpointercapture` also recentres). Jump fires on `pointerdown` (a keyboard click, `detail 0`,
  still works), so a tap with the right thumb is instant while the left thumb keeps steering. Verified with two raw CDP
  touches (stick held, second finger taps Jump).
- **Run:** pushing the finger to the rim (>= 100 % of the throw) starts running, easing back below 80 % stops it
  (hysteresis, so it does not flicker). The pad shows the run zone as a dashed ring and turns gold while running.
  Shift is hold-to-run; there is no toggle state left to forget about (`Input.toggleRun` / `Actions.toggleRun` removed).
- **Jump keeps momentum:** the arc is vertical only (`Sim.Jump`), and in the air the velocity now follows the stick
  at 10 /s and, with the stick released, decays at 2.5 /s (ground: 14 / 18), so a running hop carries on instead of
  stalling. Keyboard: Shift + W + Space all combine (key state is a set; Space only fires a jump).
- Test hook: `__kq.state()` now reports `airborne`, `jumpHeight`, `running`.

## Tests

`tests/kampung-quest-hud-move.spec.mjs` (new: de-duplicated HUD, Shift+W+Space, air momentum),
`tests/kampung-quest-mobile.spec.mjs` (walk vs run by joystick reach, stick + Jump with two fingers, `#kqRun` gone,
`#kqJump` on screen at every size). Screenshots: scratchpad `hud/{before,after}-*.png`.

## Not done / ideas

- Jump buffering (a press just before landing queues a hop) was left out: it would soften "no double jump" in
  `tests/kampung-quest/jump.test.mjs`.
- A floating joystick (appears where the left thumb lands) would help big phones; the fixed pad is unchanged.

# HUD fix: the azan card / pill on top of buttons and toasts

Spec: `tests/kampung-quest-mobile.spec.mjs` "HUD layout <size> > no HUD box covers another; toast, Talk, azan stay clear; ...".
Failing on the integrated build at ipad-portrait 820x1180 (pill over coins, mute, pause, radar) and at
narrow-phone 360x740, android-portrait-360 360x640, small-phone-portrait-320 320x568 (azan over a toast).
It was not timing: a deterministic CSS specificity bug plus one geometry gap. The toast only made the
phone failures visible; without a toast the broken card still overlapped nothing the test measures.

## Cause

1. **Specificity.** The iPad work added `.kq-root.kq-touch-ui .kq-azan { width: min(560px, 100% - 2*joy-x) }`
   (0,3,0). It beat every other width rule for the card:
   - the pill's `width: auto` between `left` / `right` (0,2,0), so on a portrait iPad the pill kept its left edge
     but took a 512 px width and ran under the top-right cluster (radar, coins, mute, pause);
   - the portrait phone's `width: calc(100% - 24px)` (0,1,0 / 0,2,0), so on every touch portrait phone the azan card
     and pill were a 76 px wide, 290 px tall sliver in the middle of the screen (see
     `shots/hud-azan-before-narrow-phone-card.png`), right where the toast lane's overflow landed.
     Landscape was safe only because its block already repeats the `.kq-root.kq-touch-ui .kq-azan` selector.
2. **No slot of its own on a tall portrait phone.** Once the card is full width again it sits above the joystick, but
   the fixed Action control (added after that rule was written) now sits above Jump, in the same band, so the card
   covered Talk (84x40 overlap at 360 wide).

## Fix (`games/kampung-quest/styles.css` only)

- The touch-ui width rule is now `:where(.kq-root.kq-touch-ui) .kq-azan`: same 0,1,0 specificity as its
  `@media (pointer: coarse)` twin, so the pill and portrait rules win again (and a keyboard iPad still gets the joystick-safe width).
- Portrait phone: one variable, `--kq-azan-bot`, is the azan slot. Tall phones: right above the Action control
  (`--kq-act-bottom + --kq-act-h + 8px`). Short phones (<= 600 px high, where the Action control sits beside Jump):
  above the joystick as before. The card's `max-height` is derived from the same variable.
- The meaning-only pill (no title, transliteration, Arabic or button) now starts at <= 700 px high instead of <= 600:
  at 360x640 a full pill (103 px) between the toast lane and the Action control did not fit. Pray stays one tap away
  (the Action control, and the status card).
- iPad portrait: no change needed beyond (1): the pill is back between the status card and the radar column
  (x 278..575) and `HudLayout.laneTop()` already starts the toast lane under it (toast at y 151, pill ends 145).
- Landscape rules untouched.

## Evidence

- `shoot-hud-azan.mjs before|after` prints each overlapping pair and saves `shots/hud-azan-<tag>-<size>-{card,pill}.png`
  (azan forced with `setMinute`, toast raised with `UI.toast`, same as the spec).
- Before: ipad pill x coins/mute/pause/map; the three phones azan x toast (and, once the width was fixed, azan x Talk).
- After: no overlaps in any of the 8 captures.

## Learnings

- A new `.kq-root.kq-<state> .thing` override silently outranks every `@media` rule that targets `.thing`.
  State-class rules that mirror a media query should go in `:where()` so they only add the case the query missed.
- A layout test that only compares boxes cannot see a card that is the wrong shape; look at the screenshot when
  a box "appears from nowhere" at an odd x (here x 142, width 76 = `100% - 2 * joy-x`).
- When a control moves into the band another card already used (the Action control, above Jump), give the card a named
  slot variable instead of repeating `bottom: calc(...)` in each media block.
- Known limit: on a <= 600 px high portrait phone the chooser stack (Talk plus two tiles) grows upward beside Jump and can
  reach the pill's row when an azan and three actions coincide; the spec covers the single Talk case.

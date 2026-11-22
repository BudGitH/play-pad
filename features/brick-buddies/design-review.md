# Design review — Brick Buddies (full path, owner reference as the chosen direction)

**Status:** CHOSEN — the owner supplied a reference image and demanded fidelity ("I do not accept less"), so there is nothing to diverge on: the reference **is** the direction. The four-option `mockups.html` is intentionally not produced; the rendered fidelity-loop screenshots in `screens/` are the record.

## Brief (PM)

A cosy, moody, rainy cross-section of a brick-and-plank house, lit by warm torch / lamp / furnace pools, with ladders between floors and a basement. Success = the first screen reads as the reference, and building a room for a buddy is a clear, rewarding goal. Original pixel art only.

## Reference breakdown (what a picky art director checks)

| Element in the reference                                                                                                                                     | Our rendering                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Warm red-brown horizontal planks (outer walls, floors), red brick walls                                                                                      | procedural 16x16 planks (4 boards, seams, nails, 4 variants) and staggered red brick                                                                       |
| Darker plank **background wall** behind rooms (a separate layer)                                                                                             | bg wall layer drawn under foreground, darker palette, soft edge shadows from solid blocks for depth                                                        |
| Light sandstone tiles; dark cobble room; brick room                                                                                                          | sandstone slab tiles, cobble (Voronoi) stone, brick bg walls per room                                                                                      |
| Dirt with grass top, steps, brick stairs on the right, grass plot with sprouts                                                                               | grass-topped dirt, auto-step ledges, brick steps, tuft decor                                                                                               |
| Ladders connecting 3 floors + a long shaft to the basement                                                                                                   | wooden ladder tiles; hatches in floors; full-height shafts                                                                                                 |
| Leafy planter row on a soil strip, paintings, shelf, chest, cupboards, furnaces with fire, portal, "CLOSED"-style sign, hanging shop sign, torches, lanterns | all drawn in code (planter, painting 2x1, bookshelf, chest, cupboard + locker, furnace + animated glow, blue portal, 3x5 pixel-font signs, torch, lantern) |
| Grey overcast sky, long diagonal rain streaks, blocky grey hill silhouettes                                                                                  | sky gradient by weather / time, world-space rain streaks (dies on contact with roofs / walls), 2 parallax block silhouettes                                |
| Dim mood; warm orange pools; underground dark brown                                                                                                          | per-tile RGB light map (BFS falloff), multiplied over the scene (bilinear -> smooth), plus additive glow sprites and a vignette                            |
| Small blocky characters ~2 tiles tall, one NPC in the kitchen, one on a ledge                                                                                | 16x32 procedural sprites with 1px outline, 4 villager palettes                                                                                             |

## Roundtable notes

- **UX:** the reference is dim by design; interiors must still be readable, so ambient never drops to black (underground has a floor of ~12% light) and the player carries a faint light. HUD chrome is dark translucent chips (MD3 dark roles pinned) so it never fights the scene. Building feedback must be visible in the dark: ghost preview and room outlines are drawn after lighting.
- **Tech Lead:** tile art is generated once into per-tile canvases; static tiles are cached in 16x16-tile chunk canvases (bg + fg together) and blitted scaled with smoothing off; the light map is 1 px per visible tile, scaled with smoothing on and composited with `multiply`; glow sprites use `lighter`.
- **Personas:** Maya — one-handed D-pad + jump, tap-to-place with a Build / Break toggle, a scrolling hotbar; Dan — mouse place / right-click break, wheel for the hotbar; Sam — keyboard aim cursor (`I J K L`), `F` place, `X` break, `E` build menu, labelled controls, reduced-motion rain.

## Chosen — full states

Title (new / saved world), playing HUD (coins, housed, stars, request card collapsible, hotbar, mode toggle, touch controls), Build menu (3 tabs, locked / unlocked / unaffordable item states), pause menu (sound, music, rain, day / night, labels, touch controls, zoom, new world), New-world confirm, toast / live-region announcements, request celebration. All chrome uses the PlayPad MD3 tokens with the dark roles pinned.

## Fidelity-loop log

Method: screenshot the running game at 1280x800 and 390x844 (Playwright), read it next to the owner's `house-ref.jpg` (also as a side-by-side strip at the same height), list the differences honestly, fix, repeat. Final captures are in `screens/` (`fidelity-desktop-wide.jpg` is the zoomed-out comparison framing, `closeup-kitchen-2x.jpg` the texture close-up).

| #   | Differences found against the reference                                                                                                                                                                                   | Fix                                                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | First render: rooms evenly lit and flat; back-walls as bright as the walls; torch pools merged into one orange wash; rain short and busy.                                                                                 | Back-wall palettes darkened (plank bg 92 -> 66 base), light falloff per tile 0.8 -> 0.76 (solid 0.5 -> 0.46), glow bloom smaller and weaker, rain streaks thicker and brighter.                               |
| 2   | Planks read as red **brick** (a joint in every row); lit areas too saturated orange; the first frame cropped the roof so the tower did not read.                                                                          | Planks are long boards (a joint only on alternate rows, knots, nails, stronger seams); warm light colours desaturated (torch 1.0 / 0.68 / 0.38); the camera sits a little above the player so the roof shows. |
| 3   | "OPEN" board text overflowed and the bottom row of every letter fell off the panel; the title card hid the whole house; an "N" glyph read as "H".                                                                         | Board panel resized for 2x text; N glyph fixed; on wide screens the card docks left and the title camera frames the house on the right.                                                                       |
| 4   | Against the side-by-side: outer wall faces darker and redder than the reference's bright orange-brown; sky and hill silhouettes heavier and darker; rain far denser and shorter than the reference's sparse long streaks. | Solid blocks pass more sky light (0.6 -> 0.74), overcast sky and light colour lifted, hill contrast cut to a haze, rain 190 -> 120 drops with streaks 1.6 -> 3.4 tiles and brighter.                          |

### Verdict (candid)

Reads as the reference: warm red-brown plank tower with dark back-walls, brick porch and brick steps, sandstone / cobble / brick basement rooms, leafy planter row, furnaces with fire, blue portal, hanging shop sign, ladders through three floors and a long shaft, rain, grey sky with blocky hills, warm light pools with dark between, ~2-tile blocky characters.

Known gaps against the reference (what a picky art director would still flag):

- **Texture density.** The reference has more per-block noise and a few hand-placed set-piece details (a wall of tools, a round emblem, cracked cobble variation); ours are procedural 16x16 with 2-4 variants per block.
- **Edge light.** The reference shows orange light bleeding along the underside of floors and the rims of walls; ours has smooth tile-resolution light plus additive bloom but no per-edge rim light.
- **Furnishing density.** The starter rooms are furnished but a little sparser than the reference's kitchen row.
- **Scale.** The reference is framed tighter (16 px tiles in a 640 px image). At the spec'd 32-40 css px a 1280x800 screen shows 40x25 tiles, so the whole tower needs one zoom step out (`-` / the Zoom button).
- **Clouds.** The reference's sky has soft cloud banding; ours is a gradient with hazy blocky hills and a few flat cloud bars.

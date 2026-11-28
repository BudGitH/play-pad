# Singapore estate realism (HDB blocks, void decks, hawker centre): notes

Owner ask: the HDB blocks, void decks and food court should reference real Singapore estates and be "really reflective". Reference sheet with sources and the trait-by-trait mapping: [`sg-reference.md`](sg-reference.md).

## What changed

- **HDB repaint scheme** (`js/world/hdb.js`, palettes in `layout.js`): white floor lines and parapets (`TRIM`), pastel walls kept from the looks pass, an accent band in the block colour every fourth floor on both faces, and a contrasting stair / lift core strip proud of both faces with breeze-block stair openings and the big painted "BLK 118 / 120 / 122" near the roof (`atlas.coreNumber`). Window grilles on lower floors, a water tank on legs with a ladder. The back-face bays behind the core strip are skipped.
- **Void deck** (`hdb.js` pillars + new `js/world/hdb-deck.js`): cream column shafts with a pale painted dado and a band-coloured stripe, a white ceiling with downstand beams, a light grey tiled square and an inlaid checkers board under each stone table set, steel back rails on two stools, drain gratings along both long edges, wall fans and a friendly "Play gently, please!" pictogram on the lift core, downpipes, an inverted-U bicycle rack at the open end of blocks A and B, an **RC centre** at block B's west end and a **kindergarten** (Tadika Ceria) at block C's east end (collider kind `centre`).
- **Hawker centre** (`hawker.js` + new `js/world/hawker-dress.js`): beige glazed floor tiles, a light ceiling on white trusses (green fascia kept), each stall's lit signboard redrawn with the stall number (#01-01..05), name, four drawn food pictures and the generic HALAL label (`atlas.stallSign`), a lit food-picture light box, the roller-shutter box and rails, a menu board with drawn dishes and prices (bigger at the drinks stall), an "A" hygiene grade card; swing-out stool frames (steel stem and arm to the table leg) with green seats, every third table orange; three hand-wash basins on a tiled splash wall with a sign, a hanging tray-return pictogram, six green pendant lamps (light pools at night), column fans, two green litter bins.
- **Estate** (new `js/world/estate.js`): a fitness corner on rubber flooring by block C, a railed open monsoon drain along the west edge (broken at the road), and a bicycle rack beside the parked bicycles in front of block A (no collider, so the vehicles are untouched).
- **Signage** (new `js/world/sg-signs.js`): all drawn into the existing sign atlas (works on `file://`): food pictures (prata, nasi lemak, soto, drinks, satay, kuih), stall signs, menu boards, light boxes, pictograms, grade card, chess top, floor tiles, drain grating, core numbers, centre boards. No photos, no brand names, no certification logos.

New scripts are listed in `index.html` (after `canvas.js`, `hdb.js`, `hawker.js`, `town.js`) and in the `world.js` header. They are optional: without them the world builds the earlier look.

## Contracts kept

- POI ids, interactables, the walk graph and the stall counter spots are unchanged (stall footprint and `STALL_D` unchanged).
- Table positions are unchanged, so `seats.js` (four stools at 0.95 m, top 0.60 m) and the crowd zones still fit; the hawker stools are now thin seats at the same top height (`Trees.tables` `stool()`).
- New colliders: `bike-rack`, `centre`, `basins`, `bin`, `fitness`, `drain`. All sit away from the walk graph; the crowd's chat / play spots are collider-checked at run time.

## Draw calls (low tier, `__kq.stats().calls`, follow camera)

| Spot                           | Before  | After   |
| ------------------------------ | ------- | ------- |
| Hawker centre (26, -17)        | 242     | 242-244 |
| Void deck, block A (-44, 20.5) | 394-395 | 395-398 |

The crowd is random, so the count moves by 1-3 between runs. Everything new goes into the shared batch with materials already drawn in those cells (no new materials, textures or lights); `probe-batches.mjs` shows the same set of batch meshes before and after. Two early choices did add calls and were changed: concrete drain walls (a new concrete cell) became `paving`, and a `wallTile` square under the void-deck tables (made the far wall-tile mesh visible from the deck) became a decal from the atlas.

## Screenshots (10:00, q=med, HUD shown, same poses)

`shots/sg-before-*.png` / `shots/sg-*.png`: `hdb-street`, `void-deck`, `hawker-inside`, `hawker-outside`, `estate-wide`. Re-take: `node tools/serve.mjs 5612 &` then `PW_PORT=5612 node features/kampung-quest-playability/shoot-sg.mjs after` (or `before` against a server of the old tree).

## Not done / limits

- Lifts that stop at some floors, refuse chutes, the corridor-side chute hoppers: not drawn (nothing to visit up there).
- The game keeps the light cream terrazzo void-deck floor of the looks pass rather than the grey concrete of the photos (brightness rule); only the table squares are grey tiles.
- Wikimedia Commons rate-limited downloads after ten photos; a few stall-front and point-block photos could not be fetched. The Roots hawker article body did not load (only its search excerpt was read).
- Night view not re-shot (signs and light boxes use the existing emissive `sign` material, pendants push light pools like the other lamps).

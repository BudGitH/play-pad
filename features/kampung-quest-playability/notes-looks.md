# Looks (section G, AC-P20): notes

Owner ask: the world is "a little bit too dull, even the textures". Goal: a bright, warm, friendly toy world for 6-10 year olds in both regions, without blowing out the white marble, and night still reads as night.

## How it is measured

`looks/measure.mjs` boots each region (`?still=1&autoq=0&q=med`, 960 x 540, HUD hidden), sets 10:00 (`__kq.setMinute(600)`, `__kq.step(500)`), pins the camera on fixed views (spawn = follow camera; the others are an `eye` / `look` pair with the hero at `look`) and one 21:00 view, and measures the 3D canvas: mean luminance (Rec.709 on display values, 0-255), mean HSV saturation, and the clipped-white share (all channels >= 250). Results: `looks/before.json`, `looks/after.json`; screenshots `shots/looks-{before,after}-<region>-<view>.png`.

## Before / after (q=med)

| View           | Lum before | Lum after | Sat before | Sat after | Sat change | Clipped (after) |
| -------------- | ---------- | --------- | ---------- | --------- | ---------- | --------------- |
| kampung spawn  | 108.9      | 126.3     | 0.300      | 0.381     | +27 %      | 0               |
| kampung street | 129.5      | 132.8     | 0.204      | 0.295     | +45 %      | 0               |
| kampung wide   | 135.8      | 142.1     | 0.311      | 0.465     | +50 %      | 0               |
| kampung 21:00  | 48.1       | 49.5      | 0.391      | 0.475     |            | 0.05 %          |
| Makkah spawn   | 183.1      | 188.6     | 0.084      | 0.119     | +42 %      | 0               |
| Makkah plaza   | 159.9      | 168.1     | 0.122      | 0.153     | +25 %      | 0               |
| Makkah wide    | 193.5      | 197.5     | 0.135      | 0.181     | +34 %      | 0               |
| Makkah 21:00   | 10.8       | 11.2      | 0.747      | 0.743     |            | 0               |

Saturation is up 25-50 % in every daylight view; luminance is up 2-16 % (modest, as intended); no daylight view has clipped white; 21:00 stays about 3x (kampung) / 15x (Makkah) darker than 10:00. The spec's own q=low numbers: kampung street lum 136.4 -> 139.4, sat 0.186 -> 0.265; Makkah plaza lum 160.1 -> 168.3, sat 0.122 -> 0.153.

## What changed

- **Colour grade** (`js/world/lighting.js`): a 1.22x saturation lift right before ACES, patched once into `THREE.ShaderChunk.tonemapping_fragment` (one shader line, no pass, no uniform, no per-frame cost). ACES desaturates; this undoes it. Unlit markers (`toneMapped` off) and the sky shader are untouched.
- **Daylight keys** (`js/world/sky.js`, 07:20-17:00 rows only; dawn, dusk and night unchanged): a clearer blue zenith and horizon, a warmer sun (+4 % at noon), a warmer sunlit-ground hemisphere bounce and a stronger hemisphere fill (0.62 -> 0.74 at noon).
- **Fog** (`lighting.js`): the grey pull on the fog colour is 0.12 at noon (was 0.3 always) and returns to 0.3 as the sun goes down, so the haze is sky-blue by day and dusk still does not tint the town pink. Distant skyline haze 0.7 -> 0.56 by day (`detail.js`), same at night.
- **Exposure**: kampung 0.95 -> 1.0 (`boot.js`, one line); Haramain 0.72 -> 0.78 (`holy-world.js`), safe because the marble and white plaster are now warm cream instead of neutral white.
- **Texture tints** (`js/world/materials.js` `TINT`): `material.color` multipliers on the photo / stand-in materials: lusher grass, hedges and leaf cards, warmer paving, roof, wood and soil, slightly cooler and darker asphalt (better contrast with markings), warm-cream marble, brighter tiles / terrazzo. `whitePlaster` (mosque walls, the Haram) is warm ivory. They multiply the map in the shader, so the photo path and the file:// procedural stand-ins get the same treatment.
- **Less grime** (`GRIME` in `materials.js`): plaster, paint, paving, concrete, tiles and grass lose about a quarter of their dirt / streak / blotch strength: a cared-for toy town.
- **HDB palette** (`layout.js`): Blk 118 mint walls + teal bands, Blk 120 peach + tangerine, Blk 122 sky blue + bright blue (pillars follow: wall-coloured shafts, band-coloured skirts). The far skyline uses cream / mint / peach / lemon / sky blue / blush (`detail.js` `PASTEL`).
- **Void deck floor** (`hdb.js`): light cream terrazzo instead of the brown speckled tiles that read muddy in the deck's shade; the terrazzo file:// stand-in has softer grout to match (`textures.js`).
- **Makkah**: golden sand, honey sandstone, warm limestone, rock and dirt tints (`holy-kit.js`), fresher green palm fronds (`holy-palms.js`).

Draw calls, textures and payload are unchanged (no new textures, no new materials, no new passes).

## Tests

- `tests/kampung-quest-looks.spec.mjs` (q=low, one pinned daylight view per region): luminance and saturation floors set between the old and new numbers (the old look fails the saturation floor in both regions, checked against an untouched copy of the game), clipped white < 1 %, 21:00 luminance < half of 10:00.
- `tests/kampung-quest-haramain-world.spec.mjs` and `tests/kampung-quest-haramain-outskirts.spec.mjs` pass.

## Learnings

- `THREE.ShaderChunk` can be patched once at script load (before any material compiles) for a zero-cost global grade; keep it idempotent (marker comment) and inside the `TONE_MAPPING` block so `toneMapped: false` materials skip it.
- Colour on a shaded floor is mostly the hemisphere light: under the void-deck slab a "warm" tint on a dark speckled photo still read brown-grey; a lighter base texture fixed it where a stronger tint did not.
- `Camera.shot` keeps the arm collision, so a far, high view behind buildings gets pulled in; pin `S.camera` and render once for screenshots instead.
- File-scale screenshots for metrics must hide the HUD (`#kq > *:not(#kqStage)`), or the cards dominate the saturation number.

## Risks

- The grade is global (characters, signs, carpets also get ~22 % more saturation before tone mapping); strong reds (the hero's shoes, red carpets) are a little punchier. Night saturation rises a little too (blue moonlight), but night luminance is unchanged.
- Numbers come from SwiftShader; a real GPU should match closely (same shaders), but the floors in the spec have only ~0.03 saturation of margin over the measured values.
- The crowd is random, so the numbers move a little between runs (about +-1 lum, +-0.005 sat seen).

# Neon Rush: art direction and technical-art spec (PLAY-006)

**Owner ask:** "Models and environment should be very polished, all animations working in high quality", with no errors or display quirks on mobile or desktop.
**Scope:** `games/neon-rush/index.html` only, plus procedural textures. No new libraries, no new binary assets.
**Constraints kept:** vendored r147 UMD + classic GLTFLoader, CSP, every GLB/audio fallback, 60 fps target. See `games/neon-rush/CLAUDE.md`.
**Evidence:** screenshots in `/tmp/claude-0/-home-user-play-pad/d673e733-2e20-53e5-baf1-01b45976e8f0/scratchpad/design-neon/` (they are scratch files and are not committed). Prefixes: `desk-*` is 1280×720, `phoneP-*` is 390×844, `phoneL-*` is 844×390. Captures used Playwright + SwiftShader with `__neon.step()` and frozen rAF/timers. No console errors were seen at any viewport. SwiftShader fps (8–19) is **not** a perf signal.
**Baseline measured:** about **210 draw calls / 27k triangles** per frame at 1280×720, with three obstacles on screen.

---

## 1. Findings (flaws, glitches, root causes)

| # | Sev | Finding | Evidence | Root cause (code) |
|---|-----|---------|----------|-------------------|
| F1 | P0 | **Buildings float over a pink void** at the screen edges | `desk-10-urban-run`, `desk-22-slide` (pink wedges right and left of the street) | Ground is `PlaneGeometry(46,280)`, so it only reaches x = ±23. In `cityMode`, `resetBuilding` pushes the skyline boxes to x = ±20…29, and they are 3–7 wide, so they hang past the ground edge over the skydome horizon band. The KayKit roadside buildings themselves are grounded correctly (`-box.min.y`; mesh min y = 0.10), but they sit directly on the road texture with no curb, sidewalk or contact shadow. That also reads as "floating". |
| F2 | P0 | **Brown/maroon fog and far buildings** (the palette clashes with the neon look) | every run shot: far facades are rust-brown | `updateSky()` overwrites `FOG_BASE` on its first frame with `setHSL(hue,0.6,0.22)`. At distance 0 the hue is 0, which is dark red. |
| F3 | P0 | **Flat purple sky with no sun or horizon glow** | all run shots | (a) `makeSkyTexture` puts the glow band at v = 0.60 and the sun at v = 0.575. On a `SphereGeometry` the equator is v = 0.5, so both are **below the horizon** and hidden by the ground. Only the "void" in F1 shows them. (b) `skyGroup.rotation.y` keeps growing, so the sun drifts out of the forward view. (c) `skyMat.color` is an HSL(·, .45, .82) multiply, which washes the sky out. (d) The CanvasTextures (sky, road, windows) are not tagged `sRGBEncoding` while `outputEncoding = sRGB`, so they come out lifted and greyed. |
| F4 | P0 | **Sound toggle is a tiny collapsed pill** on setup (all viewports) | `phoneP-00-setup` | `#soundToggle` uses `class="switch"`, but Neon Rush **never defines `.switch`**. Claw Catch, Colour Rush and Super Decoder each have a local copy; base.css has none. |
| F5 | P0 | **Urban slide reads as standing** for most of the 0.72 s slide | `desk-3urban-slide-0.37` | `Dodge_Forward` lasts **0.40 s** with `LoopOnce` + clamp. It finishes at 0.40 s and holds its last (upright) frame for the remaining 0.32 s. The collision height is 0.72 m, but the visual says 1.8 m. |
| F6 | P0 | **Star Rider runs on top of a static hoverboard**. The legs pump while the board glides. It also "runs" in mid-air (no jump clip). | `desk-10-skater-run`, `desk-3skater-jump` | `MODEL_CFG.skater.clips.run = Run` and `jump: null`, which falls back to run. |
| F7 | P0 | **Star Rider slide cuts off mid-roll**. `Roll` lasts 1.33 s, the slide lasts 0.72 s, so the clip is cut at 54 % and crossfades back from a half-tumble. | `desk-3skater-slide-0.37` | Clip length does not match `SLIDE_TIME`. |
| F8 | P0 | **Neon Bot slide plays *Idle* squashed flat** (a "pancake crab") | `desk-3neonbot-slide-0.37`; probe `anim:"idle"` while `sliding:true` | `update()`: `running = onGround && !sliding` is false, so the state resolves to `idle`. The squash `scale.y 0.5` + `rotation.x -0.5` is applied on top. |
| F9 | P0 | **Neon Bot jump clip loops mid-air** (it re-launches at 0.71 s while airtime is 1.16 s) | logic: `Jump` is 0.71 s, `LoopRepeat` by default | Jump actions are never set to `LoopOnce`/clamp. |
| F10 | P0 | **Crash has no readable beat.** The rig pinwheels around its feet (`rotation.x -= 7/s`) while still playing **Run**, and it is thrown out of frame within 0.4 s. | `desk-3urban-crash-0.42` (runner gone) | `tick()` crashed branch. Death clips exist but are unused: Rogue `Death_A` 0.80 s, Bot `Death` 0.96 s, Astronaut `Death` 1.04 s. |
| F11 | P0 | **Police cruiser blocks the runner** when tension is high, and at rest its dark roof is clipped at the bottom of the frame | `desk-25-tension`, bottom edge of `desk-10-neonbot-run` | `droneTick`: targetZ 6.4→2.4 at y≈2.3 puts it in the camera-to-runner line. Rest z 6.4 is inside the frustum. (Also listed in IDEAS as a watch item.) |
| F12 | P0 | **Portrait phone cuts off the outer lanes**. Pickups and barriers in lanes 0/2 are half off-screen, and the runner fills about 25 % of the height. | `phoneP-11-obstacles` | Fixed vertical FOV 58° at aspect 0.46 gives about 29° horizontal FOV. The visible half-width at the player plane is about 2.0 m, but the lane centre is 2.4 m. |
| F13 | P1 | **Star Rider is an over-lit cyan silhouette** with no form | `desk-10-skater-run` | `glowMats: /SciFi_Light/i` matches **`SciFi_Light`** (the main light suit panels), not only `SciFi_Light_Accent`. |
| F14 | P1 | **Neon Bot looks pale beige/clay** | `desk-10-neonbot-run` | `emissiveBoost` adds cyan emissive 0.3 to **every** material (Grey/Main/Black). |
| F15 | P1 | **Urban Runner is a "green blob" from behind** | all urban shots | The Rogue cloak/hood (green atlas cells) fill the back view. There is no rim light, so the silhouette blends into the dark road. |
| F16 | P1 | **Daytime pastel KayKit facades** (red/green/orange, white trim) under a night sky look like clay. They have no lit windows, signage or neon. | all run shots | `prepCityModel` uses emissiveMap = colour map at 0.38: a uniform self-glow with no night grade. |
| F17 | P1 | **Big gaps in the roadside row** (about 34 m per side between buildings) | wide shots | `CITY_COUNT 16` alternates sides with `CITY_SPACING 17`, so each side gets one building per 34 m. |
| F18 | P1 | **Obstacles are plain toy boxes.** Trains are flat pink/purple cuboids and the coins read as yellow "pills" edge-on. | `desk-11-obstacles` | `buildObstacleMesh` uses primitive boxes and up to **20 separate window meshes per train**. Coins are untextured cylinders with no halo. |
| F19 | P1 | **No glow/bloom feel.** Emissives are flat colour fills and the lane lines are 2 px. The "light bars" are pink/cyan pegs that look like stakes. | all | There are no halo sprites and no environment reflections. Road roughness is 0.9. |
| F20 | P1 | Jumps have no take-off or landing (`Jump_Idle` starts already mid-air), and there is no landing squash | `desk-3urban-jump`, `-land` | Only the idle air pose is used. `Jump_Start` (0.60 s) and `Jump_Land` (0.67 s) are unused. |
| F21 | P2 | The run cycle is frantic at top speed (`timeScale` up to 2.4×) | code | `clamp(spd/11,0.9,2.4)` |
| F22 | P2 | Results/setup chrome is fine and on-token, but it carries no neon mood (light pink card in light mode) | `desk-*-18-results` | Out of scope for tokens. Only a small accent is proposed (D-P2). |

## 2. Art direction

**"Rain-slick synthwave night."** A deep-violet night over a wet asphalt boulevard. Neon reads as *light* (halos, pooled reflections, rim-lit silhouettes), not as flat pink paint. The palette has **three emitters on near-black**: magenta `#ff2d95`, cyan `#22e5ff`, gold `#ffd54a` (coins/rewards only). Purple `#7b3ff2` is reserved for haze and secondary trim. Everything non-emissive sits in cool, desaturated night tones (`#0b0818` asphalt, `#141029` sidewalks, facades darkened to roughly 45 % with a blue cast) so the neon pops. The depth stack runs road → lit facades with signs → violet-fogged towers → a silhouette skyline ring → a banded retro sun sitting **on** the horizon. Readability rules: hazards carry magenta/gold warning trims, rewards are gold, and the player is always the brightest rim-lit shape in the lower third. The reference is a description only: an 80s synthwave album cover crossed with a stylised mobile endless runner, clean low-poly with a lot of light.

## 3. Decisions (prioritised; numbers are starting values, tune by eye on a real GPU)

### P0: bugs and glitches (ship-blocking)
1. **Ground and floating (F1).** Replace the single ground plane with three pieces:
   - **Road:** 9.6 wide (x ±4.8), 280 long.
   - **Curb + sidewalk:** each side, a curb box 0.3 w × 0.18 h at x = ±4.95 with a 0.04-tall emissive top strip (magenta on the left, cyan on the right, emissive 1.0), plus a sidewalk plane at y = 0.12 from x 5.1→9.2.
   - **Outer ground:** `PlaneGeometry(160, 300)` at y = −0.02, colour `#07051a`, with a faint purple 4 m grid in a CanvasTexture (line alpha 0.12). Every skyline box therefore sits on geometry.
   - KayKit facades: front face at |x| = 9.2 (back edge to the sidewalk). Compute x from the rotated box: `x = side*(9.2 + halfDepth)`, not the current random 9.6–12.2.
   - Contact: an additive-free **dark AO strip** (a black→transparent gradient plane, 1.2 m wide, opacity 0.55) along each facade base.
2. **Fog and sky (F2, F3).**
   - `scene.fog = Fog(#2a1150, 30, 115)` on high, far 95 on low. Hue drift is clamped to ±0.06 around h = 0.73 (violet↔blue↔magenta): `fog.color.setHSL(0.73 + 0.06*sin(distance*0.0012), 0.62, 0.18)`. It never reaches red.
   - Sky texture: move the gradient so the **equator (v = 0.5) is the horizon**. Stops: 0 `#05021a`, 0.30 `#160a45`, 0.42 `#4a1a86`, 0.48 `#ff3d9a` (glow band), 0.50 `#ff7bad`, 0.52 `#2a0f45`, 1 `#05021a`. Sun centre at **v = 0.43**, radius 110 px on a 2048×1024 canvas, keeping the 7 scanline gaps.
   - Sky sway: `skyGroup.rotation.y = 0.06*sin(elapsed*0.05)` (the sun always stays forward). `skyMat.color` stays white with no multiply; the hue drift lives in fog only.
   - Set `.encoding = THREE.sRGBEncoding` on **every colour-map CanvasTexture** (sky, road, windows, signs, stripes).
3. **Sound toggle (F4).** Add the `.switch` block from `games/claw-catch/index.html` (52×32, `flex:none`, plus the `[aria-pressed]` and `::after` rules and the reduced-motion override) into Neon Rush's `<style>`, and wrap it so the hit area is ≥48 px (`padding:8px; box-sizing:content-box`, or the shell). Coordinate with `design-hub.md`: if the hub promotes `.switch` to `base.css`, delete the local copy.
4. **Animation state machine (F5–F10, F20).** Give `MODEL_CFG.clips` explicit per-state timing and loop mode:

   | Skin | idle | run | jumpStart → air → land | slide | crash |
   |---|---|---|---|---|---|
   | urban (Rogue) | `Idle` | `Running_A` | `Jump_Start` ×1.5 (once) → `Jump_Idle` (loop) → `Jump_Land` ×1.6 (once, then blend to run 0.15 s) | `Dodge_Forward` **timeScale 0.40/0.62 = 0.65**, once, clamp, plus wrap pitch −0.30 and y −0.15 (eased) | `Death_A` ×1.1, once, clamp |
   | neonbot (Robot) | `Idle` | `Running` | `Jump` **×0.62, once, clamp** (fits the 1.16 s airtime) | **`Running` kept** + procedural "power-slide": wrap pitch −0.55, `scale (1.12,0.62,1.12)` (volume-preserving), 0.08 s ease | `Death` ×1.0, once, clamp |
   | skater (Astronaut) | `Idle_Neutral` | **`Idle_Neutral` as "ride"** (no running on the board) + root pitch −0.10 + board bob 0.03 m @ 6 Hz | `Idle_Neutral` + **board 360**: spin the whole wrap 2π about Y over the first 0.55 s of air (easeOutCubic) | **No Roll.** Rider-only crouch: `root.scale (1.08,0.66,1.08)`, pitch −0.35; the board stays level | `Death` ×1.0, once, clamp |
   - All LoopOnce actions use `clampWhenFinished = true`. Crossfades are 0.12 s (0.08 s into crash).
   - Landing triggers `Jump_Land` where the clip exists, plus a **landing squash** on all skins: wrap scale (1.10, 0.86, 1.10) recovering over 0.14 s (critically damped).
   - **Crash:** remove the pinwheel. Play the death clip, apply a knock-back of +1.4 z over 0.25 s (easeOut), let gravity bring y to 0, and keep the rig in frame (camera clamp). Primitive skins keep a short 0.35 s tumble capped at −1.2 rad.
   - Run speed: `timeScale = clamp(0.85 + (spd-11)*0.045, 0.9, 1.7)` (F21).
5. **Police cruiser (F11).**
   - Rest position: z = **9.5** (behind the camera, off-screen), y = 3.2.
   - Approach: `targetZ = 9.5 - tension*5.3` (closest 4.2), y = `3.2 + tension*0.6` (3.8 at max), so it reads **above** the runner's head line.
   - Scale it to 2.2 m long (was 2.6). The siren lights are unchanged.
6. **Responsive camera (F12).** Blend by aspect `a`: `t = clamp((1.3 - a)/0.8, 0, 1)`.
   - `fov = 58 + 14t`, cam y = `4.4 + 1.6t`, cam z = `8 + 2.8t`, `lookAt(camX*1.2, 1.6 - 0.2t, -8 - 2t)`.
   - At 390×844 this shows ±3.6 m at the player plane, so all three lanes fit with margin. Recompute it in `resize()`.

### P1: environment
- **Building row (F16, F17).** Use per-side sequential packing: `z -= width + 0.6…2.4`. Pool **14 per side** (28 clones sharing geometry). When one recycles past z > 26, move it behind that side's tail.
- **Night grade:** `material.color.multiplyScalar(0.55)` then `.lerp(#6c74c8, 0.25)`.
- **Lit windows:** build an **emissive mask from the shared atlas**. Draw the atlas into a canvas, keep only the glass cell (image px x 0–255, y 768–1023, the bottom-left "glass" swatch), and paint it with three variants: warm `#ffb35a`, cyan `#5fe8ff`, magenta `#ff5fb0`. Everything else is black. Use three cloned materials (`emissiveIntensity 1.1`, `flipY=false`, sRGB). Each clone picks one variant. If the canvas read fails, fall back to the current emissive.
- **Neon trims and signs** for each building:
  - one emissive roofline strip (box 0.08 h, building width) in its accent colour;
  - one vertical sign on 40 % of buildings: a CanvasTexture atlas of 8 words/glyphs (`NOODLE`, `24/7`, `ARCADE`, `HOTEL`, `★`, `ラーメン`-free ASCII only, `BAR`, `PIXEL`, `DINER`) drawn in an outline-glow style; a 0.9×3.2 plane mounted 0.2 m off the facade at y 4–7;
  - a matching additive halo quad 1.6× larger at opacity 0.35;
  - signs flicker on 10 % of them (one sine-gated dropout every 4–7 s; static under reduced motion).
- **Street lamps.** Every 16 m per side at x = ±5.3, staggered 8 m between sides:
  - pole: cylinder 0.06 r × 4.2, colour `#1b1d2e`;
  - arm and head: emissive `#e9f6ff`, 1.4;
  - additive halo sprite 1.4 m;
  - additive **ground pool** decal (a radial gradient on the road, 3.2 m, magenta/cyan alternating, opacity 0.45);
  - **no PointLights**. Remove the 30 peg `lightBars`; lamps and curb strips carry the speed cue.
- **Skyline layers.**
  - L2: InstancedMesh towers at |x| 18–34, h 14–42, window texture with neon roof strip, plus a red blinking antenna on 30 % (InstancedMesh of tiny boxes, emissive pulse 1 Hz).
  - L3: an open `CylinderGeometry(140,140,34,48,1,true)` silhouette ring with a CanvasTexture skyline (`#120a2e` blocks, 3 % lit pixels, `alphaTest 0.5`, `fog:false`, `side:BackSide`). It follows the camera like the dome.
- **Road surface.**
  - Asphalt CanvasTexture 256×1024: `#0b0818` + speckle noise, worn tyre bands (alpha 0.06), dashed lane markers 0.12×2.2 m in `#cfefff` at 0.7. The lane lines stay as emissive strips (cyan inner, magenta outer) and get an **additive glow underlay** (0.45 m wide, opacity 0.18).
  - **Wet look:** `roughness 0.38, metalness 0.55`, `scene.environment` = PMREM of the sky texture (`PMREMGenerator.fromEquirectangular`, `mapping = EquirectangularReflectionMapping`, generated once, about 1 ms). `envMapIntensity`: road 0.9, curbs 0.6, obstacles 0.5, characters 0.35.
  - Fake reflections: one stretched additive streak decal (0.5×6 m, opacity 0.30) under each lamp and sign, scrolling with its owner.
- **Lighting rig** (replaces the current two lights):
  - Hemisphere `#6b5cff`/`#1a0b2e` 0.65.
  - Key (moon) `#b8c4ff` 0.85 from (6,14,8) casting shadows. Its shadow camera follows `player.x` (it is ±10 today and fixed).
  - **Rim A** magenta `#ff2d95` 1.2 from (−6,5,−12) and **Rim B** cyan `#22e5ff` 0.9 from (6,5,−12), with no shadows. These light the far side of shapes, so silhouettes get neon edges as seen from the chase camera.
  - Keep `NoToneMapping`. ACES desaturates the brand neons and shifts the UI-matched hex, which is rejected.
- **Obstacles (F18).** Shared materials. Windows become **one CanvasTexture per train type** (a window band baked in, emissive), which removes the 8–20 window meshes per train.
  - **Holo-gate barrier:** dark metal posts `#1a1d33` with cyan emissive caps and halo sprites. The crossbar is a hazard-stripe CanvasTexture (magenta/black 45° stripes, emissive 1.2) with a gold edge line. A magenta **ground warning chevron** decal 2 m before it (opacity 0.5) telegraphs it from far away.
  - **Tram (low, 1.55 m):** a rounded body built as capsule ends + box (`#3a0f3a` lower skirt, `#c0307a` upper) with the baked window band (cyan 1.3). Twin headlights get gold halo sprites (1.0 m) and a transparent additive light cone (opacity 0.12). A magenta underglow strip (emissive 1.5, plus an additive ground plane 2.4×5, opacity 0.35). A gold roof chevron says "jump me".
  - **Maglev (tall, 4.2 m):** body `#1b1240` with a panel-line texture and a cyan livery stripe at 3.4 m. The front carries an LED destination board CanvasTexture ("NEON EXP", cyan on black, emissive 1.4), quad headlights with 1.4 m halos, and an underglow. Its front face must read as a wall: brightest at night.
- **Coins and pickups.**
  - Coin: `LatheGeometry` rim profile (a beveled disc, 24 segments) in gold, `metalness .85 roughness .25`, plus an inner face emissive `#ffd54a` 0.8 and a star emboss texture. A shared additive halo sprite (0.9 m, opacity 0.5) faces the camera.
  - Coin motion: spin 5 rad/s, bob ±0.08 m at 3 Hz with phase per coin.
  - Coin collect: a 0.12 s scale pop to 1.5 + a 16-particle gold burst from a pooled `makeParticles`.
  - Pickups: keep the crystal + cage, add a halo (1.2 m) and a ground ring decal in the pickup colour.

### P1: characters
- **Rim/fresnel shader** for all GLB and primitive character materials, via `onBeforeCompile`. After `#include <emissivemap_fragment>`, inject `totalEmissiveRadiance += uRimColor * uRimStr * pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 2.5);`. Materials are cloned per skin so the city is unaffected. Per-skin values:

  | Skin | `uRimColor` | `uRimStr` |
  |---|---|---|
  | Urban | cyan | 0.9 |
  | Neon Bot | magenta | 0.8 |
  | Star Rider | magenta | 0.7 |

- **Urban Runner (F15):** hue-remap its atlas in a canvas. Pixels with hue 75–170° (the greens) move to hue **318°** (magenta-violet), saturation ×0.9, lightness ×0.8, producing a new texture (`flipY=false`, sRGB). The cloak becomes deep magenta with a cyan rim.
- **Neon Bot (F14):** drop the blanket emissive.
  - `Main` → colour `#d9e2f2`, metalness 0.6, roughness 0.3 (chrome-white).
  - `Grey` → `#2a2f48`.
  - `Black` → emissive cyan 0.9 for the face/joints. **Verify by screenshot.** If `Black` covers too much, put the emissive on nothing and rely on the rim.
- **Star Rider (F13):** `glowMats: /SciFi_Light_Accent/` → emissive cyan 1.4. `SciFi_Light` keeps its base colour. The board deck gets a magenta edge strip and a purple underglow halo (replacing the opaque plane).
- **Lean and feel:** keep the roll lean of ±0.4 and add a **yaw** into the turn of `-leanTarget*0.5` (max 0.2 rad). Add a camera micro-bump on landing (−0.04 y, 0.1 s). A blob shadow decal (radial dark, 1.1 m, opacity 0.5, scales with height) is **always on**, so low tier still grounds the player.

### P2: camera feel and UI
- FOV kick: `fov += 8*((speed-11)/19)` (lerp 2/s). Power-up pickup adds a +4 punch decaying over 0.3 s.
- Crash shake: amplitude 0.18, decaying over 0.3 s, plus a white flash overlay (CSS, 80 ms, opacity 0.5). Both are skipped under `prefers-reduced-motion`.
- Speed lines: 36 additive `LineSegments` streaks in the outer 30 % of the view when speed > 20, with alpha ∝ (speed−20)/10. High tier only.
- HUD: add a 1 px cyan inner border and a 12 px magenta outer glow to the score pill. Power-up chips get a conic-gradient ring showing the remaining time.
- Results: a neon hero strip above the stats (dark gradient `#160a45→#3a0f45` with the score in gold, built from tokens). The rest stays MD3.

## 4. Performance plan
- **Tiers** (session-scoped; no save-schema change):

  | Tier | When | DPR | Shadows | Extras |
  |---|---|---|---|---|
  | **High** | default on fine-pointer devices with `hardwareConcurrency > 4` | ≤ 2 | PCFSoft 1024 | everything |
  | **Medium** | default on `(pointer: coarse)` or ≤ 4 cores | ≤ 1.5 | PCF 512, only player + obstacles cast | 60 % particle counts, no speed lines |
  | **Low** | auto-downgrade only | 1 | **off** (blob shadow only) | no reflection streak decals, no sign flicker, no L3 ring halos, fog far 95, no PMREM (road roughness 0.6) |

- **Auto-downgrade:** while running, keep an EMA of frame dt. If it stays > **22 ms for 2.5 s**, drop one tier, with a 5 s cooldown. Never upgrade mid-run. Apply changes by setting the pixel ratio and `shadowMap.enabled` and toggling `material.needsUpdate` once.
- **Draw-call budget:** High ≤ **170**, Low ≤ **110** (today about 210).
  - Merge train windows into textures (−30 to −60 calls).
  - Remove the 30 peg bars and the 26 box-edge `LineSegments`.
  - Use InstancedMesh for skyline towers, lamp poles, lamp heads, halos (one instanced quad mesh per colour), ground pools and antennas.
  - Coins: one InstancedMesh (64) + one instanced halo.
  - Buildings stay 28 clones (1 call each, shared geometry).
  - Triangle budget ≤ 60k.
- Shadow casters: player and obstacles only (buildings, lamps and coins do not cast). Receivers: road and sidewalk.
- **No per-frame allocation.** Reuse Colors/Vectors. Pool particle bursts. Halo sprites use one shared texture.

## 5. Implementation notes for the coder

| Function / area | Change |
|---|---|
| renderer setup block (≈ L1595) | lighting rig, fog, ground split, PMREM, tier init |
| `makeSkyTexture` / `updateSky` | F3 |
| `makeRoadTexture` | asphalt texture |
| new `makeGlowTexture` | reuse `makeSpriteTexture` |
| new `makeSignAtlas`, `makeHazardTexture`, `makeTrainTextures`, `makeCityEmissive(atlasImage)` | new procedural textures |
| `resetBuilding` (skyline only, InstancedMesh matrices) | skyline layer |
| `enableCityBuildings` (packing, night grade, trims, signs) | building row |
| `ObstacleSpawner.tick` scenery recycle (per-side tail z) | building recycle |
| `buildObstacleMesh` | obstacle redesign |
| `getCoin`/`spawnCoin` | coins |
| `MODEL_CFG` + `buildGltfSkin` (clip table, loop modes, materials, rim) | character P0 + P1 |
| `ctrl.update/set` (states: idle, run, jumpStart, air, land, slide, crash) | state machine |
| `PlayerController.tick` (squash, slide pose, yaw lean, land event) | movement feel |
| `onCrash` + `tick()` crashed branch | crash |
| `droneTick` / `preloadPatrol` | cruiser |
| `render`/`resize` (camera blend, FOV kick, shake) | camera |
| `<style>` | `.switch` |

- **Pitfalls (LEARNINGS):**
  - Every new action must be **re-armed** in `set()` (`enabled=true; paused=false`) before fade-in (PLAY-005 v3.1).
  - `applySkin` must also reset the new jumpStart/land/death actions **and the wrap/root transforms** (pitch, squash, the board-360 yaw, the death pose). Otherwise retry #2 inherits a clamped death pose (PLAY-005 v3).
  - The land state is a one-shot: drive it from a `landT` timer, not from the state name. Never verify animation by `skin.anim`; read action weights.
  - Particles: additive + fade colour to black, `fog:false` only on things meant to show beyond the fog (the halos must keep fog on so they don't glow through it).
  - GLB textures are `flipY=false`, so remapped canvases must match. Set `encoding = sRGBEncoding` on new colour maps.
- **Fallbacks preserved:**
  - With no city GLBs (`file://`), the neon boxes take the roadside **at the KayKit slot** (|x| 9.2 + half-depth, on the sidewalk), not at 8.5–13.5.
  - Primitive skins get the rim shader and squash, and keep `animateSkin`.
  - With no cruiser GLB, the primitive drone uses the same new z/y path.
  - Everything new is procedural, so `file://` gets the full environment.
- **New `window.__neon` probes:**
  - `render` → `{drawCalls, triangles}` from `renderer.info.render` (set `info.autoReset` correctly);
  - `quality` → `{tier, dpr, shadows, avgMs}`, and `setQuality(t)`;
  - `skin.weights` → `{stateName: effectiveWeight}` for running actions, and `skin.headY` (head bone world y; Rogue `Head`, Robot `Head`, Astronaut `Head`, found by name regex);
  - `scene.groundGap()` → the max over all buildings/skyline of `|box.min.y - groundY|` and the count of boxes outside the ground extents;
  - `camera` → `{fov, y, z, laneVisible:[bool,bool,bool]}` (project lane centres ±1.2 at z = −12 into NDC).

## 6. Acceptance checks (automatable with Playwright + `__neon.step`)
1. No `pageerror` or console `error` at 1280×720, 390×844, 844×390 or 360×740 through setup → run → jump → slide → lane → power-ups → crash → results → retry, for each of the 3 skins.
2. `scene.groundGap().maxGap < 0.05` and `outside === 0`. A screenshot shows no sky colour beneath any building.
3. Fog colour HSL hue ∈ [0.62, 0.85] at distance 0, 2000 and 5000 m. The sun is visible in a run screenshot (the pixel mean in the top-centre third has R > B after 1 s).
4. `#soundToggle` bounding box ≥ 52×32, with a hit target ≥ 48×48 (`getBoundingClientRect` + padding) at 390×844. Toggling flips `aria-pressed`.
5. Slide for each skin: `skin.headY ≤ 1.05` for ≥ 80 % of `SLIDE_TIME` samples (every 50 ms). Neon Bot is never in `idle` while `state.sliding`.
6. Jump: Robot `Jump` weight > 0.5 for the whole airtime with no restart (action time is monotonic). Rogue passes through jumpStart → air → land. Star Rider has **no `run` action weight > 0** at any time while equipped.
7. **No T-pose:** at every sample in checks 5–6, plus at 0.05 s after `crash()` and on the first frame of retry #2 and #3 per skin, the sum of the effective weights of running actions is ≥ 0.99 and the bone world-spread is < 1.2 (Rogue T-pose ≈ 1.45).
8. Crash: the death clip's weight is ≥ 0.9 by 0.15 s, and the runner's screen-space bbox is still ≥ 70 % inside the viewport at 0.8 s.
9. Cruiser: at `droneTension = 1`, the projected cruiser bbox overlaps the projected runner bbox by ≤ 10 %. At tension 0 it is outside the frustum.
10. `camera.laneVisible` is all true at every listed viewport (portrait included).
11. Draw calls: High ≤ 170, Low ≤ 110 with 3 obstacles, 12 coins and 1 pickup on screen. `setQuality('low')` sets `shadows:false, dpr:1`.
12. Reduced motion: no sky sway, sign flicker, shake, flash or speed lines. Gameplay is identical.
13. `npm run check`, `npm run secrets` and `npm run smoke` pass. `assets/CREDITS.md` is unchanged (no new assets).

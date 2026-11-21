# Sunset Stride — vendored asset credits

All assets are bundled locally so the game runs fully offline (no CDN, CSP-safe). Every asset below is free for commercial use (CC0 unless stated); licence texts sit next to the files.

## 3D models (`assets/models/`)

| File                               | Used as                         | Author     | Source                                                                   | Licence |
| ---------------------------------- | ------------------------------- | ---------- | ------------------------------------------------------------------------ | ------- |
| `runner.glb`                       | The runner (run / jump / death) | Quaternius | "Animated Human" — opengameart.org/content/animated-human-low-poly       | CC0     |
| `skins/*.png` (6 × 32×32 palettes) | Outfit skins for the runner     | Quaternius | same pack, `Blend/Textures/Clothed*.png`                                 | CC0     |
| `dog.glb`                          | The chasing dog pack            | Quaternius | "Animal Pack Vol.2" — opengameart.org/content/animated-animales-low-poly | CC0     |

**How the models were prepared (so it can be redone):** the packs ship as FBX. They were converted once to GLB with three.js r147 (`FBXLoader` → `GLTFExporter`, run in a headless browser), clips trimmed to what the game uses (runner: `Run`, `Jump`, `Death`, `Walk`; dog: `Walking`) and renamed to plain names. The slide and stumble poses are not in the pack: they are authored in code (see the _pose layer_ in `index.html`).

## Textures (`assets/textures/`)

Photographic PBR materials from **ambientCG** (ambientcg.com), CC0. Resized to 512 px JPEG; two normal maps kept.

| File                           | ambientCG asset | Used for                                  |
| ------------------------------ | --------------- | ----------------------------------------- |
| `asphalt.jpg`, `asphalt_n.jpg` | Asphalt031      | Road                                      |
| `paving.jpg`, `paving_n.jpg`   | PavingStones128 | Sidewalks                                 |
| `brick_a.jpg`                  | Bricks051       | Facades                                   |
| `brick_b.jpg`                  | Bricks042       | Facades (dark brick)                      |
| `plaster.jpg`                  | Plaster002      | Facades (tinted per building)             |
| `grass.jpg`                    | Grass004        | Ground beyond the buildings               |
| `concrete.jpg`                 | Concrete034     | Curbs, gantry posts                       |
| `planks.jpg`                   | Planks037A      | Crates                                    |
| `hazard.jpg`                   | PaintedMetal016 | Hurdles and overhead bars (colour-graded) |

## Audio (`assets/audio/`)

| File        | Used for        | Author                                                 | Source                                                             | Licence |
| ----------- | --------------- | ------------------------------------------------------ | ------------------------------------------------------------------ | ------- |
| `music.ogg` | Background loop | omfgdude ("Chill lofi inspired"), loop edit by qubodup | opengameart.org/content/chill-lofi-inspired-loop-edit (re-encoded) | CC0     |

**Every sound effect** — footsteps, landing, swooshes, the coin chime, skid, wind, dog steps / pants / barks, stings, fanfare, UI ticks — is synthesised at runtime with Web Audio (oscillators + filtered noise): no audio files, no licences.

## Libraries

| File               | Author           | Source                        | Licence |
| ------------------ | ---------------- | ----------------------------- | ------- |
| `../three.min.js`  | three.js authors | three.js r0.147.0 (UMD build) | MIT     |
| `../GLTFLoader.js` | three.js authors | three.js r0.147.0 examples    | MIT     |

_CC0 needs no credit, but Quaternius, ambientCG, omfgdude / qubodup appreciate one — shown in small print on the game's setup screen._

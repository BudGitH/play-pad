# Notes: cleaner, fresher figures (clipping, floating, z-fighting)

> Build notes from the figures workstream, to be folded into the brain docs at CAPTURE (this branch does not edit the shared docs). The audit, its numbers and screenshots: `figures/audit.md`.

## What changed

- **Head fit, measured.** `F.headProfile(d)` (parts.js) and `F.crowdHeadProfile()` (crowd-geo.js) export the real head lathes. `figures/audit.mjs` measures every head piece against them (poke-through, bare, floating rims, z-fighting) and every pose against the floor and the body; `tests/kampung-quest-figures.spec.mjs` keeps it so.
- **Face print** (`parts.js` `faceWrap`): a 48-segment wrap that follows the head's own profile 1.2 mm above it, instead of a 16-segment cylinder whose top edge stood proud of the head (the "flat square patch"). Same UVs, so every face print is unchanged.
- **Hoods** (`headpieces.js`): tudung and the three hijabs are one fitted hood (8-11 mm off the head, 56 segments, seam normals smoothed) with a rounded face opening whose lip tucks into the head, plus a separate **shoulder drape** (`F.headDrapeGeometry`) that `build.js` hangs on the torso at the neck (`rig.drape`, only while a hood is worn; removed otherwise). Turning or nodding the head moves only the hood. Hooded rigs have 15 meshes instead of 14. Sporty band and flower cluster now sit on the hood surface.
- **Hats and hair** (`headpieces.js`, new `headpieces-hair.js`, loaded right after it in `index.html` and `features/kampung-quest/dev/figures.html`): the cap is one snug shell + a band ring (rim 2.5 mm off the head, was 15 mm), songkok and kopiah sized to the head, short hair at the nape (`F.napeHair`) instead of a floating blob. Girl hair: the ponytail is tied high and its tail swings past one side (reads from the front); the braids hang forward over the shoulders.
- **Crowd and pilgrim hats** (`crowd-geo.js`, `crowd-pilgrim-props.js`): lathes with the head's 14 facets and rims tucked inside the head (`F.CrowdHood.partial / tuck`): short hair (the skull no longer shows through), cap, songkok, kopiah, a fitted tudung that covers the ears with a brow piece and a chin cloth, a hood-like ghutra with a dark agal, an eight-sided doppi. Still one InstancedMesh per part type.
- **Prayer postures** (`poses.js`, `prayer-poses.js`, `animator.js`, `build.js`, `crowd-kit.js`): the sujud bend is solved from the head piece's real outline (`F.headContour`, `rig.dims.headContour`), so a hood or songkok rests on the floor; a peaked cap is worn peak-back for every prayer posture (`P.<pose>.capBack`, swapped geometry `{ reversed: true }`, the nape hair stays put); knees and toes rest on the floor (`kneelHip`), and a long skirt's deeper hem is allowed for (`F.fitLegs` -> `dims.kneelHalf`); hands rest on the floor. Julus now sits on its heels with the shins sloping to the floor instead of the feet 9 cm under it. The crowd bank keys prayer poses by hat and skirt (`fitOf`), so the same fixes reach every extra. The walk / run lift the root when a short kid leg's toe would dip (`toeDip`); a kid on a bicycle sits up on the saddle (`pedal`).
- **Prayer pictures** (`pictures.js`): a second posture set, the girl in a white hijab, chosen by `G.Hero.isGirl()`; `G.Pictures.girlPostureImages()` for tests.
- **Speech bubbles** (`greetings.js`, `event-actors.js`): head heights measured on the built figures (hero 0.99 m, cast 1.07 m, crowd 1.0 x size, kids 0.82-0.9 m; the old 1.7 m floated bubbles a metre over neighbours), the tail 0.16 m over the head, at most 3 bubbles shown (the hero's first, then the nearest), stacked so none overlaps on screen.

## Tests

- `tests/kampung-quest-figures.spec.mjs` (new): every hero head style, every rig and crowd hat (poke / bare <= 4 samples, no floating rim), nothing through the floor in ruku / sujud / julus, bubbles never overlap and at most 3 show.
- Ran: `npm run test:kq`; the hero, wardrobe, greetings, life, crowd and prayer specs (results in the hand-off); `npx eslint games/kampung-quest tests features/kampung-quest-playability`; prettier on every changed file.
- Pre-existing failure (not from this branch): `kampung-quest-life.spec.mjs` "an escorted kid follows the hero home, and 'ride to' counts on any ride" fails with `G.Mounts.update is not a function` on the base commit dfc9f31 as well (its driver `tests/life-drivers.mjs` stubs `G.Mounts = { mounted: () => true }` with no `update`, and the loop calls `G.Mounts.update`). The two tests after it in that serial file pass when run on their own.
- Port note: on the shared box another tree's server was already listening on 5613 (it served `scratchpad/orig`), so this branch's checks ran with `PW_PORT=5643` / `BASE_URL=http://localhost:5643` against a server started in this worktree.

## Follow-ups

- A raised arm (wave) still passes through the rigid shoulder drape of hood wearers; lift the drape side in the wave pose or soften the wave for them.
- `crowd-pilgrim-dress.js` gives some men in ihram a cap or turban; men in ihram keep their heads uncovered (sim data, not changed here: religious logic is out of this workstream's scope).
- Face atlas resolution unchanged (512 px); a crisper print needs a bigger atlas per figure.
- Rider poses on camels / horses were not audited (another agent's workstream).

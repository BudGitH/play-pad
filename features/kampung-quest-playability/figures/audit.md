# Figures audit: clipping, floating and z-fighting (before / after)

> Owner: "For the character models, some of it I see does clip over the head and stuff ... make it a little bit more cleaner and fresher." Follow-up: "This refers also to the other characters that the user doesn't control as well." Scope: every humanoid figure, the player and every non-player character, in every pose bank.

## How it was measured

`audit.mjs` (run: `node tools/serve.mjs 5613 &` then `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium node features/kampung-quest-playability/figures/audit.mjs --tag after`; `BASE_URL` picks another server) loads three.js and the game's `js/data`, `js/sim` and `js/figures` scripts on a bare page, then for **66 subjects**:

| category          | subjects                                                                                                                                                                                                                                                              |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| hero (18)         | boy: his blue cap, every `Player.HEAD_STYLES` head (songkok, yellow cap, crew, curly, side part), the tailor's kopiah, ihram (short hair), the trim and the shave; girl: all 7 styles (plain / sporty / flower hijab, ponytail, braids, bun, bob) and her ihram hijab |
| cast (16)         | every `CAST` neighbour (`js/figures/cast.js`), the escort kid Wei (`kid_wei`) included                                                                                                                                                                                |
| guides (2)        | Ustaz Bilal (`guide_makkah`), Ustazah Mariam (`guide_madinah`)                                                                                                                                                                                                        |
| event actors (16) | every pooled world-event figure in `life-cast.js` (`ev_*`: football kids, ice-cream seller, kompang drummers, groom and bride, volunteer, photo family, umbrella passers-by, balloon kid)                                                                             |
| crowd (9)         | one instanced person per crowd hat part type: short hair, bun, tudung, cap, songkok, kopiah, bare head, kid tudung, kid hair                                                                                                                                          |
| pilgrims (6)      | ghutra, gele wrap, turban, doppi, ihram man with hair, ihram man in a tour cap                                                                                                                                                                                        |

The crowd draws one InstancedMesh per part type, so one person per hat type covers every instance; each was checked in every crowd pose bank used here (stand, walk, sit, pedal, qiyam, ruku, sujud, julus). Rigs were checked in idle, walk, sit, wave, ruku, sujud, julus and drive.

**Geometry checks** (head units: the head is radius 0.105, 0.19 tall, scaled 1.38 on the body), in `audit-fit.js` / `audit-render.js`:

- **poke** (accessory inside the head): head points inside the piece's coverage zone where a ray outward misses the piece but a ray from 12 mm inside hits it, i.e. the piece is sunk under the head surface and the head shows through it;
- **bare**: head points in the coverage zone that nothing covers;
- **floating rim**: open edges of the piece more than 3 mm off the head and not covered by another shell of the piece;
- **z-fighting**: piece samples within 0.8 mm of the head and parallel to it; the printed face wrap is checked for dipping into the head (z-fight) and for edges standing proud;
- **floor**: samples of every mesh more than 3 mm below the floor in a pose;
- **body**: head-piece (and drape) samples inside the torso or the upper arms in a pose.

Flag thresholds: more than 4 samples (poke, bare, z-fight, body), any floating rim point, anything through the floor. The full lists are `audit-results-before.md` (225 lines) and `audit-results-after.md`; the raw numbers `audit-before.json` / `audit-after.json`; the counts below come from `node features/kampung-quest-playability/figures/audit-summary.mjs`.

**Screenshots:** a contact sheet per subject in `sheets-before/` and `sheets-after/` (`<category>-<id>.jpg`: row 1 close-up turnaround front, 3/4, side, back, top on a neutral backdrop; row 2 walk, sit, ruku, sujud, julus, drive or pedal). Twelve before / after pairs (eight of them non-player characters) are in `../shots/figures-{before,after}-NN-*.png`.

## Findings by category (counts of flagged subject x issue)

| category     | issue                                           | before | after  |
| ------------ | ----------------------------------------------- | ------ | ------ |
| hero         | hands below the floor (sujud)                   | 18     | 0      |
| hero         | head piece below the floor (sujud)              | 6      | 0      |
| hero         | head piece inside the shoulders / torso (drive) | 4      | 0      |
| hero         | head piece inside the shoulders / torso (sujud) | 3      | 4      |
| hero         | head piece inside the shoulders / torso (wave)  | 4      | 4      |
| hero         | legs / feet below the floor (julus)             | 18     | 0      |
| hero         | legs / feet below the floor (sujud)             | 18     | 0      |
| hero         | legs / feet below the floor (walk)              | 3      | 0      |
| hero         | rim floating > 3 mm off the head                | 5      | 0      |
| hero         | z-fighting with the head (> 4 samples)          | 5      | 3      |
| **hero**     | **total**                                       | **84** | **11** |
| cast         | hands below the floor (sujud)                   | 16     | 0      |
| cast         | head piece below the floor (sujud)              | 8      | 0      |
| cast         | head piece inside the shoulders / torso (drive) | 6      | 0      |
| cast         | head piece inside the shoulders / torso (sujud) | 5      | 4      |
| cast         | head piece inside the shoulders / torso (wave)  | 6      | 6      |
| cast         | legs / feet below the floor (julus)             | 16     | 0      |
| cast         | legs / feet below the floor (sujud)             | 16     | 0      |
| cast         | legs / feet below the floor (walk)              | 3      | 0      |
| cast         | rim floating > 3 mm off the head                | 2      | 0      |
| cast         | z-fighting with the head (> 4 samples)          | 6      | 3      |
| **cast**     | **total**                                       | **84** | **13** |
| guides       | hands below the floor (sujud)                   | 2      | 0      |
| guides       | head piece below the floor (sujud)              | 1      | 0      |
| guides       | head piece inside the shoulders / torso (drive) | 1      | 0      |
| guides       | head piece inside the shoulders / torso (sujud) | 1      | 1      |
| guides       | head piece inside the shoulders / torso (wave)  | 1      | 1      |
| guides       | legs / feet below the floor (julus)             | 2      | 0      |
| guides       | legs / feet below the floor (sujud)             | 2      | 0      |
| **guides**   | **total**                                       | **10** | **2**  |
| event        | hands below the floor (sujud)                   | 15     | 0      |
| event        | head piece below the floor (sujud)              | 4      | 0      |
| event        | head piece inside the shoulders / torso (drive) | 3      | 0      |
| event        | head piece inside the shoulders / torso (sujud) | 2      | 2      |
| event        | head piece inside the shoulders / torso (wave)  | 3      | 3      |
| event        | legs / feet below the floor (julus)             | 15     | 0      |
| event        | legs / feet below the floor (sujud)             | 15     | 0      |
| event        | legs / feet below the floor (walk)              | 6      | 0      |
| event        | rim floating > 3 mm off the head                | 1      | 0      |
| event        | z-fighting with the head (> 4 samples)          | 8      | 3      |
| **event**    | **total**                                       | **72** | **8**  |
| crowd        | head piece below the floor (sujud)              | 1      | 0      |
| crowd        | head pokes through the piece                    | 8      | 0      |
| crowd        | head uncovered where the piece should cover it  | 3      | 0      |
| crowd        | legs / feet below the floor (julus)             | 8      | 0      |
| crowd        | legs / feet below the floor (pedal)             | 2      | 0      |
| crowd        | legs / feet below the floor (sujud)             | 8      | 0      |
| crowd        | legs / feet below the floor (walk)              | 2      | 0      |
| crowd        | rim floating > 3 mm off the head                | 7      | 0      |
| crowd        | z-fighting with the head (> 4 samples)          | 0      | 6      |
| **crowd**    | **total**                                       | **39** | **6**  |
| pilgrims     | head piece below the floor (sujud)              | 2      | 0      |
| pilgrims     | head pokes through the piece                    | 3      | 0      |
| pilgrims     | head uncovered where the piece should cover it  | 2      | 0      |
| pilgrims     | legs / feet below the floor (julus)             | 6      | 0      |
| pilgrims     | legs / feet below the floor (sujud)             | 6      | 0      |
| pilgrims     | rim floating > 3 mm off the head                | 2      | 0      |
| pilgrims     | z-fighting with the head (> 4 samples)          | 0      | 1      |
| **pilgrims** | **total**                                       | **21** | **1**  |

Printed face wrap (every rig): before, its top edge stood up to 2 mm proud of the head where the head curves in (17 samples: the "flat square patch"); after, 0 proud, 0 dipping, 0 z-fighting.

## The orchestrator's known issues

| issue                                                           | found                                                                                                                                                                                                             | fixed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Girl hijab puffy, square face patch, face lighter than hands    | yes: hood 16-19 mm off the head, a jagged 32-segment face cut, the face print's top edge proud                                                                                                                    | fitted hood 8-11 mm off the head (56 segments, smoothed seam), a rounded face opening whose lip tucks into the head, the face print now follows the head's own curve; the drape is a separate mesh on the torso so turning or nodding the head opens no gap and swings nothing through the shoulders. Face and hands use the same skin colour and the same skin flag; under the neutral studio light they match (`sheets-after/hero-girl-hijab.jpg`, drive tile); in town the face reads lighter only where the sun hits it head-on |
| Hair, caps, songkoks, kufis poking through or floating          | yes: crowd hair dome (skull showing), crowd cap / kopiah / songkok rims, doppi sides, cast cap band 15 mm off the head, cap / songkok hair blob floating at the back, flower-hijab flowers buried inside the hood | rebuilt as snug lathes matched to the head (crowd: same 14 facets as the head, rims tucked inside it); short hair at the nape under a cap or songkok; flowers on the hood surface; sporty band hugs the hood                                                                                                                                                                                                                                                                                                                        |
| Prayer pictures show the boy when the girl prays                | yes                                                                                                                                                                                                               | `pictures.js` renders a second set (the girl in a white hijab) and `posture()` picks by `G.Hero.isGirl()`                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Ponytail and braids hard to see from the front                  | yes                                                                                                                                                                                                               | the ponytail is tied high with a puff over the crown and its tail swings out past one side; the braids hang forward over the shoulders (`../shots/figures-after-03-hero-girl-ponytail.png`, `sheets-after/hero-girl-braids.jpg`)                                                                                                                                                                                                                                                                                                    |
| Speech bubbles overlap, too many, hero's salaam too high        | yes (`../shots/figures-before-12-bubbles.png`): head heights 1.7 m for a 1.05 m neighbour, no layout                                                                                                              | at most 3 shown (hero first, then nearest), stacked so none overlaps, anchored 0.16 m over the measured head tops (`../shots/figures-after-12-bubbles.png`)                                                                                                                                                                                                                                                                                                                                                                         |
| Hats and hijabs clipping into the floor or body in sujud / ruku | yes (cap peak 9 cm through the floor; hijab 2 cm; kid tudung 4 cm; crowd cap 6 cm)                                                                                                                                | the sujud bend is solved from the real outline of the head piece (`F.headContour`), a peaked cap is worn peak-back for the prayer postures (cast and crowd), knees / toes / hands rest on the floor                                                                                                                                                                                                                                                                                                                                 |

## What remains (justified)

- **Raised arm through the shoulder drape (wave):** every hood wearer, about 60-90 samples where the upper arm lifts straight up through the rigid drape; drive is now 0 (was flagged for every hood wearer) and idle, walk, sit, ruku, julus are 0. A rigid toy cape cannot lift with the arm; making the drape narrower would bare the shoulders. Listed as a follow-up (a short lift of the drape side in the wave pose, or a softer wave for hood wearers).
- **Sujud, hood wearers: 5-8 drape samples** resting inside the forward-reaching upper arms (the cloth lies on the arms; just over the 4-sample flag).
- **Z-fighting counts that remain are tangential crossings, not overlapping faces:** the short hair under a cap or songkok crosses the head under the hat rim (20 samples, hidden by the hat); the crowd's tucked rims cross the head along the hairline / face edge (9-14). No coplanar faces remain.
- **Not changed (out of scope or another agent's):** rider poses on camels / horses (`ride-poses.js`, being reworked by another agent; not audited here). The face atlas stays 512 px (crisper print would need a larger atlas per figure, about 1 MB more GPU memory each). Religious note for the orchestrator (sim data, not changed): `crowd-pilgrim-dress.js` gives some men in ihram a cap or a turban (`ihramMan`), but men in ihram keep their heads uncovered.

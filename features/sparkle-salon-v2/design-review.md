# Sparkle Salon v2: princess art redraw (design review)

**Problem (owner):** children playing it call the princess "a monster". Goal: a pretty, friendly child-princess in the same chibi genre, built from cheap vector art that still works with every make-up layer.

Mockups: [`mockups.html`](mockups.html) · screenshots: [`screens/`](screens/) (`before-*` / `after-*`, at 390 and 1024 wide).

## 1. Diagnosis: why the v1 face read as a monster

Taken from fresh 390×844 and 1024×1366 screenshots (`screens/before-*.jpg`).

1. **The hair was a helmet, not hair.** A huge, uneven mass rose about 1.5 face-heights above the head, with a tall swept peak. Hard bang slabs covered the whole forehead and one temple, and spiky tips with orange outlines hung down like stalactites. Seen whole, the head looked lumpy and far too big.
2. **The face was long, pointed and pale.** The face tapered from wide cheekbones to a narrow, pointed chin, which made a long lower face (horse/alien-like). The skin was flat and almost white. The neck and chest were the same flat pale colour, with no warmth at the cheeks or under the chin.
3. **The eyes sat at the very edge of the face.** The outer liner wings almost touched the face outline, so the eyes read as wide-set and fish-like, with no cheek or temple around them.
4. **The nose looked like a mark, not a nose.** It was a single off-centre vertical stroke plus a white dot, which reads as a scar or a nostril slit.
5. **The brows were thin, flat and dark.** Straight near-black lines high above the eyes gave a stern, surprised look.
6. **The cleanse dirt looked like illness.** Round grey-brown blobs with darker dots read as moles or pox, and red blotches with darker red centres read as a rash or sores. A face covered in "sores" at step 1 is the strongest single cue for "monster".

Your hypotheses held: the hair crowded the face, the chin was weak/long, the features were badly placed (eyes at the edges, scar-like nose), the skin had no form, and the smudges looked diseased. One correction: the face was not _square_. It was a long inverted egg, and that reads just as badly.

## 2. Four directions (all original art, same round child face)

|       | Direction                  | One-line rationale                                                                                                                                                   |
| ----- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** | **Sunny curtain bangs**    | Round child face, centre-part curtain bangs that open the forehead, long golden locks framing the face and curling at the ends.                                      |
| B     | Side-swept waves           | Same face, one big soft swoop from a deep side part. Glamorous, but the swoop covers a brow and one forehead smudge, and it is asymmetric for the eye-shadow camera. |
| C     | Twin pigtails with bows    | The youngest read, but it is not the "flowing" hair the owner asked for, and the bows fight the tiara slot.                                                          |
| D     | Braided crown + long waves | Storybook princess, but the braid adds about 30 scallop nodes and sits exactly where the tiara goes.                                                                 |

## 3. Roundtable (owner delegated the choice)

- **UX designer:** A is the clearest "friendly girl" silhouette at thumbnail size (results photo) and at 1.75× lipstick zoom. The open forehead gives the brows and eye shadow a clean frame, and nothing overlaps the lid, cheek or lip paint regions. B hides a brow, and C/D compete with the tiara accessory.
- **PM:** the owner wants blonde, flowing and pretty, for ages 4–10. A and D both fit. A wins because it keeps every accessory and sticker slot clear, so no feature regresses.
- **Tech Lead:** A is the cheapest. There are no clip-paths per lock (v1 had 20) and no SVG filters in the head or hair (v1 had 57 filtered elements). It uses 5 small new gradients, reuses one lock path mirrored with a transform, and every face feature keeps its centre, so the paint regions and camera targets need no geometry changes.

**Decision: A, "Sunny curtain bangs".**

## 4. What changed in the game (art only)

- **Face** (`#faceGrp`, `#clipFace`): a round child face (widest 104–296, soft round chin at y 408, was a point at 413). It has a warm rim, a soft jaw crescent and a forehead glow, and two gradient cheek glows. There are **no filters**.
- **Nose:** a small button curve with a soft highlight, replacing the stroke and dot.
- **Brows** (`#browsGrp`): softer, thicker, rounded arch in warm brown (`#a8704b`).
- **Mouth** (`#lipsFront`): the lip line now curls up at the corners (a smile). `#lipsBase` geometry is unchanged, so the lip paint mask is identical.
- **Neck/shoulders** (`bodyGrp`, `#clipBody`): a slightly narrower child neck with a gradient chin shadow. The four blurred ellipses are gone.
- **Ears:** a little smaller and tucked in at the same anchor, so the earrings at x 108/292 still hang from the lobes.
- **Hair:** the back hair (`#hairBackGrp`, swaying) is one wavy silhouette with layered side locks and highlight strokes. The front hair (`#hairFrontGrp`) is a crown cap with curtain bangs, two face-framing wavy locks (one path, mirrored), strand lines, a halo shine and two sparkles. The palette stays the owner's lemon gold, and the RT1-hair probe passes at hue 43.3°.
- **Tiara:** centred on the new part, at `translate(200 96) scale(1.12) … translate(0 26)` (was 210 / 1.18 / 22).
- **Cleanse dirt** (`#smudgesGrp`): there are still 7 `.smudge` groups with the **same ids and the same `data-x/y/r`**, now drawn as chocolate swipes, mud swipes, purple/blue glitter face-paint with sparkles, and a pink crayon scribble. The dead gradients `gSmudge`, `gDust`, `gSpot` and `gFaceShade` are removed.
- **Unchanged on purpose:** the eye group (`#eyeL`, the mirrored `#eyeR`, iris stops, lashes, the blink/happy groups), so `SHADOW_BLOB`, `LASH_BAND`, the `REGION_DEFS` boxes, `cheek()` at y 352, the step cameras and `ACC_CAM` all still match.

## 5. Cost (rendered princess SVG elements, after the runtime eye/sleeve clones)

|                                      | v1                   | v2                                                                     |
| ------------------------------------ | -------------------- | ---------------------------------------------------------------------- |
| elements (all 5 layers)              | 1126                 | 817                                                                    |
| hair back / face / eyes / hair front | 305 / 36 / 150 / 290 | 96 / 22 / 144 / 210 (210 includes about 150 unchanged accessory nodes) |
| elements with `filter=`              | 57                   | 3 (dress only, untouched)                                              |
| `<filter>` defs                      | 4                    | 1                                                                      |
| gradients                            | 39                   | 23                                                                     |
| clip-paths                           | 20                   | 3                                                                      |

## 6. Open questions

- The puff sleeves on the dress are now visible above the neckline, where v1's hair used to cover them. They read as part of the dress.
- The eyes themselves are unchanged (big anime eyes with a dark liner wing). If playtests still say "scary", softening the liner colour is the next lever.

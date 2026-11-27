# Test plan: Kampung Quest crowd

| AC      | Test                                                                                                                                                                                                                                              |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3, 4    | `tests/kampung-quest/crowd.test.mjs`: occupancy curves (night empty, lunch / rush / dawn peaks, bounded, wraps), block-stable slot choice and its share, tier caps and stroller targets, stroller mix and speeds                                  |
| 5, 6    | same file: outfits deterministic, modest (adults covered, tudung only on women), age roles; layout helpers (chat circle faces the middle, queue, grid); one speaker at a time                                                                     |
| 2       | same file: every crowd pose registered, finite at every phase for adult and kid sizes, loops cleanly, seated poses keep the thighs level, tai chi keeps the feet on the floor                                                                     |
| 1, 2, 3 | `tests/kampung-quest-crowd.spec.mjs`: lunch at the hawker has diners, a queue, strollers and 20+ people in view; 02:00 is empty; tai chi at dawn                                                                                                  |
| 4       | `tests/kampung-quest-crowd.spec.mjs`: active count within the cap on six scenes; cap grows with tier; a busy low-tier frame at three hot spots stays under 400 calls. `tests/kampung-quest-ac.spec.mjs` AC-14 (sweep + 4x CPU frame) still passes |
| 5       | `tests/kampung-quest-crowd.spec.mjs`: nobody standing in a collider on six scenes; every seated extra holds exactly one seat and all are released when the crowd leaves                                                                           |

Manual: screenshots of the hawker and a void deck, and an eye check that nothing pops in view.

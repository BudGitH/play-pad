# Requirements: Kampung Quest crowd ("make it bustling")

**Ticket:** none yet (owner request: "Populate the world with more characters and users doing things please so it's bustling.")
**Tier:** Standard. **Personas:** a child player on an iPad (wants to see life), a parent checking it is smooth and calm.

## Acceptance criteria

1. **More people.** At a busy place and hour (hawker at lunch, bus stop at the morning rush, playground after school) at least 2x as many people are in view as before (the cast alone: about 8-12 visible).
2. **Doing things.** Visible activities: eating and chatting at hawker tables and void-deck stone tables; queueing at stalls (the front person orders); waiting for the lift and the bus (phone, watch, looking around); chatting in circles (one speaks, the rest listen and nod); tai chi at dawn and dusk; kids running and hopping at the playground; sweepers with brooms; strollers on the pavements (commuters, aunties with shopping bags, elders, joggers, friends in pairs, cyclists).
3. **Time of day.** The headcount and the mix follow the clock (breakfast, lunch, school run, dinner rush; almost empty at night).
4. **Smooth.** No new per-person meshes or lights. Low tier stays under the 400 draw-call phone budget (AC-14) and within the 4x-throttled frame budget; per-tier caps (low 56, med 84, high 120) bound the work; nobody beyond range is simulated or drawn.
5. **Clean.** Nobody stands in a wall, pillar, table or fence; extras never take a seat a cast neighbour holds; people appear and vanish only out of sight; extras make way for the hero and the cast.
6. **Child-friendly.** Modest dress (long sleeves and skirts on adults, tudung / songkok / kopiah in the Malay group), no violence, nothing scary. Extras are scenery: not talkable, no missions.

## Out of scope (see `docs/IDEAS.md`)

Queue shuffle with take-away (tapau) leavers, extras walking to their table, cast neighbours chatting in pairs, buses arriving, faces beyond two eyes and a mouth.

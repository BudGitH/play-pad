# Citizens say salaam when their paths cross

Owner request: "Have citizens say salaam when their paths cross."

## What it does

- Two walking citizens (cast neighbours and the crowd's strollers) who pass within 2.5 m may
  exchange a greeting: a small speech bubble "Assalamualaikum!" over one, and a second later
  "Waalaikumsalam!" over the other. Each bubble shows 2.6 s and fades.
- A neighbour (or stroller) who passes the hero within 3 m may greet the hero; the hero's reply
  bubble ("Waalaikumsalam!", gold) shows over the hero. A standing neighbour also raises a hand
  (the existing `wave` pose); walking ones and all crowd extras get a bubble only.
- Only people within 25 m of the hero and on screen take part.

## Anti-spam rules (all in the pure `js/sim/greet.js`)

| Rule             | Value                                                                  |
| ---------------- | ---------------------------------------------------------------------- |
| Chance per pass  | pair 50 %, citizen-to-hero 75 % (rolled once per pass, not per frame)  |
| Pair cooldown    | 60 s after a greeting, 20 s after a quiet pass                         |
| Hero cooldown    | 75 s per citizen after a greeting, 20 s after a quiet pass             |
| Person busy      | 12 s after greeting or being greeted                                   |
| Global gap / cap | >= 3 s between any two greetings; at most 3 on screen (6 bubbles)      |
| Not "crossing"   | friends walking as a pair (same group), or people walking the same way |

## Religious and cultural accuracy

The salaam exchange happens only when **both** are Muslim (cast `NPC_PROFILE[id].muslim`; crowd
extras of the "malay" group). Any other pairing, and non-Muslim neighbours greeting the hero, say a
plain "Hello!" / "Hi!". Nobody is made to give or answer a Muslim greeting that is not theirs. The
hero is the Muslim child of the game, so a Muslim neighbour's greeting is answered "Waalaikumsalam!".

## Where it lives

- `js/sim/greet.js` (new, pure, in `index.html` and `tests/kampung-quest/load-sim.mjs`): pairing,
  chances, cooldowns, caps. Unit tests: `tests/kampung-quest/greet.test.mjs`.
- `js/game/greetings.js` (new): gathers who can greet (free cast agents, crowd walkers), runs the
  pure greeter 5 times a second, and shows pooled DOM bubbles (at most 6, `textContent` only,
  inline styles, placed by camera projection, `aria-hidden`). Hooked from `Loop.stepActors` with one
  line. Skipped while a menu or prayer screen is open.
- `npc-agent.js` / `npc-manager.js`: `greetT` makes a standing neighbour play `wave` (`Npcs.wave`).
- `hooks.js`: `__kq.greetings()` (`{total, showing, visible}`) and `__kq.greetChance(p)` (force the
  roll chance for tests; `null` to restore).
- Browser spec: `tests/kampung-quest-greetings.spec.mjs`.

## Cost

Bubbles are DOM, not meshes: no new draw calls, lights or textures. A same-seed 90 s walk on a busy
pavement has an identical draw-call trace with greetings off and forced on (the spec asserts it).
`speech.js` was not reused: it is the optional read-to-me text-to-speech, not a caption; greetings
are not spoken aloud (it would be noisy, and the azan rules about sound stay untouched).

## Ideas for later

- A short soft "salam" voice clip (audio.js owner) and a salam-with-hand-on-chest pose for the hero.
- Kids greeting elders first (salam to elders: the younger greets); a "tap to reply" mini-moment.

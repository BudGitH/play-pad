# Design Review: Kampung Quest (HUD and interaction IA)

> **Phase 1b output, full design path.** Produced _before_ building, to choose the in-game HUD and the information architecture of its interactions. Roles are spawned from `docs/PRODUCT-PANEL.md`; visual rules come from `docs/DESIGN-SYSTEM.md` (MD3 tokens, dark roles pinned over the 3D scene, as in every PlayPad game).

**Feature:** Kampung Quest (open-neighbourhood life game)
**Ticket:** PLAY-013
**Date:** 2026-11-26
**Status:** AWAITING OWNER DECISION (Roundtable recommendation: **C, with three pieces of D**; see §5)

---

## 1. Diverge: 4 concrete mockups

The options are in [`mockups.html`](mockups.html). Open it from a static server (`node tools/serve.mjs 5603`, then `/features/kampung-quest/mockups.html`) or straight from disk. Each option shows the same six moments on a **phone in landscape (844 × 390, touch)** and a **desktop (1280 × 720, keyboard)**: ① exploring with the "Talk to Nenek" prompt, ② the dialogue bubble, ③ the azan at Zohor (Arabic + transliteration + English captions, mission paused, guidance to the mosque), ④ the guided prayer steps (Zohor, raka'at 2 of 4, step Ruku, a gentle hint after a wrong tap), ⑤ Ali's Prata & Mamak menu (10 halal dishes with prices, one too dear), and ⑥ the option's own deeper layer. All four use the same tokens; they differ in **where information lives and how you reach it**.

Screenshots (Chromium, deviceScaleFactor 1): `shots/mockup-{A,B,C,D}-{phone,desktop}.png`.

- **Option A, Classic corners:** the open-world convention. Status (clock, next prayer, coins, food/energy bars) top-left, mission tracker top-right, minimap bottom-left; every panel is always on. Prayer steps, the stall menu and the journal open as centred modal dialogs over a dimmed world. On a phone the minimap moves into the status card and the tracker shrinks to one line.
- **Option B, Phone in hand:** a toy smartphone carried by the hero holds Missions, Map, Prayer, the stall's order screen and Stickers. The world HUD is a clock chip, two small needs rings, one "next step" line and an edge arrow; there is no minimap. The phone slides up by itself when the azan starts, and the prayer coach runs inside it.
- **Option C, Compass and context cards:** one compass strip on top carries direction plus every marker with a distance (mission, mosque, hawker, home); food and energy bars hang under it. One **context card** at the bottom shows the single thing that matters now and changes with context: mission → "Talk to Nenek" → dialogue → azan → prayer steps → the stall menu as a bottom sheet. The world stays visible, so the hero is **seen** taking each prayer posture.
- **Option D, Kid dock and needs ring:** pictures first. A dock of big labelled icons (Missions, Map, Pray, Bag, Pause), a minimap wrapped in a two-arc needs ring (food left, energy right), a "day of prayers" strip with all five prayers, a picture mission card, a big floating "Talk" button over the NPC, picture tiles for dishes and postures, and a "read to me" button on every text card.

## 2. PM brief

The business outcome is a **flagship, longer-session game that a Muslim family is happy to hand to a child**. The success metric is concrete: in one 48-minute game day a **new** player completes ≥ 1 mission, eats ≥ 1 meal and finishes ≥ 1 full prayer flow **without help**. So the HUD must (1) make the next action obvious to a 7-year-old, (2) make the prayer moment feel gentle, respectful and central rather than an interruption or a notification, (3) work one-handed on a phone and fully by keyboard with captions, and (4) look premium enough to beat a generic kids' 3D world. Business rules 1, 2 and 5 (child-friendly, prayer required gently with no fail state, religious accuracy) constrain every option equally; the choice is about **wayfinding, focus and learnability**.

## 3. Design Roundtable: converge

Senior Tech Lead + Senior PM + Senior UX Designer. The Tech Lead inherits the Phase-1 verdict (`PROCEED_WITH_NOTES`, large effort) and only costs the options. The HUD is DOM over the WebGL canvas in every option, so none of them changes the AC-14 draw-call budget; the differences are DOM churn per frame, the number of UI states and the art needed.

| Option                      | Desirability (UX / persona)                                                                                                                                                                                                                                                                          | Viability (PM / business)                                                                                                                                                                                 | Feasibility + effort (Tech Lead)                                                                                                                                                                                                                                                                                     | Recommended?                        |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| **A** Classic corners       | Familiar to anyone who has played an open-world game and everything is visible at once. On a phone four always-on panels fight the thumbs and the scene: in state ③ the azan banner, status card, paused tracker and mosque pin fill the top half. The modals hide the hero's posture while praying. | Meets the rules, but reads as "a GTA HUD with a mosque added": the prayer is one more overlay. Weakest premium feel on a phone.                                                                           | **M.** Standard panels; a live minimap (2D canvas, redrawn about 10×/s) and five modal dialogs. Easy keyboard focus order (modals trap focus).                                                                                                                                                                       | No                                  |
| **B** Phone in hand         | The cleanest world and a fun fiction, but every task is one tap further away, there is no minimap (the edge arrow alone is weak for a child), and 10 dishes / 8 missions scroll inside a narrow phone. On a real phone the toy phone has to turn landscape and fill the screen.                      | **Values risk:** prayer delivered as a phone-app alert teaches "prayer is a notification". Parents in the target audience may dislike a child glued to a toy phone in a game about neighbourhood life.    | **L.** A second mini-OS: an app shell, 5 apps, portrait and landscape layouts, its own focus management and scroll regions. The cheapest per frame (no minimap), the most UI code.                                                                                                                                   | No                                  |
| **C** Compass + context     | Calm and focused: one card means one next action, and its button **is** the interact button on a phone (no hunting for a prompt). The prayer steps run in-world, so the child watches their hero bow, which is the point of the game. The compass is more abstract than a map for a 5-6-year-old.    | Best fit for "premium" and "prayer is central": the world stays on screen, the azan card replaces the mission card instead of stacking on it, and the paused mission is visibly "waiting" on the compass. | **M (lowest risk).** The card is a direct view of one `context` value resolved from `KQ.Sim` state (`mission → prompt → dialogue → prayerDue → prayerStep → menu`), which maps 1:1 to tests. The compass is a 1-D projection of bearings (a CSS transform per marker per frame). Least DOM. Needs a full-map screen. | **Yes, with D's pictures** (see §5) |
| **D** Kid dock + needs ring | The most learnable for a pre-reader: icons with labels, pictures for postures and dishes, coin pips, "read to me". The needs ring is lovely but dense on a phone, where the dock and ring take the whole top band. Teens and adults may find it young.                                               | Strongest for "hand it to a child". Weaker for the "premium" bar and for the wider PlayPad audience (Maya, Dan).                                                                                          | **L.** The most art: about 10 dish pictures, 4 posture pictures (reusable from the figure poses as renders), 8 mission pictures; a radial SVG ring; read-aloud via `speechSynthesis` (offline, but voices vary by device, so it must stay optional with captions as the floor).                                      | Parts of it                         |

**Roundtable notes:**

- **UX:** C and D answer different halves of the brief. C gets **focus and wayfinding** right (one card, a compass that also carries the paused mission, the hero visible while praying). D gets **learnability for pre-readers** right (posture pictures, coin pips, read-to-me). Their parts don't clash: C's context card can hold D's picture tiles. A is the safe baseline and B is the riskiest.
- **PM:** "Prayer is required, gently" (rule 2) is best served when the azan **replaces** the mission card (C) rather than piling a fourth panel on top (A) or arriving as an app alert (B). The success metric needs a _new_ child to finish a prayer flow unaided, which is D's picture tiles plus Imam Hakim's hint.
- **Tech Lead:** C's single-context model is the cheapest to make correct: one resolver, one card component, and the edge cases in `requirements.md` ("prayer arrives during a menu → finish the menu, then the card") become ordering rules in that resolver. Taking D's picture tiles adds art but no new architecture. Keep the needs as two labelled bars (C), not D's radial ring, to save a component and keep the numbers readable. Every option meets AC-15 (48 px targets, focus, captions, controls inside `--pp-app-h`).

## 4. Persona review

Each target persona looked at both frames of every option. (A structured heuristic, not real users; see `docs/PRODUCT-PANEL.md`.)

- **Priya & kid (7, sharing a tablet):** prefers **D**, then **C**. "My daughter can't read 'I'tidal' yet, but she can tap the picture of the bowing figure, and the big Talk bubble over Nenek's head is obvious." On A, "too many boxes; she won't know which one matters." On B, "I don't want the prayer to come from a phone." Would take C if the prayer step buttons show posture pictures and there is a read-to-me button.
- **Maya (phone, one-handed, short sessions):** prefers **C**. "The card's button is where my thumb already is, so I don't look for a separate Talk button. The compass tells me where to walk without a map in the corner." On A the corners crowd the phone; on B "every errand is open phone, tap app, scroll"; on D the top band is busy but usable. Asked for a portrait layout (the card sits above the joystick in C).
- **Sam (keyboard + screen reader, needs captions):** prefers **C**, with **A** close behind. "One card is one predictable focus target: `E` acts on it, `1`-`4` pick the prayer step, `Tab` reaches pause/mute/map. The azan captions are in the same card every time." A works too (modals trap focus) but its four live regions would all announce. B needs a separate focus model for the phone. D is fine if each tile has a text label (it does) and the ring's numbers are exposed as text (they are, "62" / "78").

## 5. Human decision (the real call)

> **Interactive:** the owner picks from `mockups.html`; mixing is valid. Until they do, this stays **AWAITING OWNER DECISION** and Phase 2 does not start.

**Roundtable recommendation: Option C as the base, plus three pieces of D:**

1. **C's layout and model:** compass strip on top (markers with distances, the paused mission shown on it), food/energy bars under it, and one bottom context card whose button is the interact action. Prayer steps run in-world, with the hero in the posture.
2. **From D, posture pictures** on C's prayer-step buttons and **picture dish tiles with coin pips** in C's stall bottom sheet (pre-readers can do both main loops).
3. **From D, a "read to me" button** on the dialogue, mission and prayer cards (optional `speechSynthesis`; captions always on).
4. **From D, the five-prayer day strip** in the map/pause screen, so a child sees the whole day's rhythm (done / next / later, with raka'at counts).

**Why:** C best serves the business rule that prayer is central and gentle (the azan card replaces the mission card, and you see your hero pray). It is the most usable one-handed on a phone (Maya) and has the most predictable focus (Sam), and it is the lowest-risk build (one context resolver that tests can drive). D's pictures close C's single real gap, reading age (Priya & kid). A is a safe fallback; B is not recommended because of the values concern and the extra mini-OS.

- **Chosen option:** _pending: owner_
- **Mockup file:** `mockups.html` · **Chosen tab:** _pending_
- **Decided by:** _pending: @BudGitH_
- **Date:** _pending_
- **Rationale:** _pending_

## Accuracy notes (for whichever option wins)

- **Raka'at:** Subuh 2, Zohor 4, Asar 4, Maghrib 3, Isyak 4. In a 4-raka'at prayer, raka'at 2 ends with **tasyahud awal** (the mockups' step list shows it); the final raka'at ends with tasyahud akhir and salam. Maghrib's tasyahud awal also follows raka'at 2.
- **Ruku dhikr** (shown on the posture card): سُبْحَانَ رَبِّيَ الْعَظِيمِ, _Subḥāna rabbiyal-ʿaẓīm_ (×3), "Glory be to my Lord, the Most Great".
- **Azan captions:** the mockup shows phrase 1 of 15 (_Allāhu akbar_ ×2). The build takes the cue text and timings from `KQ.AZAN_TEXT`, matched to the licensed recording.
- **Times** in the mockups match the cited MUIS values for 26 Nov 2026 in `games/kampung-quest/js/data/prayer-times.js` (Zohor 12:54); the build reads them from `KQ.PRAYER_TIMES`.
- **Hints are never scolding:** "Nearly! After standing we bow next: that's Ruku. Take your time." No red, no cross, no score. A wrong tile gets a dashed outline and "not yet".

## Handoff

After the decision, **expand the chosen option's states** in the "Chosen — full states" tab of `mockups.html`: loading, empty (no mission, no stickers, no qada), notices (WebGL off, no storage, corrupt save, coins short), disabled (missions paused, dish too dear, hall before wudu), the prayer edge cases (muted or hidden tab means captions only, prayer due during a menu, late, qada, Maghrib → Isyak overlap, resume mid-flow, the full wudu sequence, Subuh/Maghrib step lists), the pause dialog and the portrait phone layout. **That tab is then the spec:** Phase 2 tests encode it, Phase 3 builds to it, and Phase 5 judges the build of this option without reopening the design.

# QA report: Kampung Quest improvements

Personas / product panel skipped at the owner's request.

## Round 1 (parallel lenses: accuracy · quality · risk+compliance)

| Sev    | Lens       | Finding                                                                                                                   | Status                                          |
| ------ | ---------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| HIGH   | Accuracy   | Idle sunat flow shadowed a due fard prayer (azan card hidden, Pray resumed sunat)                                         | Fixed: fard outranks sunat; browser tests added |
| MED    | Accuracy   | "Not now" left a sunat flow alive (clock 25 %, ambience silent)                                                           | Fixed: closing cancels sunat, wudu kept         |
| MED    | Quality    | Pure ambience mix maths in the game layer                                                                                 | Fixed: `js/sim/ambience-mix.js` + unit test     |
| MED    | Quality    | Fixed sleeps in ambience spec                                                                                             | Fixed: `expect.poll`                            |
| MED    | Compliance | Missing requirements / test-plan                                                                                          | Fixed                                           |
| LOW ×9 | mixed      | ~100 ms ambience tail on resume; sunat styled as urgent; hook guard; dead code; stale comment; duplicated label; doc gaps | Fixed                                           |

Verified by the agents and orchestrator: `npm run check` clean, `npm run test:kq` 267/267, full browser suite 249/250 before round-1 fixes (the one failing test was rewritten for the new "Not now" rule and passes), the prayer, ambience, hud-move and greetings specs pass after the fixes.

## Round 2

See the section appended below.

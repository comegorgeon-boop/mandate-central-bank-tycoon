# Reprise — where the week stopped

Written at the end of the week that was asked for a finished, complete game,
online. It is online. This file is the handoff; `docs/DIRECTION.md`,
`docs/BALANCE.md`, `docs/SCENARIOS.md` and `docs/EVENTS.md` are the permanent
record, and `docs/JOURNAL.md` is the week read in two minutes.

## State

`main`, tree clean, **deployed**:
**https://mandate-central-bank-tycoon.comegorgeon.workers.dev**

| check | result |
| --- | --- |
| `npm run build` | clean |
| `npm test` | 1094 passing, 65 files |
| `npm run check:offline` | clean, **against the deployed site** — 12 requests, all same-origin; a full mandate plays with the network cut and attempts nothing |
| `node tools/contrast.mjs` | no failures across **604** screen states |
| `node tools/board.mjs` | 684 shots, 0 scrolling sideways — `docs/board/index.html` |

Sixteen commits since 17 October. `wrangler` is logged in on this machine as
`comegorgeon@gmail.com`, so `npm run deploy` now works unattended.

## What the week was asked for, and where each piece landed

The six chantiers, in the order they were given.

| | asked | state |
| --- | --- | --- |
| A | the four remaining scenarios on the Volcker pattern | **done**, plus a seventh — 1929-33, 1972-74, 1979-83, 2008-10, 2010-12, 2021-23 twice |
| B | political pressure and public finances | **done** — a government that asks, a Treasury tab, Sargent-Wallace in the debt service |
| C | a presentation pass: make it a game | **done** — the living projection, and a fifth of the prose gone (journal 5) |
| D | home page, tutorial, glossary, achievements, save, records, legal | **done** |
| E | the 30 events in full | **done** — 36, of which 13 chain and 5 are gated second acts |
| F | keep looking; the council vote and the living projection | **both done**, plus the comparison against your own best |

Two corrections were made after that, both on your instruction: the Okun
coefficient now steepens with the depth of the output gap, so the game no
longer teaches a sacrifice ratio about half the real one; and the phone
meeting screen opens on the tab the player came for, with 252 px of header
and alarm above it instead of 1,518 px of context.

## The tools, which are the review channel

| command | what it is for |
| --- | --- |
| `npm run check:offline` | the project's first rule, executable. Takes `MANDATE_URL` to check the deployed site, which is the version that counts |
| `npm run check:contrast` | WCAG AA on every painted text node of 604 screen states, disclosures opened |
| `npm run board` | the capture board: every screen, two directions, phone and desktop |
| `node tools/play.mjs [scenario]` | play a mandate to term and photograph the end of it |
| `node tools/guide.mjs` | the first-meeting explanation, which exists only on a browser that has never played |
| `npx tsx src/simulation/dev/skillCheck.ts` | paired survival, skill against passivity, 240 seeds |
| `npx tsx src/simulation/dev/gateProbe.ts` | whether a chain gate actually separates the two populations |
| `npx tsx src/simulation/dev/nixonFit.ts` | whether 1972-74 produces 1972-74 |
| `npx tsx src/simulation/dev/okunFit.ts` | how far unemployment swings in every scenario, against the period |
| `npx tsx src/simulation/dev/scenarioFit.ts` | every fit table in SCENARIOS.md |

## What is open

**No decision is waiting on you.** `docs/QUESTIONS.md` #5 is settled: the
committee influences and does not veto, decided 19 October, with the reason
written up in `docs/DIRECTION.md` under "The council influences; it does not
veto" — which is where a later pass will look before reopening it. #1 to #4
are answered and applied, and each records what was applied and how to reverse
it; #3 and #4 carry an update from the Okun work.

**Two things I would open next**, neither blocking:

1. **The output gap is too shallow in the mild recessions.** The Okun pass
   fixed the labour block: 1979-83 now reaches 11.8 % unemployment against the
   10.8 % that printed, where it reached 9.3 before. What it exposed is that
   2008-10 and 2010-12 barely moved, because their modelled gaps stop at −3.3
   and −3.6 where the real recessions were deeper. Their unemployment is
   tracking the gap faithfully and **the gap is the defect** — which is the IS
   block, a different change, and the one that would also carry 1929-33 closer
   than the 12.0 % against 24.9 % it now reaches.
2. **The Meeting Brief is the heaviest tab** at 2732 characters on fed/medium,
   against the desk's 2404 and everything else under 1600. No longer an
   outlier — a newspaper column, not a dossier.

## The thing to carry forward

Every silent failure this week had the same shape, and there were six of them:
**something that could not fire, or was measured before it had arrived, with
the whole suite green.** Three gates that could never open. A scenario that
deflated through 1973. A guide that ringed a panel which had not finished
fading in. A badge that could never say "first time". A follow-up list half of
which nothing acted on. A first rule with no executable check.

Tests check what code *does*. None of them notices what it never does. The
defences added this week are all the same defence in different places: measure
the thing rather than assume it, and write the check that would have caught
it — `gateProbe` for gates, the arc test for scenarios, the decoration test for
chains, `check:offline` for the first rule.

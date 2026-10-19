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
| `npm test` | 1102 passing, 66 files |
| `npm run check:offline` | clean, **against the deployed site** — 12 requests, all same-origin; a full mandate plays with the network cut and attempts nothing |
| `npm run check:contrast` | no failures across **664** screen states |
| `node tools/board.mjs` | 684 shots, 0 scrolling sideways — `docs/board/index.html` |

Twenty-one commits since 17 October. `wrangler` is logged in on this machine
as `comegorgeon@gmail.com`, so `npm run deploy` works unattended.

**A playtest is in progress and the game is frozen until it comes back.**
Nothing in `src/` or `tools/` should change meanwhile: feedback on a version
that no longer exists is feedback thrown away.

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

Two corrections followed, both on instruction: the Okun coefficient now
steepens with the depth of the output gap, so the game no longer teaches a
sacrifice ratio about half the real one; and the phone meeting screen opens on
the tab the player came for.

**Then the game was restructured**, because it was still boring, and the
reason was not density: *the gesture never varied.* Twenty-four identical
turns. That is now three kinds of meeting, a wager with the stake visible
before the commitment, and a verdict in colour. See journal 15 and the table
below.

## The shape of a turn

| | what it is | how often |
| --- | --- | --- |
| **quick** | one sentence, the dial, the wager, done. 24 compulsory words, about seven seconds. The room is one gesture away and most players will not open it | 75-89 % of fictional meetings, 56-77 % of a scenario's |
| **full** | the whole apparatus, because something **changed** — a crisis landed, a warning just turned severe, the government asked for something new, the objective moved, guidance comes due | the rest |
| **decisive** | one per mandate, placed by seed or at a scenario's own crisis. Announced a meeting ahead; afterwards the counterfactual takes the top of the reaction screen — what the other way would have produced | once |

*Full* means changed, not true. The first version tested states and latched:
79 % of the 2021-23 meetings came back full, because a supply shock is true
for as long as it lasts. A thing true at every meeting is weather.

**Two wagers.** Surprising the market is priced on the dial as you move it —
reach bought against market trust and volatility risked, read off the engine's
own constants so the stake shown is the stake taken. And the published
forecast: where inflation prints in two meetings, at a band you choose, which
cannot be revised once made.

**Criteria, all measured** (`dev/twoLines.ts`, `dev/tempoMix.ts`, and the
timing probe in journal 15):

- a quick meeting is 24 compulsory words, about seven seconds
- a full one is 425 words, about two minutes
- on easy, a player reading **only** the standing line and the meeting
  sentence serves 40 of 40 mandates and meets the objective in 24
- a run is distinguishable by colour alone, reading no text

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
| `npx tsx src/simulation/dev/scenarioFit.ts` | every fit table in SCENARIOS.md |
| `npx tsx src/simulation/dev/twoLines.ts` | whether two lines are enough to serve a mandate |
| `npx tsx src/simulation/dev/tempoMix.ts` | what proportion of meetings are quick, and why the rest are not |
| `npx tsx src/simulation/dev/okunFit.ts` | how far unemployment swings in every scenario |

## The first thing to pick up

**Four guardrails, specified in `docs/DIRECTION.md` and not built.** They come
from the five defects of the restructure, four of which were mistakes this
project had already made and already written down. A journal entry is a
memory; these are meant to be mechanisms.

1. **A static token check.** A test that reads the source for a `className`
   holding both a dark-surface class and a paper-text class, or the reverse,
   and fails naming the file. It is a grep. It would have caught both contrast
   failures of this pass before either reached a commit, and unlike the audit
   it does not depend on a walk happening to reach the panel.
2. **Reachability tests as a rule rather than a habit.** Every branch that
   produces player-visible content owes a test that reaches it. Three exist
   (`chains.test.ts`, `tempo.test.ts`, the scenario arc test) and each was
   written after the branch in question had already shipped unreachable.
3. **One source per derived quantity.** Applied by hand this pass
   (`meeting/surprise.ts`); no check enforces it.
4. The fifth defect is closed: `settleMeeting` waits two animation frames, so
   every browser tool reports what the player sees rather than what the
   browser held halfway through.

## What is open

**One thing is waiting on you: the playtest.** The game is frozen until it
comes back. Everything below is what I would do after it, in the order I would
do it — behind the four guardrails above, which come first because they are
what stops this list growing the same way twice.

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
   outlier — a newspaper column, not a dossier — and now behind "open the
   room", so it is read by a player who chose to read it.

## The thing to carry forward

Every silent failure this week had the same shape, and there were eleven of
them: **something that could not fire, or was measured before it had arrived,
with the whole suite green.** Three gates that could never open. A scenario
that deflated through 1973. A guide that ringed a panel which had not finished
fading in. A badge that could never say "first time". A follow-up list half of
which nothing acted on. A first rule with no executable check. A verdict band
that never appeared. A wager that never settled. An invisible panel, twice.

Tests check what code *does*. None of them notices what it never does.

The one defence that has worked every time is a method: **state the criterion
as a number, then write the thing that tries to falsify it.** `twoLines` does
not check that the sentence is good — it plays forty mandates reading nothing
else. `gateProbe` does not check that a gate is sensible — it measures how
often it is open for two populations. `check:offline` does not check that
nothing failed — it cuts the wire.

A check that can only confirm is not a check. And a method only works when
somebody remembers to apply it, which is why the four guardrails above matter
more than any of the measurements below.

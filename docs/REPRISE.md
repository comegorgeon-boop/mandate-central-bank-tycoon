# Reprise

Where this is, in one page, for whoever picks it up next — including me.

## The branch

`instrument-and-ladder`, merged to main. Main is live and the player validates
the screen before anything lands there.

| commit | what |
| --- | --- |
| `2797931` | a ladder of broken readings, and a ceiling that costs instead of refusing |
| `96093f8` | merge: coherent openings, a dial that costs, figures from the first meeting |
| *this one* | an instrument for the component it is charged for, and three rulers that were wrong |

## What the game is now

A dealing-room terminal. Amber on a near-black chassis, panels tiled edge to
edge with one-pixel rules of the chassis showing between them, IBM Plex Mono
carrying figures and labels alike in columns whose label width is a constant.
Spectral survives for the one written line. No radius, no shadow, no gradient
— `--radius-*` and `--shadow-*` are zero in `tokens.css`, which is why ninety
components went square without being touched.

You serve until you are revoked. A Fed Chair has 32 meetings and a
reappointment hearing whose bar is credibility raised by the political
pressure the term accumulated; an ECB President has 64 that cannot be renewed
or cut short, so political pressure has nothing to act on. The score is banked
meeting by meeting with a floor below zero, so a bad meeting is a bill and
being dismissed early can no longer protect a good average.

**This page said for several passes that what ends an ECB presidency is losing
the Governing Council. It does not, because it cannot** — `council_lost`
requires member inflation dispersion at 2.4 *and* fragmentation at 290 bp held
for five meetings, and the highest dispersion reached across 360 mandates is
1.85, under the play where fragmentation is lowest. Measured in
`dev/councilProbe.ts`, 0 of 60 in every cell. A fictional ECB presidency
currently ends only on the catastrophes, while the game tells the player they
can lose the room. QUESTIONS **#23**, with three options and the measurement
behind each.

Every meeting opens with an **order** — an imperative verb, a number to close
and the cost of inaction — and `order.test.ts` walks every meeting of every
mandate at both institutions and all three difficulties to prove it.

## The verified claims

Run these before believing anything above. **Every reading in this table was
taken on this commit**, which is a change in how to read it: the previous
version carried a "no sweep warnings" line that had been false since the
survival restructure and that nobody had re-run.

| | command | last reading |
| --- | --- | --- |
| build | `npm run build` | clean |
| tests | `npm test` | **1165 passing** |
| lint | `npm run lint` | 0 errors, 13 warnings |
| contrast | `npm run check:contrast` | 0 failures / **848 states**, both directions |
| classes | `npm run check:classes` | **288** names, all real |
| words | `npm run check:words` | quick 51-55 steady (cap 60), heavy 325-342 |
| offline | `npm run check:offline` | clean, all this origin |
| sweep | `npm run sim:sweep` | **6 balance warnings — see QUESTIONS #22** |
| instrument reach | `node tools/instrument.mjs` | every open instrument is on the desk |
| order only | `npm test` (`orderOnly.test.ts`) | **40/40** easy mandates served blind |
| cohesion floor | `npx tsx src/simulation/dev/cohesion.ts` | competent floor 1.88 / 1.79 / 1.92 |
| fragmentation | `npx tsx src/simulation/dev/fragmentation.ts` | the penalty by channel, and what the tool costs |
| guidance value | `npx tsx src/simulation/dev/guidanceValue.ts` | what speaking is worth, in points |
| the ladder | `npx tsx src/simulation/dev/ladder.ts` | how many meetings the ladder lasts |
| skill gradient | `npx tsx src/simulation/dev/skillGradient.ts` | does skill outlast idleness on hard |
| severity | `npx tsx src/simulation/dev/severity.ts` | a major costs 2.0–7.8× a minor |
| cadence | `npx tsx src/simulation/dev/cadence.ts` | longest calm run **2** everywhere |

## The first thing to pick up

**The game has two scores and they disagree about whether competence beats
passivity.** QUESTIONS **#22**, and it is the only open item that changes what
the game means.

`bankedTotal` is the headline on the result screen, earned meeting by meeting,
built so that being dismissed early stops paying. `calculateScore` is the
scorecard beside it and still grades **path averages**, which under a survival
structure rewards brevity — the exact defect banked scoring was written to
remove. The conversion stopped at the headline.

| ECB, competent vs passive | banked | graded |
| --- | --- | --- |
| medium | 2,611 vs 331 | 2,159 vs **2,318** |
| hard | 329 vs 40 | 1,278 vs **2,519** |

Both numbers are on the result screen, and the *graded* one is what the records
page compares and what every personal best is set on. It is also why
`npm run sim:sweep` reports six warnings; `main` reported the same six before
this pass, so they are not a regression. Three options are written up in #22,
in order of preference. It is a decision about what the score means, which is
the player's.

## The guardrails that now exist

Worth knowing before adding a fifth occurrence of something. **Four of these
were built after the same defect had already been recorded in the journal**,
which is the pattern: the habit gets written down, then the mechanism gets
built the next time the habit fails.

- `scoring/instrumentReach.test.ts` — **a component the score charges must be a
  component the player can reach.** Fails the build when a weighted component
  has none of its instruments available at a difficulty, and separately when
  the component does not move as the instrument does. Typed on both sides, so
  a renamed component or a misspelled instrument is a compile error rather than
  an entry that quietly matches nothing.
- `engine/ladder.test.ts` — the difficulty ladder outlasts the opening screen:
  the two targets stay ordered by difficulty through at least meeting 4
  (measured 6 and 5), and the growth guard breaks more than twice as often at
  hard as at easy.
- `engine/guidanceValue.test.ts` — speaking keeps you in the job. Tenure at
  medium, with the banked total beside it so tenure cannot be bought with
  worse meetings.
- `src/lintGuards.test.ts` fails `npm test` on a hook after an early return and
  on `opacity-*` applied to a text element — **and now checks the rule itself**,
  handing it three forms it must reject and one it must not. The fifth
  occurrence of the opacity defect got past the rule because a Tailwind variant
  prefix is not whitespace, so `disabled:opacity-30` was invisible to a pattern
  written for exactly that mistake.
- `tools/instrument.mjs` — `config/instruments.ts` claims "adding a tool never
  means editing a screen". This checks it: opens an ECB mandate at each
  difficulty, clicks through to the toolkit, and requires the instrument's
  label to be on the desk in both directions.
- `npm run check:classes` extracts every `className` token from `src/` and
  fails on any with no matching rule in the generated stylesheet.
- `quiet()` in `tools/drive.mjs` waits for real visual stillness — three
  identical frames of every inline style *and* nothing running in
  `getAnimations()`. Every tool inherits it.
- `order.test.ts`, `pressOptional.test.ts` and `tenure.test.ts` hold the three
  design rules that are stated as rules: every meeting commands, the press is
  never compulsory, and a longer good tenure outscores a short one.

## The audit's fourth blind spot, closed

The contrast audit walked every panel and never clicked a panel's **sub-tabs**.
`openPanel` lands the desk on "The case", so "The words" and "The toolkit" —
every instrument stepper in the game, the corridor, the facilities, the whole
balance sheet — were unaudited in both directions for as long as they have
existed. It found 2.3:1 on the stepper buttons the moment it looked.

It now walks every face of every panel and re-opens disclosures inside each
one, because a `<details>` inside a face that was closed during the page-wide
sweep is still shut. 664 states to **848**.

## The opening ladder

The difficulty is the **number of broken readings** at meeting zero, and it
holds on every seed (`initialState.test.ts`):

| | inflation | unemployment | growth | what it teaches |
| --- | --- | --- | --- | --- |
| easy | high | at sustainable | healthy | the lever works |
| medium | high | high | holding | no move fixes both |
| hard | high | high | falling | everything at once |

The triplet is **derived, not drawn**: the opening sets an output gap, and
unemployment follows through Okun while growth is potential plus whatever the
gap is still doing.

**How long it lasts is a different question, and it now has an answer**
(`dev/ladder.ts`, QUESTIONS #21). Counting all three readings gives one
meeting, and that is the wrong ruler — growth is declared a *guard* rather than
a target, and a guard nobody is pushing against should close. On the two
targets measured as a distance, the ladder is ordered through **meeting 6 on
the Fed and 5 on the ECB**; the guard breaks on 12-16 % of hard meetings
against 2-4 % of easy ones. Beyond meeting six the modes cross because hard
mandates *end* — mean tenure 12.5 against medium's 18.8 — so the late-mandate
ladder is tenure, not readings.

Hard's third reading is **not** held by the cut to trend growth, whatever
journal 22 says: the rebound out of a −5.5 gap is +4.6 points of growth against
a cut of 1.8, and the cut is floored at `POTENTIAL_GROWTH_FLOOR`, so below −1.2
it does nothing at all on the ECB.

## The ECB has an instrument for its own problem now

`transmission_protection` is open from **easy**, because `cohesion` carries 0.08
of the ECB's scorecard at every difficulty and the tool was withheld below
hard — a component billed in two modes that had removed the lever for it.

Decomposed in `dev/fragmentation.ts`, the penalty is three quantities and the
instruments reach one: inflation dispersion (0.50 at hard, nothing reaches it),
unemployment dispersion (0.63, nothing reaches it) and the sovereign-spread
range (**1.36**, three instruments reach it). The biggest channel is the one
that responds, so the component is now live and answerable: cohesion under
competent play runs 0.983 / 0.959 / 0.830 with the tool against 0.729 / 0.552 /
0.387 without it.

It is **not free**, which is what keeps it a decision: holding it at full costs
political pressure, and at medium eight meetings of tenure. Paired on the seed,
reaching for it when the area is coming apart banks 20 a meeting at hard
against 9 for never touching it; at medium it banks *less*, because the
instrument restores transmission and medium's economy is cost-push, so
restoring transmission transmits the cost rather than the cure.

## Open, in QUESTIONS.md

- **#22** the two scores, and the only item that changes what the game means.
- **#21** at ecb/easy a chair following the tutorial's lesson breaks the growth
  guard on 44 % of meetings against 29 % at hard — the tutorial punishes doing
  what it teaches. Fixing it is retuning a mode's character.
- **#19** the cohesion tolerance is corrected and now sits at the measured
  competent floor; lifting `POTENTIAL_GROWTH_FLOOR` is a balance change to
  ecb/hard that needs `dev/skillGradient.ts` re-run against it.
- **#3, #4** the Volcker disinflation and 1929's depth still miss, and both
  misses are now precisely located in the IS block rather than generally.
- **#7, #8, #13** the terminal's own decisions: the second direction, and
  radius and shadow going to zero globally.

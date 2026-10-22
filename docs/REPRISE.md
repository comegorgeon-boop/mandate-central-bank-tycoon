# Reprise

Where this is, in one page, for whoever picks it up next — including me.

## The branch

`direction-and-alerts`, merged to main. Main is live and the player validates
the screen before anything lands there.

| commit | what |
| --- | --- |
| `96093f8` | merge: coherent openings, a dial that costs, figures from the first meeting |
| `7823353` | an instrument for the component it is charged for, and three rulers that were wrong |
| *this one* | a game that says what it is for, one score, and an alarm that interrupts |

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

**What ends an ECB presidency is losing the Governing Council, and as of this
pass that is true rather than merely written here.** It could not fire: the old
condition wanted member dispersion at 2.4 *and* fragmentation at 290 bp at
once, and the two peak under opposite conditions — 0 of 60 in every cell, while
this page asserted it and the game told the player "you can lose the room". It
now fires on **sustained dissent by a bloc**: a third of the committee against,
for six consecutive meetings, the count resetting when the room comes back.
Measured, a competent chair never loses it and at hard is warned in 43 % of
mandates; neglect loses it in 65 to 92 %. QUESTIONS **#23**.

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
| tests | `npm test` | **1173 passing** |
| lint | `npm run lint` | 0 errors, 13 warnings |
| contrast | `npm run check:contrast` | 0 failures / **810 states**, both directions |
| classes | `npm run check:classes` | **297** names, all real |
| words | `npm run check:words` | quick **63-74** steady (cap **75** — re-based, see below), heavy 325-342 |
| offline | `npm run check:offline` | clean, all this origin |
| sweep | `npm run sim:sweep` | **2 balance warnings**, both diagnosed — QUESTIONS #24 |
| instrument reach | `node tools/instrument.mjs` | every open instrument is on the desk |
| order only | `npm test` (`orderOnly.test.ts`) | **40/40** easy mandates served blind |
| cohesion floor | `npx tsx src/simulation/dev/cohesion.ts` | competent floor 1.88 / 1.79 / 1.92 |
| fragmentation | `npx tsx src/simulation/dev/fragmentation.ts` | the penalty by channel, and what the tool costs |
| guidance value | `npx tsx src/simulation/dev/guidanceValue.ts` | what speaking is worth, in points |
| the ladder | `npx tsx src/simulation/dev/ladder.ts` | how many meetings the ladder lasts |
| council ending | `npx tsx src/simulation/dev/councilProbe.ts` | competent **0 %**, passive 65-92 %, warned 43 % at hard |
| bulletin rate | `npx tsx src/simulation/dev/bulletinRate.ts` | capped at **4 a mandate**, median 1-4 |
| skill gradient | `npx tsx src/simulation/dev/skillGradient.ts` | does skill outlast idleness on hard |
| severity | `npx tsx src/simulation/dev/severity.ts` | a major costs 2.0–7.8× a minor |
| cadence | `npx tsx src/simulation/dev/cadence.ts` | longest calm run **2** everywhere |

## The first thing to pick up

**The tutorial is still winnable by not pulling the lever it teaches.** At
fed/easy, doing nothing banks 2,876 against competent play's 2,860 — inside
seed noise — while completing 76 % of mandates against 100 %. So passivity
loses a quarter of its mandates and ties on the rest. Journal 21 recorded this
gradient as thin; it is still thin, and it is now one of only two balance
warnings the sweep reports.

The repair is an easy opening that does not heal itself, which is the mode's
character and therefore the player's call. QUESTIONS **#24** has it with the
other warning, which is the sweep measuring the wrong thing: "fed/hard: never
survived under any rule" asks whether the *full 64-meeting horizon* was
reached, and `config/tenure.ts` says in as many words that no mandate is meant
to reach it.

## The guardrails that now exist

Worth knowing before adding a fifth occurrence of something. **Four of these
were built after the same defect had already been recorded in the journal**,
which is the pattern: the habit gets written down, then the mechanism gets
built the next time the habit fails.

- **One score, by lint.** `calculateScore(...).score` — the old graded total —
  may not be read anywhere in `src/pages`, `src/features` or `src/components`.
  The defect was never a calculation; it was a dozen reasonable call sites,
  which together meant a fourteen-year mandate showed 5,437 banked beside 1,741
  graded and the records page ranked on the second. `scoring/theScore.ts` is the
  one definition.
- `scoring/reachable.test.ts` — **every ending the game announces must be an
  ending it can reach.** Plays 108 fictional mandates under three rules and
  fails if a listed condition never occurs, with every exclusion carrying its
  reason. It exists because `council_lost` was dead for as long as it existed
  while two documents asserted otherwise, and because `dev/gateProbe.ts` probes
  the *event* gates and nothing probed the end conditions.
- `features/meeting/lengthCopy.test.ts` — no screen may promise a mandate
  length the engine does not hold. Fails on any retired `MEETING_COUNT` value,
  on an institution whose real term is absent, on copy that states a length
  without saying that reaching it is not the expected case, and on a difficulty
  label containing a digit at all.
- `explain/bulletin.test.ts` — the interruption stays inside its per-mandate
  allowance on every seed, **and** can actually fire on more than one kind of
  thing. Both halves, because this feature has two opposite ways to be
  worthless.
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
  identical frames of every inline style **and the page's text**, nothing
  running in `getAnimations()`, **and 400 ms of continuous stillness**. All
  three conditions were added after a failure, and the last two this pass.
  `tools/play.mjs` called `page.screenshot` directly and inherited none of it,
  which is how an ECB report came to be photographed as "banked 0, a meeting
  35" — two numbers that cannot both be true over fifteen meetings. The total
  was 532. The 400 ms floor is the one that matters: the figure is a `Tally`
  with a 240 ms *delay*, so the page is genuinely still when `quiet()` samples
  it and the animation has not started yet. Stillness has to outlast the
  longest delay in the motion vocabulary, not merely exist.
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
sweep is still shut. 664 states to **788**.

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

## What the player is trying to do, in five lines

New this pass, because a first-time tester asked *"what is the goal, what am I
supposed to do"* **in a loop** — and the guided opening does not answer it,
because it guides the *decision* and not the *direction*.

`explain/orientation.ts` says it once, derived from the configuration so no
figure is written twice: you hold a mandate and not the economy; what it
requires of you; what your instrument does **and when**; how it ends; and that
you will never see the economy as it is, only as it was measured. The mandate
asymmetry is point two and is quoted rather than smoothed — the Fed's two
objectives "equal in law", the ECB's *without prejudice to* in the Treaty's own
words.

Two placements: the briefing, where it **replaces** the old mandate prose, and
a one-line `<details>` above both meeting surfaces, because a briefing read
once does not answer a question asked repeatedly.

## The alarm that interrupts, and what it cost to make it rare

`explain/bulletin.ts`. A major event, or something critical that has just
*become* critical: the post approaching revocation, the growth guard breaking,
a target coming badly adrift. Red or amber band, the headline, the three board
readings as a before-and-after, one line of what it means. Closes on the
button, Escape, or the scrim.

**Everything fires on a transition, never on a state**, and there are **four in
a career** — majors included. The first version exempted majors and
interrupted 18 to 27 % of meetings; journal 19 is why, having tripled the event
rate so the longest calm run is two meetings. Then the cap leaked, because it
was recomputed from history and `post_at_risk` fires off the end conditions,
which a history snapshot does not carry. The count now lives on the session and
the decision is taken in `submitMeeting`, so a replay produces the same
interruptions as the original run.

## The advisers' room was already built

Worth knowing before anybody rebuilds it. Selection by **maximum disagreement**
(`doctrines/debate.ts` — the two furthest apart, then a third furthest from
*both*), each school's reading of the live state with its recommendation in
basis points, rebuttals addressed to the other speaker **by name**, sources an
economist would accept, and a scoreboard settled by **counterfactual replay**
rather than opinion. All of it there.

What was missing was one gesture: `Open the room` left the player on the
newspaper, so the committee was three clicks away. It now opens onto the
committee arguing. QUESTIONS **#25** has the point-by-point.

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

- **#24** two balance warnings, both diagnosed and neither costing the player
  anything today: fed/easy's thin tutorial gradient, and the sweep asking
  whether a survival mandate reached a horizon nothing is meant to reach.
- **#21** at ecb/easy a chair following the tutorial's lesson breaks the growth
  guard on 44 % of meetings against 29 % at hard — the tutorial punishes doing
  what it teaches. Fixing it is retuning a mode's character, and it is the same
  mode as #24's first warning.
- **#14** the quick-surface cap is re-based to 75 because the ruler was wrong,
  not because prose was added: the count never covered the order banner. The
  two cheapest cuts named there are unchanged and now worth more — the three
  gauge captions (11 words, the distance is already drawn as a bar) and the
  standing call (7, could be a label).
- **#19** the cohesion tolerance is corrected and now sits at the measured
  competent floor; lifting `POTENTIAL_GROWTH_FLOOR` is a balance change to
  ecb/hard that needs `dev/skillGradient.ts` re-run against it.
- **#3, #4** the Volcker disinflation and 1929's depth still miss, and both
  misses are now precisely located in the IS block rather than generally.
- **#7, #8, #13** the terminal's own decisions: the second direction, and
  radius and shadow going to zero globally.

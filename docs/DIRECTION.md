# Design direction, from the phase-3 playthroughs

Recorded after three full Fed/easy mandates. **Nothing here was implemented
when recorded; point 1 is now built, engine and desk**, **point 2's easy
column is now built and hard's is half built**, **point 4 is now built**, and
**a point 4b has been added for the difficulty work that followed** — see "The
second instrument", "Violent named events, and markets that answer them" and
"The three difficulties, and the kind of problem each one sets" in
docs/BALANCE.md for the mechanisms, the measurements and what each shipped
against. This file exists so the findings survive while they are fresh; the
balancing work in docs/BALANCE.md is separate and must not be confused with
it.

The order below is the player's, not a priority ranking imposed afterwards.

## The central finding: the game is boring, and it is no longer a legibility problem

> "Between two meetings I barely read the numbers, I click hold or increase, and
> it is always the same choice. There is one lever with three positions. No
> amount of realism makes a button interesting."

This supersedes the working assumption that the game's problem was legibility.
Phase 3 made the state readable — the stance strip, the changes panel, the
diagnosis, the reaction screen — and the result is a legible game with nothing
to decide. **A decision problem needs more than one axis**, and no further
polish on the presentation of a single axis will produce one.

Everything below follows from this.

## 1. More instruments, earlier — starting with communication

The specification plans the full toolkit but gates it behind medium and hard.
The effect is that **the only mode a new player can reach is the one with
everything that makes it a game removed**. `config/instruments.ts` currently
opens easy with the policy rate alone.

**First addition: communication and guidance.** Chosen over the balance sheet
and the liquidity facilities for three reasons:

- It creates a **second axis of decision** — what you say against what you do —
  rather than a second magnitude on the same axis.
- It **wakes up credibility**, which currently never moves in an easy mandate.
  `INSTITUTIONAL.credibility` responds to guidance reversals and to
  contradictions between the words and the decision, and a build that collects
  no communication package can trigger neither. This was already noted in
  docs/BALANCE.md point 2: "with no communication instrument in this build, a
  rate decision moves almost nothing observable on the day... the fast channel
  exists, but for a rate-only decision it is one latent variable wide."
- It **makes the market react**, which is the channel the player found most
  interesting (see 3).

The engine side largely exists: `COMMUNICATION` in `config/model.ts`,
`applyPolicyPackage`'s tone and guidance handling, and `GuidanceState`. What is
missing is the desk that collects it and the difficulty gate that allows it.

## 2. The opening state is badly chosen

> "We open on a moderately damaged economy: neither healthy enough to see what
> breaks it, nor degraded enough to have a mission."

`engine/initialState.ts` perturbs one central starting point for every
difficulty. **Decision taken: one deliberate opening per difficulty.**

- **Easy — built.** A *healthy* economy (`OPENING_PERTURBATION_SCALE`, 0.15
  against medium/hard's unchanged 1). Then **a major, named event at the very
  first meeting** that upends it (`events/openingCrisis.ts`, one of six major
  events added to `events/catalog.ts`, drawn per seed). The player sees the
  baseline, sees the cause, and knows what to repair. Full mechanism and
  measurements in docs/BALANCE.md, "Violent named events, and markets that
  answer them."
- **Hard — half built.** Hard now has **no identifiable culprit**: no scripted
  opener (`openingCrisisCharacters` is null there), and neither the shock's
  name nor the assembled evidence. What is still missing is the *damaged
  opening state* — inflation entrenched, credibility eroded before the first
  meeting. `OPENING_PERTURBATION_SCALE` still gives medium and hard the same
  ambient perturbation this section originally complained about.

Note how well this fits the information ladder already recorded in
docs/BALANCE.md: easy names the shock, hard does not. This turns that ladder
from a property of the interface into a property of the scenario.

It also bears on a measurement problem. Balance work has been measuring the
*median seeded opening*, which under the current construction is exactly the
"moderately damaged" state the player is describing. A designed opening makes
the balance question sharper, not just the play. — **Live for easy**: since
easy's opening is no longer the ambient perturbation, a plain
`createInitialState` on easy is no longer a calm baseline by default; tests
that need one pass `{ openingEvent: false }`. Medium and hard are unaffected
and still describe the ambient, un-designed opening this section originally
complained about.

## 3. The market is the most promising direction

> "It is what reacts immediately to my decisions and it is what I find most
> interesting."

To explore: make it **a real channel of play, with visible reactions and
consequences, rather than a table of numbers**. The raw material is already
there and already fast — `marketVolatility`, `marketExpectedRate`,
`marketTrust`, the policy surprise in `applyPolicyPackage`, and the priced path.
The reaction screen surfaces a sliver of it.

This is the natural companion to 1: communication is the instrument, the market
is what answers back, and the two together are the second axis the game lacks.

**A first real instance built.** `crisisIntensity(latent)` in
`applyPolicyPackage.ts` makes the market's *response* to a decision depend on
the market's own state, not only on the decision: the same words move
markets a bit over twice as hard once a major event (point 2) has markets
keyed up, reassurance only pays when backed by action, and silence during a
real panic now costs. This is still a same-meeting mechanic — it does not
yet make the market something the player *reads and times*, a step ahead of
the decision, which is what "a real channel of play" ultimately means. That
remains open. Full mechanism and measurements in docs/BALANCE.md, "Violent
named events, and markets that answer them."

## 4. The final screen should be a written account of the mandate — built

What happened, what the player did well, what they got wrong, and **why they
have the score they have**. Numbers in support, not as the headline.

`features/result/report.ts` assembles this from a finished session's own
data (`eventLog` for what happened, each score component's own prose
`explanation` for the verdict, the guidance ledger, the causal chain on a
failure) with the same deterministic-template discipline as
`features/meeting/brief.ts`. `pages/ResultPage.tsx` now leads with it,
directly under the header; the score number and component table are
demoted to a "Scorecard" section below. Verified in a real browser end to
end, zero console errors. Full detail in docs/BALANCE.md, "Violent named
events, and markets that answer them."

## 4b. The information ladder, and what difficulty is actually made of — built

Recorded here because it changed what "difficulty" means in this game, not
just how much of it there is. The session that built it found that the
structuring axis was missing entirely: the *kind* of shock a mode serves.
Easy drew its mandate-opening crisis uniformly over six majors, two of which
are pure cost-push, so a third of tutorials opened on stagflation — and,
measured, the draw decided more than half the final score before the player's
first decision.

Every event now declares what it asks of the committee (`shockCharacter`), and
three difficulty parameters read it: which problems a mode is fed, whether
they may pile onto one another, and which may open a mandate at all. Easy
serves the problems that have a right answer; hard is made of the ones that do
not. Full mechanism and measurements in docs/BALANCE.md, "The three
difficulties, and the kind of problem each one sets".

The same session implemented the information ladder this file and
docs/BALANCE.md had both recorded as settled since phase 3 and which the code
did not have — medium was getting neither the shock's name nor its evidence —
built hard's divided committee, opened the balance sheet and the facilities
that had been configured since the toolkit was written but never rendered, and
gave hard the free tone that makes bluffing possible at all.

## 5. A summary tab is missing — largely answered

The state of the economy at a glance, what to watch, with charts.

**Answered from two directions rather than one tab.** The Markets panel is the
glance — every number on it is a price, observed exactly and published with no
lag, so it is where a decision and a crisis both show up first — and the
standing reading above the tabs says how the mandate is going in a sentence
and names why. A trend chart now sits under every published indicator, and the
between-meetings time-lapse shows the fast channel moving in the quarter it
moves in. What is still missing is a single screen that holds all of it at
once, which may or may not be worth building now that its contents exist.

## 6. Too much information

> "I use only two or three numbers. A number the player cannot act on is noise."

On easy, show only what changes a decision; relegate the rest. Note the tension
with 5, and that it is only apparent: a summary is not more numbers, it is
fewer numbers arranged so they answer a question.

Note also that this cuts against the current `SERIES` list, which publishes
everything at every difficulty and distinguishes them only by noise and lag.

## 7. The interface will need to look good, but later — built

Explicitly not a priority when this was written, and then the priority: the
player's verdict after the difficulty work was "it is fair, it is measured, it
is illegible and it is flat".

Built as a two-layer token system — named materials, then semantic roles, so no
component names a colour — in a boardroom of dark walnut, brass, cream paper,
deep green and burgundy, with the reading surfaces on paper because that is
what made it legible. Two directions ship and the choice is in the settings.
Every text node on every screen clears WCAG AA in both, verified by an audit
that walks the rendered page rather than by inspection.

The three things that made it a *game* rather than a dressed spreadsheet are
recorded here because they were design decisions, not styling:

- **The interval between meetings plays out.** Four frames, one per internal
  sub-step, showing only the exactly-observed market prices — because those are
  the only series a player could really watch move. Inflation is deliberately
  absent, and its absence teaches the lag this whole game is built on better
  than any panel of text.
- **The confirmation screen projects the whole package**, by running the engine
  forward twice and differencing, with the counterfactual beside the outcome.
- **A mandate going well says so, and names why.** The interface used to signal
  only danger, which made its best outcome the absence of feedback.

## What this implies for the balance work

Recorded here rather than in docs/BALANCE.md because it is a consequence of the
design direction, not a measurement:

**Every balance number measured so far describes a one-instrument game.** The
sweep, the feasible frontier, the winnability bars — all of them play the policy
rate and nothing else. When communication lands, the reachable frontier moves,
because guidance pulls `expectedInflationShort` directly through
`EXPECTATIONS.guidancePull` rather than waiting on the output gap. That is a
second transmission channel with a much shorter lag, and it may resolve the
"policy is too slow to matter inside a mandate" problem more cleanly than any
further tuning of the rate channel.

**Do not spend more effort tuning the rate channel in isolation before this is
decided.**

---

# Design direction, from the session that fixed score discrimination

Recorded after the session that made sabotage actually cost something (see
docs/BALANCE.md, "Conduct has to cost, independent of the economy"). **Not
implemented.** The instruction for that session was explicit: write this
direction down for the next one, build none of it today.

## Doctrines

The player adopts a school of monetary-policy thought at the start of a
mandate — a Taylor rule, strict inflation targeting, Keynesian discretion,
credibility-first, monetarism — and it shapes the whole mandate:

- **A reading grid.** Which published indicators the doctrine puts in front
  of the player first — a monetarist's brief leads with money and credit
  aggregates, a Keynesian's with the output gap and unemployment, an
  inflation-targeter's with the inflation print and expectations.
- **A recommended reaction function.** The doctrine's own version of the
  Policy Desk's staff advice (`policy/staffRule.ts` is the obvious base to
  branch from) — what *this* school of thought would do with the published
  data, not the single hand-written rule every difficulty currently shares.
- **Its own score weighting.** A doctrine-specific variant of
  `SCORE_WEIGHTS` (`config/scoring.ts`) — a credibility-first doctrine
  should weight the credibility component far more than a strict
  inflation-targeter's price-stability-above-all weighting, for instance.

**Switching doctrine mid-mandate costs credibility** — declaring a school of
thought and then abandoning it partway through a mandate is itself a kind of
broken promise, thematically continuous with tonight's conduct gate and the
existing guidance promise ledger, and probably reusable machinery from both.

**The score judges two axes, not one: the outcome, and consistency with the
announced doctrine.** A player who commits to monetarism and then reacts like
a Keynesian discretionist every meeting should be marked down for the
incoherence independent of how the economy turned out — the same principle
tonight's conduct gate applies to reversals and contradictions, generalised
from "did you contradict your own words" to "did you contradict your own
declared framework."

**The postmortem compares.** At the end of a mandate, the written report
(`features/result/report.ts`) should show what the *other* doctrines would
have scored on the identical seed — the same shocks, the same starting
economy, a different reaction function applied throughout — and, separately,
how the mandate compares to a real historical episode the played path
resembles. This is the single biggest lift in the idea: it means being able
to *replay* a finished mandate's seed under a different policy end to end,
which the engine can already do in principle (`playRun` takes a policy
callback and a seed-derived `RunConfig`) but which has never been asked to
run four or five times over for one result screen, still within a
static-only, no-network, no-LLM build.

**Why this, specifically.** In the player's own words: make the game "both
fun and grounded in the ESH curriculum" — the French classes préparatoires
economics syllabus, where these named schools of monetary thought (Taylor,
monetarist, Keynesian, etc.) are literally the material. A doctrine system
is the first design idea recorded in this file that ties the game mechanics
directly to that syllabus rather than to central banking in the abstract.

Open questions for whichever session picks this up: how many doctrines ship
first (five is the player's list, but even two or three with real
differentiation would prove the mechanic before building all five); whether
doctrines are available from easy or gated to medium/hard, given easy is
still explicitly a single-instrument, single-rule tutorial per the sessions
that built it; and how "consistency with the doctrine" is actually measured
mechanically (nearness to the doctrine's own recommended reaction function,
each meeting? a cumulative drift measure, closer to how the conduct gate
reads `contradictionCost`?).

## Three smaller ideas, recorded but not designed

- **A dated objective, announced at every meeting.** Not just a rate path
  (`forward_guidance` already covers that) but a public, time-bound target —
  "2% inflation by meeting 8" — that the postmortem can later judge as met,
  missed, or abandoned. Distinct from the existing guidance promise ledger,
  which is about the *rate*, not the *objective* the rate is meant to serve.
- **A press conference after the decision.** A pointed, uncomfortable
  question and a multiple-choice response — the natural next step for the
  desk beyond the current single statement, and a second, harder-edged
  instance of the plain-language "sentences, not parameters" register rule
  the communication desk already uses.
- **A committee vote that can unseat the player.** Distinct from the
  existing `dismissed` end condition (a sustained collapse in credibility,
  evaluated automatically): a committee that can vote no confidence gives
  the institution's *other* members a voice, which nothing in the game
  currently has.

---

# Historical scenarios

Designed in this session, one built. **The design, the sources and every
number are in `docs/SCENARIOS.md`**, which is the authority: the Volcker test
parses that file and fails if the code disagrees with it.

What belongs here is the decision the scenarios embody, because it applies to
all five and to anything added later.

## Difficulty is not a setting; it is the year

A historical scenario has **no difficulty chooser**, and this is the design
rather than a simplification of it. Difficulty is *what was known at the time*,
and it was different in every year because the statistical system was different
in every year. A chairman in 1929 had no official national income statistic and
read bank conditions weeks late. A chairman in 2021 had excellent data,
released on schedule, and was wrong anyway. Offering to make either of those
harder would be offering to make the past more uncertain than it was.

So a scenario replaces exactly two things and inherits everything else from an
ordinary difficulty profile it names:

1. **the opening state**, which becomes a sourced table rather than a seeded
   draw, and
2. **the measurement regime**, which becomes the year's — including, where the
   sources support one, a *systematic bias* in a published series rather than
   more noise.

Everything that is not measurement — instrument ranges, the information
ladder, the scoring weights — stays with the named difficulty, so a new
scenario is a data file and not a second copy of the balance sheet of
constants. Where a period genuinely needs its own structure (1979-83 needs a
steeper transmission and a flatter Phillips curve), the scenario carries it as
a named, argued parameter and `docs/SCENARIOS.md` says whether it is sourced or
calibrated. Most of them are calibrated, and the document says so in those
words.

## The honesty rules

Non-negotiable, and they are the reason this took the time it took:

- Opening states and dates are **sourced**, with the series named. Anything
  derived is labelled a derivation and the derivation is given. Anything
  approximated is labelled an approximation in the document *and* in the code.
- **No words in anybody's mouth.** What people did is in the game. What they
  said is not, unless a sourced quotation carries its citation — and the
  Volcker scenario has none, by choice, because the cost of getting one wrong
  is higher than anything a quotation adds. A test forbids quotation marks and
  attribution verbs in scenario prose.
- **The documented table is the authority.** `volcker.test.ts` parses
  `docs/SCENARIOS.md` and compares it to the code row by row. Edit either and
  the other fails.
- **The fit is reported, including where it is wrong.** The model's replay of
  the historical policy path is compared against what happened, with the
  misses named and quantified.

## The seven, all built

1929-33 · 1972-74 · 1979-83 · 2008-10 · 2010-12 · 2021-23 twice, once from
each seat. Seven mandates across six periods, every number in
`docs/SCENARIOS.md`, every calendar generated from the published series by
`tools/scenario-data.mjs` rather than typed, and every one of them locked to
that document by a test that parses it.

**1972-74 is the sixth period and the last one added.** It is the only one in
which the political pressure can carry names, because it is the only one where
the record is public — and it still quotes nobody and names nobody on any
screen the player sees. What makes it hard is a published inflation number
held about a point below the truth by price controls, against a real-time
output gap reading about two and a half points too high; both tell the
committee there is room, and there is not. It is also the only scenario that
sets `opening.politicalPressure`, which was added for it.

Three mechanics were added for these and all three generalise:

- **A metallic standard**, as a floor on the rate that the player can see on
  the dial and cross at a price. It is a schedule rather than a constant, and
  the schedule is the point: it steps up when Britain leaves gold in September
  1931, which is why the Federal Reserve raised into the third year of a
  depression and the one moment the 1929 scenario exists to make playable.
- **An opening political pressure.** One field, set by one scenario, for the
  period whose whole subject is an administration leaning on a chairman from
  the first meeting. Everything downstream of it — the government's demands,
  the expectations channel, the revocation gauge — already existed.
- **A per-scenario objective.** The Federal Reserve of 1929 had no inflation
  target; what it had was a dollar convertible into a fixed weight of gold,
  which is a commitment to a stable price *level*. Running that mandate against
  2 % was not a small anachronism — every expectations block in this engine
  pulls inflation toward the objective, so a 2 % objective in 1931 pulls a 10 %
  deflation upward and the scenario stops being a deflation.

And one model defect they exposed, which was general and is now fixed:
**credibility could be lost but not earned by a chairman who inherited a
disaster.** The 1979 path fell from 45 to 0 over three years of a real policy
rate above +3, and since expectations are pulled toward the objective in
proportion to credibility, the falling credibility raised inflation, which fell
credibility further. The inflation miss is now charged against a glide path
from what was inherited, above a four-point deductible so no ordinary mandate
is touched.

## Deferred

The player **adopting** a doctrine, which was explicitly put off: later, not in
that chantier.

---

# Political pressure, the public finances, and the scenario that is missing

Built. What is recorded here is the design, because it constrains anything
added later.

## Political pressure changes three things, and none of them is the economy

Not a tax on growth, not a term in the Phillips curve. It changes **what
markets anticipate** (a bank suspected of being about to give in has its
anchor discounted before it has done anything), **the chance of being
removed**, and **credibility, if you give in** — which is the part that needed
building, because until now there was no way to give in.

A demand is therefore a question with two answers and no third, both of them
priced on screen before either is chosen. A dilemma whose two sides are not
both legible is a trap, and a trap teaches nothing except to reload.

## The public finances are not in the mandate

Nothing in `calculateScore.ts` reads the debt ratio, the deficit or the
interest bill. They reach the mandate through the event generator — a
fiscal-dominance episode is drawn more readily as the ratio climbs — and
through the pressure gauge. A central bank graded on the deficit would be a
treasury.

What *is* the player's is one line: debt service, which follows the average
coupon on the stock, which converges on the rate they set at a speed set by
the average maturity. The panel marks that row and no other.

## The council influences; it does not veto

Settled, and recorded here because it is the kind of decision a later pass
would reopen without noticing what it costs.

The committee votes on the package the chair confirmed. The dissents are
published under the wing that cast them, with what that member would have done
instead, and a committee that cannot hold a majority behind its own policy
costs credibility — nothing for unanimity, nothing for a single dissent, and a
charge per voice after that. **What it cannot do is refuse.**

The reason is not realism, though realism agrees: the FOMC chair has been
outvoted once since the 1930s, and a central bank committee's power has always
been the published record rather than the ballot. The reason is that **a
council that blocks removes the one lever the player actually has.** Every
panel in this interface exists to inform a decision the player then makes; the
score measures the path that decision produced; the historical comparison is
"your mandate against what they did". A game whose central control can be
refused by an adviser is a game about managing advisers — a good game, and not
this one.

And this whole project has been fought against the feeling of having no
control. The lag kernel was made visible for it. The counterfactual arms were
built so "without your rises, inflation would be at 6.2 %" could be an exact
statement. The living projection exists so the consequence moves while the
cursor does. Handing the committee a veto would undo all of that in one field.

So the vote **prices** the decision rather than taking it. A chair who ignores
the room pays for it in credibility and in a record the market reads as a
policy that may not last — which is a cost, and a cost is a mechanic. A veto
is not a cost; it is an absence of the game.

## Nixon and Burns — built, on the terms set here

**1972-74.** The one nameable case, documented to the tape, and the obvious
home for the political-pressure mechanic: a mandate whose subject is a demand
that arrives from the first meeting. It is now built, and the honesty rules
were applied unchanged. What the office did is in the game; what either man
said is not, even where a recording exists, because a scenario that quoted one
person and no other would be making an argument about *him* rather than about
the institution. Two tests enforce it: one forbids quotation marks and
reported speech anywhere in the scenario's text, the other forbids either
surname appearing on any screen the player reads.

The period also does not settle whether the chairman gave in. That is
contested, and the game declines to decide it. What it does instead is put the
same pressure in front of the player and record what *they* do — which is the
only version of the question a game can honestly ask.

## The five defects of the restructure, and what would make them impossible

Written down because **four of the five were mistakes this project had already
made and already recorded**, and a lesson that has to be learned twice was not
learned. A journal entry is a memory. What is wanted here is a mechanism.

Each defect is given with the entry that recorded it the first time, and with
the check that would stop it recurring. Where that check does not exist yet it
says so: a proposed check written down as though it were built would be the
same failure one level up.

### 1. Paper tokens on a walnut surface — **recorded, journal 1**

`StakeChips` was built on `bg-inset` using `text-ink*` and `text-good-strong`.
`bg-inset` is walnut in **both** directions — the one surface in the token file
that does not flip — so the panel rendered dark on dark and was unreadable.

The identical mistake took down the Volcker operating-procedure panel at
1.09:1 and is the first entry in this project's journal. It then happened a
*second* time within the hour in `DecisiveBanner`, where the fix for an
unrelated contrast failure used `on-accent-surface-soft`, which is ink, on the
same walnut surface.

**Caught by:** the contrast audit, both times, and only because the state was
reached.

**What would make it impossible:** a static check, which does not exist. A
test that reads the source for a `className` containing both a dark-surface
class (`bg-inset`, `bg-room`, `bg-page`, `bg-sunk`) and a paper-text class
(`text-ink*`, `*-strong`), or the reverse pairing, and fails naming the file.
It is a grep. It needs no browser, no screen state, and no walk to reach the
panel, which is the whole point: the audit only finds this where a walk
happens to go.

### 2. One quantity stated in three places — **new in this form**

The move's distance from the priced path was stated by the slider's sentence,
by a paragraph on the desk and by a third on the confirm screen — all three
measuring against the **whole** priced gap, where the engine charges against
35 % of it. The three agreed with each other and disagreed with the model, so
no amount of reading the interface would have revealed it.

It is new as a specific failure and old as a principle: `records/achievements.ts`
already carries the rule in its own doc comment — *a counter kept in the
interface is a second source of truth about a world the engine already fully
describes, and the first time the two disagree the player is right and the
game is wrong.*

**Caught by:** looking at a screenshot, by eye, because two sentences on one
phone screen contradicted each other.

**What would make it impossible:** nothing automatic, and that is worth
admitting. The structural fix is the one applied — a derived quantity gets
**one** exported function and every surface calls it (`meeting/surprise.ts`,
`pricedMoveBp`). The discipline is: if a number appears on two screens, it is
computed in neither of them.

### 3 and 4. Content that cannot fire — **recorded, journal 8**

Two instances in one pass.

The **verdict band** compared the same-day observation pair, where prices
cannot have moved, because an index does not respond to the afternoon a
decision is taken. It returned "mixed" every single time, so it never once
appeared.

The **wager** accepted a new call at every meeting, which replaced the
outstanding one before it could mature. No call ever came due, the credibility
never moved, and the reveal was unreachable code inside a feature that looked
finished.

Journal 8 records the same class three times over: three chain gates that
could never open, one of them testing an index near 100 as though it were a
percentage. The entry's own conclusion was *"tests check what code does; none
of them notices what it never does."*

**Caught by:** playing it and noticing nothing happened. Both would have
survived the full suite indefinitely.

**What would make it impossible:** a reachability test per gated outcome,
which is the defence this project keeps building piecemeal — `chains.test.ts`
for event chains, `tempo.test.ts` for the wager, the arc test for scenarios.
The general rule has never been written down, so here it is: **every branch
that produces player-visible content owes a test that reaches it**, and the
test belongs beside the branch, not in a suite somewhere that happens to
exercise it.

### 5. Measuring a screen before it arrived — **recorded, journal 5**

Every browser tool returned the moment an element was `isVisible`, which is
true on its *first painted frame*. Panels here enter with `animate-rise`,
which starts at opacity zero, so a full-mandate capture showed the standing
line — the one carrying the severe warnings — as an empty gap.

Journal 5 records the board photographing a doctrine's argument at about a
third opacity and the contrast audit measuring the declared colour of text
being painted at a fraction of it. The fix then was `settleAnimations`; the
hole left was that *arrival* and *visibility* are different questions.

**Caught by:** looking at a capture and seeing a gap where a panel should be.

**What made it impossible:** this one is actually closed. `settleMeeting` in
`tools/drive.mjs` now waits two animation frames before reporting a meeting,
so every tool in the repository inherits it — the board, the audit, the
playthroughs, the guide walk. A fix in the shared driver rather than in four
callers is the shape the other four want.

### The pattern, stated once

Four of the five are the same failure wearing different clothes: **something
that cannot happen, in code that reads as though it happens.** An invisible
panel, a band that never appears, a wager that never settles, a capture of a
frame nobody sees. All four pass every test that asks what the code *does*.

The one defence that has worked, every time, is the one this week was run on:
**state the criterion as a number, then write the thing that tries to falsify
it.** `dev/twoLines.ts` does not check that the sentence is good; it plays
forty mandates reading nothing else. `dev/gateProbe.ts` does not check that a
gate is sensible; it measures how often it is open for two populations.
`check:offline` does not check that nothing failed; it cuts the wire.

A check that can only confirm is not a check.

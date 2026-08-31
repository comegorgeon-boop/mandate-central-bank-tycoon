# Design direction, from the phase-3 playthroughs

Recorded after three full Fed/easy mandates. **Nothing here was implemented
when recorded; point 1 is now built, engine and desk**, **point 2's easy
column is now built**, and **point 4 is now built** — see "The second
instrument" and "Violent named events, and markets that answer them" in
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
- **Hard — not yet built.** An economy already badly damaged. Inflation
  entrenched, credibility eroded, and **no identifiable culprit**. Medium and
  hard were explicitly out of scope for the session that built the easy
  column; this remains open.

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

## 5. A summary tab is missing

The state of the economy at a glance, what to watch, with charts.

## 6. Too much information

> "I use only two or three numbers. A number the player cannot act on is noise."

On easy, show only what changes a decision; relegate the rest. Note the tension
with 5, and that it is only apparent: a summary is not more numbers, it is
fewer numbers arranged so they answer a question.

Note also that this cuts against the current `SERIES` list, which publishes
everything at every difficulty and distinguishes them only by noise and lag.

## 7. The interface will need to look good, but later

Explicitly not a priority.

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

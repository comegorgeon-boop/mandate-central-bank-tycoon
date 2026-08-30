# Design direction, from the phase-3 playthroughs

Recorded after three full Fed/easy mandates. **Nothing here was implemented
when recorded; point 1 is now built, engine and desk** — see "The second
instrument" in docs/BALANCE.md for the mechanism, the measurements and the
falsifiable criterion it shipped against. This file exists so the findings
survive while they are fresh; the balancing work in docs/BALANCE.md is
separate and must not be confused with it.

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

- **Easy** — a *healthy* economy. Inflation and unemployment under control. Then
  **a major, named event at the very first meeting** that upends it. The player
  sees the baseline, sees the cause, and knows what to repair.
- **Hard** — an economy already badly damaged. Inflation entrenched, credibility
  eroded, and **no identifiable culprit**.

Note how well this fits the information ladder already recorded in
docs/BALANCE.md: easy names the shock, hard does not. This turns that ladder
from a property of the interface into a property of the scenario.

It also bears on a measurement problem. Balance work has been measuring the
*median seeded opening*, which under the current construction is exactly the
"moderately damaged" state the player is describing. A designed opening makes
the balance question sharper, not just the play.

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

## 4. The final screen should be a written account of the mandate

What happened, what the player did well, what they got wrong, and **why they
have the score they have**. Numbers in support, not as the headline.

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

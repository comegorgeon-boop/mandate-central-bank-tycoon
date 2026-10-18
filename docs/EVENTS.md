# The event catalogue

## What was wrong, and it was not the number

The catalogue had **33 events**. It now has 36. The number was never the
problem.

The problem was that they were *incidents* rather than *episodes*. Of the 33,
exactly two had a follow-up and exactly two required a predecessor — the same
two pairs. The chaining machinery (`followUps`, `requires`, `isEligible`) was
built, used once to prove it worked, and then thirty-one events were written
without it. A mandate was a sequence of unrelated accidents: an energy spike in
meeting 4 had no bearing on anything in meeting 7, and nothing the player did
between them changed what arrived next.

The one pair that was done properly said exactly what the rest should be:

```ts
// bank_funding_scare
followUps: ['deposit_flight'],

// deposit_flight
// Only reachable after a scare, and only if stress was not contained.
isEligible: (ctx) => ctx.latent.bankingStress > BANKING.base * 1.6,
requires: ['bank_funding_scare'],
```

Two lines, and the second is the whole design: **the successor fires only if
the player failed to contain the first.** A governor who lent into the scare
never sees the deposit flight. One who sat on their hands does.

**13 events now declare a follow-up and 5 require a predecessor.**

## The rule a chain follows

1. **An onset.** Routine, moderately weighted, usually with a `clue` published
   a meeting ahead.
2. **An escalation**, which `requires` the onset and whose `isEligible` tests
   the variable the player was supposed to have brought down. If they did, it
   is unreachable.
3. **A resolution** — the relief — whose *weight* is multiplied when the onset
   fired, the escalation did not, and the variable has come back.

Point 3 is not decoration and it was not in the first draft. An escalation on
its own makes failure cost something; it makes success merely *less bad*,
which is not a reward and does not feel like one. It also keeps the draw
honest: at hard an event fires most meetings, so the probability is fixed and
the catalogue is a **mix**. Three adverse second acts added to a fixed-size
draw do not add events, they *displace* them, and the mix shifts adverse for
everybody — including the player who contained the shock. Measured, that cost
competent play seven points of completion. Weighting the relief gives the
balance back where it was earned instead of flattening it everywhere.

## Gates are measured, never chosen

A containment gate is only a gate if the two populations fall on opposite
sides of it. All three of the first draft's gates failed this, in three
different ways, and `dev/gateProbe.ts` is what found it:

| Gate as first written | What it did |
| --- | --- |
| `expectedInflationShort > 3.2` | Open on **22.8 %** of competently played meetings against **25.4 %** of passive ones. Not a containment test — a tax. |
| `expectedInflationLong > 3.0` | **Unreachable.** Long expectations reach 2.46 at the 90th percentile of competent play and 2.57 of passive play. The event could never fire. |
| `exchangeRate < -6` | **Unreachable.** `exchangeRate` is an index around 100, not a percentage deviation. |

The replacements, and what they measure at fed/hard:

| Gate | Skill | Passive | Ratio |
| --- | --- | --- | --- |
| `expectedInflationShort > 4.0` | 9.5 % | 14.4 % | 1.53 |
| `expectedInflationLong > 2.5` | 7.7 % | 12.7 % | 1.65 |
| `exchangeRate < 85` | 12.9 % | 26.2 % | 2.03 |

Run `npx tsx src/simulation/dev/gateProbe.ts` to re-measure; edit `CANDIDATES`
to ask about a different one.

## What it did to the balance

Paired survival, same seed, competent play against doing nothing, 240 seeds
(`dev/skillCheck.ts`). "Paired" counts only the seeds where one survived and
the other did not, which is the only question worth asking.

| | Before the chains | After |
| --- | --- | --- |
| fed/hard completion, skill vs passive | 63.7 % / 50.0 % | 64.6 % / 49.2 % |
| fed/hard paired | 43 / 10 | **46 / 9** |
| ecb/hard completion, skill vs passive | 63.7 % / 51.7 % | 60.4 % / 48.3 % |
| ecb/hard paired | 60 / 31 | **55 / 26** |

Both institutions ended with a *larger* skill edge than they started with.
Hard is a little harder on the euro area, which is the intended direction: the
mode is made of problems that have no right answer.

The intermediate measurements are worth keeping, because they are the argument
for every piece of the design above. With the escalations in and no relief
weighting, fed/hard paired was 35 / 15 and completion fell seven points. With
the relief weighted on "the variable is fine *right now*" rather than "the
episode was survived", euro-area **passive** completion *rose* three points —
the reward was going to everybody, because the variable is fine on most
meetings for most players.

## Two things this must not do

**It must not make the game a puzzle with a solution.** Every containment test
is a threshold on a latent variable, never a check for a particular policy. A
player who brought banking stress down by cutting, by lending, or by having
been lucky with the seed is spared equally.

**It must not gate good news.** `character.test.ts` recorded the reasoning
before this pass and it still governs: a relief that needs a predecessor is a
relief the player may never meet, and the worse the shock the less able the
economy would be to recover from it. Escalations carry `requires`; reliefs
never do — they are *weighted* by the episode instead, which changes how often
they come without ever making them impossible. `chains.test.ts` enforces it.

## The majors are ungated, deliberately

The six `tier: 'major'` events are also drawn as **opening crises**, before the
first meeting and therefore before any predecessor can exist. A `requires` on
one would make it unreachable mid-mandate rather than merely rarer. Their
chain lives in the weight instead (`afterOnset`), so a systemic bank failure
out of a clear sky stays possible — because it is — and becomes three times
likelier as the third act of a run that was not contained.

## A follow-up must be one

`followUps` only unlocks; nothing in the engine requires the target to care.
So an id listed there that no other event gates or weights on reads in the
source like a designed consequence and behaves like none. **Half the links
added in this pass were exactly that** until `chains.test.ts` grew the test
that forbids it: every follow-up target must either `requires` its source or
name it in its own weight.

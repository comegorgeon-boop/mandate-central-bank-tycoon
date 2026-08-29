# Open balance question

**Status: direction retained. Point 1 implemented; points 2-4 outstanding.**
Carried forward from build 2 (simulation engine). The lag is now calibrated on
the mandate-to-lag ratio and pinned by tests. The separate question of whether
the player's decisions pay is half answered — closed for the ECB, still open
for the Fed. Final calibration happens in phase 3, against a real playthrough.

The engine is correct and tested. What has *not* been established is whether
the player's decisions materially change the outcome. This document records
the evidence so the next session does not have to rediscover it.

## The finding

`npm run sim:sweep` plays 150 seeded runs per institution and difficulty under
three policies: a Taylor-style rule reacting to observed inflation and the
real-time output gap, the same rule ignoring the gap, and doing nothing at all.

Median score, and completion rate, from engine 1.0.0 after the lag
recalibration described below:

| Bucket | Taylor rule | Ignoring the gap | Doing nothing |
| --- | --- | --- | --- |
| fed/easy | 6831 (100 %) | 6861 (100 %) | 6793 (100 %) |
| fed/medium | 6550 (99 %) | 6498 (98 %) | **6949 (100 %)** |
| fed/hard | 5527 (11 %) | 5605 (9 %) | **6213 (17 %)** |
| ecb/easy | 6933 (100 %) | 6918 (100 %) | 6770 (100 %) |
| ecb/medium | 5411 (96 %) | 5277 (95 %) | 4911 (98 %) |
| ecb/hard | 2903 (9 %) | 2966 (9 %) | 2947 (13 %) |

Two things stand out.

**Doing nothing is competitive, and on fed/medium and fed/hard it beats both
of the sweep's own rules.** A game in which the passive policy is the best
policy has no decision problem in it. Note that both sweep rules react to
headline inflation; the rule comparison further down shows how much of this is
their fault rather than the model's.

**Hard completes only 9–11 %** under these rules, and the failures are
dominated by one mode: banking crisis accounts for 81 of 150 failures on
fed/hard and 87 of 150 on ecb/hard. A single catastrophe family swamping the
others makes the difficulty feel arbitrary rather than demanding.

## Retained design direction: the mandate-to-lag ratio

**The central problem is not how long the lag is. It is the ratio between the
mandate and the lag** — the number of decision → effect → correction loops a
player can actually close before the mandate ends. Below three or four, no
amount of skill is legible: the player acts, the mandate ends, and the
consequence arrives after the credits.

A working definition, to be refined against play:

```
loops ≈ meetingCount / (peak lag in meetings + publication lag in meetings)
```

Where the engine stands today. The kernel peak is
`LAG_KERNEL[difficulty].peakSubsteps` in `config/time.ts`, at four sub-steps
per meeting. Before this change, and after:

| Difficulty | Meetings | Peak was | Loops were | Peak now | Loops now |
| --- | --- | --- | --- | --- | --- |
| easy | 8 | 3.5 meetings | **1.8** | 1.5 meetings | 3.2 |
| medium | 16 | 5.5 meetings | 2.5 | 3.5 meetings | 3.6 |
| hard | 32 | 7.5 meetings | 3.8 | 7.0 meetings | 4.0 |

Easy was the broken case: under two closed loops. The demo run showed it —
250bp of tightening across a whole mandate barely moved the output gap. Hard
was already close to its target and barely moved.

Note what the target column does: the loop count becomes roughly constant
across difficulties. **What difficulty changes is not how many chances you
get, but whether you can react or must anticipate.** Easy at a one-to-two
meeting peak is a reacting game. Hard at six to eight is full realism, where
the only workable strategy is to act on the forecast.

Four decisions follow.

### 1. The lag becomes a difficulty parameter, calibrated on the ratio — DONE

`LAG_KERNEL` in `config/time.ts` is retargeted on the loop count rather than on
realism per difficulty. Measured peaks are now 1.5, 3.5 and 7.0 meetings, for
3.2, 3.6 and 4.0 closed loops. Only hard is realistic, and it barely moved.

Configuration only; no engine change. `engine/transmission.test.ts` now pins
the calibration directly: the kernel peak must stay inside its target band per
difficulty, every difficulty must keep at least three loops, the loop count must
stay within 1.5x across difficulties, and a 100bp hike must be negligible after
one meeting and clearly readable by the end of *that difficulty's own* mandate.

**This did not narrow the passive-versus-active gap, and was never going to.**
The sweep is essentially unchanged. Passive scores move by single points —
with no rate movement the lag buffer is flat, so the kernel barely enters the
calculation — and the active rules gain nothing, because a faster transmission
lands a bad decision faster too. Playability and balance are separate problems;
this fixed the first one.

### 2. Immediate feedback comes from the fast channel, which already exists

The engine already runs two speeds. Markets, the press and institutional
standing respond within the same turn: the policy surprise moves
`marketVolatility` and `marketTrust` on the spot, communication tone moves
`marketExpectedRate` and `expectedInflationShort` on the spot, and a
contradictory package costs credibility immediately. The slow channel —
inflation, unemployment, employment — keeps its lags untouched.

Nothing needs building here. It needs to be made **visible**: the fast channel
is the player's turn-by-turn feedback, and it is currently buried in latent
state that no panel surfaces. Work for phase 3 (make it legible) and phase 5
(make it feel like a reaction).

### 3. Fan charts deform immediately when policy changes

`generateObservation` already rebuilds the forecast fan every meeting from the
current state. A policy change moves the projected path in the same turn, even
while the published present has not moved at all.

This is the mechanism that makes a long lag playable: the player sees the
*future* respond immediately to a decision whose *present* effect is quarters
away. The staff forecast panel therefore carries far more of the game than its
name suggests, and should be treated as a primary screen rather than a
reference tab.

### 4. New — legacy evaluation

At the end of a mandate, advance the simulation several quarters with **no
player input**, and fold that outcome into the score.

Two reasons. It closes the exploit the long lags otherwise create: leaving with
a crisis already primed and taking the score before it lands. And it gives the
postmortem its natural conclusion — what the successor inherited — rather than
stopping mid-sentence at the final meeting.

Not built. To be implemented with the full scoring pass, since it changes the
shape of `calculateScore` and adds a component to `ScoreBreakdown`. Open
questions for that session: how many quarters (four to eight is the plausible
range), whether the legacy period is scored on the same components or on a
narrower set, and how heavily to weight it — enough to deter leaving a mess,
not so much that it dominates a mandate the player actually served.

## Two competing explanations

These need to be told apart before anything is tuned. They call for opposite
fixes, and tuning against the wrong one will make the game worse.

**1. The benchmark rules are bad, and the model is right.**

Both rules react to *headline* inflation, which in this model is dominated by
supply shocks. Tightening into a cost-push shock is precisely the error the
engine is built to punish: `IS_CURVE.supply` makes supply shocks
stagflationary, so leaning against one crushes output without addressing the
cause. The rate churn that follows then feeds `BANKING.tighteningSpeed`, which
is what produces the banking crises.

If this is the whole story, the engine is behaving exactly as designed — it is
reproducing the Orphanides critique — and the finding says only that two
hand-written rules are poor policy. Nothing needs changing.

**2. Inaction is genuinely under-penalised.**

The economy may be self-stabilising enough that shocks mean-revert on their own
within a mandate. Candidates: `IS_CURVE.meanReversion` (0.55) pulling the
output gap back to zero unaided, and the initial economy opening too close to
equilibrium in `engine/initialState.ts`.

One free stabiliser has already been removed: `EXPECTATIONS.longTargetBase` was
0.3, meaning long-run expectations were pulled toward target even at zero
credibility. It is now 0.08. That change barely moved the sweep, which is
itself evidence — but not proof — that explanation 1 carries more of the weight.

## How to tell them apart

### What has been measured so far

Six rules, 150 seeded runs each, after the lag recalibration. Median score,
completion rate in brackets:

| Rule | fed/medium | fed/hard | ecb/medium | ecb/hard |
| --- | --- | --- | --- | --- |
| doing nothing | **6949** (100 %) | **6213** (17 %) | 4911 (98 %) | 2947 (13 %) |
| headline + gap | 6494 (99 %) | 5517 (11 %) | 5183 (96 %) | 2858 (8 %) |
| headline only | 6501 (98 %) | 5572 (9 %) | 5109 (95 %) | 2913 (9 %) |
| core only | 6922 (100 %) | 5957 (**19 %**) | **5346** (99 %) | **2982** (15 %) |
| core + unemployment | 6910 (100 %) | 5965 (18 %) | 4794 (99 %) | 2920 (17 %) |
| core + forecast | 6661 (99 %) | 5717 (11 %) | 5308 (99 %) | 2920 (12 %) |

**Explanation 1 is largely confirmed.** Reacting to core inflation instead of
headline is worth 400 points on fed/medium and **doubles hard-mode survival on
the Fed, from 9 % to 19 %**. The original benchmark rules were chasing headline
into supply shocks — exactly the error the engine is built to punish — and most
of the alarming gap was theirs, not the model's.

**On the ECB, acting now beats doing nothing** at both difficulties. That half
of the finding is closed.

**On the Fed it is not.** Core-only wins on survival (19 % vs 17 %) but still
loses on score (5957 vs 6213). Something specific to the Fed remains.

### Ruled out

**A truncation artefact in scoring.** Path components average over the history,
so a run that fails early averages over fewer, earlier, better meetings — which
could have made failing early *pay*. Measured over 300 passive hard runs, it
does not: completing scores 7027 against 6120 for failing (Fed), and 5990
against 2887 (ECB). Failing is correctly worse. This hypothesis is dead.

### Still open

The remaining Fed gap points at **explanation 2, narrowed to initial
conditions**. `engine/initialState.ts` opens the economy close to both
objectives, so on the Fed's dual mandate there is little for policy to improve,
while any rate movement costs something through the tightening-speed channel
into banking stress and through the policy-steadiness component. The ECB does
not show this because its price-stability weight and gate give policy more to
earn.

Next cheapest checks, in order:

1. **Play it.** Still the fastest signal — see below.
2. **Open further from equilibrium.** Widen the seeded spread of the opening
   output gap and inflation in `createInitialState`, and re-run. If acting
   starts to pay on the Fed, this was it.
3. **Grid-search the rule** over inflation, gap and smoothing coefficients per
   bucket, to establish the best score reachable rather than the best of six
   hand-written guesses.

## What to check when playing a real game (phase 3)

The first genuine playthrough answers this faster than any sweep, and it is
where the lag is calibrated. While playing, look for:

- **Count the closed loops.** How many times did you change policy, see the
  consequence, and get to respond to it? Below three, the lag is too long for
  the mandate regardless of what the sweep says. This is the number the
  retargeting above is aiming at, and play is the only way to check it.
- Does a deliberate, well-reasoned decision visibly change the path within the
  mandate, or does the economy arrive where it was going regardless?
- **Did anything at all respond in the turn you acted?** If a decision feels
  inert on the meeting it is taken, the fast channel is not surfaced well
  enough — that is a UI problem, not a lag problem, and the fix is point 2
  above rather than shortening the lag further.
- Did the fan chart visibly move when you changed policy? If not, point 3 is
  not doing its job and the long lag will feel arbitrary.
- Does holding for eight consecutive meetings feel like a viable strategy? On
  easy it may legitimately be one — that is a training mandate — but it must
  not be on medium or hard.
- On hard, does a banking crisis feel earned, with the warning tier giving
  usable notice, or does it arrive as the default ending?
- Are the warning clues arriving early enough to act on, given the
  transmission lag?

If decisions do feel consequential in play, the sweep finding was about the
benchmark rules, and what remains is the lag retargeting alone.

## Levers, if tuning turns out to be needed

Secondary to the retargeting above: change `LAG_KERNEL` first, then re-run the
sweep, because a shorter lag changes what every one of these does. In rough
order of how much they would change:

- `BANKING.tighteningSpeed` (9.0) — the dominant path into the failure that
  swamps hard mode.
- `DIFFICULTIES.hard.thresholdLeniency` (0.82) — raises every hard threshold at
  once; blunt, use last.
- `IS_CURVE.meanReversion` (0.55) — how fast the economy fixes itself.
- `DIFFICULTIES.*.shockScale` — how much there is to respond to in the first
  place.

Everything above lives in `src/simulation/config/`. Balancing should never
require editing engine code.

## Reproducing

```bash
npm run sim:sweep
```

The sweep prints a warning line under any bucket where no rule scores better
than doing nothing, where a difficulty is unwinnable under every rule, or where
a safety clamp fired. It is the regression test for this document: when the
warnings are gone, the question is closed.

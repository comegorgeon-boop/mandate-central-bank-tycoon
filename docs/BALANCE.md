# Open balance question

> **Superseded in part by the phase-3 playthrough. Read "The easy-mode
> deadlock" below first.** The passive-versus-active question this document
> opens with turns out to be a symptom of something larger: on fed/easy the
> policy rate moves inflation by roughly a twentieth of what the mandate
> requires, so *no* rule can beat doing nothing there, and the sweep was
> comparing rules inside a space where the instrument barely functions. The
> analysis, the measurements and the two design decisions that govern the fix
> are at the end of this file.

**Status: direction retained. Points 1 and 2 implemented; points 3-4
outstanding. The information ladder is settled and recorded below.**
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

### 2. Immediate feedback comes from the fast channel, which already exists — DONE

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

**Surfaced in phase 3, and one assumption above turned out to be wrong.**
`submitMeeting` now captures an observation an instant after the decision and
before any time passes (`RunSession.onTheDay`), so differencing it against the
previous meeting isolates what the decision itself moved. `ReactionPanel` shows
that difference on confirmation.

What it revealed: **with no communication instrument in this build, a rate
decision moves almost nothing observable on the day.** The surprise moves
`marketVolatility` and `marketTrust`, and that is all — `marketExpectedRate`
and `expectedInflationShort` move only through communication tone, and
credibility only through guidance reversals and contradictions, all of which
need a package this build does not collect. So the paragraph above overstated
the case: the fast channel exists, but for a rate-only decision it is one
latent variable wide.

`marketVolatility` is therefore now published as an exact market price, which
is what makes the reaction screen honest rather than decorative. The reaction
panel says plainly that standing does not move today. **When communication is
built, this channel gets much richer, and the reaction screen is where it
should show up.**

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
completion rate in brackets.

> **Correction, phase 3.** Only three of the six rules below were ever
> committed: `headline + gap`, `headline only`, and `doing nothing`. The three
> core-targeting rows were measured with rules that never reached the
> repository, so from the moment that session ended they were a recollection
> rather than a reproducible result, and `npm run sim:sweep` could not have
> regenerated them. The core rule now exists as
> `src/simulation/policy/staffRule.ts` — it is the same module the Policy Desk
> advises from — and the sweep plays it as a fourth benchmark. Its measured
> numbers are in the table below this one. **Treat the three core rows here as
> historical notes, not as measurements.**

| Rule | fed/medium | fed/hard | ecb/medium | ecb/hard |
| --- | --- | --- | --- | --- |
| doing nothing | **6949** (100 %) | **6213** (17 %) | 4911 (98 %) | 2947 (13 %) |
| headline + gap | 6494 (99 %) | 5517 (11 %) | 5183 (96 %) | 2858 (8 %) |
| headline only | 6501 (98 %) | 5572 (9 %) | 5109 (95 %) | 2913 (9 %) |
| ~~core only~~ | ~~6922 (100 %)~~ | ~~5957 (19 %)~~ | ~~5346 (99 %)~~ | ~~2982 (15 %)~~ |
| ~~core + unemployment~~ | ~~6910 (100 %)~~ | ~~5965 (18 %)~~ | ~~4794 (99 %)~~ | ~~2920 (17 %)~~ |
| ~~core + forecast~~ | ~~6661 (99 %)~~ | ~~5717 (11 %)~~ | ~~5308 (99 %)~~ | ~~2920 (12 %)~~ |

### The staff rule, as committed and measured

`staffRule.ts` targets core inflation with an inflation weight of 0.5, no gap
term, quarter-of-the-way smoothing, and the **published** neutral rate estimate
as its anchor rather than the hardcoded 1.0 the old sweep rules used. Same 150
seeds per bucket:

| Rule | fed/easy | fed/medium | fed/hard | ecb/easy | ecb/medium | ecb/hard |
| --- | --- | --- | --- | --- | --- | --- |
| doing nothing | 6793 (100 %) | 6949 (100 %) | **6213** (17 %) | 6770 (100 %) | 4911 (98 %) | 2947 (13 %) |
| staff rule (core) | **6850** (100 %) | **6983** (100 %) | 5900 (13 %) | 6809 (100 %) | **5192** (99 %) | **2954** (15 %) |

**Explanation 1 holds, and more weakly than the withdrawn table claimed.**
Targeting core beats doing nothing on five of the six buckets, and it is the
first committed rule to beat passive on fed/medium — 6983 against 6949, where
both headline rules lost by 450. So the original finding was real: the
benchmark rules were chasing headline into supply shocks, and most of the
alarming gap was theirs rather than the model's.

**But fed/hard is not fixed, and the withdrawn table said it was.** The real
core rule scores 5900 at 13 % survival against passive's 6213 at 17 %. It does
not double hard-mode survival; it loses on both axes. The sweep still prints
`! fed/hard: no rule scores better than doing nothing`, which is the honest
state of that bucket.

**On the ECB, acting beats doing nothing** at every difficulty. That half of
the finding is closed.

**On the Fed it is closed at medium and open at hard.** The next check is
unchanged: open the economy further from equilibrium in `createInitialState`
and re-run.

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

## The information ladder

Settled in phase 3, to be implemented with the other difficulties in phase 4.
Only the easy column is built; the flags exist on `DifficultyConfig` and are
false everywhere else.

| | Shock named | Identifying evidence | Staff recommendation |
| --- | --- | --- | --- |
| easy | yes, explicitly | yes, quoting the published series | yes, and reliable |
| medium | **no** | yes, still shown | yes, but fallible |
| hard | no | not highlighted | none, or a split committee |

The ordering is the point, and it is the reverse of the obvious one. **The
evidence is what persists down the ladder; the name is what gets withdrawn.**
A player taught only the label learns to obey a label — "supply shock means do
not tighten" — and is helpless the moment nobody supplies one. A player taught
that headline running far ahead of core, with the output gap opening rather
than closing, *is* a supply shock can still read the economy at hard, where
nothing is labelled at all. So `diagnoseShock` assembles the two together and
its evidence list is never allowed to be empty.

Medium's fallible adviser needs no new mechanism, and this is why the staff
rule reads the observation set rather than the latent state: it already sees
exactly the noisy, late, occasionally missing data the player sees, so at
medium's noise levels it is wrong for the same reasons the player is wrong.
Nothing needs weakening — the honesty of its inputs does the work.

Hard's split committee is the one genuinely unbuilt piece. Two or three
recommendations from the same rule at different inflation weights, presented
without a resolution, is the cheapest construction that gives contradictory
advice without inventing a second model.

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

---

# The easy-mode deadlock

Found by playing a full fed/easy mandate in phase 3 and then measuring what the
playthrough reported. The player's account was: *"I raised rates more
aggressively than the staff advised and inflation rose until the end of the
mandate. At the same time banking stress climbed to 43, precisely because I was
tightening fast. So I was caught in a pincer."*

The hypothesis put to the engine was that the two constraints are calibrated so
that no trajectory satisfies both, making easy mode unwinnable by construction.

**The pincer is real. The hypothesis about its cause is wrong, and the truth is
worse.** The two constraints do not conflict with each other. The inflation
constraint is unreachable on its own, with the banking constraint switched off
entirely, because the policy rate barely moves inflation inside eight meetings.

## Two design decisions, settled

These govern every fix below. Neither is negotiable against the other.

### Easy mode is a tutorial. It must be winnable, and it must never trap.

Its job is to make the inflation-versus-financial-stability dilemma **visible in
order to teach it** — the player must see the trade-off, feel it in a decision,
and be able to act on it. What it must never do is close: there must always be
a trajectory from any reachable state to an acceptable ending. A tutorial that
can put the player in a position where every remaining move loses has taught
them that the game is arbitrary.

The dilemma bites for real at medium. It becomes fully brutal at hard, where 32
meetings leave enough room to resolve it — and where resolving it is the skill
the game is actually about.

### The dilemma itself is excellent and must not be removed.

It is the real problem of central banks, and it is what will make this game
interesting. Nothing below proposes weakening the link between the speed of
tightening and banking stress. The trade-off stays. What has to change is that
the player is currently offered only one side of it.

## What was measured

Four probes, all reproducible against engine 1.0.0. Where events are described
as *off*, the treatment and control runs share a seed and therefore see an
identical shock sequence, so the difference between them is caused by policy
alone.

### 1. The impulse response: the rate barely reaches inflation

A permanent +100bp hike, events off, averaged over 60 seeds. Effect on the
economy relative to the same seed left alone:

| horizon, meetings | 1 | 2 | 4 | 8 | 16 | 24 |
| --- | --- | --- | --- | --- | --- | --- |
| output gap, pp | -0.003 | -0.029 | -0.137 | **-0.376** | -0.753 | -0.997 |
| core inflation, pp | -0.000 | -0.001 | -0.008 | **-0.050** | -0.165 | -0.279 |
| headline inflation, pp | -0.008 | -0.026 | -0.052 | **-0.060** | -0.133 | -0.250 |
| banking stress, index pts | +1.76 | +3.59 | +6.26 | **+9.39** | +5.19 | +4.65 |

The bolded column is the end of the easy mandate. **100bp held for the entire
mandate buys 0.06 pp of headline disinflation and costs 9.4 points of banking
stress.**

The output-gap row is fine — a sustained 100bp reaching -0.38 pp of output gap
within a year and about -1.0 in the long run is a defensible calibration. The
model's long-run sacrifice ratio is defensible too. **The problem is entirely
one of timing**, and it is asymmetric:

- **The benefit passes through two partial adjustments in series** — rate to
  output gap through the lag kernel, then output gap to inflation through the
  Phillips curve's own `adjustment` — so at meeting 8 only about 5 % of the
  eventual disinflation has arrived.
- **The cost passes through none.** `BANKING.tighteningSpeed` reads
  `tighteningSpeed(lags)`, which is `buffer[0] - buffer[32]`: how far the real
  rate gap has moved over the past year, with no kernel applied at all. Stress
  is up 1.8 points after a single meeting and peaks at meeting 8 — then *falls*,
  as the hike ages out of the one-year window.

So the two sides of the dilemma run on different clocks, and the mandate is
exactly long enough to show the player the cost and not the benefit. This is the
mechanism. Everything else below follows from it.

### 2. The feasible frontier: no trajectory reaches target

150 seeds, events off, so the only thing varying is policy:

| policy | net hike | end inflation | disinflation bought | max stress | ends within 0.5 pp of target |
| --- | --- | --- | --- | --- | --- |
| hold | 0.00 pp | 2.61 % | 0.000 | 15.6 | 40/150 |
| +25bp every meeting | +2.00 pp | 2.51 % | 0.086 | 27.5 | 44/150 |
| +50bp every meeting | +4.00 pp | 2.44 % | 0.159 | 42.0 | 45/150 |
| +75bp every meeting | +6.00 pp | 2.37 % | 0.230 | 56.4 | 46/150 |
| **+100bp every meeting** | **+8.00 pp** | **2.30 %** | **0.300** | **68.1** | **51/150** |
| -100bp every meeting | -3.00 pp | 2.90 % | -0.289 | 14.8 | 32/150 |

A single move is capped at 100bp on easy, so the bolded row is the **maximum
trajectory the instrument allows**. Eight hundred basis points across the whole
mandate is worth 0.30 pp of inflation and 52 points of banking stress.

**That is 175 index points of banking stress per percentage point of
disinflation.** The pincer is not two constraints meeting; it is one instrument
priced at roughly twenty times what it delivers.

A beam search over the full trajectory space — nine moves per meeting over eight
meetings, 43 million paths — adds nothing to this. With events on it converges
on hiking at the cap and still cannot beat holding on the inflation objective.
Its apparent gains come from perturbing *which procedural events fire*, not from
transmission, which is a warning about the search rather than a finding about
the game.

### 3. Where the inflation actually comes from

Holding throughout, 150 seeds, median headline inflation:

| | |
| --- | --- |
| opening | 2.55 % |
| final, procedural events **off** | 2.61 % — drift of **+0.06 pp** |
| final, procedural events **on** | 3.57 % — drift of **+1.02 pp** |

**The stochastic shock processes contribute 0.06 pp of the drift. The event
catalog contributes 0.97 pp.** The inflation the player is fighting is almost
entirely the event stream.

`config/shocks.ts` states, correctly, that its processes are symmetric. The
event catalog layered on top is not. Cost-push effects among the events eligible
at easy, counted over those 150 runs:

| event | times fired | net effect on `supplyShock` |
| --- | --- | --- |
| `energy_price_spike` | 62 | **+1.70** |
| `supply_chain_disruption` | 55 | +0.70 |
| `geopolitical_escalation` | 40 | +0.70 |
| `natural_disaster` | 31 | +0.40 |
| `energy_price_relief` | **6** | -0.75 |

**188 cost-push-raising firings against 6 relieving ones.** The asymmetry is
structural, not a draw: `energy_price_spike` has `isEligible: () => true` and
delivers a net +1.70 across its immediate and delayed effects, while
`energy_price_relief` is gated on `supplyShock > 0.4` and can only ever remove
`0.8` of the shock currently outstanding. Since `supplyShock` mean-reverts at
1.2/year, the shock has usually decayed below the relief's own eligibility bar
before the relief can fire.

So the player is asked to fight, with an instrument worth 0.30 pp, a source of
inflation that is worth 0.97 pp and that no instrument in the game can touch.

### 4. The meeting-by-meeting decomposition

An exact additive decomposition of the inflation path was built and checked
against the engine at every sub-step: for each tracked variable the channel
contributions must sum to its deviation from target, or the run aborts. A
representative aggressive fed/easy run — +75bp at each of the first four
meetings, then hold:

```
mtg rate headln core  gap stress   Dinfl  policy   shock  expect   wages  inerti   other
  1  4.25   2.69  2.56  0.97   13.6   -0.00   -0.00    0.04    0.00   -0.00   -0.04    0.00
  2  5.00   2.90  2.62  1.05   16.4    0.21   -0.00    0.25    0.00   -0.00   -0.03   -0.01
  3  5.75   2.82  2.61  0.90   20.5   -0.08   -0.00   -0.03    0.00   -0.00   -0.02   -0.02
  4  6.50   2.79  2.62  0.89   25.6   -0.04   -0.01    0.03    0.00   -0.00   -0.02   -0.04
  5  6.50   2.63  2.58  0.58   30.3   -0.15   -0.01   -0.09    0.00   -0.00   -0.01   -0.03
  6  6.50   2.81  2.61  0.24   41.6    0.17   -0.01    0.21    0.00   -0.00   -0.01   -0.01
  7  6.50   2.99  2.62 -0.03   45.5    0.18   -0.01    0.20    0.00   -0.00   -0.01    0.01
  8  6.50   3.23  2.71 -0.11   47.1    0.24   -0.02    0.24    0.00    0.00   -0.01    0.02
end         3.23  2.71                 1.23   -0.06    0.86    0.01   -0.01    0.52   -0.08
```

Three hundred basis points of tightening, held for the rest of the mandate,
contributes **-0.06 pp** to where inflation ends up. Every meeting's change in
inflation is dominated by the `shock` column. The `policy` column never reaches
even a hundredth of a point until meeting 4.

## The verdict

The player asked for an honest choice between (a) correct behaviour the
interface never showed, (b) calibration too weak, and (c) a bug.

**It is (b), decisively, and not marginally: the transmission is roughly twenty
times too weak relative to the mandate length.** It is not (a) — no amount of UI
would make a 0.06 pp effect legible next to a 0.97 pp event stream, and it would
be dishonest to show a player a decomposition whose policy column reads -0.00
every meeting and call that teaching.

There is no bug in the engine's arithmetic. Every equation does what its
comments say. But there is a **test defect**, and it is the reason this survived
review:

```ts
// src/simulation/engine/transmission.test.ts:190
expect(coreEffect[mandate]).toBeLessThan(-0.02)
```

This is the assertion that pins "a single 100bp hike must be worth something the
player can read before their term is over, at every difficulty". It passes at
-0.05. But published core inflation carries measurement noise of sd 0.20 scaled
by the difficulty's `observationNoiseScale`, which is 0.07 pp on easy, and is
printed to two decimals. **The test certifies an effect three times smaller than
the noise on the series it moves.** It measures the right quantity against a
threshold that cannot distinguish a working instrument from a broken one.

## Status: all four fixed, and what they cost

> **Done.** The four corrections below were applied in order, one commit each,
> and the results are recorded under "After" at the end of this section. Engine
> 1.1.0. The headline outcome: on fed/easy, tightening 50bp at every meeting now
> lands median headline inflation at 2.01 % with peak banking stress at 57.8,
> below the 79.75 supervisory warning. **That trajectory did not exist before.**

## What to loosen, in order

The instruction is: keep the dilemma, make the tutorial winnable. These are
ordered by how much they change and how little they risk.

1. **Fix the test first, then calibrate against it.** The bar in
   `transmission.test.ts` should be stated in units the player can perceive:
   a 100bp hike held for a mandate must move core inflation by more than the
   published noise of that difficulty — several times it, not a fraction. Every
   number below is guesswork until this assertion says what "readable" means.

2. **Give the banking-stress channel the same lag the inflation channel has.**
   This is the single highest-value change and the only one that fixes the
   dilemma rather than diluting it. `tighteningSpeed` currently reads a raw
   one-year difference in the lag buffer; running it through the transmission
   kernel would put cost and benefit on the same clock. The player would then be
   trading a delayed cost against a delayed benefit — which is the real central
   banking problem — instead of an instant cost against an invisible one. **Do
   not reduce `BANKING.tighteningSpeed` to achieve this**; that would weaken the
   dilemma, which the design decision above forbids.

3. **Fix the event catalog's asymmetry.** Relax `energy_price_relief`'s
   eligibility gate and let it remove more of the outstanding shock, or lower
   the spike family's weight at easy. The stated design is symmetric shocks; the
   realised distribution is 31:1. This is a bug against the file's own stated
   intent, and it is cheap to fix.

4. **Shorten the lag or lengthen the mandate on easy — but only after 1-3.**
   `LAG_KERNEL.easy` is already at a 1.5-meeting peak, so most of the remaining
   slowness is the Phillips curve's second stage rather than the kernel. Raising
   `PHILLIPS.adjustment`, or `PHILLIPS.gapSlope`, or `IS_CURVE.rateSensitivity`
   would each speed the second stage; the loop-count framing earlier in this
   document is about the kernel alone and does not capture it. If none of that
   is enough, easy's mandate is simply too short for a decision problem about
   inflation and should be 12 meetings rather than 8.

5. **The initial-conditions check recorded earlier in this document is now
   lower priority.** Opening the economy further from equilibrium would widen
   the inflation problem without widening the instrument, which makes the
   deadlock worse rather than better. Do it after transmission is fixed.

## Not the problem, but fix the copy anyway

The player reported being pinched at a banking stress of 43 against "a rupture
threshold of 50". **There is no threshold at 50.** The number comes from the
indicator's own description in `observation/series.ts`:

> "...which tightens conditions sharply and unpredictably; above 50 the system
> is impaired. This is the fastest route to ending a mandate early."

The actual thresholds on easy, after `thresholdLeniency` of 1.45:

| | value on easy |
| --- | --- |
| score penalty begins (`calculateScore`) | 25 |
| warning tier (`bankingCrisis.watchStress`) | 79.75 |
| failure tier (`bankingCrisis.failStress`, capped) | 95, held for 3 consecutive meetings |

At 43 the player was 52 points and three consecutive meetings from any failure.
They stopped tightening because the interface told them they were approaching a
cliff that is not there. That did not cause the deadlock — the measurements
above hold with the banking constraint removed entirely — but it means the one
number the player was steering by was wrong, and it should say what it means:
that stress costs score from 25, and ends mandates near 95.

## Reproducing this section

The probes are not committed. They were: an impulse-response harness built on
`testing/harness.ts`; a fixed-policy sweep over fed/easy; a beam search over
rate trajectories; and the sub-step inflation decomposition described in
section 4. The decomposition is the only one worth committing, and only if
decision 3 below is taken.

## On showing the decomposition to the player

The proposal was to display the per-meeting split — *"inflation +0.4, of which
+1.1 from the shock and -0.7 from your policy"*.

**The engine can produce it cleanly, and the numbers are exact rather than
estimated.** Every block in `dynamics.ts` is a partial adjustment toward a
target that is linear in the other state variables, so an attribution vector can
be propagated alongside the state with the invariant that the channel
contributions sum exactly to the variable's deviation from target. That was
built and verified for this analysis: it holds to 1e-7 at every sub-step across
every run tested, and it catches its own errors — if a formula disagrees with
the engine the identity breaks immediately.

Three things it needs, none of them obstacles:

- **A stated baseline for "your policy".** The natural one is the stance
  inherited at the first meeting: the policy column then reads "versus having
  held the opening rate all mandate", which is the comparison the player is
  actually making.
- **Parallel lag buffers.** The real rate gap has to be carried as four
  components — policy, expectations, inherited stance, neutral drift — pushed in
  lockstep with the engine's own buffer and convolved with the same kernel.
  Cheap, and checkable against the engine's buffer.
- **An honest residual.** Credit, the currency and spreads are endogenous
  mixtures; they belong in a visible `other` column rather than being forced
  into a channel that sounds better.

**But do not build it yet.** On today's calibration the policy column reads
`-0.00, -0.00, -0.00, -0.01, -0.01, -0.01, -0.01, -0.02`. Shipping that would
show the player, in the game's own numbers, that their decisions do not matter.
Fix the transmission first; then the decomposition becomes the best explanatory
screen in the game, because it will have something to explain.

> **Now buildable, with one change to the proposal.** On engine 1.1.0 the same
> aggressive fed/easy run decomposes to `policy -0.34, shock -0.36,
> expectations +0.05, wages +0.04, inertia +0.44, other -0.10` against a
> headline sitting 0.27 below target. Policy is the second-largest term and the
> same order as the shocks, which is what makes the screen worth building.
>
> The change: **show the cumulative attribution, not the per-meeting one.** Per
> meeting the policy column still reads -0.01 to -0.06 against shock swings of
> ±0.9, because a rate decision is a slow, steady pull against fast, noisy
> pushes — that is the true shape of the problem and no calibration removes it.
> The sentence the player needs is "inflation is 0.27 below target; 0.34 of that
> is your policy and 0.36 the shocks you inherited", not a meeting-by-meeting
> delta in which policy always looks like a rounding error. The per-meeting row
> is worth showing underneath, as the reason the cumulative number moves slowly.

## After: what the four fixes actually did

Engine 1.1.0, measured the same way as everything above. Events off where a
policy effect is being isolated, on where the player's experience is.

### The pincer

fed/easy, 150 seeds, events off. The row that matters is the middle one.

| policy | net hike | end inflation | disinflation | peak stress |
| --- | --- | --- | --- | --- |
| hold | 0.00 pp | 2.45 % | 0.000 | 17.1 |
| +25bp every meeting | +3.00 pp | 2.22 % | 0.240 | 36.4 |
| **+50bp every meeting** | **+6.00 pp** | **2.01 %** | **0.455** | **57.8** |
| +75bp every meeting | +9.00 pp | 1.79 % | 0.666 | 77.5 |
| +100bp every meeting | +12.00 pp | 1.57 % | 0.887 | 83.7 |

**The exchange rate went from 175 index points of banking stress per point of
disinflation to 75.** The dilemma is intact and now has an interior optimum:
maximum tightening overshoots to 1.57 % and scores 5134, while the staff rule
scores 6951 — so overreacting is still punished, which is the point.

### The sweep

| bucket | doing nothing | staff rule (core) | before, staff vs passive |
| --- | --- | --- | --- |
| fed/easy | 6857 (100 %) | **6951** (100 %) | lost |
| fed/medium | 7010 (99 %) | **7054** (98 %) | won narrowly |
| fed/hard | **6272** (24 %) | 6206 (27 %) | lost |
| ecb/easy | 6461 (100 %) | **6574** (100 %) | won |
| ecb/medium | 5622 (99 %) | **5992** (99 %) | won |
| ecb/hard | 2910 (17 %) | **2952** (22 %) | won narrowly |

Acting beats doing nothing on five buckets of six, against four before. **On
fed/hard the staff rule still scores below passive** — that is this document's
long-standing open item, it is untouched by this work, and the next check on it
is unchanged: grid-search the rule rather than trusting one hand-written set of
coefficients.

Two things improved on hard that are not scores. The failure modes are no longer
swamped by one family — 41 banking crises, 41 dismissals, 37 inflation spirals
against 81/31/17 before — so a hard-mode loss now feels like a consequence
rather than a fixed ending. And completion went from 11 % to 20-27 %.

### Where the inflation comes from

fed/easy, holding throughout, 150 seeds:

| | before | after |
| --- | --- | --- |
| drift from the shock processes | +0.06 pp | +0.06 pp |
| drift from the event catalog | **+0.97 pp** | **-0.01 pp** |

The inflation problem now comes from the opening economy and from symmetric
shocks, both of which policy can act against, rather than from a stream no
instrument in the game touches.

### Still open

- **fed/hard: no rule beats doing nothing.** Pre-existing, untouched.
- **`geopoliticalRisk` fires a safety clamp twice in 150 hard runs.** Also
  pre-existing — it fired once at engine 1.0.0 — and it appears more often now
  only because far more hard runs survive long enough to reach it. Not
  diagnosed. `productivityShock`, which clamped for a clear reason, is fixed:
  it was the only bounded shock process without innovation damping.
- **The headline-core wedge clears the noise on hard by 26 %, at meeting three.**
  Comfortable at easy and medium, tight at hard. If hard's `observationNoiseScale`
  or `revisionScale` rises again, this is the first thing that breaks.

## Third playthrough: the two hypotheses, settled

A third fed/easy mandate, played after the four fixes, reported the same thing:
rates raised very high, inflation not falling and rising, unemployment rising.
Two hypotheses were put, and both had to be settled before anything else.

### Hypothesis 1 — the sweep and the game are not running the same thing

**Refuted, and now permanently tested.** `src/pages/enginePathParity.test.tsx`
plays the same sustained aggressive sequence twice on one seed: once driving the
engine directly as every measurement in this file does, once through the whole
game — setup, routing, React state, the confirmation screen, the run provider.
It compares the *published* numbers meeting by meeting, because an observation
is a pure function of state and seed.

They agree exactly: same policy rate at every meeting, same published headline,
core and unemployment, same mandate length. The test also pins the specific
worry about a one-meeting offset — the rate the confirmation screen promises at
meeting N is asserted to be the rate in force at meeting N+1.

The decision path is sound. `MeetingPage` keys `MeetingScreen` on the meeting
index, so the desk selection cannot carry over; `RunProvider.submit` applies the
package it is given and stores the session the engine returns.

### Hypothesis 2 — step 4 was not done

**Confirmed, and the more important of the two.** Step 4 *was* applied — the
Phillips curve was sped up and easy went from 8 meetings to 12 — but it was not
enough, and this file's "After" section overclaimed. Measured in meetings until
a hike clears the noise on the series it moves, events off:

| policy | difficulty | series | material (1 sd) | readable (3 sd) | mandate |
| --- | --- | --- | --- | --- | --- |
| one 100bp hike, held | easy | core inflation | 7 | **14** | 12 |
| one 100bp hike, held | easy | unemployment | 8 | **13** | 12 |
| +100bp every meeting | easy | core inflation | 6 | 8 | 12 |
| one 100bp hike, held | medium | core inflation | 17 | never in 40 | 16 |
| one 100bp hike, held | hard | core inflation | 29 | never in 40 | 32 |

**A single 100bp hike on easy becomes readable two meetings after the mandate
has ended.** Only a sustained maximum-tightening stance is readable inside it.

Note what the same table says about the player's own diagnosis. They inferred
that the first link (rates → activity) works and the second (activity → prices)
does not. **It is not so: unemployment becomes readable at meeting 13 and core
inflation at 14.** The two links are on nearly the same clock. What differs is
that unemployment is judged against a stable natural rate and moves
monotonically, while inflation is simultaneously being pushed up by shocks — so
the player sees policy's contribution to unemployment and only the *net* on
inflation. That is the case for showing the decomposition, not evidence of a
broken second link.

### The reporting error that hid this

The headline claim in the previous section — "+50bp at every meeting lands
median headline at 2.01 %" — was measured with **procedural events off**. The
game runs with them on. The same measurement with events on, 150 seeds:

| policy | inflation still higher than at the start | median end | within 0.5pp of target |
| --- | --- | --- | --- |
| hold throughout | 64 % of runs | 3.15 % | 13 % |
| +25bp every meeting | 58 % | 2.90 % | 17 % |
| +50bp every meeting | **51 %** | 2.84 % | 15 % |
| +75bp every meeting | 43 % | 2.42 % | 15 % |
| +100bp every meeting | **39 %** | 2.08 % | 19 % |

The player's experience is the modal one. Even under the maximum trajectory the
instrument allows — 1200 basis points across the mandate — inflation still ends
higher than it started in **39 % of runs**, and fewer than one run in five ends
near target under any policy. Events-off numbers are the right tool for
isolating a mechanism and the wrong tool for claiming a mandate is winnable.
**Any future winnability claim in this file must be measured with events on.**

### Why events-on is so much worse: the guard-rail has a hole

Holding throughout, 150 seeds, after the calibration:

| | after fix 3 | now |
| --- | --- | --- |
| drift from the shock processes | +0.06 pp | -0.11 pp |
| drift from the event catalog | -0.01 pp | **+0.70 pp** |

The catalog went back out of balance, and `events/balance.test.ts` did not
notice, because **it counts firings by sign and not the impulse they deliver**.
The firing counts are healthy — 67 energy spikes against 49 reliefs, 55 supply
disruptions against 53 normalisations, 52 escalations against 49
de-escalations. The delivered cost-push is not:

| | firings | net supplyShock each | delivered |
| --- | --- | --- | --- |
| `energy_price_spike` | 67 | **+1.70** | +113.9 |
| `energy_price_relief` | 49 | **-0.70** | -34.3 |
| all cost-push-raising | | | **+206.8** |
| all cost-push-relieving | | | **-105.7** |

The spike and the relief were paired by *name* but not by *magnitude*: the
relief's effect is capped at `-min(1.8, 0.7 + supplyShock * 0.7)` while the
spike always delivers +1.70. That imbalance was invisible at
`HEADLINE.supplyAmplifier` 1.8 and became a 0.70pp drift when the amplifier was
raised to 2.4 for the shock-identification bar — one fix silently undoing
another.

`inflationImpulse` already computes the delivered impulse correctly, and the
balance test uses it only to decide a sign. **The fix is to weight the ratio by
impulse rather than count firings** — not yet applied, since nothing was to be
touched until the hypotheses were settled.

### Where this leaves the four fixes

The first three stand and are unaffected. The fourth — the calibration — moved
the median in the right direction but is **not sufficient**: on the numbers
above, easy is winnable only by pressing the same button at maximum every
meeting, which is a degenerate game rather than a decision problem. Before any
further tuning of the rate channel, see docs/DIRECTION.md: the player's verdict
is that the game needs a second instrument more than it needs a stronger first
one, and communication acts on expectations directly rather than through the
output gap, on a much shorter lag.

### What now protects each of these

Every finding above is now a test rather than a paragraph.

| Guard | Fails when |
| --- | --- |
| `engine/transmission.test.ts` | any effect-size claim stops holding in units of that series' published noise |
| `the instrument is stronger than the problem` | maximum tightening cannot close a typical opening miss |
| `difficulty decides whether one decision is legible` | easy stops being a reacting game, or medium/hard start being one |
| `the cost of tightening runs on the same clock` | the banking channel is put back on a shorter lag than the demand channel |
| `the evidence that identifies a shock stays above the noise` | the headline-core wedge sinks under the combined print error |
| `events/balance.test.ts` | the realised inflationary/disinflationary firing ratio leaves 0.7-2.5 |
| `observation/descriptions.test.ts` | indicator copy quotes a number no engine constant accounts for |

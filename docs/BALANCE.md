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

### The hole, plugged

> **Done.** The guard now measures what the catalog delivers, and the catalog
> now delivers what its pairs promise. Everything below is measured, and every
> number here fails a test if it regresses.

**The guard.** `events/balance.test.ts` no longer counts firings. Every firing
is weighted by `inflationImpulse` evaluated **in the state it actually fired
in** — judging a state-dependent relief at one stressed reference context was
the exact blind spot — and scaled by the difficulty's severity multiplier.
Three assertions per bucket: the gross delivered ratio stays in 0.7–1.5, the
**net delivery per meeting** stays within ±0.08 (the ratio hides the drift
whenever gross volumes are large: pre-fix hard ran a ratio of 1.35 while
pouring five net units into every run), and each named shock/relief pair must
cancel to within a third of its larger half at *both* a calm and a stressed
context, so a magnitude mismatch fails at authoring time. Against the pre-fix
catalog the suite fails on all six buckets and names the energy pair
specifically; against the rebalanced one it passes with ≥19 % margin.

**The catalog.** Four changes, all pairing by magnitude what was paired by
name:

- `energy_price_relief` is the spike's structural mirror: floor raised to the
  spike's own opening move (−1.4, +0.4 per unit of outstanding shock, capped at
  −2.2), the same continuation-then-partial-rebound tail, the same import-price
  and confidence deltas with the ECB factor. The `supplyShock > 0` bonus keeps
  "more to give back after a run-up" without hiding a 2:1 default underneath.
- `supply_chain_normalisation`'s weight keys on outstanding `supplyShock`
  rather than on *low* geopolitical risk — escalations keep that index elevated
  for whole mandates, so the old weight quietly silenced the good news.
- `geopolitical_dealescalation` is level-symmetric (−22 immediate against the
  escalation's +22): each escalation used to net +14 of risk against −12 given
  back, and since the energy spike and the shipping disruption both scale their
  firing weight on that index, the ratchet tilted the whole catalog.
- `natural_disaster` restores its lost capacity in full (−0.9 delayed against
  +0.9 immediate); it is a violent transitory supply event, not a permanent
  0.4-per-firing inflation tax.

**Delivered impulse, before → after** (60 runs per bucket, ratio then net per
meeting):

| bucket | ratio | net/meeting |
| --- | --- | --- |
| fed/easy | 1.76 → **1.26** | +0.100 → **+0.043** |
| fed/medium | 1.47 → **1.12** | +0.163 → **+0.051** |
| fed/hard | 1.35 → **1.06** | +0.153 → **+0.030** |
| ecb/easy | 1.61 → **1.15** | +0.094 → **+0.030** |
| ecb/medium | 1.34 → **1.07** | +0.130 → **+0.031** |
| ecb/hard | 1.35 → **1.04** | +0.140 → **+0.020** |

**Realised drift, same seeds, hold throughout, 150 runs, easy.** The catalog's
contribution to end-of-mandate headline (events on minus events off): fed
+1.00pp → **+0.58pp**, ecb +0.64pp → **+0.20pp**. The fed residual is dominated
by `wage_round_breakout`, which under a permanent hold fires to its cap because
the gate — a labour market left to run hot — never closes. That is a different
kind of pressure from the old energy skew: it is *conditional on passivity*,
and cooling the economy (or, once communication lands, holding expectations
down) closes it. It stays, by design.

**`HEADLINE.supplyAmplifier` stays at 2.4.** Verified rather than assumed: at
1.8 the headline–core wedge on hard was 1.56pp against 2.19pp of combined print
error — below the noise, so the identification promise was a bluff — and at 2.4
it clears it by 26 %, which `the evidence that identifies a shock stays above
the noise` pins. The +0.70pp drift it "introduced" was the catalog's delivered
imbalance being amplified honestly; the imbalance is now fixed at the source,
and the amplifier keeps doing the one job it was raised for.

**Winnability, events on, fed/easy, 150 seeds** (the honest measurement, per
the rule above):

| policy | median end | still higher than start | within 0.5pp of target |
| --- | --- | --- | --- |
| hold | 3.15 → **2.94 %** | 64 → 58 % | 13 → 15 % |
| +25bp every meeting | 2.90 → **2.78 %** | 58 → 53 % | 17 → 15 % |
| +50bp every meeting | 2.84 → **2.49 %** | 51 → 47 % | 15 → 18 % |
| +75bp every meeting | 2.42 → **2.18 %** | 43 → 41 % | 15 → 20 % |
| +100bp every meeting | 2.08 → **2.03 %** | 39 → 43 % | 19 → 19 % |

The dose–response curve is now smooth where it was flat-then-nothing, and every
row completes 100 %. But no fixed rate policy ends within half a point of
target more than a fifth of the time, and the best trajectories are still the
"same button every meeting" ones. **The catalog no longer writes the outcome;
it also does not create a decision problem.** That is the second-instrument
question, which is docs/DIRECTION.md's territory, not further catalog tuning.

---

# The second instrument: communication and guidance

Engine 1.2.0. Built to the direction in docs/DIRECTION.md after the plan was
validated: guidance and a binding commitment open from easy, the market answers
words the day they are said, and credibility finally moves. Everything below is
measured, and `engine/guidance.test.ts` pins all of it.

## The mechanism: three clocks and a promise ledger

A package now carries, besides the rate, an **announced path** (forward
guidance, ±100bp from the new rate on easy) and a **commitment strength**
(`none` / `weak_bias` / `conditional_path` — the first binding rung, opened at
easy because without it a commitment is never a promise and the credibility
mechanic is unreachable). Three clocks:

- **The same day.** `applyPolicyPackage` jumps `marketExpectedRate` toward the
  announced path by `guidanceMarketJump × credibility × commitment × reach`.
  Measured: **+0.16pp** for a +100bp announcement at credibility 71 under a
  conditional commitment — readable at once on a series published exactly.
- **Between meetings.** The standing announcement pulls one-year expectations
  through `EXPECTATIONS.guidancePull` (sensitivity raised 0.25 → 0.5).
  Measured, one announcement never renewed: −0.10pp after two meetings,
  −0.19pp after eight, and **−0.15pp of headline by the end of the mandate** —
  the head start over the rate channel, which must first cross the output gap.
- **At maturity.** A promise describes the rate "roughly a year out", so at
  `GUIDANCE_HORIZON_MEETINGS` (8 = one year) it comes due: delivered within
  0.5pp, or broken — then it expires either way, because a promise about next
  year cannot pull expectations three years later.

**The promise ledger** is what makes talk an advance rather than a gift.
Five exploits were closed while building it, the last two found by the guards
themselves:

1. Holding forever under a hawkish promise used to *accrue* kept-promise
   credit. Now only a delivered step toward the path earns credit.
2. A promise to stop (announced path = current rate) had no sign and could
   never be broken. Now judged by distance: any move off a promised pause
   breaks it — and an overshoot past a promised path is judged like an
   abandonment, in either direction.
3. Restating a promise every meeting reset its clock, so it never matured.
   A restatement within tolerance now keeps the original clock.
4. Walking a promise back *with words* — rewriting the path by more than the
   delivery tolerance, or withdrawing the commitment while the path is
   undelivered — is a broken promise, same as a contrary move. But a promise
   the rate has already reached is settled **kept** when replaced: stepping
   down after arriving is mission accomplished, not a walk-back. (The first
   version got this wrong and punished the honest rule for converging.)
5. The shock-justification escape hatch used a flat bar, and a year of
   ordinary economic weather drifts past it — so nearly every default at
   maturity was excused. The bar now scales with the promise's age: an old
   promise is only excused by a genuine upheaval, not by the year having
   happened.

## The falsifiable criterion, and its verdict

The commitment made before building: **a staff rule announcing its own
intentions honestly must beat the same rule staying silent, and the same rule
announcing a path it never delivers must lose to silence — or the axis is
cosmetic and does not ship.** `policy/guidedStaffRule.ts` implements the three
modes; the comparison is paired per seed, events on, 120 seeds, so the shocks
are identical inside each pair and the difference is caused by the words alone.

| easy bucket | honest − silent, paired | bluff − silent, paired |
| --- | --- | --- |
| fed | **+33.3** (se 4.6), wins 84 % | **−152.3** (se 20.4) |
| ecb | **+50.0** (se 6.9), wins 74 % | **−164.1** (se 34.8) |

The unpaired medians (+5 on fed) understate the honest gain badly — seed
variance swamps it — which is why the pinned test asserts the paired mean.
The ledger separates the two for the right reason: the honest rule breaks 0.1
promises per mandate and keeps 4; the bluffer defaults about three times and
pays each one. Bluffing also degrades through the *existing* surprise channel:
a market that priced the promised path is negatively surprised at every
meeting the delivery fails to arrive.

Both halves of the criterion **pass**, with margins pinned at less than a third
of the measured effects (`the falsifiable criterion` in guidance.test.ts).

## The sweep, engine 1.2.0

150 seeds per bucket. `with honest guidance` is the new column.

| bucket | doing nothing | staff rule | staff + honest guidance |
| --- | --- | --- | --- |
| fed/easy | 6816 (100 %) | 6848 (100 %) | **6904** (100 %) |
| fed/medium | **7163** (99 %) | 7073 (99 %) | 7118 (99 %) |
| fed/hard | 6261 (27 %) | 6122 (30 %) | 6512 (**3 %**) |
| ecb/easy | 6464 (100 %) | 6637 (100 %) | **6687** (100 %) |
| ecb/medium | 5985 (99 %) | 6149 (99 %) | **6328** (99 %) |
| ecb/hard | 2892 (19 %) | 2927 (23 %) | 3234 (**3 %**) |

Three findings:

- **The guided rule outscores the silent one on all six buckets.** The second
  instrument is worth points everywhere, not just where the criterion demanded
  it.
- **fed/medium regressed to passive-dominant** (7163 against 7118). The
  rebalanced catalog leaves less inflation to correct, which re-exposes the
  long-standing structural finding on the Fed: an opening near both objectives
  gives policy little to earn. This is the pre-existing open item, not a
  regression of this build; the recorded next check (open the economy further
  from equilibrium) is unchanged, and DIRECTION.md's designed openings are the
  real answer.
- **On hard, honest conditional commitment is a death sentence: 3 % completion,
  27 of 40 failures by dismissal, 3.3 broken promises per run.** Hard's
  observation noise (×1.7) makes the rule's own target jump between meetings,
  so it keeps verbally rewriting a binding promise and bleeds credibility at
  8.1 a break. This is emergent and *correct* — committing firmly to a path
  read off data you cannot trust should be lethal, and it makes commitment
  strength a real skill decision at high difficulty — but it means any future
  hard-mode advisor must modulate commitment with uncertainty, and hard's
  balance work must not treat the honest-guided rule as a safe benchmark.

## Collateral of the version bump

Bumping to 1.2.0 reseeds every measured guard. The balance suite's
net-per-meeting statistic moved by its own sampling error (±0.04 at 60 runs)
and exposed two things: the test needed 150 runs for its band to mean anything,
and **medium had a real residual tilt of +0.07 to +0.10 per meeting hiding
under the old seeds — traced to `currency_pressure`, the one medium+ event
with no counterpart.** The currency could only ever fall. `currency_appreciation`
is its magnitude-exact mirror (safe-haven inflows: import prices down, later
headline down, exports pinched), added to the paired-magnitude check. Measured
at 150 runs the six buckets now sit at −0.049 to +0.054 net per meeting,
inside the ±0.08 band with ≥30 % margin, ratios 0.91–1.29.

## What the player sees

`credibility_index` is now a published series (survey, exact-ish: noise 2.0
before difficulty scaling, no lag, no revisions), so the resource the promise
ledger spends and rebuilds is on the table like any other number, quoting the
dismissal thresholds from config. The desk that collects the package keeps the
register rule pinned by `statement.test.ts`: the player picks sentences —
"We expect to go somewhat further", "A conditional commitment" — and the basis
points appear as footnotes, never as the controls. The standing promise, its
delivery gap and its judgment meeting are shown at the desk before every
decision; the statement is shown verbatim before it is confirmed; the same-day
reaction now carries the priced path answering the announced one, the
expectations nudge, and credibility on the days a promise settles; and the
stance strip carries standing permanently. `enginePathParity` now plays its
whole sequence with a conditional commitment announced and delivered, so the
interface and the engine are pinned to the same game on the communication
channel too.

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
| `events/balance.test.ts` | the delivered inflationary/disinflationary impulse ratio leaves 0.7-1.5, net delivery per meeting leaves ±0.08, or a shock/relief pair stops cancelling at calm and stressed states |
| `observation/descriptions.test.ts` | indicator copy quotes a number no engine constant accounts for |
| `engine/guidance.test.ts` | words stop moving markets the day they are said, distrust stops discounting them, any promise-ledger exploit reopens, honest guidance stops beating silence, or bluffing stops costing |

---

# Violent named events, and markets that answer them

The phase-3 playthroughs fixed transmission and shipped communication as a
second instrument, and the guidance falsifiable criterion passed — but the
player who actually sat down with all of it reported the same verdict as
before any of that work started: *nothing happens*. The only shocks in the
game were the procedural catalog's small, state-dependent supply/demand
noise, and even those never showed their own name to the player —
`ResolvedEventRecord.title` was assembled by `resolveEvent.ts` and then
never read by anything (`features/meeting/brief.ts` only ever surfaced
`record.newswire`, wrapped in a generic "Fictional newswire report on an
event that has just occurred."). A game with no drama has no reason to
listen to its own central banker either: communication only pays when
there is something worth communicating about.

## The mechanism

**A major-event tier, reusing the existing catalog machinery.** `GameEvent`
gained three optional fields — `tier?: 'major'`, `maxDifficulty?: Difficulty`
(a ceiling symmetric to the existing `minDifficulty` floor), and
`dispatchLines?: readonly string[]` — so six new entries in
`events/catalog.ts` (a geopolitical crisis, a domestic political shock, a
bank failure, a housing crash, a supply-chain rupture freed of any prior
build-up, and a standalone market panic) could be added without touching the
twenty existing ones. All six are `minDifficulty: 'easy', maxDifficulty:
'easy'` — scoped out of medium and hard entirely by construction, so neither
difficulty's catalog or balance is touched by any of this. Each is written
as an escalation-then-uneasy-stabilisation arc (immediate shock, a
complication one meeting later, a partial — never complete — stabilisation
two to four meetings after that), the same shape `energy_price_spike` and
`geopolitical_escalation` already use, just 2-4x their magnitude on the
primary channel.

**A guaranteed opener, and why it cannot be an ordinary event firing.**
`resolveEvent` only ever runs *between* meetings, inside `submitMeeting` — by
the time it could fire anything, the player's first decision would already
be over. So `events/openingCrisis.ts` applies a randomly drawn major event's
effects directly to the fresh initial state, through the same
`applyEffects`/`clampLatentState`/severity-scaling path `resolveEvent` uses,
producing the same `ResolvedEventRecord` shape — everything downstream
(occurrences, cooldowns, diagnosis, the dispatch log) treats it exactly like
any other firing. The draw comes from a *forked* PRNG substream
(`Prng.fork`), which by design never consumes from the parent, so the run's
own random sequence — every later event draw, every shock innovation — is
completely unaffected by whether an opener fires at all.

That mattered for three things that had to stay exactly as they were:
`testing/harness.ts`'s `playWithoutEvents` (every transmission/lag
calibration test in this file), `events/balance.test.ts`'s
`deliveredImpulses` (the symmetry guard below), and
`pages/enginePathParity.test.tsx`, whose "Path A" calls `createInitialState`
directly and asserts exact equality against the real app at every meeting
including the first. `createInitialState` therefore took an options
parameter, `{ openingEvent?: boolean }`, defaulting to `true`: real play gets
the opener automatically and identically on both parity paths, and the three
harnesses that need an uncontaminated baseline pass `openingEvent: false`
explicitly. One consequence worth flagging for future test-writing: a plain
`createInitialState(easyConfig)` is no longer a calm baseline by default —
several of this session's own new tests had to build fixtures with
`{ openingEvent: false }` for exactly this reason.

**A healthy opening on easy**, per docs/DIRECTION.md's decided-but-unbuilt
point 2. `initialState.ts`'s `OPENING_PERTURBATION_SCALE` multiplies every
opening perturbation by 0.15 on easy (1 on medium/hard, byte-identical to
before), pulling the opening tight around the institution's already
near-equilibrium base values instead of spreading it across the
"moderately damaged" range every difficulty shared. The player now sees a
calm, controlled economy, sees exactly what breaks it, and knows what to
repair.

**Titles and living news.** `record.title` now actually reaches the player,
in a dedicated `MajorEventPanel` shown above the tabs (so it's visible
regardless of which panel is open) rather than folded into the generic
newswire list. `events/dispatches.ts` derives a running "story so far" log
purely from `eventLog` and `meetingIndex` — no new persisted state — so the
scripted `dispatchLines` reveal one per meeting while a crisis is still
inside its window, then stop.

**Markets that answer words harder in a crisis.** `applyPolicyPackage.ts`
gained `crisisIntensity(latent)`, read from the state a decision *inherits*
(never from what the decision itself is about to move), a weighted composite
of how far `marketVolatility`, `bankingStress`, `creditSpread` and
`geopoliticalRisk` sit above their calm baselines. It multiplies the tone's
market and expectations impact, the alarmed-tone volatility add, and the
guidance same-day jump's share by `1 + crisisAmplifier(1.2) *
crisisIntensity` — at intensity 1 (roughly what one major event produces on
its own), words move markets a bit over twice as hard as in calm weather.
Reassurance stopped being a flat bonus behind a hard `bankingStress >
base * 2` gate: it now scales smoothly with crisis intensity, relieves
market volatility and supports market trust (previously public trust only)
— but only when the package actually does something about the crisis (a
rate move, an escalated liquidity or support instrument, or binding
guidance, via a new `addressesCrisis` check). Reassuring words with nothing
behind them during a real crisis are hollow: they cost credibility and
market trust instead, priced like a broken promise. Staying silent above a
lower threshold costs market trust and adds volatility too — silence during
a real panic is a choice, not a neutral default. The Policy Desk's
Communication panel gets a short "markets right now" hint (calm/tense/
panicked), read from the published, exact `market_volatility` series —
never latent, matching every other panel in this build.

## What was measured

**The symmetry guard, `events/balance.test.ts`, fed/ecb easy, 150 seeds,
after tuning the six majors' magnitudes against it:**

| bucket | ratio (band 0.7-1.5) | net/meeting (band ±0.08) |
| --- | --- | --- |
| fed/easy | 1.205 | +0.0448 |
| ecb/easy | 1.200 | +0.0463 |

Comfortably inside both bands, and close to where the pre-major catalog
already sat (1.26/+0.043 and 1.15/+0.030 respectively — see "The hole,
plugged" above). Medium and hard are numerically untouched: the majors'
`maxDifficulty: 'easy'` excludes them from `eligibleEvents` entirely at
those difficulties, so their rows in this same suite did not move.

**How violent "violent" turned out to need to be.** The first pass, at
roughly 2.5x a comparable minor event's magnitude, changed nothing
measurable: worst-case banking stress over 60 passive fed/easy seeds
reached only 44 of the 79.75 watch tier, worst-case headline inflation only
11.0 of the 17.4 fail tier, and `npm run sim:sweep` reported 100 %
completion under every rule with medians *higher* than before. Scaling the
banking, market and supply channels up by a further 50-70% (final immediate
magnitudes: banking failure's `bankingStress +50`, market panic's
`marketVolatility +44`, the geopolitical crisis and supply rupture's
`supplyShock +4.0`, against `energy_price_spike`'s existing `+1.6` for
scale) moved worst-case passive banking stress to 72.8 (fed) / 58.1 (ecb)
and worst-case passive headline inflation to 14.34 / 11.29 — genuinely
close to their watch tiers without a passive run ever actually failing in
either 60-seed sample.

**The dilemma re-activated at higher stakes.** Sixty seeds of fed/easy and
ecb/easy played with a fixed `+75bp` and `+100bp` every meeting — the
existing stress-test policy from "The easy-mode deadlock" above — against
the new majors:

| policy | fed worst peak bankingStress | fed failures | ecb worst peak bankingStress | ecb failures |
| --- | --- | --- | --- | --- |
| +75bp every meeting | 100.0 (clamp) | 0/60 | 100.0 (clamp) | 0/60 |
| +100bp every meeting | 100.0 (clamp) | 1/60 | 100.0 (clamp) | 3/60 |

Aggressive over-tightening into the new crises now risks a genuine
banking-crisis failure where it previously only raised stress modestly —
the pincer from "The easy-mode deadlock" is live again, at a scale the
player can actually feel, without a single change to `BANKING.tighteningSpeed`
or any other constant that would dilute it. This is the intended shape:
the player who panics and over-tightens can lose; the player who reacts
proportionately should not.

**`npm run sim:sweep`, fed/easy and ecb/easy, 150 seeds, both with steps 1
and 2 in place:**

| bucket | doing nothing | staff rule | staff + honest guidance |
| --- | --- | --- | --- |
| fed/easy | 6491 (100 %) | 6640 (100 %) | **6680** (100 %) |
| ecb/easy | 5520 (100 %) | 5805 (100 %) | **5920** (100 %) |

Still 100 % completion under every rule measured — competent play (the
staff rule, and honest guidance on top of it) is exactly as safe as it was
before this session, satisfying docs/DIRECTION.md's non-negotiable "must be
winnable, must never trap." What moved is the *distribution*: medians fell
by 200-900 points versus the pre-major numbers in `docs/REPRISE.md`
(fed 6816→6491 doing nothing, 6904→6680 guided; ecb 6464→5520 doing nothing,
6687→5920 guided) and the tails widened sharply — ecb/easy's p10 fell from
comfortably above 6000 to 2554. Acting still beats doing nothing, and honest
guidance still beats silence, on both institutions; neither finding needed
touching.

**The falsifiable criterion, re-verified exactly, 120 paired seeds:**

| bucket | honest − silent, paired | wins | bluff − silent, paired |
| --- | --- | --- | --- |
| fed/easy | +34.9 (was +33.3) | 71 % (was 84 %) | −133.6 (was −152.3) |
| ecb/easy | +58.4 (was +50.0) | 83 % (was 74 %) | −132.6 (was −164.1) |

Both inequalities hold with the same comfortable margin as before — the
common-mode opening shock, injected identically inside each paired
comparison, mostly cancels the way any other paired shock does. The honest
win rate dropped on fed (84 %→71 %) as the added volatility makes the paired
comparison noisier meeting to meeting, but the *mean* gain, which is what
`engine/guidance.test.ts` actually pins, moved in the opposite direction.
`honestBroken`/`bluffBroken` (0.15/2.17 fed, 0.11/2.43 ecb) stayed on the
same side of their 0.4/0.9 bounds as always.

## Not chased tonight: a version-bump artefact on ecb/medium

Bumping `SIMULATION_VERSION` — the documented convention whenever a change
would replay a recorded run differently, which this session's changes to
easy's opening and to `applyPolicyPackage.ts` unambiguously are — reseeds
every draw in the game, exactly as it did at the 1.1.0→1.2.0 bump. That
reseed alone (nothing else changed; medium's catalog is untouched by
anything in this session) pushed `events/balance.test.ts`'s ecb/medium
net-per-meeting to +0.111, outside its ±0.08 band. The 1.1.0→1.2.0 bump hit
the same failure mode once before and it was a real, previously-hidden
structural tilt (`currency_pressure` missing its mirror) rather than pure
sampling noise, despite the suite's own 150-seed sample supposedly keeping
sampling error "well inside the margin." Diagnosing which this is requires
the same kind of investigation, and medium is explicitly out of scope
tonight. Rather than either chase an out-of-scope medium-difficulty fix or
weaken the guard to paper over a real signal, `SIMULATION_VERSION` stays at
`1.2.0` for now — the version bump remains correct and owed, just not
tonight, and not silently.

## What now protects each of these

| Guard | Fails when |
| --- | --- |
| `events/openingCrisis.test.ts` | the opener stops firing exactly once on easy, fires on medium/hard, ignores `openingEvent: false`, stops being deterministic, or consumes from the run's own RNG stream |
| `engine/initialState.test.ts` | easy's opening stops clustering tightly around the institution's calm baseline, or medium/hard's spread narrows to match it |
| `events/balance.test.ts` | (unchanged in mechanism) the majors' random firings push the delivered ratio or net-per-meeting outside their bands |
| `applyPolicyPackage.test.ts`, "markets answer words harder during a crisis" | crisis-scaled tone/guidance effects stop exceeding their calm-weather size, earned reassurance stops paying, hollow reassurance or silence stop costing during a real crisis, or any of this starts firing in calm weather |
| `engine/guidance.test.ts` | (unchanged bounds) the falsifiable criterion stops holding once a common-mode opening shock is paired into every comparison |

---

# Conduct has to cost, independent of the economy

Played after the previous session's work: a full fed/easy mandate played
seriously scored ~7000; the same mandate played as deliberate sabotage —
alternating ±100bp every meeting, announcing the opposite of every move —
scored ~5500. **21% between playing well and actively destroying the
economy.** The player's own diagnosis: "if sabotage costs so little, nothing
I do matters, which is why I click without reading. I don't even know, after
a good mandate, how I could have done better." Demanded before any fix: a
falsifiable criterion — sabotage under 1500 and a premature end in the
majority of seeds, passive clearly below competent, an order-of-magnitude
gap, not 20% — and a diagnosis of *why* the gap was so small before touching
anything.

## The diagnosis

Reproduced directly: alternating +100/-100bp with contrary announcements,
120 seeds (60 fed/easy, 60 ecb/easy), against `guidedStaffPackage(honest)`
as "serious." Three compounding causes, in the order they matter:

**1. The lag kernel is a low-pass filter, and alternation is a high-frequency
signal.** The post-convolution real-rate gap from alternating ±100bp came out
within 0.1-0.15pp of a flat hold's, on the same seed (measured: -0.19 vs
-0.28 fed, -1.09 vs -1.24 ecb). A signal that flips sign every meeting mostly
cancels inside the kernel's own window before it ever reaches inflation or
output. Sabotage-by-alternation barely dents the real economy at all — which
is *why* nothing the player did seemed to matter: mechanically, most of it
didn't.

**2. Nothing tracked contradictions.** `detectContradictions` priced a
contradictory package instantly, into credibility and market trust, and then
forgot it happened. Unlike broken guidance promises (`guidance.brokenPromises`,
a running tally), a *pattern* of "say the opposite of what you do" left no
persistent trace for the score or the end conditions to see, beyond whatever
was left of one instant hit after mean-reversion pulled credibility back up.

**3. The components that stayed high were the majority of the weight.**
Because the real economy barely moved (#1), `employment_output`,
`financial_stability` and `anchoring` — over half the weight on both
institutions — sat at 91-100% raw even under sustained sabotage. The one
component built for exactly this, `policy_volatility`, correctly crashed to
0.1% raw — but it is only 3-4% weight, so crushing it to zero removes at most
4 points off 100. ECB's `price_stability` genuinely cratered to 5.9% raw, and
its 38% weight plus the price-stability gate *still* only pulled the total
down ~10%, because everything else propped it back up. None of the eight end
conditions got remotely close either: final credibility landed at 40-63%
against a ~17%-sustained-for-four-meetings bar, so completion paid out 100%
regardless, every time, in 60 of 60 seeds.

In short: **the game had no mechanism at all for punishing incoherent conduct
that the real economy happened to absorb gracefully** — which is exactly what
alternating-and-lying is.

## The fix

**Contradictions are now tracked, not just priced and forgotten.**
`SimulationState.contradictionCost` — a running sum of every confirmed
package's contradiction severity, mirroring `guidance.brokenPromises`'s
existing pattern exactly — lets the score and (via the credibility it costs)
the end conditions see a *pattern*, not just the isolated instant hit.

**A new `reversalCount`, and an escalating cost for whiplash.** Sharply
reversing the *previous* meeting's rate direction now costs credibility and
market trust on its own, independent of what was said about it — a committee
that cannot hold a direction erodes confidence in its own judgement whether
or not its words ever contradict its actions. This cannot be a flat cost:
the staff rule itself legitimately reverses once or twice across a typical
mandate, reacting to real data (most often an artefact of its own
quarter-step smoothing overshooting a nearby target), and a flat cost large
enough to matter for sabotage was large enough to make the *honest* rule
lose to silence — inverting `engine/guidance.test.ts`'s falsifiable criterion
outright the first time this was tried (measured: -310.8pp on fed, -97.2pp
on ecb, against a needed >+10/+20). `COMMUNICATION.freeReversals` (2) gives
every mandate the same benefit of the doubt a real committee would get; the
cost escalates with the count only once the pattern itself is the story.

**A new conduct gate, `CONDUCT_GATE` in `config/scoring.ts`, both
institutions.** Multiplicative on the whole score, the same mechanism shape
as the existing ECB-only price-stability gate: three independent exponential
factors — churn beyond its existing free allowance, contradiction severity
beyond a new free allowance, broken promises beyond a new free allowance —
so genuinely incoherent conduct (bad on more than one axis at once, which
alternating-and-lying is) is punished harder than any single axis implies.
The free allowances matter as much as the scales: measured directly, a
*single* broken promise — `guidedStaffPackage`'s honest mode breaks 0.1-0.15
per mandate as an already-priced, already-acceptable artefact of its target
shifting on noisy data (see "The falsifiable criterion" above) — cut a
seed's score from ~6600 to 3250 with no free allowance, which was severe
enough to invert the falsifiable criterion a second time before the
allowance was added.

**All three mechanisms are scoped to easy.** The first attempt applied them
at every difficulty and broke medium and hard badly: fed/hard completion fell
from 22-27% to 7%, and credibility hit its safety clamp 41 times in 150
seeded runs. Medium and hard's own observation noise (1.0x and 1.7x against
easy's 0.35x) makes the staff rule's own target legitimately jump far more
often — already documented above as *correct*, hard-mode behaviour, not a
bug — and these mechanisms, tuned against easy's quieter data, read that
legitimate jumpiness as sabotage. `inconsistencyCost` is now a per-difficulty
record (medium/hard unchanged at the pre-existing 4.5); `reversalCost` and
the conduct gate are gated on `difficulty === 'easy'` outright.
Contradictions and reversals are still *tracked* at every difficulty — cheap
bookkeeping, and a natural extension point — just not *billed* outside easy.

## What was measured, final

**The falsifiable criterion, sixty seeds per institution, both commitment
levels a player might reach for when trying to announce the opposite of an
action (`weak_bias` and, separately verified, `conditional_path`):**

| | fed/easy | ecb/easy |
| --- | --- | --- |
| serious (guided honest staff) | 6624 (100% complete) | 6494 (100% complete) |
| passive (hold everything) | 6372 (100% complete) | 6225 (100% complete) |
| sabotage, `weak_bias` | **442**, dismissed 60/60 | **458**, dismissed 60/60 |
| sabotage, `none` commitment | **640**, dismissed 60/60 | **589**, dismissed 60/60 |

All under the 1500 bar with room, all dismissed in 100% of seeds (the
criterion asked for a majority), and serious/sabotage is a 10-15x gap —
genuinely an order of magnitude, on every combination measured. `none`
commitment sabotage now dismisses too: the escalating reversal cost fires on
churn alone, independent of whether contradictions can register (they
structurally cannot under `commitment: 'none'` — see below), so the fix does
not depend on which button a sabotaging player happens to reach for.

**Passive stays clearly below competent**, unchanged by any of this (passive
has zero churn, zero contradictions, zero reversals, so none of the three new
mechanisms touch it): 6372 vs 6624 fed, 6225 vs 6494 ecb. This gap was not
widened — nothing in today's fix targets it, and the falsifiable criterion
did not ask for more than "clearly below," which it already was.

**Medium and hard, confirmed restored exactly:** `npm run sim:sweep`
before and after this fix's difficulty-scoping produced the same three
pre-existing warnings (fed/medium passive-dominant, fed/hard and ecb/hard
`geopoliticalRisk` safety clamps — both already recorded earlier in this
file) and no others. The credibility-clamp warnings the unscoped first
attempt introduced are gone.

**The falsifiable criterion in `engine/guidance.test.ts`, re-verified
passing** after the free-allowance fixes, with its original margins intact.

## One deliberate non-fix

`deriveTone` (`features/policy/statement.ts`) discards the announced path
entirely when `commitment === 'none'` — "a mere remark, never recorded" —
so a package announcing the opposite of its own action while at the default,
unbound commitment level cannot mechanically register as a contradiction,
by design, with its own test (`statement.test.ts`, "ignores a path that a
mere remark never records") and its own docstring predating tonight. This
was considered and deliberately **not** reversed: it is a prior session's
considered design choice, not a bug tonight's work happened to trip over,
and reversing it was not necessary — the escalating reversal cost alone
(which does not depend on commitment level at all) already reaches 100%
dismissal for `commitment: 'none'` sabotage on its own, per the table above.

## What now protects each of these

| Guard | Fails when |
| --- | --- |
| `applyPolicyPackage.test.ts`, "conduct is priced independently of the economy, on easy" | contradiction cost stops accumulating, reversals stop being free up to `freeReversals` then escalating, or any of it starts being billed on medium/hard |
| `calculateScore.test.ts`, "the conduct gate" | the gate stops being 1 for a clean mandate or for conduct within the free allowances, stops crushing heavy contradiction/broken-promise conduct on easy, or fires at all on medium/hard |
| `features/result/report.test.ts`, "leads why this score with conduct..." | the written postmortem stops naming conduct as the dominant story when the gate is severe |
| `engine/guidance.test.ts` | (unchanged bounds, re-verified) honest guidance stops beating silence now that a single ordinary broken promise sits inside the conduct gate's free allowance |

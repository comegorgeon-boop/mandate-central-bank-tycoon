# Open balance question

**Status: diagnosed, design direction retained, calibration outstanding.**
Carried forward from build 2 (simulation engine). The direction below is
decided; the numbers are to be set in phase 3, against a real playthrough.

The engine is correct and tested. What has *not* been established is whether
the player's decisions materially change the outcome. This document records
the evidence so the next session does not have to rediscover it.

## The finding

`npm run sim:sweep` plays 150 seeded runs per institution and difficulty under
three policies: a Taylor-style rule reacting to observed inflation and the
real-time output gap, the same rule ignoring the gap, and doing nothing at all.

Median score, and completion rate, from engine 1.0.0:

| Bucket | Taylor rule | Ignoring the gap | Doing nothing |
| --- | --- | --- | --- |
| fed/easy | 6815 (100 %) | 6819 (100 %) | 6793 (100 %) |
| fed/medium | 6583 (99 %) | 6528 (98 %) | **6947 (100 %)** |
| fed/hard | 5532 (11 %) | 5565 (9 %) | **6211 (17 %)** |
| ecb/easy | 6900 (100 %) | 6900 (100 %) | 6771 (100 %) |
| ecb/medium | 5399 (96 %) | 5237 (95 %) | 4919 (98 %) |
| ecb/hard | 2902 (9 %) | 2966 (9 %) | 2947 (13 %) |

Two things stand out.

**Doing nothing is competitive, and on fed/medium and fed/hard it wins.** A
game in which the passive policy is the best policy has no decision problem in
it.

**Hard completes only 9–11 %**, and the failures are dominated by one mode:
banking crisis accounts for 81 of 150 failures on fed/hard and 87 of 150 on
ecb/hard. A single catastrophe family swamping the others makes the difficulty
feel arbitrary rather than demanding.

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
per meeting:

| Difficulty | Meetings | Peak lag | Loops now | Target peak | Loops at target |
| --- | --- | --- | --- | --- | --- |
| easy | 8 | 3.5 meetings | **1.8** | 1–2 meetings | ~3.2 |
| medium | 16 | 5.5 meetings | 2.5 | 3–4 meetings | ~3.6 |
| hard | 32 | 7.5 meetings | 3.8 | 6–8 meetings | ~4.0 |

Easy is the broken case: under two closed loops. The demo run confirms it —
250bp of tightening across the whole mandate barely moves the output gap.
Hard is already close to its target and needs little change.

Note what the target column does: the loop count becomes roughly constant
across difficulties. **What difficulty changes is not how many chances you
get, but whether you can react or must anticipate.** Easy at a one-to-two
meeting peak is a reacting game. Hard at six to eight is full realism, where
the only workable strategy is to act on the forecast.

Four decisions follow.

### 1. The lag becomes a difficulty parameter, calibrated on the ratio

`LAG_KERNEL` already varies by difficulty; today it varies too little and in
the wrong proportion. Retarget it on the loop count rather than on realism per
difficulty: peak toward one to two meetings on easy, three to four on medium,
six to eight on hard. Only hard needs to be realistic.

This is a configuration change in `config/time.ts`, not an engine change. The
transmission test in `engine/transmission.test.ts` asserts the *shape* of the
response, not its calibration, so it should survive — but it pins a 24-meeting
horizon on hard and will need its thresholds rechecked.

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

The decisive test is a policy that is actually good, rather than two that are
plausible. Options, cheapest first:

1. **Play it.** This is the fastest signal and the reason it is flagged for
   phase 3 — see below.
2. **Grid-search the rule.** Sweep the coefficients on inflation, the gap, and
   the smoothing term over a coarse grid, per bucket, and report the best
   scoring rule found. If some rule beats passive comfortably, explanation 1
   holds and the engine is fine.
3. **Check the core-versus-headline split.** Re-run the sweep with a rule that
   reacts to *core* inflation instead of headline. If that alone beats passive,
   the finding was entirely about the benchmark.

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

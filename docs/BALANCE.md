# Open balance question

**Status: unresolved. Carried forward from build 2 (simulation engine) to the
balancing pass.**

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

The first genuine playthrough answers this faster than any sweep. While
playing, look for:

- Does a deliberate, well-reasoned decision visibly change the path within the
  mandate, or does the economy arrive where it was going regardless?
- Does holding for eight consecutive meetings feel like a viable strategy? On
  easy it may legitimately be one — that is a training mandate — but it must
  not be on medium or hard.
- On hard, does a banking crisis feel earned, with the warning tier giving
  usable notice, or does it arrive as the default ending?
- Are the warning clues arriving early enough to act on, given the
  transmission lag peaks around three quarters out?

If decisions do feel consequential in play, this whole finding was about the
benchmark rules and can be closed.

## Levers, if tuning turns out to be needed

In rough order of how much they would change:

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

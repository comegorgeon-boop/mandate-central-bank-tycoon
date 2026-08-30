# Reprise — where this session stopped

Written at the end of the session that built communication as a second
instrument, to be read before the next one. `docs/BALANCE.md` and
`docs/DIRECTION.md` are the permanent record; this file is a handoff and can
be deleted once its open items are folded into those two.

## Branch state

`balance/easy-mode-transmission`, three commits ahead of `main`, tree clean:

```
f400a1d Give the second instrument its desk: sentences to choose, a statement to confirm
526b359 Make communication a second instrument: guidance from easy, judged by a promise ledger
6f8cb73 Weigh the event guard by delivered impulse, and pair relief with shock by magnitude
```

`npm run build`, `npm test` (392 tests), and `npm run sim:sweep` all green as
of this commit. `main` is untouched. Not merged.

## What the three commits did

1. **The event-catalog guard-rail.** `events/balance.test.ts` was counting
   firings by sign, so a relief event paired with its shock by name could
   deliver half its impulse and still pass — the energy pair was 2:1. The
   guard now weighs delivered impulse (`inflationImpulse` evaluated in the
   state each event actually fired in), and the catalog is rebalanced to
   match by magnitude, not by name. Realised catalog drift on fed/easy:
   +1.00pp → +0.58pp. Full detail in BALANCE.md, "The hole, plugged".

2. **Communication as a second instrument, the mechanism.** A package now
   carries an announced rate path and a commitment strength alongside the
   rate, open from easy. Three clocks — the priced path answers an
   announcement the same day, a standing announcement pulls one-year
   expectations between meetings, and at eight meetings (~one year) the
   promise comes due, judged and expired. A promise ledger prices the
   difference between delivering and defaulting; five exploits that would
   have made talk free are closed and named in `guidance.test.ts`. Full
   mechanism, all five exploits, and the falsifiable criterion's numbers are
   in BALANCE.md, "The second instrument: communication and guidance".

3. **The desk.** Plain-language controls per the register rule — the player
   picks sentences ("We expect to go somewhat further", "A conditional
   commitment"), the basis points ride along as footnotes. The statement is
   shown verbatim before confirmation. The same-day reaction and the stance
   strip now surface the widened fast channel, including credibility.
   `enginePathParity` now exercises a package with guidance end to end.

## The falsifiable criterion — passed

The commitment made before building anything: a staff rule announcing its own
intentions honestly must beat the same rule staying silent, and the same rule
announcing a path it never delivers must lose to silence, or the axis does not
ship. Paired per seed (same shocks inside each pair), 120 seeds, easy:

| bucket | honest − silent | bluff − silent |
| --- | --- | --- |
| fed/easy | **+33.3** (se 4.6), wins 84 % of seeds | **−152.3** (se 20.4) |
| ecb/easy | **+50.0** (se 6.9), wins 74 % of seeds | **−164.1** (se 34.8) |

Both margins pinned in `engine/guidance.test.ts` at well under a third of the
measured effect, so recalibration has room without the test going stale.

## The sweep, engine 1.2.0, events on, 150 seeds/bucket

| bucket | doing nothing | staff rule | staff + honest guidance |
| --- | --- | --- | --- |
| fed/easy | 6816 (100 %) | 6848 (100 %) | **6904** (100 %) |
| fed/medium | **7163** (99 %) | 7073 (99 %) | 7118 (99 %) |
| fed/hard | 6261 (27 %) | 6122 (30 %) | 6512 (**3 %**) |
| ecb/easy | 6464 (100 %) | 6637 (100 %) | **6687** (100 %) |
| ecb/medium | 5985 (99 %) | 6149 (99 %) | **6328** (99 %) |
| ecb/hard | 2892 (19 %) | 2927 (23 %) | 3234 (**3 %**) |

Guidance outscores silence on all six buckets. Two things flagged, neither
touched tonight:

- **fed/medium**: passive still wins narrowly (7163 vs 7118). Pre-existing
  structural finding, not a regression — the rebalanced catalog leaves less
  inflation to correct, which re-exposes the Fed's opening-near-equilibrium
  problem recorded earlier in BALANCE.md.
- **hard, honest guidance under a conditional commitment: 3 % completion**,
  against 27–30 % for the silent rules. Hard's observation noise makes the
  rule's own target jump meeting to meeting, so it keeps rewriting a binding
  promise and bleeds credibility. This reads as *correct* — committing firmly
  to a path read off untrustworthy data should be dangerous — but it means no
  future hard-mode advisor should use `conditional_path` unconditionally, and
  hard-mode balance work must not treat honest-guided-staff as a safe
  benchmark.

## What is NOT yet measured — the actual open item

The pre-guidance "easy-mode deadlock" section of BALANCE.md measured a
specific thing: a ladder of fixed rate-only policies (hold, +25bp, +50bp,
+75bp, +100bp every meeting), events on, reporting the share of 150 runs
ending within 0.5pp of target. That table has **not been re-run with a
combined rate+guidance policy**. The sweep above shows guidance adds score and
beats silence — it does not by itself show the specific deadlock (no
trajectory reaches target) is broken, because "beats the silent rule" and
"reaches the target" are different claims.

This is deliberate, not an oversight: the user's plan for this session put a
full playthrough after the mechanism, ahead of any further measurement — "I
replay a full mandate — that decides what's next, not a measurement." Building
that fixed-policy-ladder-with-guidance table before the playthrough would have
pre-empted the thing the playthrough exists to settle.

## Next session

1. **Play a full fed/easy mandate** using the desk built tonight — the rate
   and the statement together. This is the signal the plan calls for.
2. If the mandate feels winnable and the guidance axis feels like a real
   decision (not a bonus modifier): fold this file's findings into
   `docs/BALANCE.md` and `docs/DIRECTION.md` proper, delete this file, and
   move to the next item in DIRECTION.md (the designed openings per
   difficulty, or the market as a channel of play).
3. **If it is not winnable**: the fallback was agreed in advance and is still
   available — extend easy to 12 meetings (it already is: `MEETING_COUNT.easy
   = 12`, done in an earlier session) and accelerate the Phillips curve
   further. Re-run `npm run sim:sweep` and, this time, the fixed-policy target
   ladder from the deadlock section, with guidance included in the fixed
   policies compared.
4. Either way, re-run the specific measurement described above — a ladder of
   `{rate move, announced signal, commitment}` triples, events on, 150 seeds,
   reporting share within 0.5pp of target — before writing any winnability
   claim into BALANCE.md. This is the one number tonight's work does not yet
   have.

## Reproducing tonight's numbers

```bash
npm test -- src/simulation/engine/guidance.test.ts   # the falsifiable criterion, pinned
npm run sim:sweep                                     # the six-bucket table above
```

The paired honest/bluff comparison with standard errors is not in the
committed sweep output (the sweep reports medians only); it lives in the
`guidance.test.ts` assertions, which recompute it every run.

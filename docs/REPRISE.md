# Reprise — where this session stopped

Written at the end of the session that gave easy mode a story: violent named
events, a healthy opening, markets that answer words during a crisis, and a
written mandate postmortem. To be read before the next one.
`docs/BALANCE.md` and `docs/DIRECTION.md` are the permanent record; this file
is a handoff and can be deleted once its open items are folded into those
two.

## Branch state

`balance/easy-mode-transmission`, five commits ahead of last session's
stopping point, tree clean:

```
a249ef0 Mark DIRECTION.md point 4 built, now that the postmortem report exists
d2e38b5 Write the mandate postmortem: what happened, what you did, why this score
8b5d6b7 Re-verify winnability and the symmetry guard, write up the findings
3e8dcfc Make markets answer words harder in a crisis, and price silence and spin
edd6602 Give easy mode a story: a healthy opening, a named crisis, living news
```

`npm run build`, `npm test` (415 tests, up from 392), and `npm run
sim:sweep` all green as of this commit. `main` is untouched. Not merged.
Verified end to end in a real browser too (Playwright driven directly
against the Vite dev server — no project run-skill existed for this app; a
future session may want `/run-skill-generator` to capture that setup).

## What the four chantiers did

The user's brief, in one sentence each: nothing happened in easy mode, so
nothing said mattered either. Fixed in the stated order.

1. **Violent named events.** Six major crises (`events/catalog.ts`, `tier:
   'major'`, `easy`-only) — a geopolitical crisis, a domestic political
   shock, a bank failure, a housing crash, a supply rupture, a market panic
   — each 2-4x a comparable minor event, arced shock → complication →
   uneasy stabilisation. One fires unconditionally at the first meeting of
   every easy mandate (`events/openingCrisis.ts`), on an economy that now
   opens healthy (`initialState.ts`'s `OPENING_PERTURBATION_SCALE`, 0.15 on
   easy). Titles and full newswire finally reach the player — previously
   dead data — in a dedicated `MajorEventPanel`, with a "story so far" log
   fed by scripted dispatch lines and derived purely from `eventLog`.
2. **Markets that answer words hard in a crisis.** `crisisIntensity(latent)`
   in `applyPolicyPackage.ts` scales the whole communication channel by up
   to ~2.6x at the intensity one major event produces on its own.
   Reassurance now scales smoothly with crisis intensity and only pays when
   backed by an actual action; hollow reassurance and silence during a real
   crisis both cost. A "markets right now" hint on the desk, read from
   published data only.
3. **Re-verified, not diluted.** Both fed/easy and ecb/easy stayed at 100 %
   completion under every rule `sim:sweep` measures, while medians fell
   200-900 points and tails widened sharply (ecb/easy's p10: >6000 → 2554).
   Aggressive over-tightening into the new crises now risks a real
   banking-crisis failure (1-3/60 seeds at +100bp every meeting) where it
   previously only raised stress modestly. The symmetry guard
   (`events/balance.test.ts`) and the guidance falsifiable criterion both
   hold with comfortable margins, re-measured exactly.
4. **The written postmortem.** `features/result/report.ts`, deterministic
   templates in `brief.ts`'s style, assembled from a finished session's own
   data. `ResultPage.tsx` now leads with it; the score and component table
   are a demoted "Scorecard" below.

Full mechanism, every measured number, and what now guards each finding as
a test: docs/BALANCE.md, "Violent named events, and markets that answer
them". docs/DIRECTION.md points 1, 2 (easy column) and 4 are now marked
built; point 3 (market as a channel of play) has a first real instance.

## What is deliberately NOT done

- **`SIMULATION_VERSION` was not bumped**, despite the project's own
  convention calling for it (easy's opening and `applyPolicyPackage.ts`'s
  coefficients both changed in ways that would replay a recorded run
  differently). Bumping reseeds everything and pushes
  `events/balance.test.ts`'s **ecb/medium** net-per-meeting to +0.111
  (band ±0.08) — a bucket nothing in this session touches. The identical
  failure mode happened once before at the 1.1.0→1.2.0 bump and turned out
  to be a real hidden tilt (`currency_pressure` missing its mirror), not
  noise, despite the suite's 150-seed sample. Medium is out of scope for
  the sessions that built this; diagnosing which this is needs its own
  investigation. Recorded in docs/BALANCE.md, not silently dropped. **The
  version bump is still owed** — do it whenever medium-difficulty balance
  is next in scope, immediately after (or alongside) whatever fixes that
  ecb/medium finding.
- **Medium and hard untouched everywhere**, exactly as instructed: no new
  catalog content reaches them (`maxDifficulty: 'easy'`), no threshold or
  lag constant was touched, `docs/DIRECTION.md`'s hard-mode "damaged
  opening, no identifiable culprit" column remains unbuilt.
- **The market is not yet a channel the player reads and times a step
  ahead of the decision** — `docs/DIRECTION.md` point 3's fuller vision.
  Tonight's crisis-scaled communication is a same-meeting mechanic only.
- **DIRECTION.md points 5-6** (a summary tab; showing only what's
  actionable on easy) untouched.
- No new balance levers were pulled beyond the event magnitudes themselves
  — winnability held without needing `thresholdLeniency`, `breachPatience`,
  or `MEETING_COUNT.easy` touched, so none of the "adjust elsewhere"
  fallback options in the plan were exercised.

## Next session

1. Play a fed/easy mandate (and an ecb/easy one) on this branch. This is
   the first session where a violent, named crisis and a genuinely
   different report screen exist together — the natural next check is
   whether it *reads* as dramatic in play, the way the numbers say it is.
2. If it plays well: merge to `main`, then decide between (a) medium/hard's
   designed openings (`docs/DIRECTION.md` point 2's hard column), (b) the
   deeper market-as-channel vision (point 3), or (c) the version-bump/
   ecb-medium investigation, before it gets stale.
3. If it doesn't: the plan's own fallback levers are listed above and
   untouched, so there is room to tune without new content work.

## Reproducing tonight's numbers

```bash
npm test -- src/simulation/events/openingCrisis.test.ts   # the opener: determinism, scope, RNG isolation
npm test -- src/simulation/engine/initialState.test.ts    # the healthy easy opening
npm test -- src/simulation/events/balance.test.ts         # the symmetry guard, majors included
npm test -- src/simulation/engine/guidance.test.ts         # the falsifiable criterion, re-verified
npm test -- src/simulation/engine/applyPolicyPackage.test.ts  # crisis-scaled communication
npm test -- src/features/result/report.test.ts            # the written postmortem
npm run sim:sweep                                          # the six-bucket table
```

The worst-case-passive-stress probes, the aggressive-tightening failure
rates, and the exact falsifiable-criterion numbers in docs/BALANCE.md were
one-off measurement scripts, not committed — reproduce by adapting
`events/balance.test.ts`'s `deliveredImpulses` or `engine/guidance.test.ts`'s
criterion loop with `playRun`/`console.log` in place of `expect`.

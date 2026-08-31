# Reprise — where this session stopped

Written at the end of a two-chantier session: first, a story for easy mode
(violent named events, a healthy opening, markets that answer words during a
crisis, a written postmortem); second, fixing the score so sabotage actually
costs and a mandate can genuinely be lost. To be read before the next one.
`docs/BALANCE.md` and `docs/DIRECTION.md` are the permanent record; this file
is a handoff and can be deleted once its open items are folded into those
two.

## Branch state

`balance/easy-mode-transmission`, seven commits ahead of last session's
stopping point, tree clean:

```
9d1b08f Make sabotage actually cost, and make it possible to lose
3adb16c Record tonight's stopping point: a story, listenable markets, a postmortem
a249ef0 Mark DIRECTION.md point 4 built, now that the postmortem report exists
d2e38b5 Write the mandate postmortem: what happened, what you did, why this score
8b5d6b7 Re-verify winnability and the symmetry guard, write up the findings
3e8dcfc Make markets answer words harder in a crisis, and price silence and spin
edd6602 Give easy mode a story: a healthy opening, a named crisis, living news
```

`npm run build`, `npm test` (425 tests, up from 392 at the start of the
night), and `npm run sim:sweep` all green as of this commit. `main` is
untouched. Not merged. Verified end to end in a real browser both times
tonight (Playwright driven directly against the Vite dev server — still no
project run-skill for this app; worth `/run-skill-generator` if a third
session ends up doing this again).

## Chantier 1: a story, and markets that answer it

Six major named crises, one guaranteed at meeting 1 on easy (on an economy
that now opens healthy instead of "moderately damaged"), a living "story so
far" dispatch log, and communication that lands up to ~2.6x harder once
markets are keyed up — reassurance only pays when backed by action, silence
and hollow reassurance both cost during a real crisis. Re-verified: both
fed/easy and ecb/easy still complete 100% of the time for competent play
(never trapped), while medians fell 200-900 points and tails widened
sharply — real stakes where there were none. Full writeup: docs/BALANCE.md,
"Violent named events, and markets that answer them."

## Chantier 2: sabotage now costs, and you can lose

The player played two mandates on chantier 1's build: seriously (~7000),
then deliberately sabotaging with alternating ±100bp and contrary
announcements (~5500) — only 21% apart, and the mandate always completed.
Diagnosed first, as instructed, before any fix: the transmission lag kernel
smooths alternation almost to nothing before it reaches the real economy;
nothing tracked a *pattern* of contradiction, only an isolated instant hit;
and the components that stayed high regardless were over half the score's
weight. Fixed with three easy-only mechanisms — a running contradiction
tally, an escalating reversal cost (with a free-pivot allowance, or it broke
the honest guided rule), and a new multiplicative conduct gate mirroring the
ECB's existing price-stability gate. Sabotage now scores 442-640 (target
<1500) and dismisses in 100% of seeds (target: majority), at every
commitment level tested — an order of magnitude below serious play. A first,
difficulty-unscoped attempt broke medium/hard badly and was caught and fixed
before committing. Full writeup: docs/BALANCE.md, "Conduct has to cost,
independent of the economy."

**One deliberate non-fix, worth knowing before touching this area again:**
`features/policy/statement.ts`'s `deriveTone` discards the announced path
when `commitment === 'none'` — a prior session's considered design ("a mere
remark, never recorded"), not a bug. Sabotage at `commitment: 'none'` still
dismisses reliably (the reversal cost doesn't depend on commitment level at
all), so this was left exactly as it was.

## What is NOT done

- **Doctrines**, and three smaller ideas (a dated objective, a press
  conference with a question to answer, a committee no-confidence vote), are
  written up in full in `docs/DIRECTION.md` but **not implemented**, per this
  session's explicit instruction. That document has the design, the open
  questions, and why doctrines specifically (tying the game to the French
  ESH prépa syllabus the player is studying).
- **`SIMULATION_VERSION` was not bumped**, despite real replay-affecting
  changes across both chantiers tonight. Bumping reseeds everything and
  exposes a pre-existing ecb/medium balance fragility unrelated to tonight's
  work (recorded in detail under chantier 1's writeup in docs/BALANCE.md).
  Still owed, not tonight.
- **Medium and hard untouched** everywhere, both chantiers, as instructed
  both times: no new catalog content reaches them, no threshold or lag
  constant was touched, and the new conduct mechanisms are explicitly
  gated off outside easy.
- The market is still not a channel the player reads and times a step ahead
  of the decision (`docs/DIRECTION.md` point 3's fuller vision) — chantier
  1's crisis-scaled communication is a same-meeting mechanic only.
- `docs/DIRECTION.md` points 5-6 (a summary tab; showing only what's
  actionable on easy) untouched.

## Next session

1. **Play fed/easy and ecb/easy again on this branch.** Two things changed
   enough since the last playthrough to be worth re-checking in play, not
   just in the sweep: does the opening crisis + the new stakes read as
   *fair* when you lose (the postmortem should make the reason legible, not
   just the number), and does an *honest* mistake (not deliberate sabotage —
   a legitimate pivot, or getting caught out by noisy data) ever feel
   punished the way sabotage is? The free allowances were tuned against
   `guidedStaffPackage`'s own behaviour, not a human's.
2. If it plays well: merge to `main`, then pick up doctrines
   (`docs/DIRECTION.md`) — it's the largest, most differentiating idea on
   the table and the one explicitly tied to why the player is building this
   at all.
3. If something still doesn't sit right: both chantiers' docs sections list
   exactly what was measured and where the remaining looseness is (the
   passive-vs-competent gap in chantier 2 is still only ~4%, noted but not
   touched since the criterion only asked for "clearly below").

## Reproducing tonight's numbers

```bash
npm test -- src/simulation/events/openingCrisis.test.ts        # the opener
npm test -- src/simulation/engine/initialState.test.ts          # the healthy easy opening
npm test -- src/simulation/events/balance.test.ts                # the symmetry guard, majors included
npm test -- src/simulation/engine/applyPolicyPackage.test.ts     # crisis-scaled communication + conduct pricing
npm test -- src/simulation/scoring/calculateScore.test.ts        # the conduct gate
npm test -- src/simulation/engine/guidance.test.ts                # the falsifiable criterion, twice re-verified tonight
npm test -- src/features/result/report.test.ts                   # the written postmortem, both chantiers
npm run sim:sweep                                                 # the six-bucket table
```

The worst-case-passive-stress probes, the aggressive-tightening failure
rates, the exact falsifiable-criterion numbers, and the sabotage/serious/
passive comparison table were all one-off measurement scripts, not
committed — reproduce by adapting `events/balance.test.ts`'s
`deliveredImpulses` or `engine/guidance.test.ts`'s criterion loop with
`playRun`/`console.log` in place of `expect`.

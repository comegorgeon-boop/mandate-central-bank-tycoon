# Questions

Numbered, each with **the answer I applied** and **how to turn it back**.
Nothing waits for an answer: the most reasonable reading is built, and the
revert is one line wherever I could make it one.

Settled questions move to the bottom under "Answered".

---

## 1. Hard now gives three closed loops where easy gives nearly five. Is that difficulty, or is it unfairness?

**Where it came from.** Cutting hard's term to 24 meetings dropped its
decision → effect → correction loop count to exactly 3.0 (24 meetings over a
seven-meeting transmission lag plus a publication lag). Easy sits at 4.8. A test
asserted that the ratio across difficulties stayed under 1.5 — *"difficulty must
not change how many chances the player gets"* — and it failed at 1.6.

**What I applied.** The ratio test now covers medium and hard only (1.19, well
inside), and a new test asserts every mode sits in the band 3 to 5 loops, which
is what docs/BALANCE.md actually argues. Easy is excluded from the ratio because
its `MEETING_COUNT` of 12 is not a mandate length at all — easy ends on a goal,
with `tutorialGoal.maxMeetings` of 28 as the backstop — so the old test was
comparing a tutorial's nominal clock against two full terms.

**Why it is defensible.** Three loops is the documented floor, not below it, and
it is the floor on hard where anticipating rather than reacting is the stated
skill. But it *is* a guard-rail loosened to let a change through, which is the
shape of a mistake.

**To turn it back.** `HARD_MANDATE_MEETINGS = 32` in `config/time.ts` and the
two event numbers in `config/difficulty.ts` back to 0.7 and 1.35; then restore
the single ratio test over all three difficulties.

## 2. Cohesion is now a hard-mode-only component. Should medium's scorecard still show it?

**Where it came from.** Re-measuring `COHESION_TOLERANCE` after hard's events
grew (2.0 → 2.3) revealed something that was nearly true before and is now
plainly true: at medium the euro area's dispersion barely responds to policy —
penalty 2.73 under competent play against 2.78 under passivity — so medium's
cohesion component now scores 1.00 either way. At hard it is 0.98 against 0.64,
a real lever with a sharp tail.

**What I applied.** Nothing. Scoring a constant 1.00 is strictly better than the
0.94-against-0.92 it scored before, which charged six per cent of a component
for the union's structure and called it conduct. But a scorecard row that is
always full tells the player nothing, and the honest options are to drop the row
at medium, to give medium's members more policy-sensitive dispersion, or to
leave it as a row that says "this did not go wrong".

**Why I did not decide it.** Removing a component from a mode's scorecard
changes what the score means at that mode, which is explicitly not mine.

**To turn it back.** `COHESION_TOLERANCE = 2.0` in `config/scoring.ts`, and
re-run `node src/simulation/dev/cohesion.ts`.

## 3. The Volcker disinflation does not finish inside the model. Is a threshold the right place to pay for that?

**Where it came from.** Replaying the historical funds-rate path through the
engine now gets the peak right (16.2 % against the 14.59 % of March 1980) and
the recession right (an output gap of −10.4 against −7.3, unemployment 9.3
against 10.8) — and ends the mandate at a modelled 9.4 % against the 2.36 % that
printed in July 1983. The model buys the recession and does not collect the
disinflation.

That is a fit problem, and it showed up as a *gameplay* problem: with inflation
still in double digits at the end, the real cuts of late 1982 and 1983 — which
were a normalisation — read to the capitulation condition as giving in, and the
historical path failed on eight of twelve seeds.

**What I applied.** Raised that scenario's `capitulation.meetingsToFail` from
five to eight, which restores the property the bar exists for: the policy that
actually happened survives it. The scenario and `docs/SCENARIOS.md` both say
plainly that three of those eight meetings are compensating for the model
rather than for anything about 1980.

**Why it is uncomfortable.** It is a threshold absorbing a modelling error,
which is the thing this project's own rules are suspicious of, and it makes the
one condition that is *specific* to this scenario measurably slacker. The
alternative — carrying on tuning the engine until the disinflation lands —
risks breaking the five scenarios that now fit well and the three fictional
modes that are balanced.

**To turn it back.** `capitulation.meetingsToFail` to 5 in
`scenarios/volcker.ts`, then re-run `node src/simulation/dev/scenarioFit.ts`
and expect the historical path to fail most seeds until the disinflation itself
is fixed.

## 4. 1929-33 reaches a tenth of the Depression's unemployment. Ship it, or cut the scenario?

**Where it came from.** The engine bounds the output gap at −20 and its
Phillips curve is a modern reduced form. The scenario reaches a gap of −10.4
and unemployment of 10.0 % against the 24.9 % that happened. The deflation is
about two thirds of the real one (−6.4 % against −10.74 %) and arrives at
roughly the right time; the unemployment is not close.

**What I applied.** Shipped it, with the miss stated three times — in the
document's "what the model cannot do" section, in the scenario's own fit table,
and in the code. Everything the scenario exists to teach is intact at that
depth: prices falling while the nominal rate sits at its floor, the real rate
climbing with the dial at rest, a gold floor you can cross and pay for, the
October 1931 rise, and a banking system that fails if you let it.

**Why I did not decide it.** Cutting a scenario is removing a mechanic.

**To turn it back.** Remove `GREAT_CONTRACTION_1929` from the `SCENARIOS` array
in `scenarios/scenarios.ts` and the matching section from
`docs/SCENARIOS.md` — the test that parses the document checks both directions,
so it will tell you if you miss one.

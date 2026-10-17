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

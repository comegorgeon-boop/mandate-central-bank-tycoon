# Journal

One entry per chantier, three lines: **what I did**, **what I measured**, **what
still bothers me**. Newest at the bottom, so the week reads in order.

---

## The state, in five lines

1. `main` is live and playable; the branch `difficulty/three-modes` carries
   everything since — the slider, the ten doctrines, the Volcker scenario — and
   is **not merged yet**. 916 tests green, build clean, no sweep warnings.
2. The game is a full loop: setup → briefing → N meetings (brief, debate,
   policy desk, confirmation, between-meetings time-lapse, press) → written
   report with a doctrine comparison and, in a scenario, the historical standard.
3. Three fictional difficulties (easy 12 meetings and goal-ended, medium 16,
   hard 32) plus one historical scenario (Volcker 1979-83, 32 meetings, no
   difficulty chooser because difficulty is the year).
4. What is missing for a finished game: four more scenarios, the political
   pressure / public finances axis, a visual pass that stops it reading like an
   accounting document, the front matter (home, tutorial, glossary,
   achievements, saves, local records, legal), and the full 30 events.
5. My own standing complaint about it, before the player's: it is *read* far
   more than it is *played*. Chantier C exists to fix that and is deliberately
   scheduled before the finishings.

## The two hard-mode arbitrages

Both were measured and left open for the player at the end of the last session
(`docs/BALANCE.md`, "The balance check on hard"). The answers given:

**Price stability out of reach at hard — kept.** Median 0.02, costing every
hard mandate about 1750–2300 points for an objective the shocks make
unreachable. Accepted as the mode's character; no weight moved, no shock
shrunk. What I did add is honesty: hard's own difficulty copy and the scorecard
now say that under sustained cost-push the price-stability component is a
component you *lose well or badly*, not one you win — so the player meets it as
a stated rule of the mode rather than as an unexplained 20 % haircut.

**32 → 24 meetings — done, behind a constant.** `HARD_MANDATE_MEETINGS` in
`config/time.ts`, one line to revert, with the full length table from
BALANCE.md beside it. 24 was measured at +16 points of completion, so "shorter
and as hard" needed the shocks enlarged to compensate; what that cost is in the
entry below. Volcker is unaffected: a scenario declares its own
`meetingCount`, and 1979-83 is 32 meetings because that is the four years it
was.

---

## 1 — The two arbitrages, and a four-session-old clamp finally diagnosed

**Did.** Hard's term cut to 24 meetings behind `HARD_MANDATE_MEETINGS`, paid for
with events 15 % more frequent and severe (0.7 → 0.8, 1.35 → 1.55) so it is
shorter *and* as hard. Price stability at hard kept as the mode's character and
said out loud instead — in hard's setup copy and in the scorecard's own prose.
Two committed calibration scripts, `dev/hardLength.ts` and `dev/cohesion.ts`,
so neither number has to be re-derived from a dead scratchpad again. And the
`marketExpectedRate` safety clamp, carried in BALANCE.md as "not diagnosed" for
several sessions, is diagnosed and fixed.

**Measured.** At 24 meetings with the compensation, the toolkit rule completes
63 % of fed/hard and 62 % of ecb/hard against 57 % and 61 % over four years —
same difficulty, eight fewer meetings. `COHESION_TOLERANCE` re-measured 2.0 →
2.3, because bigger events disperse the euro area more and the floor rose with
them. The clamp was the *opposite* of what the bounds file guessed: not an
inflation spiral hitting the ceiling but **deflation hitting the floor** — the
Taylor benchmark has no floor and asks for about −11 % at −7 % inflation, and
three separate blocks walked the priced path through the rail chasing it.
`MARKET_EXPECTATIONS.belowFloorAllowance` gives it a modelled floor instead.
`npm run sim:sweep`: no balance warnings. 917 tests.

**Bothers me.** Two tests had to be loosened to land this and I want that on the
record rather than buried: the loop-count invariant became a band (3 to 5 loops)
instead of a max/min ratio, and the event-balance cap is now per unit of
severity rather than absolute. Both are better tests for being more specific,
but both were *failing honestly* — hard really does give fewer closed loops now,
and its catalogue really does deliver more impulse per meeting. See
docs/QUESTIONS.md 1 and 2.

---

## 2 — The tooling I will live or die by this week

**Did.** Three committed tools in `tools/`. `drive.mjs` knows how to play this
game in a browser, once, with the three navigation rules the contrast audit's
three historical blind spots taught it. `contrast.mjs` walks every painted text
node on every screen in both directions and **prints the list of states it
visited**, with a floor under that count, because the only thing separating a
pass from an absence is the itinerary. `board.mjs` builds the screenshot board
at `docs/board/index.html` — every screen, two directions, phone and desktop,
with the two things a photograph cannot show measured beside each shot: how
many screenfuls tall it is and whether the page scrolled sideways.

**Measured.** The audit found **198 real contrast failures across 71 states** on
its first complete run, five root causes. The worst: the Volcker scenario's
operating-procedure panel, the signature mechanic of the only historical
mandate that shipped, rendering near-black ink on dark walnut at **1.09:1** in
the papers-on-the-table direction. Invisible, under a green suite. Also a
danger marker at 1.96:1 on the one tone where danger is the subject, and the
objective banner at 1.43:1 whenever the objective had moved. All five fixed at
the token layer where possible — a new `--on-accent-surface` pair, because
`--accent-surface` is the one surface that changes *material* between the two
directions and no single foreground is right on both. Now clean across **312
states**.

**Bothers me.** Looking at the board found a defect the audit could not: text
photographed mid-entrance-animation, which the audit was measuring at its
declared colour rather than the one being painted. Both tools now settle
animations first and the audit composites ancestor opacity. That is two passes
of a tool that exists to be trusted, and I would not bet it has no third.

## 3 — The five remaining scenarios

**Did.** 1929-33, 2008-10, 2010-12, and 2021-23 twice — six mandates across
five periods, all six on the Volcker pattern and all six locked to
`docs/SCENARIOS.md` by a test that parses it. Three committed tools make the
honesty checkable rather than claimed: `tools/scenario-data.mjs` fetches every
series from FRED and the ECB's own press index, computes the year-on-year rates
from the index levels and **generates the calendars as TypeScript**, so not one
of the 145 calendar rows was typed by hand; `dev/scenarioFit.ts` replays each
benchmark path and prints the fit table the document carries;
`dev/hardLength.ts` and `dev/cohesion.ts` from the previous chantier. New
mechanics: the **gold standard** as a floor drawn on the rate dial that steps up
when Britain leaves gold in September 1931, and a per-scenario inflation
objective — 1929's is **zero**, because the Federal Reserve of 1929 had no
inflation target and every expectations block in this engine pulls inflation
toward whatever the objective says.

**Measured.** Fits, as inflation RMSE against the published series over twelve
seeds: 2021 Fed 2.4, euro 2010 3.0, 2021 ECB 3.2, 2008 4.0, 1979 4.8, 1929 5.9.
Full terms served on the historical path: 10, 12, 10, 12, 8, 11 of twelve. Two
model changes were needed and both are general: credibility could not be
*earned* by a chairman who inherited a disaster (the 1979 path fell from 45 to
0 over three years of a +3 real rate, which made inflation rise, which fell
credibility further — a doom loop that disinflated on two seeds in twelve), so
the inflation miss is now charged against a **glide path** from what was
inherited, above a four-point deductible. The fictional sweep moved by almost
nothing and still reports no balance warnings.

**Bothers me.** Three things, in order. **A blank white screen**: every
euro-area scenario's result page rendered *nothing*, because the historical
replay reached for a discount window the ECB does not have and threw inside a
`useMemo`. 952 tests were green. There is now a test that plays all six to the
end and builds all three expensive result-screen computations, and both panels
degrade to absent rather than taking the screen with them. **The Volcker fit**:
the mandate ends at a modelled 9.4 % against the 2.36 % that printed — the
model gets the peak and the recession and does not get the last four points of
the disinflation — and I raised that scenario's capitulation bar from five
meetings to eight to stop the historical path being read as a surrender. Three
of those meetings are a threshold compensating for a model miss and the
document says so. **1929's depth**: 10 % unemployment against 25 %. The
Depression is outside the range this engine was built on and I have said so
rather than forcing it.

## 4 — The public finances, and a government that finally asks for something

**Did.** Two halves of chantier B. The **public finances** are now arithmetic
rather than an index: the debt stock rolls over at the rate the market charges,
at a speed set by the average maturity, and the interest bill follows — which
is Sargent and Wallace's unpleasant arithmetic written as four lines of Euler
integration. A new Treasury tab shows debt, deficit, debt service and average
maturity, with exactly one row marked **yours**. Nothing on it is scored; it
reaches the mandate through the event generator and the pressure gauge, and
the panel says so in its first paragraph.

The other half is the **dilemma**, which the game did not have. Pressure used
to accumulate and be watched, and nothing was ever *asked*. Now, above a
threshold, an office asks: the administration for a cut, the Treasury for a
hold while it funds itself, a committee of the legislature for a policy
adjusted before the hearing. Two answers and no third. Yielding collapses the
pressure and spends credibility, the anchor and the priced path; resisting
raises the pressure and earns a little back. Saying nothing is a refusal at a
discount, because a demand that could be ignored for free would not be one.
**Nobody living is named**, and a test enforces it.

**Measured.** A demand reaches **35 % of hard mandates and 10 % of medium
ones**, on 10-13 % of meetings in the modes that get them — a hard-mode
mechanic that occasionally visits medium, which is the right gradient.
Paired on one seed, a tightening that holds for three years raises debt
service from 4.00 to 6.61 % of GDP against 4.13 for a chair who held, with the
lag visible in the shape: +0.24 after one year, +0.62 after two, +2.48 after
six. 1010 tests, no sweep warnings. The work also found and fixed a **crash**:
the toolkit benchmark rule's dispersion tilt could propose a cut through the
ECB's floor, and `playRun` throws on a rejected package — so the committed
rule that the sweep, the doctrine mandates and the end-of-mandate standard all
share could kill the process on the eighteenth meeting of some seeds.

**Bothers me.** The demand catalogue is three entries. It is enough to prove
the mechanic and it is not enough for a mandate that meets one four times —
the same office will ask the same thing in the same words. That is chantier
E's problem and I have left it there rather than padding it now. And the
Nixon-Burns 1972 scenario, which the player named as the obvious seventh, is
not built: it is recorded in docs/DIRECTION.md as the natural home for this
mechanic rather than started and left half-done.

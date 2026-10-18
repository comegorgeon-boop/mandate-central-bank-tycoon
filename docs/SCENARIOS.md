# Historical scenarios

**Six are built**, across five periods: 1929-33, 1979-83, 2008-10, 2010-12, and
2021-23 played twice, once from each seat.

This document is the **authority**. `src/simulation/scenarios/sourced.test.ts`
parses it and compares it to the code scenario by scenario, row by row: every
opening state, every calendar, every benchmark rate and every published outcome.
Edit one side and the other fails.

## The rule that replaces the difficulty selector

A historical scenario has **no difficulty chooser**. Difficulty is not a
setting; it is *what was known at the time*, and it is different in every year
because the statistical system was different in every year.

That is not a flavour decision. It is the decision. A chairman in 1929 had no
official national income statistic and read bank conditions weeks late; a
chairman in 2021 had excellent data, released on schedule, and was wrong anyway.
Those are two different games and only one of them is about noise.

So each scenario carries its own measurement regime — publication lag, first
print error, revision size, missing releases, and where applicable a *systematic
bias* in a published series — and every figure in it is sourced below or
explicitly marked as an approximation.

Everything that is **not** measurement — how large the instrument moves may be,
what the information ladder shows about the committee, how the score is weighted
— is inherited from one of the ordinary difficulty profiles, named per scenario.
That keeps a scenario from being a second copy of the whole balance sheet of
constants.

## The six

| | scenario | institution | rules | meetings | what the game is actually about |
| --- | --- | --- | --- | --- | --- |
| 1 | 1929-33, The Great Contraction | Fed | hard | 30 | deflation and a floor you cannot cut through: the nominal rate near zero while the *real* rate climbs, and the gold standard closing off the answer. The October 1931 **rise** is in the game, because a scenario that only lets you cut cannot teach why they raised. |
| 2 | 1979-83, Volcker | Fed | hard | 32 | the sacrifice ratio. Double-digit inflation, expectations unanchored, and a disinflation whose whole cost arrives before any of its benefit. |
| 3 | 2008-10, After Lehman | Fed | hard | 19 | the floor arrives in three meetings, and then the game is the balance sheet and the facilities. The rate stops being the instrument almost immediately, which is the lesson. |
| 4 | 2010-12, One rate, several economies | ECB | hard | 24 | one rate, several economies. The 2011 rises and their reversal; spreads and country divergence do all the work and the aggregate is nearly beside the point. |
| 5 | 2021-23, Transitory, Washington | Fed | medium | 20 | good data, published on time, and you are still wrong — the real-time slack problem with none of 1979's excuses. |
| 6 | 2021-23, Transitory, from Frankfurt | ECB | medium | 20 | the same shock from the other seat, where the inflation is a gas price you do not set and raising the rate reopens 2012. |

## Where the numbers come from

**`tools/scenario-data.mjs` is the provenance.** It fetches the published series
from FRED's own CSV endpoint and the ECB's own press-release index, computes the
year-on-year rates itself from the index levels, and prints the calendars in the
exact TypeScript shape the code carries — which is how they got there. Run it
and diff. Meeting dates come from the institutions: the Federal Reserve's
historical FOMC pages, transcribed with their URLs recorded in that file, and
the ECB's decision dates, fetched.

Two consequences worth stating:

- **Nothing in a calendar was typed by hand.** The thirty rows of 1929 and the
  thirty-two of 1979 are generated, which removes the one error a document test
  cannot catch: a document and a code file agreeing with each other and both
  disagreeing with the series.
- **A series that does not exist prints as `—` rather than as the nearest
  value.** The euro area's harmonised unemployment rate on FRED stops in
  January 2023, so the last five rows of the 2021-23 ECB calendar have no
  unemployment in them, and they say so.

The one set of figures **transcribed rather than fetched** is Lebergott's
annual unemployment estimates for 1929-33, from the published series as
reproduced in *Historical Statistics of the United States, Colonial Times to
1970*, series D 85-86. They are marked wherever they appear.

## How the fits were measured

`src/simulation/dev/scenarioFit.ts` replays each scenario's own benchmark rate
path — the rate that actually prevailed — through the model on twelve seeds and
compares the economy the model produces against the economy that happened.
Every fit table below is its output.

It plays the discount window as well as the rate, because a replay that moved
the rate and nothing else would hand 1982 a banking crisis it did not have.
Endpoints are medians over the runs that served the full term; the RMSE is over
every meeting of every run, including the ones that ended early.

**The share of seeds that serve the full term is reported for each.** It is not
a measure of fit — the historical path is played against *those seeds'* shocks
rather than against the actual year's — but it is the check that a scenario has
not been made harder than the past was.

## The honesty rules

Non-negotiable, and they are the reason this took the time it took.

- Opening states and dates are **sourced**, with the series named. Anything
  derived is labelled a derivation and the derivation is given. Anything
  approximated or set by judgement is labelled so in the document *and* in the
  code.
- **No words in anybody's mouth.** What people did is in the game. What they
  said is not, unless a sourced quotation carries its citation — and there are
  none in any scenario, by choice, because the cost of getting one wrong is
  higher than anything a quotation adds. A test forbids quotation marks and
  attribution verbs in scenario prose. This bites hardest in the euro-area
  scenarios, where the most famous sentence in the institution's history was
  said inside the window and does not appear.
- **No living politician is named.** What governments did is in the game, under
  the name of the government.
- **The documented table is the authority**, enforced by a test that parses this
  file.
- **The fit is reported, including where it is wrong**, with the misses named
  and quantified.

## What the model cannot do, stated once

Three misses recur across the scenarios and are easier to state here than six
times:

1. **Depth.** The engine's output gap is bounded at −20 and its Phillips curve
   is a modern reduced form. 1929-33 reaches a modelled gap of about −11 and
   unemployment of about 10 % against the 25 % that happened; the Depression is
   simply outside the range this model was built on. The scenario reproduces
   the *shape* — deflation, a rising real rate at the floor, a gold constraint,
   a banking collapse — at roughly half its historical depth.
2. **Disinflation.** The 1979-83 mandate ends at a modelled 9.4 % against the
   2.36 % that printed, on the median of the seeds that serve the full term.
   The model gets the peak (16.2 against 14.59) and the recession (a gap of
   −10.4 against −7.3, unemployment 9.3 against 10.8) and it does not get the
   last four points of the disinflation inside the four years.
3. **Unemployment in a deep recession.** Every scenario understates it, by
   about a point and a half in 1979 and 2008 and by a great deal in 1929. The
   engine's Okun coefficient of 0.42 is a modern one; 1929 overrides it to 0.75
   and still falls short.

---

<!-- scenario: great_contraction_1929 -->

# The Great Contraction, 1929-33

**Thirty meetings, August 1929 to April 1933.** From the month the Board raised
the discount rate to 6 % against stock speculation, through the crash, the three
banking panics and the October 1931 rise, to the month after the national bank
holiday — when gold convertibility was suspended and the question this office
had spent four years on was taken out of its hands.

Rules: `hard`. Institution: the Federal Reserve.

## What the player holds

The **discount rate**, in 25 bp detents, with a per-meeting limit of ±150 bp —
enough to reproduce the two-step rise of October 1931 in one meeting on this
calendar and no more. The **discount window** and the **open market account**.

What they do not hold: interest on reserves (1933 for excess reserves as an
instrument, 2008 in its modern form), announced asset purchase programmes,
the overnight reverse repo facility (2013), swap lines in anything like their
modern form, targeted refinancing, and **forward guidance** — the Federal
Reserve of 1929 published no decisions at all.

## The gold standard

The one mechanic this scenario cannot do without, and the reason it is not
simply a harder Volcker.

**There is a floor under the policy rate, and standing below it costs you
gold.** Gold leaving is not a gauge: it is the banking system losing reserves,
credit contracting, the spread widening and the market deciding the
convertibility will not hold — four things the player already reads. The floor
is drawn on the rate slider, so the constraint is visible before it is crossed.

**The floor is a schedule, and the schedule is the scenario.**

| from meeting | date | floor | why |
| --- | --- | --- | --- |
| 0 | August 1929 | 1.5 % | **Calibrated.** Roughly where the discount rate settled through 1931 before the drain, and the rate at which the gold stock was stable while the rest of the world was still on the standard. |
| 17 | October 1931 | 3.0 % | **The pivot.** Britain was relieved by statute of its obligation to sell gold on 21 September 1931; sterling fell about a quarter and the Scandinavian countries followed. Foreign central banks converted dollar balances into gold and shipped it. |
| 29 | April 1933 | 0 % | Convertibility suspended. The constraint is gone, by somebody else's decision. |

What the gold drain of autumn 1931 looked like, from the series:

| month | monetary gold stock, $bn | FR banks' gold reserves, $bn | NY discount rate |
| --- | --- | --- | --- |
| 1931-08 | 4.69 | 3.46 | 1.50 |
| 1931-09 | 4.66 | 3.14 | 1.50 |
| 1931-10 | 4.16 | 2.75 | 2.76 |
| 1931-11 | 4.08 | 2.92 | 3.50 |
| 1931-12 | 4.16 | 2.99 | 3.50 |

FRED `M1476BUSM027NNBR` and `M14062USM027NNBR`. The Federal Reserve raised its
discount rate from 1.5 % to 2.5 % on 9 October and to 3.5 % on the 16th, in the
third year of a depression with prices falling at 10 % a year. **Three per cent
is the floor that makes that rise the cheaper of two bad options**, which is
what it was. The drain coefficient of 1.0 is calibrated against the fit table
below and is not a measured elasticity.

## The opening state, August 1929

| quantity | value | source |
| --- | --- | --- |
| discount rate | 5.74 | FRED `M13009USM156NNBR`, Federal Reserve Bank of New York, monthly average, Aug 1929. The rise to 6 % took effect on 9 August, so the month's average sits below it. |
| headline CPI inflation | 1.17 | FRED `CPIAUCNS`, year-over-year, Aug 1929, not seasonally adjusted — no adjusted vintage exists for this period |
| core CPI inflation | 1.17 | **derived**: there was no core index. The BLS published a cost-of-living index and a wholesale price index and nothing that stripped out food and fuel. Set equal to headline, defensible only because the two were within a point of each other at this date |
| unemployment | 3.2 | **transcribed, not fetched**: Lebergott's annual estimate for 1929, Historical Statistics of the United States, series D 85-86 |
| natural rate of unemployment | 3.2 | **judgement**: 1929 was the peak of a five-year expansion and the economy was at full employment by any contemporary reading |
| output gap | 2.0 | **judgement**: no potential output series reaches back before 1929. Industrial production stood 17 % above its 1923-29 mean in August 1929 (FRED `INDPRO`), and real GNP went on to fall 26.5 % by 1933 (FRED `GNPCA`). Two points above potential is the conservative reading of an economy five years into a boom |
| commercial paper rate | 6.08 | FRED `M13002US35620M156NNBR`, New York, Aug 1929 — the nearest thing to a market yield this period publishes monthly. There was no constant-maturity Treasury series |
| wage growth | 2.0 | **judgement**: no wage series of national coverage is published monthly for 1929. Set just below the period's productivity growth, which is what a labour market at full employment with flat prices produces |
| one-year inflation expectations | 0.8 | **judgement**: no survey of inflation expectations exists before 1946 |
| long-run inflation expectations | 0.5 | **judgement**, and load-bearing. Set to about the inflation that had prevailed over the preceding five years, which is the only defensible assumption for a period with no survey and a gold anchor: the price level was expected to be stable because it had been, and because the standard was understood to make it so |

Two further opening quantities are **judgements**: **credibility 72** and
**anchoring 0.80**. High, deliberately — this institution had presided over five
years of stable prices under a standard nobody questioned, and the arc of the
scenario is that the credibility is real at the start and is spent defending the
wrong thing. The financial side opens with **asset price pressure 26**, which is
the one financial number with a published series behind it: the industrial
average stood at 359 in August 1929 against about 200 two years earlier (FRED
`M1109BUSM293NNBR`).

**The objective is zero**, not two per cent. The Federal Reserve of 1929 had no
inflation target; what it had was a dollar convertible into a fixed weight of
gold, which is a commitment to a stable price *level*. This is the most
consequential single parameter in the scenario and not only for scoring:
expectations in this model are pulled toward the objective, so a 2 % objective
in 1931 pulls a 10 % deflation *upward*. Measured before the override existed,
the mandate ended at +2.7 % inflation against the −9.35 % that printed.

## What was knowable in 1929-33

The furthest regime from the modern one in the game, and every departure is an
understatement of how bad it was. There was no national income statistic until
Kuznets reported to the Senate in 1934; no monthly unemployment count until
1940; no seasonally adjusted price index. What the Federal Reserve of 1930
actually read weekly was bank debits, clearings, carloadings and its own
member-bank balance sheet.

Observation noise 2.4×, revisions 2.6×, and **one release in five simply
absent** — not an exaggeration, since the figures of this period were compiled
by trade associations and state agencies on their own schedules.

**The bias of this period points the other way from 1979's: +4.0 on the
published output gap.** With no potential-output estimate at all, contemporary
judgement read the economy against the 1929 peak rather than against a trend,
so the gap looked *better* than it was for as long as the peak was recent — and
the belief that the liquidation was nearly over was held, published and acted on
through 1930 and 1931. **Calibrated, not sourced**, and it is the one departure
in this scenario with no measured counterpart.

**The two unemployment estimates disagree, and that is the scenario.** The
monthly series that can be fetched — the National Industrial Conference Board's,
via the NBER Macrohistory database, FRED `M0892AUSM156SNBR` — reads 0.04 % for
August 1929 against Lebergott's 3.2 %, and the two converge by 1933. Nobody in
1929 had either number. The calendar below carries Lebergott's, held flat within
each year, because there was no monthly official series to carry instead.

## The economy of 1929 is not the economy of 2019

Five parameters this period needs of its own, each calibrated against the fit
table rather than estimated.

- **`rateTransmission: 3.6`** — the highest in the file. There was no deposit
  insurance, no discount-window stigma management, and a unit banking system of
  twenty-five thousand independent banks with no branch networks to absorb a
  local loss. A rate that pushed a marginal bank under did not reprice its
  lending; it ended it, and took its depositors' money with it.
- **`phillipsGapSlope: 0.7`** — the steepest in the file, and above the engine's
  0.45. The first version of this scenario set it at 0.22 on a downward nominal
  rigidity argument, and that argument is a modern one: wages in the 1930s *did*
  fall, by about a fifth in manufacturing, and the price level fell a quarter.
  The pre-war Phillips relation is the steep one. Measured, 0.22 produced a
  mandate ending at +0.2 % inflation; at 0.7 the Fisher spiral this scenario
  exists for — falling prices raising the real rate, the real rate deepening the
  fall — can actually run.
- **`gapMeanReversion: 0.18`** — the lowest in the file. This economy did not
  mean-revert. It sat at the bottom for three years, which is the fact that
  makes the scenario about policy.
- **`okun: 0.75`** — real GNP fell 26.5 % while unemployment rose about 21.7
  points. The engine's 0.42 cannot produce that at any reachable output gap.
- **`shockScale: 0.45`** — the supply side of this period was quiet: no oil
  shock, no war, no commodity cycle worth the name. Hard's ambient processes are
  a modern economy's weather and they put a +2.65 supply shock into 1930, which
  at the headline amplifier of 2.4 is six points of imported inflation in the
  middle of the Great Deflation.

The procedural event stream runs at 0.3 and the **banking and energy families
are switched off entirely**: the banking story is scripted below on its own
dates and this scenario's whole arithmetic runs through banking stress, so a
double count there is not cosmetic; there was no energy shock in this period and
a drawn one would be fiction.

## How well it actually tracks

| | model | actual |
| --- | --- | --- |
| inflation at the opening | 1.17 % | 1.17 % |
| peak inflation | 1.5 % | 1.17 % |
| lowest inflation | −6.5 % | −10.74 % (September 1932) |
| inflation at the end | −6.2 % | −9.35 % |
| worst unemployment | 10.3 % | 24.9 % (Lebergott, 1933) |
| deepest output gap | about −10.7 % | — |
| inflation RMSE against the series | 5.8 points | — |
| unemployment RMSE | 9.8 points | — |
| full terms served, of twelve seeds | 11 | — |

**Where it is wrong, and by how much.** The deflation is about two thirds of the
real one and arrives at roughly the right time. The unemployment is not close:
10 % against 25 %, which is the single largest miss in this document and follows
directly from an output gap the model bounds at −20 and in practice reaches −11.
This scenario reproduces the shape of the Great Contraction at about half its
depth, and no amount of parameter choice inside this engine closes that.

## The calendar

Thirty slots on the engine's uniform eight-a-year grid, labelled by month.
**The Federal Reserve of this period had no eight-meeting calendar**: the Open
Market Policy Conference met a few times a year and discount rates changed
whenever a Reserve Bank asked and the Board agreed. The grid is an
approximation and this is where it is stated. The rounding of the grid was
chosen so that **October 1931 falls on a slot**, because it is the month the
scenario exists for.

| # | month | discount rate | CPI y/y | unemployment |
| --- | --- | --- | --- | --- |
| 0 | 1929-08-01 | 5.74 | 1.17 | 3.2 |
| 1 | 1929-10-01 | 6 | 0.58 | 3.2 |
| 2 | 1929-11-01 | 4.73 | 0.58 | 3.2 |
| 3 | 1930-01-01 | 4.5 | 0 | 8.7 |
| 4 | 1930-02-01 | 4.11 | -0.58 | 8.7 |
| 5 | 1930-04-01 | 3.5 | 0.59 | 8.7 |
| 6 | 1930-05-01 | 3.02 | -0.59 | 8.7 |
| 7 | 1930-07-01 | 2.5 | -4.05 | 8.7 |
| 8 | 1930-08-01 | 2.5 | -4.62 | 8.7 |
| 9 | 1930-10-01 | 2.5 | -4.62 | 8.7 |
| 10 | 1930-11-01 | 2.5 | -5.2 | 8.7 |
| 11 | 1931-01-01 | 2 | -7.02 | 15.9 |
| 12 | 1931-02-01 | 2 | -7.65 | 15.9 |
| 13 | 1931-04-01 | 2 | -8.82 | 15.9 |
| 14 | 1931-05-01 | 1.61 | -9.47 | 15.9 |
| 15 | 1931-07-01 | 1.5 | -9.04 | 15.9 |
| 16 | 1931-08-01 | 1.5 | -8.48 | 15.9 |
| 17 | 1931-10-01 | 2.76 | -9.7 | 15.9 |
| 18 | 1931-11-01 | 3.5 | -10.37 | 15.9 |
| 19 | 1932-01-01 | 3.5 | -10.06 | 23.6 |
| 20 | 1932-02-01 | 3.43 | -10.19 | 23.6 |
| 21 | 1932-04-01 | 3 | -10.32 | 23.6 |
| 22 | 1932-05-01 | 3 | -10.46 | 23.6 |
| 23 | 1932-07-01 | 2.5 | -9.93 | 23.6 |
| 24 | 1932-08-01 | 2.5 | -10.6 | 23.6 |
| 25 | 1932-10-01 | 2.5 | -10.74 | 23.6 |
| 26 | 1932-11-01 | 2.5 | -10.2 | 23.6 |
| 27 | 1933-01-01 | 2.5 | -9.79 | 24.9 |
| 28 | 1933-02-01 | 2.5 | -9.93 | 24.9 |
| 29 | 1933-04-01 | 3.1 | -9.35 | 24.9 |

Discount rate: FRED `M13009USM156NNBR`. CPI: year-over-year percent change
computed from FRED `CPIAUCNS`. Unemployment: Lebergott, annual, held flat
within each year, transcribed as noted above.

## The dated events

| meeting | date | what |
| --- | --- | --- |
| 1 | 1929-10-24 | the market breaks; the New York Reserve Bank buys government securities on its own account |
| 6 | 1930-06-17 | the tariff act is signed |
| 10 | 1930-12-11 | the Bank of United States is taken over by the state superintendent |
| 14 | 1931-05-11 | the largest bank in Austria announces losses exceeding its capital |
| 16 | 1931-09-21 | Britain leaves gold; **the floor steps up** |
| 20 | 1932-02-27 | a reconstruction finance corporation, and the Reserve Banks are allowed to issue notes against government securities |
| 23 | 1932-07-14 | the open-market buying programme stops |
| 28 | 1933-02-14 | Michigan closes every bank in the state |
| 28 | 1933-03-06 | the national bank holiday, and then gold convertibility is suspended |

## The failure thresholds this year needs of its own

| condition | engine | here | why |
| --- | --- | --- | --- |
| deflation spiral | −1 % | **−13 %** | the engine's bar describes a 2 % economy sliding to −1. This one printed −10.74 % and the Federal Reserve was still there in 1933. |
| depression | gap −8, held 4 | **gap −30, held 8** | **the hardest threshold in the game to set honestly.** This mandate *is* a depression; ending it for being one would end it on its own subject. Measured, the engine's bar ended ten of twelve replays of the historical path. Effectively unreachable, with the watch tier left where it is so the warning is live from early 1930 onward and never stops. |
| banking crisis | 85, held 2 | **97, held 4** | about a third of all banks suspended between 1930 and 1933 and every one of them closed for four days in March. The historical path peaks at about 94 on this build, so history came within three points of it — which is the knife edge the scenario wants. |
| currency dysfunction | volatility 90 | **volatility 99** | the dollar's parity held until the last month, so the exchange-rate limb is not in play. The volatility limb fired in six of twelve replays, for October 1929 being October 1929. A market in free fall is this scenario's subject rather than its failure state. |
| dismissal | credibility 25 | **18** | reachable, unlike 1979: this Board was appointed and replaceable, its governor changed in 1930, and the political question of 1932 was openly whether the Federal Reserve had any business continuing. Lower than the fictional bar because an institution with this much standing to lose takes longer to lose it. |
| capitulation | 4 meetings | **unreachable** | there is no anchor to give in on in a deflation, and the real rate is high for the whole mandate whatever the player does. |

---

<!-- scenario: volcker_1979 -->

# Volcker, 1979-83

**Thirty-two meetings, 14 August 1979 to 12 July 1983.** Eight meetings a year,
which is the engine's cadence and also the FOMC's.

## What the player holds

The **federal funds rate target**, in 25 bp detents, exactly as in every other
mode — plus one decision that exists only in this scenario.

### The October 1979 decision

At the second meeting — 6 October 1979, the unscheduled Saturday meeting — the
player chooses the operating procedure, once, for the rest of the mandate:

- **keep targeting the funds rate.** The dial is the rate. What you vote is
  what prevails.
- **target nonborrowed reserves.** The dial becomes a *midpoint*. The realised
  funds rate wanders in a seeded band around it, which costs you the steadiness
  score and hands you the anchoring instead, because the market reads a
  committee that has stopped defending a number as one that will not blink.

This is a designed simplification of a real decision and is marked as one. What
the FOMC actually adopted on 6 October 1979 was a change in operating
procedure: greater emphasis on the supply of bank reserves, less on confining
short-run fluctuations in the funds rate — together with a discount rate raised
from 11 % to 12 % and an 8 % marginal reserve requirement on managed
liabilities, announced by Volcker at a press conference that evening.[^oct6]
The point of the reform, and the reason it appears here as a choice rather than
as narration, is that it let the funds rate reach 19 % without the Committee
having to vote for 19 % at any meeting.

The modelled consequence — you lose control of the realised rate, you gain
credibility — is the standard account of why the reform mattered, not a
measured coefficient. It is calibrated, not sourced.

### What the player does not hold

The Fed of 1979 is not the Fed of today, and the instrument list says so:

- **no interest on reserves** (2008), **no asset purchase programme** (2008),
  **no overnight reverse repo facility** (2013).
- **no forward guidance.** The FOMC did not announce its policy decisions at
  all until February 1994; the directive appeared in the Record of Policy
  Actions weeks later, after the following meeting. Volcker communicated
  constantly — the October 1979 press conference, testimony, speeches — but
  nobody could promise a path for a rate they were not announcing and, after
  October 1979, not targeting. Communication is available; **binding
  commitments are not.**
- **the discount window is a signal.** It is the administered rate that *was*
  announced, and it moves in public.

## The opening state, 14 August 1979

Volcker was sworn in on 6 August 1979. The first FOMC meeting he chaired was
14 August 1979. Every figure below is the published value for that date or the
nearest available period, at today's vintage.

| quantity | value | source |
| --- | --- | --- |
| federal funds rate | 10.94 % | FRED `FEDFUNDS`, monthly average, Aug 1979 |
| headline CPI inflation | 11.84 % | FRED `CPIAUCSL`, year-over-year, Aug 1979 |
| core CPI inflation | 9.98 % | FRED `CPILFESL`, year-over-year, Aug 1979 |
| unemployment | 6.0 % | FRED `UNRATE`, Aug 1979 |
| natural rate of unemployment | 6.23 % | FRED `NROU` (CBO), 1979 Q3 |
| output gap | +0.78 % | FRED `GDPC1` 7300.281 against `GDPPOT` 7243.781, 1979 Q3 |
| ten-year Treasury yield | 9.03 % | FRED `GS10`, Aug 1979 |
| wage growth | 8.11 % | FRED `AHETPI`, year-over-year, Aug 1979 (6.40 against 5.92) |
| one-year inflation expectations | 9.9 % | FRED `MICH`, University of Michigan, Aug 1979 |

**Derived from the model's own identity, not observed.** Headline stands 1.86
points above core, and in this engine that wedge is exactly what a cost-push
shock produces: `0.06 × importPrices + 2.4 × supplyShock`, with import prices
resting at twice the shock. Solving gives a **supply shock of 0.74** and
**import price inflation of 1.48 %**. Without them the model reads the wedge as
an inconsistency and closes it within three meetings, handing the player two
free points of disinflation that the second oil shock was in fact still adding
to.

**One approximation, marked as such here and in the code.** *Long-run inflation
expectations: 7.0 %.* No monthly survey or market measure of ten-year inflation
expectations exists for 1979. This is the ten-year Treasury yield of 9.03 %
less an assumed 2 % long-run real rate, rounded — a derivation from a sourced
number, not a measurement, and the derivation is the whole of its authority. It
is also a sensitive one: a 0.5 % real-rate assumption would give 8.5 %, and the
two readings correspond to genuinely different contemporary views of whether
the bond market expected the inflation to continue.

Two further opening quantities have no observable counterpart at all and are
set by judgement: **credibility 45** and **anchoring 0.45**, for an institution
whose previous three chairmen had each presided over a rise in inflation. They
are on a weaker footing than anything else in this document and are labelled so
in the code.

The remaining latent quantities of the model — banking stress, market
volatility, asset price pressure, credit spreads, fragmentation — have no
1979 counterpart that can be sourced to a number on this scale, and they open
at the engine's own neutral values. That is stated rather than disguised.

## What was knowable in 1979-83

Three departures from the ordinary measurement regime, each sourced.

### 1. The output gap was wrong, and wrong in one direction

The single most important fact about reading the economy in this period.
Real-time estimates of the output gap were *systematically too pessimistic*:
potential output was believed to be far higher than it was, so the economy
looked far weaker than it was, so every rule that responds to the gap
prescribed an easier policy than the situation required.

> Noting that real-time misperceptions of the output gap averaged −4.9 percent
> in the sample to mid-1979 and −3.6 percent later on […]

— Athanasios Orphanides, *Monetary Policy Rules, Macroeconomic Stability and
Inflation: A View from the Trenches*, Finance and Economics Discussion Series
2001-62, Board of Governors of the Federal Reserve System, December 2001
(published in the *Journal of Money, Credit and Banking* 36(2), 151-175,
April 2004), §3.3.

The scenario window is the later sample, so **the published output gap carries
a constant −3.6 percentage point bias**. The Taylor-rule ghost on the rate
slider reads the published gap, like everything else the player sees, so the
rule of thumb is *visibly* asking for less than the truth requires — which is
Orphanides's argument, made into a thing you can watch happen.

### 2. Raising rates raised measured inflation

Until January 1983 the CPI-U measured the cost of owner-occupied housing with
an asset-price approach whose components included **mortgage interest costs**.
Tightening therefore fed directly into the index the Fed was judged on. The
annual rate of change of the mortgage interest cost component reached +44 % in
1980.[^bls] BLS announced the switch to rental equivalence on 27 October 1981,
effective with the CPI-U for January 1983.[^bls]

How large the distortion was, measured against the experimental CPI-U-X1 which
applied rental equivalence back to 1967:

> the CPI-W would seem to have overstated the rate of inflation by 2 percent in
> 1980 and to have underestimated the rate of inflation by 0.8 percent at the
> end of 1982

— Herbert Runyon, *The New CPI*, FRBSF Economic Letter, 4 March 1983.[^frbsf]

So: **published headline inflation carries an extra 0.4 points for every point
by which the policy rate stands above its level a year earlier, and the
distortion ends at the meeting covering January 1983.** The coefficient is a
calibration, and here is the check that sets it: the funds rate rose about
3.8 points over 1979-80, which at 0.4 gives +1.5 points of measured inflation
against Runyon's 2; it fell about 3.4 points over 1982, giving −1.4 against
Runyon's −0.8. Right sign and right order on both sides, too small on the way
up and too large on the way down, which is what a single symmetric coefficient
can do for an asymmetric distortion. 0.4 is the compromise and it is not a
measured elasticity.

### 3. The economy of 1979 is not the economy of 2019

Three parameters this period needs of its own, each a structural fact rather
than a difficulty setting, and each **calibrated against the fit table below
rather than estimated**. That distinction is the point: they are not sourced
and they do not pretend to be.

- **`rateTransmission: 3.0`** — a multiplier on the IS curve's response to the
  real rate. Raised from 2.2 this session, together with a `gapMeanReversion`
  cut from 0.83 to 0.45, because at the old pair the modelled recession
  bottomed out at an output gap of −3.5 and the disinflation never arrived: the
  historical rate path disinflated in two of twelve seeds and ended the other
  ten in a spiral or a capitulation. At the new pair the gap reaches −10.4 and
  the inflation peak lands at 16.2 against the 14.59 that printed.
  Under Regulation Q, deposit rate ceilings meant that when market
  rates rose past them, thrifts and banks lost their funding outright and
  mortgage credit stopped being *available* rather than merely repricing.
  Housing starts roughly halved between 1979 and 1982, and the March 1980
  credit controls did the same to consumer credit inside one quarter. At 1.0
  the model takes the funds rate to 19 % and produces an output gap of +0.4,
  which is not a recession and makes the sacrifice ratio — the thing this
  scenario exists to teach — invisible.

- **`gapMeanReversion: 0.45`**, down from 0.83. The high value was argued from
  the violence of the 1983 recovery, and it was the wrong trade: an economy
  that springs back that fast also refuses to go into the recession of 1982,
  and 1982 is the part the player is supposed to feel.

- **`shockScale: 0.75`**. The same argument that switches the energy family
  off: the oil story of 1979-83 is scripted on its own dates, and hard's
  ambient supply process adds a third oil shock on top of the two that are
  written in. Measured, at full ambient weather the modelled inflation peak ran
  to 19.7 % against the 14.59 % of March 1980, and the seeds where it did so
  were exactly the seeds that never disinflated.

- **`eventProbability: 0.7` and `eventSeverityScale: 1.35`**, stated rather
  than inherited. Hard's own were later raised to 0.8 and 1.55 to compensate
  for its term being cut from 32 scheduled meetings to 24 — length and severity
  are two settings of one dial — and a scenario sets its own length. Measured,
  inheriting that compensation cost this scenario four of its twelve full
  terms.

- **`phillipsGapSlope: 0.35`**, below the engine's 0.45. The engine's own
  comment says 0.45 is above the modern empirical range and defends it as the
  price of a twelve-meeting mandate needing an instrument stronger than its
  problem. A four-year mandate does not need the discount, and at 0.45 an
  output gap of −7 drives core inflation below zero by 1983 against the 4.5 %
  that actually printed.

- **`churnAllowancePerYear: 13`**, against the desk's 3.5. Set from the path
  that actually prevailed: 50.5 points of cumulative movement over four years,
  12.6 a year, twelve direction reversals. Against the modern allowance every
  conceivable mandate here, the real one included, scores a steadiness gate of
  0.03 and the score stops measuring anything. At thirteen, a player steadier
  than the history pays nothing and one less steady pays.

And two rules about what varies:

- **Move limit ±300 bp** rather than ±200. The effective funds rate moved more
  than 200 bp between consecutive labelled meetings ten times in this period,
  and by 621 bp once (March to May 1980). Three hundred is still short of the
  largest move, deliberately: the very largest were not votes.
- **The procedural event stream is thinned to 0.5 and energy events are
  switched off entirely.** The oil story of 1979-83 is scripted below on the
  dates it happened; letting the catalogue draw its own energy shocks beside it
  is the same history counted twice. Measured, the double count pushed the
  supply disturbance to −3.7 through 1982-83 — nine points of imported
  deflation at the headline amplifier — and took the mandate's final inflation
  to −4 % against the +2.4 % that actually printed. Everything else still
  draws, which is where two seeds of this mandate differ.

### How well it actually tracks

The honest part. The historical funds-rate path was replayed through the engine
on twelve seeds, with the discount window opened as stress rose, and compared
against what happened. Endpoints are medians over the runs that served the full
term; the RMSE is over every meeting of every run.

| | model | actual |
| --- | --- | --- |
| inflation at the opening | 11.84 % | 11.84 % |
| peak inflation | 16.2 % | 14.59 % (March 1980) |
| lowest inflation | 9.4 % | 2.36 % |
| inflation at the end | 9.4 % | 2.36 % (July 1983) |
| worst unemployment | 9.3 % | 10.8 % (November 1982) |
| deepest output gap | about −10.4 % | −7.3 % (1982 Q4) |
| inflation RMSE against the series | 4.8 points | — |
| core RMSE | 2.5 points | — |
| unemployment RMSE | 1.5 points | — |
| full terms served, of twelve seeds | 8 | — |

**Where it is wrong, and by how much.** The peak is 1.6 points *high* and the
recession is right: a gap of −10.4 against −7.3 and unemployment of 9.3 against
10.8. What the model does not get is the last four points of the disinflation —
it ends at a median 9.4 % against the 2.36 % that printed. That is the opposite
miss from the one this table recorded before the transmission was recalibrated,
and it is the better one to have: the old version got the ending by never having
the recession.

The Okun coefficient stays at the engine's 0.42 here even though the parameter
now exists (1929-33 needed it). Measured at 0.55, this scenario failed in ten of
twelve replays of the historical path against six, for a deeper recession nobody
asked for. A parameter that is available is not a parameter that should be
used.

And the historical path served the full term on six of twelve seeds. That is
not a defect: it is played against *those seeds'* shocks rather than 1979's, so
it is answering a real question about whether the policy worked or the weather
did. The three failures were banking crises and capitulations, which are the
two ways this economy actually breaks.

### 4. Everything arrived late and was revised hard

Unchanged in kind from the engine's `hard` profile, which is what this scenario
inherits its non-measurement rules from, and that is the honest place to leave
it: monthly CPI and unemployment prints with a short lag, quarterly national
accounts with a long one and large revisions. No separate claim is made about
1979 release calendars beyond the two biases above.

## The calendar

Thirty-two meetings on the engine's uniform eight-a-year grid, each labelled
with the actual FOMC meeting nearest to it. Dates from the Federal Reserve's
own historical FOMC pages.[^fomc] Maximum drift between a grid slot and the
meeting it is labelled with: **13 days**.

**Approximations, stated:** the FOMC held more than eight meetings in some of
these years — eleven in 1980 — so four real meetings have no slot of their own
(18 September 1979, 22 April 1980, 21 October 1980, 23 August 1983), and none
of the many conference calls or intermeeting actions is separately playable.
The 6 October 1979 meeting was unscheduled; it occupies slot 1 because it falls
nearest to it, which is also where the scenario needs it.

## The standard: what Volcker actually did

At the end, the player's mandate is set against the historical path, meeting by
meeting, on the same seed, with the counterfactual.

**What the benchmark path is, exactly:** the monthly average *effective*
federal funds rate for the month of each labelled meeting, from FRED
`FEDFUNDS`. It is **not** a target the FOMC voted. Between October 1979 and
October 1982 the Committee voted reserve paths, not a funds rate, and the rate
is an outcome of those votes — which is the whole point of the period. The
comparison is therefore between what the player chose and *what prevailed*, and
the screen says so.

| # | FOMC meeting | funds rate | CPI y/y | core CPI y/y | unemployment |
| --- | --- | --- | --- | --- | --- |
| 0 | 1979-08-14 | 10.94 | 11.84 | 9.98 | 6.0 |
| 1 | 1979-10-06 | 13.77 | 12.07 | 10.12 | 6.0 |
| 2 | 1979-11-20 | 13.18 | 12.59 | 10.65 | 5.9 |
| 3 | 1980-01-08 | 13.82 | 13.87 | 11.97 | 6.3 |
| 4 | 1980-02-04 | 14.13 | 14.16 | 11.99 | 6.3 |
| 5 | 1980-03-18 | 17.19 | 14.59 | 12.61 | 6.3 |
| 6 | 1980-05-20 | 10.98 | 14.43 | 13.14 | 7.5 |
| 7 | 1980-07-09 | 9.03 | 13.15 | 12.38 | 7.8 |
| 8 | 1980-08-12 | 9.61 | 12.89 | 11.83 | 7.7 |
| 9 | 1980-09-16 | 10.87 | 12.77 | 12.01 | 7.5 |
| 10 | 1980-11-18 | 15.85 | 12.63 | 12.17 | 7.5 |
| 11 | 1980-12-18 | 18.90 | 12.35 | 12.15 | 7.2 |
| 12 | 1981-02-02 | 15.93 | 11.39 | 10.84 | 7.4 |
| 13 | 1981-03-31 | 14.70 | 10.61 | 9.92 | 7.4 |
| 14 | 1981-05-18 | 18.52 | 9.79 | 9.61 | 7.5 |
| 15 | 1981-07-06 | 19.04 | 10.77 | 11.14 | 7.2 |
| 16 | 1981-08-18 | 17.82 | 10.82 | 11.56 | 7.4 |
| 17 | 1981-10-05 | 15.08 | 10.27 | 10.96 | 7.9 |
| 18 | 1981-11-17 | 13.31 | 9.58 | 10.25 | 8.3 |
| 19 | 1981-12-21 | 12.37 | 8.91 | 9.54 | 8.5 |
| 20 | 1982-02-01 | 14.78 | 7.61 | 9.20 | 8.9 |
| 21 | 1982-03-29 | 14.68 | 6.88 | 8.68 | 9.0 |
| 22 | 1982-05-18 | 14.45 | 6.91 | 8.66 | 9.4 |
| 23 | 1982-06-30 | 14.15 | 7.18 | 8.47 | 9.6 |
| 24 | 1982-08-24 | 10.12 | 5.97 | 7.06 | 9.8 |
| 25 | 1982-10-05 | 9.71 | 5.03 | 5.86 | 10.4 |
| 26 | 1982-11-16 | 9.20 | 4.48 | 5.19 | 10.8 |
| 27 | 1982-12-20 | 8.95 | 3.83 | 4.52 | 10.8 |
| 28 | 1983-02-08 | 8.51 | 3.48 | 4.48 | 10.4 |
| 29 | 1983-03-28 | 8.77 | 3.59 | 4.58 | 10.3 |
| 30 | 1983-05-24 | 8.63 | 3.44 | 3.67 | 10.1 |
| 31 | 1983-07-12 | 9.37 | 2.36 | 3.21 | 9.4 |

Funds rate: FRED `FEDFUNDS`, monthly average. CPI and core CPI: year-over-year
percent change computed here from FRED `CPIAUCSL` and `CPILFESL`, seasonally
adjusted index levels — the computation is twelve-month log-free ratio change
and nothing else. Unemployment: FRED `UNRATE`. All retrieved 20 September 2026.

**`src/simulation/scenarios/volcker.test.ts` parses this table out of this file
and asserts the code matches it, row by row.** If you edit one, the other
fails. That is the point.

## The dated events

Scripted, because they happened on dates, and because a scenario whose 1980 has
no credit controls in it is not 1980. Procedural events still draw beside them
at reduced probability, which is where a different seed gets you a different
mandate.

| meeting | date | what |
| --- | --- | --- |
| 1 | 1979-10-06 | the operating procedure changes; the discount rate goes to 12 % |
| 2 | 1979-11-20 | the second oil shock is still building: crude more than double its level at the start of the year |
| 5 | 1980-03-18 | the Carter administration invokes the Credit Control Act; the Fed runs the Special Credit Restraint Program |
| 7 | 1980-07-09 | the credit controls are lifted; the economy rebounds and so does inflation |
| 10 | 1980-11-18 | war between Iraq and Iran takes Gulf production off the market |
| 16 | 1981-08-18 | the Economic Recovery Tax Act is signed — a large fiscal expansion arrives against the tightening |
| 24 | 1982-08-24 | Mexico suspends payments; the international debt crisis begins |
| 25 | 1982-10-05 | the Committee de-emphasises the M1 target |
| 29 | 1983-03-28 | the producers cartel cuts its official price for the first time, from 34 to 29 dollars |

Each of these is a real dated event. **None of them puts words in anybody's
mouth.** What people did is in the game; what they said is not, unless it is a
sourced quotation carrying its citation — and there are none in the scenario
text, by choice, because the cost of getting one wrong is higher than anything
a quotation adds.

## How you lose

Not by being unpopular. **Dismissal is out of reach in this scenario, and that
is deliberate**: the person who held this office through it faced bills in
Congress, builders posting lumber to the Board and dealers posting car keys,
and was reappointed in 1983. Political pressure still rises with unemployment
and the real cost of credit, still costs credibility and score, and never by
itself ends the mandate.

You lose by **giving in**: the real policy rate back below zero while long-run
expectations are still more than three points above target *and inflation is
still more than four points above it*, held for eight meetings. That is the trap
of 1980 — the funds rate fell from 17.19 % in March to 9.03 % in July, and
inflation, which had been falling, stopped falling. Real short rates were
negative from May to September of that year, four meetings on this calendar.

**Eight meetings, not five, and three of those are paying for a miss in the
model rather than for anything about 1980.** The model's own inflation path does
not come all the way down — it ends at a median 9.4 % against the 2.36 % that
printed — so the real cuts of late 1982 and 1983, which were a normalisation,
read to this condition as a capitulation with inflation still four points above
target. At five, the historical rate path gave in on eight of twelve seeds.
Eight restores the property the bar exists for: the policy that actually
happened survives it. That is a threshold compensating for a fit problem and it
is written down as one. If the disinflation ever tracks properly, bring it back
toward five.

The last clause matters and was added after measurement. Without it the
condition fired at the *end* of a successful disinflation — inflation back to
4 %, the rate cut to 9 %, long-run expectations still lagging because they
always lag — and called normalising a capitulation. On the historical path
across thirteen seeds it was the only failure the real policy produced, and it
produced it in 1983 rather than in 1980.

## The failure thresholds this year needs of its own

The engine's catastrophe thresholds are calibrated on a fictional economy whose
inflation target is 2 % and whose misses are measured in tenths. The 1979-83
economy sat permanently in a region those thresholds call catastrophic and did
not collapse, so for this scenario the bars sit above what actually happened.
The method is stated rather than hidden: **each override was set by replaying
the historical path and requiring it to survive.** Nothing else was moved.

| condition | engine | here | why |
| --- | --- | --- | --- |
| runaway inflation | 12 % | 20 % | the mandate *opens* at 11.84 %. Twenty is five points above the actual 1980 peak, so it still marks acceleration away rather than the situation itself. |
| — its watch tier | 6 % | 13 % | a warning lit from the first meeting means nothing thereafter. |
| — on expectations | 6 above target | 11 | they open five above. |
| loss of monetary control | 4 above target | 9 | the opening miss is five. Nine is the anchor plainly gone rather than slipped. |
| systemic banking crisis | 85, held 2 | 95, held 3 | Penn Square failed in July 1982 and a sovereign borrower suspended payments in August; the system did not fail, partly because the Fed lent — which the player can do, and which is the lesson the bar exists to make teachable. |
| dismissal | credibility 25 | **unreachable** | see above. |
| depression | gap −8, held 4 | **gap −14, held 6** | needed once the transmission was recalibrated to produce the recession this period actually had. The 1982 gap was −7.3 % and unemployment reached 10.8 %, and the engine's bar ends the mandate on precisely the cost the scenario exists to make the player feel. The watch tier is unchanged, so the warning is live through the whole of 1982. |
| capitulation | 4 meetings | **8 meetings** | see "How you lose" above, including the part where three of those meetings are compensating for the model rather than for the history. |
| depression | gap −8, held 4 | **gap −14, held 6** | needed once the transmission was recalibrated to produce the recession this period actually had. The 1982 gap was −7.3 % and unemployment reached 10.8 %; the engine's bar ends the mandate on precisely the cost the scenario exists to make the player feel. The watch tier is unchanged, so the warning is live through the whole of 1982. |
| capitulation | 4 meetings | **8 meetings** | see below. |

None of these makes a catastrophe unreachable except the one that says so.

---





---

<!-- scenario: lehman_2008 -->

# After Lehman, 2008-10

**Nineteen meetings, 16 September 2008 to 14 December 2010.** From the morning
after the filing, with the target at 2 %, to the meeting two months into the
second purchase programme.

Rules: `hard`. Institution: the Federal Reserve.

## The instrument runs out in three meetings

That is the whole design. The target goes 2.00 → 1.00 → 0-0.25 by December
2008, and from there the mandate is sixteen meetings long with the dial on the
floor. What is left is the balance sheet, the facilities, and words.

Which is why, unlike every other scenario here, **this one scripts almost
nothing the central bank did.** The facilities are on the desk. The purchases
are on the desk. What is scripted is what happened *to* the Federal Reserve —
failures, a fiscal programme, a sovereign crisis on another continent — and
nothing it chose. 1929-33 is about a constraint; this is about an instrument
that runs out, and a scenario that scripted the replacement instruments would be
scripting the lesson.

Nothing is withheld except the overnight reverse repo facility, which was first
tested in 2013. Interest on reserves was authorised in October 2008 and paid
from that month; the purchase programmes began in November 2008; the window, the
swap lines and the term facilities were all in use within weeks.

## The opening state, 16 September 2008

| quantity | value | source |
| --- | --- | --- |
| federal funds target | 2.00 | FRED `DFEDTAR`, the target in force on the day. The monthly average *effective* rate for September 2008 was 1.81, lower because the rate traded below target through the crisis; the target is what the Committee held and so what the player starts holding |
| headline CPI inflation | 4.95 | FRED `CPIAUCSL`, year-over-year, Aug 2008 — the last print available at the meeting. Oil reached $145 in July |
| core CPI inflation | 2.44 | FRED `CPILFESL`, year-over-year, Aug 2008 |
| unemployment | 6.1 | FRED `UNRATE`, Aug 2008 |
| natural rate of unemployment | 5.05 | FRED `NROU` (CBO), 2008 Q3 |
| output gap | -0.45 | FRED `GDPC1` 16854.295 against `GDPPOT` 16929.753, 2008 Q3, **today's vintage** |
| ten-year Treasury yield | 3.69 | FRED `GS10`, Sep 2008 |
| wage growth | 3.70 | FRED `AHETPI`, year-over-year, Aug 2008 (18.20 against 17.55) |
| one-year inflation expectations | 4.3 | FRED `MICH`, Sep 2008 |
| long-run inflation expectations | 1.63 | FRED `T10YIE`, the ten-year breakeven as of 15 September 2008 — **a market price, observed**, and the first scenario in this file whose long-run expectations do not have to be derived from a yield |
| TED spread | 2.04 | FRED `TEDRATE`, 15 September 2008. A published price, on the day, and the number the meeting was actually about |

**Derived from the model's own identity**, as in 1979: headline stands 2.5
points above core, which in this engine is a **supply shock of 0.9** and
**import price inflation of 3.6 %**. Oil at $145 in July and $100 in September
is a real cost-push shock, still unwinding.

**Judgements:** credibility 68 and anchoring 0.78 — an institution widely
criticised for Bear Stearns in March and for not acting on housing earlier, with
twenty-five years of successful inflation targeting behind it. Banking stress
58, market volatility 52, and a balance sheet index of 100 against the ~$926bn
of 10 September 2008 (FRED `WALCL`), which reached about $2.25tn by December.

## What was knowable in 2008-10

**Modern statistics, and this is not a period where the data were bad.**
Observation noise sits *below* hard's own at 0.9×; revisions at 1.3×, which is
a turning point rather than a defect; nothing missing. The forecast fan is wide
at 1.9× for a reason that is not measurement error: nobody had a forecast
distribution for an economy with no interbank market, and a fan that is honest
about a model being outside its range is the right thing to show.

**The bias: −2.0 on the published output gap.** Potential output was believed to
be much higher than it turned out to be, because the pre-crisis path was assumed
to resume — so the real-time gap read far more negative than the gap reads now,
and every rule responding to it asked for more easing than the economy could
use. The *same sign* as 1979-83 and the *opposite* of 1929-33, which is the
pattern Orphanides's work describes: the gap is mismeasured at every turning
point, in whichever direction flatters the recent past. **Calibrated, not
sourced**: today's vintage puts the 2008 Q3 gap at −0.45 and the 2009 Q2 gap at
about −5, while contemporary estimates of the 2009 trough ran past −7.

## The economy of 2008 is not the economy of 2019

- **`rateTransmission: 0.65`** — the only value below 1 besides the euro area's,
  and the only scenario where a *broken* transmission is the structural fact.
  With the interbank market closed, the policy rate reached the economy through
  intermediaries that were not functioning: the 325 bp of cuts between September
  2007 and April 2008 did not stop the contraction, and the last 175 went into a
  system where mortgage spreads were widening faster than the policy rate was
  falling.
- **`phillipsGapSlope: 0.18`** — the famous flatness. Core never went below
  0.6 % against an output gap near −6.
- **`gapMeanReversion: 0.45`** — the recovery was slow. Real GDP regained its
  2007 peak in 2011 and the gap was still negative in 2015.
- **`okun: 0.5`** — unemployment rose from 6.1 % to 10.0 % on a gap that fell
  about 5 points. A touch above the engine's own, and much less extreme than
  1929 or 1979 because this recession was, by those standards, normal.
- **`shockScale: 0.8`** — the energy collapse of late 2008 and the 2009-10
  disinflation are scripted on their own dates; the ambient process adds a
  second oil shock nobody had.

Banking and energy families are both switched off in the draw, for the usual
reason: both stories are scripted.

## How well it actually tracks

| | model | actual |
| --- | --- | --- |
| inflation at the opening | 4.95 % | 4.95 % |
| peak inflation | 7.2 % | 4.95 % (its own opening) |
| lowest inflation | 1.9 % | −1.48 % (July 2009) |
| inflation at the end | 3.7 % | 1.44 % |
| worst unemployment | 7.1 % | 9.9 % (October 2009) |
| deepest output gap | about −3.3 % | about −5 % (2009 Q2) |
| inflation RMSE against the series | 4.0 points | — |
| core RMSE | 1.8 points | — |
| unemployment RMSE | 3.5 points | — |
| full terms served, of twelve seeds | 12 | — |

**Where it is wrong.** The model runs about two points hot on headline
throughout and does not reach the 2009 deflation at all: it bottoms at +1.9 %
against −1.48 %. The recession is about two points shallow in unemployment. And
the historical path serves the full term on every seed, which says the scenario
is forgiving to survive — correctly, because the Federal Reserve of 2008-10 did
survive it. What it is *not* forgiving about is the score: a player who leaves
the facilities and the balance sheet alone watches the same economy the passive
arm watches, and the counterfactual at the end says so.

## The calendar

| # | FOMC meeting | target (upper) | CPI y/y | core CPI y/y | unemployment |
| --- | --- | --- | --- | --- | --- |
| 0 | 2008-09-16 | 2 | 4.95 | 2.44 | 6.1 |
| 1 | 2008-10-29 | 1 | 3.73 | 2.22 | 6.5 |
| 2 | 2008-12-16 | 0.25 | -0.02 | 1.76 | 7.3 |
| 3 | 2009-01-28 | 0.25 | -0.11 | 1.67 | 7.8 |
| 4 | 2009-03-18 | 0.25 | -0.45 | 1.79 | 8.7 |
| 5 | 2009-04-29 | 0.25 | -0.58 | 1.93 | 9 |
| 6 | 2009-06-24 | 0.25 | -1.23 | 1.71 | 9.5 |
| 7 | 2009-08-12 | 0.25 | -1.48 | 1.43 | 9.6 |
| 8 | 2009-09-23 | 0.25 | -1.38 | 1.48 | 9.8 |
| 9 | 2009-11-04 | 0.25 | 1.91 | 1.71 | 9.9 |
| 10 | 2009-12-16 | 0.25 | 2.81 | 1.82 | 9.9 |
| 11 | 2010-01-27 | 0.25 | 2.62 | 1.51 | 9.8 |
| 12 | 2010-03-16 | 0.25 | 2.29 | 1.16 | 9.9 |
| 13 | 2010-04-28 | 0.25 | 2.21 | 0.97 | 9.9 |
| 14 | 2010-06-23 | 0.25 | 1.12 | 0.95 | 9.4 |
| 15 | 2010-08-10 | 0.25 | 1.15 | 0.92 | 9.5 |
| 16 | 2010-09-21 | 0.25 | 1.12 | 0.81 | 9.5 |
| 17 | 2010-11-03 | 0.25 | 1.08 | 0.67 | 9.8 |
| 18 | 2010-12-14 | 0.25 | 1.44 | 0.66 | 9.3 |

Target: FRED `DFEDTARU`, the upper limit of the range, as of each meeting date —
the Federal Reserve's changes are effective the same day. CPI and core CPI:
year-over-year computed from FRED `CPIAUCSL` and `CPILFESL`. Unemployment: FRED
`UNRATE`.

**The column goes flat after three rows and never moves again**, which is the
point: everything that separates the player's path from the history after
December 2008 happened somewhere other than the rate.

## The dated events

| meeting | date | what |
| --- | --- | --- |
| 0 | 2008-09-16 | the week of the fifteenth: a bankruptcy, an insurer lent against its equity, a money fund breaking the buck |
| 1 | 2008-10-29 | crude gives back a year in four months |
| 1 | 2008-10-29 | capital goes into bank equity rather than into buying their assets |
| 4 | 2009-03-18 | the recovery act |
| 5 | 2009-04-29 | the banks are examined in public and the results published with the numbers |
| 9 | 2009-11-04 | a Gulf standstill, and a restated deficit in Athens |
| 13 | 2010-04-28 | the euro area's first programme |
| 16 | 2010-09-21 | the word is deflation again |

## The failure thresholds this year needs of its own

| condition | engine | here | why |
| --- | --- | --- | --- |
| banking crisis | 85, held 2 | **92, held 3** | the system did not fail, and partly because this institution lent against everything it was allowed to. The bar sits above what the autumn of 2008 reached so that the lesson is reachable rather than pre-empted. The watch tier sits at the opening value: the player should be warned about the banks from the first screen, because that is the situation. |
| currency dysfunction | volatility 90 | **volatility 99** | the mandate *opens* at volatility 52 and the Lehman week puts 38 more on it. The engine's bar fired in seven of twelve replays of the historical path, for the autumn of 2008 being the autumn of 2008. The dollar did not fail — it rose, on a flight to it. |
| inflation spiral | 12 % | **16 %** | the mandate opens at 4.95 % on an oil shock that was already reversing, so the watch tier moves to 7 % — the warning would otherwise be lit on the first screen for a risk that was not the risk. The *failure* bar moves because the model runs about two points hot on headline here and, played passively, spiralled a seed out at meeting 17. Ending the Lehman scenario on runaway inflation is the game teaching the opposite of what happened: this period's risk was deflation, the five-year breakeven fell under 1.2 % in 2010, and the second purchase programme existed because of it. |
| deflation spiral | −1 % | **−2 %** | left near the engine's own: here it is doing the job it was built for, and it is the live risk of 2009-10. |
| capitulation | 4 meetings | **unreachable** | the real rate is *supposed* to be negative and getting it lower is the objective. |

---

<!-- scenario: euro_crisis_2010 -->

# One rate, several economies, 2010-12

**Twenty-four meetings, 14 January 2010 to 6 December 2012.** From the month
after Greece's deficit was restated, to the meeting three months after the
announcement that ended the crisis without spending anything.

Rules: `hard`. Institution: the European Central Bank.

## The aggregate is nearly beside the point

Area inflation spends the whole mandate between 0.92 % and 3.05 % — a central
bank's ordinary problem — while the spread between German and Italian ten-year
yields goes from 0.82 to 4.88 and back. A player who reads the area's average
and sets a rate for it will do a competent job of the wrong task.

The two rate rises of 2011 are the trap, and they are in the benchmark column so
the comparison at the end is unavoidable: April and July 2011, 25 bp each, into
an oil shock, reversed in November and December of the same year.

**Twelve of the thirty-six Governing Council decisions in this window have no
slot**, because the Council met monthly until 2015 and the engine's grid has
eight a year. The slots are chosen by laying the grid over the span and taking
the nearest real meeting to each, with a **maximum drift of 13 days** — the same
as 1979's. The twelve without a slot are listed by `tools/scenario-data.mjs`
when it builds the calendar. An earlier version took the first twenty-four in
order and ran out in December 2011, which dropped the whole of 2012 — the
sentence and the programme that resolved the crisis. A scenario missing the
thing it is about is not a scenario.

## The opening state, 14 January 2010

| quantity | value | source |
| --- | --- | --- |
| main refinancing rate | 1.00 | FRED `ECBMRRFR`, as decided at the meeting |
| headline HICP inflation | 0.92 | FRED `CP0000EZ19M086NEST`, year-over-year, Dec 2009 — the last print available at the January meeting |
| core HICP inflation | 0.62 | **derived**: 0.3 points below headline, where area core sat through 2009-10 while energy pulled the headline around |
| unemployment | 10.2 | FRED `LRHUTTTTEZM156S`, Dec 2009 |
| natural rate of unemployment | 9.0 | **judgement**: no euro-area equivalent of CBO's `NROU` is published. The engine's own ECB sustainable rate is 6.6 %; this period's area was structurally worse and the estimates of the time ran 8.5 to 9.5 |
| output gap | -2.2 | **derived** from the unemployment gap through this scenario's own Okun coefficient: (9.0 − 10.2) / 0.55 |
| German ten-year yield | 3.26 | FRED `IRLTLT01DEM156N`, Jan 2010 — the area's risk-free rate and what the spreads are measured against |
| wage growth | 2.0 | **judgement**: negotiated area wage growth ran near 2 % through 2009-10 |
| one-year inflation expectations | 1.3 | **judgement**, from the ECB's own quarterly Survey of Professional Forecasters, whose one-year point sat near this |
| long-run inflation expectations | 1.9 | **judgement**, from the same survey's longer-run point |
| Italy-Germany ten-year spread | 82 bp | FRED `IRLTLT01ITM156N` against `IRLTLT01DEM156N`, Jan 2010. This is the number the whole scenario turns on |

**Judgements:** credibility 70 and anchoring 0.82 — a young institution eleven
years old, widely praised for its handling of 2008, which had not yet been asked
the question this mandate asks.

The spreads to Germany at the opening, from the same OECD series: France 0.26,
Netherlands 0.21, Italy 0.82, Spain 0.73, Portugal 0.91, Ireland 1.57, Greece
2.76. By November 2011 Italy reaches 5.18 and Spain 4.32; Portugal reaches 11.15
in December 2011 and Greece 19.21.

## What was knowable in 2010-12

Modern statistics and good ones — but **an area of sixteen national statistical
offices publishing on their own schedules into a common aggregate, with
revisions that occasionally restated a member's deficit by a factor of two.**
That is not a metaphor for this period; it is what started it. Noise at hard's
own level, revisions at 1.6×.

**The bias: −1.0 on the published output gap, the smallest in the file.**
Potential output in the periphery had been overstated for a decade by a
construction boom counted as capacity. But the *area* aggregate also averaged a
Germany running hot with a Spain in freefall, and the average was a number
describing nowhere. This is not a scenario about mismeasuring the gap; it is a
scenario about the gap being the wrong question, and the bias is small to say so.

## Parameters this period needs of its own

- **`rateTransmission: 0.7`** — a cut in Frankfurt in 2011 arrived in Germany
  and did not arrive in Spain, where banks funding at six per cent were not
  repricing their lending to the policy rate.
- **`phillipsGapSlope: 0.2`** — area core stayed between 1 % and 2 % through a
  recession that took unemployment to 12 %.
- **`gapMeanReversion: 0.3`** — this economy did not recover on its own at all.
  The area had a second recession in 2012-13 and unemployment went on rising
  into 2013.
- **`okun: 0.55`** — area unemployment rose from 10.2 % to 12.0 % on a gap that
  worsened about 3 points.
- **`shockScale: 0.6`** — the area's 2010-12 inflation moved on two things, the
  2011 oil spike and the 2012 recession, and both are scripted.
- **`churnAllowancePerYear: 1.5`**, the tightest in the file. The path that
  prevailed moved 1.0 point a year with one direction reversal, and the reversal
  is the thing the scenario is asking about: a generous allowance would stop the
  score noticing it.

Banking and sovereign families are switched off in the draw. This scenario has
more scripted events than any other and its whole arithmetic runs through
fragmentation and bank stress.

**One piece of modelling licence, marked as such.** The ECB's outright purchases
of government debt existed from May 2010 — the Securities Markets Programme —
and the game's `transmission_protection` instrument stands in for it and for
what followed. Binding forward guidance came in July 2013, after this mandate
ends, and is withheld.

## How well it actually tracks

| | model | actual |
| --- | --- | --- |
| inflation at the opening | 0.92 % | 0.92 % |
| peak inflation | 5.5 % | 3.05 % (October 2011) |
| lowest inflation | 0.0 % | 0.92 % (its own opening) |
| inflation at the end | 1.7 % | 2.23 % |
| worst unemployment | 10.2 % | 12.0 % |
| deepest output gap | about −3.9 % | — |
| inflation RMSE against the series | 3.0 points | — |
| unemployment RMSE | 1.4 points | — |
| full terms served, of twelve seeds | 12 | — |

**Where it is wrong.** The inflation peak is two and a half points high, which
is the 2011 oil spike landing harder in the model than it did in the area. The
unemployment path is good. Twelve of twelve seeds serve the full term, which is
right: the ECB of 2010-12 was never going to be dismissed, and what the scenario
charges for is cohesion and fragmentation rather than survival.

## The calendar

| # | Governing Council | refi rate | HICP y/y | unemployment |
| --- | --- | --- | --- | --- |
| 0 | 2010-01-14 | 1 | 0.92 | 10.2 |
| 1 | 2010-03-04 | 1 | 1.56 | 10.3 |
| 2 | 2010-04-08 | 1 | 1.61 | 10.3 |
| 3 | 2010-06-10 | 1 | 1.48 | 10.3 |
| 4 | 2010-07-08 | 1 | 1.72 | 10.2 |
| 5 | 2010-09-02 | 1 | 1.88 | 10.2 |
| 6 | 2010-10-07 | 1 | 1.95 | 10.3 |
| 7 | 2010-12-02 | 1 | 2.22 | 10.2 |
| 8 | 2011-01-13 | 1 | 2.32 | 10.2 |
| 9 | 2011-03-03 | 1 | 2.67 | 10.1 |
| 10 | 2011-04-07 | 1.25 | 2.84 | 10 |
| 11 | 2011-06-09 | 1.25 | 2.72 | 10.1 |
| 12 | 2011-07-07 | 1.5 | 2.58 | 10.2 |
| 13 | 2011-09-08 | 1.5 | 2.99 | 10.5 |
| 14 | 2011-10-06 | 1.5 | 3.05 | 10.6 |
| 15 | 2011-12-08 | 1 | 2.76 | 10.8 |
| 16 | 2012-01-12 | 1 | 2.66 | 10.9 |
| 17 | 2012-03-08 | 1 | 2.69 | 11.2 |
| 18 | 2012-04-04 | 1 | 2.58 | 11.3 |
| 19 | 2012-06-06 | 1 | 2.36 | 11.5 |
| 20 | 2012-07-05 | 0.75 | 2.4 | 11.5 |
| 21 | 2012-09-06 | 0.75 | 2.61 | 11.7 |
| 22 | 2012-10-04 | 0.75 | 2.49 | 11.9 |
| 23 | 2012-12-06 | 0.75 | 2.23 | 12 |

Refi rate: FRED `ECBMRRFR`, read ten days after each decision date, because the
ECB announces on the Thursday and the change takes effect the following
Wednesday — read on the day itself the column would show the previous meeting's
decision. HICP: year-over-year computed from FRED `CP0000EZ19M086NEST`.
Unemployment: FRED `LRHUTTTTEZM156S`.

## The dated events

| meeting | date | what |
| --- | --- | --- |
| 3 | 2010-06-10 | a programme for Greece, a facility for whoever comes next, and a bond desk |
| 6 | 2010-10-07 | a banking system larger than its state |
| 10 | 2011-04-07 | oil at a hundred and twenty, and a fifth of Japan's generation offline |
| 13 | 2011-09-08 | the third largest borrower in the world |
| 15 | 2011-12-08 | three-year money, fixed rate, full allotment |
| 18 | 2012-04-04 | the Spanish banks need a programme of their own |
| 20 | 2012-07-05 | the market is pricing exits |
| 21 | 2012-09-06 | an unlimited promise, on conditions, on which no money was spent |

## The failure thresholds this year needs of its own

| condition | engine | here | why |
| --- | --- | --- | --- |
| fragmentation crisis | 500 bp, held 2 | **600 bp, held 4** | the one scenario where this condition is the live one. The area reached 4.88 points on Italy and 19.21 on Greece without the currency ending, so the bar sits above what happened — and the watch tier drops to 180 bp, because a player not warned about fragmentation in this mandate is not being told what the mandate is. |
| banking crisis | 85, held 2 | **90, held 3** | — |
| deflation spiral | −1 % | **−1.5 %** | not the risk in this window — it became one in 2014 — and the opening print of 0.92 % would light the engine's watch tier from the first screen. |
| inflation spiral, on expectations | 6 above target | **5** | area long-run expectations open 0.1 point *below* the objective. |
| capitulation | 4 meetings | **unreachable** | there is no anchor being rebuilt: expectations open below target, not above it. |

---

<!-- scenario: transitory_fed_2021 -->

# Transitory, 2021-23: Washington

**Twenty meetings, 17 March 2021 to 26 July 2023.** From the meeting whose
published projections put 2022 inflation at 2.0 %, to the last rise of the cycle.

Rules: `medium`. Institution: the Federal Reserve.

## Why `medium`, in the one scenario that gets it

Hard's regime is about not being able to see. **The statistics of 2021 were
excellent and arrived on schedule, and the committee that was wrong about them
had every number on time.** Running this period at hard's noise would be
inventing an excuse the Federal Reserve did not have.

The difficulty is the judgement, and the judgement is the player's whatever the
noise setting says. From the Summary of Economic Projections of 17 March 2021 —
the meeting this mandate opens on — the Committee's own medians:

| | 2021 | 2022 | 2023 | longer run |
| --- | --- | --- | --- | --- |
| change in real GDP | 6.5 | 3.3 | 2.2 | 1.8 |
| unemployment rate | 4.5 | 3.9 | 3.5 | **4.0** |
| PCE inflation | 2.4 | **2.0** | 2.1 | 2.0 |
| core PCE inflation | 2.2 | **2.0** | 2.1 | — |
| federal funds rate | 0.1 | 0.1 | 0.1 | 2.5 |

Core PCE printed 5.08 % in December 2021 and 5.07 % in December 2022, and peaked
at 5.64 % in September 2022. **The Committee's own published median for 2022,
nine months before it began, was 2.0.** Fetched by
`tools/scenario-data.mjs` from the Federal Reserve's own SEP page.

## The opening state, 17 March 2021

| quantity | value | source |
| --- | --- | --- |
| federal funds target, upper | 0.25 | FRED `DFEDTARU`, 17 March 2021 |
| headline CPI inflation | 2.67 | FRED `CPIAUCSL`, year-over-year, Feb 2021 |
| core CPI inflation | 1.65 | FRED `CPILFESL`, year-over-year, Feb 2021 |
| unemployment | 6.1 | FRED `UNRATE`, Feb 2021 |
| natural rate of unemployment | 4.45 | FRED `NROU` (CBO), 2021 Q1, today's vintage. **The Committee's own longer-run median at this meeting was 4.0** |
| output gap | -0.52 | FRED `GDPC1` 21106.6 against `GDPPOT` 21216.9, 2021 Q1 |
| ten-year Treasury yield | 1.61 | FRED `GS10`, Mar 2021 |
| wage growth | 5.02 | FRED `AHETPI`, year-over-year, Feb 2021. **Distorted upward** by composition: low-wage service jobs were disproportionately gone, so the average of what remained rose. A real measurement problem of this period, and not in the bias list below because it is a composition effect rather than an error |
| one-year inflation expectations | 3.1 | FRED `MICH`, Mar 2021 |
| long-run inflation expectations | 2.3 | FRED `T10YIE`, 17 March 2021 |

**Derived from the model's identity:** headline stands 1.0 point above core on
energy base effects, which is a **supply shock of 0.35** and **import price
inflation of 0.7 %**.

**Judgements:** credibility 82 and anchoring 0.88 — the highest any scenario in
this file opens with, and the point: this is the only one where the institution
has it all to lose.

## What was knowable in 2021-23

The best statistics in the file. Observation noise 0.75×, revisions 0.9×,
nothing missing. **Nothing here is the difficulty.**

The forecast fan is wide at 1.8× and that is where the difficulty lives: not
because the data were noisy but because the structural relationship between
slack and prices was behaving in a way no forecast in either institution had in
its distribution. A fan that was narrow and wrong would be the actual 2021 and
would also be unplayable.

**The bias: −1.0 on the published output gap, derived rather than sourced, and
the derivation is its whole authority.** The Committee's own longer-run
unemployment median at this meeting was 4.0 %; the CBO now puts the 2021 natural
rate at 4.45 %. So in real time the labour market was read as having 0.45 points
more slack than it had, which through this scenario's Okun coefficient of 0.5 is
0.9 points of output gap, rounded to one. **Negative**, which means the
published gap says the economy is weaker than it is — exactly as it did in 1979
and 2008, for the third different reason.

## Parameters this period needs of its own

- **`rateTransmission: 1.0`** — the transmission of 2022 was ordinary. Mortgage
  rates followed the policy rate almost immediately and housing turned within
  two quarters.
- **`phillipsGapSlope: 0.12`**, the flattest in the file, and the fact of the
  period: core inflation fell from 6.6 % to 3.2 % while unemployment never went
  above 3.7 %. A disinflation with no sacrifice ratio at all, which nothing in
  the 1979 model can produce. Most of it was the supply side unwinding.
- **`gapMeanReversion: 0.95`** — this economy snapped back. The gap closed in
  four quarters and stayed closed through a tightening cycle.
- **`shockScale: 0.6`** — the shock is scripted in both directions, the
  bottleneck and the unwind, and the ambient process adds a fourth one nobody
  had. Measured, at full ambient weather the modelled mandate ended at 6.7 %
  against the 3.29 % that printed, almost all of it the ambient process refusing
  to let the scripted unwind land.

**Nothing is withheld.** Every instrument this game models existed and was in
use in 2021, which is the difference between this scenario and the other four
and the reason it is about judgement rather than about running out of things to
do.

## How well it actually tracks

| | model | actual |
| --- | --- | --- |
| inflation at the opening | 2.67 % | 2.67 % |
| peak inflation | 11.0 % | 8.98 % (June 2022) |
| lowest inflation | 1.7 % | 2.67 % (its own opening) |
| inflation at the end | 2.0 % | 3.29 % |
| worst unemployment | 6.1 % | 6.1 % (its own opening) |
| deepest output gap | about −0.5 % | — |
| inflation RMSE against the series | 2.4 points | — |
| core RMSE | 1.0 points | — |
| unemployment RMSE | 0.4 points | — |
| full terms served, of twelve seeds | 10 | — |

**The best fit in the file**, and it should be: this is the period the engine
was calibrated on. The peak is two points high and the ending a point low.

## The calendar

| # | FOMC meeting | target (upper) | CPI y/y | core CPI y/y | unemployment |
| --- | --- | --- | --- | --- | --- |
| 0 | 2021-03-17 | 0.25 | 2.67 | 1.65 | 6.1 |
| 1 | 2021-04-28 | 0.25 | 4.13 | 2.98 | 6.1 |
| 2 | 2021-06-16 | 0.25 | 5.3 | 4.44 | 5.9 |
| 3 | 2021-07-28 | 0.25 | 5.25 | 4.21 | 5.4 |
| 4 | 2021-09-22 | 0.25 | 5.35 | 4 | 4.7 |
| 5 | 2021-11-03 | 0.25 | 6.9 | 4.97 | 4.1 |
| 6 | 2021-12-15 | 0.25 | 7.17 | 5.49 | 3.9 |
| 7 | 2022-01-26 | 0.25 | 7.56 | 6.05 | 4 |
| 8 | 2022-03-16 | 0.25 | 8.57 | 6.48 | 3.7 |
| 9 | 2022-05-04 | 0.5 | 8.54 | 6.03 | 3.6 |
| 10 | 2022-06-15 | 1 | 8.98 | 5.91 | 3.6 |
| 11 | 2022-07-27 | 1.75 | 8.46 | 5.9 | 3.5 |
| 12 | 2022-09-21 | 2.5 | 8.19 | 6.62 | 3.5 |
| 13 | 2022-11-02 | 3.25 | 7.12 | 5.97 | 3.6 |
| 14 | 2022-12-14 | 4 | 6.4 | 5.69 | 3.5 |
| 15 | 2023-02-01 | 4.5 | 5.96 | 5.5 | 3.6 |
| 16 | 2023-03-22 | 4.75 | 4.92 | 5.57 | 3.5 |
| 17 | 2023-05-03 | 5 | 4.13 | 5.34 | 3.6 |
| 18 | 2023-06-14 | 5.25 | 3.07 | 4.85 | 3.6 |
| 19 | 2023-07-26 | 5.25 | 3.29 | 4.7 | 3.5 |

Target: FRED `DFEDTARU` as of each meeting date. CPI and core: year-over-year
computed from FRED `CPIAUCSL` and `CPILFESL`. Unemployment: FRED `UNRATE`.

## The dated events

| meeting | date | what |
| --- | --- | --- |
| 0 | 2021-03-17 | the third programme is signed |
| 2 | 2021-06-16 | everything at once, and nothing in stock |
| 5 | 2021-11-03 | the word is retired and the taper is doubled |
| 8 | 2022-03-16 | war, and the commodities that come from there |
| 13 | 2022-11-02 | what four hundred basis points in eight months does |
| 15 | 2023-02-01 | the bottleneck clears and goods prices fall |
| 16 | 2023-03-22 | three banks in eleven days |

## The failure thresholds this year needs of its own

| condition | engine | here | why |
| --- | --- | --- | --- |
| inflation spiral | 12 % | **13 %** | headline peaked at 8.98 % and the anchor held: the ten-year breakeven never went much above 3 %. The bar on the print sits above the actual peak and the **expectations** bar at 4 does the work instead, which is the right shape — the question of 2022 was never the print, it was whether the print got into expectations. |
| banking crisis | 85, held 2 | **88, held 3** | three banks failed in March 2023 and the system held. |
| capitulation | 4 meetings | **4 meetings** | live, and this is the only modern scenario where it is. A player who cuts back to a negative real rate in 2022 with expectations still above target is doing the thing the whole mandate tests. |

---

<!-- scenario: transitory_ecb_2021 -->

# Transitory, 2021-23: Frankfurt

**Twenty meetings, 11 March 2021 to 27 July 2023.** The same shock from the
other seat, on the same engine, with the same scripted bottleneck and the same
war — and the differences are the point.

Rules: `medium`. Institution: the European Central Bank.

## What differs from Washington

- **It starts below zero**, at a deposit rate of −0.50 % where it had been since
  September 2019. The first rise is the first in eleven years.
- **Its inflation is imported.** Area gas went from about €20 a megawatt hour to
  over €300 at the peak, and the area pays for that in a transfer of income out
  of it. No instrument this institution holds offsets a terms-of-trade loss;
  what it can do is stop it becoming a wage-price spiral, which is a different
  objective and the scorecard knows it.
- **It cannot raise without a second instrument.** The Italian spread widened by
  about eighty basis points in the fortnight after the first rise was trailed,
  and an unscheduled Council meeting in June 2022 produced the transmission
  protection instrument. Raising in this area is two decisions, not one.

**One limitation, stated.** The dial here is the main refinancing rate, as in
the 2010-12 scenario, and the rate that mattered for the first half of this
mandate was the deposit facility rate at −0.50 %. The game does not model them
as separate dials, so the first eleven rows of the benchmark column are flat at
zero while the policy they describe was not.

## The opening state, 11 March 2021

| quantity | value | source |
| --- | --- | --- |
| main refinancing rate | 0.00 | FRED `ECBMRRFR`. The deposit facility rate was −0.50 % |
| headline HICP inflation | 1.33 | FRED `CP0000EZ19M086NEST`, year-over-year, Feb 2021 |
| core HICP inflation | 1.13 | **derived**, 0.2 points below headline |
| unemployment | 8.2 | FRED `LRHUTTTTEZM156S`, Feb 2021 |
| natural rate of unemployment | 7.5 | **judgement**: no euro-area `NROU` is published. The area's structural rate had come down from the crisis; 7.5 is the conservative reading |
| output gap | -1.4 | **derived** from the unemployment gap through this scenario's Okun coefficient: (7.5 − 8.2) / 0.5 |
| German ten-year yield | -0.36 | FRED `IRLTLT01DEM156N`, Mar 2021. Negative, which is a fact about this period nothing else in this file can show |
| wage growth | 1.5 | **judgement**: negotiated area wage growth ran near 1.5 % in 2021 |
| one-year inflation expectations | 1.5 | **judgement**, from the ECB's Survey of Professional Forecasters |
| long-run inflation expectations | 1.7 | **judgement**, from the same survey |
| Italy-Germany ten-year spread | 107 bp | FRED `IRLTLT01ITM156N` against `IRLTLT01DEM156N`, Mar 2021 |

**Judgements:** credibility 76 and anchoring 0.85 — an institution that had
spent a decade undershooting its objective and had just completed a strategy
review about it.

## What was knowable, and the parameters

The same measurement regime as Washington, with revisions at 1.1× and a 2 %
chance of a missing release — the area's statistics are an aggregate of twenty
national offices with a flash estimate that is sometimes revised.

**The bias: −0.5 on the published output gap, half Washington's.** The
asymmetry is the argument: the ECB's 2021 error was less about reading its own
labour market and more about a price it does not produce.

`rateTransmission: 0.85`, below Washington's, because the area's transmission
runs through banks rather than capital markets and bank lending rates followed
with a longer lag. `phillipsGapSlope: 0.14`, flat for a reason more obviously
true here: almost all of the area's inflation arrived through the import bill
and left the same way. `shockScale: 0.55`, the lowest of the modern scenarios,
because the area's whole inflation was one price and that price is scripted.

## How well it actually tracks

| | model | actual |
| --- | --- | --- |
| inflation at the opening | 1.33 % | 1.33 % |
| peak inflation | 14.6 % | 10.62 % (October 2022) |
| lowest inflation | 1.3 % | 1.33 % (its own opening) |
| inflation at the end | 3.3 % | 5.28 % |
| worst unemployment | 8.2 % | 8.2 % (its own opening) |
| deepest output gap | about −1.4 % | — |
| inflation RMSE against the series | 3.2 points | — |
| unemployment RMSE | 0.8 points | — |
| full terms served, of twelve seeds | 10 | — |

**Where it is wrong.** The peak is four points high, which is the hardest miss
in the modern scenarios to tune away: the gas shock and the war shock each look
reasonable alone and the pair overshoots. Three successive rebalancings brought
it from 16.5 % to 14.6 % and the remaining excess is the model's headline
amplifier applied to a supply disturbance large enough to be outside the range
it was fitted on. The ending is two points low, which is the scripted collapse
landing slightly too hard.

## The calendar

| # | Governing Council | refi rate | HICP y/y | unemployment |
| --- | --- | --- | --- | --- |
| 0 | 2021-03-11 | 0 | 1.33 | 8.2 |
| 1 | 2021-04-22 | 0 | 1.61 | 8.2 |
| 2 | 2021-06-10 | 0 | 1.9 | 7.8 |
| 3 | 2021-07-22 | 0 | 2.16 | 7.7 |
| 4 | 2021-09-09 | 0 | 3.36 | 7.4 |
| 5 | 2021-10-28 | 0 | 4.05 | 7.3 |
| 6 | 2021-12-16 | 0 | 4.97 | 7 |
| 7 | 2022-02-03 | 0 | 5.88 | 6.8 |
| 8 | 2022-03-10 | 0 | 7.44 | 6.8 |
| 9 | 2022-04-14 | 0 | 7.45 | 6.7 |
| 10 | 2022-06-09 | 0 | 8.64 | 6.7 |
| 11 | 2022-07-21 | 0.5 | 8.86 | 6.7 |
| 12 | 2022-09-08 | 1.25 | 9.93 | 6.7 |
| 13 | 2022-10-27 | 2 | 10.62 | 6.6 |
| 14 | 2022-12-15 | 2.5 | 9.2 | 6.7 |
| 15 | 2023-02-02 | 3 | 8.5 | — |
| 16 | 2023-03-16 | 3.5 | 6.88 | — |
| 17 | 2023-05-04 | 3.75 | 6.1 | — |
| 18 | 2023-06-15 | 4 | 5.51 | — |
| 19 | 2023-07-27 | 4.25 | 5.28 | — |

Refi rate: FRED `ECBMRRFR`, read ten days after each decision date. HICP:
year-over-year computed from FRED `CP0000EZ19M086NEST`. Unemployment: FRED
`LRHUTTTTEZM156S` — **which stops in January 2023**, so the last five rows have
none and say so rather than carrying the nearest value forward.

## The dated events

| meeting | date | what |
| --- | --- | --- |
| 0 | 2021-03-11 | the purchases are stepped up, not cut |
| 2 | 2021-06-10 | everything at once, and nothing in stock |
| 5 | 2021-10-28 | the gas price, before the war |
| 8 | 2022-03-10 | war on the continent, and the gas stops |
| 12 | 2022-09-08 | the first rise in eleven years, and the tool that had to come with it |
| 14 | 2022-12-15 | the gas price gives it all back |
| 17 | 2023-05-04 | a global bank is married off over a weekend |

## The failure thresholds this year needs of its own

| condition | engine | here | why |
| --- | --- | --- | --- |
| inflation spiral | 12 % | **15 %** | area headline peaked at 10.62 %, higher than the American peak, and the anchor held. Same shape as Washington: the bar on the print sits above what happened and the bar on expectations at 4 is the one that matters. |
| fragmentation crisis | 500 bp, held 2 | **500 bp, held 4** | live, because raising the rate in this area reopens the question the 2010-12 scenario is about. The spread stayed inside 250 bp through 2022. |
| banking crisis | 85, held 2 | **88, held 3** | — |
| capitulation | 4 meetings | **4 meetings** | live, as in Washington. |

---

[^oct6]: Federal Reserve Bank of San Francisco, *October 6, 1979*, Economic
Letter, December 2004, and Federal Reserve History, *Volcker's Announcement of
Anti-Inflation Measures*. Discount rate 11 % → 12 %; 8 % marginal reserve
requirement on managed liabilities; press conference the evening of Saturday
6 October 1979.

[^bls]: U.S. Bureau of Labor Statistics, *Treatment of owner-occupied housing
in the CPI*, and *Changing the treatment of shelter costs for homeowners in the
CPI*, Monthly Labor Review, June 1982.

[^frbsf]: Herbert Runyon, *The New CPI*, FRBSF Economic Letter, 4 March 1983,
via FRASER.

[^fomc]: Board of Governors of the Federal Reserve System, *Historical
Materials by Year*, FOMC pages for 1979, 1980, 1981, 1982 and 1983.

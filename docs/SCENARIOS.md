# Historical scenarios

Five were designed so the structure would hold more than one. **One is built:
Volcker, 1979-83.** The other four are specified here at the level that
constrains the code — what each one makes the *game* about, and what was
knowable at the time — and at no level beyond that.

## The rule that replaces the difficulty selector

A historical scenario has **no difficulty chooser**. Difficulty is not a
setting; it is *what was known at the time*, and it is different in every year
because the statistical system was different in every year.

That is not a flavour decision. It is the decision. A chairman in 1929 had no
official national income statistic and read bank conditions weeks late; a
chairman in 2021 had excellent data, released on schedule, and was wrong
anyway. Those are two different games and only one of them is about noise.

So each scenario carries its own measurement regime — publication lag, first-
print error, revision size, missing releases, and where applicable a
*systematic bias* in a published series — and every figure in it is sourced
below or explicitly marked as an approximation.

Everything that is **not** measurement — how large the instrument moves may be,
what the information ladder shows about the committee, how the score is
weighted — is inherited from one of the ordinary difficulty profiles, named per
scenario. That keeps a scenario from being a second copy of the whole balance
sheet of constants.

## The five

| | scenario | institution | what the game is actually about |
| --- | --- | --- | --- |
| 1 | 1929-33, the Great Contraction | Fed | deflation and a floor you cannot cut through: the nominal rate near zero while the *real* rate climbs, and the gold standard closing off the answer. The October 1931 **rise** has to be in the game, because a scenario that only lets you cut cannot teach why they raised. |
| 2 | **1979-83, Volcker** | **Fed** | **the sacrifice ratio. Double-digit inflation, expectations unanchored, and a disinflation whose whole cost arrives before any of its benefit. Built.** |
| 3 | 2008-10, after Lehman | Fed | the floor arrives in months, and then the game is the balance sheet and the facilities. The rate stops being the instrument almost immediately, which is the lesson. |
| 4 | 2010-12, the euro area | ECB | one rate, several economies. The 2011 rises and their reversal; spreads and country divergence do all the work, and the aggregate is nearly beside the point. |
| 5 | 2021-23, "transitory" | Fed **and** ECB | the same shock played twice from two seats. Good data, published on time, and you are still wrong — the real-time output gap problem with none of 1979's excuses. |

Scenarios 1, 3, 4 and 5 are design only. Nothing about them is implemented and
nothing below commits the code to them.

---

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

- **`rateTransmission: 2.2`** — a multiplier on the IS curve's response to the
  real rate. Under Regulation Q, deposit rate ceilings meant that when market
  rates rose past them, thrifts and banks lost their funding outright and
  mortgage credit stopped being *available* rather than merely repricing.
  Housing starts roughly halved between 1979 and 1982, and the March 1980
  credit controls did the same to consumer credit inside one quarter. At 1.0
  the model takes the funds rate to 19 % and produces an output gap of +0.4,
  which is not a recession and makes the sacrifice ratio — the thing this
  scenario exists to teach — invisible.

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
| inflation at the opening | 11.84 % | 11.84 % (it is the sourced opening) |
| peak inflation | 13.9 % | 14.59 % (March 1980) |
| inflation at the end | 1.5 % | 2.36 % (July 1983) |
| worst unemployment | 8.3 % | 10.8 % (November 1982) |
| deepest output gap | about −7 % | −7.3 % (1982 Q4) |
| inflation RMSE against the monthly series | 4.7 points | — |
| full terms served, of twelve seeds | 6 | — |

**Where it is wrong, and by how much.** The peak is 0.7 points low and arrives
about a quarter early. The end is a point low. The recession is the right
*depth* in output and about two and a half points short in unemployment,
because the engine's Okun coefficient of 0.42 is below what 1982 actually
delivered and is not a parameter this scenario overrides. The RMSE of 4.7
points is dominated by the middle of the mandate, where the model disinflates
faster than 1980-81 did.

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
still more than four points above it*, held for five meetings. That is the trap
of 1980 — the funds rate fell from 17.19 % in March to 9.03 % in July, and
inflation, which had been falling, stopped falling. Real short rates were
negative from May to September of that year, four meetings on this calendar, so
the bar sits one meeting above what history survived: repeat 1980 and you come
within one meeting of losing the mandate.

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

None of these makes a catastrophe unreachable except the one that says so.

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

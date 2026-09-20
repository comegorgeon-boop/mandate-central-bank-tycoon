# Reprise — where this session stopped

Written at the end of the session that answered a twelve-point playtest report.
`docs/BALANCE.md` and `docs/DIRECTION.md` are the permanent record; this file is
a handoff and can be deleted once its open items are folded into those two.

## Branch state

`difficulty/three-modes`. **Not merged into `main`** — verified with
`git rev-parse`, not assumed, because a previous handoff asserted this and was
wrong by the time it was read. Tree clean.

`npm run build` and `npm test` (779 tests, up from 541) green.
`npm run sim:sweep` reports **no balance warnings** — the first time in this
project's history. The `marketExpectedRate` clamp that fired in two or three
completed ecb/hard mandates per 150, carried in BALANCE.md as "not diagnosed"
for several sessions, no longer fires.

## What the session was

A report from two played mandates — Fed/easy on seed `8K8J-AH8X`, ECB/medium on
`VJ99-A4KJ` — in twelve blocks, worked in the order A, B, C, then by judgement.
All twelve are done, one commit each.

| | block | commit |
| --- | --- | --- |
| A | the transition screen was illegible | `7a5075d` |
| B | easy becomes a goal, not a clock | `11c9069` |
| C | every instrument explains itself | `fea74f0` |
| E | no event is decoration | `2454786` |
| F | one newspaper instead of three channels | `c741c13` |
| G | charts first, the rest behind a click | `a4a0e1b` |
| D | the whole trade a commitment is | `6f11bb9` |
| I | markets in the score | `81b609c` |
| J | the euro area stops being one economy | `851f02c`, `4c684d2` |
| H | every indicator names something real | `1ef3e40` |
| L | the balance check on hard | `db1474c` |
| K | life on the screen, good news leading | `ee18283` |

## The two things to recreate before touching anything

**The contrast audit.** Not committed — it lives in the scratchpad, and the
scratchpad does not survive a long break. Recreate it before changing any
colour. It walks every rendered text node in a headless browser, resolves the
background actually painted behind it, and fails anything under WCAG AA.

It has now had **three** blind spots, each of which reported ALL CLEAR over a
broken screen, and the pattern is the same every time: *a screen it never
visited cannot have failed.*

1. It clicked past the between-meetings panels before measuring, while the
   transition screen sat at 1.04:1.
2. It only ever played easy, so the standing-settings panel, the instrument
   disclosures and the realised-effect readout went unmeasured.
3. `locator.count()` does not wait. Read on the same tick as a React
   re-render it returns 0, and the walk concluded the mandate had ended and
   stopped on its first iteration — reporting clean over six unvisited screens.

It now prints the list of states it actually audited, which is the only thing
that distinguishes a pass from an absence. It should end with 33 states across
two directions, including `tab:The Area` and `realised`.

**The measurement discipline.** Three times this session a **median over
independent runs** reported an effect backwards that the **paired** form —
same seed, two policies — resolved easily. Medians cannot see a 1 % effect at
150 seeds; paired comparisons can. Every score comparison in BALANCE.md now
uses the paired form, and `winnability.test.ts` does too.

## What is left open, and for whom

**Two design calls that are the player's, not the assistant's.** Both are
measured in BALANCE.md under "The balance check on hard":

- **Price stability at hard cannot be reached.** Median 0.02. A rule that
  closes the whole Taylor gap every meeting *and reads the latent state
  directly* improves the inflation RMSE only from 4.55 to 4.20 — the miss is
  the shocks, not the policy. The regime shift is already at its designed cap,
  so 0.18–0.23 of weight sits on a component every mandate scores 2 % on:
  about 1750–2300 points nobody can recover. The options are to accept it as
  the mode's character, to move more weight out of it, or to make hard's shocks
  smaller. Deliberately not decided here.
- **Hard's length is most of its difficulty.** 32 meetings, and the median
  mandate runs all 32. At 24, completion goes from 62 % to 78 %. "Shorter and
  as hard" is available but needs the shocks enlarged to compensate.

**One thing to watch.** ECB hard completion rose ten points during block J,
from two causes worth separating: the benchmark rule now uses the
anti-fragmentation instrument it had never touched, which is a better
benchmark; and five new ECB-only events dilute the draw, so the severe families
fire less often. The second is an accident of adding content, and it is the
thing to check first if the ECB starts feeling soft.

**One number that is hand-set against today's config.** `COHESION_TOLERANCE`
is 2.0, measured as the dispersion the area produces on its own. If the member
profiles in `config/members.ts` are ever retuned, that floor moves and the
constant should be re-measured — `cohesion.ts` in the scratchpad did it in
about a minute.

## The session after that: the slider, the doctrines, Volcker

Three chantiers, in order, from a played ECB/medium mandate on seed
`8RAW-LUHT`. **In progress** — this section is kept current as each lands, so
nothing is lost if the session stops.

| | chantier | state |
| --- | --- | --- |
| 1 | the rate as a slider, with the two references on the track | **done** |
| 2 | ten doctrines, the scoreboard, and the end-of-mandate comparison | **done** |
| 3 | historical scenarios: design for five, build Volcker 1979-83 | **done** |

### 1. The slider

A native `<input type="range">` with a 25 bp step. Native because keyboard
arrows, Home/End, page up and down, the ARIA role and every assistive
technology's idea of a slider come free and none of it is reimplemented
slightly wrong. The step is the detent: central banks move in quarter points
and a continuous dial would offer values the validator rejects.

Two ghosts on the track — the Taylor rule of thumb and the rate markets have
priced — so **the surprise is a distance** rather than a subtraction the player
performs between two numbers in different places.

The track stops where the engine would start rejecting moves, rounded *up* to
the increment, so the handle can never reach a value the validator refuses. A
ghost outside the range is pinned to the end and marked, because "the rule
wants more than this desk can do in one meeting" is information and a marker
that silently vanished would read as agreement.

Three interface tests were rewritten for it and got stronger: probing four
buttons for offer-or-not became one assertion on the track's own minimum.

### 2. The doctrines

Ten advisers, each a real school, in `simulation/doctrines/doctrines.ts`. The
acceptance test is the player's own and it is in `doctrines.test.ts`: *what
each says facing a supply shock — inflation up, unemployment up; if two say the
same thing, one of the two is badly written.*

**The structural failure that test caught.** The first version had seven of the
ten recommending the identical maximum tightening, including three whose entire
position is that you do not tighten into a relative price change. They were not
badly argued, they were badly wired: every school took a fraction of the
*published Taylor benchmark*, which reacts to headline inflation and therefore
runs away under a cost-push shock and drags the whole room with it. The schools
that say *look through the first-round effect* are now anchored on
`coreTaylorGap` — the same rule reading the measure that strips out the shock it
says to look through, which is that sentence written as arithmetic. The room now
spreads −150 to +150 on the same state.

Two conditional schools — fiscal dominance and the neo-Fisherian — stay silent
unless the state calls them, and a test asserts they are silent on a calm Fed
opening. They are the point when they appear and noise if they appear always.

**Who speaks.** `debate.ts` seats at most three by *maximum disagreement*, never
two of the same mind, ordered hawkish to dovish so the table reads as a
spectrum; only the first speaker rebuts, and it addresses another seated speaker
by their stored `addressAs` (deriving it by lowercasing gives "the keynesian",
which is why it is stored). The rest of the room is one click away with their
numbers. The density constraint was explicit — *I have just made you take text
off this screen, do not put it back through the window* — so positions are
always visible and every full argument is behind a disclosure.

**The scoreboard** (`features/game/doctrineScoreboard.ts`) is the part that
turns ten positions into an education. Every school that disagreed with a
decision gets a trial: the same world, the same shocks, that one meeting taken
its way, judged four meetings later on the mandate's own loss with the
institution's own score weights. Four meetings because that is where a rate
change has largely arrived — judged at the next meeting every verdict is noise,
judged at the end everything is confounded with everything since. Schools that
agreed are recorded separately and not scored, because a school you always
follow has your record rather than one of its own.

**The end-of-mandate table** (`features/result/DoctrineMandatesPanel.tsx`) runs
all ten complete alternative mandates on the player's own seed — about 60 ms —
and puts the two halves in one table: *right when it differed* (the trials) and
*its own mandate* (the full run). They can disagree, and that is the
interesting case: on `8RAW-LUHT` the hawk was right 7 times of 13 at the margin
and finished on 1,132 against the player's 7,684.

**The number that would have lied.** That 1,132 is not a wrecked economy. The
hawk's mandate ends with inflation at 1.6 % and unemployment at its sustainable
rate; it loses 80 % of its score to the conduct gate, because it got there via
1.75 → 7.00 → 4.25 → 5.50 → 2.25 and that is 12.5 points of cumulative movement
against a 6-point allowance. Shown alone the number teaches that defending the
anchor wrecks economies. The table therefore prints `steadiness ×0.20` under
any score a gate took a large part of. Checked and *not* a miscalibration: a
real tightening cycle with no reversals (the ECB's +450 bp over 2022-23) runs at
about 3 points a year, exactly the allowance; what the hawk is being charged for
is the reversals.

Each school plays the rate and nothing else — no balance sheet, no guidance —
because every one of them is a theory of the *rate*, and the caption says so.
Measured before accepting it: on a mandate where the player issued guidance at
every meeting and broke none, the ten schools' credibility component came out
*below* the player's rather than above, so silence is not buying them anything.

**Deferred by the player, explicitly: adopting a doctrine.** "Later, not in
this chantier."

### 3. The historical scenarios

`docs/SCENARIOS.md` is the authority and the long account. What belongs here is
what a reader picking the work up needs to know first.

**The design decision, which the player made and which applies to all five:**
there is no difficulty chooser on a historical mandate. Difficulty *is* the
year — what could be measured then — so a scenario replaces the opening state
(a sourced table, not a seeded draw) and the measurement regime, and inherits
everything else from a difficulty profile it names.

**Three design questions were put to the player rather than guessed**, and all
three answers are built:

1. *What does the player hold, given that after October 1979 the funds rate was
   an outcome rather than an instrument?* → the rate, **plus** a one-time
   choice of operating procedure at the 6 October 1979 meeting. Reserve
   targeting turns the dial into a midpoint, costs the steadiness score and
   buys the anchor.
2. *Which span?* → August 1979 to July 1983, 32 meetings, which is exactly the
   engine's four-year hard mandate at the FOMC's own eight meetings a year.
3. *Can the player be broken?* → not by being hated; dismissal is out of reach
   here because the person who held this office was reappointed. You lose by
   **giving in**, which is a new end condition.

**The test that matters** is `volcker.test.ts`: it *parses*
`docs/SCENARIOS.md` and compares the document to the code row by row. Edit
either and the other fails. That is the player's non-negotiable condition
implemented rather than promised.

**The calibration is the part that took the night**, and the account of it is
in `docs/BALANCE.md` under "The model changes the Volcker scenario forced".
Four shared-model changes were needed, all gated so they do nothing in an
ordinary mandate: credibility could be lost but never earned; the anchor once
lost could never return; the resolve gauge was the variable being rebuilt; and
political pressure double-counted inflation. The sweep moved by very little and
ecb/hard improved — eight fewer dismissals.

**Where the model is still wrong, measured and written down:** replaying the
historical funds-rate path gives a peak of 13.9 % against 14.59 %, an ending of
1.5 % against 2.36 %, and worst unemployment of 8.3 % against 10.8 %. The
unemployment gap is the engine's Okun coefficient of 0.42, which this scenario
does not override. The fit table in `docs/SCENARIOS.md` states all of it.

**The one thing to be careful with.** The scenario needs its own failure
thresholds, and the method used to set them is stated in the document: each was
raised until the historical path survived, and nothing else was moved. That is
a defensible procedure and also an easy one to abuse. If a sixth scenario is
added, the same method has to be applied honestly or the thresholds stop
meaning anything.

## The rule the session was worked to

Every claim in a commit message and in BALANCE.md is measured, and the
measurement is in the message. Where something was tried and abandoned — four
formulations of market prosperity, three of the tutorial's opening damage — the
abandoned ones are recorded with their numbers, because the next person to have
the same good idea should find out in thirty seconds that it does not work.

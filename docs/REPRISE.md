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

## The rule the session was worked to

Every claim in a commit message and in BALANCE.md is measured, and the
measurement is in the message. Where something was tried and abandoned — four
formulations of market prosperity, three of the tutorial's opening damage — the
abandoned ones are recorded with their numbers, because the next person to have
the same good idea should find out in thirty seconds that it does not work.

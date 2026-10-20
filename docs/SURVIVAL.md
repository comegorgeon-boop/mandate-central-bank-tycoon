# Serving until revoked

A proposal to replace the fixed meeting count with a survival structure.
Nothing in it is built. It is written to be decided on.

> « Un nombre de réunions fixé est arbitraire et ne colle pas au sujet. […]
> je sers jusqu'à ce qu'on me révoque, et la durée est un résultat, pas un
> réglage. »

The complaint is correct and it is not only an aesthetic one. `MEETING_COUNT`
is `{ easy: 12, medium: 16, hard: 24 }`, and the comment above
`HARD_MANDATE_MEETINGS` already admits what that costs:

> *"a longer mandate is more chances to meet a catastrophe, so length and
> shock severity are two settings of the same dial and moving one without the
> other silently retunes the mode."*

Length is currently doing two jobs — it is the session's size *and* a third of
its difficulty — and neither job is the one the subject suggests. No governor
has ever known how many meetings they had.

---

## 1. Where the game already is

This is less of a leap than it looks. Revocation exists and fires:

```
dismissal: {
  watchCredibility: 40,
  watchPoliticalPressure: 70,
  failCredibility: 25,
  meetingsToFail: 4,
}
```

At hard over 24 meetings, the Fed completes **63 %** of mandates and the ECB
**62 %** (`config/time.ts`). So **about four endings in ten are already a
revocation** rather than a clock. The proposal does not introduce survival. It
promotes it from the exception to the structure, and deletes the clock that is
currently competing with it.

---

## 2. The structure

### The term is real, and you will usually not finish it

| | Fed | ECB |
| --- | --- | --- |
| term | 4 years = **32 meetings** | 8 years = **64 meetings** |
| renewable | yes, and reappointment is a political act | **no**, by treaty |
| what ends you early | the appointment is not renewed; and, rarely, cause | the Governing Council stops following you |
| the scheduled ordeal | the reappointment hearing, at meeting 32 | none, ever |

Both figures are the real ones at the game's real cadence of eight meetings a
year. Neither is a difficulty setting, and neither should be *reached* often.
The point is that the horizon is long, known, and mostly theoretical — which
is exactly the position a governor is actually in.

If the median fictional mandate ends somewhere between meeting 12 and meeting
20, then sessions get **shorter** than today's 24-meeting hard mandate, the
duration is genuinely an outcome, and serving a full term becomes the thing
the game is about rather than the thing it assumes.

### The Fed plays as a politician's problem

Reappointment is the sanction, and historically it is the *only* one that has
ever actually been used: no Fed Chair has been removed, and two have been
declined a further term — Volcker in 1987 and Yellen in 2018. Burns was
reappointed in 1974 by the administration that had spent 1972 leaning on him,
which is the whole of the Burns scenario in one sentence.

So political pressure should bite, continuously and legibly, and the player
should be able to *spend* standing to buy quiet and pay for it later. The
hearing is visible from twenty meetings away. You steer at it.

### The ECB plays as a diplomat's problem

One eight-year term, non-renewable, and removal only by the Court of Justice
at the request of the Council or the Board. In practice: **nobody can fire
you, and there is no second term to want.** Political pressure has nothing to
act on. That is not a missing mechanic; it is the institutional design, and it
was the point of writing it into the Treaty.

What *can* end an ECB presidency is losing your own committee. Weber resigned
from the Bundesbank in February 2011 and Stark from the Executive Board in
September 2011, both over the Securities Markets Programme — a president who
cannot carry the Governing Council is finished in substance whatever the law
says. The game already models dissent, dispersion and cohesion; this gives
them a consequence.

So the asymmetry the two institutions produce is structural, not cosmetic:

| | Fed | ECB |
| --- | --- | --- |
| what you watch | political pressure, credibility | cohesion, dissent, your own members |
| what you can do about it in one meeting | a lot — the hearing is winnable by argument | nothing; it is a slow loss of the room |
| what long service proves | you were asked back | you simply did not break |
| the failure feels like | being sacked | being ignored |

One engine, two games. This is the strongest argument for the whole proposal
and it is available *only* if the structure changes — no amount of tuning
event tables produces it.

### The reappointment hearing, examined

The user asked whether renewable terms work as chapters with the hearing as
the tipping point. They do, on three conditions:

1. **It is scheduled and visible from far off.** A tipping point you cannot
   see coming is a dice roll. Meeting 32, announced at meeting 1.
2. **It is judged on what you chose, not on what happened to you.** The
   material already exists: broken guidance promises, the dissent record, the
   largest miss and whether you had warned of it, the surprise wagers taken.
   A governor who was handed 1973 and held the line should pass; one handed
   calm water and whipsawed the rate should not.
3. **Argument can lose a good record but cannot rescue a bad one.** You answer
   three questions drawn from your own log, choosing from the doctrine
   positions the game already models in `simulation/doctrines/`. That
   asymmetry is both true to life and the only version that does not make the
   preceding thirty-two meetings decorative.

Pass, and the second term is a second chapter: same seed, same economy, the
whole history carried forward, and a higher bar — because a reappointed chair
is judged against their own first term, not against the inherited mess they
were forgiven for at meeting one.

And the ECB, pointedly, **never gets this scene**. It gets the quarterly
hearing before the European Parliament's ECON committee: scrutiny with no
consequence attached. Rendering that as a scene the player cannot lose is not
a shortcut. It is the clearest single statement the game could make about what
independence actually is.

---

## 3. What it breaks

### 3.1 The score — this is the real cost

**Every path-averaged component silently starts rewarding quitting.**

The scorecard measures over the whole path: RMS inflation miss, mean
unemployment gap, policy volatility per year. That is sound *because every run
in a bucket is exactly the same length*. Make length variable and the
arithmetic inverts: a governor revoked at meeting 6 after a calm opening has a
better RMS miss than one who served 40 meetings through two crises. The
scorecard would rank the first higher. It would be measuring luck and
brevity and calling it skill.

This is not a detail to be patched later. It is the thing that decides whether
the proposal is an improvement, and there are three answers:

| | how it works | what it costs |
| --- | --- | --- |
| **A. Gate** | keep the present scorecard; runs under a minimum tenure are unranked | cheapest, preserves everything — but a cliff at the gate, and it does not actually make long service *pay*, it only stops short service scoring |
| **B. Multiply** | final score = present scorecard × a tenure factor | one line; but tenure then dominates every other term and the game becomes endurance |
| **C. Bank** | points are earned *per meeting* and accumulate; a long good run beats a short good run because it banked more | correct for a survival game, and a different scoring philosophy: the score stops being a grade and becomes a total |

**I recommend C, and I am flagging it rather than doing it**, because "what
the score means" is on the list of things I do not decide alone. C is what
every survival game does, for the reason that it is the only one of the three
where the incentive points the same way as the fiction: another meeting served
is another meeting of work done, well or badly.

Consequences of C, stated so they are not discovered later:

- **`MAX_SCORE = 10000` stops being reachable-in-principle** and becomes a
  pace rather than a ceiling. Records become "best total", which is a
  leaderboard of length as much as quality unless the per-meeting rate is
  shown beside it. Both should be shown.
- **`scoreBucketKey(institution, difficulty, version)`** still partitions
  correctly, but what is being compared changes meaning. Existing records
  cannot be migrated and should be archived, not converted.
- **`completion: 0.04` (Fed) / `0.03` (ECB) loses its referent.** There is
  nothing to complete. It should become *tenure*, which is a rename on the
  surface and a removal underneath — flagging it because removing a mechanic
  is also reserved.
- **`MISSED_OBJECTIVE_CREDIT = 0.35`** — the credit for "ran its length
  without reaching the objective" — describes a state that no longer exists.
  It dies.
- **`mandateElapsed`** is used in `dynamics.ts` for the inherited-forgiveness
  glide, `(1 - ctx.mandateElapsed)`. With no known end there is no elapsed
  fraction. It becomes an absolute count — *what you inherited is forgiven
  across your first eight meetings and not after* — which is more honest than
  the present version anyway, since the real forgiveness period is a fixed
  stretch of months, not a fraction of a term nobody knows the length of.
- Survivorship: the per-meeting rate of a 40-meeting run is not comparable to
  that of a 6-meeting run, because the 6-meeting run was *stopped* for being
  bad. Any "average per meeting" statistic needs the tenure printed next to it
  or it will mislead.

### 3.2 The difficulty selector — this part is a clean gain

`MEETING_COUNT` disappears, and `HARD_MANDATE_MEETINGS` with it. Difficulty is
then carried entirely by event probability and severity, by what the
information ladder publishes, and by how fast the revocation bar closes.

That dissolves the coupling `time.ts` complains about in its own comment.
Length and severity stop being two settings of one dial, because length stops
being a setting at all. The whole `hardLength.ts` measurement table becomes
unnecessary.

### 3.3 The seven historical scenarios — scoped out, and that is the answer

The scenarios have **dates**. 1929-33 is thirty meetings because it is August
1929 to the end of 1932. Britain leaves gold at meeting 17 because that is 21
September 1931. Burns gets his price controls at meeting 8 and the Soviet
grain sales at meeting 22 because that is when they happened. The meeting
count is not a setting there; it is a calendar.

So: **survival applies to fictional mandates only.** The seven counts stay
exactly as they are — 30, 24, 32, 19, 24, 20, 20 — and nothing in the fits,
the event slots or the Okun adjustment table moves.

What the scenarios gain instead is **a verdict**. The run plays to the
historical end *or* to your revocation, whichever comes first, and the report
says which:

> *You were let go in March 1931. The real one served to 1933.*

That is a far better scenario ending than the present one, it costs only the
revocation machinery that already exists, and it finally makes the Volcker
scenario say the thing it is about — he nearly was.

Two cautions, both real:

- **The dismissal thresholds must be re-measured per scenario before this is
  switched on**, and the warning at the head of `SCENARIOS.md` applies
  directly. Several scenarios *open* in the condition the bar tests for: 1979
  starts with the anchor already gone, 1929 arrives at 25 % unemployment. A
  scenario that begins below the revocation bar is not a hard scenario, it is
  an unplayable one. The Great Contraction will revoke you in 1930 every time
  unless the bar is set from the history rather than from the fiction.
- **Two structures now coexist** — survival for fictional economies, calendar
  for history. That is one more thing to hold in the head, and I think it is
  correct rather than regrettable: a historical chair *did* have a known job
  with a known end, and a fictional one does not. The game should not pretend
  those are the same situation.

### 3.4 The risk I would want on the record

A survival structure with a visible bar invites playing to the bar instead of
to the mandate. If what ends you is credibility below 25 for four meetings,
the optimal line is to maximise credibility — and credibility in this engine
is partly a function of *conduct*, not of outcomes. You would get a game about
looking competent.

That is a famous and serious critique of real central banking, so it is
thematically delicious, and it is still a different game from the one that
exists. The mitigation is exactly option C: tenure must not *be* the score. It
must be the length of it. Surviving badly for a long time should produce a
long, low total — legible as what it is.

---

## 4. What I would do

1. Survival replaces the fixed mandate, for fictional economies only.
2. The seven scenarios keep their calendars and gain an early-exit verdict.
3. Fed: a 32-meeting term, a reappointment hearing, a second term for those
   who pass it. ECB: 64 meetings, no hearing, ended only by the Council.
4. Scoring moves to **banked per meeting** (option C).

Items 1–3 I would build on your word. **Item 4 I will not decide**: it changes
what the score means and it removes `completion` and `MISSED_OBJECTIVE_CREDIT`,
and both of those are yours.

The one thing I would not do is adopt 1–3 while keeping the averaged
scorecard. That combination has the incentives pointing backwards — it would
pay the player to get fired early — and it would take a long time to notice,
because the scorecard would look exactly as it does now.

---

# BUILT — and what the measurements said

Decided on 21 October 2026: survival adopted, option **C** for the score
(banked per meeting), the ECB's Council as its only failure mode, and the
scenario verdict kept verbatim. What follows is what the build measured.

## The structure as built

| | Fed | ECB |
| --- | --- | --- |
| term | 32 meetings (4 years) | 64 meetings (8 years) |
| terms | 2, with a hearing between | 1, non-renewable |
| the hearing | credibility against a bar raised by political pressure | **none, ever** |
| what else ends you | the catastrophes, as before | the Governing Council, after 5 meetings fractured |

`MEETING_COUNT` is gone from the difficulty table. Length is set by the
institution and ended by the player's own record.

## The guarantee broke, and why

> "La garantie « jamais plus de deux réunions calmes d'affilée » a été mesurée
> sur des mandats de longueur fixe ; en survie les parties n'ont plus la même
> durée."

Exactly right, and it did break. Re-measured over 40 mandates:

| | before the fix | after |
| --- | --- | --- |
| fed/easy | 2 | 2 |
| fed/medium | **4** | 2 |
| fed/hard | **9** | 2 |
| ecb/medium | 2 | 2 |
| ecb/hard | 2 | 2 |

The cause was not the draw and not the Minsky hazard, both of which kept
working. It was `maxOccurrences`. Every cap in the catalogue was authored
against a 16- or 24-meeting mandate, so by the fortieth meeting most of the
table had retired, the eligible set had emptied, and the forced fire that
*implements* the guarantee had nothing left to fire. **A guarantee implemented
as "fire something" fails silently and completely the moment there is nothing
to fire** — and it fails exactly where a long, well-played mandate had earned
its way to.

The fix is a principle rather than a table of new numbers: a cap written
against 24 meetings is a statement about *density*, so it scales with the
horizon. Two banking crises in three years is plausible; insisting on no more
than two in eight is below the historical rate.

One honest correction inside that: a first attempt froze `maxOccurrences: 1`
as "structural". It is not. The seven events capped at one are the *big* ones,
and freezing them while the ordinary events stretched 2.7× did not preserve
the catalogue — it diluted the majors out of any long career. The one thing
that genuinely happens once, the opening crisis, is excluded where it belongs:
it is the economy you were handed, not an event you drew.

## Felt severity — does a banking crisis still frighten?

Measured over 40 mandates a bucket, in banked points destroyed: mean quality
over the three meetings before a shock against the three after.

| | a major costs | a minor costs | ratio | banking | recovery | ended a career |
| --- | --- | --- | --- | --- | --- | --- |
| fed/medium | −20 pts | −6 pts | **3.2×** | −13 | 2.6 mtgs | 25 % |
| fed/hard | −30 pts | −10 pts | **2.9×** | −22 | 3.7 mtgs | **63 %** |
| ecb/medium | −28 pts | −4 pts | **7.8×** | −10 | 2.8 mtgs | 30 % |
| ecb/hard | −29 pts | −14 pts | **2.0×** | −19 | 3.4 mtgs | **57 %** |

**It still frightens.** The ratio is the load-bearing column: a major costs two
to eight times what a minor costs, so "major" is a fact about the game rather
than a label on the table. A crisis takes three to four meetings to recover
from, which is long enough to be an episode rather than weather. And at hard,
a banking crisis ends six careers in ten — which is the only definition of
fear that means anything in a survival structure.

The one thing worth watching: 100 % of mandates now end in *something*, which
is the structure working, and the Fed's hearing is doing a lot of that work.
Median tenure runs 17–32 meetings at hard and 32–55 at medium.

## A measurement that was quietly wrong

`balance.test.ts` plays mandates and checks the catalogue is not writing the
inflation outcome by itself. It played **until the run ended** — harmless when
every mandate was the same length, and a selection effect the moment length
became a result: a run ends when the player is revoked, revocation follows
catastrophes, and catastrophes are events. The sample became conditioned on
the stream it was measuring.

The size of it: on the same seeds, the net delivered impulse on fed/medium
reads **−0.019** per meeting over a fixed window and **−0.116** over runs
truncated at their revocation. The catalogue had not changed between those two
numbers. It now plays a fixed 32-meeting window — and divides by the window it
played, not by the difficulty's old nominal length, which was a second error
hiding behind the first.

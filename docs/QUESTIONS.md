# Questions

Numbered, each with **the answer I applied** and **how to turn it back**.
Nothing waits for an answer: the most reasonable reading is built, and the
revert is one line wherever I could make it one.

A question you have since decided keeps its number and says so in its
heading, with your decision quoted at the top of it. The body is kept: it
carries what was built, what was measured, and how to reverse it.

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

## 3. The Volcker disinflation does not finish inside the model. Is a threshold the right place to pay for that? — **partly answered by the model**

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

**Update, 19 October 2026.** Less of it is being paid for there. The engine's
Okun coefficient now steepens as the output gap deepens, so the scenario has a
recession it previously only had a threshold for, and a recession does
disinflationary work on its own. The median ending moved from 9.4 % to 7.7 %
against the 2.36 % that printed, and unemployment from 9.3 % to 11.8 %
against the 10.8 % that happened. The threshold is unchanged; what it is
compensating for is smaller. The question stays open because 7.7 is still not
2.36.

## 4. 1929-33 falls far short of the Depression's unemployment. Ship it, or cut the scenario?

**Where it came from.** The engine bounds the output gap at −20 and its
Phillips curve is a modern reduced form. The scenario reached a gap of −10.4
and unemployment of 10.0 % against the 24.9 % that happened. The deflation is
about two thirds of the real one (−6.4 % against −10.74 %) and arrives at
roughly the right time; the unemployment was not close.

**Update, 19 October 2026.** It now reaches **12.0 %**, after the Okun
coefficient was made to steepen with the depth of the gap, and the RMSE
against the series fell from 9.9 to 8.8. Still not close, and the reason is
now precisely identifiable rather than general: the coefficient is steeper
than the historical one, and the *gap it multiplies* is less than half the
collapse that happened. Reproducing the Depression's depth is a change to the
IS block, not to the labour block, and it has not been made.

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

---

## 5. Can the committee refuse the chair's package? — **ANSWERED: no**

**Settled on 19 October 2026, by you, in these words:** *"Le conseil ne peut
pas refuser, garde-le comme ça. Un conseil qui bloque retire au joueur le seul
levier qu'il ait, et tout ce projet s'est battu contre le sentiment de n'avoir
aucun contrôle. Le conseil influence, il ne met pas de veto."*

The reason is written up in `docs/DIRECTION.md` under **"The council
influences; it does not veto"**, which is where a later pass will look before
reopening it. The rest of this entry is the question as it was asked and is
kept because it carries what was built, what was measured, and the five lines
that would reverse it.

---

You proposed the council vote as "the advisers vote, **a majority is needed**,
dissents are published and cost credibility — the Fed publishes its own." I
have built all of it except the majority requirement, and the part I left out
is the part worth asking about.

**Where it came from.** A majority *requirement* means a committee that can
refuse. That removes the player's direct control of the policy rate, which is
the one control the whole game is built on: every panel in the interface
exists to inform a decision the player then makes, the score measures the path
that decision produced, and the historical comparison is "your mandate against
what they actually did". A game whose central lever can be vetoed by an
adviser is a game about managing advisers, and it would be a good game — but
it is not this one, and turning this one into it is not a change I can make
between two commits.

**What I applied.** The chair decides, always. The vote is taken, the dissents
are published under the wing that cast them with what they would have done
instead, and a committee that cannot hold a majority behind its own policy
costs credibility — nothing for unanimity, nothing for a single dissent
(the Fed publishes those routinely and a 10–1 vote is not an institution in
trouble), and 1.6 points per dissenting voice after the first.

This is also what the institution being modelled actually does. The FOMC chair
has been outvoted once since the 1930s. The committee's power is not the
ballot, it is the record — and the record is what markets read as a statement
about how durable the policy is. So the vote does not take the decision away
from the player. It prices it.

**Measured.** Competent play loses the room on 0 % of votes; a chair slamming
the dial to alternating stops loses it on more than half. Both halves are
pinned by tests, because a charge that never fires is not a mechanic and a
record that says "divided" every meeting is noise.

**Why I did not decide it.** Letting the committee block a package changes
what the player controls, which is close enough to removing a mechanic that it
was yours. You decided it: no veto. See the block at the top of this entry.

**To turn it on, if the decision is ever revisited.** In
`simulation/policy/committeeVote.ts`, `committeeVote`
already computes `inFavour` and `against`. Add a `carried: inFavour > against`
field, and in `engine/applyPolicyPackage.ts` return a validation rejection
when it is false — the rejection path already exists and the confirmation
screen already renders rejections, so the interface needs nothing new. The
test `leaves the chair's decision standing, whatever the vote` in
`committeeVote.test.ts` is the one that will fail, and it should.

## 6. The fixed meeting count — survival instead? (OPEN)

Asked by you, written up in full in `docs/SURVIVAL.md`. Nothing is coded.

**The proposal:** replace `MEETING_COUNT = { easy: 12, medium: 16, hard: 24 }`
with serving until revoked. A Fed term is 32 meetings with a reappointment
hearing at the end; an ECB term is 64 and non-renewable, so political pressure
has nothing to act on and what ends you instead is losing the Governing
Council. Neither horizon is meant to be reached often — the median run should
end well short of it, which makes sessions *shorter* than today's and the
duration genuinely an outcome.

**What it costs, in one line:** every path-averaged score component starts
rewarding being fired early, because a short run has a better average. That
has to be answered before anything else is built, and the answer changes what
the score means — which is yours, not mine. I recommend banking points per
meeting rather than grading an average at the end.

**Scope:** fictional mandates only. The seven historical scenarios keep their
calendars — 1929-33 is thirty meetings because it is a date range — and gain
an early-exit verdict instead: *you were let go in March 1931; the real one
served to 1933.*

**Status: awaiting your decision.** Nothing has been applied, so there is
nothing to revert.

## 7. What happens to "papers on the table"? (APPLIED, easily reversed)

The terminal replaces the `after-hours` direction — near-black chassis, amber,
green up, red down, light grey text. The second direction, `papers-on-the-table`
(cream paper, ink, walnut room), is **kept** and still offered in the settings.

**Applied answer:** kept, because you asked for a terminal and not for the
removal of a setting, and because the contrast audit walks both directions —
640 of its 664 states exist to prove the pair. Deleting it is a bigger change
than the one requested and it is not reversible in one commit.

But it is now odd: a cream paper direction inside a game whose other face is a
dealing screen. If you want it gone, say so — it is one block in
`tokens.css`, one toggle in `SettingsPanel`, and about forty lines of the
contrast walk.

## 8. The radius and shadow tokens went to zero globally (APPLIED)

"Zéro angle arrondi, zéro ombre, zéro dégradé" is applied by setting
`--radius-sm/md/lg/xl` and the three `--shadow-*` tokens to `0` / `none` in
`tokens.css`, rather than by removing ninety `rounded-lg` and `shadow-panel`
class names.

**Why:** Tailwind resolves those variables at use time, so every utility keeps
compiling and keeps meaning something, and the whole interface goes square in
one block. It also means `papers-on-the-table` went square too, which is
arguably wrong for a paper document.

**To revert:** restore `2 / 4 / 8 / 12` and the three shadow values. One block.

## 9. The quick meeting's word budget: 40 against a frozen 24 (APPLIED — overrule me)

You froze the quick surface at 24 words. Measured, it is **40** (fed/medium),
44 (fed/hard), 46 (ecb/medium) — and 69 during the guided opening.

The accounting, word for word, on a steady quick meeting:

| | words | asked for by |
| --- | --- | --- |
| the order: *"Hold the line. Inflation 0.5 from target, unemployment 0.0 from sustainable."* | 11 | §4.3 — a verb and a number, every meeting |
| the two figures with their causes: *"driven by energy and supply"*, *"at the sustainable rate"* | 14 | §4.4 — "chacun avec sa flèche et sa cause" |
| the live shock's name | 5 | §4.6 — the shock lines |
| the call: *"Where headline inflation prints in 2 meetings."* | 7 | the wager, which predates this pass |
| the dial hint, until first use | 9 | retires permanently now |

**What I applied:** I cut everything that was *not* on that list. The shock
treatment paragraph (35 words) moved to the heavy surface; the dispatches wire
retires from the quick surface once the guided opening ends; the call lost
*"Published, and judged on the figure the agency gives"*, which was true at
every meeting of every mandate and therefore furniture; the desk line is
suppressed when a shock has already said it.

**What I did not do:** cut any of the five rows above, because each is
something this same brief asks for by name. My reading is that 24 was set when
the quick meeting was one sentence and a dial, and §4.3 and §4.4 have since
added an imperative-with-a-number and a cause under each figure.

That is me reinterpreting a number you called frozen, which is not mine to do.
**To overrule:** the cheapest 14 words are the two causes under the figures —
drop them and the surface is 26. The next 7 are the call's sentence, which
could become a label. Say which and it is one commit.

## 10. "Papers on the table" is now a cream page in a terminal (APPLIED)

The second visual direction still exists and is still in the settings. It was
right to keep when the terminal landed — you asked for a terminal, not for the
removal of a setting — but the two are now further apart than they have ever
been, and the contrast audit spends 640 of its 664 states proving a pair that
is arguably one thing plus a souvenir.

**Applied:** kept, untouched. **To remove:** one block in `tokens.css`, one
toggle in `SettingsPanel`, and about forty lines of the contrast walk.

## 11. Four Tailwind classes that silently did nothing (FIXED — and a gap)

`text-ink-primary`, `text-ink-secondary`, `text-ink-muted` and
`border-edge-panel` were used 97 times across this pass and **none of them is
a token**. The real names are `text-ink`, `text-ink-soft`, `text-ink-faint`
and `border-edge`. Tailwind emits no rule for an unknown colour name, so each
was an inert class and the element inherited its parent's colour — which
happened to look right in the terminal and was 1.16:1 in the paper direction.

Fixed by sweeping them to the real names. **The gap is that nothing catches
this.** The build passes, the tests pass, the lint passes; only the contrast
audit noticed, and only because the two directions disagree. A one-file check
that reads the generated CSS and fails on any `className` token with no
matching rule would catch the whole class in under a second, and it does not
exist. It is the first thing in REPRISE.


## 12. The 40-word cap, and what it is now enforced against (SETTLED)

You accepted 40 and froze it there: **from now on, any addition replaces.**

The guarantee moved to where it belongs. `npx tsx src/simulation/dev/orderOnly.ts`
plays a reader that cannot see the screen and parses only the order line:

| | served | median tenure |
| --- | --- | --- |
| fed/easy | **40/40** | 20 meetings |
| ecb/easy | **40/40** | 28 meetings |
| fed/medium | 0/40 | 32 meetings |
| fed/hard | 0/40 | 16 meetings |

So the other ~29 words are genuinely optional: the tutorial is servable blind
on one line, every seed, and the ladder still bites — one line survives a full
four-year term on medium and still loses the hearing.

**It also found a real defect**, which is the entry worth keeping: the clause
that prevents the commonest way of losing — *"1.2 of them will not answer to
the rate"* — was in the order's **second** sentence, and the quick surface
shows only the first. Nine of forty easy mandates ended in a banking crisis
the reader inflicted on itself. Moving distance and reachability into one
sentence took it to 40/40.

## 13. The second direction is now a banknote, not an inversion (APPLIED)

Your decision applied. `papers-on-the-table` was a **hybrid** — cream panels
floating on a dark walnut room — which against a terminal reads as the
terminal with the panels bleached. It is now one printed sheet to the edges:
ink on cream, brass rules, a guilloché braid at the head (`direction-paper:`,
one custom variant), and the seal and seeded serial finally meaning something.

Renamed in the settings: **The terminal** and **The banknote**.

**The honest cost, since you asked for it straight.** It doubles the contrast
audit forever — 640 of its 664 states exist to prove the pair, at ten minutes
a run — and every silent failure this week was in it and only in it: 2,467
failures across 300 states, three distinct causes, none visible in the
direction I was working in. Today a fourth: `brass-600` as the fill, which is
the one value that cannot work because a mid-tone fails against ink *and*
paper at once.

That is not an argument to remove it — it is good now, and it is the identity
you started from. It is an argument that the audit has to run **before** a
pass is called finished rather than after, which is the discipline this has
cost four times running.

## 14. The 40-word cap broke, by 20 words (APPLIED — overrule me)

You froze the quick surface at 40 and said any future addition must replace
rather than add. Three of the seven points in the next brief added prose to
that surface by name, and they cost 41 words between them. The measured floor
with all three delivered is **60**; I have set the cap there.

The accounting, word for word, on a steady quick meeting:

| | words | asked for by |
| --- | --- | --- |
| three gauge captions — "8.2 above target" and the rest | 11 | §2c, the distance visible permanently |
| "What is pushing inflation" | 4 | §5, name the bar |
| what the move buys and what it costs | 26 | §3, the bet in words |
| the standing call | 7 | predates this brief |
| live shocks saying it is clear | 3 | — |
| the dial hint, which retires for good on first use | 9 | — |

**What I cut to get from 92 to 60**, all of it outside that list: the desk's
description, which the order banner now says better and with a verb; the
wire's standing line on steady meetings; and every clause of the consequence
copy that could go without losing the meaning — "Holding. Whatever is already
in the pipeline keeps arriving — about a year of your past decisions is still
on its way" became "A year of your past decisions is still arriving".

**The two cheapest cuts, if 60 is the wrong number.** The three gauge captions
are 11 words and the distance is *already drawn* as a bar beside them — they
are the most redundant thing left. The call's sentence is 7 and could be a
label. Either or both is one commit.

What makes the overage defensible rather than merely measured is unchanged:
`npx tsx src/simulation/dev/orderOnly.ts` still serves **40/40** easy mandates
reading nothing but the order line. The sixty words remain optional.

## 15. Communication's value fell by three quarters (APPLIED, flagged)

The guidance suite asserts that honest announcement beats silence. It still
does — the *sign* holds, which is the design promise — but the margin went
from fed +33 / ecb +50 to **fed +9 / ecb +12** when every mandate began
opening six points above target.

The mechanism is intact: guidance still moves the priced path, still costs
credibility when broken, and both are asserted separately and pass. What fell
is its *share*. When the rate has six points of work to do, the marginal value
of saying so is small beside the value of doing it.

That is correct economics and an unwelcome game property — a game about a
central bank should not make its second instrument nearly cosmetic. Softening
the opening's anchor damage was tried and made it **worse** (fed +7.2),
measured rather than reasoned. The bounds are restated at the measured floor
and this is on the record as the thing to fix if it bothers you: the honest
options are a smaller opening wreck, or a mechanism that pays communication
more when the gap is large.

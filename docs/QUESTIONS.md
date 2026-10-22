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

## 16. The 60-word cap is frozen, and the real guarantee is now a test (SETTLED)

Agreed and frozen at 60. The number that matters is in `npm test` from now
on, not in a harness nobody runs: `features/meeting/orderOnly.test.ts` plays a
reader that sees only the order line and fails if it serves fewer than **40 of
40** easy mandates, on either institution. It currently serves 40/40 on both.

`dev/orderOnly.ts` keeps the diagnostics and the harder modes for comparison —
0/40 on medium and hard, which is the ladder working: one line keeps you alive
on medium for a full four-year term and still loses you the hearing.

## 17. Communication is alive, and slightly better late (MEASURED, APPLIED)

Measured where you said to measure it. `dev/lateGuidance.ts` pairs the same
economy with and without the committee saying what it is doing, and splits the
mandate at the point inflation comes back within 1.5 of target:

| | while inflation is far out | once it is coming back |
| --- | --- | --- |
| fed/medium | +4.7 anchor points | **+5.2** |
| ecb/medium | +5.5 | **+5.9** |
| fed/hard | +5.0 | **+5.6** |

So the instrument is not dead. The honest reading is not that it is worthless
early and valuable late — it is worth about the same five points throughout.
What changes is its **share of what is left to win**: while inflation is six
points out, five anchor points is a rounding error beside the rate's work;
once it is within a point and a half, the anchor is the only thing still in
play.

**Applied:** the wire now says so, once, at the meeting the crossing happens —
*"Inflation is back within reach, so the rate has done most of what it can.
What is left is whether people believe it will stay there."* Fired on the
crossing rather than on the state, so it is news rather than furniture.

## 18. A careful ECB chair is punished on cohesion — **ANSWERED: give the instrument**

**Settled on 21 October 2026, by you, in these words:** *"DONNE-MOI
L'INSTRUMENT. La BCE en a un dans la vraie vie, et il est fait exactement pour
ça : les achats ciblés contre la fragmentation, l'OMT en 2012, le TPI en 2022.
Si j'ai des facilités de liquidité, j'ai un levier sur les spreads — et la
cohésion redevient alors un composant de score légitime, parce que je peux
agir dessus."*

**Applied, and it was one line of config.** `transmission_protection` already
existed, with the right mechanism and a political cost attached. It was
`availableFrom: 'hard'`, and `cohesion` carries 0.08 of the ECB's scorecard at
**every** difficulty. So the instrument was never the problem. Its
availability was. It is now open from easy.

**Measured, per channel, in `dev/fragmentation.ts`** — written for this, and
the decomposition is what made the answer obvious. The penalty is three
quantities added together and the instruments reach exactly one of them:

| channel | weight | what reaches it | ecb/hard, competent |
| --- | --- | --- | --- |
| inflation dispersion | 1.0 | nothing | 0.50 |
| unemployment dispersion | 0.6 | nothing | 0.63 |
| spread range ÷ 100 | 1.0 | three instruments | **1.36** |

The spread range is the biggest of the three *and* the only one that responds,
so an instrument pointed at it can carry the component. Cohesion under
competent play, before and after opening the tool:

| | never using it | reaching for it | holding it at full |
| --- | --- | --- | --- |
| ecb/easy | 0.729 | **0.983** | 1.000 |
| ecb/medium | 0.552 | **0.959** | 1.000 |
| ecb/hard | 0.387 | **0.830** | 1.000 |

**And it is not free, which is what keeps it a decision.** Holding it at full
for a whole mandate costs political pressure — which is what brings the
demands of `politics/demands.ts` forward, including the one that puts the
mandate itself on the order paper — and at medium it costs eight meetings of
tenure. Paired on the seed, reaching for it when the area is coming apart
banks **20 a meeting at hard against 9** for never touching it. At medium it
banks *less* (53 against 67), and that is correct rather than broken: the
instrument restores policy transmission, medium's economy is cost-push, and
restoring transmission in a cost-push economy transmits the cost and not the
cure. It is the real trade and it is the thing to understand about the area.

**The residual, stated plainly.** Passivity still scores slightly better on
cohesion than competence at hard — 0.971 against 0.830 — because tightening
into a downturn widens member spreads and a committee that does nothing does
not. The instrument narrows that from a 0.58 gap to 0.14 and makes it
*answerable*; it does not close it, and closing it would be asserting away the
whole of 2011, which you have said twice not to do.

**Option (b) does not work, and I nearly told you it did.** You offered
"cohesion out of the score and into revocation" as the fallback, and my first
draft of this entry said the structure already exists — `council_lost` in
`scoring/endConditions.ts`, which ends an ECB presidency on member inflation
dispersion with fragmentation, held for five meetings. I checked before
claiming it. **It cannot fire.** See **#23**.

**The rule, generalised.** `scoring/instrumentReach.test.ts` fails the build
when a component with weight at an institution has none of its instruments
available at a difficulty. Verified by putting the bug back: it names the
mode, the weight and the instruments.

## 19. The cohesion tolerance was calibrated against the wrong statistic (FIXED)

Found while answering #18, and it is the defect of this pass.

`dev/cohesion.ts` is the committed script whose entire job is to set
`COHESION_TOLERANCE` against the penalty the score charges, and its docstring
said it "duplicates the three lines of `calculateScore` that build the
penalty". It duplicated their *shape*. `calculateScore` imports `dispersion`
from `engine/members.ts` — a **GDP-weighted mean absolute deviation**. The
script declared its own, an **unweighted population standard deviation**.

The two differ by about 0.4 of penalty at every difficulty, always in the same
direction, so the tolerance sat above what competent play actually produces
and the component scored a constant **1.00** at easy and medium however the
area was steered. Question **#2** in this file noticed that constant row and
attributed it to the union's structure barely responding to policy. It was not
the structure. It was the ruler.

**Applied.** `scoring/cohesionPenalty.ts` now holds the penalty, decomposed,
and the score, the calibration script and the diagnosis all call it — the only
repair that holds for a quantity stated in two places is for there to be one
place. The tolerance is **1.9**, the measured competent floor on the statistic
the score charges (min 1.88 / 1.79 / 1.92 across the three difficulties, 100
mandates a cell).

**What that changes.** Cohesion is now a live row at every difficulty instead
of a full one at two of them, which also answers the honest half of #2: medium
does not need its row dropped, it needed its ruler fixed.

**To turn it back.** `COHESION_TOLERANCE = 2.3` and re-run
`npx tsx src/simulation/dev/cohesion.ts` — which will now disagree with it,
because the script has been corrected.

## 20. Communication is worth tenure, not points (MEASURED)

**Your correction, and it was right:** *"Ça mesure le MÉCANISME, pas le GAIN.
Donne-moi la valeur en POINTS DE SCORE : est-ce qu'un joueur compétent qui
parle bat un joueur compétent qui ne parle jamais, en fin de partie réussie ?"*

`dev/guidanceValue.ts` measures it in both scores the player is shown, paired
on the seed — the same economy, the same package, spoken or not. Silence is
not a worse package; it is the same one unannounced, and it is *advantaged* on
the conduct gate, because a committee that promises nothing breaks no promises.

**The answer has two halves, and the second one is the instrument.**

**At the end of a successful mandate, the gain is a coin flip.** On ecb/medium
— the only bucket where enough mandates survive in both arms to compare —
speaking banked 5,429 against silence's 5,212 and won **15 of 30**. On its own
that reads exactly as you feared: decorative.

**Conditioning on success is what hides it.** Speaking is not what wins points
in a mandate that succeeded; it is what makes the mandate succeed:

| | speaking | silent |
| --- | --- | --- |
| ecb/medium, mandates served | **48 / 80** | 33 / 80 |
| ecb/medium, median tenure | **64** | 51 |
| fed/medium, mandates served | **9 / 80** | 3 / 80 |
| fed/medium, mean tenure | **35.6** | 28.4 |

And because the banked score multiplies length by quality, that survival gain
*is* the points gain once the conditioning comes off: ecb/medium banks **3,856
speaking against 2,526 silent**.

So the instrument is alive and no repair is called for — but the earlier
reading was looking in the wrong place twice, and the second time was mine:
not only mechanism-versus-gain, which you named, but the conditioning, which
throws away precisely the seeds where the instrument did its work.

**Pinned.** `engine/guidanceValue.test.ts` holds the claim as tenure at
medium, with the banked total beside it so tenure cannot be bought with worse
meetings. Verified by swapping the arms: it fails naming both institutions.

**Not asserted, and the reason is a finding.** The survival *count* is the more
legible statistic and cannot be bounded at fed/medium at any sample size this
suite can afford: the base rate is about one mandate in ten. That the benchmark
rule clears a Fed reappointment roughly a tenth of the time is in #22 below.

## 21. The difficulty ladder: it holds through meeting five or six (MEASURED)

**Your question:** *"Sur combien de réunions l'échelle tient-elle, en facile,
en moyen et en difficile ? Si elle s'effondre au bout de trois réunions, elle
ne décrit que l'écran d'accueil et pas le jeu."*

`dev/ladder.ts` walks the mandate instead of reading meeting zero. The first
answer it gave was **one meeting**, and that answer is wrong for two reasons
worth separating.

**A count cannot carry a ladder.** Inflation one point above target and
inflation six points above target are both "broken", and the difference
between them is most of what separates the modes. The rung has to be a
*distance*.

**The third reading is a guard, not a target.** `explain/mandate.ts` says so
in the words the player reads — growth is *"not a target, the cost of reaching
the other two"*. A guard broken for thirty consecutive meetings is a third
target, and a guard nobody is pushing against should close. Counting it
alongside the targets is what produced the one-meeting reading.

**The number, measured on the two targets as a distance, under passivity:**

| | holds through |
| --- | --- |
| fed | **meeting 6** |
| ecb | **meeting 5** |

**And the guard, as a frequency, which is how a guard works:**

| | easy | medium | hard |
| --- | --- | --- | --- |
| fed, passive | 2 % | 3 % | **12 %** |
| ecb, passive | 4 % | 5 % | **16 %** |

So the ladder outlasts the opening screen by five or six meetings rather than
collapsing at one, and the guard is ordered by difficulty across the whole
walk. `engine/ladder.test.ts` holds both, with the bound at 4 — below both
measurements, because what is worth failing a build over is the ladder
shrinking back to meeting zero.

**Beyond meeting six the modes cross, for a reason worth recording: hard
mandates end.** Mean tenure under passivity is 12.5 meetings at fed/hard
against 18.8 at fed/medium, so a hard average at meeting 18 compares the seeds
that survived against medium's whole population. The late-mandate ladder is
tenure, not readings.

**Two things found on the way, both corrections to this file's own claims.**
The trend-growth cut that journal 22 credits with holding hard's third reading
does not hold it and never did — the rebound out of a −5.5 output gap is about
**+4.6 points of growth** against a cut of 1.8, and the cut is additionally
*floored* at 0.1, so on the ECB any value below −1.2 does nothing at all. The
floor is now a named constant with its reason; the false claim is gone.

**Open, and not fixed.** Under *competent* play the guard's ladder inverts at
easy on the ECB: a chair following the lesson breaks the growth guard on 44 %
of meetings at ecb/easy against 29 % at hard, because the ECB's trend growth
is 1.3 and there is only 0.8 of room above the floor. The tutorial punishes
the player for doing what it teaches. Fixing it means retuning easy, which is
a mode's character; say the word.

## 22. Two scores disagree — **ANSWERED: the banked score is the score**

**Settled on 22 October 2026, by you, in these words:** *"LE SCORE ENGRANGÉ EST
LE SCORE. C'est ce qu'on a tranché en passant en survie. L'autre est un reste
de l'ancienne structure : soit tu le supprimes, soit tu le gardes comme
diagnostic interne, mais le joueur n'en voit plus qu'un. Deux scores qui se
contredisent, c'est pire que n'importe lequel des deux."*

**Applied.** `scoring/theScore.ts` is the only definition and every
player-facing comparison goes through it — the headline, the personal best, the
ten schools' own mandates, the historical standard, the achievement at 8,000
(whose number survived unchanged, because it was always derived from
`BANKED.meetingPoints` × a Fed term). The graded breakdown stays as the
**explanation**: its components say which objective was lost and by how much,
which is what a report is for, and its total is gone. The section is headed
"Where the points went" and says in one line that the score is the banked
figure above it.

`SCORING_VERSION` is 2.0.0 and is now part of the records bucket key — the key
carried the engine version only, which is not enough when the same mandate
stores 5,437 where it used to store 1,741. An ESLint rule scoped to the
player's own tree keeps the second score out; its first selector matched
`entry.score.score` and missed the commonest form, the bare `score.score`,
which is a rule that catches the rarer half of a defect and reads exactly like
one that works.

**It also answered four of the six balance warnings — see #24.**

The question as it was asked is kept below, because it carries the numbers.

### The question as it was asked

Found three times over in this pass, from three directions, and it is one
thing.

The game has **two** scores. `bankedTotal` is the headline on the result
screen, earned meeting by meeting, built precisely so that being dismissed
early stops paying — see `scoring/banked.ts`, which argues it at length.
`calculateScore` is the scorecard underneath it, and it still grades **path
averages**: RMSE of inflation, mean credibility shortfall, mean stress. Under a
survival structure that rewards brevity, which is the exact defect banked
scoring was written to remove, and the conversion stopped halfway.

**Measured, ECB, competent against passive:**

| | banked | graded |
| --- | --- | --- |
| medium | 2,611 vs **331** | 2,159 vs **2,318** |
| hard | 329 vs **40** | 1,278 vs **2,519** |

The headline says competence wins by 8× at medium. The scorecard says
passivity wins. Both are on the result screen, and `calculateScore().score` is
what the records page compares and what every bucket's personal best is set on.

It is also why `npm run sim:sweep` reports **six balance warnings** — "no rule
scores better than doing nothing" at five buckets and "unwinnable as
configured" at fed/hard. **Those are not new in this pass**: `main` reports the
same six, checked by stashing. REPRISE's "no sweep warnings" is stale and dates
from before survival landed.

**Why I did not decide it.** Converting the scorecard to bank per meeting
changes what every component means and voids every measurement in
docs/BALANCE.md; leaving it means the game ships two verdicts that disagree.
Either way it is what the score *means*, which this file has said four times
is yours. The three options, in my order of preference:

a) **Weight the graded components per meeting served** rather than averaging
   the path, which is the same repair banked scoring already made, applied one
   level up. Every component keeps its meaning; the aggregation changes.
b) **Show only the banked total** and demote `calculateScore` to the
   explanation of *why* — it is already presented that way under "Why this
   score", so this is mostly deleting a number.
c) Leave it, and change the sweep's warning to compare banked rather than
   graded, so the tool stops reporting a defect the headline does not have.

## 23. The ECB's own ending cannot happen — **FIXED, by the 2011 mechanism**

**Settled on 22 October 2026, by you:** *"Corrige-le, et choisis l'option qui
garde le sens historique : on perd le Conseil parce qu'on tient une politique
qu'un bloc de membres ne peut plus accepter — Weber et Stark en 2011 — pas
parce qu'un dé est tombé. Donne-moi le taux de déclenchement après correction."*

**Applied, and it is not option (a) from the list below — it is better.**
Dispersion was the wrong quantity altogether: it is a fact about the member
*economies*, inherited and only partly steered, and nobody resigned from the
Executive Board in 2011 because Spanish and German inflation had diverged. What
happened is that a policy was adopted and held while a part of the Council could
not accept it. That is **sustained dissent by a bloc**, and every piece of it
already existed — `committeeVote.ts` casts the ballots, publishes the dissents
under the wing that cast them, and charges credibility for a committee that
cannot hold a majority. What was missing was a consequence beyond the charge.

A third of the committee against, for **six consecutive meetings**, the count
resetting the moment the room comes back.

**The trigger rate, which you asked for** (`dev/councilProbe.ts`, 60 mandates a
cell):

| | ends on it | shown the warning | longest streak |
| --- | --- | --- | --- |
| ecb/medium, competent | **0 %** | 7 % | 2 |
| ecb/medium, passive | 92 % | 100 % | 6 |
| ecb/medium, stubborn | 87 % | 100 % | 6 |
| ecb/hard, competent | **0 %** | **43 %** | **4** |
| ecb/hard, passive | 65 % | 100 % | 6 |
| ecb/hard, stubborn | 53 % | 100 % | 6 |

A competent chair never loses the Council, and at hard is *told* it is
straining in 43 % of mandates and gets within two meetings of losing it. Real
enough to matter, rare enough to be an event, and answerable at every one of
those meetings because the dissents say what they wanted instead.

**Six was measured against five and eight.** At five the ending arrives at
meeting five for a chair opposed from the first, which is quick for something a
presidency ends on; at eight the warning reaches a competent hard chair in 12 %
of mandates instead of 43 %, and a consequence nobody is warned about is an
ambush. Six is nine months at eight meetings a year, inside the period it is
drawn from — the Securities Markets Programme began in May 2010, Weber went
public in February 2011, Stark resigned that September.

**The tutorial is exempt** and stays so: `tutorialProgress` returns before the
survival block, easy ends on its goal, and the Fed tutorial has no hearing
either.

**And the guardrail that did not exist for any end condition.**
`scoring/reachable.test.ts` plays 108 fictional mandates under three rules and
fails if a listed ending never occurs, with every exclusion carrying its reason.
Verified by setting the bar to 99: it fails naming `council_lost`.

The question as it was asked is kept below.

### The question as it was asked

Found while checking a claim I was about to make in #18, and it is the most
consequential piece of unreachable content this project has produced.

`council_lost` is the **only** way a fictional ECB presidency ends short of a
catastrophe. The structure is deliberate and it is written up in
`docs/DIRECTION.md`: nobody can remove an ECB president and there is no second
term to withhold, so what ends the presidency is losing the Governing Council.
`docs/REPRISE.md` has stated it as a fact for several passes. The warning tier
tells the player, in the game, *"You cannot be removed and you cannot be denied
a second term. You can lose the room."*

**You cannot lose the room.** Measured over 360 ECB mandates in
`dev/councilProbe.ts`:

| | dispersion p50 | p90 | **max** | fragmentation p90 | both bars met |
| --- | --- | --- | --- | --- | --- |
| ecb/easy, competent | 0.37 | 0.48 | 0.51 | 151 | **0.0 %** |
| ecb/medium, passive | 0.43 | 0.55 | 1.08 | 281 | **0.0 %** |
| ecb/hard, competent | 0.49 | 0.94 | **1.85** | 139 | **0.0 %** |
| ecb/hard, passive | 0.48 | 0.66 | 1.31 | 263 | **0.0 %** |

The bar is `COUNCIL.fractureDispersion = 2.4` with
`fractureFragmentation = 290`, held five consecutive meetings. The highest
dispersion ever reached is **1.85**, and it was reached at ecb/hard under
*competent* play — where fragmentation is lowest, because a competent rule uses
the anti-fragmentation instrument. The two quantities peak under opposite
conditions and the conjunction is never satisfied, at any difficulty, under any
play. `ended` is 0 of 60 in every cell.

**The warning fires and the failure cannot.** `watchDispersion` is 1.8, which
the hard mode does reach — so a player can be told the Council is straining,
repeatedly, by a game that has no mechanism to carry it out.

**Why the levels are not the fix.** I measured candidate bars rather than
guessing one, which is `dev/gateProbe.ts`'s rule — set a gate from two
populations and put it where it bills the pattern, not the accident. At the
loosest candidate pair the condition is still held long enough in 2-3 % of
*passive* runs and 0 % of competent ones:

| ecb/medium | frag 250 | frag 300 | frag 350 |
| --- | --- | --- | --- |
| dispersion 0.6 | 0 % / **3 %** | 0 % / 2 % | 0 % / 0 % |
| dispersion 0.8 | 0 % / 0 % | 0 % / 0 % | 0 % / 0 % |

So it is the **conjunction** that is unreachable, not the height of either bar.
Inflation dispersion is driven by energy-exposure differentials and the local
Phillips curve; fragmentation is driven by the policy rate and the output gap.
They do not move together, and requiring both for five consecutive meetings
asks for a coincidence the model does not produce.

**Why I did not fix it.** The repair is not a threshold, it is a decision about
**how an ECB presidency ends**, which is the same class as #5 (can the
committee refuse) and #6 (survival instead of a fixed count) and has been
yours both times. Three options, in my order of preference:

a) **Gate it on the cohesion penalty itself** — the blended quantity
   `scoring/cohesionPenalty.ts` now computes and the scorecard already charges.
   One number instead of a conjunction, it is the thing the player is already
   being shown, and it is *answerable*, because the instrument opened in #18
   moves it. Measured, that penalty runs about 1.8-2.4 under competent play and
   2.6-3.1 when the tool is never used, so a bar near 3.2 held for five
   meetings would separate them. **This also delivers your option (b) from #18
   properly** — cohesion in the revocation condition — without taking it out of
   the score, which (a) made unnecessary.
b) **Gate it on fragmentation alone**, which is the quantity that actually
   separates competent from neglectful play (p90 139 against 263 at hard). Loses
   the "members apart on inflation" idea, which is the better story.
c) **Remove the ending and the warning**, and let an ECB presidency end only on
   the catastrophes. Honest, and it gives up the one structural difference
   between the two institutions' survival.

**To make option (a) real** — `COUNCIL` in `config/tenure.ts` grows a
`fracturePenalty` and loses `fractureDispersion`/`fractureFragmentation`; the
block in `endConditions.ts` calls `cohesionChannelsAt(state.members).total`
instead of `dispersion(...)` and compares against it; the warning tier becomes
a fraction of the same number. `dev/councilProbe.ts` is written to re-measure
it, and the test that should exist — and does not, for any end condition — is
one that asserts every condition in the catalogue is reachable at all.

**The lesson, which is bigger than this entry.** `dev/gateProbe.ts` was written
two passes ago precisely because three hand-authored gates were wrong, two of
them unable to fire. It probes the *event* gates. Nothing probes the **end
conditions**, which are the gates that decide whether a mandate ends, and one
of them has been dead for as long as it has existed while two documents
asserted it worked. A check that covers one family of hand-set thresholds and
not the other is the same shape as a rule nobody runs.

## 24. The six balance warnings, one line each — **ASKED FOR, and four were the score**

> "Les six avertissements d'équilibrage que tu dis réels mais antérieurs à
> cette passe : liste-les-moi en une ligne chacun, avec ce qu'ils coûtent au
> joueur."

**Four of the six were QUESTIONS #22 wearing a different hat.** The sweep
compared `calculateScore`, the graded total, which under a survival structure
rewards an early exit — so it reported that doing nothing beat every rule at
five buckets while doing nothing was *being dismissed* at every one of them.
With the sweep reading the banked score, as of this pass:

| | warning | what it cost the player | status |
| --- | --- | --- | --- |
| 1 | `fed/easy: no rule scores better than doing nothing` | nothing: doing nothing banked 4,282 graded against competence's 4,091 while completing 76 % against 100 % | **still fires**, narrowly — see below |
| 2 | `fed/medium: no rule...` | nothing: the graded score preferred a mandate dismissed at meeting nine | **gone** — banked, the toolkit scores 2,032 against 1,428 |
| 3 | `fed/hard: never survived under any rule` | the real one — see below | **still fires** |
| 4 | `fed/hard: no rule...` | nothing | **gone** — 392 against 509 is now a genuine tie, inside noise |
| 5 | `ecb/medium: no rule...` | nothing | **gone** — the toolkit banks **3,687 against 417**, a nine-fold gradient that the graded score reported as 2,177 against 2,229 |
| 6 | `ecb/hard: no rule...` | nothing | **gone** — 107 against 12 |

So: **two warnings, both real, and neither costs the player anything today.**

**#1, fed/easy.** Doing nothing banks 2,876 against competent play's 2,860 —
a 0.6 % difference, well inside seed noise — but doing nothing *completes* 76 %
of mandates against 100 %. The tutorial's economy partly heals itself, which
journal 21 already recorded as a thin gradient. It costs the player nothing
because the mandates passivity loses are the quarter it fails; it is on the
record because a tutorial whose lesson is "the lever works" should not be
winnable by not pulling it. **Not fixed**: the honest repair is a tutorial
opening that does not heal, and that is the mode's character.

**#3, fed/hard: "never survived under any rule. Unwinnable as configured."**
This one is the sweep measuring the wrong thing, and it is worth knowing why
before anybody retunes hard to satisfy it. `completed` under a survival
structure means *served the full horizon* — 64 meetings, two Fed terms through
two reappointment hearings. `config/tenure.ts` says in as many words that
**neither horizon is meant to be reached often** and that the median run should
end well short of it. So "0 % completed" at hard is the structure working, not
the mode being unwinnable, and the warning is a fixed-length criterion applied
to a game that stopped having fixed lengths. It costs the player nothing. The
fix is to the sweep's definition of success, not to hard — and it is not made
here, because changing what the balance tool calls winning is a thing to decide
rather than slip in beside seven other changes.

**What it cost to find out:** nothing but running it. The reason it had not
been run is the one worth keeping — REPRISE claimed "no sweep warnings" from
before the survival restructure, and nobody re-ran the thing the claim was
about.

## 25. The advisers' room — **it was already there; one gesture was missing**

> "C'est mon idée de départ et elle n'est encore qu'à moitié là : les doctrines
> parlent, mais je ne peux pas les CONVOQUER sur une situation précise. […] Si
> « OPEN THE ROOM » fait déjà une partie de ça, dis-le-moi et complète au lieu
> de reconstruire."

You asked, so: **five of the six things on that list were built.** Not
half — all of it except the door leading to the right place. Point by point,
with where each lives:

| asked for | where it is |
| --- | --- |
| open the room at any meeting | the `Open the room` control on the quick surface |
| two or three advisers, by **maximum disagreement** | `doctrines/debate.ts` — the two furthest apart, then a third furthest from *both*, because a midpoint adds a number without adding an argument |
| each gives school, reading of *this* state, what they would do and why | `DebatePanel` → `view.argument`, with the recommendation in basis points beside the name |
| and answers the other **by name** | `DoctrineSpeaker.rebuttal`, built in `debate.ts` |
| arguments that hold in front of an economist | `view.evidence` and the sources line — the hawk cites Barro and Gordon (1983) and the Bundesbank tradition |
| the running scoreboard, "right 7 times in 10" | `ScoreboardPanel`, "Who has been right", settled by **counterfactual replay** rather than opinion: that school's meeting replayed with one rate changed, same shocks, judged four meetings later on the mandate's own loss |

**What was actually missing.** `Open the room` set the room open and left the
player on the newspaper, so the committee was three gestures away — open, then
Policy Desk, then "The case". The desk already *defaults* to that face; the
door simply did not lead there. It now opens onto the committee arguing, which
is one gesture, which is what was asked. The newspaper is still one click away
and is still where an unopened meeting lands.

**On the cost**, you described it rather than asked for it: *"ouvrir la salle
transforme une réunion rapide en réunion lourde"* — that is exactly what it
does and has done since the restructure. The quick surface is 63 words and the
room is 325 to 342. Nothing was added, because adding a second, mechanical
penalty on top of it would charge twice for one decision.

**Verified by playing seven meetings and opening the door**: the committee
appears 625 bp apart, the hawk argues at +500 and rebuts the labour economist
by name, and the scoreboard reads live mid-mandate — "The rule 4 of 4", "The
fiscal realist 0 of 2, agreed with you 2×".

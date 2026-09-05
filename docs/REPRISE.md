# Reprise — where this session stopped

Written at the end of chantier 1 of a two-chantier session. Chantier 1 made the
*kind* of shock the structuring axis of difficulty, and built the three modes
the brief describes. Chantier 2 — the visual design — had not been started when
this was written. `docs/BALANCE.md` and `docs/DIRECTION.md` are the permanent
record; this file is a handoff and can be deleted once its open items are
folded into those two.

## Branch state

`difficulty/three-modes`, seven commits ahead of `main`, tree clean:

```
7a53081 Measure what guidance is worth, and put it on the confirmation screen
e0f9eef Make sabotage cost at every difficulty, and stop double-counting hard
3da6783 Make the objective move with the regime, and say so before judging
4c70c0a Give each mode the toolkit and the voice its brief describes
f1fe5d1 Repair the information ladder, and give hard a divided committee
1e9280e Make the kind of shock the axis difficulty is built on
```

`npm run build` and `npm test` (507 tests, up from 425 at the start) green.
`npm run sim:sweep` reports one warning, deliberately left standing — see "Still
open". **Not merged.** The previous session's REPRISE said the same and was
wrong by the time it was read: `main`, `origin/main` and
`balance/easy-mode-transmission` had all been fast-forwarded to the same commit.
Check `git rev-parse` rather than trusting this paragraph.

**Engine 1.3.0, scoring 1.1.0.** The bump owed since two sessions back is paid.

## What was built

Six commits, each measured before and after. The full write-up is
docs/BALANCE.md, "The three difficulties, and the kind of problem each one
sets". In brief:

1. **Shock character as a difficulty axis.** Every event declares what it asks
   of the committee; `shockMix`, `costPushCeiling` and
   `openingCrisisCharacters` read it. Easy's opener spread across the six major
   crises fell from 3922 points to 928 on the ECB.
2. **The information ladder, implemented.** Medium was getting neither the
   shock's name nor its evidence, contradicting a table both docs had recorded
   as settled since phase 3. Hard gained the divided committee.
3. **The toolkit and the voice.** Instruments configured `availableFrom:
   'medium'` since the toolkit was written had never been reachable. Hard gained
   the free tone, without which bluffing is impossible at any difficulty.
4. **The objective moves with the regime** (requirement a), in the score and on
   screen before the decision.
5. **Sabotage costs at every difficulty** (requirement b). 186–499 against a
   1500 bar, revoked in 92–100 % of seeds.
6. **Guidance measured and made visible** (requirement c). Worth +99 to +227
   points on an identical rate path, winning four seeds in five.

## What did NOT pass, and was reported rather than papered over

**Hard is not winnable by competent play: 27–37 % completion.** The instruction
was to say so rather than dilute the shocks, so no shock magnitude was touched.
One principled change was made — hard's `thresholdLeniency` went from 0.82 to
medium's 1.0, because pulling the definition of catastrophe in *as well as*
throwing bigger shocks is difficulty counted twice — and it roughly doubled
completion.

The diagnosis for whoever picks this up, in the order it should be taken:

1. **The liquidity facilities are net-negative as the engine prices them.** The
   toolkit rule cuts banking crises 21 → 9 per 100 on fed/hard and raises
   dismissals 16 → 32, so the plain rate-only rule completes *better* (41 %
   against 31 %). Escalating a facility on a noisy published stress print trips
   `liquidity_support_without_stress`, and the credibility it costs outweighs
   the stress it relieves. This makes "the full toolkit" partly decorative at
   the difficulty that has all of it, and it is the first thing to fix.
2. The per-meeting failure hazard is a cliff rather than a ladder — 0.0 % /
   0.2 % / 4.6 % — and failures are spread evenly across the mandate, so it is
   a genuine per-meeting hazard and not only 32 meetings of exposure.
3. Binding guidance at hard is correctly lethal and should stay so.

## Next session

**Chantier 2 — the visual design — has not been started.** The brief is in the
session prompt: a token system first (palette, type scale, spacing, radii,
shadows), the boardroom metaphor in dark walnut / brass / cream paper / deep
green / burgundy, one serif for display and a very legible sans for the
interface, legibility before aesthetics, charts under every key indicator,
responsive from 360 px, full keyboard navigation, visible focus,
`prefers-reduced-motion`. **One screen dressed first, for validation, before the
others.** The mascot last and only if there is time.

Two things worth knowing before starting it:

- The interface work in chantier 1 was deliberately minimal and unstyled —
  `ObjectivePanel`, `CommitteeSplitPanel`, `BalanceSheetPanel`,
  `InstrumentStepper`, the guidance preview block and the three-way register in
  `IndicatorRow`. They are new surfaces that have never been designed.
- `components/TrendChart.tsx`, `LineChart.tsx` and `Sparkline.tsx` already
  exist and `IndicatorRow` already renders a trend under every indicator. The
  chart request in the brief is closer to "make these good" than to "build
  these".

## Still open, beyond hard

- **`marketExpectedRate` reaches its rail in one *completed* ecb/hard mandate
  in 150.** The sweep's one remaining warning, deliberately left: a completed
  run touching a computational rail is exactly the case worth hearing about.
  Clamps in runs that have already failed are no longer reported, because an
  inflation spiral ends the mandate at 12 % and the priced path diverging in the
  meeting after that is the spiral, not a defect.
- **Competent play and passive are within 1–2 % on fed/medium and fed/hard.**
  The long-standing structural finding on the Fed. Competent wins clearly on the
  ECB at every difficulty.
- **The ECB is not selectable.** It is fully built and measured in every sweep;
  the setup screen offers only the Fed. Adding it is one radio group. It was out
  of scope for this brief and not done unilaterally.
- **Doctrines** and the three smaller ideas in docs/DIRECTION.md remain
  unimplemented — still the largest differentiating idea on the table, and the
  one tied to the ESH syllabus.
- docs/DIRECTION.md points 5–6 (a summary tab; showing only what is actionable
  on easy) untouched. Point 2's **hard opening state** — an economy already
  damaged before the first meeting — is still unbuilt; hard now has no
  identifiable culprit, but its opening perturbation is the same ambient one
  medium gets.

## Reproducing this session's numbers

```bash
npm test -- src/simulation/events/character.test.ts        # shock character and the mix
npm test -- src/simulation/observation/ladder.test.ts       # the information ladder
npm test -- src/features/meeting/register.test.ts           # the per-difficulty register
npm test -- src/simulation/scoring/regimeObjective.test.ts   # requirement (a)
npm test -- src/simulation/scoring/winnability.test.ts       # requirement (b)
npm test -- src/features/policy/guidancePreview.test.ts      # requirement (c)
npm test -- src/pages/consoleCheck.test.tsx                  # every panel, every difficulty
npm run sim:sweep                                            # the six-bucket table
```

The opener-split table, the conduct signatures, the per-meeting hazard, the
three-arm guidance comparison and the regime-weight gains were one-off
measurement scripts, not committed. Each is a short loop over `playRun` with
`calculateScore`; the guidance one is the only fiddly one, because it records a
rate trajectory from a reference run and replays it move for move in both arms
so the words are the only thing that differs.

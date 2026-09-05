# Reprise — where this session stopped

Written at the end of the session that made the game playable to look at and
to sit through: two short repairs, then the interface. `docs/BALANCE.md` and
`docs/DIRECTION.md` are the permanent record; this file is a handoff and can be
deleted once its open items are folded into those two.

## Branch state

`difficulty/three-modes`. **Not merged into `main`** — verified with
`git rev-parse`, not assumed, because the previous handoff asserted this and
was wrong by the time it was read. Tree clean. `npm run build` and `npm test`
(541 tests, up from 507) green; `npm run sim:sweep` reports one warning,
deliberately left standing and explained below.

Engine 1.3.0, scoring 1.1.0. Neither moved this session: nothing changed what
the engine computes.

## What was built

Nine commits. In order:

1. **The ECB is selectable.** It had been fully built and measured in every
   sweep since the engine existed while the setup screen offered only the Fed.
2. **Hard is winnable** — 55–65 % completion for competent play against
   passive's 43–44 %, with no shock magnitude touched. Two double-counts
   removed. Full write-up in docs/BALANCE.md, "Hard, made winnable".
3. **Design tokens**, committed alone so the visual direction can be reverted
   without undoing anything built on it.
4. **The boardroom dressed, and a markets panel.**
5. **The time-lapse between meetings.**
6. **The package projection** on the confirmation screen, at easy.
7. **A mandate going well now looks like it.**
8. **The charts made good, and the interval made keyboard-safe.**
9. **The postmortem on paper**, and **a tortoise**.

## Two things worth knowing before touching the interface

**The contrast audit is the tool that made this work.** It is not committed —
it lives in the scratchpad — and it is the single most useful thing to
recreate. It walks every rendered text node in a headless browser, resolves the
background actually painted behind it, and fails anything under WCAG AA. It
found 44 failures on the first pass, including a wire report at 1.5:1 and the
result screen's chart labels at 1.04:1. Three of those were not colour choices
at all but *transitions*: a tab animating between paper and walnut spends the
transition putting dark ink on a still-dark ground. It reports ALL CLEAR now,
across five tabs, four screens and both directions. Recreate it before changing
any colour.

**Two directions ship, and the choice is in the settings.** "Papers on the
table" is the default because it is measurably more legible; "the room after
hours" is one attribute away. Any subtree carrying `data-direction` re-themes
itself, because the semantic tokens are published through `@theme inline`.
Nothing in the interface names a raw colour any more — that is worth keeping
true, and `grep -rn "neutral-\\|sky-\\|amber-\\|emerald-" src` outside
`src/styles` should stay empty.

## Still open

- **`marketExpectedRate` reaches its rail in three completed ecb/hard mandates
  in 150.** The sweep's one remaining warning, left deliberately: a run that
  served its full term and still touched a computational rail is exactly the
  case worth hearing about. Not reproducible outside the sweep's own reaction
  rule; not diagnosed.
- **Doctrines**, and the three smaller ideas, remain unimplemented in
  docs/DIRECTION.md. Still the largest differentiating idea on the table and
  the one tied to the ESH syllabus, and now the obvious next thing: the
  interface it would need — a choice at setup, a reading grid, a comparison in
  the postmortem — all now has somewhere to live.
- **docs/DIRECTION.md point 2's hard opening state.** Hard has no identifiable
  culprit and no scripted opener, but its opening *perturbation* is still the
  same ambient one medium gets; an economy already damaged before the first
  meeting is unbuilt.
- **DIRECTION.md points 5–6**: a summary tab, and showing only what is
  actionable on easy. The markets panel and the standing reading between them
  do much of what point 5 asked for; point 6 is untouched.
- **The interval is four frames.** That is `SUBSTEPS_PER_MEETING`, and it is
  the honest number — every frame is a state the integrator passed through. If
  it ever needs to look smoother the sub-step count is the dial, not
  interpolation.

## Reproducing this session's numbers

```bash
npm test -- src/simulation/scoring/winnability.test.ts    # hard is winnable, sabotage is not
npm test -- src/simulation/observation/interval.test.ts    # the time-lapse is the engine's own run
npm test -- src/simulation/policy/projection.test.ts       # the projection never touches the run
npm test -- src/features/meeting/standing.test.ts          # a good mandate says so, a doomed one never does
npm test -- src/pages/consoleCheck.test.tsx                # every panel, every difficulty, both institutions
npm run sim:sweep                                          # the six-bucket table
```

The credibility-trough comparison, the contradiction-frequency table and the
threshold grid were one-off measurement scripts, not committed. Each is a short
loop over `playRun` reading `state.latent` or `validation.contradictions`; the
grid mutates `DIFFICULTIES.hard` in place and restores it, which is why it is a
script rather than a test.

## Playing it

`npm run dev`. Both institutions, all three difficulties, and the settings
disclosure in the meeting header switches the visual direction and turns the
interval off without leaving the meeting.

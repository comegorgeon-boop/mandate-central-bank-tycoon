# Reprise

Where this is, in one page, for whoever picks it up next — including me.

## The branch

`coherent`, merged to main after the opening-states pass. Main is untouched and the player
validates the screen before anything lands there.

| commit | what |
| --- | --- |
| `e255f96` | the terminal: amber on near-black, panels that pave, figures that move |
| `7b3bc2f` | survival: serve until revoked, bank the score meeting by meeting |
| *this one* | legibility: a game that commands instead of describing |

## What the game is now

A dealing-room terminal. Amber on a near-black chassis, panels tiled edge to
edge with one-pixel rules of the chassis showing between them, IBM Plex Mono
carrying figures and labels alike in columns whose label width is a constant.
Spectral survives for the one written line. No radius, no shadow, no gradient
— `--radius-*` and `--shadow-*` are zero in `tokens.css`, which is why ninety
components went square without being touched.

You serve until you are revoked. A Fed Chair has 32 meetings and a
reappointment hearing whose bar is credibility raised by the political
pressure the term accumulated; an ECB President has 64 that cannot be renewed
or cut short, so political pressure has nothing to act on and what ends the
presidency is losing the Governing Council. The score is banked meeting by
meeting with a floor below zero, so a bad meeting is a bill and being
dismissed early can no longer protect a good average.

Every meeting opens with an **order** — an imperative verb, a number to close
and the cost of inaction — and `order.test.ts` walks every meeting of every
mandate at both institutions and all three difficulties to prove it.

## The verified claims

Run these before believing anything above.

| | command | last reading |
| --- | --- | --- |
| build | `npm run build` | clean |
| tests | `npm test` | 1130 passing |
| lint | `npm run lint` | 0 errors, 13 warnings |
| contrast | `npm run check:contrast` | 0 failures / 664 states, **both directions** |
| classes | `npm run check:classes` | 287 names, all real |
| words | `npm run check:words` | quick 54 steady (cap 60 — QUESTIONS #14), heavy 313 |
| order only | `npm test` (`orderOnly.test.ts`) | **40/40** easy mandates served blind |
| persistence | `npx tsx src/simulation/dev/persistence.ts` | how long the opening damage lasts |
| skill gradient | `npx tsx src/simulation/dev/skillGradient.ts` | does skill outlast idleness on hard |
| late guidance | `npx tsx src/simulation/dev/lateGuidance.ts` | what speaking is worth, early and late |
| opening | `npx tsx src/simulation/dev/opening.ts` | the wreck each difficulty starts on |
| tutorial | `npx tsx src/simulation/dev/tutorialFit.ts` | competent vs passive, swept |
| severity | `npx tsx src/simulation/dev/severity.ts` | a major costs 17-51 banked points |
| offline | `npm run check:offline` | clean, 27 requests, all this origin |
| cadence | `npx tsx src/simulation/dev/cadence.ts` | longest calm run **2** everywhere |
| severity | `npx tsx src/simulation/dev/severity.ts` | a major costs 2.0–7.8× a minor |
| words | `node tools/words.mjs` | quick 40 steady / 69 guided, heavy 248 |

## Open, in QUESTIONS.md

- **#12** the 40-word cap is settled and executable: `npm run check:words`
  fails above it, and `orderOnly.ts` proves the words are optional.
- **#13** the second direction is now **The banknote** — one printed sheet,
  ink on cream, an engraved braid at its head — rather than a hybrid. Kept
  deliberately. Its honest cost is in that entry.
- **#7, #8** the terminal's own decisions: the second direction, and radius
  and shadow going to zero globally.

## The opening ladder

The difficulty is the **number of broken readings**, and it holds on every
seed (`initialState.test.ts`):

| | inflation | unemployment | growth | what it teaches |
| --- | --- | --- | --- | --- |
| easy | high | at sustainable | healthy | the lever works |
| medium | high | high | holding | no move fixes both |
| hard | high | high | falling | everything at once |

The triplet is **derived, not drawn**: the opening sets an output gap, and
unemployment follows through Okun while growth is potential plus whatever the
gap is still doing. Setting three figures independently produces a state the
model does not believe and corrects violently — which is what +5.5 % growth
beside 8.1 % unemployment was.

## What the game is about now

A wreck to repair, and a line that says what to do with it. Every mandate
opens six points above target with unemployment well above sustainable and
growth negative at medium and hard — *something broken*, which is the
structural answer to "on se perd". Three readings sit at the top: two targets
with a distance to close and one guard not to break, with the ECB's board
ranked the way Article 127(1) ranks it and the Fed's not.

Moving the dial says what the move would do **in words**, recomputed live,
never in a figure — the engine is built on the gap between the latent state
and the published one, and a forecast panel would read the hidden state out
loud. The hedging is the difficulty: *should* on easy, *may* on hard.

## The first thing to pick up

**Rank two is specified and not wired.** `seriesAtRank('heavy')` exists in
`simulation/explain/ranks.ts`, every demotion has its reason written beside
it, and the meaning card is on every indicator row — but the heavy meeting's
panels still render the old fixed series lists rather than asking for the
rank. Nothing calls `seriesAtRank`.

## The guardrail that got built instead

`npm run check:classes` — **built this pass**, and it is on the finish line in
CLAUDE.md. It extracts every `className` token from `src/` and fails on any
with no matching rule in the generated stylesheet. It exists because four
classes used 97 times (`text-ink-primary`, `text-ink-secondary`,
`text-ink-muted`, `border-edge-panel`) were not tokens at all: Tailwind emits
nothing for an unknown colour, so each was inert and the text silently
inherited — invisible in the terminal and 1.16:1 in the other direction. It
runs in under a second against a ten-minute audit, and it was verified by
putting the bug back and watching it fail.

The three ranks are specified and only two are built. Rank one (the two
figures with arrows and causes) and the demotions in
`simulation/explain/ranks.ts` are done, and the meaning card is on every
indicator row. **Rank two is not wired to the heavy meeting's panels** — the
four-to-six indicators that are supposed to appear only on the full
apparatus, each with its full explanation, still render through the old
panel list. `seriesAtRank('heavy')` exists and nothing calls it.

## The guardrails that now exist

Worth knowing before adding a fifth occurrence of something.

- `src/lintGuards.test.ts` fails `npm test` on a hook after an early return
  and on `opacity-*` applied to a text element. Both are crashes or contrast
  failures that this project has made four times each.
- `quiet()` in `tools/drive.mjs` waits for real visual stillness — three
  identical frames of every inline style *and* nothing running in
  `getAnimations()`. Every tool inherits it. Without it the contrast audit
  **invents** failures by measuring mid-animation.
- `order.test.ts`, `pressOptional.test.ts` and `tenure.test.ts` hold the three
  design rules that are stated as rules: every meeting commands, the press is
  never compulsory, and a longer good tenure outscores a short one.

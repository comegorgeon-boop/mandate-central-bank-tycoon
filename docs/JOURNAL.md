# Journal

One entry per chantier, three lines: **what I did**, **what I measured**, **what
still bothers me**. Newest at the bottom, so the week reads in order.

---

## The state, in five lines

1. `main` is live and playable; the branch `difficulty/three-modes` carries
   everything since — the slider, the ten doctrines, the Volcker scenario — and
   is **not merged yet**. 916 tests green, build clean, no sweep warnings.
2. The game is a full loop: setup → briefing → N meetings (brief, debate,
   policy desk, confirmation, between-meetings time-lapse, press) → written
   report with a doctrine comparison and, in a scenario, the historical standard.
3. Three fictional difficulties (easy 12 meetings and goal-ended, medium 16,
   hard 32) plus one historical scenario (Volcker 1979-83, 32 meetings, no
   difficulty chooser because difficulty is the year).
4. What is missing for a finished game: four more scenarios, the political
   pressure / public finances axis, a visual pass that stops it reading like an
   accounting document, the front matter (home, tutorial, glossary,
   achievements, saves, local records, legal), and the full 30 events.
5. My own standing complaint about it, before the player's: it is *read* far
   more than it is *played*. Chantier C exists to fix that and is deliberately
   scheduled before the finishings.

## The two hard-mode arbitrages

Both were measured and left open for the player at the end of the last session
(`docs/BALANCE.md`, "The balance check on hard"). The answers given:

**Price stability out of reach at hard — kept.** Median 0.02, costing every
hard mandate about 1750–2300 points for an objective the shocks make
unreachable. Accepted as the mode's character; no weight moved, no shock
shrunk. What I did add is honesty: hard's own difficulty copy and the scorecard
now say that under sustained cost-push the price-stability component is a
component you *lose well or badly*, not one you win — so the player meets it as
a stated rule of the mode rather than as an unexplained 20 % haircut.

**32 → 24 meetings — done, behind a constant.** `HARD_MANDATE_MEETINGS` in
`config/time.ts`, one line to revert, with the full length table from
BALANCE.md beside it. 24 was measured at +16 points of completion, so "shorter
and as hard" needed the shocks enlarged to compensate; what that cost is in the
entry below. Volcker is unaffected: a scenario declares its own
`meetingCount`, and 1979-83 is 32 meetings because that is the four years it
was.

---

## 1 — The two arbitrages, and a four-session-old clamp finally diagnosed

**Did.** Hard's term cut to 24 meetings behind `HARD_MANDATE_MEETINGS`, paid for
with events 15 % more frequent and severe (0.7 → 0.8, 1.35 → 1.55) so it is
shorter *and* as hard. Price stability at hard kept as the mode's character and
said out loud instead — in hard's setup copy and in the scorecard's own prose.
Two committed calibration scripts, `dev/hardLength.ts` and `dev/cohesion.ts`,
so neither number has to be re-derived from a dead scratchpad again. And the
`marketExpectedRate` safety clamp, carried in BALANCE.md as "not diagnosed" for
several sessions, is diagnosed and fixed.

**Measured.** At 24 meetings with the compensation, the toolkit rule completes
63 % of fed/hard and 62 % of ecb/hard against 57 % and 61 % over four years —
same difficulty, eight fewer meetings. `COHESION_TOLERANCE` re-measured 2.0 →
2.3, because bigger events disperse the euro area more and the floor rose with
them. The clamp was the *opposite* of what the bounds file guessed: not an
inflation spiral hitting the ceiling but **deflation hitting the floor** — the
Taylor benchmark has no floor and asks for about −11 % at −7 % inflation, and
three separate blocks walked the priced path through the rail chasing it.
`MARKET_EXPECTATIONS.belowFloorAllowance` gives it a modelled floor instead.
`npm run sim:sweep`: no balance warnings. 917 tests.

**Bothers me.** Two tests had to be loosened to land this and I want that on the
record rather than buried: the loop-count invariant became a band (3 to 5 loops)
instead of a max/min ratio, and the event-balance cap is now per unit of
severity rather than absolute. Both are better tests for being more specific,
but both were *failing honestly* — hard really does give fewer closed loops now,
and its catalogue really does deliver more impulse per meeting. See
docs/QUESTIONS.md 1 and 2.

---

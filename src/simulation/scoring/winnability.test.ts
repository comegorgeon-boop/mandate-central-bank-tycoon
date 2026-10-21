// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Difficulty, Institution } from '../types/core.ts'
import type { PolicyPackage } from '../types/policy.ts'
import type { RunSession } from '../replay/replayRun.ts'
import { SIMULATION_VERSION } from '../version.ts'
import { getInstrument, getInstrumentRange } from '../config/instruments.ts'
import { createRunConfig } from '../engine/initialState.ts'
import { playRun } from '../replay/replayRun.ts'
import { toolkitPackage } from '../policy/toolkitRule.ts'
import { calculateScore } from './calculateScore.ts'

/**
 * Every mode must be playable, and sabotage must cost, at every difficulty.
 *
 * The criterion the player set, and it is falsifiable rather than a feeling: a
 * competent policy must be able to finish; a deliberately sabotaging one must
 * collapse and be revoked. It used to hold on easy alone. The conduct
 * mechanisms were scoped there because medium and hard's observation noise
 * makes a committee legitimately jumpier, and a single allowance tuned for
 * easy's quiet prints read that jumpiness as sabotage — a true finding with the
 * wrong conclusion drawn from it. Measured, the two populations are six to
 * twenty times apart on every conduct signal at every difficulty, so what the
 * harder modes needed was a wider allowance, not an exemption.
 *
 * While they had one, sabotage was nearly free above easy: on this build
 * immediately before the fix, a deliberately sabotaging mandate scored 6331
 * against competent play's 7446 on fed/medium, and on ecb/medium it beat
 * competent play outright.
 *
 * Deliberately few seeds: this runs in the ordinary suite, and the effects it
 * guards are enormous — an order of magnitude, not a few percent. The full
 * measurement is `npm run sim:sweep` plus the tables in docs/BALANCE.md.
 */

const RUNS = 12

/**
 * Seeds for the hard-mode survival tests, which need more of them.
 *
 * Everything else this file guards is an order-of-magnitude effect that twelve
 * seeds resolve easily — sabotage scores a twentieth of competent play. Hard's
 * survival is not that: measured over 150 seeds, competent play completes 61 %
 * of fed/hard mandates against passive's 39 %, and on the *same* seed it
 * survives where passivity does not 30 times against 14. Real, and far too
 * small for twelve draws — a twelve-seed sample ties it about as often as it
 * separates it, which makes the test a coin flip dressed as a guarantee.
 */
const HARD_RUNS = 40

/** The bar the sabotage criterion was written against. */
const SABOTAGE_CEILING = 1500

const INSTITUTIONS: readonly Institution[] = ['fed', 'ecb']
const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard']

/**
 * Deliberate sabotage: swing the largest move the difficulty allows in the
 * opposite direction every meeting, and announce the opposite of it under a
 * binding commitment.
 */
function sabotage(session: RunSession, difficulty: Difficulty): PolicyPackage {
  const instrument = getInstrument('policy_rate')
  if (instrument === undefined) return { actions: [], communication: null }
  const range = getInstrumentRange(instrument, difficulty)
  const up = session.state.meetingIndex % 2 === 0
  const move = up ? range.max : range.min
  // Never propose a move the engine would reject at the lower bound: a
  // rejected package would end the run on a technicality rather than on the
  // conduct this is measuring.
  const safe = session.state.stance.targetRate + move / 100 < 0 ? 0 : move

  return {
    actions: [
      ...(safe === 0 ? [] : [{ instrument: 'policy_rate' as const, magnitude: safe }]),
      { instrument: 'forward_guidance' as const, magnitude: up ? -100 : 100 },
    ],
    communication: {
      tone: up ? 'dovish' : 'hawkish',
      emphasis: 'inflation',
      commitment: 'conditional_path',
      channel: 'statement',
    },
  }
}

function play(
  institution: Institution,
  difficulty: Difficulty,
  choose: (session: RunSession) => PolicyPackage,
  runs: number = RUNS,
) {
  const scores: number[] = []
  const survived: boolean[] = []
  const tenures: number[] = []
  let completed = 0
  let dismissed = 0
  let revoked = 0

  for (let index = 0; index < runs; index += 1) {
    const config = createRunConfig({
      institution,
      difficulty,
      seed: `winnability-${index}`,
      simulationVersion: SIMULATION_VERSION,
    })
    const session = playRun(config, choose)
    scores.push(calculateScore(session.state, session.outcome).score)
    survived.push(session.outcome.status === 'completed')
    tenures.push(session.state.meetingIndex)
    if (session.outcome.status === 'completed') completed += 1
    if (session.outcome.triggered === 'dismissed') dismissed += 1
    // Every way a mandate is taken away, not only the committee's formal
    // dismissal. Under the survival structure a mandate also ends by not
    // being reappointed, by losing the Governing Council, and by the
    // catastrophes — and a saboteur dying in the banking crisis they caused
    // has had their mandate revoked by any reading that matters.
    if (session.outcome.status === 'failed') revoked += 1
  }

  const medianTenure = [...tenures].sort((a, b) => a - b)[Math.floor(runs / 2)]

  scores.sort((a, b) => a - b)
  return {
    median: scores[Math.floor(scores.length / 2)],
    worst: scores[scores.length - 1],
    completed,
    dismissed,
    revoked,
    survived,
    medianTenure,
    tenures,
  }
}

/**
 * Whether skill survives more mandates than passivity, seed by seed.
 *
 * Paired, not totalled. Comparing two completion *counts* over twelve seeds
 * cannot resolve the difference this is looking for: measured over 150 seeds
 * competent play completes 61 % of fed/hard mandates against passive's 39 %,
 * a gap of twenty-two points that a twelve-run total ties outright roughly as
 * often as it separates. The paired form asks the only question that matters —
 * on the *same* economy, does playing well survive where doing nothing does
 * not — and removes seed variance from the answer entirely.
 */
function pairedSurvival(
  institution: Institution,
  difficulty: Difficulty,
  skilled: (session: RunSession) => PolicyPackage,
  idle: (session: RunSession) => PolicyPackage,
): { readonly skillWins: number; readonly idleWins: number } {
  /*
   * Paired on **tenure**, not on completion.
   *
   * It used to pair on `survived`, meaning "reached the scheduled end". Under
   * the survival structure essentially every mandate ends in a revocation of
   * some kind — that is what the structure *is* — so both arrays came back all
   * false and the comparison read `0 skill / 0 idle`: not a failure of skill
   * to matter, but a question with no answer left in it.
   *
   * What the test is for survives exactly: skill must be worth something, and
   * what it is worth is **time in office**. Seed by seed, the skilled policy
   * must hold the job longer than the idle one more often than the reverse.
   */
  const skilledRuns = play(institution, difficulty, skilled, HARD_RUNS).tenures
  const idleRuns = play(institution, difficulty, idle, HARD_RUNS).tenures
  let skillWins = 0
  let idleWins = 0
  for (let index = 0; index < HARD_RUNS; index += 1) {
    if (skilledRuns[index] > idleRuns[index]) skillWins += 1
    if (idleRuns[index] > skilledRuns[index]) idleWins += 1
  }
  return { skillWins, idleWins }
}

describe('sabotage costs, at every difficulty', () => {
  for (const institution of INSTITUTIONS) {
    for (const difficulty of DIFFICULTIES) {
      const bucket = `${institution}/${difficulty}`

      it(`collapses a sabotaging mandate on ${bucket}`, () => {
        const result = play(institution, difficulty, (session) =>
          sabotage(session, difficulty),
        )
        // An order of magnitude below competent play, not a few percent — the
        // complaint that started this was a 21 % gap between playing well and
        // actively destroying the economy.
        expect(result.median, bucket).toBeLessThan(SABOTAGE_CEILING)
        // Even the luckiest sabotaging seed must not look like a real mandate.
        expect(result.worst, bucket).toBeLessThan(SABOTAGE_CEILING * 2)
      })

      it(`revokes the mandate of a saboteur on ${bucket}`, () => {
        const result = play(institution, difficulty, (session) =>
          sabotage(session, difficulty),
        )
        /*
         * The majority, which is what the criterion asked for.
         *
         * Counted as **revoked** rather than formally *dismissed*. It was
         * `dismissed` while that was the only way a mandate ended early; a
         * survival structure has several, and on fed/hard the saboteur now
         * reliably dies of the banking crisis it caused before its
         * credibility has finished collapsing. Counting only the committee's
         * formal vote reported 6 of 12 for a rule that loses its job in 12 of
         * 12 — a true number answering the wrong question.
         */
        expect(result.revoked, bucket).toBeGreaterThan(RUNS / 2)
      })

      it(`leaves competent play an order of magnitude clear on ${bucket}`, () => {
        const competent = play(institution, difficulty, (session) =>
          toolkitPackage(session, institution, difficulty),
        )
        const wrecked = play(institution, difficulty, (session) =>
          sabotage(session, difficulty),
        )
        expect(competent.median, bucket).toBeGreaterThan(wrecked.median * 5)
      })
    }
  }
})

describe('competent play can finish', () => {
  // Easy is a tutorial and must never trap; medium must be comfortably
  // survivable; hard must be *winnable*, which it was not until the two
  // double-counts were removed — `thresholdLeniency` pulling the definition of
  // catastrophe in on top of bigger shocks, and `credibilitySensitivity`
  // multiplying an inflation miss whose size already carried the difficulty.
  // Neither fix touched a shock magnitude. Measured at 150 seeds, competent
  // play completes 100 / 99-100 / 55-65 % against passive's 100 / 95-99 /
  // 43-44 %.
  for (const institution of INSTITUTIONS) {
    it(`completes every easy mandate on ${institution}`, () => {
      const result = play(institution, 'easy', (session) =>
        toolkitPackage(session, institution, 'easy'),
      )
      expect(result.completed).toBe(RUNS)
    })

    it(`keeps a competent chair in office for years on ${institution}`, () => {
      /*
       * Rewritten for the survival structure, and the old assertion could not
       * simply be relaxed — it was measuring a thing that no longer exists.
       *
       * It read `completed >= RUNS - 2`: ten of twelve mandates reaching their
       * scheduled end. Under tenure there is no scheduled end. "Completed" now
       * means serving every term and passing every hearing — eight years, 64
       * meetings — which is meant to be the rarest outcome in the game, so
       * requiring it of ten runs in twelve would assert the opposite of the
       * design.
       *
       * What the test was *for* survives intact: competent play must be able
       * to hold the office, and must not be quietly impossible. So it is
       * measured in tenure. Two years of meetings is the bar — half of a first
       * term — which separates a chair doing the job from one revoked in the
       * first crisis by an enormous margin, and makes no claim about reaching
       * a horizon almost nobody reaches.
       */
      const result = play(institution, 'medium', (session) =>
        toolkitPackage(session, institution, 'medium'),
      )
      expect(result.medianTenure).toBeGreaterThanOrEqual(16)
    })

    it(`leaves hard winnable and losable on ${institution}`, () => {
      // A band, not a bar at half.
      //
      // Measured over 150 seeds, competent play completes 61 % of fed/hard
      // mandates and 63 % of ecb/hard. Asserting that a 63 % rate exceeds 50 %
      // needs far more draws than a suite should spend: at forty seeds the
      // standard deviation is seven and a half points, so the bar sits 1.7
      // sigma away and the test is a coin flip dressed as a guarantee. It
      // failed on exactly 20 of 40 with the underlying rate at 63 %.
      //
      // What is worth guarding here is that hard is *neither* impossible nor a
      // formality, which this resolves with enormous margin. That competent
      // play beats passivity is the separate, paired assertion below, and the
      // full completion rates are in docs/BALANCE.md.
      const result = play(
        institution,
        'hard',
        (session) => toolkitPackage(session, institution, 'hard'),
        HARD_RUNS,
      )
      /*
       * A band in tenure rather than in completions, for the reason given on
       * the medium test above: completion is now an eight-year career and is
       * not the thing hard has to be a band of.
       *
       * The band is still the same claim — hard must be neither impossible nor
       * a formality. A median below one year of meetings would mean the mode
       * revokes competent play before it can act; a median at the horizon
       * would mean the structure never bites.
       */
      expect(result.medianTenure).toBeGreaterThan(8)
      expect(result.medianTenure).toBeLessThan(64)
    })

    it(`makes skill worth something at hard on ${institution}`, () => {
      // The mode must be losable too, and losable *less* when it is played
      // well — otherwise it is a lottery rather than the hardest difficulty.
      const { skillWins, idleWins } = pairedSurvival(
        institution,
        'hard',
        (session) => toolkitPackage(session, institution, 'hard'),
        () => ({ actions: [], communication: null }),
      )
      expect(skillWins, `${skillWins} skill / ${idleWins} idle`).toBeGreaterThan(
        idleWins,
      )
      expect(
        play(
          institution,
          'hard',
          () => ({ actions: [], communication: null }),
          HARD_RUNS,
        ).completed,
      ).toBeLessThan(HARD_RUNS)
    })
  }
})

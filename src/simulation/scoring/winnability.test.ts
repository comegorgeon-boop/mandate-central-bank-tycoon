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
) {
  const scores: number[] = []
  let completed = 0
  let dismissed = 0

  for (let index = 0; index < RUNS; index += 1) {
    const config = createRunConfig({
      institution,
      difficulty,
      seed: `winnability-${index}`,
      simulationVersion: SIMULATION_VERSION,
    })
    const session = playRun(config, choose)
    scores.push(calculateScore(session.state, session.outcome).score)
    if (session.outcome.status === 'completed') completed += 1
    if (session.outcome.triggered === 'dismissed') dismissed += 1
  }

  scores.sort((a, b) => a - b)
  return {
    median: scores[Math.floor(scores.length / 2)],
    worst: scores[scores.length - 1],
    completed,
    dismissed,
  }
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
        // The majority, which is what the criterion asked for. Measured at 150
        // seeds this sits at 89-100 % across the six buckets.
        expect(result.dismissed, bucket).toBeGreaterThan(RUNS / 2)
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
  // survivable for a policy that reads its data. Hard is deliberately not
  // asserted here — it does not meet this bar, and docs/BALANCE.md records the
  // measurement and the diagnosis rather than a threshold quietly lowered to
  // make a test pass.
  for (const institution of INSTITUTIONS) {
    it(`completes every easy mandate on ${institution}`, () => {
      const result = play(institution, 'easy', (session) =>
        toolkitPackage(session, institution, 'easy'),
      )
      expect(result.completed).toBe(RUNS)
    })

    it(`completes most medium mandates on ${institution}`, () => {
      const result = play(institution, 'medium', (session) =>
        toolkitPackage(session, institution, 'medium'),
      )
      expect(result.completed).toBeGreaterThanOrEqual(RUNS - 2)
    })
  }
})

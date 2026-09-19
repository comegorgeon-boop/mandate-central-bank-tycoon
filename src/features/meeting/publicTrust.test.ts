// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  INSTITUTIONAL,
  SIMULATION_VERSION,
  createRunConfig,
  getInstitution,
  startRun,
  submitMeeting,
} from '../../simulation/index.ts'
import { toolkitPackage } from '../../simulation/policy/toolkitRule.ts'
import { readPublicTrust, trustSentence } from './publicTrust.ts'

/**
 * Public trust has no conduct term, and the interface has to say so.
 *
 * A played mandate reported trust falling while every commitment was kept, and
 * read it as being punished for good conduct. Decomposed on that seed —
 * ECB/medium, `8RAW-LUHT` — the reading was blunter than that: the whole fall
 * from 81 to 67 across five meetings was the inflation gap, the unemployment
 * term was *improving* throughout, and the rate term never fired once.
 *
 *   meeting   trust   inflation term   unemployment term   rate term
 *         1    81.4            −0.6              −14.2         0.0
 *         3    75.7           −17.5              −11.7         0.0
 *         5    67.4           −28.7               −9.8         0.0
 *         9    67.4            −1.5               −5.6         0.0
 *        16    79.0             0.0                0.0         0.0
 *
 * The design is defensible: the public judges the prices and the jobs it lives
 * with, and the measure that answers conduct is credibility, sitting beside it
 * doing exactly that. What was not defensible is that nothing said so.
 */

describe('the decomposition is the engine`s, not a copy of it', () => {
  const config = INSTITUTIONAL.publicTrust

  function readingAt(inflation: number, unemployment: number, rate: number) {
    const target = getInstitution('ecb').inflationTarget
    const natural = getInstitution('ecb').initial.naturalUnemployment
    return {
      reading: readPublicTrust(
        {
          meetingIndex: 0,
          indicators: {
            headline_inflation: { value: inflation } as never,
            unemployment: { value: unemployment } as never,
            policy_rate: { value: rate } as never,
          },
          forecasts: [],
          newswire: [],
          clues: [],
          taylorBenchmark: 0,
          diagnosis: null,
          area: null,
        },
        'ecb',
      ),
      target,
      natural,
    }
  }

  it('reproduces the target the dynamics aim at', () => {
    const { reading, target, natural } = readingAt(4.6, 7.9, 2.25)
    const expected =
      config.ceiling -
      config.inflation * Math.max(0, 4.6 - target) -
      config.unemployment * Math.max(0, 7.9 - natural) -
      config.policyRate * Math.max(0, 2.25 - config.policyRateTolerance)
    expect(reading!.target).toBeCloseTo(expected, 9)
  })

  it('charges nothing for a rate the public stops noticing below', () => {
    const { reading } = readingAt(2.0, 6.6, config.policyRateTolerance - 0.5)
    expect(reading!.terms.some((term) => term.label.includes('borrowing'))).toBe(
      false,
    )
  })

  it('charges the rate once it is high enough to be felt', () => {
    const { reading } = readingAt(2.0, 6.6, config.policyRateTolerance + 2)
    const rateTerm = reading!.terms.find((term) => term.label.includes('borrowing'))
    expect(rateTerm?.cost).toBeCloseTo(config.policyRate * 2, 9)
  })

  it('names the term doing the damage', () => {
    // The player's own case: prices far above target, employment recovering.
    const { reading } = readingAt(5.19, 7.83, 2.5)
    expect(reading!.dominant?.label).toBe('Prices above the objective')
    expect(reading!.oneStory).toBe(true)
  })

  it('says out loud that conduct does not enter it', () => {
    // The sentence the player needed and did not have. Without it a falling
    // trust line reads as a verdict on them, and it never was one.
    const { reading } = readingAt(5.19, 7.83, 2.5)
    expect(trustSentence(reading!)).toMatch(/credibility/)
    expect(trustSentence(reading!)).toMatch(/does not enter/)
  })
})

describe('on the seed that prompted this', () => {
  it('attributes the fall to the shock and not to conduct', () => {
    // Played straight through with a competent rule, no broken promises: if
    // the fall were about conduct there would be no fall.
    const target = getInstitution('ecb').inflationTarget
    let session = startRun(
      createRunConfig({
        institution: 'ecb',
        difficulty: 'medium',
        seed: '8RAW-LUHT',
        simulationVersion: SIMULATION_VERSION,
      }),
    )

    // Trust is a slow variable chasing a target, so its own trough lags the
    // pressure that caused it by two meetings. What is measured here is the
    // *pressure*: the largest each term ever got over the mandate.
    let worstInflationTerm = 0
    let worstRateTerm = 0

    while (session.outcome.status === 'active') {
      const latent = session.state.latent
      worstInflationTerm = Math.max(
        worstInflationTerm,
        INSTITUTIONAL.publicTrust.inflation *
          Math.max(0, latent.inflationHeadline - target),
      )
      worstRateTerm = Math.max(
        worstRateTerm,
        INSTITUTIONAL.publicTrust.policyRate *
          Math.max(0, latent.policyRate - INSTITUTIONAL.publicTrust.policyRateTolerance),
      )
      const result = submitMeeting(session, toolkitPackage(session, 'ecb', 'medium'))
      if (!result.ok) break
      session = result.session
    }

    // There is no conduct term to find: zero broken promises, and the whole
    // shortfall is priced off the inflation gap — nearly thirty points of it
    // at the peak, against a ceiling of 85.
    expect(session.state.guidance.brokenPromises).toBe(0)
    expect(worstInflationTerm).toBeGreaterThan(20)
    // And the rate never rose far enough to be resented in its own right, so
    // the player was not even being charged for the cure.
    expect(worstRateTerm).toBe(0)
  })
})

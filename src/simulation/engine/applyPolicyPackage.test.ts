// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Difficulty, Institution } from '../types/core.ts'
import type {
  InstrumentId,
  PolicyPackage,
  PolicyRejectionCode,
} from '../types/policy.ts'
import type { SimulationState } from '../types/state.ts'
import { POLICY_RATE_FLOOR, availableInstruments } from '../config/instruments.ts'
import { createInitialState } from '../engine/initialState.ts'
import { testConfig } from '../testing/harness.ts'
import { applyPolicyPackage, validatePolicyPackage } from './applyPolicyPackage.ts'

/**
 * Policy validation.
 *
 * Validation is total: an invalid package is not partially applied, it is not
 * applied at all. Contradictions are the opposite — a deliberately
 * inconsistent package is legitimate, so it is reported and priced rather
 * than blocked.
 */

function stateFor(
  institution: Institution,
  difficulty: Difficulty,
): SimulationState {
  return createInitialState(testConfig(institution, difficulty, 'policy-validation'))
}

function only(actions: PolicyPackage['actions']): PolicyPackage {
  return { actions, communication: null }
}

function codesFor(state: SimulationState, pkg: PolicyPackage): PolicyRejectionCode[] {
  return validatePolicyPackage(state, pkg).rejections.map((r) => r.code)
}

describe('an action is rejected when it does not exist', () => {
  it('rejects an unknown instrument', () => {
    const state = stateFor('fed', 'hard')
    const pkg = only([
      { instrument: 'quantitative_wishing' as InstrumentId, magnitude: 1 },
    ])
    expect(codesFor(state, pkg)).toEqual(['unknown_instrument'])
  })

  it('rejects the same instrument set twice', () => {
    const state = stateFor('fed', 'hard')
    const pkg = only([
      { instrument: 'policy_rate', magnitude: 25 },
      { instrument: 'policy_rate', magnitude: -25 },
    ])
    expect(codesFor(state, pkg)).toEqual(['duplicate_instrument'])
  })
})

describe('an action is rejected when it is unavailable', () => {
  it('rejects a Fed instrument in an ECB run', () => {
    const state = stateFor('ecb', 'hard')
    expect(codesFor(state, only([{ instrument: 'iorb_spread', magnitude: 5 }]))).toEqual([
      'unavailable_for_institution',
    ])
  })

  it('rejects an ECB instrument in a Fed run', () => {
    const state = stateFor('fed', 'hard')
    expect(
      codesFor(state, only([{ instrument: 'transmission_protection', magnitude: 1 }])),
    ).toEqual(['unavailable_for_institution'])
  })

  it('rejects an instrument that has not unlocked at this difficulty', () => {
    const easy = stateFor('fed', 'easy')
    expect(
      codesFor(easy, only([{ instrument: 'asset_purchases', magnitude: 2 }])),
    ).toEqual(['unavailable_at_difficulty'])
    expect(
      codesFor(easy, only([{ instrument: 'balance_sheet_runoff', magnitude: 1 }])),
    ).toEqual(['unavailable_at_difficulty'])
  })

  it('opens forward guidance from easy, at its narrower easy range', () => {
    // The second instrument of the easy mode: available from the start, but
    // capped at ±100bp like the policy rate itself. See docs/DIRECTION.md.
    const easy = stateFor('fed', 'easy')
    expect(
      validatePolicyPackage(easy, only([{ instrument: 'forward_guidance', magnitude: 50 }]))
        .ok,
    ).toBe(true)
    expect(
      codesFor(easy, only([{ instrument: 'forward_guidance', magnitude: 125 }])),
    ).toEqual(['above_maximum'])
  })

  it('accepts the same instrument once its difficulty is reached', () => {
    const medium = stateFor('fed', 'medium')
    expect(
      validatePolicyPackage(medium, only([{ instrument: 'asset_purchases', magnitude: 2 }]))
        .ok,
    ).toBe(true)
  })

  it('locks the hard-only toolkit at medium', () => {
    const medium = stateFor('fed', 'medium')
    expect(codesFor(medium, only([{ instrument: 'reverse_repo', magnitude: 1 }]))).toEqual([
      'unavailable_at_difficulty',
    ])
  })
})

describe('an action is rejected when it is out of bounds', () => {
  const state = stateFor('fed', 'hard')

  it('rejects a magnitude below the minimum', () => {
    expect(codesFor(state, only([{ instrument: 'policy_rate', magnitude: -500 }]))).toEqual(
      ['below_minimum'],
    )
  })

  it('rejects a magnitude above the maximum', () => {
    expect(codesFor(state, only([{ instrument: 'asset_purchases', magnitude: 40 }]))).toEqual(
      ['above_maximum'],
    )
  })

  it('rejects a magnitude off the allowed increment', () => {
    expect(codesFor(state, only([{ instrument: 'policy_rate', magnitude: 30 }]))).toEqual([
      'invalid_increment',
    ])
    expect(
      codesFor(state, only([{ instrument: 'asset_purchases', magnitude: 1.3 }])),
    ).toEqual(['invalid_increment'])
  })

  it('rejects a magnitude that is not a finite number', () => {
    for (const magnitude of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(codesFor(state, only([{ instrument: 'policy_rate', magnitude }]))).toEqual([
        'non_finite_magnitude',
      ])
    }
  })

  it('narrows the rate range on easy and widens it on hard', () => {
    const easy = stateFor('fed', 'easy')
    expect(codesFor(easy, only([{ instrument: 'policy_rate', magnitude: 150 }]))).toEqual([
      'above_maximum',
    ])
    expect(
      validatePolicyPackage(state, only([{ instrument: 'policy_rate', magnitude: 150 }])).ok,
    ).toBe(true)
  })
})

describe('the effective lower bound is enforced', () => {
  it('rejects a cut that would push the rate through the floor', () => {
    const base = stateFor('fed', 'hard')
    // Start just above the floor, so a perfectly ordinary 100bp cut is the
    // thing that breaks it rather than an out-of-range magnitude.
    const nearFloor: SimulationState = {
      ...base,
      stance: { ...base.stance, targetRate: 0.5 },
    }

    const codes = codesFor(nearFloor, only([{ instrument: 'policy_rate', magnitude: -100 }]))
    expect(codes).toEqual(['effective_rate_below_floor'])
  })

  it('accepts a cut that lands exactly on the floor', () => {
    const base = stateFor('fed', 'hard')
    const nearFloor: SimulationState = {
      ...base,
      stance: { ...base.stance, targetRate: 0.5 },
    }
    expect(
      validatePolicyPackage(nearFloor, only([{ instrument: 'policy_rate', magnitude: -50 }]))
        .ok,
    ).toBe(true)
  })

  it('lets the ECB go modestly negative where the Fed cannot', () => {
    expect(POLICY_RATE_FLOOR.ecb).toBeLessThan(0)
    expect(POLICY_RATE_FLOOR.fed).toBe(0)
  })
})

describe('communication availability follows difficulty', () => {
  it('rejects a channel that has not unlocked', () => {
    const easy = stateFor('fed', 'easy')
    const pkg: PolicyPackage = {
      actions: [],
      communication: {
        tone: 'neutral',
        emphasis: 'inflation',
        commitment: 'none',
        channel: 'press_conference',
      },
    }
    expect(codesFor(easy, pkg)).toEqual(['channel_unavailable_at_difficulty'])
  })

  it('rejects a commitment strength that has not unlocked', () => {
    const easy = stateFor('fed', 'easy')
    const pkg: PolicyPackage = {
      actions: [],
      communication: {
        tone: 'hawkish',
        emphasis: 'inflation',
        commitment: 'strong_commitment',
        channel: 'statement',
      },
    }
    expect(codesFor(easy, pkg)).toEqual(['communication_unavailable_at_difficulty'])
  })

  it('opens the full system on hard', () => {
    const hard = stateFor('fed', 'hard')
    const pkg: PolicyPackage = {
      actions: [],
      communication: {
        tone: 'alarmed',
        emphasis: 'financial_stability',
        commitment: 'strong_commitment',
        channel: 'social_post',
      },
    }
    expect(validatePolicyPackage(hard, pkg).ok).toBe(true)
  })
})

describe('a rejected package changes nothing', () => {
  it('leaves the state untouched', () => {
    const state = stateFor('fed', 'easy')
    const result = applyPolicyPackage(
      state,
      only([{ instrument: 'asset_purchases', magnitude: 3 }]),
    )

    expect(result.ok).toBe(false)
    expect(result.validation.rejections.length).toBeGreaterThan(0)
    if (result.ok) return
    // There is no `state` on a failed application at all: nothing to apply.
    expect('state' in result).toBe(false)
  })

  it('reports every problem in one pass, not just the first', () => {
    const state = stateFor('ecb', 'easy')
    const codes = codesFor(
      state,
      only([
        { instrument: 'iorb_spread', magnitude: 5 },
        { instrument: 'asset_purchases', magnitude: 2 },
        { instrument: 'policy_rate', magnitude: 33 },
      ]),
    )
    expect(codes).toHaveLength(3)
    expect(new Set(codes)).toEqual(
      new Set([
        'unavailable_for_institution',
        'unavailable_at_difficulty',
        'invalid_increment',
      ]),
    )
  })

  it('carries a readable message on every rejection', () => {
    const state = stateFor('fed', 'easy')
    const validation = validatePolicyPackage(
      state,
      only([{ instrument: 'asset_purchases', magnitude: 2 }]),
    )
    for (const rejection of validation.rejections) {
      expect(rejection.message.length).toBeGreaterThan(10)
    }
  })
})

describe('a valid package is applied', () => {
  it('moves the policy rate by the requested amount', () => {
    const state = stateFor('fed', 'hard')
    const result = applyPolicyPackage(state, only([{ instrument: 'policy_rate', magnitude: 50 }]))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.stance.targetRate).toBeCloseTo(state.stance.targetRate + 0.5, 10)
    expect(result.state.latent.policyRate).toBeCloseTo(state.latent.policyRate + 0.5, 10)
  })

  it('keeps standing settings in force until they are changed', () => {
    const state = stateFor('ecb', 'hard')
    const first = applyPolicyPackage(
      state,
      only([{ instrument: 'targeted_refinancing', magnitude: 3 }]),
    )
    expect(first.ok).toBe(true)
    if (!first.ok) return

    // A later meeting that says nothing about the facility leaves it running.
    const second = applyPolicyPackage(first.state, only([]))
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(second.state.stance.targetedRefinancing).toBe(3)
  })

  it('accepts every instrument at both ends of its range', () => {
    for (const institution of ['fed', 'ecb'] as const) {
      const state = stateFor(institution, 'hard')
      for (const instrument of availableInstruments(institution, 'hard')) {
        if (instrument.id === 'policy_rate') continue
        for (const magnitude of [instrument.min, instrument.max]) {
          const validation = validatePolicyPackage(
            state,
            only([{ instrument: instrument.id, magnitude }]),
          )
          expect(validation.rejections).toEqual([])
        }
      }
    }
  })
})

describe('contradictions are reported and priced, never blocked', () => {
  it('flags buying and running off the balance sheet at once', () => {
    const state = stateFor('fed', 'medium')
    const validation = validatePolicyPackage(
      state,
      only([
        { instrument: 'asset_purchases', magnitude: 2 },
        { instrument: 'balance_sheet_runoff', magnitude: 2 },
      ]),
    )
    expect(validation.ok).toBe(true)
    expect(validation.contradictions.map((c) => c.code)).toContain(
      'purchases_and_runoff_together',
    )
  })

  it('flags words that contradict the decision', () => {
    const state = stateFor('fed', 'hard')
    const pkg: PolicyPackage = {
      actions: [{ instrument: 'policy_rate', magnitude: -50 }],
      communication: {
        tone: 'hawkish',
        emphasis: 'inflation',
        commitment: 'conditional_path',
        channel: 'press_conference',
      },
    }
    const validation = validatePolicyPackage(state, pkg)
    expect(validation.ok).toBe(true)
    expect(validation.contradictions.map((c) => c.code)).toContain(
      'hawkish_guidance_with_rate_cut',
    )
  })

  it('still applies the package, at a credibility cost', () => {
    const state = stateFor('fed', 'hard')
    const consistent = applyPolicyPackage(state, {
      actions: [{ instrument: 'policy_rate', magnitude: -50 }],
      communication: {
        tone: 'dovish',
        emphasis: 'employment',
        commitment: 'conditional_path',
        channel: 'press_conference',
      },
    })
    const contradictory = applyPolicyPackage(state, {
      actions: [{ instrument: 'policy_rate', magnitude: -50 }],
      communication: {
        tone: 'hawkish',
        emphasis: 'inflation',
        commitment: 'conditional_path',
        channel: 'press_conference',
      },
    })

    expect(consistent.ok).toBe(true)
    expect(contradictory.ok).toBe(true)
    if (!consistent.ok || !contradictory.ok) return

    expect(contradictory.state.latent.policyRate).toBeCloseTo(
      consistent.state.latent.policyRate,
      10,
    )
    expect(contradictory.state.latent.credibility).toBeLessThan(
      consistent.state.latent.credibility,
    )
    expect(contradictory.state.latent.marketTrust).toBeLessThan(
      consistent.state.latent.marketTrust,
    )
  })

  it('flags escalating emergency facilities into a calm system', () => {
    const base = stateFor('fed', 'hard')
    const calm: SimulationState = {
      ...base,
      latent: { ...base.latent, bankingStress: 8 },
    }
    const validation = validatePolicyPackage(
      calm,
      only([
        { instrument: 'discount_window', magnitude: 2 },
        { instrument: 'swap_lines', magnitude: 2 },
      ]),
    )
    expect(validation.contradictions.map((c) => c.code)).toContain(
      'liquidity_support_without_stress',
    )
  })

  it('does not flag the same escalation during real stress', () => {
    const base = stateFor('fed', 'hard')
    const stressed: SimulationState = {
      ...base,
      latent: { ...base.latent, bankingStress: 70 },
    }
    const validation = validatePolicyPackage(
      stressed,
      only([
        { instrument: 'discount_window', magnitude: 2 },
        { instrument: 'swap_lines', magnitude: 2 },
      ]),
    )
    expect(validation.contradictions.map((c) => c.code)).not.toContain(
      'liquidity_support_without_stress',
    )
  })
})

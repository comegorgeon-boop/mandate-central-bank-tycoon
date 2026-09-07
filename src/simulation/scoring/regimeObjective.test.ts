// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { LatentSnapshot, SimulationState } from '../types/state.ts'
import type { EndConditionResult } from '../types/scoring.ts'
import { SIMULATION_VERSION } from '../version.ts'
import { SUPPLY_REGIME_BAND } from '../config/model.ts'
import { SCORE_WEIGHTS } from '../config/scoring.ts'
import { createInitialState, createRunConfig } from '../engine/initialState.ts'
import { calculateScore } from './calculateScore.ts'

/**
 * The objective moves with the regime, and the score follows it.
 *
 * The complaint this answers, in the player's own words: easy served "massive
 * energy inflation, then a simultaneous supply shock, unemployment gone, no
 * playable move." Measured, that was exact — and the score then marked the
 * mandate down for missing a target no policy could have reached. Decomposing
 * a cost-push mandate on ecb/medium showed competent play holding employment
 * at 91 % (93 % in calm weather), financial stability at 99 % (99 %) and the
 * anchor at 95 % (99 %), while price stability was marked from 56 % to zero:
 * succeeding on every measure of the regime's own objective and being scored
 * as a failure anyway.
 *
 * What must stay true is both halves. The shift must reach a mandate the shock
 * genuinely dominated, and it must be worth *nothing at all* to one it did
 * not — a correction that pays in calm weather is not a correction, it is
 * inflation of the whole scale.
 */

const COMPLETED: EndConditionResult = {
  status: 'completed',
  triggered: null,
  label: null,
  summary: 'The full mandate was served.',
  causalChain: [],
  warnings: [],
  breachCounters: {},
}

/** A finished mandate whose every meeting carried `supplyShock`. */
function mandateUnderPressure(supplyShock: number): SimulationState {
  const config = createRunConfig({
    institution: 'ecb',
    difficulty: 'medium',
    seed: 'regime-objective',
    simulationVersion: SIMULATION_VERSION,
  })
  const base = createInitialState(config, { openingEvent: false })

  const history: LatentSnapshot[] = []
  for (let meeting = 0; meeting < config.meetingCount; meeting += 1) {
    history.push({
      meetingIndex: meeting,
      timeYears: meeting / 8,
      latent: {
        ...base.latent,
        supplyShock,
        // The same inflation miss in both worlds. Only the reason differs.
        inflationHeadline: 5.2,
        inflationCore: 4.4,
      },
      members: [],
    })
  }

  return {
    ...base,
    meetingIndex: config.meetingCount,
    timeYears: config.meetingCount / 8,
    history,
  }
}

describe('the objective under a cost-push regime', () => {
  it('is worth nothing at all in calm weather', () => {
    const calm = calculateScore(mandateUnderPressure(0), COMPLETED)
    expect(calm.supplyRegimeShare).toBe(0)

    const weights = SCORE_WEIGHTS.ecb
    for (const component of calm.components) {
      expect(component.weight, component.id).toBeCloseTo(weights[component.id], 10)
    }
  })

  it('moves weight out of price stability once the shock dominates', () => {
    const shocked = calculateScore(mandateUnderPressure(SUPPLY_REGIME_BAND.full), COMPLETED)
    expect(shocked.supplyRegimeShare).toBe(1)

    const weightOf = (id: string): number =>
      shocked.components.find((component) => component.id === id)?.weight ?? 0
    const base = SCORE_WEIGHTS.ecb

    expect(weightOf('price_stability')).toBeLessThan(base.price_stability)
    expect(weightOf('anchoring')).toBeGreaterThan(base.anchoring)
    expect(weightOf('shock_response')).toBeGreaterThan(base.shock_response)
    // Never all of it: a committee that lets inflation run through an oil
    // shock has still failed, and price stability must still be able to say so.
    expect(weightOf('price_stability')).toBeGreaterThan(base.price_stability * 0.4)
  })

  it('still judges the same total, on a different question', () => {
    const shocked = calculateScore(mandateUnderPressure(SUPPLY_REGIME_BAND.full), COMPLETED)
    const total = shocked.components.reduce(
      (sum, component) => sum + component.weight,
      0,
    )
    // The moved weight is redistributed, never discarded. A supply-shocked
    // mandate is marked out of the same hundred as any other.
    expect(total).toBeCloseTo(1, 10)
  })

  it('scores the same miss higher when the target was genuinely unreachable', () => {
    const calm = calculateScore(mandateUnderPressure(0), COMPLETED)
    const shocked = calculateScore(mandateUnderPressure(SUPPLY_REGIME_BAND.full), COMPLETED)

    // Identical inflation path in both. The only difference is whether any
    // policy on the desk could have removed the pressure behind it.
    expect(shocked.score).toBeGreaterThan(calm.score)
  })

  it('ramps rather than stepping, so no player can park under a cliff', () => {
    const shares = [0, 1, 2, 3, 4].map(
      (shock) => calculateScore(mandateUnderPressure(shock), COMPLETED).supplyRegimeShare,
    )
    for (let i = 1; i < shares.length; i += 1) {
      expect(shares[i]).toBeGreaterThanOrEqual(shares[i - 1])
    }
    expect(shares[0]).toBe(0)
    expect(shares.at(-1)).toBe(1)
  })

  it('softens the ECB safeguard without removing it', () => {
    const calm = calculateScore(mandateUnderPressure(0), COMPLETED)
    const shocked = calculateScore(mandateUnderPressure(SUPPLY_REGIME_BAND.full), COMPLETED)

    // The gate exists so employment cannot buy past a failure on inflation. A
    // price level pushed up by a shock nothing on the desk reaches is not that
    // failure — but it is not a clean sheet either.
    expect(shocked.priceStabilityGate).toBeGreaterThan(calm.priceStabilityGate)
    expect(shocked.priceStabilityGate).toBeLessThan(1)
  })
})

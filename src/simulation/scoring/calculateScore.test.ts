// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Difficulty, Institution } from '../types/core.ts'
import type { EndConditionResult } from '../types/scoring.ts'
import type { LatentState, SimulationState } from '../types/state.ts'
import { SIMULATION_VERSION } from '../version.ts'
import { MAX_SCORE, SCORE_WEIGHTS } from '../config/scoring.ts'
import { YEARS_PER_MEETING } from '../config/time.ts'
import { createInitialState } from '../engine/initialState.ts'
import { testConfig } from '../testing/harness.ts'
import { calculateScore, scoreBucketKey } from './calculateScore.ts'

/**
 * Scoring.
 *
 * Two things are load-bearing beyond the arithmetic: records must never mix
 * buckets across institution, difficulty and engine version, and the ECB's
 * price-stability gate must actually bite, so that a strong employment record
 * cannot buy its way past a persistent inflation failure.
 */

const COMPLETED: EndConditionResult = {
  status: 'completed',
  triggered: 'mandate_completed',
  label: 'Mandate completed',
  summary: 'The full mandate was served.',
  causalChain: [],
  warnings: [],
  breachCounters: {},
}

const FAILED: EndConditionResult = { ...COMPLETED, status: 'failed', triggered: 'dismissed' }

/** A finished run whose whole path sat at the given latent values. */
function syntheticRun(
  institution: Institution,
  difficulty: Difficulty,
  overrides: Partial<LatentState>,
  meetingsServed?: number,
): SimulationState {
  const base = createInitialState(testConfig(institution, difficulty, 'scoring'))
  const latent: LatentState = { ...base.latent, ...overrides }
  const served = meetingsServed ?? base.config.meetingCount

  const history = Array.from({ length: served + 1 }, (_, index) => ({
    meetingIndex: index,
    timeYears: index * YEARS_PER_MEETING,
    latent,
  }))

  return {
    ...base,
    meetingIndex: served,
    timeYears: served * YEARS_PER_MEETING,
    latent,
    history,
  }
}

/** An economy exactly on both objectives. */
const PERFECT: Partial<LatentState> = {
  inflationHeadline: 2,
  inflationCore: 2,
  expectedInflationLong: 2,
  outputGap: 0,
  unemployment: 4.2,
  naturalUnemployment: 4.2,
  bankingStress: 12,
  creditSpread: 1.1,
  marketVolatility: 14,
  fragmentation: 20,
  credibility: 88,
}

/** On target for employment, badly and persistently off on inflation. */
const INFLATION_FAILURE: Partial<LatentState> = {
  ...PERFECT,
  inflationHeadline: 7,
  inflationCore: 6.5,
  expectedInflationLong: 4.5,
}

describe('record buckets', () => {
  it('separates institutions, difficulties and engine versions', () => {
    const keys = new Set([
      scoreBucketKey('fed', 'easy', '1.0.0'),
      scoreBucketKey('ecb', 'easy', '1.0.0'),
      scoreBucketKey('fed', 'medium', '1.0.0'),
      scoreBucketKey('fed', 'hard', '1.0.0'),
      scoreBucketKey('fed', 'easy', '2.0.0'),
    ])
    expect(keys.size).toBe(5)
  })

  it('is reported on every score, matching the run configuration', () => {
    const state = syntheticRun('ecb', 'hard', PERFECT)
    const score = calculateScore(state, COMPLETED)
    expect(score.bucketKey).toBe(scoreBucketKey('ecb', 'hard', SIMULATION_VERSION))
    expect(score.simulationVersion).toBe(SIMULATION_VERSION)
    expect(score.scoringVersion).toBeTruthy()
  })

  it('puts a run recorded under an older engine in a different bucket', () => {
    const current = syntheticRun('fed', 'medium', PERFECT)
    const older: SimulationState = {
      ...current,
      config: { ...current.config, simulationVersion: '0.9.0' },
    }
    expect(calculateScore(current, COMPLETED).bucketKey).not.toBe(
      calculateScore(older, COMPLETED).bucketKey,
    )
  })
})

describe('score arithmetic', () => {
  it('stays inside 0 to 10,000', () => {
    for (const overrides of [PERFECT, INFLATION_FAILURE, {}]) {
      for (const institution of ['fed', 'ecb'] as const) {
        const score = calculateScore(syntheticRun(institution, 'hard', overrides), COMPLETED)
        expect(score.score).toBeGreaterThanOrEqual(0)
        expect(score.score).toBeLessThanOrEqual(MAX_SCORE)
        expect(Number.isInteger(score.score)).toBe(true)
      }
    }
  })

  it('weights every component and sums them to the weighted total', () => {
    const score = calculateScore(syntheticRun('fed', 'medium', PERFECT), COMPLETED)
    const summed = score.components.reduce((total, c) => total + c.contribution, 0)
    expect(summed).toBeCloseTo(score.weightedTotal, 10)

    for (const component of score.components) {
      expect(component.raw).toBeGreaterThanOrEqual(0)
      expect(component.raw).toBeLessThanOrEqual(1)
      expect(component.contribution).toBeCloseTo(component.raw * component.weight, 10)
      expect(component.explanation.length).toBeGreaterThan(0)
    }
  })

  it('uses weights that sum to one for both institutions', () => {
    for (const institution of ['fed', 'ecb'] as const) {
      const total = Object.values(SCORE_WEIGHTS[institution]).reduce((a, b) => a + b, 0)
      expect(total).toBeCloseTo(1, 10)
    }
  })

  it('scores a flawless mandate far above a failed one', () => {
    const good = calculateScore(syntheticRun('fed', 'medium', PERFECT), COMPLETED)
    const bad = calculateScore(syntheticRun('fed', 'medium', INFLATION_FAILURE), COMPLETED)
    expect(good.score).toBeGreaterThan(bad.score)
  })
})

describe('scoring runs over the whole path, not the final turn', () => {
  it('penalises a mandate that spent its whole length off target', () => {
    const base = createInitialState(testConfig('fed', 'medium', 'path'))
    const onTargetThroughout = syntheticRun('fed', 'medium', PERFECT)

    // Same ending, but every earlier meeting was far off target.
    const chaoticPath: SimulationState = {
      ...onTargetThroughout,
      history: onTargetThroughout.history.map((snapshot, index) => ({
        ...snapshot,
        latent:
          index === onTargetThroughout.history.length - 1
            ? snapshot.latent
            : { ...base.latent, ...INFLATION_FAILURE },
      })),
    }

    expect(calculateScore(chaoticPath, COMPLETED).score).toBeLessThan(
      calculateScore(onTargetThroughout, COMPLETED).score,
    )
  })
})

describe('the ECB price-stability gate', () => {
  it('never gates the Fed, whose mandate is coequal', () => {
    for (const overrides of [PERFECT, INFLATION_FAILURE]) {
      expect(
        calculateScore(syntheticRun('fed', 'medium', overrides), COMPLETED)
          .priceStabilityGate,
      ).toBe(1)
    }
  })

  it('does not gate an ECB run that held price stability', () => {
    expect(
      calculateScore(syntheticRun('ecb', 'medium', PERFECT), COMPLETED)
        .priceStabilityGate,
    ).toBe(1)
  })

  it('gates an ECB run that failed persistently on inflation', () => {
    const score = calculateScore(
      syntheticRun('ecb', 'medium', INFLATION_FAILURE),
      COMPLETED,
    )
    expect(score.priceStabilityGate).toBeLessThan(1)
    expect(score.priceStabilityGate).toBeGreaterThan(0)
  })

  it('stops strong employment from compensating for it', () => {
    // Identical economies. The ECB is punished harder for the same inflation
    // record, because for the ECB it is not one objective among several.
    const fed = calculateScore(syntheticRun('fed', 'medium', INFLATION_FAILURE), COMPLETED)
    const ecb = calculateScore(syntheticRun('ecb', 'medium', INFLATION_FAILURE), COMPLETED)

    expect(ecb.score).toBeLessThan(fed.score)

    const ecbEmployment = ecb.components.find((c) => c.id === 'employment_output')!
    const fedEmployment = fed.components.find((c) => c.id === 'employment_output')!
    expect(ecbEmployment.raw).toBeCloseTo(fedEmployment.raw, 6)
    expect(ecbEmployment.weight).toBeLessThan(fedEmployment.weight)
  })
})

describe('completion and difficulty', () => {
  it('awards the completion component only to a finished mandate', () => {
    const finished = calculateScore(syntheticRun('fed', 'medium', PERFECT), COMPLETED)
    const cutShort = calculateScore(
      syntheticRun('fed', 'medium', PERFECT, 6),
      FAILED,
    )

    const completionOf = (score: typeof finished) =>
      score.components.find((c) => c.id === 'completion')!.raw

    expect(completionOf(finished)).toBe(1)
    expect(completionOf(cutShort)).toBeLessThan(1)
    expect(finished.score).toBeGreaterThan(cutShort.score)
  })

  it('applies a modest difficulty multiplier', () => {
    const easy = calculateScore(syntheticRun('fed', 'easy', PERFECT), COMPLETED)
    const hard = calculateScore(syntheticRun('fed', 'hard', PERFECT), COMPLETED)

    expect(easy.difficultyMultiplier).toBeLessThan(1)
    expect(hard.difficultyMultiplier).toBeGreaterThan(1)
    expect(hard.difficultyMultiplier / easy.difficultyMultiplier).toBeLessThan(1.5)
  })
})

describe('policy steadiness', () => {
  it('penalises churning the policy rate back and forth', () => {
    const base = createInitialState(testConfig('fed', 'medium', 'churn'))
    const steady = syntheticRun('fed', 'medium', PERFECT)

    const churned: SimulationState = {
      ...steady,
      history: steady.history.map((snapshot, index) => ({
        ...snapshot,
        latent: {
          ...base.latent,
          ...PERFECT,
          // A full point up and down at every single meeting.
          policyRate: 3 + (index % 2 === 0 ? 1 : -1),
        },
      })),
    }

    const steadyScore = calculateScore(steady, COMPLETED)
    const churnedScore = calculateScore(churned, COMPLETED)

    const steadiness = (score: typeof steadyScore) =>
      score.components.find((c) => c.id === 'policy_volatility')!.raw

    expect(steadiness(churnedScore)).toBeLessThan(steadiness(steadyScore))
    expect(churnedScore.score).toBeLessThan(steadyScore.score)
  })
})

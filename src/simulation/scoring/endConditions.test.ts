// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Difficulty, Institution } from '../types/core.ts'
import type { EndConditionId, EndConditionResult } from '../types/scoring.ts'
import type { LatentState, SimulationState } from '../types/state.ts'
import { createInitialState } from '../engine/initialState.ts'
import { testConfig } from '../testing/harness.ts'
import { evaluateEndConditions } from './endConditions.ts'

/**
 * End conditions.
 *
 * Two properties matter as much as the thresholds themselves: a failure must
 * warn before it lands, and it must require the condition to hold for several
 * consecutive meetings. Each case below therefore checks the whole approach —
 * quiet, then warned, then failed — not just the final verdict.
 */

function stateWith(
  institution: Institution,
  difficulty: Difficulty,
  overrides: Partial<LatentState>,
): SimulationState {
  const base = createInitialState(testConfig(institution, difficulty, 'end-conditions'))
  return { ...base, latent: { ...base.latent, ...overrides } }
}

/** Evaluates the same state repeatedly, carrying the breach counters forward. */
function evaluateRepeatedly(
  state: SimulationState,
  times: number,
): EndConditionResult[] {
  const results: EndConditionResult[] = []
  let counters: Readonly<Record<string, number>> = {}
  for (let i = 0; i < times; i += 1) {
    const result = evaluateEndConditions(state, counters)
    counters = result.breachCounters
    results.push(result)
  }
  return results
}

interface FailureCase {
  readonly id: EndConditionId
  readonly institution: Institution
  readonly meetingsToFail: number
  readonly overrides: Partial<LatentState>
}

const FAILURE_CASES: readonly FailureCase[] = [
  {
    id: 'inflation_spiral',
    institution: 'fed',
    meetingsToFail: 3,
    overrides: { inflationHeadline: 16 },
  },
  {
    id: 'deflation_spiral',
    institution: 'fed',
    meetingsToFail: 4,
    overrides: {
      inflationHeadline: -4,
      outputGap: -3,
      expectedInflationLong: -1,
    },
  },
  {
    id: 'depression',
    institution: 'fed',
    meetingsToFail: 4,
    overrides: { outputGap: -12, unemployment: 12, naturalUnemployment: 4.2 },
  },
  {
    id: 'banking_crisis',
    institution: 'fed',
    meetingsToFail: 2,
    overrides: { bankingStress: 95 },
  },
  {
    id: 'fragmentation_crisis',
    institution: 'ecb',
    meetingsToFail: 2,
    overrides: { fragmentation: 700 },
  },
  {
    id: 'currency_dysfunction',
    institution: 'fed',
    meetingsToFail: 2,
    overrides: { marketVolatility: 97, exchangeRate: 135 },
  },
  {
    id: 'loss_of_monetary_control',
    institution: 'fed',
    meetingsToFail: 3,
    // Expectations far below target, so this does not also read as a spiral.
    overrides: { anchoring: 0.04, expectedInflationLong: -3.2 },
  },
  {
    id: 'dismissed',
    institution: 'fed',
    meetingsToFail: 4,
    overrides: { credibility: 8 },
  },
]

describe('every end condition triggers, and only after it has held', () => {
  for (const testCase of FAILURE_CASES) {
    describe(testCase.id, () => {
      const state = stateWith(testCase.institution, 'medium', testCase.overrides)
      const results = evaluateRepeatedly(state, testCase.meetingsToFail + 1)

      it('does not end the run before the condition has held long enough', () => {
        for (let i = 0; i < testCase.meetingsToFail - 1; i += 1) {
          expect(results[i].status).toBe('active')
          expect(results[i].triggered).toBeNull()
        }
      })

      it('ends the run on the meeting the counter reaches its threshold', () => {
        const decisive = results[testCase.meetingsToFail - 1]
        expect(decisive.status).toBe('failed')
        expect(decisive.triggered).toBe(testCase.id)
      })

      it('warns before it fails', () => {
        const firstWarnings = results[0].warnings.map((warning) => warning.id)
        expect(firstWarnings).toContain(testCase.id)
        const warning = results[0].warnings.find((w) => w.id === testCase.id)!
        expect(warning.severity).toBe('severe')
        expect(warning.meetingsToTrigger).toBe(testCase.meetingsToFail)
        expect(warning.message.length).toBeGreaterThan(0)
      })

      it('explains itself with a ranked causal chain, not a single cause', () => {
        const decisive = results[testCase.meetingsToFail - 1]
        expect(decisive.summary).toBeTruthy()
        expect(decisive.causalChain.length).toBeGreaterThan(1)

        const total = decisive.causalChain.reduce(
          (sum, factor) => sum + factor.contribution,
          0,
        )
        expect(total).toBeCloseTo(1, 6)

        for (let i = 1; i < decisive.causalChain.length; i += 1) {
          expect(decisive.causalChain[i - 1].contribution).toBeGreaterThanOrEqual(
            decisive.causalChain[i].contribution,
          )
        }
      })
    })
  }
})

describe('completing the mandate', () => {
  it('reports completion once every scheduled meeting has been held', () => {
    const base = createInitialState(testConfig('fed', 'easy', 'completion'))
    const finished = { ...base, meetingIndex: base.config.meetingCount }
    const result = evaluateEndConditions(finished)
    expect(result.status).toBe('completed')
    expect(result.triggered).toBe('mandate_completed')
  })

  it('stays active until then', () => {
    const base = createInitialState(testConfig('fed', 'easy', 'completion'))
    const midway = { ...base, meetingIndex: base.config.meetingCount - 1 }
    expect(evaluateEndConditions(midway).status).toBe('active')
  })

  it('reports a catastrophe rather than completion when both land together', () => {
    const base = createInitialState(testConfig('fed', 'medium', 'completion'))
    const doomed: SimulationState = {
      ...base,
      meetingIndex: base.config.meetingCount,
      latent: { ...base.latent, bankingStress: 95 },
    }
    const first = evaluateEndConditions(doomed)
    const second = evaluateEndConditions(doomed, first.breachCounters)
    expect(second.status).toBe('failed')
    expect(second.triggered).toBe('banking_crisis')
  })
})

describe('dismissal requires a sustained collapse, not unpopularity', () => {
  it('never dismisses on political pressure alone', () => {
    const state = stateWith('fed', 'medium', {
      politicalPressure: 98,
      publicTrust: 5,
      credibility: 70,
    })
    const results = evaluateRepeatedly(state, 12)
    for (const result of results) {
      expect(result.triggered).not.toBe('dismissed')
    }
  })

  it('still warns while standing is deteriorating', () => {
    const state = stateWith('fed', 'medium', { politicalPressure: 98, credibility: 70 })
    const warnings = evaluateEndConditions(state).warnings.map((w) => w.id)
    expect(warnings).toContain('dismissed')
  })

  it('takes four consecutive meetings of collapsed credibility', () => {
    const state = stateWith('fed', 'medium', { credibility: 8 })
    const results = evaluateRepeatedly(state, 4)
    expect(results[2].status).toBe('active')
    expect(results[3].status).toBe('failed')
  })

  it('resets the counter when credibility recovers', () => {
    const collapsed = stateWith('fed', 'medium', { credibility: 8 })
    const recovered = stateWith('fed', 'medium', { credibility: 65 })

    let counters = evaluateEndConditions(collapsed).breachCounters
    counters = evaluateEndConditions(collapsed, counters).breachCounters
    expect(counters.dismissed).toBe(2)

    counters = evaluateEndConditions(recovered, counters).breachCounters
    expect(counters.dismissed).toBe(0)
  })
})

describe('difficulty changes how forgiving the thresholds are', () => {
  it('needs a worse economy to fail on easy than on hard', () => {
    // Banking stress that ends a hard run leaves an easy run merely warned.
    const overrides = { bankingStress: 78 }
    const hard = evaluateRepeatedly(stateWith('fed', 'hard', overrides), 4)
    const easy = evaluateRepeatedly(stateWith('fed', 'easy', overrides), 4)

    expect(hard.some((result) => result.triggered === 'banking_crisis')).toBe(true)
    expect(easy.some((result) => result.triggered === 'banking_crisis')).toBe(false)
  })

  it('gives easy runs an extra meeting of patience', () => {
    const overrides = { bankingStress: 99 }
    const medium = evaluateRepeatedly(stateWith('fed', 'medium', overrides), 4)
    const easy = evaluateRepeatedly(stateWith('fed', 'easy', overrides), 4)

    const mediumFailedAt = medium.findIndex((r) => r.status === 'failed')
    const easyFailedAt = easy.findIndex((r) => r.status === 'failed')
    expect(easyFailedAt).toBe(mediumFailedAt + 1)
  })
})

describe('institution-specific conditions', () => {
  it('applies sovereign fragmentation only to the ECB', () => {
    const overrides = { fragmentation: 900 }
    const ecb = evaluateRepeatedly(stateWith('ecb', 'medium', overrides), 4)
    const fed = evaluateRepeatedly(stateWith('fed', 'medium', overrides), 4)

    expect(ecb.some((r) => r.triggered === 'fragmentation_crisis')).toBe(true)
    expect(fed.some((r) => r.triggered === 'fragmentation_crisis')).toBe(false)
    expect(
      fed.some((r) => r.warnings.some((w) => w.id === 'fragmentation_crisis')),
    ).toBe(false)
  })
})

describe('a healthy economy ends nothing', () => {
  it('stays active with no warnings', () => {
    const healthy = stateWith('fed', 'medium', {
      inflationHeadline: 2.05,
      inflationCore: 2.0,
      expectedInflationLong: 2.0,
      anchoring: 0.95,
      outputGap: 0.1,
      unemployment: 4.2,
      naturalUnemployment: 4.2,
      bankingStress: 12,
      marketVolatility: 16,
      credibility: 78,
      politicalPressure: 20,
      publicTrust: 72,
      fragmentation: 20,
    })
    const result = evaluateEndConditions(healthy)
    expect(result.status).toBe('active')
    expect(result.warnings).toHaveLength(0)
  })
})

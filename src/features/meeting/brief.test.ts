import { describe, expect, it } from 'vitest'
import {
  SIMULATION_VERSION,
  createRunConfig,
  startRun,
  type EndConditionResult,
  type EndConditionWarning,
  type IndicatorObservation,
  type ObservationSet,
  type SeriesId,
} from '../../simulation/index.ts'
import { MAX_DEVELOPMENTS, buildMeetingBrief } from './brief.ts'

function indicator(
  seriesId: SeriesId,
  value: number | null,
  previous: number | null = null,
): IndicatorObservation {
  return {
    seriesId,
    label: seriesId,
    unit: '%',
    definition: 'test series',
    meaning: 'a rise means more, a fall means less',
    category: 'official_statistic',
    value,
    previous,
    revision: null,
    publicationLagMeetings: 1,
    trend: [previous, value],
    uncertainty: 0.2,
    missing: value === null,
  }
}

function observation(overrides: Partial<ObservationSet> = {}): ObservationSet {
  return {
    meetingIndex: 1,
    indicators: {},
    forecasts: [],
    newswire: [],
    clues: [],
    taylorBenchmark: 3,
    diagnosis: null,
    ...overrides,
  }
}

function outcome(warnings: readonly EndConditionWarning[] = []): EndConditionResult {
  return {
    status: 'active',
    triggered: null,
    label: null,
    summary: null,
    causalChain: [],
    warnings,
    breachCounters: {},
  }
}

function warning(
  id: EndConditionWarning['id'],
  severity: EndConditionWarning['severity'],
): EndConditionWarning {
  return {
    id,
    label: `${id} warning`,
    message: `${id} is close to its limit.`,
    severity,
    meetingsHeld: 1,
    meetingsToTrigger: 3,
  }
}

describe('buildMeetingBrief', () => {
  it('never shows more than five developments', () => {
    const brief = buildMeetingBrief(
      observation({
        newswire: ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'],
        clues: ['A clue'],
      }),
      outcome([warning('inflation_spiral', 'watch')]),
      'fed',
    )

    expect(brief.developments).toHaveLength(MAX_DEVELOPMENTS)
  })

  it('puts warnings first, severe before watch', () => {
    const brief = buildMeetingBrief(
      observation({ newswire: ['A headline'] }),
      outcome([warning('depression', 'watch'), warning('banking_crisis', 'severe')]),
      'fed',
    )

    expect(brief.developments.map((item) => item.id)).toEqual([
      'warning_banking_crisis',
      'warning_depression',
      'news_0',
    ])
  })

  it('reports an inflation gap only once it is material', () => {
    const near = buildMeetingBrief(
      observation({ indicators: { headline_inflation: indicator('headline_inflation', 2.1) } }),
      outcome(),
      'fed',
    )
    expect(near.developments.map((item) => item.id)).not.toContain('inflation_gap')

    const wide = buildMeetingBrief(
      observation({ indicators: { headline_inflation: indicator('headline_inflation', 3.4) } }),
      outcome(),
      'fed',
    )
    const gap = wide.developments.find((item) => item.id === 'inflation_gap')
    expect(gap?.headline).toContain('above')
    expect(gap?.detail).toContain('3.40')
  })

  it('describes the priced path when markets have moved away from the rate', () => {
    const brief = buildMeetingBrief(
      observation({
        indicators: {
          policy_rate: indicator('policy_rate', 3),
          market_expected_rate: indicator('market_expected_rate', 2.5),
        },
      }),
      outcome(),
      'fed',
    )

    const pricing = brief.developments.find((item) => item.id === 'market_pricing')
    expect(pricing?.headline).toBe('Markets price 50 bp of easing over the coming year')
  })

  it('labels the Taylor benchmark as a reference, not a recommendation', () => {
    const brief = buildMeetingBrief(
      observation({
        taylorBenchmark: 4,
        indicators: { policy_rate: indicator('policy_rate', 3) },
      }),
      outcome(),
      'fed',
    )

    const taylor = brief.questions.find((question) => question.includes('Taylor'))
    expect(taylor).toContain('100 bp above')
    expect(taylor).toContain('not a recommendation')
  })

  it('is a pure function of the observation it is given', () => {
    const session = startRun(
      createRunConfig({
        institution: 'fed',
        difficulty: 'easy',
        seed: 'BRIEF',
        simulationVersion: SIMULATION_VERSION,
      }),
    )

    const first = buildMeetingBrief(session.observation, session.outcome, 'fed')
    const second = buildMeetingBrief(session.observation, session.outcome, 'fed')

    expect(second).toEqual(first)
    expect(first.developments.length).toBeLessThanOrEqual(MAX_DEVELOPMENTS)
    expect(first.questions.length).toBeGreaterThan(0)
  })
})

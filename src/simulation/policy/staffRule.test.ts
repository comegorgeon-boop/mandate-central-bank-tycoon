// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type {
  IndicatorObservation,
  ObservationSet,
  SeriesId,
} from '../types/observation.ts'
import { POLICY_RATE_FLOOR } from '../config/instruments.ts'
import { staffRecommendation } from './staffRule.ts'

/**
 * The reference rule the staff advise from.
 *
 * The property that matters is the one docs/BALANCE.md paid for: it reacts to
 * **core** inflation, not headline. A rule that chases headline tightens into
 * supply shocks, which is the error this model is built to punish, and the
 * measured cost of getting it wrong was 400 points on fed/medium and half the
 * survival rate on fed/hard.
 */

function indicator(seriesId: SeriesId, value: number | null): IndicatorObservation {
  return {
    seriesId,
    label: seriesId,
    unit: '%',
    definition: 'test series',
    meaning: 'test meaning',
    category: 'official_statistic',
    value,
    previous: null,
    revision: null,
    publicationLagMeetings: 0,
    trend: [value],
    uncertainty: seriesId === 'neutral_rate_estimate' ? 0.12 : 0,
    missing: value === null,
  }
}

function observation(values: Partial<Record<SeriesId, number | null>>): ObservationSet {
  const indicators: Partial<Record<SeriesId, IndicatorObservation>> = {}
  for (const [id, value] of Object.entries(values) as [SeriesId, number | null][]) {
    indicators[id] = indicator(id, value)
  }
  return {
    meetingIndex: 4,
    indicators,
    forecasts: [],
    newswire: [],
    clues: [],
    taylorBenchmark: 3,
    diagnosis: null,
  }
}

/** A supply shock: headline far above core, which is the trap for a bad rule. */
const SUPPLY_SHOCK = {
  policy_rate: 2.5,
  core_inflation: 2.1,
  headline_inflation: 5.2,
  inflation_expectations_1y: 2.2,
  neutral_rate_estimate: 0.9,
}

describe('the rule reacts to core inflation', () => {
  it('does not chase a headline print core disagrees with', () => {
    const calm = staffRecommendation(observation(SUPPLY_SHOCK), 'fed', 'easy')!
    const calmer = staffRecommendation(
      observation({ ...SUPPLY_SHOCK, headline_inflation: 2.2 }),
      'fed',
      'easy',
    )!

    // Headline moved 3 pp between these two. The advice must not notice.
    expect(calm.basisPoints).toBe(calmer.basisPoints)
    expect(calm.measure).toBe('core')
  })

  it('does react when core itself moves', () => {
    const low = staffRecommendation(observation(SUPPLY_SHOCK), 'fed', 'easy')!
    const high = staffRecommendation(
      observation({ ...SUPPLY_SHOCK, core_inflation: 4.5 }),
      'fed',
      'easy',
    )!
    expect(high.basisPoints).toBeGreaterThan(low.basisPoints)
  })

  it('falls back to headline when the core print is missing, and says so', () => {
    const advice = staffRecommendation(
      observation({ ...SUPPLY_SHOCK, core_inflation: null }),
      'fed',
      'easy',
    )!
    expect(advice.measure).toBe('headline')
    expect(advice.reasoning).toContain('core print is missing')
  })
})

describe('the advice is usable as given', () => {
  it('never recommends a move through the lower bound', () => {
    const advice = staffRecommendation(
      observation({
        policy_rate: POLICY_RATE_FLOOR.fed,
        core_inflation: 0.2,
        headline_inflation: 0.1,
        inflation_expectations_1y: 0.3,
        neutral_rate_estimate: 0.9,
      }),
      'fed',
      'easy',
    )!
    expect(POLICY_RATE_FLOOR.fed + advice.basisPoints / 100).toBeGreaterThanOrEqual(
      POLICY_RATE_FLOOR.fed - 1e-9,
    )
  })

  it('lands on a whole increment the desk actually offers', () => {
    const advice = staffRecommendation(observation(SUPPLY_SHOCK), 'fed', 'easy')!
    expect(advice.basisPoints % 25).toBe(0)
  })

  it('always states its grounds, not just its number', () => {
    const advice = staffRecommendation(observation(SUPPLY_SHOCK), 'fed', 'easy')!
    expect(advice.reasoning).toContain('Core inflation')
    expect(advice.reasoning).toContain('the services recommend')
  })

  it('declines to advise when it cannot read an inflation measure at all', () => {
    expect(
      staffRecommendation(
        observation({ policy_rate: 2.5, core_inflation: null, headline_inflation: null }),
        'fed',
        'easy',
      ),
    ).toBeNull()
  })

  it('is a pure function of the observation it is given', () => {
    const set = observation(SUPPLY_SHOCK)
    expect(staffRecommendation(set, 'fed', 'easy')).toEqual(
      staffRecommendation(set, 'fed', 'easy'),
    )
  })
})

// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type {
  IndicatorObservation,
  ObservationSet,
  SeriesId,
} from '../types/observation.ts'
import { readStance, readStanceChange, stanceAfterMove } from './stance.ts'

/**
 * The stance reading.
 *
 * The case that matters most is the one that made the first playthrough
 * illegible: a nominal rise that is an easing, because expectations moved
 * further than the rate did. If nothing else in this file survives, that must.
 */

function indicator(seriesId: SeriesId, value: number | null): IndicatorObservation {
  return {
    seriesId,
    label: seriesId,
    unit: '%',
    definition: 'test series',
    meaning: 'test meaning',
    category: 'market_data',
    value,
    previous: null,
    revision: null,
    publicationLagMeetings: 0,
    trend: [value],
    uncertainty: seriesId === 'neutral_rate_estimate' ? 0.12 : 0,
    missing: value === null,
  }
}

/** An observation carrying just the series the stance is built from. */
function observation(values: Partial<Record<SeriesId, number | null>>): ObservationSet {
  const indicators: Partial<Record<SeriesId, IndicatorObservation>> = {}
  for (const [id, value] of Object.entries(values) as [SeriesId, number | null][]) {
    indicators[id] = indicator(id, value)
  }
  return {
    meetingIndex: 1,
    indicators,
    forecasts: [],
    newswire: [],
    clues: [],
    taylorBenchmark: 3,
    diagnosis: null,
  }
}

describe('the real rate', () => {
  it('deflates the policy rate by one-year expectations, not by published inflation', () => {
    const stance = readStance(
      observation({
        policy_rate: 4.25,
        inflation_expectations_1y: 2.5,
        headline_inflation: 5.0,
        neutral_rate_estimate: 0.9,
      }),
    )

    // The measure the engine's IS curve runs on.
    expect(stance.realRate).toBeCloseTo(1.75, 10)
    // The measure households live through, reported separately.
    expect(stance.realRateExPost).toBeCloseTo(-0.75, 10)
  })

  it('is unavailable rather than wrong when expectations did not arrive', () => {
    const stance = readStance(
      observation({ policy_rate: 4.25, inflation_expectations_1y: null }),
    )
    expect(stance.realRate).toBeNull()
    expect(stance.label).toBeNull()
  })
})

describe('the stance label', () => {
  const base = { policy_rate: 3.0, neutral_rate_estimate: 1.0 }

  it('reads restrictive when the real rate is clearly above neutral', () => {
    expect(readStance(observation({ ...base, inflation_expectations_1y: 1.0 })).label).toBe(
      'restrictive',
    )
  })

  it('reads accommodative when the real rate is clearly below neutral', () => {
    expect(readStance(observation({ ...base, inflation_expectations_1y: 2.6 })).label).toBe(
      'accommodative',
    )
  })

  it('refuses to call a stance the neutral estimate cannot resolve', () => {
    // Real rate 1.10 against a neutral estimate of 1.00: inside the band, so
    // no label can honestly be attached to it.
    const stance = readStance(observation({ ...base, inflation_expectations_1y: 1.9 }))
    expect(stance.gap).toBeCloseTo(0.1, 10)
    expect(stance.label).toBe('neutral')
  })

  it('widens the undecidable band when the neutral estimate is poorer', () => {
    const set = observation({ ...base, inflation_expectations_1y: 1.0 })
    const vague: ObservationSet = {
      ...set,
      indicators: {
        ...set.indicators,
        neutral_rate_estimate: {
          ...set.indicators.neutral_rate_estimate!,
          uncertainty: 1.5,
        },
      },
    }
    expect(readStance(set).label).toBe('restrictive')
    expect(readStance(vague).label).toBe('neutral')
  })
})

describe('the stance change', () => {
  const before = observation({
    policy_rate: 2.25,
    inflation_expectations_1y: 1.86,
    neutral_rate_estimate: 1.0,
  })

  it('splits the move into the decision and the expectations that ate it', () => {
    // The engine's own numbers from a real fed/easy run: a 25bp rise almost
    // entirely absorbed by a 24bp rise in expectations.
    const after = observation({
      policy_rate: 2.5,
      inflation_expectations_1y: 2.1,
      neutral_rate_estimate: 1.0,
    })

    const change = readStanceChange(after, before)!
    expect(change.nominal).toBeCloseTo(0.25, 10)
    expect(change.expectations).toBeCloseTo(0.24, 10)
    expect(change.real).toBeCloseTo(0.01, 10)
  })

  it('flags a rise that eased policy', () => {
    const after = observation({
      policy_rate: 2.5,
      inflation_expectations_1y: 2.3,
      neutral_rate_estimate: 1.0,
    })

    const change = readStanceChange(after, before)!
    expect(change.real).toBeLessThan(0)
    expect(change.contradictory).toBe(true)
  })

  it('does not call a hold contradictory, however far the stance drifts', () => {
    const after = observation({
      policy_rate: 2.25,
      inflation_expectations_1y: 2.6,
      neutral_rate_estimate: 1.0,
    })

    const change = readStanceChange(after, before)!
    expect(change.nominal).toBe(0)
    expect(change.real).toBeLessThan(0)
    expect(change.contradictory).toBe(false)
  })

  it('has nothing to report at the first meeting', () => {
    expect(readStanceChange(before, null)).toBeNull()
  })
})

describe('the stance a move would produce', () => {
  const current = observation({
    policy_rate: 2.5,
    inflation_expectations_1y: 2.1,
    neutral_rate_estimate: 1.0,
  })

  it('holds expectations fixed and moves only the nominal rate', () => {
    const next = stanceAfterMove(current, 25)
    expect(next.nominalRate).toBeCloseTo(2.75, 10)
    expect(next.expectedInflation).toBe(readStance(current).expectedInflation)
    expect(next.realRate).toBeCloseTo(0.65, 10)
  })

  it('shows a quarter point failing to reach a restrictive stance', () => {
    expect(readStance(current).label).toBe('accommodative')
    expect(stanceAfterMove(current, 25).label).toBe('accommodative')
    expect(stanceAfterMove(current, 150).label).toBe('restrictive')
  })
})

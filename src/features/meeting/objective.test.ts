// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { IndicatorObservation, ObservationSet, SeriesId } from '../../simulation/index.ts'
import { regimeObjective } from './objective.ts'

/**
 * What the player is told they are playing for.
 *
 * The score already moves its objective with the regime. This is the half that
 * says so *before* the decision rather than afterwards in the postmortem: a
 * player judged by a rule nobody stated has been treated unfairly even when the
 * rule was the fair one.
 */

function indicator(seriesId: SeriesId, value: number | null): IndicatorObservation {
  return {
    seriesId,
    label: seriesId,
    unit: '%',
    definition: 'definition',
    meaning: 'meaning',
    category: 'official_statistic',
    value,
    previous: value,
    revision: null,
    publicationLagMeetings: 1,
    trend: [value],
    uncertainty: 0.2,
    missing: value === null,
  }
}

function observation(
  values: Partial<Record<SeriesId, number | null>>,
): ObservationSet {
  const indicators: Partial<Record<SeriesId, IndicatorObservation>> = {}
  for (const [id, value] of Object.entries(values)) {
    indicators[id as SeriesId] = indicator(id as SeriesId, value ?? null)
  }
  return {
    meetingIndex: 3,
    indicators,
    forecasts: [],
    newswire: [],
    clues: [],
    taylorBenchmark: 3,
    diagnosis: null,
  }
}

describe('the objective the player is shown', () => {
  it('is the standing one when prices and activity move together', () => {
    const result = regimeObjective(
      observation({ headline_inflation: 3.4, core_inflation: 3.3, output_gap_estimate: 0.8 }),
      2,
    )
    expect(result.displaced).toBe(false)
    expect(result.goal).toContain('2.0 %')
  })

  it('is displaced when headline runs far ahead of core above target', () => {
    const result = regimeObjective(
      observation({
        headline_inflation: 5.4,
        core_inflation: 3.1,
        output_gap_estimate: -0.9,
        import_prices: 8,
      }),
      2,
    )
    expect(result.displaced).toBe(true)
    expect(result.goal).toMatch(/anchored/)
    expect(result.goal).toMatch(/not available/)
  })

  it('says why, quoting numbers the player can check on the panels', () => {
    const result = regimeObjective(
      observation({
        headline_inflation: 5.4,
        core_inflation: 3.1,
        output_gap_estimate: -0.9,
        import_prices: 8,
      }),
      2,
    )
    // Every figure it cites is a published series, so the claim is verifiable
    // rather than an assertion the player has to take on trust.
    expect(result.reason).toContain('2.30 pp')
    expect(result.reason).toContain('8.0 %')
    expect(result.reason).toContain('-0.90 %')
  })

  it('does not fire on a wide wedge that sits below target', () => {
    // Cheap energy pulling headline *under* target is a cost-push shock too,
    // and a welcome one. It does not make the objective unreachable.
    const result = regimeObjective(
      observation({ headline_inflation: 1.2, core_inflation: 0.2 }),
      2,
    )
    expect(result.displaced).toBe(false)
  })

  it('falls back to the standing objective when the prints have not arrived', () => {
    expect(regimeObjective(observation({ headline_inflation: null }), 2).displaced).toBe(
      false,
    )
    expect(regimeObjective(observation({}), 2).displaced).toBe(false)
  })

  it('never emits a broken sentence', () => {
    for (const values of [
      {},
      { headline_inflation: 5.4, core_inflation: 3.1 },
      { headline_inflation: 5.4, core_inflation: 3.1, output_gap_estimate: -1 },
      { headline_inflation: 2, core_inflation: 2, output_gap_estimate: 0 },
    ]) {
      const result = regimeObjective(observation(values), 2)
      for (const line of [result.goal, result.reason]) {
        expect(line).not.toMatch(/undefined|NaN|null/)
        expect(line.trim().endsWith('.')).toBe(true)
      }
    }
  })
})

// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type {
  EndConditionResult,
  IndicatorObservation,
  ObservationSet,
  SeriesId,
} from '../../simulation/index.ts'
import { readStanding } from './standing.ts'

/**
 * A mandate going well has to be able to say so.
 *
 * The interface signalled only danger: severe warnings, a crisis banner, red
 * panels for what was breaking, and nothing whatsoever for a mandate held at
 * target with everybody in work. A game whose best outcome is the *absence* of
 * feedback gives a player no reason to feel they are doing anything.
 *
 * What matters here is that the good verdict is as specific as the bad one —
 * "going well" is not information, and "these four things are right" is — and
 * that praise can never outrank a mandate about to be lost.
 */

function indicator(
  seriesId: SeriesId,
  value: number,
  previous = value,
): IndicatorObservation {
  return {
    seriesId,
    label: seriesId,
    unit: '%',
    definition: 'definition',
    meaning: 'meaning',
    category: 'official_statistic',
    value,
    previous,
    revision: null,
    publicationLagMeetings: 0,
    trend: [previous, value],
    uncertainty: 0,
    missing: false,
  }
}

function observation(
  values: Partial<Record<SeriesId, number | [number, number]>>,
): ObservationSet {
  const indicators: Partial<Record<SeriesId, IndicatorObservation>> = {}
  for (const [id, entry] of Object.entries(values)) {
    const [value, previous] = Array.isArray(entry) ? entry : [entry as number, entry as number]
    indicators[id as SeriesId] = indicator(id as SeriesId, value, previous)
  }
  return {
    meetingIndex: 4,
    indicators,
    forecasts: [],
    newswire: [],
    clues: [],
    taylorBenchmark: 3,
    diagnosis: null,
  area: null,
  }
}

const CALM: EndConditionResult = {
  status: 'active',
  triggered: null,
  label: null,
  summary: null,
  causalChain: [],
  warnings: [],
  breachCounters: {},
}

const IN_DANGER: EndConditionResult = {
  ...CALM,
  warnings: [
    {
      id: 'inflation_spiral',
      label: 'Inflation spiral',
      message: 'Inflation is running away.',
      severity: 'severe',
      meetingsHeld: 2,
      meetingsToTrigger: 3,
    },
  ],
}

/** A mandate doing everything right. */
const GOING_WELL = observation({
  headline_inflation: 2.05,
  unemployment: 4.1,
  inflation_expectations: 2.02,
  bank_stress_proxy: 14,
  public_approval: [64, 58],
})

describe('the standing reading', () => {
  it('calls a well-run mandate thriving, and says exactly why', () => {
    const standing = readStanding(GOING_WELL, CALM, 'fed')
    expect(standing.tone).toBe('thriving')
    expect(standing.achievements.length).toBeGreaterThanOrEqual(3)
    expect(standing.concerns).toHaveLength(0)

    // Named specifics, not adjectives: every line quotes the figure it is
    // about, so the player can check the claim on the panels.
    for (const line of standing.achievements) {
      expect(line).toMatch(/\d/)
    }
    expect(standing.achievements.join(' ')).toMatch(/objective/)
    expect(standing.achievements.join(' ')).toMatch(/anchored/)
  })

  it('notices approval climbing', () => {
    expect(readStanding(GOING_WELL, CALM, 'fed').achievements.join(' ')).toMatch(
      /trust rose/,
    )
  })

  it('never calls a mandate about to be lost anything but in danger', () => {
    // The load-bearing rule. Inflation can be on target this quarter while the
    // mandate is four meetings from revocation, and praising it then would be
    // worse than saying nothing.
    const standing = readStanding(GOING_WELL, IN_DANGER, 'fed')
    expect(standing.tone).toBe('critical')
  })

  it('calls a genuinely bad mandate strained, with the reasons', () => {
    const standing = readStanding(
      observation({
        headline_inflation: 6.4,
        unemployment: 7.5,
        inflation_expectations: 4.1,
        bank_stress_proxy: 70,
      }),
      CALM,
      'fed',
    )
    expect(standing.tone).toBe('strained')
    expect(standing.concerns.length).toBeGreaterThan(standing.achievements.length)
    for (const line of standing.concerns) expect(line).toMatch(/\d/)
  })

  it('says nothing rather than inventing a verdict when nothing stands out', () => {
    const standing = readStanding(
      observation({ headline_inflation: 2.7, unemployment: 5.0 }),
      CALM,
      'fed',
    )
    expect(standing.tone).toBe('steady')
    expect(standing.achievements).toHaveLength(0)
    expect(standing.concerns).toHaveLength(0)
  })

  it('reads whatever is published and never falls over on a missing print', () => {
    for (const values of [{}, { headline_inflation: 2 }, { unemployment: 4 }]) {
      const standing = readStanding(observation(values), CALM, 'ecb')
      expect(standing.headline.length).toBeGreaterThan(0)
      for (const line of [...standing.achievements, ...standing.concerns]) {
        expect(line).not.toMatch(/undefined|NaN|null/)
      }
    }
  })
})

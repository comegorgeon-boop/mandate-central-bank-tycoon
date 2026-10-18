// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { IndicatorObservation } from '../../simulation/index.ts'
import { plainHeadline, registerFor } from './register.ts'

/**
 * The register: the language each difficulty publishes its numbers in.
 *
 * The load-bearing property is the last one tested here. A plain-language
 * headline is a *claim*, and a claim about a gap smaller than the print's own
 * error bar is a confident lie dressed as help — precisely the mistake
 * docs/BALANCE.md records costing a whole calibration when it was made in a
 * test assertion. Made in the copy the player steers by, it would be worse:
 * the tutorial would be teaching them to read noise.
 */

function indicator(
  overrides: Partial<IndicatorObservation> = {},
): IndicatorObservation {
  return {
    seriesId: 'headline_inflation',
    label: 'Headline inflation',
    unit: '% y/y',
    definition: 'definition',
    meaning: 'meaning',
    category: 'official_statistic',
    value: 2,
    previous: 2,
    revision: null,
    publicationLagMeetings: 1,
    trend: [2, 2],
    uncertainty: 0.25,
    missing: false,
    ...overrides,
  }
}

describe('the register', () => {
  it('leads with the sentence at easy and the figure above it', () => {
    expect(registerFor('easy')).toBe('plain')
  })

  it('leads with the figure from medium, and stops reading it for you at hard', () => {
    expect(registerFor('medium')).toBe('brief')
    expect(registerFor('hard')).toBe('technical')
  })
})

describe('the plain-language headline', () => {
  it('states the distance to a reference in words, with no figure in it', () => {
    const sentence = plainHeadline(
      indicator({ value: 5, uncertainty: 0.25 }),
      2,
      'objective',
    )
    expect(sentence).toBe('Headline inflation is well above the objective.')
    expect(sentence).not.toMatch(/\d/)
  })

  it('says below when it is below', () => {
    expect(plainHeadline(indicator({ value: 0.2 }), 2, 'objective')).toBe(
      'Headline inflation is well below the objective.',
    )
  })

  it('never calls a gap inside the error bar a distance', () => {
    // 0.2pp against a published uncertainty of 0.25 is not a gap the player
    // can act on, and telling them it is teaches them to chase noise.
    expect(plainHeadline(indicator({ value: 2.2 }), 2, 'objective')).toBe(
      'Headline inflation is close to the objective.',
    )
  })

  it('scales what counts as a distance to the series own error bar', () => {
    const gap = 0.6
    // The same gap reads as clear on a precise series and as nothing on a
    // noisy one, which is the whole point of stating it in error bars.
    expect(plainHeadline(indicator({ value: 2 + gap, uncertainty: 0.05 }), 2, 'objective')).toMatch(
      /well above/,
    )
    expect(plainHeadline(indicator({ value: 2 + gap, uncertainty: 1.2 }), 2, 'objective')).toMatch(
      /close to/,
    )
  })

  it('falls back to the direction of travel when there is no reference', () => {
    expect(plainHeadline(indicator({ value: 3, previous: 2 }), null, 'objective')).toBe(
      'Headline inflation has risen well since the last meeting.',
    )
    expect(plainHeadline(indicator({ value: 2.02, previous: 2 }), null, 'objective')).toBe(
      'Headline inflation is little changed since the last meeting.',
    )
  })

  it('says so plainly when the release did not arrive', () => {
    expect(plainHeadline(indicator({ missing: true, value: null }), 2, 'objective')).toMatch(
      /did not arrive/,
    )
  })

  it('never emits a broken sentence', () => {
    const cases: IndicatorObservation[] = [
      indicator(),
      indicator({ value: null, previous: null }),
      indicator({ previous: null }),
      indicator({ uncertainty: 0 }),
    ]
    for (const observation of cases) {
      for (const reference of [null, 2]) {
        const sentence = plainHeadline(observation, reference, 'objective')
        expect(sentence).not.toMatch(/undefined|NaN|null/)
        expect(sentence.endsWith('.')).toBe(true)
      }
    }
  })
})

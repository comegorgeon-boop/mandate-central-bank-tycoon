// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { SERIES } from './series.ts'

/**
 * Every published series is a real macroeconomic concept.
 *
 * The player's rule, and the reason for it: everything on these screens should
 * be something they can look up afterwards and find, so that an evening spent
 * here leaves them better at reading a real release rather than fluent in a
 * private vocabulary. The economy is fictional; the *instruments* by which it
 * is measured are not.
 *
 * Three things this found and the build no longer does:
 *
 *   - `equity_index` carried an invented brand, "Meridian 400". Every other
 *     line on the table is a concept with a Wikipedia page; that one asked the
 *     player to learn a ticker that does not exist.
 *   - `employment_growth` was labelled "Employment momentum", which is not
 *     what any statistical agency publishes.
 *   - `credibility_index` and `public_approval` named the *quantity* and not
 *     the instrument, leaving a reader no idea who was being asked. Both
 *     institutions run a Survey of Professional Forecasters and both are
 *     polled on public trust, so both now say so.
 *
 * The one fictional proper noun left in the build is the newspaper's masthead,
 * which is a masthead and not a measure.
 */

/**
 * Names that read as a brand rather than as a measure.
 *
 * A capital letter mid-label that is not an acronym and not the start of a
 * sentence is the tell: real series are named for what they measure, in lower
 * case, and the exceptions are initialisms.
 */
const BRAND_SHAPED = /\b[A-Z][a-z]+ \d{2,4}\b/

/**
 * Words that describe a quantity rather than an instrument that measures one.
 *
 * "Momentum" is the case that prompted this: nothing publishes it, and a
 * player who learned the word here would not find it on a release.
 */
const NOT_A_MEASURE = /\bmomentum\b|\bvibe|\bgauge\b|\bbarometer\b/i

describe('every published series names something real', () => {
  for (const series of SERIES) {
    describe(series.id, () => {
      it('is not named like a brand', () => {
        expect(series.label, series.label).not.toMatch(BRAND_SHAPED)
      })

      it('names a measure rather than a mood', () => {
        expect(series.label, series.label).not.toMatch(NOT_A_MEASURE)
        expect(series.definition, series.id).not.toMatch(NOT_A_MEASURE)
      })

      it('says what it measures, at some length', () => {
        // A label alone is not enough to look something up. Every series
        // carries a definition a reader can take to a real release.
        expect(series.definition.length, series.id).toBeGreaterThan(40)
      })
    })
  }

  it('publishes the concepts the brief named, under those names', () => {
    // Consumer prices, the core measure, the unemployment rate, the output
    // gap, the ten-year yield and spreads: the vocabulary a reader of an
    // actual central bank's release would meet.
    const labels = SERIES.map((series) => series.label.toLowerCase())
    for (const required of [
      'headline inflation',
      'core inflation',
      'unemployment rate',
      'output gap estimate',
      'ten-year government yield',
      'corporate credit spread',
    ]) {
      expect(labels, required).toContain(required)
    }
  })

  it('keeps every survey honest about being one', () => {
    // A survey reported without saying it is a survey is a statistic the
    // player will over-trust. These are the measures with no administrative
    // source behind them at all.
    for (const id of [
      'inflation_expectations',
      'inflation_expectations_1y',
      'consumer_confidence',
      'credibility_index',
      'public_approval',
    ] as const) {
      const series = SERIES.find((entry) => entry.id === id)
      expect(series?.category, id).toBe('survey')
    }
  })
})

// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { ObservationSet } from '../types/observation.ts'
import type { SimulationState } from '../types/state.ts'
import { holds, playWithoutEvents, testConfig } from '../testing/harness.ts'
import { getSeries } from './series.ts'
import { generateObservation } from './generateObservation.ts'

/**
 * The information layer.
 *
 * What the player sees is not what the engine runs on. Statistics arrive
 * late, wrong, and are corrected afterwards; market prices arrive exact.
 * These tests pin down both halves of that contract, and that revisions move
 * toward the truth rather than being fresh noise.
 */

/** What the player would have seen at an earlier meeting of a finished run. */
function observeAt(state: SimulationState, meetingIndex: number): ObservationSet {
  return generateObservation(
    {
      ...state,
      meetingIndex,
      latent: state.history[meetingIndex].latent,
      history: state.history.slice(0, meetingIndex + 1),
    },
    { meetingIndex, newswire: [], clues: [] },
  )
}

const HORIZON = 24
const hardRun = playWithoutEvents(testConfig('fed', 'hard', 'observation'), holds(HORIZON))
const easyRun = playWithoutEvents(testConfig('fed', 'easy', 'observation'), holds(8))

describe('published statistics differ from the latent truth', () => {
  const observation = observeAt(hardRun, HORIZON)

  it('reports a headline inflation figure that is not the true value', () => {
    const indicator = observation.indicators.headline_inflation
    expect(indicator).toBeDefined()
    const period = HORIZON - indicator!.publicationLagMeetings
    const truth = hardRun.history[period].latent.inflationHeadline
    expect(indicator!.value).not.toBe(truth)
  })

  it('disagrees with the truth across many series and many meetings', () => {
    let compared = 0
    let differing = 0

    for (let meeting = 6; meeting <= HORIZON; meeting += 1) {
      const set = observeAt(hardRun, meeting)
      for (const indicator of Object.values(set.indicators)) {
        const series = getSeries(indicator.seriesId)!
        if (series.baseNoiseSd === 0 || indicator.value === null) continue
        const period = meeting - indicator.publicationLagMeetings
        if (period < 0) continue
        compared += 1
        if (indicator.value !== series.read(hardRun.history[period].latent)) {
          differing += 1
        }
      }
    }

    expect(compared).toBeGreaterThan(50)
    expect(differing).toBe(compared)
  })

  it('publishes an older reference period than the current meeting', () => {
    const indicator = observation.indicators.real_growth
    expect(indicator!.publicationLagMeetings).toBeGreaterThan(0)
    // The value shown belongs to an earlier period, not to today.
    const truthToday = hardRun.history[HORIZON].latent.realGrowth
    const truthThen =
      hardRun.history[HORIZON - indicator!.publicationLagMeetings].latent.realGrowth
    expect(truthToday).not.toBe(truthThen)
  })
})

describe('market prices are observed exactly and immediately', () => {
  const observation = observeAt(hardRun, HORIZON)

  it('reports the policy rate, spreads and the currency without error', () => {
    const latent = hardRun.history[HORIZON].latent

    // Market prices carry no measurement error at all. They are still rounded
    // to the precision they are published at, which is not the same thing:
    // the value is exact to the last digit shown.
    const published = (seriesId: 'policy_rate' | 'credit_spread' | 'exchange_rate' | 'market_expected_rate') => {
      const indicator = observation.indicators[seriesId]!
      const truth = getSeries(seriesId)!.read(latent)
      const factor = 10 ** getSeries(seriesId)!.decimals
      return [indicator.value, Math.round(truth * factor) / factor]
    }

    for (const seriesId of [
      'policy_rate',
      'credit_spread',
      'exchange_rate',
      'market_expected_rate',
    ] as const) {
      const [value, truth] = published(seriesId)
      expect(value).toBe(truth)
    }
  })

  it('publishes market data with no lag and no stated uncertainty', () => {
    for (const indicator of Object.values(observation.indicators)) {
      if (getSeries(indicator.seriesId)!.category !== 'market_data') continue
      expect(indicator.publicationLagMeetings).toBe(0)
      expect(indicator.uncertainty).toBe(0)
      expect(indicator.missing).toBe(false)
    }
  })
})

describe('data is revised, and revisions move toward the truth', () => {
  it('publishes corrections to earlier prints', () => {
    let revisions = 0
    for (let meeting = 6; meeting <= HORIZON; meeting += 1) {
      const set = observeAt(hardRun, meeting)
      for (const indicator of Object.values(set.indicators)) {
        if (indicator.revision !== null) revisions += 1
      }
    }
    expect(revisions).toBeGreaterThan(10)
  })

  it('brings the corrected figure closer to the truth on average', () => {
    let firstPrintError = 0
    let revisedError = 0
    let count = 0

    for (let meeting = 6; meeting <= HORIZON; meeting += 1) {
      const set = observeAt(hardRun, meeting)
      for (const indicator of Object.values(set.indicators)) {
        const revision = indicator.revision
        if (revision === null) continue

        const period =
          meeting - indicator.publicationLagMeetings - revision.periodsAgo
        if (period < 0) continue

        const truth = getSeries(indicator.seriesId)!.read(hardRun.history[period].latent)
        firstPrintError += Math.abs(revision.firstPrint - truth)
        revisedError += Math.abs(revision.current - truth)
        count += 1
      }
    }

    expect(count).toBeGreaterThan(10)
    expect(revisedError).toBeLessThan(firstPrintError)
  })

  it('never revises a market price', () => {
    for (let meeting = 6; meeting <= HORIZON; meeting += 1) {
      const set = observeAt(hardRun, meeting)
      for (const indicator of Object.values(set.indicators)) {
        if (getSeries(indicator.seriesId)!.category === 'market_data') {
          expect(indicator.revision).toBeNull()
        }
      }
    }
  })
})

describe('difficulty changes the information problem', () => {
  it('states less uncertainty on easy than on hard', () => {
    const easy = observeAt(easyRun, 8).indicators.headline_inflation!
    const hard = observeAt(hardRun, 8).indicators.headline_inflation!
    expect(easy.uncertainty).toBeLessThan(hard.uncertainty)
  })

  it('publishes sooner on easy than on hard', () => {
    const easy = observeAt(easyRun, 8).indicators.real_growth!
    const hard = observeAt(hardRun, 8).indicators.real_growth!
    expect(easy.publicationLagMeetings).toBeLessThan(hard.publicationLagMeetings)
  })

  it('never drops a release on easy, but sometimes does on hard', () => {
    let easyMissing = 0
    for (let meeting = 3; meeting <= 8; meeting += 1) {
      for (const indicator of Object.values(observeAt(easyRun, meeting).indicators)) {
        if (indicator.missing) easyMissing += 1
      }
    }
    expect(easyMissing).toBe(0)

    let hardMissing = 0
    for (let meeting = 6; meeting <= HORIZON; meeting += 1) {
      for (const indicator of Object.values(observeAt(hardRun, meeting).indicators)) {
        if (indicator.missing) hardMissing += 1
      }
    }
    expect(hardMissing).toBeGreaterThan(0)
  })
})

describe('the observation is a pure function of the run', () => {
  it('reproduces a published print exactly when recomputed', () => {
    expect(observeAt(hardRun, 12)).toEqual(observeAt(hardRun, 12))
  })

  it('does not rewrite a print once it has been published', () => {
    // The value for a given reference period must read the same at the
    // meeting it was released and at every later meeting that still shows it.
    const atRelease = observeAt(hardRun, 12).indicators.headline_inflation!
    const laterTrend = observeAt(hardRun, 13).indicators.headline_inflation!.trend
    expect(laterTrend[laterTrend.length - 2]).toBe(atRelease.value)
  })
})

describe('forecasts are published as ranges, not point certainty', () => {
  const observation = observeAt(hardRun, HORIZON)

  it('orders every fan chart band correctly', () => {
    for (const fan of observation.forecasts) {
      for (const band of fan.bands) {
        expect(band.p10).toBeLessThan(band.p30)
        expect(band.p30).toBeLessThan(band.central)
        expect(band.central).toBeLessThan(band.p70)
        expect(band.p70).toBeLessThan(band.p90)
      }
    }
  })

  it('widens the bands as the horizon lengthens', () => {
    for (const fan of observation.forecasts) {
      for (let i = 1; i < fan.bands.length; i += 1) {
        const previous = fan.bands[i - 1]
        const current = fan.bands[i]
        expect(current.horizonMeetings).toBeGreaterThan(previous.horizonMeetings)
        expect(current.p90 - current.p10).toBeGreaterThan(previous.p90 - previous.p10)
      }
    }
  })

  it('widens the bands with difficulty', () => {
    const easy = observeAt(easyRun, 8).forecasts[0].bands[0]
    const hard = observeAt(hardRun, 8).forecasts[0].bands[0]
    expect(hard.p90 - hard.p10).toBeGreaterThan(easy.p90 - easy.p10)
  })
})

describe('the observation set exposes no latent state', () => {
  it('carries only the documented published fields', () => {
    expect(Object.keys(observeAt(hardRun, HORIZON)).sort()).toEqual([
      'clues',
      'diagnosis',
      'forecasts',
      'indicators',
      'meetingIndex',
      'newswire',
      'taylorBenchmark',
    ])
  })

  it('names the shock on easy and withholds the name on hard', () => {
    expect(observeAt(hardRun, HORIZON).diagnosis).toBeNull()
    const easy = observeAt(easyRun, 8).diagnosis
    expect(easy).not.toBeNull()
    expect(easy!.evidence.length).toBeGreaterThan(0)
  })

  it('publishes no series for a latent variable the player must infer', () => {
    const published = Object.keys(observeAt(hardRun, HORIZON).indicators)
    for (const hidden of [
      'anchoring',
      'credibility',
      'potentialGrowth',
      'naturalUnemployment',
      'supplyShock',
      'demandShock',
    ]) {
      expect(published).not.toContain(hidden)
    }
  })
})

/**
 * The neutral rate is the one structural constant the player is given, because
 * without it the words "restrictive" and "accommodative" have no referent. It
 * is given as an estimate, never as the truth: the run's own r* stays hidden
 * behind a fixed error the player never gets to learn.
 */
describe('the neutral rate reaches the player only as an estimate', () => {
  it('is published, so policy stance can be stated in words', () => {
    expect(observeAt(hardRun, HORIZON).indicators.neutral_rate_estimate?.value).toBeTypeOf(
      'number',
    )
  })

  it('never equals the run’s true neutral rate', () => {
    const estimate = observeAt(hardRun, HORIZON).indicators.neutral_rate_estimate!.value
    expect(estimate).not.toBe(hardRun.latent.neutralRealRate)
  })

  it('holds the same error all run, rather than jittering around the truth', () => {
    const readings = [8, 12, 16, 20, HORIZON].map(
      (meeting) => observeAt(hardRun, meeting).indicators.neutral_rate_estimate!.value,
    )
    expect(new Set(readings).size).toBe(1)
  })

  // The realised error is a single draw and would make a flaky comparison, so
  // this pins the band the player is *told* about, which is deterministic.
  it('declares a far narrower error band on easy than on hard', () => {
    const easyBand = observeAt(easyRun, 8).indicators.neutral_rate_estimate!.uncertainty
    const hardBand = observeAt(hardRun, HORIZON).indicators.neutral_rate_estimate!
      .uncertainty
    expect(easyBand).toBeGreaterThan(0)
    expect(easyBand).toBeLessThan(hardBand)
  })

  it('is never missing, unlike the statistics around it', () => {
    for (let meeting = 0; meeting <= HORIZON; meeting += 1) {
      expect(observeAt(hardRun, meeting).indicators.neutral_rate_estimate?.missing).toBe(
        false,
      )
    }
  })
})

describe('institution-specific series', () => {
  it('publishes the fragmentation spread only for the ECB', () => {
    const ecb = playWithoutEvents(testConfig('ecb', 'hard', 'observation'), holds(8))
    const ecbSet = observeAt(ecb, 8)
    expect(ecbSet.indicators.fragmentation_spread).toBeDefined()
    expect(ecbSet.indicators.regional_bank_stress).toBeUndefined()

    const fedSet = observeAt(hardRun, 8)
    expect(fedSet.indicators.fragmentation_spread).toBeUndefined()
    expect(fedSet.indicators.regional_bank_stress).toBeDefined()
  })

  it('gives the ECB an exact market spread and the Fed a noisy estimate', () => {
    const ecb = playWithoutEvents(testConfig('ecb', 'hard', 'observation'), holds(8))
    expect(observeAt(ecb, 8).indicators.fragmentation_spread!.uncertainty).toBe(0)
    expect(
      observeAt(hardRun, 8).indicators.regional_bank_stress!.uncertainty,
    ).toBeGreaterThan(0)
  })
})

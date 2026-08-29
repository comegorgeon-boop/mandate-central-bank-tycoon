import type {
  ForecastBand,
  ForecastFan,
  IndicatorObservation,
  IndicatorRevision,
  ObservationContext,
  ObservationSet,
  SeriesDefinition,
  SeriesId,
} from '../types/observation.ts'
import type { SimulationState } from '../types/state.ts'
import type { DifficultyConfig } from '../config/difficulty.ts'
import { hashGaussian, hashUnit } from '../rng/prng.ts'
import { getDifficulty } from '../config/difficulty.ts'
import { getInstitution } from '../config/institutions.ts'
import { YEARS_PER_MEETING } from '../config/time.ts'
import { taylorBenchmark } from '../engine/indices.ts'
import { runSeedString } from '../engine/initialState.ts'
import { FORECAST_SERIES, getSeries, seriesFor } from './series.ts'

/**
 * The observation layer: everything the player is allowed to see.
 *
 * This is the only bridge between the latent economy and the interface, and
 * it is deliberately lossy. Statistical releases arrive late, carry
 * measurement error, and are revised afterwards; market prices arrive exact
 * and immediate.
 *
 * All noise is drawn from stateless hash-based generators keyed by
 * (run seed, series, reference period, vintage). That makes the whole
 * function pure: recomputing an observation for an earlier meeting always
 * reproduces exactly the numbers the player saw at the time, and a first
 * print never silently changes once it has been published.
 */

/** Published vintages kept for the trend sparkline. */
const TREND_LENGTH = 6

/** Standard normal quantiles for the fan chart bands. */
const Z_10 = 1.2816
const Z_30 = 0.5244

/** Effective publication lag, after the easy-mode relief. */
function effectiveLag(
  series: SeriesDefinition,
  difficulty: DifficultyConfig,
): number {
  return Math.max(0, series.publicationLagMeetings - difficulty.publicationLagRelief)
}

/** Whether a reference period has been revised by the time of `meetingIndex`. */
function vintageOf(
  series: SeriesDefinition,
  referencePeriod: number,
  meetingIndex: number,
  lag: number,
): number {
  if (series.revisionLagMeetings <= 0) return 0
  const revisedAt = referencePeriod + lag + series.revisionLagMeetings
  return meetingIndex >= revisedAt ? 1 : 0
}

/**
 * The value published for one reference period at one vintage.
 *
 * The first print carries both measurement noise and a revision bias; the
 * revised print carries only a much smaller residual noise. The revision the
 * player observes is the difference between the two, which is what makes
 * revisions feel like corrections rather than fresh random numbers.
 */
function publishedValue(
  state: SimulationState,
  series: SeriesDefinition,
  referencePeriod: number,
  vintage: number,
  difficulty: DifficultyConfig,
  seed: string,
): number | null {
  const snapshot = state.history[referencePeriod]
  if (!snapshot) return null

  const truth = series.read(snapshot.latent)
  if (series.baseNoiseSd === 0 && series.baseRevisionSd === 0) return truth

  const noiseSd =
    series.baseNoiseSd * difficulty.observationNoiseScale * (vintage === 0 ? 1 : 0.3)
  const noise = hashGaussian(0, noiseSd, seed, 'noise', series.id, referencePeriod, vintage)

  const bias =
    vintage === 0
      ? hashGaussian(
          0,
          series.baseRevisionSd * difficulty.revisionScale,
          seed,
          'bias',
          series.id,
          referencePeriod,
        )
      : 0

  return truth + noise + bias
}

/** Whether a given release is simply missing this time. */
function isMissing(
  series: SeriesDefinition,
  referencePeriod: number,
  difficulty: DifficultyConfig,
  seed: string,
): boolean {
  // A market price is always there. Only statistics and estimates go missing.
  if (series.category === 'market_data') return false
  if (difficulty.missingObservationProbability <= 0) return false
  return (
    hashUnit(seed, 'missing', series.id, referencePeriod) <
    difficulty.missingObservationProbability
  )
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function observeSeries(
  state: SimulationState,
  series: SeriesDefinition,
  difficulty: DifficultyConfig,
  seed: string,
): IndicatorObservation {
  const meetingIndex = state.meetingIndex
  const lag = effectiveLag(series, difficulty)
  const currentPeriod = meetingIndex - lag

  const readAt = (period: number): number | null => {
    if (period < 0) return null
    if (isMissing(series, period, difficulty, seed)) return null
    const vintage = vintageOf(series, period, meetingIndex, lag)
    const value = publishedValue(state, series, period, vintage, difficulty, seed)
    return value === null ? null : round(value, series.decimals)
  }

  const value = readAt(currentPeriod)
  const previousPeriod = currentPeriod - 1
  const previous = readAt(previousPeriod)

  // A period cannot be revised before it has been published, so the reading
  // that gets corrected is always an earlier one: exactly `revisionLag`
  // periods back from the current slot. Showing the first print next to the
  // corrected one lets the player see the size of the correction, not just
  // its result.
  let revision: IndicatorRevision | null = null
  const revisedPeriod = currentPeriod - series.revisionLagMeetings
  if (
    series.revisionLagMeetings > 0 &&
    revisedPeriod >= 0 &&
    vintageOf(series, revisedPeriod, meetingIndex, lag) > 0 &&
    !isMissing(series, revisedPeriod, difficulty, seed)
  ) {
    const firstPrint = publishedValue(state, series, revisedPeriod, 0, difficulty, seed)
    const current = publishedValue(state, series, revisedPeriod, 1, difficulty, seed)
    if (firstPrint !== null && current !== null) {
      const roundedFirst = round(firstPrint, series.decimals)
      const roundedCurrent = round(current, series.decimals)
      if (roundedFirst !== roundedCurrent) {
        revision = {
          periodsAgo: series.revisionLagMeetings,
          firstPrint: roundedFirst,
          current: roundedCurrent,
        }
      }
    }
  }

  const trend: (number | null)[] = []
  for (let back = TREND_LENGTH - 1; back >= 0; back -= 1) {
    trend.push(readAt(currentPeriod - back))
  }

  return {
    seriesId: series.id,
    label: series.label,
    unit: series.unit,
    definition: series.definition,
    category: series.category,
    value,
    previous,
    revision,
    publicationLagMeetings: lag,
    trend,
    uncertainty: round(
      series.baseNoiseSd * difficulty.observationNoiseScale,
      Math.max(2, series.decimals),
    ),
    missing: value === null,
  }
}

/**
 * Staff projections, published as fan charts rather than point estimates.
 *
 * The central path is a simple mean-reverting projection — inflation back to
 * target, unemployment back to its natural rate, the gap back to zero — with
 * a deterministic bias, because a staff forecast is not the model's own path.
 * Bands widen with the square root of the horizon and with difficulty.
 */
function buildForecast(
  state: SimulationState,
  seriesId: SeriesId,
  difficulty: DifficultyConfig,
  seed: string,
): ForecastFan | null {
  const series = getSeries(seriesId)
  if (!series) return null

  const target = getInstitution(state.config.institution).inflationTarget
  const latent = state.latent
  const horizons = [2, 4, 8]

  const bands: ForecastBand[] = horizons.map((horizon) => {
    const years = horizon * YEARS_PER_MEETING

    let central: number
    let baseSd: number
    switch (seriesId) {
      case 'headline_inflation': {
        const decay = 1 - Math.exp(-0.6 * years)
        central = latent.inflationHeadline + (target - latent.inflationHeadline) * decay
        baseSd = 0.55
        break
      }
      case 'unemployment': {
        const decay = 1 - Math.exp(-1.0 * years)
        central =
          latent.unemployment + (latent.naturalUnemployment - latent.unemployment) * decay
        baseSd = 0.35
        break
      }
      default: {
        central = latent.outputGap * Math.exp(-0.55 * years)
        baseSd = 0.8
        break
      }
    }

    // Staff forecasts have their own persistent bias, not fresh noise per band.
    central += hashGaussian(0, baseSd * 0.4, seed, 'forecast', seriesId, state.meetingIndex)

    const sd = baseSd * Math.sqrt(years) * difficulty.forecastUncertaintyScale
    return {
      horizonMeetings: horizon,
      central: round(central, 2),
      p10: round(central - Z_10 * sd, 2),
      p30: round(central - Z_30 * sd, 2),
      p70: round(central + Z_30 * sd, 2),
      p90: round(central + Z_10 * sd, 2),
    }
  })

  return { seriesId, label: series.label, bands }
}

export function generateObservation(
  state: SimulationState,
  context: ObservationContext,
): ObservationSet {
  const difficulty = getDifficulty(state.config.difficulty)
  const seed = runSeedString(state.config)

  const indicators: Partial<Record<SeriesId, IndicatorObservation>> = {}
  for (const series of seriesFor(state.config.institution)) {
    indicators[series.id] = observeSeries(state, series, difficulty, seed)
  }

  const forecasts: ForecastFan[] = []
  for (const seriesId of FORECAST_SERIES) {
    const fan = buildForecast(state, seriesId, difficulty, seed)
    if (fan) forecasts.push(fan)
  }

  return {
    meetingIndex: context.meetingIndex,
    indicators,
    forecasts,
    newswire: context.newswire,
    clues: context.clues,
    taylorBenchmark: round(
      taylorBenchmark(state.latent, state.config.institution),
      2,
    ),
  }
}

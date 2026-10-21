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
import type { LatentState, SimulationState } from '../types/state.ts'
import type { DifficultyConfig } from '../config/difficulty.ts'
import { hashGaussian, hashUnit } from '../rng/prng.ts'
import { MEETINGS_PER_YEAR, YEARS_PER_MEETING } from '../config/time.ts'
import { inflationTargetFor, measurementRegime, scenarioOf } from '../scenarios/scenarios.ts'
import { taylorBenchmark } from '../engine/indices.ts'
import { runSeedString } from '../engine/initialState.ts'
import { FORECAST_SERIES, getSeries, seriesFor } from './series.ts'
import { diagnoseShock } from './diagnose.ts'
import { observeMembers } from './memberObservation.ts'

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

/**
 * Published vintages kept for the trend chart.
 *
 * The whole mandate, because in macroeconomics the direction of travel carries
 * more than the level: a single number shows no trend at all, and a window
 * shorter than the mandate hides the turn the player is being judged on.
 * Periods before the run opened come back as nulls and simply do not plot.
 */
function trendLength(state: SimulationState): number {
  return state.config.meetingCount + 1
}

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
 * What a historical statistical system got systematically wrong.
 *
 * Distinct from noise, which averages out and which a player can learn to
 * discount, and distinct from a revision, which is eventually corrected. This
 * is a *bias*: the published number is wrong in one direction and stays wrong,
 * and nobody at the time knows by how much.
 *
 * Two kinds, both sourced in `docs/SCENARIOS.md`:
 *
 * - a **constant** offset, which is the real-time output gap in 1979-83. It
 *   read about 3.6 points more negative than it was, so every rule that
 *   responds to the gap asked for an easier policy than the situation
 *   required. That is Orphanides's argument about the Great Inflation, and
 *   here it is arithmetic rather than a paragraph.
 *
 * - a **pass-through from the policy rate**, which is the CPI before January
 *   1983. The index included mortgage interest costs, so tightening raised the
 *   measure the Fed was judged on. You could make your own number worse by
 *   doing your job, and for three years you could not see which part of the
 *   print was that.
 */
function historicalBias(
  state: SimulationState,
  series: SeriesDefinition,
  referencePeriod: number,
): number {
  const scenario = scenarioOf(state.config)
  if (scenario === null) return 0
  const { measurement } = scenario

  let bias = measurement.seriesBias[series.id] ?? 0

  if (
    series.id === 'headline_inflation' &&
    measurement.ratePassThrough !== 0 &&
    state.meetingIndex < measurement.ratePassThroughEndsAt
  ) {
    const now = state.history[referencePeriod]
    const yearAgo = state.history[referencePeriod - MEETINGS_PER_YEAR]
    if (now !== undefined && yearAgo !== undefined) {
      bias +=
        measurement.ratePassThrough * (now.latent.policyRate - yearAgo.latent.policyRate)
    }
  }

  return bias
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

  const truth = series.read(snapshot.latent) + historicalBias(state, series, referencePeriod)
  if (series.baseNoiseSd === 0 && series.baseRevisionSd === 0) return truth

  const noiseSd =
    series.baseNoiseSd * difficulty.observationNoiseScale * (vintage === 0 ? 1 : 0.3)
  // A persistent error is drawn once for the run, so every period of the
  // series is wrong by the same unknown amount rather than jittering.
  const noisePeriod = series.persistentError === true ? 0 : referencePeriod
  const noise = hashGaussian(0, noiseSd, seed, 'noise', series.id, noisePeriod, vintage)

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

/**
 * The two readings the mandate is about, which the opening always publishes.
 *
 * Everything else may be missing from the first meeting. These may not.
 */
const MANDATE_SERIES: readonly string[] = [
  'headline_inflation',
  'core_inflation',
  'unemployment',
]

/** Meetings at the start of a mandate during which nothing essential is absent. */
const GRACE_MEETINGS = 3

/**
 * How much more likely a release is to be missing when the economy is moving.
 *
 * Multiplies the difficulty's base probability at a full head of turbulence.
 */
const TURBULENCE_MULTIPLIER = 2.5

/**
 * Whether a given release is simply missing this time.
 *
 * ## The opening always has its figures
 *
 * > "À chaque début de partie on me dit « this release did not arrive in time
 * > for the meeting ». Du coup je ne comprends même pas l'économie dont
 * > j'hérite, et ça ajoute du flou là où il en faut le moins."
 *
 * A missing release is a good mechanic in the wrong place. At the opening the
 * player has no history to fall back on, no feel for the economy and nothing
 * to compare against — so an absent inflation print is not a hard decision,
 * it is a player who cannot read the board they were handed. For the first
 * three meetings the two readings the mandate is *about* are always there.
 *
 * ## And it is likelier when the economy is moving
 *
 * > "Rends-le plus probable QUAND L'ÉCONOMIE BOUGE VITE, parce que c'est
 * > vrai : les erreurs des instituts en temps réel sont les plus grandes aux
 * > points de retournement. C'est le problème d'Orphanides."
 *
 * Which is the finding this whole engine's measurement regime is built on —
 * Orphanides showed the real-time output gap was wrong by three points in the
 * mid-seventies, and wrong *worst* at the turning points, because that is
 * where a statistical agency has least signal and most revision ahead of it.
 *
 * So the probability now scales with how fast the economy is moving. The
 * effect is that the figure goes missing at the moment it would have been
 * most useful, which is both true and a far better moment of play than a fog
 * at the start.
 */
function isMissing(
  series: SeriesDefinition,
  referencePeriod: number,
  difficulty: DifficultyConfig,
  seed: string,
  meetingIndex: number,
  turbulence: number,
): boolean {
  // A market price is always there. Only statistics and estimates go missing.
  if (series.category === 'market_data') return false
  // A standing structural estimate is always on the table: it is carried over
  // from the last review rather than re-published each meeting.
  if (series.persistentError === true) return false
  if (difficulty.missingObservationProbability <= 0) return false
  // The opening grace: the mandate's own two readings are always published
  // while the player is still learning what they inherited.
  if (meetingIndex < GRACE_MEETINGS && MANDATE_SERIES.includes(series.id)) return false

  const probability = Math.min(
    0.9,
    difficulty.missingObservationProbability *
      (1 + (TURBULENCE_MULTIPLIER - 1) * turbulence),
  )
  return hashUnit(seed, 'missing', series.id, referencePeriod) < probability
}

/**
 * How fast the economy is moving, 0 to 1.
 *
 * Read off the two readings an agency would be revising: a quarter where
 * inflation and unemployment are both lurching is a quarter where the first
 * print is least likely to survive contact with the second.
 */
function turbulenceOf(state: SimulationState): number {
  const history = state.history
  if (history.length < 2) return 0
  const now = history[history.length - 1].latent
  const before = history[history.length - 2].latent
  const movement =
    Math.abs(now.inflationHeadline - before.inflationHeadline) +
    Math.abs(now.unemployment - before.unemployment) * 0.8
  // A point of combined movement in one meeting is a fast quarter.
  return Math.min(1, movement / 1.0)
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
  const turbulence = turbulenceOf(state)
  const lag = effectiveLag(series, difficulty)
  const currentPeriod = meetingIndex - lag

  /*
   * The mandate's own readings exist from the first meeting.
   *
   * > "À chaque début de partie on me dit « this release did not arrive in
   * > time for the meeting »."
   *
   * The grace period in `isMissing` was not enough, because at the opening
   * the figure is not *missing* — it has never been published. With a
   * publication lag of one or two meetings, `meetingIndex − lag` is negative
   * at meeting zero and there is no period to read at all.
   *
   * So for the two readings the mandate is about, the first meetings read
   * the opening state rather than a period that does not exist. That is also
   * what a real committee has: it inherits a published history, it does not
   * take office in a statistical vacuum. Every other series still arrives on
   * its own schedule, and the lag is still the lag.
   */
  const essential = meetingIndex < GRACE_MEETINGS && MANDATE_SERIES.includes(series.id)

  const readAt = (period: number): number | null => {
    if (period < 0 && essential) period = 0
    if (period < 0) return null
    if (isMissing(series, period, difficulty, seed, meetingIndex, turbulence)) {
      return null
    }
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
    !isMissing(series, revisedPeriod, difficulty, seed, meetingIndex, turbulence)
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
  for (let back = trendLength(state) - 1; back >= 0; back -= 1) {
    trend.push(readAt(currentPeriod - back))
  }

  return {
    seriesId: series.id,
    label: series.label,
    unit: series.unit,
    definition: series.definition,
    meaning: series.meaning,
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

  const target = inflationTargetFor(state.config)
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

/**
 * The latent state as the published statistics described it.
 *
 * Only the biased series differ, and only in a scenario that declares one: an
 * ordinary mandate gets the latent state back unchanged. It exists so that
 * anything derived from the *table* — the Taylor ghost on the rate slider
 * above all — is derived from the numbers the player can actually see.
 */
function asPublished(state: SimulationState): LatentState {
  const scenario = scenarioOf(state.config)
  if (scenario === null) return state.latent
  const gapBias = scenario.measurement.seriesBias.output_gap_estimate ?? 0
  const headlineBias = historicalBias(
    state,
    getSeries('headline_inflation')!,
    state.meetingIndex,
  )
  return {
    ...state.latent,
    outputGap: state.latent.outputGap + gapBias,
    inflationHeadline: state.latent.inflationHeadline + headlineBias,
  }
}

export function generateObservation(
  state: SimulationState,
  context: ObservationContext,
): ObservationSet {
  // The measurement regime is the difficulty's, or — in a historical mandate —
  // the year's. See `scenarios/scenarios.ts`: this is the whole of "difficulty
  // is what was known at the time".
  const difficulty = measurementRegime(state.config)
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

  const published: ObservationSet = {
    meetingIndex: context.meetingIndex,
    indicators,
    forecasts,
    newswire: context.newswire,
    clues: context.clues,
    // The rule of thumb reads the published table, not the truth — which is
    // the whole of Orphanides's point about this period and would be invisible
    // if the ghost on the slider were computed from the latent state. In an
    // ordinary mandate the two are the same, because there is no bias to apply.
    taylorBenchmark: round(
      taylorBenchmark(
        asPublished(state),
        state.config.institution,
        inflationTargetFor(state.config),
      ),
      2,
    ),
    diagnosis: null,
    area: observeMembers(state, difficulty, seed),
  }

  // The diagnosis reads the latent state to identify the shock, so it is built
  // last, from the published set, and only where the difficulty allows it.
  //
  // The two halves are gated separately, and used not to be. `namesShocks`
  // alone decided whether the whole panel existed, so medium — which
  // docs/BALANCE.md's own information ladder describes as "shock not named,
  // evidence still shown" — was in fact getting neither. The evidence is what
  // survives down the ladder; the name is what is withdrawn.
  if (!difficulty.namesShocks && !difficulty.showsShockEvidence) return published
  return {
    ...published,
    diagnosis: diagnoseShock(state.latent, published, state.config.institution, {
      named: difficulty.namesShocks,
    }),
  }
}

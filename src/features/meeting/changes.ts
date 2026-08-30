import {
  getInstitution,
  readStanceChange,
  type Institution,
  type ObservationSet,
  type SeriesId,
} from '../../simulation/index.ts'

/**
 * What changed since the previous meeting.
 *
 * The rule this file exists to enforce: **no meeting is informationally
 * empty**. A turn where nothing visibly moved is a dead turn, and two dead
 * turns in a row are enough to lose a player.
 *
 * The economy always gives us something, because it runs at two speeds. The
 * slow channel — inflation, unemployment, employment — takes quarters to
 * respond, so on many meetings it genuinely has not moved. The fast channel
 * has: markets reprice the moment a decision lands, expectations shift, the
 * staff forecast is rebuilt from the new state, and fresh statistics arrive
 * describing periods the player had not yet seen. So even the quietest meeting
 * has a story, and this assembles it in a fixed priority order.
 *
 * Two guarantees, both tested:
 *   - at least three entries, always;
 *   - at least one that follows from the player's own last decision.
 *
 * Everything is built from the published observation sets by fixed templates.
 * No randomness, no model, no latent state.
 */

export type ChangeSource =
  | 'decision'
  | 'markets'
  | 'expectations'
  | 'forecast'
  | 'data'
  | 'revision'

export interface ChangeItem {
  readonly id: string
  readonly source: ChangeSource
  readonly headline: string
  readonly detail: string
}

/** Entries shown at the head of a meeting. */
export const MAX_CHANGES = 5
export const MIN_CHANGES = 3

/**
 * How big a move has to be, per series, before it is worth a line.
 *
 * Used only to rank: a move is scored as a multiple of its own threshold, so
 * a 20bp repricing of the rate path and a 0.4pp jump in inflation can be
 * compared honestly rather than by the size of their raw numbers.
 */
const NOTEWORTHY: Partial<Record<SeriesId, number>> = {
  headline_inflation: 0.2,
  core_inflation: 0.15,
  inflation_expectations: 0.1,
  inflation_expectations_1y: 0.15,
  unemployment: 0.1,
  employment_growth: 0.4,
  wage_growth: 0.3,
  real_growth: 0.5,
  output_gap_estimate: 0.4,
  consumer_confidence: 2.0,
  market_expected_rate: 0.1,
  credit_spread: 0.08,
  exchange_rate: 0.8,
  asset_valuation: 2.0,
  bank_stress_proxy: 3.0,
  import_prices: 1.0,
  fragmentation_spread: 15,
  regional_bank_stress: 3.0,
}

const SOURCE_OF: Partial<Record<SeriesId, ChangeSource>> = {
  market_expected_rate: 'markets',
  credit_spread: 'markets',
  exchange_rate: 'markets',
  asset_valuation: 'markets',
  fragmentation_spread: 'markets',
  inflation_expectations: 'expectations',
  inflation_expectations_1y: 'expectations',
}

interface Candidate extends ChangeItem {
  /** Size of the move as a multiple of what counts as noteworthy for it. */
  readonly weight: number
}

function reading(observation: ObservationSet, id: SeriesId): number | null {
  return observation.indicators[id]?.value ?? null
}

function signedBp(percentagePoints: number): string {
  const bp = Math.round(percentagePoints * 100)
  return `${bp > 0 ? '+' : '−'}${Math.abs(bp)} bp`
}

/**
 * The entry that follows from the player's own decision.
 *
 * Guaranteed whenever there is a previous meeting to compare against, because
 * "did what I did land?" is the question the player brings to the table, and a
 * brief that cannot answer it is the brief that made the last playthrough feel
 * inert.
 */
function decisionChange(
  current: ObservationSet,
  previous: ObservationSet,
): ChangeItem | null {
  const stance = readStanceChange(current, previous)
  if (stance === null) return null

  if (stance.contradictory) {
    return {
      id: 'decision_reversed',
      source: 'decision',
      headline:
        stance.nominal > 0
          ? `Your ${signedBp(stance.nominal)} rise left policy looser, not tighter`
          : `Your ${signedBp(stance.nominal)} cut left policy tighter, not looser`,
      detail:
        `Expected inflation moved ${signedBp(stance.expectations)} against a ` +
        `${signedBp(stance.nominal)} move in the rate, so the real rate ended ` +
        `${signedBp(stance.real)}. The stance follows the real rate, not the nominal one.`,
    }
  }

  if (stance.nominal !== 0) {
    const share = Math.abs(stance.expectations / stance.nominal)
    return {
      id: 'decision_landed',
      source: 'decision',
      headline: `Your ${signedBp(stance.nominal)} decision moved the real rate ${signedBp(stance.real)}`,
      detail:
        share >= 0.4
          ? `Expected inflation moved ${signedBp(stance.expectations)} at the same time, ` +
            `absorbing most of the decision. What reaches the economy is the ` +
            `${signedBp(stance.real)} left over.`
          : `Expected inflation moved only ${signedBp(stance.expectations)}, so almost ` +
            'all of the decision reached the real rate.',
    }
  }

  return {
    id: 'decision_hold',
    source: 'decision',
    headline:
      Math.abs(stance.real) < 0.02
        ? 'You held, and the stance held with you'
        : `You held, and the stance drifted ${signedBp(stance.real)} on its own`,
    detail:
      `Expected inflation moved ${signedBp(stance.expectations)} under an unchanged ` +
      'rate. A hold is not a neutral act: the stance moves whenever expectations do, ' +
      'and the effects of earlier decisions keep arriving throughout.',
  }
}

/** Moves in the published series, ranked against their own noteworthy scale. */
function seriesChanges(current: ObservationSet, previous: ObservationSet): Candidate[] {
  const candidates: Candidate[] = []

  for (const [id, threshold] of Object.entries(NOTEWORTHY) as [SeriesId, number][]) {
    const indicator = current.indicators[id]
    if (indicator === undefined) continue

    const now = reading(current, id)
    const before = reading(previous, id)
    if (now === null || before === null) continue

    const change = now - before
    const weight = Math.abs(change) / threshold
    if (weight < 1) continue

    const decimals = indicator.value !== null && Math.abs(indicator.value) >= 100 ? 0 : 2
    const direction = change > 0 ? 'rose' : 'fell'

    candidates.push({
      id: `series_${id}`,
      source: SOURCE_OF[id] ?? 'data',
      weight,
      headline:
        `${indicator.label} ${direction} to ${now.toFixed(decimals)} ${indicator.unit}`,
      detail:
        `A move of ${Math.abs(change).toFixed(decimals)} ${indicator.unit} since the ` +
        `last meeting. ${indicator.meaning}`,
    })
  }

  return candidates
}

/**
 * The staff forecast, which deforms the moment policy changes.
 *
 * This is the channel that makes a long transmission lag playable at all: the
 * published present has not moved, but the projected path has, and it moved
 * because of the decision just taken.
 */
function forecastChange(
  current: ObservationSet,
  previous: ObservationSet,
  institution: Institution,
): Candidate | null {
  const now = current.forecasts.find((fan) => fan.seriesId === 'headline_inflation')
  const before = previous.forecasts.find((fan) => fan.seriesId === 'headline_inflation')
  const nowBand = now?.bands.at(-1)
  const beforeBand = before?.bands.at(-1)
  if (nowBand === undefined || beforeBand === undefined) return null

  const change = nowBand.central - beforeBand.central
  if (Math.abs(change) < 0.05) return null

  const target = getInstitution(institution).inflationTarget
  const distance = nowBand.central - target

  return {
    id: 'forecast_shift',
    source: 'forecast',
    weight: Math.abs(change) / 0.1,
    headline:
      `The staff projection for inflation ${change > 0 ? 'rose' : 'fell'} to ` +
      `${nowBand.central.toFixed(2)} % at ${nowBand.horizonMeetings} meetings`,
    detail:
      `Moved ${Math.abs(change).toFixed(2)} pp since the last meeting, and now sits ` +
      `${Math.abs(distance).toFixed(2)} pp ${distance >= 0 ? 'above' : 'below'} the ` +
      `${target.toFixed(1)} % objective. The forecast reacts to a decision immediately, ` +
      'long before the published data can.',
  }
}

/** A correction to an earlier print: the ground the last decision stood on moved. */
function revisionChanges(current: ObservationSet): Candidate[] {
  const candidates: Candidate[] = []

  for (const indicator of Object.values(current.indicators)) {
    const revision = indicator.revision
    if (revision === null) continue
    const size = Math.abs(revision.current - revision.firstPrint)
    const threshold = NOTEWORTHY[indicator.seriesId] ?? 0.2
    if (size < threshold) continue

    candidates.push({
      id: `revision_${indicator.seriesId}`,
      source: 'revision',
      weight: size / threshold,
      headline: `${indicator.label} was revised for an earlier period`,
      detail:
        `The reading ${revision.periodsAgo} period` +
        `${revision.periodsAgo === 1 ? '' : 's'} back was first published at ` +
        `${revision.firstPrint.toFixed(2)} and now reads ${revision.current.toFixed(2)}. ` +
        'Earlier decisions were taken against the first print.',
    })
  }

  return candidates
}

/**
 * Filler that is still information.
 *
 * Reached only when the fast channels genuinely produced nothing above their
 * thresholds. These state where things stand rather than what moved, which is
 * a weaker kind of entry — but it is never padding, and it keeps the floor of
 * three from being met with silence.
 */
function standingFacts(
  current: ObservationSet,
  institution: Institution,
): readonly ChangeItem[] {
  const facts: ChangeItem[] = []
  const target = getInstitution(institution).inflationTarget

  const policyRate = reading(current, 'policy_rate')
  if (policyRate !== null) {
    const gap = current.taylorBenchmark - policyRate
    facts.push({
      id: 'standing_benchmark',
      source: 'markets',
      headline: `A rule-of-thumb benchmark sits ${signedBp(gap)} from your rate`,
      detail:
        `The benchmark reads ${current.taylorBenchmark.toFixed(2)} % against your ` +
        `${policyRate.toFixed(2)} %. It is a reference point for comparison, not a ` +
        'recommendation, and it accounts for nothing beyond inflation and the gap.',
    })
  }

  const headline = reading(current, 'headline_inflation')
  if (headline !== null) {
    const gap = headline - target
    facts.push({
      id: 'standing_inflation',
      source: 'data',
      headline:
        Math.abs(gap) < 0.1
          ? `Inflation is at the ${target.toFixed(1)} % objective`
          : `Inflation is ${Math.abs(gap).toFixed(2)} pp ${gap > 0 ? 'above' : 'below'} the objective`,
      detail:
        `The latest print reads ${headline.toFixed(2)} %, and it describes a period ` +
        'already past. Policy set today reaches the economy well after it.',
    })
  }

  const marketRate = reading(current, 'market_expected_rate')
  if (marketRate !== null && policyRate !== null) {
    const priced = marketRate - policyRate
    facts.push({
      id: 'standing_priced_path',
      source: 'markets',
      headline:
        Math.abs(priced) < 0.1
          ? 'Markets price no material change over the coming year'
          : `Markets price ${signedBp(priced)} of ${priced > 0 ? 'tightening' : 'easing'} over the coming year`,
      detail:
        `The one-year implied rate is ${marketRate.toFixed(2)} %. Meeting that path ` +
        'surprises nobody; departing from it moves financial conditions the same day.',
    })
  }

  return facts
}

/**
 * The opening position, for the first meeting of a mandate.
 *
 * There is no previous decision to trace and nothing has moved yet, so the
 * brief describes the economy the player has inherited instead.
 */
function openingPosition(
  current: ObservationSet,
  institution: Institution,
): readonly ChangeItem[] {
  const opening: ChangeItem[] = [
    {
      id: 'opening_mandate',
      source: 'decision',
      headline: 'Your mandate opens here',
      detail:
        'Nothing on the table yet reflects a decision of yours. From the next ' +
        'meeting on, this panel leads with what your decision did.',
    },
  ]
  return [...opening, ...standingFacts(current, institution)].slice(0, MAX_CHANGES)
}

export function buildChanges(
  current: ObservationSet,
  previous: ObservationSet | null,
  institution: Institution,
): readonly ChangeItem[] {
  if (previous === null) return openingPosition(current, institution)

  const ranked: Candidate[] = [
    ...seriesChanges(current, previous),
    ...revisionChanges(current),
  ]
  const forecast = forecastChange(current, previous, institution)
  if (forecast !== null) ranked.push(forecast)

  ranked.sort((a, b) => b.weight - a.weight)

  // The decision always leads: it is the entry the player came for.
  const decision = decisionChange(current, previous)
  const items: ChangeItem[] = decision === null ? [] : [decision]

  for (const candidate of ranked) {
    if (items.length >= MAX_CHANGES) break
    items.push({
      id: candidate.id,
      source: candidate.source,
      headline: candidate.headline,
      detail: candidate.detail,
    })
  }

  // The floor. If the fast channels were quiet, say where things stand rather
  // than hand the player a meeting that looks like nothing happened.
  if (items.length < MIN_CHANGES) {
    const seen = new Set(items.map((item) => item.id))
    for (const fact of standingFacts(current, institution)) {
      if (items.length >= MIN_CHANGES) break
      if (seen.has(fact.id)) continue
      items.push(fact)
    }
  }

  return items.slice(0, MAX_CHANGES)
}

import {
  getInstitution,
  type EndConditionResult,
  type Institution,
  type ObservationSet,
  type SeriesId,
} from '../../simulation/index.ts'

/**
 * The Meeting Brief: the five developments that matter most, and the
 * questions the committee has not settled.
 *
 * Everything here is assembled from the observation set the engine published
 * for this meeting — never from the latent state — using fixed templates and
 * a fixed priority order. No randomness, no model: the same observation
 * always produces the same brief.
 */

export type BriefKind = 'warning' | 'news' | 'signal' | 'data'

export interface BriefItem {
  readonly id: string
  readonly kind: BriefKind
  readonly headline: string
  readonly detail: string
}

export interface MeetingBrief {
  readonly developments: readonly BriefItem[]
  readonly questions: readonly string[]
}

/** The brief is deliberately short: five items, as the specification asks. */
export const MAX_DEVELOPMENTS = 5

function value(observation: ObservationSet, id: SeriesId): number | null {
  return observation.indicators[id]?.value ?? null
}

function previous(observation: ObservationSet, id: SeriesId): number | null {
  return observation.indicators[id]?.previous ?? null
}

/** Rounds a percentage-point difference to whole basis points. */
function basisPoints(percentagePoints: number): number {
  return Math.round(percentagePoints * 100)
}

/**
 * Developments derived from the published numbers themselves.
 *
 * Each test has a threshold below which the movement is not worth the
 * player's attention, so a quiet meeting produces a short brief rather than
 * five sentences of noise.
 */
function dataDevelopments(
  observation: ObservationSet,
  institution: Institution,
): readonly BriefItem[] {
  const target = getInstitution(institution).inflationTarget
  const items: BriefItem[] = []

  const headline = value(observation, 'headline_inflation')
  const core = value(observation, 'core_inflation')
  if (headline !== null) {
    const gap = headline - target
    if (Math.abs(gap) >= 0.3) {
      items.push({
        id: 'inflation_gap',
        kind: 'data',
        headline: `Inflation is ${gap > 0 ? 'above' : 'below'} the ${target.toFixed(1)} % objective`,
        detail:
          `Headline inflation printed at ${headline.toFixed(2)} %, ` +
          `${Math.abs(gap).toFixed(2)} pp ${gap > 0 ? 'above' : 'below'} the objective` +
          (core === null ? '.' : `, with core at ${core.toFixed(2)} %.`),
      })
    }
  }

  const unemployment = value(observation, 'unemployment')
  const unemploymentPrev = previous(observation, 'unemployment')
  if (unemployment !== null && unemploymentPrev !== null) {
    const change = unemployment - unemploymentPrev
    if (Math.abs(change) >= 0.1) {
      items.push({
        id: 'labour_turn',
        kind: 'data',
        headline: `Unemployment ${change > 0 ? 'rose' : 'fell'} to ${unemployment.toFixed(2)} %`,
        detail:
          `A move of ${Math.abs(change).toFixed(2)} pp on the published series. ` +
          'Unemployment turns slowly, so a sustained move here reflects a change ' +
          'in demand that began several months ago.',
      })
    }
  }

  const policyRate = value(observation, 'policy_rate')
  const marketRate = value(observation, 'market_expected_rate')
  if (policyRate !== null && marketRate !== null) {
    const priced = basisPoints(marketRate - policyRate)
    if (Math.abs(priced) >= 15) {
      items.push({
        id: 'market_pricing',
        kind: 'signal',
        headline: `Markets price ${Math.abs(priced)} bp of ${priced > 0 ? 'tightening' : 'easing'} over the coming year`,
        detail:
          `The one-year implied rate sits at ${marketRate.toFixed(2)} % against a ` +
          `policy rate of ${policyRate.toFixed(2)} %. Meeting that path surprises ` +
          'nobody; departing from it moves financial conditions on the day.',
      })
    }
  }

  const wages = value(observation, 'wage_growth')
  if (wages !== null && wages >= target + 2) {
    items.push({
      id: 'wage_pressure',
      kind: 'data',
      headline: `Wage growth is running at ${wages.toFixed(2)} %`,
      detail:
        'Above the pace that trend productivity and the inflation objective ' +
        'together can absorb, which keeps pressure on core prices.',
    })
  }

  const spread = value(observation, 'credit_spread')
  const spreadPrev = previous(observation, 'credit_spread')
  if (spread !== null && spreadPrev !== null && spread - spreadPrev >= 0.15) {
    items.push({
      id: 'credit_spreads',
      kind: 'signal',
      headline: `Corporate credit spreads widened to ${spread.toFixed(2)} pp`,
      detail:
        `Up ${(spread - spreadPrev).toFixed(2)} pp since the last meeting. Spreads ` +
        'are a market price, so they move before the statistics do.',
    })
  }

  return items
}

/** The open questions, in the order a committee would actually take them. */
function openQuestions(
  observation: ObservationSet,
  institution: Institution,
): readonly string[] {
  const questions: string[] = []
  const target = getInstitution(institution).inflationTarget

  const forecast = observation.forecasts.find(
    (fan) => fan.seriesId === 'headline_inflation',
  )
  const band = forecast?.bands.at(-1)
  if (forecast !== undefined && band !== undefined) {
    questions.push(
      `Staff put inflation at ${band.central.toFixed(2)} % in ${band.horizonMeetings} ` +
        `meetings, within a 10–90 range of ${band.p10.toFixed(2)} % to ` +
        `${band.p90.toFixed(2)} %. Does the committee set policy on that forecast ` +
        'or on the latest print?',
    )
  }

  const policyRate = value(observation, 'policy_rate')
  if (policyRate !== null) {
    const gap = basisPoints(observation.taylorBenchmark - policyRate)
    questions.push(
      `A Taylor-type benchmark sits at ${observation.taylorBenchmark.toFixed(2)} %, ` +
        `${Math.abs(gap)} bp ${gap >= 0 ? 'above' : 'below'} the current rate. It is a ` +
        'reference point for comparison, not a recommendation.',
    )
  }

  const headline = value(observation, 'headline_inflation')
  const uncertainty = observation.indicators.headline_inflation?.uncertainty ?? 0
  if (headline !== null && uncertainty > 0) {
    questions.push(
      `The inflation print carries an error band of ±${uncertainty.toFixed(2)} pp and ` +
        `describes a period already past. How much of the gap to the ` +
        `${target.toFixed(1)} % objective is signal rather than measurement?`,
    )
  }

  return questions
}

export function buildMeetingBrief(
  observation: ObservationSet,
  outcome: EndConditionResult,
  institution: Institution,
): MeetingBrief {
  // Priority order: things that could end the run, then what actually
  // happened, then what might happen, then what the data says.
  const warnings: BriefItem[] = [...outcome.warnings]
    .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'severe' ? -1 : 1))
    .map((warning) => ({
      id: `warning_${warning.id}`,
      kind: 'warning' as const,
      headline: warning.label,
      detail:
        `${warning.message} Held for ${warning.meetingsHeld} of the ` +
        `${warning.meetingsToTrigger} consecutive meetings that would end the mandate.`,
    }))

  const news: BriefItem[] = observation.newswire.map((headline, index) => ({
    id: `news_${index}`,
    kind: 'news',
    headline,
    detail: 'Fictional newswire report on an event that has just occurred.',
  }))

  const clues: BriefItem[] = observation.clues.map((clue, index) => ({
    id: `clue_${index}`,
    kind: 'signal',
    headline: clue,
    detail: 'An early signal. It raises the odds of a development; it does not confirm one.',
  }))

  const developments = [
    ...warnings,
    ...news,
    ...clues,
    ...dataDevelopments(observation, institution),
  ].slice(0, MAX_DEVELOPMENTS)

  return { developments, questions: openQuestions(observation, institution) }
}

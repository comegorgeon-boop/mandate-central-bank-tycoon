import {
  INSTITUTIONAL,
  getInstitution,
  type Institution,
  type ObservationSet,
  type SeriesId,
} from '../../simulation/index.ts'

/**
 * What is actually moving public trust.
 *
 * A played mandate reported trust falling while every commitment was being
 * kept, and read that as being punished for good conduct. Decomposed on that
 * seed, meeting by meeting, the reading was worse than they thought and
 * simpler: **public trust has no conduct term at all.** The whole of the fall
 * from 81 to 67 was the inflation gap; the unemployment term was *improving*
 * throughout, and the rate term never fired.
 *
 * That is by design and the design is defensible — the public judges the
 * prices and the jobs it lives with, not whether a promise about the rate path
 * was honoured, and the measure that answers conduct is credibility, which sat
 * beside it doing exactly that. What was not defensible was that nothing said
 * so. A player watching one number fall while they did everything right had no
 * way to learn that the number was never about them.
 *
 * So the decomposition goes on screen. Every term here is computed from
 * `INSTITUTIONAL.publicTrust` — the same constants the dynamics charge — and
 * from published series, so what the player is shown is what the engine did
 * and a change to one cannot silently disagree with the other.
 */

export interface TrustTerm {
  readonly label: string
  /** Points of trust this term is currently costing. Never negative. */
  readonly cost: number
  /** The published reading behind it, for the player to check. */
  readonly detail: string
}

export interface TrustReading {
  /** Where trust would settle if nothing else changed. */
  readonly target: number
  readonly ceiling: number
  readonly terms: readonly TrustTerm[]
  /** The term costing the most, or null when nothing is costing anything. */
  readonly dominant: TrustTerm | null
  /**
   * True when one term accounts for most of the shortfall. That is the case
   * worth naming out loud: "this is the inflation gap and nothing else".
   */
  readonly oneStory: boolean
}

function value(observation: ObservationSet, id: SeriesId): number | null {
  return observation.indicators[id]?.value ?? null
}

/** A term accounting for this share of the total shortfall is the story. */
const DOMINANT_SHARE = 0.6

export function readPublicTrust(
  observation: ObservationSet,
  institution: Institution,
  /** See `readStanding`. */
  objective?: number,
  sustainable?: number,
): TrustReading | null {
  const config = INSTITUTIONAL.publicTrust
  const inflation = value(observation, 'headline_inflation')
  const unemployment = value(observation, 'unemployment')
  const rate = value(observation, 'policy_rate')
  if (inflation === null && unemployment === null && rate === null) return null

  const target = objective ?? getInstitution(institution).inflationTarget
  const natural = sustainable ?? getInstitution(institution).initial.naturalUnemployment

  const terms: TrustTerm[] = []

  if (inflation !== null) {
    const over = Math.max(0, inflation - target)
    if (over > 0) {
      terms.push({
        label: 'Prices above the objective',
        cost: config.inflation * over,
        detail: `Inflation at ${inflation.toFixed(2)} %, against an objective of ${target.toFixed(1)} %.`,
      })
    }
  }

  if (unemployment !== null) {
    const over = Math.max(0, unemployment - natural)
    if (over > 0) {
      terms.push({
        label: 'People out of work',
        cost: config.unemployment * over,
        detail: `Unemployment at ${unemployment.toFixed(2)} %, against a sustainable ${natural.toFixed(1)} %.`,
      })
    }
  }

  if (rate !== null) {
    const over = Math.max(0, rate - config.policyRateTolerance)
    if (over > 0) {
      terms.push({
        label: 'The cost of borrowing',
        cost: config.policyRate * over,
        // The one term the committee sets directly, and the reason the
        // measure is not simply "how is the economy doing": tightening into a
        // shock costs trust twice, once through the prices it is fighting and
        // once through the rate it is fighting them with.
        detail: `The policy rate at ${rate.toFixed(2)} %, above the ${config.policyRateTolerance.toFixed(1)} % the public stops noticing below.`,
      })
    }
  }

  terms.sort((a, b) => b.cost - a.cost)
  const total = terms.reduce((sum, term) => sum + term.cost, 0)
  const dominant = terms[0] ?? null

  return {
    target: config.ceiling - total,
    ceiling: config.ceiling,
    terms,
    dominant,
    oneStory: dominant !== null && total > 0 && dominant.cost / total >= DOMINANT_SHARE,
  }
}

/**
 * One sentence saying what is moving it, for the strip.
 *
 * Deliberately blunt about the thing the player could not see: conduct does
 * not enter this measure. Saying it once, where the number is, is the whole
 * fix — a player who knows that reads a falling trust line as information
 * about the economy rather than as a verdict on them.
 */
export function trustSentence(reading: TrustReading): string {
  if (reading.dominant === null) {
    return (
      `At the ceiling of ${reading.ceiling.toFixed(0)}: prices, jobs and ` +
      'borrowing costs are all where the public stops noticing them.'
    )
  }
  const share = reading.oneStory ? 'almost all of it' : 'the largest part of it'
  return (
    `Heading for ${reading.target.toFixed(0)}, and ${share} is ` +
    `${reading.dominant.label.toLowerCase()}. ${reading.dominant.detail} ` +
    'Keeping or breaking a commitment does not enter this measure — that is ' +
    'credibility, beside it.'
  )
}

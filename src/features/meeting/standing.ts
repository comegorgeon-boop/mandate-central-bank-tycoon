import {
  THRESHOLDS,
  getInstitution,
  type EndConditionResult,
  type Institution,
  type ObservationSet,
  type SeriesId,
} from '../../simulation/index.ts'

/**
 * How the mandate is going — in both directions.
 *
 * The interface only ever signalled danger. There were severe warnings, a
 * crisis banner, red panels for what was breaking, and *nothing at all* for a
 * mandate going well: a player who had held inflation at target for eight
 * meetings and kept everybody in work saw the same grey screen as a player
 * drifting toward a spiral, distinguishable only by reading four numbers and
 * knowing what they meant. A game that reports only failure is a game whose
 * best outcome is the absence of feedback.
 *
 * So this reads the published data and reaches a verdict with a tone. It is
 * deliberately made of *named specifics* rather than a score — "inflation
 * within a quarter-point of the objective", "unemployment at its sustainable
 * rate" — because "going well" is not information and "these four things are
 * right" is.
 *
 * Everything is read from the observation set, never the latent state, so it
 * respects the information ladder like every other player-facing derivation:
 * at hard the player is reading the same noisy prints it is.
 */

export type StandingTone = 'thriving' | 'steady' | 'strained' | 'critical'

export interface StandingReading {
  readonly tone: StandingTone
  readonly headline: string
  /** What is specifically going right, named. Never a bare adjective. */
  readonly achievements: readonly string[]
  /** What is specifically going wrong. */
  readonly concerns: readonly string[]
}

function value(observation: ObservationSet, id: SeriesId): number | null {
  return observation.indicators[id]?.value ?? null
}

/**
 * How close to the objective counts as *at* the objective.
 *
 * A quarter of a point. Tighter than that and a mandate could never be praised
 * — inflation does not sit exactly on target and pretending it should is the
 * standard that made the game feel unwinnable in the first place.
 */
const ON_TARGET = 0.25

/** Unemployment within this of its natural rate counts as full employment. */
const AT_FULL_EMPLOYMENT = 0.3

const HEADLINE: Readonly<Record<StandingTone, string>> = {
  thriving: 'The mandate is going well.',
  steady: 'The mandate is on an even keel.',
  strained: 'The mandate is under strain.',
  critical: 'The mandate is in danger.',
}

export function readStanding(
  observation: ObservationSet,
  outcome: EndConditionResult,
  institution: Institution,
): StandingReading {
  const target = getInstitution(institution).inflationTarget
  const achievements: string[] = []
  const concerns: string[] = []

  const headline = value(observation, 'headline_inflation')
  if (headline !== null) {
    const gap = headline - target
    if (Math.abs(gap) <= ON_TARGET) {
      achievements.push(
        `Inflation is at ${headline.toFixed(2)} %, within a quarter-point of the ` +
          `${target.toFixed(1)} % objective.`,
      )
    } else if (Math.abs(gap) > 1.5) {
      concerns.push(
        `Inflation is ${Math.abs(gap).toFixed(2)} pp ${gap > 0 ? 'above' : 'below'} ` +
          'the objective.',
      )
    }
  }

  const unemployment = value(observation, 'unemployment')
  const natural = getInstitution(institution).initial.naturalUnemployment
  if (unemployment !== null) {
    const gap = unemployment - natural
    if (gap <= AT_FULL_EMPLOYMENT) {
      achievements.push(
        `Unemployment is at ${unemployment.toFixed(2)} %, at or below the rate this ` +
          'economy can sustain.',
      )
    } else if (gap > 1.5) {
      concerns.push(
        `Unemployment is ${gap.toFixed(2)} pp above its sustainable rate.`,
      )
    }
  }

  const expectations = value(observation, 'inflation_expectations')
  if (expectations !== null) {
    if (Math.abs(expectations - target) <= 0.3) {
      achievements.push(
        `Five-year expectations are anchored at ${expectations.toFixed(2)} %. Whatever ` +
          'else happens, people still believe the objective.',
      )
    } else if (Math.abs(expectations - target) > 1) {
      concerns.push(
        `Five-year expectations have drifted to ${expectations.toFixed(2)} %.`,
      )
    }
  }

  const stress = value(observation, 'bank_stress_proxy')
  if (stress !== null) {
    if (stress < THRESHOLDS.bankingCrisis.watchStress * 0.5) {
      achievements.push(
        `Banking stress reads ${stress.toFixed(1)}, comfortably below supervisory concern.`,
      )
    } else if (stress > THRESHOLDS.bankingCrisis.watchStress) {
      concerns.push(`Banking stress reads ${stress.toFixed(1)} and supervisors are watching.`)
    }
  }

  const approval = value(observation, 'public_approval')
  const previousApproval = observation.indicators.public_approval?.previous ?? null
  if (approval !== null && previousApproval !== null) {
    const change = approval - previousApproval
    if (change >= 2) {
      achievements.push(
        `Public trust rose to ${approval.toFixed(0)}. People are noticing.`,
      )
    } else if (change <= -3) {
      concerns.push(`Public trust fell to ${approval.toFixed(0)}.`)
    }
  }

  // The tone. Severe warnings dominate everything — a mandate four meetings
  // from revocation is not "going well" because inflation happens to be on
  // target this quarter.
  const severe = outcome.warnings.some((warning) => warning.severity === 'severe')
  const tone: StandingTone = severe
    ? 'critical'
    : concerns.length > achievements.length
      ? 'strained'
      : achievements.length >= 3
        ? 'thriving'
        : 'steady'

  return { tone, headline: HEADLINE[tone], achievements, concerns }
}

import {
  SCENARIOS,
  getInstitution,
  inflationTargetFor,
  type DecisionLogEntry,
  type ScoreBreakdown,
  type SimulationState,
} from '../../simulation/index.ts'

/**
 * What a mandate is remembered for, beyond its number.
 *
 * ## Derived, never tracked
 *
 * Every achievement here is a **pure predicate over a finished run**: the
 * state the engine produced, the outcome it reached, and the score it was
 * given. Nothing new is counted during play, nothing is written mid-mandate,
 * and no achievement can be in a different state from the run it describes.
 * That matters more than it sounds: a counter incremented in the interface is
 * a second source of truth about a world the engine already fully describes,
 * and the first time the two disagree the player is right and the game is
 * wrong.
 *
 * ## What they are for, and what they are not
 *
 * They mark things the game actually values — serving a term, holding an
 * anchor through a shock, lending into a panic, beating the path history took
 * — and a few that are simply *true about what you did*, in both directions.
 * **Giving in to a government has one.** It is not an achievement in the sense
 * of a virtue; it is the game noticing, which is the point of the mechanic.
 * A list that only rewarded good play would be a list of instructions.
 *
 * None of them is scored. The score is the score.
 */

export type AchievementId =
  | 'served'
  | 'served_hard'
  | 'on_target'
  | 'kept_every_word'
  | 'anchor_held'
  | 'lender_of_last_resort'
  | 'steady_hand'
  | 'beat_the_standard'
  | 'banks_still_open'
  | 'held_the_line'
  | 'gave_in'
  | 'whole_toolkit'
  | 'full_marks'
  | 'every_period'

export interface Achievement {
  readonly id: AchievementId
  readonly name: string
  /** What it is for, in the player's words. */
  readonly note: string
  /** True when this mandate earned it. */
  readonly earned: (context: AchievementContext) => boolean
}

export interface AchievementContext {
  readonly state: SimulationState
  /**
   * The packages confirmed in this mandate.
   *
   * Carried separately because they live on the session rather than on the
   * state: the state is the world and the decisions are what was done to it,
   * and two achievements here are about the latter.
   */
  readonly decisions: readonly DecisionLogEntry[]
  /**
   * The component breakdown — the *explanation*, which several achievements
   * are about ("the anchor never moved"), and which is what it is still for.
   * Its total is not read here or anywhere the player can see: see
   * `scoring/theScore.ts`.
   */
  readonly score: ScoreBreakdown
  /** What this mandate banked. The score. */
  readonly banked: number
  /** The outcome id, e.g. `mandate_completed`. */
  readonly outcome: string
  /** How this mandate compared with the path history took, if it is historical. */
  readonly beatTheStandard: boolean
  /** Which scenarios this device has completed, including this one. */
  readonly scenariosCompleted: ReadonlySet<string>
}

/** The component this id scores, 0 to 1, or null if the mandate has none. */
function component(score: ScoreBreakdown, id: string): number | null {
  return score.components.find((entry) => entry.id === id)?.raw ?? null
}

function served(context: AchievementContext): boolean {
  return (
    context.outcome === 'mandate_completed' ||
    context.outcome === 'objective_met' ||
    context.outcome === 'objective_missed'
  )
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  {
    id: 'served',
    name: 'Served the term',
    note: 'Reached the end of a mandate without it ending for you.',
    earned: served,
  },
  {
    id: 'served_hard',
    name: 'Served it at hard',
    note: 'The same, in the mode made of problems that have no right answer.',
    earned: (c) => served(c) && c.state.config.difficulty === 'hard',
  },
  {
    id: 'on_target',
    name: 'On target',
    note:
      'Finished within a quarter of a point of the objective. Reaching it at ' +
      'the end is not the same as holding it throughout, and the score knows ' +
      'the difference — this only notices where you landed.',
    earned: (c) => {
      const latent = c.state.history.at(-1)?.latent
      if (latent === undefined) return false
      const target = inflationTargetFor(c.state.config)
      return served(c) && Math.abs(latent.inflationHeadline - target) <= 0.25
    },
  },
  {
    id: 'kept_every_word',
    name: 'Kept every word',
    note:
      'Served a full term, issued guidance, and broke none of it. Saying ' +
      'nothing does not count: a promise you never made is not a promise you ' +
      'kept.',
    earned: (c) =>
      served(c) &&
      c.state.guidance.brokenPromises === 0 &&
      c.state.guidance.keptPromises >= 3,
  },
  {
    id: 'anchor_held',
    name: 'The anchor held',
    note:
      'Came through a real cost-push shock with long-run expectations still ' +
      'within half a point of the objective. The print was never the question.',
    earned: (c) => {
      const worstShock = Math.max(
        ...c.state.history.map((snapshot) => snapshot.latent.supplyShock),
        0,
      )
      const target = inflationTargetFor(c.state.config)
      const latent = c.state.history.at(-1)?.latent
      return (
        served(c) &&
        worstShock >= 1.5 &&
        latent !== undefined &&
        Math.abs(latent.expectedInflationLong - target) <= 0.5
      )
    },
  },
  {
    id: 'lender_of_last_resort',
    name: 'Lender of last resort',
    note:
      'Banking stress went past the point supervisors start warning about, ' +
      'and the system was still standing at the end of the mandate.',
    earned: (c) => {
      const worst = Math.max(
        ...c.state.history.map((snapshot) => snapshot.latent.bankingStress),
        0,
      )
      return served(c) && worst >= 55
    },
  },
  {
    id: 'steady_hand',
    name: 'A steady hand',
    note:
      'Served a full term without the score charging you for churn. Every ' +
      'move you made, you meant.',
    earned: (c) => served(c) && (component(c.score, 'policy_volatility') ?? 0) >= 0.95,
  },
  {
    id: 'beat_the_standard',
    name: 'Better than they managed',
    note:
      'Scored above the path the institution actually took, on your own seed ' +
      'and with the same shocks. A historical mandate only.',
    earned: (c) => c.beatTheStandard,
  },
  {
    id: 'banks_still_open',
    name: 'The banks stayed open',
    note:
      'Served the whole of 1929-33 without a systemic banking failure — ' +
      'which is more than happened.',
    earned: (c) =>
      served(c) && c.state.config.scenario === 'great_contraction_1929',
  },
  {
    id: 'held_the_line',
    name: 'Held the line',
    note:
      'Refused a government in public while political pressure was near the ' +
      'top of its scale, and served the term anyway.',
    earned: (c) => {
      const worstPressure = Math.max(
        ...c.state.history.map((snapshot) => snapshot.latent.politicalPressure),
        0,
      )
      const yielded = c.decisions.some(
        (entry) => entry.package.demandResponse === 'yield',
      )
      return served(c) && worstPressure >= 80 && !yielded
    },
  },
  {
    id: 'gave_in',
    name: 'Gave them what they wanted',
    note:
      'Answered a government\u2019s request by doing what it asked. Not a ' +
      'virtue and not a failure — the game noticing, which is the point of ' +
      'having the choice at all.',
    earned: (c) =>
      c.decisions.some((entry) => entry.package.demandResponse === 'yield'),
  },
  {
    id: 'whole_toolkit',
    name: 'Used the whole desk',
    note:
      'Moved four different instruments in one mandate. The rate is one ' +
      'lever of several and most mandates never touch the others.',
    earned: (c) => {
      const moved = new Set<string>()
      for (const entry of c.decisions) {
        for (const action of entry.package.actions) moved.add(action.instrument)
      }
      return moved.size >= 4
    },
  },
  {
    id: 'full_marks',
    name: 'Eight thousand',
    note: 'Banked more than 8,000 points in one mandate.',
    /*
     * The name and the number survive the move from the graded total to the
     * banked one, because 8,000 was always *derived* from the banked pace:
     * `BANKED.meetingPoints` is 250 and a Fed term is 32 meetings, which is
     * where `MAX_SCORE` came from in the first place. So this still means what
     * it always meant — a full term held near its objectives — and now it
     * means it on the number the player is actually shown.
     */
    earned: (c) => c.banked >= 8000,
  },
  {
    id: 'every_period',
    // No number in the name, deliberately. It was "All six periods" until a
    // seventh was added, at which point the name was a lie that the predicate
    // underneath it had already stopped telling — `SCENARIOS.every` counts
    // whatever is there.
    name: 'Every period',
    note:
      'Served a full term in every historical mandate the game ships, on ' +
      'this device.',
    earned: (c) =>
      SCENARIOS.every((scenario) => c.scenariosCompleted.has(scenario.id)),
  },
]

/** Which achievements this finished mandate earned. */
export function earnedBy(context: AchievementContext): readonly AchievementId[] {
  return ACHIEVEMENTS.filter((achievement) => achievement.earned(context)).map(
    (achievement) => achievement.id,
  )
}

/** The institution's name, for a line of copy that needs one. */
export function institutionName(state: SimulationState): string {
  return getInstitution(state.config.institution).shortName
}

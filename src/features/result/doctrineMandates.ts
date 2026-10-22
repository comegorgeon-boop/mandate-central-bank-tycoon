import {
  DOCTRINES,
  SIMULATION_VERSION,
  createRunConfig,
  doctrineContext,
  getInstrument,
  getInstrumentRange,
  playRun,
  theScore,
  type Doctrine,
  type PolicyPackage,
  type RunConfig,
  type RunSession,
} from '../../simulation/index.ts'

/**
 * Your mandate against all ten, on the same seed.
 *
 * The end of the argument that ran through the whole mandate. Each school has
 * spent it recommending rates and being scored meeting by meeting; this is
 * what happens when one of them is given the chair for the entire term.
 *
 * Ten complete alternative mandates, each played from the same opening state
 * with the same seed, each meeting decided by one school's own rule. The
 * comparison is therefore exact in the way the rest of this build's
 * counterfactuals are exact: nothing is estimated, and the only difference
 * between the runs is whose logic was in the chair.
 *
 * ## What it can and cannot say
 *
 * It **can** say that a school that spent your mandate arguing for restraint
 * would have finished with a lower score than you did, and by how much. That
 * is a fact about this seed.
 *
 * It **cannot** say the school was wrong. A mandate is one draw, and a rule
 * that loses on this seed may be the rule you want facing the next one —
 * which is the actual lesson, and the copy says so rather than crowning a
 * winner.
 *
 * Run once, on the result screen, because ten full mandates is a second of
 * work and the alternative is carrying ten economies through every meeting of
 * every run for a table nobody sees until the end.
 */

export interface DoctrineMandate {
  readonly doctrine: Doctrine
  /**
   * What that school's mandate banked. **The** score — see
   * `scoring/theScore.ts`.
   *
   * It was `ScoreBreakdown` and the table ranked on its total, which is the
   * number that preferred an early exit: a school whose rule got it dismissed
   * at meeting nine could out-rank one that served four years, because a
   * short path has a better average. On a survival structure that is a table
   * of who was fired soonest.
   */
  readonly banked: number
  /** Banked per meeting served: the rate, which the total alone hides. */
  readonly perMeeting: number
  /** Whether that school's mandate reached the end at all. */
  readonly completed: boolean
  readonly endedAs: string
  /** The end condition in a few words, or null if it simply ran out. */
  readonly endedLabel: string | null
  /** Meetings it lasted. */
  readonly meetings: number
  /**
   * Meetings at which it had standing to decide anything.
   *
   * The two conditional schools spend most mandates with no view, and a table
   * that did not say so would show them scoring exactly what a chair who never
   * moved scored and leave the reader to guess why. It is not that they are
   * good at this; it is that on this seed they were never called.
   */
  readonly spoke: number
}

export interface MandateComparison {
  /** The player's own banked score, for the line they are compared against. */
  readonly player: number
  /** And their rate, so the table compares like with like. */
  readonly playerPerMeeting: number
  readonly mandates: readonly DoctrineMandate[]
  /** How many schools would have scored better on this seed. */
  readonly beatenBy: number
}

/** One school in the chair, deciding every meeting by its own rule. */
function playAs(doctrine: Doctrine, config: RunConfig): DoctrineMandate {
  const instrument = getInstrument('policy_rate')
  const range =
    instrument === undefined
      ? { min: -150, max: 150, increment: 25 }
      : getInstrumentRange(instrument, config.difficulty)

  let spoke = 0

  const choose = (session: RunSession): PolicyPackage => {
    const lastPackage = session.decisions.at(-1)?.package
    const lastMove =
      lastPackage?.actions.find((action) => action.instrument === 'policy_rate')
        ?.magnitude ?? 0
    const ctx = doctrineContext({
      observation: session.observation,
      institution: config.institution,
      currentRate: session.state.stance.targetRate,
      lastMove,
      meetingIndex: session.state.meetingIndex,
      maxMove: range.max,
    })

    // A school with no standing in this state holds: it has no view, and
    // inventing one for it would be the opposite of what makes it conditional.
    const standing = doctrine.speaks(ctx)
    if (standing) spoke += 1
    const move = standing ? doctrine.view(ctx).basisPoints : 0

    // Never propose a move the engine would reject at the lower bound — a
    // rejected package would end the run on a technicality rather than on the
    // doctrine, which is the one thing this comparison must not do.
    const floor = config.institution === 'fed' ? 0 : -0.75
    const safe =
      session.state.stance.targetRate + move / 100 < floor - 1e-9 ? 0 : move

    return {
      actions: safe === 0 ? [] : [{ instrument: 'policy_rate', magnitude: safe }],
      // The rate alone. Every school here is a theory of the *rate*, and
      // handing them a balance sheet and a communication strategy they have
      // no position on would be scoring them on choices somebody else made.
      communication: null,
    }
  }

  const session = playRun(config, choose)
  const banked = theScore(session.state)
  return {
    doctrine,
    banked: banked.total,
    perMeeting: banked.perMeeting,
    completed: session.outcome.status === 'completed',
    endedAs: session.outcome.summary ?? 'Served the full mandate.',
    endedLabel: session.outcome.label,
    meetings: session.state.meetingIndex,
    spoke,
  }
}

export function compareMandates(playerSession: RunSession): MandateComparison {
  const source = playerSession.state.config
  const config = createRunConfig({
    institution: source.institution,
    difficulty: source.difficulty,
    seed: source.seed,
    simulationVersion: SIMULATION_VERSION,
  })

  const mandates = DOCTRINES.map((doctrine) => playAs(doctrine, config)).sort(
    (a, b) => b.banked - a.banked,
  )

  const player = theScore(playerSession.state)
  return {
    player: player.total,
    playerPerMeeting: player.perMeeting,
    mandates,
    beatenBy: mandates.filter((entry) => entry.banked > player.total).length,
  }
}

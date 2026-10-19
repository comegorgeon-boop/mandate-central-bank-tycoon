import {
  getInstitution,
  inflationTargetFor,
  staffRecommendation,
  sustainableRateFor,
  type Difficulty,
  type ObservationSet,
  type SeriesId,
  type RunSession,
} from '../../simulation/index.ts'

/**
 * One sentence, and the mandate has to be playable on it.
 *
 * ## The criterion this exists to meet
 *
 * > "Sur facile, un joueur qui ne lit QUE la ligne d'alerte et la phrase de
 * > synthèse doit pouvoir tenir son mandat. Sinon le reste de l'écran est de
 * > la lecture obligatoire, et de la lecture obligatoire vingt-quatre fois
 * > d'affilée, c'est un document, pas un jeu."
 *
 * That is falsifiable, and `dev/twoLines.ts` falsifies it: a player that reads
 * nothing but the standing line and this sentence, maps them to a move, and
 * plays a whole mandate. If it cannot serve the term, this sentence is not
 * carrying its weight and the screen behind it is compulsory reading.
 *
 * ## It is graded, because the information ladder is the game
 *
 * On **easy** it is directive, because easy is the tutorial and the staff
 * exist to tell you what they think. On **medium** it states the problem and
 * not the answer. On **hard** it states only what moved, because hard's whole
 * premise is that nobody will tell you — and the criterion above is set for
 * easy alone, deliberately, by the person who asked for it.
 *
 * Nothing here is new information. Every clause is read off the published
 * observation, the same set every panel reads, so the sentence cannot know
 * something the player could not have found.
 */

/** Rounds a basis-point move to language. */
function size(basisPoints: number): string {
  const magnitude = Math.abs(basisPoints)
  if (magnitude < 13) return 'hold'
  if (magnitude <= 30) return 'a quarter point'
  if (magnitude <= 60) return 'a half point'
  if (magnitude <= 90) return 'three quarters of a point'
  return 'a full point or more'
}

function value(observation: ObservationSet, id: SeriesId): number | null {
  return observation.indicators[id]?.value ?? null
}

/**
 * What this meeting is about, in one sentence.
 *
 * Returns null only where nothing has been published at all — the opening
 * meeting of a mandate, before the first release — and the caller says so in
 * its own words rather than printing an empty line.
 */
export function meetingLine(session: RunSession): string | null {
  const { state, observation } = session

  // Something landed in the interval. It leads, whatever else is true: the
  // generator now guarantees an event every third meeting at the latest, and
  // a player who is handed a dial without being told what just happened is
  // being asked to react to a number that moved for no stated reason.
  const landed = session.minorEvents[0]
  if (landed !== undefined) {
    return landed.title + '.'
  }
  const difficulty: Difficulty = state.config.difficulty
  const target = inflationTargetFor(state.config)
  const inflation = value(observation, 'headline_inflation')
  const unemployment = value(observation, 'unemployment')
  // The mandate's *declared* sustainable rate, which is a published property
  // of the mandate rather than the engine's private natural rate — the same
  // source the stance strip reads. Reading `latent` here would let the
  // sentence know something the player could not have found, which is the one
  // thing this file promises not to do.
  const sustainable = sustainableRateFor(state.config)

  if (inflation === null && unemployment === null) {
    return 'No figures have been published yet. The first decision is taken without them.'
  }

  const gap = inflation === null ? null : inflation - target
  const slack = unemployment === null ? null : unemployment - sustainable

  if (difficulty === 'easy') {
    // Directive, because easy is the tutorial. The recommendation is the
    // staff's own — the same rule the desk shows — so the sentence and the
    // panel behind it cannot disagree.
    const advice = staffRecommendation(observation, state.config.institution, 'easy')
    if (advice !== null) {
      const where =
        gap === null
          ? 'The figures are thin this meeting'
          : gap > 0.25
            ? `Inflation is ${gap.toFixed(1)} points above the objective`
            : gap < -0.25
              ? `Inflation is ${Math.abs(gap).toFixed(1)} points below the objective`
              : 'Inflation is at the objective'
      const move = size(advice.basisPoints)
      const direction =
        move === 'hold'
          ? 'the staff would hold'
          : `the staff would ${advice.basisPoints > 0 ? 'raise' : 'cut'} by ${move}`
      return `${where}, and ${direction}.`
    }
  }

  if (difficulty === 'medium') {
    // The problem, not the answer.
    if (gap !== null && Math.abs(gap) > 0.5 && slack !== null) {
      const prices = gap > 0 ? 'above' : 'below'
      const jobs =
        slack > 0.4 ? 'and there is slack in the labour market' : 'and the labour market is tight'
      return `Inflation is ${Math.abs(gap).toFixed(1)} points ${prices} the objective, ${jobs}.`
    }
    if (gap !== null) {
      return `Inflation is within half a point of the objective; nothing is pulling hard either way.`
    }
  }

  // Hard, and the fallback everywhere: what moved, and nothing about what to
  // do with it.
  const previous = session.previousObservation
  const was = previous === null ? null : value(previous, 'headline_inflation')
  if (inflation !== null && was !== null && Math.abs(inflation - was) > 0.1) {
    const direction = inflation > was ? 'rose' : 'fell'
    return `Inflation ${direction} ${Math.abs(inflation - was).toFixed(2)} points to ${inflation.toFixed(2)} %.`
  }
  if (inflation !== null) {
    return `Inflation is steady at ${inflation.toFixed(2)} %, against an objective of ${target.toFixed(1)} %.`
  }
  return `No price release this meeting at ${getInstitution(state.config.institution).shortName}.`
}

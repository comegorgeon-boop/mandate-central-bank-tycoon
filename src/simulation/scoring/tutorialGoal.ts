import type { SimulationState } from '../types/state.ts'
import { getDifficulty } from '../config/difficulty.ts'
import { getInstitution } from '../config/institutions.ts'

/**
 * The tutorial's goal, and how close the player is to it.
 *
 * Easy ends when this is met rather than when a clock runs out — see
 * `DifficultyConfig.tutorialGoal` for why. This module is the single place
 * that decides whether it *is* met, so the end condition, the score and the
 * panel that shows the player their progress cannot disagree about it.
 *
 * Read from the **latent** state, deliberately, and this is the one place in
 * the player-facing chain where that is right. The tutorial's ending is a fact
 * about the economy, not about the estimate of it: passing on a lucky print
 * and failing on an unlucky one would make the lesson about measurement error,
 * which is medium's lesson and not this one. The panel shows published figures
 * beside the goal so the player can see roughly where they stand; the ending
 * itself is judged on the truth, and `heldForMeetings` is what stops a single
 * quarter deciding it either way.
 */

export interface TutorialProgress {
  /** Both objectives are met right now. */
  readonly onTarget: boolean
  /** Consecutive meetings, including this one, on target. */
  readonly meetingsHeld: number
  readonly meetingsNeeded: number
  /** The goal has been held long enough: the tutorial is passed. */
  readonly passed: boolean
  /** Meetings played, against the point at which it ends unfinished. */
  readonly meetingsPlayed: number
  readonly maxMeetings: number
  readonly inflation: number
  readonly inflationBelow: number
  readonly unemployment: number
  readonly unemploymentBelow: number
}

export function tutorialProgress(state: SimulationState): TutorialProgress | null {
  const goal = getDifficulty(state.config.difficulty).tutorialGoal
  if (goal === null) return null

  // Resolved against the institution the player actually serves, so the goal
  // is the same *ask* on both rather than the same two numbers.
  const institution = getInstitution(state.config.institution)
  const inflationBelow = institution.inflationTarget + goal.inflationAboveTargetBy
  const unemploymentBelow =
    institution.initial.naturalUnemployment + goal.unemploymentAboveNaturalBy

  const meets = (latent: SimulationState['latent']): boolean =>
    latent.inflationHeadline < inflationBelow &&
    latent.unemployment < unemploymentBelow

  // Walk backwards from the current meeting for as long as both hold. The
  // history carries one snapshot per meeting already sat through, so this is
  // exactly "how many meetings in a row have I been there".
  let meetingsHeld = 0
  for (let index = state.history.length - 1; index >= 0; index -= 1) {
    if (!meets(state.history[index].latent)) break
    meetingsHeld += 1
  }

  return {
    onTarget: meets(state.latent),
    meetingsHeld,
    meetingsNeeded: goal.heldForMeetings,
    passed: meetingsHeld >= goal.heldForMeetings,
    meetingsPlayed: state.meetingIndex,
    maxMeetings: goal.maxMeetings,
    inflation: state.latent.inflationHeadline,
    inflationBelow,
    unemployment: state.latent.unemployment,
    unemploymentBelow,
  }
}

/** True when the tutorial has run past the point where it ends unfinished. */
export function tutorialExhausted(progress: TutorialProgress): boolean {
  return progress.meetingsPlayed >= progress.maxMeetings
}

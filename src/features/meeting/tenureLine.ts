import {
  getDifficulty,
  TENURE,
  meetingsLeftInTerm,
  termOf,
  type RunSession,
} from '../../simulation/index.ts'

/**
 * Where you stand in your own tenure, in one line of status.
 *
 * ## What this replaces
 *
 * `Meeting 3 of 16`. Under a survival structure there is no sixteen: you
 * serve until you are revoked, and a denominator is a promise the game does
 * not make. What a governor actually knows is which term they are in and how
 * far the next thing that can end them is — so that is what the line says.
 *
 * ## The two institutions read differently, on purpose
 *
 * A **Fed Chair** is reappointable, so there is a hearing to count down to
 * and the countdown is the Fed half of the game: pressure ignored for four
 * years is a bill that arrives at a date you have been able to see from the
 * first meeting.
 *
 * An **ECB President** serves one non-renewable eight-year term and cannot in
 * practice be removed. There is nothing to count down to, so counting down
 * would be a lie about the office. They are told the year instead — which is
 * exactly the point, and the flattest possible way of making it.
 *
 * A tutorial keeps its own plain count: it genuinely has a cap, and pretending
 * otherwise would make the one mode that is supposed to be gentle the only one
 * that is coy about its length.
 */
export function tenureLine(session: RunSession): string {
  const { config, meetingIndex } = session.state
  const meeting = meetingIndex + 1

  if (config.mode === 'historical') return `Meeting ${meeting}`

  /*
   * The tutorial keeps a plain count, and this branch is the implementation
   * of a sentence the doc comment above was already making before the code
   * did — which is its own small lesson: a comment is not a feature.
   *
   * It is right on the merits. Easy has a real cap (`tutorialGoal.maxMeetings`)
   * and a real objective, so it is the one mode with a genuine end, and it
   * would be perverse for the gentlest difficulty to be the only one coy
   * about how long it runs.
   */
  if (getDifficulty(config.difficulty).tutorialGoal !== undefined) {
    return `Meeting ${meeting}`
  }

  const tenure = TENURE[config.institution]

  if (!tenure.renewable) {
    const year = Math.floor(meetingIndex / 8) + 1
    const years = tenure.term / 8
    return `Meeting ${meeting} · year ${year} of ${years} · no second term`
  }

  const term = termOf(config.institution, meetingIndex)
  const left = meetingsLeftInTerm(config.institution, meetingIndex)
  const last = term >= tenure.maxTerms

  if (left <= 1) {
    return `Meeting ${meeting} · term ${term} · the hearing is next`
  }
  return `Meeting ${meeting} · term ${term} · ${left} to ${
    last ? 'the end of the last term' : 'the hearing'
  }`
}

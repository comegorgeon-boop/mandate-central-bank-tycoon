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
   * **Time served, not progress toward an end.**
   *
   * > "« MEETING 3 » me remet dans le cadre d'une partie de longueur connue,
   * > alors qu'on est passés en survie. Affiche une DURÉE DE SERVICE, pas une
   * > progression vers une fin."
   *
   * Right, and the first version of this only did half the job: it dropped
   * the "of 16" but kept "Meeting 3", which still reads as step three of
   * something. A counter counts *toward*. What a governor has is a length of
   * service and the date of the next thing that can end it — which is the
   * same information in the only framing that is true.
   */

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
  const served =
    meetingIndex === 0
      ? 'Sworn in today'
      : `In post ${meetingIndex} meeting${meetingIndex === 1 ? '' : 's'}`

  if (getDifficulty(config.difficulty).tutorialGoal !== undefined) {
    return served
  }

  const tenure = TENURE[config.institution]

  if (!tenure.renewable) {
    const left = tenure.term - meetingIndex
    return `${served} · ${left} left of a term nobody can cut short`
  }

  const left = meetingsLeftInTerm(config.institution, meetingIndex)
  const term = termOf(config.institution, meetingIndex)
  const last = term >= tenure.maxTerms

  if (left <= 1) return `${served} · the hearing is next`
  if (last) return `${served} · ${left} left of the last term`
  return `${served} · hearing in ${left}`
}

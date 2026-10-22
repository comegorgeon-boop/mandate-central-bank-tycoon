import type { Difficulty, Institution, RunConfig } from '../types/core.ts'
import { MEETINGS_PER_YEAR } from '../config/time.ts'
import { TENURE } from '../config/tenure.ts'
import { getDifficulty } from '../config/difficulty.ts'
import { getInstitution } from '../config/institutions.ts'

/**
 * How long a mandate lasts, said once, in the words the engine actually holds.
 *
 * ## Why this file exists
 *
 * > "Sur l'écran de sélection du scénario fictif on m'annonce 12, 16 ou 24
 * > réunions, et une fois dans la partie le jeu parle de 64 réunions
 * > programmées. Ce sont des libellés restés de l'ancienne structure à longueur
 * > fixe, avant le passage en survie."
 *
 * Exactly that, and the two numbers came from two different dead places.
 * `MEETING_COUNT = { easy: 12, medium: 16, hard: 24 }` is the **old
 * fixed-length structure**, which `config/tenure.ts` replaced and which still
 * fed the setup screen and the home page. `config.meetingCount` for a
 * fictional run is the **tenure horizon** — 64, two Fed terms or one ECB term —
 * which is the longest a player *could* serve and is what everything dividing
 * by a mandate length needs a denominator for. It was never a schedule, and
 * the briefing called it "scheduled meetings".
 *
 * So one screen promised a length difficulty no longer sets, and the next
 * promised a length nobody is meant to reach.
 *
 * ## What is true
 *
 * | | term | renewable | what ends it early |
 * | --- | --- | --- | --- |
 * | Fed | 4 years = 32 meetings | **once** | the appointment is not renewed |
 * | ECB | 8 years = 64 meetings | **no, by treaty** | you lose the Council |
 *
 * And for both: *neither horizon is meant to be reached often.* You serve until
 * you are revoked, and the length is a result rather than a setting — which is
 * the sentence every one of these screens should have been saying.
 *
 * The tutorial is the exception and has to be, because it genuinely does end
 * on something else: its two objectives, held for three consecutive meetings,
 * with a backstop if they are not reached.
 *
 * `features/meeting/lengthCopy.test.ts` fails the build on a user-facing string
 * that states a meeting count the engine does not hold.
 */

/** The term, in meetings and in years, for one institution. */
export function termOfOffice(institution: Institution): {
  readonly meetings: number
  readonly years: number
  readonly renewable: boolean
  readonly office: string
} {
  const tenure = TENURE[institution]
  return {
    meetings: tenure.term,
    years: tenure.term / MEETINGS_PER_YEAR,
    renewable: tenure.renewable,
    office: tenure.office,
  }
}

/**
 * One sentence on how long this mandate is and how it ends.
 *
 * Deliberately says the *term* and then says it is not a schedule, in that
 * order: a player needs the horizon to plan against — the reappointment
 * hearing is visible from twenty meetings away and is meant to be steered at —
 * and needs to know in the same breath that reaching it is not the expected
 * case.
 */
export function tenureSentence(config: RunConfig): string {
  const { institution, difficulty, scenario } = config

  if (scenario !== null) {
    // A scenario *is* a calendar: 1929-33 is thirty meetings because it is a
    // date range. Here a count is the honest thing to say.
    return `${config.meetingCount} meetings, the length of the period itself.`
  }

  const goal = getDifficulty(difficulty).tutorialGoal
  if (goal !== null) {
    return (
      `This one ends when you have done the job: inflation below ` +
      `${(getInstitution(institution).inflationTarget + goal.inflationAboveTargetBy).toFixed(1)} % ` +
      `and unemployment within reach of its sustainable rate, both held for ` +
      `${goal.heldForMeetings} consecutive meetings. There is no clock to run out, ` +
      `though it does stop at ${goal.maxMeetings} if the economy is still broken.`
    )
  }

  const term = termOfOffice(institution)
  return term.renewable
    ? `A ${term.years}-year term — ${term.meetings} meetings — and then a ` +
        `reappointment hearing you can fail. You serve until you are revoked; ` +
        `most mandates end well short of the term.`
    : `One ${term.years}-year term of ${term.meetings} meetings, which the ` +
        `treaties do not allow to be renewed or cut short. Nobody can remove ` +
        `you; you can lose the Governing Council. Most mandates end well short ` +
        `of the term.`
}

/** The tutorial, which ends on a goal rather than on a term. */
export function isTutorial(difficulty: Difficulty): boolean {
  return getDifficulty(difficulty).tutorialGoal !== null
}

/**
 * The one-line label for a difficulty on the setup screen.
 *
 * **No meeting count**, which is the whole correction: difficulty stopped
 * setting the length when survival landed, and `config/tenure.ts` says in as
 * many words that removing length from the selector is what dissolved the
 * coupling between mandate length and shock severity. A label that still
 * announced "12 scheduled meetings" was describing the build before last.
 */
export function difficultyLength(difficulty: Difficulty): string {
  return isTutorial(difficulty)
    ? 'ends when the job is done'
    : 'served until revoked'
}

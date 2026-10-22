import { describe, expect, it } from 'vitest'
import type { Difficulty, Institution } from '../../simulation/index.ts'
import {
  MEETING_COUNT,
  SIMULATION_VERSION,
  TENURE,
  createRunConfig,
  difficultyLength,
  tenureSentence,
  termOfOffice,
} from '../../simulation/index.ts'

/**
 * **No screen may promise a mandate length the engine does not hold.**
 *
 * > "Ce sont des libellés restés de l'ancienne structure à longueur fixe,
 * > avant le passage en survie. Passe tous les textes en revue et aligne-les
 * > sur ce que le jeu fait vraiment […] Et écris le test qui attrape un
 * > libellé annonçant une longueur que le moteur ne tient pas."
 *
 * Two screens were quoting lengths, from two different dead places, and
 * neither was wrong by a little:
 *
 * - the setup screen and the home page read `MEETING_COUNT` — 12 / 16 / 24 —
 *   which is the **fixed-length structure survival replaced**, and which
 *   `config/tenure.ts` says in as many words it removed from the selector on
 *   purpose, because length and shock severity were two settings of one dial;
 * - the briefing promised `config.meetingCount` "scheduled meetings", which on
 *   a fictional run is the **tenure horizon** of 64 — the longest anybody
 *   *could* serve, used as a denominator, and a number no mandate is meant to
 *   reach. So the player was told 12 on one screen and 64 on the next.
 *
 * The test is deliberately about the *numbers in the copy* rather than about
 * the copy reading well, because that is the half a reviewer cannot check by
 * eye: a stale constant renders a plausible sentence.
 */

const INSTITUTIONS: readonly Institution[] = ['fed', 'ecb']
const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard']

function config(institution: Institution, difficulty: Difficulty) {
  return createRunConfig({
    institution,
    difficulty,
    seed: 'LENGTH-COPY',
    simulationVersion: SIMULATION_VERSION,
  })
}

describe('what the screens say about how long a mandate is', () => {
  it('never quotes a number from the retired fixed-length table', () => {
    /*
     * The retired lengths, as numbers. If a sentence contains one of these it
     * is either quoting `MEETING_COUNT` or has coincidentally reproduced it,
     * and both are worth looking at: 12, 16 and 24 are not meeting counts in
     * this build at all.
     */
    const retired = Object.values(MEETING_COUNT)

    for (const institution of INSTITUTIONS) {
      for (const difficulty of DIFFICULTIES) {
        const sentence = tenureSentence(config(institution, difficulty))
        const numbers = (sentence.match(/\d+/g) ?? []).map(Number)
        const stale = numbers.filter(
          (value) => retired.includes(value) && value !== TENURE[institution].term,
        )
        expect(
          stale,
          `"${sentence}" (${institution}/${difficulty}) quotes ${stale.join(', ')}, ` +
            `which ${stale.length === 1 ? 'is' : 'are'} from MEETING_COUNT — the ` +
            'fixed-length structure that survival replaced. The lengths the engine ' +
            'holds are in `config/tenure.ts`.',
        ).toEqual([])
      }
    }
  })

  it('states each institution its real term, and says it is not a schedule', () => {
    for (const institution of INSTITUTIONS) {
      const term = termOfOffice(institution)
      const sentence = tenureSentence(config(institution, 'medium'))

      expect(
        sentence,
        `${institution}'s term is ${term.meetings} meetings and the copy does not say so`,
      ).toContain(String(term.meetings))

      // The part that was missing everywhere, and the part a player needs: the
      // term is a horizon to steer at, not an appointment diary.
      expect(
        sentence.toLowerCase(),
        `${institution}: the copy quotes a length without saying that reaching it ` +
          'is not the expected case. A player told "64 meetings" and then revoked ' +
          'at nine has been misled by a true number.',
      ).toMatch(/until you are revoked|short of the term/)
    }

    // And the asymmetry, which the player called one of the most important
    // things to understand: one is renewable and the other cannot be.
    expect(tenureSentence(config('fed', 'medium')).toLowerCase()).toContain(
      'reappointment',
    )
    expect(tenureSentence(config('ecb', 'medium')).toLowerCase()).toMatch(
      /not allow to be renewed|cannot be renewed|non-renewable/,
    )
  })

  it('tells the tutorial it ends on its objective rather than on a clock', () => {
    for (const institution of INSTITUTIONS) {
      const sentence = tenureSentence(config(institution, 'easy'))
      expect(sentence.toLowerCase()).toContain('consecutive meetings')
      // It must not promise a term it does not have: the tutorial has no
      // reappointment hearing and no Governing Council to lose.
      expect(sentence.toLowerCase()).not.toContain('revoked')
    }
  })

  it('gives the difficulty selector a length claim it can keep', () => {
    // The selector said "12 scheduled meetings". Whatever it says now must not
    // be a count, because difficulty no longer sets one.
    for (const difficulty of DIFFICULTIES) {
      const label = difficultyLength(difficulty)
      expect(
        label.match(/\d/),
        `the difficulty selector says "${label}" for ${difficulty}. Difficulty ` +
          'stopped setting the mandate length when survival landed; a number here ' +
          'is a promise the engine does not keep.',
      ).toBeNull()
    }
  })

  it('a scenario still states its calendar, because a scenario is one', () => {
    const scenario = createRunConfig({
      institution: 'fed',
      difficulty: 'hard',
      seed: 'LENGTH-COPY',
      simulationVersion: SIMULATION_VERSION,
      scenario: 'volcker_1979',
    })
    const sentence = tenureSentence(scenario)
    expect(sentence).toContain(String(scenario.meetingCount))
    expect(sentence.toLowerCase()).toContain('the period itself')
  })
})

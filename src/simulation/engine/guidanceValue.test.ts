import { describe, expect, it } from 'vitest'
import type { Difficulty, Institution } from '../types/core.ts'
import type { PolicyPackage } from '../types/policy.ts'
import { SIMULATION_VERSION } from '../version.ts'
import { createRunConfig } from '../engine/initialState.ts'
import { playRun, type RunSession } from '../replay/replayRun.ts'
import { toolkitPackage } from '../policy/toolkitRule.ts'
import { bankedTotal } from '../scoring/banked.ts'

/**
 * **What speaking is worth, in the currency the player is paid in.**
 *
 * `guidance.test.ts`'s falsifiable criterion already asserts that honest
 * announcement beats silence, and it is a good test. It measures two things
 * this one deliberately does not:
 *
 *  - it measures `calculateScore`, the **graded** scorecard, which is still a
 *    path average and therefore rewards a mandate for ending early;
 *  - it measures **easy only**, where every mandate survives, so survival
 *    cannot be the channel and the whole effect has to show up in points.
 *
 * The player's correction was that the earlier *reporting* measured the
 * mechanism rather than the gain:
 *
 * > "Ça mesure le MÉCANISME, pas le GAIN. Donne-moi la valeur en POINTS DE
 * > SCORE : est-ce qu'un joueur compétent qui parle bat un joueur compétent
 * > qui ne parle jamais, en fin de partie réussie ?"
 *
 * Measured in `dev/guidanceValue.ts`, the answer has two halves and the second
 * one is the instrument:
 *
 *  1. **At the end of a successful mandate, the gain is a coin flip.** On
 *     ecb/medium, the only bucket with enough mandates that both arms survived
 *     to compare, speaking banked 5,429 against silence's 5,212 and won 15 of
 *     30. That is noise with a sign on it, and on its own it would mean the
 *     instrument is decorative.
 *  2. **Conditioning on success is what hides it.** Speaking is not what wins
 *     points in a mandate that succeeded; it is what makes the mandate
 *     succeed. On ecb/medium 48 of 80 mandates survived speaking against 33
 *     silent, median tenure 64 against 51; on fed/medium, 9 against 3.
 *     Restricting to pairs where *both* arms survived throws away precisely
 *     the seeds where the instrument did its work.
 *
 * And because the banked score multiplies length by quality, that survival
 * gain *is* the points gain once the conditioning comes off: ecb/medium banks
 * 3,856 speaking against 2,526 silent.
 *
 * So this test asserts the load-bearing claim, which is about tenure, at the
 * difficulty where survival is in question. Silence is not given a worse
 * package — it is given the *same* package, unannounced, and it is advantaged
 * on the one axis the conduct gate measures, because a committee that promises
 * nothing breaks no promises.
 */

const SEEDS = 40

/** Paired arms: the same economy and the same package, spoken or not. */
function serve(
  institution: Institution,
  difficulty: Difficulty,
  seed: string,
  talks: boolean,
): { readonly survived: boolean; readonly meetings: number; readonly banked: number } {
  const config = createRunConfig({
    institution,
    difficulty,
    seed,
    simulationVersion: SIMULATION_VERSION,
  })
  const session = playRun(config, (current: RunSession): PolicyPackage => {
    const base = toolkitPackage(current, institution, difficulty)
    return talks ? base : { ...base, communication: null }
  })
  return {
    survived: session.outcome.status === 'completed',
    meetings: session.state.meetingIndex,
    banked: bankedTotal(session.state).total,
  }
}

describe('speaking keeps you in the job', () => {
  for (const institution of ['fed', 'ecb'] as const) {
    it(`a committee that says what it is doing serves longer on ${institution}/medium`, () => {
      let spokenServed = 0
      let silentServed = 0
      let spokenMeetings = 0
      let silentMeetings = 0
      let spokenBanked = 0
      let silentBanked = 0

      for (let seed = 0; seed < SEEDS; seed += 1) {
        const key = `guidance-value-${seed}`
        const spoken = serve(institution, 'medium', key, true)
        const silent = serve(institution, 'medium', key, false)
        if (spoken.survived) spokenServed += 1
        if (silent.survived) silentServed += 1
        spokenMeetings += spoken.meetings
        silentMeetings += silent.meetings
        spokenBanked += spoken.banked
        silentBanked += silent.banked
      }

      /*
       * Tenure is the primary claim, because it is the one the structure is
       * built on: a mandate is served until it is lost, and the banked score
       * multiplies how long by how well. A margin rather than a bare
       * inequality — "longer on average" would pass on a rounding error — and
       * stated as a share so it survives a change to the term length.
       */
      const spokenTenure = spokenMeetings / SEEDS
      const silentTenure = silentMeetings / SEEDS
      expect(
        spokenTenure,
        `on ${institution}/medium a committee that announces its intentions served ` +
          `${spokenTenure.toFixed(1)} meetings against ${silentTenure.toFixed(1)} for the ` +
          'same committee saying nothing. Communication is the second instrument and ' +
          'its whole value is here: if this margin closes, speaking has become ' +
          'decorative. Measure it with dev/guidanceValue.ts before touching the bound.',
      ).toBeGreaterThan(silentTenure * 1.05)

      // And it must not be buying tenure by banking worse meetings: a chair
      // who survives longer on a worse economy is not a chair the score should
      // prefer, and the banked total is the number that would catch it.
      expect(
        spokenBanked / SEEDS,
        `speaking served longer on ${institution}/medium but banked ` +
          `${(spokenBanked / SEEDS).toFixed(0)} against silence's ` +
          `${(silentBanked / SEEDS).toFixed(0)}. Tenure bought with worse meetings is ` +
          'not a gain.',
      ).toBeGreaterThan(silentBanked / SEEDS)

      /*
       * **The survival *count* is deliberately not asserted, and the reason is
       * a finding.** It is the more legible statistic — "speaking saved
       * fifteen careers out of eighty" is a sentence a player understands, and
       * on ecb/medium it holds comfortably at 48 against 33. On fed/medium it
       * cannot be asserted at any sample size this suite can afford, because
       * the base rate is about one mandate in ten: measured over 80 paired
       * seeds, 9 survived speaking against 3 silent, and over the 40 here, 1
       * against 2. A bound over counts that small would be a coin that fails
       * the build.
       *
       * That the benchmark rule clears a Fed reappointment roughly a tenth of
       * the time is itself worth knowing and is recorded in docs/QUESTIONS.md.
       * It is not what this test is about, and asserting it here would make a
       * guidance test fail whenever the hearing's bar moved.
       */
      void spokenServed
      void silentServed
    }, 120_000)
  }
})

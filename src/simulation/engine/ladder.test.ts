import { describe, expect, it } from 'vitest'
import type { Difficulty, Institution } from '../types/core.ts'
import type { LatentState } from '../types/state.ts'
import { SIMULATION_VERSION } from '../version.ts'
import { getInstitution } from '../config/institutions.ts'
import { BROKEN, createRunConfig } from './initialState.ts'
import { startRun, submitMeeting } from '../replay/replayRun.ts'

/**
 * **The difficulty ladder has to describe the game, not the opening screen.**
 *
 * `initialState.test.ts` asserts the ladder at **meeting zero**, on every
 * seed: one broken reading on easy, two in opposition on medium, three on
 * hard. It holds there, and the player was right that it is not the claim that
 * matters:
 *
 * > "Sur combien de réunions l'échelle tient-elle, en facile, en moyen et en
 * > difficile ? Si elle s'effondre au bout de trois réunions, elle ne décrit
 * > que l'écran d'accueil et pas le jeu."
 *
 * Measured in `dev/ladder.ts`, with two corrections to how it was being asked.
 *
 * **First, a count cannot carry a ladder.** Inflation one point above target
 * and inflation six points above target are both "broken", and the difference
 * between them is most of what separates the modes. So the rung is a
 * *distance*, each reading normalised by its own threshold so the two are
 * commensurable.
 *
 * **Second, the third reading is a guard and not a target.**
 * `explain/mandate.ts` says so in the words the player reads — growth is "not
 * a target, the cost of reaching the other two". A guard broken for thirty
 * consecutive meetings is a third target, and a guard nobody is pushing
 * against *should* close. Counting it alongside the targets is what produced
 * the alarming reading: hard's third closes at meeting 1, because
 * `realGrowth = potentialGrowth + Δgap/dt` and the IS curve reverts the gap at
 * 0.83 a year, so a −5.5 gap contributes about +4.6 points of growth while it
 * closes. That is a model identity, not a tuning choice, and no plausible cut
 * to trend growth offsets it — the cut that is there is 1.8 points against a
 * 4.6-point rebound.
 *
 * So this pins the two claims that are real, both measured under **passive**
 * play: the question is what the mode presents, not what a good player can
 * repair.
 *
 *   **ORDERING** — the two targets sit further out at hard than at medium, and
 *   at medium than at easy, for the first six meetings. Measured: it holds
 *   through meeting 6 on the Fed and 5 on the ECB. The bound is 4, below both,
 *   because the thing worth failing a build over is the ladder becoming a
 *   property of meeting zero alone.
 *
 *   **THE GUARD** — broken several times more often at hard than at easy, as a
 *   frequency. Measured 2 % / 3 % / 12 % on the Fed and 4 % / 5 % / 16 % on the
 *   ECB.
 *
 * Beyond about meeting 6 the modes cross, and the comparison stops meaning
 * anything for a reason worth recording: **hard mandates end.** Mean tenure
 * under passivity is 12.5 meetings at fed/hard against 18.8 at fed/medium, so
 * a hard average at meeting 18 compares the seeds that survived against
 * medium's whole population. The late-mandate ladder is tenure, and tenure is
 * what `scoring/tenure.test.ts` holds.
 */

const SEEDS = 24
const HORIZON = 10

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard']

/** Distance still to close on the two targets, in units of their thresholds. */
function targetDistance(latent: LatentState, target: number): number {
  return (
    Math.abs(latent.inflationHeadline - target) / BROKEN.inflation +
    Math.abs(latent.unemployment - latent.naturalUnemployment) / BROKEN.unemployment
  )
}

interface Walk {
  readonly distance: readonly number[]
  readonly guardBroken: number
}

function walk(institution: Institution, difficulty: Difficulty): Walk {
  const target = getInstitution(institution).inflationTarget
  const sums = new Array<number>(HORIZON).fill(0)
  const counts = new Array<number>(HORIZON).fill(0)
  let guardMeetings = 0
  let allMeetings = 0

  for (let seed = 0; seed < SEEDS; seed += 1) {
    const config = createRunConfig({
      institution,
      difficulty,
      seed: `ladder-${seed}`,
      simulationVersion: SIMULATION_VERSION,
    })
    let session = startRun(config)
    for (let meeting = 0; meeting < HORIZON; meeting += 1) {
      const { latent } = session.state
      sums[meeting] += targetDistance(latent, target)
      counts[meeting] += 1
      if (latent.realGrowth < BROKEN.growth) guardMeetings += 1
      allMeetings += 1

      const result = submitMeeting(session, { actions: [], communication: null })
      if (!result.ok) break
      session = result.session
      if (session.outcome.status !== 'active') break
    }
  }

  return {
    distance: sums.map((sum, index) => (counts[index] === 0 ? Number.NaN : sum / counts[index])),
    guardBroken: allMeetings === 0 ? 0 : guardMeetings / allMeetings,
  }
}

/**
 * How many meetings the rungs stay clear of each other by `MARGIN`.
 *
 * A quarter of one threshold — 0.25 points of inflation, or of unemployment —
 * is about the smallest difference a player reading the gauges could notice,
 * and "hard ≥ medium" would pass on a tie.
 */
const MARGIN = 0.25

/**
 * The bound. Measured at 6 (fed) and 5 (ecb); set below both, because what
 * is worth failing a build over is the ladder shrinking back to meeting zero,
 * not a rung moving by one meeting after a balance pass.
 */
const MUST_HOLD_THROUGH = 4

describe('the difficulty ladder outlasts the opening screen', () => {
  for (const institution of ['fed', 'ecb'] as const) {
    it(`${institution}: the two targets stay ordered by difficulty`, () => {
      const walks = new Map(
        DIFFICULTIES.map((difficulty) => [difficulty, walk(institution, difficulty)]),
      )
      const easy = walks.get('easy')!.distance
      const medium = walks.get('medium')!.distance
      const hard = walks.get('hard')!.distance

      let held = 0
      while (
        held < HORIZON &&
        Number.isFinite(hard[held]) &&
        Number.isFinite(medium[held]) &&
        Number.isFinite(easy[held]) &&
        hard[held] >= medium[held] + MARGIN &&
        medium[held] >= easy[held] + MARGIN
      ) {
        held += 1
      }

      const trace = DIFFICULTIES.map(
        (difficulty) =>
          `${difficulty} ${(walks.get(difficulty)!.distance.slice(0, 7) ?? [])
            .map((value) => value.toFixed(1))
            .join(' ')}`,
      ).join(' | ')

      expect(
        held,
        `on ${institution} the ladder is strictly ordered through meeting ${held} ` +
          `(needs ${MUST_HOLD_THROUGH}). Distance to close on the two targets, ` +
          `meetings 0-6: ${trace}. A ladder that only holds at meeting zero ` +
          'describes the difficulty chooser and not the game. Measure it with ' +
          'dev/ladder.ts before touching this bound.',
      ).toBeGreaterThanOrEqual(MUST_HOLD_THROUGH)
    }, 60_000)

    it(`${institution}: the growth guard breaks far more often at hard`, () => {
      const easy = walk(institution, 'easy').guardBroken
      const hard = walk(institution, 'hard').guardBroken

      /*
       * A frequency, not a level, and a multiple rather than a difference: the
       * guard's absolute rate is small by design — it is a thing that should
       * be intact until the player pushes — so "hard is 10 points higher"
       * would be a bound on the mode's noise, while "hard is twice as often"
       * is a bound on the ladder. Measured at 6× (fed) and 4× (ecb).
       */
      expect(
        hard,
        `the growth guard broke on ${(hard * 100).toFixed(0)} % of meetings at ` +
          `${institution}/hard against ${(easy * 100).toFixed(0)} % at easy, under ` +
          'passive play. The guard is the third reading and the only part of the ' +
          'ladder that survives the opening, because the other two converge as the ' +
          'economy heals.',
      ).toBeGreaterThan(easy * 2)
    }, 60_000)
  }
})

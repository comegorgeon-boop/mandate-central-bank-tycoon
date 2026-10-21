/**
 * Developer-only calibration: the dispersion the euro area produces on its own.
 *
 * `COHESION_TOLERANCE` is the one number in `config/scoring.ts` that is
 * hand-set against the rest of the configuration rather than derived from it.
 * It is the floor of the blended dispersion penalty *however well the area is
 * steered* — Spain's labour market is the most cyclical in the union, Italy
 * carries the heaviest debt, the members open apart, and none of that is the
 * chair's doing. Charging for it is scoring the weather and calling it policy.
 *
 * Which means it moves whenever anything upstream of member dispersion moves:
 * the member profiles in `config/members.ts`, the member shocks, or — as
 * happened when hard's term was cut to 24 meetings and its events made 15 %
 * more severe to compensate — the event configuration. The last handoff warned
 * that this constant would need re-measuring and that the script which did it
 * lived in a scratchpad that did not survive. This is that script, committed.
 *
 * **It got this wrong once, and the correction is the reason to read it.** This
 * script used to declare its own `dispersion` — an unweighted population
 * standard deviation — and say in its own docstring that it "duplicates the
 * three lines of `calculateScore` that build the penalty". The score charges a
 * *GDP-weighted mean absolute deviation*, which is a different statistic, so
 * the tolerance that decides whether the chair is charged anything at all was
 * calibrated against a number the chair is never charged on. Both now call
 * `scoring/cohesionPenalty.ts`, which exists so there is one of it.
 *
 * Run with: npx tsx src/simulation/dev/cohesion.ts
 *
 * Read the output as: **the tolerance belongs at about the `competent` floor**
 * — the lowest penalty a well-played area reaches — and the gap between the
 * competent and passive columns is the part the chair actually controls. If
 * that gap closes, the component has gone back to being a constant subtracted
 * from every ECB score and the tolerance is not the fix.
 */

import type { Difficulty } from '../types/core.ts'
import { SIMULATION_VERSION } from '../version.ts'
import { COHESION_TOLERANCE } from '../config/scoring.ts'
import { createRunConfig } from '../engine/initialState.ts'
import { calculateScore } from '../scoring/calculateScore.ts'
import { cohesionPenalty } from '../scoring/cohesionPenalty.ts'
import { playRun } from '../replay/replayRun.ts'
import { toolkitPackage } from '../policy/toolkitRule.ts'

const RUNS = 100

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard']

function quantile(values: readonly number[], fraction: number): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))]
}

function main(): void {
  console.log('')
  console.log(`Cohesion floor — engine ${SIMULATION_VERSION}`)
  console.log(`${RUNS} ECB mandates a cell. COHESION_TOLERANCE is currently ${COHESION_TOLERANCE}`)
  console.log('='.repeat(80))
  console.log(
    ['bucket'.padEnd(20), 'min'.padEnd(7), 'p10'.padEnd(7), 'median'.padEnd(7), 'p90'.padEnd(7), 'score'].join(' '),
  )
  console.log('-'.repeat(80))

  for (const difficulty of DIFFICULTIES) {
    for (const play of ['competent', 'passive'] as const) {
      const penalties: number[] = []
      const components: number[] = []
      for (let index = 0; index < RUNS; index += 1) {
        const config = createRunConfig({
          institution: 'ecb',
          difficulty,
          seed: `cohesion-${index}`,
          simulationVersion: SIMULATION_VERSION,
        })
        const session = playRun(config, (current) =>
          play === 'competent'
            ? toolkitPackage(current, 'ecb', difficulty)
            : { actions: [], communication: null },
        )
        penalties.push(cohesionPenalty(session.state.history))
        const score = calculateScore(session.state, session.outcome)
        const cohesion = score.components.find((c) => c.id === 'cohesion')
        if (cohesion) components.push(cohesion.raw)
      }
      console.log(
        [
          `ecb/${difficulty} ${play}`.padEnd(20),
          quantile(penalties, 0).toFixed(2).padEnd(7),
          quantile(penalties, 0.1).toFixed(2).padEnd(7),
          quantile(penalties, 0.5).toFixed(2).padEnd(7),
          quantile(penalties, 0.9).toFixed(2).padEnd(7),
          quantile(components, 0.5).toFixed(2),
        ].join(' '),
      )
    }
  }

  console.log('-'.repeat(80))
  console.log('')
}

main()

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
 * Run with: node src/simulation/dev/cohesion.ts
 *
 * Read the output as: **the tolerance belongs at about the `competent` floor**
 * — the lowest penalty a well-played area reaches — and the gap between the
 * competent and passive columns is the part the chair actually controls. If
 * that gap closes, the component has gone back to being a constant subtracted
 * from every ECB score and the tolerance is not the fix.
 */

import type { Difficulty } from '../types/core.ts'
import { SIMULATION_VERSION } from '../version.ts'
import { COHESION_BLEND, COHESION_TOLERANCE } from '../config/scoring.ts'
import { createRunConfig } from '../engine/initialState.ts'
import { calculateScore } from '../scoring/calculateScore.ts'
import { playRun } from '../replay/replayRun.ts'
import { toolkitPackage } from '../policy/toolkitRule.ts'

const RUNS = 100

const DIFFICULTIES: readonly Difficulty[] = ['medium', 'hard']

function dispersion(
  members: readonly { readonly inflationOffset: number; readonly unemploymentOffset: number }[],
  key: 'inflationOffset' | 'unemploymentOffset',
): number {
  const values = members.map((member) => member[key])
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  return Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length)
}

/**
 * The blended penalty, recomputed here rather than read off the score.
 *
 * The score only exposes the component *after* the tolerance has been
 * subtracted and the scale applied, so it cannot say where the floor is. This
 * duplicates the three lines of `calculateScore` that build the penalty, which
 * is the price of being able to measure the input to a constant that is itself
 * an input to the score.
 */
function penaltyOf(
  history: readonly {
    readonly members: readonly {
      readonly inflationOffset: number
      readonly unemploymentOffset: number
      readonly spread: number
    }[]
  }[],
): number {
  const perMeeting = history.map((snapshot) => {
    const members = snapshot.members
    if (members.length === 0) return 0
    const spreads = members.map((member) => member.spread)
    const range = Math.max(...spreads) - Math.min(...spreads)
    return (
      COHESION_BLEND.inflation * dispersion(members, 'inflationOffset') +
      COHESION_BLEND.unemployment * dispersion(members, 'unemploymentOffset') +
      range / COHESION_BLEND.spreadRange
    )
  })
  return perMeeting.reduce((a, b) => a + b, 0) / Math.max(1, perMeeting.length)
}

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
        penalties.push(penaltyOf(session.state.history))
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

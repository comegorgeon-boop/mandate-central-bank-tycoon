/**
 * How long does the opening's damage last?
 *
 * The ladder is the *number* of broken readings, and it is only a ladder if
 * the number holds for a while. A medium opening whose slump closes on its
 * own by the third meeting is a one-problem game wearing a two-problem
 * opening — which is the "it heals itself" trap this project has fallen into
 * twice before, most recently with a tutorial that passive play solved 16
 * times in 30.
 *
 * Played with the rate held, which is the honest test: if doing nothing
 * repairs it, the opening was decoration.
 *
 * Run with: npx tsx src/simulation/dev/persistence.ts
 */
import { SIMULATION_VERSION } from '../version.ts'
import { createRunConfig } from '../engine/initialState.ts'
import { startRun, submitMeeting } from '../replay/replayRun.ts'
import { inflationTargetFor } from '../scenarios/scenarios.ts'
import { BROKEN } from '../engine/initialState.ts'
import type { Difficulty, Institution } from '../types/core.ts'

const SEEDS = 20
const HOLD = { actions: [], communication: null } as const

function brokenAt(
  latent: { inflationHeadline: number; unemployment: number; naturalUnemployment: number; realGrowth: number },
  target: number,
): number {
  let n = 0
  if (Math.abs(latent.inflationHeadline - target) > BROKEN.inflation) n += 1
  if (Math.abs(latent.unemployment - latent.naturalUnemployment) > BROKEN.unemployment) n += 1
  if (latent.realGrowth < BROKEN.growth) n += 1
  return n
}

function run(institution: Institution, difficulty: Difficulty) {
  const counts: number[][] = []
  for (let seed = 0; seed < SEEDS; seed += 1) {
    const config = createRunConfig({
      institution,
      difficulty,
      seed: `PERSIST-${seed}`,
      simulationVersion: SIMULATION_VERSION,
    })
    const target = inflationTargetFor(config)
    let session = startRun(config)
    const row: number[] = []
    for (let meeting = 0; meeting < 26; meeting += 1) {
      row.push(brokenAt(session.state.latent, target))
      const result = submitMeeting(session, HOLD)
      if (!result.ok) break
      session = result.session
      if (session.outcome.status !== 'active') break
    }
    counts.push(row)
  }

  const at = (meeting: number) => {
    const values = counts.map((row) => row[meeting]).filter((v) => v !== undefined)
    return values.length === 0
      ? '—'
      : (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)
  }

  console.log(
    `${`${institution}/${difficulty}`.padEnd(13)}` +
      [0, 1, 2, 4, 8, 12, 16, 20].map((m) => `m${m}: ${at(m)}`).join('   '),
  )
}

console.log('')
console.log('Broken readings over time, holding the rate')
console.log('='.repeat(96))
for (const institution of ['fed', 'ecb'] as const) {
  for (const difficulty of ['easy', 'medium', 'hard'] as Difficulty[]) {
    run(institution, difficulty)
  }
}
console.log('')
console.log('A rung that decays toward the one below it is decoration: the opening')
console.log('has to still be the problem several meetings in.')

/**
 * Paired skill-versus-passivity survival, at a sample that can resolve it.
 *
 * Run with: npx tsx src/simulation/dev/skillCheck.ts
 *
 * The suite's own version runs 40 seeds because it runs in the ordinary suite.
 * That is enough for the order-of-magnitude effects around it and not enough
 * for this one: the documented gap is 61 % against 39 %, and the *discordant*
 * pairs — the only ones the paired test counts — are a handful at forty draws.
 */
import { SIMULATION_VERSION } from '../version.ts'
import { createRunConfig } from '../engine/initialState.ts'
import { playRun } from '../replay/replayRun.ts'
import { toolkitPackage } from '../policy/toolkitRule.ts'
import type { Institution } from '../types/core.ts'

/**
 * No command-line argument, by the convention the other scripts here record:
 * they live under `src` and compile against the app's tsconfig, which has no
 * node types. Change the constant to re-measure at another sample.
 */
const RUNS = 240

for (const institution of ['fed', 'ecb'] as readonly Institution[]) {
  const skilled: boolean[] = []
  const idle: boolean[] = []
  for (let index = 0; index < RUNS; index += 1) {
    const config = () =>
      createRunConfig({
        institution,
        difficulty: 'hard',
        seed: `winnability-${index}`,
        simulationVersion: SIMULATION_VERSION,
      })
    skilled.push(
      playRun(config(), (session) => toolkitPackage(session, institution, 'hard'))
        .outcome.status === 'completed',
    )
    idle.push(
      playRun(config(), () => ({ actions: [], communication: null })).outcome
        .status === 'completed',
    )
  }
  let skillWins = 0
  let idleWins = 0
  for (let i = 0; i < RUNS; i += 1) {
    if (skilled[i] && !idle[i]) skillWins += 1
    if (idle[i] && !skilled[i]) idleWins += 1
  }
  const pct = (n: number) => `${((n / RUNS) * 100).toFixed(1)} %`
  console.log(
    `${institution}/hard over ${RUNS}: skill completes ${pct(
      skilled.filter(Boolean).length,
    )}, idle ${pct(idle.filter(Boolean).length)} — paired ${skillWins} / ${idleWins}`,
  )
}

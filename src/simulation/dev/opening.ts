/**
 * What does a player actually arrive to?
 *
 * The complaint this answers is the structural half of "on se perd":
 *
 * > "je commence dans une économie presque normale — 1,4 point d'inflation en
 * > trop et un chômage à son niveau soutenable. Il n'y a rien à réparer, donc
 * > rien à viser."
 *
 * So this prints the opening board, averaged over seeds, against the figures
 * the brief asked for. The gaps are what matter; the levels differ between
 * institutions because their sustainable rates do.
 *
 * Run with: npx tsx src/simulation/dev/opening.ts
 */
import { SIMULATION_VERSION } from '../version.ts'
import { createRunConfig, createInitialState } from './../engine/initialState.ts'
import { getInstitution } from '../config/institutions.ts'
import type { Difficulty, Institution } from '../types/core.ts'

const SEEDS = 24

function mean(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length
}

function show(institution: Institution, difficulty: Difficulty) {
  const inst = getInstitution(institution)
  const inflation: number[] = []
  const unemployment: number[] = []
  const uGap: number[] = []
  const growth: number[] = []
  const supply: number[] = []
  const anchor: number[] = []

  for (let seed = 0; seed < SEEDS; seed += 1) {
    const state = createInitialState(
      createRunConfig({
        institution,
        difficulty,
        seed: `OPEN-${seed}`,
        simulationVersion: SIMULATION_VERSION,
      }),
    )
    const l = state.latent
    inflation.push(l.inflationHeadline)
    unemployment.push(l.unemployment)
    uGap.push(l.unemployment - l.naturalUnemployment)
    growth.push(l.realGrowth)
    supply.push(l.supplyShock)
    anchor.push(l.anchoring)
  }

  console.log(
    `${`${institution}/${difficulty}`.padEnd(12)}` +
      `inflation ${mean(inflation).toFixed(1).padStart(5)} % (target ${inst.inflationTarget.toFixed(1)}, +${(mean(inflation) - inst.inflationTarget).toFixed(1)})  ` +
      `unemployment ${mean(unemployment).toFixed(1).padStart(5)} % (+${mean(uGap).toFixed(1)} over sustainable)  ` +
      `growth ${mean(growth).toFixed(1).padStart(5)} %  ` +
      `supply ${mean(supply).toFixed(1).padStart(4)}  ` +
      `anchor ${mean(anchor).toFixed(2)}`,
  )
}

console.log('')
console.log('The board a player arrives to')
console.log('='.repeat(132))
for (const institution of ['fed', 'ecb'] as const) {
  for (const difficulty of ['easy', 'medium', 'hard'] as Difficulty[]) {
    show(institution, difficulty)
  }
  console.log('')
}
console.log('Asked for: easy ~5 % / ~7 %, medium ~8 % / ~8.5 % and negative growth,')
console.log('hard worse. Levels are Fed-shaped; the ECB equivalents run higher')
console.log('because its sustainable rate is 6.6 % against the Fed’s 4.2 %.')

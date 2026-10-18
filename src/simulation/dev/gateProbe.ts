/**
 * Does a candidate chain gate actually separate skilled play from passive?
 *
 * A containment gate is only a containment gate if the two populations fall on
 * different sides of it. Set from a guess it is just another adverse event
 * landing on everybody, which is what the first three were: one fired on a
 * quarter of *both* populations' meetings, and two could not fire at all —
 * one tested an index near 100 as though it were a percentage, the other a
 * threshold neither population ever reached.
 *
 * Run with: npx tsx src/simulation/dev/gateProbe.ts — edit `institution` and
 * `CANDIDATES` to ask a different question; no command-line arguments,
 * because these scripts compile against the app's tsconfig, which has no node
 * types. (The first draft of this file asked about a `neutralRate` field that
 * does not exist on `LatentState`; it reported 0 % for both populations and
 * the build is what noticed.)
 *
 * Reports, per candidate, the share of meetings on which it is true under each
 * population. A useful gate is rare under skill and several times commoner
 * under passivity.
 */
import { SIMULATION_VERSION } from '../version.ts'
import { createRunConfig } from '../engine/initialState.ts'
import { playRun } from '../replay/replayRun.ts'
import { toolkitPackage } from '../policy/toolkitRule.ts'
import type { Institution } from '../types/core.ts'
import type { LatentState } from '../types/state.ts'

const RUNS = 120

const CANDIDATES: Record<string, (l: LatentState) => boolean> = {
  'short exp > 3.2': (l) => l.expectedInflationShort > 3.2,
  'short exp > 4.0': (l) => l.expectedInflationShort > 4.0,
  'long exp > 2.4': (l) => l.expectedInflationLong > 2.4,
  'long exp > 2.5': (l) => l.expectedInflationLong > 2.5,
  'wage > 6 & long exp > 2.35': (l) =>
    l.wageGrowth > 6 && l.expectedInflationLong > 2.35,
  'fx < 90': (l) => l.exchangeRate < 90,
  'fx < 85': (l) => l.exchangeRate < 85,
  'fx < 85 & vol > 25': (l) => l.exchangeRate < 85 && l.marketVolatility > 25,
}

const institution: Institution = 'fed'
const share: Record<string, Record<string, number>> = {}

for (const [label, choose] of [
  ['skill', (s: never) => toolkitPackage(s, institution, 'hard')],
  ['idle', () => ({ actions: [], communication: null })],
] as const) {
  const hits: Record<string, number> = {}
  let total = 0
  for (let index = 0; index < RUNS; index += 1) {
    const config = createRunConfig({
      institution,
      difficulty: 'hard',
      seed: `winnability-${index}`,
      simulationVersion: SIMULATION_VERSION,
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = playRun(config, choose as any)
    for (const snapshot of session.state.history) {
      total += 1
      for (const [name, test] of Object.entries(CANDIDATES)) {
        if (test(snapshot.latent)) hits[name] = (hits[name] ?? 0) + 1
      }
    }
  }
  share[label] = Object.fromEntries(
    Object.keys(CANDIDATES).map((name) => [name, ((hits[name] ?? 0) / total) * 100]),
  )
}

console.log(`${institution}/hard, ${RUNS} runs — share of meetings the gate is open`)
console.log('  gate'.padEnd(34) + 'skill    idle   ratio')
for (const name of Object.keys(CANDIDATES)) {
  const s = share.skill[name]
  const i = share.idle[name]
  const ratio = s < 0.05 ? '—' : (i / s).toFixed(2)
  console.log(
    `  ${name.padEnd(32)}${s.toFixed(1).padStart(5)} %${i.toFixed(1).padStart(7)} %${String(ratio).padStart(8)}`,
  )
}

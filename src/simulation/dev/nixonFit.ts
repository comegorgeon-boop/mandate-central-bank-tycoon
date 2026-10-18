/**
 * Does 1972-74 produce 1972-74?
 *
 * The question every historical scenario has to answer before it ships, and
 * the only one the suite cannot ask for it: the tests check that the opening
 * matches the sourced table and that the mandate is playable, not that the
 * *arc* is the period's. A scenario whose inflation never leaves 4 % would
 * pass every test in this repository and teach the opposite of what happened.
 *
 * Run with: npx tsx src/simulation/dev/nixonFit.ts
 */
import { SIMULATION_VERSION } from '../version.ts'
import { createRunConfig } from '../engine/initialState.ts'
import { playRun } from '../replay/replayRun.ts'
import { toolkitPackage } from '../policy/toolkitRule.ts'
import { getScenario } from '../scenarios/scenarios.ts'

const scenario = getScenario('nixon_burns_1972')

/** What the Federal Reserve actually did, for the same slots. */
const actual = scenario.calendar

for (const [label, choose] of [
  ['benchmark-ish (the rule)', null],
  ['holding at 3.51 throughout', 'hold'],
] as const) {
  const config = createRunConfig({
    institution: 'fed',
    difficulty: 'hard',
    seed: 'NIXON-FIT',
    scenario: 'nixon_burns_1972',
    simulationVersion: SIMULATION_VERSION,
  })
  const session = playRun(config, (s) =>
    choose === 'hold'
      ? { actions: [], communication: null }
      : toolkitPackage(s, 'fed', 'hard'),
  )
  console.log(`\n${label} — ${session.state.history.length} meetings, outcome ${session.outcome.status}`)
  console.log('  slot  month      rate   inflation   unemployment   (actual: rate / infl / unemp)')
  session.state.history.forEach((snapshot, index) => {
    if (index % 4 !== 0 && index !== session.state.history.length - 1) return
    const a = actual[index]
    console.log(
      `  ${String(index).padStart(4)}  ${(a?.date ?? '').slice(0, 7).padEnd(9)} ` +
        `${snapshot.latent.policyRate.toFixed(2).padStart(6)} ` +
        `${snapshot.latent.inflationHeadline.toFixed(2).padStart(10)} ` +
        `${snapshot.latent.unemployment.toFixed(2).padStart(14)}   ` +
        `(${a?.benchmarkRate?.toFixed(2) ?? '—'} / ${a?.actualInflation?.toFixed(2) ?? '—'} / ${a?.actualUnemployment?.toFixed(1) ?? '—'})`,
    )
  })
}

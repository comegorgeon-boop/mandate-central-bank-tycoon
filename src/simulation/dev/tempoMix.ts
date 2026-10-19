/**
 * What proportion of meetings are quick?
 *
 * The premise of the tempo split is that *most* meetings have nothing at
 * stake the committee has not already settled. If that is false — if the
 * model keeps something live at every meeting — then the split buys nothing
 * and the fast surface would be a lie about the state of the world.
 *
 * Run with: npx tsx src/simulation/dev/tempoMix.ts
 */
import { SIMULATION_VERSION } from '../version.ts'
import { createRunConfig } from '../engine/initialState.ts'
import { startRun, submitMeeting } from '../replay/replayRun.ts'
import { toolkitPackage } from '../policy/toolkitRule.ts'
import { readTempo } from '../meeting/tempo.ts'
import { SCENARIOS, instrumentRangesFor } from '../scenarios/scenarios.ts'
import { getInstrument, getInstrumentRange } from '../config/instruments.ts'
import type { Difficulty, Institution } from '../types/core.ts'

const SEEDS = 10

function run(label: string, institution: Institution, difficulty: Difficulty, scenario: string | null) {
  const counts = { quick: 0, full: 0, decisive: 0 }
  const reasons = new Map<string, number>()
  for (let seed = 0; seed < SEEDS; seed += 1) {
    const config = createRunConfig({
      institution, difficulty, seed: `TEMPO-${seed}`,
      scenario: scenario as never, simulationVersion: SIMULATION_VERSION,
    })
    let session = startRun(config)
    for (let meeting = 0; meeting < 60; meeting += 1) {
      const reading = readTempo(session)
      counts[reading.tempo] += 1
      if (reading.because !== null) {
        const key = reading.because.slice(0, 44)
        reasons.set(key, (reasons.get(key) ?? 0) + 1)
      }
      // The rate only, clamped to this run's own range: the full toolkit
      // proposes instruments some periods did not have, and a rejected
      // package would end the measurement at meeting one.
      const full = toolkitPackage(session, institution, difficulty)
      const move = full.actions.find((a) => a.instrument === 'policy_rate')
      const instrument = getInstrument('policy_rate')
      const range =
        instrument === undefined
          ? { min: -150, max: 150 }
          : getInstrumentRange(instrument, difficulty, instrumentRangesFor(session.state.config))
      const result = submitMeeting(session, {
        actions:
          move === undefined
            ? []
            : [
                {
                  instrument: 'policy_rate' as const,
                  magnitude: Math.max(range.min, Math.min(range.max, move.magnitude)),
                },
              ],
        communication: null,
      })
      if (!result.ok) break
      session = result.session
      if (session.outcome.status !== 'active') break
    }
  }
  const total = counts.quick + counts.full + counts.decisive
  const pct = (n: number) => `${((n / total) * 100).toFixed(0)} %`
  console.log(
    `${label.padEnd(26)} quick ${pct(counts.quick).padStart(5)}   full ${pct(counts.full).padStart(5)}   decisive ${counts.decisive}`,
  )
  const top = [...reasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2)
  for (const [reason, n] of top) console.log(`${' '.repeat(28)}${String(n).padStart(4)}× ${reason}`)
}

for (const [institution, difficulty] of [
  ['fed', 'easy'], ['fed', 'medium'], ['fed', 'hard'], ['ecb', 'hard'],
] as const) {
  run(`${institution}/${difficulty}`, institution, difficulty, null)
}
for (const scenario of SCENARIOS) {
  run(scenario.id, scenario.institution, scenario.rules, scenario.id)
}

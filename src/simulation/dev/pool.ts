/**
 * Does the event catalogue run out before a long tenure does?
 *
 * Written to diagnose a specific regression: the "never more than two calm
 * meetings in a row" guarantee was measured on 16- and 24-meeting mandates and
 * held at 2. Re-measured under tenure, where a mandate can run to 64, it came
 * back at 4 on fed/medium and **9** on fed/hard.
 *
 * Run with: npx tsx src/simulation/dev/pool.ts
 */
import { SIMULATION_VERSION } from '../version.ts'
import { createRunConfig } from '../engine/initialState.ts'
import { startRun, submitMeeting } from '../replay/replayRun.ts'
import { toolkitPackage } from '../policy/toolkitRule.ts'
import { EVENT_CATALOG } from '../events/catalog.ts'
import type { Difficulty } from '../types/core.ts'

const capacity = EVENT_CATALOG.reduce((sum, event) => sum + (event.maxOccurrences ?? 1), 0)
console.log(`Catalogue: ${EVENT_CATALOG.length} events, ${capacity} total firings available`)
console.log('='.repeat(96))

for (const difficulty of ['medium', 'hard'] as Difficulty[]) {
  let worstDry = 0
  let worstAt = 0
  let worstServed = 0
  const spent: number[] = []

  for (let seed = 0; seed < 24; seed += 1) {
    const config = createRunConfig({
      institution: 'fed',
      difficulty,
      seed: `POOL-${seed}`,
      simulationVersion: SIMULATION_VERSION,
    })
    let session = startRun(config)
    let dry = 0

    for (let meeting = 0; meeting < 70; meeting += 1) {
      const result = submitMeeting(session, toolkitPackage(session, 'fed', difficulty))
      if (!result.ok) break
      session = result.session
      const landed = session.majorEvent !== null || session.minorEvents.length > 0
      if (landed) {
        dry = 0
      } else {
        dry += 1
        if (dry > worstDry) {
          worstDry = dry
          worstAt = session.state.meetingIndex
          worstServed = session.state.meetingIndex
        }
      }
      if (session.outcome.status !== 'active') break
    }

    // Occurrences are rebuilt per call rather than stored on state, so the
    // run's own event log is the record of what has been spent.
    spent.push(session.state.eventLog.length / capacity)
  }

  const used = spent.reduce((a, b) => a + b, 0) / spent.length
  console.log(
    `fed/${difficulty.padEnd(7)} longest dry ${String(worstDry).padStart(2)} ` +
      `(ending at meeting ${String(worstAt).padStart(2)} of ${worstServed}) ` +
      `· catalogue spent ${(used * 100).toFixed(0)} % by the end`,
  )
}

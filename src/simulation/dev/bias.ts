/**
 * Which events deliver the catalogue's net inflation impulse?
 *
 * `balance.test.ts` measures the net per meeting and says whether it is
 * inside the band. It does not say *which* events put it there, which is the
 * only thing you can act on. This ranks them by delivered impulse × how often
 * they actually fire, which is the quantity that becomes drift.
 *
 * Run with: npx tsx src/simulation/dev/bias.ts
 */
import { SIMULATION_VERSION } from '../version.ts'
import { createRunConfig } from '../engine/initialState.ts'
import { applyPolicyPackage } from '../engine/applyPolicyPackage.ts'
import { advanceTrueState } from '../engine/advanceTrueState.ts'
import { createInitialState } from '../engine/initialState.ts'
import { resolveEvent, buildEventContext } from '../events/resolveEvent.ts'
import { EVENTS_BY_ID, isMajorEvent } from '../events/catalog.ts'
import { inflationImpulse } from '../events/inflationImpulse.ts'
import { getDifficulty } from '../config/difficulty.ts'
import type { Difficulty, Institution } from '../types/core.ts'

function measure(institution: Institution, difficulty: Difficulty, runs = 24) {
  const total: Record<string, number> = {}
  const count: Record<string, number> = {}
  let meetings = 0

  for (let run = 0; run < runs; run += 1) {
    let state = createInitialState(
      createRunConfig({
        institution,
        difficulty,
        seed: `bias-${run}`,
        simulationVersion: SIMULATION_VERSION,
      }),
    )
    const severity = getDifficulty(difficulty).eventSeverityScale
    for (let meeting = 0; meeting < state.config.meetingCount; meeting += 1) {
      const applied = applyPolicyPackage(state, { actions: [], communication: null })
      if (!applied.ok) break
      const ctx = buildEventContext(applied.state)
      const alreadyFired = applied.state.eventLog.length
      const resolution = resolveEvent(applied.state)
      meetings += 1
      for (const record of resolution.state.eventLog.slice(alreadyFired)) {
        const definition = EVENTS_BY_ID.get(record.eventId)
        if (definition === undefined) continue
        const impulse = inflationImpulse(definition, ctx) * severity
        total[record.eventId] = (total[record.eventId] ?? 0) + impulse
        count[record.eventId] = (count[record.eventId] ?? 0) + 1
      }
      state = advanceTrueState(resolution.state)
    }
  }

  const rows = Object.entries(total)
    .map(([id, sum]) => ({ id, sum, n: count[id] ?? 0 }))
    .sort((a, b) => a.sum - b.sum)

  const net = rows.reduce((a, r) => a + r.sum, 0)
  console.log(
    `\n${institution}/${difficulty}  net ${(net / meetings / getDifficulty(difficulty).eventSeverityScale).toFixed(3)} per meeting per unit severity`,
  )
  console.log('  most disinflationary:')
  for (const row of rows.slice(0, 6)) {
    console.log(
      `    ${row.id.padEnd(28)} ${row.sum.toFixed(1).padStart(7)}  (${String(row.n).padStart(3)} firings${isMajorEvent(row.id) ? ', MAJOR' : ''})`,
    )
  }
  console.log('  most inflationary:')
  for (const row of rows.slice(-4).reverse()) {
    console.log(
      `    ${row.id.padEnd(28)} ${row.sum.toFixed(1).padStart(7)}  (${String(row.n).padStart(3)} firings${isMajorEvent(row.id) ? ', MAJOR' : ''})`,
    )
  }
}

measure('fed', 'medium')
measure('fed', 'hard')

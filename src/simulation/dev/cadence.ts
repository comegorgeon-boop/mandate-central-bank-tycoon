/**
 * How often does anything actually happen?
 *
 * The complaint this exists to answer, from a played mandate:
 *
 * > "J'ai enchaîné HUIT réunions sans rien à décider. L'économie allait bien,
 * > j'ai mis des taux convenables, j'ai cliqué « hold » huit fois. Puis une
 * > crise bancaire est tombée d'un coup — et ÇA, c'était marrant. Il m'en faut
 * > beaucoup plus. Quand l'économie va bien, ton générateur se tait."
 *
 * Four numbers, all of them targets set by the person the game is for:
 *
 *  - **the longest run of nothing**, which must never exceed two
 *  - **majors per mandate**, which should be three or four rather than one
 *  - **overlap**, meetings where more than one shock is live at once
 *  - **what a calm economy produces**, because the whole defect is that calm
 *    is quiet and it should not be
 *
 * Run with: npx tsx src/simulation/dev/cadence.ts
 */
import { SIMULATION_VERSION } from '../version.ts'
import { createRunConfig } from '../engine/initialState.ts'
import { startRun, submitMeeting } from '../replay/replayRun.ts'
import { toolkitPackage } from '../policy/toolkitRule.ts'
import { readTempo } from '../meeting/tempo.ts'
import { isMajorEvent } from '../events/catalog.ts'
import { getInstrument, getInstrumentRange } from '../config/instruments.ts'
import { instrumentRangesFor } from '../scenarios/scenarios.ts'
import type { Difficulty, Institution } from '../types/core.ts'

const SEEDS = 40

/** A shock is "live" while its supply or financial impulse is still elevated. */
function liveShocks(latent: {
  readonly supplyShock: number
  readonly bankingStress: number
  readonly marketVolatility: number
  readonly geopoliticalRisk: number
}): number {
  let live = 0
  if (latent.supplyShock > 0.8) live += 1
  if (latent.bankingStress > 38) live += 1
  if (latent.marketVolatility > 26) live += 1
  if (latent.geopoliticalRisk > 45) live += 1
  return live
}

function median2(a: number[]): number {
  const s = [...a].sort((x, y) => x - y)
  return s[Math.floor(s.length / 2)] ?? 0
}
function p90(a: number[]): number {
  const s = [...a].sort((x, y) => x - y)
  return s[Math.floor(s.length * 0.9)] ?? 0
}

function measure(institution: Institution, difficulty: Difficulty) {
  let longestQuiet = 0
  let totalMajors = 0
  let overlapMeetings = 0
  let meetings = 0
  let mandates = 0
  const fragilities: number[] = []
  const quietRuns: number[] = []

  for (let seed = 0; seed < SEEDS; seed += 1) {
    const config = createRunConfig({
      institution,
      difficulty,
      seed: `CADENCE-${seed}`,
      simulationVersion: SIMULATION_VERSION,
    })
    let session = startRun(config)
    mandates += 1
    let quiet = 0
    let majors = 0

    for (let meeting = 0; meeting < 60; meeting += 1) {
      meetings += 1
      // "Nothing to decide" is a quick meeting at which **nothing landed** —
      // the state described as clicking hold eight times. A quick meeting
      // where an energy spike arrived is a decision taken on a fast surface,
      // which is the thing the fast surface is for; counting it as quiet
      // would be measuring the layout rather than the game.
      const { tempo } = readTempo(session)
      const nothingHappened =
        session.majorEvent === null && session.minorEvents.length === 0
      if (tempo === 'quick' && nothingHappened) {
        quiet += 1
        longestQuiet = Math.max(longestQuiet, quiet)
      } else {
        if (quiet > 0) quietRuns.push(quiet)
        quiet = 0
      }

      if (liveShocks(session.state.latent) >= 2) overlapMeetings += 1
      fragilities.push(session.state.latent.fragility)

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
      if (result.session.majorEvent !== null) majors += 1
      for (const record of result.session.minorEvents) {
        if (isMajorEvent(record.eventId)) majors += 1
      }
      if (session.outcome.status !== 'active') break
    }
    if (quiet > 0) quietRuns.push(quiet)
    totalMajors += majors
  }

  quietRuns.sort((a, b) => a - b)
  const median = quietRuns[Math.floor(quietRuns.length / 2)] ?? 0
  console.log(
    `${`${institution}/${difficulty}`.padEnd(14)}` +
      `longest quiet run ${String(longestQuiet).padStart(3)}  ` +
      `median run ${String(median).padStart(2)}  ` +
      `majors/mandate ${(totalMajors / mandates).toFixed(2).padStart(5)}  ` +
      `overlap ${((overlapMeetings / meetings) * 100).toFixed(0).padStart(3)} %  ` +
      `fragility med ${median2(fragilities).toFixed(0).padStart(3)} p90 ${p90(fragilities).toFixed(0).padStart(3)}`,
  )
}

console.log('Targets: longest quiet run <= 2, majors/mandate 3-4, overlap common')
console.log('='.repeat(92))
for (const [institution, difficulty] of [
  ['fed', 'easy'],
  ['fed', 'medium'],
  ['fed', 'hard'],
  ['ecb', 'medium'],
  ['ecb', 'hard'],
] as const) {
  measure(institution, difficulty)
}

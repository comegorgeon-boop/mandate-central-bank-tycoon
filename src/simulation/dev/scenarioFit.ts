/**
 * Developer-only: how well each historical scenario tracks what happened.
 *
 * The honest part of a historical scenario, and the part the project's own
 * rules make non-negotiable: **the fit is reported, including where it is
 * wrong.** Every fit table in `docs/SCENARIOS.md` is this script's output.
 *
 * What it does: replays the benchmark rate path — the rate that actually
 * prevailed, meeting by meeting — through the model on many seeds, and
 * compares the economy the model produces against the economy that happened,
 * which the calendar now carries (`actualInflation`, `actualCore`,
 * `actualUnemployment`).
 *
 * Three things it is careful about, all of them learned from the Volcker
 * calibration:
 *
 *  - **It plays the window, not only the rate.** A replay that moved the rate
 *    and nothing else would hand 1982 a banking crisis it did not have,
 *    because the Federal Reserve of 1982 was lending heavily while tightening.
 *    The same rule `features/result/theStandard.ts` uses, so the fit measured
 *    here is the fit of the benchmark the player is actually compared with.
 *  - **Endpoints are medians over the runs that served the full term.** A run
 *    that ended in a banking crisis at meeting nine has no ending to report,
 *    and averaging it in would quietly flatter every statistic.
 *  - **The share of seeds that survive is itself reported.** The historical
 *    path is played against *those seeds'* shocks rather than against the
 *    actual year's, so a path that survives every time is a scenario with no
 *    risk in it and one that never survives is a scenario that has been made
 *    harder than the past was.
 *
 * Run with: node src/simulation/dev/scenarioFit.ts
 */

import type { PolicyPackage } from '../types/policy.ts'
import type { Scenario } from '../types/scenario.ts'
import type { SimulationState } from '../types/state.ts'
import { SIMULATION_VERSION } from '../version.ts'
import {
  availableInstruments,
  getInstrument,
  getInstrumentRange,
} from '../config/instruments.ts'
import { createRunConfig } from '../engine/initialState.ts'
import { playRun } from '../replay/replayRun.ts'
import { calculateScore } from '../scoring/calculateScore.ts'
import { SCENARIOS, instrumentRangesFor } from '../scenarios/scenarios.ts'

/** Seeds per scenario. */
const SEEDS = 12

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

function rootMeanSquare(values: readonly number[]): number | null {
  if (values.length === 0) return null
  return Math.sqrt(values.reduce((a, b) => a + b * b, 0) / values.length)
}

function fmt(value: number | null, digits = 2): string {
  return value === null ? '—' : value.toFixed(digits)
}

/** Replay one seed of a scenario along its own benchmark path. */
function replay(scenario: Scenario, seed: string): {
  readonly state: SimulationState
  readonly completed: boolean
  readonly ended: string | null
  readonly score: number
} {
  const config = createRunConfig({
    institution: scenario.institution,
    difficulty: scenario.rules,
    seed,
    simulationVersion: SIMULATION_VERSION,
    scenario: scenario.id,
  })

  // The window is gated by difficulty as well as by the scenario, and the two
  // 2021 scenarios run on medium where it is locked. A replay that proposed a
  // locked instrument would end on a validation error rather than on the
  // history.
  const lendsAtWindow =
    !scenario.withheldInstruments.includes('discount_window') &&
    availableInstruments(scenario.institution, scenario.rules).some(
      (entry) => entry.id === 'discount_window',
    )

  const instrument = getInstrument('policy_rate')
  const range =
    instrument === undefined
      ? { min: -300, max: 300, increment: 25 }
      : getInstrumentRange(instrument, config.difficulty, instrumentRangesFor(config))

  const session = playRun(config, (current): PolicyPackage => {
    const index = Math.min(current.state.meetingIndex, scenario.calendar.length - 1)
    const want = scenario.calendar[index].benchmarkRate
    const now = current.state.stance.targetRate
    const raw = Math.round(((want - now) * 100) / range.increment) * range.increment
    const move = Math.max(-range.max, Math.min(range.max, raw))

    // The window opens with stress rather than on a schedule, because that is
    // what a lender of last resort is — and because a replay that refused to
    // lend would be measuring a policy nobody ran.
    const stress = current.state.latent.bankingStress
    const window = stress > 40 ? 3 : stress > 28 ? 2 : stress > 20 ? 1 : 0
    const actions: PolicyPackage['actions'] = [
      ...(move === 0 ? [] : [{ instrument: 'policy_rate' as const, magnitude: move }]),
      ...(window === current.state.stance.discountWindowLevel || !lendsAtWindow
        ? []
        : [{ instrument: 'discount_window' as const, magnitude: window }]),
    ]
    return { actions, communication: null }
  })

  return {
    state: session.state,
    completed: session.outcome.status === 'completed',
    ended: session.outcome.triggered ?? null,
    score: calculateScore(session.state, session.outcome).score,
  }
}

function report(scenario: Scenario): void {
  const runs = Array.from({ length: SEEDS }, (_, index) =>
    replay(scenario, `fit-${index}`),
  )
  const full = runs.filter((run) => run.completed)

  // Errors at every meeting of every run, against the series that was actually
  // published for the meeting that slot is labelled with.
  const inflationErrors: number[] = []
  const coreErrors: number[] = []
  const unemploymentErrors: number[] = []
  for (const run of runs) {
    run.state.history.forEach((snapshot, index) => {
      const actual = scenario.calendar[index]
      if (actual === undefined) return
      if (actual.actualInflation !== undefined) {
        inflationErrors.push(snapshot.latent.inflationHeadline - actual.actualInflation)
      }
      if (actual.actualCore !== undefined) {
        coreErrors.push(snapshot.latent.inflationCore - actual.actualCore)
      }
      if (actual.actualUnemployment !== undefined) {
        unemploymentErrors.push(snapshot.latent.unemployment - actual.actualUnemployment)
      }
    })
  }

  const peakInflation = full.map((run) =>
    Math.max(...run.state.history.map((s) => s.latent.inflationHeadline)),
  )
  const troughInflation = full.map((run) =>
    Math.min(...run.state.history.map((s) => s.latent.inflationHeadline)),
  )
  const endInflation = full.map(
    (run) => run.state.history[run.state.history.length - 1].latent.inflationHeadline,
  )
  const worstUnemployment = full.map((run) =>
    Math.max(...run.state.history.map((s) => s.latent.unemployment)),
  )
  const deepestGap = full.map((run) =>
    Math.min(...run.state.history.map((s) => s.latent.outputGap)),
  )

  const actualInflation = scenario.calendar
    .map((m) => m.actualInflation)
    .filter((v): v is number => v !== undefined)
  const actualUnemployment = scenario.calendar
    .map((m) => m.actualUnemployment)
    .filter((v): v is number => v !== undefined)

  const outcomes = new Map<string, number>()
  for (const run of runs) {
    const key = run.ended ?? 'completed'
    outcomes.set(key, (outcomes.get(key) ?? 0) + 1)
  }

  console.log('')
  console.log(`${scenario.title} — ${scenario.id}`)
  console.log('-'.repeat(78))
  console.log(`| | model | actual |`)
  console.log(`| --- | --- | --- |`)
  console.log(
    `| inflation at the opening | ${fmt(scenario.opening.inflationHeadline)} % | ${fmt(actualInflation[0])} % |`,
  )
  console.log(
    `| peak inflation | ${fmt(median(peakInflation), 1)} % | ${fmt(Math.max(...actualInflation), 2)} % |`,
  )
  console.log(
    `| lowest inflation | ${fmt(median(troughInflation), 1)} % | ${fmt(Math.min(...actualInflation), 2)} % |`,
  )
  console.log(
    `| inflation at the end | ${fmt(median(endInflation), 1)} % | ${fmt(actualInflation[actualInflation.length - 1])} % |`,
  )
  console.log(
    `| worst unemployment | ${fmt(median(worstUnemployment), 1)} % | ${
      actualUnemployment.length > 0 ? fmt(Math.max(...actualUnemployment), 1) : '—'
    } % |`,
  )
  console.log(`| deepest output gap | ${fmt(median(deepestGap), 1)} % | — |`)
  console.log(`| inflation RMSE against the series | ${fmt(rootMeanSquare(inflationErrors), 1)} points | — |`)
  console.log(`| core RMSE | ${fmt(rootMeanSquare(coreErrors), 1)} points | — |`)
  console.log(`| unemployment RMSE | ${fmt(rootMeanSquare(unemploymentErrors), 1)} points | — |`)
  console.log(`| full terms served, of ${SEEDS} seeds | ${full.length} | — |`)
  console.log(
    `| median score on the historical path | ${fmt(median(runs.map((r) => r.score)), 0)} | — |`,
  )
  console.log('')
  console.log(
    `  how the twelve ended: ${[...outcomes.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id, count]) => `${id} ${count}`)
      .join(', ')}`,
  )
}

function main(): void {
  console.log('')
  console.log(`Historical fit — engine ${SIMULATION_VERSION}, ${SEEDS} seeds a scenario`)
  console.log('='.repeat(78))
  for (const scenario of SCENARIOS) report(scenario)
  console.log('')
}

main()

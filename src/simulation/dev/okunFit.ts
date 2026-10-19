/**
 * How far unemployment actually moves, in every scenario, against the period.
 *
 * The complaint this exists to answer: **the game teaches a false sacrifice
 * ratio.** 1982 printed 10.8 % unemployment and the model reaches about 8.3;
 * 1929-33 printed 24.9 % and the model reaches about 10. A player revising on
 * this learns that disinflation is cheaper in jobs than it is, which is the
 * one quantitative lesson a monetary-policy game must not get wrong.
 *
 * Prices track in every period. Quantities are damped in every period. That
 * pattern points at one coefficient — `LABOR.okun`, percentage points of
 * unemployment per point of output gap — rather than at seven scenarios.
 *
 * What this prints, per scenario, played by the engine's own benchmark rule:
 * the unemployment the model reaches against the worst the period actually
 * printed, and the *range* it swings across, which is the thing a sacrifice
 * ratio is made of.
 *
 * Run with: npx tsx src/simulation/dev/okunFit.ts
 */
import { SIMULATION_VERSION } from '../version.ts'
import { createRunConfig } from '../engine/initialState.ts'
import { playRun } from '../replay/replayRun.ts'
import { toolkitPackage } from '../policy/toolkitRule.ts'
import { SCENARIOS, instrumentRangesFor } from '../scenarios/scenarios.ts'
import { LABOR } from '../config/model.ts'
import { getInstrument, getInstrumentRange } from '../config/instruments.ts'

/** Seeds per scenario. Medians, because a single draw is a draw. */
const SEEDS = 9

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

console.log(`LABOR.okun = ${LABOR.okun}, ${SEEDS} seeds per scenario, benchmark rule`)
console.log('')
console.log(
  'scenario                     model peak  actual peak   model range  actual range  scenario okun',
)
console.log('-'.repeat(104))

for (const scenario of SCENARIOS) {
  const peaks: number[] = []
  const ranges: number[] = []
  const gapTroughs: number[] = []

  for (let seed = 0; seed < SEEDS; seed += 1) {
    const config = createRunConfig({
      institution: scenario.institution,
      difficulty: scenario.rules,
      seed: `OKUN-${seed}`,
      scenario: scenario.id,
      simulationVersion: SIMULATION_VERSION,
    })
    // The rate only, lifted out of the benchmark package. The full toolkit
    // proposes instruments some periods did not have — 1929 has no balance
    // sheet runoff — and this measurement is about the dial anyway: a
    // sacrifice ratio is what moving the rate costs in jobs.
    const session = playRun(config, (s) => {
      const full = toolkitPackage(s, scenario.institution, scenario.rules)
      const move = full.actions.find((a) => a.instrument === 'policy_rate')
      if (move === undefined) return { actions: [], communication: null }
      // Clamped to *this scenario's* range, which can be narrower than the
      // difficulty's — the benchmark rule only knows the difficulty's, so a
      // period with a tighter dial rejects its proposal outright.
      const instrument = getInstrument('policy_rate')
      if (instrument === undefined) return { actions: [], communication: null }
      const range = getInstrumentRange(
        instrument,
        scenario.rules,
        instrumentRangesFor(s.state.config),
      )
      return {
        actions: [
          {
            instrument: 'policy_rate' as const,
            magnitude: Math.max(range.min, Math.min(range.max, move.magnitude)),
          },
        ],
        communication: null,
      }
    })
    const unemployment = session.state.history.map((h) => h.latent.unemployment)
    if (unemployment.length === 0) continue
    peaks.push(Math.max(...unemployment))
    ranges.push(Math.max(...unemployment) - Math.min(...unemployment))
    gapTroughs.push(Math.min(...session.state.history.map((h) => h.latent.outputGap)))
  }

  // What the period actually printed, from the scenario's own documented
  // calendar — so this compares against the sourced table rather than memory.
  const actual = scenario.calendar
    .map((meeting) => meeting.actualUnemployment)
    .filter((value): value is number => value !== undefined)
  const actualPeak = actual.length > 0 ? Math.max(...actual) : null
  const actualRange =
    actual.length > 0 ? Math.max(...actual) - Math.min(...actual) : null

  const show = (value: number | null, digits = 1) =>
    value === null ? '   —' : value.toFixed(digits).padStart(5)

  console.log(
    `${scenario.id.padEnd(28)}` +
      `${show(median(peaks))}      ` +
      `${show(actualPeak)}        ` +
      `${show(median(ranges))}        ` +
      `${show(actualRange)}        ` +
      `${scenario.okun === undefined ? '(engine)' : String(scenario.okun)}` +
      `   gap trough ${median(gapTroughs).toFixed(1)}`,
  )
}

console.log('')
console.log(
  'Range is the quantity a sacrifice ratio is made of: a model that gets the\n' +
    'peak by starting high and never moving is not getting the period right.',
)

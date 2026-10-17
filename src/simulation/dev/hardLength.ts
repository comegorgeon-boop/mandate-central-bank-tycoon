/**
 * Developer-only calibration: hard's length against hard's shocks.
 *
 * `docs/BALANCE.md` measured that **most of hard's difficulty is its length** —
 * 32 scheduled meetings is four years, a longer mandate is more chances to meet
 * a catastrophe, and cutting to 24 raised completion by sixteen points. The
 * player's answer was to cut it, behind a constant. "Shorter and as hard" then
 * needs the shocks enlarged to put the difficulty back where it was, and this
 * script is what finds by how much, rather than guessing.
 *
 * It exists as a committed script and not as scratchpad work for one reason:
 * the number it produces is a hand-set constant against today's configuration,
 * and the next person to retune hard's events has to be able to re-measure it
 * in a minute. The same reasoning as `COHESION_TOLERANCE`.
 *
 * Run with: node src/simulation/dev/hardLength.ts
 *
 * To test another combination, add a row to `COMPENSATIONS` below. The three
 * multipliers apply to hard's `shockScale`, `eventProbability` and
 * `eventSeverityScale` respectively. No command-line arguments, because these
 * scripts live under `src` and compile against the app's tsconfig, which has
 * no node types — the same reason `sweep.ts` has none.
 */

import type { Institution } from '../types/core.ts'
import { SIMULATION_VERSION } from '../version.ts'
import { DIFFICULTIES, type DifficultyConfig } from '../config/difficulty.ts'
import { createRunConfig } from '../engine/initialState.ts'
import { calculateScore } from '../scoring/calculateScore.ts'
import { playRun } from '../replay/replayRun.ts'
import { toolkitPackage } from '../policy/toolkitRule.ts'

/** Seeded runs per institution per combination. */
const RUNS = 150

const INSTITUTIONS: readonly Institution[] = ['fed', 'ecb']

/** What hard ships with, read once before anything is overridden. */
const SHIPPED = { ...DIFFICULTIES.hard }

/** What it shipped with over four years, before the term was cut. */
const FOUR_YEAR = { shockScale: 1.45, eventProbability: 0.7, eventSeverityScale: 1.35 }

/**
 * Overwrite hard's shock parameters in place, absolutely.
 *
 * A dev-only cast. The configuration is `Readonly` because nothing in the game
 * may write to it; a calibration script whose entire job is to vary it is the
 * one caller that must, and doing it here keeps the type honest everywhere
 * else.
 */
function setShocks(shock: number, probability: number, severity: number): void {
  const hard = DIFFICULTIES.hard as {
    -readonly [K in keyof DifficultyConfig]: DifficultyConfig[K]
  }
  hard.shockScale = shock
  hard.eventProbability = Math.min(1, probability)
  hard.eventSeverityScale = severity
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

interface Cell {
  readonly completed: number
  readonly score: number
}

function measure(institution: Institution, meetings: number): Cell {
  const scores: number[] = []
  let completed = 0
  for (let index = 0; index < RUNS; index += 1) {
    const config = {
      ...createRunConfig({
        institution,
        difficulty: 'hard',
        seed: `sweep-${index}`,
        simulationVersion: SIMULATION_VERSION,
      }),
      meetingCount: meetings,
    }
    const session = playRun(config, (current) =>
      toolkitPackage(current, institution, 'hard'),
    )
    scores.push(calculateScore(session.state, session.outcome).score)
    if (session.outcome.status === 'completed') completed += 1
  }
  return { completed: completed / RUNS, score: median(scores) }
}

function row(label: string, meetings: number): void {
  const cells = INSTITUTIONS.map((institution) => measure(institution, meetings))
  console.log(
    [
      label.padEnd(34),
      ...cells.map(
        (cell) =>
          `${String(cell.score).padStart(5)} (${(cell.completed * 100).toFixed(0).padStart(3)} %)`,
      ),
    ].join('   '),
  )
}

/** Lengths measured at the shocks hard ships with. */
const LENGTHS: readonly number[] = [32, 28, 24, 20, 16]

/**
 * Shock settings tried at the shortened length, to put the difficulty back.
 *
 * Absolute values, so a row can be read against `config/difficulty.ts`
 * directly. The committed configuration is the third one.
 */
const COMPENSATIONS: readonly (readonly [number, number, number])[] = [
  [1.45, 0.77, 1.49],
  [1.45, 0.8, 1.55],
  [1.6, 0.77, 1.49],
  [1.45, 0.875, 1.69],
]

function main(): void {
  console.log('')
  console.log(`Hard length against hard shocks — engine ${SIMULATION_VERSION}`)
  console.log(`${RUNS} seeded runs a cell, the whole toolkit played as the rule`)
  console.log('='.repeat(76))
  console.log(['combination'.padEnd(34), '      fed', '      ecb'].join('   '))
  console.log('-'.repeat(76))

  // The length axis at the shocks hard ships with. Note that the shipped
  // configuration is now 24 meetings *with* the compensation, so the first
  // block's 24-meeting row is the counterfactual "shorter and easier", not
  // the build.
  setShocks(
    FOUR_YEAR.shockScale,
    FOUR_YEAR.eventProbability,
    FOUR_YEAR.eventSeverityScale,
  )
  for (const meetings of LENGTHS) {
    row(`${meetings} meetings, four-year shocks`, meetings)
  }
  console.log('-'.repeat(76))
  // Then the compensation: at 24 meetings, what puts the difficulty back.
  for (const [shock, probability, severity] of COMPENSATIONS) {
    setShocks(shock, probability, severity)
    row(`24 meetings, shocks ${shock}/${probability}/${severity}`, 24)
  }

  setShocks(
    SHIPPED.shockScale,
    SHIPPED.eventProbability,
    SHIPPED.eventSeverityScale,
  )
  console.log('-'.repeat(76))
  console.log('')
}

main()

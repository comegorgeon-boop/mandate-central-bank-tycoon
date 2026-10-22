/**
 * Does the ECB's own ending actually happen, and how often?
 *
 * `council_lost` is the only way a fictional ECB presidency ends short of a
 * catastrophe, and it is the whole structural difference between the two
 * institutions: nobody can remove an ECB president and there is no second term
 * to withhold, so what ends the presidency is losing the room.
 *
 * ## The first version could not fire
 *
 * It gated on member inflation dispersion at 2.4 points **and** area
 * fragmentation at 290 basis points, held five consecutive meetings. Measured
 * here over 360 mandates: satisfied on **0.0 %** of meetings at every
 * difficulty under every play, 0 endings in 60 in every cell. The highest
 * dispersion ever reached was 1.85, at ecb/hard under *competent* play —
 * exactly where fragmentation is lowest, because a competent rule uses the
 * anti-fragmentation instrument. The two quantities peak under opposite
 * conditions, so it was the conjunction rather than the heights: at the
 * loosest pair tried, the condition still held long enough in 2-3 % of passive
 * runs and 0 % of competent ones.
 *
 * Meanwhile the game told the player, in as many words, *"You can lose the
 * room."*
 *
 * ## What it measures now
 *
 * Sustained dissent by a bloc — a third of the committee voting against the
 * policy for `COUNCIL.meetingsToFail` consecutive meetings, the count
 * resetting whenever the room comes back. See `config/tenure.ts` for why that
 * is the historically faithful quantity and dispersion was not.
 *
 * Run with: npx tsx src/simulation/dev/councilProbe.ts
 *
 * Read the output as: **`ended` is the claim.** The bar the player set is
 * "frequent enough to be real, rare enough to stay an event". A mechanic that
 * fires on nobody is the defect above; one that fires on a competent chair as
 * often as on a reckless one is a tax rather than a consequence, which is what
 * the two play columns are for.
 */

import type { Difficulty } from '../types/core.ts'
import type { PolicyPackage } from '../types/policy.ts'
import { SIMULATION_VERSION } from '../version.ts'
import { COUNCIL } from '../config/tenure.ts'
import { createRunConfig } from '../engine/initialState.ts'
import { startRun, submitMeeting, type RunSession } from '../replay/replayRun.ts'
import { toolkitPackage } from '../policy/toolkitRule.ts'
import { dissentingBloc } from '../policy/committeeVote.ts'

const RUNS = 60

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard']

type Play = 'competent' | 'passive' | 'stubborn'

/**
 * A chair who holds one direction whatever the room says.
 *
 * The population the mechanic is *for*. The toolkit rule reacts to the data
 * and therefore drifts toward wherever the committee's own views are; a chair
 * who picks a stance at the first meeting and never revisits it is the one who
 * should lose the Council, and a condition that never catches them is not a
 * condition. Deliberately not a saboteur: it holds a *coherent* policy, which
 * is what Weber and Stark resigned over.
 */
function stubborn(): PolicyPackage {
  return {
    actions: [{ instrument: 'policy_rate', magnitude: 50 }],
    communication: null,
  }
}

function choose(play: Play, difficulty: Difficulty) {
  return (session: RunSession): PolicyPackage => {
    if (play === 'passive') return { actions: [], communication: null }
    if (play === 'stubborn') return stubborn()
    return toolkitPackage(session, 'ecb', difficulty)
  }
}

interface Reading {
  /** Share of runs that ended on `council_lost`. */
  readonly ended: number
  /** Share of meetings at which a bloc was against the chair. */
  readonly blocShare: number
  /** The longest dissent streak reached, across the whole sample. */
  readonly longestStreak: number
  /**
   * Share of runs where the player was actually *shown* the warning.
   *
   * Read off `outcome.warnings` rather than off the streak, and the difference
   * matters: the first version of this probe counted the streak and reported
   * 100 % warned at ecb/easy, where the condition is never evaluated at all —
   * `tutorialProgress` returns before it, because a tutorial ends on its goal
   * rather than on a term. A probe that measures the accumulator instead of
   * the consequence reports a mechanic that is not running.
   */
  readonly warned: number
  readonly medianTenure: number
}

function measure(difficulty: Difficulty, play: Play): Reading {
  let ended = 0
  let warned = 0
  let blocMeetings = 0
  let allMeetings = 0
  let longestStreak = 0
  const tenures: number[] = []

  for (let index = 0; index < RUNS; index += 1) {
    const config = createRunConfig({
      institution: 'ecb',
      difficulty,
      seed: `council-${index}`,
      simulationVersion: SIMULATION_VERSION,
    })

    // Stepped rather than `playRun`, because the streak is the thing being
    // measured and it only exists between meetings: a finished session carries
    // the final count, not the highest one reached.
    let session = startRun(config)
    let peak = 0
    let sawWarning = false
    while (session.outcome.status === 'active') {
      const result = submitMeeting(session, choose(play, difficulty)(session))
      if (!result.ok) break
      session = result.session
      if (dissentingBloc(session.vote)) blocMeetings += 1
      allMeetings += 1
      peak = Math.max(peak, session.state.councilDissent)
      if (session.outcome.warnings.some((w) => w.id === 'council_lost')) {
        sawWarning = true
      }
    }

    if (session.outcome.triggered === 'council_lost') ended += 1
    if (sawWarning) warned += 1
    longestStreak = Math.max(longestStreak, peak)
    tenures.push(session.state.meetingIndex)
  }

  const sorted = [...tenures].sort((a, b) => a - b)
  return {
    ended: ended / RUNS,
    warned: warned / RUNS,
    blocShare: allMeetings === 0 ? 0 : blocMeetings / allMeetings,
    longestStreak,
    medianTenure: sorted[Math.floor(sorted.length / 2)] ?? 0,
  }
}

function main(): void {
  console.log('')
  console.log(`Can the Council actually be lost? — engine ${SIMULATION_VERSION}`)
  console.log(
    `A third of the committee against, for ${COUNCIL.meetingsToFail} consecutive ` +
      `meetings. Warning from ${COUNCIL.meetingsToWarn}.`,
  )
  console.log(`${RUNS} ECB mandates a cell.`)
  console.log('='.repeat(100))
  console.log(
    [
      'bucket'.padEnd(22),
      'ENDED'.padEnd(8),
      'warned'.padEnd(8),
      'bloc mtgs'.padEnd(10),
      'longest'.padEnd(8),
      'tenure',
    ].join(' '),
  )
  console.log('-'.repeat(100))

  for (const difficulty of DIFFICULTIES) {
    for (const play of ['competent', 'passive', 'stubborn'] as const) {
      const reading = measure(difficulty, play)
      console.log(
        [
          `ecb/${difficulty} ${play}`.padEnd(22),
          `${(reading.ended * 100).toFixed(0)}%`.padEnd(8),
          `${(reading.warned * 100).toFixed(0)}%`.padEnd(8),
          `${(reading.blocShare * 100).toFixed(1)}%`.padEnd(10),
          `${reading.longestStreak}`.padEnd(8),
          `${reading.medianTenure}`,
        ].join(' '),
      )
    }
    console.log('-'.repeat(100))
  }

  console.log('')
  console.log('ENDED is the mechanic. `longest` is the diagnostic that tells a bar set')
  console.log('too high apart from a mechanism that cannot reach it: a longest streak')
  console.log('well below meetingsToFail means the bloc never holds, whatever the bar.')
  console.log('')
}

main()

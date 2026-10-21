/**
 * Is the tutorial still winnable now that it opens on a wreck?
 *
 * The opening moved from "inflation 2.4 above target, unemployment already
 * met" to "inflation 3.0 above target, unemployment 2.8 above sustainable,
 * with a live cost-push shock". That is the brief, and it is a far harder
 * board: the old opening met half the goal on the first meeting.
 *
 * This sweeps the one dial that can pay for it — how long the tutorial has —
 * and reports what competent play and passive play each achieve. The gap
 * between them is what makes it a game rather than a wait.
 *
 * Run with: npx tsx src/simulation/dev/tutorialFit.ts
 */
import { SIMULATION_VERSION } from '../version.ts'
import { createRunConfig } from '../engine/initialState.ts'
import { startRun, submitMeeting } from '../replay/replayRun.ts'
import { toolkitPackage } from '../policy/toolkitRule.ts'
import { DIFFICULTIES } from '../config/difficulty.ts'
import type { Institution } from '../types/core.ts'
import type { PolicyPackage } from '../types/policy.ts'

const SEEDS = 30
const HOLD: PolicyPackage = { actions: [], communication: null }

function play(
  institution: Institution,
  cap: number,
  competent: boolean,
): { solved: number; medianMeetings: number } {
  let solved = 0
  const lengths: number[] = []

  for (let seed = 0; seed < SEEDS; seed += 1) {
    const config = createRunConfig({
      institution,
      difficulty: 'easy',
      seed: `TUT-${seed}`,
      simulationVersion: SIMULATION_VERSION,
    })
    let session = startRun(config)

    for (let meeting = 0; meeting < cap; meeting += 1) {
      const pkg = competent ? toolkitPackage(session, institution, 'easy') : HOLD
      const result = submitMeeting(session, pkg)
      if (!result.ok) break
      session = result.session
      if (session.outcome.status !== 'active') break
    }
    lengths.push(session.state.meetingIndex)
    if (session.outcome.triggered === 'objective_met') solved += 1
  }

  lengths.sort((a, b) => a - b)
  return { solved, medianMeetings: lengths[Math.floor(lengths.length / 2)] }
}

console.log('')
console.log('The tutorial, against the wreck it now opens on')
console.log('='.repeat(84))
console.log('u-tol  institution   competent solves   passive solves   median length')
const goal = DIFFICULTIES.easy.tutorialGoal
if (goal === null) throw new Error('easy has no tutorial goal')
const original = goal.unemploymentAboveNaturalBy

for (const tolerance of [0.8, 1.2, 1.6, 2.0]) {
  // The config is `as const`, so this reaches past the type to sweep a single
  // dial. A measurement harness is the one place that is honest: the point is
  // to find the value, then write it into the config where it belongs.
  ;(goal as { unemploymentAboveNaturalBy: number }).unemploymentAboveNaturalBy =
    tolerance
  for (const institution of ['fed', 'ecb'] as const) {
    const skilled = play(institution, 40, true)
    const idle = play(institution, 40, false)
    console.log(
      `${tolerance.toFixed(1).padStart(5)}  ${institution.padEnd(12)} ` +
        `${String(skilled.solved).padStart(10)}/${SEEDS}      ` +
        `${String(idle.solved).padStart(7)}/${SEEDS}      ` +
        `${String(skilled.medianMeetings).padStart(6)}`,
    )
  }
}
;(goal as { unemploymentAboveNaturalBy: number }).unemploymentAboveNaturalBy =
  original
console.log('')
console.log('Wanted: competent well above passive, and competent solving most seeds.')

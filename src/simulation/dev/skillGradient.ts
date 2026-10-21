/**
 * Does playing well still beat doing nothing, on hard?
 *
 * The winnability suite pairs the two per seed and counts which survives
 * longer. With the new opening it came back **11 skill against 17 idle** —
 * passivity outlasting competence, which is the one property that suite
 * exists to prevent.
 *
 * The diagnosis is the same one that made the tutorial unwinnable two passes
 * ago, arriving on the hardest rung: tightening into a cost-push shock buys
 * unemployment, and if the slump is already deep there is nowhere for the
 * rate to work. Hard is *supposed* to have an objective the rate cannot
 * reach — that was settled — but an unreachable objective must not make
 * sitting still the dominant strategy.
 *
 * This sweeps the depth of hard's opening slump against its cost-push.
 *
 * Run with: npx tsx src/simulation/dev/skillGradient.ts
 */
import { SIMULATION_VERSION } from '../version.ts'
import { createRunConfig, OPENING_DAMAGE } from '../engine/initialState.ts'
import { startRun, submitMeeting } from '../replay/replayRun.ts'
import { toolkitPackage } from '../policy/toolkitRule.ts'
import type { Institution } from '../types/core.ts'
import type { PolicyPackage } from '../types/policy.ts'
import type { RunSession } from '../replay/replayRun.ts'

const SEEDS = 40
const HOLD: PolicyPackage = { actions: [], communication: null }

function tenure(institution: Institution, choose: (s: RunSession) => PolicyPackage) {
  const out: number[] = []
  for (let seed = 0; seed < SEEDS; seed += 1) {
    const config = createRunConfig({
      institution,
      difficulty: 'hard',
      seed: `winnability-${seed}`,
      simulationVersion: SIMULATION_VERSION,
    })
    let session = startRun(config)
    for (let meeting = 0; meeting < 70; meeting += 1) {
      const result = submitMeeting(session, choose(session))
      if (!result.ok) break
      session = result.session
      if (session.outcome.status !== 'active') break
    }
    out.push(session.state.meetingIndex)
  }
  return out
}

const hard = OPENING_DAMAGE.hard as {
  outputGap: number
  supplyShock: number
  inflationOverTarget: number
}
const original = { ...hard }

console.log('')
console.log('Hard: does skill outlast idleness?')
console.log('='.repeat(92))
console.log('gap   supply  institution   skill wins   idle wins   median tenure (skill)')
for (const [gap, supply] of [
  [-6.5, 2.0],
  [-5.5, 2.0],
  [-5.5, 1.6],
  [-4.5, 1.6],
] as const) {
  hard.outputGap = gap
  hard.supplyShock = supply
  for (const institution of ['fed', 'ecb'] as const) {
    const skilled = tenure(institution, (s) => toolkitPackage(s, institution, 'hard'))
    const idle = tenure(institution, () => HOLD)
    let skillWins = 0
    let idleWins = 0
    for (let index = 0; index < SEEDS; index += 1) {
      if (skilled[index] > idle[index]) skillWins += 1
      if (idle[index] > skilled[index]) idleWins += 1
    }
    const sorted = [...skilled].sort((a, b) => a - b)
    console.log(
      `${gap.toFixed(1).padStart(5)} ${supply.toFixed(1).padStart(6)}  ${institution.padEnd(12)} ` +
        `${String(skillWins).padStart(10)}  ${String(idleWins).padStart(10)}  ` +
        `${String(sorted[Math.floor(SEEDS / 2)]).padStart(14)}`,
    )
  }
}
Object.assign(hard, original)
console.log('')
console.log('Wanted: skill wins clearly more often than idleness.')

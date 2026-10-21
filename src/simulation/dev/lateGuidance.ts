/**
 * Is communication worth anything at the point where it should be?
 *
 * > "Maintenant que chaque mandat s'ouvre loin de la cible, parler ne vaut
 * > presque rien pendant toute la première moitié de toutes les parties — et
 * > un instrument qui ne sert jamais est un instrument mort. Mesure-le là où
 * > il devrait compter : EN FIN DE PARTIE RÉUSSIE, quand l'inflation
 * > redescend et que la question devient de savoir si les anticipations se
 * > rancrent."
 *
 * Exactly the right place to look, and the measurement that was failing was
 * averaging over the whole mandate — most of which is now an emergency where
 * the rate does the work. So this splits the mandate in two at the point the
 * question actually changes: while inflation is still far out, and once it is
 * coming back and the only thing left to settle is whether the anchor
 * follows.
 *
 * Paired per seed: the same economy, the same shocks, the same rate path. The
 * only difference is whether the committee said what it was doing.
 *
 * Run with: npx tsx src/simulation/dev/lateGuidance.ts
 */
import { SIMULATION_VERSION } from '../version.ts'
import { createRunConfig } from '../engine/initialState.ts'
import { startRun, submitMeeting } from '../replay/replayRun.ts'
import { toolkitPackage } from '../policy/toolkitRule.ts'
import { inflationTargetFor } from '../scenarios/scenarios.ts'
import type { Difficulty, Institution } from '../types/core.ts'
import type { PolicyPackage } from '../types/policy.ts'
import type { RunSession } from '../replay/replayRun.ts'

const SEEDS = 60

/** Within this much of target, the emergency is over and the anchor is the question. */
const SETTLED = 1.5

/** The same package, with and without saying anything about it. */
function speaking(session: RunSession, institution: Institution, difficulty: Difficulty) {
  const base = toolkitPackage(session, institution, difficulty)
  return {
    silent: { ...base, communication: null } as PolicyPackage,
    spoken: base,
  }
}

interface Half {
  anchorSpoken: number[]
  anchorSilent: number[]
}

function run(institution: Institution, difficulty: Difficulty) {
  const early: Half = { anchorSpoken: [], anchorSilent: [] }
  const late: Half = { anchorSpoken: [], anchorSilent: [] }

  for (let seed = 0; seed < SEEDS; seed += 1) {
    for (const talks of [true, false]) {
      const config = createRunConfig({
        institution,
        difficulty,
        seed: `LATE-${seed}`,
        simulationVersion: SIMULATION_VERSION,
      })
      const target = inflationTargetFor(config)
      let session = startRun(config)

      for (let meeting = 0; meeting < 70; meeting += 1) {
        const { silent, spoken } = speaking(session, institution, difficulty)
        const settled = Math.abs(session.state.latent.inflationHeadline - target) <= SETTLED
        const bucket = settled ? late : early
        // Anchoring is the thing communication is *for*: how firmly long-run
        // expectations are pinned to the objective.
        ;(talks ? bucket.anchorSpoken : bucket.anchorSilent).push(
          session.state.latent.anchoring,
        )

        const result = submitMeeting(session, talks ? spoken : silent)
        if (!result.ok) break
        session = result.session
        if (session.outcome.status !== 'active') break
      }
    }
  }

  const mean = (values: readonly number[]) =>
    values.length === 0 ? Number.NaN : values.reduce((a, b) => a + b, 0) / values.length

  const show = (label: string, half: Half) => {
    const spoken = mean(half.anchorSpoken)
    const silent = mean(half.anchorSilent)
    console.log(
      `  ${label.padEnd(26)} anchor spoken ${spoken.toFixed(3)}  silent ${silent.toFixed(3)}  ` +
        `gain ${((spoken - silent) * 100).toFixed(1).padStart(5)} anchor points  ` +
        `(${half.anchorSpoken.length} meetings)`,
    )
  }

  console.log(`\n${institution}/${difficulty}`)
  show('while inflation is far out', early)
  show('once it is coming back', late)
}

console.log('')
console.log('What speaking is worth, before and after the emergency is over')
console.log('='.repeat(104))
for (const [institution, difficulty] of [
  ['fed', 'medium'],
  ['ecb', 'medium'],
  ['fed', 'hard'],
] as const) {
  run(institution, difficulty)
}
console.log('')
console.log('If the late-game gain is good, communication is an end-game instrument')
console.log('and the game must SAY SO at the moment it starts paying. If it is nil')
console.log('there too, the instrument is dead and wants repairing, not reporting.')

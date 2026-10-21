/**
 * What speaking is worth, **in points**.
 *
 * > "Ta mesure est incomplète. Tu m'as rendu +4,7 points d'ancrage tôt dans la
 * > partie contre +5,2 une fois l'inflation qui reflue : c'est quasiment plat,
 * > et surtout ça mesure le MÉCANISME, pas le GAIN. Donne-moi la valeur en
 * > POINTS DE SCORE : est-ce qu'un joueur compétent qui parle bat un joueur
 * > compétent qui ne parle jamais, en fin de partie réussie ? Si l'écart est
 * > nul, l'instrument est décoratif et il faut le réparer, pas le constater."
 *
 * Correct, and `dev/lateGuidance.ts` is the measurement being criticised. It
 * reports the anchor — `latent.anchoring`, the thing guidance acts on — which
 * establishes that the *channel* is open and says nothing whatever about
 * whether the player is better off. An instrument can move its own channel by
 * five points and be worth nothing, if what it moves is worth nothing.
 *
 * So this measures the only two numbers the player is ever shown:
 *
 *   **banked** — the headline on the result screen. Points earned meeting by
 *   meeting, so length and quality multiply. `perMeeting` beside it, because a
 *   total alone is a leaderboard of length.
 *
 *   **graded** — `calculateScore`, the scorecard underneath it. Still a path
 *   average, so on a run cut short it rewards brevity; reported anyway,
 *   because the player sees it.
 *
 * Paired per seed: the same economy, the same shocks, the same rate path, the
 * same every instrument. The only difference between the two arms is whether
 * the committee says anything at all.
 *
 * **And restricted to mandates that succeeded**, which is the condition in the
 * question. A chair revoked at meeting nine has not reached the point where
 * the anchor is what is left to win, and averaging those in is how the earlier
 * measurement came out flat: most of a failed mandate is an emergency.
 *
 * Run with: npx tsx src/simulation/dev/guidanceValue.ts
 *
 * Read the output as: **`won` is the claim.** A median gain with a win rate
 * near half is noise with a sign on it. Speaking has to beat silence on most
 * of the economies it is offered, or the instrument is decorative.
 */
import { SIMULATION_VERSION } from '../version.ts'
import { createRunConfig } from '../engine/initialState.ts'
import { playRun, type RunSession } from '../replay/replayRun.ts'
import { toolkitPackage } from '../policy/toolkitRule.ts'
import { calculateScore } from '../scoring/calculateScore.ts'
import { bankedTotal } from '../scoring/banked.ts'
import type { Difficulty, Institution } from '../types/core.ts'
import type { PolicyPackage } from '../types/policy.ts'

const SEEDS = 80

const BUCKETS: readonly (readonly [Institution, Difficulty])[] = [
  ['fed', 'easy'],
  ['ecb', 'easy'],
  ['fed', 'medium'],
  ['ecb', 'medium'],
  ['fed', 'hard'],
  ['ecb', 'hard'],
]

interface Outcome {
  readonly banked: number
  readonly perMeeting: number
  readonly graded: number
  readonly meetings: number
  readonly anchoring: number
  readonly succeeded: boolean
}

function play(
  institution: Institution,
  difficulty: Difficulty,
  seed: string,
  talks: boolean,
): Outcome {
  const config = createRunConfig({
    institution,
    difficulty,
    seed,
    simulationVersion: SIMULATION_VERSION,
  })
  const session = playRun(config, (current: RunSession): PolicyPackage => {
    const base = toolkitPackage(current, institution, difficulty)
    // Silence is not a worse package. It is the same package, unannounced —
    // and it is *advantaged* on one axis the score measures, because a
    // committee that promises nothing breaks no promises and the conduct gate
    // charges for broken ones. That asymmetry is deliberate: it makes the
    // comparison harder for speaking, which is the honest direction to err in.
    return talks ? base : { ...base, communication: null }
  })

  const banked = bankedTotal(session.state)
  return {
    banked: banked.total,
    perMeeting: banked.perMeeting,
    graded: calculateScore(session.state, session.outcome).score,
    meetings: session.state.meetingIndex,
    anchoring: session.state.latent.anchoring,
    succeeded: session.outcome.status === 'completed',
  }
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(0.5 * sorted.length)] ?? Number.NaN
}

function row(label: string, pairs: readonly (readonly [Outcome, Outcome])[]): void {
  if (pairs.length === 0) {
    console.log(`  ${label.padEnd(22)} no mandates in this bucket`)
    return
  }
  const spoken = pairs.map(([talks]) => talks)
  const silent = pairs.map(([, quiet]) => quiet)
  const wonBanked = pairs.filter(([talks, quiet]) => talks.banked > quiet.banked).length
  const wonGraded = pairs.filter(([talks, quiet]) => talks.graded > quiet.graded).length

  console.log(
    `  ${label.padEnd(22)}` +
      ` banked ${median(spoken.map((o) => o.banked)).toFixed(0).padStart(5)}` +
      ` vs ${median(silent.map((o) => o.banked)).toFixed(0).padStart(5)}` +
      `  (${(median(spoken.map((o) => o.banked)) - median(silent.map((o) => o.banked)) >= 0 ? '+' : '')}` +
      `${(median(spoken.map((o) => o.banked)) - median(silent.map((o) => o.banked))).toFixed(0)})` +
      `  won ${wonBanked}/${pairs.length}` +
      `   graded ${median(spoken.map((o) => o.graded)).toFixed(0).padStart(5)}` +
      ` vs ${median(silent.map((o) => o.graded)).toFixed(0).padStart(5)}` +
      `  won ${wonGraded}/${pairs.length}` +
      `   anchor ${median(spoken.map((o) => o.anchoring)).toFixed(3)}` +
      ` vs ${median(silent.map((o) => o.anchoring)).toFixed(3)}`,
  )
}

function main(): void {
  console.log('')
  console.log(`What speaking is worth, in points — engine ${SIMULATION_VERSION}`)
  console.log(`${SEEDS} paired seeds a bucket. Same economy, same package, spoken or not.`)
  console.log('='.repeat(132))

  for (const [institution, difficulty] of BUCKETS) {
    const pairs: (readonly [Outcome, Outcome])[] = []
    for (let seed = 0; seed < SEEDS; seed += 1) {
      const key = `GUIDANCE-${seed}`
      pairs.push([
        play(institution, difficulty, key, true),
        play(institution, difficulty, key, false),
      ])
    }

    // The question is about a *successful* mandate, so the pair has to be one:
    // a seed where speaking survived and silence did not is not a comparison
    // of scores, it is a comparison of a score with a collapse.
    const bothSucceeded = pairs.filter(([talks, quiet]) => talks.succeeded && quiet.succeeded)
    const spokenOnly = pairs.filter(([talks, quiet]) => talks.succeeded && !quiet.succeeded)
    const silentOnly = pairs.filter(([talks, quiet]) => !talks.succeeded && quiet.succeeded)

    console.log(`\n${institution}/${difficulty}`)
    row('every mandate', pairs)
    row('both succeeded', bothSucceeded)
    console.log(
      `  ${'survival'.padEnd(22)}` +
        ` speaking served ${pairs.filter(([t]) => t.succeeded).length}/${SEEDS},` +
        ` silence ${pairs.filter(([, q]) => q.succeeded).length}/${SEEDS}` +
        `   — only speaking survived on ${spokenOnly.length}, only silence on ${silentOnly.length}` +
        `   median tenure ${median(pairs.map(([t]) => t.meetings)).toFixed(0)}` +
        ` vs ${median(pairs.map(([, q]) => q.meetings)).toFixed(0)}`,
    )
  }

  console.log('')
  console.log('='.repeat(132))
  console.log('A median gain with `won` near half the seeds is noise with a sign on it.')
  console.log('')
}

main()

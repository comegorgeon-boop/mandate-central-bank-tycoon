/**
 * Developer-only diagnosis: where a competent ECB chair loses cohesion.
 *
 * `dev/cohesion.ts` measures the *floor* of the blended penalty, which is what
 * `COHESION_TOLERANCE` is set against. This measures something different and
 * more uncomfortable: the penalty **decomposed into its three channels**, under
 * competent play and under passivity, with the anti-fragmentation instrument
 * used, forced to its maximum, and forced off.
 *
 * It exists because of QUESTIONS.md #18. Competent ECB play scores *worse* on
 * area cohesion than doing nothing — tightening into a downturn widens the
 * spreads between members — and the first question any such finding has to
 * answer is whether the player has an instrument that reaches it. The answer
 * has to be per channel, because the penalty is three different quantities
 * added together and the instrument only points at one of them:
 *
 *   inflation dispersion  × 1.0   ← no instrument points here
 *   unemployment dispersion × 0.6 ← no instrument points here
 *   spread range / 100            ← transmission protection, TLTROs, purchases
 *
 * Run with: npx tsx src/simulation/dev/fragmentation.ts
 *
 * Read the output as: **the `spread` column is the only one the chair can
 * move, so it has to be large enough that moving it matters.** If the two
 * dispersion columns dominate the penalty, then an instrument pointed at
 * spreads cannot rescue the component however strong it is, and the honest
 * answer is QUESTIONS #18's option (b) — cohesion leaves the score.
 */

import type { Difficulty } from '../types/core.ts'
import type { PolicyAction, PolicyPackage } from '../types/policy.ts'
import { SIMULATION_VERSION } from '../version.ts'
import { COHESION_TOLERANCE, SCORE_SCALES } from '../config/scoring.ts'
import { availableInstruments } from '../config/instruments.ts'
import { createRunConfig } from '../engine/initialState.ts'
import { calculateScore } from '../scoring/calculateScore.ts'
import { cohesionChannels } from '../scoring/cohesionPenalty.ts'
import { bankedTotal } from '../scoring/banked.ts'
import { playRun, type RunSession } from '../replay/replayRun.ts'
import { toolkitPackage } from '../policy/toolkitRule.ts'

const RUNS = 60

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard']

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(0.5 * sorted.length)] ?? 0
}

type Play = 'competent' | 'passive' | 'protected' | 'unprotected'

/** Forces the transmission-protection level, leaving everything else alone. */
function pin(pkg: PolicyPackage, level: number | null): PolicyPackage {
  const actions = pkg.actions.filter(
    (action) => action.instrument !== 'transmission_protection',
  )
  if (level === null) return { ...pkg, actions }
  const forced: PolicyAction = {
    instrument: 'transmission_protection',
    magnitude: level,
  }
  return { ...pkg, actions: [...actions, forced] }
}

function choose(play: Play, difficulty: Difficulty) {
  return (session: RunSession): PolicyPackage => {
    if (play === 'passive') return { actions: [], communication: null }
    const pkg = toolkitPackage(session, 'ecb', difficulty)
    if (play === 'competent') return pkg
    return pin(pkg, play === 'protected' ? 3 : 0)
  }
}

function main(): void {
  console.log('')
  console.log(`Cohesion, decomposed — engine ${SIMULATION_VERSION}`)
  console.log(
    `${RUNS} ECB mandates a cell. Tolerance ${COHESION_TOLERANCE}, scale ${SCORE_SCALES.cohesion}.`,
  )
  console.log(
    'inflation ×1.0 and unemployment ×0.6 have no instrument. spread/100 has three.',
  )
  console.log(
    'A lever the chair can pull for nothing is not a decision: `pressure` and',
  )
  console.log('`total` are what pinning it at its maximum costs elsewhere.')
  console.log('='.repeat(112))
  console.log(
    [
      'bucket'.padEnd(24),
      'inflat'.padEnd(7),
      'unempl'.padEnd(7),
      'spread'.padEnd(7),
      'penalty'.padEnd(8),
      'charged'.padEnd(8),
      'cohesion'.padEnd(9),
      'pressure'.padEnd(9),
      'tenure'.padEnd(7),
      'banked'.padEnd(7),
      'graded',
    ].join(' '),
  )
  console.log('-'.repeat(112))

  for (const difficulty of DIFFICULTIES) {
    // The pinned arms only mean anything where the instrument is reachable:
    // pinning an instrument the difficulty withholds is rejected by
    // `applyPolicyPackage`, and silently filtering it would report the
    // unpinned run twice under two labels.
    const reachable = availableInstruments('ecb', difficulty).some(
      (instrument) => instrument.id === 'transmission_protection',
    )
    const plays: readonly Play[] = reachable
      ? ['competent', 'protected', 'unprotected', 'passive']
      : ['competent', 'passive']
    for (const play of plays) {
      const inflation: number[] = []
      const unemployment: number[] = []
      const spread: number[] = []
      const penalties: number[] = []
      const cohesionScores: number[] = []
      const pressures: number[] = []
      const tenures: number[] = []
      const banked: number[] = []
      const totals: number[] = []
      for (let index = 0; index < RUNS; index += 1) {
        const config = createRunConfig({
          institution: 'ecb',
          difficulty,
          seed: `fragmentation-${index}`,
          simulationVersion: SIMULATION_VERSION,
        })
        const session = playRun(config, choose(play, difficulty))
        const channels = cohesionChannels(session.state.history)
        inflation.push(channels.inflation)
        unemployment.push(channels.unemployment)
        spread.push(channels.spread)
        penalties.push(channels.total)
        const score = calculateScore(session.state, session.outcome)
        const component = score.components.find((c) => c.id === 'cohesion')
        if (component) cohesionScores.push(component.raw)
        totals.push(score.score)
        // The headline the player actually reads is the banked total, which is
        // the one built so that length and quality multiply. `score.score` is
        // the graded scorecard beside it, and it still averages a path — so on
        // a run cut short it rewards brevity. Both are reported because they
        // disagree, and the disagreement is QUESTIONS #19.
        banked.push(bankedTotal(session.state).total)
        tenures.push(session.state.meetingIndex)
        const history = session.state.history
        pressures.push(
          history.reduce((sum, s) => sum + s.latent.politicalPressure, 0) /
            Math.max(1, history.length),
        )
      }
      const penaltyMedian = median(penalties)
      console.log(
        [
          `ecb/${difficulty} ${play}`.padEnd(24),
          median(inflation).toFixed(2).padEnd(7),
          median(unemployment).toFixed(2).padEnd(7),
          median(spread).toFixed(2).padEnd(7),
          penaltyMedian.toFixed(2).padEnd(8),
          Math.max(0, penaltyMedian - COHESION_TOLERANCE).toFixed(2).padEnd(8),
          median(cohesionScores).toFixed(3).padEnd(9),
          median(pressures).toFixed(1).padEnd(9),
          median(tenures).toFixed(0).padEnd(7),
          median(banked).toFixed(0).padEnd(7),
          median(totals).toFixed(0),
        ].join(' '),
      )
    }
    console.log('-'.repeat(112))
  }

  paired()
  console.log('')
}

/**
 * The question the medians cannot answer: **is reaching for it ever right?**
 *
 * An instrument that repairs the component it points at and costs more
 * elsewhere than it returns is a trap, not a lever — and medians across arms
 * whose runs end at different meetings cannot tell the difference, because a
 * mandate that served sixty-four meetings and one revoked at nineteen bank
 * incomparable totals. So this is paired on the seed, and reports the *rate*
 * rather than the total.
 *
 * Three arms, same economies: the toolkit rule reaching for it when the area
 * is actually coming apart, the same rule forbidden it, and the same rule
 * holding it at full every meeting of the mandate.
 */
function paired(): void {
  console.log('')
  console.log('Paired on the seed — is reaching for it right?')
  console.log(
    'Banked per meeting, which is comparable across arms that end at different meetings.',
  )
  console.log('='.repeat(112))

  for (const difficulty of DIFFICULTIES) {
    const arms: readonly Play[] = ['competent', 'unprotected', 'protected']
    const rate: number[][] = [[], [], []]
    const tenure: number[][] = [[], [], []]

    for (let index = 0; index < RUNS; index += 1) {
      arms.forEach((play, arm) => {
        const config = createRunConfig({
          institution: 'ecb',
          difficulty,
          seed: `fragmentation-${index}`,
          simulationVersion: SIMULATION_VERSION,
        })
        const session = playRun(config, choose(play, difficulty))
        rate[arm].push(bankedTotal(session.state).perMeeting)
        tenure[arm].push(session.state.meetingIndex)
      })
    }

    const label = ['reaches for it', 'never uses it', 'holds it at full']
    console.log(`ecb/${difficulty}, ${RUNS} paired seeds`)
    arms.forEach((_, arm) => {
      console.log(
        `  ${label[arm].padEnd(18)} ${median(rate[arm]).toFixed(0).padStart(5)} a meeting` +
          `   over ${median(tenure[arm]).toFixed(0).padStart(3)} meetings`,
      )
    })
    // Paired, so the economy cancels and the count is the claim.
    const beats = rate[0].filter((value, index) => value > rate[1][index]).length
    const longer = tenure[0].filter((value, index) => value > tenure[1][index]).length
    const shorter = tenure[0].filter((value, index) => value < tenure[1][index]).length
    console.log(
      `  reaching for it banks more on ${beats}/${RUNS} seeds, ` +
        `serves longer on ${longer} and shorter on ${shorter}`,
    )
    console.log('-'.repeat(112))
  }
}

main()

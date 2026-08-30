/**
 * Developer-only balance sweep. Not part of the game bundle.
 *
 * Plays many seeded runs across every institution and difficulty under a
 * single fixed policy rule, and reports the distribution of scores and
 * outcomes. Its job is to catch balance configurations that are impossible,
 * trivial, or unwinnable — a bucket where every run completes untouched is as
 * broken as one where none survives.
 *
 * The rule below reads only observed data, exactly as a player must. It is
 * deliberately mediocre: if a plain Taylor-style reaction to noisy, lagged
 * indicators sweeps every difficulty, the game has no decision problem in it.
 *
 * Run with: npm run sim:sweep
 */

import type { Difficulty, Institution } from '../types/core.ts'
import type { EndConditionId } from '../types/scoring.ts'
import type { PolicyAction, PolicyPackage } from '../types/policy.ts'
import type { RunSession } from '../replay/replayRun.ts'
import { SIMULATION_VERSION } from '../version.ts'
import { getInstitution } from '../config/institutions.ts'
import { POLICY_RATE_FLOOR } from '../config/instruments.ts'
import { createRunConfig } from '../engine/initialState.ts'
import { calculateScore } from '../scoring/calculateScore.ts'
import { playRun } from '../replay/replayRun.ts'
import { staffRecommendation } from '../policy/staffRule.ts'
import { guidedStaffPackage } from '../policy/guidedStaffRule.ts'

/** Seeded runs per institution and difficulty. */
const RUNS_PER_BUCKET = 150

const INSTITUTIONS: readonly Institution[] = ['fed', 'ecb']
const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard']

/**
 * A plain reaction function over observed data, in quarter-point steps.
 *
 * `gapWeight` is the interesting dial. The real-time output gap estimate is
 * the noisiest number on the table, so a rule that leans on it hard is
 * reacting mostly to measurement error — the classic Orphanides critique.
 * Running the sweep at two weights shows whether the model reproduces it.
 */
function reactionRule(
  session: RunSession,
  institution: Institution,
  gapWeight: number,
): PolicyPackage {
  const indicators = session.observation.indicators
  const target = getInstitution(institution).inflationTarget

  const inflation = indicators.headline_inflation?.value ?? target
  const gap = indicators.output_gap_estimate?.value ?? 0
  const currentRate = session.state.latent.policyRate

  // Taylor-style desired rate, then move a quarter of the way toward it.
  const desired = 1 + inflation + 0.5 * (inflation - target) + gapWeight * gap
  let steps = Math.max(-3, Math.min(3, Math.round((desired - currentRate) * 4 * 0.25)))

  // Respect the effective lower bound, as any real committee must.
  const floor = POLICY_RATE_FLOOR[institution]
  const targetRate = session.state.stance.targetRate
  while (steps < 0 && targetRate + (steps * 25) / 100 < floor) steps += 1

  const actions: PolicyAction[] = []
  if (steps !== 0) actions.push({ instrument: 'policy_rate', magnitude: steps * 25 })

  return {
    actions,
    communication: {
      tone: steps > 0 ? 'hawkish' : steps < 0 ? 'dovish' : 'neutral',
      emphasis: 'data_dependence',
      commitment: 'weak_bias',
      channel: 'statement',
    },
  }
}

/**
 * The rule the staff actually advise from, played as a policy.
 *
 * Same module the Policy Desk uses, so the recommendation the player is shown
 * is the recommendation measured here. docs/BALANCE.md previously reported
 * results for a core-targeting rule that had never been committed; this is it,
 * and from here its performance is a fact rather than a recollection.
 */
function staffRule(
  session: RunSession,
  institution: Institution,
  difficulty: Difficulty,
): PolicyPackage {
  const advice = staffRecommendation(session.observation, institution, difficulty)
  const magnitude = advice?.basisPoints ?? 0
  return {
    actions: magnitude === 0 ? [] : [{ instrument: 'policy_rate', magnitude }],
    communication: {
      tone: magnitude > 0 ? 'hawkish' : magnitude < 0 ? 'dovish' : 'neutral',
      emphasis: 'data_dependence',
      commitment: 'weak_bias',
      channel: 'statement',
    },
  }
}

function quantile(sorted: readonly number[], fraction: number): number {
  if (sorted.length === 0) return 0
  const index = Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))
  return sorted[index]
}

function pad(value: string, width: number): string {
  return value.padEnd(width, ' ')
}

function main(): void {
  console.log('')
  console.log(`Balance sweep — engine ${SIMULATION_VERSION}`)
  console.log(`${RUNS_PER_BUCKET} seeded runs per bucket, one fixed reaction rule`)
  console.log('='.repeat(86))
  console.log(
    [pad('bucket', 14), pad('p10', 6), pad('median', 7), pad('p90', 6), pad('completed', 10), 'outcomes'].join(' '),
  )
  console.log('-'.repeat(86))

  let warnings = 0

  for (const institution of INSTITUTIONS) {
    for (const difficulty of DIFFICULTIES) {
      const scores: number[] = []
      const smoothedScores: number[] = []
      const passiveScores: number[] = []
      const staffScores: number[] = []
      const guidedScores: number[] = []
      const outcomes = new Map<EndConditionId, number>()
      const clampedVariables = new Map<string, number>()
      let completed = 0
      let smoothedCompleted = 0
      let passiveCompleted = 0
      let staffCompleted = 0
      let guidedCompleted = 0

      for (let index = 0; index < RUNS_PER_BUCKET; index += 1) {
        const config = createRunConfig({
          institution,
          difficulty,
          seed: `sweep-${index}`,
          simulationVersion: SIMULATION_VERSION,
        })

        const session = playRun(config, (current) =>
          reactionRule(current, institution, 0.5),
        )
        const score = calculateScore(session.state, session.outcome)

        scores.push(score.score)
        for (const diagnostic of session.state.diagnostics) {
          clampedVariables.set(
            diagnostic.variable,
            (clampedVariables.get(diagnostic.variable) ?? 0) + 1,
          )
        }
        if (session.outcome.status === 'completed') completed += 1

        // The same rule, but ignoring the real-time gap estimate entirely.
        const smoothed = playRun(config, (current) =>
          reactionRule(current, institution, 0),
        )
        smoothedScores.push(calculateScore(smoothed.state, smoothed.outcome).score)
        if (smoothed.outcome.status === 'completed') smoothedCompleted += 1

        // The same economy, left completely alone. A difficulty is only a real
        // decision problem if doing nothing is meaningfully worse than acting.
        const passive = playRun(config, () => ({ actions: [], communication: null }))
        passiveScores.push(calculateScore(passive.state, passive.outcome).score)
        if (passive.outcome.status === 'completed') passiveCompleted += 1

        // The rule the staff advise from in game, targeting core inflation.
        const staff = playRun(config, (current) =>
          staffRule(current, institution, difficulty),
        )
        staffScores.push(calculateScore(staff.state, staff.outcome).score)
        if (staff.outcome.status === 'completed') staffCompleted += 1

        // The same rule announcing its own intentions honestly — the second
        // instrument played straight. guidance.test.ts pins that this beats
        // the silent rule on easy and that bluffing loses to it.
        const guided = playRun(config, (current) =>
          guidedStaffPackage(current, institution, difficulty, 'honest'),
        )
        guidedScores.push(calculateScore(guided.state, guided.outcome).score)
        if (guided.outcome.status === 'completed') guidedCompleted += 1

        const outcome = session.outcome.triggered
        if (outcome) outcomes.set(outcome, (outcomes.get(outcome) ?? 0) + 1)
      }

      scores.sort((a, b) => a - b)
      smoothedScores.sort((a, b) => a - b)
      passiveScores.sort((a, b) => a - b)
      staffScores.sort((a, b) => a - b)
      guidedScores.sort((a, b) => a - b)
      const completionRate = completed / RUNS_PER_BUCKET

      const summary = [...outcomes.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([id, count]) => `${id} ${count}`)
        .join(', ')

      console.log(
        [
          pad(`${institution}/${difficulty}`, 14),
          pad(String(quantile(scores, 0.1)), 6),
          pad(String(quantile(scores, 0.5)), 7),
          pad(String(quantile(scores, 0.9)), 6),
          pad(`${(completionRate * 100).toFixed(0)} %`, 10),
          summary,
        ].join(' '),
      )

      const passiveRate = passiveCompleted / RUNS_PER_BUCKET
      const smoothedRate = smoothedCompleted / RUNS_PER_BUCKET
      const staffRate = staffCompleted / RUNS_PER_BUCKET
      const guidedRate = guidedCompleted / RUNS_PER_BUCKET
      const activeMedian = quantile(scores, 0.5)
      const smoothedMedian = quantile(smoothedScores, 0.5)
      const passiveMedian = quantile(passiveScores, 0.5)
      const staffMedian = quantile(staffScores, 0.5)
      const guidedMedian = quantile(guidedScores, 0.5)

      console.log(
        `${' '.repeat(14)} ignoring the noisy gap: ${String(smoothedMedian).padEnd(6)}` +
          ` (${(smoothedRate * 100).toFixed(0)} %)   doing nothing: ${String(passiveMedian).padEnd(6)}` +
          ` (${(passiveRate * 100).toFixed(0)} %)`,
      )
      console.log(
        `${' '.repeat(14)} staff rule (core):      ${String(staffMedian).padEnd(6)}` +
          ` (${(staffRate * 100).toFixed(0)} %)   with honest guidance: ${String(guidedMedian).padEnd(6)}` +
          ` (${(guidedRate * 100).toFixed(0)} %)`,
      )

      // A difficulty must be winnable when played well and losable when not.
      if (completionRate === 0 && smoothedRate === 0 && staffRate === 0 && guidedRate === 0) {
        console.log(`      ! ${institution}/${difficulty}: never survived under any rule. Unwinnable as configured.`)
        warnings += 1
      }
      if (
        Math.max(activeMedian, smoothedMedian, staffMedian, guidedMedian) <= passiveMedian
      ) {
        console.log(`      ! ${institution}/${difficulty}: no rule scores better than doing nothing.`)
        warnings += 1
      }
      if (clampedVariables.size > 0) {
        const detail = [...clampedVariables.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([variable, count]) => `${variable} x${count}`)
          .join(', ')
        console.log(`      ! ${institution}/${difficulty}: safety clamps fired — ${detail}`)
        warnings += 1
      }
    }
  }

  console.log('-'.repeat(86))
  console.log(
    warnings === 0
      ? 'No balance warnings.'
      : `${warnings} balance warning(s) above.`,
  )
  console.log('')
}

main()

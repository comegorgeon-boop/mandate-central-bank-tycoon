import type { Difficulty, Institution } from '../types/core.ts'
import type { LatentSnapshot, SimulationState } from '../types/state.ts'
import type {
  EndConditionResult,
  ScoreBreakdown,
  ScoreComponent,
  ScoreComponentId,
} from '../types/scoring.ts'
import { SCORING_VERSION } from '../version.ts'
import { clamp } from '../config/bounds.ts'
import { getDifficulty } from '../config/difficulty.ts'
import { getInstitution } from '../config/institutions.ts'
import { SPREADS, VOLATILITY } from '../config/model.ts'
import { YEARS_PER_MEETING } from '../config/time.ts'
import {
  MAX_SCORE,
  POLICY_VOLATILITY_ALLOWANCE_PER_YEAR,
  PRICE_STABILITY_GATE,
  SCORE_SCALES,
  SCORE_WEIGHTS,
  SHOCK_RESPONSE,
  STRESS_PENALTY_FLOOR,
} from '../config/scoring.ts'
import { unemploymentGap } from '../engine/indices.ts'

/**
 * Scoring, from 0 to 10,000.
 *
 * Every component is measured over the whole path, not the final turn: a run
 * that ends at target after four years of chaos does not score like one that
 * held the line throughout.
 *
 * Institution weights differ in the way their mandates do. For the Fed, price
 * stability and employment carry equal substantial weight. For the ECB, price
 * stability dominates, and a persistent failure on inflation additionally
 * pulls the whole score down through a multiplicative gate, so employment and
 * growth cannot buy their way past it.
 */

/** The records bucket a run belongs to. Buckets are never compared. */
export function scoreBucketKey(
  institution: Institution,
  difficulty: Difficulty,
  simulationVersion: string,
): string {
  return `${institution}:${difficulty}:${simulationVersion}`
}

/** Maps a path statistic onto 0..1: 1 is perfect, `scale` is one e-fold down. */
function performance(statistic: number, scale: number): number {
  if (!Number.isFinite(statistic)) return 0
  return Math.exp(-((statistic / scale) ** 2))
}

function rootMeanSquare(values: readonly number[]): number {
  if (values.length === 0) return 0
  let total = 0
  for (const value of values) total += value * value
  return Math.sqrt(total / values.length)
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0
  let total = 0
  for (const value of values) total += value
  return total / values.length
}

/** Financial stress penalty for one snapshot, in index points. */
function stressPenalty(snapshot: LatentSnapshot, institution: Institution): number {
  const latent = snapshot.latent
  const fragmentationPenalty =
    institution === 'ecb'
      ? Math.max(0, (latent.fragmentation - 150) / 10)
      : Math.max(0, latent.fragmentation - 35)

  return (
    Math.max(0, latent.bankingStress - STRESS_PENALTY_FLOOR) +
    12 * Math.max(0, latent.creditSpread - 2 * SPREADS.base) +
    0.35 * Math.max(0, latent.marketVolatility - VOLATILITY.base * 2.5) +
    fragmentationPenalty
  )
}

/**
 * Response to large shocks.
 *
 * The distinction the engine rewards is the textbook one. A demand shock
 * moves output and inflation the same way and should be leaned against. The
 * first-round effect of a supply shock moves them opposite ways and should
 * largely be looked through — the job is to keep expectations anchored, not
 * to crush output to offset a price level that has already moved.
 */
function shockResponseScore(state: SimulationState): {
  readonly raw: number
  readonly episodes: number
} {
  const history = state.history
  const lookAhead = 2
  const rewards: number[] = []

  for (let i = 0; i + lookAhead < history.length; i += 1) {
    const now = history[i].latent
    const later = history[i + lookAhead].latent

    if (Math.abs(now.demandShock) > SHOCK_RESPONSE.largeShockThreshold) {
      // Leaning against demand means the real stance moves with the shock.
      const stanceMove =
        later.policyRate -
        later.expectedInflationShort -
        (now.policyRate - now.expectedInflationShort)
      rewards.push(
        SHOCK_RESPONSE.demandLeanReward *
          clamp(Math.sign(now.demandShock) * (stanceMove / 0.5), -1, 1),
      )
    }

    if (now.supplyShock > SHOCK_RESPONSE.largeShockThreshold) {
      const anchorHeld = later.anchoring >= now.anchoring - 0.05 ? 1 : -0.5
      const outputSacrifice = Math.max(0, now.outputGap - later.outputGap - 1.5)
      rewards.push(
        SHOCK_RESPONSE.supplyLookThroughReward * anchorHeld -
          SHOCK_RESPONSE.anchoringPenalty * clamp(outputSacrifice / 2, 0, 1),
      )
    }
  }

  if (rewards.length === 0) {
    return { raw: SHOCK_RESPONSE.neutralScore, episodes: 0 }
  }
  return {
    raw: clamp(0.5 + 0.5 * mean(rewards), 0, 1),
    episodes: rewards.length,
  }
}

/** Cumulative rate churn and direction reversals over the run. */
function policyChurn(state: SimulationState): {
  readonly churn: number
  readonly reversals: number
} {
  const history = state.history
  let churn = 0
  let reversals = 0
  let previousDirection = 0

  for (let i = 1; i < history.length; i += 1) {
    const move = history[i].latent.policyRate - history[i - 1].latent.policyRate
    churn += Math.abs(move)
    const direction = Math.sign(move)
    if (direction !== 0) {
      if (previousDirection !== 0 && direction !== previousDirection) reversals += 1
      previousDirection = direction
    }
  }

  return { churn, reversals }
}

export function calculateScore(
  state: SimulationState,
  outcome: EndConditionResult,
): ScoreBreakdown {
  const institution = getInstitution(state.config.institution)
  const difficulty = getDifficulty(state.config.difficulty)
  const weights = SCORE_WEIGHTS[state.config.institution]
  const target = institution.inflationTarget
  const history = state.history

  // ---- Price stability ----------------------------------------------------
  const headlineMisses = history.map((s) => s.latent.inflationHeadline - target)
  const coreMisses = history.map((s) => s.latent.inflationCore - target)
  const priceRmse =
    0.6 * rootMeanSquare(headlineMisses) + 0.4 * rootMeanSquare(coreMisses)
  const priceRaw = performance(priceRmse, SCORE_SCALES.priceStabilityRmse)

  // ---- Employment and output ---------------------------------------------
  const unemploymentMisses = history.map((s) => unemploymentGap(s.latent))
  const outputMisses = history.map((s) => s.latent.outputGap)
  const employmentRmse =
    0.6 * rootMeanSquare(unemploymentMisses) + 0.4 * rootMeanSquare(outputMisses)
  const employmentRaw = performance(employmentRmse, SCORE_SCALES.employmentRmse)

  // ---- Financial stability -----------------------------------------------
  const stress = mean(history.map((s) => stressPenalty(s, state.config.institution)))
  const financialRaw = performance(stress, SCORE_SCALES.financialStress)

  // ---- Expectations anchoring --------------------------------------------
  const anchorMisses = history.map((s) => s.latent.expectedInflationLong - target)
  const anchoringRmse = rootMeanSquare(anchorMisses)
  const anchoringRaw = performance(anchoringRmse, SCORE_SCALES.anchoringRmse)

  // ---- Credibility and communication consistency -------------------------
  const averageCredibility = mean(history.map((s) => s.latent.credibility))
  const consistency = clamp(1 - 0.06 * state.guidance.brokenPromises, 0.5, 1)
  const credibilityRaw =
    performance(100 - averageCredibility, SCORE_SCALES.credibilityShortfall) *
    consistency

  // ---- Shock response -----------------------------------------------------
  const shock = shockResponseScore(state)

  // ---- Policy volatility --------------------------------------------------
  const { churn, reversals } = policyChurn(state)
  const yearsServed = Math.max(YEARS_PER_MEETING, state.timeYears)
  const allowance = POLICY_VOLATILITY_ALLOWANCE_PER_YEAR * yearsServed
  const excess = Math.max(0, churn - allowance) + 0.25 * reversals
  const volatilityRaw = performance(excess, SCORE_SCALES.policyVolatility)

  // ---- Survival and completion -------------------------------------------
  const served = clamp(state.meetingIndex / state.config.meetingCount, 0, 1)
  const completionRaw = outcome.status === 'completed' ? 1 : served * 0.6

  const definitions: readonly {
    id: ScoreComponentId
    label: string
    raw: number
    explanation: string
  }[] = [
    {
      id: 'price_stability',
      label: 'Price stability',
      raw: priceRaw,
      explanation: `Inflation sat ${priceRmse.toFixed(2)} points from the ${target.toFixed(1)} % objective on average over the mandate, measured across headline and core.`,
    },
    {
      id: 'employment_output',
      label: 'Employment and output',
      raw: employmentRaw,
      explanation: `Unemployment and the output gap averaged ${employmentRmse.toFixed(2)} points away from their sustainable levels.`,
    },
    {
      id: 'financial_stability',
      label: 'Financial stability',
      raw: financialRaw,
      explanation: `Average financial stress penalty of ${stress.toFixed(1)} index points across banking stress, spreads, volatility and transmission.`,
    },
    {
      id: 'anchoring',
      label: 'Expectations anchoring',
      raw: anchoringRaw,
      explanation: `Long-run inflation expectations stayed ${anchoringRmse.toFixed(2)} points from target on average.`,
    },
    {
      id: 'credibility',
      label: 'Credibility and consistency',
      raw: credibilityRaw,
      explanation: `Credibility averaged ${averageCredibility.toFixed(0)} out of 100, with ${state.guidance.brokenPromises} unjustified guidance reversal(s).`,
    },
    {
      id: 'shock_response',
      label: 'Response to large shocks',
      raw: shock.raw,
      explanation:
        shock.episodes === 0
          ? 'No shock large enough to test the reaction function arrived during this mandate.'
          : `${shock.episodes} large shock episode(s): demand shocks called for leaning against, supply shocks for defending the anchor rather than crushing output.`,
    },
    {
      id: 'policy_volatility',
      label: 'Policy steadiness',
      raw: volatilityRaw,
      explanation: `${churn.toFixed(2)} points of cumulative rate movement and ${reversals} direction reversal(s), against a ${allowance.toFixed(2)} point free allowance.`,
    },
    {
      id: 'completion',
      label: 'Mandate completion',
      raw: completionRaw,
      explanation:
        outcome.status === 'completed'
          ? 'The full mandate was served.'
          : `The mandate ended after ${state.meetingIndex} of ${state.config.meetingCount} meetings.`,
    },
  ]

  const components: ScoreComponent[] = definitions.map((definition) => {
    const weight = weights[definition.id]
    const raw = clamp(definition.raw, 0, 1)
    return {
      id: definition.id,
      label: definition.label,
      raw,
      weight,
      contribution: raw * weight,
      explanation: definition.explanation,
    }
  })

  const weightedTotal = components.reduce(
    (total, component) => total + component.contribution,
    0,
  )

  // The ECB safeguard. The Fed's mandate is coequal, so its gate is always 1.
  let priceStabilityGate = 1
  if (state.config.institution === 'ecb' && priceRaw < PRICE_STABILITY_GATE.threshold) {
    priceStabilityGate =
      PRICE_STABILITY_GATE.floor +
      (1 - PRICE_STABILITY_GATE.floor) * (priceRaw / PRICE_STABILITY_GATE.threshold)
  }

  const scaled = clamp(
    weightedTotal * priceStabilityGate * difficulty.scoreMultiplier,
    0,
    1,
  )

  return {
    score: Math.round(scaled * MAX_SCORE),
    components,
    weightedTotal,
    priceStabilityGate,
    difficultyMultiplier: difficulty.scoreMultiplier,
    bucketKey: scoreBucketKey(
      state.config.institution,
      state.config.difficulty,
      state.config.simulationVersion,
    ),
    simulationVersion: state.config.simulationVersion,
    scoringVersion: SCORING_VERSION,
  }
}

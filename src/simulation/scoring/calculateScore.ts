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
  CONDUCT_GATE,
  MAX_SCORE,
  MISSED_OBJECTIVE_CREDIT,
  POLICY_VOLATILITY_ALLOWANCE_PER_YEAR,
  PRICE_STABILITY_GATE,
  SCORE_SCALES,
  SCORE_WEIGHTS,
  SHOCK_RESPONSE,
  STRESS_PENALTY_FLOOR,
  SUPPLY_REGIME,
} from '../config/scoring.ts'
import { supplyRegimePressure, unemploymentGap } from '../engine/indices.ts'

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

/**
 * The component weights this mandate is actually judged on.
 *
 * Under cost-push pressure, weight moves out of price stability and into
 * anchoring and shock response — the objective a committee is really held to
 * when returning inflation to target is not available. See `SUPPLY_REGIME`.
 *
 * The moved weight is redistributed rather than discarded, so the set still
 * sums to one and a supply-shocked mandate is judged on the same total as any
 * other. It is a different question, not an easier one.
 */
function regimeWeights(
  base: Readonly<Record<ScoreComponentId, number>>,
  history: readonly LatentSnapshot[],
): { readonly weights: Readonly<Record<ScoreComponentId, number>>; readonly share: number } {
  const pressure =
    history.length === 0 ? 0 : mean(history.map((s) => supplyRegimePressure(s.latent)))
  // Saturating, not linear: a mandate cannot spend all of itself at the peak of
  // a shock, so the raw mean tops out around a third even when cost-push was
  // the whole story. See `SUPPLY_REGIME.shareAtFullShift`.
  const share = clamp(pressure / SUPPLY_REGIME.shareAtFullShift, 0, 1)
  if (share <= 0) return { weights: base, share: 0 }

  const moved = base.price_stability * SUPPLY_REGIME.maxShift * share
  return {
    share,
    weights: {
      ...base,
      price_stability: base.price_stability - moved,
      anchoring: base.anchoring + moved * SUPPLY_REGIME.anchoringShare,
      shock_response:
        base.shock_response + moved * (1 - SUPPLY_REGIME.anchoringShare),
    },
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
  const target = institution.inflationTarget
  const history = state.history
  // What the mandate is judged on, which is not fixed: under a cost-push
  // regime the objective itself moves. See `SUPPLY_REGIME`.
  const { weights, share: supplyRegimeShare } = regimeWeights(
    SCORE_WEIGHTS[state.config.institution],
    history,
  )

  // ---- Price stability ----------------------------------------------------
  //
  // Measured honestly and in full, in every regime. What a cost-push shock
  // changes is not how far inflation sat from target — that is a fact — but
  // how much of the verdict the fact carries. See `SUPPLY_REGIME`.
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
  const difficultyId = state.config.difficulty
  const { churn, reversals } = policyChurn(state)
  const yearsServed = Math.max(YEARS_PER_MEETING, state.timeYears)
  const allowance = POLICY_VOLATILITY_ALLOWANCE_PER_YEAR[difficultyId] * yearsServed
  const excess = Math.max(0, churn - allowance) + 0.25 * reversals
  const volatilityRaw = performance(excess, SCORE_SCALES.policyVolatility)

  // ---- Survival and completion -------------------------------------------
  //
  // A tutorial that ran its length without reaching its objective has
  // *finished* but has not *succeeded*, and the two must not score alike. Both
  // return `status: 'completed'` — nothing collapsed, the run simply ended —
  // so reading the status alone gave a player who never repaired the economy
  // the same full marks as one who repaired it in twelve meetings.
  const served = clamp(state.meetingIndex / state.config.meetingCount, 0, 1)
  const completionRaw =
    outcome.triggered === 'objective_missed'
      ? MISSED_OBJECTIVE_CREDIT
      : outcome.status === 'completed'
        ? 1
        : served * 0.6

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
      explanation:
        `Inflation sat ${priceRmse.toFixed(2)} points from the ${target.toFixed(1)} % objective on average over the mandate, measured across headline and core.` +
        (supplyRegimeShare > 0.05
          ? ` Costs were being pushed up from outside domestic demand for much of the mandate, so this counts for less than usual here — ${(supplyRegimeShare * 100).toFixed(0)} % of the way toward the regime's own objective, which is the anchor and the total damage rather than the target itself.`
          : ''),
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
        outcome.triggered === 'objective_met'
          ? `The objective was reached and held, after ${state.meetingIndex} meetings.`
          : outcome.triggered === 'objective_missed'
            ? `${state.meetingIndex} meetings were served without the objective being reached.`
            : outcome.status === 'completed'
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
  //
  // Its floor rises with the cost-push regime, for the same reason the weights
  // move: the gate exists so that strong employment cannot buy past a *failure*
  // on inflation, and a price level pushed up by a shock no instrument reaches
  // is not that failure. Softened, never removed — the gate still bites hardest
  // on the mandates that let the anchor go with it.
  let priceStabilityGate = 1
  if (state.config.institution === 'ecb' && priceRaw < PRICE_STABILITY_GATE.threshold) {
    const floor =
      PRICE_STABILITY_GATE.floor +
      (1 - PRICE_STABILITY_GATE.floor) * SUPPLY_REGIME.maxShift * supplyRegimeShare
    priceStabilityGate =
      floor + (1 - floor) * (priceRaw / PRICE_STABILITY_GATE.threshold)
  }

  // The conduct gate. Both institutions, and now every difficulty: erratic,
  // self-contradictory policy guts the score independent of how the real
  // economy absorbed it — see CONDUCT_GATE's own doc comment for why this has
  // to be a gate on the decisions themselves rather than trusted to the
  // weighted blend above.
  //
  // It applied at easy alone until the two populations were measured at every
  // difficulty. They separate by six to twenty times everywhere; what medium
  // and hard needed was not exemption but a free allowance matched to the
  // conduct their own noise legitimately produces. Until then, sabotage was
  // very nearly free above easy: measured on this build before the change, a
  // deliberately sabotaging mandate scored 6331 against competent play's 7446
  // on fed/medium, and on ecb/medium it beat competent play outright.
  const billedContradictionCost = Math.max(
    0,
    state.contradictionCost - CONDUCT_GATE.freeContradictionCost[difficultyId],
  )
  const billedBrokenPromises = Math.max(
    0,
    state.guidance.brokenPromises - CONDUCT_GATE.freeBrokenPromises[difficultyId],
  )
  const conductGate = Math.max(
    CONDUCT_GATE.floor,
    Math.exp(-Math.max(0, churn - allowance) / CONDUCT_GATE.churnScale) *
      Math.exp(-billedContradictionCost / CONDUCT_GATE.contradictionScale) *
      Math.exp(-billedBrokenPromises / CONDUCT_GATE.brokenPromiseScale),
  )

  const scaled = clamp(
    weightedTotal * priceStabilityGate * conductGate * difficulty.scoreMultiplier,
    0,
    1,
  )

  return {
    score: Math.round(scaled * MAX_SCORE),
    components,
    weightedTotal,
    priceStabilityGate,
    conductGate,
    supplyRegimeShare,
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
